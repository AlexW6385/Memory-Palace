// Procedural canvas textures: floors, walls, stage backdrops, signs and plaques.
// Every texture is drawn once per (kind, colours) and cached. Pattern tiles are
// seamless; `tile` says how many metres one repeat covers.
import * as THREE from "three";
import { rng, shade, mix, hashString } from "./props/kit.js";
import { FONTS } from "./look.js";

const cache = new Map();

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function finish(canvas, { repeat = true, srgb = true, aniso = 8 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = aniso;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

function cached(key, make) {
  let v = cache.get(key);
  if (!v) cache.set(key, (v = make()));
  return v;
}

/** Fill a rect at (x, y) and at its wrapped copies so drawings tile seamlessly. */
function wrapped(N, x, y, w, h, draw) {
  for (const dx of [-N, 0, N]) {
    for (const dy of [-N, 0, N]) {
      if (x + dx + w < 0 || x + dx > N || y + dy + h < 0 || y + dy > N) continue;
      draw(x + dx, y + dy);
    }
  }
}

function speckle(ctx, N, r, count, colors, size = [0.6, 1.6], alpha = [0.04, 0.12]) {
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = r.range(alpha[0], alpha[1]);
    ctx.fillStyle = r.pick(colors);
    const s = r.range(size[0], size[1]);
    ctx.fillRect(r() * N, r() * N, s, s);
  }
  ctx.globalAlpha = 1;
}

function tone(c, r, amt) {
  return shade(c, r.range(-amt, amt));
}

// ── floors ───────────────────────────────────────────────────────────────────
const FLOOR = {
  checker: { tile: 1.6, draw(ctx, N, [a, b], r) {
    const q = N / 2;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? b : a;
      ctx.fillRect(i * q, j * q, q, q);
    }
    speckle(ctx, N, r, 2600, [shade(a, -0.2), shade(b, 0.15), "#ffffff"]);
    grout(ctx, N, 2, shade(b, -0.25), 0.55);
  } },
  herringbone: { tile: 1.2, draw(ctx, N, [a, b], r) {
    const u = N / 8;
    ctx.fillStyle = shade(b, -0.18);
    ctx.fillRect(0, 0, N, N);
    const plank = (x, y, w, h) => {
      const c = tone(r() < 0.5 ? a : b, r, 0.05);
      wrapped(N, x, y, w, h, (px, py) => {
        ctx.fillStyle = c;
        ctx.fillRect(px + 1, py + 1, w - 2, h - 2);
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = "#000";
        for (let g = 0; g < 3; g++) {
          if (w > h) ctx.fillRect(px + 2, py + 2 + (h - 4) * r(), w - 4, 1);
          else ctx.fillRect(px + 2 + (w - 4) * r(), py + 2, 1, h - 4);
        }
        ctx.globalAlpha = 1;
      });
    };
    for (let s = -3; s < 4; s++) for (let k = -2; k < 10; k++) {
      plank((k + 4 * s) * u, k * u, 2 * u, u);
      plank((k + 4 * s) * u, (k + 1) * u, u, 2 * u);
    }
  } },
  planks: { tile: 2.4, draw(ctx, N, [a, b], r) { boards(ctx, N, a, b, r, 12, 1.5, false); } },
  dock: { tile: 2.4, draw(ctx, N, [a, b], r) { boards(ctx, N, a, b, r, 10, 4, true); } },
  tiles: { tile: 1.2, draw(ctx, N, [a, b], r) {
    const q = N / 2;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      ctx.fillStyle = tone((i + j) % 2 ? b : a, r, 0.03);
      ctx.fillRect(i * q, j * q, q, q);
    }
    speckle(ctx, N, r, 1800, [shade(a, -0.15), "#ffffff"]);
    grout(ctx, N, 2, mix(a, "#7c776e", 0.6), 1.2);
  } },
  hex: { tile: 1.04, draw(ctx, N, [a, b], r) {
    ctx.fillStyle = shade(b, -0.2);
    ctx.fillRect(0, 0, N, N);
    const R = N / 6, h = Math.sqrt(3) * R;
    const W = N / Math.round(N / (3 * R)), H = N / Math.round(N / h);
    const sx = W / (3 * R);
    for (let col = -1; col <= Math.round(N / (1.5 * R)) + 1; col++) {
      for (let row = -1; row <= Math.round(N / h) + 1; row++) {
        const cx = col * 1.5 * R * sx, cy = row * H + (col % 2 ? H / 2 : 0);
        ctx.fillStyle = tone(r() < 0.25 ? b : a, r, 0.04);
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const t = Math.PI / 3 * k;
          ctx.lineTo(cx + Math.cos(t) * (R * sx - 1.5), cy + Math.sin(t) * (H / 2 - 1.5) * 1.155);
        }
        ctx.fill();
      }
    }
  } },
  terrazzo: { tile: 2.0, draw(ctx, N, [a, b], r) {
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, N, N);
    const chips = [b, shade(a, -0.25), shade(b, 0.2), "#f6f1e6", "#8b8378"];
    for (let i = 0; i < 1400; i++) {
      const x = r() * N, y = r() * N, s = r.range(1.5, 6);
      ctx.fillStyle = r.pick(chips);
      ctx.globalAlpha = r.range(0.55, 1);
      wrapped(N, x - s, y - s, 2 * s, 2 * s, (px, py) => {
        ctx.beginPath();
        ctx.ellipse(px + s, py + s, s, s * r.range(0.5, 1), r() * 3, 0, 7);
        ctx.fill();
      });
    }
    ctx.globalAlpha = 1;
  } },
  marble: { tile: 2.4, draw(ctx, N, [a, b], r) {
    const q = N / 2;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      ctx.fillStyle = tone((i + j) % 2 ? b : a, r, 0.02);
      ctx.fillRect(i * q, j * q, q, q);
    }
    ctx.lineCap = "round";
    for (let v = 0; v < 26; v++) {
      ctx.strokeStyle = shade(b, -0.22);
      ctx.globalAlpha = r.range(0.06, 0.22);
      ctx.lineWidth = r.range(0.6, 2.2);
      let x = r() * N, y = r() * N;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 8; s++) {
        x += r.range(-30, 60);
        y += r.range(-40, 40);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    grout(ctx, N, 2, shade(a, -0.12), 0.7);
  } },
  carpet: { tile: 1.0, draw(ctx, N, [a, b], r) {
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, N, N);
    speckle(ctx, N, r, 9000, [shade(a, -0.12), shade(a, 0.08)], [1, 2], [0.15, 0.3]);
    ctx.strokeStyle = b;
    ctx.lineWidth = N * 0.018;
    ctx.globalAlpha = 0.75;
    const q = N / 2;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const cx = i * q, cy = j * q;
      ctx.beginPath();
      ctx.moveTo(cx, cy - q * 0.42);
      ctx.lineTo(cx + q * 0.42, cy);
      ctx.lineTo(cx, cy + q * 0.42);
      ctx.lineTo(cx - q * 0.42, cy);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.fillStyle = b;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      ctx.beginPath();
      ctx.arc(q / 2 + i * q, q / 2 + j * q, N * 0.03, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } },
  cobble: { tile: 1.6, draw(ctx, N, [a, b], r) {
    ctx.fillStyle = shade(b, -0.25);
    ctx.fillRect(0, 0, N, N);
    const n = 9, s = N / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = (i + 0.5 + r.range(-0.12, 0.12)) * s + (j % 2) * s * 0.5, y = (j + 0.5 + r.range(-0.12, 0.12)) * s;
      const rx = s * r.range(0.38, 0.47), ry = s * r.range(0.36, 0.45);
      const c = tone(r() < 0.5 ? a : b, r, 0.06);
      wrapped(N, x - rx, y - ry, 2 * rx, 2 * ry, (px, py) => {
        const g = ctx.createRadialGradient(px + rx * 0.8, py + ry * 0.7, 1, px + rx, py + ry, rx * 1.1);
        g.addColorStop(0, shade(c, 0.1));
        g.addColorStop(1, shade(c, -0.1));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(px + rx, py + ry, rx, ry, r() * 0.6, 0, 7);
        ctx.fill();
      });
    }
  } },
  sand: { tile: 3.0, draw(ctx, N, [a, b], r) {
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, N, N);
    speckle(ctx, N, r, 16000, [b, shade(a, 0.1), shade(a, -0.15)], [1, 2.2], [0.2, 0.5]);
    ctx.strokeStyle = shade(b, -0.1);
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 2;
    for (let k = 0; k < 9; k++) {
      const y0 = (k / 9) * N;
      ctx.beginPath();
      for (let x = 0; x <= N; x += 8) ctx.lineTo(x, y0 + Math.sin((x / N) * Math.PI * 4 + k) * 6);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } },
  grass: { tile: 2.5, draw(ctx, N, [a, b], r) {
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, N, N);
    for (let i = 0; i < 70; i++) {
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = r() < 0.5 ? b : shade(a, 0.08);
      const x = r() * N, y = r() * N, s = r.range(20, 70);
      wrapped(N, x - s, y - s, 2 * s, 2 * s, (px, py) => {
        ctx.beginPath();
        ctx.arc(px + s, py + s, s, 0, 7);
        ctx.fill();
      });
    }
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 7000; i++) {
      const x = r() * N, y = r() * N, len = r.range(3, 8);
      ctx.globalAlpha = r.range(0.25, 0.6);
      ctx.strokeStyle = r() < 0.5 ? shade(b, -0.08) : shade(a, 0.12);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + r.range(-2, 2), y - len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } },
  slabs: { tile: 2.4, draw(ctx, N, [a, b], r) {
    const rows = 3, h = N / rows;
    for (let j = 0; j < rows; j++) {
      const cols = 2, w = N / cols, off = (j % 2) * w / 2;
      for (let i = -1; i < cols + 1; i++) {
        ctx.fillStyle = tone(r() < 0.5 ? a : b, r, 0.04);
        ctx.fillRect(i * w + off, j * h, w, h);
      }
    }
    speckle(ctx, N, r, 5000, [shade(a, -0.2), shade(a, 0.15)], [1, 2.5]);
    ctx.fillStyle = shade(b, -0.22);
    for (let j = 0; j < rows; j++) {
      ctx.fillRect(0, j * h - 1, N, 2);
      const w = N / 2, off = (j % 2) * w / 2;
      for (let i = 0; i <= 2; i++) ctx.fillRect(i * w + off - 1, j * h, 2, h);
    }
  } },
  metal: { tile: 0.6, draw(ctx, N, [a, b], r) {
    const g = ctx.createLinearGradient(0, 0, N, N);
    g.addColorStop(0, shade(a, 0.05));
    g.addColorStop(1, shade(a, -0.05));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, N, N);
    const n = 6, s = N / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const cx = (i + 0.5) * s, cy = (j + 0.5) * s, rot = (i + j) % 2 ? 0.6 : -0.6;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.fillStyle = shade(b, 0.12);
      ctx.fillRect(-s * 0.32, -s * 0.07, s * 0.64, s * 0.14);
      ctx.fillStyle = shade(b, -0.15);
      ctx.fillRect(-s * 0.32, s * 0.03, s * 0.64, s * 0.04);
      ctx.restore();
    }
  } },
  starfield: { tile: 4.0, draw(ctx, N, [a, b], r) {
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, N, N);
    for (let i = 0; i < 520; i++) {
      ctx.globalAlpha = r.range(0.3, 1);
      ctx.fillStyle = r() < 0.2 ? b : "#ffffff";
      const s = r() < 0.08 ? 2.6 : r.range(0.8, 1.6);
      ctx.beginPath();
      ctx.arc(r() * N, r() * N, s, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = b;
    ctx.lineWidth = 1;
    for (let c = 0; c < 5; c++) {
      let x = r() * N, y = r() * N;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += r.range(-60, 60); y += r.range(-60, 60);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } },
  grid_glow: { tile: 2.0, draw(ctx, N, [a, b], r) {
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, N, N);
    speckle(ctx, N, r, 3000, [shade(a, 0.08)], [1, 2], [0.2, 0.4]);
    ctx.strokeStyle = b;
    for (const [w, al, step] of [[1, 0.35, N / 8], [2.5, 0.9, N / 2]]) {
      ctx.globalAlpha = al;
      ctx.lineWidth = w;
      for (let k = 0; k <= N; k += step) {
        ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k, N); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, k); ctx.lineTo(N, k); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  } },
  concrete: { tile: 4.0, draw(ctx, N, [a, b], r) {
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, N, N);
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = r() < 0.5 ? b : shade(a, 0.1);
      const x = r() * N, y = r() * N, s = r.range(30, 110);
      wrapped(N, x - s, y - s, 2 * s, 2 * s, (px, py) => { ctx.beginPath(); ctx.arc(px + s, py + s, s, 0, 7); ctx.fill(); });
    }
    ctx.globalAlpha = 1;
    speckle(ctx, N, r, 9000, [shade(a, -0.2), shade(a, 0.12)], [0.8, 1.8], [0.15, 0.35]);
    ctx.fillStyle = shade(b, -0.2);
    ctx.fillRect(0, 0, N, 2);
    ctx.fillRect(0, 0, 2, N);
  } },
};

