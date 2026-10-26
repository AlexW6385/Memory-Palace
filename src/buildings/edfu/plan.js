// Temple of Horus at Edfu — plan data. Every number here comes from docs/buildings/edfu.md
// (§4 plan table, §5 section). Local coordinates: +x east, +z south, z = 0 at the pylon face;
// the temple runs north toward −z. Metres, true scale.

import { CAPITAL_TYPES } from '../../styles/egyptian/columns.js';

const E = [];
const add = (o) => (E.push(o), o);
const floor = (rect, y, mat = 'sandstone_floor', room) => add({ t: 'floor', rect, y, mat, room });
const wall = (a, b, th, y0, y1, openings = [], mat = 'sandstone') => add({ t: 'wall', a, b, th, y0, y1, openings, mat });
const block = (rect, y0, y1, extra = {}) => add({ t: 'block', rect, y0, y1, mat: 'sandstone', ...extra });
const slab = (rect, y0, y1, holes = [], extra = {}) => add({ t: 'slab', rect, y0, y1, holes, mat: 'sandstone', ...extra });
const trim = (rect, y0, y1, trimSpec) => add({ t: 'trim', rect, y0, y1, trim: trimSpec, mat: 'sandstone' });
const column = (x, z, y, h, d, cap) => add({ t: 'column', at: [x, z], y, h, d, cap, mat: 'sandstone_column' });
const beam = (a, b, y, w, h, ext = 0) => add({ t: 'beam', a, b, y, w, h, ext, mat: 'sandstone' });
const stair = (rect, dir, y0, y1, riser) => add({ t: 'stair', rect, dir, y0, y1, riser });
const obj = (kind, x, z, y, extra = {}) => add({ t: 'obj', kind, at: [x, z], y, ...extra });
// an oil lamp on a bronze stand standing on the floor at `floorY`, flame at y
const lamp = (x, y, z, intensity = 5, distance = 8, floorY = y - 2.0) => add({ t: 'lamp', at: [x, y, z], intensity, distance, stand: floorY });
const door = (at, w, h, y0, extra = {}) => ({ at, w, h, y0, ...extra });

// floor levels (§4)
const Y = { court: 0, pronaos: 0.45, hypo: 0.9, offer: 1.35, ennead: 1.6, sanct: 1.85 };
const PI = Math.PI;

// ── forecourt and pylon ───────────────────────────────────────────────────────
floor([-45, 0, 45, 30], 0);
floor([-3, -12, 3, 0], 0);                                        // gate passage

const PYLON_H = 36, PYLON_B = 3.0;
for (const s of [-1, 1]) {
  const x0 = s < 0 ? -39.5 : 6.5, x1 = s < 0 ? -6.5 : 39.5;
  add({
    t: 'pylon_tower', rect: [x0, -12, x1, 0], y0: 0, h: PYLON_H, batter: PYLON_B, front: 'zp',
    batterEnds: s < 0 ? [PYLON_B, 0] : [0, PYLON_B],
    niches: [{ x: s * 12.0, w: 1.6, depth: 0.7, top: 26 }, { x: s * 18.5, w: 1.6, depth: 0.7, top: 26 }],
    trim: { torus: 0.45, cornice: 2.4 }, mat: 'sandstone',
  });
  for (const x of [12.0, 18.5]) obj('flagpole', s * x, -0.15, 0, { h: 40 });
  // granite falcons of Horus before the towers, facing the arriving visitor
  obj('falcon', s * 8.6, 3.2, 0, { yaw: PI, h: 2.9, plinth: [1.7, 2.6, 1.1], mat: 'granite_black' });
}
// gate block: two jambs and the lintel over a 6 × 14 m passage, crowned by its own cornice
block([-6.5, -11.6, -3, -0.4], 0, 24.5);
block([3, -11.6, 6.5, -0.4], 0, 24.5);
block([-3, -11.6, 3, -0.4], 14, 24.5);
trim([-6.5, -11.6, 6.5, -0.4], 0, 24.5, { torus: 0.4, cornice: 2.0 });
obj('door_leaves', 0, -1.6, 0, { yaw: PI, w: 6, h: 14, th: 0.28, depth: 0.25 });
// the winged disc of Horus Behdety over the gate, on both faces of the lintel
obj('winged_disc', 0, -0.4, 16.2, { w: 10.5, h: 2.6, yaw: 0 });
obj('winged_disc', 0, -11.6, 16.2, { w: 10.5, h: 2.6, yaw: PI });

