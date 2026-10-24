// Props in the "animals" group. Each entry: name: (b, p) => void — see kit.js and docs/props.md.
// b is a Builder (metres, base on y = 0, facing +z); p holds the item's params:
//   { variant, color, color2, text, emoji, pose, hat, hold, seed }
//
// Style: chunky toy animals built from smooth ellipsoids, tapered tubes and thin slabs. Every animal has
// glossy bead eyes with a catchlight. The helpers below are shared by all builders in this file.
import * as THREE from "three";
import { C, shade, mix } from "./kit.js";

const PI = Math.PI;
const TAU = 2 * PI;
const EYE = "#16171b";
const Y_AXIS = new THREE.Vector3(0, 1, 0);

// ── helpers ──────────────────────────────────────────────────────────────────
const vec = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const add = (a, d, s = 1) => [a[0] + d[0] * s, a[1] + d[1] * s, a[2] + d[2] * s];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Segment count scaled by the builder's level of detail (kit's b.seg), for geometry built here directly. */
const segs = (b, n, min = 4) => (b.seg ? b.seg(n, min) : n);

/** Euler rotation that turns the +y axis towards dir (optionally spun about that axis first). */
function aim(dir, spin = 0) {
  const q = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, vec(norm(dir)));
  if (spin) q.multiply(new THREE.Quaternion().setFromAxisAngle(Y_AXIS, spin));
  const e = new THREE.Euler().setFromQuaternion(q, "XYZ");
  return [e.x, e.y, e.z];
}

/** Euler rotation whose local x, y, z axes become the given orthonormal right-handed vectors. */
function basis(x, y, z) {
  const e = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z), "XYZ");
  return [e.x, e.y, e.z];
}

/** Point on an axis-aligned ellipsoid (centre c, radii r) in direction dir, with its outward normal n. */
function onEllipsoid(c, r, dir, lift = 0) {
  const d = norm(dir);
  const k = 1 / Math.hypot(d[0] / r[0], d[1] / r[1], d[2] / r[2]);
  const pt = [c[0] + d[0] * k, c[1] + d[1] * k, c[2] + d[2] * k];
  const n = norm([d[0] / (r[0] * r[0]), d[1] / (r[1] * r[1]), d[2] / (r[2] * r[2])]);
  return { at: add(pt, n, lift), n };
}

/** Ellipsoid with radii [rx, ry, rz] (or one radius) and a segment count that suits its size. */
function ball(b, at, radii, o = {}) {
  const r = typeof radii === "number" ? [radii, radii, radii] : radii;
  const m = Math.max(r[0], r[1], r[2]);
  const seg = o.seg ?? (m > 0.15 ? 22 : m > 0.09 ? 18 : m > 0.05 ? 14 : m > 0.025 ? 12 : 10);
  return b.sphere(1, { ...o, at, scale: r, seg });
}

/**
 * Bead eye centred at `at`, radius r, looking along o.dir: a glossy ball, or an iris ball (o.iris) with a
 * pupil (o.pupil = relative size; o.slit for a vertical slit, o.bar for a horizontal bar), plus a catchlight.
 */
function eye(b, at, r, o = {}) {
  const d = norm(o.dir || [0, 0, 1]);
  const seg = o.seg ?? (r > 0.009 ? 14 : 10);
  b.sphere(r, { at, color: o.iris || o.color || EYE, kind: "gloss", seg });
  let front = r;
  if (o.iris) {
    const pr = r * (o.pupil ?? 0.6);
    const sc = o.slit ? [0.34, 0.45, 1] : o.bar ? [1, 0.45, 0.68] : [1, 0.45, 1];
    b.sphere(pr, { at: add(at, d, r - pr * 0.3), rot: aim(d, o.spin || 0), scale: sc, color: EYE, kind: "gloss", seg: 10 });
    front = r + pr * 0.15;
  }
  if (o.glint !== false) {
    const g = norm([d[0], d[1] + 0.7, d[2] + 0.45]);
    b.sphere(r * (o.glintSize ?? 0.27), { at: add(at, g, front), color: "#ffffff", kind: "gloss", seg: 6 });
  }
}

/**
 * Tube along a smooth curve through pts with radius r(t), t = 0..1 along the curve (a number, [r0, r1] or a
 * function). The cross-section can be an ellipse: o.sx scales it sideways, o.sy along the "up" direction o.up;
 * o.arc = [a0, a1] builds only part of it (0..PI is the upper half); o.lockUp keeps that half facing up along
 * the whole curve. o.paint(t) can return a colour per stretch (bands); o.cap0 / o.cap1 add round end caps.
 */
function sweep(b, pts, radius, o = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map(vec), false, "centripetal");
  const n = segs(b, o.seg ?? Math.max(10, pts.length * 6), 4);
  const radial = segs(b, o.radial ?? 10, o.arc ? 3 : 5);
  const [a0, a1] = o.arc || [0, TAU];
  const rf = typeof radius === "function" ? radius
    : Array.isArray(radius) ? (t) => radius[0] + (radius[1] - radius[0]) * t : () => radius;
  const sx = o.sx ?? 1, sy = o.sy ?? 1;
  const P = [], T = [], N = [];
  for (let i = 0; i <= n; i++) {
    P.push(curve.getPointAt(i / n));
    T.push(curve.getTangentAt(i / n).normalize());
  }
  // rotation-minimising frames, starting with the normal as close to "up" as possible
  const up = vec(o.up || [0, 1, 0]);
  const nrm = up.clone().addScaledVector(T[0], -up.dot(T[0]));
  if (nrm.lengthSq() < 1e-8) nrm.set(1, 0, 0).addScaledVector(T[0], -T[0].x);
  nrm.normalize();
  N.push(nrm.clone());
  const axis = new THREE.Vector3();
  for (let i = 1; i <= n; i++) {
    axis.crossVectors(T[i - 1], T[i]);
    const s = axis.length();
    if (s > 1e-9) nrm.applyAxisAngle(axis.divideScalar(s), Math.atan2(s, T[i - 1].dot(T[i])));
    nrm.addScaledVector(T[i], -nrm.dot(T[i])).normalize();
    N.push(nrm.clone());
  }
  if (o.lockUp) {
    for (let i = 0; i <= n; i++) {
      const v = up.clone().addScaledVector(T[i], -up.dot(T[i]));
      if (v.lengthSq() > 1e-4) N[i] = v.normalize();
    }
  }
  const B = T.map((t, i) => new THREE.Vector3().crossVectors(t, N[i]));
  const col = (i) => (o.paint ? o.paint((i + 0.5) / n) : o.color);
  const emit = (i0, i1, color) => {
    const pos = [], nor = [], idx = [];
    const q = new THREE.Vector3();
    for (let i = i0; i <= i1; i++) {
      const r = rf(i / n);
      for (let j = 0; j <= radial; j++) {
        const v = a0 + ((a1 - a0) * j) / radial, c = Math.cos(v), s = Math.sin(v);
        const u = c * r * sx, w = s * r * sy;
        pos.push(P[i].x + B[i].x * u + N[i].x * w, P[i].y + B[i].y * u + N[i].y * w, P[i].z + B[i].z * u + N[i].z * w);
        q.set(0, 0, 0).addScaledVector(B[i], c / sx).addScaledVector(N[i], s / sy).normalize();
        nor.push(q.x, q.y, q.z);
      }
    }
    for (let i = 0; i < i1 - i0; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j, a2 = a + radial + 1;
        idx.push(a, a2, a + 1, a2, a2 + 1, a + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    b.geo(g, { color, kind: o.kind });
  };
  let s0 = 0;
  for (let i = 1; i <= n; i++) {
    if (i === n || col(i) !== col(s0)) {
      emit(s0, i, col(s0));
      s0 = i;
    }
  }
  const cap = (i, back) => {
    const r = rf(i / n);
    if (r < 1e-4) return;
    const t = back ? T[i].clone().negate() : T[i];
    const x = back ? B[i].clone().negate() : B[i];
    b.sphere(r, { at: P[i].toArray(), rot: basis(x, t, N[i]), scale: [sx, o.capLen ?? 1, sy],
      color: col(Math.min(i, n - 1)), kind: o.kind, seg: Math.max(8, radial) });
  };
  if (o.cap0) cap(0, true);
  if (o.cap1) cap(n, false);
  return { P, T, N, B, n };
}

/** Teardrop solid along +y: a round end of radius R (y = 0..R) tapering to a point at y = L. */
function teardrop(b, R, L, o = {}) {
  const pts = [];
  const pw = o.pow ?? 1.3;
  for (let i = 0; i <= 5; i++) {
    const a = (i / 5) * (PI / 2);
    pts.push([R * Math.sin(a), R * (1 - Math.cos(a))]);
  }
  const n2 = o.n ?? 8;
  for (let i = 1; i <= n2; i++) {
    const t = i / n2;
    pts.push([R * Math.pow(Math.cos((t * PI) / 2), pw), R + (L - R) * t]);
  }
  const { pow, n, ...rest } = o;
  return b.lathe(pts, { seg: 14, ...rest });
}

/** Radius of a teardrop(R, L) at height y along its axis. */
function teardropR(R, L, y, pw = 1.3) {
  if (y <= R) return Math.sqrt(Math.max(0, R * R - (R - y) ** 2));
  return R * Math.pow(Math.max(0, Math.cos(((y - R) / (L - R)) * (PI / 2))), pw);
}

/** Smooth closed 2D outline through pts (centripetal Catmull-Rom), n samples. */
function smooth2(pts, n = 32) {
  const c = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, "centripetal");
  return c.getSpacedPoints(n).slice(0, n).map((v) => [v.x, v.y]);
}

/** Smooth open lathe profile [[r, y], ...] through control points. */
function profile(pts, n = 16) {
  const c = new THREE.CatmullRomCurve3(pts.map(([r, y]) => new THREE.Vector3(r, y, 0)), false, "centripetal");
  return c.getPoints(n).map((v) => [Math.max(0, v.x), v.y]);
}

/** Scale a 2D outline towards a centre point. */
const shrink2 = (pts, k, c = [0, 0]) => pts.map(([x, y]) => [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k]);
const scale2 = (pts, k) => pts.map(([x, y]) => [x * k, y * k]);

const ellipse2 = (a, e, n = 20, cx = 0, cy = 0) =>
  Array.from({ length: n }, (_, i) => [cx + a * Math.cos((i / n) * TAU), cy + e * Math.sin((i / n) * TAU)]);

