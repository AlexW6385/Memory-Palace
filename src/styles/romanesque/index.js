// Romanesque architecture (southern France, late 11th – early 12th century): the vocabulary of the
// pilgrimage church of Sainte-Foy at Conques. Round arches; tunnel (barrel) vaults on transverse
// arches; half-barrels over the tribunes to carry the thrust; groin-less, heavy walls with small
// round-headed windows; piers of square cores with four half-columns and carved block capitals;
// apses and chapels under half-domes; a crossing lantern; roofs of schist slabs (lauzes) at a
// moderate pitch; a portal with a carved and painted tympanum. Planar walls (round arches,
// windows), arc walls and sphere patches come from the shared Byzantine vocabulary.

import { registerStyle } from '../../core/build.js';
import { box, lathe, frustum, fromTriangles, orientOutward } from '../../core/geom.js';
import { byzantineElements } from '../byzantine/index.js';
import { doors } from '../greek/objects.js';

const D2R = Math.PI / 180;

/** Convex hexahedron from 8 corners (bottom 4, top 4, same order) → triangles, outward. */
function hexa(out, b, t) {
  const tris = [];
  const q = (a, b2, c, d) => tris.push(...a, ...b2, ...c, ...a, ...c, ...d);
  q(b[0], b[1], b[2], b[3]); q(t[0], t[3], t[2], t[1]);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; q(b[i], t[i], t[j], b[j]); }
  out.push(...orientOutward(tris));
}

// ── vaults ───────────────────────────────────────────────────────────────────

/**
 * A tunnel vault (or part of one): a cylindrical shell along `axis` ('x' or 'z') from s0 to s1,
 * its axis at `c` (the other horizontal coordinate) and height y (the springing); intrados r,
 * thickness th; the arc from a0 to a1 degrees (0: toward +c side horizontally, 90: the crown,
 * 180: toward −c). A half-barrel over a tribune is a quarter: 0–90 or 90–180.
 */
function barrel(el, { bag }) {
  const a0 = (el.a0 ?? 0) * D2R, a1 = (el.a1 ?? 180) * D2R, r0 = el.r, r1 = el.r + (el.th ?? 0.6);
  const n = Math.max(2, Math.round(Math.abs(a1 - a0) / (Math.PI / 24)));
  const P = (r, a, s) => (el.axis === 'x' ? [s, el.y + r * Math.sin(a), el.c + r * Math.cos(a)] : [el.c + r * Math.cos(a), el.y + r * Math.sin(a), s]);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * i / n, b = a0 + (a1 - a0) * (i + 1) / n;
    hexa(out, [P(r0, a, el.s0), P(r1, a, el.s0), P(r1, b, el.s0), P(r0, b, el.s0)], [P(r0, a, el.s1), P(r1, a, el.s1), P(r1, b, el.s1), P(r0, b, el.s1)]);
  }
  bag.add(el.mat || 'limestone_yellow', fromTriangles(out));
}

// ── supports ─────────────────────────────────────────────────────────────────

/** Block capital of the Romanesque Corinthian kind, round below and square above, with its abacus. */
function capital(bag, mat, x, y, z, r, h) {
  bag.add(mat, lathe([[r * 0.95, 0], [r * 1.0, h * 0.12]], 16, null, x, y, z));
  const sq = r * 1.35;
  bag.add(mat, frustum([x - r, z - r, x + r, z + r], y + h * 0.12, y + h * 0.82, -(sq - r), -(sq - r), -(sq - r), -(sq - r)));
  bag.add(mat, box(x - sq - 0.05, y + h * 0.82, z - sq - 0.05, x + sq + 0.05, y + h, z + sq + 0.05));
}

