// Vernacular building: the ordinary houses around the monuments, made from type, not from a
// single example. Egyptian (Graeco-Roman) town houses: mud brick on a footing, plastered or
// bare, flat roofs of palm trunks and matting behind a parapet, small windows high up, a door
// with a timber lintel; tower houses of two or three storeys and courtyard houses.

import { registerStyle } from '../../core/build.js';
import { box, rod, fromTriangles, lathe } from '../../core/geom.js';

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/**
 * house_egypt: { rect [x0, z0, x1, z1], y (ground), storeys, court (rect inside, open), front ('n'|'s'|'e'|'w'),
 *               plaster (0…1), seed }
 */
function houseEgypt(el, { bag, col }) {
  const rand = rng(el.seed || 1);
  const [x0, z0, x1, z1] = el.rect, y = el.y;
  const storey = 3.1, H = el.storeys * storey + 0.2, par = 0.85, wall = 0.6;
  const mat = el.plaster > 0.5 ? 'plaster' : 'mudbrick';
  // footing, a little wider, of mud brick on the uneven ground
  bag.add('mudbrick', box(x0 - 0.12, y - 1.2, z0 - 0.12, x1 + 0.12, y + 0.35, z1 + 0.12));
  if (el.court) {
    // a court open to the sky: the house is a ring of rooms around it
    const [cx0, cz0, cx1, cz1] = el.court;
    const parts = [[x0, z0, x1, cz0], [x0, cz1, x1, z1], [x0, cz0, cx0, cz1], [cx1, cz0, x1, cz1]];
    for (const r of parts) if (r[2] - r[0] > 0.3 && r[3] - r[1] > 0.3) { bag.add(mat, box(r[0], y + 0.35, r[1], r[2], y + H, r[3])); col.rect(r, y - 1, y + H); }
    // the court's floor and a doorway from the street
    bag.add('mudbrick', box(cx0, y + 0.05, cz0, cx1, y + 0.12, cz1));
  } else {
    bag.add(mat, box(x0, y + 0.35, z0, x1, y + H, z1));
    col.rect([x0, z0, x1, z1], y - 1, y + H);
  }
  // parapet round the roof, with gaps where water runs off
  const t = 0.3;
  for (const r of [[x0, z0, x1, z0 + t], [x0, z1 - t, x1, z1], [x0, z0 + t, x0 + t, z1 - t], [x1 - t, z0 + t, x1, z1 - t]]) bag.add(mat, box(r[0], y + H, r[1], r[2], y + H + par, r[3]));
  // the ends of the palm-trunk roof beams showing on the façades under each roof
  const along = (x1 - x0) > (z1 - z0);
  for (let s = 1; s <= el.storeys; s++) {
    const yy = y + s * storey - 0.15;
    const n = Math.floor((along ? (z1 - z0) : (x1 - x0)) / 0.9);
    for (let k = 1; k < n; k++) {
      if (along) { const zz = z0 + k * 0.9; bag.add('palm_trunk', rod([x0 - 0.18, yy, zz], [x0 + 0.05, yy, zz], 0.1, 6)); bag.add('palm_trunk', rod([x1 - 0.05, yy, zz], [x1 + 0.18, yy, zz], 0.1, 6)); }
      else { const xx = x0 + k * 0.9; bag.add('palm_trunk', rod([xx, yy, z0 - 0.18], [xx, yy, z0 + 0.05], 0.1, 6)); bag.add('palm_trunk', rod([xx, yy, z1 - 0.05], [xx, yy, z1 + 0.18], 0.1, 6)); }
    }
  }
  // door with its timber lintel, and small windows high in each storey, on the street front
  const face = el.front || 's';
  const fx = face === 'e' ? x1 : face === 'w' ? x0 : null, fz = face === 's' ? z1 : face === 'n' ? z0 : null;
  // openings are dark panels set just proud of the façade (the walls are solid masses)
  const opening = (u, v0, w, h) => {
    const t2 = 0.03;
    if (face === 's') bag.add('opening', box(x0 + u, y + v0, z1, x0 + u + w, y + v0 + h, z1 + t2));
    else if (face === 'n') bag.add('opening', box(x0 + u, y + v0, z0 - t2, x0 + u + w, y + v0 + h, z0));
    else if (face === 'e') bag.add('opening', box(x1, y + v0, z0 + u, x1 + t2, y + v0 + h, z0 + u + w));
    else bag.add('opening', box(x0 - t2, y + v0, z0 + u, x0, y + v0 + h, z0 + u + w));
  };
  const L = fz !== null ? x1 - x0 : z1 - z0;
  const du = 0.6 + rand() * Math.max(0.1, L - 2.2);
  opening(du, 0.35, 1.0, 2.0);
  if (fz !== null) bag.add('cedar', box(x0 + du - 0.2, y + 2.35, fz - 0.1, x0 + du + 1.2, y + 2.55, fz + 0.12));
  else bag.add('cedar', box(fx - 0.1, y + 2.35, z0 + du - 0.2, fx + 0.12, y + 2.55, z0 + du + 1.2));
  for (let s = 0; s < el.storeys; s++) {
    const nw = Math.max(1, Math.floor(L / 3.2));
    for (let k = 0; k < nw; k++) {
      if (s === 0 && rand() < 0.6) continue;
      const u = (k + 0.5) * L / nw - 0.25;
      opening(Math.max(0.3, Math.min(L - 0.8, u)), s * storey + 2.0, 0.5, 0.45);
    }
  }
  // a light shelter of palm sticks on some roofs
  if (rand() < 0.4) {
    const sx = x0 + 0.5, sz = z0 + 0.5, ex = Math.min(x1 - 0.5, sx + 3), ez = Math.min(z1 - 0.5, sz + 2.6);
    for (const [px, pz] of [[sx, sz], [ex, sz], [sx, ez], [ex, ez]]) bag.add('palm_trunk', rod([px, y + H, pz], [px, y + H + 2.0, pz], 0.06, 5));
    bag.add('reed_mat', box(sx - 0.1, y + H + 2.0, sz - 0.1, ex + 0.1, y + H + 2.1, ez + 0.1));
  }
}

