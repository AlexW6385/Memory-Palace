// Props in the "places" group. Each entry: name: (b, p) => void — see kit.js and docs/props.md.
// b is a Builder (metres, base on y = 0, facing +z); p holds the item's params:
//   { variant, color, color2, text, emoji, pose, hat, hold, seed }
//
// Style: chunky toy buildings and vehicles. Masonry is a smooth core with a scatter of proud, chamfered
// stones; roofs carry overlapping tile courses; vehicles face +z and have round, friendly lamps.
// `color` always tints the main body (stone, walls, paint, hull, canvas).
import * as THREE from "three";
import { C, shade, mix, rng } from "./kit.js";

const PI = Math.PI;
const TAU = 2 * PI;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

const STONE = "#cbc2b0"; // warm light masonry
const SLATE = "#4f6fae"; // blue roof slates of towers
const TILE = "#c4553f"; // terracotta roof tiles
const FLAG = "#d6453a";
const DARK = "#2b2724"; // doorways and arrow slits
const GLASS = "#8fbfdf"; // daylight window glass (gloss)
const IRON = "#3b3b40";
const ROPE = "#d9c59b";
const LAMP = "#ffd25a"; // lit lamp glass (glow is tone-mapped, so it must stay saturated)
const TRIM = "#fbf8f1";
const TYRE = "#2b2c31";
const METAL = { color: "#c9ced5", kind: "metal" };
const GOLD = { color: C.gold, kind: "metal" };
const BRASS = { color: C.brass, kind: "metal" };
const FIRE = ["#ff7a2a", "#ffb43a", "#fff1a8"];

// ── small helpers ────────────────────────────────────────────────────────────

/** The string of a text param (a string or { en, zh }) in the builder's language. */
function textOf(b, t) {
  if (t == null) return "";
  if (typeof t === "string") return t;
  return String(t[b.env.lang || "en"] ?? t.en ?? "");
}

/** Seeded random numbers for a prop: from its own seed when it has one, so it looks the same in any scene. */
function randomFor(b, p, salt = 0) {
  return p.seed != null ? rng(p.seed * 97 + 13 + salt * 7919) : b.rng;
}

/** Relative luminance of a colour (0 = black … 1 = white). */
function lum(c) {
  const col = new THREE.Color(c);
  return 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b;
}

/** Smallest angle between two directions (radians). */
const angDist = (a, c) => Math.abs(((((a - c + PI) % TAU) + TAU) % TAU) - PI);

/** Euler rotation (with order "YXZ") that turns local +z towards the direction d. */
function towards(d) {
  const l = Math.hypot(d[0], d[1], d[2]) || 1;
  return { rot: [Math.asin(clamp(-d[1] / l, -1, 1)), Math.atan2(d[0], d[2]), 0], order: "YXZ" };
}

/** A crisp chamfered block w × h × d centred at o.at: an extruded rectangle (28 triangles, faceted). */
function block(b, w, h, d, o = {}) {
  const m = Math.min(w, h, d);
  const s = clamp(o.bevel ?? m * 0.16, 0.0005, m * 0.45);
  const hw = w / 2 - s, hh = h / 2 - s;
  return b.extrude([[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]], Math.max(0.0002, d - 2 * s),
    { ...o, bevel: s, curveSeg: 1 });
}

/** Points on a circular arc around (cx, cy) from angle a0 to a1 (0 = +x, counter-clockwise), ends included. */
function arcPts(cx, cy, r, a0, a1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

/** Outline of a round-topped opening (door, window) w wide and h tall, standing on y = 0. */
function archOutline(w, h, n = 10) {
  const r = w / 2, ys = Math.max(0.001, h - r);
  return [[-r, 0], [r, 0], ...arcPts(0, ys, r, 0, PI, n)];
}

/** Outline of a rectangle w × h standing on y = 0. */
const rectOutline = (w, h) => [[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]];

/** Outline of a pointed (Gothic) arch: half-width a, sides from y0 up to ys, arcs of radius R meeting above. */
function gothicOutline(a, y0, ys, R, n = 10) {
  const cx = a - R; // the right-hand arc is centred left of the middle
  const top = Math.acos(-cx / R);
  const right = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * top;
    right.push([cx + R * Math.cos(t), ys + R * Math.sin(t)]);
  }
  const left = right.slice(0, -1).reverse().map(([x, y]) => [-x, y]);
  return [[-a, y0], [a, y0], ...right, ...left];
}

/** A flat ring (annulus) shape for extrusion. */
function ringShape(R, r) {
  const s = new THREE.Shape();
  s.absarc(0, 0, R, 0, TAU, false);
  const h = new THREE.Path();
  h.absarc(0, 0, r, 0, TAU, true);
  s.holes.push(h);
  return s;
}

/** A filled circle shape. */
function circleShape(r) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, 0, TAU, false);
  return s;
}

/**
 * Smooth grid surface from fn(u, v) -> [x, y, z], u and v in [0, 1]. It faces along du × dv
 * (flip reverses that).
 */
function gridGeo(nu, nv, fn, flip = false) {
  const pos = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) pos.push(...fn(i / nu, j / nv));
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b1 = a + 1, c = a + nu + 1, d = c + 1;
      if (flip) idx.push(a, c, b1, b1, c, d);
      else idx.push(a, b1, c, b1, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A thin two-sided sheet (cloth, sails, flags): the same surface with both windings. */
function sheet(b, nu, nv, fn, o = {}) {
  b.geo(gridGeo(nu, nv, fn, false), o);
  b.geo(gridGeo(nu, nv, fn, true), { ...o, color: o.back ?? o.color, light: false });
}

/** Clip the line p0 + t·d to a convex polygon; returns [t0, t1] or null. */
function clipToConvex(poly, p0, d) {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
    area += x1 * y2 - x2 * y1;
  }
  const s = area > 0 ? 1 : -1;
  let t0 = -1e9, t1 = 1e9;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
    const nx = s * (by - ay), ny = -s * (bx - ax);
    const num = (ax - p0[0]) * nx + (ay - p0[1]) * ny;
    const den = d[0] * nx + d[1] * ny;
    if (Math.abs(den) < 1e-12) {
      if (num < 0) return null;
      continue;
    }
    if (den > 0) t1 = Math.min(t1, num / den);
    else t0 = Math.max(t0, num / den);
  }
  return t0 < t1 ? [t0, t1] : null;
}

// ── flags and fire ───────────────────────────────────────────────────────────

/** A waving flag with its hoist on the local y axis, flying towards +x (tri = a pointed pennant). */
function flagCloth(b, w, h, o = {}) {
  sheet(b, 8, 1, (u, v) => {
    const half = o.tri ? (1 - u * 0.9) * (h / 2) : h / 2;
    return [u * w, (v - 0.5) * 2 * half - 0.12 * h * u * u, Math.sin(u * PI * 1.7) * 0.16 * h * u];
  }, { color: o.color });
}

/** A flag pole at (x, z) from y0 to y1 with a gold knob and a flag near the top. */
function flagPole(b, x, z, y0, y1, color, o = {}) {
  const r = o.r ?? 0.006;
  b.cyl(r, r * 1.15, y1 - y0, { at: [x, (y0 + y1) / 2, z], color: o.pole ?? "#6b5a48", seg: 6 });
  b.sphere(r * 1.8, { at: [x, y1 + r, z], ...GOLD, seg: 8 });
  const w = o.w ?? 0.1, h = o.h ?? 0.065;
  b.group({ at: [x + r * 0.6, y1 - h / 2 - r * 1.2, z], rot: [0, o.yaw ?? -0.3, 0] }, () =>
    flagCloth(b, w, h, { color, tri: o.tri }));
}

/** A glowing teardrop flame tongue h tall, r wide, standing on `at`. */
function tongue(b, at, h, r, color, o = {}) {
  const pts = [];
  for (let i = 0; i <= 9; i++) {
    const t = i / 9;
    const rr = t < 0.25 ? r * Math.pow(Math.sin((t / 0.25) * (PI / 2)), 0.7) : r * Math.pow((1 - t) / 0.75, 1.25);
    pts.push([rr, t * h]);
  }
  b.lathe(pts, { at, color, kind: "glow", seg: o.seg ?? 10, light: o.light ?? false });
}

/** A layered flame (outer, middle, pale core stepping towards the viewer) at `at`, leaning by o.rot. */
function fire(b, at, h, r, o = {}) {
  b.group({ at, rot: o.rot || [0, 0, 0] }, () => {
    tongue(b, [0, 0, 0], h, r, FIRE[0], { light: o.light });
    tongue(b, [0, h * 0.02, r * 0.35], h * 0.72, r * 0.7, FIRE[1]);
    tongue(b, [0, h * 0.04, r * 0.62], h * 0.46, r * 0.42, FIRE[2]);
  });
}

// ── masonry ──────────────────────────────────────────────────────────────────

/**
 * Proud stones in courses over a flat wall face (the plane z = 0 facing +z in the current frame), x from x0
 * to x1 and y from y0 to y1; keep(x, y, w, h) may veto a spot (openings, trims).
 */
function wallStones(b, R, o) {
  const { x0, x1, y0, y1, color } = o;
  const ch = o.course ?? 0.055, fill = o.fill ?? 0.3, d = o.depth ?? 0.014;
  let row = 0;
  for (let y = y0 + ch / 2; y < y1 - ch * 0.3; y += ch, row++) {
    let x = x0 + R() * 0.04 + (row % 2) * 0.025;
    for (;;) {
      const w = lerp(o.wmin ?? 0.055, o.wmax ?? 0.1, R());
      if (x + w > x1) break;
      const cx = x + w / 2;
      if (R() < fill && (!o.keep || o.keep(cx, y, w, ch))) {
        block(b, w - 0.008, ch - 0.01, d, { at: [cx, y, d / 2 - 0.004], color: shade(color, (R() - 0.5) * 0.09),
          bevel: 0.003 });
      }
      x += w;
    }
  }
}

/** Proud stones in courses round a tower of radius rAt(y); skip(angle, y) vetoes openings. */
function towerStones(b, R, o) {
  const { rAt, y0, y1, color } = o;
  const ch = o.course ?? 0.06, fill = o.fill ?? 0.28, d = o.depth ?? 0.016;
  let row = 0;
  for (let y = y0 + ch / 2; y < y1 - ch * 0.3; y += ch, row++) {
    const r = rAt(y);
    let a = R() * 0.3 + row * 0.7;
    const end = a + TAU - 0.04;
    for (;;) {
      const w = lerp(o.wmin ?? 0.06, o.wmax ?? 0.1, R());
      const da = w / r;
      if (a + da > end) break;
      const am = a + da / 2;
      const norm = ((am % TAU) + TAU) % TAU;
      if (R() < fill && !(o.skip && o.skip(norm, y))) {
        b.group({ at: [Math.sin(am) * r, y, Math.cos(am) * r], rot: [0, am, 0] }, () =>
          block(b, w - 0.008, ch - 0.01, d, { at: [0, 0, d / 2 - 0.006], color: shade(color, (R() - 0.5) * 0.09),
            bevel: 0.003 }));
      }
      a += da;
    }
  }
}

/** Merlons round a circular parapet: n of them at radius r, bottom at y. */
function merlonRing(b, r, y, n, h, w, d, color, phase = 0) {
  for (let k = 0; k < n; k++) {
    const a = ((k + 0.5) / n) * TAU + phase;
    b.group({ at: [Math.sin(a) * r, y + h / 2, Math.cos(a) * r], rot: [0, a, 0] }, () =>
      block(b, w, h, d, { color, bevel: Math.min(0.006, w * 0.12) }));
  }
}

/** A row of merlons spanning x0..x1 (starting and ending with a merlon), bottom at y, centred on depth z. */
function merlonRow(b, x0, x1, y, z, o) {
  const L = x1 - x0, mw = o.w ?? 0.06;
  const n = Math.max(1, Math.round((L + mw) / (2 * mw)));
  const w = L / (2 * n - 1);
  for (let k = 0; k < n; k++) {
    block(b, w, o.h, o.d, { at: [x0 + (2 * k + 0.5) * w, y + o.h / 2, z], color: o.color,
      bevel: Math.min(0.006, w * 0.12) });
  }
}

/** Merlons along all four edges of a rectangular roof (centre cx, cz; w × d) at height y. */
function merlonBox(b, cx, cz, w, d, y, o) {
  const e = o.d / 2;
  merlonRow(b, cx - w / 2, cx + w / 2, y, cz + d / 2 - e, o);
  merlonRow(b, cx - w / 2, cx + w / 2, y, cz - d / 2 + e, o);
  for (const s of [-1, 1]) {
    b.group({ at: [cx + s * (w / 2 - e), 0, cz], rot: [0, PI / 2, 0] }, () =>
      merlonRow(b, -d / 2 + o.d * 1.6, d / 2 - o.d * 1.6, y, 0, o));
  }
}

/**
 * A pitched roof whose ridge runs along z at height yr over x = 0: two slabs t thick falling at angle a
 * towards ±x for a horizontal run, len long, carrying overlapping tile courses and a round ridge cap.
 */
