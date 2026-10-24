# Prop catalogue

Every exhibit scene is built from these props. Sizes are width × height × depth in metres at scale 1; the prop stands on its base and faces the viewer.

- **Poses** (figure, statue): stand, walk, run, point, wave, cheer, think, sit, kneel, lift, carry, push, pull, throw, lie, bow, read, shrug, fight, fall
- **Hats** (figure): none, top_hat, cap, crown, graduation, hood, helmet, laurel, hard_hat, chef, wizard, beret
- **Holdable** (figure `hold`): book, bottle, camera, candle, coin, cup, envelope, flag, fruit, gavel, hammer, key, lantern, magnifier, medal, megaphone, pencil, scroll, shield, smartphone, stopwatch, sword, torch, wrench
- **Animations** (`anim`): spin (turns slowly in place), bob (floats up and down), sway (rocks side to side), pulse (swells and shrinks a little), orbit (circles the stage centre at its distance from it), hop (small jumps), swing (swings like a pendulum), flicker (flickers like a flame)
- **Arrangements** (`arrange` with `count`): row, column, grid, ring, arc, stack, scatter
- **Backdrop patterns**: plain, rays, dots, grid, waves, stars, stripes, rings, checks, leaves


## People

| prop | size (m) | description | variants | notes |
|---|---|---|---|---|
| `figure` | 0.42×0.95×0.28 | A stylised person about 0.95 m tall. Set pose, hat and an item to hold; color = clothes, color2 = hair. | adult, child, robed | color, color2 |
| `statue` | 0.5×1.35×0.5 | A marble statue of a person on a plinth; takes a pose like a figure. | marble, bronze | color |
| `bust` | 0.38×0.72×0.34 | A classical portrait bust on a short column. | plain, laurel, bearded | color |
| `crowd` | 1.2×0.95×0.7 | A small crowd of six to eight people. | standing, cheering, marching |  |
| `hand` | 0.4×0.6×0.3 | A giant hand rising from the stage, as if reaching into the scene. | open, point, fist, grab, thumbs_up, pinch | color |
| `eye` | 0.45×0.5×0.4 | A giant eyeball on a small stand, looking at the viewer; color = iris. |  | color |
| `brain` | 0.5×0.42×0.55 | A pink brain on a dish. |  | color |
| `heart` | 0.4×0.42×0.22 | A symbolic heart shape standing upright. |  | color |
| `skull` | 0.24×0.26×0.3 | A human skull. |  | color |
| `robot` | 0.5×0.9×0.4 | A friendly robot; 'arm' is an industrial robot arm. | humanoid, arm | color, color2 |
| `spirit` | 0.5×0.85×0.5 | A glowing ghost-like wisp: spirit, mind, Geist. |  | color |

## Animals

| prop | size (m) | description | variants | notes |
|---|---|---|---|---|
| `bird` | 0.3×0.3×0.36 | A bird standing; variant sets the species. | pigeon, dove, owl, eagle, crow, parrot | color, color2 |
| `cat` | 0.22×0.36×0.48 | A sitting cat. |  | color |
| `dog` | 0.26×0.45×0.55 | A standing dog. |  | color |
| `fish` | 0.12×0.22×0.42 | A fish (swimming pose, give it a y). | goldfish, plain, shark | floats, color |
| `horse` | 0.3×0.85×0.9 | A standing horse. |  | color |
| `snake` | 0.5×0.18×0.5 | A coiled snake with raised head. |  | color |
| `rabbit` | 0.2×0.36×0.3 | A sitting rabbit. |  | color |
| `turtle` | 0.32×0.18×0.42 | A turtle. |  | color |
| `duck` | 0.2×0.28×0.3 | A duck. |  | color |
| `bee` | 0.16×0.14×0.2 | A bumblebee (give it a y to fly). |  | floats |
| `butterfly` | 0.28×0.2×0.2 | A butterfly with open wings (give it a y). |  | floats, color |
| `elephant` | 0.5×0.85×0.95 | An elephant. |  | color |
| `sheep` | 0.3×0.45×0.55 | A woolly sheep. |  |  |
| `frog` | 0.22×0.18×0.24 | A sitting frog. |  | color |
| `ant` | 0.06×0.04×0.12 | A tiny ant; use count for many. |  |  |
| `mouse` | 0.08×0.08×0.18 | A small mouse. |  | color |
| `egg` | 0.12×0.16×0.12 | An egg. | whole, cracked, hatching | color |
| `nest` | 0.36×0.14×0.36 | A twig nest (put eggs on it). |  |  |

