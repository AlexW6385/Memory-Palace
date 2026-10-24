"""Source for palace/catalog/props.json — the 3D prop vocabulary.

Every name here has a builder in web/js/props/ (checked by tests). Sizes are
[width (x), height (y), depth (z)] in metres at scale 1, with the prop's base
at y = 0, centred on the origin and its front facing +z (towards the viewer).

Run `python -m palace.catalog.build_props` after editing to regenerate the JSON.
"""
from __future__ import annotations

import json
from pathlib import Path

POSES = ["stand", "walk", "run", "point", "wave", "cheer", "think", "sit", "kneel", "lift", "carry",
         "push", "pull", "throw", "lie", "bow", "read", "shrug", "fight", "fall"]
HATS = ["none", "top_hat", "cap", "crown", "graduation", "hood", "helmet", "laurel", "hard_hat", "chef",
        "wizard", "beret"]
ANIMS = ["spin", "bob", "sway", "pulse", "orbit", "hop", "swing", "flicker"]
ARRANGES = ["row", "column", "grid", "ring", "arc", "stack", "scatter"]
BACKDROP_PATTERNS = ["plain", "rays", "dots", "grid", "waves", "stars", "stripes", "rings", "checks", "leaves"]

# name, group, size, description, variants, colors, flags
#   flags: t = takes text, h = holdable (a figure can hold it), f = floats (give it a y)
P = []


def prop(name, group, size, desc, variants=None, colors=1, flags=""):
    P.append({
        "name": name, "group": group, "size": list(size), "desc": desc,
        "variants": variants or [], "colors": colors,
        "text": "t" in flags, "holdable": "h" in flags, "floats": "f" in flags,
    })


# ── people & characters ──────────────────────────────────────────────────────
G = "people"
prop("figure", G, (0.42, 0.95, 0.28),
     "A stylised person about 0.95 m tall. Set pose, hat and an item to hold; color = clothes, color2 = hair.",
     ["adult", "child", "robed"], 2)
prop("statue", G, (0.5, 1.35, 0.5), "A marble statue of a person on a plinth; takes a pose like a figure.",
     ["marble", "bronze"], 1)
prop("bust", G, (0.38, 0.72, 0.34), "A classical portrait bust on a short column.", ["plain", "laurel", "bearded"], 1)
prop("crowd", G, (1.2, 0.95, 0.7), "A small crowd of six to eight people.", ["standing", "cheering", "marching"], 0)
prop("hand", G, (0.4, 0.6, 0.3), "A giant hand rising from the stage, as if reaching into the scene.",
     ["open", "point", "fist", "grab", "thumbs_up", "pinch"], 1)
prop("eye", G, (0.45, 0.5, 0.4), "A giant eyeball on a small stand, looking at the viewer; color = iris.")
prop("brain", G, (0.5, 0.42, 0.55), "A pink brain on a dish.")
prop("heart", G, (0.4, 0.42, 0.22), "A symbolic heart shape standing upright.")
prop("skull", G, (0.24, 0.26, 0.3), "A human skull.")
prop("robot", G, (0.5, 0.9, 0.4), "A friendly robot; 'arm' is an industrial robot arm.", ["humanoid", "arm"], 2)
prop("spirit", G, (0.5, 0.85, 0.5), "A glowing ghost-like wisp: spirit, mind, Geist.", [], 1)

# ── animals ──────────────────────────────────────────────────────────────────
G = "animals"
prop("bird", G, (0.3, 0.3, 0.36), "A bird standing; variant sets the species.",
     ["pigeon", "dove", "owl", "eagle", "crow", "parrot"], 2)