function gableRoof(b, o) {
  const { yr, run, a, len, t, color } = o;
  const ca = Math.cos(a), sa = Math.sin(a);
  const L = run / ca + 0.012;
  const n = o.courses ?? 4;
  const along = (s, up) => [s * ca + up * sa, yr - s * sa + up * ca]; // s down the slope, up off the slab
  b.mirrorX(() => {
    const [cx, cy] = along(L / 2 - 0.012, t / 2);
    b.box(L, t, len, { at: [cx, cy, 0], rot: [0, 0, -a], color, r: Math.min(0.01, t * 0.3), seg: 1 });
    const step = (L - 0.04) / n;
    for (let k = 0; k < n; k++) {
      const [x, y] = along(0.03 + (k + 0.5) * step, t + 0.003);
      block(b, step * 1.06, 0.012, len + 0.006, { at: [x, y, 0], rot: [0, 0, -a + 0.1],
        color: shade(color, k % 2 ? 0.03 : -0.01), bevel: 0.004 });
    }
  });
  b.cyl(t * 0.8, t * 0.8, len + 0.014, { at: [0, yr + t / ca - t * 0.2, 0], rot: [PI / 2, 0, 0],
    color: shade(color, -0.12), seg: 12 });
}

/** A cottage window on a wall face: `at` is the centre on the face, rotY turns it (0 = facing +z). */
function cottageWindow(b, at, rotY, o = {}) {
  b.group({ at, rot: [0, rotY, 0] }, () => {
    block(b, 0.1, 0.12, 0.012, { at: [0, 0, 0.004], color: TRIM, bevel: 0.004 });
    block(b, 0.076, 0.094, 0.01, { at: [0, 0, 0.007], color: GLASS, kind: "gloss", bevel: 0.002 });
    b.box(0.008, 0.094, 0.005, { at: [0, 0, 0.0135], color: TRIM, r: 0 });
    b.box(0.076, 0.008, 0.005, { at: [0, 0, 0.0135], color: TRIM, r: 0 });
    block(b, 0.124, 0.016, 0.03, { at: [0, -0.066, 0.012], color: TRIM, bevel: 0.004 });
    if (o.shutter) {
      for (const s of [-1, 1]) {
        block(b, 0.036, 0.118, 0.01, { at: [s * 0.07, 0, 0.006], color: o.shutter, bevel: 0.003 });
        for (const y of [-0.03, 0, 0.03]) {
          b.box(0.026, 0.004, 0.003, { at: [s * 0.07, y, 0.0115], color: shade(o.shutter, -0.14), r: 0 });
        }
      }
    }
    if (o.flowers) {
      block(b, 0.11, 0.03, 0.034, { at: [0, -0.09, 0.03], color: C.wood, bevel: 0.004 });
      const cols = ["#e8566a", "#f2c84a", "#f08aa8", "#e8566a", "#ffffff"];
      for (let i = 0; i < 5; i++) {
        const x = -0.044 + i * 0.022;
        b.sphere(0.012, { at: [x, -0.068, 0.032], color: C.leaf, seg: 8 });
        b.sphere(0.009, { at: [x + 0.004, -0.06, 0.04], color: cols[i], seg: 8 });
      }
    }
  });
}

/** An opening in a round wall: q = { kind: "door"|"slit"|"window", a (angle from +z), y (centre), w, h }. */
function towerOpening(b, rAt, q, stone) {
  const r = rAt(q.y);
  const gap = r - Math.sqrt(Math.max(0, r * r - (q.w / 2 + 0.03) ** 2)) + 0.004; // how far the wall curves back
  b.group({ at: [Math.sin(q.a) * r, q.y - q.h / 2, Math.cos(q.a) * r], rot: [0, q.a, 0] }, () => {
    const slab = (shape, proud, color, y = 0) =>
      b.extrude(shape, gap + proud - 0.004, { at: [0, y, (proud - gap) / 2], color, bevel: 0.002, curveSeg: 1 });
    if (q.kind === "door") {
      slab(archOutline(q.w + 0.05, q.h + 0.03), 0.008, shade(stone, -0.14), -0.002);
      slab(archOutline(q.w, q.h), 0.016, C.darkWood);
      for (const y of [0.25, 0.62]) b.box(q.w * 0.94, 0.012, 0.006, { at: [0, q.h * y, 0.018], color: IRON, r: 0 });
      b.torus(0.012, 0.0032, { at: [q.w * 0.24, q.h * 0.45, 0.021], ...METAL, seg: 10, tubeSeg: 4 });
    } else if (q.kind === "slit") {
      slab(rectOutline(q.w + 0.032, q.h + 0.032), 0.006, shade(stone, 0.06), -0.016);
      slab(rectOutline(q.w, q.h), 0.009, DARK);
    } else {
      slab(archOutline(q.w + 0.03, q.h + 0.024), 0.006, shade(stone, 0.06), -0.012);
      slab(archOutline(q.w, q.h), 0.009, DARK);
    }
  });
}

/**
 * A round stone tower on y = 0: body radius r0 → r1 up to h, a corbelled crenellated parapet and an optional
 * pointed roof up to o.top (with a flag when o.flag is a colour).
 */
function roundTower(b, R, o) {
  const { r0, r1, h, stone } = o;
  const dark = shade(stone, -0.1);
  const rAt = (y) => lerp(r0, r1, clamp(y / h, 0, 1));
  const seg = o.seg ?? 24;
  b.lathe([[0, 0], [r0 + 0.026, 0], [r0 + 0.026, 0.042], [r0 + 0.02, 0.05], [r0 + 0.004, 0.064], [0, 0.064]],
    { color: dark, seg });
  b.lathe([[0, 0.06], [rAt(0.06), 0.06], [r1, h], [0, h]], { color: stone, seg });
  const open = o.openings || [];
  towerStones(b, R, { rAt, y0: 0.07, y1: h - 0.05, color: stone, fill: o.fill ?? 0.28,
    skip: (a, y) => open.some((q) => angDist(a, q.a) * rAt(y) < q.w / 2 + 0.07 && Math.abs(y - q.y) < q.h / 2 + 0.05) });
  for (const q of open) towerOpening(b, rAt, q, stone);
  const rp = r1 + (o.over ?? 0.045), pw = o.pw ?? 0.04, ph = o.ph ?? 0.085;
  const nC = o.corbels ?? 14;
  for (let k = 0; k < nC; k++) {
    const ang = ((k + 0.5) / nC) * TAU;
    b.group({ at: [Math.sin(ang) * (r1 + 0.014), h - 0.024, Math.cos(ang) * (r1 + 0.014)], rot: [0, ang, 0] }, () =>
      block(b, 0.03, 0.044, 0.048, { color: dark, bevel: 0.005 }));
  }
  b.lathe([[r1 - 0.01, h - 0.01], [rp - 0.004, h - 0.002], [rp, h + 0.004], [rp, h + ph - 0.005], [rp - 0.005, h + ph],
    [rp - pw, h + ph], [rp - pw, h + 0.03], [0, h + 0.03]], { color: stone, seg });
  const nm = o.merlons ?? 8;
  merlonRing(b, rp - pw / 2, h + ph - 0.004, nm, o.mh ?? 0.068, ((TAU * (rp - pw / 2)) / nm) * 0.55, pw + 0.006, stone);
  if (o.roof) {
    const rr = rp - pw - 0.002, yb = h + 0.025, yt = o.top;
    const pts = [[0, yb], [rr, yb]];
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      pts.push([rr * Math.pow(1 - t, 1.25), lerp(yb, yt, t)]);
    }
    b.lathe(pts, { color: o.roof, seg });
    if (o.flag) flagPole(b, 0, 0, yt - 0.03, yt + (o.pole ?? 0.075), o.flag, { w: 0.09, h: 0.055, tri: true });
    else b.sphere(0.014, { at: [0, yt + 0.008, 0], ...GOLD, seg: 8 });
  }
}

/** A straight crenellated curtain wall len long along x, its outer face towards +z. */
function curtain(b, R, len, h, t, stone) {
  block(b, len, h, t, { at: [0, h / 2, 0], color: stone, bevel: 0.008 });
  block(b, len, 0.04, t + 0.018, { at: [0, 0.02, 0], color: shade(stone, -0.1), bevel: 0.006 });
  merlonRow(b, -len / 2, len / 2, h - 0.002, t / 2 - 0.016, { w: 0.05, h: 0.055, d: 0.032, color: stone });
  b.group({ at: [0, 0, t / 2] }, () => wallStones(b, R, { x0: -len / 2 + 0.03, x1: len / 2 - 0.03, y0: 0.05,
    y1: h - 0.02, color: stone, fill: 0.18 }));
}

// ── vehicles ─────────────────────────────────────────────────────────────────

/** A spoked locomotive / carriage wheel on an axle along x, centred at (x, y, z). */
function trainWheel(b, x, y, z, r, color) {
  const s = Math.sign(x) || 1;
  b.cyl(r, r, 0.024, { at: [x, y, z], rot: [0, 0, PI / 2], color, seg: 18 });
  b.cyl(r + 0.007, r + 0.007, 0.01, { at: [x - s * 0.009, y, z], rot: [0, 0, PI / 2], color: "#45474d", seg: 18 });
  b.cyl(r * 0.28, r * 0.28, 0.034, { at: [x + s * 0.004, y, z], rot: [0, 0, PI / 2], ...METAL, seg: 10 });
  for (let k = 0; k < 3; k++) {
    b.box(0.004, r * 1.72, 0.011, { at: [x + s * 0.0125, y, z], rot: [(k * PI) / 3, 0, 0], color: shade(color, 0.14),
      r: 0 });
  }
}

// Boat hull: t runs from the stern (0) to the bow (1); the section angle a runs from -PI/2 (port gunwale)
// through 0 (keel) to PI/2 (starboard gunwale). `inset` shrinks the hull (the inside skin).
const HULL = { z0: -0.37, z1: 0.39, W: 0.15, D: 0.165, top: 0.165, sheer: 0.05, k: 0.6, tm: 0.42, ws: 0.72 };

function hullPt(H, t, a, inset = 0) {
  const z = lerp(H.z0, H.z1, t);
  const wt = t < H.tm ? lerp(H.ws, 1, Math.sin((t / H.tm) * (PI / 2)))
    : Math.pow(Math.max(0, Math.cos(((t - H.tm) / (1 - H.tm)) * (PI / 2))), 0.75);
  const half = Math.max(0, H.W * wt - inset);
  const depth = Math.max(0, hullDepth(H, t) - inset);
  return [half * Math.sin(a), hullTop(H, t) - depth * Math.pow(Math.max(0, Math.cos(a)), H.k), z];
}
const hullTop = (H, t) => H.top + H.sheer * t * t;
const hullDepth = (H, t) => H.D * (t < 0.5 ? 1 : Math.pow(Math.max(0, Math.cos(((t - 0.5) / 0.5) * (PI / 2))), 0.6));
/** Section angle for v in [0, 1], with more samples near the gunwales. */
const hullA = (v) => {
  const s = 2 * v - 1;
  return (PI / 2) * Math.sign(s) * (1 - Math.pow(1 - Math.abs(s), 1.5));
};

/** The hull: outer skin (o.hull), a band of o.band under the gunwales, inner skin, rails and a transom. */
function boatHull(b, H, o) {
  b.geo(gridGeo(18, 12, (u, v) => hullPt(H, u, hullA(v)), true), { color: o.hull });
  b.geo(gridGeo(18, 12, (u, v) => hullPt(H, u, hullA(v), 0.012), false), { color: o.inner });
  const bandH = o.bandH ?? 0.035;
  const aBand = (t) => Math.acos(Math.pow(clamp(bandH / Math.max(1e-4, hullDepth(H, t)), 0, 1), 1 / H.k));
  for (const sg of [-1, 1]) {
    b.geo(gridGeo(18, 2, (u, w) => hullPt(H, u, sg * lerp(PI / 2, aBand(u), w), -0.0025), sg < 0), { color: o.band });
    const rail = [];
    for (let i = 0; i <= 14; i++) rail.push(hullPt(H, i / 14, (sg * PI) / 2, -0.003));
    b.tube(rail, 0.0085, { color: o.rail, seg: 40, radial: 6 });
  }
  const sec = [];
  for (let i = 0; i <= 12; i++) {
    const [x, y] = hullPt(H, 0, -PI / 2 + (i / 12) * PI, -0.003);
    sec.push([x, y]);
  }
  b.extrude(sec, 0.012, { at: [0, 0, H.z0 + 0.007], color: o.transom ?? o.band, bevel: 0.003, curveSeg: 1 });
}

/** Half-width of the inside of the hull at station t, `drop` below the gunwale. */
function hullInnerHalf(H, t, drop) {
  const depth = hullDepth(H, t) - 0.012;
  const a = Math.acos(Math.pow(clamp(drop / Math.max(1e-4, depth), 0, 1), 1 / H.k));
  return hullPt(H, t, a, 0.012)[0];
}

/** A small hanging lantern (glowing glass, dark cap and base) with its ring at `at`. */
function hangingLantern(b, at, s = 1) {
  const [x, y, z] = at;
  b.torus(0.012 * s, 0.0025 * s, { at: [x, y, z], ...METAL, seg: 10, tubeSeg: 4 });
  b.cyl(0, 0.03 * s, 0.022 * s, { at: [x, y - 0.02 * s, z], color: IRON, seg: 6, flat: true });
  b.cyl(0.022 * s, 0.022 * s, 0.045 * s, { at: [x, y - 0.054 * s, z], color: LAMP, kind: "glow", seg: 6, flat: true });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + PI / 6;
    const px = x + Math.sin(a) * 0.023 * s, pz = z + Math.cos(a) * 0.023 * s;
    b.rod([px, y - 0.077 * s, pz], [px, y - 0.031 * s, pz], 0.0025 * s, { color: IRON, seg: 4 });
  }
  b.cyl(0.027 * s, 0.024 * s, 0.01 * s, { at: [x, y - 0.081 * s, z], color: IRON, seg: 6, flat: true });
}