## Nature

| prop | size (m) | description | variants | notes |
|---|---|---|---|---|
| `tree` | 0.9×1.6×0.9 | A tree. color = foliage, color2 = trunk. | round, pine, palm, birch, blossom, bare | color, color2 |
| `bush` | 0.6×0.45×0.6 | A rounded bush. |  | color |
| `hedge` | 1.2×0.8×0.45 | A clipped box-hedge segment. |  | color |
| `flower` | 0.14×0.38×0.14 | A single flower; use count for a bed. | tulip, daisy, rose, sunflower | color |
| `potted_plant` | 0.36×0.65×0.36 | A plant in a pot. | leafy, cactus, fern | color |
| `sprout` | 0.14×0.2×0.14 | A seedling with two leaves. |  |  |
| `leaf` | 0.3×0.05×0.45 | A big single leaf lying flat. |  | color |
| `rock` | 0.5×0.36×0.45 | A rock. | boulder, flat, pile | color |
| `mountain` | 1.4×1.0×1.1 | A small mountain. | peak, twin, volcano | color |
| `cloud` | 0.9×0.45×0.5 | A cloud (give it a y). | fluffy, rain, storm | floats, color |
| `sun` | 0.6×0.6×0.2 | A glowing sun with rays (give it a y). |  | floats, color |
| `moon` | 0.4×0.5×0.15 | A crescent moon (give it a y). |  | floats, color |
| `star` | 0.42×0.42×0.1 | A glowing five-pointed star. |  | floats, color |
| `planet` | 0.7×0.5×0.7 | A ringed planet (give it a y). |  | floats, color, color2 |
| `pool` | 1.2×0.08×0.8 | A shallow pool of water with a stone rim. | round, rect | color |
| `wave` | 0.9×0.55×0.35 | A curling ocean wave. |  | color |
| `campfire` | 0.5×0.55×0.5 | Logs with burning flames. |  |  |
| `flame` | 0.22×0.5×0.22 | A single tall flame. |  | color |
| `lightning` | 0.3×0.8×0.08 | A glowing lightning bolt. |  | floats, color |
| `crystal` | 0.4×0.5×0.4 | A cluster of crystals. |  | color |
| `mushroom` | 0.26×0.3×0.26 | A mushroom with a spotted cap. |  | color |
| `fruit` | 0.12×0.14×0.12 | A piece of fruit. | apple, orange, pear, banana, grapes | holdable |
| `ice_block` | 0.35×0.35×0.35 | A translucent block of ice. |  |  |
| `fountain` | 1.0×1.1×1.0 | A tiered stone fountain with water. |  | color |

## Furniture

