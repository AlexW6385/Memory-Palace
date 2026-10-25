// Egyptian architecture: battered walls with torus rolls and cavetto cornices, columns
// with carved shafts and plant capitals, flat roofs painted with stars, door frames
// with winged discs, architraves. Textured surfaces go to the chunk as UV-mapped
// geometry; everything else is vertex-coloured kit geometry.
import * as THREE from "three";
import { shade, mix } from "../props/kit.js";
import { stoneTexture, ceilingTexture, corniceTexture } from "./egypt-tex.js";

export const PAINT = {
  blue: "#3c6496", green: "#4f8a69", red: "#a5503a", ochre: "#c99a45", gold: "#d6a845", lapis: "#2c4a8c",
  turquoise: "#3f9a96", black: "#2a2522", white: "#efe6d2",
};

/** Faded paint on sandstone: the colour as it survives today. */
export function faded(paint, stone = "#d4b385", t = 0.42) {
  return mix(stone, paint, t);
}

// ── materials ────────────────────────────────────────────────────────────────
const MATS = new Map();
function mat(key, make) {
  let m = MATS.get(key);
  if (!m) MATS.set(key, (m = make()));
  return m;
}

export function stoneMat(kind, color) {
  const t = stoneTexture(kind, color);
  return { key: `eg-stone|${kind}|${color}`, tile: t.tile, mat: mat(`eg-stone|${kind}|${color}`, () =>
    new THREE.MeshStandardMaterial({ map: t.map, roughness: kind === "granite" ? 0.45 : 0.93, envMapIntensity: 0.45 })) };
}

function corniceMat(color, painted) {
  const t = corniceTexture(color, painted);
  return { key: `eg-cornice|${color}|${painted}`, tile: t.tile, mat: mat(`eg-cornice|${color}|${painted}`, () =>
    new THREE.MeshStandardMaterial({ map: t.map, roughness: 0.9, envMapIntensity: 0.45 })) };
}

function ceilingMat(kind) {
  const t = ceilingTexture(kind);
  return { key: `eg-ceiling|${kind}`, tile: t.tile, mat: mat(`eg-ceiling|${kind}`, () =>
    new THREE.MeshStandardMaterial({ map: t.map, roughness: 0.95, side: THREE.DoubleSide, envMapIntensity: 0.3 })) };
}

// ── geometry helpers ─────────────────────────────────────────────────────────
function geometryFrom(pos, uv) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

function quad(pos, uv, a, b, c, d, ua, ub, uc, ud) {
  // a b c d counter-clockwise seen from outside
  pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  uv.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ud);
}

/**
 * Rectangular rings (half sizes hx, hz at height y) joined into a closed loft, outward faces only.
 * rings: [{ hx, hz, y, v }]; u runs along the perimeter in metres / uTile, starting at uOffset.
 * cap: close the top ring with a flat face.
 */
function loft(rings, { uTile = 1, vTile = null, uOffset = 0, cap = false }) {
  const pos = [], uv = [];
  for (let k = 0; k < rings.length - 1; k++) {
    const A = rings[k], B = rings[k + 1];
    const va = vTile ? A.y / vTile : A.v, vb = vTile ? B.y / vTile : B.v;
    // corners counter-clockwise from above, starting at (-x, +z)
    const cornersA = [[-A.hx, A.hz], [A.hx, A.hz], [A.hx, -A.hz], [-A.hx, -A.hz]];
    const cornersB = [[-B.hx, B.hz], [B.hx, B.hz], [B.hx, -B.hz], [-B.hx, -B.hz]];
    let u = uOffset;
    for (let s = 0; s < 4; s++) {
      const n = (s + 1) % 4;
      const len = Math.hypot(cornersA[n][0] - cornersA[s][0], cornersA[n][1] - cornersA[s][1]);
      const u1 = u + len / uTile;
      quad(pos, uv,
        [cornersA[s][0], A.y, cornersA[s][1]], [cornersA[n][0], A.y, cornersA[n][1]],
        [cornersB[n][0], B.y, cornersB[n][1]], [cornersB[s][0], B.y, cornersB[s][1]],
        [u, va], [u1, va], [u1, vb], [u, vb]);
      u = u1;
    }
  }
  if (cap) {
    const T = rings[rings.length - 1];
    quad(pos, uv, [-T.hx, T.y, T.hz], [T.hx, T.y, T.hz], [T.hx, T.y, -T.hz], [-T.hx, T.y, -T.hz],
      [-T.hx / uTile, T.hz / uTile], [T.hx / uTile, T.hz / uTile], [T.hx / uTile, -T.hz / uTile], [-T.hx / uTile, -T.hz / uTile]);
  }
  return geometryFrom(pos, uv);
}

