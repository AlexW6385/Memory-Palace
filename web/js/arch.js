// Architecture: turns world.json prims into geometry.
//
// Plain parts go through the prop kit's Builder (vertex colours, merged per
// material kind). Patterned surfaces (floors, walls, ramps) become UV-mapped
// geometry grouped by texture. Everything lands in a Chunk, which merges what
// it holds into a handful of meshes.
import * as THREE from "three";
import { Builder, shade, mix } from "./props/kit.js";
import { floorTexture, wallTexture } from "./textures.js";

const TAU = Math.PI * 2;

// ── textured geometry helpers ────────────────────────────────────────────────
/** Box with UVs in metres (divided by the tile size); v starts at the box bottom on vertical faces. */
export function boxUV(w, h, d, tu, tv) {
  const g = new THREE.BoxGeometry(w, h, d);
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i) + h / 2, z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    if (ny > 0.5) uv.setXY(i, x / tu, z / tv);
    else if (nx > 0.5) uv.setXY(i, (z + d / 2) / tu, y / tv);
    else uv.setXY(i, (x + w / 2) / tu, y / tv);
  }
  return g;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);

function placeMatrix(x, y, z, yaw = 0, pitch = 0) {
  const e = new THREE.Euler(pitch, yaw, 0, "YXZ");
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q.setFromEuler(e), new THREE.Vector3(1, 1, 1));
}

// ── materials shared by all chunks ───────────────────────────────────────────
const MATS = new Map();

export function surfaceMaterial(key, make) {
  let m = MATS.get(key);
  if (!m) MATS.set(key, (m = make()));
  return m;
}

const FLOOR_FINISH = {
  marble: { roughness: 0.32 }, terrazzo: { roughness: 0.5 }, checker: { roughness: 0.45 }, tiles: { roughness: 0.5 },
  metal: { roughness: 0.42, metalness: 0.55 }, grid_glow: { roughness: 0.6, glow: 0.9 }, starfield: { roughness: 0.5, glow: 0.35 },
};

function floorMaterial(pattern, colors) {
  const { map, tile, glow } = floorTexture(pattern, colors);
  const key = `floor|${pattern}|${colors.join(",")}`;
  const mat = surfaceMaterial(key, () => {
    const f = FLOOR_FINISH[pattern] || {};
    const m = new THREE.MeshStandardMaterial({ map, roughness: f.roughness ?? 0.88, metalness: f.metalness ?? 0,
      envMapIntensity: 0.6 });
    if (glow) {
      m.emissive = new THREE.Color("#ffffff");
      m.emissiveMap = map;
      m.emissiveIntensity = f.glow ?? 0.5;
    }
    return m;
  });
  return { key, mat, tile };
}

const WALL_FINISH = {
  wood_panel: { roughness: 0.62 }, metal: { roughness: 0.45, metalness: 0.5 }, shelves: { roughness: 0.85 },
  curtain: { roughness: 1, side: THREE.DoubleSide }, hedge: { roughness: 1 },
};

function wallMaterial(style, color, color2) {
  const t = wallTexture(style, color, color2);
  if (!t) return null;
  const key = `wall|${style}|${color}|${color2 || ""}`;
  const mat = surfaceMaterial(key, () => {
    const f = WALL_FINISH[style] || {};
    return new THREE.MeshStandardMaterial({ map: t.map, roughness: f.roughness ?? 0.92, metalness: f.metalness ?? 0,
      side: f.side ?? THREE.FrontSide, envMapIntensity: 0.5 });
  });
  return { key, mat, tile: t.tile };
}

export const SPECIAL = {
  glass: () => surfaceMaterial("glass-pane", () => new THREE.MeshStandardMaterial({ color: "#d6eef2", roughness: 0.05,
    metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.2 })),
  mirror: () => surfaceMaterial("mirror", () => new THREE.MeshStandardMaterial({ color: "#e9eef2", roughness: 0.03,
    metalness: 1, envMapIntensity: 1.4 })),
  water: (c) => surfaceMaterial("water|" + c, () => new THREE.MeshStandardMaterial({ color: c, roughness: 0.06,
    metalness: 0.2, transparent: true, opacity: 0.86, envMapIntensity: 1.3 })),
};

// roofs are seen from below as well as above
let DOUBLE = null;
function doubleSided(mats) {
  if (DOUBLE) return DOUBLE;
  DOUBLE = {};
  for (const [k, m] of Object.entries(mats)) {
    DOUBLE[k] = m.clone();
    DOUBLE[k].side = THREE.DoubleSide;
  }
  return DOUBLE;
}

