// Greek columns: the Doric of the Parthenon and the Attic-Ionic.
//
// Doric: no base; a shaft of drums with 20 shallow flutes meeting in sharp arrises, swelling
// slightly (entasis) as it tapers; three incised grooves at the neck; four annulets; the
// cushion-like echinus; a square abacus. The Parthenon's shaft follows the measured profile
// r(z) = 0.954753 − 0.0152412 z − 0.000716763 z² (metres; docs/buildings/parthenon.md §4),
// scaled to each column's own height and diameter.
//
// Ionic: Attic base (torus, scotia, torus), 24 flutes separated by fillets, a capital with
// two volutes joined by the cushion (pulvinus) at the sides, and a thin abacus.

import { Matrix4, BufferGeometry, Float32BufferAttribute } from 'three';
import { lathe, disc, box, fromTriangles, quad } from '../../core/geom.js';

const TAU = Math.PI * 2;

/** Radial multiplier for a fluted shaft at angle th: n concave flutes, depth as a fraction of r. */
function fluteMod(n, depth, fillet = 0) {
  return (th) => {
    const u = ((th / TAU) * n) % 1;              // 0..1 across one flute
    const w = 1 - fillet;                        // fillets are the flat part between flutes
    const v = (u - fillet / 2) / w;
    if (v < 0 || v > 1) return 1;
    const c = 2 * v - 1;                         // -1..1
    return 1 - depth * Math.sqrt(Math.max(0, 1 - c * c));   // circular-arc flute
  };
}

/** Parthenon entasis, normalised: radius fraction at height fraction t (0 foot … 1 top of shaft). */
function parthenonRadius(t) {
  const z = t * 9.57;                            // the measured shaft is about 9.57 m tall
  return (0.954753 - 0.0152412 * z - 0.000716763 * z * z) / 0.954753;
}

/**
 * Doric column: { at: [x, z], y, h (total, to the top of the abacus), d (lower diameter),
 *                 flutes (20), mat, abacus: width multiplier }
 */
export function doricColumn(el, { bag, col }) {
  const [x, z] = el.at, y = el.y ?? 0, H = el.h, R = el.d / 2;
  const mat = el.mat || 'marble_column';
  const capH = H * 0.082, abH = capH * 0.36, echH = capH - abH;
  const shaftH = H - capH;
  const n = el.flutes ?? 20, seg = n * 8;
  // shaft with entasis, in rows (more rows near the neck grooves)
  const prof = [];
  const rows = 14;
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    prof.push([R * parthenonRadius(t), shaftH * t]);
  }
  const rTop = R * parthenonRadius(1);
  // neck grooves: three shallow cuts a little below the capital
  const g0 = shaftH - capH * 0.55;
  const grooves = [];
  for (let k = 0; k < 3; k++) {
    const yy = g0 + k * 0.035 * H / 10.4;
    grooves.push([rTop * 0.985, yy], [rTop * 0.985, yy + 0.012], [rTop, yy + 0.02]);
  }
  const shaft = prof.filter(([, yy]) => yy < g0 - 0.05).concat([[R * parthenonRadius(g0 / shaftH), g0 - 0.02]], grooves, [[rTop, shaftH]]);
  bag.add(mat, lathe(shaft, seg, fluteMod(n, 0.045), x, y, z));
  // capital: annulets, echinus, abacus (the flutes run up to the annulets)
  // the echinus swells from the neck to just inside the abacus edge (Parthenon: abacus ≈ 1.07 D)
  const e0 = y + shaftH, eR = rTop, EM = R * 1.04 * (el.abacus ?? 1);
  const L = (t) => eR + (EM - eR) * t;
  const ech = [[eR * 0.99, 0], [eR * 1.025, echH * 0.06], [eR * 0.995, echH * 0.1], [eR * 1.03, echH * 0.16], [eR * 1.0, echH * 0.2],
    [L(0.08), echH * 0.28], [L(0.42), echH * 0.5], [L(0.76), echH * 0.72], [L(0.95), echH * 0.88], [EM, echH * 0.96], [EM * 0.97, echH], [0, echH]];
  bag.add(mat, lathe(ech, 48, null, x, e0, z));
  const A = R * 1.07 * (el.abacus ?? 1);
  bag.add(mat, box(x - A, e0 + echH, z - A, x + A, e0 + capH, z + A));
  col.circle(x, z, R * 1.02, y, y + H);
}

