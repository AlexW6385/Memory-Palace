#!/usr/bin/env node
// Budget check (DESIGN.md §6): initial load ≤ 15 MB, each building's on-demand data ≤ 25 MB,
// every committed file ≤ 50 MB, the repository ≤ 500 MB. Sizes are as transferred (gzip).

import { readFile, readdir, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BUILDINGS } from '../src/buildings/index.js';

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
let firstBuilding = 0;
for (const b of BUILDINGS) {
  let bytes = 0;
  try { bytes += (await stat(join(ROOT, 'data/gi', `${b.id}.gi`))).size; }   // already compressed
     catch { /* not baked */ }
  report(`building ${b.id} on-demand data`, bytes, 25 * MB);
  if (!firstBuilding) firstBuilding = bytes;
}
report('initial load (site + three.js + first building)', site + lib + firstBuilding, 15 * MB);

// committed files
const files = execSync('git ls-files', { cwd: ROOT }).toString().trim().split('\n').filter(Boolean);
let total = 0, biggest = ['', 0];
for (const f of files) {
  try { const s = (await stat(join(ROOT, f))).size; total += s; if (s > biggest[1]) biggest = [f, s]; } catch { /* deleted */ }
}
report(`largest committed file (${biggest[0]})`, biggest[1], 50 * MB);
report('repository (working tree of committed files)', total, 500 * MB);
process.exit(fail ? 1 : 0);
