// The Phoenix Hall (Amida-dō) of Byōdō-in, Uji, as dedicated in 1053 — plan data from
// docs/buildings/byodo-in-phoenix-hall.md (§4). Local coordinates: origin at the centre of the
// central hall, +x east (the front: the hall faces east across the pond), +z south; y = 0 at the
// ground of the island. Metres.

import { SITES, PONDS } from '../../world/regions.js';

const E = [];
const add = (o) => (E.push(o), o);
const floor = (rect, y, mat, extra = {}) => add({ t: 'floor', rect, y, mat, ...extra });
const block = (rect, y0, y1, mat, extra = {}) => add({ t: 'block', rect, y0, y1, mat, ...extra });
const obj = (kind, x, z, y, extra = {}) => add({ t: 'obj', kind, at: [x, z], y, ...extra });
const col = (x, z, y, h, d, extra = {}) => add({ t: 'column', at: [x, z], y, h, d, ...extra });

const F = 1.1;                                  // the central hall's floor on its podium
const CX = [-3.9, 0, 3.9];                       // core column lines across (depth: 2 bays)
const CZ = [-5.4, -2.3, 2.3, 5.4];               // core column lines along (width: 3 bays)
const MX = [-5.62, -3.9, 0, 3.9, 5.62];          // the pent roof's posts, sides
const MZ = [-7.12, -5.4, -2.3, 2.3, 5.4, 7.12];  // the pent roof's posts, front and back
const CH = 5.4;                                  // core column height
const EAVE = F + 7.3;                            // the main roof's eave

// ── the island: gravel round the hall; the podium and its steps ─────────────
floor([-30, -36, 10, 36], 0.02, 'pebbles', { th: 0.2 });
block([-7.2, -8.7, 7.2, 8.7], 0, F, 'limestone', { walk: true });
floor([-7.2, -8.7, 7.2, 8.7], F, 'sandstone_floor', { th: 0.1 });
add({ t: 'stair', rect: [7.2, -2.3, 9.0, 2.3], dir: 'w', y0: 0.02, y1: F, riser: 0.18, base: 0, mat: 'limestone' });

// ── the central hall: the core's round columns, the pent roof's square posts ─
for (const x of CX) for (const z of CZ) if (Math.abs(x) > 1 || Math.abs(z) > 5) col(x, z, F, CH, 0.5);
for (const x of MX) for (const z of MZ) {
  const onRing = Math.abs(Math.abs(x) - 5.62) < 0.01 || Math.abs(Math.abs(z) - 7.12) < 0.01;
  if (onRing) col(x, z, F, 3.0, 0.3, { square: true });
}
// bracket sets on the core: three steps out (mitesaki), one on each column, the corners diagonal
const outward = (x, z) => {
  const ex = Math.abs(Math.abs(x) - 3.9) < 0.01, ez = Math.abs(Math.abs(z) - 5.4) < 0.01;
  if (ex && ez) return [Math.sign(x) / Math.SQRT2, Math.sign(z) / Math.SQRT2];
  return ex ? [Math.sign(x), 0] : [0, Math.sign(z)];
};
for (const x of CX) for (const z of CZ) if (Math.abs(x) > 1 || Math.abs(z) > 5) add({ t: 'bracket_set', at: [x, z], y: F + CH, dir: outward(x, z), tiers: 3, step: 0.5, mat: 'timber_ni', blockMat: 'timber_ni' });
// small sets on the pent roof's posts
for (const x of MX) for (const z of MZ) {
  const ex = Math.abs(Math.abs(x) - 5.62) < 0.01, ez = Math.abs(Math.abs(z) - 7.12) < 0.01;
  if (!ex && !ez) continue;
  const d = ex && ez ? [Math.sign(x) / Math.SQRT2, Math.sign(z) / Math.SQRT2] : ex ? [Math.sign(x), 0] : [0, Math.sign(z)];
  add({ t: 'bracket_set', at: [x, z], y: F + 3.0, dir: d, tiers: 1, step: 0.4, mat: 'timber_ni', blockMat: 'timber_ni' });
}

