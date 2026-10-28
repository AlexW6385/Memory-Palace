// The small map in the corner: the land round the visitor (north up), the buildings, the visitor's
// arrow and the name of the region. Click it to open the large map; it can be hidden.

import { tr } from './i18n.js';
import { regionAt } from '../world/regions.js';

const RADIUS = 420;                     // metres from the centre to the edge of the small map

export class MiniMap {
  constructor(world, mapView, onOpen) {
    this.world = world;
    this.mapView = mapView;
    this.box = document.getElementById('minimap');
    this.canvas = document.getElementById('minimap-canvas');
    this.label = document.getElementById('minimap-region');
    this.showBtn = document.getElementById('mm-show');
    this.next = 0;
    this.box.addEventListener('click', (e) => { if (!e.target.closest('.mm-btn')) onOpen(); });
    document.getElementById('mm-hide').onclick = (e) => { e.stopPropagation(); this.setHidden(true); };
    this.showBtn.onclick = () => this.setHidden(false);
    try { this.setHidden(localStorage.getItem('mp.minimap') === 'hidden'); } catch { /* storage unavailable */ }
  }

  setHidden(h) {
    this.box.hidden = h; this.showBtn.hidden = !h;
    try { localStorage.setItem('mp.minimap', h ? 'hidden' : 'shown'); } catch { /* storage unavailable */ }
  }

  /** Redraw (at most a few times a second) for the visitor at (x, z) facing yaw. */
  update(x, z, yaw) {
    const now = performance.now();
    if (this.box.hidden || now < this.next) return;
    this.next = now + 200;
    const cv = this.canvas, dpr = devicePixelRatio || 1, W = Math.round(cv.clientWidth * dpr), H = Math.round(cv.clientHeight * dpr);
    if (!W || !H) return;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext('2d'), s = (W / 2) / RADIUS;
    const P = (wx, wz) => [W / 2 + (wx - x) * s, H / 2 + (wz - z) * s];
    g.fillStyle = '#2f281f'; g.fillRect(0, 0, W, H);
    // the relief, once the large map has made it (in idle time after the start)
    const rel = this.mapView._relief;
    if (rel) {
      const [r0, r1, r2, r3] = rel.rect, kx = rel.canvas.width / (r2 - r0), kz = rel.canvas.height / (r3 - r1);
      const sx = (x - RADIUS - r0) * kx, sz = (z - RADIUS * H / W - r1) * kz;
      g.imageSmoothingEnabled = true;
      g.drawImage(rel.canvas, sx, sz, 2 * RADIUS * kx, 2 * RADIUS * (H / W) * kz, 0, 0, W, H);
    }
    // the buildings: their outline, and a mark at each entrance
    for (const rec of this.world.plans.values()) {
      const b = this.world.constructor.worldBounds(rec.plan);
      const [a, c] = P(b[0], b[1]), [d, e] = P(b[2], b[3]);
      if (d < 0 || a > W || e < 0 || c > H) continue;
      if (rec.plan.feature) { g.fillStyle = 'rgba(214, 190, 150, 0.25)'; g.fillRect(a, c, d - a, e - c); continue; }
      g.strokeStyle = 'rgba(243, 234, 217, 0.85)'; g.lineWidth = 1.5 * dpr; g.strokeRect(a, c, d - a, e - c);
      const en = this.world.entrance(rec.plan), [nx, ny] = P(en[0], en[2]);
      g.fillStyle = '#f3ead9'; g.beginPath(); g.arc(nx, ny, 3 * dpr, 0, Math.PI * 2); g.fill();
    }
    // the visitor
    g.save(); g.translate(W / 2, H / 2); g.rotate(-yaw);
    const k = 8 * dpr;
    g.fillStyle = '#ffcf6e'; g.strokeStyle = '#2f281f'; g.lineWidth = 1.5 * dpr;
    g.beginPath(); g.moveTo(0, -k); g.lineTo(k * 0.62, k * 0.72); g.lineTo(0, k * 0.36); g.lineTo(-k * 0.62, k * 0.72); g.closePath(); g.fill(); g.stroke();
    g.restore();
    const name = tr(regionAt(x, z).name);
    if (this.label.textContent !== name) this.label.textContent = name;
  }
}
