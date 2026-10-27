// The Pantheon — plan data from docs/buildings/pantheon.md (§4). Local coordinates: +x east,
// +z south, origin at the centre of the rotunda, y = 0 at the forecourt paving; the portico
// faces north (−z). Metres, true scale.

import { SITES } from '../../world/layout.js';

const E = [];
const add = (o) => (E.push(o), o);
const block = (rect, y0, y1, extra = {}) => add({ t: 'block', rect, y0, y1, mat: 'marble', ...extra });
const column = (x, z, y, h, d, extra = {}) => add({ t: 'column', at: [x, z], y, h, d, mat: 'marble', ...extra });
const obj = (kind, x, z, y, extra = {}) => add({ t: 'obj', kind, at: [x, z], y, ...extra });

const F = 1.3;                                  // floor of portico and rotunda: seven steps above the forecourt
const R = 21.65, WALL = 6.2, RO = R + WALL;     // rotunda: 43.3 m inside, the drum 6.2 m thick
const SPRING = F + 21.7;                        // the dome springs at half the height
const CORNICE1 = F + 12.7;                      // the first interior cornice

// ── forecourt, steps, floors ──────────────────────────────────────────────────
add({ t: 'floor', rect: [-40, -110, 40, -51.2], y: 0, mat: 'travertine' });
add({ t: 'stair', rect: [-17.1, -51.2, 17.1, -49.1], dir: 's', y0: 0, y1: F, riser: 0.186, mat: 'marble' });
add({ t: 'floor', rect: [-17.1, -49.1, 17.1, -20], y: F, mat: 'marble_floor', th: F + 0.3 });
add({ t: 'floor', rect: [-R - 5.2, -R - 1.0, R + 5.2, R + 5.6], y: F, mat: 'opus_sectile', th: F + 0.3 });

// ── the rotunda: drum with the entrance, seven niches; the first-order entablature ─
const NICHES = [
  { b: 45, kind: 'rect', w: 9.0, top: CORNICE1 - 2.2 }, { b: 90, kind: 'semi', w: 9.6, top: CORNICE1 - 2.2 },
  { b: 135, kind: 'rect', w: 9.0, top: CORNICE1 - 2.2 }, { b: 180, kind: 'semi', w: 10.0, top: F + 17.5, apse: true },
  { b: 225, kind: 'rect', w: 9.0, top: CORNICE1 - 2.2 }, { b: 270, kind: 'semi', w: 9.6, top: CORNICE1 - 2.2 },
  { b: 315, kind: 'rect', w: 9.0, top: CORNICE1 - 2.2 },
];
const gaps = [{ a: 0, w: 7.6, y1: F + 12.2 }, ...NICHES.map((n) => ({ a: n.b, w: n.w, y1: n.top }))];
add({ t: 'ring_wall', c: [0, 0], r0: R, r1: RO, y0: 0, y1: F + 30.4, gaps, mat: 'revetment' });
for (const n of NICHES) {
  add({ t: 'niche', c: [0, 0], R, bearing: n.b, kind: n.kind, w: n.w, d: n.kind === 'semi' ? n.w / 2 : 4.0, y0: F, y1: n.top, mat: 'revetment' });
  // two fluted columns in the mouth (giallo antico in the apse, alternating elsewhere)
  if (n.apse) continue;
  const a = (n.b - 90) * Math.PI / 180, ux = Math.cos(a), uz = Math.sin(a), tx = -uz, tz = ux;
  for (const s of [-1, 1]) {
    const o = s * n.w * 0.26, r = R + 0.4;
    column(ux * r + tx * o, uz * r + tz * o, F, CORNICE1 - F - 2.2, 1.05, { fluted: true, shaftMat: n.b % 90 === 0 ? 'giallo' : 'pavonazzetto' });
  }
}
// the apse: two giallo antico columns either side of its mouth, under the great arch
for (const s of [-1, 1]) column(s * 4.3, R + 0.5, F, CORNICE1 - F - 2.2, 1.05, { fluted: true, shaftMat: 'giallo' });
// first-order entablature: a ring carried across the niche mouths, broken at the entrance and the apse
add({ t: 'ring_wall', c: [0, 0], r0: R - 0.55, r1: R + 0.2, y0: CORNICE1 - 2.2, y1: CORNICE1, gaps: [{ a: 0, w: 7.6 }, { a: 180, w: 10 }], mat: 'pavonazzetto' });
add({ t: 'ring_wall', c: [0, 0], r0: R - 0.85, r1: R - 0.5, y0: CORNICE1 - 0.35, y1: CORNICE1, gaps: [{ a: 0, w: 7.6 }, { a: 180, w: 10 }], mat: 'marble' });
// the attic: a marble band, then the second cornice at the springing of the dome
add({ t: 'ring_wall', c: [0, 0], r0: R - 0.4, r1: R + 0.1, y0: SPRING - 0.5, y1: SPRING, gaps: [], mat: 'marble' });
// aediculae between the niches: podium, two small porphyry columns, pediment block
for (let k = 0; k < 8; k++) {
  const b = 22.5 + k * 45, a = (b - 90) * Math.PI / 180, ux = Math.cos(a), uz = Math.sin(a), tx = -uz, tz = ux;
  const r = R - 0.9;
  const c = [ux * r, uz * r];
  const P = (s, o) => [c[0] + tx * s + ux * o, c[1] + tz * s + uz * o];
  const pts = [P(-1.9, -0.9), P(1.9, -0.9), P(1.9, 0.95), P(-1.9, 0.95)];
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  block([Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)], F, F + 1.5, { mat: 'giallo' });
  for (const s of [-1, 1]) { const p = P(s * 1.45, -0.55); column(p[0], p[1], F + 1.5, 4.6, 0.5, { shaftMat: 'porphyry' }); }
  block([Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)], F + 6.1, F + 7.3, { mat: 'marble', collide: false });
}

