// Canvas textures for the Egyptian temple: sandstone ashlar carved with sunk relief and
// hieroglyphs, a star-painted ceiling, ribbed cornices, and scenes drawn as decals
// (the king smiting enemies on the pylon, Horus spearing Seth, a stela).
// Everything is drawn once and cached; tile sizes are in metres.
import * as THREE from "three";
import { rng, shade, mix, hashString } from "../props/kit.js";

const cache = new Map();

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function finish(canvas, { repeat = true, srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

function cached(key, make) {
  let v = cache.get(key);
  if (!v) cache.set(key, (v = make()));
  return v;
}

// ── carving: sunk relief is a dark edge on the lit side and a bright one opposite ──
function carve(ctx, draw, { depth = 1.5, dark = "rgba(60,38,18,0.4)", light = "rgba(255,246,226,0.34)", fill = null, width = 1.3 } = {}) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    draw(ctx);
    ctx.fill();
  }
  ctx.lineWidth = width;
  ctx.translate(depth * 0.5, depth * 0.6);
  ctx.strokeStyle = light;
  ctx.beginPath();
  draw(ctx);
  ctx.stroke();
  ctx.translate(-depth, -depth * 1.2);
  ctx.strokeStyle = dark;
  ctx.beginPath();
  draw(ctx);
  ctx.stroke();
  ctx.restore();
}

// ── figures in the Egyptian canon: profile head and legs, frontal shoulders ──────
/** A tapered limb from (x0, y0) to (x1, y1), w0 wide at the start and w1 at the end (closed subpath). */
function limb(c, X, Y, x0, y0, x1, y1, w0, w1) {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l, ny = dx / l;
  c.moveTo(X(x0 + nx * w0 / 2), Y(y0 + ny * w0 / 2));
  c.lineTo(X(x1 + nx * w1 / 2), Y(y1 + ny * w1 / 2));
  c.lineTo(X(x1 - nx * w1 / 2), Y(y1 - ny * w1 / 2));
  c.lineTo(X(x0 - nx * w0 / 2), Y(y0 - ny * w0 / 2));
  c.closePath();
}

function blob(c, X, Y, x, y, rx, ry, u) {
  c.moveTo(X(x + rx), Y(y));
  c.ellipse(X(x), Y(y), Math.abs(rx * u), ry * u, 0, 0, Math.PI * 2);
}

/**
 * Path of a figure in the Egyptian canon, h tall, feet on (x, y), facing right (dir 1) or left (−1).
 * Built from closed shapes, so carved it reads as a sunk-relief silhouette with its overlaps drawn in.
 * kind: "king" | "god" | "falcon" | "offer" | "smite" | "priest" | "seated" | "enemy"
 */
