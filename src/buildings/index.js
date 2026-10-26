// Registry of buildings in the world. Each entry loads its plan (and style) on demand.
// `origin` and footprint come from the plan; this list only says which buildings exist.

export const BUILDINGS = [
  { id: 'edfu', district: 'nile', load: () => import('./edfu/index.js') },
];
