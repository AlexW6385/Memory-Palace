// Props in the "knowledge" group. Each entry: name: (b, p) => void — see kit.js and docs/props.md.
// b is a Builder (metres, base on y = 0, facing +z); p holds the item's params:
//   { variant, color, color2, text, emoji, pose, hat, hold, seed }
//
// Style: crafted classroom / museum objects. Stands and frames share a walnut wood with brass accents,
// paper is warm ivory, and text sits on its surface in a colour that contrasts with it.
import * as THREE from "three";
import { C, shade, mix, rng, color } from "./kit.js";

const PI = Math.PI;
const TAU = 2 * PI;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const WALNUT = "#7a5639";
const WALNUT_DARK = "#56392a";
const PAPER = "#f6f0e1";
const PAGE = "#f1e8d2";
const PARCHMENT = "#eedbb0";
const INK = "#2b2f38";
const SEPIA = "#4b3222";
const CHALK = "#f2f0e6";
const GOLD = "#d6ad55";
const LIGHT_TEXT = "#fbf7ee";

// ── helpers ──────────────────────────────────────────────────────────────────
const smoothstep = (a, c, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (c - a)));
  return t * t * (3 - 2 * t);
};

/** Random numbers for a prop: from its own seed when it has one, so it looks the same in any scene. */
function randomFor(b, p) {
  return p.seed != null ? rng(p.seed * 31 + 7) : b.rng;
}

/** p.text as a plain string in the builder's language ("" when there is none). */
function textOf(b, t) {
  if (t == null) return "";
  if (typeof t === "string" || typeof t === "number") return String(t);
  return String(t[b.env.lang || "en"] ?? t.en ?? t.zh ?? "");
}

/** p.text in a form b.text accepts (keeps {en, zh}), or null when it is empty. */
function textParam(b, t) {
  if (!textOf(b, t).trim()) return null;
  return typeof t === "object" ? t : String(t);
}

/** Perceived brightness 0..1 of a colour. */
function brightness(c) {
  const hex = color(c).getHexString();
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), bl = parseInt(hex.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * bl) / 255;
}

/** Text colour that reads well on a surface of colour bg. */
function inkFor(bg, dark = INK, light = LIGHT_TEXT) {
  return brightness(bg) > 0.6 ? dark : light;
}

function eulerOf(q) {
  const e = new THREE.Euler().setFromQuaternion(q, "XYZ");
  return [e.x, e.y, e.z];
}

/** Euler rotation that turns +y towards dir. */
function aim(dir, spin = 0) {
  const q = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, new THREE.Vector3(...dir).normalize());
  if (spin) q.multiply(new THREE.Quaternion().setFromAxisAngle(Y_AXIS, spin));
  return eulerOf(q);
}

/** A square timber (box) running from A to B. */
function beam(b, A, B, w, d, o = {}) {
  const dir = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
  const len = Math.hypot(...dir);
  const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
  return b.box(w, len, d, { ...o, at: mid, rot: aim(dir) });
}

/** Rounded rectangle outline centred on the origin (counter-clockwise). */
function rrect(w, h, r, n = 5) {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4);
  const pts = [];
  const corners = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, PI / 2], [-w / 2 + r, -h / 2 + r, PI],
    [w / 2 - r, -h / 2 + r, 1.5 * PI]];
  for (const [x, y, a0] of corners) {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (PI / 2);
      pts.push([x + r * Math.cos(a), y + r * Math.sin(a)]);
    }
  }
  return pts;
}

const circle2 = (r, n = 32, cx = 0, cy = 0) =>
  Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * TAU), cy + r * Math.sin((i / n) * TAU)]);

const ellipse2 = (a, e, n = 28, cx = 0, cy = 0) =>
  Array.from({ length: n }, (_, i) => [cx + a * Math.cos((i / n) * TAU), cy + e * Math.sin((i / n) * TAU)]);

/** Pie sector outline from angle a0 to a1. */
function sector2(r, a0, a1, n = 16) {
  const pts = [[0, 0]];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}

/** Five-pointed star outline. */
function star2(R, r = R * 0.45) {
  return Array.from({ length: 10 }, (_, i) => {
    const a = PI / 2 + (i * PI) / 5, q = i % 2 ? r : R;
    return [q * Math.cos(a), q * Math.sin(a)];
  });
}

/** A thin flat shape (no bevel) in the xy plane at depth z: used for painted and printed details. */
function flat(b, pts, z, color, o = {}) {
  return b.extrude(pts, o.depth ?? 0.0012, { at: [o.x ?? 0, o.y ?? 0, z], bevel: 0, color, kind: o.kind, curveSeg: 6 });
}

/** Four bars forming a rectangular outline of outer size w × h centred at `at` (facing +z). */
function rectFrame(b, w, h, lw, at, o = {}) {
  const [x, y, z] = at, d = o.depth ?? 0.0015;
  const opt = { color: o.color, kind: o.kind, r: o.r ?? 0 };
  b.box(w, lw, d, { ...opt, at: [x, y + (h - lw) / 2, z] });
  b.box(w, lw, d, { ...opt, at: [x, y - (h - lw) / 2, z] });
  b.box(lw, h - 2 * lw, d, { ...opt, at: [x + (w - lw) / 2, y, z] });
  b.box(lw, h - 2 * lw, d, { ...opt, at: [x - (w - lw) / 2, y, z] });
}

/** Smooth grid surface from fn(u, v) -> [x, y, z]; the front face points along du × dv (flip reverses it). */
function surface(nu, nv, fn, { flip = false, wrapU = false } = {}) {
  const pos = [], idx = [];
  const cols = wrapU ? nu : nu + 1;
  for (let j = 0; j <= nv; j++) for (let i = 0; i < cols; i++) pos.push(...fn(i / nu, j / nv));
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const i1 = wrapU ? (i + 1) % nu : i + 1;
      const a = j * cols + i, b1 = j * cols + i1, c = (j + 1) * cols + i, d = (j + 1) * cols + i1;
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

/** A tube through pts whose radius runs from r0 to r1 (rotation-minimising frames); o.caps rounds the ends. */
function taperTube(b, pts, r0, r1, o = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q)), !!o.closed, "centripetal");
  const n = o.seg ?? Math.max(16, pts.length * 4), radial = o.radial ?? 10;
  const P = [], T = [], N = [];
  for (let i = 0; i <= n; i++) {
    P.push(curve.getPointAt(i / n));
    T.push(curve.getTangentAt(i / n).normalize());
  }
  let nrm = new THREE.Vector3(0, 0, 1).cross(T[0]);
  if (nrm.lengthSq() < 1e-6) nrm = new THREE.Vector3(1, 0, 0).cross(T[0]);
  nrm.normalize();
  N.push(nrm.clone());
  for (let i = 1; i <= n; i++) {
    const axis = new THREE.Vector3().crossVectors(T[i - 1], T[i]);
    const s = axis.length();
    if (s > 1e-9) nrm.applyAxisAngle(axis.divideScalar(s), Math.atan2(s, T[i - 1].dot(T[i])));
    nrm.addScaledVector(T[i], -nrm.dot(T[i])).normalize();
    N.push(nrm.clone());
  }
  const rad = (i) => (typeof r0 === "function" ? r0(i / n) : r0 + (r1 - r0) * (i / n));
  const pos = [], nor = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const r = rad(i);
    const Bv = new THREE.Vector3().crossVectors(T[i], N[i]);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU;
      const d = new THREE.Vector3().addScaledVector(N[i], Math.cos(a)).addScaledVector(Bv, Math.sin(a));
      pos.push(P[i].x + d.x * r, P[i].y + d.y * r, P[i].z + d.z * r);
      nor.push(d.x, d.y, d.z);
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, a2 = a + radial + 1;
      idx.push(a, a + 1, a2, a + 1, a2 + 1, a2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  b.geo(g, { color: o.color, kind: o.kind });
  if (o.caps) {
    b.sphere(rad(0), { at: P[0].toArray(), color: o.color, kind: o.kind, seg: radial + 2 });
    b.sphere(rad(n), { at: P[n].toArray(), color: o.color, kind: o.kind, seg: radial + 2 });
  }
  return { P, T };
}

/** Little bevelled feet at ±x. */
function feet(b, x, w, h, d, col, z = 0) {
  for (const s of [-1, 1]) b.box(w, h, d, { at: [s * x, h / 2, z], color: col, r: Math.min(h, w, d) * 0.3 });
}

// ── books ────────────────────────────────────────────────────────────────────
const BOOK_HUES = ["#a5243a", "#2b4c8c", "#2f6b4f", "#6b4aa0", "#b0652a", "#23807c", "#8a3b22", "#c9a13c"];

/**
 * A closed hardback standing upright: front cover facing +z, spine on the left (-x), bottom on y = 0.
 * title: text for a paper label on the cover, or null for a gold lozenge.
 */
function uprightBook(b, W, H, D, cover, title) {
  const t = Math.max(0.004, D * 0.13); // board thickness
  const sw = Math.min(0.024, D * 0.46); // spine width
  const xl = -W / 2 + sw * 0.5, xr = W / 2;
  // page block with a few page lines on the fore-edge
  b.box(xr - xl, H - 0.012, D - 2 * t, { at: [(xl + xr) / 2 - 0.004, H / 2, 0], color: PAGE, r: 0.0015 });
  for (const f of [-0.5, 0, 0.5]) {
    b.box(0.0012, H - 0.018, 0.0011, { at: [xr - 0.0038, H / 2, (f * (D - 2 * t)) / 2], color: "#d9ccb0", r: 0 });
  }
  // boards and a rounded spine
  for (const s of [1, -1]) {
    b.box(xr - xl, H, t, { at: [(xl + xr) / 2, H / 2, s * (D / 2 - t / 2)], color: cover, r: Math.min(0.003, t * 0.45) });
  }
  b.box(sw, H, D, { at: [-W / 2 + sw / 2, H / 2, 0], color: shade(cover, -0.03), r: Math.min(sw, D) * 0.45 });
  for (const y of [0.12, 0.88]) {
    b.box(0.004, Math.max(0.005, H * 0.028), D * 0.74, { at: [-W / 2 + 0.0016, H * y, 0], color: GOLD, kind: "metal",
      r: 0.0015 });
  }
  // gold rule frame on the front cover
  const zf = D / 2;
  const m = Math.min(0.012, W * 0.07), lw = Math.max(0.0022, W * 0.018);
  const fw = xr - xl - 2 * m, fh = H - 2 * m, cx = (xl + xr) / 2;
  rectFrame(b, fw, fh, lw, [cx, H / 2, zf + 0.0004], { color: GOLD, kind: "metal", depth: 0.0012 });
  if (title) {
    const pw = fw - 0.018, ph = Math.min(fh * 0.44, pw * 0.85);
    b.box(pw, ph, 0.0016, { at: [cx, H * 0.6, zf + 0.0008], color: PAPER, r: 0 });
    rectFrame(b, pw - 0.008, ph - 0.008, 0.0015, [cx, H * 0.6, zf + 0.0017], { color: shade(cover, 0.05), depth: 0.0004 });
    b.text(title, { at: [cx, H * 0.6, zf + 0.0035], w: pw - 0.01, h: ph - 0.01, fg: INK, font: "display" });
  } else {
    const s = W * 0.13;
    b.box(s, s, 0.0016, { at: [cx, H * 0.58, zf + 0.0008], rot: [0, 0, PI / 4], color: GOLD, kind: "metal", r: 0 });
    for (const dy of [-1, 1]) {
      b.box(fw * 0.55, lw, 0.0012, { at: [cx, H * 0.58 + dy * W * 0.17, zf + 0.0004], color: GOLD, kind: "metal", r: 0 });
    }
  }
}

