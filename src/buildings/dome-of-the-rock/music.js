// Music of the Dome of the Rock (docs/buildings/dome-of-the-rock.md §11): inside, a single voice
// in a slow ornamented line over a soft drone, in a mode with a neutral second (Bayati-like, on
// D); outside, the oud, the reed flute and the frame drum of the Umayyad town.

export default {
  tonic: 50,                                 // D3
  scale: [0, 1.5, 3, 5, 7, 8, 10],           // the second a three-quarter tone above the tonic
  tempo: 52,
  zones: {
    open: {
      drone: { notes: [0], level: 0.04, timbre: 'reed' },
      harp: { density: 0.3, range: [0, 17], level: 0.2, timbre: 'oud' },
      lead: { timbre: 'ney', density: 0.25, range: [12, 24], level: 0.1 },
      drum: { pattern: [1, 0, 0.5, 0, 0.8, 0.4, 0.5, 0], level: 0.12, every: 2 },
      reverb: 0.3,
    },
    hall: {
      drone: { notes: [-12, 0], level: 0.05, timbre: 'voice' },
      lead: { timbre: 'voice', density: 0.55, range: [5, 17], level: 0.17, ornament: true },
      reverb: 0.75,
    },
  },
};
