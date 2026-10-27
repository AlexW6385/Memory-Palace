// The regions of the world and its landscape (docs/world.md).
//
// The world is a river valley running north–south. On its west bank lie the regions, each a
// basin closed by natural boundaries: the Nile region under its desert escarpment, Rome among
// its hills, Greece around the Acropolis under the mountains. Ridge spurs come down from the
// western uplands to the river between them; a pass crosses each spur, and a path runs along
// the river bank below its end.
//
// Everything here is pure data and pure functions, shared by the viewer (terrain meshes,
// ground, climate), the walker, the plan and walk checks and the light baker.
// Axes: +x east, +y up, +z south (north is −z). Metres.

// ── regions and their climates ───────────────────────────────────────────────

/**
 * Each region spans a band of the valley in z (north edge, south edge). Its climate fixes the
 * sun (time of day, so that light can be baked) and gives the sky, haze and a weather cycle.
 * Sun: azimuth in degrees from north, clockwise; elevation in degrees.
 */
export const REGIONS = [
  {
    id: 'nile', name: { en: 'The Nile', zh: '尼罗河' },
    z: [-560, 1250], center: [-40, 120],
    climate: {
      // late afternoon in Upper Egypt: the sun low in the west-south-west, warm, dusty air
      sun: { az: 248, el: 24, color: [1.0, 0.8, 0.6], intensity: 3.3 },
      sky: { turbidity: 4.2, rayleigh: 1.5, mie: 0.0045, mieG: 0.82, zenith: [0.1, 0.13, 0.2], horizon: [0.32, 0.27, 0.21] },
      fog: { color: [0.62, 0.55, 0.45], density: 0.00042, height: 0.01 },
      exposure: 0.55,
      wind: [0.8, -0.3],
      weather: [
        { id: 'clear', weight: 5, clouds: 0.05, cloudDensity: 0.3, sun: 1.0, fog: 1.0 },
        { id: 'high-cloud', weight: 3, clouds: 0.25, cloudDensity: 0.25, sun: 0.92, fog: 1.0 },
        { id: 'dust', weight: 2, clouds: 0.1, cloudDensity: 0.3, sun: 0.62, fog: 4.5, fogColor: [0.66, 0.53, 0.38] },
      ],
    },
    ground: 'nile',
  },
  {
    id: 'rome', name: { en: 'Rome', zh: '罗马' },
    z: [-1600, -560], center: [-80, -1080],
    climate: {
      // a spring morning on the Campus Martius: the sun in the east-south-east, clouds passing
      sun: { az: 118, el: 30, color: [1.0, 0.9, 0.78], intensity: 3.2 },
      sky: { turbidity: 3.2, rayleigh: 1.2, mie: 0.004, mieG: 0.8, zenith: [0.11, 0.16, 0.27], horizon: [0.27, 0.29, 0.31] },
      fog: { color: [0.52, 0.57, 0.63], density: 0.00045, height: 0.012 },
      exposure: 0.62,
      wind: [0.5, 0.6],
      weather: [
        { id: 'fair', weight: 4, clouds: 0.38, cloudDensity: 0.5, sun: 1.0, fog: 1.0 },
        { id: 'cloudy', weight: 3, clouds: 0.62, cloudDensity: 0.6, sun: 0.75, fog: 1.3 },
        { id: 'overcast', weight: 1.5, clouds: 0.9, cloudDensity: 0.75, sun: 0.35, fog: 1.8 },
        { id: 'shower', weight: 1.5, clouds: 0.92, cloudDensity: 0.85, sun: 0.3, fog: 2.2, rain: 1 },
      ],
    },
    ground: 'rome',
  },
  {
    id: 'greece', name: { en: 'Greece', zh: '希腊' },
    z: [-2750, -1600], center: [-180, -2100],
    climate: {
      // an Attic noon: a high sun from the south, deep blue sky, clear dry air
      sun: { az: 196, el: 52, color: [1.0, 0.95, 0.88], intensity: 3.6 },
      sky: { turbidity: 2.2, rayleigh: 0.95, mie: 0.003, mieG: 0.78, zenith: [0.09, 0.15, 0.3], horizon: [0.24, 0.28, 0.33] },
      fog: { color: [0.52, 0.6, 0.7], density: 0.0003, height: 0.01 },
      exposure: 0.5,
      wind: [-0.6, 0.4],
      weather: [
        { id: 'clear', weight: 5, clouds: 0.12, cloudDensity: 0.4, sun: 1.0, fog: 1.0 },
        { id: 'fair', weight: 3, clouds: 0.32, cloudDensity: 0.5, sun: 0.95, fog: 1.0 },
        { id: 'meltemi', weight: 2, clouds: 0.22, cloudDensity: 0.35, sun: 1.0, fog: 0.7, windy: 1 },
      ],
    },
    ground: 'greece',
  },
];

