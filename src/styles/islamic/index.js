// Early Islamic architecture (Umayyad, late 7th century): the vocabulary of the Dome of the Rock
// and the Dome of the Chain. It grows from the late Roman and Byzantine builders it employed:
// reused Corinthian columns tied by gilded beams, round arches, walls of masonry dressed in marble
// below and glass mosaic above, timber domes on drums. The planar walls, arc walls and cut spheres
// are shared with the Byzantine style.

import { registerStyle } from '../../core/build.js';
import { box, lathe, fromTriangles, orientOutward } from '../../core/geom.js';
import { byzantineElements } from '../byzantine/index.js';
import { roman } from '../roman/index.js';
import { doors } from '../greek/objects.js';

const D2R = Math.PI / 180;

/** Flip a geometry to face the other way (the inside of a shell). */
function flip(g) {
  const p = g.attributes.position.array, n = g.attributes.normal.array;
  for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) {
    const a = i + 3 + k, b = i + 6 + k;
    [p[a], p[b]] = [p[b], p[a]]; [n[a], n[b]] = [n[b], n[a]];
  }
  for (let i = 0; i < n.length; i++) n[i] = -n[i];
  return g;
}

/** A surface of revolution: { c [x, z], y, profile [[r, dy] …] (bottom → top), seg, inward, mat }. */
function latheShell(el, { bag }) {
  const g = lathe(el.profile, el.seg || 64, null, el.c[0], el.y, el.c[1]);
  bag.add(el.mat, el.inward ? flip(g) : g);
}

/** Distance from the centre to a regular polygon (n sides, apothem a, a side centred at angle rot) along direction t. */
export function polyR(n, a, rot, t) {
  const k = 2 * Math.PI / n;
  const d = (((t - rot) % k) + k * 1.5) % k - k / 2;
  return a / Math.cos(d);
}

function upward(out) {
  for (let i = 0; i < out.length; i += 9) {
    const ux = out[i + 3] - out[i], uz = out[i + 5] - out[i + 2], vx = out[i + 6] - out[i], vz = out[i + 8] - out[i + 2];
    if (uz * vx - ux * vz < 0) for (let k = 0; k < 3; k++) { const t = out[i + 3 + k]; out[i + 3 + k] = out[i + 6 + k]; out[i + 6 + k] = t; }
  }
  return out;
}

/**
 * Ring between two outlines in plan — each { n (sides; 0 = circle), a (apothem or radius), rot (deg) } —
 * as a flat slab y0…y1 (ceilings), or, with slope: true, a roof rising from the outer outline at
 * y0 to the inner at y1 (top face only).
 */
function ringSlab(el, { bag }) {
  const [cx, cz] = el.c, N = el.seg || 96;
  const R = (o, t) => (o.n ? polyR(o.n, o.a, (o.rot || 0) * D2R, t) : o.a);
  const out = [];
  for (let i = 0; i < N; i++) {
    const a = 2 * Math.PI * i / N, b = 2 * Math.PI * (i + 1) / N;
    const P = (o, t, y) => [cx + Math.cos(t) * R(o, t), y, cz + Math.sin(t) * R(o, t)];
    if (el.slope) {
      out.push(...upward([...P(el.outer, a, el.y0), ...P(el.outer, b, el.y0), ...P(el.inner, b, el.y1), ...P(el.outer, a, el.y0), ...P(el.inner, b, el.y1), ...P(el.inner, a, el.y1)]));
    } else {
      const ob = [P(el.outer, a, el.y0), P(el.outer, b, el.y0), P(el.inner, b, el.y0), P(el.inner, a, el.y0)];
      const ot = ob.map((p) => [p[0], el.y1, p[2]]);
      const tris = [];
      const q = (A, B, C, D) => tris.push(...A, ...B, ...C, ...A, ...C, ...D);
      q(ob[0], ob[1], ob[2], ob[3]); q(ot[0], ot[3], ot[2], ot[1]);
      // top up, bottom down
      for (let k = 0; k < tris.length; k += 9) {
        const ux = tris[k + 3] - tris[k], uz = tris[k + 5] - tris[k + 2], vx = tris[k + 6] - tris[k], vz = tris[k + 8] - tris[k + 2];
        const up = uz * vx - ux * vz > 0, isTop = tris[k + 1] > el.y0 + 1e-4;
        if (up !== isTop) for (let m = 0; m < 3; m++) { const t = tris[k + 3 + m]; tris[k + 3 + m] = tris[k + 6 + m]; tris[k + 6 + m] = t; }
      }
      out.push(...tris);
    }
  }
  bag.add(el.mat, fromTriangles(out));
}

