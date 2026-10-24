import * as THREE from "three";
import { Nav } from "./nav.js";
import { createRenderer, createLights } from "./look.js";
import { World } from "./world.js";
import { Loci } from "./loci.js";
import { UI } from "./ui.js";
import { t, tr, onLang } from "./i18n.js";

const WALK = 4.6;
const RUN = 11;
const $ = (id) => document.getElementById(id);

// the last position is kept so a visit resumes where it ended (best effort, this browser only)
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
};

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function readTheme() {
  return {
    skyTop: cssVar("--sky-top"), skyHorizon: cssVar("--sky-horizon"), skyBottom: cssVar("--sky-bottom"),
    grass: cssVar("--grass"), fog: cssVar("--fog"), sun: cssVar("--sun"),
    sunI: parseFloat(cssVar("--sun-i")) || 2.2, hemiI: parseFloat(cssVar("--hemi-i")) || 1.0,
    exposure: parseFloat(cssVar("--exposure")) || 1.0, night: cssVar("--night") === "1",
  };
}

async function fontsReady() {
  if (!document.fonts) return;
  const loads = [
    document.fonts.load('400 40px "Marcellus"', "Memory Palace"),
    document.fonts.load('600 40px "IBM Plex Sans"', "Places"),
    document.fonts.load('400 40px "Noto Serif SC"', "记忆宫殿"),
  ];
  await Promise.race([Promise.allSettled(loads), new Promise((r) => setTimeout(r, 2500))]);
}

