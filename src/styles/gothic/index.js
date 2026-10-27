// Gothic architecture (Rayonnant, Île-de-France, mid-13th century): the vocabulary of the
// Sainte-Chapelle. Pointed arches; quadripartite rib vaults (two pointed tunnels crossing, their
// groins carried by ribs); polygonal apses under radiating vaults; walls dissolved into tall
// windows with bar tracery and stained glass; stepped buttresses with pinnacles; gables over the
// windows; steep roofs and a slender spire. Planar walls (with pointed arches and round holes)
// come from the shared Byzantine vocabulary.

import { BufferGeometry, Float32BufferAttribute } from 'three';
import { registerStyle } from '../../core/build.js';
import { box, lathe, fromTriangles, orientOutward } from '../../core/geom.js';
import { byzantineElements, planarWall, archHalf, archRise } from '../byzantine/index.js';
import { doors } from '../greek/objects.js';

const D2R = Math.PI / 180;

function hexa(out, b, t) {
  const tris = [];
  const q = (a, b2, c, d) => tris.push(...a, ...b2, ...c, ...a, ...c, ...d);
  q(b[0], b[1], b[2], b[3]); q(t[0], t[3], t[2], t[1]);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; q(b[i], t[i], t[j], b[j]); }
  out.push(...orientOutward(tris));
}

/** Pointed profile: 1 at the crown (t = 0), 0 at the springing (t = 1); f = arc radius / span. */
function pointed(t, f = 0.75) {
  const R = 2 * f;
  const H = Math.sqrt(R * R - (R - 1) * (R - 1));
  const x = Math.min(1, Math.max(0, t)) + (R - 1);
  return Math.sqrt(Math.max(0, R * R - x * x)) / H;
}

/** A smooth surface y = h(x, z) over a grid, facing down (a vault seen from below). */
function heightSurface(nx, nz, P, inward = true) {
  const pos = [], nor = [];
  const pts = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) pts.push(P(i / nx, j / nz));
  const at = (i, j) => pts[j * (nx + 1) + i];
  const normal = (i, j) => {
    const a = at(Math.max(0, i - 1), j), b = at(Math.min(nx, i + 1), j), c = at(i, Math.max(0, j - 1)), d = at(i, Math.min(nz, j + 1));
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - c[0], vy = d[1] - c[1], vz = d[2] - c[2];
    let n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    const l = Math.hypot(...n) || 1; n = n.map((v) => v / l);
    if ((n[1] > 0) === inward) n = n.map((v) => -v);
    return n;
  };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const q = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
    for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
      let tri = [q[a], q[b], q[c]];
      const p0 = at(...tri[0]), p1 = at(...tri[1]), p2 = at(...tri[2]);
      const ny = (p1[2] - p0[2]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[2] - p0[2]);
      if ((ny > 0) === inward) tri = [tri[0], tri[2], tri[1]];
      for (const [ii, jj] of tri) { pos.push(...at(ii, jj)); nor.push(...normal(ii, jj)); }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  return g;
}

/** A rib hanging below a curve of points (each [x, y, z]): width w, depth d. */
function rib(out, pts, w = 0.28, d = 0.3) {
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1];
    const tx = b[0] - a[0], tz = b[2] - a[2], L = Math.hypot(tx, tz) || 1;
    const sx = -tz / L * w / 2, sz = tx / L * w / 2;
    const B = (p, dd) => [[p[0] - sx, p[1] - dd, p[2] - sz], [p[0] + sx, p[1] - dd, p[2] + sz]];
    const [a0, a1] = B(a, d), [a2, a3] = B(a, -0.02), [b0, b1] = B(b, d), [b2, b3] = B(b, -0.02);
    hexa(out, [a0, a1, b1, b0], [a2, a3, b3, b2]);
  }
}

/**
 * Quadripartite rib vault over a rectangular bay { rect, spring, crown, f, mat, ribMat }: the
 * lower-enveloped union of two pointed tunnels, diagonal and transverse ribs below it.
 */
