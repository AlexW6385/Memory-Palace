import * as THREE from "three";
import { buildProp, PROPS } from "../js/props/index.js";
import { CATALOG } from "../js/props/catalog.js";
import { createRenderer, createLights, propObject, decalTexture } from "../js/look.js";

const q = new URLSearchParams(location.search);
const canvas = document.getElementById("c");
const renderer = createRenderer(canvas);
const scene = new THREE.Scene();
scene.background = new THREE.Color("#d9dde0");
const lights = createLights(scene, renderer, { shadowRange: 30 });

let names = q.get("names") ? q.get("names").split(",") : [];
if (q.get("group")) names = CATALOG.props.filter((p) => p.group === q.get("group")).map((p) => p.name);
const vary = q.get("vary");
const extra = q.get("params") ? JSON.parse(q.get("params")) : {};
const turn = THREE.MathUtils.degToRad(Number(q.get("turn") || 0));

const cells = [];
for (const name of names) {
  const meta = PROPS[name];
  if (!meta) continue;
  let values = [undefined];
  if (vary === "variant" && meta.variants.length) values = meta.variants;
  if (vary === "pose") values = CATALOG.poses;
  if (vary === "hat") values = CATALOG.hats;
  if (vary === "hold") values = CATALOG.props.filter((p) => p.holdable).map((p) => p.name);
  for (const v of values) cells.push({ name, meta, params: { ...extra, ...(v !== undefined ? { [vary]: v } : {}) },
    label: v !== undefined ? `${name} · ${v}` : name });
}

const cols = Number(q.get("cols") || Math.ceil(Math.sqrt(cells.length * 1.6)));
const maxDim = Math.max(0.3, ...cells.map((c) => Math.max(c.meta.size[0], c.meta.size[2], c.meta.size[1] * 0.7)));
const maxH = Math.max(...cells.map((c) => c.meta.size[1]), 0.2);
const pitch = Math.max(0.7, maxDim * 1.25 + 0.3);
const rows = Math.ceil(cells.length / cols);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(cols * pitch + 4, rows * pitch + 4),
  new THREE.MeshStandardMaterial({ color: "#aeb4b8", roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const env = { texture: decalTexture, lang: q.get("lang") || "en" };
let errors = 0;
cells.forEach((c, i) => {
  const col = i % cols, row = Math.floor(i / cols);
  const x = (col - (cols - 1) / 2) * pitch, z = (row - (rows - 1) / 2) * pitch;
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(pitch * 0.42, pitch * 0.44, 0.04, 40),
    new THREE.MeshStandardMaterial({ color: "#d8d5ce", roughness: 0.9 }));
  plinth.position.set(x, 0.02, z);
  plinth.receiveShadow = true;
  scene.add(plinth);
  try {
    const b = buildProp(c.name, { seed: i + 1, ...c.params }, env);
    const obj = propObject(b);
    obj.position.set(x, 0.04, z);
    obj.rotation.y = turn;
    scene.add(obj);
  } catch (e) {
    errors++;
    console.error(c.label, e);
  }
  if (q.get("bbox")) {
    const [w, h, d] = c.meta.size;
    const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
      new THREE.LineBasicMaterial({ color: "#d0443a" }));
    box.position.set(x, 0.04 + h / 2, z);
    box.rotation.y = turn;
    scene.add(box);
  }
  const tex = decalTexture({ type: "text", text: c.label, w: pitch * 0.9, h: 0.16, fg: "#333", font: "body" });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(pitch * 0.9, 0.16),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  label.rotation.x = -Math.PI / 2;
  label.position.set(x, 0.05, z + pitch * 0.47);
  scene.add(label);
});

const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 400);
function frame() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const el = THREE.MathUtils.degToRad(Number(q.get("elev") || 30));
  const halfW = cols * pitch / 2, halfD = rows * pitch / 2;
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tanH = tanV * camera.aspect;
  const fitW = halfW / tanH + halfD * Math.cos(el);
  const fitD = (halfD * Math.sin(el) + maxH * Math.cos(el)) / tanV + halfD * Math.cos(el);
  const dist = Math.max(fitW, fitD, 1.2) * 1.04 * Number(q.get("zoom") || 1);
  camera.position.set(0, Math.sin(el) * dist + maxH * 0.4, Math.cos(el) * dist);
  camera.lookAt(0, maxH * 0.4, 0);
  camera.updateProjectionMatrix();
  lights.follow(0, 0, 0);
  const s = Math.max(cols, rows) * pitch;
  Object.assign(lights.sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s });
  lights.sun.shadow.camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}
document.getElementById("info").textContent = `${cells.length} cells${errors ? `, ${errors} errors (see console)` : ""}`;
addEventListener("resize", frame);
frame();
window.READY = true;