/** A hardback lying flat on y = 0 with its spine facing +z. */
function flatBook(b, w, h, d, cover, label) {
  const t = Math.min(0.006, h * 0.15);
  const sw = Math.min(h * 0.9, 0.028);
  b.box(w - 0.01, h - 2 * t + 0.001, d - 0.012, { at: [0, h / 2, -0.002], color: PAGE, r: 0.0012 });
  for (const f of [-0.25, 0.25]) {
    b.box(w - 0.012, 0.0011, 0.0012, { at: [0, h / 2 + f * (h - 2 * t), -d / 2 + 0.0039], color: "#d9ccb0", r: 0 });
  }
  for (const y of [t / 2, h - t / 2]) {
    b.box(w, t, d - sw * 0.4, { at: [0, y, -sw * 0.2], color: cover, r: Math.min(0.0025, t * 0.4) });
  }
  b.box(w, h, sw, { at: [0, h / 2, d / 2 - sw / 2], color: shade(cover, -0.03), r: Math.min(h, sw) * 0.42 });
  for (const s of [-1, 1]) {
    b.box(0.005, h * 0.7, 0.003, { at: [s * (w / 2 - 0.03), h / 2, d / 2 + 0.0004], color: GOLD, kind: "metal", r: 0.001 });
  }
  b.box(w * 0.36, h * 0.44, 0.002, { at: [0, h / 2, d / 2 + 0.0003], color: label, r: 0 });
}

// ── pencil ───────────────────────────────────────────────────────────────────
/**
 * Hexagonal painted body from y0 to the sharpening line, a sharpened wooden cone with the paint ending in
 * scallops (where the cone cuts the corners deeper than the faces), and a graphite point at yTop.
 */
function pencilBody(b, R, y0, yb, yTop, yLead, paint, wood, lead) {
  const k = R / (yTop - yb); // cone radius per metre below the tip
  const corner = (i) => {
    const a = PI / 6 + (i * PI) / 3;
    return [R * Math.sin(a), R * Math.cos(a)];
  };
  const NU = 8, NV = 4;
  const pp = [], pn = [], wp = [], wn = [];
  const quad = (arr, nor, A, B, Cq, D, nA, nB, nC, nD) => {
    arr.push(...A, ...B, ...Cq, ...A, ...Cq, ...D);
    nor.push(...nA, ...nB, ...nC, ...nA, ...nC, ...nD);
  };
  const coneN = (x, z) => {
    const l = Math.hypot(x, z) || 1, v = new THREE.Vector3(x / l, k, z / l).normalize();
    return [v.x, v.y, v.z];
  };
  for (let f = 0; f < 6; f++) {
    const c0 = corner(f), c1 = corner(f + 1);
    const mid = [(c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2];
    const ml = Math.hypot(...mid), fn = [mid[0] / ml, 0, mid[1] / ml];
    for (let j = 0; j < NU; j++) {
      const P = [0, 1].map((e) => {
        const u = (j + e) / NU;
        return [c0[0] + (c1[0] - c0[0]) * u, c0[1] + (c1[1] - c0[1]) * u];
      });
      const top = P.map(([x, z]) => yTop - Math.hypot(x, z) / k);
      quad(pp, pn, [P[0][0], y0, P[0][1]], [P[1][0], y0, P[1][1]], [P[1][0], top[1], P[1][1]], [P[0][0], top[0], P[0][1]],
        fn, fn, fn, fn);
      for (let r = 0; r < NV; r++) {
        const pt = (e, rr) => {
          const y = top[e] + (yLead - top[e]) * (rr / NV);
          const rad = k * (yTop - y), l = Math.hypot(P[e][0], P[e][1]);
          return [(P[e][0] / l) * rad, y, (P[e][1] / l) * rad];
        };
        const A = pt(0, r), B = pt(1, r), Cq = pt(1, r + 1), D = pt(0, r + 1);
        quad(wp, wn, A, B, Cq, D, coneN(A[0], A[2]), coneN(B[0], B[2]), coneN(Cq[0], Cq[2]), coneN(D[0], D[2]));
      }
    }
  }
  for (const [pos, nor, col] of [[pp, pn, paint], [wp, wn, wood]]) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    b.geo(g, { color: col });
  }
  const rl = k * (yTop - yLead);
  b.lathe([[rl, 0], [rl * 0.55, (yTop - yLead) * 0.55], [rl * 0.12, (yTop - yLead) * 0.96], [0, yTop - yLead]],
    { at: [0, yLead, 0], color: lead, kind: "gloss", seg: 18 });
}