function grout(ctx, N, parts, color, width) {
  ctx.fillStyle = color;
  const q = N / parts;
  for (let i = 0; i <= parts; i++) {
    ctx.fillRect(i * q - width / 2, 0, width, N);
    ctx.fillRect(0, i * q - width / 2, N, width);
  }
}

function boards(ctx, N, a, b, r, rows, gapPx, nails) {
  const h = N / rows;
  ctx.fillStyle = shade(b, nails ? -0.45 : -0.2);
  ctx.fillRect(0, 0, N, N);
  for (let j = 0; j < rows; j++) {
    let x = -r() * N * 0.5;
    while (x < N) {
      const len = N * r.range(0.35, 0.7);
      const c = tone(r() < 0.5 ? a : b, r, 0.06);
      wrapped(N, x, j * h, len, h, (px, py) => {
        ctx.fillStyle = c;
        ctx.fillRect(px + gapPx / 2, py + gapPx / 2, len - gapPx, h - gapPx);
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = shade(c, -0.3);
        for (let g = 0; g < 4; g++) ctx.fillRect(px + 3, py + gapPx + (h - 2 * gapPx) * r(), len - 6, 1);
        ctx.globalAlpha = 1;
        if (nails) {
          ctx.fillStyle = "#5a5148";
          for (const nx of [px + 6, px + len - 8]) {
            ctx.fillRect(nx, py + h * 0.3, 2, 2);
            ctx.fillRect(nx, py + h * 0.65, 2, 2);
          }
        }
      });
      x += len;
    }
  }
}