function figure(ctx, x, y, h, dir, kind) {
  const u = h / 19;
  const X = (v) => x + v * u * dir;
  const Y = (v) => y - v * u;
  const c = ctx;
  const seated = kind === "seated";
  const hip = seated ? 6.6 : 9;
  const sh = kind === "enemy" ? 12.5 : hip + 6.6;
  // legs and feet
  if (seated) {
    c.moveTo(X(-3.8), Y(0)); c.lineTo(X(-3.8), Y(6.2)); c.lineTo(X(1.2), Y(6.2)); c.lineTo(X(1.2), Y(5.6)); c.lineTo(X(-3.2), Y(5.6)); c.lineTo(X(-3.2), Y(0)); c.closePath(); // throne
    limb(c, X, Y, -1.6, 6.9, 2.4, 6.9, 1.6, 1.4);
    limb(c, X, Y, 2.4, 6.6, 2.3, 0.6, 1.2, 0.8);
    c.moveTo(X(1.6), Y(0)); c.lineTo(X(4.2), Y(0)); c.lineTo(X(3.6), Y(0.7)); c.lineTo(X(1.8), Y(0.8)); c.closePath();
  } else if (kind === "enemy") {
    limb(c, X, Y, 0.2, 7.5, -0.8, 3.6, 1.3, 1.0); limb(c, X, Y, -0.8, 3.6, 0.6, 0.5, 1.0, 0.7);
    limb(c, X, Y, 1.4, 7.5, 2.8, 3.6, 1.3, 1.0); limb(c, X, Y, 2.8, 3.6, 2.6, 0.5, 1.0, 0.7);
  } else {
    const stride = kind === "smite" ? 4.4 : kind === "offer" || kind === "priest" ? 3.4 : 3.0;
    limb(c, X, Y, -0.5, hip, -1.0, 0.7, 1.7, 0.75);
    limb(c, X, Y, 0.7, hip, stride - 0.9, 0.7, 1.7, 0.75);
    for (const fx of [-1.0, stride - 0.9]) {
      c.moveTo(X(fx - 0.9), Y(0)); c.lineTo(X(fx + 2.0), Y(0)); c.lineTo(X(fx + 1.4), Y(0.75)); c.lineTo(X(fx - 0.6), Y(0.9)); c.closePath();
    }
  }
  // kilt
  if (kind !== "enemy") {
    c.moveTo(X(-1.5), Y(hip + 1.6)); c.lineTo(X(1.5), Y(hip + 1.6));
    c.lineTo(X(seated ? 3.0 : 3.1), Y(hip - (seated ? 0.8 : 2.4))); c.lineTo(X(-1.9), Y(hip - (seated ? 0.8 : 2.2))); c.closePath();
    if (!seated) { c.moveTo(X(0.9), Y(hip + 1.4)); c.lineTo(X(2.9), Y(hip - 2.3)); }    // the pleated apron's edge
  }
  // torso: frontal shoulders, narrow waist, a curve of chest on the front side
  const wy = kind === "enemy" ? 7.5 : hip + 1.6;
  c.moveTo(X(-1.2), Y(wy));
  c.quadraticCurveTo(X(-1.7), Y(sh - 2.5), X(-2.6), Y(sh));
  c.lineTo(X(2.4), Y(sh));
  c.quadraticCurveTo(X(2.3), Y(sh - 1.6), X(1.6), Y(sh - 2.6));
  c.quadraticCurveTo(X(1.2), Y(wy + 1.2), X(1.3), Y(wy));
  c.closePath();
  // neck and head
  limb(c, X, Y, 0.3, sh - 0.2, 0.5, sh + 1.0, 1.2, 1.1);
  const hy = sh + 2.0;
  if (kind === "falcon") {
    c.moveTo(X(-1.2), Y(hy - 1)); c.quadraticCurveTo(X(-1.4), Y(hy + 1.8), X(0.6), Y(hy + 1.7));
    c.quadraticCurveTo(X(2.0), Y(hy + 1.5), X(2.3), Y(hy + 0.2)); c.quadraticCurveTo(X(2.5), Y(hy - 0.6), X(1.9), Y(hy - 0.5));
    c.lineTo(X(1.2), Y(hy - 0.2)); c.lineTo(X(0.9), Y(hy - 1.3)); c.closePath();
    // the double crown
    c.moveTo(X(-0.8), Y(hy + 1.6)); c.lineTo(X(-0.8), Y(hy + 3.4)); c.lineTo(X(-0.2), Y(hy + 3.4)); c.lineTo(X(-0.2), Y(hy + 2.4));
    c.lineTo(X(1.6), Y(hy + 2.4)); c.lineTo(X(1.6), Y(hy + 1.6)); c.closePath();
    c.moveTo(X(0.0), Y(hy + 2.4)); c.quadraticCurveTo(X(0.2), Y(hy + 5.2), X(0.9), Y(hy + 5.4)); c.quadraticCurveTo(X(1.4), Y(hy + 4.2), X(1.3), Y(hy + 2.4));
  } else {
    // face in profile: brow, nose, lips, chin
    c.moveTo(X(-1.0), Y(hy + 1.2));
    c.quadraticCurveTo(X(0.4), Y(hy + 2.0), X(1.4), Y(hy + 1.0));
    c.lineTo(X(1.55), Y(hy + 0.3)); c.lineTo(X(1.95), Y(hy - 0.25)); c.lineTo(X(1.55), Y(hy - 0.4));
    c.lineTo(X(1.6), Y(hy - 0.8)); c.quadraticCurveTo(X(1.3), Y(hy - 1.45), X(0.6), Y(hy - 1.4));
    c.lineTo(X(-0.6), Y(hy - 0.9)); c.closePath();
    c.moveTo(X(0.95), Y(hy + 0.3)); c.lineTo(X(1.35), Y(hy + 0.35));   // the eye
    if (kind === "king" || kind === "smite" || kind === "offer") {
      // the nemes headcloth, or the blue crown for the smiting king
      if (kind === "smite") {
        c.moveTo(X(-1.2), Y(hy + 0.4)); c.quadraticCurveTo(X(-1.6), Y(hy + 3.6), X(0.4), Y(hy + 3.8));
        c.quadraticCurveTo(X(1.6), Y(hy + 3.4), X(1.3), Y(hy + 1.2)); c.closePath();
      } else {
        c.moveTo(X(-1.3), Y(hy - 2.2)); c.lineTo(X(-1.4), Y(hy + 1.1)); c.quadraticCurveTo(X(0.0), Y(hy + 2.3), X(1.4), Y(hy + 1.2));
        c.lineTo(X(0.2), Y(hy + 0.6)); c.lineTo(X(-0.2), Y(hy - 2.4)); c.closePath();
      }
      c.moveTo(X(1.3), Y(hy - 1.3)); c.lineTo(X(1.45), Y(hy - 2.5)); c.lineTo(X(1.15), Y(hy - 2.5)); c.lineTo(X(1.0), Y(hy - 1.4)); // beard
    } else if (kind === "enemy") {
      c.moveTo(X(-0.8), Y(hy + 1.1)); c.quadraticCurveTo(X(-2.0), Y(hy), X(-1.4), Y(hy - 1.8)); c.lineTo(X(-0.7), Y(hy - 0.6));
    } else {
      // a long tripartite wig
      c.moveTo(X(-1.4), Y(hy - 3.0)); c.lineTo(X(-1.5), Y(hy + 1.0)); c.quadraticCurveTo(X(0.1), Y(hy + 2.3), X(1.3), Y(hy + 1.2));
      c.lineTo(X(0.4), Y(hy + 0.5)); c.lineTo(X(0.1), Y(hy - 3.0)); c.closePath();
      if (kind === "god") {
        c.moveTo(X(-0.4), Y(hy + 1.9)); c.lineTo(X(-0.1), Y(hy + 4.6)); c.lineTo(X(0.5), Y(hy + 4.6)); c.lineTo(X(0.8), Y(hy + 1.9));
        blob(c, X, Y, 0.2, hy + 5.6, 1.0, 1.0, u);
      }
    }
  }
  // arms
  const S = sh - 0.6;
  if (kind === "smite") {
    limb(c, X, Y, -2.0, S, -4.2, S + 2.4, 1.2, 1.0); limb(c, X, Y, -4.2, S + 2.4, -3.0, S + 4.8, 1.0, 0.8);
    blob(c, X, Y, -3.0, S + 4.9, 0.6, 0.6, u);
    limb(c, X, Y, -3.0, S + 5.2, -1.4, S + 7.0, 0.35, 0.35); blob(c, X, Y, -1.2, S + 7.3, 1.0, 0.9, u);   // the mace
    limb(c, X, Y, 1.8, S, 4.3, S - 1.4, 1.2, 0.9); limb(c, X, Y, 4.3, S - 1.4, 6.2, S - 0.8, 0.9, 0.7);
  } else if (kind === "offer") {
    limb(c, X, Y, 1.8, S, 3.8, S - 2.2, 1.2, 0.95); limb(c, X, Y, 3.8, S - 2.2, 5.6, S - 1.0, 0.95, 0.75);
    limb(c, X, Y, -1.8, S, 1.4, S - 3.0, 1.2, 0.95); limb(c, X, Y, 1.4, S - 3.0, 5.0, S - 2.2, 0.95, 0.75);
    c.moveTo(X(4.6), Y(S - 0.4)); c.quadraticCurveTo(X(5.6), Y(S - 1.8), X(6.6), Y(S - 0.4)); c.closePath();   // a bowl
    blob(c, X, Y, 5.6, S + 0.2, 0.7, 0.5, u);
  } else if (kind === "god" || kind === "falcon") {
    limb(c, X, Y, 1.8, S, 3.0, S - 3.0, 1.2, 0.95); limb(c, X, Y, 3.0, S - 3.0, 4.2, S - 3.4, 0.95, 0.75);
    c.moveTo(X(4.15), Y(0)); c.lineTo(X(4.4), Y(0)); c.lineTo(X(4.4), Y(sh + 3.2)); c.lineTo(X(5.2), Y(sh + 3.7)); c.lineTo(X(4.15), Y(sh + 3.6)); c.closePath();
    limb(c, X, Y, -2.0, S, -2.3, hip + 0.6, 1.2, 0.85);
    limb(c, X, Y, -2.3, hip + 0.4, -2.3, hip - 2.0, 0.3, 0.3);
    c.moveTo(X(-2.3 + 0.6), Y(hip - 2.6)); c.ellipse(X(-2.3), Y(hip - 2.6), 0.6 * u, 0.75 * u, 0, 0, Math.PI * 2);   // the ankh
    limb(c, X, Y, -3.1, hip - 2.0, -1.5, hip - 2.0, 0.3, 0.3);
  } else if (kind === "seated") {
    limb(c, X, Y, 1.8, S, 2.6, hip + 1.2, 1.2, 0.95); limb(c, X, Y, 2.6, hip + 1.2, 4.4, hip + 0.9, 0.95, 0.75);
    limb(c, X, Y, -1.8, S, -1.4, hip + 1.6, 1.2, 0.95); limb(c, X, Y, -1.4, hip + 1.6, 2.6, hip + 1.2, 0.95, 0.75);
  } else if (kind === "enemy") {
    limb(c, X, Y, 1.6, S, 3.4, S + 2.4, 1.0, 0.8);
    limb(c, X, Y, -1.8, S, -3.0, S - 3.0, 1.0, 0.8);
  } else {
    limb(c, X, Y, 1.8, S, 2.3, hip, 1.2, 0.8); blob(c, X, Y, 2.3, hip - 0.4, 0.6, 0.6, u);
    limb(c, X, Y, -1.8, S, -2.2, hip, 1.2, 0.8); blob(c, X, Y, -2.2, hip - 0.4, 0.6, 0.6, u);
  }
}

