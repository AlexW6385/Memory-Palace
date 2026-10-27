// Climate and weather. Each region has a fixed time of day (its sun is baked into its
// buildings' light) and a weather cycle drawn from its climate; the visitor's position blends
// the regions across their boundaries. Drives the sun, the sky, the fog, cloud shadows, rain
// and wetness, and gives the base exposure.

import { REGIONS, regionWeights, sunDirection, skyRadiance } from '../world/regions.js';
import { ENV } from './env.js';

const params = new URLSearchParams(location.search);
const FORCE = params.get('weather');            // e.g. ?weather=shower (screenshots, tests)

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const lerp = (a, b, t) => a + (b - a) * t;

/** Weather of one region: a slow random walk through its states, each held for minutes. */
class RegionWeather {
  constructor(region, seed) {
    this.r = region; this.rand = rng(seed);
    const S = region.climate.weather;
    this.cur = this.pick(); this.next = this.cur; this.t = 1;
    if (FORCE) { const i = S.findIndex((w) => w.id === FORCE); if (i >= 0) { this.cur = this.next = i; } }
    this.hold = 120 + this.rand() * 240;
  }
  pick() {
    const S = this.r.climate.weather, tot = S.reduce((s, w) => s + w.weight, 0);
    let x = this.rand() * tot;
    for (let i = 0; i < S.length; i++) { x -= S[i].weight; if (x <= 0) return i; }
    return 0;
  }
  update(dt) {
    if (FORCE) return;
    if (this.t < 1) { this.t = Math.min(1, this.t + dt / 75); if (this.t >= 1) this.cur = this.next; return; }
    this.hold -= dt;
    if (this.hold <= 0) { this.next = this.pick(); this.t = this.next === this.cur ? 1 : 0; this.hold = 150 + this.rand() * 330; }
  }
  /** Current blended state values. */
  get() {
    const S = this.r.climate.weather, a = S[this.cur], b = S[this.next], t = this.t < 1 ? this.t * this.t * (3 - 2 * this.t) : 1;
    const v = (k, d = 0) => lerp(a[k] ?? d, b[k] ?? d, this.cur === this.next ? 0 : t);
    const fc = a.fogColor || this.r.climate.fog.color, fd = b.fogColor || this.r.climate.fog.color;
    return {
      clouds: v('clouds'), cloudDensity: v('cloudDensity', 0.4), sun: v('sun', 1), fog: v('fog', 1), rain: v('rain'), windy: v('windy'),
      fogColor: [0, 1, 2].map((i) => lerp(fc[i], fd[i], this.cur === this.next ? 0 : t)),
      id: this.t < 1 ? `${S[this.cur].id}→${S[this.next].id}` : S[this.cur].id,
    };
  }
}

export class Climate {
  constructor(renderer) {
    this.R = renderer;
    this.weather = REGIONS.map((r, i) => new RegionWeather(r, 7919 * (i + 1) + (Date.now() / 3.6e6 | 0)));
    this.hemi = REGIONS.map((r) => hemisphere(r.climate));
    this.state = null;
    this.wet = 0;
  }

