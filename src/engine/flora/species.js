// Plant geometry: a generic tree (trunk, limbs, a crown of leaf cards) parameterised per
// species, and special forms (date palm, doum palm, papyrus, grass tufts, boulders).
// Every geometry carries `sway` (0 at the base, 1 at the tips) for the wind, and leaf cards
// carry normals bent outward from the crown's centre so a crown shades as one rounded mass.
// Each species has variants (shapes) and two levels of detail.

import * as THREE from 'three/webgpu';

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Collects triangles with normals, uvs and sway. */
class Mesher {
  constructor() { this.p = []; this.n = []; this.uv = []; this.s = []; }
  tri(a, b, c, na, nb, nc, ua, ub, uc, sa, sb, sc) {
    this.p.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    this.n.push(na.x, na.y, na.z, nb.x, nb.y, nb.z, nc.x, nc.y, nc.z);
    this.uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
    this.s.push(sa, sb, sc);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('sway', new THREE.Float32BufferAttribute(this.s, 1));
    g.computeBoundingSphere();
    return g;
  }
  get count() { return this.p.length / 9; }
}

/** A tapered tube along points [[x,y,z,r], ...] with `sides` facets. */
function tube(M, pts, sides, H) {
  const rings = [];
  for (let i = 0; i < pts.length; i++) {
    const [x, y, z, r] = pts[i];
    const nxt = pts[Math.min(pts.length - 1, i + 1)], prv = pts[Math.max(0, i - 1)];
    const dir = V(nxt[0] - prv[0], nxt[1] - prv[1], nxt[2] - prv[2]).normalize();
    const up = Math.abs(dir.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(dir, up).normalize(), w = new THREE.Vector3().crossVectors(dir, u).normalize();
    const ring = [];
    for (let k = 0; k <= sides; k++) {
      const a = (k / sides) * Math.PI * 2, nrm = u.clone().multiplyScalar(Math.cos(a)).add(w.clone().multiplyScalar(Math.sin(a)));
      ring.push({ p: V(x, y, z).add(nrm.clone().multiplyScalar(r)), n: nrm, v: k / sides, s: Math.pow(Math.max(0, y) / H, 1.6) * 0.6 });
    }
    rings.push(ring);
  }
  for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < sides; k++) {
    const a = rings[i][k], b = rings[i][k + 1], c = rings[i + 1][k + 1], d = rings[i + 1][k];
    M.tri(a.p, c.p, b.p, a.n, c.n, b.n, [a.v, i], [c.v, i + 1], [b.v, i], a.s, c.s, b.s);
    M.tri(a.p, d.p, c.p, a.n, d.n, c.n, [a.v, i], [d.v, i + 1], [c.v, i + 1], a.s, d.s, c.s);
  }
}

/** A quad leaf card centred at c, w × h, facing n (rotated by roll), normals bent toward `out`. */
function card(M, c, w, h, n, roll, out, bend, sway, uvRect = [0, 0, 1, 1]) {
  const up0 = Math.abs(n.y) > 0.95 ? V(1, 0, 0) : V(0, 1, 0);
  let u = new THREE.Vector3().crossVectors(up0, n).normalize();
  let v = new THREE.Vector3().crossVectors(n, u).normalize();
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const u2 = u.clone().multiplyScalar(cr).add(v.clone().multiplyScalar(sr)), v2 = v.clone().multiplyScalar(cr).sub(u.clone().multiplyScalar(sr));
  u = u2.multiplyScalar(w / 2); v = v2.multiplyScalar(h / 2);
  const P = [c.clone().sub(u).sub(v), c.clone().add(u).sub(v), c.clone().add(u).add(v), c.clone().sub(u).add(v)];
  const N = P.map((p) => n.clone().lerp(p.clone().sub(out).normalize(), bend).normalize());
  const [u0, v0, u1, v1] = uvRect;
  const UV = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  M.tri(P[0], P[1], P[2], N[0], N[1], N[2], UV[0], UV[1], UV[2], sway, sway, sway);
  M.tri(P[0], P[2], P[3], N[0], N[2], N[3], UV[0], UV[2], UV[3], sway, sway, sway);
}

// ── the generic tree ─────────────────────────────────────────────────────────

