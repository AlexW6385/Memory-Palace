// Egyptian free-standing objects and special masses: pylon towers with flagpole niches,
// cedar flagpoles, granite falcons of Horus, the granite naos, barque and barque stand,
// altars, cedar door leaves, date palms.

import { Matrix4, BufferGeometry, Float32BufferAttribute } from 'three';
import { box, frustum, lathe, disc, rod, place, fromTriangles, quad } from '../../core/geom.js';
import { trim, wingedDisc } from './trim.js';

const rnd = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

/**
 * Pylon tower with flagpole niches in the front face.
 * el = { t:'pylon_tower', rect:[x0,z0,x1,z1], y0, h, batter: b (inset of each face at the top),
 *        front: 'zp'|'zn' (which face is the facade), niches: [{x, w, depth, top}], trim }
 */
export function pylonTower(el, { bag, col, style }) {
  const [x0, z0, x1, z1] = el.rect;
  const H = el.h, b = el.batter, y0 = el.y0 ?? 0;
  const frontP = el.front === 'zp';
  const mat = el.mat || 'sandstone';
  // split along x at the niche edges
  const cuts = [x0];
  const niches = (el.niches || []).slice().sort((p, q) => p.x - q.x);
  for (const n of niches) cuts.push(n.x - n.w / 2, n.x + n.w / 2);
  cuts.push(x1);
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i], c = cuts[i + 1];
    if (c - a < 1e-3) continue;
    // linear batter: the x-ends lean in only at the tower's own ends
    const fx = (x) => (x - x0) / (x1 - x0);
    const ends = el.batterEnds ?? [b, b];
    const insXn = i === 0 ? ends[0] : 0, insXp = i === cuts.length - 2 ? ends[1] : 0;
    const niche = niches.find((n) => Math.abs(n.x - n.w / 2 - a) < 1e-6);
    const zf = frontP ? z1 : z0, zb = frontP ? z0 : z1;
    const zf0 = frontP ? z1 : z0, zb0 = frontP ? z0 : z1;
    if (niche) {
      const zr = frontP ? zf0 - niche.depth : zf0 + niche.depth;
      col.rect([a, Math.min(zr, zb0), c, Math.max(zr, zb0)], y0, y0 + H);
    } else col.rect([a, z0, c, z1], y0, y0 + H);
    if (!niche) {
      bag.add(mat, frustum([a, Math.min(zf, zb), c, Math.max(zf, zb)], y0, y0 + H, insXn, insXp, b, b, { noBottom: true, noXn: i > 0, noXp: i < cuts.length - 2 }));
    } else {
      // recessed part from the ground to the niche top, then full depth above
      const yt = niche.top, d = niche.depth;
      const s = b / H;
      const zfr = frontP ? zf - d : zf + d;
      const rect1 = frontP ? [a, zb, c, zfr] : [a, zfr, c, zb];
      const ins1 = frontP ? [0, 0, b * yt / H, s * yt] : [0, 0, s * yt, b * yt / H];
      bag.add(mat, frustum(rect1, y0, y0 + yt, 0, 0, ins1[2], ins1[3], { noBottom: true, noXn: false, noXp: false }));
      // the part above: base front face continues the battered plane
      const zfa = frontP ? zf - s * yt : zf + s * yt, zba = frontP ? zb + s * yt : zb - s * yt;
      const rect2 = [a, Math.min(zfa, zba), c, Math.max(zfa, zba)];
      const rem = b - s * yt;
      bag.add(mat, frustum(rect2, y0 + yt, y0 + H, 0, 0, rem, rem, { noBottom: false, noXn: true, noXp: true }));
    }
  }
  if (el.trim) trim({ ...el, t: 'block', y0, y1: y0 + H, batter: [...(el.batterEnds ?? [b, b]), b, b] }, { bag, style });
}