function placed(geo, x, y, z, yaw = 0) {
  geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1)));
  return geo;
}

// ── walls ────────────────────────────────────────────────────────────────────
/** The cavetto cornice profile (outset, height) for a cornice of height H, starting at the torus roll. */
function corniceRings(hx, hz, y, H) {
  const pts = [];
  const n = 7;
  // torus roll: a half round of radius r
  const r = H * 0.12;
  for (let k = 0; k <= 4; k++) {
    const a = -Math.PI / 2 + (k / 4) * Math.PI;
    pts.push([Math.cos(a) * r, r + Math.sin(a) * r, 0]);
  }
  // the cavetto: a quarter hollow flaring out
  const base = 2 * r, cav = H * 0.7, out = H * 0.62;
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    pts.push([out * (1 - Math.cos(t * Math.PI / 2)) ** 1.15, base + cav * Math.sin(t * Math.PI / 2) ** 0.9, t]);
  }
  // the flat fillet on top
  pts.push([out, base + cav + 0.001, 1]);
  pts.push([out - H * 0.04, base + cav + H * 0.04, 1]);
  pts.push([out - H * 0.04, H, 1]);
  return pts.map(([o, yy, v]) => ({ hx: hx + o, hz: hz + o, y: y + yy, v: 0.06 + 0.84 * v }));
}

export function addEwall(ch, p) {
  const [cx, y0, cz] = p.p;
  const { w, d, h } = p;
  const bat = p.bat || 0;
  const alongX = w >= d;
  const corH = p.cor ? Math.max(0.45, Math.min(2.8, h * 0.085, Math.max(w, d) * 0.6)) : 0;
  const bodyH = h - corH;
  const shrink = bat * (bodyH / h);
  const tx = alongX ? (p.ends ? shrink : 0) : shrink;
  const tz = alongX ? shrink : (p.ends ? shrink : 0);
  const kind = p.tex || "relief";
  const sm = stoneMat(kind, p.c);
  ch.maxY = Math.max(ch.maxY, y0 + h);
  // body: a frustum, u running around it in metres, v from the ground so registers line up
  const rings = [
    { hx: w / 2, hz: d / 2, y: 0 },
    { hx: w / 2 - tx, hz: d / 2 - tz, y: bodyH },
  ];
  const vt = sm.tile[1];
  const body = loft(rings.map((r) => ({ ...r, y: r.y })), { uTile: sm.tile[0], uOffset: (cx * 0.13 + cz * 0.29) % 1, cap: !p.cor });
  // shift v so that it counts from y = 0 in the world
  const uv = body.attributes.uv, pos = body.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    const ny = body.attributes.normal.getY(i);
    if (Math.abs(ny) < 0.9) uv.setY(i, (pos.getY(i) + y0) / vt);
  }
  ch.surface(sm.key, sm.mat, placed(body, cx, y0, cz));
  const top = { hx: w / 2 - tx, hz: d / 2 - tz };
  if (p.cor) {
    const cm = corniceMat(shade(p.c, 0.03), kind === "painted");
    const cr = corniceRings(top.hx, top.hz, bodyH, corH);
    const cg = loft(cr, { uTile: cm.tile[0], cap: true });
    ch.surface(cm.key, cm.mat, placed(cg, cx, y0, cz));
  }
  if (p.tor) {
    // torus rolls down the vertical corners
    const rr = Math.min(0.32, Math.max(0.12, h * 0.011));
    ch.solid.group({ at: [cx, y0, cz] }, (b) => {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        b.rod([sx * w / 2, 0, sz * d / 2], [sx * top.hx, bodyH, sz * top.hz], rr,
          { color: shade(p.c, 0.04), seg: 8 });
      }
    });
  }
  if (p.top === "disc") {
    // a winged sun disc on the cornice, over the middle of both long faces
    for (const s of [-1, 1]) {
      const yaw = alongX ? (s > 0 ? 0 : Math.PI) : (s > 0 ? Math.PI / 2 : -Math.PI / 2);
      const off = (alongX ? top.hz : top.hx) + corH * 0.35;
      const ox = alongX ? 0 : s * off, oz = alongX ? s * off : 0;
      ch.solid.group({ at: [cx + ox, y0 + bodyH + corH * 0.5, cz + oz], rot: [0, yaw, 0] }, (b) => wingedDisc(b, corH * 1.5));
    }
  }
}

