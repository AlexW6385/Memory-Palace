// Geometry primitives for architecture. Pure three.js core: runs in the browser and in Node
// (the baker and the plan checker build the same geometry the viewer shows).
//
// Every primitive returns a non-indexed BufferGeometry with `position` and `normal` only.
// Materials are procedural and work from world position, so no UVs are needed.

import { BufferGeometry, Float32BufferAttribute, Vector3, Matrix4 } from 'three';

const _a = new Vector3(), _b = new Vector3(), _c = new Vector3(), _n = new Vector3();

/** Build a geometry from a flat list of triangles (each 9 numbers) with flat normals. */
export function fromTriangles(tris) {
  const pos = new Float32Array(tris);
  const nor = new Float32Array(tris.length);
  for (let i = 0; i < tris.length; i += 9) {
    _a.set(tris[i], tris[i + 1], tris[i + 2]);
    _b.set(tris[i + 3], tris[i + 4], tris[i + 5]);
    _c.set(tris[i + 6], tris[i + 7], tris[i + 8]);
    _n.subVectors(_c, _b).cross(_a.clone().sub(_b)).normalize();
    for (let k = 0; k < 3; k++) { nor[i + 3 * k] = _n.x; nor[i + 3 * k + 1] = _n.y; nor[i + 3 * k + 2] = _n.z; }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  return g;
}

/** Push a quad (a b c d, counter-clockwise seen from outside) as two triangles. */
export function quad(out, a, b, c, d) {
  out.push(...a, ...b, ...c, ...a, ...c, ...d);
}

/** Axis-aligned box. */
export function box(x0, y0, z0, x1, y1, z1) {
  return frustum([x0, z0, x1, z1], y0, y1, 0, 0, 0, 0);
}

/**
 * A rectangular block whose four faces may lean inwards (Egyptian batter).
 * rect = [x0, z0, x1, z1] at the base; insets (metres at the top) for the faces at
 * -x, +x, -z, +z. With all insets 0 it is a box.
 */
export function frustum(rect, y0, y1, ixn, ixp, izn, izp, opts = {}) {
  const [x0, z0, x1, z1] = rect;
  const b = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]];
  const t = [[x0 + ixn, y1, z0 + izn], [x1 - ixp, y1, z0 + izn], [x1 - ixp, y1, z1 - izp], [x0 + ixn, y1, z1 - izp]];
  const out = [];
  if (!opts.noTop) quad(out, t[0], t[3], t[2], t[1]);
  if (!opts.noBottom) quad(out, b[0], b[1], b[2], b[3]);
  if (!opts.noZn) quad(out, b[0], t[0], t[1], b[1]);   // -z face
  if (!opts.noXp) quad(out, b[1], t[1], t[2], b[2]);   // +x face
  if (!opts.noZp) quad(out, b[2], t[2], t[3], b[3]);   // +z face
  if (!opts.noXn) quad(out, b[3], t[3], t[0], b[0]);   // -x face
  return fromTriangles(out);
}

/**
 * Surface of revolution about the y axis. profile = [[r, y], ...] bottom to top.
 * mod(theta, i, r, y) may return a radius multiplier for fluting, petals, palm fronds.
 * Smooth normals around, faceted along the profile (crisp mouldings).
 */