// beams: tie beams over the core columns and the pent posts (overhead, no colliders)
const ring = (hx, hz, y, w, h, mat, ext = 0) => {
  block([-hx - ext, -hz - w / 2, hx + ext, -hz + w / 2], y, y + h, mat, { collide: false });
  block([-hx - ext, hz - w / 2, hx + ext, hz + w / 2], y, y + h, mat, { collide: false });
  block([-hx - w / 2, -hz - ext, -hx + w / 2, hz + ext], y, y + h, mat, { collide: false });
  block([hx - w / 2, -hz - ext, hx + w / 2, hz + ext], y, y + h, mat, { collide: false });
};
ring(3.9, 5.4, F + CH - 0.45, 0.32, 0.45, 'timber_ni', 0.25);
ring(5.62, 7.12, F + 3.0 - 0.3, 0.24, 0.3, 'timber_ni', 0.15);
ring(3.9, 5.4, F + CH, 0.22, 1.75, 'plaster_white', 0);                       // the panels between the sets
ring(3.9 + 1.5, 5.4 + 1.5, F + CH + 1.5, 0.3, 0.32, 'timber_ni', 1.5);           // the eave purlin
// tie beams from the pent posts to the core
for (const z of [-2.3, 2.3]) for (const s of [-1, 1]) block([Math.min(s * 3.9, s * 5.62), z - 0.1, Math.max(s * 3.9, s * 5.62), z + 0.1], F + 2.75, F + 3.0, 'timber_ni', { collide: false });
for (const x of [-3.9, 0, 3.9]) for (const s of [-1, 1]) block([x - 0.1, Math.min(s * 5.4, s * 7.12), x + 0.1, Math.max(s * 5.4, s * 7.12)], F + 2.75, F + 3.0, 'timber_ni', { collide: false });

// the core's walls: plank doors on the front, white plaster elsewhere, a door to the tail corridor
const C = 0.26;
const bays = (fixed, along, axis, openingFor = () => [], mat = 'plaster_white') => {
  for (let i = 0; i < along.length - 1; i++) {
    const p0 = along[i] + C, p1 = along[i + 1] - C;
    const a = axis === 'z' ? [fixed, p0] : [p0, fixed], b = axis === 'z' ? [fixed, p1] : [p1, fixed];
    add({ t: 'wall', a, b, th: 0.3, y0: F, y1: F + CH - 0.45, openings: openingFor(i, p1 - p0), mat });
  }
};
bays(3.9, CZ, 'z', (i, L) => [{ at: L / 2, w: L - 0.5, h: i === 1 ? 4.6 : 3.4, y0: F }], 'timber_ni');
bays(-3.9, CZ, 'z', (i, L) => (i === 1 ? [{ at: L / 2, w: 2.0, h: 2.6, y0: F }] : []));
bays(-5.4, CX, 'x');
bays(5.4, CX, 'x');
// the door leaves, folded open against the inside of the front wall
for (let i = 0; i < 3; i++) {
  const zc = (CZ[i] + CZ[i + 1]) / 2, half = (CZ[i + 1] - CZ[i]) / 2 - 0.5;
  for (const s of [-1, 1]) block([3.0, Math.min(zc + s * half, zc + s * (half + 0.08)), 3.72, Math.max(zc + s * half, zc + s * (half + 0.08))], F, F + (i === 1 ? 4.6 : 3.4), 'timber_ni');
}
// lattice in the pent roof's front side bays (the middle bay is open), low lattice railings round it
for (const [z0, z1] of [[-7.0, -2.45], [2.45, 7.0]]) {
  for (let z = z0; z <= z1 + 0.01; z += 0.3) block([5.56, z - 0.03, 5.68, z + 0.03], F, F + 2.7, 'timber_ni', { collide: false });
  for (const [a, b] of z0 < 0 ? [[-6.92, -5.6], [-5.2, -2.5]] : [[2.5, 5.2], [5.6, 6.92]]) add({ t: 'railing', a: [5.62, a], b: [5.62, b], y: F, h: 0.9 });
}

