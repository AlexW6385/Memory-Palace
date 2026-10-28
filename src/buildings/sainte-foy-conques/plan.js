// Sainte-Foy de Conques, as completed about 1120 — plan data from
// docs/buildings/sainte-foy-conques.md (§4). Local coordinates: origin on the axis at the outer
// face of the west front, +x east (the chevet), +z south (the cloister); y = 0 at the floor of the
// nave and the terrace. Metres.

import { SITES } from '../../world/regions.js';

const E = [];
const add = (o) => (E.push(o), o);
const pwall = (o) => add({ t: 'planar_wall', ...o });
const floor = (rect, y, mat, extra = {}) => add({ t: 'floor', rect, y, mat, ...extra });
const D2R = Math.PI / 180;

// ── the grid ─────────────────────────────────────────────────────────────────
const HN = 3.4;                      // half the nave's clear width
const PZ = 4.05, PS = 0.65;          // the arcade piers' centre line and half-size
const AI = PZ + PS, AO = 8.5;        // aisle: from the piers' outer face to the outer wall's inner face
const WT = 1.2, WZ = AO + WT;        // outer walls
const XW = 3.0;                      // inner face of the west front
const NAVE_P = [6.48, 9.96, 13.44, 16.92, 20.4];     // nave piers (five bays)
const XC0 = 24.15, XC1 = 32.25;      // the crossing piers' centre lines (crossing clear 24.8–31.6)
const XM = (XC0 + XC1) / 2;          // the crossing's centre
const TW0 = 19.45, TW1 = 20.65;      // transept west wall (outer, inner face)
const TE0 = 35.6, TE1 = 36.8;        // transept east wall (inner, outer face)
const ARM = [8.1, 12.15];            // the arms' piers (both arms, ±z)
const TZ = 16.2, TZO = 17.4;         // the arms' end walls (inner, outer face)
const CH_P = [36.25];                // choir pier between the two straight bays
const XH = 40.6;                     // centre of the hemicycle
const RH = PZ;                       // hemicycle columns' radius
const RA = AO, RAO = WZ;             // ambulatory outer wall (inner, outer radius)
const CHAPELS = [-60, 0, 60], RCH = 10.3, rch = 1.8;
const APSIDIOLE_Z = 13.0;

// heights
const ARC_SPR = 6.9, AISLE_SPR = 8.6, AISLE_CROWN = 10.5, TRIB = 10.9;
const TRIB_SPR = 14.5, VSPR = 18.7, VCROWN = 22.1, EAVE = 23.2, RIDGE = 27.5;
const OUT = 15.5;                    // top of the outer walls (under the tribunes' lean-to roofs)
const RED = 7.6;                     // red sandstone below, yellow limestone above

const bays = (P, from) => { const out = []; let a = from; for (const p of P) { out.push([a, p - PS]); a = p + PS; } return out; };

// ── the terrace, the floors ──────────────────────────────────────────────────
floor([-14, -9, 0, 9], 0, 'flagstone', { th: 0.4 });                         // the parvis
floor([0, -9.7, 53.5, 9.7], 0, 'flagstone', { th: 0.4 });                     // nave, crossing, choir, ambulatory
floor([19.45, -17.4, 39.5, 17.4], 0, 'flagstone', { th: 0.4 });               // the transept and its apsidioles
for (const a of [-60, 60]) {                                                  // the side chapels beyond
  const cx = 40.6 + Math.cos(a * D2R) * 10.3, cz = Math.sin(a * D2R) * 10.3;
  floor([cx - 2.8, cz - 2.8, cx + 2.8, cz + 2.8], 0, 'flagstone', { th: 0.4 });
}

