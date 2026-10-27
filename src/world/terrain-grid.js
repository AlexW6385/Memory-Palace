// Builds one terrain chunk as typed arrays: positions, normals, ground cover. Runs in a worker
// in the viewer and directly in Node (baker, tests). Indexed triangles; a skirt hangs from the
// edges so that chunks of different resolution meet without cracks.

import { terrainHeight, groundCover } from './regions.js';

/**
 * rect [x0, z0, x1, z1], step (m). Returns { position, normal, ground (vec4: sand, grass,
 * rock, soil), ground2 (vec4: fields, dry, warmth, red), index } as typed arrays.
 */
export function buildChunk([x0, z0, x1, z1], step) {
  const nx = Math.round((x1 - x0) / step), nz = Math.round((z1 - z0) / step);
  const W = nx + 3, Hh = nz + 3;                         // one extra sample ring for normals
  const H = new Float32Array(W * Hh);
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) H[j * W + i] = terrainHeight(x0 + (i - 1) * step, z0 + (j - 1) * step);
  const h = (i, j) => H[(j + 1) * W + (i + 1)];
  const verts = (nx + 1) * (nz + 1), skirt = 2 * (nx + nz) + 4;
  const n = verts + skirt;
  const position = new Float32Array(n * 3), normal = new Float32Array(n * 3);
  const ground = new Float32Array(n * 4), ground2 = new Float32Array(n * 4), road = new Float32Array(n);
  let v = 0;
  const put = (i, j, drop) => {
    const x = x0 + i * step, z = z0 + j * step, y = h(i, j);
    const dx = (h(i + 1, j) - h(i - 1, j)) / (2 * step), dz = (h(i, j + 1) - h(i, j - 1)) / (2 * step);
    const l = Math.hypot(dx, 1, dz), ny = 1 / l;
    position[v * 3] = x; position[v * 3 + 1] = y - drop; position[v * 3 + 2] = z;
    normal[v * 3] = -dx / l; normal[v * 3 + 1] = ny; normal[v * 3 + 2] = -dz / l;
    const g = groundCover(x, z, y, ny);
    ground.set([g.sand, g.grass, g.rock, g.soil], v * 4);
    ground2.set([g.fields, g.dry, g.warmth ?? 0, g.red ?? 0], v * 4);
    road[v] = g.road ?? 0;
    return v++;
  };
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) put(i, j, 0);
  const idx = [];
  const at = (i, j) => j * (nx + 1) + i;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = at(i, j), b = at(i, j + 1), c = at(i + 1, j + 1), d = at(i + 1, j);
    // alternate the diagonal so slopes do not show a directional grain
    if ((i + j) & 1) idx.push(a, b, c, a, c, d); else idx.push(a, b, d, b, c, d);
  }
  // skirt: a copy of the edge ring dropped below, joined to the edge
  const drop = step * 1.5 + 1;
  const ring = [];
  for (let i = 0; i <= nx; i++) ring.push([i, 0]);
  for (let j = 1; j <= nz; j++) ring.push([nx, j]);
  for (let i = nx - 1; i >= 0; i--) ring.push([i, nz]);
  for (let j = nz - 1; j >= 1; j--) ring.push([0, j]);
  const top = ring.map(([i, j]) => at(i, j));
  const low = ring.map(([i, j]) => put(i, j, drop));
  for (let k = 0; k < ring.length; k++) {
    const k2 = (k + 1) % ring.length;
    idx.push(top[k], low[k], low[k2], top[k], low[k2], top[k2]);
  }
  const index = verts + skirt > 65535 ? new Uint32Array(idx) : new Uint16Array(idx);
  return { position: position.subarray(0, v * 3), normal: normal.subarray(0, v * 3), ground: ground.subarray(0, v * 4), ground2: ground2.subarray(0, v * 4), road: road.subarray(0, v), index };
}
