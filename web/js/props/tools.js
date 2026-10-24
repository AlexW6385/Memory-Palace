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
  b.lathe(prof(h * 0.7, r * 0.66), { at: [0, h * 0.02, r * 0.38], rot: [0, 0, -lean * 0.7], color: cols[1],
    kind: "glow", seg: 10, light: false });
  b.lathe(prof(h * 0.42, r * 0.38), { at: [0, h * 0.03, r * 0.66], rot: [0, 0, -lean * 0.4], color: cols[2],
    kind: "glow", seg: 8, light: false });
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
    const th = p.variant === "left_down" ? -tilt : p.variant === "right_down" ? tilt : 0;
    // fulcrum
    const blue = "#3f74c4";
    const bev = 0.012;
    b.extrude(roundPoly([[-0.15, bev], [0.15, bev], [0, hp - 0.02]], 0.03), 0.16 - 2 * bev,
      { color: blue, bevel: bev });
    b.box(0.34, 0.025, 0.24, { at: [0, 0.0125, 0], color: shade(blue, -0.12), r: 0.008 });
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
    const iron = metal("#5d636b");
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
    b.box(0.054, 0.06, 0.062, { at: [0.002, 0.03, 0], r: 0.01, ...steel });
    b.lathe([[0, 0], [0.025, 0], [0.021, 0.026], [0.024, 0.032], [0.0285, 0.036], [0.0285, 0.05], [0.025, 0.054],
      [0, 0.054]], { at: [0.028, 0.03, 0], rot: XA, ...steel, seg: 20 });
    const claw = roundPoly([[-0.02, 0.006], [-0.052, 0.01], [-0.08, 0.03], [-0.094, 0.064], [-0.094, 0.093],
      [-0.083, 0.072], [-0.066, 0.056], [-0.042, 0.052], [-0.02, 0.054]], [0.002, 0.02, 0.02, 0.02, 0.004, 0.012,
      0.012, 0.01, 0.002], 3);
    for (const z of [-0.0165, 0.0165]) b.extrude(claw, 0.019, { at: [0, 0, z], ...steel, bevel: 0.004 });
    // handle
    b.lathe([[0.017, 0.055], [0.0155, 0.1], [0.0165, 0.2], [0.018, 0.26], [0, 0.262]],
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
      b.extrude(loop, 0.016, { at: [0, 0, z * 0.6], color: col, kind: "gloss", bevel: 0.004 });
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
};

export default TOOLS;