/** A winged sun disc facing +z, about `size` wide per wing… roughly 3.2·size across. */
export function wingedDisc(b, size, { gold = PAINT.gold } = {}) {
  b.cyl(size * 0.2, size * 0.2, size * 0.06, { at: [0, 0, 0.03], rot: [Math.PI / 2, 0, 0], color: gold, kind: "metal", seg: 24 });
  for (const s of [-1, 1]) {
    // two uraei
    b.capsule(size * 0.035, size * 0.16, { at: [s * size * 0.24, -size * 0.1, 0.05], color: gold, kind: "metal" });
    // wings: three bands of feathers, sweeping slightly up at the tips
    const bands = [[PAINT.blue, 0.12], [PAINT.green, 0.08], [PAINT.red, 0.06]];
    let yy = size * 0.08;
    for (const [c, hh] of bands) {
      const shape = [[s * size * 0.22, yy], [s * size * 1.6, yy + size * 0.1], [s * size * 1.62, yy - hh * size],
        [s * size * 0.22, yy - hh * size * 1.1]];
      b.extrude(s > 0 ? shape : shape.slice().reverse(), size * 0.04, { color: faded(c, "#d4b385", 0.7), at: [0, 0, 0.02], bevel: 0 });
      yy -= hh * size;
    }
  }
}

// ── roofs ────────────────────────────────────────────────────────────────────
export function roofPiece(b, o, X) {
  const { w, d, th } = o;
  const c = o.c || "#d3b386";
  // the slab, in blocks running across the hall
  b.box(w + 0.1, th, d + 0.1, { at: [0, th / 2, 0], color: shade(c, -0.04), r: 0 });
  const n = Math.max(1, Math.round(d / 1.8));
  for (let k = 0; k <= n; k++) b.box(w + 0.12, th * 0.18, 0.06, { at: [0, th + 0.01, -d / 2 + (d * k) / n], color: shade(c, -0.12), r: 0 });
  // the painted ceiling just under it
  const cm = ceilingMat(o.ceil || "stars");
  const g = new THREE.PlaneGeometry(w - 0.02, d - 0.02, 1, 1);
  g.rotateX(Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / cm.tile[0], uv.getY(i) * d / cm.tile[1]);
  g.translate(0, -0.015, 0);
  X.surface(b, cm.key, cm.mat, g, { shadow: false });
}

// ── columns ──────────────────────────────────────────────────────────────────
const CAP_PAINTS = [
  [PAINT.green, PAINT.blue, PAINT.red],
  [PAINT.blue, PAINT.green, PAINT.ochre],
  [PAINT.green, PAINT.red, PAINT.blue],
];

/** Shaft as a textured lathe: carved with scenes like the walls. */
function shaftGeometry(r, hShaft, tile) {
  const pts = [];
  const prof = [[0, 0.92], [0.012, 1.0], [0.05, 1.04], [0.1, 1.0], [0.16, 0.985], [1, 0.93]];
  for (const [t, k] of prof) pts.push(new THREE.Vector2(r * k, t * hShaft));
  const seg = 28;
  const g = new THREE.LatheGeometry(pts, seg);
  const uv = g.attributes.uv, pos = g.attributes.position;
  const circ = 2 * Math.PI * r;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ / tile[0], pos.getY(i) / tile[1]);
  return g;
}

function bands(b, r, y, n, color) {
  for (let k = 0; k < n; k++) b.torus(r * 0.96, r * 0.07, { at: [0, y + k * r * 0.16, 0], rot: [Math.PI / 2, 0, 0], color, seg: 28 });
}