| prop | size (m) | description | variants | notes |
|---|---|---|---|---|
| `table` | 0.9×0.55×0.6 | A table. Top surface at 0.55 m. | rect, round, desk | color |
| `chair` | 0.4×0.75×0.42 | A chair. Seat height 0.45 m. | chair, stool, armchair | color |
| `bench` | 1.0×0.6×0.42 | A bench with a backrest; the seat is at 0.45 m. | park, pew | color |
| `bookshelf` | 0.9×1.4×0.32 | A bookshelf full of books. |  | color |
| `desk_lamp` | 0.22×0.42×0.22 | A glowing desk lamp. |  | color |
| `floor_lamp` | 0.35×1.5×0.35 | A glowing standing lamp. |  | color |
| `lamp_post` | 0.3×1.9×0.3 | A street lamp post. |  | color |
| `lantern` | 0.2×0.35×0.2 | A glowing lantern. |  | holdable, color |
| `candle` | 0.08×0.26×0.08 | A lit candle. |  | holdable, color |
| `chandelier` | 0.9×0.7×0.9 | A chandelier (hangs: give it a y). |  | floats, color |
| `door` | 0.65×1.35×0.15 | A free-standing door in its frame. | closed, open, ajar | color |
| `stairs` | 0.7×0.6×0.8 | A short flight of steps rising toward the back. |  | color |
| `ladder` | 0.4×1.4×0.12 | A ladder. |  | color |
| `throne` | 0.7×1.3×0.6 | A throne. color = frame, color2 = cushion. |  | color, color2 |
| `curtain` | 1.4×1.6×0.2 | A pair of stage curtains with a valance. |  | color |
| `lectern` | 0.5×1.0×0.45 | A lectern / podium. |  | color |
| `rug` | 1.0×0.02×0.7 | A patterned rug. |  | color, color2 |
| `mirror` | 0.5×1.1×0.25 | A standing oval mirror. |  | color |

## Household

| prop | size (m) | description | variants | notes |
|---|---|---|---|---|
| `crate` | 0.4×0.4×0.4 | A wooden crate. |  | color |
| `chest` | 0.5×0.42×0.34 | A treasure chest; 'open' shows gold inside. | closed, open | color |
| `cage` | 0.36×0.5×0.36 | A cage. | bird, box | color |
| `basket` | 0.36×0.26×0.36 | A woven basket. |  | color |
| `bucket` | 0.26×0.3×0.26 | A bucket. |  | color |
| `barrel` | 0.4×0.6×0.4 | A wooden barrel. |  | color |
| `jar` | 0.2×0.3×0.2 | A glass jar; color = contents. | empty, filled | color |
| `cup` | 0.14×0.12×0.11 | A mug. |  | holdable, color |
| `bottle` | 0.1×0.32×0.1 | A bottle. |  | holdable, color |
| `clock` | 0.36×0.42×0.16 | A clock showing about ten past ten. | table, alarm | color |
| `grandfather_clock` | 0.45×1.6×0.3 | A tall grandfather clock with a pendulum. |  | color |
| `station_clock` | 0.5×2.2×0.3 | A railway-station clock on a post. |  | color |
| `bell` | 0.3×0.36×0.3 | A bell. |  | color |
| `umbrella` | 0.7×0.8×0.7 | An open umbrella standing on its handle. |  | color |
| `cauldron` | 0.45×0.45×0.45 | A bubbling cauldron; color = brew. |  | color |
| `kettle` | 0.26×0.28×0.22 | A kettle letting off steam. |  | color |
| `stove` | 0.8×0.9×0.55 | A kitchen range with pots. |  | color |
| `cake` | 0.4×0.3×0.4 | A round cake; 'sliced' is cut into equal slices. | whole, sliced | color |

## Tools

