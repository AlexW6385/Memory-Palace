// Renderer: three.js WebGPU (WebGL 2 backend when WebGPU is missing), physically based
// materials, cascaded sun shadows, baked irradiance volumes for indirect light, GTAO from the
// same scene pass (one pass draws colour and normals), bloom, AgX tone mapping.

import * as THREE from 'three/webgpu';
import { pass, context, renderOutput, fog, vec3, vec4, min, mix, luminance, smoothstep, positionLocal, normalize, floor, fract, hash, length, dot, exp, sin, time, max, pow, float, mx_fractal_noise_float } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { smaa } from 'three/addons/tsl/display/SMAANode.js';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import { ENV, cloudShadow, fogFactor, fogColor } from './env.js';
import { GIVolume } from './gi.js';
import { useGI } from './materials.js';

export const QUALITY = {
  high: { pixelRatio: 1.5, shadowMap: 4096, cascades: 4, ao: true, aa: true },
  medium: { pixelRatio: 1.0, shadowMap: 2048, cascades: 3, ao: true, aa: true },
  low: { pixelRatio: 0.75, shadowMap: 1024, cascades: 2, ao: false, aa: false },
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.webgpu = !!navigator.gpu;
  }

  async init(quality = 'high') {
    const r = this.renderer = new THREE.WebGPURenderer({ canvas: this.canvas, antialias: false, forceWebGL: !this.webgpu, powerPreference: 'high-performance' });
    await r.init();
    this.webgpu = r.backend.isWebGPUBackend === true;
    r.toneMapping = THREE.AgXToneMapping;
    r.toneMappingExposure = 0.55;          // set each frame from the climate and the eye's adaptation
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    // stained glass colours the sunlight that passes through it (material.castShadowNode)
    r.shadowMap.transmitted = true;

    const scene = this.scene = new THREE.Scene();
    const camera = this.camera = new THREE.PerspectiveCamera(68, 1, 0.08, 4000);
    camera.rotation.order = 'YXZ';

    // sky
    const sky = this.sky = new SkyMesh();
    sky.scale.setScalar(3500);
    sky.material.fog = false;
    scene.add(sky);
    // the night sky over it: stars, the band of the Milky Way, a faint glow; and the moon
    scene.add(this.stars = starDome(), this.moon = moonDisc());
    // haze: denser near the ground, glowing toward the sun; parameters come from the climate
    scene.fogNode = fog(fogColor, fogFactor);
    this.sunDir = [0, 1, 0];

    // sun
    const sun = this.sun = new THREE.DirectionalLight(0xffffff, 3);
    sun.castShadow = true;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    sun.shadow.normalBias = 0.04;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 900;
    scene.add(sun, sun.target);

    // baked indirect light
    this.gi = new GIVolume();
    this.giNode = this.gi.irradianceNode();
    useGI(this.gi);

    this.pipeline = new THREE.RenderPipeline(r);
    this.setQuality(quality);
    this.resize();
    addEventListener('resize', () => this.resize());
    return this;
  }

  setQuality(q) {
    const Q = this.Q = QUALITY[q] || QUALITY.high;
    this.quality = q;
    const r = this.renderer, sun = this.sun;
    r.setPixelRatio(Math.min(devicePixelRatio, Q.pixelRatio));
    sun.shadow.mapSize.set(Q.shadowMap, Q.shadowMap);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    const csm = new CSMShadowNode(sun, { cascades: Q.cascades, maxFar: 320, mode: 'practical', lightMargin: 200 });
    csm.fade = true;
    sun.shadow.shadowNode = csm;
    this.buildPipeline();
    this.resize();
  }

  buildPipeline() {
    const { scene, camera, Q } = this;
    // one scene pass: every material is compiled and drawn once per frame (a separate normal
    // pre-pass for the ambient occlusion doubled both the shaders to compile and the drawing);
    // the occlusion reads the depth alone and rebuilds the normals from it
    const scenePass = this.scenePass = pass(scene, camera);
    const gi = this.giNode;
    scenePass.contextNode = context({
      getGI: (input, { material }) => (material.transparent ? input : (input !== null ? input.add(gi) : gi)),
      // the sun is dimmed where the shadows of the clouds pass
      getShadow: ({ light, shadowColorNode }) => (light === this.sun ? shadowColorNode.mul(cloudShadow) : shadowColorNode),
    });
    let color = scenePass.getTextureNode('output');
    if (Q.ao) {
      const aoPass = ao(scenePass.getTextureNode('depth'), null, camera);
      aoPass.resolutionScale = 0.5;
      aoPass.distanceExponent.value = 1.0;
      aoPass.radius.value = 0.9;
      aoPass.thickness.value = 1.0;
      // occlusion darkens the shaded and half-lit parts; in full sun it is mostly hidden
      const a = aoPass.getTextureNode().r;
      const lit = smoothstep(0.6, 3.0, luminance(color.rgb));
      color = vec4(color.rgb.mul(mix(a, mix(1, a, 0.35), lit)), color.a);
    }
    // the sun's disc is thousands of times brighter than the sky: clamp it before the bloom, or its
    // glow floods half the picture when one looks toward a low sun
    const glowSrc = vec4(min(color.rgb, vec3(5)), 1);
    let out = renderOutput(color.add(bloom(glowSrc, 0.1, 0.3, 1.2)));
    if (Q.aa) out = smaa(out);
    this.pipeline.outputColorTransform = false;
    this.pipeline.outputNode = out;
    this.pipeline.needsUpdate = true;
  }

  resize() {
    if (!this.renderer) return;
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 78 : 68;
    this.camera.updateProjectionMatrix();
  }

  /** Keep the sun's shadow cascades and the sky centred on the viewer. */
  update() {
    const c = this.camera.position;
    this.sky.position.copy(c);
    this.stars.position.copy(c);
    const m = ENV.moonDir.value;
    this.moon.position.set(c.x + m.x * 3000, c.y + m.y * 3000, c.z + m.z * 3000);
    this.moon.lookAt(c);
    this.moon.visible = m.y > -0.05;
    const d = this.sunDir;
    this.sun.position.set(c.x + d[0] * 400, c.y + d[1] * 400, c.z + d[2] * 400);
    this.sun.target.position.copy(c);
  }

  render() {
    this.update();
    this.pipeline.render();
  }

  /**
   * Make ready what is round the viewer before it is shown: draw a frame looking each of four
   * ways (behind the loading screen or the travel fade), so that the pipelines of everything near
   * are compiled exactly as the scene pass uses them, then wait for the GPU to finish.
   */
  async warmup() {
    const cam = this.camera, yaw = cam.rotation.y;
    for (let k = 0; k < 4; k++) { cam.rotation.y = yaw + k * Math.PI / 2; cam.updateMatrixWorld(); this.render(); }
    cam.rotation.y = yaw; cam.updateMatrixWorld();
    const device = this.renderer.backend?.device;
    if (device) await device.queue.onSubmittedWorkDone();
  }
}