// ── enclosure wall and the court ──────────────────────────────────────────────
const ENC_H = 12.6;
floor([-22.8, -134.8, 22.8, -12], 0);                             // court and ambulatory paving
const encTrim = { torus: 0.3, cornice: 1.3, corners: false };
add({ t: 'wall', a: [-23.9, -11.0], b: [-23.9, -137], th: 2.2, y0: 0, y1: ENC_H, mat: 'sandstone', trim: encTrim });
add({ t: 'wall', a: [23.9, -11.0], b: [23.9, -137], th: 2.2, y0: 0, y1: ENC_H, mat: 'sandstone', trim: encTrim });
add({ t: 'wall', a: [-25, -135.9], b: [25, -135.9], th: 2.2, y0: 0, y1: ENC_H, mat: 'sandstone', trim: { ...encTrim, corners: true } });
// gates from the north corners of the court into the ambulatory
for (const s of [-1, 1]) wall([s * 20, -56.0], [s * 22.8, -56.0], 1.0, 0, ENC_H, [door(1.4, 1.6, 3.8, 0)]);

// colonnade: 12 columns down each side, 8 along the pylon; capitals paired across the axis
const COURT_CAPS = ['palm', 'composite_a', 'papyrus_open', 'composite_b', 'lotus', 'composite_c', 'papyrus_bud', 'composite_a', 'palm', 'composite_b', 'papyrus_open', 'composite_c'];
const CH = 10.5, CD = 1.5;
for (const s of [-1, 1]) {
  for (let i = 0; i < 12; i++) column(s * 18.0, -16.5 - 3.28 * i, Y.court, CH, CD, COURT_CAPS[i]);
  beam([s * 18.0, -11.0], [s * 18.0, -56.5], CH, 1.4, 1.1);
  [4.5, 7.9, 11.3, 14.7].forEach((x, i) => column(s * x, -16.5, Y.court, CH, CD, COURT_CAPS[(i * 5 + 3) % 12]));
  slab([s < 0 ? -22.8 : 17.25, -56.5, s < 0 ? -17.25 : 22.8, -11.0], CH + 1.1, CH + 2.0);
}
beam([-18.0, -16.5], [18.0, -16.5], CH, 1.4, 1.1);
slab([-17.25, -17.25, 17.25, -11.0], CH + 1.1, CH + 2.0);
obj('altar', 0, -36, Y.court, { w: 3.0, d: 2.0, h: 1.2 });
stair([-1.8, -56.5, 1.8, -55.3], 'n', 0, Y.pronaos, 0.15);

