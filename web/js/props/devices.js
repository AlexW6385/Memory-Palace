// Props in the "devices" group. Each entry: name: (b, p) => void — see kit.js and docs/props.md.
// b is a Builder (metres, base on y = 0, facing +z); p holds the item's params:
//   { variant, color, color2, text, emoji, pose, hat, hold, seed }
//
// Style: chunky toy electronics. Casings are bevelled slabs in soft colours; screens are a glowing backing
// (kind "glow") with light text decals (glow: true) or simple glowing graphics; status LEDs are tiny glow
// dots. Screens and LEDs pass light: false so they do not throw big halos in the world; real lamps (the bulb,
// the spotlight lens, the tower beacon) keep theirs.
import * as THREE from "three";
import { C, shade, mix, rng } from "./kit.js";

const PI = Math.PI;
const TAU = 2 * PI;

const BEZEL = "#202329"; // black glass around screens
const RUBBER = "#2a2d33"; // feet, cables, grips
const SCREEN = "#24578c"; // backlit screen
const SCREEN_BAR = "#3a7cbd"; // window title bar on a screen
const INK = "#effaff"; // light screen text
const LED = { green: "#5df07f", blue: "#5cb6ff", amber: "#ffb43a", red: "#ff4d3d", white: "#f2fbff" };
const WINDOW_DOTS = ["#ff6b5e", "#ffcd4a", "#5ed36b"];
const SYNTAX = ["#ff8fb3", "#7fd6ff", "#ffe27a", "#a6f08c", "#c7b4ff", "#e9f3ff"];
const APPS = ["#ff6b5e", "#ffa94d", "#ffd84d", "#69d66b", "#3ecfb2", "#4fb8f7", "#5b84ff", "#a07bff", "#ff7eb6"];
const GLOW = { kind: "glow", light: false };

// ── helpers ──────────────────────────────────────────────────────────────────
/** Random numbers for a prop: from its own seed when it has one, so it looks the same in any scene. */
function randomFor(b, p, salt = 0) {
  return p.seed != null ? rng(p.seed * 31 + 7 + salt) : b.rng;
}

/** The string p.text stands for in the builder's language ("" when there is none). */
function textOf(b, t) {
  if (t == null) return "";
  if (typeof t === "string") return t;
  return String(t[b.env.lang || "en"] ?? t.en ?? Object.values(t)[0] ?? "");
}

/** Rounded-rectangle outline w × h centred on (cx, cy), corner radius r, n segments per corner (CCW). */
function rrect(w, h, r, n = 4, cx = 0, cy = 0) {
  r = Math.max(0.0005, Math.min(r, w / 2 - 1e-5, h / 2 - 1e-5));
  const pts = [];
  [[w / 2 - r, h / 2 - r], [-w / 2 + r, h / 2 - r], [-w / 2 + r, -h / 2 + r], [w / 2 - r, -h / 2 + r]].forEach(([x, y], k) => {
    for (let i = 0; i <= n; i++) {
      const a = (k + i / n) * (PI / 2);
      pts.push([cx + x + r * Math.cos(a), cy + y + r * Math.sin(a)]);
    }
  });
  return pts;
}

/** A flat rounded slab w × h (x, y) and d thick (z), centred at o.at; the bevel stays inside that size. */
function slab(b, w, h, d, r, o = {}) {
  const { bevel, n, ...rest } = o;
  const bev = Math.max(0, Math.min(bevel ?? 0.004, d * 0.3, r * 0.6, w * 0.2, h * 0.2));
  return b.extrude(rrect(w - 2 * bev, h - 2 * bev, Math.max(0.0008, r - bev), n ?? 4), Math.max(0.0004, d - 2 * bev),
    { ...rest, bevel: bev });
}

/** Smooth open lathe profile [[r, y], ...] through control points (centripetal Catmull-Rom), n + 1 samples. */
function smoothProfile(pts, n = 16) {
  const c = new THREE.CatmullRomCurve3(pts.map(([r, y]) => new THREE.Vector3(r, y, 0)), false, "centripetal");
  return c.getPoints(n).map((v) => [Math.max(0, v.x), v.y]);
}

/** Euler rotation that turns the +y axis towards the direction d. */
function aimRot(d) {
  const v = new THREE.Vector3(d[0], d[1], d[2]).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
  const e = new THREE.Euler().setFromQuaternion(q, "XYZ");
  return [e.x, e.y, e.z];
}

/** A ring (washer) around the y axis from y0 to y1 with inner and outer radius, all faces outward. */
function ring(b, rIn, rOut, y0, y1, o = {}) {
  return b.lathe([[rIn, y0], [rOut, y0], [rOut, y1], [rIn, y1], [rIn, y0]], { seg: 24, ...o });
}

/** A round status LED facing +z at `at`. */
function led(b, at, color, r = 0.0045) {
  b.cyl(r, r, 0.004, { at, rot: [PI / 2, 0, 0], color, ...GLOW, seg: 8 });
}

/** A small disc facing +z (buttons, lenses, dials) centred at `at`, t thick. */
function dot(b, at, r, t, o = {}) {
  b.cyl(r, r, t, { at, rot: [PI / 2, 0, 0], seg: 16, ...o });
}

/**
 * A lit screen in the xy plane of the current frame with its glass at z = 0, centred on (x, y), w × h: a glowing
 * backing with rounded corners, an optional window title bar (o.chrome), then the text as a glowing decal, or
 * else o.fill(x, y, w, h) draws default content into the free area.
 */
function screen(b, x, y, w, h, o = {}) {
  slab(b, w, h, 0.003, o.r ?? Math.min(w, h) * 0.06, { at: [x, y, -0.0015], color: o.bg || SCREEN, ...GLOW, bevel: 0 });
  let cy = y, ch = h;
  if (o.chrome) {
    const bh = Math.min(h * 0.13, 0.032), m = bh * 0.22;
    const by = y + h / 2 - m - bh / 2;
    slab(b, w - 2 * m, bh, 0.001, bh * 0.3, { at: [x, by, 0.0006], color: o.bar || SCREEN_BAR, ...GLOW, bevel: 0 });
    WINDOW_DOTS.forEach((c, i) => b.cyl(bh * 0.2, bh * 0.2, 0.001, { at: [x - w / 2 + m + bh * (0.6 + i * 0.55), by, 0.0014],
      rot: [PI / 2, 0, 0], color: c, ...GLOW, seg: 10 }));
    cy = y - (bh + m) / 2;
    ch = h - bh - m;
  }
  if (o.text) {
    b.text(o.text, { at: [x, cy, 0.003], w: w * 0.9, h: ch * 0.86, fg: o.fg || INK, font: o.font || "body", glow: true });
  } else if (o.fill) o.fill(x, cy, w, ch);
}

/** Default screen content: indented lines of colourful "code". */
function codeLines(b, x, y, w, h, r, n = 6) {
  const lh = h / (n + 0.4);
  let indent = 0;
  for (let i = 0; i < n; i++) {
    const ly = y + h / 2 - lh * (i + 0.7);
    let lx = x - w / 2 + w * 0.07 + indent * w * 0.07;
    const words = r.int(1, 3);
    for (let k = 0; k < words; k++) {
      const ww = w * r.range(0.09, 0.22);
      if (lx + ww > x + w / 2 - w * 0.06) break;
      b.box(ww, lh * 0.4, 0.0015, { at: [lx + ww / 2, ly, 0.0012], color: r.pick(SYNTAX), ...GLOW, r: 0 });
      lx += ww + w * 0.028;
    }
    indent = Math.max(0, Math.min(3, indent + (r() < 0.45 ? 1 : r() < 0.6 ? -1 : 0)));
  }
  // a blinking cursor
  b.box(lh * 0.32, lh * 0.55, 0.0015, { at: [x - w / 2 + w * 0.07 + lh * 0.16, y + h / 2 - lh * (n + 0.1), 0.0012],
    color: INK, ...GLOW, r: 0 });
}

/** A circle sector (pie slice) facing +z, centred at `at`. */
function sector(b, R, a0, da, o) {
  b.geo(new THREE.CircleGeometry(R, Math.max(4, Math.round(da * 8)), a0, da), o);
}

// ── screen-wall pictures (drawn in the screen frame: centre at the origin, glass at z = 0) ──────────
const WALL_BG = ["#173a5e", "#1b3550", "#123f57", "#20335f", "#173c4c"];
const Z1 = 0.0012;