/** Seamless floor texture → { map, tile, emissive? } */
export function floorTexture(pattern, colors) {
  const p = FLOOR[pattern] ? pattern : "slabs";
  const [a, b0] = colors || ["#cfc8b8", "#bdb5a4"];
  const b = b0 || shade(a, -0.08);
  return cached(`floor|${p}|${a}|${b}`, () => {
    const N = 512;
    const canvas = makeCanvas(N, N);
    const ctx = canvas.getContext("2d");
    FLOOR[p].draw(ctx, N, [a, b], rng(hashString(p + a + b)));
    return { map: finish(canvas), tile: FLOOR[p].tile, glow: p === "grid_glow" || p === "starfield" };
  });
}

export const FLOOR_PATTERNS = Object.keys(FLOOR);

// ── walls ────────────────────────────────────────────────────────────────────
const WALL = {
  brick: { tile: [1.2, 0.9], draw(ctx, W, H, [a, b], r) {
    ctx.fillStyle = mix(b || "#d9cfc0", "#cfc6b8", 0.5);
    ctx.fillRect(0, 0, W, H);
    const rows = 12, bh = H / rows, bw = W / 5;
    for (let j = 0; j < rows; j++) {
      const off = (j % 2) * bw / 2;
      for (let i = -1; i < 6; i++) {
        ctx.fillStyle = tone(a, r, 0.07);
        ctx.fillRect(i * bw + off + 2, j * bh + 2, bw - 4, bh - 4);
      }
    }
    speckle(ctx, W, r, 2500, ["#000000", "#ffffff"], [1, 2], [0.04, 0.1]);
  } },
  stone: { tile: [2.4, 1.6], draw(ctx, W, H, [a, b], r) {
    ctx.fillStyle = shade(a, -0.22);
    ctx.fillRect(0, 0, W, H);
    const rows = 4, bh = H / rows;
    for (let j = 0; j < rows; j++) {
      let x = -r() * W * 0.3;
      while (x < W) {
        const len = W * r.range(0.18, 0.34);
        const c = tone(r() < 0.3 && b ? b : a, r, 0.05);
        wrapped(W, x, j * bh, len, bh, (px, py) => {
          ctx.fillStyle = c;
          ctx.fillRect(px + 3, py + 3, len - 6, bh - 6);
          ctx.fillStyle = shade(c, 0.08);
          ctx.fillRect(px + 3, py + 3, len - 6, 3);
        });
        x += len;
      }
    }
    speckle(ctx, W, r, 4000, [shade(a, -0.3), shade(a, 0.2)], [1, 2.4]);
  } },
  wood_panel: { tile: [1.2, 1.4], draw(ctx, W, H, [a, b], r) {
    const dark = shade(a, -0.12);
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 2; i++) {
      const x = i * W / 2 + W * 0.06, w = W / 2 - W * 0.12, y = H * 0.08, h = H * 0.84;
      ctx.fillStyle = shade(a, 0.04);
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = shade(a, -0.05);
      ctx.fillRect(x + w * 0.1, y + h * 0.08, w * 0.8, h * 0.84);
      ctx.strokeStyle = shade(a, 0.14);
      ctx.lineWidth = 2;
      ctx.strokeRect(x + w * 0.1, y + h * 0.08, w * 0.8, h * 0.84);
    }
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#000";
    for (let g = 0; g < 60; g++) ctx.fillRect(r() * W, 0, 1, H);
    ctx.globalAlpha = 1;
  } },
  plaster: { tile: [3, 3], draw(ctx, W, H, [a], r) {
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 50; i++) {
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = r() < 0.5 ? shade(a, -0.08) : shade(a, 0.06);
      const x = r() * W, y = r() * H, s = r.range(30, 90);
      wrapped(W, x - s, y - s, 2 * s, 2 * s, (px, py) => { ctx.beginPath(); ctx.arc(px + s, py + s, s, 0, 7); ctx.fill(); });
    }
    ctx.globalAlpha = 1;
    speckle(ctx, W, r, 3000, [shade(a, -0.12)], [0.8, 1.5], [0.1, 0.2]);
  } },
  shelves: { tile: [2.4, 2.1], draw(ctx, W, H, [a, b], r) {
    const wood = a, inner = shade(a, -0.32);
    ctx.fillStyle = inner;
    ctx.fillRect(0, 0, W, H);
    const rows = 5, sh = H / rows, board = sh * 0.09, side = W * 0.025;
    const books = ["#8c2f2f", "#2f4f7c", "#3c6b46", "#b8873b", "#6d3f6b", "#c9b48a", "#3d3d3d", "#a4553a", "#2d6b6b",
      "#e0d2b0"];
    for (let j = 0; j < rows; j++) {
      const y0 = j * sh, base = y0 + sh - board;
      let x = side;
      while (x < W / 2 - side) {
        const bw = W * r.range(0.012, 0.026), bh = (sh - board) * r.range(0.62, 0.9);
        if (r() < 0.07) { x += bw * 2; continue; }
        const c = tone(r.pick(books), r, 0.05);
        for (const half of [0, W / 2]) {
          if (x + bw > W / 2 - side) break;
          ctx.fillStyle = c;
          ctx.fillRect(half + x, base - bh, bw - 1, bh);
          ctx.fillStyle = shade(c, 0.25);
          ctx.fillRect(half + x, base - bh * 0.8, bw - 1, 2);
          ctx.fillRect(half + x, base - bh * 0.25, bw - 1, 2);
        }
        x += bw;
      }
      ctx.fillStyle = wood;
      ctx.fillRect(0, base, W, board);
      ctx.fillStyle = shade(wood, 0.12);
      ctx.fillRect(0, base, W, 2);
    }
    ctx.fillStyle = wood;
    for (const x of [0, W / 2 - side, W / 2, W - side]) ctx.fillRect(x, 0, side, H);
  } },
  curtain: { tile: [1.0, 4.2], draw(ctx, W, H, [a], r) {
    const g = ctx.createLinearGradient(0, 0, W, 0);
    for (let k = 0; k <= 4; k++) {
      g.addColorStop(k / 4, shade(a, k % 2 ? -0.1 : 0.06));
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    speckle(ctx, W, r, 2000, [shade(a, -0.15)], [1, 2], [0.1, 0.2]);
  } },
  metal: { tile: [2.4, 2.1], draw(ctx, W, H, [a, b], r) {
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const g = ctx.createLinearGradient(i * W / 2, j * H / 2, (i + 1) * W / 2, (j + 1) * H / 2);
      g.addColorStop(0, shade(a, 0.08));
      g.addColorStop(1, shade(a, -0.06));
      ctx.fillStyle = g;
      ctx.fillRect(i * W / 2 + 3, j * H / 2 + 3, W / 2 - 6, H / 2 - 6);
      ctx.fillStyle = shade(b || a, -0.25);
      for (const [x, y] of [[0.06, 0.06], [0.94, 0.06], [0.06, 0.94], [0.94, 0.94], [0.5, 0.06], [0.5, 0.94]]) {
        ctx.beginPath();
        ctx.arc(i * W / 2 + x * W / 2, j * H / 2 + y * H / 2, 3, 0, 7);
        ctx.fill();
      }
    }
  } },
  hedge: { tile: [1.5, 1.5], draw(ctx, W, H, [a], r) {
    ctx.fillStyle = shade(a, -0.15);
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) {
      const x = r() * W, y = r() * H, s = r.range(4, 9);
      ctx.fillStyle = tone(a, r, 0.12);
      wrapped(W, x - s, y - s, 2 * s, 2 * s, (px, py) => {
        ctx.beginPath();
        ctx.ellipse(px + s, py + s, s, s * 0.55, r() * 3, 0, 7);
        ctx.fill();
      });
    }
  } },
  fieldstone: { tile: [1.6, 1.2], draw(ctx, W, H, [a, b], r) {
    ctx.fillStyle = shade(a, -0.3);
    ctx.fillRect(0, 0, W, H);
    const n = 7, s = W / n;
    for (let j = 0; j < Math.round(H / s); j++) for (let i = 0; i < n; i++) {
      const x = (i + 0.5 + r.range(-0.1, 0.1)) * s + (j % 2) * s / 2, y = (j + 0.5) * s;
      const rx = s * r.range(0.4, 0.5), ry = s * r.range(0.32, 0.44);
      const c = tone(r() < 0.4 && b ? b : a, r, 0.08);
      wrapped(W, x - rx, y - ry, 2 * rx, 2 * ry, (px, py) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.ellipse(px + rx, py + ry, rx, ry, r(), 0, 7);
        ctx.fill();
      });
    }
  } },
};

