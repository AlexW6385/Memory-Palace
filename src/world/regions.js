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
  {
    id: 'byzantium', name: { en: 'Byzantium', zh: '拜占庭' },
    z: [-3950, -2750], center: [-120, -3300],
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
    z: [-5150, -3950], center: [-160, -4560],
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
    z: [-6350, -5150], center: [-60, -5750],
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
    z: [-7550, -6350], center: [-260, -6950],
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
    z: [-8750, -7550], center: [60, -8180],
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
  bounds: [-1150, -8680, 1050, 1180],
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
  'hagia-sophia': { origin: [-60, -3300], yaw: 0, base: 24, region: 'byzantium', pad: [-100, -42, 48, 100] },
  'dome-of-the-rock': { origin: [-150, -4550], yaw: 0, base: 30, region: 'levant', pad: [-150, -120, 150, 120] },
  'sainte-chapelle': { origin: [40, -5750], yaw: 0, base: 1.5, region: 'francia', pad: [-40, -32, 52, 46] },
  'foguang-east-hall': { origin: [-260, -6950], yaw: 0, base: 8, region: 'tang', pad: [-118, -48, 34, 48] },
  'byodo-in-phoenix-hall': { origin: [120, -8180], yaw: 0, base: 1.5, region: 'heian', pad: [-60, -78, 100, 78] },
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
  { id: 'constantinople', region: 'byzantium', rects: [[-260, -3470, 60, -3360], [-430, -3355, -185, -3150], [-250, -3190, 75, -3080], [80, -3330, 190, -3160]] },
  { id: 'uji', region: 'heian', rects: [[-160, -8420, -20, -8320], [-180, -8070, -40, -7990], [180, -7990, 240, -7880]] },
  { id: 'tang-village', region: 'tang', rects: [[-560, -7080, -430, -6990], [-560, -6920, -430, -6840], [-640, -7020, -575, -6900]] },
  { id: 'paris', region: 'francia', rects: [[-160, -5850, -50, -5700], [-120, -5690, 0, -5600], [-40, -5880, 120, -5815], [-300, -5640, -150, -5540]] },
  { id: 'jerusalem', region: 'levant', rects: [[-600, -4740, -340, -4520], [-380, -4860, -60, -4730], [-440, -4700, -330, -4610]] },
];
export function inTown(x, z) {
  for (const t of TOWNS) for (const r of t.rects) if (x > r[0] - 3 && x < r[2] + 3 && z > r[1] - 3 && z < r[3] + 3) return true;
  return false;
}

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
  // ── Parnes: the spur between Greece and Byzantium ──
  { kind: 'ridge', id: 'parnes', points: [[-1900, -2950], [-700, -2900], [-250, -2880], [60, -2860], [150, -2855]], height: 190, width: 300, endTaper: [80, 220], rock: 12,
    passes: [{ at: -420, depth: 0.94, width: 95 }] },
  { kind: 'ridge', id: 'hymettus', points: [[650, -1750], [760, -2150], [720, -2600]], height: 150, width: 220, rock: 10 },
  { kind: 'ridge', id: 'east-parnes', points: [[640, -2860], [900, -2900], [1500, -2950]], height: 160, width: 260, rock: 10 },
  // ── Byzantium: hills of the city above the water; the Asian shore across it ──
  { kind: 'mesa', id: 'first-hill', center: [-60, -3290], half: [125, 92], round: 45, top: 24, steep: 75, gentle: { dir: [1, 0], run: 150 }, rock: 2 },
  { kind: 'hill', id: 'second-hill', center: [-400, -3430], radius: [170, 130], height: 30 },
  { kind: 'hill', id: 'third-hill', center: [-350, -3130], radius: [140, 115], height: 36 },
  { kind: 'hill', id: 'asian-shore', center: [800, -3320], radius: [190, 420], height: 70 },
  // ── the spur between Byzantium and the Levant ──
  { kind: 'ridge', id: 'thrace', points: [[-1900, -4060], [-600, -4010], [0, -3995], [150, -3990]], height: 150, width: 300, endTaper: [80, 220], rock: 9,
    passes: [{ at: -300, depth: 0.93, width: 95 }] },
  { kind: 'ridge', id: 'east-thrace', points: [[640, -4000], [900, -4060], [1500, -4100]], height: 140, width: 260, rock: 9 },
  // ── the Levant: Mount Moriah with the Haram, the Kidron valley, the Mount of Olives, the western hill ──
  { kind: 'mesa', id: 'moriah', center: [-150, -4550], half: [175, 140], round: 30, top: 30, steep: 26, gentle: { dir: [0, 1], run: 140 }, rock: 3 },
  { kind: 'hill', id: 'olives', center: [120, -4520], radius: [110, 300], height: 58 },
  { kind: 'hill', id: 'western-hill', center: [-500, -4640], radius: [200, 170], height: 46 },
  { kind: 'hill', id: 'bezetha', center: [-300, -4830], radius: [180, 110], height: 34 },
  { kind: 'ridge', id: 'judean', points: [[-850, -4000], [-980, -4500], [-950, -5000]], height: 150, width: 300, rock: 11 },
  { kind: 'ridge', id: 'samaria', points: [[-1900, -5260], [-600, -5220], [0, -5205], [150, -5200]], height: 170, width: 300, endTaper: [80, 220], rock: 10,
    passes: [{ at: -380, depth: 0.93, width: 90 }] },
  // ── Francia: the Seine's plain, Montmartre to the north, the hill of Sainte-Geneviève to the south ──
  { kind: 'hill', id: 'montmartre', center: [-330, -6080], radius: [170, 130], height: 62 },
  { kind: 'hill', id: 'sainte-genevieve', center: [-260, -5470], radius: [190, 130], height: 30 },
  { kind: 'hill', id: 'chaillot', center: [-650, -5800], radius: [160, 220], height: 40 },
  { kind: 'ridge', id: 'east-francia', points: [[700, -5200], [760, -5800], [720, -6400]], height: 70, width: 260, rock: 4 },
  // ── the spur between Francia and Tang China ──
  { kind: 'ridge', id: 'north-rim', points: [[-1900, -6460], [-600, -6430], [0, -6420], [150, -6415]], height: 140, width: 300, endTaper: [80, 220], rock: 8,
    passes: [{ at: -480, depth: 0.93, width: 90 }] },
  { kind: 'ridge', id: 'east-north-rim', points: [[640, -6420], [900, -6460], [1500, -6500]], height: 130, width: 260, rock: 8 },
  // ── Tang China: Foguang Mountain behind the monastery, loess hills, the peaks of Wutai ──
  { kind: 'hill', id: 'foguang-shan', center: [-110, -6950], radius: [200, 320], height: 58 },
  { kind: 'hill', id: 'loess-west', center: [-640, -6800], radius: [220, 180], height: 55 },
  { kind: 'hill', id: 'loess-north', center: [-520, -7250], radius: [240, 160], height: 48 },
  // Mount Wutai: the spur between Tang China and Heian Japan
  { kind: 'ridge', id: 'wutai', points: [[-1900, -7660], [-600, -7630], [0, -7620], [150, -7615]], height: 210, width: 320, endTaper: [80, 220], rock: 12,
    passes: [{ at: -480, depth: 0.93, width: 100 }] },
  { kind: 'ridge', id: 'east-wutai', points: [[640, -7620], [900, -7660], [1500, -7700]], height: 180, width: 300, rock: 10 },
  { kind: 'ridge', id: 'east-tang', points: [[650, -6500], [740, -7000], [700, -7600]], height: 110, width: 260, rock: 8 },
  // ── Heian Japan: the wooded hills west of Uji, Mount Asahi across the river, the northern mountains ──
  { kind: 'hill', id: 'uji-west', center: [-330, -8230], radius: [210, 330], height: 62 },
  { kind: 'hill', id: 'daikichi', center: [-120, -8560], radius: [180, 130], height: 40 },
  { kind: 'hill', id: 'asahi', center: [720, -8150], radius: [170, 320], height: 95 },
  { kind: 'ridge', id: 'hira', points: [[-1900, -8880], [-600, -8860], [0, -8850], [900, -8870], [1500, -8900]], height: 230, width: 330, rock: 12 },
  { kind: 'ridge', id: 'moab', points: [[620, -4000], [700, -4600], [640, -5300]], height: 160, width: 260, rock: 10 },
  // ── the world's rim ──
  { kind: 'ridge', id: 'west-uplands', points: [[-1500, 1800], [-1450, 400], [-1500, -1000], [-1550, -2400], [-1550, -3300], [-1600, -4200], [-1600, -5400], [-1600, -6600], [-1600, -7800]], height: 120, width: 400, rock: 8 },
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
/** Water that cannot be waded: the river and the ponds. */
export function inWater(x, z, y) { return inRiver(x, z) || inPond(x, z, y); }

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
    // just below the base inside the pad, so that paving laid at the base never fights the ground
    if (d < p.blend) h = p.base - 0.12 * (1 - smooth(0, 1, d / 6)) + (h - p.base) * smooth(0, 1, d / p.blend);
  }
  if (POND_SHAPES.length) {
    const p = pondDistance(x, z);
    if (p.d < 5) { const bed = p.y - 1.2; h = bed + (Math.max(h, bed) - bed) * smooth(-1, 5, p.d); }
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
  // Byzantium: from the Greek way north over the pass of Parnes, round the third hill to the
  // atrium of Hagia Sophia; from its square down to the harbour
  { id: 'greece-north', width: 7, points: [[-420, -2105], [-430, -2300], [-420, -2560], [-420, -2860], [-405, -3020], [-260, -3205], [-170, -3292], [-150, -3300]] },
  { id: 'harbour', width: 6, points: [[-30, -3215], [60, -3215], [160, -3245], [232, -3258]], paved: 1 },
  // the Levant: from Byzantium over the pass of the Thracian ridge, south of the western hill, up to
  // the Haram's west stairs
  { id: 'byzantium-north', width: 7, points: [[-330, -3116], [-450, -3300], [-470, -3520], [-340, -3760], [-300, -4000], [-290, -4250], [-340, -4420], [-330, -4545], [-300, -4550]] },
  // Francia: from the Haram north over the pass of Samaria, along the foot of Sainte-Geneviève to
  // the palace courtyard
  { id: 'levant-north', width: 7, points: [[-300, -4550], [-330, -4700], [-380, -4950], [-380, -5200], [-360, -5420], [-120, -5620], [-20, -5735], [0, -5750]] },
  // Tang China: from Paris over the northern pass, up the valley to the monastery gate
  { id: 'francia-north', width: 6, points: [[-20, -5735], [-200, -5900], [-420, -6150], [-480, -6420], [-470, -6650], [-430, -6900], [-400, -6950], [-380, -6950]] },
  // Heian Japan: from the Tang village north over the pass of Wutai, down to the plain of Uji and
  // along the hills to the north shore of the pond
  { id: 'tang-north', width: 6, points: [[-430, -6900], [-470, -7150], [-490, -7400], [-480, -7620], [-420, -7850], [-260, -8030], [-60, -8100], [60, -8110], [100, -8112]] },
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
  greece(x, z, h, steep) {
    const n = fbm(x * 0.02, z * 0.02), m = fbm(x * 0.07 + 9, z * 0.07);
    const rock = Math.max(steep, smooth(0.15, 0.55, m) * 0.5 + smooth(25, 45, h) * 0.3);
    const soil = Math.max(0, 0.45 + 0.3 * n) * (1 - rock);
    return { grass: Math.max(0, 1 - rock - soil), soil, rock, sand: 0, fields: 0, dry: 0.75, warmth: 0.1, red: 0.85 };
  },
};