/**
 * house_tiled: a Byzantine town house (Constantinople, 6th century) — rubble and brick below,
 * plastered above, an upper storey jettied over the street on timber brackets (the maenianum),
 * a hipped roof of curved tiles. { rect, y (floor), foot (lowest ground), storeys, front, seed }
 */
function houseTiled(el, { bag, col }) {
  const rand = rng(el.seed || 1);
  const [x0, z0, x1, z1] = el.rect, y = el.y, st = 3.2, H = el.storeys * st;
  bag.add('brick', box(x0 - 0.1, el.foot - 0.6, z0 - 0.1, x1 + 0.1, y + 0.4, z1 + 0.1));
  bag.add('brick', box(x0, y + 0.4, z0, x1, y + st, z1));
  bag.add(el.plaster ? 'stucco_warm' : 'brick', box(x0, y + st, z0, x1, y + H, z1));
  col.rect([x0, z0, x1, z1], el.foot - 0.6, y + H);
  // the jetty: the upper storeys project over the street on the front
  const f = el.front || 's', J = el.storeys > 1 && rand() < 0.65 ? 0.9 : 0;
  let R = [x0, z0, x1, z1];
  if (J) {
    const jr = f === 's' ? [x0, z1, x1, z1 + J] : f === 'n' ? [x0, z0 - J, x1, z0] : f === 'e' ? [x1, z0, x1 + J, z1] : [x0 - J, z0, x0, z1];
    bag.add('stucco_warm', box(jr[0], y + st + 0.25, jr[1], jr[2], y + H, jr[3]));
    bag.add('timber', box(jr[0], y + st, jr[1], jr[2], y + st + 0.25, jr[3]));
    const along = f === 's' || f === 'n';
    const L = along ? x1 - x0 : z1 - z0;
    for (let k = 0; k <= Math.floor(L / 1.6); k++) {
      const u = Math.min(L - 0.15, 0.15 + k * 1.6);
      const a = along ? [x0 + u, y + st - 0.6, f === 's' ? z1 : z0] : [f === 'e' ? x1 : x0, y + st - 0.6, z0 + u];
      const b = along ? [x0 + u, y + st, f === 's' ? z1 + J : z0 - J] : [f === 'e' ? x1 + J : x0 - J, y + st, z0 + u];
      bag.add('timber', rod(a, b, 0.08, 4));
    }
    R = [Math.min(x0, jr[0]), Math.min(z0, jr[1]), Math.max(x1, jr[2]), Math.max(z1, jr[3])];
  }
  // openings: a door below, small windows with timber lintels above, on the front and sides
  const opening = (side, u, v0, w, h) => {
    const t = 0.03;
    const len = side === 's' || side === 'n' ? R[2] - R[0] : R[3] - R[1];
    if (u + w > len - 0.3) return;
    if (side === 's') bag.add('opening', box(R[0] + u, y + v0, R[3], R[0] + u + w, y + v0 + h, R[3] + t));
    if (side === 'n') bag.add('opening', box(R[0] + u, y + v0, R[1] - t, R[0] + u + w, y + v0 + h, R[1]));
    if (side === 'e') bag.add('opening', box(R[2], y + v0, R[1] + u, R[2] + t, y + v0 + h, R[1] + u + w));
    if (side === 'w') bag.add('opening', box(R[0] - t, y + v0, R[1] + u, R[0], y + v0 + h, R[1] + u + w));
  };
  const Lf = f === 's' || f === 'n' ? R[2] - R[0] : R[3] - R[1];
  // the door is in the ground storey's wall, under the jetty
  const du = 0.8 + rand() * Math.max(0.2, Lf - 2.6);
  if (f === 's') bag.add('opening', box(x0 + du, y + 0.4, z1, x0 + du + 1.1, y + 2.6, z1 + 0.03));
  if (f === 'n') bag.add('opening', box(x0 + du, y + 0.4, z0 - 0.03, x0 + du + 1.1, y + 2.6, z0));
  if (f === 'e') bag.add('opening', box(x1, y + 0.4, z0 + du, x1 + 0.03, y + 2.6, z0 + du + 1.1));
  if (f === 'w') bag.add('opening', box(x0 - 0.03, y + 0.4, z0 + du, x0, y + 2.6, z0 + du + 1.1));
  for (let s = 1; s < el.storeys; s++) {
    const n = Math.max(1, Math.floor(Lf / 2.6));
    for (let k = 0; k < n; k++) opening(f, (k + 0.5) * Lf / n - 0.35, s * st + 1.0, 0.7, 1.1);
  }
  // the hipped roof
  const o = 0.45, ex0 = R[0] - o, ez0 = R[1] - o, ex1 = R[2] + o, ez1 = R[3] + o, ye = y + H;
  const wx = ex1 - ex0, wz = ez1 - ez0, rise = Math.min(wx, wz) / 2 * Math.tan(22 * Math.PI / 180);
  bag.add('timber', box(ex0, ye - 0.12, ez0, ex1, ye, ez1));
  const tris = [];
  if (wx >= wz) {
    const r0 = [ex0 + wz / 2, ye + rise, (ez0 + ez1) / 2], r1 = [ex1 - wz / 2, ye + rise, (ez0 + ez1) / 2];
    tris.push(ex0, ye, ez0, ...r0, ...r1, ex0, ye, ez0, ...r1, ex1, ye, ez0);           // north slope
    tris.push(ex1, ye, ez1, ...r1, ...r0, ex1, ye, ez1, ...r0, ex0, ye, ez1);           // south slope
    tris.push(ex0, ye, ez1, ...r0, ex0, ye, ez0);                                        // west hip
    tris.push(ex1, ye, ez0, ...r1, ex1, ye, ez1);                                        // east hip
  } else {
    const r0 = [(ex0 + ex1) / 2, ye + rise, ez0 + wx / 2], r1 = [(ex0 + ex1) / 2, ye + rise, ez1 - wx / 2];
    tris.push(ex1, ye, ez0, ...r0, ...r1, ex1, ye, ez0, ...r1, ex1, ye, ez1);
    tris.push(ex0, ye, ez1, ...r1, ...r0, ex0, ye, ez1, ...r0, ex0, ye, ez0);
    tris.push(ex0, ye, ez0, ...r0, ex1, ye, ez0);
    tris.push(ex1, ye, ez1, ...r1, ex0, ye, ez1);
  }
  // make every face point up
  for (let i = 0; i < tris.length; i += 9) {
    const ux = tris[i + 3] - tris[i], uz = tris[i + 5] - tris[i + 2];
    const vx = tris[i + 6] - tris[i], vz = tris[i + 8] - tris[i + 2];
    if (uz * vx - ux * vz < 0) for (let k = 0; k < 3; k++) { const t = tris[i + 3 + k]; tris[i + 3 + k] = tris[i + 6 + k]; tris[i + 6 + k] = t; }
  }
  bag.add('roof_tile', fromTriangles(tris));
}

