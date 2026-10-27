// The town of Edfu (Behdet) around its temple, c. 57 BC: the town mound rises just west of the
// temple, 365 m north–south and 168 m east–west (Yale/ISAC Tell Edfu Project); more of the town
// lay south and east of the temple. Houses of mud brick in blocks between straight streets:
// tower houses of two or three storeys and courtyard houses (the Graeco-Roman types known from
// Karanis and Tebtunis). See docs/buildings/edfu.md §10.

import { terrainHeight, nearRoad, inRiver } from '../regions.js';
import { inSite } from '../flora-rules.js';

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function plan() {
  const rand = rng(57);
  const E = [];
  const free = (r) => {
    for (let x = r[0]; x <= r[2]; x += 2) for (let z = r[1]; z <= r[3]; z += 2) {
      if (nearRoad(x, z, 2.5) || inSite(x, z) || inRiver(x, z)) return false;
    }
    return true;
  };
  const lot = (r, front) => {
    if (!free(r)) return;
    const y = Math.min(terrainHeight(r[0], r[1]), terrainHeight(r[2], r[1]), terrainHeight(r[0], r[3]), terrainHeight(r[2], r[3]), terrainHeight((r[0] + r[2]) / 2, (r[1] + r[3]) / 2));
    const w = r[2] - r[0], d = r[3] - r[1];
    const courtyard = w > 9 && d > 9 && rand() < 0.4;
    const el = { t: 'house_egypt', rect: r, y, storeys: courtyard ? (rand() < 0.5 ? 1 : 2) : 2 + (rand() < 0.35 ? 1 : 0), front, plaster: rand() < 0.3 ? 1 : 0, seed: Math.floor(rand() * 1e6) };
    if (courtyard) { const m = 3.2; el.court = [r[0] + m, r[1] + m, r[2] - m, r[3] - m]; }
    E.push(el);
  };
  // blocks on the town mound west of the temple: streets every ~34 m (east–west) and ~42 m (north–south)
  const block = (bx0, bz0, bx1, bz1) => {
    // two rows of lots back to back, fronting the streets to the north and south
    const mid = (bz0 + bz1) / 2;
    for (const [z0, z1, front] of [[bz0, mid - 0.4, 'n'], [mid + 0.4, bz1, 's']]) {
      let x = bx0;
      while (x < bx1 - 5) {
        const w = Math.min(bx1 - x, 6.5 + rand() * 5);
        if (rand() < 0.08) { x += w + 1; continue; }                     // a gap: a garden, a ruin, a pen
        lot([x, z0, x + w - 0.3, z1], front);
        x += w;
      }
    }
  };
  for (let bx = -232; bx < -70; bx += 42) for (let bz = -238; bz < 120; bz += 34) block(bx + 2, bz + 2, Math.min(-68, bx + 42 - 2), bz + 34 - 2);
  // the quarter east of the temple, between its enclosure wall and the fields
  for (let bz = -130; bz < 20; bz += 30) block(52, bz + 2, 96, bz + 28);
  // a few houses south of the forecourt, beside the processional way
  for (const bx of [-100, -64, 30, 66]) block(bx, 52, bx + 32, 90);
  return {
    id: 'edfu-town', feature: true, style: 'vernacular', origin: [0, 0], yaw: 0, base: 0,
    bounds: [-240, -245, 100, 125], elements: E, rooms: [],
  };
}
