// Props in the "furniture" group. Each entry: name: (b, p) => void — see kit.js and docs/props.md.
// b is a Builder (metres, base on y = 0, facing +z); p holds the item's params:
//   { variant, color, color2, text, emoji, pose, hat, hold, seed }
import * as THREE from "three";
import { C, shade, mix } from "./kit.js";

const PI = Math.PI;
const SEAT = 0.45; // seat height of chairs, benches and the throne (a sitting figure fits all of them)
const TABLE_TOP = 0.55; // top surface of every table variant
// glow colours are tone-mapped, so they must be saturated to read as light rather than as pale paper
const WARM = "#ffbe48"; // lit lampshade, lantern glass, light beyond a door
const BULB = "#ffe27a"; // a glowing bulb
const IRON = "#2f3a36"; // dark cast iron
const BRASS = { color: C.brass, kind: "metal" };

// ── shared helpers ───────────────────────────────────────────────────────────
/** A candle flame standing on `at`: an outer teardrop and a pale core peeking out at the front. */
function flame(b, at, s = 1, light = true) {
  const [x, y, z] = at;
  const outer = [[0, 0], [0.009, 0.006], [0.015, 0.018], [0.016, 0.028], [0.012, 0.042], [0.006, 0.056], [0, 0.07]];
  b.lathe(outer.map(([r, h]) => [r * s, h * s]), { at: [x, y, z], color: C.flame, kind: "glow", seg: 10, light });
  const core = [[0, 0], [0.006, 0.006], [0.009, 0.015], [0.007, 0.027], [0, 0.038]];
  b.lathe(core.map(([r, h]) => [r * s, h * s]), { at: [x, y + 0.003 * s, z + 0.008 * s], color: C.flameCore,
    kind: "glow", seg: 8, light: false });
}

/** A lathe shell with an inside: prof runs bottom→top along the outside; the inside is t thinner. */
function shell(b, at, prof, t, color, inner, o = {}) {
  b.lathe(prof, { at, color, seg: o.seg ?? 20, kind: o.kind });
  const inside = prof.slice().reverse().map(([r, y]) => [Math.max(0, r - t), y]);
  // a glowing lining only adds a light halo when the outside does not already
  b.lathe(inside, { at, color: inner ?? color, seg: o.seg ?? 20, kind: o.innerKind ?? o.kind, light: o.kind !== "glow" });
}

/**
 * A prism or frustum with a fixed number of sides (square lantern glass, hexagonal roof). Its facets are the
 * design, so it bypasses the builder's level of detail (b.cyl would turn 4 or 6 sides into 5 at a low lod).
 */
function prism(b, rTop, rBot, h, sides, o = {}) {
  b.geo(new THREE.CylinderGeometry(rTop, rBot, h, sides, 1), { flat: true, ...o });
}

/** n points on an ellipse with semi-axes a (x) and c (y), for closed tubes. */
function ellipse(a, c, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * PI * 2;
    pts.push([a * Math.cos(t), c * Math.sin(t), 0]);
  }
  return pts;
}

/** A turned table/chair leg standing at (x, z), height h, with a square block at the top. */
function turnedLeg(b, x, z, h, color, r = 0.026) {
  const blk = Math.min(0.11, h * 0.25);
  b.box(r * 2.2, blk, r * 2.2, { at: [x, h - blk / 2, z], color, r: 0.006, seg: 1 });
  const H = h - blk;
  b.lathe([[0, 0], [r * 0.8, 0], [r * 1.05, 0.016], [r * 0.95, 0.036], [r * 0.68, 0.075], [r * 0.6, H * 0.55],
    [r * 0.82, H * 0.7], [r * 1.02, H * 0.77], [r * 0.78, H * 0.84], [r * 0.85, H], [0, H]],
  { at: [x, 0, z], color, seg: 12 });
}

/** A brass knob with a round rose, on a surface facing +z at `at`. */
function knob(b, at, r = 0.02) {
  b.cyl(r * 1.25, r * 1.25, r * 0.4, { at: [at[0], at[1], at[2] + r * 0.2], rot: [PI / 2, 0, 0], ...BRASS, seg: 14 });
  b.sphere(r, { at: [at[0], at[1], at[2] + r * 1.3], ...BRASS, seg: 12 });
}

// ── tables ───────────────────────────────────────────────────────────────────
function rectTable(b, wood) {
  const W = 0.9, D = 0.6, T = 0.045;
  const dark = shade(wood, -0.07);
  // a top of four planks
  const pd = (D - 0.009) / 4;
  for (let i = 0; i < 4; i++) {
    b.box(W, T, pd, { at: [0, TABLE_TOP - T / 2, -D / 2 + pd / 2 + i * (pd + 0.003)], color: shade(wood, [0, 0.025,
      -0.015, 0.01][i]), r: 0.01 });
  }
  b.box(W - 0.02, 0.01, D - 0.02, { at: [0, TABLE_TOP - T + 0.006, 0], color: dark, r: 0 });
  const lx = W / 2 - 0.075, lz = D / 2 - 0.075, ay = TABLE_TOP - T - 0.045;
  for (const z of [-1, 1]) b.box(2 * lx, 0.09, 0.024, { at: [0, ay, z * (lz + 0.012)], color: dark, r: 0.006, seg: 1 });
  for (const x of [-1, 1]) b.box(0.024, 0.09, 2 * lz, { at: [x * (lx + 0.012), ay, 0], color: dark, r: 0.006, seg: 1 });
  for (const x of [-1, 1]) for (const z of [-1, 1]) turnedLeg(b, x * lx, z * lz, TABLE_TOP - T, wood, 0.032);
}

const FOOT = [[0, 0.21], [0.05, 0.2], [0.11, 0.16], [0.17, 0.105], [0.23, 0.07], [0.28, 0.055], [0.305, 0.04],
  [0.312, 0.018], [0.3, 0], [0.265, 0], [0.24, 0.016], [0.19, 0.032], [0.12, 0.062], [0.06, 0.095], [0, 0.105]];

function roundTable(b, wood) {
  const R = 0.4, SZ = 0.88, T = 0.045, top = TABLE_TOP;
  const dark = shade(wood, -0.07);
  b.lathe([[0, top - T], [R - 0.02, top - T], [R - 0.004, top - T + 0.007], [R, top - T * 0.5], [R - 0.004, top - 0.009],
    [R - 0.018, top], [0, top]], { color: wood, seg: 36, scale: [1, 1, SZ] });
  b.cyl(R - 0.07, R - 0.07, 0.05, { at: [0, top - T - 0.025, 0], color: dark, seg: 28, scale: [1, 1, SZ] });
  b.lathe([[0.075, 0.08], [0.072, 0.11], [0.052, 0.15], [0.043, 0.21], [0.056, 0.28], [0.062, 0.3], [0.046, 0.345],
    [0.037, 0.4], [0.046, 0.44], [0.08, 0.45], [0.08, top - T - 0.04], [0, top - T - 0.04]], { color: wood, seg: 16 });
  for (let k = 0; k < 4; k++) {
    b.extrude(FOOT, 0.05, { at: [0, 0.008, 0], rot: [0, PI / 4 + k * PI / 2, 0], color: wood, bevel: 0.008 });
  }
}

