// Music of Sainte-Foy de Conques (docs/buildings/sainte-foy-conques.md §11): the pilgrimage
// churches of southern France about 1100 — plainchant in the church modes over the drone of an
// organistrum, and the early Aquitanian organum, a florid voice above the held chant; outside,
// the organistrum's drone, the pilgrims' refrain and the abbey's bells.

export default {
  tonic: 52,                              // E3
  scale: [0, 1, 3, 5, 7, 8, 10],          // third mode (Phrygian) on E
  tempo: 60,
  zones: {
    open: {
      drone: { notes: [0, 7], level: 0.06, timbre: 'reed' },
      lead: { timbre: 'reed', density: 0.35, range: [0, 12], level: 0.06, rhythm: [2, 1] },
      bells: { every: 48, level: 0.14 },
      reverb: 0.3,
    },
    hall: {
      drone: { notes: [-12, 0], level: 0.08, timbre: 'voice' },
      lead: { timbre: 'voice', density: 0.6, range: [0, 12], level: 0.13, rhythm: [1, 1] },
      reverb: 0.75,
      reverbLong: 0.5,
    },
    sanctuary: {
      drone: { notes: [-12, 0, 7], level: 0.08, timbre: 'voice' },
      lead: { timbre: 'voice', density: 0.85, range: [7, 19], level: 0.14, rhythm: [2, 1] },
      reverb: 0.8,
      reverbLong: 0.55,
    },
  },
};