// ── hieroglyphs: a small sign list drawn in a unit box ───────────────────────────
const GLYPHS = [
  (c, s) => { c.moveTo(-0.4 * s, 0.1 * s); c.quadraticCurveTo(0, -0.45 * s, 0.35 * s, -0.1 * s); c.lineTo(0.45 * s, 0.05 * s); c.lineTo(-0.4 * s, 0.1 * s); c.moveTo(0, 0.1 * s); c.lineTo(0, 0.45 * s); }, // bird
  (c, s) => { for (let k = 0; k < 4; k++) { c.moveTo((-0.45 + k * 0.22) * s, 0); c.lineTo((-0.34 + k * 0.22) * s, -0.12 * s); c.lineTo((-0.23 + k * 0.22) * s, 0); } }, // water
  (c, s) => { c.moveTo(-0.08 * s, 0.45 * s); c.lineTo(0.08 * s, -0.45 * s); c.lineTo(0.18 * s, -0.2 * s); }, // reed
  (c, s) => { c.moveTo(0.4 * s, 0); c.ellipse(0, 0, 0.4 * s, 0.14 * s, 0, 0, Math.PI * 2); }, // mouth
  (c, s) => { c.moveTo(-0.4 * s, 0.2 * s); c.arc(0, 0.2 * s, 0.4 * s, Math.PI, 0); c.closePath(); }, // loaf
  (c, s) => { c.moveTo(0, 0.45 * s); c.lineTo(0, -0.05 * s); c.moveTo(-0.3 * s, -0.05 * s); c.lineTo(0.3 * s, -0.05 * s); c.moveTo(0.16 * s, -0.27 * s); c.ellipse(0, -0.27 * s, 0.16 * s, 0.2 * s, 0, 0, Math.PI * 2); }, // ankh
  (c, s) => { c.moveTo(-0.4 * s, 0); c.quadraticCurveTo(0, -0.3 * s, 0.4 * s, 0); c.quadraticCurveTo(0, 0.2 * s, -0.4 * s, 0); c.moveTo(0.08 * s, 0); c.arc(0, 0, 0.08 * s, 0, Math.PI * 2); c.moveTo(-0.05 * s, 0.1 * s); c.lineTo(-0.15 * s, 0.4 * s); }, // eye
  (c, s) => { c.moveTo(-0.45 * s, 0.2 * s); c.bezierCurveTo(-0.2 * s, -0.3 * s, 0.1 * s, 0.4 * s, 0.4 * s, -0.15 * s); }, // snake
  (c, s) => { c.moveTo(0.3 * s, 0); c.arc(0, 0, 0.3 * s, 0, Math.PI * 2); c.moveTo(0.05 * s, 0); c.arc(0, 0, 0.05 * s, 0, Math.PI * 2); }, // sun
  (c, s) => { c.moveTo(-0.45 * s, 0); c.lineTo(0.2 * s, 0); c.lineTo(0.3 * s, -0.1 * s); c.moveTo(-0.45 * s, 0); c.lineTo(-0.45 * s, 0.12 * s); }, // arm
  (c, s) => { c.moveTo(-0.35 * s, -0.1 * s); c.arc(0, -0.1 * s, 0.35 * s, 0, Math.PI); c.closePath(); }, // basket
  (c, s) => { c.moveTo(0, -0.45 * s); c.lineTo(0, 0.25 * s); c.lineTo(0.3 * s, 0.45 * s); c.moveTo(-0.15 * s, 0.45 * s); c.lineTo(0, 0.25 * s); }, // leg
  (c, s) => { c.moveTo(-0.3 * s, 0.45 * s); c.lineTo(-0.3 * s, -0.1 * s); c.quadraticCurveTo(0, -0.45 * s, 0.3 * s, -0.1 * s); c.lineTo(0.3 * s, 0.45 * s); }, // shrine
  (c, s) => { c.moveTo(-0.4 * s, -0.2 * s); c.lineTo(0.4 * s, -0.2 * s); c.moveTo(-0.4 * s, 0.2 * s); c.lineTo(0.4 * s, 0.2 * s); }, // flat signs
  (c, s) => { c.moveTo(-0.1 * s, 0.45 * s); c.lineTo(-0.1 * s, -0.25 * s); c.lineTo(0.3 * s, -0.4 * s); c.lineTo(0.3 * s, -0.1 * s); c.lineTo(-0.1 * s, 0.05 * s); }, // flag (netjer)
];