/** Tall cedar flagpole, tapering, standing in a niche. */
export function flagpole(el, { bag, col }) {
  const [x, z] = el.at, y = el.y ?? 0, h = el.h ?? 38;
  bag.add('cedar', lathe([[0.42, 0], [0.4, h * 0.3], [0.3, h * 0.75], [0.16, h]], 12, null, x, y, z));
  bag.add('gold', lathe([[0.17, 0], [0.22, 0.4], [0.05, 1.6]], 10, null, x, y + h, z));
  col.circle(x, z, 0.45, y, y + h);
}

/**
 * Granite falcon of Horus wearing the double crown, on a plinth.
 * el = { at, y, yaw, h (total height of the bird without plinth), plinth: [w, d, h], mat }
 */
export function falcon(el, { bag, col }) {
  const [x, z] = el.at, y = el.y ?? 0, yaw = el.yaw ?? 0;
  const S = (el.h ?? 3.0) / 3.0;   // modelled at 3 m
  const mat = el.mat || 'granite_black';
  const [pw, pd, ph] = el.plinth ?? [1.6, 2.4, 0.9];
  const parts = [];
  parts.push(box(-pw / 2, 0, -pd / 2, pw / 2, ph, pd / 2));
  const T = (g, m) => { g.applyMatrix4(m); parts.push(g); };
  // tail feathers sloping to the plinth behind
  T(frustum([-0.32, -0.25, 0.32, 0.25], 0, 1.0, 0.08, 0.08, 0.05, 0.05), new Matrix4().makeRotationX(-0.55).setPosition(0, ph, 0.75));
  // legs and talons
  for (const sx of [-0.22, 0.22]) {
    parts.push(lathe([[0.12, 0], [0.11, 0.45], [0.16, 0.6]], 10, null, sx, ph, -0.15));
    parts.push(box(sx - 0.14, ph, -0.55, sx + 0.14, ph + 0.12, -0.05));
  }
  // body: an ovoid, tilted forward, flattened at the sides by the folded wings
  const body = lathe([[0.0, 0], [0.38, 0.12], [0.55, 0.45], [0.58, 0.85], [0.5, 1.2], [0.36, 1.45], [0.26, 1.58]], 24);
  body.applyMatrix4(new Matrix4().makeScale(0.92, 1, 1.05));
  T(body, new Matrix4().makeRotationX(0.32).setPosition(0, ph + 0.55, 0.12));
  // wings folded along the back, a slab on each side tapering to the tail
  for (const sx of [-1, 1]) {
    const w = frustum([-0.06, -0.38, 0.06, 0.38], 0, 1.3, 0.02, 0.02, 0.2, 0.12);
    T(w, new Matrix4().makeRotationX(0.42).premultiply(new Matrix4().makeTranslation(sx * 0.5, ph + 0.7, 0.28)));
  }
  // head and hooked beak
  const hy = ph + 2.08;
  parts.push(lathe([[0, 0], [0.24, 0.07], [0.3, 0.25], [0.27, 0.42], [0.15, 0.53], [0, 0.56]], 20, null, 0, hy - 0.25, -0.08));
  const beak = lathe([[0.1, 0], [0.07, 0.12], [0.0, 0.24]], 10);
  T(beak, new Matrix4().makeRotationX(-1.9).setPosition(0, hy - 0.02, -0.36));
  // double crown: red crown (deshret) with its tall back, white crown (hedjet) rising inside
  const cy = hy + 0.26;
  parts.push(lathe([[0.31, 0], [0.33, 0.28], [0.3, 0.3]], 20, null, 0, cy, -0.06));
  parts.push(box(-0.3, cy, 0.08, 0.3, cy + 0.72, 0.24));
  parts.push(lathe([[0.22, 0], [0.24, 0.25], [0.2, 0.55], [0.12, 0.75], [0.09, 0.82], [0.0, 0.86]], 20, null, 0, cy + 0.28, -0.08));
  const g = mergeLocal(parts);
  place(g, x, y, z, yaw, S);
  bag.add(mat, g);
  col.rect(rotRect([x, z], pw * S, pd * S, yaw), y, y + ph * S + 3);
}