// ── builders ─────────────────────────────────────────────────────────────────
export default {
  // A closed hardback standing upright: coloured boards, rounded spine with gold bands, cream page edges,
  // a gold rule on the cover and the title on a paper label. color = cover.
  book(b, p) {
    const R = randomFor(b, p);
    const cover = p.color || R.pick(BOOK_HUES);
    uprightBook(b, 0.18, 0.26, 0.05, cover, textParam(b, p.text));
  },

  // Six hardbacks lying in a slightly untidy pile, biggest at the bottom; most show their spines.
  book_stack(b, p) {
    const R = randomFor(b, p);
    const hues = BOOK_HUES.slice();
    for (let i = hues.length - 1; i > 0; i--) {
      const j = Math.floor(R() * (i + 1));
      [hues[i], hues[j]] = [hues[j], hues[i]];
    }
    const books = Array.from({ length: 6 }, (_, i) => ({ w: R.range(0.21, 0.265), d: R.range(0.15, 0.19),
      h: R.range(0.038, 0.06), col: hues[i] }));
    books.sort((a, c) => c.w * c.d - a.w * a.d);
    const k = 0.298 / books.reduce((s, x) => s + x.h, 0);
    let y = 0;
    books.forEach((bk, i) => {
      const h = bk.h * k;
      const flip = i === 2 || (i === 4 && R() < 0.5);
      const label = R() < 0.5 ? PAPER : mix(bk.col, "#000000", 0.35);
      b.group({ at: [R.range(-0.01, 0.01), y, R.range(-0.008, 0.008)], rot: [0, R.range(-0.13, 0.13) + (flip ? PI : 0), 0] },
        () => flatBook(b, bk.w, h, bk.d, bk.col, label));
      y += h;
    });
  },

  // An open book on a walnut reading stand: two curved page blocks over the covers, a ribbon, the text on the
  // left page and lines of writing on the right. color = cover.
  open_book(b, p) {
    const cover = p.color || "#8a2f3a";
    const th = 0.5, Lb = 0.34;
    const sin = Math.sin(th), cos = Math.cos(th);
    const baseTop = 0.024;
    const yc = baseTop + 0.004 + 0.01 * cos + (Lb / 2) * sin;
    b.box(0.46, baseTop, 0.29, { at: [0, baseTop / 2, -0.012], color: WALNUT_DARK, r: 0.008 });
    // side cheeks under the slanted board
    const under = (zw) => {
      const zl = (zw + 0.01 * sin) / cos;
      return yc - 0.01 * cos - zl * sin;
    };
    const zFront = 0.11, zBack = -0.15;
    const cheek = [[-zFront, baseTop], [-zBack, baseTop], [-zBack, under(zBack)], [-zFront, under(zFront)]];
    for (const s of [-1, 1]) b.extrude(cheek, 0.016, { at: [s * 0.19, 0, 0], rot: [0, PI / 2, 0], color: WALNUT, bevel: 0.002 });
    b.group({ at: [0, yc, 0], rot: [th, 0, 0] }, () => {
      b.box(0.48, 0.02, Lb, { color: WALNUT, r: 0.006 });
      b.box(0.48, 0.04, 0.018, { at: [0, 0.01, Lb / 2 - 0.009], color: WALNUT_DARK, r: 0.006 });
      // covers and spine
      for (const s of [-1, 1]) b.box(0.232, 0.006, 0.3, { at: [s * 0.118, 0.013, -0.006], color: cover, r: 0.002 });
      b.cyl(0.012, 0.012, 0.3, { at: [0, 0.018, -0.006], rot: [PI / 2, 0, 0], color: shade(cover, -0.06), seg: 12 });
      // page blocks: flat-topped pages that rise into a curl at the gutter
      const slope = 0.065, yOut = 0.031;
      const pageY = (x) => yOut + (0.226 - x) * slope;
      const prof = [[0.002, 0.016], [0.226, 0.016], [0.226, yOut], [0.035, pageY(0.035)], [0.02, 0.0428], [0.011, 0.0395],
        [0.005, 0.033], [0.002, 0.026]];
      b.mirrorX(() => b.extrude(prof, 0.282, { at: [0, 0, -0.006], color: PAGE, bevel: 0.0012 }));
      // page lines on the outer edges
      b.mirrorX(() => {
        for (const y of [0.021, 0.026]) b.box(0.0012, 0.0008, 0.276, { at: [0.2273, y, -0.006], color: "#d6c9ad", r: 0 });
      });
      const ang = Math.atan(slope);
      const lines = (side) => b.group({ at: [side * 0.13, pageY(0.13) + 0.0016, -0.006], rot: [0, 0, side * -ang] }, () => {
        b.box(0.11, 0.0012, 0.012, { at: [-0.02, 0, -0.112], color: "#6f6658", r: 0 });
        for (let i = 0; i < 10; i++) {
          const len = i % 4 === 3 ? 0.09 : 0.15;
          b.box(len, 0.001, 0.0062, { at: [-0.075 + len / 2, 0, -0.085 + i * 0.021], color: "#a39a8b", r: 0 });
        }
      });
      const text = textParam(b, p.text);
      lines(1);
      if (text) {
        b.group({ at: [-0.13, pageY(0.13) + 0.0028, -0.006], rot: [0, 0, ang] }, () => {
          b.text(text, { rot: [-PI / 2, 0, 0], w: 0.18, h: 0.25, fg: "#1f2128", font: "display", weight: "600" });
        });
      } else lines(-1);
      // ribbon bookmark lying in the gutter and hanging over the front edge
      b.box(0.012, 0.0012, 0.26, { at: [0.016, 0.0435, 0.012], rot: [0, 0, -0.25], color: "#c0392b", r: 0 });
      b.group({ at: [0.02, 0.03, 0.152], rot: [-1.05, 0, 0] }, () => {
        b.extrude([[-0.006, 0], [0.006, 0], [0.006, -0.05], [0, -0.042], [-0.006, -0.05]], 0.0012,
          { color: "#c0392b", bevel: 0 });
      });
    });
  },

  // An unrolled parchment between two wooden rollers with brass knobs, standing in a walnut base.
  scroll(b, p) {
    b.box(0.5, 0.024, 0.062, { at: [0, 0.012, 0], color: WALNUT_DARK, r: 0.01 });
    const X = 0.212, y0 = 0.064, y1 = 0.31;
    const knob = [[0, 0], [0.008, 0], [0.007, 0.007], [0.013, 0.014], [0.016, 0.022], [0.013, 0.031], [0.006, 0.037],
      [0, 0.04]];
    for (const s of [-1, 1]) {
      const x = s * X;
      b.cyl(0.0085, 0.0085, y1 - y0 + 0.02, { at: [x, (y0 + y1) / 2, 0], color: WALNUT, seg: 10 });
      b.lathe(knob, { at: [x, y0, 0], scale: [1, -1, 1], color: GOLD, kind: "metal", seg: 14 });
      b.lathe(knob, { at: [x, y1, 0], color: GOLD, kind: "metal", seg: 14 });
      b.cyl(0.024, 0.024, y1 - y0 - 0.004, { at: [x, (y0 + y1) / 2, 0], color: shade(PARCHMENT, -0.04), seg: 20 });
      for (const y of [y0 + 0.003, y1 - 0.003]) {
        b.torus(0.0205, 0.0022, { at: [x, y, 0], rot: [PI / 2, 0, 0], color: shade(PARCHMENT, -0.18), seg: 20, tubeSeg: 5 });
      }
    }
    const sh = y1 - y0 - 0.012, sy = (y0 + y1) / 2, zs = 0.016;
    b.box(2 * X, sh, 0.0035, { at: [0, sy, zs], color: PARCHMENT, r: 0 });
    const zf = zs + 0.00175;
    rectFrame(b, 2 * X - 0.075, sh - 0.03, 0.003, [0, sy, zf + 0.0004], { color: "#a0563a", depth: 0.0008 });
    const text = textParam(b, p.text);
    if (text) {
      b.text(text, { at: [0, sy, zf + 0.003], w: 2 * X - 0.1, h: sh - 0.05, fg: SEPIA, font: "display" });
    } else {
      for (let i = 0; i < 6; i++) {
        const len = i === 5 ? 0.16 : 0.27;
        b.box(len, 0.007, 0.0008, { at: [-0.135 + len / 2, sy + 0.075 - i * 0.03, zf + 0.0004], color: "#7a5a44", r: 0 });
      }
      b.cyl(0.02, 0.021, 0.006, { at: [0.12, sy - 0.07, zf + 0.003], rot: [PI / 2, 0, 0], color: "#b0262e", kind: "gloss",
        seg: 16 });
    }
  },

  // A thick stack of paper bundles with slightly uneven edges, loose sheets on top (one written on) and a clip.
  paper_stack(b, p) {
    const R = randomFor(b, p);
    const W = 0.25, D = 0.19, n = 19, t = 0.0084;
    const tones = [PAPER, "#fbfaf5", "#ece5d4", "#f8f4ea"];
    let y = 0;
    for (let i = 0; i < n; i++) {
      b.box(W, t, D, { at: [R.range(-0.007, 0.007), y + t / 2, R.range(-0.006, 0.006)], rot: [0, R.range(-0.035, 0.035), 0],
        color: tones[R.int(0, 3)], r: 0 });
      y += t;
    }
    b.box(W, 0.0016, D, { at: [0.01, y + 0.0008, -0.004], rot: [0, -0.08, 0], color: "#fbfaf6", r: 0 });
    y += 0.0016;
    b.group({ at: [-0.006, y + 0.0008, 0.004], rot: [0, 0.06, 0] }, () => {
      b.box(W, 0.0016, D, { color: "#fdfcf8", r: 0 });
      b.box(0.11, 0.0012, 0.012, { at: [-0.055, 0.001, -0.07], color: "#5d6068", r: 0 });
      for (let i = 0; i < 7; i++) {
        const len = i === 6 ? 0.1 : 0.2;
        b.box(len, 0.001, 0.0055, { at: [-0.1 + len / 2, 0.001, -0.045 + i * 0.019], color: "#9a968e", r: 0 });
      }
      // paper clip on the corner
      const clip = (L, a, z) => b.tube(rrect(a, L, a / 2 - 0.0002, 4).map(([u, v]) => [-0.1 + u, 0.0028, z + v]), 0.0016,
        { closed: true, color: "#c3c8cf", kind: "metal", seg: 48, radial: 5 });
      clip(0.042, 0.014, -0.078);
      clip(0.03, 0.009, -0.074);
    });
  },

  // A giant yellow pencil standing on its eraser: hexagonal painted body, crimped metal ferrule, a sharpened
  // wooden cone with scalloped paint and a graphite point. color = paint.
  pencil(b, p) {
    const paint = p.color || C.yellow;
    b.lathe([[0, 0], [0.024, 0], [0.031, 0.005], [0.0335, 0.012], [0.0335, 0.058]], { color: "#ec8b98", seg: 20 });
    b.cyl(0.0385, 0.0385, 0.066, { at: [0, 0.087, 0], color: "#cfc8b6", kind: "metal", seg: 22 });
    for (const y of [0.063, 0.071, 0.103, 0.111]) {
      b.torus(0.0385, 0.0026, { at: [0, y, 0], rot: [PI / 2, 0, 0], color: "#bdb6a2", kind: "metal", seg: 22, tubeSeg: 5 });
    }
    pencilBody(b, 0.037, 0.115, 0.455, 0.6, 0.562, paint, "#e8c48f", "#3a3b40");
    // a thin printed band near the ferrule
    b.cyl(0.0372, 0.0372, 0.008, { at: [0, 0.135, 0], color: shade(paint, -0.25), seg: 6, rot: [0, PI / 6, 0], flat: true });
  },

  // A green chalkboard in a wooden frame on an A-frame easel, with a chalk tray, chalk and a duster.
  // text is chalked on it (\n for new lines); without text it shows Pythagoras.
  blackboard(b, p) {
    const wood = "#9a6b43", frame = "#b27c4b", slate = "#2f4b3f";
    const lean = 0.11;
    const zAt = (y) => 0.1 - lean * y;
    for (const s of [-1, 1]) {
      beam(b, [s * 0.46, 0, zAt(0)], [s * 0.41, 1.09, zAt(1.09)], 0.04, 0.03, { color: wood, r: 0.008 });
      b.cyl(0.008, 0.008, 0.05, { at: [s * 0.425, 0.372, zAt(0.372) + 0.03], rot: [PI / 2, 0, 0], color: WALNUT_DARK, seg: 8 });
    }
    b.box(0.86, 0.035, 0.026, { at: [0, 1.06, zAt(1.06)], color: wood, r: 0.008 });
    b.box(0.9, 0.03, 0.022, { at: [0, 0.16, zAt(0.16)], color: wood, r: 0.007 });
    beam(b, [0, 1.05, zAt(1.05) - 0.03], [0, 0, -0.235], 0.04, 0.03, { color: shade(wood, -0.06), r: 0.008 });
    b.rod([0, 0.3, -0.18], [0, 0.16, zAt(0.16) - 0.01], 0.007, { color: C.iron, kind: "metal", seg: 6 });
    const zb = zAt(0.71) + 0.015 + 0.01;
    b.group({ at: [0, 0.71, zb], rot: [-Math.atan(lean), 0, 0] }, () => {
      b.box(0.9, 0.62, 0.02, { color: shade(frame, -0.15), r: 0.004 });
      b.box(0.84, 0.56, 0.012, { at: [0, 0, 0.012], color: slate, r: 0 });
      for (const s of [-1, 1]) {
        b.box(0.92, 0.04, 0.032, { at: [0, s * 0.3, 0.012], color: frame, r: 0.008 });
        b.box(0.04, 0.56, 0.032, { at: [s * 0.44, 0, 0.012], color: frame, r: 0.008 });
      }
      // chalk tray with chalk and a felt duster
      b.box(0.86, 0.012, 0.05, { at: [0, -0.31, 0.05], color: frame, r: 0.004 });
      b.box(0.86, 0.018, 0.008, { at: [0, -0.302, 0.074], color: shade(frame, -0.05), r: 0.003 });
      for (const [x, c] of [[0.2, "#f7f5ee"], [0.29, "#f3d36b"], [0.34, "#f2a7b8"]]) {
        b.cyl(0.0065, 0.0065, 0.06, { at: [x, -0.297, 0.048], rot: [0, 0, PI / 2], color: c, seg: 8 });
      }
      b.box(0.1, 0.024, 0.04, { at: [-0.26, -0.29, 0.05], color: "#c89a62", r: 0.005 });
      b.box(0.1, 0.008, 0.04, { at: [-0.26, -0.3, 0.05], color: "#6d7178", r: 0.002 });
      const zf = 0.018;
      const text = textParam(b, p.text);
      if (text) {
        b.text(text, { at: [0, 0.01, zf + 0.003], w: 0.8, h: 0.5, fg: CHALK, font: "chalk" });
      } else {
        b.text("a² + b² = c²", { at: [-0.15, 0.04, zf + 0.003], w: 0.48, h: 0.2, fg: CHALK, font: "chalk" });
        const chalk = (A, B) => {
          const dx = B[0] - A[0], dy = B[1] - A[1];
          b.box(Math.hypot(dx, dy) + 0.006, 0.0065, 0.001, { at: [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, zf + 0.0006],
            rot: [0, 0, Math.atan2(dy, dx)], color: CHALK, r: 0 });
        };
        const A = [0.14, -0.17], B = [0.36, -0.17], Cc = [0.14, 0.15];
        chalk(A, B); chalk(A, Cc); chalk(B, Cc);
        chalk([0.165, -0.17], [0.165, -0.145]); chalk([0.14, -0.145], [0.165, -0.145]);
        b.text("a", { at: [0.11, -0.01, zf + 0.003], w: 0.05, h: 0.07, fg: CHALK, font: "chalk" });
        b.text("b", { at: [0.25, -0.21, zf + 0.003], w: 0.05, h: 0.07, fg: CHALK, font: "chalk" });
        b.text("c", { at: [0.28, 0.0, zf + 0.003], w: 0.05, h: 0.07, fg: CHALK, font: "chalk" });
        chalk([-0.36, -0.06], [0.04, -0.06]);
      }
    });
  },

  // A painting on an artist's A-frame easel with a canvas tray, mast and top clamp.
  // color = easel wood, color2 = the painting's main colour (hills, clothes, the big Mondrian block).
  easel(b, p) {
    const v = ["landscape", "portrait", "abstract"].includes(p.variant) ? p.variant : "landscape";
    const wood = p.color || "#a0703f";
    const dark = shade(wood, -0.08);
    const lean = 0.1;
    const zL = (y) => 0.11 - lean * y;
    const [cw, ch] = v === "portrait" ? [0.38, 0.5] : v === "abstract" ? [0.44, 0.44] : [0.5, 0.37];
    const trayY = 0.5;
    for (const s of [-1, 1]) beam(b, [s * 0.27, 0, zL(0)], [s * 0.04, 1.14, zL(1.14)], 0.032, 0.026, { color: wood, r: 0.007 });
    beam(b, [0, 0.2, zL(0.2) - 0.004], [0, 1.19, zL(1.19) - 0.004], 0.03, 0.024, { color: dark, r: 0.007 });
    b.sphere(0.018, { at: [0, 1.19, zL(1.19) - 0.004], color: dark, seg: 12 });
    beam(b, [0, 1.1, zL(1.1) - 0.03], [0, 0, -0.31], 0.03, 0.024, { color: dark, r: 0.007 });
    b.box(0.46, 0.025, 0.02, { at: [0, 0.2, zL(0.2)], color: wood, r: 0.006 });
    // canvas tray
    b.box(0.58, 0.022, 0.066, { at: [0, trayY - 0.011, zL(trayY) + 0.033], color: wood, r: 0.006 });
    b.box(0.58, 0.02, 0.008, { at: [0, trayY + 0.006, zL(trayY) + 0.062], color: dark, r: 0.003 });
    // canvas with the painting on its front face
    const yc = trayY + ch / 2;
    b.group({ at: [0, yc, zL(yc) + 0.034], rot: [-Math.atan(lean), 0, 0] }, () => {
      b.box(cw, ch, 0.024, { at: [0, 0, -0.012], color: "#f3efe6", r: 0.003 });
      if (v === "landscape") paintLandscape(b, cw, ch, p.color2 || "#5fa04e");
      else if (v === "portrait") paintPortrait(b, cw, ch, p.color2 || "#2e4a7a");
      else paintAbstract(b, cw, ch, p.color2 || "#d0392f");
    });
    b.box(0.05, 0.035, 0.045, { at: [0, trayY + ch + 0.016, zL(trayY + ch) + 0.02], color: dark, r: 0.008 });
    // a little palette hanging off the tray
    b.group({ at: [-0.21, trayY - 0.03, zL(trayY) + 0.068], rot: [0.1, 0, 0.35] }, () => {
      const pal = ellipse2(0.06, 0.042, 24);
      b.extrude(pal, 0.004, { color: "#d9b07a", bevel: 0.0015 });
      for (const [x, y, c] of [[-0.03, 0.018, "#d0392f"], [0.0, 0.026, "#f0c64a"], [0.03, 0.016, "#3f74c4"], [0.038, -0.012, "#4f9a58"]]) {
        b.sphere(0.008, { at: [x, y, 0.004], scale: [1, 1, 0.5], color: c, kind: "gloss", seg: 8 });
      }
    });
  },

  // A small sign on a post: a coloured board with a brass rule and screws, text in a contrasting colour.
  plaque(b, p) {
    const col = p.color || "#2f5b4f";
    b.box(0.15, 0.03, 0.08, { at: [0, 0.015, -0.004], color: WALNUT_DARK, r: 0.01 });
    b.box(0.036, 0.42, 0.03, { at: [0, 0.24, -0.012], color: WALNUT, r: 0.008 });
    const yc = 0.465, w = 0.42, h = 0.27, t = 0.028;
    b.box(w, h, t, { at: [0, yc, 0.006], color: col, r: 0.012 });
    const zf = 0.006 + t / 2;
    const m = 0.026;
    rectFrame(b, w - 2 * m, h - 2 * m, 0.006, [0, yc, zf + 0.0006], { color: GOLD, kind: "metal" });
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        b.cyl(0.0072, 0.0072, 0.004, { at: [sx * (w / 2 - 0.013), yc + sy * (h / 2 - 0.013), zf + 0.001], rot: [PI / 2, 0, 0],
          color: GOLD, kind: "metal", seg: 10 });
      }
    }
    const text = textParam(b, p.text);
    if (text) b.text(text, { at: [0, yc, zf + 0.003], w: w - 2 * m - 0.02, h: h - 2 * m - 0.02, fg: inkFor(col), font: "body" });
    else flat(b, star2(0.05), zf + 0.0006, "#e8c25e", { y: yc });
  },

  // A cloth banner stretched between two poles with brass finials, tied at the corners, with a gold fringe.
  banner(b, p) {
    const cloth = p.color || C.crimson;
    const X = 0.565;
    for (const s of [-1, 1]) {
      b.cyl(0.046, 0.05, 0.026, { at: [s * X, 0.013, 0], color: WALNUT_DARK, seg: 18 });
      b.cyl(0.018, 0.02, 1.03, { at: [s * X, 0.541, 0], color: WALNUT, seg: 12 });
      b.cyl(0.021, 0.023, 0.014, { at: [s * X, 1.045, 0], color: GOLD, kind: "metal", seg: 12 });
      b.sphere(0.03, { at: [s * X, 1.07, 0], color: GOLD, kind: "metal", seg: 14 });
    }
    const W = 2 * X - 0.03, H = 0.47, y0 = 0.5;
    const zc = (u) => 0.012 * smoothstep(0, 0.14, u) * smoothstep(0, 0.14, 1 - u);
    b.geo(surface(32, 4, (u, v) => [-W / 2 + u * W, y0 + v * H, zc(u) + 0.0025]), { color: cloth });
    b.geo(surface(32, 4, (u, v) => [-W / 2 + u * W, y0 + v * H, zc(u) - 0.0025], { flip: true }), { color: shade(cloth, -0.06) });
    const along = (y, n = 24) => Array.from({ length: n + 1 }, (_, i) => [-W / 2 + (i / n) * W, y, zc(i / n)]);
    b.tube(along(y0 + H), 0.009, { color: shade(cloth, -0.1), radial: 8, seg: 48 });
    b.tube(along(y0), 0.006, { color: GOLD, kind: "metal", radial: 6, seg: 48 });
    for (const s of [-1, 1]) {
      for (const y of [y0 + 0.02, y0 + H - 0.02]) {
        b.torus(0.025, 0.005, { at: [s * X, y, 0], rot: [PI / 2, 0, 0], color: "#e2cc8f", seg: 16, tubeSeg: 6 });
      }
    }
    for (let i = 0; i < 13; i++) {
      const u = (i + 0.5) / 13, x = -W / 2 + u * W, z = zc(u);
      b.sphere(0.0065, { at: [x, y0 - 0.008, z], color: GOLD, kind: "metal", seg: 8 });
      b.cyl(0.0025, 0.0085, 0.032, { at: [x, y0 - 0.03, z], color: "#e3be5c", seg: 8 });
    }
    const zf = 0.012 + 0.0025;
    const text = textParam(b, p.text);
    if (text) {
      b.text(text, { at: [0, y0 + H / 2, zf + 0.004], w: 0.86, h: H - 0.1, fg: inkFor(cloth, INK, "#fbeec2"), font: "display" });
    } else {
      flat(b, star2(0.1), zf + 0.0006, "#f2cf63", { y: y0 + H / 2, depth: 0.002 });
    }
  },

  // A floating comic speech bubble: puffy white rounded shape with a tail, a dark outline behind, text inside.
  speech_bubble(b, p) {
    const W = 0.53, H = 0.25, r = 0.11, tailH = 0.085;
    const outline = speechOutline(W, H, r, { x0: -0.15, x1: -0.035, tip: [-0.225, -H / 2 - tailH] });
    const cy = H / 2 + tailH + 0.02;
    b.group({ at: [0, cy, 0] }, () => {
      b.extrude(outline, 0.012, { at: [0, 0, -0.026], bevel: 0.019, color: "#3a4150" });
      b.extrude(outline, 0.036, { color: "#fbfaf6", bevel: 0.012 });
      const text = textParam(b, p.text) || "…";
      b.text(text, { at: [0, 0.006, 0.033], w: W - 0.08, h: H - 0.05, fg: INK, font: "body" });
    });
  },

  // A floating thought bubble: a scalloped cloud with two little bubbles trailing down to the thinker.
  thought_bubble(b, p) {
    const cloud = cloudOutline(0.205, 0.085, 10, 0.074);
    const blobs = [[-0.2, -0.19, 0.034], [-0.255, -0.248, 0.02]];
    const cy = 0.248 + 0.02 + 0.02;
    b.group({ at: [0.01, cy, 0] }, () => {
      b.extrude(cloud, 0.012, { at: [0, 0, -0.026], bevel: 0.019, color: "#3a4150" });
      b.extrude(cloud, 0.036, { color: "#fbfaf6", bevel: 0.012 });
      for (const [x, y, rr] of blobs) {
        b.extrude(circle2(rr, 20, x, y), 0.008, { at: [0, 0, -0.024], bevel: 0.014, color: "#3a4150" });
        b.extrude(circle2(rr, 20, x, y), 0.03, { color: "#fbfaf6", bevel: 0.009 });
      }
      const text = textParam(b, p.text) || "?";
      b.text(text, { at: [0, 0.004, 0.033], w: 0.42, h: 0.21, fg: INK, font: "body" });
    });
  },

  // A painted wooden toy block with a raised border and the letter (1-3 characters) on every visible face.
  letter_block(b, p) {
    const R = randomFor(b, p);
    const col = p.color || R.pick(["#d0483c", "#3f74c4", "#4f9a58", "#f0c64a", "#e38b3a", "#7a55b8"]);
    const s = 0.248, h = s / 2;
    b.box(s, s, s, { at: [0, h, 0], color: col, r: 0.024 });
    const ink = inkFor(col, INK, LIGHT_TEXT);
    const trim = brightness(col) > 0.6 ? shade(col, -0.14) : mix(col, "#ffffff", 0.42);
    const letter = textParam(b, p.text) || "A";
    const faces = [[0, 0, 1, [0, 0, 0]], [1, 0, 0, [0, PI / 2, 0]], [-1, 0, 0, [0, -PI / 2, 0]], [0, 0, -1, [0, PI, 0]],
      [0, 1, 0, [-PI / 2, 0, 0]]];
    for (const [nx, ny, nz, rot] of faces) {
      b.group({ at: [nx * h, h + ny * h, nz * h], rot }, () => {
        rectFrame(b, s - 0.05, s - 0.05, 0.012, [0, 0, 0.0015], { color: trim, depth: 0.004 });
        b.text(letter, { at: [0, 0, 0.003], w: s - 0.07, h: s - 0.07, fg: ink, font: "display", weight: "700" });
      });
    }
  },

  // Glowing neon text and a neon border on a dark backboard standing on two little feet. color = neon colour.
  neon_sign(b, p) {
    const neon = p.color || "#ff4fa3";
    const board = "#262832";
    const W = 0.78, H = 0.27, yc = 0.026 + H / 2;
    feet(b, 0.27, 0.07, 0.026, 0.06, "#3a3d46", -0.004);
    b.box(W, H, 0.024, { at: [0, yc, -0.008], color: board, r: 0.01 });
    b.box(W - 0.05, H - 0.05, 0.002, { at: [0, yc, 0.005], color: mix(board, neon, 0.1), r: 0 });
    const path = rrect(W - 0.05, H - 0.05, 0.035, 4).map(([x, y]) => [x, yc + y, 0.011]);
    b.tube(path, 0.0055, { closed: true, color: neon, kind: "glow", seg: 140, radial: 6 });
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        b.cyl(0.006, 0.006, 0.008, { at: [sx * (W / 2 - 0.025), yc + sy * (H / 2 - 0.06), 0.008], rot: [PI / 2, 0, 0],
          color: "#9aa3ad", kind: "metal", seg: 8 });
      }
    }
    const text = textParam(b, p.text) || "OPEN";
    b.text(text, { at: [0, yc, 0.0125], w: W - 0.12, h: H - 0.1, fg: mix(neon, "#ffffff", 0.5), font: "body", glow: true,
      weight: "700" });
  },

  // A die-cut cardboard standee: kraft board with a printed white face showing the emoji, propped by a strut.
  cutout(b, p) {
    const kraft = "#c39a63";
    const W = 0.4, H = 0.47, yc = H / 2 + 0.004;
    b.extrude(rrect(W, H, 0.06, 5), 0.005, { at: [0, yc, 0.006], bevel: 0.0012, color: kraft });
    b.extrude(rrect(W - 0.016, H - 0.016, 0.052, 5), 0.0008, { at: [0, yc, 0.0101], bevel: 0, color: "#fbfaf4" });
    b.emoji(p.emoji || "⭐", { at: [0, yc + 0.004, 0.0125], size: 0.36 });
    b.group({ at: [0, 0, -0.046], rot: [0.156, 0, 0] }, () => {
      b.extrude([[-0.06, 0], [0.06, 0], [0.03, 0.3], [-0.03, 0.3]], 0.004, { at: [0, 0, 0], bevel: 0.0008, color: shade(kraft, -0.06) });
    });
    b.box(0.07, 0.03, 0.002, { at: [0, 0.3, 0.0016], color: "#d9c9a8", r: 0 });
  },

  // A chunky glossy 3D arrow pointing to +x: straight, curved (an arch landing on its head) or double-headed.
  arrow(b, p) {
    const v = ["straight", "curved", "double"].includes(p.variant) ? p.variant : "straight";
    const col = p.color || C.red;
    const head = (R, L) => [[0, 0], [R * 0.9, 0], [R, R * 0.12], [R * 0.94, R * 0.26], [R * 0.08, L - R * 0.04], [0, L]];
    if (v === "curved") {
      const r = 0.032, Rh = 0.07, Lh = 0.15;
      const cx = -0.06, cyc = 0.13 - 0.388, Rr = 0.388, dx = 0.045, lift = 0.014;
      const a0 = Math.asin((-0.32 - cx) / Rr), a1 = Math.asin((0.15 - cx) / Rr);
      const pts = [];
      for (let i = 0; i <= 20; i++) {
        const a = a0 + ((a1 - a0) * i) / 20;
        pts.push([cx + Rr * Math.sin(a) + dx, cyc + Rr * Math.cos(a) + lift, 0]);
      }
      b.tube(pts, r, { seg: 40, radial: 14, color: col, kind: "gloss" });
      b.sphere(r, { at: pts[0], color: col, kind: "gloss", seg: 14 });
      const end = pts[pts.length - 1];
      b.lathe(head(Rh, Lh), { at: end, rot: aim([Math.cos(a1), -Math.sin(a1), 0]), color: col, kind: "gloss", seg: 22 });
      return;
    }
    b.group({ at: [0, 0.08, 0], rot: [0, 0, -PI / 2] }, () => {
      const r = 0.04, Rh = 0.08, Lh = 0.185;
      if (v === "double") {
        b.cyl(r, r, 0.33, { color: col, kind: "gloss", seg: 20 });
        b.lathe(head(Rh, Lh), { at: [0, 0.165, 0], color: col, kind: "gloss", seg: 24 });
        b.lathe(head(Rh, Lh), { at: [0, -0.165, 0], scale: [1, -1, 1], color: col, kind: "gloss", seg: 24 });
      } else {
        b.cyl(r, r, 0.465, { at: [0, -0.0675, 0], color: col, kind: "gloss", seg: 20 });
        b.sphere(r, { at: [0, -0.3, 0], color: col, kind: "gloss", seg: 20 });
        b.lathe(head(Rh, Lh), { at: [0, 0.165, 0], color: col, kind: "gloss", seg: 24 });
      }
    });
  },

  // A number line on a low board: an arrowed line with ticks and labels. text = comma-separated tick labels.
  // color = board / stand.
  number_line(b, p) {
    const col = p.color || C.darkWood;
    const raw = textOf(b, p.text).trim();
    let labels = raw ? raw.split(",").map((s) => s.trim()) : ["0", "1", "2", "3", "4"];
    labels = labels.slice(0, 12);
    const n = labels.length;
    feet(b, 0.48, 0.1, 0.03, 0.1, shade(col, -0.08));
    b.box(1.27, 0.165, 0.03, { at: [0, 0.1125, 0], color: col, r: 0.012 });
    b.box(1.235, 0.13, 0.004, { at: [0, 0.1125, 0.016], color: PAPER, r: 0 });
    const zf = 0.018, yl = 0.152;
    b.cyl(0.0065, 0.0065, 1.27, { at: [0, yl, zf + 0.006], rot: [0, 0, PI / 2], color: INK, seg: 10 });
    for (const s of [-1, 1]) {
      b.cone(0.017, 0.05, { at: [s * 0.66, yl, zf + 0.006], rot: [0, 0, -s * PI / 2], color: INK, seg: 14 });
    }
    const span = n > 2 ? 1.04 : n === 2 ? 0.8 : 0;
    const step = n > 1 ? span / (n - 1) : 0;
    labels.forEach((lab, i) => {
      const x = -span / 2 + i * step;
      b.box(0.007, 0.034, 0.008, { at: [x, yl, zf + 0.005], color: INK, r: 0 });
      if (lab) {
        b.text(lab, { at: [x, 0.093, zf + 0.003], w: Math.min(0.24, step ? step * 0.94 : 0.24), h: 0.09, fg: INK, font: "body" });
      }
    });
  },

  // A framed chart on two feet; the data is real geometry in color: bar, line, pie, bell, scatter, step or exp.
  chart(b, p) {
    const v = ["bar", "line", "pie", "bell", "scatter", "step", "exp"].includes(p.variant) ? p.variant : "bar";
    const col = p.color || C.blue;
    const R = randomFor(b, p);
    for (const s of [-1, 1]) {
      b.box(0.03, 0.12, 0.024, { at: [s * 0.27, 0.07, -0.006], color: WALNUT_DARK, r: 0.006 });
      b.box(0.06, 0.02, 0.12, { at: [s * 0.27, 0.01, -0.004], color: WALNUT_DARK, r: 0.006 });
    }
    const yc = 0.375;
    b.box(0.79, 0.54, 0.026, { at: [0, yc, -0.004], color: WALNUT, r: 0.012 });
    b.box(0.73, 0.48, 0.004, { at: [0, yc, 0.01], color: "#fbfaf4", r: 0 });
    b.group({ at: [0, yc, 0.012] }, () => chartData(b, v, col, R));
  },

  // A sculpture of glossy nodes joined by rods on a walnut base, held up by slim posts.
  // color = nodes, color2 = edges.
  network(b, p) {
    const v = NETWORKS[p.variant] ? p.variant : "graph";
    const col = p.color || C.orange, edge = p.color2 || "#6d7480";
    const { nodes, edges, posts, hub } = NETWORKS[v]();
    b.box(0.68, 0.04, 0.26, { at: [0, 0.02, 0], color: WALNUT, r: 0.014 });
    for (const i of posts) {
      const [x, y, z] = nodes[i];
      b.cyl(0.0075, 0.0075, y - 0.04, { at: [x, 0.04 + (y - 0.04) / 2, z], color: C.iron, kind: "metal", seg: 8 });
      b.cyl(0.02, 0.024, 0.008, { at: [x, 0.044, z], color: C.brass, kind: "metal", seg: 12 });
    }
    for (const [i, j] of edges) b.rod(nodes[i], nodes[j], 0.011, { color: edge, seg: 8 });
    nodes.forEach((n, i) => b.sphere(i === hub ? 0.06 : 0.045, { at: n, color: i === hub ? shade(col, -0.06) : col,
      kind: "gloss", seg: 16 }));
  },

  // A matrix: square brackets around a grid of ivory cells, each with its number, on a board with feet.
  // text like '1 2;3 4' (rows by ';', cells by spaces). color = board.
  matrix(b, p) {
    const col = p.color || "#34507e";
    const raw = textOf(b, p.text).trim() || "1 2 3;4 5 6;7 8 9";
    let rows = raw.split(";").map((r) => r.trim().split(/\s+/).filter(Boolean)).filter((r) => r.length).slice(0, 8);
    if (!rows.length) rows = [["0"]];
    const cols = Math.min(8, Math.max(...rows.map((r) => r.length)));
    const nR = rows.length;
    feet(b, 0.19, 0.12, 0.05, 0.08, WALNUT_DARK, -0.004);
    const yc = 0.32, BW = 0.58, BH = 0.54;
    b.box(BW, BH, 0.03, { at: [0, yc, -0.004], color: col, r: 0.014 });
    const zf = 0.011;
    const pitch = Math.min(0.4 / cols, 0.42 / nR);
    const tile = pitch * 0.88;
    const gx = (cols * pitch) / 2, gy = (nR * pitch) / 2;
    const ink = inkFor(col, INK, "#f6f1e4");
    const bh = 2 * gy + 0.05, bw = 0.014, sl = 0.034;
    const bracket = [[0, -bh / 2], [sl, -bh / 2], [sl, -bh / 2 + bw], [bw, -bh / 2 + bw], [bw, bh / 2 - bw], [sl, bh / 2 - bw],
      [sl, bh / 2], [0, bh / 2]];
    b.mirrorX(() => b.extrude(bracket, 0.008, { at: [-gx - 0.035, yc, zf + 0.006], color: ink, bevel: 0.002 }));
    rows.forEach((row, i) => {
      for (let j = 0; j < cols; j++) {
        const x = -gx + (j + 0.5) * pitch, y = yc + gy - (i + 0.5) * pitch;
        b.box(tile, tile, 0.01, { at: [x, y, zf + 0.005], color: "#f8f5ec", r: Math.min(0.006, tile * 0.1) });
        const cell = row[j] ?? "";
        if (cell) b.text(cell, { at: [x, y, zf + 0.0125], w: tile * 0.94, h: tile * 0.82, fg: INK, font: "body" });
      }
    });
  },

  // A stack of 2-6 slabs on little metal spacers, each labelled on its front edge; text 'top|middle|bottom'.
  // color = slab colour (lighter at the top); without it the slabs take a rainbow of hues.
  layers(b, p) {
    const raw = textOf(b, p.text);
    let labels = raw.trim() ? raw.split("|").map((s) => s.trim()) : [];
    const n = labels.length ? Math.min(6, Math.max(2, labels.length)) : 4;
    labels = labels.slice(0, n);
    while (labels.length < n) labels.push("");
    const gap = 0.032, H = 0.6, t = (H - gap * (n - 1)) / n;
    const W = 0.56, D = 0.42;
    const hues = ["#e8705b", "#f0b84a", "#68b77a", "#4f8fd6", "#8a6ccf", "#2fa7a0"];
    const pal = Array.from({ length: n }, (_, i) => p.color
      ? mix(mix(p.color, "#ffffff", 0.3), shade(p.color, -0.1), n > 1 ? i / (n - 1) : 0)
      : hues[Math.round((i * (hues.length - 1)) / Math.max(1, n - 1))]);
    for (let i = 0; i < n; i++) {
      const yTop = H - i * (t + gap), yc = yTop - t / 2;
      b.box(W, t, D, { at: [0, yc, 0], color: pal[i], kind: "gloss", r: Math.min(0.018, t * 0.25) });
      if (labels[i]) {
        b.text(labels[i], { at: [0, yc, D / 2 + 0.003], w: W - 0.06, h: Math.min(t * 0.8, 0.12), fg: inkFor(pal[i]), font: "body" });
      }
      if (i < n - 1) {
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            b.cyl(0.012, 0.012, gap + 0.006, { at: [sx * (W / 2 - 0.05), yc - t / 2 - gap / 2, sz * (D / 2 - 0.05)],
              color: C.steel, kind: "metal", seg: 10 });
          }
        }
      }
    }
  },

  // Overlapping translucent coloured discs with solid rims, held on posts above a walnut base.
  venn(b, p) {
    const three = p.variant === "three";
    const circles = three
      ? [[-0.11, 0.255, 0.18, "#e8604c"], [0.11, 0.255, 0.18, "#4a86d8"], [0, 0.445, 0.18, "#f2c94c"]]
      : [[-0.15, 0.32, 0.225, "#e8604c"], [0.15, 0.32, 0.225, "#4a86d8"]];
    b.box(three ? 0.68 : 0.64, 0.035, 0.14, { at: [0, 0.0175, 0], color: WALNUT, r: 0.012 });
    circles.forEach(([x, y, r, c], i) => {
      const z = (i - (circles.length - 1) / 2) * 0.014;
      b.cyl(r, r, 0.006, { at: [x, y, z], rot: [PI / 2, 0, 0], color: c, kind: "glass", seg: 48 });
      b.torus(r, 0.011, { at: [x, y, z], color: shade(c, -0.05), kind: "gloss", seg: 56, tubeSeg: 8 });
      if (y - r < 0.2) {
        b.cyl(0.007, 0.007, y - r - 0.03, { at: [x, 0.035 + (y - r - 0.035) / 2, z], color: C.iron, kind: "metal", seg: 8 });
      }
    });
  },

  // A polished geometric solid on a small walnut plinth with a brass ring. color = the solid.
  solid(b, p) {
    const v = SOLID_COLORS[p.variant] ? p.variant : "cube";
    const col = p.color || SOLID_COLORS[v];
    const y0 = 0.042;
    b.lathe([[0, 0], [0.16, 0], [0.165, 0.006], [0.165, 0.016], [0.156, 0.022], [0.148, 0.03], [0.15, 0.036], [0.144, 0.042],
      [0, 0.042]], { color: WALNUT, seg: 36 });
    b.torus(0.15, 0.0035, { at: [0, 0.033, 0], rot: [PI / 2, 0, 0], color: C.brass, kind: "metal", seg: 36, tubeSeg: 5 });
    const o = { color: col, kind: "gloss" };
    const post = (top) => b.cyl(0.008, 0.008, top - y0 + 0.01, { at: [0, (y0 + top) / 2, 0], color: C.brass, kind: "metal", seg: 10 });
    const fitted = (g, f) => standOn(b, g, { y0, color: col, kind: "gloss", ...f });
    switch (v) {
      case "cube": b.box(0.29, 0.29, 0.29, { ...o, at: [0, y0 + 0.145, 0], rot: [0, 0.6, 0], r: 0.014 }); break;
      case "sphere":
        b.torus(0.055, 0.012, { at: [0, y0 + 0.004, 0], rot: [PI / 2, 0, 0], color: C.brass, kind: "metal", seg: 20 });
        b.sphere(0.165, { ...o, at: [0, y0 + 0.155, 0], seg: 32 });
        break;
      case "cone": b.lathe([[0, 0], [0.152, 0], [0.156, 0.006], [0, 0.33]], { ...o, at: [0, y0, 0], seg: 36 }); break;
      case "cylinder":
        b.lathe([[0, 0], [0.132, 0], [0.14, 0.008], [0.14, 0.302], [0.132, 0.31], [0, 0.31]], { ...o, at: [0, y0, 0], seg: 36 });
        break;
      case "torus":
        b.box(0.08, 0.03, 0.1, { at: [0, y0 + 0.015, 0], color: WALNUT_DARK, r: 0.008 });
        b.torus(0.115, 0.048, { ...o, at: [0, y0 + 0.16, 0], rot: [0, 0.45, 0], seg: 40, tubeSeg: 16 });
        break;
      case "tetrahedron": fitted(new THREE.TetrahedronGeometry(1), { face: true, yaw: 0.35, maxW: 0.37, maxH: 0.31, flat: true }); break;
      case "octahedron":
        b.torus(0.03, 0.008, { at: [0, y0 + 0.004, 0], rot: [PI / 2, 0, 0], color: C.brass, kind: "metal", seg: 16 });
        fitted(new THREE.OctahedronGeometry(1), { yaw: 0.45, maxW: 0.36, maxH: 0.34, flat: true, sink: 0.008 });
        break;
      case "dodecahedron": fitted(new THREE.DodecahedronGeometry(1), { face: true, yaw: 0.2, maxW: 0.36, maxH: 0.32, flat: true }); break;
      case "icosahedron": fitted(new THREE.IcosahedronGeometry(1), { face: true, yaw: 0.2, maxW: 0.36, maxH: 0.32, flat: true }); break;
      case "pyramid": fitted(new THREE.CylinderGeometry(0, 1, 1.5, 4, 1), { yaw: PI / 4 + 0.4, maxW: 0.38, maxH: 0.33, flat: true }); break;
      case "mobius": {
        // the band lies flat at the bottom (on the post) and turns edge-on at the top: the half twist
        const R = 0.125, w = 0.045, yc = 0.275, turn = -PI / 2;
        post(yc - R - 0.02);
        const g = mobiusGeo(R, w, 0.011);
        g.rotateZ(turn);
        g.rotateY(0.75);
        g.translate(0, yc, 0);
        b.geo(g, o);
        const edge = [];
        const m = new THREE.Matrix4().makeTranslation(0, yc, 0).multiply(new THREE.Matrix4().makeRotationY(0.75))
          .multiply(new THREE.Matrix4().makeRotationZ(turn));
        for (let i = 0; i < 200; i++) edge.push(new THREE.Vector3(...mobiusPoint(R, w, (i / 200) * 2 * TAU)).applyMatrix4(m).toArray());
        b.tube(edge, 0.0055, { closed: true, color: col, kind: "gloss", seg: 300, radial: 6 });
        break;
      }
      case "infinity": {
        const pts = [];
        for (let i = 0; i < 96; i++) {
          const t = (i / 96) * TAU, d = 1 + Math.sin(t) ** 2;
          pts.push([(0.168 * Math.cos(t)) / d, 0.255 + (1.4 * 0.168 * Math.sin(t) * Math.cos(t)) / d, 0.036 * Math.sin(t)]);
        }
        post(0.25);
        b.group({ rot: [0, 0.3, 0] }, () => b.tube(pts, 0.026, { closed: true, color: col, kind: "gloss", seg: 160, radial: 12 }));
        break;
      }
      case "spiral": {
        const pts = [], turns = 2.6, th1 = turns * TAU;
        for (let i = 0; i <= 120; i++) {
          const th = (i / 120) * th1, r = 0.012 + 0.148 * (th / th1), a = -PI / 2 - (th1 - th);
          pts.push([r * Math.cos(a), 0.215 + r * Math.sin(a), 0.05 * (1 - th / th1)]);
        }
        post(0.07);
        taperTube(b, pts, 0.007, 0.024, { seg: 220, radial: 10, color: col, kind: "gloss", caps: true });
        break;
      }
      case "knot": {
        post(0.09);
        const g = new THREE.TorusKnotGeometry(1, 0.32, 150, 12, 2, 3);
        standOn(b, g, { y0: 0.08, maxW: 0.36, maxH: 0.3, color: col, kind: "gloss", noRotate: true });
        break;
      }
    }
  },

  // A ball-and-stick model of glycine (N blue, O red, H white, C dark) on a slim stand. color = carbon.
  molecule(b, p) {
    const cAtom = p.color || "#3a3d44";
    const A = {
      N: [-1.85, -0.42, 0], Ca: [-0.55, 0.22, 0], C: [0.62, -0.72, 0], O1: [0.5, -1.93, 0], O2: [1.8, -0.1, 0],
      HO: [2.52, -0.72, 0], Ha1: [-0.5, 0.85, 0.88], Ha2: [-0.5, 0.85, -0.88], Hn1: [-2.45, 0.0, 0.8], Hn2: [-2.45, 0.0, -0.8],
    };
    const kind = { N: "N", Ca: "C", C: "C", O1: "O", O2: "O", HO: "H", Ha1: "H", Ha2: "H", Hn1: "H", Hn2: "H" };
    const look = { C: [0.043, cAtom], N: [0.041, "#3f6fd0"], O: [0.041, "#e0453a"], H: [0.028, "#f4f3ee"] };
    const bonds = [["N", "Ca"], ["Ca", "C"], ["C", "O1", 2], ["C", "O2"], ["O2", "HO"], ["Ca", "Ha1"], ["Ca", "Ha2"],
      ["N", "Hn1"], ["N", "Hn2"]];
    // turn so the backbone faces the viewer at an angle, then scale and lift onto the stand
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25, 0.55, 0.12, "YXZ"));
    const P = {};
    for (const [k, v] of Object.entries(A)) P[k] = new THREE.Vector3(...v).applyQuaternion(q);
    const raw = new THREE.Box3();
    for (const v of Object.values(P)) raw.expandByPoint(v);
    const sc = Math.min((0.49 - 0.056) / (raw.max.x - raw.min.x), (0.38 - 0.056) / (raw.max.z - raw.min.z));
    for (const k in P) P[k].multiplyScalar(sc);
    const box = new THREE.Box3();
    for (const [k, v] of Object.entries(P)) box.expandByPoint(v.clone().addScalar(look[kind[k]][0])).expandByPoint(v.clone().addScalar(-look[kind[k]][0]));
    const shift = new THREE.Vector3(-(box.min.x + box.max.x) / 2, 0.45 - box.max.y, -(box.min.z + box.max.z) / 2);
    for (const k in P) P[k].add(shift);
    const at = (k) => P[k].toArray();
    // stand under the alpha carbon
    const s = P.Ca;
    b.cyl(0.085, 0.095, 0.024, { at: [s.x, 0.012, s.z], color: WALNUT, seg: 28 });
    b.cyl(0.007, 0.007, s.y - 0.024, { at: [s.x, 0.024 + (s.y - 0.024) / 2, s.z], color: C.silver, kind: "metal", seg: 8 });
    for (const [i, j, order] of bonds) {
      if (order === 2) {
        const d = P[j].clone().sub(P[i]).normalize(), side = new THREE.Vector3(0, 0, 1).cross(d).normalize().multiplyScalar(0.016);
        for (const sgn of [-1, 1]) b.rod(P[i].clone().addScaledVector(side, sgn).toArray(), P[j].clone().addScaledVector(side, sgn).toArray(),
          0.009, { color: "#c9ccd1", kind: "gloss", seg: 8 });
      } else b.rod(at(i), at(j), 0.012, { color: "#c9ccd1", kind: "gloss", seg: 8 });
    }
    for (const k in P) {
      const [r, c] = look[kind[k]];
      b.sphere(r, { at: at(k), color: c, kind: "gloss", seg: r > 0.04 ? 18 : 14 });
    }
  },
};

