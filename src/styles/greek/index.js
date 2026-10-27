// The Greek architectural vocabulary (Classical Doric and Ionic, Athens, 5th century BC).
import { registerStyle } from '../../core/build.js';
import { box } from '../../core/geom.js';
import { doricColumn, ionicColumn } from './columns.js';
import { doricEntablature, pedimentRoof, coffers, krepis } from './order.js';
import { opening, doors, basin, athenaParthenos } from './objects.js';

/** Wall crown: a projecting moulded band (hawksbeak and fillet) along the top of a wall. */
function trim(el, { bag }) {
  const t = el.trim, mat = el.mat || 'marble';
  if (!t.crown) return;
  let r;
  if (el.t === 'wall') {
    const [ax, az] = el.a, [bx, bz] = el.b, h = el.th / 2;
    r = [Math.min(ax, bx) - (ax === bx ? h : 0), Math.min(az, bz) - (az === bz ? h : 0), Math.max(ax, bx) + (ax === bx ? h : 0), Math.max(az, bz) + (az === bz ? h : 0)];
  } else r = el.rect;
  const p = t.projection ?? 0.08, y1 = el.y1;
  bag.add(mat, box(r[0] - p, y1 - t.crown, r[1] - p, r[2] + p, y1, r[3] + p));
  bag.add(mat, box(r[0] - p * 0.4, y1 - t.crown * 1.6, r[1] - p * 0.4, r[2] + p * 0.4, y1 - t.crown, r[3] + p * 0.4));
}

export const greek = {
  column: (el, ctx) => (el.order === 'ionic' ? ionicColumn(el, ctx) : doricColumn(el, ctx)),
  trim,
  opening,
  elements: { doric_entablature: doricEntablature, pediment_roof: pedimentRoof, coffers, krepis },
  objects: { doors, basin, athena_parthenos: athenaParthenos },
};

registerStyle('greek', greek);
