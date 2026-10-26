// Egyptian wall finish: the torus roll that binds every external corner and runs under the
// cornice, and the cavetto ("gorge") cornice that crowns walls, pylons, gates and shrines.
// Door frames: projecting jambs and a lintel crowned by its own small cornice.

import { Matrix4 } from 'three';
import { sweep, rod, box, lathe, quad, fromTriangles } from '../../core/geom.js';
import { orientedBox } from '../../core/build.js';

/** Cavetto cornice profile [[u outward, v up]] for height H and projection P. */
export function cavettoProfile(H, P, inset) {
  const pts = [[0, 0], [0, 0.07 * H]];
  const n = 8;
  for (let i = 1; i <= n; i++) {
    const t = (i / n) * Math.PI / 2;
    pts.push([P * (1 - Math.cos(t)), 0.07 * H + 0.73 * H * Math.sin(t)]);
  }
  pts.push([P, H], [-inset, H]);
  return pts;
}

/** Closed counter-clockwise loop (as `sweep` expects for outward u) around a plan rectangle. */
export function rectLoop([x0, z0, x1, z1]) {
  return [[x1, z1], [x0, z1], [x0, z0], [x1, z0]];
}

/**
 * Trim for a block or wall element: el.trim = { torus: r, cornice: H, corners: bool }.
 * Works on the battered top rectangle when the block is battered.
 */
export function trim(el, { bag }) {
  const t = el.trim;
  const mat = el.mat || 'sandstone';
  let rect, y0 = el.y0, y1 = el.y1, bat = el.batter || [0, 0, 0, 0];
  if (el.t === 'wall') {
    const [ax, az] = el.a, [bx, bz] = el.b, h = el.th / 2;
    rect = [Math.min(ax, bx) - (az === bz ? 0 : h), Math.min(az, bz) - (ax === bx ? 0 : h),
      Math.max(ax, bx) + (az === bz ? 0 : h), Math.max(az, bz) + (ax === bx ? 0 : h)];
    if (az === bz) { rect[1] = az - h; rect[3] = az + h; }
    if (ax === bx) { rect[0] = ax - h; rect[2] = ax + h; }
  } else rect = el.rect.slice();
  const top = [rect[0] + bat[0], rect[1] + bat[2], rect[2] - bat[1], rect[3] - bat[3]];
  const r = t.torus ?? 0;
  const H = t.cornice ?? 0;
  if (r > 0) {
    // horizontal roll at the top of the wall face
    const loop = rectLoop(top);
    for (let i = 0; i < 4; i++) {
      const a = loop[i], b = loop[(i + 1) % 4];
      if (t.sides && !t.sides[i]) continue;
      bag.add(mat, rod([a[0], y1 - r * 0.6, a[1]], [b[0], y1 - r * 0.6, b[1]], r, 10));
    }
    // vertical (or leaning) rolls on the corners
    if (t.corners !== false) {
      const base = rectLoop(rect);
      for (let i = 0; i < 4; i++) {
        if (t.cornersMask && !t.cornersMask[i]) continue;
        bag.add(mat, rod([base[i][0], y0, base[i][1]], [loop[i][0], y1 - r * 0.6, loop[i][1]], r, 10));
      }
    }
  }
  if (H > 0) {
    const P = t.projection ?? H * 0.62;
    const inset = Math.min(0.6, (top[2] - top[0]) / 2 - 0.01, (top[3] - top[1]) / 2 - 0.01);
    bag.add(mat, sweep(cavettoProfile(H, P, inset), rectLoop(top), y1, true));
    const cap = [top[0] + inset, top[1] + inset, top[2] - inset, top[3] - inset];
    if (t.cap !== false && cap[2] > cap[0] && cap[3] > cap[1]) bag.add(mat, box(cap[0], y1, cap[1], cap[2], y1 + H, cap[3]));
    if (t.uraei) uraeusFrieze(bag, mat, top, y1 + H, t.uraei);
  }
}

