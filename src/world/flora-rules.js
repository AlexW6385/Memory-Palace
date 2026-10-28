// Where plants grow in each district of the city: densities (plants per 100 m²) as functions of
// the place. Pure; the viewer scatters from these deterministically, cell by cell. Within the city
// trees stand in the gardens, the yards and the open ground between the quarters, on the slopes of
// the districts' hills and by the ponds; between the houses of a built block only grass grows.
// The reasoning for each district's planting is in its building's dossier (§10) and docs/world.md.

import { REGIONS, regionWeights, pondDistance, SITES, fbm, nearRoad } from './regions.js';
import { inQuarter, inGarden, inSquare } from './city.js';

const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** Distance from the water's edge (negative in the water; far from any pond, a large number). */
export function fromWater(x, z) { const d = pondDistance(x, z).d; return Number.isFinite(d) ? d : 999; }

/** Inside a building's levelled site (no planting there, except what the plan places). */
const PADS = Object.values(SITES).map((s) => { const [x0, z0, x1, z1] = s.pad || [0, 0, 0, 0]; return [s.origin[0] + x0 - 4, s.origin[1] + z0 - 4, s.origin[0] + x1 + 4, s.origin[1] + z1 + 4]; });
export function inSite(x, z) { return PADS.some((r) => x > r[0] && x < r[2] && z > r[1] && z < r[3]); }

/** Keep-clear corridors (processional ways) registered by features. */
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

/** Patches of planting (gardens, groves): 0..1, varying over a few tens of metres. */
const patch = (x, z, k, lo = 0.0, hi = 0.4, f = 0.02) => smooth(lo, hi, fbm(x * f + k, z * f - k));

/**
 * Densities by district. Each function receives the place: { x, z, h (ground height),
 * ny (normal y), g (ground cover), w (distance from a pond's edge) } and returns plants per 100 m².
 */