function glyphColumn(ctx, r, x, y0, y1, w, opts) {
  ctx.save();
  let y = y0 + w * 0.6;
  while (y < y1 - w * 0.5) {
    const g = r.pick(GLYPHS);
    const s = w * r.range(0.62, 0.8);
    carve(ctx, (c) => { c.save(); c.translate(x, y); g(c, s); c.restore(); }, opts);
    y += s * r.range(0.95, 1.25);
  }
  ctx.restore();
}

function cartouche(ctx, r, x, y, w, h, opts) {
  carve(ctx, (c) => {
    const rr = w / 2;
    c.moveTo(x - rr, y + rr);
    c.arc(x, y + rr, rr, Math.PI, 0);
    c.lineTo(x + rr, y + h - rr);
    c.arc(x, y + h - rr, rr, 0, Math.PI);
    c.closePath();
    c.moveTo(x - rr * 1.2, y + h + rr * 0.15); c.lineTo(x + rr * 1.2, y + h + rr * 0.15);
  }, opts);
  glyphColumn(ctx, r, x, y + w * 0.05, y + h - w * 0.1, w * 0.8, opts);
}

// ── stone surfaces ─────────────────────────────────────────────────────────────
function ashlar(ctx, W, H, color, r, { course, minLen, maxLen, mpx }) {
  ctx.fillStyle = shade(color, -0.12);
  ctx.fillRect(0, 0, W, H);
  const ch = course * mpx;
  const rows = Math.round(H / ch);
  for (let j = 0; j < rows; j++) {
    let x = -r() * maxLen * mpx;
    const y = j * (H / rows);
    while (x < W) {
      const len = r.range(minLen, maxLen) * mpx;
      const c = shade(mix(color, r() < 0.15 ? "#c79b6a" : color, 0.5), r.range(-0.035, 0.03));
      for (const dx of [0, W, -W]) {
        const px = x + dx;
        if (px > W || px + len < 0) continue;
        ctx.fillStyle = c;
        ctx.fillRect(px + 1.2, y + 1.2, len - 2.4, H / rows - 2.4);
        // a softly lit top edge and a shaded lower one
        ctx.fillStyle = "rgba(255,240,215,0.10)";
        ctx.fillRect(px + 1.2, y + 1.2, len - 2.4, 2);
        ctx.fillStyle = "rgba(70,45,20,0.10)";
        ctx.fillRect(px + 1.2, y + H / rows - 3.4, len - 2.4, 2.2);
      }
      x += len;
    }
  }
  // weathering: speckles, streaks and patches
  for (let i = 0; i < W * H / 60; i++) {
    ctx.globalAlpha = r.range(0.03, 0.1);
    ctx.fillStyle = r() < 0.5 ? "#5a3e22" : "#fff4dc";
    const s = r.range(0.6, 2);
    ctx.fillRect(r() * W, r() * H, s, s);
  }
  for (let i = 0; i < 14; i++) {
    ctx.globalAlpha = r.range(0.03, 0.07);
    ctx.fillStyle = r() < 0.6 ? "#7a5530" : "#f6e2bd";
    ctx.beginPath();
    ctx.ellipse(r() * W, r() * H, r.range(20, 90), r.range(10, 50), r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** A register of relief: figures facing each other, columns of text between them. */
function register(ctx, r, x0, x1, base, h, color, painted) {
  const dark = "rgba(55,34,15,0.36)", light = "rgba(255,247,228,0.3)";
  const opts = { dark, light, depth: 1.6, width: 1.25 };
  // register lines
  carve(ctx, (c) => { c.moveTo(x0, base + 3); c.lineTo(x1, base + 3); c.moveTo(x0, base - h - 4); c.lineTo(x1, base - h - 4); }, opts);
  let x = x0 + r.range(10, 40);
  const fh = h * 0.78;
  while (x < x1 - fh * 0.8) {
    // a scene: the king (left) offers to a god (right), text columns above and between
    const scene = r.pick(["offer", "offer", "king", "priest"]);
    const god = r.pick(["god", "falcon", "seated", "god"]);
    const kx = x + fh * 0.25, gx = x + fh * 0.95;
    const fill = painted ? r.pick(["rgba(160,70,40,0.16)", "rgba(40,80,140,0.14)", "rgba(60,120,90,0.14)"]) : "rgba(90,60,30,0.09)";
    carve(ctx, (c) => figure(c, kx, base, fh, 1, scene), { ...opts, fill });
    carve(ctx, (c) => figure(c, gx, base, god === "seated" ? fh * 1.1 : fh, -1, god), { ...opts, fill });
    // text above the figures
    for (let k = 0; k < 3; k++) glyphColumn(ctx, r, kx - fh * 0.1 + k * fh * 0.13, base - h, base - fh - 2, fh * 0.11, opts);
    cartouche(ctx, r, gx - fh * 0.08, base - h + 2, fh * 0.12, fh * 0.32, opts);
    x += fh * 1.45;
    // a dividing column of text
    carve(ctx, (c) => { c.moveTo(x - fh * 0.12, base - h); c.lineTo(x - fh * 0.12, base); }, opts);
    glyphColumn(ctx, r, x - fh * 0.04, base - h, base, fh * 0.11, opts);
    x += fh * 0.12;
  }
}

const STONE_KINDS = {
  // tile: metres covered by one repeat; px: canvas size
  relief: { tile: [9.6, 4.8], px: [1536, 768] },
  painted: { tile: [9.6, 4.8], px: [1536, 768] },
  pylon: { tile: [12, 6], px: [1536, 768] },
  plain: { tile: [6, 3.6], px: [1024, 614] },
  granite: { tile: [2, 2], px: [512, 512] },
};

/** Stone surface: kind "relief" | "painted" | "pylon" | "plain" | "granite" → { map, tile } */
export function stoneTexture(kind, color) {
  const spec = STONE_KINDS[kind] || STONE_KINDS.plain;
  return cached(`stone|${kind}|${color}`, () => {
    const [W, H] = spec.px;
    const canvas = makeCanvas(W, H);
    const ctx = canvas.getContext("2d");
    const r = rng(hashString(kind + color));
    const mpx = W / spec.tile[0];
    if (kind === "granite") {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 26000; i++) {
        ctx.globalAlpha = r.range(0.15, 0.6);
        ctx.fillStyle = r.pick(["#1d1a18", "#f2e6dc", shade(color, -0.25), shade(color, 0.2), "#7d5a4a"]);
        const s = r.range(0.8, 3.2);
        ctx.fillRect(r() * W, r() * H, s, s * r.range(0.6, 1.4));
      }
      ctx.globalAlpha = 1;
      return { map: finish(canvas), tile: spec.tile };
    }
    ashlar(ctx, W, H, color, r, kind === "pylon" ? { course: 0.75, minLen: 1.2, maxLen: 2.6, mpx }
      : { course: 0.6, minLen: 0.8, maxLen: 1.9, mpx });
    if (kind === "relief" || kind === "painted") {
      // two registers per repeat, each 2.4 m: figures about 1.7 m tall
      register(ctx, r, 0, W, H * 0.5 - 6, H * 0.42, color, kind === "painted");
      register(ctx, r, 0, W, H - 6, H * 0.42, color, kind === "painted");
    } else if (kind === "pylon") {
      // long vertical inscriptions down the towers
      const opts = { dark: "rgba(55,34,15,0.42)", light: "rgba(255,247,228,0.35)", depth: 2, width: 1.8 };
      for (let k = 0; k < 6; k++) {
        const x = (k + 0.5) * W / 6 + r.range(-30, 30);
        carve(ctx, (c) => { c.moveTo(x - 24, 0); c.lineTo(x - 24, H); c.moveTo(x + 24, 0); c.lineTo(x + 24, H); }, opts);
        glyphColumn(ctx, r, x, 0, H, 40, opts);
      }
    }
    return { map: finish(canvas), tile: spec.tile };
  });
}

/** The painted ceiling: yellow stars on lapis blue, between bands. → { map, tile } */
export function ceilingTexture(kind = "stars") {
  return cached(`ceiling|${kind}`, () => {
    const N = 512;
    const canvas = makeCanvas(N, N);
    const ctx = canvas.getContext("2d");
    const r = rng(77);
    ctx.fillStyle = kind === "stars" ? "#23396b" : "#2c3f5e";
    ctx.fillRect(0, 0, N, N);
    // faded, uneven paint
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = r.range(0.04, 0.12);
      ctx.fillStyle = r() < 0.5 ? "#4a6aa8" : "#16264a";
      ctx.beginPath();
      ctx.ellipse(r() * N, r() * N, r.range(30, 120), r.range(20, 80), r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const star = (x, y, s) => {
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + k * Math.PI / 5;
        const rr = k % 2 ? s * 0.32 : s;
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
    };
    ctx.fillStyle = "#e8c45a";
    const n = 4;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = (i + 0.5 + (j % 2) * 0.5) * N / n, y = (j + 0.5) * N / n;
      for (const dx of [0, -N]) star((x + dx + N) % N, y, 20);
    }
    // a painted band at the tile edge, reading as the joints between ceiling slabs
    ctx.fillStyle = "#b8862f";
    ctx.fillRect(0, 0, N, 10);
    ctx.fillStyle = "#7a2e22";
    ctx.fillRect(0, 10, N, 4);
    return { map: finish(canvas), tile: [3.2, 3.2] };
  });
}

/** Ribbed cavetto cornice: u wraps along the wall, v runs up the profile (0…1). */
export function corniceTexture(color, painted = false) {
  return cached(`cornice|${color}|${painted}`, () => {
    const W = 256, H = 128;
    const canvas = makeCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
    const n = 8;
    const paints = ["#2f5d8a", "#3f8a6a", "#a8452e", "#3f8a6a"];
    for (let i = 0; i < n; i++) {
      const x = i * W / n;
      if (painted) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = paints[i % paints.length];
        ctx.fillRect(x + 4, H * 0.18, W / n - 8, H * 0.7);
        ctx.globalAlpha = 1;
      }
      const g = ctx.createLinearGradient(x, 0, x + W / n, 0);
      g.addColorStop(0, "rgba(60,40,20,0.28)");
      g.addColorStop(0.35, "rgba(255,245,225,0.12)");
      g.addColorStop(0.7, "rgba(255,245,225,0.0)");
      g.addColorStop(1, "rgba(60,40,20,0.22)");
      ctx.fillStyle = g;
      ctx.fillRect(x, H * 0.15, W / n, H * 0.75);
      // rounded leaf tips at the top
      ctx.fillStyle = "rgba(60,40,20,0.25)";
      ctx.beginPath();
      ctx.arc(x + W / n / 2, H * 0.15, W / n / 2 - 2, Math.PI, 0);
      ctx.fill();
    }
    ctx.fillStyle = shade(color, 0.06);
    ctx.fillRect(0, H * 0.9, W, H * 0.1);
    ctx.fillStyle = shade(color, -0.1);
    ctx.fillRect(0, 0, W, H * 0.06);
    return { map: finish(canvas), tile: [1.6, 1] };
  });
}

// ── scenes (transparent decals laid on the stone) ─────────────────────────────────
function decal(key, W, H, draw) {
  return cached(`decal|${key}`, () => {
    const canvas = makeCanvas(W, H);
    const ctx = canvas.getContext("2d");
    draw(ctx, W, H, rng(hashString(key)));
    return finish(canvas, { repeat: false });
  });
}

/** The king smiting his enemies before Horus: the standard scene on a pylon tower. */
export function smiteTexture(flip) {
  return decal(`smite|${flip}`, 1024, 1132, (ctx, W, H, r) => {
    const opts = { dark: "rgba(50,30,12,0.6)", light: "rgba(255,248,230,0.5)", depth: 3.2, width: 3 };
    const dir = flip ? -1 : 1;
    const kingX = flip ? W * 0.62 : W * 0.38;
    // frame
    carve(ctx, (c) => { c.rect(W * 0.04, H * 0.03, W * 0.92, H * 0.94); }, { ...opts, width: 4 });
    // winged disc at the top
    carve(ctx, (c) => {
      c.moveTo(W * 0.5 + 34, H * 0.08); c.arc(W * 0.5, H * 0.08, 34, 0, Math.PI * 2);
      for (const s of [-1, 1]) {
        c.moveTo(W * 0.5 + s * 40, H * 0.08); c.quadraticCurveTo(W * 0.5 + s * 200, H * 0.04, W * 0.5 + s * 420, H * 0.075);
        c.moveTo(W * 0.5 + s * 40, H * 0.1); c.quadraticCurveTo(W * 0.5 + s * 200, H * 0.12, W * 0.5 + s * 400, H * 0.095);
      }
    }, opts);
    // the king, huge, smiting a knot of captives
    carve(ctx, (c) => figure(c, kingX, H * 0.93, H * 0.62, dir, "smite"), { ...opts, fill: "rgba(80,50,20,0.08)" });
    for (let k = 0; k < 5; k++) {
      const ex = kingX + dir * (W * 0.2 + k * 26), ey = H * 0.93 - k * 6;
      carve(ctx, (c) => figure(c, ex, ey, H * 0.26 - k * 8, -dir, "enemy"), { ...opts, width: 2.4 });
    }
    // Horus receives the offering, on the far side
    carve(ctx, (c) => figure(c, flip ? W * 0.2 : W * 0.8, H * 0.93, H * 0.5, -dir, "falcon"), { ...opts, fill: "rgba(80,50,20,0.06)" });
    // columns of text above
    for (let k = 0; k < 9; k++) glyphColumn(ctx, r, W * 0.12 + k * W * 0.085, H * 0.14, H * 0.3, 40, { ...opts, width: 2.4, depth: 2.4 });
  });
}

/** Horus, in a papyrus boat, spears Seth in the form of a hippopotamus (Edfu's myth of victory). */
export function triumphTexture() {
  return decal("triumph", 2048, 888, (ctx, W, H, r) => {
    const opts = { dark: "rgba(50,30,12,0.55)", light: "rgba(255,248,230,0.45)", depth: 2.6, width: 2.6 };
    const paint = (c) => ({ ...opts, fill: c });
    carve(ctx, (c) => c.rect(10, 10, W - 20, H - 20), { ...opts, width: 4 });
    // water: zigzag bands
    ctx.save();
    for (let row = 0; row < 4; row++) {
      const y = H * 0.8 + row * 22;
      ctx.fillStyle = "rgba(50,100,150,0.18)";
      ctx.fillRect(20, y - 10, W - 40, 18);
      carve(ctx, (c) => { for (let x = 20; x < W - 20; x += 28) { c.moveTo(x, y); c.lineTo(x + 14, y - 10); c.lineTo(x + 28, y); } }, { ...opts, width: 2 });
    }
    ctx.restore();
    for (const [bx, dir] of [[W * 0.3, 1], [W * 0.68, -1]]) {
      // papyrus boat
      carve(ctx, (c) => {
        c.moveTo(bx - 260, H * 0.62); c.quadraticCurveTo(bx - 230, H * 0.78, bx, H * 0.78);
        c.quadraticCurveTo(bx + 230, H * 0.78, bx + 260, H * 0.62);
        c.moveTo(bx - 240, H * 0.7); c.lineTo(bx + 240, H * 0.7);
      }, paint("rgba(120,150,60,0.2)"));
      // Horus thrusting a long harpoon down at the hippo
      carve(ctx, (c) => figure(c, bx - dir * 40, H * 0.72, H * 0.52, dir, "falcon"), paint("rgba(40,80,140,0.14)"));
      carve(ctx, (c) => { c.moveTo(bx - dir * 70, H * 0.3); c.lineTo(bx + dir * 300, H * 0.86); }, { ...opts, width: 4 });
    }
    // Seth as a small hippopotamus, speared, between the boats
    const hx = W * 0.49, hy = H * 0.86;
    carve(ctx, (c) => {
      c.moveTo(hx - 120, hy); c.quadraticCurveTo(hx - 110, hy - 90, hx + 10, hy - 80);
      c.quadraticCurveTo(hx + 90, hy - 76, hx + 130, hy - 40); c.lineTo(hx + 135, hy);
      c.moveTo(hx + 80, hy - 60); c.arc(hx + 72, hy - 60, 8, 0, Math.PI * 2);
    }, paint("rgba(150,70,40,0.2)"));
    // Isis behind, and lines of text
    carve(ctx, (c) => figure(c, W * 0.9, H * 0.72, H * 0.42, -1, "god"), paint("rgba(60,120,90,0.14)"));
    carve(ctx, (c) => figure(c, W * 0.1, H * 0.72, H * 0.42, 1, "king"), paint("rgba(160,70,40,0.14)"));
    for (let k = 0; k < 26; k++) glyphColumn(ctx, r, 70 + k * 74, 30, H * 0.26, 34, { ...opts, width: 2, depth: 2 });
  });
}

/** A round-topped stela: winged disc, a scene, and lines of text. Drawn opaque. */
export function stelaTexture(kind, color) {
  return decal(`stela|${kind}|${color}`, 512, 768, (ctx, W, H, r) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) {
      ctx.globalAlpha = r.range(0.04, 0.14);
      ctx.fillStyle = r() < 0.5 ? "#000" : "#fff";
      ctx.fillRect(r() * W, r() * H, 1.4, 1.4);
    }
    ctx.globalAlpha = 1;
    const opts = { dark: "rgba(20,15,10,0.6)", light: "rgba(255,250,240,0.35)", depth: 2, width: 2.2 };
    carve(ctx, (c) => {
      c.moveTo(W / 2 + 22, H * 0.1); c.arc(W / 2, H * 0.1, 22, 0, Math.PI * 2);
      for (const s of [-1, 1]) { c.moveTo(W / 2 + s * 26, H * 0.1); c.quadraticCurveTo(W / 2 + s * 120, H * 0.07, W / 2 + s * 200, H * 0.11); }
    }, { ...opts, fill: "rgba(212,165,72,0.6)" });
    carve(ctx, (c) => figure(c, W * 0.33, H * 0.42, H * 0.26, 1, kind === "flood" ? "offer" : "king"), opts);
    carve(ctx, (c) => figure(c, W * 0.7, H * 0.42, H * 0.24, -1, kind === "flood" ? "seated" : "falcon"), opts);
    for (let row = 0; row < 9; row++) {
      const y = H * 0.48 + row * H * 0.055;
      carve(ctx, (c) => { c.moveTo(W * 0.08, y + 18); c.lineTo(W * 0.92, y + 18); }, { ...opts, width: 1.2 });
      let x = W * 0.12;
      while (x < W * 0.9) {
        const g = r.pick(GLYPHS);
        carve(ctx, (c) => { c.save(); c.translate(x, y); g(c, 26); c.restore(); }, { ...opts, width: 1.8 });
        x += r.range(24, 34);
      }
    }
  });
}