// ── network layouts ──────────────────────────────────────────────────────────
const NETWORKS = {
  graph: () => ({
    nodes: [[-0.3, 0.2, 0.05], [-0.17, 0.48, -0.06], [0.0, 0.3, 0.08], [0.04, 0.6, -0.02], [0.24, 0.46, 0.05], [0.3, 0.19, -0.05],
      [-0.33, 0.62, 0.03]],
    edges: [[0, 1], [0, 2], [1, 2], [1, 3], [1, 6], [2, 3], [2, 5], [3, 4], [4, 5], [2, 4]],
    posts: [0, 5],
  }),
  tree: () => ({
    nodes: [[0, 0.62, 0], [-0.19, 0.41, 0.04], [0.19, 0.41, -0.04], [-0.29, 0.19, 0.06], [-0.1, 0.19, 0.0], [0.1, 0.19, 0.0],
      [0.29, 0.19, -0.06]],
    edges: [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]],
    posts: [3, 4, 5, 6], hub: 0,
  }),
  chain: () => ({
    nodes: Array.from({ length: 5 }, (_, i) => [-0.3 + i * 0.15, 0.17 + i * 0.112 + (i % 2 ? 0.03 : 0), 0.05 * Math.cos(i * 1.7)]),
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
    posts: [0, 2],
  }),
  ring: () => ({
    nodes: Array.from({ length: 8 }, (_, i) => {
      const t = (i / 8) * TAU;
      return [0.25 * Math.sin(t), 0.39 - 0.25 * Math.cos(t), 0.06 * Math.sin(2 * t)];
    }),
    edges: Array.from({ length: 8 }, (_, i) => [i, (i + 1) % 8]),
    posts: [0],
  }),
  star: () => ({
    nodes: [[0, 0.39, 0], ...Array.from({ length: 6 }, (_, i) => {
      const t = PI / 6 + (i * PI) / 3;
      return [0.27 * Math.sin(t), 0.39 - 0.25 * Math.cos(t), i % 2 ? 0.06 : -0.06];
    })],
    edges: Array.from({ length: 6 }, (_, i) => [0, i + 1]),
    posts: [1, 6], hub: 0,
  }),
  grid: () => {
    const nodes = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) nodes.push([-0.25 + c * 0.25, 0.17 + r * 0.225, (r - 1) * -0.04]);
    const edges = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (c < 2) edges.push([r * 3 + c, r * 3 + c + 1]);
        if (r < 2) edges.push([r * 3 + c, (r + 1) * 3 + c]);
      }
    }
    return { nodes, edges, posts: [0, 1, 2] };
  },
  complete: () => {
    const nodes = Array.from({ length: 5 }, (_, i) => {
      const t = PI / 2 + (i * TAU) / 5;
      return [0.27 * Math.cos(t), 0.38 + 0.26 * Math.sin(t), i % 2 ? 0.05 : -0.04];
    });
    const edges = [];
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) edges.push([i, j]);
    return { nodes, edges, posts: [2, 3] };
  },
};