// ── chunk ────────────────────────────────────────────────────────────────────
/** A square of the world whose static geometry is merged and shown/hidden together. */
export class Chunk {
  constructor(i, j, size) {
    this.i = i;
    this.j = j;
    this.center = new THREE.Vector3((i + 0.5) * size, 0, (j + 0.5) * size);
    this.group = new THREE.Group();
    this.group.name = `chunk ${i},${j}`;
    this.solid = new Builder({});     // casts shadows
    this.light = new Builder({});     // roofs and canopies: no shadows, so interiors stay lit
    this.surfaces = new Map();        // material key → { mat, geos: [] }
    this.maxY = 0;
    this.extra = [];                  // objects added directly
  }

  surface(key, mat, geo, { shadow = true } = {}) {
    const k = key + (shadow ? "" : "|ns");
    let s = this.surfaces.get(k);
    if (!s) this.surfaces.set(k, (s = { mat, geos: [], shadow }));
    s.geos.push(geo.index ? geo.toNonIndexed() : geo);
  }

  finish(mergeGeometries, kitMaterials, bake) {
    for (const [b, shadow] of [[this.solid, true], [this.light, false]]) {
      if (!b.parts.length) continue;
      const { geos } = bake(b, mergeGeometries);
      const mats = shadow ? kitMaterials : doubleSided(kitMaterials);
      for (const [kind, geo] of Object.entries(geos)) {
        const mesh = new THREE.Mesh(geo, mats[kind]);
        mesh.castShadow = shadow && kind !== "glow" && kind !== "glass";
        mesh.receiveShadow = kind !== "glow";
        mesh.matrixAutoUpdate = false;
        this.group.add(mesh);
      }
    }
    for (const s of this.surfaces.values()) {
      for (const g of s.geos) if (g.attributes.color) g.deleteAttribute("color");
      const geo = s.geos.length === 1 ? s.geos[0] : mergeGeometries(s.geos, false);
      s.geos.forEach((g) => g !== geo && g.dispose());
      const mesh = new THREE.Mesh(geo, s.mat);
      mesh.castShadow = s.shadow && !s.mat.transparent;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
    }
    this.surfaces.clear();
    this.solid = this.light = null;
    for (const o of this.extra) this.group.add(o);
  }
}

// ── supports ─────────────────────────────────────────────────────────────────
/** Draw one support of a style standing at the builder origin, h tall, radius r. */
export function support(b, style, h, r, c) {
  const dark = shade(c, -0.08), light = shade(c, 0.05);
  switch (style) {
    case "classic_column": {
      b.box(r * 2.6, 0.2, r * 2.6, { at: [0, 0.1, 0], color: dark, r: 0.02 });
      b.cyl(r * 1.12, r * 1.22, 0.16, { at: [0, 0.28, 0], color: c, seg: 24 });
      const sh = h - 0.78;
      b.cyl(r * 0.86, r, sh, { at: [0, 0.36 + sh / 2, 0], color: c, seg: 18, flat: true });
      b.cyl(r * 1.25, r * 0.88, 0.18, { at: [0, h - 0.33, 0], color: light, seg: 24 });
      b.box(r * 2.5, 0.16, r * 2.5, { at: [0, h - 0.12, 0], color: dark, r: 0.02 });
      return;
    }
    case "round_column": {
      b.cyl(r * 1.25, r * 1.3, 0.22, { at: [0, 0.11, 0], color: dark, seg: 24 });
      b.cyl(r, r, h - 0.44, { at: [0, h / 2, 0], color: c, seg: 24 });
      b.cyl(r * 1.3, r * 1.1, 0.22, { at: [0, h - 0.11, 0], color: dark, seg: 24 });
      return;
    }
    case "square_pillar": {
      b.box(r * 2.3, 0.18, r * 2.3, { at: [0, 0.09, 0], color: dark, r: 0.02 });
      b.box(r * 2, h - 0.36, r * 2, { at: [0, h / 2, 0], color: c, r: 0.03 });
      b.box(r * 2.3, 0.18, r * 2.3, { at: [0, h - 0.09, 0], color: dark, r: 0.02 });
      return;
    }
    case "wood_post": {
      const s = r * 1.4;
      b.box(s, h, s, { at: [0, h / 2, 0], color: c, r: 0.015 });
      b.box(s * 1.5, 0.12, s * 1.5, { at: [0, 0.06, 0], color: dark, r: 0.01 });
      // knee braces
      for (const sgn of [-1, 1]) {
        b.group({ at: [sgn * 0.26, h - 0.4, 0], rot: [0, 0, -sgn * 0.66] }, () => b.box(0.08, 0.62, 0.08, { color: dark, r: 0.01 }));
      }
      b.box(s * 2.6, 0.16, s * 1.2, { at: [0, h - 0.08, 0], color: dark, r: 0.01 });
      return;
    }
    case "iron_column": {
      const rr = Math.max(0.09, r * 0.45);
      b.cyl(rr * 2.2, rr * 2.6, 0.35, { at: [0, 0.175, 0], color: dark, seg: 12, kind: "metal" });
      b.cyl(rr, rr * 1.15, h - 0.9, { at: [0, 0.35 + (h - 0.9) / 2, 0], color: c, seg: 12, kind: "metal" });
      b.cyl(rr * 2.6, rr, 0.55, { at: [0, h - 0.28, 0], color: c, seg: 12, kind: "metal" });
      b.torus(rr * 1.6, 0.03, { at: [0, h - 0.5, 0], rot: [Math.PI / 2, 0, 0], color: shade(c, 0.12), kind: "metal" });
      return;
    }
    case "glass_mullion": {
      b.box(0.12, h, 0.12, { at: [0, h / 2, 0], color: c, kind: "metal", r: 0 });
      return;
    }
    case "gothic_pier": {
      b.box(r * 2.4, 0.3, r * 2.4, { at: [0, 0.15, 0], color: dark, r: 0.02 });
      b.cyl(r * 0.75, r * 0.75, h - 0.6, { at: [0, h / 2, 0], color: c, seg: 12 });
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + Math.PI / 4;
        b.cyl(r * 0.32, r * 0.32, h - 0.6, { at: [Math.sin(a) * r * 0.72, h / 2, Math.cos(a) * r * 0.72], color: light, seg: 8 });
      }
      b.cyl(r * 1.3, r * 0.9, 0.3, { at: [0, h - 0.15, 0], color: dark, seg: 12 });
      return;
    }
    case "steel_beam": {
      const w = r * 1.6;
      b.box(w, h, 0.05, { at: [0, h / 2, 0], color: c, kind: "metal", r: 0 });
      for (const s of [-1, 1]) b.box(0.06, h, w * 0.9, { at: [s * w / 2, h / 2, 0], color: c, kind: "metal", r: 0 });
      b.box(w * 1.6, 0.06, w * 1.6, { at: [0, 0.03, 0], color: dark, kind: "metal", r: 0 });
      return;
    }
    case "stone_post":
    default: {
      b.box(r * 2, h - 0.2, r * 2, { at: [0, (h - 0.2) / 2, 0], color: c, r: 0.04 });
      b.box(r * 2.4, 0.2, r * 2.4, { at: [0, h - 0.1, 0], color: dark, r: 0.04 });
    }
  }
}

