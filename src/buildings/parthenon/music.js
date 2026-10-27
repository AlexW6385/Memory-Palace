// Music of the Parthenon (docs/buildings/parthenon.md §11): the Dorian species on E
// (E F G A B C D), kithara and aulos; dignified, slow, open.

export default {
  tonic: 52,                              // E3
  scale: [0, 1, 3, 5, 7, 8, 10],          // ancient Dorian: semitone at the bottom
  tempo: 60,
  zones: {
    open: {
      drone: { notes: [0, 7], level: 0.09, timbre: 'reed' },        // the aulos's drone pipe
      lead: { timbre: 'aulos', density: 0.35, range: [12, 26], level: 0.16 },
      harp: { density: 0.4, range: [12, 28], level: 0.28, timbre: 'kithara' },
      reverb: 0.3,
    },
    hall: {
      drone: { notes: [0, 7], level: 0.07, timbre: 'reed' },
      harp: { density: 0.28, range: [7, 24], level: 0.3, timbre: 'kithara' },
      reverb: 0.7,
    },
    inner: {
      harp: { density: 0.12, range: [7, 19], level: 0.2, timbre: 'kithara' },
      reverb: 0.6,
    },
  },
};
