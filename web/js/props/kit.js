// Modelling kit for props: a small immediate-mode builder over three.js geometry.
//
// A prop builder is a function (b, p) => void that adds parts to the Builder b
// using metres, with the prop standing on y = 0, centred on x/z, facing +z.
// Parts carry a vertex colour and a material kind; everything of one kind is
// later merged into a single mesh, so a whole exhibit costs a handful of draw
// calls. Text and emoji become separate textured planes ("decals").
//
// Runs in the browser and in node (tests): no DOM access here. Text textures
// come from env.texture(...) which the browser provides.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export const KINDS = ["matte", "gloss", "metal", "glow", "glass"];

// ── palette ──────────────────────────────────────────────────────────────────
export const C = {
  white: "#f4f1ea", ivory: "#efe6d2", paper: "#f7f2e6", black: "#22252b", ink: "#2b2f38", charcoal: "#3a3d44",
  grey: "#8d9097", silver: "#c8ccd2", steel: "#9aa3ad", iron: "#5d636b",
  gold: "#d4a548", brass: "#c8a050", copper: "#b8734a", bronze: "#9c6b3c",
  wood: "#a7774c", darkWood: "#6b4a30", lightWood: "#d1aa78", bark: "#6e5236",
  stone: "#bdb6a8", marble: "#ece7de", sand: "#dcc79a", clay: "#c8714f", brick: "#a5533b",
  red: "#d0483c", crimson: "#a5243a", orange: "#e38b3a", yellow: "#f0c64a", lime: "#a5c94a",
  green: "#4f9a58", leaf: "#5f9e4a", darkLeaf: "#3f7a3a", teal: "#2f9a95", sky: "#7fb6e0",
  blue: "#3f74c4", navy: "#25386b", purple: "#7a55b8", pink: "#e58aa6", rose: "#d65f7d", brown: "#8a5a3a",
  water: "#4aa3c8", glass: "#cfe8ee", flame: "#ffb43a", flameCore: "#fff1a8",
  skin: ["#f2d0b4", "#e2b48f", "#c68f63", "#9a6a45", "#6e4a33"],
  hair: ["#2c241e", "#5a3a22", "#a8743c", "#d9b46b", "#b8b2a8", "#8a3b22"],
};

export function color(c) {
  if (c instanceof THREE.Color) return c;
  return new THREE.Color(c ?? "#ff00ff");
}

/** Lighten (amt > 0) or darken (amt < 0) a colour; amt in [-1, 1]. */
export function shade(c, amt) {
  const col = color(c).clone();
  const hsl = {};
  col.getHSL(hsl);
  col.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + amt)));
  return "#" + col.getHexString();
}

export function mix(a, b, t) {
  return "#" + color(a).clone().lerp(color(b), t).getHexString();
}

// ── deterministic randomness ─────────────────────────────────────────────────
export function rng(seed = 1) {
  let s = (Math.floor(seed) % 2147483647) || 1;
  if (s < 0) s += 2147483646;
  const next = () => (s = (s * 16807) % 2147483647) / 2147483647;
  next.range = (a, b) => a + (b - a) * next();
  next.pick = (arr) => arr[Math.floor(next() * arr.length) % arr.length];
  next.int = (a, b) => Math.floor(next.range(a, b + 1));
  return next;
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2147483646 + 1;
}

// ── builder ──────────────────────────────────────────────────────────────────
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

function localMatrix(o = {}) {
  const at = o.at || [0, 0, 0];
  const rot = o.rot || [0, 0, 0];
  let sc = o.scale ?? 1;
  if (typeof sc === "number") sc = [sc, sc, sc];
  _q.setFromEuler(_e.set(rot[0], rot[1], rot[2], o.order || "XYZ"));
  return new THREE.Matrix4().compose(_p.set(at[0], at[1], at[2]), _q, _s.set(sc[0], sc[1], sc[2]));
}

export class Builder {
  /**
   * @param {object} env  { texture?: (spec) => THREE.Texture|null, props?: registry, lang?: "en"|"zh", seed? }
   */
  constructor(env = {}) {
    this.env = env;
    this.lod = env.lod ?? 1; // < 1 builds coarser curves (used for mass scenery)
    this.parts = []; // { geo, kind }
    this.decals = []; // { spec, w, h, matrix, kind }
    this.lights = []; // { position: Vector3, color } glow halos for the renderer
    this.matrix = new THREE.Matrix4();
    this._stack = [];
    this.rng = rng(env.seed ?? 1);
  }

  // ── transforms ────────────────────────────────────────────────────────────
  /** Run fn with an extra transform: o = { at, rot, scale, order }. */
  group(o, fn) {
    this._stack.push(this.matrix.clone());
    this.matrix.multiply(localMatrix(o));
    try {
      fn(this);
    } finally {
      this.matrix = this._stack.pop();
    }
    return this;
  }

  /** Run fn twice: as is, and mirrored across x = 0 (for symmetric parts such as ears, legs, wings). */
  mirrorX(fn) {
    fn(this, 1);
    this._stack.push(this.matrix.clone());
    this.matrix.multiply(new THREE.Matrix4().makeScale(-1, 1, 1));
    try {
      fn(this, -1);
    } finally {
      this.matrix = this._stack.pop();
    }
    return this;
  }

