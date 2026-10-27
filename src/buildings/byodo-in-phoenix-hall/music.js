// Music of the Phoenix Hall (docs/buildings/byodo-in-phoenix-hall.md §11): outside, the court
// music of the Heian period (gagaku) — the mouth organ shō holding its clusters, a flute in a
// slow melody, the koto plucking on the beat; inside the hall, a chanting voice (shōmyō) over a
// drone and a small bell now and then. A pentatonic mode on E (the hyōjō mode of tōgaku).

export default {
  tonic: 52,                              // E3
  scale: [0, 2, 5, 7, 9],                 // hyōjō-like pentatonic
  tempo: 54,
  zones: {
    open: {
      drone: { notes: [12, 19, 24, 26], level: 0.045, timbre: 'sho' },
      harp: { density: 0.25, range: [7, 22], level: 0.18, timbre: 'koto' },
      lead: { timbre: 'ney', density: 0.4, range: [12, 26], level: 0.09, rhythm: [2, 1, 1, 2, 2] },
      reverb: 0.35,
    },
    hall: {
      drone: { notes: [-12, 0], level: 0.06, timbre: 'voice' },
      lead: { timbre: 'voice', density: 0.8, range: [0, 12], level: 0.13, rhythm: [2, 1, 1, 2] },
      qing: { every: 24, level: 0.16 },
      reverb: 0.6,
    },
  },
};
