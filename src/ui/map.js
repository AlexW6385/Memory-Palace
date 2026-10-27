// The map: districts, the river, every building's footprint and the visitor. Click anywhere on
// the land to go there; click a building (or its name in the list) to go to its entrance. Drag to
// pan, wheel or pinch to zoom.

import { tr, t } from './i18n.js';
import { WORLD } from '../world/regions.js';
import { terrainHeight, riverAt, regionWeights, REGIONS, inRiver } from '../world/regions.js';

export class MapView {
  constructor(world, onJump, onGo) {
    this.world = world;
    this.onJump = onJump;
    this.onGo = onGo;
    this.canvas = document.getElementById('map-canvas');
    this.list = document.getElementById('map-list');
    this.view = null;
    this._bind();
  }

  open(player) {
    this.player = player;
    this.renderList();
    this.fit(); this.draw();
    requestAnimationFrame(() => { this.fit(); this.draw(); });
  }

  renderList() {
    this.list.innerHTML = '';
    for (const rec of this.world.plans.values()) {
      if (rec.plan.feature) continue;
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.innerHTML = `<span class="name"></span><span class="era"></span>`;
      b.querySelector('.name').textContent = tr(rec.plan.name);
      b.querySelector('.era').textContent = tr(rec.plan.era);
      b.onclick = () => this.onJump(rec);
      li.appendChild(b);
      this.list.appendChild(li);
    }
  }

