// The Roman architectural vocabulary (Imperial, 2nd century AD): the Corinthian order, the
// entablature with modillions, round walls with niches, the coffered dome.
import { Matrix4 } from 'three';
import { registerStyle, orientedBox } from '../../core/build.js';
import { box, lathe, disc, fromTriangles, quad, orientOutward, GeoBag } from '../../core/geom.js';
import { merge } from '../greek/columns.js';
import { pedimentRoof } from '../greek/order.js';
import { doors } from '../greek/objects.js';

const TAU = Math.PI * 2;

/** Make every triangle face toward (outward = false) or away from (true) a centre point. */
function orientRadial(t, c, outward) {
  for (let i = 0; i < t.length; i += 9) {
    const ux = t[i + 3] - t[i], uy = t[i + 4] - t[i + 1], uz = t[i + 5] - t[i + 2];
    const vx = t[i + 6] - t[i], vy = t[i + 7] - t[i + 1], vz = t[i + 8] - t[i + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const mx = (t[i] + t[i + 3] + t[i + 6]) / 3 - c[0], my = (t[i + 1] + t[i + 4] + t[i + 7]) / 3 - c[1], mz = (t[i + 2] + t[i + 5] + t[i + 8]) / 3 - c[2];
    if ((nx * mx + ny * my + nz * mz > 0) !== outward) for (let k = 0; k < 3; k++) { const q = t[i + 3 + k]; t[i + 3 + k] = t[i + 6 + k]; t[i + 6 + k] = q; }
  }
  return t;
}

// ── the Corinthian column ─────────────────────────────────────────────────────

/**
 * Corinthian column: square plinth, Attic base, shaft (smooth monolith, or fluted), capital of
 * two rows of eight acanthus leaves, caulicoli and corner volutes under a concave abacus.
 * el = { at, y, h (plinth to top of abacus), d (lower shaft diameter), fluted, mat, shaftMat }
 */
function corinthianColumn(el, { bag, col }) {
  const [x, z] = el.at, y = el.y ?? 0, H = el.h, R = el.d / 2;
  const mat = el.mat || 'marble', shaftMat = el.shaftMat || mat;
  const plH = R * 0.5, bH = R * 0.55, capH = R * 2.3;
  const shaftH = H - plH - bH - capH;
  const parts = [], shaft = [];
  parts.push(box(-R * 1.45, 0, -R * 1.45, R * 1.45, plH, R * 1.45));
  parts.push(lathe([[R * 1.4, 0], [R * 1.42, bH * 0.25], [R * 1.28, bH * 0.36], [R * 1.18, bH * 0.5], [R * 1.24, bH * 0.6], [R * 1.22, bH * 0.8], [R * 1.08, bH * 0.92], [R * 1.02, bH]], 40, null, 0, plH, 0));
  const top = R * 0.86;
  const prof = [[R * 1.04, 0], [R, 0.12]];
  for (let i = 1; i <= 8; i++) { const t = i / 8; prof.push([R + (top - R) * Math.pow(t, 1.4), 0.12 + (shaftH - 0.3) * t]); }
  prof.push([top * 1.05, shaftH - 0.06], [top * 1.08, shaftH]);
  const fl = el.fluted ? (th) => { const u = ((th / TAU) * 24) % 1; const v = (u - 0.09) / 0.82; return v < 0 || v > 1 ? 1 : 1 - 0.05 * Math.sqrt(Math.max(0, 1 - (2 * v - 1) ** 2)); } : null;
  shaft.push(lathe(prof, el.fluted ? 24 * 8 : 32, fl, 0, plH + bH, 0));
  // capital: the bell with two rows of acanthus, then volutes and the concave abacus
  const c0 = plH + bH + shaftH;
  const leaves = (th, i, r, yy) => {
    const row = yy < capH * 0.38 ? 0 : 1;
    const ph = row === 0 ? 0 : Math.PI / 8;
    const lobe = Math.pow(Math.abs(Math.cos((th + ph) * 4)), 0.6);
    const tip = Math.max(0, Math.sin(Math.PI * (row === 0 ? yy / (capH * 0.38) : (yy - capH * 0.3) / (capH * 0.38))));
    return 1 + 0.16 * lobe * tip + 0.03 * Math.cos(th * 40) * tip;
  };
  const bell = [[top, 0], [top * 1.02, capH * 0.1], [top * 1.06, capH * 0.25], [top * 1.1, capH * 0.38], [top * 1.12, capH * 0.5], [top * 1.18, capH * 0.62], [top * 1.25, capH * 0.72], [top * 1.32, capH * 0.82], [top * 1.36, capH * 0.86], [0, capH * 0.86]];
  parts.push(lathe(bell, 96, leaves, 0, c0, 0));
  // corner volutes and the abacus with concave sides
  const aw = R * 1.5;
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + k * Math.PI / 2;
    const vx = Math.cos(a) * aw * 1.08, vz = Math.sin(a) * aw * 1.08;
    const v = lathe([[0, 0], [R * 0.16, R * 0.08], [R * 0.2, R * 0.25], [R * 0.14, R * 0.38], [0, R * 0.42]], 10, null, vx, c0 + capH * 0.72, vz);
    parts.push(v);
  }
  const abT = [];
  const n = 16, abY0 = c0 + capH * 0.86, abY1 = c0 + capH;
  const pt = (i) => {
    // a square whose sides curve inward, its corners cut
    const side = Math.floor(i / n), t = (i % n) / n;
    const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    const [ax, az] = corners[side], [bx, bz] = corners[(side + 1) % 4];
    const sag = 0.16 * Math.sin(Math.PI * t);
    let px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
    px -= Math.sign(px) * (Math.abs(ax - bx) < 1e-6 ? sag : 0);
    pz -= Math.sign(pz) * (Math.abs(az - bz) < 1e-6 ? sag : 0);
    return [px * aw, pz * aw];
  };
  const ring = Array.from({ length: n * 4 }, (_, i) => pt(i));
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    quad(abT, [p[0], abY0, p[1]], [q[0], abY0, q[1]], [q[0], abY1, q[1]], [p[0], abY1, p[1]]);
    abT.push(0, abY1, 0, q[0], abY1, q[1], p[0], abY1, p[1]);
    abT.push(0, abY0, 0, p[0], abY0, p[1], q[0], abY0, q[1]);
  }
  parts.push(fromTriangles(orientOutward(abT)));
  const m = new Matrix4().makeTranslation(x, y, z);
  const g = merge(parts); g.applyMatrix4(m); bag.add(mat, g);
  const s = merge(shaft); s.applyMatrix4(m); bag.add(shaftMat, s);
  col.circle(x, z, R * 1.08, y, y + H);
}

