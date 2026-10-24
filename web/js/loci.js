// The objects on the loci near the visitor. Plinths are static (arch.js); each object is
// built when the visitor comes close and disposed when they walk away.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Builder, bake, materials, hashString } from "./props/kit.js";
import { builderFor, BUILDERS_WITH_FALLBACK } from "./props/index.js";
import { decalTexture } from "./look.js";
import { place } from "./scene.js";
import { STAGE } from "./arch.js";

const SHOW_IN = 46, SHOW_OUT = 58;
const BUDGET_MS = 7;
const decalGeo = new THREE.PlaneGeometry(1, 1);

/** Bake a builder into a group of merged meshes plus text/emoji decals. */
function toObject(b) {
  const group = new THREE.Group();
  const { geos, decals } = bake(b, mergeGeometries);
  const mats = materials();
  for (const [kind, geo] of Object.entries(geos)) {
    const mesh = new THREE.Mesh(geo, mats[kind]);
    mesh.castShadow = kind !== "glow" && kind !== "glass";
    mesh.receiveShadow = kind !== "glow";
    group.add(mesh);
  }
  for (const d of decals) {
    const mat = new THREE.MeshStandardMaterial({ map: decalTexture(d.spec), transparent: true, roughness: 0.85,
      alphaTest: 0.02, side: d.double ? THREE.DoubleSide : THREE.FrontSide });
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
    else o.geometry.dispose();
  });
}

export class Loci {
  constructor(data, scene) {
    this.root = new THREE.Group();
    this.root.name = "loci";
    scene.add(this.root);
    this.list = Object.entries(data.loci).map(([id, l]) => ({ id, l, x: l.pos[0], y: l.pos[1], z: l.pos[2], obj: null, d2: Infinity }));
    this.byId = new Map(this.list.map((s) => [s.id, s]));
    this.queue = [];
    this.tick = 0;
  }

  /** Build the object of a locus right away (e.g. after teleporting next to it). */
  prepare(id) {
    const s = this.byId.get(id);
    if (s && !s.obj) this.build(s);
  }

  update(dt, cam) {
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.25;
      const want = [];
      for (const s of this.list) {
        const dx = s.x - cam.x, dz = s.z - cam.z, dy = (s.y - cam.y) * 2.5;
        s.d2 = dx * dx + dz * dz + dy * dy;
        if (s.obj && s.d2 > SHOW_OUT * SHOW_OUT) this.unload(s);
        else if (!s.obj && s.d2 < SHOW_IN * SHOW_IN) want.push(s);
      }
      want.sort((a, b) => a.d2 - b.d2);
      this.queue = want;
    }
    const t0 = performance.now();
    while (this.queue.length && performance.now() - t0 < BUDGET_MS) {
      const s = this.queue.shift();
      if (!s.obj && s.d2 < SHOW_OUT * SHOW_OUT) this.build(s);
    }
  }

  build(s) {
    const items = s.l.items;
    const seed = hashString(s.id);
    const b = new Builder({ props: BUILDERS_WITH_FALLBACK, lang: "en", seed });
    place(items).forEach((inst, k) => {
      const it = items[inst.item];
      const params = { seed: seed + k * 7 };
      for (const key of ["variant", "color", "color2", "text", "emoji", "pose", "hat", "hold"]) {
        if (it[key] !== undefined && it[key] !== null) params[key] = it[key];
      }
      b.group({ at: [inst.x, inst.y, inst.z], rot: [0, inst.yaw, 0], scale: inst.scale }, () => {
        try { builderFor(it.prop)(b, params); } catch (e) { console.warn(it.prop, e); }
      });
    });
    const obj = toObject(b);
    obj.position.set(s.x, s.y + STAGE.H, s.z);
    obj.rotation.y = s.l.yaw;
    this.root.add(obj);
    s.obj = obj;
  }

  unload(s) {
    this.root.remove(s.obj);
    dispose(s.obj);
    s.obj = null;
  }
}