function bell(b, rn, rt, h, y, colors, lip = true) {
  // campaniform papyrus capital in painted tiers (sepals, petals, rim)
  const tiers = colors.length;
  const prof = (t) => rn + (rt - rn) * Math.pow(t, 1.7);
  for (let k = 0; k < tiers; k++) {
    const t0 = k / tiers, t1 = (k + 1) / tiers;
    const pts = [];
    for (let s = 0; s <= 4; s++) {
      const t = t0 + (t1 - t0) * (s / 4);
      pts.push([prof(t), y + t * h]);
    }
    b.lathe(pts, { color: colors[k], seg: 28 });
  }
  if (lip) b.cyl(rt * 1.01, rt * 0.98, h * 0.05, { at: [0, y + h, 0], color: shade(colors[colors.length - 1], -0.05), seg: 28 });
}

function lobes(b, n, R, y, size, color, tilt = 0.5, phase = 0) {
  for (let k = 0; k < n; k++) {
    const a = phase + (k / n) * Math.PI * 2;
    b.group({ at: [Math.sin(a) * R, y, Math.cos(a) * R], rot: [tilt, a, 0], order: "YXZ" }, (bb) => {
      bb.sphere(size, { scale: [0.7, 1.6, 0.45], color, seg: 10 });
    });
  }
}

