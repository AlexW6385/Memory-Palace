// Props in the "nature" group. Each entry: name: (b, p) => void — see kit.js and docs/props.md.
// b is a Builder (metres, base on y = 0, facing +z); p holds the item's params:
//   { variant, color, color2, text, emoji, pose, hat, hold, seed }
import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { C, shade, mix } from "./kit.js";

const TAU = Math.PI * 2;
const PI = Math.PI;
const lerp = (a, b, t) => a + (b - a) * t;
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// Level of detail of the builder that is running (kit: env.lod < 1 builds coarse mass scenery). The
// exported builders set it from b.lod for their duration, so the geometry helpers below can coarsen
// their own segment counts the way the kit's primitives do, and builders can skip tiny details.
let LOD = 1;
const lodN = (n, min = 3) => (LOD >= 1 ? n : Math.max(min, Math.round(n * LOD)));
const fine = () => LOD >= 1;

/** Build fn with the builder's detail lowered to at most lod (for tiny nested props), then restore it. */
function withDetail(b, lod, fn) {
  const keep = b.lod;
  b.lod = Math.min(keep ?? 1, lod);
  try {
    fn();
  } finally {
    b.lod = keep;
  }
}

// ── geometry helpers (local to this group) ──────────────────────────────────

/** Value at t in 0..1 of a number, a function t => v, or a list of values spread evenly over 0..1. */
function at01(v, t) {
  if (typeof v === "number") return v;
  if (typeof v === "function") return v(t);
  const n = v.length - 1;
  const x = Math.min(n, Math.max(0, t * n));
  const i = Math.min(n - 1, Math.floor(x));
  return v[i] + (v[i + 1] - v[i]) * (x - i);
}

/** Euler angles (XYZ) that turn +y towards the direction d. */
function alignY(d) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v3(d).normalize());
  const e = new THREE.Euler().setFromQuaternion(q, "XYZ");
  return [e.x, e.y, e.z];
}

/** A unit vector perpendicular to n, at angle az around it. */
function perpTo(n, az) {
  const ref = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(n, ref).normalize();
  const w = new THREE.Vector3().crossVectors(n, u).normalize();
  return u.multiplyScalar(Math.cos(az)).addScaledVector(w, Math.sin(az));
}

/** Geometry from a flat list of triangles [[x,y,z],[x,y,z],[x,y,z]] (counter-clockwise seen from outside). */
function trisGeo(tris) {
  const pos = new Float32Array(tris.length * 9);
  tris.forEach((t, i) => t.forEach((p, k) => pos.set(p, i * 9 + k * 3)));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return g;
}

/** Smooth the normals of a geometry across shared positions (for pillowy extrusions). */
function smoothed(g) {
  for (const k of Object.keys(g.attributes)) if (k !== "position") g.deleteAttribute(k);
  const m = mergeVertices(g, 1e-5);
  m.computeVertexNormals();
  return m;
}

/**
 * Extrude a THREE.Shape (or [[x, y], ...]) along z (centred on z = 0) with a rounded bevel.
 * o.warp(v: Vector3) may bend the result before the normals are smoothed.
 */
function extrudeGeo(shape, depth, { bevel = 0.01, bevelSeg = 3, curveSeg = 14, smooth = true, warp } = {}) {
  const s = Array.isArray(shape) ? new THREE.Shape(shape.map(([x, y]) => new THREE.Vector2(x, y))) : shape;
  const g = new THREE.ExtrudeGeometry(s, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: lodN(bevelSeg, 1),
    curveSegments: lodN(curveSeg, 4),
  });
  g.translate(0, 0, -depth / 2);
  if (warp) {
    const pos = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      warp(v.fromBufferAttribute(pos, i));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
  }
  return smooth ? smoothed(g) : g;
}

/** Lathe through a smooth spline of [r, y] control points (bottom to top), resampled to n points. */
function smoothLathe(b, pts, o = {}) {
  const curve = new THREE.SplineCurve(pts.map(([r, y]) => new THREE.Vector2(r, y)));
  b.lathe(curve.getSpacedPoints(lodN(o.n ?? 24, 6)).map((v) => [Math.max(0, v.x), v.y]), o);
}

/** A lumpy ball for foliage and bushes: an icosphere with seeded smooth bumps, radius r. */
function blobGeo(rng, r, { detail = 2, amp = 0.12, freq = 3.2, flat = false } = {}) {
  const g = new THREE.IcosahedronGeometry(1, fine() ? detail : Math.max(1, detail - 1));
  g.deleteAttribute("uv");
  g.deleteAttribute("normal");
  const waves = Array.from({ length: 5 }, () =>
    [v3([rng() - 0.5, rng() - 0.5, rng() - 0.5]).normalize(), rng() * TAU, freq * (0.7 + rng() * 0.6)]);
  const pos = g.attributes.position, p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    let f = 1;
    for (const [n, ph, fr] of waves) f += (amp / 2.2) * Math.sin(p.dot(n) * fr + ph);
    p.multiplyScalar(f * r);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  if (flat) return g;
  const m = mergeVertices(g, 1e-6);
  m.computeVertexNormals();
  return m;
}

/** A rounded box W × H × D (centred) whose faces are finely lumpy: a clipped hedge or topiary. */
function lumpyBoxGeo(rng, W, H, D, { r = 0.06, step = 0.05, amp = 0.012, freq = 55 } = {}) {
  const seg = (s) => Math.max(2, Math.round((s / step) * Math.min(1, LOD)));
  const g = new THREE.BoxGeometry(W, H, D, seg(W), seg(H), seg(D));
  g.deleteAttribute("uv");
  g.deleteAttribute("normal");
  const waves = Array.from({ length: 6 }, () =>
    [v3([rng() - 0.5, rng() - 0.5, rng() - 0.5]).normalize(), rng() * TAU, freq * (0.6 + rng() * 0.8)]);
  const h = [W / 2 - r, H / 2 - r, D / 2 - r];
  const pos = g.attributes.position, p = new THREE.Vector3(), q = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    q.set(Math.max(-h[0], Math.min(h[0], p.x)), Math.max(-h[1], Math.min(h[1], p.y)),
      Math.max(-h[2], Math.min(h[2], p.z)));
    const n = p.clone().sub(q).normalize();
    let d = 0;
    for (const [w, ph, fr] of waves) d += Math.sin(p.dot(w) * fr + ph);
    p.copy(q).addScaledVector(n, r + amp * d / 3);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  return g.toNonIndexed();
}

/**
 * A tube of varying radius along a smooth curve through pts.
 * radius: number, [r0, r1, ...] spread along the tube, or t => r.
 * o: { seg, radial, ex, ey (elliptic section), shape: (angle, t) => radius factor, caps,
 *      up: t => [x, y, z] (orient the section: ex runs along up, ey across it; for ribbons on a surface) }
 */
