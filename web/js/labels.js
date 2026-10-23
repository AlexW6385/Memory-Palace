// Billboard text drawn on canvases. Sprites are created only near the visitor
// and disposed when they fall out of range, which keeps GPU memory small.
import * as THREE from "three";

export const FONTS = {
  display: '"Noto Serif SC", "Noto Serif CJK SC", "Songti SC", "STSong", "SimSun", serif',
  body: '"Noto Sans SC", "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
};

const STYLES = {
  // world height of the sprite, canvas height, draw range (m)
  region: { h: 3.2, px: 168, range: 700 },
  wing: { h: 1.9, px: 128, range: 180 },
  room: { h: 0.9, px: 80, range: 70 },
  exhibit: { h: 0.36, px: 72, range: 30 },
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function clip(text, max) {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

function makeCanvas(item) {
  const st = STYLES[item.level];
  const H = st.px;
  const ctx = document.createElement("canvas").getContext("2d");
  const title = item.text;
  const sub = item.sub ? clip(item.sub, item.level === "region" ? 22 : 26) : "";
  const titleFont = item.level === "exhibit"
    ? `600 ${Math.round(H * 0.5)}px ${FONTS.body}`
    : `700 ${Math.round(H * (sub ? 0.46 : 0.6))}px ${FONTS.display}`;
  const subFont = `400 ${Math.round(H * 0.2)}px ${FONTS.body}`;
  ctx.font = titleFont;
  let w = ctx.measureText(title).width;
  const emoji = item.emoji ? item.emoji + " " : "";
  let ew = 0;
  if (emoji) { ctx.font = `${Math.round(H * 0.5)}px ${FONTS.body}`; ew = ctx.measureText(emoji).width; }
  if (sub) { ctx.font = subFont; w = Math.max(w, ctx.measureText(sub).width); }
  const pad = H * 0.32;
  const W = Math.ceil(w + ew + pad * 2);
  ctx.canvas.width = W;
  ctx.canvas.height = H;

  const color = new THREE.Color(item.color || "#ffffff");
  if (item.level === "exhibit" || item.level === "room") {
    ctx.fillStyle = "rgba(22, 26, 34, 0.78)";
    roundRect(ctx, 0, 0, W, H, H * 0.22);
    ctx.fill();
    ctx.fillStyle = "#" + color.getHexString();
    ctx.fillRect(pad * 0.5, H - H * 0.1, W - pad, H * 0.05);
  } else {
    ctx.fillStyle = "rgba(250, 248, 243, 0.92)";
    roundRect(ctx, 0, 0, W, H, H * 0.12);
    ctx.fill();
    ctx.fillStyle = "#" + color.getHexString();
    ctx.fillRect(0, 0, H * 0.07, H);
  }
  const dark = item.level === "exhibit" || item.level === "room";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  let x = pad;
  const ty = sub ? H * 0.38 : H * 0.53;
  if (emoji) {
    ctx.font = `${Math.round(H * 0.5)}px ${FONTS.body}`;
    ctx.fillText(emoji, x, ty);
    x += ew;
  }
  ctx.font = titleFont;
  ctx.fillStyle = dark ? "#f6f3ec" : "#" + color.clone().multiplyScalar(0.62).getHexString();
  ctx.fillText(title, x, ty);
  if (sub) {
    ctx.font = subFont;
    ctx.fillStyle = dark ? "#c9ccd2" : "#4a4f58";
    ctx.fillText(sub, pad, H * 0.76);
  }
  return ctx.canvas;
}

export class Labels {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.live = new Set();
    this.enabled = false; // turned on once fonts are ready
  }

  add(item) {
    // item: {level, text, sub, emoji, color, pos: Vector3}
    item.sprite = null;
    item.hidden = false;
    this.items.push(item);
    return item;
  }

  #create(item) {
    const st = STYLES[item.level];
    const canvas = makeCanvas(item);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.scale.set(st.h * canvas.width / canvas.height, st.h, 1);
    s.position.copy(item.pos);
    s.renderOrder = item.level === "region" ? 3 : 2;
    this.scene.add(s);
    item.sprite = s;
    this.live.add(item);
  }

  #dispose(item) {
    const s = item.sprite;
    this.scene.remove(s);
    s.material.map.dispose();
    s.material.dispose();
    item.sprite = null;
    this.live.delete(item);
  }

  update(camPos) {
    if (!this.enabled) return;
    let created = 0;
    for (const it of this.items) {
      const range = STYLES[it.level].range;
      const d = it.pos.distanceTo(camPos);
      if (!it.sprite && !it.hidden && d < range && created < 24) { this.#create(it); created++; }
      else if (it.sprite && (d > range * 1.25 || it.hidden)) this.#dispose(it);
    }
  }
}
