// Shared look of the palace: renderer settings, lights, materials for props, and
// canvas textures for text and emoji. Used by the viewer and by the prop lab.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { bake, materials } from "./props/kit.js";

export const FONTS = {
  display: '"Marcellus", "Noto Serif SC", "Noto Serif CJK SC", "Songti SC", "STSong", Georgia, serif',
  body: '"IBM Plex Sans", "Noto Sans SC", "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace',
  chalk: '"Patrick Hand", "Noto Sans SC", "Noto Sans CJK SC", "Comic Sans MS", cursive',
  emoji: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
};

export function createRenderer(canvas, { mobile = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance",
    preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

/** Hemisphere + sun with a shadow frustum that can follow a point; soft environment reflections. */
export function createLights(scene, renderer, { shadowSize = 2048, shadowRange = 42 } = {}) {
  const hemi = new THREE.HemisphereLight(0xfff6e8, 0x7f8f6a, 1.1);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sun.position.set(-60, 110, 45);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  const cam = sun.shadow.camera;
  cam.left = -shadowRange; cam.right = shadowRange; cam.top = shadowRange; cam.bottom = -shadowRange;
  cam.near = 1; cam.far = 400;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(hemi, sun, sun.target);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  const offset = sun.position.clone();
  return {
    hemi, sun,
    /** Keep the shadow frustum centred on (x, y, z). */
    follow(x, y, z) {
      sun.target.position.set(x, y, z);
      sun.position.set(x + offset.x, y + offset.y, z + offset.z);
      sun.target.updateMatrixWorld();
    },
  };
}

// ── canvas textures for decals ───────────────────────────────────────────────
const texCache = new Map();

function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split("\n")) {
    const cjk = /[㐀-鿿]/.test(para);
    const tokens = cjk ? Array.from(para) : para.split(/(\s+)/);
    let line = "";
    for (const t of tokens) {
      const next = line + t;
      if (line && ctx.measureText(next.trimEnd()).width > maxW) {
        out.push(line.trimEnd());
        line = t.trimStart();
      } else {
        line = next;
      }
    }
    out.push(line.trimEnd());
  }
  return out;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** spec: { type: "text"|"emoji", text, w, h, fg, bg, font, align, weight } → THREE.Texture */
export function decalTexture(spec) {
  const key = JSON.stringify(spec);
  const hit = texCache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (spec.type === "emoji") {
    canvas.width = canvas.height = 160;
    ctx.font = `128px ${FONTS.emoji}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(spec.text, 80, 88);
  } else {
    const aspect = Math.max(0.1, spec.w / spec.h);
    const H = 256;
    canvas.height = Math.round(Math.min(H, 1024 / aspect));
    canvas.width = Math.round(canvas.height * aspect);
    const W = canvas.width, Hc = canvas.height;
    if (spec.bg) {
      ctx.fillStyle = spec.bg;
      roundRect(ctx, 0, 0, W, Hc, Math.min(W, Hc) * 0.08);
      ctx.fill();
    }
    const family = FONTS[spec.font || "body"] || FONTS.body;
    const weight = spec.weight || (spec.font === "display" ? "400" : "600");
    const pad = Math.min(W, Hc) * 0.1;
    let size = Hc * 0.62;
    let lines;
    for (let i = 0; i < 24; i++) {
      ctx.font = `${weight} ${size}px ${family}`;
      lines = wrapLines(ctx, spec.text, W - pad * 2);
      const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
      if (lines.length * size * 1.18 <= Hc - pad * 2 && widest <= W - pad * 2) break;
      size *= 0.88;
    }
    ctx.fillStyle = spec.fg || "#222";
    ctx.textBaseline = "middle";
    ctx.textAlign = spec.align || "center";
    const x = ctx.textAlign === "left" ? pad : ctx.textAlign === "right" ? W - pad : W / 2;
    const total = lines.length * size * 1.18;
    lines.forEach((l, i) => ctx.fillText(l, x, Hc / 2 - total / 2 + size * 1.18 * (i + 0.5)));
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  texCache.set(key, tex);
  return tex;
}

export function clearDecalCache() {
  for (const t of texCache.values()) t.dispose();
  texCache.clear();
}

const decalGeo = new THREE.PlaneGeometry(1, 1);

/** Turn a built prop (Builder) into an Object3D: merged meshes per material, decals, glow halos. */
export function propObject(b, { shadows = true } = {}) {
  const group = new THREE.Group();
  const { geos, decals, lights } = bake(b, mergeGeometries);
  const mats = materials();
  for (const [kind, geo] of Object.entries(geos)) {
    const mesh = new THREE.Mesh(geo, mats[kind]);
    mesh.castShadow = shadows && kind !== "glow" && kind !== "glass";
    mesh.receiveShadow = shadows && kind !== "glow";
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
  group.userData.lights = lights;
  return group;
}

/** Dispose geometries and decal materials of an object made by propObject (textures are cached). */
export function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.isMesh) {
      if (!o.userData.decal) o.geometry.dispose();
      else o.material.dispose();
    }
  });
}
