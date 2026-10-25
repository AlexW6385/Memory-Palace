// What stood in the temple: barques, altars and offering tables, the naos, chests and
// shelves of the service rooms, the contents of each chapel, basins, stairs, palms.
// Each piece faces +z, stands on y = 0 and is modelled in metres.
import * as THREE from "three";
import { shade, mix } from "../props/kit.js";
import { SPECIAL } from "../arch.js";
import { PAINT, faded, wingedDisc, stoneMat, columnPiece } from "./egypt-arch.js";
import { figure, SKIN } from "./egypt-figures.js";
import { stelaTexture, obeliskTexture, smiteTexture, triumphTexture, frondTexture } from "./egypt-tex.js";

const GRANITE = "#4d4844", RED_GRANITE = "#9a6a5c", SAND = "#cfae7f", CEDAR = "#7b4f2e", EBONY = "#3a2a22";
const ALABASTER = "#efe4cf", LINEN = "#efe8d8", FAIENCE = "#3fa3a0";

// ── small pieces used everywhere ─────────────────────────────────────────────
function cavettoBlock(b, w, h, d, color, kind = "matte", at = [0, 0, 0]) {
  b.box(w, h * 0.82, d, { at: [at[0], at[1] + h * 0.41, at[2]], color, kind, r: 0.02 });
  b.box(w + h * 0.12, h * 0.1, d + h * 0.12, { at: [at[0], at[1] + h * 0.87, at[2]], color: shade(color, 0.05), kind, r: 0.02 });
  b.box(w + h * 0.04, h * 0.06, d + h * 0.04, { at: [at[0], at[1] + h * 0.97, at[2]], color: shade(color, 0.08), kind, r: 0.01 });
}

function jar(b, at, h, color, kind = "matte", { handles = false, lid = null } = {}) {
  b.group({ at }, (bb) => {
    bb.lathe([[0.0, 0], [h * 0.12, 0.01], [h * 0.28, h * 0.25], [h * 0.3, h * 0.5], [h * 0.2, h * 0.82], [h * 0.12, h * 0.9],
      [h * 0.15, h], [h * 0.11, h]], { color, kind, seg: 16 });
    if (handles) for (const s of [-1, 1]) bb.torus(h * 0.09, h * 0.018, { at: [s * h * 0.22, h * 0.72, 0], rot: [0, Math.PI / 2, 0], arc: Math.PI, color, kind, seg: 10 });
    if (lid) bb.sphere(h * 0.12, { at: [0, h * 1.0, 0], scale: [1, 0.55, 1], color: lid, seg: 10 });
  });
}

function amphora(b, at, h, color) {
  b.group({ at }, (bb) => {
    bb.lathe([[0, 0], [h * 0.05, h * 0.05], [h * 0.2, h * 0.3], [h * 0.22, h * 0.55], [h * 0.12, h * 0.8], [h * 0.07, h * 0.86],
      [h * 0.08, h], [h * 0.06, h]], { color, seg: 14 });
    for (const s of [-1, 1]) bb.torus(h * 0.07, h * 0.015, { at: [s * h * 0.1, h * 0.84, 0], rot: [0, Math.PI / 2, 0], arc: Math.PI, color, seg: 8 });
  });
}

function loaf(b, at, s, color = "#c98a4a") {
  b.cone(s * 0.5, s * 1.2, { at: [at[0], at[1] + s * 0.6, at[2]], color, seg: 10 });
}

function duck(b, at, s, yaw = 0) {
  b.group({ at, rot: [0, yaw, 0] }, (bb) => {
    bb.sphere(s * 0.5, { at: [0, s * 0.35, 0], scale: [0.7, 0.55, 1], color: "#e3c9a0", seg: 10 });
    bb.sphere(s * 0.22, { at: [0, s * 0.62, s * 0.42], color: "#d9bb8f", seg: 8 });
  });
}

function fruit(b, at, n, r, colors, rng) {
  for (let k = 0; k < n; k++) {
    const a = rng() * Math.PI * 2, rr = rng() * r * 2.2;
    b.sphere(r, { at: [at[0] + Math.cos(a) * rr, at[1] + r + (k > n / 2 ? r * 1.4 : 0), at[2] + Math.sin(a) * rr], color: rng.pick(colors), kind: "gloss", seg: 8 });
  }
}

function lotus(b, at, h, color = "#f2eee4") {
  b.cyl(0.008, 0.008, h, { at: [at[0], at[1] + h / 2, at[2]], color: "#4f7a3f", seg: 5 });
  b.cone(0.05, 0.1, { at: [at[0], at[1] + h + 0.03, at[2]], rot: [Math.PI, 0, 0], color, seg: 8 });
}

function bouquet(b, at, h) {
  b.cyl(0.05, 0.06, h * 0.75, { at: [at[0], at[1] + h * 0.375, at[2]], color: "#4f7a3f", seg: 8 });
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    b.cone(0.07, 0.16, { at: [at[0] + Math.cos(a) * 0.08, at[1] + h * 0.8 + (k % 2) * 0.08, at[2] + Math.sin(a) * 0.08], rot: [Math.PI, 0, 0], color: k % 2 ? "#f2eee4" : "#7fa8d6", seg: 8 });
  }
  b.sphere(0.13, { at: [at[0], at[1] + h, at[2]], scale: [1, 0.8, 1], color: "#5f9a4a", seg: 10 });
}

function flame(b, at, s) {
  b.cone(s * 0.6, s * 1.6, { at: [at[0], at[1] + s * 0.8, at[2]], color: "#ffb43a", kind: "glow", seg: 8 });
  b.cone(s * 0.3, s * 1.0, { at: [at[0], at[1] + s * 0.55, at[2]], color: "#fff1a8", kind: "glow", seg: 6, light: false });
}

function flabellum(b, at, h) {
  // a ceremonial ostrich-feather fan on a long pole
  b.cyl(0.02, 0.025, h, { at: [at[0], at[1] + h / 2, at[2]], color: PAINT.gold, kind: "metal", seg: 6 });
  b.group({ at: [at[0], at[1] + h + 0.25, at[2]] }, (bb) => {
    bb.sphere(0.35, { scale: [1, 0.85, 0.12], thetaLength: Math.PI * 0.62, color: "#f1ece0", seg: 14 });
    bb.cyl(0.08, 0.05, 0.12, { at: [0, -0.28, 0], color: PAINT.gold, kind: "metal", seg: 8 });
  });
}

function chest(b, at, w, h, d, color, { gold = false, lid = "gable", yaw = 0 } = {}) {
  b.group({ at, rot: [0, yaw, 0] }, (bb) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bb.box(0.06, 0.12, 0.06, { at: [sx * (w / 2 - 0.05), 0.06, sz * (d / 2 - 0.05)], color: shade(color, -0.15), r: 0.01 });
    bb.box(w, h, d, { at: [0, 0.1 + h / 2, 0], color, kind: gold ? "metal" : "matte", r: 0.015 });
    bb.box(w + 0.02, 0.03, d + 0.02, { at: [0, 0.1 + h * 0.15, 0], color: gold ? PAINT.lapis : PAINT.gold, kind: "metal", r: 0 });
    if (lid === "gable") {
      bb.extrude([[-w / 2 - 0.02, 0], [w / 2 + 0.02, 0], [0, h * 0.28]], d + 0.02, { at: [0, 0.1 + h, 0], color: shade(color, 0.04), kind: gold ? "metal" : "matte", bevel: 0 });
    } else if (lid === "vault") {
      bb.cyl(w / 2, w / 2, d + 0.02, { at: [0, 0.1 + h, 0], rot: [Math.PI / 2, 0, 0], thetaLength: Math.PI, color: shade(color, 0.04), kind: gold ? "metal" : "matte", seg: 12, scale: [1, 1, 0.5] });
    } else {
      bb.box(w + 0.04, 0.05, d + 0.04, { at: [0, 0.1 + h + 0.025, 0], color: shade(color, 0.04), r: 0.01 });
    }
    if (!gold) for (const s of [-1, 1]) bb.box(0.02, h * 0.6, 0.02, { at: [s * w * 0.3, 0.1 + h / 2, d / 2 + 0.01], color: PAINT.gold, kind: "metal", r: 0 });
  });
}

function shelves(b, at, w, h, d, levels, color = CEDAR) {
  b.group({ at }, (bb) => {
    for (const s of [-1, 1]) bb.box(0.06, h, d, { at: [s * (w / 2 - 0.03), h / 2, 0], color: shade(color, -0.1), r: 0.01 });
    for (let k = 0; k <= levels; k++) bb.box(w, 0.05, d, { at: [0, 0.08 + k * (h - 0.12) / levels, 0], color, r: 0.01 });
    bb.box(w, h, 0.03, { at: [0, h / 2, -d / 2 + 0.015], color: shade(color, -0.2), r: 0 });
  });
}

function offeringsOn(b, y, w, d, rng) {
  // loaves, ducks, fruit, lettuce and lotus, heaped as in the reliefs
  for (let k = 0; k < 5; k++) loaf(b, [-w * 0.38 + k * w * 0.19, y, -d * 0.25], 0.12 + rng() * 0.04);
  duck(b, [-w * 0.22, y, d * 0.12], 0.32, 0.4);
  duck(b, [w * 0.05, y, d * 0.15], 0.3, -0.3);
  fruit(b, [w * 0.3, y, d * 0.05], 9, 0.045, ["#7a3f6a", "#5f2f4f", "#c98a4a", "#8a9a3a"], rng);
  for (let k = 0; k < 3; k++) b.sphere(0.07, { at: [w * 0.38, y + 0.07, -d * 0.2 + k * 0.12], scale: [0.6, 1, 0.6], color: "#5f9a4a", seg: 8 });
  for (let k = 0; k < 4; k++) lotus(b, [-w * 0.42 + k * 0.08, y, d * 0.32], 0.35 + k * 0.03, k % 2 ? "#f2eee4" : "#7fa8d6");
  jar(b, [w * 0.15, y, -d * 0.28], 0.26, "#b9654a");
}

