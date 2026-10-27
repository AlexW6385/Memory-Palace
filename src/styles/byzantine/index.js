// Byzantine architecture (6th century, Constantinople): the vocabulary of Hagia Sophia.
// Domes on pendentives, semidomes and exedrae as parts of spheres cut by vertical planes;
// arches as half-annuli; walls in a vertical plane with arched openings and windows, built in
// horizontal bands so that every curved edge follows its circle; columns with Attic bases,
// monolithic shafts and basket capitals under an impost block.

import { BufferGeometry, Float32BufferAttribute } from 'three';
import { registerStyle } from '../../core/build.js';
import { box, frustum, lathe, fromTriangles, orientOutward, rod, disc } from '../../core/geom.js';
import { doors } from '../greek/objects.js';

const D2R = Math.PI / 180;

function geo(pos, nor) {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  return g;
}

// ── spheres cut by planes ────────────────────────────────────────────────────

/** Clip a convex polygon (list of [x,y,z]) to the half-space n·p ≤ d. */
function clipPoly(poly, n, d) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = n[0] * a[0] + n[1] * a[1] + n[2] * a[2] - d, db = n[0] * b[0] + n[1] * b[1] + n[2] * b[2] - d;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  return out;
}

/**
 * Part of a sphere (centre c, radius R) kept where every clip plane [nx, ny, nz, d] has
 * n·p ≤ d, between elevations e0…e1 and azimuths a0…a1 (degrees; azimuth 0 = +x, 90 = +z).
 * inward: normals toward the centre (the inside of a dome); otherwise outward (its roof).
 */
export function spherePatch({ c, R, clips = [], e0 = 0, e1 = 90, a0 = 0, a1 = 360, segA = 120, segE = 40, inward = true }) {
  const P = (a, e) => [c[0] + R * Math.cos(e) * Math.cos(a), c[1] + R * Math.sin(e), c[2] + R * Math.cos(e) * Math.sin(a)];
  const pos = [], nor = [];
  const nA = Math.max(4, Math.round(segA * (a1 - a0) / 360)), nE = Math.max(2, Math.round(segE * (e1 - e0) / 90));
  for (let i = 0; i < nA; i++) {
    const aa = (a0 + (a1 - a0) * i / nA) * D2R, ab = (a0 + (a1 - a0) * (i + 1) / nA) * D2R;
    for (let j = 0; j < nE; j++) {
      const ea = (e0 + (e1 - e0) * j / nE) * D2R, eb = (e0 + (e1 - e0) * (j + 1) / nE) * D2R;
      const quadPts = j === nE - 1 && e1 >= 89.999 ? [P(aa, ea), P(ab, ea), P(aa, eb)] : [P(aa, ea), P(ab, ea), P(ab, eb), P(aa, eb)];
      let poly = quadPts;
      for (const [nx, ny, nz, d] of clips) { poly = clipPoly(poly, [nx, ny, nz], d); if (poly.length < 3) break; }
      if (poly.length < 3) continue;
      // back onto the sphere
      poly = poly.map((p) => { const dx = p[0] - c[0], dy = p[1] - c[1], dz = p[2] - c[2], l = Math.hypot(dx, dy, dz) || 1; return [c[0] + dx * R / l, c[1] + dy * R / l, c[2] + dz * R / l]; });
      for (let k = 1; k < poly.length - 1; k++) {
        let tri = [poly[0], poly[k], poly[k + 1]];
        const ux = tri[1][0] - tri[0][0], uy = tri[1][1] - tri[0][1], uz = tri[1][2] - tri[0][2];
        const vx = tri[2][0] - tri[0][0], vy = tri[2][1] - tri[0][1], vz = tri[2][2] - tri[0][2];
        const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
        const mx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3 - c[0], my = (tri[0][1] + tri[1][1] + tri[2][1]) / 3 - c[1], mz = (tri[0][2] + tri[1][2] + tri[2][2]) / 3 - c[2];
        const out = fx * mx + fy * my + fz * mz > 0;
        if (out === inward) tri = [tri[0], tri[2], tri[1]];
        for (const p of tri) {
          pos.push(...p);
          const s = inward ? -1 / R : 1 / R;
          nor.push((p[0] - c[0]) * s, (p[1] - c[1]) * s, (p[2] - c[2]) * s);
        }
      }
    }
  }
  return geo(pos, nor);
}