| prop | size (m) | description | variants | notes |
|---|---|---|---|---|
| `gear` | 0.5×0.5×0.14 | A single upright gear. |  | color |
| `gear_train` | 0.9×0.55×0.14 | Three meshing gears. |  | color |
| `seesaw` | 1.0×0.45×0.3 | A seesaw / lever on a pivot. | level, left_down, right_down | color |
| `pulley` | 0.4×1.0×0.3 | A pulley frame with rope and a hanging weight. |  | color |
| `hammer` | 0.18×0.42×0.08 | A hammer standing on its head. |  | holdable, color |
| `wrench` | 0.12×0.4×0.04 | A wrench. |  | holdable, color |
| `scissors` | 0.18×0.36×0.04 | A pair of scissors. |  | color |
| `magnifier` | 0.18×0.4×0.04 | A magnifying glass. |  | holdable, color |
| `telescope` | 0.5×1.1×0.6 | A brass telescope on a tripod. |  | color |
| `microscope` | 0.28×0.45×0.32 | A microscope. |  | color |
| `balance` | 0.7×0.65×0.3 | A two-pan balance scale. | level, left_heavy, right_heavy | color |
| `ruler` | 0.6×0.03×0.08 | A ruler lying flat. |  | color |
| `drafting_compass` | 0.25×0.4×0.1 | A drawing compass standing open. |  | color |
| `funnel` | 0.3×0.4×0.3 | A funnel on a small stand. |  | color |
| `pipes` | 0.8×0.7×0.3 | A tangle of pipes with a valve wheel. |  | color |
| `conveyor` | 1.2×0.45×0.4 | A conveyor belt running left to right. |  | color |
| `hourglass` | 0.2×0.36×0.2 | An hourglass with sand. |  | color |
| `stopwatch` | 0.18×0.22×0.06 | A stopwatch. |  | holdable, color |
| `thermometer` | 0.12×0.6×0.06 | A thermometer; variant sets the level. | hot, mid, cold |  |
| `flask` | 0.16×0.32×0.16 | Laboratory glassware; color = liquid. | erlenmeyer, round, test_tubes | color |
| `prism` | 0.36×0.3×0.3 | A glass prism splitting a beam into a rainbow. |  |  |
| `pendulum` | 0.4×0.85×0.2 | A pendulum in a frame. |  | color |
| `spring` | 0.16×0.4×0.16 | A coil spring. |  | color |
| `anvil` | 0.5×0.4×0.25 | A blacksmith's anvil. |  |  |
| `workbench` | 1.1×0.85×0.55 | A workbench with tools on it. |  | color |
| `gavel` | 0.22×0.12×0.1 | A judge's gavel on its block. |  | holdable, color |
| `stamp` | 0.12×0.18×0.12 | A rubber stamp; color = ink. |  | color |
| `magnet` | 0.3×0.32×0.1 | A red horseshoe magnet. |  |  |
| `torch` | 0.08×0.45×0.08 | A burning hand torch. |  | holdable |

## Devices

| prop | size (m) | description | variants | notes |
|---|---|---|---|---|
| `computer` | 0.55×0.5×0.35 | A desktop monitor with keyboard; text shows on screen. |  | text, color |
| `laptop` | 0.38×0.26×0.3 | An open laptop; text shows on screen. |  | text, color |
| `server_rack` | 0.55×1.4×0.5 | A server rack with blinking lights. |  | color |
| `screen_wall` | 1.2×1.0×0.25 | A wall of monitors on a stand. |  | color |
| `smartphone` | 0.22×0.42×0.04 | A giant smartphone standing upright; text shows on screen. |  | text, holdable, color |
| `router` | 0.36×0.18×0.24 | A network router with antennas and lights. |  | color |
| `lightbulb` | 0.24×0.4×0.24 | A light bulb standing on its base. | on, off | color |
| `battery` | 0.2×0.4×0.2 | A battery. | full, low | color |
| `antenna` | 0.4×1.6×0.4 | A lattice radio tower with a blinking light. |  | color |
| `satellite_dish` | 0.5×0.6×0.45 | A satellite dish. |  | color |
| `camera` | 0.3×0.2×0.18 | A camera. |  | holdable, color |
| `megaphone` | 0.18×0.18×0.36 | A megaphone. |  | holdable, color |
| `slot_machine` | 0.5×0.95×0.45 | A casino slot machine; text shows on its reels. |  | text, color |
| `vending_machine` | 0.5×1.0×0.45 | A vending machine with coin slot and buttons. |  | color |
| `spotlight` | 0.3×0.6×0.3 | A stage spotlight on a stand with a light beam. |  | color |

## Places