export const REGION = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

/** Weights of every region at (x, z): smooth across the boundaries (the spurs). Sums to 1. */
export function regionWeights(x, z, blend = 140) {
  const w = REGIONS.map((r) => {
    const a = (z - r.z[0] + blend / 2) / blend, b = (r.z[1] - z + blend / 2) / blend;
    return smooth(0, 1, a) * smooth(0, 1, b);
  });
  const s = w.reduce((p, q) => p + q, 0) || 1;
  return w.map((v) => v / s);
}

export function regionAt(x, z) {
  const w = regionWeights(x, z);
  let best = 0;
  for (let i = 1; i < w.length; i++) if (w[i] > w[best]) best = i;
  return REGIONS[best];
}

/** Unit vector from the ground toward the sun for a climate. */
export function sunDirection(climate) {
  const az = climate.sun.az * Math.PI / 180, el = climate.sun.el * Math.PI / 180;
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
}

/** Sky radiance along direction d for a climate (used by the baker and the outdoor fallback). */
export function skyRadiance(climate, d) {
  const s = sunDirection(climate), { zenith, horizon } = climate.sky;
  const y = Math.max(0, d[1]), t = Math.pow(y, 0.45);
  const cos = d[0] * s[0] + d[1] * s[1] + d[2] * s[2];
  const glow = Math.pow(Math.max(0, cos), 8) * 0.35;
  return [0, 1, 2].map((i) => horizon[i] * (1 - t) + zenith[i] * t + glow * climate.sun.color[i] * 0.4);
}

// ── the world's extent, the river and where each building stands ─────────────

/** Walkable extent; the landscape continues beyond it to the mountains. */
export const WORLD = {
  bounds: [-1150, -2680, 1050, 1180],
  river: { width: 300, bank: 24, depth: 3.4, water: -2.3 },
  far: 700,                                       // how far beyond the bounds the terrain is drawn
};

/** Centre line of the river (x) at z: a gentle meander. */
export function riverCenter(z) {
  return 355 + 45 * Math.sin(z / 720 + 0.6) + 22 * Math.sin(z / 260 + 2.1);
}

/** Where each building stands: origin [x, z], yaw (degrees), base height, region, and the
 *  rectangle (building-local) over which the ground is levelled to the base. */
export const SITES = {
  edfu: { origin: [0, 0], yaw: 0, base: 0, region: 'nile', pad: [-48, -140, 48, 32] },
  pantheon: { origin: [-20, -1080], yaw: 0, base: 0, region: 'rome', pad: [-48, -152, 48, 32] },
  parthenon: { origin: [-165, -2122], yaw: 0, base: 40, region: 'greece', pad: [-46, -26, 50, 26] },
};

// ── landforms ────────────────────────────────────────────────────────────────

/**
 * kind 'mesa': a flat-topped rock with cliffs and one gentle side (rounded-rectangle top).
 * kind 'hill': a rounded hill (elliptical, smooth top).
 * kind 'ridge': a mountain ridge along a polyline, with optional passes (saddles).
 * kind 'escarpment': a cliff along a polyline with a plateau on its high side (`side` = ±1, the
 *   side of travel direction that is high: +1 = right of the polyline's direction).
 * kind 'dunes': a field of transverse dunes inside a polygon.
 */
