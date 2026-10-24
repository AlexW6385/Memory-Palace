// Props in the "objects" group. Each entry: name: (b, p) => void — see kit.js and docs/props.md.
// b is a Builder (metres, base on y = 0, facing +z); p holds the item's params:
//   { variant, color, color2, text, emoji, pose, hat, hold, seed }
//
// Style: chunky, bevelled toy objects. Precious things (coins, gold, trophies, medals, crowns, keys, the vault
// door) use kind "metal"; lacquered and plastic things use "gloss". Curved slabs (flag cloth, shield, masks)
// are extruded outlines that are subdivided and then bent. The helpers below are shared by this file only.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { C, shade, mix, rng } from "./kit.js";

const PI = Math.PI;
const TAU = 2 * PI;
const DEG = PI / 180;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const INK = "#22252b";
// gold a touch lighter than C.gold: large curved metal surfaces mostly mirror the darker parts of the room
const GOLD = shade(C.gold, 0.05);

// ── small helpers ────────────────────────────────────────────────────────────

/** Random numbers for a prop: from its own seed when it has one, so it looks the same in any scene. */
function randomFor(b, p) {
  return p.seed != null ? rng(p.seed * 31 + 7) : b.rng;
}

/** The prop's text in the builder's language ("" when there is none). */
function textOf(b, p) {
  const t = p.text;
  if (t == null) return "";
  if (typeof t === "string") return t;
  return String(t[b.env?.lang || "en"] ?? t.en ?? t.zh ?? "");
}

/** Euler rotation that turns the +y axis towards dir. */
function aim(dir) {
  const q = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, new THREE.Vector3(...dir).normalize());
  const e = new THREE.Euler().setFromQuaternion(q, "XYZ");
  return [e.x, e.y, e.z];
}

/** True for a light colour (put dark details on it), false for a dark one. */
function isLight(c) {
  const col = new THREE.Color(c);
  return 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b > 0.25;
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ── 2D outlines ──────────────────────────────────────────────────────────────

/** Smooth closed outline through pts (centripetal Catmull-Rom), n samples. */
function smooth2(pts, n = 32) {
  const c = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, "centripetal");
  return c.getSpacedPoints(n).slice(0, n).map((v) => [v.x, v.y]);
}

/** Smooth open curve through pts, n + 1 samples (also used for lathe profiles [[r, y], ...]). */
function smoothOpen(pts, n = 16) {
  const c = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, "centripetal");
  return c.getPoints(n).map((v) => [v.x, v.y]);
}

/** Ellipse outline with semi-axes a, e around (cx, cy). */
function ellipse2(a, e, n = 24, cx = 0, cy = 0, rot = 0) {
  const cr = Math.cos(rot), sr = Math.sin(rot);
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * TAU, x = a * Math.cos(t), y = e * Math.sin(t);
    return [cx + x * cr - y * sr, cy + x * sr + y * cr];
  });
}

/** n + 1 points of an elliptical arc from angle t0 to t1. */
function arc2(a, e, t0, t1, n, cx = 0, cy = 0) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = t0 + ((t1 - t0) * i) / n;
    return [cx + a * Math.cos(t), cy + e * Math.sin(t)];
  });
}

/** Star outline with n points (outer radius R, inner r), first point straight up. */
function star2(R, r, n = 5, cx = 0, cy = 0) {
  return Array.from({ length: n * 2 }, (_, i) => {
    const a = PI / 2 + (i * PI) / n, rr = i % 2 ? r : R;
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  });
}

/** Rounded rectangle outline w × h, corner radius r, centred on (cx, cy). */
function rrect2(w, h, r, cx = 0, cy = 0, n = 4) {
  const out = [];
  const corners = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, PI / 2], [-w / 2 + r, -h / 2 + r, PI],
    [w / 2 - r, -h / 2 + r, 1.5 * PI]];
  for (const [x, y, a0] of corners) {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (PI / 2);
      out.push([cx + x + r * Math.cos(a), cy + y + r * Math.sin(a)]);
    }
  }
  return out;
}

function area2(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

/** Outline moved inwards by d along its corner bisectors (borders and rims of convex shapes). */
function inset2(pts, d) {
  const s = area2(pts) > 0 ? 1 : -1, n = pts.length;
  const unit = ([x, y]) => {
    const l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  };
  return pts.map((P, i) => {
    const A = pts[(i + n - 1) % n], B = pts[(i + 1) % n];
    const e1 = unit([P[0] - A[0], P[1] - A[1]]), e2 = unit([B[0] - P[0], B[1] - P[1]]);
    const n1 = [-e1[1] * s, e1[0] * s], n2 = [-e2[1] * s, e2[0] * s];
    const m = unit([n1[0] + n2[0], n1[1] + n2[1]]);
    const k = d / Math.max(0.35, m[0] * n1[0] + m[1] * n1[1]);
    return [P[0] + m[0] * k, P[1] + m[1] * k];
  });
}

/** Clip an outline to the half-plane a·x + b·y + c ≥ 0 (Sutherland–Hodgman). */
function clip2(pts, a, bb, c) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const P = pts[i], Q = pts[(i + 1) % pts.length];
    const fp = a * P[0] + bb * P[1] + c, fq = a * Q[0] + bb * Q[1] + c;
    if (fp >= 0) out.push(P);
    if ((fp >= 0) !== (fq >= 0)) {
      const t = fp / (fp - fq);
      out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]);
    }
  }
  return out;
}

/** THREE.Shape from an outline [[x, y], ...] with optional holes. */
function shape2(outline, holes = []) {
  const s = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  return s;
}

// ── geometry helpers ─────────────────────────────────────────────────────────

/** Split triangles until no edge is longer than maxLen. Shared edges split at the same midpoint (no cracks). */
function tessellate(geo, maxLen) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  let pos = Array.from(g.attributes.position.array);
  geo.dispose();
  const m2 = maxLen * maxLen;
  const d2 = (p, i, j) => (p[i] - p[j]) ** 2 + (p[i + 1] - p[j + 1]) ** 2 + (p[i + 2] - p[j + 2]) ** 2;
  for (let iter = 0; iter < 16; iter++) {
    const out = [];
    let split = false;
    for (let i = 0; i < pos.length; i += 9) {
      const ab = d2(pos, i, i + 3), bc = d2(pos, i + 3, i + 6), ca = d2(pos, i + 6, i);
      const A = pos.slice(i, i + 3), B = pos.slice(i + 3, i + 6), Cc = pos.slice(i + 6, i + 9);
      const m = Math.max(ab, bc, ca);
      if (m <= m2) {
        out.push(...A, ...B, ...Cc);
        continue;
      }
      split = true;
      const mid = (P, Q) => [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2, (P[2] + Q[2]) / 2];
      if (m === ab) {
        const M = mid(A, B);
        out.push(...A, ...M, ...Cc, ...M, ...B, ...Cc);
      } else if (m === bc) {
        const M = mid(B, Cc);
        out.push(...A, ...B, ...M, ...A, ...M, ...Cc);
      } else {
        const M = mid(Cc, A);
        out.push(...A, ...B, ...M, ...M, ...B, ...Cc);
      }
    }
    pos = out;
    if (!split) break;
  }
  const ng = new THREE.BufferGeometry();
  ng.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return ng;
}

/** Normals averaged over neighbouring faces meeting at less than `angle`: smooth surfaces, crisp creases. */
function creaseNormals(g, angle = 0.7) {
  const pos = g.attributes.position, n = pos.count, cosA = Math.cos(angle);
  const A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3();
  const faces = [], keys = new Array(n), groups = new Map();
  const key = (i) => `${Math.round(pos.getX(i) * 1e5)},${Math.round(pos.getY(i) * 1e5)},${Math.round(pos.getZ(i) * 1e5)}`;
  for (let i = 0; i < n; i += 3) {
    A.fromBufferAttribute(pos, i);
    B.fromBufferAttribute(pos, i + 1);
    Cc.fromBufferAttribute(pos, i + 2);
    const w = new THREE.Vector3().subVectors(Cc, B).cross(new THREE.Vector3().subVectors(A, B));
    faces.push({ w, u: w.clone().normalize() });
    for (let k = 0; k < 3; k++) {
      const kk = key(i + k);
      keys[i + k] = kk;
      let list = groups.get(kk);
      if (!list) groups.set(kk, (list = []));
      list.push(i / 3);
    }
  }
  const out = new Float32Array(n * 3);
  const s = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const f = faces[Math.floor(i / 3)];
    s.set(0, 0, 0);
    for (const j of groups.get(keys[i])) if (faces[j].u.dot(f.u) > cosA) s.add(faces[j].w);
    if (s.lengthSq() < 1e-24) s.copy(f.u);
    s.normalize();
    out[i * 3] = s.x;
    out[i * 3 + 1] = s.y;
    out[i * 3 + 2] = s.z;
  }
  g.setAttribute("normal", new THREE.BufferAttribute(out, 3));
  return g;
}

/** Closed outline resampled so that no edge is longer than maxLen. */
function resample2(pts, maxLen) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const P = pts[i], Q = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.ceil(Math.hypot(Q[0] - P[0], Q[1] - P[1]) / maxLen));
    for (let k = 0; k < n; k++) out.push([P[0] + ((Q[0] - P[0]) * k) / n, P[1] + ((Q[1] - P[1]) * k) / n]);
  }
  return out;
}

/**
 * A slab cut from an outline with holes: flat caps at z = ±depth/2 joined by walls with rounded edges (radius
 * bevel, seg steps), all divided evenly (edges ≤ maxEdge, walls and caps sharing their boundary points) so that
 * it can be bent smoothly without cracks. Returns a non-indexed BufferGeometry.
 */
