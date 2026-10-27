// The Dome of the Rock, Jerusalem, as completed in 691/92 — plan data from
// docs/buildings/dome-of-the-rock.md (§4). Local coordinates: origin at the centre of the Rock,
// +x east, +z south; y = 0 at the top of the platform (4 m above the esplanade). Metres.

import { SITES } from '../../world/regions.js';

const E = [];
const add = (o) => (E.push(o), o);
const column = (x, z, y, h, d, shaftMat, extra = {}) => add({ t: 'column', at: [x, z], y, h, d, mat: 'marble', shaftMat, ...extra });
const obj = (kind, x, z, y, extra = {}) => add({ t: 'obj', kind, at: [x, z], y, ...extra });
const pwall = (o) => add({ t: 'planar_wall', ...o });
const D2R = Math.PI / 180;
const T22 = Math.tan(22.5 * D2R);

const P = 4;                         // the platform stands 4 m above the esplanade
const WALL = 9.5, PARAPET = 12.1;    // outer walls and their parapet
const AO = 24.85, TH = 1.3;          // outer octagon: apothem of the outer face, wall thickness
const AC = AO - TH / 2;              // centre line of the outer walls
const AA = 16.9;                     // octagonal arcade (apothem of its centre line)
const RC = 10.9;                     // circular arcade (column axes)
const RD = 10.22, RDO = 11.4;        // drum: inner and outer radius
const SPR = 20.5;                    // springing of the dome
const CEIL = 9.6;                    // ambulatory ceilings

/** Frame of the k-th side of a regular octagon whose sides face the cardinal points (k = 0: east, 2: south…). */
function side(k, a) {
  const th = k * 45 * D2R, L = 2 * a * T22;
  const c = [a * Math.cos(th), a * Math.sin(th)], u = [-Math.sin(th), Math.cos(th)];
  return { o: [c[0] - u[0] * L / 2, c[1] - u[1] * L / 2], u, L, c, n: [Math.cos(th), Math.sin(th)] };
}

// ── the platform, its stairs, the esplanade below ────────────────────────────
add({ t: 'block', rect: [-70, -60, 70, 60], y0: -P, y1: 0, mat: 'limestone', walk: true });
add({ t: 'floor', rect: [-70, -60, 70, 60], y: 0, mat: 'travertine', th: 0.3 });
add({ t: 'stair', rect: [-77.5, -6, -70, 6], dir: 'e', y0: -P, y1: 0, riser: 0.167, mat: 'limestone' });
add({ t: 'stair', rect: [70, -6, 77.5, 6], dir: 'w', y0: -P, y1: 0, riser: 0.167, mat: 'limestone' });
add({ t: 'stair', rect: [-6, -67.5, 6, -60], dir: 's', y0: -P, y1: 0, riser: 0.167, mat: 'limestone' });
add({ t: 'stair', rect: [-6, 60, 6, 67.5], dir: 'n', y0: -P, y1: 0, riser: 0.167, mat: 'limestone' });
// the marble floor of the shrine, a little above the platform's paving
add({ t: 'ring_slab', c: [0, 0], outer: { n: 8, a: AO }, inner: { n: 0, a: 0.01 }, y0: -0.05, y1: 0.03, mat: 'proconnesian' });