export function addSupport(ch, p) {
  ch.solid.group({ at: p.p }, (b) => support(b, p.st, p.h, p.rad, p.c));
  ch.maxY = Math.max(ch.maxY, p.p[1] + p.h);
}

// ── arches (entrance frames) ─────────────────────────────────────────────────
export function addArch(ch, p) {
  const [x, y, z] = p.p;
  const { w, h, post } = p;
  const c = p.c;
  ch.solid.group({ at: [x, y, z], rot: [0, p.r, 0] }, (b) => {
    for (const s of [-1, 1]) b.group({ at: [s * w / 2, 0, 0] }, () => support(b, p.st, h, post, c));
    const beamH = Math.max(0.35, post * 1.1);
    const curved = w <= 8 && ["classic_column", "round_column", "gothic_pier", "stone_post"].includes(p.st);
    if (curved) {
      const R = w / 2;
      b.torus(R, post * 0.55, { at: [0, h, 0], color: c, arc: Math.PI, seg: 24, tubeSeg: 8 });
      b.box(post * 1.2, post * 1.4, post * 1.4, { at: [0, h + R, 0], color: shade(c, -0.1) });
    } else {
      b.box(w + post * 2.6, beamH, post * 2.2, { at: [0, h + beamH / 2, 0], color: c, r: 0.03 });
      b.box(w + post * 3.2, 0.12, post * 2.6, { at: [0, h + beamH + 0.06, 0], color: shade(c, -0.12), r: 0.02 });
    }
  });
  ch.maxY = Math.max(ch.maxY, y + h + w / 2);
}

// ── floors, paths, ramps ─────────────────────────────────────────────────────
export function addFloor(ch, p) {
  const [x, y, z] = p.p;
  const th = Math.max(0.06, p.th ?? 0.3);
  const { key, mat, tile } = floorMaterial(p.pat, p.cols);
  const g = boxUV(p.w, th, p.d, tile, tile);
  g.applyMatrix4(placeMatrix(x, y - th / 2, z, p.r));
  ch.surface(key, mat, g);
}