/** Ionic volute: a spiral ribbon on a capital face (in the x–y plane, facing +z), centred at the eye. */
function volute(r0, turns, width, thick) {
  const tris = [];
  const N = Math.round(turns * 48);
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = -Math.PI / 2 + t * turns * TAU;          // starts at the bottom, winds inward
    const r = r0 * (1 - t * 0.82);
    pts.push([Math.cos(a) * r, Math.sin(a) * r, width * (1 - t * 0.6)]);
  }
  for (let i = 0; i < N; i++) {
    const [ax, ay, aw] = pts[i], [bx, by, bw] = pts[i + 1];
    // ribbon: outer edge at the spiral, inner edge toward the eye; a raised rim on the face
    const la = Math.hypot(ax, ay) || 1, lb = Math.hypot(bx, by) || 1;
    const ai = [ax - ax / la * aw, ay - ay / la * aw], bi = [bx - bx / lb * bw, by - by / lb * bw];
    quad(tris, [ax, ay, thick], [bx, by, thick], [bi[0], bi[1], thick * 0.6], [ai[0], ai[1], thick * 0.6]);
    quad(tris, [ax, ay, 0], [bx, by, 0], [bx, by, thick], [ax, ay, thick]);
  }
  // the eye
  const eye = [];
  for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; eye.push([Math.cos(a) * r0 * 0.12, Math.sin(a) * r0 * 0.12]); }
  for (let k = 1; k < 11; k++) tris.push(eye[0][0], eye[0][1], thick * 1.1, eye[k][0], eye[k][1], thick * 1.1, eye[k + 1][0], eye[k + 1][1], thick * 1.1);
  return fromTriangles(tris);
}

/**
 * Ionic column: { at, y, h, d, flutes (24), mat, yaw (radians; volutes face ±z when 0) }
 */
export function ionicColumn(el, { bag, col }) {
  const [x, z] = el.at, y = el.y ?? 0, H = el.h, R = el.d / 2;
  const mat = el.mat || 'marble_column';
  const yaw = el.yaw ?? 0;
  // Attic base: plinthless torus–scotia–torus, about half a diameter high
  const bH = R;
  const base = [[R * 1.42, 0], [R * 1.48, bH * 0.12], [R * 1.46, bH * 0.3], [R * 1.36, bH * 0.36], [R * 1.22, bH * 0.42],
    [R * 1.18, bH * 0.55], [R * 1.26, bH * 0.62], [R * 1.3, bH * 0.72], [R * 1.24, bH * 0.86], [R * 1.08, bH * 0.94], [R * 1.02, bH]];
  bag.add(mat, lathe(base, 48, null, x, y, z));
  bag.add(mat, disc(R * 1.42, y + 0.001, 48, x, z, false));
  const capH = R * 1.1, abH = capH * 0.18;
  const shaftH = H - bH - capH;
  const rTop = R * 0.84;
  const prof = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push([R + (rTop - R) * (t * 0.7 + t * t * 0.3), shaftH * t]); }
  bag.add(mat, lathe(prof, 24 * 8, fluteMod(24, 0.06, 0.18), x, y + bH, z));
  // capital: echinus ring, the volute block with its two faces, the thin abacus
  const c0 = y + bH + shaftH;
  bag.add(mat, lathe([[rTop * 1.02, 0], [rTop * 1.12, capH * 0.18], [rTop * 1.1, capH * 0.42], [0, capH * 0.42]], 32, null, x, c0, z));
  const parts = [];
  const vw = R * 1.55, vH = capH * 0.62;
  // the canalis: a slab joining the volutes across the face; the cushion behind
  parts.push(box(-vw, capH * 0.34, -R * 0.82, vw, capH * 0.82, R * 0.82));
  for (const sx of [-1, 1]) {
    // pulvinus (bolster) seen from the side: a waisted cylinder along z
    const b = lathe([[R * 0.42, -R * 0.82], [R * 0.36, -R * 0.45], [R * 0.3, 0], [R * 0.36, R * 0.45], [R * 0.42, R * 0.82]], 16);
    b.applyMatrix4(new Matrix4().makeRotationX(Math.PI / 2));
    b.translate(sx * (vw - R * 0.42), capH * 0.5, 0);
    // swap axes: the lathe ran along y; after rotation it runs along z
    parts.push(b);
    for (const sz of [-1, 1]) {
      const v = volute(R * 0.42, 2.6, R * 0.12, 0.05);
      const m = new Matrix4().makeRotationY(sz > 0 ? 0 : Math.PI);
      m.setPosition(sx * (vw - R * 0.42), capH * 0.5, sz * R * 0.83);
      v.applyMatrix4(m);
      parts.push(v);
    }
  }
  const aw = vw * 0.98;
  parts.push(box(-aw, capH - abH, -R * 0.95, aw, capH, R * 0.95));
  const g = merge(parts);
  g.applyMatrix4(new Matrix4().makeRotationY(yaw).setPosition(x, c0, z));
  bag.add(mat, g);
  col.circle(x, z, R * 1.05, y, y + H);
}

function merge(list) {
  list = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) { pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); o += g.attributes.position.array.length; }
  const out = new BufferGeometry();
  out.setAttribute('position', new Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  return out;
}

export { merge, fluteMod };