export const LANDFORMS = [
  // ── Nile ──
  { kind: 'escarpment', id: 'western-desert', points: [[-640, 1700], [-560, 1150], [-500, 650], [-470, 150], [-520, -250], [-640, -560]], side: -1, height: 72, run: 45, rock: 7 },
  { kind: 'escarpment', id: 'eastern-desert', points: [[930, -640], [880, -200], [900, 400], [960, 1100], [1000, 1700]], side: -1, height: 64, run: 55, rock: 6 },
  { kind: 'dunes', id: 'erg', polygon: [[-470, 1150], [-140, 1150], [-140, 260], [-150, 120], [-130, -160], [-200, -480], [-500, -480]], height: 4.5, wavelength: 70, dir: [0.8, 0.6] },
  { kind: 'hill', id: 'kom', center: [-150, -58], radius: [95, 205], height: 5.5 },              // the town mound west of the temple (Tell Edfu)
  // ── spur between the Nile and Rome ──
  { kind: 'ridge', id: 'spur-south', points: [[-1900, -600], [-900, -590], [-450, -575], [-150, -565], [80, -555], [150, -550]], height: 58, width: 105, endTaper: [60, 150], rock: 6,
    passes: [{ at: -170, depth: 0.92, width: 75 }] },
  // ── Rome ──
  { kind: 'mesa', id: 'capitoline', center: [-250, -720], half: [85, 48], round: 22, top: 32, steep: 16, gentle: { dir: [0, -1], run: 85 }, rock: 3 },
  { kind: 'hill', id: 'quirinal', center: [-430, -1180], radius: [170, 120], height: 34 },
  { kind: 'hill', id: 'pincian', center: [-230, -1450], radius: [180, 80], height: 26 },
  { kind: 'hill', id: 'janiculum', center: [700, -1050], radius: [140, 300], height: 62 },
  // ── spur between Rome and Greece ──
  { kind: 'ridge', id: 'spur-north', points: [[-1900, -1650], [-800, -1640], [-300, -1620], [60, -1605], [150, -1600]], height: 70, width: 120, endTaper: [60, 150], rock: 7,
    passes: [{ at: -330, depth: 0.93, width: 80 }] },
  // ── Greece ──
  { kind: 'mesa', id: 'acropolis', center: [-180, -2100], half: [150, 70], round: 28, top: 40, steep: 22, gentle: { dir: [-1, 0], run: 190 }, rock: 3.5 },
  { kind: 'hill', id: 'areopagus', center: [-420, -2075], radius: [55, 35], height: 14 },
  { kind: 'hill', id: 'mouseion', center: [-360, -1890], radius: [120, 80], height: 28 },
  { kind: 'ridge', id: 'aigaleo', points: [[-1300, -1700], [-950, -1900], [-880, -2250], [-1000, -2600], [-1300, -2900]], height: 140, width: 260, rock: 10 },
  { kind: 'ridge', id: 'parnes', points: [[-1900, -2950], [-700, -2900], [0, -2880], [700, -2950]], height: 190, width: 300, rock: 12 },
  { kind: 'ridge', id: 'hymettus', points: [[650, -1750], [760, -2150], [720, -2600]], height: 150, width: 220, rock: 10 },
  // ── the world's rim ──
  { kind: 'ridge', id: 'west-uplands', points: [[-1500, 1800], [-1450, 400], [-1500, -1000], [-1550, -2400]], height: 120, width: 400, rock: 8 },
  { kind: 'dunes', id: 'south-erg', polygon: [[-600, 1150], [1100, 1150], [1100, 1900], [-600, 1900]], height: 9, wavelength: 110, dir: [0.7, 0.7] },
];

// ── height ───────────────────────────────────────────────────────────────────

function smooth(e0, e1, x) { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }

function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
export function fbm(x, z, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, z * f); f *= 2.03; a *= 0.5; }
  return s;
}

/** Distance from p to a polyline, the index of the nearest segment and the side (+1 right of travel). */
function polyDist(points, x, z) {
  let best = Infinity, side = 1, along = 0, acc = 0, total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i], [bx, bz] = points[i + 1];
    const vx = bx - ax, vz = bz - az, L = Math.hypot(vx, vz) || 1;
    let t = ((x - ax) * vx + (z - az) * vz) / (L * L);
    t = Math.max(0, Math.min(1, t));
    const px = ax + vx * t, pz = az + vz * t, d = Math.hypot(x - px, z - pz);
    if (d < best) {
      best = d;
      // right of travel (dir (vx, vz)) in plan seen from above with +z south is (−vz, vx)
      side = ((x - ax) * -vz + (z - az) * vx) >= 0 ? 1 : -1;
      along = acc + t * L;
    }
    acc += L;
  }
  total = acc;
  return { d: best, side, along, total };
}

