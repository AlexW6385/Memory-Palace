#!/usr/bin/env node
// Screenshots at fixed viewpoints (tools/viewpoints.json) in headless Chromium.
//
// usage: node tools/shot.mjs [--building edfu] [--only name,name] [--size 1280x800]
//                            [--out shots] [--webgl] [--quality high] [--wait 2500]
//        node tools/shot.mjs --pose x,y,z,yaw,pitch --name custom      (world coordinates, feet)
//        node tools/shot.mjs --cam x,y,z,yaw,pitch --name custom       (free camera)
//
// three.js is served from node_modules instead of the CDN; Google Fonts are skipped.
// Headless Chromium uses SwiftShader, a software GPU: slow, but it is real WebGPU.

import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { serve, ROOT } from './serve.mjs';
import { BUILDINGS } from '../src/buildings/index.js';
import { toWorld } from '../src/core/build.js';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes('--' + k);
const [W, H] = opt('size', '1280x800').split('x').map(Number);
const out = opt('out', join(ROOT, 'shots'));
const wait = +opt('wait', 2500);
await mkdir(out, { recursive: true });

let views = [];
if (opt('pose') || opt('cam')) {
  const v = (opt('pose') || opt('cam')).split(',').map(Number);
  views.push({ name: opt('name', 'custom'), world: v.slice(0, 3), yaw: v[3] || 0, pitch: v[4] || 0, free: !!opt('cam') });
} else {
  const all = JSON.parse(await readFile(join(ROOT, 'tools/viewpoints.json'), 'utf8'));
  const only = opt('only') ? opt('only').split(',') : null;
  for (const v of all.world || []) {
    if (opt('building') && opt('building') !== 'world') continue;
    if (only && !only.includes(v.name)) continue;
    views.push({ name: `world-${v.name}`, world: v.at, yaw: v.yaw, pitch: v.pitch, free: true, aboveGround: true });
  }
  for (const b of BUILDINGS) {
    if (opt('building') && opt('building') !== b.id) continue;
    const { plan } = await b.load();
    for (const v of all[b.id] || []) {
      if (only && !only.includes(v.name)) continue;
      const p = toWorld(plan, v.at[0], v.at[2], v.at[1]);
      views.push({ name: `${b.id}-${v.name}`, world: p, yaw: v.yaw - (plan.yaw || 0) * Math.PI / 180, pitch: v.pitch, free: v.at[1] > 20 });
    }
  }
}

const srv = await serve(0);
const port = srv.address().port;
const gpuArgs = flag('webgl') ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] :
  ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args: [...gpuArgs, '--ignore-gpu-blocklist'] });
const mobile = W < 700;
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
const log = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) log.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => log.push(`pageerror: ${e.message}`));
await page.route('**/*', async (route) => {
  const url = route.request().url();
  const m = url.match(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)$/);
  if (m) return route.fulfill({ path: join(ROOT, 'node_modules/three', m[1]), contentType: 'text/javascript' });
  if (/fonts\.(googleapis|gstatic)/.test(url)) return route.abort();
  return route.continue();
});
const t0 = Date.now();
const q = `quality=${opt('quality', 'high')}` + (flag('webgl') ? '' : '');
if (flag('webgl')) await page.addInitScript(() => { Object.defineProperty(navigator, 'gpu', { get: () => undefined }); });
await page.goto(`http://127.0.0.1:${port}/index.html?${q}`);
try { await page.waitForFunction('window.READY === true', null, { timeout: 600_000 }); }
catch (e) { log.push('timeout waiting for READY'); }
console.log(`ready after ${((Date.now() - t0) / 1000).toFixed(1)}s (${await page.evaluate(() => window.palace?.renderer.webgpu ? 'WebGPU' : 'WebGL2')})`);
if (!flag('intro')) await page.evaluate(() => { document.getElementById('intro').hidden = true; document.getElementById('notice').hidden = true; const h = document.getElementById('click-hint'); if (h) h.style.display = 'none'; const hud = document.getElementById('hud'); if (hud) hud.style.display = 'none'; });
else await page.evaluate(() => { document.getElementById('stick').hidden = !matchMedia('(pointer: coarse)').matches; });
if (opt('eval')) console.log('eval:', await page.evaluate(opt('eval')));
if (flag('begin')) { await page.evaluate(() => window.palace.begin()); await page.waitForTimeout(8000); console.log('after begin:', await page.evaluate(() => JSON.stringify(window.palace.stats))); }
for (const v of views) {
  const t1 = Date.now();
  await page.evaluate(([v]) => v.free ? window.palace.camera(v.world[0], v.aboveGround ? window.palace.ground(v.world[0], v.world[2]) + Math.max(1.7, v.world[1]) : v.world[1], v.world[2], v.yaw, v.pitch) : window.palace.pose(v.world[0], v.world[1], v.world[2], v.yaw, v.pitch), [v]);
  await page.waitForTimeout(wait);
  const file = join(out, `${v.name}.png`);
  await page.screenshot({ path: file, timeout: 600_000 });
  console.log(`${v.name}: ${((Date.now() - t1) / 1000).toFixed(1)}s → ${file}`);
}
await browser.close();
srv.close();
const uniq = [...new Set(log)];
for (const l of uniq.slice(0, 25)) console.log('  ' + l.slice(0, 400));
process.exit(uniq.some((l) => l.startsWith('pageerror') || l.startsWith('error')) ? 1 : 0);