// ── the dome ──────────────────────────────────────────────────────────────────
add({
  t: 'coffered_dome', c: [0, 0], y: SPRING, R, thick: WALL - 0.3, top: 1.45, oculus: 4.45,
  rings: [[7, 17.5], [17.5, 28], [28, 38], [38, 47.5], [47.5, 56.5]], n: 28, step: 0.24,
  outSteps: [[8.7, RO - 0.95], [9.6, RO - 1.9], [10.5, RO - 2.85], [11.4, RO - 3.8], [12.3, RO - 4.75], [13.2, RO - 5.7], [14.1, RO - 6.65]],
  mat: 'dome_stucco', outMat: 'gilt_bronze', stepMat: 'stucco',
});
// exterior cornices dividing the drum into its three zones
for (const y of [F + 10.6, F + 21.0, F + 30.4]) add({ t: 'ring_wall', c: [0, 0], r0: RO - 0.2, r1: RO + 0.55, y0: y - 0.7, y1: y, gaps: [{ a: 0, w: 30 }], mat: 'marble' });

// ── intermediate block and the bronze doors ──────────────────────────────────
const BZ0 = -33.5, BZ1 = -22.5;
block([-17.1, BZ0, -3.8, BZ1], 0, F + 24.5, { mat: 'stucco' });
block([3.8, BZ0, 17.1, BZ1], 0, F + 24.5, { mat: 'stucco' });
block([-3.8, BZ0, 3.8, BZ1], F + 12.2, F + 24.5, { mat: 'stucco' });
// the passage narrows to the doorway (4.45 × 7.53) with a bronze grille in the transom above
block([-3.8, -26.6, -2.225, -25.4], F, F + 12.2, { mat: 'marble' });
block([2.225, -26.6, 3.8, -25.4], F, F + 12.2, { mat: 'marble' });
block([-2.225, -26.4, 2.225, -25.6], F + 7.53, F + 12.2, { mat: 'bronze', collide: false });
obj('doors', 0, -25.4, F, { yaw: 0, w: 4.45, h: 7.53, th: 0.18, depth: 0 });
// the second, higher pediment on the block
add({ t: 'pediment_roof_z', rect: [-17.1, BZ0, 17.1, BZ1], y: F + 24.5, rise: 7.0, tympanumInset: 0.6, rakingGeison: 0.7, mat: 'marble', tileMat: 'gilt_bronze' });

