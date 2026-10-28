// The houses of the city: every district's quarters round its building, of that district's time —
// mud-brick tower and courtyard houses at Edfu, tiled houses in Rome, Athens and Constantinople,
// stone houses with domed roofs by the Haram, timber-framed houses in Paris, walled courtyard
// houses of grey brick at Foguang, timber houses at Uji, brick and thatch at Sanchi.
// The sources for each are in the buildings' dossiers (§10, surroundings) and docs/world.md.
//
// The whole city is laid out on one grid of blocks with lanes between them; each block belongs to
// the district its centre lies in and is built with that district's houses. A lot is left empty
// where it would touch a street, a building's site or a pond, or where the ground is too steep;
// about one block in seven is a garden. Deterministic: the same lots every time.

import { REGIONS, REGION, WORLD, terrainHeight, nearRoad, inPond, regionAt, inCity } from './regions.js';
import { inSite } from './flora-rules.js';

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function hash(i, j) { let h = (i * 374761393 + j * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return (h ^ (h >>> 16)) >>> 0; }

/** Block pitch (m): a block and the lane beside it. */
const BX = 40, BZ = 34, LANE = 5;

let BLOCKS = null, NI = 0, NJ = 0;

/** Every block of the city: { rect, region, garden, houses: [elements] } (computed once). */
export function blocks() {
  if (BLOCKS) return BLOCKS;
  BLOCKS = [];
  const [X0, Z0, X1, Z1] = WORLD.bounds;
  for (let i = 0, bx = X0 + 6; bx + 16 < X1 - 6; i++, bx += BX) for (let j = 0, bz = Z0 + 6; bz + 14 < Z1 - 6; j++, bz += BZ) {
    const rect = [bx, bz, Math.min(X1 - 6, bx + BX - LANE), Math.min(Z1 - 6, bz + BZ - LANE)];
    const region = regionAt((rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2).id;
    const seed = hash(i + 1000, j + 1000);
    const garden = (seed % 7) === 0;
    const inside = Math.min(inCity(rect[0], rect[1]), inCity(rect[2], rect[1]), inCity(rect[0], rect[3]), inCity(rect[2], rect[3])) > 4;
    const houses = garden || !inside ? [] : buildBlock(rect, region, rng(seed));
    BLOCKS.push({ rect, region, garden: garden && inside, houses });
    NI = i + 1; NJ = Math.max(NJ, j + 1);
  }
  return BLOCKS;
}

/** Is the ground free for a house: not on a street, a building's site or a pond? */
function free(r) {
  for (let x = r[0]; x <= r[2] + 0.01; x += 2) for (let z = r[1]; z <= r[3] + 0.01; z += 2) {
    if (nearRoad(x, z, 2.5) || inSite(x, z) || inPond(x, z)) return false;
  }
  return true;
}

/** Two rows of lots back to back, each fronting the lane to its north or south. */
function buildBlock(b, region, rand) {
  const type = REGION[region].house, out = [];
  const mid = (b[1] + b[3]) / 2;
  for (const [z0, z1, front] of [[b[1], mid - 0.3, 'n'], [mid + 0.3, b[3], 's']]) {
    let x = b[0];
    while (x < b[2] - 5) {
      const w = Math.min(b[2] - x, 7 + rand() * 6);
      if (rand() < 0.1) { x += w; continue; }                  // a yard, a garden, a pen
      const back = rand() < 0.4 ? 2 + rand() * 3 : 0;          // some houses leave a yard behind
      const r = front === 'n' ? [x, z0, x + w - 0.4, z1 - back] : [x, z0 + back, x + w - 0.4, z1];
      x += w;
      if (r[2] - r[0] < 5 || r[3] - r[1] < 5 || !free(r)) continue;
      const hs = [terrainHeight(r[0], r[1]), terrainHeight(r[2], r[1]), terrainHeight(r[0], r[3]), terrainHeight(r[2], r[3])];
      const lo = Math.min(...hs), hi = Math.max(...hs);
      if (hi - lo > 3.5) continue;                             // too steep: left as rough ground
      out.push(house(type, r, lo, hi, front, rand));
    }
  }
  return out;
}

function house(type, r, lo, hi, front, rand) {
  if (type === 'house_egypt') {
    const w = r[2] - r[0], d = r[3] - r[1], court = w > 9 && d > 9 && rand() < 0.4;
    const el = { t: type, rect: r, y: lo, storeys: court ? (rand() < 0.5 ? 1 : 2) : 2 + (rand() < 0.35 ? 1 : 0), front, plaster: rand() < 0.3 ? 1 : 0, seed: Math.floor(rand() * 1e6) };
    if (court) { const m = 3.2; el.court = [r[0] + m, r[1] + m, r[2] - m, r[3] - m]; }
    return el;
  }
  const storeys = 2 + (rand() < 0.3 ? 1 : 0) - (rand() < 0.15 ? 1 : 0);
  return { t: type, rect: r, y: hi, foot: lo, storeys, front, plaster: rand() < 0.7 ? 1 : 0, seed: Math.floor(rand() * 1e6) };
}

/** The block at (x, z), or null in a lane, a street or beyond the city. */
export function blockAt(x, z) {
  const [X0, Z0] = WORLD.bounds;
  const i = Math.floor((x - X0 - 6) / BX), j = Math.floor((z - Z0 - 6) / BZ);
  const B = blocks();
  if (i < 0 || j < 0 || i >= NI || j >= NJ) return null;
  const b = B[i * NJ + j];
  return b && x >= b.rect[0] && x <= b.rect[2] && z >= b.rect[1] && z <= b.rect[3] ? b : null;
}

/** Is (x, z) in a built block (where only grass grows between the houses)? */
export function inQuarter(x, z) { const b = blockAt(x, z); return !!b && !b.garden && b.houses.length > 0; }

/** Is (x, z) in a garden block (a grove, an orchard, a garden of its district)? */
export function inGarden(x, z) { const b = blockAt(x, z); return !!b && b.garden; }

/** The ground a district's quarter covers (bounding rectangle of its built blocks). */
export function quarterBounds(region) {
  const bs = blocks().filter((b) => b.region === region && b.houses.length);
  if (!bs.length) return null;
  return [Math.min(...bs.map((b) => b.rect[0])), Math.min(...bs.map((b) => b.rect[1])), Math.max(...bs.map((b) => b.rect[2])), Math.max(...bs.map((b) => b.rect[3]))];
}

/** The plan of a district's quarter: all its houses, as one feature. */
export function plan(region) {
  const E = blocks().filter((b) => b.region === region).flatMap((b) => b.houses);
  return { id: `${region}-quarter`, feature: true, style: 'vernacular', origin: [0, 0], yaw: 0, base: 0, bounds: quarterBounds(region), elements: E, rooms: [] };
}

export const DISTRICTS = REGIONS.map((r) => r.id);
