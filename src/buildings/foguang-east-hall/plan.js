// The Great East Hall of Foguang Monastery, Mount Wutai, as completed in 857 — plan data from
// docs/buildings/foguang-east-hall.md (§4). Local coordinates: origin at the centre of the hall,
// +x east (the back of the hall: it faces west, −x), +z south; y = 0 at the monastery's lower
// courtyard. Metres.

import { SITES } from '../../world/regions.js';

const E = [];
const add = (o) => (E.push(o), o);
const floor = (rect, y, mat, extra = {}) => add({ t: 'floor', rect, y, mat, ...extra });
const block = (rect, y0, y1, mat, extra = {}) => add({ t: 'block', rect, y0, y1, mat, ...extra });
const obj = (kind, x, z, y, extra = {}) => add({ t: 'obj', kind, at: [x, z], y, ...extra });

const T = 13;                          // the upper terrace, 13 m above the courtyard
const F = T + 1.0;                     // the hall's floor on its platform
const XS = [-8.83, -4.415, 0, 4.415, 8.83];                           // column lines across (depth)
const ZS = [-17.0, -12.6, -7.56, -2.52, 2.52, 7.56, 12.6, 17.0];       // column lines along (width)
const H0 = 4.99, RISE = 0.05;          // column height at the centre; rise per bay toward the ends
const colH = (z) => H0 + RISE * Math.round(Math.abs(z) / 5.04 + 0.4);
const BR = 2.45;                       // bracket set height
const TOP = F + H0 + BR;               // seat of the eave purlin

// ── terraces, stairs, platform ───────────────────────────────────────────────
floor([-118, -46, -62, 46], 0, 'travertine', { th: 0.3 });
block([-62, -48, 34, 48], 0, 6.5, 'brick_grey', { walk: true });
floor([-62, -48, -30, 48], 6.5, 'travertine', { th: 0.2 });
block([-30, -48, 34, 48], 6.5, T, 'brick_grey', { walk: true });
floor([-30, -48, 34, 48], T, 'travertine', { th: 0.2 });
add({ t: 'stair', rect: [-74, -4, -62, 4], dir: 'e', y0: 0, y1: 6.5, riser: 0.171, base: 0, mat: 'limestone' });
add({ t: 'stair', rect: [-42, -4, -30, 4], dir: 'e', y0: 6.5, y1: T, riser: 0.171, base: 6.5, mat: 'limestone' });
block([-13.5, -20.0, 11.0, 20.0], T, F, 'limestone', { walk: true });
floor([-13.5, -20.0, 11.0, 20.0], F, 'sandstone_floor', { th: 0.15 });
add({ t: 'stair', rect: [-16.0, -3.0, -13.5, 3.0], dir: 'e', y0: T, y1: F, riser: 0.167, base: T, mat: 'limestone' });

// ── columns, outer and inner rings ───────────────────────────────────────────
const outer = [], inner = [];
for (const x of XS) for (const z of ZS) {
  const onOuter = Math.abs(Math.abs(x) - 8.83) < 0.01 || Math.abs(Math.abs(z) - 17.0) < 0.01;
  const onInner = !onOuter && (Math.abs(Math.abs(x) - 4.415) < 0.01 && Math.abs(z) <= 12.61 || Math.abs(Math.abs(z) - 12.6) < 0.01 && Math.abs(x) <= 4.42);
  if (onOuter) outer.push([x, z]);
  else if (onInner) inner.push([x, z]);
}
for (const [x, z] of [...outer, ...inner]) add({ t: 'column', at: [x, z], y: F, h: colH(z), d: 0.54 });

// ── bracket sets on every column and between ─────────────────────────────────
const outward = (x, z) => {
  const ex = Math.abs(Math.abs(x) - 8.83) < 0.01, ez = Math.abs(Math.abs(z) - 17.0) < 0.01;
  if (ex && ez) { const l = Math.SQRT2; return [Math.sign(x) / l, Math.sign(z) / l]; }
  return ex ? [Math.sign(x), 0] : [0, Math.sign(z)];
};
for (const [x, z] of outer) add({ t: 'bracket_set', at: [x, z], y: F + colH(z), dir: outward(x, z), tiers: 4, step: 0.48, ang: true });
for (const [x, z] of inner) {
  const d = Math.abs(Math.abs(x) - 4.415) < 0.01 ? [Math.sign(x), 0] : [0, Math.sign(z)];
  add({ t: 'bracket_set', at: [x, z], y: F + colH(z), dir: d, tiers: 3, step: 0.42, both: true });
}
// intercolumnar sets (simpler) in the middle of each outer bay
const between = [];
for (let i = 0; i < ZS.length - 1; i++) for (const sx of [-1, 1]) between.push([sx * 8.83, (ZS[i] + ZS[i + 1]) / 2, [sx, 0]]);
for (let i = 0; i < XS.length - 1; i++) for (const sz of [-1, 1]) between.push([(XS[i] + XS[i + 1]) / 2, sz * 17.0, [0, sz]]);
for (const [x, z, d] of between) add({ t: 'bracket_set', at: [x, z], y: F + H0 + 0.6, dir: d, tiers: 2, step: 0.45 });

