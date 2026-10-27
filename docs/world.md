# The world — layout dossier

The world is one continuous, walkable landscape: a patch of land divided into **regions**, one per civilization, each a small world of its own — its landform, ground, plants, water, settlement, roads, and its own sky (time of day, climate and weather). It is designed, not generated; this document records the plan and the reasons. All of it lives in code as data: `src/world/regions.js` (the grid, regions, climates, landforms, rivers, roads and bridges, ground cover), `src/world/flora-rules.js` (planting), `src/world/features/` (towns, bridges and other non-dossier features).

Coordinates: metres, +x east, +z south (north is −z), origin at the pylon gate of Edfu.

## Principle

- **A patch that grows outward.** Each region is a cell of a grid, 1600 m east–west by 1200 m north–south. The Nile, the oldest, is in the middle; the others follow round it in a spiral in the order of their age (Rome to the north, then Greece, Byzantium, the Levant, Francia, Tang China, Heian Japan and India), so that the next regions are added on the outside, ring by ring (`GRID`, `REGIONS[].cell`).
- **Ridges between the cells.** Along every edge between two regions runs a ridge about 150 m high, so that you cannot see from one region into the next; **passes** cross it where the roads go from one region to the next, and in a few more places. Beyond the outermost cells rise higher mountains, the end of the world.
- **A river through each column of cells,** north–south, meandering, of the width each region gives it (the Nile 300 m, the Bosphorus 300 m, the Seine and the Tiber 90 m, …); it runs through gorges in the ridges. Where a road meets a river, a stone bridge carries it (`BRIDGES`, found from the roads).
- **Roads** join the regions in the order of the spiral, each leading to its building's entrance; every road is walked end to end by `tools/road-check.mjs`.
- **Each region keeps its own sky.** Its sun is fixed (so its buildings' light can be baked) and chosen for the character of the place; its weather changes over minutes, drawn from its real climate. Crossing a ridge, the climate blends from one region to the next over about 160 m.
- **Joins are architecture or landscape,** never neutral corridors: a processional way, a road over a pass, a bridge.
- **Each building's surroundings** (settlement, planting, roads) belong to its dossier (§10); the region gives them their ground.

## Regions

| Region | Cell [column, row] | Building | Sun (time of day) | Weather cycle |
|---|---|---|---|---|
| **Nile** (Egypt) | [0, 0] (centre) | Temple of Horus, Edfu | late afternoon, low in the WSW (az 248°, el 24°), warm | clear and hazy · high cloud · dust |
| **Rome** | [0, −1] | The Pantheon | spring morning, ESE (az 118°, el 30°) | fair · cloudy · overcast · showers |
| **Greece** (Attica) | [1, −1] | The Parthenon on the Acropolis | noon, high in the south (az 196°, el 52°) | clear · fair · *meltemi* (north wind) |
| **Byzantium** (Constantinople) | [1, 0] | Hagia Sophia | late autumn morning, low in the south-east (az 142°, el 26°) | fair · cloudy · overcast · drizzle · sea mist · *poyraz* (north-east wind) |
| **The Levant** (Jerusalem) | [1, 1] | The Dome of the Rock | clear morning, east-south-east (az 112°, el 32°) | clear · fair · *sharav* (hot dusty haze) · winter shower |
| **Francia** (Paris) | [0, 1] | The Sainte-Chapelle | summer afternoon, west-south-west (az 248°, el 34°) | fair · cloudy · overcast · showers |
| **Tang China** (Mount Wutai) | [−1, 1] | The Great East Hall of Foguang Monastery | late afternoon, low in the west (az 256°, el 21°), on the hall's face | clear · fair · loess dust · showers |
| **India** (Sanchi, Malwa) | [−1, −1] | The Great Stupa at Sanchi | winter afternoon, south-west (az 228°, el 32°) | clear · haze · high cloud · rare shower |
| **Heian Japan** (Uji) | [−1, 0] | The Phoenix Hall of Byōdō-in | autumn morning, low in the east-south-east (az 112°, el 17°), on the hall's face | fair · cloudy · river mist · drizzle |

Climates are in `REGIONS[].climate`: sun, sky (turbidity, Rayleigh and Mie scattering, zenith and horizon radiance for the baker), haze (colour, density, height falloff), exposure, wind, and weather states with weights. A state sets cloud cover and density, the sun's strength under cloud, the haze, rain and wind. States are held for 2½–8 minutes and cross-fade over about 75 s. Cloud shadows drift over the ground with the wind; rain falls outdoors, and the ground darkens and pools while wet. `?weather=<id>` fixes a state (screenshots).

### Nile

- **Landform:** the flat flood plain of the river; the **western desert escarpment** rising 72 m about 470–560 m west of the river's west bank, as the Nile valley's cliffs close the valley at Edfu; the **eastern escarpment** across the river; a field of transverse **dunes** banked against the western cliffs; the **town mound** (Tell Edfu) just west of the temple, 5.5 m high here (365 × 168 m; it now rises 10–15 m above the temple threshold, after centuries more of occupation — Yale/ISAC Tell Edfu Project).
- **Ground:** the cultivated strip along each bank as far as the flood reached (plots of wheat, barley, clover, flax and beans between earth banks), desert sand beyond, dark silt at the water's edge, limestone on the cliffs.
- **Plants:** date palms in groves along the water and the field edges, doum palms among them (the branching palm of Upper Egypt), sycamore figs by the fields, acacias and tamarisks at the desert's edge, papyrus and reeds along the bank, halfa grass on the sand, boulders at the foot of the cliffs.
- **Settlement:** the town of Behdet around its temple — blocks of mud-brick tower houses and courtyard houses on the mound to the west, a quarter to the east between the temple and the fields, houses south by the processional way (`src/world/features/edfu-town.js`).
- **Roads:** the processional way from the river quay to the pylon; the road north along the town over the pass to Rome.

### Rome

- **Landform:** the plain of the Campus Martius by the river (the Tiber here); hills around it — a Capitoline-like crag to the south with a cliff, Quirinal and Pincian ridges to the north-west and north, the Janiculum across the river; the ridges toward the Nile (south), Greece (east) and India (west).
- **Ground:** meadow and beaten earth; tufa on the steep slopes.
- **Plants:** stone pines in groves, cypresses, holm oaks on the hills, oleanders, reeds by the river, grass.
- **Settlement:** the Pantheon's forecourt with porticoes on three sides (in its plan). *Later: streets of insulae, the Saepta, the Baths of Agrippa.*
- **Roads:** from the southern pass (the Nile) round the Capitoline to the forecourt through the gateway of its north portico; from there east over the Tiber's bridge and the pass to Greece.

### Greece

- **Landform:** the **Acropolis** — a limestone plateau 300 × 140 m, its top at 40 m, cliffs on three sides and the long slope on the west where the Panathenaic way climbs (the real rock rises about 70 m; 40 m keeps the climb a walk); the Areopagus and the Mouseion hill beside it; Hymettus across the river; the ridge toward Rome to the west, toward Byzantium to the south, mountains to the north.
- **Ground:** red earth (terra rossa) with dry grass; grey limestone on the slopes and in patches on the rock.
- **Plants:** olive groves in rows on the plain, Aleppo pines on the hill slopes, cypresses, low maquis (lentisk and kermes oak), dry grass, boulders.
- **Roads:** from the western pass (Rome) across the plain to the foot of the Acropolis, up the west slope and along the top to the Parthenon; from the foot of the rock south over the pass to Byzantium.

### Byzantium

- **Landform:** the city's hills above the water (the river stands for the Bosphorus): the **first hill**, a broad flat-topped rise 24 m high, falling gently east to the harbour, where Hagia Sophia stands with its atrium and the Augustaion square; the **second** and **third hills** to the west; the hills of the **Asian shore** across the water; the ridges toward Greece (north), the Levant (south) and the Nile (west).
- **Climate** (Climate of Istanbul): mild and often grey — frequent light rain, sea fog, the north-easterly *poyraz*; a morning sun low in the south-east.
- **Ground:** green grass, brown earth, gardens and vineyards on the low ground; grey limestone where steep.
- **Plants:** cypresses in groups, oriental plane trees by the water and the squares, figs, stone pines on the slopes, a few olives and holm oaks, oleanders, reeds at the shore. No trees inside the built-up quarters.
- **Settlement:** quarters of town houses round the hill (`src/world/features/towns.js`): rubble and brick below, plastered above, upper storeys jettied over the street on timber brackets, hipped roofs of curved tiles; blocks between narrow streets.
- **Roads:** from Greece over the northern pass, round the second hill to the atrium's gate; from the square down to the harbour; south past the third hill to the Levant.

### The Levant

- **Landform:** **Mount Moriah**, a broad flat hill-top 30 m high standing for the esplanade of the Haram, its sides steep like the retaining walls, falling gently south to the old city; the **Kidron valley** east of it and the **Mount of Olives** beyond; the **western hill** and **Bezetha** to the west and north; the hills of Moab across the water; the ridges toward Byzantium (north) and Francia (west), mountains to the south and east.
- **Climate:** Mediterranean, dry and bright; the hot dusty *sharav*; rain only in winter.
- **Ground:** grey limestone breaking through everywhere, red earth and dry grass between.
- **Plants:** olive groves on the slopes, cypresses, Aleppo pines on the heights, carobs, low garrigue, dry grass, boulders.
- **Settlement:** the town on the western hill and south of the Haram — cubic houses of pale limestone with flat roofs, each vaulted room showing as a low dome on the roof (`src/world/features/towns.js`, `house_domed`).
- **Roads:** from Byzantium over the northern pass, past Bezetha to the Haram's west stairs; west over the hills and the pass to Francia.

### Francia

- **Landform:** the plain of the Seine (the river here); **Montmartre** to the north, the hill of **Sainte-Geneviève** to the south, Chaillot to the west; low hills across the water; the ridges toward the Nile (north), the Levant (east) and Tang China (west).
- **Ground:** lush grass, fields in strips on the plain, brown earth.
- **Plants:** oaks and elms, poplars and willows along the water, apple orchards in rows, reeds at the bank.
- **Settlement:** the courtyard of the palace with its round towers by the river; a town of timber-framed houses — stone ground floors, jettied upper storeys, plaster between dark oak timbers, steep gables of tile or slate facing the street (`house_timber`).
- **Roads:** from the Levant over the eastern pass and the bridge over the Seine to the palace courtyard; west past Sainte-Geneviève and over the pass to Tang China.

### Tang China

- **Landform:** **Foguang Mountain** rising behind the monastery, which climbs its western slope in three terraces and looks west over a valley; loess hills west and north; the hills across the river; the ridge of Wutai toward Heian Japan (north), the ridge toward Francia (east).
- **Climate:** dry and clear in the north; at times yellow with loess dust; showers in summer.
- **Ground:** yellow loess, terraced fields on the gentle slopes, dry grass, rock high up.
- **Plants:** Chinese pines and arborvitae on the hills and round the monastery, elms and poplars in the valley and by the village, jujubes by the fields.
- **Settlement:** a village of houses of grey brick and tamped earth with gabled roofs of grey tiles (`house_china`).
- **Roads:** from Francia over the eastern pass and the bridge, round the south of Foguang Mountain to the monastery gate; north over the pass of Wutai to Heian Japan.

### Heian Japan

- **Landform:** the plain of Uji on the river's west bank; wooded hills west and north-west of it; Mount Asahi across the river; the ridges of Wutai toward Tang China (south), of Hira toward India (north), and toward the Nile (east).
- **Climate:** soft and moist; an autumn morning with mist on the river, clouds and drizzle passing.
- **Ground:** green grass and moss, rice fields (stubble after the harvest) on the plain.
- **Plants:** Japanese red pines on the hills and by the water, cryptomerias in groves higher up, maples in autumn red, bamboo groves at the hills' foot, willows and reeds by the river.
- **Water:** the pond Aji-ike dug into the Phoenix Hall's site round its island (`PONDS` in `regions.js`: the ground lowered under the water, and the water cannot be waded); a bridge to the island.
- **Settlement:** a village of timber houses with plastered or plank walls under steep roofs of cypress bark or thatch (`house_japan`).
- **Roads:** from the Tang village north over the pass of Wutai, down to the plain and to the south shore of the pond.

### India

- **Landform:** the plain of Malwa with the flat-topped hill of Sanchi, the stupas on its top, its gentle side to the south where the road climbs; the hills of Udayagiri and Nagauri to the west; the ridge of Hira toward Heian Japan (south), toward Rome (east), the Vindhyas at the world's end to the north and west.
- **Climate:** a warm dry winter; dusty haze on the plain; high cloud; rarely a shower.
- **Ground:** red-brown soil and dry grass, sandstone breaking out on the hills, fields of wheat and gram on the plain.
- **Plants:** teak and neem in a dry deciduous forest on the hills, great banyans by the villages and roads, palmyra palms on the plain and by the water, acacias and scrub.
- **Settlement:** a village of mud and brick houses, limewashed, under low roofs of clay tiles (`house_india`).
- **Roads:** from the plain of Uji over the pass of Hira, across the plain and up the hill to the south gateway.

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
6. Francia: Notre-Dame (under construction in 1248), the Grand-Salle of the palace, the Seine's islands and bridges.
7. Tang China: the Manjuśrī Hall (1137) and the monastery's other courts belong to later periods; other Tang buildings (Nanchan Temple) could join.
8. Heian Japan: the bell tower and the Kannon-dō of Byōdō-in; the river with the Uji bridge; an older Japanese building (Hōryū-ji) could join.
9. India: Stupa 2 on the slope, Temple 40, the Gupta temples (Temple 17) as a later layer; Vidisha and the Udayagiri caves.
10. New regions as Phase 2 continues (Romanesque, Renaissance, Mesoamerica, …), each with its own basin, sky and planting.