function slabGeo(outline, holes, depth, bevel, maxEdge, seg = 2) {
  const orient = (pts, ccw) => ((area2(pts) > 0) === ccw ? pts : pts.slice().reverse());
  const outer = orient(resample2(outline, maxEdge * 0.75), true);
  const hs = holes.map((h) => orient(resample2(h, maxEdge * 0.75), false));
  const bev = Math.min(bevel, depth / 2 - 1e-5);
  // a contour moved into the material by d (the outer one inwards, holes outwards)
  const into = (c, hole, d) => (d > 0 ? inset2(c, hole ? -d : d) : c);
  const cap = [];
  const capO = into(outer, false, bev), capH = hs.map((h) => into(h, true, bev));
  const v2 = ([x, y]) => new THREE.Vector2(x, y);
  const faces = THREE.ShapeUtils.triangulateShape(capO.map(v2), capH.map((h) => h.map(v2)));
  const all = [...capO, ...capH.flat()];
  for (const [ia, ib, ic] of faces) {
    const A = all[ia];
    let B = all[ib], Cc = all[ic];
    if ((B[0] - A[0]) * (Cc[1] - A[1]) - (Cc[0] - A[0]) * (B[1] - A[1]) < 0) [B, Cc] = [Cc, B];
    const z = depth / 2;
    cap.push(A[0], A[1], z, B[0], B[1], z, Cc[0], Cc[1], z, A[0], A[1], -z, Cc[0], Cc[1], -z, B[0], B[1], -z);
  }
  const capGeo = new THREE.BufferGeometry();
  capGeo.setAttribute("position", new THREE.Float32BufferAttribute(cap, 3));
  const pos = Array.from(tessellate(capGeo, maxEdge).attributes.position.array);
  // walls: rows round the edge from the front cap to the back cap
  const rows = [];
  if (bev > 0) {
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * (PI / 2);
      rows.push([bev * (1 - Math.sin(a)), depth / 2 - bev + bev * Math.cos(a)]);
    }
    for (let j = 0; j <= seg; j++) {
      const a = PI / 2 + (j / seg) * (PI / 2);
      rows.push([bev * (1 - Math.sin(a)), -depth / 2 + bev + bev * Math.cos(a)]);
    }
  } else rows.push([0, depth / 2], [0, -depth / 2]);
  for (const [c, hole] of [[outer, false], ...hs.map((h) => [h, true])]) {
    const ring = rows.map(([d, z]) => into(c, hole, d).map(([x, y]) => [x, y, z]));
    const n = c.length;
    for (let j = 0; j < ring.length - 1; j++) {
      for (let i = 0; i < n; i++) {
        const a = ring[j][i], b1 = ring[j][(i + 1) % n], c1 = ring[j + 1][i], d1 = ring[j + 1][(i + 1) % n];
        pos.push(...a, ...c1, ...b1, ...b1, ...c1, ...d1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/**
 * A slab (see slabGeo) whose every vertex is moved through warp(x, y, z) → [x, y, z]: waving cloth, curved
 * shields, masks. o: { bevel, bevelSeg, maxEdge, crease } plus the usual primitive options.
 */
function warpSlab(b, outline, holes, depth, warp, o = {}) {
  const { bevel: bv, maxEdge, crease, bevelSeg, ...rest } = o;
  const bevel = bv ?? Math.min(0.006, depth * 0.3);
  const g = slabGeo(outline, holes, depth, bevel, maxEdge ?? 0.02, bevelSeg ?? 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const w = warp(pos.getX(i), pos.getY(i), pos.getZ(i));
    pos.setXYZ(i, w[0], w[1], w[2]);
  }
  creaseNormals(g, crease ?? 0.75);
  return b.geo(g, rest);
}

/** Part of a lathe: profile [[r, y], ...] swept from angle a0 by da (angle 0 = +z, turning towards +x). */
function latheSector(b, points, a0, da, o = {}) {
  const pts = points.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
  return b.geo(new THREE.LatheGeometry(pts, o.seg ?? 4, a0, da), o);
}

/** A ring sector standing on y0: radii r0..r1, angles a0..a1 (0 = +z), height h — merlons, arcs of a wall. */
function ringSector(b, r0, r1, a0, a1, y0, h, o = {}) {
  const n = Math.max(2, Math.ceil(((a1 - a0) / TAU) * 48));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([r1 * Math.sin(a), -r1 * Math.cos(a)]);
  }
  for (let i = n; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([r0 * Math.sin(a), -r0 * Math.cos(a)]);
  }
  return b.extrude(pts, h, { bevel: o.bevel ?? 0.002, ...o, at: [0, y0 + h / 2, 0], rot: [-PI / 2, 0, 0] });
}

/** Smooth grid surface from fn(u, v) → [x, y, z], u, v in [0, 1]; front face along du × dv (flip reverses). */
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

/** A rounded box whose top is narrowed to kx, kz of its bottom (ingots, plinths). */
function taperBox(b, w, h, d, kx, kz, o = {}) {
  const { r, ...rest } = o;
  const g = new RoundedBoxGeometry(w, h, d, 2, r ?? Math.min(w, h, d) * 0.1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) + h / 2) / h;
    pos.setX(i, pos.getX(i) * (1 - (1 - kx) * t));
    pos.setZ(i, pos.getZ(i) * (1 - (1 - kz) * t));
  }
  creaseNormals(g, 0.9);
  return b.geo(g, rest);
}

/** A small four-pointed sparkle (unlit). */
function glint(b, x, y, z, s) {
  b.box(s, s * 0.14, 0.002, { at: [x, y, z], color: "#fffbe8", kind: "glow", light: false, r: 0 });
  b.box(s * 0.14, s, 0.002, { at: [x, y, z], color: "#fffbe8", kind: "glow", light: false, r: 0 });
}

/** A coin lying in the xy plane (faces ±z), centred on the origin: rim and a raised star on both faces. */
function coinBody(b, R, t, col, o = {}) {
  const k = Math.min(0.003, t * 0.25);
  b.lathe([[0, -t / 2], [R - k, -t / 2], [R, -t / 2 + k], [R, t / 2 - k], [R - k, t / 2], [0, t / 2]],
    { rot: [PI / 2, 0, 0], color: col, kind: "metal", seg: o.seg ?? 36 });
  const hi = shade(col, 0.08);
  for (const s of o.oneSide ? [1] : [1, -1]) {
    b.torus(R - 0.0055, Math.min(0.0032, t * 0.22), { at: [0, 0, (s * t) / 2], color: hi, kind: "metal", seg: 36,
      tubeSeg: 5 });
    b.cyl(R - 0.009, R - 0.009, 0.001, { at: [0, 0, s * (t / 2 + 0.0001)], rot: [PI / 2, 0, 0], color: shade(col, -0.06),
      kind: "metal", seg: 32 });
    b.extrude(star2(R * 0.56, R * 0.24), 0.0022, { at: [0, 0, s * (t / 2 + 0.0009)], rot: [0, s > 0 ? 0 : PI, 0],
      color: hi, kind: "metal", bevel: 0.0008 });
  }
}

// ── globe data: simplified coastlines as [longitude, latitude] ──────────────────
const LAND = {
  northAmerica: [[-166, 68.5], [-157, 71.3], [-141, 69.7], [-128, 70], [-115, 68.2], [-100, 67.8], [-90, 68.8],
    [-86, 67], [-91, 64], [-94.5, 59], [-89, 56.5], [-82, 54.5], [-80, 51.5], [-78.8, 55.5], [-77.2, 60],
    [-78, 62.4], [-72, 62], [-69.5, 59], [-64.5, 60.3], [-61, 56], [-56.2, 52], [-60, 50.2], [-66.5, 49.6],
    [-64.4, 48.7], [-61, 45.7], [-65.8, 43.6], [-70.2, 43.5], [-70, 41.7], [-74, 40.5], [-75.8, 37], [-75.5, 35.2],
    [-81, 31.5], [-80.1, 26.5], [-80.6, 25.1], [-82.7, 27.8], [-84, 30], [-89.5, 29.5], [-94, 29.6], [-97.3, 27.5],
    [-97.7, 22.2], [-96, 18.9], [-91.5, 18.5], [-90.4, 21], [-87, 21.5], [-88.2, 16.2], [-83.4, 15.2], [-83.6, 11],
    [-79.5, 9.6], [-77.4, 8.6], [-78.2, 7.4], [-80.2, 7.3], [-85.7, 10], [-87.5, 13], [-91.5, 14], [-96.5, 15.7],
    [-105.5, 20.3], [-106.4, 23.3], [-110.9, 27.9], [-114.7, 31.7], [-112.5, 28.5], [-109.5, 23], [-112, 24.8],
    [-115, 29.8], [-117.2, 32.7], [-120.6, 34.5], [-122.5, 37.8], [-124.2, 40.5], [-124, 46.2], [-124.7, 48.4],
    [-127.5, 51], [-130.5, 54.5], [-135.5, 58.3], [-140.5, 59.8], [-146.5, 60.8], [-151.5, 59.3], [-156.5, 56.8],
    [-163, 54.8], [-157.5, 58.5], [-162, 60], [-165, 62.5], [-161, 64.3], [-166.5, 64.6], [-168, 65.6],
    [-163.6, 67]],
  baffin: [[-64.5, 62.5], [-61.5, 66.5], [-68, 70.3], [-77, 72.6], [-88, 73.5], [-85, 69.8], [-78, 68.5], [-74, 66],
    [-73, 64.3], [-68, 63.5]],
  arcticWest: [[-125, 71.5], [-120, 74.5], [-110, 73.5], [-101, 70.5], [-105, 68.8], [-115, 69.2], [-122, 69.8]],
  arcticEast: [[-95, 76.5], [-80, 76.3], [-75, 79], [-62, 82.4], [-75, 83], [-90, 81.8], [-98, 78.5]],
  greenland: [[-73, 78.2], [-66, 80.5], [-55, 82.2], [-40, 83.5], [-25, 83.2], [-12, 81.6], [-18, 79.5], [-20, 76],
    [-22, 72.5], [-24, 70], [-28, 68.3], [-35, 66], [-40.5, 64.8], [-43, 60], [-46, 60.8], [-50, 62.5],
    [-52.5, 65.5], [-53.5, 68.5], [-55, 70.8], [-58, 75.5], [-66, 76.2]],
  iceland: [[-22, 64], [-24, 65.5], [-22.5, 66.4], [-18, 66.2], [-14.6, 66.3], [-13.6, 65.2], [-14.6, 64.3],
    [-18, 63.4], [-20.5, 63.7]],
  cuba: [[-84.9, 21.9], [-82, 23.1], [-79.5, 22.9], [-77, 21.5], [-74.2, 20.2], [-77.5, 19.9], [-78.5, 21],
    [-81, 21.8]],
  hispaniola: [[-74.5, 18.4], [-72.5, 19.9], [-70, 19.7], [-68.4, 18.6], [-71, 18], [-72.8, 18.1]],
  southAmerica: [[-77.4, 8.6], [-75.5, 10.5], [-71.5, 12.4], [-68, 10.6], [-63, 10.7], [-61, 8.6], [-57.5, 6],
    [-52, 4.8], [-50, 1.8], [-49, -0.5], [-44.5, -2.5], [-40, -2.9], [-35.2, -5.5], [-34.9, -8], [-37, -11],
    [-39, -14.5], [-39.6, -18], [-40.9, -22], [-44, -23.1], [-48.5, -26.5], [-49.8, -29.3], [-52.5, -32.5],
    [-54, -34.8], [-57.5, -38.2], [-62.3, -38.8], [-64.5, -41], [-63.6, -42.6], [-65.3, -44.5], [-67.5, -46.5],
    [-68.4, -50.2], [-68.3, -52.4], [-66.5, -54.8], [-70.5, -55], [-74, -52.5], [-75.5, -48.5], [-74, -45],
    [-73.5, -41], [-73.6, -37], [-71.6, -33], [-71.4, -28], [-70.5, -23], [-70.2, -18.5], [-76.3, -13.8],
    [-78.8, -8.6], [-81.2, -6], [-81.3, -4.3], [-80, -2.5], [-80.8, -1], [-80, 0.8], [-77.6, 4], [-77.4, 7]],
  africa: [[-5.9, 35.8], [-9.8, 31.5], [-14.5, 26.1], [-17.1, 20.8], [-16.2, 18], [-17.5, 14.7], [-15.5, 11.5],
    [-13.2, 8.5], [-10.8, 6.3], [-7.5, 4.4], [-2, 4.7], [3.4, 6.4], [6, 4.3], [9.7, 4], [9.4, 0.4], [8.7, -0.7],
    [11.9, -4.8], [13.2, -8.8], [13.4, -12.6], [12.1, -15.2], [14.5, -22.9], [15.1, -26.6], [18.4, -33.9],
    [20, -34.8], [25.6, -34], [31, -29.9], [32.6, -25.9], [35.4, -23.9], [34.8, -19.8], [40.7, -15], [40.6, -10.5],
    [39.3, -6.8], [40.9, -2.3], [45.3, 2], [48.5, 5.3], [51.3, 11.8], [45, 10.4], [43.1, 11.6], [39.5, 15.6],
    [37.2, 19.6], [35.5, 23.9], [32.5, 29.9], [32.3, 31.3], [29.9, 31.2], [24, 32.1], [20.1, 32.1], [19, 30.3],
    [15.1, 32.4], [11, 33.5], [11, 37.1], [9.9, 37.3], [3, 36.8], [-0.6, 35.7]],
  madagascar: [[49.3, -12], [50.5, -15.5], [48.5, -20.5], [47.2, -24.8], [45.2, -25.6], [43.7, -23.5], [43.3, -21.5],
    [44.4, -19], [44, -16.8], [46.3, -15.7], [47.8, -14.3]],
  eurasia: [[-5.6, 36], [-2.1, 36.7], [0.2, 38.8], [0.9, 41], [3.2, 41.9], [3.1, 43.1], [6.6, 43.1], [8.9, 44.4],
    [10.2, 43.9], [12.6, 41.4], [15.6, 40], [15.7, 38.2], [17.1, 39.4], [18.5, 40.1], [16, 41.4], [13.6, 43.5],
    [12.3, 44.4], [13.7, 45.7], [15.2, 44.2], [18.6, 42.4], [19.4, 40.4], [21.1, 38.3], [21.7, 36.8], [23.2, 36.4],
    [22.9, 39.4], [22.6, 40.5], [24.4, 40.9], [26, 40.8], [26.2, 40], [26.3, 38.3], [28, 36.7], [30.6, 36.8],
    [32.6, 36.1], [34.6, 36.8], [36.1, 36.7], [35.9, 34.5], [34.9, 32.4], [34.3, 31.4], [33, 31.1], [32.6, 30],
    [33.6, 28.3], [34.2, 27.8], [35, 29.5], [36.5, 26], [37.5, 24.2], [39.1, 21.5], [40.8, 19], [42.6, 16.4],
    [43.4, 12.7], [45, 12.8], [48.7, 14], [52.2, 15.6], [55, 17], [57, 18.8], [59.8, 22.5], [58.6, 23.6],
    [56.4, 26.4], [56, 24.9], [54.6, 24.3], [51.6, 24.2], [50.5, 26.2], [48.8, 28], [48, 29.9], [50.2, 29.9],
    [51.5, 27.9], [54.8, 26.5], [56.3, 27.2], [57.3, 25.8], [61.6, 25.2], [66.6, 25.4], [67.4, 23.9], [69, 22.3],
    [72.6, 21.3], [72.8, 19], [74.6, 13], [76.5, 8.8], [77.5, 8.1], [79.3, 10.3], [80.3, 15.5], [82.3, 16.6],
    [85.8, 19.8], [87, 21.5], [89.5, 21.9], [91.8, 22.3], [92.9, 19.8], [94.2, 16], [97.6, 16.5], [98.6, 12],
    [98.3, 7.9], [100.3, 6], [101.3, 2.8], [103.4, 1.3], [104.3, 1.4], [103.4, 4], [102.1, 6.2], [100.4, 7.8],
    [99.9, 9.3], [100.1, 12.7], [100.9, 13.4], [102.9, 11.6], [104.8, 8.6], [106.6, 9.6], [109, 11.4], [108.8, 15.4],
    [105.7, 19], [106.6, 20.5], [107.9, 21.5], [110.2, 20.3], [112, 21.7], [114.3, 22.4], [116.5, 23],
    [119.4, 25.4], [121.9, 29.9], [121, 32.4], [120.3, 34.3], [122.6, 37.4], [119.2, 37.2], [117.7, 39],
    [121, 40.8], [121.6, 38.8], [124.3, 39.9], [126, 37.6], [126.5, 34.4], [129.1, 35.1], [128.6, 38.3],
    [127.6, 39.7], [129.7, 41], [130.7, 42.3], [132, 43.2], [135.5, 43.9], [138.5, 47.2], [140.4, 48.8],
    [141.4, 52.5], [139.3, 54.2], [135.2, 54.7], [140.6, 58.4], [145.4, 59.4], [151.4, 58.9], [156, 61.5],
    [160, 61.8], [157.5, 58], [156.5, 55], [156.7, 51], [158.5, 52.9], [162, 56], [163.2, 57.8], [167, 60.3],
    [173.2, 61.5], [179, 62.3], [183, 64.4], [187, 64.3], [190.3, 66.1], [185, 67], [178, 69.5], [171, 70],
    [160, 70.8], [152, 70.9], [145, 72.2], [139, 72.4], [128.5, 73], [113, 73.6], [104.3, 77.7], [97, 76.2],
    [88, 75.3], [80.6, 72], [75, 72.8], [69, 73], [66.5, 70.5], [61, 69.5], [54.5, 68.5], [48, 67.6], [43.5, 68.5],
    [41, 66.3], [39.8, 64.6], [35.5, 64.4], [34.6, 66.3], [41, 67.2], [33, 69.4], [25.8, 71.1], [21, 70.2],
    [16, 68.9], [12.3, 65.7], [8, 63], [5.2, 62], [5.5, 59], [7, 58], [10.6, 59], [11.8, 57.7], [12.9, 55.4],
    [16, 56.2], [18.8, 59.9], [17.4, 60.6], [19, 63.5], [22.2, 65.6], [24.1, 65.8], [25.4, 65], [21.4, 62.3],
    [22.4, 60.2], [30.2, 59.9], [24.7, 59.4], [23.5, 58.5], [24.3, 57.2], [21.6, 57.5], [21.1, 55.7], [18.6, 54.4],
    [14.5, 53.9], [11, 54], [10.6, 55.5], [10.6, 57.7], [8.6, 57.1], [8.1, 55.5], [8.6, 53.9], [5, 53.4],
    [3.6, 51.4], [1.6, 50.9], [0.2, 49.6], [-1.6, 49.7], [-1.9, 48.7], [-4.7, 48.4], [-2.3, 47.2], [-1.2, 44.6],
    [-1.6, 43.4], [-7.7, 43.8], [-9.3, 43], [-8.9, 41.5], [-9.5, 38.8], [-8.9, 37], [-6.4, 36.8]],
  britain: [[-5.7, 50.1], [-3, 50.6], [1.4, 51.2], [1.7, 52.7], [0.2, 53.5], [-1.6, 55.6], [-1.8, 57.5], [-3, 58.6],
    [-5, 58.6], [-5.7, 56.8], [-5, 55], [-3.2, 54.6], [-3, 53.4], [-4.6, 53.2], [-4.2, 52.2], [-5.2, 51.8],
    [-3.2, 51.4], [-4.5, 51]],
  ireland: [[-6, 52.2], [-6.2, 53.5], [-5.9, 54.6], [-7.3, 55.3], [-8.5, 54.8], [-10.1, 54.2], [-9.8, 53.3],
    [-10.4, 52.1], [-9.5, 51.6], [-8.2, 51.8]],
  svalbard: [[11, 78.5], [17, 80.5], [27, 80.2], [22, 77.4], [16, 76.6]],
  novayaZemlya: [[52, 71], [55, 73.5], [60, 76.5], [68.5, 77], [61, 75.5], [57, 72], [55, 70.6]],
  japan: [[130.2, 31.2], [132, 33], [135, 33.7], [136.8, 34.3], [138.8, 34.6], [140, 35], [140.9, 36.9], [141, 38.3],
    [141.9, 39.6], [141.5, 41.4], [140, 40.8], [139.8, 39.3], [139.2, 38], [137.3, 37.5], [136, 35.8], [133, 35.6],
    [131, 34.4], [129.8, 33.4]],
  hokkaido: [[140, 41.5], [143.3, 42], [145.6, 43.3], [141.9, 45.5], [141.4, 43.6], [139.8, 42.4]],
  sakhalin: [[142, 46], [143.5, 46.5], [143.2, 49.3], [143, 51.5], [142.8, 54.3], [142.2, 53.5], [141.7, 51.5],
    [142.1, 49]],
  taiwan: [[120.1, 23], [121, 25.2], [122, 25], [120.8, 21.9]],
  hainan: [[108.6, 19.2], [110, 20.1], [111, 19.6], [110, 18.2]],
  sriLanka: [[80.1, 9.8], [81.9, 7.2], [80.6, 5.9], [79.8, 7]],
  luzon: [[120, 16], [120.6, 18.5], [122.2, 18.5], [122, 16.5], [124, 13.8], [121, 13.8]],
  mindanao: [[122, 7], [125.5, 9.8], [126.6, 7.3], [125.5, 5.8], [124, 6.5]],
  borneo: [[109.6, 1.9], [113, 3.2], [116, 6], [117, 7], [119.2, 5.2], [117.9, 4.2], [118, 0.8], [116.5, -2.5],
    [116, -3.7], [114.5, -3.5], [111.5, -3], [110.2, -2.8], [109.6, -1], [109, 0.5]],
  sumatra: [[95.2, 5.6], [97.5, 5.2], [100.4, 2.2], [103.7, -1], [106, -3.2], [105.8, -5.8], [104.5, -5.9],
    [102.3, -4], [100.4, -1], [98.6, 1.7], [96, 3.8]],
  java: [[105.2, -6.8], [108.3, -6.3], [110.4, -6.9], [112.6, -6.9], [114.4, -7.7], [114.6, -8.7], [111, -8.3],
    [108, -7.8], [106.4, -7.4]],
  newGuinea: [[131, -1.3], [134, -0.9], [135, -3.3], [138, -1.7], [141, -2.6], [144.6, -3.8], [146, -5.3],
    [147.5, -6.1], [148, -8], [150.5, -10.3], [147, -10], [145.6, -7.9], [143.5, -8.6], [141, -9.1], [138.5, -8.3],
    [137.6, -5], [134.5, -4], [132, -2.9]],
  australia: [[113.5, -22], [113.9, -26.5], [115, -29.5], [115, -33.6], [118, -35], [123.6, -33.9], [126, -32.3],
    [131.2, -31.5], [135.6, -34.9], [137.8, -33.1], [138, -35.3], [140.9, -38], [143.5, -38.8], [146.3, -39.1],
    [150, -37.4], [151.3, -33.8], [153.6, -28.2], [153.1, -25], [150.8, -22.6], [146.3, -19], [145.4, -15.5],
    [142.5, -10.7], [141.6, -12.6], [141.6, -16], [140.8, -17.5], [139.3, -17.3], [136.8, -15.9], [136.9, -12.3],
    [132.6, -11.5], [130.1, -13.2], [129.4, -14.9], [125.8, -14.4], [124.4, -16.3], [122.2, -17.3], [121.5, -19],
    [116.8, -20.6]],
  tasmania: [[144.7, -40.7], [148.3, -40.9], [148, -43.2], [146.9, -43.6], [145.3, -42.2]],
  newZealandN: [[172.7, -34.4], [174.5, -36], [175.9, -37.5], [178.5, -37.7], [177.9, -39.2], [175.3, -41.6],
    [174.8, -39.9], [173.8, -39.2], [174.6, -37]],
  newZealandS: [[172.6, -40.5], [174.3, -41.7], [173, -43.8], [171.3, -44.3], [169, -46.6], [166.5, -46],
    [168.3, -44], [170.6, -42.8]],
  antarcticPeninsula: [[-75, -66], [-67, -66], [-62, -64.2], [-56.5, -63.2], [-58, -64.8], [-61, -67], [-62, -69]],
};
const LAND_HOLES = {
  eurasia: [
    [[28, 41.6], [27.6, 42.5], [28.6, 44.2], [29.7, 45.3], [30.8, 46.5], [32.6, 46.1], [33.6, 44.5], [35.3, 45],
      [36.6, 45.4], [37.5, 44.7], [39.7, 43.5], [41.6, 41.6], [39.7, 41], [36, 41.7], [34, 42], [31.5, 41.2],
      [29.1, 41.2]],
    [[46.7, 44.3], [47.5, 42.9], [49.3, 40.6], [48.9, 38.4], [49.9, 37.5], [52, 36.8], [54, 37.4], [53.9, 39.5],
      [52.8, 41], [52.8, 42.5], [51.3, 44.5], [53, 45.3], [53, 46.8], [51, 47], [49, 46.5], [47.5, 45.6]],
  ],
};
const LAND_TONE = { africa: "#b8b45c", australia: "#c2ad5e", madagascar: "#a8b45a", greenland: "#eef2f4",
  antarcticPeninsula: "#eef2f4" };

/** Land polygon (lon/lat degrees) triangulated, subdivided and wrapped onto a sphere of radius R. */
function landGeo(poly, holes, R, lon0) {
  const contour = poly.map(([x, y]) => new THREE.Vector2(x, y));
  const hs = holes.map((h) => h.map(([x, y]) => new THREE.Vector2(x, y)));
  const tris = THREE.ShapeUtils.triangulateShape(contour, hs);
  const all = [...contour, ...hs.flat()];
  const pos = [];
  for (const [ia, ib, ic] of tris) {
    let A = all[ia], B = all[ib], Cc = all[ic];
    if ((B.x - A.x) * (Cc.y - A.y) - (Cc.x - A.x) * (B.y - A.y) < 0) [B, Cc] = [Cc, B];
    pos.push(A.x, A.y, 0, B.x, B.y, 0, Cc.x, Cc.y, 0);
  }
  const g0 = new THREE.BufferGeometry();
  g0.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const g = tessellate(g0, 6.5);
  const P = g.attributes.position;
  const nrm = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) {
    const lon = (P.getX(i) - lon0) * DEG, lat = P.getY(i) * DEG;
    const x = Math.cos(lat) * Math.sin(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.cos(lon);
    P.setXYZ(i, x * R, y * R, z * R);
    nrm[i * 3] = x;
    nrm[i * 3 + 1] = y;
    nrm[i * 3 + 2] = z;
  }
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  return g;
}

// ── shared parts ─────────────────────────────────────────────────────────────

/** Heater-shield outline: point at (0, 0), straight sides from √3·w up to height H, half-width w. */
function heater2(w, H, n = 14) {
  const H1 = Math.sqrt(3) * w;
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = -PI / 3 + (i / n) * (PI / 3);
    out.push([-w + 2 * w * Math.cos(a), H1 + 2 * w * Math.sin(a)]);
  }
  for (let i = 1; i <= 6; i++) out.push([w, H1 + ((H - H1) * i) / 6]);
  for (let i = 1; i < 10; i++) {
    const t = i / 10;
    out.push([w - 2 * w * t, H + 0.012 * Math.sin(t * PI)]);
  }
  for (let i = 0; i < 6; i++) {
    const t = i / 6;
    out.push([-w, H - (H - H1) * t]);
  }
  for (let i = 0; i < n; i++) {
    const a = PI + (i / n) * (PI / 3);
    out.push([w + 2 * w * Math.cos(a), H1 + 2 * w * Math.sin(a)]);
  }
  return out;
}