function ribVault(el, { bag }) {
  const [x0, z0, x1, z1] = el.rect, H = el.crown - el.spring, f = el.f ?? 0.7;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hx = (x1 - x0) / 2, hz = (z1 - z0) / 2;
  const hgt = (x, z) => el.spring + H * Math.max(pointed(Math.abs(x - cx) / hx, f), pointed(Math.abs(z - cz) / hz, f));
  bag.add(el.mat, heightSurface(24, 24, (u, v) => { const x = x0 + u * (x1 - x0), z = z0 + v * (z1 - z0); return [x, hgt(x, z), z]; }));
  const out = [], N = 24;
  const line = (ax, az, bx, bz) => Array.from({ length: N + 1 }, (_, k) => { const t = k / N, x = ax + (bx - ax) * t, z = az + (bz - az) * t; return [x, hgt(x, z), z]; });
  rib(out, line(x0, z0, x1, z1)); rib(out, line(x0, z1, x1, z0));
  if (el.transverse !== false) { rib(out, line(x0, z0, x0, z1), 0.36, 0.38); rib(out, line(x1, z0, x1, z1), 0.36, 0.38); }
  // the wall ribs along the side walls, and a boss at the crown
  rib(out, line(x0, z0 + 0.05, x1, z0 + 0.05), 0.18, 0.18); rib(out, line(x0, z1 - 0.05, x1, z1 - 0.05), 0.18, 0.18);
  bag.add(el.ribMat || el.mat, fromTriangles(out));
  bag.add('gold', lathe([[0.32, 0], [0.36, 0.1], [0.001, 0.22]], 12, null, cx, el.crown - 0.42, cz));
}

/**
 * Radiating vault over a polygonal apse { c [x, z], R (inner radius), a0, a1 (deg), sides,
 * spring, crown }: each cell rises to its window, ribs run from each corner to the keystone.
 */
function apseVault(el, { bag }) {
  const [cx, cz] = el.c, H = el.crown - el.spring, f = el.f ?? 0.7, n = el.sides, a0 = el.a0 * D2R, a1 = el.a1 * D2R;
  const step = (a1 - a0) / n;
  const polyR = (a) => { const k = Math.floor((a - a0) / step), m = a0 + (k + 0.5) * step; return el.R * Math.cos(step / 2) / Math.cos(a - m); };
  const hgt = (a, rho) => {
    const k = Math.min(n - 1, Math.max(0, Math.floor((a - a0) / step))), m = a0 + (k + 0.5) * step;
    const s = Math.abs(a - m) / (step / 2);
    return el.spring + H * Math.max(pointed(rho, f), pointed(s, f) * Math.pow(rho, 0.3) + (1 - Math.pow(rho, 0.3)) * pointed(rho, f));
  };
  bag.add(el.mat, heightSurface(n * 10, 16, (u, v) => {
    const a = a0 + (a1 - a0) * u, rho = 1 - v, r = rho * polyR(a);
    return [cx + Math.cos(a) * r, hgt(a, rho), cz + Math.sin(a) * r];
  }));
  const out = [];
  for (let k = 0; k <= n; k++) {
    const a = a0 + k * step;
    rib(out, Array.from({ length: 21 }, (_, i) => { const rho = 1 - i / 20, r = rho * el.R * (k === 0 || k === n ? 1 : 1); return [cx + Math.cos(a) * r, el.spring + H * pointed(rho, f), cz + Math.sin(a) * r]; }));
  }
  bag.add(el.ribMat || el.mat, fromTriangles(out));
}

