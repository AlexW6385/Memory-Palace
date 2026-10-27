// Hagia Sophia, Constantinople, as rebuilt in 562 — plan data from docs/buildings/hagia-sophia.md
// (§4). Local coordinates: origin at the centre of the dome on the nave floor, +x east (the
// apse), +z south; y = 0 at the nave floor. Metres, true scale.

import { SITES } from '../../world/regions.js';

const E = [];
const add = (o) => (E.push(o), o);
const block = (rect, y0, y1, mat, extra = {}) => add({ t: 'block', rect, y0, y1, mat, ...extra });
const floor = (rect, y, mat, extra = {}) => add({ t: 'floor', rect, y, mat, ...extra });
const slab = (rect, y0, y1, mat, extra = {}) => add({ t: 'slab', rect, y0, y1, mat, holes: [], ...extra });
const column = (x, z, y, h, d, shaftMat, extra = {}) => add({ t: 'column', at: [x, z], y, h, d, shaftMat, ...extra });
const obj = (kind, x, z, y, extra = {}) => add({ t: 'obj', kind, at: [x, z], y, ...extra });
const pwall = (o) => add({ t: 'planar_wall', ...o });

const S = 15.5;                 // half the central square (the dome's radius)
const YS = 24.5;                // springing of the great arches, the semidomes and the exedrae
const YD = 40.0;                // top of the pendentives, base of the dome
const CROWN = 55.6;             // crown of the dome above the floor
const GF = 14.6;                // gallery floor
const GR = 22.2;                // top of the gallery roofs
const ZO = 34.5;                // inner face of the north and south outer walls
const XE = 33.5;                // inner face of the east wall
const XW = -31.7;               // nave side of the west wall
const RE = 5.2;                 // exedra radius
const DC = Math.sqrt(S * S - RE * RE);          // distance from a semidome's centre to an exedra's chord
const DA = Math.sqrt(S * S - 5.2 * 5.2);        // … to the apse's (and the west bay's) chord
const TH = 48;                  // exedrae: 48° either side of the axis
const D2R = Math.PI / 180;

// ── floors ───────────────────────────────────────────────────────────────────
floor([XW, -ZO, XE, ZO], 0, 'proconnesian', { th: 0.6 });
floor([XE, -6.7, 40.2, 6.7], 0, 'proconnesian', { th: 0.6 });
floor([-42, -ZO, -33.2, ZO], 0, 'proconnesian', { th: 0.6 });            // inner narthex
floor([XW - 1.5, -2.2, XW, 2.2], 0, 'proconnesian', { th: 0.6 });        // the Imperial Door's threshold
floor([-48.5, -ZO, -43.5, ZO], 0, 'marble_floor', { th: 0.6 });         // outer narthex
for (const z of [0, -10, 10, -20, 20]) floor([-43.5, z - 1.3, -42, z + 1.3], 0, 'marble_floor', { th: 0.6 });
for (const z of [0, -10, 10, -20, 20]) floor([-50, z - 1.3, -48.5, z + 1.3], 0, 'marble_floor', { th: 0.6 });
for (const z of [-28, -21.5, -11.2, -5.8, 5.8, 11.2, 21.5, 28]) floor([XW - 1.5, z - 1.2, XW, z + 1.2], 0, 'proconnesian', { th: 0.6 });
floor([-98, -24, -50, 24], 0, 'marble_floor', { th: 0.6 });             // atrium
// the paved ground round the church: the Augustaion to the south, aprons elsewhere
floor([-104, 36, 48, 100], 0, 'travertine');
floor([-104, -52, -44, -36], 0, 'travertine');
floor([-27, -52, 48, -36], 0, 'travertine');
floor([-104, -36, -100, 36], 0, 'travertine');
floor([-104, -36, -50, -26], 0, 'travertine');
floor([-104, 26, -50, 36], 0, 'travertine');
floor([35, -36, 48, 36], 0, 'travertine');