export function addDisc(ch, p) {
  const [x, y, z] = p.p;
  const th = Math.max(0.06, p.th ?? 0.3);
  const { key, mat, tile } = floorMaterial(p.pat, p.cols);
  const seg = Math.max(32, Math.round(p.r1 * 3));
  let g;
  if (p.r0 > 0.01) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, p.r1, 0, TAU, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, p.r0, 0, TAU, true);
    shape.holes.push(hole);
    g = new THREE.ExtrudeGeometry(shape, { depth: th, bevelEnabled: false, curveSegments: seg });
    g.rotateX(-Math.PI / 2);
  } else {
    g = new THREE.CylinderGeometry(p.r1, p.r1, th, seg);
    g.translate(0, th / 2, 0);
  }
  planarUV(g, tile);
  g.translate(x, y - th, z);
  ch.surface(key, mat, g);
}

/** Top-down UVs from x/z (in metres / tile); vertical faces use the larger horizontal axis and y. */
function planarUV(g, tile) {
  const pos = g.attributes.position, nor = g.attributes.normal;
  let uv = g.attributes.uv;
  if (!uv) g.setAttribute("uv", (uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2)));
  for (let i = 0; i < pos.count; i++) {
    const ny = Math.abs(nor.getY(i));
    if (ny > 0.5) uv.setXY(i, pos.getX(i) / tile, pos.getZ(i) / tile);
    else uv.setXY(i, (pos.getX(i) + pos.getZ(i)) / tile, pos.getY(i) / tile);
  }
}

export function addPath(ch, p) {
  const [x, y, z] = p.p;
  const cols = [p.c, shade(p.c, -0.07)];
  const { key, mat, tile } = floorMaterial(p.pat || "slabs", cols);
  const th = 0.06;
  const g = boxUV(p.w, th, p.d, tile, tile);
  g.applyMatrix4(placeMatrix(x, y - th / 2 + 0.01, z, p.r));
  ch.surface(key, mat, g);
}

export function addRamp(ch, p) {
  const [x, z] = p.p;
  const dy = p.y1 - p.y0;
  const len = Math.hypot(p.d, dy);
  const pitch = -Math.atan2(dy, p.d);
  const th = p.th ?? 0.5;
  const { key, mat, tile } = floorMaterial(p.pat, p.cols);
  const g = boxUV(p.w, th, len, tile, tile);
  g.translate(0, -th / 2, 0);
  g.applyMatrix4(placeMatrix(x, (p.y0 + p.y1) / 2, z, p.r, pitch));
  ch.surface(key, mat, g);
  // low curbs along both edges
  ch.solid.group({ at: [x, (p.y0 + p.y1) / 2, z], rot: [pitch, p.r, 0], order: "YXZ" }, (b) => {
    for (const s of [-1, 1]) b.box(0.22, 0.32, len, { at: [s * (p.w / 2 - 0.11), 0.12, 0], color: shade(p.cols[0], -0.12), r: 0.03 });
  });
}

