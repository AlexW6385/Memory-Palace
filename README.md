# Memory Palace

[中文说明](README.zh-CN.md)

A walkable, realistic 3D world of **architecture**: buildings of every age, civilization and style, each built after a real example and planned the way the real thing was used, with real materials, light and shadow, and music in the manner of its civilization and time.

**Walk it: <https://alexw6385.github.io/Memory-Palace/>** — desktop or phone, a browser with WebGPU (Chrome, Edge, Safari 26). English or Chinese.

The name is meant in two senses. These buildings are the memory of civilizations; and a well-planned building already gives every room and object a place and an order, which is what the classical memory palace needs. But this is a world to walk, not a study tool: no notes, no markers, no route. Where a building has a route, its architecture shows it.

## What you can visit

- **The Temple of Horus at Edfu** (Ptolemaic Egypt, 237–57 BC), the best preserved temple of ancient Egypt, at true scale: the pylon with its flagpoles and granite falcons, the court of 32 columns, the pronaos of 18, the hall of appearances, the offering hall, the hall of the Ennead, the sanctuary with the granite naos of Nectanebo II and the sacred barque, the corridor of mysteries and its nine chapels, and the ambulatory inside the enclosure wall — each hall higher, lower and darker than the last. Among the mud-brick houses and palms of its town.

- **The Parthenon** (Athens, 447–432 BC) on its Acropolis rock: the full Doric order, the pediments, the two-tier colonnade around the gold-and-ivory Athena Parthenos and the pool before her, and the treasury room with its four Ionic columns.
- **The Pantheon** (Rome, c. AD 114–128): the portico of sixteen granite columns, the bronze doors, the rotunda of coloured marbles under the coffered dome and its open oculus.
- **The Dome of the Rock** (Jerusalem, 691/92): the golden dome over the Rock, the octagon of marble and mosaic, its two ambulatories and gilded arcades, on its platform with the Dome of the Chain, on its hill among olive trees and domed stone houses.
- **The Sainte-Chapelle** (Paris, 1242–1248): the lower chapel of painted columns, and above it the upper chapel, a cage of fifteen stained-glass windows under a blue vault of gold stars — the coloured sunlight falls across the floor. Among timber-framed houses and orchards.
- **The Great East Hall of Foguang Monastery** (Mount Wutai, 857): the grandest Tang timber hall, up three terraces, its great bracket sets and deep eaves under a hipped roof, the Buddhas on their altar in the half-light.
- **The Phoenix Hall of Byōdō-in** (Uji, 1053): Amida's palace across its pond, the central hall with gilt phoenixes on the ridge between wing corridors that turn forward to their corner towers; over the bridge and in through the doors to the gilt Amida under his canopy. Among red pines, autumn maples and bamboo.
- **The Great Stupa at Sanchi** (1st century BCE – 1st century CE): the white dome on its hill, walked round between the stone railing and the drum and again on the terrace, entered through four carved gateways, by Ashoka's lion pillar.
- **Hagia Sophia** (Constantinople, 532–537, dome rebuilt 562): the dome on its ring of forty windows over pendentives, semidomes and exedrae, galleries, gold mosaic and marble, the chancel and ambo, the narthexes and the atrium — on its hill among tiled houses.

The buildings stand together in **one compact palace-city**, each in a **district** of about 200 × 200 m with a small surrounding of its own time — streets and lanes, houses of the period, gardens, its trees and ground, the rock, hill or pond it stands on. The districts touch, so a few minutes' walk takes you from Edfu to the Pantheon or up to the Parthenon. One sky over the whole city: the day passes into night (moon, stars), or you set the hour yourself; the weather changes (drifting cloud shadows, haze, rain and wet ground, wind). The city grows outward as districts are added.

More buildings, one from each major tradition, are next (see [DESIGN.md](DESIGN.md) §11).

## Controls

W A S D or arrows to walk, mouse to look (click to capture the mouse), Shift to run, **hold Space to fly** (let go to glide down — onto the ground or a roof), M for the map, Esc to pause. On a phone: left thumb on the stick to walk, drag anywhere to look, hold the arrow button to fly. Click to look around (the world opens by itself once loaded). Top left: the small map (click it for the large map; it can be hidden), the clock — drag it to choose the hour, or pause and run the days — and how you are moving: walking, running or flying, how fast and how high. On the map, click anywhere to go there; near a building, or on its name, you arrive at its entrance.

## How it is made

- **Dossier first.** Every building is built from a sourced dossier in [`docs/buildings/`](docs/buildings) (real example, plan and dimensions, structure, use, materials, decoration, light, music; what is stated by sources and what is inferred). The world layout is in [`docs/world.md`](docs/world.md).
- **Plan is data, look is code.** A building is a plan of walls, openings, floors, roofs, columns and objects in metres (`src/buildings/<id>/plan.js`), drawn by the reusable vocabulary of its civilization (`src/styles/<civilization>/`: columns and capitals, torus and cornice, pylons, door frames, statues).
- **Renderer:** three.js WebGPU (WebGL 2 fallback), procedural physically based materials aligned to each wall's real coursing, cascaded sun shadows, GTAO, bloom, AgX tone mapping, and eye adaptation.
- **Baked light:** indirect light (sky, sun bounced off stone, oil lamps) is ray traced offline into an irradiance volume per building (`tools/bake.mjs` → `data/gi/`), loaded with the building.
- **City:** one height function for the city and the fields beyond, drawn as terrain chunks with levels of detail built in workers; the houses of each district laid out on one grid of blocks (`src/world/city.js`); ground cover and planting by district; trees, palms and grass instanced, with levels of detail and wind (`src/world/`, `src/engine/flora/`).
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
