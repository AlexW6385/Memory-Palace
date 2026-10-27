// The world: open ground, the river, and the buildings, loaded on demand by distance.
// Layout and reasoning: docs/world.md.

import * as THREE from 'three/webgpu';
import { BUILDINGS } from '../buildings/index.js';
import { buildPlan, toWorld, subtractRects } from '../core/build.js';
import { terrainPatch } from '../core/terrain-mesh.js';
import { WORLD, LANDFORMS, terrainHeight, landformRect } from '../world/layout.js';
import { CollisionWorld } from '../core/collide.js';
import { GeoBag, frustum, fromTriangles, quad } from '../core/geom.js';
import { material, flameMaterial } from './materials.js';

export { WORLD };

/** Buildings closer than this (m, to their bounds) are built and lit. */
export const LOAD_RADIUS = 650;

export class World {
  constructor(renderer) {
    this.r = renderer;
    this.scene = renderer.scene;
    this.collide = new CollisionWorld();
    this.collide.terrain = terrainHeight;
    this.plans = new Map();           // id → { id, entry, plan, music }: every building, small
    this.buildings = new Map();       // id → { plan, music, group, built, gi }: those built so far
    this.loading = new Map();
  }

  /** Load every building's plan (small modules); geometry and light are built on demand. */
  async init() {
    this.addLand();
    await Promise.all(BUILDINGS.map(async (entry) => {
      const mod = await entry.load();
      this.plans.set(entry.id, { id: entry.id, entry, plan: mod.plan, music: mod.music });
    }));
  }

  /** Distance from (x, z) to a plan's bounds. */
  static distance(plan, x, z) {
    const [x0, z0, x1, z1] = World.worldBounds(plan);
    return Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
  }

  /** Build every building within `radius` of (x, z); resolves when they are in the scene. */
  async ensureNear(x, z, radius = LOAD_RADIUS) {
    const wanted = [...this.plans.values()].filter((p) => World.distance(p.plan, x, z) < radius);
    await Promise.all(wanted.map((p) => this.loadBuilding(p.entry)));
  }

  addLand() {
    const { bounds: [X0, Z0, X1, Z1], river: R } = WORLD;
    const bag = new GeoBag();
    const g = -0.02;
    // open ground: a coarse plane around the landforms (which get fine patches) and the river
    const holes = LANDFORMS.map(landformRect);
    for (const side of [[X0, Z0, R.x0, Z1], [R.x1, Z0, X1, Z1]]) {
      for (const r of subtractRects(side, holes)) {
        const t = [];
        quad(t, [r[0], g, r[1]], [r[0], g, r[3]], [r[2], g, r[3]], [r[2], g, r[1]]);
        bag.add('ground', fromTriangles(t));
      }
    }
    // the plain continues to the horizon beyond the walkable world
    const F = 9000;
    for (const r of [[-F, -F, F, Z0], [-F, Z1, F, F], [-F, Z0, X0, Z1], [X1, Z0, F, Z1]]) {
      const t = [];
      quad(t, [r[0], g - 0.05, r[1]], [r[0], g - 0.05, r[3]], [r[2], g - 0.05, r[3]], [r[2], g - 0.05, r[1]]);
      bag.add('ground', fromTriangles(t));
    }
    for (const L of LANDFORMS) bag.add('terrain', terrainPatch(landformRect(L), 2.5, (x, z) => terrainHeight(x, z) + g));
    const b = [];
    quad(b, [R.x0, g, Z0], [R.x0, g, Z1], [R.x0 + R.bank, -R.depth, Z1], [R.x0 + R.bank, -R.depth, Z0]);
    quad(b, [R.x0 + R.bank, -R.depth, Z0], [R.x0 + R.bank, -R.depth, Z1], [R.x1 - R.bank, -R.depth, Z1], [R.x1 - R.bank, -R.depth, Z0]);
    quad(b, [R.x1 - R.bank, -R.depth, Z0], [R.x1 - R.bank, -R.depth, Z1], [R.x1, g, Z1], [R.x1, g, Z0]);
    bag.add('silt', fromTriangles(b));
    const w = [];
    quad(w, [R.x0, R.water, Z0], [R.x0, R.water, Z1], [R.x1, R.water, Z1], [R.x1, R.water, Z0]);
    bag.add('water', fromTriangles(w));
    for (const { mat, geometry } of bag.merged()) {
      const m = new THREE.Mesh(geometry, material(mat));
      m.receiveShadow = true;
      m.castShadow = mat === 'terrain';
      this.scene.add(m);
    }
    // keep walkers on land: the river banks and the edge of the world
    const edge = 2;
    this.collide.add({
      floors: [],
      obstacles: [
        { poly: [[R.x0 + 1, Z0], [R.x1 - 1, Z0], [R.x1 - 1, Z1], [R.x0 + 1, Z1]], y0: -10, y1: 50 },
        { poly: [[X0 - edge, Z0], [X0, Z0], [X0, Z1], [X0 - edge, Z1]], y0: -10, y1: 50 },
        { poly: [[X1, Z0], [X1 + edge, Z0], [X1 + edge, Z1], [X1, Z1]], y0: -10, y1: 50 },
        { poly: [[X0, Z0 - edge], [X1, Z0 - edge], [X1, Z0], [X0, Z0]], y0: -10, y1: 50 },
        { poly: [[X0, Z1], [X1, Z1], [X1, Z1 + edge], [X0, Z1 + edge]], y0: -10, y1: 50 },
      ],
    });
  }

