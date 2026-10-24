// Props in the "household" group. Each entry: name: (b, p) => void — see kit.js and docs/props.md.
// b is a Builder (metres, base on y = 0, facing +z); p holds the item's params:
//   { variant, color, color2, text, emoji, pose, hat, hold, seed }
import * as THREE from "three";
import { C, shade, mix, rng } from "./kit.js";

const PI = Math.PI;
const TAU = Math.PI * 2;
const STEAM = "#f3f5f7";

// ── helpers (local to this group) ────────────────────────────────────────────

/** Part of a lathe: profile [[r, y], ...] swept from angle a0 by da (angle 0 = +z, turning towards +x). */
function latheSector(b, points, a0, da, o = {}) {
  const pts = points.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
  return b.geo(new THREE.LatheGeometry(pts, o.seg ?? 4, a0, da), o);
}

/**
 * Smooth grid surface from fn(u, v) -> [x, y, z], u and v in [0, 1]. The front face points along
 * du × dv (flip reverses it). wrapU joins the u = 1 edge back to u = 0 (closed rings).
 */
function gridGeo(nu, nv, fn, { flip = false, wrapU = false } = {}) {
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

/** Random numbers for a prop: from its own seed when it has one, so it looks the same in any scene. */
function randomFor(b, p) {
  return p.seed != null ? rng(p.seed * 31 + 7) : b.rng;
}

/** Points of an elliptical arc (semi-axes ax, ay) from angle t0 to t1, in the xy plane. */
function arc(ax, ay, t0, t1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + (t1 - t0) * (i / n);
    out.push([ax * Math.cos(t), ay * Math.sin(t)]);
  }
  return out;
}

/** Two strands twisted around a curve lying in the xy plane (rope, wicker handle). */
function rope(b, pts, r, turns, o = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const n = Math.round(turns * 6);
  for (let s = 0; s < 2; s++) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, P = curve.getPointAt(t), T = curve.getTangentAt(t);
      const nx = -T.y, ny = T.x, len = Math.hypot(nx, ny) || 1;
      const a = t * turns * TAU + s * PI, c = Math.cos(a) * r * 0.5, z = Math.sin(a) * r * 0.5;
      out.push([P.x + (nx / len) * c, P.y + (ny / len) * c, P.z + z]);
    }
    b.tube(out, r * 0.62, { ...o, seg: Math.round(n * 1.5), radial: 5 });
  }
}

/** A clock dial facing +z with its face at z = 0 of the current frame; the hands show ten past ten. */
function clockDial(b, R, o = {}) {
  const face = o.face || C.ivory, ink = o.ink || C.ink;
  b.cyl(R, R, 0.006, { at: [0, 0, -0.003], rot: [PI / 2, 0, 0], color: face, seg: 40 });
  for (let i = 0; i < 60; i++) {
    const hour = i % 5 === 0;
    if (!hour && !o.minutes) continue;
    const quarter = i % 15 === 0;
    const len = R * (quarter ? 0.19 : hour ? 0.15 : 0.06);
    const w = R * (quarter ? 0.07 : hour ? 0.05 : 0.018);
    const a = (i / 60) * TAU, rr = R * 0.9 - len / 2;
    b.box(w, len, 0.003, { at: [Math.sin(a) * rr, Math.cos(a) * rr, 0.0015], rot: [0, 0, -a], color: ink, r: 0 });
  }
  const bar = o.style === "bar";
  const hand = (len, w, a, z) => {
    const shape = bar
      ? [[-w * 0.5, -len * 0.22], [w * 0.5, -len * 0.22], [w * 0.42, len], [-w * 0.42, len]]
      : [[-w * 0.3, -len * 0.2], [w * 0.3, -len * 0.2], [w * 0.5, len * 0.62], [0, len], [-w * 0.5, len * 0.62]];
    b.extrude(shape, 0.003, { at: [0, 0, z], rot: [0, 0, -a], color: o.hands || ink, bevel: 0.0008 });
  };
  hand(R * 0.52, R * (bar ? 0.085 : 0.12), ((10 + 10 / 60) / 12) * TAU, 0.0045);
  hand(R * 0.8, R * (bar ? 0.065 : 0.085), (10 / 60) * TAU, 0.009);
  if (o.seconds) {
    const a = (37 / 60) * TAU;
    b.group({ rot: [0, 0, -a], at: [0, 0, 0.013] }, () => {
      b.box(R * 0.022, R * 0.86, 0.002, { at: [0, R * 0.26, 0], color: o.seconds, r: 0 });
      if (bar) b.cyl(R * 0.075, R * 0.075, 0.003, { at: [0, R * 0.6, 0.001], rot: [PI / 2, 0, 0], color: o.seconds, seg: 18 });
    });
  }
  b.cyl(R * 0.06, R * 0.06, 0.008, { at: [0, 0, 0.012], rot: [PI / 2, 0, 0], color: o.cap || o.hands || ink, seg: 14 });
}

/** A soft puff of steam: three overlapping balls. */
function puff(b, x, y, z, r, color = STEAM) {
  b.sphere(r, { at: [x, y, z], color, seg: 10 });
  b.sphere(r * 0.72, { at: [x + r * 0.78, y - r * 0.22, z + r * 0.15], color, seg: 8 });
  b.sphere(r * 0.66, { at: [x - r * 0.74, y - r * 0.18, z - r * 0.12], color, seg: 8 });
}

/** A small four-pointed glint (unlit). */
function glint(b, x, y, z, s) {
  b.box(s, s * 0.16, 0.003, { at: [x, y, z], color: "#fffbe8", kind: "glow", light: false, r: 0 });
  b.box(s * 0.16, s, 0.003, { at: [x, y, z], color: "#fffbe8", kind: "glow", light: false, r: 0 });
}

