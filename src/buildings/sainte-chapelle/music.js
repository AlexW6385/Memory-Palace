// Music of the Sainte-Chapelle (docs/buildings/sainte-chapelle.md §11): Paris in the 1240s, the
// organum of the Notre-Dame school — a plainchant tenor held in long notes, an upper voice moving
// above it in the long–short pattern of the first rhythmic mode; in the lower chapel plainchant
// alone; outside, a bowed drone and the bells of the palace.

export default {
  tonic: 50,                              // D3
  scale: [0, 2, 3, 5, 7, 9, 10],          // first mode (Dorian) on D
  tempo: 66,
  zones: {
    open: {
      drone: { notes: [0, 7], level: 0.05, timbre: 'reed' },
      bells: { every: 40, level: 0.16 },
      reverb: 0.3,
    },
    hall: {
      drone: { notes: [-12, 0], level: 0.08, timbre: 'voice' },
      lead: { timbre: 'voice', density: 0.8, range: [7, 19], level: 0.15, rhythm: [2, 1] },
      reverb: 0.8,
      reverbLong: 0.45,
    },
  },
};
