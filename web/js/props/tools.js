// Props in the "tools" group. Each entry: name: (b, p) => void — see kit.js and docs/props.md.
// b is a Builder (metres, base on y = 0, facing +z); p holds the item's params:
//   { variant, color, color2, text, emoji, pose, hat, hold, seed }
//
// Style: chunky toy tools and lab kit. Flat tools (wrench, scissors, magnet, gear outlines) are bevelled
// extrusions seen face-on; turned parts are lathes; metal parts use kind "metal", glassware kind "glass"
// with coloured contents inside, flames and light beams kind "glow".
import * as THREE from "three";
import { C, shade, mix } from "./kit.js";

const PI = Math.PI;
const TAU = 2 * PI;
const ZA = [PI / 2, 0, 0]; // turns a cylinder's y axis onto z (a disc facing the viewer)
const XA = [0, 0, -PI / 2]; // turns a cylinder's / lathe's +y axis onto +x

// ── helpers ──────────────────────────────────────────────────────────────────
const V2 = ([x, y]) => new THREE.Vector2(x, y);
const polar = (r, a, cx = 0, cy = 0) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
const circle = (r, n = 32, cx = 0, cy = 0) => Array.from({ length: n }, (_, i) => polar(r, (i / n) * TAU, cx, cy));
const ellipse = (rx, ry, n = 32, cx = 0, cy = 0) =>
  Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((i / n) * TAU), cy + ry * Math.sin((i / n) * TAU)]);
const metal = (color) => ({ color, kind: "metal" });
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** A THREE.Shape from an outline and optional hole outlines ([[x, y], ...]). */
function shape(outer, holes = []) {
  const s = new THREE.Shape(outer.map(V2));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(V2)));
  return s;
}

/** Round the corners of a closed polygon: each corner becomes a quadratic curve of about radius r. */
function roundPoly(pts, r, n = 4) {
  const out = [];
  const m = pts.length;
  for (let i = 0; i < m; i++) {
    const P = pts[i], A = pts[(i + m - 1) % m], B = pts[(i + 1) % m];
    const rr = Array.isArray(r) ? r[i] : r;
    const la = Math.hypot(A[0] - P[0], A[1] - P[1]), lb = Math.hypot(B[0] - P[0], B[1] - P[1]);
    const d = Math.min(rr, la * 0.48, lb * 0.48);
    if (d < 1e-5) { out.push(P); continue; }
    const S = [P[0] + ((A[0] - P[0]) / la) * d, P[1] + ((A[1] - P[1]) / la) * d];
    const E = [P[0] + ((B[0] - P[0]) / lb) * d, P[1] + ((B[1] - P[1]) / lb) * d];
    for (let k = 0; k <= n; k++) {
      const t = k / n, u = 1 - t;
      out.push([u * u * S[0] + 2 * u * t * P[0] + t * t * E[0], u * u * S[1] + 2 * u * t * P[1] + t * t * E[1]]);
    }
  }
  return out;
}

/** Hue / saturation / lightness shift of a colour. */
function hue(c, dh, ds = 0, dl = 0) {
  const col = new THREE.Color(c);
  const h = {};
  col.getHSL(h);
  col.setHSL((((h.h + dh) % 1) + 1) % 1, clamp01(h.s + ds), clamp01(h.l + dl));
  return "#" + col.getHexString();
}

/** Contents seen through glass: pre-darken and saturate so the light glass layer brings them back to tone. */
const inGlass = (c) => hue(c, 0, 0.2, -0.14);

/** Points of a smooth open profile through control points (centripetal Catmull-Rom). */
function smooth(pts, n = 16) {
  const c = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, "centripetal");
  return c.getPoints(n).map((v) => [v.x, v.y]);
}

/**
 * Gear outline: N teeth with tip radius rt and root radius rr; a tooth points along angle `phase`.
 * tip / root are the tooth widths at tip and root as fractions of the tooth pitch.
 */
function gearOutline(N, rt, rr, phase = 0, tip = 0.34, root = 0.56) {
  const pts = [];
  const step = TAU / N, hr = (root * step) / 2, ht = (tip * step) / 2;
  const rm = rr + (rt - rr) * 0.55, hm = hr + (ht - hr) * 0.5;
  for (let k = 0; k < N; k++) {
    const c = phase + k * step;
    pts.push(polar(rr, c - hr), polar(rm, c - hm), polar(rt * 0.99, c - ht), polar(rt, c),
      polar(rt * 0.99, c + ht), polar(rm, c + hm), polar(rr, c + hr), polar(rr * 0.99, c + step / 2));
  }
  return pts;
}

/**
 * A spur gear facing +z, centred on the current origin: a solid toothed plate with round lightening holes,
 * a raised rim ring and a hub with a bore. g: { N, rt (tip radius), rr (root radius), t (thickness), holes,
 * hub, phase, color, kind }.
 */
function gearPart(b, g) {
  const bev = Math.min(0.006, g.t * 0.16);
  const kind = g.kind || "metal";
  const ph = g.phase ?? 0;
  const hub = g.hub ?? g.rt * 0.24;
  const rim = g.rr - Math.max(0.018, (g.rt - g.rr) * 0.8);
  const H = g.holes ?? 5;
  const holes = [circle(hub * 0.42 + bev, 16).reverse()];
  if (H) {
    const hc = (hub + rim) / 2, hrad = Math.min((rim - hub) / 2 - 0.006, hc * Math.sin(PI / H) - 0.008);
    for (let i = 0; i < H; i++) holes.push(circle(hrad + bev, 18, ...polar(hc, ph + PI / g.N + (i / H) * TAU)).reverse());
  }
  b.extrude(shape(gearOutline(g.N, g.rt - bev, g.rr - bev, ph), holes), g.t - 2 * bev, { color: g.color, kind, bevel: bev });
  // raised rings on the front face: rim and hub boss
  const zf = g.t / 2;
  b.torus(rim, Math.min(0.006, g.t * 0.14), { at: [0, 0, zf], color: shade(g.color, 0.04), kind, seg: 40, tubeSeg: 5 });
  b.lathe([[hub * 0.42, 0], [hub, 0], [hub, g.t * 0.25], [hub * 0.88, g.t * 0.36], [hub * 0.42, g.t * 0.36]],
    { at: [0, 0, zf - 0.002], rot: ZA, color: g.color, kind, seg: 24 });
  b.cyl(hub * 0.42, hub * 0.42, g.t + 0.02, { rot: ZA, color: g.dark || "#3a3530", seg: 14 });
}

/** Phase for gear B (NB teeth) meshing with gear A (NA teeth, phase phA) whose centre is at angle th from B... */
function meshPhase(NA, phA, th, NB) {
  // th = direction from A to B. A's tooth index facing B: sA; B's facing A must satisfy sA + sB = 0.5 (mod 1).
  const stepA = TAU / NA, stepB = TAU / NB;
  const sA = (th - phA) / stepA;
  return th + PI - stepB * (0.5 - sA);
}

/** A layered teardrop flame standing on the origin, height h, radius r (glowing, faces the viewer). */
function flame(b, h, r, o = {}) {
  const cols = o.colors || ["#ff7a2c", "#ffb43a", "#fff1a8"];
  const prof = (hh, rr) => smooth([[0, 0], [rr * 0.62, hh * 0.05], [rr, hh * 0.24], [rr * 0.86, hh * 0.47],
    [rr * 0.45, hh * 0.74], [rr * 0.12, hh * 0.93], [0, hh]], 14);
  const lean = o.lean ?? 0;
  b.lathe(prof(h, r), { rot: [0, 0, -lean], color: cols[0], kind: "glow", seg: 12, light: o.light !== false });
  b.lathe(prof(h * 0.74, r * 0.7), { at: [0, h * 0.015, r * 0.5], rot: [0, 0, -lean * 0.7], color: cols[1],
    kind: "glow", seg: 10, light: false });
  b.lathe(prof(h * 0.46, r * 0.42), { at: [0, h * 0.025, r * 0.92], rot: [0, 0, -lean * 0.4], color: cols[2],
    kind: "glow", seg: 8, light: false });
}

/** Euler rotation whose local x, y, z axes become the given orthonormal vectors. */
function basis(x, y, z) {
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...x), new THREE.Vector3(...y), new THREE.Vector3(...z));
  const e = new THREE.Euler().setFromRotationMatrix(m, "XYZ");
  return [e.x, e.y, e.z];
}

const sub3 = (a, c) => [a[0] - c[0], a[1] - c[1], a[2] - c[2]];
const add3 = (a, c, k = 1) => [a[0] + c[0] * k, a[1] + c[1] * k, a[2] + c[2] * k];
const unit3 = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross3 = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]];

/** A pipe along a right-angled polyline: straight runs joined by smooth quarter-torus elbows (bend radius k*r). */
function pipe(b, pts, r, o = {}) {
  const R = r * (o.bend ?? 1.8);
  const ends = pts.map((q) => q.slice());
  for (let i = 1; i < pts.length - 1; i++) {
    const d1 = unit3(sub3(pts[i], pts[i - 1])), d2 = unit3(sub3(pts[i + 1], pts[i]));
    const A = add3(pts[i], d1, -R), B = add3(pts[i], d2, R), Cc = add3(A, d2, R);
    b.torus(R, r, { at: Cc, rot: basis(d2.map((v) => -v), d1, cross3(d2.map((v) => -v), d1)), arc: PI / 2,
      color: o.color, kind: o.kind, seg: 8, tubeSeg: o.radial ?? 14 });
    ends[i] = [A, B];
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = i === 0 ? pts[0] : ends[i][1], c = i + 1 === pts.length - 1 ? pts[i + 1] : ends[i + 1][0];
    b.rod(a, c, r, { color: o.color, kind: o.kind, seg: o.radial ?? 14 });
  }
}

