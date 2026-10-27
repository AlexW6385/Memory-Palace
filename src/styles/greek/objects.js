// Greek fittings and sculpture: door frames and bronze-clad doors, the shallow water basin
// before the cult statue, and the Athena Parthenos of Pheidias (docs/buildings/parthenon.md §8).

import { Matrix4 } from 'three';
import { box, lathe, rod, disc, place } from '../../core/geom.js';
import { orientedBox } from '../../core/build.js';
import { merge } from './columns.js';

/** Door frame for an opening in a Greek wall: jambs and lintel in three fasciae, a crowning cornice. */
export function opening(el, o, f, { bag }) {
  if (o.frame === false) return;
  const mat = el.mat || 'marble';
  const nx = -f.uz, nz = f.ux;
  const sill = o.y0, top = o.y0 + o.h;
  const fw = o.frameW ?? Math.min(0.75, o.w * 0.14);
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const proj = 0.04 + k * 0.035, w = fw * (1 - k * 0.28);
      const off = side * (el.th / 2 + proj / 2);
      const c = (s) => [f.ax + f.ux * s + nx * off, f.az + f.uz * s + nz * off];
      bag.add(mat, orientedBox(c(o.s0 - w), c(o.s0), proj, sill, top + w));
      bag.add(mat, orientedBox(c(o.s1), c(o.s1 + w), proj, sill, top + w));
      bag.add(mat, orientedBox(c(o.s0 - w), c(o.s1 + w), proj, top, top + w));
    }
    // the hyperthyron: a cornice slab over the frame
    const off2 = side * (el.th / 2 + 0.16);
    const c2 = (s) => [f.ax + f.ux * s + nx * off2, f.az + f.uz * s + nz * off2];
    bag.add(mat, orientedBox(c2(o.s0 - fw - 0.25), c2(o.s1 + fw + 0.25), 0.32, top + fw, top + fw + 0.32));
  }
}

/** A pair of tall doors of wood sheathed in bronze, standing open inward against the reveals. */
export function doors(el, { bag, col }) {
  const [x, z] = el.at, y = el.y ?? 0, yaw = el.yaw ?? 0;
  const W = el.w, H = el.h, T = el.th ?? 0.2, depth = el.depth ?? 0.1, leaf = W / 2;
  const wood = [], bronze = [];
  for (const s of [-1, 1]) {
    wood.push(box(s * W / 2 - (s > 0 ? T : 0), 0, depth, s * W / 2 + (s < 0 ? T : 0), H, depth + leaf));
    // bronze panels in a grid on the inner face, with bosses
    for (let r = 0; r < 4; r++) {
      const y0 = 0.4 + r * (H - 0.8) / 4, y1 = y0 + (H - 0.8) / 4 - 0.25;
      const xf = s * W / 2 - (s > 0 ? T + 0.03 : -T);
      bronze.push(box(Math.min(xf, xf + 0.03), y0, depth + 0.15, Math.max(xf, xf + 0.03), y1, depth + leaf - 0.15));
    }
  }
  const m = new Matrix4().makeRotationY(yaw).setPosition(x, y, z);
  for (const [list, mat] of [[wood, 'cedar'], [bronze, 'bronze']]) { const g = merge(list); g.applyMatrix4(m); bag.add(mat, g); }
  const c = Math.round(Math.cos(yaw)), sn = Math.round(Math.sin(yaw));
  for (const s of [-1, 1]) {
    const lx0 = s * W / 2 - (s > 0 ? T : 0), lx1 = s * W / 2 + (s < 0 ? T : 0);
    const pts = [[lx0, depth], [lx1, depth + leaf]].map(([u, v]) => [x + c * u + sn * v, z - sn * u + c * v]);
    col.rect([Math.min(pts[0][0], pts[1][0]), Math.min(pts[0][1], pts[1][1]), Math.max(pts[0][0], pts[1][0]), Math.max(pts[0][1], pts[1][1])], y, y + H);
  }
}

