#!/usr/bin/env node
// Offline light bake: an irradiance volume (L1 spherical harmonics on a regular grid) per
// building, from the same geometry the viewer shows. Sun (with shadows), sky and oil lamps,
// plus bounced light (two passes). Output: data/gi/<id>.gi (format in src/engine/gi.js).
//
// usage: node tools/bake.mjs [building-id ...] [--spacing 1.0] [--rays 64] [--threads N]

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BufferGeometry, Float32BufferAttribute, Ray, Vector3, DoubleSide, DataUtils } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { BUILDINGS } from '../src/buildings/index.js';
import { buildPlan, toWorld } from '../src/core/build.js';
import { albedo } from '../src/core/palette.js';
import { SUN_DIR, SUN_COLOR, SUN_INTENSITY, skyRadiance } from '../src/core/light.js';
import { terrainPatch } from '../src/core/terrain-mesh.js';
import { terrainHeight } from '../src/world/layout.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MAGIC = 0x4947504D;

/** Scene for ray tracing: merged triangles with an albedo per triangle, and the lamps. */
async function scene(id) {
  const entry = BUILDINGS.find((b) => b.id === id);
  const { plan } = await entry.load();
  const built = buildPlan(plan);
  const pos = [], alb = [];
  for (const { mat, geometry } of built.parts) {
    if (mat === 'water') continue;
    const a = albedo(mat), p = geometry.attributes.position.array;
    for (let i = 0; i < p.length; i++) pos.push(p[i]);
    for (let t = 0; t < p.length / 9; t++) alb.push(a[0], a[1], a[2]);
  }
  // open ground around the building
  const [bx0, bz0, bx1, bz1] = plan.bounds;
  const c0 = toWorld(plan, bx0, bz0), c1 = toWorld(plan, bx1, bz1);
  const gx0 = Math.min(c0[0], c1[0]) - 300, gx1 = Math.max(c0[0], c1[0]) + 300, gz0 = Math.min(c0[2], c1[2]) - 300, gz1 = Math.max(c0[2], c1[2]) + 300;
  const ground = terrainPatch([gx0, gz0, gx1, gz1], 3, (x, z) => terrainHeight(x, z) - 0.02);
  const gp = ground.attributes.position.array, ga = albedo('ground');
  for (let i = 0; i < gp.length; i++) pos.push(gp[i]);
  for (let t = 0; t < gp.length / 9; t++) alb.push(...ga);
  return { plan, built, pos: new Float32Array(pos), alb: new Float32Array(alb), lights: built.lights };
}

function grid(plan, spacing) {
  const [bx0, bz0, bx1, bz1] = plan.bakeBounds || plan.bounds;
  const a = toWorld(plan, bx0, bz0), b = toWorld(plan, bx1, bz1);
  const min = [Math.min(a[0], b[0]), (plan.base || 0) + 0.5, Math.min(a[2], b[2])];
  const max = [Math.max(a[0], b[0]), (plan.base || 0) + (plan.bakeTop ?? 20), Math.max(a[2], b[2])];
  const n = [0, 1, 2].map((k) => Math.max(2, Math.round((max[k] - min[k]) / spacing) + 1));
  return { min, n, spacing };
}

// ── worker: trace probes for a range of z slices ─────────────────────────────