// ── the four main piers, pierced by the aisles and the galleries ─────────────
for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
  const xm = sx * 18.75, a = [xm, sz * S], b = [xm, sz * ZO];
  add({ t: 'wall', a, b, th: 6.5, y0: 0, y1: GF, openings: [{ at: 9.9, w: 10, h: 8.5, y0: 0 }], mat: 'revetment_byz' });
  add({ t: 'wall', a, b, th: 6.5, y0: GF, y1: YS, openings: [{ at: 9.9, w: 9, h: 6, y0: GF }], mat: 'revetment_byz' });
  block([Math.min(sx * S, sx * 22), Math.min(sz * S, sz * ZO), Math.max(sx * S, sx * 22), Math.max(sz * S, sz * ZO)], YS, YD + 1.0, 'stucco_warm');
}

// ── north and south: nave arcades, gallery arcades, tympana, great arches ────
for (const sz of [-1, 1]) {
  const z = sz * 15.9;
  // ground floor: four verde antico columns, five arches
  const gArches = [0, 1, 2, 3, 4].map((k) => ({ uc: 3.1 + 6.2 * k, r: 2.65, spring: 10.4 }));
  pwall({ o: [-S, z], u: [1, 0], th: 0.8, u0: 0, u1: 2 * S, y0: 0, y1: 14.0, arches: gArches, arcade: true, mat: 'revetment_byz' });
  for (let k = 1; k <= 4; k++) column(-S + 6.2 * k, z, 0, 10.4, 1.1, 'verde_antico');
  // gallery: six columns, seven arches, a marble parapet between them
  const gb = 2 * S / 7;
  const uArches = [0, 1, 2, 3, 4, 5, 6].map((k) => ({ uc: gb * (k + 0.5), r: (gb - 0.7) / 2, spring: GF + 4.7 }));
  pwall({ o: [-S, z], u: [1, 0], th: 0.8, u0: 0, u1: 2 * S, y0: GF, y1: 21.6, arches: uArches, arcade: true, mat: 'revetment_byz' });
  for (let k = 1; k <= 6; k++) column(-S + gb * k, z, GF, 4.7, 0.6, 'verde_antico');
  for (let k = 0; k < 7; k++) {
    const x0 = -S + gb * k + 0.35, x1 = -S + gb * (k + 1) - 0.35;
    block([x0, z - 0.14, x1, z + 0.14], GF, GF + 1.0, 'revetment_green');
  }
  // the tympanum under the great arch: two rows of windows (7 + 5)
  const holes = [];
  for (let k = 1; k <= 7; k++) holes.push({ u0: 2 * S * k / 8 - 1.1, u1: 2 * S * k / 8 + 1.1, y0: 24.0, y1: 29.0 });
  for (let k = -2; k <= 2; k++) holes.push({ u0: S + k * 4.2 - 1.0, u1: S + k * 4.2 + 1.0, y0: 31.5, y1: 36.0 });
  const outline = { uc: S, r: S, spring: YS };
  pwall({ o: [-S, sz * 16.3], u: [1, 0], th: 1.4, u0: 0, u1: 2 * S, y0: 21.6, y1: YD, outline, holes, mat: 'stucco_warm', collide: false });
  pwall({ o: [-S, sz * 15.55], u: [1, 0], th: 0.1, u0: 0, u1: 2 * S, y0: 21.6, y1: YD, outline, holes, mat: 'mosaic_gold', collide: false });
  // the great arch
  add({ t: 'arch_band', c: [0, YS, 0], span: 'x', r0: S, r1: 17.3, d0: Math.min(sz * S, sz * 16.9), d1: Math.max(sz * S, sz * 16.9), mat: 'mosaic_gold' });
  add({ t: 'arch_band', c: [0, YS, 0], span: 'x', r0: S, r1: 17.3, d0: Math.min(sz * 16.9, sz * 17.55), d1: Math.max(sz * 16.9, sz * 17.55), mat: 'stucco_warm' });
  // the walls of the dome's square base above the arch
  pwall({ o: [-17.5, sz * 17.0], u: [1, 0], th: 1.0, u0: 0, u1: 35, y0: YS, y1: YD + 0.6, arches: [{ uc: 17.5, r: 17.3, spring: YS }], mat: 'stucco_warm', collide: false });
}