// ── pronaos ───────────────────────────────────────────────────────────────────
const PRO_COL_H = 12.5, PRO_TOP = 15.4;
floor([-17.5, -73.0, 17.5, -56.5], Y.pronaos);
for (const s of [-1, 1]) wall([s * 18.75, -56.5], [s * 18.75, -75.5], 2.5, 0, PRO_TOP);
// rear wall = front of the naos, with the door to the hall of appearances
wall([-20, -74.25], [20, -74.25], 2.5, 0, PRO_TOP, [door(20, 4.4, 8.6, Y.pronaos)]);
stair([-2.2, -75.5, 2.2, -73.0], 'n', Y.pronaos, Y.hypo, 0.15);
// cedar doors of the inner halls, standing open against the reveals on the inner side
obj('door_leaves', 0, -75.5, Y.hypo, { yaw: PI, w: 4.4, h: 8.6 - (Y.hypo - Y.pronaos), th: 0.16, depth: 0 });
// 18 columns, 3 rows of 6; every capital different (Ptolemaic variety), pairs across the axis
const PRO_CAPS = ['composite_b', 'palm', 'composite_c', 'papyrus_open', 'composite_a', 'lotus', 'composite_c', 'papyrus_bud', 'composite_b'];
const PX = [3.4, 9.0, 14.6], PZ = [-58.0, -63.8, -69.6];
PZ.forEach((z, r) => PX.forEach((x, c) => { for (const s of [-1, 1]) column(s * x, z, Y.pronaos, PRO_COL_H, 2.0, PRO_CAPS[r * 3 + c]); }));
const PRO_ARCH = Y.pronaos + PRO_COL_H;
for (const x of [...PX, ...PX.map((v) => -v)]) beam([x, -57.0], [x, -73.0], PRO_ARCH, 1.6, 1.3);
beam([-17.5, -58.0], [17.5, -58.0], PRO_ARCH, 1.6, 1.3);
slab([-17.5, -73.0, 17.5, -59.0], PRO_ARCH + 1.3, PRO_TOP);
// façade: frieze over the front row, screen walls between the columns, broken-lintel door
block([-20, -59.0, 20, -56.5], PRO_ARCH, PRO_TOP);
trim([-20, -75.5, 20, -56.5], 0, PRO_TOP, { torus: 0.4, cornice: 2.0, cap: false });
const SCREEN_TOP = Y.pronaos + 6.2;
for (const s of [-1, 1]) {
  for (const [a, b] of [[4.4, 8.0], [10.0, 13.6], [15.6, 17.5]]) {
    add({ t: 'wall', a: [s * a, -58.0], b: [s * b, -58.0], th: 1.0, y0: 0, y1: SCREEN_TOP, openings: [], mat: 'sandstone', trim: { torus: 0.16, cornice: 0.75, corners: false, uraei: { sides: [true, false, false, false] } } });
  }
  add({ t: 'wall', a: [s * 1.8, -58.0], b: [s * 2.4, -58.0], th: 1.2, y0: 0, y1: SCREEN_TOP + 0.4, openings: [], mat: 'sandstone', trim: { torus: 0.16, cornice: 0.75 } });
}
// the House of Books (east) and the robing room (west), small chambers inside the façade
for (const s of [-1, 1]) {
  const xi = s * 12.9, xo = s * 17.5;
  wall([xi, -59.2], [xi, -62.6], 0.6, Y.pronaos, Y.pronaos + 5.0, [door(1.7, 1.2, 2.6, Y.pronaos)]);
  wall([s * 12.6, -59.5], [xo, -59.5], 0.6, Y.pronaos, Y.pronaos + 5.0);
  wall([s * 12.6, -62.3], [xo, -62.3], 0.6, Y.pronaos, Y.pronaos + 5.0);
  slab([Math.min(s * 12.6, xo), -62.6, Math.max(s * 12.6, xo), -59.2], Y.pronaos + 5.0, Y.pronaos + 5.4);
  trim([Math.min(s * 12.6, xo), -62.6, Math.max(s * 12.6, xo), -59.2], Y.pronaos, Y.pronaos + 5.4, { torus: 0.1, cornice: 0.5, corners: false });
}
// granite falcon with the double crown at the pronaos door (one survives of the pair)
for (const s of [-1, 1]) obj('falcon', s * 5.6, -54.6, 0, { yaw: PI, h: 2.4, plinth: [1.4, 2.2, 0.8], mat: 'granite_grey' });

// ── the naos: outer walls ─────────────────────────────────────────────────────
const NAOS_H = 12.6;
for (const s of [-1, 1]) wall([s * 15.4, -75.5], [s * 15.4, -128.5], 2.2, 0, NAOS_H);
wall([-16.5, -127.4], [16.5, -127.4], 2.2, 0, NAOS_H);
trim([-16.5, -128.5, 16.5, -75.5], 0, NAOS_H, { torus: 0.35, cornice: 1.6, cap: false, sides: [false, true, true, true], cornersMask: [false, false, true, true] });

