#!/usr/bin/env node
// Loading check: opens the site headless and records the loading bar's text over time, how long
// each stage takes, that the world opens by itself (no button) and that the map can send the
// visitor somewhere.  usage: node tools/load-check.mjs [--quality medium]

import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const quality = args.includes('--quality') ? args[args.indexOf('--quality') + 1] : 'medium';
const srv = await serve(0);
const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); else if (m.text().includes('[memory palace]')) console.log(m.text()); });
await page.route('**/*', async (route) => {
  const m = route.request().url().match(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)$/);
  if (m) return route.fulfill({ path: join(ROOT, 'node_modules/three', m[1]), contentType: 'text/javascript' });
  return route.continue();
});
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?quality=${quality}`);
let last = '';
for (;;) {
  const st = await page.evaluate(() => ({ text: document.getElementById('intro-status')?.textContent, ready: window.READY === true, intro: !document.getElementById('intro').hidden }));
  if (st.text !== last) { console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s  ${st.text}`); last = st.text; }
  if (st.ready) break;
  if (Date.now() - t0 > 900_000) { console.log('timeout'); break; }
  await page.waitForTimeout(500);
}
await page.waitForTimeout(1200);
console.log('materials in scene:', await page.evaluate(() => { const m = new Map(); window.palace.renderer.scene.traverse((o) => { if (o.material && o.visible) { const k = (o.material.name || o.material.type) + (o.isInstancedMesh ? ' (inst)' : ''); m.set(k, (m.get(k) || 0) + 1); } }); return JSON.stringify([...m.entries()]); }));
console.log('pipelines:', await page.evaluate(() => { const r = window.palace.renderer.renderer, p = r._pipelines; return p ? JSON.stringify({ vertex: p.programs.vertex.size, fragment: p.programs.fragment.size, pipelines: p.caches.size }) : 'n/a'; }));
const ui = await page.evaluate(() => ({ intro: !document.getElementById('intro').hidden, hud: !document.getElementById('hud').hidden, enter: !!document.getElementById('btn-enter') }));
console.log(`open after ${((Date.now() - t0) / 1000).toFixed(1)}s: intro shown ${ui.intro}, hud shown ${ui.hud}, enter button ${ui.enter}`);
// the map: open it and click on the land far from any building
await page.keyboard.press('KeyM');
await page.waitForTimeout(800);
console.log('map open:', await page.evaluate(() => !document.getElementById('map').hidden), 'view:', await page.evaluate(() => JSON.stringify(window.palace.mapView?.view)));
const box = await page.locator('#map-canvas').boundingBox();
const before = await page.evaluate(() => window.palace.feet());
await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.62);
await page.waitForTimeout(400);
// the click starts the journey: the map closes and the visitor is told they are travelling
// (the arrival itself is the same path as the screenshot tool's poses)
const started = await page.evaluate(() => ({ closed: document.getElementById('map').hidden, notice: document.getElementById('notice').textContent }));
console.log(`map click: map closed ${started.closed}, notice "${started.notice}", from (${before.x.toFixed(0)}, ${before.z.toFixed(0)})`);
// wait for the arrival and time it
const tc = Date.now();
let after = before;
while (Date.now() - tc < 120_000) {
  after = await page.evaluate(() => window.palace.feet());
  if (Math.hypot(after.x - before.x, after.z - before.z) > 50) break;
  await page.waitForTimeout(200);
}
console.log(`map travel: arrived at (${after.x.toFixed(0)}, ${after.z.toFixed(0)}) after ${((Date.now() - tc) / 1000 + 0.4).toFixed(1)}s`);
const moved = started.closed && Math.hypot(after.x - before.x, after.z - before.z) > 50;
for (const e of errors.slice(0, 10)) console.log('error:', e);
await browser.close(); srv.close();
process.exit(ui.hud && ui.hud && !ui.enter && moved && !errors.length ? 0 : 1);