/** Bars of tracery along a curve in a wall's plane: { o, u, pts [[u, y] …], w, d, th (offset) }. */
function barsInPlane(out, o, u, pts, w, d, off = 0) {
  const n = [-u[1], u[0]];
  for (let k = 0; k < pts.length - 1; k++) {
    const [ua, ya] = pts[k], [ub, yb] = pts[k + 1];
    const tx = ub - ua, ty = yb - ya, L = Math.hypot(tx, ty) || 1;
    const px = -ty / L * w / 2, py = tx / L * w / 2;
    const W = (uu, yy, s) => [o[0] + u[0] * uu + n[0] * (off + s), yy, o[1] + u[1] * uu + n[1] * (off + s)];
    const s0 = -d / 2, s1 = d / 2;
    hexa(out, [W(ua - px, ya - py, s0), W(ua + px, ya + py, s0), W(ub + px, yb + py, s0), W(ub - px, yb - py, s0)],
      [W(ua - px, ya - py, s1), W(ua + px, ya + py, s1), W(ub + px, yb + py, s1), W(ub - px, yb - py, s1)]);
  }
}
const arcPts = (a, uc, side, n = 14) => Array.from({ length: n + 1 }, (_, k) => {
  const H = archRise(a), dy = H * k / n;
  return [uc + side * archHalf(a, dy), a.spring + dy];
});

/**
 * A Gothic window in a wall plane { o, u, uc, w, sill, spring, f, lancets, frame } — stained
 * glass (two layers: lit inside, dark outside, `inSide` ±1 the interior side), mullions and the
 * tracery of the head (sub-arches and a rose of tracery, or an oculus for two lancets).
 */
function gothicWindow(el, { bag }) {
  const { o, u, uc, w, sill, spring } = el, f = el.f ?? 0.75, half = w / 2, inS = el.inSide ?? 1;
  const top = { uc, r: half, spring, pointed: f };
  const n = [-u[1], u[0]];
  const glass = (off, mat) => bag.add(mat, planarWall({ o: [o[0] + n[0] * off, o[1] + n[1] * off], u, th: 0.02, u0: uc - half, u1: uc + half, y0: sill, y1: spring + archRise(top), outline: top }));
  glass(inS * 0.015, 'stained_glass');
  glass(-inS * 0.015, 'glass_outer');
  // tracery
  const tr = [], bw = el.bar ?? 0.16, bd = 0.32;
  const L = el.lancets || 4;
  barsInPlane(tr, o, u, [...arcPts(top, uc, -1).reverse(), ...arcPts(top, uc, 1)], bw * 1.4, bd);       // the frame
  barsInPlane(tr, o, u, [[uc - half, sill], [uc + half, sill]], bw * 1.6, bd + 0.1);                      // the sill
  barsInPlane(tr, o, u, [[uc - half, sill], [uc - half, spring]], bw * 1.4, bd);
  barsInPlane(tr, o, u, [[uc + half, sill], [uc + half, spring]], bw * 1.4, bd);
  const lw = w / L;
  for (let k = 1; k < L; k++) barsInPlane(tr, o, u, [[uc - half + k * lw, sill], [uc - half + k * lw, spring + (k === L / 2 ? 0 : lw * 0.4)]], bw * (k === L / 2 ? 1.25 : 1), bd);
  // lancet heads
  for (let k = 0; k < L; k++) {
    const c = uc - half + (k + 0.5) * lw, sub = { uc: c, r: lw / 2, spring: spring + (L === 4 ? 0 : 0) + lw * 0.4 * (L === 4 ? 1 : 0), pointed: 0.8 };
    barsInPlane(tr, o, u, [...arcPts(sub, c, -1, 8).reverse(), ...arcPts(sub, c, 1, 8)], bw * 0.9, bd);
  }
  const H = archRise(top);
  if (L === 4) {
    // two sub-arches, each over two lancets, and a rose of tracery between them
    for (const side of [-1, 1]) {
      const c = uc + side * half / 2, sub = { uc: c, r: half / 2, spring, pointed: 0.8 };
      barsInPlane(tr, o, u, [...arcPts(sub, c, -1, 10).reverse(), ...arcPts(sub, c, 1, 10)], bw * 1.1, bd);
    }
    const cy = spring + archRise({ uc, r: half / 2, spring, pointed: 0.8 }) + (H - archRise({ uc, r: half / 2, spring, pointed: 0.8 })) * 0.45;
    const rr = Math.min(half * 0.48, (spring + H - cy) * 0.75);
    ring(tr, o, u, uc, cy, rr, bw, bd);
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; ring(tr, o, u, uc + Math.cos(a) * rr * 0.55, cy + Math.sin(a) * rr * 0.55, rr * 0.36, bw * 0.7, bd); }
  } else {
    const cy = spring + lw * 0.4 + archRise({ r: lw / 2, pointed: 0.8 }) + (H - lw * 0.4 - archRise({ r: lw / 2, pointed: 0.8 })) * 0.4;
    ring(tr, o, u, uc, cy, Math.min(half * 0.5, (spring + H - cy) * 0.7), bw, bd);
  }
  bag.add(el.mat || 'limestone', fromTriangles(tr));
}
function ring(out, o, u, uc, yc, r, w, d) {
  const n = 20;
  barsInPlane(out, o, u, Array.from({ length: n + 1 }, (_, k) => [uc + r * Math.cos(2 * Math.PI * k / n), yc + r * Math.sin(2 * Math.PI * k / n)]), w, d);
}

