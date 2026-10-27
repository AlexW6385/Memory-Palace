// Constantinople round Hagia Sophia, 6th century: quarters of town houses on the slopes of the
// first hill and toward the second and third hills and the harbour — rubble and brick below,
// plastered above, upper storeys jettied over narrow streets, hipped roofs of curved tiles.
// See docs/buildings/hagia-sophia.md §10 and docs/world.md (Byzantium).

import { terrainHeight, nearRoad, inRiver, TOWNS } from '../regions.js';
import { inSite } from '../flora-rules.js';

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function plan() {
  const rand = rng(562);
  const E = [];
  const free = (r) => {
    for (let x = r[0]; x <= r[2] + 0.01; x += 2) for (let z = r[1]; z <= r[3] + 0.01; z += 2) {
      if (nearRoad(x, z, 3) || inSite(x, z) || inRiver(x, z)) return false;
    }
    return true;
  };
  const lot = (r, front) => {
    if (!free(r)) return;
    const hs = [terrainHeight(r[0], r[1]), terrainHeight(r[2], r[1]), terrainHeight(r[0], r[3]), terrainHeight(r[2], r[3])];
    const lo = Math.min(...hs), hi = Math.max(...hs);
    if (hi - lo > 4.5 || lo < 0.4) return;                // too steep, or on the beach
    const storeys = 2 + (rand() < 0.3 ? 1 : 0) - (rand() < 0.12 ? 1 : 0);
    E.push({ t: 'house_tiled', rect: r, y: hi, foot: lo, storeys, front, plaster: rand() < 0.7 ? 1 : 0, seed: Math.floor(rand() * 1e6) });
  };
  // blocks between streets: 34 m east–west, 28 m north–south, streets 5 m wide
  for (const t of TOWNS) for (const [X0, Z0, X1, Z1] of t.rects) {
    for (let bx = X0; bx < X1 - 10; bx += 39) for (let bz = Z0; bz < Z1 - 10; bz += 33) {
      const b = [bx, bz, Math.min(X1, bx + 34), Math.min(Z1, bz + 28)];
      const mid = (b[1] + b[3]) / 2;
      for (const [z0, z1, front] of [[b[1], mid - 0.3, 'n'], [mid + 0.3, b[3], 's']]) {
        let x = b[0];
        while (x < b[2] - 5) {
          const w = Math.min(b[2] - x, 6.5 + rand() * 5.5);
          if (rand() < 0.12) { x += w + 1; continue; }        // a garden or a yard
          lot([x, z0, x + w - 0.4, z1 - (rand() < 0.4 ? 2 + rand() * 3 : 0)], front);
          x += w;
        }
      }
    }
  }
  return {
    id: 'constantinople-town', feature: true, style: 'vernacular', origin: [0, 0], yaw: 0, base: 0,
    bounds: [-440, -3480, 200, -3070], elements: E, rooms: [],
  };
}