/** Jigsaw outline on an S × S square: sides [bottom, right, top, left] = 1 tab, -1 blank, 0 flat. */
function puzzle2(S, sides) {
  const knob = [[0.36, 0], [0.42, 0.045], [0.375, 0.13], [0.41, 0.215], [0.5, 0.245], [0.59, 0.215], [0.625, 0.13],
    [0.58, 0.045], [0.64, 0]];
  const curve = smoothOpen(knob, 26);
  const corners = [[0, 0], [S, 0], [S, S], [0, S]];
  const out = [];
  for (let e = 0; e < 4; e++) {
    const A = corners[e], B = corners[(e + 1) % 4];
    const ux = (B[0] - A[0]) / S, uy = (B[1] - A[1]) / S;
    const nx = uy, ny = -ux;
    out.push(A);
    if (sides[e]) {
      for (const [t, n] of curve) {
        out.push([A[0] + ux * t * S + nx * n * S * sides[e], A[1] + uy * t * S + ny * n * S * sides[e]]);
      }
    }
  }
  return out;
}

/** Combination dial facing +z at the origin: chrome bezel, numbered ticks, knob and an index mark. */
function dial(b, R, o = {}) {
  const chrome = { color: o.chrome || C.silver, kind: "metal" };
  b.cyl(R, R * 1.04, 0.012, { at: [0, 0, 0.006], rot: [PI / 2, 0, 0], ...chrome, seg: 32 });
  b.cyl(R * 0.84, R * 0.84, 0.004, { at: [0, 0, 0.013], rot: [PI / 2, 0, 0], color: o.face || "#2d3138", kind: "gloss",
    seg: 32 });
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU, rr = R * 0.7, long = i % 5 === 0;
    b.box(R * 0.05, R * (long ? 0.22 : 0.12), 0.002, { at: [Math.sin(a) * rr, Math.cos(a) * rr, 0.0155],
      rot: [0, 0, -a], color: "#e9ecef", r: 0 });
  }
  b.cyl(R * 0.36, R * 0.42, 0.03, { at: [0, 0, 0.028], rot: [PI / 2, 0, 0], ...chrome, seg: 20 });
  b.cyl(R * 0.3, R * 0.3, 0.004, { at: [0, 0, 0.044], rot: [PI / 2, 0, 0], color: shade(chrome.color, 0.08),
    kind: "metal", seg: 18 });
  b.extrude([[-R * 0.08, 0], [R * 0.08, 0], [0, -R * 0.14]], 0.003, { at: [0, R * 1.06 + 0.012, 0.006],
    color: o.mark || C.red, bevel: 0.0008 });
}