/** Shallow basin of water with a marble curb, set into the floor. */
export function basin(el, { bag, col }) {
  const [x0, z0, x1, z1] = el.rect, y = el.y ?? 0, c = el.curb ?? 0.25, h = el.h ?? 0.18;
  const mat = el.mat || 'marble_dark';
  bag.add(mat, box(x0, y, z0, x1, y + h, z0 + c));
  bag.add(mat, box(x0, y, z1 - c, x1, y + h, z1));
  bag.add(mat, box(x0, y, z0 + c, x0 + c, y + h, z1 - c));
  bag.add(mat, box(x1 - c, y, z0 + c, x1, y + h, z1 - c));
  bag.add(mat, box(x0 + c, y - 0.05, z0 + c, x1 - c, y + 0.02, z1 - c));
  bag.add('water', box(x0 + c, y + 0.02, z0 + c, x1 - c, y + h - 0.04, z1 - c));
  col.rect([x0, z0, x1, z1], y, y + h);
}

/**
 * Athena Parthenos (Pheidias, 438 BC), gold and ivory, about 11.5 m high, on its pedestal
 * (8.043 × 4.096 m). She stands frontally in her peplos with the aegis on her breast and the
 * triple-crested helmet; on her right hand a Nike about 1.8 m tall (the hand supported by a
 * column, as in the reduced copies), her left hand on the rim of the shield that rests on the
 * ground beside her, the serpent coiled within it, the spear against her left shoulder.
 * A sculptural massing at L2: the forms and proportions are right, the carving is not yet.
 * Local: facing +z, pedestal centred at the origin.
 */
