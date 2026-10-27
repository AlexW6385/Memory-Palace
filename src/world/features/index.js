// Features of the regions that are not buildings with a dossier of their own: towns, porticoes,
// walls. Each builds as a plan (style + elements) and loads like a building when near.
export const FEATURES = [
  { id: 'edfu-town', region: 'nile', load: async () => { await import('../../styles/vernacular/index.js'); return { plan: (await import('./edfu-town.js')).plan() }; } },
  { id: 'constantinople-town', region: 'byzantium', load: async () => { await import('../../styles/vernacular/index.js'); return { plan: (await import('./towns.js')).plan('constantinople', 'house_tiled', 562) }; } },
  { id: 'jerusalem-town', region: 'levant', load: async () => { await import('../../styles/vernacular/index.js'); return { plan: (await import('./towns.js')).plan('jerusalem', 'house_domed', 691) }; } },
  { id: 'paris-town', region: 'francia', load: async () => { await import('../../styles/vernacular/index.js'); return { plan: (await import('./towns.js')).plan('paris', 'house_timber', 1248) }; } },
  { id: 'tang-village-town', region: 'tang', load: async () => { await import('../../styles/vernacular/index.js'); return { plan: (await import('./towns.js')).plan('tang-village', 'house_china', 857) }; } },
  { id: 'uji-town', region: 'heian', load: async () => { await import('../../styles/vernacular/index.js'); return { plan: (await import('./towns.js')).plan('uji', 'house_japan', 1053) }; } },
  { id: 'sanchi-village-town', region: 'india', load: async () => { await import('../../styles/vernacular/index.js'); return { plan: (await import('./towns.js')).plan('sanchi-village', 'house_india', 50) }; } },
];
