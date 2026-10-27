// Music of Hagia Sophia (docs/buildings/hagia-sophia.md §11): Byzantine chant — a single line
// sung by voices over the ison (a held drone on the tonic), in the first mode (on D), slowly,
// because under the dome every sound rings for about twelve seconds. Outside, the semantron.

export default {
  tonic: 50,                              // D3
  scale: [0, 2, 3, 5, 7, 9, 10],          // first mode (Dorian-like on D)
  tempo: 40,
  zones: {
    open: {
      drone: { notes: [0], level: 0.04, timbre: 'voice' },
      lead: { timbre: 'voice', density: 0.18, range: [7, 19], level: 0.1 },
      semantron: { every: 48, level: 0.22 },
      reverb: 0.3,
    },
    hall: {
      drone: { notes: [-12, 0], level: 0.09, timbre: 'voice' },
      lead: { timbre: 'voice', density: 0.42, range: [5, 19], level: 0.16 },
      reverb: 0.6,
      reverbLong: 1.0,
    },
  },
};