/** Column: square plinth, torus base, shaft, block capital and abacus { at, y, h, d, mat, capMat }. */
function column(el, { bag, col }) {
  const [x, z] = el.at, y = el.y ?? 0, d = el.d, r = d / 2, h = el.h;
  const mat = el.mat || el.shaftMat || 'limestone_yellow', capMat = el.capMat || mat;
  const baseH = 0.5 * d, capH = 0.85 * d;
  bag.add(mat, box(x - r * 1.3, y, z - r * 1.3, x + r * 1.3, y + baseH * 0.35, z + r * 1.3));
  bag.add(mat, lathe([[r * 1.25, 0], [r * 1.22, baseH * 0.3], [r * 1.05, baseH * 0.45], [r * 1.0, baseH * 0.6], [r * 1.0, baseH * 0.65]], 16, null, x, y + baseH * 0.35, z));
  bag.add(mat, lathe([[r, 0], [r * 0.96, h - baseH - capH]], 16, null, x, y + baseH, z));
  capital(bag, capMat, x, y + h - capH, z, r, capH);
  if (el.collide !== false) col.circle(x, z, r * 1.1, y, y + h);
}

/**
 * A pier of the nave or transept: a square core (half-size s) with a half-column on each face
 * (radius hr) up to `cap` (where their capitals stand), the core rising on to y1 (under the
 * transverse arch). { at [x, z], s, hr, y0, cap, y1, mat, faces ('nesw' — which faces carry one) }
 */
function pier(el, { bag, col }) {
  const [x, z] = el.at, s = el.s, hr = el.hr ?? 0.22, y0 = el.y0 ?? 0, cap = el.cap, y1 = el.y1 ?? cap;
  const mat = el.mat || 'limestone_yellow';
  bag.add(el.baseMat || mat, box(x - s - 0.12, y0, z - s - 0.12, x + s + 0.12, y0 + 0.4, z + s + 0.12));
  bag.add(mat, box(x - s, y0 + 0.4, z - s, x + s, y1, z + s));
  const faces = el.faces || 'nesw', capH = Math.min(0.75, hr * 3.2);
  const at = { n: [x, z - s], s: [x, z + s], e: [x + s, z], w: [x - s, z] };
  for (const f of faces) {
    const [hx, hz] = at[f];
    bag.add(mat, lathe([[hr * 1.25, 0], [hr * 1.15, 0.25], [hr, 0.35], [hr, cap - capH - y0 - 0.4]], 12, null, hx, y0 + 0.4, hz));
    capital(bag, el.capMat || mat, hx, cap - capH, hz, hr, capH);
  }
  col.rect([x - s - hr, z - s - hr, x + s + hr, z + s + hr], y0, y1);
}

// ── roofs ────────────────────────────────────────────────────────────────────

/** A gable roof with its ridge along `axis` ('x' default or 'z') { x0, x1, z0, z1, y, ridge, ends, mat }. */
function gableRoof(el, { bag }) {
  const { x0, x1, z0, z1, y, ridge } = el;
  const tris = [];
  const q = (a, b, c, d) => tris.push(...a, ...b, ...c, ...a, ...c, ...d);
  if ((el.axis || 'x') === 'x') {
    const zm = (z0 + z1) / 2;
    q([x0, y, z0], [x1, y, z0], [x1, ridge, zm], [x0, ridge, zm]);
    q([x0, y, z1], [x0, ridge, zm], [x1, ridge, zm], [x1, y, z1]);
    if (el.ends !== false) { tris.push(x0, y, z0, x0, ridge, zm, x0, y, z1); tris.push(x1, y, z0, x1, y, z1, x1, ridge, zm); }
  } else {
    const xm = (x0 + x1) / 2;
    q([x0, y, z0], [x0, y, z1], [xm, ridge, z1], [xm, ridge, z0]);
    q([x1, y, z0], [xm, ridge, z0], [xm, ridge, z1], [x1, y, z1]);
    if (el.ends !== false) { tris.push(x0, y, z0, xm, ridge, z0, x1, y, z0); tris.push(x0, y, z1, x1, y, z1, xm, ridge, z1); }
  }
  q([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0]);
  bag.add(el.mat || 'lauze', fromTriangles(orientOutward(tris)));
}

