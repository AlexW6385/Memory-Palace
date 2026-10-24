import * as THREE from "three";
import { Nav } from "./nav.js";
import { createRenderer, createLights } from "./look.js";
import { World } from "./world.js";
import { Stages } from "./stage.js";
import { UI } from "./ui.js";
import { t, tr, getLang, onLang } from "./i18n.js";

const WALK = 4.6;
const RUN = 11;
const $ = (id) => document.getElementById(id);

// ── persistence (best effort) ────────────────────────────────────────────────
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
    document.fonts.load('600 40px "IBM Plex Sans"', "Locus 12"),
    document.fonts.load('400 40px "Noto Serif SC"', "记忆宫殿展厅"),
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
  const stages = new Stages(data, scene);
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
  const player = { x: data.spawn.pos[0], y: data.spawn.pos[1], z: data.spawn.pos[2], yaw: data.spawn.yaw, pitch: -0.04 };
  const saved = store.get("palace.pos", null);
  if (saved && nav.stand(saved.x, saved.z, saved.y) !== null) Object.assign(player, saved);
  let eyeY = player.y + data.eye;
  const visited = new Set(store.get("palace.visited", []));
  stages.setVisited(visited);
  const recallLog = store.get("palace.recall", {});

  // ── location ───────────────────────────────────────────────────────────────
  const sysById = Object.fromEntries(data.systems.map((s) => [s.id, s]));
  let here = { system: null, room: null };
  let lastRoom = null;
  function locate() {
    let plot = null;
    for (const p of data.plots) {
      if (Math.abs(player.x - p.center[0]) <= p.half + 6 && Math.abs(player.z - p.center[1]) <= p.half + 6) plot = p;
    }
    if (!plot) {
      ui.setWhere(t("plaza"), t("plazaSub"));
      here = { system: null, room: null };
      lastRoom = null;
      return;
    }
    if (!plot.system) {
      ui.setWhere(t("emptyPlot"), t("emptyPlotSub"));
      here = { system: null, room: null };
      return;
    }
    const sys = sysById[plot.system];
    let best = null, bestD = 16;
    for (const w of sys.wings) for (const r of w.rooms) for (const ref of r.exhibits) {
      const e = data.exhibits[ref];
      const d = Math.hypot(e.view[0] - player.x, e.view[2] - player.z) + Math.abs(e.pos[1] - player.y) * 3;
      if (d < bestD) { bestD = d; best = { w, r }; }
    }
    here = { system: sys.id, room: best ? best.r : null };
    ui.setWhere(tr(sys.title), best ? t("inRoom", { wing: tr(best.w.title), room: tr(best.r.title) }) : tr(sys.subtitle), sys.color);
    if (best && best.r !== lastRoom) {
      lastRoom = best.r;
      const st = data.styles[best.r.style];
      if (!route || route.kind !== "recall") {
        ui.toast(`<span class="toast-kicker">${t("enterRoom", { style: tr(st) })}</span><span class="toast-title">${tr(best.r.title)}</span>`);
      }
    }
  }

  // ── camera motion helpers ──────────────────────────────────────────────────
  let glide = null;
  const fadeEl = $("fade");
  const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  function goTo(x, y, z, yaw, { fade = null, done = null, pitch = -0.13 } = {}) {
    const far = fade ?? (Math.hypot(x - player.x, z - player.z) > 30 || Math.abs(y - player.y) > 2);
    if (far) {
      fadeEl.classList.add("on");
      setTimeout(() => {
        Object.assign(player, { x, y, z, yaw, pitch });
        eyeY = y + data.eye;
        glide = null;
        setTimeout(() => fadeEl.classList.remove("on"), 60);
        done && done();
      }, 260);
      return;
    }
    glide = {
      from: { ...player }, to: { x, y, z, yaw: player.yaw + wrapAngle(yaw - player.yaw), pitch },
      t: 0, dur: Math.min(1.5, 0.45 + Math.hypot(x - player.x, z - player.z) / 16), done,
    };
  }

  function viewOf(ref) {
    const ex = data.exhibits[ref];
    return { x: ex.view[0], y: ex.view[1], z: ex.view[2], yaw: ex.viewYaw };
  }

  function goExhibit(ref, open = false) {
    endRoute(true);
    ui.closeOverlays();
    stages.prepare(ref);
    const v = viewOf(ref);
    goTo(v.x, v.y, v.z, v.yaw, { done: () => open && openCard(ref) });
  }

  function openCard(ref, opts = {}) {
    if (!opts.mode || opts.mode === "view") {
      visited.add(ref);
      stages.markVisited(ref);
      store.set("palace.visited", [...visited]);
    }
    stages.setCurrent(ref);
    ui.showCard(ref, { touring: route?.kind === "tour", paused: route?.paused, ...opts });
  }

  // ── routes: guided tour and recall walk ───────────────────────────────────
  // route = { kind: "tour"|"recall", system, refs, index, phase, paused, ... }
  let route = null;

  function pathFor(sys) {
    const path = sys.tour.path;
    const cum = [0];
    for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][2] - path[i - 1][2], path[i][1] - path[i - 1][1]));
    return { path, cum, stopAt: Object.fromEntries(sys.tour.stops.map((s) => [s.ref, s.at])) };
  }

  function pointAt(path, cum, d) {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const a = path[i - 1], b = path[i];
    const seg = cum[i] - cum[i - 1] || 1;
    const k = Math.min(1, Math.max(0, (d - cum[i - 1]) / seg));
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  }

  function startRoute(kind, sysId, wingId = null) {
    endRoute(true);
    const sys = sysById[sysId];
    let refs = sys.wings.flatMap((w) => (wingId && w.id !== wingId ? [] : w.rooms.flatMap((r) => r.exhibits)));
    if (kind === "recall" && wingId === "missed") refs = (recallLog[sysId]?.missed || []).filter((r) => data.exhibits[r]);
    if (!refs.length) return;
    const p = pathFor(sys);
    route = { kind, system: sysId, refs, index: 0, phase: "wait", paused: false, dist: 0, ...p, ok: 0, graded: 0, missed: [],
      total: refs.length, scopeTitle: wingId && wingId !== "missed" ? sys.wings.find((w) => w.id === wingId).title : null };
    if (kind === "recall") stages.setRecall(true, new Set());
    ui.hideCard();
    ui.closeOverlays();
    ui.setRoute(route);
    const first = refs[0];
    const firstAt = p.stopAt[first] ?? 0;
    route.dist = kind === "tour" && !wingId ? 0 : p.cum[firstAt];
    if (kind === "tour" && !wingId) {
      const [x, y, z] = p.path[0];
      const look = Math.atan2(-(p.path[1][0] - x), -(p.path[1][2] - z));
      goTo(x, y, z, look, { fade: true, done: () => { if (route) route.phase = "walk"; } });
    } else {
      arrive();
    }
    ui.hint(kind === "tour" ? t("tourHint", { name: tr(sys.title) }) : t("recallThink"), 4500);
  }

  function endRoute(silent = false) {
    if (!route) return;
    const r = route;
    route = null;
    if (r.kind === "recall") {
      stages.setRecall(false);
      recallLog[r.system] = { missed: r.missed, when: Date.now() };
      store.set("palace.recall", recallLog);
      if (!silent && r.graded) ui.hint(t("recallDone", { ok: r.ok, n: r.graded }), 6000);
    }
    ui.setRoute(null);
    if (ui.card && ui.card.mode !== "view") ui.hideCard();
  }

  function arrive() {
    const ref = route.refs[route.index];
    route.phase = "wait";
    route.dist = route.cum[route.stopAt[ref]] ?? route.dist;
    stages.prepare(ref);
    const v = viewOf(ref);
    goTo(v.x, v.y, v.z, v.yaw, { done: () => dwell() });
  }

  function dwell() {
    if (!route) return;
    const ref = route.refs[route.index];
    route.phase = "dwell";
    if (route.kind === "tour") {
      const ex = data.exhibits[ref];
      const words = (tr(ex.summary) + tr(ex.image)).length;
      route.dwell = Math.min(26, Math.max(12, words / (getLang() === "zh" ? 7 : 18)));
      openCard(ref);
    } else {
      openCard(ref, { mode: "ask" });
    }
    ui.setRoute(route);
  }

  function nextStop(dir) {
    if (!route) return;
    const k = route.index + dir;
    if (k < 0) return;
    if (k >= route.refs.length) {
      const sys = sysById[route.system];
      if (route.kind === "tour") ui.hint(t("tourEnd", { name: tr(sys.title) }), 5000);
      endRoute();
      return;
    }
    route.index = k;
    const ref = route.refs[k];
    const consecutive = dir > 0 && route.kind === "tour" && route.stopAt[ref] !== undefined;
    if (consecutive && route.phase === "dwell") {
      route.phase = "walk";
      ui.hideCard();
    } else arrive();
    ui.setRoute(route);
  }

  function updateRoute(dt) {
    if (!route || route.paused || route.phase === "wait") return;
    if (route.phase === "dwell") {
      if (route.kind === "tour" && ui.card && !ui.card.hover) {
        route.dwell -= dt;
        if (route.dwell <= 0) nextStop(1);
      }
      return;
    }
    const ref = route.refs[route.index];
    const target = route.cum[route.stopAt[ref]];
    const remaining = target - route.dist;
    const speed = Math.min(9, Math.max(2.6, remaining * 0.6));
    route.dist = Math.min(target, route.dist + speed * dt);
    const p = pointAt(route.path, route.cum, route.dist);
    const ahead = pointAt(route.path, route.cum, Math.min(target, route.dist + 3));
    const h = nav.stand(p[0], p[2], player.y);
    Object.assign(player, { x: p[0], z: p[2], y: h ?? p[1] });
    if (Math.hypot(ahead[0] - p[0], ahead[2] - p[2]) > 0.3) {
      const want = Math.atan2(-(ahead[0] - p[0]), -(ahead[2] - p[2]));
      player.yaw += wrapAngle(want - player.yaw) * Math.min(1, dt * 3);
    }
    player.pitch += (-0.06 - player.pitch) * Math.min(1, dt * 2);
    if (route.dist >= target - 1e-3) {
      route.phase = "wait";
      const v = viewOf(ref);
      goTo(v.x, v.y, v.z, v.yaw, { done: () => dwell() });
    }
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  const ui = new UI(data, {
    closeCard() {
      if (route && route.kind === "recall") endRoute();
      else if (route) endRoute(true);
      stages.setCurrent(null);
      ui.hideCard();
    },
    step(dir) {
      if (route) return nextStop(dir);
      if (!ui.current) return;
      const s = ui.where[ui.current].s;
      const list = ui.order[s.id];
      const k = list.indexOf(ui.current) + dir;
      if (k >= 0 && k < list.length) goExhibit(list[k], true);
    },
    togglePause() {
      if (!route) return;
      route.paused = !route.paused;
      ui.setRoute(route);
      if (ui.card) { ui.card.paused = route.paused; ui.renderCard(); }
    },
    reveal() {
      if (!route || route.kind !== "recall") return;
      const ref = route.refs[route.index];
      stages.reveal(ref);
      ui.card.mode = "shown";
      ui.renderCard();
    },
    grade(ok) {
      if (!route || route.kind !== "recall") return;
      const ref = route.refs[route.index];
      route.graded += 1;
      if (ok) route.ok += 1; else route.missed.push(ref);
      visited.add(ref);
      stages.markVisited(ref);
      store.set("palace.visited", [...visited]);
      ui.setRoute(route);
      nextStop(1);
    },
    endRoute() { endRoute(); },
    goExhibit,
    goPoint(x, z) {
      endRoute(true);
      ui.hideCard();
      const hs = nav.heights(x, z).slice().sort((a, b) => a - b);
      for (const y of hs) {
        if (nav.stand(x, z, y) !== null) return goTo(x, y, z, player.yaw, { fade: true });
      }
      ui.hint("✕", 1200);
    },
    startTour(id) { startRoute("tour", id); },
    missed: (id) => (recallLog[id]?.missed || []).filter((r) => data.exhibits[r]).length,
    startRecall(id, wing = null) { startRoute("recall", id, wing); },
    visited: () => visited,
    hereRoom: () => here.room,
    hereSystem: () => here.system,
    player: () => player,
    relocate: () => { lastRoom = here.room; locate(); },
  });
  // hovering the card pauses the tour clock
  $("card").addEventListener("pointerenter", () => { if (ui.card) ui.card.hover = true; });
  $("card").addEventListener("pointerleave", () => { if (ui.card) ui.card.hover = false; });

  onLang((lang) => {
    world.setLang(lang);
    stages.setLang(lang);
    ui.onLang();
  });

  // ── input ──────────────────────────────────────────────────────────────────
  const keys = new Set();
  addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    keys.add(e.code);
  });
  addEventListener("keyup", (e) => keys.delete(e.code));
  addEventListener("blur", () => keys.clear());

  const joyEl = $("joy");
  const knob = joyEl.querySelector(".joy-knob");
  joyEl.hidden = !coarse;
  const joy = { id: null, x: 0, y: 0 };
  const look = { id: null, lx: 0, ly: 0, sx: 0, sy: 0, t: 0, moved: 0 };
  const raycaster = new THREE.Raycaster();

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
    look.lx = look.sx = e.clientX;
    look.ly = look.sy = e.clientY;
    look.t = performance.now();
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
    if (look.moved > 6) userMoved("look");
  });
  function endPointer(e) {
    if (e.pointerId === joy.id) {
      joy.id = null; joy.x = 0; joy.y = 0;
      knob.style.transform = "";
      return;
    }
    if (e.pointerId !== look.id) return;
    look.id = null;
    if (look.moved < 8 && performance.now() - look.t < 450 && e.type === "pointerup") pick(e.clientX, e.clientY);
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

  function pick(cx, cy) {
    const r = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(stages.hits, false)[0];
    if (hit && hit.distance < 32) {
      const ref = hit.object.userData.ref;
      if (route && route.kind === "recall") return;
      endRoute(true);
      const v = viewOf(ref);
      if (Math.hypot(v.x - player.x, v.z - player.z) > 1.5) goTo(v.x, v.y, v.z, v.yaw, { done: () => openCard(ref) });
      else openCard(ref);
    }
  }

  let hinted = false;
  function userMoved(kind) {
    if (!hinted) { hinted = true; setTimeout(() => $("hint").classList.add("fade-out"), 1500); }
    if (kind === "walk" && route && route.kind === "tour" && route.phase !== "dwell") {
      endRoute(true);
      ui.hint(t("tourLeft"));
    }
    if (kind === "walk") glide = null;
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

  // keep the focus point in the part of the screen the card leaves free
  const cardEl = $("card");
  const topEl = document.querySelector(".topbar");
  const offset = { x: 0, y: 0 };
  function updateViewOffset(dt) {
    let tx = 0, ty = 0;
    if (!cardEl.hidden) {
      if (innerWidth >= 900) tx = (cardEl.offsetWidth + 24) / 2;
      else {
        const h = canvas.clientHeight;
        const top = topEl.getBoundingClientRect().bottom;
        const bottom = h - cardEl.offsetHeight;
        ty = Math.max(0, h / 2 - ((top + bottom) / 2 + 0.04 * h));
      }
    }
    const k = Math.min(1, dt * 6);
    offset.x += (tx - offset.x) * k;
    offset.y += (ty - offset.y) * k;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (Math.abs(offset.x) < 0.5 && Math.abs(offset.y) < 0.5) camera.clearViewOffset();
    else camera.setViewOffset(w, h, offset.x, offset.y, w, h);
  }

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
      userMoved("walk");
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
      if (k >= 1) { const d = glide.done; glide = null; d && d(); }
    }
    updateRoute(dt);
    updateViewOffset(dt);

    eyeY += (player.y + data.eye - eyeY) * Math.min(1, dt * 10);
    camera.position.set(player.x, eyeY, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0);
    lights.follow(player.x - Math.sin(player.yaw) * 12, player.y, player.z - Math.cos(player.yaw) * 12);
    world.update(dt, camera);
    stages.update(dt, camera.position);

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
  stages.update(0, new THREE.Vector3(player.x, player.y, player.z));
  locate();
  requestAnimationFrame((tm) => { last = tm; frame(tm); });
  setProgress(1);
  $("loading").classList.add("done");
  setTimeout(() => { $("loading").hidden = true; }, 700);
  if (ui.shouldWelcome() && !new URLSearchParams(location.search).has("nowelcome")) ui.showWelcome();
  else ui.hint(coarse ? t("hintTouch") : t("hintDesktop"), 7000);

  // automation hook (tests and screenshots)
  window.palace = { data, player, ui, stages, world, nav, camera, renderer, goExhibit, startRoute, endRoute,
    get route() { return route; }, openCard };
  window.READY = true;
}

main().catch((err) => {
  console.error(err);
  $("loading-msg").textContent = t("loadFailed", { msg: err.message });
});