// ── solids ───────────────────────────────────────────────────────────────────
const SOLID_COLORS = {
  cube: "#e38b3a", sphere: "#d0483c", cone: "#f0c64a", cylinder: "#2f9a95", torus: "#e5799a", tetrahedron: "#8cbf3f",
  octahedron: "#4aa3d8", dodecahedron: "#7a55b8", icosahedron: "#4f9a58", pyramid: "#d9a540", mobius: "#2f9a95",
  infinity: "#7a55b8", spiral: "#4f9a58", knot: "#3f74c4",
};

/**
 * Add geometry g (centred on the origin) standing on y = y0: turned so one face (o.face) rests on the plinth,
 * spun by o.yaw, scaled to fit o.maxW × o.maxH and centred on x/z; o.sink lowers it into a cup.
 */
function standOn(b, g, o) {
  if (g.index) g = g.toNonIndexed();
  const q = new THREE.Quaternion();
  if (o.face) {
    const pos = g.attributes.position;
    const a = new THREE.Vector3().fromBufferAttribute(pos, 0), b1 = new THREE.Vector3().fromBufferAttribute(pos, 1),
      c = new THREE.Vector3().fromBufferAttribute(pos, 2);
    const n = b1.sub(a).cross(c.sub(a)).normalize();
    q.setFromUnitVectors(n, new THREE.Vector3(0, -1, 0));
  }
  if (!o.noRotate) q.premultiply(new THREE.Quaternion().setFromAxisAngle(Y_AXIS, o.yaw || 0));
  g.applyQuaternion(q);
  g.computeBoundingBox();
  let bb = g.boundingBox;
  const s = Math.min(o.maxW / Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z), o.maxH / (bb.max.y - bb.min.y));
  g.scale(s, s, s);
  g.computeBoundingBox();
  bb = g.boundingBox;
  g.translate(-(bb.min.x + bb.max.x) / 2, o.y0 - bb.min.y - (o.sink || 0), -(bb.min.z + bb.max.z) / 2);
  b.geo(g, { color: o.color, kind: o.kind, flat: o.flat });
}

