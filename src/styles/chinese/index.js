// Chinese timber architecture (Tang, 9th century): the vocabulary of the Great East Hall of
// Foguang Monastery. Round columns on lotus bases with a rise toward the corners; architraves
// painted "seven red, eight white"; bracket sets (dougong) of blocks and arms stepping out in
// tiers, with descending cantilevers; deep eaves of rafters; a hipped roof of grey tiles on a
// concave profile, its corners turned up, the ridge ending in chiwei; a stone-faced platform.

import { BufferGeometry, Float32BufferAttribute } from 'three';
import { registerStyle } from '../../core/build.js';
import { box, lathe, fromTriangles, orientOutward } from '../../core/geom.js';
import { byzantineElements } from '../byzantine/index.js';

export function hexa(out, b, t) {
  const tris = [];
  const q = (a, b2, c, d) => tris.push(...a, ...b2, ...c, ...a, ...c, ...d);
  q(b[0], b[1], b[2], b[3]); q(t[0], t[3], t[2], t[1]);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; q(b[i], t[i], t[j], b[j]); }
  out.push(...orientOutward(tris));
}

/** A box in a local frame: centre c [x, z], axes u (along) and n (out), extents ±hu, ±hn, y0…y1. */
export function obox(out, c, u, n, hu, hn, y0, y1, nOff = 0) {
  const P = (a, b, y) => [c[0] + u[0] * a + n[0] * (b + nOff), y, c[1] + u[1] * a + n[1] * (b + nOff)];
  hexa(out, [P(-hu, -hn, y0), P(hu, -hn, y0), P(hu, hn, y0), P(-hu, hn, y0)], [P(-hu, -hn, y1), P(hu, -hn, y1), P(hu, hn, y1), P(-hu, hn, y1)]);
}
/** A sloping beam in the (n, y) plane: from (n0, y0) to (n1, y1), width 2hu, depth d. */
function slant(out, c, u, n, hu, n0, y0, n1, y1, d) {
  const P = (a, b, y) => [c[0] + u[0] * a + n[0] * b, y, c[1] + u[1] * a + n[1] * b];
  hexa(out, [P(-hu, n0, y0 - d), P(hu, n0, y0 - d), P(hu, n1, y1 - d), P(-hu, n1, y1 - d)], [P(-hu, n0, y0), P(hu, n0, y0), P(hu, n1, y1), P(-hu, n1, y1)]);
}

/**
 * A bracket set (dougong) { at [x, z], y (column top), dir [dx, dz] (outward), tiers, step, both, ang }:
 * the cap block; in each tier a projecting arm stepping out by `step`, crossed at its tip by an arm
 * along the wall with small blocks; in the upper tiers descending cantilevers (ang) cut like split
 * bamboo; the topmost arm and a beam-end under the eave purlin. `both` also steps inward.
 */
export function bracketSet(el, { bag }) {
  const [x, z] = el.at, y = el.y, n = el.dir, u = [-n[1], n[0]], T = el.tiers || 4, s = el.step || 0.48;
  const out = [], blocks = [];
  const c = [x, z];
  // the cap block (ludou): wide, its lower part tapering
  obox(blocks, c, u, n, 0.34, 0.34, y + 0.14, y + 0.38);
  obox(blocks, c, u, n, 0.27, 0.27, y, y + 0.14);
  const th = 0.3, lv = 0.42;
  for (let k = 1; k <= T; k++) {
    const yb = y + 0.38 + (k - 1) * lv, reach = k * s;
    const isAng = el.ang && k > T - 2;
    // the projecting arm (huagong), symmetric if `both`
    const back = el.both ? -reach : -0.3;
    if (!isAng) obox(out, c, u, n, 0.1, (reach - back) / 2, yb, yb + th, (reach + back) / 2);
    else slant(out, c, u, n, 0.1, -reach * 0.6, yb + th + 0.5, reach + 0.35, yb - 0.12, 0.26);
    // the arm along the wall at the tip (guazi / ling gong), with blocks at its ends and middle
    const len = k === T ? 0.95 : 0.7 + 0.05 * k;
    for (const side of el.both ? [-1, 1] : [1]) {
      const tip = [x + n[0] * reach * side, z + n[1] * reach * side];
      obox(out, tip, u, n, len, 0.09, yb + th, yb + th + 0.26);
      for (const a of [-len + 0.12, 0, len - 0.12]) obox(blocks, [tip[0] + u[0] * a, tip[1] + u[1] * a], u, n, 0.13, 0.13, yb + th + 0.26, yb + th + 0.42);
    }
    // the arm along the wall over the column (nidao gong), doubled up the tiers
    if (k <= 2) obox(out, c, u, n, 0.62 + 0.15 * k, 0.09, yb + th, yb + th + 0.26);
  }
  // the top: a beam-end (shuatou) and the block under the eave purlin
  const ytop = y + 0.38 + T * lv;
  obox(out, c, u, n, 0.1, (T * s + 0.55) / 2, ytop - 0.1, ytop + 0.18, (T * s + 0.55) / 2 - 0.3);
  bag.add(el.mat || 'timber_red', fromTriangles(out));
  bag.add(el.blockMat || 'timber_red', fromTriangles(blocks));
}