function oilLamp(b, at) {
  b.group({ at }, (bb) => {
    bb.lathe([[0, 0], [0.06, 0.005], [0.075, 0.03], [0.05, 0.05], [0.0, 0.05]], { color: "#b9805a", seg: 12 });
    flame(bb, [0.05, 0.05, 0], 0.03);
  });
}

// ── textured helpers (decals and stone) ──────────────────────────────────────
const DMATS = new Map();
function decalMat(key, map, { opaque = false, double = false } = {}) {
  let m = DMATS.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map, transparent: !opaque, alphaTest: opaque ? 0 : 0.02, roughness: 0.9,
      depthWrite: opaque, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      side: double ? THREE.DoubleSide : THREE.FrontSide, envMapIntensity: 0.4 });
    DMATS.set(key, m);
  }
  return m;
}

function decalPlane(b, X, key, map, w, h, at, { tilt = 0, opaque = false } = {}) {
  const g = new THREE.PlaneGeometry(w, h);
  g.rotateX(-tilt);
  g.translate(at[0], at[1], at[2]);
  X.surface(b, key, decalMat(key, map, { opaque }), g, { shadow: false });
}

/** A basin cut into the ground: stepped sides, a floor and water. stairs: which sides have stairs. */
function basin(b, o, X, { stairs = ["n", "s", "e", "w"], stairW = null, top = 0 }) {
  const { w, d, depth, water } = o;
  const sm = stoneMat("plain", "#cdb08a");
  const steps = 8;
  const stepH = (depth - 0.4) / steps;
  const tread = 0.42;
  const sides = { s: [0, -d / 2, w, 0], n: [0, d / 2, w, Math.PI], w: [-w / 2, 0, d, Math.PI / 2], e: [w / 2, 0, d, -Math.PI / 2] };
  // retaining walls, textured
  for (const [key, [x, z, len, yaw]] of Object.entries(sides)) {
    const g = new THREE.BoxGeometry(len + 0.6, depth + top, 0.6);
    const uv = g.attributes.uv, pos = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + len) / sm.tile[0], (pos.getY(i) + depth) / sm.tile[1]);
    g.translate(0, top - (depth + top) / 2, -0.3);
    g.rotateY(yaw);
    g.translate(x, 0, z);
    X.surface(b, sm.key, sm.mat, g);
    if (!stairs.includes(key)) continue;
    // a flight of steps down this side, the full width or a central flight
    const sw = stairW ? Math.min(stairW, len - 1) : len - 1.2;
    b.group({ at: [x, 0, z], rot: [0, yaw, 0] }, (bb) => {
      for (let k = 0; k < steps; k++) {
        const yTop = top - (k + 1) * stepH;
        bb.box(sw, yTop + depth, tread, { at: [0, (yTop - depth) / 2, (k + 0.5) * tread], color: shade("#cdb08a", -0.02 - k * 0.012), r: 0.01 });
      }
    });
  }
  b.box(w, 0.2, d, { at: [0, -depth - 0.1, 0], color: "#8a7a5c", r: 0 });
  const g = new THREE.PlaneGeometry(w - 0.02, d - 0.02);
  g.rotateX(-Math.PI / 2);
  g.translate(0, -water, 0);
  X.surface(b, "water|#4c8f9a", SPECIAL.water("#3f8794"), g, { shadow: false });
  // coping round the rim
  for (const [, [x, z, len, yaw]] of Object.entries(sides)) {
    b.group({ at: [x, top, z], rot: [0, yaw, 0] }, (bb) => bb.box(len + 1.2, 0.18, 0.6, { at: [0, 0.09, -0.3], color: shade("#cdb08a", 0.04), r: 0.02 }));
  }
}