// ── the interior: altar, Amida, canopy, the bodhisattvas on clouds, ceilings ─
block([-2.7, -2.0, 1.2, 2.0], F, F + 1.0, 'lacquer_black');
obj('amida', -0.9, 0, F + 1.0, { h: 2.8, dir: [1, 0] });
obj('canopy', -0.9, 0, F + 6.6, { r: 1.9 });
add({ t: 'slab', rect: [-3.9, -5.4, 3.9, 5.4], y0: F + 6.6, y1: F + 6.75, mat: 'ceiling_coffer', holes: [[-3.9, -2.3, 3.9, 2.3]] });
add({ t: 'slab', rect: [-3.9, -2.3, 3.9, 2.3], y0: F + 8.4, y1: F + 8.55, mat: 'ceiling_coffer', holes: [] });
for (const s of [-1, 1]) add({ t: 'slab', rect: [-3.9, Math.min(s * 2.3, s * 2.45), 3.9, Math.max(s * 2.3, s * 2.45)], y0: F + 6.6, y1: F + 8.45, mat: 'timber_ni', holes: [] });
// fifty-two small bodhisattvas on clouds, high on the walls (here along the sides, back and front)
{
  const spots = [];
  for (let k = 0; k < 9; k++) for (const s of [-1, 1]) spots.push([-3.4 + k * 0.85, s * 5.2, [0, -s], 3.9 + 0.7 * (k % 2)]);
  for (let k = 0; k < 9; k++) spots.push([-3.7, -4.6 + k * 1.15, [1, 0], 4.0 + 0.6 * (k % 2)]);
  for (let k = 0; k < 7; k++) spots.push([-3.7, -3.9 + k * 1.3, [1, 0], 5.0 - 0.0 * k]);
  for (let k = 0; k < 9; k++) spots.push([3.7, -4.8 + k * 1.2, [-1, 0], 4.9 + 0.25 * (k % 2)]);
  for (let k = 0; k < 9; k++) spots.push([-3.0 + k * 0.75, (k % 2 ? 1 : -1) * 5.2, [0, k % 2 ? -1 : 1], 5.0]);
  for (const [x, z, d, y] of spots.slice(0, 52)) obj('cloud_bodhisattva', x, z, F + y, { dir: d });
}

// ── the roofs of the central hall ────────────────────────────────────────────
add({ t: 'pent_roof', rect: [-3.9, -5.4, 3.9, 5.4], out: 2.95, yIn: F + 4.4, yOut: F + 3.25,
  raise: { side: 'e', from: 3.0, to: 7.8, yIn: F + 5.7, yOut: F + 4.95 } });
add({ t: 'irimoya', c: [0, 0], A: 5.4 + 3.6, B: 3.9 + 3.6, alongZ: true, y: EAVE, rise: 5.4, lift: 0.75, gable: 0.42, phoenix: true });

