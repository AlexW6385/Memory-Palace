// Worker: scatters plants in a cell, deterministically from the cell's position, following the
// regions' rules. Returns flat arrays: species index, variant, x, y, z, yaw, scale, tint.

import { terrainHeight, groundCover } from '../../world/regions.js';
import { densities, fromWater, MAX_DENSITY, NEAR_ONLY, ROWS } from '../../world/flora-rules.js';

const SPECIES = Object.keys(MAX_DENSITY);
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function place(x, z) {
  const h = terrainHeight(x, z);
  const e = 1.5;
  const dx = (terrainHeight(x + e, z) - terrainHeight(x - e, z)) / (2 * e), dz = (terrainHeight(x, z + e) - terrainHeight(x, z - e)) / (2 * e);
  const ny = 1 / Math.hypot(dx, 1, dz);
  return { x, z, h, ny, g: groundCover(x, z, h, ny), w: fromWater(x, z) };
}

self.onmessage = (e) => {
  const { id, rect, near } = e.data;
  const [x0, z0, x1, z1] = rect, area = (x1 - x0) * (z1 - z0);
  const rand = rng(Math.floor(x0 * 73856093) ^ Math.floor(z0 * 19349663) ^ (near ? 0x5bd1e995 : 0));
  const out = [];
  const cache = new Map();
  const at = (x, z) => {
    const k = `${Math.round(x)},${Math.round(z)}`;
    if (!cache.has(k)) cache.set(k, place(x, z));
    return cache.get(k);
  };
  SPECIES.forEach((sp, si) => {
    if (NEAR_ONLY.has(sp) !== !!near) return;
    const max = MAX_DENSITY[sp];
    let pts = [];
    if (ROWS[sp]) {
      // orchards: a grid of trees, slightly irregular, kept where the density says so
      const s = ROWS[sp];
      for (let x = Math.ceil(x0 / s) * s; x < x1; x += s) for (let z = Math.ceil(z0 / s) * s; z < z1; z += s) pts.push([x + (rand() - 0.5) * 1.2, z + (rand() - 0.5) * 1.2, 1]);
    } else {
      const n = Math.round(max * area / 100 * (0.9 + rand() * 0.2));
      for (let i = 0; i < n; i++) pts.push([x0 + rand() * (x1 - x0), z0 + rand() * (z1 - z0), rand()]);
    }
    for (const [x, z, r] of pts) {
      const p = at(x, z);
      if (p.ny < 0.35) continue;
      const d = densities(x, z, p);
      if (!d || !d[sp]) continue;
      const accept = ROWS[sp] ? d[sp] / max > 0.5 : r < d[sp] / max;
      if (!accept) continue;
      out.push(si, Math.floor(rand() * 4), x, p.h - 0.05, z, rand() * Math.PI * 2, rand(), rand());
    }
  });
  const data = new Float32Array(out);
  self.postMessage({ id, data }, [data.buffer]);
};

self.postMessage({ species: SPECIES });
