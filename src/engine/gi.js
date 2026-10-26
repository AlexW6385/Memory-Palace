// Baked indirect light: an irradiance volume per building (a grid of L1 spherical-harmonic
// probes computed offline by tools/bake.mjs), sampled per fragment by world position and
// normal. Outside every volume, a sky/ground hemisphere stands in.
//
// File format (data/gi/<id>.gi): a 36-byte header
//   u32 magic 'MPGI', u32 version (3), u32 nx, u32 ny, u32 nz, f32 minX, f32 minY, f32 minZ, f32 spacing
// then a gzip stream of 12 planes of nx·ny·nz half floats (SH coefficients c0.rgb, cy.rgb, cz.rgb,
// cx.rgb, each plane delta-coded along the grid) whose bytes are shuffled (all low bytes, then all
// high bytes). Probe i is at min + spacing·(x, y, z), i = x + nx·(y + ny·z).
//   (already convolved with the cosine lobe, so E(n) = c0·Y0 + Y1·(cy·n.y + cz·n.z + cx·n.x)).

import { Data3DTexture, HalfFloatType, RGBAFormat, LinearFilter, ClampToEdgeWrapping, DataUtils } from 'three/webgpu';
import { Fn, vec3, float, uniform, texture3D, positionWorld, normalWorld, reflectVector, clamp, min, max, mix, smoothstep } from 'three/tsl';
import { LightingNode } from 'three/webgpu';
import { SUN_DIR, SUN_COLOR, SUN_INTENSITY, skyRadiance } from '../core/light.js';
import { albedo } from '../core/palette.js';

export const HEADER_BYTES = 36;
const half = (h) => DataUtils.fromHalfFloat(h);

function blank() {
  const t = new Data3DTexture(new Uint16Array(4), 1, 1, 1);
  t.format = RGBAFormat; t.type = HalfFloatType; t.needsUpdate = true;
  return t;
}

/** Hemisphere stand-in: irradiance from the open sky above and sunlit ground below. */
export function hemisphere() {
  // integrate the sky over the upper hemisphere (cosine-weighted, horizontal surface)
  const sky = [0, 0, 0];
  const N = 24;
  let wsum = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N * 2; j++) {
      const th = ((i + 0.5) / N) * Math.PI / 2, ph = ((j + 0.5) / (2 * N)) * Math.PI * 2;
      const d = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
      const L = skyRadiance(d), w = Math.cos(th) * Math.sin(th);
      for (let k = 0; k < 3; k++) sky[k] += L[k] * w;
      wsum += w;
    }
  }
  for (let k = 0; k < 3; k++) sky[k] = (sky[k] / wsum) * Math.PI;
  const a = albedo('ground');
  const ground = [0, 1, 2].map((k) => a[k] * (SUN_COLOR[k] * SUN_INTENSITY * SUN_DIR[1] + sky[k]));
  return { sky, ground };
}

export class GIVolume {
  constructor() {
    this.tex = [blank(), blank(), blank()];
    this.uMin = uniform(vec3(0, 0, 0));
    this.uSize = uniform(vec3(1, 1, 1));
    this.uRes = uniform(vec3(1, 1, 1));
    this.uActive = uniform(0);
    this.uIntensity = uniform(1);
    this.current = null;
    this.cache = new Map();
    const h = hemisphere();
    this.skyE = vec3(...h.sky);
    this.groundE = vec3(...h.ground);
  }

  async fetch(id, url) {
    if (this.cache.has(id)) return this.cache.get(id);
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const u32 = new Uint32Array(buf, 0, 5);
    if (u32[0] !== 0x4947504D) throw new Error('bad GI file ' + url);
    const [nx, ny, nz] = [u32[2], u32[3], u32[4]];
    const f32 = new Float32Array(buf, 20, 4);
    const N = nx * ny * nz, M = N * 12;
    const stream = new Blob([buf.slice(HEADER_BYTES)]).stream().pipeThrough(new DecompressionStream('gzip'));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    const planes = new Uint16Array(M);
    for (let i = 0; i < M; i++) planes[i] = bytes[i] | (bytes[M + i] << 8);
    const packed = [0, 1, 2].map(() => new Uint16Array(N * 4));
    for (let c = 0; c < 12; c++) {
      const dst = packed[c >> 2], k = c & 3;
      let v = 0;
      for (let i = 0; i < N; i++) { v = (v + planes[c * N + i]) & 0xffff; dst[i * 4 + k] = v; }
    }
    const tex = packed.map((data) => {
      const d3 = new Data3DTexture(data, nx, ny, nz);
      d3.format = RGBAFormat; d3.type = HalfFloatType;
      d3.minFilter = d3.magFilter = LinearFilter;
      d3.wrapS = d3.wrapT = d3.wrapR = ClampToEdgeWrapping;
      d3.unpackAlignment = 1; d3.needsUpdate = true;
      return d3;
    });
    const vol = { id, nx, ny, nz, min: [f32[0], f32[1], f32[2]], spacing: f32[3], tex, c0: tex[0].image.data };
    this.cache.set(id, vol);
    return vol;
  }

