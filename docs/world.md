# The world — layout dossier

The world is **one compact palace-city**: a single walkable town of about 1250 × 830 m made of **districts**, one per civilization. Each district holds its core building at true scale and a small surrounding of its own time — streets and lanes, houses, gardens and courts, its trees and ground, and the little terrain the building stands on (a rock, a hill, a pond). The districts touch directly; together they read as one natural city with quarters of different character, not as separate landscapes. It is designed, not generated; this document records the plan and the reasons. All of it lives in code as data: `src/world/regions.js` (districts, the city's sky, sites, landforms, ponds, streets, ground cover), `src/world/city.js` (the houses), `src/world/flora-rules.js` (planting), `src/world/features/` (the districts' quarters as loadable features).

Coordinates: metres, +x east, +z south (north is −z).

## Principle

- **The city's ground** is a union of rectangles (`WORLD.parts`), so that new districts are added at its edge; its outline (`cityEdges`) is the walkable edge, and `inCity` measures the distance inside it.
- **Compact and dense.** A district is about 200 × 200 m, of whatever size and shape its building needs; the walk from one building to the next takes a minute or two at a true walking pace. Nothing between them but the city itself: no ridges, rivers, mountains or long roads.
- **Districts by nearness.** Each district has a centre; a place belongs to the nearest centre, after a little noise so that the borders wander like old streets (`regionWeights`, `regionAt`). Ground and planting blend across a border over about 15 m.
- **Streets.** Avenues run along the districts' borders on a loose grid; short ways lead from them to each building's entrance (`ROADS`). Every street is walked end to end by `tools/road-check.mjs` (in `npm test`), with the buildings and houses standing beside it.
- **Houses of each district's time** fill the blocks between the streets (`src/world/city.js`): one grid of blocks for the whole city (40 × 34 m with 5 m lanes); each block takes its district's house type; lots are left empty where they would touch a street, a building's site or a pond, or where the ground is too steep; about one block in seven is a garden. Deterministic.
- **The little terrain.** Only what a building stands on: the Acropolis rock, the first hill of Constantinople, Mount Moriah, the hill of Sanchi, the slope behind Foguang, the pond of Byōdō-in — each scaled down to its district and given a gentle side toward its street (`LANDFORMS`, `PONDS`). Each building's site is levelled to its base (`SITES[].pad`). The plain undulates by a few decimetres.
- **One sky.** The whole city shares one sun, sky, haze and weather (`CITY`): a middle latitude in early summer. Days pass; the time can be held or set on the clock. The buildings' light is baked under each district's own former sky (`REGIONS[].climate`), which the `?time=baked` mode still shows.
- **The city's edge.** Beyond the city, fields and then low hills, drawn out to the far view but not walkable.
- **Moving about.** Walking and running at true speed; holding Space (or the fly button on touch screens) lifts the visitor into the air, and letting go glides gently down — onto the ground, a roof or a wall top. Travel by the map takes you to a building's entrance or any point of the city.

## Layout

```
 Rouergue (x −605…−360, z −370…−95): Sainte-Foy de Conques on its terrace, the slope of the
 village rising north of it — joined to the west side of Francia.

 x →   −360 ─────────── −115 ─────────── 110 ──────────── 372 ─────────── 640
z −370 ┌── Francia ───────┬──── Rome ──────┬──── Byzantium ─────────────────┐
       │ Sainte-Chapelle  │   Pantheon     │   Hagia Sophia on the first hill│
  −135 ├── Greece ────────┼──── Nile ──────┼──── The Levant ────────────────┤
       │ Acropolis,       │   Edfu         │   Dome of the Rock on Moriah   │
       │ Parthenon        │                │                                │
   150 ├── India ─────────┴────────────────┼─ Tang China ──┬─ Heian Japan ──┤ (210 east of 110)
       │ the hill of Sanchi, the Great Stupa│  Foguang Hall │ Phoenix Hall,  │
       │                                    │               │ pond           │
   460 └────────────────────────────────────┴───────────────┴────────────────┘
```

| District | Centre | Building (origin) | Base | Houses (`house`) |
|---|---|---|---|---|
| **Nile** (Egypt) | (0, 0) | Temple of Horus, Edfu (0, 50) | 0 | mud-brick tower and courtyard houses (`house_egypt`) |
| **Rome** | (0, −230) | The Pantheon (0, −170), forecourt to the north | 0 | tiled houses (`house_tiled`) |
| **Greece** (Athens) | (−240, 0) | The Parthenon on the Acropolis (−225, 0) | 24 | tiled houses |
| **Byzantium** (Constantinople) | (280, −250) | Hagia Sophia on the first hill (280, −265) | 14 | tiled houses, jettied upper storeys |
| **The Levant** (Jerusalem) | (300, 30) | The Dome of the Rock on the Haram (300, 30) | 14 (esplanade) | stone houses with domed roofs (`house_domed`) |
| **Francia** (Paris) | (−240, −230) | The Sainte-Chapelle (−240, −230) | 1.5 | timber-framed houses (`house_timber`) |
| **Tang China** | (200, 330) | The Great East Hall of Foguang (240, 330) | 1.5 | grey-brick courtyard houses (`house_china`) |
| **Heian Japan** (Uji) | (530, 330) | The Phoenix Hall of Byōdō-in (520, 330) | 1.5 | timber houses under bark and thatch (`house_japan`) |
| **India** (Sanchi) | (−10, 300) | The Great Stupa on its hill (−25, 300) | 22 | limewashed brick houses under tiles (`house_india`) |
| **Rouergue** (Conques) | (−480, −240) | Sainte-Foy de Conques (−555, −250), west front to the lane at the city's edge | 2 | schist and stone houses under lauzes (`house_rouergue`) |

