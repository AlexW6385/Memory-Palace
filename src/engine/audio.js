// Music synthesised in the browser from each building's score (src/buildings/<id>/music.js):
// drones, plucked strings (Karplus–Strong), sistra, frame drums. Zones of a building
// (open air, halls, inner rooms, sanctum) crossfade as the visitor walks through them.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Music {
  constructor() {
    this.ctx = null;
    this.volume = 0.6;
    this.score = null;
    this.zone = null;
    this.layers = new Map();     // zone → { gain, drones: [] }
    this.harpCache = new Map();
    this.next = 0;
    this.beat = 0;
    this.phrase = { left: 0, deg: 2 };
  }

  /** Must be called from a user gesture. */
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume?.();
    // whatever was asked for before the context existed is set up now, on the next set()
    const pending = this.score;
    this.score = null; this.zone = null;
    this.pending = pending;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    // a gentle compressor and make-up gain so quiet passages are still heard on laptop speakers
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -24; this.comp.ratio.value = 3; this.comp.attack.value = 0.02; this.comp.release.value = 0.4;
    this.makeup = ctx.createGain();
    this.makeup.gain.value = 2.2;
    this.master.connect(this.comp); this.comp.connect(this.makeup); this.makeup.connect(ctx.destination);
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(3.2, 2.6);
    this.dry.connect(this.master);
    this.reverb.connect(this.wet);
    this.wet.connect(this.master);
    this.bus = ctx.createGain();
    this.bus.connect(this.dry);
    this.bus.connect(this.reverb);
    // a second, very long reverberation for great domed spaces (Hagia Sophia rings ~12 s)
    this.longReverb = ctx.createConvolver();
    this.longReverb.buffer = this.impulse(12, 3.2);
    this.wetLong = ctx.createGain(); this.wetLong.gain.value = 0;
    this.bus.connect(this.longReverb); this.longReverb.connect(this.wetLong); this.wetLong.connect(this.master);
    // a meter for the tests: RMS of what reaches the speakers
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.makeup.connect(this.analyser);
    this.timer = setInterval(() => this.tick(), 90);
  }

  /**
   * Weather you can hear: rain (filtered noise with drops) and wind (slowly swelling band noise).
   * rain, wind: 0…1; indoors muffles both.
   */
  ambience(rain, wind, indoors) {
    const ctx = this.ctx;
    if (!ctx) return;
    if (!this.amb) {
      const sr = ctx.sampleRate, n = sr * 4, b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const noise = () => { const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; s.start(); return s; };
      const rainG = ctx.createGain(); rainG.gain.value = 0;
      const rHP = ctx.createBiquadFilter(); rHP.type = 'highpass'; rHP.frequency.value = 700;
      const rLP = ctx.createBiquadFilter(); rLP.type = 'lowpass'; rLP.frequency.value = 6000;
      noise().connect(rHP); rHP.connect(rLP); rLP.connect(rainG);
      const windG = ctx.createGain(); windG.gain.value = 0;
      const wBP = ctx.createBiquadFilter(); wBP.type = 'bandpass'; wBP.frequency.value = 380; wBP.Q.value = 0.7;
      const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 0.09; lfoG.gain.value = 220;
      lfo.connect(lfoG); lfoG.connect(wBP.frequency); lfo.start();
      noise().connect(wBP); wBP.connect(windG);
      const muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 18000;
      rainG.connect(muffle); windG.connect(muffle); muffle.connect(this.makeup);
      this.amb = { rainG, windG, muffle };
    }
    const t = ctx.currentTime, a = this.amb;
    a.rainG.gain.setTargetAtTime(rain * 0.09, t, 1.5);
    a.windG.gain.setTargetAtTime(0.004 + wind * 0.05, t, 2.5);
    a.muffle.frequency.setTargetAtTime(indoors ? 900 : 18000, t, 0.8);
  }

  /** Current output level (RMS, 0…1). */
  level() {
    if (!this.analyser) return 0;
    const a = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(a);
    let s = 0;
    for (const v of a) s += v * v;
    return Math.sqrt(s / a.length);
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2);
  }

  impulse(seconds, decay) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay) * (i < ctx.sampleRate * 0.01 ? i / (ctx.sampleRate * 0.01) : 1);
    }
    return b;
  }

  /** Switch to a building's score and one of its zones. */
  set(score, zone) {
    if (!this.ctx) { this.score = score; this.zone = zone; return; }
    if (score !== this.score) {
      for (const [, l] of this.layers) this.fadeOut(l);
      this.layers.clear();
      this.score = score;
      this.zone = null;
    }
    if (!score || zone === this.zone) return;
    this.zone = zone;
    const t = this.ctx.currentTime;
    for (const [z, l] of this.layers) l.gain.gain.setTargetAtTime(z === zone ? 1 : 0, t, 1.2);
    if (!this.layers.has(zone)) this.layers.set(zone, this.makeLayer(score, zone));
    const Z = score.zones[zone] || {};
    this.wet.gain.setTargetAtTime((Z.reverb ?? 0.4) * 0.9, t, 1.5);
    this.dry.gain.setTargetAtTime(1 - (Z.reverb ?? 0.4) * 0.5 - (Z.reverbLong ?? 0) * 0.25, t, 1.5);
    this.wetLong.gain.setTargetAtTime((Z.reverbLong ?? 0) * 0.8, t, 2.0);
  }

  fadeOut(l) {
    l.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 1.0);
    setTimeout(() => { for (const o of l.stops) try { o.stop(); } catch { /* already stopped */ } l.gain.disconnect(); }, 6000);
  }

  makeLayer(score, zone) {
    const ctx = this.ctx, Z = score.zones[zone] || {};
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(1, ctx.currentTime, 1.2);
    gain.connect(this.bus);
    const stops = [];
    if (Z.drone) {
      for (const off of Z.drone.notes) {
        const f = mtof(score.tonic + off);
        const g = ctx.createGain();
        g.gain.value = Z.drone.level / Z.drone.notes.length;
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = f;
        const vib = ctx.createOscillator(), vg = ctx.createGain();
        vib.frequency.value = 4.6 + Math.random(); vg.gain.value = f * 0.004;
        vib.connect(vg); vg.connect(osc.frequency);
        const breath = ctx.createOscillator(), bg = ctx.createGain();
        breath.frequency.value = 0.07 + Math.random() * 0.05; bg.gain.value = Z.drone.level / Z.drone.notes.length * 0.5;
        breath.connect(bg); bg.connect(g.gain);
        if (Z.drone.timbre === 'voice') {
          // two vowel formants ("ah")
          for (const [fq, q, a] of [[730, 6, 1], [1090, 8, 0.5]]) {
            const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = q;
            const ag = ctx.createGain(); ag.gain.value = a * 1.6;
            osc.connect(bp); bp.connect(ag); ag.connect(g);
          }
          const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
          osc.connect(lp); lp.connect(g);
        } else if (Z.drone.timbre === 'sho') {
          // the shō: free reeds in bamboo pipes, a bright, still cluster that swells and fades
          osc.type = 'square'; vg.gain.value = f * 0.0008;
          bg.gain.value = Z.drone.level / Z.drone.notes.length * 0.9;
          const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f * 5; lp.Q.value = 0.5;
          const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = f * 0.8;
          osc.connect(hp); hp.connect(lp); lp.connect(g);
        } else {
          const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f * 3.2; lp.Q.value = 0.7;
          osc.connect(lp); lp.connect(g);
        }
        g.connect(gain);
        osc.start(); vib.start(); breath.start();
        stops.push(osc, vib, breath);
      }
    }
    return { gain, stops };
  }

  /** Karplus–Strong plucked string, rendered once per pitch. */
  harpBuffer(midi) {
    if (this.harpCache.has(midi)) return this.harpCache.get(midi);
    const ctx = this.ctx, sr = ctx.sampleRate, f = mtof(midi);
    const n = Math.floor(sr * 3.2), P = Math.max(2, Math.round(sr / f));
    const b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
    const ring = new Float32Array(P);
    for (let i = 0; i < P; i++) ring[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(Math.PI * i / P));
    let idx = 0, prev = 0;
    const damp = 0.996 - Math.min(0.006, f / 120000);
    for (let i = 0; i < n; i++) {
      const cur = ring[idx];
      const next = ring[(idx + 1) % P];
      const v = damp * 0.5 * (cur + next);
      ring[idx] = v;
      d[i] = cur * 0.6 + prev * 0.4;
      prev = cur;
      idx = (idx + 1) % P;
    }
    this.harpCache.set(midi, b);
    return b;
  }

  pluck(midi, when, level, timbre) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.harpBuffer(midi);
    const g = ctx.createGain();
    g.gain.value = level;
    // the kithara's gut strings over a wooden box sound brighter and drier than the harp
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = timbre === 'kithara' ? 5200 : timbre === 'oud' ? 1900 : timbre === 'pipa' ? 4200 : timbre === 'koto' ? 3600 : 3200;
    src.connect(lp); lp.connect(g); g.connect(this.layers.get(this.zone).gain);
    src.start(when);
  }

  /** A reed melody note: two slightly detuned pipes (the double aulos), nasal formant, breath. */
  blow(midi, when, dur, level) {
    const ctx = this.ctx, f = mtof(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(level, when + 0.08);
    g.gain.setValueAtTime(level, when + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1250; bp.Q.value = 1.4;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f * 6;
    for (const det of [-4, 4]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      const v = ctx.createOscillator(), vg = ctx.createGain();
      v.frequency.value = 5.2; vg.gain.value = f * 0.006;
      v.connect(vg); vg.connect(o.frequency);
      o.connect(bp); o.start(when); o.stop(when + dur + 0.05); v.start(when); v.stop(when + dur + 0.05);
    }
    bp.connect(lp); lp.connect(g); g.connect(this.layers.get(this.zone).gain);
  }

  /** A sung note: two voices a few cents apart through the formants of a vowel. */
  sing(midi, when, dur, level) {
    const ctx = this.ctx, f = mtof(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(level, when + 0.22);
    g.gain.setValueAtTime(level, when + dur * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const vowels = [[730, 1090, 2440], [570, 840, 2410], [530, 1840, 2480], [300, 870, 2240]];
    const V = vowels[Math.floor(Math.random() * vowels.length)];
    const mix = ctx.createGain(); mix.gain.value = 1;
    V.forEach((fq, i) => {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = 7 + i * 3;
      const ag = ctx.createGain(); ag.gain.value = [1.6, 0.8, 0.35][i];
      mix.connect(bp); bp.connect(ag); ag.connect(g);
    });
    const body = ctx.createBiquadFilter(); body.type = 'lowpass'; body.frequency.value = Math.max(400, f * 2.5);
    const bg = ctx.createGain(); bg.gain.value = 0.5;
    mix.connect(body); body.connect(bg); bg.connect(g);
    for (const det of [-7, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      const v = ctx.createOscillator(), vg = ctx.createGain();
      v.frequency.value = 4.8 + Math.random() * 0.6; vg.gain.setValueAtTime(0, when); vg.gain.linearRampToValueAtTime(f * 0.007, when + 0.6);
      v.connect(vg); vg.connect(o.frequency);
      if (this.ornament) {
        // melismatic ornament: slide up into the note, a turn around it before it settles
        o.detune.setValueAtTime(det - 120, when);
        o.detune.linearRampToValueAtTime(det, when + 0.12);
        if (dur > 1.2 && Math.random() < 0.6) {
          const t1 = when + dur * 0.45;
          o.detune.setValueAtTime(det, t1); o.detune.linearRampToValueAtTime(det + 150, t1 + 0.12);
          o.detune.linearRampToValueAtTime(det - 100, t1 + 0.26); o.detune.linearRampToValueAtTime(det, t1 + 0.38);
        }
      }
      o.connect(mix); o.start(when); o.stop(when + dur + 0.05); v.start(when); v.stop(when + dur + 0.05);
    }
    g.connect(this.layers.get(this.zone).gain);
  }

  /** The reed flute (ney): a breathy, nearly pure tone with a soft attack. */
  flute(midi, when, dur, level) {
    const ctx = this.ctx, f = mtof(midi), sr = ctx.sampleRate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(level, when + 0.18);
    g.gain.setValueAtTime(level * 0.85, when + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const v = ctx.createOscillator(), vg = ctx.createGain(); v.frequency.value = 4.2; vg.gain.value = f * 0.005;
    v.connect(vg); vg.connect(o.frequency);
    const og = ctx.createGain(); og.gain.value = 0.8; o.connect(og); og.connect(g);
    // breath: band-passed noise around the note
    const n = ctx.createBufferSource(), b = ctx.createBuffer(1, Math.floor(sr * (dur + 0.1)), sr), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    n.buffer = b;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 2.5;
    const ng = ctx.createGain(); ng.gain.value = 0.35;
    n.connect(bp); bp.connect(ng); ng.connect(g);
    g.connect(this.layers.get(this.zone).gain);
    o.start(when); o.stop(when + dur + 0.05); v.start(when); v.stop(when + dur + 0.05); n.start(when);
  }

  /** A peal of church bells: a few strikes of an inharmonic bell (hum, prime, tierce, quint, nominal). */
  bells(when, level) {
    const ctx = this.ctx;
    const base = [196, 233, 262][Math.floor(Math.random() * 3)];
    for (let s = 0; s < 3; s++) {
      const t0 = when + s * 1.4, f0 = base * [1, 0.89, 0.75][s];
      for (const [r, a, d] of [[0.5, 0.5, 5], [1, 0.8, 3.5], [1.19, 0.45, 2.5], [1.5, 0.3, 2], [2, 0.55, 1.6], [2.66, 0.2, 1.1], [3.0, 0.15, 0.8]]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f0 * r;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(level * a * 0.4, t0 + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
        o.connect(g); g.connect(this.layers.get(this.zone).gain);
        o.start(t0); o.stop(t0 + d + 0.05);
      }
    }
  }

  /** The wooden fish (muyu): a hollow knock. */
  woodfish(when, level) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(820, when); o.frequency.exponentialRampToValueAtTime(640, when + 0.05);
    g.gain.setValueAtTime(level, when); g.gain.exponentialRampToValueAtTime(0.001, when + 0.11);
    o.connect(g); g.connect(this.layers.get(this.zone).gain); o.start(when); o.stop(when + 0.13);
  }

  /** The bowl-bell (qing): a long shimmering ring, slightly beating partials. */
  qing(when, level) {
    const ctx = this.ctx;
    for (const [r, a, d] of [[1, 1, 9], [1.004, 0.6, 9], [2.71, 0.45, 5], [5.15, 0.25, 3], [8.3, 0.12, 1.6]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 523 * r;
      g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(level * a * 0.35, when + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, when + d);
      o.connect(g); g.connect(this.layers.get(this.zone).gain); o.start(when); o.stop(when + d + 0.05);
    }
  }

  /** The semantron: a wooden board struck with a mallet, in a run that quickens. */
  semantron(when, level) {
    const ctx = this.ctx, sr = ctx.sampleRate;
    let t = when;
    for (let i = 0; i < 9; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      const pitch = i % 3 === 2 ? 520 : 690;
      o.frequency.setValueAtTime(pitch, t);
      g.gain.setValueAtTime(level, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      const n = ctx.createBufferSource(), b = ctx.createBuffer(1, Math.floor(sr * 0.03), sr), d = b.getChannelData(0);
      for (let k = 0; k < d.length; k++) d[k] = (Math.random() * 2 - 1) * Math.exp(-k / (sr * 0.004));
      n.buffer = b;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = pitch * 2.2; bp.Q.value = 3;
      const ng = ctx.createGain(); ng.gain.value = level * 0.6;
      o.connect(g); n.connect(bp); bp.connect(ng);
      g.connect(this.layers.get(this.zone).gain); ng.connect(this.layers.get(this.zone).gain);
      o.start(t); o.stop(t + 0.1); n.start(t);
      t += 0.42 - i * 0.03;
    }
  }

  sistrum(when, level) {
    const ctx = this.ctx, sr = ctx.sampleRate;
    const n = Math.floor(sr * 0.9), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
    // metal discs on rods: a few shakes of inharmonic jingles
    const parts = [4200, 5600, 6900, 8300, 9700];
    for (let s = 0; s < 3; s++) {
      const off = Math.floor(s * 0.16 * sr);
      for (let i = 0; i < n - off; i++) {
        const t = i / sr, env = Math.exp(-t * 9);
        let v = 0;
        for (const p of parts) v += Math.sin(2 * Math.PI * p * t * (1 + s * 0.01)) * (Math.random() * 0.6 + 0.4);
        d[i + off] += v * env * 0.08 * (1 - s * 0.25);
      }
    }
    const src = ctx.createBufferSource(); src.buffer = b;
    const g = ctx.createGain(); g.gain.value = level;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    src.connect(hp); hp.connect(g); g.connect(this.layers.get(this.zone).gain);
    src.start(when);
  }

  drum(when, level) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(115, when);
    o.frequency.exponentialRampToValueAtTime(62, when + 0.18);
    g.gain.setValueAtTime(level, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.45);
    o.connect(g); g.connect(this.layers.get(this.zone).gain);
    o.start(when); o.stop(when + 0.5);
    // skin slap
    const n = ctx.createBufferSource(), sr = ctx.sampleRate;
    const b = ctx.createBuffer(1, Math.floor(sr * 0.06), sr), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.012));
    n.buffer = b;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.8;
    const ng = ctx.createGain(); ng.gain.value = level * 0.5;
    n.connect(bp); bp.connect(ng); ng.connect(this.layers.get(this.zone).gain);
    n.start(when);
  }

  tick() {
    const ctx = this.ctx, S = this.score;
    if (!ctx || !S || !this.zone || !this.layers.has(this.zone) || this.volume <= 0) return;
    const Z = S.zones[this.zone] || {};
    const spb = 60 / S.tempo;
    if (this.next < ctx.currentTime) this.next = ctx.currentTime + 0.05;
    while (this.next < ctx.currentTime + 0.3) {
      const t = this.next, beat = this.beat++;
      // harp phrases: a few notes moving by step or leap within the mode, then rests
      if (Z.harp) {
        if (this.phrase.left <= 0 && Math.random() < Z.harp.density * 0.4) this.phrase.left = 3 + Math.floor(Math.random() * 6);
        if (this.phrase.left > 0) {
          this.phrase.left--;
          const sc = S.scale, [lo, hi] = Z.harp.range;
          this.phrase.deg += [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)];
          const maxDeg = Math.floor((hi / 12) * sc.length) + sc.length, minDeg = Math.floor((lo / 12) * sc.length);
          this.phrase.deg = Math.max(minDeg, Math.min(maxDeg, this.phrase.deg));
          const deg = this.phrase.deg, oct = Math.floor(deg / sc.length), st = sc[((deg % sc.length) + sc.length) % sc.length];
          const midi = S.tonic + oct * 12 + st;
          const swing = (Math.random() - 0.5) * 0.06;
          this.pluck(midi, t + swing, Z.harp.level * (0.6 + Math.random() * 0.4), Z.harp.timbre);
          if (Math.random() < 0.18) this.pluck(midi - 7, t + swing + 0.02, Z.harp.level * 0.5, Z.harp.timbre);     // a fifth below
          if (this.phrase.left === 0) this.beat += 2 + Math.floor(Math.random() * 4);           // breath between phrases
        }
      }
      // reed melody: long notes moving by step, often answering the strings
      if (Z.lead && (Z.lead.rhythm || beat % 2 === 0) && Math.random() < Z.lead.density) {
        const sc = S.scale, [lo, hi] = Z.lead.range;
        this.leadDeg = (this.leadDeg ?? Math.floor(sc.length * 1.5)) + [-1, -1, 0, 1, 1, 2, -2][Math.floor(Math.random() * 7)];
        const minDeg = Math.ceil((lo / 12) * sc.length), maxDeg = Math.floor((hi / 12) * sc.length);
        this.leadDeg = Math.max(minDeg, Math.min(maxDeg, this.leadDeg));
        const d = this.leadDeg, midi = S.tonic + Math.floor(d / sc.length) * 12 + sc[((d % sc.length) + sc.length) % sc.length];
        this.ornament = !!Z.lead.ornament;
        if (Z.lead.timbre === 'voice') this.sing(midi, t, Z.lead.rhythm ? spb * Z.lead.rhythm[beat % Z.lead.rhythm.length] * 1.05 : spb * (2 + Math.random() * 2.5), Z.lead.level);
        else if (Z.lead.timbre === 'ney') this.flute(midi, t, spb * (1.5 + Math.random() * 2.5), Z.lead.level);
        else this.blow(midi, t, spb * (1.5 + Math.random() * 2), Z.lead.level);
      }
      if (Z.semantron && beat % Z.semantron.every === 0 && Math.random() < 0.5) this.semantron(t, Z.semantron.level);
      if (Z.sistrum && beat % Z.sistrum.every === Z.sistrum.every - 1 && Math.random() < 0.7) this.sistrum(t, Z.sistrum.level);
      if (Z.drum) {
        const p = Z.drum.pattern, v = p[beat % p.length];
        if (v && Math.floor(beat / p.length) % (Z.drum.every || 1) === 0) this.drum(t, Z.drum.level * v);
      }
      if (Z.bells && beat % Z.bells.every === 0) this.bells(t, Z.bells.level);
      if (Z.woodfish) this.woodfish(t, Z.woodfish.level * (beat % 4 === 0 ? 1 : 0.7));
      if (Z.qing && beat % Z.qing.every === 0) this.qing(t, Z.qing.level);
      this.next += Z.lead?.rhythm ? spb * Z.lead.rhythm[beat % Z.lead.rhythm.length] : spb * (Math.random() < 0.2 ? 1.5 : 1);
    }
  }
}