/** A rose window in a wall plane { o, u, uc, yc, r, spokes } — glass, a ring and radiating tracery. */
function rose(el, { bag }) {
  const { o, u, uc, yc, r } = el, inS = el.inSide ?? 1, n = [-u[1], u[0]];
  const disc = (off, mat) => {
    const tris = [], N = 40;
    const W = (uu, yy, s) => [o[0] + u[0] * uu + n[0] * s, yy, o[1] + u[1] * uu + n[1] * s];
    for (let k = 0; k < N; k++) {
      const a = 2 * Math.PI * k / N, b = 2 * Math.PI * (k + 1) / N;
      const C = W(uc, yc, off), A = W(uc + r * Math.cos(a), yc + r * Math.sin(a), off), B = W(uc + r * Math.cos(b), yc + r * Math.sin(b), off);
      tris.push(...C, ...A, ...B, ...C, ...B, ...A);
    }
    bag.add(mat, fromTriangles(tris));
  };
  disc(inS * 0.015, 'stained_glass'); disc(-inS * 0.015, 'glass_outer');
  const tr = [];
  ring(tr, o, u, uc, yc, r, 0.3, 0.4);
  ring(tr, o, u, uc, yc, r * 0.3, 0.2, 0.36);
  const S = el.spokes || 12;
  for (let k = 0; k < S; k++) {
    const a = 2 * Math.PI * k / S;
    barsInPlane(tr, o, u, [[uc + Math.cos(a) * r * 0.3, yc + Math.sin(a) * r * 0.3], [uc + Math.cos(a) * r, yc + Math.sin(a) * r]], 0.16, 0.34);
    ring(tr, o, u, uc + Math.cos(a + Math.PI / S) * r * 0.72, yc + Math.sin(a + Math.PI / S) * r * 0.72, r * 0.16, 0.1, 0.3);
  }
  bag.add(el.mat || 'limestone', fromTriangles(tr));
}

/** A stepped buttress { at [x, z], dir [dx, dz] (outward), w, d (projection), y0, y1, steps, pinnacle }. */
function buttress(el, { bag, col }) {
  const [x, z] = el.at, [dx, dz] = el.dir, sx = -dz, sz = dx, w = el.w / 2;
  const steps = el.steps || 3, H = el.y1 - el.y0;
  for (let k = 0; k < steps; k++) {
    const d = el.d * (1 - k / (steps + 0.5)), ya = el.y0 + H * k / steps, yb = el.y0 + H * (k + 1) / steps;
    const P = (s, t, y) => [x + sx * s + dx * t, y, z + sz * s + dz * t];
    const out = [];
    hexa(out, [P(-w, 0, ya), P(w, 0, ya), P(w, d, ya), P(-w, d, ya)], [P(-w, 0, yb), P(w, 0, yb), P(w, d, yb), P(-w, d, yb)]);
    // a sloping weathering at each set-back
    const d2 = el.d * (1 - (k + 1) / (steps + 0.5));
    if (k < steps - 1) hexa(out, [P(-w, d2, yb), P(w, d2, yb), P(w, d, yb), P(-w, d, yb)], [P(-w, d2, yb + 0.6), P(w, d2, yb + 0.6), P(w, d2 + 0.01, yb + 0.6), P(-w, d2 + 0.01, yb + 0.6)]);
    bag.add(el.mat || 'limestone', fromTriangles(out));
    if (k === 0) col.obstacles.push({ poly: [[x - sx * w, z - sz * w], [x + sx * w, z + sz * w], [x + sx * w + dx * d, z + sz * w + dz * d], [x - sx * w + dx * d, z - sz * w + dz * d]].map((p) => [p[0], p[1]]), y0: el.y0, y1: el.y1 });
  }
  if (el.pinnacle) {
    const d = el.d * (1 - (steps - 1) / (steps + 0.5)) / 2, px = x + dx * d, pz = z + dz * d, r = Math.min(w, d) * 1.1;
    bag.add(el.mat || 'limestone', lathe([[r, 0], [r, 1.6], [r * 1.15, 1.75], [r * 0.9, 1.9], [0.04, el.pinnacle]], 4, null, px, el.y1, pz).rotateY(0));
    bag.add('gold', lathe([[0.12, 0], [0.2, 0.2], [0.001, 0.45]], 6, null, px, el.y1 + el.pinnacle, pz));
  }
}