/** Spiral walkway: one ribbon per segment (pattern), plus a railing on the outer edge. */
export function addHelix(ch, p) {
  const [cx, cz] = p.c;
  const th = p.th ?? 0.6;
  const height = (a) => p.y0 + p.pitch * (a - p.a0) / TAU;
  for (const s of p.segs) {
    const { key, mat, tile } = floorMaterial(s.pat, s.cols);
    const n = Math.max(2, Math.ceil((s.a1 - s.a0) / (Math.PI / 90)));
    const pos = [], uv = [], idx = [];
    const rings = [p.r0, p.r1];
    const rm = (p.r0 + p.r1) / 2;
    // 4 vertices per step: top inner, top outer, bottom outer, bottom inner (duplicated per face for normals)
    const faces = [
      { a: 0, b: 1, ya: 0, yb: 0 }, // top
      { a: 1, b: 0, ya: -th, yb: -th }, // bottom
      { a: 1, b: 1, ya: 0, yb: -th }, // outer side
      { a: 0, b: 0, ya: -th, yb: 0 }, // inner side
    ];
    for (const f of faces) {
      const base = pos.length / 3;
      for (let k = 0; k <= n; k++) {
        const a = s.a0 + (s.a1 - s.a0) * (k / n);
        const y = height(a);
        const sx = Math.sin(a), sz = -Math.cos(a);
        const ra = rings[f.a], rb = rings[f.b];
        pos.push(cx + sx * ra, y + f.ya, cz + sz * ra, cx + sx * rb, y + f.yb, cz + sz * rb);
        const u = (a * rm) / tile;
        if (f.ya === f.yb) uv.push(u, ra / tile, u, rb / tile);
        else uv.push(u, f.ya / tile, u, f.yb / tile);
      }
      for (let k = 0; k < n; k++) {
        const i0 = base + k * 2;
        idx.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    // make sure the top faces up: flip if the computed normal points down
    const ny = g.attributes.normal.getY(0);
    if (ny < 0) {
      const ix = g.index.array;
      for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; }
      g.computeVertexNormals();
    }
    ch.surface(key, mat, g);
  }
  // railing along the outer edge
  const total = p.sweep;
  const rail = p.rail || "#e2dbcd";
  const rr = p.r1 - 0.12;
  const steps = Math.ceil(total / (Math.PI / 60));
  const top = [];
  for (let k = 0; k <= steps; k++) {
    const a = p.a0 + total * (k / steps);
    top.push([cx + Math.sin(a) * rr, height(a) + 1.0, cz - Math.cos(a) * rr]);
    if (k % 4 === 0) {
      ch.solid.box(0.1, 1.0, 0.1, { at: [cx + Math.sin(a) * rr, height(a) + 0.5, cz - Math.cos(a) * rr], color: shade(rail, -0.1), r: 0 });
    }
  }
  for (let k = 0; k < top.length - 1; k += 24) {
    const part = top.slice(k, Math.min(top.length, k + 25));
    if (part.length > 1) ch.solid.tube(part, 0.05, { color: rail, curve: "line", seg: part.length * 2, radial: 6 });
  }
  ch.maxY = Math.max(ch.maxY, height(p.a0 + total) + 1);
}

// ── walls ────────────────────────────────────────────────────────────────────
export function addWall(ch, p) {
  const [x, y, z] = p.p;
  const [w, h, d] = p.s;
  const st = p.st;
  const m = placeMatrix(x, y, z, p.r);
  ch.maxY = Math.max(ch.maxY, y + h);
  const trimmed = (b) => {
    b.box(w + 0.06, 0.16, d, { at: [0, 0.08, 0], color: shade(p.c, -0.25), r: 0.01 });
    b.box(w + 0.1, 0.12, d + 0.02, { at: [0, h - 0.06, 0], color: shade(p.c, -0.15), r: 0.01 });
  };
  if (st === "glass") {
    const g = new THREE.BoxGeometry(0.04, h - 0.3, d);
    g.translate(0, h / 2, 0);
    g.applyMatrix4(m);
    ch.surface("glass-pane", SPECIAL.glass(), g, { shadow: false });
    ch.solid.group({ at: [x, y, z], rot: [0, p.r, 0] }, (b) => {
      const frame = p.c || "#d9dee2";
      const n = Math.max(1, Math.round(d / 1.25));
      for (let k = 0; k <= n; k++) b.box(0.08, h, 0.08, { at: [0, h / 2, -d / 2 + (d * k) / n], color: frame, kind: "metal", r: 0 });
      for (const yy of [0.15, h * 0.55, h - 0.08]) b.box(0.1, 0.1, d, { at: [0, yy, 0], color: frame, kind: "metal", r: 0 });
    });
    return;
  }
  if (st === "mirror") {
    const g = new THREE.BoxGeometry(w * 0.7, h - 0.5, d - 0.2);
    g.translate(0, h / 2, 0);
    g.applyMatrix4(m);
    ch.surface("mirror", SPECIAL.mirror(), g);
    ch.solid.group({ at: [x, y, z], rot: [0, p.r, 0] }, (b) => {
      const gold = "#c9a447";
      const n = Math.max(1, Math.round(d / 2.4));
      for (let k = 0; k <= n; k++) b.box(w + 0.08, h, 0.14, { at: [0, h / 2, -d / 2 + (d * k) / n], color: gold, kind: "metal", r: 0.02 });
      b.box(w + 0.12, 0.25, d, { at: [0, 0.125, 0], color: gold, kind: "metal", r: 0.02 });
      b.box(w + 0.12, 0.25, d, { at: [0, h - 0.125, 0], color: gold, kind: "metal", r: 0.02 });
    });
    return;
  }
  if (st === "curtain") {
    const t = wallMaterial("curtain", p.c);
    const n = Math.max(8, Math.round(d * 6));
    const g = new THREE.PlaneGeometry(d, h - 0.2, n, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const zz = pos.getX(i);
      pos.setXYZ(i, Math.sin((zz / 0.5) * Math.PI) * 0.09, pos.getY(i) + (h - 0.2) / 2, zz);
    }
    g.computeVertexNormals();
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getZ(i) + d / 2) / t.tile[0], pos.getY(i) / t.tile[1]);
    g.applyMatrix4(m);
    ch.surface(t.key, t.mat, g);
    ch.solid.group({ at: [x, y, z], rot: [0, p.r, 0] }, (b) => {
      b.cyl(0.04, 0.04, d, { at: [0, h - 0.1, 0], rot: [Math.PI / 2, 0, 0], color: "#c9a447", kind: "metal", seg: 8 });
      b.box(w * 0.6, h, d, { at: [0, h / 2, 0], color: shade(p.c, -0.4), r: 0 });
    });
    return;
  }
  const t = wallMaterial(st, p.c, st === "plaster" ? undefined : p.c2);
  if (t) {
    const g = boxUV(w, h, d, t.tile[0], t.tile[1]);
    g.translate(0, h / 2, 0);
    g.applyMatrix4(m);
    ch.surface(t.key, t.mat, g);
  } else {
    ch.solid.group({ at: [x, y, z], rot: [0, p.r, 0] }, (b) => b.box(w, h, d, { at: [0, h / 2, 0], color: p.c, r: 0 }));
  }
  ch.solid.group({ at: [x, y, z], rot: [0, p.r, 0] }, (b) => {
    if (st === "hedge") {
      const n = Math.max(2, Math.round(d / 0.9));
      for (let k = 0; k < n; k++) {
        b.ico(0.32, { at: [0, h - 0.02, -d / 2 + (k + 0.5) * d / n], color: shade(p.c, 0.04), detail: 1, scale: [1.2, 0.7, 1.6] });
      }
      return;
    }
    if (st === "low_stone") {
      b.box(w + 0.16, 0.14, d + 0.04, { at: [0, h + 0.07, 0], color: shade(p.c, 0.08), r: 0.03 });
      return;
    }
    trimmed(b);
    if (st === "plaster" && p.c2) {
      // painted dado on both faces, with a chair rail
      for (const s of [-1, 1]) {
        b.box(0.02, 1.15, d, { at: [s * (w / 2 + 0.01), 0.16 + 0.575, 0], color: p.c2, r: 0 });
        b.box(0.05, 0.06, d, { at: [s * (w / 2 + 0.02), 1.33, 0], color: shade(p.c2, -0.15), r: 0.01 });
      }
    }
    if (st === "wood_panel" || st === "shelves") {
      b.box(w + 0.12, 0.2, d, { at: [0, h - 0.1, 0], color: shade(p.c, -0.2), r: 0.02 });
    }
  });
}