// ── builders ─────────────────────────────────────────────────────────────────
export default {
  // A sealed envelope standing upright: the closed flap with its creases, a red wax seal and the address
  // written below (text = address; without text, three pencil lines).
  envelope(b, p) {
    const paper = p.color || "#f3e7cc";
    const W = 0.272, H = 0.184, T = 0.017, fz = T / 2;
    b.box(W, H, T, { at: [0, H / 2, 0], color: paper, r: 0.006 });
    // the closed flap: a triangle from the top corners to a rounded tip, its edges outlined by a shadow line
    const tip = 0.1, hw = W / 2 - 0.005, top = H - 0.004;
    const flap = [[hw, top], [-hw, top], [-0.016, tip + 0.009], [0, tip], [0.016, tip + 0.009]];
    b.extrude(inset2(flap, -0.0022), 0.0012, { at: [0, 0, fz + 0.0006], color: shade(paper, -0.22), bevel: 0 });
    b.extrude(flap, 0.002, { at: [0, 0, fz + 0.0016], color: shade(paper, -0.05), bevel: 0.0007 });
    // wax seal with a dribbled rim and a stamped star
    const wax = C.crimson;
    b.group({ at: [0, tip + 0.003, fz + 0.0035] }, () => {
      b.cyl(0.018, 0.019, 0.005, { rot: [PI / 2, 0, 0], at: [0, 0, 0.0025], color: wax, kind: "gloss", seg: 20 });
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + 0.3;
        b.sphere(0.0058, { at: [Math.cos(a) * 0.0176, Math.sin(a) * 0.0176, 0.002], scale: [1, 1, 0.55], color: wax,
          kind: "gloss", seg: 8 });
      }
      b.torus(0.0112, 0.0016, { at: [0, 0, 0.0052], color: shade(wax, -0.08), kind: "gloss", seg: 20, tubeSeg: 5 });
      b.extrude(star2(0.0068, 0.0029), 0.0015, { at: [0, 0, 0.0055], color: shade(wax, -0.08), kind: "gloss",
        bevel: 0.0005 });
    });
    const str = textOf(b, p);
    if (str) {
      b.text(str, { at: [0, 0.046, fz + 0.003], w: 0.236, h: 0.068, fg: "#24366b", font: "chalk" });
    } else {
      for (const [w, y] of [[0.13, 0.062], [0.11, 0.045], [0.085, 0.028]]) {
        b.box(w, 0.0048, 0.0012, { at: [-0.065 + w / 2, y, fz + 0.0006], color: "#8d8a84", r: 0 });
      }
    }
  },

  // A kraft-paper parcel tied with twine and a bow; text goes on the white shipping label.
  package(b, p) {
    const kraft = p.color || "#c99b64";
    const W = 0.3, H = 0.21, D = 0.256, r = 0.009, lift = 0.004;
    const yc = lift + H / 2;
    b.box(W, H, D, { at: [0, yc, 0], color: kraft, r });
    // paper seam along the top
    b.box(W - 0.02, 0.002, 0.05, { at: [0, lift + H + 0.0005, 0], color: shade(kraft, -0.04), r: 0 });
    const twine = "#ead7ab", tr = 0.0044, xs = -0.088;
    const loopYZ = rrect2(D + tr, H + tr, r + tr, 0, 0, 3).map(([z, y]) => [xs, yc + y, z]);
    b.tube(loopYZ, tr, { closed: true, color: twine, radial: 6, seg: 80 });
    const loopXY = rrect2(W + tr, H + tr, r + tr, 0, 0, 3).map(([x, y]) => [x, yc + y, 0]);
    b.tube(loopXY, tr, { closed: true, color: twine, radial: 6, seg: 80 });
    // bow on top where the strings cross: two loops, two tails and a knot
    b.group({ at: [xs, lift + H + tr, 0] }, () => {
      for (const s of [-1, 1]) {
        b.torus(0.03, 0.0068, { at: [s * 0.031, 0.016, 0], rot: [0, s * 0.3, s * 0.3], scale: [1, 0.66, 1],
          color: twine, seg: 22, tubeSeg: 7 });
        b.tube([[0, 0.004, 0], [s * 0.018, 0.003, 0.028], [s * 0.03, 0.001, 0.056]], 0.0052, { color: twine, radial: 6,
          seg: 12 });
      }
      b.sphere(0.0125, { at: [0, 0.01, 0], scale: [1, 0.85, 0.9], color: shade(twine, -0.05), seg: 12 });
    });
    // shipping label with a red header band
    const str = textOf(b, p);
    const lw = 0.168, lh = 0.112;
    b.group({ at: [0.046, yc - 0.005, D / 2 + 0.001], rot: [0, 0, -0.035] }, () => {
      b.box(lw, lh, 0.002, { color: "#fbf8f1", r: 0.0008 });
      b.box(lw, 0.017, 0.0024, { at: [0, lh / 2 - 0.0085, 0.0003], color: C.red, r: 0 });
      if (str) {
        b.text(str, { at: [0, -0.009, 0.0035], w: lw - 0.012, h: lh - 0.03, fg: INK, font: "body" });
      } else {
        for (const [w, y] of [[0.12, 0.01], [0.1, -0.008], [0.075, -0.026]]) {
          b.box(w, 0.006, 0.001, { at: [-0.064 + w / 2, y, 0.0014], color: "#9a9ca3", r: 0 });
        }
      }
    });
  },

  // A desk globe: blue lacquered sphere with the continents, tilted on a brass half-meridian over a turned stand.
  globe(b) {
    const R = 0.134, yc = 0.33, tilt = 23.4 * DEG, lon0 = -18;
    const Rm = R + 0.013, tube = 0.0065;
    const wood = { color: C.darkWood, kind: "gloss" };
    const brass = { color: C.brass, kind: "metal" };
    b.lathe(smoothOpen([[0, 0], [0.11, 0], [0.113, 0.008], [0.106, 0.019], [0.08, 0.028], [0.05, 0.034], [0.03, 0.04],
      [0, 0.041]], 18), { ...wood, seg: 36 });
    const yb = yc - Rm - tube * 0.5;
    b.lathe(smoothOpen([[0.026, 0.038], [0.018, 0.06], [0.024, 0.088], [0.014, 0.115], [0.012, yb - 0.03],
      [0.016, yb - 0.008], [0.0, yb + 0.002]], 18), { ...brass, seg: 20 });
    // meridian from the south pole, under the globe and up the side to the north pole
    b.torus(Rm, tube, { at: [0, yc, 0], arc: PI, rot: [0, 0, 1.5 * PI - tilt], ...brass, seg: 40, tubeSeg: 8 });
    const ax = [Math.sin(tilt), Math.cos(tilt)];
    for (const s of [-1, 1]) {
      b.sphere(0.011, { at: [s * ax[0] * Rm, yc + s * ax[1] * Rm, 0], ...brass, seg: 10 });
      b.rod([s * ax[0] * R * 0.98, yc + s * ax[1] * R * 0.98, 0], [s * ax[0] * Rm, yc + s * ax[1] * Rm, 0], 0.004,
        { ...brass, seg: 6 });
    }
    b.group({ at: [0, yc, 0], rot: [0, 0, -tilt] }, () => {
      b.geo(new THREE.SphereGeometry(R, 36, 24), { color: "#3f8fd2", kind: "gloss" });
      for (const [name, poly] of Object.entries(LAND)) {
        b.geo(landGeo(poly, LAND_HOLES[name] || [], R * 1.003, lon0), { color: LAND_TONE[name] || "#73b35a",
          kind: "gloss" });
      }
      b.geo(new THREE.SphereGeometry(R * 1.002, 32, 4, 0, TAU, 0, 23 * DEG), { rot: [PI, 0, 0], color: "#eef2f4",
        kind: "gloss" });
    });
  },

  // A treasure map on a slanted wooden stand: parchment with rolled edges, an island with mountains and trees,
  // a dashed route to a red X and a compass rose.
  map(b) {
    const wood = C.wood;
    const slope = 32 * DEG, L = 0.38, Wb = 0.5, th = 0.022;
    const yc = 0.225;
    const tanS = Math.tan(slope);
    // side frames under the board
    for (const s of [-1, 1]) {
      const zf = 0.15, zb = -0.15;
      const under = (z) => yc - z * tanS - th / Math.cos(slope);
      // outline in (x, y) with x = -z (the extrusion is turned to run along world x)
      const outline = [[-zb, 0], [-zb, under(zb)], [-zf, under(zf)], [-zf, 0],
        ...arc2(0.1, 0.05, 0, PI, 10).map(([x, y]) => [-x, y])];
      b.extrude(outline, 0.022, { at: [s * (Wb / 2 - 0.035), 0, 0], rot: [0, PI / 2, 0],
        color: shade(wood, -0.08), bevel: 0.004 });
    }
    b.rod([-Wb / 2 + 0.035, 0.05, 0.1], [Wb / 2 - 0.035, 0.05, 0.1], 0.011, { color: shade(wood, -0.12), seg: 10 });
    b.rod([-Wb / 2 + 0.035, 0.05, -0.1], [Wb / 2 - 0.035, 0.05, -0.1], 0.011, { color: shade(wood, -0.12), seg: 10 });
    b.group({ at: [0, yc, 0], rot: [-(PI / 2 - slope), 0, 0] }, () => {
      b.box(Wb, L, th, { at: [0, 0, -th / 2], color: wood, r: 0.006 });
      b.box(Wb, 0.018, 0.016, { at: [0, -L / 2 + 0.009, 0.008], color: shade(wood, -0.06), r: 0.005 });
      // parchment and its rolled ends
      const parch = "#ecd9a8", PW = 0.42, PH = 0.33;
      b.box(PW, PH, 0.003, { at: [0, 0.012, 0.0015], color: parch, r: 0.001 });
      for (const s of [-1, 1]) {
        b.cyl(0.017, 0.017, PH + 0.004, { at: [s * (PW / 2 + 0.01), 0.012, 0.016], color: shade(parch, -0.06), seg: 14 });
        b.cyl(0.006, 0.006, PH + 0.006, { at: [s * (PW / 2 + 0.01), 0.012, 0.016], color: shade(parch, -0.2), seg: 8 });
      }
      const z0 = 0.0032;
      // sea
      b.extrude(rrect2(0.36, 0.27, 0.025, 0, 0.012), 0.0006, { at: [0, 0, z0 + 0.0003], color: "#a8d3df", bevel: 0 });
      // island: beach ring, land, mountains and trees
      const isle = smooth2([[-0.12, -0.05], [-0.06, -0.085], [0.02, -0.07], [0.09, -0.095], [0.14, -0.04], [0.12, 0.03],
        [0.14, 0.08], [0.07, 0.1], [0.0, 0.065], [-0.07, 0.09], [-0.13, 0.05], [-0.15, -0.005]], 48);
      b.extrude(inset2(isle, -0.006), 0.0008, { at: [0, 0.012, z0 + 0.0012], color: "#ead39a", bevel: 0 });
      b.extrude(isle, 0.0008, { at: [0, 0.012, z0 + 0.002], color: "#9fbf6e", bevel: 0 });
      for (const [x, y, s] of [[-0.06, 0.04, 1], [-0.02, 0.05, 0.8], [-0.095, 0.02, 0.75]]) {
        b.extrude([[-0.022 * s, 0], [0.022 * s, 0], [0, 0.034 * s]], 0.0012, { at: [x, y + 0.012, z0 + 0.0035],
          color: "#8c6a46", bevel: 0 });
        b.extrude([[-0.0085 * s, 0.021 * s], [0.0085 * s, 0.021 * s], [0, 0.034 * s]], 0.0012,
          { at: [x, y + 0.012, z0 + 0.0045], color: "#f6f2ea", bevel: 0 });
      }
      for (const [x, y] of [[0.04, 0.0], [0.065, 0.025], [0.02, -0.03], [0.09, -0.045]]) {
        b.cyl(0.0095, 0.0095, 0.002, { at: [x, y + 0.012, z0 + 0.0035], rot: [PI / 2, 0, 0], color: "#4c8a3f", seg: 10 });
      }
      // dashed route from the west sea to the X
      const route = smoothOpen([[-0.17, -0.1], [-0.11, -0.115], [-0.04, -0.04], [0.03, -0.055], [0.095, 0.035]], 40);
      for (let i = 0; i < route.length - 1; i += 3) {
        const [x1, y1] = route[i], [x2, y2] = route[Math.min(route.length - 1, i + 1)];
        b.box(0.011, 0.0042, 0.001, { at: [(x1 + x2) / 2, (y1 + y2) / 2 + 0.012, z0 + 0.0042],
          rot: [0, 0, Math.atan2(y2 - y1, x2 - x1)], color: C.red, r: 0 });
      }
      for (const a of [PI / 4, -PI / 4]) {
        b.box(0.04, 0.0085, 0.0016, { at: [0.105, 0.05, z0 + 0.0048], rot: [0, 0, a], color: "#c0322a", r: 0 });
      }
      // compass rose
      b.group({ at: [0.125, 0.105, z0 + 0.002] }, () => {
        b.torus(0.024, 0.0014, { color: "#5b4632", seg: 24, tubeSeg: 4 });
        b.extrude(star2(0.034, 0.008, 4), 0.0012, { at: [0, 0, 0.0012], color: "#5b4632", bevel: 0 });
        b.extrude(star2(0.02, 0.006, 4).map(([x, y]) => [x * 0.7 - y * 0.7, x * 0.7 + y * 0.7]), 0.0012,
          { at: [0, 0, 0.0008], color: "#c9a464", bevel: 0 });
        b.extrude([[-0.006, 0.0], [0.006, 0.0], [0, 0.034]], 0.0014, { at: [0, 0, 0.0026], color: C.red, bevel: 0 });
      });
    });
  },

  // A flag on a pole: cloth waving towards its free end, sewn round the pole; text is an emblem on the cloth
  // in color2 (a star without text). color = cloth. p.held drops the little foot.
  flag(b, p) {
    const cloth = p.color || C.red, emblem = p.color2 || C.white;
    const xp = -0.155, poleR = 0.011, top = 1.14;
    if (!p.held) {
      b.lathe(smoothOpen([[0, 0], [0.032, 0], [0.033, 0.008], [0.026, 0.02], [0.016, 0.03], [0, 0.031]], 10),
        { at: [xp, 0, 0], color: C.charcoal, kind: "gloss", seg: 20 });
    }
    b.cyl(poleR, poleR * 1.08, top, { at: [xp, top / 2, 0], color: "#e8e2d6", kind: "gloss", seg: 12 });
    b.sphere(0.022, { at: [xp, top + 0.016, 0], color: GOLD, kind: "metal", seg: 14 });
    b.cyl(0.012, 0.016, 0.012, { at: [xp, top - 0.002, 0], color: GOLD, kind: "metal", seg: 12 });
    // cloth
    const L = 0.33, Hc = 0.22, x0 = xp + poleR * 0.5, yTop = top - 0.035;
    const wave = (u) => 0.03 * u * u * Math.sin(2.4 * PI * u);
    const sag = (u) => -0.014 * u * u;
    warpSlab(b, rrect2(L, Hc, 0.006, L / 2, -Hc / 2), [], 0.005, (x, y, z) => {
      const u = Math.max(0, x / L);
      return [x0 + x, yTop + y + sag(u), z + wave(u)];
    }, { color: cloth, bevel: 0.0015, maxEdge: 0.024 });
    b.cyl(poleR + 0.0045, poleR + 0.0045, Hc + 0.004, { at: [xp, yTop - Hc / 2, 0], color: shade(cloth, -0.06), seg: 12 });
    // emblem on the best-fitting plane over the middle of the cloth
    const uc = 0.47, half = 0.2;
    let sx = 0, sz = 0, sxx = 0, sxz = 0, k = 0;
    for (let i = 0; i <= 8; i++) {
      const u = uc - half + (2 * half * i) / 8, x = (u - uc) * L, z = wave(u);
      sx += x; sz += z; sxx += x * x; sxz += x * z; k++;
    }
    const slope = (k * sxz - sx * sz) / (k * sxx - sx * sx), icpt = (sz - slope * sx) / k;
    let lift = 0;
    for (let i = 0; i <= 16; i++) {
      const u = uc - half + (2 * half * i) / 16;
      lift = Math.max(lift, wave(u) - (icpt + slope * (u - uc) * L));
    }
    const at = [x0 + uc * L, yTop - Hc / 2 + sag(uc), icpt + lift + 0.0025 + 0.004];
    const rot = [0, -Math.atan(slope), 0];
    const str = textOf(b, p);
    if (str) {
      b.text(str, { at, rot, w: L * 0.62, h: Hc * 0.62, fg: emblem, font: "display", weight: "700" });
    } else {
      b.group({ at: [at[0], at[1], at[2] - 0.002], rot }, () => {
        b.extrude(star2(0.058, 0.024), 0.002, { color: emblem, bevel: 0.0008 });
      });
    }
  },

  // A two-handled trophy cup on a wooden plinth with a plaque.
  trophy(b, p) {
    const gold = p.color || GOLD;
    const metal = { color: gold, kind: "metal" };
    b.box(0.17, 0.062, 0.15, { at: [0, 0.031, 0], color: "#4a3326", kind: "gloss", r: 0.008 });
    b.box(0.19, 0.012, 0.17, { at: [0, 0.006, 0], color: "#3c2a20", kind: "gloss", r: 0.004 });
    b.box(0.1, 0.028, 0.004, { at: [0, 0.033, 0.076], ...metal, r: 0.002 });
    const y0 = 0.062;
    const prof = smoothOpen([[0.062, y0], [0.06, y0 + 0.012], [0.045, y0 + 0.022], [0.02, y0 + 0.045],
      [0.016, y0 + 0.068], [0.028, y0 + 0.082], [0.016, y0 + 0.098], [0.022, y0 + 0.12], [0.05, y0 + 0.16],
      [0.075, y0 + 0.215], [0.088, y0 + 0.27], [0.094, y0 + 0.33], [0.1, y0 + 0.36]], 44);
    const inner = smoothOpen([[0.091, y0 + 0.36], [0.085, y0 + 0.31], [0.07, y0 + 0.25], [0.04, y0 + 0.21],
      [0, y0 + 0.2]], 12);
    b.lathe([[0, y0], ...prof, [0.097, y0 + 0.366], ...inner], { ...metal, seg: 40 });
    b.torus(0.0915, 0.004, { at: [0, y0 + 0.3, 0], rot: [PI / 2, 0, 0], color: shade(gold, 0.06), kind: "metal",
      seg: 40, tubeSeg: 6 });
    b.mirrorX(() => {
      b.tube([[0.08, y0 + 0.305], [0.122, y0 + 0.315], [0.136, y0 + 0.275], [0.118, y0 + 0.21], [0.062, y0 + 0.168]]
        .map(([x, y]) => [x, y, 0]), 0.0095, { ...metal, radial: 8, seg: 36 });
    });
    b.extrude(star2(0.028, 0.012), 0.006, { at: [0, y0 + 0.25, 0.0815], rot: [-0.24, 0, 0], color: shade(gold, 0.08),
      kind: "metal", bevel: 0.0015 });
  },

  // A medal on a V of striped ribbon: a thick metal disc with a rim and a raised star.
  medal(b, p) {
    const col = p.color || GOLD;
    const R = 0.056, cy = R + 0.003, th = 0.018;
    const yTop = 0.256, yJoin = cy + R + 0.034;
    for (const s of [-1, 1]) {
      const x0 = s * 0.054, x1 = s * 0.013, dx = x0 - x1, dy = yTop - yJoin;
      const len = Math.hypot(dx, dy);
      b.group({ at: [(x0 + x1) / 2, (yTop + yJoin) / 2, -s * 0.0018], rot: [0, 0, -Math.atan2(dx, dy)] }, () => {
        b.box(0.042, len, 0.003, { color: s < 0 ? C.red : C.blue, r: 0.001 });
        b.box(0.012, len, 0.0034, { color: C.white, r: 0 });
      });
    }
    b.box(0.046, 0.014, 0.008, { at: [0, yJoin, 0.002], color: col, kind: "metal", r: 0.003 });
    b.torus(0.009, 0.0026, { at: [0, cy + R + 0.011, 0], rot: [0, PI / 2, 0], color: col, kind: "metal", seg: 14,
      tubeSeg: 5 });
    b.group({ at: [0, cy, 0] }, () => {
      b.cyl(R, R, th, { rot: [PI / 2, 0, 0], color: col, kind: "metal", seg: 40 });
      for (const s of [-1, 1]) {
        b.torus(R - 0.0045, 0.004, { at: [0, 0, (s * th) / 2], color: shade(col, 0.06), kind: "metal", seg: 40, tubeSeg: 6 });
      }
      // a slightly sunken field and a big raised star
      b.cyl(R - 0.008, R - 0.008, 0.002, { at: [0, 0, th / 2 - 0.0006], rot: [PI / 2, 0, 0], color: shade(col, -0.07),
        kind: "metal", seg: 36 });
      b.extrude(star2(0.04, 0.017), 0.004, { at: [0, 0, th / 2 + 0.0016], color: shade(col, 0.1), kind: "metal",
        bevel: 0.0014 });
    });
  },

  // A royal crown: a gold band rising into eight points tipped with pearls, set with gems, over a velvet cap.
  crown(b, p) {
    const gold = p.color || GOLD;
    const n = 8, R0 = 0.138, flare = 0.07, t = 0.01, Hb = 0.075, Hs = 0.118;
    const h = (th) => {
      const s = ((((th / TAU) * n + 0.5) % 1) + 1) % 1;
      return Hb + Hs * Math.pow(1 - Math.abs(2 * s - 1), 1.25);
    };
    const Ro = (y) => R0 + flare * y;
    const N = n * 12, M = 6;
    const ring = (rOff, flip) => gridGeo(N, M, (u, v) => {
      const th = u * TAU, y = h(th) * v, r = Ro(y) + rOff;
      return [r * Math.sin(th), y, r * Math.cos(th)];
    }, { wrapU: true, flip });
    // the outer wall is faceted (flat-shaded) so that its gold catches the light in bright planes
    b.geo(ring(0, false), { color: gold, kind: "metal", flat: true });
    b.geo(ring(-t, true), { color: shade(gold, -0.06), kind: "metal" });
    b.geo(gridGeo(N, 1, (u, v) => {
      const th = u * TAU, y = h(th), r = Ro(y) - t * v;
      return [r * Math.sin(th), y, r * Math.cos(th)];
    }, { wrapU: true }), { color: gold, kind: "metal" });
    b.geo(gridGeo(N, 1, (u, v) => {
      const th = u * TAU, r = Ro(0) - t * v;
      return [r * Math.sin(th), 0, r * Math.cos(th)];
    }, { wrapU: true, flip: true }), { color: gold, kind: "metal" });
    for (const y of [0.008, Hb]) {
      b.torus(Ro(y) + 0.002, 0.0062, { at: [0, y, 0], rot: [PI / 2, 0, 0], color: shade(gold, 0.04), kind: "metal",
        seg: 64, tubeSeg: 6 });
    }
    const gems = [C.red, C.blue, C.green, C.red, C.purple, C.blue, C.green, C.purple];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU, yg = Hb * 0.5, rg = Ro(yg) + 0.002;
      b.sphere(0.0165, { at: [rg * Math.sin(a), yg, rg * Math.cos(a)], rot: [0, a, 0], scale: [1, 1.15, 0.5],
        color: gems[k], kind: "gloss", seg: 12 });
      const yt = Hb + Hs, rt = Ro(yt) - t / 2;
      b.sphere(0.0145, { at: [rt * Math.sin(a), yt + 0.009, rt * Math.cos(a)], color: "#f7f1e6", kind: "gloss", seg: 10 });
      const a2 = a + PI / n, yp = Hb * 0.5, rp = Ro(yp) + 0.002;
      b.sphere(0.0072, { at: [rp * Math.sin(a2), yp, rp * Math.cos(a2)], color: "#f7f1e6", kind: "gloss", seg: 8 });
    }
    b.sphere(R0 - 0.004, { at: [0, Hb * 0.3, 0], scale: [1, 0.72, 1], thetaLength: PI / 2, color: C.crimson, seg: 28 });
    b.sphere(0.016, { at: [0, Hb * 0.3 + (R0 - 0.004) * 0.72 + 0.011, 0], color: gold, kind: "metal", seg: 12 });
  },

  // A sword standing on its point: diamond-section steel blade, gold cross-guard with a gem, wire-wrapped grip.
  sword(b, p) {
    const steel = { color: "#e6ebf1", kind: "metal" };
    const gold = { color: GOLD, kind: "metal" };
    const grip = p.color || "#7a3b2e";
    // blade: a diamond-section lathe (4 sides, flat-shaded) — cutting edges left and right, a ridge down the middle
    b.lathe([[0, 0], [0.014, 0.026], [0.025, 0.08], [0.028, 0.15], [0.027, 0.53], [0.029, 0.597], [0, 0.606]],
      { ...steel, seg: 4, scale: [1, 1, 0.24], flat: true });
    // a dark fuller groove down each face
    for (const s of [-1, 1]) {
      b.box(0.0065, 0.42, 0.002, { at: [0, 0.37, s * 0.0058], rot: [s * -0.008, 0, 0], color: "#8f98a4", kind: "metal",
        r: 0 });
    }
    const gy = 0.612;
    b.box(0.098, 0.022, 0.03, { at: [0, gy, 0], ...gold, r: 0.009 });
    for (const s of [-1, 1]) b.sphere(0.0135, { at: [s * 0.051, gy, 0], ...gold, seg: 12 });
    b.ico(0.0105, { at: [0, gy, 0.016], scale: [1, 1.2, 0.55], color: C.red, kind: "gloss", detail: 0 });
    b.cyl(0.0135, 0.0152, 0.15, { at: [0, gy + 0.084, 0], color: grip, seg: 12 });
    const helix = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, a = t * 5.5 * TAU;
      helix.push([Math.sin(a) * 0.0148, gy + 0.012 + t * 0.144, Math.cos(a) * 0.0148]);
    }
    b.tube(helix, 0.0021, { ...gold, radial: 4, seg: 120 });
    b.cyl(0.011, 0.016, 0.012, { at: [0, gy + 0.164, 0], ...gold, seg: 12 });
    b.sphere(0.022, { at: [0, gy + 0.188, 0], ...gold, seg: 14 });
  },

  // A heraldic heater shield, quartered in color and color2 with a silver rim, standing in a wooden foot.
  // p.held drops the foot.
  shield(b, p) {
    const c1 = p.color || C.blue, c2 = p.color2 || C.yellow;
    const w = 0.19, Hs = 0.455, y0 = p.held ? 0 : 0.026, Rc = 0.55;
    const outline = heater2(w, Hs);
    const bend = (x, y, z) => [x, y0 + y, z - (x * x) / (2 * Rc)];
    if (!p.held) {
      b.box(0.2, 0.045, 0.085, { at: [0, 0.0225, -0.006], color: C.darkWood, kind: "gloss", r: 0.01 });
      b.box(0.07, 0.004, 0.022, { at: [0, 0.0452, 0.0], color: "#2a1f17", r: 0 });
    }
    // body (front face at z = 0.015), quartered face on it, raised rim and rivets on top
    warpSlab(b, outline, [], 0.022, bend, { color: C.darkWood, bevel: 0.004, maxEdge: 0.04 });
    const yq = 0.245;
    const quarters = [[c1, -1, 1], [c2, 1, 1], [c2, -1, -1], [c1, 1, -1]];
    for (const [col, sx, sy] of quarters) {
      const q = clip2(clip2(inset2(outline, 0.004), sx, 0, 0), 0, sy, -sy * yq);
      warpSlab(b, q, [], 0.003, (x, y, z) => bend(x, y, z + 0.0165), { color: col, kind: "gloss", bevel: 0, maxEdge: 0.04 });
    }
    warpSlab(b, outline, [inset2(outline, 0.024)], 0.008, (x, y, z) => bend(x, y, z + 0.021),
      { color: C.silver, kind: "metal", bevel: 0.002, maxEdge: 0.035 });
    for (const [x, y] of [[0, Hs - 0.012], [-w + 0.012, Hs - 0.012], [w - 0.012, Hs - 0.012], [-w + 0.012, 0.33],
      [w - 0.012, 0.33], [0, 0.028]]) {
      const P = bend(x, y, 0.027);
      b.sphere(0.0062, { at: P, scale: [1, 1, 0.6], color: shade(C.silver, 0.06), kind: "metal", seg: 8 });
    }
  },

  // A big old skeleton key standing upright: trefoil bow, collars on the shank, a notched bit at the foot.
  key(b, p) {
    const col = p.color || C.brass;
    const metal = { color: col, kind: "metal" };
    const by = 0.318;
    const bow = Array.from({ length: 60 }, (_, i) => {
      const a = (i / 60) * TAU, r = 0.047 + 0.009 * Math.cos(3 * (a - PI / 2));
      return [Math.cos(a) * r, by + Math.sin(a) * r];
    });
    const hole = Array.from({ length: 36 }, (_, i) => {
      const a = (i / 36) * TAU, r = 0.024 + 0.005 * Math.cos(3 * (a - PI / 2));
      return [Math.cos(a) * r, by + Math.sin(a) * r];
    });
    b.extrude(shape2(bow, [hole]), 0.012, { ...metal, bevel: 0.003 });
    b.torus(0.0175, 0.0028, { at: [0, by, 0.0075], color: shade(col, 0.06), kind: "metal", seg: 20, tubeSeg: 5 });
    b.cyl(0.0105, 0.0105, 0.27, { at: [0, 0.15, 0], ...metal, seg: 12 });
    for (const [y, r] of [[0.276, 0.017], [0.262, 0.014], [0.125, 0.014]]) {
      b.cyl(r, r, 0.009, { at: [0, y, 0], color: shade(col, 0.04), kind: "metal", seg: 14 });
    }
    b.sphere(0.012, { at: [0, 0.016, 0], ...metal, seg: 10 });
    b.extrude([[0.006, 0.008], [0.056, 0.008], [0.056, 0.03], [0.042, 0.03], [0.042, 0.043], [0.056, 0.043],
      [0.056, 0.082], [0.006, 0.082]], 0.012, { ...metal, bevel: 0.0025 });
  },

  // A padlock: chunky body with a keyhole, steel shackle; 'open' lifts the shackle out on one side.
  padlock(b, p) {
    const open = p.variant === "open";
    const col = p.color || C.brass;
    const bodyKind = p.color ? "gloss" : "metal";
    const steel = { color: C.silver, kind: "metal" };
    const W = 0.232, Hb = 0.205, D = 0.1;
    b.box(W, Hb, D, { at: [0, Hb / 2, 0], color: col, kind: bodyKind, r: 0.034 });
    b.box(W - 0.02, 0.012, D + 0.004, { at: [0, Hb - 0.032, 0], color: shade(col, -0.06), kind: bodyKind, r: 0.005 });
    b.cyl(0.033, 0.033, 0.006, { at: [0, 0.095, D / 2 + 0.001], rot: [PI / 2, 0, 0], color: shade(col, 0.08),
      kind: bodyKind, seg: 24 });
    b.cyl(0.013, 0.013, 0.004, { at: [0, 0.103, D / 2 + 0.004], rot: [PI / 2, 0, 0], color: "#1d1f24", seg: 16 });
    b.extrude([[-0.006, 0.0], [0.006, 0.0], [0.0095, -0.026], [-0.0095, -0.026]], 0.004,
      { at: [0, 0.101, D / 2 + 0.0035], color: "#1d1f24", bevel: 0 });
    const Rs = 0.064, rs = 0.0165, legTop = Hb + 0.065;
    const lift = open ? 0.06 : 0;
    b.group({ at: [Rs, lift, 0], rot: [0, open ? -0.5 : 0, 0] }, () => {
      b.torus(Rs, rs, { at: [-Rs, legTop, 0], arc: PI, ...steel, seg: 24, tubeSeg: 10 });
      b.cyl(rs, rs, legTop - Hb + 0.03 + lift, { at: [0, (legTop + Hb - 0.03 - lift) / 2, 0], ...steel, seg: 14 });
      const shortLen = legTop - Hb + 0.03 - (open ? 0.025 : 0);
      b.cyl(rs, rs, shortLen, { at: [-2 * Rs, legTop - shortLen / 2, 0], ...steel, seg: 14 });
      if (open) b.sphere(rs, { at: [-2 * Rs, legTop - shortLen, 0], ...steel, seg: 12 });
    });
    if (open) b.cyl(0.019, 0.019, 0.004, { at: [-Rs, Hb - 0.0005, 0], color: "#1d1f24", seg: 14 });
  },

  // A steel safe on short feet: inset door with a combination dial, a lever handle, gold pinstripes and rivets.
  // 'open' swings the door wide, showing its bolts and the gold bars and cash inside.
  safe(b, p) {
    const open = p.variant === "open";
    const body = p.color || "#46505b";
    const chrome = { color: C.silver, kind: "metal" };
    const gold = GOLD;
    // the open safe is a little slimmer, so that its swung-out door stays near the catalogue box
    const W = open ? 0.42 : 0.52, H = open ? 0.56 : 0.585, D = open ? 0.33 : 0.44;
    const foot = 0.038, yc = foot + H / 2, fz = D / 2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      b.box(0.055, foot + 0.01, 0.055, { at: [sx * (W / 2 - 0.045), (foot + 0.01) / 2, sz * (D / 2 - 0.045)],
        color: C.charcoal, r: 0.008 });
    }
    const bw = 0.045, Wd = W - 2 * bw, Hd = H - 2 * bw, td = 0.07;
    const inside = "#2b2f35";
    if (!open) {
      b.box(W, H, D, { at: [0, yc, 0], color: body, kind: "gloss", r: 0.022 });
    } else {
      const wt = 0.035;
      b.box(W, H, wt, { at: [0, yc, -D / 2 + wt / 2], color: body, kind: "gloss", r: 0.012 });
      for (const s of [-1, 1]) b.box(wt, H, D, { at: [s * (W / 2 - wt / 2), yc, 0], color: body, kind: "gloss", r: 0.012 });
      for (const y of [foot + wt / 2, foot + H - wt / 2]) b.box(W, wt, D, { at: [0, y, 0], color: body, kind: "gloss", r: 0.012 });
      b.box(W - 2 * wt, H - 2 * wt, 0.004, { at: [0, yc, -D / 2 + wt + 0.002], color: inside, r: 0 });
      for (const s of [-1, 1]) b.box(0.004, H - 2 * wt, D - wt, { at: [s * (W / 2 - wt - 0.002), yc, wt / 2], color: inside, r: 0 });
      b.box(W - 2 * wt, 0.004, D - wt, { at: [0, foot + wt + 0.002, wt / 2], color: inside, r: 0 });
      b.box(W - 2 * wt, 0.004, D - wt, { at: [0, foot + H - wt - 0.002, wt / 2], color: inside, r: 0 });
      // front frame around the opening
      const fr = [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]];
      b.extrude(shape2(fr, [rrect2(Wd + 0.004, Hd + 0.004, 0.01)]), 0.02, { at: [0, yc, fz - 0.01], color: body,
        kind: "gloss", bevel: 0.004 });
      // shelf and treasure
      const ys = foot + wt + (H - 2 * wt) * 0.5;
      b.box(W - 2 * wt - 0.004, 0.014, D - wt - 0.02, { at: [0, ys, wt / 2 - 0.01], color: shade(body, -0.1), r: 0.003 });
      const fy = foot + wt + 0.004;
      b.prop("gold_bar", {}, { at: [-0.075, fy, 0.02], scale: 0.62 });
      b.prop("gold_bar", {}, { at: [0.075, fy, 0.02], scale: 0.62 });
      b.prop("gold_bar", {}, { at: [0, fy + 0.058, 0.02], scale: 0.62 });
      // a stack of banknotes with a paper band, and a stack of coins
      for (let i = 0; i < 3; i++) {
        b.box(0.12, 0.016, 0.06, { at: [-0.075 + (i - 1) * 0.004, ys + 0.007 + 0.016 * (i + 0.5), 0],
          color: i % 2 ? "#8fbf7a" : "#7fb36a", r: 0.002 });
      }
      b.box(0.022, 0.05, 0.062, { at: [-0.075, ys + 0.031, 0], color: "#f1e9d6", r: 0.002 });
      b.prop("coin_stack", {}, { at: [0.07, ys + 0.007, 0.0], scale: 0.42 });
    }
    // the door, built in its hinge frame (hinge on the left front edge, door along +x)
    const ang = open ? 2.5 : 0;
    const door = () => {
      b.box(Wd, Hd, td, { at: [Wd / 2, 0, -td / 2 + 0.012], color: body, kind: "gloss", r: 0.014 });
      // gold pinstripe
      const ins = 0.026, lw = 0.004;
      for (const s of [-1, 1]) {
        b.box(Wd - 2 * ins, lw, 0.002, { at: [Wd / 2, s * (Hd / 2 - ins), 0.0125], color: gold, r: 0 });
        b.box(lw, Hd - 2 * ins, 0.002, { at: [Wd / 2 + s * (Wd / 2 - ins), 0, 0.0125], color: gold, r: 0 });
      }
      b.group({ at: [Wd / 2, Hd * 0.12, 0.012] }, () => dial(b, 0.074));
      // lever handle
      b.group({ at: [Wd / 2, -Hd * 0.2, 0.012] }, () => {
        b.cyl(0.024, 0.026, 0.02, { at: [0, 0, 0.01], rot: [PI / 2, 0, 0], ...chrome, seg: 16 });
        b.group({ rot: [0, 0, -0.5] }, () => {
          b.box(0.15, 0.02, 0.016, { at: [0, 0, 0.026], ...chrome, r: 0.007 });
          for (const s of [-1, 1]) b.sphere(0.017, { at: [s * 0.075, 0, 0.026], ...chrome, seg: 12 });
        });
      });
      b.box(0.11, 0.026, 0.004, { at: [Wd / 2, Hd / 2 - 0.06, 0.013], color: gold, kind: "metal", r: 0.002 });
      // hinges
      for (const y of [-Hd * 0.32, Hd * 0.32]) b.cyl(0.016, 0.016, 0.07, { at: [-0.006, y, 0.006], ...chrome, seg: 12 });
      if (open) {
        // inside of the door: bolt-work panel and bolts on the free edge
        b.box(Wd - 0.06, Hd - 0.06, 0.008, { at: [Wd / 2, 0, -td + 0.008], ...chrome, r: 0.004 });
        b.box(0.02, Hd - 0.11, 0.012, { at: [Wd - 0.06, 0, -td + 0.0], color: C.iron, kind: "metal", r: 0.004 });
        for (const y of [-Hd * 0.32, 0, Hd * 0.32]) {
          b.cyl(0.017, 0.017, 0.06, { at: [Wd + 0.004, y, -td / 2 + 0.012], rot: [0, 0, PI / 2], ...chrome, seg: 14 });
        }
      }
    };
    b.group({ at: [-Wd / 2, yc, fz], rot: [0, -ang, 0] }, door);
    // rivets on the front frame
    for (const sx of [-1, 1]) for (const yy of [0.022, H / 2, H - 0.022]) {
      b.sphere(0.0075, { at: [sx * (W / 2 - 0.022), foot + yy, fz + 0.001], scale: [1, 1, 0.6], color: shade(body, 0.12),
        kind: "metal", seg: 8 });
    }
  },

  // A round bank-vault door in a square steel frame: radial bolt heads, a spoked wheel, a dial and a big hinge.
  vault_door(b) {
    const frame = { color: "#8d959f", kind: "metal" };
    const steel = { color: "#c7ccd3", kind: "metal" };
    const brass = { color: C.brass, kind: "metal" };
    const S = 1.3, cy = 0.65, Rh = 0.54, Rd = 0.515;
    const sq = [[-S / 2, -S / 2], [S / 2, -S / 2], [S / 2, S / 2], [-S / 2, S / 2]];
    b.extrude(shape2(sq, [ellipse2(Rh, Rh, 64)]), 0.12, { at: [0, cy, -0.02], ...frame, bevel: 0.015 });
    b.torus(Rh + 0.012, 0.022, { at: [0, cy, 0.058], color: shade(frame.color, 0.08), kind: "metal", seg: 64, tubeSeg: 8 });
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      for (const [dx, dy] of [[0.06, 0.06], [0.14, 0.06], [0.06, 0.14]]) {
        b.sphere(0.014, { at: [sx * (S / 2 - dx), cy + sy * (S / 2 - dy), 0.056], scale: [1, 1, 0.55],
          color: shade(frame.color, 0.1), kind: "metal", seg: 8 });
      }
    }
    // the door
    b.cyl(Rd, Rd, 0.13, { at: [0, cy, 0.02], rot: [PI / 2, 0, 0], ...steel, seg: 64 });
    b.torus(Rd - 0.03, 0.022, { at: [0, cy, 0.085], ...steel, seg: 64, tubeSeg: 8 });
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * TAU;
      b.sphere(0.02, { at: [Math.sin(a) * (Rd - 0.085), cy + Math.cos(a) * (Rd - 0.085), 0.085], scale: [1, 1, 0.55],
        color: shade(steel.color, 0.06), kind: "metal", seg: 10 });
    }
    b.cyl(0.36, 0.37, 0.024, { at: [0, cy, 0.097], rot: [PI / 2, 0, 0], color: shade(steel.color, -0.05), kind: "metal",
      seg: 56 });
    b.torus(0.25, 0.008, { at: [0, cy, 0.11], color: shade(steel.color, -0.12), kind: "metal", seg: 48, tubeSeg: 5 });
    // spoked wheel
    b.cyl(0.075, 0.085, 0.05, { at: [0, cy, 0.13], rot: [PI / 2, 0, 0], ...brass, seg: 24 });
    b.torus(0.2, 0.016, { at: [0, cy, 0.15], ...steel, seg: 48, tubeSeg: 8 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + PI / 4, dx = Math.sin(a), dy = Math.cos(a);
      b.rod([dx * 0.06, cy + dy * 0.06, 0.15], [dx * 0.26, cy + dy * 0.26, 0.15], 0.018, { ...steel, seg: 10 });
      b.sphere(0.032, { at: [dx * 0.275, cy + dy * 0.275, 0.15], ...brass, seg: 12 });
    }
    b.cyl(0.04, 0.04, 0.02, { at: [0, cy, 0.16], rot: [PI / 2, 0, 0], ...steel, seg: 16 });
    b.group({ at: [-0.3, cy + 0.27, 0.105] }, () => dial(b, 0.055, { face: "#30343b" }));
    // hinge on the right
    for (const y of [cy - 0.26, cy + 0.26]) {
      b.box(0.2, 0.09, 0.05, { at: [Rd - 0.03, y, 0.085], ...steel, r: 0.015 });
      b.cyl(0.05, 0.05, 0.16, { at: [Rd + 0.075, y, 0.09], ...steel, seg: 18 });
    }
    b.cyl(0.024, 0.024, 0.66, { at: [Rd + 0.075, cy, 0.09], color: shade(steel.color, -0.1), kind: "metal", seg: 12 });
  },

  // A heavy chain lying in a gentle S: alternating flat and upright stadium links.
  chain(b, p) {
    const col = p.color || "#848c96";
    const metal = { color: col, kind: "metal" };
    const rw = 0.015, Rl = 0.034, Ls = 0.05, pitch = Ls + Rl, N = 9;
    const rnd = randomFor(b, p);
    const link = () => {
      for (const s of [-1, 1]) {
        b.torus(Rl, rw, { at: [(s * Ls) / 2, 0, 0], arc: PI, rot: [0, 0, s > 0 ? -PI / 2 : PI / 2], ...metal, seg: 10,
          tubeSeg: 8 });
        b.cyl(rw, rw, Ls, { at: [0, s * Rl, 0], rot: [0, 0, PI / 2], open: true, ...metal, seg: 8 });
      }
    };
    const zAt = (x) => 0.018 * Math.sin((x / 0.8) * TAU * 0.9 + 0.3);
    for (let i = 0; i < N; i++) {
      const x = (i - (N - 1) / 2) * pitch, z = zAt(x);
      const yaw = Math.atan((zAt(x + 0.01) - zAt(x - 0.01)) / 0.02);
      const flat = i % 2 === 0;
      const y = flat ? 3 * rw : Rl + rw;
      b.group({ at: [x, y, z], rot: [0, -yaw, 0] }, () => {
        if (flat) b.group({ rot: [PI / 2, 0, 0] }, link);
        else b.group({ rot: [rnd.range(-0.12, 0.12), 0, 0] }, link);
      });
    }
  },

  // A coin standing on its edge; variant gold, silver or copper.
  coin(b, p) {
    const col = { gold: GOLD, silver: C.silver, copper: C.copper }[p.variant] || GOLD;
    const R = 0.068;
    b.group({ at: [0, R, 0] }, () => coinBody(b, R, 0.016, col));
  },

  // A slightly untidy stack of gold coins with one lying beside it.
  coin_stack(b, p) {
    const rnd = randomFor(b, p);
    const R = 0.066, t = 0.0155, n = 15;
    for (let i = 0; i < n; i++) {
      const top = i === n - 1;
      const x = rnd.range(-0.004, 0.004), z = rnd.range(-0.004, 0.004);
      const col = shade(GOLD, rnd.range(-0.035, 0.035));
      if (top) {
        b.group({ at: [x, t * i + t / 2, z], rot: [-PI / 2, 0, rnd.range(0, TAU)] }, () => coinBody(b, R, t, col,
          { oneSide: true }));
      } else {
        const k = 0.0022;
        b.lathe([[0, 0], [R - k, 0], [R, k], [R, t - k], [R - k, t], [0, t]], { at: [x, t * i, z], color: col,
          kind: "metal", seg: 26 });
      }
    }
  },

  // A cast gold ingot: tapered sides, a stamped cartouche on top.
  gold_bar(b) {
    const gold = { color: GOLD, kind: "metal" };
    const W = 0.232, H = 0.088, D = 0.116;
    taperBox(b, W, H, D, 0.82, 0.68, { at: [0, H / 2, 0], ...gold, r: 0.008 });
    const tw = W * 0.82 - 0.05, td = D * 0.68 - 0.034;
    b.box(tw, 0.003, td, { at: [0, H + 0.0005, 0], color: shade(GOLD, -0.06), kind: "metal", r: 0.0012 });
    b.text("999.9", { at: [0, H + 0.0035, 0.0], rot: [-PI / 2, 0, 0], w: tw * 0.9, h: td * 0.8, fg: "#7a5418",
      font: "display", weight: "700" });
  },

  // A die with rounded edges and pips (5 at the front, 3 on top); color = body, the pips contrast with it.
  dice(b, p) {
    const body = p.color || "#f6f3ec";
    const pip = isLight(body) ? INK : "#f6f3ec";
    const s = 0.13, h = s / 2, d = 0.033;
    b.box(s, s, s, { at: [0, h, 0], color: body, kind: "gloss", r: 0.024 });
    const L = { 1: [[0, 0]], 2: [[-1, 1], [1, -1]], 3: [[-1, 1], [0, 0], [1, -1]], 4: [[-1, 1], [1, 1], [-1, -1], [1, -1]],
      5: [[-1, 1], [1, 1], [0, 0], [-1, -1], [1, -1]], 6: [[-1, 1], [-1, 0], [-1, -1], [1, 1], [1, 0], [1, -1]] };
    // [value, normal, right, up]
    const faces = [[5, [0, 0, 1], [1, 0, 0], [0, 1, 0]], [2, [0, 0, -1], [-1, 0, 0], [0, 1, 0]],
      [3, [0, 1, 0], [1, 0, 0], [0, 0, -1]], [4, [0, -1, 0], [1, 0, 0], [0, 0, 1]],
      [6, [1, 0, 0], [0, 0, -1], [0, 1, 0]], [1, [-1, 0, 0], [0, 0, 1], [0, 1, 0]]];
    for (const [v, n, rv, up] of faces) {
      const one = v === 1;
      const pr = one ? 0.018 : 0.0115;
      for (const [a, c] of L[v]) {
        const at = [0, 1, 2].map((k) => n[k] * (h + 0.0002) + rv[k] * a * d + up[k] * c * d + (k === 1 ? h : 0));
        b.cyl(pr, pr, 0.0016, { at, rot: aim(n), color: one && isLight(body) ? C.red : pip, kind: "gloss", seg: 14 });
      }
    }
  },

  // A playing card standing up: corner indices and a big suit symbol (text = rank and suit, e.g. "A♠";
  // red for ♥ ♦); a patterned red back.
  playing_card(b, p) {
    const W = 0.15, H = 0.212, T = 0.007, fz = T / 2;
    let str = (textOf(b, p) || "A♠").replace(/️/g, "").trim();
    const SUITS = { "♠": "♠", "♤": "♠", "♥": "♥", "♡": "♥", "♦": "♦", "♢": "♦", "♣": "♣", "♧": "♣" };
    const last = Array.from(str).pop();
    const suit = SUITS[last] || "";
    const rank = suit ? Array.from(str).slice(0, -1).join("").trim() : str;
    const ink = suit === "♥" || suit === "♦" ? "#c8323a" : INK;
    b.extrude(rrect2(W, H, 0.012, 0, H / 2, 5), T - 0.002, { color: "#fbf8f1", kind: "gloss", bevel: 0.001 });
    // back: red panel with a lighter frame
    b.extrude(rrect2(W - 0.016, H - 0.016, 0.008, 0, H / 2, 4), 0.001, { at: [0, 0, -fz - 0.0003], color: C.crimson,
      bevel: 0 });
    b.extrude(shape2(rrect2(W - 0.03, H - 0.03, 0.006, 0, H / 2, 4), [rrect2(W - 0.036, H - 0.036, 0.004, 0, H / 2, 4)]),
      0.001, { at: [0, 0, -fz - 0.0008], color: "#f1d9c8", bevel: 0 });
    const z = fz + 0.0022;
    if (suit) {
      const idx = `${rank}\n${suit}`;
      b.text(idx, { at: [-W / 2 + 0.019, H - 0.033, z], w: 0.03, h: 0.052, fg: ink, font: "display", weight: "700" });
      b.text(idx, { at: [W / 2 - 0.019, 0.033, z], rot: [0, 0, PI], w: 0.03, h: 0.052, fg: ink, font: "display",
        weight: "700" });
      b.text(suit, { at: [0, H / 2, z], w: 0.1, h: 0.1, fg: ink, font: "display" });
    } else {
      b.text(rank, { at: [0, H / 2, z], w: W - 0.03, h: H * 0.5, fg: ink, font: "display", weight: "700" });
    }
  },

  // A Staunton chess piece turned on a lathe; variant king, queen, rook, bishop, knight or pawn.
  chess_piece(b, p) {
    const v = ["king", "queen", "rook", "bishop", "knight", "pawn"].includes(p.variant) ? p.variant : "king";
    const col = p.color || "#f1e8d4";
    const m = { color: col, kind: "gloss" };
    const base = (r) => [[0, 0], [r - 0.002, 0], [r, 0.005], [r, 0.016], [r - 0.006, 0.021], [r - 0.01, 0.024],
      [r - 0.007, 0.029], [r - 0.01, 0.034], [r - 0.02, 0.042]];
    const lathe = (pts, n = 60) => b.lathe(smoothOpen(pts, n), { ...m, seg: 32 });
    if (v === "king") {
      lathe([...base(0.07), [0.04, 0.058], [0.032, 0.085], [0.026, 0.13], [0.023, 0.17], [0.024, 0.19], [0.03, 0.198],
        [0.046, 0.203], [0.048, 0.209], [0.04, 0.214], [0.03, 0.218], [0.028, 0.222], [0.036, 0.232], [0.046, 0.255],
        [0.052, 0.28], [0.05, 0.288], [0.042, 0.292], [0.026, 0.295], [0, 0.297]], 72);
      b.sphere(0.017, { at: [0, 0.298, 0], ...m, seg: 14 });
      b.box(0.017, 0.054, 0.017, { at: [0, 0.327, 0], ...m, r: 0.005 });
      b.box(0.046, 0.016, 0.017, { at: [0, 0.334, 0], ...m, r: 0.005 });
    } else if (v === "queen") {
      lathe([...base(0.07), [0.04, 0.058], [0.032, 0.085], [0.026, 0.13], [0.023, 0.17], [0.024, 0.19], [0.03, 0.198],
        [0.046, 0.203], [0.048, 0.209], [0.04, 0.214], [0.03, 0.218], [0.028, 0.222], [0.036, 0.234], [0.048, 0.262],
        [0.055, 0.284], [0.05, 0.29], [0.036, 0.294], [0.03, 0.303], [0, 0.31]], 72);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        b.sphere(0.0095, { at: [Math.sin(a) * 0.05, 0.293, Math.cos(a) * 0.05], ...m, seg: 8 });
      }
      b.sphere(0.017, { at: [0, 0.325, 0], ...m, seg: 14 });
    } else if (v === "bishop") {
      lathe([...base(0.068), [0.038, 0.056], [0.03, 0.08], [0.023, 0.125], [0.02, 0.16], [0.022, 0.172], [0.04, 0.178],
        [0.042, 0.185], [0.03, 0.19], [0.022, 0.195], [0.021, 0.2], [0.028, 0.208], [0.038, 0.226], [0.041, 0.245],
        [0.037, 0.265], [0.027, 0.283], [0.014, 0.294], [0, 0.298]], 72);
      b.sphere(0.013, { at: [0, 0.306, 0], ...m, seg: 12 });
      b.box(0.006, 0.05, 0.012, { at: [0.016, 0.258, 0.034], rot: [-0.15, 0.4, -0.75], color: shade(col, -0.35), r: 0 });
    } else if (v === "rook") {
      lathe([...base(0.074), [0.048, 0.06], [0.045, 0.12], [0.046, 0.18], [0.05, 0.2], [0.06, 0.212], [0.062, 0.218],
        [0.062, 0.252], [0.044, 0.252], [0.044, 0.238], [0, 0.238]], 64);
      for (let k = 0; k < 5; k++) {
        const a0 = (k / 5) * TAU + 0.21, a1 = a0 + TAU / 5 - 0.42;
        ringSector(b, 0.044, 0.062, a0, a1, 0.25, 0.04, { ...m, bevel: 0.002 });
      }
    } else if (v === "knight") {
      lathe([...base(0.07), [0.046, 0.06], [0.044, 0.085], [0.05, 0.095], [0.052, 0.1], [0.046, 0.106], [0, 0.108]], 48);
      const head = smooth2([[0.042, 0.0], [0.048, 0.04], [0.046, 0.085], [0.036, 0.125], [0.022, 0.155], [0.012, 0.172],
        [0.006, 0.19], [-0.006, 0.176], [-0.02, 0.17], [-0.04, 0.155], [-0.058, 0.13], [-0.072, 0.105], [-0.075, 0.092],
        [-0.07, 0.08], [-0.06, 0.078], [-0.045, 0.085], [-0.03, 0.09], [-0.022, 0.07], [-0.032, 0.04], [-0.04, 0.0]], 64);
      warpSlab(b, head, [], 0.048, (x, y, z) => [x + 0.012, 0.102 + y, z * (1 - 0.3 * smoothstep(-0.02, -0.075, x))],
        { ...m, bevel: 0.008, maxEdge: 0.03, crease: 0.9 });
      for (const s of [-1, 1]) {
        b.sphere(0.0065, { at: [-0.023, 0.102 + 0.142, s * 0.029], color: INK, kind: "gloss", seg: 8 });
        b.sphere(0.0045, { at: [-0.058, 0.102 + 0.094, s * 0.019], color: shade(col, -0.35), kind: "gloss", seg: 6 });
      }
      for (let i = 0; i < 6; i++) {
        const t = i / 5, x = 0.056 - 0.04 * t, y = 0.13 + 0.15 * t - 0.035 * t * t;
        b.sphere(0.012, { at: [x + 0.004, y, 0], scale: [0.8, 1.1, 1.25], color: shade(col, -0.08), kind: "gloss", seg: 8 });
      }
    } else {
      lathe([...base(0.075), [0.044, 0.07], [0.036, 0.11], [0.031, 0.15], [0.03, 0.17], [0.046, 0.178], [0.048, 0.185],
        [0.034, 0.19], [0.026, 0.196], [0, 0.2]], 56);
      b.sphere(0.046, { at: [0, 0.24, 0], ...m, seg: 22 });
    }
  },

  // A jigsaw piece standing up: two tabs, two blanks.
  puzzle_piece(b, p) {
    const col = p.color || "#3f9f52";
    const S = 0.214, k = 0.245 * S, bevel = 0.009;
    const outline = puzzle2(S, [-1, 1, 1, -1]).map(([x, y]) => [x - (S + k) / 2, y + bevel]);
    b.extrude(outline, 0.054, { color: col, kind: "gloss", bevel, curveSeg: 6 });
  },

  // A ball; variant plain (rubber), soccer (black and white panels), beach (coloured gores) or bowling.
  ball(b, p) {
    const v = p.variant || "plain";
    const R = 0.122;
    b.group({ at: [0, R, 0] }, () => {
      if (v === "soccer") soccer(b, R);
      else if (v === "beach") {
        const cols = [p.color || C.red, C.white, C.blue, C.white, C.yellow, C.white];
        b.group({ rot: [0.45, 0, 0.3] }, () => {
          for (let k = 0; k < 6; k++) {
            b.geo(new THREE.SphereGeometry(R, 6, 22, 0, PI / 3, 0, PI), { rot: [0, (k * PI) / 3, 0], color: cols[k],
              kind: "gloss" });
          }
          for (const s of [1, -1]) {
            b.geo(new THREE.SphereGeometry(R * 1.004, 20, 3, 0, TAU, 0, 0.3), { rot: [s > 0 ? 0 : PI, 0, 0], color: C.white,
              kind: "gloss" });
          }
          b.cyl(0.012, 0.012, 0.008, { at: [0, R + 0.002, 0], color: "#e9e4da", kind: "gloss", seg: 10 });
        });
      } else if (v === "bowling") {
        const col = p.color || "#3d3a8f";
        b.sphere(R, { color: col, kind: "gloss", seg: 30 });
        const c = new THREE.Vector3(0, 0.5, 0.86).normalize();
        const right = new THREE.Vector3(1, 0, 0), up = new THREE.Vector3().crossVectors(c, right).negate();
        for (const [dx, dy, r] of [[-0.024, 0.02, 0.0125], [0.024, 0.02, 0.0125], [0, -0.035, 0.0145]]) {
          const d = c.clone().multiplyScalar(R).addScaledVector(right, dx).addScaledVector(up, dy).normalize();
          b.cyl(r, r, 0.004, { at: d.clone().multiplyScalar(R - 0.0008).toArray(), rot: aim(d.toArray()), color: "#141518",
            seg: 14 });
          // the torus lies in its xy plane: turn its axis (z) onto d
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
          const e = new THREE.Euler().setFromQuaternion(q, "XYZ");
          b.torus(r + 0.0012, 0.0016, { at: d.clone().multiplyScalar(R + 0.0002).toArray(), rot: [e.x, e.y, e.z],
            color: shade(col, 0.08), kind: "gloss", seg: 14, tubeSeg: 4 });
        }
      } else {
        const col = p.color || C.red;
        b.sphere(R, { color: col, kind: "gloss", seg: 30 });
        b.torus(R * 1.001, 0.0022, { rot: [PI / 2 + 0.35, 0, 0.2], color: shade(col, -0.12), kind: "gloss", seg: 48,
          tubeSeg: 4 });
      }
    });
  },

  // A balloon on a string with a little weight on the ground.
  balloon(b, p) {
    const col = p.color || C.red;
    const y0 = 0.402;
    b.lathe(smoothOpen([[0, 0], [0.012, 0.005], [0.04, 0.03], [0.09, 0.09], [0.126, 0.16], [0.138, 0.222],
      [0.132, 0.272], [0.108, 0.314], [0.064, 0.34], [0, 0.348]], 40), { at: [0, y0, 0], color: col, kind: "gloss", seg: 30 });
    b.cyl(0.006, 0.016, 0.016, { at: [0, y0 - 0.004, 0], color: shade(col, -0.08), kind: "gloss", seg: 12 });
    b.torus(0.008, 0.0035, { at: [0, y0 - 0.013, 0], rot: [PI / 2, 0, 0], color: shade(col, -0.08), kind: "gloss", seg: 12,
      tubeSeg: 5 });
    b.tube([[0, y0 - 0.014, 0], [0.016, y0 - 0.08, 0.008], [-0.012, y0 - 0.17, -0.004], [0.014, y0 - 0.26, 0.006],
      [-0.006, y0 - 0.33, 0], [0, 0.04, 0]], 0.0022, { color: "#f4f1ea", radial: 5, seg: 70 });
    b.lathe(smoothOpen([[0, 0], [0.03, 0], [0.032, 0.012], [0.026, 0.03], [0.012, 0.038], [0, 0.04]], 12),
      { color: C.silver, kind: "metal", seg: 20 });
  },

  // A domino standing on end: black tile, white pips, a brass spinner; the numbers come from the seed.
  domino(b, p) {
    const rnd = randomFor(b, p);
    const W = 0.096, H = 0.192, T = 0.034, fz = T / 2;
    b.box(W, H, T, { at: [0, H / 2, 0], color: "#24262b", kind: "gloss", r: 0.009 });
    b.box(W - 0.024, 0.004, 0.002, { at: [0, H / 2, fz + 0.0002], color: "#d9d5cc", r: 0 });
    b.sphere(0.0062, { at: [0, H / 2, fz], scale: [1, 1, 0.5], color: C.brass, kind: "metal", seg: 10 });
    const L = { 0: [], 1: [[0, 0]], 2: [[-1, 1], [1, -1]], 3: [[-1, 1], [0, 0], [1, -1]], 4: [[-1, 1], [1, 1], [-1, -1], [1, -1]],
      5: [[-1, 1], [1, 1], [0, 0], [-1, -1], [1, -1]], 6: [[-1, 1], [-1, 0], [-1, -1], [1, 1], [1, 0], [1, -1]] };
    const top = rnd.int(1, 6), bot = rnd.int(0, 6);
    for (const [v, cy] of [[top, H * 0.75], [bot, H * 0.25]]) {
      for (const [a, c] of L[v]) {
        b.cyl(0.0078, 0.0078, 0.0016, { at: [a * 0.026, cy + c * 0.026, fz + 0.0002], rot: [PI / 2, 0, 0],
          color: "#f4f1ea", kind: "gloss", seg: 12 });
      }
    }
  },

  // A 2×4 toy building brick in glossy plastic.
  toy_brick(b, p) {
    const col = p.color || C.red;
    const W = 0.236, H = 0.11, D = 0.116;
    b.box(W, H, D, { at: [0, H / 2, 0], color: col, kind: "gloss", r: 0.006 });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
      b.lathe([[0, 0], [0.0178, 0], [0.0178, 0.019], [0.0158, 0.022], [0, 0.022]],
        { at: [(i - 1.5) * 0.058, H - 0.001, (j - 0.5) * 0.058], color: col, kind: "gloss", seg: 18 });
    }
  },

  // A classic archery target: a straw boss with the five-colour face on an A-frame stand, one arrow in it.
  target(b) {
    const yc = 0.338, Rb = 0.268, tb = 0.054;
    const zf = tb / 2 + 0.003;
    const wood = C.wood;
    for (const s of [-1, 1]) {
      b.rod([s * 0.13, 0.56, -0.033], [s * 0.245, 0.012, -0.027], 0.013, { color: wood, seg: 8 });
      b.box(0.034, 0.024, 0.08, { at: [s * 0.245, 0.012, -0.006], color: shade(wood, -0.1), r: 0.007 });
    }
    b.rod([-0.215, 0.12, -0.03], [0.215, 0.12, -0.03], 0.01, { color: shade(wood, -0.06), seg: 8 });
    b.cyl(Rb, Rb, tb, { at: [0, yc, 0], rot: [PI / 2, 0, 0], color: "#d9b768", seg: 48 });
    for (const z of [-tb / 2 + 0.012, tb / 2 - 0.012]) {
      b.torus(Rb + 0.001, 0.0045, { at: [0, yc, z], color: "#b38d48", seg: 48, tubeSeg: 5 });
    }
    const R = 0.25;
    const zones = ["#f4f1ea", "#2b2e35", "#3e8fd8", "#da4539", "#f3c94b"];
    for (let i = 0; i < 10; i++) {
      const ro = R * (1 - i / 10), ri = R * (1 - (i + 1) / 10);
      b.geo(new THREE.RingGeometry(ri, ro, 56, 1), { at: [0, yc, zf], color: zones[Math.floor(i / 2)] });
      if (i > 0) {
        const line = i === 2 || i === 3 ? "#c9ccd2" : "#3a3d44";
        b.geo(new THREE.RingGeometry(ro - 0.0012, ro + 0.0012, 56, 1), { at: [0, yc, zf + 0.0006], color: line });
      }
    }
    b.geo(new THREE.RingGeometry(R - 0.002, R + 0.004, 56, 1), { at: [0, yc, zf + 0.0006], color: "#8a8d93" });
    // an arrow in the red, shot in at a slant from the left (kept shallow so the target stays thin)
    const tip = [-0.03, yc + 0.035, zf - 0.004];
    const dir = new THREE.Vector3(-0.84, 0.26, 0.39).normalize();
    const L = 0.135, at = (t) => [tip[0] + dir.x * t, tip[1] + dir.y * t, tip[2] + dir.z * t];
    b.rod(tip, at(L), 0.0048, { color: "#e9dcc2", seg: 8 });
    b.cyl(0.0058, 0.0058, 0.008, { at: at(L + 0.002), rot: aim(dir.toArray()), color: C.charcoal, seg: 8 });
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU + 0.5;
      b.group({ at: at(L - 0.026), rot: aim(dir.toArray()) }, () => b.group({ rot: [0, a, 0] }, () =>
        b.extrude([[0, -0.016], [0.014, 0.0], [0.014, 0.018], [0, 0.016]], 0.0012,
          { at: [0.003, 0, 0], color: k === 0 ? C.red : C.white, bevel: 0 })));
    }
  },

  // A theatre mask on a stand: comedy (laughing, gold) or tragedy (weeping, blue); color overrides the face.
  theater_mask(b, p) {
    const tragedy = p.variant === "tragedy";
    const col = p.color || (tragedy ? "#86aee0" : "#f2c14e");
    const yc = 0.182;
    const half = tragedy
      ? [[0, 0.14], [0.072, 0.132], [0.114, 0.094], [0.128, 0.03], [0.122, -0.035], [0.1, -0.09], [0.066, -0.13],
        [0.03, -0.148], [0, -0.152]]
      : [[0, 0.138], [0.076, 0.132], [0.12, 0.098], [0.136, 0.04], [0.134, -0.02], [0.115, -0.076], [0.078, -0.116],
        [0.036, -0.138], [0, -0.143]];
    const outline = smooth2([...half, ...half.slice(1, -1).reverse().map(([x, y]) => [-x, y])], 64);
    // eye holes: laughing upturned crescents, or drooping almonds; and the open mouth
    const eye = (sx) => tragedy
      ? smooth2([[sx * 0.018, 0.047], [sx * 0.05, 0.046], [sx * 0.084, 0.022], [sx * 0.056, 0.016], [sx * 0.024, 0.026]], 26)
      : [...arc2(0.038, 0.036, 0.08 * PI, 0.92 * PI, 12, sx * 0.053, 0.02),
        ...arc2(0.034, 0.012, 0.9 * PI, 0.1 * PI, 12, sx * 0.053, 0.02)];
    const mouth = tragedy
      ? smooth2([[-0.072, -0.104], [-0.044, -0.068], [0, -0.056], [0.044, -0.068], [0.072, -0.104], [0.042, -0.09],
        [0, -0.082], [-0.042, -0.09]], 32)
      : smooth2([[-0.078, -0.028], [-0.04, -0.044], [0, -0.048], [0.04, -0.044], [0.078, -0.028], [0.064, -0.066],
        [0.034, -0.093], [0, -0.102], [-0.034, -0.093], [-0.064, -0.066]], 36);
    const surf = (x, y) => -(x * x) / (2 * 0.15) - (y * y) / (2 * 0.5);
    const bend = (dz) => (x, y, z) => [x, yc + y, z + dz + surf(x, y)];
    warpSlab(b, outline, [eye(-1), eye(1), mouth], 0.008, bend(0.004), { color: col, kind: "gloss", bevel: 0.003,
      maxEdge: 0.016, crease: 0.8 });
    warpSlab(b, inset2(outline, 0.012), [], 0.004, bend(-0.008), { color: "#2a2522", bevel: 0, maxEdge: 0.026 });
    // brows and nose on the surface
    const on = (x, y, lift) => [x, yc + y, surf(x, y) + 0.008 + lift];
    for (const s of [-1, 1]) {
      const pts = tragedy
        ? [[s * 0.02, 0.086], [s * 0.05, 0.077], [s * 0.085, 0.06]]
        : [[s * 0.022, 0.068], [s * 0.052, 0.083], [s * 0.084, 0.07]];
      b.tube(pts.map(([x, y]) => on(x, y, 0.001)), 0.0042, { color: shade(col, -0.12), kind: "gloss", radial: 6, seg: 16 });
    }
    b.sphere(0.016, { at: on(0, -0.002, -0.006), scale: [0.75, 1.8, 0.8], color: col, kind: "gloss", seg: 14 });
    // stand
    b.lathe(smoothOpen([[0, 0], [0.05, 0], [0.052, 0.008], [0.044, 0.018], [0.02, 0.024], [0, 0.025]], 12),
      { at: [0, 0, -0.03], color: C.darkWood, kind: "gloss", seg: 24 });
    b.cyl(0.0075, 0.0075, yc - 0.02, { at: [0, (yc - 0.02) / 2 + 0.02, -0.03], color: C.brass, kind: "metal", seg: 10 });
  },
};