// ── the nave: piers, arcades, tribunes, the barrel vault ─────────────────────
for (const sz of [-1, 1]) {
  const z = sz * PZ;
  for (const x of NAVE_P) add({ t: 'pier', at: [x, z], s: PS, hr: 0.24, y0: 0, cap: ARC_SPR, y1: ARC_SPR, mat: 'limestone_yellow', baseMat: 'sandstone_red', capMat: 'limestone_yellow' });
  // the tall half-column on the nave face of each pier, up to the springing of the transverse arch
  for (const x of NAVE_P.slice(0, 4)) add({ t: 'column', at: [x, sz * (HN + 0.05)], y: 0.4, h: VSPR - 0.4, d: 0.5, mat: 'limestone_yellow', collide: false });
  const arc = bays(NAVE_P, XW).map(([a, b]) => ({ uc: (a + b) / 2, r: (b - a) / 2, spring: ARC_SPR, sill: 0 }));
  pwall({ o: [0, z], u: [1, 0], th: 2 * PS, u0: XW, u1: NAVE_P[4] + PS, y0: 0, y1: TRIB, arches: arc, arcade: true, mat: 'limestone_yellow', collide: false });
  // the tribunes' twin openings to the nave, and the wall above to the eaves
  const twin = bays(NAVE_P, XW).flatMap(([a, b]) => { const c = (a + b) / 2; return [{ uc: c - 0.68, r: 0.58, spring: 13.4, sill: 11.8 }, { uc: c + 0.68, r: 0.58, spring: 13.4, sill: 11.8 }]; });
  pwall({ o: [0, z], u: [1, 0], th: 2 * PS, u0: XW, u1: XC0 - PS, y0: TRIB, y1: EAVE, arches: twin, mat: 'limestone_yellow', collide: false });
  // the aisle's barrel vault, the tribune floor over it, the tribune's half-barrel
  add({ t: 'barrel', axis: 'x', s0: XW, s1: TW1 + 2.85, c: sz * (AI + AO) / 2, y: AISLE_SPR, r: (AO - AI) / 2, th: 0.4, mat: 'limestone_yellow' });
  add({ t: 'slab', rect: [XW, sz * AI, TW1, sz * AO], y0: AISLE_CROWN + 0.4, y1: TRIB, mat: 'limestone_yellow' });
  add({ t: 'barrel', axis: 'x', s0: XW, s1: TW0, c: sz * AI, y: TRIB_SPR, r: AO - AI, th: 0.4, a0: sz > 0 ? 0 : 90, a1: sz > 0 ? 90 : 180, mat: 'limestone_yellow' });
  // the outer wall: red sandstone below with the aisle windows, yellow limestone above with the
  // tribune windows; the door to the cloister in the south aisle
  const wz = sz * (AO + WT / 2);
  const aisleWin = bays(NAVE_P, XW).map(([a, b]) => ({ uc: (a + b) / 2, r: 0.62, spring: 5.0, sill: 3.0 }));
  const tribWin = bays(NAVE_P, XW).map(([a, b]) => ({ uc: (a + b) / 2, r: 0.55, spring: 13.2, sill: 11.4 }));
  const lowArches = sz > 0 ? aisleWin.map((w, i) => (i === 1 ? { uc: w.uc, r: 0.9, spring: 2.6, sill: 0 } : w)) : aisleWin;
  pwall({ o: [0, wz], u: [1, 0], th: WT, u0: 0, u1: TW0, y0: 0, y1: RED, arches: lowArches, mat: 'sandstone_red' });
  pwall({ o: [0, wz], u: [1, 0], th: WT, u0: 0, u1: TW0, y0: RED, y1: OUT, arches: tribWin, mat: 'limestone_yellow', collide: false });
  // buttresses (flat pilaster strips) on the outer wall between the bays
  for (const x of NAVE_P.slice(0, 4)) add({ t: 'block', rect: [x - 0.5, Math.min(sz * WZ, sz * (WZ + 0.5)), x + 0.5, Math.max(sz * WZ, sz * (WZ + 0.5))], y0: 0, y1: OUT - 0.4, mat: 'sandstone_red' });
  // the lean-to roofs over aisle and tribune
  add({ t: 'lean_roof', rect: [1.5, Math.min(sz * (AI - 0.1), sz * (WZ + 0.6)), TW0, Math.max(sz * (AI - 0.1), sz * (WZ + 0.6))], low: sz > 0 ? 's' : 'n', y0: OUT, y1: 19.2 });
}
// transverse arches under the nave vault, at each pier
for (const x of NAVE_P.slice(0, 4)) add({ t: 'arch_band', c: [x, VSPR, 0], span: 'z', r0: HN - 0.35, r1: HN + 0.1, d0: x - 0.32, d1: x + 0.32, mat: 'limestone_yellow' });
add({ t: 'barrel', axis: 'x', s0: XW - 0.2, s1: XC0 - PS, c: 0, y: VSPR, r: HN, th: 0.6, mat: 'limestone_yellow' });