// ── hall of appearances (inner hypostyle) ─────────────────────────────────────
floor([-14.3, -88.2, 14.3, -75.5], Y.hypo);
const HY_H = 9.6, HY_ARCH = Y.hypo + HY_H;
const HY_CAPS = ['composite_a', 'palm', 'papyrus_open', 'composite_c', 'lotus', 'composite_b'];
[-78.5, -81.5, -84.5].forEach((z, r) => [2.9, 7.3].forEach((x, c) => { for (const s of [-1, 1]) column(s * x, z, Y.hypo, HY_H, 1.45, HY_CAPS[r * 2 + c]); }));
for (const x of [-7.3, -2.9, 2.9, 7.3]) beam([x, -75.5], [x, -87.5], HY_ARCH, 1.3, 1.0);
slab([-10.9, -88.9, 10.9, -75.5], HY_ARCH + 1.0, HY_ARCH + 1.9, [[-1.6, -80.3, 1.6, -79.6], [-1.6, -83.4, 1.6, -82.7]], { walk: true });
for (const s of [-1, 1]) {
  // side rooms: laboratory and treasury (west), liquid offerings and the Nile room (east)
  wall([s * 10.9, -75.5], [s * 10.9, -87.5], 1.2, Y.hypo, HY_ARCH + 1.0, [door(2.75, 1.6, 4.2, Y.hypo), door(9.25, 1.6, 4.2, Y.hypo)]);
  wall([s * 11.5, -81.5], [s * 14.3, -81.5], 1.0, Y.hypo, 8.4);
  slab([s < 0 ? -14.3 : 11.5, -87.5, s < 0 ? -11.5 : 14.3, -75.5], 8.4, 9.2, [], { walk: true });
}
wall([-14.3, -88.2], [14.3, -88.2], 1.4, Y.hypo, HY_ARCH + 1.9, [door(14.3, 3.4, 7.0, Y.hypo)]);
stair([-1.7, -88.9, 1.7, -87.5], 'n', Y.hypo, Y.offer, 0.15);
obj('door_leaves', 0, -88.9, Y.offer, { yaw: PI, w: 3.4, h: 7.0 - (Y.offer - Y.hypo), th: 0.14, depth: 0 });

// ── offering hall ─────────────────────────────────────────────────────────────
floor([-14.3, -96.5, 14.3, -88.2], Y.offer);
slab([-11.5, -97.1, 11.5, -88.9], 10.6, 11.4, [[-1.0, -92.8, 1.0, -92.1]], { walk: true });
// the two stair rooms: stairs to the roof for the New Year procession (dossier §6.5). Each is a
// dog-leg of four flights in two lanes either side of a spine wall, arriving on the roof of the
// offering hall at 11.4 m; the stairwell is open to the sky above its upper flights.
const R1 = 3.975, R2 = 6.6, R3 = 9.2, ROOF_OFFER = 11.4;
for (const s of [-1, 1]) {
  const X = (a, b) => (s < 0 ? [-b, -a] : [a, b]);
  const rect = (a, b, z0, z1) => { const [x0, x1] = X(a, b); return [x0, z0, x1, z1]; };
  wall([s * 10.9, -88.9], [s * 10.9, -95.9], 1.2, Y.offer, 10.6, [door(0.75, 1.2, 3.6, Y.offer)]);
  add({ t: 'stair', rect: rect(11.5, 12.8, -94.5, -90.3), dir: 'n', y0: Y.offer, y1: R1, riser: 0.175 });
  slab(rect(11.5, 14.3, -95.9, -94.5), R1 - 0.4, R1, [], { walk: true });
  add({ t: 'stair', rect: rect(13.0, 14.3, -94.5, -90.3), dir: 's', y0: R1, y1: R2, riser: 0.175, base: R1 - 0.4 });
  slab(rect(11.5, 14.3, -90.3, -88.9), R2 - 0.4, R2, [], { walk: true });
  add({ t: 'stair', rect: rect(11.5, 12.8, -94.5, -90.3), dir: 'n', y0: R2, y1: R3, riser: 0.175, base: R2 - 0.45 });
  slab(rect(11.5, 14.3, -95.9, -94.5), R3 - 0.4, R3, [], { walk: true });
  add({ t: 'stair', rect: rect(13.0, 14.3, -94.5, -90.9), dir: 's', y0: R3, y1: ROOF_OFFER, riser: 0.18, base: R3 - 0.4 });
  // oil lamps on the landings (the real stairs are lit by small windows)
  lamp(s * 14.05, Y.offer + 1.6, -89.15, 3, 6, Y.offer); lamp(s * 11.75, R2 + 1.6, -89.15, 3, 6, R2); lamp(s * 14.05, R1 + 1.6, -95.65, 3, 6, R1);
  // spine wall between the lanes, rising as a parapet beside the top flight
  { const [x0, x1] = X(12.8, 13.0); wall([(x0 + x1) / 2, -90.3], [(x0 + x1) / 2, -94.5], 0.2, Y.offer, ROOF_OFFER + 1.0); }
  // the top landing, roofing the entrance: walkable at the level of the offering-hall roof
  slab(rect(11.5, 14.3, -90.9, -88.9), 10.6, ROOF_OFFER, [], { walk: true });
}
wall([-14.3, -96.5], [14.3, -96.5], 1.2, Y.offer, 11.4, [door(14.3, 3.0, 6.4, Y.offer)]);
stair([-1.5, -97.1, 1.5, -95.9], 'n', Y.offer, Y.ennead, 0.125);
obj('door_leaves', 0, -97.1, Y.ennead, { yaw: PI, w: 3.0, h: 6.4 - (Y.ennead - Y.offer), th: 0.12, depth: 0 });