// ── solids made of convex pieces ─────────────────────────────────────────────

/** Convex hexahedron from 8 corners (bottom 4, top 4, same order) → triangles, outward. */
function hexa(out, b, t) {
  const tris = [];
  const q = (a, b2, c, d) => tris.push(...a, ...b2, ...c, ...a, ...c, ...d);
  q(b[0], b[1], b[2], b[3]); q(t[0], t[3], t[2], t[1]);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; q(b[i], t[i], t[j], b[j]); }
  out.push(...orientOutward(tris));
}

/** Annular sector (arc wall) from r0 to r1 about (cx, cz), angles a0…a1 (deg, 0 = +x, 90 = +z). */
export function arcSolid(cx, cz, r0, r1, a0, a1, y0, y1, step = 4) {
  const out = [];
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / step));
  for (let i = 0; i < n; i++) {
    const aa = (a0 + (a1 - a0) * i / n) * D2R, ab = (a0 + (a1 - a0) * (i + 1) / n) * D2R;
    const pt = (r, a, y) => [cx + r * Math.cos(a), y, cz + r * Math.sin(a)];
    hexa(out, [pt(r0, aa, y0), pt(r1, aa, y0), pt(r1, ab, y0), pt(r0, ab, y0)], [pt(r0, aa, y1), pt(r1, aa, y1), pt(r1, ab, y1), pt(r0, ab, y1)]);
  }
  return fromTriangles(out);
}
function arcCollider(col, cx, cz, r0, r1, a0, a1, y0, y1, step = 8) {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / step));
  for (let i = 0; i < n; i++) {
    const aa = (a0 + (a1 - a0) * i / n) * D2R, ab = (a0 + (a1 - a0) * (i + 1) / n) * D2R;
    const pt = (r, a) => [cx + r * Math.cos(a), cz + r * Math.sin(a)];
    col.obstacles.push({ poly: [pt(r0, aa), pt(r1, aa), pt(r1, ab), pt(r0, ab)], y0, y1 });
  }
}

/**
 * A wall in a vertical plane. Frame: origin o [x, z], unit direction u [ux, uz] along the wall,
 * thickness th centred on the plane. The wall spans u0…u1 and y0…y1, except:
 *  - outline: optional semicircular top { uc, r, spring }: above the springing the wall is
 *    limited to |u − uc| ≤ √(r² − (y − spring)²) (a lunette under an arch);
 *  - arches: openings { uc, r, spring, sill } with semicircular heads, open from the sill
 *    (default y0) up; 'arcade: true' on the wall leaves no wall below the springing between
 *    adjacent arches (the columns carry them);
 *  - holes: rectangular windows { u0, u1, y0, y1 }.
 * Built in horizontal bands; each piece is a convex prism.
 */