/** A lean-to roof over rect, falling toward side `low` ('n','s','e','w') from y1 to y0. */
function leanRoof(el, { bag }) {
  const [x0, z0, x1, z1] = el.rect, lo = el.y0, hi = el.y1, t = el.th ?? 0.25;
  const hAt = (x, z) => {
    if (el.low === 'n') return lo + (hi - lo) * (z - z0) / (z1 - z0);
    if (el.low === 's') return lo + (hi - lo) * (z1 - z) / (z1 - z0);
    if (el.low === 'w') return lo + (hi - lo) * (x - x0) / (x1 - x0);
    return lo + (hi - lo) * (x1 - x) / (x1 - x0);
  };
  const c = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const out = [];
  hexa(out, c.map(([x, z]) => [x, hAt(x, z) - t, z]), c.map(([x, z]) => [x, hAt(x, z), z]));
  bag.add(el.mat || 'lauze', fromTriangles(out));
}

/**
 * A half-cone (or part of a cone) over an apse { c [x, z], R, a0, a1 (deg), y, apex, mat }; with r0
 * a ring only, from radius r0 at the apex's height down to R (the roof of an ambulatory).
 */
function coneRoof(el, { bag }) {
  const [cx, cz] = el.c, a0 = el.a0 * D2R, a1 = el.a1 * D2R, n = el.seg || 16;
  if (el.r0) {
    const out = [], t = el.th ?? 0.3, P = (r, a, y) => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
    for (let k = 0; k < n; k++) {
      const a = a0 + (a1 - a0) * k / n, b = a0 + (a1 - a0) * (k + 1) / n;
      hexa(out, [P(el.r0, a, el.apex - t), P(el.R, a, el.y - t), P(el.R, b, el.y - t), P(el.r0, b, el.apex - t)], [P(el.r0, a, el.apex), P(el.R, a, el.y), P(el.R, b, el.y), P(el.r0, b, el.apex)]);
    }
    bag.add(el.mat || 'lauze', fromTriangles(out));
    return;
  }
  const tris = [], A = [cx, el.apex, cz], C = [cx, el.y, cz];
  for (let k = 0; k < n; k++) {
    const a = a0 + (a1 - a0) * k / n, b = a0 + (a1 - a0) * (k + 1) / n;
    const P = [cx + Math.cos(a) * el.R, el.y, cz + Math.sin(a) * el.R], Q = [cx + Math.cos(b) * el.R, el.y, cz + Math.sin(b) * el.R];
    tris.push(...P, ...Q, ...A, ...P, ...C, ...Q);
  }
  if (a1 - a0 < Math.PI * 2 - 1e-3) {
    const P = [cx + Math.cos(a0) * el.R, el.y, cz + Math.sin(a0) * el.R], Q = [cx + Math.cos(a1) * el.R, el.y, cz + Math.sin(a1) * el.R];
    tris.push(...P, ...A, ...C, ...Q, ...C, ...A);
  }
  bag.add(el.mat || 'lauze', fromTriangles(orientOutward(tris)));
}

/** A pyramid roof of `sides` faces { c [x, z], r (to the corners), y, apex, rot (deg), mat }. */
function pyramidRoof(el, { bag }) {
  const [cx, cz] = el.c, n = el.sides || 4, rot = (el.rot ?? 45) * D2R;
  const tris = [], A = [cx, el.apex, cz];
  for (let k = 0; k < n; k++) {
    const a = rot + 2 * Math.PI * k / n, b = rot + 2 * Math.PI * (k + 1) / n;
    const P = [cx + Math.cos(a) * el.r, el.y, cz + Math.sin(a) * el.r], Q = [cx + Math.cos(b) * el.r, el.y, cz + Math.sin(b) * el.r];
    tris.push(...P, ...Q, ...A, ...P, ...[cx, el.y, cz], ...Q);
  }
  bag.add(el.mat || 'lauze', fromTriangles(orientOutward(tris)));
}

// ── the portal ───────────────────────────────────────────────────────────────

/**
 * The tympanum over a west portal, carved in three registers and painted (L2 massing):
 * { x (the face of the wall), zc, y (top of the doorway: the lintel's underside), w, h, depth }.
 * The figures face −x (west). Archivolts round it.
 */
