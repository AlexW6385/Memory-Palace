// Early Indian Buddhist architecture (2nd–1st century BCE): the vocabulary of the stupas at
// Sanchi. A hemispherical dome (anda) on a circular terrace (medhi) with a walk and a railing; a
// double stairway; on the flattened top a square railing (harmika) round the shaft of a triple
// parasol (chattra); the ground railing (vedika) of posts, lens-shaped crossbars and a rounded
// coping — timber construction turned into stone; gateways (torana) of two square posts with
// animal capitals and three architraves with volute ends; Ashoka's polished pillar with its lion
// capital; a monastery of cells round a court.

import { registerStyle, orientedBox } from '../../core/build.js';
import { box, lathe, fromTriangles } from '../../core/geom.js';
import { hexa, obox } from '../chinese/index.js';

const STONE = 'sandstone_dressed', RAIL = 'sandstone_rail', DOME = 'lime_plaster';

/**
 * A ring of railing { c, r, y, h, gaps: [angles in radians of openings], gap (half-width m), mat }:
 * octagonal posts, three crossbars, a rounded coping. Colliders follow each run of posts.
 */
function railRing(bag, col, c, r, y, h, gaps = [], gap = 1.8, mat = RAIL, walls = true) {
  const pitch = Math.max(0.7, h / 3.1), post = 0.3 * Math.max(0.45, h / 3.1);
  const N = Math.round(2 * Math.PI * r / pitch);
  const open = (a) => gaps.some((g) => { let d = Math.abs(((a - g) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); return d * r < gap; });
  const posts = [], bars = [];
  const pt = (a, rr = r) => [c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr];
  for (let k = 0; k < N; k++) {
    const a = 2 * Math.PI * k / N, a1 = 2 * Math.PI * (k + 1) / N;
    if (open(a)) continue;
    const [px, pz] = pt(a);
    const u = [-Math.sin(a), Math.cos(a)], n = [Math.cos(a), Math.sin(a)];
    obox(posts, [px, pz], u, n, post, post, y, y + h - h * 0.19);
    if (open(a1)) continue;
    // three lens-shaped crossbars to the next post, and the coping over them
    const [qx, qz] = pt(a1), m = [(px + qx) / 2, (pz + qz) / 2], L = Math.hypot(qx - px, qz - pz) / 2;
    const uu = [(qx - px) / (2 * L), (qz - pz) / (2 * L)], nn = [-uu[1], uu[0]];
    for (let b = 0; b < 3; b++) { const yb = y + h * (0.2 + b * 0.22); obox(bars, m, uu, nn, L, post * 0.55, yb, yb + h * 0.14); }
    obox(bars, m, uu, nn, L + 0.02, post * 1.05, y + h * 0.81, y + h * 0.93);
    obox(bars, m, uu, nn, L + 0.02, post * 0.8, y + h * 0.93, y + h);
    if (walls && col) col.segment([px, pz], [qx, qz], post * 2, y, y + h);
  }
  bag.add(mat, fromTriangles(posts));
  bag.add(mat, fromTriangles(bars));
}

/**
 * A gateway (torana) at { at, dir (outward), y, s (scale) }: two square posts with capitals of
 * elephants (blocks), three architraves with curled ends, uprights between them, emblems above.
 */
function torana(bag, col, at, dir, y, s = 1) {
  const u = [-dir[1], dir[0]], out = [], caps = [];
  const W = 2.1 * s, P = 0.35 * s, H = 6.4 * s;
  for (const k of [-1, 1]) {
    const c = [at[0] + u[0] * k * W, at[1] + u[1] * k * W];
    obox(out, c, u, dir, P, P, y, y + H);
    // the capital: a block of four animals back to back
    obox(caps, c, u, dir, P * 1.9, P * 1.9, y + H, y + H + 1.2 * s);
    obox(caps, c, u, dir, P * 1.2, P * 1.2, y + H - 0.25 * s, y + H);
    if (col) col.rect([c[0] - P, c[1] - P, c[0] + P, c[1] + P].map((v, i) => v), y, y + H);
  }
  // the three architraves, each with a volute at either end
  for (let b = 0; b < 3; b++) {
    const yb = y + H + 1.2 * s + b * 1.5 * s, half = 4.3 * s;
    obox(out, at, u, dir, half, 0.32 * s, yb, yb + 0.6 * s);
    for (const k of [-1, 1]) {
      const e = [at[0] + u[0] * k * half, at[1] + u[1] * k * half];
      const vol = lathe([[0.001, -0.36 * s], [0.3 * s, -0.3 * s], [0.42 * s, 0], [0.3 * s, 0.3 * s], [0.001, 0.36 * s]], 12, null, 0, 0, 0);
      vol.rotateX(Math.PI / 2).rotateY(Math.atan2(u[0], u[1]) + Math.PI / 2).translate(e[0], yb + 0.3 * s, e[1]);
      bag.add(STONE, vol);
    }
    // short uprights and small figures between the architraves
    if (b < 2) for (const k of [-1, -0.33, 0.33, 1]) {
      const d = k * W * (Math.abs(k) === 1 ? 1 : 1.3);
      obox(out, [at[0] + u[0] * d, at[1] + u[1] * d], u, dir, 0.22 * s, 0.22 * s, yb + 0.6 * s, yb + 1.5 * s);
    }
  }
  // the emblems on top: a wheel in the middle, a triratna over each post
  const top = y + H + 1.2 * s + 2 * 1.5 * s + 0.6 * s;
  const wheel = lathe([[0.001, -0.1 * s], [0.75 * s, -0.1 * s], [0.75 * s, 0.1 * s], [0.001, 0.1 * s]], 16, null, 0, 0, 0);
  wheel.rotateX(Math.PI / 2).rotateY(Math.atan2(dir[0], dir[1])).translate(at[0], top + 0.85 * s, at[1]);
  bag.add(STONE, wheel);
  for (const k of [-1, 1]) {
    const c = [at[0] + u[0] * k * W, at[1] + u[1] * k * W];
    obox(caps, c, u, dir, 0.4 * s, 0.12 * s, top, top + 0.9 * s);
    obox(caps, c, u, dir, 0.15 * s, 0.12 * s, top + 0.9 * s, top + 1.3 * s);
  }
  bag.add(STONE, fromTriangles(out));
  bag.add(RAIL, fromTriangles(caps));
}

/**
 * A stupa { c, s (scale; 1 = the Great Stupa), y, gates: ['s','n','e','w'], stair }: drum, dome,
 * harmika and parasols, the terrace walk with its railing, the double stairway on the south, the
 * ground railing and the gateways.
 */
function stupa(el, { bag, col }) {
  const [cx, cz] = el.c, s = el.s ?? 1, y = el.y ?? 0;
  const RM = 18.3 * s, HM = 4.3 * s, RA = 16.5 * s, TOP = 16.46 * s, RT = 5 * s;
  // the drum, its moulded top edge
  bag.add(STONE, lathe([[RM + 0.15 * s, -0.2], [RM + 0.15 * s, 0.3 * s], [RM, 0.45 * s], [RM, HM - 0.25 * s], [RM + 0.12 * s, HM - 0.15 * s], [RM + 0.12 * s, HM], [RA, HM]], 72, null, cx, y, cz));
  col.circle(cx, cz, RM, y, y + HM);
  // the walk on the drum's top, as tiles over the ring
  const step = 0.5;
  for (let x = -RM; x < RM; x += step) for (let z = -RM; z < RM; z += step) {
    const d = Math.hypot(x + step / 2, z + step / 2);
    if (d > RA - 0.3 && d < RM) col.floor([cx + x, cz + z, cx + x + step, cz + z + step], y + HM);
  }
  // the dome: a sphere's zone from the walk's inner edge to the flattened top
  const yc = ((RT * RT + (TOP - HM) ** 2) - RA * RA) / (2 * (TOP - HM));       // centre above the walk
  const R = Math.hypot(RA, yc);
  const prof = [];
  for (let k = 0; k <= 24; k++) {
    const yy = (TOP - HM) * k / 24, rr = Math.sqrt(Math.max(0, R * R - (yy - yc) ** 2));
    prof.push([rr, HM + yy]);
  }
  prof.push([0.001, TOP]);
  bag.add(DOME, lathe(prof, 72, null, cx, y, cz));
  col.circle(cx, cz, RA, y + HM, y + TOP);
  // the harmika: a square railing on the top, the shaft and three parasols
  const hm = 2.3 * s;
  bag.add(RAIL, box(cx - hm, y + TOP, cz - hm, cx + hm, y + TOP + 0.3 * s, cz + hm));
  for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) {
    const p = [cx + a[0] * hm, cz + a[1] * hm], q = [cx + b[0] * hm, cz + b[1] * hm], L = Math.hypot(q[0] - p[0], q[1] - p[1]) / 2;
    const uu = [(q[0] - p[0]) / (2 * L), (q[1] - p[1]) / (2 * L)], nn = [-uu[1], uu[0]], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], out = [];
    for (let k = 0; k <= 6; k++) obox(out, [p[0] + uu[0] * L * 2 * k / 6, p[1] + uu[1] * L * 2 * k / 6], uu, nn, 0.13 * s, 0.13 * s, y + TOP + 0.3 * s, y + TOP + 1.4 * s);
    for (const yb of [0.55, 0.85]) obox(out, m, uu, nn, L, 0.07 * s, y + TOP + yb * s, y + TOP + (yb + 0.14) * s);
    obox(out, m, uu, nn, L + 0.1 * s, 0.18 * s, y + TOP + 1.4 * s, y + TOP + 1.65 * s);
    bag.add(RAIL, fromTriangles(out));
  }
  bag.add(RAIL, lathe([[0.16 * s, 0], [0.13 * s, 5.0 * s], [0.001, 5.0 * s]], 8, null, cx, y + TOP, cz));
  for (const [d, h] of [[3.6, 2.6], [3.0, 3.6], [2.4, 4.5]]) {
    bag.add(STONE, lathe([[0.15 * s, h * s - 0.25 * s], [d / 2 * s, h * s - 0.12 * s], [d / 2 * s, h * s], [0.001, h * s + 0.18 * s]], 20, null, cx, y + TOP, cz));
  }
  // the railing on the terrace
  const gs = Math.PI / 2;                       // south (+z) in plan angles
  railRing(bag, col, [cx, cz], RM - 0.2 * s, y + HM, 1.3 * s, el.stair ? [gs] : [], 1.4 * s);
  // the double stairway on the south: two flights along the drum rising to a landing
  if (el.stair) {
    const zs0 = cz + RM - 0.1 * s, zs1 = cz + RM + 1.6 * s, xl = 1.6 * s, xr = 7.0 * s;
    bag.add(STONE, box(cx - xl, y, zs0 - 1.2 * s, cx + xl, y + HM, zs1));
    col.rect([cx - xl, cz + RM + 0.05, cx + xl, zs1], y, y + HM);
    col.floor([cx - xl, zs0 - 1.2 * s, cx + xl, zs1], y + HM);
    for (const k of [-1, 1]) {
      const x0 = Math.min(cx + k * xl, cx + k * xr), x1 = Math.max(cx + k * xl, cx + k * xr);
      const n = Math.round(HM / 0.18), dir = k > 0 ? 'w' : 'e';
      for (let i = 0; i < n; i++) {
        const t1 = (i + 1) / n, yTop = y + HM * t1;
        const xa = k > 0 ? cx + xr - (xr - xl) * t1 : x0, xb = k > 0 ? x1 : cx - xr + (xr - xl) * t1;
        bag.add(STONE, box(xa, y - 0.01, zs0 + 0.1 * s, xb, yTop, zs1));
      }
      col.ramp([x0, zs0 + 0.1 * s, x1, zs1], y, y + HM, dir);
      // the balustrade on the outer side
      const out = [];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6, xx = cx + k * (xl + (xr - xl) * t), yy = y + HM * (1 - t);
        obox(out, [xx, zs1 - 0.15 * s], [1, 0], [0, 1], 0.14 * s, 0.14 * s, yy, yy + 1.2 * s);
      }
      hexa(out, [[cx + k * xl, y + HM + 1.0 * s, zs1 - 0.3 * s], [cx + k * xr, y + 1.0 * s, zs1 - 0.3 * s], [cx + k * xr, y + 1.0 * s, zs1], [cx + k * xl, y + HM + 1.0 * s, zs1]],
        [[cx + k * xl, y + HM + 1.3 * s, zs1 - 0.3 * s], [cx + k * xr, y + 1.3 * s, zs1 - 0.3 * s], [cx + k * xr, y + 1.3 * s, zs1], [cx + k * xl, y + HM + 1.3 * s, zs1]]);
      bag.add(RAIL, fromTriangles(out));
      col.segment([cx + k * xl, zs1 - 0.15 * s], [cx + k * xr, zs1 - 0.15 * s], 0.3 * s, y, y + HM + 1.3 * s);
    }
  }
  // the ground railing with its four (or fewer) openings, and the gateways before them
  const RV = 24 * s, ang = { e: 0, s: Math.PI / 2, w: Math.PI, n: -Math.PI / 2 };
  const gates = el.gates || [];
  railRing(bag, col, [cx, cz], RV, y, 3.1 * s, gates.map((g) => ang[g]), 2.0 * s);
  bag.add('sandstone_floor', lathe([[RV + 0.6 * s, 0.02], [RM + 0.15 * s, 0.02]], 72, null, cx, y, cz));
  for (const g of gates) {
    const a = ang[g], d = [Math.cos(a), Math.sin(a)];
    torana(bag, col, [cx + d[0] * (RV + 3 * s), cz + d[1] * (RV + 3 * s)], d, y, s);
  }
}