/** A hipped roof (wudian) { c [x, z], A, B (half-sizes at the eave edge, A ≥ B), y (eave), rise, lift, mat }. */
function hipRoof(el, ctx) { alongZ(hipRoofX, el, ctx); }

/** Build a roof along x, or — for a hall whose long side runs along z — turn it a quarter round its centre. */
export function alongZ(fn, el, ctx) {
  if (!el.alongZ) return fn(el, ctx);
  const list = [];
  fn(el, { ...ctx, bag: { add: (mat, g) => list.push([mat, g]) } });
  const [cx, cz] = el.c;
  for (const [mat, g] of list) { g.translate(-cx, 0, -cz); g.rotateY(Math.PI / 2); g.translate(cx, 0, cz); ctx.bag.add(mat, g); }
}
function hipRoofX(el, { bag }) {
  const [cx, cz] = el.c, A = el.A, B = el.B, R = el.rise, U = el.lift ?? 0.6;
  const h = (x, z) => {
    const ax = Math.abs(x - cx), az = Math.abs(z - cz);
    const t = Math.max(0, Math.min(1, Math.min((B - az) / B, (A - ax) / B)));
    const corner = Math.max(0, 1 - (A - ax) / 5) * Math.max(0, 1 - (B - az) / 5);
    return el.y + R * Math.pow(t, 1.45) + U * corner * corner;
  };
  const grid = (off, up, mat) => {
    const N = 64, M = 40, pos = [], nor = [];
    const P = (i, j) => { const x = cx - A + 2 * A * i / N, z = cz - B + 2 * B * j / M; return [x, h(x, z) + off, z]; };
    const nrm = (i, j) => {
      const a = P(Math.max(0, i - 1), j), b = P(Math.min(N, i + 1), j), c = P(i, Math.max(0, j - 1)), d = P(i, Math.min(M, j + 1));
      const ux = b[0] - a[0], uy = b[1] - a[1], vy = d[1] - c[1], vz = d[2] - c[2];
      let n = [-uy / ux, 1, -vy / vz]; const l = Math.hypot(...n); n = n.map((v) => v / l);
      return up ? n : n.map((v) => -v);
    };
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
      const q = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
      const tris = up ? [[0, 2, 1], [0, 3, 2]] : [[0, 1, 2], [0, 2, 3]];
      for (const tri of tris) for (const k of tri) { pos.push(...P(...q[k])); nor.push(...nrm(...q[k])); }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
    bag.add(mat, g);
  };
  grid(0, true, el.mat || 'tile_grey');
  grid(-0.32, false, el.soffit || 'timber_red');
  // the eave's edge: a fascia between tiles and soffit
  const edge = [], E = 96;
  const ring = (k) => {
    const per = 4 * (A + B), d = per * k / E;
    if (d < 2 * A) return [cx - A + d, cz - B];
    if (d < 2 * A + 2 * B) return [cx + A, cz - B + (d - 2 * A)];
    if (d < 4 * A + 2 * B) return [cx + A - (d - 2 * A - 2 * B), cz + B];
    return [cx - A, cz + B - (d - 4 * A - 2 * B)];
  };
  for (let k = 0; k < E; k++) {
    const [ax, az] = ring(k), [bx, bz] = ring(k + 1);
    const ya = h(ax, az), yb = h(bx, bz);
    edge.push(ax, ya + 0.02, az, bx, yb + 0.02, bz, bx, yb - 0.34, bz, ax, ya + 0.02, az, bx, yb - 0.34, bz, ax, ya - 0.34, az);
    edge.push(ax, ya + 0.02, az, bx, yb - 0.34, bz, bx, yb + 0.02, bz, ax, ya + 0.02, az, ax, ya - 0.34, az, bx, yb - 0.34, bz);
  }
  bag.add(el.soffit || 'timber_red', fromTriangles(edge));
  // the main ridge with its chiwei, and the four hip ridges
  const r = [], L = A - B, top = el.y + R;
  obox(r, [cx, cz], [1, 0], [0, 1], L + 0.2, 0.3, top - 0.1, top + 0.75);
  for (const s of [-1, 1]) {
    const ex = cx + s * (L + 0.1);
    if (!el.noChiwei)
    // a chiwei: a tall ornament curling inward, built of stacked blocks
    for (let k = 0; k < 6; k++) obox(r, [ex - s * (0.18 * k * k / 6), cz], [1, 0], [0, 1], 0.42 - k * 0.03, 0.22, top + 0.6 + k * 0.42, top + 1.05 + k * 0.42);
    for (const sz of [-1, 1]) {
      const pts = [];
      for (let k = 0; k <= 24; k++) { const t = k / 24, x = ex + s * B * t, z = cz + sz * B * t; pts.push([x, h(x, z) + 0.25, z]); }
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k], b = pts[k + 1], dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
        const w = 0.22, px = -uz * w, pz = ux * w;
        hexa(r, [[a[0] - px, a[1] - 0.3, a[2] - pz], [a[0] + px, a[1] - 0.3, a[2] + pz], [b[0] + px, b[1] - 0.3, b[2] + pz], [b[0] - px, b[1] - 0.3, b[2] - pz]],
          [[a[0] - px, a[1] + 0.25, a[2] - pz], [a[0] + px, a[1] + 0.25, a[2] + pz], [b[0] + px, b[1] + 0.25, b[2] + pz], [b[0] - px, b[1] + 0.25, b[2] - pz]]);
      }
    }
  }
  bag.add(el.ridgeMat || 'tile_grey', fromTriangles(r));
}