/** A gable over a window in a wall plane { o, u, uc, w, y0, h, th, off }. */
function gable(el, { bag }) {
  const { o, u, uc, w, y0, h } = el, n = [-u[1], u[0]], off = el.off || 0, t = (el.th || 0.4) / 2;
  const W = (uu, yy, s) => [o[0] + u[0] * uu + n[0] * (off + s), yy, o[1] + u[1] * uu + n[1] * (off + s)];
  const tris = [];
  const q = (a, b, c, d) => tris.push(...a, ...b, ...c, ...a, ...c, ...d);
  const L = [uc - w / 2, y0], R = [uc + w / 2, y0], T = [uc, y0 + h];
  for (const s of [-t, t]) tris.push(...W(L[0], L[1], s), ...W(R[0], R[1], s), ...W(T[0], T[1], s));
  for (const [a, b] of [[L, R], [R, T], [T, L]]) q(W(a[0], a[1], -t), W(b[0], b[1], -t), W(b[0], b[1], t), W(a[0], a[1], t));
  bag.add(el.mat || 'limestone', fromTriangles(orientOutward(tris)));
  const tip = W(T[0], T[1], 0);
  bag.add('gold', lathe([[0.16, 0], [0.24, 0.3], [0.001, 0.8]], 6, null, tip[0], tip[1], tip[2]));
}

/** A steep gable roof along x { x0, x1, z0, z1, y (eaves), ridge, mat } with its end triangles. */
function gableRoof(el, { bag }) {
  const { x0, x1, z0, z1, y, ridge } = el, zm = (z0 + z1) / 2;
  const tris = [];
  const q = (a, b, c, d) => tris.push(...a, ...b, ...c, ...a, ...c, ...d);
  q([x0, y, z0], [x1, y, z0], [x1, ridge, zm], [x0, ridge, zm]);
  q([x0, y, z1], [x0, ridge, zm], [x1, ridge, zm], [x1, y, z1]);
  if (el.ends !== false) { tris.push(x0, y, z0, x0, ridge, zm, x0, y, z1); tris.push(x1, y, z0, x1, y, z1, x1, ridge, zm); }
  q([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0]);
  bag.add(el.mat || 'lead', fromTriangles(orientOutward(tris)));
  // the gilt cresting along the ridge
  bag.add('gold', box(x0, ridge - 0.05, zm - 0.06, x1, ridge + 0.5, zm + 0.06));
}

/** The roof of a polygonal apse: a half-pyramid from the eave polygon to the end of the ridge. */
function apseRoof(el, { bag }) {
  const [cx, cz] = el.c, n = el.sides, a0 = el.a0 * D2R, a1 = el.a1 * D2R, R = el.R, y = el.y, apex = [cx, el.ridge, cz];
  const tris = [];
  for (let k = 0; k < n; k++) {
    const a = a0 + (a1 - a0) * k / n, b = a0 + (a1 - a0) * (k + 1) / n;
    const A = [cx + Math.cos(a) * R, y, cz + Math.sin(a) * R], B = [cx + Math.cos(b) * R, y, cz + Math.sin(b) * R];
    tris.push(...A, ...B, ...apex, ...A, ...[cx, y, cz], ...B);
  }
  tris.push(cx + Math.cos(a0) * R, y, cz + Math.sin(a0) * R, ...apex, cx, y, cz);
  tris.push(cx + Math.cos(a1) * R, y, cz + Math.sin(a1) * R, cx, y, cz, ...apex);
  bag.add(el.mat || 'lead', fromTriangles(orientOutward(tris)));
}