/** Wall texture → { map, tile: [u metres, v metres] } (null for styles drawn with materials only). */
export function wallTexture(style, color, color2) {
  const map = { low_stone: "fieldstone" };
  const kind = map[style] || style;
  if (!WALL[kind]) return null;
  return cached(`wall|${kind}|${color}|${color2 || ""}`, () => {
    const [tw, th] = WALL[kind].tile;
    const W = 512, H = Math.round(512 * th / tw / 64) * 64 || 512;
    const canvas = makeCanvas(W, Math.min(1024, Math.max(128, H)));
    const ctx = canvas.getContext("2d");
    WALL[kind].draw(ctx, canvas.width, canvas.height, [color, color2], rng(hashString(kind + color)));
    return { map: finish(canvas), tile: WALL[kind].tile };
  });
}

// ── text helpers ─────────────────────────────────────────────────────────────
const pendingFonts = new Map();

/** Draw now; if the font for this text is still loading, redraw once it arrives. */
function withFont(font, text, draw) {
  draw();
  if (typeof document === "undefined" || !document.fonts || !text) return;
  try {
    if (document.fonts.check(font, text)) return;
  } catch { return; }
  const key = font + "|" + text;
  if (pendingFonts.has(key)) {
    pendingFonts.get(key).push(draw);
    return;
  }
  pendingFonts.set(key, [draw]);
  document.fonts.load(font, text).then(() => {
    for (const d of pendingFonts.get(key) || []) d();
    pendingFonts.delete(key);
  }).catch(() => pendingFonts.delete(key));
}