// ── the west front: the portal and its tympanum, two windows, the gable, the towers ─
const FRONT = [-WZ, WZ];
pwall({ o: [0.75, FRONT[0]], u: [0, 1], th: 1.5, u0: 0, u1: 2 * WZ, y0: 0, y1: RED, arches: [{ uc: WZ, r: 4.4, spring: 4.85, sill: 0 }], mat: 'sandstone_red' });
pwall({ o: [0.75, FRONT[0]], u: [0, 1], th: 1.5, u0: 0, u1: 2 * WZ, y0: RED, y1: EAVE, arches: [{ uc: WZ, r: 4.4, spring: 4.85, sill: RED }, { uc: WZ - 1.1, r: 0.55, spring: 14.2, sill: 12.2 }, { uc: WZ + 1.1, r: 0.55, spring: 14.2, sill: 12.2 }], mat: 'limestone_yellow', collide: false });
pwall({ o: [2.25, FRONT[0]], u: [0, 1], th: 1.5, u0: 0, u1: 2 * WZ, y0: 0, y1: EAVE, holes: [{ u0: WZ - 1.5, u1: WZ + 1.5, y0: 0, y1: 4.6 }], arches: [{ uc: WZ - 1.1, r: 0.55, spring: 14.2, sill: 12.2 }, { uc: WZ + 1.1, r: 0.55, spring: 14.2, sill: 12.2 }], mat: 'limestone_yellow' });
// the jambs of the portal, stepping in to the door
for (const sz of [-1, 1]) add({ t: 'block', rect: [0, Math.min(sz * 1.5, sz * 4.4), 1.5, Math.max(sz * 1.5, sz * 4.4)], y0: 0, y1: 0.01, mat: 'limestone_yellow', collide: false });
for (const sz of [-1, 1]) for (const [z0, x0] of [[3.35, 0.35], [2.4, 0.9]]) add({ t: 'block', rect: [x0, Math.min(sz * z0, sz * 4.4), 1.5, Math.max(sz * z0, sz * 4.4)], y0: 0, y1: 4.85, mat: 'sandstone_red' });
add({ t: 'tympanum', x: 1.0, zc: 0, y: 4.6, w: 6.7, h: 3.6 });
add({ t: 'obj', kind: 'doors', at: [2.6, 0], y: 0, yaw: Math.PI / 2, w: 3.0, h: 4.6, th: 0.12, depth: 0 });
add({ t: 'gable_roof', x0: 1.5, x1: XC0 - PS, z0: -AI - 0.25, z1: AI + 0.25, y: EAVE, ridge: RIDGE, ends: false });
add({ t: 'block', rect: [0, -AI, 1.5, AI], y0: EAVE, y1: EAVE + 0.01, mat: 'limestone_yellow', collide: false });
// the gable of the west front, in stone
{
  const tri = [];
  for (let k = 0; k < 8; k++) {
    const h0 = EAVE + (RIDGE - EAVE) * k / 8, h1 = EAVE + (RIDGE - EAVE) * (k + 1) / 8, w = AI * (1 - (k + 0.5) / 8);
    tri.push({ t: 'block', rect: [0, -w, 1.5, w], y0: h0, y1: h1, mat: 'limestone_yellow', collide: false });
  }
  tri.forEach(add);
}
// the two west towers over the aisles' first bays, with belfry openings and stone pyramids
for (const sz of [-1, 1]) {
  const zc = sz * 6.7, h = 3.0, y0 = OUT, y1 = 30.0;
  for (const [o, u, L] of [[[0, zc - h], [0, 1], 2 * h], [[2 * h, zc - h], [0, 1], 2 * h], [[0, zc - h], [1, 0], 2 * h], [[0, zc + h], [1, 0], 2 * h]]) {
    const off = (u[0] === 0) ? [o[0] + (o[0] === 0 ? 0.5 : -0.5), o[1]] : [o[0], o[1] + (o[1] < zc ? 0.5 : -0.5)];
    pwall({ o: off, u, th: 1.0, u0: 0, u1: L, y0, y1, arches: [{ uc: L / 2 - 0.75, r: 0.55, spring: 26.6, sill: 25.0 }, { uc: L / 2 + 0.75, r: 0.55, spring: 26.6, sill: 25.0 }], mat: 'limestone_yellow', collide: false });
  }
  add({ t: 'pyramid_roof', c: [h, zc], r: h * Math.SQRT2 + 0.5, y: y1, apex: y1 + 4.2 });
}

// ── the crossing: its four great arches, the squinches, the octagonal drum and dome, the lantern ─
for (const sz of [-1, 1]) for (const x of [XC0, XC1]) add({ t: 'pier', at: [x, sz * PZ], s: PS, hr: 0.26, y0: 0, cap: ARC_SPR, y1: VSPR, mat: 'limestone_yellow', baseMat: 'sandstone_red', capMat: 'limestone_yellow' });
for (const x of [XC0, XC1]) add({ t: 'arch_band', c: [x, VSPR, 0], span: 'z', r0: HN, r1: HN + 0.65, d0: x - PS, d1: x + PS, mat: 'limestone_yellow' });
for (const sz of [-1, 1]) add({ t: 'arch_band', c: [XM, VSPR, sz * PZ], span: 'x', r0: HN, r1: HN + 0.65, d0: sz * PZ - PS, d1: sz * PZ + PS, mat: 'limestone_yellow' });
// the walls of the crossing square over the arches, up to the octagon
for (const sz of [-1, 1]) {
  pwall({ o: [XC0 - PS, sz * PZ], u: [1, 0], th: 2 * PS, u0: 0, u1: XC1 - XC0 + 2 * PS, y0: VSPR, y1: 22.4, outline: null, arches: [{ uc: (XC1 - XC0) / 2 + PS, r: HN, spring: VSPR, sill: VSPR }], mat: 'limestone_yellow', collide: false });
  pwall({ o: [sz > 0 ? XC1 : XC0, -PZ - PS], u: [0, 1], th: 2 * PS, u0: 0, u1: 2 * (PZ + PS), y0: VSPR, y1: 22.4, arches: [{ uc: PZ + PS, r: HN, spring: VSPR, sill: VSPR }], mat: 'limestone_yellow', collide: false });
}
// squinches: a half-cone in each corner carrying the octagon
for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
  const cx = XM + sx * HN, cz = sz * HN, a = Math.atan2(-sz, -sx) / D2R;
  add({ t: 'sphere', c: [cx, 21.0, cz], R: 1.4, a0: a - 45, a1: a + 45, e0: 0, e1: 90, segA: 12, segE: 8, mat: 'limestone_yellow' });
}
const RO8 = HN / Math.cos(22.5 * D2R);
add({ t: 'arc_wall', c: [XM, 0], r0: RO8, r1: RO8 + 1.0, a0: 22.5, a1: 382.5, y0: 22.4, y1: 31.0, step: 45, mat: 'limestone_yellow', collide: false,
  gaps: [45, 90, 135, 180, 225, 270, 315, 360].map((a) => ({ a, w: 1.3, y0: 22.6, y1: 24.6 })) });
{
  const Rs = (RO8 * RO8 + 1.5 * 1.5) / (2 * 1.5), cy = 26.4 - Rs, e0 = Math.asin((24.9 - cy) / Rs) / D2R;
  add({ t: 'sphere', c: [XM, cy, 0], R: Rs, e0, e1: 90, segA: 48, segE: 12, mat: 'limestone_yellow', outer: { t: 0.35, mat: 'limestone_yellow' } });
}
add({ t: 'pyramid_roof', c: [XM, 0], r: (RO8 + 1.3) / Math.cos(22.5 * D2R), sides: 8, rot: 22.5, y: 31.0, apex: 36.0 });