/**
 * house_domed: a stone house of the Levant — rooms vaulted in stone, each vault showing on the
 * flat roof as a low dome; a parapet, small windows, a door with a stone lintel.
 * { rect, y (floor), foot (lowest ground), storeys, front, seed }
 */
function houseDomed(el, { bag, col }) {
  const rand = rng(el.seed || 1);
  const [x0, z0, x1, z1] = el.rect, y = el.y, st = 3.6, H = el.storeys * st;
  bag.add('limestone', box(x0 - 0.1, el.foot - 0.6, z0 - 0.1, x1 + 0.1, y + 0.3, z1 + 0.1));
  bag.add('limestone', box(x0, y + 0.3, z0, x1, y + H, z1));
  col.rect([x0, z0, x1, z1], el.foot - 0.6, y + H);
  const t = 0.35, par = 0.9;
  for (const r of [[x0, z0, x1, z0 + t], [x0, z1 - t, x1, z1], [x0, z0 + t, x0 + t, z1 - t], [x1 - t, z0 + t, x1, z1 - t]]) bag.add('limestone', box(r[0], y + H, r[1], r[2], y + H + par, r[3]));
  // one dome over each vaulted room: the roof is divided into bays of about 4–5 m
  const nx = Math.max(1, Math.round((x1 - x0) / 4.6)), nz = Math.max(1, Math.round((z1 - z0) / 4.6));
  const bw = (x1 - x0) / nx, bd = (z1 - z0) / nz;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    if (rand() < 0.25) continue;
    const cx = x0 + (i + 0.5) * bw, cz = z0 + (j + 0.5) * bd, r = Math.min(bw, bd) * 0.42;
    bag.add('plaster', lathe([[r, 0], [r * 0.85, r * 0.32], [r * 0.5, r * 0.55], [0.001, r * 0.63]], 10, null, cx, y + H, cz));
  }
  // openings on the street front
  const f = el.front || 's';
  const L = f === 's' || f === 'n' ? x1 - x0 : z1 - z0;
  const open = (u, v0, w, h) => {
    if (u + w > L - 0.3) return;
    if (f === 's') bag.add('opening', box(x0 + u, y + v0, z1, x0 + u + w, y + v0 + h, z1 + 0.03));
    if (f === 'n') bag.add('opening', box(x0 + u, y + v0, z0 - 0.03, x0 + u + w, y + v0 + h, z0));
    if (f === 'e') bag.add('opening', box(x1, y + v0, z0 + u, x1 + 0.03, y + v0 + h, z0 + u + w));
    if (f === 'w') bag.add('opening', box(x0 - 0.03, y + v0, z0 + u, x0, y + v0 + h, z0 + u + w));
  };
  open(0.8 + rand() * Math.max(0.2, L - 2.6), 0.3, 1.1, 2.2);
  for (let s = 0; s < el.storeys; s++) {
    const n = Math.max(1, Math.floor(L / 3.4));
    for (let k = 0; k < n; k++) if (s > 0 || rand() < 0.4) open((k + 0.5) * L / n - 0.3, s * st + 2.0, 0.6, 0.9);
  }
}

