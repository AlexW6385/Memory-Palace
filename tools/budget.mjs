#!/usr/bin/env node
// Budget check (DESIGN.md §6): initial load ≤ 15 MB, each building's on-demand data ≤ 25 MB,
// every committed file ≤ 50 MB, the repository ≤ 500 MB. Sizes are as transferred (gzip).

import { readFile, readdir, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BUILDINGS } from '../src/buildings/index.js';
import { toWorld } from '../src/core/build.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MB = 1e6;
const gz = async (f) => gzipSync(await readFile(f), { level: 6 }).length;
let fail = false;
const report = (name, bytes, limit) => {
  const ok = bytes <= limit;
  if (!ok) fail = true;
  console.log(`${ok ? 'ok  ' : 'OVER'} ${name}: ${(bytes / MB).toFixed(2)} MB (limit ${limit / MB} MB)`);
};

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p)); else out.push(p);
  }
  return out;
}

// the site's own code and styles (all modules may be fetched at start)
let site = await gz(join(ROOT, 'index.html'));
for (const f of await walk(join(ROOT, 'src'))) site += await gz(f);
// three.js from the CDN: core, TSL and the addons we import
const three = ['build/three.webgpu.js', 'build/three.tsl.js', 'build/three.core.js',
  'examples/jsm/tsl/display/GTAONode.js', 'examples/jsm/tsl/display/BloomNode.js', 'examples/jsm/tsl/display/SMAANode.js',
  'examples/jsm/csm/CSMShadowNode.js', 'examples/jsm/csm/CSMFrustum.js', 'examples/jsm/objects/SkyMesh.js'];
let lib = 0;
for (const f of three) { try { lib += await gz(join(ROOT, 'node_modules/three', f)); } catch { /* not installed */ } }
// per-building data loaded on demand
// the viewer builds everything within LOAD_RADIUS of the first building's entrance at start
const LOAD_RADIUS = 650;
let atStart = 0, start = null;
for (const b of BUILDINGS) {
  const { plan } = await b.load();
  let bytes = 0;
  try { bytes += (await stat(join(ROOT, 'data/gi', `${b.id}.gi`))).size; } catch { /* not baked */ }   // already compressed
  report(`building ${b.id} on-demand data`, bytes, 25 * MB);
  const p = toWorld(plan, plan.entrance.at[0], plan.entrance.at[1]);
  if (!start) start = p;
  const c0 = toWorld(plan, plan.bounds[0], plan.bounds[1]), c1 = toWorld(plan, plan.bounds[2], plan.bounds[3]);
  const d = Math.hypot(Math.max(Math.min(c0[0], c1[0]) - start[0], 0, start[0] - Math.max(c0[0], c1[0])), Math.max(Math.min(c0[2], c1[2]) - start[2], 0, start[2] - Math.max(c0[2], c1[2])));
  if (d < LOAD_RADIUS) atStart += bytes;
}
report('initial load (site + three.js + buildings near the start)', site + lib + atStart, 15 * MB);

// committed files
const files = execSync('git ls-files', { cwd: ROOT }).toString().trim().split('\n').filter(Boolean);
let total = 0, biggest = ['', 0];
for (const f of files) {
  try { const s = (await stat(join(ROOT, f))).size; total += s; if (s > biggest[1]) biggest = [f, s]; } catch { /* deleted */ }
}
report(`largest committed file (${biggest[0]})`, biggest[1], 50 * MB);
report('repository (working tree of committed files)', total, 500 * MB);
process.exit(fail ? 1 : 0);