/**
 * Door frame for an opening in an Egyptian wall: jambs projecting from both faces and a lintel
 * with a small cavetto cornice above, as on every temple doorway. o.frame = false to omit.
 */
export function opening(el, o, f, { bag }) {
  if (o.frame === false) return;
  const mat = el.mat || 'sandstone';
  const proj = o.proj ?? 0.12, jw = o.jamb ?? Math.min(0.9, o.w * 0.22);
  const sill = o.y0, top = o.y0 + o.h;
  const lintelH = o.lintel ?? Math.min(1.2, o.w * 0.28);
  const nx = -f.uz, nz = f.ux; // wall normal
  for (const side of [-1, 1]) {
    const off = side * (el.th / 2 + proj / 2);
    const c = (s) => [f.ax + f.ux * s + nx * off, f.az + f.uz * s + nz * off];
    // jambs
    bag.add(mat, orientedBox(c(o.s0 - jw), c(o.s0), proj, sill, top));
    bag.add(mat, orientedBox(c(o.s1), c(o.s1 + jw), proj, sill, top));
    // lintel
    bag.add(mat, orientedBox(c(o.s0 - jw), c(o.s1 + jw), proj, top, top + lintelH));
    // small cornice: a projecting slab with a sloping underside, approximated by two steps
    const off2 = side * (el.th / 2 + proj + 0.12);
    const c2 = (s) => [f.ax + f.ux * s + nx * off2, f.az + f.uz * s + nz * off2];
    if (o.disc !== false && o.w >= 1.4) {
      const g = wingedDisc(o.w + jw * 1.6, lintelH * 0.8, Math.min(0.05, lintelH * 0.04));
      const mid = (o.s0 + o.s1) / 2, offD = side * (el.th / 2 + proj);
      const m = new Matrix4().makeRotationY(Math.atan2(nx * side, nz * side));
      m.setPosition(f.ax + f.ux * mid + nx * offD, top + lintelH / 2, f.az + f.uz * mid + nz * offD);
      bag.add(mat, g.applyMatrix4(m));
    }
    if (top + lintelH + 0.55 <= el.y1 + 1e-3 || o.cornice) {
      bag.add(mat, orientedBox(c2(o.s0 - jw - 0.1), c2(o.s1 + jw + 0.1), 0.24, top + lintelH, top + lintelH + 0.42));
      bag.add(mat, orientedBox(c2(o.s0 - jw - 0.1), c2(o.s1 + jw + 0.1), 0.36, top + lintelH + 0.42, top + lintelH + 0.55));
    }
  }
}

/** Ring moulding helper for objects. */
export function ring(x, y, z, r, h) {
  return lathe([[r, 0], [r, h]], 24, null, x, y, z);
}

/**
 * Winged sun disc (Behdety, the form of Horus of Edfu) carved in low relief over doorways:
 * a disc flanked by two uraei and two long wings in three tiers of feathers.
 * Returns geometry facing +z in local space, centred at the origin, `w` wide and `h` high.
 */