// ── the outer octagon: walls, windows and doors, marble below, mosaic above ──
for (let k = 0; k < 8; k++) {
  const s = side(k, AC), bay = s.L / 7, door = k % 2 === 0;
  const arches = [];
  for (let b = 1; b <= 5; b++) {
    const uc = bay * (b + 0.5);
    if (door && b === 3) arches.push({ uc, r: 1.3, spring: 4.6, sill: 0 });
    else arches.push({ uc, r: 0.7, spring: 7.9, sill: 6.0 });
  }
  const ext = TH / 2 * T22;
  pwall({ o: s.o, u: s.u, th: TH, u0: -ext, u1: s.L + ext, y0: 0, y1: PARAPET, arches, mat: 'limestone' });
  // veneers: outside marble panels to 5.6 m and glass mosaic above; inside marble to the ceiling
  const out = (d) => [s.o[0] + s.n[0] * d, s.o[1] + s.n[1] * d];
  const extO = (TH / 2 + 0.03) * T22;
  pwall({ o: out(TH / 2 + 0.03), u: s.u, th: 0.06, u0: -extO, u1: s.L + extO, y0: 0, y1: 5.6, arches, mat: 'revetment_byz', collide: false });
  pwall({ o: out(TH / 2 + 0.03), u: s.u, th: 0.06, u0: -extO, u1: s.L + extO, y0: 5.6, y1: PARAPET, arches, mat: 'mosaic_green', collide: false });
  pwall({ o: out(-TH / 2 - 0.03), u: s.u, th: 0.06, u0: extO, u1: s.L - extO, y0: 0, y1: CEIL, arches, mat: 'revetment_byz', collide: false });
  if (door) {
    // a porch of four columns before the door
    const [cx, cz] = s.c, [nx, nz] = s.n, [ux, uz] = s.u;
    const pc = (u, d) => [cx + ux * u + nx * d, cz + uz * u + nz * d];
    for (const u of [-3.6, -1.5, 1.5, 3.6]) { const q = pc(u, TH / 2 + 3.0); column(q[0], q[1], 0, 6.2, 0.55, 'marble_column'); }
    const a = pc(-4.4, TH / 2), b = pc(4.4, TH / 2 + 3.6);
    add({ t: 'slab', rect: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])], y0: 6.2, y1: 6.75, mat: 'limestone', holes: [] });
    const dpos = pc(0, -TH / 2 + 0.1);
    obj('doors', dpos[0], dpos[1], 0, { yaw: Math.atan2(nx, nz) + Math.PI, w: 2.5, h: 4.6, th: 0.16, depth: 0 });
  }
}
// the roof over the ambulatories, sloping from behind the parapet up to the drum
add({ t: 'ring_slab', c: [0, 0], outer: { n: 8, a: AC }, inner: { n: 0, a: RDO + 0.05 }, y0: WALL + 0.5, y1: 14.0, slope: true, mat: 'lead' });

// ── the octagonal arcade: 8 piers, 16 columns, 24 arches, tie-beams ─────────
for (let k = 0; k < 8; k++) {
  const s = side(k, AA), bay = (s.L - 1.6) / 3;
  const arches = [0, 1, 2].map((i) => ({ uc: 0.8 + bay * (i + 0.5), r: (bay - 0.7) / 2, spring: 6.2 }));
  pwall({ o: s.o, u: s.u, th: 1.1, u0: 0, u1: s.L, y0: 0, y1: CEIL, arches, arcade: true, noEnds: true, mat: 'mosaic_gold' });
  for (const i of [1, 2]) { const u = 0.8 + bay * i; column(s.o[0] + s.u[0] * u, s.o[1] + s.u[1] * u, 0, 5.9, 0.62, 'marble_dark'); }
  // the pier at the corner where this side begins
  const ang = (k * 45 - 22.5) * D2R, rv = AA / Math.cos(22.5 * D2R);
  const a = [Math.cos(ang) * (rv - 0.95), Math.sin(ang) * (rv - 0.95)], b = [Math.cos(ang) * (rv + 0.95), Math.sin(ang) * (rv + 0.95)];
  add({ t: 'wall', a, b, th: 1.5, y0: 0, y1: 6.2, openings: [], mat: 'revetment_byz' });
  add({ t: 'beam', a: s.o, b: [s.o[0] + s.u[0] * s.L, s.o[1] + s.u[1] * s.L], y: 5.9, w: 0.5, h: 0.3, mat: 'gilt_bronze' });
}