// ── the transept: arms with aisles and tribunes, the end walls, the apsidioles ─
for (const sz of [-1, 1]) {
  // the arms' piers and arcades (west and east lines), the tribunes' twin openings above
  for (const x of [XC0, XC1]) {
    for (const z of ARM) add({ t: 'pier', at: [x, sz * z], s: PS, hr: 0.24, y0: 0, cap: ARC_SPR, y1: ARC_SPR, mat: 'limestone_yellow', baseMat: 'sandstone_red', capMat: 'limestone_yellow' });
    const P = [PZ, ...ARM];
    const arm = [[P[0] + PS, P[1] - PS], [P[1] + PS, P[2] - PS], [P[2] + PS, TZ]];
    const o = [x, sz > 0 ? 0 : 0], u = [0, sz];
    pwall({ o, u, th: 2 * PS, u0: PZ, u1: TZ, y0: 0, y1: TRIB, arches: arm.map(([a, b]) => ({ uc: (a + b) / 2, r: Math.min(1.45, (b - a) / 2), spring: ARC_SPR, sill: 0 })), arcade: true, mat: 'limestone_yellow', collide: false });
    pwall({ o, u, th: 2 * PS, u0: PZ + PS, u1: TZ, y0: TRIB, y1: EAVE, arches: arm.flatMap(([a, b]) => { const c = (a + b) / 2; return [{ uc: c - 0.68, r: 0.58, spring: 13.4, sill: 11.8 }, { uc: c + 0.68, r: 0.58, spring: 13.4, sill: 11.8 }]; }), mat: 'limestone_yellow', collide: false });
  }
  // the arm's barrel vault, at the nave's height
  add({ t: 'barrel', axis: 'z', s0: sz * (PZ + PS), s1: sz * (TZ + 0.3), c: XM, y: VSPR, r: HN, th: 0.6, mat: 'limestone_yellow' });
  // the arm's aisles: west (x 20.65–23.5) and east (32.9–35.6), barrels along z, tribune floors, half-barrels
  for (const [xi, xo, side] of [[XC0 - PS, TW1, -1], [XC1 + PS, TE0, 1]]) {
    const w = Math.abs(xi - xo), cx = (xi + xo) / 2, z0 = sz * AO, z1 = sz * TZ;
    add({ t: 'barrel', axis: 'z', s0: z0, s1: z1, c: cx, y: AISLE_CROWN - w / 2, r: w / 2, th: 0.4, mat: 'limestone_yellow' });
    add({ t: 'slab', rect: [Math.min(xi, xo), Math.min(z0, z1), Math.max(xi, xo), Math.max(z0, z1)], y0: AISLE_CROWN + 0.4, y1: TRIB, mat: 'limestone_yellow' });
    add({ t: 'barrel', axis: 'z', s0: sz * AI, s1: z1, c: xi, y: TRIB_SPR, r: w, th: 0.4, a0: side > 0 ? 0 : 90, a1: side > 0 ? 90 : 180, mat: 'limestone_yellow' });
  }
  // the west wall of the arm (from the nave's outer wall to the end), with its windows
  const wz0 = sz * AO, wz1 = sz * TZO, uW = [0, sz];
  const armWin = (y) => [{ uc: 12.6, r: 0.5, spring: y + 1.2, sill: y }, { uc: 15.0, r: 0.5, spring: y + 1.2, sill: y }];
  pwall({ o: [(TW0 + TW1) / 2, 0], u: uW, th: WT, u0: AO, u1: TZO, y0: 0, y1: RED, arches: armWin(3.4), mat: 'sandstone_red' });
  pwall({ o: [(TW0 + TW1) / 2, 0], u: uW, th: WT, u0: AO, u1: TZO, y0: RED, y1: OUT, arches: armWin(11.6), mat: 'limestone_yellow', collide: false });
  // the east wall, opening into the apsidiole
  pwall({ o: [(TE0 + TE1) / 2, 0], u: uW, th: WT, u0: AO, u1: TZO, y0: 0, y1: RED, arches: [{ uc: APSIDIOLE_Z, r: 1.7, spring: 3.8, sill: 0 }], mat: 'sandstone_red' });
  pwall({ o: [(TE0 + TE1) / 2, 0], u: uW, th: WT, u0: AO, u1: TZO, y0: RED, y1: OUT, arches: [{ uc: APSIDIOLE_Z, r: 0.5, spring: 12.8, sill: 11.6 }], mat: 'limestone_yellow', collide: false });
  // the end wall: windows below and in the tribune, an oculus high in the gable wall
  const ez = sz * (TZ + WT / 2);
  const endWin = [[XC0 - PS - 1.4, 3.4], [XM - 1.2, 3.4], [XM + 1.2, 3.4], [XC1 + PS + 1.4, 3.4]];
  pwall({ o: [TW0, ez], u: [1, 0], th: WT, u0: 0, u1: TE1 - TW0, y0: 0, y1: RED, arches: endWin.map(([x, s]) => ({ uc: x - TW0, r: 0.5, spring: s + 1.2, sill: s })), mat: 'sandstone_red' });
  pwall({ o: [TW0, ez], u: [1, 0], th: WT, u0: 0, u1: TE1 - TW0, y0: RED, y1: EAVE, arches: [[XC0 - PS - 1.4], [XC1 + PS + 1.4], [XM - 1.0], [XM + 1.0]].map(([x]) => ({ uc: x - TW0, r: 0.45, spring: 13.0, sill: 11.6 })), circles: [{ uc: XM - TW0, yc: 19.0, r: 1.1 }], mat: 'limestone_yellow', collide: false });
  // the gable of the end wall
  for (let k = 0; k < 8; k++) {
    const h0 = EAVE + (RIDGE - EAVE) * k / 8, h1 = EAVE + (RIDGE - EAVE) * (k + 1) / 8, w = (HN + 1.3) * (1 - (k + 0.5) / 8);
    add({ t: 'block', rect: [XM - w, Math.min(ez - WT / 2, ez + WT / 2), XM + w, Math.max(ez - WT / 2, ez + WT / 2)], y0: h0, y1: h1, mat: 'limestone_yellow', collide: false });
  }
  // the arm's roof (ridge north–south), and the lean-tos over its aisles
  add({ t: 'gable_roof', axis: 'z', x0: XC0 - PS - 0.25, x1: XC1 + PS + 0.25, z0: Math.min(sz * (PZ + PS + 1.0), sz * (TZO + 0.3)), z1: Math.max(sz * (PZ + PS + 1.0), sz * (TZO + 0.3)), y: EAVE, ridge: RIDGE, ends: false });
  add({ t: 'lean_roof', rect: [TW0 - 0.6, Math.min(sz * WZ, sz * (TZO + 0.3)), XC0 - PS + 0.1, Math.max(sz * WZ, sz * (TZO + 0.3))], low: 'w', y0: OUT, y1: 19.2 });
  add({ t: 'lean_roof', rect: [XC1 + PS - 0.1, Math.min(sz * WZ, sz * (TZO + 0.3)), TE1 + 0.6, Math.max(sz * WZ, sz * (TZO + 0.3))], low: 'e', y0: OUT, y1: 19.2 });
  // the apsidiole off the east aisle
  const ac = [TE1, sz * APSIDIOLE_Z];
  add({ t: 'arc_wall', c: ac, r0: rch, r1: rch + 0.8, a0: -90, a1: 90, y0: 0, y1: 6.8, mat: 'sandstone_red', gaps: [{ a: 0, w: 0.6, y0: 2.6, y1: 4.2 }] });
  add({ t: 'sphere', c: [ac[0], 4.8, ac[1]], R: rch, a0: -90, a1: 90, e0: 0, e1: 90, segA: 24, segE: 10, mat: 'limestone_yellow', outer: { t: 0.5, mat: 'limestone_yellow' } });
  add({ t: 'cone_roof', c: ac, R: rch + 1.1, a0: -90, a1: 90, y: 6.8, apex: 8.9 });
  add({ t: 'block', rect: [TE1 + 0.6, sz * APSIDIOLE_Z - 0.6, TE1 + 1.5, sz * APSIDIOLE_Z + 0.6], y0: 0, y1: 1.0, mat: 'limestone_yellow' });
}
// the outer walls of the nave aisles meet the arms: close the corner above the aisle roofs
for (const sz of [-1, 1]) add({ t: 'block', rect: [TW0, Math.min(sz * AO, sz * WZ), TW1, Math.max(sz * AO, sz * WZ)], y0: 0, y1: OUT, mat: 'sandstone_red' });

