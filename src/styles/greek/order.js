// The Doric order above the columns, and the temple's steps, pediments, roof and ceilings.
//
// Entablature (bottom to top): architrave (epistyle) with its taenia, and under each triglyph
// a regula with six guttae; the frieze of triglyphs and metopes, a triglyph over every column
// and over every intercolumniation, the corner triglyphs pushed to the corner (the "corner
// conflict" the Parthenon solves by contracting the corner intercolumniation); the geison
// (cornice) projecting ~0.7 m, with a mutule over every triglyph and metope. Above the ends,
// the pediment: the tympanum framed by the raking geison and the sima. The roof is marble
// tiles: pan tiles with cover-tile ridges, a ridge course, antefixes at the eaves.

import { box, lathe, fromTriangles, quad, orientOutward } from '../../core/geom.js';
import { subtractRects } from '../../core/build.js';

/**
 * Doric entablature around a peristyle.
 * el = { axes: { x: [...], z: [...] } (column axes along the long sides and the ends),
 *        y (top of abaci), face (outer face offset from the axis), arch, frieze, geison,
 *        tw (triglyph width), overhang, mat }
 */
export function doricEntablature(el, { bag }) {
  const mat = el.mat || 'marble';
  const X = el.axes.x, Z = el.axes.z;
  const ax0 = X[0], ax1 = X[X.length - 1], az0 = Z[0], az1 = Z[Z.length - 1];
  const f = el.face, fi = el.inner ?? el.face;
  const y0 = el.y, yA = y0 + el.arch, yF = yA + el.frieze, yG = yF + el.geison;
  const tw = el.tw, oh = el.overhang ?? 0.7;
  const O = [ax0 - f, az0 - f, ax1 + f, az1 + f];          // outer face of architrave and frieze
  const I = [ax0 + fi, az0 + fi, ax1 - fi, az1 - fi];      // inner face
  // architrave and frieze bodies: four slabs
  const ring = (r, ri, ya, yb, out) => {
    out.push(box(r[0], ya, r[1], r[2], yb, ri[1]));
    out.push(box(r[0], ya, ri[3], r[2], yb, r[3]));
    out.push(box(r[0], ya, ri[1], ri[0], yb, ri[3]));
    out.push(box(ri[2], ya, ri[1], r[2], yb, ri[3]));
  };
  const parts = [];
  ring(O, I, y0, yA, parts);
  const tH = el.arch * 0.075;                                // taenia
  const T = [O[0] - 0.06, O[1] - 0.06, O[2] + 0.06, O[3] + 0.06];
  ring(T, [O[0] + 0.1, O[1] + 0.1, O[2] - 0.1, O[3] - 0.1], yA - tH, yA, parts);
  // frieze body set back slightly from the triglyph faces
  const M = [O[0] + 0.05, O[1] + 0.05, O[2] - 0.05, O[3] - 0.05];
  ring(M, I, yA, yF, parts);
  // triglyph positions along each side (as distances along the side), including corners
  const sideTriglyphs = (axes, lo, hi) => {
    const out = [];
    for (let i = 0; i < axes.length; i++) {
      out.push(i === 0 ? lo + tw / 2 : i === axes.length - 1 ? hi - tw / 2 : axes[i]);
      if (i < axes.length - 1) out.push((axes[i] + axes[i + 1]) / 2);
    }
    return out;
  };
  const tx = sideTriglyphs(X, O[0], O[2]);
  const tz = sideTriglyphs(Z, O[1], O[3]);
  const gut = [];
  const triglyph = (cx, cz, along) => {
    // three bars (femora) and two channels; the outer chamfers implied by narrower end bars
    const g = (tw - 0.1 * 2) / 3;
    const segs = [[-tw / 2, -tw / 2 + g], [-tw / 2 + g + 0.1, tw / 2 - g - 0.1], [tw / 2 - g, tw / 2]];
    for (const [a, b] of segs) {
      if (along === 'x') parts.push(box(cx + a, yA, cz - 0.05, cx + b, yF - 0.08, cz + 0.05));
      else parts.push(box(cx - 0.05, yA, cz + a, cx + 0.05, yF - 0.08, cz + b));
    }
    // channel backs and the capital band of the triglyph
    if (along === 'x') parts.push(box(cx - tw / 2, yF - 0.12, cz - 0.07, cx + tw / 2, yF, cz + 0.07));
    else parts.push(box(cx - 0.07, yF - 0.12, cz - tw / 2, cx + 0.07, yF, cz + tw / 2));
    // regula and six guttae under the taenia
    const ry = yA - tH;
    if (along === 'x') parts.push(box(cx - tw / 2, ry - 0.06, cz - 0.04, cx + tw / 2, ry, cz + 0.04));
    else parts.push(box(cx - 0.04, ry - 0.06, cz - tw / 2, cx + 0.04, ry, cz + tw / 2));
    for (let k = 0; k < 6; k++) {
      const u = -tw / 2 + tw * (k + 0.5) / 6;
      gut.push(along === 'x' ? [cx + u, ry - 0.06, cz] : [cx, ry - 0.06, cz + u]);
    }
  };
  for (const x of tx) { triglyph(x, O[1], 'x'); triglyph(x, O[3], 'x'); }
  for (const z of tz.slice(1, -1)) { triglyph(O[0], z, 'z'); triglyph(O[2], z, 'z'); }
  for (const [x, y, z] of gut) parts.push(lathe([[0.04, 0], [0.03, -0.07], [0, -0.07]], 8, null, x, y, z));
  // geison: the projecting cornice, its soffit sloping, a mutule over each triglyph and metope
  const G = [O[0] - oh, O[1] - oh, O[2] + oh, O[3] + oh];
  ring(G, I, yF + el.geison * 0.25, yG, parts);
  ring([O[0] - 0.25, O[1] - 0.25, O[2] + 0.25, O[3] + 0.25], I, yF, yF + el.geison * 0.25, parts);
  const mut = (a, b, side) => {
    for (let i = 0; i < a.length; i++) {
      const c = a[i];
      const w = tw * 0.95;
      if (side === 'zn') parts.push(box(c - w / 2, yF + el.geison * 0.18, G[1] + 0.1, c + w / 2, yF + el.geison * 0.25, O[1] - 0.25));
      if (side === 'zp') parts.push(box(c - w / 2, yF + el.geison * 0.18, O[3] + 0.25, c + w / 2, yF + el.geison * 0.25, G[3] - 0.1));
      if (side === 'xn') parts.push(box(G[0] + 0.1, yF + el.geison * 0.18, c - w / 2, O[0] - 0.25, yF + el.geison * 0.25, c + w / 2));
      if (side === 'xp') parts.push(box(O[2] + 0.25, yF + el.geison * 0.18, c - w / 2, G[2] - 0.1, yF + el.geison * 0.25, c + w / 2));
    }
  };
  // mutules over triglyphs and metopes alike (as at the Parthenon)
  const both = (t) => t.flatMap((v, i) => (i < t.length - 1 ? [v, (v + t[i + 1]) / 2] : [v]));
  mut(both(tx), null, 'zn'); mut(both(tx), null, 'zp');
  mut(both(tz).slice(1, -1), null, 'xn'); mut(both(tz).slice(1, -1), null, 'xp');
  for (const g of parts) bag.add(mat, g);
}

