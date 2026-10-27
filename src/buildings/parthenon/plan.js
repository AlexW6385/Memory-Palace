// The Parthenon — plan data from docs/buildings/parthenon.md (§4 table and derived figures).
// Local coordinates: +x east, +z south, origin at the centre of the stylobate, y = 0 at the
// foot of the krepis (the rock of the Acropolis). Metres, true scale.

import { SITES } from '../../world/regions.js';

const E = [];
const add = (o) => (E.push(o), o);
const wall = (a, b, th, y0, y1, openings = [], extra = {}) => add({ t: 'wall', a, b, th, y0, y1, openings, mat: 'marble', ...extra });
const block = (rect, y0, y1, extra = {}) => add({ t: 'block', rect, y0, y1, mat: 'marble', ...extra });
const beam = (a, b, y, w, h) => add({ t: 'beam', a, b, y, w, h, mat: 'marble' });
const column = (x, z, y, h, d, extra = {}) => add({ t: 'column', at: [x, z], y, h, d, mat: 'marble_column', ...extra });
const obj = (kind, x, z, y, extra = {}) => add({ t: 'obj', kind, at: [x, z], y, ...extra });
const door = (at, w, h, y0, extra = {}) => ({ at, w, h, y0, ...extra });
const PI = Math.PI;

// ── krepis and stylobate ──────────────────────────────────────────────────────
const RISE = 0.52, ST = 3 * RISE;                          // stylobate top 1.56 m above the rock
const SB = [-34.75, -15.44, 34.75, 15.44];                // stylobate 69.50 × 30.88
add({ t: 'krepis', rect: SB, y0: 0, steps: 3, rise: RISE, tread: 0.7, mat: 'marble', cut: [[35, -2.6, 37.2, 2.6]] });
// intermediate steps cut into the krepis at the centre of the east front (inferred)
add({ t: 'stair', rect: [34.75, -2.4, 37.0, 2.4], dir: 'w', y0: 0, y1: ST, riser: 0.195, mat: 'marble', base: -0.3 });

// ── the peristyle: 8 × 17 Doric columns, corner intercolumniations contracted ─
const A = 4.294;
const X = [-33.75, ...Array.from({ length: 15 }, (_, k) => (k - 7) * A), 33.75];
const Z = [-14.42, -2.5 * A, -1.5 * A, -0.5 * A, 0.5 * A, 1.5 * A, 2.5 * A, 14.42];
const COL_H = 10.43, COL_D = 1.91;
for (const x of X) for (const z of [Z[0], Z[7]]) column(x, z, ST, COL_H, Math.abs(x) > 33 ? COL_D * 1.025 : COL_D);
for (const z of Z.slice(1, -1)) for (const x of [X[0], X[16]]) column(x, z, ST, COL_H, COL_D);

// ── the entablature, pediments and roof ───────────────────────────────────────
const ENT = ST + COL_H;                                    // top of the abaci, 11.99
const ARCH = 1.35, FRIEZE = 1.35, GEISON = 0.59, FACE = 0.86;
add({ t: 'doric_entablature', axes: { x: X, z: Z }, y: ENT, face: FACE, arch: ARCH, frieze: FRIEZE, geison: GEISON, tw: 0.855, overhang: 0.7, mat: 'marble' });
const TOP = ENT + ARCH + FRIEZE + GEISON;                  // 15.28 (13.72 above the stylobate)
const FRIEZE_TOP = ENT + ARCH + FRIEZE;                    // where the ceilings are
add({ t: 'pediment_roof', rect: [X[0] - FACE - 0.7, Z[0] - FACE - 0.7, X[16] + FACE + 0.7, Z[7] + FACE + 0.7], y: TOP, rise: 3.45, tympanumInset: 0.9, rakingGeison: 0.55, mat: 'marble' });

// marble coffered ceilings over the pteron, from the entablature to the cella walls
const CW = 10.85;                                          // outer face of the cella's long walls
for (const s of [-1, 1]) add({ t: 'coffers', rect: [X[0] + FACE, Math.min(s * (14.42 - FACE), s * CW), X[16] - FACE, Math.max(s * (14.42 - FACE), s * CW)], y: FRIEZE_TOP, depth: 0.3, cell: 0.95, beam: 0.22, mat: 'marble' });
for (const s of [-1, 1]) add({ t: 'coffers', rect: [Math.min(s * 23.45, s * (33.75 - FACE)), -CW, Math.max(s * 23.45, s * (33.75 - FACE)), CW], y: FRIEZE_TOP, depth: 0.3, cell: 0.95, beam: 0.22, mat: 'marble' });