export function athenaParthenos(el, { bag, col }) {
  const [x, z] = el.at, y = el.y ?? 0, yaw = el.yaw ?? 0;
  const PW = 8.043, PD = 4.096, PH = el.pedestal ?? 1.2;
  const gold = [], ivory = [], stone = [];
  // pedestal: plinth, die (with the birth of Pandora in relief: L3), crown moulding
  stone.push(box(-PW / 2, 0, -PD / 2, PW / 2, 0.22, PD / 2));
  stone.push(box(-PW / 2 + 0.12, 0.22, -PD / 2 + 0.12, PW / 2 - 0.12, PH - 0.2, PD / 2 - 0.12));
  stone.push(box(-PW / 2 + 0.02, PH - 0.2, -PD / 2 + 0.02, PW / 2 - 0.02, PH, PD / 2 - 0.02));
  const F = PH;                                   // foot level
  const S = 11.5 / 11.5;
  // peplos: from the feet to the waist, the folds as deep vertical flutes
  const skirt = lathe([[1.15, 0], [1.2, 0.3], [1.12, 1.8], [1.02, 3.4], [0.92, 4.6], [0.82, 5.2]], 72,
    (th, i) => 1 + (i > 0 ? 0.05 : 0.03) * Math.cos(th * 18) * (th > Math.PI ? 1 : 0.6), 0, F, 0);
  gold.push(skirt);
  // the overfold (apoptygma) and belt
  gold.push(lathe([[0.95, 0], [1.0, 0.25], [0.93, 1.0], [0.84, 1.4]], 64, (th) => 1 + 0.035 * Math.cos(th * 14), 0, F + 4.4, 0));
  gold.push(lathe([[0.86, 0], [0.88, 0.12], [0.86, 0.24]], 32, null, 0, F + 5.75, 0));
  // torso and shoulders under the aegis
  const torso = lathe([[0.84, 0], [0.88, 0.6], [0.9, 1.3], [0.82, 1.8], [0.55, 2.05], [0.3, 2.15]], 40, null, 0, F + 5.9, 0);
  torso.applyMatrix4(new Matrix4().makeScale(1.12, 1, 0.78).setPosition(0, 0, 0));
  gold.push(torso);
  // aegis: a scaly cape across the breast with the gorgoneion at its centre
  const aegis = lathe([[0.95, 0], [0.98, 0.5], [0.86, 0.95], [0.45, 1.15]], 40, (th) => 1 + 0.04 * Math.cos(th * 30), 0, F + 6.9, 0);
  aegis.applyMatrix4(new Matrix4().makeScale(1.12, 1, 0.82));
  gold.push(aegis);
  ivory.push(place(disc(0.22, 0, 20), 0, F + 7.35, 0.82));
  ivory[ivory.length - 1].applyMatrix4(new Matrix4().makeTranslation(0, 0, 0));
  // neck and head (ivory), the Attic helmet with three crests (gold)
  ivory.push(lathe([[0.22, 0], [0.21, 0.35], [0.25, 0.4]], 20, null, 0, F + 8.0, 0.05));
  const head = lathe([[0.0, 0], [0.28, 0.08], [0.36, 0.35], [0.35, 0.7], [0.26, 0.92], [0.0, 1.0]], 24, null, 0, F + 8.35, 0.08);
  head.applyMatrix4(new Matrix4().makeScale(0.92, 1, 1.05));
  ivory.push(head);
  gold.push(lathe([[0.0, 0.0], [0.4, 0.0], [0.44, 0.35], [0.4, 0.65], [0.0, 0.8]], 24, null, 0, F + 8.95, -0.02));   // helmet bowl
  gold.push(box(-0.42, F + 8.85, 0.18, 0.42, F + 9.0, 0.5));                                                        // visor
  for (const [cx, h] of [[0, 1.2], [-0.32, 0.85], [0.32, 0.85]]) gold.push(box(cx - 0.07, F + 9.5, -0.55, cx + 0.07, F + 9.5 + h, 0.25));
  // right arm forward, holding the Nike, the hand on a column
  gold.push(rod([0.92, F + 7.4, 0.0], [1.35, F + 6.5, 0.6], 0.24, 12));
  ivory.push(rod([1.35, F + 6.5, 0.6], [1.55, F + 6.2, 1.9], 0.19, 12));
  stone.push(lathe([[0.26, 0], [0.24, F + 5.95 - 0.1], [0.36, F + 5.95]], 24, null, 1.6, 0, 1.95));
  const nike = [lathe([[0.32, 0], [0.28, 0.9], [0.2, 1.3], [0.14, 1.55], [0.0, 1.8]], 20, null, 1.6, F + 6.2, 2.0)];
  for (const s of [-1, 1]) nike.push(box(1.6 + s * 0.04, F + 7.1, 1.65, 1.6 + s * 0.65, F + 7.9, 1.95));   // wings
  gold.push(...nike);
  // left arm down to the shield rim
  gold.push(rod([-0.92, F + 7.4, 0.0], [-1.3, F + 6.2, 0.15], 0.24, 12));
  ivory.push(rod([-1.3, F + 6.2, 0.15], [-1.75, F + 5.2, 0.3], 0.19, 12));
  // the shield (about 4.8 m), resting on its rim on the pedestal at her left, turned outward
  const sh = lathe([[0.0, -0.06], [2.38, -0.16], [2.4, -0.1], [2.3, -0.02], [1.6, 0.06], [0.0, 0.12]], 48);   // bottom to top, so normals face out
  sh.applyMatrix4(new Matrix4().makeRotationZ(Math.PI / 2).premultiply(new Matrix4().makeRotationY(-0.35)).setPosition(-2.25, F + 2.42, 0.15));
  gold.push(sh);
  // the serpent coiled inside the shield
  const coil = [];
  for (let k = 0; k < 30; k++) {
    const a = k * 0.42, r = 0.5 + k * 0.025;
    coil.push(rod([-2.05, F + 0.6 + r * Math.sin(a) * 0.8 + k * 0.03, 0.15 + r * Math.cos(a) * 0.9], [-2.05, F + 0.6 + (r + 0.025) * Math.sin(a + 0.42) * 0.8 + (k + 1) * 0.03, 0.15 + (r + 0.025) * Math.cos(a + 0.42) * 0.9], 0.11, 8));
  }
  gold.push(...coil);
  // the spear, leaning against her left shoulder
  gold.push(rod([-1.55, F, -0.4], [-1.05, F + 11.0, -0.25], 0.06, 8));
  const m = new Matrix4().makeRotationY(yaw).setPosition(x, y, z);
  for (const [list, mat] of [[gold, 'gold'], [ivory, 'ivory'], [stone, el.pedestalMat || 'marble_dark']]) {
    const g = merge(list);
    g.applyMatrix4(m);
    bag.add(mat, g);
  }
  const q = Math.round(yaw / (Math.PI / 2)) % 2 !== 0;
  const hw = (q ? PD : PW) / 2 + 0.1, hd = (q ? PW : PD) / 2 + 0.1;
  col.rect([x - hw, z - hd, x + hw, z + hd], y, y + PH + 10);
}