// ── the circular arcade: 4 piers and 12 columns round the Rock, the drum, the dome ──
const slot = (k) => (45 + 22.5 * k) * D2R;
for (let k = 0; k < 16; k++) {
  const a = slot(k), b = slot(k + 1);
  const pa = [Math.cos(a) * RC, Math.sin(a) * RC], pb = [Math.cos(b) * RC, Math.sin(b) * RC];
  const L = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]), u = [(pb[0] - pa[0]) / L, (pb[1] - pa[1]) / L];
  pwall({ o: pa, u, th: 1.2, u0: 0, u1: L, y0: 6.0, y1: 9.2, arches: [{ uc: L / 2, r: (L - 0.8) / 2, spring: 6.0 }], arcade: true, noEnds: true, mat: 'mosaic_gold', collide: false });
  if (k % 4 === 0) {
    const ra = [Math.cos(a) * (RC - 1.1), Math.sin(a) * (RC - 1.1)], rb = [Math.cos(a) * (RC + 1.1), Math.sin(a) * (RC + 1.1)];
    add({ t: 'wall', a: ra, b: rb, th: 1.6, y0: 0, y1: 6.0, openings: [], mat: 'revetment_byz' });
  } else column(pa[0], pa[1], 0, 5.6, 0.62, 'giallo');
  // a low wooden screen between the supports, round the Rock
  const q0 = [pa[0] + u[0] * (k % 4 === 0 ? 0.85 : 0.4), pa[1] + u[1] * (k % 4 === 0 ? 0.85 : 0.4)];
  const q1 = [pb[0] - u[0] * ((k + 1) % 4 === 0 ? 0.85 : 0.4), pb[1] - u[1] * ((k + 1) % 4 === 0 ? 0.85 : 0.4)];
  obj('screen', 0, 0, 0, { a: q0, b: q1, h: 1.4 });
}
add({ t: 'arc_wall', c: [0, 0], r0: RC - 0.25, r1: RC + 0.25, a0: 0, a1: 360, y0: 5.6, y1: 5.9, mat: 'gilt_bronze', collide: false, step: 3 });
add({ t: 'arc_wall', c: [0, 0], r0: RD, r1: RDO, a0: 0, a1: 360, y0: 9.2, y1: SPR, mat: 'mosaic_gold', collide: false, step: 3,
  gaps: Array.from({ length: 16 }, (_, k) => ({ a: 11.25 + 22.5 * k, w: 1.3, y0: 15.6, y1: 19.0 })) });
add({ t: 'arc_wall', c: [0, 0], r0: RDO - 0.05, r1: RDO + 0.45, a0: 0, a1: 360, y0: SPR - 0.5, y1: SPR + 0.2, mat: 'limestone', collide: false, step: 3 });
// the dome: inner shell (gilded), outer shell (gilded metal over timber), finial
const shell = (R, H, n = 14) => { const p = []; for (let i = 0; i <= n; i++) { const t = (i / n) * Math.PI / 2; p.push([R * Math.cos(t) + 0.0001, H * Math.pow(Math.sin(t), 0.9)]); } p.push([0.0001, H + 0.5]); return p; };
add({ t: 'lathe_shell', c: [0, 0], y: SPR, profile: shell(RD, 10.5), seg: 96, inward: true, mat: 'mosaic_gold' });
add({ t: 'lathe_shell', c: [0, 0], y: SPR, profile: shell(RDO + 0.2, 14.4), seg: 96, inward: false, mat: 'gold' });
add({ t: 'lathe_shell', c: [0, 0], y: SPR + 14.85, profile: [[0.3, 0], [0.15, 0.6], [0.38, 0.95], [0.12, 1.3], [0.05, 2.2], [0.0001, 2.3]], seg: 16, mat: 'gold' });

// ── the ceilings of the two ambulatories ─────────────────────────────────────
add({ t: 'ring_slab', c: [0, 0], outer: { n: 8, a: AO - TH }, inner: { n: 8, a: AA + 0.55 }, y0: CEIL, y1: CEIL + 0.3, mat: 'ceiling_painted' });
add({ t: 'ring_slab', c: [0, 0], outer: { n: 8, a: AA - 0.55 }, inner: { n: 0, a: RDO - 0.1 }, y0: CEIL - 0.4, y1: CEIL - 0.1, mat: 'ceiling_painted' });

// ── the Rock ─────────────────────────────────────────────────────────────────
obj('rock', 0, 0, 0, { rx: 6.4, rz: 8.6, h: 1.5 });