  // ── core ──────────────────────────────────────────────────────────────────
  /** Add any BufferGeometry. o: { at, rot, scale, color, kind: "matte"|"gloss"|"metal"|"glow"|"glass", flat } */
  geo(geometry, o = {}) {
    let g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    for (const name of Object.keys(g.attributes)) {
      if (name !== "position" && name !== "normal") g.deleteAttribute(name);
    }
    const m = new THREE.Matrix4().multiplyMatrices(this.matrix, localMatrix(o));
    g.applyMatrix4(m);
    if (m.determinant() < 0) {
      // a reflection flips triangle winding: swap two corners of every triangle
      for (const attr of [g.attributes.position, g.attributes.normal]) {
        if (!attr) continue;
        for (let i = 0; i < attr.count; i += 3) {
          for (let k = 0; k < 3; k++) {
            const t = attr.getComponent(i + 1, k);
            attr.setComponent(i + 1, k, attr.getComponent(i + 2, k));
            attr.setComponent(i + 2, k, t);
          }
        }
      }
    }
    if (o.flat && g.attributes.normal) g.deleteAttribute("normal");
    if (!g.attributes.normal) g.computeVertexNormals();
    const c = color(o.color);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    const kind = KINDS.includes(o.kind) ? o.kind : "matte";
    this.parts.push({ geo: g, kind });
    if (kind === "glow" && o.light !== false) {
      g.computeBoundingSphere();
      this.lights.push({ position: g.boundingSphere.center.clone(), color: "#" + c.getHexString(),
        radius: g.boundingSphere.radius });
    }
    return this;
  }

  // ── primitives (o.at is the centre unless stated) ──────────────────────────
  /** Segment count scaled by the level of detail (never raises a deliberately low count). */
  seg(n, min = 3) {
    return this.lod >= 1 ? n : Math.max(Math.min(min, n), Math.round(n * this.lod));
  }

  /** Box w×h×d; o.r = bevel radius (default ≈ 12% of the smallest side, 0 for sharp). */
  box(w, h, d, o = {}) {
    const r = this.lod < 1 ? 0 : o.r ?? Math.min(w, h, d) * 0.12;
    const g = r > 0.002
      ? new RoundedBoxGeometry(w, h, d, o.seg ?? 2, Math.min(r, Math.min(w, h, d) / 2 - 1e-4))
      : new THREE.BoxGeometry(w, h, d);
    return this.geo(g, o);
  }

  /** Cylinder (cone when one radius is 0); o.seg segments (default 20), o.open for no caps. */
  cyl(rTop, rBot, h, o = {}) {
    return this.geo(new THREE.CylinderGeometry(rTop, rBot, h, this.seg(o.seg ?? 20, 5), 1, !!o.open,
      o.thetaStart ?? 0, o.thetaLength ?? Math.PI * 2), o);
  }

  cone(r, h, o = {}) {
    return this.cyl(0, r, h, o);
  }

  /** Sphere; o.seg (default 20); o.scale for ellipsoids; o.phi/o.theta for partial spheres. */
  sphere(r, o = {}) {
    const seg = this.seg(o.seg ?? 20, 6);
    return this.geo(new THREE.SphereGeometry(r, seg, Math.max(this.lod < 1 ? 4 : 6, Math.round(seg * 0.7)),
      0, o.phiLength ?? Math.PI * 2, 0, o.thetaLength ?? Math.PI), o);
  }

  /** Low-poly ball (icosahedron); detail 0-2; faceted by default. */
  ico(r, o = {}) {
    const detail = this.lod < 1 ? Math.max(0, (o.detail ?? 1) - 1) : o.detail ?? 1;
    return this.geo(new THREE.IcosahedronGeometry(r, detail), { flat: true, ...o });
  }

  /** Capsule along y: radius r, straight length len (total height len + 2r). */
  capsule(r, len, o = {}) {
    return this.geo(new THREE.CapsuleGeometry(r, len, this.seg(o.capSeg ?? 4, 2), this.seg(o.seg ?? 12, 5)), o);
  }

  /** Torus in the xy plane (axis along z); o.arc for a partial ring. */
  torus(R, r, o = {}) {
    return this.geo(new THREE.TorusGeometry(R, r, this.seg(o.tubeSeg ?? 10, 4), this.seg(o.seg ?? 28, 8), o.arc ?? Math.PI * 2), o);
  }

  /** Lathe around y from [[radius, y], ...] points (bottom to top). */
  lathe(points, o = {}) {
    const pts = points.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
    return this.geo(new THREE.LatheGeometry(pts, this.seg(o.seg ?? 24, 6)), o);
  }