// ── the pieces ───────────────────────────────────────────────────────────────
export const FURNISH = {
  harbour(b, o, X) {
    basin(b, o, X, { stairs: ["n"], stairW: 16, top: 0.3 });
  },

  quay_edge(b, o) {
    for (const x of [-18, -10, 10, 18]) {
      b.cyl(0.28, 0.32, 0.9, { at: [x, 0.75, 0.6], color: shade(SAND, -0.06), seg: 12 });
      b.sphere(0.3, { at: [x, 1.2, 0.6], color: shade(SAND, -0.02), seg: 10 });
    }
  },

  barge(b) {
    // the god's river barge: a papyrus-shaped hull, a gilded cabin, a canopy and steering oars
    const L = 21, hullC = "#b88a4a", gold = PAINT.gold;
    const pos = [];
    const sec = 24, ring = 10;
    const section = (t) => {
      const z = (t - 0.5) * L;
      const e = Math.abs(t - 0.5) * 2;
      const half = 1.7 * Math.sqrt(Math.max(0, 1 - Math.pow(e, 2.6)));
      const keel = -0.9 * (1 - Math.pow(e, 3)) + Math.pow(e, 6) * 2.8;
      const gun = 0.9 + Math.pow(e, 5) * 2.6;
      return { z, half, keel, gun };
    };
    const P = [];
    for (let i = 0; i <= sec; i++) {
      const s = section(i / sec);
      const row = [];
      for (let j = 0; j <= ring; j++) {
        const a = Math.PI * (j / ring);
        row.push([Math.cos(a) * s.half, s.gun - (s.gun - s.keel) * Math.sin(a), s.z]);
      }
      P.push(row);
    }
    for (let i = 0; i < sec; i++) for (let j = 0; j < ring; j++) {
      const a = P[i][j], c = P[i + 1][j], d = P[i + 1][j + 1], e = P[i][j + 1];
      pos.push(...a, ...c, ...d, ...a, ...d, ...e);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    b.geo(g, { color: hullC });
    const g2 = g.clone();
    g2.scale(-1, 1, 1);
    b.geo(g2, { color: hullC });
    // papyrus-umbel finials at both ends, and painted bands
    for (const s of [-1, 1]) {
      b.cone(0.55, 1.1, { at: [0, 4.0, s * (L / 2 - 0.1)], rot: [s > 0 ? -0.4 : 0.4, 0, 0], color: faded(PAINT.green, hullC, 0.6), seg: 12 });
      b.cyl(0.24, 0.24, 0.3, { at: [0, 3.35, s * (L / 2 - 0.3)], color: gold, kind: "metal", seg: 10 });
    }
    b.box(3.2, 0.12, L * 0.72, { at: [0, 0.92, 0], color: shade(hullC, -0.12), r: 0.02 });   // deck
    for (const s of [-1, 1]) b.box(0.1, 0.2, L * 0.7, { at: [s * 1.62, 1.0, 0], color: PAINT.lapis, r: 0.02 });
    // gilded cabin-shrine with a canopy
    b.group({ at: [0, 1.0, 0.5] }, (bb) => {
      bb.box(2.0, 1.9, 3.2, { at: [0, 0.95, 0], color: gold, kind: "metal", r: 0.03 });
      bb.box(2.3, 0.2, 3.5, { at: [0, 2.0, 0], color: PAINT.lapis, r: 0.03 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) bb.cyl(0.06, 0.06, 2.7, { at: [sx * 1.4, 1.35, sz * 2.6], color: gold, kind: "metal", seg: 8 });
      bb.box(3.0, 0.06, 5.6, { at: [0, 2.72, 0], color: "#e9dfc8", r: 0.01 });
      for (let k = 0; k < 9; k++) bb.box(3.02, 0.08, 0.2, { at: [0, 2.74, -2.6 + k * 0.65], color: k % 2 ? PAINT.red : PAINT.blue, r: 0 });
    });
    // falcon aegis at the prow and the stern
    for (const s of [-1, 1]) {
      b.group({ at: [0, 1.0, s * 7.2] }, (bb) => {
        bb.cyl(0.5, 0.55, 0.12, { at: [0, 0.06, 0], color: gold, kind: "metal", seg: 16 });
        bb.sphere(0.32, { at: [0, 0.55, 0], scale: [0.9, 1, 1.1], color: gold, kind: "metal", seg: 12 });
        bb.cone(0.1, 0.25, { at: [0, 0.5, s * 0.33], rot: [s * (Math.PI / 2 + 0.6), 0, 0], color: shade(gold, -0.1), kind: "metal", seg: 8 });
        bb.cyl(0.35, 0.35, 0.04, { at: [0, 1.05, 0], rot: [Math.PI / 2, 0, 0], color: "#d9442f", seg: 18 });
      });
    }
    // steering oars at the stern
    for (const s of [-1, 1]) {
      b.rod([s * 1.2, 2.6, -8.6], [s * 1.9, -0.8, -10.6], 0.07, { color: CEDAR, seg: 6 });
      b.box(0.08, 1.4, 0.6, { at: [s * 1.95, -0.6, -10.7], rot: [0.45, 0, 0], color: CEDAR, r: 0.02 });
      b.cyl(0.1, 0.1, 2.0, { at: [s * 1.2, 1.9, -8.6], color: CEDAR, seg: 6 });
    }
  },

  flood_stela(b, o, X) {
    b.box(1.8, 0.45, 1.0, { at: [0, 0.225, 0], color: shade(SAND, -0.08), r: 0.03 });
    const w = 1.4, h = 2.9;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, h - w / 2);
    shape.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); shape.lineTo(-w / 2, 0);
    b.extrude(shape, 0.32, { at: [0, 0.45, 0], color: "#6d6660", kind: "gloss", bevel: 0.02 });
    decalPlane(b, X, "stela|flood", stelaTexture("flood", "#6d6660"), w * 0.98, h * 0.98, [0, 0.45 + h * 0.49, 0.18], { opaque: true });
    // the flood scale: cubit marks on the side
    for (let k = 0; k < 7; k++) b.box(0.06, 0.02, 0.34, { at: [w / 2 + 0.01, 0.6 + k * 0.33, 0], color: k % 2 ? PAINT.red : "#1d1a18", r: 0 });
  },

  bark_stand(b) {
    cavettoBlock(b, 2.1, 1.1, 3.9, RED_GRANITE, "gloss");
    // offerings and fans where the barque rested
    for (const s of [-1, 1]) {
      flabellum(b, [s * 1.4, 0, 1.6], 3.2);
      flabellum(b, [s * 1.4, 0, -1.6], 3.2);
      jar(b, [s * 0.55, 1.1, 1.3], 0.45, "#b9654a", "matte", { lid: "#d9c49a" });
    }
    bouquet(b, [0, 1.1, 0.2], 0.9);
    bouquet(b, [0, 1.1, -1.0], 0.8);
    for (let k = 0; k < 4; k++) lotus(b, [-0.5 + k * 0.33, 1.1, -1.6], 0.4);
  },

  obelisk(b, o, X) {
    const h = o.h;
    const ped = RED_GRANITE;
    b.box(3.6, 0.5, 3.6, { at: [0, 0.25, 0], color: shade(SAND, -0.06), r: 0.02 });
    b.box(3.0, 1.7, 3.0, { at: [0, 1.35, 0], color: shade(ped, -0.05), kind: "gloss", r: 0.02 });
    for (const s of [-1, 1]) for (const t of [-1, 1]) {
      b.group({ at: [s * 1.0, 2.2, t * 1.52], rot: [0, t > 0 ? 0 : Math.PI, 0], scale: 0.9 }, (bb) => {
        // baboons greeting the sun carved on the base
        bb.sphere(0.32, { at: [0, 0.3, 0], scale: [0.8, 1, 0.6], color: shade(ped, -0.1), kind: "gloss", seg: 10 });
      });
    }
    // the shaft, textured with a column of hieroglyphs on each face
    const base = 2.2, top = 0.62 * base, sh = h - base * 0.9;
    const om = obeliskTextureMat();
    const pos = [], uv = [];
    const B = base / 2, T = top / 2, y0 = 2.2, y1 = y0 + sh;
    const faces = [[[-B, y0, B], [B, y0, B], [T, y1, T], [-T, y1, T]], [[B, y0, B], [B, y0, -B], [T, y1, -T], [T, y1, T]],
      [[B, y0, -B], [-B, y0, -B], [-T, y1, -T], [T, y1, -T]], [[-B, y0, -B], [-B, y0, B], [-T, y1, T], [-T, y1, -T]]];
    for (const [a, bq, c, d] of faces) {
      pos.push(...a, ...bq, ...c, ...a, ...c, ...d);
      const v1 = sh / om.tile[1];
      uv.push(0, 0, 1, 0, 1, v1, 0, 0, 1, v1, 0, v1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    X.surface(b, om.key, om.mat, g);
    // electrum pyramidion
    b.cone(T * Math.SQRT2, base * 0.7, { at: [0, y1 + base * 0.35, 0], rot: [0, Math.PI / 4, 0], color: "#e6c463", kind: "metal", seg: 4 });
  },

  colossus(b, o) {
    const st = o.pose === "seat" ? "#bf9a6c" : "#a7857a";
    if (o.pose === "seat") {
      b.box(4.4, 1.5, 6.4, { at: [0, 0.75, 0], color: shade(st, -0.06), r: 0.04 });
      b.box(4.6, 0.15, 6.6, { at: [0, 1.57, 0], color: shade(st, -0.02), r: 0.03 });
      b.group({ at: [0, 1.64, -0.4], scale: 10.5 }, (bb) => figure(bb, { pose: "seat", head: "double", stone: st }));
      // the queen, small, standing by his legs
      b.group({ at: [1.4, 1.64, 2.0], scale: 3.2 }, (bb) => figure(bb, { pose: "stand", head: "hathor", stone: shade(st, 0.03) }));
    } else {
      b.box(3.8, 1.2, 4.8, { at: [0, 0.6, 0], color: shade(st, -0.06), kind: "gloss", r: 0.04 });
      b.box(4.0, 0.15, 5.0, { at: [0, 1.27, 0], color: shade(st, -0.02), kind: "gloss", r: 0.03 });
      b.box(1.4, 8.4, 0.9, { at: [0, 1.34 + 4.2, -0.9], color: shade(st, -0.04), kind: "gloss", r: 0.04 });   // back pillar
      b.group({ at: [0, 1.34, -0.3], scale: 9.6 }, (bb) => figure(bb, { pose: "stride", head: "double", stone: st, gloss: true }));
    }
  },

  flagpole(b, o) {
    const h = o.h;
    b.cyl(0.32, 0.5, h, { at: [0, h / 2, 0], color: CEDAR, seg: 10 });
    b.cyl(0.55, 0.6, 0.5, { at: [0, 0.25, 0], color: shade(SAND, -0.1), seg: 10 });
    for (const y of [h * 0.45, h * 0.7]) b.box(0.9, 0.35, 1.2, { at: [0, y, 0.5], color: shade(SAND, 0.02), r: 0.03 });   // clamps
    b.cone(0.45, 1.2, { at: [0, h + 0.6, 0], color: PAINT.gold, kind: "metal", seg: 10 });
    // two long pennants streaming in the wind
    for (const [yy, c] of [[h - 1.5, "#c9442f"], [h - 3.4, "#f1ece0"]]) {
      const pts = [];
      for (let k = 0; k <= 8; k++) pts.push([0.3 + k * 0.85, yy - k * 0.12 + Math.sin(k * 1.1) * 0.25, -0.2 - Math.sin(k * 0.8) * 0.4]);
      b.tube(pts, 0.22, { color: c, seg: 40, radial: 4, scale: [1, 1, 0.25] });
    }
  },

  pylon_relief(b, o, X) {
    decalPlane(b, X, `smite|${o.flip}`, smiteTexture(!!o.flip), o.w, o.h, [0, 0, 0.02], { tilt: o.tilt || 0 });
  },

  relief_panel(b, o, X) {
    decalPlane(b, X, "triumph", triumphTexture(), o.w, o.h, [0, o.h / 2, 0.02]);
  },

  lustration_basin(b) {
    b.box(1.6, 0.7, 1.0, { at: [0, 0.35, 0], color: shade(GRANITE, 0.06), kind: "gloss", r: 0.04 });
    b.box(2.2, 0.55, 1.4, { at: [0, 0.98, 0], color: GRANITE, kind: "gloss", r: 0.06 });
    b.box(1.9, 0.02, 1.1, { at: [0, 1.2, 0], color: "#3f8794", kind: "gloss", r: 0 });
    jar(b, [0.75, 1.25, 0.35], 0.35, "#c9a447", "metal");   // a bronze hes-vase for pouring
    b.box(0.9, 0.2, 0.5, { at: [0, 0.1, 0.85], color: shade(SAND, -0.05), r: 0.02 });   // a step to reach it
  },

  stela(b, o, X) {
    b.box(2.8, 0.6, 1.2, { at: [0, 0.3, 0], color: shade(SAND, -0.08), r: 0.03 });
    const w = 2.2, h = 3.8;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, h - w / 2);
    shape.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); shape.lineTo(-w / 2, 0);
    b.extrude(shape, 0.45, { at: [0, 0.6, 0], color: "#d8c9a8", bevel: 0.02 });
    decalPlane(b, X, "stela|founding", stelaTexture("founding", "#d8c9a8"), w * 0.98, h * 0.98, [0, 0.6 + h * 0.49, 0.245], { opaque: true });
  },

  altar(b, o, X) {
    const c = shade(SAND, -0.03);
    b.box(4.2, 1.2, 3.2, { at: [0, 0.6, 0], color: c, r: 0.03 });
    b.box(4.4, 0.14, 3.4, { at: [0, 1.27, 0], color: shade(c, 0.05), r: 0.03 });
    // horned corners and a ramp of steps behind
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.4, 0.35, 0.4, { at: [sx * 1.95, 1.5, sz * 1.45], color: shade(c, 0.03), r: 0.08 });
    for (let k = 0; k < 4; k++) b.box(1.4, 0.3 * (k + 1), 0.4, { at: [0, 0.15 * (k + 1), -1.8 - (3 - k) * 0.4], color: shade(c, -0.03), r: 0.02 });
    // fire bowl and the offering burning on it
    b.cyl(0.55, 0.4, 0.35, { at: [0, 1.52, 0.3], color: "#9c6b3c", kind: "metal", seg: 16 });
    flame(b, [0, 1.68, 0.3], 0.32);
    flame(b, [0.18, 1.66, 0.4], 0.2);
    const rng = b.rng;
    offeringsOn(b, 1.34, 3.8, 2.6, rng);
  },

  falcon(b, o) {
    b.group({ scale: 1.15 }, (bb) => falconFig(bb, o));
  },

  offering_table(b) {
    b.box(0.6, 0.65, 0.6, { at: [0, 0.325, 0], color: shade(SAND, -0.06), r: 0.03 });
    b.box(2.6, 0.14, 1.4, { at: [0, 0.72, 0], color: ALABASTER, kind: "gloss", r: 0.03 });
    b.box(0.5, 0.06, 0.25, { at: [0, 0.76, 0.72], color: ALABASTER, kind: "gloss", r: 0.01 }); // the spout of the hetep slab
    offeringsOn(b, 0.79, 2.4, 1.2, b.rng);
    for (const s of [-1, 1]) {
      b.cyl(0.12, 0.16, 1.1, { at: [s * 1.6, 0.55, 0.2], color: shade(SAND, -0.08), seg: 10 });
      jar(b, [s * 1.6, 1.1, 0.2], 0.4, "#b9654a", "matte", { lid: "#5f9a4a" });
    }
  },

  brazier(b) {
    // a tall bronze incense burner on a tripod
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      b.rod([Math.sin(a) * 0.55, 0, Math.cos(a) * 0.55], [Math.sin(a) * 0.18, 1.3, Math.cos(a) * 0.18], 0.04, { color: "#8a5c32", kind: "metal", seg: 6 });
      b.sphere(0.07, { at: [Math.sin(a) * 0.55, 0.05, Math.cos(a) * 0.55], color: "#8a5c32", kind: "metal", seg: 6 });
    }
    b.cyl(0.08, 0.12, 0.5, { at: [0, 1.35, 0], color: "#9c6b3c", kind: "metal", seg: 10 });
    b.lathe([[0.1, 0], [0.45, 0.12], [0.6, 0.3], [0.62, 0.34]], { at: [0, 1.55, 0], color: "#a8763f", kind: "metal", seg: 18 });
    b.cyl(0.55, 0.55, 0.05, { at: [0, 1.85, 0], color: "#c2451f", kind: "glow", seg: 14 });
    for (let k = 0; k < 6; k++) b.sphere(0.09, { at: [Math.cos(k) * 0.3, 1.88, Math.sin(k) * 0.3], color: k % 2 ? "#ff8a2a" : "#3a2a22", kind: k % 2 ? "glow" : "matte", seg: 6, light: false });
    flame(b, [0, 1.86, 0], 0.18);
  },

  library(b) {
    // the House of Books: niches in a cedar cabinet holding papyrus rolls and leather cases
    shelves(b, [0, 0, -0.1], 2.3, 2.6, 0.55, 4);
    for (let lv = 0; lv < 4; lv++) {
      const y = 0.11 + lv * 0.62;
      for (let k = 0; k < 7; k++) {
        const x = -0.95 + k * 0.32;
        if (lv % 2 === 0) b.cyl(0.055, 0.055, 0.42, { at: [x, y + 0.06, -0.1], rot: [Math.PI / 2, 0, 0], color: k % 3 ? "#e3d4ae" : "#cdb88a", seg: 8 });
        else b.box(0.24, 0.3, 0.42, { at: [x, y + 0.15, -0.1], color: k % 2 ? "#8a5a34" : "#6b4a30", r: 0.03 });
      }
    }
    chest(b, [-0.7, 0, 0.75], 0.8, 0.45, 0.55, CEDAR, { lid: "vault" });
    chest(b, [0.55, 0, 0.8], 0.7, 0.4, 0.5, EBONY, { lid: "gable" });
    // a scribe's palette and an open roll on a low stool
    b.box(0.5, 0.4, 0.4, { at: [0.05, 0.2, 1.4], color: CEDAR, r: 0.02 });
    b.box(0.36, 0.02, 0.06, { at: [0.05, 0.41, 1.36], color: "#c9b27f", r: 0.005 });
    b.box(0.45, 0.005, 0.28, { at: [0.0, 0.405, 1.46], color: "#efe1bb", r: 0 });
  },

  king_kneeling(b) {
    b.box(1.0, 0.5, 1.2, { at: [0, 0.25, 0], color: shade(GRANITE, 0.05), kind: "gloss", r: 0.03 });
    b.group({ at: [0, 0.5, -0.1], scale: 2.3 }, (bb) => figure(bb, { pose: "kneel", head: "nemes", stone: GRANITE, gloss: true }));
  },

  incense_altar(b) {
    const c = shade(SAND, -0.02);
    cavettoBlock(b, 1.3, 1.1, 1.3, c);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.18, 0.2, 0.18, { at: [sx * 0.6, 1.2, sz * 0.6], color: c, r: 0.04 });
    // a censer arm ending in a hand holding a cup of burning incense
    b.rod([-0.5, 1.15, 0], [0.45, 1.25, 0], 0.035, { color: "#a8763f", kind: "metal", seg: 6 });
    b.cyl(0.11, 0.07, 0.1, { at: [0.48, 1.3, 0], color: "#a8763f", kind: "metal", seg: 10 });
    b.cyl(0.08, 0.08, 0.02, { at: [0.48, 1.36, 0], color: "#ff8a2a", kind: "glow", seg: 8 });
    b.box(0.12, 0.08, 0.06, { at: [-0.55, 1.15, 0], color: "#a8763f", kind: "metal", r: 0.02 });
    for (let k = 0; k < 5; k++) b.sphere(0.04 + k * 0.012, { at: [0.48 + Math.sin(k) * 0.04, 1.45 + k * 0.11, Math.cos(k * 1.7) * 0.03], color: "#e8e4dc", kind: "glass", seg: 6 });
  },

  robing(b) {
    // the god's wardrobe: linen on a rack, crowns on stands, chests of collars
    b.box(2.2, 0.08, 0.5, { at: [0, 1.6, -0.15], color: CEDAR, r: 0.02 });
    for (const s of [-1, 1]) b.box(0.08, 1.6, 0.08, { at: [s * 1.05, 0.8, -0.15], color: CEDAR, r: 0.01 });
    for (let k = 0; k < 5; k++) b.box(0.32, 0.9 - k * 0.07, 0.04, { at: [-0.8 + k * 0.4, 1.16 - (0.9 - k * 0.07) / 2 + 0.43, -0.15], color: k % 2 ? LINEN : "#e3d6b8", r: 0.01 });
    const crownStand = (x, z, fn) => {
      b.cyl(0.05, 0.08, 1.0, { at: [x, 0.5, z], color: EBONY, seg: 8 });
      b.cyl(0.14, 0.14, 0.04, { at: [x, 1.02, z], color: PAINT.gold, kind: "metal", seg: 12 });
      b.group({ at: [x, 1.04, z], scale: 2.2 }, fn);
    };
    crownStand(-0.65, 0.45, (bb) => bb.lathe([[0.058, 0], [0.06, 0.05], [0.048, 0.14], [0.026, 0.22], [0.0, 0.24]], { color: "#efe9dc", seg: 14 }));
    crownStand(0.65, 0.45, (bb) => {
      bb.cyl(0.07, 0.066, 0.06, { at: [0, 0.03, 0], color: PAINT.red, seg: 14 });
      bb.box(0.05, 0.11, 0.025, { at: [0, 0.085, -0.055], color: PAINT.red, r: 0.006 });
    });
    chest(b, [0, 0, 0.7], 0.8, 0.35, 0.5, EBONY, { lid: "flat" });
    for (let k = 0; k < 3; k++) b.torus(0.16 - k * 0.03, 0.02, { at: [0, 0.6 + k * 0.012, 0.7], rot: [Math.PI / 2, 0, 0], color: [PAINT.lapis, PAINT.gold, FAIENCE][k], kind: "gloss", seg: 16 });
  },

  laboratory(b) {
    // where the sacred oils and kyphi incense were compounded: recipes are carved on the walls
    shelves(b, [0, 0, -0.75], 2.8, 2.2, 0.45, 3);
    for (let lv = 0; lv < 3; lv++) for (let k = 0; k < 8; k++) {
      jar(b, [-1.15 + k * 0.33, 0.13 + lv * 0.69, -0.75], 0.24 + (k % 3) * 0.04, lv === 1 ? ALABASTER : k % 2 ? "#b9654a" : FAIENCE, lv === 1 ? "gloss" : "matte", { lid: k % 2 ? "#d9c49a" : null });
    }
    b.box(1.6, 0.08, 0.8, { at: [0, 0.82, 0.35], color: CEDAR, r: 0.02 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.06, 0.8, 0.06, { at: [sx * 0.72, 0.4, 0.35 + sz * 0.32], color: shade(CEDAR, -0.1), r: 0.01 });
    b.lathe([[0, 0], [0.16, 0.02], [0.2, 0.12], [0.18, 0.14]], { at: [-0.4, 0.86, 0.35], color: ALABASTER, kind: "gloss", seg: 14 });
    b.rod([-0.4, 0.95, 0.35], [-0.3, 1.2, 0.3], 0.025, { color: "#8a7a6a", seg: 6 });
    b.box(0.5, 0.01, 0.35, { at: [0.35, 0.87, 0.35], color: "#efe1bb", r: 0 });
    b.cyl(0.25, 0.3, 0.45, { at: [1.1, 0.22, 0.6], color: "#8a7a6a", seg: 12 });
    b.cyl(0.22, 0.22, 0.03, { at: [1.1, 0.46, 0.6], color: "#ff8a2a", kind: "glow", seg: 10 });
    jar(b, [1.1, 0.47, 0.6], 0.3, "#9c6b3c", "metal");
  },

  treasury(b) {
    chest(b, [-0.8, 0, -0.5], 0.9, 0.55, 0.6, PAINT.gold, { gold: true, lid: "gable" });
    chest(b, [0.25, 0, -0.55], 0.8, 0.5, 0.55, EBONY, { lid: "vault" });
    chest(b, [-0.75, 0.75, -0.5], 0.7, 0.4, 0.5, CEDAR, { lid: "flat" });
    // an open chest of gold rings, lapis and turquoise
    chest(b, [0.9, 0, 0.35], 0.8, 0.45, 0.55, CEDAR, { lid: "none" });
    const rng = b.rng;
    for (let k = 0; k < 18; k++) b.sphere(0.05, { at: [0.9 + (rng() - 0.5) * 0.6, 0.6 + rng() * 0.06, 0.35 + (rng() - 0.5) * 0.4], color: rng.pick([PAINT.gold, PAINT.lapis, FAIENCE, PAINT.gold]), kind: "metal", seg: 6 });
    for (let k = 0; k < 9; k++) b.box(0.28, 0.08, 0.14, { at: [-0.3 + (k % 3) * 0.3, 0.04 + Math.floor(k / 3) * 0.085, 0.65], color: PAINT.gold, kind: "metal", r: 0.01 });
    // a pectoral on a stand
    b.cyl(0.03, 0.05, 1.0, { at: [-0.95, 0.5, 0.65], color: EBONY, seg: 6 });
    b.group({ at: [-0.95, 1.15, 0.67] }, (bb) => wingedDisc(bb, 0.12));
  },

  portable_barque(b) {
    for (const z of [-1.6, 1.6]) {
      b.box(1.4, 0.9, 0.5, { at: [0, 0.45, z], color: shade(SAND, -0.08), r: 0.03 });
    }
    b.group({ at: [0, 0.9, 0] }, (bb) => barque(bb, 5.0, { poles: true }));
  },

  nile_room(b) {
    // jars of pure water drawn from the river, a libation basin and a channel
    for (let k = 0; k < 4; k++) {
      const x = -0.9 + k * 0.6;
      b.cyl(0.18, 0.22, 0.35, { at: [x, 0.175, -0.5], color: shade(SAND, -0.08), seg: 10 });
      amphora(b, [x, 0.35, -0.5], 1.0, k % 2 ? "#b9654a" : "#c27a52");
    }
    b.box(1.6, 0.5, 0.8, { at: [0, 0.25, 0.45], color: GRANITE, kind: "gloss", r: 0.04 });
    b.box(1.4, 0.02, 0.6, { at: [0, 0.48, 0.45], color: "#3f8794", kind: "gloss", r: 0 });
    jar(b, [0.65, 0.5, 0.7], 0.32, "#c9a447", "metal");
    for (let k = 0; k < 3; k++) lotus(b, [-0.4 + k * 0.25, 0.48, 0.45], 0.25);
  },

  storeroom(b) {
    const rng = b.rng;
    // grain heaped in bins, sacks, baskets of bread and fruit, sealed jars
    for (const [x, c] of [[-0.85, "#d9b65a"], [0.15, "#c9a24a"]]) {
      b.box(0.9, 0.5, 0.9, { at: [x, 0.25, -0.5], color: shade("#b9905a", -0.1), r: 0.02 });
      b.cone(0.55, 0.6, { at: [x, 0.8, -0.5], color: c, seg: 14 });
    }
    for (let k = 0; k < 3; k++) b.sphere(0.25, { at: [0.95, 0.25 + (k === 2 ? 0.35 : 0), -0.6 + (k % 2) * 0.45], scale: [0.9, 1.1, 0.8], color: "#cbb28a", seg: 10 });
    for (let k = 0; k < 3; k++) {
      const x = -0.9 + k * 0.7;
      b.cyl(0.26, 0.2, 0.3, { at: [x, 0.15, 0.55], color: "#b98e4a", seg: 12 });
      for (let j = 0; j < 5; j++) b.sphere(0.07, { at: [x + (rng() - 0.5) * 0.25, 0.33, 0.55 + (rng() - 0.5) * 0.25], color: rng.pick(["#c98a4a", "#7a3f6a", "#8a9a3a"]), seg: 6 });
    }
    for (let k = 0; k < 4; k++) amphora(b, [-1.0 + k * 0.32, 0, 1.05], 0.85, "#c27a52");
  },

  stair(b, o) {
    const { rise, width, length } = o;
    const n = 10, sh = rise / n, sd = length / n;
    const c = "#c7aa82";
    for (let k = 0; k < n; k++) b.box(width, sh * (k + 1), sd, { at: [0, sh * (k + 1) / 2, -length / 2 + sd * (k + 0.5)], color: shade(c, -k * 0.012), r: 0.01 });
    // the stairwell continues up into darkness through a door at the top
    b.box(width + 0.4, 0.4, 0.5, { at: [0, rise + 2.6, length / 2 - 0.25], color: shade(c, -0.05), r: 0.02 });
    b.box(width, 2.4, 0.1, { at: [0, rise + 1.2, length / 2 - 0.05], color: "#1f1914", r: 0 });
    if (o.style === "winding") {
      b.box(width, rise, width, { at: [0, rise / 2, length / 2 - width / 2], color: shade(c, -0.1), r: 0.01 });
      for (let k = 0; k < 3; k++) b.box(width * 0.45, rise + sh * (k + 1), 0.6, { at: [width * 0.3, (rise + sh * (k + 1)) / 2, length / 2 - 0.3 - k * 0.6], color: shade(c, -0.12 - k * 0.02), r: 0.01 });
      // priests carrying the god's image climb the stair in relief on the wall: a painted band
      b.box(0.04, 1.2, length * 0.9, { at: [-width / 2 - 0.02, rise * 0.5 + 1.6, 0], rot: [-Math.atan2(rise, length), 0, 0], color: faded(PAINT.ochre, c, 0.5), r: 0 });
    } else {
      b.box(0.04, 1.2, length * 0.9, { at: [width / 2 + 0.02, rise * 0.5 + 1.6, 0], rot: [-Math.atan2(rise, length), 0, 0], color: faded(PAINT.blue, c, 0.45), r: 0 });
      oilLamp(b, [-width / 2 + 0.2, sh * 2, -length / 2 + sd * 1.5]);
    }
  },

  offering_feast(b) {
    b.box(3.4, 0.12, 1.6, { at: [0, 0.9, 0], color: ALABASTER, kind: "gloss", r: 0.02 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.08, 0.1, 0.85, { at: [sx * 1.5, 0.425, sz * 0.62], color: EBONY, seg: 8 });
    offeringsOn(b, 0.96, 3.2, 1.5, b.rng);
    for (let k = 0; k < 3; k++) {
      b.cyl(0.2, 0.18, 0.08, { at: [-1.0 + k * 1.0, 1.0, -0.45], color: PAINT.gold, kind: "metal", seg: 14 });
      loaf(b, [-1.0 + k * 1.0, 1.04, -0.45], 0.14, "#b9783a");
    }
    for (const s of [-1, 1]) {
      b.cyl(0.14, 0.18, 1.2, { at: [s * 2.05, 0.6, 0.1], color: shade(SAND, -0.1), seg: 10 });
      bouquet(b, [s * 2.05, 1.2, 0.1], 1.0);
    }
  },

  min_chapel(b) {
    cavettoBlock(b, 1.8, 1.1, 1.4, shade(SAND, -0.05));
    // the god's tall double-plumed crown on its pedestal, between lettuce beds
    b.cyl(0.38, 0.42, 0.28, { at: [0, 1.25, 0], color: PAINT.red, seg: 16 });
    for (const s of [-1, 1]) b.box(0.3, 2.0, 0.06, { at: [s * 0.16, 2.35, 0], rot: [0, 0, s * 0.03], color: s > 0 ? PAINT.blue : PAINT.green, r: 0.04 });
    for (let k = 0; k < 6; k++) b.box(0.62, 0.02, 0.065, { at: [0, 1.6 + k * 0.3, 0.04], color: PAINT.gold, kind: "metal", r: 0 });
    b.cyl(0.16, 0.16, 0.04, { at: [0, 1.42, 0.38], rot: [Math.PI / 2, 0, 0], color: PAINT.gold, kind: "metal", seg: 14 });
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      b.box(0.5, 0.25, 0.5, { at: [s * 1.25, 0.125, -0.5 + k * 0.55], color: "#8a6a4a", r: 0.02 });
      b.sphere(0.2, { at: [s * 1.25, 0.42, -0.5 + k * 0.55], scale: [0.8, 1.4, 0.8], color: "#5f9a4a", seg: 8 });
    }
  },

  linen_room(b) {
    shelves(b, [0, 0, -0.55], 2.4, 2.5, 0.55, 4);
    const tones = [LINEN, "#e5dcc6", "#f4efe2", "#dccfb2"];
    for (let lv = 0; lv < 4; lv++) for (let k = 0; k < 5; k++) for (let j = 0; j < 3; j++) {
      b.box(0.38, 0.09, 0.42, { at: [-0.9 + k * 0.45, 0.16 + lv * 0.6 + j * 0.095, -0.55], color: tones[(k + j + lv) % 4], r: 0.03 });
    }
    // red and blue bands of the god's finest cloth draped over a pole
    b.cyl(0.03, 0.03, 2.0, { at: [0, 1.4, 0.55], rot: [0, 0, Math.PI / 2], color: CEDAR, seg: 6 });
    for (const s of [-1, 1]) b.cyl(0.04, 0.04, 1.4, { at: [s * 1.0, 0.7, 0.55], color: CEDAR, seg: 6 });
    b.box(1.8, 0.9, 0.03, { at: [0, 0.95, 0.55], color: LINEN, r: 0.01 });
    b.box(1.8, 0.08, 0.035, { at: [0, 0.6, 0.55], color: PAINT.red, r: 0 });
    b.box(1.8, 0.05, 0.035, { at: [0, 0.68, 0.55], color: PAINT.blue, r: 0 });
    for (let k = 0; k < 2; k++) b.cyl(0.25, 0.2, 0.4, { at: [-0.6 + k * 1.2, 0.2, 1.05], color: "#b98e4a", seg: 12 });
  },

  sacred_barque(b) {
    cavettoBlock(b, 1.6, 1.2, 3.6, RED_GRANITE, "gloss");
    b.group({ at: [0, 1.2, 0] }, (bb) => barque(bb, 5.2, { poles: true, grand: true }));
  },

  naos(b) {
    // a granite monolith shrine, hollowed out; its gilded doors stand open on the god's falcon image
    const g = "#4a4542";
    const W = 1.9, H = 3.4, D = 1.5, t = 0.22;
    b.box(2.2, 0.5, 1.8, { at: [0, 0.25, 0], color: shade(g, 0.08), kind: "gloss", r: 0.02 });
    for (const s of [-1, 1]) b.box(t, H, D, { at: [s * (W / 2 - t / 2), 0.5 + H / 2, -0.05], color: g, kind: "gloss", r: 0.02 });
    b.box(W, H, t, { at: [0, 0.5 + H / 2, -0.05 - D / 2 + t / 2], color: g, kind: "gloss", r: 0.02 });
    b.box(W - 2 * t, 0.5, D - t, { at: [0, 0.75, 0.06], color: g, kind: "gloss", r: 0.01 });
    b.box(W, 0.7, D, { at: [0, 0.5 + H - 0.35, -0.05], color: g, kind: "gloss", r: 0.02 });
    b.box(W - 2 * t - 0.02, H - 1.2, 0.02, { at: [0, 0.5 + 0.5 + (H - 1.2) / 2, -0.05 - D / 2 + t + 0.01], color: "#2a2018", r: 0 });
    b.box(2.1, 0.35, 1.7, { at: [0, 4.05, -0.05], color: shade(g, 0.06), kind: "gloss", r: 0.03 });
    b.cone(1.12, 0.7, { at: [0, 4.57, -0.05], rot: [0, Math.PI / 4, 0], color: shade(g, 0.04), kind: "gloss", seg: 4, scale: [1.0, 1, 0.8] });
    for (const s of [-1, 1]) {
      b.group({ at: [s * (W / 2 - t), 1.0, D / 2 - 0.05], rot: [0, s * 1.9, 0] }, (bb) =>
        bb.box(W / 2 - t, H - 1.25, 0.06, { at: [-s * (W / 2 - t) / 2, (H - 1.25) / 2, 0], color: PAINT.gold, kind: "metal", r: 0.01 }));
    }
    b.group({ at: [0, 1.0, -0.12], scale: 0.48 }, (bb) => falconFig(bb, { crown: "double", gold: true, pedestal: false }));
    b.group({ at: [0, 3.95, D / 2 - 0.02] }, (bb) => wingedDisc(bb, 0.28));
    oilLamp(b, [-0.7, 1.0, 0.45]);
    oilLamp(b, [0.7, 1.0, 0.45]);
  },

  khonsu(b) {
    cavettoBlock(b, 1.6, 1.0, 1.2, shade(SAND, -0.05));
    b.group({ at: [0, 1.0, 0], scale: 1.9 }, (bb) => figure(bb, { pose: "mummy", head: "moon", skin: "#c9c3b5" }));
    // a silver crescent and disc on a stand beside him
    b.cyl(0.04, 0.06, 1.8, { at: [1.1, 0.9, 0.3], color: EBONY, seg: 8 });
    b.torus(0.35, 0.07, { at: [1.1, 2.0, 0.3], arc: Math.PI, rot: [0, 0, Math.PI], color: "#e5e4df", kind: "metal", seg: 18 });
    b.cyl(0.26, 0.26, 0.05, { at: [1.1, 2.25, 0.3], rot: [Math.PI / 2, 0, 0], color: "#f2f1ec", kind: "metal", seg: 20 });
  },

  hathor(b, o, X) {
    // a Hathor pillar, a bronze mirror and a sistrum: the goddess of love and music
    b.box(1.2, 0.3, 1.2, { at: [0, 0.15, -0.6], color: shade(SAND, -0.05), r: 0.02 });
    b.group({ at: [0, 0.3, -0.6] }, (bb) => columnPiece(bb, { h: 3.0, r: 0.3, cap: "hathor", gilt: 1, c: SAND }, X));
    b.cyl(0.03, 0.05, 1.3, { at: [-0.8, 0.65, 0.4], color: EBONY, seg: 8 });
    b.cyl(0.26, 0.26, 0.03, { at: [-0.8, 1.55, 0.4], rot: [Math.PI / 2, 0, 0], scale: [1, 1.15, 1], color: "#d9b46a", kind: "metal", seg: 20 });
    b.group({ at: [0.85, 0.0, 0.4] }, (bb) => {
      bb.box(0.4, 0.8, 0.4, { at: [0, 0.4, 0], color: shade(SAND, -0.08), r: 0.02 });
      bb.cyl(0.03, 0.03, 0.5, { at: [0, 1.05, 0], color: PAINT.gold, kind: "metal", seg: 6 });
      bb.torus(0.15, 0.025, { at: [0, 1.42, 0], arc: Math.PI, rot: [0, 0, 0], color: PAINT.gold, kind: "metal", seg: 12, scale: [1, 1.5, 1] });
      for (let k = 0; k < 3; k++) bb.cyl(0.008, 0.008, 0.32, { at: [0, 1.33 + k * 0.09, 0], rot: [0, 0, Math.PI / 2], color: PAINT.gold, kind: "metal", seg: 4 });
      bb.sphere(0.1, { at: [0, 1.25, 0.02], scale: [0.85, 1, 0.5], color: PAINT.gold, kind: "metal", seg: 10 });
    });
  },

  isis(b) {
    cavettoBlock(b, 1.6, 0.9, 1.4, shade(SAND, -0.05));
    b.group({ at: [0, 0.9, -0.1], scale: 2.2 }, (bb) => figure(bb, { pose: "seat", head: "isis", skin: SKIN.woman, hold: "child" }));
    for (const s of [-1, 1]) flabellum(b, [s * 1.15, 0, -0.3], 2.4);
  },

  osiris(b) {
    // Osiris on his lion bier, mourned by Isis and Nephthys as two kites
    const gold = PAINT.gold;
    b.box(2.9, 0.15, 0.95, { at: [0, 0.95, 0], color: gold, kind: "metal", r: 0.02 });
    for (const s of [-1, 1]) {
      for (const z of [-0.35, 0.35]) b.cyl(0.06, 0.07, 0.9, { at: [s * 1.3, 0.45, z], color: gold, kind: "metal", seg: 8 });
    }
    b.group({ at: [1.5, 1.05, 0], rot: [0, Math.PI / 2, 0] }, (bb) => {
      bb.box(0.42, 0.42, 0.5, { at: [0, 0.18, 0.1], color: gold, kind: "metal", r: 0.12 });   // lion's head
      bb.sphere(0.12, { at: [0, 0.3, 0.38], color: gold, kind: "metal", seg: 8 });
    });
    b.box(0.3, 0.3, 0.12, { at: [-1.5, 1.05, 0], color: gold, kind: "metal", r: 0.03 });     // tail end
    b.group({ at: [-1.25, 1.03, 0], rot: [0, 0, -Math.PI / 2] }, (bb) => bb.group({ rot: [0, Math.PI / 2, 0], scale: 2.4 }, (k) =>
      figure(k, { pose: "mummy", head: "atef", skin: SKIN.osiris })));
    for (const s of [-1, 1]) {
      b.group({ at: [s * 1.55, 1.15, -0.4], rot: [0, -s * Math.PI / 2, 0], scale: 0.32 }, (bb) => falconFig(bb, { crown: "none", painted: true }));
    }
  },

  wings(b) {
    // the Spread Wings: Horus as the winged sun, filling the back wall over an altar
    b.group({ at: [0, 2.6, -0.9] }, (bb) => wingedDisc(bb, 1.0));
    cavettoBlock(b, 1.4, 1.0, 1.0, shade(SAND, -0.05), "matte", [0, 0, 0.2]);
    b.cyl(0.32, 0.26, 0.2, { at: [0, 1.1, 0.2], color: "#9c6b3c", kind: "metal", seg: 14 });
    flame(b, [0, 1.2, 0.2], 0.16);
    for (const s of [-1, 1]) flabellum(b, [s * 1.25, 0, 0.1], 2.3);
  },

  sokar(b) {
    // the henu barque of Sokar on its sledge: a tall antelope-headed prow, a falcon in the shrine
    b.box(3.4, 0.25, 0.25, { at: [0, 0.4, 0.55], rot: [0, Math.PI / 2, 0], color: CEDAR, r: 0.03 });
    for (const s of [-1, 1]) b.box(0.18, 0.2, 3.4, { at: [s * 0.55, 0.1, 0], color: CEDAR, r: 0.04 });
    for (const z of [-1.2, 0, 1.2]) b.box(1.3, 0.12, 0.18, { at: [0, 0.25, z], color: shade(CEDAR, -0.1), r: 0.02 });
    b.group({ at: [0, 0.3, 0] }, (bb) => {
      bb.box(0.9, 0.5, 2.8, { at: [0, 0.35, 0], color: faded(PAINT.green, SAND, 0.55), r: 0.12 });
      bb.cyl(0.08, 0.12, 1.6, { at: [0, 1.2, 1.35], rot: [0.25, 0, 0], color: PAINT.gold, kind: "metal", seg: 8 });
      bb.box(0.26, 0.24, 0.42, { at: [0, 2.0, 1.6], rot: [0.5, 0, 0], color: "#efe6d2", r: 0.06 });      // antelope head
      for (const s of [-1, 1]) bb.cone(0.03, 0.45, { at: [s * 0.08, 2.3, 1.5], rot: [-0.5, 0, s * 0.2], color: "#3a2a22", seg: 6 });
      for (let k = 0; k < 5; k++) bb.box(0.05, 0.3, 0.05, { at: [0, 0.75, -1.0 + k * 0.4], color: PAINT.gold, kind: "metal", r: 0.01 });   // the row of oars
      bb.box(0.7, 0.8, 0.8, { at: [0, 1.0, -0.2], color: PAINT.gold, kind: "metal", r: 0.03 });
      bb.group({ at: [0, 1.4, -0.2], scale: 0.3 }, (k) => falconFig(k, { crown: "none", gold: true, pedestal: false }));
    });
  },

  ra(b) {
    // the benben stone and the sun disc of Ra, gilded, on a tall stand
    cavettoBlock(b, 1.4, 1.2, 1.4, shade(SAND, -0.05));
    b.box(0.9, 0.9, 0.9, { at: [0, 1.65, 0], color: shade(SAND, 0.02), r: 0.02 });
    b.cone(0.64, 0.7, { at: [0, 2.45, 0], rot: [0, Math.PI / 4, 0], color: "#e6c463", kind: "metal", seg: 4 });
    b.cyl(0.5, 0.5, 0.1, { at: [0, 3.35, 0], rot: [Math.PI / 2, 0, 0], color: "#e0a33a", kind: "metal", seg: 28 });
    b.cyl(0.42, 0.42, 0.12, { at: [0, 3.35, 0.02], rot: [Math.PI / 2, 0, 0], color: "#f2c45a", kind: "glow", seg: 28 });
    b.capsule(0.06, 0.4, { at: [0, 2.95, 0.12], color: PAINT.gold, kind: "metal" });
    for (const s of [-1, 1]) b.group({ at: [s * 1.05, 0, 0.2], scale: 1.6 }, (bb) => {
      bb.sphere(0.22, { at: [0, 0.25, 0], scale: [0.85, 1.1, 0.75], color: "#7a6a5a", seg: 10 });     // baboons, who greet the sun
      bb.sphere(0.12, { at: [0, 0.52, 0.05], color: "#7a6a5a", seg: 8 });
      bb.box(0.08, 0.2, 0.06, { at: [s * 0.0 + 0.12, 0.55, 0.08], rot: [0, 0, -0.5], color: "#6a5a4a", r: 0.02 });
      bb.box(0.08, 0.2, 0.06, { at: [-0.12, 0.55, 0.08], rot: [0, 0, 0.5], color: "#6a5a4a", r: 0.02 });
    });
  },

  throne(b) {
    // the empty throne of the gods on a dais, with its footstool and two fans
    b.box(2.4, 0.35, 2.0, { at: [0, 0.175, 0], color: shade(SAND, -0.06), r: 0.02 });
    b.group({ at: [0, 0.35, -0.2] }, (bb) => {
      bb.box(1.0, 0.75, 0.95, { at: [0, 0.375, 0], color: PAINT.gold, kind: "metal", r: 0.02 });
      bb.box(1.0, 0.85, 0.12, { at: [0, 0.75 + 0.42, -0.42], color: PAINT.gold, kind: "metal", r: 0.02 });
      for (const s of [-1, 1]) for (let k = 0; k < 6; k++) bb.box(0.02, 0.1, 0.8, { at: [s * 0.51, 0.1 + k * 0.11, 0], color: k % 2 ? PAINT.lapis : PAINT.red, r: 0 });
      bb.box(0.9, 0.06, 0.85, { at: [0, 0.78, 0.02], color: PAINT.red, r: 0.02 });   // cushion
      bb.box(0.8, 0.15, 0.4, { at: [0, 0.075, 0.75], color: EBONY, r: 0.02 });       // footstool
    });
    for (const s of [-1, 1]) flabellum(b, [s * 1.0, 0.35, -0.7], 2.2);
  },

  victor(b) {
    // Horus, falcon-headed, spears Seth as a small hippopotamus in the reeds
    b.box(2.2, 0.35, 2.4, { at: [0, 0.175, 0], color: shade(SAND, -0.06), r: 0.02 });
    b.box(2.0, 0.04, 2.2, { at: [0, 0.37, 0], color: "#3f8794", kind: "gloss", r: 0 });
    b.group({ at: [-0.2, 0.35, -0.3], scale: 2.4 }, (bb) => figure(bb, { pose: "stride", head: "falcon", hold: "spear", skin: SKIN.man }));
    b.group({ at: [0.15, 0.36, 1.1], rot: [0, 0.5, 0] }, (bb) => {
      bb.sphere(0.32, { at: [0, 0.18, 0], scale: [0.85, 0.6, 1.3], color: "#8a6a5a", seg: 12 });
      bb.sphere(0.2, { at: [0, 0.22, 0.42], scale: [1, 0.8, 1], color: "#8a6a5a", seg: 10 });
    });
    for (let k = 0; k < 7; k++) b.cyl(0.015, 0.02, 0.9 + (k % 3) * 0.2, { at: [0.85 + (k % 2) * 0.12, 0.8, 0.6 - k * 0.2], color: "#5f8a4a", seg: 4 });
  },

  lake(b, o, X) {
    basin(b, o, X, { stairs: ["n", "s", "e", "w"], stairW: 7, top: 0.15 });
  },

  nilometer(b, o, X) {
    // a square shaft with a stair running down its walls to the river's level; cubit marks on the stone
    const { w, d, depth } = o;
    const sm = stoneMat("plain", "#c9ab84");
    for (const [x, z, len, yaw] of [[0, -d / 2, w, 0], [0, d / 2, w, Math.PI], [-w / 2, 0, d, Math.PI / 2], [w / 2, 0, d, -Math.PI / 2]]) {
      const g = new THREE.BoxGeometry(len + 0.5, depth + 0.7, 0.5);
      const uv = g.attributes.uv, pos = g.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + len) / sm.tile[0], pos.getY(i) / sm.tile[1]);
      g.translate(0, 0.7 - (depth + 0.7) / 2, -0.25);
      g.rotateY(yaw);
      g.translate(x, 0, z);
      X.surface(b, sm.key, sm.mat, g);
    }
    // the stair: down the west, south and east walls
    const step = 0.32;
    let y = 0, k = 0;
    const path = [];
    for (let i = 0; i < 9; i++) path.push([-w / 2 + 0.45, -d / 2 + 0.5 + i * 0.36, 0]);
    for (let i = 0; i < 8; i++) path.push([-w / 2 + 0.6 + i * 0.36, d / 2 - 0.45, 0]);
    for (let i = 0; i < 8; i++) path.push([w / 2 - 0.45, d / 2 - 0.6 - i * 0.36, 0]);
    for (const [x, z] of path) {
      y -= step * 0.85;
      b.box(0.8, 0.25, 0.4, { at: [x, y, z], color: shade("#c9ab84", -0.02 - k * 0.004), r: 0.01 });
      k++;
    }
    for (let m = 0; m < 12; m++) b.box(0.4, 0.04, 0.02, { at: [0.6, -0.4 - m * 0.52, -d / 2 + 0.01], color: m % 2 ? PAINT.red : "#2a2522", r: 0 });
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    g.translate(0, -depth + 0.6, 0);
    X.surface(b, "water|#3f6f6a", SPECIAL.water("#2f6a68"), g, { shadow: false });
    b.box(w, 0.2, d, { at: [0, -depth + 0.4, 0], color: "#4a4030", r: 0 });
    // curb
    for (const [x, z, ww, dd] of [[0, -d / 2 - 0.25, w + 1, 0.5], [0, d / 2 + 0.25, w + 1, 0.5], [-w / 2 - 0.25, 0, 0.5, d], [w / 2 + 0.25, 0, 0.5, d]]) {
      b.box(ww, 0.7, dd, { at: [x, 0.35, z], color: shade("#c9ab84", 0.03), r: 0.03 });
    }
  },

  scarab(b) {
    scarabFig(b);
  },

  palm(b, o, X) {
    const h = o.h || 9, lean = o.lean || 0;
    const rng = b.rng;
    const pts = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      pts.push([lean * h * t * t, h * t, lean * 0.3 * h * t * t]);
    }
    // the trunk: rough rings of old leaf bases
    for (let k = 0; k < 8; k++) {
      const r0 = 0.25 - k * 0.012, r1 = 0.25 - (k + 1) * 0.012;
      b.rod(pts[k], pts[k + 1], r0, { r2: r1, color: k % 2 ? "#7d6046" : "#6e543c", seg: 9 });
      for (let j = 0; j < 2; j++) {
        const y = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * (j / 2);
        const x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * (j / 2), z = pts[k][2] + (pts[k + 1][2] - pts[k][2]) * (j / 2);
        b.cyl(r0 * 1.14, r0 * 0.98, 0.2, { at: [x, y + 0.1, z], color: j % 2 ? "#6a4f37" : "#5d4532", seg: 8, open: true });
      }
    }
    const top = pts[8];
    b.sphere(0.4, { at: [top[0], top[1] + 0.05, top[2]], scale: [1, 0.8, 1], color: "#6b5a38", seg: 9 });
    // dates hanging under the crown
    for (let k = 0; k < 4; k++) {
      const a = rng() * Math.PI * 2;
      b.sphere(0.24, { at: [top[0] + Math.cos(a) * 0.42, top[1] - 0.35, top[2] + Math.sin(a) * 0.42], scale: [0.85, 1.35, 0.85], color: k % 2 ? "#c9742f" : "#a85a26", seg: 7 });
    }
    // fronds: bent strips folded into a shallow V, carrying the leaflet texture
    const variant = (o.seed || 0) % 2;
    const tex = frondTexture(variant);
    const mat = frondMat(variant, tex.map);
    const pos = [], uv = [];
    const n = 16;
    for (let k = 0; k < n; k++) {
      const yaw = (k / n) * Math.PI * 2 + rng() * 0.35;
      const tier = k % 3;
      let pitch = tier === 0 ? 0.95 : tier === 1 ? 0.45 : 0.05;
      pitch += rng.range(-0.12, 0.12);
      const len = 3.4 + rng() * 1.4 - (tier === 0 ? 0.6 : 0);
      const width = 1.25 + rng() * 0.3;
      const segs = 6;
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      let px = 0, py = 0, pz = 0, pp = pitch;
      const ring = [];
      for (let s2 = 0; s2 <= segs; s2++) {
        const t = s2 / segs;
        const wv = width * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.05)));
        const fold = 0.32 + 0.1 * t;
        // centre on the midrib, edges out to the sides and slightly up (the V)
        const rx = cy, rz = -sy;                     // the frond's sideways direction
        const C = [top[0] + sy * px, top[1] + 0.2 + py, top[2] + cy * px];
        const L = [C[0] - rx * wv / 2, C[1] + wv / 2 * Math.sin(fold), C[2] - rz * wv / 2];
        const R = [C[0] + rx * wv / 2, C[1] + wv / 2 * Math.sin(fold), C[2] + rz * wv / 2];
        ring.push([L, C, R, t]);
        const sl = len / segs;
        px += Math.cos(pp) * sl;
        py += Math.sin(pp) * sl;
        pp -= 0.2 + t * 0.32;
      }
      for (let s2 = 0; s2 < segs; s2++) {
        const [L0, C0, R0, t0] = ring[s2], [L1, C1, R1, t1] = ring[s2 + 1];
        pos.push(...L0, ...C0, ...C1, ...L0, ...C1, ...L1);
        uv.push(0, t0, 0.5, t0, 0.5, t1, 0, t0, 0.5, t1, 0, t1);
        pos.push(...C0, ...R0, ...R1, ...C0, ...R1, ...C1);
        uv.push(0.5, t0, 1, t0, 1, t1, 0.5, t0, 1, t1, 0.5, t1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    X.surface(b, `frond|${variant}`, mat, g, { shadow: false });
  },

  wall_lamp(b) {
    // an oil lamp on a bracket fixed to the wall (the piece faces away from the wall)
    b.box(0.2, 0.08, 0.35, { at: [0, 2.4, 0.15], color: "#8a5c32", kind: "metal", r: 0.02 });
    b.rod([0, 2.1, 0.02], [0, 2.4, 0.28], 0.025, { color: "#8a5c32", kind: "metal", seg: 6 });
    oilLamp(b, [0, 2.45, 0.28]);
  },

  light_shaft(b, o, X) {
    // daylight falling through a slot in the roof: a soft beam and a bright patch on the floor
    const h = o.top - 0.05;
    const g = new THREE.BoxGeometry(o.w, h, o.d);
    g.translate(0, h / 2, 0);
    X.surface(b, "beam", beamMat(), g, { shadow: false });
    const p = new THREE.PlaneGeometry(o.w * 1.4, o.d * 1.05);
    p.rotateX(-Math.PI / 2);
    p.translate(0, 0.02, 0);
    X.surface(b, "beam-floor", floorGlowMat(), p, { shadow: false });
  },
};