function tympanum(el, { bag }) {
  const { x, zc, y } = el, R = el.w / 2, lint = el.h - R, n = 24;
  // the lintel and the half-disc of the tympanum, set back in the portal
  bag.add('limestone_yellow', box(x, y, zc - R, x + 0.5, y + lint, zc + R));
  const disc = [];
  for (let i = 0; i < n; i++) {
    const a = Math.PI * i / n, b = Math.PI * (i + 1) / n;
    const P = (r, t, xx) => [xx, y + lint + r * Math.sin(t), zc + r * Math.cos(t)];
    hexa(disc, [P(0.01, a, x), P(R, a, x), P(R, b, x), P(0.01, b, x)], [P(0.01, a, x + 0.5), P(R, a, x + 0.5), P(R, b, x + 0.5), P(0.01, b, x + 0.5)]);
  }
  bag.add('paint_blue', fromTriangles(disc));
  // the registers: two bands across, the lintel divided in two (heaven and hell)
  const yb = y + lint;
  for (const yy of [yb + 0.95, yb + 1.85]) {
    const half = Math.sqrt(Math.max(0, R * R - (yy - yb) ** 2)) - 0.1;
    bag.add('paint_ochre', box(x - 0.12, yy - 0.08, zc - half, x, yy + 0.06, zc + half));
  }
  bag.add('paint_ochre', box(x - 0.12, y + lint - 0.08, zc - R, x, y + lint + 0.06, zc + R));
  // Christ in majesty in the mandorla at the centre, over two registers
  const mand = [];
  for (let i = 0; i < 20; i++) {
    const a = 2 * Math.PI * i / 20, b = 2 * Math.PI * (i + 1) / 20;
    const P = (t, xx) => [xx, yb + 1.45 + 1.05 * Math.sin(t), zc + 0.62 * Math.cos(t)];
    hexa(mand, [[x - 0.05, yb + 1.45, zc], P(a, x - 0.05), P(b, x - 0.05), [x - 0.05, yb + 1.45, zc]], [[x - 0.14, yb + 1.45, zc], P(a, x - 0.14), P(b, x - 0.14), [x - 0.14, yb + 1.45, zc]]);
  }
  bag.add('gold', fromTriangles(mand));
  const fig = (zz, yy, hh, robe) => {
    bag.add(robe, lathe([[0.001, 0], [0.13, 0.02], [0.12, hh * 0.6], [0.09, hh * 0.78], [0.001, hh * 0.8]], 6, null, x - 0.14, yy, zz));
    bag.add('ivory', lathe([[0.001, hh * 0.8], [0.06, hh * 0.86], [0.001, hh]], 6, null, x - 0.14, yy, zz));
  };
  fig(zc, yb + 0.95, 1.05, 'wall_red');
  // the rows of figures: the elect on Christ's right (south, +z seen from the west… his right is
  // the viewer's left: −z), the damned on his left; angels and saints above
  const rows = [[y + 0.06, lint - 0.12, 0.35], [yb + 0.1, 0.8, 0.42], [yb + 1.0, 0.8, 0.4]];
  rows.forEach(([yy, hh, step], ri) => {
    const half = ri === 0 ? R - 0.2 : Math.sqrt(Math.max(0, R * R - (yy + hh - yb) ** 2)) - 0.2;
    for (let zz = -half; zz <= half + 1e-6; zz += step) {
      if (ri > 0 && Math.abs(zz) < 0.75) continue;
      fig(zc + zz, yy, hh, (Math.round(zz / step) + ri) % 2 ? 'wall_red' : 'paint_ochre');
    }
  });
  // the archivolts: three rings of voussoirs round the tympanum, stepping out
  for (let k = 0; k < 3; k++) {
    const r0 = R + 0.05 + k * 0.32, r1 = r0 + 0.3, d0 = x - 0.25 - k * 0.35, d1 = x + 0.5;
    const out = [];
    for (let i = 0; i < 24; i++) {
      const a = Math.PI * i / 24, b = Math.PI * (i + 1) / 24;
      const P = (r, t, xx) => [xx, yb + r * Math.sin(t), zc + r * Math.cos(t)];
      hexa(out, [P(r0, a, d0), P(r1, a, d0), P(r1, b, d0), P(r0, b, d0)], [P(r0, a, d1), P(r1, a, d1), P(r1, b, d1), P(r0, b, d1)]);
    }
    bag.add(k === 1 ? 'sandstone_red' : 'limestone_yellow', fromTriangles(out));
  }
}

