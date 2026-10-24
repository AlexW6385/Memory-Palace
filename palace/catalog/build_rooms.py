"""Source for palace/catalog/rooms.json — room styles.

A room style dresses a hall: floor pattern, supports between the exhibit
alcoves, walls behind them, roof, lighting and decor props. Pick the style
whose world suits the room's content (probability in a casino, networking in a
post office) so the room itself becomes a memory cue.

Decor slots:
  gap      against the side walls, between alcoves (facing the aisle)
  end      inside corners at the entrance and exit
  ceiling  hanging above the aisle (no collision)
  outside  flanking the entrance, outside the hall
"""
from __future__ import annotations

import json
from pathlib import Path

FLOORS = ["checker", "herringbone", "planks", "tiles", "hex", "terrazzo", "marble", "carpet", "cobble", "sand",
          "grass", "slabs", "metal", "starfield", "grid_glow", "dock", "concrete"]
SUPPORTS = ["classic_column", "round_column", "square_pillar", "wood_post", "iron_column", "glass_mullion",
            "gothic_pier", "steel_beam", "stone_post", "none"]
WALLS = ["plaster", "wood_panel", "brick", "glass", "hedge", "curtain", "stone", "metal", "shelves", "mirror",
         "low_stone", "none"]
ROOFS = ["gable", "hip", "dome", "glass_gable", "flat", "pediment", "pergola", "awning", "barrel_vault",
         "sawtooth", "none"]

S = {}


def style(name, en, zh, desc, floor, support, wall, roof, light, stage, decor):
    S[name] = {"en": en, "zh": zh, "desc": desc, "floor": floor, "support": support, "wall": wall,
               "roof": roof, "light": light, "stage": stage, "decor": decor}


def F(pattern, a, b):
    return {"pattern": pattern, "colors": [a, b]}


def D(prop, where, **kw):
    return {"prop": prop, "where": where, **kw}


style("library", "Library", "图书馆", "Herringbone parquet, walls of bookshelves, green lamps, a globe.",
      F("herringbone", "#8a5a36", "#6f4529"), {"type": "wood_post", "color": "#5b3b24"},
      {"type": "shelves", "color": "#6b4a2e"}, {"type": "gable", "color": "#3f5e4a"}, "#ffd9a0", "#7a5236",
      [D("bookshelf", "gap"), D("globe", "end"), D("floor_lamp", "end", color="#2f6b4a"), D("book_stack", "end"),
       D("chandelier", "ceiling", color="#c9a646")])
style("study", "Scholar's Study", "书房", "A carpeted study: wood panelling, desk, candles, a bust.",
      F("carpet", "#7a2e2e", "#c9a646"), {"type": "wood_post", "color": "#4a2f1e"},
      {"type": "wood_panel", "color": "#5a3d2a"}, {"type": "hip", "color": "#4a3b30"}, "#ffcf8a", "#5a3d2a",
      [D("bookshelf", "gap"), D("bust", "end", variant="bearded"), D("table", "end", variant="desk"),
       D("floor_lamp", "end", color="#8a6a3a"), D("lantern", "ceiling")])
style("observatory", "Observatory", "天文台", "A dark star-map floor, a dome, brass telescopes, hanging planets.",
      F("starfield", "#1d2340", "#e8d38a"), {"type": "iron_column", "color": "#c9a646"},
      {"type": "plaster", "color": "#2a3150"}, {"type": "dome", "color": "#2b3352"}, "#bcd0ff", "#2a3150",
      [D("telescope", "gap"), D("globe", "end"), D("planet", "ceiling", color="#d98a4b"), D("star", "ceiling"),
       D("chart", "end", variant="scatter")])
style("workshop", "Workshop", "工坊", "Plank floor, timber beams, workbenches, gears and tools.",
      F("planks", "#a77b4f", "#8d6440"), {"type": "wood_post", "color": "#6b4a30"},
      {"type": "brick", "color": "#9b5a3c"}, {"type": "gable", "color": "#7a4b2f"}, "#ffd49a", "#7a5a3a",
      [D("workbench", "gap"), D("gear_train", "end"), D("barrel", "end"), D("ladder", "gap"),
       D("lantern", "ceiling")])
