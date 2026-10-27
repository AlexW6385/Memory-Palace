// Features of the regions that are not buildings with a dossier of their own: towns, porticoes,
// walls. Each builds as a plan (style + elements) and loads like a building when near.
export const FEATURES = [
  { id: 'edfu-town', region: 'nile', load: async () => { await import('../../styles/vernacular/index.js'); return { plan: (await import('./edfu-town.js')).plan() }; } },
  { id: 'constantinople-town', region: 'byzantium', load: async () => { await import('../../styles/vernacular/index.js'); return { plan: (await import('./byzantium-town.js')).plan() }; } },
];
