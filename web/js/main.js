import * as THREE from "three";
import { Nav } from "./nav.js";
import { Labels, FONTS } from "./labels.js";
import { buildStatic, buildExhibits, buildBridges, buildSky } from "./world.js";
import { UI } from "./ui.js";

const EYE = 1.65;
const WALK = 6.5;
const RUN = 14;
const SYMBOL_RANGE = 75;
const $ = (id) => document.getElementById(id);

// ── persistence (best effort) ─────────────────────────────────────────────
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
};

async function loadWorld() {
  const res = await fetch("data/world.json");
  if (!res.ok) throw new Error(`world.json: HTTP ${res.status}`);
  return res.json();
}

async function fontsReady() {
  if (!document.fonts) return;
  const loads = [
    document.fonts.load(`700 40px ${FONTS.display}`, "记忆宫殿展厅"),
    document.fonts.load(`600 40px ${FONTS.body}`, "展品名称"),
  ];
  await Promise.race([Promise.allSettled(loads), new Promise((r) => setTimeout(r, 2500))]);
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

async function main() {
  const msg = $("loading-msg");
  const world = await loadWorld();
  msg.textContent = "正在建造展馆…";
  await new Promise((r) => requestAnimationFrame(r));

  // ── renderer & scene ────────────────────────────────────────────────────
  const canvas = $("view");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  const coarse = matchMedia("(pointer: coarse)").matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.6 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 2000);
  camera.rotation.order = "YXZ";
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a9a78, 1.2);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-120, 220, 90);
  scene.add(hemi, sun);
  scene.fog = new THREE.Fog(0xe2e3dc, 90, 620);
  const sky = buildSky(scene);
  const skyMesh = scene.children[scene.children.length - 1];

  const labels = new Labels(scene);
  const { ground } = buildStatic(world, scene, labels);
  const exhibits = buildExhibits(world, scene, labels);
  const byRef = new Map(exhibits.map((e) => [e.ref, e]));
  buildBridges(world, scene);
  const nav = new Nav(world.nav);

  function applyTheme() {
    sky.top.value.set(cssVar("--sky-top"));
    sky.horizon.value.set(cssVar("--sky-horizon"));
    sky.bottom.value.set(cssVar("--sky-bottom"));
    scene.fog.color.set(cssVar("--fog"));
    ground.material.color.set(cssVar("--grass"));
    sun.color.set(cssVar("--sun"));
    sun.intensity = parseFloat(cssVar("--sun-i")) || 1.6;
    hemi.intensity = parseFloat(cssVar("--hemi-i")) || 1.2;
    hemi.color.set(cssVar("--sky-horizon")).lerp(new THREE.Color("#ffffff"), 0.5);
    hemi.groundColor.set(cssVar("--grass"));
  }
  applyTheme();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });

  // ── visitor ─────────────────────────────────────────────────────────────
  const player = { x: world.spawn.pos[0], y: world.spawn.pos[1], z: world.spawn.pos[2], yaw: world.spawn.yaw, pitch: -0.02 };
  const saved = store.get("palace.pos", null);
  if (saved && nav.stand(saved.x, saved.z, saved.y) !== null) Object.assign(player, saved);
  let eyeY = player.y + EYE;
  const visited = new Set(store.get("palace.visited", []));

  // ── location ────────────────────────────────────────────────────────────
  const sysById = Object.fromEntries(world.systems.map((s) => [s.id, s]));
  let here = { system: null, room: null };
  function locate() {
    let sys = null;
    for (const p of world.plots) {
      if (Math.abs(player.x - p.center[0]) <= p.half + 6 && Math.abs(player.z - p.center[1]) <= p.half + 6) {
        sys = p.system ? sysById[p.system] : null;
        if (!p.system) { ui.setWhere("空地", "新的知识体系会建在这里"); here = { system: null, room: null }; return; }
      }
    }
    if (!sys) { ui.setWhere("中央广场", "点「导览」开始，或沿大路走向各个体系"); here = { system: null, room: null }; return; }
    let best = null, bestD = 18;
    for (const w of sys.wings) for (const r of w.rooms) for (const ref of r.exhibits) {
      const e = world.exhibits[ref];
      const d = Math.hypot(e.pos[0] - player.x, e.pos[2] - player.z) + Math.abs(e.pos[1] - player.y) * 3;
      if (d < bestD) { bestD = d; best = { w, r }; }
    }
    here = { system: sys.id, room: best ? best.r : null };
    ui.setWhere(sys.title, best ? `${best.w.title} · ${best.r.title}` : sys.metaphor);
  }

  // ── camera motion helpers ───────────────────────────────────────────────
  let glide = null; // {from, to, t, dur, done}
  const fadeEl = $("fade");
  function wrapAngle(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

  function goTo(x, y, z, yaw, { fade = null, done = null } = {}) {
    const far = fade ?? Math.hypot(x - player.x, z - player.z) > 45;
    if (far) {
      fadeEl.classList.add("on");
      setTimeout(() => {
        Object.assign(player, { x, y, z, yaw, pitch: -0.05 });
        eyeY = y + EYE;
        glide = null;
        fadeEl.classList.remove("on");
        done && done();
      }, 240);
      return;
    }
    glide = {
      from: { ...player }, to: { x, y, z, yaw: player.yaw + wrapAngle(yaw - player.yaw), pitch: -0.05 },
      t: 0, dur: Math.min(1.4, 0.4 + Math.hypot(x - player.x, z - player.z) / 18), done,
    };
  }

  function goExhibit(ref, open = false) {
    const ex = world.exhibits[ref];
    tour.stop();
    ui.closeOverlays();
    goTo(ex.view[0], ex.view[1], ex.view[2], ex.yaw, { done: () => open && openCard(ref) });
  }

  // a thin gilt ring on the pedestal marks exhibits already seen
  const ringGeo = new THREE.TorusGeometry(0.47, 0.035, 6, 32);
  const ringMat = new THREE.MeshLambertMaterial({ color: 0xd4a548, emissive: 0x3a2a08 });
  function markVisited(ref) {
    const e = byRef.get(ref);
    if (!e || e.ring) return;
    e.ring = new THREE.Mesh(ringGeo, ringMat);
    e.ring.rotation.x = Math.PI / 2;
    e.ring.position.set(e.ex.pos[0], e.ex.pos[1] + 1.02, e.ex.pos[2]);
    scene.add(e.ring);
  }

  function openCard(ref) {
    visited.add(ref);
    markVisited(ref);
    store.set("palace.visited", [...visited]);
    ui.showCard(ref, { touring: tour.active, paused: tour.paused });
  }

  // ── guided tour ─────────────────────────────────────────────────────────
  const tour = {
    active: false, paused: false, sys: null, idx: 0, phase: "idle", dist: 0, cum: null, dwell: 0,
    start(sysId, from = 0) {
      const s = sysById[sysId];
      this.sys = s;
      const path = s.tour.path;
      this.cum = [0];
      for (let i = 1; i < path.length; i++) {
        this.cum.push(this.cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][2] - path[i - 1][2]));
      }
      this.active = true;
      this.paused = false;
      this.idx = from;
      ui.hideCard();
      ui.closeOverlays();
      if (from === 0) {
        const [x, y, z] = path[0];
        this.dist = 0;
        this.phase = "wait";
        const look = Math.atan2(-(path[1][0] - x), -(path[1][2] - z));
        goTo(x, y, z, look, { fade: Math.hypot(x - player.x, z - player.z) > 4, done: () => { this.phase = "walk"; } });
      } else {
        this.arrive();
      }
      ui.hint(`导览：${s.title}。随时点「暂停」停下细看`, 4500);
    },
    stop() {
      if (!this.active) return;
      this.active = false;
      this.phase = "idle";
      $("tour-pause").hidden = true;
    },
    next(dir) {
      const stops = this.sys.tour.stops;
      const k = this.idx + dir;
      if (k < 0) return;
      if (k >= stops.length) { this.stop(); ui.hint(`「${this.sys.title}」导览结束`); return; }
      this.idx = k;
      if (dir > 0 && this.phase === "dwell") { this.phase = "walk"; ui.hideCard(); return; }
      this.arrive();
    },
    arrive() {
      const ref = this.sys.tour.stops[this.idx].ref;
      const ex = world.exhibits[ref];
      this.dist = this.cum[this.sys.tour.stops[this.idx].at];
      this.phase = "wait";
      goTo(ex.view[0], ex.view[1], ex.view[2], ex.yaw, { done: () => this.beginDwell() });
    },
    beginDwell() {
      const ref = this.sys.tour.stops[this.idx].ref;
      const ex = world.exhibits[ref];
      this.phase = "dwell";
      this.dwell = Math.min(22, Math.max(10, (ex.summary.length + ex.detail.length + ex.image.length) / 16));
      openCard(ref);
    },
    update(dt) {
      if (!this.active || this.paused || this.phase === "wait") return;
      if (this.phase === "dwell") {
        this.dwell -= dt;
        if (this.dwell <= 0) this.next(1);
        return;
      }
      // walk along the path toward the current stop
      const path = this.sys.tour.stops.length ? this.sys.tour.path : null;
      const target = this.cum[this.sys.tour.stops[this.idx].at];
      const remaining = target - this.dist;
      const speed = Math.min(12, Math.max(3.2, remaining * 0.7));
      this.dist = Math.min(target, this.dist + speed * dt);
      const p = pointAt(path, this.cum, this.dist);
      const ahead = pointAt(path, this.cum, Math.min(target, this.dist + 3));
      const h = nav.stand(p[0], p[2], player.y);
      Object.assign(player, { x: p[0], z: p[2], y: h ?? p[1] });
      if (Math.hypot(ahead[0] - p[0], ahead[2] - p[2]) > 0.3) {
        const want = Math.atan2(-(ahead[0] - p[0]), -(ahead[2] - p[2]));
        player.yaw += wrapAngle(want - player.yaw) * Math.min(1, dt * 3.5);
      }
      player.pitch += (-0.04 - player.pitch) * Math.min(1, dt * 2);
      if (this.dist >= target - 1e-3) {
        const ex = world.exhibits[this.sys.tour.stops[this.idx].ref];
        this.phase = "wait";
        goTo(ex.view[0], ex.view[1], ex.view[2], ex.yaw, { done: () => this.beginDwell() });
      }
    },
  };

  function pointAt(path, cum, d) {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const a = path[i - 1], b = path[i];
    const seg = cum[i] - cum[i - 1] || 1;
    const t = Math.min(1, Math.max(0, (d - cum[i - 1]) / seg));
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  // ── UI ──────────────────────────────────────────────────────────────────
  const ui = new UI(world, {
    closeCard() { tour.stop(); ui.hideCard(); },
    step(dir) {
      if (tour.active) return tour.next(dir);
      if (!ui.current) return;
      const s = ui.roomOf[ui.current].s;
      const list = ui.order[s.id];
      const k = list.indexOf(ui.current) + dir;
      if (k >= 0 && k < list.length) goExhibit(list[k], true);
    },
    togglePause() {
      tour.paused = !tour.paused;
      $("tour-pause").textContent = tour.paused ? "继续" : "暂停";
    },
    goExhibit,
    goSystem(id) {
      tour.stop();
      ui.hideCard();
      const [x, y, z] = sysById[id].entrance;
      const path = sysById[id].tour.path;
      const look = Math.atan2(-(path[1][0] - x), -(path[1][2] - z));
      goTo(x, y, z, look, { fade: true });
    },
    goPoint(x, z) {
      tour.stop();
      ui.hideCard();
      goTo(x, 0, z, Math.atan2(x, z), { fade: true });
    },
    startTour(id) { tour.start(id); },
    visited: () => visited,
    hereRoom: () => here.room,
    hereSystem: () => here.system,
    player: () => player,
  });

  // ── input ───────────────────────────────────────────────────────────────
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
    const k = coarse ? 0.0055 : 0.0042;
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
    const near = exhibits.filter((e) => e.sym.visible).map((e) => e.hit);
    const hit = raycaster.intersectObjects(near, false)[0];
    if (hit && hit.distance < 40) {
      const ref = hit.object.userData.ref;
      if (tour.active) tour.stop();
      openCard(ref);
    }
  }

  let hinted = false;
  function userMoved(kind) {
    if (!hinted) { hinted = true; setTimeout(() => $("hint").classList.add("fade-out"), 1500); }
    if (kind === "walk" && tour.active) { tour.stop(); ui.hint("已退出导览，自由行走"); }
    if (kind === "walk") glide = null;
  }

  // ── frame loop ──────────────────────────────────────────────────────────
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 80 : 66; // portrait phones need a taller view to fit an exhibit and its label
    camera.updateProjectionMatrix();
    if (!$("map").hidden) ui.drawMap();
  }
  addEventListener("resize", resize);
  resize();

  // keep the scene's focus point in the part of the screen the card leaves free
  const cardEl = $("card");
  const hudEl = document.querySelector(".hud-top");
  const offset = { x: 0, y: 0 };
  function updateViewOffset(dt) {
    let tx = 0, ty = 0;
    if (!cardEl.hidden) {
      if (innerWidth >= 900) tx = (cardEl.offsetWidth + 16) / 2;
      else {
        // center the exhibit between the top bar and the card, a little below middle
        // so the label above the symbol stays in view
        const h = canvas.clientHeight;
        const top = hudEl.getBoundingClientRect().bottom - canvas.getBoundingClientRect().top;
        const bottom = h - cardEl.offsetHeight;
        ty = Math.max(0, h / 2 - ((top + bottom) / 2 + 0.06 * h));
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
  let lodT = 0, locT = 0, saveT = 0;
  const camPos = new THREE.Vector3();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    // manual movement
    let fwd = 0, side = 0;
    if (!ui.anyOverlay()) {
      if (keys.has("KeyW") || keys.has("ArrowUp")) fwd += 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) fwd -= 1;
      if (keys.has("KeyA")) side -= 1;
      if (keys.has("KeyD")) side += 1;
      if (keys.has("ArrowLeft")) player.yaw += dt * 1.9;
      if (keys.has("ArrowRight")) player.yaw -= dt * 1.9;
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
      const t = Math.min(1, glide.t), e = t * t * (3 - 2 * t);
      const f = glide.from, to = glide.to;
      player.x = f.x + (to.x - f.x) * e;
      player.z = f.z + (to.z - f.z) * e;
      player.y = f.y + (to.y - f.y) * e;
      player.yaw = f.yaw + (to.yaw - f.yaw) * e;
      player.pitch = f.pitch + (to.pitch - f.pitch) * e;
      if (t >= 1) { const d = glide.done; glide = null; d && d(); }
    }
    tour.update(dt);
    updateViewOffset(dt);

    eyeY += (player.y + EYE - eyeY) * Math.min(1, dt * 10);
    camera.position.set(player.x, eyeY, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0);
    skyMesh.position.copy(camera.position);
    camPos.copy(camera.position);

    // level of detail
    lodT -= dt;
    if (lodT <= 0) {
      lodT = 0.25;
      for (const e of exhibits) e.sym.visible = e.pos.distanceTo(camPos) < SYMBOL_RANGE;
      labels.update(camPos);
    }
    for (const e of exhibits) if (e.sym.visible) e.sym.rotation.y += dt * 0.45;
    locT -= dt;
    if (locT <= 0) { locT = 0.5; locate(); }
    saveT -= dt;
    if (saveT <= 0) { saveT = 3; store.set("palace.pos", { x: player.x, y: player.y, z: player.z, yaw: player.yaw, pitch: player.pitch }); }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  for (const ref of visited) markVisited(ref);
  msg.textContent = "正在点亮展品…";
  await fontsReady();
  labels.enabled = true;
  locate();
  requestAnimationFrame((t) => { last = t; frame(t); });
  $("loading").classList.add("done");
  setTimeout(() => $("loading").hidden = true, 700);
  ui.hint(coarse
    ? "左下摇杆走动 · 拖动屏幕转头 · 点展品看详情"
    : "W A S D 走动 · 拖动转头 · 点击展品看详情 · Shift 奔跑", 7000);

  // debugging / automation hook
  window.palace = { world, player, tour, ui, goExhibit, camera, renderer, nav, byRef };
}

main().catch((err) => {
  console.error(err);
  $("loading-msg").textContent = "加载失败：" + err.message;
});
