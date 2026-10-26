// Procedural PBR materials (TSL). Masonry is generated from world position so that courses
// and joints line up with the real block sizes recorded in each dossier (a tiling photo
// texture cannot follow a wall's coursing). Average colours come from src/core/palette.js,
// which the light baker shares.

import { MeshStandardNodeMaterial, DoubleSide, Color } from 'three/webgpu';
import {
  Fn, float, vec2, vec3, positionWorld, normalWorld, normalView, positionView, abs, floor, fract, min, max,
  mix, smoothstep, hash, mx_noise_float, mx_fractal_noise_float, mx_worley_noise_float, dot, cross, normalize,
  sign, select, time, sin, clamp, length, cameraPosition, uniform,
} from 'three/tsl';
import { MATERIALS } from '../core/palette.js';
import { GISpecularNode } from './gi.js';

const cache = new Map();
let GI = null;
/** The baked-light volume used for reflections (set once by the renderer). */
export function useGI(gi) { GI = gi; }

/** Material for a palette key. */
export function material(key) {
  if (cache.has(key)) return cache.get(key);
  const spec = MATERIALS[key] || MATERIALS.sandstone;
  const m = make(spec);
  m.name = key;
  if (GI) {
    const spec2 = GI.radianceNode();
    m.setupLightMap = () => new GISpecularNode(spec2);
  }
  cache.set(key, m);
  return m;
}

/** Normal perturbed by a world-space height field (surface-gradient bump, view space). */
const bump = (h, strength = 1) => {
  const N = normalView;
  const dpdx = positionView.dFdx(), dpdy = positionView.dFdy();
  const hx = h.dFdx().mul(strength), hy = h.dFdy().mul(strength);
  const r1 = cross(dpdy, N), r2 = cross(N, dpdx);
  const det = dot(dpdx, r1);
  const grad = sign(det).mul(hx.mul(r1).add(hy.mul(r2)));
  return normalize(abs(det).mul(N).sub(grad));
};

/** Fade fine detail with distance to avoid shimmering. */
const detailFade = () => clamp(float(1).sub(length(positionWorld.sub(cameraPosition)).div(60)), 0, 1);

/** Planar coordinates for a wall-like surface: u along the wall, v up; horizontal faces use x/z. */
const wallUV = () => {
  const n = abs(normalWorld);
  const isTop = n.y.greaterThan(0.7);
  const alongX = n.z.greaterThan(n.x);
  const u = select(alongX, positionWorld.x, positionWorld.z);
  return { u: select(isTop, positionWorld.x, u), v: select(isTop, positionWorld.z, positionWorld.y), isTop };
};

/** Ashlar / paving / drums / brick pattern: returns { id (block hash), joint (0..1), edge } */
const blocks = (u, v, course, block, stagger = 0.5) => {
  const row = floor(v.div(course));
  const rowH = hash(row.mul(13.17).add(3.1));
  const len = float(block).mul(rowH.mul(0.55).add(0.75));        // block length varies by course
  const uu = u.add(rowH.mul(block * 7.0)).add(row.mul(block * stagger));
  const col = floor(uu.div(len));
  const fu = fract(uu.div(len)), fv = fract(v.div(course));
  const du = min(fu, float(1).sub(fu)).mul(len), dv = min(fv, float(1).sub(fv)).mul(course);
  const d = min(du, dv);
  const id = hash(col.mul(1.618).add(row.mul(91.7)));
  return { id, d, row };
};

/**
 * Irregular paving: rows of large cells, each cell split once or twice at random into
 * rectangular flags of different sizes, as temple floors were laid with whatever slabs came.
 */
