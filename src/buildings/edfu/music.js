// Music of the Temple of Horus (docs/buildings/edfu.md §11).
// An anhemitonic pentatonic mode on D; angular harp, sistrum, frame drum and clappers in the
// open; a low sung drone in the halls; near silence in the sanctuary. Synthesised by
// src/engine/audio.js from this description.

export default {
  tonic: 62,                       // D4 (MIDI)
  scale: [0, 2, 5, 7, 10],         // D E G A C
  tempo: 56,
  zones: {
    open: {
      drone: { notes: [-12, -5], level: 0.12, timbre: 'reed' },
      harp: { density: 0.55, range: [0, 14], level: 0.32 },
      sistrum: { every: 8, level: 0.07 },
      drum: { pattern: [1, 0, 0, 0.5, 0, 0, 0.7, 0], level: 0.16, every: 2 },
      reverb: 0.25,
    },
    hall: {
      drone: { notes: [-12, -5, 0], level: 0.16, timbre: 'voice' },
      harp: { density: 0.3, range: [-5, 9], level: 0.25 },
      sistrum: { every: 12, level: 0.05 },
      reverb: 0.55,
    },
    inner: {
      drone: { notes: [-12, -5], level: 0.15, timbre: 'voice' },
      harp: { density: 0.14, range: [-5, 7], level: 0.18 },
      reverb: 0.65,
    },
    sanctum: {
      drone: { notes: [-17, -12], level: 0.12, timbre: 'voice' },
      sistrum: { every: 16, level: 0.04 },
      reverb: 0.8,
    },
  },
};