const RULES = {
  nile: {
    // date palms in groves and by the houses, doum palms, sycamore figs in the yards, tamarisks and
    // acacias on the dry ground, halfa grass
    date_palm: ({ x, z }) => 0.9 * patch(x, z, 1, -0.05, 0.3) + 0.05,
    doum_palm: ({ x, z }) => 0.08 * patch(x, z, 3, 0.1, 0.45),
    sycamore_fig: ({ x, z }) => 0.04 * patch(x, z, 5, 0.0, 0.4),
    acacia: ({ x, z, g }) => 0.05 * g.sand * patch(x, z, 7, 0.2, 0.55),
    tamarisk: ({ x, z, g }) => 0.08 * g.sand * patch(x, z, 9, 0.25, 0.6),
    halfa: ({ g, ny }) => 0.25 * g.sand * ny,
    boulder: ({ ny, g }) => (ny < 0.9 ? 0.3 * g.rock : 0),
  },
  rome: {
    // stone pines and cypresses in the gardens, holm oaks, oleanders by the walls
    stone_pine: ({ x, z }) => 0.1 * patch(x, z, 1, -0.1, 0.35),
    cypress: ({ x, z }) => 0.04 * patch(x, z, 2, 0.15, 0.45, 0.03),
    holm_oak: ({ x, z }) => 0.04 * patch(x, z, 4, 0.1, 0.5),
    oleander: ({ x, z }) => 0.08 * patch(x, z, 6, 0.1, 0.5, 0.04),
    grass: ({ g }) => 70 * g.grass,
    boulder: ({ ny, g }) => (ny < 0.85 ? 0.3 * g.rock : 0),
  },
  greece: {
    // olives in rows on the level ground, Aleppo pines and maquis on the rock's slopes, cypresses
    olive: ({ x, z, ny }) => (ny > 0.9 ? 0.5 * patch(x, z, 7, -0.15, 0.2, 0.012) : 0),
    aleppo_pine: ({ x, z, ny }) => (ny > 0.55 ? 0.04 * patch(x, z, 1, 0.1, 0.5) + 0.05 * smooth(0.95, 0.75, ny) : 0),
    cypress: ({ x, z }) => 0.02 * patch(x, z, 4, 0.25, 0.55, 0.03),
    maquis: ({ ny, g }) => (ny > 0.5 ? 0.9 * (g.grass + g.rock * 0.6) : 0),
    grass_dry: ({ g }) => 45 * g.grass,
    boulder: ({ ny, g }) => 0.25 * g.rock + (ny < 0.8 ? 0.4 : 0),
  },
  byzantium: {
    // cypresses in groups by the churches, plane trees in the squares, figs and stone pines on the
    // slopes of the first hill, oleanders
    cypress: ({ x, z }) => 0.06 * patch(x, z, 8, 0.15, 0.45, 0.03),
    plane_tree: ({ x, z }) => 0.04 * patch(x, z, 2, 0.05, 0.45),
    fig: ({ x, z }) => 0.05 * patch(x, z, 1, 0.0, 0.4, 0.04),
    stone_pine: ({ x, z, ny }) => (ny > 0.75 ? 0.05 * patch(x, z, 6, -0.1, 0.35) : 0),
    oleander: ({ x, z }) => 0.04 * patch(x, z, 4, 0.2, 0.5, 0.04),
    grass: ({ g }) => 80 * g.grass,
    boulder: ({ ny, g }) => (ny < 0.85 ? 0.25 * g.rock : 0),
  },
  levant: {
    // olive groves on the slopes of Moriah, cypresses, carobs, garrigue, dry grass
    olive: ({ x, z, ny }) => (ny > 0.8 ? 0.4 * patch(x, z, 2, -0.2, 0.15, 0.012) : 0),
    cypress: ({ x, z }) => 0.03 * patch(x, z, 9, 0.2, 0.5, 0.03),
    aleppo_pine: ({ x, z, ny }) => (ny > 0.6 ? 0.03 * patch(x, z, 3, 0.3, 0.6) : 0),
    carob: ({ x, z, ny }) => (ny > 0.7 ? 0.04 * patch(x, z, 7, 0.1, 0.5) : 0),
    maquis: ({ ny, g }) => (ny > 0.5 ? 0.6 * (g.grass + g.rock * 0.5) : 0),
    grass_dry: ({ g }) => 40 * g.grass,
    boulder: ({ ny, g }) => 0.35 * g.rock + (ny < 0.8 ? 0.3 : 0),
  },
  francia: {
    // elms and oaks in the closes, apple orchards, poplars and willows, lush grass
    oak: ({ x, z }) => 0.04 * patch(x, z, 4, 0.0, 0.4),
    elm: ({ x, z }) => 0.04 * patch(x, z, 6, 0.1, 0.45),
    poplar: ({ x, z }) => 0.05 * patch(x, z, 2, 0.2, 0.5, 0.03),
    willow: ({ x, z }) => 0.03 * patch(x, z, 8, 0.3, 0.6),
    apple: ({ x, z, ny }) => (ny > 0.9 ? 0.3 * patch(x, z, 9, 0.15, 0.45, 0.012) : 0),
    grass: ({ g }) => 80 * g.grass,
  },
  tang: {
    // Chinese pines and arborvitae round the monastery and on the hill behind it, elms and poplars
    // by the courtyard houses, jujubes in the yards, dry grass on the loess
    chinese_pine: ({ x, z, h }) => 0.06 * smooth(3, 14, h) + 0.02 * patch(x, z, 1, 0.2, 0.5),
    arborvitae: ({ x, z }) => 0.03 * patch(x, z, 5, 0.2, 0.5, 0.03),
    elm: ({ x, z }) => 0.03 * patch(x, z, 3, 0.0, 0.4),
    poplar: ({ x, z }) => 0.05 * patch(x, z, 8, 0.15, 0.45, 0.03),
    jujube: ({ x, z }) => 0.04 * patch(x, z, 6, 0.1, 0.4),
    maquis: ({ ny, g }) => (ny > 0.5 ? 0.3 * (g.grass + g.rock * 0.5) : 0),
    grass_dry: ({ g }) => 45 * g.grass,
    boulder: ({ g }) => 0.3 * g.rock,
  },
  heian: {
    // red pines by the pond and the houses, maples, bamboo groves at the quarter's edge, willows
    // and reeds at the water, cryptomerias, moss-green grass
    red_pine: ({ x, z }) => 0.05 * patch(x, z, 2, 0.1, 0.45),
    sugi: ({ x, z }) => 0.03 * patch(x, z, 8, 0.3, 0.6, 0.015),
    maple: ({ x, z }) => 0.05 * patch(x, z, 6, 0.05, 0.45),
    bamboo: ({ x, z }) => 0.5 * patch(x, z, 3, 0.32, 0.55, 0.03),
    willow: ({ w }) => (w > 1 && w < 14 ? 0.12 : 0),
    reeds: ({ w }) => (w > -3 && w < 4 ? 2.2 : 0),
    grass: ({ g }) => 80 * g.grass,
    boulder: ({ ny, g }) => (ny < 0.85 ? 0.2 * g.rock : 0),
  },
  india: {
    // teak and neem on the hill of Sanchi, a few great banyans by the lanes, palmyra palms, acacias
    // and scrub, dry grass
    teak: ({ x, z, h, ny }) => (ny > 0.6 ? 0.05 * smooth(4, 18, h) + 0.02 * patch(x, z, 3, 0.1, 0.5) : 0),
    neem: ({ x, z }) => 0.03 * patch(x, z, 7, 0.0, 0.45),
    banyan: ({ x, z, h }) => (h < 6 ? 0.012 * patch(x, z, 1, 0.3, 0.6, 0.012) : 0),
    date_palm: ({ x, z }) => 0.1 * patch(x, z, 4, 0.2, 0.5),
    acacia: ({ x, z, g }) => 0.03 * g.grass * patch(x, z, 9, 0.2, 0.6),
    maquis: ({ ny, g }) => (ny > 0.5 ? 0.35 * (g.grass + g.rock * 0.5) : 0),
    grass_dry: ({ g }) => 45 * g.grass,
    boulder: ({ ny, g }) => 0.3 * g.rock + (ny < 0.8 ? 0.2 : 0),
  },
  rouergue: {
    // the slopes of Conques: oaks (and chestnuts, shown as oaks until they have their own form),
    // walnuts and elms by the houses, apple trees in the terraced gardens, poplars low down,
    // broom and box (as scrub) on the schist, green grass
    oak: ({ x, z, h }) => 0.04 * patch(x, z, 3, 0.0, 0.4) + 0.04 * smooth(3, 12, h),
    elm: ({ x, z }) => 0.03 * patch(x, z, 7, 0.1, 0.45),
    apple: ({ x, z, ny }) => (ny > 0.88 ? 0.25 * patch(x, z, 5, 0.15, 0.45, 0.012) : 0),
    poplar: ({ x, z }) => 0.03 * patch(x, z, 9, 0.25, 0.55, 0.03),
    maquis: ({ ny, g }) => (ny > 0.5 ? 0.5 * (g.grass * 0.4 + g.rock) : 0),
    grass: ({ g }) => 80 * g.grass,
    boulder: ({ ny, g }) => (ny < 0.9 ? 0.3 * g.rock : 0),
  },
};