/** One column of hieroglyphs down an obelisk face: u across the face (0…1), v repeats every tile[1] metres. */
export function obeliskTexture(color) {
  return cached(`obelisk|${color}`, () => {
    const W = 256, H = 1024;
    const canvas = makeCanvas(W, H);
    const ctx = canvas.getContext("2d");
    const r = rng(hashString("obelisk" + color));
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 16000; i++) {
      ctx.globalAlpha = r.range(0.1, 0.45);
      ctx.fillStyle = r.pick(["#1d1a18", "#f2e6dc", shade(color, -0.25), shade(color, 0.2)]);
      ctx.fillRect(r() * W, r() * H, r.range(0.8, 2.4), r.range(0.8, 2.4));
    }
    ctx.globalAlpha = 1;
    const opts = { dark: "rgba(25,15,10,0.65)", light: "rgba(255,240,230,0.35)", depth: 2.4, width: 2.6 };
    carve(ctx, (c) => { c.moveTo(W * 0.3, 0); c.lineTo(W * 0.3, H); c.moveTo(W * 0.7, 0); c.lineTo(W * 0.7, H); }, opts);
    glyphColumn(ctx, r, W / 2, 0, H, W * 0.3, opts);
    return { map: finish(canvas), tile: [1, 6] };
  });
}