  fit() {
    const cv = this.canvas, r = cv.getBoundingClientRect();
    cv.width = r.width * devicePixelRatio; cv.height = r.height * devicePixelRatio;
    // the whole walkable world
    let [x0, z0, x1, z1] = WORLD.bounds;
    if (this.player) { x0 = Math.min(x0, this.player.x); x1 = Math.max(x1, this.player.x); z0 = Math.min(z0, this.player.z); z1 = Math.max(z1, this.player.z); }
    if (!Number.isFinite(x0)) { x0 = -100; z0 = -100; x1 = 100; z1 = 100; }
    const pad = 40, w = x1 - x0 + pad * 2, h = z1 - z0 + pad * 2;
    const s = Math.min(cv.width / w, cv.height / h);
    this.view = { s, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
  }

  toScreen(x, z) { const v = this.view, cv = this.canvas; return [cv.width / 2 + (x - v.cx) * v.s, cv.height / 2 + (z - v.cz) * v.s]; }
  toWorld(px, py) { const v = this.view, cv = this.canvas; return [(px - cv.width / 2) / v.s + v.cx, (py - cv.height / 2) / v.s + v.cz]; }

  draw() {
    const cv = this.canvas, g = cv.getContext('2d'), v = this.view;
    if (!v) return;
    g.fillStyle = '#2f281f';
    g.fillRect(0, 0, cv.width, cv.height);
    // the land: a shaded relief drawn once, then placed under the current view
    const relief = this.relief();
    const [ax, ay] = this.toScreen(relief.rect[0], relief.rect[1]), [bx, by] = this.toScreen(relief.rect[2], relief.rect[3]);
    g.imageSmoothingEnabled = true;
    g.drawImage(relief.canvas, ax, ay, bx - ax, by - ay);
    // floors (light) then obstacles (dark), per building
    for (const rec of this.world.buildings.values()) {
      g.fillStyle = 'rgba(214, 190, 150, 0.22)';
      for (const f of rec.built.colliders.floors) {
        const [a, b] = this.toScreen(f.rect[0], f.rect[1]), [c, d] = this.toScreen(f.rect[2], f.rect[3]);
        g.fillRect(a, b, c - a, d - b);
      }
      g.fillStyle = 'rgba(232, 214, 180, 0.85)';
      for (const o of rec.built.colliders.obstacles) {
        g.beginPath();
        if (o.circle) { const [x, y] = this.toScreen(o.circle[0], o.circle[1]); g.arc(x, y, Math.max(1, o.circle[2] * v.s), 0, Math.PI * 2); }
        else { o.poly.forEach(([x, z], i) => { const [px, py] = this.toScreen(x, z); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath(); }
        g.fill();
      }
    }
    // buildings not yet built: their outline; then every name
    for (const rec of this.world.plans.values()) {
      if (rec.plan.feature) continue;
      if (!this.world.buildings.has(rec.id)) {
        const b = this.world.constructor.worldBounds(rec.plan);
        const [a, c] = this.toScreen(b[0], b[1]), [d, e2] = this.toScreen(b[2], b[3]);
        g.strokeStyle = 'rgba(232, 214, 180, 0.6)'; g.strokeRect(a, c, d - a, e2 - c);
      }
      const e = this.world.entrance(rec.plan);
      const [nx, ny] = this.toScreen(e[0], e[2]);
      g.fillStyle = '#f3ead9';
      g.font = `${15 * devicePixelRatio}px Palatino, Georgia, serif`;
      g.textAlign = 'center';
      g.fillText(tr(rec.plan.name), nx, ny + 22 * devicePixelRatio);
    }
    // district names, above the buildings of each district
    const groups = new Map();
    for (const rec of this.world.plans.values()) {
      if (rec.plan.feature) continue;
      const e = this.world.entrance(rec.plan);
      const k = rec.plan.district;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(e);
    }
    g.fillStyle = 'rgba(243,234,217,0.62)';
    g.font = `italic ${15 * devicePixelRatio}px Palatino, Georgia, serif`;
    g.textAlign = 'center';
    for (const [k, list] of groups) {
      const x = list.reduce((s, e) => s + e[0], 0) / list.length, z = Math.min(...list.map((e) => e[2]));
      const [px, py] = this.toScreen(x, z);
      g.fillText(t('districts')[k] || k, px, py - 70 * devicePixelRatio);
    }
    // where a click would take the visitor
    if (this.hover) {
      const [hx, hy] = this.hover, k = 7 * devicePixelRatio;
      g.strokeStyle = 'rgba(243, 234, 217, 0.9)'; g.lineWidth = 1.5 * devicePixelRatio;
      g.beginPath(); g.arc(hx, hy, k, 0, Math.PI * 2); g.moveTo(hx - k * 1.8, hy); g.lineTo(hx - k * 0.6, hy); g.moveTo(hx + k * 0.6, hy); g.lineTo(hx + k * 1.8, hy);
      g.moveTo(hx, hy - k * 1.8); g.lineTo(hx, hy - k * 0.6); g.moveTo(hx, hy + k * 0.6); g.lineTo(hx, hy + k * 1.8); g.stroke();
      g.lineWidth = 1;
    }
    // the visitor
    if (this.player) {
      const [px, py] = this.toScreen(this.player.x, this.player.z), a = this.player.yaw;
      g.save(); g.translate(px, py); g.rotate(-a);
      g.fillStyle = '#d9b26a';
      const k = 9 * devicePixelRatio;
      g.beginPath(); g.moveTo(0, -k); g.lineTo(k * 0.6, k * 0.7); g.lineTo(0, k * 0.35); g.lineTo(-k * 0.6, k * 0.7); g.closePath(); g.fill();
      g.restore();
    }
  }

  /** Shaded relief of the world (hill shading lit from the north-west, region tints, the river). */
  relief() {
    if (this._relief) return this._relief;
    const rect = [WORLD.bounds[0] - 200, WORLD.bounds[1] - 200, WORLD.bounds[2] + 200, WORLD.bounds[3] + 200];
    const S = 12, W = Math.round((rect[2] - rect[0]) / S), H = Math.round((rect[3] - rect[1]) / S);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d'), img = g.createImageData(W, H);
    const h = new Float32Array((W + 1) * (H + 1));
    for (let j = 0; j <= H; j++) for (let i = 0; i <= W; i++) h[j * (W + 1) + i] = terrainHeight(rect[0] + i * S, rect[1] + j * S);
    const tint = { nile: [196, 170, 128], rome: [150, 152, 112], greece: [170, 140, 110], byzantium: [140, 150, 120], levant: [180, 160, 125], francia: [130, 150, 105], tang: [176, 152, 110], heian: [120, 140, 100], india: [172, 148, 112] };
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const x = rect[0] + i * S, z = rect[1] + j * S, y = h[j * (W + 1) + i];
      const dx = h[j * (W + 1) + i + 1] - y, dz = h[(j + 1) * (W + 1) + i] - y;
      const shade = Math.max(0.35, Math.min(1.25, 0.9 - (dx * 0.7 + dz * 0.7) / S * 0.9));
      const w = regionWeights(x, z);
      let c = [0, 0, 0];
      REGIONS.forEach((r, k) => { for (let q = 0; q < 3; q++) c[q] += w[k] * tint[r.id][q]; });
      const lift = Math.min(1, y / 120) * 30;
      c = c.map((v) => v * shade + lift);
      if (inRiver(x, z)) c = [52, 82, 92];
      const o = (j * W + i) * 4;
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    this._relief = { canvas: cv, rect };
    return this._relief;
  }

  _bind() {
    const cv = this.canvas;
    let drag = null, moved = 0;
    const pts = new Map();
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); drag = [e.clientX, e.clientY]; moved = 0; });
    cv.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId) && this.view && e.pointerType === 'mouse') {
        const r = cv.getBoundingClientRect();
        this.hover = [(e.clientX - r.left) * devicePixelRatio, (e.clientY - r.top) * devicePixelRatio];
        this.draw();
        return;
      }
      if (!pts.has(e.pointerId) || !this.view) return;
      const prev = pts.get(e.pointerId);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d0 = Math.hypot(a[0] - b[0], a[1] - b[1]);
        pts.set(e.pointerId, [e.clientX, e.clientY]);
        const [c, d] = [...pts.values()];
        const d1 = Math.hypot(c[0] - d[0], c[1] - d[1]);
        if (d0 > 0) this.view.s *= d1 / d0;
      } else {
        this.view.cx -= (e.clientX - prev[0]) * devicePixelRatio / this.view.s;
        this.view.cz -= (e.clientY - prev[1]) * devicePixelRatio / this.view.s;
        pts.set(e.pointerId, [e.clientX, e.clientY]);
      }
      moved += Math.abs(e.clientX - prev[0]) + Math.abs(e.clientY - prev[1]);
      this.draw();
    });
    cv.addEventListener('pointerup', (e) => {
      pts.delete(e.pointerId);
      if (moved < 6 && drag) this.click(e);
      drag = null;
    });
    cv.addEventListener('pointerleave', () => { this.hover = null; this.draw(); });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); if (!this.view) return; this.view.s *= Math.exp(-e.deltaY * 0.0015); this.draw(); }, { passive: false });
  }

  click(e) {
    if (!this.view) this.fit();
    const r = this.canvas.getBoundingClientRect();
    const px = (e.clientX - r.left) * devicePixelRatio, py = (e.clientY - r.top) * devicePixelRatio;
    const [x, z] = this.toWorld(px, py);
    // a building: its name or its footprint takes the visitor to its entrance
    for (const rec of this.world.plans.values()) {
      if (rec.plan.feature) continue;
      const en = this.world.entrance(rec.plan), [nx, ny] = this.toScreen(en[0], en[2]);
      const b = this.world.constructor.worldBounds(rec.plan);
      const inside = x > b[0] && x < b[2] && z > b[1] && z < b[3];
      if (inside || Math.hypot(px - nx, py - (ny + 18 * devicePixelRatio)) < 28 * devicePixelRatio) { this.onJump(rec); return; }
    }
    // anywhere else on the land (not in the river, not beyond the edge of the world)
    const [X0, Z0, X1, Z1] = WORLD.bounds;
    if (x < X0 + 5 || x > X1 - 5 || z < Z0 + 5 || z > Z1 - 5) return;
    let gx = x;
    if (inRiver(gx, z)) { const r = riverAt(gx, z), half = r.w / 2 + 6; gx = x < r.c ? r.c - half : r.c + half; }
    this.onGo?.(gx, z);
  }
}