/** A gabled roof (for gates and lesser halls) { c, A, B, y, rise, mat } with a ridge. */
function gableRoofC(el, ctx) { alongZ(gableRoofCX, el, ctx); }
function gableRoofCX(el, { bag }) {
  const [cx, cz] = el.c, A = el.A, B = el.B, y = el.y, R = el.rise;
  const tris = [], under = [];
  const prof = (t) => y + R * Math.pow(t, 1.4);
  const N = 12;
  for (let k = 0; k < N; k++) {
    const t0 = k / N, t1 = (k + 1) / N;
    for (const s of [-1, 1]) {
      const z0 = cz + s * B * (1 - t0), z1 = cz + s * B * (1 - t1);
      tris.push(cx - A, prof(t0), z0, cx + A, prof(t0), z0, cx + A, prof(t1), z1, cx - A, prof(t0), z0, cx + A, prof(t1), z1, cx - A, prof(t1), z1);
    }
  }
  for (let i = 0; i < tris.length; i += 9) {
    const ux = tris[i + 3] - tris[i], uz = tris[i + 5] - tris[i + 2], vx = tris[i + 6] - tris[i], vz = tris[i + 8] - tris[i + 2];
    if (uz * vx - ux * vz < 0) for (let k = 0; k < 3; k++) { const tt = tris[i + 3 + k]; tris[i + 3 + k] = tris[i + 6 + k]; tris[i + 6 + k] = tt; }
  }
  for (let i = 0; i < tris.length; i += 9) under.push(tris[i], tris[i + 1] - 0.25, tris[i + 2], tris[i + 6], tris[i + 7] - 0.25, tris[i + 8], tris[i + 3], tris[i + 4] - 0.25, tris[i + 5]);
  bag.add(el.mat || 'tile_grey', fromTriangles(tris));
  bag.add(el.soffit || 'timber_red', fromTriangles(under));
  const rm = el.ridgeMat || 'tile_grey';
  bag.add(rm, box(cx - A - 0.1, y + R - 0.1, cz - 0.25, cx + A + 0.1, y + R + 0.5, cz + 0.25));
  if (!el.noHorns) for (const s of [-1, 1]) bag.add(rm, box(cx + s * A - 0.25, y + R, cz - 0.22, cx + s * A + 0.25, y + R + 1.1, cz + 0.22));
  // the gable ends closed by boards
  if (el.gableMat) {
    const g = [];
    for (const s of [-1, 1]) {
      const x = cx + s * (A - 0.6);
      for (let k = 0; k < N; k++) for (const sz of [-1, 1]) {
        const t0 = k / N, t1 = (k + 1) / N, z0 = cz + sz * B * (1 - t0) * 0.82, z1 = cz + sz * B * (1 - t1) * 0.82;
        g.push(x, y, cz, x, prof(t0) - 0.3, z0, x, prof(t1) - 0.3, z1, x, y, cz, x, prof(t1) - 0.3, z1, x, prof(t0) - 0.3, z0);
      }
    }
    bag.add(el.gableMat, fromTriangles(g));
  }
}