export function planarWall(el) {
  const { o, u: [ux, uz], th, y0, y1 } = el;
  const u0 = el.u0, u1 = el.u1, arches = el.arches || [], holes = el.holes || [], top = el.outline;
  const nx = -uz, nz = ux;
  // band boundaries: every edge height and fine steps along each circle
  const ys = new Set([y0, y1]);
  const circ = (sp, r) => { for (let k = 0; k <= 14; k++) { const y = sp + r * Math.sin((k / 14) * Math.PI / 2); if (y > y0 && y < y1) ys.add(+y.toFixed(4)); } };
  for (const a of arches) { circ(a.spring, a.r); if (a.sill !== undefined && a.sill > y0) ys.add(a.sill); }
  for (const h of holes) { if (h.y0 > y0 && h.y0 < y1) ys.add(h.y0); if (h.y1 > y0 && h.y1 < y1) ys.add(h.y1); }
  if (top) { circ(top.spring, top.r); }
  const Y = [...ys].filter((y) => y >= y0 && y <= y1).sort((a, b) => a - b);
  const halfW = (r, sp, y) => (y <= sp ? r : Math.sqrt(Math.max(0, r * r - (y - sp) * (y - sp))));
  const out = [];
  const W = (u, y, s) => [o[0] + u * ux + s * nx, y, o[1] + u * uz + s * nz];
  for (let i = 0; i < Y.length - 1; i++) {
    const ya = Y[i], yb = Y[i + 1], ym = (ya + yb) / 2;
    if (yb - ya < 1e-4) continue;
    // outer limits at ya and yb
    let lo = [u0, u0], hi = [u1, u1];
    if (top) {
      if (ym > top.spring + top.r) continue;
      lo = [Math.max(u0, top.uc - halfW(top.r, top.spring, ya)), Math.max(u0, top.uc - halfW(top.r, top.spring, yb))];
      hi = [Math.min(u1, top.uc + halfW(top.r, top.spring, ya)), Math.min(u1, top.uc + halfW(top.r, top.spring, yb))];
    }
    // cuts at this band: [left(ya), left(yb), right(ya), right(yb)]
    const cuts = [];
    for (const a of arches) {
      const sill = a.sill ?? y0;
      if (ym < sill || ym > a.spring + a.r) continue;
      if (ym < a.spring) {
        // below the springing: an arcade leaves no wall between adjacent arches (the columns)
        if (el.arcade) continue;
        cuts.push([a.uc - a.r, a.uc - a.r, a.uc + a.r, a.uc + a.r]);
      } else {
        const ha = halfW(a.r, a.spring, ya), hb = halfW(a.r, a.spring, yb);
        cuts.push([a.uc - ha, a.uc - hb, a.uc + ha, a.uc + hb]);
      }
    }
    for (const h of holes) if (ym > h.y0 && ym < h.y1) cuts.push([h.u0, h.u0, h.u1, h.u1]);
    let pieces;
    if (el.arcade && arches.some((a) => ym < a.spring && ym >= (a.sill ?? y0))) {
      // only the ends outside the first and last arch remain below the springing
      const first = Math.min(...arches.map((a) => a.uc - a.r)), last = Math.max(...arches.map((a) => a.uc + a.r));
      pieces = el.noEnds ? [] : [[lo[0], lo[1], first, first], [last, last, hi[0], hi[1]]];
      for (const h of holes) if (ym > h.y0 && ym < h.y1) pieces = pieces.flatMap((p) => splitPiece(p, [h.u0, h.u0, h.u1, h.u1]));
    } else {
      cuts.sort((p, q) => (p[0] + p[2]) - (q[0] + q[2]));
      pieces = [];
      let cur = [lo[0], lo[1]];
      for (const c of cuts) { pieces.push([cur[0], cur[1], c[0], c[1]]); cur = [Math.max(cur[0], c[2]), Math.max(cur[1], c[3])]; }
      pieces.push([cur[0], cur[1], hi[0], hi[1]]);
    }
    for (const [la, lb, ra, rb] of pieces) {
      if (ra - la < 1e-3 && rb - lb < 1e-3) continue;
      if (ra < la - 1e-6 || rb < lb - 1e-6) continue;
      const s = th / 2;
      hexa(out, [W(la, ya, -s), W(ra, ya, -s), W(ra, ya, s), W(la, ya, s)], [W(lb, yb, -s), W(rb, yb, -s), W(rb, yb, s), W(lb, yb, s)]);
    }
  }
  return fromTriangles(out);
}
function splitPiece([la, lb, ra, rb], [cl, , cr]) {
  const res = [];
  if (cl > la) res.push([la, lb, Math.min(cl, ra), Math.min(cl, rb)]);
  if (cr < ra) res.push([Math.max(cr, la), Math.max(cr, lb), ra, rb]);
  return res;
}

// ── elements ─────────────────────────────────────────────────────────────────

/** A sphere patch as an element: { c [x,y,z], R, clips, e0, e1, a0, a1, mat, outer: { t, mat } }. */
function sphereEl(el, { bag }) {
  bag.add(el.mat, spherePatch({ ...el, inward: true }));
  if (el.outer) {
    const R = el.R + el.outer.t;
    bag.add(el.outer.mat, spherePatch({ ...el, R, clips: el.outerClips || el.clips, inward: false }));
  }
}

/**
 * Half-annulus arch (a great arch's soffit and face): centre c [x, y, z] at the springing,
 * span along 'x' or 'z', intrados r0, extrados r1, depth d0…d1 across the span (in the other
 * horizontal axis).
 */
