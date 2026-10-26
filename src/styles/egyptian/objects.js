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
 * The portable barque of the god: a long, shallow gilded boat whose ends sweep up into posts
 * crowned by the aegis of Horus (a broad collar beneath a falcon head with a sun disc); the
 * veiled cabin-shrine amidships; long carrying poles with cross-bars (dossier §6.7).
 * Local axis: the boat lies along z; prow at -z.
 */
export function barque(el, { bag, col }) {
  const [x, z] = el.at, y = el.y ?? 0, yaw = el.yaw ?? 0, L = el.l ?? 5.0;
  const gold = [], cedar = [], linen = [];
  const deck = 1.45;                                   // height of the deck above the poles' base
  // hull: half-elliptic sections along the length, the sheer rising steeply at the ends
  const NI = 36, NJ = 10, W = 0.46, D = 0.32;
  const ring = (t) => {
    const u = Math.abs(t);                              // 0 at the middle, 1 at the ends
    const w = W * Math.pow(Math.max(0, 1 - Math.pow(u, 2.6)), 0.55) + 0.04;
    const d = D * (1 - 0.7 * Math.pow(u, 2));
    const lift = 0.42 * Math.pow(u, 3);
    const pts = [];
    for (let j = 0; j <= NJ; j++) {
      const a = Math.PI * (j / NJ);                     // from one gunwale under the keel to the other
      pts.push([Math.cos(a) * w, deck + lift - Math.sin(a) * d, t * L / 2]);
    }
    return pts;
  };
  const rows = [];
  for (let i = 0; i <= NI; i++) rows.push(ring(-1 + 2 * i / NI));
  const t = [];
  for (let i = 0; i < NI; i++) {
    for (let j = 0; j < NJ; j++) quad(t, rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]);
    // deck between the gunwales
    quad(t, rows[i][NJ], rows[i + 1][NJ], rows[i + 1][0], rows[i][0]);
  }
  gold.push(fromTriangles(t));
  // aegis on a post at prow and stern
  for (const s of [-1, 1]) {
    const zz = s * L / 2, yy = deck + 0.42;
    gold.push(box(-0.05, yy - 0.35, zz - 0.05, 0.05, yy + 0.05, zz + 0.05));
    // the collar: a thick rounded shield facing outward, the falcon head above it, the sun disc on the head
    const shield = lathe([[0.0, -0.04], [0.22, -0.035], [0.25, 0.0], [0.22, 0.035], [0.0, 0.05]], 20);
    shield.applyMatrix4(new Matrix4().makeRotationX(Math.PI / 2));
    gold.push(place(shield, 0, yy + 0.12, zz + s * 0.04));
    gold.push(lathe([[0.0, 0], [0.09, 0.03], [0.11, 0.12], [0.08, 0.22], [0.0, 0.25]], 12, null, 0, yy + 0.3, zz));
    const sun = lathe([[0.0, -0.015], [0.1, -0.015], [0.1, 0.015], [0.0, 0.015]], 16);
    sun.applyMatrix4(new Matrix4().makeRotationX(Math.PI / 2));
    gold.push(place(sun, 0, yy + 0.64, zz));
  }
  // cabin-shrine amidships: a gilded naos with cornice, draped in linen on the sides
  gold.push(box(-0.36, deck, -0.55, 0.36, deck + 0.9, 0.55));
  gold.push(frustum([-0.36, -0.55, 0.36, 0.55], deck + 0.9, deck + 1.05, -0.08, -0.08, -0.08, -0.08));
  linen.push(box(-0.4, deck + 0.05, -0.5, 0.4, deck + 0.8, 0.5));
  // small kneeling figures (the king) fore and aft of the shrine
  for (const s of [-1, 1]) gold.push(lathe([[0.1, 0], [0.11, 0.2], [0.07, 0.32], [0.06, 0.38], [0, 0.42]], 10, null, 0, deck, s * 0.8));
  // carrying poles along the length and three cross-bars beneath the hull
  for (const sx of [-0.62, 0.62]) cedar.push(box(sx - 0.05, 1.0, -L * 0.64, sx + 0.05, 1.1, L * 0.64));
  for (const sz of [-1.25, 0, 1.25]) cedar.push(box(-0.72, 1.1, sz - 0.05, 0.72, 1.2, sz + 0.05));
  for (const [list, mat] of [[gold, 'gold'], [cedar, 'cedar'], [linen, 'linen']]) {
    const g = mergeLocal(list);
    place(g, x, y, z, yaw);
    bag.add(mat, g);
  }
  col.rect(rotRect([x, z], 1.5, L * 1.3, yaw), y + 1.0, y + deck + 1.6);
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
export function doorLeaves(el, { bag, col }) {
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
  // each open leaf is a thin obstacle along its reveal
  const c = Math.round(Math.cos(yaw)), sn = Math.round(Math.sin(yaw));
  for (const s of [-1, 1]) {
    const lx0 = s * W / 2 - (s > 0 ? T : 0), lx1 = s * W / 2 + (s < 0 ? T : 0);
    const pts = [[lx0, depth], [lx1, depth + leaf]].map(([u, v]) => [x + c * u + sn * v, z - sn * u + c * v]);
    col.rect([Math.min(pts[0][0], pts[1][0]), Math.min(pts[0][1], pts[1][1]), Math.max(pts[0][0], pts[1][0]), Math.max(pts[0][1], pts[1][1])], y, y + H);
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
  const live = [], dead = [];
  const nf = 26;
  for (let f = 0; f < nf; f++) {
    const az = (f / nf) * Math.PI * 2 * 2.618 + r() * 0.4;     // phyllotaxis-like spiral
    const age = f / nf;                                         // older fronds lower and drooping
    const isDead = age > 0.86;
    const up = isDead ? -1.25 + r() * 0.2 : 1.15 - age * 1.5 + r() * 0.15;
    const len = (isDead ? 2.6 : 3.2) + r() * 1.1;
    const pts = [];
    const K = 12;
    for (let k = 0; k <= K; k++) {
      const t = k / K, d = t * len;
      const yy = Math.sin(up) * d - (isDead ? 0.05 : 0.5) * d * d / len;
      pts.push([top[0] + Math.cos(az) * Math.cos(up) * d, top[1] - 0.15 + yy, top[2] + Math.sin(az) * Math.cos(up) * d]);
    }
    const sx = -Math.sin(az), sz = Math.cos(az);
    const out = isDead ? dead : live;
    // rachis
    for (let k = 0; k < K; k++) {
      const p = pts[k], q = pts[k + 1];
      out.push(p[0] + sx * 0.02, p[1], p[2] + sz * 0.02, q[0], q[1], q[2], p[0] - sx * 0.02, p[1], p[2] - sz * 0.02);
    }
    // leaflets: narrow blades along both sides, angled forward and folded up into a V
    const nl = isDead ? 14 : 28;
    for (let l = 2; l < nl; l++) {
      const t = l / nl, kf = t * K, k0 = Math.min(K - 1, Math.floor(kf)), fr = kf - k0;
      const p = [0, 1, 2].map((c) => pts[k0][c] * (1 - fr) + pts[k0 + 1][c] * fr);
      const q = pts[Math.min(K, k0 + 2)];
      const fx = q[0] - p[0], fy = q[1] - p[1], fz = q[2] - p[2], fl = Math.hypot(fx, fy, fz) || 1;
      const ll = (0.25 + 0.55 * Math.sin(Math.PI * Math.min(1, t * 1.15))) * (isDead ? 0.7 : 1);
      for (const side of [-1, 1]) {
        const jitter = (r() - 0.5) * 0.25;
        const tip = [p[0] + side * sx * ll + fx / fl * ll * 0.55, p[1] + ll * (0.22 + jitter) * (isDead ? -1 : 1) + fy / fl * ll * 0.55, p[2] + side * sz * ll + fz / fl * ll * 0.55];
        const b2 = [p[0] + fx / fl * 0.07, p[1] + fy / fl * 0.07, p[2] + fz / fl * 0.07];
        out.push(...p, ...b2, ...tip);
      }
    }
  }
  bag.add('palm_leaf', fromTriangles(live));
  if (dead.length) bag.add('palm_trunk', fromTriangles(dead));
  // a few date clusters under the crown
  if (r() < 0.6) for (let c = 0; c < 3; c++) {
    const a = r() * Math.PI * 2;
    bag.add('palm_trunk', lathe([[0.0, 0], [0.18, 0.15], [0.16, 0.45], [0.0, 0.6]], 6, null, top[0] + Math.cos(a) * 0.45, top[1] - 1.0, top[2] + Math.sin(a) * 0.45));
  }
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