// ── east and west: great arches, semidomes, exedrae ──────────────────────────
for (const sx of [-1, 1]) {
  const cx = sx * S;
  add({ t: 'arch_band', c: [0, YS, 0], span: 'z', r0: S, r1: 16.1, d0: Math.min(sx * S, sx * 16.5), d1: Math.max(sx * S, sx * 16.5), mat: 'mosaic_gold' });
  pwall({ o: [sx * 17.0, -17.5], u: [0, 1], th: 1.0, u0: 0, u1: 35, y0: YS, y1: YD + 0.6, arches: [{ uc: 17.5, r: 16.1, spring: YS }], mat: 'stucco_warm', collide: false });
  // the semidome, cut at its foot by the arches of the apse (or west bay) and the two exedrae
  const clips = [[-sx, 0, 0, -S], [sx, 0, 0, DA + S]];
  const exedrae = [];
  for (const sz of [-1, 1]) {
    const th = (sx > 0 ? 0 : 180) + sz * (sx > 0 ? TH : -TH);
    const ux = Math.cos(th * D2R), uz = Math.sin(th * D2R);
    clips.push([ux, 0, uz, ux * cx + DC]);
    exedrae.push({ th, ux, uz, pc: [cx + ux * DC, uz * DC] });
  }
  const a0 = sx > 0 ? -90 : 90, a1 = sx > 0 ? 90 : 270;
  add({ t: 'sphere', c: [cx, YS, 0], R: S, clips, a0, a1, segA: 160, segE: 44, mat: 'mosaic_gold', outer: { t: 0.8, mat: 'lead' } });
  // the piers between the openings of the semidome's foot, from the floor to its springing
  const half = (w) => Math.asin(w / S) / D2R;
  const cA = half(5.2), cE = half(RE);
  for (const sz of [-1, 1]) {
    const base = sx > 0 ? 0 : 180, s = sx > 0 ? sz : -sz;
    const ranges = [[cA, TH - cE - 1.2], [TH + cE + 1.2, 90]];
    for (const [r0, r1] of ranges) {
      const A0 = base + s * r0, A1 = base + s * r1;
      add({ t: 'arc_wall', c: [cx, 0], r0: S, r1: 19.5, a0: Math.min(A0, A1), a1: Math.max(A0, A1), y0: 0, y1: YS, mat: 'revetment_byz' });
    }
  }
  // the exedrae: two porphyry columns below, six verde antico above, five windows, a half-dome
  for (const ex of exedrae) {
    const [px, pz] = ex.pc, th = ex.th;
    const P = (phi, r = RE + 0.4) => [px + r * Math.cos(phi * D2R), pz + r * Math.sin(phi * D2R)];
    add({ t: 'sphere', c: [px, YS, pz], R: RE, a0: th - 90, a1: th + 90, segA: 120, segE: 24, mat: 'mosaic_gold', outer: { t: 0.7, mat: 'lead' } });
    add({ t: 'arc_wall', c: [px, pz], r0: RE, r1: RE + 0.8, a0: th - 90, a1: th + 90, y0: 21.6, y1: YS, mat: 'revetment_byz', collide: false,
      gaps: [-60, -30, 0, 30, 60].map((d) => ({ a: th + d, w: 1.1, y0: 22.5, y1: 24.2 })) });
    add({ t: 'arc_wall', c: [px, pz], r0: RE, r1: RE + 0.8, a0: th - 90, a1: th + 90, y0: 14.0, y1: GF, mat: 'revetment_byz', collide: false });
    const bays = (n, y0, y1, spring, colH, colD, mat, imp) => {
      for (let k = 0; k < n; k++) {
        const pa = P(th - 90 + 180 * k / n), pb = P(th - 90 + 180 * (k + 1) / n);
        const L = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]), u = [(pb[0] - pa[0]) / L, (pb[1] - pa[1]) / L];
        pwall({ o: pa, u, th: 0.8, u0: 0, u1: L, y0, y1, arches: [{ uc: L / 2, r: (L - imp) / 2, spring }], arcade: true, noEnds: true, mat: 'revetment_byz', collide: false });
        if (k > 0) column(pa[0], pa[1], y0, colH, colD, mat);
        if (y0 > 1) {
          // a parapet between the gallery columns
          const q0 = [pa[0] + u[0] * 0.3, pa[1] + u[1] * 0.3], q1 = [pb[0] - u[0] * 0.3, pb[1] - u[1] * 0.3];
          add({ t: 'wall', a: q0, b: q1, th: 0.28, y0, y1: y0 + 1.0, openings: [], mat: 'revetment_green' });
        }
      }
    };
    bays(3, 0, 14.0, 9.4, 9.4, 0.95, 'porphyry', 0.9);
    bays(7, GF, 21.6, GF + 4.4, 4.4, 0.55, 'verde_antico', 0.6);
  }
}