function sweepGeo(pts, radius, o = {}) {
  const seg = lodN(o.seg ?? 16, 3), radial = lodN(o.radial ?? 10, 4), ex = o.ex ?? 1, ey = o.ey ?? 1;
  const curve = new THREE.CatmullRomCurve3(pts.map(v3), false, "centripetal");
  const fr = curve.computeFrenetFrames(seg, false);
  if (o.up) {
    for (let i = 0; i <= seg; i++) {
      const T = fr.tangents[i], U = v3(o.up(i / seg));
      fr.normals[i].copy(U.addScaledVector(T, -U.dot(T)).normalize());
      fr.binormals[i].crossVectors(T, fr.normals[i]);
    }
  }
  const P = new THREE.Vector3();
  const rings = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    curve.getPointAt(t, P);
    const r = at01(radius, t), N = fr.normals[i], B = fr.binormals[i];
    const out = [];
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * TAU;
      const m = o.shape ? o.shape(a, t) : 1;
      const c = Math.cos(a) * ex * m * r, s = Math.sin(a) * ey * m * r;
      out.push([P.x + c * N.x + s * B.x, P.y + c * N.y + s * B.y, P.z + c * N.z + s * B.z]);
    }
    rings.push({ out, r, P: P.clone() });
  }
  const pos = [], idx = [];
  for (const r of rings) for (const q of r.out) pos.push(q[0], q[1], q[2]);
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j, b = i * radial + (j + 1) % radial;
      const c = (i + 1) * radial + (j + 1) % radial, d = (i + 1) * radial + j;
      idx.push(a, b, d, b, c, d);
    }
  }
  if (o.caps !== false) {
    for (const [ri, end] of [[0, false], [seg, true]]) {
      const R = rings[ri];
      if (R.r < 1e-4) continue;
      const base = pos.length / 3;
      pos.push(R.P.x, R.P.y, R.P.z);
      for (const q of R.out) pos.push(q[0], q[1], q[2]);
      for (let j = 0; j < radial; j++) {
        const p1 = base + 1 + j, p2 = base + 1 + (j + 1) % radial;
        if (end) idx.push(base, p1, p2); else idx.push(base, p2, p1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A two-sided leaf blade from z = 0 to the tip, width along x, upper side facing +y.
 * o: { len, width, outline: u => half-width factor (0..1), spine: u => [y, z],
 *      fold (V crease: edges rise by fold × half-width), cup (edges curl up), us: [u samples], segU, segV }
 */
function bladeGeo(o) {
  const len = o.len, hw = o.width / 2, segV = fine() ? o.segV ?? 2 : 1;
  const segU = lodN(o.segU ?? 10, 2);
  const us = o.us ?? Array.from({ length: segU + 1 }, (_, i) => i / segU);
  const outline = o.outline ?? ((u) => Math.pow(Math.sin(PI * u), 0.7));
  const spine = o.spine ?? ((u) => [0, u * len]);
  const fold = o.fold ?? 0.2, cup = o.cup ?? 0;
  const cols = segV * 2 + 1;
  const pts = [];
  for (const u of us) {
    const w = hw * Math.max(0, outline(u));
    const [y0, z] = spine(u);
    // offsets for the crease and cup run along the spine's normal (so arched blades keep their V)
    const [ya, za] = spine(Math.max(0, u - 0.01)), [yb, zb] = spine(Math.min(1, u + 0.01));
    const tl = Math.hypot(yb - ya, zb - za) || 1;
    const ny = (zb - za) / tl, nz = -(yb - ya) / tl;
    for (let k = 0; k < cols; k++) {
      const v = k / segV - 1;
      const off = fold * Math.abs(v) * w + cup * v * v * w;
      pts.push(v * w, y0 + off * ny, z + off * nz);
    }
  }
  const n = pts.length / 3;
  const pos = pts.concat(pts);
  const idx = [];
  for (let i = 0; i < us.length - 1; i++) {
    for (let k = 0; k < cols - 1; k++) {
      const a = i * cols + k, b = a + 1, d = a + cols, c = d + 1;
      idx.push(a, d, b, b, d, c); // upper side
      idx.push(n + a, n + b, n + d, n + b, n + c, n + d); // underside
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Spine for bladeGeo that leaves the base at elevation a0 and bends steadily to elevation a1 at the tip
 * (radians, 0 = horizontal): an arching frond or leaf. Use with pitch 0.
 */
function arcSpine(len, a0, a1) {
  const k = (a1 - a0) / len;
  if (Math.abs(k) < 1e-4) return (u) => [Math.sin(a0) * len * u, Math.cos(a0) * len * u];
  return (u) => {
    const a = a0 + k * len * u;
    return [-(Math.cos(a) - Math.cos(a0)) / k, (Math.sin(a) - Math.sin(a0)) / k];
  };
}

/** Add a leaf blade pointing along azimuth yaw (0 = +z) and elevation pitch, from point at. */
function blade(b, o) {
  b.geo(bladeGeo(o), { at: o.at, rot: [-(o.pitch ?? 0), o.yaw ?? 0, o.roll ?? 0], order: "YXZ",
    color: o.color, kind: o.kind });
}

/** Outline of a pinnate frond: tapering, with saw-teeth leaflets pointing to the tip. */
function pinnate(teeth, depth = 0.55, base = (u) => Math.pow(Math.sin(PI * Math.min(1, 0.06 + u * 0.94)), 0.6)) {
  teeth = lodN(teeth, 4);
  const us = [0];
  for (let k = 0; k < teeth; k++) for (const f of fine() ? [0.02, 0.5, 0.98] : [0.02, 0.98]) us.push((k + f) / teeth);
  us.push(1);
  const outline = (u) => {
    const f = (u * teeth) % 1;
    return base(u) * (1 - depth + depth * Math.min(1, f / 0.98));
  };
  return { us, outline };
}

/** A faceted stone: icosphere with seeded bumps and flat cuts, scaled to w × h × d, standing on y = 0. */
function rockGeo(rng, w, h, d, o = {}) {
  const g = new THREE.IcosahedronGeometry(1, fine() ? o.detail ?? 1 : Math.max(0, (o.detail ?? 1) - 1));
  g.deleteAttribute("uv");
  g.deleteAttribute("normal");
  const pos = g.attributes.position;
  const waves = Array.from({ length: 3 }, () =>
    [v3([rng() - 0.5, rng() - 0.5, rng() - 0.5]).normalize(), rng() * TAU, 2 + rng() * 2.5]);
  const cuts = Array.from({ length: o.cuts ?? 5 }, () =>
    [v3([rng() - 0.5, (rng() - 0.3) * 1.2, rng() - 0.5]).normalize(), 0.72 + rng() * 0.18]);
  const p = new THREE.Vector3();
  const bottom = -(o.flatBottom ?? 0.62);
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    let f = 1;
    for (const [n, ph, fr] of waves) f += (o.bump ?? 0.09) * Math.sin(p.dot(n) * fr + ph);
    p.multiplyScalar(f);
    for (const [n, c] of cuts) {
      const s = p.dot(n) - c;
      if (s > 0) p.addScaledVector(n, -s);
    }
    if (o.flatTop != null && p.y > o.flatTop) p.y = o.flatTop;
    if (p.y < bottom) p.y = bottom;
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  g.computeBoundingBox();
  const bb = g.boundingBox;
  g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  g.scale(w / (bb.max.x - bb.min.x), h / (bb.max.y - bb.min.y), d / (bb.max.z - bb.min.z));
  return g;
}

/**
 * Lathe whose lower rim is scalloped into `lobes` drooping tips (conifer tiers).
 * pts: [[r, y], ...]; the scallop fades out above y0 + fade.
 */
function scallopLatheGeo(pts, { seg = 36, lobes = 9, amp = 0.08, droop = 0.03, y0 = 0, fade = 0.2 } = {}) {
  seg = lodN(seg, 6);
  if (seg < lobes * 3) amp = droop = 0; // too coarse to carry the scallops: a plain tier
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  g.deleteAttribute("uv");
  g.deleteAttribute("normal");
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = Math.max(0, 1 - (y - y0) / fade);
    const c = Math.cos(lobes * Math.atan2(z, x));
    const f = 1 + amp * c * k;
    pos.setXYZ(i, x * f, y - droop * Math.max(0, c) * k, z * f);
  }
  const m = mergeVertices(g, 1e-6);
  m.computeVertexNormals();
  return m;
}

/** Lumpy foliage blobs [x, y, z, r, scale?], shaded lighter towards the top. */
function foliage(b, balls, base, o = {}) {
  const ys = balls.map((q) => q[1]);
  const lo = Math.min(...ys), hi = Math.max(...ys);
  for (const q of balls) {
    const [x, y, z, r, sc] = q;
    const t = hi > lo ? (y - lo) / (hi - lo) : 0.5;
    const tone = (o.dark ?? -0.05) + t * (o.light ?? 0.1) + (b.rng() - 0.5) * (o.vary ?? 0.04);
    b.geo(blobGeo(b.rng, r, { amp: o.amp ?? 0.1, freq: o.freq ?? 3, flat: !!o.flat }), { at: [x, y, z], scale: sc,
      rot: [0, b.rng() * TAU, 0], color: shade(base, tone), kind: o.kind, flat: !!o.flat });
  }
}

/** Spheres [x, y, z, r, scale?] shaded lighter towards the top: foliage, clouds, blossom. */
function puffs(b, balls, base, o = {}) {
  const ys = balls.map((q) => q[1]);
  const lo = Math.min(...ys), hi = Math.max(...ys);
  for (const q of balls) {
    const [x, y, z, r] = q;
    const t = hi > lo ? (y - lo) / (hi - lo) : 0.5;
    const tone = (o.dark ?? -0.05) + t * (o.light ?? 0.1) + (b.rng() - 0.5) * (o.vary ?? 0.04);
    b.sphere(r, { at: [x, y, z], scale: q[4], color: shade(base, tone), seg: o.seg ?? 16, kind: o.kind });
  }
}

/** Teardrop flame profile along t (0 = rounded base, 1 = pointed tip). */
function flameR(t) {
  if (t < 0.2) return Math.sin((t / 0.2) * PI / 2) ** 0.8;
  return Math.pow((1 - t) / 0.8, 1.35);
}

/** A flame tongue of height h and radius r standing on (0,0,0); lean bends the tip sideways. */
function flameGeo(h, r, lean = 0, depth = 0.85) {
  return sweepGeo([[0, 0, 0], [lean * 0.15, h * 0.32, 0], [-lean * 0.25, h * 0.64, 0], [lean, h, 0]],
    (t) => r * flameR(t), { seg: 16, radial: 12, ey: depth, caps: false });
}

/** A layered flame (outer, middle, core) at `at`, glowing; inner layers step towards the viewer. */
function layeredFlame(b, at, h, r, cols, o = {}) {
  const [x, y, z] = at;
  const lean = o.lean ?? 0;
  const yaw = o.yaw ?? 0;
  b.group({ at: [x, y, z], rot: [0, yaw, o.roll ?? 0] }, () => {
    b.geo(flameGeo(h, r, lean * h), { color: cols[0], kind: "glow", light: o.light !== false });
    b.geo(flameGeo(h * 0.68, r * 0.66, lean * h * 0.6), { at: [0, h * 0.05, r * 0.4], color: cols[1], kind: "glow",
      light: false });
    b.geo(flameGeo(h * 0.4, r * 0.36, lean * h * 0.3), { at: [0, h * 0.1, r * 0.66], color: cols[2], kind: "glow",
      light: false });
  });
}

/** Lightning bolt outline (classic zig-zag), height 1, centred on x. */
const BOLT = [[-0.02, 1.0], [0.16, 1.0], [0.04, 0.62], [0.19, 0.62], [-0.15, 0.0], [-0.03, 0.45], [-0.18, 0.45]];

function boltShape(s = 1) {
  return new THREE.Shape(BOLT.map(([x, y]) => new THREE.Vector2(x * s, y * s)));
}

// ── trees ───────────────────────────────────────────────────────────────────

function treeRound(b, p) {
  const leaf = p.color || "#5f9f45", bark = p.color2 || C.bark;
  b.lathe([[0.12, 0], [0.085, 0.035], [0.068, 0.12], [0.06, 0.5], [0.052, 0.9], [0, 0.9]], { color: bark, seg: 14 });
  b.geo(sweepGeo([[0, 0.5, 0], [0.12, 0.66, 0.03], [0.24, 0.8, 0.05]], [0.04, 0.022], { radial: 7, seg: 8 }),
    { color: bark });
  b.geo(sweepGeo([[0, 0.56, 0], [-0.11, 0.7, -0.02], [-0.22, 0.84, -0.04]], [0.036, 0.02], { radial: 7, seg: 8 }),
    { color: bark });
  puffs(b, [
    [0, 1.12, 0, 0.36], [0.25, 0.98, 0.07, 0.23], [-0.25, 1.0, 0.04, 0.23], [0.06, 0.95, 0.25, 0.22],
    [-0.04, 0.98, -0.25, 0.22], [0.2, 1.3, -0.06, 0.22], [-0.17, 1.33, 0.07, 0.21], [0.03, 1.4, 0.02, 0.2],
    [0.17, 1.17, 0.22, 0.17], [-0.2, 1.18, -0.2, 0.17],
  ], leaf);
}

function treePine(b, p) {
  const leaf = p.color || "#2f7044", bark = p.color2 || C.darkWood;
  b.cyl(0.05, 0.075, 0.34, { at: [0, 0.17, 0], color: bark, seg: 12 });
  const tiers = [[0.44, 0.19, 0.5], [0.37, 0.42, 0.46], [0.3, 0.65, 0.44], [0.22, 0.88, 0.42], [0.14, 1.11, 0.49]];
  tiers.forEach(([R, y0, h], i) => {
    const pts = [[R * 0.25, y0 + 0.07], [R * 0.92, y0], [R, y0 + 0.02], [R * 0.86, y0 + h * 0.13],
      [R * 0.5, y0 + h * 0.48], [R * 0.16, y0 + h * 0.84], [0, y0 + h]];
    b.geo(scallopLatheGeo(pts, { seg: 36, lobes: 9 - Math.min(i, 3), amp: 0.07, droop: 0.025, y0, fade: h * 0.4 }),
      { rot: [0, i * 0.7, 0], color: shade(leaf, -0.03 + i * 0.03) });
  });
}

function treePalm(b, p) {
  const leaf = p.color || "#4f9f43", bark = p.color2 || "#b5895a";
  const top = [0.1, 1.42, 0];
  b.geo(sweepGeo([[0, 0, 0], [0.0, 0.5, 0], [0.04, 1.0, 0], top], (t) => 0.068 - 0.026 * t,
    { seg: 52, radial: 10, shape: (a, t) => 1 + 0.13 * ((t * (fine() ? 13 : 5)) % 1) }), { color: bark });
  b.lathe([[0.1, 0], [0.078, 0.03], [0.066, 0.07], [0, 0.07]], { color: shade(bark, -0.06), seg: 12 });
  b.sphere(0.06, { at: top, color: shade(bark, -0.12), seg: 12 });
  // fronds: long pinnate leaves arching out and drooping
  const fr = pinnate(11, 0.6);
  const n = 7;
  for (let k = 0; k < n; k++) {
    const len = 0.42 + (k % 2) * 0.05;
    blade(b, {
      len, width: 0.17, ...fr, segV: 1, fold: 0.5,
      spine: (u) => [len * (0.28 * u - 0.75 * u * u), len * u],
      at: top, yaw: (k / n) * TAU + 0.25 + (b.rng() - 0.5) * 0.2, pitch: 0.32 + (k % 2) * 0.12,
      color: shade(leaf, ((k % 3) - 1) * 0.04),
    });
  }
  for (let k = 0; k < 3; k++) {
    blade(b, {
      len: 0.34, width: 0.12, ...pinnate(8, 0.55), segV: 1, fold: 0.5,
      spine: (u) => [0.34 * (0.1 * u - 0.25 * u * u), 0.34 * u],
      at: top, yaw: (k / 3) * TAU + 0.9, pitch: 1.05, color: shade(leaf, 0.06),
    });
  }
  for (const [x, z] of [[0.045, 0.04], [-0.04, 0.035], [0.005, -0.05]]) {
    b.sphere(0.045, { at: [top[0] + x, top[1] - 0.07, top[2] + z], color: "#6b4a2b", seg: 12 });
  }
}

function treeBirch(b, p) {
  const leaf = p.color || "#a5c95a", bark = p.color2 || "#efece4";
  const mark = "#2f2b28";
  const trunks = [[[0, 0, 0], [-0.03, 1.3, -0.02], 0.055], [[0.03, 0, 0.03], [0.16, 1.05, 0.07], 0.04]];
  for (const [a, e, r] of trunks) {
    b.rod(a, e, r, { r2: r * 0.55, color: bark, seg: 12 });
    const A = v3(a), dir = v3(e).sub(A), len = dir.length();
    dir.normalize();
    const rot = alignY(dir);
    const marks = fine() ? 9 : 4;
    for (let k = 0; k < marks; k++) {
      const t = 0.07 + k * (0.86 / marks) + (b.rng() - 0.5) * 0.03;
      const pt = A.clone().addScaledVector(dir, len * t);
      const rr = lerp(r, r * 0.55, t) * 1.05;
      b.group({ at: pt.toArray(), rot }, () => {
        b.cyl(rr, rr, 0.016, { thetaStart: b.rng() * TAU, thetaLength: 1.4 + b.rng() * 1.2, open: true,
          color: mark, seg: 12 });
      });
    }
  }
  b.lathe([[0.1, 0], [0.07, 0.03], [0.055, 0.07], [0, 0.07]], { color: bark, seg: 12 });
  // a tall, airy oval crown
  foliage(b, [
    [0.03, 0.98, 0.0, 0.19, [1, 1.15, 1]], [0.1, 1.17, 0.04, 0.19, [1, 1.15, 1]], [-0.07, 1.2, -0.03, 0.18, [1, 1.2, 1]],
    [0.03, 1.4, 0.0, 0.15, [1, 1.2, 1]], [-0.23, 1.04, 0.06, 0.13, [1, 1.25, 1]], [0.27, 1.02, -0.03, 0.13, [1, 1.25, 1]],
    [0.0, 1.1, -0.22, 0.14, [1, 1.2, 1]], [0.04, 1.08, 0.23, 0.14, [1, 1.2, 1]],
  ], leaf, { amp: 0.14, freq: 3.5, light: 0.12 });
}

function treeBlossom(b, p) {
  const pink = p.color || "#f2a2bf", bark = p.color2 || "#5d4339";
  b.lathe([[0.13, 0], [0.09, 0.04], [0.075, 0.1], [0, 0.1]], { color: bark, seg: 12 });
  b.geo(sweepGeo([[0, 0, 0], [0.04, 0.3, 0], [-0.02, 0.56, 0.01]], [0.085, 0.074, 0.06], { seg: 12, radial: 10 }),
    { color: bark });
  const s = [-0.02, 0.54, 0.01];
  const limbs = [
    [s, [-0.18, 0.74, 0.04], [-0.33, 0.93, 0.06]], [s, [0.16, 0.73, -0.04], [0.32, 0.92, -0.08]],
    [s, [0.02, 0.8, 0.16], [0.06, 0.98, 0.28]], [s, [-0.04, 0.8, -0.16], [-0.06, 1.0, -0.27]],
    [s, [0.03, 0.84, 0], [0.04, 1.1, 0]],
  ];
  for (const l of limbs) b.geo(sweepGeo(l, [0.048, 0.022], { seg: 10, radial: 7 }), { color: bark });
  // a broad umbrella of blossom clouds
  const balls = [];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * TAU + 0.2;
    balls.push([Math.cos(a) * 0.3, 1.0 + (b.rng() - 0.5) * 0.06, Math.sin(a) * 0.27, 0.16, [1, 0.8, 1]]);
  }
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + 0.6;
    balls.push([Math.cos(a) * 0.15, 1.18 + (b.rng() - 0.5) * 0.05, Math.sin(a) * 0.13, 0.17, [1, 0.85, 1]]);
  }
  balls.push([0, 1.3, 0, 0.16, [1, 0.85, 1]]);
  foliage(b, balls, pink, { amp: 0.12, freq: 3.5, light: 0.1, vary: 0.07 });
  // little white flowers dotted over the crown
  for (let k = 0; k < (fine() ? 26 : 0); k++) {
    const q = balls[k % balls.length], a = b.rng() * TAU, e = 0.25 + b.rng() * 1.0;
    const n = [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)];
    b.sphere(0.022, { at: [q[0] + n[0] * q[3] * 1.0, q[1] + n[1] * q[3] * 0.82, q[2] + n[2] * q[3] * 1.0],
      rot: alignY(n), scale: [1, 0.4, 1], color: "#fff4f7", seg: 8 });
  }
  // a few fallen petals
  for (let k = 0; k < (fine() ? 9 : 0); k++) {
    const a = b.rng() * TAU, r = 0.18 + b.rng() * 0.25;
    b.cyl(0.018, 0.018, 0.004, { at: [Math.cos(a) * r, 0.002, Math.sin(a) * r], scale: [1, 1, 0.6],
      rot: [0, b.rng() * PI, 0], color: shade(pink, 0.05), seg: 8 });
  }
}

function treeBare(b, p) {
  const bark = p.color2 || "#7c6555";
  const rng = b.rng;
  const segs = [];
  const grow = (base, dir, len, r, depth) => {
    const side = new THREE.Vector3(rng() - 0.5, 0, rng() - 0.5).multiplyScalar(len * 0.25);
    const end = base.clone().addScaledVector(dir, len).add(side);
    const mid = base.clone().lerp(end, 0.5).add(side.clone().multiplyScalar(-0.35));
    segs.push([base, mid, end, r, r * 0.68, depth]);
    if (depth === 0) return;
    const nd = end.clone().sub(mid).normalize();
    const n = depth >= 3 ? 3 : 2;
    const az0 = rng() * TAU;
    for (let k = 0; k < n; k++) {
      const az = az0 + (k / n) * TAU + (rng() - 0.5) * 0.5;
      const spread = depth >= 3 ? 0.62 : 0.45 + rng() * 0.25;
      const d = nd.clone().multiplyScalar(Math.cos(spread)).addScaledVector(perpTo(nd, az), Math.sin(spread));
      d.y += 0.22;
      d.normalize();
      grow(end.clone().addScaledVector(nd, -r * 0.3), d, len * (0.64 + rng() * 0.1), r * 0.64, depth - 1);
    }
  };
  grow(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 0.56, 0.08, 4);
  // fit the skeleton to the catalogue box (positions only, radii unchanged)
  const box = new THREE.Box3();
  for (const sg of segs) box.expandByPoint(sg[2]);
  box.expandByPoint(new THREE.Vector3(0, 0, 0));
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
  const sx = Math.min(0.8 / (box.max.x - box.min.x), 1.5), sz = Math.min(0.8 / (box.max.z - box.min.z), 1.5);
  const sy = 1.53 / box.max.y;
  const fit = (v) => {
    const k = Math.min(1, v.y / 0.56);
    return [(v.x - cx * k) * sx, v.y * sy, (v.z - cz * k) * sz];
  };
  b.lathe([[0.13, 0], [0.09, 0.04], [0.075, 0.12], [0, 0.12]], { color: bark, seg: 12 });
  for (const [a, m, e, r0, r1, depth] of segs) {
    b.geo(sweepGeo([fit(a), fit(m), fit(e)], [r0, r1], { seg: depth >= 2 ? 8 : 4, radial: depth >= 3 ? 9 : depth >= 1 ? 6 : 4,
      caps: depth === 0 }), { color: shade(bark, (4 - depth) * 0.025) });
  }
}

const TREES = { round: treeRound, pine: treePine, palm: treePalm, birch: treeBirch, blossom: treeBlossom, bare: treeBare };

// ── flowers ─────────────────────────────────────────────────────────────────

const STEM = "#4f9a3e";

function stem(b, top, r = 0.007, bend = 0.01) {
  b.geo(sweepGeo([[0, 0, 0], [bend, top[1] * 0.5, 0], top], r, { seg: 10, radial: 6 }), { color: STEM });
}

function flowerTulip(b, p) {
  const col = p.color || "#e0413f";
  stem(b, [0, 0.27, 0], 0.0075, 0.008);
  [0.5, 2.6, 4.6].forEach((yaw, i) => blade(b, {
    len: 0.16 - i * 0.02, width: 0.045, outline: (u) => Math.pow(Math.sin(PI * Math.min(1, 0.1 + u)), 0.6),
    spine: (u) => [0.02 * u - 0.03 * u * u, u * 0.16], fold: 0.5, segU: 8, at: [0, 0.005, 0], yaw,
    pitch: 1.2 - i * 0.1, color: shade(STEM, 0.04),
  }));
  // a cup of six petals
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU, inner = k % 2;
    const rr = inner ? 0.016 : 0.022;
    b.sphere(0.045, { at: [Math.cos(a) * rr, 0.315 + inner * 0.008, Math.sin(a) * rr], scale: [0.62, 1.25, 0.42],
      rot: [0, -a + PI / 2, 0], order: "YXZ", color: shade(col, inner ? -0.06 : 0), kind: "gloss", seg: 14 });
  }
}

function flowerDaisy(b, p) {
  const col = p.color || "#f6f3ea";
  stem(b, [0, 0.3, 0.01], 0.006, -0.01);
  [0.8, 3.6].forEach((yaw, i) => blade(b, {
    len: 0.09, width: 0.035, spine: (u) => [0.02 * u, u * 0.09], fold: 0.3, segU: 6, at: [0, 0.06 + i * 0.05, 0],
    yaw, pitch: 0.5, color: STEM,
  }));
  b.group({ at: [0, 0.31, 0.012], rot: [1.0, 0, 0] }, () => {
    b.sphere(0.024, { at: [0, 0.006, 0], scale: [1, 0.55, 1], color: "#f1b82e", seg: 14 });
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * TAU;
      b.sphere(0.03, { at: [Math.cos(a) * 0.046, 0, Math.sin(a) * 0.046], scale: [0.3, 0.1, 1],
        rot: [0, -a + PI / 2, 0], color: shade(col, (k % 2) * -0.03), seg: 10 });
    }
  });
}

function flowerRose(b, p) {
  const col = p.color || "#c8283f";
  stem(b, [0, 0.29, 0], 0.0065, 0.012);
  [[0.1, 0.6], [0.17, 3.3]].forEach(([y, yaw]) => {
    blade(b, { len: 0.06, width: 0.04, segU: 6, fold: 0.25, at: [0.004, y, 0], yaw, pitch: 0.45,
      color: shade(STEM, -0.04) });
  });
  for (let k = 0; k < 4; k++) {
    b.cone(0.004, 0.012, { at: [0.006, 0.06 + k * 0.05, 0], rot: [0, k * 1.7, -1.2], color: "#3f7a32", seg: 5 });
  }
  b.group({ at: [0, 0.27, 0] }, () => {
    // sepals
    for (let k = 0; k < 5; k++) {
      blade(b, { len: 0.035, width: 0.014, segU: 4, at: [0, 0.01, 0], yaw: (k / 5) * TAU, pitch: -0.3,
        color: STEM });
    }
    b.sphere(0.032, { at: [0, 0.05, 0], scale: [0.8, 1, 0.8], color: shade(col, -0.1), kind: "gloss", seg: 14 });
    b.torus(0.012, 0.006, { at: [0, 0.078, 0], rot: [PI / 2, 0, 0], color: shade(col, -0.16), kind: "gloss",
      seg: 14, tubeSeg: 6 });
    // rings of round, cupped petals: tight in the middle, opening outward
    const round = (u) => Math.sqrt(Math.max(0, 1 - ((u - 0.58) / 0.42) ** 2)) * (0.55 + 0.45 * u);
    const rings = [[3, 0.006, 1.42, 0.05, 0.03], [5, 0.016, 1.2, 0.055, 0.02], [6, 0.024, 0.9, 0.055, 0.01]];
    rings.forEach(([n, rad, pitch, len, y], ri) => {
      for (let k = 0; k < n; k++) {
        const yaw = (k / n) * TAU + ri * 0.9;
        blade(b, {
          len, width: 0.056, outline: round, fold: 0.05, cup: 1.1, segU: 7, segV: 3,
          spine: (u) => [-0.012 * u * u * ri, len * u],
          at: [Math.sin(yaw) * rad, y, Math.cos(yaw) * rad], yaw, pitch,
          color: shade(col, ri * 0.035), kind: "gloss",
        });
      }
    });
  });
}

function flowerSunflower(b, p) {
  const col = p.color || "#f5c02a";
  b.geo(sweepGeo([[0, 0, 0], [0.006, 0.16, 0], [0, 0.27, 0.02]], [0.011, 0.008], { seg: 10, radial: 7 }),
    { color: STEM });
  [[0.1, 0.8], [0.16, 3.9]].forEach(([y, yaw]) => blade(b, {
    len: 0.09, width: 0.07, outline: (u) => Math.pow(Math.sin(PI * Math.min(1, 0.12 + u)), 0.6),
    spine: (u) => [0.03 * u - 0.03 * u * u, u * 0.09], fold: 0.25, segU: 7, at: [0, y, 0], yaw, pitch: 0.35,
    color: shade(STEM, 0.02),
  }));
  b.group({ at: [0, 0.29, 0.03], rot: [PI / 2 - 0.35, 0, 0] }, () => {
    b.cyl(0.04, 0.042, 0.016, { at: [0, -0.004, 0], color: "#3f8a32", seg: 18 });
    b.sphere(0.036, { at: [0, 0.006, 0], scale: [1, 0.4, 1], color: "#5a3a1f", seg: 18 });
    for (let layer = 0; layer < 2; layer++) {
      for (let k = 0; k < 14; k++) {
        const a = ((k + layer * 0.5) / 14) * TAU;
        b.sphere(0.024, { at: [Math.cos(a) * 0.056, -layer * 0.003, Math.sin(a) * 0.056], scale: [0.36, 0.12, 1],
          rot: [0, -a + PI / 2, 0], color: shade(col, layer * -0.06), seg: 10 });
      }
    }
  });
}

const FLOWERS = { tulip: flowerTulip, daisy: flowerDaisy, rose: flowerRose, sunflower: flowerSunflower };

// ── potted plants ───────────────────────────────────────────────────────────

function pot(b, color) {
  b.lathe([[0, 0], [0.112, 0], [0.12, 0.012], [0.145, 0.205], [0.168, 0.21], [0.174, 0.22], [0.174, 0.268],
    [0.166, 0.28], [0.152, 0.278], [0.148, 0.255], [0, 0.255]], { color, seg: 28 });
  b.lathe([[0.149, 0.25], [0.15, 0.262], [0.1, 0.268], [0, 0.27]], { color: "#5b3d2a", seg: 24 });
}

function plantLeafy(b) {
  const leaf = "#3f8a45";
  // an outer ring of arching leaves and an inner ring of upright ones
  const rings = [[7, 0.075, 0.36, 0.14, 0.55, -0.45, 0.12], [5, 0.05, 0.45, 0.15, 0.95, 0.0, 0.12],
    [3, 0.02, 0.52, 0.13, 1.3, 0.6, 0.105]];
  rings.forEach(([n, rad, up, len, a0, a1, width], ri) => {
    for (let k = 0; k < n; k++) {
      const yaw = (k / n) * TAU + ri * 0.45 + (b.rng() - 0.5) * 0.3;
      const s = [Math.sin(yaw) * rad, up, Math.cos(yaw) * rad];
      b.geo(sweepGeo([[0, 0.255, 0], [s[0] * 0.5, (0.255 + up) / 2, s[2] * 0.5], s], 0.007, { seg: 6, radial: 6 }),
        { color: shade(leaf, 0.1) });
      blade(b, {
        len, width, outline: (u) => Math.pow(Math.sin(PI * (0.1 + u * 0.9)), 0.42) * (0.75 + 0.25 * u),
        spine: arcSpine(len, a0, a1), fold: 0.22, cup: 0.15, segU: 9,
        at: s, yaw, color: shade(leaf, ((k % 3) - 1) * 0.05 + ri * 0.04), kind: "gloss",
      });
    }
  });
}

function plantCactus(b) {
  const green = "#4f9a54";
  const ribs = (a) => 1 + 0.09 * Math.cos(a * 8);
  b.geo(sweepGeo([[0, 0.24, 0], [0, 0.45, 0], [0, 0.6, 0], [0, 0.635, 0]],
    (t) => 0.068 * (t > 0.85 ? Math.sqrt(Math.max(0, 1 - ((t - 0.85) / 0.15) ** 2)) : 1),
    { seg: 16, radial: 24, shape: ribs }), { color: green });
  const arms = [
    [[-0.04, 0.36, 0], [-0.1, 0.37, 0], [-0.125, 0.42, 0], [-0.125, 0.49, 0], [-0.125, 0.505, 0]],
    [[0.04, 0.42, 0], [0.095, 0.43, 0], [0.115, 0.48, 0], [0.115, 0.55, 0], [0.115, 0.565, 0]],
  ];
  for (const pts of arms) {
    b.geo(sweepGeo(pts, (t) => 0.036 * (t > 0.86 ? Math.sqrt(Math.max(0, 1 - ((t - 0.86) / 0.14) ** 2)) : 1),
      { seg: 16, radial: 16, shape: ribs }), { color: shade(green, 0.03) });
  }
  // little spines
  for (let k = 0; k < (fine() ? 18 : 0); k++) {
    const a = (k % 8) / 8 * TAU + 0.2, y = 0.3 + (k / 18) * 0.3;
    b.sphere(0.005, { at: [Math.cos(a) * 0.075, y, Math.sin(a) * 0.075], color: "#f1edd8", seg: 5 });
  }
  // a pink flower on top
  for (let k = 0; k < 5; k++) {
    blade(b, { len: 0.03, width: 0.025, segU: 4, cup: 0.6, at: [0, 0.632, 0], yaw: (k / 5) * TAU, pitch: 0.7,
      color: "#ec6f9c" });
  }
  b.sphere(0.009, { at: [0, 0.64, 0], color: "#f6d04d", seg: 8 });
}

function plantFern(b) {
  const leaf = "#4c9a3c";
  // arching fronds: an outer ring spilling over the rim, an inner ring standing up
  const rings = [[9, 0.27, 1.3, -0.15], [6, 0.32, 1.45, 0.35], [3, 0.36, 1.52, 0.8]];
  rings.forEach(([n, len, a0, a1], ri) => {
    for (let k = 0; k < n; k++) {
      const yaw = (k / n) * TAU + ri * 0.5 + (b.rng() - 0.5) * 0.25;
      blade(b, {
        len, width: 0.09, ...pinnate(10, 0.6), segV: 1, fold: 0.35,
        spine: arcSpine(len, a0 + (b.rng() - 0.5) * 0.1, a1),
        at: [0, 0.26, 0], yaw, color: shade(leaf, ((k % 3) - 1) * 0.05 + ri * 0.05),
      });
    }
  });
}

const PLANTS = { leafy: plantLeafy, cactus: plantCactus, fern: plantFern };

// ── mountains ───────────────────────────────────────────────────────────────

/**
 * A faceted low-poly mountain split into bands by height. Returns { rock, snow, grass, rim, floor } geometries
 * (rim/floor only when crater > 0: the crater wall and its floor).
 */
/** Radius of the volcano cone at height fraction s (0 base … 1 crater lip). */
const volcanoR = (R, crater, s) => R * lerp(1, crater, Math.pow(s, 0.8)) * (1 - s * 0.05);

function mountainGeos(rng, { R, H, zs = 0.8, rings = 6, cols = 11, snow = 0.66, grass = 0.16, crater = 0, x0 = 0,
  jitter = 0.26, power = 1.3 }) {
  const ring = [];
  for (let k = 0; k < rings; k++) {
    const s = k / rings;
    const y = H * s + (k > 0 ? (rng() - 0.5) * H * 0.05 : 0);
    const rr = crater ? volcanoR(R, crater, s) : R * Math.pow(1 - s, power);
    const row = [];
    for (let j = 0; j < cols; j++) {
      const a = ((j + (k % 2) * 0.5) / cols) * TAU + (k > 0 ? (rng() - 0.5) * 0.25 : 0);
      const f = k > 0 ? 1 + (rng() - 0.5) * jitter : 1 + (rng() - 0.5) * 0.06;
      row.push([x0 + Math.cos(a) * rr * f, y, Math.sin(a) * rr * f * zs]);
    }
    ring.push(row);
  }
  const tris = [];
  for (let k = 0; k < rings - 1; k++) {
    for (let j = 0; j < cols; j++) {
      const a = ring[k][j], b2 = ring[k][(j + 1) % cols], c = ring[k + 1][(j + 1) % cols], d = ring[k + 1][j];
      tris.push([a, d, b2], [b2, d, c]);
    }
  }
  const top = ring[rings - 1];
  const out = { rock: [], snow: [], grass: [], rim: [], floor: [] };
  if (crater) {
    // the top ring is the crater lip; dip inside to a lava floor
    const yTop = H;
    const lip = top.map(([x, , z]) => [x, yTop + (rng() - 0.5) * 0.02, z]);
    for (let j = 0; j < cols; j++) {
      const a = ring[rings - 2][j], b2 = ring[rings - 2][(j + 1) % cols];
      tris.push([a, lip[j], b2], [b2, lip[j], lip[(j + 1) % cols]]);
    }
    const yIn = yTop - H * 0.1;
    const inner = lip.map(([x, , z]) => [x0 + (x - x0) * 0.62, yIn, z * 0.62]);
    for (let j = 0; j < cols; j++) {
      const j2 = (j + 1) % cols;
      out.rim.push([lip[j], inner[j], lip[j2]], [lip[j2], inner[j], inner[j2]]);
      out.floor.push([inner[j], [x0, yIn, 0], inner[j2]]);
    }
  } else {
    const apex = [x0 + (rng() - 0.5) * R * 0.08, H, 0];
    for (let j = 0; j < cols; j++) tris.push([top[j], apex, top[(j + 1) % cols]]);
  }
  const jit = Array.from({ length: cols * 2 }, () => (rng() - 0.5));
  tris.forEach((t, i) => {
    const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
    const jj = jit[i % jit.length];
    if (!crater && cy > H * (snow + jj * 0.12)) out.snow.push(t);
    else if (cy < H * (grass + jj * 0.08)) out.grass.push(t);
    else out.rock.push(t);
  });
  const geos = {};
  for (const [k, list] of Object.entries(out)) if (list.length) geos[k] = trisGeo(list);
  return geos;
}

function addMountain(b, geos, cols, o = {}) {
  if (geos.grass) b.geo(geos.grass, { color: cols.grass, flat: true, ...o });
  if (geos.rock) b.geo(geos.rock, { color: cols.rock, flat: true, ...o });
  if (geos.snow) b.geo(geos.snow, { color: cols.snow, flat: true, ...o });
  if (geos.rim) b.geo(geos.rim, { color: shade(cols.rock, -0.1), flat: true, ...o });
  if (geos.floor) b.geo(geos.floor, { color: cols.lava, kind: "glow", ...o });
}

// ── water helpers ───────────────────────────────────────────────────────────

/** Side profile of a curling wave (cubic Bézier segments, clockwise from the back foot), facing +x. */
const WAVE = [
  [[-0.44, 0.0], [-0.28, 0.01], [-0.16, 0.24], [-0.04, 0.4]], // back slope
  [[-0.04, 0.4], [0.04, 0.51], [0.2, 0.57], [0.3, 0.5]], // crest
  [[0.3, 0.5], [0.39, 0.44], [0.37, 0.31], [0.29, 0.29]], // lip hanging over
  [[0.29, 0.29], [0.23, 0.28], [0.21, 0.35], [0.25, 0.37]], // curl tip turning in
  [[0.25, 0.37], [0.2, 0.42], [0.1, 0.38], [0.11, 0.28]], // inside the barrel
  [[0.11, 0.28], [0.12, 0.16], [0.3, 0.03], [0.44, 0.0]], // face down to the front foot
];

/** Point on the wave profile at u in [0, WAVE.length] (integer part = segment). */
function waveAt(u) {
  const i = Math.min(WAVE.length - 1, Math.max(0, Math.floor(u))), t = Math.min(1, u - i);
  const [p0, p1, p2, p3] = WAVE[i], s = 1 - t;
  return [0, 1].map((k) => s * s * s * p0[k] + 3 * s * s * t * p1[k] + 3 * s * t * t * p2[k] + t * t * t * p3[k]);
}

/** A band of width w just inside the wave profile between u0 and u1 (the foam on the crest). */
function waveBand(u0, u1, w, n = 48) {
  const outer = [], inner = [];
  for (let i = 0; i <= n; i++) {
    const u = lerp(u0, u1, i / n), p = waveAt(u);
    const a = waveAt(u - 0.01), c = waveAt(u + 0.01);
    const tx = c[0] - a[0], ty = c[1] - a[1], tl = Math.hypot(tx, ty) || 1;
    const ww = w * Math.pow(Math.sin(PI * (i / n)), 0.5);
    outer.push(p);
    inner.push([p[0] + (ty / tl) * ww, p[1] - (tx / tl) * ww]);
  }
  return outer.concat(inner.reverse());
}

/** Colours of water: the floor seen through it and its glassy surface. */
const waterFloor = (col) => mix(col, "#0d4a7a", 0.45);
const waterTop = (col) => mix(col, "#3aa6d6", 0.35);

/** Water: a coloured floor under a glass surface (an elliptic slab). */
function water(b, rx, rz, y0, y1, col, o = {}) {
  b.cyl(1, 1, 0.004, { at: [o.x ?? 0, y0 + 0.002, o.z ?? 0], scale: [rx, 1, rz], color: waterFloor(col),
    seg: o.seg ?? 36 });
  b.cyl(1, 1, y1 - y0, { at: [o.x ?? 0, (y0 + y1) / 2, o.z ?? 0], scale: [rx, 1, rz], color: waterTop(col),
    kind: "glass", seg: o.seg ?? 36 });
}

// ── the props ───────────────────────────────────────────────────────────────

const NATURE = {
  tree(b, p) {
    (TREES[p.variant] || treeRound)(b, p);
  },

  bush(b, p) {
    const leaf = p.color || "#5a9b46";
    const balls = [[0, 0.22, 0, 0.19, [1.15, 1, 1.1]]];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + b.rng() * 0.3;
      balls.push([Math.cos(a) * 0.17, 0.13 + b.rng() * 0.03, Math.sin(a) * 0.16, 0.12 + b.rng() * 0.02,
        [1, 0.95, 1]]);
    }
    balls.push([0.07, 0.32, 0.03, 0.12], [-0.08, 0.3, -0.04, 0.12]);
    foliage(b, balls, leaf, { amp: 0.12, freq: 6.5, light: 0.12, flat: true });
  },

  hedge(b, p) {
    const leaf = p.color || "#4a8a3f";
    const W = 1.16, H = 0.72, D = 0.42;
    b.box(W - 0.04, 0.06, D - 0.06, { at: [0, 0.03, 0], color: "#5d4632", r: 0.01 });
    b.geo(lumpyBoxGeo(b.rng, W, H, D, { r: 0.07, step: 0.045, amp: 0.011, freq: 60 }),
      { at: [0, 0.045 + H / 2, 0], color: leaf, flat: true });
  },

  flower(b, p) {
    (FLOWERS[p.variant] || flowerTulip)(b, p);
  },

  potted_plant(b, p) {
    pot(b, p.color || C.clay);
    (PLANTS[p.variant] || plantLeafy)(b, p);
  },

  sprout(b) {
    smoothLathe(b, [[0.07, 0], [0.067, 0.014], [0.05, 0.032], [0.025, 0.042], [0, 0.045]], { color: "#7a5236",
      seg: 24, n: 14 });
    for (let k = 0; k < 4; k++) {
      const a = b.rng() * TAU;
      b.sphere(0.006, { at: [Math.cos(a) * 0.045, 0.026, Math.sin(a) * 0.045], color: "#a07a58", seg: 6 });
    }
    const g = "#79bf4c";
    b.geo(sweepGeo([[0, 0.03, 0], [0.006, 0.09, 0], [0, 0.14, 0]], [0.0075, 0.0065], { seg: 10, radial: 7 }),
      { color: g });
    for (const yaw of [PI / 2, -PI / 2]) {
      blade(b, {
        len: 0.075, width: 0.055, outline: (u) => Math.pow(Math.sin(PI * Math.min(1, 0.08 + u * 0.95)), 0.5) *
          (u < 0.3 ? 0.4 + 2 * u : 1),
        spine: (u) => [0.012 * Math.sin(PI * u), u * 0.075], fold: 0.25, cup: 0.3, segU: 8,
        at: [0, 0.138, 0], yaw, pitch: 0.55, color: shade(g, 0.04),
      });
    }
  },

  leaf(b, p) {
    const col = p.color || "#5a9e3c";
    const len = 0.38, z0 = -0.19;
    const lift = (u) => 0.01 + 0.006 * Math.sin(PI * u) + 0.02 * u ** 3;
    const out = (u) => Math.pow(Math.sin(PI * Math.pow(u, 0.85)), 0.75);
    const fold = 0.17;
    b.geo(bladeGeo({ len, width: 0.29, outline: out, spine: (u) => [lift(u), z0 + u * len], fold, segU: 14,
      segV: 4 }), { color: col });
    // stalk and midrib
    const vein = shade(col, 0.16);
    b.geo(sweepGeo([[0, 0.006, -0.25], [0, 0.01, -0.215], [0, lift(0.05) + 0.002, z0 + 0.02]], [0.007, 0.006],
      { seg: 6, radial: 6 }), { color: shade(col, -0.05) });
    const rib = [];
    for (let i = 0; i <= 6; i++) { const u = 0.02 + i * 0.15; rib.push([0, lift(u) + 0.003, z0 + u * len]); }
    b.geo(sweepGeo(rib, (t) => 0.0045 * (1 - t * 0.7), { seg: 20, radial: 5 }), { color: vein });
    // side veins following the folded surface
    for (let k = 0; k < 5; k++) {
      const u0 = 0.14 + k * 0.15;
      for (const s of [-1, 1]) {
        const pts = [];
        for (let i = 0; i <= 3; i++) {
          const f = i / 3, u = u0 + f * 0.13;
          const x = s * f * 0.145 * out(u) * 0.8;
          pts.push([x, lift(u) + fold * Math.abs(x) + 0.003, z0 + u * len]);
        }
        b.geo(sweepGeo(pts, 0.0022, { seg: 6, radial: 4 }), { color: vein });
      }
    }
  },

  rock(b, p) {
    const col = p.color || "#a8a39a";
    const v = p.variant || "boulder";
    if (v === "flat") {
      // layered flat slabs, like a ledge of sedimentary stone (flat on top: things can stand on it)
      const slabs = [[0, 0, 0, 0.5, 0.13, 0.44, 0], [0.03, 0.12, -0.02, 0.41, 0.11, 0.36, 0.25],
        [-0.03, 0.22, 0.02, 0.32, 0.09, 0.28, -0.3]];
      slabs.forEach(([x, y, z, w, h, d, ry], i) => {
        b.geo(rockGeo(b.rng, w, h, d, { detail: 2, flatTop: 0.32, flatBottom: 0.38, cuts: 7, bump: 0.05 }),
          { at: [x, y, z], rot: [0, ry, 0], color: shade(col, [-0.04, 0.03, -0.01][i]), flat: true });
      });
    } else if (v === "pile") {
      const stones = [
        [-0.13, 0, 0.06, 0.22, 0.15, 0.2], [0.13, 0, 0.05, 0.24, 0.16, 0.21], [0.0, 0, -0.12, 0.24, 0.15, 0.2],
        [-0.06, 0.12, -0.02, 0.2, 0.13, 0.17], [0.09, 0.12, -0.03, 0.17, 0.12, 0.15], [0.02, 0.22, -0.02, 0.15, 0.13, 0.13],
      ];
      for (const [x, y, z, w, h, d] of stones) {
        b.geo(rockGeo(b.rng, w, h, d, { detail: 1, cuts: 4 }), { at: [x, y, z], rot: [0, b.rng() * TAU, 0],
          color: shade(col, (b.rng() - 0.5) * 0.12), flat: true });
      }
    } else {
      b.geo(rockGeo(b.rng, 0.5, 0.36, 0.44, { detail: 2, cuts: 6 }), { color: col, flat: true });
      b.geo(rockGeo(b.rng, 0.12, 0.07, 0.1, { detail: 1 }), { at: [0.24, 0, 0.16], color: shade(col, -0.05),
        flat: true });
    }
  },

  mountain(b, p) {
    const v = p.variant || "peak";
    const rng = b.rng;
    // little pines on the lower slopes, set on the surface of a cone (R, H, zs, power 1.3) centred at x0, z0
    const pines = (list, R, H, zs, x0 = 0, z0 = 0) => {
      for (const [x, z, s] of list) {
        const q = Math.hypot((x - x0) / R, (z - z0) / (R * zs));
        const y = q < 1 ? H * (1 - Math.pow(q, 1 / 1.3)) - 0.03 : 0;
        withDetail(b, 0.4, () => b.prop("tree", { variant: "pine" }, { at: [x, Math.max(0, y), z], scale: s }));
      }
    };
    if (v === "volcano") {
      const rock = p.color || "#6b5a52";
      const R = 0.68, H = 0.68, crater = 0.27, zs = 0.8;
      const g = mountainGeos(rng, { R, H, zs, rings: 5, cols: 12, crater, grass: 0.1, jitter: 0.1 });
      addMountain(b, g, { rock, grass: "#6f8a4a", lava: "#ff6a1f" });
      // a molten dome in the crater, lava rivers running down the slope
      b.sphere(R * crater * 0.78, { at: [0, H - 0.02, 0], scale: [1, 0.32, zs], color: "#ff8a24", kind: "glow",
        seg: 18 });
      for (const [a, len] of [[1.15, 0.72], [2.25, 0.5], [0.3, 0.42]]) {
        const P = (s, da) => {
          const r = volcanoR(R, crater, s) * 1.04 + 0.012;
          return [Math.cos(a + da) * r, H * s, Math.sin(a + da) * r * zs];
        };
        const pts = [], ups = [];
        for (let i = 0; i <= 5; i++) {
          const s = 0.99 - (i / 5) * len, da = Math.sin(i * 1.7) * 0.06;
          pts.push(P(s, da));
          const A = v3(P(s + 0.02, da)), B = v3(P(s - 0.02, da)), Cc = v3(P(s, da + 0.02));
          const n = new THREE.Vector3().crossVectors(A.clone().sub(B), Cc.sub(v3(P(s, da)))).normalize();
          if (n.x * Math.cos(a) + n.z * Math.sin(a) < 0) n.negate();
          ups.push(n.toArray());
        }
        b.geo(sweepGeo(pts, (t) => 0.024 * (1 - 0.55 * t), { seg: 18, radial: 8, ex: 0.45, ey: 1.6,
          up: (t) => ups[Math.min(5, Math.round(t * 5))] }), { color: "#ff7a26", kind: "glow", light: false });
      }
      puffs(b, [[0.0, H + 0.07, 0, 0.075], [0.04, H + 0.15, -0.02, 0.09], [0.1, H + 0.24, -0.03, 0.085]],
        "#c9c4be", { seg: 14, dark: 0.04, light: -0.1 });
    } else if (v === "twin") {
      const rock = p.color || "#8a93a3";
      const cols = { rock, snow: "#f7f7f4", grass: "#6f9a52" };
      addMountain(b, mountainGeos(rng, { R: 0.5, H: 0.8, zs: 0.85, x0: 0.24, snow: 0.56 }), cols,
        { at: [0, 0, -0.08] });
      addMountain(b, mountainGeos(rng, { R: 0.56, H: 1.0, zs: 0.85, x0: -0.2, snow: 0.58 }), cols,
        { at: [0, 0, 0.05] });
      pines([[0.47, 0.18, 0.13], [0.55, 0.06, 0.1]], 0.5, 0.8, 0.85, 0.24, -0.08);
    } else {
      const rock = p.color || "#8a93a3";
      addMountain(b, mountainGeos(rng, { R: 0.68, H: 1.0, zs: 0.78, snow: 0.56 }),
        { rock, snow: "#f7f7f4", grass: "#6f9a52" });
      pines([[0.44, 0.3, 0.14], [0.56, 0.17, 0.11], [-0.5, 0.27, 0.12]], 0.68, 1.0, 0.78);
    }
  },

  cloud(b, p) {
    const v = p.variant || "fluffy";
    const base = p.color || (v === "storm" ? "#7d8594" : v === "rain" ? "#b7c0cc" : "#f6f7fa");
    const wet = v !== "fluffy";
    const y0 = wet ? 0.1 : 0;
    const s = wet ? 0.82 : 1;
    b.group({ at: [0, y0, 0], scale: s }, () => {
      puffs(b, [
        [-0.3, 0.16, 0.0, 0.15, [1, 0.85, 1]], [-0.1, 0.15, 0.06, 0.17, [1, 0.85, 1]],
        [0.12, 0.15, 0.04, 0.17, [1, 0.85, 1]], [0.31, 0.15, -0.01, 0.14, [1, 0.85, 1]],
        [-0.17, 0.26, -0.03, 0.17], [0.06, 0.3, -0.02, 0.2], [0.24, 0.24, -0.05, 0.14],
        [-0.02, 0.2, -0.12, 0.17],
      ], base, { seg: 18, dark: -0.06, light: 0.08, kind: "matte" });
    });
    if (wet) {
      const rain = v === "storm" ? "#79aee6" : "#4f9fe6";
      for (let k = 0; k < 11; k++) {
        const x = -0.3 + k * 0.06, z = ((k * 37) % 5) / 5 * 0.24 - 0.12;
        if (v === "storm" && Math.abs(x - 0.05) < 0.06 && z > 0) continue; // keep the bolt clear
        const y = 0.04 + ((k * 3) % 4) * 0.022;
        b.capsule(0.009, 0.065, { at: [x, y, z], rot: [0, 0, 0.25], color: rain, kind: "gloss", seg: 6 });
      }
      if (v === "storm") {
        b.geo(extrudeGeo(boltShape(0.42), 0.035, { bevel: 0.008, bevelSeg: 1, smooth: false }),
          { at: [0.04, 0.0, 0.15], rot: [0, 0, 0.12], color: "#ffcf1a", kind: "glow" });
      }
    }
  },

  sun(b, p) {
    const col = p.color || "#ffb81c";
    const c = [0, 0.31, 0];
    b.sphere(0.165, { at: c, scale: [1, 1, 0.58], color: mix(col, "#ffd21a", 0.5), kind: "glow", seg: 24 });
    b.cyl(0.195, 0.195, 0.08, { at: c, rot: [PI / 2, 0, 0], color: col, kind: "glow", light: false, seg: 32 });
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU, len = k % 2 ? 0.075 : 0.11;
      const r = 0.2 + len / 2 - 0.01;
      b.cone(0.045, len, { at: [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, 0], rot: [0, 0, a - PI / 2],
        scale: [1, 1, 0.45], color: mix(col, "#ff7a14", k % 2 ? 0.45 : 0.2), kind: "glow", light: false, seg: 4 });
    }
  },

  moon(b, p) {
    const col = p.color || "#f2d77e";
    // a plump crescent swept along an elliptic arc, horns pointing right
    const Rx = 0.19, Ry = 0.235, a0 = 0.95, a1 = TAU - 0.95, rmax = 0.088;
    const arc = (t) => {
      const a = lerp(a0, a1, t);
      return [Math.cos(a) * Rx + 0.06, 0.25 + Math.sin(a) * Ry, 0];
    };
    const thick = (t) => rmax * Math.pow(Math.sin(PI * t), 0.75);
    const pts = Array.from({ length: 13 }, (_, i) => arc(i / 12));
    b.geo(sweepGeo(pts, thick, { seg: 40, radial: 16, ex: 0.82 }), { rot: [0, 0, -0.12], color: col,
      kind: "gloss" });
    // craters on the front
    b.group({ rot: [0, 0, -0.12] }, () => {
      for (const [t, off, rr] of [[0.5, 0.0, 0.026], [0.36, 0.02, 0.016], [0.63, -0.015, 0.018], [0.44, -0.035, 0.012]]) {
        const [x, y] = arc(t), a = lerp(a0, a1, t);
        const cx = x - Math.cos(a) * off, cy = y - Math.sin(a) * off;
        b.sphere(rr, { at: [cx, cy, thick(t) * 0.82 - rr * 0.15], scale: [1, 1, 0.3], color: shade(col, -0.1),
          seg: 12 });
      }
    });
  },

  star(b, p) {
    const col = p.color || "#ffc61a";
    const R = 0.232, r = 0.1, dz = 0.05, cy = 0.21;
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = PI / 2 + (i * PI) / 5, rr = i % 2 ? r : R;
      pts.push([Math.cos(a) * rr, cy + Math.sin(a) * rr, 0]);
    }
    const front = [[], []], back = [[], []];
    for (let i = 0; i < 10; i++) {
      const p1 = pts[i], p2 = pts[(i + 1) % 10];
      front[i % 2].push([[0, cy, dz], p1, p2]);
      back[i % 2].push([[0, cy, -dz], p2, p1]);
    }
    b.geo(trisGeo(front[0].concat(back[1])), { color: mix(col, "#fff07a", 0.3), kind: "glow" });
    b.geo(trisGeo(front[1].concat(back[0])), { color: mix(col, "#e8860c", 0.35), kind: "glow", light: false });
  },

  planet(b, p) {
    const col = p.color || "#e0a868";
    const ringC = p.color2 || "#ead9b4";
    b.group({ at: [0, 0.25, 0], rot: [0.32, 0, -0.28] }, () => {
      const bands = [0, 0.55, 0.85, 1.2, 1.5, 1.8, 2.2, 2.55, PI];
      for (let i = 0; i < bands.length - 1; i++) {
        const g = new THREE.SphereGeometry(0.21, 32, 4, 0, TAU, bands[i], bands[i + 1] - bands[i]);
        b.geo(g, { color: shade(col, [0.08, -0.04, 0.05, -0.1, 0.02, -0.06, 0.04, 0.08][i]), kind: "matte" });
      }
      b.lathe([[0.26, 0], [0.3, 0.006], [0.315, 0], [0.3, -0.006], [0.26, 0]], { color: shade(ringC, -0.08),
        seg: 48 });
      b.lathe([[0.325, 0], [0.35, 0.005], [0.37, 0], [0.35, -0.005], [0.325, 0]], { color: ringC, seg: 48 });
    });
  },

  pool(b, p) {
    const col = p.color || C.water;
    const v = p.variant || "round";
    const stone = "#c9c2b4";
    if (v === "rect") {
      const W = 1.2, D = 0.8, t = 0.12;
      b.box(W - 2 * t + 0.02, 0.004, D - 2 * t + 0.02, { at: [0, 0.004, 0], color: waterFloor(col), r: 0 });
      b.box(W - 2 * t + 0.02, 0.05, D - 2 * t + 0.02, { at: [0, 0.03, 0], color: waterTop(col), kind: "glass",
        r: 0 });
      const tiles = (n, len, along, fixed, rotY) => {
        for (let i = 0; i < n; i++) {
          const c = -len / 2 + (i + 0.5) * (len / n);
          const at = along === "x" ? [c, 0.035, fixed] : [fixed, 0.035, c];
          b.box(len / n - 0.008, 0.07, t, { at, rot: [0, rotY, 0], color: shade(stone, (b.rng() - 0.5) * 0.06),
            r: 0.012, seg: 1 });
        }
      };
      tiles(5, W, "x", D / 2 - t / 2, 0);
      tiles(5, W, "x", -D / 2 + t / 2, 0);
      tiles(3, D - 2 * t, "z", W / 2 - t / 2, PI / 2);
      tiles(3, D - 2 * t, "z", -W / 2 + t / 2, PI / 2);
    } else {
      const a = 0.53, c = 0.34;
      water(b, a, c, 0, 0.055, col);
      const n = 22;
      for (let k = 0; k < n; k++) {
        const t = (k / n) * TAU;
        const x = Math.cos(t) * a, z = Math.sin(t) * c;
        const psi = Math.atan2(-c * Math.cos(t), -a * Math.sin(t));
        b.box(0.15, 0.065 + b.rng() * 0.015, 0.1, { at: [x, 0.036, z], rot: [0, psi, 0], r: 0.03, seg: 1,
          color: shade(stone, (b.rng() - 0.5) * 0.1) });
      }
      b.torus(0.08, 0.004, { at: [0.12, 0.057, 0.04], rot: [PI / 2, 0, 0], color: "#e3f6fb", kind: "gloss" });
      b.torus(0.14, 0.004, { at: [0.12, 0.057, 0.04], rot: [PI / 2, 0, 0], color: "#e3f6fb", kind: "gloss" });
    }
  },

  wave(b, p) {
    const col = p.color || "#2a7cc4";
    const foam = "#f3faff";
    const depth = 0.24, bevel = 0.035;
    // the crest shrinks a little towards the back, so the wave peels rather than looking extruded
    // the crest dips towards both ends and curves forward, so the wave peels rather than looking extruded
    const warp = (v) => {
      const zn = v.z / (depth / 2 + bevel);
      const s = 1 - 0.13 * zn * zn - 0.05 * Math.max(0, -zn);
      v.x = v.x * s + 0.06 * zn * zn;
      v.y *= s;
    };
    const outline = [];
    for (let u = 0; u < WAVE.length; u += 1 / 18) outline.push(waveAt(u));
    outline.push([0.44, 0]);
    b.geo(extrudeGeo(outline, depth, { bevel, bevelSeg: 4, warp }), { at: [0, bevel * 0.6, 0], color: col,
      kind: "gloss" });
    b.geo(extrudeGeo(waveBand(0.8, 3.0, 0.034), depth + 0.008, { bevel: bevel + 0.003, bevelSeg: 4, warp }),
      { at: [0, bevel * 0.6, 0], color: foam, kind: "gloss" });
    // sea at the foot, with foam where the wave lands and spray off the lip
    b.cyl(1, 1, 0.024, { at: [0.0, 0.012, 0], scale: [0.47, 1, 0.19], color: shade(col, 0.08), kind: "gloss", seg: 32 });
    for (let k = 0; k < 7; k++) {
      const z = -0.13 + k * 0.045;
      b.sphere(0.026 + b.rng() * 0.012, { at: [0.33 + b.rng() * 0.06, 0.03, z], scale: [1, 0.7, 1], color: foam,
        kind: "gloss", seg: 10 });
    }
    for (const [x, y, z, r] of [[0.38, 0.4, 0.06, 0.016], [0.41, 0.33, -0.04, 0.012], [0.4, 0.47, -0.08, 0.012],
      [0.37, 0.3, 0.12, 0.01]]) {
      b.sphere(r, { at: [x, y, z], color: foam, kind: "gloss", seg: 8 });
    }
  },

  campfire(b) {
    const n = 9;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + b.rng() * 0.2;
      b.geo(rockGeo(b.rng, 0.11, 0.075, 0.09, { detail: 1 }), { at: [Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2],
        rot: [0, -a, 0], color: shade("#9a958e", (b.rng() - 0.5) * 0.12), flat: true });
    }
    const wood = "#7a5034", cut = "#d9b07a";
    for (const [a, tilt] of [[0.4, 0.1], [0.4 + PI / 2, 0.16], [0.4 + PI / 4, 0.55], [0.4 + 1.3 * PI, 0.55]]) {
      b.group({ at: [0, 0.05 + tilt * 0.08, 0], rot: [0, a, PI / 2 - tilt], order: "YXZ" }, () => {
        b.cyl(0.032, 0.035, 0.34, { color: wood, seg: 10 });
        b.cyl(0.026, 0.026, 0.005, { at: [0, 0.171, 0], color: cut, seg: 10 });
        b.cyl(0.026, 0.026, 0.005, { at: [0, -0.171, 0], color: cut, seg: 10 });
      });
    }
    const cols = ["#ff7b2c", "#ffb43a", "#fff1a8"];
    layeredFlame(b, [0, 0.07, 0], 0.46, 0.12, cols);
    layeredFlame(b, [0.08, 0.06, -0.03], 0.27, 0.07, cols, { lean: 0.15, light: false });
    layeredFlame(b, [-0.08, 0.06, 0.0], 0.3, 0.07, cols, { lean: -0.15, light: false });
    for (let k = 0; k < 6; k++) {
      const a = b.rng() * TAU, r = 0.05 + b.rng() * 0.08;
      b.sphere(0.012, { at: [Math.cos(a) * r, 0.03, Math.sin(a) * r], color: "#ff6a20", kind: "glow", light: false,
        seg: 6 });
    }
  },

  flame(b, p) {
    const col = p.color || "#ff6f22";
    const cols = [col, mix(col, "#ffc22e", 0.7), "#ffeb9a"];
    layeredFlame(b, [0, 0, 0], 0.5, 0.1, cols, { lean: 0.07 });
    layeredFlame(b, [-0.042, 0.0, -0.005], 0.25, 0.056, cols, { lean: -0.1, light: false, roll: 0.14 });
    layeredFlame(b, [0.045, 0.0, -0.01], 0.2, 0.048, cols, { lean: 0.1, light: false, roll: -0.16 });
  },

  lightning(b, p) {
    const col = p.color || "#ffcf1a";
    b.geo(extrudeGeo(boltShape(0.78), 0.04, { bevel: 0.012, bevelSeg: 1, smooth: false }),
      { at: [0, 0.008, 0.005], color: col, kind: "glow" });
    b.geo(extrudeGeo(boltShape(0.8), 0.03, { bevel: 0.008, bevelSeg: 1, smooth: false }),
      { at: [0.0, 0, -0.012], color: mix(col, "#e8700c", 0.6), kind: "glow", light: false });
  },

  crystal(b, p) {
    const col = p.color || "#8f6ad8";
    b.geo(rockGeo(b.rng, 0.32, 0.1, 0.28, { detail: 1 }), { color: "#77727e", flat: true });
    const list = [
      [0.0, 0.0, 0.0, 0.07, 0.36, 0.06, 0.05], [0.08, 0.02, 0.0, 0.05, 0.24, 0.5, -0.55],
      [-0.08, -0.02, 0.0, 0.05, 0.26, 0.4, 0.55], [0.0, -0.08, 0.0, 0.045, 0.2, -0.55, 0.1],
      [0.02, 0.08, 0.0, 0.04, 0.17, 0.6, 0.05], [-0.07, 0.07, 0, 0.03, 0.13, 0.5, 0.6], [0.09, -0.07, 0, 0.035, 0.15, -0.4, -0.5],
    ];
    list.forEach(([x, z, , r, h, tx, tz], i) => {
      b.group({ at: [x, 0.05, z], rot: [tx, i * 0.7, tz] }, () => {
        const tone = (i % 3) * 0.05 - 0.03;
        b.cyl(r, r, h, { at: [0, h / 2, 0], color: shade(col, tone), kind: "gloss", seg: 6, flat: true });
        b.cone(r, r * 1.6, { at: [0, h + r * 0.8, 0], color: shade(col, tone + 0.12), kind: "gloss", seg: 6,
          flat: true });
      });
    });
  },

  mushroom(b, p) {
    const cap = p.color || "#d8443a";
    const cream = "#f3ead6";
    b.lathe([[0.056, 0], [0.058, 0.012], [0.05, 0.045], [0.043, 0.1], [0.041, 0.15], [0.046, 0.18], [0, 0.18]],
      { color: cream, seg: 18 });
    b.lathe([[0.042, 0.138], [0.06, 0.122], [0.064, 0.118], [0.05, 0.135], [0.043, 0.15]], { color: cream, seg: 18 });
    b.lathe([[0.04, 0.17], [0.12, 0.172], [0.128, 0.178]], { color: "#e9d7bc", seg: 24 });
    const cy = 0.172, rx = 0.13, ry = 0.125;
    b.sphere(1, { at: [0, cy, 0], scale: [rx, ry, rx], thetaLength: PI / 2 + 0.12, color: cap, kind: "gloss",
      seg: 24 });
    const spots = [[0, 0], [0.55, 0.3], [0.55, 1.6], [0.55, 2.9], [0.55, 4.3], [0.55, 5.5], [1.05, 0.9], [1.05, 2.2],
      [1.05, 3.6], [1.05, 5.0], [1.1, 6.0]];
    for (const [phi, th] of spots) {
      const n = [Math.sin(phi) * Math.cos(th) / rx, Math.cos(phi) / ry, Math.sin(phi) * Math.sin(th) / rx];
      const pos = [Math.sin(phi) * Math.cos(th) * rx, cy + Math.cos(phi) * ry, Math.sin(phi) * Math.sin(th) * rx];
      const sz = phi === 0 ? 0.026 : 0.02 - phi * 0.004;
      b.sphere(sz, { at: pos, rot: alignY(n), scale: [1, 0.3, 1], color: "#fbf7ee", seg: 10 });
    }
  },

  fruit(b, p) {
    const v = p.variant || "apple";
    const stalk = "#6b4a2b", leafC = "#5a9e3c";
    const leaf = (at, yaw, len = 0.05) => blade(b, { len, width: len * 0.5, segU: 6, fold: 0.3, at, yaw, pitch: 0.35,
      color: leafC });
    if (v === "orange") {
      b.sphere(0.06, { at: [0, 0.06, 0], scale: [1, 0.96, 1], color: "#f28c24", kind: "gloss", seg: 20 });
      b.cyl(0.008, 0.01, 0.01, { at: [0, 0.121, 0], color: "#6f8a3a", seg: 8 });
      leaf([0.004, 0.122, 0], 0.9, 0.055);
    } else if (v === "pear") {
      smoothLathe(b, [[0, 0.0], [0.03, 0.003], [0.048, 0.02], [0.055, 0.045], [0.047, 0.072], [0.033, 0.092],
        [0.026, 0.11], [0.017, 0.124], [0, 0.129]], { color: "#c6cf4a", kind: "gloss", seg: 24, n: 28 });
      b.geo(sweepGeo([[0, 0.12, 0], [0.004, 0.135, 0], [0.012, 0.145, 0]], 0.004, { seg: 6, radial: 5 }),
        { color: stalk });
      leaf([0.004, 0.13, 0], 1.2, 0.045);
    } else if (v === "banana") {
      // a hand of three bananas hanging from one stem, fanned out
      const yel = "#f2cf45", crown = [-0.04, 0.118, 0];
      [[-0.36, 0.0], [0, 0.012], [0.36, -0.008]].forEach(([yaw, dy], k) => {
        b.group({ at: [crown[0], crown[1] + dy, crown[2]], rot: [0, yaw, 0] }, () => {
          const path = [[0, 0, 0], [0.018, -0.043, 0], [0.048, -0.085, 0], [0.088, -0.105, 0], [0.122, -0.094, 0]];
          b.geo(sweepGeo(path, (t) => 0.019 * Math.pow(Math.sin(PI * Math.min(1, 0.1 + t * 0.9)), 0.5) + 0.004 * (1 - t),
            { seg: 20, radial: 10, shape: (a) => 1 - 0.07 * Math.cos(5 * a) }),
          { color: shade(yel, (k - 1) * 0.03), kind: "gloss" });
          b.sphere(0.007, { at: [0.122, -0.094, 0], color: "#4a3626", seg: 6 });
        });
      });
      b.geo(sweepGeo([[-0.04, 0.11, 0], [-0.045, 0.125, 0], [-0.036, 0.14, 0]], 0.009, { seg: 6, radial: 7 }),
        { color: "#7f8a3a" });
    } else if (v === "grapes") {
      const g = "#6e3f9e";
      const rows = [[0.104, 6, 0.04], [0.08, 5, 0.033], [0.056, 4, 0.025], [0.034, 3, 0.014], [0.018, 1, 0]];
      rows.forEach(([y, n, rad], i) => {
        for (let k = 0; k < n; k++) {
          const a = (k / n) * TAU + i * 0.5;
          b.sphere(0.018, { at: [Math.cos(a) * rad, y, Math.sin(a) * rad], color: shade(g, (b.rng() - 0.5) * 0.08),
            kind: "gloss", seg: 10 });
        }
        if (n >= 5) b.sphere(0.018, { at: [0, y + 0.004, 0], color: g, kind: "gloss", seg: 10 });
      });
      b.geo(sweepGeo([[0, 0.11, 0], [0.004, 0.13, 0], [0.012, 0.142, 0]], 0.004, { seg: 6, radial: 5 }),
        { color: stalk });
      leaf([0.004, 0.125, 0], 2.4, 0.06);
    } else {
      smoothLathe(b, [[0, 0.012], [0.026, 0.003], [0.047, 0.015], [0.059, 0.045], [0.057, 0.078], [0.046, 0.102],
        [0.027, 0.114], [0.01, 0.107], [0, 0.099]], { color: "#d63a2f", kind: "gloss", seg: 24, n: 30 });
      b.geo(sweepGeo([[0, 0.1, 0], [0.003, 0.12, 0], [0.01, 0.135, 0]], 0.0045, { seg: 6, radial: 5 }),
        { color: stalk });
      leaf([0.005, 0.118, 0], 1.0, 0.05);
    }
  },

  ice_block(b) {
    const s = 0.33, y = s / 2 + 0.006, c = s - 0.026;
    // a frosty core gives the ice its colour; a clear glassy shell gives it depth and shine
    b.box(c, c, c, { at: [0, y, 0], r: 0.028, color: "#9fd8ee", kind: "gloss" });
    b.box(s, s, s, { at: [0, y, 0], r: 0.038, color: "#e2f8ff", kind: "glass" });
    // white fracture lines and bubbles just under the surface
    const zf = c / 2 + 0.002, xr = c / 2 + 0.002;
    const lines = [[0.04, 0.13, 0.11, 0.55], [0.085, 0.085, 0.07, -0.5], [-0.07, 0.07, 0.08, 1.1]];
    for (const [x, yy, l, a] of lines) {
      b.box(l, 0.005, 0.003, { at: [x, yy + 0.006, zf], rot: [0, 0, a], color: "#f0faff", r: 0 });
      b.box(0.003, 0.005, l * 0.8, { at: [xr, yy + 0.04, -x], rot: [a, 0, 0], color: "#f0faff", r: 0 });
    }
    for (const [x, yy] of [[-0.1, 0.1], [-0.06, 0.06], [0.11, 0.24], [-0.02, 0.2]]) {
      b.sphere(0.008, { at: [x, yy, zf - 0.002], scale: [1, 1, 0.5], color: "#ffffff", seg: 6 });
    }
    // cartoon shine on the glass: two diagonal glints
    for (const [x, yy, l] of [[-0.085, 0.25, 0.11], [-0.04, 0.275, 0.05]]) {
      b.box(0.016, l, 0.003, { at: [x, yy, s / 2 + 0.008], rot: [0, 0, -0.75], color: "#ffffff", kind: "glow",
        light: false, r: 0.0015 });
    }
    b.box(0.003, 0.08, 0.014, { at: [s / 2 + 0.008, 0.24, 0.1], rot: [0.75, 0, 0], color: "#ffffff", kind: "glow",
      light: false, r: 0.0015 });
    // meltwater puddle
    water(b, 0.205, 0.2, 0, 0.007, "#6cc4ea", { seg: 28 });
  },

  fountain(b, p) {
    const stone = p.color || "#d6cfbf";
    const wcol = "#4aa3c8", stream = "#bfe8f7";
    b.lathe([[0.47, 0], [0.5, 0.015], [0.5, 0.05], [0.47, 0.065], [0.47, 0.17], [0.5, 0.18], [0.5, 0.215],
      [0.475, 0.225], [0.44, 0.22], [0.43, 0.07], [0, 0.07]], { color: stone, seg: 40 });
    water(b, 0.432, 0.432, 0.07, 0.185, wcol, { seg: 40 });
    b.lathe([[0.12, 0.07], [0.12, 0.1], [0.08, 0.13], [0.065, 0.2], [0.06, 0.35], [0.075, 0.45], [0.1, 0.5],
      [0, 0.5]], { color: shade(stone, -0.03), seg: 24 });
    b.lathe([[0.06, 0.48], [0.13, 0.5], [0.24, 0.555], [0.3, 0.59], [0.305, 0.625], [0.29, 0.635], [0.27, 0.62],
      [0, 0.6]], { color: stone, seg: 36 });
    water(b, 0.272, 0.272, 0.6, 0.625, wcol, { seg: 36 });
    b.lathe([[0.05, 0.6], [0.045, 0.7], [0.04, 0.78], [0.06, 0.82], [0, 0.82]], { color: shade(stone, -0.03),
      seg: 18 });
    b.lathe([[0.04, 0.8], [0.1, 0.83], [0.15, 0.86], [0.155, 0.885], [0.14, 0.89], [0, 0.87]], { color: stone,
      seg: 28 });
    water(b, 0.14, 0.14, 0.87, 0.885, wcol, { seg: 28 });
    b.lathe([[0.03, 0.88], [0.022, 0.93], [0.03, 0.95], [0.012, 0.975], [0, 0.98]], { color: shade(stone, -0.05),
      seg: 14 });
    // the jet and the falling water
    b.capsule(0.014, 0.08, { at: [0, 1.02, 0], color: stream, kind: "gloss", seg: 8 });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU + 0.2;
      const pt = (r, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
      b.geo(sweepGeo([pt(0.01, 1.06), pt(0.07, 1.06), pt(0.12, 0.98), pt(0.135, 0.89)], 0.007,
        { seg: 12, radial: 6 }), { color: stream, kind: "gloss" });
    }
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU;
      const pt = (r, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
      b.geo(sweepGeo([pt(0.29, 0.625), pt(0.33, 0.6), pt(0.36, 0.45), pt(0.37, 0.19)], 0.011, { seg: 14, radial: 6 }),
        { color: stream, kind: "gloss" });
    }
  },
};

/** Each builder runs with LOD taken from its Builder (b.lod), restored afterwards so nested props work. */
export default Object.fromEntries(Object.entries(NATURE).map(([name, build]) => [name, (b, p) => {
  const outer = LOD;
  LOD = b.lod ?? 1;
  try {
    build(b, p);
  } finally {
    LOD = outer;
  }
}]));
