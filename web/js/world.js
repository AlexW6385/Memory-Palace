// Turns world.json into a three.js scene.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { buildSymbol } from "./symbols.js";

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

function placed(geo, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) {
  _q.setFromEuler(_e.set(0, ry, 0));
  _m.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
  return geo.applyMatrix4(_m);
}

function primGeometry(p) {
  switch (p.t) {
    case "box":
      return placed(new THREE.BoxGeometry(p.s[0], p.s[1], p.s[2]), p.p[0], p.p[1], p.p[2], p.r);
    case "cyl":
      return placed(new THREE.CylinderGeometry(p.rt, p.rb, p.h, p.n), p.p[0], p.p[1], p.p[2]);
    case "sphere":
      return placed(new THREE.SphereGeometry(p.rad, 20, 14), p.p[0], p.p[1], p.p[2]);
    case "roof": {
      const g = new THREE.CylinderGeometry(0, Math.SQRT1_2, 1, 4, 1, false, Math.PI / 4);
      return placed(g, p.p[0], p.p[1] + p.s[1] / 2, p.p[2], p.r, p.s[0], p.s[1], p.s[2]);
    }
    case "ramp": {
      const g = new THREE.BoxGeometry(p.w, p.th, p.d);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const t = (pos.getZ(i) + p.d / 2) / p.d;
        pos.setY(i, pos.getY(i) - p.th / 2 + p.y0 + t * (p.y1 - p.y0));
      }
      g.computeVertexNormals();
      return placed(g, p.p[0], 0, p.p[1], p.r);
    }
  }
  return null;
}

function helixGeometry(p, rail) {
  // Each face gets its own vertices so normals stay crisp.
  const steps = Math.max(8, Math.ceil(p.sweep / (Math.PI / 60)));
  const pos = [], idx = [];
  const at = (t, r, y) => [p.c[0] + r * Math.sin(p.a0 + t), y, p.c[1] - r * Math.cos(p.a0 + t)];
  const yAt = (t) => p.y0 + (p.pitch * t) / (Math.PI * 2);
  // a band is a strip between two edges; edge(t) -> [x, y, z]
  const band = (edgeA, edgeB) => {
    const base = pos.length / 3;
    for (let i = 0; i <= steps; i++) {
      const t = (p.sweep * i) / steps;
      pos.push(...edgeA(t), ...edgeB(t));
    }
    for (let i = 0; i < steps; i++) {
      const a = base + i * 2, b = a + 2;
      idx.push(a, b, b + 1, a, b + 1, a + 1);
    }
  };
  if (!rail) {
    band((t) => at(t, p.r0, yAt(t)), (t) => at(t, p.r1, yAt(t)));                 // top
    band((t) => at(t, p.r1, yAt(t)), (t) => at(t, p.r1, yAt(t) - p.th));          // outer side
    band((t) => at(t, p.r1, yAt(t) - p.th), (t) => at(t, p.r0, yAt(t) - p.th));   // bottom
    band((t) => at(t, p.r0, yAt(t) - p.th), (t) => at(t, p.r0, yAt(t)));          // inner side
  } else {
    const r = p.r1 - 0.12;
    band((t) => at(t, r, yAt(t) + 1.0), (t) => at(t, r, yAt(t)));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const matCache = new Map();
function lambert(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  let m = matCache.get(key);
  if (!m) matCache.set(key, (m = new THREE.MeshLambertMaterial({ color, ...opts })));
  return m;
}

export function buildStatic(world, scene, labels) {
  const groups = new Map(); // tag|color -> geometries
  for (const p of world.prims) {
    if (p.t === "sign") {
      labels.add({ level: p.lv, text: p.text, sub: p.sub, color: p.c, pos: new THREE.Vector3(...p.p) });
      continue;
    }
    if (p.t === "helix") {
      scene.add(new THREE.Mesh(helixGeometry(p, false), lambert(p.col, { side: THREE.DoubleSide })));
      scene.add(new THREE.Mesh(helixGeometry(p, true), lambert(p.rail, { side: THREE.DoubleSide })));
      continue;
    }
    const g = primGeometry(p);
    if (!g) continue;
    const key = p.g + "|" + p.c;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(g.index ? g.toNonIndexed() : g);
  }
  for (const [key, list] of groups) {
    const color = key.split("|")[1];
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, lambert(color));
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
  }

  // ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(world.half * 2 + 400, world.half * 2 + 400), lambert("#9db586"));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  scene.add(ground);
  return { ground };
}

export function buildExhibits(world, scene, labels) {
  const list = [];
  const hitGeo = new THREE.CylinderGeometry(0.75, 0.75, 2.6, 8);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  for (const [ref, ex] of Object.entries(world.exhibits)) {
    const [x, y, z] = ex.pos;
    const sym = buildSymbol(ex.symbol, ex.color);
    sym.position.set(x, y + 1.58, z);
    sym.rotation.y = (ex.order * 0.7) % (Math.PI * 2);
    sym.visible = false;
    scene.add(sym);
    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.position.set(x, y + 1.3, z);
    hit.userData.ref = ref;
    hit.visible = false;
    hit.updateMatrixWorld();
    const label = labels.add({
      level: "exhibit", text: ex.title, emoji: ex.emoji, color: ex.color,
      pos: new THREE.Vector3(x, y + 2.42, z),
    });
    list.push({ ref, ex, sym, hit, label, pos: new THREE.Vector3(x, y + 1.6, z) });
  }
  return list;
}

export function buildBridges(world, scene) {
  const centers = {};
  for (const s of world.systems) {
    const p = world.plots[s.plot];
    centers[s.id] = new THREE.Vector3(p.center[0], 70, p.center[1]);
  }
  const mat = new THREE.LineDashedMaterial({ color: 0xe0b45a, dashSize: 6, gapSize: 4, transparent: true, opacity: 0.75 });
  for (const b of world.bridges) {
    const a = centers[b.a], c = centers[b.b];
    if (!a || !c) continue;
    const mid = a.clone().add(c).multiplyScalar(0.5);
    mid.y = 70 + a.distanceTo(c) * 0.35;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, c);
    const g = new THREE.BufferGeometry().setFromPoints(curve.getPoints(64));
    const line = new THREE.Line(g, mat);
    line.computeLineDistances();
    scene.add(line);
  }
}

export function buildSky(scene) {
  const uniforms = {
    top: { value: new THREE.Color("#8fb3d6") },
    horizon: { value: new THREE.Color("#e9e6de") },
    bottom: { value: new THREE.Color("#b9c2a8") },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.55)) : mix(horizon, bottom, pow(-h, 0.4));
      gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 16), mat);
  sky.renderOrder = -1;
  scene.add(sky);
  return uniforms;
}