// ── the pendentives and the dome ─────────────────────────────────────────────
const RP = S * Math.SQRT2;
add({ t: 'sphere', c: [0, YS, 0], R: RP, clips: [[1, 0, 0, S], [-1, 0, 0, S], [0, 0, 1, S], [0, 0, -1, S], [0, 1, 0, YD]], segA: 200, segE: 60, mat: 'mosaic_gold' });
add({ t: 'arc_wall', c: [0, 0], r0: S - 0.45, r1: S + 0.1, a0: 0, a1: 360, y0: YD - 0.45, y1: YD + 0.6, mat: 'marble_smooth', collide: false, step: 3 });
add({ t: 'square_ring', c: [0, 0], half: 17.5, r: S + 0.9, y: YD + 0.6, y0: YD - 0.8, mat: 'stucco_warm' });
add({ t: 'ribbed_dome', c: [0, 0], y0: YD + 0.6, r: S, thick: 0.9, win: { n: 40, w: 1.25, h: 1.9 }, crown: CROWN, mat: 'mosaic_gold', outMat: 'lead' });

// ── the apse and the bema ────────────────────────────────────────────────────
const AX = S + DA;                                  // the apse arch's chord (x = 30.1)
add({ t: 'arch_band', c: [0, YS, 0], span: 'z', r0: 5.2, r1: 6.4, d0: AX, d1: XE, mat: 'mosaic_gold' });
for (const sz of [-1, 1]) block([AX, Math.min(sz * 5.2, sz * 6.7), XE, Math.max(sz * 5.2, sz * 6.7)], 0, YS, 'revetment_byz');
add({ t: 'arc_wall', c: [XE, 0], r0: 5.2, r1: 6.7, a0: -90, a1: 90, y0: 0, y1: YS, mat: 'revetment_byz',
  gaps: [-45, 0, 45].flatMap((a) => [{ a, w: 1.6, y0: 7.0, y1: 12.0 }, { a, w: 1.6, y0: 15.0, y1: 21.0 }]) });
add({ t: 'sphere', c: [XE, YS, 0], R: 5.2, a0: -90, a1: 90, segA: 100, segE: 24, mat: 'mosaic_gold', outer: { t: 0.8, mat: 'lead' } });
block([XE - 0.1, -6.7, XE + 7.0, 6.7], YS + 6.1, YS + 6.5, 'lead', { collide: false });
obj('synthronon', 0, 0, 0, { c: [XE, 0], r: 5.2, a0: -84, a1: 84, tiers: 4 });
obj('ciborium', 31.6, 0, 0, { s: 2.0, h: 5.0 });

// ── the west bay and the west wall (the nave's west wall, the inner narthex's east wall) ──
const WX = -(S + DA);
add({ t: 'arch_band', c: [0, YS, 0], span: 'z', r0: 5.2, r1: 6.4, d0: XW, d1: WX, mat: 'mosaic_gold' });
for (const sz of [-1, 1]) block([XW, Math.min(sz * 5.2, sz * 6.7), WX, Math.max(sz * 5.2, sz * 6.7)], GR, YS, 'revetment_byz', { collide: false });
const XWC = XW - 0.75;                               // the wall's centre line
const westDoors = [{ z: 0, w: 4.0, h: 7.0 }, ...[-28, -21.5, -11.2, -5.8, 5.8, 11.2, 21.5, 28].map((z) => ({ z, w: 2.4, h: 5.5 }))];
pwall({ o: [XWC, -ZO], u: [0, 1], th: 1.5, u0: 0, u1: 2 * ZO, y0: 0, y1: GF, holes: westDoors.map((d) => ({ u0: d.z + ZO - d.w / 2, u1: d.z + ZO + d.w / 2, y0: 0, y1: d.h })), mat: 'revetment_byz' });
pwall({ o: [XWC, -ZO], u: [0, 1], th: 1.5, u0: 0, u1: 2 * ZO, y0: GF, y1: GR, mat: 'revetment_byz',
  arches: [{ uc: ZO, r: 4.0, spring: 18.0, sill: GF + 1.0 }, { uc: ZO - 11, r: 2.5, spring: 18.5, sill: GF + 1.0 }, { uc: ZO + 11, r: 2.5, spring: 18.5, sill: GF + 1.0 },
    { uc: ZO - 25.4, r: 2.2, spring: 18.0 }, { uc: ZO + 25.4, r: 2.2, spring: 18.0 }] });