/** Point on a Möbius strip (centre circle radius R in the xy plane, half-width w) at angle u, offset v. */
function mobiusPoint(R, w, u, v = w) {
  const k = R + v * Math.cos(u / 2);
  return [k * Math.cos(u), k * Math.sin(u), v * Math.sin(u / 2)];
}

/** A thickened Möbius strip: one surface swept twice around (u in 0..4π) covers both faces of the band. */
function mobiusGeo(R, w, t) {
  const fn = (uu, vv) => {
    const u = uu * 2 * TAU, v = -w + vv * 2 * w, e = 1e-4;
    const P = new THREE.Vector3(...mobiusPoint(R, w, u, v));
    const Pu = new THREE.Vector3(...mobiusPoint(R, w, u + e, v)).sub(P);
    const Pv = new THREE.Vector3(...mobiusPoint(R, w, u, v + e)).sub(P);
    const N = Pu.cross(Pv).normalize();
    return P.addScaledVector(N, t / 2).toArray();
  };
  return surface(200, 6, fn, { wrapU: true });
}

/** Chart contents drawn in front of the face (z = 0), plot area about x ∈ [-0.3, 0.3], y ∈ [-0.19, 0.2]. */
function chartData(b, v, col, R) {
  const X0 = -0.29, Y0 = -0.19;
  if (v !== "pie") {
    for (const y of [-0.095, 0.0, 0.095]) b.box(0.57, 0.003, 0.0012, { at: [0.01, y, 0.0006], color: "#dcd8cd", r: 0 });
    b.box(0.6, 0.007, 0.006, { at: [0.01, Y0, 0.003], color: INK, r: 0 });
    b.box(0.007, 0.4, 0.006, { at: [X0, 0.005, 0.003], color: INK, r: 0 });
    b.cone(0.011, 0.026, { at: [0.32, Y0, 0.003], rot: [0, 0, -PI / 2], color: INK, seg: 10 });
    b.cone(0.011, 0.026, { at: [X0, 0.215, 0.003], color: INK, seg: 10 });
  }
  const fill = (pts, c) => flat(b, [[pts[0][0], Y0], ...pts, [pts[pts.length - 1][0], Y0]], 0.0016, c);
  const dot = (x, y, r = 0.014, c = col) => b.sphere(r, { at: [x, y, 0.009], color: c, kind: "gloss", seg: 12 });
  if (v === "bar") {
    [0.42, 0.66, 0.5, 0.82, 0.97].forEach((val, i) => {
      const hgt = val * 0.36;
      b.box(0.07, hgt, 0.028, { at: [-0.215 + i * 0.112, Y0 + hgt / 2 + 0.0035, 0.016], color: i % 2 ? shade(col, 0.08) : col,
        r: 0.006 });
    });
  } else if (v === "line") {
    const pts = [-0.12, -0.04, -0.08, 0.035, 0.0, 0.14].map((y, i) => [-0.24 + i * 0.104, y, 0.009]);
    for (let i = 0; i < pts.length - 1; i++) b.rod(pts[i], pts[i + 1], 0.0075, { color: col, seg: 8 });
    pts.forEach(([x, y]) => dot(x, y, 0.016, shade(col, -0.06)));
  } else if (v === "pie") {
    const fr = [0.38, 0.27, 0.2, 0.15];
    const cols = [col, "#f0c64a", "#e8835a", "#7fb6e0"];
    if (brightness(col) > 0.7 && Math.abs(brightness(col) - brightness("#f0c64a")) < 0.05) cols[1] = "#4f9a58";
    let a = PI / 2;
    fr.forEach((f, i) => {
      const da = f * TAU, mid = a - da / 2, off = i === 0 ? 0.022 : 0;
      b.extrude(sector2(0.165, a - da, a, Math.max(4, Math.round(f * 48))), 0.022,
        { at: [-0.1 + Math.cos(mid) * off, 0.0 + Math.sin(mid) * off, 0.014], color: cols[i], kind: "gloss", bevel: 0.003 });
      b.box(0.028, 0.028, 0.008, { at: [0.16, 0.11 - i * 0.07, 0.005], color: cols[i], r: 0.003 });
      b.box(0.085, 0.01, 0.003, { at: [0.235, 0.11 - i * 0.07, 0.003], color: "#a9a59b", r: 0 });
      a -= da;
    });
  } else if (v === "bell" || v === "exp") {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      if (v === "bell") {
        const s = -3 + 6 * t;
        pts.push([0.01 + s * 0.093, Y0 + 0.008 + 0.33 * Math.exp((-s * s) / 2)]);
      } else {
        pts.push([-0.27 + t * 0.55, Y0 + 0.012 + 0.36 * (Math.exp(3.3 * t) - 1) / (Math.exp(3.3) - 1)]);
      }
    }
    fill(pts, mix(col, "#ffffff", 0.66));
    b.tube(pts.map(([x, y]) => [x, y, 0.006]), 0.0078, { color: col, seg: 80, radial: 8 });
    if (v === "bell") {
      for (let k = 0; k < 6; k++) b.box(0.004, 0.026, 0.002, { at: [0.01, Y0 + 0.03 + k * 0.057, 0.0035], color: shade(col, -0.2), r: 0 });
    }
  } else if (v === "scatter") {
    for (let i = 0; i < 18; i++) {
      const x = -0.25 + ((i + R()) * 0.53) / 18;
      const y = Math.max(Y0 + 0.025, Math.min(0.18, -0.15 + (x + 0.25) * 0.56 + R.range(-0.065, 0.065)));
      dot(x, y, 0.0125);
    }
    for (let k = 0; k < 9; k++) {
      const t0 = k / 9, t1 = t0 + 0.06;
      const P = (t) => [-0.27 + t * 0.56, -0.162 + t * 0.315, 0.004];
      b.rod(P(t0), P(t1), 0.0035, { color: "#6b6f78", seg: 6 });
    }
  } else if (v === "step") {
    const xs = [-0.26, -0.15, -0.04, 0.07, 0.18, 0.29];
    const ys = [-0.155, -0.09, -0.02, 0.05, 0.12];
    for (let i = 0; i < 5; i++) {
      b.rod([xs[i], ys[i], 0.009], [xs[i + 1] - 0.012, ys[i], 0.009], 0.0075, { color: col, seg: 8 });
      dot(xs[i], ys[i]);
      b.torus(0.0105, 0.0042, { at: [xs[i + 1], ys[i], 0.009], color: col, kind: "gloss", seg: 14, tubeSeg: 6 });
    }
  }
}