  loadBuilding(entry) {
    if (this.buildings.has(entry.id)) return Promise.resolve(this.buildings.get(entry.id));
    if (!this.loading.has(entry.id)) this.loading.set(entry.id, this._load(entry));
    return this.loading.get(entry.id);
  }

  async _load(entry) {
    const mod = await entry.load();
    const plan = mod.plan;
    const built = buildPlan(plan);
    const group = new THREE.Group();
    group.name = plan.id;
    for (const { mat, geometry } of built.parts) {
      const m = new THREE.Mesh(geometry, material(mat));
      m.castShadow = mat !== 'water';
      m.receiveShadow = true;
      m.name = `${plan.id}:${mat}`;
      group.add(m);
    }
    // oil lamp flames (their light is baked into the irradiance volume)
    if (built.lights.length) {
      const flame = new THREE.ConeGeometry(0.035, 0.13, 8);
      const inst = new THREE.InstancedMesh(flame, flameMaterial(), built.lights.length);
      const m4 = new THREE.Matrix4();
      built.lights.forEach((l, i) => inst.setMatrixAt(i, m4.makeTranslation(l.at[0], l.at[1] + 0.02, l.at[2])));
      group.add(inst);
    }
    this.scene.add(group);
    this.collide.add(built.colliders);
    const rec = { id: plan.id, plan, music: mod.music, group, built };
    this.buildings.set(plan.id, rec);
    // baked light for this building, if it has been baked
    try { rec.gi = await this.r.gi.fetch(plan.id, `data/gi/${plan.id}.gi`); } catch (e) { console.warn(e); }
    return rec;
  }

  /** Bounds of a building in world coordinates [x0, z0, x1, z1]. */
  static worldBounds(plan) {
    const a = toWorld(plan, plan.bounds[0], plan.bounds[1]), b = toWorld(plan, plan.bounds[2], plan.bounds[3]);
    return [Math.min(a[0], b[0]), Math.min(a[2], b[2]), Math.max(a[0], b[0]), Math.max(a[2], b[2])];
  }

  /** The building nearest to (x, z) and the room the point is in, if any. */
  locate(x, y, z) {
    let best = null, bd = Infinity;
    for (const rec of this.buildings.values()) {
      const [x0, z0, x1, z1] = World.worldBounds(rec.plan);
      const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1);
      const d = Math.hypot(dx, dz);
      if (d < bd) { bd = d; best = rec; }
    }
    if (!best) return { building: null, room: null, distance: Infinity };
    let room = null;
    for (const r of best.plan.rooms) {
      const a = toWorld(best.plan, r.rect[0], r.rect[1]), b = toWorld(best.plan, r.rect[2], r.rect[3]);
      if (x >= Math.min(a[0], b[0]) - 0.6 && x <= Math.max(a[0], b[0]) + 0.6 && z >= Math.min(a[2], b[2]) - 0.6 && z <= Math.max(a[2], b[2]) + 0.6 && Math.abs(y - (r.y + (best.plan.base || 0))) < 3) { room = r; break; }
    }
    return { building: best, room, distance: bd };
  }

  /** World-space entrance of a building: [x, y, z, yaw]. */
  entrance(plan) {
    const e = plan.entrance;
    const p = toWorld(plan, e.at[0], e.at[1], e.y || 0);
    const yaws = { n: 0, w: Math.PI / 2, s: Math.PI, e: -Math.PI / 2 };
    return [p[0], p[1], p[2], (yaws[e.facing] ?? 0) - (plan.yaw || 0) * Math.PI / 180];
  }

  update(pos) {
    // build what is coming into range, a little at a time
    const now = performance.now();
    if (!this._next || now > this._next) { this._next = now + 1000; this.ensureNear(pos.x, pos.z); }
    const here = this.locate(pos.x, pos.y, pos.z);
    if (here.building?.gi) this.r.gi.use(here.building.gi);
    return here;
  }
}

export { GeoBag, frustum };