function archBand(el, { bag }) {
  const [cx, cy, cz] = el.c, out = [], n = el.seg || 36;
  const P = (r, a, d) => (el.span === 'x' ? [cx + r * Math.cos(a), cy + r * Math.sin(a), d] : [d, cy + r * Math.sin(a), cz + r * Math.cos(a)]);
  for (let i = 0; i < n; i++) {
    const a = Math.PI * i / n, b = Math.PI * (i + 1) / n;
    hexa(out, [P(el.r0, a, el.d0), P(el.r1, a, el.d0), P(el.r1, b, el.d0), P(el.r0, b, el.d0)], [P(el.r0, a, el.d1), P(el.r1, a, el.d1), P(el.r1, b, el.d1), P(el.r0, b, el.d1)]);
  }
  bag.add(el.mat, fromTriangles(out));
}

/** A planar wall element (see planarWall); colliders for the parts within reach. */
function planarWallEl(el, { bag, col }) {
  bag.add(el.mat, planarWall(el));
  if (el.collide === false) return;
  // collision: split the wall at every opening's edges; in each stretch, solid wherever no
  // opening covers that height (a parapet below a sill still blocks)
  const [ux, uz] = el.u;
  const opens = [];
  for (const a of el.arches || []) opens.push({ u0: a.uc - a.r, u1: a.uc + a.r, y0: a.sill ?? el.y0, y1: a.spring + a.r });
  for (const h of el.holes || []) opens.push({ u0: h.u0, u1: h.u1, y0: h.y0, y1: h.y1 });
  if (el.arcade && el.arches?.length) {
    const sp = Math.min(...el.arches.map((a) => a.spring));
    opens.push({ u0: Math.min(...el.arches.map((a) => a.uc - a.r)), u1: Math.max(...el.arches.map((a) => a.uc + a.r)), y0: el.y0, y1: sp });
  }
  const U = [...new Set([el.u0, el.u1, ...opens.flatMap((o) => [o.u0, o.u1])])].filter((u) => u >= el.u0 && u <= el.u1).sort((p, q) => p - q);
  for (let i = 0; i < U.length - 1; i++) {
    const um = (U[i] + U[i + 1]) / 2;
    if (U[i + 1] - U[i] < 1e-3) continue;
    const cov = opens.filter((o) => um > o.u0 && um < o.u1).map((o) => [o.y0, o.y1]).sort((p, q) => p[0] - q[0]);
    let y = el.y0;
    const solid = [];
    for (const [a, b] of cov) { if (a > y) solid.push([y, a]); y = Math.max(y, b); }
    if (y < el.y1) solid.push([y, el.y1]);
    const p0 = [el.o[0] + U[i] * ux, el.o[1] + U[i] * uz], p1 = [el.o[0] + U[i + 1] * ux, el.o[1] + U[i + 1] * uz];
    for (const [a, b] of solid) if (b - a > 0.05) col.segment(p0, p1, el.th, a, b);
  }
}

/** Arc wall { c [x,z], r0, r1, a0, a1, y0, y1, gaps: [{ a, w (m), y0, y1 }] (windows/doors) }. */
function arcWall(el, { bag, col }) {
  const [cx, cz] = el.c, rm = (el.r0 + el.r1) / 2;
  const gaps = (el.gaps || []).map((g) => ({ ...g, h: (g.w / rm) / D2R / 2 })).sort((p, q) => p.a - q.a);
  // split the angular range at every gap edge; in each slice the wall is solid except the gap's heights
  const cutsA = new Set([el.a0, el.a1]);
  for (const g of gaps) { cutsA.add(g.a - g.h); cutsA.add(g.a + g.h); }
  const A = [...cutsA].filter((a) => a >= el.a0 && a <= el.a1).sort((p, q) => p - q);
  for (let i = 0; i < A.length - 1; i++) {
    const am = (A[i] + A[i + 1]) / 2;
    const g = gaps.find((q) => am > q.a - q.h && am < q.a + q.h);
    const spans = g ? [[el.y0, g.y0], [g.y1, el.y1]] : [[el.y0, el.y1]];
    for (const [y0, y1] of spans) if (y1 - y0 > 1e-3) bag.add(el.mat, arcSolid(cx, cz, el.r0, el.r1, A[i], A[i + 1], y0, y1, el.step || 4));
    if (el.collide !== false) {
      const cy0 = g ? (g.y0 > el.y0 + 1.5 ? el.y0 : g.y1) : el.y0;
      if (cy0 < el.y1) arcCollider(col, cx, cz, el.r0, el.r1, A[i], A[i + 1], cy0, el.y1);
    }
  }
}

