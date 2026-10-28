// Features of the city that are not buildings with a dossier of their own: the districts' quarters
// of houses (src/world/city.js). Each builds as a plan (style + elements) and loads like a building
// when near; its plan is made only then.
import { REGIONS } from '../regions.js';

/** The ground each district's quarter may cover: the district's share of the city, generously. */
const QUARTER_BOUNDS = {
  nile: [-120, -130, 165, 145], rome: [-120, -370, 165, -95], greece: [-360, -130, -115, 315],
  byzantium: [120, -370, 640, -95], levant: [120, -130, 640, 215], francia: [-365, -370, -115, -95],
  tang: [75, 140, 365, 460], heian: [360, 40, 640, 460], india: [-360, 140, 125, 460],
  rouergue: [-605, -370, -355, -90],
};

export const FEATURES = REGIONS.map((r) => ({
  id: `${r.id}-quarter`, region: r.id, bounds: QUARTER_BOUNDS[r.id],
  load: async () => { await import('../../styles/vernacular/index.js'); const city = await import('../city.js'); const plan = city.plan(r.id); return { plan }; },
}));