/**
 * house_timber: a town house of medieval Paris — a stone ground floor, timber-framed upper
 * storeys jettied over the street, plastered between the timbers, a steep gabled roof whose gable
 * faces the street. { rect, y, foot, storeys, front, seed }
 */
function houseTimber(el, { bag, col }) {
  const rand = rng(el.seed || 1);
  const [x0, z0, x1, z1] = el.rect, y = el.y, st = 3.0, H = el.storeys * st;
  const f = el.front || 's', along = f === 's' || f === 'n';
  bag.add('limestone', box(x0 - 0.1, el.foot - 0.6, z0 - 0.1, x1 + 0.1, y + st, z1 + 0.1));
  col.rect([x0, z0, x1, z1], el.foot - 0.6, y + H);
  // each upper storey steps out 0.4 m over the street
  let R = [x0, z0, x1, z1];
  for (let s = 1; s < el.storeys; s++) {
    const J = 0.4 * s;
    R = f === 's' ? [x0, z0, x1, z1 + J] : f === 'n' ? [x0, z0 - J, x1, z1] : f === 'e' ? [x0, z0, x1 + J, z1] : [x0 - J, z0, x1, z1];
    bag.add('half_timber', box(R[0], y + s * st, R[1], R[2], y + (s + 1) * st, R[3]));
    bag.add('timber', box(R[0] - 0.05, y + s * st - 0.12, R[1] - 0.05, R[2] + 0.05, y + s * st + 0.08, R[3] + 0.05));
  }
  // windows and the door on the street front
  const L = along ? x1 - x0 : z1 - z0;
  const open = (u, v0, w, h) => {
    if (u + w > L - 0.25) return;
    if (f === 's') bag.add('opening', box(x0 + u, y + v0, R[3], x0 + u + w, y + v0 + h, R[3] + 0.03));
    if (f === 'n') bag.add('opening', box(x0 + u, y + v0, R[1] - 0.03, x0 + u + w, y + v0 + h, R[1]));
    if (f === 'e') bag.add('opening', box(R[2], y + v0, z0 + u, R[2] + 0.03, y + v0 + h, z0 + u + w));
    if (f === 'w') bag.add('opening', box(R[0] - 0.03, y + v0, z0 + u, R[0], y + v0 + h, z0 + u + w));
  };
  const du = 0.6 + rand() * Math.max(0.2, L - 2.4);
  if (f === 's') bag.add('opening', box(x0 + du, y + 0.2, z1, x0 + du + 1.2, y + 2.5, z1 + 0.03));
  if (f === 'n') bag.add('opening', box(x0 + du, y + 0.2, z0 - 0.03, x0 + du + 1.2, y + 2.5, z0));
  if (f === 'e') bag.add('opening', box(x1, y + 0.2, z0 + du, x1 + 0.03, y + 2.5, z0 + du + 1.2));
  if (f === 'w') bag.add('opening', box(x0 - 0.03, y + 0.2, z0 + du, x0, y + 2.5, z0 + du + 1.2));
  for (let s = 1; s < el.storeys; s++) { const n = Math.max(1, Math.floor(L / 2.2)); for (let k = 0; k < n; k++) open((k + 0.5) * L / n - 0.35, s * st + 0.9, 0.7, 1.2); }
  // the steep roof: the ridge runs back from the street, so the gable faces it
  const ye = y + H, o = 0.35;
  const tris = [];
  if (along) {
    const xm = (R[0] + R[2]) / 2, rise = (R[2] - R[0]) / 2 * 1.5;
    const a = [R[0] - o, ye, R[1] - o], b = [R[2] + o, ye, R[1] - o], c = [R[2] + o, ye, R[3] + o], d = [R[0] - o, ye, R[3] + o];
    const t0 = [xm, ye + rise, R[1] - o], t1 = [xm, ye + rise, R[3] + o];
    tris.push(...a, ...t0, ...t1, ...a, ...t1, ...d, ...b, ...c, ...t1, ...b, ...t1, ...t0);
    bag.add('half_timber', fromTriangles([R[0], ye, R[1], R[2], ye, R[1], xm, ye + rise - 0.3, R[1], R[0], ye, R[3], xm, ye + rise - 0.3, R[3], R[2], ye, R[3]]));
  } else {
    const zm = (R[1] + R[3]) / 2, rise = (R[3] - R[1]) / 2 * 1.5;
    const a = [R[0] - o, ye, R[1] - o], b = [R[2] + o, ye, R[1] - o], c = [R[2] + o, ye, R[3] + o], d = [R[0] - o, ye, R[3] + o];
    const t0 = [R[0] - o, ye + rise, zm], t1 = [R[2] + o, ye + rise, zm];
    tris.push(...a, ...b, ...t1, ...a, ...t1, ...t0, ...d, ...t0, ...t1, ...d, ...t1, ...c);
    bag.add('half_timber', fromTriangles([R[0], ye, R[1], R[0], ye + rise - 0.3, zm, R[0], ye, R[3], R[2], ye, R[1], R[2], ye, R[3], R[2], ye + rise - 0.3, zm]));
  }
  for (let i = 0; i < tris.length; i += 9) {
    const ux = tris[i + 3] - tris[i], uz = tris[i + 5] - tris[i + 2], vx = tris[i + 6] - tris[i], vz = tris[i + 8] - tris[i + 2];
    if (uz * vx - ux * vz < 0) for (let k = 0; k < 3; k++) { const t = tris[i + 3 + k]; tris[i + 3 + k] = tris[i + 6 + k]; tris[i + 6 + k] = t; }
  }
  bag.add(rand() < 0.5 ? 'slate' : 'roof_tile', fromTriangles(tris));
}