// ── the cella on its two-step podium ──────────────────────────────────────────
const FL = ST + 0.7;                                       // floor of the porches and both rooms
block([-27.4, -11.6, 27.4, 11.6], ST - 0.2, ST + 0.35, { collide: false, walk: true, mat: 'marble' });
block([-27.0, -11.2, 27.0, 11.2], ST + 0.3, FL, { collide: false, walk: true, mat: 'marble' });
const WALL_TOP = FRIEZE_TOP;
const crown = { crown: 0.22, projection: 0.1 };
for (const s of [-1, 1]) wall([-24.6, s * 10.225], [24.6, s * 10.225], 1.25, ST, WALL_TOP, [], { trim: crown });
// east wall: the great door between two windows
wall([22.825, -9.6], [22.825, 9.6], 1.25, ST, WALL_TOP, [door(9.6, 4.9, 9.8, FL), door(3.6, 2.5, 3.0, FL + 3.4, { frameW: 0.35 }), door(15.6, 2.5, 3.0, FL + 3.4, { frameW: 0.35 })]);
// the cross wall: the two rooms do not communicate
wall([-8.2, -9.6], [-8.2, 9.6], 1.2, ST, WALL_TOP);
// west wall with the door of the treasury room
wall([-22.825, -9.6], [-22.825, 9.6], 1.25, ST, WALL_TOP, [door(9.6, 4.9, 9.8, FL)]);
// antae capitals at the wall ends
for (const sx of [-1, 1]) for (const sz of [-1, 1]) block([Math.min(sx * 24.6, sx * 24.0), sz * 10.225 - 0.72, Math.max(sx * 24.6, sx * 24.0) + (sx > 0 ? 0.08 : -0.08) * 0, sz * 10.225 + 0.72], ENT - 0.5, ENT, { collide: false });

// prostyle porches: six Doric columns each, an architrave, the Ionic frieze carried across
const PZ = [-9.9, -5.94, -1.98, 1.98, 5.94, 9.9];
for (const sx of [-1, 1]) {
  for (const z of PZ) column(sx * 26.05, z, FL, ENT - FL, 1.7);
  beam([sx * 26.05, -10.85], [sx * 26.05, 10.85], ENT, 1.55, ARCH);
  beam([sx * 26.05, -10.85], [sx * 26.05, 10.85], ENT + ARCH, 1.35, WALL_TOP - ENT - ARCH);
  // beams from the porch to the antae, carrying the porch ceiling
  for (const s of [-1, 1]) beam([sx * 24.6, s * 10.225], [sx * 26.05, s * 10.225], ENT, 1.25, WALL_TOP - ENT);
}