pwall({ o: [XWC, -5.2], u: [0, 1], th: 1.5, u0: 0, u1: 10.4, y0: GR, y1: YS + 5.2, outline: { uc: 5.2, r: 5.2, spring: YS }, holes: [{ u0: 2.2, u1: 8.2, y0: 23.0, y1: YS + 3.0 }], mat: 'stucco_warm', collide: false });
obj('doors', XWC + 0.75, 0, 0, { yaw: Math.PI / 2, w: 4.0, h: 7.0, th: 0.2, depth: 0 });

// ── outer walls of the aisles and galleries: stucco outside, marble inside ───
function outerWall(o, u, L, inSide, holes, y1 = GR) {
  pwall({ o, u, th: 1.5, u0: 0, u1: L, y0: 0, y1, holes, mat: 'stucco_warm' });
  const n = [-u[1], u[0]];
  pwall({ o: [o[0] + n[0] * inSide * 0.78, o[1] + n[1] * inSide * 0.78], u, th: 0.06, u0: 0, u1: L, y0: 0, y1: y1 - 0.6, holes, mat: 'revetment_byz', collide: false });
}
// north (z = −35.25) and south walls, from the narthex's west wall to the east wall
for (const sz of [-1, 1]) {
  const holes = [];
  for (let x = -26; x <= 30; x += 7) if (Math.abs(x - 18.75) > 4.5 && Math.abs(x + 18.75) > 4.5 && !(sz > 0 && Math.abs(x + 10) < 3)) { holes.push({ u0: x + 43.5 - 1.0, u1: x + 43.5 + 1.0, y0: 3.5, y1: 8.0 }); holes.push({ u0: x + 43.5 - 1.0, u1: x + 43.5 + 1.0, y0: 16.0, y1: 20.5 }); }
  for (const x of [-38, -35]) holes.push({ u0: x + 43.5 - 0.8, u1: x + 43.5 + 0.8, y0: 16.0, y1: 20.0 });
  if (sz < 0) {
    // the door to the ramp tower, at the floor and at the gallery
    holes.push({ u0: -41.25 + 43.5 - 1.1, u1: -41.25 + 43.5 + 1.1, y0: 0, y1: 2.8 });
    holes.push({ u0: -41.25 + 43.5 - 1.1, u1: -41.25 + 43.5 + 1.1, y0: GF, y1: GF + 2.8 });
  } else {
    holes.push({ u0: -10 + 43.5 - 1.6, u1: -10 + 43.5 + 1.6, y0: 0, y1: 5.0 });   // the south door, from the Augustaion
  }
  // the wall runs west → east on the north side, and the frame keeps x = −43.5 + u
  outerWall([-43.5, sz * (ZO + 0.75)], [1, 0], 78.5, sz < 0 ? 1 : -1, holes);
}
floor([-41.25 - 1.1, -36, -41.25 + 1.1, -ZO], 0, 'proconnesian', { th: 0.6 });
floor([-41.25 - 1.1, -36, -41.25 + 1.1, -ZO], GF, 'proconnesian', { th: 0.6 });
floor([-10 - 1.6, ZO, -10 + 1.6, 36], 0, 'proconnesian', { th: 0.6 });
// east wall either side of the apse
for (const sz of [-1, 1]) {
  const holes = [];
  for (const z of [11, 19, 27]) { holes.push({ u0: z - 6.7 - 1.0, u1: z - 6.7 + 1.0, y0: 3.5, y1: 8.0 }); holes.push({ u0: z - 6.7 - 1.0, u1: z - 6.7 + 1.0, y0: 16.0, y1: 20.5 }); }
  outerWall([XE + 0.75, sz * 6.7], [0, sz], 27.8, sz > 0 ? 1 : -1, holes);
}

