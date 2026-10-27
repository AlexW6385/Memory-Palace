// Music of the Pantheon (docs/buildings/pantheon.md §11): the Lydian species on F, the tibia
// (double pipe) in the portico, the lyre under the dome with its long reverberation.

export default {
  tonic: 53,                              // F3
  scale: [0, 2, 4, 5, 7, 9, 11],          // Lydian (ancient), the major-like species
  tempo: 54,
  zones: {
    open: {
      drone: { notes: [0, 7], level: 0.08, timbre: 'reed' },
      lead: { timbre: 'aulos', density: 0.4, range: [12, 26], level: 0.15 },
      harp: { density: 0.2, range: [12, 24], level: 0.18, timbre: 'kithara' },
      reverb: 0.35,
    },
    hall: {
      drone: { notes: [-12, 0], level: 0.06, timbre: 'voice' },
      harp: { density: 0.22, range: [5, 24], level: 0.28, timbre: 'kithara' },
      lead: { timbre: 'aulos', density: 0.12, range: [12, 24], level: 0.08 },
      reverb: 0.95,
    },
  },
};