// ── the naos: the statue, the pool, the two-tier colonnade ────────────────────
const LOW_H = 6.4, LOW_D = 1.117, UP_H = 4.6, UP_D = 0.85, IENT = 1.219;
const IX = Array.from({ length: 10 }, (_, k) => -5.2 + k * 2.603);   // 10 on each side
const IZ = 7.2;
const ROWS = [];
for (const x of IX) for (const s of [-1, 1]) ROWS.push([x, s * IZ]);
for (const z of [-3.6, 0, 3.6]) ROWS.push([-5.2, z]);               // the back row (with the two corners: 5)
for (const [x, z] of ROWS) {
  column(x, z, FL, LOW_H, LOW_D);
  column(x, z, FL + LOW_H + IENT, UP_H, UP_D, { abacus: 1.15 });
}
// interior entablature between the tiers and the upper architrave under the ceiling
for (const s of [-1, 1]) {
  beam([-5.2, s * IZ], [IX[9] + 0.6, s * IZ], FL + LOW_H, 0.95, IENT);
  beam([-5.2, s * IZ], [IX[9] + 0.6, s * IZ], FL + LOW_H + IENT + UP_H, 0.75, WALL_TOP - (FL + LOW_H + IENT + UP_H));
}
beam([-5.2, -IZ], [-5.2, IZ], FL + LOW_H, 0.95, IENT);
beam([-5.2, -IZ], [-5.2, IZ], FL + LOW_H + IENT + UP_H, 0.75, WALL_TOP - (FL + LOW_H + IENT + UP_H));
// timber coffered ceiling over the naos and over the west room
add({ t: 'coffers', rect: [-7.6, -9.6, 22.2, 9.6], y: WALL_TOP, depth: 0.35, cell: 1.3, beam: 0.24, mat: 'cedar' });
add({ t: 'coffers', rect: [-22.2, -9.6, -8.8, 9.6], y: WALL_TOP, depth: 0.35, cell: 1.3, beam: 0.24, mat: 'cedar' });
// the Athena Parthenos facing the door, and the shallow pool of water before her
obj('athena_parthenos', -1.65, 0, FL, { yaw: PI / 2, pedestal: 1.2, pedestalMat: 'marble' });
obj('basin', 0, 0, FL, { rect: [1.0, -3.0, 7.0, 3.0], h: 0.16, curb: 0.3, mat: 'marble_dark' });
// the bronze-sheathed doors standing open
obj('doors', 22.2, 0, FL, { yaw: -PI / 2, w: 4.9, h: 9.8, th: 0.22, depth: 0 });
obj('doors', -22.2, 0, FL, { yaw: PI / 2, w: 4.9, h: 9.8, th: 0.22, depth: 0 });

// ── the west room: four Ionic columns ─────────────────────────────────────────
for (const x of [-18.2, -12.8]) for (const z of [-4.6, 4.6]) column(x, z, FL, WALL_TOP - FL - 0.35, 1.25, { order: 'ionic', yaw: 0 });
for (const z of [-4.6, 4.6]) beam([-22.2, z], [-8.8, z], WALL_TOP - 0.35, 1.0, 0.35);

// ── rooms and walks ───────────────────────────────────────────────────────────
const room = (id, rect, y, kind) => ({ id, rect, y, kind });
const rooms = [
  room('east-front', [37.5, -14, 44, 14], 0, 'open'),
  room('pteron-north', [-32, -13.4, 32, -11.9], ST, 'open'),
  room('pteron-south', [-32, 11.9, 32, 13.4], ST, 'open'),
  room('pteron-east', [27.8, -11, 32.5, 11], ST, 'open'),
  room('pteron-west', [-32.5, -11, -27.8, 11], ST, 'open'),
  room('pronaos', [23.6, -9.4, 25.0, 9.4], FL, 'open'),
  room('opisthodomos', [-25.0, -9.4, -23.6, 9.4], FL, 'open'),
  room('naos', [10, -6, 21.5, 6], FL, 'hall'),
  room('naos-aisles', [-7.2, -9.4, 21.5, -8.0], FL, 'hall'),
  room('west-room', [-21.8, -9.2, -9.2, 9.2], FL, 'inner'),
];

const walks = [
  // up the east steps, into the pronaos, through the door, around the statue
  [[44, 0], [36.4, 0], [33.5, 0], [30, 0], [25.4, 0], [21.5, 0], [12, 0], [8.5, -5.2], [8.5, -8.3], [-6.5, -8.3], [-6.5, 8.3], [8.5, 8.3], [12, 0], [21.5, 0], [30, 0]],
  // around the pteron to the west porch and into the treasury room
  [[30, 0], [30.5, -12.6], [-30.5, -12.6], [-30.5, 0], [-25.4, 0], [-21.5, 0], [-15.5, 0], [-15.5, -8.0], [-10, -8.0], [-10, 8.0], [-21, 8.0]],
];
walks.forEach((w, i) => { w.y0 = [0, ST][i]; });

export const parthenon = {
  id: 'parthenon',
  name: { en: 'The Parthenon, Athens', zh: '雅典帕特农神庙' },
  era: { en: 'Classical Greece, 447–432 BC', zh: '古典希腊，前447—前432年' },
  style: 'greek',
  district: 'greece',
  ...SITES.parthenon,
  entrance: { at: [46, 0], facing: 'w' },
  bounds: [-46, -26, 50, 26],
  bakeTop: 22,
  elements: E,
  rooms,
  walks,
};

export default parthenon;
