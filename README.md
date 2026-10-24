# Memory Palace

[中文说明](README.zh-CN.md)

A walkable 3D city for the method of loci. It gives you places — rooms full of distinct objects along
clear routes — and nothing else. What you hang on them lives in your head.

**Walk it: <https://alexw6385.github.io/memory-palace/>** (desktop or phone, English or Chinese)

## The method

The method of loci is the oldest memory technique. You turn each thing to remember into a vivid, strange
image and put it at a place along a route you know well: the clock on the first plinth, the moon on the
second. To recall, you walk the route again, here or in your mind, and the images are where you left them.

The palace is built for that:

- **Many places.** A central palace and eight buildings around it — an observatory tower, a library, a theatre,
  a harbour, a market, a foundry, a cathedral and a conservatory — with 74 rooms and 444 loci.
- **No two alike.** Every locus holds a different object, and every room has its own style, colours and light
  (a library of bookshelves, a casino, a fish market, a crypt…), so places never blur into each other.
- **Clear routes.** Each building strings its rooms along one walk; in each room the loci alternate left and
  right along the aisle.
- **Never changes.** The city is laid out deterministically from [content/city.json](content/city.json). New
  buildings may be added on free ground, but existing rooms and objects never move.
- **Nothing recorded.** No accounts, no notes, no tracking. The page only remembers where you were standing.

**Controls:** W A S D to walk, drag to look, Shift to run, `M` for the map, `P` for places. On a phone, the
joystick walks and dragging looks. **Places** lists every building and room and takes you there.

## Run locally

```bash
pip install -e ".[dev]"
python -m palace build      # lay out the city → web/data/world.json
python -m palace serve      # http://127.0.0.1:8000
```

## How it is built

```
content/city.json      the plan: buildings > wings > rooms, each room with a style (bilingual names)
palace/catalog/        208 procedural props and 26 room styles
palace/loci.py         gives every locus its own object, deterministically
palace/halls.py        themed through-halls with loci along both sides
palace/templates.py    five building forms: spiral tower, stepped terraces, avenue, radial hub, districts
palace/world.py        lays out the city, scenery and walkable surfaces → web/data/world.json
palace/nav.py          walkability; tests prove every locus can be reached
web/js/                three.js viewer (arch.js architecture, loci.js objects, props/ models, map, UI)
```

Every prop is a small procedural model in `web/js/props/` (no asset files). Objects are built as you approach
and dropped behind you. Docs: [props](docs/props.md), [room styles](docs/rooms.md),
[modelling guide](docs/modeling-guide.md).

## Development

```bash
pytest -q                                  # plan, layout, reachability, JS/Python parity
node tests/js/props.test.mjs               # build every prop and check its size (needs `npm install`)
python3 tools/lab_shot.py "group=animals" out.png
python3 tools/view_shot.py --js "palace.goRoom(palace.data.buildings[2].wings[0].rooms[0])" --wait 3000 --shot out.png
```

Every push to `master` runs the tests, lays out the city and publishes `web/` to GitHub Pages.

## License

MIT
