// Where plants grow in each region: densities (plants per 100 m²) as functions of the place.
// Pure; the viewer scatters from these deterministically, cell by cell. The reasoning for each
// region's planting is in its building's dossier (§10, surroundings) and docs/world.md.

import { REGIONS, regionWeights, riverCenter, WORLD, SITES, fbm, nearRoad, inTown } from './regions.js';

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
  byzantium: {
    // gardens of the city: cypresses (in groups, by churches and tombs), plane trees by the
    // squares and the water, figs and vines, stone pines on the slopes, Judas trees omitted (L3)
    cypress: ({ x, z }) => 0.05 * smooth(0.15, 0.45, fbm(x * 0.012 + 8, z * 0.012)),
    plane_tree: ({ x, z, w }) => (w < 4 ? 0 : 0.03 * smooth(0.1, 0.5, fbm(x * 0.008 + 2, z * 0.008)) + (w < 60 ? 0.03 : 0)),
    fig: ({ x, z, g }) => 0.05 * smooth(0.0, 0.4, fbm(x * 0.02 + 1, z * 0.02)) + 0.03 * g.fields,
    stone_pine: ({ x, z, h, ny }) => (ny > 0.75 ? 0.05 * smooth(-0.1, 0.35, fbm(x * 0.006 + 6, z * 0.006)) + (h > 15 ? 0.03 : 0) : 0),
    olive: ({ x, z, h, ny }) => (ny > 0.85 && h < 18 ? 0.12 * smooth(0.1, 0.4, fbm(x * 0.005 + 3, z * 0.005)) : 0),
    holm_oak: ({ h, ny }) => (ny > 0.7 ? 0.05 * smooth(10, 30, h) : 0),
    oleander: ({ x, z }) => 0.04 * smooth(0.2, 0.5, fbm(x * 0.02 + 4, z * 0.02)),
    reeds: ({ w }) => (w > -4 && w < 7 ? 2.2 : 0),
    grass: ({ g }) => 80 * g.grass,
    boulder: ({ ny, g }) => (ny < 0.85 ? 0.25 * g.rock : 0),
  },
  tang: {
    // Chinese pines and arborvitae on the hills and round the monastery, elms and poplars in the
    // valley and by the villages, jujubes by the fields, dry grass on the loess
    chinese_pine: ({ x, z, h, ny }) => (ny > 0.6 ? 0.06 * smooth(15, 45, h) + 0.02 * smooth(0.2, 0.5, fbm(x * 0.01 + 1, z * 0.01)) : 0),
    arborvitae: ({ x, z }) => 0.02 * smooth(0.2, 0.5, fbm(x * 0.012 + 5, z * 0.012)),
    elm: ({ h, x, z }) => (h < 25 ? 0.025 * smooth(0.0, 0.4, fbm(x * 0.008 + 3, z * 0.008)) : 0),
    poplar: ({ w, x, z, h }) => (w > 3 && h < 15 ? 0.05 * smooth(0.1, 0.4, fbm(x * 0.015 + 8, z * 0.015)) + (w < 50 ? 0.08 : 0) : 0),
    jujube: ({ g }) => 0.05 * g.fields + 0.01,
    maquis: ({ ny, g }) => (ny > 0.5 ? 0.3 * (g.grass + g.rock * 0.5) : 0),
    grass_dry: ({ g }) => 45 * g.grass,
    boulder: ({ ny, g }) => 0.3 * g.rock,
  },
  heian: {
    // Japanese red pines on the hills and by the water, cryptomerias in groves on the upper slopes,
    // maples in autumn colour on the lower slopes and by streams, bamboo groves near the houses and
    // at the foot of the hills, willows and reeds by the river, green grass and moss
    red_pine: ({ x, z, h, ny }) => (ny > 0.6 ? 0.045 * smooth(6, 35, h) + 0.02 * smooth(0.15, 0.5, fbm(x * 0.01 + 2, z * 0.01)) : 0),
    sugi: ({ x, z, h, ny }) => (ny > 0.6 ? 0.04 * smooth(18, 45, h) * smooth(0.0, 0.4, fbm(x * 0.007 + 8, z * 0.007)) : 0),
    maple: ({ x, z, h }) => (h < 45 ? 0.04 * smooth(0.05, 0.45, fbm(x * 0.01 + 6, z * 0.01)) * smooth(2, 10, h) + 0.01 : 0),
    bamboo: ({ x, z, h, ny }) => (ny > 0.7 && h < 30 ? 0.5 * smooth(0.32, 0.55, fbm(x * 0.012 + 3, z * 0.012)) : 0),
    willow: ({ w }) => (w > 1 && w < 18 ? 0.1 : 0),
    reeds: ({ w }) => (w > -4 && w < 7 ? 2.2 : 0),
    grass: ({ g }) => 80 * g.grass,
    boulder: ({ ny, g }) => (ny < 0.85 ? 0.2 * g.rock : 0),
  },
  francia: {
    // oaks and elms in the hedgerows and woods, poplars and willows by the water, apple orchards,
    // lush grass
    oak: ({ x, z, ny }) => (ny > 0.75 ? 0.05 * smooth(0.0, 0.4, fbm(x * 0.006 + 4, z * 0.006)) : 0),
    elm: ({ x, z }) => 0.025 * smooth(0.1, 0.45, fbm(x * 0.009 + 6, z * 0.009)),
    poplar: ({ w, x, z }) => (w > 3 && w < 60 ? 0.12 * smooth(-0.1, 0.3, fbm(x * 0.02 + 2, z * 0.02)) : 0),
    willow: ({ w }) => (w > 1 && w < 22 ? 0.18 : 0),
    apple: ({ x, z, h, ny }) => (ny > 0.85 && h < 30 ? 0.3 * smooth(0.15, 0.45, fbm(x * 0.006 + 9, z * 0.006)) : 0),
    reeds: ({ w }) => (w > -4 && w < 6 ? 1.6 : 0),
    grass: ({ g }) => 80 * g.grass,
  },
  levant: {
    // olive groves on terraces, cypresses and Aleppo pines, carobs, low garrigue, dry grass
    olive: ({ x, z, h, ny }) => (ny > 0.8 && h < 50 ? 0.45 * smooth(-0.2, 0.15, fbm(x * 0.005 + 2, z * 0.005)) : 0),
    cypress: ({ x, z }) => 0.025 * smooth(0.2, 0.5, fbm(x * 0.012 + 9, z * 0.012)),
    aleppo_pine: ({ x, z, h, ny }) => (ny > 0.6 ? 0.05 * smooth(25, 60, h) + 0.015 * smooth(0.3, 0.6, fbm(x * 0.01 + 3, z * 0.01)) : 0),
    carob: ({ x, z, ny }) => (ny > 0.7 ? 0.03 * smooth(0.1, 0.5, fbm(x * 0.008 + 7, z * 0.008)) : 0),
    maquis: ({ ny, g }) => (ny > 0.5 ? 0.6 * (g.grass + g.rock * 0.5) : 0),
    grass_dry: ({ g }) => 40 * g.grass,
    boulder: ({ ny, g }) => 0.35 * g.rock + (ny < 0.8 ? 0.3 : 0),
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
export const ROWS = { olive: 9, apple: 8 };

/** All the species and densities at a place, blended across region boundaries. */
export function densities(x, z, place) {
  if (inSite(x, z) || inClear(x, z) || nearRoad(x, z)) return null;
  const W = regionWeights(x, z), out = {};
  // in a town only grass grows between the houses
  if (inTown(x, z)) { const g = (place.g?.grass || 0) * 40; return g > 0 ? { grass: g } : null; }
  REGIONS.forEach((r, i) => {
    if (W[i] < 0.02) return;
    for (const [sp, f] of Object.entries(RULES[r.id] || {})) out[sp] = (out[sp] || 0) + W[i] * Math.max(0, f(place));
  });
  return out;
}

/** The largest density each species can reach (for rejection sampling). */
export const MAX_DENSITY = { date_palm: 1.2, doum_palm: 0.15, sycamore_fig: 0.06, acacia: 0.08, tamarisk: 0.16, papyrus: 2.2, reeds: 3, halfa: 0.25, boulder: 0.7,
  stone_pine: 0.17, cypress: 0.05, holm_oak: 0.14, oleander: 0.21, grass: 80, olive: 0.55, aleppo_pine: 0.08, maquis: 0.9, grass_dry: 45, plane_tree: 0.06, fig: 0.08, carob: 0.04, oak: 0.06, elm: 0.03, poplar: 0.13, willow: 0.18, apple: 0.32, chinese_pine: 0.08, arborvitae: 0.02, jujube: 0.07, red_pine: 0.07, sugi: 0.04, maple: 0.05, bamboo: 0.5 };

/** Small plants scattered only near the viewer. */
export const NEAR_ONLY = new Set(['grass', 'grass_dry']);