/** The granite naos (shrine) of Nectanebo II: a monolith with a pyramidal roof, cornice and door. */
export function naos(el, { bag, col }) {
  const [x, z] = el.at, y = el.y ?? 0, yaw = el.yaw ?? 0;
  const W = el.w ?? 1.55, D = el.d ?? 1.4, H = el.h ?? 4.0;
  const mat = el.mat || 'granite_grey';
  const parts = [];
  const plinthH = 0.3, bodyH = H * 0.66, corH = 0.32, roofH = H - plinthH - bodyH - corH;
  parts.push(box(-W / 2 - 0.12, 0, -D / 2 - 0.12, W / 2 + 0.12, plinthH, D / 2 + 0.12));
  // body hollowed by a deep door recess on the front (-z)
  const dw = W * 0.56, dh = bodyH * 0.72;
  parts.push(box(-W / 2, plinthH, -D / 2 + 0.55, W / 2, plinthH + bodyH, D / 2));
  parts.push(box(-W / 2, plinthH, -D / 2, -dw / 2, plinthH + bodyH, -D / 2 + 0.55));
  parts.push(box(dw / 2, plinthH, -D / 2, W / 2, plinthH + bodyH, -D / 2 + 0.55));
  parts.push(box(-dw / 2, plinthH + dh, -D / 2, dw / 2, plinthH + bodyH, -D / 2 + 0.55));
  // torus and cornice
  const ct = plinthH + bodyH;
  parts.push(box(-W / 2 - 0.06, ct - 0.1, -D / 2 - 0.06, W / 2 + 0.06, ct, D / 2 + 0.06));
  parts.push(frustum([-W / 2, -D / 2, W / 2, D / 2], ct, ct + corH, -0.16, -0.16, -0.16, -0.16));
  // pyramidal roof
  parts.push(frustum([-W / 2 - 0.12, -D / 2 - 0.12, W / 2 + 0.12, D / 2 + 0.12], ct + corH, ct + corH + roofH, W / 2 + 0.07, W / 2 + 0.07, D / 2 + 0.07, D / 2 + 0.07));
  const g = mergeLocal(parts);
  place(g, x, y, z, yaw);
  bag.add(mat, g);
  // gilded cedar doors standing open inside the recess
  const d = mergeLocal([box(-dw / 2 - 0.02, plinthH + 0.02, -D / 2 - 0.02, -dw / 2 + 0.04, plinthH + dh - 0.02, -D / 2 + 0.5)]);
  place(d, x, y, z, yaw);
  bag.add('cedar', d);
  col.rect(rotRect([x, z], W + 0.3, D + 0.3, yaw), y, y + H);
}

/** Granite pedestal for the sacred barque. */
export function barqueStand(el, { bag, col }) {
  const [x, z] = el.at, y = el.y ?? 0, yaw = el.yaw ?? 0;
  const W = el.w ?? 1.3, D = el.d ?? 2.4, H = el.h ?? 1.05;
  const g = mergeLocal([
    box(-W / 2 - 0.1, 0, -D / 2 - 0.1, W / 2 + 0.1, 0.12, D / 2 + 0.1),
    box(-W / 2, 0.12, -D / 2, W / 2, H - 0.18, D / 2),
    box(-W / 2 - 0.08, H - 0.18, -D / 2 - 0.08, W / 2 + 0.08, H, D / 2 + 0.08),
  ]);
  place(g, x, y, z, yaw);
  bag.add(el.mat || 'granite_black', g);
  col.rect(rotRect([x, z], W + 0.2, D + 0.2, yaw), y, y + H);
}

/**
 * The portable barque of the god: a gilded boat with an aegis (falcon head with broad collar) at
 * prow and stern, the cabin-shrine amidships under its veil, and the carrying poles.
 */