function deskTable(b, wood) {
  const T = 0.045, top = TABLE_TOP;
  const dark = shade(wood, -0.08), light = shade(wood, 0.05);
  b.box(0.92, T, 0.6, { at: [0, top - T / 2, 0], color: wood, r: 0.014 });
  b.box(0.62, 0.003, 0.36, { at: [0, top + 0.0005, 0.03], color: "#3f6a4c", r: 0 }); // leather writing inlay
  const ph = top - T - 0.035; // pedestal body height (above the plinth)
  b.mirrorX(() => {
    const px = 0.3, pw = 0.28, pd = 0.54;
    b.box(pw - 0.03, 0.04, pd - 0.03, { at: [px, 0.02, -0.01], color: dark, r: 0.006, seg: 1 });
    b.box(pw, ph, pd, { at: [px, 0.035 + ph / 2, 0], color: wood, r: 0.012 });
    const n = 3, gap = 0.018, dh = (ph - gap * (n + 1)) / n;
    for (let i = 0; i < n; i++) {
      const y = 0.035 + gap + dh / 2 + i * (dh + gap);
      b.box(pw - 0.045, dh, 0.02, { at: [px, y, pd / 2 + 0.004], color: light, r: 0.008, seg: 1 });
      knob(b, [px, y, pd / 2 + 0.014], 0.014);
    }
  });
  // centre drawer under the top, and a modesty panel at the back of the kneehole
  b.box(0.32, 0.075, 0.5, { at: [0, top - T - 0.0375, 0], color: wood, r: 0.006, seg: 1 });
  b.box(0.27, 0.055, 0.02, { at: [0, top - T - 0.0375, 0.254], color: light, r: 0.008, seg: 1 });
  knob(b, [0, top - T - 0.0375, 0.264], 0.013);
  b.box(0.32, 0.34, 0.02, { at: [0, 0.26, -0.22], color: dark, r: 0.004, seg: 1 });
}

// ── chairs ───────────────────────────────────────────────────────────────────
function plainChair(b, wood) {
  const dark = shade(wood, -0.08);
  const st = 0.045, fx = 0.165, fz = 0.165, bz = -0.155;
  b.box(0.4, st, 0.4, { at: [0, SEAT - st / 2, 0.005], color: wood, r: 0.015 });
  const rake = 0.106; // backward lean of the back posts (dz per dy)
  const postZ = (y) => bz - 0.005 - rake * (y - (SEAT - st));
  b.mirrorX(() => {
    b.cyl(0.019, 0.015, SEAT - st, { at: [fx, (SEAT - st) / 2, fz], color: wood, seg: 10 });
    b.rod([fx, 0, bz], [fx, SEAT - st, postZ(SEAT - st)], 0.017, { color: wood, seg: 10 });
    b.rod([fx, SEAT - st, postZ(SEAT - st)], [fx, 0.725, postZ(0.725)], 0.017, { color: wood, seg: 10 });
    b.sphere(0.021, { at: [fx, 0.73, postZ(0.73)], color: wood, seg: 10 });
    b.rod([fx, 0.13, fz], [fx, 0.13, bz], 0.009, { color: dark, seg: 8 });
  });
  b.rod([-fx, 0.17, fz], [fx, 0.17, fz], 0.009, { color: dark, seg: 8 });
  b.box(0.35, 0.085, 0.026, { at: [0, 0.665, postZ(0.665)], rot: [-rake, 0, 0], color: wood, r: 0.011 });
  for (const x of [-0.075, 0, 0.075]) {
    b.box(0.038, 0.18, 0.016, { at: [x, 0.535, postZ(0.535)], rot: [-rake, 0, 0], color: dark, r: 0.006, seg: 1 });
  }
}

function stool(b, wood) {
  const dark = shade(wood, -0.08);
  const R = 0.17;
  b.lathe([[0, SEAT - 0.042], [R - 0.012, SEAT - 0.042], [R, SEAT - 0.032], [R + 0.002, SEAT - 0.018],
    [R - 0.006, SEAT - 0.005], [R - 0.022, SEAT], [0, SEAT]], { color: wood, seg: 28 });
  const legR = (y) => 0.105 + (0.185 - 0.105) * (1 - y / (SEAT - 0.04));
  for (let k = 0; k < 4; k++) {
    const a = PI / 4 + k * PI / 2, s = Math.sin(a), c = Math.cos(a);
    b.rod([0.105 * s, SEAT - 0.04, 0.105 * c], [0.185 * s, 0, 0.185 * c], 0.019, { r2: 0.014, color: wood, seg: 10 });
  }
  b.torus(legR(0.16), 0.011, { at: [0, 0.16, 0], rot: [PI / 2, 0, 0], color: dark, seg: 32, tubeSeg: 8 });
  // a low bentwood back hoop
  const arc = PI * 0.62, hr = 0.145, hy = 0.59;
  b.torus(hr, 0.016, { at: [0, hy, 0], rot: [PI / 2, 0, -PI / 2 - arc / 2], arc, color: wood, seg: 20, tubeSeg: 8 });
  for (const t of [-0.5, 0, 0.5]) {
    const a = -PI / 2 + t * arc * 0.8;
    b.rod([hr * Math.cos(a), SEAT - 0.01, hr * Math.sin(a)], [hr * Math.cos(a), hy, hr * Math.sin(a)], 0.011,
      { color: dark, seg: 8 });
  }
}

function armchair(b, fab) {
  const legC = C.darkWood, light = shade(fab, 0.05), dark = shade(fab, -0.08);
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    b.cyl(0.022, 0.015, 0.075, { at: [x * 0.18, 0.0375, z * 0.17], color: legC, seg: 10 });
  }
  b.box(0.42, 0.29, 0.44, { at: [0, 0.075 + 0.145, 0], color: fab, r: 0.04 });
  b.box(0.3, 0.09, 0.37, { at: [0, SEAT - 0.045, 0.035], color: light, r: 0.035 });
  b.mirrorX(() => {
    b.box(0.075, 0.47, 0.43, { at: [0.183, 0.075 + 0.235, 0.0], color: fab, r: 0.03 });
    b.cyl(0.046, 0.046, 0.44, { at: [0.187, 0.55, 0.005], rot: [PI / 2, 0, 0], color: light, seg: 18 });
    b.cyl(0.03, 0.03, 0.004, { at: [0.187, 0.55, 0.227], rot: [PI / 2, 0, 0], color: dark, seg: 16 });
  });
  b.group({ at: [0, 0.585, -0.165], rot: [-0.12, 0, 0] }, () => {
    b.box(0.44, 0.43, 0.11, { color: fab, r: 0.05 });
    b.box(0.3, 0.33, 0.04, { at: [0, -0.01, 0.06], color: light, r: 0.02 });
    for (const [x, y] of [[-0.075, 0.08], [0.075, 0.08], [0, 0.0], [-0.075, -0.08], [0.075, -0.08]]) {
      b.sphere(0.011, { at: [x, y, 0.08], color: dark, seg: 8 });
    }
  });
}