/** The Rock: a bare outcrop, an irregular low mound; { at [x, z], y, rx, rz, h }. */
function rock(el, { bag, col }) {
  const [x, z] = el.at, y = el.y ?? 0, rx = el.rx, rz = el.rz, H = el.h;
  const n = 48, m = 16;
  const ht = (u, v) => {
    const r = Math.hypot(u, v);
    if (r >= 1) return -0.2;
    const bumps = 0.25 * Math.sin(u * 7.1 + 1.3) * Math.cos(v * 5.3 + 0.4) + 0.15 * Math.sin(u * 13 + v * 9) + 0.06 * Math.sin(u * 31 - v * 23);
    return H * Math.pow(1 - r * r, 0.55) * (0.8 + bumps) * (u > 0.2 ? 0.75 : 1);
  };
  const wob = (a) => 1 + 0.12 * Math.sin(a * 3 + 1) + 0.08 * Math.sin(a * 7);
  const P = (a, r) => [x + Math.cos(a) * r * wob(a) * rx, y + ht(Math.cos(a) * r, Math.sin(a) * r), z + Math.sin(a) * r * wob(a) * rz];
  const tris = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const a0 = 2 * Math.PI * i / n, a1 = 2 * Math.PI * (i + 1) / n, r0 = j / m, r1 = (j + 1) / m;
    const A = P(a0, r0), B = P(a1, r0), C = P(a1, r1), D = P(a0, r1);
    tris.push(...A, ...D, ...C, ...A, ...C, ...B);
  }
  bag.add('rock_boulder', fromTriangles(upward(tris)));
  col.circle(x, z, Math.min(rx, rz) * 0.85, y, y + H);
}

/** A low wooden screen between two points: posts and rails. */
function screen(el, { bag, col }) {
  const [ax, az] = el.a, [bx, bz] = el.b, y = el.y ?? 0, h = el.h ?? 1.4;
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
  const n = Math.max(1, Math.round(L / 0.3));
  for (let i = 0; i <= n; i++) {
    const t = i * L / n, px = ax + ux * t, pz = az + uz * t;
    bag.add('cedar', box(px - 0.035, y, pz - 0.035, px + 0.035, y + h, pz + 0.035));
  }
  for (const yy of [y + 0.08, y + h * 0.5, y + h - 0.06]) {
    const nx = -uz * 0.05, nz = ux * 0.05, tris = [];
    const q = (A, B, C, D) => tris.push(...A, ...B, ...C, ...A, ...C, ...D);
    const P = (t, s, y2) => [ax + ux * t + nx * s, y2, az + uz * t + nz * s];
    const lo = yy - 0.05, hi = yy + 0.05;
    q(P(0, -1, lo), P(L, -1, lo), P(L, 1, lo), P(0, 1, lo));
    q(P(0, -1, hi), P(0, 1, hi), P(L, 1, hi), P(L, -1, hi));
    q(P(0, -1, lo), P(0, -1, hi), P(L, -1, hi), P(L, -1, lo));
    q(P(0, 1, lo), P(L, 1, lo), P(L, 1, hi), P(0, 1, hi));
    q(P(0, -1, lo), P(0, 1, lo), P(0, 1, hi), P(0, -1, hi));
    q(P(L, -1, lo), P(L, -1, hi), P(L, 1, hi), P(L, 1, lo));
    bag.add('cedar', fromTriangles(orientOutward(tris)));
  }
  col.segment(el.a, el.b, 0.2, y, y + h);
}

/** A mihrab: a niche framed in marble, a gold arch over it; { at [x, z], y, w, h, d } facing −z (north) into the room. */
function mihrab(el, { bag, col }) {
  const [x, z] = el.at, y = el.y ?? 0, w = el.w || 1.4, h = el.h || 2.8, d = el.d || 0.6;
  bag.add('revetment_byz', box(x - w / 2 - 0.7, y, z, x - w / 2, y + h, z + d + 0.3));
  bag.add('revetment_byz', box(x + w / 2, y, z, x + w / 2 + 0.7, y + h, z + d + 0.3));
  bag.add('revetment_byz', box(x - w / 2, y, z + d, x + w / 2, y + h, z + d + 0.3));
  bag.add('mosaic_gold', box(x - w / 2 - 0.7, y + h, z, x + w / 2 + 0.7, y + h + 0.9, z + d + 0.3));
  col.rect([x - w / 2 - 0.7, z, x + w / 2 + 0.7, z + d + 0.3], y, y + h + 0.9);
}

registerStyle('islamic', {
  column: roman.column,
  trim: () => {},
  opening: () => {},
  elements: { ...byzantineElements, lathe_shell: latheShell, ring_slab: ringSlab },
  objects: { doors, rock, screen, mihrab },
});