// ── the choir: two straight bays, the hemicycle, the ambulatory, three chapels ─
for (const sz of [-1, 1]) {
  for (const x of [...CH_P, XH]) add({ t: 'pier', at: [x, sz * PZ], s: PS, hr: 0.24, y0: 0, cap: ARC_SPR, y1: ARC_SPR, mat: 'limestone_yellow', baseMat: 'sandstone_red', capMat: 'limestone_yellow' });
  const P = [XC1, ...CH_P, XH];
  const arc = [[P[0] + PS, P[1] - PS], [P[1] + PS, P[2] - PS]].map(([a, b]) => ({ uc: (a + b) / 2, r: (b - a) / 2, spring: ARC_SPR, sill: 0 }));
  pwall({ o: [0, sz * PZ], u: [1, 0], th: 2 * PS, u0: XC1 + PS, u1: XH + PS, y0: 0, y1: 13.0, arches: arc, arcade: true, mat: 'limestone_yellow', collide: false });
  // above the ambulatory's roof, the choir's clerestory
  pwall({ o: [0, sz * PZ], u: [1, 0], th: 2 * PS, u0: XC1 + PS, u1: XH, y0: 13.0, y1: EAVE, arches: [{ uc: (P[1] + P[2]) / 2, r: 0.5, spring: 16.2, sill: 14.4 }, { uc: (P[0] + P[1]) / 2, r: 0.5, spring: 16.2, sill: 14.4 }], mat: 'limestone_yellow', collide: false });
  // the choir aisles: barrel vaults, the outer wall east of the transept
  add({ t: 'barrel', axis: 'x', s0: XC1 + PS, s1: XH, c: sz * (AI + AO) / 2, y: AISLE_SPR, r: (AO - AI) / 2, th: 0.4, mat: 'limestone_yellow' });
  pwall({ o: [0, sz * (AO + WT / 2)], u: [1, 0], th: WT, u0: TE1, u1: XH, y0: 0, y1: 11.0, arches: [{ uc: (TE1 + XH) / 2, r: 0.5, spring: 4.6, sill: 3.4 }], mat: 'sandstone_red' });
  add({ t: 'lean_roof', rect: [TE1, Math.min(sz * (AI - 0.1), sz * (WZ + 0.6)), XH, Math.max(sz * (AI - 0.1), sz * (WZ + 0.6))], low: sz > 0 ? 's' : 'n', y0: 11.0, y1: 13.2 });
}
add({ t: 'barrel', axis: 'x', s0: XC1 + PS, s1: XH, c: 0, y: VSPR, r: HN, th: 0.6, mat: 'limestone_yellow' });
add({ t: 'arch_band', c: [CH_P[0], VSPR, 0], span: 'z', r0: HN - 0.35, r1: HN + 0.1, d0: CH_P[0] - 0.32, d1: CH_P[0] + 0.32, mat: 'limestone_yellow' });
add({ t: 'gable_roof', x0: XC1 + PS - 0.2, x1: XH, z0: -AI - 0.25, z1: AI + 0.25, y: EAVE, ridge: RIDGE, ends: false });
// the hemicycle: five columns, the wall above with the clerestory, the half-dome
for (const a of [-60, -30, 0, 30, 60]) add({ t: 'column', at: [XH + Math.cos(a * D2R) * RH, Math.sin(a * D2R) * RH], y: 0, h: ARC_SPR, d: 0.7, mat: 'limestone_yellow' });
add({ t: 'arc_wall', c: [XH, 0], r0: RH - 0.4, r1: RH + 0.45, a0: -90, a1: 90, y0: ARC_SPR, y1: EAVE, step: 6, mat: 'limestone_yellow', collide: false,
  gaps: [-45, -15, 15, 45].map((a) => ({ a, w: 0.9, y0: 14.4, y1: 16.6 })) });