// ── the wing corridors, their corner towers, the tail corridor ───────────────
const WX = -2.0, WW = 1.4, BAY = 3.94;            // corridor centre line, half width, bay
for (const s of [-1, 1]) {
  const zs = [];
  for (let k = 0; k <= 6; k++) zs.push(s * (7.4 + k * BAY));
  const zEnd = s * 31.04, zT = s * 33.14;          // the corridor's end, the tower's centre
  // the corridor along z: posts, the upper floor, its railings, the gabled roof
  for (const z of zs) for (const dx of [-WW, WW]) col(WX + dx, z, 0.24, 5.16, 0.3, Math.abs(z) < 8.8 ? { collide: false } : {});
  block([WX - WW - 0.3, Math.min(zs[0], zEnd), WX + WW + 0.3, Math.max(zs[0], zEnd)], 0, 0.24, 'limestone', { walk: true });
  block([WX - WW - 0.15, Math.min(zs[0], zEnd), WX + WW + 0.15, Math.max(zs[0], zEnd)], 3.0, 3.25, 'timber', { collide: false });
  for (const dx of [-WW - 0.25, WW + 0.25]) add({ t: 'railing', a: [WX + dx, zs[0]], b: [WX + dx, zEnd], y: 3.25, h: 0.75, collide: false });
  add({ t: 'gable_roof_j', c: [WX, (zs[0] + zEnd) / 2], A: Math.abs(zEnd - zs[0]) / 2 + 0.6, B: WW + 1.25, y: 5.2, rise: 1.7, alongZ: true, mat: 'tile_dark', soffit: 'timber_ni', ridgeMat: 'tile_dark', noHorns: true });
  // the forward arm along x from the tower to the pond side
  const xs = [WX + 2.1, WX + 2.1 + BAY, WX + 2.1 + 2 * BAY];
  for (const x of xs) for (const dz of [-WW, WW]) col(x, zT + dz, 0.24, 5.16, 0.3);
  block([xs[0], zT - WW - 0.3, xs[2] + 0.3, zT + WW + 0.3], 0, 0.24, 'limestone', { walk: true });
  block([xs[0], zT - WW - 0.15, xs[2], zT + WW + 0.15], 3.0, 3.25, 'timber', { collide: false });
  for (const dz of [-WW - 0.25, WW + 0.25]) add({ t: 'railing', a: [xs[0], zT + dz], b: [xs[2], zT + dz], y: 3.25, h: 0.75, collide: false });
  add({ t: 'gable_roof_j', c: [(xs[0] + xs[2]) / 2 + 0.3, zT], A: (xs[2] - xs[0]) / 2 + 0.9, B: WW + 1.25, y: 5.2, rise: 1.7, mat: 'tile_dark', soffit: 'timber_ni', ridgeMat: 'tile_dark', noHorns: true });
  // the corner tower: open below, a pent roof at mid-height, a walled upper storey, a pyramidal roof
  for (const dx of [-2.1, 2.1]) for (const dz of [-2.1, 2.1]) col(WX + dx, zT + dz, 0.24, 7.26, 0.34);
  block([WX - 2.4, zT - 2.4, WX + 2.4, zT + 2.4], 0, 0.24, 'limestone', { walk: true });
  block([WX - 2.2, zT - 2.2, WX + 2.2, zT + 2.2], 3.0, 3.25, 'timber', { collide: false });
  add({ t: 'pent_roof', rect: [WX - 2.1, zT - 2.1, WX + 2.1, zT + 2.1], out: 1.5, yIn: 5.0, yOut: 4.3 });
  // the upper storey's walls between the posts, each with a latticed window
  for (const sx of [-1, 1]) {
    block([WX + sx * 2.1 - 0.09, zT - 1.93, WX + sx * 2.1 + 0.09, zT + 1.93], 5.0, 7.2, 'plaster_white', { collide: false });
    block([WX - 1.93, zT + sx * 2.1 - 0.09, WX + 1.93, zT + sx * 2.1 + 0.09], 5.0, 7.2, 'plaster_white', { collide: false });
    block([WX + sx * 2.1 - 0.1, zT - 0.6, WX + sx * 2.1 + 0.1, zT + 0.6], 5.6, 6.7, 'timber_ni', { collide: false });
    block([WX - 0.6, zT + sx * 2.1 - 0.1, WX + 0.6, zT + sx * 2.1 + 0.1], 5.6, 6.7, 'timber_ni', { collide: false });
  }
  ring2(WX, zT, 2.1, 7.2, 0.3, 0.35);
  add({ t: 'hogyo', c: [WX, zT], A: 3.6, y: 7.7, rise: 2.9, lift: 0.5 });
}
function ring2(cx, cz, h, y, w, hh) {
  block([cx - h - 0.2, cz - h - w / 2, cx + h + 0.2, cz - h + w / 2], y, y + hh, 'timber_ni', { collide: false });
  block([cx - h - 0.2, cz + h - w / 2, cx + h + 0.2, cz + h + w / 2], y, y + hh, 'timber_ni', { collide: false });
  block([cx - h - w / 2, cz - h - 0.2, cx - h + w / 2, cz + h + 0.2], y, y + hh, 'timber_ni', { collide: false });
  block([cx + h - w / 2, cz - h - 0.2, cx + h + w / 2, cz + h + 0.2], y, y + hh, 'timber_ni', { collide: false });
}
// the tail corridor: seven bays behind the hall, on posts, its floor level with the hall's
{
  const xs = [];
  for (let k = 0; k <= 7; k++) xs.push(-7.2 - k * 2.9);
  for (const x of xs) for (const dz of [-1.58, 1.58]) col(x, dz, 0, F + 2.8, 0.26, x > -7.3 ? { collide: false } : {});
  block([xs[7], -1.45, xs[0], 1.45], F - 0.25, F, 'timber', { collide: false });
  floor([xs[7], -1.15, xs[0], 1.15], F, 'timber', { th: 0.05 });
  for (const s of [-1, 1]) add({ t: 'railing', a: [xs[0], s * 1.35], b: [xs[7], s * 1.35], y: F, h: 0.8 });
  add({ t: 'gable_roof_j', c: [(xs[0] + xs[7]) / 2 + 0.5, 0], A: (xs[0] - xs[7]) / 2 + 0.5, B: 2.3, y: F + 2.9, rise: 1.3, mat: 'tile_dark', soffit: 'timber_ni', ridgeMat: 'tile_dark', noHorns: true, gableMat: 'plaster_white' });
  add({ t: 'stair', rect: [xs[7] - 2.2, -1.15, xs[7], 1.15], dir: 'e', y0: 0, y1: F, riser: 0.18, base: 0, mat: 'limestone' });
}