const flags = (u, v, size) => {
  const row = floor(v.div(size));
  const uu = u.add(hash(row.mul(7.31)).mul(size));
  const cell = vec2(floor(uu.div(size)), row);
  const lu = fract(uu.div(size)).mul(size), lv = fract(v.div(size)).mul(size);
  const h1 = hash(cell.x.mul(12.9898).add(cell.y.mul(78.233)));
  const h2 = hash(cell.x.mul(39.346).add(cell.y.mul(11.135)));
  const h3 = hash(cell.x.mul(73.156).add(cell.y.mul(52.235)));
  const vertical = h1.greaterThan(0.5);
  const sp = h2.mul(0.4).add(0.3).mul(size);
  const a = select(vertical, lu, lv), b = select(vertical, lv, lu);
  const side = a.greaterThan(sp);
  // second split, across the first, in about half of the pieces
  const sp2 = h3.mul(0.5).add(0.25).mul(size);
  const split2 = hash(h1.add(select(side, float(0.37), float(0.71)))).greaterThan(0.45);
  const d0 = min(min(lu, float(size).sub(lu)), min(lv, float(size).sub(lv)));
  const d1 = abs(a.sub(sp));
  const d2 = select(split2, abs(b.sub(sp2)), float(9));
  const d = min(d0, min(d1, d2));
  const id = hash(h1.add(select(side, float(0.13), float(0.57))).add(select(split2.and(b.greaterThan(sp2)), float(0.29), float(0))));
  return { id, d };
};