add({ t: 'sphere', c: [XH, VSPR, 0], R: RH - 0.4, a0: -90, a1: 90, e0: 0, e1: 90, segA: 32, segE: 12, mat: 'limestone_yellow', outer: { t: 0.6, mat: 'limestone_yellow' } });
add({ t: 'cone_roof', c: [XH, 0], R: RH + 0.9, a0: -90, a1: 90, y: EAVE, apex: RIDGE });
// the ambulatory: its outer wall with the chapels' openings and windows, its vault, its roof
add({ t: 'arc_wall', c: [XH, 0], r0: RA, r1: RAO, a0: -90, a1: 90, y0: 0, y1: 11.0, step: 5, mat: 'sandstone_red',
  gaps: [...CHAPELS.map((a) => ({ a, w: 2.9, y0: 0, y1: 5.6 })), ...[-30, 30].map((a) => ({ a, w: 0.9, y0: 3.4, y1: 5.2 }))] });
add({ t: 'arc_wall', c: [XH, 0], r0: RH + 0.45, r1: RA, a0: -90, a1: 90, y0: 7.6, y1: 8.0, step: 6, mat: 'limestone_yellow', collide: false });
add({ t: 'cone_roof', c: [XH, 0], R: RAO + 0.6, r0: RH + 0.5, a0: -90, a1: 90, y: 11.0, apex: 13.2 });
for (const a of CHAPELS) {
  const cx = XH + Math.cos(a * D2R) * RCH, cz = Math.sin(a * D2R) * RCH;
  add({ t: 'arc_wall', c: [cx, cz], r0: rch, r1: rch + 0.8, a0: a - 90, a1: a + 90, y0: 0, y1: 7.0, step: 10, mat: 'sandstone_red',
    gaps: [-50, 0, 50].map((d) => ({ a: a + d, w: 0.6, y0: 2.6, y1: 4.2 })) });
  // short straight walls joining the chapel to the ambulatory
  for (const s of [-1, 1]) {
    const nx = -Math.sin(a * D2R) * s, nz = Math.cos(a * D2R) * s, ux = Math.cos(a * D2R), uz = Math.sin(a * D2R), rr = rch + 0.4;
    add({ t: 'wall', a: [XH + ux * (RAO - 0.2) + nx * rr, uz * (RAO - 0.2) + nz * rr], b: [cx + nx * rr, cz + nz * rr], th: 0.8, y0: 0, y1: 7.0, mat: 'sandstone_red', openings: [] });
  }
  add({ t: 'sphere', c: [cx, 4.8, cz], R: rch, a0: a - 90, a1: a + 90, e0: 0, e1: 90, segA: 24, segE: 10, mat: 'limestone_yellow', outer: { t: 0.5, mat: 'limestone_yellow' } });
  add({ t: 'slab', rect: [Math.min(XH + Math.cos(a * D2R) * RA, cx) - 0.2, cz - rch, Math.max(XH + Math.cos(a * D2R) * RA, cx) + 0.2, cz + rch], y0: 6.4, y1: 6.8, mat: 'limestone_yellow' });
  add({ t: 'cone_roof', c: [cx, cz], R: rch + 1.1, a0: a - 90, a1: a + 90, y: 7.0, apex: 9.0 });
  add({ t: 'block', rect: [cx + Math.cos(a * D2R) * 0.9 - 0.5, cz + Math.sin(a * D2R) * 0.9 - 0.5, cx + Math.cos(a * D2R) * 0.9 + 0.5, cz + Math.sin(a * D2R) * 0.9 + 0.5], y0: 0, y1: 1.0, mat: 'limestone_yellow' });
}

