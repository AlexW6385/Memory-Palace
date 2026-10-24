// Top-down map of the whole palace, drawn on a 2D canvas from world.json prims.
import { tr } from "./i18n.js";

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function rectCorners(cx, cz, w, d, r) {
  const c = Math.cos(r || 0), s = Math.sin(r || 0);
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, z]) => [cx + x * c + z * s, cz - x * s + z * c]);
}

export class MapView {
  constructor(canvas, world, hooks) {
    this.canvas = canvas;
    this.world = world;
    this.h = hooks;
    this.k = 1;          // pixels per metre
    this.cx = 0;
    this.cz = 0;
    this.shapes = this.collect();
    this.pointers = new Map();
    this.bind();
  }

  collect() {
    const floors = [], paths = [], walls = [], waters = [], discs = [], rings = [];
    for (const p of this.world.prims) {
      switch (p.t) {
        case "floor": floors.push({ pts: rectCorners(p.p[0], p.p[2], p.w, p.d, p.r), c: p.cols[0], y: p.p[1] }); break;
        case "ramp": floors.push({ pts: rectCorners(p.p[0], p.p[1], p.w, p.d, p.r), c: p.cols[0], y: p.y1 }); break;
        case "path": paths.push({ pts: rectCorners(p.p[0], p.p[2], p.w, p.d, p.r), c: p.c }); break;
        case "disc": discs.push({ x: p.p[0], z: p.p[2], r0: p.r0, r1: p.r1, c: p.cols[0], y: p.p[1] }); break;
        case "helix": rings.push({ x: p.c[0], z: p.c[1], r0: p.r0, r1: p.r1, segs: p.segs, a0: p.a0, sweep: p.sweep }); break;
        case "wall": if (p.st !== "none") walls.push({ pts: rectCorners(p.p[0], p.p[2], Math.max(p.s[0], 0.4), p.s[2], p.r), c: p.c }); break;
        case "water": waters.push({ pts: rectCorners(p.p[0], p.p[2], p.w, p.d, p.r), c: p.c }); break;
        default: break;
      }
    }
    floors.sort((a, b) => a.y - b.y);
    return { floors, paths, walls, waters, discs, rings };
  }

