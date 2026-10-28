// Memory Palace — boot, interface and the frame loop.

import { Renderer } from './engine/renderer.js';
import { World } from './engine/world.js';
import { Controls } from './engine/controls.js';
import { Music } from './engine/audio.js';
import { Climate } from './engine/climate.js';
import { Rain } from './engine/rain.js';
import { MapView } from './ui/map.js';
import { initLang, setLang, t, onLang } from './ui/i18n.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

// the default picture quality follows the machine: 'high' only on machines with many cores and
// much memory (a laptop with 8 cores and 8 GB starts at 'medium'; the setting can be changed)
const strong = (navigator.hardwareConcurrency || 4) >= 10 && (navigator.deviceMemory || 8) >= 8;
const settings = load('mp.settings', { quality: strong ? 'high' : 'medium', music: 0.6, sensitivity: 1, time: 'cycle' });
if (params.get('time')) settings.time = params.get('time');
if (params.get('quality')) settings.quality = params.get('quality');

function load(k, d) { try { return { ...d, ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch { return d; } }
function save() { try { localStorage.setItem('mp.settings', JSON.stringify(settings)); } catch { /* ignore */ } }

/**
 * The loading bar: stages with weights, the fraction done of each, and the time left, estimated
 * from this load's pace and (when there is one) how long the last load took on this machine.
 */
class Progress {
  constructor(bar, text) {
    this.bar = bar; this.text = text;
    this.t0 = performance.now();
    this.w = { start: 0.1, land: 0.34, build: 0.2, plants: 0.12, shaders: 0.24 };
    this.f = {}; this.stage = 'start'; this.marks = {};
    try { this.prev = JSON.parse(localStorage.getItem('mp.loadtime') || 'null'); } catch { this.prev = null; }
    this.timer = setInterval(() => this.paint(), 250);
  }
  set(stage, f) {
    if (stage !== this.stage) { this.marks[this.stage] = performance.now(); this.stage = stage; }
    this.f[stage] = Math.max(this.f[stage] || 0, Math.min(1, f));
    this.paint();
  }
  value() { let v = 0; for (const k in this.w) v += this.w[k] * (this.f[k] || 0); return v; }
  paint() {
    const el = (performance.now() - this.t0) / 1000;
    // while the shaders compile there is no fraction to report: creep toward the expected time
    if (this.stage === 'shaders' && this.shaderT0) {
      // without a previous load to go by, expect the shaders to take about as long again as everything before them
      this.shaderExp ??= this.prev?.shaders || Math.max(4, (this.shaderT0 - this.t0) / 1000 * 1.2);
      const exp = this.shaderExp;
      this.f.shaders = Math.min(0.95, 1 - Math.exp(-((performance.now() - this.shaderT0) / 1000) / exp * 1.6));
    }
    const p = this.value();
    this.bar.style.width = `${(p * 100).toFixed(1)}%`;
    let left = null;
    if (this.stage === 'shaders' && this.shaderT0) {
      left = Math.max(0, this.shaderExp * 1.15 - (performance.now() - this.shaderT0) / 1000);
    } else if (p > 0.04) {
      const est = el / p - el;
      left = this.prev?.total ? Math.max(0, 0.5 * est + 0.5 * (this.prev.total - el)) : est;
    }
    const tail = left === null ? '' : left < 1.5 ? ` · ${t('left-done')}` : ` · ${t('left-s').replace('{n}', Math.ceil(left))}`;
    // name the first stage still under way (several run at once)
    const stage = ['start', 'build', 'land', 'plants', 'shaders'].find((k) => (this.f[k] || 0) < 1) || this.stage;
    this.text.textContent = `${t('st-' + stage)} · ${Math.round(p * 100)}%${tail}`;
  }
  finish() {
    clearInterval(this.timer);
    const total = (performance.now() - this.t0) / 1000;
    const shaders = this.shaderT0 ? (performance.now() - this.shaderT0) / 1000 : 0;
    try { localStorage.setItem('mp.loadtime', JSON.stringify({ total, shaders })); } catch { /* ignore */ }
    this.bar.style.width = '100%';
  }
}

async function main() {
  initLang();
  const status = $('intro-status');
  const progress = new Progress($('progress-bar'), status);
  const canvas = $('view');
  if (!navigator.gpu) { $('notice').textContent = t('no-webgpu'); $('notice').hidden = false; setTimeout(() => { $('notice').hidden = true; }, 12000); }

  // timings of the start, in the console (and kept for the next visit's estimate)
  const T0 = performance.now(), times = {};
  const mark = (k) => { times[k] = Math.round(performance.now() - T0); };
  progress.set('start', 0.15);
  const R = await new Renderer(canvas).init(settings.quality);
  mark('renderer');
  progress.set('start', 0.7);
  const world = new World(R);
  await world.init();
  mark('plans');
  progress.set('start', 1);
  const climate = new Climate(R);
  // the time of day: days pass ('cycle', from the first region's baked moment), each region's baked
  // moment ('baked'), or an hour held
  const applyTime = (v) => {
    const h = parseFloat(v);
    if (Number.isFinite(h)) climate.setTime(h);
    else climate.setTime(v === 'baked' ? 'baked' : 'cycle');
  };
  climate.hour = 16.5;
  applyTime(settings.time);
  const floraScale = { high: 1, medium: 0.7, low: 0.45 };
  world.flora.scale = floraScale[settings.quality] ?? 1;
  const controls = new Controls(R.camera, canvas, world.collide);
  controls.sensitivity = settings.sensitivity;
  const music = new Music();
  music.setVolume(settings.music);

  // start at the first building's entrance, or at a pose given in the URL (x,y,z,yaw,pitch)
  const first = [...world.plans.values()].find((p) => !p.plan.feature && p.id === 'edfu') || [...world.plans.values()].find((p) => !p.plan.feature);
  // arriving somewhere: the buildings and the ground near it are made before the view is shown;
  // the far land and plants keep coming in afterwards
  // only what is close is waited for (the buildings within sight, the ground and the plants
  // round the visitor's feet); everything further comes in while walking
  const arrive = async (x, z, report = null) => {
    world.unloadFar(x, z);                            // what is far from the new place is let go first
    const near = [...world.plans.values()].filter((p) => World.distance(p.plan, x, z) < 220);
    let built = 0;
    const buildings = Promise.all(near.map((p) => world.loadBuilding(p.entry).then(() => { built++; report?.('build', built / near.length); })));
    if (!near.length) report?.('build', 1);
    await Promise.all([
      buildings.then(() => mark('buildings')),
      world.terrain.ready(x, z, (f) => report?.('land', f), 260).then(() => mark('land')),
      world.flora.ready(x, z, (f) => report?.('plants', f), 140).then(() => mark('plants')),
    ]);
    world.ensureNear(x, z);                           // the rest within range, in the background
    climate.update(x, z, 0);
  };
  const boot = (stage, f) => progress.set(stage, f);
  const goTo = async (rec, report) => {
    const [x, y, z, yaw] = world.entrance(rec.plan);
    await arrive(x, z, report);
    controls.setPose(x, y, z, yaw, 0.04);
  };
  if (params.get('pose')) {
    const p = params.get('pose').split(',').map(Number);
    await arrive(p[0], p[2], boot);
    controls.setPose(p[0], p[1], p[2], p[3] || 0, p[4] || 0);
  } else await goTo(first, boot);

  progress.set('shaders', 0);
  progress.shaderT0 = performance.now();
  world.update(R.camera.position);
  await R.warmup();
  mark('shaders');
  console.info('[memory palace] start (ms):', JSON.stringify(times));
  progress.set('shaders', 1);
  progress.finish();

  // interface: the world opens by itself; a click (or a key) starts looking and the music
  const intro = $('intro'), hud = $('hud'), mapPanel = $('map'), setPanel = $('settings'), hint = $('click-hint');
  intro.classList.add('fading');
  setTimeout(() => { intro.hidden = true; intro.classList.remove('fading'); }, 850);
  hud.hidden = false;
  $('stick').hidden = !controls.touch;
  controls.enabled = true;
  hint.hidden = controls.touch;
  const panelsOpen = () => !mapPanel.hidden || !setPanel.hidden;
  const begin = () => { music.start(); controls.enabled = true; hint.hidden = true; };
  canvas.addEventListener('pointerdown', () => { music.start(); if (!panelsOpen()) { controls.enabled = true; controls.lock(); } });
  addEventListener('keydown', () => music.start(), { once: true });
  controls.onLockChange = (locked) => {
    hint.hidden = locked || controls.touch || panelsOpen();
    if (locked) controls.enabled = true;
  };
  for (const b of document.querySelectorAll('.lang-switch button')) b.onclick = () => setLang(b.dataset.lang);

  // going somewhere from the map: to a building's entrance, or to any point of the land
  const toast = (msg) => { const n = $('notice'); n.textContent = msg; n.hidden = !msg; };
  // travelling: the view fades out, the new place is made ready (ground, plants, buildings, their
  // shaders), and the view fades in there
  const fade = $('fade');
  const travel = async (fn) => {
    closePanels(); toast(t('travelling'));
    fade.hidden = false; requestAnimationFrame(() => fade.classList.add('on'));
    try {
      await fn();
      world.update(R.camera.position);
      await R.warmup();
    } finally {
      toast(''); fade.classList.remove('on'); setTimeout(() => { fade.hidden = true; }, 400);
    }
  };
  const mapView = new MapView(world, (rec) => travel(() => goTo(rec)), (x, z) => travel(async () => {
    await arrive(x, z);
    const y = world.collide.groundAt(x, z, world.collide.terrain(x, z) + 2);
    controls.setPose(x, y, z, controls.yaw, 0);
  }));

  const closePanels = () => {
    mapPanel.hidden = true; setPanel.hidden = true;
    controls.enabled = true;
    if (!controls.touch) { controls.lock(); hint.hidden = !!document.pointerLockElement; }
  };
  const openPanel = (p) => {
    controls.enabled = false; controls.unlock();
    hint.hidden = true;
    p.hidden = false;
    if (p === mapPanel) mapView.open({ x: controls.feet.x, z: controls.feet.z, yaw: controls.yaw });
  };
  $('btn-map').onclick = () => (mapPanel.hidden ? (setPanel.hidden = true, openPanel(mapPanel)) : closePanels());
  $('btn-settings').onclick = () => (setPanel.hidden ? (mapPanel.hidden = true, openPanel(setPanel)) : closePanels());
  for (const c of document.querySelectorAll('.panel .close')) c.onclick = closePanels;
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') mapPanel.hidden ? (setPanel.hidden = true, openPanel(mapPanel)) : closePanels();
    if (e.code === 'Escape' && panelsOpen()) closePanels();
  });
  // the map's shaded relief is drawn while the visitor looks around, not when it is first opened
  (window.requestIdleCallback || setTimeout)(() => mapView.relief(), { timeout: 4000 });

  // settings
  const q = $('set-quality'), mv = $('set-music'), sv = $('set-sens'), lang = $('set-lang');
  q.value = settings.quality; mv.value = settings.music; sv.value = settings.sensitivity;
  const tm = $('set-time');
  tm.value = ['cycle', 'baked', '7', '12', '18.5', '23'].includes(String(settings.time)) ? String(settings.time) : 'cycle';
  tm.onchange = () => { settings.time = tm.value; applyTime(tm.value); save(); };
  q.onchange = () => { settings.quality = q.value; R.setQuality(q.value); world.flora.scale = floraScale[q.value] ?? 1; world.flora.dirty = true; save(); };
  mv.oninput = () => { settings.music = +mv.value; music.setVolume(settings.music); save(); };
  sv.oninput = () => { settings.sensitivity = +sv.value; controls.sensitivity = settings.sensitivity; save(); };
  lang.onchange = () => setLang(lang.value);

  // frame loop
  let exposure = 0.55, snap = true;
  let last = performance.now();
  const frame = () => {
    const now = performance.now(), dt = (now - last) / 1000;
    last = now;
    controls.update(dt);
    const here = world.update(R.camera.position);
    const c = R.camera.position;
    const outdoors = !here.room || here.room.kind === 'open';
    climate.indoors += ((outdoors ? 0 : 1) - climate.indoors) * Math.min(1, dt / 1.5);
    const cl = climate.update(c.x, c.z, Math.min(dt, 0.25));
    rain.update(dt, cl.rain, outdoors);
    music.ambience(cl.rain, cl.windy, !outdoors);
    // eye adaptation: open up in dark rooms (at most ~3 stops), close down outdoors
    const amb = R.gi.ambientAt(c.x, c.y, c.z);
    // at night the eye opens further (dark-adapted), though the night stays dark
    const target = cl.exposure * (1 + 2.6 * (1 - cl.day)) * Math.min(8 + 6 * (1 - cl.day), Math.max(1, Math.pow(R.gi.openAmbient() / Math.max(amb, 1e-4), 0.55)));
    exposure = snap ? target : exposure + (target - exposure) * (1 - Math.exp(-dt / (target > exposure ? 1.6 : 0.6)));
    snap = false;
    R.renderer.toneMappingExposure = exposure;
    if (here.building) music.set(here.building.music, here.room?.kind || 'open');
    R.render();
    stats.frames++; stats.ms = stats.ms * 0.9 + (performance.now() - now) * 0.1;
  };
  const stats = { frames: 0, ms: 0 };
  const rain = new Rain(R.scene, R.camera);
  R.renderer.setAnimationLoop(frame);

  // hooks for the screenshot and walk-through tools
  window.palace = {
    pose: async (x, y, z, yaw = 0, pitch = 0) => { await arrive(x, z); controls.setPose(x, y, z, yaw, pitch); snap = true; },
    settle: () => { snap = true; },
    camera: async (x, y, z, yaw = 0, pitch = 0) => {
      await arrive(x, z); controls.free = true; R.camera.position.set(x, y, z); R.camera.rotation.set(pitch, yaw, 0, 'YXZ'); },
    entrance: (id) => goTo(world.plans.get(id)),
    walk: async (keys, ms) => { controls.enabled = true; for (const k of keys) controls.keys.add(k); await new Promise((r) => setTimeout(r, ms)); controls.keys.clear(); },
    feet: () => ({ ...controls.feet }),
    world, renderer: R, controls, stats, music, climate, mapView,
    ground: (x, z) => world.collide.terrain(x, z),
    begin,
  };
  window.READY = true;
}

main().catch((e) => {
  console.error(e);
  $('intro-status').textContent = t('error') + (e.message || e);
});