// ── entablature with modillions (straight runs) ───────────────────────────────

/**
 * Straight Roman entablature along a→b: three-fascia architrave, plain frieze (for an
 * inscription), cornice with dentils and modillions. el = { a, b, y, w (depth), h, mat, faces }
 */
function romanEntablature(el, { bag, col }) {
  const mat = el.mat || 'marble';
  const H = el.h, y = el.y, w = el.w;
  const ah = H * 0.36, fh = H * 0.3, ch = H - ah - fh;
  const parts = [];
  // architrave: three fasciae, each projecting a little more
  for (let k = 0; k < 3; k++) parts.push(orientedBox(el.a, el.b, w + k * 0.06, y + (ah / 3) * k, y + (ah / 3) * (k + 1)));
  parts.push(orientedBox(el.a, el.b, w + 0.16, y + ah - 0.06, y + ah));
  parts.push(orientedBox(el.a, el.b, w, y + ah, y + ah + fh));
  // cornice: dentil band, modillion zone, corona, sima
  const c0 = y + ah + fh;
  parts.push(orientedBox(el.a, el.b, w + 0.14, c0, c0 + ch * 0.12));
  parts.push(orientedBox(el.a, el.b, w + 0.3, c0 + ch * 0.12, c0 + ch * 0.3, 0));
  // dentils and modillions along both long faces
  const [ax, az] = el.a, [bx, bz] = el.b, L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux;
  for (const s of [-1, 1]) {
    if (el.faces && !el.faces.includes(s)) continue;
    for (let d = 0.1; d < L - 0.1; d += 0.24) {
      const c = [ax + ux * d + nx * s * (w / 2 + 0.2), az + uz * d + nz * s * (w / 2 + 0.2)];
      parts.push(orientedBox([c[0] - ux * 0.07, c[1] - uz * 0.07], [c[0] + ux * 0.07, c[1] + uz * 0.07], 0.12, c0 + ch * 0.12, c0 + ch * 0.28));
    }
    for (let d = 0.35; d < L - 0.2; d += 0.72) {
      const c = [ax + ux * d + nx * s * (w / 2 + 0.45), az + uz * d + nz * s * (w / 2 + 0.45)];
      parts.push(orientedBox([c[0] - ux * 0.12, c[1] - uz * 0.12], [c[0] + ux * 0.12, c[1] + uz * 0.12], 0.6, c0 + ch * 0.32, c0 + ch * 0.55));
    }
  }
  parts.push(orientedBox(el.a, el.b, w + 1.5, c0 + ch * 0.55, c0 + ch * 0.85, 0.75));
  parts.push(orientedBox(el.a, el.b, w + 1.6, c0 + ch * 0.85, c0 + ch, 0.8));
  for (const g of parts) bag.add(mat, g);
  col.segment(el.a, el.b, w, y, y + H);
}

