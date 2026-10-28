// Plans build to finite geometry and pass the plan check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BUILDINGS } from '../src/buildings/index.js';
import { buildPlan } from '../src/core/build.js';
import { MATERIALS } from '../src/core/palette.js';
import { FEATURES } from '../src/world/features/index.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

for (const b of BUILDINGS) {
  test(`${b.id}: geometry is finite and uses known materials`, async () => {
    const { plan, music } = await b.load();
    const built = buildPlan(plan);
    assert.ok(built.parts.length > 0);
    for (const { mat, geometry } of built.parts) {
      assert.ok(MATERIALS[mat], `unknown material ${mat}`);
      const p = geometry.attributes.position.array;
      for (let i = 0; i < p.length; i++) assert.ok(Number.isFinite(p[i]), `${mat}: non-finite vertex`);
    }
    assert.ok(music && music.zones, 'building has a score');
    for (const r of plan.rooms) assert.ok(music.zones[r.kind], `room kind ${r.kind} has music`);
  });
}

test('plan check passes', () => {
  execFileSync('node', ['tools/plan-check.mjs'], { cwd: ROOT, stdio: 'pipe' });
});

test('walk-through check passes', () => {
  execFileSync('node', ['tools/walk-check.mjs'], { cwd: ROOT, stdio: 'pipe' });
});

test('road check passes (every street of the city walkable past the houses)', () => {
  execFileSync('node', ['tools/road-check.mjs'], { cwd: ROOT, stdio: 'pipe' });
});

test('each district quarter builds, within the bounds given before it loads', async () => {
  for (const f of FEATURES) {
    const { plan } = await f.load();
    assert.ok(plan.elements.length > 20, `${f.id}: too few houses`);
    const [a, b, c, d] = plan.bounds, [A, B, C, D] = f.bounds;
    assert.ok(a >= A && b >= B && c <= C && d <= D, `${f.id}: houses outside its bounds`);
    for (const { mat, geometry } of buildPlan(plan).parts) {
      assert.ok(MATERIALS[mat], `unknown material ${mat}`);
      assert.ok(geometry.attributes.position.array.every(Number.isFinite), `${f.id}: non-finite vertex`);
    }
  }
});