style("factory", "Factory", "工厂", "Concrete floor, steel girders, conveyors, pipes, a sawtooth roof.",
      F("concrete", "#9a9a96", "#8a8a86"), {"type": "steel_beam", "color": "#5d6b78"},
      {"type": "metal", "color": "#7b8794"}, {"type": "sawtooth", "color": "#6d7a86"}, "#e6f0ff", "#6d7a86",
      [D("pipes", "gap"), D("conveyor", "end"), D("crate", "end"), D("gear", "gap"), D("lamp_post", "outside")])
style("greenhouse", "Greenhouse", "温室", "Pale tiles under a glass house full of plants.",
      F("tiles", "#d9d2c3", "#c9c0ae"), {"type": "glass_mullion", "color": "#f2f2ef"},
      {"type": "glass", "color": "#cfe7e0"}, {"type": "glass_gable", "color": "#f2f2ef"}, "#fff6d8", "#b9a98f",
      [D("potted_plant", "gap"), D("tree", "end", variant="round", scale=0.8), D("bucket", "end"),
       D("flower", "gap", count=3, arrange="row")])
style("garden", "Garden", "花园", "Lawn walled by hedges, a fountain and flower beds under a pergola.",
      F("grass", "#7fae5e", "#6c9a4f"), {"type": "stone_post", "color": "#cfc8b8"},
      {"type": "hedge", "color": "#4f7f3c"}, {"type": "pergola", "color": "#d9cbb0"}, "#fff3c8", "#cfc8b8",
      [D("bush", "gap"), D("fountain", "end", scale=0.8), D("bench", "end"), D("flower", "gap", count=4,
                                                                                    arrange="row")])
style("courtroom", "Courtroom", "法庭", "Marble, classical columns, the judge's bench, scales of justice.",
      F("marble", "#e6e1d8", "#cfc6b8"), {"type": "classic_column", "color": "#efe9de"},
      {"type": "wood_panel", "color": "#6e3b2c"}, {"type": "hip", "color": "#7a2f2f"}, "#fff0d6", "#d9d0c0",
      [D("lectern", "end"), D("statue", "gap", pose="stand"), D("flag", "end", color="#7a2f2f"),
       D("balance", "end"), D("chandelier", "ceiling", color="#c9a646")])
style("arena", "Arena", "竞技场", "Raked sand ringed by stone, banners and braziers, open to the sky.",
      F("sand", "#d8c08f", "#c8ad78"), {"type": "stone_post", "color": "#bfae8c"},
      {"type": "low_stone", "color": "#a8977a"}, {"type": "none", "color": "#000000"}, "#ffd9a0", "#a8977a",
      [D("brazier", "gap"), D("flag", "end", color="#b03a2e"), D("shield", "gap"), D("crowd", "outside")])
style("casino", "Casino", "赌场", "Red patterned carpet, gold columns, slot machines and green-felt tables.",
      F("carpet", "#7b1f2b", "#d4a548"), {"type": "round_column", "color": "#d4a548"},
      {"type": "wood_panel", "color": "#1f4a3a"}, {"type": "flat", "color": "#3a1b22"}, "#ffd27a", "#1f4a3a",
      [D("slot_machine", "gap"), D("table", "end", variant="round", color="#1f6a3a"), D("coin_stack", "end"),
       D("chandelier", "ceiling", color="#d4a548")])
style("market", "Market", "集市", "Cobbles under striped awnings; stalls, crates, baskets of fruit.",
      F("cobble", "#b9ab93", "#a59680"), {"type": "wood_post", "color": "#7a5634"},
      {"type": "none", "color": "#000000"}, {"type": "awning", "color": "#d94f3d", "color2": "#f2e6d0"},
      "#fff0cc", "#a59680",
      [D("market_stall", "gap"), D("crate", "end"), D("basket", "end"), D("barrel", "gap"),
       D("lamp_post", "outside")])
style("post_office", "Post Office", "邮局", "Blue-and-cream tiles, post boxes, parcels and envelopes.",
      F("checker", "#e8e0cf", "#2f5d8a"), {"type": "round_column", "color": "#e8e0cf"},
      {"type": "plaster", "color": "#f0e9da", "color2": "#2f5d8a"}, {"type": "hip", "color": "#2f5d8a"},
      "#fff4dc", "#2f5d8a",
      [D("mailbox", "gap"), D("package", "end"), D("paper_stack", "end"), D("table", "end"),
       D("station_clock", "outside")])
