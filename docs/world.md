# The world — layout dossier

The world is one continuous, walkable landscape: a river valley whose west bank is divided into **regions**, one per civilization, each a small world of its own — its landform, ground, plants, water, settlement, roads, and its own sky (time of day, climate and weather). It is designed, not generated; this document records the plan and the reasons. All of it lives in code as data: `src/world/regions.js` (regions, climates, landforms, roads, ground cover), `src/world/flora-rules.js` (planting), `src/world/features/` (towns and other non-dossier features).

Coordinates: metres, +x east, +z south (north is −z), origin at the pylon gate of Edfu.

## Principle

- **A river runs through it,** north–south, meandering gently (`riverCenter(z)`), 300 m wide. The first civilizations grew on rivers; the river gives the world an axis.
- **Regions are basins on the west bank,** stacked along the river, closed by natural boundaries: ridge spurs that come down from the western uplands to the river, escarpments, mountains. You cannot see from one region into the next; you pass from one to the other over a **pass** in the spur, or along the riverside below the spur's end.
- **Each region keeps its own sky.** Its sun is fixed (so its buildings' light can be baked) and chosen for the character of the place; its weather changes over minutes, drawn from its real climate. Crossing a spur, the climate blends from one region to the next over about 140 m.
- **Joins are architecture or landscape,** never neutral corridors: a processional way, a road over a pass, a riverside path.
- **Each building's surroundings** (settlement, planting, roads) belong to its dossier (§10); the region gives them their ground.

## Regions

| Region | Extent (z) | Building | Sun (time of day) | Weather cycle |
|---|---|---|---|---|
| **Nile** (Egypt) | +1250 … −560 | Temple of Horus, Edfu | late afternoon, low in the WSW (az 248°, el 24°), warm | clear and hazy · high cloud · dust |
| **Rome** | −560 … −1600 | The Pantheon | spring morning, ESE (az 118°, el 30°) | fair · cloudy · overcast · showers |
| **Greece** (Attica) | −1600 … −2750 | The Parthenon on the Acropolis | noon, high in the south (az 196°, el 52°) | clear · fair · *meltemi* (north wind) |
| **Byzantium** (Constantinople) | −2750 … −3950 | Hagia Sophia | late autumn morning, low in the south-east (az 142°, el 26°) | fair · cloudy · overcast · drizzle · sea mist · *poyraz* (north-east wind) |
| **The Levant** (Jerusalem) | −3950 … −5150 | The Dome of the Rock | clear morning, east-south-east (az 112°, el 32°) | clear · fair · *sharav* (hot dusty haze) · winter shower |

Climates are in `REGIONS[].climate`: sun, sky (turbidity, Rayleigh and Mie scattering, zenith and horizon radiance for the baker), haze (colour, density, height falloff), exposure, wind, and weather states with weights. A state sets cloud cover and density, the sun's strength under cloud, the haze, rain and wind. States are held for 2½–8 minutes and cross-fade over about 75 s. Cloud shadows drift over the ground with the wind; rain falls outdoors, and the ground darkens and pools while wet. `?weather=<id>` fixes a state (screenshots).

### Nile

- **Landform:** the flat flood plain of the river; the **western desert escarpment** rising 72 m about 470–560 m west of the river's west bank, as the Nile valley's cliffs close the valley at Edfu; the **eastern escarpment** across the river; a field of transverse **dunes** banked against the western cliffs; the **town mound** (Tell Edfu) just west of the temple, 5.5 m high here (365 × 168 m; it now rises 10–15 m above the temple threshold, after centuries more of occupation — Yale/ISAC Tell Edfu Project).
- **Ground:** the cultivated strip along each bank as far as the flood reached (plots of wheat, barley, clover, flax and beans between earth banks), desert sand beyond, dark silt at the water's edge, limestone on the cliffs.
- **Plants:** date palms in groves along the water and the field edges, doum palms among them (the branching palm of Upper Egypt), sycamore figs by the fields, acacias and tamarisks at the desert's edge, papyrus and reeds along the bank, halfa grass on the sand, boulders at the foot of the cliffs.
- **Settlement:** the town of Behdet around its temple — blocks of mud-brick tower houses and courtyard houses on the mound to the west, a quarter to the east between the temple and the fields, houses south by the processional way (`src/world/features/edfu-town.js`).
- **Roads:** the processional way from the river quay to the pylon; the road north along the town to the pass.

### Rome

- **Landform:** the plain of the Campus Martius by the river (the Tiber here); hills around it — a Capitoline-like crag to the south with a cliff, Quirinal and Pincian ridges to the north-west and north, the Janiculum across the river.
- **Ground:** meadow and beaten earth; tufa on the steep slopes.
- **Plants:** stone pines in groves, cypresses, holm oaks on the hills, oleanders, reeds by the river, grass.
- **Settlement:** the Pantheon's forecourt with porticoes on three sides (in its plan). *Later: streets of insulae, the Saepta, the Baths of Agrippa.*
- **Roads:** from the southern pass round the rotunda into the forecourt through the gateway of its north portico, and on to the northern pass.

### Greece

- **Landform:** the **Acropolis** — a limestone plateau 300 × 140 m, its top at 40 m, cliffs on three sides and the long slope on the west where the Panathenaic way climbs (the real rock rises about 70 m; 40 m keeps the climb a walk); the Areopagus and the Mouseion hill beside it; Aigaleo to the west, Parnes closing the north, Hymettus across the river.
- **Ground:** red earth (terra rossa) with dry grass; grey limestone on the slopes and in patches on the rock.
- **Plants:** olive groves in rows on the plain, Aleppo pines on the hill slopes, cypresses, low maquis (lentisk and kermes oak), dry grass, boulders.
- **Roads:** from the northern pass across the plain to the foot of the Acropolis, up the west slope and along the top to the Parthenon's east front.

### Byzantium

- **Landform:** the city's hills above the water (the river stands for the Bosphorus): the **first hill**, a broad flat-topped rise 24 m high, falling gently east to the harbour, where Hagia Sophia stands with its atrium and the Augustaion square; the **second** and **third hills** to the west; the hills of the **Asian shore** across the water; Parnes (with its pass) to the south, the Thracian ridge closing the north.
- **Climate** (Climate of Istanbul): mild and often grey — frequent light rain, sea fog, the north-easterly *poyraz*; a morning sun low in the south-east.
- **Ground:** green grass, brown earth, gardens and vineyards on the low ground; grey limestone where steep.
- **Plants:** cypresses in groups, oriental plane trees by the water and the squares, figs, stone pines on the slopes, a few olives and holm oaks, oleanders, reeds at the shore. No trees inside the built-up quarters.
- **Settlement:** quarters of town houses round the hill (`src/world/features/towns.js`): rubble and brick below, plastered above, upper storeys jettied over the street on timber brackets, hipped roofs of curved tiles; blocks between narrow streets.
- **Roads:** from the Greek plain over the pass of Parnes, round the third hill to the atrium's gate; from the square down to the harbour.

### The Levant

- **Landform:** **Mount Moriah**, a broad flat hill-top 30 m high standing for the esplanade of the Haram, its sides steep like the retaining walls, falling gently south to the old city; the **Kidron valley** east of it and the **Mount of Olives** beyond; the **western hill** and **Bezetha** to the west and north; the Judean ridge to the west, the hills of Moab across the water; the Thracian ridge (with its pass) to the south, the ridge of Samaria closing the north.
- **Climate:** Mediterranean, dry and bright; the hot dusty *sharav*; rain only in winter.
- **Ground:** grey limestone breaking through everywhere, red earth and dry grass between.
- **Plants:** olive groves on the slopes, cypresses, Aleppo pines on the heights, carobs, low garrigue, dry grass, boulders.
- **Settlement:** the town on the western hill and south of the Haram — cubic houses of pale limestone with flat roofs, each vaulted room showing as a low dome on the roof (`src/world/features/towns.js`, `house_domed`).
- **Roads:** from Byzantium over the pass of the Thracian ridge, round the western hill to the Haram's west side.

## Loading and drawing

- **Terrain:** one height function; drawn as tiles of 512 m, the near ones split into chunks of 256 m whose grid follows the distance (2, 4, 8 m; 16 and 32 m far away), built in workers; skirts hide the seams.
- **Plants:** scattered deterministically per cell in a worker — trees and shrubs in cells of 128 m out to the far view, grass in cells of 16 m within 64 m — and drawn as instanced meshes per species, variant and level of detail; they sway with the wind.
- **Buildings and features** are built when the visitor comes within 650 m.

## Next steps

1. Edfu: the quay and its stair at the river; the mammisi; dovecotes and granaries in the town; life in the streets (L4).
2. Rome: insulae and streets, the Saepta and Baths of Agrippa as massing.
3. Greece: the Propylaea, the Erechtheion and the altar of Athena on the Acropolis; the theatre of Dionysos on the south slope.
4. Byzantium: the Hippodrome, the Mese with its colonnades, the Great Palace terraces, the sea walls.
5. The Levant: the Aqsa mosque, the walls and gates of the Haram, the qanatir (later) on the platform.
6. New regions as Phase 2 continues (Gothic Europe, China, Japan, India, …), each with its own basin, sky and planting.