export function wingedDisc(w, h, depth = 0.05) {
  const tris = [];
  const prism = (poly, z0, z1) => {
    // extrude a convex-ish polygon in (x, y) between z0 and z1
    const n = poly.length;
    for (let i = 1; i < n - 1; i++) tris.push(poly[0][0], poly[0][1], z1, poly[i][0], poly[i][1], z1, poly[i + 1][0], poly[i + 1][1], z1);
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n];
      quad(tris, [a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]);
    }
  };
  const r = h * 0.3;
  // disc
  const disc = [];
  for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; disc.push([Math.cos(a) * r, Math.sin(a) * r]); }
  prism(disc, 0, depth * 1.4);
  // uraei: two rearing cobras either side of the disc
  for (const s of [-1, 1]) prism([[s * r * 0.9, -r * 0.9], [s * r * 1.25, -r * 0.9], [s * r * 1.3, r * 0.4], [s * r * 1.1, r * 0.75], [s * r * 0.95, r * 0.4]], 0, depth * 1.2);
  // wings: three tiers of feathers, the lower tiers longer, the tips drooping
  const half = w / 2;
  const tiers = [[r * 0.15, r * 0.65, 0.82], [-r * 0.25, r * 0.15, 0.94], [-r * 0.65, -r * 0.25, 1.0]];
  for (const s of [-1, 1]) {
    tiers.forEach(([y0, y1, len], k) => {
      const x0 = r * 1.25, x1 = half * len;
      const nf = Math.max(3, Math.round((x1 - x0) / (h * 0.16)));
      for (let f = 0; f < nf; f++) {
        const a = x0 + (x1 - x0) * (f / nf), b = x0 + (x1 - x0) * ((f + 0.88) / nf);
        const droop = (t) => -Math.pow(t, 2.2) * r * 0.55;
        const ta = (a - x0) / (half - x0), tb = (b - x0) / (half - x0);
        prism([[s * a, y0 + droop(ta)], [s * b, y0 + droop(tb)], [s * b, y1 + droop(tb)], [s * a, y1 + droop(ta)]].map((p) => (s < 0 ? p : p)).reverse().map((p, i, arr) => (s > 0 ? arr[arr.length - 1 - i] : p)), 0, depth * (1 - k * 0.15));
      }
    });
  }
  return fromTriangles(tris);
}

/**
 * A frieze of rearing cobras (uraei) crowned with sun discs along the top of a wall, as on the
 * screen walls of Ptolemaic pronaoi. spec = { sides: [S, W, N, E] booleans, h, spacing }.
 */
function uraeusFrieze(bag, mat, rect, y, spec) {
  const h = spec.h ?? 0.55, step = spec.spacing ?? h * 0.62, inset = spec.inset ?? 0.18;
  const loop = rectLoop(rect);
  const one = cobra(h);
  for (let i = 0; i < 4; i++) {
    if (!spec.sides?.[i]) continue;
    const a = loop[i], b = loop[(i + 1) % 4];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, ox = uz, oz = -ux;   // outward
    const n = Math.floor((L - 0.2) / step);
    const yaw = Math.atan2(ox, oz);
    for (let k = 0; k < n; k++) {
      const s = (L - (n - 1) * step) / 2 + k * step;
      const g = one.clone();
      g.applyMatrix4(new Matrix4().makeRotationY(yaw).setPosition(a[0] + ux * s - ox * inset, y, a[1] + uz * s - oz * inset));
      bag.add(mat, g);
    }
  }
}

/** One cobra: tail coil as a base, the spread hood seen from the front, a disc on the head; faces +z. */
function cobra(h) {
  const t = [];
  const prism = (poly, z0, z1) => {
    for (let i = 1; i < poly.length - 1; i++) t.push(poly[0][0], poly[0][1], z1, poly[i][0], poly[i][1], z1, poly[i + 1][0], poly[i + 1][1], z1);
    for (let i = 1; i < poly.length - 1; i++) t.push(poly[0][0], poly[0][1], z0, poly[i + 1][0], poly[i + 1][1], z0, poly[i][0], poly[i][1], z0);
    for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; quad(t, [a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]); }
  };
  const w = h * 0.36;
  prism([[-w * 0.55, 0], [w * 0.55, 0], [w * 0.5, h * 0.12], [-w * 0.5, h * 0.12]], -w * 0.6, w * 0.3);                // coil
  prism([[-w * 0.18, h * 0.1], [w * 0.18, h * 0.1], [w * 0.5, h * 0.42], [w * 0.42, h * 0.62], [w * 0.16, h * 0.74], [-w * 0.16, h * 0.74], [-w * 0.42, h * 0.62], [-w * 0.5, h * 0.42]], -w * 0.1, w * 0.12);   // hood
  const disc = [];
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; disc.push([Math.cos(a) * w * 0.32, h * 0.86 + Math.sin(a) * w * 0.32]); }
  prism(disc, -w * 0.05, w * 0.05);
  return fromTriangles(t);
}