style("railway_station", "Railway Station", "火车站", "Platform slabs, iron columns, a glass roof and a big clock.",
      F("slabs", "#c9c1b2", "#b7ae9e"), {"type": "iron_column", "color": "#2f4f3f"},
      {"type": "brick", "color": "#8e4b3a"}, {"type": "glass_gable", "color": "#2f4f3f"}, "#fff1d0", "#8e4b3a",
      [D("station_clock", "end"), D("bench", "gap"), D("lamp_post", "gap"), D("signpost", "outside"),
       D("crate", "end")])
style("harbor", "Harbour", "港口", "Wooden docks over water, boats, barrels and a lighthouse.",
      F("dock", "#9b7a55", "#86684a"), {"type": "wood_post", "color": "#6a4f36"},
      {"type": "none", "color": "#000000"}, {"type": "none", "color": "#000000"}, "#fff0cc", "#86684a",
      [D("barrel", "gap"), D("boat", "outside", variant="sail"), D("lighthouse", "end", scale=0.8),
       D("crate", "gap"), D("lantern", "end")])
style("laboratory", "Laboratory", "实验室", "White tiles, lab benches, flasks and microscopes.",
      F("tiles", "#eef1f2", "#d6dee2"), {"type": "square_pillar", "color": "#ffffff"},
      {"type": "plaster", "color": "#e8eef0", "color2": "#2f9aa0"}, {"type": "flat", "color": "#cfd8dc"},
      "#eef8ff", "#cfd8dc",
      [D("table", "gap", color="#e8eef0"), D("microscope", "end"), D("flask", "end", variant="round"),
       D("chart", "gap", variant="line")])
style("classroom", "Classroom", "教室", "Wooden floor, a blackboard, desks and a globe.",
      F("planks", "#c49a6c", "#b28a5e"), {"type": "square_pillar", "color": "#f2e8d5"},
      {"type": "plaster", "color": "#f2e8d5", "color2": "#4f6b4a"}, {"type": "gable", "color": "#7d8c5a"},
      "#fff4dc", "#b28a5e",
      [D("blackboard", "end"), D("table", "gap", variant="desk"), D("chair", "gap"), D("globe", "end"),
       D("book_stack", "end")])
style("temple", "Greek Temple", "希腊神庙", "Marble slabs, Doric columns, a pediment, braziers and statues.",
      F("slabs", "#e9e3d6", "#d9d1c0"), {"type": "classic_column", "color": "#f4efe4"},
      {"type": "none", "color": "#000000"}, {"type": "pediment", "color": "#e9e3d6"}, "#fff3d6", "#e9e3d6",
      [D("brazier", "end"), D("statue", "gap", pose="think"), D("bust", "gap", variant="laurel"),
       D("tree", "outside", variant="round", color="#7d8f5a")])
style("cathedral", "Cathedral", "大教堂", "Grey stone, pointed vaults, candles and stained glass.",
      F("slabs", "#b9b2a6", "#a8a094"), {"type": "gothic_pier", "color": "#a59d90"},
      {"type": "stone", "color": "#9f978b"}, {"type": "barrel_vault", "color": "#6a6f7a"}, "#ffe2b0", "#a8a094",
      [D("stained_glass", "gap"), D("candle", "end", count=5, arrange="row"), D("bench", "gap", variant="pew"),
       D("bell", "end"), D("chandelier", "ceiling")])
style("gallery", "Art Gallery", "美术馆", "Pale terrazzo, white walls, paintings on easels, spotlights.",
      F("terrazzo", "#ecebe7", "#d8d6d0"), {"type": "square_pillar", "color": "#ffffff"},
      {"type": "plaster", "color": "#fbfbf8"}, {"type": "flat", "color": "#e5e5e1"}, "#ffffff", "#d8d6d0",
      [D("easel", "gap"), D("bench", "end"), D("statue", "end", pose="stand"), D("spotlight", "gap")])