// ── roofs ────────────────────────────────────────────────────────────────────
function slab(b, len, w, th, o) {
  b.box(w, th, len, { ...o, r: 0.02 });
}

export function addRoof(ch, p) {
  const [x, y, z] = p.p;
  const { w, d } = p;
  const c = p.c, c2 = p.c2 || shade(c, -0.15);
  ch.maxY = Math.max(ch.maxY, y + w * 0.5);
  ch.light.group({ at: [x, y, z], rot: [0, p.r, 0] }, (b) => {
    const fascia = () => {
      for (const s of [-1, 1]) b.box(0.18, 0.36, d, { at: [s * (w / 2 - 0.09), 0.18, 0], color: c2, r: 0.02 });
      for (const s of [-1, 1]) b.box(w, 0.36, 0.18, { at: [0, 0.18, s * (d / 2 - 0.09)], color: c2, r: 0.02 });
    };
    if (["gable", "hip", "flat", "dome", "pediment", "sawtooth"].includes(p.st)) {
      // a light ceiling under enclosed roofs keeps interiors bright
      b.box(w - 0.9, 0.08, d - 0.6, { at: [0, 0.02, 0], color: mix(c, "#f3efe6", 0.78), r: 0 });
    }
    switch (p.st) {
      case "gable":
      case "glass_gable":
      case "pediment":
      case "awning": {
        const rise = p.st === "pediment" ? w * 0.16 : p.st === "awning" ? w * 0.22 : w * 0.3;
        const half = w / 2 + (p.st === "awning" ? 0.2 : 0.35);
        const ang = Math.atan2(rise, w / 2);
        const len = Math.hypot(half, rise * half / (w / 2));
        const glass = p.st === "glass_gable";
        for (const s of [-1, 1]) {
          b.group({ at: [s * half / 2, 0.3 + rise / 2 - (half - w / 2) * Math.tan(ang) / 2, 0], rot: [0, 0, -s * ang] }, () => {
            if (p.st === "awning") {
              const n = Math.max(2, Math.round(d / 0.7));
              for (let k = 0; k < n; k++) {
                b.box(len, 0.06, d / n, { at: [0, 0, -d / 2 + (k + 0.5) * d / n], color: k % 2 ? c2 : c, r: 0 });
              }
            } else if (glass) {
              b.box(len, 0.04, d, { at: [0, 0, 0], color: "#cfe7ee", kind: "glass", r: 0 });
              const n = Math.max(2, Math.round(d / 1.6));
              for (let k = 0; k <= n; k++) b.box(len, 0.1, 0.08, { at: [0, 0.03, -d / 2 + d * k / n], color: c, kind: "metal", r: 0 });
              b.box(0.1, 0.1, d, { at: [0, 0.03, 0], color: c, kind: "metal", r: 0 });
            } else {
              slab(b, d, len, 0.16, { at: [0, 0, 0], color: c });
            }
          });
        }
        // gable ends (triangles) and ridge
        if (!glass && p.st !== "awning") {
          const tri = [[-w / 2, 0], [w / 2, 0], [0, rise]];
          for (const s of [-1, 1]) {
            b.extrude(tri, 0.2, { at: [0, 0.3, s * (d / 2 - 0.1)], color: p.st === "pediment" ? shade(c, 0.12) : c2, bevel: 0 });
          }
          if (p.st === "pediment") {
            for (const s of [-1, 1]) b.box(w + 0.4, 0.3, 0.5, { at: [0, 0.15, s * (d / 2 - 0.1)], color: shade(c, 0.05), r: 0.02 });
          }
        }
        b.box(0.22, 0.22, d + 0.2, { at: [0, 0.3 + rise, 0], color: c2, r: 0.04, kind: glass ? "metal" : "matte" });
        if (p.st !== "awning") fascia();
        else for (const s of [-1, 1]) {
          const n = Math.max(2, Math.round(d / 0.7));
          for (let k = 0; k < n; k++) {
            b.cone(0.18, 0.22, { at: [s * (half - 0.05), 0.02, -d / 2 + (k + 0.5) * d / n], rot: [Math.PI, 0, 0], color: k % 2 ? c2 : c, seg: 3 });
          }
        }
        return;
      }
      case "hip": {
        const rise = w * 0.26;
        const geo = new THREE.BufferGeometry();
        const hw = w / 2 + 0.3, hd = d / 2 + 0.3, ridge = Math.max(0.1, hd - hw);
        const P = [
          [-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd], [0, rise, -ridge], [0, rise, ridge],
        ];
        const tris = [[0, 4, 1], [1, 4, 5], [1, 5, 2], [2, 5, 3], [3, 5, 4], [3, 4, 0]];
        const arr = [];
        for (const t of tris) for (const i of t) arr.push(...P[i]);
        geo.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
        geo.computeVertexNormals();
        b.geo(geo, { at: [0, 0.32, 0], color: c, flat: true });
        fascia();
        return;
      }
      case "dome": {
        fascia();
        b.box(w, 0.25, d, { at: [0, 0.3, 0], color: shade(c, 0.05), r: 0.02 });
        const R = Math.min(w, d) * 0.42;
        b.cyl(R * 1.02, R * 1.02, 0.6, { at: [0, 0.7, 0], color: c2, seg: 32 });
        b.sphere(R, { at: [0, 1.0, 0], color: c, seg: 32, thetaLength: Math.PI / 2 });
        b.cyl(0.5, 0.6, 0.9, { at: [0, 1.0 + R + 0.3, 0], color: c2, seg: 12 });
        b.sphere(0.35, { at: [0, 1.0 + R + 0.95, 0], color: "#d4a548", kind: "metal" });
        return;
      }
      case "flat": {
        b.box(w, 0.3, d, { at: [0, 0.15, 0], color: c, r: 0.02 });
        for (const s of [-1, 1]) b.box(0.3, 0.55, d, { at: [s * (w / 2 - 0.15), 0.55, 0], color: c2, r: 0.03 });
        for (const s of [-1, 1]) b.box(w, 0.55, 0.3, { at: [0, 0.55, s * (d / 2 - 0.15)], color: c2, r: 0.03 });
        return;
      }
      case "pergola": {
        for (const s of [-1, 1]) b.box(0.22, 0.3, d, { at: [s * (w / 2 - 0.3), 0.15, 0], color: c, r: 0.03 });
        const n = Math.max(3, Math.round(d / 0.8));
        for (let k = 0; k <= n; k++) b.box(w + 0.4, 0.22, 0.12, { at: [0, 0.4, -d / 2 + d * k / n], color: shade(c, 0.05), r: 0.02 });
        // a few vines
        for (let k = 0; k < n; k += 2) {
          b.ico(0.35, { at: [((k * 37) % 7 - 3) * 0.9, 0.55, -d / 2 + d * k / n], color: "#5f9a4a", detail: 1, scale: [1.6, 0.6, 1.1] });
        }
        return;
      }
      case "barrel_vault": {
        const R = w / 2;
        b.cyl(R, R, d, { at: [0, 0.2, 0], rot: [Math.PI / 2, 0, 0], color: c, seg: 28, open: true, thetaStart: Math.PI / 2, thetaLength: Math.PI });
        const n = Math.max(2, Math.round(d / 3));
        for (let k = 0; k <= n; k++) {
          b.torus(R - 0.05, 0.12, { at: [0, 0.2, -d / 2 + d * k / n], color: c2, arc: Math.PI, seg: 24, tubeSeg: 6 });
        }
        for (const s of [-1, 1]) {
          b.geo(new THREE.CircleGeometry(R, 28, 0, Math.PI), { at: [0, 0.2, s * d / 2], rot: [0, s > 0 ? 0 : Math.PI, 0], color: shade(c, 0.06) });
        }
        return;
      }
      case "sawtooth": {
        const teeth = Math.max(2, Math.round(d / 3.2));
        const tl = d / teeth, rise = 1.6;
        for (let k = 0; k < teeth; k++) {
          const z0 = -d / 2 + k * tl;
          const ang = Math.atan2(rise, tl);
          const len = Math.hypot(rise, tl);
          b.group({ at: [0, 0.3 + rise / 2, z0 + tl / 2], rot: [ang, 0, 0] }, () => slab(b, len, w, 0.14, { at: [0, 0, 0], color: c }));
          b.box(w - 0.2, rise, 0.05, { at: [0, 0.3 + rise / 2, z0 + 0.03], color: "#cfe7ee", kind: "glass", r: 0 });
          b.box(w, 0.12, 0.12, { at: [0, 0.3 + rise, z0 + 0.03], color: c2, kind: "metal", r: 0 });
        }
        fascia();
        return;
      }
      default:
        return;
    }
  });
}