// ── hall of the Ennead ────────────────────────────────────────────────────────
floor([-14.3, -103.7, 14.3, -96.5], Y.ennead);
slab([-10.9, -103.1, 10.9, -97.1], 9.8, 10.6, [], { walk: true });
for (const s of [-1, 1]) {
  // chapel of Min (west) and linen room (east)
  wall([s * 10.9, -97.1], [s * 10.9, -103.1], 1.2, Y.ennead, 9.8, [door(3.0, 1.6, 4.0, Y.ennead)]);
  slab([s < 0 ? -14.3 : 11.5, -103.1, s < 0 ? -11.5 : 14.3, -97.1], 8.4, 9.2, [], { walk: true });
}
wall([-14.3, -103.7], [14.3, -103.7], 1.2, Y.ennead, 9.8, [door(14.3, 2.6, 5.6, Y.ennead), door(14.3 - 4.9, 1.6, 4.2, Y.ennead), door(14.3 + 4.9, 1.6, 4.2, Y.ennead)]);
for (const x of [-4.9, 0, 4.9]) stair([x - (x ? 0.8 : 1.3), -104.3, x + (x ? 0.8 : 1.3), -103.1], 'n', Y.ennead, Y.sanct, 0.125);

// ── sanctuary, corridor of mysteries, chapels ─────────────────────────────────
floor([-14.3, -126.3, 14.3, -103.7], Y.sanct);
const SAN_TOP = 9.0;
for (const s of [-1, 1]) wall([s * 3.3, -104.3], [s * 3.3, -116.9], 1.2, Y.sanct, SAN_TOP);
wall([-3.9, -116.3], [3.9, -116.3], 1.2, Y.sanct, SAN_TOP);
slab([-3.9, -116.9, 3.9, -104.3], SAN_TOP, SAN_TOP + 0.8, [[-0.3, -108.3, 0.3, -107.7], [-0.3, -110.3, 0.3, -109.7], [-0.3, -112.3, 0.3, -111.7]]);
trim([-3.9, -116.9, 3.9, -104.3], Y.sanct, SAN_TOP - 1.4, { torus: 0.14, cornice: 0.9, cap: false, sides: [false, true, true, true], cornersMask: [false, false, true, true] });
slab([-14.3, -126.3, 14.3, -104.3], 8.4, 9.2, [[-3.9, -116.9, 3.9, -104.3]], { walk: true });
// steps between the roof levels (chapels 9.2 → Ennead 10.6 → offering hall 11.4 → hall of appearances 12.4)
for (const s of [-1, 1]) {
  const xa = Math.min(s * 6.4, s * 8.6), xb = Math.max(s * 6.4, s * 8.6);
  add({ t: 'stair', rect: [xa, -106.9, xb, -103.1], dir: 's', y0: 9.2, y1: 10.6, riser: 0.175, base: 9.2 });
  add({ t: 'stair', rect: [xa, -99.6, xb, -97.1], dir: 's', y0: 10.6, y1: 11.4, riser: 0.16, base: 10.6 });
  add({ t: 'stair', rect: [xa, -92.3, xb, -88.9], dir: 's', y0: 11.4, y1: 12.4, riser: 0.17, base: 11.4 });
}
// chapel walls
for (const s of [-1, 1]) {
  wall([s * 6.4, -104.3], [s * 6.4, -118.9], 1.0, Y.sanct, 8.4, [-106.65, -112.1, -117.55].map((z) => door(-104.3 - z, 1.4, 3.8, Y.sanct)));
  for (const z of [-109.5, -114.7]) wall([s * 6.9, z], [s * 14.3, z], 1.0, Y.sanct, 8.4);
  wall([s * 2.6, -119.9], [s * 2.6, -126.3], 1.0, Y.sanct, 8.4);
}
wall([-14.3, -119.4], [14.3, -119.4], 1.0, Y.sanct, 8.4, [-4.5, 0, 4.5].map((x) => door(x + 14.3, 1.4, 3.8, Y.sanct)));
obj('naos', 0, -114.6, Y.sanct, { yaw: PI, w: 1.6, d: 1.45, h: 4.0 });
obj('barque_stand', 0, -109.4, Y.sanct, { w: 1.3, d: 2.6, h: 1.05 });
obj('barque', 0, -109.4, Y.sanct + 1.05 - 1.0, { l: 4.6 });
// oil lamps in the dark inner rooms (baked into the light of the room)
lamp(-5.6, Y.sanct + 1.6, -110.6, 4, 7, Y.sanct); lamp(5.6, Y.sanct + 1.6, -110.6, 4, 7, Y.sanct);
lamp(-2.2, Y.sanct + 1.6, -118.6, 4, 7, Y.sanct); lamp(2.2, Y.sanct + 1.6, -118.6, 4, 7, Y.sanct);
for (const s of [-1, 1]) for (const z of [-106.65, -112.1, -117.55]) lamp(s * 10.6, Y.sanct + 1.5, z, 3, 6, Y.sanct);
for (const x of [-8.6, 0, 8.6]) lamp(x, Y.sanct + 1.5, -123.1, 3, 6, Y.sanct);
for (const s of [-1, 1]) lamp(s * 3.6, Y.ennead + 1.6, -99.0, 3, 8, Y.ennead);