export function lathe(profile, segments = 32, mod = null, cx = 0, cy = 0, cz = 0) {
  const ring = [];
  for (let i = 0; i < profile.length; i++) {
    const [r, y] = profile[i];
    const row = [];
    for (let s = 0; s <= segments; s++) {
      const th = (s / segments) * Math.PI * 2;
      const k = mod ? mod(th, i, r, y) : 1;
      row.push([cx + Math.cos(th) * r * k, cy + y, cz + Math.sin(th) * r * k]);
    }
    ring.push(row);
  }
  const pos = [], nor = [];
  const v = new Vector3(), u = new Vector3(), w = new Vector3();
  // per-vertex normals by averaging the adjacent faces of each row pair
  for (let i = 0; i < ring.length - 1; i++) {
    const A = ring[i], B = ring[i + 1];
    const nrm = [];
    for (let s = 0; s <= segments; s++) {
      const sp = s === 0 ? segments - 1 : s - 1, sn = s === segments ? 1 : s + 1;
      u.set(A[sn][0] - A[sp][0], A[sn][1] - A[sp][1], A[sn][2] - A[sp][2]);
      const up = [(B[s][0] - A[s][0]), (B[s][1] - A[s][1]), (B[s][2] - A[s][2])];
      v.set(up[0], up[1], up[2]);
      w.crossVectors(v, u).normalize();
      if (!Number.isFinite(w.x)) w.set(0, 1, 0);
      nrm.push([w.x, w.y, w.z]);
    }
    for (let s = 0; s < segments; s++) {
      const a = A[s], b = A[s + 1], c = B[s + 1], d = B[s];
      const na = nrm[s], nb = nrm[s + 1];
      pos.push(...a, ...c, ...b, ...a, ...d, ...c);
      nor.push(...na, ...nb, ...nb, ...na, ...na, ...nb);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  return g;
}

/** A flat disc (cap) at height y. */
export function disc(r, y, segments = 32, cx = 0, cz = 0, up = true) {
  const out = [];
  for (let s = 0; s < segments; s++) {
    const a0 = (s / segments) * Math.PI * 2, a1 = ((s + 1) / segments) * Math.PI * 2;
    const p0 = [cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r];
    const p1 = [cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r];
    if (up) out.push(cx, y, cz, ...p1, ...p0); else out.push(cx, y, cz, ...p0, ...p1);
  }
  return fromTriangles(out);
}

/**
 * Sweep a 2D profile along a polyline in plan at a given height (mouldings, cornices).
 * profile = [[u, v], ...] where u points outward (to the right of the path direction when
 * the path runs counter-clockwise seen from above, i.e. away from the enclosed area) and v up.
 * path = [[x, z], ...]; closed joins the ends. Corners are mitred.
 */
export function sweep(profile, path, y, closed = true) {
  const n = path.length;
  const frames = [];
  for (let i = 0; i < n; i++) {
    const p = path[i];
    const prev = path[(i - 1 + n) % n], next = path[(i + 1) % n];
    let d0, d1;
    if (!closed && i === 0) { d0 = d1 = norm2(sub2(next, p)); }
    else if (!closed && i === n - 1) { d0 = d1 = norm2(sub2(p, prev)); }
    else { d0 = norm2(sub2(p, prev)); d1 = norm2(sub2(next, p)); }
    // outward normals (to the right of travel): (dz, -dx)
    const o0 = [d0[1], -d0[0]], o1 = [d1[1], -d1[0]];
    let m = norm2([o0[0] + o1[0], o0[1] + o1[1]]);
    const cos = m[0] * o1[0] + m[1] * o1[1];
    const scale = 1 / Math.max(cos, 0.2);
    frames.push({ p, m: [m[0] * scale, m[1] * scale] });
  }
  const rings = frames.map(({ p, m }) => profile.map(([u, v]) => [p[0] + m[0] * u, y + v, p[1] + m[1] * u]));
  const out = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const A = rings[i], B = rings[(i + 1) % n];
    for (let k = 0; k < profile.length - 1; k++) {
      quad(out, A[k], A[k + 1], B[k + 1], B[k]);
    }
  }
  return fromTriangles(out);
}

/** Cylinder between two points (rolls, poles, beams of round section). */
export function rod(a, b, r, segments = 12) {
  const A = new Vector3(...a), B = new Vector3(...b);
  const len = A.distanceTo(B);
  const g = lathe([[r, 0], [r, len]], segments);
  const dir = B.clone().sub(A).normalize();
  const m = new Matrix4();
  const up = new Vector3(0, 1, 0);
  const axis = up.clone().cross(dir);
  const ang = Math.acos(Math.min(1, Math.max(-1, up.dot(dir))));
  if (axis.lengthSq() < 1e-9) { if (dir.y < 0) m.makeRotationX(Math.PI); }
  else m.makeRotationAxis(axis.normalize(), ang);
  m.setPosition(A);
  g.applyMatrix4(m);
  return g;
}

/** Translate / rotate-about-y helper (returns the same geometry). */
export function place(g, x = 0, y = 0, z = 0, yaw = 0, s = 1) {
  const m = new Matrix4().makeRotationY(yaw);
  if (s !== 1) m.multiply(new Matrix4().makeScale(s, s, s));
  m.setPosition(x, y, z);
  g.applyMatrix4(m);
  return g;
}

function sub2(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
function norm2(a) { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; }

/** Collects geometries by material key and merges them. */
export class GeoBag {
  constructor() { this.parts = new Map(); }
  add(mat, g) {
    if (!g) return;
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g.index ? g.toNonIndexed() : g);
  }
  /** Merge into one geometry per material. */
  merged() {
    const res = [];
    for (const [mat, list] of this.parts) {
      let count = 0;
      for (const g of list) count += g.attributes.position.count;
      const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
      let o = 0;
      for (const g of list) {
        pos.set(g.attributes.position.array, o);
        nor.set(g.attributes.normal.array, o);
        o += g.attributes.position.array.length;
      }
      const m = new BufferGeometry();
      m.setAttribute('position', new Float32BufferAttribute(pos, 3));
      m.setAttribute('normal', new Float32BufferAttribute(nor, 3));
      m.computeBoundingBox(); m.computeBoundingSphere();
      res.push({ mat, geometry: m });
    }
    return res;
  }
}