/** Species that grow in rows (orchards), with their spacing in metres. */
export const ROWS = { olive: 9, apple: 8 };

/** All the species and densities at a place, blended across the districts' borders. */
export function densities(x, z, place) {
  if (inSite(x, z) || inClear(x, z) || nearRoad(x, z) || inSquare(x, z)) return null;
  // in a built block only grass grows between the houses
  if (inQuarter(x, z)) { const g = (place.g?.grass || 0) * 40; return g > 0 ? { grass: g } : null; }
  const W = regionWeights(x, z), out = {};
  // the garden blocks are planted thick: groves, orchards, a garden's trees (to the species' limit)
  const k = inGarden(x, z) ? 4 : 1;
  REGIONS.forEach((r, i) => {
    if (W[i] < 0.02) return;
    for (const [sp, f] of Object.entries(RULES[r.id] || {})) out[sp] = (out[sp] || 0) + W[i] * Math.max(0, f(place)) * (NEAR_ONLY.has(sp) || sp === 'boulder' ? 1 : k);
  });
  if (k > 1) for (const sp in out) out[sp] = Math.min(out[sp], MAX_DENSITY[sp] ?? out[sp]);
  return out;
}

/** The largest density each species can reach (for rejection sampling). */
export const MAX_DENSITY = { date_palm: 1.2, doum_palm: 0.15, sycamore_fig: 0.06, acacia: 0.08, tamarisk: 0.16, papyrus: 2.2, reeds: 3, halfa: 0.25, boulder: 0.7,
  stone_pine: 0.17, cypress: 0.05, holm_oak: 0.14, oleander: 0.21, grass: 80, olive: 0.55, aleppo_pine: 0.08, maquis: 0.9, grass_dry: 45, plane_tree: 0.06, fig: 0.08, carob: 0.04, oak: 0.06, elm: 0.03, poplar: 0.13, willow: 0.18, apple: 0.32, chinese_pine: 0.08, arborvitae: 0.02, jujube: 0.07, red_pine: 0.07, sugi: 0.04, maple: 0.05, bamboo: 0.5, teak: 0.07, neem: 0.03, banyan: 0.016 };

/** Small plants scattered only near the viewer. */
export const NEAR_ONLY = new Set(['grass', 'grass_dry']);
