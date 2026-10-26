// Egyptian columns of the Late and Ptolemaic periods.
//
// A column is: a round base disc, a slightly tapering shaft bound under the capital by five
// bands, a floral capital, and a square abacus on which the architraves rest. Ptolemaic
// builders multiplied capital types — palm, open papyrus (campaniform), closed papyrus bud,
// lotus, and "composite" capitals of several tiers of flowers — and paired them across the
// axis of a hall or court. Proportions here follow Arnold, *Temples of the Last Pharaohs*
// (see docs/buildings/edfu.md): capital ≈ 0.22–0.26 of the height, open capitals spreading to
// about twice the shaft diameter, abacus ≈ shaft diameter wide.

import { lathe, disc, box, place } from '../../core/geom.js';

const TAU = Math.PI * 2;

/** Capital profiles: [[r, y]] for unit shaft radius 1 and unit capital height 1, plus a radial modulation. */
const CAPITALS = {
  // eight palm fronds bound to the top of the shaft, their tips curling outward
  palm: {
    profile: [[1.0, 0], [1.02, 0.15], [1.12, 0.4], [1.35, 0.7], [1.6, 0.9], [1.68, 0.97], [1.55, 1.0], [0.9, 1.0]],
    mod: (th, i) => {
      const lobes = 8, f = Math.abs(Math.cos(th * lobes / 2));
      const w = i / 7;
      return 1 + (0.02 + 0.12 * w) * (f * f - 0.4) + 0.025 * Math.cos(th * lobes * 3) * w;
    },
  },
  // open papyrus umbel: a smooth bell with incised sepals at the foot
  papyrus_open: {
    profile: [[1.0, 0], [1.0, 0.08], [1.08, 0.25], [1.3, 0.5], [1.65, 0.78], [1.95, 0.96], [1.95, 1.0], [0.9, 1.0]],
    mod: (th, i) => i <= 2 ? 1 + 0.035 * Math.max(0, Math.cos(th * 8)) : 1 + 0.008 * Math.cos(th * 48),
  },
  // closed papyrus bud: swells and draws in again under the abacus
  papyrus_bud: {
    profile: [[1.0, 0], [1.18, 0.18], [1.32, 0.4], [1.28, 0.62], [1.05, 0.85], [0.82, 0.98], [0.78, 1.0], [0.5, 1.0]],
    mod: (th) => 1 + 0.06 * Math.pow(Math.abs(Math.cos(th * 4)), 3),
  },
  // lotus: four great petals with smaller ones between
  lotus: {
    profile: [[1.0, 0], [1.06, 0.2], [1.25, 0.45], [1.5, 0.72], [1.7, 0.92], [1.66, 1.0], [0.9, 1.0]],
    mod: (th, i) => 1 + (i / 6) * (0.09 * Math.pow(Math.abs(Math.cos(th * 2)), 4) + 0.04 * Math.pow(Math.abs(Math.cos(th * 4 + Math.PI / 4)), 6) - 0.04),
  },
  // composite capitals: tiers of umbels and buds, each tier a different number of lobes
  composite_a: {
    profile: [[1.0, 0], [1.1, 0.12], [1.3, 0.3], [1.38, 0.36], [1.42, 0.42], [1.62, 0.62], [1.7, 0.68], [1.75, 0.74], [1.92, 0.93], [1.95, 1.0], [0.9, 1.0]],
    mod: (th, i) => {
      if (i < 4) return 1 + 0.07 * Math.pow(Math.abs(Math.cos(th * 2)), 2);
      if (i < 7) return 1 + 0.06 * Math.pow(Math.abs(Math.cos(th * 4 + 0.39)), 2);
      return 1 + 0.05 * Math.pow(Math.abs(Math.cos(th * 8)), 2);
    },
  },
  composite_b: {
    profile: [[1.0, 0], [1.18, 0.16], [1.28, 0.26], [1.3, 0.32], [1.5, 0.52], [1.58, 0.6], [1.62, 0.66], [1.88, 0.9], [1.9, 1.0], [0.9, 1.0]],
    mod: (th, i) => {
      if (i < 4) return 1 + 0.08 * Math.pow(Math.abs(Math.cos(th * 4)), 3);
      if (i < 7) return 1 + 0.07 * Math.pow(Math.abs(Math.cos(th * 8 + 0.2)), 3);
      return 1 + 0.04 * Math.pow(Math.abs(Math.cos(th * 16)), 2);
    },
  },
  composite_c: {
    profile: [[1.0, 0], [1.05, 0.1], [1.22, 0.24], [1.24, 0.3], [1.44, 0.45], [1.46, 0.5], [1.68, 0.7], [1.7, 0.76], [1.9, 0.94], [1.92, 1.0], [0.9, 1.0]],
    mod: (th, i) => {
      if (i < 4) return 1 + 0.06 * Math.pow(Math.abs(Math.cos(th * 3)), 2);
      if (i < 6) return 1 + 0.05 * Math.pow(Math.abs(Math.cos(th * 6 + 0.5)), 2);
      if (i < 8) return 1 + 0.05 * Math.pow(Math.abs(Math.cos(th * 12)), 2);
      return 1 + 0.03 * Math.cos(th * 24);
    },
  },
};