/**
 * T = { height, trunk: { r, lean, bend, fork (height fraction where limbs start), limbs, gnarl },
 *       crown: { shape: 'round'|'umbrella'|'spindle'|'flat'|'clumps', w (radius), h (half height), y (centre height fraction),
 *                clumps, cards, card (size), up (bias of cards toward horizontal 0…1) }, foliage }
 */
function tree(T, seed, lod) {
  const rand = rng(seed);
  const H = T.height * (0.85 + rand() * 0.3);
  const trunk = new Mesher(), leaves = new Mesher();
  const tr = T.trunk, cr = T.crown;
  const lean = (rand() - 0.5) * 2 * (tr.lean ?? 0.05), leanDir = rand() * Math.PI * 2;
  const forkY = H * (tr.fork ?? 0.5);
  // trunk to the fork, wandering if gnarled
  const tp = [];
  const segs = lod ? 3 : 7;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, y = forkY * t;
    const g = (tr.gnarl ?? 0) * Math.sin(t * 7 + seed) * tr.r;
    tp.push([Math.cos(leanDir) * lean * y + g, y, Math.sin(leanDir) * lean * y + g * 0.6, tr.r * (1 - 0.35 * t) * (i === 0 ? 1.25 : 1)]);
  }
  tube(trunk, tp, lod ? 5 : 9, H);
  const top = tp[tp.length - 1];
  // crown clumps
  const cy = H * (cr.y ?? 0.7);
  const centre = V(top[0], cy, top[2]);
  const clumps = [];
  const nC = cr.clumps ?? 8;
  for (let i = 0; i < nC; i++) {
    let p;
    if (cr.shape === 'umbrella' || cr.shape === 'flat') {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * cr.w;
      p = V(Math.cos(a) * r, (rand() - 0.5) * cr.h * (1 - (r / cr.w) ** 2 * 0.6), Math.sin(a) * r);
    } else if (cr.shape === 'spindle') {
      const y = (rand() * 2 - 1) * cr.h, rr = cr.w * Math.sqrt(Math.max(0, 1 - (y / cr.h) ** 2)) * (0.6 + 0.4 * rand());
      const a = rand() * Math.PI * 2;
      p = V(Math.cos(a) * rr * 0.6, y, Math.sin(a) * rr * 0.6);
    } else {
      const a = rand() * Math.PI * 2, e = Math.acos(rand() * 2 - 1), r = Math.cbrt(rand()) * 0.75;
      p = V(Math.cos(a) * Math.sin(e) * cr.w * r, Math.cos(e) * cr.h * r, Math.sin(a) * Math.sin(e) * cr.w * r);
    }
    clumps.push(p.add(centre));
  }
  // limbs from the fork to the clumps (fewer at low detail)
  const nL = Math.min(clumps.length, lod ? Math.ceil((tr.limbs ?? 4) / 2) : (tr.limbs ?? 4));
  for (let i = 0; i < nL; i++) {
    const c = clumps[i], mid = V((top[0] + c.x) / 2 + (rand() - 0.5) * 0.4, (top[1] + c.y) / 2 + (rand() - 0.2) * 0.6, (top[2] + c.z) / 2 + (rand() - 0.5) * 0.4);
    tube(trunk, [[top[0], top[1] - 0.2, top[2], top[3] * 0.75], [mid.x, mid.y, mid.z, top[3] * 0.45], [c.x, c.y, c.z, top[3] * 0.18]], lod ? 4 : 6, H);
  }
  // leaf cards in each clump
  const perClump = Math.round((cr.cards ?? 40) * (lod ? 0.5 : 1));
  const size = cr.card * (lod ? 1.45 : 1);
  const cw = cr.clumpR ?? Math.max(cr.w, cr.h) * 0.45;
  for (const c of clumps) {
    for (let k = 0; k < perClump; k++) {
      const a = rand() * Math.PI * 2, e = Math.acos(rand() * 2 - 1), r = Math.cbrt(rand()) * cw;
      const p = c.clone().add(V(Math.cos(a) * Math.sin(e) * r, Math.cos(e) * r * (cr.shape === 'umbrella' || cr.shape === 'flat' ? 0.45 : 0.9), Math.sin(a) * Math.sin(e) * r));
      // card orientation: random, biased toward lying flat (up) for umbrella and flat crowns
      const n = V(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().lerp(V(0, 1, 0), cr.up ?? 0.2).normalize();
      const sway = 0.5 + 0.5 * Math.min(1, p.y / H);
      card(leaves, p, size * (0.75 + rand() * 0.5), size * (0.75 + rand() * 0.5), n, rand() * Math.PI * 2, centre, 0.65, sway);
    }
  }
  return { trunk: trunk.geometry(), leaves: leaves.geometry(), height: H };
}