function inPolygon(poly, x, z) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

/** Distance from (x, z) to the edge of a polygon (positive inside). */
function polyInside(poly, x, z) {
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j], [bx, bz] = poly[i];
    const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2));
    d = Math.min(d, Math.hypot(x - ax - vx * t, z - az - vz * t));
  }
  return inPolygon(poly, x, z) ? d : -d;
}

function mesaHeight(L, x, z) {
  const qx = Math.abs(x - L.center[0]) - L.half[0] + L.round, qz = Math.abs(z - L.center[1]) - L.half[1] + L.round;
  const d = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - L.round;
  if (d <= 0) return L.top;
  const dx = x - L.center[0], dz = z - L.center[1], len = Math.hypot(dx, dz) || 1;
  const g = L.gentle ? Math.max(0, (dx * L.gentle.dir[0] + dz * L.gentle.dir[1]) / len) : 0;
  const run = L.steep + (L.gentle ? (L.gentle.run - L.steep) * smooth(0.55, 0.9, g) : 0);
  if (d >= run) return 0;
  const t = d / run;
  return Math.max(0, L.top * (1 - smooth(0, 1, t)) + L.rock * fbm(x * 0.08, z * 0.08) * Math.sin(Math.PI * t) * (1 - g));
}

function landformHeight(L, x, z) {
  switch (L.kind) {
    case 'mesa': return mesaHeight(L, x, z);
    case 'hill': {
      const dx = (x - L.center[0]) / L.radius[0], dz = (z - L.center[1]) / L.radius[1];
      const r = Math.hypot(dx, dz);
      if (r >= 1.6) return 0;
      const n = 1 + 0.12 * fbm(x * 0.01, z * 0.01);
      return L.height * Math.exp(-r * r * 1.9) * n;
    }
    case 'ridge': {
      const q = polyDist(L.points, x, z);
      if (q.d > L.width * 1.8) return 0;
      const wob = 1 + 0.25 * fbm(x * 0.004 + 3, z * 0.004);
      const r = q.d / (L.width * wob);
      let h = L.height * Math.exp(-r * r * 2.2) * (1 + 0.18 * fbm(x * 0.012, z * 0.012));
      // the ridge falls toward the river at its east end
      if (L.endTaper) { const e = q.total - q.along; h *= smooth(L.endTaper[0], L.endTaper[1], e); }
      for (const p of L.passes || []) {
        const dxp = x - p.at;
        h *= 1 - p.depth * Math.exp(-(dxp * dxp) / (2 * (p.width / 2) * (p.width / 2)));
      }
      // broken rock on the steep flanks
      h += L.rock * fbm(x * 0.05, z * 0.05) * Math.exp(-r * r) * (h / L.height);
      return Math.max(0, h);
    }
    case 'escarpment': {
      const q = polyDist(L.points, x, z);
      const s = q.side === L.side ? q.d : -q.d;          // positive on the high side
      const wob = 18 * fbm(x * 0.006, z * 0.006);
      const t = (s + wob) / L.run;
      if (t <= -0.2) return 0;
      // a cliff: a talus foot, a steep face, a crisp lip; the plateau beyond rolls a little
      const face = smooth(0, 1, t * 1.1 + 0.05) ** 1.4;
      const plateau = L.height * (1 + 0.08 * fbm(x * 0.003, z * 0.003)) + (t > 1 ? 6 * fbm(x * 0.01, z * 0.01) : 0);
      return Math.max(0, plateau * face + L.rock * fbm(x * 0.06, z * 0.06) * Math.sin(Math.PI * Math.min(1, Math.max(0, t))));
    }
    case 'dunes': {
      const inside = polyInside(L.polygon, x, z);
      if (inside <= 0) return 0;
      const fade = smooth(0, 80, inside);
      const [dx, dz] = L.dir;
      const u = (x * dx + z * dz) / L.wavelength + 0.35 * fbm(x * 0.006, z * 0.006, 3) * 4;
      const ph = u - Math.floor(u);
      // asymmetric transverse dune: long stoss slope, short steep lee face
      const prof = ph < 0.78 ? Math.sin((ph / 0.78) * Math.PI / 2) : Math.cos(((ph - 0.78) / 0.22) * Math.PI / 2);
      const crest = 0.6 + 0.4 * fbm(x * 0.01 + 7, z * 0.01, 3);
      return L.height * fade * prof * crest;
    }
  }
  return 0;
}