  /** Extrude a 2D shape (THREE.Shape or [[x, y], ...]) along +z by depth, centred on z = 0. */
  extrude(shape, depth, o = {}) {
    const s = Array.isArray(shape) ? new THREE.Shape(shape.map(([x, y]) => new THREE.Vector2(x, y))) : shape;
    const bevel = o.bevel ?? Math.min(0.01, depth * 0.2);
    const g = new THREE.ExtrudeGeometry(s, {
      depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1,
      curveSegments: o.curveSeg ?? 10,
    });
    g.translate(0, 0, -depth / 2);
    return this.geo(g, o);
  }

  /** Tube along points [[x, y, z], ...] with radius r; o.closed; o.curve = "catmull" (default) or "line". */
  tube(points, r, o = {}) {
    const v = points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const curve = o.curve === "line" ? new THREE.CurvePath() : new THREE.CatmullRomCurve3(v, !!o.closed);
    if (o.curve === "line") for (let i = 0; i < v.length - 1; i++) curve.add(new THREE.LineCurve3(v[i], v[i + 1]));
    const g = new THREE.TubeGeometry(curve, this.seg(o.seg ?? Math.max(8, points.length * 8), 4), r, this.seg(o.radial ?? 8, 4), !!o.closed);
    return this.geo(g, o);
  }

  /** A straight rod between two points with radius r (cylinder). */
  rod(a, b, r, o = {}) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    const g = new THREE.CylinderGeometry(o.r2 ?? r, r, len, this.seg(o.seg ?? 8, 4));
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    g.applyQuaternion(q);
    g.translate(A.x, A.y, A.z);
    return this.geo(g, { ...o, at: undefined, rot: undefined, scale: undefined });
  }

  /** Flat disc in the xz plane (facing up) at o.at. */
  disc(r, o = {}) {
    const g = new THREE.CircleGeometry(r, this.seg(o.seg ?? 24, 6));
    g.rotateX(-Math.PI / 2);
    return this.geo(g, o);
  }

  /** Flat rectangle facing +z (a panel), centred at o.at. Use o.rot to orient. */
  panel(w, h, o = {}) {
    return this.geo(new THREE.PlaneGeometry(w, h), o);
  }

  // ── text & emoji decals ───────────────────────────────────────────────────
  /**
   * A textured plane showing text (facing +z), centred at o.at.
   * o: { w, h, fg, bg, font: "display"|"body"|"mono"|"chalk"|"hand", align, double, glow }
   * text may be a string or { en, zh }; the builder picks env.lang.
   */
  text(text, o = {}) {
    const str = typeof text === "string" ? text : (text?.[this.env.lang || "en"] ?? text?.en ?? "");
    const w = o.w ?? 0.4, h = o.h ?? 0.2;
    const m = new THREE.Matrix4().multiplyMatrices(this.matrix, localMatrix(o));
    this.decals.push({ spec: { type: "text", text: str, w, h, fg: o.fg, bg: o.bg, font: o.font, align: o.align,
      lines: o.lines, weight: o.weight }, w, h, matrix: m, double: !!o.double, glow: !!o.glow });
    return this;
  }

  /** A textured plane showing an emoji, centred at o.at; o.size (metres). */
  emoji(char, o = {}) {
    const s = o.size ?? 0.3;
    const m = new THREE.Matrix4().multiplyMatrices(this.matrix, localMatrix(o));
    this.decals.push({ spec: { type: "emoji", text: char }, w: s, h: s, matrix: m, double: !!o.double });
    return this;
  }

  // ── nesting ───────────────────────────────────────────────────────────────
  /** Build another prop inside this one (e.g. an item held in a hand). o: { at, rot, scale } */
  prop(name, params = {}, o = {}) {
    const reg = this.env.props;
    const fn = reg?.[name];
    if (!fn) return this;
    this.group(o, () => fn(this, { ...params }));
    return this;
  }
}

// ── materials & assembly ─────────────────────────────────────────────────────
let MATERIALS = null;
export function materials() {
  if (MATERIALS) return MATERIALS;
  MATERIALS = {
    matte: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, envMapIntensity: 0.55 }),
    gloss: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0, envMapIntensity: 0.8 }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.85, envMapIntensity: 1 }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
    glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0, transparent: true,
      opacity: 0.42, depthWrite: false }),
  };
  return MATERIALS;
}

/**
 * Turn a builder's parts into one merged geometry per material kind.
 * Returns { geos: { kind: BufferGeometry }, decals, lights }.
 */
export function bake(b, mergeGeometries) {
  const byKind = {};
  for (const p of b.parts) (byKind[p.kind] ||= []).push(p.geo);
  const geos = {};
  for (const [kind, list] of Object.entries(byKind)) {
    geos[kind] = list.length === 1 ? list[0] : mergeGeometries(list, false);
    if (list.length > 1) list.forEach((g) => g.dispose());
  }
  return { geos, decals: b.decals, lights: b.lights };
}

/** Bounding box of everything a builder produced (parts and decals). */
export function measure(b) {
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  for (const p of b.parts) {
    p.geo.computeBoundingBox();
    box.union(p.geo.boundingBox);
  }
  for (const d of b.decals) {
    tmp.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(d.w, d.h, 0.001)).applyMatrix4(d.matrix);
    box.union(tmp);
  }
  return box;
}
