#!/usr/bin/env node
// Audio check: start the music as a visitor would (the Enter button) at every building and
// measure that sound actually reaches the output, in each of the building's zones.
//
// usage: node tools/audio-check.mjs

import { chromium } from 'playwright';
import { join } from 'node:path';
import { serve, ROOT } from './serve.mjs';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
const srv = await serve(0);
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.route('**/*', (route) => {
  const m = route.request().url().match(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)$/);
  return m ? route.fulfill({ path: join(ROOT, 'node_modules/three', m[1]), contentType: 'text/javascript' }) : route.continue();
});
await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?quality=low`);
await page.waitForFunction('window.READY === true', null, { timeout: 600_000 });
await page.click('#btn-enter');                       // the real gesture path
let failed = 0;
const plans = await page.evaluate(() => [...window.palace.world.plans.values()].filter((p) => !p.plan.feature).map((p) => ({ id: p.id, rooms: p.plan.rooms.map((r) => r.kind) })));
for (const p of plans) {
  await page.evaluate((id) => window.palace.entrance(id), p.id);
  // frames are slow in software rendering: wait until the music has taken up this building
  await page.waitForFunction((id) => window.palace.music.zone && window.palace.world.locate(...window.palace.renderer.camera.position.toArray()).building?.id === id, p.id, { timeout: 300_000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const r = await page.evaluate(() => {
    const m = window.palace.music;
    let peak = 0;
    return new Promise((ok) => {
      let n = 0;
      const t = setInterval(() => { try { const h = window.palace.world.locate(...window.palace.renderer.camera.position.toArray()); m.lastBuilding = h.building?.id + '/' + (h.room?.id ?? '-'); } catch (e) { m.lastBuilding = 'ERR ' + e.message; } peak = Math.max(peak, m.level()); if (++n >= 30) { clearInterval(t); ok({ peak, state: m.ctx?.state, zone: m.zone, layers: m.layers.size, at: m.lastBuilding, feet: JSON.stringify(window.palace.feet()) }); } }, 100);
    });
  });
  const ok = r.peak > 0.003;
  if (!ok) failed++;
  console.log(`${p.id}: ${ok ? 'ok' : 'SILENT'} — peak RMS ${r.peak.toFixed(4)}, context ${r.state}, zone ${r.zone}, layers ${r.layers}, at ${r.at}, feet ${r.feet}`);
}
for (const e of errors) console.log('  pageerror: ' + e);
await browser.close();
srv.close();
process.exit(failed || errors.length ? 1 : 0);