/** Main dome: window ring and buttresses, ribbed cap; { c [x,z], y0, r, thick, win: { n, w, h }, crown }. */
function ribbedDome(el, { bag }) {
  const [cx, cz] = el.c, r = el.r, t = el.thick, n = el.win.n;
  const yw0 = el.y0, yw1 = el.y0 + el.win.h + 0.6;
  // the window zone: piers between the windows, a sill below and the cap above
  const wa = (el.win.w / r) / D2R;               // window width in degrees
  for (let k = 0; k < n; k++) {
    const a = k * 360 / n;
    bag.add(el.mat, arcSolid(cx, cz, r, r + t, a + wa / 2, a + 360 / n - wa / 2, yw0, yw1, 3));
    bag.add(el.outMat, arcSolid(cx, cz, r + t, r + t + 0.9, a + 360 / n / 2 - 1.3, a + 360 / n / 2 + 1.3, yw0, yw1 + 0.7, 3));   // exterior buttress
  }
  bag.add(el.mat, arcSolid(cx, cz, r, r + t, 0, 360, yw0 - 0.01, yw0 + 0.3, 3));
  // the cap: a sphere through the top of the window zone and the crown
  const H = el.crown - yw1, Rc = (r * r + H * H) / (2 * H), yc = el.crown - Rc;
  const e0 = Math.asin((yw1 - yc) / Rc) / D2R;
  bag.add(el.mat, spherePatch({ c: [cx, yc, cz], R: Rc, e0, e1: 90, segA: 160, segE: 36, inward: true }));
  // forty ribs on the inside, fading out toward the crown
  for (let k = 0; k < n; k++) {
    const a = (k * 360 / n + 360 / n / 2) * D2R, w = 0.28 / Rc;
    const tris = [];
    const steps = 24, eTop = e0 + (90 - e0) * 0.8;
    for (let j = 0; j < steps; j++) {
      const ea = (e0 + (eTop - e0) * j / steps) * D2R, eb = (e0 + (eTop - e0) * (j + 1) / steps) * D2R;
      const depthA = 0.22 * (1 - j / steps), depthB = 0.22 * (1 - (j + 1) / steps);
      const p = (R, e, aa) => [cx + R * Math.cos(e) * Math.cos(aa), yc + R * Math.sin(e), cz + R * Math.cos(e) * Math.sin(aa)];
      const b = [p(Rc + 0.02, ea, a - w), p(Rc - depthA, ea, a - w), p(Rc - depthA, ea, a + w), p(Rc + 0.02, ea, a + w)];
      const tt = [p(Rc + 0.02, eb, a - w), p(Rc - depthB, eb, a - w), p(Rc - depthB, eb, a + w), p(Rc + 0.02, eb, a + w)];
      hexa(tris, b, tt);
    }
    bag.add(el.mat, fromTriangles(tris));
  }
  // the roof: lead over a shell
  const Ro = Rc + t, eo = Math.asin(Math.min(1, (yw1 - yc) / Ro)) / D2R;
  bag.add(el.outMat, spherePatch({ c: [cx, yc, cz], R: Ro, e0: eo, e1: 90, segA: 120, segE: 30, inward: false }));
  bag.add(el.outMat, arcSolid(cx, cz, r - 0.05, Math.sqrt(Ro * Ro - (yw1 - yc) ** 2) + 0.05, 0, 360, yw1, yw1 + 0.35, 3));
}