// ── benches ──────────────────────────────────────────────────────────────────
// The catalogue gives benches 0.45 m (the seat height); the low backrests rise to 0.6 m, which the size test
// reports as a height warning. A sitting figure needs the 0.45 m seat, so the back is kept low instead.
function parkBench(b, wood) {
  const t = { color: IRON, radial: 7 }, ir = 0.016;
  b.mirrorX(() => {
    const x = 0.4;
    // front leg rising into the armrest, back leg rising into the raked back support
    b.tube([[x, 0.0, 0.185], [x, 0.12, 0.17], [x, 0.3, 0.16], [x, 0.46, 0.165], [x, 0.53, 0.155]], ir, { ...t, seg: 18 });
    b.tube([[x, 0.0, -0.17], [x, 0.2, -0.145], [x, 0.43, -0.135], [x, 0.51, -0.16], [x, 0.58, -0.19]], ir,
      { ...t, seg: 20 });
    // armrest ending in a scroll at the front
    b.tube([[x, 0.51, -0.155], [x, 0.535, -0.06], [x, 0.545, 0.06], [x, 0.55, 0.15], [x, 0.535, 0.197],
      [x, 0.5, 0.2], [x, 0.488, 0.178], [x, 0.502, 0.16]], ir, { ...t, seg: 34 });
    b.rod([x, 0.425, 0.17], [x, 0.425, -0.14], 0.014, { color: IRON, seg: 7 });
    // a cast curl between the legs and flat feet
    b.torus(0.05, 0.009, { at: [x, 0.27, 0.01], rot: [0, PI / 2, 0.6], arc: PI * 1.5, color: IRON, seg: 16, tubeSeg: 5 });
    b.torus(0.028, 0.008, { at: [x, 0.33, -0.06], rot: [0, PI / 2, 2.6], arc: PI * 1.4, color: IRON, seg: 12,
      tubeSeg: 5 });
    for (const z of [0.185, -0.17]) b.sphere(0.025, { at: [x, 0.008, z], color: IRON, seg: 8, scale: [0.9, 0.5, 1.2] });
  });
  for (const z of [0.135, 0.055, -0.025, -0.105]) {
    b.box(0.98, 0.026, 0.07, { at: [0, SEAT - 0.013, z], color: wood, r: 0.009 });
  }
  for (const [y, z] of [[0.485, -0.137], [0.552, -0.162]]) {
    b.box(0.98, 0.055, 0.024, { at: [0, y, z], rot: [-0.35, 0, 0], color: wood, r: 0.009 });
  }
}

function pew(b, wood) {
  const dark = shade(wood, -0.06), light = shade(wood, 0.07);
  // bench ends: profile in (u = -z, y), extruded across x; rounded arm at the front, shoulder at the back
  // (the extrude bevel adds 12 mm all round, so the outline runs from y = 0.012 to 0.575)
  const END = [[-0.165, 0.012], [0.175, 0.012], [0.175, 0.545], [0.165, 0.565], [0.145, 0.575], [0.105, 0.572],
    [0.06, 0.556], [0.0, 0.538], [-0.07, 0.524], [-0.12, 0.521], [-0.15, 0.514], [-0.168, 0.495], [-0.172, 0.472],
    [-0.165, 0.452], [-0.155, 0.442]];
  b.mirrorX(() => {
    b.extrude(END, 0.05, { at: [0.465, 0, 0], rot: [0, PI / 2, 0], color: wood, bevel: 0.012 });
    // a carved cross on the outer face
    b.box(0.008, 0.16, 0.035, { at: [0.505, 0.3, 0.0], color: light, r: 0.003, seg: 1 });
    b.box(0.008, 0.035, 0.11, { at: [0.505, 0.33, 0.0], color: light, r: 0.003, seg: 1 });
  });
  b.box(0.9, 0.04, 0.33, { at: [0, SEAT - 0.02, 0.005], color: light, r: 0.012 });
  b.box(0.9, 0.05, 0.022, { at: [0, SEAT - 0.06, 0.155], color: dark, r: 0.006, seg: 1 });
  // panelled back
  b.box(0.9, 0.15, 0.03, { at: [0, SEAT + 0.065, -0.155], rot: [-0.12, 0, 0], color: wood, r: 0.01 });
  for (const x of [-0.3, 0, 0.3]) {
    b.box(0.24, 0.08, 0.01, { at: [x, SEAT + 0.062, -0.136], rot: [-0.12, 0, 0], color: light, r: 0.004, seg: 1 });
  }
  b.box(0.92, 0.025, 0.06, { at: [0, 0.578, -0.17], color: dark, r: 0.01 });
}

// ── bookshelf ────────────────────────────────────────────────────────────────
const BOOKS = ["#b8433a", "#2f5f9e", "#3f8a5a", "#d9a441", "#7b4f9e", "#e6d9bc", "#2a7f86", "#8a4b2e", "#c9653f",
  "#34495e", "#a3384f", "#5f7f3a", "#e58a5a", "#4a6fa5"];

/** A standing book: spine facing +z, bottom centre at (x, y, z); thicker books get gilt bands. */
function book(b, x, y, w, h, d, z, col) {
  b.group({ at: [x, y, z] }, () => {
    b.box(w, h, d, { at: [0, h / 2, 0], color: col, r: Math.min(0.006, w * 0.18), seg: 1 });
    if (w > 0.032) {
      const band = mix(col, C.gold, 0.65);
      for (const t of [0.14, 0.86]) b.box(w * 0.98, 0.008, 0.004, { at: [0, h * t, d / 2 + 0.001], color: band, r: 0 });
    }
  });
}

// ── doors ────────────────────────────────────────────────────────────────────
function doorLeaf(b, leafC, W, H, T) {
  // built with the hinge edge on x = 0, the leaf extending to +x, front face on z = 0
  const raised = shade(leafC, 0.05), groove = shade(leafC, -0.1);
  b.box(W, H, T, { at: [W / 2, H / 2, -T / 2], color: leafC, r: 0.008 });
  const stile = 0.07, pw = (W - stile * 3) / 2;
  const rows = [[0.09, 0.44], [0.55, 1.1]];
  for (const [y0, y1] of rows) for (let c = 0; c < 2; c++) {
    const cx = stile + pw / 2 + c * (pw + stile), cy = (y0 + y1) / 2 * H / 1.19, ph = (y1 - y0) * H / 1.19;
    for (const s of [1, -1]) {
      const z = s > 0 ? 0 : -T;
      b.box(pw + 0.016, ph + 0.016, 0.004, { at: [cx, cy, z + s * 0.001], color: groove, r: 0 });
      b.box(pw - 0.012, ph - 0.012, 0.012, { at: [cx, cy, z + s * 0.004], color: raised, r: 0.005, seg: 1 });
    }
  }
  const ky = 0.56 * H / 1.19;
  knob(b, [W - 0.055, ky, 0], 0.022);
  b.group({ at: [W - 0.055, ky, -T], rot: [0, PI, 0] }, () => knob(b, [0, 0, 0], 0.022));
  b.box(0.01, 0.022, 0.004, { at: [W - 0.055, ky - 0.055, 0.002], color: C.black, r: 0 }); // keyhole
  for (const y of [0.16, 0.6, 1.04]) {
    b.cyl(0.011, 0.011, 0.085, { at: [0.0, y * H / 1.19, 0.002], color: C.iron, kind: "metal", seg: 8 });
  }
}