/** A bolted pipe flange (two discs and bolt heads) at `at`, with the pipe running along `axis` ("x" | "y"). */
function flange(b, at, r, axis, o = {}) {
  const rot = axis === "x" ? XA : [0, 0, 0];
  b.group({ at, rot }, () => {
    b.cyl(r * 1.55, r * 1.55, r * 0.5, { color: o.color, kind: o.kind, seg: 20 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + PI / 6;
      b.cyl(r * 0.2, r * 0.2, r * 0.68, { at: [Math.cos(a) * r * 1.27, 0, Math.sin(a) * r * 1.27], color: o.bolt || "#6d737b",
        kind: "metal", seg: 6, flat: true });
    }
  });
}

// ── builders ─────────────────────────────────────────────────────────────────
const TOOLS = {
  // An upright brass gear on a small display stand: twelve chunky teeth, five spokes, a hub with a keyed bore.
  gear(b, p) {
    const col = p.color || C.brass;
    const R = 0.232, cy = 0.04 + R + 0.004;
    const stand = "#5b4a3c";
    b.box(0.3, 0.04, 0.15, { at: [0, 0.02, -0.005], color: stand, r: 0.012 });
    b.box(0.07, cy - 0.03, 0.035, { at: [0, (cy + 0.03) / 2, -0.055], color: shade(stand, 0.04), r: 0.01 });
    b.cyl(0.02, 0.02, 0.05, { at: [0, cy, -0.05], rot: ZA, ...metal(C.steel), seg: 12 });
    b.group({ at: [0, cy, 0] }, () => gearPart(b, { N: 12, rt: R, rr: 0.19, t: 0.06, hub: 0.056, holes: 6,
      phase: PI / 2, color: col }));
    // keyway notch in the bore
    b.box(0.011, 0.012, 0.084, { at: [0, cy + 0.025, 0], color: "#3a3530", r: 0 });
  },

  // Three meshing gears (large, medium, small) on pegs in a wooden board.
  gear_train(b, p) {
    const base = p.color;
    const cols = base ? [shade(base, -0.1), base, shade(base, 0.1)] : [C.copper, C.brass, C.steel];
    const m = 0.0265; // module: pitch radius = m * N / 2
    const spec = [{ N: 11 }, { N: 16 }, { N: 8 }];
    for (const s of spec) {
      s.rp = (m * s.N) / 2;
      s.rt = s.rp + m * 0.85;
      s.rr = s.rp - m * 1.0;
    }
    const mid = spec[1];
    mid.c = [0.03, 0.315];
    mid.phase = PI / 2;
    const place = (s, ang) => {
      const d = mid.rp + s.rp + 0.003;
      s.c = [mid.c[0] + Math.cos(ang) * d, mid.c[1] + Math.sin(ang) * d];
      s.phase = meshPhase(mid.N, mid.phase, ang, s.N);
    };
    place(spec[0], PI + 0.36);
    place(spec[2], -0.3);
    // board on a foot
    const wood = "#a7774c";
    b.box(0.9, 0.04, 0.14, { at: [0, 0.02, -0.01], color: shade(wood, -0.12), r: 0.012 });
    b.box(0.86, 0.5, 0.03, { at: [0, 0.29, -0.055], color: wood, r: 0.012 });
    b.box(0.8, 0.44, 0.006, { at: [0, 0.29, -0.039], color: shade(wood, 0.06), r: 0.003, seg: 1 });
    for (const x of [-0.39, 0.39]) for (const y of [0.08, 0.5]) {
      b.cyl(0.009, 0.009, 0.006, { at: [x, y, -0.037], rot: ZA, ...metal(C.brass), seg: 10 });
    }
    spec.forEach((s, i) => {
      b.cyl(0.012, 0.012, 0.06, { at: [s.c[0], s.c[1], -0.02], rot: ZA, ...metal(C.steel), seg: 10 });
      b.group({ at: [s.c[0], s.c[1], 0.005] }, () => gearPart(b, { N: s.N, rt: s.rt, rr: s.rr, t: 0.036,
        hub: Math.max(0.03, s.rt * 0.24), holes: s.N > 12 ? 6 : s.N > 9 ? 5 : 4, phase: s.phase, color: cols[i] }));
    });
  },

  // A playground seesaw: a triangular fulcrum, a plank with seats and T-handles; variants tilt the plank.
  seesaw(b, p) {
    const col = p.color || "#e0573d";
    const hp = 0.2, a = 0.5, t = 0.045;
    const tilt = Math.asin(hp / a);
    const th = p.variant === "left_down" ? tilt : p.variant === "right_down" ? -tilt : 0;
    // fulcrum
    const blue = "#3f74c4";
    const bev = 0.012;
    b.extrude(roundPoly([[-0.15, bev], [0.15, bev], [0, hp - 0.02]], 0.03), 0.16 - 2 * bev,
      { color: blue, bevel: bev });
    b.box(0.34, 0.025, 0.25, { at: [0, 0.0125, 0], color: shade(blue, -0.12), r: 0.008 });
    b.box(0.07, 0.04, 0.2, { at: [0, hp - 0.02, 0], color: C.steel, kind: "metal", r: 0.01 });
    b.cyl(0.016, 0.016, 0.23, { at: [0, hp - 0.012, 0], rot: ZA, ...metal(C.silver), seg: 12 });
    // plank (pivots about its underside centre)
    b.group({ at: [0, hp, 0], rot: [0, 0, th] }, () => {
      b.box(2 * a, t, 0.17, { at: [0, t / 2, 0], color: col, r: 0.014 });
      b.box(2 * a - 0.04, 0.006, 0.12, { at: [0, t + 0.001, 0], color: shade(col, 0.06), r: 0.003, seg: 1 });
      b.mirrorX(() => {
        b.box(0.17, 0.026, 0.18, { at: [0.385, t + 0.013, 0], color: shade(col, -0.18), r: 0.01 });
        // T-handle
        const hx = 0.255, hy = t + 0.11;
        b.rod([hx, t, 0], [hx, hy, 0], 0.013, { color: C.yellow, seg: 10 });
        b.cyl(0.014, 0.014, 0.13, { at: [hx, hy, 0], rot: ZA, color: C.yellow, kind: "gloss", seg: 12 });
        b.sphere(0.018, { at: [hx, hy, 0.068], color: C.yellow, kind: "gloss", seg: 10 });
        b.sphere(0.018, { at: [hx, hy, -0.068], color: C.yellow, kind: "gloss", seg: 10 });
      });
    });
  },

  // A wooden gallows frame with a pulley wheel; the rope runs over it to an iron weight and a pull handle.
  pulley(b, p) {
    const wood = p.color || C.wood;
    const dark = shade(wood, -0.12);
    const iron = { color: "#596069", kind: "gloss" };
    b.box(0.4, 0.04, 0.3, { at: [0, 0.02, 0], color: dark, r: 0.012 });
    const top = 0.975;
    b.mirrorX(() => {
      b.box(0.046, top - 0.04, 0.046, { at: [0.168, (top + 0.04) / 2 - 0.01, 0], color: wood, r: 0.008 });
      for (const z of [-1, 1]) b.rod([0.168, 0.04, z * 0.12], [0.168, 0.26, z * 0.02], 0.012, { color: dark, seg: 8 });
    });
    b.box(0.4, 0.05, 0.07, { at: [0, top - 0.02, 0], color: wood, r: 0.01 });
    // hanger: eye bolt and two straps down to the axle
    const wy = 0.8, R = 0.066;
    b.torus(0.016, 0.0045, { at: [0, top - 0.058, 0], rot: [0, PI / 2, 0], ...iron, seg: 14, tubeSeg: 6 });
    for (const z of [-0.026, 0.026]) {
      b.box(0.016, top - 0.07 - wy, 0.006, { at: [0, (top - 0.07 + wy) / 2, z], ...metal("#9aa3ad"), r: 0.002, seg: 1 });
    }
    b.box(0.03, 0.012, 0.06, { at: [0, top - 0.07, 0], ...iron, r: 0.004 });
    // sheave: grooved red wheel with spokes
    const red = "#d24a3a";
    b.cyl(R - 0.006, R - 0.006, 0.022, { at: [0, wy, 0], rot: ZA, color: shade(red, -0.1), kind: "gloss", seg: 32, open: true });
    for (const z of [-0.0135, 0.0135]) b.torus(R, 0.0075, { at: [0, wy, z], color: red, kind: "gloss", seg: 36, tubeSeg: 8 });
    const web = [];
    for (let i = 0; i < 4; i++) web.push(circle(0.016, 16, ...polar(0.036, (i / 4) * TAU + PI / 4)).reverse());
    b.extrude(shape(circle(R - 0.004, 36), web), 0.008, { at: [0, wy, 0], color: red, kind: "gloss", bevel: 0.003 });
    b.cyl(0.017, 0.017, 0.03, { at: [0, wy, 0], rot: ZA, color: shade(red, -0.05), kind: "gloss", seg: 16 });
    b.cyl(0.009, 0.009, 0.07, { at: [0, wy, 0], rot: ZA, ...metal(C.silver), seg: 12 });
    // rope over the wheel
    const rope = { color: "#d9bd8a", kind: "matte" };
    const rr = R - 0.004, ry = 0.0075;
    b.torus(rr, ry, { at: [0, wy, 0], arc: PI, ...rope, seg: 20, tubeSeg: 6 });
    const wTop = 0.43, hEnd = 0.24;
    b.cyl(ry, ry, wy - wTop, { at: [-rr, (wy + wTop) / 2, 0], ...rope, seg: 8 });
    b.cyl(ry, ry, wy - hEnd, { at: [rr, (wy + hEnd) / 2, 0], ...rope, seg: 8 });
    // iron weight with a ring
    b.torus(0.017, 0.005, { at: [-rr, wTop - 0.006, 0], rot: [0, PI / 2, 0], ...iron, seg: 14, tubeSeg: 6 });
    const wb = 0.008;
    b.extrude(roundPoly([[-0.058, 0], [0.058, 0], [0.04, 0.088], [-0.04, 0.088]], 0.012),
      0.07 - 2 * wb, { at: [-rr, wTop - 0.11, 0], ...iron, bevel: wb });
    b.text("kg", { at: [-rr, wTop - 0.066, 0.0375], w: 0.07, h: 0.045, fg: "#eef1f4", font: "body" });
    // pull handle on the free end
    b.cyl(0.014, 0.014, 0.085, { at: [rr, hEnd - 0.004, 0], rot: ZA, color: C.lightWood, kind: "gloss", seg: 12 });
  },

  // A claw hammer standing on its head: steel head with face and split claw, wooden handle, rubber grip.
  hammer(b, p) {
    const grip = p.color || C.red;
    const steel = metal("#aab2bc");
    // head
    b.box(0.056, 0.064, 0.068, { at: [0.002, 0.032, 0], r: 0.011, ...steel });
    b.lathe([[0, 0], [0.027, 0], [0.023, 0.026], [0.026, 0.032], [0.031, 0.036], [0.031, 0.05], [0.027, 0.054],
      [0, 0.054]], { at: [0.028, 0.032, 0], rot: XA, ...steel, seg: 20 });
    const claw = roundPoly([[-0.02, 0.006], [-0.052, 0.01], [-0.08, 0.03], [-0.094, 0.064], [-0.094, 0.093],
      [-0.083, 0.072], [-0.066, 0.056], [-0.042, 0.052], [-0.02, 0.054]], [0.002, 0.02, 0.02, 0.02, 0.004, 0.012,
      0.012, 0.01, 0.002], 3);
    for (const z of [-0.018, 0.018]) b.extrude(claw, 0.021, { at: [0, 0.002, z], ...steel, bevel: 0.004 });
    // handle
    b.lathe([[0.017, 0.06], [0.0155, 0.1], [0.0165, 0.2], [0.018, 0.26], [0, 0.262]],
      { color: C.lightWood, seg: 14, scale: [1, 1, 0.85] });
    b.lathe([[0.0185, 0.24], [0.021, 0.25], [0.021, 0.395], [0.019, 0.41], [0.012, 0.418], [0, 0.42]],
      { color: grip, kind: "gloss", seg: 16, scale: [1, 1, 0.85] });
    for (const y of [0.27, 0.3, 0.33, 0.36]) {
      b.torus(0.0205, 0.0022, { at: [0, y, 0], rot: [PI / 2, 0, 0], scale: [1, 0.85, 1], color: shade(grip, -0.12),
        seg: 18, tubeSeg: 4 });
    }
  },

  // A combination spanner standing upright: open jaw at the top, ring end at the bottom.
  wrench(b, p) {
    const col = p.color || "#dde2e8";
    const o = metal(col);
    const bev = 0.005, T = 0.032 - 2 * bev;
    // open-ended jaw, tilted 15 degrees
    const R = 0.05, w = 0.021, tilt = 0.26;
    const jaw = [];
    const al = Math.asin(w / R);
    for (let i = 0; i <= 22; i++) {
      const a = al + ((TAU - 2 * al) * i) / 22;
      jaw.push([R * Math.sin(a), R * Math.cos(a)]);
    }
    for (let i = 0; i <= 8; i++) {
      const t = (i / 8) * PI;
      jaw.push([-w * Math.cos(t), -0.004 - w * Math.sin(t)]);
    }
    const rot = (q) => [q[0] * Math.cos(tilt) - q[1] * Math.sin(tilt), q[0] * Math.sin(tilt) + q[1] * Math.cos(tilt)];
    const jy = 0.4 - R - bev - 0.002;
    b.extrude(jaw.map(rot), T, { at: [0, jy, 0], ...o, bevel: bev });
    // ring end with a twelve-point socket
    const R2 = 0.038, ry = R2 + bev;
    const hex = roundPoly(circle(0.0215 + bev, 6).map(([x, y]) => [y, x]), 0.003, 2).reverse();
    b.extrude(shape(circle(R2, 36), [hex]), T, { at: [0, ry, 0], ...o, bevel: bev });
    // handle: a tapered bar with a recessed panel
    const hy0 = ry + R2 - 0.012, hy1 = jy - R + 0.012;
    b.extrude(roundPoly([[-0.0165, hy0], [0.0165, hy0], [0.0145, hy1], [-0.0145, hy1]], 0.004), T * 0.8,
      { ...o, bevel: bev });
    b.box(0.014, hy1 - hy0 - 0.05, 0.004, { at: [0, (hy0 + hy1) / 2, T * 0.4 + bev], color: shade(col, -0.12),
      kind: "metal", r: 0.002, seg: 1 });
  },

  // Scissors standing on their finger loops, blades open in a V above the pivot screw.
  scissors(b, p) {
    const col = p.color || C.red;
    const steel = metal("#c9d0d8");
    const py = 0.132, open = 0.2;
    const blade = roundPoly([[0.011, -0.016], [0.0135, 0.05], [0.009, 0.15], [0.0015, 0.2], [-0.0055, 0.16],
      [-0.006, 0.0], [-0.004, -0.016]], [0.004, 0.03, 0.03, 0.002, 0.03, 0.01, 0.004], 4);
    const loopC = [0.034, -0.1];
    const loop = shape(ellipse(0.043, 0.036, 28, ...loopC), [ellipse(0.028, 0.021, 24, ...loopC).reverse()]);
    const shank = roundPoly([[-0.009, 0.004], [0.011, -0.012], [loopC[0] + 0.006, loopC[1] + 0.03],
      [loopC[0] - 0.018, loopC[1] + 0.028]], 0.008, 3);
    b.mirrorX((bb, side) => b.group({ at: [0, py, 0], rot: [0, 0, open] }, () => {
      const z = side * 0.0055;
      b.extrude(blade, 0.0045, { at: [0, 0, z], ...steel, bevel: 0.0015 });
      b.extrude(loop, 0.02, { at: [0, 0, z * 0.6], color: col, kind: "gloss", bevel: 0.004 });
      b.extrude(shank, 0.012, { at: [0, 0, z * 0.6], color: col, kind: "gloss", bevel: 0.003 });
    }));
    b.cyl(0.0085, 0.0085, 0.026, { at: [0, py, 0], rot: ZA, ...metal(C.silver), seg: 12 });
    b.cyl(0.0035, 0.0035, 0.028, { at: [0, py, 0], rot: ZA, color: "#555a60", seg: 8 });
  },

  // A magnifying glass standing on its handle: brass rim, glass lens with a glint, turned wooden handle.
  magnifier(b, p) {
    const handle = p.color || "#7a3f22";
    const cy = 0.307, R = 0.08;
    b.torus(R, 0.0105, { at: [0, cy, 0], scale: [1, 1, 1.55], ...metal(C.brass), seg: 40, tubeSeg: 10 });
    b.lathe([[0, 0.011], [0.035, 0.0095], [0.062, 0.005], [R - 0.004, 0], [0.062, -0.005], [0.035, -0.0095],
      [0, -0.011]], { at: [0, cy, 0], rot: ZA, color: "#d6eef6", kind: "glass", seg: 32 });
    b.torus(0.052, 0.0035, { at: [0, cy, 0.0125], rot: [0, 0, PI * 0.56], arc: 0.85, color: "#ffffff", kind: "glow",
      light: false, seg: 10, tubeSeg: 4 });
    b.sphere(0.0045, { at: [-0.012, cy + 0.054, 0.012], color: "#ffffff", kind: "glow", light: false, seg: 6 });
    // collar and handle
    b.cyl(0.011, 0.013, 0.03, { at: [0, cy - R - 0.017, 0], ...metal(C.brass), seg: 14 });
    b.lathe([[0.012, 0.232], [0.016, 0.224], [0.0145, 0.205], [0.017, 0.19], [0.019, 0.12], [0.0195, 0.05],
      [0.017, 0.012], [0.012, 0.0], [0, 0]], { color: handle, kind: "gloss", seg: 16 });
    b.torus(0.0168, 0.003, { at: [0, 0.19, 0], rot: [PI / 2, 0, 0], ...metal(C.brass), seg: 16, tubeSeg: 4 });
  },

  // A brass refractor on a wooden tripod, tilted up towards the sky behind and to the right.
  telescope(b, p) {
    const col = p.color || C.brass;
    const o = metal(col), band = metal(shade(col, -0.14));
    const wood = "#7a5034";
    const hy = 0.7;
    const legs = [PI, PI / 3, -PI / 3];
    const legAt = (a, y) => { const t = 1 - y / hy, rr = 0.03 + 0.21 * t; return [Math.sin(a) * rr, y, Math.cos(a) * rr]; };
    for (const a of legs) {
      b.rod(legAt(a, hy), legAt(a, 0.012), 0.016, { r2: 0.013, color: wood, seg: 8 });
      b.sphere(0.016, { at: legAt(a, 0.012), scale: [1, 0.7, 1], ...band, seg: 8 });
      b.box(0.04, 0.03, 0.03, { at: legAt(a, hy - 0.02), rot: [0, a, 0], ...o, r: 0.006 });
    }
    // spreader with a little accessory tray
    for (let i = 0; i < 3; i++) b.rod(legAt(legs[i], 0.3), [0, 0.3, 0], 0.005, { ...band, seg: 6 });
    b.cyl(0.05, 0.045, 0.012, { at: [0, 0.3, 0], ...o, seg: 16 });
    // head and cradle
    b.cyl(0.045, 0.05, 0.035, { at: [0, hy + 0.005, 0], ...o, seg: 20 });
    b.cyl(0.018, 0.018, 0.05, { at: [0, hy + 0.045, 0], ...band, seg: 12 });
    // tube: built along +x, then raised and turned
    const el = 0.52, yaw = 0.98;
    b.group({ at: [0, hy + 0.085, 0], rot: [0, yaw, el] }, () => {
      b.box(0.1, 0.022, 0.05, { at: [0, -0.044, 0], ...band, r: 0.006 });
      for (const x of [-0.05, 0.05]) b.torus(0.047, 0.006, { at: [x, 0, 0], rot: [0, PI / 2, 0], ...band, seg: 24, tubeSeg: 6 });
      b.cyl(0.042, 0.042, 0.56, { at: [0.06, 0, 0], rot: XA, ...o, seg: 24 });
      b.lathe([[0.043, 0], [0.054, 0.008], [0.054, 0.15], [0.058, 0.16], [0.058, 0.172], [0.049, 0.172], [0.049, 0.02],
        [0, 0.02]], { at: [0.3, 0, 0], rot: XA, ...o, seg: 24 });
      b.cyl(0.049, 0.049, 0.004, { at: [0.468, 0, 0], rot: XA, color: "#1f3550", kind: "gloss", seg: 24 });
      b.torus(0.03, 0.004, { at: [0.471, 0, 0], rot: [0, PI / 2, 0.6], arc: 1.2, color: "#cfe6ff", kind: "glow", light: false, seg: 8, tubeSeg: 4 });
      for (const x of [-0.2, 0.12, 0.3]) b.torus(0.043, 0.0055, { at: [x, 0, 0], rot: [0, PI / 2, 0], ...band, seg: 24, tubeSeg: 6 });
      // focuser, eyepiece and finder scope
      b.cyl(0.027, 0.03, 0.08, { at: [-0.26, 0, 0], rot: XA, ...band, seg: 16 });
      b.cyl(0.016, 0.018, 0.06, { at: [-0.325, 0, 0], rot: XA, ...metal(C.silver), seg: 14 });
      b.cyl(0.02, 0.02, 0.022, { at: [-0.36, 0, 0], rot: XA, color: C.black, kind: "gloss", seg: 14 });
      b.cyl(0.012, 0.012, 0.024, { at: [-0.24, 0, 0.034], rot: ZA, ...metal(C.silver), seg: 10 });
      for (const x of [-0.02, 0.1]) b.box(0.012, 0.03, 0.012, { at: [x, 0.055, 0], ...band, r: 0.003 });
      b.cyl(0.013, 0.013, 0.17, { at: [0.04, 0.07, 0], rot: XA, ...o, seg: 12 });
      b.cyl(0.016, 0.013, 0.03, { at: [0.135, 0.07, 0], rot: XA, ...o, seg: 12 });
    });
  },

  // A microscope seen from three quarters: curved arm, inclined eyepiece tube, objective turret over a stage
  // with a slide, focus knobs and a glowing lamp in the base.
  microscope(b, p) {
    const body = p.color || "#3a6ea5";
    const chrome = metal("#d3d8de"), black = { color: "#24272c", kind: "gloss" };
    b.group({ rot: [0, 0.56, 0] }, () => {
      b.box(0.22, 0.032, 0.2, { at: [-0.005, 0.016, 0], color: body, kind: "gloss", r: 0.014 });
      b.cyl(0.026, 0.03, 0.008, { at: [-0.025, 0.035, 0], color: "#fff4c8", kind: "glow", light: false, seg: 16 });
      b.cyl(0.032, 0.032, 0.006, { at: [-0.025, 0.032, 0], ...chrome, seg: 16 });
      // arm
      b.tube([[0.07, 0.03, 0], [0.09, 0.11, 0], [0.088, 0.2, 0], [0.06, 0.28, 0], [0.012, 0.33, 0]], 0.022,
        { color: body, kind: "gloss", scale: [1, 1, 1.5], seg: 24, radial: 12 });
      b.box(0.06, 0.05, 0.05, { at: [0.07, 0.04, 0], color: body, kind: "gloss", r: 0.014 });
      // stage on a bracket
      b.box(0.06, 0.02, 0.04, { at: [0.045, 0.165, 0], color: body, kind: "gloss", r: 0.006 });
      b.box(0.12, 0.012, 0.12, { at: [-0.025, 0.172, 0], ...black, r: 0.004 });
      b.box(0.075, 0.003, 0.026, { at: [-0.025, 0.1795, 0.0], color: "#e8f4f8", kind: "glass", r: 0 });
      b.cyl(0.007, 0.007, 0.001, { at: [-0.025, 0.1812, 0], color: "#d4508a", kind: "gloss", seg: 12 });
      for (const z of [-0.032, 0.032]) b.box(0.05, 0.004, 0.008, { at: [0.012, 0.181, z], ...chrome, r: 0.0015 });
      // focus knobs
      for (const z of [-1, 1]) {
        b.cyl(0.03, 0.03, 0.014, { at: [0.08, 0.13, z * 0.04], rot: ZA, ...black, seg: 20 });
        b.cyl(0.018, 0.018, 0.012, { at: [0.08, 0.13, z * 0.053], rot: ZA, ...chrome, seg: 16 });
      }
      // head, turret and inclined tube
      b.sphere(0.03, { at: [0.0, 0.335, 0], scale: [1.2, 0.9, 1], color: body, kind: "gloss", seg: 16 });
      const t0 = [-0.025, 0.255], dir = unit3([-0.36, 1, 0]);
      b.group({ at: [t0[0], t0[1], 0], rot: [0, 0, Math.atan2(-dir[0], dir[1])] }, () => {
        b.cyl(0.024, 0.024, 0.15, { at: [0, 0.085, 0], ...chrome, seg: 18 });
        b.cyl(0.027, 0.027, 0.014, { at: [0, 0.165, 0], ...black, seg: 18 });
        b.cyl(0.017, 0.017, 0.045, { at: [0, 0.19, 0], ...chrome, seg: 14 });
        b.cyl(0.021, 0.02, 0.022, { at: [0, 0.222, 0], ...black, seg: 14 });
      });
      b.cyl(0.04, 0.03, 0.022, { at: [-0.022, 0.24, 0], ...chrome, seg: 18 });
      const rings = ["#d8483c", "#f0c64a", "#3f74c4"];
      [-0.75, 0, 0.75].forEach((a, i) => b.group({ at: [-0.022, 0.232, 0], rot: [a * 0.55, 0, 0] }, () => {
        b.cyl(0.0085, 0.011, 0.04, { at: [0, -0.024, 0], ...chrome, seg: 10 });
        b.cyl(0.0115, 0.0115, 0.005, { at: [0, -0.018, 0], color: rings[i], kind: "gloss", seg: 10 });
      }));
    });
  },

  // A two-pan balance: wooden base, turned brass column, beam with a pointer; pans hang on three cords.
  // Variants tilt the beam towards the heavier side.
  balance(b, p) {
    const col = p.color || C.brass;
    const o = metal(col), dark = metal(shade(col, -0.15));
    const wood = "#6b4a30";
    b.lathe([[0, 0], [0.13, 0], [0.135, 0.012], [0.13, 0.026], [0.108, 0.032], [0.104, 0.05], [0, 0.05]], { color: wood, seg: 28 });
    b.lathe([[0.06, 0.05], [0.055, 0.06], [0.032, 0.07], [0.024, 0.09], [0.026, 0.1], [0.016, 0.115], [0.013, 0.44],
      [0.02, 0.455], [0.016, 0.47], [0.012, 0.52], [0, 0.52]], { ...o, seg: 20 });
    const py = 0.535;
    b.box(0.03, 0.04, 0.04, { at: [0, py - 0.01, 0], ...dark, r: 0.008 });
    b.cyl(0.006, 0.006, 0.06, { at: [0, py + 0.03, 0], ...o, seg: 8 });
    b.sphere(0.022, { at: [0, py + 0.07, 0], ...o, seg: 14 });
    b.cone(0.012, 0.03, { at: [0, py + 0.1, 0], ...o, seg: 10 });
    // scale plate behind the pointer
    b.torus(0.07, 0.004, { at: [0, py, 0.025], rot: [0, 0, -PI / 2 - 0.35], arc: 0.7, ...dark, seg: 14, tubeSeg: 4 });
    for (const a of [-0.3, -0.15, 0, 0.15, 0.3]) {
      b.box(0.003, 0.014, 0.003, { at: [Math.sin(a) * 0.07, py - Math.cos(a) * 0.07, 0.027], rot: [0, 0, a], color: C.ink, r: 0 });
    }
    const th = p.variant === "left_heavy" ? 0.2 : p.variant === "right_heavy" ? -0.2 : 0;
    const L = 0.29;
    b.group({ at: [0, py, 0], rot: [0, 0, th] }, () => {
      b.rod([0, 0, 0], [L, 0, 0], 0.014, { r2: 0.007, ...o, seg: 12 });
      b.rod([0, 0, 0], [-L, 0, 0], 0.014, { r2: 0.007, ...o, seg: 12 });
      b.cyl(0.026, 0.026, 0.04, { rot: ZA, ...o, seg: 18 });
      b.cyl(0.009, 0.009, 0.046, { rot: ZA, ...dark, seg: 10 });
      for (const x of [-L, L]) b.sphere(0.013, { at: [x, 0, 0], ...o, seg: 10 });
      b.extrude([[-0.006, 0], [0.006, 0], [0.0015, -0.085], [-0.0015, -0.085]], 0.003, { at: [0, 0, 0.03], color: C.crimson, bevel: 0.001 });
    });
    // pans
    const hang = 0.27;
    const weight = (x, y, s) => {
      b.lathe([[0, 0], [0.022 * s, 0], [0.022 * s, 0.03 * s], [0.016 * s, 0.034 * s], [0.008 * s, 0.036 * s],
        [0.008 * s, 0.046 * s], [0.011 * s, 0.05 * s], [0, 0.056 * s]], { at: [x, y, 0], ...o, seg: 16 });
    };
    for (const sx of [-1, 1]) {
      const ex = sx * L * Math.cos(th), ey = py + sx * L * Math.sin(th) - 0.014;
      const pyy = ey - hang;
      b.torus(0.011, 0.0025, { at: [ex, ey - 0.006, 0], rot: [0, PI / 2, 0], ...dark, seg: 10, tubeSeg: 4 });
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + PI / 2;
        b.rod([ex, ey - 0.014, 0], [ex + Math.cos(a) * 0.082, pyy + 0.024, Math.sin(a) * 0.082], 0.0022, { ...dark, seg: 4 });
      }
      b.lathe([[0, 0], [0.05, 0.003], [0.08, 0.013], [0.092, 0.024], [0.088, 0.027], [0.076, 0.017], [0.05, 0.008], [0, 0.006]],
        { at: [ex, pyy, 0], ...o, seg: 28 });
      const heavy = (sx < 0 && th > 0) || (sx > 0 && th < 0);
      if (th === 0) weight(ex, pyy + 0.006, 1);
      else if (heavy) { weight(ex - 0.03, pyy + 0.006, 1.3); weight(ex + 0.035, pyy + 0.006, 1); }
      else weight(ex, pyy + 0.006, 0.75);
    }
  },

  // A thick wooden ruler lying flat, with a steel edge, tick marks and numbers.
  ruler(b, p) {
    const col = p.color || "#ecc25e";
    const L = 0.6, D = 0.076, H = 0.025;
    b.box(L, H, D, { at: [0, H / 2, 0], color: col, r: 0.005 });
    b.box(L - 0.006, 0.006, 0.006, { at: [0, H - 0.002, D / 2 - 0.003], ...metal(C.silver), r: 0.002, seg: 1 });
    const ink = C.ink, z0 = D / 2 - 0.006;
    for (let i = 0; i <= 56; i++) {
      const x = -0.27 + i * 0.01;
      const major = i % 10 === 0, half = i % 10 === 5;
      if (i % 2 && !half) {
        b.box(0.0016, 0.001, 0.009, { at: [x, H + 0.0004, z0 - 0.0045], color: ink, r: 0 });
        continue;
      }
      const len = major ? 0.026 : half ? 0.019 : 0.013;
      b.box(major ? 0.0026 : 0.002, 0.001, len, { at: [x, H + 0.0004, z0 - len / 2], color: ink, r: 0 });
      if (major) b.text(String(i / 2), { at: [x, H + 0.001, z0 - 0.04], rot: [-PI / 2, 0, 0], w: 0.03, h: 0.018, fg: ink, font: "body" });
    }
    b.cyl(0.006, 0.006, 0.002, { at: [0.288, H + 0.0002, -0.012], color: shade(col, -0.35), seg: 12 });
  },

  // A drawing compass standing open on a sheet of paper: needle leg, pencil leg, bow screw with a wheel, and
  // the arc it has just drawn.
  drafting_compass(b, p) {
    const col = p.color || "#3f74c4";
    const chrome = metal("#d3d8de");
    const H = [0, 0.335, 0];
    // paper and the drawn arc
    b.box(0.27, 0.004, 0.1, { at: [0, 0.002, 0], color: "#d9e7f4", r: 0.0015, seg: 1 });
    const arcPts = [];
    for (let i = 0; i <= 10; i++) { const a = -0.21 + 0.42 * (i / 10); arcPts.push([-0.11 + 0.22 * Math.cos(a), 0.0035, 0.22 * Math.sin(a)]); }
    b.tube(arcPts, 0.0024, { color: "#3a4a66", seg: 24, radial: 4 });
    b.cyl(0.004, 0.004, 0.001, { at: [-0.11, 0.0035, 0], color: "#4a4e57", seg: 8 });
    // legs
    const leg = (foot) => { const d = unit3(sub3(foot, H)); return (t) => add3(H, d, t); };
    const nl = leg([-0.11, 0.004, 0]), pl = leg([0.11, 0.004, 0]);
    const lenN = Math.hypot(0.11, 0.331);
    b.rod(nl(0.01), nl(lenN - 0.045), 0.011, { r2: 0.008, ...chrome, seg: 10 });
    b.rod(nl(lenN - 0.05), nl(lenN - 0.02), 0.0055, { r2: 0.0045, ...metal(C.steel), seg: 8 });
    b.rod(nl(lenN - 0.02), nl(lenN), 0.0016, { r2: 0.0003, ...chrome, seg: 6 });
    b.rod(pl(0.01), pl(lenN - 0.075), 0.011, { r2: 0.008, ...chrome, seg: 10 });
    b.rod(pl(lenN - 0.085), pl(lenN - 0.06), 0.0095, { ...metal(C.steel), seg: 10 });
    b.rod(pl(lenN - 0.075), pl(lenN - 0.018), 0.0068, { color: C.yellow, seg: 6 });
    b.rod(pl(lenN - 0.018), pl(lenN - 0.004), 0.0068, { r2: 0.0022, color: C.lightWood, seg: 6 });
    b.rod(pl(lenN - 0.004), pl(lenN), 0.0022, { r2: 0.0006, color: "#33363d", seg: 6 });
    // bow screw and wheel
    const y = 0.17, hx = 0.11 * (H[1] - y) / 0.331;
    b.rod([-hx, y, 0], [hx, y, 0], 0.0035, { ...metal(C.steel), seg: 6 });
    b.cyl(0.02, 0.02, 0.009, { at: [0, y, 0], rot: XA, color: col, kind: "gloss", seg: 18 });
    for (const sx of [-1, 1]) b.sphere(0.006, { at: [sx * hx, y, 0], ...chrome, seg: 8 });
    // hinge head and handle
    b.cyl(0.03, 0.03, 0.022, { at: H, rot: ZA, color: col, kind: "gloss", seg: 20 });
    b.cyl(0.011, 0.011, 0.026, { at: H, rot: ZA, ...chrome, seg: 10 });
    b.cyl(0.0085, 0.0085, 0.045, { at: [0, H[1] + 0.042, 0], ...chrome, seg: 10 });
    for (const yy of [0.37, 0.378, 0.386]) b.torus(0.009, 0.0016, { at: [0, yy, 0], rot: [PI / 2, 0, 0], color: shade(col, -0.1), seg: 12, tubeSeg: 4 });
    b.sphere(0.01, { at: [0, H[1] + 0.065, 0], color: col, kind: "gloss", seg: 10 });
  },

  // A funnel held in a ring stand, liquid inside, a drop falling into a small beaker below.
  funnel(b, p) {
    const col = p.color || "#f08a3c";
    const stand = metal("#7d8792");
    const ry = 0.205;
    b.torus(0.062, 0.007, { at: [0, ry, 0], rot: [PI / 2, 0, 0], ...stand, seg: 28, tubeSeg: 6 });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + PI / 2;
      b.rod([Math.cos(a) * 0.062, ry, Math.sin(a) * 0.062], [Math.cos(a) * 0.128, 0.008, Math.sin(a) * 0.128], 0.0065, { ...stand, seg: 8 });
      b.sphere(0.011, { at: [Math.cos(a) * 0.128, 0.008, Math.sin(a) * 0.128], scale: [1, 0.7, 1], color: C.black, kind: "gloss", seg: 8 });
    }
    const rIn = (y) => 0.007 + (0.132 - 0.007) * (y - 0.2) / (0.386 - 0.2);
    b.lathe([[0.007, 0.125], [0.012, 0.125], [0.012, 0.2], [0.14, 0.386], [0.149, 0.39], [0.149, 0.4], [0.141, 0.4],
      [0.132, 0.39], [0.007, 0.205], [0.007, 0.125]], { color: col, kind: "gloss", seg: 32 });
    const lq = "#3d8fd9", ly = 0.32;
    b.lathe([[0, 0.2], [0.007, 0.2], [rIn(ly) - 0.002, ly], [0, ly]], { color: lq, kind: "gloss", seg: 24 });
    b.lathe([[0, 0], [0.004, 0.003], [0.0055, 0.008], [0.004, 0.013], [0.0015, 0.018], [0, 0.021]], { at: [0, 0.098, 0], color: lq, kind: "gloss", seg: 10 });
    // beaker
    const Rb = 0.046;
    b.lathe([[0, 0.034], [Rb - 0.006, 0.034], [Rb - 0.006, 0.006], [0, 0.006]], { color: inGlass(lq), kind: "gloss", seg: 24 });
    b.lathe([[0, 0], [Rb - 0.005, 0], [Rb, 0.005], [Rb, 0.072], [Rb + 0.004, 0.078], [Rb - 0.003, 0.078], [Rb - 0.004, 0.072],
      [Rb - 0.004, 0.006], [0, 0.004]], { color: C.glass, kind: "glass", seg: 28 });
    for (const y of [0.025, 0.04, 0.055]) {
      b.box(0.014, 0.002, 0.002, { at: [-0.012, y, Rb + 0.0005], color: "#ffffff", kind: "glow", light: false, r: 0 });
    }
  },

  // Copper pipes rising from a slab: an inverted U with a red valve wheel, a steel riser with a pressure gauge,
  // bolted flanges.
  pipes(b, p) {
    const main = p.color ? { color: p.color, kind: "gloss" } : metal(C.copper);
    const second = p.color ? { color: shade(p.color, 0.12), kind: "gloss" } : metal("#aeb6bf");
    const fl = p.color ? { color: shade(p.color, -0.12), kind: "gloss" } : metal(shade(C.copper, -0.1));
    const fl2 = metal("#8e969f");
    b.box(0.8, 0.03, 0.27, { at: [0, 0.015, 0], color: "#a29d95", r: 0.01 });
    const r = 0.038, zA = -0.06, y0 = 0.03;
    pipe(b, [[-0.3, y0, zA], [-0.3, 0.52, zA], [0.29, 0.52, zA], [0.29, y0, zA]], r, main);
    for (const x of [-0.3, 0.29]) {
      flange(b, [x, y0 + 0.012, zA], r, "y", fl);
      flange(b, [x, 0.22, zA], r, "y", fl);
    }
    flange(b, [0.16, 0.52, zA], r, "x", fl);
    // riser with gauge, passing in front
    const r2 = 0.026, zB = 0.07;
    pipe(b, [[-0.15, y0, zB], [-0.15, 0.3, zB], [0.08, 0.3, zB], [0.08, 0.6, zB]], r2, second);
    flange(b, [-0.15, y0 + 0.01, zB], r2, "y", fl2);
    b.cyl(r2 * 1.2, r2 * 1.2, 0.03, { at: [0.08, 0.6, zB], ...fl2, seg: 14 });
    const gy = 0.655;
    b.cyl(0.05, 0.05, 0.034, { at: [0.08, gy, zB], rot: ZA, ...metal(C.brass), seg: 28 });
    b.cyl(0.042, 0.042, 0.004, { at: [0.08, gy, zB + 0.016], rot: ZA, color: C.white, kind: "gloss", seg: 28 });
    for (let i = 0; i <= 8; i++) {
      const a = -2.2 + (4.4 * i) / 8;
      b.box(0.003, 0.009, 0.002, { at: [0.08 + Math.sin(a) * 0.032, gy + Math.cos(a) * 0.032, zB + 0.0185], rot: [0, 0, -a],
        color: i > 6 ? C.red : C.ink, r: 0 });
    }
    b.box(0.004, 0.03, 0.002, { at: [0.08 + Math.sin(0.7) * 0.013, gy + Math.cos(0.7) * 0.013, zB + 0.0195], rot: [0, 0, -0.7], color: C.red, r: 0 });
    b.cyl(0.005, 0.005, 0.004, { at: [0.08, gy, zB + 0.02], rot: ZA, color: C.ink, seg: 8 });
    b.cyl(0.0455, 0.0455, 0.003, { at: [0.08, gy, zB + 0.0175], rot: ZA, color: C.glass, kind: "glass", seg: 28 });
    // valve on the top run, with a handwheel facing the viewer
    const vx = -0.06, vy = 0.52;
    b.sphere(0.058, { at: [vx, vy, zA], scale: [1.15, 1, 1], ...fl, seg: 16 });
    b.cyl(0.03, 0.034, 0.05, { at: [vx, vy, zA + 0.07], rot: ZA, ...fl, seg: 14 });
    b.cyl(0.008, 0.008, 0.08, { at: [vx, vy, zA + 0.12], rot: ZA, ...metal(C.silver), seg: 8 });
    const red = { color: "#d8392f", kind: "gloss" }, wz = zA + 0.155;
    b.torus(0.068, 0.011, { at: [vx, vy, wz], ...red, seg: 32, tubeSeg: 8 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + PI / 2;
      b.rod([vx, vy, wz], [vx + Math.cos(a) * 0.066, vy + Math.sin(a) * 0.066, wz], 0.0065, { ...red, seg: 6 });
    }
    b.cyl(0.017, 0.017, 0.022, { at: [vx, vy, wz], rot: ZA, ...red, seg: 14 });
  },

  // A conveyor belt on legs carrying parcels left to right; chevrons on the belt show the direction.
  conveyor(b, p) {
    const col = p.color || "#f0a830";
    const steel = metal("#9aa3ad"), beltC = "#33363c";
    const by = 0.31, Rr = 0.04, X = 0.54, W = 0.29;
    for (const x of [-0.47, 0.47]) for (const z of [-0.14, 0.14]) {
      b.box(0.04, by - 0.02, 0.04, { at: [x, (by - 0.02) / 2, z], ...steel, r: 0.006 });
      b.box(0.06, 0.012, 0.06, { at: [x, 0.006, z], color: "#3a3d44", r: 0.004 });
    }
    for (const z of [-0.14, 0.14]) b.box(0.9, 0.025, 0.025, { at: [0, 0.09, z], ...steel, r: 0.005 });
    for (const x of [-0.47, 0.47]) b.box(0.025, 0.025, 0.26, { at: [x, 0.09, 0], ...steel, r: 0.005 });
    // rollers and belt loop
    for (const sx of [-1, 1]) {
      b.cyl(Rr, Rr, W + 0.02, { at: [sx * X, by, 0], rot: ZA, ...steel, seg: 18 });
      b.cyl(Rr + 0.008, Rr + 0.008, W, { at: [sx * X, by, 0], rot: ZA, color: beltC, open: true,
        thetaStart: sx > 0 ? 0 : PI, thetaLength: PI, seg: 14 });
    }
    b.box(2 * X, 0.008, W, { at: [0, by + Rr + 0.004, 0], color: beltC, r: 0 });
    b.box(2 * X, 0.008, W, { at: [0, by - Rr - 0.004, 0], color: beltC, r: 0 });
    for (let i = 0; i < 6; i++) {
      const x = -0.45 + i * 0.18;
      b.extrude([[-0.03, -0.045], [-0.012, -0.045], [0.02, 0], [-0.012, 0.045], [-0.03, 0.045], [0.002, 0]], 0.002,
        { at: [x, by + Rr + 0.0085, 0], rot: [-PI / 2, 0, 0], color: C.yellow, bevel: 0 });
    }
    // side rails with arrows and a motor box
    for (const sz of [-1, 1]) b.box(2 * X + 0.06, 0.07, 0.025, { at: [0, by + 0.012, sz * 0.165], color: col, kind: "gloss", r: 0.008 });
    for (const x of [-0.3, 0, 0.3]) {
      b.extrude([[-0.05, -0.008], [0.02, -0.008], [0.02, -0.02], [0.05, 0], [0.02, 0.02], [0.02, 0.008], [-0.05, 0.008]],
        0.002, { at: [x, by + 0.012, 0.179], color: "#fff8e8", bevel: 0.001 });
    }
    b.box(0.11, 0.1, 0.1, { at: [-0.4, 0.2, 0.12], color: shade(col, -0.25), kind: "gloss", r: 0.012 });
    b.sphere(0.012, { at: [-0.37, 0.225, 0.171], color: "#5cff7a", kind: "glow", light: false, seg: 8 });
    // parcels
    const parcel = (x, w, h, d, yaw) => b.group({ at: [x, by + Rr + 0.008, 0], rot: [0, yaw, 0] }, () => {
      b.box(w, h, d, { at: [0, h / 2, 0], color: "#c99a62", r: 0.006 });
      b.box(w + 0.002, h * 0.3, 0.004, { at: [0, h * 0.55, d / 2 + 0.001], color: "#e9d7ad", r: 0.001, seg: 1 });
      b.box(0.03, 0.002, d + 0.002, { at: [0, h + 0.001, 0], color: "#e9d7ad", r: 0, seg: 1 });
    });
    parcel(-0.3, 0.15, 0.1, 0.15, 0.08);
    parcel(0.05, 0.12, 0.085, 0.13, -0.12);
    parcel(0.36, 0.14, 0.095, 0.14, 0.05);
  },

  // An hourglass: turned wooden end plates and spindles around a glass double bulb; sand (color) runs from
  // the top bulb into a mound below.
  hourglass(b, p) {
    const sand = inGlass(p.color || "#e8b04a");
    const wood = "#8a5534";
    const H = 0.36;
    const plate = [[0, 0], [0.093, 0], [0.1, 0.006], [0.1, 0.019], [0.093, 0.025], [0.078, 0.027], [0.07, 0.032], [0, 0.032]];
    b.lathe(plate, { color: wood, kind: "gloss", seg: 32 });
    b.lathe(plate, { at: [0, H, 0], rot: [PI, 0, 0], color: wood, kind: "gloss", seg: 32 });
    for (const a of [PI, PI / 3, -PI / 3]) {
      b.lathe([[0.0095, 0.03], [0.0125, 0.04], [0.0075, 0.06], [0.008, 0.155], [0.0115, 0.18], [0.008, 0.205], [0.0075, 0.3],
        [0.0125, 0.32], [0.0095, 0.33]], { at: [Math.sin(a) * 0.079, 0, Math.cos(a) * 0.079], color: shade(wood, 0.05), kind: "gloss", seg: 10 });
    }
    // glass: two bulbs and a narrow waist
    const prof = smooth([[0.03, 0.032], [0.056, 0.045], [0.064, 0.085], [0.052, 0.135], [0.02, 0.17], [0.0075, 0.18],
      [0.02, 0.19], [0.052, 0.225], [0.064, 0.275], [0.056, 0.315], [0.03, 0.328]], 40);
    b.lathe([[0, 0.032], ...prof, [0, 0.328]], { color: "#dff1f6", kind: "glass", seg: 28 });
    const rAt = (y) => {
      for (let i = 1; i < prof.length; i++) {
        const [r0, y0] = prof[i - 1], [r1, y1] = prof[i];
        if ((y - y0) * (y - y1) <= 0 && y1 !== y0) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
      }
      return 0.01;
    };
    // top sand, a dimple sinking into the neck
    const ly = 0.262, top = [];
    for (let y = 0.181; y < ly; y += 0.01) top.push([rAt(y) - 0.004, y]);
    b.lathe([[0, 0.181], ...top, [rAt(ly) - 0.004, ly], [0.03, ly - 0.002], [0, ly - 0.016]], { color: sand, seg: 24 });
    // bottom mound and the falling stream
    const bot = [];
    for (let y = 0.036; y <= 0.07; y += 0.008) bot.push([rAt(y) - 0.004, y]);
    b.lathe([[0, 0.036], ...bot, [0.03, 0.09], [0, 0.112]], { color: sand, seg: 24 });
    b.cyl(0.0022, 0.0022, 0.075, { at: [0, 0.145, 0], color: sand, seg: 6 });
  },

  // A stopwatch standing on its rim: chrome case, crown with a ring, a side button, a white dial with a
  // red sweep hand and a small minute sub-dial.
  stopwatch(b, p) {
    const caseO = p.color ? { color: p.color, kind: "gloss" } : metal("#d6dbe1");
    const R = 0.078, cy = R + 0.001, D = 0.04;
    b.group({ at: [0, cy, 0] }, () => {
      b.cyl(R, R, D, { rot: ZA, ...caseO, seg: 44 });
      b.sphere(R, { at: [0, 0, -D / 2 + 0.002], scale: [1, 1, 0.12], ...caseO, seg: 32 });
      b.torus(R - 0.005, 0.0075, { at: [0, 0, D / 2], ...caseO, seg: 44, tubeSeg: 8 });
      b.cyl(R - 0.011, R - 0.011, 0.003, { at: [0, 0, D / 2 - 0.001], rot: ZA, color: C.white, kind: "gloss", seg: 40 });
      const zf = D / 2 + 0.001;
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * TAU, maj = i % 5 === 0, len = maj ? 0.011 : 0.005, rr = R - 0.016 - len / 2;
        b.box(maj ? 0.0032 : 0.0015, len, 0.002, { at: [Math.sin(a) * rr, Math.cos(a) * rr, zf], rot: [0, 0, -a], color: maj ? C.ink : "#6d7280", r: 0 });
      }
      // sub-dial
      b.torus(0.015, 0.0015, { at: [0, 0.03, zf], color: C.ink, seg: 20, tubeSeg: 4 });
      b.box(0.0022, 0.013, 0.0015, { at: [Math.sin(1.2) * 0.006, 0.03 + Math.cos(1.2) * 0.006, zf + 0.001], rot: [0, 0, -1.2], color: C.ink, r: 0 });
      // sweep hand
      const ha = 0.95;
      b.group({ at: [0, 0, zf + 0.003], rot: [0, 0, -ha] }, () => {
        b.box(0.0034, 0.062, 0.0016, { at: [0, 0.022, 0], color: C.red, r: 0 });
        b.box(0.003, 0.018, 0.0016, { at: [0, -0.012, 0], color: C.red, r: 0 });
        b.cyl(0.006, 0.006, 0.002, { at: [0, -0.018, 0], rot: ZA, color: C.red, seg: 10 });
      });
      b.cyl(0.006, 0.006, 0.005, { at: [0, 0, zf + 0.004], rot: ZA, color: C.red, kind: "gloss", seg: 12 });
      // crown, ring and side button
      b.cyl(0.008, 0.01, 0.014, { at: [0, R + 0.006, 0], ...caseO, seg: 12 });
      b.cyl(0.0135, 0.0135, 0.014, { at: [0, R + 0.019, 0], ...metal("#c9ced5"), seg: 16 });
      b.torus(0.0145, 0.0035, { at: [0, R + 0.042, 0], ...metal("#c9ced5"), seg: 18, tubeSeg: 6 });
      b.group({ rot: [0, 0, -0.75] }, () => {
        b.cyl(0.0045, 0.0045, 0.012, { at: [0, R + 0.005, 0], ...caseO, seg: 8 });
        b.cyl(0.008, 0.008, 0.009, { at: [0, R + 0.013, 0], ...metal("#c9ced5"), seg: 12 });
      });
    });
  },

  // A thermometer on a white board with a foot: glass tube, liquid bulb, tick marks and a cold-to-hot strip.
  // Variant sets the level: hot (red, high), mid, cold (blue, low).
  thermometer(b, p) {
    const v = p.variant || "mid";
    const liquid = inGlass(v === "hot" ? "#e3342b" : v === "cold" ? "#2f86e0" : "#ec6a2c");
    const level = v === "hot" ? 0.5 : v === "cold" ? 0.18 : 0.34;
    b.box(0.12, 0.028, 0.05, { at: [0, 0.014, 0], color: "#3f5f8c", kind: "gloss", r: 0.01 });
    b.box(0.105, 0.57, 0.02, { at: [0, 0.31, -0.008], color: "#3f5f8c", kind: "gloss", r: 0.012 });
    b.box(0.09, 0.545, 0.006, { at: [0, 0.313, 0.004], color: C.white, kind: "gloss", r: 0.003, seg: 1 });
    // tube and bulb
    const z = 0.016;
    b.capsule(0.0095, 0.43, { at: [0, 0.335, z], color: "#e8f6fb", kind: "glass", seg: 12 });
    b.sphere(0.023, { at: [0, 0.095, z], color: liquid, kind: "gloss", seg: 18 });
    b.sphere(0.0265, { at: [0, 0.095, z], color: "#e8f6fb", kind: "glass", seg: 18 });
    b.cyl(0.0058, 0.0058, level - 0.1, { at: [0, (level + 0.1) / 2, z], color: liquid, kind: "gloss", seg: 10 });
    b.sphere(0.0058, { at: [0, level, z], color: liquid, kind: "gloss", seg: 8 });
    b.sphere(0.0055, { at: [-0.009, 0.104, z + 0.017], color: "#ffffff", kind: "glow", light: false, seg: 6 });
    // ticks on the left, colour strip on the right
    for (let i = 0; i <= 12; i++) {
      const y = 0.15 + i * 0.03, maj = i % 3 === 0;
      b.box(maj ? 0.022 : 0.012, 0.0028, 0.002, { at: [-0.018 - (maj ? 0.011 : 0.006), y, 0.008], color: C.ink, r: 0 });
    }
    const strip = ["#2f86e0", "#45b2d8", "#7cc576", "#f2c94c", "#f08a3a", "#e3342b"];
    strip.forEach((c, i) => b.box(0.012, 0.06, 0.002, { at: [0.027, 0.18 + i * 0.06, 0.008], color: c, r: 0 }));
    b.sphere(0.011, { at: [0.027, 0.555, 0.009], scale: [1, 1, 0.4], color: "#f2b630", kind: "gloss", seg: 10 });
    b.sphere(0.011, { at: [0.027, 0.135, 0.009], scale: [1, 1, 0.4], color: "#9fd2f5", kind: "gloss", seg: 10 });
  },

  // Laboratory glassware with coloured liquid (color): a conical flask, a round flask on a cork ring, or
  // three test tubes in a wooden rack.
  flask(b, p) {
    const liq = inGlass(p.color || "#22b573");
    const glass = { color: "#e2f3f8", kind: "glass" };
    const glint = (x, y, z, h) => b.box(0.005, h, 0.002, { at: [x, y, z], color: "#ffffff", kind: "glow", light: false, r: 0 });
    const bubbles = (pts) => pts.forEach(([x, y, z, r]) => b.sphere(r, { at: [x, y, z], color: shade(liq, 0.25), kind: "gloss", seg: 8 }));
    if (p.variant === "round") {
      const R = 0.072, cy = 0.092;
      b.torus(0.044, 0.016, { at: [0, 0.016, 0], rot: [PI / 2, 0, 0], color: "#c49a6c", seg: 24, tubeSeg: 8 });
      const fy = 0.1;
      const cap = [];
      for (let i = 0; i <= 10; i++) { const a = -PI / 2 + (i / 10) * (Math.asin((fy - cy) / (R - 0.004)) + PI / 2); cap.push([(R - 0.004) * Math.cos(a), cy + (R - 0.004) * Math.sin(a)]); }
      b.lathe([...cap, [0, fy]], { color: liq, kind: "gloss", seg: 28 });
      const neckY = cy + Math.sqrt(R * R - 0.02 * 0.02);
      const sph = [];
      for (let i = 0; i <= 14; i++) { const a = -PI / 2 + (i / 14) * (PI / 2 + Math.asin((neckY - cy) / R)); sph.push([R * Math.cos(a), cy + R * Math.sin(a)]); }
      b.lathe([...sph, [0.02, 0.29], [0.025, 0.295], [0.025, 0.302], [0, 0.302]], { ...glass, seg: 28 });
      b.cyl(0.017, 0.015, 0.03, { at: [0, 0.312, 0], color: "#c49a6c", seg: 12 });
      bubbles([[0.02, 0.1, 0.03, 0.006], [-0.03, 0.1, 0.01, 0.005], [0.0, 0.135, 0.01, 0.004]]);
      glint(-0.035, 0.11, 0.06, 0.04);
      return;
    }
    if (p.variant === "test_tubes") {
      const wood = C.lightWood;
      b.box(0.17, 0.014, 0.13, { at: [0, 0.007, 0], color: wood, r: 0.004 });
      b.box(0.17, 0.012, 0.05, { at: [0, 0.13, 0.025], color: wood, r: 0.004 });
      for (const x of [-0.08, 0.08]) b.box(0.012, 0.13, 0.05, { at: [x, 0.07, 0.025], color: shade(wood, -0.06), r: 0.003 });
      const cols = [hue(liq, 0.35), liq, hue(liq, -0.3, 0, 0.04)];
      [-0.05, 0, 0.05].forEach((x, i) => {
        const y0 = i === 1 ? 0.04 : 0.018, Lt = 0.255, r = 0.0175, lvl = [0.12, 0.17, 0.09][i];
        b.lathe([[0, y0 - 0.003], [0.011, y0], [r, y0 + 0.012], [r, y0 + Lt], [r + 0.003, y0 + Lt + 0.004], [r - 0.001, y0 + Lt + 0.004],
          [r - 0.002, y0 + 0.012], [0, y0]], { ...glass, at: [x, 0, 0.025], seg: 18 });
        b.group({ at: [x, 0, 0.025] }, () => b.lathe([[0, y0], [0.009, y0 + 0.002], [r - 0.003, y0 + 0.01], [r - 0.003, y0 + lvl], [0, y0 + lvl]], { color: cols[i], kind: "gloss", seg: 16 }));
      });
      return;
    }
    // erlenmeyer
    const Rb = 0.074, rn = 0.022, yn = 0.2, top = 0.3;
    const rAt = (y) => (y < 0.012 ? Rb - 0.012 + y : Rb - ((Rb - rn) * (y - 0.012)) / (yn - 0.012));
    const ly = 0.11;
    b.lathe([[0, 0.006], [Rb - 0.012, 0.006], [rAt(0.014) - 0.004, 0.014], [rAt(ly) - 0.004, ly], [0, ly]], { color: liq, kind: "gloss", seg: 32 });
    b.lathe([[0, 0], [Rb - 0.012, 0], [Rb, 0.012], [rn, yn], [rn, top - 0.006], [rn + 0.005, top - 0.003], [rn + 0.004, top],
      [0, top]], { ...glass, seg: 32 });
    for (const [y, w] of [[0.05, 0.022], [0.075, 0.016], [0.1, 0.022]]) {
      const r = rAt(y) + 0.001;
      b.box(w, 0.0025, 0.002, { at: [0, y, r * 0.98], rot: [-(Rb - rn) / (yn - 0.012) * 0.9, 0, 0], color: "#ffffff", kind: "glow", light: false, r: 0 });
    }
    bubbles([[0.02, 0.112, 0.02, 0.006], [-0.025, 0.112, -0.01, 0.005], [0.005, 0.135, 0.008, 0.0045], [-0.004, 0.165, 0.004, 0.0035]]);
    glint(-0.045, 0.06, 0.05, 0.05);
  },

  // A glass prism on a dark base: a white beam enters from the left and leaves as a fan of rainbow beams.
  prism(b) {
    b.box(0.34, 0.03, 0.26, { at: [0, 0.015, 0], color: "#33363d", kind: "gloss", r: 0.01 });
    // dark screen behind, so the beams and the glass read against it
    b.box(0.4, 0.27, 0.02, { at: [0, 0.135, -0.12], color: "#2a2d34", r: 0.01 });
    b.box(0.37, 0.24, 0.004, { at: [0, 0.145, -0.109], color: "#1d2026", r: 0.002, seg: 1 });
    b.box(0.25, 0.03, 0.2, { at: [0, 0.045, 0], color: "#4a4e57", kind: "gloss", r: 0.008 });
    const yb = 0.06, s = 0.235, h = (s * Math.sqrt(3)) / 2, bev = 0.007;
    b.extrude(roundPoly([[-s / 2 + bev * 1.7, bev], [s / 2 - bev * 1.7, bev], [0, h - bev * 2]], 0.012), 0.17 - 2 * bev,
      { at: [0, yb, 0], color: "#dff6ff", kind: "glass", bevel: bev });
    // bright edges on the front triangle
    const tri = [[-s / 2, yb], [s / 2, yb], [0, yb + h]];
    for (let i = 0; i < 3; i++) {
      const a = tri[i], c = tri[(i + 1) % 3];
      b.rod([a[0], a[1], 0.086], [c[0], c[1], 0.086], 0.0025, { color: "#f2fbff", kind: "glow", light: false, seg: 4 });
    }
    // beam path: in through the left face, out through the right face
    const E = [-(s / 2) * 0.55, yb + h * 0.45], X = [(s / 2) * 0.6, yb + h * 0.4];
    const beam = (a, c, w, col, o = {}) => {
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      b.box(len, w, o.d ?? 0.02, { at: [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, 0], rot: [0, 0, Math.atan2(c[1] - a[1], c[0] - a[0])],
        color: col, kind: "glow", light: !!o.light, r: 0 });
    };
    beam([-0.198, E[1] - 0.045], E, 0.02, "#fffdf0", { light: true, d: 0.024 });
    beam(E, X, 0.009, "#fdfcf2", { d: 0.016 });
    const cols = ["#ff4b3e", "#ff9b30", "#ffe04a", "#4fd36b", "#3f8cff", "#9b5cff"];
    const a0 = -0.06, a1 = -0.62, xe = 0.198;
    cols.forEach((c, i) => {
      const t0 = a0 + ((a1 - a0) * i) / cols.length, t1 = a0 + ((a1 - a0) * (i + 1)) / cols.length;
      const d0 = (xe - X[0]) / Math.cos(t0), d1 = (xe - X[0]) / Math.cos(t1);
      const q0 = 0.0025 * (cols.length / 2 - i), q1 = 0.0025 * (cols.length / 2 - i - 1);
      b.extrude([[X[0], X[1] + q0], [X[0] + d0 * Math.cos(t0), X[1] + d0 * Math.sin(t0)], [X[0] + d1 * Math.cos(t1),
        X[1] + d1 * Math.sin(t1)], [X[0], X[1] + q1]], 0.018, { color: c, kind: "glow", light: false, bevel: 0 });
    });
  },

  // A pendulum in a wooden frame: brass bob on a rod, caught mid-swing, with a glassy ghost at the far end.
  pendulum(b, p) {
    const wood = p.color || C.wood;
    const dark = shade(wood, -0.12);
    b.box(0.4, 0.04, 0.2, { at: [0, 0.02, 0], color: dark, r: 0.012 });
    b.mirrorX(() => {
      b.box(0.036, 0.78, 0.036, { at: [0.168, 0.43, 0], color: wood, r: 0.008 });
      b.extrude([[0, 0], [0.05, 0], [0, 0.06]], 0.024, { at: [0.15, 0.04, 0], rot: [0, PI, 0], color: wood, bevel: 0.004 });
    });
    b.box(0.4, 0.042, 0.06, { at: [0, 0.835, 0], color: wood, r: 0.01 });
    const P = [0, 0.8, 0.0];
    b.box(0.04, 0.03, 0.05, { at: [0, 0.8, 0], ...metal(C.brass), r: 0.006 });
    b.cyl(0.007, 0.007, 0.07, { at: P, rot: ZA, ...metal(C.silver), seg: 8 });
    const L = 0.5, th = 0.2, rb = 0.046;
    const bob = (a, o) => {
      const c = [Math.sin(a) * L, P[1] - Math.cos(a) * L, 0];
      b.rod(P, add3(c, [-Math.sin(a), Math.cos(a), 0], rb * 0.6), 0.004, { ...o, seg: 6 });
      b.sphere(rb, { at: c, ...o, seg: 20 });
    };
    bob(-th, { color: "#e9edf1", kind: "glass" });
    bob(th, metal(C.brass));
    // swing arc marks on the base
    for (let i = -4; i <= 4; i++) {
      const a = i * 0.05;
      b.box(0.004, 0.003, i % 2 ? 0.02 : 0.034, { at: [Math.sin(a) * 0.5, 0.0415, 0.05], color: "#f4ead2", r: 0 });
    }
  },

  // A steel compression spring with flat closed ends.
  spring(b, p) {
    const o = p.color ? { color: p.color, kind: "gloss" } : metal("#b9c1ca");
    const wr = 0.0115, Rc = 0.066, H = 0.4, turns = 7.5, per = 24;
    const n = Math.round(turns * per);
    const pe = 2 * wr * 1.02, pm = (H - 2 * wr - 2 * pe) / (turns - 2);
    const pitch = (u) => {
      const e = Math.min(u, turns - u);
      return e < 0.75 ? pe : e < 1.25 ? pe + (pm - pe) * ((e - 0.75) / 0.5) : pm;
    };
    const pts = [];
    let y = wr;
    for (let i = 0; i <= n; i++) {
      const u = (i / n) * turns, a = u * TAU;
      pts.push([Math.sin(a) * Rc, y, Math.cos(a) * Rc]);
      y += pitch(u + turns / n / 2) / per;
    }
    const k = (H - 2 * wr) / (pts[n][1] - wr);
    for (const q of pts) q[1] = wr + (q[1] - wr) * k;
    b.tube(pts, wr, { ...o, seg: n, radial: 8 });
    b.sphere(wr, { at: pts[0], ...o, seg: 8 });
    b.sphere(wr, { at: pts[n], ...o, seg: 8 });
  },

  // A blacksmith's anvil on a log stump: horn, steel face with a hardy hole, narrow waist, flared feet,
  // and a glowing hot bar on the face.
  anvil(b) {
    const iron = { color: "#4f555d", kind: "gloss" };
    // stump
    b.lathe([[0, 0], [0.125, 0], [0.128, 0.03], [0.122, 0.106], [0, 0.106]], { color: "#6e5236", seg: 24 });
    b.cyl(0.116, 0.116, 0.006, { at: [0, 0.106, 0], color: "#d1aa78", seg: 24 });
    for (const r of [0.04, 0.075]) b.torus(r, 0.0022, { at: [0, 0.109, 0], rot: [PI / 2, 0, 0], color: "#b08a5c", seg: 24, tubeSeg: 4 });
    const y0 = 0.11, bev = 0.008;
    b.group({ at: [0, y0, 0] }, () => {
      b.box(0.31, 0.04, 0.2, { at: [0, 0.02, 0], ...iron, r: 0.012 });
      const prof = roundPoly([[-0.13, 0.03], [0.13, 0.03], [0.085, 0.075], [0.07, 0.13], [0.105, 0.172], [0.192, 0.2],
        [0.192, 0.272], [-0.122, 0.272], [-0.122, 0.21], [-0.08, 0.17], [-0.07, 0.13], [-0.085, 0.075]],
      [0.01, 0.01, 0.04, 0.04, 0.03, 0.01, 0.01, 0.005, 0.02, 0.03, 0.04, 0.04], 4);
      b.extrude(prof, 0.12 - 2 * bev, { ...iron, bevel: bev });
      // horn
      b.lathe([[0.037, 0], [0.034, 0.03], [0.026, 0.07], [0.014, 0.11], [0.004, 0.14], [0, 0.145]],
        { at: [-0.118, 0.244, 0], rot: [0, 0, PI / 2], scale: [1, 1, 1.15], ...iron, seg: 16 });
      // face plate, hardy and pritchel holes
      b.box(0.32, 0.012, 0.128, { at: [0.035, 0.284, 0], ...metal("#c3cad2"), r: 0.004 });
      b.box(0.022, 0.003, 0.022, { at: [0.158, 0.2895, 0], color: "#1d1f23", r: 0 });
      b.cyl(0.006, 0.006, 0.003, { at: [0.118, 0.2895, 0], color: "#1d1f23", seg: 10 });
      // hot bar
      b.box(0.1, 0.018, 0.022, { at: [-0.02, 0.299, 0.01], rot: [0, 0.25, 0], color: "#ff7a2a", kind: "glow", r: 0.006 });
      b.box(0.06, 0.012, 0.016, { at: [-0.02, 0.302, 0.016], rot: [0, 0.25, 0], color: "#ffd36a", kind: "glow", light: false, r: 0.004 });
    });
  },

  // A wooden workbench: thick top with a vice, a lower shelf with a red toolbox, and a pegboard of tools.
  workbench(b, p) {
    const wood = p.color || C.lightWood;
    const dark = shade(wood, -0.16), leg = shade(wood, -0.07);
    const ty = 0.55, T = 0.06;
    b.box(1.1, T, 0.5, { at: [0, ty - T / 2, 0.02], color: wood, r: 0.012 });
    for (const z of [-0.14, -0.04, 0.06, 0.16]) b.box(1.08, 0.002, 0.003, { at: [0, ty + 0.0005, z], color: shade(wood, -0.1), r: 0 });
    for (const x of [-0.49, 0.49]) for (const z of [-0.18, 0.2]) b.box(0.065, ty - T, 0.065, { at: [x, (ty - T) / 2, z], color: leg, r: 0.01, seg: 1 });
    for (const z of [-0.18, 0.2]) b.box(0.92, 0.05, 0.03, { at: [0, 0.12, z], color: leg, r: 0.008, seg: 1 });
    b.box(0.96, 0.025, 0.4, { at: [0, 0.155, 0.01], color: dark, r: 0.006 });
    // toolbox on the shelf
    const red = { color: "#d23f35", kind: "gloss" };
    b.box(0.3, 0.11, 0.16, { at: [-0.2, 0.168 + 0.055, 0.03], ...red, r: 0.012 });
    b.box(0.302, 0.012, 0.162, { at: [-0.2, 0.168 + 0.085, 0.03], color: "#a8302a", kind: "gloss", r: 0.004 });
    b.torus(0.04, 0.006, { at: [-0.2, 0.168 + 0.11, 0.03], arc: PI, ...metal(C.silver), seg: 14, tubeSeg: 6 });
    b.box(0.03, 0.02, 0.006, { at: [-0.2, 0.168 + 0.07, 0.112], ...metal(C.silver), r: 0.003 });
    b.box(0.12, 0.08, 0.1, { at: [0.25, 0.208, 0.02], color: "#b88c58", r: 0.006 });
    // vice on the front right corner
    const vice = metal("#5b7896");
    b.box(0.12, 0.05, 0.1, { at: [0.38, ty + 0.025, 0.17], ...vice, r: 0.01 });
    b.box(0.13, 0.05, 0.03, { at: [0.38, ty + 0.06, 0.15], ...vice, r: 0.008 });
    b.box(0.13, 0.05, 0.03, { at: [0.38, ty + 0.06, 0.225], ...vice, r: 0.008 });
    b.cyl(0.008, 0.008, 0.08, { at: [0.38, ty + 0.045, 0.27], rot: ZA, ...metal(C.silver), seg: 8 });
    b.cyl(0.006, 0.006, 0.12, { at: [0.38, ty + 0.045, 0.31], rot: [0, 0, PI / 2], ...metal(C.silver), seg: 8 });
    for (const sx of [-1, 1]) b.sphere(0.011, { at: [0.38 + sx * 0.06, ty + 0.045, 0.31], ...metal(C.silver), seg: 8 });
    // a plank offcut and a pencil on the top
    b.box(0.28, 0.03, 0.09, { at: [-0.2, ty + 0.015, 0.06], rot: [0, 0.2, 0], color: "#e3c79a", r: 0.004 });
    b.rod([0.05, ty + 0.007, 0.12], [0.2, ty + 0.007, 0.08], 0.007, { color: C.yellow, seg: 6 });
    // pegboard with hanging tools
    const pz = -0.215, py0 = ty + 0.02, py1 = 0.85;
    for (const x of [-0.52, 0.52]) b.box(0.04, py1 - ty + 0.01, 0.04, { at: [x, (py1 + ty) / 2, pz - 0.01], color: leg, r: 0.008, seg: 1 });
    b.box(1.0, py1 - py0, 0.018, { at: [0, (py0 + py1) / 2, pz], color: "#c7a171", r: 0.006 });
    for (let i = 0; i < 11; i++) for (let j = 0; j < 3; j++) {
      b.cyl(0.0045, 0.0045, 0.002, { at: [-0.43 + i * 0.086, py0 + 0.05 + j * 0.1, pz + 0.009], rot: ZA, color: "#7d6040", seg: 5, open: true });
    }
    const hang = (fn, x, y, s, rot = PI) => b.group({ at: [x, y, pz + 0.02], rot: [0, 0, rot], scale: s }, () => fn(b, {}));
    hang(TOOLS.hammer, -0.37, py1 - 0.03, 0.55);
    hang(TOOLS.wrench, -0.2, py1 - 0.035, 0.55);
    hang(TOOLS.scissors, 0.33, py1 - 0.04, 0.6);
    // saw
    b.group({ at: [0.02, py1 - 0.11, pz + 0.014] }, () => {
      const teeth = [];
      for (let i = 0; i <= 16; i++) teeth.push([-0.15 + i * 0.0155, i % 2 ? -0.041 : -0.031]);
      b.extrude([[0.1, 0.03], [-0.15, 0.014], ...teeth, [0.1, -0.034]], 0.002, { ...metal("#c9d0d8"), bevel: 0.0008 });
      b.extrude(shape(roundPoly([[0.09, 0.045], [0.17, 0.055], [0.185, -0.045], [0.09, -0.045]], 0.018),
        [ellipse(0.022, 0.016, 14, 0.137, 0.004).reverse()]), 0.012, { color: "#a8452e", kind: "gloss", bevel: 0.003 });
    });
    // screwdrivers
    [[0.16, "#2f7ad0"], [0.21, C.yellow]].forEach(([x, c]) => {
      b.rod([x, py1 - 0.04, pz + 0.025], [x, py1 - 0.12, pz + 0.025], 0.014, { r2: 0.012, color: c, kind: "gloss", seg: 10 });
      b.rod([x, py1 - 0.12, pz + 0.025], [x, py1 - 0.2, pz + 0.025], 0.004, { ...metal(C.silver), seg: 6 });
    });
  },

  // A judge's gavel standing on its striking face on a round sound block, handle held out to the right.
  gavel(b, p) {
    const wood = p.color || "#7b3f24";
    const gold = metal(C.gold);
    const bx = -0.055;
    b.lathe([[0, 0], [0.05, 0], [0.052, 0.006], [0.05, 0.022], [0.044, 0.028], [0, 0.028]], { at: [bx, 0, 0], color: shade(wood, -0.06), kind: "gloss", seg: 28 });
    b.torus(0.051, 0.0025, { at: [bx, 0.014, 0], rot: [PI / 2, 0, 0], ...gold, seg: 28, tubeSeg: 4 });
    const hy = 0.028;
    b.lathe([[0, 0], [0.022, 0], [0.025, 0.004], [0.025, 0.012], [0.029, 0.016], [0.031, 0.046], [0.029, 0.076], [0.025, 0.08],
      [0.025, 0.088], [0.022, 0.092], [0, 0.092]], { at: [bx, hy, 0], color: wood, kind: "gloss", seg: 22 });
    for (const y of [0.014, 0.078]) b.torus(0.0285, 0.0032, { at: [bx, hy + y, 0], rot: [PI / 2, 0, 0], ...gold, seg: 22, tubeSeg: 5 });
    b.lathe([[0.009, 0], [0.0085, 0.03], [0.0075, 0.09], [0.0095, 0.115], [0.0115, 0.13], [0.012, 0.14], [0.009, 0.146], [0, 0.148]],
      { at: [bx + 0.026, hy + 0.046, 0], rot: XA, color: wood, kind: "gloss", seg: 14 });
    b.torus(0.009, 0.002, { at: [bx + 0.03, hy + 0.046, 0], rot: [0, PI / 2, 0], ...gold, seg: 12, tubeSeg: 4 });
  },

  // A rubber stamp: turned wooden handle with an ink-coloured cap, a block mount, and the inked rubber.
  stamp(b, p) {
    const ink = p.color || "#d0353a";
    b.box(0.098, 0.014, 0.098, { at: [0, 0.007, 0], color: ink, kind: "gloss", r: 0.004 });
    b.box(0.108, 0.036, 0.108, { at: [0, 0.014 + 0.018, 0], color: "#d6b07c", r: 0.008 });
    b.box(0.07, 0.003, 0.07, { at: [0, 0.0515, 0], color: shade(ink, 0.1), r: 0.001, seg: 1 });
    b.lathe([[0.032, 0.05], [0.032, 0.054], [0.021, 0.063], [0.016, 0.083], [0.018, 0.1], [0.03, 0.124], [0.037, 0.143], [0.035, 0.158],
      [0.026, 0.168], [0, 0.171]], { color: "#7a4a2c", kind: "gloss", seg: 24 });
    b.sphere(0.022, { at: [0, 0.168, 0], scale: [1, 0.45, 1], color: ink, kind: "gloss", seg: 16 });
    b.torus(0.0165, 0.003, { at: [0, 0.085, 0], rot: [PI / 2, 0, 0], ...metal(C.brass), seg: 16, tubeSeg: 4 });
  },

  // A red horseshoe magnet standing on its silver pole tips.
  magnet(b) {
    const bev = 0.01, cy = 0.17, Ro = 0.15 - bev, Ri = 0.06 + bev, yb = 0.062 + bev;
    const pts = [];
    for (let i = 0; i <= 24; i++) pts.push(polar(Ro, (i / 24) * PI, 0, cy));
    pts.push([-Ro, yb], [-Ri, yb]);
    for (let i = 24; i >= 0; i--) pts.push(polar(Ri, (i / 24) * PI, 0, cy));
    pts.push([Ri, yb], [Ro, yb]);
    b.extrude(pts, 0.085 - 2 * bev, { color: "#d8382e", kind: "gloss", bevel: bev });
    for (const sx of [-1, 1]) {
      b.box(0.09, 0.058, 0.09, { at: [sx * 0.105, 0.029, 0], ...metal("#d9dee4"), r: 0.01 });
    }
    b.box(0.006, 0.08, 0.004, { at: [-0.13, 0.13, 0.044], color: "#ff9a8f", kind: "glow", light: false, r: 0 });
  },

  // A burning hand torch: wooden handle, cloth-wrapped head bound with cord, layered flame and sparks.
  torch(b) {
    b.lathe([[0.011, 0], [0.0145, 0.005], [0.016, 0.06], [0.0185, 0.2], [0.02, 0.27], [0, 0.27]], { color: "#8a5a36", seg: 12 });
    b.lathe([[0.019, 0.24], [0.029, 0.25], [0.033, 0.275], [0.032, 0.31], [0.026, 0.322], [0, 0.325]], { color: "#4a3527", seg: 14 });
    for (const y of [0.255, 0.28, 0.305]) b.torus(0.0315, 0.0035, { at: [0, y, 0], rot: [PI / 2, 0.15, 0], color: "#c9a06a", seg: 16, tubeSeg: 4 });
    b.group({ at: [0, 0.3, -0.012] }, () => flame(b, 0.15, 0.036, { lean: 0.05, colors: ["#ff6a24", "#ffb63a", "#fff3b0"] }));
    for (const [x, y, r] of [[0.02, 0.43, 0.004], [-0.018, 0.405, 0.003], [0.028, 0.39, 0.0028]]) {
      b.sphere(r, { at: [x, y, 0.01], color: "#ffd36a", kind: "glow", light: false, seg: 6 });
    }
  },
};

export default TOOLS;