// ── palms ────────────────────────────────────────────────────────────────────

/** Date palm: a ringed trunk, a crown of arching pinnate fronds (leaflets as geometry), dates. */
function datePalm(seed, lod) {
  const rand = rng(seed);
  const H = 8 + rand() * 6, lean = (rand() - 0.5) * 0.12, la = rand() * Math.PI * 2;
  const trunk = new Mesher(), leaves = new Mesher();
  const pts = [];
  const n = lod ? 4 : 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n, y = H * t;
    pts.push([Math.cos(la) * lean * y * y / H, y, Math.sin(la) * lean * y * y / H, (i === 0 ? 0.38 : 0.27 - 0.06 * t) + (!lod && i % 2 ? 0.02 : 0)]);
  }
  tube(trunk, pts, lod ? 5 : 8, H);
  const top = V(...pts[n].slice(0, 3));
  const nf = lod ? 12 : 24;
  for (let f = 0; f < nf; f++) {
    const az = f * 2.39996 + rand() * 0.3, age = f / nf;
    const dead = age > 0.86;
    const up = dead ? -1.2 : 1.1 - age * 1.5 + rand() * 0.15, len = (dead ? 2.6 : 3.3) + rand() * 1.1;
    const K = lod ? 4 : 9, pts2 = [];
    for (let k = 0; k <= K; k++) {
      const d = (k / K) * len;
      pts2.push(V(top.x + Math.cos(az) * Math.cos(up) * d, top.y - 0.15 + Math.sin(up) * d - (dead ? 0.05 : 0.5) * d * d / len, top.z + Math.sin(az) * Math.cos(up) * d));
    }
    const side = V(-Math.sin(az), 0, Math.cos(az));
    const green = dead ? null : leaves;
    for (let k = 1; k < K; k++) {
      const p = pts2[k], q = pts2[k + 1], w = (0.62 * Math.sin(Math.PI * k / K) + 0.1);
      for (const s of [-1, 1]) {
        const tip = p.clone().add(side.clone().multiplyScalar(s * w)).add(V(0, -0.15 * w, 0));
        const nrm = new THREE.Vector3().crossVectors(q.clone().sub(p), tip.clone().sub(p)).normalize();
        if (nrm.y < 0) nrm.negate();
        (green || trunk).tri(p, q, tip, nrm, nrm, nrm, [0.5, 0.5], [0.5, 0.5], [0.5, 0.5], 1, 1, 1);
      }
    }
  }
  return { trunk: trunk.geometry(), leaves: leaves.geometry(), height: H, solidLeaves: true };
}