/**
 * house_china: a house of a north China village — earth or grey-brick walls, a gabled roof of grey
 * tiles with a ridge, small latticed windows and a door on the courtyard side. { rect, y, foot, front, seed }
 */
function houseChina(el, ctx) {
  gabledHouse(el, ctx, { H: 3.2, foot: 'brick_grey', walls: ['brick_grey', 'earth_wall'], roof: 'tile_grey', o: 0.5, pitch: 0.62, door: 'timber_red', window: 'timber_red', horns: true });
}

/**
 * house_japan: a house of a Heian village by Uji — a timber frame on stones, walls of planks or
 * white plaster between dark posts, deep eaves, a gabled roof of cypress bark or thatch.
 */
function houseJapan(el, ctx) {
  const rand = rng((el.seed || 1) + 7);
  gabledHouse(el, ctx, { H: 2.9, foot: 'limestone', walls: ['timber', 'plaster_white'], roof: rand() < 0.5 ? 'roof_bark' : 'thatch', o: 0.9, pitch: 0.85, door: 'timber', window: 'timber', horns: false });
}

/**
 * house_india: a village house of central India — walls of mud plastered and limewashed, or of
 * brick, a low-pitched roof of half-round clay tiles over a verandah front. { rect, y, foot, front, seed }
 */