function wallPicture(b, kind, w, h, r) {
  const g = (color) => ({ color, ...GLOW });
  switch (kind) {
    case "bars": {
      const n = 6, bw = (w * 0.78) / n;
      for (let i = 0; i < n; i++) {
        const bh = h * (0.18 + 0.55 * r());
        b.box(bw * 0.68, bh, 0.0015, { at: [-w * 0.39 + bw * (i + 0.5), -h * 0.36 + bh / 2, Z1], ...g(i === n - 2 ? "#ffd166" : "#6fd3ff"), r: 0 });
      }
      b.box(w * 0.82, 0.004, 0.0015, { at: [0, -h * 0.365, Z1], ...g("#cfe9ff"), r: 0 });
      break;
    }
    case "line": {
      for (let k = 0; k < 3; k++) b.box(w * 0.8, 0.002, 0.001, { at: [0, -h * 0.3 + k * h * 0.3, 0.0006], ...g("#2d6a96"), r: 0 });
      const pts = [];
      for (let i = 0; i <= 6; i++) pts.push([-w * 0.4 + (w * 0.8 * i) / 6, -h * 0.3 + h * (0.08 + 0.1 * i + 0.22 * r()), Z1]);
      for (let i = 0; i < pts.length - 1; i++) b.rod(pts[i], pts[i + 1], 0.004, { ...g("#7cffb2"), seg: 5 });
      for (const pt of pts) dot(b, pt, 0.008, 0.002, g("#e8fff2"));
      break;
    }
    case "pie": {
      const R = h * 0.36, cx = -w * 0.18;
      const cuts = [0, 0.42, 0.7, 1];
      const cols = ["#ff8f6b", "#ffd166", "#6fd3ff"];
      for (let i = 0; i < 3; i++) {
        const a0 = PI / 2 + cuts[i] * TAU, da = (cuts[i + 1] - cuts[i]) * TAU;
        const mid = a0 + da / 2, off = i === 0 ? R * 0.08 : 0;
        sector(b, R, a0, da, { at: [cx + Math.cos(mid) * off, Math.sin(mid) * off, Z1], ...g(cols[i]) });
        b.box(w * 0.05, w * 0.05, 0.0015, { at: [w * 0.16, h * (0.2 - i * 0.2), Z1], ...g(cols[i]), r: 0 });
        b.box(w * 0.16, h * 0.05, 0.0015, { at: [w * 0.31, h * (0.2 - i * 0.2), Z1], ...g("#bcd7ee"), r: 0 });
      }
      break;
    }
    case "radar": {
      const R = h * 0.42;
      for (const k of [0.35, 0.68, 1]) b.torus(R * k, 0.0022, { at: [0, 0, Z1], ...g("#4fe38a"), seg: 28, tubeSeg: 3 });
      b.box(R * 2, 0.002, 0.001, { at: [0, 0, Z1], ...g("#3aa86a"), r: 0 });
      b.box(0.002, R * 2, 0.001, { at: [0, 0, Z1], ...g("#3aa86a"), r: 0 });
      sector(b, R, 0.6, 0.7, { at: [0, 0, 0.0008], ...g("#2f8f5a") });
      for (const [a, d] of [[0.9, 0.6], [2.4, 0.8], [4.1, 0.45]]) dot(b, [Math.cos(a) * R * d, Math.sin(a) * R * d, Z1], 0.007, 0.002, g("#ffe27a"));
      break;
    }
    case "globe": {
      const R = h * 0.42;
      b.cyl(R, R, 0.001, { at: [0, 0, 0.0006], rot: [PI / 2, 0, 0], ...g("#2a6fb0"), seg: 32 });
      for (const [x, y, sx, sy] of [[-0.32, 0.28, 0.36, 0.28], [0.3, 0.1, 0.32, 0.46], [-0.12, -0.4, 0.3, 0.22], [0.45, -0.42, 0.16, 0.13]]) {
        b.geo(new THREE.CircleGeometry(R, 16), { at: [x * R, y * R, 0.0016], scale: [sx, sy, 1], ...g("#5fd38a") });
      }
      b.torus(R, 0.003, { at: [0, 0, Z1], ...g("#bfe6ff"), seg: 32, tubeSeg: 3 });
      for (const s of [0.35, 0.75]) b.torus(R, 0.002, { at: [0, 0, Z1], scale: [s, 1, 1], ...g("#8cc8f0"), seg: 28, tubeSeg: 3 });
      b.box(R * 2, 0.003, 0.001, { at: [0, 0, Z1], ...g("#8cc8f0"), r: 0 });
      break;
    }
    case "wave": {
      for (const [col, amp, ph, dy] of [["#ff8fb3", 0.22, 0, 0.08], ["#7fd6ff", 0.14, 1.7, -0.12]]) {
        const pts = [];
        for (let i = 0; i <= 24; i++) {
          const t = i / 24;
          pts.push([-w * 0.42 + w * 0.84 * t, h * (dy + amp * Math.sin(t * TAU * 1.5 + ph)), Z1]);
        }
        b.tube(pts, 0.0035, { ...g(col), seg: 48, radial: 4 });
      }
      break;
    }
    case "cams": {
      const cols = ["#3d5c7a", "#4a6b4f", "#6b5a3d", "#4e4b73"];
      for (let i = 0; i < 4; i++) {
        const cx = (i % 2 ? 1 : -1) * w * 0.23, cy = (i < 2 ? 1 : -1) * h * 0.23;
        b.box(w * 0.43, h * 0.42, 0.0012, { at: [cx, cy, 0.0008], ...g(cols[i]), r: 0 });
        dot(b, [cx, cy + h * 0.02, Z1], h * 0.06, 0.0015, g("#d9e6f2"));
        b.box(h * 0.16, h * 0.1, 0.0015, { at: [cx, cy - h * 0.1, Z1], ...g("#d9e6f2"), r: 0 });
      }
      dot(b, [w * 0.42, h * 0.4, Z1 + 0.0004], h * 0.035, 0.0015, g("#ff4d3d"));
      break;
    }
    case "gauge": {
      const R = h * 0.36;
      b.torus(R, 0.012, { at: [0, -h * 0.08, 0.0006], rot: [0, 0, -PI / 6], arc: (4 * PI) / 3, ...g("#2c4f73"), seg: 30, tubeSeg: 3 });
      b.torus(R, 0.013, { at: [0, -h * 0.08, Z1], rot: [0, 0, PI / 2], arc: (2 * PI) / 3 + 0.25, ...g("#ffb43a"), seg: 24, tubeSeg: 3 });
      b.rod([0, -h * 0.08, Z1], [Math.cos(0.75) * R * 0.85, -h * 0.08 + Math.sin(0.75) * R * 0.85, Z1], 0.004, { ...g("#f2fbff"), seg: 5 });
      dot(b, [0, -h * 0.08, Z1], 0.012, 0.002, g("#f2fbff"));
      break;
    }
    default: {
      // "kpi": a big number over a row of small bars
      b.text("98%", { at: [0, h * 0.12, 0.003], w: w * 0.7, h: h * 0.5, fg: "#ffe27a", font: "body", glow: true });
      for (let i = 0; i < 8; i++) {
        const bh = h * (0.06 + 0.14 * r());
        b.box(w * 0.06, bh, 0.0015, { at: [-w * 0.35 + i * w * 0.1, -h * 0.35 + bh / 2, Z1], ...g("#7fd6ff"), r: 0 });
      }
    }
  }
}

// ── server rack units ────────────────────────────────────────────────────────
const UNIT_FACE = { server: "#4a5262", server2: "#434b5a", storage: "#4d5566", blank: "#383e4a", switch: "#2b3039", ups: "#3c4350" };

/** One rack unit: face plate centred at (0, cy) with its front at z = fz; w × h. */
function rackUnit(b, type, cy, fz, w, h, r) {
  b.box(w, h, 0.026, { at: [0, cy, fz - 0.013], color: UNIT_FACE[type], r: Math.min(0.006, h * 0.18), seg: 1 });
  const z = fz + 0.001;
  // rack ears with a little handle
  b.mirrorX(() => {
    b.box(0.018, h * 0.84, 0.006, { at: [w / 2 - 0.013, cy, z + 0.002], color: "#aab2bc", kind: "metal", r: 0 });
    b.box(0.008, h * 0.5, 0.012, { at: [w / 2 - 0.013, cy, z + 0.008], color: "#c9cfd6", kind: "metal", r: 0.002, seg: 1 });
  });
  const ledCol = () => (r() < 0.72 ? LED.green : r() < 0.6 ? LED.blue : LED.amber);
  const x0 = -w / 2 + 0.035, x1 = w / 2 - 0.035;
  switch (type) {
    case "server": {
      for (let i = 0; i < 4; i++) b.box(0.05, h * 0.36, 0.003, { at: [x0 + 0.03 + i * 0.058, cy, z], color: "#22262d", r: 0 });
      for (let i = 0; i < 4; i++) b.box(0.07, 0.003, 0.002, { at: [0.11, cy + (i - 1.5) * h * 0.17, z], color: "#2b3038", r: 0 });
      for (let i = 0; i < 3; i++) led(b, [x1 - 0.066 + i * 0.019, cy, z + 0.001], i === 0 ? LED.blue : ledCol(), 0.006);
      dot(b, [x1 - 0.008, cy, z + 0.002], 0.0065, 0.004, { color: "#d4d9df", kind: "metal" });
      break;
    }
    case "server2":
    case "storage": {
      const rows = type === "storage" ? 3 : 2, cols = 6;
      const bw = (x1 - x0 - 0.05) / cols, bh = (h - 0.014) / rows;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const cx = x0 + bw * (i + 0.5), cyy = cy + h / 2 - 0.007 - bh * (j + 0.5);
        b.box(bw - 0.006, bh - 0.006, 0.004, { at: [cx, cyy, z], color: "#6b7383", r: 0 });
        b.box(bw * 0.55, 0.002, 0.002, { at: [cx - bw * 0.1, cyy, z + 0.002], color: "#3d434e", r: 0 });
        if (r() < 0.85) led(b, [cx + bw / 2 - 0.012, cyy, z + 0.0025], ledCol(), 0.0046);
      }
      dot(b, [x1 - 0.012, cy + h * 0.2, z + 0.002], 0.008, 0.004, { color: "#d4d9df", kind: "metal" });
      led(b, [x1 - 0.012, cy - h * 0.2, z + 0.001], LED.blue);
      break;
    }
    case "blank": {
      for (let i = 0; i < 9; i++) b.box(0.03, h * 0.42, 0.002, { at: [x0 + 0.03 + i * 0.044, cy, z], color: "#262a31", r: 0 });
      break;
    }
    case "switch": {
      const n = 12, pw = (x1 - x0 - 0.04) / n;
      for (let j = 0; j < 2; j++) for (let i = 0; i < n; i++) {
        const cx = x0 + pw * (i + 0.5), cyy = cy + (j ? -1 : 1) * h * 0.2;
        b.box(pw * 0.7, h * 0.26, 0.003, { at: [cx, cyy, z], color: "#14171c", r: 0 });
        if (r() < 0.7) b.box(pw * 0.25, h * 0.08, 0.002, { at: [cx + pw * 0.2, cyy + h * 0.17 * (j ? -1 : 1), z + 0.001], color: r() < 0.8 ? LED.green : LED.amber, ...GLOW, r: 0 });
      }
      led(b, [x1 - 0.01, cy, z + 0.001], LED.blue);
      // patch cables plugged into some ports, looping down and out to the sides
      const cab = ["#ffd04a", "#4fb8f7", "#ff6b5e", "#69d66b", "#ffa94d", "#a07bff"];
      for (let k = 0; k < 6; k++) {
        const i = [1, 3, 4, 7, 9, 10][k], j = k % 2;
        const sx = x0 + pw * (i + 0.5), sy = cy + (j ? -1 : 1) * h * 0.2;
        const side = sx < 0 ? -1 : 1;
        b.box(pw * 0.62, h * 0.24, 0.012, { at: [sx, sy, z + 0.006], color: cab[k], kind: "gloss", r: 0.002, seg: 1 });
        b.tube([[sx, sy, z + 0.012], [sx, sy - 0.012, z + 0.03], [sx + side * 0.03, sy - 0.05, z + 0.034],
          [side * (w / 2 - 0.02), sy - 0.07 - k * 0.008, z + 0.018]], 0.0045, { color: cab[k], kind: "gloss", seg: 16, radial: 6 });
      }
      break;
    }
    case "ups": {
      slab(b, 0.12, h * 0.5, 0.004, 0.006, { at: [-0.06, cy + h * 0.08, z], color: BEZEL, kind: "gloss", bevel: 0.001 });
      slab(b, 0.105, h * 0.36, 0.002, 0.004, { at: [-0.06, cy + h * 0.08, z + 0.002], color: "#5fe0ff", ...GLOW, bevel: 0 });
      for (let i = 0; i < 4; i++) b.box(0.012, h * 0.18, 0.001, { at: [-0.1 + i * 0.022, cy + h * 0.08, z + 0.0035], color: "#174a5a", ...GLOW, r: 0 });
      for (let i = 0; i < 3; i++) dot(b, [0.04 + i * 0.03, cy + h * 0.08, z + 0.002], 0.008, 0.004, { color: "#c9cfd6", kind: "gloss" });
      for (let i = 0; i < 3; i++) led(b, [0.04 + i * 0.03, cy - h * 0.22, z + 0.001], i === 2 ? LED.amber : LED.green, 0.0035);
      for (let i = 0; i < 5; i++) b.box(0.006, h * 0.6, 0.002, { at: [x1 - 0.06 + i * 0.012, cy, z], color: "#262a31", r: 0 });
      break;
    }
    default: break;
  }
}