/** Ashoka's pillar { at, y }: a polished tapering shaft, a bell capital, an abacus, four lions. */
function ashokaPillar(el, { bag, col }) {
  const [x, z] = el.at, y = el.y;
  bag.add('polished_sandstone', lathe([[0.43, 0], [0.3, 12.8]], 20, null, x, y, z));
  bag.add('polished_sandstone', lathe([[0.3, 12.8], [0.36, 12.9], [0.55, 13.2], [0.62, 13.5], [0.5, 13.6], [0.4, 13.7], [0.55, 13.75], [0.55, 14.05], [0.001, 14.05]], 20, null, x, y, z));
  const out = [];
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2, d = [Math.cos(a), Math.sin(a)], u = [-d[1], d[0]], c = [x + d[0] * 0.22, z + d[1] * 0.22];
    obox(out, c, u, d, 0.16, 0.3, y + 14.05, y + 14.55);
    obox(out, [x + d[0] * 0.38, z + d[1] * 0.38], u, d, 0.15, 0.14, y + 14.4, y + 14.95);
  }
  bag.add('polished_sandstone', fromTriangles(out));
  col.circle(x, z, 0.45, y, y + 14);
}

/** A monastery { rect, y, cell, door }: brick cells round a square court, a verandah of posts, one entrance. */
function vihara(el, { bag, col }) {
  const [x0, z0, x1, z1] = el.rect, y = el.y, D = el.cell || 3.4, H = 3.2;
  const wall = (p, q, th, y0 = y - 0.1, y1 = y + H) => {
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.05) return;
    bag.add('brick', orientedBox(p, q, th, y0, y1, th / 2));
    col.segment(p, q, th, y0, y1);
  };
  // a wall a → b with doorways of width w centred at the given distances from a
  const run = (a, b, th, doors, w) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], P = (d) => [a[0] + u[0] * d, a[1] + u[1] * d];
    let s0 = 0;
    for (const d of doors) { wall(P(s0), P(d - w / 2), th); bag.add('brick', orientedBox(P(d - w / 2), P(d + w / 2), th, y + 2.3, y + H)); s0 = d + w / 2; }
    wall(P(s0), P(L), th);
  };
  const midz = (z0 + z1) / 2;
  // the outer walls; the entrance in the middle of the west side
  run([x0, z0], [x1, z0], 0.6, [], 0); run([x1, z0], [x1, z1], 0.6, [], 0); run([x1, z1], [x0, z1], 0.6, [], 0);
  run([x0, z1], [x0, z0], 0.6, [(z1 - z0) / 2], 2.2);
  // the cells' inner wall, a doorway into each cell, the passage on the west
  const ix0 = x0 + D, iz0 = z0 + D, ix1 = x1 - D, iz1 = z1 - D;
  const cells = (a, b, skip = null) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 3.4)), doors = [];
    for (let k = 0; k < n; k++) { const d = (k + 0.5) * L / n; if (skip === null || Math.abs(d - skip) > 1.8) doors.push(d); }
    if (skip !== null) doors.push(skip);
    doors.sort((p, q) => p - q);
    run(a, b, 0.4, doors, skip !== null ? 1.0 : 1.0);
  };
  cells([ix0, iz0], [ix1, iz0]); cells([ix1, iz0], [ix1, iz1]); cells([ix1, iz1], [ix0, iz1]);
  cells([ix0, iz1], [ix0, iz0], iz1 - midz);
  // partitions between the cells, and the passage from the entrance
  for (const [a, b, n] of [[[ix0, iz0], [ix1, iz0], 'n'], [[ix0, iz1], [ix1, iz1], 's']]) {
    const L = ix1 - ix0, k = Math.max(1, Math.round(L / 3.4));
    for (let i = 1; i < k; i++) { const x = ix0 + i * L / k; wall([x, n === 'n' ? z0 + 0.3 : iz1 + 0.2], [x, n === 'n' ? iz0 - 0.2 : z1 - 0.3], 0.3); }
    void a; void b;
  }
  for (const zz of [midz - 1.1, midz + 1.1]) wall([x0 + 0.3, zz], [ix0 - 0.2, zz], 0.3);
  // the roof over the cells, the verandah's posts and its roof round the court
  const v = 2.0;
  for (const r of [[x0, z0, x1, iz0], [x0, iz1, x1, z1], [x0, iz0, ix0, iz1], [ix1, iz0, x1, iz1]]) bag.add('brick', box(r[0], y + H, r[1], r[2], y + H + 0.35, r[3]));
  const ring = [[ix0 + v, iz0 + v], [ix1 - v, iz0 + v], [ix1 - v, iz1 - v], [ix0 + v, iz1 - v]];
  for (let i = 0; i < 4; i++) {
    const a = ring[i], b = ring[(i + 1) % 4], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 3.2));
    for (let k = 0; k < n; k++) {
      const px = a[0] + (b[0] - a[0]) * k / n, pz = a[1] + (b[1] - a[1]) * k / n;
      if (i === 3 && Math.abs(pz - midz) < 1.6) continue;
      bag.add(STONE, box(px - 0.15, y, pz - 0.15, px + 0.15, y + 2.7, pz + 0.15)); col.circle(px, pz, 0.18, y, y + 2.7);
    }
  }
  for (const r of [[ix0, iz0, ix1, iz0 + v + 0.2], [ix0, iz1 - v - 0.2, ix1, iz1], [ix0, iz0, ix0 + v + 0.2, iz1], [ix1 - v - 0.2, iz0, ix1, iz1]]) bag.add('timber', box(r[0], y + 2.7, r[1], r[2], y + 2.85, r[3]));
  bag.add('sandstone_floor', box(x0, y - 0.3, z0, x1, y + 0.02, z1));
  col.floor(el.rect, y + 0.02);
}

registerStyle('indian', {
  column: () => {},
  trim: () => {},
  opening: () => {},
  elements: { stupa },
  objects: { ashoka_pillar: ashokaPillar, vihara },
});
