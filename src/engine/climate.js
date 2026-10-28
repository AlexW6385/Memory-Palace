// Climate, weather and the time of day. Days pass (a day lasts DAY_SECONDS): the sun follows each
// region's course for its latitude and season, sets, and the full moon and the stars come out;
// or the time can be held (`baked`: each region at the moment its buildings' light was baked).
// Each region also has a weather cycle drawn from its climate; the visitor's position blends the
// regions across their boundaries. Drives the sun and moon light, the sky, the fog, cloud
// shadows, rain and wetness, the strength of the baked light, and gives the base exposure.

import { REGIONS, regionWeights, sunDirection, sunAt, skyRadiance } from '../world/regions.js';
import { ENV } from './env.js';

const params = new URLSearchParams(location.search);
const FORCE = params.get('weather');            // e.g. ?weather=shower (screenshots, tests)
/** Length of a day in real seconds. */
export const DAY_SECONDS = 1800;
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const MOON = [0.55, 0.64, 0.9];

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
    this.indoors = 0;              // 0 outdoors … 1 under a roof (set by the frame loop)
    this.weather = REGIONS.map((r, i) => new RegionWeather(r, 7919 * (i + 1) + (Date.now() / 3.6e6 | 0)));
    this.hemi = REGIONS.map((r) => hemisphere(r.climate));
    this.state = null;
    this.wet = 0;
    // the time: 'cycle' (days pass), 'baked' (each region's baked moment) or an hour held fixed
    this.mode = 'cycle';
    this.hour = 16.5;
  }

  /** Set how time runs: 'cycle', 'baked', or a number (an hour held). */
  setTime(mode, hour) {
    this.mode = mode;
    if (typeof mode === 'number') this.hour = mode;
    else if (hour !== undefined) this.hour = hour;
  }

  /** Blend the regions at (x, z) and apply the result. Returns the blended state. */
  update(x, z, dt) {
    for (const w of this.weather) w.update(dt);
    if (this.mode === 'cycle') this.hour = (this.hour + dt * 24 / DAY_SECONDS) % 24;
    const W = regionWeights(x, z);
    const acc = { sun: [0, 0, 0], sunColor: [0, 0, 0], zen: [0, 0, 0], hor: [0, 0, 0], fogColor: [0, 0, 0], fog: 0, falloff: 0, clouds: 0, density: 0,
      turb: 0, ray: 0, mie: 0, mieG: 0, exposure: 0, wind: [0, 0], rain: 0, sunFactor: 0, sky: [0, 0, 0], ground: [0, 0, 0], windy: 0,
      day: 0, moon: [0, 0, 0], moonLight: 0, sunEl: 0 };
    REGIONS.forEach((r, i) => {
      const w = W[i];
      if (w <= 0) return;
      const c = r.climate, wx = this.weather[i].get();
      // the sun at this hour; its light reddens and fades as it sinks, and is gone below the horizon
      const baked = this.mode === 'baked';
      const S = baked ? { dir: sunDirection(c), el: c.sun.el } : sunAt(c, this.hour);
      const el = S.el, s = S.dir;
      const day = smooth(-10, 8, el);                       // daylight in the sky (twilight included)
      const low = smooth(0, 25, el), up = smooth(-2, 6, el) * (0.55 + 0.45 * smooth(0, 20, el));
      const sunCol = [1.0, 0.52, 0.28].map((v, k) => lerp(v, c.sun.color[k], low));
      const Mo = sunAt(c, this.hour, true), moonUp = baked ? 0 : smooth(-2, 10, Mo.el) * (1 - smooth(-6, 2, el));
      for (let k = 0; k < 3; k++) {
        acc.sun[k] += w * s[k];
        acc.moon[k] += w * Mo.dir[k];
        acc.sunColor[k] += w * sunCol[k] * c.sun.intensity * up * wx.sun;
        acc.zen[k] += w * lerp(0.004 + k * 0.002, c.sky.zenith[k] * lerp(1, 0.8, wx.clouds), day);
        acc.hor[k] += w * lerp(0.006 + k * 0.003, lerp(c.sky.horizon[k], 0.3, wx.clouds * 0.6), day);
        acc.fogColor[k] += w * wx.fogColor[k] * (0.06 + 0.94 * day) * (k === 2 ? 1 : 0.85 + 0.15 * day);
        acc.sky[k] += w * (this.hemi[i].sky[k] * day + 0.012 * MOON[k] * moonUp);
        acc.ground[k] += w * this.hemi[i].ground[k] * (0.4 + 0.6 * wx.sun) * day;
      }
      acc.moonLight += w * moonUp * (0.35 + 0.65 * wx.sun);
      acc.day += w * day; acc.sunEl += w * el;
      acc.fog += w * c.fog.density * wx.fog; acc.falloff += w * c.fog.height;
      acc.clouds += w * wx.clouds; acc.density += w * wx.cloudDensity;
      acc.turb += w * c.sky.turbidity * (1 + wx.clouds); acc.ray += w * c.sky.rayleigh; acc.mie += w * c.sky.mie * (1 + wx.fog * 0.3); acc.mieG += w * c.sky.mieG;
      acc.exposure += w * c.exposure; acc.wind[0] += w * c.wind[0] * (1 + 2 * wx.windy); acc.wind[1] += w * c.wind[1] * (1 + 2 * wx.windy);
      acc.rain += w * wx.rain; acc.sunFactor += w * wx.sun; acc.windy += w * wx.windy;
    });
    const l = Math.hypot(...acc.sun) || 1;
    acc.sun = acc.sun.map((v) => v / l);
    const lm = Math.hypot(...acc.moon) || 1;
    acc.moon = acc.moon.map((v) => v / lm);
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
    // under a roof the haze is the room's own dust and smoke, far thinner than the weather outside
    ENV.fogDensity.value = a.fog * (1 - 0.8 * (this.indoors || 0));
    ENV.fogFalloff.value = a.falloff;
    ENV.clouds.value = a.clouds;
    ENV.wind.value.set(a.wind[0], a.wind[1]);
    ENV.cloudOffset.value.x -= a.wind[0] * dt * 6;
    ENV.cloudOffset.value.y -= a.wind[1] * dt * 6;
    ENV.wet.value = this.wet;
    ENV.rain.value = a.rain;
    // one light: the sun by day; when it has set, the moon (fainter, bluer), which casts the shadows
    const sunI = Math.max(...a.sunColor), moonI = 0.32 * a.moonLight;
    if (sunI >= moonI) {
      R.sun.color.setRGB(...a.sunColor.map((v) => v / Math.max(1e-3, sunI)));
      R.sun.intensity = sunI;
      R.sunDir = a.sun;
    } else {
      R.sun.color.setRGB(...MOON);
      R.sun.intensity = moonI;
      R.sunDir = a.moon;
    }
    ENV.night.value = 1 - a.day;
    ENV.moonDir.value.set(...a.moon);
    ENV.moonUp.value = a.moonLight;
    const sky = R.sky;
    sky.turbidity.value = a.turb; sky.rayleigh.value = a.ray; sky.mieCoefficient.value = a.mie; sky.mieDirectionalG.value = a.mieG;
    sky.cloudCoverage.value = a.clouds; sky.cloudDensity.value = a.density;
    sky.cloudSpeed.value = 0.00002 * (1 + 2 * a.windy);
    sky.sunPosition.value.set(a.sun[0], a.sun[1], a.sun[2]).multiplyScalar(1000);
    // the outdoor fallback for indirect light, and the strength of the baked light under cloud
    R.gi.setHemisphere(a.sky, a.ground);
    // the baked light (sun and sky at the baked moment) follows the daylight; a little remains at
    // night for the moon and the lamps
    R.gi.uIntensity.value = (0.72 + 0.28 * a.sunFactor) * (0.2 + 0.8 * a.day);
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