/** Flat top of the square base of the dome, square half-size h minus a circle r, at y (with sides down to y0). */
function squareRing(el, { bag }) {
  const [cx, cz] = el.c, h = el.half, r = el.r, y = el.y, out = [];
  const n = 96;
  for (let i = 0; i < n; i++) {
    const a = 2 * Math.PI * i / n, b = 2 * Math.PI * (i + 1) / n;
    const sq = (t) => { const c = Math.cos(t), s = Math.sin(t), k = h / Math.max(Math.abs(c), Math.abs(s)); return [cx + c * k, cz + s * k]; };
    const A = sq(a), B = sq(b);
    out.push(cx + r * Math.cos(a), y, cz + r * Math.sin(a), cx + r * Math.cos(b), y, cz + r * Math.sin(b), B[0], y, B[1]);
    out.push(cx + r * Math.cos(a), y, cz + r * Math.sin(a), B[0], y, B[1], A[0], y, A[1]);
  }
  // make the top face point up
  for (let i = 0; i < out.length; i += 9) {
    const ux = out[i + 3] - out[i], uz = out[i + 5] - out[i + 2], vx = out[i + 6] - out[i], vz = out[i + 8] - out[i + 2];
    if (uz * vx - ux * vz < 0) for (let k = 0; k < 3; k++) { const tmp = out[i + 3 + k]; out[i + 3 + k] = out[i + 6 + k]; out[i + 6 + k] = tmp; }
  }
  bag.add(el.mat, fromTriangles(out));
  bag.add(el.mat, frustum([cx - h, cz - h, cx + h, cz + h], el.y0, y, 0, 0, 0, 0, { noTop: true, noBottom: true }));
}

/** Column: Attic base, monolithic shaft, basket capital and impost block. h is the total height. */
function column(el, { bag, col }) {
  const [x, z] = el.at, y = el.y, d = el.d, h = el.h, r = d / 2;
  const baseH = 0.45 * d, capH = 0.75 * d, impH = el.impost === false ? 0 : 0.32 * d;
  const shaftH = h - baseH - capH - impH;
  const capMat = el.capMat || 'marble_smooth';
  bag.add(capMat, frustum([x - r * 1.25, z - r * 1.25, x + r * 1.25, z + r * 1.25], y, y + baseH * 0.35, 0, 0, 0, 0));
  bag.add(capMat, lathe([[r * 1.22, 0], [r * 1.18, baseH * 0.18], [r * 1.04, baseH * 0.32], [r * 0.98, baseH * 0.5], [r * 1.12, baseH * 0.6], [r * 1.05, baseH * 0.8], [r * 1.0, baseH]], 24, null, x, y + baseH * 0.35, z));
  bag.add(el.shaftMat || 'verde_antico', lathe([[r, 0], [r * 0.97, shaftH * 0.5], [r * 0.9, shaftH]], 24, null, x, y + baseH, z));
  // the necking ring
  bag.add('silver', lathe([[r * 0.93, 0], [r * 0.95, 0.06], [r * 0.95, 0.12], [r * 0.93, 0.18]], 24, null, x, y + baseH + shaftH - 0.2, z));
  // the basket capital: round below, square above
  const yc = y + baseH + shaftH, sq = r * 1.25;
  bag.add(capMat, lathe([[r * 0.9, 0], [r * 0.98, capH * 0.15]], 24, null, x, yc, z));
  bag.add(capMat, frustum([x - r * 0.9, z - r * 0.9, x + r * 0.9, z + r * 0.9], yc + capH * 0.15, yc + capH, -(sq - r * 0.9), -(sq - r * 0.9), -(sq - r * 0.9), -(sq - r * 0.9)));
  if (impH) bag.add(capMat, frustum([x - sq, z - sq, x + sq, z + sq], yc + capH, yc + capH + impH, -0.12 * d, -0.12 * d, -0.12 * d, -0.12 * d));
  col.circle(x, z, r * 1.1, y, y + h);
}

// ── objects ──────────────────────────────────────────────────────────────────

/** Polykandelon: a ring of glass oil lamps hung on chains; { at [x,z], y, r, n, top }. */
function polykandelon(el, { bag, lights }) {
  const [x, z] = el.at, y = el.y, r = el.r, n = el.n || 16;
  bag.add('silver', lathe([[r - 0.04, 0], [r + 0.04, 0], [r + 0.04, 0.06], [r - 0.04, 0.06], [r - 0.04, 0]], 48, null, x, y, z));
  for (let k = 0; k < n; k++) {
    const a = 2 * Math.PI * k / n, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    bag.add('glass_lamp', lathe([[0.001, 0], [0.07, 0.04], [0.1, 0.14], [0.09, 0.2]], 8, null, px, y - 0.18, pz));
    bag.add('flame', lathe([[0.001, 0], [0.025, 0.03], [0.001, 0.09]], 6, null, px, y + 0.02, pz));
  }
  // chains to the vault
  for (let k = 0; k < 3; k++) { const a = 2 * Math.PI * k / 3; bag.add('bronze', rod([x + Math.cos(a) * r, y + 0.06, z + Math.sin(a) * r], [x, y + Math.min(3, (el.top - y) * 0.3), z], 0.012, 4)); }
  bag.add('bronze', rod([x, y + Math.min(3, (el.top - y) * 0.3), z], [x, el.top, z], 0.02, 4));
  const nl = el.lights || (el.light ? 1 : 0);
  for (let k = 0; k < nl; k++) {
    const a = 2 * Math.PI * (k + 0.5) / nl;
    lights.push({ at: [x + Math.cos(a) * r, y + 0.02, z + Math.sin(a) * r], color: '#ffb46b', intensity: el.light, distance: el.distance ?? Math.max(8, r * 3) });
  }
}