// ── round walls, niches and the dome ──────────────────────────────────────────

/** Arc of an annulus as triangles: centre, radii, angles (radians, measured from +x toward +z), heights. */
function annulusArc(cx, cz, r0, r1, a0, a1, y0, y1, seg, caps = true) {
  const t = [];
  const n = Math.max(1, Math.ceil(seg * (a1 - a0) / TAU));
  const P = (r, a, y) => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * i / n, b = a0 + (a1 - a0) * (i + 1) / n;
    quad(t, P(r1, a, y0), P(r1, a, y1), P(r1, b, y1), P(r1, b, y0));     // outer face
    quad(t, P(r0, b, y0), P(r0, b, y1), P(r0, a, y1), P(r0, a, y0));     // inner face
    quad(t, P(r0, a, y1), P(r0, b, y1), P(r1, b, y1), P(r1, a, y1));     // top
    quad(t, P(r0, a, y0), P(r1, a, y0), P(r1, b, y0), P(r0, b, y0));     // bottom
  }
  if (caps) {
    quad(t, P(r0, a0, y0), P(r0, a0, y1), P(r1, a0, y1), P(r1, a0, y0));
    quad(t, P(r1, a1, y0), P(r1, a1, y1), P(r0, a1, y1), P(r0, a1, y0));
  }
  return t;
}

/**
 * Round wall (drum) with openings. el = { c: [x, z], r0 (inner radius), r1 (outer), y0, y1,
 *   gaps: [{ a (centre angle, degrees; 0 = north, clockwise), w (chord width at the inner face), y1 (top of the opening) }], seg }
 * Angles here are compass bearings: 0° north (−z), 90° east (+x).
 */
function ringWall(el, { bag, col }) {
  const [cx, cz] = el.c, mat = el.mat || 'brick';
  const toA = (deg) => (deg - 90) * Math.PI / 180;          // bearing → angle from +x toward +z
  const gaps = (el.gaps || []).map((g) => {
    const half = Math.asin(Math.min(0.99, g.w / 2 / el.r0));
    return { a0: toA(g.a) - half, a1: toA(g.a) + half, y1: g.y1 ?? el.y1, y0: g.y0 ?? el.y0 };
  }).sort((p, q) => p.a0 - q.a0);
  const pieces = [];
  let a = gaps.length ? gaps[gaps.length - 1].a1 - TAU : -Math.PI;
  const end = gaps.length ? gaps[gaps.length - 1].a1 : Math.PI;
  for (const g of gaps) { pieces.push([a, g.a0, el.y0, el.y1]); pieces.push([g.a0, g.a1, g.y1, el.y1]); if (g.y0 > el.y0) pieces.push([g.a0, g.a1, el.y0, g.y0]); a = g.a1; }
  if (!gaps.length) pieces.push([-Math.PI, Math.PI, el.y0, el.y1]);
  const tris = [];
  for (const [p, q, y0, y1] of pieces) {
    if (q - p < 1e-4 || y1 - y0 < 1e-4) continue;
    tris.push(...annulusArc(cx, cz, el.r0, el.r1, p, q, y0, y1, el.seg ?? 160));
    // colliders: short chords along the arc
    const n = Math.max(1, Math.ceil((q - p) / 0.12));
    for (let i = 0; i < n; i++) {
      const s = p + (q - p) * i / n, e = p + (q - p) * (i + 1) / n, m = (el.r0 + el.r1) / 2;
      col.segment([cx + Math.cos(s) * m, cz + Math.sin(s) * m], [cx + Math.cos(e) * m, cz + Math.sin(e) * m], el.r1 - el.r0, y0, y1);
    }
  }
  bag.add(mat, fromTriangles(tris));
}