function workerMain() {
  const { pos, alb, lights, G, rays, zs, prev, pass } = workerData;
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(pos), 3));
  const bvh = new MeshBVH(geo, { targetLeafSize: 8 });
  const A = new Float32Array(alb);
  const prevV = prev ? new Float32Array(prev) : null;
  const [nx, ny, nz] = G.n, s = G.spacing;
  const ray = new Ray(new Vector3(), new Vector3());
  const sray = new Ray(new Vector3(), new Vector3());
  const sun = new Vector3(...SUN_DIR);
  const sunE = SUN_COLOR.map((c) => c * SUN_INTENSITY);
  const ga = albedo('ground');
  const sky0 = skyRadiance([0, 1, 0]);
  const groundL = [0, 1, 2].map((k) => ga[k] * (sunE[k] * SUN_DIR[1] + Math.PI * sky0[k]) / Math.PI);
  // fibonacci directions
  const dirs = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < rays; i++) {
    const y = 1 - (2 * (i + 0.5)) / rays, r = Math.sqrt(1 - y * y), th = golden * i;
    dirs.push([Math.cos(th) * r, y, Math.sin(th) * r]);
  }
  const occluded = (o, d, far) => {
    sray.origin.set(o[0], o[1], o[2]); sray.direction.set(d[0], d[1], d[2]);
    return bvh.raycastFirst(sray, DoubleSide, 0, far) !== null;
  };
  // trilinear SH sample of the previous pass at p with normal n → irradiance rgb
  const sampleE = (p, nrm, out) => {
    const fx = (p[0] - G.min[0]) / s, fy = (p[1] - G.min[1]) / s, fz = (p[2] - G.min[2]) / s;
    if (fx < 0 || fz < 0 || fx > nx - 1 || fz > nz - 1 || fy > ny - 1) { out[0] = out[1] = out[2] = -1; return; }
    const x0 = Math.min(nx - 2, Math.floor(fx)), y0 = Math.max(0, Math.min(ny - 2, Math.floor(fy))), z0 = Math.min(nz - 2, Math.floor(fz));
    const tx = fx - x0, ty = Math.max(0, Math.min(1, fy - y0)), tz = fz - z0;
    out[0] = out[1] = out[2] = 0;
    for (let c = 0; c < 8; c++) {
      const dx = c & 1, dy = (c >> 1) & 1, dz = (c >> 2) & 1;
      const w = (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty) * (dz ? tz : 1 - tz);
      const i = ((z0 + dz) * ny * nx + (y0 + dy) * nx + (x0 + dx)) * 12;
      for (let k = 0; k < 3; k++) {
        const e = prevV[i + k] * 0.282095 + 0.488603 * (prevV[i + 3 + k] * nrm[1] + prevV[i + 6 + k] * nrm[2] + prevV[i + 9 + k] * nrm[0]);
        out[k] += w * Math.max(0, e);
      }
    }
  };
  const out = new Float32Array((zs[1] - zs[0]) * ny * nx * 12);
  const valid = new Uint8Array((zs[1] - zs[0]) * ny * nx);
  const tmp = [0, 0, 0];
  let rng = 12345 + zs[0] * 7919;
  const rand = () => ((rng = (rng * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let z = zs[0]; z < zs[1]; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const o = [G.min[0] + x * s, G.min[1] + y * s, G.min[2] + z * s];
        const sh = new Float64Array(12);
        let back = 0;
        // random rotation about y plus a small tilt to decorrelate neighbouring probes
        const a = rand() * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        for (let r = 0; r < rays; r++) {
          const d0 = dirs[r];
          const d = [ca * d0[0] - sa * d0[2], d0[1], sa * d0[0] + ca * d0[2]];
          ray.origin.set(o[0], o[1], o[2]); ray.direction.set(d[0], d[1], d[2]);
          const hit = bvh.raycastFirst(ray, DoubleSide, 0, 500);
          let L = [0, 0, 0];
          if (!hit) {
            L = d[1] >= 0 ? skyRadiance(d) : groundL;
          } else {
            const n = hit.face.normal;
            const facing = n.x * d[0] + n.y * d[1] + n.z * d[2];
            if (facing > 0) { back++; continue; }
            const tri = hit.faceIndex;
            const al = [A[tri * 3], A[tri * 3 + 1], A[tri * 3 + 2]];
            const p = [hit.point.x + n.x * 0.02, hit.point.y + n.y * 0.02, hit.point.z + n.z * 0.02];
            const nn = [n.x, n.y, n.z];
            const E = [0, 0, 0];
            const ndl = nn[0] * sun.x + nn[1] * sun.y + nn[2] * sun.z;
            if (ndl > 0 && !occluded(p, SUN_DIR, 800)) for (let k = 0; k < 3; k++) E[k] += sunE[k] * ndl;
            for (const l of lights) {
              const lx = l.at[0] - p[0], ly = l.at[1] - p[1], lz = l.at[2] - p[2];
              const dd = Math.hypot(lx, ly, lz);
              if (dd > l.distance) continue;
              const ln = (nn[0] * lx + nn[1] * ly + nn[2] * lz) / dd;
              if (ln <= 0) continue;
              if (occluded(p, [lx / dd, ly / dd, lz / dd], dd - 0.15)) continue;
              const att = Math.pow(Math.max(0, 1 - Math.pow(dd / l.distance, 4)), 2) / Math.max(dd * dd, 0.09);
              const col = hex(l.color);
              for (let k = 0; k < 3; k++) E[k] += col[k] * l.intensity * ln * att;
            }
            if (prevV) {
              sampleE([p[0] + nn[0] * 0.45, p[1] + nn[1] * 0.45, p[2] + nn[2] * 0.45], nn, tmp);
              if (tmp[0] >= 0) for (let k = 0; k < 3; k++) E[k] += tmp[k];
              else for (let k = 0; k < 3; k++) E[k] += Math.PI * sky0[k] * Math.max(0, nn[1] * 0.5 + 0.5);
            } else {
              // first pass: approximate the bounce with a dim open-sky term (refined in pass two)
              for (let k = 0; k < 3; k++) E[k] += Math.PI * sky0[k] * 0.15;
            }
            for (let k = 0; k < 3; k++) L[k] = (al[k] / Math.PI) * E[k];
          }
          for (let k = 0; k < 3; k++) {
            sh[k] += L[k] * 0.282095;
            sh[3 + k] += L[k] * 0.488603 * d[1];
            sh[6 + k] += L[k] * 0.488603 * d[2];
            sh[9 + k] += L[k] * 0.488603 * d[0];
          }
        }
        const li = ((z - zs[0]) * ny * nx + y * nx + x);
        const w = (4 * Math.PI) / rays;
        for (let k = 0; k < 3; k++) {
          out[li * 12 + k] = sh[k] * w * Math.PI;
          out[li * 12 + 3 + k] = sh[3 + k] * w * (2 * Math.PI / 3);
          out[li * 12 + 6 + k] = sh[6 + k] * w * (2 * Math.PI / 3);
          out[li * 12 + 9 + k] = sh[9 + k] * w * (2 * Math.PI / 3);
        }
        valid[li] = back / rays < 0.15 ? 1 : 0;
      }
    }
    parentPort.postMessage({ progress: 1 });
  }
  parentPort.postMessage({ done: true, out: out.buffer, valid: valid.buffer }, [out.buffer, valid.buffer]);
}