export function columnPiece(b, o, X) {
  const { h, r } = o;
  const stone = o.c || "#d3b386";
  const cap = o.cap || "open";
  const gilt = !!o.gilt;
  const capH = cap === "palm" ? h * 0.2 : cap === "hathor" ? h * 0.26 : h * 0.21;
  const abH = h * 0.045;
  const shaftH = h - capH - abH - r * 0.4;
  const base = r * 0.4;
  // base disc
  b.cyl(r * 1.32, r * 1.38, base, { at: [0, base / 2, 0], color: shade(stone, -0.03), seg: 28 });
  // shaft (textured)
  const sm = stoneMat("relief", gilt ? mix(stone, "#e3b54e", 0.55) : stone);
  const g = shaftGeometry(r, shaftH, [sm.tile[0] * 0.55, sm.tile[1] * 0.55]);
  g.translate(0, base, 0);
  X.surface(b, sm.key, sm.mat, g);
  const ty = base + shaftH;
  const pal = CAP_PAINTS[(Math.round(h * 7 + r * 13) + cap.length) % CAP_PAINTS.length];
  const P = (c) => gilt ? mix(PAINT.gold, c, 0.25) : faded(c, stone, 0.5);
  bands(b, r * 0.93, ty - r * 0.85, 5, gilt ? PAINT.gold : faded(PAINT.ochre, stone, 0.35));
  const top = ty + capH;
  switch (cap) {
    case "open":
    case "open2":
      bell(b, r * 0.92, r * 1.85, capH, ty, [P(pal[0]), P(pal[1]), P(pal[2])]);
      if (cap === "open2") lobes(b, 16, r * 1.45, ty + capH * 0.62, r * 0.2, P(pal[1]), 0.85);
      break;
    case "papyrus_bud": {
      const pts = [[r * 0.92, 0], [r * 1.16, capH * 0.28], [r * 1.22, capH * 0.5], [r * 1.05, capH * 0.78], [r * 0.7, capH]];
      b.lathe(pts.map(([rr, y]) => [rr, ty + y]), { color: P(pal[0]), seg: 28 });
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        b.group({ at: [0, ty, 0], rot: [0, a, 0] }, (bb) => bb.box(r * 0.08, capH * 0.8, r * 0.1,
          { at: [0, capH * 0.42, r * 1.12], rot: [-0.08, 0, 0], color: P(pal[1]), r: 0.02 }));
      }
      break;
    }
    case "lotus": {
      b.cyl(r * 1.05, r * 0.92, capH * 0.25, { at: [0, ty + capH * 0.125, 0], color: P(pal[2]), seg: 24 });
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        b.group({ at: [Math.sin(a) * r * 0.62, ty + capH * 0.55, Math.cos(a) * r * 0.62], rot: [0, a, 0] }, (bb) =>
          bb.sphere(r * 0.5, { scale: [0.75, 1.5, 0.75], color: k % 2 ? P(pal[0]) : P(pal[1]), seg: 12 }));
      }
      b.cyl(r * 0.75, r * 0.9, capH * 0.12, { at: [0, top - capH * 0.06, 0], color: P(pal[2]), seg: 24 });
      break;
    }
    case "palm": {
      b.cyl(r * 0.95, r * 0.92, capH * 0.3, { at: [0, ty + capH * 0.15, 0], color: P(pal[2]), seg: 24 });
      const n = 9;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        b.group({ at: [0, ty + capH * 0.2, 0], rot: [0, a, 0] }, (bb) => {
          // a frond: rising, curling out at the tip
          bb.box(r * 0.62, capH * 0.62, r * 0.12, { at: [0, capH * 0.34, r * 0.98], rot: [-0.32, 0, 0], color: P(pal[k % 2]), r: 0.03 });
          bb.box(r * 0.56, capH * 0.26, r * 0.11, { at: [0, capH * 0.7, r * 1.35], rot: [-0.95, 0, 0], color: P(pal[(k + 1) % 2]), r: 0.03 });
          // midrib
          bb.box(r * 0.08, capH * 0.6, r * 0.05, { at: [0, capH * 0.34, r * 1.05], rot: [-0.32, 0, 0], color: shade(P(pal[k % 2]), -0.12), r: 0 });
        });
      }
      break;
    }
    case "composite":
    case "composite2":
    case "composite3": {
      bell(b, r * 0.92, r * 1.8, capH, ty, [P(pal[0]), P(pal[1]), P(pal[2])], true);
      const tiers = cap === "composite" ? 2 : cap === "composite2" ? 3 : 1;
      for (let t = 0; t < tiers; t++) {
        const ft = (t + 1) / (tiers + 1);
        const R = r * (0.98 + 0.8 * Math.pow(ft, 1.7));
        lobes(b, 8 + t * 4, R, ty + capH * ft, r * (0.2 + 0.05 * t), P(pal[(t + 1) % 3]), 0.6 + ft * 0.5, t * 0.3);
      }
      if (cap === "composite3") {
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          b.group({ at: [0, ty, 0], rot: [0, a, 0] }, (bb) => bb.cyl(r * 0.05, r * 0.07, capH * 0.9,
            { at: [0, capH * 0.45, r * 1.3], rot: [-0.55, 0, 0], color: P(pal[1]), seg: 6 }));
        }
      }
      break;
    }
    case "hathor": {
      // four faces of Hathor (a woman with cow's ears) under a little shrine: the sistrum
      const fc = gilt ? PAINT.gold : faded(PAINT.ochre, stone, 0.4);
      b.box(r * 2.0, capH * 0.6, r * 2.0, { at: [0, ty + capH * 0.3, 0], color: shade(fc, -0.06), r: 0.05 });
      for (let k = 0; k < 4; k++) {
        b.group({ at: [0, ty, 0], rot: [0, (k * Math.PI) / 2, 0] }, (bb) => {
          bb.sphere(r * 0.62, { at: [0, capH * 0.33, r * 1.02], scale: [0.86, 1.05, 0.4], color: fc, kind: gilt ? "metal" : "matte" });
          for (const s of [-1, 1]) {
            bb.sphere(r * 0.22, { at: [s * r * 0.7, capH * 0.48, r * 1.0], scale: [1.4, 0.7, 0.3], rot: [0, 0, s * 0.5], color: fc, kind: gilt ? "metal" : "matte" });
            bb.box(r * 0.3, capH * 0.5, r * 0.25, { at: [s * r * 0.62, capH * 0.22, r * 0.92], color: P(PAINT.blue), r: 0.04 }); // wig lappets
          }
          bb.box(r * 0.5, r * 0.07, r * 0.05, { at: [0, capH * 0.22, r * 1.27], color: P(PAINT.red), r: 0 });
        });
      }
      b.box(r * 1.6, capH * 0.36, r * 1.6, { at: [0, ty + capH * 0.78, 0], color: fc, kind: gilt ? "metal" : "matte", r: 0.04 });
      b.box(r * 1.8, capH * 0.06, r * 1.8, { at: [0, ty + capH * 0.98, 0], color: shade(fc, -0.1), r: 0.02 });
      break;
    }
    default:
      bell(b, r * 0.92, r * 1.8, capH, ty, [P(pal[0]), P(pal[1]), P(pal[2])]);
  }
  // abacus block
  const ab = cap === "hathor" ? r * 1.8 : cap === "papyrus_bud" || cap === "lotus" ? r * 1.25 : r * 1.35;
  b.box(ab, abH, ab, { at: [0, top + abH / 2, 0], color: shade(stone, -0.02), r: 0.03 });
}