/** Building pads: the ground is flattened to the site's base around each building. */
const PADS = [];
export function registerPad(rect, base, margin = 18, blend = 45) { PADS.push({ rect, base, margin, blend }); }

for (const site of Object.values(SITES)) {
  if (!site.pad || site.yaw) continue;
  const [x0, z0, x1, z1] = site.pad, [ox, oz] = site.origin;
  registerPad([ox + x0, oz + z0, ox + x1, oz + z1], site.base);
}

/** Height of the natural ground (before river and pads). */
function naturalHeight(x, z) {
  let h = 0, dune = 0;
  for (const L of LANDFORMS) {
    if (L.kind === 'dunes') dune = Math.max(dune, landformHeight(L, x, z));
    else h = Math.max(h, landformHeight(L, x, z));
  }
  // dunes lie on top of the flat ground and bank against the cliffs
  return h + dune * (1 - smooth(4, 30, h));
}

/** Height of the open ground at (x, z), with the river bed and building pads. */
export function terrainHeight(x, z) {
  let h = naturalHeight(x, z);
  for (const p of PADS) {
    const [x0, z0, x1, z1] = p.rect;
    const dx = Math.max(x0 - p.margin - x, 0, x - x1 - p.margin), dz = Math.max(z0 - p.margin - z, 0, z - z1 - p.margin);
    const d = Math.hypot(dx, dz);
    if (d < p.blend) h = p.base + (h - p.base) * smooth(0, 1, d / p.blend);
  }
  const R = WORLD.river, c = riverCenter(z);
  const e = Math.abs(x - c) - R.width / 2;               // > 0 outside the channel
  if (e < R.bank) {
    const t = smooth(-R.bank * 0.2, R.bank, e);
    h = -R.depth + (Math.max(h, 0.2) + R.depth) * t;
  }
  return h;
}

/** Is (x, z) in the river (water deeper than wading)? */
export function nearRoad(x, z, margin = 1.5) { return roadDistance(x, z).d < margin; }

export function inRiver(x, z) {
  return Math.abs(x - riverCenter(z)) < WORLD.river.width / 2 - 2;
}

// ── roads ────────────────────────────────────────────────────────────────────

/**
 * Roads and paths: beaten earth (or paving) along polylines, kept clear of plants. They join the
 * regions through the passes and lead each to its building's entrance.
 */
export const ROADS = [
  // Nile: the processional way from the quay to the pylon, and the road north to the pass
  { id: 'edfu-quay', width: 9, points: [[0, 30], [0, 110], [60, 150], [170, 160]], paved: 1 },
  { id: 'nile-north', width: 6, points: [[-55, 60], [-70, -150], [-120, -330], [-170, -470], [-170, -620]] },
  // Rome: from the southern pass round the rotunda to its forecourt, and on to the northern pass
  { id: 'rome-south', width: 7, points: [[-170, -620], [-130, -820], [-100, -1000], [-90, -1150], [-70, -1250], [-20, -1250]] },
  { id: 'rome-north', width: 7, points: [[-20, -1250], [-20, -1236], [-20, -1250], [-130, -1330], [-250, -1470], [-330, -1600], [-330, -1680]] },
  // Greece: across the plain to the foot of the Acropolis, up its west slope and along the top
  { id: 'greece-way', width: 7, points: [[-330, -1680], [-420, -1850], [-500, -2010], [-520, -2100], [-420, -2105], [-330, -2105], [-240, -2085], [-150, -2085], [-110, -2108]] },
];

