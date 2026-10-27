// Procedural PBR materials (TSL). Masonry is generated from world position so that courses
// and joints line up with the real block sizes recorded in each dossier (a tiling photo
// texture cannot follow a wall's coursing). Average colours come from src/core/palette.js,
// which the light baker shares.

import { MeshStandardNodeMaterial, DoubleSide, Color } from 'three/webgpu';
import {
  Fn, float, vec2, vec3, vec4, positionWorld, normalWorld, normalView, positionView, abs, floor, fract, min, max,
  mix, smoothstep, hash, mx_noise_float, mx_fractal_noise_float, mx_worley_noise_float, dot, cross, normalize,
  sign, select, time, sin, clamp, length, cameraPosition, uniform, attribute, reflect, pow, fwidth,
} from 'three/tsl';
import { ENV, cloudShadow } from './env.js';
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
  const uu = u.add(rowH.mul(float(block).mul(7.0))).add(row.mul(float(block).mul(stagger)));
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
  // the material's numbers are uniforms, not constants in the shader: materials of the same kind
  // then share one compiled shader (and pipeline), which keeps the start-up short
  const baseNode = uniform(new Color(spec.color));
  const roughU = uniform(spec.roughness ?? 0.8);
  m.roughness = spec.roughness ?? 0.8;
  if (spec.side === 'double') { m.side = DoubleSide; m.shadowSide = DoubleSide; }
  m.metalness = spec.metalness ?? 0;
  const P = positionWorld;

  switch (spec.kind) {
    case 'ashlar':
    case 'paving':
    case 'mudbrick': {
      const course = uniform(spec.course ?? 1), blk = uniform(spec.block ?? 1);
      const { u, v, isTop } = wallUV();
      // floors and tops: flags laid in rows along x
      const b = spec.kind === 'paving' ? flags(u, v, blk.mul(1.5)) : blocks(u, v, course, blk, spec.kind === 'mudbrick' ? 0.5 : 0.37);
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
      m.roughnessNode = roughU.add(grain.mul(0.05)).add(joint.mul(0.08));
      // chipped arrises: blocks slightly pillowed toward their edges
      const pillow = smoothstep(0.0, 0.05, b.d).mul(0.0025);
      const h = pillow.add(grain.mul(0.0006)).add(fine.mul(0.0003)).sub(joint.mul(0.004));
      m.normalNode = bump(h, 1);
      break;
    }
    case 'drums': {
      const course = uniform(spec.course ?? 1);
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
      m.roughnessNode = roughU.add(grain.mul(0.05));
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
      m.roughnessNode = roughU.add(cloud.abs().mul(0.12)).add(float(1).sub(speck).mul(0.06));
      break;
    }
    case 'wood': {
      // cedar boards: grain runs vertically
      const g = mx_noise_float(vec3(P.x.mul(18), P.y.mul(0.9), P.z.mul(18)));
      const rings = fract(g.mul(6.0));
      const col = baseNode.mul(rings.mul(0.16).add(0.92)).mul(mx_noise_float(P.mul(3.0)).mul(0.1).add(1));
      m.colorNode = col;
      m.roughnessNode = roughU.add(rings.mul(0.08));
      m.normalNode = bump(rings.mul(0.0006), 1);
      break;
    }
    case 'metal': {
      const n = mx_fractal_noise_float(P.mul(4.0), 3, 2.0, 0.5);
      m.colorNode = baseNode.mul(n.mul(0.12).add(1));
      m.roughnessNode = roughU.add(n.abs().mul(0.15));
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
    case 'sectile': {
      // opus sectile pavement: large squares, alternately with an inscribed circle and plain,
      // in porphyry, grey granite, giallo antico and white marble, framed by bands
      const sz = uniform(spec.block), C = spec.colors.map((c) => uniform(new Color(c)));
      const g = vec2(P.x, P.z).div(sz);
      const cell = floor(g), f = fract(g).sub(0.5);
      const parity = fract(cell.x.add(cell.y).mul(0.5)).mul(2);           // 0 or 1, a checker
      const band = smoothstep(0.455, 0.47, max(abs(f.x), abs(f.y)));
      const rr = length(f);
      const ring = smoothstep(0.36, 0.37, rr).mul(float(1).sub(smoothstep(0.4, 0.41, rr)));
      const disc = float(1).sub(smoothstep(0.36, 0.37, rr));
      const inner = mix(C[1], C[0], parity);                                // circle: porphyry or granite
      const field = mix(C[2], C[3], parity);                                // the square around it
      let col = mix(field, inner, disc.mul(parity.mul(0.6).add(0.4)));
      col = mix(col, C[3], ring);
      col = mix(col, C[1].mul(0.9), band);
      const vein = mx_noise_float(P.mul(3.0)).mul(detailFade());
      m.colorNode = col.mul(vein.mul(0.06).add(1));
      m.roughnessNode = roughU.add(band.mul(0.2));
      m.normalNode = bump(band.mul(-0.002).add(vein.mul(0.0003)), 1);
      break;
    }
    case 'mosaic': {
      // gold (or coloured) glass tesserae about 3.5 cm, each set at its own small angle, so that
      // each catches the light differently; grey grout between them. Faded with distance.
      const q = P.div(0.035), cell = floor(q), f = fract(q);
      const id = hash(cell.x.mul(12.9898).add(cell.y.mul(78.233)).add(cell.z.mul(37.719)));
      const id2 = hash(cell.x.mul(4.898).add(cell.y.mul(7.23)).add(cell.z.mul(97.71)));
      const fw = fwidth(q.x).add(fwidth(q.y)).add(fwidth(q.z));
      const aa = float(1).sub(smoothstep(0.25, 0.7, fw));
      const e = min(min(min(f.x, float(1).sub(f.x)), min(f.y, float(1).sub(f.y))), min(f.z, float(1).sub(f.z)));
      const grout = float(1).sub(smoothstep(0.05, 0.14, e)).mul(aa);
      const big = mx_fractal_noise_float(P.mul(0.4), 3, 2.0, 0.5);
      const col = baseNode.mul(mix(float(1), id.mul(0.5).add(0.75), aa)).mul(big.mul(0.1).add(1));
      m.colorNode = mix(col, vec3(0.32, 0.3, 0.27), grout.mul(0.7));
      m.metalnessNode = uniform(spec.metalness ?? 1).mul(float(1).sub(grout.mul(0.9)));
      m.roughnessNode = mix(roughU, id2.mul(0.35).add(0.12), aa).add(grout.mul(0.5));
      // the tilt of each tessera: a per-cell slope in the bump
      m.normalNode = bump(f.x.mul(id.sub(0.5)).add(f.y.mul(id2.sub(0.5))).add(f.z.mul(id.sub(id2))).mul(0.004).mul(aa).sub(grout.mul(0.0015)), 1);
      break;
    }
    case 'veined': {
      // marble revetment: slabs sawn from one block and opened like a book, so that the veins of
      // each pair mirror each other; the slab's marble varies through the given colours
      const C = spec.colors.map((c) => uniform(new Color(c)));
      const { u, v } = wallUV();
      const bw = uniform(spec.block), bh = uniform(spec.course);
      const cu = floor(u.div(bw)), cv = floor(v.div(bh));
      const fu = fract(u.div(bw)), lv = fract(v.div(bh));
      const odd = fract(cu.mul(0.5)).mul(2);
      const lu = mix(fu, float(1).sub(fu), odd);
      const slab = hash(cv.mul(7.13).add(floor(cu.div(2)).mul(3.71)));
      const nb = C.length - 1;
      let body = C[0];
      for (let i = 1; i < nb; i++) body = select(slab.greaterThan(i / nb), C[i], body);
      const w1 = mx_fractal_noise_float(vec3(lu.mul(2.2), lv.mul(1.4), slab.mul(17.0)), 4, 2.0, 0.5);
      const w2 = mx_noise_float(vec3(lu.mul(0.9).add(w1.mul(0.8)), lv.mul(1.5), slab.mul(5.0)));
      const vw = max(fwidth(w2).mul(1.5), 0.018);
      const vein = float(1).sub(smoothstep(0.0, vw, abs(w2))).mul(0.45).mul(smoothstep(-0.2, 0.3, w1));
      const d = min(min(lu, float(1).sub(lu)).mul(bw), min(lv, float(1).sub(lv)).mul(bh));
      const joint = float(1).sub(smoothstep(0.0015, 0.005, d));
      const cloud = mx_fractal_noise_float(vec3(lu.mul(4.0), lv.mul(4.0), slab.mul(3.0)), 3, 2.0, 0.5);
      let col = mix(body.mul(cloud.mul(0.07).add(1)), C[nb], vein.clamp(0, 1).mul(0.6));
      col = mix(col, col.mul(0.55), joint);
      m.colorNode = col;
      m.roughnessNode = roughU.add(joint.mul(0.3));
      m.normalNode = bump(joint.mul(-0.0015), 1);
      break;
    }
    case 'tiles': {
      // roof of curved tiles (imbrex and tegula): channels down the slope, courses across it
      const n = normalWorld;
      const alongX = abs(n.x).lessThan(abs(n.z));
      const u = select(alongX, P.x, P.z);
      const ph = u.mul(Math.PI * 2 / 0.42);
      const row = floor(P.y.div(0.24));
      const lv = fract(P.y.div(0.24));
      const id = hash(floor(u.div(0.42)).mul(3.1).add(row.mul(17.7)));
      const aa = float(1).sub(smoothstep(0.25, 0.9, fwidth(ph)));
      const ch = sin(ph).mul(aa);
      const lap = float(1).sub(smoothstep(0.0, 0.18, lv)).mul(aa);
      const stain = mx_fractal_noise_float(P.mul(0.3), 3, 2.0, 0.5);
      m.colorNode = baseNode.mul(id.sub(0.5).mul(0.3).mul(aa).add(1)).mul(ch.mul(0.1).add(1)).mul(lap.mul(-0.35).add(1)).mul(stain.mul(0.2).add(1));
      m.normalNode = bump(ch.mul(0.02).add(lv.mul(0.012).mul(aa)), 1);
      break;
    }
    case 'glass': {
      // stained glass seen from inside: small panes of deep colour set in lead, laid out in
      // medallions (the scenes) up each lancet on a blue ground with red flecks, each medallion
      // framed by a band of white and gold; lit by the sky and the sun behind (emissive)
      const along = dot(P.xz, vec2(0.7071, 0.7071));
      const q0 = vec2(along, P.y).mul(vec2(11.0, 9.0));
      const rowS = hash(floor(q0.y).mul(3.17)).mul(0.6);
      const q = vec2(q0.x.add(rowS), q0.y);
      const cell = floor(q), fq = fract(q);
      const id = hash(cell.x.mul(17.31).add(cell.y.mul(91.7)));
      const blue = vec3(0.035, 0.08, 0.42), red = vec3(0.5, 0.03, 0.035), green = vec3(0.06, 0.3, 0.1), gold = vec3(0.62, 0.42, 0.06), violet = vec3(0.25, 0.07, 0.32), white = vec3(0.55, 0.55, 0.5);
      const mq = vec2(along.mul(1.05), P.y.mul(0.85));
      const mcell = floor(mq), mf = fract(mq).sub(0.5);
      const mid = hash(mcell.x.mul(5.3).add(mcell.y.mul(11.9)));
      const r0 = length(mf);
      // shapes: circle, quatrefoil, lozenge
      const quat = r0.mul(float(1).add(abs(mf.x.mul(mf.y)).mul(-3.0)));
      const loz = abs(mf.x).add(abs(mf.y)).mul(0.78);
      const md = select(mid.lessThan(0.4), r0, select(mid.lessThan(0.75), quat, loz));
      const medallion = smoothstep(0.34, 0.31, md);
      const border = smoothstep(0.39, 0.36, md).sub(medallion).clamp(0, 1);
      const ground = select(id.lessThan(0.7), blue, select(id.lessThan(0.9), red, select(id.lessThan(0.96), violet, gold)));
      const scene = select(id.lessThan(0.3), red, select(id.lessThan(0.52), blue, select(id.lessThan(0.64), green, select(id.lessThan(0.76), gold, select(id.lessThan(0.88), white, violet)))));
      let col = mix(ground, scene, medallion);
      col = mix(col, select(hash(cell.x.add(cell.y.mul(3.0))).lessThan(0.5), red, gold), border.mul(0.8));
      const fw = fwidth(q.x).add(fwidth(q.y));
      const lead = float(1).sub(smoothstep(0.05, 0.1, min(min(fq.x, float(1).sub(fq.x)), min(fq.y, float(1).sub(fq.y))))).mul(float(1).sub(smoothstep(0.3, 0.8, fw)));
      const light = ENV.horizon.mul(0.2).add(ENV.sunColor.mul(0.011)).add(ENV.zenith.mul(0.1));
      const streak = mx_noise_float(P.mul(11.0)).mul(0.3).add(1);
      m.colorNode = vec3(0.02, 0.02, 0.025);
      m.emissiveNode = col.mul(light).mul(streak).mul(float(1).sub(lead.mul(0.95)));
      // the sun through the glass: its colour, dimmed, and the leads' shadow
      m.castShadowNode = vec4(col.mul(1.1).mul(float(1).sub(lead.mul(0.9))), 1);
      m.roughnessNode = float(0.2);
      break;
    }
    case 'fleur': {
      // painted stone: a ground colour with a gilded motif in a diaper (fleurs-de-lis, castles), or stars
      const C = spec.colors.map((c) => uniform(new Color(c)));
      const { u, v } = wallUV();
      const sz = spec.stars ? 0.55 : 0.32;
      const g = vec2(u, v).div(sz), cell = floor(g), f = fract(g).sub(0.5);
      const off = fract(cell.y.mul(0.5)).mul(2).mul(0.5);
      const f2 = vec2(fract(g.x.add(off)).sub(0.5), f.y);
      const star = spec.stars
        ? float(1).sub(smoothstep(0.035, 0.07, min(length(f2), abs(f2.x).add(abs(f2.y)).mul(0.55))))
        : float(1).sub(smoothstep(0.1, 0.16, max(abs(f2.x).mul(1.6), abs(f2.y).add(abs(f2.x).mul(0.8)).sub(0.05))));
      const aa = float(1).sub(smoothstep(0.3, 0.9, fwidth(g.x).add(fwidth(g.y))));
      const motif = star.mul(aa).mul(spec.stars ? hash(cell.x.mul(3.1).add(cell.y.mul(7.7))).greaterThan(0.25).select(float(1), float(0)) : float(1));
      const n = mx_fractal_noise_float(P.mul(1.5), 3, 2.0, 0.5);
      m.colorNode = mix(C[0].mul(n.mul(0.08).add(1)), C[1], motif);
      m.metalnessNode = motif.mul(0.85);
      m.roughnessNode = roughU.sub(motif.mul(0.25));
      break;
    }
    case 'timberframe': {
      // plaster between dark oak timbers: posts, rails at sill and lintel height, braces
      const { u, v } = wallUV();
      const pu = fract(u.div(1.1)), pv = fract(v.div(3.0));
      const post = smoothstep(0.08, 0.06, min(pu, float(1).sub(pu)).mul(1.1));
      const rail = smoothstep(0.1, 0.07, min(abs(pv.sub(0.05)), abs(pv.sub(0.36)))).add(smoothstep(0.1, 0.07, abs(pv.sub(0.98))));
      const brace = smoothstep(0.07, 0.04, abs(fract(u.div(2.2).add(v.div(3.0))).sub(0.5))).mul(hash(floor(u.div(2.2)).add(floor(v.div(3.0)).mul(7.0))).greaterThan(0.55).select(float(1), float(0)));
      const aa = float(1).sub(smoothstep(0.2, 0.6, fwidth(u).mul(4)));
      const wood = clamp(post.add(rail).add(brace), 0, 1).mul(aa);
      const n = mx_fractal_noise_float(P.mul(0.8), 3, 2.0, 0.5);
      m.colorNode = mix(baseNode.mul(n.mul(0.12).add(1)), vec3(0.17, 0.11, 0.07), wood);
      m.roughnessNode = roughU;
      break;
    }
    case 'flame': {
      m.colorNode = vec3(0, 0, 0);
      m.emissiveNode = vec3(6.0, 3.2, 1.0).mul(sin(time.mul(9.0).add(P.x.mul(13.0))).mul(0.08).add(1));
      break;
    }
    case 'bark': {
      const fiss = mx_worley_noise_float(vec3(P.x.mul(6), P.y.mul(spec.plates ? 1.2 : 0.8), P.z.mul(6)));
      const n = mx_noise_float(P.mul(3.0));
      m.colorNode = baseNode.mul(smoothstep(0.0, 0.35, fiss).mul(0.45).add(0.6)).mul(n.mul(0.12).add(1));
      m.normalNode = bump(smoothstep(0.0, 0.35, fiss).mul(0.01), 1);
      break;
    }
    case 'rock': {
      const n = mx_fractal_noise_float(P.mul(1.2), 4, 2.0, 0.5), f = mx_noise_float(P.mul(9.0)).mul(detailFade());
      const lichen = smoothstep(0.25, 0.5, mx_noise_float(P.mul(0.8).add(3))).mul(smoothstep(0.3, 0.9, normalWorld.y));
      m.colorNode = mix(baseNode.mul(n.mul(0.25).add(1)), vec3(0.42, 0.42, 0.33), lichen.mul(0.35)).mul(f.mul(0.08).add(1));
      m.normalNode = bump(n.mul(0.05).add(f.mul(0.004)), 1);
      break;
    }
    case 'terrain': {
      // ground cover comes per vertex from the region's rules (src/world/regions.js)
      const g = attribute('ground', 'vec4'), g2 = attribute('ground2', 'vec4'), rd = attribute('road', 'float');
      const C = (h) => { const c = new Color(h); return vec3(c.r, c.g, c.b); };
      const fade = detailFade();
      const big = mx_fractal_noise_float(P.mul(0.03), 4, 2.0, 0.5);
      const mid = mx_fractal_noise_float(P.mul(0.35), 3, 2.0, 0.5);
      const fine = mx_noise_float(P.mul(6.0)).mul(fade);
      // sand: wind ripples across the wind, streaks along it
      const wdir = normalize(vec2(0.8, 0.6));
      const along = dot(P.xz, wdir), across = dot(P.xz, vec2(wdir.y.negate(), wdir.x));
      const rphase = along.mul(48.0).add(mx_noise_float(vec3(P.x.mul(0.6), 0, P.z.mul(0.6))).mul(5.0));
      // fade fine patterns before they alias (more than about a cycle per pixel)
      const aaFade = (ph) => float(1).sub(smoothstep(0.25, 0.9, fwidth(ph)));
      // ripples come and go in patches, and are strongest where the sand is loose
      const patch = smoothstep(-0.15, 0.45, mx_noise_float(vec3(P.x.mul(0.07), 0, P.z.mul(0.07))));
      const ripple = sin(rphase).mul(aaFade(rphase)).mul(patch);
      const sand = C('#c8aa80').mul(big.mul(0.16).add(1)).mul(mx_noise_float(vec3(across.mul(0.08), 0, along.mul(0.6))).mul(0.06).add(1));
      // grass: green to straw, in clumps
      const clump = mx_worley_noise_float(P.mul(0.9));
      const grass = mix(C('#66733f'), C('#ad9e6b'), clamp(g2.y.add(mid.mul(0.35)), 0, 1)).mul(smoothstep(0.0, 0.5, clump).mul(0.28).add(0.78));
      // rock: grey limestone or buff sandstone, in strata
      const strata = mx_noise_float(vec3(P.x.mul(0.04), P.y.mul(1.1), P.z.mul(0.04)));
      const rock = mix(C('#9e9a91'), C('#b29470'), g2.z).mul(strata.mul(0.16).add(1)).mul(mid.mul(0.14).add(1));
      // soil: brown, red in Attica, dark silt by the river in Egypt
      let soil = mix(mix(C('#6e5845'), C('#94502e'), g2.w), C('#5b4a39'), g2.z.mul(0.7)).mul(mid.mul(0.15).add(1));
      // fields: plots of crops in strips, separated by earth banks
      // roads: pale beaten earth, with wheel ruts and footprints of dust
      const roadCol = mix(C('#a08a6c'), C('#c2a982'), g2.z).mul(mid.mul(0.12).add(1)).mul(mx_noise_float(P.mul(1.7)).mul(0.08).add(1));
      soil = mix(soil, roadCol, rd);
      const fu = P.x.mul(0.98).add(P.z.mul(0.2)), fv = P.z.mul(0.98).sub(P.x.mul(0.2));
      const row = floor(fv.div(38.0));
      const fuS = fu.add(hash(row.mul(3.7)).mul(16.0));
      const col = floor(fuS.div(15.0));
      const id = hash(col.mul(12.9898).add(row.mul(78.233)));
      const lu = fract(fuS.div(15.0)).mul(15.0), lv = fract(fv.div(38.0)).mul(38.0);
      const edge = min(min(lu, float(15.0).sub(lu)), min(lv, float(38.0).sub(lv)));
      const bank = float(1).sub(smoothstep(0.35, 0.9, edge));
      const crop = select(id.lessThan(0.22), C('#b9a75a'), select(id.lessThan(0.44), C('#7d8f3e'), select(id.lessThan(0.62), C('#4c7230'),
        select(id.lessThan(0.76), C('#64805f'), select(id.lessThan(0.88), C('#6f8a39'), C('#7a634a'))))));
      const rph = lu.mul(Math.PI * 2 / 0.45);
      const rows = sin(rph).mul(0.5).add(0.5).mul(aaFade(rph));
      const fieldCol = mix(crop.mul(rows.mul(0.18).add(0.86)).mul(fine.mul(0.08).add(1)), soil, bank);
      const wsum = g.x.add(g.y).add(g.z).add(g.w).add(g2.x).max(0.001);
      let col3 = sand.mul(g.x).add(grass.mul(g.y)).add(rock.mul(g.z)).add(soil.mul(g.w)).add(fieldCol.mul(g2.x)).div(wsum);
      col3 = col3.mul(fine.mul(0.06).add(1));
      // rain: darker and glossier where the ground faces the sky; puddles in the low spots
      const flat = smoothstep(0.75, 0.95, normalWorld.y);
      const puddle = smoothstep(0.55, 0.75, mx_fractal_noise_float(P.mul(0.12), 2, 2.0, 0.5).mul(-1).add(0.5)).mul(ENV.wet).mul(flat).mul(float(1).sub(g.z));
      const wet = ENV.wet.mul(flat.mul(0.6).add(0.4));
      m.colorNode = col3.mul(float(1).sub(wet.mul(0.38))).mul(float(1).sub(puddle.mul(0.5)));
      m.roughnessNode = float(0.95).sub(wet.mul(0.4)).sub(puddle.mul(0.5)).sub(g.z.mul(0.1));
      const h = ripple.mul(0.0035).mul(g.x).add(mid.mul(0.04)).add(strata.mul(g.z).mul(0.08)).add(rows.mul(g2.x).mul(0.02)).add(bank.mul(g2.x).mul(0.05))
        .add(float(1).sub(smoothstep(0.0, 0.5, clump)).mul(g.y).mul(0.015)).mul(float(1).sub(puddle));
      m.normalNode = bump(h, 1);
      break;
    }
    case 'river': {
      // water: the sky mirrored at a grazing angle, the sun's glitter, a silty body beneath
      const t = time.mul(0.6);
      const flow = vec2(0.0, t.mul(0.9));
      const w1 = mx_noise_float(vec3(P.x.mul(0.18).add(flow.x), P.z.mul(0.12).add(flow.y), t.mul(0.15)));
      const w2 = mx_noise_float(vec3(P.x.mul(0.9), P.z.mul(0.7).add(flow.y.mul(2.0)), t.mul(0.4)));
      const w3 = mx_noise_float(vec3(P.x.mul(3.1), P.z.mul(2.6).add(flow.y.mul(4.0)), t)).mul(detailFade());
      const nrm = normalize(vec3(w1.mul(0.06).add(w2.mul(0.04)).add(w3.mul(0.03)), 1, w1.mul(0.05).add(w2.mul(0.035)).add(w3.mul(0.03))));
      const v = normalize(P.sub(cameraPosition));
      const r = reflect(v, nrm);
      const fres = float(0.02).add(float(0.98).mul(pow(float(1).sub(max(dot(nrm, v.negate()), 0)), 5)));
      const skyCol = mix(ENV.horizon, ENV.zenith, pow(clamp(r.y, 0, 1), 0.5)).mul(4.5);
      const glint = pow(max(dot(r, ENV.sunDir), 0), 600).mul(ENV.sunColor).mul(6).mul(cloudShadow);
      m.colorNode = baseNode.mul(float(1).sub(fres));
      m.roughness = 1.0;
      m.metalness = 0.0;
      m.emissiveNode = skyCol.mul(fres).add(glint);
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