// ── surroundings: date palms ──────────────────────────────────────────────────
let seed = 1237;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const palmSpots = [];
for (let x = -44; x <= 44; x += 6.5) palmSpots.push([x + rand() * 1.5, 34 + rand() * 3]);
for (let z = -19; z > -130; z -= 9) { palmSpots.push([-31 - rand() * 6, z - rand() * 3]); palmSpots.push([31 + rand() * 6, z - rand() * 3]); }
for (const [cx, cz, n] of [[-60, 10, 7], [62, 14, 6], [-58, -70, 6], [60, -95, 7], [0, -152, 8]]) {
  for (let i = 0; i < n; i++) palmSpots.push([cx + (rand() - 0.5) * 18, cz + (rand() - 0.5) * 18]);
}
for (const [x, z] of palmSpots) obj('palm', x, z, 0, { h: 8 + rand() * 5, lean: (rand() - 0.5) * 0.18, seed: Math.floor(rand() * 9999) });

// ── rooms (for the plan check and the music; never shown as labels) ───────────
const room = (id, rect, y, kind) => ({ id, rect, y, kind });
const rooms = [
  room('forecourt', [-44, 6, 44, 29], 0, 'open'),
  room('gate', [-2.5, -11, 2.5, -1], 0, 'open'),
  room('court', [-16, -54, 16, -19], 0, 'open'),
  room('colonnade-w', [-22.5, -55, -19, -13], 0, 'open'),
  room('colonnade-e', [19, -55, 22.5, -13], 0, 'open'),
  room('pronaos', [-17, -72.5, 17, -59.2], Y.pronaos, 'hall'),
  room('robing-room', [-17.2, -62.0, -13.3, -59.8], Y.pronaos, 'hall'),
  room('library', [13.3, -62.0, 17.2, -59.8], Y.pronaos, 'hall'),
  room('hall-of-appearances', [-10.2, -87.4, 10.2, -75.6], Y.hypo, 'hall'),
  room('laboratory', [-14.2, -80.9, -11.6, -75.6], Y.hypo, 'inner'),
  room('treasury', [-14.2, -87.4, -11.6, -82.1], Y.hypo, 'inner'),
  room('liquid-offerings', [11.6, -80.9, 14.2, -75.6], Y.hypo, 'inner'),
  room('nile-room', [11.6, -87.4, 14.2, -82.1], Y.hypo, 'inner'),
  room('offering-hall', [-10.2, -95.8, 10.2, -89.0], Y.offer, 'inner'),
  room('stair-west', [-14.2, -95.8, -11.6, -89.0], Y.offer, 'inner'),
  room('stair-east', [11.6, -95.8, 14.2, -89.0], Y.offer, 'inner'),
  room('hall-of-the-ennead', [-10.2, -103.0, 10.2, -97.2], Y.ennead, 'inner'),
  room('chapel-of-min', [-14.2, -103.0, -11.6, -97.2], Y.ennead, 'inner'),
  room('linen-room', [11.6, -103.0, 14.2, -97.2], Y.ennead, 'inner'),
  room('sanctuary', [-2.6, -115.6, 2.6, -104.4], Y.sanct, 'sanctum'),
  room('corridor-w', [-5.8, -118.8, -4.0, -104.4], Y.sanct, 'sanctum'),
  room('corridor-e', [4.0, -118.8, 5.8, -104.4], Y.sanct, 'sanctum'),
  room('corridor-n', [-5.8, -118.8, 5.8, -117.0], Y.sanct, 'sanctum'),
  room('chapel-of-khonsu', [-14.2, -108.9, -7.0, -104.4], Y.sanct, 'sanctum'),
  room('chapel-of-hathor', [-14.2, -114.1, -7.0, -110.1], Y.sanct, 'sanctum'),
  room('chapel-of-the-throne-of-re', [-14.2, -118.8, -7.0, -115.3], Y.sanct, 'sanctum'),
  room('chapel-of-osiris', [-14.2, -126.2, -3.2, -120.0], Y.sanct, 'sanctum'),
  room('tomb-of-osiris', [-2.0, -126.2, 2.0, -120.0], Y.sanct, 'sanctum'),
  room('chapel-of-the-west', [3.2, -126.2, 14.2, -120.0], Y.sanct, 'sanctum'),
  room('chapel-of-the-spread-wings', [7.0, -118.8, 14.2, -115.3], Y.sanct, 'sanctum'),
  room('chapel-of-the-throne-of-the-gods', [7.0, -114.1, 14.2, -110.1], Y.sanct, 'sanctum'),
  room('chapel-of-horus-the-victor', [7.0, -108.9, 14.2, -104.4], Y.sanct, 'sanctum'),
  room('ambulatory-w', [-22.7, -128, -16.6, -57], 0, 'open'),
  room('ambulatory-e', [16.6, -128, 22.7, -57], 0, 'open'),
  room('ambulatory-n', [-22.7, -134.7, 22.7, -128.6], 0, 'open'),
];