  bind() {
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => {
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
    });
    c.addEventListener("pointermove", (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const before = Math.hypot(a.x - b.x, a.y - b.y);
        p.x = e.clientX; p.y = e.clientY;
        const after = Math.hypot(a.x - b.x, a.y - b.y);
        if (before > 0) this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, after / before);
        return;
      }
      this.cx -= (e.clientX - p.x) / this.k;
      this.cz -= (e.clientY - p.y) / this.k;
      p.x = e.clientX; p.y = e.clientY;
      this.draw();
    });
    const end = (e) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (!p || e.type !== "pointerup") return;
      if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 6 && performance.now() - p.t < 500) this.click(e.clientX, e.clientY);
    };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.zoomAt(e.clientX, e.clientY, Math.pow(1.0015, -e.deltaY));
    }, { passive: false });
    addEventListener("resize", () => { if (!this.canvas.closest("[hidden]")) this.draw(); });
    document.getElementById("map-in").addEventListener("click", () => this.zoomCenter(1.5));
    document.getElementById("map-out").addEventListener("click", () => this.zoomCenter(1 / 1.5));
    document.getElementById("map-here").addEventListener("click", () => {
      const pl = this.h.player();
      this.cx = pl.x; this.cz = pl.z;
      this.k = Math.max(this.k, 2.2);
      this.draw();
    });
  }

  zoomCenter(f) {
    const r = this.canvas.getBoundingClientRect();
    this.zoomAt(r.left + r.width / 2, r.top + r.height / 2, f);
  }

  zoomAt(clientX, clientY, f) {
    const r = this.canvas.getBoundingClientRect();
    const sx = clientX - r.left - r.width / 2, sy = clientY - r.top - r.height / 2;
    const wx = this.cx + sx / this.k, wz = this.cz + sy / this.k;
    this.k = Math.min(14, Math.max(0.35, this.k * f));
    this.cx = wx - sx / this.k;
    this.cz = wz - sy / this.k;
    this.draw();
  }

  open() {
    const r = this.canvas.getBoundingClientRect();
    const pl = this.h.player();
    const inPlot = this.world.plots.some((p) => Math.abs(pl.x - p.center[0]) < p.half && Math.abs(pl.z - p.center[1]) < p.half);
    if (inPlot) {
      this.cx = pl.x; this.cz = pl.z;
      this.k = Math.min(r.width, r.height) / 150;
    } else {
      this.cx = 0; this.cz = 0;
      this.k = Math.min(r.width, r.height) / (this.world.cell * 3.1);
    }
    this.draw();
  }

  click(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const wx = this.cx + (clientX - r.left - r.width / 2) / this.k;
    const wz = this.cz + (clientY - r.top - r.height / 2) / this.k;
    // a click near a room's loci goes to that room's entrance; anywhere else, to that spot
    let best = null, bestD = Math.max(3, 14 / this.k);
    for (const b of this.world.buildings) for (const w of b.wings) for (const r of w.rooms) for (const id of r.loci) {
      const l = this.world.loci[id];
      const d = Math.hypot(l.pos[0] - wx, l.pos[2] - wz);
      if (d < bestD) { bestD = d; best = r; }
    }
    if (best) this.h.goRoom(best);
    else this.h.goPoint(wx, wz);
  }

  draw() {
    const c = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = c.clientWidth, H = c.clientHeight;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const k = this.k, ox = W / 2 - this.cx * k, oz = H / 2 - this.cz * k;
    const X = (x) => x * k + ox, Z = (z) => z * k + oz;
    const poly = (pts) => {
      ctx.beginPath();
      pts.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z))));
      ctx.closePath();
    };
    const night = document.documentElement.dataset.night === "1";
    ctx.fillStyle = cssVar("--map-ground", night ? "#2c3a2c" : "#a9bf93");
    ctx.fillRect(0, 0, W, H);
    // plots
    for (const p of this.world.plots) {
      const sys = p.building && this.world.buildings.find((s) => s.id === p.building);
      ctx.fillStyle = sys ? (night ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.22)") : "rgba(0,0,0,0.04)";
      ctx.fillRect(X(p.center[0] - p.half), Z(p.center[1] - p.half), p.half * 2 * k, p.half * 2 * k);
      if (sys) {
        ctx.strokeStyle = sys.color;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 2;
        ctx.strokeRect(X(p.center[0] - p.half), Z(p.center[1] - p.half), p.half * 2 * k, p.half * 2 * k);
        ctx.globalAlpha = 1;
      }
    }
    const S = this.shapes;
    for (const p of S.paths) { ctx.fillStyle = p.c; poly(p.pts); ctx.fill(); }
    for (const d of S.discs) {
      ctx.fillStyle = d.c;
      ctx.beginPath();
      ctx.arc(X(d.x), Z(d.z), d.r1 * k, 0, Math.PI * 2);
      if (d.r0 > 0) ctx.arc(X(d.x), Z(d.z), d.r0 * k, 0, Math.PI * 2, true);
      ctx.fill("evenodd");
    }
    for (const r of S.rings) {
      for (const s of r.segs) {
        ctx.fillStyle = s.cols[0];
        ctx.beginPath();
        const a0 = s.a0, a1 = Math.min(s.a1, r.a0 + Math.PI * 2 + 0.01 + (s.a0 - r.a0));
        const steps = Math.max(2, Math.ceil((a1 - a0) / 0.05));
        for (let i = 0; i <= steps; i++) {
          const a = a0 + (a1 - a0) * i / steps;
          ctx.lineTo(X(r.x + Math.sin(a) * r.r1), Z(r.z - Math.cos(a) * r.r1));
        }
        for (let i = steps; i >= 0; i--) {
          const a = a0 + (a1 - a0) * i / steps;
          ctx.lineTo(X(r.x + Math.sin(a) * r.r0), Z(r.z - Math.cos(a) * r.r0));
        }
        ctx.closePath();
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    for (const f of S.floors) { ctx.fillStyle = f.c; poly(f.pts); ctx.fill(); }
    for (const w of S.waters) { ctx.fillStyle = w.c; poly(w.pts); ctx.fill(); }
    ctx.fillStyle = night ? "rgba(230,220,200,0.55)" : "rgba(40,36,30,0.55)";
    for (const w of S.walls) { poly(w.pts); ctx.fill(); }
    // loci
    const colorOf = Object.fromEntries(this.world.buildings.map((b) => [b.id, b.color]));
    const rad = Math.max(1.8, 1.35 * k);
    for (const l of Object.values(this.world.loci)) {
      const x = X(l.pos[0]), z = Z(l.pos[2]);
      if (x < -20 || z < -20 || x > W + 20 || z > H + 20) continue;
      ctx.beginPath();
      ctx.arc(x, z, rad, 0, Math.PI * 2);
      ctx.fillStyle = colorOf[l.building];
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.stroke();
    }
    // labels
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const placed = [];
    const label = (text, x, z, size, weight = 600, fg = night ? "#f4efe4" : "#1d2430") => {
      ctx.font = `${weight} ${size}px "IBM Plex Sans", "Noto Sans SC", system-ui, sans-serif`;
      // skip labels that would overlap one already drawn (stacked floors of the spiral, dense districts)
      const w = ctx.measureText(text).width + 6, h = size + 4;
      const box = [x - w / 2, z - h / 2, x + w / 2, z + h / 2];
      if (placed.some((q) => box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1])) return;
      placed.push(box);
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = night ? "rgba(10,14,20,0.8)" : "rgba(255,255,255,0.85)";
      ctx.strokeText(text, x, z);
      ctx.fillStyle = fg;
      ctx.fillText(text, x, z);
    };
    for (const s of this.world.buildings) {
      const p = this.world.plots[s.plot];
      if (k < 3.2) label(tr(s.title), X(p.center[0]), Z(p.center[1]) - Math.min(40, p.half * k * 0.6), k < 1 ? 13 : 16, 700);
      if (k >= 1.6) for (const w of s.wings) {
        if (k < 4) label(tr(w.title), X(w.anchor[0]), Z(w.anchor[2]) - 10, 12, 600, s.color);
        else for (const r of w.rooms) label(tr(r.title), X(r.anchor[0]), Z(r.anchor[2]), 12, 600);
      }
    }
    // the visitor
    const pl = this.h.player();
    const px = X(pl.x), pz = Z(pl.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-pl.yaw);
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(7, 7);
    ctx.lineTo(0, 3);
    ctx.lineTo(-7, 7);
    ctx.closePath();
    ctx.fillStyle = "#e0463a";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
