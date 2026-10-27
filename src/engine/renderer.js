// Renderer: three.js WebGPU (WebGL 2 backend when WebGPU is missing), physically based
// materials, cascaded sun shadows, baked irradiance volumes for indirect light, GTAO from the
// same scene pass (one pass draws colour and normals), bloom, AgX tone mapping.

import * as THREE from 'three/webgpu';
import { pass, context, renderOutput, fog, vec3, vec4, min, mix, luminance, smoothstep } from 'three/tsl';
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
    const d = this.sunDir;
    this.sun.position.set(c.x + d[0] * 400, c.y + d[1] * 400, c.z + d[2] * 400);
    this.sun.target.position.copy(c);
  }

  render() {
    this.update();
    this.pipeline.render();
  }

  /**
   * Compile the pipelines an object needs, in the background, as the scene pass will draw it (its
   * render target, outputs and lighting context), so that it does not stall the frame in which it
   * first appears. The pass is set up by drawing one frame of the empty sky first.
   */
  async compile(object) {
    const r = this.renderer, P = this.scenePass;
    if (!this._primed) {
      this._primed = true;
      const shown = this.scene.children.filter((c) => c !== this.sky && c.visible);
      for (const c of shown) c.visible = false;
      this.update();
      this.pipeline.render();
      for (const c of shown) c.visible = true;
    }
    const rt = r.getRenderTarget(), mrtNow = r.getMRT(), ctx = r.contextNode;
    r.setRenderTarget(P.renderTarget);
    if (P.contextNode) r.contextNode = P._contextNodeCache?.context || context({ ...ctx.getFlowContextData(), ...P.contextNode.getFlowContextData() });
    try { await r.compileAsync(object, this.camera, this.scene); } finally {
      r.setRenderTarget(rt); r.setMRT(mrtNow); r.contextNode = ctx;
    }
  }

  /**
   * Before showing the scene: compile what the camera sees now (so the first frames do not
   * stall); then, in the background, the rest of what is in the scene (behind the visitor).
   */
  async warmup() {
    const cam = this.camera;
    cam.updateMatrixWorld();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const hidden = [];
    this.scene.traverse((o) => {
      if (!o.isMesh || !o.visible || o === this.sky) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      if (!frustum.intersectsObject(o)) { o.visible = false; hidden.push(o); }
    });
    try { await this.compile(this.scene); } finally { for (const o of hidden) o.visible = true; }
    if (hidden.length) this.compile(this.scene).catch(() => {});
  }
}