// ── the garden: the pond, the bridge, the lantern ────────────────────────────
for (const { c, r } of PONDS.find((p) => p.site === 'byodo-in-phoenix-hall').shapes) add({ t: 'pond_water', c, r, y: -0.35 });
add({ t: 'bridge', a: [-20, 67], b: [-20, 39], y: 0.05, rise: 1.2, w: 2.4 });
obj('lantern', 9.6, 0, 0.02);

// ── rooms and walks ──────────────────────────────────────────────────────────
const room = (id, rect, y, kind) => ({ id, rect, y, kind });
const rooms = [
  room('east-bank', [70, -60, 98, 60], 0, 'open'),
  room('island', [-28, -36, 11, 36], 0.02, 'open'),
  room('hall', [-3.6, -5.1, 3.6, 5.1], F, 'hall'),
  room('tail-corridor', [-27, -1.1, -8, 1.1], F, 'open'),
];
const walks = [
  [[-20, 72], [-20, 64], [-20, 51], [-20, 38], [-14, 30], [-8, 17.3], [4, 17.3], [10.6, 10], [10.6, 2.6], [9.4, 1.6], [8.4, 0], [6.4, 0], [4.6, 0], [2.4, 0], [2.4, 3.5], [-3.3, 3.5], [-3.3, 0], [-4.8, 0], [-7.6, 0], [-20, 0], [-28.8, 0], [-31, 0], [-31, 10], [-12, 25], [-2, 25], [-2, 36]],
];
walks[0].y0 = 0;

export const byodoInPhoenixHall = {
  id: 'byodo-in-phoenix-hall',
  name: { en: 'The Phoenix Hall of Byōdō-in', zh: '平等院凤凰堂' },
  era: { en: 'Heian period, AD 1053', zh: '平安时代，天喜元年（公元1053年）' },
  style: 'japanese',
  district: 'heian',
  ...SITES['byodo-in-phoenix-hall'],
  entrance: { at: [-20, 72], facing: 'n' },
  bounds: [-60, -78, 100, 78],
  bakeBounds: [-9, -10, 10, 10],
  bakeTop: 16,
  bakeSpacing: 0.8,
  elements: E,
  rooms,
  walks,
};

export default byodoInPhoenixHall;