prop("cat", G, (0.22, 0.36, 0.48), "A sitting cat.", [], 1)
prop("dog", G, (0.26, 0.45, 0.55), "A standing dog.", [], 1)
prop("fish", G, (0.12, 0.22, 0.42), "A fish (swimming pose, give it a y).", ["goldfish", "plain", "shark"], 1, "f")
prop("horse", G, (0.3, 0.85, 0.9), "A standing horse.", [], 1)
prop("snake", G, (0.5, 0.18, 0.5), "A coiled snake with raised head.", [], 1)
prop("rabbit", G, (0.2, 0.36, 0.3), "A sitting rabbit.", [], 1)
prop("turtle", G, (0.32, 0.18, 0.42), "A turtle.", [], 1)
prop("duck", G, (0.2, 0.28, 0.3), "A duck.", [], 1)
prop("bee", G, (0.16, 0.14, 0.2), "A bumblebee (give it a y to fly).", [], 0, "f")
prop("butterfly", G, (0.28, 0.2, 0.2), "A butterfly with open wings (give it a y).", [], 1, "f")
prop("elephant", G, (0.5, 0.85, 0.95), "An elephant.", [], 1)
prop("sheep", G, (0.3, 0.45, 0.55), "A woolly sheep.", [], 0)
prop("frog", G, (0.22, 0.18, 0.24), "A sitting frog.", [], 1)
prop("ant", G, (0.06, 0.04, 0.12), "A tiny ant; use count for many.", [], 0)
prop("mouse", G, (0.08, 0.08, 0.18), "A small mouse.", [], 1)
prop("egg", G, (0.12, 0.16, 0.12), "An egg.", ["whole", "cracked", "hatching"], 1)
prop("nest", G, (0.36, 0.14, 0.36), "A twig nest (put eggs on it).", [], 0)

# ── nature & elements ────────────────────────────────────────────────────────
G = "nature"
prop("tree", G, (0.9, 1.6, 0.9), "A tree. color = foliage, color2 = trunk.",
     ["round", "pine", "palm", "birch", "blossom", "bare"], 2)
prop("bush", G, (0.6, 0.45, 0.6), "A rounded bush.")
prop("hedge", G, (1.2, 0.8, 0.45), "A clipped box-hedge segment.")
prop("flower", G, (0.14, 0.38, 0.14), "A single flower; use count for a bed.", ["tulip", "daisy", "rose", "sunflower"], 1)
prop("potted_plant", G, (0.36, 0.65, 0.36), "A plant in a pot.", ["leafy", "cactus", "fern"], 1)
prop("sprout", G, (0.14, 0.2, 0.14), "A seedling with two leaves.", [], 0)
prop("leaf", G, (0.3, 0.05, 0.45), "A big single leaf lying flat.", [], 1)
prop("rock", G, (0.5, 0.36, 0.45), "A rock.", ["boulder", "flat", "pile"], 1)
prop("mountain", G, (1.4, 1.0, 1.1), "A small mountain.", ["peak", "twin", "volcano"], 1)
prop("cloud", G, (0.9, 0.45, 0.5), "A cloud (give it a y).", ["fluffy", "rain", "storm"], 1, "f")
prop("sun", G, (0.6, 0.6, 0.2), "A glowing sun with rays (give it a y).", [], 1, "f")
prop("moon", G, (0.4, 0.5, 0.15), "A crescent moon (give it a y).", [], 1, "f")
prop("star", G, (0.42, 0.42, 0.1), "A glowing five-pointed star.", [], 1, "f")
prop("planet", G, (0.7, 0.5, 0.7), "A ringed planet (give it a y).", [], 2, "f")
prop("pool", G, (1.2, 0.08, 0.8), "A shallow pool of water with a stone rim.", ["round", "rect"], 1)
prop("wave", G, (0.9, 0.55, 0.35), "A curling ocean wave.", [], 1)
prop("campfire", G, (0.5, 0.55, 0.5), "Logs with burning flames.", [], 0)
prop("flame", G, (0.22, 0.5, 0.22), "A single tall flame.", [], 1)
prop("lightning", G, (0.3, 0.8, 0.08), "A glowing lightning bolt.", [], 1, "f")
prop("crystal", G, (0.4, 0.5, 0.4), "A cluster of crystals.", [], 1)
prop("mushroom", G, (0.26, 0.3, 0.26), "A mushroom with a spotted cap.", [], 1)
prop("fruit", G, (0.12, 0.14, 0.12), "A piece of fruit.", ["apple", "orange", "pear", "banana", "grapes"], 0, "h")
prop("ice_block", G, (0.35, 0.35, 0.35), "A translucent block of ice.", [], 0)
prop("fountain", G, (1.0, 1.1, 1.0), "A tiered stone fountain with water.", [], 1)