/** Soccer ball of radius R at the origin: 12 black pentagons and 20 white hexagons with dark seams. */
function soccer(b, R) {
  const t = (1 + Math.sqrt(5)) / 2;
  const V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1],
    [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((v) => new THREE.Vector3(...v).normalize());
  const edge = V[0].distanceTo(V[11]) * 1.01;
  const adj = V.map((a, i) => V.map((bb, j) => (i !== j && a.distanceTo(bb) < edge ? j : -1)).filter((j) => j >= 0));
  const third = (i, j) => V[i].clone().lerp(V[j], 1 / 3);
  const panels = [];
  V.forEach((v, i) => {
    const ring = adj[i].map((j) => third(i, j));
    const u = new THREE.Vector3().crossVectors(v, Math.abs(v.y) < 0.9 ? Y_AXIS : new THREE.Vector3(1, 0, 0)).normalize();
    const w = new THREE.Vector3().crossVectors(v, u);
    ring.sort((a, c) => Math.atan2(a.dot(w), a.dot(u)) - Math.atan2(c.dot(w), c.dot(u)));
    panels.push({ pts: ring, color: "#26282d" });
  });
  for (let i = 0; i < 12; i++) for (const j of adj[i]) for (const k of adj[i]) {
    if (!(i < j && j < k) || !adj[j].includes(k)) continue;
    let pts = [third(i, j), third(j, i), third(j, k), third(k, j), third(k, i), third(i, k)];
    const c = pts.reduce((s, q) => s.add(q), new THREE.Vector3()).normalize();
    const u = pts[0].clone().sub(c.clone().multiplyScalar(pts[0].dot(c))).normalize(), w = new THREE.Vector3().crossVectors(c, u);
    pts.sort((a, d) => Math.atan2(a.dot(w), a.dot(u)) - Math.atan2(d.dot(w), d.dot(u)));
    panels.push({ pts, color: "#f6f4ee" });
  }
  b.sphere(R * 0.985, { color: "#3a3d44", seg: 20 });
  const rings = 3;
  for (const { pts, color } of panels) {
    const c = pts.reduce((s, q) => s.clone().add(q), new THREE.Vector3()).divideScalar(pts.length);
    const shrunk = pts.map((q) => c.clone().lerp(q, 0.955));
    const pos = [];
    const P = (a, bb, m) => {
      const q0 = shrunk[m], q1 = shrunk[(m + 1) % shrunk.length];
      const q = c.clone().addScaledVector(q0.clone().sub(c), a / rings).addScaledVector(q1.clone().sub(q0), bb / rings);
      const rr = R * (1 + 0.018 * (1 - (a / rings) ** 2));
      return q.normalize().multiplyScalar(rr).toArray();
    };
    for (let m = 0; m < shrunk.length; m++) {
      for (let a = 0; a < rings; a++) {
        for (let bb = 0; bb <= a; bb++) {
          pos.push(...P(a, bb, m), ...P(a + 1, bb, m), ...P(a + 1, bb + 1, m));
          if (bb < a) pos.push(...P(a, bb, m), ...P(a + 1, bb + 1, m), ...P(a, bb + 1, m));
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    // keep the winding facing outwards
    const A = new THREE.Vector3().fromArray(pos, 0), B = new THREE.Vector3().fromArray(pos, 3), Cc = new THREE.Vector3().fromArray(pos, 6);
    const nrm = new THREE.Vector3().subVectors(Cc, B).cross(new THREE.Vector3().subVectors(A, B));
    if (nrm.dot(A) < 0) {
      const arr = g.attributes.position.array;
      for (let i = 0; i < arr.length; i += 9) for (let k = 0; k < 3; k++) {
        const tmp = arr[i + 3 + k];
        arr[i + 3 + k] = arr[i + 6 + k];
        arr[i + 6 + k] = tmp;
      }
    }
    creaseNormals(g, 1.2);
    b.geo(g, { color, kind: "gloss" });
  }
}
