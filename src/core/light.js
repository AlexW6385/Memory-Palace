// The daylight of the world, shared by the renderer and the baker so that baked indirect
// light matches the real-time sun. World axes: +x east, +y up, +z south (north is -z).
//
// Fixed time of day for now: a clear mid-morning in early spring at about 25°N
// (azimuth 115° from north, elevation 38°). Changing it requires a re-bake.

const AZIMUTH = 115 * Math.PI / 180;
const ELEVATION = 38 * Math.PI / 180;

/** Unit vector pointing from the ground toward the sun. */
export const SUN_DIR = [
  Math.sin(AZIMUTH) * Math.cos(ELEVATION),
  Math.sin(ELEVATION),
  -Math.cos(AZIMUTH) * Math.cos(ELEVATION),
];

/** Sun irradiance on a surface facing it (linear RGB, renderer light units). */
export const SUN_COLOR = [1.0, 0.94, 0.84];
export const SUN_INTENSITY = 4.2;

/** Sky radiance, linear RGB, at the zenith and at the horizon. */
export const SKY_ZENITH = [0.11, 0.17, 0.31];
export const SKY_HORIZON = [0.27, 0.28, 0.29];

/** Sky radiance seen along direction d (unit vector, y up). Used by the baker and as fallback. */
export function skyRadiance(d) {
  const y = Math.max(0, d[1]);
  const t = Math.pow(y, 0.45);
  const r = [], s = SUN_DIR;
  const cos = d[0] * s[0] + d[1] * s[1] + d[2] * s[2];
  const glow = Math.pow(Math.max(0, cos), 8) * 0.35; // brighter sky toward the sun (no disc)
  for (let i = 0; i < 3; i++) r.push(SKY_HORIZON[i] * (1 - t) + SKY_ZENITH[i] * t + glow * SUN_COLOR[i] * 0.4);
  return r;
}