/** Ambo: an oval platform on eight posts within eight columns, with a stair east and west. */
function ambo(el, { bag, col }) {
  const [x, z] = el.at, y = el.y ?? 0, a = el.rx || 3.0, b = el.rz || 2.1, H = el.h || 2.4;
  const plat = lathe([[0.001, H - 0.3], [1, H - 0.3], [1, H], [0.001, H]], 32);
  plat.scale(a, 1, b); plat.translate(x, y, z); bag.add('marble_smooth', plat);
  const par = lathe([[0.96, H], [1, H], [1, H + 1.05], [0.96, H + 1.05]], 40);
  par.scale(a, 1, b); par.translate(x, y, z); bag.add('revetment_green', par);
  for (let k = 0; k < 8; k++) {
    const t = 2 * Math.PI * (k + 0.5) / 8;
    bag.add('verde_antico', lathe([[0.13, 0], [0.12, H - 0.3]], 12, null, x + Math.cos(t) * a * 0.62, y, z + Math.sin(t) * b * 0.62));
    column({ at: [x + Math.cos(t) * (a + 0.55), z + Math.sin(t) * (b + 0.55)], y, h: H + 2.2, d: 0.34, shaftMat: 'verde_antico', impost: false }, { bag, col: { circle() {} } });
  }
  col.rect([x - a, z - b, x + a, z + b], y, y + H + 1.05);
  // stairs up from east and west
  for (const s of [-1, 1]) {
    const x0 = x + s * a * 0.95, x1 = x + s * (a + 4.2);
    const n = Math.round(H / 0.2);
    for (let i = 0; i < n; i++) {
      const f0 = i / n, f1 = (i + 1) / n;
      const xa = x1 + (x0 - x1) * f0, xb = x0;
      bag.add('marble_smooth', box(Math.min(xa, xb), y, z - 0.7, Math.max(xa, xb), y + H * f1 - 0.0, z + 0.7));
    }
    bag.add('revetment_green', box(Math.min(x0, x1), y, z - 0.85, Math.max(x0, x1), y + 1.0, z - 0.7));
    bag.add('revetment_green', box(Math.min(x0, x1), y, z + 0.7, Math.max(x0, x1), y + 1.0, z + 0.85));
    col.rect([Math.min(x0, x1), z - 0.9, Math.max(x0, x1), z + 0.9], y, y + H);
  }
}

/** Ciborium over the altar: four columns, arches, a pyramidal roof in silver; and the altar. */
function ciborium(el, { bag, col }) {
  const [x, z] = el.at, y = el.y ?? 0, s = el.s || 2.6, H = el.h || 5.2;
  bag.add('silver', box(x - 1.3, y, z - 0.8, x + 1.3, y + 1.1, z + 0.8));
  col.rect([x - 1.3, z - 0.8, x + 1.3, z + 0.8], y, y + 1.1);
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) column({ at: [x + dx * s, z + dz * s], y, h: H, d: 0.42, shaftMat: 'silver', capMat: 'gold', impost: false }, { bag, col });
  for (const [a, b] of [[[-s, -s], [s, -s]], [[s, -s], [s, s]], [[s, s], [-s, s]], [[-s, s], [-s, -s]]]) {
    bag.add('silver', box(x + Math.min(a[0], b[0]) - 0.25, y + H, z + Math.min(a[1], b[1]) - 0.25, x + Math.max(a[0], b[0]) + 0.25, y + H + 0.9, z + Math.max(a[1], b[1]) + 0.25));
  }
  bag.add('silver', lathe([[s * 1.45, 0], [0.15, s * 1.0], [0.001, s * 1.05]], 4, null, x, y + H + 0.9, z).rotateY(0));
  bag.add('gold', lathe([[0.12, 0], [0.18, 0.2], [0.001, 0.5]], 8, null, x, y + H + 0.9 + s * 1.05, z));
}