export function barque(el, { bag, col }) {
  const [x, z] = el.at, y = el.y ?? 0, yaw = el.yaw ?? 0, L = el.l ?? 5.0;
  const gold = [], cedar = [], linen = [];
  // hull: a lathe about the long axis, flattened
  const hull = lathe([[0.0, -L / 2], [0.18, -L * 0.42], [0.42, -L * 0.25], [0.48, 0], [0.42, L * 0.25], [0.18, L * 0.42], [0.0, L / 2]], 18);
  hull.applyMatrix4(new Matrix4().makeScale(1, 1, 0.55).premultiply(new Matrix4().makeRotationX(Math.PI / 2)));
  // keep the upper half only by squashing the lower side into the deck plane
  const p = hull.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const zz = p.getZ(i), yy = p.getY(i);
    const lift = 0.35 * Math.pow(Math.abs(zz) / (L / 2), 3);
    p.setY(i, (yy < 0 ? yy * 0.6 : 0) + lift);
  }
  hull.computeVertexNormals();
  gold.push(place(hull, 0, 1.25, 0));
  // aegis at each end: a disc (the collar) and a falcon head above
  for (const s of [-1, 1]) {
    const col2 = disc(0.34, 0, 20);
    col2.applyMatrix4(new Matrix4().makeRotationX(Math.PI / 2 * s));
    gold.push(place(col2, 0, 1.75, s * (L / 2 - 0.1)));
    gold.push(lathe([[0, 0], [0.13, 0.05], [0.15, 0.18], [0.1, 0.3], [0, 0.32]], 12, null, 0, 1.95, s * (L / 2 - 0.12)));
  }
  // cabin shrine with its veil
  linen.push(box(-0.42, 1.45, -0.6, 0.42, 2.35, 0.6));
  gold.push(box(-0.46, 2.35, -0.64, 0.46, 2.45, 0.64));
  // carrying poles
  for (const sx of [-0.62, 0.62]) cedar.push(box(sx - 0.05, 1.12, -L * 0.62, sx + 0.05, 1.22, L * 0.62));
  for (const sz of [-1.2, 0, 1.2]) cedar.push(box(-0.7, 1.12, sz - 0.05, 0.7, 1.22, sz + 0.05));
  for (const [list, mat] of [[gold, 'gold'], [cedar, 'cedar'], [linen, 'linen']]) {
    const g = mergeLocal(list);
    place(g, x, y, z, yaw);
    bag.add(mat, g);
  }
  col.rect(rotRect([x, z], 1.5, L * 1.24, yaw), y + 1.1, y + 2.5);
}

/** Stone altar with torus and cornice. */
export function altar(el, { bag, col }) {
  const [x, z] = el.at, y = el.y ?? 0, yaw = el.yaw ?? 0;
  const W = el.w ?? 2.0, D = el.d ?? 1.4, H = el.h ?? 1.1;
  const g = mergeLocal([
    box(-W / 2, 0, -D / 2, W / 2, H - 0.25, D / 2),
    frustum([-W / 2, -D / 2, W / 2, D / 2], H - 0.25, H, -0.12, -0.12, -0.12, -0.12),
  ]);
  place(g, x, y, z, yaw);
  bag.add(el.mat || 'sandstone_dressed', g);
  col.rect(rotRect([x, z], W, D, yaw), y, y + H);
}

/** A pair of cedar door leaves standing open against the reveals of a doorway. */
export function doorLeaves(el, { bag }) {
  const [x, z] = el.at, y = el.y ?? 0, yaw = el.yaw ?? 0;
  const W = el.w, H = el.h, T = el.th ?? 0.18, depth = el.depth ?? 0.2;
  const leaf = W / 2;
  const cedar = [], bronze = [];
  for (const s of [-1, 1]) {
    // hinged at the jamb (x = s*W/2), swung 90° inward to lie along the reveal
    cedar.push(box(s * W / 2 - (s > 0 ? T : 0), 0, depth, s * W / 2 + (s < 0 ? T : 0), H, depth + leaf));
    for (let k = 0; k < 5; k++) {
      const yy = 0.25 + k * (H - 0.5) / 4;
      bronze.push(box(s * W / 2 - (s > 0 ? T + 0.03 : -T), yy - 0.06, depth + 0.05, s * W / 2 - (s > 0 ? T : -T - 0.03), yy + 0.06, depth + leaf - 0.05));
    }
  }
  for (const [list, mat] of [[cedar, 'cedar'], [bronze, 'bronze']]) {
    const g = mergeLocal(list);
    place(g, x, y, z, yaw);
    bag.add(mat, g);
  }
}