async function main() {
  const setProgress = (f, msg) => {
    $("progress-bar").style.width = `${Math.round(f * 100)}%`;
    if (msg) $("loading-msg").textContent = msg;
  };
  setProgress(0.05, t("loading"));
  const res = await fetch("data/world.json");
  if (!res.ok) throw new Error(`world.json: HTTP ${res.status}`);
  const data = await res.json();
  setProgress(0.2, t("loadingBuild"));
  await fontsReady();

  // ── renderer, scene, lights ────────────────────────────────────────────────
  const canvas = $("view");
  const coarse = matchMedia("(pointer: coarse)").matches;
  const renderer = createRenderer(canvas, { mobile: coarse });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(66, 1, 0.1, 2400);
  camera.rotation.order = "YXZ";
  const lights = createLights(scene, renderer, { shadowSize: coarse ? 1024 : 2048, shadowRange: coarse ? 30 : 40 });
  scene.fog = new THREE.Fog(0xe2e3dc, 70, 330);

  const world = new World(data, scene);
  await world.build((f) => setProgress(0.2 + f * 0.7));
  const loci = new Loci(data, scene);
  const nav = new Nav(data.nav);

  function applyTheme() {
    const th = readTheme();
    document.documentElement.dataset.night = th.night ? "1" : "0";
    scene.fog.color.set(th.fog);
    lights.sun.color.set(th.sun);
    lights.sun.intensity = th.sunI;
    lights.hemi.intensity = th.hemiI;
    lights.hemi.color.set(th.skyHorizon).lerp(new THREE.Color("#ffffff"), 0.45);
    // warm bounce light from below keeps ceilings and undersides from going murky
    lights.hemi.groundColor.set(th.grass).lerp(new THREE.Color(th.night ? "#6b6152" : "#d9ccb2"), 0.65);
    renderer.toneMappingExposure = th.exposure;
    world.setTheme(th);
  }
  applyTheme();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // ── the visitor ────────────────────────────────────────────────────────────
  const player = { x: data.spawn.pos[0], y: data.spawn.pos[1], z: data.spawn.pos[2], yaw: data.spawn.yaw, pitch: 0.02 };
  const saved = store.get("palace.pos", null);
  if (saved && nav.stand(saved.x, saved.z, saved.y) !== null) Object.assign(player, saved);
  let eyeY = player.y + data.eye;

  // ── where am I ─────────────────────────────────────────────────────────────
  const byId = Object.fromEntries(data.buildings.map((b) => [b.id, b]));
  const roomInfo = {};
  for (const b of data.buildings) for (const w of b.wings) for (const r of w.rooms) roomInfo[r.id] = { b, w, r };
  let here = { building: null, room: null };
  let lastRoom = null;
  function locate() {
    let plot = null;
    for (const p of data.plots) {
      if (Math.abs(player.x - p.center[0]) <= p.half + 4 && Math.abs(player.z - p.center[1]) <= p.half + 4) plot = p;
    }
    if (!plot || !plot.building) {
      ui.setWhere(t("street"), t("streetSub"));
      here = { building: null, room: null };
      lastRoom = null;
      return;
    }
    const b = byId[plot.building];
    let best = null, bestD = 13;
    for (const w of b.wings) for (const r of w.rooms) for (const id of r.loci) {
      const l = data.loci[id];
      const d = Math.hypot(l.view[0] - player.x, l.view[2] - player.z) + Math.abs(l.pos[1] - player.y) * 3;
      if (d < bestD) { bestD = d; best = { w, r }; }
    }
    here = { building: b.id, room: best ? best.r.id : null };
    ui.setWhere(tr(b.title), best ? t("inRoom", { wing: tr(best.w.title), room: tr(best.r.title) }) : t("grounds"), b.color);
    if (best && best.r !== lastRoom) {
      lastRoom = best.r;
      const st = data.styles[best.r.style];
      ui.toast(`<span class="toast-kicker">${t("enterRoom", { style: tr(st) })}</span><span class="toast-title">${tr(best.r.title)}</span>`);
    }
  }

  // ── moving ─────────────────────────────────────────────────────────────────
  let glide = null;
  const fadeEl = $("fade");
  const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  function goTo(x, y, z, yaw, { fade = null, pitch = -0.04 } = {}) {
    const far = fade ?? (Math.hypot(x - player.x, z - player.z) > 30 || Math.abs(y - player.y) > 2);
    if (far) {
      fadeEl.classList.add("on");
      setTimeout(() => {
        Object.assign(player, { x, y, z, yaw, pitch });
        eyeY = y + data.eye;
        glide = null;
        setTimeout(() => fadeEl.classList.remove("on"), 60);
      }, 260);
      return;
    }
    glide = { from: { ...player }, to: { x, y, z, yaw: player.yaw + wrapAngle(yaw - player.yaw), pitch }, t: 0,
      dur: Math.min(1.5, 0.45 + Math.hypot(x - player.x, z - player.z) / 16) };
  }

  /** Stand at a room's entrance, looking along it towards its first loci. */
  function goRoom(room) {
    const [x, y, z] = room.anchor;
    const a = data.loci[room.loci[0]], b = data.loci[room.loci[1]];
    const mx = (a.view[0] + b.view[0]) / 2, mz = (a.view[2] + b.view[2]) / 2;
    room.loci.slice(0, 4).forEach((id) => loci.prepare(id));
    goTo(x, y, z, Math.atan2(-(mx - x), -(mz - z)), { fade: true });
  }

  function goBuilding(b) {
    const [x, y, z] = b.entrance;
    const plot = data.plots[b.plot];
    ui.closeOverlays();
    goTo(x, y, z, Math.atan2(-(plot.center[0] - x), -(plot.center[1] - z)), { fade: true, pitch: 0.06 });
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  const ui = new UI(data, {
    goRoom,
    goBuilding,
    goPoint(x, z) {
      const hs = nav.heights(x, z).slice().sort((a, b) => a - b);
      for (const y of hs) if (nav.stand(x, z, y) !== null) return goTo(x, y, z, player.yaw, { fade: true });
      ui.hint("✕", 1200);
    },
    here: () => here,
    player: () => player,
    relocate: () => { lastRoom = here.room ? roomInfo[here.room]?.r : null; locate(); },
  });
  onLang((lang) => {
    world.setLang(lang);
    ui.onLang();
  });

  // ── input ──────────────────────────────────────────────────────────────────
  const keys = new Set();
  addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    keys.add(e.code);
  });
  addEventListener("keyup", (e) => keys.delete(e.code));
  addEventListener("blur", () => keys.clear());

  const joyEl = $("joy");
  const knob = joyEl.querySelector(".joy-knob");
  joyEl.hidden = !coarse;
  const joy = { id: null, x: 0, y: 0 };
  const look = { id: null, lx: 0, ly: 0, moved: 0 };

  function inJoyZone(e) {
    if (!coarse) return false;
    const r = joyEl.getBoundingClientRect();
    return Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) < r.width * 0.8;
  }
  canvas.addEventListener("pointerdown", (e) => {
    canvas.focus();
    if (joy.id === null && inJoyZone(e)) {
      joy.id = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      updateJoy(e);
      return;
    }
    if (look.id !== null) return;
    look.id = e.pointerId;
    look.lx = e.clientX;
    look.ly = e.clientY;
    look.moved = 0;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerId === joy.id) return updateJoy(e);
    if (e.pointerId !== look.id) return;
    const dx = e.clientX - look.lx, dy = e.clientY - look.ly;
    look.lx = e.clientX;
    look.ly = e.clientY;
    look.moved += Math.abs(dx) + Math.abs(dy);
    const k = coarse ? 0.0055 : 0.004;
    player.yaw -= dx * k;
    player.pitch = Math.max(-1.2, Math.min(1.0, player.pitch - dy * k));
    if (look.moved > 6) userMoved();
  });
  function endPointer(e) {
    if (e.pointerId === joy.id) {
      joy.id = null; joy.x = 0; joy.y = 0;
      knob.style.transform = "";
      return;
    }
    if (e.pointerId === look.id) look.id = null;
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

  function updateJoy(e) {
    const r = joyEl.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2 - 12;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx *= max / len; dy *= max / len; }
    joy.x = dx / max;
    joy.y = dy / max;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  let hinted = false;
  function userMoved() {
    if (!hinted) { hinted = true; setTimeout(() => $("hint").classList.add("fade-out"), 1500); }
  }

  // ── frame loop ─────────────────────────────────────────────────────────────
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 78 : 64;
    camera.updateProjectionMatrix();
    world.setViewport(h * renderer.getPixelRatio(), camera.fov);
  }
  addEventListener("resize", resize);
  resize();

  let last = performance.now();
  let locT = 0, saveT = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let fwd = 0, side = 0;
    if (!ui.anyOverlay()) {
      if (keys.has("KeyW") || keys.has("ArrowUp")) fwd += 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) fwd -= 1;
      if (keys.has("KeyA")) side -= 1;
      if (keys.has("KeyD")) side += 1;
      if (keys.has("ArrowLeft") || keys.has("KeyQ")) player.yaw += dt * 1.8;
      if (keys.has("ArrowRight") || keys.has("KeyE")) player.yaw -= dt * 1.8;
      fwd -= joy.y;
      side += joy.x;
    }
    const mag = Math.min(1, Math.hypot(fwd, side));
    if (mag > 0.08) {
      userMoved();
      glide = null;
      const run = keys.has("ShiftLeft") || keys.has("ShiftRight") || Math.hypot(joy.x, joy.y) > 0.96;
      const speed = (run ? RUN : WALK) * mag;
      const n = Math.hypot(fwd, side);
      const s = Math.sin(player.yaw), c = Math.cos(player.yaw);
      const vx = (-s * fwd + c * side) / n, vz = (-c * fwd - s * side) / n;
      nav.move(player, player.x + vx * speed * dt, player.z + vz * speed * dt);
    }
    if (glide) {
      glide.t += dt / glide.dur;
      const k = Math.min(1, glide.t), e = k * k * (3 - 2 * k);
      const f = glide.from, to = glide.to;
      player.x = f.x + (to.x - f.x) * e;
      player.z = f.z + (to.z - f.z) * e;
      player.y = f.y + (to.y - f.y) * e;
      player.yaw = f.yaw + (to.yaw - f.yaw) * e;
      player.pitch = f.pitch + (to.pitch - f.pitch) * e;
      if (k >= 1) glide = null;
    }
    eyeY += (player.y + data.eye - eyeY) * Math.min(1, dt * 10);
    camera.position.set(player.x, eyeY, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0);
    lights.follow(player.x - Math.sin(player.yaw) * 12, player.y, player.z - Math.cos(player.yaw) * 12);
    world.update(dt, camera);
    loci.update(dt, camera.position);
    locT -= dt;
    if (locT <= 0) { locT = 0.4; locate(); }
    saveT -= dt;
    if (saveT <= 0) {
      saveT = 3;
      store.set("palace.pos", { x: player.x, y: player.y, z: player.z, yaw: player.yaw, pitch: player.pitch });
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  setProgress(0.95, t("loadingLight"));
  loci.update(0, new THREE.Vector3(player.x, player.y, player.z));
  locate();
  requestAnimationFrame((tm) => { last = tm; frame(tm); });
  setProgress(1);
  $("loading").classList.add("done");
  setTimeout(() => { $("loading").hidden = true; }, 700);
  if (ui.shouldWelcome() && !new URLSearchParams(location.search).has("nowelcome")) ui.showHelp();
  else ui.hint(coarse ? t("hintTouch") : t("hintDesktop"), 7000);

  // automation hook (tests and screenshots)
  window.palace = { data, player, ui, loci, world, nav, camera, renderer, goRoom, goBuilding, goTo };
  window.READY = true;
}

main().catch((err) => {
  console.error(err);
  $("loading-msg").textContent = t("loadFailed", { msg: err.message });
});