// ── paintings for the easel (drawn on the canvas face at z = 0, facing +z) ───
function paintLandscape(b, w, h, green) {
  const z = (i) => 0.0004 + i * 0.0007;
  flat(b, rrect(w, h, 0.001, 1), z(0), "#8fc3e6");
  flat(b, rrect(w, h * 0.3, 0.001, 1), z(1), "#cbe4f1", { y: -h * 0.02 });
  flat(b, circle2(0.042, 24), z(2), "#f6cf4f", { x: w * 0.27, y: h * 0.24 });
  for (const [x, y, s] of [[-0.12, 0.12, 1], [0.04, 0.15, 0.8]]) {
    for (const [dx, dy, rr] of [[0, 0, 0.026], [0.026, -0.006, 0.02], [-0.026, -0.008, 0.018]]) {
      flat(b, circle2(rr * s, 16), z(3), "#ffffff", { x: x + dx * s, y: y + dy * s });
    }
  }
  const mtn = [[-w / 2, -0.02], [-0.16, 0.08], [-0.06, 0.0], [0.05, 0.1], [0.2, -0.01], [w / 2, 0.04], [w / 2, -0.1], [-w / 2, -0.1]];
  flat(b, mtn, z(4), "#7d8fb5");
  flat(b, [[-0.19, 0.055], [-0.16, 0.08], [-0.13, 0.055], [-0.16, 0.062]], z(5), "#f4f6fa");
  flat(b, [[0.02, 0.07], [0.05, 0.1], [0.08, 0.07], [0.05, 0.078]], z(5), "#f4f6fa");
  const hill = (base, amp, f, ph, col, zi) => {
    const pts = [[-w / 2, -h / 2]];
    for (let i = 0; i <= 24; i++) {
      const x = -w / 2 + (i / 24) * w;
      pts.push([x, base + amp * Math.sin(f * x + ph)]);
    }
    pts.push([w / 2, -h / 2]);
    flat(b, pts, z(zi), col);
  };
  hill(-0.035, 0.03, 9, 0.6, shade(green, 0.1), 6);
  hill(-0.085, 0.035, 7, 2.6, green, 7);
  flat(b, [[-0.13, -0.06], [-0.12, -0.06], [-0.12, -0.02], [-0.13, -0.02]], z(8), "#6b4a30");
  flat(b, circle2(0.032, 18), z(9), shade(green, -0.15), { x: -0.125, y: 0.0 });
}

