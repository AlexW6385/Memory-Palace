#!/usr/bin/env node
// Plan check: walkability, every room reachable from the entrance, every doorway connects,
// no floating obstacles, no columns or objects driven into walls.
//
// usage: node tools/plan-check.mjs [building-id ...]     (default: all buildings)

import { BUILDINGS } from '../src/buildings/index.js';
import { buildPlan, toWorld } from '../src/core/build.js';
import { CollisionWorld } from '../src/core/collide.js';
import { terrainHeight } from '../src/world/layout.js';

const R = 0.3, STEP = 0.5, HEAD = 1.7, LOW = 0.25, CELL = 0.25;
const ids = process.argv.slice(2);
let failed = 0;

for (const b of BUILDINGS) {
  if (ids.length && !ids.includes(b.id)) continue;
  const { plan } = await b.load();
  const built = buildPlan(plan);
  const cw = new CollisionWorld();
  cw.terrain = terrainHeight;
  cw.add(built.colliders);
  const problems = [];

  // ── reachability flood fill over a grid of the plan bounds ──
  const [bx0, bz0, bx1, bz1] = plan.bounds;
  const a = toWorld(plan, bx0, bz0), c = toWorld(plan, bx1, bz1);
  const X0 = Math.min(a[0], c[0]), Z0 = Math.min(a[2], c[2]), X1 = Math.max(a[0], c[0]), Z1 = Math.max(a[2], c[2]);
  const nx = Math.ceil((X1 - X0) / CELL), nz = Math.ceil((Z1 - Z0) / CELL);
  const ground = new Float32Array(nx * nz).fill(NaN);
  const seen = new Uint8Array(nx * nz);
  const idx = (i, j) => j * nx + i;
  const cx = (i) => X0 + (i + 0.5) * CELL, cz = (j) => Z0 + (j + 0.5) * CELL;
  const e = plan.entrance.at, ew = toWorld(plan, e[0], e[1]);
  let si = Math.floor((ew[0] - X0) / CELL), sj = Math.floor((ew[2] - Z0) / CELL);
  const stack = [];
  const visit = (i, j, fromY) => {
    if (i < 0 || j < 0 || i >= nx || j >= nz) return;
    const k = idx(i, j);
    if (seen[k]) return;
    const x = cx(i), z = cz(j);
    const g = cw.groundAt(x, z, fromY + STEP);
    if (!Number.isFinite(g) || g < fromY - 2.0) return;           // no falling off cliffs
    if (cw.blockedAt(x, z, R, g + LOW, g + HEAD)) return;
    seen[k] = 1; ground[k] = g;
    stack.push([i, j, g]);
  };
  visit(si, sj, (plan.base || 0) + (plan.entrance.y || 0));
  if (!seen[idx(si, sj)]) problems.push(`entrance at ${ew.map((v) => v.toFixed(1))} is not walkable`);
  while (stack.length) {
    const [i, j, g] = stack.pop();
    visit(i + 1, j, g); visit(i - 1, j, g); visit(i, j + 1, g); visit(i, j - 1, g);
  }
  let reach = 0;
  for (let k = 0; k < seen.length; k++) reach += seen[k];

  const reachableIn = (rect, y) => {
    const p = toWorld(plan, rect[0], rect[1]), q = toWorld(plan, rect[2], rect[3]);
    const x0 = Math.min(p[0], q[0]), z0 = Math.min(p[2], q[2]), x1 = Math.max(p[0], q[0]), z1 = Math.max(p[2], q[2]);
    for (let i = Math.max(0, Math.floor((x0 - X0) / CELL)); i <= Math.min(nx - 1, Math.floor((x1 - X0) / CELL)); i++) {
      for (let j = Math.max(0, Math.floor((z0 - Z0) / CELL)); j <= Math.min(nz - 1, Math.floor((z1 - Z0) / CELL)); j++) {
        const k = idx(i, j);
        if (seen[k] && (y === undefined || Math.abs(ground[k] - (y + (plan.base || 0))) < 0.35)) return true;
      }
    }
    return false;
  };

  // ── every room reachable ──
  for (const r of plan.rooms) if (!reachableIn(r.rect, r.y)) problems.push(`room ${r.id} is not reachable`);

  // ── every opening connects: a point just beyond each face is reachable ──
  for (const el of plan.elements) {
    if (el.t !== 'wall' || !el.openings?.length) continue;
    const [ax, az] = el.a, [bx, bz] = el.b, L = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / L, uz = (bz - az) / L, nx2 = -uz, nz2 = ux;
    for (const o of el.openings) {
      if (o.y0 > el.y0 + 1.2 && o.h < 2) continue;   // windows
      for (const s of [-1, 1]) {
        const d = el.th / 2 + 0.6;
        const px = ax + ux * o.at + nx2 * d * s, pz = az + uz * o.at + nz2 * d * s;
        if (!reachableIn([px - 0.3, pz - 0.3, px + 0.3, pz + 0.3])) problems.push(`opening at ${o.at.toFixed(1)} m on wall (${el.a}) → (${el.b}) does not connect on side ${s}`);
      }
    }
  }

  // ── floating obstacles and intrusions ──
  const obs = built.colliders.obstacles;
  const touch = (p, q, eps = 0.06) => !(p.bb[2] < q.bb[0] - eps || q.bb[2] < p.bb[0] - eps || p.bb[3] < q.bb[1] - eps || q.bb[3] < p.bb[1] - eps);
  for (const o of obs) {
    const mx = (o.bb[0] + o.bb[2]) / 2, mz = (o.bb[1] + o.bb[3]) / 2;
    const g = cw.groundAt(mx, mz, o.y0 + 0.06);
    if (o.y0 <= g + 0.06) continue;
    if (obs.some((q) => q !== o && touch(o, q) && q.y0 <= o.y0 + 1e-3 && q.y1 >= o.y0 - 0.06)) continue;
    problems.push(`obstacle at (${mx.toFixed(1)}, ${mz.toFixed(1)}) floats at y=${o.y0.toFixed(2)}`);
  }
  for (const o of obs) {
    if (!o.circle) continue;
    const [x, z, r] = o.circle;
    for (const q of obs) {
      if (q === o || q.circle) continue;
      if (q.y1 <= o.y0 || q.y0 >= o.y1) continue;
      if (cw.constructor && circleIntrudes(x, z, r - 0.08, q)) { problems.push(`column/object at (${x.toFixed(1)}, ${z.toFixed(1)}) intersects a wall or block`); break; }
    }
  }

  const status = problems.length ? 'FAIL' : 'ok';
  console.log(`${b.id}: ${status} — ${plan.rooms.length} rooms, ${obs.length} obstacles, ${(reach * CELL * CELL).toFixed(0)} m² walkable`);
  for (const p of problems.slice(0, 40)) console.log('  - ' + p);
  if (problems.length > 40) console.log(`  … ${problems.length - 40} more`);
  if (problems.length) failed++;
}
process.exit(failed ? 1 : 0);

function circleIntrudes(x, z, r, q) {
  if (r <= 0) return false;
  const poly = q.poly;
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  if (ins) return true;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j], [bx, bz] = poly[i];
    const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2));
    if (Math.hypot(x - ax - vx * t, z - az - vz * t) < r) return true;
  }
  return false;
}