// ── curtains ─────────────────────────────────────────────────────────────────
/** One gathered drape on the right (x > 0): vertical folds pinched by a tie-back. */
function drape(b, fab) {
  const N = 6, xo = 0.68, r = 0.04;
  // [y, width of the drape, forward bulge]
  const prof = [[1.5, 0.5, 0], [1.15, 0.42, 0.005], [0.85, 0.28, 0.015], [0.56, 0.14, 0.03], [0.36, 0.2, 0.02],
    [0.16, 0.27, 0.01], [0.02, 0.31, 0.0]];
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    const pts = prof.map(([y, w, bulge], j) => {
      const amp = j === 3 ? 0.006 : 0.02;
      return [xo - r - u * (w - 2 * r), y, (i % 2 ? -amp : amp) + bulge];
    });
    const col = i % 2 ? shade(fab, -0.05) : fab;
    b.tube(pts, r, { color: col, seg: 22, radial: 7 });
  }
  const tx = xo - 0.075;
  b.torus(0.085, 0.013, { at: [tx, 0.56, 0.03], rot: [PI / 2, 0, 0], scale: [1, 0.55, 1], color: C.gold,
    kind: "metal", seg: 22, tubeSeg: 6 });
  b.rod([tx - 0.02, 0.555, 0.08], [tx - 0.03, 0.47, 0.09], 0.006, { color: C.gold, kind: "metal", seg: 6 });
  b.cone(0.022, 0.06, { at: [tx - 0.03, 0.44, 0.09], color: C.gold, kind: "metal", seg: 10 });
  b.sphere(0.016, { at: [tx - 0.03, 0.475, 0.09], color: C.gold, kind: "metal", seg: 10 });
}

// ── rug patterns ─────────────────────────────────────────────────────────────
function flatShape(b, pts, y, h, color) {
  b.extrude(pts, h, { at: [0, y + h / 2, 0], rot: [-PI / 2, 0, 0], color, bevel: 0.0005 });
}