/** A round timber column on a lotus base { at, y, h, d }. */
function column(el, { bag, col }) {
  const [x, z] = el.at, y = el.y, h = el.h, r = el.d / 2;
  bag.add('limestone', box(x - r * 1.9, y - 0.05, z - r * 1.9, x + r * 1.9, y + 0.12, z + r * 1.9));
  bag.add('limestone', lathe([[r * 1.75, 0], [r * 1.65, 0.1], [r * 1.2, 0.22], [r * 1.05, 0.26]], 16, (th) => 1 + 0.06 * Math.abs(Math.cos(th * 4)), x, y + 0.12, z));
  bag.add(el.shaftMat || 'timber_red', lathe([[r, 0], [r * 1.0, h * 0.4], [r * 0.9, h - 0.38]], 20, null, x, y + 0.38, z));
  col.circle(x, z, r * 1.2, y, y + h);
}

/** A seated Buddha on a lotus throne { at, y, h, yaw }: massing of throne, crossed legs, robe, head and halo. */
export function buddha(el, { bag }) {
  const [x, z] = el.at, y = el.y, H = el.h || 5.2, s = H / 5.2, dir = el.dir || [-1, 0];
  const robe = el.robe || 'clay_robe', gilt = el.gilt || 'clay_gilt';
  if (!el.noThrone) bag.add(robe, lathe([[1.5 * s, 0], [1.4 * s, 0.4 * s], [1.0 * s, 0.6 * s], [1.0 * s, 1.0 * s]], 16, null, x, y, z));
  if (!el.noThrone) bag.add(gilt, lathe([[0.9 * s, 0], [1.55 * s, 0.25 * s], [1.6 * s, 0.45 * s], [1.3 * s, 0.6 * s]], 24, (th) => 1 + 0.07 * Math.abs(Math.cos(th * 8)), x, y + 1.0 * s, z));
  const b = y + 1.6 * s;
  // the crossed legs: an oval wider across than deep; then the body, the shoulders, the neck
  const legs = lathe([[1.0 * s, 0], [1.02 * s, 0.25 * s], [0.85 * s, 0.48 * s], [0.001, 0.52 * s]], 24, null, 0, 0, 0);
  legs.scale(Math.abs(dir[1]) > 0.5 ? 1.35 : 0.8, 1, Math.abs(dir[1]) > 0.5 ? 0.8 : 1.35); legs.translate(x, b, z);
  bag.add(robe, legs);
  bag.add(robe, lathe([[0.62 * s, 0.4 * s], [0.6 * s, 1.0 * s], [0.66 * s, 1.5 * s], [0.68 * s, 1.68 * s], [0.42 * s, 1.92 * s], [0.18 * s, 2.05 * s]], 20, null, x, b, z));
  bag.add(gilt, lathe([[0.001, 2.05 * s], [0.3 * s, 2.15 * s], [0.34 * s, 2.45 * s], [0.25 * s, 2.7 * s], [0.12 * s, 2.85 * s], [0.001, 2.92 * s]], 16, null, x, b, z));
  // the halo, a disc behind the head
  if (el.noHalo) return;
  const hx = x - dir[0] * 0.45 * s, hz = z - dir[1] * 0.45 * s;
  const R = 0.85 * s, yc = b + 2.45 * s;
  bag.add(gilt, lathe([[0.001, -0.04], [R, -0.04], [R, 0.04], [0.001, 0.04]], 24, null, 0, 0, 0).rotateX(Math.PI / 2).rotateY(Math.atan2(dir[0], dir[1])).translate(hx, yc, hz));
}