// ── the portico: 16 granite columns in three aisles under the pediment ────────
const CH = 14.15, CD = 1.5;
const FX = [-15.47, -11.05, -6.63, -2.21, 2.21, 6.63, 11.05, 15.47];
const FZ = -47.6;
for (const x of FX) column(x, FZ, F, CH, CD, { shaftMat: 'granite_grey' });
for (const x of [-11.05, -6.63, 6.63, 11.05]) for (const z of [-42.6, -37.7]) column(x, z, F, CH, CD, { shaftMat: 'granite_red' });
const ET = F + CH, EH = 3.5;
add({ t: 'roman_entablature', a: [-17.1, FZ], b: [17.1, FZ], y: ET, w: 1.7, h: EH, mat: 'marble' });
for (const x of [-15.47, 15.47]) add({ t: 'roman_entablature', a: [x, FZ - 0.85], b: [x, BZ0], y: ET, w: 1.7, h: EH, mat: 'marble' });
for (const x of [-11.05, -6.63, 6.63, 11.05]) add({ t: 'beam', a: [x, FZ], b: [x, BZ0], y: ET, w: 1.5, h: 1.6, mat: 'marble' });
// walls closing the side aisles, with the apsidal statue niches of Augustus and Agrippa
for (const s of [-1, 1]) {
  add({ t: 'wall', a: [s * 8.8, -34.0], b: [s * 8.8, -36.2], th: 0.9, y0: F, y1: ET, openings: [], mat: 'marble' });
  add({ t: 'niche', c: [s * 8.85, -33.5 - 3.0], R: 3.0, bearing: 180, kind: 'semi', w: 3.4, d: 1.7, y0: F + 0.8, y1: F + 7.0, mat: 'marble' });
}
add({ t: 'pediment_roof_z', rect: [-17.1, FZ - 1.6, 17.1, BZ0], y: ET + EH, rise: 7.6, tympanumInset: 0.85, rakingGeison: 0.7, mat: 'marble', tileMat: 'gilt_bronze' });

// ── rooms and walks ───────────────────────────────────────────────────────────
const room = (id, rect, y, kind) => ({ id, rect, y, kind });
const rooms = [
  room('forecourt', [-38, -108, 38, -54], 0, 'open'),
  room('portico', [-16.5, -47, 16.5, -34.5], F, 'open'),
  room('rotunda', [-15, -15, 15, 15], F, 'hall'),
  room('apse', [-4, 22.5, 4, 25.5], F, 'hall'),
  room('niche-east', [22.5, -3, 25.5, 3], F, 'hall'),
  room('niche-west', [-25.5, -3, -22.5, 3], F, 'hall'),
];
const walks = [
  [[0, -95], [0, -52], [0, -48.5], [0, -36], [0, -27.5], [0, -24.5], [0, -18], [0, 0], [16, 0], [23.5, 0], [16, 0], [0, 16], [0, 23.5], [0, 16], [-16, 0], [-23.5, 0], [-16, 0], [0, 0]],
  [[0, -40.5], [-8.8, -40.5], [-8.8, -37.2], [-8.8, -40.5], [-13.3, -40.5], [-13.3, -36.2], [-16.3, -40.0]],
];
walks.forEach((w, i) => { w.y0 = [0, F][i]; });

export const pantheon = {
  id: 'pantheon',
  name: { en: 'The Pantheon, Rome', zh: '罗马万神殿' },
  era: { en: 'Imperial Rome, c. AD 114–128', zh: '罗马帝国，约公元114—128年' },
  style: 'roman',
  district: 'rome',
  ...SITES.pantheon,
  entrance: { at: [0, -100], facing: 's' },
  bounds: [-42, -112, 42, 32],
  bakeBounds: [-42, -60, 42, 32],
  bakeTop: 48,
  bakeSpacing: 1.5,
  elements: E,
  rooms,
  walks,
};

export default pantheon;
