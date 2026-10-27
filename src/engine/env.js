// Shared environment uniforms, written by the climate each frame and read by materials, fog,
// cloud shadows and water. One place so that everything agrees about the sky.

import { Color, Vector2, Vector3 } from 'three/webgpu';
import {
  uniform, vec2, vec3, float, Fn, positionWorld, cameraPosition, normalize, dot, max, exp, pow, clamp, smoothstep, mix,
  mx_fractal_noise_float, time, length,
} from 'three/tsl';

export const ENV = {
  sunDir: uniform(new Vector3(0, 1, 0)),
  sunColor: uniform(new Color(1, 1, 1)),        // colour × intensity × weather factor
  zenith: uniform(new Color(0.1, 0.15, 0.3)),
  horizon: uniform(new Color(0.27, 0.28, 0.3)),
  fogColor: uniform(new Color(0.7, 0.7, 0.7)),
  fogDensity: uniform(0.001),
  fogFalloff: uniform(0.012),
  clouds: uniform(0.2),                         // cloud cover 0…1
  wind: uniform(new Vector2(1, 0)),             // cloud drift (m/s at ground scale)
  cloudOffset: uniform(new Vector2(0, 0)),      // integrated drift
  wet: uniform(0),                              // 0 dry … 1 soaked
  rain: uniform(0),
};

/**
 * Shadow of the clouds on the ground: a drifting field matched to the cloud cover. 1 = sun,
 * down to ~0.25 under a cloud. Uses world xz, so it moves over buildings and terrain alike.
 */
export const cloudShadow = Fn(() => {
  const p = positionWorld.xz.add(ENV.cloudOffset).mul(0.0028);
  const n = mx_fractal_noise_float(vec3(p.x, p.y, time.mul(0.004)), 4, 2.0, 0.5).mul(0.5).add(0.5);
  const cover = ENV.clouds;
  // the more cover, the lower the threshold: patches merge into overcast
  const shade = smoothstep(float(1).sub(cover).sub(0.08), float(1).sub(cover).add(0.12), n);
  return float(1).sub(shade.mul(clamp(cover.mul(1.6), 0, 0.78)));
})();

/** Fog: denser near the ground, glowing toward the sun (aerial perspective). */
export const fogFactor = Fn(() => {
  const toP = positionWorld.sub(cameraPosition);
  const d = length(toP);
  const y0 = cameraPosition.y, y1 = positionWorld.y, k = ENV.fogFalloff;
  // integral of exp(-k y) along the ray, divided by its length
  const dy = y1.sub(y0);
  const avg = select4(dy.abs().lessThan(0.5), exp(k.negate().mul(y0)), exp(k.negate().mul(y0)).sub(exp(k.negate().mul(y1))).div(k.mul(dy)));
  return float(1).sub(exp(ENV.fogDensity.negate().mul(d).mul(avg))).clamp(0, 0.97);
})();

export const fogColor = Fn(() => {
  const v = normalize(positionWorld.sub(cameraPosition));
  const glow = pow(max(dot(v, ENV.sunDir), 0), 8);
  return mix(ENV.fogColor, ENV.fogColor.mul(0.8).add(ENV.sunColor.mul(0.05)), glow);
})();

function select4(c, a, b) { return c.select(a, b); }