function houseIndia(el, ctx) {
  gabledHouse(el, ctx, { H: 2.8, foot: 'mudbrick', walls: ['plaster', 'earth_wall'], roof: 'roof_tile', o: 0.7, pitch: 0.45, door: 'timber', window: 'timber', horns: false });
}

/**
 * house_rouergue: a village house of the Rouergue about 1100 — walls of grey schist rubble or of
 * yellow stone, small windows, a steep roof of schist slabs (lauzes). { rect, y, foot, front, seed }
 */
function houseRouergue(el, ctx) {
  gabledHouse(el, ctx, { H: 3.0, foot: 'schist_rubble', walls: ['schist_rubble', 'limestone_yellow'], roof: 'lauze', o: 0.4, pitch: 1.0, door: 'timber', window: 'timber', horns: false });
}

function gabledHouse(el, { bag, col }, O) {
  const rand = rng(el.seed || 1);
  const [x0, z0, x1, z1] = el.rect, y = el.y, H = O.H;
  const mat = O.walls[rand() < 0.5 ? 0 : 1];
  bag.add(O.foot, box(x0 - 0.1, el.foot - 0.6, z0 - 0.1, x1 + 0.1, y + 0.45, z1 + 0.1));
  bag.add(mat, box(x0, y + 0.45, z0, x1, y + H, z1));
  col.rect([x0, z0, x1, z1], el.foot - 0.6, y + H);
  const f = el.front || 's', along = f === 's' || f === 'n';
  const L = along ? x1 - x0 : z1 - z0;
  const open = (u, v0, w, h, m = 'opening') => {
    if (u + w > L - 0.3) return;
    if (f === 's') bag.add(m, box(x0 + u, y + v0, z1, x0 + u + w, y + v0 + h, z1 + 0.04));
    if (f === 'n') bag.add(m, box(x0 + u, y + v0, z0 - 0.04, x0 + u + w, y + v0 + h, z0));
    if (f === 'e') bag.add(m, box(x1, y + v0, z0 + u, x1 + 0.04, y + v0 + h, z0 + u + w));
    if (f === 'w') bag.add(m, box(x0 - 0.04, y + v0, z0 + u, x0, y + v0 + h, z0 + u + w));
  };
  const n = Math.max(2, Math.floor(L / 3.2));
  for (let k = 0; k < n; k++) {
    const u = (k + 0.5) * L / n;
    if (k === Math.floor(n / 2)) open(u - 0.55, 0.45, 1.1, 2.1, O.door);
    else open(u - 0.6, 1.2, 1.2, 1.1, O.window);
  }
  // the roof: a gable over the long side, grey tiles, a ridge with raised ends
  const o = O.o, ye = y + H;
  const tris = [];
  let ridge;
  if ((x1 - x0) >= (z1 - z0)) {
    const zm = (z0 + z1) / 2, rise = (z1 - z0) / 2 * O.pitch;
    const a = [x0 - o, ye, z0 - o], b = [x1 + o, ye, z0 - o], c = [x1 + o, ye, z1 + o], d = [x0 - o, ye, z1 + o], t0 = [x0 - o, ye + rise, zm], t1 = [x1 + o, ye + rise, zm];
    tris.push(...a, ...b, ...t1, ...a, ...t1, ...t0, ...d, ...t0, ...t1, ...d, ...t1, ...c);
    bag.add(mat, fromTriangles([x0, ye, z0, x0, ye + rise - 0.2, zm, x0, ye, z1, x1, ye, z0, x1, ye, z1, x1, ye + rise - 0.2, zm]));
    ridge = box(x0 - o, ye + rise - 0.05, zm - 0.18, x1 + o, ye + rise + 0.35, zm + 0.18);
    if (O.horns) for (const xx of [x0 - o, x1 + o]) bag.add('tile_grey', box(xx - 0.25, ye + rise, zm - 0.2, xx + 0.25, ye + rise + 0.75, zm + 0.2));
  } else {
    const xm = (x0 + x1) / 2, rise = (x1 - x0) / 2 * O.pitch;
    const a = [x0 - o, ye, z0 - o], b = [x1 + o, ye, z0 - o], c = [x1 + o, ye, z1 + o], d = [x0 - o, ye, z1 + o], t0 = [xm, ye + rise, z0 - o], t1 = [xm, ye + rise, z1 + o];
    tris.push(...a, ...t0, ...t1, ...a, ...t1, ...d, ...b, ...c, ...t1, ...b, ...t1, ...t0);
    bag.add(mat, fromTriangles([x0, ye, z0, x1, ye, z0, xm, ye + rise - 0.2, z0, x0, ye, z1, xm, ye + rise - 0.2, z1, x1, ye, z1]));
    ridge = box(xm - 0.18, ye + rise - 0.05, z0 - o, xm + 0.18, ye + rise + 0.35, z1 + o);
    if (O.horns) for (const zz of [z0 - o, z1 + o]) bag.add('tile_grey', box(xm - 0.2, ye + rise, zz - 0.25, xm + 0.2, ye + rise + 0.75, zz + 0.25));
  }
  for (let i = 0; i < tris.length; i += 9) {
    const ux = tris[i + 3] - tris[i], uz = tris[i + 5] - tris[i + 2], vx = tris[i + 6] - tris[i], vz = tris[i + 8] - tris[i + 2];
    if (uz * vx - ux * vz < 0) for (let k = 0; k < 3; k++) { const t = tris[i + 3 + k]; tris[i + 3 + k] = tris[i + 6 + k]; tris[i + 6 + k] = t; }
  }
  bag.add(O.roof, fromTriangles(tris));
  bag.add(O.roof === 'tile_grey' ? 'tile_grey' : 'roof_ridge', ridge);
}