// Orientations for extruded outlines (b.extrude draws in local xy and extrudes along local z):
const FIN = [0, PI / 2, 0]; // outline x → backwards (-z), y → up; thin along x (a vertical fin)
const FLAT = [PI / 2, 0, 0]; // outline x → x, y → forwards (+z); thin along y (lying flat)

// ── fish body: a two-tone lathe bent into a swimming curve ───────────────────
/** Sideways swimming bend: x offset and yaw at depth z for bend { z0 (nose), L, A (offset at the tail) }. */
function bendAt(bd, z) {
  const s = Math.max(0, (bd.z0 - z) / bd.L);
  return { dx: bd.A * s * s, yaw: -Math.atan((2 * bd.A * s) / bd.L) };
}

function fishBody(b, prof, o) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(0, o.yc, o.z0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(PI / 2, 0, 0)), new THREE.Vector3(o.sx, 1, 1));
  const part = (phiStart, phiLength, color, seg) => {
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), segs(b, seg, 3), phiStart, phiLength);
    g.applyMatrix4(m);
    const pos = g.attributes.position, nor = g.attributes.normal, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const k = bendAt(o.bend, pos.getZ(i));
      pos.setX(i, pos.getX(i) + k.dx);
      v.fromBufferAttribute(nor, i).applyAxisAngle(Y_AXIS, k.yaw);
      nor.setXYZ(i, v.x, v.y, v.z);
    }
    b.geo(g, { color });
  };
  // phi = PI is the top after the rotation; the top colour wraps a little below the sides
  const sp = o.split ?? 0.3;
  part(PI / 2 - sp, PI + 2 * sp, o.top, 12);
  part((3 * PI) / 2 + sp, PI - 2 * sp, o.belly, 8);
}

/** A vertical fin outline placed at (y, z) on a bent fish body, following the bend. */
function fishFin(b, bd, outline, y, z, color, thick = 0.005) {
  const k = bendAt(bd, z);
  b.extrude(outline, thick, { at: [k.dx, y, z], rot: [0, PI / 2 + k.yaw, 0], color, bevel: thick * 0.3 });
}

// ── egg geometry ─────────────────────────────────────────────────────────────
const EGG = { R: 0.0585, H: 0.158, K: 0.15 };

/** Point on the egg at polar angle th (0 = bottom, PI = top) and azimuth ph, offset along the normal. */
function eggAt(th, ph, off = 0) {
  const r = EGG.R * Math.sin(th) * (1 + EGG.K * Math.cos(th));
  const y = (EGG.H / 2) * (1 - Math.cos(th));
  const dr = EGG.R * (Math.cos(th) * (1 + EGG.K * Math.cos(th)) - EGG.K * Math.sin(th) ** 2);
  const dy = (EGG.H / 2) * Math.sin(th);
  const l = Math.hypot(dr, dy) || 1;
  const nr = dy / l, ny = -dr / l;
  const rr = r + nr * off, yy = y + ny * off;
  return { p: [rr * Math.sin(ph), yy, rr * Math.cos(ph)], n: [nr * Math.sin(ph), ny, nr * Math.cos(ph)] };
}

function eggProfile(n = 18) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const q = eggAt((i / n) * PI, 0).p;
    return [Math.max(0, q[2]), q[1]];
  });
}

/** A piece of egg shell between polar angles lo(ph) and hi(ph), with thickness and rounded broken rims. */
function eggShell(b, lo, hi, o) {
  const M = segs(b, o.M ?? 36, 12), N = segs(b, o.N ?? 9, 3), th = o.thick ?? 0.004;
  for (const [off, inner] of [[0, false], [-th, true]]) {
    const pos = [], nor = [], idx = [];
    for (let j = 0; j <= M; j++) {
      const ph = (j / M) * TAU;
      const a = lo(ph), c = hi(ph);
      for (let i = 0; i <= N; i++) {
        const q = eggAt(a + ((c - a) * i) / N, ph, off);
        pos.push(...q.p);
        nor.push(...(inner ? q.n.map((x) => -x) : q.n));
      }
    }
    for (let j = 0; j < M; j++) {
      for (let i = 0; i < N; i++) {
        const a = j * (N + 1) + i, bq = (j + 1) * (N + 1) + i;
        if (inner) idx.push(a, a + 1, bq, bq, a + 1, bq + 1);
        else idx.push(a, bq, a + 1, bq, bq + 1, a + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    b.geo(g, { color: inner ? o.inside : o.color });
  }
  for (const edge of o.rims || []) {
    const pts = [];
    for (let j = 0; j < M; j++) pts.push(eggAt(edge((j / M) * TAU), (j / M) * TAU, -th / 2).p);
    b.tube(pts, th * 0.62, { closed: true, color: o.color, seg: M, radial: 5 });
  }
}

/** Triangle wave in [-amp, amp] with `teeth` periods around the circle. */
const zigzag = (ph, teeth, amp, phase = 0) => {
  const u = ((((ph / TAU) * teeth + phase) % 1) + 1) % 1;
  return amp * (u < 0.5 ? 4 * u - 1 : 3 - 4 * u);
};

// ── birds ────────────────────────────────────────────────────────────────────
const BIRDS = {
  pigeon: { body: "#9aa3ae", wing: "#b7bfc9", neck: "#5f8f86", head: "#8a94a2", beak: "#3a3a3a", leg: "#d0706a",
    bar: "#3c4049", iris: "#e8873a", cere: "#ebe8e2" },
  dove: { body: "#f4f2ec", wing: "#e6e3db", neck: "#f4f2ec", beak: "#e0a092", leg: "#e08a80" },
  owl: { body: "#a07a52", wing: "#7b5a3a", neck: "#ecdcbc", beak: "#d9a43a", leg: "#d9a43a", iris: "#f2b02c" },
  eagle: { body: "#6b4a30", wing: "#5a3e28", neck: "#f2efe6", beak: "#f0c040", leg: "#f0c040", tail: "#f2efe6" },
  crow: { body: "#2c2f36", wing: "#22252b", neck: "#2c2f36", beak: "#1c1d20", leg: "#2a2a2a" },
  parrot: { body: "#3fae4a", wing: "#2f6fc4", neck: "#e0453a", beak: "#f2e6c8", leg: "#8a8a8a", face: "#f6f2ea",
    tail: "#2f6fc4" },
};

// Shapes per species: body ellipsoid (centre, radii, pitch = front up), neck blob, head, eye [azimuth,
// elevation, radius], beak [length, radius, droop] or hook [length, radius], tail and folded wing.
const BIRD_FORM = {
  pigeon: { pitch: 0.38, bc: [0, 0.14, -0.025], br: [0.127, 0.092, 0.13], neck: [0, 0.2, 0.055], nr: [0.078, 0.072, 0.07],
    hc: [0, 0.247, 0.078], hr: 0.053, eye: [1.0, 0.25, 0.011], beak: [0.03, 0.011, 0.12],
    tail: { at: [0, 0.105, -0.13], len: 0.11, w0: 0.05, w1: 0.08, drop: 0.32 },
    wing: { y: 0.2, z: 0.45, len: 0.21, R: 0.05, out: -0.001, drop: 0.12, roll: 0.2 } },
  dove: { pitch: 0.36, bc: [0, 0.137, -0.025], br: [0.127, 0.09, 0.126], neck: [0, 0.196, 0.05], nr: [0.07, 0.068, 0.064],
    hc: [0, 0.24, 0.072], hr: 0.049, eye: [0.95, 0.22, 0.0095], beak: [0.026, 0.0095, 0.12],
    tail: { at: [0, 0.105, -0.125], len: 0.125, w0: 0.045, w1: 0.07, drop: 0.3 },
    wing: { y: 0.2, z: 0.45, len: 0.21, R: 0.048, out: -0.001, drop: 0.12, roll: 0.2 } },
  crow: { pitch: 0.28, bc: [0, 0.142, -0.02], br: [0.127, 0.092, 0.128], neck: [0, 0.196, 0.06], nr: [0.072, 0.07, 0.068],
    hc: [0, 0.238, 0.083], hr: 0.056, eye: [0.95, 0.28, 0.0095], beak: [0.052, 0.017, 0.08],
    tail: { at: [0, 0.112, -0.125], len: 0.1, w0: 0.05, w1: 0.075, drop: 0.28 },
    wing: { y: 0.2, z: 0.45, len: 0.22, R: 0.05, out: -0.001, drop: 0.12, roll: 0.2 } },
  eagle: { pitch: 0.95, bc: [0, 0.152, -0.03], br: [0.128, 0.1, 0.13], neck: [0, 0.238, 0.025], nr: [0.08, 0.07, 0.072],
    hc: [0, 0.272, 0.058], hr: 0.057, eye: [0.68, 0.22, 0.0105], hook: [0.05, 0.019], brow: true,
    tail: { at: [0, 0.08, -0.1], len: 0.1, w0: 0.05, w1: 0.08, drop: 0.85 },
    wing: { y: 0.2, z: 0.5, len: 0.22, R: 0.052, out: -0.001, drop: 0.12, roll: 0.18 } },
  parrot: { pitch: 1.0, bc: [0, 0.155, -0.02], br: [0.125, 0.092, 0.12], neck: [0, 0.225, 0.025], nr: [0.072, 0.066, 0.064],
    hc: [0, 0.262, 0.045], hr: 0.056, eye: [0.9, 0.25, 0.0095], hook: [0.052, 0.021], face: true,
    tail: { at: [0, 0.1, -0.085], len: 0.17, w0: 0.035, w1: 0.042, drop: 0.55 },
    wing: { y: 0.2, z: 0.5, len: 0.2, R: 0.048, out: -0.001, drop: 0.12, roll: 0.18 } },
};

// a tail fan: narrow at the root, widening to an almost straight, slightly notched end
const fanShape = (w0, w1, len) =>
  smooth2([[-w0 / 2, 0], [w0 / 2, 0], [w1 * 0.5, len * 0.9], [w1 * 0.4, len], [w1 * 0.12, len * 0.97], [-w1 * 0.12, len * 0.97],
    [-w1 * 0.4, len], [-w1 * 0.5, len * 0.9]], 32);

/** Tail fan at `at`, pointing back and down by `drop`; o.band paints a dark band across its end. */
function tailFan(b, t, color, band) {
  const th = 0.009;
  b.group({ at: t.at, rot: [-PI / 2 - t.drop, 0, 0] }, () => {
    b.extrude(fanShape(t.w0, t.w1, t.len), th, { color, bevel: 0.003 });
    if (band) {
      const hw = (y) => t.w0 / 2 + ((t.w1 - t.w0) / 2) * Math.min(1, y / (t.len * 0.9)) - 0.004;
      const y0 = t.len * 0.74, y1 = t.len * 0.93;
      b.extrude([[-hw(y0), y0], [hw(y0), y0], [hw(y1), y1], [-hw(y1), y1]], th + 0.003, { color: band, bevel: 0.002 });
    }
  });
}

function birdFeet(b, color, x, z, legTop, talons) {
  b.mirrorX(() => {
    b.cyl(0.0072, 0.0065, legTop, { at: [x, legTop / 2 + 0.004, z], color, seg: 8 });
    const ankle = [x, 0.0058, z];
    for (const a of [-0.5, 0, 0.5]) {
      const tip = [x + Math.sin(a) * 0.03, 0.0045, z + Math.cos(a) * 0.03];
      b.rod(ankle, tip, 0.0055, { r2: 0.0038, color, seg: 6 });
      if (talons) b.cone(0.0035, 0.01, { at: add(tip, [Math.sin(a) * 0.004, 0, Math.cos(a) * 0.004]),
        rot: aim([Math.sin(a), -0.5, Math.cos(a)]), color: "#2b2622", seg: 5 });
    }
    b.rod(ankle, [x, 0.0045, z - 0.02], 0.005, { r2: 0.0035, color, seg: 6 });
  });
}

function hookBeak(b, base, len, r, color) {
  const [x, y, z] = base;
  sweep(b, [[x, y + r * 0.25, z - r * 0.8], [x, y + r * 0.4, z + len * 0.4], [x, y, z + len * 0.85],
    [x, y - len * 0.42, z + len * 0.92]], (t) => r * (1 - 0.85 * Math.pow(t, 1.4)),
  { color, sx: 0.8, radial: 10, seg: 18, kind: "gloss", cap0: true });
  b.cone(r * 0.62, len * 0.42, { at: [x, y - r * 0.65, z + len * 0.22], rot: [PI / 2 + 0.35, 0, 0],
    color: shade(color, -0.1), seg: 8 });
}

/**
 * A folded wing on a body ellipsoid with radii br, built in the body's own frame (long axis z, front +z): from
 * the shoulder (w.y, w.z as fractions of the radii) it runs back along the flank and converges over the tail.
 * w: { y, z, len, R (half height), out (offset from the surface), drop (fall per metre), roll (lean onto the body) }.
 * bar = colour for two wing bars.
 */
function foldedWing(b, br, w, color, bar) {
  const [rx, ry, rz] = br;
  const surf = (y, z) => rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2 - (z / rz) ** 2));
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    // the front of the wing grows out of the shoulder (no flipper sticking out when seen from the front)
    const t = i / 8, z = w.z * rz - t * w.len, y = w.y * ry - w.drop * t * w.len;
    const out = w.out - 0.017 * (1 - smoothstep(0, 0.4, t));
    pts.push([surf(y, z) * (1 - 0.6 * smoothstep(0.55, 1, t)) + out, y, z]);
  }
  const R = w.R;
  const rad = (t) => (t < 0.16 ? R * Math.sqrt(Math.max(0, 1 - ((0.16 - t) / 0.16) ** 2))
    : R * Math.pow(Math.cos(((t - 0.16) / 0.84) * (PI / 2)), 1.2));
  sweep(b, pts, rad, { sx: 0.34, up: [-Math.sin(w.roll), Math.cos(w.roll), 0], lockUp: true, seg: 30, radial: 16, color,
    paint: bar ? (t) => ((t > 0.46 && t < 0.52) || (t > 0.6 && t < 0.66) ? bar : color) : undefined });
}