/** A slender octagonal spire { at [x, z], y, h, r }: a pierced lantern, then the needle. */
function spire(el, { bag }) {
  const [x, z] = el.at, y = el.y, h = el.h, r = el.r;
  bag.add('lead', lathe([[r, 0], [r, h * 0.22], [r * 1.12, h * 0.24], [r * 0.82, h * 0.27], [r * 0.82, h * 0.36], [r * 0.95, h * 0.38], [0.05, h]], 8, null, x, y, z));
  bag.add('gold', lathe([[0.1, 0], [0.32, 0.25], [0.12, 0.5], [0.04, 1.6], [0.001, 1.7]], 8, null, x, y + h, z));
}

/** A round tower with a conical roof { at [x, z], y, r, h, roof }. */
function tower(el, { bag, col }) {
  const [x, z] = el.at, y = el.y ?? 0;
  bag.add(el.mat || 'limestone', lathe([[el.r + 0.4, 0], [el.r + 0.2, 1.5], [el.r, 1.6], [el.r, el.h], [el.r + 0.35, el.h + 0.1], [el.r + 0.35, el.h + 0.9]], 24, null, x, y, z));
  bag.add(el.roofMat || 'lead', lathe([[el.r + 0.6, 0], [0.05, el.roof], [0.001, el.roof + 0.1]], 24, null, x, y + el.h + 0.9, z));
  col.circle(x, z, el.r + 0.4, y, y + el.h);
}

/** A standing figure on a corbel (an apostle) { at [x, z], y, yaw, h }: a stylised body in robes. */
function statue(el, { bag }) {
  const [x, z] = el.at, y = el.y, h = el.h || 1.9;
  bag.add('limestone', lathe([[0.001, -0.5], [0.28, -0.3], [0.34, 0]], 8, null, x, y, z));
  bag.add(el.robe || 'paint_robe', lathe([[0.3, 0], [0.27, h * 0.3], [0.22, h * 0.62], [0.24, h * 0.76], [0.16, h * 0.82], [0.001, h * 0.82]], 12, null, x, y, z));
  bag.add('ivory', lathe([[0.001, h * 0.82], [0.1, h * 0.86], [0.12, h * 0.93], [0.001, h]], 10, null, x, y, z));
}

registerStyle('gothic', {
  column: (el, ctx) => {
    // a slender column of the lower chapel: round base, painted shaft, crocket capital, square abacus
    const [x, z] = el.at, y = el.y, h = el.h, r = el.d / 2;
    ctx.bag.add('limestone', lathe([[r * 1.8, 0], [r * 1.8, 0.3], [r * 1.35, 0.42], [r * 1.1, 0.6]], 12, null, x, y, z));
    ctx.bag.add(el.shaftMat || 'paint_fleur', lathe([[r, 0], [r, h - 1.3]], 16, null, x, y + 0.6, z));
    ctx.bag.add('gold', lathe([[r, 0], [r * 1.15, 0.2], [r * 1.6, 0.55], [r * 2.0, 0.6]], 12, null, x, y + h - 0.7, z));
    ctx.bag.add('limestone', box(x - r * 2.1, y + h - 0.1, z - r * 2.1, x + r * 2.1, y + h, z + r * 2.1));
    ctx.col.circle(x, z, r * 1.6, y, y + h);
  },
  trim: () => {},
  opening: () => {},
  elements: { ...byzantineElements, rib_vault: ribVault, apse_vault: apseVault, gothic_window: gothicWindow, rose, buttress, gable, gable_roof: gableRoof, apse_roof: apseRoof, spire, tower, statue_el: statue },
  objects: { doors },
});