/**
 * Pediments and the tiled roof over a rectangle, the ridge along x.
 * el = { rect (outer edge of the horizontal geison), y (top of the horizontal geison),
 *        rise (height of the pediment at the centre), tympanumInset, sima, mat, tileMat }
 */
export function pedimentRoof(el, { bag }) {
  const mat = el.mat || 'marble';
  const [x0, z0, x1, z1] = el.rect;
  const y = el.y, rise = el.rise, zc = (z0 + z1) / 2, half = (z1 - z0) / 2;
  const inset = el.tympanumInset ?? 0.9;
  const rg = el.rakingGeison ?? 0.6;
  const parts = [];
  // tympana: triangles set back from the cornice face, at both ends
  for (const [xe, dir] of [[x0, -1], [x1, 1]]) {
    const xf = xe - dir * inset, xb = xf - dir * 0.9;
    const t = [];
    // the tympanum as a triangular prism between its face and its back
    const A = [xf, y, z0 + inset * 0.6], B = [xf, y, z1 - inset * 0.6], C = [xf, y + rise - rg * 0.9, zc];
    const A2 = [xb, y, A[2]], B2 = [xb, y, B[2]], C2 = [xb, C[1], zc];
    t.push(...A, ...B, ...C, ...A2, ...C2, ...B2);
    quad(t, A, A2, B2, B); quad(t, B, B2, C2, C); quad(t, C, C2, A2, A);
    parts.push(fromTriangles(orientOutward(t)));
    // raking geison along both slopes, projecting like the horizontal one
    for (const s of [-1, 1]) {
      const za = s < 0 ? z0 : z1, ya = y, zb = zc, yb = y + rise;
      parts.push(slopedBar(xe - dir * (inset + 0.05), xe + dir * 0.02, [za, ya - 0.02], [zb, yb], rg, 0));
      // sima: the gutter crowning the raking cornice
      parts.push(slopedBar(xe - dir * (inset + 0.05), xe + dir * 0.06, [za, ya + rg - 0.02], [zb, yb + rg], 0.32, 0));
    }
  }
  // roof: two slopes of marble tiles from the geison to the ridge
  const tileMat = el.tileMat || mat;
  const th = 0.22;
  for (const s of [-1, 1]) {
    const ze = s < 0 ? z0 : z1;
    parts.push(...[slopedSlab(x0 + inset * 0.2, x1 - inset * 0.2, [ze, y + rg * 0.6], [zc, y + rise + rg * 0.6], th)]);
    // cover-tile ridges every ~0.72 m running down the slope, antefixes at their feet
    const n = Math.floor((x1 - x0 - 2) / 0.72);
    const cover = [];
    for (let k = 0; k <= n; k++) {
      const x = x0 + 1 + k * 0.72;
      cover.push(slopedBar(x - 0.09, x + 0.09, [ze + s * 0.0, y + rg * 0.6 + th], [zc, y + rise + rg * 0.6 + th], 0.12, 0));
      // antefix: a small upright palmette plate at the eave
      cover.push(box(x - 0.16, y + rg * 0.6 + th - 0.02, ze - (s < 0 ? 0.04 : -0.0) - (s > 0 ? 0.04 : 0), x + 0.16, y + rg * 0.6 + th + 0.38, ze + (s > 0 ? 0.04 : 0) + (s < 0 ? 0.0 : 0)));
    }
    for (const c of cover) bag.add(tileMat, c);
  }
  // ridge course
  parts.push(box(x0 + 0.3, y + rise + rg * 0.6 + th - 0.05, zc - 0.28, x1 - 0.3, y + rise + rg * 0.6 + th + 0.16, zc + 0.28));
  for (const g of parts) bag.add(mat, g);
}

