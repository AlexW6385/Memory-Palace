// Where plants grow in each region: densities (plants per 100 m²) as functions of the place.
// Pure; the viewer scatters from these deterministically, cell by cell. The reasoning for each
// region's planting is in its building's dossier (§10, surroundings) and docs/world.md.

import { REGIONS, regionWeights, riverCenter, WORLD, SITES, fbm, nearRoad } from './regions.js';

const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** Distance from the water's edge (negative in the water). */
export function fromWater(x, z) { return Math.abs(x - riverCenter(z)) - WORLD.river.width / 2; }

/** Inside a building's levelled site (no planting there, except what the plan places). */
const PADS = Object.values(SITES).map((s) => { const [x0, z0, x1, z1] = s.pad || [0, 0, 0, 0]; return [s.origin[0] + x0 - 4, s.origin[1] + z0 - 4, s.origin[0] + x1 + 4, s.origin[1] + z1 + 4]; });
export function inSite(x, z) { return PADS.some((r) => x > r[0] && x < r[2] && z > r[1] && z < r[3]); }

/** Keep-clear corridors (roads, processional ways) registered by the regions' features. */
const CLEAR = [];
export function keepClear(poly, width) { CLEAR.push({ poly, width }); }
function inClear(x, z) {
  for (const { poly, width } of CLEAR) {
    for (let i = 0; i < poly.length - 1; i++) {
      const [ax, az] = poly[i], [bx, bz] = poly[i + 1], vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2));
      if (Math.hypot(x - ax - vx * t, z - az - vz * t) < width / 2) return true;
    }
  }
  return false;
}

/**
 * Densities by region. Each function receives the place: { x, z, h (ground height),
 * ny (normal y), g (ground cover), w (distance from the water's edge) } and returns plants per 100 m².
 */
const RULES = {
  nile: {
    // date palms: groves along the water and the field edges, thinning into the desert
    date_palm: ({ x, z, w, g }) => (w < 0 ? 0 : 1.1 * Math.exp(-w / 90) * smooth(-0.25, 0.3, fbm(x * 0.01, z * 0.01)) + 0.35 * g.fields * smooth(0.0, 0.5, fbm(x * 0.03 + 5, z * 0.03))),
    doum_palm: ({ x, z, w }) => (w < 4 ? 0 : 0.12 * Math.exp(-w / 120) * smooth(0, 0.5, fbm(x * 0.008 + 3, z * 0.008))),
    sycamore_fig: ({ w, g }) => (w < 6 ? 0 : 0.03 * g.fields + 0.02 * Math.exp(-w / 60)),
    acacia: ({ x, z, g, w }) => (w < 10 ? 0 : 0.06 * g.sand * smooth(0.02, 0.2, g.fields + 0.1 * Math.exp(-w / 200)) + 0.01 * g.sand * smooth(0.3, 0.6, fbm(x * 0.02, z * 0.02))),
    tamarisk: ({ x, z, g, w }) => (w < 3 ? 0 : 0.12 * Math.exp(-w / 90) * g.sand + 0.02 * g.sand * smooth(0.35, 0.7, fbm(x * 0.03 + 9, z * 0.03))),
    papyrus: ({ w, x, z }) => (w > -3 && w < 6 ? 2.2 * smooth(0, 0.4, fbm(x * 0.02, z * 0.02) + 0.2) : 0),
    reeds: ({ w }) => (w > -4 && w < 10 ? 3.0 : 0),
    halfa: ({ g, w, ny }) => (w < 8 ? 0 : 0.25 * g.sand * ny),
    boulder: ({ h, ny, g }) => (ny < 0.9 && h > 4 ? 0.5 * g.rock : 0),
  },
  rome: {
    stone_pine: ({ x, z, h }) => 0.08 * smooth(-0.1, 0.35, fbm(x * 0.006 + 1, z * 0.006)) + (h > 8 ? 0.08 : 0),
    cypress: ({ x, z }) => 0.025 * smooth(0.2, 0.5, fbm(x * 0.01 + 2, z * 0.01)),
    holm_oak: ({ x, z, h, ny }) => (ny > 0.7 ? 0.1 * smooth(4, 14, h) + 0.03 * smooth(0.2, 0.6, fbm(x * 0.008, z * 0.008)) : 0),
    oleander: ({ x, z, w }) => 0.06 * smooth(0.1, 0.5, fbm(x * 0.02 + 6, z * 0.02)) + (w > 0 && w < 30 ? 0.15 : 0),
    reeds: ({ w }) => (w > -4 && w < 8 ? 2.4 : 0),
    grass: ({ g }) => 70 * g.grass,
    boulder: ({ ny, g }) => (ny < 0.85 ? 0.3 * g.rock : 0),
  },
  greece: {
    // olive groves in rows on the plain, patchy
    olive: ({ x, z, h, ny }) => (ny > 0.85 && h < 30 ? 0.55 * smooth(-0.15, 0.2, fbm(x * 0.004 + 7, z * 0.004)) : 0),
    aleppo_pine: ({ x, z, h, ny }) => (ny > 0.55 ? 0.06 * smooth(15, 50, h) + 0.02 * smooth(0.3, 0.6, fbm(x * 0.01, z * 0.01)) : 0),
    cypress: ({ x, z }) => 0.012 * smooth(0.3, 0.6, fbm(x * 0.01 + 4, z * 0.01)),
    maquis: ({ ny, g }) => (ny > 0.5 ? 0.9 * (g.grass + g.rock * 0.6) : 0),
    grass_dry: ({ g }) => 45 * g.grass,
    boulder: ({ ny, g }) => 0.25 * g.rock + (ny < 0.8 ? 0.4 : 0),
  },
};

/** Species that grow in rows (orchards), with their spacing in metres. */
export const ROWS = { olive: 9 };

/** All the species and densities at a place, blended across region boundaries. */
export function densities(x, z, place) {
  if (inSite(x, z) || inClear(x, z) || nearRoad(x, z)) return null;
  const W = regionWeights(x, z), out = {};
  REGIONS.forEach((r, i) => {
    if (W[i] < 0.02) return;
    for (const [sp, f] of Object.entries(RULES[r.id] || {})) out[sp] = (out[sp] || 0) + W[i] * Math.max(0, f(place));
  });
  return out;
}

/** The largest density each species can reach (for rejection sampling). */
export const MAX_DENSITY = { date_palm: 1.2, doum_palm: 0.15, sycamore_fig: 0.06, acacia: 0.08, tamarisk: 0.16, papyrus: 2.2, reeds: 3, halfa: 0.25, boulder: 0.7,
  stone_pine: 0.17, cypress: 0.03, holm_oak: 0.14, oleander: 0.21, grass: 70, olive: 0.55, aleppo_pine: 0.08, maquis: 0.9, grass_dry: 45 };

/** Small plants scattered only near the viewer. */
export const NEAR_ONLY = new Set(['grass', 'grass_dry']);