const hexCache = new Map();
function hex(c) {
  if (hexCache.has(c)) return hexCache.get(c);
  const h = parseInt(c.slice(1), 16);
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const r = [lin((h >> 16) & 255), lin((h >> 8) & 255), lin(h & 255)];
  hexCache.set(c, r);
  return r;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function runPass(S, G, rays, threads, prev, pass) {
  const [nx, ny, nz] = G.n;
  const vol = new Float32Array(nx * ny * nz * 12);
  const valid = new Uint8Array(nx * ny * nz);
  const chunks = [];
  const per = Math.ceil(nz / (threads * 4));
  for (let z = 0; z < nz; z += per) chunks.push([z, Math.min(nz, z + per)]);
  let doneSlices = 0;
  const t0 = Date.now();
  const runChunk = (zs) => new Promise((ok, fail) => {
    const w = new Worker(fileURLToPath(import.meta.url), {
      workerData: { pos: S.pos.buffer.slice(0), alb: S.alb.buffer.slice(0), lights: S.lights, G, rays, zs, prev, pass },
    });
    w.on('message', (m) => {
      if (m.progress) {
        doneSlices++;
        if (doneSlices % 8 === 0 || doneSlices === nz) {
          const el = (Date.now() - t0) / 1000;
          process.stdout.write(`\r  pass ${pass}: ${doneSlices}/${nz} slices, ${el.toFixed(0)}s, eta ${(el / doneSlices * (nz - doneSlices)).toFixed(0)}s   `);
        }
      }
      if (m.done) {
        vol.set(new Float32Array(m.out), zs[0] * ny * nx * 12);
        valid.set(new Uint8Array(m.valid), zs[0] * ny * nx);
        ok();
      }
    });
    w.on('error', fail);
  });
  const queue = chunks.slice();
  await Promise.all(Array.from({ length: threads }, async () => { while (queue.length) await runChunk(queue.shift()); }));
  process.stdout.write('\n');
  fill(vol, valid, G.n);
  smooth(vol, G.n);
  return vol;
}

/** Replace probes inside solid geometry with the average of valid neighbours (repeated dilation). */
function fill(vol, valid, [nx, ny, nz]) {
  let missing = 0;
  for (let i = 0; i < valid.length; i++) missing += valid[i] ? 0 : 1;
  for (let iter = 0; iter < 64 && missing > 0; iter++) {
    const add = [];
    for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const i = z * ny * nx + y * nx + x;
      if (valid[i]) continue;
      const acc = new Float64Array(12);
      let c = 0;
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const X = x + dx, Y = y + dy, Z = z + dz;
        if (X < 0 || Y < 0 || Z < 0 || X >= nx || Y >= ny || Z >= nz) continue;
        const j = Z * ny * nx + Y * nx + X;
        if (!valid[j]) continue;
        for (let k = 0; k < 12; k++) acc[k] += vol[j * 12 + k];
        c++;
      }
      if (c) add.push([i, acc.map((v) => v / c)]);
    }
    for (const [i, v] of add) { vol.set(v, i * 12); valid[i] = 1; missing--; }
    if (!add.length) break;
  }
}