export function wrapText(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split("\n")) {
    const cjk = /[㐀-鿿]/.test(para);
    const tokens = cjk ? Array.from(para) : para.split(/(\s+)/);
    let line = "";
    for (const tok of tokens) {
      const next = line + tok;
      if (line && ctx.measureText(next.trimEnd()).width > maxW) {
        out.push(line.trimEnd());
        line = tok.trimStart();
      } else line = next;
    }
    out.push(line.trimEnd());
  }
  return out;
}

/** Largest font size (≤ max) at which text fits in w×h on at most maxLines lines. */
function fit(ctx, text, family, weight, w, h, max, maxLines = 3, lh = 1.15) {
  let size = max, lines = [text];
  for (let i = 0; i < 30; i++) {
    ctx.font = `${weight} ${size}px ${family}`;
    lines = wrapText(ctx, text, w);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (lines.length <= maxLines && lines.length * size * lh <= h && widest <= w) break;
    size *= 0.9;
  }
  return { size, lines, font: `${weight} ${size}px ${family}` };
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

function luminance(hex) {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

// ── signs ────────────────────────────────────────────────────────────────────
/**
 * A sign board: { title, sub, level: "region"|"wing"|"room", color, aspect } → { tex, canvas, redraw(title, sub) }.
 * Not cached: signs change with the language and are disposed with their mesh.
 */
export function signTexture({ title, sub, level, color, aspect }) {
  const H = level === "region" ? 384 : 256;
  const W = Math.round(Math.min(2048, H * aspect));
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const tex = finish(canvas, { repeat: false });
  const draw = (t, s) => {
    ctx.clearRect(0, 0, W, H);
    const base = color || "#3b4a5a";
    const dark = luminance(base) < 0.55 ? base : shade(base, -0.35);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, shade(dark, 0.06));
    bg.addColorStop(1, shade(dark, -0.08));
    roundRect(ctx, 2, 2, W - 4, H - 4, H * 0.08);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = H * 0.035;
    ctx.strokeStyle = "#d9b25c";
    roundRect(ctx, H * 0.05, H * 0.05, W - H * 0.1, H - H * 0.1, H * 0.06);
    ctx.stroke();
    const pad = H * 0.16;
    const hasSub = !!s;
    const long = hasSub && s.length > 40;          // a wing's summary: two lines under a smaller title
    const titleH = hasSub ? H * (long ? 0.4 : 0.5) : H * 0.62;
    const tf = fit(ctx, t, FONTS.display, "400", W - pad * 2, titleH, titleH * 0.86, hasSub ? 1 : 2);
    ctx.fillStyle = "#fbf3df";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const ty = hasSub ? H * (long ? 0.33 : 0.4) : H / 2;
    ctx.font = tf.font;
    tf.lines.forEach((l, i) => ctx.fillText(l, W / 2, ty + (i - (tf.lines.length - 1) / 2) * tf.size * 1.12));
    if (hasSub) {
      const lines = long ? 2 : 1;
      const sf = fit(ctx, s, FONTS.body, "500", W - pad * 2.2, H * (long ? 0.34 : 0.24), H * (long ? 0.12 : 0.16), lines, 1.25);
      ctx.font = sf.font;
      ctx.fillStyle = "rgba(251,243,223,0.8)";
      const shown = sf.lines.slice(0, lines);
      if (sf.lines.length > lines) {
        const last = shown[lines - 1];
        shown[lines - 1] = (/\s/.test(last) ? last.replace(/\s*\S*$/, "") : last.slice(0, -1)) + "…";
      }
      const y0 = long ? H * 0.64 : H * 0.73;
      shown.forEach((l, i) => ctx.fillText(l, W / 2, y0 + (i - (shown.length - 1) / 2) * sf.size * 1.25));
    }
    tex.needsUpdate = true;
  };
  const redraw = (t, s) => {
    withFont(`400 40px ${FONTS.display}`, t, () => draw(t, s));
    if (s) withFont(`500 20px ${FONTS.body}`, s, () => draw(t, s));
  };
  redraw(title, sub);
  return { tex, canvas, redraw };
}

// ── stage backdrop ───────────────────────────────────────────────────────────
const BACKDROP = {
  plain() {},
  rays(ctx, W, H, ink) {
    ctx.fillStyle = ink;
    const cx = W / 2, cy = H * 0.55;
    for (let k = 0; k < 28; k++) {
      if (k % 2) continue;
      const a0 = (k / 28) * Math.PI * 2, a1 = ((k + 1) / 28) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a0) * W, cy + Math.sin(a0) * W);
      ctx.lineTo(cx + Math.cos(a1) * W, cy + Math.sin(a1) * W);
      ctx.fill();
    }
  },
  dots(ctx, W, H, ink) {
    ctx.fillStyle = ink;
    const s = H / 9;
    for (let y = s / 2; y < H; y += s) for (let x = s / 2 + ((y / s) % 2 ? s / 2 : 0); x < W; x += s) {
      ctx.beginPath();
      ctx.arc(x, y, s * 0.13, 0, 7);
      ctx.fill();
    }
  },
  grid(ctx, W, H, ink) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    const s = H / 8;
    for (let x = 0; x < W; x += s) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += s) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  },
  waves(ctx, W, H, ink) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 5;
    for (let y = H / 10; y < H; y += H / 7) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 6) ctx.lineTo(x, y + Math.sin(x / W * Math.PI * 10) * H * 0.025);
      ctx.stroke();
    }
  },
  stars(ctx, W, H, ink, r) {
    ctx.fillStyle = ink;
    for (let i = 0; i < 60; i++) star(ctx, r() * W, r() * H, r.range(5, 14));
  },
  stripes(ctx, W, H, ink) {
    ctx.fillStyle = ink;
    const s = W / 24;
    for (let x = 0; x < W + H; x += s * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x + s, 0); ctx.lineTo(x + s - H, H); ctx.lineTo(x - H, H);
      ctx.fill();
    }
  },
  rings(ctx, W, H, ink) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 6;
    for (let rad = H * 0.12; rad < W * 0.7; rad += H * 0.11) {
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.55, rad, 0, 7);
      ctx.stroke();
    }
  },
  checks(ctx, W, H, ink) {
    ctx.fillStyle = ink;
    const s = H / 6;
    for (let y = 0; y < H; y += s) for (let x = 0; x < W; x += s) if (((x + y) / s) % 2 < 1) ctx.fillRect(x, y, s, s);
  },
  leaves(ctx, W, H, ink, r) {
    ctx.fillStyle = ink;
    for (let i = 0; i < 70; i++) {
      ctx.save();
      ctx.translate(r() * W, r() * H);
      ctx.rotate(r() * 6.3);
      ctx.beginPath();
      ctx.ellipse(0, 0, H * 0.05, H * 0.022, 0, 0, 7);
      ctx.fill();
      ctx.restore();
    }
  },
};