// ── signs and fences ─────────────────────────────────────────────────────────

/** An arrow board on the front of a signpost at height y, pointing dir (+1 right, -1 left). */
function arrowBoard(b, y, dir, str, wood, ink) {
  const L0 = 0.095, L1 = 0.235, h = 0.112, tip = 0.055, notch = 0.028, zc = 0.03 + 0.014;
  const pts = [[-L0, -h / 2], [L1 - tip, -h / 2], [L1, 0], [L1 - tip, h / 2], [-L0, h / 2], [-L0 + notch, 0]];
  b.extrude(pts.map(([x, yy]) => [x * dir, yy]), 0.02, { at: [0, y, zc], color: wood, bevel: 0.004, curveSeg: 1 });
  const zf = zc + 0.014;
  if (str) {
    b.text(str, { at: [dir * 0.064, y, zf + 0.003], w: 0.26, h: 0.088, fg: ink, font: "display" });
  } else {
    // a blank board: two carved grooves
    for (const yy of [-0.022, 0.022]) {
      b.box(0.2, 0.006, 0.004, { at: [dir * 0.07, y + yy, zf], color: shade(wood, -0.2), r: 0 });
    }
  }
}

/** The C-shaped sun visor over a traffic-light lamp, sticking out towards +z from `at`. */
function visor(b, at, color) {
  const s = new THREE.Shape();
  s.absarc(0, 0, 0.057, -0.28, PI + 0.28, false);
  s.absarc(0, 0, 0.05, PI + 0.28, -0.28, true);
  b.extrude(s, 0.05, { at: [at[0], at[1], at[2] + 0.027], color, bevel: 0.002, curveSeg: 8 });
}

// ── market goods ─────────────────────────────────────────────────────────────

/** An open crate of round fruit, standing on y = 0 of the current frame. */
function fruitCrate(b, fruit, R) {
  const w = 0.27, d = 0.2, h = 0.07;
  block(b, w, 0.012, d, { at: [0, 0.006, 0], color: C.lightWood, bevel: 0.003 });
  for (const s of [-1, 1]) {
    block(b, w, h, 0.012, { at: [0, h / 2, s * (d / 2 - 0.006)], color: C.wood, bevel: 0.003 });
    block(b, 0.012, h, d - 0.02, { at: [s * (w / 2 - 0.006), h / 2, 0], color: C.wood, bevel: 0.003 });
  }
  const r = 0.031;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      b.sphere(r, { at: [-0.093 + i * 0.062 + (R() - 0.5) * 0.006, 0.012 + r * 0.95, -0.062 + j * 0.062],
        color: shade(fruit, (R() - 0.5) * 0.09), seg: 8 });
    }
  }
}

/** A scalloped hem tab: a half disc hanging below y = 0. */
const scallop = (r) => arcPts(0, 0, r, 0, -PI, 10);

