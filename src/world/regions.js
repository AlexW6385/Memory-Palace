// The city of the world and its districts (docs/world.md).
//
// The world is one compact city — a palace-city of civilizations. Each district (a "region" in the
// code) holds a core building at true scale and, round it, a small surrounding of its own time:
// lanes, houses, courtyards, gardens, the plants and ground of the place, and the little terrain
// the building stands on. Districts touch directly; their borders are soft and irregular. One sky
// over the whole city. Beyond the city's edge the land runs out into fields and low hills.
//
// Everything here is pure data and pure functions, shared by the viewer (terrain meshes,
// ground, climate), the walker, the plan and walk checks and the light baker.
// Axes: +x east, +y up, +z south (north is −z). Metres.

// ── regions and their climates ───────────────────────────────────────────────

/**
 * Each district has a centre and a kind of house for its lanes. Its own climate is the sun and sky
 * its building's light is baked for (`az`, `el`, `hour`; `lat`, `dec` give its course through a day);
 * the city's sky at run time is CITY's. Its climate fixes the
 * sun (time of day, so that light can be baked) and gives the sky, haze and a weather cycle.
 * Sun: azimuth in degrees from north, clockwise; elevation in degrees.
 */
export const REGIONS = [
  {
    id: 'nile', name: { en: 'The Nile', zh: '尼罗河' },
    center: [0, 0], house: 'house_egypt',
    climate: {
      // late afternoon in Upper Egypt: the sun low in the west-south-west, warm, dusty air
      sun: { az: 248, el: 24, color: [1.0, 0.8, 0.6], intensity: 3.3, lat: 25, dec: -5, hour: 16.5 },
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
    center: [0, -230], house: 'house_tiled',
    climate: {
      // a spring morning on the Campus Martius: the sun in the east-south-east, clouds passing
      sun: { az: 118, el: 30, color: [1.0, 0.9, 0.78], intensity: 3.2, lat: 42, dec: 8, hour: 9 },
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
    center: [-240, 0], house: 'house_tiled',
    climate: {
      // an Attic noon: a high sun from the south, deep blue sky, clear dry air
      sun: { az: 196, el: 52, color: [1.0, 0.95, 0.88], intensity: 3.6, lat: 38, dec: 15, hour: 12.5 },
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
    center: [280, -250], house: 'house_tiled',
    climate: {
      // a late autumn morning on the Bosphorus: the sun low in the south-east, sea air, often grey;
      // the poyraz blows from the north-east (Climate of Istanbul: cloudy, frequent light rain, fog)
      sun: { az: 142, el: 26, color: [1.0, 0.87, 0.72], intensity: 3.0, lat: 41, dec: -15, hour: 9.5 },
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
    center: [300, 30], house: 'house_domed',
    climate: {
      // a clear morning in the Judean hills: the sun in the east-south-east, dry bright air;
      // sometimes the hot dusty sharav, in winter a passing shower
      sun: { az: 112, el: 32, color: [1.0, 0.92, 0.8], intensity: 3.4, lat: 32, dec: 0, hour: 8.5 },
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
    center: [-240, -230], house: 'house_timber',
    climate: {
      // a summer afternoon on the Seine: the sun in the west-south-west, soft moist air, clouds
      // coming and going, now and then a shower
      sun: { az: 248, el: 34, color: [1.0, 0.9, 0.78], intensity: 3.1, lat: 49, dec: 20, hour: 16 },
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
    center: [200, 330], house: 'house_china',
    climate: {
      // late afternoon on Mount Wutai: the sun low in the west, on the hall's face; dry clear air
      // of the north, at times yellow with dust from the loess, now and then a shower
      sun: { az: 256, el: 21, color: [1.0, 0.82, 0.62], intensity: 3.2, lat: 39, dec: 10, hour: 17 },
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
    center: [530, 330], house: 'house_japan',
    climate: {
      // an autumn morning at Uji: the sun low in the east-south-east over the hills across the
      // river, on the Phoenix Hall's face; soft moist air, mist on the water, showers passing
      sun: { az: 112, el: 17, color: [1.0, 0.84, 0.66], intensity: 3.0, lat: 35, dec: -15, hour: 7.5 },
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
    center: [-10, 300], house: 'house_india',
    climate: {
      // a winter afternoon in Malwa: the sun in the south-west, warm and dry, a dusty haze on the
      // plain; now and then high cloud, rarely a winter shower
      sun: { az: 228, el: 32, color: [1.0, 0.86, 0.68], intensity: 3.3, lat: 23.5, dec: -20, hour: 15 },
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

/**
 * The city's one sky: the sun's course through the day (a middle latitude, early summer), the sky,
 * the haze and the weather over all the districts alike.
 */
export const CITY = {
  id: 'city',
  climate: {
    sun: { az: 200, el: 48, color: [1.0, 0.92, 0.82], intensity: 3.3, lat: 34, dec: 12, hour: 11 },
    sky: { turbidity: 3.0, rayleigh: 1.15, mie: 0.004, mieG: 0.8, zenith: [0.1, 0.15, 0.28], horizon: [0.28, 0.29, 0.3] },
    fog: { color: [0.6, 0.62, 0.64], density: 0.0007, height: 0.012 },
    exposure: 0.58,
    wind: [0.5, 0.3],
    weather: [
      { id: 'clear', weight: 4, clouds: 0.1, cloudDensity: 0.35, sun: 1.0, fog: 1.0 },
      { id: 'fair', weight: 3.5, clouds: 0.35, cloudDensity: 0.5, sun: 1.0, fog: 1.0 },
      { id: 'cloudy', weight: 2, clouds: 0.66, cloudDensity: 0.6, sun: 0.72, fog: 1.3 },
      { id: 'overcast', weight: 1, clouds: 0.92, cloudDensity: 0.75, sun: 0.38, fog: 1.8 },
      { id: 'shower', weight: 1, clouds: 0.94, cloudDensity: 0.85, sun: 0.3, fog: 2.2, rain: 0.8 },
      { id: 'haze', weight: 1, clouds: 0.15, cloudDensity: 0.3, sun: 0.8, fog: 2.6, fogColor: [0.68, 0.64, 0.56] },
      { id: 'mist', weight: 0.7, clouds: 0.4, cloudDensity: 0.4, sun: 0.6, fog: 4, fogColor: [0.72, 0.73, 0.74] },
    ],
  },
};

// ── the city and its districts ───────────────────────────────────────────────

/** The city: the walkable rectangle; the land beyond it is drawn out to `far`. */
export const WORLD = {
  bounds: [-360, -370, 640, 460],
  far: 900,
};

/** A point displaced a little by noise, so that the districts' borders wander like old streets. */
function warp(x, z) { return [x + 22 * fbm(x * 0.008 + 3.1, z * 0.008), z + 22 * fbm(x * 0.008, z * 0.008 + 7.7)]; }

/**
 * Weights of every district at (x, z): the nearest centre (after the warp) has it, with a short
 * blend across the border (about 15 m) so that ground and planting change over a few steps. Sums to 1.
 */
export function regionWeights(x, z, blend = 7) {
  const [wx, wz] = warp(x, z);
  const d = REGIONS.map((r) => Math.hypot(wx - r.center[0], wz - r.center[1]));
  const m = Math.min(...d);
  const w = d.map((v) => Math.exp(-(v - m) / blend));
  const s = w.reduce((p, q) => p + q, 0);
  return w.map((v) => (v / s < 1e-3 ? 0 : v / s));
}

export function regionAt(x, z) {
  const w = regionWeights(x, z);
  let best = 0;
  for (let i = 1; i < w.length; i++) if (w[i] > w[best]) best = i;
  return REGIONS[best];
}

/** How far (x, z) is inside the city (negative outside its edge), in metres. */
export function inCity(x, z) {
  const [x0, z0, x1, z1] = WORLD.bounds;
  return Math.min(x - x0, x1 - x, z - z0, z1 - z);
}

/** Where each building stands: origin [x, z], yaw (degrees), base height, district, and the
 *  rectangle (building-local) over which the ground is levelled to the base. */
export const SITES = {
  edfu: { origin: [0, 50], yaw: 0, base: 0, region: 'nile', pad: [-48, -140, 48, 32] },
  pantheon: { origin: [0, -170], yaw: 0, base: 0, region: 'rome', pad: [-48, -165, 48, 32] },
  parthenon: { origin: [-225, 0], yaw: 0, base: 24, region: 'greece', pad: [-46, -26, 50, 26] },
  'hagia-sophia': { origin: [280, -265], yaw: 0, base: 14, region: 'byzantium', pad: [-106, -52, 48, 102] },
  'dome-of-the-rock': { origin: [300, 30], yaw: 0, base: 14, region: 'levant', pad: [-150, -120, 150, 120] },
  'sainte-chapelle': { origin: [-240, -230], yaw: 0, base: 1.5, region: 'francia', pad: [-40, -32, 52, 46] },
  'foguang-east-hall': { origin: [240, 330], yaw: 0, base: 1.5, region: 'tang', pad: [-125, -48, 34, 48] },
  'byodo-in-phoenix-hall': { origin: [520, 330], yaw: 0, base: 1.5, region: 'heian', pad: [-60, -78, 100, 78] },
  'sanchi-great-stupa': { origin: [-25, 300], yaw: 0, base: 22, region: 'india', pad: [-70, -72, 92, 72] },
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

// ── the little terrain of the districts ──────────────────────────────────────

/**
 * Only what a district's building stands on, cut to the district's size:
 * kind 'mesa': a flat-topped rock with cliffs and one gentle side (rounded-rectangle top);
 * kind 'hill': a rounded hill (elliptical, smooth top).
 */
export const LANDFORMS = [
  // the Acropolis: the Parthenon's rock, its gentle side to the north toward the lanes
  { region: 'greece', kind: 'mesa', id: 'acropolis', center: [-240, 0], half: [100, 58], round: 24, top: 24, steep: 20, gentle: { dir: [0, -1], run: 58 }, rock: 3 },
  // the first hill of Constantinople under Hagia Sophia, its gentle side west toward the avenue
  { region: 'byzantium', kind: 'mesa', id: 'first-hill', center: [262, -257], half: [100, 80], round: 40, top: 14, steep: 24, gentle: { dir: [-1, 0], run: 50 }, rock: 2 },
  // Mount Moriah: the Haram platform's hill, its gentle side west toward the avenue
  { region: 'levant', kind: 'mesa', id: 'moriah', center: [300, 30], half: [150, 128], round: 30, top: 14, steep: 22, gentle: { dir: [-1, 0], run: 46 }, rock: 3 },
  // the hill of Sanchi, its gentle side north toward the city
  { region: 'india', kind: 'mesa', id: 'sanchi-hill', center: [-22, 302], half: [92, 94], round: 40, top: 22, steep: 26, gentle: { dir: [0, -1], run: 50 }, rock: 3 },
  // Foguang Mountain behind the monastery's terraces
  { region: 'tang', kind: 'hill', id: 'foguang-shan', center: [318, 330], radius: [45, 90], height: 18 },
];

/** Unit vector from the ground toward the sun for a climate. */
export function sunDirection(climate) {
  const az = climate.sun.az * Math.PI / 180, el = climate.sun.el * Math.PI / 180;
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
}

/**
 * Direction toward the sun at an hour of the day (0…24, local solar time) for a climate's latitude
 * and season: { dir (unit vector, as sunDirection), el (degrees) }. The moon (full, so opposite)
 * is the same with the hour shifted by twelve and the declination reversed.
 */
export function sunAt(climate, hour, moon = false) {
  const R = Math.PI / 180, lat = (climate.sun.lat ?? 35) * R, dec = (moon ? -1 : 1) * (climate.sun.dec ?? 0) * R;
  const H = ((moon ? hour + 12 : hour) - 12) * 15 * R;
  const sinEl = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  const cosAz = (Math.sin(dec) - sinEl * Math.sin(lat)) / Math.max(1e-6, Math.cos(el) * Math.cos(lat));
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (Math.sin(H) > 0) az = 2 * Math.PI - az;            // afternoon: the sun is in the west
  return { dir: [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)], el: el / R };
}

/** Sky radiance along direction d for a climate (used by the baker and the outdoor fallback). */
export function skyRadiance(climate, d) {
  const s = sunDirection(climate), { zenith, horizon } = climate.sky;
  const y = Math.max(0, d[1]), t = Math.pow(y, 0.45);
  const cos = d[0] * s[0] + d[1] * s[1] + d[2] * s[2];
  const glow = Math.pow(Math.max(0, cos), 8) * 0.35;
  return [0, 1, 2].map((i) => horizon[i] * (1 - t) + zenith[i] * t + glow * climate.sun.color[i] * 0.4);
}

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
/** Bounding rectangle beyond which a landform adds nothing. */
function landformBox(L) {
  const m = L.kind === 'hill' ? Math.max(...L.radius) * 1.6 : Math.max(...L.half) + Math.max(L.steep, L.gentle?.run || 0) + 4;
  return [L.center[0] - m, L.center[1] - m, L.center[0] + m, L.center[1] + m];
}
for (const L of LANDFORMS) L.box = landformBox(L);

/** Building pads: the ground is flattened to the site's base around each building. */
const PADS = [];
export function registerPad(rect, base, margin = 12, blend = 30) { PADS.push({ rect, base, margin, blend }); }

for (const site of Object.values(SITES)) {
  if (!site.pad || site.yaw) continue;
  const [x0, z0, x1, z1] = site.pad, [ox, oz] = site.origin;
  // a site raised on its rock is levelled only on the rock; one on the plain blends out widely
  if (site.base > 3) registerPad([ox + x0, oz + z0, ox + x1, oz + z1], site.base, 4, 10);
  else registerPad([ox + x0, oz + z0, ox + x1, oz + z1], site.base);
}
const POND_SHAPES = [];
for (const p of PONDS) {
  const s = SITES[p.site], [ox, oz] = s.origin;
  for (const { c, r } of p.shapes) POND_SHAPES.push({ c: [ox + c[0], oz + c[1]], r, y: s.base + p.level });
}
/** Signed distance (m, approximate) from the shore of the nearest pond: negative in the water. */
export function pondDistance(x, z) {
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
/** The surface of the pond at (x, z), or -Infinity where there is none (one who flies down onto
 *  the water hovers at its surface). */
export function waterLevel(x, z) {
  if (!POND_SHAPES.length) return -Infinity;
  const p = pondDistance(x, z);
  return p.d < -1.2 ? p.y : -Infinity;
}
/** There is no river in the city; kept for the callers that ask. */
export function inRiver() { return false; }
/** Water that cannot be waded: the ponds (y: the walker's feet). */
export function inWater(x, z, y) { return inPond(x, z, y); }

/** Height of the natural ground: the districts' rocks and hills on a gently undulating plain, and
 *  beyond the city's edge fields rising slowly to low hills. */
function naturalHeight(x, z) {
  let h = 0;
  for (const L of LANDFORMS) {
    const b = L.box;
    if (x < b[0] || x > b[2] || z < b[1] || z > b[3]) continue;
    h = Math.max(h, landformHeight(L, x, z));
  }
  h += 0.6 * fbm(x * 0.012 + 5, z * 0.012);
  const out = -inCity(x, z);
  if (out > 0) h += smooth(30, 700, out) * (55 + 70 * (0.5 + 0.5 * fbm(x * 0.002 + 9, z * 0.002))) + smooth(0, 60, out) * 3 * fbm(x * 0.02, z * 0.02);
  return h;
}

/** Height of the open ground at (x, z), with the building pads and the ponds. */
export function terrainHeight(x, z) {
  let h = naturalHeight(x, z);
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
  return h;
}

// ── streets ──────────────────────────────────────────────────────────────────

/**
 * The city's streets: avenues along the districts' borders, where the lanes of two districts
 * face each other, and short ways from them to each building's entrance. (The lanes between the
 * houses are left by the house lots themselves, in src/world/city.js.)
 */
export const ROADS = [
  // avenues: north–south and east–west, between the districts
  { id: 'north-street', width: 6, points: [[-345, -355], [625, -355]] },
  { id: 'west-avenue', width: 7, points: [[-115, -355], [-115, 150]] },
  { id: 'east-avenue', width: 7, points: [[110, -355], [110, 210]] },
  { id: 'upper-avenue', width: 7, points: [[-345, -135], [625, -135]] },
  { id: 'lower-avenue', width: 7, points: [[-345, 150], [110, 150]] },
  { id: 'eastern-avenue', width: 7, points: [[110, 210], [625, 210]] },
  { id: 'eastern-lane', width: 6, points: [[372, 210], [372, 440]] },
  { id: 'south-street', width: 6, points: [[100, 440], [625, 440]] },
  // to the entrances
  { id: 'to-edfu', width: 9, points: [[0, 150], [0, 76]], paved: 1 },
  { id: 'to-pantheon', width: 7, points: [[0, -355], [0, -330]], paved: 1 },
  { id: 'to-parthenon', width: 6, points: [[-225, -135], [-225, -66], [-225, -40], [-165, -40], [-165, 0], [-179, 0]] },
  { id: 'to-hagia-sophia', width: 7, points: [[110, -265], [178, -265]], paved: 1 },
  { id: 'to-dome-of-the-rock', width: 7, points: [[110, 30], [158, 30]], paved: 1 },
  { id: 'to-sainte-chapelle', width: 6, points: [[-115, -180], [-300, -180], [-300, -230], [-276, -230]], paved: 1 },
  { id: 'to-foguang', width: 6, points: [[110, 210], [104, 240], [104, 330], [114, 330]] },
  { id: 'to-byodo-in', width: 6, points: [[500, 440], [500, 404]] },
  { id: 'to-sanchi', width: 6, points: [[-25, 150], [-25, 214]] },
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

// ── ground cover ─────────────────────────────────────────────────────────────

/**
 * Ground cover at (x, z) given the height and the surface normal's y component:
 * { sand, grass, rock, soil, fields, dry } — the first five sum to about 1; `dry` tints grass
 * from green (0) to straw (1); `fields` are cultivated plots (only beyond the city).
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
  // in the city the ground is trodden: beaten earth between the houses, grass in the gardens;
  // the fields lie outside
  const city = smooth(-40, 10, inCity(x, z));
  const trod = city * (0.45 + 0.25 * fbm(x * 0.04 + 2, z * 0.04));
  acc.soil += (acc.grass + acc.fields) * trod; acc.grass *= 1 - trod; acc.fields *= 1 - city;
  // roads: beaten earth with worn edges
  const rd = roadDistance(x, z);
  if (rd.d < 2) {
    const m = 1 - smooth(-0.5, 2, rd.d + 0.6 * fbm(x * 0.3, z * 0.3));
    for (const k of ['sand', 'grass', 'rock', 'fields']) acc[k] *= 1 - m;
    acc.soil = acc.soil * (1 - m) + m;
    acc.road = m;
  }
  return acc;
}

// warmth: the rock and silt of the region — 0 grey limestone and tufa, 1 buff sandstone;
// red: how red the soil is (the terra rossa of Attica)
const GROUND = {
  nile(x, z, h, steep) {
    const fromRiver = 1e4;                       // no river in the city
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