function star(ctx, x, y, s) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const rr = k % 2 ? s * 0.45 : s, t = (k / 10) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr);
  }
  ctx.fill();
}

/**
 * The curved panel behind a stage: pattern plus the glyph (a key formula or term).
 * { glyph, pattern, bg, ink } → { tex, redraw(glyph) }. Width:height is about 2.2:1 on the panel.
 */
export function backdropTexture({ glyph, pattern, bg, ink, seed = 1 }) {
  const W = 1024, H = 448;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const tex = finish(canvas, { repeat: false });
  const draw = (g) => {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, shade(bg, 0.05));
    grad.addColorStop(1, shade(bg, -0.07));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.16;
    (BACKDROP[pattern] || BACKDROP.plain)(ctx, W, H, ink, rng(seed));
    ctx.globalAlpha = 1;
    // soft vignette so the glyph reads
    const v = ctx.createRadialGradient(W / 2, H * 0.42, H * 0.1, W / 2, H * 0.42, W * 0.55);
    v.addColorStop(0, "rgba(255,255,255,0.18)");
    v.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    if (g) {
      const f = fit(ctx, g, FONTS.display, "400", W * 0.62, H * 0.42, H * 0.32, 2);
      ctx.font = f.font;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = shade(ink, -0.05);
      ctx.globalAlpha = 0.92;
      f.lines.forEach((l, i) => ctx.fillText(l, W / 2, H * 0.36 + (i - (f.lines.length - 1) / 2) * f.size * 1.1));
      ctx.globalAlpha = 1;
    }
    tex.needsUpdate = true;
  };
  const redraw = (g) => withFont(`400 40px ${FONTS.display}`, g, () => draw(g));
  redraw(glyph);
  return { tex, redraw };
}

