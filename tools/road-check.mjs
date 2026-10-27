#!/usr/bin/env node
// Road check: a walker with the viewer's body and movement follows every road of the world from
// end to end — over the passes between the regions and across the rivers on their bridges — with
// the buildings and features standing beside them, and must reach every point.
//
// usage: node tools/road-check.mjs [road-id ...]

import { BUILDINGS } from '../src/buildings/index.js';
import { FEATURES } from '../src/world/features/index.js';
import { buildPlan } from '../src/core/build.js';
import { CollisionWorld } from '../src/core/collide.js';
import { terrainHeight, inWater, ROADS } from '../src/world/regions.js';
import { move, WALK } from '../src/core/walk.js';

const ids = process.argv.slice(2);
const cw = new CollisionWorld();
cw.terrain = terrainHeight;
cw.water = inWater;
for (const e of [...BUILDINGS, ...FEATURES.filter((f) => f.id.startsWith('bridge-'))]) cw.add(buildPlan((await e.load()).plan).colliders);

let failed = 0;
for (const road of ROADS) {
  if (ids.length && !ids.includes(road.id)) continue;
  const W = road.points;
  const P = { x: W[0][0], y: 0, z: W[0][1], vy: 0 };
  P.y = cw.groundAt(P.x, P.z, terrainHeight(P.x, P.z) + 60);
  let problem = null, length = 0;
  for (let k = 1; k < W.length && !problem; k++) {
    // walk the leg in short steps toward points along it, so the walker keeps to the road
    const [ax, az] = W[k - 1], [bx, bz] = W[k], L = Math.hypot(bx - ax, bz - az);
    length += L;
    for (let s = Math.min(8, L); s <= L + 1e-6 && !problem; s = s + 8 > L && s < L ? L : s + 8) {
      const tx = ax + (bx - ax) * s / L, tz = az + (bz - az) * s / L;
      let t = 0, ok = false;
      const limit = Math.hypot(tx - P.x, tz - P.z) / WALK * 3 + 3;
      while (t < limit) {
        const dx = tx - P.x, dz = tz - P.z, d = Math.hypot(dx, dz);
        if (d < 0.6) { ok = true; break; }
        const sp = Math.min(WALK / 60, d);
        move(P, dx / d * sp, dz / d * sp, 1 / 60, cw);
        t += 1 / 60;
      }
      if (!ok) problem = `stuck on leg ${k} near (${tx.toFixed(0)}, ${tz.toFixed(0)}) at (${P.x.toFixed(1)}, ${P.y.toFixed(1)}, ${P.z.toFixed(1)})`;
    }
  }
  console.log(`${road.id}: ${problem ? 'FAIL' : 'ok'} — ${(length / 1000).toFixed(2)} km`);
  if (problem) { console.log('  - ' + problem); failed++; }
}
process.exit(failed ? 1 : 0);
