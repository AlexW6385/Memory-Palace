// Terrain in the viewer: the world as tiles of 512 m; near tiles split into four chunks of
// 256 m whose resolution follows the distance to the viewer (2, 4 or 8 m); far tiles at 16 or
// 32 m. Chunks are built in workers and swapped in when ready.

import * as THREE from 'three/webgpu';
import { WORLD, riverCenter } from '../world/regions.js';
import { material } from './materials.js';

const TILE = 512, SUB = 256;

function stepFor(d) { return d < 230 ? 2 : d < 520 ? 4 : d < 900 ? 8 : d < 1700 ? 16 : 32; }

export class Terrain {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'terrain';
    scene.add(this.group);
    this.mat = material('terrain');
    this.chunks = new Map();       // key → { mesh, step, wanted }
    this.pending = new Map();      // request id → { key, step }
    this.queue = [];
    this.busy = 0;
    this.nextId = 1;
    const [X0, Z0, X1, Z1] = WORLD.bounds, F = WORLD.far;
    this.extent = [Math.floor((X0 - F) / TILE) * TILE, Math.floor((Z0 - F) / TILE) * TILE, Math.ceil((X1 + F) / TILE) * TILE, Math.ceil((Z1 + F) / TILE) * TILE];
    const n = Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));
    this.workers = Array.from({ length: n }, () => {
      const w = new Worker(new URL('./terrain-worker.js', import.meta.url), { type: 'module' });
      w.onmessage = (e) => this.receive(w, e.data);
      w.idle = true;
      return w;
    });
    this.addWater();
  }

  /** The chunks (rect, step) wanted for a viewer at (x, z). */
  layout(x, z) {
    const want = [];
    const [ex0, ez0, ex1, ez1] = this.extent;
    const dist = (r) => Math.hypot(Math.max(r[0] - x, 0, x - r[2]), Math.max(r[1] - z, 0, z - r[3]));
    for (let tx = ex0; tx < ex1; tx += TILE) for (let tz = ez0; tz < ez1; tz += TILE) {
      const r = [tx, tz, tx + TILE, tz + TILE];
      const d = dist(r);
      if (d < 760) {
        for (let sx = 0; sx < 2; sx++) for (let sz = 0; sz < 2; sz++) {
          const q = [tx + sx * SUB, tz + sz * SUB, tx + (sx + 1) * SUB, tz + (sz + 1) * SUB];
          want.push({ key: q.join(','), rect: q, step: Math.min(8, stepFor(dist(q))), d: dist(q) });
        }
      } else want.push({ key: r.join(','), rect: r, step: Math.max(16, stepFor(d)), d });
    }
    return want;
  }

  /** Bring the terrain up to date for a viewer at (x, z). Returns a promise for when it is complete. */
  update(x, z) {
    const want = this.layout(x, z);
    const keys = new Set(want.map((w) => w.key));
    this.wanted = keys;
    this.queue = want.filter((w) => { const c = this.chunks.get(w.key); return !c || c.step !== w.step; })
      .filter((w) => ![...this.pending.values()].some((p) => p.key === w.key && p.step === w.step))
      .sort((a, b) => a.d - b.d);
    this.pump();
    // drop chunks no longer in the layout, but only once their replacements cover the ground
    if (!this.queue.length && !this.pending.size) {
      for (const [k, c] of this.chunks) if (!keys.has(k)) { this.group.remove(c.mesh); c.mesh.geometry.dispose(); this.chunks.delete(k); }
    }
    return this.queue.length + this.pending.size;
  }

  /**
   * Resolve when the chunks within `near` metres are built (initial load, teleports); the rest
   * keeps streaming in afterwards. onProgress(0…1).
   */
  async ready(x, z, onProgress, near = 420) {
    let total = 0;
    for (;;) {
      this.update(x, z);
      const left = this.queue.filter((q) => q.d < near).length + [...this.pending.values()].filter((p) => p.d < near).length;
      total = Math.max(total, left);
      onProgress?.(total ? 1 - left / total : 1);
      if (!left) return;
      await new Promise((r) => setTimeout(r, 40));
    }
  }

  pump() {
    for (const w of this.workers) {
      if (!w.idle || !this.queue.length) continue;
      const job = this.queue.shift();
      const id = this.nextId++;
      this.pending.set(id, { key: job.key, step: job.step, rect: job.rect, d: job.d });
      w.idle = false;
      w.postMessage({ id, rect: job.rect, step: job.step });
    }
  }

  receive(w, data) {
    w.idle = true;
    const p = this.pending.get(data.id);
    this.pending.delete(data.id);
    if (p && (!this.wanted || this.wanted.has(p.key))) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(data.position, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(data.normal, 3));
      g.setAttribute('ground', new THREE.BufferAttribute(data.ground, 4));
      g.setAttribute('ground2', new THREE.BufferAttribute(data.ground2, 4));
      g.setAttribute('road', new THREE.BufferAttribute(data.road, 1));
      g.setIndex(new THREE.BufferAttribute(data.index, 1));
      g.computeBoundingBox(); g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, this.mat);
      mesh.receiveShadow = true;
      mesh.castShadow = p.step <= 8;
      mesh.name = 'terrain:' + p.key;
      const old = this.chunks.get(p.key);
      this.group.add(mesh);
      if (old) { this.group.remove(old.mesh); old.mesh.geometry.dispose(); }
      // a near tile replaces its far parent (and the reverse): remove overlapping chunks of the other kind
      for (const [k, c] of this.chunks) {
        if (k === p.key) continue;
        const r = c.rect, q = p.rect;
        const overlap = r[0] < q[2] && q[0] < r[2] && r[1] < q[3] && q[1] < r[3];
        if (overlap && (r[2] - r[0]) !== (q[2] - q[0])) {
          // keep a big tile until all four of its children exist
          if (r[2] - r[0] > q[2] - q[0]) {
            const kids = [0, 1].flatMap((sx) => [0, 1].map((sz) => [r[0] + sx * SUB, r[1] + sz * SUB, r[0] + (sx + 1) * SUB, r[1] + (sz + 1) * SUB].join(',')));
            if (!kids.every((kk) => kk === p.key || this.chunks.has(kk))) continue;
          }
          this.group.remove(c.mesh); c.mesh.geometry.dispose(); this.chunks.delete(k);
        }
      }
      this.chunks.set(p.key, { mesh, step: p.step, rect: p.rect });
    }
    this.pump();
  }

  /** The river: a ribbon of water following its meander from one end of the world to the other. */
  addWater() {
    const R = WORLD.river, [, Z0, , Z1] = this.extent;
    const pos = [];
    const half = R.width / 2 + R.bank * 0.6;
    for (let z = Z0; z < Z1; z += 20) {
      const a = riverCenter(z), b = riverCenter(z + 20);
      pos.push(a - half, R.water, z, a + half, R.water, z, b + half, R.water, z + 20);
      pos.push(a - half, R.water, z, b + half, R.water, z + 20, b - half, R.water, z + 20);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, material('river'));
    m.receiveShadow = true;
    m.name = 'river';
    this.scene.add(m);
  }
}
