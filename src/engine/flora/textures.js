// Foliage textures drawn procedurally on canvases (no image assets): sprays of leaves, needle
// tufts, scale foliage, grass blades, reeds. Each texture is a card seen face-on with alpha.

import * as THREE from 'three/webgpu';

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const cache = new Map();

/** Leaf colour jittered around a base (hex), as an rgb() string. */
function jitter(rand, base, amount = 18) {
  const c = new THREE.Color(base);
  const r = Math.round(c.r * 255 + (rand() - 0.5) * amount), g = Math.round(c.g * 255 + (rand() - 0.5) * amount), b = Math.round(c.b * 255 + (rand() - 0.5) * amount * 0.7);
  return `rgb(${r},${g},${b})`;
}

const DRAW = {
  /** A spray of narrow leaves on twigs (olive: dark above, silver beneath). */
  olive(g, S, rand) {
    for (let t = 0; t < 9; t++) {
      const x0 = S * (0.2 + rand() * 0.6), y0 = S * (0.55 + rand() * 0.4), a = -Math.PI / 2 + (rand() - 0.5) * 1.8, L = S * (0.35 + rand() * 0.25);
      g.strokeStyle = '#5b5040'; g.lineWidth = S * 0.006;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(a) * L, y0 + Math.sin(a) * L); g.stroke();
      for (let k = 0; k < 16; k++) {
        const u = rand(), px = x0 + Math.cos(a) * L * u, py = y0 + Math.sin(a) * L * u;
        const la = a + (rand() < 0.5 ? -1 : 1) * (0.5 + rand() * 0.6);
        leaf(g, px, py, la, S * (0.07 + rand() * 0.04), S * 0.011, rand() < 0.35 ? jitter(rand, '#9aa58c') : jitter(rand, '#55634a'));
      }
    }
  },
  /** Broad oval leaves, densely overlapping (holm oak, fig, laurel). */
  broad(g, S, rand, base = '#3f5330') {
    for (let k = 0; k < 420; k++) {
      const r = Math.sqrt(rand()) * S * 0.46, a = rand() * Math.PI * 2;
      leaf(g, S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r, rand() * Math.PI * 2, S * (0.035 + rand() * 0.025), S * (0.018 + rand() * 0.01), jitter(rand, base, 30));
    }
  },
  /** Pine needles in tufts radiating from twig ends. */
  needles(g, S, rand, base = '#4a6236') {
    for (let t = 0; t < 26; t++) {
      const cx = S * (0.15 + rand() * 0.7), cy = S * (0.15 + rand() * 0.7);
      for (let k = 0; k < 40; k++) {
        const a = rand() * Math.PI * 2, L = S * (0.05 + rand() * 0.07);
        g.strokeStyle = jitter(rand, base, 26); g.lineWidth = S * 0.004;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L); g.stroke();
      }
    }
  },
  /** Cypress: dense sprays of tiny scale leaves on fine branchlets. */
  scale(g, S, rand) {
    const spray = (x, y, a, L, d) => {
      if (L < S * 0.02 || d > 5) return;
      const x1 = x + Math.cos(a) * L, y1 = y + Math.sin(a) * L;
      g.strokeStyle = jitter(rand, '#33472c', 20); g.lineWidth = Math.max(1, S * 0.014 - d * S * 0.002);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x1, y1); g.stroke();
      for (let k = 0; k < 3; k++) spray(x + (x1 - x) * (0.3 + k * 0.25), y + (y1 - y) * (0.3 + k * 0.25), a + (k % 2 ? 0.7 : -0.7) + (rand() - 0.5) * 0.4, L * 0.55, d + 1);
    };
    for (let t = 0; t < 14; t++) spray(S * (0.3 + rand() * 0.4), S * (0.75 + rand() * 0.2), -Math.PI / 2 + (rand() - 0.5) * 1.2, S * (0.3 + rand() * 0.15), 0);
  },
  /** Acacia: feathery bipinnate leaves, many tiny leaflets with light between them. */
  acacia(g, S, rand) {
    for (let t = 0; t < 60; t++) {
      const x0 = S * (0.1 + rand() * 0.8), y0 = S * (0.1 + rand() * 0.8), a = rand() * Math.PI * 2, L = S * (0.08 + rand() * 0.06);
      for (let k = 0; k < 10; k++) {
        const px = x0 + Math.cos(a) * L * k / 10, py = y0 + Math.sin(a) * L * k / 10;
        for (const sd of [-1, 1]) leaf(g, px + Math.cos(a + sd * 1.4) * S * 0.008, py + Math.sin(a + sd * 1.4) * S * 0.008, a + sd * 1.4, S * 0.012, S * 0.005, jitter(rand, '#677a3c', 24));
      }
    }
  },
  /** Tamarisk: thin drooping grey-green threads. */
  tamarisk(g, S, rand) {
    for (let k = 0; k < 160; k++) {
      const x = S * rand(), y = S * rand() * 0.6, L = S * (0.15 + rand() * 0.25);
      g.strokeStyle = jitter(rand, '#7d8a6c', 24); g.lineWidth = S * 0.006;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (rand() - 0.5) * S * 0.1, y + L * 0.6, x + (rand() - 0.5) * S * 0.15, y + L); g.stroke();
    }
  },
  /** Grass: a tuft of blades from a point at the bottom centre, green to straw. */
  grass(g, S, rand, base = '#7f8e4c', dry = '#c4b47c') {
    for (let k = 0; k < 150; k++) {
      const x0 = S * (0.3 + rand() * 0.4), a = -Math.PI / 2 + (rand() - 0.5) * 1.1, L = S * (0.4 + rand() * 0.55);
      const bend = (rand() - 0.5) * S * 0.25;
      g.strokeStyle = rand() < 0.4 ? jitter(rand, dry, 26) : jitter(rand, base, 26);
      g.lineWidth = S * (0.012 + rand() * 0.012);
      g.beginPath(); g.moveTo(x0, S);
      g.quadraticCurveTo(x0 + Math.cos(a) * L * 0.5, S + Math.sin(a) * L * 0.5, x0 + Math.cos(a) * L + bend, S + Math.sin(a) * L); g.stroke();
    }
  },
  /** Reeds and papyrus: tall strap leaves and stems with feathery heads. */
  reed(g, S, rand) {
    for (let k = 0; k < 34; k++) {
      const x0 = S * (0.3 + rand() * 0.4), lean = (rand() - 0.5) * S * 0.3, top = S * (0.02 + rand() * 0.25);
      g.strokeStyle = jitter(rand, '#6f7d48', 26); g.lineWidth = S * 0.01;
      g.beginPath(); g.moveTo(x0, S); g.quadraticCurveTo(x0 + lean * 0.3, S * 0.5, x0 + lean, top); g.stroke();
      if (rand() < 0.35) { g.fillStyle = jitter(rand, '#a1906a', 20); g.beginPath(); g.ellipse(x0 + lean, top + S * 0.03, S * 0.02, S * 0.06, 0.2, 0, Math.PI * 2); g.fill(); }
    }
  },
  /** Japanese maple in autumn: small palmate leaves, scarlet, orange and a little late green. */
  maple(g, S, rand) {
    const cols = ['#b8321e', '#c94a1c', '#d8741f', '#9a2a1c', '#c9a13a', '#6f7a34'];
    for (let k = 0; k < 360; k++) {
      const r = Math.sqrt(rand()) * S * 0.46, a = rand() * Math.PI * 2, x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r;
      const c = jitter(rand, cols[Math.floor(Math.pow(rand(), 1.4) * cols.length)], 24), L = S * (0.022 + rand() * 0.014), rot = rand() * Math.PI * 2;
      for (let p = 0; p < 7; p++) leaf(g, x, y, rot + (p - 3) * 0.42, L * (p === 3 ? 1 : 0.75 + 0.1 * Math.abs(p - 3) * -1 + 0.3), S * 0.006, c);
    }
  },
  /** Bamboo: sprays of narrow lance leaves hanging from thin twigs. */
  bamboo(g, S, rand) {
    for (let t = 0; t < 16; t++) {
      const x0 = S * (0.1 + rand() * 0.8), y0 = S * (0.05 + rand() * 0.5);
      for (let k = 0; k < 9; k++) {
        const a = Math.PI / 2 + (rand() - 0.5) * 1.6, px = x0 + (rand() - 0.5) * S * 0.08, py = y0 + rand() * S * 0.15;
        leaf(g, px, py, a, S * (0.12 + rand() * 0.06), S * 0.012, jitter(rand, rand() < 0.3 ? '#8d9a4c' : '#5f7a3a', 24));
      }
    }
  },
  /** Oleander: lance leaves with pink flower clusters. */
  oleander(g, S, rand) {
    DRAW.broad(g, S, rand, '#3c5a33');
    for (let k = 0; k < 40; k++) {
      const r = Math.sqrt(rand()) * S * 0.4, a = rand() * Math.PI * 2;
      g.fillStyle = jitter(rand, '#d77a92', 30);
      for (let p = 0; p < 5; p++) { g.beginPath(); g.arc(S / 2 + Math.cos(a) * r + (rand() - 0.5) * S * 0.03, S / 2 + Math.sin(a) * r + (rand() - 0.5) * S * 0.03, S * 0.008, 0, Math.PI * 2); g.fill(); }
    }
  },
};

function leaf(g, x, y, a, len, wid, color) {
  g.save(); g.translate(x, y); g.rotate(a);
  g.fillStyle = color;
  g.beginPath(); g.ellipse(len / 2, 0, len / 2, wid, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

/** The texture for a foliage kind (cached). */
export function foliageTexture(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const S = 512, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.lineCap = 'round';
  DRAW[kind](g, S, rng(kind.length * 977 + 13));
  // dilate colour into the transparent texels so mipmaps do not darken the leaf edges
  const img = g.getImageData(0, 0, S, S), d = img.data;
  let sum = [0, 0, 0], n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { sum[0] += d[i]; sum[1] += d[i + 1]; sum[2] += d[i + 2]; n++; }
  const avg = sum.map((v) => v / Math.max(1, n));
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] < 8) { d[i] = avg[0]; d[i + 1] = avg[1]; d[i + 2] = avg[2]; d[i + 3] = 3; }   // alpha 3, not 0: canvases drop the colour of fully transparent texels
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.generateMipmaps = true;
  cache.set(kind, t);
  return t;
}