export default {
  // Reference implementation: a simple prop built from bevelled boxes.
  crate(b, p) {
    const wood = p.color || C.wood;
    const dark = shade(wood, -0.12);
    const s = 0.4;
    b.box(s * 0.92, s * 0.92, s * 0.92, { at: [0, s / 2, 0], color: shade(wood, -0.05), r: 0.01 });
    // frame planks on the four vertical edges and the top and bottom rims
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      b.box(0.05, s, 0.05, { at: [x * (s / 2 - 0.025), s / 2, z * (s / 2 - 0.025)], color: wood, r: 0.008 });
    }
    for (const y of [0.025, s - 0.025]) {
      for (const z of [-1, 1]) b.box(s, 0.05, 0.05, { at: [0, y, z * (s / 2 - 0.025)], color: wood, r: 0.008 });
      for (const x of [-1, 1]) b.box(0.05, 0.05, s, { at: [x * (s / 2 - 0.025), y, 0], color: wood, r: 0.008 });
    }
    // a diagonal brace on the front and back faces
    for (const z of [-1, 1]) {
      b.box(0.045, s * 1.2, 0.02, { at: [0, s / 2, z * (s / 2 + 0.002)], rot: [0, 0, Math.PI / 4],
        color: dark, r: 0.006 });
    }
  },

  // Treasure chest: plank body, domed plank lid, gold bands and lock; 'open' tips the lid back over a hoard.
  chest(b, p) {
    const open = p.variant === "open";
    const wood = p.color || "#9b5a34";
    const gold = C.gold;
    const W = 0.46, D = 0.28, Hb = 0.23, Hd = 0.135, foot = 0.022;
    const top = foot + Hb;
    const metal = { color: gold, kind: "metal", seg: 1 };
    b.group({ scale: open ? 0.88 : 1 }, () => {
      // feet
      for (const x of [-1, 1]) for (const z of [-1, 1]) {
        b.box(0.06, foot + 0.01, 0.06, { at: [x * (W / 2 - 0.035), (foot + 0.01) / 2, z * (D / 2 - 0.035)],
          color: shade(wood, -0.2), r: 0.008, seg: 1 });
      }
      // body: three planks
      const ph = Hb / 3;
      for (let i = 0; i < 3; i++) {
        b.box(W, ph, D, { at: [0, foot + ph * (i + 0.5), 0], color: shade(wood, i === 1 ? 0.025 : -0.015), r: 0.01 });
      }
      // gold bands: bottom, top rim, two straps front and back
      b.box(W + 0.01, 0.026, D + 0.01, { at: [0, foot + 0.013, 0], ...metal, r: 0.006 });
      b.box(W + 0.012, 0.03, D + 0.012, { at: [0, top - 0.015, 0], ...metal, r: 0.006 });
      for (const x of [-0.15, 0.15]) for (const z of [-1, 1]) {
        b.box(0.04, Hb, 0.01, { at: [x, foot + Hb / 2, z * (D / 2 + 0.004)], ...metal, r: 0.003 });
      }
      // lock plate with keyhole
      b.box(0.07, 0.08, 0.014, { at: [0, top - 0.055, D / 2 + 0.009], ...metal, r: 0.006 });
      b.cyl(0.009, 0.009, 0.004, { at: [0, top - 0.048, D / 2 + 0.017], rot: [PI / 2, 0, 0], color: C.black, seg: 12 });
      b.box(0.007, 0.02, 0.004, { at: [0, top - 0.062, D / 2 + 0.017], color: C.black, r: 0 });
      // side handles
      b.mirrorX(() => {
        b.box(0.008, 0.03, 0.07, { at: [W / 2 + 0.004, top - 0.07, 0], ...metal, r: 0.003 });
        b.torus(0.032, 0.006, { at: [W / 2 + 0.012, top - 0.075, 0], rot: [0, PI / 2, PI], arc: PI, color: gold,
          kind: "metal", seg: 12, tubeSeg: 6 });
      });

      // lid, built in the hinge frame: hinge line along x at the back top edge, lid towards +z
      const lid = () => {
        const a = D / 2, c = Hd, th = 0.026;
        // four curved planks running left-right
        for (let k = 0; k < 4; k++) {
          const t0 = (k * PI) / 4, t1 = ((k + 1) * PI) / 4;
          const shape = [...arc(a, c, t0, t1, 4), ...arc(a - th, c - th, t1, t0, 4)];
          b.extrude(shape, W - 0.07, { at: [0, 0, a], rot: [0, PI / 2, 0], color: shade(wood, k % 2 ? 0.03 : -0.01),
            bevel: 0.005 });
        }
        // end boards
        const dshape = arc(a, c, 0, PI, 14);
        for (const x of [-1, 1]) {
          b.extrude(dshape, 0.022, { at: [x * (W / 2 - 0.018), 0, a], rot: [0, PI / 2, 0], color: shade(wood, -0.06),
            bevel: 0.006 });
        }
        // gold straps over the lid and a rim band along its lower edge
        for (const x of [-0.15, 0.15]) {
          const band = [...arc(a + 0.008, c + 0.008, 0, PI, 16), ...arc(a - 0.01, c - 0.01, PI, 0, 16)];
          b.extrude(band, 0.034, { at: [x, 0, a], rot: [0, PI / 2, 0], color: gold, kind: "metal", bevel: 0.003 });
        }
        b.box(W + 0.012, 0.024, 0.012, { at: [0, 0.012, D + 0.004], ...metal, r: 0.004 });
        b.box(W + 0.012, 0.024, 0.012, { at: [0, 0.012, -0.004], ...metal, r: 0.004 });
        // hasp hanging over the lock
        b.box(0.04, 0.05, 0.01, { at: [0, -0.004, D + 0.012], ...metal, r: 0.004 });
        // lining under the lid (seen when open)
        b.box(W - 0.05, 0.006, D - 0.02, { at: [0, 0.004, a], color: C.crimson, r: 0.002, seg: 1 });
      };
      if (open) b.group({ at: [0, top, -D / 2], rot: [-1.64, 0, 0] }, lid);
      else b.group({ at: [0, top, -D / 2] }, lid);

      if (open) {
        const rnd = randomFor(b, p);
        // the box is full to the brim with gold: a level of coins, a lumpy mound, gems and glints
        b.box(W - 0.026, 0.024, D - 0.026, { at: [0, top - 0.014, 0], color: shade(gold, -0.06), kind: "metal", r: 0.006,
          seg: 1 });
        const mx = W / 2 - 0.02, mz = D / 2 - 0.018, my = 0.08, cy = top - 0.022;
        const lumps = [[0, 0, 1, 1], [-0.09, 0.01, 0.55, 1.25], [0.1, -0.01, 0.5, 1.15]];
        for (const [x, z, sx, sy] of lumps) {
          b.sphere(1, { at: [x, cy, z], scale: [mx * sx, my * sy, mz * 0.95], color: shade(gold, -0.04), kind: "metal",
            seg: 18 });
        }
        const surf = (x, z) => {
          let y = cy;
          for (const [lx, lz, sx, sy] of lumps) {
            const q = 1 - ((x - lx) / (mx * sx)) ** 2 - ((z - lz) / (mz * 0.95)) ** 2;
            if (q > 0) y = Math.max(y, cy + my * sy * Math.sqrt(q));
          }
          return y;
        };
        for (let i = 0; i < 30; i++) {
          const t = rnd() * TAU, rr = Math.sqrt(rnd()) * 0.9;
          const x = Math.cos(t) * rr * mx, z = Math.sin(t) * rr * mz;
          b.cyl(0.02, 0.02, 0.006, { at: [x, surf(x, z) + 0.001, z], seg: 12, color: shade(gold, rnd.range(0, 0.07)),
            kind: "metal", rot: [rnd.range(-0.7, 0.7), rnd() * TAU, rnd.range(-0.7, 0.7)] });
        }
        const gems = [[-0.1, 0.04, C.red], [0.07, -0.03, C.blue], [-0.01, 0.07, C.green], [0.13, 0.05, C.purple],
          [-0.15, -0.04, C.teal]];
        for (const [x, z, col] of gems) {
          b.ico(0.021, { at: [x, surf(x, z) + 0.008, z], color: col, kind: "gloss", detail: 0 });
        }
        for (const [x, z, s] of [[-0.06, 0.02, 0.05], [0.1, 0.03, 0.04], [0.02, -0.06, 0.035]]) {
          glint(b, x, surf(x, z) + 0.03, z + 0.03, s);
        }
        // a few coins spilled beside the chest and one leaning on its front
        for (const [x, z, tilt] of [[W / 2 + 0.03, D / 2 - 0.03, 0], [W / 2 + 0.01, D / 2 - 0.075, 0],
          [-W / 2 - 0.028, D / 2 - 0.05, 0], [0.12, D / 2 + 0.002, 1.3]]) {
          b.cyl(0.02, 0.02, 0.006, { at: [x, tilt ? 0.022 : 0.003, z], rot: [tilt, 0.3, 0], seg: 12, color: gold,
            kind: "metal" });
        }
      }
    });
  },

  // Cage: 'bird' is a round brass birdcage with a canary on its perch; 'box' a square cage with a door.
  cage(b, p) {
    if (p.variant === "box") {
      const frame = p.color || "#7a5236";
      const bars = { color: C.iron, kind: "metal" };
      const S = 0.32, yb = 0.05, yt = 0.43;
      b.box(S + 0.04, yb, S + 0.04, { at: [0, yb / 2, 0], color: frame, r: 0.012 });
      b.box(S + 0.03, 0.035, S + 0.03, { at: [0, yt + 0.0175, 0], color: frame, r: 0.01 });
      // corner posts
      for (const x of [-1, 1]) for (const z of [-1, 1]) {
        b.box(0.024, yt - yb, 0.024, { at: [(x * S) / 2, (yt + yb) / 2, (z * S) / 2], ...bars, r: 0.005, seg: 1 });
      }
      // bars on four sides and a band around the middle
      for (let s = 0; s < 4; s++) {
        b.group({ rot: [0, (s * PI) / 2, 0] }, () => {
          for (let k = -3; k <= 3; k++) b.rod([k * 0.042, yb, S / 2], [k * 0.042, yt, S / 2], 0.0055, { ...bars, seg: 6 });
          b.box(S, 0.016, 0.008, { at: [0, 0.25, S / 2], ...bars, r: 0.003, seg: 1 });
        });
      }
      // door on the front: frame, hinges and latch
      const dz = S / 2 + 0.008;
      b.box(0.17, 0.014, 0.008, { at: [0, 0.075, dz], ...bars, r: 0.003, seg: 1 });
      b.box(0.17, 0.014, 0.008, { at: [0, 0.335, dz], ...bars, r: 0.003, seg: 1 });
      b.box(0.014, 0.27, 0.008, { at: [-0.078, 0.205, dz], ...bars, r: 0.003, seg: 1 });
      b.box(0.014, 0.27, 0.008, { at: [0.078, 0.205, dz], ...bars, r: 0.003, seg: 1 });
      b.box(0.03, 0.03, 0.014, { at: [0.09, 0.205, dz + 0.004], color: C.brass, kind: "metal", r: 0.004, seg: 1 });
      for (const y of [0.11, 0.3]) b.cyl(0.008, 0.008, 0.03, { at: [-0.085, y, dz], color: C.brass, kind: "metal", seg: 8 });
      // carrying handle
      b.torus(0.06, 0.009, { at: [0, yt + 0.035, 0], arc: PI, ...bars, seg: 16, tubeSeg: 6 });
      return;
    }
    const metal = { color: p.color || C.brass, kind: "metal" };
    const R = 0.16, yb = 0.045, ys = 0.32, apex = 0.445;
    // base and floor
    b.cyl(R + 0.008, R + 0.016, yb, { at: [0, yb / 2, 0], ...metal, seg: 32 });
    b.torus(R + 0.01, 0.008, { at: [0, yb, 0], rot: [PI / 2, 0, 0], ...metal, seg: 32, tubeSeg: 6 });
    b.cyl(R - 0.004, R - 0.004, 0.004, { at: [0, yb + 0.002, 0], color: "#ead9b4", seg: 28 });
    // bars: straight sides, then curving in to the top
    const N = 16;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU, sx = Math.sin(a), sz = Math.cos(a);
      b.rod([R * sx, yb, R * sz], [R * sx, ys, R * sz], 0.0045, { ...metal, seg: 6 });
      const dome = [[R, ys], [R * 0.97, ys + 0.04], [R * 0.82, ys + 0.085], [R * 0.52, apex - 0.012], [0.035, apex]];
      b.tube(dome.map(([r, y]) => [r * sx, y, r * sz]), 0.0045, { ...metal, radial: 4, seg: 12 });
    }
    for (const y of [0.13, 0.23, ys]) b.torus(R, 0.006, { at: [0, y, 0], rot: [PI / 2, 0, 0], ...metal, seg: 36, tubeSeg: 5 });
    // top cap and hanging ring
    b.sphere(0.042, { at: [0, apex, 0], scale: [1, 0.5, 1], ...metal, seg: 14 });
    b.torus(0.03, 0.007, { at: [0, apex + 0.045, 0], ...metal, seg: 20, tubeSeg: 6 });
    // perch and a canary
    b.rod([-R, 0.165, 0], [R, 0.165, 0], 0.007, { color: C.lightWood, seg: 8 });
    b.prop("bird", { variant: "dove", color: "#f3c63f", color2: "#f3c63f" }, { at: [0, 0.172, 0.005], scale: 0.42 });
  },

  // Woven basket: a checker of weavers and stakes, a rim and a twisted handle.
  basket(b, p) {
    const straw = p.color || "#d9ab5f";
    const r0 = 0.134, r1 = 0.164, y0 = 0.016, y1 = 0.13;
    const rAt = (y) => r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    // foot ring, dark core behind the weave, inside wall and floor
    b.cyl(r0 - 0.004, r0 - 0.012, y0 + 0.002, { at: [0, (y0 + 0.002) / 2, 0], color: shade(straw, -0.12), seg: 28 });
    b.lathe([[r0 - 0.002, y0], [r1 - 0.002, y1]], { color: shade(straw, -0.3), seg: 28 });
    b.lathe([[r1 - 0.006, y1], [r0 - 0.008, y0 + 0.006], [0, y0 + 0.006]], { color: shade(straw, -0.16), seg: 32 });
    // plain weave: in each row the weaver passes over one stake and under the next, offset row by row
    const rows = 5, rh = (y1 - y0) / rows, n = 13, da = TAU / (2 * n);
    const weaver = straw, stake = shade(straw, -0.08);
    for (let k = 0; k < rows; k++) {
      const ya = y0 + k * rh;
      for (let m = 0; m < 2 * n; m++) {
        const over = (m + k) % 2 === 0, a0 = m * da;
        const g = gridGeo(3, 3, (u, v) => {
          const a = a0 + da * u, y = ya + rh * v;
          const su = Math.sin(PI * u), sv = Math.sin(PI * v);
          const bump = over ? 0.007 * Math.pow(sv, 0.55) * (0.7 + 0.3 * su) : 0.005 * Math.pow(su, 0.55) * (0.75 + 0.25 * sv);
          const r = rAt(y) + bump;
          return [r * Math.sin(a), y, r * Math.cos(a)];
        });
        b.geo(g, { color: over ? weaver : stake });
      }
    }
    // rim
    b.torus(r1 + 0.003, 0.012, { at: [0, y1 + 0.004, 0], rot: [PI / 2, 0, 0], color: shade(straw, -0.03), seg: 44,
      tubeSeg: 8 });
    // twisted handle arching left to right
    const hp = [[-r1 + 0.006, y1 - 0.025], [-r1 + 0.003, y1 + 0.04], [-0.128, 0.226], [-0.068, 0.265], [0, 0.276],
      [0.068, 0.265], [0.128, 0.226], [r1 - 0.003, y1 + 0.04], [r1 - 0.006, y1 - 0.025]];
    rope(b, hp.map(([x, y]) => [x, y, 0]), 0.021, 10, { color: shade(straw, -0.05) });
  },

  // Painted metal pail with ribs, a rolled rim and a wire bail handle with a wooden grip.
  bucket(b, p) {
    const col = p.color || "#4f8fd0";
    const R0 = 0.096, R1 = 0.122, H = 0.235;
    const rAt = (y) => R0 + ((R1 - R0) * y) / H;
    b.lathe([[0, 0], [R0 - 0.004, 0], [R0, 0.006], [R1, H]], { color: col, kind: "gloss", seg: 36 });
    b.lathe([[R1 - 0.005, H], [R0 - 0.006, 0.012], [0, 0.012]], { color: shade(col, -0.16), kind: "gloss", seg: 36 });
    b.torus(R1 - 0.001, 0.0065, { at: [0, H, 0], rot: [PI / 2, 0, 0], color: C.silver, kind: "metal", seg: 40, tubeSeg: 8 });
    for (const y of [0.06, 0.15]) {
      b.torus(rAt(y) + 0.001, 0.004, { at: [0, y, 0], rot: [PI / 2, 0, 0], color: shade(col, -0.05), kind: "gloss",
        seg: 40, tubeSeg: 6 });
    }
    // lugs and the bail, tipped slightly back
    const ly = 0.2, lx = rAt(ly) + 0.004;
    b.mirrorX(() => {
      b.cyl(0.017, 0.017, 0.008, { at: [lx, ly, 0], rot: [0, 0, PI / 2], color: C.silver, kind: "metal", seg: 14 });
    });
    b.group({ at: [0, ly, 0], rot: [-0.3, 0, 0] }, () => {
      const w = lx + 0.006;
      const pts = [[-w, 0], [-w + 0.004, 0.04], [-0.085, 0.085], [-0.04, 0.1], [0, 0.103], [0.04, 0.1], [0.085, 0.085],
        [w - 0.004, 0.04], [w, 0]];
      b.tube(pts.map(([x, y]) => [x, y, 0]), 0.0042, { color: C.steel, kind: "metal", radial: 6, seg: 40 });
      b.cyl(0.012, 0.012, 0.065, { at: [0, 0.103, 0], rot: [0, 0, PI / 2], color: C.lightWood, seg: 12 });
    });
  },

  // Wooden barrel: bulging staves with seams, iron hoops and a lid with a bung.
  barrel(b, p) {
    const wood = p.color || C.wood;
    const H = 0.6, Re = 0.168, Rm = 0.2;
    const R = (y) => Re + (Rm - Re) * Math.sin((PI * y) / H);
    const prof = [];
    for (let i = 0; i <= 12; i++) prof.push([R((H * i) / 12), (H * i) / 12]);
    // dark core seen through the seams
    b.lathe(prof.map(([r, y]) => [r - 0.006, y]), { color: shade(wood, -0.28), seg: 24 });
    // staves, each with a rim at the top
    const staveProf = [...prof, [Re - 0.014, H], [R(H - 0.03) - 0.014, H - 0.03]];
    const N = 18, gap = 0.012, rnd = randomFor(b, p);
    for (let i = 0; i < N; i++) {
      latheSector(b, staveProf, (i / N) * TAU + gap / 2, TAU / N - gap,
        { color: shade(wood, rnd.range(-0.045, 0.045)), seg: 2 });
    }
    // hoops
    const iron = { color: "#4d525a", kind: "metal" };
    for (const yc of [0.05, 0.15, 0.45, 0.55]) {
      const h = 0.014;
      b.lathe([[R(yc - h) + 0.002, yc - h], [R(yc - h) + 0.007, yc - h + 0.004], [R(yc + h) + 0.007, yc + h - 0.004],
        [R(yc + h) + 0.002, yc + h]], { ...iron, seg: 36 });
    }
    // lid: planks with seams and a bung
    const ly = H - 0.02;
    b.cyl(Re - 0.012, Re - 0.012, 0.012, { at: [0, ly, 0], color: shade(wood, 0.05), seg: 32 });
    for (const x of [-0.05, 0.05]) {
      b.box(0.004, 0.004, 2 * Math.sqrt((Re - 0.014) ** 2 - x * x), { at: [x, ly + 0.006, 0], color: shade(wood, -0.2), r: 0 });
    }
    b.cyl(0.018, 0.02, 0.012, { at: [0.095, ly + 0.008, 0.02], color: shade(wood, -0.12), seg: 12 });
  },

  // Glass jar with a gold screw lid; 'filled' holds something (color = contents).
  jar(b, p) {
    const filled = p.variant === "filled";
    const R = 0.093, Hs = 0.2, Rn = 0.066;
    if (filled) {
      // the glass in front washes colours out, so the contents are a shade deeper than asked for
      const fill = shade(p.color || "#e0861c", -0.1);
      const fy = 0.17;
      b.lathe([[0, 0.012], [R - 0.012, 0.014], [R - 0.009, 0.024], [R - 0.009, fy - 0.004], [R - 0.016, fy], [0, fy + 0.003]],
        { color: fill, kind: "gloss", seg: 32 });
    }
    // glass with thickness, so the far wall shows through the near one
    b.lathe([[0, 0.004], [R - 0.014, 0], [R - 0.003, 0.005], [R, 0.02], [R, Hs], [R - 0.01, Hs + 0.028],
      [Rn + 0.004, Hs + 0.04], [Rn, Hs + 0.046], [Rn, Hs + 0.066], [Rn - 0.006, Hs + 0.066], [Rn - 0.006, Hs + 0.046],
      [R - 0.016, Hs + 0.026], [R - 0.006, Hs], [R - 0.006, 0.02], [R - 0.016, 0.01], [0, 0.01]],
    { color: C.glass, kind: "glass", seg: 36 });
    // highlight streaks
    b.cyl(R + 0.001, R + 0.001, 0.15, { at: [0, 0.11, 0], open: true, thetaStart: -0.9, thetaLength: 0.16,
      color: "#ffffff", kind: "glow", light: false, seg: 3 });
    b.cyl(R + 0.001, R + 0.001, 0.09, { at: [0, 0.13, 0], open: true, thetaStart: -0.62, thetaLength: 0.06,
      color: "#ffffff", kind: "glow", light: false, seg: 2 });
    // lid
    const lid = { color: C.gold, kind: "metal" };
    b.cyl(Rn + 0.009, Rn + 0.009, 0.036, { at: [0, Hs + 0.07, 0], ...lid, seg: 32 });
    b.torus(Rn + 0.006, 0.005, { at: [0, Hs + 0.088, 0], rot: [PI / 2, 0, 0], ...lid, seg: 32, tubeSeg: 6 });
    b.cyl(Rn + 0.004, Rn + 0.004, 0.006, { at: [0, Hs + 0.089, 0], ...lid, seg: 32 });
  },

  // A mug with a handle, coffee inside.
  cup(b, p) {
    const col = p.color || "#d9534a";
    const R = 0.05, H = 0.12;
    b.lathe([[0, 0], [R - 0.008, 0], [R - 0.002, 0.004], [R, 0.014], [R, H - 0.003], [R - 0.003, H]],
      { color: col, kind: "gloss", seg: 28 });
    b.lathe([[R - 0.003, H], [R - 0.008, H - 0.004], [R - 0.008, 0.016], [0, 0.014]], { color: "#f6efe4", kind: "gloss", seg: 28 });
    b.cyl(R - 0.008, R - 0.008, 0.004, { at: [0, H - 0.024, 0], color: "#5b3524", kind: "gloss", seg: 24 });
    b.torus(0.031, 0.0095, { at: [R - 0.003, H * 0.5, 0], rot: [0, 0, -PI / 2], arc: PI, color: col, kind: "gloss",
      seg: 16, tubeSeg: 8 });
  },

  // A glass bottle with a label and a cork.
  bottle(b, p) {
    const col = p.color || "#2f7d55";
    const R = 0.045;
    b.lathe([[0, 0], [R - 0.006, 0], [R, 0.008], [R, 0.18], [R - 0.005, 0.202], [0.03, 0.228], [0.018, 0.25],
      [0.0155, 0.265], [0.0155, 0.29], [0, 0.29]], { color: col, kind: "gloss", seg: 28 });
    b.torus(0.0165, 0.004, { at: [0, 0.284, 0], rot: [PI / 2, 0, 0], color: shade(col, 0.05), kind: "gloss", seg: 16,
      tubeSeg: 6 });
    b.cyl(0.0125, 0.0115, 0.035, { at: [0, 0.3, 0], color: "#c9a06a", seg: 12 });
    // label
    const lab = { open: true, thetaStart: -1.15, thetaLength: 2.3, seg: 12 };
    b.cyl(R + 0.0012, R + 0.0012, 0.08, { at: [0, 0.105, 0], ...lab, color: C.paper });
    b.cyl(R + 0.0018, R + 0.0018, 0.012, { at: [0, 0.135, 0], ...lab, color: C.crimson });
    b.cyl(R + 0.0018, R + 0.0018, 0.012, { at: [0, 0.075, 0], ...lab, color: C.crimson });
  },

  // A clock at ten past ten: 'table' is an arched mantel clock, 'alarm' a twin-bell alarm clock.
  clock(b, p) {
    if (p.variant === "alarm") {
      const col = p.color || C.red;
      const chrome = { color: C.silver, kind: "metal" };
      const R = 0.14, cy = 0.185, dz = 0.1;
      // legs
      b.mirrorX(() => {
        b.rod([0.07, cy - 0.1, 0], [0.115, 0.012, 0], 0.009, { ...chrome, seg: 8 });
        b.sphere(0.016, { at: [0.117, 0.014, 0], ...chrome, seg: 10 });
      });
      // body, bezel, dial
      b.cyl(R, R, dz, { at: [0, cy, 0], rot: [PI / 2, 0, 0], color: col, kind: "gloss", seg: 40 });
      b.torus(R - 0.012, 0.008, { at: [0, cy, dz / 2], ...chrome, seg: 44, tubeSeg: 8 });
      b.group({ at: [0, cy, dz / 2 + 0.002] }, () => clockDial(b, R - 0.02, { face: C.white }));
      // back: winding key
      b.cyl(0.012, 0.012, 0.02, { at: [0.04, cy, -dz / 2 - 0.01], rot: [PI / 2, 0, 0], ...chrome, seg: 10 });
      b.box(0.05, 0.03, 0.006, { at: [0.04, cy, -dz / 2 - 0.022], ...chrome, r: 0.003, seg: 1 });
      // twin bells with a hammer between them
      b.mirrorX(() => {
        b.group({ at: [0, cy, -0.01], rot: [0, 0, -0.68] }, () => {
          b.rod([0, R - 0.01, 0], [0, R + 0.03, 0], 0.006, { ...chrome, seg: 8 });
          b.sphere(0.068, { at: [0, R + 0.03, 0], thetaLength: PI / 2, ...chrome, seg: 22 });
          b.sphere(0.012, { at: [0, R + 0.098, 0], ...chrome, seg: 10 });
        });
      });
      b.rod([0, cy + R, -0.01], [0, cy + R + 0.06, -0.01], 0.005, { ...chrome, seg: 8 });
      b.sphere(0.013, { at: [0, cy + R + 0.062, -0.01], ...chrome, seg: 10 });
      return;
    }
    // table (mantel) clock
    const wood = p.color || "#8a4f2e";
    const brass = { color: C.brass, kind: "metal" };
    const foot = 0.016, py = foot, ph = 0.036, by = py + ph;
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      b.sphere(0.017, { at: [x * 0.15, foot * 0.6, z * 0.055], scale: [1, 0.75, 1], ...brass, seg: 10 });
    }
    b.box(0.36, ph, 0.16, { at: [0, py + ph / 2, 0], color: shade(wood, -0.08), r: 0.01 });
    // case: rectangle with an arched top, extruded
    const hw = 0.152, rect = 0.19;
    const shape = [[-hw, 0], [hw, 0], ...arc(hw, hw, 0, PI, 20).map(([x, y]) => [x, y + rect])];
    b.extrude(shape, 0.11, { at: [0, by, 0], color: wood, bevel: 0.012 });
    // dial in a brass bezel, centred in the arch
    const dy = by + rect, dzf = 0.07;
    b.torus(0.112, 0.011, { at: [0, dy, dzf], ...brass, seg: 44, tubeSeg: 8 });
    b.group({ at: [0, dy, dzf] }, () => clockDial(b, 0.106, {}));
    // small brass plaque below the dial and a finial on top
    b.box(0.07, 0.022, 0.006, { at: [0, by + 0.045, dzf], ...brass, r: 0.003, seg: 1 });
    b.cyl(0.012, 0.02, 0.012, { at: [0, by + rect + hw + 0.016, 0], ...brass, seg: 12 });
    b.sphere(0.017, { at: [0, by + rect + hw + 0.032, 0], ...brass, seg: 12 });
  },

  // Tall case clock: plinth, trunk with a window on the pendulum, hood with the dial and a crest.
  grandfather_clock(b, p) {
    const wood = p.color || "#7a4630";
    const dark = shade(wood, -0.08), light = shade(wood, 0.06);
    const brass = { color: C.brass, kind: "metal" };
    // base
    b.box(0.44, 0.06, 0.3, { at: [0, 0.03, 0], color: dark, r: 0.012 });
    b.box(0.4, 0.26, 0.27, { at: [0, 0.19, 0], color: wood, r: 0.012 });
    b.box(0.28, 0.16, 0.02, { at: [0, 0.19, 0.135], color: light, r: 0.008, seg: 1 });
    b.box(0.42, 0.03, 0.29, { at: [0, 0.335, 0], color: dark, r: 0.01 });
    // trunk
    const tz = 0.115;
    b.box(0.32, 0.72, 0.23, { at: [0, 0.71, 0], color: wood, r: 0.012 });
    const wy = 0.72, wh = 0.5, ww = 0.18;
    b.box(ww, wh, 0.004, { at: [0, wy, tz + 0.002], color: "#2a1c14", r: 0 });
    for (const x of [-1, 1]) {
      b.box(0.025, wh + 0.05, 0.016, { at: [x * (ww / 2 + 0.0125), wy, tz + 0.006], color: light, r: 0.005, seg: 1 });
    }
    for (const y of [-1, 1]) {
      b.box(ww + 0.05, 0.025, 0.016, { at: [0, wy + y * (wh / 2 + 0.0125), tz + 0.006], color: light, r: 0.005, seg: 1 });
    }
    // weights and pendulum
    for (const x of [-0.05, 0.05]) {
      b.rod([x, wy + wh / 2, tz + 0.012], [x, wy + 0.12, tz + 0.012], 0.002, { ...brass, seg: 5 });
      b.cyl(0.016, 0.016, 0.09, { at: [x, wy + 0.075, tz + 0.016], ...brass, seg: 14 });
    }
    b.group({ at: [0, wy + wh / 2 - 0.01, tz + 0.01], rot: [0, 0, 0.12] }, () => {
      b.box(0.01, 0.37, 0.003, { at: [0, -0.185, 0], ...brass, r: 0 });
      b.cyl(0.052, 0.052, 0.012, { at: [0, -0.39, 0], rot: [PI / 2, 0, 0], color: C.gold, kind: "metal", seg: 28 });
    });
    // hood with dial
    b.box(0.4, 0.03, 0.27, { at: [0, 1.085, 0], color: dark, r: 0.01 });
    b.box(0.38, 0.38, 0.25, { at: [0, 1.29, 0], color: wood, r: 0.012 });
    b.group({ at: [0, 1.29, 0.127] }, () => {
      b.torus(0.137, 0.012, { ...brass, seg: 48, tubeSeg: 8 });
      clockDial(b, 0.132, { minutes: true });
    });
    for (const x of [-0.172, 0.172]) b.cyl(0.013, 0.013, 0.37, { at: [x, 1.29, 0.118], ...brass, seg: 10 });
    // cornice, arched crest and finials
    b.box(0.43, 0.035, 0.29, { at: [0, 1.497, 0], color: dark, r: 0.01 });
    b.extrude([[-0.17, 0], [0.17, 0], ...arc(0.17, 0.07, 0, PI, 16).slice(1, -1)], 0.22,
      { at: [0, 1.514, 0], color: wood, bevel: 0.008 });
    for (const x of [-0.19, 0.19]) {
      b.cyl(0.012, 0.016, 0.02, { at: [x, 1.525, 0.1], ...brass, seg: 10 });
      b.sphere(0.02, { at: [x, 1.55, 0.1], ...brass, seg: 12 });
    }
    b.sphere(0.022, { at: [0, 1.6, 0], ...brass, seg: 12 });
  },

  // Railway-station clock: a double-faced clock on a cast-iron post.
  station_clock(b, p) {
    const col = p.color || "#2f5d4e";
    const gold = { color: C.gold, kind: "metal" };
    // base and post
    b.cyl(0.14, 0.15, 0.05, { at: [0, 0.025, 0], color: shade(col, -0.05), seg: 28 });
    b.lathe([[0.125, 0.05], [0.125, 0.075], [0.1, 0.1], [0.08, 0.16], [0.066, 0.26], [0.058, 0.33], [0.07, 0.345],
      [0.05, 0.36]], { color: col, seg: 28 });
    b.cyl(0.042, 0.048, 1.36, { at: [0, 0.36 + 0.68, 0], color: col, seg: 18 });
    for (const y of [0.34, 0.9, 1.68]) {
      b.torus(0.05, 0.01, { at: [0, y, 0], rot: [PI / 2, 0, 0], ...gold, seg: 22, tubeSeg: 6 });
    }
    b.lathe([[0.045, 1.68], [0.06, 1.69], [0.075, 1.72], [0.06, 1.74]], { color: col, seg: 24 });
    // clock head: a drum with a dial on each side
    const cy = 1.95, R = 0.215, dz = 0.15;
    b.cyl(R + 0.018, R + 0.018, dz, { at: [0, cy, 0], rot: [PI / 2, 0, 0], color: col, seg: 44 });
    for (const side of [1, -1]) {
      b.group({ at: [0, cy, side * (dz / 2 + 0.002)], rot: [0, side > 0 ? 0 : PI, 0] }, () => {
        b.torus(R + 0.009, 0.014, { ...gold, seg: 48, tubeSeg: 8 });
        clockDial(b, R, { minutes: true, face: C.white, ink: C.black, style: "bar", seconds: C.red });
      });
    }
    b.cyl(0.02, 0.03, 0.03, { at: [0, cy + R + 0.03, 0], ...gold, seg: 12 });
    b.sphere(0.028, { at: [0, cy + R + 0.06, 0], ...gold, seg: 14 });
  },

  // A bell with a crown loop and raised bands.
  bell(b, p) {
    const col = p.color || C.gold;
    const metal = { color: col, kind: "metal" };
    const R = 0.148;
    b.lathe([[0, 0.004], [R - 0.012, 0], [R, 0.006], [R + 0.002, 0.018], [R - 0.008, 0.034], [R * 0.85, 0.07],
      [R * 0.73, 0.12], [R * 0.65, 0.18], [R * 0.61, 0.23], [R * 0.59, 0.262], [R * 0.53, 0.29], [R * 0.36, 0.306],
      [0, 0.312]], { ...metal, seg: 40 });
    b.torus(R * 0.94, 0.006, { at: [0, 0.04, 0], rot: [PI / 2, 0, 0], ...metal, seg: 44, tubeSeg: 6 });
    b.torus(R * 0.6, 0.005, { at: [0, 0.235, 0], rot: [PI / 2, 0, 0], ...metal, seg: 36, tubeSeg: 6 });
    b.cyl(0.028, 0.034, 0.022, { at: [0, 0.318, 0], ...metal, seg: 16 });
    b.torus(0.03, 0.009, { at: [0, 0.352, 0], ...metal, seg: 20, tubeSeg: 8 });
  },

  // An open umbrella standing on its crook handle.
  umbrella(b, p) {
    const col = p.color || "#cc3b31";
    const alt = mix(col, C.white, 0.88);
    const N = 8, R = 0.35, yEdge = 0.52, yApex = 0.77, am = 1.25;
    const rib = (a, v) => {
      const t = v * am, r = (R * Math.sin(t)) / Math.sin(am);
      const y = yEdge + ((yApex - yEdge) * (Math.cos(t) - Math.cos(am))) / (1 - Math.cos(am));
      return [r * Math.sin(a), y, r * Math.cos(a)];
    };
    for (let i = 0; i < N; i++) {
      const a0 = ((i - 0.5) * TAU) / N, a1 = a0 + TAU / N;
      const fn = (u, v) => {
        const vv = v * (1 - 0.09 * Math.sin(PI * u));
        const A = rib(a0, vv), B = rib(a1, vv);
        return [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, A[2] + (B[2] - A[2]) * u];
      };
      const c = i % 2 ? alt : col;
      b.geo(gridGeo(6, 8, fn, { flip: true }), { color: c });
      b.geo(gridGeo(6, 8, fn), { color: shade(c, -0.12) });
      // rib tip
      b.sphere(0.009, { at: rib(a0, 1.0), color: C.charcoal, kind: "gloss", seg: 8 });
    }
    // ferrule on top, shaft, runner and stretchers
    b.cyl(0.004, 0.012, 0.05, { at: [0, yApex + 0.022, 0], color: C.charcoal, kind: "gloss", seg: 10 });
    b.sphere(0.008, { at: [0, yApex + 0.048, 0], color: C.charcoal, kind: "gloss", seg: 8 });
    b.rod([0, 0.1, 0], [0, yApex, 0], 0.0075, { color: C.steel, kind: "metal", seg: 10 });
    b.cyl(0.013, 0.013, 0.04, { at: [0, 0.47, 0], color: C.steel, kind: "metal", seg: 10 });
    for (let i = 0; i < N; i++) {
      const q = rib(((i - 0.5) * TAU) / N, 0.55);
      b.rod([0, 0.47, 0], [q[0] * 0.97, q[1] - 0.012, q[2] * 0.97], 0.0025, { color: C.steel, kind: "metal", seg: 4 });
    }
    // crook handle
    const hp = [[0, 0.135], [0, 0.07], [0.006, 0.036], [0.026, 0.0145], [0.052, 0.016], [0.068, 0.04], [0.068, 0.068]];
    b.tube(hp.map(([x, y]) => [x, y, 0]), 0.0135, { color: "#7a4a2a", kind: "gloss", radial: 10, seg: 36 });
    b.sphere(0.0135, { at: [0.068, 0.068, 0], color: "#7a4a2a", kind: "gloss", seg: 10 });
  },

  // A black cauldron on three legs with a glowing, bubbling brew (color = brew).
  cauldron(b, p) {
    const brew = p.color || "#78e05a";
    const iron = { color: "#35383e", kind: "metal" };
    // legs
    for (const a of [PI / 3, PI, (5 * PI) / 3]) {
      const sx = Math.sin(a), sz = Math.cos(a);
      b.rod([0.15 * sx, 0.004, 0.15 * sz], [0.12 * sx, 0.1, 0.12 * sz], 0.02, { ...iron, r2: 0.026, seg: 10 });
      b.sphere(0.024, { at: [0.15 * sx, 0.012, 0.15 * sz], scale: [1, 0.55, 1], ...iron, seg: 10 });
    }
    // pot with a rolled rim
    const rim = 0.35, rr = 0.17;
    b.lathe([[0, 0.07], [0.08, 0.062], [0.15, 0.086], [0.196, 0.13], [0.213, 0.19], [0.206, 0.25], [0.188, 0.298],
      [rr, rim - 0.012], [rr - 0.004, rim], [rr - 0.016, rim], [rr - 0.012, rim - 0.04], [0, rim - 0.04]],
    { ...iron, seg: 40 });
    b.torus(rr, 0.016, { at: [0, rim, 0], rot: [PI / 2, 0, 0], ...iron, seg: 44, tubeSeg: 10 });
    // side rings
    b.mirrorX(() => {
      b.sphere(0.02, { at: [0.2, 0.275, 0], ...iron, seg: 10 });
      b.torus(0.034, 0.0075, { at: [0.214, 0.245, 0], rot: [0, PI / 2, 0], ...iron, seg: 18, tubeSeg: 6 });
    });
    // brew surface, bubbles on it and rising above it
    const by = rim - 0.022;
    b.cyl(rr - 0.012, rr - 0.012, 0.01, { at: [0, by, 0], color: brew, kind: "glow", seg: 36 });
    const light = shade(brew, 0.12);
    const pops = [[-0.06, 0.04, 0.034], [0.07, -0.03, 0.028], [0.0, -0.08, 0.022], [0.09, 0.07, 0.02], [-0.09, -0.05, 0.018],
      [-0.02, 0.1, 0.016], [0.03, 0.02, 0.012]];
    for (const [x, z, r] of pops) {
      b.sphere(r, { at: [x, by + 0.004, z], thetaLength: PI / 2, color: light, kind: "glow", light: false, seg: 12 });
    }
    for (const [x, y, z, r] of [[0.02, by + 0.06, 0.03, 0.018], [-0.05, by + 0.085, -0.01, 0.013], [0.06, by + 0.1, -0.02, 0.011],
      [0.0, by + 0.125, 0.0, 0.009]]) {
      b.sphere(r, { at: [x, y, z], color: light, kind: "glow", light: false, seg: 10 });
    }
    // a drip over the front lip
    b.tube([[0.05, rim + 0.012, rr - 0.004], [0.052, rim + 0.004, rr + 0.016], [0.054, rim - 0.03, rr + 0.012]], 0.009,
      { color: brew, kind: "glow", light: false, radial: 6, seg: 10 });
    b.sphere(0.011, { at: [0.054, rim - 0.034, rr + 0.011], color: brew, kind: "glow", light: false, seg: 8 });
  },

  // A stove-top kettle with an arched handle, letting off steam from its spout.
  kettle(b, p) {
    const col = p.color || C.copper;
    const body = { color: col, kind: p.color ? "gloss" : "metal" };
    b.group({ at: [-0.022, 0, 0] }, () => {
      b.lathe([[0, 0.004], [0.07, 0], [0.094, 0.01], [0.107, 0.035], [0.11, 0.07], [0.102, 0.108], [0.083, 0.138],
        [0.06, 0.156], [0.052, 0.16]], { ...body, seg: 36 });
      b.lathe([[0.056, 0.157], [0.057, 0.163], [0.045, 0.174], [0.024, 0.181], [0, 0.183]], { ...body, seg: 28 });
      b.cyl(0.005, 0.006, 0.012, { at: [0, 0.186, 0], color: C.black, kind: "gloss", seg: 8 });
      b.sphere(0.016, { at: [0, 0.198, 0], scale: [1, 0.8, 1], color: C.black, kind: "gloss", seg: 12 });
      // spout
      b.rod([0.088, 0.045, 0], [0.135, 0.103, 0], 0.024, { ...body, r2: 0.017, seg: 14 });
      b.sphere(0.017, { at: [0.135, 0.103, 0], ...body, seg: 12 });
      b.rod([0.135, 0.103, 0], [0.162, 0.148, 0], 0.017, { ...body, r2: 0.013, seg: 14 });
      // handle over the top with a black grip
      const hp = [[0.052, 0.148], [0.064, 0.19], [0.04, 0.232], [0, 0.24], [-0.04, 0.232], [-0.064, 0.19], [-0.058, 0.14]];
      b.tube(hp.map(([x, y]) => [x, y, 0]), 0.0065, { color: C.steel, kind: "metal", radial: 6, seg: 30 });
      b.cyl(0.013, 0.013, 0.07, { at: [0, 0.237, 0], rot: [0, 0, PI / 2], color: C.black, kind: "gloss", seg: 12 });
      // steam rising from the spout and drifting back over the kettle
      puff(b, 0.164, 0.176, 0.0, 0.014);
      puff(b, 0.156, 0.212, 0.004, 0.018);
      puff(b, 0.128, 0.252, -0.004, 0.021);
    });
  },

  // An old-style kitchen range with oven, knobs and burners, a pot, a pan with eggs and a kettle.
  stove(b, p) {
    const col = p.color || "#ece2c8";
    const chrome = { color: C.silver, kind: "metal" };
    const black = { color: C.black, kind: "gloss" };
    const W = 0.76, D = 0.5, top = 0.6;
    // plinth and body
    b.box(W - 0.04, 0.06, D - 0.04, { at: [0, 0.03, -0.01], color: C.charcoal, r: 0.008, seg: 1 });
    b.box(W, top - 0.06, D, { at: [0, 0.06 + (top - 0.06) / 2, 0], color: col, kind: "gloss", r: 0.02 });
    // cook top and back panel
    b.box(W + 0.04, 0.03, D + 0.04, { at: [0, top + 0.015, 0], color: shade(col, -0.04), kind: "gloss", r: 0.012 });
    b.box(W + 0.04, 0.22, 0.05, { at: [0, top + 0.13, -D / 2 + 0.005], color: col, kind: "gloss", r: 0.015 });
    b.box(W + 0.05, 0.016, 0.06, { at: [0, top + 0.24, -D / 2 + 0.005], ...chrome, r: 0.006, seg: 1 });
    // burners
    const ct = top + 0.03;
    const burners = [[-0.2, 0.1], [0.2, 0.1], [-0.2, -0.13], [0.2, -0.13]];
    for (const [x, z] of burners) {
      b.cyl(0.078, 0.08, 0.008, { at: [x, ct + 0.004, z], ...black, seg: 20 });
      b.torus(0.06, 0.006, { at: [x, ct + 0.01, z], rot: [PI / 2, 0, 0], color: C.iron, kind: "metal", seg: 18, tubeSeg: 5 });
      b.cyl(0.022, 0.022, 0.01, { at: [x, ct + 0.01, z], color: C.iron, kind: "metal", seg: 12 });
    }
    // control strip with knobs
    const fz = D / 2;
    b.box(W - 0.06, 0.07, 0.012, { at: [0, top - 0.05, fz + 0.004], ...chrome, r: 0.005, seg: 1 });
    for (const x of [-0.27, -0.135, 0, 0.135, 0.27]) {
      b.cyl(0.024, 0.026, 0.024, { at: [x, top - 0.05, fz + 0.022], rot: [PI / 2, 0, 0], ...black, seg: 16 });
      b.box(0.005, 0.02, 0.004, { at: [x, top - 0.042, fz + 0.035], color: C.white, r: 0 });
    }
    // oven door with a warm window and a handle, drawer below
    b.box(0.62, 0.33, 0.024, { at: [0, 0.32, fz + 0.008], color: shade(col, 0.03), kind: "gloss", r: 0.012 });
    b.box(0.42, 0.16, 0.008, { at: [0, 0.31, fz + 0.022], color: C.charcoal, kind: "gloss", r: 0.006, seg: 1 });
    b.box(0.37, 0.12, 0.004, { at: [0, 0.31, fz + 0.028], color: "#c4672c", kind: "glow", r: 0 });
    b.box(0.37, 0.006, 0.004, { at: [0, 0.29, fz + 0.031], color: "#5a2c18", r: 0 });
    b.rod([-0.22, 0.445, fz + 0.045], [0.22, 0.445, fz + 0.045], 0.011, { ...chrome, seg: 12 });
    for (const x of [-0.2, 0.2]) b.rod([x, 0.445, fz + 0.016], [x, 0.445, fz + 0.045], 0.008, { ...chrome, seg: 8 });
    b.box(0.62, 0.075, 0.02, { at: [0, 0.11, fz + 0.006], color: shade(col, 0.03), kind: "gloss", r: 0.01, seg: 1 });
    b.box(0.14, 0.016, 0.016, { at: [0, 0.115, fz + 0.022], ...chrome, r: 0.005, seg: 1 });

    // a stock pot with a lid on the back-left burner
    b.group({ at: [-0.2, ct + 0.012, -0.13] }, () => {
      const pc = { color: C.red, kind: "gloss" };
      b.lathe([[0, 0], [0.1, 0], [0.105, 0.008], [0.105, 0.14], [0.1, 0.142], [0.096, 0.12], [0, 0.12]], { ...pc, seg: 24 });
      b.lathe([[0.108, 0.14], [0.1, 0.152], [0.06, 0.165], [0, 0.168]], { ...pc, seg: 24 });
      b.sphere(0.016, { at: [0, 0.178, 0], ...black, seg: 10 });
      b.mirrorX(() => b.torus(0.022, 0.007, { at: [0.104, 0.115, 0], rot: [PI / 2, 0, -PI / 2], arc: PI, ...black,
        seg: 10, tubeSeg: 6 }));
      puff(b, 0.03, 0.215, 0.0, 0.02);
      puff(b, -0.015, 0.255, 0.01, 0.017);
    });
    // a frying pan with two eggs on the front-right burner
    b.group({ at: [0.2, ct + 0.012, 0.1] }, () => {
      b.lathe([[0, 0], [0.075, 0], [0.09, 0.03], [0.084, 0.03], [0.07, 0.008], [0, 0.008]], { color: C.charcoal, kind: "metal", seg: 24 });
      b.rod([0.085, 0.024, 0.01], [0.21, 0.04, 0.05], 0.01, { color: C.charcoal, kind: "metal", seg: 8 });
      for (const [x, z] of [[-0.03, 0.01], [0.03, -0.015]]) {
        b.sphere(0.034, { at: [x, 0.009, z], scale: [1, 0.12, 0.9], color: C.white, seg: 12 });
        b.sphere(0.014, { at: [x + 0.004, 0.012, z], scale: [1, 0.6, 1], color: "#f5b82e", kind: "gloss", seg: 10 });
      }
    });
    // the kettle on the back-right burner
    b.prop("kettle", {}, { at: [0.2, ct + 0.01, -0.13], scale: 0.8 });
  },

  // A round layered cake on a plate; 'sliced' is cut into eight slices with one pulled out.
  cake(b, p) {
    const frost = p.color || C.pink;
    const cream = "#fff6ea", sponge = "#f1cf8a", jam = "#d9475f";
    const R = 0.152, base = 0.008, Ht = 0.19;
    const sliced = p.variant === "sliced";
    // plate
    b.lathe([[0, 0], [0.17, 0], [0.197, 0.01], [0.2, 0.017], [0.192, 0.017], [0.168, base], [0, base]],
      { color: C.white, kind: "gloss", seg: 44 });
    const skin = [[R - 0.004, base], [R, base + 0.004], [R, base + Ht - 0.012], [R - 0.004, base + Ht - 0.003],
      [R - 0.016, base + Ht], [0, base + Ht]];
    const layers = [[0, 0.054, sponge], [0.054, 0.068, jam], [0.068, 0.122, sponge], [0.122, 0.136, cream],
      [0.136, Ht - 0.014, sponge], [Ht - 0.014, Ht, frost]];
    const deco = (a, rr) => {
      const x = Math.sin(a) * rr, z = Math.cos(a) * rr, y = base + Ht;
      b.lathe([[0.021, 0], [0.022, 0.007], [0.016, 0.017], [0.008, 0.026], [0, 0.032]], { at: [x, y - 0.002, z],
        color: cream, seg: 10 });
      b.sphere(0.016, { at: [x, y + 0.042, z], color: C.crimson, kind: "gloss", seg: 12 });
      b.tube([[x, y + 0.055, z], [x + 0.004, y + 0.068, z - 0.003], [x + 0.012, y + 0.076, z - 0.006]], 0.0018,
        { color: "#5d7a32", radial: 4, seg: 6 });
    };
    if (!sliced) {
      b.lathe(skin, { color: frost, seg: 48 });
      b.torus(R + 0.002, 0.009, { at: [0, base + 0.008, 0], rot: [PI / 2, 0, 0], color: cream, seg: 48, tubeSeg: 6 });
      for (let i = 0; i < 8; i++) deco(((i + 0.5) * TAU) / 8, R - 0.034);
      return;
    }
    const N = 8, half = PI / N, pulled = 1;
    for (let i = 0; i < N; i++) {
      const phi = (i + 0.5) * (TAU / N);
      const d = i === pulled ? 0.055 : 0.005;
      const dir = i === pulled ? phi - 0.22 : phi;
      b.group({ at: [Math.sin(dir) * d, 0, Math.cos(dir) * d] }, () => {
        const sector = [[0, 0]];
        for (let k = 0; k <= 6; k++) {
          const a = phi - half + (k / 6) * 2 * half;
          sector.push([Math.sin(a) * (R - 0.002), -Math.cos(a) * (R - 0.002)]);
        }
        for (const [ya, yb, c] of layers) {
          b.extrude(sector, yb - ya, { at: [0, base + (ya + yb) / 2, 0], rot: [-PI / 2, 0, 0], color: c, bevel: 0 });
        }
        latheSector(b, skin, phi - half, 2 * half, { color: frost, seg: 6 });
        b.torus(R + 0.002, 0.009, { at: [0, base + 0.008, 0], rot: [PI / 2, 0, PI / 2 - phi - half + 0.02],
          arc: 2 * half - 0.04, color: cream, seg: 8, tubeSeg: 6 });
        deco(phi, R - 0.034);
      });
    }
  },
};
