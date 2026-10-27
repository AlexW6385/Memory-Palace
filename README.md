# Memory Palace

[中文说明](README.zh-CN.md)

A walkable, realistic 3D world of **architecture**: buildings of every age, civilization and style, each built after a real example and planned the way the real thing was used, with real materials, light and shadow, and music in the manner of its civilization and time.

**Walk it: <https://alexw6385.github.io/Memory-Palace/>** — desktop or phone, a browser with WebGPU (Chrome, Edge, Safari 26). English or Chinese.

The name is meant in two senses. These buildings are the memory of civilizations; and a well-planned building already gives every room and object a place and an order, which is what the classical memory palace needs. But this is a world to walk, not a study tool: no notes, no markers, no route. Where a building has a route, its architecture shows it.

## What you can visit

- **The Temple of Horus at Edfu** (Ptolemaic Egypt, 237–57 BC), the best preserved temple of ancient Egypt, at true scale: the pylon with its flagpoles and granite falcons, the court of 32 columns, the pronaos of 18, the hall of appearances, the offering hall, the hall of the Ennead, the sanctuary with the granite naos of Nectanebo II and the sacred barque, the corridor of mysteries and its nine chapels, and the ambulatory inside the enclosure wall — each hall higher, lower and darker than the last. On the bank of a river, among palms.

- **The Parthenon** (Athens, 447–432 BC) on its Acropolis rock: the full Doric order, the pediments, the two-tier colonnade around the gold-and-ivory Athena Parthenos and the pool before her, and the treasury room with its four Ionic columns.
- **The Pantheon** (Rome, c. AD 114–128): the portico of sixteen granite columns, the bronze doors, the rotunda of coloured marbles under the coffered dome and its open oculus.
- **The Dome of the Rock** (Jerusalem, 691/92): the golden dome over the Rock, the octagon of marble and mosaic, its two ambulatories and gilded arcades, on its platform with the Dome of the Chain, among olive groves and a town of domed stone houses.
- **Hagia Sophia** (Constantinople, 532–537, dome rebuilt 562): the dome on its ring of forty windows over pendentives, semidomes and exedrae, galleries, gold mosaic and marble, the chancel and ambo, the narthexes and the atrium — in a city of tiled houses on the hills above the water.

Each building stands in a **region** of its own — a basin of the same river valley with its landform, ground, plants, settlement and roads, and its own sky: time of day, haze, and weather that changes as you walk (drifting cloud shadows, dust, rain and wet ground, wind). Roads cross the ridges between regions over passes.

More buildings, one from each major tradition, are next (see [DESIGN.md](DESIGN.md) §11).

## Controls

W A S D or arrows to walk, mouse to look (click to capture the mouse), Shift to run, M for the map, Esc to pause. On a phone: left thumb on the stick to walk, drag anywhere to look. Click to look around (the world opens by itself once loaded). On the map, click anywhere to go there, or a building to go to its entrance.

## How it is made

- **Dossier first.** Every building is built from a sourced dossier in [`docs/buildings/`](docs/buildings) (real example, plan and dimensions, structure, use, materials, decoration, light, music; what is stated by sources and what is inferred). The world layout is in [`docs/world.md`](docs/world.md).
- **Plan is data, look is code.** A building is a plan of walls, openings, floors, roofs, columns and objects in metres (`src/buildings/<id>/plan.js`), drawn by the reusable vocabulary of its civilization (`src/styles/<civilization>/`: columns and capitals, torus and cornice, pylons, door frames, statues).
- **Renderer:** three.js WebGPU (WebGL 2 fallback), procedural physically based materials aligned to each wall's real coursing, cascaded sun shadows, GTAO, bloom, AgX tone mapping, and eye adaptation.
- **Baked light:** indirect light (sky, sun bounced off stone, oil lamps) is ray traced offline into an irradiance volume per building (`tools/bake.mjs` → `data/gi/`), loaded with the building.
- **Landscape:** one height function for the whole valley, drawn as terrain chunks with levels of detail built in workers; ground cover and planting by region; trees, palms and grass instanced, with levels of detail and wind (`src/world/`, `src/engine/flora/`).
- **Music:** synthesised in the browser from each building's score (`src/buildings/<id>/music.js`); it changes as you pass from open courts to halls to the sanctuary.

Pure static ES modules — no build step, no server. three.js comes from a CDN.

## Development

```bash
npm install                      # dev tools only: playwright, three, three-mesh-bvh
npm run serve                    # http://127.0.0.1:8000
npm run check                    # plan check: walkability, every room reachable, doors connect, nothing floating
npm run bake -- edfu             # bake a building's indirect light into data/gi/edfu.bin
npm run shot -- --building edfu  # screenshots at the fixed viewpoints in tools/viewpoints.json → shots/
npm run budget                   # load and size budgets
npm test
```

Every push to `master` runs the checks and publishes the site to GitHub Pages.

## License

MIT. Third-party assets are listed in [ASSETS.md](ASSETS.md).