# ── furniture & interiors ────────────────────────────────────────────────────
G = "furniture"
prop("table", G, (0.9, 0.55, 0.6), "A table. Top surface at 0.55 m.", ["rect", "round", "desk"], 1)
prop("chair", G, (0.4, 0.75, 0.42), "A chair. Seat height 0.45 m.", ["chair", "stool", "armchair"], 1)
prop("bench", G, (1.0, 0.6, 0.42), "A bench with a backrest; the seat is at 0.45 m.", ["park", "pew"], 1)
prop("bookshelf", G, (0.9, 1.4, 0.32), "A bookshelf full of books.", [], 1)
prop("desk_lamp", G, (0.22, 0.42, 0.22), "A glowing desk lamp.", [], 1)
prop("floor_lamp", G, (0.35, 1.5, 0.35), "A glowing standing lamp.", [], 1)
prop("lamp_post", G, (0.3, 1.9, 0.3), "A street lamp post.", [], 1)
prop("lantern", G, (0.2, 0.35, 0.2), "A glowing lantern.", [], 1, "h")
prop("candle", G, (0.08, 0.26, 0.08), "A lit candle.", [], 1, "h")
prop("chandelier", G, (0.9, 0.7, 0.9), "A chandelier (hangs: give it a y).", [], 1, "f")
prop("door", G, (0.65, 1.35, 0.15), "A free-standing door in its frame.", ["closed", "open", "ajar"], 1)
prop("stairs", G, (0.7, 0.6, 0.8), "A short flight of steps rising toward the back.", [], 1)
prop("ladder", G, (0.4, 1.4, 0.12), "A ladder.", [], 1)
prop("throne", G, (0.7, 1.3, 0.6), "A throne. color = frame, color2 = cushion.", [], 2)
prop("curtain", G, (1.4, 1.6, 0.2), "A pair of stage curtains with a valance.", [], 1)
prop("lectern", G, (0.5, 1.0, 0.45), "A lectern / podium.", [], 1)
prop("rug", G, (1.0, 0.02, 0.7), "A patterned rug.", [], 2)
prop("mirror", G, (0.5, 1.1, 0.25), "A standing oval mirror.", [], 1)

# ── containers & household ───────────────────────────────────────────────────
G = "household"
prop("crate", G, (0.4, 0.4, 0.4), "A wooden crate.")
prop("chest", G, (0.5, 0.42, 0.34), "A treasure chest; 'open' shows gold inside.", ["closed", "open"], 1)
prop("cage", G, (0.36, 0.5, 0.36), "A cage.", ["bird", "box"], 1)
prop("basket", G, (0.36, 0.26, 0.36), "A woven basket.")
prop("bucket", G, (0.26, 0.3, 0.26), "A bucket.")
prop("barrel", G, (0.4, 0.6, 0.4), "A wooden barrel.")
prop("jar", G, (0.2, 0.3, 0.2), "A glass jar; color = contents.", ["empty", "filled"], 1)
prop("cup", G, (0.14, 0.12, 0.11), "A mug.", [], 1, "h")
prop("bottle", G, (0.1, 0.32, 0.1), "A bottle.", [], 1, "h")
prop("clock", G, (0.36, 0.42, 0.16), "A clock showing about ten past ten.", ["table", "alarm"], 1)
prop("grandfather_clock", G, (0.45, 1.6, 0.3), "A tall grandfather clock with a pendulum.", [], 1)
prop("station_clock", G, (0.5, 2.2, 0.3), "A railway-station clock on a post.", [], 1)
prop("bell", G, (0.3, 0.36, 0.3), "A bell.", [], 1)
prop("umbrella", G, (0.7, 0.8, 0.7), "An open umbrella standing on its handle.", [], 1)
prop("cauldron", G, (0.45, 0.45, 0.45), "A bubbling cauldron; color = brew.", [], 1)
prop("kettle", G, (0.26, 0.28, 0.22), "A kettle letting off steam.", [], 1)
prop("stove", G, (0.8, 0.9, 0.55), "A kitchen range with pots.", [], 1)
prop("cake", G, (0.4, 0.3, 0.4), "A round cake; 'sliced' is cut into equal slices.", ["whole", "sliced"], 1)