/** One pass of a [1 2 1] filter along each axis to remove sampling noise. */
function smooth(vol, [nx, ny, nz]) {
  const idx = (x, y, z) => (z * ny * nx + y * nx + x) * 12;
  for (const [ax, n] of [[0, nx], [1, ny], [2, nz]]) {
    const src = vol.slice();
    for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const p = [x, y, z];
      const a = p.slice(), b = p.slice();
      a[ax] = Math.max(0, p[ax] - 1); b[ax] = Math.min(n - 1, p[ax] + 1);
      const i = idx(...p), ia = idx(...a), ib = idx(...b);
      for (let k = 0; k < 12; k++) vol[i + k] = 0.5 * src[i + k] + 0.25 * (src[ia + k] + src[ib + k]);
    }
  }
}

/**
 * Write data/gi/<id>.gi: a 36-byte header, then the 12 SH coefficient planes as half floats,
 * delta-coded along the grid, byte-shuffled and gzipped (half floats compress poorly as is;
 * GitHub Pages does not compress binary files).
 */
export async function write(id, G, vol) {
  const [nx, ny, nz] = G.n, N = nx * ny * nz;
  const header = new ArrayBuffer(36);
  new Uint32Array(header, 0, 5).set([MAGIC, 3, nx, ny, nz]);
  new Float32Array(header, 20, 4).set([G.min[0], G.min[1], G.min[2], G.spacing]);
  const planes = new Uint16Array(N * 12);
  for (let c = 0; c < 12; c++) {
    let prev = 0;
    for (let i = 0; i < N; i++) {
      const h = DataUtils.toHalfFloat(vol[i * 12 + c]);
      planes[c * N + i] = (h - prev) & 0xffff;
      prev = h;
    }
  }
  const bytes = new Uint8Array(planes.buffer), M = planes.length;
  const shuffled = Buffer.alloc(bytes.length);
  for (let i = 0; i < M; i++) { shuffled[i] = bytes[2 * i]; shuffled[M + i] = bytes[2 * i + 1]; }
  const payload = gzipSync(shuffled, { level: 9 });
  await mkdir(join(ROOT, 'data/gi'), { recursive: true });
  const file = join(ROOT, 'data/gi', `${id}.gi`);
  await writeFile(file, Buffer.concat([Buffer.from(header), payload]));
  return { file, bytes: 36 + payload.length };
}

if (isMainThread) {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
  const ids = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
  const spacing = +opt('spacing', 1.0), rays = +opt('rays', 160);
  const threads = +opt('threads', Math.max(1, availableParallelism()));
  for (const b of BUILDINGS) {
    if (ids.length && !ids.includes(b.id)) continue;
    const t0 = Date.now();
    const S = await scene(b.id);
    const G = grid(S.plan, args.includes('--spacing') ? spacing : (S.plan.bakeSpacing ?? spacing));
    console.log(`${b.id}: ${S.pos.length / 9} triangles, ${S.lights.length} lamps, ${G.n.join('×')} probes (${G.n[0] * G.n[1] * G.n[2]}), ${rays} rays, ${threads} threads`);
    const v1 = await runPass(S, G, rays, threads, null, 1);
    const v2 = await runPass(S, G, rays, threads, v1.buffer, 2);
    const { file, bytes } = await write(b.id, G, v2);
    console.log(`  wrote ${file} (${(bytes / 1e6).toFixed(1)} MB) in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
} else {
  workerMain();
}