export const CAPITAL_TYPES = Object.keys(CAPITALS);

/**
 * Column element: { at:[x,z], y (foot), h (to top of abacus), d (lower shaft diameter), cap, mat }.
 * Optional: abacus (height), capH (fraction of h), bands (count).
 */
export function column(el, { bag, col }) {
  const [x, z] = el.at;
  const y = el.y ?? 0, H = el.h, R = el.d / 2;
  const mat = el.mat || 'sandstone_column';
  const capKind = CAPITALS[el.cap] ? el.cap : 'papyrus_open';
  const cap = CAPITALS[capKind];
  const baseH = Math.max(0.25, R * 0.45);
  const abH = el.abacus ?? Math.max(0.45, R * 0.75);
  const capH = H * (el.capH ?? 0.22);
  const shaftH = H - baseH - abH - capH;
  const topR = R * 0.9;                       // shafts taper slightly
  const seg = 40;

  // base: a round disc with a softened upper edge, wider than the shaft
  const bR = R * 1.32;
  bag.add(mat, lathe([[bR, 0], [bR, baseH * 0.75], [bR * 0.96, baseH], [R * 1.02, baseH]], seg, null, x, y, z));
  bag.add(mat, disc(bR * 0.97, y + baseH, seg, x, z));

  // shaft, slightly convex at the foot (a curved "Ptolemaic" foot), five bands below the capital
  const s0 = y + baseH, bandsTop = s0 + shaftH, bandH = Math.min(0.11, shaftH * 0.012);
  const nb = el.bands ?? 5;
  const prof = [[R * 0.94, 0], [R * 1.0, shaftH * 0.04], [R * 0.995, shaftH * 0.3], [(R + topR) / 2, shaftH * 0.6]];
  const bandStart = shaftH - nb * bandH * 2 - 0.05;
  prof.push([topR, bandStart]);
  for (let i = 0; i < nb; i++) {
    const y0 = bandStart + i * bandH * 2;
    prof.push([topR * 1.025, y0 + 0.01], [topR * 1.025, y0 + bandH], [topR, y0 + bandH + 0.01], [topR, y0 + bandH * 2]);
  }
  prof.push([topR, shaftH]);
  bag.add(mat, lathe(prof, seg, null, x, s0, z));

  // capital
  const cy = bandsTop;
  const capProfile = cap.profile.map(([r, t]) => [r * topR, t * capH]);
  bag.add(mat, lathe(capProfile, 64, cap.mod, x, cy, z));

  // abacus: a plain square block
  const aw = topR * 1.0;
  bag.add(mat, box(x - aw, cy + capH, z - aw, x + aw, cy + capH + abH, z + aw));

  col.circle(x, z, R * 1.05, y, y + H);   // the shaft; the base disc may run under screen walls
}

export { CAPITALS };
