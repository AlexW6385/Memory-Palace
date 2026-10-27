// Vegetation in the viewer. Plants are scattered cell by cell in a worker (trees and shrubs in
// cells of 128 m out to the far view, grass in cells of 16 m around the viewer), then drawn as
// instanced meshes per species, variant and level of detail, swaying in the wind.

import * as THREE from 'three/webgpu';
import { uniform, texture, uv, positionLocal, time, sin, cos, vec3, vec4, float, attribute, instanceIndex, hash, mix, normalWorld, max, dot, normalize, faceDirection, cameraViewMatrix } from 'three/tsl';
import { SPECIES, VARIANTS, speciesGeometry } from './species.js';
import { foliageTexture } from './textures.js';
import { MAX_DENSITY, NEAR_ONLY } from '../../world/flora-rules.js';
import { material as paletteMaterial } from '../materials.js';
import { ENV } from '../env.js';
import { WORLD } from '../../world/regions.js';

const BIG = 128, SMALL = 16, NEAR_R = 64;

const FOLIAGE_TEX = { acacia: 'acacia', broad: 'broad', broad_dark: 'broad', tamarisk: 'tamarisk', reed: 'reed', grass: 'grass', grass_dry: 'grass', needles: 'needles', scale: 'scale', olive: 'olive', oleander: 'oleander', sugi: 'scale', maple: 'maple', bamboo: 'bamboo', teak: 'broad' };
const FOLIAGE_TINT = { teak: '#c4c48a', sugi: '#a8b29a', broad_dark: '#9aa58f', grass_dry: '#e2cf96', grass: '#ffffff' };

/** The wind: a sway of the upper parts, stronger in a windy weather, each plant with its own phase. */
function swayNode(amount) {
  const ph = hash(instanceIndex).mul(6.28);
  const s = attribute('sway', 'float');
  const gust = sin(time.mul(0.37).add(ph.mul(0.3))).mul(0.5).add(0.8);
  const amp = uniform(amount).mul(ENV.wind.length().mul(0.6).add(0.4)).mul(gust).mul(s);
  return positionLocal.add(vec3(sin(time.mul(1.7).add(ph)).mul(amp).add(ENV.wind.x.mul(amp).mul(0.6)), 0, cos(time.mul(1.3).add(ph)).mul(amp).add(ENV.wind.y.mul(amp).mul(0.6))));
}

const mats = new Map();
function foliageMaterial(kind, amount) {
  const key = `f:${kind}`;
  if (mats.has(key)) return mats.get(key);
  const tex = foliageTexture(FOLIAGE_TEX[kind] || kind);
  const m = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide, alphaTest: 0.5, transparent: false });
  const t = texture(tex, uv());
  const tint = new THREE.Color(FOLIAGE_TINT[kind] || '#ffffff');
  m.colorNode = t.rgb.mul(uniform(tint));
  m.opacityNode = t.a;
  m.roughness = 0.8;
  // light through the leaves: a little of the sun's colour on the side away from it
  const back = max(dot(normalWorld, ENV.sunDir).negate(), 0).mul(0.18);
  m.emissiveNode = t.rgb.mul(ENV.sunColor).mul(back).mul(0.25);
  m.positionNode = swayNode(amount);
  // a crown or a tuft is lit as a whole, not card by card: bend the cards' normals up toward the
  // sky, so that cards seen from behind are not black
  const nW = normalize(normalWorld.mul(faceDirection).mul(0.4).add(vec3(0, 0.6, 0)));
  m.normalNode = normalize(cameraViewMatrix.mul(vec4(nW, 0)).xyz);
  mats.set(key, m);
  return m;
}
function solidMaterial(key, amount) {
  const k = `s:${key}:${amount}`;
  if (mats.has(k)) return mats.get(k);
  const m = paletteMaterial(key).clone();
  m.positionNode = swayNode(amount);
  mats.set(k, m);
  return m;
}