const FROND = new Map();
function frondMat(variant, map) {
  let m = FROND.get(variant);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, envMapIntensity: 0.4 });
    FROND.set(variant, m);
  }
  return m;
}

let BEAM = null, FLOOR_GLOW = null;
function beamMat() {
  if (!BEAM) BEAM = new THREE.MeshBasicMaterial({ color: "#fff1d0", transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  return BEAM;
}
function floorGlowMat() {
  if (!FLOOR_GLOW) FLOOR_GLOW = new THREE.MeshBasicMaterial({ color: "#ffe7b8", transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2 });
  return FLOOR_GLOW;
}

let OBMAT = null;
function obeliskTextureMat() {
  if (!OBMAT) {
    const t = obeliskTexture(RED_GRANITE);
    OBMAT = { key: "obelisk-face", tile: t.tile, mat: new THREE.MeshStandardMaterial({ map: t.map, roughness: 0.42, envMapIntensity: 0.8 }) };
  }
  return OBMAT;
}

// ── shared bodies ────────────────────────────────────────────────────────────
/** A processional barque `L` long: gilded hull, falcon heads fore and aft, a veiled shrine amidships. */
function barque(b, L, { poles = false, grand = false } = {}) {
  const gold = PAINT.gold;
  const segs = 12;
  for (let k = 0; k < segs; k++) {
    const t = (k + 0.5) / segs, e = Math.abs(t - 0.5) * 2;
    const z = (t - 0.5) * L;
    const w = 0.85 * Math.sqrt(1 - e * e * 0.85);
    const y = 0.15 + Math.pow(e, 4) * 0.7;
    b.box(w, 0.32, L / segs + 0.02, { at: [0, y, z], color: gold, kind: "metal", r: 0.05 });
  }
  for (const s of [-1, 1]) {
    b.group({ at: [0, 0.75, s * (L / 2 - 0.15)] }, (bb) => {
      bb.cyl(0.32, 0.36, 0.08, { at: [0, 0.0, 0], color: gold, kind: "metal", seg: 14 });   // the aegis collar
      bb.sphere(0.2, { at: [0, 0.25, 0], color: gold, kind: "metal", seg: 10 });
      bb.cone(0.07, 0.16, { at: [0, 0.22, s * 0.22], rot: [s * (Math.PI / 2 + 0.6), 0, 0], color: shade(gold, -0.12), kind: "metal", seg: 6 });
      bb.cyl(0.18, 0.18, 0.03, { at: [0, 0.52, 0], rot: [Math.PI / 2, 0, 0], color: "#d9442f", seg: 14 });
    });
  }
  // the shrine, veiled in linen, with a canopy frame
  b.box(0.75, 0.75, 1.1, { at: [0, 0.68, 0], color: gold, kind: "metal", r: 0.02 });
  b.box(0.95, 0.9, 1.3, { at: [0, 0.78, 0], color: "#f1ece0", r: 0.06 });
  b.box(0.96, 0.08, 1.32, { at: [0, 1.0, 0], color: PAINT.lapis, r: 0.01 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.03, 0.03, 1.0, { at: [sx * 0.55, 0.85, sz * 0.75], color: gold, kind: "metal", seg: 6 });
  b.box(1.2, 0.05, 1.7, { at: [0, 1.36, 0], color: gold, kind: "metal", r: 0.01 });
  if (grand) for (const s of [-1, 1]) b.group({ at: [s * 0.28, 0.32, 1.0], scale: 0.7 }, (bb) => figure(bb, { pose: "kneel", head: "wig", skin: SKIN.gold, stone: PAINT.gold }));
  if (poles) {
    for (const x of [-0.6, 0, 0.6]) b.box(0.08, 0.08, L * 0.95, { at: [x, 0.02, 0], color: CEDAR, r: 0.02 });
    for (const z of [-L * 0.3, L * 0.3]) b.box(1.6, 0.1, 0.1, { at: [0, -0.04, z], color: CEDAR, r: 0.02 });
  }
}

/** The granite falcon of Horus. */
export function falconFig(b, o = {}) {
  const g = o.gold ? PAINT.gold : o.painted ? "#8a7458" : "#67615b";
  const kind = o.gold ? "metal" : "gloss";
  if (o.pedestal !== false) {
    b.box(1.9, 0.9, 2.6, { at: [0, 0.45, 0], color: o.gold ? shade("#3f3b39", 0.05) : shade(g, 0.03), kind: "gloss", r: 0.04 });
    b.box(2.05, 0.12, 2.75, { at: [0, 0.94, 0], color: o.gold ? shade("#3f3b39", 0.1) : shade(g, 0.07), kind: "gloss", r: 0.03 });
  }
  b.group({ at: [0, o.pedestal === false ? 0 : 1.0, -0.1] }, (bb) => {
    for (const s of [-1, 1]) {
      bb.box(0.22, 0.25, 0.28, { at: [s * 0.24, 0.12, 0.38], color: g, kind, r: 0.06 });
      bb.cyl(0.08, 0.1, 0.45, { at: [s * 0.24, 0.45, 0.25], color: g, kind, seg: 10 });
    }
    bb.sphere(0.72, { at: [0, 1.35, 0.05], scale: [0.72, 1.12, 0.92], color: g, kind, seg: 20 });
    bb.sphere(0.5, { at: [0, 1.62, 0.32], scale: [0.85, 1.0, 0.8], color: o.painted ? "#d9cbb0" : g, kind, seg: 16 });
    for (const s of [-1, 1]) {
      bb.sphere(0.62, { at: [s * 0.36, 1.25, -0.25], scale: [0.35, 1.0, 1.35], rot: [0.4, 0, 0], color: shade(g, -0.03), kind, seg: 16 });
    }
    bb.box(0.42, 0.95, 0.16, { at: [0, 0.55, -0.82], rot: [-0.35, 0, 0], color: shade(g, -0.03), kind, r: 0.06 });
    bb.sphere(0.36, { at: [0, 2.22, 0.3], scale: [0.9, 0.92, 1.05], color: g, kind, seg: 16 });
    bb.cone(0.13, 0.32, { at: [0, 2.12, 0.66], rot: [Math.PI / 2 + 0.8, 0, 0], color: shade(g, -0.06), kind, seg: 10 });
    for (const s of [-1, 1]) {
      bb.sphere(0.06, { at: [s * 0.21, 2.26, 0.5], color: "#1e1b19", kind: "gloss", seg: 8 });
      bb.box(0.05, 0.22, 0.04, { at: [s * 0.24, 2.08, 0.5], rot: [0.2, 0, 0], color: shade(g, -0.12), kind, r: 0.01 });
    }
    if (o.crown === "double") {
      const red = o.gold ? PAINT.red : shade(g, -0.02), white = o.gold ? "#efe9dc" : shade(g, 0.06);
      bb.cyl(0.42, 0.4, 0.36, { at: [0, 2.68, 0.22], color: red, kind, seg: 16 });
      bb.box(0.3, 0.66, 0.15, { at: [0, 3.0, -0.12], color: red, kind, r: 0.03 });
      bb.lathe([[0.3, 0], [0.31, 0.36], [0.24, 0.84], [0.13, 1.14], [0.0, 1.23]], { at: [0, 2.7, 0.27], color: white, kind, seg: 14 });
    } else if (o.crown === "disc") {
      bb.cyl(0.42, 0.42, 0.1, { at: [0, 2.95, 0.2], rot: [Math.PI / 2, 0, 0], color: PAINT.gold, kind: "metal", seg: 28 });
      bb.capsule(0.05, 0.25, { at: [0, 2.62, 0.32], color: PAINT.gold, kind: "metal" });
    }
  });
}

function scarabFig(b) {
  const g = "#57524c";
  const kind = "gloss";
  b.box(3.0, 1.1, 3.6, { at: [0, 0.55, 0], color: shade(g, 0.08), kind, r: 0.06 });
  b.box(3.15, 0.12, 3.75, { at: [0, 1.16, 0], color: shade(g, 0.12), kind, r: 0.04 });
  b.group({ at: [0, 1.22, 0] }, (bb) => {
    bb.sphere(1.25, { at: [0, 0.18, -0.25], scale: [0.95, 0.45, 1.2], color: g, kind, seg: 24 });
    bb.box(0.04, 0.45, 2.6, { at: [0, 0.62, -0.3], color: shade(g, -0.15), kind, r: 0.01 });
    bb.sphere(0.72, { at: [0, 0.22, 1.05], scale: [1.1, 0.5, 0.65], color: g, kind, seg: 18 });
    bb.sphere(0.45, { at: [0, 0.18, 1.62], scale: [1.4, 0.42, 0.7], color: g, kind, seg: 14 });
    for (let k = 0; k < 6; k++) bb.box(0.12, 0.1, 0.28, { at: [-0.55 + k * 0.22, 0.12, 1.98], color: shade(g, -0.05), kind, r: 0.03 });
    for (const s of [-1, 1]) for (const z of [-0.9, 0.0, 0.85]) {
      bb.box(0.65, 0.12, 0.16, { at: [s * 1.25, 0.04, z], rot: [0, s * 0.3, -s * 0.25], color: shade(g, -0.06), kind, r: 0.04 });
    }
  });
}