| prop | size (m) | description | variants | notes |
|---|---|---|---|---|
| `house` | 0.7×0.75×0.6 | A small house. color = walls, color2 = roof. |  | color, color2 |
| `tower` | 0.5×1.4×0.5 | A castle tower. |  | color |
| `castle` | 1.3×1.1×1.0 | A small castle with towers and a gate. |  | color |
| `bridge` | 1.3×0.45×0.45 | An arched bridge spanning left to right. |  | color |
| `gate` | 1.0×1.1×0.25 | A stone archway. |  | color |
| `fence` | 0.9×0.42×0.08 | A picket-fence segment. |  | color |
| `tent` | 0.9×0.75×0.8 | A tent. |  | color |
| `signpost` | 0.5×1.2×0.1 | A signpost; text 'A|B' puts words on two arrow boards. |  | text, color |
| `traffic_light` | 0.2×1.1×0.2 | A traffic light. | red, yellow, green |  |
| `mailbox` | 0.3×0.85×0.3 | A post box. |  | color |
| `rocket` | 0.38×1.0×0.38 | A rocket on fins. |  | color |
| `car` | 0.36×0.38×0.7 | A small car facing the viewer. |  | color |
| `train` | 0.36×0.5×1.3 | A steam engine with a carriage, facing the viewer. |  | color |
| `boat` | 0.36×0.8×0.8 | A boat. | sail, row | color |
| `airplane` | 0.8×0.25×0.7 | A small propeller airplane facing the viewer. |  | color |
| `wheel` | 0.5×0.5×0.12 | An upright wagon wheel. |  | color |
| `lighthouse` | 0.45×1.4×0.45 | A striped lighthouse with a glowing lamp. |  | color |
| `windmill` | 0.6×1.2×0.5 | A windmill with sails. |  | color |
| `well` | 0.5×0.6×0.5 | A stone wishing well with a little roof and bucket. |  | color |
| `market_stall` | 1.1×1.2×0.6 | A market stall with a striped awning. |  | color, color2 |
| `stained_glass` | 0.7×1.2×0.08 | A stained-glass window panel on a stand. |  | color |
| `brazier` | 0.4×0.7×0.4 | A fire bowl on a tripod. |  |  |
| `maze` | 0.9×0.22×0.9 | A small hedge maze. |  | color |

## Objects

| prop | size (m) | description | variants | notes |
|---|---|---|---|---|
| `envelope` | 0.28×0.19×0.03 | A sealed envelope standing upright; text = address. |  | text, holdable, color |
| `package` | 0.32×0.26×0.28 | A parcel tied with string; text = label. |  | text, color |
| `globe` | 0.32×0.5×0.32 | A globe on a stand. |  |  |
| `map` | 0.6×0.35×0.4 | A parchment map on a slanted stand. |  |  |
| `flag` | 0.4×1.2×0.06 | A flag on a pole; text = emblem. |  | text, holdable, color, color2 |
| `trophy` | 0.28×0.45×0.2 | A trophy cup. |  | color |
| `medal` | 0.16×0.26×0.03 | A medal on a ribbon. |  | holdable, color |
| `crown` | 0.32×0.24×0.32 | A crown. |  | color |
| `sword` | 0.12×0.85×0.04 | A sword standing point-down. |  | holdable, color |
| `shield` | 0.42×0.5×0.08 | A heraldic shield on a stand. |  | holdable, color, color2 |
| `key` | 0.12×0.38×0.03 | A big old key standing upright. |  | holdable, color |
| `padlock` | 0.26×0.36×0.12 | A padlock. | locked, open | color |
| `safe` | 0.55×0.65×0.5 | A steel safe. | closed, open | color |
| `vault_door` | 1.3×1.3×0.25 | A round vault door in its frame. |  |  |
| `chain` | 0.8×0.12×0.12 | A heavy chain lying on the ground. |  | color |
| `coin` | 0.14×0.14×0.02 | A coin standing on edge. | gold, silver, copper | holdable |
| `coin_stack` | 0.16×0.25×0.16 | A stack of gold coins. |  |  |
| `gold_bar` | 0.24×0.1×0.12 | A gold bar. |  |  |
| `dice` | 0.14×0.14×0.14 | A die. |  | color |
| `playing_card` | 0.15×0.22×0.01 | A playing card standing up; text = rank and suit, e.g. 'A♠'. |  | text |
| `chess_piece` | 0.14×0.36×0.14 | A chess piece. | king, queen, rook, bishop, knight, pawn | color |
| `puzzle_piece` | 0.3×0.3×0.08 | A jigsaw piece standing up. |  | color |
| `ball` | 0.25×0.25×0.25 | A ball. | plain, soccer, beach, bowling | color |
| `balloon` | 0.3×0.75×0.3 | A balloon on a string. |  | color |
| `domino` | 0.1×0.2×0.04 | A domino standing on end; use count with row. |  |  |
| `toy_brick` | 0.24×0.14×0.12 | A toy building brick with studs. |  | color |
| `target` | 0.6×0.62×0.12 | An archery target on a stand. |  |  |
| `theater_mask` | 0.3×0.32×0.1 | A theatre mask on a stand. | comedy, tragedy | color |