function roadDistance(x, z) {
  let best = Infinity, road = null;
  for (const r of ROADS) {
    const q = polyDist(r.points, x, z);
    if (q.d - r.width / 2 < best) { best = q.d - r.width / 2; road = r; }
  }
  return { d: best, road };
}

// ── ground cover ─────────────────────────────────────────────────────────────

/**
 * Ground cover at (x, z) given the height and the surface normal's y component:
 * { sand, grass, rock, soil, fields, dry } — the first five sum to about 1; `dry` tints grass
 * from green (0) to straw (1); `fields` are cultivated plots.
 */
export function groundCover(x, z, h, ny) {
  const w = regionWeights(x, z);
  const acc = { sand: 0, grass: 0, rock: 0, soil: 0, fields: 0, dry: 0, warmth: 0, red: 0, road: 0 };
  const steep = smooth(0.86, 0.68, ny);
  REGIONS.forEach((r, i) => {
    if (w[i] < 1e-3) return;
    const g = GROUND[r.ground](x, z, h, steep);
    for (const k in acc) acc[k] += w[i] * (g[k] ?? 0);
  });
  // roads: beaten earth with worn edges
  const rd = roadDistance(x, z);
  if (rd.d < 2) {
    const m = 1 - smooth(-0.5, 2, rd.d + 0.6 * fbm(x * 0.3, z * 0.3));
    for (const k of ['sand', 'grass', 'rock', 'fields']) acc[k] *= 1 - m;
    acc.soil = acc.soil * (1 - m) + m;
    acc.road = m;
  }
  // the river banks are wet silt
  const e = Math.abs(x - riverCenter(z)) - WORLD.river.width / 2;
  if (e < WORLD.river.bank + 6) {
    const m = 1 - smooth(WORLD.river.bank * 0.4, WORLD.river.bank + 6, e);
    for (const k of ['sand', 'grass', 'rock', 'fields']) acc[k] *= 1 - m;
    acc.red *= 1 - m;
    acc.soil = acc.soil * (1 - m) + m;
  }
  return acc;
}

// warmth: the rock and silt of the region — 0 grey limestone and tufa, 1 buff sandstone;
// red: how red the soil is (the terra rossa of Attica)
const GROUND = {
  nile(x, z, h, steep) {
    const c = riverCenter(z);
    const fromRiver = Math.abs(x - c) - WORLD.river.width / 2;
    // the cultivated flood plain: a strip along each bank as far as the flood reached (low ground)
    const reach = 110 + 40 * fbm(x * 0.004, z * 0.004);
    const flood = (1 - smooth(reach - 20, reach + 25, fromRiver)) * (1 - smooth(1.5, 4, h));
    // the temple and the town are on the desert edge, not in the fields
    const nearTemple = 1 - smooth(70, 120, Math.hypot(x / 1.4, z / 2.2));
    const fields = flood * (1 - nearTemple);
    const rock = Math.max(steep, smooth(30, 60, h) * 0.6);
    const n = fbm(x * 0.02, z * 0.02);
    return { sand: Math.max(0, 1 - fields - rock) * (0.85 + 0.15 * n), soil: 0.08 + fields * 0.05, rock, fields, grass: flood * 0.15, dry: 0.4, warmth: 1, red: 0 };
  },
  rome(x, z, h, steep) {
    const n = fbm(x * 0.015, z * 0.015), m = fbm(x * 0.05 + 4, z * 0.05);
    const rock = steep * 0.8;
    const soil = Math.max(0, 0.18 + 0.25 * m) * (1 - rock);
    return { grass: Math.max(0, 1 - rock - soil), soil, rock, sand: 0, fields: 0, dry: 0.25 + 0.25 * n, warmth: 0.35, red: 0.1 };
  },
  greece(x, z, h, steep) {
    const n = fbm(x * 0.02, z * 0.02), m = fbm(x * 0.07 + 9, z * 0.07);
    const rock = Math.max(steep, smooth(0.15, 0.55, m) * 0.5 + smooth(25, 45, h) * 0.3);
    const soil = Math.max(0, 0.45 + 0.3 * n) * (1 - rock);
    return { grass: Math.max(0, 1 - rock - soil), soil, rock, sand: 0, fields: 0, dry: 0.75, warmth: 0.1, red: 0.85 };
  },
};
