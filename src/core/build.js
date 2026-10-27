// Turns a building plan (pure data, metres) into geometry grouped by material, lights,
// and a collision description. Shared by the viewer, the light baker and the plan checker.
//
// Plan coordinates are local to the building: +x east, +y up, +z south. The plan's
// `origin` [x, z] places it in the world; `yaw` (multiple of 90°) turns it.

import { Matrix4 } from 'three';
import { GeoBag, box, frustum, fromTriangles, quad, lathe } from './geom.js';

export const STYLES = {};
export function registerStyle(name, style) { STYLES[name] = style; }

/** Collision sink: floors (walkable surfaces) and obstacles, in building-local coordinates. */
export class Colliders {
  constructor() { this.floors = []; this.obstacles = []; }
  /** Walkable horizontal rectangle at height y. */
  floor(rect, y, tag) { this.floors.push({ rect: norm(rect), y, tag }); }
  /** Walkable ramp/stair: height goes from y0 to y1 along dir ('n','s','e','w' = direction of ascent). */
  ramp(rect, y0, y1, dir) { this.floors.push({ rect: norm(rect), y: y0, y1, dir }); }
  /** Solid oriented box in plan: centre line a→b, thickness th, vertical extent y0..y1. */
  segment(a, b, th, y0, y1) {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    const nx = -dz / L * th / 2, nz = dx / L * th / 2;
    this.obstacles.push({ poly: [[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]], y0, y1 });
  }
  rect(rect, y0, y1) {
    const [x0, z0, x1, z1] = norm(rect);
    this.obstacles.push({ poly: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y0, y1 });
  }
  circle(x, z, r, y0, y1) { this.obstacles.push({ circle: [x, z, r], y0, y1 }); }
}

function norm([x0, z0, x1, z1]) { return [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]; }

/**
 * Build a plan. Returns { parts: [{mat, geometry}], lights, colliders, matrix }.
 * Geometry is in world coordinates (the placement is applied); colliders too.
 */
export function buildPlan(plan) {
  const style = STYLES[plan.style];
  if (!style) throw new Error(`style ${plan.style} not registered`);
  const bag = new GeoBag();
  const col = new Colliders();
  const lights = [];
  const ctx = { bag, col, lights, style, plan };
  for (const el of plan.elements) {
    const fn = GENERIC[el.t] || style.elements?.[el.t];
    if (!fn) throw new Error(`${plan.id}: no builder for element type ${el.t}`);
    fn(el, ctx);
  }
  const m = placement(plan);
  const parts = bag.merged();
  for (const p of parts) { p.geometry.applyMatrix4(m); p.geometry.computeBoundingBox(); p.geometry.computeBoundingSphere(); }
  const colliders = transformColliders(col, plan);
  for (const l of lights) l.at = toWorld(plan, l.at[0], l.at[2], l.at[1]);
  return { parts, lights, colliders, matrix: m };
}

export function placement(plan) {
  const [ox, oz] = plan.origin || [0, 0];
  return new Matrix4().makeRotationY(-(plan.yaw || 0) * Math.PI / 180).setPosition(ox, plan.base || 0, oz);
}

/** Local plan point → world [x, y, z]. */
export function toWorld(plan, x, z, y = 0) {
  const [ox, oz] = plan.origin || [0, 0];
  const a = -(plan.yaw || 0) * Math.PI / 180;
  const c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
  return [ox + c * x + s * z, (plan.base || 0) + y, oz - s * x + c * z];
}

function transformColliders(col, plan) {
  const P = (x, z) => { const w = toWorld(plan, x, z); return [w[0], w[2]]; };
  const by = plan.base || 0;
  const yawDir = { n: 0, e: 90, s: 180, w: 270 };
  const dirs = ['n', 'e', 's', 'w'];
  const out = { floors: [], obstacles: [] };
  for (const f of col.floors) {
    const a = P(f.rect[0], f.rect[1]), b = P(f.rect[2], f.rect[3]);
    const g = { rect: norm([a[0], a[1], b[0], b[1]]), y: f.y + by, tag: f.tag };
    if (f.y1 !== undefined) {
      g.y1 = f.y1 + by;
      g.dir = dirs[((yawDir[f.dir] + (plan.yaw || 0)) / 90 % 4 + 4) % 4];
    }
    out.floors.push(g);
  }
  for (const o of col.obstacles) {
    if (o.circle) { const c = P(o.circle[0], o.circle[1]); out.obstacles.push({ circle: [c[0], c[1], o.circle[2]], y0: o.y0 + by, y1: o.y1 + by }); }
    else out.obstacles.push({ poly: o.poly.map(([x, z]) => P(x, z)), y0: o.y0 + by, y1: o.y1 + by });
  }
  return out;
}

