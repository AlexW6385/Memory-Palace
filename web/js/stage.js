// Exhibit stages near the visitor: backdrop panel, title plate, locus plaque and the 3D scene.
// The plinth and backdrop shell are part of the static world (arch.js); everything
// here is built when the visitor comes close and disposed when they walk away.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Builder, bake, materials, shade, mix, hashString } from "./props/kit.js";
import { builderFor, BUILDERS_WITH_FALLBACK } from "./props/index.js";
import { decalTexture } from "./look.js";
import { place } from "./scene.js";
import { backdropTexture, titleTexture, plaqueTexture } from "./textures.js";
import { STAGE, backdropGeometry } from "./arch.js";
import { tr, getLang } from "./i18n.js";

const DRESS_IN = 60, DRESS_OUT = 74, SCENE_IN = 42, SCENE_OUT = 54;
const BUDGET_MS = 7;

const decalGeo = new THREE.PlaneGeometry(1, 1);
const hitGeo = new THREE.CylinderGeometry(1.45, 1.45, 3.4, 12);
hitGeo.translate(0, 1.7, 0);
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
const ringGeo = new THREE.TorusGeometry(STAGE.R + 0.07, 0.035, 6, 48);
ringGeo.rotateX(Math.PI / 2);
const ringMat = new THREE.MeshStandardMaterial({ color: "#e0b04c", metalness: 0.9, roughness: 0.3, emissive: "#5a3c08" });
const plaqueGeo = new THREE.PlaneGeometry(0.36, 0.18);
const titleGeo = new THREE.PlaneGeometry(2.6, 0.447);

function hasBilingualText(items) {
  return items.some((it) => it.text && typeof it.text === "object");
}

/** Bake a builder into a group of merged meshes plus text/emoji decals. */
function toObject(b, shadows = true) {
  const group = new THREE.Group();
  const { geos, decals } = bake(b, mergeGeometries);
  const mats = materials();
  for (const [kind, geo] of Object.entries(geos)) {
    const mesh = new THREE.Mesh(geo, mats[kind]);
    mesh.castShadow = shadows && kind !== "glow" && kind !== "glass";
    mesh.receiveShadow = kind !== "glow";
    group.add(mesh);
  }
  for (const d of decals) {
    const tex = decalTexture(d.spec);
    const mat = d.glow
      ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: d.double ? THREE.DoubleSide : THREE.FrontSide })
      : new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.85, alphaTest: 0.02,
        side: d.double ? THREE.DoubleSide : THREE.FrontSide });
    const mesh = new THREE.Mesh(decalGeo, mat);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(d.matrix).multiply(new THREE.Matrix4().makeScale(d.w, d.h, 1));
    mesh.userData.decal = true;
    group.add(mesh);
  }
  return group;
}

function dispose(obj) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.decal) o.material.dispose();
    else if (o.userData.own) { o.geometry.dispose(); o.material.map?.dispose(); o.material.dispose(); }
    else if (o.geometry !== hitGeo && o.geometry !== ringGeo && o.geometry !== plaqueGeo && o.geometry !== titleGeo
      && !o.userData.shared) o.geometry.dispose();
  });
}

export class Stages {
  constructor(data, scene) {
    this.data = data;
    this.root = new THREE.Group();
    this.root.name = "stages";
    scene.add(this.root);
    this.sysColor = Object.fromEntries(data.systems.map((s) => [s.id, s.color]));
    this.list = Object.entries(data.exhibits).map(([ref, ex]) => ({
      ref, ex, x: ex.pos[0], y: ex.pos[1], z: ex.pos[2], dress: null, scene: null, anims: [], d2: Infinity,
    }));
    this.byRef = new Map(this.list.map((s) => [s.ref, s]));
    this.backGeo = backdropGeometry();
    this.recall = false;
    this.visited = new Set();
    this.hits = [];
    this.queue = [];
    this.tick = 0;
    this.time = 0;
    this.current = null;
  }

  // ── public ─────────────────────────────────────────────────────────────────
  setVisited(set) {
    this.visited = set;
    for (const s of this.list) if (s.dress) s.dress.userData.ring.visible = set.has(s.ref);
  }

  markVisited(ref) {
    this.visited.add(ref);
    const s = this.byRef.get(ref);
    if (s?.dress) s.dress.userData.ring.visible = true;
  }

  /** Recall mode hides titles and backdrop glyphs; `except` keeps one exhibit revealed. */
  setRecall(on, revealed = new Set()) {
    this.recall = on;
    this.revealed = revealed;
    for (const s of this.list) if (s.dress) this.drawLabels(s);
  }