/**
 * Niche (exedra) cut into a drum: a half-cylinder (semicircular) or a box (rectangular)
 * recess, lined, with a half-dome or flat ceiling. Two columns stand in its mouth.
 * el = { c, R (drum inner radius), bearing, kind: 'semi'|'rect', w, d (depth), y0, y1, mat }
 */
function niche(el, { bag, col }) {
  const [cx, cz] = el.c, mat = el.mat || 'marble';
  const a = (el.bearing - 90) * Math.PI / 180, ux = Math.cos(a), uz = Math.sin(a);      // outward
  const tx = -uz, tz = ux;                                                               // along the wall
  const mx = cx + ux * el.R, mz = cz + uz * el.R;                                        // mouth centre
  const w = el.w, d = el.d, y0 = el.y0, y1 = el.y1;
  const parts = [];
  if (el.kind === 'semi') {
    const r = w / 2, t = [];
    for (let i = 0; i < 12; i++) {
      const p = Math.PI * i / 12, q = Math.PI * (i + 1) / 12;
      const P = (ang) => [mx + (tx * Math.cos(ang) + ux * Math.sin(ang)) * (r + 0.3), mz + (tz * Math.cos(ang) + uz * Math.sin(ang)) * (r + 0.3)];
      col.segment(P(p), P(q), 0.6, y0, y1);
    }
    const n = 24;
    for (let i = 0; i < n; i++) {
      const p = Math.PI * i / n, q = Math.PI * (i + 1) / n;
      const P = (ang, y) => [mx + tx * Math.cos(ang) * r + ux * Math.sin(ang) * r, y, mz + tz * Math.cos(ang) * r + uz * Math.sin(ang) * r];
      quad(t, P(q, y0), P(q, y1), P(p, y1), P(p, y0));
      // half-dome
      for (let j = 0; j < 8; j++) {
        const e0 = (Math.PI / 2) * j / 8, e1 = (Math.PI / 2) * (j + 1) / 8;
        const D = (ang, e) => [mx + (tx * Math.cos(ang) + ux * Math.sin(ang)) * r * Math.cos(e), y1 + r * Math.sin(e), mz + (tz * Math.cos(ang) + uz * Math.sin(ang)) * r * Math.cos(e)];
        quad(t, D(p, e0), D(p, e1), D(q, e1), D(q, e0));
      }
    }
    // every surface faces the mouth of the niche, where the visitor stands
    parts.push(fromTriangles(orientRadial(t, [mx - ux * 0.5, (y0 + y1) / 2, mz - uz * 0.5], false)));
  } else {
    // rectangular recess: back wall and side walls, flat lintel ceiling
    const c = (s, o) => [mx + tx * s + ux * o, mz + tz * s + uz * o];
    col.segment(c(-w / 2, d + 0.15), c(w / 2, d + 0.15), 0.3, y0, y1);
    col.segment(c(-w / 2 - 0.15, -0.5), c(-w / 2 - 0.15, d), 0.3, y0, y1);
    col.segment(c(w / 2 + 0.15, -0.5), c(w / 2 + 0.15, d), 0.3, y0, y1);
    parts.push(orientedBox(c(-w / 2, d), c(w / 2, d), 0.3, y0, y1));
    parts.push(orientedBox(c(-w / 2, 0), c(-w / 2, d), 0.3, y0, y1));
    parts.push(orientedBox(c(w / 2, 0), c(w / 2, d), 0.3, y0, y1));
    parts.push(orientedBox(c(-w / 2, d / 2), c(w / 2, d / 2), d, y1, y1 + 0.6));
  }
  for (const g of parts) bag.add(mat, g);
}

/**
 * Coffered hemispherical dome: inner sphere radius R centred at (c, y), five rings of 28
 * coffers each stepped back four times, the smooth zone above, the open oculus; the outside
 * with step rings at its foot. el = { c, y (springing), R, thick (at the base), top (at the oculus),
 * oculus (radius), rings: [elevation bands in degrees], n (coffers per ring), mat, outMat }
 */
