// Scene items → placed copies. Mirrors palace/scenes.py expand() and place() exactly.
//
// Stage coordinates (metres): x to the viewer's right, z towards the viewer,
// y up from the stage top; rot in degrees, 0 = facing the viewer.
import { PROPS } from "./props/catalog.js";

export const STAGE_R = 1.35;
const GOLDEN = 2.399963229728653;
const RAD = Math.PI / 180;

function defaultSpacing(w, d, scale) {
  return Math.max(w, d) * scale + 0.05;
}

/** All placed copies of one item: [{ item, x, z, y, yaw, w, h, d, scale }]. */
export function expand(item, index = 0) {
  const spec = PROPS[item.prop];
  const [w0, h0, d0] = spec ? spec.size : [0.3, 0.3, 0.3];
  const s = Number(item.scale ?? 1);
  const w = w0 * s, h = h0 * s, d = d0 * s;
  const [x0, z0] = item.at || [0, 0];
  const y0 = Number(item.y || 0);
  const rot = Number(item.rot || 0) * RAD;
  const n = Number(item.count || 1);
  const arrange = item.arrange || (n > 1 ? "row" : null);
  const face = item.face || "viewer";
  const sp = item.spacing || defaultSpacing(w0, d0, s);
  const out = [];
  const add = (dx, dz, dy = 0, yaw = rot) => out.push({ item: index, x: x0 + dx, z: z0 + dz, y: y0 + dy, yaw, w, h, d, scale: s });

  if (n === 1 || !arrange) add(0, 0);
  else if (arrange === "row") for (let i = 0; i < n; i++) add((i - (n - 1) / 2) * sp, 0);
  else if (arrange === "column") for (let i = 0; i < n; i++) add(0, (i - (n - 1) / 2) * sp);
  else if (arrange === "grid") {
    const cols = Number(item.cols || Math.ceil(Math.sqrt(n)));
    const rows = Math.ceil(n / cols);
    for (let i = 0; i < n; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      add((c - (cols - 1) / 2) * sp, (r - (rows - 1) / 2) * sp);
    }
  } else if (arrange === "ring") {
    const radius = item.radius || Math.max(0.3, (n * sp) / (2 * Math.PI));
    for (let i = 0; i < n; i++) {
      const t = (2 * Math.PI * i) / n;
      const yaw = rot + (face === "center" ? t + Math.PI : face === "out" ? t : 0);
      add(radius * Math.sin(t), radius * Math.cos(t), 0, yaw);
    }
  } else if (arrange === "arc") {
    const radius = item.radius || 0.6;
    for (let i = 0; i < n; i++) {
      const t = (-70 + 140 * (n > 1 ? i / (n - 1) : 0.5)) * RAD;
      const yaw = rot + (face === "center" ? -t : face === "out" ? Math.PI - t : 0);
      add(radius * Math.sin(t), -radius * Math.cos(t), 0, yaw);
    }
  } else if (arrange === "stack") {
    for (let i = 0; i < n; i++) add(0, 0, i * (h + 0.01));
  } else if (arrange === "scatter") {
    const radius = item.radius || 0.4;
    for (let i = 0; i < n; i++) {
      const r = radius * Math.sqrt((i + 0.5) / n);
      const t = i * GOLDEN;
      add(r * Math.sin(t), r * Math.cos(t), 0, rot + 47 * i * RAD);
    }
  } else add(0, 0);
  return out;
}

/** Expand every item and resolve `on` (stand an item on top of an earlier item). */
export function place(items) {
  const placed = [];
  const tops = new Map();
  items.forEach((item, i) => {
    const insts = expand(item, i);
    const on = item.on;
    if (on !== undefined && on !== null && tops.has(on)) for (const inst of insts) inst.y += tops.get(on);
    for (const inst of insts) tops.set(i, Math.max(tops.get(i) ?? 0, inst.y + inst.h));
    placed.push(...insts);
  });
  return placed;
}