function paintPortrait(b, w, h, clothes) {
  const z = (i) => 0.0004 + i * 0.0007;
  const skin = "#efc6a0", hair = "#4a2e1f";
  flat(b, rrect(w, h, 0.001, 1), z(0), "#6f8a6a");
  flat(b, ellipse2(0.14, 0.17, 28), z(1), "#8ea57f", { y: 0.03 });
  flat(b, [[-w / 2, -h / 2], [-0.17, -0.16], [-0.1, -0.11], [0.1, -0.11], [0.17, -0.16], [w / 2, -h / 2]], z(2), clothes);
  flat(b, [[-0.04, -0.11], [0, -0.17], [0.04, -0.11]], z(3), "#f4f1e8");
  flat(b, rrect(0.044, 0.06, 0.01, 2), z(3), shade(skin, -0.06), { y: -0.09 });
  flat(b, ellipse2(0.082, 0.1, 28), z(4), hair, { y: 0.04 });
  flat(b, [[-0.082, 0.04], [-0.09, -0.08], [-0.05, -0.06], [0.05, -0.06], [0.09, -0.08], [0.082, 0.04]], z(4), hair);
  flat(b, ellipse2(0.06, 0.078, 28), z(5), skin, { y: 0.015 });
  flat(b, [[-0.064, 0.05], [-0.04, 0.1], [0.03, 0.105], [0.066, 0.05], [0.02, 0.07], [-0.03, 0.065]], z(6), hair);
  for (const s of [-1, 1]) {
    flat(b, ellipse2(0.0075, 0.0055, 12), z(6), "#2b2622", { x: s * 0.024, y: 0.022 });
    flat(b, circle2(0.011, 12), z(6), "#e9a0a0", { x: s * 0.036, y: -0.004 });
  }
  flat(b, ellipse2(0.013, 0.0045, 12), z(6), "#b5524c", { y: -0.026 });
}

function paintAbstract(b, w, h, red) {
  const z = (i) => 0.0004 + i * 0.0007;
  const X = (u) => -w / 2 + u * w, Yy = (v) => -h / 2 + v * h;
  const block = (u0, v0, u1, v1, col, zi) => flat(b, [[X(u0), Yy(v0)], [X(u1), Yy(v0)], [X(u1), Yy(v1)], [X(u0), Yy(v1)]], z(zi), col);
  block(0, 0, 1, 1, "#f4f1e8", 0);
  block(0.28, 0.3, 1, 1, red, 1);
  block(0, 0, 0.28, 0.3, "#2f55a4", 1);
  block(0.88, 0, 1, 0.14, "#f2c230", 1);
  const lw = 0.028;
  block(0.28 - lw / 2, 0, 0.28 + lw / 2, 1, "#1d1f24", 2);
  block(0, 0.3 - lw / 2, 1, 0.3 + lw / 2, "#1d1f24", 2);
  block(0, 0.66 - lw / 2, 0.28, 0.66 + lw / 2, "#1d1f24", 2);
  block(0.88 - lw / 2, 0, 0.88 + lw / 2, 0.3, "#1d1f24", 2);
  block(0.88, 0.14 - lw / 2, 1, 0.14 + lw / 2, "#1d1f24", 2);
}

// ── bubbles ──────────────────────────────────────────────────────────────────
/** Rounded rectangle W × H (corner radius r) with a curved tail on its bottom edge between x0 and x1. */
function speechOutline(W, H, r, tail, n = 6) {
  const pts = [];
  const hw = W / 2, hh = H / 2;
  const arc = (cx, cy, a0) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (PI / 2);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  const bez = (A, Cp, B, k) => {
    for (let i = 1; i <= k; i++) {
      const t = i / k, s = 1 - t;
      pts.push([s * s * A[0] + 2 * s * t * Cp[0] + t * t * B[0], s * s * A[1] + 2 * s * t * Cp[1] + t * t * B[1]]);
    }
  };
  arc(hw - r, -hh + r, -PI / 2);
  arc(hw - r, hh - r, 0);
  arc(-hw + r, hh - r, PI / 2);
  arc(-hw + r, -hh + r, PI);
  const A = [tail.x0, -hh], B = [tail.x1, -hh], T = tail.tip;
  pts.push(A);
  bez(A, [tail.x0 + 0.005, -hh - 0.045], T, 6);
  bez(T, [tail.x1 - 0.05, -hh - 0.03], B, 6);
  return pts;
}

/** Scalloped cloud outline: the outer envelope of `bumps` circles placed around an ellipse a × e. */
function cloudOutline(a, e, bumps, rb, n = 120) {
  const centres = Array.from({ length: bumps }, (_, i) => {
    const t = (i / bumps) * TAU + 0.31;
    return [a * Math.cos(t), e * Math.sin(t), rb * (1 + 0.14 * Math.sin(i * 2.3 + 0.5))];
  });
  const pts = [];
  for (let k = 0; k < n; k++) {
    const t = (k / n) * TAU, dx = Math.cos(t), dy = Math.sin(t);
    let best = 1 / Math.hypot(dx / a, dy / e);
    for (const [cx, cy, r] of centres) {
      const along = dx * cx + dy * cy;
      const disc = along * along - (cx * cx + cy * cy - r * r);
      if (disc >= 0) best = Math.max(best, along + Math.sqrt(disc));
    }
    pts.push([dx * best, dy * best]);
  }
  return pts;
}
