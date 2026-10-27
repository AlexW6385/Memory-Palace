// The Great Stupa at Sanchi, as completed with its gateways in the 1st century CE — plan data
// from docs/buildings/sanchi-great-stupa.md (§4). Local coordinates: origin at the centre of the
// stupa, +x east, +z south; y = 0 at the hilltop. Metres.

import { SITES } from '../../world/regions.js';

const E = [];
const add = (o) => (E.push(o), o);
const obj = (kind, x, z, y, extra = {}) => add({ t: 'obj', kind, at: [x, z], y, ...extra });

// the Great Stupa (Stupa 1): dome, terrace and stairway, railings, four gateways
add({ t: 'stupa', c: [0, 0], s: 1, y: 0, gates: ['s', 'n', 'e', 'w'], stair: true });
// Stupa 3, north-east, smaller, with its one gateway on the south
add({ t: 'stupa', c: [62, -40], s: 0.42, y: 0, gates: ['s'], stair: true });
// Ashoka's pillar by the south gateway
obj('ashoka_pillar', -14, 33, 0);
// a monastery east of the stupa
obj('vihara', 0, 0, 0, { rect: [34, 2, 64, 32], door: 'w' });

const room = (id, rect, y, kind) => ({ id, rect, y, kind });
const rooms = [
  room('approach', [-6, 30, 6, 40], 0, 'open'),
  room('ground-walk', [-2, -21.5, 2, -19.5], 0, 'stupa'),
  room('terrace', [-1, -17.8, 1, -16.8], 4.3, 'stupa'),
  room('monastery', [44, 12, 54, 22], 0.02, 'open'),
];
const walks = [
  [[0, 44], [0, 31], [0, 26], [0, 22.2], [7.9, 21.4], [7.6, 19.1], [1.8, 19.1], [0, 18.8], [0, 17.4], [12.3, 12.3], [17.4, 0], [12.3, -12.3], [0, -17.4], [-12.3, -12.3], [-17.4, 0], [-12.3, 12.3], [0, 17.4], [0, 18.8], [-1.8, 19.1], [-7.6, 19.1], [-8.4, 21.0], [-14.6, 14.6], [-20.8, 0], [-14.6, -14.6], [0, -21], [0, -26], [0, -31], [30, -28], [62, -26], [62, -30.6], [62, -25], [30, -25], [30, 17], [36, 17], [41, 17], [48, 18.6]],
];
walks[0].y0 = 0;

export const sanchiGreatStupa = {
  id: 'sanchi-great-stupa',
  name: { en: 'The Great Stupa at Sanchi', zh: '桑吉大塔' },
  era: { en: 'Maurya to Satavahana, 3rd century BCE – 1st century CE', zh: '孔雀王朝至百乘王朝，公元前3世纪—公元1世纪' },
  style: 'indian',
  district: 'india',
  ...SITES['sanchi-great-stupa'],
  entrance: { at: [0, 44], facing: 'n' },
  bounds: [-70, -72, 92, 72],
  bakeBounds: [-32, -32, 32, 32],
  bakeTop: 24,
  bakeSpacing: 2.0,
  elements: E,
  rooms,
  walks,
};

export default sanchiGreatStupa;
