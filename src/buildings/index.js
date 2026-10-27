// Registry of buildings in the world. Each entry loads its plan (and style) on demand.
// `origin` and footprint come from the plan; this list only says which buildings exist.

export const BUILDINGS = [
  { id: 'edfu', district: 'nile', load: () => import('./edfu/index.js') },
  { id: 'pantheon', district: 'rome', load: () => import('./pantheon/index.js') },
  { id: 'parthenon', district: 'greece', load: () => import('./parthenon/index.js') },
  { id: 'hagia-sophia', district: 'byzantium', load: () => import('./hagia-sophia/index.js') },
  { id: 'dome-of-the-rock', district: 'levant', load: () => import('./dome-of-the-rock/index.js') },
  { id: 'sainte-chapelle', district: 'francia', load: () => import('./sainte-chapelle/index.js') },
];