// ── the Dome of the Chain, east of the shrine ────────────────────────────────
{
  const cx = 58, cz = 0, RO = 6.4, RI = 3.2, H0 = 3.6;
  const ring = (r, n, a0) => Array.from({ length: n }, (_, k) => { const a = (a0 + 360 * k / n) * D2R; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; });
  const outer = ring(RO, 11, 90 - 360 / 22), inner = ring(RI, 6, 0);
  for (const [pts, top] of [[outer, 5.0], [inner, 5.6]]) {
    for (let k = 0; k < pts.length; k++) {
      const pa = pts[k], pb = pts[(k + 1) % pts.length];
      const L = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]), u = [(pb[0] - pa[0]) / L, (pb[1] - pa[1]) / L];
      pwall({ o: pa, u, th: 0.6, u0: 0, u1: L, y0: H0, y1: top, arches: [{ uc: L / 2, r: (L - 0.5) / 2, spring: H0 }], arcade: true, noEnds: true, mat: 'limestone', collide: false });
      column(pa[0], pa[1], 0, H0, 0.36, 'marble_dark');
    }
  }
  add({ t: 'ring_slab', c: [cx, cz], outer: { n: 0, a: RO + 0.4 }, inner: { n: 6, a: RI * Math.cos(30 * D2R) + 0.3, rot: 30 }, y0: 5.0, y1: 5.35, mat: 'lead' });
  // the hexagonal drum and the dome
  for (let k = 0; k < 6; k++) {
    const pa = inner[k], pb = inner[(k + 1) % 6];
    const L = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]), u = [(pb[0] - pa[0]) / L, (pb[1] - pa[1]) / L];
    pwall({ o: pa, u, th: 0.6, u0: -0.2, u1: L + 0.2, y0: 5.6, y1: 8.8, mat: 'mosaic_gold', collide: false });
  }
  add({ t: 'sphere', c: [cx, 8.8, cz], R: 3.0, segA: 64, segE: 16, mat: 'mosaic_gold', outer: { t: 0.4, mat: 'lead' } });
  obj('mihrab', cx, cz + RO * Math.cos(Math.PI / 11) - 0.75, 0, { w: 1.3, h: 2.6, d: 0.45 });
}

// ── rooms and walks ──────────────────────────────────────────────────────────
const room = (id, rect, y, kind) => ({ id, rect, y, kind });
const rooms = [
  room('esplanade', [-140, -20, -90, 20], -P, 'open'),
  room('platform', [-60, -50, -40, 50], 0, 'open'),
  room('outer-ambulatory', [-22.5, -3, -18.5, 3], 0, 'hall'),
  room('inner-ambulatory', [-15.5, -3, -12.5, 3], 0, 'hall'),
  room('dome-of-the-chain', [50, -2, 53, 2], 0, 'open'),
];
const oct = (r) => Array.from({ length: 9 }, (_, k) => { const a = (180 + 22.5 + 45 * k) * D2R; return [Math.cos(a) * r, Math.sin(a) * r]; });
const walks = [
  // from the esplanade up the west stairs, through the porch and the west door, round the inner ambulatory
  [[-140, 0], [-90, 0], [-72, 0], [-60, 0], [-30, 0], [-25.5, 0], [-21, 0], [-14, 0], ...oct(14.3), [-14, 0]],
  // round the outer ambulatory
  [[-21, 0], ...oct(21.5), [-21, 0]],
  // out by the east door to the Dome of the Chain
  [[21, 0], [26, 0], [32, 0], [45, 0], [52.5, 0]],
];
walks[0].y0 = -P; walks[1].y0 = 0; walks[2].y0 = 0;

export const domeOfTheRock = {
  id: 'dome-of-the-rock',
  name: { en: 'The Dome of the Rock, Jerusalem', zh: '耶路撒冷圆顶清真寺（岩石圆顶）' },
  era: { en: 'Umayyad, AD 691/92', zh: '倭马亚王朝，公元691/692年' },
  style: 'islamic',
  district: 'levant',
  ...SITES['dome-of-the-rock'],
  base: SITES['dome-of-the-rock'].base + P,
  entrance: { at: [-140, 0], y: -P, facing: 'e' },
  bounds: [-150, -120, 150, 120],
  bakeBounds: [-28, -28, 28, 28],
  bakeTop: 37,
  bakeSpacing: 1.5,
  elements: E,
  rooms,
  walks,
};

export default domeOfTheRock;
