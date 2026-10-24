// The static world: ground, sky, architecture chunks, signs, decor props and lamp halos.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Builder, bake, materials, shade, mix, hashString } from "./props/kit.js";
import { builderFor, BUILDERS_WITH_FALLBACK, PROPS } from "./props/index.js";
import { propObject } from "./look.js";
import { tr } from "./i18n.js";
import { expand } from "./scene.js";
import { floorTexture, signTexture, glowTexture, cloudTexture } from "./textures.js";
import {
  Chunk, addArch, addDisc, addFloor, addHelix, addLamp, addPath, addRamp, addRoof, addShape, addLocusShell,
  addSupport, addWall, addWater,
} from "./arch.js";

const CHUNK = 48;
const COARSE = new Set(["tree", "bush", "rock", "hedge", "flower", "lamp_post", "fence", "mushroom", "potted_plant"]);
const SHOW = 230;          // chunks farther than this are hidden (fog has closed in)

// ── sky, ground, hills ───────────────────────────────────────────────────────
function buildSky() {
  const uniforms = {
    top: { value: new THREE.Color("#7fa7d6") },
    horizon: { value: new THREE.Color("#ebe6da") },
    bottom: { value: new THREE.Color("#c9cbb8") },
    sunDir: { value: new THREE.Vector3(-0.45, 0.62, 0.35).normalize() },
    sunColor: { value: new THREE.Color("#fff3d6") },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunColor;
      varying vec3 vDir;
      void main(){
        float h = vDir.y;
        vec3 c = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.62, h), 0.8)) : mix(horizon, bottom, smoothstep(0.0, 0.18, -h));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        c += sunColor * (pow(s, 900.0) * 1.6 + pow(s, 12.0) * 0.18);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 16), mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

function buildClouds(group) {
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    const mat = new THREE.SpriteMaterial({ map: cloudTexture(i % 5), transparent: true, depthWrite: false, fog: false,
      opacity: 0.85 });
    const s = new THREE.Sprite(mat);
    const a = (i / 16) * Math.PI * 2 + i * 0.37, r = 520 + (i % 4) * 140;
    s.position.set(Math.sin(a) * r, 150 + (i % 5) * 32, Math.cos(a) * r);
    const w = 220 + (i % 3) * 90;
    s.scale.set(w, w * 0.45, 1);
    s.renderOrder = -9;
    group.add(s);
    clouds.push({ s, a, r, speed: 0.004 + (i % 3) * 0.002 });
  }
  return clouds;
}

function buildHills(half) {
  const b = new Builder({ seed: 7 });
  const r = b.rng;
  for (let k = 0; k < 70; k++) {
    const a = (k / 70) * Math.PI * 2 + r.range(-0.03, 0.03);
    const dist = half + 140 + r.range(0, 260);
    const h = r.range(30, 110), rad = r.range(70, 150);
    const far = (dist - half) / 400;
    b.cone(rad, h, { at: [Math.sin(a) * dist, h / 2 - 4, Math.cos(a) * dist], seg: 7, color: mix("#6f8f69", "#9fb2b8", 0.35 + far * 0.5), flat: true });
  }
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2 + r.range(0, 0.15);
    const dist = half + 60 + r.range(0, 90);
    const h = r.range(10, 26);
    b.sphere(r.range(18, 34), { at: [Math.sin(a) * dist, -h * 0.4, Math.cos(a) * dist], scale: [1.6, h / 26, 1.2], seg: 10, color: mix("#7f9c69", "#9cae8e", r()), flat: true });
  }
  const { geos } = bake(b, mergeGeometries);
  const g = new THREE.Group();
  // distant hills sit beyond the fog: they carry their own haze instead
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, fog: false });
  for (const geo of Object.values(geos)) g.add(new THREE.Mesh(geo, mat));
  g.userData.mat = mat;
  return g;
}

function buildGround(half, color) {
  const size = half * 2 + 1400;
  const geo = new THREE.PlaneGeometry(size, size, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const tile = 3.2;
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * size / tile, uv.getY(i) * size / tile);
  const { map } = floorTexture("grass", [color, shade(color, -0.07)]);
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 1, envMapIntensity: 0.4 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -0.02;
  mesh.receiveShadow = true;
  return mesh;
}