// ── architraves and door frames ──────────────────────────────────────────────
export function architravePiece(b, o, X) {
  const { len, w, h } = o;
  const c = o.c || "#d3b386";
  const sm = stoneMat("relief", c);
  const g = new THREE.BoxGeometry(w, h, len);
  const uv = g.attributes.uv, pos = g.attributes.position, nor = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    const x = pos.getX(i), y = pos.getY(i) + h / 2, z = pos.getZ(i);
    if (ny > 0.5) uv.setXY(i, x / sm.tile[0], z / sm.tile[1]);
    else if (nx > 0.5) uv.setXY(i, z / sm.tile[0], (y + 2.4) / sm.tile[1]);
    else uv.setXY(i, x / sm.tile[0], y / sm.tile[1]);
  }
  g.translate(0, h / 2, 0);
  X.surface(b, sm.key, sm.mat, g);
}

export function portalPiece(b, o) {
  const { w, h, th } = o;
  const c = o.c || "#d3b386";
  const fw = Math.max(0.3, Math.min(1.1, w * 0.17));
  const pr = Math.min(0.18, fw * 0.3);
  const D = th + pr * 2;
  const lc = shade(c, 0.05);
  for (const s of [-1, 1]) {
    b.box(fw, h, D, { at: [s * (w / 2 + fw / 2), h / 2, 0], color: lc, r: 0.02 });
    b.cyl(fw * 0.12, fw * 0.12, h, { at: [s * (w / 2 + fw), h / 2, D / 2 - 0.02], color: shade(c, 0.08), seg: 8 });
    b.cyl(fw * 0.12, fw * 0.12, h, { at: [s * (w / 2 + fw), h / 2, -D / 2 + 0.02], color: shade(c, 0.08), seg: 8 });
  }
  const lh = fw * 1.25;
  b.box(w + fw * 2, lh, D, { at: [0, h + lh / 2, 0], color: lc, r: 0.02 });
  // small cavetto: a flared cap and a torus roll
  b.cyl(fw * 0.12, fw * 0.12, w + fw * 2.2, { at: [0, h + lh, D / 2], rot: [0, 0, Math.PI / 2], color: shade(c, 0.08), seg: 8 });
  b.cyl(fw * 0.12, fw * 0.12, w + fw * 2.2, { at: [0, h + lh, -D / 2], rot: [0, 0, Math.PI / 2], color: shade(c, 0.08), seg: 8 });
  b.box(w + fw * 2 + pr * 3, lh * 0.45, D + pr * 2.4, { at: [0, h + lh + lh * 0.24, 0], color: shade(c, 0.02), r: 0.03 });
  // a winged disc on both faces of the lintel
  for (const s of [-1, 1]) {
    b.group({ at: [0, h + lh * 0.5, s * (D / 2 + 0.01)], rot: [0, s > 0 ? 0 : Math.PI, 0] }, (bb) => wingedDisc(bb, Math.min(w * 0.3, lh * 0.75)));
  }
}

/** Door leaves (cedar, sheathed in gilt bronze) opened back against the passage walls. */
export function gateDoorsPiece(b, o) {
  const { w, h } = o;
  const leaf = w / 2;
  const cedar = "#7b4f2e";
  for (const s of [-1, 1]) {
    // hinged at the inner end of the passage, swung back flat along the side walls
    b.group({ at: [s * (w / 2 - 0.12), 0, o.depth / 2 - 0.4], rot: [0, s * Math.PI / 2, 0] }, (bb) => {
      bb.box(leaf, h, 0.18, { at: [-s * leaf / 2, h / 2, 0], color: cedar, r: 0.02 });
      for (const yy of [0.12, 0.38, 0.62, 0.88]) {
        bb.box(leaf + 0.02, 0.22, 0.22, { at: [-s * leaf / 2, h * yy, 0], color: PAINT.gold, kind: "metal", r: 0.02 });
      }
      for (let k = 0; k < 4; k++) for (let j = 0; j < 9; j++) {
        bb.sphere(0.05, { at: [-s * (0.3 + k * (leaf - 0.6) / 3), h * (0.18 + j * 0.08), 0.12], color: PAINT.gold, kind: "metal", seg: 6 });
      }
    });
  }
}
