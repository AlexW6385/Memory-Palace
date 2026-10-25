# Memory Palace

[中文说明](README.zh-CN.md)

A walkable 3D memory palace for the method of loci, built from real kinds of buildings of many ages, each
planned the way it was actually used. The loci are the things that stood in them, in their places, numbered
along the route. What you hang on them lives in your head.

**Walk it: <https://alexw6385.github.io/Memory-Palace/>** (desktop or phone, English or Chinese)

## Why real buildings

The method of loci works because a place you know has an order you never have to remember: the gate comes
before the court, the altar stands in front of the shrine, the lamp is on the wall by the door. A building
designed for a purpose gives every room a reason to be where it is and every object a reason to be in its room.
Random rooms full of random objects have none of that, so they do not hold memories.

So each site here is planned as the real thing would be, after real examples, and its loci are the real things
in it.

## The first site: a temple of Horus

After the temple at Edfu (237–57 BC), the best preserved temple of ancient Egypt. The route through it is the
route of the daily ritual:

1. **The approach** — the god's barge at the quay, an avenue of ram-headed sphinxes, a barque way station.
2. **The pylon** — two towers carved with the king smiting his enemies, obelisks, colossi, flagpoles, the great gate.
3. **The court of offerings** — the last place open to the sky: basin, stela, falcons of Horus, the great altar.
4. **The halls** — the pronaos (18 columns, each capital a different plant, with the House of Books and the robing
   room), the hall of appearances (laboratory, treasury, Nile room, storeroom), the offering hall with its stairs
   to the roof, the hall of the Ennead. Each hall is a step higher, lower and darker than the last.
5. **The sanctuary** — the sacred barque and the granite naos, and around them the corridor of mysteries with
   nine chapels of the gods of Horus's family and myth.
6. **The precinct** — the ambulatory carved with the myth of Horus and Seth, the sacred lake, the scarab and the
   nilometer.

47 loci in all. Look at one and its number and name appear; **N** and **B** step along the route.

**Controls:** W A S D to walk, drag to look, Shift to run, `N` / `B` next or previous locus, `M` for the map,
`P` for places. On a phone, the joystick walks and dragging looks. **Places** lists every room and locus.

## Run locally

```bash
pip install -e ".[dev]"
python -m palace build      # lay out the sites → web/data/world.json
python -m palace serve      # http://127.0.0.1:8000
```

## How it is built

```
palace/site.py         drawing a site like a plan: walls between corners, doorways, floors, roofs, pieces, loci
palace/sites/edfu.py   the temple of Horus: its plan, rooms and loci, with the reasoning in comments
palace/world.py        assembles the sites → web/data/world.json
palace/nav.py          walkability; tests prove every locus can be reached and seen
web/js/sites/          Egyptian architecture (battered walls, cornices, columns, painted ceilings), statues,
                       furnishings, and canvas textures for carved stone and reliefs
web/js/                three.js viewer: world, navigation, map, places, light
```

Everything is procedural (no model or image files). The viewer lets daylight fade as you go deeper in and
lights the nearest lamps.

## Development

```bash
pytest -q                                  # plan, reachability, JS/Python parity
python3 tools/view_shot.py --js "palace.goLocus('edfu-33')" --wait 3000 --shot out.png
```

Every push to `master` runs the tests, lays out the sites and publishes `web/` to GitHub Pages.

## License

MIT
