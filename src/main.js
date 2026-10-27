// Memory Palace — boot, interface and the frame loop.

import { Renderer } from './engine/renderer.js';
import { World } from './engine/world.js';
import { Controls } from './engine/controls.js';
import { Music } from './engine/audio.js';
import { MapView } from './ui/map.js';
import { initLang, setLang, t, onLang } from './ui/i18n.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

const settings = load('mp.settings', { quality: 'high', music: 0.6, sensitivity: 1 });
if (params.get('quality')) settings.quality = params.get('quality');

function load(k, d) { try { return { ...d, ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch { return d; } }
function save() { try { localStorage.setItem('mp.settings', JSON.stringify(settings)); } catch { /* ignore */ } }

async function main() {
  initLang();
  const status = $('intro-status');
  const canvas = $('view');
  if (!navigator.gpu) { $('notice').textContent = t('no-webgpu'); $('notice').hidden = false; setTimeout(() => { $('notice').hidden = true; }, 12000); }

  const R = await new Renderer(canvas).init(settings.quality);
  const world = new World(R);
  await world.init();
  const controls = new Controls(R.camera, canvas, world.collide);
  controls.sensitivity = settings.sensitivity;
  const music = new Music();
  music.setVolume(settings.music);

  // start at the first building's entrance, or at a pose given in the URL (x,y,z,yaw,pitch)
  const first = world.plans.values().next().value;
  const goTo = async (rec) => {
    const [x, y, z, yaw] = world.entrance(rec.plan);
    await world.ensureNear(x, z);
    controls.setPose(x, y, z, yaw, 0.04);
  };
  if (params.get('pose')) {
    const p = params.get('pose').split(',').map(Number);
    await world.ensureNear(p[0], p[2]);
    controls.setPose(p[0], p[1], p[2], p[3] || 0, p[4] || 0);
  } else await goTo(first);

  status.textContent = t('compiling');
  world.update(R.camera.position);
  await R.warmup();
  status.textContent = t('ready');

  // interface
  const intro = $('intro'), hud = $('hud'), mapPanel = $('map'), setPanel = $('settings');
  const mapView = new MapView(world, (rec) => { goTo(rec); closePanels(); });
  const enter = $('btn-enter');
  enter.disabled = false;
  const begin = () => {
    intro.hidden = true; hud.hidden = false;
    $('stick').hidden = !controls.touch;
    controls.enabled = true;
    controls.lock();
    music.start();
  };
  enter.onclick = begin;
  controls.onLockChange = (locked) => {
    if (!locked && !controls.touch && mapPanel.hidden && setPanel.hidden && intro.hidden) {
      controls.enabled = false;
      enter.textContent = t('resume');
      intro.hidden = false;
    }
  };
  onLang(() => { if (!intro.hidden && controls.enabled === false && hud.hidden === false) enter.textContent = t('resume'); });
  for (const b of document.querySelectorAll('.lang-switch button')) b.onclick = () => setLang(b.dataset.lang);

  const closePanels = () => {
    mapPanel.hidden = true; setPanel.hidden = true;
    if (intro.hidden) { controls.enabled = true; controls.lock(); }
  };
  const openPanel = (p) => {
    controls.enabled = false; controls.unlock();
    p.hidden = false;
    if (p === mapPanel) mapView.open({ x: controls.feet.x, z: controls.feet.z, yaw: controls.yaw });
  };
  $('btn-map').onclick = () => (mapPanel.hidden ? (setPanel.hidden = true, openPanel(mapPanel)) : closePanels());
  $('btn-settings').onclick = () => (setPanel.hidden ? (mapPanel.hidden = true, openPanel(setPanel)) : closePanels());
  for (const c of document.querySelectorAll('.panel .close')) c.onclick = closePanels;
  addEventListener('keydown', (e) => {
    if (intro.hidden === false) return;
    if (e.code === 'KeyM') mapPanel.hidden ? (setPanel.hidden = true, openPanel(mapPanel)) : closePanels();
    if (e.code === 'Escape' && (!mapPanel.hidden || !setPanel.hidden)) closePanels();
  });

  // settings
  const q = $('set-quality'), mv = $('set-music'), sv = $('set-sens'), lang = $('set-lang');
  q.value = settings.quality; mv.value = settings.music; sv.value = settings.sensitivity;
  q.onchange = () => { settings.quality = q.value; R.setQuality(q.value); save(); };
  mv.oninput = () => { settings.music = +mv.value; music.setVolume(settings.music); save(); };
  sv.oninput = () => { settings.sensitivity = +sv.value; controls.sensitivity = settings.sensitivity; save(); };
  lang.onchange = () => setLang(lang.value);

  // frame loop
  const BASE_EXPOSURE = R.renderer.toneMappingExposure;
  let exposure = BASE_EXPOSURE, snap = true;
  let last = performance.now();
  const frame = () => {
    const now = performance.now(), dt = (now - last) / 1000;
    last = now;
    controls.update(dt);
    const here = world.update(R.camera.position);
    // eye adaptation: open up in dark rooms (at most ~2.6 stops), close down outdoors
    const c = R.camera.position, amb = R.gi.ambientAt(c.x, c.y, c.z);
    const target = BASE_EXPOSURE * Math.min(8, Math.max(1, Math.pow(R.gi.openAmbient() / Math.max(amb, 1e-4), 0.55)));
    exposure = snap ? target : exposure + (target - exposure) * (1 - Math.exp(-dt / (target > exposure ? 1.6 : 0.6)));
    snap = false;
    R.renderer.toneMappingExposure = exposure;
    if (here.building) music.set(here.building.music, here.room?.kind || 'open');
    R.render();
    stats.frames++; stats.ms = stats.ms * 0.9 + (performance.now() - now) * 0.1;
  };
  const stats = { frames: 0, ms: 0 };
  R.renderer.setAnimationLoop(frame);

  // hooks for the screenshot and walk-through tools
  window.palace = {
    pose: async (x, y, z, yaw = 0, pitch = 0) => { await world.ensureNear(x, z); controls.setPose(x, y, z, yaw, pitch); snap = true; },
    settle: () => { snap = true; },
    camera: async (x, y, z, yaw = 0, pitch = 0) => {
      await world.ensureNear(x, z, 900); controls.free = true; R.camera.position.set(x, y, z); R.camera.rotation.set(pitch, yaw, 0, 'YXZ'); },
    entrance: (id) => goTo(world.plans.get(id)),
    walk: async (keys, ms) => { controls.enabled = true; for (const k of keys) controls.keys.add(k); await new Promise((r) => setTimeout(r, ms)); controls.keys.clear(); },
    feet: () => ({ ...controls.feet }),
    world, renderer: R, controls, stats,
    begin,
  };
  window.READY = true;
}

main().catch((e) => {
  console.error(e);
  $('intro-status').textContent = t('error') + (e.message || e);
});