function make(spec) {
  const m = new MeshStandardNodeMaterial();
  const base = new Color(spec.color);
  const baseNode = vec3(base.r, base.g, base.b);
  m.roughness = spec.roughness ?? 0.8;
  if (spec.side === 'double') { m.side = DoubleSide; m.shadowSide = DoubleSide; }
  m.metalness = spec.metalness ?? 0;
  const P = positionWorld;

  switch (spec.kind) {
    case 'ashlar':
    case 'paving':
    case 'mudbrick': {
      const course = spec.course, blk = spec.block;
      const { u, v, isTop } = wallUV();
      // floors and tops: flags laid in rows along x
      const b = spec.kind === 'paving' ? flags(u, v, blk * 1.5) : blocks(u, v, course, blk, spec.kind === 'mudbrick' ? 0.5 : 0.37);
      const jointW = spec.kind === 'mudbrick' ? 0.014 : 0.006;
      const joint = float(1).sub(smoothstep(jointW * 0.4, jointW * 2.2, b.d));
      const stain = mx_fractal_noise_float(P.mul(0.11), 4, 2.0, 0.5);
      const streak = mx_noise_float(vec3(P.x.mul(1.3), P.y.mul(0.08), P.z.mul(1.3)));
      const grain = mx_noise_float(P.mul(9.0)).mul(detailFade());
      const fine = mx_noise_float(P.mul(41.0)).mul(detailFade());
      const tone = b.id.sub(0.5).mul(spec.kind === 'paving' ? 0.24 : 0.16).add(1);
      const hueShift = vec3(1.02, 1.0, 0.96).mul(b.id).add(vec3(0.98, 1.0, 1.04).mul(float(1).sub(b.id)));
      let col = baseNode.mul(tone).mul(hueShift)
        .mul(stain.mul(0.18).add(1))
        .mul(select(isTop, float(1), streak.mul(0.08).add(1)))
        .mul(grain.mul(0.05).add(fine.mul(0.03)).add(1));
      col = mix(col, col.mul(0.5), joint.mul(spec.kind === 'mudbrick' ? 0.85 : 0.55));
      m.colorNode = col;
      m.roughnessNode = float(spec.roughness).add(grain.mul(0.05)).add(joint.mul(0.08));
      // chipped arrises: blocks slightly pillowed toward their edges
      const pillow = smoothstep(0.0, 0.05, b.d).mul(0.0025);
      const h = pillow.add(grain.mul(0.0006)).add(fine.mul(0.0003)).sub(joint.mul(0.004));
      m.normalNode = bump(h, 1);
      break;
    }
    case 'drums': {
      const course = spec.course;
      const fv = fract(P.y.div(course));
      const dv = min(fv, float(1).sub(fv)).mul(course);
      const joint = float(1).sub(smoothstep(0.003, 0.012, dv));
      const row = floor(P.y.div(course));
      const id = hash(row.mul(17.3).add(floor(P.x.mul(0.3)).mul(7.1)).add(floor(P.z.mul(0.3)).mul(3.3)));
      const stain = mx_fractal_noise_float(P.mul(0.18), 3, 2.0, 0.5);
      const grain = mx_noise_float(P.mul(10.0)).mul(detailFade());
      const fine = mx_noise_float(P.mul(45.0)).mul(detailFade());
      let col = baseNode.mul(id.sub(0.5).mul(0.12).add(1)).mul(stain.mul(0.16).add(1)).mul(grain.mul(0.05).add(fine.mul(0.03)).add(1));
      col = mix(col, col.mul(0.6), joint.mul(0.8));
      m.colorNode = col;
      m.roughnessNode = float(spec.roughness).add(grain.mul(0.05));
      m.normalNode = bump(grain.mul(0.0007).add(fine.mul(0.0003)).sub(joint.mul(0.003)), 1);
      break;
    }
    case 'granite': {
      const w1 = mx_worley_noise_float(P.mul(38.0));
      const w2 = mx_worley_noise_float(P.mul(90.0).add(7.0));
      const speck = smoothstep(0.05, 0.25, w1).mul(0.6).add(smoothstep(0.1, 0.3, w2).mul(0.4));
      const cloud = mx_fractal_noise_float(P.mul(0.6), 3, 2.0, 0.5);
      const col = baseNode.mul(speck.mul(0.55).add(0.7)).mul(cloud.mul(0.15).add(1));
      m.colorNode = col;
      m.roughnessNode = float(spec.roughness).add(cloud.abs().mul(0.12)).add(float(1).sub(speck).mul(0.06));
      break;
    }
    case 'wood': {
      // cedar boards: grain runs vertically
      const g = mx_noise_float(vec3(P.x.mul(18), P.y.mul(0.9), P.z.mul(18)));
      const rings = fract(g.mul(6.0));
      const col = baseNode.mul(rings.mul(0.16).add(0.92)).mul(mx_noise_float(P.mul(3.0)).mul(0.1).add(1));
      m.colorNode = col;
      m.roughnessNode = float(spec.roughness).add(rings.mul(0.08));
      m.normalNode = bump(rings.mul(0.0006), 1);
      break;
    }
    case 'metal': {
      const n = mx_fractal_noise_float(P.mul(4.0), 3, 2.0, 0.5);
      m.colorNode = baseNode.mul(n.mul(0.12).add(1));
      m.roughnessNode = float(spec.roughness).add(n.abs().mul(0.15));
      break;
    }
    case 'ground': {
      const big = mx_fractal_noise_float(P.mul(0.05), 4, 2.0, 0.5);
      const mid = mx_fractal_noise_float(P.mul(0.6), 3, 2.0, 0.5);
      const peb = mx_worley_noise_float(P.mul(6.0));
      const pebbles = float(1).sub(smoothstep(0.0, 0.18, peb)).mul(detailFade());
      const col = baseNode.mul(big.mul(0.22).add(1)).mul(mid.mul(0.12).add(1)).mul(pebbles.mul(-0.18).add(1));
      m.colorNode = col;
      m.normalNode = bump(mid.mul(0.01).add(pebbles.mul(0.006)), 1);
      break;
    }
    case 'water': {
      const t = time.mul(0.35);
      const w = mx_noise_float(vec3(P.x.mul(0.7).add(t), P.z.mul(0.7), t.mul(0.6))).add(mx_noise_float(vec3(P.x.mul(2.3), P.z.mul(2.3).sub(t), t)).mul(0.4));
      m.colorNode = baseNode;
      m.roughness = 0.04;
      m.metalness = 0.0;
      m.normalNode = bump(w.mul(0.02), 1);
      break;
    }
    case 'leaf': {
      // palm leaflets: double sided, a little translucent-looking (brighter, yellower toward the tips)
      const n = mx_noise_float(P.mul(2.0));
      m.colorNode = baseNode.mul(n.mul(0.25).add(1)).mul(vec3(1.0, 1.0, 0.85).mul(hash(floor(P.y.mul(3))).mul(0.2).add(0.9)));
      m.side = DoubleSide;
      m.shadowSide = DoubleSide;
      break;
    }
    default: {
      const n = mx_fractal_noise_float(P.mul(0.8), 3, 2.0, 0.5);
      const f = mx_noise_float(P.mul(20.0)).mul(detailFade());
      m.colorNode = baseNode.mul(n.mul(0.1).add(1)).mul(f.mul(0.04).add(1));
      m.normalNode = bump(f.mul(0.0005), 1);
    }
  }
  return m;
}

/** Warm emissive flame for oil lamps. */
export function flameMaterial() {
  const m = new MeshStandardNodeMaterial();
  m.colorNode = vec3(0, 0, 0);
  m.emissiveNode = vec3(6.0, 3.2, 1.0).mul(sin(time.mul(9.0)).mul(0.08).add(1));
  return m;
}