// ── generic elements ──────────────────────────────────────────────────────────

const GENERIC = {
  /** Paved floor: a slab whose top is the walking surface. */
  floor(el, { bag, col }) {
    const th = el.th ?? 0.4;
    const [x0, z0, x1, z1] = norm(el.rect);
    bag.add(el.mat || 'sandstone_floor', frustum([x0, z0, x1, z1], el.y - th, el.y, 0, 0, 0, 0, { noBottom: true }));
    if (el.walk !== false) col.floor(el.rect, el.y, el.room);
  },

  /** Roof or ceiling slab, optionally pierced by light openings. */
  slab(el, { bag, col }) {
    const holes = el.holes || [];
    for (const r of subtractRects(norm(el.rect), holes.map(norm))) bag.add(el.mat || 'sandstone', box(r[0], el.y0, r[1], r[2], el.y1, r[3]));
    if (el.walk) col.floor(el.rect, el.y1);
  },

  /** A solid mass, optionally battered (insets at the top per face: [-x, +x, -z, +z]). */
  block(el, ctx) {
    const [x0, z0, x1, z1] = norm(el.rect);
    const b = el.batter || [0, 0, 0, 0];
    ctx.bag.add(el.mat || 'sandstone', frustum([x0, z0, x1, z1], el.y0, el.y1, b[0], b[1], b[2], b[3], { noBottom: el.y0 <= 0 }));
    if (el.collide !== false) ctx.col.rect(el.rect, el.y0, el.y1);
    if (el.walk) ctx.col.floor([x0 + b[0], z0 + b[2], x1 - b[1], z1 - b[3]], el.y1);
    if (el.trim && ctx.style.trim) ctx.style.trim(el, ctx);
  },

  /**
   * Straight wall on the centre line a→b with openings. Each opening: { at (distance from a
   * to its centre), w, h, y0 (sill, default el.y0), lintel (extra decoration) }.
   */
  wall(el, ctx) {
    const { bag, col } = ctx;
    const [ax, az] = el.a, [bx, bz] = el.b;
    const L = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / L, uz = (bz - az) / L;
    const th = el.th, mat = el.mat || 'sandstone';
    const ops = (el.openings || []).map((o) => ({ ...o, s0: o.at - o.w / 2, s1: o.at + o.w / 2, y0: o.y0 ?? el.y0 }))
      .sort((p, q) => p.s0 - q.s0);
    const piece = (s0, s1, y0, y1) => {
      if (s1 - s0 < 1e-3 || y1 - y0 < 1e-3) return;
      const p0 = [ax + ux * s0, az + uz * s0], p1 = [ax + ux * s1, az + uz * s1];
      bag.add(mat, orientedBox(p0, p1, th, y0, y1));
      col.segment(p0, p1, th, y0, y1);
    };
    let s = 0;
    for (const o of ops) {
      piece(s, o.s0, el.y0, el.y1);
      if (o.y0 > el.y0) piece(o.s0, o.s1, el.y0, o.y0);           // sill (window)
      piece(o.s0, o.s1, o.y0 + o.h, el.y1);                        // lintel course above
      s = o.s1;
      if (ctx.style.opening) ctx.style.opening(el, o, { ux, uz, ax, az }, ctx);
    }
    piece(s, L, el.y0, el.y1);
    if (el.trim && ctx.style.trim) ctx.style.trim(el, ctx);
  },

  /** Only the style's trim (torus, cornice) around a mass built from other elements. */
  trim(el, ctx) {
    if (ctx.style.trim) ctx.style.trim({ ...el, t: 'block' }, ctx);
  },

  /** Architrave or beam of rectangular section, bottom at y. */
  beam(el, { bag, col }) {
    bag.add(el.mat || 'sandstone', orientedBox(el.a, el.b, el.w, el.y, el.y + el.h, el.ext ?? 0));
    col.segment(el.a, el.b, el.w, el.y, el.y + el.h);     // overhead: blocks nothing, but supports what stands on it
  },

  /** Straight flight of steps rising from y0 to y1 in direction dir across rect. */
  stair(el, { bag, col }) {
    const [x0, z0, x1, z1] = norm(el.rect);
    const rise = el.y1 - el.y0;
    const n = Math.max(1, Math.round(Math.abs(rise) / (el.riser || 0.17)));
    const mat = el.mat || 'sandstone_floor';
    for (let i = 0; i < n; i++) {
      const f0 = i / n, f1 = (i + 1) / n, yTop = el.y0 + rise * f1;
      let r;
      if (el.dir === 'n') r = [x0, z1 - (z1 - z0) * f1, x1, z1 - (z1 - z0) * f0];
      else if (el.dir === 's') r = [x0, z0 + (z1 - z0) * f0, x1, z0 + (z1 - z0) * f1];
      else if (el.dir === 'e') r = [x0 + (x1 - x0) * f0, z0, x0 + (x1 - x0) * f1, z1];
      else r = [x1 - (x1 - x0) * f1, z0, x1 - (x1 - x0) * f0, z1];
      // each step extends forward under the next so there are no gaps
      let full;
      if (el.dir === 'n') full = [r[0], z0, r[2], r[3]];
      else if (el.dir === 's') full = [r[0], r[1], r[2], z1];
      else if (el.dir === 'e') full = [r[0], r[1], x1, r[3]];
      else full = [x0, r[1], r[2], r[3]];
      bag.add(mat, box(full[0], (el.base ?? el.y0) - 0.01, full[1], full[2], yTop, full[3]));
    }
    col.ramp(el.rect, el.y0, el.y1, el.dir);
  },

  /** Still water surface (a basin's walls are built separately). */
  water(el, { bag }) {
    const [x0, z0, x1, z1] = norm(el.rect);
    const out = [];
    quad(out, [x0, el.y, z0], [x0, el.y, z1], [x1, el.y, z1], [x1, el.y, z0]);
    bag.add('water', fromTriangles(out));
  },

  /** A point light (lamp, brazier). at = [x, y, z] local. */
  lamp(el, { lights, bag, col }) {
    lights.push({ at: el.at, color: el.color || '#ffb46b', intensity: el.intensity ?? 6, distance: el.distance ?? 9 });
    if (el.stand !== undefined) {
      const [x, y, z] = el.at;
      bag.add('bronze', lathe([[0.22, 0], [0.2, 0.04], [0.05, 0.12], [0.035, 0.3], [0.035, y - el.stand - 0.2], [0.07, y - el.stand - 0.16], [0.16, y - el.stand - 0.08], [0.14, y - el.stand - 0.06]], 12, null, x, el.stand, z));
      col.circle(x, z, 0.2, el.stand, y);
    }
  },

  /** Free-standing object from the style's catalogue. */
  obj(el, ctx) {
    const fn = ctx.style.objects?.[el.kind];
    if (!fn) throw new Error(`${ctx.plan.id}: style ${ctx.plan.style} has no object ${el.kind}`);
    fn(el, ctx);
  },

  /** Column with a style capital. */
  column(el, ctx) {
    ctx.style.column(el, ctx);
  },
};