function cofferedDome(el, { bag }) {
  const [cx, cz] = el.c, y = el.y, R = el.R, n = el.n ?? 28;
  const mat = el.mat || 'concrete', outMat = el.outMat || 'bronze';
  const oc = el.oculus, eTop = Math.acos(oc / R);                    // elevation of the oculus rim
  const S = (r, az, e) => [cx + Math.cos(az) * Math.cos(e) * r, y + Math.sin(e) * r, cz + Math.sin(az) * Math.cos(e) * r];
  const inner = [];
  const bands = el.rings;                                             // [[e0, e1], ...] in degrees, bottom to top
  const step = el.step ?? 0.11, steps = 4;
  const dAz = TAU / n;
  // coffered zone: each coffer cell has a rib frame and four nested recessed frames
  for (const [b0, b1] of bands) {
    const e0 = b0 * Math.PI / 180, e1 = b1 * Math.PI / 180;
    const rib = (e1 - e0) * 0.16, ribAz = dAz * 0.16;
    for (let k = 0; k < n; k++) {
      const a0 = k * dAz, a1 = a0 + dAz;
      // frame pieces at radius R (the ribs), then each step inset and pushed back
      let A0 = a0, A1 = a1, E0 = e0, E1 = e1, r = R;
      const insetAz = (dAz - 2 * ribAz) / (2 * steps + 2.6), insetE = ((e1 - e0) - 2 * rib) / (2 * steps + 2.6);
      const frame = (oa0, oa1, oe0, oe1, ia0, ia1, ie0, ie1, ro, ri) => {
        // four trapezoids from the outer rectangle (at ro) to the inner one (at ri)
        quad(inner, S(ro, oa0, oe0), S(ro, oa1, oe0), S(ri, ia1, ie0), S(ri, ia0, ie0));
        quad(inner, S(ro, oa1, oe0), S(ro, oa1, oe1), S(ri, ia1, ie1), S(ri, ia1, ie0));
        quad(inner, S(ro, oa1, oe1), S(ro, oa0, oe1), S(ri, ia0, ie1), S(ri, ia1, ie1));
        quad(inner, S(ro, oa0, oe1), S(ro, oa0, oe0), S(ri, ia0, ie0), S(ri, ia0, ie1));
      };
      // the rib face (flat on the sphere)
      frame(A0, A1, E0, E1, A0 + ribAz, A1 - ribAz, E0 + rib * 1.4, E1 - rib * 0.6, r, r);
      A0 += ribAz; A1 -= ribAz; E0 += rib * 1.4; E1 -= rib * 0.6;
      for (let s = 0; s < steps; s++) {
        // riser (pushed back) then tread
        frame(A0, A1, E0, E1, A0, A1, E0, E1, r, r + step);
        r += step;
        // the lower edge steps more than the upper, so the coffers look true from the floor
        const nA0 = A0 + insetAz, nA1 = A1 - insetAz, nE0 = E0 + insetE * 1.35, nE1 = E1 - insetE * 0.65;
        frame(A0, A1, E0, E1, nA0, nA1, nE0, nE1, r, r);
        A0 = nA0; A1 = nA1; E0 = nE0; E1 = nE1;
      }
      // coffer back
      quad(inner, S(r, A0, E0), S(r, A1, E0), S(r, A1, E1), S(r, A0, E1));
    }
  }
  // smooth zones: below the first band, between, and above the last up to the oculus
  const smooth = (e0, e1) => {
    const NE = Math.max(1, Math.ceil((e1 - e0) / 0.05));
    for (let i = 0; i < NE; i++) for (let k = 0; k < n * 3; k++) {
      const p0 = e0 + (e1 - e0) * i / NE, p1 = e0 + (e1 - e0) * (i + 1) / NE, a0 = TAU * k / (n * 3), a1 = TAU * (k + 1) / (n * 3);
      quad(inner, S(R, a0, p0), S(R, a1, p0), S(R, a1, p1), S(R, a0, p1));
    }
  };
  const first = bands[0][0] * Math.PI / 180, last = bands[bands.length - 1][1] * Math.PI / 180;
  // a backing shell just behind the deepest coffers closes the hairline gaps between frames
  {
    const Rb = R + step * steps + 0.04, NE = 40;
    for (let i = 0; i < NE; i++) for (let k = 0; k < n * 3; k++) {
      const p0 = first + (last - first) * i / NE, p1 = first + (last - first) * (i + 1) / NE, a0 = TAU * k / (n * 3), a1 = TAU * (k + 1) / (n * 3);
      quad(inner, S(Rb, a0, p0), S(Rb, a1, p0), S(Rb, a1, p1), S(Rb, a0, p1));
    }
  }
  if (first > 0) smooth(0, first);
  smooth(last, eTop);
  // inside: everything faces a viewer standing on the floor below the centre
  bag.add(mat, fromTriangles(orientRadial(inner, [cx, y - R * 0.6, cz], false)));
  // the oculus rim (a bronze ring) and the dome's shell out to its outer surface
  const RT = R + el.top, ring = [];
  for (let k = 0; k < 64; k++) {
    const a0 = TAU * k / 64, a1 = TAU * (k + 1) / 64;
    quad(ring, S(R, a0, eTop), S(R, a1, eTop), [cx + Math.cos(a1) * oc, y + Math.sqrt(RT * RT - oc * oc), cz + Math.sin(a1) * oc], [cx + Math.cos(a0) * oc, y + Math.sqrt(RT * RT - oc * oc), cz + Math.sin(a0) * oc]);
  }
  bag.add('bronze', fromTriangles(ring));
  // outside: step rings at the foot, then the curved roof (tiles of gilded bronze)
  const out = [];
  const Ro = R + el.thick;
  const steps2 = el.outSteps || [];
  let yb = y, rb = Ro;
  for (const [ry, rr] of steps2) {
    // a vertical face then a flat tread
    for (let k = 0; k < 96; k++) {
      const a0 = TAU * k / 96, a1 = TAU * (k + 1) / 96;
      const P = (r, yy, a) => [cx + Math.cos(a) * r, yy, cz + Math.sin(a) * r];
      quad(out, P(rb, yb, a0), P(rb, yb, a1), P(rb, y + ry, a1), P(rb, y + ry, a0));
      quad(out, P(rb, y + ry, a0), P(rb, y + ry, a1), P(rr, y + ry, a1), P(rr, y + ry, a0));
    }
    yb = y + ry; rb = rr;
  }
  // roof: from the top step to the oculus along a curve meeting the outer sphere (radius RT)
  const yStart = yb, rStart = rb;
  const eS = Math.asin(Math.min(1, Math.max(0, (yStart - y) / RT)));
  const roof = [];
  const NE = 24;
  for (let i = 0; i < NE; i++) {
    const t0 = i / NE, t1 = (i + 1) / NE;
    const pr = (t) => {
      const e = eS + (eTop - eS) * t;
      const r = RT * Math.cos(e), yy = y + RT * Math.sin(e);
      // blend from the step ring to the sphere over the first part
      const b = Math.min(1, t * 4);
      return [rStart + (r - rStart) * b, yStart + (yy - yStart) * b];
    };
    const [r0, y0] = pr(t0), [r1, y1] = pr(t1);
    for (let k = 0; k < 128; k++) {
      const a0 = TAU * k / 128, a1 = TAU * (k + 1) / 128;
      const P = (r, yy, a) => [cx + Math.cos(a) * r, yy, cz + Math.sin(a) * r];
      quad(roof, P(r0, y0, a0), P(r0, y0, a1), P(r1, y1, a1), P(r1, y1, a0));
    }
  }
  bag.add(el.stepMat || 'stucco', fromTriangles(orientRadial(out, [cx, y, cz], true)));
  bag.add(outMat, fromTriangles(orientRadial(roof, [cx, y, cz], true)));
}

/** A pediment and roof whose ridge runs along z (a portico facing north or south). */
function pedimentRoofZ(el, ctx) {
  const [x0, z0, x1, z1] = el.rect;
  const tmp = new GeoBag();
  // build with the ridge along x in a frame turned a quarter, then turn it back
  pedimentRoof({ ...el, rect: [z0, -x1, z1, -x0] }, { ...ctx, bag: tmp });
  const m = new Matrix4().makeRotationY(-Math.PI / 2);
  for (const { mat, geometry } of tmp.merged()) { geometry.applyMatrix4(m); ctx.bag.add(mat, geometry); }
}

export const roman = {
  column: corinthianColumn,
  trim: () => {},
  opening: (el, o, f, ctx) => {},
  elements: { roman_entablature: romanEntablature, ring_wall: ringWall, niche, coffered_dome: cofferedDome, pediment_roof: pedimentRoof, pediment_roof_z: pedimentRoofZ },
  objects: { doors },
};

registerStyle('roman', roman);
