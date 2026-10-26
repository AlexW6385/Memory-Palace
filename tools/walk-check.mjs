#!/usr/bin/env node
// Walk-through check: a walker with the viewer's own body and movement follows each building's
// routes (plan.walks, local [x, z] waypoints) and must reach every waypoint.
//
// usage: node tools/walk-check.mjs [building-id ...]

import { BUILDINGS } from '../src/buildings/index.js';
import { buildPlan, toWorld } from '../src/core/build.js';
import { CollisionWorld } from '../src/core/collide.js';
import { move, WALK } from '../src/core/walk.js';

const ids = process.argv.slice(2);
let failed = 0;
for (const b of BUILDINGS) {
  if (ids.length && !ids.includes(b.id)) continue;
  const { plan } = await b.load();
  const cw = new CollisionWorld();
  cw.add(buildPlan(plan).colliders);
  const problems = [];
  let legs = 0;
  for (const [ri, route] of (plan.walks || []).entries()) {
    const W = route.map(([x, z]) => toWorld(plan, x, z));
    const P = { x: W[0][0], y: 0, z: W[0][2], vy: 0 };
    P.y = cw.groundAt(P.x, P.z, 50);
    // start on the floor at the first waypoint: the highest walkable surface below head height
    P.y = cw.groundAt(P.x, P.z, (route.y0 ?? 0) + 0.5);
    for (let k = 1; k < W.length; k++) {
      const [tx, , tz] = W[k];
      const dist = Math.hypot(tx - P.x, tz - P.z);
      const limit = dist / WALK * 2.5 + 3;
      let t = 0, ok = false;
      while (t < limit) {
        const dx = tx - P.x, dz = tz - P.z, d = Math.hypot(dx, dz);
        if (d < 0.35) { ok = true; break; }
        const sp = Math.min(WALK / 60, d);
        move(P, dx / d * sp, dz / d * sp, 1 / 60, cw);
        t += 1 / 60;
      }
      legs++;
      if (!ok) { problems.push(`route ${ri + 1}: stuck before waypoint ${k} (${route[k]}) at (${P.x.toFixed(1)}, ${P.y.toFixed(2)}, ${P.z.toFixed(1)})`); break; }
    }
  }
  console.log(`${b.id}: ${problems.length ? 'FAIL' : 'ok'} — ${(plan.walks || []).length} routes, ${legs} legs walked`);
  for (const p of problems) console.log('  - ' + p);
  if (problems.length) failed++;
}
process.exit(failed ? 1 : 0);