function songbird(b, v, pal) {
  const f = BIRD_FORM[v];
  birdFeet(b, pal.leg, 0.036, 0.0, 0.07, v === "eagle");
  tailFan(b, f.tail, pal.tail || pal.wing, pal.bar);
  ball(b, f.bc, f.br, { rot: [-f.pitch, 0, 0], color: pal.body });
  ball(b, f.neck, f.nr, { color: pal.neck });
  ball(b, f.hc, f.hr, { color: pal.head });
  // folded wings: placed in the body's own (pitched) frame, the shoulder on the body surface and the wing
  // running back along the flank, tilted to lie against it, tips converging over the tail
  b.group({ at: f.bc, rot: [-f.pitch, 0, 0] }, () => b.mirrorX(() => foldedWing(b, f.br, f.wing, pal.wing, pal.bar)));
  // eyes
  const [az, el, er] = f.eye;
  const ed = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
  if (f.face) b.mirrorX(() => b.sphere(f.hr + 0.0015, { at: f.hc, rot: aim(ed), thetaLength: 0.62, color: pal.face, seg: 14 }));
  b.mirrorX(() => eye(b, add(f.hc, ed, f.hr - er * 0.3), er, { dir: ed, iris: pal.iris, pupil: 0.62 }));
  if (f.brow) {
    // a fierce brow ridge over each eye, lower towards the beak
    b.mirrorX(() => ball(b, add(add(f.hc, ed, f.hr * 0.9), [-0.003, er * 1.05, 0.004]), [er * 0.75, er * 0.42, er * 1.9],
      { rot: [0.5, -0.75, 0], color: shade(pal.head, -0.05), seg: 12 }));
  }
  // beak
  if (f.hook) {
    hookBeak(b, add(f.hc, norm([0, -0.1, 1]), f.hr * 0.86), f.hook[0], f.hook[1], pal.beak);
  } else {
    const [len, r, droop] = f.beak;
    const base = add(f.hc, norm([0, -0.12, 1]), f.hr * 0.86);
    b.cone(r, len, { at: add(base, [0, -Math.sin(droop), Math.cos(droop)], len / 2), rot: [PI / 2 + droop, 0, 0],
      color: pal.beak, seg: 10 });
    if (pal.cere) ball(b, add(base, [0, r * 0.75, r * 0.9]), [r * 0.75, r * 0.5, r * 1.0], { color: pal.cere });
  }
}

function owl(b, pal) {
  // feet with talons, peeking out under the belly
  b.mirrorX(() => {
    for (const a of [-0.4, 0, 0.4]) {
      const tip = [0.036 + Math.sin(a) * 0.026, 0.0062, 0.07 + Math.cos(a) * 0.026];
      b.rod([0.036, 0.008, 0.06], tip, 0.0078, { r2: 0.0055, color: pal.leg, seg: 6 });
      b.cone(0.004, 0.011, { at: add(tip, [Math.sin(a) * 0.004, -0.001, Math.cos(a) * 0.005]),
        rot: aim([Math.sin(a), -0.6, Math.cos(a)]), color: "#2b2622", seg: 5 });
    }
  });
  // tail sticking out behind
  tailFan(b, { at: [0, 0.085, -0.09], len: 0.11, w0: 0.05, w1: 0.075, drop: 0.6 }, pal.wing);
  // round body with a pale chest and feather chevrons
  ball(b, [0, 0.13, -0.01], [0.128, 0.125, 0.115], { color: pal.body });
  const CC = [0, 0.12, 0.022], CR = [0.092, 0.098, 0.096];
  ball(b, CC, CR, { color: pal.neck });
  for (const [x, y] of [[0.03, 0.15], [0, 0.12], [0.045, 0.1], [0.02, 0.075]]) {
    b.mirrorX((bb, side) => {
      if (side < 0 && x === 0) return;
      const s = onEllipsoid(CC, CR, [x / CR[0], (y - CC[1]) / CR[1], 0.8]);
      ball(b, s.at, [0.006, 0.002, 0.003], { rot: aim(s.n), color: shade(pal.body, -0.08), seg: 8 });
    });
  }
  // head with a heart-shaped facial disc and big eyes looking up at the visitor
  ball(b, [0, 0.245, 0.0], [0.092, 0.078, 0.084], { color: pal.body });
  b.mirrorX(() => ball(b, [0.033, 0.243, 0.05], [0.046, 0.05, 0.034], { color: pal.neck }));
  b.mirrorX(() => ball(b, [0.033, 0.247, 0.06], [0.032, 0.033, 0.024], { color: shade(pal.neck, 0.04) }));
  b.mirrorX(() => eye(b, [0.034, 0.249, 0.08], 0.021, { dir: [0.1, 0.32, 1], iris: pal.iris, pupil: 0.64 }));
  sweep(b, [[0, 0.238, 0.074], [0, 0.235, 0.089], [0, 0.223, 0.093]], (t) => 0.0105 * (1 - 0.75 * t),
    { color: pal.beak, sx: 0.8, seg: 10, radial: 8, kind: "gloss", cap0: true });
  // ear tufts
  b.mirrorX(() => b.cone(0.022, 0.055, { at: [0.056, 0.315, -0.005], rot: [-0.1, 0, -0.42], scale: [1, 1, 0.5],
    color: pal.wing, seg: 10 }));
  // wings folded down the sides
  b.mirrorX(() => b.group({ at: [0.112, 0.19, -0.015], rot: [0, 0.1, -0.1] }, () =>
    teardrop(b, 0.052, 0.17, { rot: [-(PI / 2 + 1.25), 0, 0], scale: [0.36, 1, 1], color: pal.wing })));
}

