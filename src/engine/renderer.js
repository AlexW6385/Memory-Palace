// Renderer: three.js WebGPU (WebGL 2 backend when WebGPU is missing), physically based
// materials, cascaded sun shadows, GTAO on indirect light, baked irradiance volumes for
// indirect light, bloom, AgX tone mapping.

import * as THREE from 'three/webgpu';
import { pass, mrt, normalView, screenUV, context, float, renderOutput } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { smaa } from 'three/addons/tsl/display/SMAANode.js';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import { SUN_DIR, SUN_COLOR, SUN_INTENSITY } from '../core/light.js';
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
    r.toneMappingExposure = 0.95;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;

    const scene = this.scene = new THREE.Scene();
    const camera = this.camera = new THREE.PerspectiveCamera(68, 1, 0.08, 4000);
    camera.rotation.order = 'YXZ';

    // sky
    const sky = this.sky = new SkyMesh();
    sky.scale.setScalar(3500);
    sky.turbidity.value = 3.2;
    sky.rayleigh.value = 1.1;
    sky.mieCoefficient.value = 0.004;
    sky.mieDirectionalG.value = 0.82;
    sky.cloudCoverage.value = 0.12;
    sky.sunPosition.value.set(...SUN_DIR).multiplyScalar(1000);
    scene.add(sky);

    // sun
    const sun = this.sun = new THREE.DirectionalLight(new THREE.Color(...SUN_COLOR), SUN_INTENSITY);
    sun.castShadow = true;
    sun.shadow.bias = -0.0004;
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
    const csm = new CSMShadowNode(sun, { cascades: Q.cascades, maxFar: 320, mode: 'practical', lightMargin: 120 });
    csm.fade = true;
    sun.shadow.shadowNode = csm;
    this.buildPipeline();
    this.resize();
  }

  buildPipeline() {
    const { scene, camera, Q } = this;
    const scenePass = pass(scene, camera);
    let aoValue = float(1);
    if (Q.ao) {
      const prePass = pass(scene, camera);
      prePass.setMRT(mrt({ output: normalView }));
      const aoPass = ao(prePass.getTextureNode('depth'), prePass.getTextureNode(), camera);
      aoPass.resolutionScale = 0.5;
      aoPass.distanceExponent.value = 1.0;
      aoPass.radius.value = 0.9;
      aoPass.thickness.value = 1.0;
      aoValue = aoPass.getTextureNode().sample(screenUV).r;
    }
    const gi = this.giNode;
    scenePass.contextNode = context({
      getAO: (input, { material }) => (material.transparent ? input : (input !== null ? input.mul(aoValue) : aoValue)),
      getGI: (input, { material }) => (material.transparent ? input : (input !== null ? input.add(gi) : gi)),
    });
    const color = scenePass.getTextureNode('output');
    let out = renderOutput(color.add(bloom(color, 0.12, 0.35, 1.1)));
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
    this.sun.position.set(c.x + SUN_DIR[0] * 400, c.y + SUN_DIR[1] * 400, c.z + SUN_DIR[2] * 400);
    this.sun.target.position.copy(c);
  }

  render() {
    this.update();
    this.pipeline.render();
  }

  /** Compile all materials before showing the scene, so entering does not stutter. */
  async warmup() {
    await this.renderer.compileAsync(this.scene, this.camera);
  }
}
