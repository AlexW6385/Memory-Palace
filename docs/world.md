# The world — layout dossier

The world is one continuous, walkable landscape: a planned city of civilizations along a river. It is designed, not generated; this document records the plan and the reasons. Coordinates: metres, +x east, +z south (north is −z), origin at the pylon gate of Edfu.

## Principle

- **A river runs through it.** The first civilizations grew on rivers, and a river gives the whole world an axis, a direction of flow (from the oldest to the newest) and a natural reason for each district's approach. The river runs north–south east of the first district, as the Nile runs past Edfu.
- **Districts by civilization, in order of time along the river**, so that walking downstream is walking forward in history. Each district keeps its buildings' true orientation and its own ground, paving and vegetation.
- **Joins are architecture.** Between districts: processional ways, bridges, quays, gardens and courts that belong to one side or the other (an avenue of sphinxes, a Roman road, a Chinese spirit way), never neutral corridors.
- **Vistas.** Major buildings are sited so that a later building can be seen from an earlier one along an axis or across water (World L3).

## Districts (planned)

| District | Where | Buildings (first) | Status |
|---|---|---|---|
| **Nile** (Egypt) | west bank, x −400…170, z −600…400 | Temple of Horus, Edfu (Ptolemaic); later: its mammisi; a New Kingdom temple (Luxor or Karnak hypostyle); a rock-cut or pyramid complex at the desert edge to the west | Edfu built |
| Mesopotamia / Persia | upstream (north), both banks | ziggurat (Ur), Persepolis Apadana | planned |
| **Greece** | downstream (north) of the Nile district on the west bank: the Acropolis, centre (−180, −560) | The Parthenon (built); later: Propylaea, Erechtheion, a theatre on the south slope | Parthenon built |
| **Rome** | on the west bank between the Nile district and the Acropolis, the Pantheon at (40, −300) facing north onto its forecourt | The Pantheon (built); later: a forum, a bath complex, the Colosseum | Pantheon built |
| Byzantium and Islam | across the river (east bank), joined by a bridge | Hagia Sophia, a hypostyle mosque, a Persian four-iwan mosque | planned |
| Medieval Europe | downstream on the west bank | Romanesque abbey, Gothic cathedral | planned |
| South and East Asia | east bank, downstream | Hindu temple (Nagara or Dravida), Chinese hall complex, Japanese temple | planned |
| Americas | a separate highland plateau reached by a causeway | Mesoamerican pyramid-temple | planned |
| Renaissance to Modern | furthest downstream, around a harbour | Renaissance church, Baroque palace hall, iron-and-glass station, early Modern | planned |

The order of building will favour breadth (one building per tradition early, Phase 2) while the layout above keeps space for each.

## The Nile district (built, World L1)

- **Ground:** open desert-edge ground at y ≈ 0; the temple's paving and floors at their dossier levels.
- **The river:** x 190…520 (330 m wide), banks sloping 22 m to a bed 3.2 m down, water at −2.3 m. Edfu stands about 190 m west of the river, its pylon facing south along the bank. (The real temple is about 1 km from today's Nile; we bring the river closer so the district reads as a river city. [decision])
- **Palms** line the forecourt and the outside of the enclosure, with groves to the west and south.
- **World edge:** ±1200 m, closed by a low invisible margin; the river cannot be entered.

## The Greek district (built, World L1)

- **The Acropolis:** a limestone plateau (rounded rectangle 300 × 140 m, top at 40 m) with cliffs of about 60° on the north, east and south, and a long slope of about 12° on the west where the way up climbs, as the Panathenaic way climbed from the west. The real rock rises about 70 m above the Agora; we keep 40 m so that the climb stays a walk of a minute or two (decision in DESIGN.md §10). Rock shows on the slopes and in patches on the top.
- **The Parthenon** stands on the south side of the top, its long axis east–west, entrance east, as in Athens. Its east front faces the length of the plateau, so the first full view on arriving from the west is the north colonnade and then the east front.
- **Terrain** is one height function (`src/world/layout.js`) used by the viewer, the walker (open ground steeper than about 40° cannot be climbed) and the light baker.

## Rome (built, World L1)

- **The Pantheon** stands on the plain at (40, −300), its portico facing north onto a travertine forecourt (80 × 59 m, the ancient colonnaded square: porticoes L4), seven steps up to the portico. From its forecourt the Acropolis rises to the north-west; Edfu's pylon is seen to the south.

## Loading

Every building's plan is small and loaded at start (for the map); its geometry and baked light are built when the visitor comes within 650 m of it (`LOAD_RADIUS` in `src/engine/world.js`).

## Next steps for the world

1. World L2: the Nile district's quay and processional way from the river to the forecourt; the mammisi; mud-brick town houses around the temple mound (L4 of Edfu).
2. Second district (Greece) with a road from the Nile district.