## Knowledge

| prop | size (m) | description | variants | notes |
|---|---|---|---|---|
| `book` | 0.18×0.26×0.05 | A closed book standing upright; text = cover title. |  | text, holdable, color |
| `book_stack` | 0.3×0.3×0.22 | A stack of books. |  |  |
| `open_book` | 0.5×0.25×0.36 | An open book on a reading stand; text shows on the pages. |  | text, color |
| `scroll` | 0.5×0.36×0.06 | An unrolled scroll on a stand; text shows on it. |  | text, holdable |
| `paper_stack` | 0.28×0.18×0.22 | A stack of papers. |  |  |
| `pencil` | 0.08×0.6×0.08 | A giant pencil standing on its end. |  | holdable, color |
| `blackboard` | 1.0×1.1×0.35 | A blackboard on an easel; text is chalked on it (use \n for lines). |  | text |
| `easel` | 0.6×1.2×0.45 | A painting on an easel. | landscape, portrait, abstract | color, color2 |
| `plaque` | 0.42×0.6×0.08 | A small sign on a post; text shows on it. |  | text, color |
| `banner` | 1.2×1.1×0.1 | A cloth banner between two poles; text shows on it. |  | text, color |
| `speech_bubble` | 0.6×0.38×0.08 | A floating speech bubble (give it a y); text inside. |  | text, floats |
| `thought_bubble` | 0.62×0.42×0.08 | A floating thought bubble (give it a y); text inside. |  | text, floats |
| `letter_block` | 0.26×0.26×0.26 | A wooden toy block with a letter or symbol (1-3 characters). |  | text, color |
| `neon_sign` | 0.8×0.3×0.06 | Glowing neon text on a frame. |  | text, color |
| `cutout` | 0.42×0.5×0.06 | A cardboard standee printed with one emoji (set emoji). Use only when no prop fits. |  |  |
| `arrow` | 0.7×0.16×0.16 | A chunky 3D arrow pointing to the right (+x). | straight, curved, double | color |
| `number_line` | 1.4×0.2×0.1 | A number line on a low stand; text = comma-separated tick labels. |  | text, color |
| `chart` | 0.8×0.65×0.12 | A framed chart on a stand. | bar, line, pie, bell, scatter, step, exp | color |
| `network` | 0.8×0.7×0.3 | A sculpture of nodes joined by edges. color = nodes, color2 = edges. | graph, tree, chain, ring, star, grid, complete | color, color2 |
| `matrix` | 0.6×0.6×0.08 | A grid of numbered cells on a stand; text like '1 2;3 4'. |  | text, color |
| `layers` | 0.6×0.6×0.45 | A stack of labelled slabs; text 'top|middle|bottom' (2-6 layers). |  | text, color |
| `venn` | 0.8×0.6×0.15 | Overlapping translucent circles on a stand. | two, three |  |
| `solid` | 0.4×0.4×0.4 | A geometric solid on a small base. | cube, sphere, cone, cylinder, torus, tetrahedron, octahedron, dodecahedron, icosahedron, pyramid, mobius, infinity, spiral, knot | color |
| `molecule` | 0.5×0.45×0.4 | A ball-and-stick molecule. |  | color |