style("theater", "Theatre", "剧院", "Dark stage boards, red curtains, spotlights and masks.",
      F("planks", "#4a2e22", "#3d261c"), {"type": "round_column", "color": "#7a1f2a"},
      {"type": "curtain", "color": "#8f1d2c"}, {"type": "flat", "color": "#2a1a1e"}, "#ffd9a0", "#3d261c",
      [D("curtain", "end"), D("spotlight", "gap"), D("theater_mask", "gap"), D("chandelier", "ceiling")])
style("vault", "Bank Vault", "银行金库", "Steel floor plates, safes, a round vault door, stacks of gold.",
      F("metal", "#8d949b", "#7a8188"), {"type": "square_pillar", "color": "#6f777f"},
      {"type": "metal", "color": "#5d656d"}, {"type": "flat", "color": "#4b5258"}, "#fff1cc", "#6f777f",
      [D("safe", "gap"), D("vault_door", "end"), D("gold_bar", "end"), D("coin_stack", "gap")])
style("control_room", "Control Room", "控制室", "A dark floor with a glowing grid, screen walls and server racks.",
      F("grid_glow", "#151c2b", "#2fd1e8"), {"type": "steel_beam", "color": "#2a3346"},
      {"type": "metal", "color": "#1e2636"}, {"type": "flat", "color": "#141a26"}, "#9fe8ff", "#1e2636",
      [D("server_rack", "gap"), D("screen_wall", "end"), D("computer", "end"), D("router", "gap")])
style("kitchen", "Kitchen", "厨房", "Black-and-white checker tiles, a range, pots and copper pans.",
      F("checker", "#f1ede4", "#2b2b2b"), {"type": "square_pillar", "color": "#f4f1ea"},
      {"type": "plaster", "color": "#f4f1ea", "color2": "#b5523b"}, {"type": "hip", "color": "#b5523b"},
      "#fff1d6", "#b5523b",
      [D("stove", "gap"), D("cauldron", "end"), D("table", "end"), D("barrel", "gap"), D("lantern", "ceiling")])
style("throne_room", "Throne Room", "王座厅", "A red runner on marble, gilded columns, banners, a throne.",
      F("marble", "#efe6d6", "#7d1d2a"), {"type": "classic_column", "color": "#f1e7d0"},
      {"type": "plaster", "color": "#e9dcc0", "color2": "#7d1d2a"}, {"type": "dome", "color": "#7d1d2a"},
      "#ffe6b0", "#7d1d2a",
      [D("throne", "end"), D("flag", "gap", color="#7d1d2a"), D("statue", "gap", pose="stand"),
       D("chandelier", "ceiling", color="#d4a548")])
style("forge", "Forge", "锻造坊", "Dark stone, an anvil by the fire, chains and weapons on the walls.",
      F("slabs", "#4a4440", "#3e3935"), {"type": "stone_post", "color": "#5d5550"},
      {"type": "brick", "color": "#5a3a30"}, {"type": "gable", "color": "#3d3530"}, "#ffb070", "#3e3935",
      [D("anvil", "end"), D("brazier", "gap"), D("barrel", "gap"), D("shield", "gap"), D("campfire", "end")])
style("mirror_hall", "Hall of Mirrors", "镜厅", "A violet-and-cream marble hall lined with gilt mirrors.",
      F("checker", "#efe8f2", "#cfc4dc"), {"type": "classic_column", "color": "#fff6e0"},
      {"type": "mirror", "color": "#d4a548"}, {"type": "barrel_vault", "color": "#d8c9e8"}, "#fff4e0", "#cfc4dc",
      [D("mirror", "gap"), D("chandelier", "ceiling", color="#d4a548"), D("bench", "end"),
       D("candle", "end", count=3, arrange="row")])

ROOT = Path(__file__).resolve().parent


def main() -> None:
    for name, s in S.items():
        assert s["floor"]["pattern"] in FLOORS, name
        assert s["support"]["type"] in SUPPORTS, name
        assert s["wall"]["type"] in WALLS, name
        assert s["roof"]["type"] in ROOFS, name
    data = {"floors": FLOORS, "supports": SUPPORTS, "walls": WALLS, "roofs": ROOFS, "styles": S}
    (ROOT / "rooms.json").write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(S)} room styles")


if __name__ == "__main__":
    main()