  reveal(ref) {
    this.revealed?.add(ref);
    const s = this.byRef.get(ref);
    if (s?.dress) this.drawLabels(s);
  }

  setLang() {
    for (const s of this.list) {
      if (s.dress) this.drawLabels(s);
      if (s.scene && hasBilingualText(s.ex.scene.items)) this.unloadScene(s);
    }
  }

  setCurrent(ref) {
    this.current = ref;
  }

  /** Force-build the stage of ref right away (e.g. when the visitor teleports to it). */
  prepare(ref) {
    const s = this.byRef.get(ref);
    if (!s) return;
    if (!s.dress) this.buildDress(s);
    if (!s.scene) this.buildScene(s);
  }

  // ── per frame ──────────────────────────────────────────────────────────────
  update(dt, cam) {
    this.time += dt;
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.2;
      this.schedule(cam);
    }
    const t0 = performance.now();
    while (this.queue.length && performance.now() - t0 < BUDGET_MS) {
      const { s, what } = this.queue.shift();
      if (what === "dress" && !s.dress && s.d2 < DRESS_OUT * DRESS_OUT) this.buildDress(s);
      else if (what === "scene" && !s.scene && s.d2 < SCENE_OUT * SCENE_OUT) {
        if (!s.dress) this.buildDress(s);
        this.buildScene(s);
      }
    }
    this.animate(dt);
  }

  schedule(cam) {
    const want = [];
    for (const s of this.list) {
      const dx = s.x - cam.x, dz = s.z - cam.z, dy = (s.y - cam.y) * 2.5;
      s.d2 = dx * dx + dz * dz + dy * dy;
      if (s.scene && s.d2 > SCENE_OUT * SCENE_OUT) this.unloadScene(s);
      if (s.dress && s.d2 > DRESS_OUT * DRESS_OUT) this.unloadDress(s);
      if (!s.dress && s.d2 < DRESS_IN * DRESS_IN) want.push({ s, what: "dress" });
      if (!s.scene && s.d2 < SCENE_IN * SCENE_IN) want.push({ s, what: "scene" });
    }
    want.sort((a, b) => a.s.d2 - b.s.d2 || (a.what === "dress" ? -1 : 1));
    this.queue = want;
  }

  // ── dressing: backdrop panel, labels, ring, hit volume ─────────────────────
  buildDress(s) {
    const ex = s.ex;
    const g = new THREE.Group();
    g.position.set(s.x, s.y, s.z);
    g.rotation.y = ex.yaw;
    const style = this.data.styles[ex.style] || {};
    const base = style.stage || "#9a8f7e";
    const sys = this.sysColor[ex.system] || "#556677";
    const bd = ex.scene.backdrop || {};
    const bg = mix(mix(base, "#f4efe4", 0.7), sys, 0.06);
    const back = backdropTexture({ glyph: "", pattern: bd.pattern || "plain", bg, ink: shade(sys, -0.12), seed: hashString(s.ref) });
    const backMesh = new THREE.Mesh(this.backGeo, new THREE.MeshStandardMaterial({ map: back.tex, roughness: 0.9,
      emissive: "#ffffff", emissiveMap: back.tex, emissiveIntensity: 0.12, envMapIntensity: 0.4 }));
    backMesh.position.y = STAGE.H;
    backMesh.receiveShadow = true;
    backMesh.userData.shared = true;
    backMesh.userData.ownMat = true;
    g.add(backMesh);

    const gold = ex.locus % 5 === 0;
    const title = titleTexture({ locus: ex.locus, title: "", gold, accent: shade(sys, -0.05) });
    const titleMesh = new THREE.Mesh(titleGeo, new THREE.MeshBasicMaterial({ map: title.tex, transparent: true, fog: true }));
    titleMesh.position.set(0, STAGE.H + STAGE.BACK_H + 0.5, -STAGE.BACK_R + 0.12);
    g.add(titleMesh);

    const plaque = new THREE.Mesh(plaqueGeo, new THREE.MeshStandardMaterial({ map: plaqueTexture(ex.locus, gold, ex.locus % 10 === 0),
      roughness: 0.35, metalness: 0.5 }));
    plaque.position.set(0, STAGE.H * 0.52, STAGE.R + 0.045);
    plaque.userData.shared = true;
    g.add(plaque);

    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = STAGE.H + 0.01;
    ring.visible = this.visited.has(s.ref);
    g.add(ring);

    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.userData.ref = s.ref;
    g.add(hit);
    this.hits.push(hit);

    g.userData = { back, title, backMesh, titleMesh, ring, hit, plaque };
    s.dress = g;
    this.drawLabels(s);
    this.root.add(g);
  }

  drawLabels(s) {
    const { back, title } = s.dress.userData;
    const hide = this.recall && !(this.revealed && this.revealed.has(s.ref));
    const bd = s.ex.scene.backdrop || {};
    back.redraw(hide ? "" : tr(bd.glyph || ""));
    title.redraw(hide ? "?" : tr(s.ex.title));
  }

  unloadDress(s) {
    this.unloadScene(s);
    const g = s.dress;
    const { backMesh, titleMesh, hit, plaque } = g.userData;
    backMesh.material.map.dispose();
    backMesh.material.dispose();
    titleMesh.material.map.dispose();
    titleMesh.material.dispose();
    plaque.material.dispose();
    this.hits.splice(this.hits.indexOf(hit), 1);
    this.root.remove(g);
    s.dress = null;
  }

  // ── the 3D scene on the stage ──────────────────────────────────────────────
  buildScene(s) {
    const ex = s.ex;
    const items = ex.scene.items;
    const lang = getLang();
    const seed = hashString(s.ref);
    const placed = place(items);
    const still = new Builder({ props: BUILDERS_WITH_FALLBACK, lang, seed });
    const anims = [];
    const holder = new THREE.Group();
    holder.position.y = STAGE.H;
    placed.forEach((inst, k) => {
      const it = items[inst.item];
      const params = { seed: seed + k * 7 };
      for (const key of ["variant", "color", "color2", "text", "emoji", "pose", "hat", "hold"]) {
        if (it[key] !== undefined && it[key] !== null) params[key] = it[key];
      }
      const fn = builderFor(it.prop);
      if (it.anim) {
        const b = new Builder({ props: BUILDERS_WITH_FALLBACK, lang, seed: seed + k * 7 });
        try { fn(b, params); } catch (e) { console.warn(it.prop, e); }
        const obj = toObject(b);
        const pivot = new THREE.Group();
        pivot.position.set(inst.x, inst.y, inst.z);
        pivot.rotation.y = inst.yaw;
        pivot.scale.setScalar(inst.scale);
        pivot.add(obj);
        holder.add(pivot);
        anims.push({ obj: pivot, kind: it.anim, x: inst.x, y: inst.y, z: inst.z, yaw: inst.yaw, s: inst.scale, h: inst.h,
          phase: (k * 1.7) % 6.28, r: Math.hypot(inst.x, inst.z), a: Math.atan2(inst.x, inst.z) });
      } else {
        still.group({ at: [inst.x, inst.y, inst.z], rot: [0, inst.yaw, 0], scale: inst.scale }, () => {
          try { fn(still, params); } catch (e) { console.warn(it.prop, e); }
        });
      }
    });
    holder.add(toObject(still));
    s.dress.add(holder);
    s.scene = holder;
    s.anims = anims;
  }

  unloadScene(s) {
    if (!s.scene) return;
    s.scene.parent?.remove(s.scene);
    dispose(s.scene);
    s.scene = null;
    s.anims = [];
  }

  animate(dt) {
    const t = this.time;
    for (const s of this.list) {
      if (!s.scene || !s.anims.length) continue;
      for (const a of s.anims) {
        const o = a.obj, p = t + a.phase;
        switch (a.kind) {
          case "spin": o.rotation.y = a.yaw + p * 0.9; break;
          case "bob": o.position.y = a.y + 0.05 + Math.sin(p * 2) * 0.05; break;
          case "sway": o.rotation.z = Math.sin(p * 1.6) * 0.1; break;
          case "pulse": o.scale.setScalar(a.s * (1 + Math.sin(p * 3.2) * 0.06)); break;
          case "orbit": {
            const r = Math.max(0.25, a.r), ang = a.a + p * 0.5;
            o.position.x = Math.sin(ang) * r;
            o.position.z = Math.cos(ang) * r;
            o.rotation.y = ang + Math.PI / 2;
            break;
          }
          case "hop": o.position.y = a.y + Math.abs(Math.sin(p * 3)) * 0.12; break;
          case "swing": o.rotation.z = Math.sin(p * 1.8) * 0.3; break;
          case "flicker": o.scale.set(a.s * (1 + Math.sin(p * 13) * 0.04), a.s * (1 + Math.sin(p * 17.3) * 0.08), a.s); break;
          default: break;
        }
      }
    }
  }
}
