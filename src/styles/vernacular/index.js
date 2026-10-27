// Vernacular building: the ordinary houses around the monuments, made from type, not from a
// single example. Egyptian (Graeco-Roman) town houses: mud brick on a footing, plastered or
// bare, flat roofs of palm trunks and matting behind a parapet, small windows high up, a door
// with a timber lintel; tower houses of two or three storeys and courtyard houses.

import { registerStyle } from '../../core/build.js';
import { box, rod } from '../../core/geom.js';

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

/** A low mud-brick wall (garden, animal pen). */
function wallLow(el, { bag, col }) {
  const [x0, z0, x1, z1] = el.rect;
  bag.add('mudbrick', box(x0, el.y - 0.5, z0, x1, el.y + el.h, z1));
  col.rect(el.rect, el.y - 0.5, el.y + el.h);
}

registerStyle('vernacular', { trim: () => {}, opening: () => {}, column: () => {}, elements: { house_egypt: houseEgypt, wall_low: wallLow }, objects: {} });