// ── plain shapes ─────────────────────────────────────────────────────────────
export function addShape(ch, p) {
  const kind = p.m || "matte";
  const b = ch.solid;
  if (p.t === "box") b.box(p.s[0], p.s[1], p.s[2], { at: p.p, rot: [0, p.r || 0, 0], color: p.c, kind, r: p.rd ?? 0.02 });
  else if (p.t === "cyl") b.cyl(p.rt, p.rb, p.h, { at: p.p, color: p.c, seg: p.n || 16, kind, flat: (p.n || 16) <= 8 });
  else if (p.t === "sphere") b.sphere(p.rad, { at: p.p, color: p.c, kind, seg: 24 });
  ch.maxY = Math.max(ch.maxY, p.p[1] + (p.h || p.rad || p.s?.[1] || 0));
}

export function addWater(ch, p) {
  const [x, y, z] = p.p;
  const g = new THREE.BoxGeometry(p.w, 0.04, p.d);
  g.applyMatrix4(placeMatrix(x, y, z, p.r));
  if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  ch.surface("water|" + p.c, SPECIAL.water(p.c), g, { shadow: false });
  ch.solid.group({ at: [x, 0, z], rot: [0, p.r || 0, 0] }, (b) => {
    const rim = "#d8d0c0";
    for (const s of [-1, 1]) {
      b.box(p.w + 0.6, y + 0.22, 0.3, { at: [0, (y + 0.22) / 2, s * (p.d / 2 + 0.15)], color: rim, r: 0.04 });
      b.box(0.3, y + 0.22, p.d, { at: [s * (p.w / 2 + 0.15), (y + 0.22) / 2, 0], color: rim, r: 0.04 });
    }
    b.box(p.w, 0.05, p.d, { at: [0, Math.max(0.02, y - 0.25), 0], color: "#2f5f6f", r: 0 });
  });
}