// ── builders ─────────────────────────────────────────────────────────────────
export default {
  // A gable-fronted cottage: tiled roof (color2) over cream walls (color), arched door, shuttered windows with
  // flower boxes, a round attic window and a brick chimney.
  house(b, p) {
    const wallC = p.color || "#f2e3c2";
    const roofC = p.color2 || TILE;
    const doorC = "#3f7a80";
    const W = 0.54, D = 0.46, yb = 0.04, H = 0.36, yw = yb + H, rise = 0.25, t = 0.034;
    const a = Math.atan2(rise, W / 2);
    const zf = D / 2;
    block(b, W + 0.03, yb, D + 0.03, { at: [0, yb / 2, 0], color: shade(STONE, -0.1), bevel: 0.008 });
    b.box(W, H, D, { at: [0, yb + H / 2, 0], color: wallC, r: 0.012 });
    b.extrude([[-W / 2 + 0.004, 0], [W / 2 - 0.004, 0], [0, rise - 0.006]], D - 0.008,
      { at: [0, yw - 0.002, 0], color: wallC, bevel: 0.004, curveSeg: 1 });
    gableRoof(b, { yr: yw + rise, run: W / 2 + 0.065, a, len: D + 0.1, t, color: roofC });
    // chimney through the right-hand slope
    const roofTop = (x) => yw + rise - x * Math.tan(a) + t / Math.cos(a);
    const chx = 0.14, chz = -0.07, cb = roofTop(chx + 0.04) - 0.02, ct = 0.712;
    b.box(0.075, ct - cb, 0.075, { at: [chx, (cb + ct) / 2, chz], color: C.brick, r: 0.008, seg: 1 });
    block(b, 0.096, 0.026, 0.096, { at: [chx, ct + 0.013, chz], color: shade(C.brick, -0.12), bevel: 0.006 });
    // arched front door with a knob and a stone step
    b.extrude(archOutline(0.15, 0.235), 0.012, { at: [0, yb - 0.004, zf + 0.002], color: TRIM, bevel: 0.003 });
    b.extrude(archOutline(0.118, 0.205), 0.012, { at: [0, yb, zf + 0.008], color: doorC, bevel: 0.003 });
    for (const x of [-0.02, 0.02]) {
      b.box(0.004, 0.15, 0.004, { at: [x, yb + 0.09, zf + 0.016], color: shade(doorC, -0.14), r: 0 });
    }
    b.sphere(0.009, { at: [0.036, yb + 0.1, zf + 0.018], ...GOLD, seg: 8 });
    block(b, 0.17, 0.04, 0.06, { at: [0, 0.02, zf + 0.04], color: shade(STONE, -0.03), bevel: 0.006 });
    // windows: shuttered with flower boxes at the front, plain on the sides and the back
    const shutter = shade(roofC, -0.04);
    b.mirrorX(() => cottageWindow(b, [0.17, 0.255, zf], 0, { shutter, flowers: true }));
    b.mirrorX(() => cottageWindow(b, [W / 2, 0.255, 0], PI / 2));
    cottageWindow(b, [0, 0.255, -zf], PI);
    // round attic window in the gable
    const gy = yw + rise * 0.4;
    b.cyl(0.036, 0.036, 0.01, { at: [0, gy, zf + 0.001], rot: [PI / 2, 0, 0], color: GLASS, kind: "gloss", seg: 18 });
    b.torus(0.04, 0.009, { at: [0, gy, zf + 0.005], color: TRIM, seg: 20, tubeSeg: 6 });
    b.box(0.006, 0.072, 0.005, { at: [0, gy, zf + 0.007], color: TRIM, r: 0 });
    b.box(0.072, 0.006, 0.005, { at: [0, gy, zf + 0.007], color: TRIM, r: 0 });
  },

  // A round castle tower: proud stones, a door and arrow slits, corbelled battlements and a slate cone with a
  // pennant. color = stone.
  tower(b, p) {
    const stone = p.color || STONE;
    roundTower(b, randomFor(b, p, 1), {
      r0: 0.19, r1: 0.172, h: 1.0, stone, roof: SLATE, top: 1.32, flag: FLAG,
      openings: [
        { kind: "door", a: 0, y: 0.17, w: 0.13, h: 0.21 },
        { kind: "slit", a: 0, y: 0.53, w: 0.024, h: 0.1 },
        { kind: "window", a: 0, y: 0.82, w: 0.07, h: 0.11 },
        { kind: "slit", a: 1.45, y: 0.66, w: 0.024, h: 0.1 },
        { kind: "slit", a: -1.45, y: 0.4, w: 0.024, h: 0.1 },
      ],
    });
  },

  // A small castle: four round corner towers with slate cones, crenellated curtain walls, a gatehouse with a
  // wooden gate and banner, and a keep flying a flag. color = stone.
  castle(b, p) {
    const stone = p.color || STONE;
    const dark = shade(stone, -0.12);
    const R = randomFor(b, p, 2);
    const TX = 0.5, TZ = 0.33, wallH = 0.4, wt = 0.075;
    const wall = (at, rotY, len) => b.group({ at, rot: [0, rotY, 0] }, () => curtain(b, R, len, wallH, wt, stone));
    wall([-0.33, 0, TZ], 0, 0.34);
    wall([0.33, 0, TZ], 0, 0.34);
    wall([0, 0, -TZ], PI, 2 * TX);
    wall([TX, 0, 0], PI / 2, 2 * TZ);
    wall([-TX, 0, 0], -PI / 2, 2 * TZ);
    // keep
    const kz = -0.07, kh = 0.66;
    block(b, 0.38, kh, 0.3, { at: [0, kh / 2, kz], color: stone, bevel: 0.01 });
    merlonBox(b, 0, kz, 0.38, 0.3, kh - 0.002, { w: 0.05, h: 0.06, d: 0.034, color: stone });
    b.group({ at: [0, 0, kz + 0.15] }, () => {
      wallStones(b, R, { x0: -0.17, x1: 0.17, y0: 0.42, y1: kh - 0.02, color: stone, fill: 0.22,
        keep: (x) => Math.abs(Math.abs(x) - 0.085) > 0.06 });
      for (const x of [-0.085, 0.085]) {
        b.extrude(archOutline(0.072, 0.11), 0.012, { at: [x, 0.47, 0.002], color: shade(stone, 0.06), bevel: 0.003 });
        b.extrude(archOutline(0.05, 0.095), 0.012, { at: [x, 0.476, 0.006], color: DARK, bevel: 0.002 });
      }
    });
    flagPole(b, 0, kz, kh - 0.01, 1.04, FLAG, { w: 0.15, h: 0.095, r: 0.008 });
    // gatehouse
    const gz = TZ + 0.005, gd = 0.2, gh = 0.5, zf = gz + gd / 2;
    block(b, 0.34, gh, gd, { at: [0, gh / 2, gz], color: stone, bevel: 0.01 });
    merlonBox(b, 0, gz, 0.34, gd, gh - 0.002, { w: 0.05, h: 0.06, d: 0.034, color: stone });
    b.extrude(archOutline(0.2, 0.3), 0.012, { at: [0, -0.002, zf + 0.002], color: dark, bevel: 0.003 });
    b.extrude(archOutline(0.15, 0.265), 0.012, { at: [0, 0, zf + 0.008], color: C.darkWood, bevel: 0.003 });
    b.box(0.004, 0.25, 0.004, { at: [0, 0.125, zf + 0.0155], color: shade(C.darkWood, -0.25), r: 0 });
    for (const y of [0.07, 0.17]) b.box(0.144, 0.012, 0.005, { at: [0, y, zf + 0.016], color: IRON, r: 0 });
    for (const x of [-0.035, 0.035]) b.sphere(0.006, { at: [x, 0.125, zf + 0.018], ...METAL, seg: 6 });
    // a banner above the gate and a pair of slits
    b.extrude([[-0.045, 0], [0, 0.028], [0.045, 0], [0.045, 0.125], [-0.045, 0.125]], 0.008,
      { at: [0, 0.325, zf + 0.006], color: FLAG, bevel: 0.002, curveSeg: 1 });
    b.cyl(0.018, 0.018, 0.006, { at: [0, 0.4, zf + 0.012], rot: [PI / 2, 0, 0], ...GOLD, seg: 14 });
    b.box(0.11, 0.012, 0.012, { at: [0, 0.452, zf + 0.008], color: C.darkWood, r: 0.003 });
    for (const x of [-0.115, 0.115]) {
      block(b, 0.05, 0.11, 0.012, { at: [x, 0.38, zf + 0.002], color: shade(stone, 0.06), bevel: 0.003 });
      block(b, 0.02, 0.085, 0.012, { at: [x, 0.38, zf + 0.006], color: DARK, bevel: 0.002 });
    }
    // corner towers (flags on the two at the back)
    for (const [x, z] of [[-TX, TZ], [TX, TZ], [-TX, -TZ], [TX, -TZ]]) {
      const out = Math.atan2(x, z);
      b.group({ at: [x, 0, z] }, () => roundTower(b, R, {
        r0: 0.122, r1: 0.11, h: 0.62, stone, roof: SLATE, top: 0.96, seg: 16, corbels: 0, merlons: 6,
        ph: 0.06, mh: 0.055, fill: 0.14, over: 0.04, pw: 0.035, flag: z < 0 ? FLAG : null, pole: 0.07,
        openings: z > 0
          ? [{ kind: "slit", a: 0, y: 0.42, w: 0.02, h: 0.08 }, { kind: "slit", a: out + Math.sign(x) * 0.6, y: 0.26, w: 0.02, h: 0.08 }]
          : [{ kind: "slit", a: out, y: 0.42, w: 0.02, h: 0.08 }],
      }));
    }
  },

  // A humpbacked stone bridge spanning left to right: one arch ringed with voussoirs and a keystone,
  // parapets with coping, end posts and a gravel road. color = stone.
  bridge(b, p) {
    const stone = p.color || STONE;
    const R = randomFor(b, p, 3);
    const L = 1.26, Dz = 0.38, span = 0.3, rise = 0.21, bev = 0.008;
    const deck = (x) => 0.29 + 0.055 * Math.cos((x / (L / 2)) * (PI / 2));
    const n = 18;
    const body = [[-L / 2, 0], [-span, 0]];
    for (let i = 1; i < n; i++) {
      const s = (i / n) * PI;
      body.push([-span * Math.cos(s), rise * Math.sin(s)]);
    }
    body.push([span, 0], [L / 2, 0]);
    for (let i = 0; i <= 14; i++) {
      const x = L / 2 - (i / 14) * L;
      body.push([x, deck(x)]);
    }
    b.extrude(body, Dz - 2 * bev, { at: [0, bev, 0], color: stone, bevel: bev, curveSeg: 1 });
    // a band following the deck: y0..y1 above it, from x0 to x1
    const band = (y0, y1, x0, x1, m = 16) => {
      const bot = [], top = [];
      for (let i = 0; i <= m; i++) {
        const x = lerp(x0, x1, i / m);
        bot.push([x, deck(x) + y0]);
        top.push([x, deck(x) + y1]);
      }
      return [...bot, ...top.reverse()];
    };
    const pt = 0.045;
    for (const s of [-1, 1]) {
      const z = s * (Dz / 2 - pt / 2);
      b.extrude(band(-0.01, 0.075, -L / 2 + 0.03, L / 2 - 0.03), pt - 0.008,
        { at: [0, 0, z], color: stone, bevel: 0.004, curveSeg: 1 });
      b.extrude(band(0.071, 0.09, -L / 2 + 0.02, L / 2 - 0.02), pt + 0.006,
        { at: [0, 0, z], color: shade(stone, 0.06), bevel: 0.003, curveSeg: 1 });
      for (const sx of [-1, 1]) {
        const x = sx * (L / 2 - 0.04), y0 = deck(x) - 0.01;
        block(b, 0.075, 0.14, pt + 0.02, { at: [x, y0 + 0.07, z], color: shade(stone, 0.03), bevel: 0.008 });
        b.cyl(0, 0.052, 0.035, { at: [x, y0 + 0.14 + 0.0175, z], rot: [0, PI / 4, 0], seg: 4, flat: true,
          color: shade(stone, 0.07) });
      }
    }
    b.extrude(band(0, 0.008, -L / 2 + 0.01, L / 2 - 0.01), Dz - 2 * pt - 0.006,
      { color: "#d8c8a2", bevel: 0.002, curveSeg: 1 });
    // voussoirs round the arch, keystone in the middle
    const nv = 13;
    for (let k = 0; k < nv; k++) {
      const s = ((k + 0.5) / nv) * PI;
      const px = -span * Math.cos(s), py = rise * Math.sin(s);
      let nx = -Math.cos(s) / span, ny = Math.sin(s) / rise;
      const nl = Math.hypot(nx, ny);
      nx /= nl;
      ny /= nl;
      const key = k === (nv - 1) / 2;
      const len = key ? 0.1 : 0.075, w = key ? 0.075 : ((PI * (span + rise)) / 2 / nv) * 0.86;
      block(b, w, len, Dz + (key ? 0.03 : 0.016), { at: [px + nx * (len / 2 - 0.006), py + ny * (len / 2 - 0.006), 0],
        rot: [0, 0, Math.atan2(ny, nx) - PI / 2], color: shade(stone, key ? 0.08 : k % 2 ? 0.035 : -0.02), bevel: 0.005 });
    }
    // proud stones on both faces
    for (const s of [-1, 1]) {
      b.group({ at: [0, 0, s * (Dz / 2 + bev - 0.002)], rot: [0, s > 0 ? 0 : PI, 0] }, () =>
        wallStones(b, R, { x0: -L / 2 + 0.03, x1: L / 2 - 0.03, y0: 0.02, y1: 0.33, color: stone, fill: 0.3,
          keep: (x, y, w, h) => (x / (span + 0.11)) ** 2 + (y / (rise + 0.11)) ** 2 > 1 && y + h / 2 < deck(x) - 0.03 }));
    }
  },

  // A stone archway: two piers on plinths, a round arch with voussoirs and a keystone, quoins, a cornice with
  // battlements and a raised iron portcullis. color = stone.
  gate(b, p) {
    const stone = p.color || STONE;
    const R = randomFor(b, p, 4);
    const W = 0.9, Ht = 0.94, Dz = 0.2, a = 0.235, ys = 0.58, bev = 0.008;
    const body = [[-W / 2, 0], [-a, 0], [-a, ys]];
    for (let i = 1; i < 18; i++) {
      const s = PI - (i / 18) * PI;
      body.push([a * Math.cos(s), ys + a * Math.sin(s)]);
    }
    body.push([a, ys], [a, 0], [W / 2, 0], [W / 2, Ht], [-W / 2, Ht]);
    b.extrude(body, Dz - 2 * bev, { at: [0, bev, 0], color: stone, bevel: bev, curveSeg: 1 });
    const px = (a + W / 2) / 2, pwid = W / 2 - a;
    b.mirrorX(() => {
      block(b, pwid + 0.04, 0.1, Dz + 0.05, { at: [px, 0.05, 0], color: shade(stone, -0.08), bevel: 0.008 });
      block(b, pwid + 0.03, 0.04, Dz + 0.04, { at: [px, ys - 0.02, 0], color: shade(stone, 0.05), bevel: 0.006 });
    });
    // voussoirs and keystone
    const nv = 9;
    for (let k = 0; k < nv; k++) {
      const s = ((k + 0.5) / nv) * PI;
      const key = k === 4;
      const len = key ? 0.13 : 0.1, w = ((PI * (a + 0.05)) / nv) * (key ? 1.05 : 0.86);
      const rr = a + len / 2 - 0.006;
      block(b, w, len, Dz + (key ? 0.04 : 0.02), { at: [Math.cos(s) * rr, ys + Math.sin(s) * rr, 0], rot: [0, 0, s - PI / 2],
        color: shade(stone, key ? 0.08 : k % 2 ? 0.035 : -0.015), bevel: 0.006 });
    }
    // cornice and battlements
    block(b, W + 0.06, 0.05, Dz + 0.05, { at: [0, Ht + 0.025, 0], color: shade(stone, 0.05), bevel: 0.008 });
    merlonRow(b, -W / 2 - 0.01, W / 2 + 0.01, Ht + 0.05, 0, { w: 0.1, h: 0.085, d: Dz - 0.01, color: stone });
    // quoins on the outer corners and proud stones on both faces
    for (const s of [-1, 1]) {
      b.group({ at: [0, 0, s * (Dz / 2 + bev - 0.002)], rot: [0, s > 0 ? 0 : PI, 0] }, () => {
        let k = 0;
        for (let y = 0.15; y < Ht - 0.05; y += 0.085, k++) {
          const len = k % 2 ? 0.07 : 0.105;
          for (const sx of [-1, 1]) {
            block(b, len, 0.075, 0.014, { at: [sx * (W / 2 - len / 2 + 0.006), y, 0.003],
              color: shade(stone, k % 2 ? 0.04 : 0.02), bevel: 0.004 });
          }
        }
        wallStones(b, R, { x0: -W / 2 + 0.12, x1: W / 2 - 0.12, y0: 0.12, y1: Ht - 0.02, color: stone, fill: 0.28,
          keep: (x, y, w, h) => Math.hypot(x, Math.max(0, y - ys)) > a + 0.13 && (y > ys || Math.abs(x) > a + 0.05) });
      });
    }
    // raised portcullis inside the arch
    const iron = { color: "#3d3b3a", kind: "metal" };
    for (let i = -3; i <= 3; i++) {
      const x = i * 0.06, yt = ys + Math.sqrt(a * a - x * x) - 0.014, y0 = ys - 0.09;
      b.box(0.012, yt - y0, 0.012, { at: [x, (yt + y0) / 2, 0], ...iron, r: 0 });
      b.cone(0.009, 0.03, { at: [x, y0 - 0.015, 0], rot: [PI, 0, 0], ...iron, seg: 6 });
    }
    for (const y of [ys - 0.06, ys + 0.04, ys + 0.13]) {
      const hw = y < ys ? a - 0.012 : Math.sqrt(a * a - (y - ys) ** 2) - 0.012;
      b.box(2 * hw, 0.012, 0.01, { at: [0, y, 0], ...iron, r: 0 });
    }
  },

  // A white picket fence segment: pointed pickets on two rails between capped posts. color = paint.
  fence(b, p) {
    const paint = p.color || C.white;
    const rail = shade(paint, -0.07);
    for (const y of [0.11, 0.285]) b.box(0.86, 0.045, 0.022, { at: [0, y, -0.01], color: rail, r: 0.006, seg: 1 });
    b.mirrorX(() => {
      b.box(0.07, 0.37, 0.07, { at: [0.43, 0.185, -0.006], color: paint, r: 0.008, seg: 1 });
      b.cyl(0, 0.05, 0.045, { at: [0.43, 0.37 + 0.0225, -0.006], rot: [0, PI / 4, 0], seg: 4, flat: true, color: paint });
    });
    const n = 7, pitch = 0.118;
    const picket = [[-0.032, 0], [0.032, 0], [0.032, 0.3], [0, 0.345], [-0.032, 0.3]];
    for (let k = 0; k < n; k++) {
      const x = (k - (n - 1) / 2) * pitch;
      b.extrude(picket, 0.016, { at: [x, 0.006, 0.012], color: paint, bevel: 0.004, curveSeg: 1 });
    }
  },

  // An A-frame ridge tent with sagging canvas, door flaps tied back, poles, guy ropes, pegs and a pennant.
  // color = canvas.
  tent(b, p) {
    const cloth = p.color || "#e38b3a";
    const inner = mix(shade(cloth, -0.3), "#3b2b22", 0.45);
    const W = 0.42, H = 0.64, L = 0.62, sag = 0.022;
    const hyp = Math.hypot(W, H), nx = H / hyp, ny = W / hyp;
    const panel = (u, v) => {
      const s = Math.sin(PI * u) * Math.sin(PI * v) * sag;
      const flare = (1 - v) ** 3 * 0.03;
      return [lerp(W, 0, v) - nx * s + flare, lerp(0, H, v) - ny * s, lerp(-L / 2, L / 2, u)];
    };
    b.mirrorX(() => {
      b.geo(gridGeo(8, 6, panel, true), { color: cloth });
      b.geo(gridGeo(8, 6, panel, false), { color: inner });
    });
    // gables: the back closed, the front with an A-shaped doorway and folded-back flaps
    const dW = 0.15, dH = 0.46;
    b.extrude([[-W, 0], [-dW, 0], [0, dH], [dW, 0], [W, 0], [0, H]], 0.008,
      { at: [0, 0.002, L / 2 - 0.004], color: cloth, bevel: 0.003, curveSeg: 1 });
    b.extrude([[-W, 0], [W, 0], [0, H]], 0.008, { at: [0, 0.002, -L / 2 + 0.004], color: cloth, bevel: 0.003, curveSeg: 1 });
    b.extrude([[-W * 0.9, 0], [W * 0.9, 0], [0, H * 0.9]], 0.004, { at: [0, 0.004, -L / 2 + 0.016], color: inner, bevel: 0.001 });
    b.box(2 * W * 0.92, 0.006, L * 0.96, { at: [0, 0.004, 0], color: inner, r: 0 });
    const flap = mix(cloth, "#fff4e0", 0.3);
    b.mirrorX(() => {
      b.extrude([[dW, 0], [dW + 0.11, 0], [0.03, dH - 0.04]], 0.006, { at: [0, 0.004, L / 2 + 0.006], color: flap,
        bevel: 0.002, curveSeg: 1 });
      b.sphere(0.011, { at: [dW + 0.035, 0.2, L / 2 + 0.012], color: shade(cloth, -0.2), seg: 8 });
    });
    // ridge seam, poles, guy ropes and pegs
    b.cyl(0.011, 0.011, L + 0.02, { at: [0, H + 0.004, 0], rot: [PI / 2, 0, 0], color: shade(cloth, -0.16), seg: 8 });
    for (const s of [-1, 1]) {
      const z = s * (L / 2 + 0.012);
      b.cyl(0.011, 0.011, H + 0.06, { at: [0, (H + 0.06) / 2, z], color: C.wood, seg: 8 });
      b.sphere(0.016, { at: [0, H + 0.066, z], color: C.darkWood, seg: 8 });
      b.rod([0, H + 0.035, z], [0, 0.012, s * 0.39], 0.003, { color: ROPE, seg: 4 });
      b.cyl(0.006, 0.003, 0.04, { at: [0, 0.016, s * 0.395], color: "#8d9097", seg: 5 });
      for (const sx of [-1, 1]) {
        b.cyl(0.005, 0.003, 0.035, { at: [sx * (W + 0.035), 0.014, s * (L / 2 - 0.03)], color: "#8d9097", seg: 5 });
      }
    }
    b.group({ at: [0.011, H + 0.03, L / 2 + 0.012] }, () => flagCloth(b, 0.085, 0.05, { color: C.yellow, tri: true }));
  },

  // A wooden signpost with arrow boards; text "A|B" (up to three parts) is lettered on the boards, blank boards
  // are carved. color = wood.
  signpost(b, p) {
    const wood = p.color || "#b98a55";
    const post = shade(wood, -0.07);
    const parts = textOf(b, p.text).split("|").map((s) => s.trim());
    const n = clamp(parts.length, 2, 3);
    const ink = lum(wood) > 0.2 ? "#3a2616" : "#f8eedb";
    block(b, 0.13, 0.05, 0.09, { at: [0, 0.025, 0], color: shade(STONE, -0.06), bevel: 0.01 });
    b.box(0.06, 1.12, 0.06, { at: [0, 0.05 + 0.56, 0], color: post, r: 0.01 });
    b.cyl(0, 0.055, 0.04, { at: [0, 1.19, 0], rot: [0, PI / 4, 0], seg: 4, flat: true, color: shade(post, -0.06) });
    const gap = n === 3 ? 0.152 : 0.175;
    for (let i = 0; i < n; i++) arrowBoard(b, 1.02 - i * gap, i % 2 ? -1 : 1, parts[i] || "", wood, ink);
  },

  // A traffic light: pole on a round foot, a housing on a white-edged backboard and three lamps with visors;
  // the variant's lamp glows.
  traffic_light(b, p) {
    const v = ["red", "yellow", "green"].includes(p.variant) ? p.variant : "red";
    const body = "#2e3238", pole = "#59606a";
    b.lathe([[0, 0], [0.085, 0], [0.086, 0.016], [0.07, 0.03], [0.034, 0.045], [0, 0.045]], { color: pole, seg: 24 });
    b.cyl(0.021, 0.024, 0.68, { at: [0, 0.045 + 0.34, 0], color: pole, seg: 14 });
    b.box(0.2, 0.43, 0.012, { at: [0, 0.885, -0.058], color: "#f2f0ea", r: 0.004, seg: 1 });
    b.box(0.18, 0.41, 0.014, { at: [0, 0.885, -0.054], color: body, r: 0.004, seg: 1 });
    b.box(0.13, 0.37, 0.1, { at: [0, 0.885, 0], color: body, r: 0.024 });
    const ON = { red: "#ff3b2f", yellow: "#ffb520", green: "#2fd47a" };
    const OFF = { red: "#4d2422", yellow: "#4d4120", green: "#1d4231" };
    ["red", "yellow", "green"].forEach((c, i) => {
      const y = 1.0 - i * 0.115, on = c === v;
      b.sphere(0.042, { at: [0, y, 0.043], scale: [1, 1, 0.42], color: on ? ON[c] : OFF[c], kind: on ? "glow" : "gloss",
        seg: 16, light: on });
      b.torus(0.044, 0.006, { at: [0, y, 0.05], color: "#1f2226", seg: 18, tubeSeg: 5 });
      visor(b, [0, y, 0.05], body);
    });
  },

  // A pillar post box: red column on a black plinth, domed cap, posting slot, collection plate, door and a
  // gold emblem. color = paint.
  mailbox(b, p) {
    const red = p.color || "#c8382e";
    const black = "#26282c";
    b.lathe([[0, 0], [0.135, 0], [0.136, 0.028], [0.127, 0.042], [0.12, 0.056], [0, 0.056]], { color: black, seg: 28 });
    b.lathe([[0, 0.052], [0.119, 0.052], [0.121, 0.07], [0.121, 0.655], [0.126, 0.665], [0, 0.665]], { color: red, seg: 28 });
    b.lathe([[0, 0.66], [0.138, 0.664], [0.147, 0.674], [0.148, 0.695], [0.14, 0.708], [0.128, 0.716], [0.122, 0.745],
      [0.104, 0.785], [0.075, 0.815], [0.04, 0.834], [0, 0.84]], { color: red, seg: 28 });
    b.sphere(0.016, { at: [0, 0.846, 0], color: red, seg: 10 });
    for (const y of [0.6, 0.075]) {
      b.torus(0.122, 0.006, { at: [0, y, 0], rot: [PI / 2, 0, 0], color: shade(red, -0.05), seg: 28, tubeSeg: 5 });
    }
    block(b, 0.11, 0.024, 0.03, { at: [0, 0.627, 0.11], color: "#141416", bevel: 0.005 });
    block(b, 0.13, 0.012, 0.036, { at: [0, 0.645, 0.113], color: red, bevel: 0.004 });
    block(b, 0.075, 0.048, 0.02, { at: [0, 0.545, 0.115], color: TRIM, bevel: 0.004 });
    for (const y of [0.553, 0.539]) b.box(0.05, 0.004, 0.003, { at: [0, y, 0.1265], color: "#7a7a80", r: 0 });
    b.cyl(0.125, 0.125, 0.27, { at: [0, 0.33, 0], thetaStart: -0.55, thetaLength: 1.1, color: shade(red, -0.03), seg: 10 });
    b.cyl(0.0085, 0.0085, 0.006, { at: [0.045, 0.37, 0.124], rot: [PI / 2, 0, 0], color: "#141416", seg: 8 });
    b.cyl(0.024, 0.024, 0.008, { at: [0, 0.43, 0.123], rot: [PI / 2, 0, 0], ...GOLD, seg: 16 });
  },

  // A retro rocket standing on three swept fins: white body, coloured nose, fins and band, a porthole and a
  // nozzle. color = nose, fins and band.
  rocket(b, p) {
    const accent = p.color || "#d9483b";
    const hull = "#f2eee6";
    const rr = (y) => {
      if (y <= 0.2) return lerp(0.084, 0.106, Math.sin(((y - 0.11) / 0.09) * (PI / 2)));
      if (y <= 0.4) return lerp(0.106, 0.112, (y - 0.2) / 0.2);
      const t = (y - 0.4) / 0.59;
      return 0.112 * Math.pow(Math.max(0, 1 - t * t), 0.62);
    };
    const prof = (y0, y1, n) => Array.from({ length: n + 1 }, (_, i) => {
      const y = lerp(y0, y1, i / n);
      return [rr(y), y];
    });
    b.lathe([[0, 0.11], ...prof(0.11, 0.68, 12)], { color: hull, seg: 24 });
    b.lathe(prof(0.68, 0.99, 10), { color: accent, seg: 24 });
    b.lathe([[0, 0.036], [0.068, 0.036], [0.066, 0.048], [0.052, 0.08], [0.046, 0.115], [0, 0.115]], { ...METAL, seg: 18 });
    const fin = [[0.075, 0.43], [0.12, 0.33], [0.16, 0.2], [0.182, 0.09], [0.19, 0.005], [0.16, 0.005], [0.13, 0.06],
      [0.08, 0.12]];
    for (const ang of [PI / 3, PI, -PI / 3]) {
      b.group({ rot: [0, ang - PI / 2, 0] }, () => b.extrude(fin, 0.016, { color: accent, bevel: 0.005, curveSeg: 1 }));
    }
    b.torus(rr(0.3) + 0.002, 0.009, { at: [0, 0.3, 0], rot: [PI / 2, 0, 0], color: accent, seg: 28, tubeSeg: 6 });
    b.torus(rr(0.68) + 0.001, 0.005, { at: [0, 0.68, 0], rot: [PI / 2, 0, 0], ...METAL, seg: 28, tubeSeg: 5 });
    const py = 0.53, pz = rr(py);
    b.torus(0.042, 0.011, { at: [0, py, pz - 0.002], ...METAL, seg: 22, tubeSeg: 6 });
    b.cyl(0.036, 0.036, 0.012, { at: [0, py, pz - 0.003], rot: [PI / 2, 0, 0], color: "#6fb4e6", kind: "gloss", seg: 20 });
    b.sphere(0.008, { at: [-0.012, py + 0.013, pz + 0.004], color: "#ffffff", kind: "gloss", seg: 6 });
  },

  // A small rounded car facing +z: glass cabin under a roof with pillars, chrome bumpers, round headlights,
  // grille, number plate and red tail lights. color = paint.
  car(b, p) {
    const paint = p.color || "#e2553f";
    const glass = "#3d5a78";
    b.box(0.33, 0.15, 0.66, { at: [0, 0.145, 0], color: paint, r: 0.055 });
    b.extrude([[0.2, 0.2], [-0.13, 0.2], [-0.07, 0.33], [0.14, 0.33]], 0.25,
      { rot: [0, PI / 2, 0], color: glass, kind: "gloss", bevel: 0.012, curveSeg: 1 });
    b.box(0.29, 0.03, 0.24, { at: [0, 0.342, -0.035], r: 0.013, color: paint });
    b.mirrorX(() => {
      b.rod([0.13, 0.205, 0.128], [0.13, 0.338, 0.068], 0.011, { color: paint, seg: 6 });
      b.rod([0.13, 0.205, -0.198], [0.13, 0.338, -0.138], 0.011, { color: paint, seg: 6 });
      b.rod([0.134, 0.205, -0.035], [0.134, 0.338, -0.035], 0.01, { color: paint, seg: 6 });
      block(b, 0.022, 0.018, 0.012, { at: [0.16, 0.235, 0.118], color: paint, bevel: 0.004 });
    });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        b.cyl(0.068, 0.068, 0.052, { at: [sx * 0.148, 0.068, sz * 0.215], rot: [0, 0, PI / 2], color: TYRE, seg: 18 });
        b.cyl(0.036, 0.036, 0.008, { at: [sx * 0.176, 0.068, sz * 0.215], rot: [0, 0, PI / 2], ...METAL, seg: 14 });
      }
    }
    // front: headlights, grille, bumper and number plate
    for (const sx of [-1, 1]) {
      b.cyl(0.034, 0.034, 0.016, { at: [sx * 0.098, 0.158, 0.326], rot: [PI / 2, 0, 0], ...METAL, seg: 16 });
      b.sphere(0.029, { at: [sx * 0.098, 0.158, 0.334], scale: [1, 1, 0.5], color: "#fff3c8", kind: "gloss", seg: 14 });
    }
    block(b, 0.1, 0.036, 0.012, { at: [0, 0.14, 0.33], ...METAL, bevel: 0.004 });
    for (const y of [0.132, 0.148]) b.box(0.08, 0.004, 0.004, { at: [0, y, 0.337], color: "#3a3d44", r: 0 });
    b.box(0.31, 0.028, 0.03, { at: [0, 0.088, 0.328], r: 0.012, ...METAL });
    block(b, 0.07, 0.024, 0.006, { at: [0, 0.088, 0.346], color: TRIM, bevel: 0.002 });
    // back: tail lights and bumper
    for (const sx of [-1, 1]) {
      block(b, 0.045, 0.03, 0.012, { at: [sx * 0.11, 0.165, -0.33], color: "#d92b2b", kind: "gloss", bevel: 0.004 });
    }
    b.box(0.31, 0.028, 0.03, { at: [0, 0.088, -0.328], r: 0.012, ...METAL });
  },

  // A steam engine pulling one carriage towards +z on a short track: boiler with brass bands and dome, funnel
  // chimney, cab, cowcatcher and spoked wheels; the carriage has a cream window band. color = paintwork.
  train(b, p) {
    const main = p.color || "#2f7a55";
    const red = "#c63d32", black = "#2b2d31";
    // track
    for (let k = 0; k < 10; k++) {
      block(b, 0.3, 0.02, 0.055, { at: [0, 0.01, -0.6 + k * (1.2 / 9)], color: "#7a5a3e", bevel: 0.004 });
    }
    b.mirrorX(() => block(b, 0.018, 0.024, 1.3, { at: [0.105, 0.032, 0], color: "#8d939b", kind: "metal", bevel: 0.004 }));
    // engine running gear
    for (const z of [0.12, 0.27, 0.42]) for (const sx of [-1, 1]) trainWheel(b, sx * 0.105, 0.11, z, 0.066, red);
    b.mirrorX(() => block(b, 0.008, 0.014, 0.32, { at: [0.135, 0.1, 0.27], ...METAL, bevel: 0.003 }));
    block(b, 0.17, 0.05, 0.56, { at: [0, 0.12, 0.33], color: black, bevel: 0.006 });
    block(b, 0.31, 0.022, 0.52, { at: [0, 0.19, 0.36], color: red, bevel: 0.005 });
    // boiler, smokebox, chimney, dome and lamp
    b.cyl(0.088, 0.088, 0.36, { at: [0, 0.29, 0.38], rot: [PI / 2, 0, 0], color: main, seg: 20 });
    for (const z of [0.3, 0.45]) b.torus(0.09, 0.006, { at: [0, 0.29, z], ...BRASS, seg: 22, tubeSeg: 5 });
    b.cyl(0.092, 0.092, 0.08, { at: [0, 0.29, 0.585], rot: [PI / 2, 0, 0], color: black, seg: 20 });
    b.cyl(0.075, 0.075, 0.012, { at: [0, 0.29, 0.628], rot: [PI / 2, 0, 0], color: shade(black, 0.08), seg: 20 });
    b.sphere(0.012, { at: [0, 0.29, 0.636], ...BRASS, seg: 8 });
    b.lathe([[0, 0.36], [0.032, 0.36], [0.03, 0.4], [0.032, 0.44], [0.046, 0.475], [0.05, 0.492], [0.046, 0.5],
      [0.036, 0.498], [0, 0.494]], { at: [0, 0, 0.565], color: black, seg: 16 });
    b.lathe([[0.042, 0.36], [0.042, 0.39], [0.036, 0.41], [0.022, 0.425], [0, 0.43]], { at: [0, 0, 0.4], ...BRASS, seg: 16 });
    block(b, 0.05, 0.045, 0.04, { at: [0, 0.405, 0.62], color: black, bevel: 0.006 });
    b.cyl(0.016, 0.016, 0.008, { at: [0, 0.405, 0.642], rot: [PI / 2, 0, 0], color: "#ffe9a8", kind: "glow", seg: 12,
      light: false });
    // cab
    b.box(0.3, 0.22, 0.17, { at: [0, 0.31, 0.105], color: main, r: 0.01, seg: 1 });
    for (const sx of [-1, 1]) {
      block(b, 0.05, 0.06, 0.01, { at: [sx * 0.1, 0.34, 0.19], color: "#2b2f38", bevel: 0.003 });
      block(b, 0.01, 0.07, 0.08, { at: [sx * 0.15, 0.33, 0.1], color: "#2b2f38", bevel: 0.003 });
    }
    b.box(0.34, 0.024, 0.22, { at: [0, 0.432, 0.1], color: black, r: 0.01, seg: 1 });
    // buffer beam, buffers and cowcatcher
    block(b, 0.31, 0.05, 0.03, { at: [0, 0.175, 0.64], color: red, bevel: 0.006 });
    for (const sx of [-1, 1]) {
      b.cyl(0.012, 0.012, 0.03, { at: [sx * 0.1, 0.175, 0.665], rot: [PI / 2, 0, 0], ...METAL, seg: 8 });
      b.cyl(0.022, 0.022, 0.008, { at: [sx * 0.1, 0.175, 0.682], rot: [PI / 2, 0, 0], ...METAL, seg: 12 });
    }
    b.extrude([[-0.625, 0.152], [-0.625, 0.048], [-0.695, 0.048]], 0.24, { rot: [0, PI / 2, 0], color: red, bevel: 0.004,
      curveSeg: 1 });
    block(b, 0.04, 0.03, 0.08, { at: [0, 0.15, -0.02], color: black, bevel: 0.006 });
    // carriage
    for (const z of [-0.2, -0.5]) for (const sx of [-1, 1]) trainWheel(b, sx * 0.105, 0.096, z, 0.052, red);
    block(b, 0.18, 0.04, 0.52, { at: [0, 0.14, -0.34], color: black, bevel: 0.006 });
    b.box(0.3, 0.19, 0.54, { at: [0, 0.255, -0.34], color: main, r: 0.012, seg: 1 });
    b.box(0.306, 0.07, 0.5, { at: [0, 0.292, -0.34], color: "#f2e6c8", r: 0.006, seg: 1 });
    for (const sx of [-1, 1]) {
      for (const z of [-0.15, -0.27, -0.41, -0.53]) {
        block(b, 0.01, 0.046, 0.075, { at: [sx * 0.154, 0.292, z], color: "#2f3c4f", kind: "gloss", bevel: 0.003 });
      }
    }
    for (const z of [-0.065, -0.615]) {
      block(b, 0.075, 0.046, 0.01, { at: [0, 0.292, z], color: "#2f3c4f", kind: "gloss", bevel: 0.003 });
    }
    b.box(0.32, 0.03, 0.57, { at: [0, 0.365, -0.34], color: "#5a5d66", r: 0.014 });
  },

  // A boat with its bow towards +z. 'sail': a square sail with stripes billowing on a mast, stays and a
  // pennant. 'row': a rowing boat with thwarts, shipped oars and a lantern on a stern pole. color = hull.
  boat(b, p) {
    const v = p.variant === "row" ? "row" : "sail";
    const hull = p.color || (v === "row" ? "#b9773f" : "#2f6fb2");
    const H = HULL;
    boatHull(b, H, { hull, band: v === "row" ? "#f1e6cf" : TRIM, inner: C.lightWood, rail: C.wood,
      transom: v === "row" ? shade(hull, -0.05) : TRIM });
    for (const t of [0.3, 0.62]) {
      const z = lerp(H.z0, H.z1, t), y = hullTop(H, t) - 0.05;
      const hw = hullInnerHalf(H, t, 0.05);
      block(b, 2 * hw + 0.012, 0.016, 0.065, { at: [0, y, z], color: C.wood, bevel: 0.004 });
    }
    if (v === "sail") {
      const mz = 0.05;
      b.cyl(0.011, 0.013, 0.8, { at: [0, 0.4, mz], color: C.darkWood, seg: 8 });
      b.sphere(0.014, { at: [0, 0.802, mz], ...GOLD, seg: 8 });
      b.cyl(0.008, 0.008, 0.37, { at: [0, 0.71, mz + 0.012], rot: [0, 0, PI / 2], color: C.darkWood, seg: 6 });
      b.cyl(0.007, 0.007, 0.33, { at: [0, 0.3, mz + 0.012], rot: [0, 0, PI / 2], color: C.darkWood, seg: 6 });
      const n = 5;
      for (let k = 0; k < n; k++) {
        const col = k % 2 ? hull : TRIM;
        sheet(b, 10, 2, (u, w) => {
          const vv = (k + w) / n;
          const half = lerp(0.15, 0.172, vv);
          const bulge = 0.075 * Math.sin(PI * u) * (0.35 + 0.65 * Math.sin(PI * vv));
          return [lerp(-half, half, u), lerp(0.31, 0.7, vv), mz + 0.02 + bulge];
        }, { color: col });
      }
      for (const [x, y, z] of [[0, 0.22, 0.385], [0, 0.2, -0.36], [0.14, 0.18, 0.02], [-0.14, 0.18, 0.02]]) {
        b.rod([0, 0.78, mz], [x, y, z], 0.0025, { color: "#5a4a3c", seg: 4 });
      }
      b.group({ at: [0.012, 0.77, mz], rot: [0, -0.5, 0] }, () => flagCloth(b, 0.11, 0.05, { color: hull, tri: true }));
    } else {
      // oars resting in their locks, blades trailing in the water behind
      b.mirrorX(() => {
        const A = [0.035, 0.205, 0.17], B = [0.198, 0.07, -0.25];
        const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
        const S = [A[0] + d[0] * 0.72, A[1] + d[1] * 0.72, A[2] + d[2] * 0.72];
        b.rod(A, S, 0.008, { color: C.lightWood, seg: 6 });
        b.group({ at: [A[0] + d[0] * 0.86, A[1] + d[1] * 0.86, A[2] + d[2] * 0.86], ...towards(d) }, () =>
          block(b, 0.008, 0.045, 0.13, { color: C.lightWood, bevel: 0.003 }));
        const lock = hullPt(H, 0.5, PI / 2);
        b.torus(0.012, 0.0035, { at: [lock[0], lock[1] + 0.012, lock[2]], rot: [0, PI / 2, 0], ...METAL, seg: 10, tubeSeg: 4 });
      });
      // a lantern hung from a pole at the stern
      const zs = H.z0 + 0.035;
      b.cyl(0.008, 0.009, 0.5, { at: [0, 0.4, zs], color: C.darkWood, seg: 6 });
      b.rod([0, 0.64, zs], [0, 0.645, zs - 0.07], 0.006, { color: C.darkWood, seg: 6 });
      hangingLantern(b, [0, 0.632, zs - 0.065], 1);
    }
  },

  // A small low-wing propeller plane facing +z: rounded fuselage, cream cowling and wing tips, bubble canopy,
  // two-bladed propeller, tail fin and spatted wheels. color = paint.
  airplane(b, p) {
    const body = p.color || "#3f86cf";
    const accent = "#f4efe4";
    const yc = 0.115;
    const fus = [[0, -0.36], [0.018, -0.345], [0.032, -0.3], [0.046, -0.2], [0.06, -0.09], [0.07, 0.02], [0.074, 0.1],
      [0.073, 0.17], [0.07, 0.2]];
    b.lathe(fus, { at: [0, yc, 0], rot: [PI / 2, 0, 0], color: body, seg: 20 });
    b.lathe([[0.07, 0.198], [0.073, 0.23], [0.069, 0.265], [0.06, 0.285], [0, 0.288]],
      { at: [0, yc, 0], rot: [PI / 2, 0, 0], color: accent, seg: 20 });
    b.lathe([[0, -0.15], [0.052, -0.15], [0.055, -0.13], [0.0, -0.13]], { at: [0, yc, 0], rot: [PI / 2, 0, 0], color: accent,
      seg: 20 });
    b.lathe([[0.034, 0.285], [0.031, 0.31], [0.02, 0.335], [0, 0.348]], { at: [0, yc, 0], rot: [PI / 2, 0, 0], color: body,
      kind: "gloss", seg: 16 });
    // propeller
    const blade = [[-0.011, 0.018], [0.011, 0.018], [0.015, 0.06], [0.012, 0.095], [0, 0.104], [-0.012, 0.095], [-0.015, 0.06]];
    for (const ang of [0.4, 0.4 + PI]) {
      b.group({ at: [0, yc, 0.3], rot: [0, 0, ang] }, () => {
        b.extrude(blade, 0.006, { color: "#3a3330", bevel: 0.002, curveSeg: 1 });
        b.extrude([[-0.012, 0.085], [0.012, 0.085], [0.0, 0.104]], 0.007, { color: C.yellow, bevel: 0.002, curveSeg: 1 });
      });
    }
    // wings with a little dihedral, tailplane and fin
    const wing = [[0.03, 0.12], [0.33, 0.082], [0.33, -0.028], [0.03, -0.06]];
    const tip = [[0.32, 0.084], [0.36, 0.077], [0.388, 0.062], [0.4, 0.03], [0.394, 0.0], [0.37, -0.02], [0.32, -0.027]];
    b.mirrorX(() => b.group({ at: [0, 0.075, 0], rot: [0, 0, 0.06] }, () => {
      b.extrude(wing, 0.022, { rot: [PI / 2, 0, 0], color: body, bevel: 0.006, curveSeg: 1 });
      b.extrude(tip, 0.024, { rot: [PI / 2, 0, 0], color: accent, bevel: 0.006, curveSeg: 1 });
    }));
    const tail = [[0.0, -0.25], [0.12, -0.285], [0.15, -0.305], [0.152, -0.325], [0.13, -0.342], [0.0, -0.35]];
    b.mirrorX(() => b.extrude(tail, 0.012, { at: [0, 0.125, 0], rot: [PI / 2, 0, 0], color: body, bevel: 0.004, curveSeg: 1 }));
    const finS = [[0.24, 0.13], [0.3, 0.2], [0.325, 0.236], [0.345, 0.248], [0.364, 0.243], [0.37, 0.2], [0.362, 0.12],
      [0.3, 0.11]];
    b.extrude(finS, 0.012, { rot: [0, PI / 2, 0], color: body, bevel: 0.004, curveSeg: 1 });
    b.extrude([[0.31, 0.215], [0.325, 0.236], [0.345, 0.248], [0.364, 0.243], [0.368, 0.215]], 0.014,
      { rot: [0, PI / 2, 0], color: accent, bevel: 0.004, curveSeg: 1 });
    // canopy
    b.sphere(0.06, { at: [0, yc + 0.048, 0.01], scale: [0.85, 0.7, 1.5], thetaLength: PI / 2, color: "#3a5f86",
      kind: "gloss", seg: 16 });
    // undercarriage: struts, spatted wheels and a tail wheel
    for (const sx of [-1, 1]) {
      const x = sx * 0.12;
      b.rod([x, 0.07, 0.05], [x, 0.04, 0.06], 0.006, { color: shade(body, -0.15), seg: 5 });
      b.cyl(0.034, 0.034, 0.018, { at: [x, 0.035, 0.06], rot: [0, 0, PI / 2], color: TYRE, seg: 14 });
      b.sphere(1, { at: [x, 0.048, 0.06], scale: [0.016, 0.024, 0.052], color: body, seg: 12 });
    }
    b.rod([0, 0.09, -0.3], [0, 0.022, -0.32], 0.004, { color: IRON, seg: 4 });
    b.cyl(0.014, 0.014, 0.01, { at: [0, 0.014, -0.322], rot: [0, 0, PI / 2], color: TYRE, seg: 10 });
  },

  // An upright wagon wheel: wooden felloe in an iron tyre, twelve tapered spokes and a banded hub. color = wood.
  wheel(b, p) {
    const wood = p.color || C.wood;
    const iron = { color: "#4a4d52", kind: "metal" };
    b.group({ at: [0, 0.25, 0] }, () => {
      b.extrude(ringShape(0.246, 0.229), 0.046, { ...iron, bevel: 0.004, curveSeg: 24 });
      b.extrude(ringShape(0.229, 0.196), 0.056, { color: wood, bevel: 0.005, curveSeg: 22 });
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU;
        b.rod([Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0], [Math.cos(a) * 0.205, Math.sin(a) * 0.205, 0], 0.0135,
          { r2: 0.0095, color: shade(wood, 0.04), seg: 7 });
      }
      b.lathe([[0, -0.06], [0.034, -0.06], [0.045, -0.046], [0.054, -0.022], [0.057, 0], [0.054, 0.022], [0.045, 0.046],
        [0.034, 0.06], [0, 0.06]], { rot: [PI / 2, 0, 0], color: shade(wood, -0.08), seg: 20 });
      for (const z of [-0.036, 0.036]) b.torus(0.052, 0.006, { at: [0, 0, z], ...iron, seg: 20, tubeSeg: 5 });
      b.cyl(0.02, 0.02, 0.132, { rot: [PI / 2, 0, 0], ...iron, seg: 12 });
    });
  },

  // A striped lighthouse on a rocky foot: door and windows, a railed gallery, a glowing lantern room and a
  // domed cap with a finial. color = stripes and cap.
  lighthouse(b, p) {
    const stripe = p.color || "#d0453a";
    const white = "#f6f2ea";
    const R = randomFor(b, p, 6);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU + 0.45 + R() * 0.3;
      if (angDist(a, 0) < 0.55) continue;
      const rr = 0.15 + R() * 0.02, s = 0.036 + R() * 0.016;
      b.ico(s, { at: [Math.sin(a) * rr, s * 0.45, Math.cos(a) * rr], scale: [1.25, 0.8, 1], rot: [R(), R() * TAU, R()],
        color: shade("#9c968c", (R() - 0.5) * 0.12), detail: 0 });
    }
    b.lathe([[0, 0], [0.18, 0], [0.18, 0.055], [0.172, 0.068], [0, 0.068]], { color: shade(STONE, -0.12), seg: 24 });
    const y0 = 0.065, y1 = 1.0, r0 = 0.15, r1 = 0.1;
    const rAt = (y) => lerp(r0, r1, (y - y0) / (y1 - y0));
    const nb = 6, bh = (y1 - y0) / nb;
    for (let i = 0; i < nb; i++) {
      const ya = y0 + i * bh, yb = ya + bh;
      b.lathe([[rAt(ya), ya], [rAt(yb), yb]], { color: i % 2 ? stripe : white, seg: 24 });
    }
    // door and two windows on the white bands
    const dz = rAt(0.15);
    b.extrude(archOutline(0.09, 0.17), 0.026, { at: [0, 0.064, dz - 0.008], color: shade(STONE, -0.05), bevel: 0.003 });
    b.extrude(archOutline(0.068, 0.155), 0.026, { at: [0, 0.068, dz - 0.004], color: "#3f6a5a", bevel: 0.003 });
    for (const y of [y0 + 2.5 * bh, y0 + 4.5 * bh]) {
      const z = rAt(y);
      block(b, 0.056, 0.07, 0.024, { at: [0, y, z - 0.006], color: TRIM, bevel: 0.004 });
      block(b, 0.038, 0.052, 0.024, { at: [0, y, z - 0.002], color: "#2f3c4f", kind: "gloss", bevel: 0.003 });
    }
    // gallery with railing
    const dark = "#3a3d44";
    b.lathe([[0, y1 - 0.005], [r1 + 0.002, y1 - 0.005], [0.152, y1 + 0.012], [0.152, y1 + 0.04], [0, y1 + 0.04]],
      { color: dark, seg: 24 });
    const yg = y1 + 0.04;
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * TAU;
      b.rod([Math.sin(a) * 0.144, yg, Math.cos(a) * 0.144], [Math.sin(a) * 0.144, yg + 0.06, Math.cos(a) * 0.144], 0.0045,
        { color: dark, seg: 4 });
    }
    b.torus(0.144, 0.006, { at: [0, yg + 0.06, 0], rot: [PI / 2, 0, 0], color: dark, seg: 32, tubeSeg: 5 });
    b.torus(0.144, 0.0035, { at: [0, yg + 0.03, 0], rot: [PI / 2, 0, 0], color: dark, seg: 32, tubeSeg: 4 });
    // lantern room
    b.cyl(0.085, 0.09, 0.035, { at: [0, yg + 0.0175, 0], color: stripe, seg: 20 });
    const yl = yg + 0.035, hl = 0.12;
    b.cyl(0.076, 0.076, hl, { at: [0, yl + hl / 2, 0], color: LAMP, kind: "glow", seg: 16 });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + PI / 6;
      b.rod([Math.sin(a) * 0.078, yl, Math.cos(a) * 0.078], [Math.sin(a) * 0.078, yl + hl, Math.cos(a) * 0.078], 0.0045,
        { color: dark, seg: 4 });
    }
    b.cyl(0.092, 0.092, 0.012, { at: [0, yl + hl + 0.004, 0], color: dark, seg: 20 });
    const yr = yl + hl + 0.01;
    b.lathe([[0, yr], [0.108, yr], [0.1, yr + 0.016], [0.085, yr + 0.05], [0.06, yr + 0.08], [0.03, yr + 0.1], [0, yr + 0.105]],
      { color: stripe, seg: 20 });
    b.sphere(0.018, { at: [0, yr + 0.118, 0], color: dark, seg: 10 });
    b.cone(0.006, 0.06, { at: [0, yr + 0.16, 0], color: dark, seg: 6 });
  },

  // A windmill: octagonal tapering tower with corner battens on a stone footing, door and windows, a
  // domed cap and four lattice sails with cloth. color = tower.
  windmill(b, p) {
    const body = p.color || "#f2e8d2";
    const capC = "#a9503b", wood = "#7d5a3c", cloth = "#f7f1e3";
    const y0 = 0.07, y1 = 0.73, rb = 0.19, rt = 0.13;
    b.lathe([[0, 0], [0.205, 0], [0.205, 0.058], [0.198, 0.07], [0, 0.07]], { color: shade(STONE, -0.08), seg: 24 });
    b.cyl(rt, rb, y1 - y0, { at: [0, (y0 + y1) / 2, 0], seg: 8, rot: [0, PI / 8, 0], flat: true, color: body });
    for (let k = 0; k < 8; k++) {
      const a = PI / 8 + (k * PI) / 4;
      b.rod([Math.sin(a) * rb, y0, Math.cos(a) * rb], [Math.sin(a) * rt, y1, Math.cos(a) * rt], 0.009,
        { color: wood, seg: 5 });
    }
    // things on the front face, which leans back as the tower tapers
    const cf = Math.cos(PI / 8);
    const lean = Math.atan(((rb - rt) * cf) / (y1 - y0));
    const onFace = (y, fn) => b.group({ at: [0, y, cf * lerp(rb, rt, (y - y0) / (y1 - y0))], rot: [-lean, 0, 0] }, fn);
    onFace(y0, () => {
      b.extrude(archOutline(0.12, 0.2), 0.012, { at: [0, 0, 0.002], color: TRIM, bevel: 0.003 });
      b.extrude(archOutline(0.092, 0.18), 0.012, { at: [0, 0, 0.008], color: "#5a7f4a", bevel: 0.003 });
      b.sphere(0.007, { at: [0.028, 0.09, 0.017], ...GOLD, seg: 6 });
    });
    for (const y of [0.42, 0.6]) {
      onFace(y, () => {
        block(b, 0.07, 0.08, 0.012, { at: [0, 0, 0.004], color: TRIM, bevel: 0.003 });
        block(b, 0.05, 0.06, 0.01, { at: [0, 0, 0.008], color: GLASS, kind: "gloss", bevel: 0.002 });
        b.box(0.006, 0.06, 0.004, { at: [0, 0, 0.013], color: TRIM, r: 0 });
        b.box(0.05, 0.006, 0.004, { at: [0, 0, 0.013], color: TRIM, r: 0 });
      });
    }
    // cap
    b.lathe([[0, y1 - 0.01], [0.162, y1 - 0.01], [0.166, y1 + 0.012], [0.156, y1 + 0.05], [0.13, y1 + 0.11],
      [0.09, y1 + 0.16], [0.045, y1 + 0.19], [0, y1 + 0.2]], { color: capC, seg: 20 });
    b.torus(0.164, 0.009, { at: [0, y1, 0], rot: [PI / 2, 0, 0], color: wood, seg: 28, tubeSeg: 5 });
    b.sphere(0.016, { at: [0, y1 + 0.21, 0], ...GOLD, seg: 8 });
    // windshaft, hub and sails in an X
    const hy = 0.86, hz = 0.255;
    b.rod([0, hy - 0.02, 0.04], [0, hy, hz], 0.024, { color: wood, seg: 10 });
    b.cyl(0.042, 0.042, 0.05, { at: [0, hy, hz], rot: [PI / 2, 0, 0], color: wood, seg: 14 });
    b.sphere(0.03, { at: [0, hy, hz + 0.026], scale: [1, 1, 0.6], color: shade(wood, -0.1), seg: 12 });
    const Ls = 0.34;
    for (let k = 0; k < 4; k++) {
      b.group({ at: [0, hy, hz + 0.012], rot: [0, 0, PI / 4 + (k * PI) / 2] }, () => {
        block(b, 0.024, Ls, 0.02, { at: [0, Ls / 2, 0], color: wood, bevel: 0.004 });
        block(b, 0.088, Ls - 0.1, 0.005, { at: [0.058, 0.1 + (Ls - 0.1) / 2, -0.005], color: cloth, bevel: 0.002 });
        block(b, 0.012, Ls - 0.09, 0.014, { at: [0.106, 0.09 + (Ls - 0.09) / 2, 0.002], color: wood, bevel: 0.003 });
        for (let i = 0; i < 6; i++) {
          const y = 0.1 + i * ((Ls - 0.11) / 5);
          block(b, 0.1, 0.009, 0.01, { at: [0.058, y, 0.004], color: wood, bevel: 0.002 });
        }
        block(b, 0.026, Ls - 0.13, 0.006, { at: [-0.026, 0.13 + (Ls - 0.13) / 2, -0.002], color: cloth, bevel: 0.002 });
      });
    }
  },

  // A stone wishing well: ring of block stones round dark water, two posts carrying a little shingled roof,
  // a windlass with rope and crank, and a wooden bucket. color = stone.
  well(b, p) {
    const stone = p.color || STONE;
    const R = randomFor(b, p, 5);
    const mortar = shade(stone, -0.16);
    const wood = C.wood;
    b.lathe([[0, 0], [0.184, 0], [0.184, 0.222], [0.15, 0.222], [0.15, 0.13], [0, 0.13]], { color: mortar, seg: 28 });
    for (let row = 0; row < 3; row++) {
      for (let k = 0; k < 12; k++) {
        const a = ((k + (row % 2) * 0.5) / 12) * TAU;
        b.group({ at: [Math.sin(a) * 0.188, 0.042 + row * 0.064, Math.cos(a) * 0.188], rot: [0, a, 0] }, () =>
          block(b, 0.088, 0.056, 0.03, { color: shade(stone, (R() - 0.5) * 0.1), bevel: 0.006 }));
      }
    }
    b.lathe([[0.148, 0.216], [0.204, 0.216], [0.208, 0.224], [0.208, 0.246], [0.2, 0.255], [0.152, 0.255], [0.145, 0.246],
      [0.145, 0.222], [0.148, 0.216]], { color: shade(stone, 0.05), seg: 28 });
    b.cyl(0.148, 0.148, 0.008, { at: [0, 0.134, 0], color: "#3f8fb8", kind: "gloss", seg: 24 });
    // posts, beam and roof
    b.mirrorX(() => {
      b.box(0.04, 0.27, 0.04, { at: [0.176, 0.25 + 0.135, 0], color: wood, r: 0.008, seg: 1 });
      b.extrude([[-0.16, 0], [0.16, 0], [0, 0.07]], 0.018, { at: [0.176, 0.537, 0], rot: [0, PI / 2, 0],
        color: shade(wood, -0.08), bevel: 0.003, curveSeg: 1 });
    });
    block(b, 0.43, 0.034, 0.046, { at: [0, 0.535, 0], color: shade(wood, -0.05), bevel: 0.006 });
    b.group({ rot: [0, PI / 2, 0] }, () =>
      gableRoof(b, { yr: 0.6, run: 0.21, a: Math.atan2(0.12, 0.21), len: 0.5, t: 0.024, color: "#8f5a3c", courses: 3 }));
    // windlass with rope, crank, and the bucket
    b.cyl(0.026, 0.026, 0.33, { at: [0, 0.42, 0], rot: [0, 0, PI / 2], color: C.lightWood, seg: 12 });
    for (const x of [-0.045, -0.015, 0.015, 0.045]) {
      b.torus(0.03, 0.006, { at: [x, 0.42, 0], rot: [0, PI / 2, 0], color: ROPE, seg: 12, tubeSeg: 4 });
    }
    b.rod([0.196, 0.42, 0], [0.235, 0.42, 0], 0.007, { color: IRON, seg: 6 });
    b.rod([0.235, 0.42, 0], [0.235, 0.36, 0.02], 0.007, { color: IRON, seg: 6 });
    b.rod([0.235, 0.36, 0.02], [0.27, 0.36, 0.02], 0.009, { color: C.lightWood, seg: 6 });
    b.rod([0, 0.394, 0], [0, 0.362, 0], 0.004, { color: ROPE, seg: 4 });
    const bk = [[0, 0.27], [0.031, 0.27], [0.034, 0.276], [0.041, 0.325]];
    b.lathe(bk, { color: wood, seg: 14 });
    b.lathe(bk.slice(1).reverse().map(([r, y]) => [r - 0.005, y]).concat([[0, 0.28]]), { color: shade(wood, -0.2), seg: 14 });
    for (const [r, y] of [[0.035, 0.284], [0.04, 0.316]]) {
      b.torus(r, 0.0035, { at: [0, y, 0], rot: [PI / 2, 0, 0], color: IRON, seg: 16, tubeSeg: 4 });
    }
    b.torus(0.04, 0.003, { at: [0, 0.325, 0], arc: PI, color: IRON, seg: 12, tubeSeg: 4 });
  },

  // A market stall: plank counter with crates of apples, oranges and pears, four posts and a sloping striped
  // awning with a scalloped valance. color, color2 = awning stripes.
  market_stall(b, p) {
    const c1 = p.color || "#d0483c", c2 = p.color2 || "#f6efe2";
    const wood = C.wood, dark = shade(wood, -0.1);
    const R = randomFor(b, p, 7);
    b.box(0.96, 0.44, 0.36, { at: [0, 0.22, -0.02], color: dark, r: 0.01, seg: 1 });
    for (let i = 0; i < 8; i++) {
      block(b, 0.112, 0.42, 0.016, { at: [-0.42 + i * 0.12, 0.215, 0.166], color: shade(wood, (i % 3) * 0.025 - 0.02),
        bevel: 0.004 });
    }
    b.box(1.02, 0.036, 0.44, { at: [0, 0.458, -0.01], color: C.lightWood, r: 0.01, seg: 1 });
    // posts and beams
    const yF = 0.955, yB = 1.13, zF = 0.3, zB = -0.28;
    for (const sx of [-1, 1]) {
      block(b, 0.05, 0.96, 0.05, { at: [sx * 0.505, 0.48, 0.23], color: wood, bevel: 0.008 });
      block(b, 0.05, 1.12, 0.05, { at: [sx * 0.505, 0.56, -0.25], color: wood, bevel: 0.008 });
    }
    block(b, 1.06, 0.036, 0.04, { at: [0, 0.95, 0.23], color: dark, bevel: 0.006 });
    block(b, 1.06, 0.036, 0.04, { at: [0, 1.105, -0.25], color: dark, bevel: 0.006 });
    // striped awning with its scalloped valance
    const ang = Math.atan2(yB - yF, zF - zB), len = Math.hypot(yB - yF, zF - zB);
    const n = 8, sw = 1.1 / n;
    for (let i = 0; i < n; i++) {
      const x = -0.55 + (i + 0.5) * sw, col = i % 2 ? c2 : c1;
      b.box(sw + 0.0005, 0.016, len, { at: [x, (yF + yB) / 2 + 0.008, (zF + zB) / 2], rot: [ang, 0, 0], color: col,
        r: 0.004, seg: 1 });
      b.box(sw + 0.0005, 0.05, 0.012, { at: [x, yF - 0.022, zF + 0.004], color: col, r: 0.003, seg: 1 });
      b.extrude(scallop(sw / 2), 0.012, { at: [x, yF - 0.046, zF + 0.004], color: col, bevel: 0.002, curveSeg: 1 });
    }
    // goods on the counter
    const goods = ["#d8322a", "#f08a24", "#a8c83a"];
    [-0.31, 0, 0.31].forEach((x, i) =>
      b.group({ at: [x, 0.476, 0.02], rot: [0.28, 0, 0] }, () => fruitCrate(b, goods[i], R)));
  },

  // A pointed stained-glass window in a stone frame on a sill: jewel-bright glass with a lead lattice, a
  // rose with petals, a lancet medallion and a trefoil. color = background glass.
  stained_glass(b, p) {
    const main = p.color || "#2f63c8";
    const frameC = "#d6ccb8", lead = "#35363c";
    const J = { red: "#d8323c", gold: "#f2b431", green: "#38a85a", purple: "#8a4fd0", pale: "#ffe39a" };
    const glow = (col) => ({ color: col, kind: "glow", light: false });
    block(b, 0.66, 0.06, 0.09, { at: [0, 0.03, 0], color: shade(frameC, -0.12), bevel: 0.008 });
    block(b, 0.62, 0.022, 0.08, { at: [0, 0.07, 0], color: frameC, bevel: 0.005 });
    const y0 = 0.08, ys = 0.68, a = 0.3, Rr = 0.6, fw = 0.05;
    const outer = gothicOutline(a, y0, ys, Rr, 14), inner = gothicOutline(a - fw, y0 + fw, ys, Rr - fw, 14);
    const frame = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
    frame.holes.push(new THREE.Path(inner.map(([x, y]) => new THREE.Vector2(x, y))));
    b.extrude(frame, 0.05, { color: frameC, bevel: 0.006, curveSeg: 1 });
    // background glass and the diagonal lead lattice
    b.extrude(inner, 0.008, { ...glow(main), bevel: 0.0015, curveSeg: 1 });
    for (const d of [[0.6, 0.8], [-0.6, 0.8]]) {
      const nrm = [-d[1], d[0]];
      for (let c = -0.9; c <= 0.9; c += 0.075) {
        const p0 = [nrm[0] * c, 0.62 + nrm[1] * c];
        const seg = clipToConvex(inner, p0, d);
        if (!seg || seg[1] - seg[0] < 0.01) continue;
        const tm = (seg[0] + seg[1]) / 2;
        b.box(seg[1] - seg[0], 0.008, 0.02, { at: [p0[0] + d[0] * tm, p0[1] + d[1] * tm, 0],
          rot: [0, 0, Math.atan2(d[1], d[0])], color: lead, r: 0 });
      }
    }
    // rose: gold ring, red and purple petals round a green heart
    const rc = [0, 0.86];
    b.torus(0.158, 0.009, { at: [rc[0], rc[1], 0], color: lead, seg: 40, tubeSeg: 6 });
    b.extrude(circleShape(0.152), 0.016, { at: [rc[0], rc[1], 0], ...glow(J.gold), bevel: 0.002, curveSeg: 16 });
    b.extrude(circleShape(0.112), 0.02, { at: [rc[0], rc[1], 0], ...glow(J.pale), bevel: 0.002, curveSeg: 14 });
    b.torus(0.114, 0.007, { at: [rc[0], rc[1], 0], color: lead, seg: 36, tubeSeg: 5 });
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * TAU;
      b.box(0.04, 0.007, 0.026, { at: [rc[0] + Math.cos(ang) * 0.133, rc[1] + Math.sin(ang) * 0.133, 0], rot: [0, 0, ang],
        color: lead, r: 0 });
      b.group({ at: [rc[0] + Math.cos(ang) * 0.064, rc[1] + Math.sin(ang) * 0.064, 0], rot: [0, 0, ang] }, () => {
        b.extrude(circleShape(1), 0.024, { scale: [0.044, 0.022, 1], ...glow(k % 2 ? J.purple : J.red), bevel: 0, curveSeg: 8 });
      });
    }
    b.extrude(circleShape(0.026), 0.028, { at: [rc[0], rc[1], 0], ...glow(J.green), bevel: 0.002, curveSeg: 10 });
    b.torus(0.027, 0.006, { at: [rc[0], rc[1], 0], color: lead, seg: 18, tubeSeg: 5 });
    // lancet medallion below
    const lan = [];
    for (let i = 0; i <= 12; i++) {
      const s = i / 12;
      lan.push([0.085 * Math.pow(Math.sin(PI * s), 0.75), lerp(-0.16, 0.16, s)]);
    }
    const lancet = [...lan, ...lan.slice(1, -1).reverse().map(([x, y]) => [-x, y])];
    b.extrude(lancet, 0.016, { at: [0, 0.4, 0], ...glow(J.red), bevel: 0.002, curveSeg: 1 });
    b.extrude(lancet.map(([x, y]) => [x * 0.5, y * 0.62]), 0.02, { at: [0, 0.4, 0], ...glow(J.gold), bevel: 0.002, curveSeg: 1 });
    b.tube(lancet.map(([x, y]) => [x, 0.4 + y, 0]), 0.007, { color: lead, closed: true, seg: 48, radial: 5 });
    b.tube(lancet.map(([x, y]) => [x * 0.5, 0.4 + y * 0.62, 0]), 0.006, { color: lead, closed: true, seg: 40, radial: 5 });
    // trefoil in the apex
    for (let k = 0; k < 3; k++) {
      const ang = PI / 2 + (k * TAU) / 3;
      const at = [Math.cos(ang) * 0.03, 1.055 + Math.sin(ang) * 0.03, 0];
      b.extrude(circleShape(0.026), 0.018, { at, ...glow(k ? J.green : J.red), bevel: 0.002, curveSeg: 10 });
      b.torus(0.027, 0.005, { at, color: lead, seg: 18, tubeSeg: 4 });
    }
  },

  // A wrought-iron fire bowl on a scrolled tripod with a ring brace, heaped coals and a layered fire.
  brazier(b, p) {
    const iron = "#3b3632";
    const R = randomFor(b, p, 8);
    for (let k = 0; k < 3; k++) {
      const a = PI / 3 + (k * TAU) / 3;
      const P = (r, y) => [Math.sin(a) * r, y, Math.cos(a) * r];
      b.tube([P(0.07, 0.43), P(0.115, 0.33), P(0.148, 0.19), P(0.16, 0.07), P(0.172, 0.02), P(0.192, 0.016), P(0.2, 0.036),
        P(0.188, 0.046)], 0.011, { color: iron, seg: 36, radial: 6 });
    }
    b.torus(0.148, 0.008, { at: [0, 0.19, 0], rot: [PI / 2, 0, 0], color: iron, seg: 30, tubeSeg: 5 });
    const bowl = [[0, 0.4], [0.05, 0.402], [0.1, 0.415], [0.14, 0.44], [0.165, 0.47], [0.178, 0.5]];
    b.lathe(bowl, { color: iron, seg: 24 });
    b.lathe(bowl.slice().reverse().map(([r, y]) => [Math.max(0, r - 0.012), y + 0.004]), { color: shade(iron, -0.1), seg: 24 });
    b.torus(0.174, 0.011, { at: [0, 0.5, 0], rot: [PI / 2, 0, 0], color: shade(iron, 0.08), seg: 32, tubeSeg: 6 });
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      b.sphere(0.006, { at: [Math.sin(a) * 0.158, 0.455, Math.cos(a) * 0.158], color: shade(iron, 0.12), seg: 6 });
    }
    // coals and embers
    for (let k = 0; k < 14; k++) {
      const a = R() * TAU, r = Math.sqrt(R()) * 0.12;
      const s = 0.022 + R() * 0.014, glowing = k % 3 === 0;
      b.ico(s, { at: [Math.sin(a) * r, 0.468 + (0.12 - r) * 0.2 + R() * 0.008, Math.cos(a) * r], rot: [R(), R(), R()],
        color: glowing ? "#ff6a24" : shade("#2e2826", (R() - 0.5) * 0.1), kind: glowing ? "glow" : "matte", detail: 0,
        light: false });
    }
    // fire
    fire(b, [0, 0.47, 0], 0.235, 0.078, { light: true });
    fire(b, [0.065, 0.47, 0.02], 0.15, 0.05, { rot: [0.05, 0, -0.22] });
    fire(b, [-0.06, 0.47, 0.03], 0.16, 0.05, { rot: [0.05, 0, 0.2] });
    fire(b, [0.0, 0.47, -0.06], 0.17, 0.05, { rot: [-0.2, 0, 0.05] });
  },

  // A small square hedge maze carved from the seed: gravel paths, an entrance at the front marked with two
  // topiary balls and a golden orb on a pedestal at the centre. color = hedge.
  maze(b, p) {
    const hedge = p.color || "#4f9548";
    const R = randomFor(b, p, 9);
    const N = 7, S = 0.84, cell = S / N, t = 0.05, yb = 0.035, hh = 0.155;
    b.box(0.9, yb - 0.008, 0.9, { at: [0, (yb - 0.008) / 2, 0], color: shade(STONE, -0.12), r: 0.008, seg: 1 });
    b.box(0.88, 0.008, 0.88, { at: [0, yb - 0.004, 0], color: "#e4d6b0", r: 0 });
    // carve a perfect maze from the centre (iterative depth-first search)
    const seen = new Uint8Array(N * N);
    const vert = Array.from({ length: N }, () => Array(N + 1).fill(true)); // vert[j][i]: wall on x line i, row j
    const horz = Array.from({ length: N + 1 }, () => Array(N).fill(true)); // horz[j][i]: wall on z line j, column i
    const c0 = (N - 1) / 2;
    const stack = [[c0, c0]];
    seen[c0 * N + c0] = 1;
    while (stack.length) {
      const [i, j] = stack[stack.length - 1];
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([di, dj]) => [i + di, j + dj, di])
        .filter(([x, y]) => x >= 0 && y >= 0 && x < N && y < N && !seen[y * N + x]);
      if (!nb.length) {
        stack.pop();
        continue;
      }
      const [x, y, di] = nb[Math.floor(R() * nb.length) % nb.length];
      if (di) vert[j][Math.max(i, x)] = false;
      else horz[Math.max(j, y)][i] = false;
      seen[y * N + x] = 1;
      stack.push([x, y]);
    }
    horz[N][c0] = false; // the entrance at the front
    const X = (i) => -S / 2 + i * cell, Z = (j) => -S / 2 + j * cell;
    const hedgeBox = (x, z, w, d, low) =>
      b.box(w, hh - low, d, { at: [x, yb + (hh - low) / 2, z], color: shade(hedge, (R() - 0.5) * 0.05), r: 0.016, seg: 1 });
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i < N;) {
        if (!horz[j][i]) {
          i++;
          continue;
        }
        let k = i;
        while (k < N && horz[j][k]) k++;
        hedgeBox((X(i) + X(k)) / 2, Z(j), X(k) - X(i) + t, t, 0);
        i = k;
      }
    }
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j < N;) {
        if (!vert[j][i]) {
          j++;
          continue;
        }
        let k = j;
        while (k < N && vert[k][i]) k++;
        hedgeBox(X(i), (Z(j) + Z(k)) / 2, t, Z(k) - Z(j) + t, 0.004);
        j = k;
      }
    }
    // topiary balls at the entrance, the golden goal in the middle
    for (const i of [c0, c0 + 1]) b.sphere(0.034, { at: [X(i), yb + hh + 0.026, Z(N)], color: shade(hedge, 0.05), seg: 12 });
    b.cyl(0.02, 0.028, 0.12, { at: [0, yb + 0.06, 0], color: C.marble, seg: 12 });
    b.cyl(0.03, 0.03, 0.012, { at: [0, yb + 0.126, 0], color: C.marble, seg: 12 });
    b.sphere(0.03, { at: [0, yb + 0.16, 0], ...GOLD, seg: 14 });
  },
};