// ── builders ─────────────────────────────────────────────────────────────────
export default {
  // Reference bird: six species with distinct silhouettes (upright owl, hooked eagle and parrot, black crow,
  // white dove, grey pigeon with wing bars). color = body, color2 = neck / head accent.
  bird(b, p) {
    const v = BIRDS[p.variant] ? p.variant : "pigeon";
    const pal = { ...BIRDS[v] };
    pal.head = pal.head || pal.neck;
    if (p.color) {
      pal.body = p.color;
      pal.wing = shade(p.color, -0.1);
      if (v === "pigeon") pal.head = shade(p.color, -0.05);
    }
    if (p.color2) {
      pal.neck = p.color2;
      if (v !== "pigeon") pal.head = p.color2;
    }
    if (v === "owl") owl(b, pal);
    else songbird(b, v, pal);
  },

  // A sitting cat: haunches, upright chest, front legs, triangular ears, tail curling behind.
  cat(b, p) {
    const fur = p.color || "#e39a52";
    const dark = shade(fur, -0.14);
    const cream = mix(fur, "#fff8ee", 0.75);
    const pink = "#e8949c";
    sweep(b, [[0.03, 0.03, -0.12], [0.07, 0.021, -0.2], [0.1, 0.021, -0.27], [0.105, 0.04, -0.325],
      [0.085, 0.075, -0.345], [0.065, 0.09, -0.33]], (t) => 0.02 - 0.005 * t,
    { paint: (t) => (t > 0.25 && Math.floor(t * 10) % 2 ? dark : fur), cap1: true, radial: 10, seg: 36 });
    ball(b, [0, 0.08, -0.055], [0.1, 0.08, 0.1], { color: fur });
    b.mirrorX(() => {
      ball(b, [0.055, 0.07, -0.04], [0.05, 0.066, 0.088], { color: fur });
      ball(b, [0.075, 0.016, 0.02], [0.026, 0.016, 0.05], { color: cream });
    });
    ball(b, [0, 0.155, 0.012], [0.07, 0.115, 0.068], { rot: [0.28, 0, 0], color: fur });
    ball(b, [0, 0.155, 0.017], [0.04, 0.1, 0.07], { rot: [0.28, 0, 0], color: cream });
    b.mirrorX(() => {
      b.rod([0.034, 0.17, 0.045], [0.036, 0.02, 0.085], 0.019, { r2: 0.017, color: fur, seg: 10 });
      ball(b, [0.036, 0.016, 0.093], [0.022, 0.016, 0.028], { color: cream });
    });
    const H = [0, 0.268, 0.058], HR = [0.074, 0.064, 0.064];
    ball(b, H, HR, { color: fur });
    for (const x of [-0.018, 0, 0.018]) {
      b.sphere(1, { at: H, scale: [0.006, HR[1] + 0.0015, HR[2] + 0.0015], rot: [-0.45, x * 6, 0], thetaLength: 0.7,
        color: dark, seg: 10 });
    }
    b.mirrorX(() => ball(b, [0.016, 0.244, 0.108], 0.02, { color: cream }));
    ball(b, [0, 0.232, 0.1], 0.015, { color: cream });
    ball(b, [0, 0.258, 0.122], [0.011, 0.007, 0.007], { color: pink, kind: "gloss" });
    b.mirrorX(() => eye(b, [0.031, 0.281, 0.106], 0.015, { dir: [0.3, 0.2, 1], iris: "#b8cf4a", pupil: 0.75, slit: true }));
    b.mirrorX(() => b.group({ at: [0.042, 0.322, 0.045], rot: [-0.1, -0.25, -0.32] }, () => {
      b.cone(0.031, 0.062, { scale: [1, 1, 0.5], color: fur, seg: 12 });
      b.cone(0.02, 0.042, { at: [0, -0.004, 0.008], scale: [1, 1, 0.35], color: pink, seg: 12 });
    }));
    b.mirrorX(() => {
      for (const dy of [-0.006, 0.002, 0.01]) b.rod([0.028, 0.246, 0.118], [0.085, 0.246 + dy * 1.6, 0.13], 0.0011,
        { color: "#f6f0e6", seg: 4 });
    });
  },

  // A standing dog: sturdy legs with white paws, floppy ears, collar with a tag, tail raised.
  dog(b, p) {
    const fur = p.color || "#a8703f";
    const white = "#f4ede2";
    const ear = shade(fur, -0.16);
    b.mirrorX(() => {
      for (const z of [0.13, -0.13]) {
        b.rod([0.07, 0.24, z], [0.072, 0.03, z + 0.006], 0.033, { r2: 0.029, color: fur, seg: 12 });
        ball(b, [0.072, 0.022, z + 0.02], [0.034, 0.022, 0.043], { color: white });
      }
      ball(b, [0.066, 0.24, 0.125], [0.046, 0.072, 0.056], { color: fur }); // shoulder
      ball(b, [0.064, 0.225, -0.12], [0.052, 0.085, 0.075], { color: fur }); // haunch
    });
    ball(b, [0, 0.255, -0.005], [0.11, 0.1, 0.185], { color: fur });
    ball(b, [0, 0.25, 0.12], [0.085, 0.088, 0.072], { color: white });
    sweep(b, [[0, 0.3, -0.165], [0, 0.33, -0.22], [0, 0.37, -0.25], [0, 0.4, -0.245]], [0.028, 0.015],
      { paint: (t) => (t > 0.78 ? white : fur), cap1: true, seg: 16 });
    ball(b, [0, 0.322, 0.14], [0.072, 0.088, 0.07], { rot: [0.45, 0, 0], color: fur });
    b.torus(0.07, 0.011, { at: [0, 0.312, 0.148], rot: [-(PI / 2 - 0.45), 0, 0], color: C.red, seg: 28, tubeSeg: 8 });
    b.cyl(0.015, 0.015, 0.004, { at: [0, 0.263, 0.212], rot: [PI / 2 - 0.25, 0, 0], color: C.gold, kind: "metal", seg: 14 });
    ball(b, [0, 0.37, 0.172], [0.086, 0.078, 0.08], { color: fur });
    ball(b, [0, 0.342, 0.24], [0.052, 0.044, 0.062], { color: white });
    ball(b, [0, 0.357, 0.3], [0.02, 0.015, 0.013], { color: EYE, kind: "gloss" });
    ball(b, [0, 0.317, 0.27], [0.016, 0.006, 0.02], { rot: [-0.3, 0, 0], color: "#e07a86" });
    b.mirrorX(() => eye(b, [0.036, 0.389, 0.236], 0.0125, { dir: [0.35, 0.25, 1] }));
    b.mirrorX(() => ball(b, [0.032, 0.41, 0.228], [0.012, 0.005, 0.008], { rot: [0, 0, -0.2], color: ear }));
    b.mirrorX(() => b.group({ at: [0.068, 0.418, 0.16], rot: [0.12, 0, 0.3] }, () =>
      teardrop(b, 0.036, 0.115, { rot: [PI, 0, 0], scale: [0.42, 1, 1], color: ear })));
  },

  // A fish swimming towards +z with a gentle sideways bend: goldfish (round, double tail), plain or shark.
  fish(b, p) {
    const v = ["goldfish", "plain", "shark"].includes(p.variant) ? p.variant : "goldfish";
    if (v === "goldfish") {
      const top = p.color || "#f0862a", belly = mix(top, "#ffe2a0", 0.55), fin = mix(top, "#ffd9b0", 0.3);
      const yc = 0.1, bd = { z0: 0.11, L: 0.22, A: 0.018 };
      const prof = profile([[0, 0], [0.02, 0.006], [0.034, 0.035], [0.06, 0.085], [0.072, 0.13], [0.066, 0.172],
        [0.046, 0.202], [0.02, 0.218], [0, 0.222]], 18);
      fishBody(b, prof, { yc, z0: -0.112, sx: 0.64, top, belly, bend: bd });
      const tail = smooth2(scale2([[0, 0.012], [0.03, 0.04], [0.085, 0.08], [0.13, 0.088], [0.135, 0.05], [0.1, 0.012],
        [0.115, -0.03], [0.125, -0.065], [0.085, -0.075], [0.035, -0.04], [0, -0.012]], 0.92), 36);
      // double tail: two lobes splayed either side of the (bent) body axis, flaring out at the bottom like a skirt
      const k = bendAt(bd, -0.113);
      for (const s of [-1, 1]) {
        b.group({ at: [k.dx, yc, -0.113], rot: [0, k.yaw + s * 0.2, -s * 0.24] }, () =>
          b.extrude(tail, 0.005, { rot: FIN, color: fin, bevel: 0.0015 }));
      }
      fishFin(b, bd, smooth2([[-0.04, 0], [-0.03, 0.03], [0.0, 0.052], [0.035, 0.045], [0.065, 0.018], [0.075, 0]], 24),
        yc + 0.06, 0.0, fin);
      fishFin(b, bd, smooth2([[-0.02, 0], [0.0, -0.03], [0.035, -0.04], [0.05, -0.02], [0.05, 0]], 20), yc - 0.055, -0.04, fin);
      b.mirrorX(() => b.group({ at: [0.03, yc - 0.03, 0.045], rot: [0, 0.45, -0.55] }, () =>
        b.extrude(ellipse2(0.024, 0.013, 16, 0.02, -0.006), 0.004, { rot: FLAT, color: fin, bevel: 0.0012 })));
      b.mirrorX(() => eye(b, [0.036, yc + 0.024, 0.068], 0.018, { dir: [0.8, 0.2, 0.55], iris: "#f6d27a", pupil: 0.68 }));
      b.torus(0.009, 0.004, { at: [0, yc - 0.004, 0.11], color: shade(top, -0.14), seg: 14, tubeSeg: 6 });
      return;
    }
    if (v === "plain") {
      const top = p.color || "#3f86bf", belly = "#eef2ee", fin = mix(top, "#cfe6f2", 0.4);
      const yc = 0.1, bd = { z0: 0.13, L: 0.27, A: 0.03 };
      const prof = profile([[0, 0], [0.014, 0.004], [0.02, 0.04], [0.04, 0.11], [0.054, 0.17], [0.051, 0.215],
        [0.035, 0.25], [0.014, 0.268], [0, 0.272]], 18);
      fishBody(b, prof, { yc, z0: -0.142, sx: 0.74, top, belly, split: 0.12, bend: bd });
      fishFin(b, bd, smooth2([[0, 0.014], [0.05, 0.05], [0.115, 0.09], [0.1, 0.045], [0.075, 0.0], [0.1, -0.045],
        [0.115, -0.09], [0.05, -0.05], [0, -0.014]], 36), yc, -0.13, fin);
      fishFin(b, bd, [[-0.04, 0], [-0.015, 0.05], [0.01, 0.056], [0.06, 0.012], [0.07, 0]], yc + 0.045, 0.0, fin);
      fishFin(b, bd, [[-0.01, 0], [0.01, -0.03], [0.035, -0.03], [0.04, 0]], yc - 0.044, -0.06, fin);
      b.mirrorX(() => b.group({ at: [0.028, yc - 0.02, 0.05], rot: [0, 0.5, -0.5] }, () =>
        b.extrude(ellipse2(0.026, 0.011, 16, 0.022, -0.006), 0.004, { rot: FLAT, color: fin, bevel: 0.0012 })));
      b.mirrorX(() => eye(b, [0.028, yc + 0.014, 0.085], 0.014, { dir: [0.85, 0.15, 0.45], iris: "#f2f0e8", pupil: 0.7 }));
      ball(b, [0, yc - 0.008, 0.128], [0.012, 0.005, 0.006], { color: shade(top, -0.25) });
      return;
    }
    // shark: counter-shaded, tall dorsal fin, crescent tail, swept pectoral fins, gill slits
    const top = p.color || "#7e8b98", belly = "#eef0ec", fin = top;
    const yc = 0.095, bd = { z0: 0.17, L: 0.33, A: 0.03 };
    const prof = profile([[0, 0], [0.012, 0.004], [0.018, 0.04], [0.036, 0.12], [0.05, 0.2], [0.048, 0.26],
      [0.036, 0.3], [0.016, 0.326], [0, 0.334]], 20);
    fishBody(b, prof, { yc, z0: -0.162, sx: 0.88, top, belly, split: 0.05, bend: bd });
    fishFin(b, bd, scale2([[-0.048, 0], [-0.03, 0.03], [-0.005, 0.062], [0.012, 0.082], [0.014, 0.07], [0.012, 0.035],
      [0.03, 0.0]], 1.18), yc + 0.04, 0.01, fin, 0.007);
    fishFin(b, bd, scale2([[0.0, -0.012], [0.0, 0.014], [0.04, 0.045], [0.085, 0.09], [0.088, 0.078], [0.07, 0.03], [0.065, 0.0],
      [0.08, -0.04], [0.07, -0.045], [0.035, -0.022]], 1.12), yc + 0.004, -0.155, fin, 0.007);
    fishFin(b, bd, [[-0.01, 0], [0.004, 0.018], [0.018, 0.016], [0.02, 0]], yc + 0.034, -0.1, fin, 0.004);
    b.mirrorX(() => b.group({ at: [0.03, yc - 0.024, 0.06], rot: [0, 0, -0.72] }, () =>
      b.extrude([[0, 0.022], [0, -0.012], [0.043, -0.048], [0.039, -0.032]], 0.006, { rot: FLAT, color: fin, bevel: 0.002 })));
    b.mirrorX(() => {
      for (let i = 0; i < 4; i++) {
        b.capsule(0.0016, 0.022, { at: [0.041 - i * 0.0005, yc + 0.002, 0.098 - i * 0.011], rot: [0, 0, 0.12],
          color: shade(top, -0.25), seg: 6 });
      }
      eye(b, [0.027, yc + 0.018, 0.115], 0.008, { dir: [0.9, 0.25, 0.35] });
    });
    sweep(b, [[-0.024, yc - 0.024, 0.115], [0, yc - 0.03, 0.133], [0.024, yc - 0.024, 0.115]], 0.0025,
      { color: "#4a3a3a", seg: 12, radial: 6 });
  },

  // A standing horse: smooth barrel, jointed legs with hooves, arched neck with mane, long face with a blaze.
  horse(b, p) {
    const coat = p.color || "#9b5f37";
    const mane = "#2e2520", hoof = "#3b3430", white = "#f4efe6";
    const muzzle = shade(coat, -0.1);
    const leg = (top, knee, fet) => {
      b.rod(top, knee, 0.042, { r2: 0.03, color: coat, seg: 12 });
      ball(b, knee, 0.028, { color: coat, seg: 10 });
      b.rod(knee, fet, 0.025, { r2: 0.023, color: mane, seg: 10 });
      ball(b, fet, 0.026, { color: mane, seg: 10 });
      b.cyl(0.03, 0.035, 0.055, { at: [fet[0], 0.0275, fet[2] + 0.006], color: hoof, seg: 14 });
    };
    const x = 0.068;
    b.mirrorX(() => {
      // upper legs start inside the barrel so no cut ends show at the shoulders and hips
      leg([x, 0.56, 0.155], [x, 0.26, 0.175], [x, 0.075, 0.185]);
      leg([x, 0.56, -0.19], [x, 0.27, -0.25], [x, 0.075, -0.225]);
      ball(b, [0.06, 0.5, 0.14], [0.052, 0.095, 0.065], { color: coat, seg: 14 });
      ball(b, [0.064, 0.51, -0.19], [0.056, 0.105, 0.088], { color: coat, seg: 14 });
    });
    sweep(b, [[0, 0.565, -0.19], [0, 0.545, -0.04], [0, 0.552, 0.11]], (t) => 0.122 + 0.006 * Math.sin(PI * t),
      { sx: 1.05, color: coat, cap0: true, cap1: true, capLen: 0.95, seg: 12, radial: 18 });
    sweep(b, [[0, 0.63, -0.3], [0, 0.6, -0.36], [0, 0.48, -0.41], [0, 0.33, -0.42], [0, 0.2, -0.4]],
      (t) => 0.026 + 0.03 * Math.sin(PI * Math.min(1, t * 1.1)) * (1 - 0.3 * t), { sx: 0.6, color: mane, cap1: true, seg: 28 });
    sweep(b, [[0, 0.57, 0.14], [0, 0.69, 0.225], [0, 0.8, 0.285]], [0.088, 0.058], { sx: 0.74, color: coat, seg: 12, radial: 14 });
    sweep(b, [[0, 0.878, 0.305], [0, 0.832, 0.24], [0, 0.775, 0.2], [0, 0.725, 0.165], [0, 0.665, 0.11], [0, 0.62, 0.065]],
      (t) => 0.025 + 0.012 * Math.sin(PI * t), { sx: 0.55, color: mane, cap0: true, cap1: true, seg: 18 });
    b.group({ at: [0, 0.775, 0.385], rot: [0.85, 0, 0] }, () => {
      ball(b, [0, 0, 0], [0.058, 0.06, 0.135], { color: coat });
      ball(b, [0, 0, 0], [0.014, 0.0615, 0.1365], { color: white, seg: 16 });
    });
    ball(b, [0, 0.785, 0.34], [0.06, 0.07, 0.065], { color: coat });
    ball(b, [0, 0.675, 0.465], [0.052, 0.048, 0.054], { color: muzzle });
    b.mirrorX(() => ball(b, [0.023, 0.684, 0.512], 0.008, { color: "#2a2120", seg: 8 }));
    b.mirrorX(() => eye(b, [0.052, 0.8, 0.375], 0.013, { dir: [0.85, 0.15, 0.5] }));
    b.mirrorX(() => b.cone(0.021, 0.058, { at: [0.033, 0.895, 0.315], rot: [0.25, 0, -0.18], scale: [1, 1, 0.6], color: coat, seg: 10 }));
    teardrop(b, 0.02, 0.07, { at: [0, 0.89, 0.31], rot: aim([0, -0.4, 1]), scale: [1, 1, 0.5], color: mane, seg: 10 });
  },

  // A coiled snake: a tapering body piled in a low spiral, the neck rising from the middle to a raised head.
  snake(b, p) {
    const skin = p.color || "#5aa83e";
    const saddle = shade(skin, -0.17);
    const belly = mix(skin, "#f3e7a2", 0.62);
    const R = 0.031;
    const turns = 2.0, th1 = -PI / 2, th0 = th1 - turns * TAU;
    const rho0 = 0.228, rho1 = 0.115, S = 72;
    const pts = [];
    for (let i = 0; i <= S; i++) {
      const u = i / S, th = th0 + (th1 - th0) * u, rho = rho0 + (rho1 - rho0) * u;
      pts.push([rho * Math.cos(th), 0.036 * smoothstep(0.55, 1.05, u * turns), rho * Math.sin(th)]);
    }
    // the neck climbs steeply from the back of the inner loop, then bends forward (an S) to the raised head
    pts.push([0.038, 0.1, -0.085], [0.022, 0.145, -0.035], [0.006, 0.166, 0.028], [0, 0.163, 0.085]);
    const L = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]));
    const radius = (t) => (t < 0.28 ? 0.004 + (R - 0.004) * Math.sin(((t / 0.28) * PI) / 2)
      : t > 0.88 ? R - (R - 0.023) * smoothstep(0.88, 1, t) : R);
    for (let i = 0; i <= S; i++) pts[i][1] += radius(L[i] / L[L.length - 1]);
    const o = { seg: 150, radial: 7, sy: 0.9, lockUp: true };
    sweep(b, pts, radius, { ...o, arc: [0, PI], paint: (t) => (t > 0.05 && t < 0.95 && (t * 30) % 1 < 0.38 ? saddle : skin) });
    sweep(b, pts, radius, { ...o, arc: [PI, TAU], color: belly });
    // head: wider than the neck, with yellow slit eyes and a forked tongue
    const H = [0, 0.16, 0.12];
    ball(b, H, [0.035, 0.023, 0.05], { rot: [0.12, 0, 0], color: skin });
    ball(b, [0, H[1] - 0.007, H[2] + 0.004], [0.03, 0.016, 0.045], { rot: [0.12, 0, 0], color: belly });
    b.mirrorX(() => eye(b, [0.023, H[1] + 0.011, H[2] + 0.014], 0.0085, { dir: [0.7, 0.45, 0.6], iris: "#f2d040", pupil: 0.8, slit: true }));
    b.mirrorX(() => ball(b, [0.008, H[1] + 0.006, H[2] + 0.046], 0.0025, { color: "#203018", seg: 6 }));
    const tg = [0, H[1] - 0.006, H[2] + 0.045];
    b.rod(tg, [0, tg[1] - 0.002, tg[2] + 0.026], 0.0022, { color: "#d83a4a", seg: 5 });
    b.mirrorX(() => b.rod([0, tg[1] - 0.002, tg[2] + 0.025], [0.008, tg[1] - 0.004, tg[2] + 0.04], 0.0018, { color: "#d83a4a", seg: 5 }));
  },

  // A sitting rabbit: long upright ears, round haunches, big hind feet, cotton tail.
  rabbit(b, p) {
    const fur = p.color || "#c9a483";
    const cream = mix(fur, "#fffaf2", 0.75);
    const pink = "#f0a6b0";
    ball(b, [0, 0.07, -0.128], 0.032, { color: cream });
    ball(b, [0, 0.085, -0.035], [0.086, 0.085, 0.095], { color: fur });
    b.mirrorX(() => ball(b, [0.058, 0.07, -0.03], [0.045, 0.06, 0.075], { color: fur }));
    ball(b, [0, 0.14, 0.022], [0.06, 0.075, 0.06], { rot: [0.3, 0, 0], color: fur });
    ball(b, [0, 0.125, 0.045], [0.042, 0.06, 0.04], { rot: [0.3, 0, 0], color: cream });
    b.mirrorX(() => {
      ball(b, [0.062, 0.016, 0.035], [0.026, 0.016, 0.062], { color: fur });
      ball(b, [0.026, 0.03, 0.082], [0.017, 0.028, 0.018], { color: fur });
    });
    const H = [0, 0.205, 0.072];
    ball(b, H, [0.058, 0.054, 0.058], { color: fur });
    b.mirrorX(() => ball(b, [0.016, 0.19, 0.118], 0.019, { color: cream }));
    ball(b, [0, 0.205, 0.128], [0.009, 0.007, 0.006], { color: pink, kind: "gloss" });
    b.mirrorX(() => eye(b, [0.036, 0.219, 0.105], 0.0115, { dir: [0.7, 0.2, 0.7] }));
    b.mirrorX(() => b.group({ at: [0.024, 0.245, 0.06], rot: [-0.12, 0, -0.16] }, () => {
      ball(b, [0, 0.055, 0], [0.022, 0.062, 0.012], { color: fur });
      ball(b, [0, 0.055, 0.006], [0.013, 0.047, 0.008], { color: pink });
    }));
  },

  // A turtle: domed shell with raised plates and a rim, head poking out, four stubby legs.
  turtle(b, p) {
    const shell = p.color || "#5f8c3c";
    const plate = mix(shell, "#d8d07a", 0.35);
    const rim = mix(shell, "#e6cf8a", 0.55);
    const skin = "#9cc15a";
    const SC = [0, 0.052, 0], SR = [0.14, 0.11, 0.17];
    b.mirrorX(() => {
      ball(b, [0.118, 0.032, 0.105], [0.045, 0.026, 0.034], { rot: [0, -0.6, 0], color: skin });
      ball(b, [0.112, 0.028, -0.11], [0.042, 0.024, 0.032], { rot: [0, 0.6, 0], color: skin });
    });
    b.cone(0.016, 0.045, { at: [0, 0.04, -0.19], rot: [-PI / 2 - 0.2, 0, 0], color: skin, seg: 10 });
    b.capsule(0.03, 0.06, { at: [0, 0.07, 0.16], rot: [PI / 2 - 0.35, 0, 0], color: skin });
    const H = [0, 0.09, 0.205];
    ball(b, H, [0.043, 0.038, 0.048], { color: skin });
    b.mirrorX(() => eye(b, [0.028, H[1] + 0.012, H[2] + 0.024], 0.009, { dir: [0.7, 0.3, 0.7] }));
    sweep(b, [[-0.024, H[1] - 0.012, H[2] + 0.03], [0, H[1] - 0.016, H[2] + 0.045], [0.024, H[1] - 0.012, H[2] + 0.03]],
      0.0022, { color: shade(skin, -0.3), seg: 10, radial: 6 });
    ball(b, [0, 0.04, 0], [0.135, 0.025, 0.165], { color: rim });
    ball(b, [0, 0.055, 0], [0.152, 0.022, 0.184], { color: rim });
    b.sphere(1, { at: SC, scale: SR, thetaLength: PI / 2, color: shell, seg: 22 });
    const scute = (dir, r) => {
      const s = onEllipsoid(SC, SR, dir);
      b.cyl(r, r * 1.05, 0.016, { at: add(s.at, s.n, 0.001), rot: aim(s.n), color: plate, seg: 6 });
    };
    scute([0, 1, 0], 0.038);
    scute([0, 0.62, 0.78], 0.034);
    scute([0, 0.62, -0.78], 0.034);
    for (const az of [0.55, 1.57, 2.6]) b.mirrorX(() => scute([Math.sin(az) * 0.85, 0.5, Math.cos(az) * 0.85], 0.034));
  },

  // A duck (mallard drake): green head, white collar, chestnut breast, flat yellow bill, orange webbed feet.
  // color turns it into a domestic duck of that colour.
  duck(b, p) {
    const custom = !!p.color;
    const body = p.color || "#d8d3c8";
    const chest = custom ? shade(p.color, -0.05) : "#8a5238";
    const head = custom ? shade(p.color, 0.03) : "#2f7d4f";
    const rear = custom ? shade(p.color, -0.1) : "#2b2b30";
    const wing = custom ? shade(p.color, -0.08) : "#a2978a";
    const bill = "#f0c23a", feet = "#f08c33";
    const web = [[-0.005, 0], [0.005, 0], [0.024, 0.036], [0.01, 0.044], [0, 0.038], [-0.01, 0.044], [-0.024, 0.036]];
    b.mirrorX(() => {
      b.rod([0.035, 0.07, -0.005], [0.035, 0.008, 0.0], 0.0075, { color: feet, seg: 8 });
      b.extrude(web, 0.005, { at: [0.035, 0.004, -0.004], rot: FLAT, color: feet, bevel: 0.0015 });
    });
    ball(b, [0, 0.115, -0.025], [0.086, 0.068, 0.12], { rot: [-0.08, 0, 0], color: body });
    ball(b, [0, 0.125, 0.045], [0.072, 0.066, 0.062], { color: chest });
    ball(b, [0, 0.136, -0.1], [0.043, 0.04, 0.042], { color: rear });
    teardrop(b, 0.028, 0.072, { at: [0, 0.138, -0.112], rot: aim([0, 0.4, -1]), scale: [1, 1, 0.38],
      color: custom ? shade(p.color, 0.04) : "#ebe7df" });
    if (!custom) b.torus(0.008, 0.003, { at: [0, 0.174, -0.128], rot: [0, PI / 2, 0], arc: PI * 1.4, color: rear, seg: 14, tubeSeg: 6 });
    b.mirrorX(() => b.group({ at: [0.074, 0.148, 0.03], rot: [0, 0.14, 0.15] }, () =>
      b.group({ rot: [-(PI / 2 + 0.06), 0, 0] }, () => {
        teardrop(b, 0.04, 0.145, { scale: [0.38, 1, 1], color: wing });
        if (!custom) {
          const y = 0.085, rr = teardropR(0.04, 0.145, y);
          ball(b, [0, y, 0], [rr * 0.38 + 0.002, 0.014, rr * 0.6], { color: "#3b5cc4", seg: 14 });
        }
      })));
    ball(b, [0, 0.18, 0.068], [0.04, 0.05, 0.04], { color: head });
    if (!custom) b.torus(0.037, 0.0055, { at: [0, 0.163, 0.066], rot: [-(PI / 2 - 0.25), 0, 0], color: "#f6f3ec", seg: 24, tubeSeg: 6 });
    ball(b, [0, 0.225, 0.075], [0.046, 0.046, 0.05], { color: head, kind: custom ? "matte" : "gloss" });
    b.extrude(smooth2([[-0.016, 0], [0.016, 0], [0.024, 0.035], [0.019, 0.05], [0, 0.054], [-0.019, 0.05], [-0.024, 0.035]], 24),
      0.011, { at: [0, 0.214, 0.106], rot: [PI / 2 + 0.04, 0, 0], color: bill, bevel: 0.003 });
    b.mirrorX(() => eye(b, [0.036, 0.236, 0.097], 0.0075, { dir: [0.8, 0.25, 0.6] }));
  },

  // A bumblebee hovering: banded abdomen, fuzzy thorax, glassy veined wings, antennae, tucked legs.
  bee(b, p) {
    const yellow = p.color || "#f4c430", black = "#2b2522";
    const L = 0.1, R = 0.048, z0 = -0.088, yc = 0.058;
    const rad = (s) => R * Math.pow(Math.sin(PI * (0.02 + 0.96 * s)), 0.7);
    for (const [s0, s1, c] of [[0, 0.17, black], [0.17, 0.4, yellow], [0.4, 0.6, black], [0.6, 0.82, yellow], [0.82, 1, black]]) {
      const pts = [];
      for (let k = 0; k <= 5; k++) {
        const s = s0 + ((s1 - s0) * k) / 5;
        pts.push([s === 0 ? 0 : rad(s), s * L]);
      }
      b.lathe(pts, { at: [0, yc, z0], rot: [PI / 2, 0, 0], color: c, seg: 16 });
    }
    b.cone(0.005, 0.016, { at: [0, yc, z0 - 0.006], rot: [-PI / 2, 0, 0], color: black, seg: 6 });
    ball(b, [0, yc + 0.006, 0.035], 0.039, { color: yellow });
    ball(b, [0, yc + 0.006, 0.03], [0.0395, 0.0395, 0.012], { color: black });
    const H = [0, yc + 0.002, 0.08];
    ball(b, H, [0.03, 0.028, 0.024], { color: black });
    b.mirrorX(() => ball(b, [0.021, H[1] + 0.005, H[2] + 0.006], [0.009, 0.015, 0.011], { rot: [0, 0.5, 0], color: "#121214",
      kind: "gloss", seg: 10 }));
    b.mirrorX(() => ball(b, [0.025, H[1] + 0.013, H[2] + 0.014], 0.003, { color: "#ffffff", kind: "gloss", seg: 6 }));
    b.mirrorX(() => {
      sweep(b, [[0.008, H[1] + 0.02, H[2] + 0.012], [0.014, H[1] + 0.042, H[2] + 0.02], [0.03, H[1] + 0.05, H[2] + 0.04]],
        0.0024, { color: black, seg: 12, radial: 6 });
      ball(b, [0.03, H[1] + 0.05, H[2] + 0.04], 0.0045, { color: black, seg: 8 });
    });
    // wings: milky glass with a dark rim and a vein
    b.mirrorX(() => {
      for (const [yaw, lift, len, wid] of [[0.5, 0.45, 0.078, 0.03], [1.0, 0.32, 0.054, 0.022]]) {
        b.group({ at: [0.016, yc + 0.04, 0.03], rot: [0, yaw, 0] }, () => b.group({ rot: [0, 0, lift] }, () => {
          const outline = ellipse2(len / 2, wid / 2, 24, len / 2, 0);
          b.extrude(outline, 0.002, { rot: FLAT, color: "#c9e0ec", kind: "glass", bevel: 0.0006 });
          b.tube(outline.map(([x, z]) => [x, 0, z]), 0.0009, { closed: true, color: "#6a625c", seg: 32, radial: 4 });
          b.rod([0.004, 0.0, 0.0], [len * 0.8, 0.0, -wid * 0.1], 0.0007, { color: "#6a625c", seg: 4 });
        }));
      }
    });
    b.mirrorX(() => {
      for (const z of [0.05, 0.035, 0.02]) {
        const hip = [0.012, yc - 0.028, z], knee = [0.026, yc - 0.04, z + (z - 0.035) * 0.6], foot = [0.022, 0.004, z - 0.008];
        b.rod(hip, knee, 0.0034, { color: black, seg: 5 });
        b.rod(knee, foot, 0.003, { r2: 0.0022, color: black, seg: 5 });
      }
    });
  },

  // A butterfly with open wings (monarch-like by default): dark body, clubbed antennae, wings raised in a V.
  butterfly(b, p) {
    const main = p.color || "#f08a24";
    const edge = "#2a2420", spot = "#fbf6ea", body = "#2d2622";
    const fore = smooth2([[0.004, 0.014], [0.058, 0.06], [0.138, 0.094], [0.175, 0.069], [0.15, 0.006], [0.08, -0.014],
      [0.012, -0.005]], 22);
    const hind = smooth2([[0.004, -0.005], [0.069, -0.016], [0.115, -0.058], [0.104, -0.109], [0.052, -0.115], [0.012, -0.037]], 20);
    b.group({ at: [0, 0.07, 0.005], rot: [-0.35, 0, 0] }, () => {
      b.capsule(0.0095, 0.085, { at: [0, 0, -0.014], rot: [PI / 2, 0, 0], color: body });
      ball(b, [0, 0.003, 0.043], 0.0125, { color: body });
      b.mirrorX(() => eye(b, [0.008, 0.007, 0.049], 0.005, { dir: [0.7, 0.3, 0.6] }));
      b.mirrorX(() => {
        sweep(b, [[0.004, 0.012, 0.05], [0.012, 0.042, 0.073], [0.032, 0.066, 0.1]], 0.0016, { color: body, seg: 12, radial: 5 });
        ball(b, [0.032, 0.066, 0.1], 0.0045, { color: body, seg: 8 });
      });
      b.mirrorX(() => b.group({ at: [0.006, 0.004, 0.006], rot: [0, 0, 0.7] }, () => {
        for (const [shape, c, spots] of [[fore, [0.085, 0.036], [[0.15, 0.072], [0.163, 0.052], [0.158, 0.028], [0.138, 0.009]]],
          [hind, [0.058, -0.055], [[0.1, -0.075], [0.09, -0.097], [0.063, -0.108]]]]) {
          b.extrude(shape, 0.003, { rot: FLAT, color: edge, bevel: 0.0008 });
          b.extrude(shrink2(shape, 0.78, c), 0.003, { at: [0, 0.0016, 0], rot: FLAT, color: main, bevel: 0.0008 });
          b.extrude(shrink2(shape, 0.78, c), 0.003, { at: [0, -0.0016, 0], rot: FLAT, color: main, bevel: 0.0008 });
          for (const [x, y] of spots) ball(b, [x, 0.0022, y], [0.005, 0.0016, 0.005], { color: spot, seg: 8 });
        }
      }));
    });
  },

  // An elephant: column legs with toenails, big fan ears, curling trunk, tusks, tail with a tuft.
  elephant(b, p) {
    const skin = p.color || "#9aa3ad";
    const dark = shade(skin, -0.07);
    const inner = mix(skin, "#e8a2a6", 0.5);
    const ivory = "#f3ecdc";
    b.mirrorX(() => {
      for (const z of [0.11, -0.21]) {
        b.lathe([[0, 0], [0.08, 0], [0.086, 0.012], [0.08, 0.05], [0.074, 0.2], [0.078, 0.5]], { at: [0.1, 0, z],
          color: skin, seg: 18 });
        for (const a of [-0.45, 0, 0.45]) {
          ball(b, [0.1 + Math.sin(a) * 0.077, 0.017, z + Math.cos(a) * 0.077], [0.018, 0.016, 0.01], { rot: [0, a, 0],
            color: ivory, seg: 8 });
        }
      }
    });
    ball(b, [0, 0.5, -0.04], [0.215, 0.2, 0.31], { color: skin, seg: 22 });
    ball(b, [0, 0.58, 0.17], [0.16, 0.16, 0.12], { color: skin });
    sweep(b, [[0, 0.6, -0.33], [0, 0.53, -0.375], [0, 0.43, -0.385]], 0.012, { color: dark, seg: 12, radial: 8 });
    teardrop(b, 0.017, 0.055, { at: [0, 0.44, -0.385], rot: [PI, 0, 0], color: "#4c4d52" });
    ball(b, [0, 0.645, 0.27], 0.165, { color: skin });
    const ear = smooth2([[0.0, 0.1], [0.07, 0.13], [0.14, 0.1], [0.17, 0.02], [0.155, -0.08], [0.11, -0.15], [0.055, -0.16],
      [0.02, -0.1], [0.0, 0.0]], 34);
    b.mirrorX(() => b.group({ at: [0.115, 0.65, 0.235], rot: [0, 0.68, -0.05] }, () => {
      b.extrude(ear, 0.022, { color: skin, bevel: 0.006 });
      b.extrude(shrink2(ear, 0.76, [0.085, -0.02]), 0.01, { at: [0, 0, 0.013], color: inner, bevel: 0.003 });
    }));
    sweep(b, [[0, 0.63, 0.36], [0, 0.55, 0.45], [0, 0.42, 0.49], [0, 0.3, 0.505], [0, 0.2, 0.515], [0, 0.15, 0.55],
      [0, 0.17, 0.6]], (t) => 0.068 - 0.036 * t,
    { paint: (t) => (t > 0.25 && t < 0.92 && (t * 22) % 1 < 0.22 ? dark : skin), seg: 40, radial: 12, cap1: true });
    b.mirrorX(() => sweep(b, [[0.062, 0.53, 0.385], [0.075, 0.48, 0.46], [0.08, 0.47, 0.52], [0.076, 0.5, 0.57]],
      [0.019, 0.004], { color: ivory, kind: "gloss", seg: 16, radial: 8 }));
    b.mirrorX(() => eye(b, [0.105, 0.69, 0.39], 0.016, { dir: [0.6, 0.2, 0.8] }));
  },

  // A woolly sheep: a cloud of wool puffs on a body, dark face and legs, ears sticking out sideways.
  sheep(b, p) {
    const wool = p.color || "#f1ece1";
    const face = "#3d3633", hoof = "#2a2422";
    b.mirrorX(() => {
      for (const z of [0.13, -0.14]) {
        b.rod([0.074, 0.22, z], [0.074, 0.03, z], 0.026, { r2: 0.022, color: face, seg: 10 });
        b.cyl(0.024, 0.026, 0.03, { at: [0.074, 0.015, z + 0.004], color: hoof, seg: 10 });
      }
    });
    const BC = [0, 0.275, -0.02], BR = [0.135, 0.115, 0.2];
    ball(b, BC, BR, { color: wool });
    const n = 32;
    for (let i = 0; i < n; i++) {
      const y = 1 - ((i + 0.5) / n) * 1.6;
      const r = Math.sqrt(1 - y * y), th = i * 2.399963;
      const s = onEllipsoid(BC, BR, [r * Math.cos(th), y, r * Math.sin(th)]);
      const rad = 0.047 + b.rng() * 0.02;
      ball(b, add(s.at, s.n, -rad * 0.42), rad, { color: shade(wool, (b.rng() - 0.5) * 0.05), seg: 10 });
    }
    ball(b, [0, 0.27, -0.23], 0.042, { color: wool, seg: 10 });
    b.group({ at: [0, 0.32, 0.215], rot: [0.55, 0, 0] }, () => {
      ball(b, [0, 0, 0.03], [0.058, 0.066, 0.084], { color: face });
      b.mirrorX(() => ball(b, [0.017, -0.033, 0.108], 0.006, { color: "#1a1615", seg: 8 }));
    });
    b.mirrorX(() => eye(b, [0.04, 0.351, 0.266], 0.013, { dir: [0.6, 0.3, 0.75], iris: "#f4f1ea", pupil: 0.62 }));
    b.mirrorX(() => teardrop(b, 0.022, 0.075, { at: [0.047, 0.358, 0.215], rot: [0, 0, -(PI / 2 + 0.3)], scale: [1, 1, 0.45], color: face }));
    for (const [x, y, z, r] of [[0, 0.388, 0.215, 0.037], [-0.027, 0.378, 0.2, 0.032], [0.027, 0.378, 0.2, 0.032], [0, 0.385, 0.178, 0.035]]) {
      ball(b, [x, y, z], r, { color: wool, seg: 10 });
    }
  },

  // A sitting frog: wide head, bulging golden eyes on top, big folded hind legs, a smile.
  frog(b, p) {
    const skin = p.color || "#62ad46";
    const belly = mix(skin, "#f4f0b0", 0.6);
    const spot = shade(skin, -0.12);
    const foot = smooth2([[-0.006, 0], [0.006, 0], [0.018, 0.03], [0.006, 0.036], [0, 0.03], [-0.006, 0.036], [-0.018, 0.03]], 20);
    b.mirrorX(() => {
      ball(b, [0.07, 0.046, -0.04], [0.04, 0.036, 0.068], { rot: [0, 0.35, 0], color: skin });
      ball(b, [0.09, 0.022, 0.0], [0.026, 0.02, 0.06], { rot: [0, -0.25, 0], color: skin });
      b.extrude(foot, 0.005, { at: [0.094, 0.004, 0.045], rot: [PI / 2, -0.25, 0], color: skin, bevel: 0.0015 });
    });
    b.group({ at: [0, 0.068, -0.015], rot: [-0.4, 0, 0] }, () => {
      const BR = [0.08, 0.06, 0.095];
      ball(b, [0, 0, 0], BR, { color: skin });
      for (const d of [[0.4, 0.8, -0.35], [-0.45, 0.75, -0.15], [0.05, 0.7, -0.68], [-0.25, 0.85, -0.5], [0.55, 0.7, 0.05]]) {
        const s = onEllipsoid([0, 0, 0], BR, d);
        ball(b, s.at, [0.012, 0.0025, 0.012], { rot: aim(s.n), color: spot, seg: 10 });
      }
    });
    ball(b, [0, 0.098, 0.055], [0.078, 0.048, 0.068], { color: skin });
    ball(b, [0, 0.07, 0.07], [0.06, 0.04, 0.05], { color: belly });
    b.mirrorX(() => {
      b.rod([0.045, 0.07, 0.06], [0.055, 0.012, 0.095], 0.012, { r2: 0.01, color: skin, seg: 8 });
      for (const a of [-0.5, 0, 0.5]) {
        ball(b, [0.055 + Math.sin(a) * 0.016, 0.006, 0.1 + Math.cos(a) * 0.016], [0.007, 0.005, 0.012], { rot: [0, a, 0], color: skin, seg: 8 });
      }
    });
    b.mirrorX(() => {
      ball(b, [0.042, 0.135, 0.058], 0.032, { color: skin });
      eye(b, [0.046, 0.14, 0.072], 0.024, { dir: [0.45, 0.4, 0.85], iris: "#f2d04a", pupil: 0.62, bar: true });
    });
    const mouth = [];
    for (let i = 0; i <= 10; i++) {
      const a = -1.25 + i * 0.25;
      mouth.push([Math.sin(a) * 0.079, 0.088, 0.055 + Math.cos(a) * 0.069]);
    }
    sweep(b, mouth, 0.0028, { color: shade(skin, -0.3), seg: 30, radial: 6 });
    b.mirrorX(() => ball(b, [0.012, 0.115, 0.12], 0.003, { color: shade(skin, -0.3), seg: 6 }));
  },

  // A tiny ant: head, thorax and big gaster, six bent legs, elbowed antennae.
  ant(b, p) {
    const c = p.color || "#3a2420";
    const k = "gloss";
    ball(b, [0, 0.021, -0.03], [0.0145, 0.0125, 0.021], { rot: [-0.25, 0, 0], color: c, kind: k, seg: 14 });
    ball(b, [0, 0.019, -0.006], 0.0045, { color: c, kind: k, seg: 8 });
    ball(b, [0, 0.02, 0.012], [0.0075, 0.0075, 0.015], { rot: [0.2, 0, 0], color: c, kind: k, seg: 12 });
    ball(b, [0, 0.022, 0.037], [0.0095, 0.0085, 0.009], { color: c, kind: k, seg: 12 });
    b.mirrorX(() => eye(b, [0.0075, 0.025, 0.04], 0.0028, { dir: [1, 0.2, 0.5], seg: 8 }));
    b.mirrorX(() => b.rod([0.004, 0.017, 0.043], [0.0015, 0.015, 0.05], 0.0015, { color: c, seg: 5 }));
    b.mirrorX(() => {
      const base = [0.004, 0.028, 0.043], elbow = [0.01, 0.037, 0.046], tip = [0.016, 0.039, 0.062];
      b.rod(base, elbow, 0.0013, { color: c, seg: 5 });
      b.rod(elbow, tip, 0.0013, { color: c, seg: 5 });
      for (const [z, dz] of [[0.02, 0.025], [0.012, 0.0], [0.004, -0.028]]) {
        const hip = [0.005, 0.016, z], knee = [0.018, 0.026, z + dz * 0.5], foot = [0.03, 0.0015, z + dz];
        b.rod(hip, knee, 0.0016, { color: c, seg: 5 });
        b.rod(knee, foot, 0.0014, { r2: 0.001, color: c, seg: 5 });
      }
    });
  },

  // A small mouse: plump body, big round pink-lined ears, pointy nose, long thin tail.
  mouse(b, p) {
    const fur = p.color || "#a7a19b";
    const pink = "#eba3a8";
    sweep(b, [[0, 0.018, -0.05], [0.012, 0.008, -0.075], [0.03, 0.005, -0.095], [0.035, 0.005, -0.115], [0.02, 0.006, -0.128]],
      [0.0045, 0.0018], { color: pink, radial: 6, seg: 24 });
    ball(b, [0, 0.032, -0.012], [0.033, 0.03, 0.045], { color: fur, seg: 16 });
    ball(b, [0, 0.036, 0.034], [0.022, 0.021, 0.03], { rot: [0.12, 0, 0], color: fur, seg: 16 });
    ball(b, [0, 0.031, 0.065], 0.0055, { color: pink, kind: "gloss", seg: 8 });
    b.mirrorX(() => {
      ball(b, [0.02, 0.058, 0.026], [0.017, 0.017, 0.005], { rot: [-0.2, -0.4, -0.3], color: fur, seg: 14 });
      ball(b, [0.0205, 0.058, 0.029], [0.012, 0.012, 0.003], { rot: [-0.2, -0.4, -0.3], color: pink, seg: 12 });
      eye(b, [0.0125, 0.044, 0.05], 0.0045, { dir: [0.6, 0.3, 0.75] });
      for (const dy of [-0.003, 0.003]) b.rod([0.006, 0.032, 0.062], [0.032, 0.033 + dy * 2, 0.07], 0.0006, { color: "#ece8e2", seg: 4 });
      ball(b, [0.016, 0.006, 0.02], [0.007, 0.005, 0.01], { color: pink, seg: 8 });
      ball(b, [0.022, 0.006, -0.03], [0.008, 0.005, 0.013], { color: pink, seg: 8 });
    });
  },

  // An egg: whole, cracked (zigzag crack) or hatching (a chick in the lower shell, the cap on its head).
  egg(b, p) {
    const v = ["whole", "cracked", "hatching"].includes(p.variant) ? p.variant : "whole";
    const shell = p.color || "#f1e2c6";
    const inside = mix(shell, "#ffffff", 0.5);
    if (v !== "hatching") {
      b.lathe(eggProfile(20), { seg: 26, color: shell });
      if (v === "cracked") {
        const pts = [];
        for (let i = 0; i <= 14; i++) {
          const ph = -1.7 + i * (3.4 / 14);
          pts.push(eggAt(1.45 + (i % 2 ? 0.13 : -0.11) + 0.05 * Math.sin(i * 1.7), ph, 0.0008).p);
        }
        b.tube(pts, 0.0028, { curve: "line", color: "#5e4130", seg: 60, radial: 5 });
        const branch = [eggAt(1.34, -0.25, 0.0008).p, eggAt(1.18, -0.12, 0.0008).p, eggAt(1.02, -0.2, 0.0008).p];
        b.tube(branch, 0.0022, { curve: "line", color: "#5e4130", seg: 12, radial: 5 });
      }
      return;
    }
    const chick = "#f6d64a", beak = "#f0902a";
    const rimLo = (ph) => 1.72 + zigzag(ph, 7, 0.14);
    eggShell(b, () => 0, rimLo, { color: shell, inside, rims: [rimLo] });
    const CH = [0, 0.118, 0.006];
    ball(b, CH, 0.042, { color: chick, seg: 18 });
    b.cone(0.0105, 0.02, { at: [0, CH[1] - 0.003, CH[2] + 0.047], rot: [PI / 2 - 0.15, 0, 0], color: beak, seg: 8 });
    b.cone(0.0085, 0.014, { at: [0, CH[1] - 0.011, CH[2] + 0.044], rot: [PI / 2 + 0.35, 0, 0], color: shade(beak, -0.06), seg: 8 });
    b.mirrorX(() => eye(b, [0.019, CH[1] + 0.009, CH[2] + 0.036], 0.0065, { dir: [0.45, 0.25, 0.9] }));
    b.mirrorX(() => teardrop(b, 0.012, 0.036, { at: [0.035, 0.1, 0.018], rot: aim([0.45, -0.15, 0.6]), scale: [1, 1, 0.45], color: chick,
      seg: 10, n: 6 }));
    const capLo = (ph) => 2.35 + zigzag(ph, 7, 0.12, 0.5);
    const base = eggAt(2.35, 0).p[1];
    b.group({ at: CH, rot: [-0.25, 0, -0.38] }, () => b.group({ at: [0, 0.026 - base, 0] }, () =>
      eggShell(b, capLo, () => PI, { color: shell, inside, rims: [capLo], N: 6 })));
  },

  // A twig nest: a woven bowl with a soft lining and twigs wrapped around the rim.
  nest(b, p) {
    const straw = p.color || "#9a7346";
    const outerProf = [[0, 0.004], [0.09, 0.0], [0.138, 0.016], [0.164, 0.048], [0.168, 0.083], [0.155, 0.108], [0.133, 0.118]];
    b.lathe(outerProf, { seg: 28, color: straw });
    b.lathe([[0.133, 0.118], [0.115, 0.106], [0.098, 0.078], [0.062, 0.054], [0, 0.048]], { seg: 28, color: shade(straw, -0.12) });
    b.disc(0.07, { at: [0, 0.0505, 0], color: "#d4b77e" });
    const outer = (y) => {
      for (let i = 1; i < outerProf.length; i++) {
        if (y <= outerProf[i][1]) {
          const [r0, y0] = outerProf[i - 1], [r1, y1] = outerProf[i];
          return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0 || 1);
        }
      }
      return outerProf[outerProf.length - 1][0];
    };
    const tones = ["#6e4c2c", "#8a6238", "#a57a4a", "#5c3e24", "#b48d5a"];
    const n = 60;
    for (let i = 0; i < n; i++) {
      const ph = (i / n) * TAU * 3 + b.rng() * 0.4;
      const y = 0.014 + ((i * 0.37) % 1) * 0.108;
      const rr = outer(y) + 0.004;
      const at = [rr * Math.sin(ph), y, rr * Math.cos(ph)];
      const len = 0.1 + b.rng() * 0.08;
      const tilt = (b.rng() - 0.5) * Math.min(0.7, ((y - 0.006) / len) * 3);
      const d = norm([Math.cos(ph) * Math.cos(tilt), Math.sin(tilt), -Math.sin(ph) * Math.cos(tilt)]);
      b.rod(add(at, d, -len / 2), add(at, d, len / 2), 0.006 + b.rng() * 0.003, { color: tones[i % tones.length], seg: 5 });
    }
    for (let i = 0; i < 14; i++) {
      const ph = (i / 14) * TAU + b.rng() * 0.3;
      const at = [0.14 * Math.sin(ph), 0.118, 0.14 * Math.cos(ph)];
      const d = norm([Math.cos(ph), (b.rng() - 0.5) * 0.3, -Math.sin(ph)]);
      b.rod(add(at, d, -0.06), add(at, d, 0.06), 0.0055, { color: tones[(i + 2) % tones.length], seg: 5 });
    }
  },
};