// ── galleries: floors (ceilings of the aisles below) and roofs ───────────────
function gallery(rect) {
  floor(rect, GF, 'proconnesian', { th: 0.6 });
  slab(rect, 13.86, 14.0, 'mosaic_gold');
  slab(rect, 21.5, 21.6, 'mosaic_gold');
  slab(rect, 21.6, GR, 'lead');
}
for (const sz of [-1, 1]) gallery([-42, Math.min(sz * 16.3, sz * ZO), XE, Math.max(sz * 16.3, sz * ZO)]);
gallery([-42, -16.3, XW, 16.3]);
// corner galleries behind the exedrae: strips from the exedra or pier wall out to the end wall
for (const sx of [-1, 1]) {
  const cx = sx * S;
  for (let z = -16.3; z < 16.29; z += 1.0) {
    const zm = z + 0.5;
    if (Math.abs(zm) < 7.2) continue;
    let reach = Math.sqrt(Math.max(0, 19.5 * 19.5 - zm * zm));
    for (const szz of [-1, 1]) {
      const th = (sx > 0 ? 0 : 180) + szz * (sx > 0 ? TH : -TH);
      const px = cx + Math.cos(th * D2R) * DC, pz = Math.sin(th * D2R) * DC, ro = RE + 0.85;
      const dz = pz >= z && pz <= z + 1 ? 0 : Math.min(Math.abs(z - pz), Math.abs(z + 1 - pz));
      if (dz < ro) reach = Math.max(reach, Math.abs(px - cx) + Math.sqrt(ro * ro - dz * dz));
    }
    const rect = sx > 0 ? [cx + reach, z, XE, z + 1.0] : [XW, z, cx - reach, z + 1.0];
    if (rect[2] - rect[0] > 0.3) gallery(rect);
  }
}

// ── the narthexes ────────────────────────────────────────────────────────────
// inner narthex west wall: five doors below, windows above the outer narthex's roof
outerWall([-42.75, -ZO], [0, 1], 2 * ZO, -1, [...[0, -10, 10, -20, 20].map((z) => ({ u0: z + ZO - 1.3, u1: z + ZO + 1.3, y0: 0, y1: 5.0 })),
  ...[0, -7, 7, -14, 14, -21, 21, -28, 28].map((z) => ({ u0: z + ZO - 0.8, u1: z + ZO + 0.8, y0: 16.0, y1: 20.0 }))]);
slab([-42, -ZO, -33.2, ZO], 13.86, 14.0, 'mosaic_gold');
floor([-42, -ZO, -33.2, ZO], GF, 'proconnesian', { th: 0.6 });
slab([-43.5, -36, -33.2, 36], 21.5, 21.6, 'mosaic_gold');
slab([-43.5, -36, -33.2, 36], 21.6, GR, 'lead');
// outer narthex: west wall with five doors to the atrium, roof, end walls
pwall({ o: [-49.25, -36], u: [0, 1], th: 1.5, u0: 0, u1: 72, y0: 0, y1: 10.6, mat: 'stucco_warm',
  holes: [0, -10, 10, -20, 20].map((z) => ({ u0: z + 36 - 1.3, u1: z + 36 + 1.3, y0: 0, y1: 4.5 })) });
for (const sz of [-1, 1]) add({ t: 'wall', a: [-50, sz * 35.25], b: [-43.5, sz * 35.25], th: 1.5, y0: 0, y1: 10.6, openings: [], mat: 'stucco_warm' });
slab([-50, -36, -43.5, 36], 9.9, 10.0, 'mosaic_gold');
slab([-50, -36, -43.5, 36], 10.0, 10.6, 'lead');
obj('doors', -42.0, 0, 0, { yaw: Math.PI / 2, w: 2.6, h: 5.0, th: 0.16, depth: 0 });
obj('doors', -48.5, 0, 0, { yaw: Math.PI / 2, w: 2.6, h: 4.5, th: 0.16, depth: 0 });