// ── labels on stages ─────────────────────────────────────────────────────────
/** Title plate above a backdrop: locus number disc + title. */
export function titleTexture({ locus, title, gold, accent }) {
  const W = 1024, H = 176;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const tex = finish(canvas, { repeat: false });
  const draw = (t) => {
    ctx.clearRect(0, 0, W, H);
    roundRect(ctx, 3, 3, W - 6, H - 6, H * 0.18);
    ctx.fillStyle = "rgba(24, 26, 32, 0.86)";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = gold ? "#e2b552" : "rgba(255,255,255,0.25)";
    ctx.stroke();
    const r = H * 0.34, cx = H * 0.55, cy = H / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 7);
    ctx.fillStyle = gold ? "#d9a73e" : accent || "#5a6b80";
    ctx.fill();
    ctx.fillStyle = gold ? "#2b1d05" : "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${r * (locus >= 100 ? 0.82 : 1.05)}px ${FONTS.body}`;
    ctx.fillText(String(locus), cx, cy + 2);
    const x0 = cx + r + H * 0.2;
    const f = fit(ctx, t, FONTS.display, "400", W - x0 - H * 0.2, H * 0.78, H * 0.42, 2, 1.08);
    ctx.font = f.font;
    ctx.textAlign = "left";
    ctx.fillStyle = "#f7f1e3";
    f.lines.forEach((l, i) => ctx.fillText(l, x0, cy + (i - (f.lines.length - 1) / 2) * f.size * 1.08 + 2));
    tex.needsUpdate = true;
  };
  const redraw = (t) => withFont(`400 40px ${FONTS.display}`, t, () => draw(t));
  redraw(title);
  return { tex, redraw };
}