/**
 * The night sky: a dome inside the sky's, adding stars (a few thousand points of different
 * brightness, twinkling a little), the Milky Way as a faint cloudy band, and a dim blue glow, all
 * fading in as the daylight goes and hidden by cloud.
 */
function starDome() {
  const m = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const d = normalize(positionLocal);
  const N = 260, g = d.mul(N), cell = floor(g), f = fract(g).sub(0.5);
  const h = hash(cell.x.mul(7.13).add(cell.y.mul(113.31)).add(cell.z.mul(37.77)));
  const shape = smoothstep(0.32, 0.0, length(f));
  const bright = smoothstep(0.988, 1.0, h).mul(shape).mul(sin(time.mul(h.mul(9).add(2))).mul(0.18).add(0.82));
  const tint = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.86, 0.7), hash(cell.x.add(cell.z.mul(3.1))));
  // the Milky Way: a band about a great circle, broken by dust
  const axis = normalize(vec3(0.35, 0.6, -0.72));
  const band = exp(dot(d, axis).mul(dot(d, axis)).mul(-26)).mul(mx_fractal_noise_float(d.mul(9), 4, 2, 0.5).mul(0.5).add(0.5));
  const above = smoothstep(-0.05, 0.12, d.y);
  const night = ENV.night.mul(ENV.night).mul(float(1).sub(ENV.clouds.mul(0.95)));      // stars only once the sky is dark
  const glow = vec3(0.004, 0.007, 0.016).add(vec3(0.035, 0.04, 0.05).mul(band));
  m.colorNode = tint.mul(bright).mul(3.0).add(glow).mul(night).mul(above);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(3200, 48, 24), m);
  mesh.name = 'stars';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}

/** The full moon: a pale disc with darker seas, seen through the haze as the sky darkens. */
function moonDisc() {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false });
  const p = positionLocal.xy.div(26);
  const r = length(p);
  const seas = mx_fractal_noise_float(vec3(p.mul(2.2), 1.7), 3, 2, 0.5).mul(0.5).add(0.5);
  const disc = smoothstep(1.0, 0.94, r);
  const lum = mix(float(1.0), float(0.72), smoothstep(0.45, 0.7, seas));
  m.colorNode = vec3(1.0, 0.98, 0.92).mul(lum).mul(4.0).mul(max(ENV.night, 0.15));
  m.opacityNode = disc.mul(float(1).sub(ENV.clouds.mul(0.85))).mul(smoothstep(0.0, 0.6, ENV.night).mul(0.85).add(0.15));
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(26, 48), m);
  mesh.name = 'moon';
  mesh.frustumCulled = false;
  return mesh;
}