/** Synthronon: tiers of seats round the apse, the patriarch's throne at the centre; { c [x,z], r, a0, a1, tiers }. */
function synthronon(el, { bag, col }) {
  const [cx, cz] = el.c, y = el.y ?? 0;
  for (let t = 0; t < el.tiers; t++) {
    bag.add('proconnesian', arcSolid(cx, cz, el.r - 0.75 * (t + 1), el.r, el.a0, el.a1, y, y + 0.45 * (t + 1), 6));
  }
  arcCollider(col, cx, cz, el.r - 0.75 * el.tiers, el.r, el.a0, el.a1, y, y + 0.45 * el.tiers);
}

/** Chancel screen: low marble parapets between columns carrying an architrave; { a, b, y, n, gap } */
function chancelScreen(el, { bag, col }) {
  const [ax, az] = el.a, [bx, bz] = el.b, y = el.y ?? 0, n = el.n;
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
  const H = el.h || 4.2;
  for (let i = 0; i <= n; i++) {
    const t = i * L / n;
    column({ at: [ax + ux * t, az + uz * t], y, h: H, d: 0.36, shaftMat: 'silver', capMat: 'silver', impost: false }, { bag, col });
  }
  for (let i = 0; i < n; i++) {
    if (el.gaps && el.gaps.includes(i)) continue;
    const t0 = i * L / n + 0.2, t1 = (i + 1) * L / n - 0.2;
    const p0 = [ax + ux * t0, az + uz * t0], p1 = [ax + ux * t1, az + uz * t1];
    bag.add('revetment_green', box(Math.min(p0[0], p1[0]) - 0.06, y, Math.min(p0[1], p1[1]) - 0.06, Math.max(p0[0], p1[0]) + 0.06, y + 1.0, Math.max(p0[1], p1[1]) + 0.06));
    col.segment(p0, p1, 0.2, y, y + 1.0);
  }
  bag.add('silver', box(Math.min(ax, bx) - 0.25, y + H, Math.min(az, bz) - 0.25, Math.max(ax, bx) + 0.25, y + H + 0.55, Math.max(az, bz) + 0.25));
}

/** A low walled path (the solea) from the ambo to the chancel. */
function solea(el, { bag, col }) {
  const [x0, z0, x1, z1] = el.rect, y = el.y ?? 0;
  for (const z of [z0, z1]) { bag.add('revetment_green', box(x0, y, z - 0.1, x1, y + 0.95, z + 0.1)); col.segment([x0, z], [x1, z], 0.2, y, y + 0.95); }
  bag.add('proconnesian', box(x0, y, z0, x1, y + 0.18, z1));
  col.floor([x0, z0, x1, z1], y + 0.18);
}

/** Fountain (phiale) in the atrium: a round basin on steps with a central jet pillar. */
function phiale(el, { bag, col }) {
  const [x, z] = el.at, y = el.y ?? 0, r = el.r || 2.4;
  bag.add('marble', lathe([[r + 0.6, 0], [r + 0.6, 0.18], [r + 0.25, 0.18], [r + 0.25, 0.36]], 40, null, x, y, z));
  bag.add('verde_antico', lathe([[r, 0.3], [r + 0.1, 0.9], [r - 0.12, 0.95], [r - 0.15, 0.4]], 40, null, x, y, z));
  bag.add('water', disc(r - 0.15, y + 0.78, 40, x, z));
  bag.add('marble', lathe([[0.35, 0.3], [0.25, 1.2], [0.5, 1.5], [0.1, 1.9]], 16, null, x, y, z));
  col.circle(x, z, r + 0.1, y, y + 0.95);
}

registerStyle('byzantine', {
  column,
  trim: () => {},
  opening: () => {},
  elements: { sphere: sphereEl, arch_band: archBand, planar_wall: planarWallEl, arc_wall: arcWall, ribbed_dome: ribbedDome, square_ring: squareRing },
  objects: { doors, polykandelon, ambo, ciborium, synthronon, chancel_screen: chancelScreen, solea, phiale },
});