// walk-through routes for tools/walk-check.mjs (local [x, z]); each starts on the ground floor
const walks = [
  // the axis, from the forecourt to the sanctuary
  [[0, 26], [0, -6], [0, -30], [-2.6, -33], [-2.6, -39], [0, -45], [0, -55.0], [0, -60], [0, -74], [0, -80], [0, -88.2], [0, -92], [0, -96.5], [0, -100], [0, -103.7], [0, -105.5]],
  // the side rooms of the hall of appearances and the offering hall
  [[0, -80], [-9.5, -78.25], [-13, -78.25], [-9.5, -78.25], [-9.5, -84.75], [-13, -84.75], [-9.5, -84.75], [9.5, -84.75], [13, -84.75], [9.5, -84.75], [9.5, -78.25], [13, -78.25], [9.5, -78.25], [0, -80], [0, -88.2], [0, -91.2], [-9.5, -91.2], [-9.5, -89.6], [-12.15, -89.6], [-9.5, -89.6], [-9.5, -91.2], [9.5, -91.2], [9.5, -89.6], [12.15, -89.6]],
  // the corridor of mysteries and every chapel
  [[0, -100], [-12.5, -100.1], [-4.9, -100.6], [-4.9, -103.7], [-4.9, -106.65], [-9.5, -106.65], [-4.9, -106.65], [-4.9, -112.1], [-9.5, -112.1], [-4.9, -112.1], [-4.9, -117.9], [-4.5, -117.9], [-4.5, -121.8], [-4.5, -117.9], [0, -117.9], [0, -121.8], [0, -117.9], [4.5, -117.9], [4.5, -121.8], [4.5, -117.9], [4.9, -117.9], [4.9, -117.55], [9.5, -117.55], [4.9, -117.55], [4.9, -112.1], [9.5, -112.1], [4.9, -112.1], [4.9, -106.65], [9.5, -106.65], [4.9, -106.65], [4.9, -103.7], [4.9, -100.6], [12.5, -100.1]],
  // the pronaos side rooms
  [[0, -60.5], [11.5, -60.9], [15.5, -60.9], [11.5, -60.9], [-11.5, -60.9], [-15.5, -60.9]],
  // up the east stair to the roof, across the roof levels, and down the west stair
  [[0, -92], [9.5, -89.6], [12.15, -89.6], [12.15, -95.2], [13.65, -95.2], [13.65, -89.6], [12.15, -89.6], [12.15, -95.2], [13.65, -95.2], [13.65, -89.6], [11.0, -89.8], [7.5, -92.5], [7.5, -86.0], [7.5, -92.5], [7.5, -100.0], [7.5, -110], [-7.5, -110], [-7.5, -100], [-7.5, -92.5], [-11.0, -89.8], [-13.65, -89.6], [-13.65, -95.2], [-12.15, -95.2], [-12.15, -89.6], [-13.65, -89.6], [-13.65, -95.2], [-12.15, -95.2], [-12.15, -89.6], [-9.5, -89.6], [0, -92]],
  // the ambulatory around the temple
  [[-20.5, -50], [-21.4, -55.0], [-21.4, -57.5], [-19.6, -80], [-19.6, -131], [19.6, -131], [19.6, -80], [21.4, -57.5], [21.4, -55.0], [20.5, -50]],
];
walks.forEach((w, i) => { w.y0 = [0, 0.9, 1.6, 0.45, 1.35, 0][i]; });

export const edfu = {
  id: 'edfu',
  name: { en: 'Temple of Horus, Edfu', zh: '埃德富荷鲁斯神庙' },
  era: { en: 'Ptolemaic Egypt, 237–57 BC', zh: '托勒密埃及，前237—前57年' },
  style: 'egyptian',
  district: 'nile',
  origin: [0, 0],
  yaw: 0,
  entrance: { at: [0, 26], facing: 'n' },
  bounds: [-44, -139, 44, 31],      // local rect the light bake covers
  bakeTop: 18,
  elements: E,
  rooms,
  walks,
};

export default edfu;
export { CAPITAL_TYPES };