/** Doum palm: a trunk forking two or three times, each branch with a fan-leaf crown. */
function doumPalm(seed, lod) {
  const rand = rng(seed);
  const trunk = new Mesher(), leaves = new Mesher();
  const H = 9 + rand() * 4;
  const branch = (base, dir, len, r, depth) => {
    const end = base.clone().add(dir.clone().multiplyScalar(len));
    tube(trunk, [[base.x, base.y, base.z, r], [end.x, end.y, end.z, r * 0.85]], lod ? 5 : 7, H);
    if (depth < 2 && rand() < 0.85) {
      for (const s of [-1, 1]) {
        const d = dir.clone().applyAxisAngle(V(0, 1, 0), rand() * Math.PI).applyAxisAngle(V(1, 0, 0), s * (0.35 + rand() * 0.2)).normalize();
        d.y = Math.abs(d.y) + 0.4; d.normalize();
        branch(end, d, len * 0.75, r * 0.8, depth + 1);
      }
    } else {
      // a crown of fan leaves: each a disc of folded segments on a stalk
      const nl = lod ? 6 : 14;
      for (let k = 0; k < nl; k++) {
        const az = rand() * Math.PI * 2, el = -0.2 + rand() * 1.2;
        const fd = V(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
        const c = end.clone().add(fd.clone().multiplyScalar(0.9 + rand() * 0.4));
        const R = 0.75 + rand() * 0.2, segs = lod ? 6 : 14;
        const n0 = fd.clone(), u = new THREE.Vector3().crossVectors(n0, V(0, 1, 0)).normalize(), v = new THREE.Vector3().crossVectors(u, n0).normalize();
        for (let s = 0; s < segs; s++) {
          const a0 = -Math.PI * 0.8 + (s / segs) * Math.PI * 1.6, a1 = a0 + Math.PI * 1.6 / segs;
          const fold = (s % 2 ? 0.08 : -0.08);
          const p0 = c.clone().add(u.clone().multiplyScalar(Math.cos(a0) * R)).add(v.clone().multiplyScalar(Math.sin(a0) * R)).add(n0.clone().multiplyScalar(fold));
          const p1 = c.clone().add(u.clone().multiplyScalar(Math.cos(a1) * R)).add(v.clone().multiplyScalar(Math.sin(a1) * R)).add(n0.clone().multiplyScalar(-fold));
          const nn = n0.y < 0 ? n0.clone().negate() : n0;
          leaves.tri(c, p0, p1, nn, nn, nn, [0.5, 0.5], [0.5, 0.5], [0.5, 0.5], 1, 1, 1);
        }
      }
    }
  };
  branch(V(0, 0, 0), V((rand() - 0.5) * 0.15, 1, (rand() - 0.5) * 0.15).normalize(), H * 0.45, 0.3, 0);
  return { trunk: trunk.geometry(), leaves: leaves.geometry(), height: H, solidLeaves: true };
}

// ── small plants and stones ──────────────────────────────────────────────────

/** Tuft: crossed cards rising from the ground (grass, reeds, scrub). */
function tuft(seed, lod, { h, w, cards }) {
  const rand = rng(seed), leaves = new Mesher();
  const n = lod ? Math.max(2, Math.ceil(cards / 2)) : cards;
  const H = h * (0.7 + rand() * 0.6);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI + rand() * 0.4, ww = w * (0.8 + rand() * 0.4);
    const nrm = V(Math.cos(a), 0, Math.sin(a));
    const off = V((rand() - 0.5) * w * 0.3, 0, (rand() - 0.5) * w * 0.3);
    const u = V(-nrm.z, 0, nrm.x).multiplyScalar(ww / 2);
    const P = [off.clone().sub(u), off.clone().add(u), off.clone().add(u).add(V(0, H, 0)), off.clone().sub(u).add(V(0, H, 0))];
    const up = V(0, 1, 0), N = P.map((p, k) => nrm.clone().lerp(up, k > 1 ? 0.7 : 0.4).normalize());
    leaves.tri(P[0], P[1], P[2], N[0], N[1], N[2], [0, 0], [1, 0], [1, 1], 0, 0, 1);
    leaves.tri(P[0], P[2], P[3], N[0], N[2], N[3], [0, 0], [1, 1], [0, 1], 0, 1, 1);
  }
  return { leaves: leaves.geometry(), height: H };
}