// ── furnishings: the high altar, the saint, the grilles, lamps ───────────────
add({ t: 'block', rect: [37.6, -1.0, 38.8, 1.0], y0: 0, y1: 1.05, mat: 'limestone_yellow' });
add({ t: 'obj', kind: 'reliquary', at: [XH + 1.2, 0], y: 0 });
for (const sz of [-1, 1]) add({ t: 'grille', a: [XC1 + PS + 0.2, sz * (HN - 0.1)], b: [XH - PS - 0.1, sz * (HN - 0.1)], y0: 0, y1: 2.4 });
// lamps hung in the choir and before the saint, down the nave and in the arms of the transept
for (const [x, z, y] of [[38.2, 0, 4.2], [XH + 1.2, 0, 4.5], [5.2, 0, 5.5], [11.7, 0, 5.5], [18.6, 0, 5.5], [XM, 0, 6.0], [XM, -11, 5.0], [XM, 11, 5.0]]) add({ t: 'lamp', at: [x, y, z], intensity: 6, distance: 12 });
for (const a of CHAPELS) add({ t: 'lamp', at: [XH + Math.cos(a * D2R) * (RCH + 0.6), 2.6, Math.sin(a * D2R) * (RCH + 0.6)], intensity: 3, distance: 6 });
for (const sz of [-1, 1]) add({ t: 'lamp', at: [TE1 + 1.0, 2.6, sz * APSIDIOLE_Z], intensity: 3, distance: 6 });