/** Small brass number plate on the front of a stage; gold every 5th locus, a star every 10th. */
export function plaqueTexture(locus, gold, special) {
  return cached(`plaque|${locus}|${gold}|${special}`, () => {
    const W = 256, H = 128;
    const canvas = makeCanvas(W, H);
    const ctx = canvas.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, H);
    if (gold) { g.addColorStop(0, "#f3d27a"); g.addColorStop(1, "#b9852c"); }
    else { g.addColorStop(0, "#d9d4c8"); g.addColorStop(1, "#9c968a"); }
    roundRect(ctx, 2, 2, W - 4, H - 4, 18);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = gold ? "#8a5e17" : "#6f6a60";
    ctx.stroke();
    ctx.fillStyle = gold ? "#3b2604" : "#2e2c28";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${H * 0.62}px ${FONTS.body}`;
    const label = String(locus);
    ctx.fillText(label, W / 2 + (special ? 18 : 0), H / 2 + 4);
    if (special) {
      ctx.fillStyle = "#7a4d0c";
      star(ctx, W / 2 - ctx.measureText(label).width / 2 - 10, H / 2, 20);
    }
    return finish(canvas, { repeat: false });
  });
}

/** Radial glow sprite for lamps and halos. */
export function glowTexture() {
  return cached("glow", () => {
    const N = 128;
    const canvas = makeCanvas(N, N);
    const ctx = canvas.getContext("2d");
    const g = ctx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, N, N);
    return finish(canvas, { repeat: false, srgb: false });
  });
}

/** Soft cloud puff for the sky. */
export function cloudTexture(seed = 1) {
  return cached("cloud|" + seed, () => {
    const W = 512, H = 256;
    const canvas = makeCanvas(W, H);
    const ctx = canvas.getContext("2d");
    const r = rng(seed * 97 + 13);
    for (let i = 0; i < 22; i++) {
      const x = W * r.range(0.18, 0.82), y = H * r.range(0.4, 0.7), rad = H * r.range(0.14, 0.32);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, "rgba(255,255,255,0.85)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, 7);
      ctx.fill();
    }
    return finish(canvas, { repeat: false });
  });
}
