// The regions of the world and its landscape (docs/world.md).
//
// The world is a patch of land that grows outward: each region is a cell of a grid (1600 m
// east–west by 1200 m north–south), the Nile in the middle and the others round it in a spiral
// in the order of their age, so that new regions are added on the outside. Ridges run along
// the cells' edges, crossed by passes; beyond the outermost cells rise mountains. A river runs
// north–south through each column of cells, through gorges in the ridges, crossed by bridges
// where the roads meet it.
//
// Everything here is pure data and pure functions, shared by the viewer (terrain meshes,
// ground, climate), the walker, the plan and walk checks and the light baker.
// Axes: +x east, +y up, +z south (north is −z). Metres.

// ── regions and their climates ───────────────────────────────────────────────

/**
 * Each region occupies a cell of the grid ([column, row], +x east, +z south) and has a river of its
 * own width (`phase` keeps each river's meander where the region's buildings expect it). Its climate fixes the
 * sun (time of day, so that light can be baked) and gives the sky, haze and a weather cycle.
 * Sun: azimuth in degrees from north, clockwise; elevation in degrees.
 */
export const REGIONS = [
  {
    id: 'nile', name: { en: 'The Nile', zh: '尼罗河' },
    cell: [0, 0], river: { width: 300, phase: 0 },
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
    cell: [0, -1], river: { width: 90, phase: -120 },
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
    cell: [1, -1], river: { width: 60, phase: 975 },
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
  {
    id: 'byzantium', name: { en: 'Byzantium', zh: '拜占庭' },
    cell: [1, 0], river: { width: 300, phase: 3350 },
    climate: {
      // a late autumn morning on the Bosphorus: the sun low in the south-east, sea air, often grey;
      // the poyraz blows from the north-east (Climate of Istanbul: cloudy, frequent light rain, fog)
      sun: { az: 142, el: 26, color: [1.0, 0.87, 0.72], intensity: 3.0 },
      sky: { turbidity: 3.8, rayleigh: 1.3, mie: 0.005, mieG: 0.8, zenith: [0.1, 0.14, 0.24], horizon: [0.3, 0.31, 0.32] },
      fog: { color: [0.58, 0.62, 0.66], density: 0.0005, height: 0.012 },
      exposure: 0.6,
      wind: [-0.6, 0.6],
      weather: [
        { id: 'fair', weight: 3, clouds: 0.35, cloudDensity: 0.5, sun: 1.0, fog: 1.0 },
        { id: 'cloudy', weight: 3, clouds: 0.66, cloudDensity: 0.6, sun: 0.7, fog: 1.4 },
        { id: 'overcast', weight: 2, clouds: 0.92, cloudDensity: 0.75, sun: 0.35, fog: 1.9 },
        { id: 'drizzle', weight: 1.5, clouds: 0.95, cloudDensity: 0.8, sun: 0.28, fog: 2.4, rain: 0.45 },
        { id: 'sea-mist', weight: 1, clouds: 0.5, cloudDensity: 0.4, sun: 0.55, fog: 5, fogColor: [0.7, 0.72, 0.74] },
        { id: 'poyraz', weight: 1.5, clouds: 0.5, cloudDensity: 0.55, sun: 0.85, fog: 0.8, windy: 1 },
      ],
    },
    ground: 'byzantium',
  },
  {
    id: 'levant', name: { en: 'The Levant', zh: '黎凡特' },
    cell: [1, 1], river: { width: 60, phase: 5750 },
    climate: {
      // a clear morning in the Judean hills: the sun in the east-south-east, dry bright air;
      // sometimes the hot dusty sharav, in winter a passing shower
      sun: { az: 112, el: 32, color: [1.0, 0.92, 0.8], intensity: 3.4 },
      sky: { turbidity: 2.6, rayleigh: 1.1, mie: 0.0035, mieG: 0.8, zenith: [0.09, 0.15, 0.29], horizon: [0.27, 0.28, 0.29] },
      fog: { color: [0.62, 0.6, 0.56], density: 0.00032, height: 0.01 },
      exposure: 0.52,
      wind: [0.4, 0.3],
      weather: [
        { id: 'clear', weight: 5, clouds: 0.08, cloudDensity: 0.35, sun: 1.0, fog: 1.0 },
        { id: 'fair', weight: 2.5, clouds: 0.3, cloudDensity: 0.45, sun: 0.95, fog: 1.0 },
        { id: 'sharav', weight: 1.5, clouds: 0.1, cloudDensity: 0.3, sun: 0.7, fog: 3.5, fogColor: [0.7, 0.6, 0.46] },
        { id: 'shower', weight: 1, clouds: 0.9, cloudDensity: 0.8, sun: 0.35, fog: 1.8, rain: 0.7 },
      ],
    },
    ground: 'levant',
  },
  {
    id: 'francia', name: { en: 'Francia', zh: '法兰西' },
    cell: [0, 1], river: { width: 90, phase: 6950 },
    climate: {
      // a summer afternoon on the Seine: the sun in the west-south-west, soft moist air, clouds
      // coming and going, now and then a shower
      sun: { az: 248, el: 34, color: [1.0, 0.9, 0.78], intensity: 3.1 },
      sky: { turbidity: 3.4, rayleigh: 1.25, mie: 0.0045, mieG: 0.8, zenith: [0.1, 0.15, 0.27], horizon: [0.28, 0.3, 0.32] },
      fog: { color: [0.58, 0.62, 0.67], density: 0.0005, height: 0.012 },
      exposure: 0.6,
      wind: [0.6, 0.3],
      weather: [
        { id: 'fair', weight: 3, clouds: 0.4, cloudDensity: 0.5, sun: 1.0, fog: 1.0 },
        { id: 'cloudy', weight: 3, clouds: 0.68, cloudDensity: 0.62, sun: 0.7, fog: 1.3 },
        { id: 'overcast', weight: 2, clouds: 0.92, cloudDensity: 0.75, sun: 0.35, fog: 1.8 },
        { id: 'shower', weight: 1.5, clouds: 0.94, cloudDensity: 0.85, sun: 0.3, fog: 2.2, rain: 0.8 },
      ],
    },
    ground: 'francia',
  },
  {
    id: 'tang', name: { en: 'Tang China', zh: '唐' },
    cell: [-1, 1], river: { width: 60, phase: 8150 },
    climate: {
      // late afternoon on Mount Wutai: the sun low in the west, on the hall's face; dry clear air
      // of the north, at times yellow with dust from the loess, now and then a shower
      sun: { az: 256, el: 21, color: [1.0, 0.82, 0.62], intensity: 3.2 },
      sky: { turbidity: 3.0, rayleigh: 1.2, mie: 0.004, mieG: 0.8, zenith: [0.09, 0.14, 0.27], horizon: [0.3, 0.28, 0.25] },
      fog: { color: [0.62, 0.57, 0.5], density: 0.0004, height: 0.01 },
      exposure: 0.56,
      wind: [0.5, -0.4],
      weather: [
        { id: 'clear', weight: 5, clouds: 0.1, cloudDensity: 0.35, sun: 1.0, fog: 1.0 },
        { id: 'fair', weight: 2.5, clouds: 0.35, cloudDensity: 0.5, sun: 0.95, fog: 1.0 },
        { id: 'loess-dust', weight: 1.5, clouds: 0.15, cloudDensity: 0.3, sun: 0.7, fog: 3.2, fogColor: [0.68, 0.58, 0.42] },
        { id: 'shower', weight: 1, clouds: 0.9, cloudDensity: 0.8, sun: 0.35, fog: 1.8, rain: 0.7 },
      ],
    },
    ground: 'tang',
  },
  {
    id: 'heian', name: { en: 'Heian Japan', zh: '平安日本' },
    cell: [-1, 0], river: { width: 110, phase: 8150 },
    climate: {
      // an autumn morning at Uji: the sun low in the east-south-east over the hills across the
      // river, on the Phoenix Hall's face; soft moist air, mist on the water, showers passing
      sun: { az: 112, el: 17, color: [1.0, 0.84, 0.66], intensity: 3.0 },
      sky: { turbidity: 3.6, rayleigh: 1.3, mie: 0.005, mieG: 0.8, zenith: [0.1, 0.15, 0.27], horizon: [0.3, 0.3, 0.31] },
      fog: { color: [0.6, 0.62, 0.64], density: 0.0005, height: 0.012 },
      exposure: 0.6,
      wind: [0.3, 0.3],
      weather: [
        { id: 'fair', weight: 3.5, clouds: 0.3, cloudDensity: 0.45, sun: 1.0, fog: 1.0 },
        { id: 'cloudy', weight: 2.5, clouds: 0.65, cloudDensity: 0.6, sun: 0.72, fog: 1.3 },
        { id: 'river-mist', weight: 2, clouds: 0.35, cloudDensity: 0.4, sun: 0.6, fog: 5, fogColor: [0.72, 0.73, 0.74] },
        { id: 'drizzle', weight: 1.5, clouds: 0.95, cloudDensity: 0.8, sun: 0.3, fog: 2.2, rain: 0.5 },
      ],
    },
    ground: 'heian',
  },
  {
    id: 'india', name: { en: 'India', zh: '印度' },
    cell: [-1, -1], river: { width: 100, phase: 8150 },
    climate: {
      // a winter afternoon in Malwa: the sun in the south-west, warm and dry, a dusty haze on the
      // plain; now and then high cloud, rarely a winter shower
      sun: { az: 228, el: 32, color: [1.0, 0.86, 0.68], intensity: 3.3 },
      sky: { turbidity: 4.0, rayleigh: 1.4, mie: 0.0048, mieG: 0.8, zenith: [0.1, 0.14, 0.25], horizon: [0.32, 0.29, 0.25] },
      fog: { color: [0.64, 0.58, 0.5], density: 0.00045, height: 0.01 },
      exposure: 0.56,
      wind: [-0.4, 0.2],
      weather: [
        { id: 'clear', weight: 4, clouds: 0.1, cloudDensity: 0.35, sun: 1.0, fog: 1.0 },
        { id: 'haze', weight: 3, clouds: 0.15, cloudDensity: 0.3, sun: 0.78, fog: 2.6, fogColor: [0.7, 0.62, 0.5] },
        { id: 'high-cloud', weight: 2, clouds: 0.4, cloudDensity: 0.35, sun: 0.9, fog: 1.1 },
        { id: 'shower', weight: 0.6, clouds: 0.9, cloudDensity: 0.8, sun: 0.35, fog: 1.8, rain: 0.6 },
      ],
    },
    ground: 'india',
  },
];

export const REGION = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

// ── the grid ─────────────────────────────────────────────────────────────────

/** The grid of regions: cell size [east–west, north–south], the centre of cell [0, 0]. */
export const GRID = { cell: [1600, 1200], origin: [100, 0] };
const [CW, CH] = GRID.cell;
const CELLS = new Map(REGIONS.map((r) => [r.cell[0] * 1000 + r.cell[1], r]));
const HAS = (gx, gz) => CELLS.has(gx * 1000 + gz);
const GX = [Math.min(...REGIONS.map((r) => r.cell[0])), Math.max(...REGIONS.map((r) => r.cell[0]))];
const GZ = [Math.min(...REGIONS.map((r) => r.cell[1])), Math.max(...REGIONS.map((r) => r.cell[1]))];
/** Centre of a cell. */
export function cellCenter(gx, gz) { return [GRID.origin[0] + gx * CW, GRID.origin[1] + gz * CH]; }
/** The cell [gx, gz] containing (x, z). */
export function cellAt(x, z) { return [Math.round((x - GRID.origin[0]) / CW), Math.round((z - GRID.origin[1]) / CH)]; }
/** The region whose cell is [gx, gz], if any. */
export function regionOfCell(gx, gz) { return CELLS.get(gx * 1000 + gz); }

/**
 * Weights of every region at (x, z): 1 inside its cell, blending across the edges (over `blend`
 * metres); an outer cell's weight runs on beyond the edge of the world. Sums to 1.
 */
const NB = REGIONS.map((r) => {
  const [gx, gz] = r.cell, [cx, cz] = cellCenter(gx, gz);
  return { cx, cz, e: HAS(gx + 1, gz), w: HAS(gx - 1, gz), s: HAS(gx, gz + 1), n: HAS(gx, gz - 1) };
});
export function regionWeights(x, z, blend = 160) {
  const side = (d, open) => (open ? smooth(0, 1, d / blend + 0.5) : 1);
  const w = NB.map((q) => {
    const wx = side(CW / 2 - (x - q.cx), q.e) * side(CW / 2 + (x - q.cx), q.w);
    if (wx === 0) return 0;
    return wx * side(CH / 2 - (z - q.cz), q.s) * side(CH / 2 + (z - q.cz), q.n);
  });
  const s = w.reduce((p, q) => p + q, 0);
  if (s > 1e-6) return w.map((v) => v / s);
  // beyond a corner of the grid: the nearest region
  let best = 0, bd = Infinity;
  REGIONS.forEach((r, i) => { const [cx, cz] = cellCenter(...r.cell); const d = Math.hypot((x - cx) / CW, (z - cz) / CH); if (d < bd) { bd = d; best = i; } });
  return w.map((_, i) => (i === best ? 1 : 0));
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

// ── the world's extent, the rivers and where each building stands ────────────

/** Walkable extent (the grid of cells); the mountains continue beyond it. */
export const WORLD = {
  bounds: [GRID.origin[0] + (GX[0] - 0.5) * CW + 60, GRID.origin[1] + (GZ[0] - 0.5) * CH + 60, GRID.origin[0] + (GX[1] + 0.5) * CW - 60, GRID.origin[1] + (GZ[1] + 0.5) * CH - 60],
  river: { bank: 24, depth: 3.4, water: -2.3 },
  far: 700,                                       // how far beyond the bounds the terrain is drawn
};

/** The rivers' meander: the west bank lies this far east of the column's line. */
function meander(z) { return 45 * Math.sin(z / 720 + 0.6) + 22 * Math.sin(z / 260 + 2.1); }

/**
 * The river of the column of cells containing x, at z: { c (centre line x), w (width) }. Each
 * region gives its river a width and a phase; between regions they blend. Its west bank keeps the
 * place the region's buildings were set out against.
 */
export function riverAt(x, z) {
  const gx = Math.max(GX[0], Math.min(GX[1], Math.round((x - GRID.origin[0]) / CW)));
  const colX = GRID.origin[0] + gx * CW;
  let s = 0, bank = 0, width = 0, near = null, nd = Infinity;
  for (const r of REGIONS) {
    if (r.cell[0] !== gx) continue;
    const cz = cellCenter(...r.cell)[1], gz = r.cell[1];
    const lo = HAS(gx, gz - 1) ? smooth(0, 1, (z - (cz - CH / 2)) / 160 + 0.5) : 1;
    const hi = HAS(gx, gz + 1) ? smooth(0, 1, ((cz + CH / 2) - z) / 160 + 0.5) : 1;
    const w = lo * hi;
    if (Math.abs(z - cz) < nd) { nd = Math.abs(z - cz); near = r; }
    if (w < 1e-4) continue;
    s += w; bank += w * (colX + 105 + meander(z - r.river.phase)); width += w * r.river.width;
  }
  if (!s) { s = 1; bank = colX + 105 + meander(z - near.river.phase); width = near.river.width; }
  const wd = width / s;
  return { c: bank / s + wd / 2, w: wd };
}

/** Where each building stands: origin [x, z], yaw (degrees), base height, region, and the
 *  rectangle (building-local) over which the ground is levelled to the base. */
export const SITES = {
  edfu: { origin: [0, 0], yaw: 0, base: 0, region: 'nile', pad: [-48, -140, 48, 32] },
  pantheon: { origin: [-20, -1200], yaw: 0, base: 0, region: 'rome', pad: [-48, -152, 48, 32] },
  parthenon: { origin: [1435, -1147], yaw: 0, base: 40, region: 'greece', pad: [-46, -26, 50, 26] },
  'hagia-sophia': { origin: [1540, 50], yaw: 0, base: 24, region: 'byzantium', pad: [-100, -42, 48, 100] },
  'dome-of-the-rock': { origin: [1450, 1200], yaw: 0, base: 30, region: 'levant', pad: [-150, -120, 150, 120] },
  'sainte-chapelle': { origin: [40, 1200], yaw: 0, base: 1.5, region: 'francia', pad: [-40, -32, 52, 46] },
  'foguang-east-hall': { origin: [-1860, 1200], yaw: 0, base: 8, region: 'tang', pad: [-118, -48, 34, 48] },
  'byodo-in-phoenix-hall': { origin: [-1480, -30], yaw: 0, base: 1.5, region: 'heian', pad: [-60, -78, 100, 78] },
  'sanchi-great-stupa': { origin: [-1750, -1200], yaw: 0, base: 40, region: 'india', pad: [-70, -72, 92, 72] },
};

/**
 * Garden ponds dug into a site's pad: a union of ellipses { c, r } in building-local coordinates
 * (the pad's frame) and the water level above the base. The ground is dug 1.2 m below the water
 * and rises to the shore over 5 m; the water cannot be waded (bridges cross it).
 */
export const PONDS = [
  // Aji-ike: in front of the Phoenix Hall and round both ends of its island
  { site: 'byodo-in-phoenix-hall', level: -0.35, shapes: [{ c: [46, -5], r: [30, 66] }, { c: [-8, -53], r: [36, 11] }, { c: [-8, 53], r: [36, 11] }, { c: [64, 26], r: [16, 20] }] },
];

/** Built-up quarters (towns), where the houses stand and no trees are planted. */
export const TOWNS = [
  { id: 'constantinople', region: 'byzantium', rects: [[1340, -120, 1660, -10], [1170, -5, 1415, 200], [1350, 160, 1675, 270], [1680, 20, 1790, 190]] },
  { id: 'jerusalem', region: 'levant', rects: [[1000, 1010, 1260, 1230], [1220, 890, 1540, 1020], [1160, 1050, 1270, 1140]] },
  { id: 'paris', region: 'francia', rects: [[-160, 1100, -50, 1250], [-120, 1260, 0, 1350], [-40, 1070, 120, 1135], [-300, 1310, -150, 1410]] },
  { id: 'tang-village', region: 'tang', rects: [[-2160, 1070, -2030, 1160], [-2160, 1230, -2030, 1310], [-2240, 1130, -2175, 1250]] },
  { id: 'uji', region: 'heian', rects: [[-1760, -270, -1620, -170], [-1780, 80, -1640, 160], [-1420, 160, -1360, 270]] },
  { id: 'sanchi-village', region: 'india', rects: [[-2060, -990, -1920, -890], [-1660, -960, -1540, -870], [-2120, -1270, -2020, -1150]] },
];
export function inTown(x, z) {
  for (const t of TOWNS) for (const r of t.rects) if (x > r[0] - 3 && x < r[2] + 3 && z > r[1] - 3 && z < r[3] + 3) return true;
  return false;
}

// ── landforms ────────────────────────────────────────────────────────────────

/**
 * Each landform belongs to a region and is felt only within its region's cell (and fades across
 * the edges with the region's weight).
 * kind 'mesa': a flat-topped rock with cliffs and one gentle side (rounded-rectangle top).
 * kind 'hill': a rounded hill (elliptical, smooth top).
 * kind 'ridge': a mountain ridge along a polyline, with optional passes (saddles) at an x
 *   (`at`) or a z (`z`).
 * kind 'escarpment': a cliff along a polyline with a plateau on its high side (`side` = ±1, the
 *   side of travel direction that is high: +1 = right of the polyline's direction).
 * kind 'dunes': a field of transverse dunes inside a polygon.
 */
export const LANDFORMS = [
  // ── the Nile: the desert escarpments either side of the valley, the dunes, the town mound ──
  { region: 'nile', kind: 'escarpment', id: 'western-desert', points: [[-640, 1700], [-560, 1150], [-500, 650], [-470, 150], [-520, -250], [-640, -560], [-700, -700]], side: -1, height: 72, run: 45, rock: 7 },
  { region: 'nile', kind: 'escarpment', id: 'eastern-desert', points: [[930, -640], [880, -200], [900, 400], [960, 1100], [1000, 1700]], side: -1, height: 64, run: 55, rock: 6 },
  { region: 'nile', kind: 'dunes', id: 'erg', polygon: [[-470, 1150], [-140, 1150], [-140, 260], [-150, 120], [-130, -160], [-200, -480], [-500, -480]], height: 4.5, wavelength: 70, dir: [0.8, 0.6] },
  { region: 'nile', kind: 'hill', id: 'kom', center: [-150, -58], radius: [95, 205], height: 5.5 },              // the town mound west of the temple (Tell Edfu)
  // ── Rome: the Capitoline, the Quirinal and Pincian, the Janiculum across the Tiber ──
  { region: 'rome', kind: 'mesa', id: 'capitoline', center: [-250, -840], half: [85, 48], round: 22, top: 32, steep: 16, gentle: { dir: [0, -1], run: 85 }, rock: 3 },
  { region: 'rome', kind: 'hill', id: 'quirinal', center: [-430, -1300], radius: [170, 120], height: 34 },
  { region: 'rome', kind: 'hill', id: 'pincian', center: [-230, -1570], radius: [180, 80], height: 26 },
  { region: 'rome', kind: 'hill', id: 'janiculum', center: [700, -1170], radius: [140, 300], height: 62 },
  // ── Greece: the Acropolis, the Areopagus, the Mouseion, Hymettus to the east ──
  { region: 'greece', kind: 'mesa', id: 'acropolis', center: [1420, -1125], half: [150, 70], round: 28, top: 40, steep: 22, gentle: { dir: [-1, 0], run: 190 }, rock: 3.5 },
  { region: 'greece', kind: 'hill', id: 'areopagus', center: [1180, -1100], radius: [55, 35], height: 14 },
  { region: 'greece', kind: 'hill', id: 'mouseion', center: [1240, -915], radius: [120, 80], height: 28 },
  { region: 'greece', kind: 'ridge', id: 'hymettus', points: [[2250, -775], [2360, -1175], [2320, -1625]], height: 150, width: 220, rock: 10 },
  // ── Byzantium: the hills of the city above the water; the Asian shore across it ──
  { region: 'byzantium', kind: 'mesa', id: 'first-hill', center: [1540, 60], half: [125, 92], round: 45, top: 24, steep: 75, gentle: { dir: [1, 0], run: 150 }, rock: 2 },
  { region: 'byzantium', kind: 'hill', id: 'second-hill', center: [1200, -80], radius: [170, 130], height: 30 },
  { region: 'byzantium', kind: 'hill', id: 'third-hill', center: [1250, 220], radius: [140, 115], height: 36 },
  { region: 'byzantium', kind: 'hill', id: 'asian-shore', center: [2400, 30], radius: [190, 420], height: 70 },
  // ── the Levant: Mount Moriah with the Haram, the Mount of Olives, the western hill, Bezetha, Moab ──
  { region: 'levant', kind: 'mesa', id: 'moriah', center: [1450, 1200], half: [175, 140], round: 30, top: 30, steep: 26, gentle: { dir: [0, 1], run: 140 }, rock: 3 },
  { region: 'levant', kind: 'hill', id: 'olives', center: [1720, 1230], radius: [110, 300], height: 58 },
  { region: 'levant', kind: 'hill', id: 'western-hill', center: [1100, 1110], radius: [200, 170], height: 46 },
  { region: 'levant', kind: 'hill', id: 'bezetha', center: [1300, 920], radius: [180, 110], height: 34 },
  { region: 'levant', kind: 'ridge', id: 'moab', points: [[2220, 1750], [2300, 1150], [2240, 450]], height: 160, width: 260, rock: 10 },
  // ── Francia: the Seine's plain, Montmartre to the north, Sainte-Geneviève to the south, Chaillot ──
  { region: 'francia', kind: 'hill', id: 'montmartre', center: [-330, 870], radius: [170, 130], height: 62 },
  { region: 'francia', kind: 'hill', id: 'sainte-genevieve', center: [-260, 1480], radius: [190, 130], height: 30 },
  { region: 'francia', kind: 'hill', id: 'chaillot', center: [-650, 1150], radius: [160, 220], height: 40 },
  { region: 'francia', kind: 'ridge', id: 'east-francia', points: [[700, 1750], [760, 1150], [720, 550]], height: 70, width: 260, rock: 4, passes: [{ z: 1380, depth: 0.85, width: 120 }] },
  // ── Tang China: Foguang Mountain behind the monastery, loess hills, the hills across the river ──
  { region: 'tang', kind: 'hill', id: 'foguang-shan', center: [-1710, 1200], radius: [200, 320], height: 58 },
  { region: 'tang', kind: 'hill', id: 'loess-west', center: [-2240, 1350], radius: [220, 180], height: 55 },
  { region: 'tang', kind: 'hill', id: 'loess-north', center: [-2120, 900], radius: [240, 160], height: 48 },
  { region: 'tang', kind: 'ridge', id: 'east-tang', points: [[-950, 1650], [-860, 1150], [-900, 550]], height: 110, width: 260, rock: 8, passes: [{ z: 1420, depth: 0.9, width: 120 }] },
  // ── Heian Japan: the wooded hills west of Uji, Mount Asahi across the river ──
  { region: 'heian', kind: 'hill', id: 'uji-west', center: [-1930, -80], radius: [210, 330], height: 62 },
  { region: 'heian', kind: 'hill', id: 'daikichi', center: [-1720, -410], radius: [180, 130], height: 40 },
  { region: 'heian', kind: 'hill', id: 'asahi', center: [-880, 0], radius: [170, 320], height: 95 },
  // ── India: the flat-topped hill of Sanchi on the plain of Malwa, Udayagiri, Nagauri ──
  { region: 'india', kind: 'mesa', id: 'sanchi-hill', center: [-1750, -1200], half: [150, 125], round: 45, top: 40, steep: 34, gentle: { dir: [0, 1], run: 170 }, rock: 4 },
  { region: 'india', kind: 'hill', id: 'udayagiri', center: [-2160, -1050], radius: [130, 90], height: 34 },
  { region: 'india', kind: 'hill', id: 'nagauri', center: [-2020, -1500], radius: [180, 120], height: 42 },
  { region: 'india', kind: 'ridge', id: 'east-india', points: [[-950, -750], [-860, -1250], [-900, -1850]], height: 110, width: 260, rock: 8 },
];

/**
 * The ridges along the cells' edges: their height and half-width; the passes across them, where
 * the roads cross from one region to the next (and a few more); the mountains beyond the world.
 */
const EDGE = { height: 150, width: 120, rim: 230 };
export const PASSES = [
  [-170, -600],          // the Nile — Rome
  [900, -1550],          // Rome — Greece
  [1150, -600],          // Greece — Byzantium
  [1220, 600],           // Byzantium — the Levant
  [900, 1400],           // the Levant — Francia
  [-700, 1400],          // Francia — Tang China
  [-2080, 600],          // Tang China — Heian Japan
  [-1800, -600],         // Heian Japan — India
  [900, -150], [-300, 600], [-700, 150], [-700, -1250], [2250, -600], [-2250, -600],          // more ways across, without roads
];

// ── height ───────────────────────────────────────────────────────────────────

function smooth(e0, e1, x) { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }

function hash2(x, z) { let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
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
      // the Gaussian falls to zero exactly at the edge (no step where it is cut off)
      return L.height * Math.max(0, (Math.exp(-r * r * 1.9) - 0.0077) / 0.9923) * n;
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
        const dxp = p.z !== undefined ? z - p.z : x - p.at;
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

/** Bounding rectangle beyond which a landform adds nothing (escarpments: none). */
function landformBox(L) {
  const pts = L.points || L.polygon || [L.center];
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  const m = L.kind === 'hill' ? Math.max(...L.radius) * 1.6 : L.kind === 'mesa' ? Math.max(...L.half) + Math.max(L.steep, L.gentle?.run || 0) + 4
    : L.kind === 'ridge' ? L.width * 1.8 * 1.3 : L.kind === 'dunes' ? 0 : Infinity;
  return [Math.min(...xs) - m, Math.min(...zs) - m, Math.max(...xs) + m, Math.max(...zs) + m];
}
const BY_REGION = new Map(REGIONS.map((r) => [r.id, []]));
for (const L of LANDFORMS) { L.box = landformBox(L); BY_REGION.get(L.region).push(L); }

/** Height of one region's own landforms at (x, z). */
function regionHeight(r, x, z) {
  let h = 0, dune = 0;
  for (const L of BY_REGION.get(r.id)) {
    const b = L.box;
    if (x < b[0] || x > b[2] || z < b[1] || z > b[3]) continue;
    if (L.kind === 'dunes') dune = Math.max(dune, landformHeight(L, x, z));
    else h = Math.max(h, landformHeight(L, x, z));
  }
  // dunes lie on top of the flat ground and bank against the cliffs
  return h + dune * (1 - smooth(4, 30, h));
}

/**
 * The ridges along the cells' edges and the mountains beyond the outermost cells. An edge between
 * two regions is a ridge with passes; an edge at the world's end rises higher, into mountains.
 * The rivers pass the ridges that cross them through gorges.
 */
function edgeHeight(x, z, river) {
  const [gx, gz] = cellAt(x, z), [cx, cz] = cellCenter(gx, gz);
  const lx = x - cx, lz = z - cz, inside = HAS(gx, gz);
  // far from every edge inside a cell there is nothing to add
  if (inside && Math.min(CW / 2 - Math.abs(lx), CH / 2 - Math.abs(lz)) > EDGE.width * 3.2) return 0;
  const n = 1 + 0.18 * fbm(x * 0.012, z * 0.012), rock = 9 * fbm(x * 0.05, z * 0.05);
  // a mountain ridge, not a wall: its height and breadth wander along it, spurs run off its
  // flanks, its crest is broken
  const spur = 1 + 0.35 * fbm(x * 0.009 + 11, z * 0.009);
  const crest = 1 + 0.3 * (1 - 2 * Math.abs(fbm(x * 0.007 + 5, z * 0.007 + 2)));
  const ridge = (d, along, H) => {
    const hv = H * (0.6 + 0.65 * (0.5 + 0.5 * fbm(along * 0.0024 + 17, H * 0.01)));
    const w = EDGE.width * (0.8 + 0.7 * (0.5 + 0.5 * fbm(along * 0.003 + 29, 3)));
    return hv * Math.exp(-((d * spur / w) ** 2) * 2.2) * crest;
  };
  const gorge = smooth(70, 260, Math.abs(x - river.c));
  if (!inside) {
    // beyond the world: mountains rising away from the nearest cell
    let D = Infinity;
    for (const r of REGIONS) {
      const [qx, qz] = cellCenter(...r.cell);
      D = Math.min(D, Math.hypot(Math.max(Math.abs(x - qx) - CW / 2, 0), Math.max(Math.abs(z - qz) - CH / 2, 0)));
    }
    const h = EDGE.rim * (1 + 0.25 * smooth(0, 500, D) + D / 1600) * n * (0.85 + 0.35 * fbm(x * 0.003 + 7, z * 0.003)) * crest + rock * 1.4;
    // a river leaving the world north or south keeps its gorge
    const alongCol = Math.abs(lx) < CW / 2 && gx >= GX[0] && gx <= GX[1];
    return Math.max(0, alongCol ? h * Math.max(gorge, smooth(0, 900, D) * 0.6) : h);
  }
  let h = 0, pass = 0;
  // the east–west edges (ridges running north–south)
  {
    const s = Math.sign(lx) || 1, d = CW / 2 - Math.abs(lx), other = HAS(gx + s, gz);
    const ex = cx + s * CW / 2;
    let e = ridge(d, z, other ? EDGE.height : EDGE.rim) * n;
    if (other) for (const [px, pz] of PASSES) if (Math.abs(px - ex) < 1) { const p = Math.exp(-((z - pz) ** 2) / 9800); e *= 1 - 0.93 * p; pass = Math.max(pass, p); }
    h = Math.max(h, e);
  }
  // the north–south edges (ridges running east–west), cut by the river's gorge
  {
    const s = Math.sign(lz) || 1, d = CH / 2 - Math.abs(lz), other = HAS(gx, gz + s);
    const ez = cz + s * CH / 2;
    let e = ridge(d, x, other ? EDGE.height : EDGE.rim) * n * gorge;
    if (other) for (const [px, pz] of PASSES) if (Math.abs(pz - ez) < 1) { const p = Math.exp(-((x - px) ** 2) / 9800); e *= 1 - 0.93 * p; pass = Math.max(pass, p); }
    h = Math.max(h, e);
  }
  // the saddle of a pass is smooth ground, not broken rock
  return Math.max(0, h + rock * (h / EDGE.height) * 1.2 * (1 - pass));
}

/** Building pads: the ground is flattened to the site's base around each building. */
const PADS = [];
export function registerPad(rect, base, margin = 18, blend = 45) { PADS.push({ rect, base, margin, blend }); }

for (const site of Object.values(SITES)) {
  if (!site.pad || site.yaw) continue;
  const [x0, z0, x1, z1] = site.pad, [ox, oz] = site.origin;
  registerPad([ox + x0, oz + z0, ox + x1, oz + z1], site.base);
}
const POND_SHAPES = [];
for (const p of PONDS) {
  const s = SITES[p.site], [ox, oz] = s.origin;
  for (const { c, r } of p.shapes) POND_SHAPES.push({ c: [ox + c[0], oz + c[1]], r, y: s.base + p.level });
}
/** Signed distance (m, approximate) from the shore of the nearest pond: negative in the water. */
function pondDistance(x, z) {
  let best = Infinity, y = 0;
  for (const P of POND_SHAPES) {
    const dx = (x - P.c[0]) / P.r[0], dz = (z - P.c[1]) / P.r[1];
    const d = (Math.hypot(dx, dz) - 1) * Math.min(P.r[0], P.r[1]);
    if (d < best) { best = d; y = P.y; }
  }
  return { d: best, y };
}
/** Is (x, z) in a garden pond, below its surface (y: the walker's feet, if on a bridge above)? */
export function inPond(x, z, y = -Infinity) {
  if (!POND_SHAPES.length) return false;
  const p = pondDistance(x, z);
  return p.d < -1.2 && y < p.y + 0.3;
}
/** Water that cannot be waded: the rivers and the ponds (y: the walker's feet). */
export function inWater(x, z, y) { return inRiver(x, z, y) || inPond(x, z, y); }

/** Height of the natural ground (before rivers and pads): the regions' landforms and the edges. */
function naturalHeight(x, z, river = riverAt(x, z)) {
  const W = regionWeights(x, z);
  let h = 0;
  for (let i = 0; i < W.length; i++) if (W[i] > 1e-3) h += W[i] * regionHeight(REGIONS[i], x, z);
  return Math.max(h, edgeHeight(x, z, river));
}

/** Height of the open ground at (x, z), with the river bed and building pads. */
export function terrainHeight(x, z) {
  const r = riverAt(x, z);
  let h = naturalHeight(x, z, r);
  for (const p of PADS) {
    const [x0, z0, x1, z1] = p.rect;
    const dx = Math.max(x0 - p.margin - x, 0, x - x1 - p.margin), dz = Math.max(z0 - p.margin - z, 0, z - z1 - p.margin);
    if (dx > p.blend || dz > p.blend) continue;
    const d = Math.hypot(dx, dz);
    // just below the base inside the pad, so that paving laid at the base never fights the ground
    if (d < p.blend) h = p.base - 0.12 * (1 - smooth(0, 1, d / 6)) + (h - p.base) * smooth(0, 1, d / p.blend);
  }
  if (POND_SHAPES.length) {
    const p = pondDistance(x, z);
    if (p.d < 5) { const bed = p.y - 1.2; h = bed + (Math.max(h, bed) - bed) * smooth(-1, 5, p.d); }
  }
  const R = WORLD.river;
  const e = Math.abs(x - r.c) - r.w / 2;               // > 0 outside the channel
  if (e < R.bank) {
    const t = smooth(-R.bank * 0.2, R.bank, e);
    h = -R.depth + (Math.max(h, 0.2) + R.depth) * t;
  }
  return h;
}

/** Is (x, z) in a river (water deeper than wading)? On a bridge (y above the water) it is not. */
export function inRiver(x, z, y = -Infinity) {
  const r = riverAt(x, z);
  if (Math.abs(x - r.c) >= r.w / 2 - 2) return false;
  if (y > WORLD.river.water + 0.5 && onBridge(x, z)) return false;
  return true;
}

// ── roads and bridges ────────────────────────────────────────────────────────

/**
 * Roads and paths: beaten earth (or paving) along polylines, kept clear of plants. They join the
 * regions in the order of the spiral, through the passes, and lead each to its building's
 * entrance. Where a road meets a river its crossing runs due east–west, and a bridge carries it.
 */
export const ROADS = [
  // the Nile: the processional way from the quay to the pylon
  { id: 'edfu-quay', width: 9, points: [[0, 30], [0, 110], [60, 150], [170, 160]], paved: 1 },
  // the Nile to Rome: north over the pass, past the Capitoline to the Pantheon's forecourt
  { id: 'nile-rome', width: 7, points: [[-55, 60], [-70, -150], [-120, -330], [-170, -470], [-170, -600], [-170, -720], [-140, -760], [-125, -800], [-115, -900], [-100, -1120], [-90, -1270], [-70, -1370], [-20, -1370]] },
  // Rome to Greece: east over the Tiber and the pass, up the Acropolis' west slope
  { id: 'rome-greece', width: 7, points: [[-20, -1370], [60, -1430], [120, -1500], [440, -1500], [600, -1550], [750, -1550], [900, -1550], [1050, -1550], [1100, -1450], [1080, -1250], [1080, -1125], [1180, -1130], [1270, -1130], [1360, -1110], [1450, -1110], [1490, -1133]] },
  // Greece to Byzantium: south over the pass and round the second hill to Hagia Sophia's atrium
  { id: 'greece-byzantium', width: 7, points: [[1080, -1125], [1110, -880], [1150, -750], [1150, -600], [1150, -450], [1180, -330], [1300, -130], [1380, -20], [1400, 50], [1436, 50]] },
  { id: 'harbour', width: 6, points: [[1570, 135], [1660, 135], [1760, 105], [1820, 94]], paved: 1 },
  // Byzantium to the Levant: south past the third hill, over the pass, to the Haram's west stairs
  { id: 'byzantium-levant', width: 7, points: [[1436, 50], [1400, 50], [1340, 145], [1270, 234], [1220, 450], [1220, 600], [1220, 750], [1270, 1050], [1310, 1200]] },
  // the Levant to Francia: west over the pass and the hills, over the Seine to the palace
  { id: 'levant-francia', width: 7, points: [[1310, 1200], [1250, 1350], [1100, 1420], [900, 1400], [740, 1380], [600, 1360], [460, 1340], [120, 1340], [60, 1280], [0, 1215], [-20, 1215]] },
  // Francia to Tang China: west over the pass, the ridge and the river, round Foguang Mountain to the gate
  { id: 'francia-tang', width: 6, points: [[-20, 1215], [-250, 1330], [-500, 1420], [-700, 1400], [-900, 1420], [-1060, 1440], [-1500, 1440], [-1620, 1560], [-1820, 1640], [-1980, 1520], [-2030, 1350], [-2030, 1250], [-2000, 1200], [-1980, 1200]] },
  // Tang China to Heian Japan: north over the pass of Wutai to the south shore of the pond
  { id: 'tang-heian', width: 6, points: [[-2030, 1250], [-2070, 1000], [-2085, 740], [-2080, 600], [-2080, 460], [-2020, 300], [-1860, 120], [-1660, 50], [-1540, 40], [-1500, 38]] },
  // Heian Japan to India: north over the pass of Hira, across the plain and up to the south gateway
  { id: 'heian-india', width: 6, points: [[-1660, 50], [-1590, -150], [-1580, -410], [-1700, -470], [-1800, -470], [-1800, -600], [-1800, -730], [-1810, -850], [-1770, -970], [-1750, -1070], [-1750, -1168]] },
];

const ROAD_BOX = ROADS.map((r) => {
  const xs = r.points.map((p) => p[0]), zs = r.points.map((p) => p[1]), m = r.width / 2 + 12;
  return [Math.min(...xs) - m, Math.min(...zs) - m, Math.max(...xs) + m, Math.max(...zs) + m];
});

function roadDistance(x, z) {
  let best = Infinity, road = null;
  for (let i = 0; i < ROADS.length; i++) {
    const b = ROAD_BOX[i];
    if (x < b[0] || x > b[2] || z < b[1] || z > b[3]) continue;
    const r = ROADS[i], q = polyDist(r.points, x, z);
    if (q.d - r.width / 2 < best) { best = q.d - r.width / 2; road = r; }
  }
  return { d: best, road };
}
export function nearRoad(x, z, margin = 1.5) { return roadDistance(x, z).d < margin; }

/**
 * Bridges where the roads cross the rivers, found from the roads: { rect [x0, z0, x1, z1] of the
 * deck, y (deck level), ramps: [[rect, y0, y1, dir]] }. A crossing runs east–west.
 */
export const BRIDGES = [];
for (const road of ROADS) {
  for (let i = 0; i < road.points.length - 1; i++) {
    const [ax, az] = road.points[i], [bx, bz] = road.points[i + 1];
    if (Math.abs(az - bz) > 0.01) continue;
    const r = riverAt((ax + bx) / 2, az), half = r.w / 2 + WORLD.river.bank;
    const x0 = r.c - half, x1 = r.c + half;
    if (Math.min(ax, bx) > x0 || Math.max(ax, bx) < x1) continue;
    const ya = naturalHeight(x0 - 2, az), yb = naturalHeight(x1 + 2, az);
    const y = Math.max(ya, yb, 0.5) + 1.2, w = road.width / 2 + 0.6;
    BRIDGES.push({
      road: road.id, rect: [x0, az - w, x1, az + w], y,
      ramps: [[[x0 - 12, az - w, x0, az + w], ya, y, 'e'], [[x1, az - w, x1 + 12, az + w], yb, y, 'w']],
    });
  }
}
export function onBridge(x, z) {
  for (const b of BRIDGES) { const r = b.rect; if (x > r[0] - 12 && x < r[2] + 12 && z > r[1] - 0.5 && z < r[3] + 0.5) return true; }
  return false;
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
  // high ground: the edges' ridges and the mountains beyond are bare rock above the grass
  const high = smooth(70, 140, h) * 0.7;
  if (high > 0) { for (const k of ['sand', 'grass', 'soil', 'fields']) acc[k] *= 1 - high; acc.rock += high; }
  // roads: beaten earth with worn edges
  const rd = roadDistance(x, z);
  if (rd.d < 2) {
    const m = 1 - smooth(-0.5, 2, rd.d + 0.6 * fbm(x * 0.3, z * 0.3));
    for (const k of ['sand', 'grass', 'rock', 'fields']) acc[k] *= 1 - m;
    acc.soil = acc.soil * (1 - m) + m;
    acc.road = m;
  }
  // the river banks are wet silt
  const r = riverAt(x, z), e = Math.abs(x - r.c) - r.w / 2;
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
    const r = riverAt(x, z);
    const fromRiver = Math.abs(x - r.c) - r.w / 2;
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
  byzantium(x, z, h, steep) {
    const n = fbm(x * 0.015 + 3, z * 0.015), m = fbm(x * 0.05 + 2, z * 0.05);
    const rock = steep * 0.75;
    // gardens and vineyards on the low ground outside the city
    const fields = (1 - smooth(4, 12, h)) * smooth(0.0, 0.35, fbm(x * 0.006 + 5, z * 0.006)) * 0.8 * (1 - rock);
    const soil = Math.max(0, 0.15 + 0.25 * m) * (1 - rock - fields);
    return { grass: Math.max(0, 1 - rock - soil - fields), soil, rock, sand: 0, fields, dry: 0.18 + 0.2 * n, warmth: 0.25, red: 0.15 };
  },
  levant(x, z, h, steep) {
    const n = fbm(x * 0.02 + 5, z * 0.02), m = fbm(x * 0.06 + 1, z * 0.06);
    // limestone breaks through everywhere on the slopes; red earth and dry grass between
    const rock = Math.max(steep, smooth(0.05, 0.5, m) * 0.55 + smooth(20, 60, h) * 0.2);
    const soil = Math.max(0, 0.4 + 0.3 * n) * (1 - rock);
    return { grass: Math.max(0, 1 - rock - soil), soil, rock, sand: 0, fields: 0, dry: 0.8, warmth: 0.45, red: 0.55 };
  },
  francia(x, z, h, steep) {
    const n = fbm(x * 0.012 + 8, z * 0.012), m = fbm(x * 0.05 + 3, z * 0.05);
    const rock = steep * 0.5;
    // fields in strips on the plain, meadows by the river, vineyards and orchards on the slopes
    const fields = (1 - smooth(6, 16, h)) * smooth(-0.05, 0.3, fbm(x * 0.005 + 1, z * 0.005)) * 0.85 * (1 - rock);
    const soil = Math.max(0, 0.1 + 0.2 * m) * (1 - rock - fields);
    return { grass: Math.max(0, 1 - rock - soil - fields), soil, rock, sand: 0, fields, dry: 0.08 + 0.15 * n, warmth: 0.5, red: 0.05 };
  },
  tang(x, z, h, steep) {
    const n = fbm(x * 0.015 + 2, z * 0.015), m = fbm(x * 0.05 + 7, z * 0.05);
    const rock = Math.max(steep * 0.6, smooth(60, 110, h) * 0.5);
    // loess: terraced fields on the gentle slopes and in the valley, bare yellow earth where steep
    const fields = (1 - steep) * smooth(-0.1, 0.25, fbm(x * 0.006 + 4, z * 0.006)) * 0.75 * (1 - smooth(45, 70, h));
    const sand = Math.max(0, 0.25 + 0.3 * m) * (1 - rock - fields);
    return { sand, grass: Math.max(0, 1 - rock - fields - sand) * 0.8, soil: Math.max(0, 1 - rock - fields - sand) * 0.2, rock, fields, dry: 0.55 + 0.2 * n, warmth: 0.8, red: 0.1 };
  },
  heian(x, z, h, steep) {
    const n = fbm(x * 0.013 + 6, z * 0.013), m = fbm(x * 0.05 + 5, z * 0.05);
    const rock = steep * 0.45;
    // rice fields on the plain (stubble after the harvest), moss and grass under the woods
    const fields = (1 - smooth(4, 10, h)) * smooth(-0.05, 0.3, fbm(x * 0.005 + 7, z * 0.005)) * 0.85 * (1 - rock);
    const soil = Math.max(0, 0.08 + 0.2 * m) * (1 - rock - fields);
    return { grass: Math.max(0, 1 - rock - soil - fields), soil, rock, sand: 0, fields, dry: 0.2 + 0.2 * n, warmth: 0.3, red: 0.05 };
  },
  india(x, z, h, steep) {
    const n = fbm(x * 0.014 + 1, z * 0.014), m = fbm(x * 0.05 + 8, z * 0.05);
    // red-brown soil and dry grass, sandstone breaking out on the hills, fields of wheat and gram
    // on the plain
    const rock = Math.max(steep * 0.8, smooth(25, 45, h) * smooth(0.0, 0.4, m) * 0.4);
    const fields = (1 - smooth(3, 9, h)) * smooth(-0.05, 0.3, fbm(x * 0.005 + 2, z * 0.005)) * 0.8 * (1 - rock);
    const soil = Math.max(0, 0.35 + 0.25 * n) * (1 - rock - fields);
    return { grass: Math.max(0, 1 - rock - soil - fields), soil, rock, sand: 0, fields, dry: 0.7, warmth: 0.75, red: 0.45 };
  },
  greece(x, z, h, steep) {
    const n = fbm(x * 0.02, z * 0.02), m = fbm(x * 0.07 + 9, z * 0.07);
    const rock = Math.max(steep, smooth(0.15, 0.55, m) * 0.5 + smooth(25, 45, h) * 0.3);
    const soil = Math.max(0, 0.45 + 0.3 * n) * (1 - rock);
    return { grass: Math.max(0, 1 - rock - soil), soil, rock, sand: 0, fields: 0, dry: 0.75, warmth: 0.1, red: 0.85 };
  },
};
