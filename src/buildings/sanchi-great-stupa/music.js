// Music at the Great Stupa (docs/buildings/sanchi-great-stupa.md §11): a drone of tonic and
// fifth, a plucked string in a slow mode like the later raga Bhupali (pentatonic), a recited
// chant near the stupa, small bells.

export default {
  tonic: 49,                              // C#3
  scale: [0, 2, 4, 7, 9],                 // Bhupali-like pentatonic
  tempo: 60,
  zones: {
    open: {
      drone: { notes: [0, 7, 12], level: 0.05 },
      harp: { density: 0.3, range: [7, 24], level: 0.2, timbre: 'pipa' },
      reverb: 0.3,
    },
    stupa: {
      drone: { notes: [-12, 0, 7], level: 0.06, timbre: 'voice' },
      lead: { timbre: 'voice', density: 0.75, range: [0, 12], level: 0.13, rhythm: [1, 1, 2, 1, 1, 2] },
      qing: { every: 32, level: 0.12 },
      reverb: 0.3,
    },
  },
};