/** A date-palm frond seen flat: a midrib with stiff leaflets on both sides, on transparent ground. u across, v base→tip. */
export function frondTexture(variant = 0) {
  return cached(`frond|${variant}`, () => {
    const W = 256, H = 512;
    const canvas = makeCanvas(W, H);
    const ctx = canvas.getContext("2d");
    const r = rng(31 + variant * 7);
    const greens = variant ? ["#58803a", "#6b9442", "#4a7334", "#7fa04c"] : ["#4f7a36", "#628c3e", "#44692f", "#759a46"];
    ctx.lineCap = "round";
    // leaflets: from the midrib out and toward the tip, longest in the middle of the frond
    for (let k = 0; k < 64; k++) {
      const t = 0.04 + (k / 64) * 0.93;
      const y = H * (1 - t);
      const len = W * 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.08)) ** 0.7 * r.range(0.82, 1.0);
      for (const s of [-1, 1]) {
        const ang = 0.55 + r.range(-0.08, 0.08);
        const x1 = W / 2 + s * len * Math.cos(ang) * 0.98, y1 = y - len * Math.sin(ang) * 0.9;
        ctx.strokeStyle = r.pick(greens);
        ctx.lineWidth = r.range(4.5, 7) * (1 - t * 0.45);
        ctx.beginPath();
        ctx.moveTo(W / 2, y);
        ctx.quadraticCurveTo(W / 2 + s * len * 0.45, y - len * 0.35, x1, y1);
        ctx.stroke();
        // a lighter crease down each leaflet
        ctx.strokeStyle = "rgba(220,235,170,0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(W / 2, y);
        ctx.quadraticCurveTo(W / 2 + s * len * 0.45, y - len * 0.35, x1, y1);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = "#8a8a4a";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(W / 2, H);
    ctx.lineTo(W / 2, H * 0.03);
    ctx.stroke();
    const tex = finish(canvas, { repeat: false });
    return { map: tex };
  });
}