  /** Make a loaded volume the active one. */
  use(vol) {
    if (!vol || this.current === vol) return;
    this.current = vol;
    for (let t = 0; t < 3; t++) this.nodes[t].value = vol.tex[t];
    const s = vol.spacing;
    this.uMin.value.set(vol.min[0] - s / 2, vol.min[1] - s / 2, vol.min[2] - s / 2);
    this.uSize.value.set(vol.nx * s, vol.ny * s, vol.nz * s);
    this.uRes.value.set(vol.nx, vol.ny, vol.nz);
    this.uActive.value = 1;
  }

  /**
   * Mean indirect luminance around a point (for eye adaptation): the DC term of the nearest
   * volume, trilinearly interpolated; the open-air value outside.
   */
  ambientAt(x, y, z) {
    const v = this.current;
    const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (!v) return this.openAmbient();
    const fx = (x - v.min[0]) / v.spacing, fy = (y - v.min[1]) / v.spacing, fz = (z - v.min[2]) / v.spacing;
    if (fx < 0 || fz < 0 || fx > v.nx - 1 || fz > v.nz - 1 || fy > v.ny - 1) return this.openAmbient();
    const x0 = Math.min(v.nx - 2, Math.floor(fx)), y0 = Math.max(0, Math.min(v.ny - 2, Math.floor(fy))), z0 = Math.min(v.nz - 2, Math.floor(fz));
    const tx = fx - x0, ty = Math.max(0, Math.min(1, fy - y0)), tz = fz - z0;
    let L = 0;
    for (let c = 0; c < 8; c++) {
      const dx = c & 1, dy = (c >> 1) & 1, dz = (c >> 2) & 1;
      const w = (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty) * (dz ? tz : 1 - tz);
      const i = ((z0 + dz) * v.ny * v.nx + (y0 + dy) * v.nx + (x0 + dx)) * 4;
      L += w * lum(half(v.c0[i]), half(v.c0[i + 1]), half(v.c0[i + 2])) * 0.282095;
    }
    return L;
  }

  openAmbient() {
    if (this._open === undefined) {
      const h = hemisphere();
      const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      this._open = (lum(h.sky) + lum(h.ground)) / 2;
    }
    return this._open;
  }

  /** TSL irradiance at the current fragment, for the surface normal (diffuse) or any direction. */
  irradianceNode(dir = normalWorld) {
    const self = this;
    if (!this.nodes) this.nodes = this.tex.map((t) => texture3D(t));
    return Fn(() => {
      const N = dir;
      const fallback = mix(self.groundE, self.skyE, clamp(N.y.mul(0.5).add(0.5), 0, 1));
      // sample a little off the surface, toward the room it faces (limits leaks through walls)
      const p = positionWorld.add(normalWorld.mul(0.45));
      const uvw = p.sub(self.uMin).div(self.uSize);
      const edge = min(min(uvw.x, float(1).sub(uvw.x)), min(uvw.z, float(1).sub(uvw.z)));
      const top = float(1).sub(uvw.y);
      const w = smoothstep(0.0, 0.02, edge).mul(smoothstep(0.0, 0.06, top)).mul(smoothstep(-0.05, 0.0, uvw.y)).mul(self.uActive);
      const c = clamp(uvw, 0.0, 1.0);
      const a = self.nodes[0].sample(c), b = self.nodes[1].sample(c), d = self.nodes[2].sample(c);
      const s0 = a.rgb, sy = vec3(a.a, b.r, b.g), sz = vec3(b.b, b.a, d.r), sx = d.gba;
      const E = max(s0.mul(0.282095).add(sy.mul(N.y).add(sz.mul(N.z)).add(sx.mul(N.x)).mul(0.488603)), vec3(0));
      return mix(fallback, E, w).mul(self.uIntensity);
    })();
  }

  /** Blurry reflected radiance: the baked irradiance seen along the reflection, over π. */
  radianceNode() {
    return this.irradianceNode(reflectVector).div(Math.PI);
  }
}

/** Adds baked reflected light to a material's indirect specular term. */
export class GISpecularNode extends LightingNode {
  constructor(node) { super(); this.node = node; }
  setup(builder) { builder.context.radiance.addAssign(this.node); }
}
