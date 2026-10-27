// Terrain geometry from the world's height function: fine patches over landforms, a coarse
// plane elsewhere. Shared by the viewer and the baker.

import { BufferGeometry, Float32BufferAttribute } from 'three';
import { terrainHeight } from '../world/regions.js';

/** Heightfield patch over rect [x0, z0, x1, z1] with the given grid step (non-indexed, smooth normals). */
export function terrainPatch([x0, z0, x1, z1], step = 2.5, height = terrainHeight) {
  const nx = Math.ceil((x1 - x0) / step), nz = Math.ceil((z1 - z0) / step);
  const H = new Float32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) H[j * (nx + 1) + i] = height(x0 + i * step, z0 + j * step);
  const h = (i, j) => H[Math.max(0, Math.min(nz, j)) * (nx + 1) + Math.max(0, Math.min(nx, i))];
  const N = (i, j) => {
    const dx = (h(i + 1, j) - h(i - 1, j)) / (2 * step), dz = (h(i, j + 1) - h(i, j - 1)) / (2 * step);
    const l = Math.hypot(dx, 1, dz);
    return [-dx / l, 1 / l, -dz / l];
  };
  const pos = [], nor = [];
  const P = (i, j) => [x0 + i * step, h(i, j), z0 + j * step];
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = [i, j], b = [i, j + 1], c = [i + 1, j + 1], d = [i + 1, j];
      for (const [p, q, r] of [[a, b, c], [a, c, d]]) {
        for (const v of [p, q, r]) { pos.push(...P(...v)); nor.push(...N(...v)); }
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  return g;
}