/** Date palm: a ringed, slightly leaning trunk and a crown of arching pinnate fronds. */
export function palm(el, { bag, col }) {
  const [x, z] = el.at, y = el.y ?? 0;
  const r = rnd(el.seed ?? 7);
  const h = el.h ?? 10, lean = el.lean ?? 0, yaw = r() * Math.PI * 2;
  const prof = [];
  const n = Math.round(h / 0.32);
  for (let i = 0; i <= n; i++) {
    const t = i / n, rr = 0.26 - 0.06 * t + (i % 2 ? 0.025 : 0);
    prof.push([i === 0 ? 0.36 : rr, t * h]);
  }
  const trunk = lathe(prof, 9);
  // lean: shear x by height
  const pos = trunk.attributes.position;
  for (let i = 0; i < pos.count; i++) { const yy = pos.getY(i); pos.setX(i, pos.getX(i) + lean * yy * yy / h); }
  place(trunk, x, y, z, yaw);
  bag.add('palm_trunk', trunk);
  const top = [x + Math.cos(-yaw) * lean * h, y + h, z + Math.sin(-yaw) * lean * h];
  const tris = [];
  const nf = 22;
  for (let f = 0; f < nf; f++) {
    const az = (f / nf) * Math.PI * 2 + r() * 0.3;
    const up = 0.9 - (f % 3) * 0.45 + r() * 0.2;       // younger fronds stand up, older droop
    const len = 3.4 + r() * 1.2;
    const pts = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8, d = t * len;
      const yy = Math.sin(up) * d - 0.55 * d * d / len;
      pts.push([top[0] + Math.cos(az) * Math.cos(up) * d, top[1] + yy, top[2] + Math.sin(az) * Math.cos(up) * d]);
    }
    const sx = -Math.sin(az), sz = Math.cos(az);
    for (let k = 1; k < 8; k++) {
      const p = pts[k], q = pts[k + 1];
      const w = 0.62 * Math.sin(Math.PI * (k / 8)) + 0.1;
      for (const side of [-1, 1]) {
        const tip = [p[0] + side * sx * w, p[1] - 0.18 * w, p[2] + side * sz * w];
        // double-sided leaflet fan
        tris.push(...p, ...q, ...tip, ...q, ...p, ...tip);
      }
    }
  }
  bag.add('palm_leaf', fromTriangles(tris));
  col.circle(x, z, 0.4, y, y + h);
}

function mergeLocal(list) {
  list = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o);
    o += g.attributes.position.array.length;
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  return out;
}

/** Axis-aligned footprint of a w×d rectangle centred at c, turned by yaw (rounded to 90°). */
function rotRect([x, z], w, d, yaw) {
  const q = Math.round(yaw / (Math.PI / 2)) % 2 !== 0;
  const hw = (q ? d : w) / 2, hd = (q ? w : d) / 2;
  return [x - hw, z - hd, x + hw, z + hd];
}

export { quad };

/** A winged sun disc in relief on a wall face; yaw turns its face (0 = facing +z). */
export function wingedDiscObj(el, { bag }) {
  const g = wingedDisc(el.w, el.h, el.depth ?? 0.08);
  place(g, el.at[0], el.y, el.at[1], el.yaw ?? 0);
  bag.add(el.mat || 'sandstone', g);
}