/** Papyrus clump: thin stems with umbels of radiating rays. */
function papyrus(seed, lod) {
  const rand = rng(seed), stems = new Mesher(), leaves = new Mesher();
  const n = lod ? 6 : 16;
  for (let i = 0; i < n; i++) {
    const base = V((rand() - 0.5) * 1.2, 0, (rand() - 0.5) * 1.2), H = 2.2 + rand() * 1.8, lean = V((rand() - 0.5) * 0.4, 1, (rand() - 0.5) * 0.4).normalize();
    const top = base.clone().add(lean.clone().multiplyScalar(H));
    tube(stems, [[base.x, 0, base.z, 0.025], [top.x, top.y, top.z, 0.015]], 3, H + 1);
    const rays = lod ? 8 : 22;
    for (let k = 0; k < rays; k++) {
      const a = rand() * Math.PI * 2, el = 0.2 + rand() * 0.9, L = 0.35 + rand() * 0.2;
      const d = V(Math.cos(a) * Math.cos(el), Math.sin(el) - 0.3, Math.sin(a) * Math.cos(el));
      const end = top.clone().add(d.multiplyScalar(L));
      const side = V(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(0.012);
      const nrm = V(0, 1, 0);
      leaves.tri(top.clone().sub(side), top.clone().add(side), end, nrm, nrm, nrm, [0.5, 0.5], [0.5, 0.5], [0.5, 0.5], 1, 1, 1);
    }
  }
  return { trunk: stems.geometry(), leaves: leaves.geometry(), height: 3.5, solidLeaves: true };
}

/** A boulder: a lumpy, flattened stone. */
function boulder(seed, lod) {
  const rand = rng(seed);
  const g = new THREE.IcosahedronGeometry(1, lod ? 1 : 3).toNonIndexed();
  const p = g.attributes.position;
  const sx = 0.8 + rand() * 1.4, sy = 0.5 + rand() * 0.6, sz = 0.8 + rand() * 1.2;
  const k1 = rand() * 10, k2 = rand() * 10;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 1 + 0.18 * Math.sin(x * 3.1 + k1) * Math.sin(z * 2.7 + k2) + 0.08 * Math.sin(y * 5 + k1);
    p.setXYZ(i, x * sx * n, Math.max(-0.3, y) * sy * n, z * sz * n);
  }
  g.computeVertexNormals();
  g.setAttribute('sway', new THREE.Float32BufferAttribute(new Float32Array(p.count), 1));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(p.count * 2), 2));
  return { trunk: g, height: sy };
}

// ── the catalogue ────────────────────────────────────────────────────────────

/**
 * Species: how to make one variant at a level of detail, which foliage texture and bark to use,
 * the scale range, whether it casts shadows, the distances at which each level is shown.
 */