/** Pendant lamps hang from the ceiling; returns halo spec(s) for the glow layer. */
export function addLamp(ch, p) {
  const [x, y, z] = p.p;
  if (p.k === "pendant") {
    ch.light.group({ at: [x, y, z] }, (b) => {
      b.cyl(0.012, 0.012, 0.9, { at: [0, 0.45, 0], color: "#2b2b2b", seg: 5 });
      b.cyl(0.08, 0.32, 0.24, { at: [0, 0.02, 0], color: "#3a4a3f", kind: "metal", seg: 16, open: true });
      b.sphere(0.1, { at: [0, -0.04, 0], color: p.c, kind: "glow", light: false });
    });
    return [{ x, y: y - 0.1, z, color: p.c, size: 1.3 }];
  }
  return [{ x, y, z, color: p.c, size: 7 }];
}

/** A locus: a round plinth (static); its object is built near the visitor (loci.js). */
export const STAGE = { R: 1.35, H: 0.42 };

export function addLocusShell(ch, p, look) {
  const [x, y, z] = p.p;
  const { stage, accent } = look;
  ch.solid.group({ at: [x, y, z], rot: [0, p.r, 0] }, (b) => {
    const R = STAGE.R, H = STAGE.H;
    b.cyl(R + 0.1, R + 0.14, 0.08, { at: [0, 0.04, 0], color: shade(stage, -0.16), seg: 40 });
    b.cyl(R - 0.02, R + 0.03, H - 0.16, { at: [0, 0.08 + (H - 0.16) / 2, 0], color: shade(stage, -0.06), seg: 40 });
    b.cyl(R + 0.04, R + 0.04, 0.06, { at: [0, H - 0.05, 0], color: accent, seg: 40, kind: "metal" });
    b.cyl(R, R, 0.03, { at: [0, H - 0.01, 0], color: shade(stage, 0.08), seg: 40 });
  });
  ch.maxY = Math.max(ch.maxY, y + 2.5);
}

export { mix };