# ── tools, machines & lab ────────────────────────────────────────────────────
G = "tools"
prop("gear", G, (0.5, 0.5, 0.14), "A single upright gear.", [], 1)
prop("gear_train", G, (0.9, 0.55, 0.14), "Three meshing gears.", [], 1)
prop("seesaw", G, (1.0, 0.45, 0.3), "A seesaw / lever on a pivot.", ["level", "left_down", "right_down"], 1)
prop("pulley", G, (0.4, 1.0, 0.3), "A pulley frame with rope and a hanging weight.", [], 1)
prop("hammer", G, (0.18, 0.42, 0.08), "A hammer standing on its head.", [], 1, "h")
prop("wrench", G, (0.12, 0.4, 0.04), "A wrench.", [], 1, "h")
prop("scissors", G, (0.18, 0.36, 0.04), "A pair of scissors.", [], 1)
prop("magnifier", G, (0.18, 0.4, 0.04), "A magnifying glass.", [], 1, "h")
prop("telescope", G, (0.5, 1.1, 0.6), "A brass telescope on a tripod.", [], 1)
prop("microscope", G, (0.28, 0.45, 0.32), "A microscope.", [], 1)
prop("balance", G, (0.7, 0.65, 0.3), "A two-pan balance scale.", ["level", "left_heavy", "right_heavy"], 1)
prop("ruler", G, (0.6, 0.03, 0.08), "A ruler lying flat.", [], 1)
prop("drafting_compass", G, (0.25, 0.4, 0.1), "A drawing compass standing open.", [], 1)
prop("funnel", G, (0.3, 0.4, 0.3), "A funnel on a small stand.", [], 1)
prop("pipes", G, (0.8, 0.7, 0.3), "A tangle of pipes with a valve wheel.", [], 1)
prop("conveyor", G, (1.2, 0.45, 0.4), "A conveyor belt running left to right.", [], 1)
prop("hourglass", G, (0.2, 0.36, 0.2), "An hourglass with sand.", [], 1)
prop("stopwatch", G, (0.18, 0.22, 0.06), "A stopwatch.", [], 1, "h")
prop("thermometer", G, (0.12, 0.6, 0.06), "A thermometer; variant sets the level.", ["hot", "mid", "cold"], 0)
prop("flask", G, (0.16, 0.32, 0.16), "Laboratory glassware; color = liquid.", ["erlenmeyer", "round", "test_tubes"], 1)
prop("prism", G, (0.36, 0.3, 0.3), "A glass prism splitting a beam into a rainbow.", [], 0)
prop("pendulum", G, (0.4, 0.85, 0.2), "A pendulum in a frame.", [], 1)
prop("spring", G, (0.16, 0.4, 0.16), "A coil spring.", [], 1)
prop("anvil", G, (0.5, 0.4, 0.25), "A blacksmith's anvil.", [], 0)
prop("workbench", G, (1.1, 0.85, 0.55), "A workbench with tools on it.", [], 1)
prop("gavel", G, (0.22, 0.12, 0.1), "A judge's gavel on its block.", [], 1, "h")
prop("stamp", G, (0.12, 0.18, 0.12), "A rubber stamp; color = ink.", [], 1)
prop("magnet", G, (0.3, 0.32, 0.1), "A red horseshoe magnet.", [], 0)
prop("torch", G, (0.08, 0.45, 0.08), "A burning hand torch.", [], 0, "h")