/** Box along a line in plan with thickness th (perpendicular), from y0 to y1; ext extends the ends. */
export function orientedBox(a, b, th, y0, y1, ext = 0) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
  const g = box(-L / 2 - ext, y0, -th / 2, L / 2 + ext, y1, th / 2);
  const m = new Matrix4().makeRotationY(-Math.atan2(dz, dx));
  m.setPosition((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2);
  g.applyMatrix4(m);
  return g;
}

/** Split rect minus holes into a set of covering rectangles (simple grid decomposition). */
export function subtractRects(r, holes) {
  if (!holes.length) return [r];
  const xs = new Set([r[0], r[2]]), zs = new Set([r[1], r[3]]);
  for (const h of holes) { xs.add(Math.max(r[0], Math.min(r[2], h[0]))); xs.add(Math.max(r[0], Math.min(r[2], h[2]))); zs.add(Math.max(r[1], Math.min(r[3], h[1]))); zs.add(Math.max(r[1], Math.min(r[3], h[3]))); }
  const X = [...xs].sort((a, b) => a - b), Z = [...zs].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < X.length - 1; i++) {
    for (let j = 0; j < Z.length - 1; j++) {
      const cx = (X[i] + X[i + 1]) / 2, cz = (Z[j] + Z[j + 1]) / 2;
      if (X[i + 1] - X[i] < 1e-4 || Z[j + 1] - Z[j] < 1e-4) continue;
      if (holes.some((h) => cx > h[0] && cx < h[2] && cz > h[1] && cz < h[3])) continue;
      out.push([X[i], Z[j], X[i + 1], Z[j + 1]]);
    }
  }
  // merge cells along z within each column to keep triangle counts down
  const merged = [];
  out.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  for (const c of out) {
    const last = merged[merged.length - 1];
    if (last && last[0] === c[0] && last[2] === c[2] && Math.abs(last[3] - c[1]) < 1e-6) last[3] = c[3];
    else merged.push([...c]);
  }
  return merged;
}
