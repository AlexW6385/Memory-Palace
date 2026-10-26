// The world: open ground, the river, and the buildings, loaded on demand by distance.
// Layout and reasoning: docs/world.md.

import * as THREE from 'three/webgpu';
import { BUILDINGS } from '../buildings/index.js';
import { buildPlan, toWorld } from '../core/build.js';
import { CollisionWorld } from '../core/collide.js';
import { GeoBag, frustum, fromTriangles, quad } from '../core/geom.js';
import { material, flameMaterial } from './materials.js';

/** World extent and the Nile (docs/world.md). */
export const WORLD = {
  bounds: [-1200, -1200, 1200, 1200],
  river: { x0: 190, x1: 520, bank: 22, depth: 3.2, water: -2.3 },
  loadDistance: 700,
};

export class World {
  constructor(renderer) {
    this.r = renderer;
    this.scene = renderer.scene;
    this.collide = new CollisionWorld();
    this.buildings = new Map();       // id → { plan, music, meshes, built }
  }

  async init(progress = () => {}) {
    this.addLand();
    let i = 0;
    for (const b of BUILDINGS) {
      progress(i++ / BUILDINGS.length);
      await this.loadBuilding(b);
    }
    progress(1);
  }

  addLand() {
    const { bounds: [X0, Z0, X1, Z1], river: R } = WORLD;
    const bag = new GeoBag();
    const t = [];
    const g = -0.02;
    // west and east land, the banks sloping down to the river bed
    quad(t, [X0, g, Z0], [X0, g, Z1], [R.x0, g, Z1], [R.x0, g, Z0]);
    quad(t, [R.x1, g, Z0], [R.x1, g, Z1], [X1, g, Z1], [X1, g, Z0]);
    bag.add('ground', fromTriangles(t));
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

  async loadBuilding(entry) {
    if (this.buildings.has(entry.id)) return this.buildings.get(entry.id);
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
    const here = this.locate(pos.x, pos.y, pos.z);
    if (here.building?.gi) this.r.gi.use(here.building.gi);
    return here;
  }
}

export { GeoBag, frustum };
