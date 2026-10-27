// Music of the Great East Hall (docs/buildings/foguang-east-hall.md §11): inside, a chanted
// sutra on the gong pentatonic mode over a low drone, the wooden fish keeping time and the
// bowl-bell sounding now and then; outside, the pipa and the vertical flute of the Tang.

export default {
  tonic: 50,                              // D3
  scale: [0, 2, 4, 7, 9],                 // gong mode (pentatonic)
  tempo: 72,
  zones: {
    open: {
      harp: { density: 0.35, range: [7, 24], level: 0.2, timbre: 'pipa' },
      lead: { timbre: 'ney', density: 0.3, range: [12, 26], level: 0.09 },
      reverb: 0.3,
    },
    hall: {
      drone: { notes: [-12, 0], level: 0.06, timbre: 'voice' },
      lead: { timbre: 'voice', density: 0.85, range: [0, 12], level: 0.14, rhythm: [1, 1, 1, 1, 2] },
      woodfish: { level: 0.16 },
      qing: { every: 32, level: 0.2 },
      reverb: 0.55,
    },
  },
};