// ── builders ─────────────────────────────────────────────────────────────────
export default {
  // Desktop computer: a bevelled monitor on a neck and foot, tilted back a little, with a window on its glowing
  // screen (p.text, or lines of code), a chunky keyboard and a mouse. color = casing.
  computer(b, p) {
    const shell = p.color || "#ebe6da";
    const dark = shade(shell, -0.1);
    const r = randomFor(b, p);
    const text = textOf(b, p.text);
    const MW = 0.53, MH = 0.33, MD = 0.03, mz = -0.085, my = 0.165 + MH / 2;
    b.cyl(0.11, 0.115, 0.014, { at: [0, 0.007, mz - 0.012], scale: [1, 1, 0.66], color: shell, kind: "gloss", seg: 28 });
    b.box(0.07, 0.2, 0.024, { at: [0, 0.11, mz - 0.048], rot: [0.16, 0, 0], color: dark, r: 0.01 });
    b.group({ at: [0, my, mz], rot: [-0.07, 0, 0] }, () => {
      slab(b, MW, MH, MD, 0.024, { color: shell, kind: "gloss", bevel: 0.008 });
      slab(b, MW * 0.68, MH * 0.62, 0.035, 0.05, { at: [0, -0.015, -MD / 2 - 0.012], color: dark, bevel: 0.012 });
      const gy = 0.012;
      slab(b, MW - 0.026, MH - 0.05, 0.003, 0.014, { at: [0, gy, MD / 2 + 0.001], color: BEZEL, kind: "gloss", bevel: 0.001 });
      b.group({ at: [0, 0, MD / 2 + 0.0045] }, () => screen(b, 0, gy, MW - 0.048, MH - 0.072,
        { text, chrome: true, font: "mono", fill: (x, y, w, h) => codeLines(b, x, y, w, h, r) }));
      led(b, [MW / 2 - 0.035, -MH / 2 + 0.013, MD / 2 + 0.001], LED.green, 0.005);
    });
    // keyboard: a low base with three rows of chunky keys and a space bar
    const kz = 0.11, KW = 0.4, KD = 0.12, KH = 0.018;
    b.box(KW, KH, KD, { at: [0, KH / 2, kz], color: shade(shell, -0.3), kind: "gloss", r: 0.007 });
    const pitch = 0.0345;
    for (let row = 0; row < 3; row++) {
      const z = kz - KD / 2 + 0.022 + row * 0.029;
      const n = row === 2 ? 10 : 11;
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * pitch + (row === 1 ? 0.006 : 0);
        const accent = row === 0 && i === 0 ? "#ff8a5c" : row === 1 && i === n - 1 ? "#4fc3b0" : shell;
        b.box(0.028, 0.009, 0.024, { at: [x, KH + 0.004, z], color: accent, r: 0 });
      }
    }
    b.box(0.17, 0.009, 0.022, { at: [0, KH + 0.004, kz + KD / 2 - 0.02], color: shell, r: 0 });
    // mouse with its cable
    const mx = 0.255, mzz = kz + 0.005;
    b.sphere(1, { at: [mx, 0.001, mzz], scale: [0.03, 0.024, 0.044], thetaLength: PI / 2, color: shell, kind: "gloss", seg: 16 });
    b.box(0.0025, 0.004, 0.022, { at: [mx, 0.0215, mzz - 0.021], color: dark, r: 0 });
    b.cyl(0.0035, 0.0035, 0.006, { at: [mx, 0.023, mzz - 0.017], rot: [0, 0, PI / 2], color: RUBBER, seg: 8 });
    b.tube([[mx, 0.006, mzz - 0.043], [mx - 0.006, 0.004, mzz - 0.075], [mx - 0.05, 0.004, mz + 0.03],
      [0.09, 0.004, mz - 0.02]], 0.0035, { color: dark, seg: 18, radial: 5 });
  },

  // Open laptop: a thin base with a dark keyboard and trackpad, the lid tilted back with a glowing screen
  // (p.text, or lines of code). color = casing.
  laptop(b, p) {
    const shell = p.color || "#c5cad1";
    const keyCol = "#2c3038";
    const r = randomFor(b, p);
    const text = textOf(b, p.text);
    const BW = 0.36, BD = 0.235, BT = 0.016, lift = 0.004, hz = -0.1, bz = hz + BD / 2;
    b.mirrorX(() => {
      for (const z of [hz + 0.03, hz + BD - 0.03]) b.cyl(0.01, 0.01, lift, { at: [BW / 2 - 0.035, lift / 2, z], color: RUBBER, seg: 10 });
    });
    b.box(BW, BT, BD, { at: [0, lift + BT / 2, bz], r: 0.007, color: shell, kind: "gloss" });
    const top = lift + BT;
    b.box(0.32, 0.002, 0.118, { at: [0, top - 0.0004, hz + 0.084], color: shade(shell, -0.32), r: 0 });
    for (let row = 0; row < 4; row++) {
      const n = 12, pitch = 0.0255, z = hz + 0.038 + row * 0.022;
      for (let i = 0; i < n; i++) b.box(0.021, 0.004, 0.018, { at: [(i - (n - 1) / 2) * pitch, top + 0.0012, z], color: keyCol, r: 0 });
    }
    b.box(0.13, 0.004, 0.018, { at: [0, top + 0.0012, hz + 0.038 + 4 * 0.022], color: keyCol, r: 0 });
    b.box(0.115, 0.0015, 0.066, { at: [0, top + 0.0002, hz + 0.184], color: shade(shell, -0.07), r: 0 });
    // hinge and lid
    b.cyl(0.0075, 0.0075, BW - 0.06, { at: [0, top - 0.002, hz - 0.002], rot: [0, 0, PI / 2], color: shade(shell, -0.25), seg: 10 });
    const LH = 0.23, LT = 0.011;
    b.group({ at: [0, top - 0.001, hz - 0.004], rot: [-0.28, 0, 0] }, () => {
      b.box(BW, LH, LT, { at: [0, LH / 2, -LT / 2], r: 0.006, color: shell, kind: "gloss" });
      slab(b, BW - 0.014, LH - 0.014, 0.003, 0.009, { at: [0, LH / 2, 0.0005], color: BEZEL, kind: "gloss", bevel: 0.001 });
      b.group({ at: [0, 0, 0.0035] }, () => screen(b, 0, LH / 2 + 0.003, BW - 0.036, LH - 0.04,
        { text, chrome: true, font: "mono", fill: (x, y, w, h) => codeLines(b, x, y, w, h, r, 5) }));
      b.cyl(0.0028, 0.0028, 0.002, { at: [0, LH - 0.011, 0.0025], rot: [PI / 2, 0, 0], color: "#0d0f12", seg: 8 });
      b.cyl(0.02, 0.02, 0.002, { at: [0, LH * 0.55, -LT - 0.0008], rot: [PI / 2, 0, 0], color: shade(shell, 0.12), kind: "gloss", seg: 20 });
    });
  },

  // Server rack: a dark cabinet on feet, filled with rack units (servers, drive arrays, a switch with patch
  // cables, a UPS with a display), each with little glowing status LEDs. color = cabinet.
  server_rack(b, p) {
    const frame = p.color || "#2e3440";
    const r = randomFor(b, p);
    const W = 0.55, H = 1.4, D = 0.48, side = 0.034, topT = 0.04, plinth = 0.06, foot = 0.014;
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      b.cyl(0.018, 0.022, foot, { at: [x * (W / 2 - 0.05), foot / 2, z * (D / 2 - 0.05)], color: RUBBER, seg: 10 });
    }
    b.box(W - 0.02, plinth, D - 0.02, { at: [0, foot + plinth / 2, 0], color: shade(frame, -0.08), r: 0.008 });
    const sh = H - foot - plinth - topT + 0.01;
    b.mirrorX(() => b.box(side, sh, D, { at: [W / 2 - side / 2, foot + plinth - 0.005 + sh / 2, 0], color: frame, r: 0.01 }));
    b.box(W + 0.006, topT, D + 0.006, { at: [0, H - topT / 2, 0], color: shade(frame, 0.04), r: 0.012 });
    const inner = W - 2 * side;
    b.box(inner, sh, 0.02, { at: [0, foot + plinth + sh / 2, -D / 2 + 0.03], color: "#16191e", r: 0 });
    const fz = D / 2 - 0.03; // front of the unit faces
    b.mirrorX(() => b.box(0.02, sh - 0.02, 0.02, { at: [inner / 2 - 0.01, foot + plinth + sh / 2, fz - 0.012], color: "#8d959f", kind: "metal", r: 0.003 }));
    const units = [["switch", 1], ["server", 1], ["server", 1], ["server2", 2], ["blank", 1], ["server", 1], ["server2", 2],
      ["server", 1], ["storage", 3], ["blank", 1], ["ups", 2]];
    const total = units.reduce((s, u) => s + u[1], 0);
    const y0 = foot + plinth + 0.012, y1 = H - topT - 0.012;
    const U = (y1 - y0) / total;
    let y = y1;
    for (const [type, n] of units) {
      const h = n * U;
      y -= h;
      rackUnit(b, type, y + h / 2, fz, inner - 0.012, h - 0.005, r);
    }
  },

  // A wall of nine monitors on a stand, each showing a different glowing picture: charts, a radar, a globe,
  // waves, camera feeds, a gauge and a big number. color = frame.
  screen_wall(b, p) {
    const frame = p.color || "#2c3038";
    const r = randomFor(b, p);
    const cols = 3, rows = 3, MW = 0.386, MH = 0.236, gap = 0.012;
    const Wt = cols * MW + (cols - 1) * gap, Ht = rows * MH + (rows - 1) * gap;
    const yTop = 0.995, yBot = yTop - Ht;
    // stand: two posts on long feet, a cross bar and a back frame
    b.mirrorX(() => {
      b.box(0.06, yTop - 0.06, 0.045, { at: [0.36, (yTop - 0.06) / 2 + 0.03, -0.06], color: shade(frame, -0.05), r: 0.012 });
      b.box(0.075, 0.035, 0.25, { at: [0.36, 0.0175, 0], color: frame, r: 0.012 });
      for (const z of [-0.1, 0.1]) b.cyl(0.014, 0.014, 0.01, { at: [0.36, 0.005, z], color: RUBBER, seg: 10 });
    });
    b.box(0.72, 0.05, 0.035, { at: [0, 0.16, -0.06], color: shade(frame, -0.05), r: 0.01 });
    b.box(Wt - 0.06, Ht - 0.05, 0.02, { at: [0, yBot + Ht / 2, -0.035], color: shade(frame, -0.08), r: 0.006 });
    const kinds = ["line", "kpi", "bars", "radar", "globe", "wave", "pie", "cams", "gauge"];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = -Wt / 2 + MW / 2 + i * (MW + gap), y = yTop - MH / 2 - j * (MH + gap);
      b.box(MW, MH, 0.03, { at: [x, y, -0.005], color: frame, r: 0.008, seg: 1 });
      b.group({ at: [x, y, 0.0115] }, () => {
        const sw = MW - 0.026, shh = MH - 0.026;
        screen(b, 0, 0, sw, shh, { bg: WALL_BG[(i + j * 2) % WALL_BG.length], r: 0.004 });
        wallPicture(b, kinds[j * cols + i], sw, shh, r);
      });
    }
  },

  // A giant smartphone standing upright: rounded coloured frame, black glass, a glowing screen with a status
  // bar, the text (or a grid of app icons) and a dock; side buttons and a camera bump on the back.
  smartphone(b, p) {
    const shell = p.color || "#5868c8";
    const text = textOf(b, p.text);
    const r = randomFor(b, p);
    const W = 0.21, H = 0.41, D = 0.03, R = 0.034;
    b.group({ at: [0, H / 2 + 0.002, 0] }, () => {
      slab(b, W, H, D, R, { color: shell, kind: "gloss", bevel: 0.008, n: 6 });
      slab(b, W - 0.01, H - 0.01, 0.004, R - 0.005, { at: [0, 0, D / 2 + 0.0005], color: BEZEL, kind: "gloss", bevel: 0.0015, n: 6 });
      const SW = W - 0.026, SH = H - 0.03;
      b.group({ at: [0, 0, D / 2 + 0.003] }, () => {
        slab(b, SW, SH, 0.002, R - 0.012, { at: [0, 0, -0.001], color: "#1f3f78", ...GLOW, bevel: 0, n: 5 });
        // status bar and the camera island
        slab(b, 0.052, 0.015, 0.001, 0.0074, { at: [0, SH / 2 - 0.02, 0.0008], color: "#0c0d10", bevel: 0 });
        for (let i = 0; i < 3; i++) b.box(0.0035, 0.004 + i * 0.002, 0.001, { at: [SW / 2 - 0.045 + i * 0.006, SH / 2 - 0.021 + i * 0.001, 0.0008], color: INK, ...GLOW, r: 0 });
        slab(b, 0.016, 0.008, 0.001, 0.002, { at: [SW / 2 - 0.02, SH / 2 - 0.02, 0.0008], color: "#7dffa0", ...GLOW, bevel: 0 });
        b.box(0.024, 0.006, 0.001, { at: [-SW / 2 + 0.03, SH / 2 - 0.02, 0.0008], color: INK, ...GLOW, r: 0 });
        // dock with four apps
        const icon = (x, y, s, c) => slab(b, s, s, 0.0012, s * 0.24, { at: [x, y, 0.0009], color: c, ...GLOW, bevel: 0, n: 2 });
        slab(b, SW - 0.02, 0.06, 0.0008, 0.016, { at: [0, -SH / 2 + 0.042, 0.0005], color: "#35588f", ...GLOW, bevel: 0, n: 3 });
        for (let i = 0; i < 4; i++) icon(-SW / 2 + 0.033 + i * ((SW - 0.066) / 3), -SH / 2 + 0.042, 0.034, APPS[(i * 2 + 1) % APPS.length]);
        b.box(0.06, 0.004, 0.001, { at: [0, -SH / 2 + 0.008, 0.0008], color: INK, ...GLOW, r: 0 });
        if (text) {
          b.text(text, { at: [0, 0.03, 0.003], w: SW * 0.9, h: SH * 0.55, fg: INK, font: "body", glow: true });
        } else {
          for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
            icon(-SW / 2 + 0.033 + i * ((SW - 0.066) / 3), SH / 2 - 0.07 - j * 0.058, 0.034, APPS[Math.floor(r() * APPS.length)]);
          }
        }
      });
      // side buttons
      b.box(0.006, 0.05, 0.012, { at: [W / 2 + 0.0015, 0.08, 0], color: shade(shell, -0.08), r: 0.0025, seg: 1 });
      for (const y of [0.1, 0.05]) b.box(0.006, 0.034, 0.012, { at: [-W / 2 - 0.0015, y, 0], color: shade(shell, -0.08), r: 0.0025, seg: 1 });
      // camera bump on the back (top left seen from behind)
      b.group({ at: [0.052, H / 2 - 0.06, -D / 2 - 0.003] }, () => {
        slab(b, 0.075, 0.075, 0.006, 0.018, { color: shade(shell, 0.06), kind: "gloss", bevel: 0.002 });
        for (const [x, y] of [[-0.016, 0.016], [-0.016, -0.016], [0.018, 0.0]]) {
          b.cyl(0.012, 0.012, 0.004, { at: [x, y, -0.004], rot: [PI / 2, 0, 0], color: "#30343c", kind: "gloss", seg: 14 });
          b.cyl(0.0075, 0.0075, 0.002, { at: [x, y, -0.0065], rot: [PI / 2, 0, 0], color: "#111318", kind: "gloss", seg: 12 });
        }
      });
    });
  },

  // Wi-Fi router: a low white box on rubber feet with a glowing Wi-Fi sign on top, a dark front strip with
  // status LEDs, four antennas at the back and LAN ports behind. color = casing.
  router(b, p) {
    const shell = p.color || "#f1efe9";
    const dark = "#2c3037";
    const W = 0.31, H = 0.048, D = 0.19, lift = 0.008, zc = 0.015;
    const top = lift + H;
    b.mirrorX(() => { for (const z of [-1, 1]) b.cyl(0.012, 0.012, lift + 0.002, { at: [W / 2 - 0.03, (lift + 0.002) / 2, zc + z * (D / 2 - 0.03)], color: RUBBER, seg: 10 }); });
    b.box(W, H, D, { at: [0, lift + H / 2, zc], r: 0.016, color: shell, kind: "gloss" });
    // front strip with LEDs
    slab(b, W * 0.82, H * 0.42, 0.004, 0.006, { at: [0, lift + H * 0.5, zc + D / 2 + 0.0005], color: dark, kind: "gloss", bevel: 0.001 });
    const leds = [LED.blue, LED.green, LED.green, LED.green, LED.green, LED.amber];
    leds.forEach((c, i) => led(b, [(i - 2.5) * 0.034, lift + H * 0.5, zc + D / 2 + 0.003], c, 0.0045));
    // Wi-Fi sign on the lid: a dot and three arcs opening towards the back
    const wz = zc + D / 2 - 0.05;
    dot(b, [0, top + 0.0008, wz], 0.0065, 0.0016, { rot: [0, 0, 0], color: LED.blue, ...GLOW });
    for (const [R, a] of [[0.018, 0.7], [0.031, 0.7], [0.044, 0.7]]) {
      b.torus(R, 0.0028, { at: [0, top + 0.0008, wz], rot: [-PI / 2, 0, PI / 2 - a], arc: 2 * a, color: LED.blue, ...GLOW, seg: 12, tubeSeg: 4 });
    }
    // vents along the back of the lid
    for (let i = 0; i < 7; i++) b.box(0.03, 0.0015, 0.006, { at: [(i - 3) * 0.04, top + 0.0002, zc - D / 2 + 0.035], color: shade(shell, -0.14), r: 0 });
    // antennas on hinges along the back edge, the outer ones leaning out
    for (const x of [-0.115, -0.04, 0.04, 0.115]) {
      const lean = -x * 1.9;
      const hz = zc - D / 2 + 0.012;
      b.box(0.026, 0.02, 0.022, { at: [x, top - 0.004, hz], color: dark, r: 0.006, seg: 1 });
      b.group({ at: [x, top + 0.004, hz], rot: [-0.07, 0, lean] }, () => {
        b.cyl(0.01, 0.01, 0.022, { at: [0, 0, 0], rot: [0, 0, PI / 2], color: dark, seg: 10 });
        b.capsule(0.0105, 0.1, { at: [0, 0.063, 0], scale: [1, 1, 0.72], color: dark, kind: "gloss", seg: 10 });
      });
    }
    // ports on the back
    for (let i = 0; i < 5; i++) b.box(0.022, 0.016, 0.004, { at: [-0.06 + i * 0.03, lift + H * 0.45, zc - D / 2 - 0.0005], color: i === 0 ? "#3f7fd0" : "#e0b23a", r: 0 });
  },

  // Light bulb standing on its screw base: 'on' glows warm through tinted glass with short rays around its
  // crown; 'off' shows clear glass with the filament and its support wires. color = the glow.
  lightbulb(b, p) {
    const on = p.variant !== "off";
    const glowCol = p.color || "#ffc928";
    const metal = { color: "#d6d2c8", kind: "metal" };
    const s = 0.88;
    b.group({ scale: s }, () => {
      // contact tip, black insulator, threaded shell and collar
      b.cyl(0.012, 0.014, 0.008, { at: [0, 0.004, 0], color: "#b98d4a", kind: "metal", seg: 14 });
      b.lathe([[0.014, 0.006], [0.026, 0.009], [0.036, 0.016], [0.04, 0.026], [0.04, 0.03]], { color: "#1e2026", kind: "gloss", seg: 22 });
      const thread = [[0.0, 0.026], [0.042, 0.026]];
      for (let k = 0; k < 6; k++) {
        const y = 0.03 + k * 0.0135;
        thread.push([0.0455, y], [0.05, y + 0.0045], [0.0505, y + 0.0068], [0.05, y + 0.009], [0.0455, y + 0.0135]);
      }
      thread.push([0.047, 0.114], [0.0, 0.114]);
      b.lathe(thread, { ...metal, seg: 26 });
      b.cyl(0.048, 0.05, 0.01, { at: [0, 0.117, 0], ...metal, seg: 26 });
      // glass envelope
      const glass = smoothProfile([[0.045, 0.118], [0.05, 0.145], [0.068, 0.19], [0.096, 0.235], [0.112, 0.282], [0.113, 0.322],
        [0.099, 0.362], [0.068, 0.389], [0.03, 0.399], [0.0, 0.4]], 22);
      if (on) {
        const core = glass.map(([rr, y]) => [rr * 0.93, 0.28 + (y - 0.28) * 0.95]);
        b.lathe(core, { color: glowCol, kind: "glow", seg: 28 });
        b.lathe(glass, { color: glowCol, kind: "glass", seg: 28 });
      } else {
        b.lathe(glass, { color: "#dfeef3", kind: "glass", seg: 28 });
        // glass stem, support wires and a coiled filament
        b.cyl(0.006, 0.014, 0.08, { at: [0, 0.16, 0], color: "#e9f2f4", kind: "gloss", seg: 10 });
        b.mirrorX(() => b.rod([0.004, 0.19, 0], [0.032, 0.268, 0], 0.0018, { color: "#7c7f86", kind: "metal", seg: 5 }));
        const coil = [];
        for (let i = 0; i <= 40; i++) {
          const t = i / 40, a = t * TAU * 7;
          coil.push([-0.032 + 0.064 * t, 0.268 + Math.sin(PI * t) * 0.012 + Math.cos(a) * 0.004, Math.sin(a) * 0.004]);
        }
        b.tube(coil, 0.0014, { color: "#6b5440", seg: 80, radial: 4 });
      }
    });
    if (on) {
      // short rays bursting from the crown: up, to the sides and back (none towards the front, where they
      // would cross the glass), so they fan out seen from the front and still read from the side
      const cy = 0.29 * s, r0 = 0.132, r1 = 0.168, rm = (r0 + r1) / 2;
      const dirs = [[0, 1, 0]];
      for (const [ph, th] of [[0, 0.88], [PI, 0.88], [1.25 * PI, 0.52], [1.75 * PI, 0.52]]) {
        dirs.push([Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th)]);
      }
      for (const d of dirs) {
        b.capsule(0.0085, r1 - r0, { at: [d[0] * rm, cy + d[1] * rm, d[2] * rm], rot: aimRot(d), color: glowCol, ...GLOW, seg: 8 });
      }
    }
  },

  // A fat D-cell battery standing upright: metal caps, a coloured wrap with a + mark, and a charge gauge whose
  // segments glow: four green when 'full', one red when 'low'. color = wrap.
  battery(b, p) {
    const low = p.variant === "low";
    const wrap = p.color || "#3f74c4";
    const band = shade(wrap, -0.16);
    const metal = { color: "#d9dce1", kind: "metal" };
    const R = 0.088, y0 = 0.012, y1 = 0.356;
    b.cyl(R - 0.008, R - 0.012, y0 + 0.002, { at: [0, (y0 + 0.002) / 2, 0], ...metal, seg: 28 });
    b.lathe([[0, y0], [R - 0.005, y0], [R, y0 + 0.006], [R, y1 - 0.006], [R - 0.005, y1], [0, y1]], { color: wrap, kind: "gloss", seg: 32 });
    b.cyl(R + 0.0012, R + 0.0012, 0.05, { at: [0, y0 + 0.035, 0], color: band, kind: "gloss", seg: 32, open: true });
    b.lathe([[0, y1 - 0.002], [R - 0.008, y1 - 0.002], [R - 0.012, y1 + 0.01], [0.036, y1 + 0.012], [0.033, y1 + 0.015],
      [0.032, y1 + 0.036], [0.027, y1 + 0.042], [0, y1 + 0.043]], { ...metal, seg: 28 });
    // charge gauge: a dark curved window with four segments
    const patch = (rr, ya, yb, th, o) => b.cyl(rr, rr, yb - ya, { at: [0, (ya + yb) / 2, 0], thetaStart: -th / 2, thetaLength: th,
      open: true, seg: 10, ...o });
    patch(R + 0.0014, 0.098, 0.3, 0.9, { color: "#1f232a", kind: "gloss" });
    for (let i = 0; i < 4; i++) {
      const ya = 0.108 + i * 0.048, lit = !low || i === 0;
      patch(R + 0.0028, ya, ya + 0.04, 0.72, lit ? { color: low ? "#ff4a36" : "#34d85a", ...GLOW } : { color: "#3a404a", kind: "gloss" });
    }
    // + near the top, − near the bottom
    b.box(0.034, 0.009, 0.004, { at: [0, 0.327, R], color: C.white, r: 0 });
    b.box(0.009, 0.034, 0.004, { at: [0, 0.327, R], color: C.white, r: 0 });
    b.box(0.03, 0.008, 0.004, { at: [0, 0.07, R], color: C.white, r: 0 });
  },

  // A red-and-white lattice radio tower on a concrete footing: tapering legs with cross bracing, panel antennas
  // and a microwave dish, a mast with a glowing red beacon on top. color = the red bands.
  antenna(b, p) {
    const red = p.color || "#d64a3c";
    const white = "#f2efe8";
    const base = 0.04;
    b.box(0.36, base, 0.36, { at: [0, base / 2, 0], color: "#c4bdb0", r: 0.012 });
    const y0 = base, y1 = 1.3, a0 = 0.15, a1 = 0.034;
    const half = (y) => a0 + (a1 - a0) * ((y - y0) / (y1 - y0));
    const levels = [y0, 0.27, 0.47, 0.645, 0.8, 0.94, 1.065, 1.185, y1];
    const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    for (let k = 0; k < levels.length - 1; k++) {
      const ya = levels[k], yb = levels[k + 1], ha = half(ya), hb = half(yb);
      const col = k % 2 ? white : red;
      const P = (c, y, h) => [c[0] * h, y, c[1] * h];
      for (const c of corners) b.rod(P(c, ya, ha), P(c, yb, hb), 0.0085, { color: col, seg: 6 });
      for (let f = 0; f < 4; f++) {
        const c0 = corners[f], c1 = corners[(f + 1) % 4];
        b.rod(P(c0, ya, ha), P(c1, yb, hb), 0.0042, { color: col, seg: 5 });
        b.rod(P(c1, ya, ha), P(c0, yb, hb), 0.0042, { color: col, seg: 5 });
        b.rod(P(c0, yb, hb), P(c1, yb, hb), 0.005, { color: col, seg: 5 });
      }
    }
    for (const c of corners) b.box(0.03, 0.02, 0.03, { at: [c[0] * a0, base + 0.01, c[1] * a0], color: "#9a9488", r: 0.004, seg: 1 });
    // panel antennas near the top, a microwave dish lower down
    const pa = 1.13, ph = half(pa);
    for (const [x, z, ry] of [[0, ph + 0.022, 0], [ph + 0.022, 0, PI / 2], [-ph - 0.022, 0, -PI / 2]]) {
      b.box(0.045, 0.13, 0.02, { at: [x, pa, z], rot: [0, ry, 0], color: "#e9e7e1", kind: "gloss", r: 0.008, seg: 1 });
    }
    const dy = 0.72, dz = half(dy) + 0.035;
    b.cyl(0.05, 0.05, 0.04, { at: [0, dy, dz], rot: [PI / 2, 0, 0], color: "#dad7d0", seg: 18 });
    b.sphere(0.05, { at: [0, dy, dz + 0.02], scale: [1, 1, 0.3], color: "#f2f0ea", kind: "gloss", seg: 16 });
    b.rod([0, dy, dz - 0.02], [0, dy, half(dy) - 0.01], 0.006, { color: "#8d959f", seg: 6 });
    // mast and beacon
    b.box(0.09, 0.012, 0.09, { at: [0, y1 + 0.006, 0], color: red, r: 0.003, seg: 1 });
    b.cyl(0.008, 0.011, 0.2, { at: [0, y1 + 0.11, 0], color: white, seg: 8 });
    b.cyl(0.016, 0.018, 0.016, { at: [0, y1 + 0.215, 0], color: "#3a3d44", seg: 12 });
    b.sphere(0.026, { at: [0, y1 + 0.245, 0], color: "#ff3b2f", kind: "glow", seg: 14 });
    b.sphere(0.012, { at: [half(0.94) + 0.012, 0.94, 0], color: "#ff3b2f", kind: "glow", light: false, seg: 10 });
  },

  // A satellite dish on a post: a deep white parabolic bowl looking up at the sky (turned a little to the right
  // so its curve shows), with the feed (LNB) on a single arm from the lower rim, and a pivot mount. color = dish.
  satellite_dish(b, p) {
    const white = p.color || "#eceff1";
    const back = shade(white, -0.14);
    const grey = "#8b929b";
    const metal = { color: "#a9b0b8", kind: "metal" };
    const R = 0.225, dep = 0.085, f = (R * R) / (4 * dep), t = 0.012;
    const elev = 0.9, yaw = 0.5;
    const ax = [Math.cos(elev) * Math.sin(yaw), Math.sin(elev), Math.cos(elev) * Math.cos(yaw)];
    const V = [-0.035, 0.33, -0.03];
    const along = (s) => [V[0] + ax[0] * s, V[1] + ax[1] * s, V[2] + ax[2] * s];
    const pivot = along(-0.07);
    b.cyl(0.1, 0.11, 0.03, { at: [pivot[0], 0.015, pivot[2]], color: grey, seg: 24 });
    b.cyl(0.02, 0.024, pivot[1] - 0.03, { at: [pivot[0], 0.03 + (pivot[1] - 0.03) / 2, pivot[2]], ...metal, seg: 14 });
    b.group({ at: pivot, rot: [0, yaw, 0] }, () => b.cyl(0.026, 0.026, 0.09, { rot: [0, 0, PI / 2], color: grey, seg: 14 }));
    b.rod(pivot, along(-0.012), 0.018, { color: grey, seg: 10 });
    b.group({ at: V, rot: [0, yaw, 0] }, () => b.group({ rot: [PI / 2 - elev, 0, 0] }, () => {
      const prof = [];
      for (let i = 0; i <= 12; i++) {
        const rr = (R * i) / 12;
        prof.push([rr, (rr * rr) / (4 * f)]);
      }
      b.lathe(prof.map(([rr, y]) => [rr, y - t]), { color: back, seg: 36 });
      b.lathe(prof.slice().reverse(), { color: white, kind: "gloss", seg: 36 });
      b.torus(R, t * 0.65, { at: [0, dep - t / 2, 0], rot: [PI / 2, 0, 0], color: white, kind: "gloss", seg: 40, tubeSeg: 6 });
      b.cyl(0.05, 0.06, 0.02, { at: [0, -t - 0.008, 0], color: grey, seg: 18 });
      // feed arm from the lowest point of the rim (local +z) up to the LNB at the focus
      const F = [0, f - 0.01, 0];
      b.tube([[0, dep - 0.01, R * 0.97], [0, dep + 0.01, R * 0.84], [0, f * 0.8, R * 0.32], F], 0.009, { color: grey, seg: 18, radial: 8 });
      b.box(0.04, 0.03, 0.05, { at: [0, f + 0.005, 0.012], color: "#3a3f47", kind: "gloss", r: 0.01 });
      b.cyl(0.02, 0.026, 0.035, { at: [0, f - 0.025, 0], color: "#d9dce1", kind: "gloss", seg: 16 });
      b.cyl(0.022, 0.022, 0.006, { at: [0, f - 0.045, 0], color: "#d0483c", kind: "gloss", seg: 16 });
    }));
  },

  // A chunky camera: leatherette body with a silver top plate, a viewfinder hump, dials and a shutter button,
  // a hand grip and a big lens with a glinting glass. color = body.
  camera(b, p) {
    const body = p.color || "#30333a";
    const chrome = { color: "#d7dade", kind: "metal" };
    const BW = 0.27, BH = 0.096, BD = 0.072, bz = -0.024;
    b.box(BW, BH, BD, { at: [0, BH / 2, bz], color: body, r: 0.014 });
    b.box(BW + 0.002, 0.034, BD + 0.002, { at: [0, BH + 0.01, bz], ...chrome, r: 0.012 });
    const top = BH + 0.027;
    b.extrude([[-0.05, 0], [0.05, 0], [0.031, 0.048], [-0.031, 0.048]], 0.062, { at: [0, top - 0.004, bz - 0.002], color: body, bevel: 0.006 });
    b.box(0.03, 0.006, 0.03, { at: [0, top + 0.05 + 0.004, bz - 0.002], ...chrome, r: 0.002, seg: 1 });
    slab(b, 0.05, 0.014, 0.004, 0.004, { at: [0, top + 0.026, bz + BD / 2 + 0.006], color: "#e8eef2", kind: "gloss", bevel: 0.001 });
    // grip (on the camera's right, our left) with the shutter button; dials on top
    b.box(0.052, BH - 0.01, 0.03, { at: [-BW / 2 + 0.03, BH / 2, bz + BD / 2 + 0.01], color: shade(body, -0.04), r: 0.013 });
    b.cyl(0.012, 0.012, 0.01, { at: [-BW / 2 + 0.03, top + 0.003, bz + 0.012], color: "#d0483c", kind: "gloss", seg: 14 });
    b.cyl(0.02, 0.02, 0.013, { at: [-BW / 2 + 0.07, top + 0.005, bz - 0.006], ...chrome, seg: 18 });
    b.cyl(0.024, 0.024, 0.016, { at: [BW / 2 - 0.055, top + 0.007, bz - 0.004], color: "#2a2d33", seg: 18 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      b.box(0.004, 0.014, 0.004, { at: [BW / 2 - 0.055 + Math.cos(a) * 0.024, top + 0.007, bz - 0.004 + Math.sin(a) * 0.024], rot: [0, -a, 0], color: "#4a4e56", r: 0 });
    }
    led(b, [-BW / 2 + 0.03, BH - 0.012, bz + BD / 2 + 0.0255], LED.amber, 0.004);
    // a small screen and buttons on the back
    b.group({ at: [0.02, BH / 2 + 0.004, bz - BD / 2 - 0.001], rot: [0, PI, 0] }, () => {
      slab(b, 0.12, 0.07, 0.004, 0.008, { color: BEZEL, kind: "gloss", bevel: 0.001 });
      slab(b, 0.104, 0.056, 0.002, 0.005, { at: [0, 0, 0.002], color: "#3d7fb8", ...GLOW, bevel: 0 });
      for (let i = 0; i < 3; i++) dot(b, [0.09, 0.022 - i * 0.022, 0.0], 0.007, 0.006, { color: "#55595f" });
    });
    // strap lugs
    b.mirrorX(() => b.torus(0.009, 0.0025, { at: [BW / 2 + 0.004, BH + 0.01, bz], rot: [0, PI / 2, 0], ...chrome, seg: 12, tubeSeg: 4 }));
    // lens
    const ly = 0.062, z0 = bz + BD / 2;
    b.group({ at: [0, ly, z0], rot: [PI / 2, 0, 0] }, () => {
      ring(b, 0.0, 0.058, -0.002, 0.012, { ...chrome, seg: 30 });
      b.cyl(0.052, 0.054, 0.075, { at: [0, 0.048, 0], color: "#25282e", seg: 30 });
      for (let i = 0; i < 5; i++) b.cyl(0.0565, 0.0565, 0.004, { at: [0, 0.03 + i * 0.008, 0], color: "#191b20", seg: 30 });
      b.cyl(0.0555, 0.0555, 0.004, { at: [0, 0.074, 0], color: "#d0483c", seg: 30 });
      ring(b, 0.046, 0.058, 0.085, 0.1, { color: "#25282e", seg: 30 });
      b.sphere(0.047, { at: [0, 0.086, 0], scale: [1, 0.28, 1], color: "#1b2a4d", kind: "gloss", seg: 24 });
      b.sphere(0.026, { at: [0, 0.092, 0], scale: [1, 0.2, 1], color: "#3d3a7a", kind: "gloss", seg: 18 });
      b.sphere(0.009, { at: [-0.018, 0.098, -0.018], scale: [1, 0.25, 0.6], rot: [0, 0.8, 0], color: "#ffffff", kind: "glow", light: false, seg: 8 });
    });
  },

  // A megaphone pointing at the viewer: a flared horn with a white rolled rim, a darker throat with a speaker
  // grille, a rear body with a trigger grip underneath. color = horn.
  megaphone(b, p) {
    const col = p.color || "#e2483c";
    const inner = mix(col, "#2a2d33", 0.45);
    const body = "#ecebe7";
    const cy = 0.09, z0 = -0.07, L = 0.236;
    const prof = smoothProfile([[0.036, 0], [0.04, 0.06], [0.05, 0.12], [0.066, 0.172], [0.079, 0.212], [0.084, L]], 14);
    b.group({ at: [0, cy, z0], rot: [PI / 2, 0, 0] }, () => {
      b.lathe(prof, { color: col, kind: "gloss", seg: 28 });
      b.lathe(prof.slice().reverse().map(([rr, y]) => [Math.max(0, rr - 0.004), y]), { color: inner, seg: 28 });
      b.torus(0.0838, 0.0065, { at: [0, L, 0], rot: [PI / 2, 0, 0], color: C.white, kind: "gloss", seg: 32, tubeSeg: 8 });
      // speaker grille: a dark disc with silver rings and a cap, set into the throat
      const gy = 0.08, gr = 0.041;
      b.cyl(gr, gr, 0.006, { at: [0, gy, 0], color: "#24272d", seg: 22 });
      for (const rr of [0.014, 0.025, 0.035]) b.torus(rr, 0.0022, { at: [0, gy + 0.003, 0], rot: [PI / 2, 0, 0], color: "#9aa1ab", kind: "metal", seg: 20, tubeSeg: 4 });
      b.sphere(0.008, { at: [0, gy + 0.004, 0], scale: [1, 0.6, 1], color: "#c9cfd6", kind: "metal", seg: 10 });
    });
    b.cyl(0.044, 0.044, 0.1, { at: [0, cy, -0.12], rot: [PI / 2, 0, 0], color: body, kind: "gloss", seg: 22 });
    b.sphere(0.044, { at: [0, cy, -0.17], scale: [1, 1, 0.45], color: body, kind: "gloss", seg: 18 });
    b.torus(0.042, 0.0065, { at: [0, cy, -0.07], color: shade(col, -0.15), seg: 24, tubeSeg: 6 });
    b.box(0.03, 0.068, 0.038, { at: [0, 0.036, -0.13], rot: [0.3, 0, 0], color: "#33363d", r: 0.012 });
    b.box(0.012, 0.022, 0.014, { at: [0, 0.042, -0.098], color: "#ffcd4a", kind: "gloss", r: 0.004, seg: 1 });
    b.cyl(0.01, 0.01, 0.008, { at: [0, cy + 0.045, -0.12], color: "#ffcd4a", kind: "gloss", seg: 12 });
  },

  // A casino slot machine: red cabinet with gold trim, an arched topper ringed with bulbs around a star, three
  // backlit reels showing the text (one word or character per reel, or the whole text across them; '7 7 7'
  // by default), a button deck, a coin tray and a pull lever. color = cabinet.
  slot_machine(b, p) {
    const body = p.color || "#c8303c";
    const dark = shade(body, -0.15);
    const gold = { color: C.gold, kind: "metal" };
    const r = randomFor(b, p);
    const W = 0.44, D = 0.3, bz = -0.06, front = bz + D / 2, Hc = 0.78;
    b.box(W + 0.02, 0.05, D + 0.02, { at: [0, 0.025, bz], color: shade(body, -0.28), r: 0.01 });
    b.box(W, Hc - 0.05, D, { at: [0, 0.05 + (Hc - 0.05) / 2, bz], color: body, r: 0.02 });
    b.mirrorX(() => {
      b.box(0.014, Hc - 0.06, 0.014, { at: [W / 2 - 0.004, 0.05 + (Hc - 0.05) / 2, front - 0.004], ...gold, r: 0.004, seg: 1 });
      // side panel: a darker inset framed in gold
      b.box(0.008, 0.5, 0.22, { at: [W / 2 + 0.002, 0.43, bz - 0.01], ...gold, r: 0.003, seg: 1 });
      b.box(0.01, 0.48, 0.2, { at: [W / 2 + 0.003, 0.43, bz - 0.01], color: dark, r: 0.004, seg: 1 });
    });
    // lower door panel with a gold frame and a star
    b.box(0.34, 0.2, 0.012, { at: [0, 0.235, front + 0.004], ...gold, r: 0.004, seg: 1 });
    b.box(0.32, 0.18, 0.016, { at: [0, 0.235, front + 0.006], color: dark, r: 0.006, seg: 1 });
    const star = [];
    for (let i = 0; i < 10; i++) {
      const a = PI / 2 + (i * PI) / 5, rr = i % 2 ? 0.026 : 0.062;
      star.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    b.extrude(star, 0.008, { at: [0, 0.235, front + 0.018], color: "#ffd34d", kind: "gloss", bevel: 0.003 });
    // coin tray with coins
    b.box(0.3, 0.03, 0.08, { at: [0, 0.085, front + 0.035], color: "#c9cfd6", kind: "metal", r: 0.01 });
    b.box(0.27, 0.004, 0.06, { at: [0, 0.1, front + 0.04], color: "#4a4f58", r: 0 });
    for (let i = 0; i < 5; i++) {
      b.cyl(0.017, 0.017, 0.005, { at: [-0.1 + i * 0.05 + r.range(-0.01, 0.01), 0.104 + (i % 2) * 0.002, front + 0.03 + r.range(0, 0.02)],
        rot: [r.range(-0.2, 0.2), 0, r.range(-0.2, 0.2)], ...gold, seg: 14 });
    }
    b.box(0.1, 0.02, 0.004, { at: [0, 0.132, front + 0.002], color: "#1d2026", r: 0 });
    // button deck: a sloping shelf with glowing buttons and a coin slot
    b.group({ at: [0, 0.375, front + 0.035], rot: [0.28, 0, 0] }, () => {
      b.box(W - 0.02, 0.03, 0.08, { color: shade(body, -0.06), r: 0.01 });
      ["#ff5a48", "#ffd34d", "#5ed36b", "#5cb6ff"].forEach((c, i) => {
        b.cyl(0.016, 0.017, 0.012, { at: [-0.15 + i * 0.065, 0.019, 0.005], color: c, ...GLOW, seg: 16 });
      });
      b.box(0.04, 0.012, 0.05, { at: [0.165, 0.02, 0], color: "#c9cfd6", kind: "metal", r: 0.004, seg: 1 });
      b.box(0.004, 0.004, 0.03, { at: [0.165, 0.026, 0], color: "#1d2026", r: 0 });
    });
    // reel window: a deep gold frame, dark backing and three backlit reels
    const wy = 0.545, WW = 0.36, WH = 0.21, fd = 0.06;
    b.box(WW + 0.05, 0.025, fd, { at: [0, wy + WH / 2 + 0.0125, front + fd / 2 - 0.004], ...gold, r: 0.006, seg: 1 });
    b.box(WW + 0.05, 0.025, fd, { at: [0, wy - WH / 2 - 0.0125, front + fd / 2 - 0.004], ...gold, r: 0.006, seg: 1 });
    b.mirrorX(() => b.box(0.025, WH, fd, { at: [WW / 2 + 0.0125, wy, front + fd / 2 - 0.004], ...gold, r: 0.006, seg: 1 }));
    b.box(WW, WH, 0.004, { at: [0, wy, front + 0.001], color: "#1a1c22", r: 0 });
    const RR = 0.1, rz = front + 0.05 - RR, rw = 0.108, rg = (WW - 3 * rw) / 4;
    const xs = [-1, 0, 1].map((k) => k * (rw + rg));
    for (const x of xs) {
      b.cyl(RR, RR, rw, { at: [x, wy, rz], rot: [0, 0, PI / 2], color: "#fff3dc", ...GLOW, seg: 28 });
      // hints of the symbols above and below the pay line
      for (const s of [-1, 1]) {
        const a = s * 0.62, py = wy + Math.sin(a) * (RR + 0.001), pz = rz + Math.cos(a) * (RR + 0.001);
        b.box(rw * 0.5, 0.022, 0.004, { at: [x, py, pz], rot: [-a, 0, 0], color: s > 0 ? "#2a2d33" : "#d63a3a", ...GLOW, r: 0 });
      }
    }
    // pay-line markers
    b.mirrorX(() => b.extrude([[0, 0.012], [0, -0.012], [-0.016, 0]], 0.006, { at: [WW / 2 - 0.002, wy, front + 0.052], color: "#ff4d3d", ...GLOW, bevel: 0 }));
    const fg = "#c81e2e";
    const str = textOf(b, p.text).trim();
    let parts = null;
    if (!str) parts = ["7", "7", "7"];
    else if (str.includes("|")) parts = str.split("|").map((s) => s.trim()).slice(0, 3);
    else if (str.split(/\s+/).length === 3) parts = str.split(/\s+/);
    else if (Array.from(str).length <= 3 && !/\s/.test(str)) parts = Array.from(str);
    if (parts && parts.length === 1) parts = [parts[0], parts[0], parts[0]];
    if (parts && parts.length === 3) {
      parts.forEach((s, i) => b.text(s, { at: [xs[i], wy, rz + RR + 0.004], w: rw * 0.96, h: 0.11, fg, font: "body", weight: "800", glow: true }));
    } else {
      b.text(parts ? parts.join(" ") : str, { at: [0, wy, rz + RR + 0.004], w: WW * 0.94, h: 0.11, fg, font: "body", weight: "800", glow: true });
    }
    // arched topper with a glowing marquee, a star and a ring of bulbs
    const arch = (w, k) => {
      const pts = [[-w, 0], [w, 0]];
      const cyA = -0.13 * k, RA = Math.hypot(w, 0.074 * k - cyA);
      const a0 = Math.atan2(0.074 * k - cyA, w);
      for (let i = 0; i <= 14; i++) {
        const a = a0 + ((PI - 2 * a0) * i) / 14;
        pts.push([Math.cos(a) * RA, cyA + Math.sin(a) * RA]);
      }
      return pts;
    };
    b.extrude(arch(0.22, 1), 0.1, { at: [0, Hc, front - 0.05], color: body, bevel: 0.008 });
    b.extrude(arch(0.18, 0.78), 0.006, { at: [0, Hc + 0.014, front + 0.006], color: "#ffcf3f", ...GLOW, bevel: 0 });
    b.extrude(star.map(([x, y]) => [x * 0.75, y * 0.75]), 0.008, { at: [0, Hc + 0.07, front + 0.012], color: "#ff4d3d", kind: "gloss", bevel: 0.002 });
    for (let i = 0; i <= 12; i++) {
      const a = 0.32 + ((PI - 0.64) * i) / 12, RA = 0.296;
      b.sphere(0.011, { at: [Math.cos(a) * RA * 0.73, Hc - 0.12 + Math.sin(a) * RA, front + 0.008], color: i % 2 ? "#fff6c8" : "#ffd34d", ...GLOW, seg: 8 });
    }
    // pull lever on the right side
    const lx = W / 2 + 0.012, ly = 0.5, lz = bz + 0.04;
    b.cyl(0.032, 0.032, 0.03, { at: [lx, ly, lz], rot: [0, 0, PI / 2], color: "#c9cfd6", kind: "metal", seg: 18 });
    b.rod([lx + 0.012, ly, lz], [lx + 0.03, 0.77, lz - 0.02], 0.009, { color: "#dfe3e8", kind: "metal", seg: 10 });
    b.sphere(0.034, { at: [lx + 0.031, 0.79, lz - 0.021], color: "#e2483c", kind: "gloss", seg: 16 });
  },

  // A vending machine: cabinet with a glass window over four shelves of drinks and snacks against a lit back
  // wall, a control column with a price display, keypad, coin and note slots, and a pickup flap. color = cabinet.
  vending_machine(b, p) {
    const body = p.color || "#2f7fc0";
    const dark = shade(body, -0.15);
    const r = randomFor(b, p);
    const W = 0.5, H = 0.975, D = 0.39, bz = -0.03, y0 = 0.025;
    const front = bz + D / 2;
    for (const x of [-1, 1]) for (const z of [-1, 1]) b.box(0.05, y0 + 0.004, 0.05, { at: [x * (W / 2 - 0.05), (y0 + 0.004) / 2, bz + z * (D / 2 - 0.05)], color: RUBBER, r: 0.006, seg: 1 });
    b.box(W, H, D, { at: [0, y0 + H / 2, bz], color: body, r: 0.02 });
    b.mirrorX(() => b.box(0.006, H - 0.16, D - 0.1, { at: [W / 2 + 0.001, y0 + H / 2 + 0.02, bz - 0.01], color: shade(body, 0.06), r: 0.003, seg: 1 }));
    // header panel
    slab(b, W - 0.05, 0.05, 0.006, 0.01, { at: [0, y0 + H - 0.04, front + 0.002], color: "#fff4cf", ...GLOW, bevel: 0 });
    b.box(0.14, 0.018, 0.002, { at: [-0.09, y0 + H - 0.04, front + 0.0055], rot: [0, 0, 0.12], color: "#ff6b5e", ...GLOW, r: 0 });
    b.box(0.14, 0.018, 0.002, { at: [0.06, y0 + H - 0.04, front + 0.0055], rot: [0, 0, -0.12], color: "#ffb43a", ...GLOW, r: 0 });
    // the display case: lit back wall, shelves with goods, glass, frame
    const wx0 = -0.228, wx1 = 0.098, wy0 = 0.33, wy1 = 0.9;
    const ww = wx1 - wx0, wh = wy1 - wy0, wcx = (wx0 + wx1) / 2, wcy = (wy0 + wy1) / 2, cd = 0.055;
    b.box(ww, wh, 0.004, { at: [wcx, wcy, front + 0.002], color: "#e6f3fb", ...GLOW, r: 0 });
    const shelfY = [wy0 + 0.012, wy0 + 0.152, wy0 + 0.292, wy0 + 0.432];
    const goods = ["#e2483c", "#ffb43a", "#3fae4a", "#5b84ff", "#a07bff", "#ff7eb6", "#2f9a95", "#f0c64a"];
    shelfY.forEach((sy, k) => {
      b.box(ww - 0.01, 0.008, cd - 0.006, { at: [wcx, sy, front + cd / 2], color: "#b8c0c8", kind: "metal", r: 0 });
      b.box(ww - 0.01, 0.012, 0.003, { at: [wcx, sy - 0.002, front + cd - 0.004], color: "#f6f6f2", r: 0 });
      const n = 4;
      for (let i = 0; i < n; i++) {
        const x = wx0 + (ww / n) * (i + 0.5), c = r.pick(goods), base = sy + 0.004;
        const z = front + cd / 2;
        if (k === 0) { // bottles
          b.cyl(0.02, 0.02, 0.07, { at: [x, base + 0.035, z], color: c, kind: "gloss", seg: 12 });
          b.cyl(0.0205, 0.0205, 0.025, { at: [x, base + 0.04, z], color: "#f6f4ee", seg: 12 });
          b.cyl(0.008, 0.02, 0.03, { at: [x, base + 0.085, z], color: c, kind: "gloss", seg: 12 });
          b.cyl(0.009, 0.009, 0.012, { at: [x, base + 0.106, z], color: "#f6f4ee", seg: 10 });
        } else if (k === 1 || k === 3) { // cans
          b.cyl(0.023, 0.023, 0.08, { at: [x, base + 0.04, z], color: c, kind: "gloss", seg: 14 });
          b.cyl(0.0232, 0.0232, 0.02, { at: [x, base + 0.045, z], color: "#f6f4ee", seg: 14 });
          b.cyl(0.02, 0.023, 0.006, { at: [x, base + 0.083, z], color: "#c8ccd2", kind: "metal", seg: 14 });
        } else { // snack bags
          b.box(0.058, 0.085, 0.024, { at: [x, base + 0.044, z], rot: [-0.08, 0, r.range(-0.06, 0.06)], color: c, kind: "gloss", r: 0.008, seg: 1 });
          b.box(0.03, 0.026, 0.002, { at: [x, base + 0.048, z + 0.012], color: "#fff8e8", r: 0 });
        }
      }
    });
    // the glass is only hinted by a few highlights, so the goods behind it keep their colours
    for (const [dx, dy, len] of [[-0.07, 0.15, 0.2], [-0.01, 0.17, 0.12], [0.05, -0.2, 0.08]]) {
      b.box(0.011, len, 0.002, { at: [wcx + dx, wcy + dy, front + cd + 0.002], rot: [0, 0, -0.55], color: "#ffffff", ...GLOW, r: 0 });
    }
    const fr = 0.016, frc = { color: "#3a3f48", r: 0.004, seg: 1 };
    b.box(ww + 2 * fr, fr, cd + 0.004, { at: [wcx, wy1 + fr / 2, front + cd / 2], ...frc });
    b.box(ww + 2 * fr, fr, cd + 0.004, { at: [wcx, wy0 - fr / 2, front + cd / 2], ...frc });
    for (const x of [wx0 - fr / 2, wx1 + fr / 2]) b.box(fr, wh, cd + 0.004, { at: [x, wcy, front + cd / 2], ...frc });
    // control column
    const cx = (wx1 + fr + W / 2) / 2 - 0.004;
    slab(b, 0.1, 0.05, 0.006, 0.006, { at: [cx, 0.84, front + 0.003], color: BEZEL, kind: "gloss", bevel: 0.001 });
    slab(b, 0.086, 0.036, 0.002, 0.004, { at: [cx, 0.84, front + 0.0065], color: "#1c4a3c", ...GLOW, bevel: 0 });
    b.text("1.50", { at: [cx, 0.84, front + 0.009], w: 0.08, h: 0.034, fg: "#7dffb0", font: "mono", glow: true });
    for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) {
      b.box(0.024, 0.02, 0.008, { at: [cx - 0.03 + i * 0.03, 0.77 - j * 0.028, front + 0.004], color: "#e8ebef", kind: "gloss", r: 0.004, seg: 1 });
    }
    b.box(0.05, 0.07, 0.01, { at: [cx - 0.02, 0.6, front + 0.005], color: "#c9cfd6", kind: "metal", r: 0.006, seg: 1 });
    b.box(0.006, 0.034, 0.004, { at: [cx - 0.02, 0.6, front + 0.0105], color: "#16181d", r: 0 });
    dot(b, [cx + 0.03, 0.6, front + 0.004], 0.011, 0.008, { color: "#d8dde3", kind: "metal" });
    b.box(0.08, 0.04, 0.008, { at: [cx, 0.52, front + 0.004], color: "#25282e", r: 0.004, seg: 1 });
    b.box(0.06, 0.004, 0.002, { at: [cx, 0.52, front + 0.0085], color: "#5df07f", ...GLOW, r: 0 });
    b.box(0.06, 0.05, 0.03, { at: [cx, 0.4, front + 0.012], color: "#c9cfd6", kind: "metal", r: 0.008, seg: 1 });
    b.box(0.045, 0.03, 0.004, { at: [cx, 0.4, front + 0.027], color: "#1d2026", r: 0 });
    // pickup flap at the bottom
    b.box(0.32, 0.12, 0.006, { at: [wcx, 0.17, front + 0.002], color: "#1d2026", r: 0.006, seg: 1 });
    b.box(0.3, 0.1, 0.006, { at: [wcx, 0.172, front + 0.006], rot: [-0.08, 0, 0], color: "#3a3f48", kind: "gloss", r: 0.006, seg: 1 });
    b.box(0.12, 0.008, 0.006, { at: [wcx, 0.2, front + 0.011], color: "#9aa3ad", kind: "metal", r: 0.002, seg: 1 });
    b.box(W - 0.04, 0.012, 0.004, { at: [0, 0.07, front + 0.002], color: dark, r: 0 });
  },

  // A stage spotlight: a black lamp can with barn doors in a U-yoke on a tripod stand, aimed up and forward;
  // its glowing lens throws a translucent yellow beam that fades out. color = lamp.
  spotlight(b, p) {
    const can = p.color || "#2b2e35";
    const steel = { color: "#9aa3ad", kind: "metal" };
    const beam = "#ffd84a";
    const zc = -0.055, hub = 0.17, py = 0.36, R = 0.062, Lc = 0.15, e = 0.62;
    const yokeY = py - 0.112; // below the swing of the can's back end
    // tripod with spreaders, and the column up to the yoke
    for (const a of [-PI / 2, PI / 6, (5 * PI) / 6]) {
      const fx = Math.cos(a) * 0.1, fz = zc + Math.sin(a) * 0.1;
      b.rod([0, hub, zc], [fx, 0.012, fz], 0.0075, { ...steel, seg: 8 });
      b.sphere(0.013, { at: [fx, 0.008, fz], scale: [1, 0.6, 1], color: RUBBER, seg: 10 });
      const t = 0.55;
      b.rod([0, 0.09, zc], [fx * t, hub + (0.012 - hub) * t, zc + (fz - zc) * t], 0.0045, { ...steel, seg: 6 });
    }
    b.cyl(0.018, 0.018, 0.03, { at: [0, hub, zc], color: "#3a3d44", seg: 12 });
    b.cyl(0.008, 0.008, hub - 0.07, { at: [0, (hub + 0.07) / 2, zc], ...steel, seg: 8 });
    b.cyl(0.011, 0.011, yokeY - hub, { at: [0, (hub + yokeY) / 2, zc], ...steel, seg: 10 });
    b.cyl(0.016, 0.016, 0.02, { at: [0, yokeY - 0.015, zc], color: "#3a3d44", seg: 12 });
    // U-yoke with pivot knobs, panned towards the front right so the beam shows from the front
    const pan = 0.85;
    b.group({ at: [0, 0, zc], rot: [0, pan, 0] }, () => {
      b.box(0.178, 0.016, 0.03, { at: [0, yokeY, 0], color: can, r: 0.006 });
      b.mirrorX(() => {
        b.box(0.014, py - yokeY + 0.012, 0.03, { at: [0.082, (py + yokeY) / 2, 0], color: can, r: 0.005, seg: 1 });
        b.cyl(0.016, 0.016, 0.02, { at: [0.092, py, 0], rot: [0, 0, PI / 2], color: "#c9cfd6", kind: "metal", seg: 14 });
      });
      // the lamp can, tilted e above the horizon (local +y is the beam direction)
      b.group({ at: [0, py, 0], rot: [PI / 2 - e, 0, 0] }, () => {
        b.cyl(R, R, Lc, { color: can, seg: 24 });
        for (let i = 0; i < 4; i++) b.cyl(R + 0.005, R + 0.005, 0.008, { at: [0, -Lc / 2 + 0.018 + i * 0.016, 0], color: shade(can, 0.06), seg: 24 });
        b.cyl(R * 0.7, R * 0.85, 0.02, { at: [0, -Lc / 2 - 0.008, 0], color: shade(can, 0.04), seg: 20 });
        b.torus(0.024, 0.005, { at: [0, 0.0, -R - 0.012], rot: [0, PI / 2, 0], color: shade(can, 0.1), seg: 12, tubeSeg: 5, arc: PI });
        ring(b, R - 0.012, R + 0.004, Lc / 2 - 0.004, Lc / 2 + 0.01, { color: shade(can, -0.05), seg: 24 });
        b.cyl(R - 0.01, R - 0.01, 0.004, { at: [0, Lc / 2 + 0.004, 0], color: "#fff7d6", kind: "glow", seg: 24 });
        // barn doors, opened wider than the beam
        const yE = Lc / 2 + 0.01, phi = 0.62;
        for (const s of [-1, 1]) {
          const len = 0.055;
          b.box(2 * R * 0.95, len, 0.004, { at: [0, yE + (Math.cos(phi) * len) / 2, s * (R + 0.002 + (Math.sin(phi) * len) / 2)],
            rot: [s * phi, 0, 0], color: can, r: 0 });
        }
        for (const s of [-1, 1]) {
          const len = 0.045;
          b.box(0.004, len, 2 * R * 0.75, { at: [s * (R + 0.002 + (Math.sin(phi) * len) / 2), yE + (Math.cos(phi) * len) / 2, 0],
            rot: [0, 0, -s * phi], color: can, r: 0 });
        }
        // beam: nested open cones, denser near the lens so it fades out
        const L0 = Lc / 2 + 0.006, Lb = 0.15;
        for (const [k, sc] of [[1, 1], [0.66, 0.84], [0.36, 0.68]]) {
          const len = Lb * k, r0 = (R - 0.012) * sc, r1 = r0 + len * 0.5;
          b.cyl(r1, r0, len, { at: [0, L0 + len / 2, 0], color: beam, kind: "glass", open: true, seg: 24 });
        }
      });
    });
  },
};