// ── architraves ("seven red, eight white"), the eave purlin, the plaster between the sets ──
// overhead beams in a rectangle (no colliders: they are above head height and sit on the columns)
const ring = (hx, hz, y, w, h, mat, ext = 0) => {
  block([-hx - ext, -hz - w / 2, hx + ext, -hz + w / 2], y, y + h, mat, { collide: false });
  block([-hx - ext, hz - w / 2, hx + ext, hz + w / 2], y, y + h, mat, { collide: false });
  block([-hx - w / 2, -hz - ext, -hx + w / 2, hz + ext], y, y + h, mat, { collide: false });
  block([hx - w / 2, -hz - ext, hx + w / 2, hz + ext], y, y + h, mat, { collide: false });
};
ring(8.83, 17.0, F + H0 - 0.42, 0.34, 0.42, 'timber_red', 0.3);
ring(4.415, 12.6, F + H0 - 0.42, 0.34, 0.42, 'timber_red', 0.3);
// the white patches of the architrave, eight to a bay, on the outer faces
for (let i = 0; i < ZS.length - 1; i++) for (let k = 0; k < 8; k++) {
  const z0 = ZS[i] + (ZS[i + 1] - ZS[i]) * (k + 0.2) / 8, z1 = ZS[i] + (ZS[i + 1] - ZS[i]) * (k + 0.8) / 8;
  for (const sx of [-1, 1]) block([Math.min(sx * 9.0, sx * 9.02), z0, Math.max(sx * 9.0, sx * 9.02), z1], F + H0 - 0.34, F + H0 - 0.1, 'paint_white', { collide: false });
}
ring(8.83 + 1.92, 17.0 + 1.92, TOP - 0.05, 0.32, 0.36, 'timber_red', 1.92);      // the eave purlin (liaoyan fang)
ring(8.83, 17.0, F + H0, 0.24, BR - 0.2, 'paint_white', 0);                         // the plastered panels between the sets

// ── the walls: red earth walls at the sides and back; doors and windows on the front ─
// walls fill the bays between the columns (the posts stand in the wall)
const C = 0.28;
const bayWalls = (fixed, along, axis, openingFor = () => []) => {
  for (let i = 0; i < along.length - 1; i++) {
    const p0 = along[i] + C, p1 = along[i + 1] - C;
    const a = axis === 'z' ? [fixed, p0] : [p0, fixed], b = axis === 'z' ? [fixed, p1] : [p1, fixed];
    add({ t: 'wall', a, b, th: 0.9, y0: F, y1: F + H0 - 0.42, openings: openingFor(i, p1 - p0), mat: 'wall_red' });
  }
};
bayWalls(8.83, ZS, 'z');
bayWalls(-17.0, XS, 'x');
bayWalls(17.0, XS, 'x');
// the front: five plank doors in the central bays; slatted windows over sill walls in the end bays
bayWalls(-8.83, ZS, 'z', (i, L) => (i >= 1 && i <= 5 ? [{ at: L / 2, w: 3.6, h: 3.9, y0: F }] : [{ at: L / 2, w: 2.6, h: 1.8, y0: F + 1.8 }]));
for (let i = 1; i <= 5; i++) {
  const zc = (ZS[i] + ZS[i + 1]) / 2;
  // the two leaves, standing open against the inner face of the wall
  for (const s of [-1, 1]) block([-8.4, Math.min(zc + s * 1.8, zc + s * 1.85), -7.0, Math.max(zc + s * 1.8, zc + s * 1.85)], F, F + 3.9, 'timber_red');
}
for (const i of [0, 6]) {
  const zc = (ZS[i] + ZS[i + 1]) / 2;
  for (let k = -5; k <= 5; k++) block([-8.9, zc + k * 0.22 - 0.035, -8.76, zc + k * 0.22 + 0.035], F + 1.8, F + 3.6, 'timber_red', { collide: false });
}