/**
 * bridge_stone: a bridge of stone carrying a road over a river { rect (the deck, running east–west),
 * y (deck level), ramps: [[rect, y0, y1, dir]], bed (river bed level) }: a deck on piers, parapets,
 * ramps down to the banks.
 */
function bridgeStone(el, { bag, col }) {
  const [x0, z0, x1, z1] = el.rect, y = el.y, bed = el.bed ?? -4;
  bag.add('limestone', box(x0, y - 0.7, z0, x1, y, z1));
  col.floor(el.rect, y);
  // piers every 14 m or so, with cutwaters upstream and down
  const n = Math.max(2, Math.round((x1 - x0) / 14));
  for (let k = 1; k < n; k++) {
    const x = x0 + (x1 - x0) * k / n;
    bag.add('limestone', box(x - 1.1, bed, z0 + 0.3, x + 1.1, y - 0.7, z1 - 0.3));
    bag.add('limestone', fromTriangles(prism([[x - 1.1, z0 + 0.3], [x + 1.1, z0 + 0.3], [x, z0 - 1.2]], bed, y - 1.6)));
    bag.add('limestone', fromTriangles(prism([[x + 1.1, z1 - 0.3], [x - 1.1, z1 - 0.3], [x, z1 + 1.2]], bed, y - 1.6)));
  }
  // the parapets along the deck and the ramps
  const par = (ax, bx, ya, yb, z) => {
    const t = [], h = 0.9, th = 0.4, zz0 = z - th / 2, zz1 = z + th / 2;
    const q = [[ax, ya, zz0], [bx, yb, zz0], [bx, yb, zz1], [ax, ya, zz1]];
    const u = q.map(([px, py, pz]) => [px, py + h, pz]);
    quadT(t, q[0], q[1], u[1], u[0]); quadT(t, q[2], q[3], u[3], u[2]); quadT(t, u[0], u[1], u[2], u[3]);
    quadT(t, q[3], q[0], u[0], u[3]); quadT(t, q[1], q[2], u[2], u[1]);
    bag.add('limestone', fromTriangles(t));
    col.segment([ax, z], [bx, z], th, Math.min(ya, yb) - 0.5, Math.max(ya, yb) + h);
  };
  for (const z of [z0 + 0.2, z1 - 0.2]) par(x0, x1, y, y, z);
  for (const [r, ya, yb, dir] of el.ramps) {
    const [rx0, rz0, rx1, rz1] = r;
    const y0 = dir === 'e' ? ya : yb, y1 = dir === 'e' ? yb : ya;          // heights at rx0 and rx1
    const t = [];
    quadT(t, [rx0, y0, rz0], [rx0, y0, rz1], [rx1, y1, rz1], [rx1, y1, rz0]);
    quadT(t, [rx0, y0, rz0], [rx1, y1, rz0], [rx1, Math.min(y0, y1) - 1.5, rz0], [rx0, Math.min(y0, y1) - 1.5, rz0]);
    quadT(t, [rx0, y0, rz1], [rx0, Math.min(y0, y1) - 1.5, rz1], [rx1, Math.min(y0, y1) - 1.5, rz1], [rx1, y1, rz1]);
    bag.add('limestone', fromTriangles(t));
    col.ramp(r, Math.min(ya, yb), Math.max(ya, yb), dir);
    for (const z of [rz0 + 0.2, rz1 - 0.2]) par(rx0, rx1, y0, y1, z);
  }
}
function quadT(t, a, b, c, d) { t.push(...a, ...b, ...c, ...a, ...c, ...d, ...a, ...c, ...b, ...a, ...d, ...c); }   // both faces
function prism(poly, y0, y1) {
  const t = [];
  for (let i = 0; i < poly.length; i++) { const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length]; quadT(t, [ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]); }
  t.push(poly[0][0], y1, poly[0][1], poly[2][0], y1, poly[2][1], poly[1][0], y1, poly[1][1], poly[0][0], y1, poly[0][1], poly[1][0], y1, poly[1][1], poly[2][0], y1, poly[2][1]);
  return t;
}