// ── the ramp tower at the north-west corner (four flights round a core) ──────
{
  const y = [0, 3.98, 7.30, 11.28, GF];
  floor([-42.5, -39, -40, -36], 0, 'proconnesian', { th: 0.6 });
  add({ t: 'stair', rect: [-40, -39, -31, -36.5], dir: 'e', y0: y[0], y1: y[1], riser: 0.19, base: 0, mat: 'marble_floor' });
  floor([-31, -39, -28.5, -36.5], y[1], 'marble_floor', { th: y[1] });
  add({ t: 'stair', rect: [-31, -46.5, -28.5, -39], dir: 'n', y0: y[1], y1: y[2], riser: 0.19, base: 0, mat: 'marble_floor' });
  floor([-31, -49, -28.5, -46.5], y[2], 'marble_floor', { th: y[2] });
  add({ t: 'stair', rect: [-40, -49, -31, -46.5], dir: 'w', y0: y[2], y1: y[3], riser: 0.19, base: 0, mat: 'marble_floor' });
  floor([-42.5, -49, -40, -46.5], y[3], 'marble_floor', { th: y[3] });
  add({ t: 'stair', rect: [-42.5, -46.5, -40, -39], dir: 's', y0: y[3], y1: y[4], riser: 0.19, base: 0, mat: 'marble_floor' });
  floor([-42.5, -39, -40, -36], GF, 'marble_floor', { th: 0.5 });
  block([-40, -46.5, -31, -39], 0, GF + 3.2, 'stucco_warm');
  add({ t: 'wall', a: [-43.25, -36], b: [-43.25, -50.5], th: 1.5, y0: 0, y1: GF + 3.8, openings: [], mat: 'stucco_warm' });
  add({ t: 'wall', a: [-44, -49.75], b: [-27, -49.75], th: 1.5, y0: 0, y1: GF + 3.8, openings: [], mat: 'stucco_warm' });
  add({ t: 'wall', a: [-27.75, -50.5], b: [-27.75, -36], th: 1.5, y0: 0, y1: GF + 3.8, openings: [], mat: 'stucco_warm' });
  slab([-44, -50.5, -27, -36], GF + 3.2, GF + 3.8, 'roof_tile');
}

// ── the atrium: a court with porticoes on three sides and the phiale ─────────
{
  const PH = 5.6;
  pwall({ o: [-99, -26], u: [0, 1], th: 2, u0: 0, u1: 52, y0: 0, y1: PH + 1.6, holes: [{ u0: 24, u1: 28, y0: 0, y1: 5.0 }], mat: 'stucco_warm' });
  floor([-100, -2, -98, 2], 0, 'marble_floor', { th: 0.6 });
  for (const sz of [-1, 1]) add({ t: 'wall', a: [-100, sz * 25], b: [-50, sz * 25], th: 2, y0: 0, y1: PH + 1.6, openings: [], mat: 'stucco_warm' });
  for (const sz of [-1, 1]) {
    for (let x = -93; x <= -54; x += 3.9) column(x, sz * 19, 0, PH, 0.5, 'verde_antico');
    add({ t: 'beam', a: [-94, sz * 19], b: [-50, sz * 19], y: PH, w: 0.7, h: 0.8, mat: 'marble' });
    slab([-98, Math.min(sz * 18.6, sz * 24), -50, Math.max(sz * 18.6, sz * 24)], PH + 0.8, PH + 1.15, 'roof_tile');
  }
  for (let z = -15.1; z <= 15.2; z += 3.775) column(-93, z, 0, PH, 0.5, 'verde_antico');
  add({ t: 'beam', a: [-93, -19], b: [-93, 19], y: PH, w: 0.7, h: 0.8, mat: 'marble' });
  slab([-98, -18.6, -92.6, 18.6], PH + 0.8, PH + 1.15, 'roof_tile');
  obj('phiale', -72, 0, 0, { r: 2.4 });
  obj('doors', -99, 0, 0, { yaw: Math.PI / 2, w: 4, h: 5.0, th: 0.16, depth: 0.9 });
}