// ── the cloister of Bégon south of the nave, its basin; the refectory, the chapter house ─
const CL = [0, WZ, TW0, WZ + TW0];              // the cloister square (x0, z0, x1, z1): 19.45 m
const GW = 3.0;                                 // galleries' width
floor([CL[0], CL[1], CL[2], CL[1] + GW], 0.05, 'flagstone', { th: 0.3 });
floor([CL[0], CL[3] - GW, CL[2], CL[3]], 0.05, 'flagstone', { th: 0.3 });
floor([CL[0], CL[1], CL[0] + GW, CL[3]], 0.05, 'flagstone', { th: 0.3 });
floor([CL[2] - GW, CL[1], CL[2], CL[3]], 0.05, 'flagstone', { th: 0.3 });
{
  // arcades of twin round arches on paired columns over a low wall, on the four sides of the garth
  const ix0 = CL[0] + GW, iz0 = CL[1] + GW, ix1 = CL[2] - GW, iz1 = CL[3] - GW;
  const sides = [[[ix0, iz0], [1, 0], ix1 - ix0], [[ix0, iz1], [1, 0], ix1 - ix0], [[ix0, iz0], [0, 1], iz1 - iz0], [[ix1, iz0], [0, 1], iz1 - iz0]];
  for (const [o, u, L] of sides) {
    const n = Math.round(L / 1.35), st = L / n;
    const gap = Math.floor(n / 2);                // an opening into the garth in the middle of each side
    pwall({ o, u, th: 0.5, u0: 0, u1: L, y0: 0, y1: 3.4, arches: Array.from({ length: n }, (_, k) => ({ uc: (k + 0.5) * st, r: st / 2 - 0.12, spring: 2.6, sill: k === gap ? 0 : 0.55 })), arcade: true, mat: 'limestone_yellow', collide: false });
    // the low wall the columns stand on (open in the middle bay), as the obstacle
    for (const [u0, u1] of [[0, gap * st], [(gap + 1) * st, L]]) add({ t: 'wall', a: [o[0] + u[0] * u0, o[1] + u[1] * u0], b: [o[0] + u[0] * u1, o[1] + u[1] * u1], th: 0.5, y0: 0, y1: 0.55, mat: 'limestone_yellow', openings: [] });
    for (let k = 1; k < n; k++) for (const s of [-0.12, 0.12]) add({ t: 'column', at: [o[0] + u[0] * k * st - u[1] * s, o[1] + u[1] * k * st + u[0] * s], y: 0.55, h: 2.05, d: 0.18, mat: 'limestone_yellow', collide: false });
  }
  // the galleries' lean-to roofs
  add({ t: 'lean_roof', rect: [CL[0], CL[1] + 0.1, CL[2], iz0 + 0.4], low: 's', y0: 3.4, y1: 5.2 });
  add({ t: 'lean_roof', rect: [CL[0], iz1 - 0.4, CL[2], CL[3]], low: 'n', y0: 3.4, y1: 5.2 });
  add({ t: 'lean_roof', rect: [CL[0], iz0 + 0.4, ix0 + 0.4, iz1 - 0.4], low: 'e', y0: 3.4, y1: 5.2 });
  add({ t: 'lean_roof', rect: [ix1 - 0.4, iz0 + 0.4, CL[2], iz1 - 0.4], low: 'w', y0: 3.4, y1: 5.2 });
  add({ t: 'obj', kind: 'basin', at: [(CL[0] + CL[2]) / 2, (CL[1] + CL[3]) / 2], y: 0, d: 2.72 });
}
// the outer walls of the cloister: west (toward the parvis, with a door), south (the refectory)
pwall({ o: [CL[0] - 0.35, CL[1]], u: [0, 1], th: 0.7, u0: 0, u1: CL[3] - CL[1], y0: 0, y1: 5.2, holes: [{ u0: 6.0, u1: 7.8, y0: 0, y1: 2.8 }], mat: 'schist_rubble' });
// the refectory (later the treasury) south of the cloister, and the chapter house to the east
add({ t: 'block', rect: [CL[0] - 0.7, CL[3], CL[2], CL[3] + 8.0], y0: 0, y1: 8.5, mat: 'schist_rubble' });
add({ t: 'gable_roof', x0: CL[0] - 1.0, x1: CL[2] + 0.3, z0: CL[3] - 0.3, z1: CL[3] + 8.3, y: 8.5, ridge: 12.0 });
add({ t: 'block', rect: [CL[2], TZO, CL[2] + 11.0, CL[3]], y0: 0, y1: 7.5, mat: 'schist_rubble' });
add({ t: 'gable_roof', axis: 'z', x0: CL[2] - 0.3, x1: CL[2] + 11.3, z0: TZO, z1: CL[3] + 0.3, y: 7.5, ridge: 10.8 });

// ── rooms and walks ──────────────────────────────────────────────────────────
const room = (id, rect, y, kind) => ({ id, rect, y, kind });
const rooms = [
  room('parvis', [-12, -6, -3, 6], 0, 'open'),
  room('nave', [4, -2, 19, 2], 0, 'hall'),
  room('crossing', [26, -2, 30, 2], 0, 'hall'),
  room('north-transept', [26, -15, 30, -6], 0, 'hall'),
  room('south-transept', [26, 6, 30, 15], 0, 'hall'),
  room('choir', [33.5, -2, 39.5, 2], 0, 'sanctuary'),
  room('ambulatory', [XH + 5, -2, XH + 7.5, 2], 0, 'hall'),
  room('cloister', [1, 11, 18, 12.5], 0.05, 'open'),
];
const amb = Array.from({ length: 13 }, (_, k) => { const a = (-90 + 15 * k) * D2R; return [XH + Math.cos(a) * 6.4, Math.sin(a) * 6.4]; });
const walks = [
  // from the parvis through the portal, up the nave to the crossing, into the choir
  [[-12, 0], [-4, 0], [0.5, 0], [3.5, 0], [12, 0], [22, 0], [28.2, 0], [34, 0], [36.8, 0]],
  // round the ambulatory from the north aisle of the choir to the south, past the three chapels
  [[28.2, 0], [28.2, -6.6], [34, -6.6], [XH, -6.6], ...amb, [XH, 6.6], [34, 6.6], [28.2, 6.6], [28.2, 14], [28.2, 0]],
  // out by the south aisle into the cloister, round its galleries
  [[12, 0], [12, 6.6], [9.4, 6.6], [8.2, 6.6], [8.2, 11.2], [1.5, 11.2], [1.5, 27.6], [17.9, 27.6], [17.9, 11.2], [8.2, 11.2]],
];
walks[0].y0 = 0; walks[1].y0 = 0; walks[2].y0 = 0;

export const sainteFoy = {
  id: 'sainte-foy-conques',
  name: { en: 'Sainte-Foy de Conques', zh: '孔克圣福瓦修道院教堂' },
  era: { en: 'Romanesque, c. 1050–1120', zh: '罗马式，约1050—1120年' },
  style: 'romanesque',
  district: 'rouergue',
  ...SITES['sainte-foy-conques'],
  entrance: { at: [-12, 0], facing: 'e' },
  bounds: [-14, -20, 56, 40],
  bakeBounds: [-2, -18, 54, 30],
  bakeTop: 38,
  bakeSpacing: 1.0,
  elements: E,
  rooms,
  walks,
};

export default sainteFoy;