  /** Blend the regions at (x, z) and apply the result. Returns the blended state. */
  update(x, z, dt) {
    for (const w of this.weather) w.update(dt);
    const W = regionWeights(x, z);
    const acc = { sun: [0, 0, 0], sunColor: [0, 0, 0], zen: [0, 0, 0], hor: [0, 0, 0], fogColor: [0, 0, 0], fog: 0, falloff: 0, clouds: 0, density: 0,
      turb: 0, ray: 0, mie: 0, mieG: 0, exposure: 0, wind: [0, 0], rain: 0, sunFactor: 0, sky: [0, 0, 0], ground: [0, 0, 0], windy: 0 };
    REGIONS.forEach((r, i) => {
      const w = W[i];
      if (w <= 0) return;
      const c = r.climate, s = sunDirection(c), wx = this.weather[i].get();
      for (let k = 0; k < 3; k++) {
        acc.sun[k] += w * s[k];
        acc.sunColor[k] += w * c.sun.color[k] * c.sun.intensity * wx.sun;
        acc.zen[k] += w * c.sky.zenith[k] * lerp(1, 0.8, wx.clouds);
        acc.hor[k] += w * lerp(c.sky.horizon[k], 0.3, wx.clouds * 0.6);
        acc.fogColor[k] += w * wx.fogColor[k];
        acc.sky[k] += w * this.hemi[i].sky[k];
        acc.ground[k] += w * this.hemi[i].ground[k] * (0.4 + 0.6 * wx.sun);
      }
      acc.fog += w * c.fog.density * wx.fog; acc.falloff += w * c.fog.height;
      acc.clouds += w * wx.clouds; acc.density += w * wx.cloudDensity;
      acc.turb += w * c.sky.turbidity * (1 + wx.clouds); acc.ray += w * c.sky.rayleigh; acc.mie += w * c.sky.mie * (1 + wx.fog * 0.3); acc.mieG += w * c.sky.mieG;
      acc.exposure += w * c.exposure; acc.wind[0] += w * c.wind[0] * (1 + 2 * wx.windy); acc.wind[1] += w * c.wind[1] * (1 + 2 * wx.windy);
      acc.rain += w * wx.rain; acc.sunFactor += w * wx.sun; acc.windy += w * wx.windy;
    });
    const l = Math.hypot(...acc.sun) || 1;
    acc.sun = acc.sun.map((v) => v / l);
    // wetness: soaks in under rain within a minute, dries over several
    this.wet += (acc.rain > 0.3 ? (1 - this.wet) * dt / 50 : -this.wet * dt / 400);
    this.wet = Math.min(1, Math.max(0, this.wet));
    this.apply(acc, dt);
    this.state = { ...acc, wet: this.wet, ids: this.weather.map((w) => w.get().id), weights: W };
    return this.state;
  }

  apply(a, dt) {
    const R = this.R;
    ENV.sunDir.value.set(...a.sun);
    ENV.sunColor.value.setRGB(...a.sunColor);
    ENV.zenith.value.setRGB(...a.zen);
    ENV.horizon.value.setRGB(...a.hor);
    ENV.fogColor.value.setRGB(...a.fogColor);
    ENV.fogDensity.value = a.fog;
    ENV.fogFalloff.value = a.falloff;
    ENV.clouds.value = a.clouds;
    ENV.wind.value.set(a.wind[0], a.wind[1]);
    ENV.cloudOffset.value.x -= a.wind[0] * dt * 6;
    ENV.cloudOffset.value.y -= a.wind[1] * dt * 6;
    ENV.wet.value = this.wet;
    ENV.rain.value = a.rain;
    R.sun.color.setRGB(...a.sunColor.map((v) => v / Math.max(1e-3, Math.max(...a.sunColor)))).multiplyScalar(1);
    R.sun.intensity = Math.max(...a.sunColor);
    R.sunDir = a.sun;
    const sky = R.sky;
    sky.turbidity.value = a.turb; sky.rayleigh.value = a.ray; sky.mieCoefficient.value = a.mie; sky.mieDirectionalG.value = a.mieG;
    sky.cloudCoverage.value = a.clouds; sky.cloudDensity.value = a.density;
    sky.cloudSpeed.value = 0.00002 * (1 + 2 * a.windy);
    sky.sunPosition.value.set(a.sun[0], a.sun[1], a.sun[2]).multiplyScalar(1000);
    // the outdoor fallback for indirect light, and the strength of the baked light under cloud
    R.gi.setHemisphere(a.sky, a.ground);
    R.gi.uIntensity.value = 0.72 + 0.28 * a.sunFactor;
  }
}

/** Irradiance from the open sky above and the lit ground below, for a climate. */
export function hemisphere(climate) {
  const sky = [0, 0, 0];
  const N = 16;
  let wsum = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N * 2; j++) {
    const th = ((i + 0.5) / N) * Math.PI / 2, ph = ((j + 0.5) / (2 * N)) * Math.PI * 2;
    const d = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
    const L = skyRadiance(climate, d), w = Math.cos(th) * Math.sin(th);
    for (let k = 0; k < 3; k++) sky[k] += L[k] * w;
    wsum += w;
  }
  for (let k = 0; k < 3; k++) sky[k] = (sky[k] / wsum) * Math.PI;
  const s = sunDirection(climate), alb = [0.35, 0.3, 0.24];
  const ground = [0, 1, 2].map((k) => alb[k] * (climate.sun.color[k] * climate.sun.intensity * s[1] + sky[k]));
  return { sky, ground };
}