export default {
  table(b, p) {
    const wood = p.color || C.wood;
    if (p.variant === "round") roundTable(b, wood);
    else if (p.variant === "desk") deskTable(b, wood);
    else rectTable(b, wood);
  },

  // color = the wood, or the upholstery of the armchair; every seat is at 0.45 m
  chair(b, p) {
    if (p.variant === "stool") stool(b, p.color || C.wood);
    else if (p.variant === "armchair") armchair(b, p.color || "#b5544a");
    else plainChair(b, p.color || C.wood);
  },

  bench(b, p) {
    if (p.variant === "pew") pew(b, p.color || C.darkWood);
    else parkBench(b, p.color || "#b98552");
  },

  bookshelf(b, p) {
    const wood = p.color || C.wood;
    const dark = shade(wood, -0.1), back = shade(wood, -0.2), light = shade(wood, 0.04);
    const W = 0.9, H = 1.4, D = 0.32, t = 0.04;
    b.box(W - 0.04, 0.08, D - 0.03, { at: [0, 0.04, -0.008], color: dark, r: 0.01, seg: 1 });
    b.mirrorX(() => b.box(t, H - 0.045, D, { at: [W / 2 - t / 2, (H - 0.045) / 2, 0], color: wood, r: 0.012, seg: 1 }));
    b.box(W + 0.03, 0.045, D + 0.024, { at: [0, H - 0.0225, 0.006], color: wood, r: 0.012, seg: 1 });
    b.box(W + 0.004, 0.03, D + 0.006, { at: [0, H - 0.058, 0.002], color: dark, r: 0.008, seg: 1 });
    b.box(W - 2 * t + 0.01, H - 0.12, 0.02, { at: [0, H / 2, -D / 2 + 0.012], color: back, r: 0 });
    const inner0 = 0.1, inner1 = H - 0.073, st = 0.025, n = 4;
    const ch = (inner1 - inner0 - st * (n - 1)) / n;
    b.box(W - 2 * t + 0.004, 0.02, D - 0.01, { at: [0, inner0 - 0.01, 0], color: light, r: 0.004, seg: 1 });
    const rng = b.rng;
    for (let k = 0; k < n; k++) {
      const y0 = inner0 + k * (ch + st);
      if (k > 0) b.box(W - 2 * t + 0.004, st, D - 0.01, { at: [0, y0 - st / 2, 0], color: light, r: 0.005, seg: 1 });
      const xEnd = W / 2 - t - 0.008;
      let x = -xEnd;
      const zf = D / 2 - 0.03;
      let lastH = 0.2;
      let stacked = false;
      while (x < xEnd - 0.03) {
        if (!stacked && rng() < 0.22 && xEnd - x > 0.24 && x > -xEnd + 0.1) {
          stacked = true;
          let yy = y0;
          const L = 0.18 + rng() * 0.03, cnt = 2 + Math.floor(rng() * 2);
          for (let i = 0; i < cnt; i++) {
            const th = 0.032 + rng() * 0.014, col = rng.pick(BOOKS);
            b.box(L - i * 0.012, th, 0.19 - i * 0.008, { at: [x + L / 2, yy + th / 2, zf - 0.1], color: col, r: 0.005,
              seg: 1 });
            yy += th;
          }
          x += L + 0.008;
          continue;
        }
        const w = 0.03 + rng() * 0.03, h = Math.min(ch - 0.02, 0.17 + rng() * 0.085), d = 0.19 + rng() * 0.04;
        if (x + w > xEnd) break;
        book(b, x + w / 2, y0, w, h, d, zf - d / 2, rng.pick(BOOKS));
        lastH = h;
        x += w + 0.0015 + (rng() < 0.2 ? 0.004 : 0);
      }
      if (xEnd - x > 0.045) {
        const w = 0.035, h = Math.min(lastH, 0.2), g = 0.32;
        const px = x + h * Math.sin(g) * 0.96;
        b.group({ at: [px, y0, zf - 0.1], rot: [0, 0, g] }, () => book(b, w / 2, 0, w, h, 0.2, 0, rng.pick(BOOKS)));
      }
    }
  },

  desk_lamp(b, p) {
    const col = p.color || "#3f8f8a";
    const joint = shade(col, -0.18);
    b.lathe([[0, 0], [0.09, 0], [0.092, 0.01], [0.088, 0.022], [0.07, 0.03], [0.035, 0.035], [0, 0.036]],
      { at: [0, 0, -0.035], color: col, seg: 24 });
    const P0 = [0, 0.06, -0.05], P1 = [0, 0.265, -0.085], P2 = [0, 0.365, 0.0];
    b.cyl(0.016, 0.02, 0.03, { at: [0, 0.045, -0.05], color: joint, seg: 12 });
    for (const P of [P0, P1, P2]) {
      b.cyl(0.014, 0.014, 0.046, { at: P, rot: [0, 0, PI / 2], color: joint, seg: 12 });
      b.mirrorX(() => b.cyl(0.009, 0.009, 0.006, { at: [0.025, P[1], P[2]], rot: [0, 0, PI / 2], color: C.silver,
        kind: "metal", seg: 10 }));
    }
    // a spring along the lower arm
    const sp = [];
    for (let i = 0; i <= 28; i++) {
      const t = i / 28, ang = t * PI * 2 * 7;
      sp.push([0.026 + 0.006 * Math.cos(ang), 0.1 + t * 0.12 + 0.006 * Math.sin(ang) * 0.3, -0.056 - t * 0.022 +
        0.006 * Math.sin(ang)]);
    }
    b.tube(sp, 0.0022, { color: C.silver, kind: "metal", seg: 84, radial: 4 });
    for (const dx of [-0.014, 0.014]) {
      b.rod([dx, P0[1], P0[2]], [dx, P1[1], P1[2]], 0.0065, { color: col, seg: 8 });
      b.rod([dx, P1[1], P1[2]], [dx, P2[1], P2[2]], 0.0065, { color: col, seg: 8 });
    }
    // the shade points down and towards the viewer, so its lit inside and the bulb show
    b.group({ at: P2, rot: [2.2, 0, 0] }, () => {
      shell(b, [0, 0, 0], [[0, -0.014], [0.02, -0.012], [0.03, 0.0], [0.034, 0.03], [0.042, 0.05], [0.056, 0.08],
        [0.066, 0.105], [0.068, 0.112]], 0.004, col, WARM, { seg: 22, innerKind: "glow" });
      b.cyl(0.012, 0.012, 0.03, { at: [0, 0.045, 0], color: C.silver, kind: "metal", seg: 10 });
      b.sphere(0.028, { at: [0, 0.08, 0], color: BULB, kind: "glow", seg: 14, light: false });
    });
  },

  floor_lamp(b, p) {
    const sh = p.color || "#ffd27a";
    // a lit lampshade glows all over: warm by default, a light tint of color otherwise
    const glowC = p.color ? mix(p.color, "#fff4dc", 0.45) : mix(sh, WARM, 0.45);
    b.lathe([[0, 0], [0.15, 0], [0.152, 0.014], [0.142, 0.03], [0.09, 0.044], [0.03, 0.054], [0, 0.056]],
      { color: C.bronze, kind: "metal", seg: 28 });
    b.cyl(0.012, 0.013, 1.2, { at: [0, 0.65, 0], color: C.bronze, kind: "metal", seg: 10 });
    b.sphere(0.022, { at: [0, 0.62, 0], color: C.bronze, kind: "metal", seg: 12 });
    b.cyl(0.02, 0.016, 0.05, { at: [0, 1.235, 0], color: C.bronze, kind: "metal", seg: 12 });
    b.sphere(0.042, { at: [0, 1.285, 0], color: BULB, kind: "glow", seg: 14, light: false });
    shell(b, [0, 0, 0], [[0.175, 1.19], [0.168, 1.24], [0.12, 1.46]], 0.006, glowC, WARM,
      { seg: 28, kind: "glow", innerKind: "glow" });
    for (const [rr, y] of [[0.176, 1.192], [0.121, 1.458]]) {
      b.torus(rr, 0.006, { at: [0, y, 0], rot: [PI / 2, 0, 0], color: shade(sh, -0.25), seg: 32, tubeSeg: 6 });
    }
    b.sphere(0.018, { at: [0, 1.48, 0], color: C.bronze, kind: "metal", seg: 10 });
  },

  lamp_post(b, p) {
    const iron = p.color || IRON;
    b.lathe([[0, 0], [0.13, 0], [0.13, 0.045], [0.112, 0.062], [0.104, 0.16], [0.088, 0.185], [0.066, 0.205],
      [0.062, 0.27], [0.048, 0.3], [0.044, 0.34], [0, 0.34]], { color: iron, seg: 16 });
    b.cyl(0.024, 0.031, 1.22, { at: [0, 0.34 + 0.61, 0], color: iron, seg: 14 });
    b.lathe([[0.03, 0.9], [0.045, 0.93], [0.038, 0.97], [0.028, 1.0]], { color: iron, seg: 14 });
    b.rod([-0.135, 1.43, 0], [0.135, 1.43, 0], 0.011, { color: iron, seg: 8 });
    b.mirrorX(() => b.sphere(0.02, { at: [0.15, 1.43, 0], color: C.gold, kind: "metal", seg: 10 }));
    b.lathe([[0.025, 1.54], [0.05, 1.565], [0.075, 1.585], [0.075, 1.6], [0, 1.6]], { color: iron, seg: 16 });
    // the lantern: a square frustum of glowing glass with iron corner bars and a pyramid roof
    const yb = 1.6, yt = 1.78, hb = 0.052, ht = 0.08, sq = { rot: [0, PI / 4, 0] }, S2 = Math.SQRT2;
    prism(b, ht * S2 - 0.006, hb * S2 - 0.006, yt - yb, 4, { at: [0, (yb + yt) / 2, 0], ...sq, color: WARM, kind: "glow" });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      b.rod([sx * hb, yb, sz * hb], [sx * ht, yt, sz * ht], 0.008, { color: iron, seg: 6 });
    }
    prism(b, hb * S2 + 0.01, hb * S2 + 0.01, 0.018, 4, { at: [0, yb, 0], ...sq, color: iron });
    prism(b, ht * S2 + 0.012, ht * S2 + 0.012, 0.016, 4, { at: [0, yt, 0], ...sq, color: iron });
    prism(b, 0, 0.145, 0.09, 4, { at: [0, yt + 0.053, 0], ...sq, color: iron });
    b.sphere(0.018, { at: [0, 1.885, 0], color: C.gold, kind: "metal", seg: 10 });
  },

  lantern(b, p) {
    const metal = p.color || "#3d3a36";
    const hex = { rot: [0, PI / 6, 0] }; // hexagonal, with a flat face towards the viewer
    prism(b, 0.088, 0.094, 0.03, 6, { at: [0, 0.015, 0], color: metal, ...hex });
    prism(b, 0.072, 0.072, 0.19, 6, { at: [0, 0.125, 0], color: WARM, kind: "glow", ...hex });
    for (let k = 0; k < 6; k++) {
      const a = PI / 6 + k * PI / 3, x = 0.079 * Math.sin(a + PI / 6), z = 0.079 * Math.cos(a + PI / 6);
      b.rod([x, 0.03, z], [x, 0.22, z], 0.0065, { color: metal, seg: 6 });
    }
    prism(b, 0.086, 0.086, 0.02, 6, { at: [0, 0.228, 0], color: metal, ...hex });
    prism(b, 0, 0.1, 0.075, 6, { at: [0, 0.2755, 0], color: metal, ...hex });
    b.cyl(0.018, 0.022, 0.025, { at: [0, 0.318, 0], ...BRASS, seg: 10 });
    b.torus(0.026, 0.006, { at: [0, 0.354, 0], ...BRASS, seg: 18, tubeSeg: 6 });
  },

  candle(b, p) {
    const wax = p.color || "#f3ead6";
    b.lathe([[0, 0], [0.04, 0], [0.041, 0.004], [0.038, 0.012], [0.03, 0.014], [0.026, 0.011], [0, 0.011]],
      { ...BRASS, seg: 22 });
    b.cyl(0.025, 0.027, 0.02, { at: [0, 0.02, 0], ...BRASS, seg: 16 });
    b.lathe([[0, 0.02], [0.021, 0.02], [0.021, 0.188], [0.018, 0.192], [0.012, 0.187], [0, 0.186]],
      { color: wax, seg: 16 });
    for (const [a, len] of [[0.6, 0.035], [2.4, 0.02], [4.3, 0.028]]) {
      b.capsule(0.0055, len, { at: [0.0205 * Math.sin(a), 0.186 - len / 2, 0.0205 * Math.cos(a)], color: wax,
        seg: 6, capSeg: 2 });
    }
    b.cyl(0.0018, 0.0018, 0.016, { at: [0, 0.192, 0], color: C.black, seg: 5 });
    flame(b, [0, 0.194, 0], 1.08);
  },

  chandelier(b, p) {
    const brass = p.color || C.brass;
    const m = { color: brass, kind: "metal" };
    b.lathe([[0, 0.655], [0.05, 0.66], [0.075, 0.68], [0.08, 0.7], [0, 0.7]], { ...m, seg: 18 });
    for (let i = 0; i < 4; i++) {
      b.torus(0.022, 0.006, { at: [0, 0.635 - i * 0.035, 0], rot: [0, i % 2 ? PI / 2 : 0, PI / 2], ...m, seg: 12,
        tubeSeg: 6 });
    }
    b.lathe([[0, 0], [0.012, 0.03], [0.03, 0.07], [0.055, 0.11], [0.07, 0.15], [0.06, 0.185], [0.03, 0.21],
      [0.025, 0.26], [0.035, 0.3], [0.022, 0.34], [0.016, 0.45], [0.026, 0.48], [0.02, 0.505], [0, 0.51]],
    { ...m, seg: 18 });
    b.torus(0.15, 0.01, { at: [0, 0.155, 0], rot: [PI / 2, 0, 0], ...m, seg: 32, tubeSeg: 6 });
    const n = 8, R = 0.385, crystal = { color: "#eef7fb", kind: "gloss" };
    const tip = (k, r, y) => {
      const a = (k / n) * PI * 2 + PI / 8;
      return [r * Math.sin(a), y, r * Math.cos(a)];
    };
    for (let k = 0; k < n; k++) {
      const at = (r, y) => tip(k, r, y);
      b.tube([at(0.05, 0.17), at(0.15, 0.145), at(0.27, 0.155), at(0.345, 0.2), at(R, 0.275)], 0.014,
        { ...m, seg: 16, radial: 6 });
      b.lathe([[0, 0.262], [0.014, 0.264], [0.044, 0.28], [0.046, 0.29], [0.018, 0.29], [0, 0.298]],
        { at: at(R, 0), ...m, seg: 12 });
      b.cyl(0.015, 0.015, 0.08, { at: at(R, 0.3 + 0.04), color: C.ivory, seg: 10 });
      b.lathe([[0, 0], [0.012, 0.008], [0.017, 0.022], [0.013, 0.04], [0.006, 0.054], [0, 0.064]],
        { at: at(R, 0.378), color: "#ffc848", kind: "glow", seg: 10, light: k % 2 === 0 });
      // a crystal drop under each cup and a bead swag to the next arm
      b.cone(0.012, 0.035, { at: at(R, 0.235), rot: [PI, 0, 0], ...crystal, seg: 6, flat: true });
      const p0 = at(R, 0.27), p1 = tip(k + 1, R, 0.27), mid = tip(k + 0.5, R * 0.93, 0.2);
      b.tube([p0, [(p0[0] + mid[0]) / 2, 0.225, (p0[2] + mid[2]) / 2], mid,
        [(p1[0] + mid[0]) / 2, 0.225, (p1[2] + mid[2]) / 2], p1], 0.006, { ...crystal, seg: 14, radial: 5 });
    }
  },

  door(b, p) {
    const leafC = p.color || "#9a6a42";
    const frameC = C.ivory, frameD = shade(frameC, -0.08);
    const W = 0.5, Hd = 1.2, T = 0.04;
    const v = p.variant || "closed";
    // frame: jambs, head with cornice, threshold and feet
    b.mirrorX(() => {
      b.box(0.07, 1.25, 0.1, { at: [W / 2 + 0.035, 0.025 + 0.625, 0], color: frameC, r: 0.01 });
      b.box(0.1, 0.05, 0.17, { at: [W / 2 + 0.035, 0.025, 0], color: frameD, r: 0.012 });
    });
    b.box(W + 0.16, 0.085, 0.11, { at: [0, 1.255 + 0.0225, 0], color: frameC, r: 0.012 });
    b.box(W + 0.2, 0.035, 0.13, { at: [0, 1.335, 0], color: frameD, r: 0.012 });
    b.box(W, 0.02, 0.1, { at: [0, 0.01, 0], color: frameD, r: 0.004, seg: 1 });
    const angle = v === "open" ? 1.2 : v === "ajar" ? 0.62 : 0;
    if (angle > 0) {
      // warm light beyond the open doorway (one-sided: from behind you look through to the leaf)
      b.panel(W, Hd + 0.01, { at: [0, 0.02 + Hd / 2, -0.03], color: WARM, kind: "glow" });
    }
    // The catalogue keeps every variant 0.15 m deep, so the swing is squashed in depth: from the front the leaf
    // looks swung open (its projected width is unchanged), while the footprint stays slim.
    const reach = W * Math.sin(angle) + 0.06 * Math.cos(angle);
    const squash = angle > 0 ? Math.min(1, 0.075 / reach) : 1;
    b.group({ at: [-W / 2 + 0.003, 0.02, T / 2], scale: [1, 1, squash] }, () => {
      b.group({ rot: [0, -angle, 0] }, () => doorLeaf(b, leafC, W - 0.006, Hd - 0.005, T));
    });
  },

  stairs(b, p) {
    const wood = p.color || C.wood;
    const paint = C.ivory, runner = C.crimson;
    const n = 4, rise = 0.15, run = 0.2, W = 0.64, z0 = 0.38, zb = -0.4, tt = 0.032;
    for (let k = 0; k < n; k++) {
      const yTop = rise * (k + 1), zf = z0 - run * k;
      // painted body from the floor up (stacked, so each side shows the sawtooth profile)
      b.box(W - 0.03, yTop - tt, zf - zb, { at: [0, (yTop - tt) / 2, (zf + zb) / 2], color: paint, r: 0.006, seg: 1 });
      // wooden tread with a rounded nosing over the front and the sides
      b.box(W, tt, run + 0.03, { at: [0, yTop - tt / 2, zf - run / 2 + 0.015], color: wood, r: 0.012 });
      // carpet runner over the tread and down the riser, held by a brass stair rod
      b.box(0.36, 0.006, run - 0.01, { at: [0, yTop + 0.002, zf - run / 2 + 0.005], color: runner, r: 0 });
      b.box(0.36, rise - tt, 0.006, { at: [0, yTop - tt - (rise - tt) / 2, zf + 0.003], color: runner, r: 0 });
      b.cyl(0.0065, 0.0065, 0.4, { at: [0, rise * k + 0.008, zf + 0.008], rot: [0, 0, PI / 2], ...BRASS, seg: 8 });
    }
  },

  ladder(b, p) {
    const wood = p.color || C.lightWood;
    const dark = shade(wood, -0.08);
    const H = 1.4, xb = 0.175, xt = 0.14, lean = Math.atan2(xb - xt, H);
    const railX = (y) => xb - (xb - xt) * (y / H);
    b.mirrorX(() => {
      b.box(0.042, H, 0.1, { at: [(xb + xt) / 2, H / 2, 0], rot: [0, 0, lean], color: wood, r: 0.012 });
    });
    for (let i = 0; i < 6; i++) {
      const y = 0.2 + i * 0.205, x = railX(y);
      b.cyl(0.016, 0.016, 2 * x + 0.02, { at: [0, y, 0], rot: [0, 0, PI / 2], color: dark, seg: 10 });
    }
  },

  throne(b, p) {
    const gold = p.color || C.gold, velvet = p.color2 || C.crimson;
    const g = { color: gold, kind: "metal" };
    const velvetL = shade(velvet, 0.05);
    // base with paw feet and a velvet front panel
    for (const x of [-1, 1]) for (const z of [-1, 1]) b.sphere(0.045, { at: [x * 0.27, 0.045, z * 0.21], ...g, seg: 12 });
    b.box(0.6, 0.31, 0.5, { at: [0, 0.07 + 0.155, 0], ...g, r: 0.02 });
    b.box(0.46, 0.17, 0.01, { at: [0, 0.225, 0.252], color: velvet, r: 0.004 });
    b.extrude([[0.075, 0], [0, 0.058], [-0.075, 0], [0, -0.058]], 0.008, { at: [0, 0.225, 0.259], ...g, bevel: 0.003 });
    b.sphere(0.022, { at: [0, 0.225, 0.265], color: "#2f6fc4", kind: "gloss", seg: 12, scale: [1, 1, 0.6] });
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      b.sphere(0.011, { at: [sx * 0.2, 0.225 + sy * 0.058, 0.258], ...g, seg: 8 });
    }
    b.box(0.54, 0.07, 0.46, { at: [0, SEAT - 0.035, 0.02], color: velvetL, r: 0.03 });
    // tall back: a gold arch with a velvet cushion
    const arch = (hw, y0, y1, rise, n = 14) => {
      const pts = [[-hw, y0], [hw, y0], [hw, y1]];
      for (let i = 1; i < n; i++) {
        const t = (i / n) * PI;
        pts.push([hw * Math.cos(t), y1 + rise * Math.sin(t)]);
      }
      pts.push([-hw, y1]);
      return pts;
    };
    b.extrude(arch(0.3, 0.36, 1.0, 0.22), 0.06, { at: [0, 0, -0.235], ...g, bevel: 0.01 });
    b.extrude(arch(0.235, 0.45, 0.98, 0.17), 0.035, { at: [0, 0, -0.19], color: velvet, bevel: 0.012 });
    for (const [x, y] of [[0, 0.62], [-0.1, 0.76], [0.1, 0.76], [0, 0.9], [-0.1, 1.04], [0.1, 1.04]]) {
      b.sphere(0.014, { at: [x, y, -0.166], ...g, seg: 8 });
    }
    b.mirrorX(() => b.sphere(0.035, { at: [0.3, 1.02, -0.235], ...g, seg: 12 }));
    // a little crown on the crest
    b.group({ at: [0, 1.205, -0.235] }, () => {
      b.cyl(0.06, 0.055, 0.04, { at: [0, 0.02, 0], ...g, seg: 18 });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * PI * 2 + PI / 5;
        b.cone(0.017, 0.045, { at: [0.05 * Math.sin(a), 0.062, 0.05 * Math.cos(a)], ...g, seg: 6 });
        b.sphere(0.01, { at: [0.05 * Math.sin(a), 0.088, 0.05 * Math.cos(a)], ...g, seg: 8 });
      }
      b.sphere(0.014, { at: [0, 0.02, 0.058], color: "#c42a3a", kind: "gloss", seg: 10 });
    });
    b.sphere(0.03, { at: [0, 1.11, -0.2], color: "#2f6fc4", kind: "gloss", seg: 12, scale: [1, 1, 0.6] });
    // arms
    b.mirrorX(() => {
      b.box(0.05, 0.2, 0.42, { at: [0.305, 0.5, -0.01], ...g, r: 0.012 });
      b.box(0.085, 0.045, 0.44, { at: [0.305, 0.62, -0.01], color: velvetL, r: 0.02 });
      b.cyl(0.022, 0.026, 0.24, { at: [0.305, 0.5, 0.2], ...g, seg: 12 });
      b.sphere(0.04, { at: [0.305, 0.65, 0.21], ...g, seg: 12 });
    });
  },

  curtain(b, p) {
    const fab = p.color || C.crimson;
    const gold = { color: C.gold, kind: "metal" };
    b.mirrorX(() => {
      // support posts, tucked behind the outer folds
      b.cyl(0.011, 0.011, 1.5, { at: [0.655, 0.75, -0.07], ...gold, seg: 8 });
      b.cyl(0.035, 0.04, 0.02, { at: [0.655, 0.01, -0.07], ...gold, seg: 14 });
      drape(b, fab);
    });
    // valance: a pelmet board with three hanging swags, fringe and tassels
    b.box(1.44, 0.1, 0.07, { at: [0, 1.55, 0.0], color: shade(fab, -0.06), r: 0.02 });
    b.box(1.45, 0.014, 0.075, { at: [0, 1.5, 0.002], ...gold, r: 0.005 });
    for (const x of [-0.47, 0, 0.47]) {
      [[0.235, 0.045, 0.05, 0], [0.19, 0.04, 0.035, 0.05], [0.145, 0.035, 0.02, -0.04]].forEach(([R, r, z, d]) => {
        b.torus(R, r, { at: [x, 1.56, z], rot: [0, 0, PI], arc: PI, color: shade(fab, d), seg: 16, tubeSeg: 7 });
      });
      b.torus(0.235 + 0.04, 0.009, { at: [x, 1.56, 0.06], rot: [0, 0, PI], arc: PI, ...gold, seg: 18, tubeSeg: 5 });
    }
    for (const x of [-0.235, 0.235]) {
      b.cone(0.024, 0.07, { at: [x, 1.36, 0.08], ...gold, seg: 10 });
      b.sphere(0.018, { at: [x, 1.4, 0.08], ...gold, seg: 10 });
    }
  },

  lectern(b, p) {
    const wood = p.color || C.wood;
    const dark = shade(wood, -0.08), light = shade(wood, 0.05);
    b.box(0.5, 0.06, 0.42, { at: [0, 0.03, 0], color: dark, r: 0.015 });
    b.extrude([[-0.165, 0.06], [0.165, 0.06], [0.205, 0.84], [-0.205, 0.84]], 0.3, { at: [0, 0, -0.01], color: wood });
    b.extrude([[-0.125, 0.13], [0.125, 0.13], [0.158, 0.77], [-0.158, 0.77]], 0.01, { at: [0, 0, 0.152],
      color: light, bevel: 0.004 });
    b.cyl(0.075, 0.075, 0.012, { at: [0, 0.56, 0.162], rot: [PI / 2, 0, 0], color: C.navy, seg: 28 });
    b.torus(0.075, 0.008, { at: [0, 0.56, 0.168], color: C.gold, kind: "metal", seg: 28, tubeSeg: 6 });
    const star = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * PI * 2, r = i % 2 ? 0.022 : 0.052;
      star.push([r * Math.sin(a), r * Math.cos(a)]);
    }
    b.extrude(star, 0.008, { at: [0, 0.56, 0.172], color: C.gold, kind: "metal", bevel: 0.002 });
    b.box(0.5, 0.03, 0.4, { at: [0, 0.875, -0.01], rot: [-0.26, 0, 0], color: light, r: 0.01 });
    b.box(0.46, 0.035, 0.022, { at: [0, 0.855, -0.205], rot: [-0.26, 0, 0], color: dark, r: 0.008 });
    // microphone on a gooseneck, turned towards the speaker
    b.tube([[0.13, 0.9, 0.08], [0.13, 0.97, 0.06], [0.12, 1.02, 0.0], [0.11, 1.04, -0.06]], 0.006,
      { color: C.charcoal, seg: 20, radial: 6 });
    b.capsule(0.016, 0.028, { at: [0.105, 1.042, -0.085], rot: [PI / 2 + 0.1, 0, 0], color: C.black, seg: 10, capSeg: 3 });
  },

  rug(b, p) {
    const field = p.color || "#a8393a", band = p.color2 || "#2f4f7a";
    const cream = "#f1e4c4", gold = "#d9a441";
    const L = 0.92, Dp = 0.7;
    // pattern layers sit at least 1.5 mm apart so they never flicker from afar; the top stays under 0.02 m
    const L0 = 0.012, L1 = L0 + 0.003; // field top, band top
    b.box(L, L0, Dp, { at: [0, L0 / 2, 0], color: field, r: 0.004, seg: 1 });
    const frame = (w, d, t, col, yy, h) => {
      for (const s of [-1, 1]) {
        b.box(w, h, t, { at: [0, yy + h / 2, s * (d / 2 - t / 2)], color: col, r: 0 });
        b.box(t, h, d - 2 * t, { at: [s * (w / 2 - t / 2), yy + h / 2, 0], color: col, r: 0 });
      }
    };
    frame(L - 0.04, Dp - 0.04, 0.075, band, L0, 0.003); // border band
    frame(L - 0.04, Dp - 0.04, 0.01, cream, L1, 0.0015); // pinstripe along its outer edge
    frame(L - 0.19, Dp - 0.19, 0.012, cream, L0, 0.003); // pinstripe inside it
    for (let i = 0; i < 9; i++) {
      const x = -0.36 + i * 0.09;
      for (const s of [-1, 1]) {
        flatShape(b, [[0.018, 0], [0, 0.014], [-0.018, 0], [0, -0.014]].map(([a, c]) => [a + x, c + s * 0.295]),
          L1, 0.0015, cream);
      }
    }
    for (let i = 0; i < 5; i++) {
      const z = -0.18 + i * 0.09;
      for (const s of [-1, 1]) {
        flatShape(b, [[0.014, 0], [0, 0.018], [-0.014, 0], [0, -0.018]].map(([a, c]) => [a + s * 0.405, c - z]),
          L1, 0.0015, cream);
      }
    }
    // central medallion (stepped diamonds) and corner pieces
    flatShape(b, [[0.2, 0], [0, 0.13], [-0.2, 0], [0, -0.13]], L0, 0.003, band);
    flatShape(b, [[0.13, 0], [0, 0.085], [-0.13, 0], [0, -0.085]], L0 + 0.0015, 0.003, cream);
    flatShape(b, [[0.07, 0], [0, 0.045], [-0.07, 0], [0, -0.045]], L0 + 0.003, 0.003, field);
    b.cyl(0.018, 0.018, 0.002, { at: [0, L0 + 0.0065, 0], color: gold, seg: 14 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const cx = sx * (L / 2 - 0.105), cz = sz * (Dp / 2 - 0.105);
      flatShape(b, [[cx, cz], [cx - sx * 0.09, cz], [cx, cz - sz * 0.07]].map(([a, c]) => [a, -c]), L0, 0.003, band);
    }
    // fringe on the short ends
    for (const s of [-1, 1]) {
      for (let i = 0; i < 15; i++) {
        const z = -0.315 + i * 0.045;
        b.box(0.04, 0.004, 0.009, { at: [s * (L / 2 + 0.018), 0.003, z], color: cream, r: 0 });
      }
    }
  },

  mirror(b, p) {
    const wood = p.color || C.darkWood;
    const light = shade(wood, 0.06);
    const px = 0.212;
    b.mirrorX(() => {
      b.box(0.05, 0.04, 0.25, { at: [px, 0.02, 0], color: wood, r: 0.016 });
      b.lathe([[0.024, 0], [0.027, 0.02], [0.019, 0.06], [0.016, 0.38], [0.021, 0.48], [0.025, 0.54], [0.021, 0.6],
        [0.016, 0.68], [0.016, 0.93], [0.021, 0.955], [0, 0.965]], { at: [px, 0.035, 0], color: wood, seg: 12 });
      b.sphere(0.024, { at: [px, 1.02, 0], color: wood, seg: 12 });
      b.cyl(0.015, 0.015, 0.05, { at: [px - 0.025, 0.6, 0], rot: [0, 0, PI / 2], color: C.brass, kind: "metal", seg: 10 });
    });
    b.rod([-px, 0.14, 0], [px, 0.14, 0], 0.012, { color: wood, seg: 8 });
    b.group({ at: [0, 0.6, 0], rot: [-0.07, 0, 0] }, () => {
      const ax = 0.175, ay = 0.37, ix = 0.138, iy = 0.333;
      const ring = new THREE.Shape();
      ring.absellipse(0, 0, ax, ay, 0, PI * 2, false, 0);
      const hole = new THREE.Path();
      hole.absellipse(0, 0, ix, iy, 0, PI * 2, true, 0);
      ring.holes.push(hole);
      b.extrude(ring, 0.03, { color: light, bevel: 0.008, curveSeg: 24 });
      b.cyl(1, 1, 0.012, { at: [0, 0, -0.008], rot: [PI / 2, 0, 0], scale: [ix + 0.005, 1, iy + 0.005], color: wood,
        seg: 40 });
      b.cyl(1, 1, 0.004, { at: [0, 0, 0.0], rot: [PI / 2, 0, 0], scale: [ix + 0.002, 1, iy + 0.002], color: "#e9eef2",
        kind: "metal", seg: 40 });
      b.tube(ellipse(ix + 0.002, iy + 0.002, 32), 0.006, { at: [0, 0, 0.01], closed: true, color: C.gold, kind: "metal",
        seg: 64, radial: 6 });
      // two diagonal glints say "mirror" at a glance
      for (const [x, y, w, h] of [[-0.035, 0.09, 0.03, 0.2], [0.035, 0.055, 0.013, 0.14]]) {
        b.box(w, h, 0.002, { at: [x, y, 0.004], rot: [0, 0, -0.62], color: "#ffffff", kind: "glow", light: false, r: 0 });
      }
    });
  },
};