# ── electronics & devices ────────────────────────────────────────────────────
G = "devices"
prop("computer", G, (0.55, 0.5, 0.35), "A desktop monitor with keyboard; text shows on screen.", [], 1, "t")
prop("laptop", G, (0.38, 0.26, 0.3), "An open laptop; text shows on screen.", [], 1, "t")
prop("server_rack", G, (0.55, 1.4, 0.5), "A server rack with blinking lights.", [], 1)
prop("screen_wall", G, (1.2, 1.0, 0.25), "A wall of monitors on a stand.", [], 1)
prop("smartphone", G, (0.22, 0.42, 0.04), "A giant smartphone standing upright; text shows on screen.", [], 1, "th")
prop("router", G, (0.36, 0.18, 0.24), "A network router with antennas and lights.", [], 1)
prop("lightbulb", G, (0.24, 0.4, 0.24), "A light bulb standing on its base.", ["on", "off"], 1)
prop("battery", G, (0.2, 0.4, 0.2), "A battery.", ["full", "low"], 1)
prop("antenna", G, (0.4, 1.6, 0.4), "A lattice radio tower with a blinking light.", [], 1)
prop("satellite_dish", G, (0.5, 0.6, 0.45), "A satellite dish.", [], 1)
prop("camera", G, (0.3, 0.2, 0.18), "A camera.", [], 1, "h")
prop("megaphone", G, (0.18, 0.18, 0.36), "A megaphone.", [], 1, "h")
prop("slot_machine", G, (0.5, 0.95, 0.45), "A casino slot machine; text shows on its reels.", [], 1, "t")
prop("vending_machine", G, (0.5, 1.0, 0.45), "A vending machine with coin slot and buttons.", [], 1)
prop("spotlight", G, (0.3, 0.6, 0.3), "A stage spotlight on a stand with a light beam.", [], 1)

# ── buildings, places & vehicles ─────────────────────────────────────────────
G = "places"
prop("house", G, (0.7, 0.75, 0.6), "A small house. color = walls, color2 = roof.", [], 2)
prop("tower", G, (0.5, 1.4, 0.5), "A castle tower.", [], 1)
prop("castle", G, (1.3, 1.1, 1.0), "A small castle with towers and a gate.", [], 1)
prop("bridge", G, (1.3, 0.45, 0.45), "An arched bridge spanning left to right.", [], 1)
prop("gate", G, (1.0, 1.1, 0.25), "A stone archway.", [], 1)
prop("fence", G, (0.9, 0.42, 0.08), "A picket-fence segment.", [], 1)
prop("tent", G, (0.9, 0.75, 0.8), "A tent.", [], 1)
prop("signpost", G, (0.5, 1.2, 0.1), "A signpost; text 'A|B' puts words on two arrow boards.", [], 1, "t")
prop("traffic_light", G, (0.2, 1.1, 0.2), "A traffic light.", ["red", "yellow", "green"], 0)
prop("mailbox", G, (0.3, 0.85, 0.3), "A post box.", [], 1)
prop("rocket", G, (0.38, 1.0, 0.38), "A rocket on fins.", [], 1)
prop("car", G, (0.36, 0.38, 0.7), "A small car facing the viewer.", [], 1)
prop("train", G, (0.36, 0.5, 1.3), "A steam engine with a carriage, facing the viewer.", [], 1)
prop("boat", G, (0.36, 0.8, 0.8), "A boat.", ["sail", "row"], 1)
prop("airplane", G, (0.8, 0.25, 0.7), "A small propeller airplane facing the viewer.", [], 1)
prop("wheel", G, (0.5, 0.5, 0.12), "An upright wagon wheel.", [], 1)
prop("lighthouse", G, (0.45, 1.4, 0.45), "A striped lighthouse with a glowing lamp.", [], 1)
prop("windmill", G, (0.6, 1.2, 0.5), "A windmill with sails.", [], 1)
prop("well", G, (0.5, 0.6, 0.5), "A stone wishing well with a little roof and bucket.", [], 1)
prop("market_stall", G, (1.1, 1.2, 0.6), "A market stall with a striped awning.", [], 2)
prop("stained_glass", G, (0.7, 1.2, 0.08), "A stained-glass window panel on a stand.", [], 1)
prop("brazier", G, (0.4, 0.7, 0.4), "A fire bowl on a tripod.", [], 0)
prop("maze", G, (0.9, 0.22, 0.9), "A small hedge maze.", [], 1)