/** An iron grille between two points { a [x, z], b, y0, y1, step }: bars and rails. */
function grille(el, { bag, col }) {
  const [ax, az] = el.a, [bx, bz] = el.b, L = Math.hypot(bx - ax, bz - az), y0 = el.y0 ?? 0, y1 = el.y1 ?? 2.4;
  const ux = (bx - ax) / L, uz = (bz - az) / L, st = el.step ?? 0.16;
  const parts = [];
  for (let s = 0; s <= L; s += st) {
    const x = ax + ux * s, z = az + uz * s;
    parts.push(box(x - 0.015, y0, z - 0.015, x + 0.015, y1, z + 0.015));
  }
  for (const yy of [y0 + 0.1, (y0 + y1) / 2, y1 - 0.05]) {
    const g = lathe([[0.03, 0], [0.03, L]], 6, null, 0, 0, 0);
    g.rotateZ(-Math.PI / 2); g.rotateY(-Math.atan2(uz, ux)); g.translate(ax, yy, az);
    parts.push(g);
  }
  for (const p of parts) bag.add('iron', p);
  col.segment(el.a, el.b, 0.1, y0, y1);
}

// ── objects ──────────────────────────────────────────────────────────────────

/** The reliquary statue of Sainte Foy: a small seated figure in gold on a pillar { at, y }. */
function reliquary(el, { bag, col }) {
  const [x, z] = el.at, y = el.y;
  bag.add('limestone_yellow', box(x - 0.35, y, z - 0.35, x + 0.35, y + 1.2, z + 0.35));
  bag.add('gold', box(x - 0.22, y + 1.2, z - 0.2, x + 0.22, y + 1.55, z + 0.2));               // the throne
  bag.add('gold', lathe([[0.17, 0], [0.15, 0.35], [0.1, 0.45], [0.001, 0.46]], 10, null, x, y + 1.55, z));
  bag.add('gold', lathe([[0.001, 0], [0.09, 0.05], [0.1, 0.16], [0.07, 0.24], [0.001, 0.26]], 10, null, x, y + 2.0, z));
  col.rect([x - 0.35, z - 0.35, x + 0.35, z + 0.35], y, y + 2.3);
}

/** The cloister's basin of green serpentine, round, on a low step { at, y, d }. */
function basin(el, { bag, col }) {
  const [x, z] = el.at, y = el.y ?? 0, r = (el.d ?? 2.72) / 2;
  bag.add('limestone_yellow', lathe([[r + 0.5, 0], [r + 0.5, 0.18], [r + 0.2, 0.18], [r + 0.2, 0.2]], 24, null, x, y, z));
  bag.add('serpentine', lathe([[r * 0.25, 0.2], [r * 0.3, 0.35], [r * 0.95, 0.55], [r, 0.85], [r * 0.92, 0.85], [r * 0.9, 0.5], [r * 0.2, 0.42]], 24, null, x, y, z));
  bag.add('water', lathe([[r * 0.9, 0.72], [0.001, 0.72]], 24, null, x, y, z));
  col.circle(x, z, r, y, y + 0.85);
}

registerStyle('romanesque', {
  column,
  trim: () => {},
  opening: () => {},
  elements: { ...byzantineElements, barrel, pier, gable_roof: gableRoof, lean_roof: leanRoof, cone_roof: coneRoof, pyramid_roof: pyramidRoof, tympanum, grille },
  objects: { doors, reliquary, basin },
});
