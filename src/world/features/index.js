// Features of the regions that are not buildings with a dossier of their own: towns, porticoes,
// walls. Each builds as a plan (style + elements) and loads like a building when near.
import { BRIDGES, WORLD, TOWNS } from '../regions.js';

/** The ground a town covers (its plan is made only when the visitor comes near). */
function townBounds(id) {
  const rs = TOWNS.find((t) => t.id === id).rects;
  return [Math.min(...rs.map((r) => r[0])), Math.min(...rs.map((r) => r[1])), Math.max(...rs.map((r) => r[2])), Math.max(...rs.map((r) => r[3]))];
}

/** A bridge where a road crosses a river (BRIDGES in regions.js). */
function bridgePlan(b) {
  const [x0, z0, x1, z1] = b.rect;
  return { id: `bridge-${b.road}`, feature: true, style: 'vernacular', origin: [0, 0], yaw: 0, base: 0, bounds: [x0 - 14, z0 - 2, x1 + 14, z1 + 2], rooms: [],
    elements: [{ t: 'bridge_stone', rect: b.rect, y: b.y, ramps: b.ramps, bed: -WORLD.river.depth - 0.5 }] };
}

export const FEATURES = [
  ...BRIDGES.map((b) => ({ id: `bridge-${b.road}`, bounds: bridgePlan(b).bounds, load: async () => { await import('../../styles/vernacular/index.js'); return { plan: bridgePlan(b) }; } })),
  { id: 'edfu-town', region: 'nile', bounds: [-240, -245, 100, 125], load: async () => { await import('../../styles/vernacular/index.js'); return { plan: (await import('./edfu-town.js')).plan() }; } },
  { id: 'constantinople-town', region: 'byzantium', bounds: townBounds('constantinople'), load: async () => { await import('../../styles/vernacular/index.js'); return { plan: (await import('./towns.js')).plan('constantinople', 'house_tiled', 562) }; } },
  { id: 'jerusalem-town', region: 'levant', bounds: townBounds('jerusalem'), load: async () => { await import('../../styles/vernacular/index.js'); return { plan: (await import('./towns.js')).plan('jerusalem', 'house_domed', 691) }; } },
  { id: 'paris-town', region: 'francia', bounds: townBounds('paris'), load: async () => { await import('../../styles/vernacular/index.js'); return { plan: (await import('./towns.js')).plan('paris', 'house_timber', 1248) }; } },
  { id: 'tang-village-town', region: 'tang', bounds: townBounds('tang-village'), load: async () => { await import('../../styles/vernacular/index.js'); return { plan: (await import('./towns.js')).plan('tang-village', 'house_china', 857) }; } },
  { id: 'uji-town', region: 'heian', bounds: townBounds('uji'), load: async () => { await import('../../styles/vernacular/index.js'); return { plan: (await import('./towns.js')).plan('uji', 'house_japan', 1053) }; } },
  { id: 'sanchi-village-town', region: 'india', bounds: townBounds('sanchi-village'), load: async () => { await import('../../styles/vernacular/index.js'); return { plan: (await import('./towns.js')).plan('sanchi-village', 'house_india', 50) }; } },
];