# ── objects & symbols ────────────────────────────────────────────────────────
G = "objects"
prop("envelope", G, (0.28, 0.19, 0.03), "A sealed envelope standing upright; text = address.", [], 1, "th")
prop("package", G, (0.32, 0.26, 0.28), "A parcel tied with string; text = label.", [], 1, "t")
prop("globe", G, (0.32, 0.5, 0.32), "A globe on a stand.", [], 0)
prop("map", G, (0.6, 0.35, 0.4), "A parchment map on a slanted stand.", [], 0)
prop("flag", G, (0.4, 1.2, 0.06), "A flag on a pole; text = emblem.", [], 2, "th")
prop("trophy", G, (0.28, 0.45, 0.2), "A trophy cup.", [], 1)
prop("medal", G, (0.16, 0.26, 0.03), "A medal on a ribbon.", [], 1, "h")
prop("crown", G, (0.32, 0.24, 0.32), "A crown.", [], 1)
prop("sword", G, (0.12, 0.85, 0.04), "A sword standing point-down.", [], 1, "h")
prop("shield", G, (0.42, 0.5, 0.08), "A heraldic shield on a stand.", [], 2, "h")
prop("key", G, (0.12, 0.38, 0.03), "A big old key standing upright.", [], 1, "h")
prop("padlock", G, (0.26, 0.36, 0.12), "A padlock.", ["locked", "open"], 1)
prop("safe", G, (0.55, 0.65, 0.5), "A steel safe.", ["closed", "open"], 1)
prop("vault_door", G, (1.3, 1.3, 0.25), "A round vault door in its frame.", [], 0)
prop("chain", G, (0.8, 0.12, 0.12), "A heavy chain lying on the ground.", [], 1)
prop("coin", G, (0.14, 0.14, 0.02), "A coin standing on edge.", ["gold", "silver", "copper"], 0, "h")
prop("coin_stack", G, (0.16, 0.25, 0.16), "A stack of gold coins.", [], 0)
prop("gold_bar", G, (0.24, 0.1, 0.12), "A gold bar.", [], 0)
prop("dice", G, (0.14, 0.14, 0.14), "A die.", [], 1)
prop("playing_card", G, (0.15, 0.22, 0.01), "A playing card standing up; text = rank and suit, e.g. 'A♠'.", [], 0, "t")
prop("chess_piece", G, (0.14, 0.36, 0.14), "A chess piece.", ["king", "queen", "rook", "bishop", "knight", "pawn"], 1)
prop("puzzle_piece", G, (0.3, 0.3, 0.08), "A jigsaw piece standing up.", [], 1)
prop("ball", G, (0.25, 0.25, 0.25), "A ball.", ["plain", "soccer", "beach", "bowling"], 1)
prop("balloon", G, (0.3, 0.75, 0.3), "A balloon on a string.", [], 1)
prop("domino", G, (0.1, 0.2, 0.04), "A domino standing on end; use count with row.", [], 0)
prop("toy_brick", G, (0.24, 0.14, 0.12), "A toy building brick with studs.", [], 1)
prop("target", G, (0.6, 0.62, 0.12), "An archery target on a stand.", [], 0)
prop("theater_mask", G, (0.3, 0.32, 0.1), "A theatre mask on a stand.", ["comedy", "tragedy"], 1)