export class Flora {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'flora';
    scene.add(this.group);
    this.cells = new Map();          // key → Float32Array of instances (or 'pending')
    this.species = null;
    this.batches = new Map();        // `${sp}/${v}/${lod}` → { trunk, leaves, cap }
    this.dirty = true;
    this.last = null;
    this.queue = [];
    this.workers = Array.from({ length: 2 }, () => {
      const w = new Worker(new URL('./scatter-worker.js', import.meta.url), { type: 'module' });
      w.idle = true;
      w.onmessage = (e) => {
        if (e.data.species) { this.species = e.data.species; this.pump(); return; }
        w.idle = true;
        const c = this.cells.get(e.data.id);
        if (c) { c.data = e.data.data; c.state = 'done'; this.dirty = true; }
        this.pump();
      };
      return w;
    });
    this.maxLod = Math.max(...Object.values(SPECIES).map((s) => s.lod[1]));
    this.scale = 1;                 // view distance of plants, by picture quality
  }

  /** Cells wanted around (x, z): far cells for trees, near cells for grass. */
  update(x, z) {
    const want = new Set();
    const [X0, Z0, X1, Z1] = WORLD.bounds;
    const R = this.maxLod;
    for (let cx = Math.floor((x - R) / BIG) * BIG; cx < x + R; cx += BIG) for (let cz = Math.floor((z - R) / BIG) * BIG; cz < z + R; cz += BIG) {
      if (cx + BIG < X0 - 400 || cx > X1 + 400 || cz + BIG < Z0 - 400 || cz > Z1 + 400) continue;
      const d = Math.hypot(Math.max(cx - x, 0, x - cx - BIG), Math.max(cz - z, 0, z - cz - BIG));
      if (d < R) want.add(`B:${cx},${cz}`);
    }
    for (let cx = Math.floor((x - NEAR_R) / SMALL) * SMALL; cx < x + NEAR_R; cx += SMALL) for (let cz = Math.floor((z - NEAR_R) / SMALL) * SMALL; cz < z + NEAR_R; cz += SMALL) {
      const d = Math.hypot(Math.max(cx - x, 0, x - cx - SMALL), Math.max(cz - z, 0, z - cz - SMALL));
      if (d < NEAR_R) want.add(`S:${cx},${cz}`);
    }
    for (const k of want) if (!this.cells.has(k)) {
      const [kind, rest] = k.split(':'), [cx, cz] = rest.split(',').map(Number), size = kind === 'B' ? BIG : SMALL;
      this.cells.set(k, { state: 'queued', rect: [cx, cz, cx + size, cz + size], near: kind === 'S', d: Math.hypot(cx + size / 2 - x, cz + size / 2 - z) });
    }
    for (const [k, c] of this.cells) if (!want.has(k) && c.state !== 'pending') { this.cells.delete(k); this.dirty = true; }
    for (const c of this.cells.values()) c.d = Math.hypot((c.rect[0] + c.rect[2]) / 2 - x, (c.rect[1] + c.rect[3]) / 2 - z);
    this.queue = [...this.cells.entries()].filter(([, c]) => c.state === 'queued').sort((a, b) => a[1].d - b[1].d).map(([k]) => k);
    this.pump();
    const moved = !this.last || Math.hypot(x - this.last[0], z - this.last[1]) > 12;
    if (this.dirty || moved) { this.rebuild(x, z); this.last = [x, z]; this.dirty = false; }
    return this.queue.length + [...this.cells.values()].filter((c) => c.state === 'pending').length;
  }

  /** Resolve when the plants within `near` metres are placed; farther ones follow. onProgress(0…1). */
  async ready(x, z, onProgress, near = 260) {
    let total = 0;
    for (;;) {
      this.update(x, z);
      let left = 0;
      for (const c of this.cells.values()) if (c.state !== 'done' && c.d < near) left++;
      total = Math.max(total, left);
      onProgress?.(total ? 1 - left / total : 1);
      if (!left && this.species) { this.rebuild(x, z); return; }
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  pump() {
    if (!this.species) return;
    for (const w of this.workers) {
      if (!w.idle || !this.queue.length) continue;
      const k = this.queue.shift(), c = this.cells.get(k);
      if (!c) continue;
      c.state = 'pending'; w.idle = false;
      w.postMessage({ id: k, rect: c.rect, near: c.near });
    }
  }

  /** Sort every plant into its species, variant and level of detail, and fill the instanced meshes. */
  rebuild(x, z) {
    if (!this.species) return;
    const buckets = new Map();
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    for (const c of this.cells.values()) {
      if (c.state !== 'done') continue;
      const d = c.data;
      for (let i = 0; i < d.length; i += 8) {
        const sp = this.species[d[i]], S = SPECIES[sp];
        const dist = Math.hypot(d[i + 2] - x, d[i + 4] - z);
        const lod = dist < S.lod[0] * this.scale ? 0 : dist < S.lod[1] * this.scale ? 1 : -1;
        if (lod < 0) continue;
        const key = `${sp}/${d[i + 1] % VARIANTS}/${lod}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(i, c);
      }
    }
    // hide what is no longer used
    for (const [key, b] of this.batches) if (!buckets.has(key)) { for (const mesh of b.meshes) mesh.count = 0; }
    for (const [key, list] of buckets) {
      const [sp, v, lod] = key.split('/');
      const n = list.length / 2;
      const b = this.batch(sp, +v, +lod, n);
      let k = 0;
      for (let j = 0; j < list.length; j += 2) {
        const i = list[j], d = list[j + 1].data, S = SPECIES[sp];
        const sc = S.scale[0] + (S.scale[1] - S.scale[0]) * d[i + 6];
        p.set(d[i + 2], d[i + 3], d[i + 4]); q.setFromAxisAngle(up, d[i + 5]); s.setScalar(sc);
        m.compose(p, q, s);
        col.setRGB(0.88 + 0.24 * d[i + 7], 0.9 + 0.2 * d[i + 7], 0.86 + 0.2 * ((d[i + 7] * 7) % 1));
        for (const mesh of b.meshes) { mesh.setMatrixAt(k, m); if (mesh.instanceColor || mesh.userData.tinted) mesh.setColorAt(k, col); }
        k++;
      }
      for (const mesh of b.meshes) {
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere?.();
      }
    }
  }

  batch(sp, v, lod, n) {
    const key = `${sp}/${v}/${lod}`;
    let b = this.batches.get(key);
    if (b && b.cap >= n) return b;
    if (b) for (const mesh of b.meshes) { this.group.remove(mesh); mesh.dispose(); }
    const S = SPECIES[sp], geo = speciesGeometry(sp, v, lod), cap = Math.max(1100, Math.ceil(n * 1.5));   // above the uniform-buffer limit: matrices go in an instanced attribute, so every batch shares one shader
    const meshes = [];
    const sway = NEAR_ONLY.has(sp) ? 0.05 : sp.includes('palm') ? 0.12 : 0.08;
    if (geo.trunk) {
      const mt = S.bark === 'rock_boulder' ? paletteMaterial('rock_boulder') : solidMaterial(S.bark, sway * 0.3);
      const mesh = new THREE.InstancedMesh(geo.trunk, mt, cap);
      meshes.push(mesh);
    }
    if (geo.leaves) {
      const mt = geo.solidLeaves ? solidMaterial(S.leafMat, sway) : foliageMaterial(S.foliage, sway);
      const mesh = new THREE.InstancedMesh(geo.leaves, mt, cap);
      mesh.userData.tinted = true;
      mesh.setColorAt(0, new THREE.Color(1, 1, 1));
      meshes.push(mesh);
    }
    for (const mesh of meshes) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.castShadow = S.shadow && lod === 0;
      mesh.receiveShadow = true;
      mesh.name = `flora:${key}`;
      this.group.add(mesh);
    }
    b = { meshes, cap };
    this.batches.set(key, b);
    return b;
  }
}

export { MAX_DENSITY };