// ── the interior: ceilings, the altar and its statues ───────────────────────
add({ t: 'slab', rect: [-8.83, -17.0, 8.83, 17.0], y0: F + 7.8, y1: F + 8.0, mat: 'ceiling_grid', holes: [[-4.415, -12.6, 4.415, 12.6]] });
add({ t: 'slab', rect: [-4.6, -12.8, 4.6, 12.8], y0: F + 8.9, y1: F + 9.1, mat: 'ceiling_grid', holes: [] });
for (const s of [-1, 1]) {
  add({ t: 'slab', rect: [Math.min(s * 4.415, s * 4.6), -12.8, Math.max(s * 4.415, s * 4.6), 12.8], y0: F + 7.8, y1: F + 9.0, mat: 'timber_red', holes: [] });
  add({ t: 'slab', rect: [-4.6, Math.min(s * 12.6, s * 12.8), 4.6, Math.max(s * 12.6, s * 12.8)], y0: F + 7.8, y1: F + 9.0, mat: 'timber_red', holes: [] });
}
// crescent beams linking the rings across the outer aisle
for (const z of ZS.slice(1, -1)) for (const sx of [-1, 1]) block([Math.min(sx * 4.415, sx * 8.83), z - 0.15, Math.max(sx * 4.415, sx * 8.83), z + 0.15], F + 7.2, F + 7.75, 'timber_red', { collide: false });
for (const x of XS.slice(1, -1)) for (const sz of [-1, 1]) block([x - 0.15, Math.min(sz * 12.6, sz * 17.0), x + 0.15, Math.max(sz * 12.6, sz * 17.0)], F + 7.2, F + 7.75, 'timber_red', { collide: false });
// the altar platform in the inner zone, the statues facing west
block([-3.0, -12.2, 3.8, 12.2], F, F + 0.9, 'limestone', { walk: false });
for (const z of [0, -10.08, 10.08]) obj('buddha', 0.8, z, F + 0.9, { h: 5.2, dir: [-1, 0] });
for (const z of [-1.9, 1.9, -8.2, -11.9, 8.2, 11.9]) obj('figure', -1.6, z, F + 0.9, { h: 2.5 });
obj('mount', 0.2, -5.04, F + 0.9, { animal: 'lion', dir: [-1, 0] });
obj('mount', 0.2, 5.04, F + 0.9, { animal: 'elephant', dir: [-1, 0] });
for (const z of [-12.0, 12.0]) obj('figure', -2.6, z, F + 0.9, { h: 3.2, robe: 'clay_robe' });

// ── the roof ─────────────────────────────────────────────────────────────────
add({ t: 'hip_roof', c: [0, 0], A: 17.0 + 4.0, B: 8.83 + 4.0, alongZ: true, y: F + 6.6, rise: 6.1, lift: 0.6, mat: 'tile_grey', soffit: 'timber_red' });

// ── the monastery: gate, walls, the Tang pillar, the old pagoda ──────────────
{
  const gx = -114;
  for (const z of [-4.5, 4.5, -1.5, 1.5]) add({ t: 'column', at: [gx, z], y: 0, h: 4.2, d: 0.4 });
  for (const z of [-4.5, 4.5]) add({ t: 'column', at: [gx + 4, z], y: 0, h: 4.2, d: 0.4 });
  add({ t: 'gable_roof_c', c: [gx + 2, 0], A: 4.2, B: 7.0, y: 4.6, rise: 2.6 });
  for (const sz of [-1, 1]) add({ t: 'wall', a: [gx + 2, sz * 6.0], b: [gx + 2, sz * 46], th: 0.8, y0: 0, y1: 3.2, openings: [], mat: 'earth_wall' });
  for (const sz of [-1, 1]) add({ t: 'wall', a: [gx + 2, sz * 46], b: [-62, sz * 46], th: 0.8, y0: 0, y1: 3.2, openings: [], mat: 'earth_wall' });
  for (const sz of [-1, 1]) block([gx + 1.8, Math.min(sz * 6.0, sz * 46), gx + 2.2, Math.max(sz * 6.0, sz * 46)], 3.2, 3.5, 'tile_grey', { collide: false });
}
obj('dharani_pillar', -22, -8, T);
obj('pagoda', 6, 32, T);

// ── rooms and walks ──────────────────────────────────────────────────────────
const room = (id, rect, y, kind) => ({ id, rect, y, kind });
const rooms = [
  room('courtyard', [-108, -30, -80, 30], 0, 'open'),
  room('middle-terrace', [-58, -20, -46, 20], 6.5, 'open'),
  room('upper-terrace', [-28, -20, -18, 20], T, 'open'),
  room('front-aisle', [-8, -14, -5.5, 14], F, 'hall'),
  room('rear-aisle', [5.5, -14, 8, 14], F, 'hall'),
];
const walks = [
  [[-124, 0], [-111, 0], [-80, 0], [-75, 0], [-61, 0], [-44, 0], [-29, 0], [-17, 0], [-13, 0], [-7.6, 0], [-6.2, 0], [-6.2, 14.8], [6.6, 14.8], [6.6, 0], [6.6, -14.8], [-6.2, -14.8], [-6.2, 0]],
];
walks[0].y0 = 0;

export const foguangEastHall = {
  id: 'foguang-east-hall',
  name: { en: 'The Great East Hall of Foguang Monastery', zh: '佛光寺东大殿' },
  era: { en: 'Tang dynasty, AD 857', zh: '唐，大中十一年（公元857年）' },
  style: 'chinese',
  district: 'tang',
  ...SITES['foguang-east-hall'],
  entrance: { at: [-124, 0], facing: 'e' },
  bounds: [-125, -48, 34, 48],
  bakeBounds: [-30, -24, 16, 24],
  bakeTop: 30,
  bakeSpacing: 1.0,
  elements: E,
  rooms,
  walks,
};

export default foguangEastHall;