/** A bar between two (z, y) points, spanning x from xa to xb, thickness h perpendicular-ish (vertical). */
function slopedBar(xa, xb, [za, ya], [zb, yb], h) {
  const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb);
  const t = [];
  const P = (x, z, y) => [x, y, z];
  const a0 = P(x0, za, ya), b0 = P(x0, zb, yb), a1 = P(x1, za, ya), b1 = P(x1, zb, yb);
  const a0t = P(x0, za, ya + h), b0t = P(x0, zb, yb + h), a1t = P(x1, za, ya + h), b1t = P(x1, zb, yb + h);
  quad(t, a0t, a1t, b1t, b0t); quad(t, a0, b0, b1, a1);
  quad(t, a0, a0t, b0t, b0); quad(t, a1, b1, b1t, a1t);
  quad(t, a0, a1, a1t, a0t); quad(t, b0, b0t, b1t, b1);
  return fromTriangles(orientOutward(t));
}
const slopedSlab = (xa, xb, a, b, th) => slopedBar(xa, xb, a, b, th);

/**
 * Coffered ceiling: a grid of beams with recessed square coffers above them.
 * el = { rect, y (underside of the beams), beam (width), depth, cell, mat }
 */
export function coffers(el, { bag }) {
  const [x0, z0, x1, z1] = el.rect;
  const mat = el.mat || 'marble';
  const y = el.y, d = el.depth ?? 0.25, b = el.beam ?? 0.18, c = el.cell ?? 0.9;
  const parts = [box(x0, y + d, z0, x1, y + d + 0.15, z1)];
  for (let x = x0; x <= x1 + 1e-6; x += c) parts.push(box(Math.max(x0, x - b / 2), y, z0, Math.min(x1, x + b / 2), y + d, z1));
  for (let z = z0; z <= z1 + 1e-6; z += c) parts.push(box(x0, y, Math.max(z0, z - b / 2), x1, y + d, Math.min(z1, z + b / 2)));
  for (const g of parts) bag.add(mat, g);
}

/** The stepped base (krepis): n steps up to the stylobate rect. Only the stylobate top is walkable. */
export function krepis(el, { bag, col }) {
  const mat = el.mat || 'marble';
  const [x0, z0, x1, z1] = el.rect;
  const n = el.steps ?? 3, rise = el.rise, tread = el.tread;
  for (let i = 0; i < n; i++) {
    const o = (n - 1 - i) * tread;
    const y0 = el.y0 + i * rise, y1 = y0 + rise;
    bag.add(mat, box(x0 - o, (i === 0 ? el.y0 - (el.below ?? 0.6) : y0), z0 - o, x1 + o, y1, z1 + o));
    // solid steps, except where a flight of smaller steps is cut through them (el.cut)
    const ring = subtractRects([x0 - o, z0 - o, x1 + o, z1 + o], el.cut || []);
    for (const r of ring) col.rect(r, (i === 0 ? el.y0 - 0.6 : y0), y1);
    if (i > 0) col.floor([x0 - o - tread, z0 - o - tread, x1 + o + tread, z1 + o + tread], y0);
  }
  col.floor([x0, z0, x1, z1], el.y0 + n * rise);
}