The hills are scaled to the city: the Acropolis 24 m (the real rock rises about 70 m), the first hill and Moriah 14 m, the hill of Sanchi 22 m, Foguang's slope 18 m; each with cliffs or steep sides and one gentle side that the street climbs at no more than about a third.

## Districts

- **Nile:** sand and beaten earth; date palms in groves, doum palms, sycamore figs in the yards, tamarisks, acacias and halfa grass. Mud-brick tower houses of two or three storeys and courtyard houses (the Graeco-Roman types of Karanis and Tebtunis; Tell Edfu, Yale/ISAC). The way from the lower avenue to the pylon.
- **Rome:** meadow and beaten earth; stone pines, cypresses, holm oaks, oleanders. The Pantheon's forecourt with porticoes on three sides opens north onto the north street.
- **Greece:** red earth and dry grass, limestone on the rock; olives in rows on the level, Aleppo pines and maquis on the slopes. The way climbs the rock's gentle north side and comes along the top to the Parthenon.
- **Byzantium:** grass and brown earth; cypresses by the churches, plane trees in the squares, figs and stone pines. Hagia Sophia with its atrium and the Augustaion on the first hill, reached from the east avenue up its west side.
- **The Levant:** limestone breaking through, red earth, dry grass; olive groves on Moriah's slopes, cypresses, carobs, garrigue. The Haram's esplanade on Moriah, reached up its west side to the platform's west stairs.
- **Francia:** lush grass; elms and oaks in the closes, apple orchards, poplars and willows. The palace courtyard round the Sainte-Chapelle.
- **Tang China:** yellow loess and dry grass; Chinese pines and arborvitae round the monastery and on the slope behind it, elms, poplars, jujubes. The three terraces of Foguang climb toward the slope.
- **Heian Japan:** green grass and moss; red pines, maples, bamboo, cryptomerias, willows and reeds at the pond Aji-ike, which is dug into the ground and cannot be waded; a bridge to the island.
- **India:** red-brown soil and dry grass; teak and neem on the hill, banyans by the lanes, palms, acacias. The way climbs the hill's gentle north side to the stupas.
- **Rouergue:** green grass, brown earth in the lanes, grey schist breaking out on the slope; oaks (standing for chestnuts), walnuts and elms by the houses, apple trees in the terraced gardens, broom and box. Houses of schist rubble or yellow stone under steep roofs of lauzes climb the slope north of the abbey; the parvis faces the lane along the city's west edge; the cloister of Bégon lies south of the nave.

## Time and weather

Days pass (`DAY_SECONDS`, half an hour): the sun's course is computed for the city's latitude and season (`CITY.climate.sun.lat`, `dec`; `sunAt`), so it rises in the east, stands high at noon and sets; twilight reddens the light; at night the full moon is the light that casts shadows, with stars and the Milky Way. The clock in the corner sets or holds the hour; `?time=` does the same for screenshots (`baked`: each district under the sky its building's light was baked in). The baked light is scaled with the daylight.

The weather (`CITY.climate.weather`): clear, fair, cloudy, overcast, shower, haze and mist; states are held for 2½–8 minutes and cross-fade over about 75 s. Cloud shadows drift with the wind; rain falls outdoors and the ground darkens while wet. `?weather=<id>` fixes a state.

## Loading and drawing

- **Terrain:** one height function; tiles of 512 m, the near ones in chunks of 256 m whose grid follows the distance, built in workers.
- **Plants:** scattered deterministically per cell in a worker and drawn instanced per species; only grass between the houses of a built block.
- **Buildings and quarters** are built within 650 m — in practice the whole city — time-sliced so that the frame keeps running; those left behind are kept ready up to a budget of triangles.

## Next steps

1. Each district's surroundings to L2 from its dossier: Edfu's quay stair and granaries; Rome's insulae and the Saepta; the Propylaea and Erechtheion; the Augustaion's columns and the Mese; the Haram's gates and the Aqsa; the palace hall in Paris; Foguang's lower courts; the bell tower of Byōdō-in; Stupas 2 and 3 at Sanchi.
2. Street life and lamps at night (L4).
3. New districts as Phase 2 continues (Renaissance, Mesoamerica, Baroque, …), added at the city's edge, each with its building, houses and planting; the south-west corner (west of Greece and India) is the next place to grow.