/**
 * A well in a square: a round curb of stone (or brick), two posts and a beam with a pulley, a
 * bucket on the rim. { at [x, z], y, mat (curb), timber }
 */
function well(el, { bag, col }) {
  const [x, z] = el.at, y = el.y, mat = el.mat || 'limestone', tim = el.timber || 'timber';
  bag.add(mat, lathe([[0.95, -0.4], [0.95, 0.85], [0.7, 0.85], [0.7, 0.1], [0.001, 0.1]], 20, null, x, y, z));
  bag.add('water', lathe([[0.69, 0.05], [0.001, 0.05]], 20, null, x, y, z));
  for (const s of [-1, 1]) bag.add(tim, box(x + s * 0.85 - 0.08, y + 0.85, z - 0.08, x + s * 0.85 + 0.08, y + 2.5, z + 0.08));
  bag.add(tim, box(x - 1.0, y + 2.4, z - 0.07, x + 1.0, y + 2.55, z + 0.07));
  bag.add('timber', lathe([[0.14, 0], [0.16, 0.28], [0.001, 0.28]], 10, null, x + 0.55, y + 0.85, z + 0.55));
  col.circle(x, z, 0.95, y - 0.4, y + 0.85);
}

/** A low mud-brick wall (garden, animal pen). */
function wallLow(el, { bag, col }) {
  const [x0, z0, x1, z1] = el.rect;
  bag.add('mudbrick', box(x0, el.y - 0.5, z0, x1, el.y + el.h, z1));
  col.rect(el.rect, el.y - 0.5, el.y + el.h);
}

registerStyle('vernacular', { trim: () => {}, opening: () => {}, column: () => {}, elements: { house_egypt: houseEgypt, house_tiled: houseTiled, house_domed: houseDomed, house_timber: houseTimber, house_china: houseChina, house_japan: houseJapan, house_india: houseIndia, house_rouergue: houseRouergue, well, bridge_stone: bridgeStone, wall_low: wallLow }, objects: {} });