// ── halos (glow sprites for lamps, bulbs, candles) ───────────────────────────
function haloMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: glowTexture() }, scale: { value: 400 }, intensity: { value: 0.5 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float size; attribute vec3 color; uniform float scale; varying vec3 vColor;
      void main(){ vColor = color; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(size * scale / -mv.z, 0.0, 256.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; uniform float intensity; varying vec3 vColor;
      void main(){ float a = texture2D(map, gl_PointCoord).a; gl_FragColor = vec4(vColor * a * intensity, 1.0); }`,
  });
}

function haloPoints(list, mat) {
  const pos = new Float32Array(list.length * 3), col = new Float32Array(list.length * 3), size = new Float32Array(list.length);
  const c = new THREE.Color();
  list.forEach((h, i) => {
    pos.set([h.x, h.y, h.z], i * 3);
    c.set(h.color);
    col.set([c.r, c.g, c.b], i * 3);
    size[i] = h.size;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("size", new THREE.BufferAttribute(size, 1));
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = true;
  g.computeBoundingSphere();
  return pts;
}

// ── signs ────────────────────────────────────────────────────────────────────
const SIGN_SIZE = { region: [10, 2.0], wing: [7.2, 1.45], room: [6, 0.95] };

class Sign {
  constructor(p) {
    this.p = p;
    const [dw, h] = SIGN_SIZE[p.lv] || SIGN_SIZE.room;
    this.w = p.w || dw;
    this.h = p.w ? h * Math.min(1, p.w / dw) * 1.05 : h;
    this.billboard = p.r === undefined || p.r === null;
    this.group = new THREE.Group();
    this.group.position.set(p.p[0], p.p[1], p.p[2]);
    if (!this.billboard) this.group.rotation.y = p.r;
    this.tex = null;
    this.draw();
  }

  draw() {
    const title = tr(this.p.text), sub = this.p.sub ? tr(this.p.sub) : "";
    if (!this.tex) {
      this.sign = signTexture({ title, sub, level: this.p.lv, color: this.p.c, aspect: this.w / this.h });
      this.tex = this.sign.tex;
      const mat = new THREE.MeshStandardMaterial({ map: this.tex, transparent: true, roughness: 0.6, alphaTest: 0.05,
        emissive: new THREE.Color("#ffffff"), emissiveMap: this.tex, emissiveIntensity: 0.18 });
      const geo = new THREE.PlaneGeometry(this.w, this.h);
      const front = new THREE.Mesh(geo, mat);
      front.position.z = 0.03;
      this.group.add(front);
      if (!this.billboard) {
        const back = new THREE.Mesh(geo, mat);
        back.rotation.y = Math.PI;
        back.position.z = -0.03;
        this.group.add(back);
        const board = new THREE.Mesh(new THREE.BoxGeometry(this.w + 0.1, this.h + 0.1, 0.05),
          new THREE.MeshStandardMaterial({ color: "#3a2e22", roughness: 0.7 }));
        this.group.add(board);
      }
    } else {
      this.sign.redraw(title, sub);
    }
  }
}

// ── the world ────────────────────────────────────────────────────────────────
export class World {
  constructor(data, scene) {
    this.data = data;
    this.scene = scene;
    this.chunks = new Map();
    this.signs = [];
    this.textProps = [];     // decor props carrying text: rebuilt when the language changes
    this.haloMat = haloMaterial();
    this.root = new THREE.Group();
    scene.add(this.root);
  }

  chunkAt(x, z) {
    const i = Math.floor(x / CHUNK), j = Math.floor(z / CHUNK);
    const key = i * 1000 + j;
    let ch = this.chunks.get(key);
    if (!ch) {
      ch = new Chunk(i, j, CHUNK);
      ch.halos = [];
      ch.signs = [];
      ch.decor = new Map();
      this.chunks.set(key, ch);
    }
    return ch;
  }

  /** Build everything; yields to the browser now and then. */
  async build(onProgress = () => {}) {
    const d = this.data;
    const sky = buildSky();
    this.sky = sky;
    this.scene.add(sky.mesh);
    this.cloudGroup = new THREE.Group();
    this.clouds = buildClouds(this.cloudGroup);
    this.scene.add(this.cloudGroup);
    this.hills = buildHills(d.half);
    this.scene.add(this.hills);
    this.ground = buildGround(d.half, "#93ad7c");
    this.scene.add(this.ground);

    const lociById = d.loci;
    const colorOf = Object.fromEntries(d.buildings.map((b) => [b.id, b.color]));
    let n = 0;
    const t0 = performance.now();
    for (const p of d.prims) {
      const x = p.p ? p.p[0] : p.c[0], z = p.p ? (p.p.length === 3 ? p.p[2] : p.p[1]) : p.c[1];
      const ch = p.t === "helix" ? this.chunkAt(p.c[0], p.c[1]) : this.chunkAt(x, z);
      switch (p.t) {
        case "floor": addFloor(ch, p); break;
        case "disc": addDisc(ch, p); break;
        case "path": addPath(ch, p); break;
        case "ramp": addRamp(ch, p); break;
        case "helix": addHelix(ch, p); break;
        case "support": addSupport(ch, p); break;
        case "wall": addWall(ch, p); break;
        case "roof": addRoof(ch, p); break;
        case "arch": addArch(ch, p); break;
        case "box": case "cyl": case "sphere": addShape(ch, p); break;
        case "water": addWater(ch, p); break;
        case "lamp": ch.halos.push(...addLamp(ch, p)); break;
        case "sign": {
          const s = new Sign(p);
          ch.signs.push(s);
          ch.extra.push(s.group);
          this.signs.push(s);
          break;
        }
        case "prop": this.addDecor(ch, p); break;
        case "locus": {
          const l = lociById[p.ref];
          const st = l && d.styles[l.style];
          addLocusShell(ch, p, { stage: mix(st ? st.stage : "#9a8f7e", "#e6dfd2", 0.5), accent: shade(colorOf[p.g] || "#b8862f", -0.05) });
          break;
        }
        default: break;
      }
      if (++n % 400 === 0) {
        onProgress(n / d.prims.length * 0.8);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    // decor props: instanced per chunk
    const mats = materials();
    let k = 0;
    for (const ch of this.chunks.values()) {
      this.finishDecor(ch);
      ch.finish(mergeGeometries, mats, bake);
      if (ch.halos.length) ch.group.add(haloPoints(ch.halos, this.haloMat));
      this.root.add(ch.group);
      if (++k % 12 === 0) {
        onProgress(0.8 + 0.2 * k / this.chunks.size);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    this.buildMs = performance.now() - t0;
  }

  // decor props ---------------------------------------------------------------
  addDecor(ch, p) {
    const o = p.o || {};
    const item = { prop: p.name, ...o, scale: p.s ?? 1 };
    const parent = new THREE.Matrix4().compose(new THREE.Vector3(p.p[0], p.p[1], p.p[2]),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.r || 0), new THREE.Vector3(1, 1, 1));
    const params = {};
    for (const key of ["variant", "color", "color2", "text", "emoji", "pose", "hat", "hold"]) if (o[key] !== undefined) params[key] = o[key];
    const hasText = params.text !== undefined || p.name === "cutout";
    for (const inst of expand(item, 0)) {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(inst.x, inst.y, inst.z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), inst.yaw), new THREE.Vector3(inst.scale, inst.scale, inst.scale));
      const world = parent.clone().multiply(m);
      if (hasText) {
        this.textProps.push({ ch, name: p.name, params, matrix: world, obj: null });
        continue;
      }
      const key = p.name + "|" + JSON.stringify(params);
      let list = ch.decor.get(key);
      if (!list) ch.decor.set(key, (list = { name: p.name, params, matrices: [] }));
      list.matrices.push(world);
    }
  }

  static decorCache = new Map();

  decorGeometry(name, params) {
    const key = name + "|" + JSON.stringify(params);
    let c = World.decorCache.get(key);
    if (!c) {
      const b = new Builder({ props: BUILDERS_WITH_FALLBACK, seed: hashString(key), lang: "en", lod: COARSE.has(name) ? 0.35 : 1 });
      builderFor(name)(b, { ...params });
      const { geos, decals, lights } = bake(b, mergeGeometries);
      c = { geos, decals, lights };
      World.decorCache.set(key, c);
    }
    return c;
  }

  finishDecor(ch) {
    const mats = materials();
    for (const { name, params, matrices } of ch.decor.values()) {
      const { geos, lights } = this.decorGeometry(name, params);
      for (const [kind, geo] of Object.entries(geos)) {
        const mesh = new THREE.InstancedMesh(geo, mats[kind], matrices.length);
        matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
        mesh.castShadow = kind !== "glow" && kind !== "glass";
        mesh.receiveShadow = kind !== "glow";
        mesh.computeBoundingSphere();
        ch.extra.push(mesh);
      }
      for (const l of lights) {
        for (const m of matrices) {
          const v = l.position.clone().applyMatrix4(m);
          ch.halos.push({ x: v.x, y: v.y, z: v.z, color: l.color, size: Math.min(4, 0.8 + l.radius * 8) });
        }
      }
    }
    ch.decor = null;
    for (const tp of this.textProps) if (tp.ch === ch && !tp.obj) this.buildTextProp(tp);
  }

  buildTextProp(tp, lang) {
    if (tp.obj) {
      tp.obj.parent?.remove(tp.obj);
      tp.obj.traverse((o) => { if (o.isMesh && o.userData.decal) o.material.dispose(); else if (o.isMesh) o.geometry.dispose(); });
    }
    const b = new Builder({ props: BUILDERS_WITH_FALLBACK, seed: 3, lang: lang || document.documentElement.dataset.lang || "en" });
    builderFor(tp.name)(b, { ...tp.params });
    const obj = propObject(b);
    obj.matrixAutoUpdate = false;
    obj.matrix.copy(tp.matrix);
    tp.obj = obj;
    if (tp.ch.group.parent || tp.ch.solid === null) tp.ch.group.add(obj);
    else tp.ch.extra.push(obj);
  }

  // per frame -----------------------------------------------------------------
  update(dt, camera) {
    const cam = camera.position;
    for (const ch of this.chunks.values()) {
      const dx = ch.center.x - cam.x, dz = ch.center.z - cam.z;
      const vis = dx * dx + dz * dz < SHOW * SHOW;
      ch.group.visible = vis;
      if (!vis) continue;
      for (const s of ch.signs) {
        if (!s.billboard) continue;
        s.group.rotation.y = Math.atan2(cam.x - s.group.position.x, cam.z - s.group.position.z);
      }
    }
    for (const c of this.clouds) {
      c.a += c.speed * dt;
      c.s.position.x = cam.x + Math.sin(c.a) * c.r;
      c.s.position.z = cam.z + Math.cos(c.a) * c.r;
    }
    this.sky.mesh.position.copy(cam);
    this.hills.position.set(0, 0, 0);
  }

  setLang(lang) {
    for (const s of this.signs) s.draw();
    for (const tp of this.textProps) this.buildTextProp(tp, lang);
  }

  setTheme(t) {
    const u = this.sky.uniforms;
    u.top.value.set(t.skyTop);
    u.horizon.value.set(t.skyHorizon);
    u.bottom.value.set(t.skyBottom);
    u.sunColor.value.set(t.sun);
    this.ground.material.map = floorTexture("grass", [t.grass, shade(t.grass, -0.07)]).map;
    this.ground.material.needsUpdate = true;
    this.haloMat.uniforms.intensity.value = t.night ? 1.0 : 0.22;
    for (const c of this.clouds) c.s.material.opacity = t.night ? 0.25 : 0.85;

  }

  setViewport(height, fov) {
    this.haloMat.uniforms.scale.value = height / 2 / Math.tan((fov * Math.PI) / 360);
  }
}