# ── knowledge, text & diagrams ───────────────────────────────────────────────
G = "knowledge"
prop("book", G, (0.18, 0.26, 0.05), "A closed book standing upright; text = cover title.", [], 1, "th")
prop("book_stack", G, (0.3, 0.3, 0.22), "A stack of books.", [], 0)
prop("open_book", G, (0.5, 0.25, 0.36), "An open book on a reading stand; text shows on the pages.", [], 1, "t")
prop("scroll", G, (0.5, 0.36, 0.06), "An unrolled scroll on a stand; text shows on it.", [], 0, "th")
prop("paper_stack", G, (0.28, 0.18, 0.22), "A stack of papers.", [], 0)
prop("pencil", G, (0.08, 0.6, 0.08), "A giant pencil standing on its end.", [], 1, "h")
prop("blackboard", G, (1.0, 1.1, 0.35), "A blackboard on an easel; text is chalked on it (use \\n for lines).", [], 0, "t")
prop("easel", G, (0.6, 1.2, 0.45), "A painting on an easel.", ["landscape", "portrait", "abstract"], 2)
prop("plaque", G, (0.42, 0.6, 0.08), "A small sign on a post; text shows on it.", [], 1, "t")
prop("banner", G, (1.2, 1.1, 0.1), "A cloth banner between two poles; text shows on it.", [], 1, "t")
prop("speech_bubble", G, (0.6, 0.38, 0.08), "A floating speech bubble (give it a y); text inside.", [], 0, "tf")
prop("thought_bubble", G, (0.62, 0.42, 0.08), "A floating thought bubble (give it a y); text inside.", [], 0, "tf")
prop("letter_block", G, (0.26, 0.26, 0.26), "A wooden toy block with a letter or symbol (1-3 characters).", [], 1, "t")
prop("neon_sign", G, (0.8, 0.3, 0.06), "Glowing neon text on a frame.", [], 1, "t")
prop("cutout", G, (0.42, 0.5, 0.06), "A cardboard standee printed with one emoji (set emoji). Use only when no prop fits.", [], 0)
prop("arrow", G, (0.7, 0.16, 0.16), "A chunky 3D arrow pointing to the right (+x).", ["straight", "curved", "double"], 1)
prop("number_line", G, (1.4, 0.2, 0.1), "A number line on a low stand; text = comma-separated tick labels.", [], 1, "t")
prop("chart", G, (0.8, 0.65, 0.12), "A framed chart on a stand.", ["bar", "line", "pie", "bell", "scatter", "step", "exp"], 1)
prop("network", G, (0.8, 0.7, 0.3), "A sculpture of nodes joined by edges. color = nodes, color2 = edges.",
     ["graph", "tree", "chain", "ring", "star", "grid", "complete"], 2)
prop("matrix", G, (0.6, 0.6, 0.08), "A grid of numbered cells on a stand; text like '1 2;3 4'.", [], 1, "t")
prop("layers", G, (0.6, 0.6, 0.45), "A stack of labelled slabs; text 'top|middle|bottom' (2-6 layers).", [], 1, "t")
prop("venn", G, (0.8, 0.6, 0.15), "Overlapping translucent circles on a stand.", ["two", "three"], 0)
prop("solid", G, (0.4, 0.4, 0.4), "A geometric solid on a small base.",
     ["cube", "sphere", "cone", "cylinder", "torus", "tetrahedron", "octahedron", "dodecahedron", "icosahedron",
      "pyramid", "mobius", "infinity", "spiral", "knot"], 1)
prop("molecule", G, (0.5, 0.45, 0.4), "A ball-and-stick molecule.", [], 1)


ROOT = Path(__file__).resolve().parent


def main() -> None:
    names = [p["name"] for p in P]
    assert len(names) == len(set(names)), "duplicate prop names"
    data = {
        "poses": POSES, "hats": HATS, "anims": ANIMS, "arranges": ARRANGES,
        "backdrop_patterns": BACKDROP_PATTERNS, "props": P,
    }
    (ROOT / "props.json").write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    js = ROOT.parents[1] / "web" / "js" / "props" / "catalog.js"
    js.parent.mkdir(parents=True, exist_ok=True)
    js.write_text("// Generated by palace/catalog/build_props.py — do not edit.\n"
                  f"export const CATALOG = {json.dumps(data, ensure_ascii=False)};\n"
                  "export const PROPS = Object.fromEntries(CATALOG.props.map((p) => [p.name, p]));\n",
                  encoding="utf-8")
    groups = {}
    for p in P:
        groups[p["group"]] = groups.get(p["group"], 0) + 1
    print(f"{len(P)} props:", groups)


if __name__ == "__main__":
    main()
