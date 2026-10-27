// The map: districts, the river, every building's footprint and the visitor. Click a
// building (or its name in the list) to go to its entrance. Drag to pan, wheel or pinch to zoom.

import { tr, t } from './i18n.js';
import { WORLD } from '../engine/world.js';
import { LANDFORMS } from '../world/layout.js';

export class MapView {
  constructor(world, onJump) {
    this.world = world;
    this.onJump = onJump;
    this.canvas = document.getElementById('map-canvas');
    this.list = document.getElementById('map-list');
    this.view = null;
    this._bind();
  }

  open(player) {
    this.player = player;
    this.renderList();
    requestAnimationFrame(() => { this.fit(); this.draw(); });
  }

  renderList() {
    this.list.innerHTML = '';
    for (const rec of this.world.plans.values()) {
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
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const rec of this.world.plans.values()) {
      const b = this.world.constructor.worldBounds(rec.plan);
      x0 = Math.min(x0, b[0]); z0 = Math.min(z0, b[1]); x1 = Math.max(x1, b[2]); z1 = Math.max(z1, b[3]);
    }
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
    // river
    const R = WORLD.river;
    const [ra] = this.toScreen(R.x0, 0), [rb] = this.toScreen(R.x1, 0);
    g.fillStyle = '#28434a';
    g.fillRect(ra, 0, rb - ra, cv.height);
    // hills: their tops and the foot of their slopes
    for (const L of LANDFORMS) {
      const [a, b] = this.toScreen(L.center[0] - L.half[0], L.center[1] - L.half[1]), [c, d] = this.toScreen(L.center[0] + L.half[0], L.center[1] + L.half[1]);
      g.fillStyle = 'rgba(160, 150, 130, 0.35)';
      g.beginPath(); g.roundRect?.(a, b, c - a, d - b, L.round * v.s); g.fill();
    }
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

  _bind() {
    const cv = this.canvas;
    let drag = null, moved = 0;
    const pts = new Map();
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); drag = [e.clientX, e.clientY]; moved = 0; });
    cv.addEventListener('pointermove', (e) => {
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
    cv.addEventListener('wheel', (e) => { e.preventDefault(); if (!this.view) return; this.view.s *= Math.exp(-e.deltaY * 0.0015); this.draw(); }, { passive: false });
  }

  click(e) {
    const r = this.canvas.getBoundingClientRect();
    const [x, z] = this.toWorld((e.clientX - r.left) * devicePixelRatio, (e.clientY - r.top) * devicePixelRatio);
    const here = this.world.locate(x, 0, z);
    if (here.building && here.distance < 30) this.onJump(here.building);
  }
}