export const SPECIES = {
  date_palm: { make: datePalm, leafMat: 'palm_leaf', bark: 'palm_trunk', scale: [0.85, 1.15], shadow: true, lod: [140, 1400] },
  doum_palm: { make: doumPalm, leafMat: 'doum_leaf', bark: 'palm_trunk', scale: [0.85, 1.1], shadow: true, lod: [140, 1400] },
  acacia: { make: (s, l) => tree({ height: 7, trunk: { r: 0.22, lean: 0.12, fork: 0.35, limbs: 5, gnarl: 0.4 }, crown: { shape: 'flat', w: 4.2, h: 0.9, y: 0.82, clumps: 9, cards: 30, card: 1.3, up: 0.75 } }, s, l), foliage: 'acacia', bark: 'bark_dark', scale: [0.8, 1.2], shadow: true, lod: [140, 1200] },
  sycamore_fig: { make: (s, l) => tree({ height: 11, trunk: { r: 0.55, lean: 0.03, fork: 0.32, limbs: 6, gnarl: 0.6 }, crown: { shape: 'round', w: 6.5, h: 4, y: 0.65, clumps: 14, cards: 44, card: 1.6, up: 0.25 } }, s, l), foliage: 'broad', bark: 'bark_grey', scale: [0.8, 1.2], shadow: true, lod: [160, 1400] },
  tamarisk: { make: (s, l) => tree({ height: 3.6, trunk: { r: 0.08, lean: 0.2, fork: 0.15, limbs: 5, gnarl: 0.5 }, crown: { shape: 'round', w: 2.2, h: 1.5, y: 0.6, clumps: 7, cards: 24, card: 1.1, up: 0.1 } }, s, l), foliage: 'tamarisk', bark: 'bark_dark', scale: [0.7, 1.3], shadow: true, lod: [90, 700] },
  papyrus: { make: papyrus, leafMat: 'papyrus', bark: 'papyrus', scale: [0.8, 1.2], shadow: false, lod: [70, 500] },
  reeds: { make: (s, l) => tuft(s, l, { h: 2.8, w: 1.6, cards: 6 }), foliage: 'reed', scale: [0.8, 1.3], shadow: false, lod: [70, 500] },
  halfa: { make: (s, l) => tuft(s, l, { h: 0.7, w: 0.9, cards: 4 }), foliage: 'grass_dry', scale: [0.7, 1.4], shadow: false, lod: [45, 200] },
  stone_pine: { make: (s, l) => tree({ height: 15, trunk: { r: 0.32, lean: 0.12, fork: 0.72, limbs: 6, gnarl: 0.2 }, crown: { shape: 'umbrella', w: 6.2, h: 1.6, y: 0.88, clumps: 13, cards: 40, card: 1.7, up: 0.6 } }, s, l), foliage: 'needles', bark: 'bark_pine', scale: [0.8, 1.2], shadow: true, lod: [180, 1600] },
  cypress: { make: (s, l) => tree({ height: 14, trunk: { r: 0.18, lean: 0.01, fork: 0.12, limbs: 0 }, crown: { shape: 'spindle', w: 1.4, h: 6.2, y: 0.55, clumps: 14, cards: 26, card: 1.0, up: 0.0, clumpR: 0.9 } }, s, l), foliage: 'scale', bark: 'bark_dark', scale: [0.8, 1.2], shadow: true, lod: [180, 1600] },
  holm_oak: { make: (s, l) => tree({ height: 10, trunk: { r: 0.32, lean: 0.06, fork: 0.35, limbs: 5, gnarl: 0.4 }, crown: { shape: 'round', w: 4.8, h: 3.6, y: 0.62, clumps: 12, cards: 46, card: 1.3, up: 0.2 } }, s, l), foliage: 'broad', bark: 'bark_grey', scale: [0.8, 1.2], shadow: true, lod: [160, 1400] },
  olive: { make: (s, l) => tree({ height: 6, trunk: { r: 0.3, lean: 0.15, fork: 0.32, limbs: 5, gnarl: 1.2 }, crown: { shape: 'clumps', w: 3.4, h: 1.9, y: 0.68, clumps: 9, cards: 38, card: 1.15, up: 0.2 } }, s, l), foliage: 'olive', bark: 'bark_olive', scale: [0.75, 1.25], shadow: true, lod: [150, 1300] },
  aleppo_pine: { make: (s, l) => tree({ height: 12, trunk: { r: 0.26, lean: 0.25, fork: 0.5, limbs: 6, gnarl: 0.4 }, crown: { shape: 'clumps', w: 4, h: 3, y: 0.75, clumps: 10, cards: 30, card: 1.4, up: 0.4 } }, s, l), foliage: 'needles', bark: 'bark_pine', scale: [0.8, 1.2], shadow: true, lod: [170, 1500] },
  maquis: { make: (s, l) => tree({ height: 1.5, trunk: { r: 0.05, lean: 0.2, fork: 0.1, limbs: 3, gnarl: 0.3 }, crown: { shape: 'round', w: 1.3, h: 0.8, y: 0.5, clumps: 5, cards: 22, card: 0.8, up: 0.3 } }, s, l), foliage: 'broad_dark', bark: 'bark_dark', scale: [0.6, 1.5], shadow: true, lod: [90, 600] },
  oleander: { make: (s, l) => tree({ height: 3, trunk: { r: 0.06, lean: 0.15, fork: 0.15, limbs: 4, gnarl: 0.3 }, crown: { shape: 'round', w: 1.8, h: 1.3, y: 0.6, clumps: 6, cards: 24, card: 0.95, up: 0.1 } }, s, l), foliage: 'oleander', bark: 'bark_dark', scale: [0.7, 1.3], shadow: true, lod: [100, 700] },
  grass: { make: (s, l) => tuft(s, l, { h: 0.38, w: 0.75, cards: 3 }), foliage: 'grass', scale: [0.6, 1.5], shadow: false, lod: [35, 70] },
  grass_dry: { make: (s, l) => tuft(s, l, { h: 0.36, w: 0.7, cards: 3 }), foliage: 'grass_dry', scale: [0.6, 1.5], shadow: false, lod: [35, 70] },
  boulder: { make: boulder, bark: 'rock_boulder', scale: [0.4, 2.4], shadow: true, lod: [160, 1000] },
};

export const VARIANTS = 4;

const built = new Map();
/** Geometry of a species variant at a level of detail (cached). */
export function speciesGeometry(id, variant, lod) {
  const key = `${id}/${variant}/${lod}`;
  if (!built.has(key)) built.set(key, SPECIES[id].make(9973 * (variant + 1) + id.length * 131, lod));
  return built.get(key);
}