/** A standing figure (attendant, heavenly king) { at, y, h, robe }. */
function figure(el, { bag }) {
  const [x, z] = el.at, y = el.y, h = el.h || 2.4;
  bag.add('clay_gilt', lathe([[0.45, 0], [0.42, 0.25]], 12, (th) => 1 + 0.08 * Math.abs(Math.cos(th * 8)), x, y, z));
  bag.add(el.robe || 'clay_green', lathe([[0.36, 0], [0.3, h * 0.35], [0.24, h * 0.6], [0.3, h * 0.74], [0.17, h * 0.82], [0.001, h * 0.82]], 14, null, x, y + 0.25, z));
  bag.add('clay_gilt', lathe([[0.001, h * 0.82], [0.12, h * 0.86], [0.13, h * 0.94], [0.06, h * 1.0], [0.001, h * 1.02]], 12, null, x, y + 0.25, z));
}

/** An animal mount as massing (lion or elephant) under a seated bodhisattva { at, y, kind, dir }. */
function mount(el, { bag }) {
  const [x, z] = el.at, y = el.y, d = el.dir || [-1, 0], u = [-d[1], d[0]], out = [];
  const big = el.animal === 'elephant';
  const L = big ? 1.4 : 1.1, W = big ? 0.7 : 0.5, H = big ? 1.5 : 1.0;
  obox(out, [x, z], u, d, W, L, y + H * 0.45, y + H);
  for (const a of [-1, 1]) for (const b of [-1, 1]) obox(out, [x + u[0] * a * W * 0.6 + d[0] * b * L * 0.7, z + u[1] * a * W * 0.6 + d[1] * b * L * 0.7], u, d, 0.16, 0.16, y, y + H * 0.5);
  obox(out, [x + d[0] * (L + 0.25), z + d[1] * (L + 0.25)], u, d, W * 0.7, 0.35, y + H * 0.6, y + H * 1.15);
  if (big) obox(out, [x + d[0] * (L + 0.55), z + d[1] * (L + 0.55)], u, d, 0.12, 0.1, y + H * 0.2, y + H * 0.8);
  bag.add(big ? 'paint_white' : 'clay_green', fromTriangles(out));
  buddha({ at: [x, z], y: y + H, h: 3.0, dir: d }, { bag });
}

/** The dhāraṇī pillar: a hexagonal stone shaft on a lotus base, with a canopy and pearl. */
function dharaniPillar(el, { bag, col }) {
  const [x, z] = el.at, y = el.y;
  bag.add('limestone', lathe([[0.75, 0], [0.75, 0.35], [0.55, 0.45], [0.62, 0.75], [0.3, 0.85], [0.3, 2.35], [0.6, 2.5], [0.55, 2.7], [0.28, 2.8], [0.2, 3.0], [0.001, 3.24]], 6, null, x, y, z));
  col.circle(x, z, 0.75, y, y + 3.24);
}

/** A small hexagonal pagoda of two storeys with a lotus finial (the Zushi pagoda). */
function pagoda(el, { bag, col }) {
  const [x, z] = el.at, y = el.y;
  bag.add('paint_white', lathe([[1.7, 0], [1.7, 0.6], [1.5, 0.7], [1.5, 2.6], [1.9, 2.8], [1.9, 3.0], [1.25, 3.3], [1.15, 4.2], [1.45, 4.35], [1.45, 4.5], [0.9, 4.8], [0.6, 5.2], [0.35, 5.6], [0.001, 6.1]], 6, null, x, y, z));
  bag.add('opening', box(x - 0.5, y + 0.7, z - 1.52, x + 0.5, y + 2.2, z - 1.49));
  col.circle(x, z, 1.7, y, y + 6);
}

export { hipRoof, gableRoofC, column as chineseColumn };

registerStyle('chinese', {
  column,
  trim: () => {},
  opening: () => {},
  elements: { ...byzantineElements, bracket_set: bracketSet, hip_roof: hipRoof, gable_roof_c: gableRoofC },
  objects: { buddha, figure, mount, dharani_pillar: dharaniPillar, pagoda },
});