// ── the furnishings of the liturgy ───────────────────────────────────────────
obj('ambo', 4, 0, 0, { rx: 3.0, rz: 2.1, h: 2.4 });
obj('solea', 0, 0, 0, { rect: [12.4, -1.6, 21.6, 1.6] });
obj('chancel_screen', 0, 0, 0, { a: [22, -8.5], b: [22, 8.5], n: 5, gaps: [2] });
for (const sz of [-1, 1]) obj('chancel_screen', 0, 0, 0, { a: [22, sz * 8.5], b: [28.0, sz * 8.5], n: 3 });
// lamps: the great ring under the dome, rings under the semidomes and in the aisles
obj('polykandelon', 0, 0, 7.0, { r: 9.0, n: 64, top: CROWN, light: 2.5, lights: 6, distance: 16 });
for (const sx of [-1, 1]) obj('polykandelon', sx * 22, 0, 6.0, { r: 2.6, n: 20, top: YS + 14, light: 1.5, lights: 2, distance: 10 });
for (const sz of [-1, 1]) for (const x of [-25, -6, 6, 27]) obj('polykandelon', x, sz * 25.4, 5.5, { r: 1.1, n: 10, top: 13.8, light: 1.2, lights: 1, distance: 9 });
for (const sz of [-1, 1]) for (const x of [-25, -6, 6, 27]) obj('polykandelon', x, sz * 25.4, GF + 4.5, { r: 0.9, n: 8, top: 21.4, light: 0.8, lights: 1, distance: 8 });

// ── rooms and walks ──────────────────────────────────────────────────────────
const room = (id, rect, y, kind) => ({ id, rect, y, kind });
const rooms = [
  room('atrium', [-90, -16, -58, 16], 0, 'open'),
  room('outer-narthex', [-48, -30, -44, 30], 0, 'hall'),
  room('inner-narthex', [-41.5, -30, -34, 30], 0, 'hall'),
  room('nave', [-12, -10, 12, 10], 0, 'hall'),
  room('west-bay', [-28, -4, -20, 4], 0, 'hall'),
  room('bema', [24, -6, 28.5, 6], 0, 'hall'),
  room('north-aisle', [-12, -32, 12, -18], 0, 'hall'),
  room('south-aisle', [-12, 18, 12, 32], 0, 'hall'),
  room('north-gallery', [-12, -32, 12, -18], GF, 'hall'),
  room('south-gallery', [-12, 18, 12, 32], GF, 'hall'),
  room('west-gallery', [-41.5, -12, -34, 12], GF, 'hall'),
  room('ramp', [-39.5, -38.5, -38, -37], 0, 'hall'),
  room('augustaion', [-40, 50, 20, 90], 0, 'open'),
];
const walks = [
  // from the road through the atrium, the two narthexes and the Imperial Door into the nave, to the chancel
  [[-106, 0], [-99, 0], [-80, -6], [-60, -6], [-52, 0], [-46, 0], [-38, 0], [-34, 0], [-28, 0], [-10, -6], [11.9, -6], [11.9, 0], [21.5, 0], [26, 0], [26, -5], [26, 0]],
  // up the ramp tower to the galleries, round the north gallery to the corner behind the exedra
  [[-38, -10], [-38, -30], [-41.25, -33.5], [-41.25, -37.6], [-40.5, -37.75], [-31.5, -37.75], [-29.75, -37.75], [-29.75, -39.5], [-29.75, -46], [-29.75, -47.75], [-31.5, -47.75], [-39.5, -47.75],
    [-41.25, -47.75], [-41.25, -46], [-41.25, -39.5], [-41.25, -37.75], [-41.25, -33.5], [-38, -30], [-38, -25], [-30, -25], [0, -25], [10, -25], [18.75, -25], [28, -25], [31.5, -18], [31.6, -12.5]],
  // the ground floor: nave → north aisle → through the pier → behind the exedra → back into the nave
  [[-25, 0], [-6.2, -10], [-6.2, -25], [18.75, -25], [28, -25], [28, -20], [27, -14], [20, -6], [0, -8]],
  // from the Augustaion through the south door
  [[-10, 60], [-10, 38], [-10, 33], [-10, 25], [-6.2, 25], [-6.2, 10]],
];
walks.forEach((w) => { w.y0 = 0; });

export const hagiaSophia = {
  id: 'hagia-sophia',
  name: { en: 'Hagia Sophia, Constantinople', zh: '君士坦丁堡圣索菲亚大教堂' },
  era: { en: 'Byzantine, AD 532–537, dome rebuilt 562', zh: '拜占庭，公元532—537年，穹顶562年重建' },
  style: 'byzantine',
  district: 'byzantium',
  ...SITES['hagia-sophia'],
  entrance: { at: [-104, 0], facing: 'e' },
  bounds: [-106, -52, 48, 102],
  bakeBounds: [-50, -51, 42, 38],
  bakeTop: 58,
  bakeSpacing: 2.0,
  elements: E,
  rooms,
  walks,
};

export default hagiaSophia;
