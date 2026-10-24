"""Give every locus in the city its own object.

A memory palace works when no two places look alike, so every locus gets a different
catalogue prop (or, once every prop is used, a different variant or colour), scaled to stand
about a metre high on its plinth. Assignment is deterministic and follows the walking route,
so adding a building at the end never changes the loci that already exist.
"""
from __future__ import annotations

import random

from palace import scenes
from palace.catalog import HATS, POSES, PROPS
from palace.schema import City

# props that are text, flat or structural rather than objects you would remember a place by
EXCLUDE = {
    "cutout", "plaque", "signpost", "speech_bubble", "thought_bubble", "number_line", "matrix", "layers", "arrow",
    "rug", "curtain", "stairs", "fence", "hedge", "letter_block", "banner", "neon_sign", "venn", "pool", "wave",
    "paper_stack", "domino", "coin", "playing_card", "dice", "chain", "spring", "screen_wall", "door", "gate",
    "bridge", "tent", "market_stall", "conveyor", "pipes", "stained_glass", "chandelier", "spotlight", "leaf",
}
COMPANIONS = ["candle", "book_stack", "potted_plant", "cup", "lantern", "flower", "basket", "bottle", "jar", "bird",
              "cat", "duck", "rabbit", "crate", "barrel", "bucket", "hourglass", "globe", "kettle", "egg"]
COLORS = ["#c0392b", "#2e86c1", "#28b463", "#f1c40f", "#8e44ad", "#e67e22", "#16a085", "#d35490", "#34495e",
          "#a0522d", "#5dade2", "#f5b7b1", "#7d3c98", "#1e8449", "#b9770e", "#ecf0f1"]
SEED = 20261024


def _scale(name: str, rng: random.Random) -> float:
    w, h, d = PROPS[name]["size"]
    target = rng.uniform(1.25, 1.75)
    s = target / max(h, 0.15)
    s = min(s, 2.1 / max(w, d, 0.1), 3.0)
    return round(max(0.45, s), 2)


def _hero(name: str, variant: str | None, color: str | None, rng: random.Random) -> dict:
    item: dict = {"prop": name, "at": [0.0, -0.12], "scale": _scale(name, rng), "rot": rng.choice([-25, -12, 0, 12, 25])}
    if variant:
        item["variant"] = variant
    if color and PROPS[name]["colors"] >= 1:
        item["color"] = color
    if name in ("figure", "statue"):
        item["pose"] = rng.choice([p for p in POSES if p not in ("lie", "fall", "sit")])
        if name == "figure":
            item["hat"] = rng.choice(HATS)
    if PROPS[name]["floats"]:
        item["y"] = 0.35
    return item


def _fit(items: list[dict]) -> list[dict]:
    """Shrink the hero until the scene sits on the plinth without collisions; drop the companion if needed."""
    for _ in range(12):
        if not scenes.check(items):
            return items
        items[0]["scale"] = round(items[0]["scale"] * 0.88, 2)
    if len(items) > 1:
        return _fit(items[:1])
    return items


def assign(city: City) -> dict[str, list[dict]]:
    """locus id → scene items (the object, sometimes with a small companion)."""
    rng = random.Random(SEED)
    combos = [(n, v) for n, p in PROPS.items() if n not in EXCLUDE for v in (p["variants"] or [None])]
    rng.shuffle(combos)
    used_props: dict[str, int] = {}
    used_combos: set[tuple] = set()
    out: dict[str, list[dict]] = {}
    for building in city.buildings:
        for room in building.rooms():
            in_room: set[str] = set()
            last_group = None
            for locus in room.locus_list():
                best = None
                fresh_left = any(used_props.get(n, 0) == 0 and n not in in_room for n, _ in combos)
                for round_ in range(3):
                    for name, variant in combos:
                        color = None if round_ == 0 else COLORS[(len(used_combos) + round_) % len(COLORS)]
                        if color and PROPS[name]["colors"] < 1:
                            continue  # a colour change would not show
                        key = (name, variant, color)
                        if key in used_combos or name in in_room or PROPS[name]["group"] == last_group:
                            continue
                        if round_ == 0 and used_props.get(name, 0) > 0 and fresh_left:
                            continue  # spend every prop once before reusing one in another variant
                        best = key
                        break
                    if best:
                        break
                name, variant, color = best
                used_combos.add(best)
                used_props[name] = used_props.get(name, 0) + 1
                in_room.add(name)
                last_group = PROPS[name]["group"]
                items = [_hero(name, variant, color, rng)]
                if rng.random() < 0.5:
                    comp = rng.choice([c for c in COMPANIONS if c != name])
                    side = rng.choice([-1, 1])
                    items.append({"prop": comp, "at": [side * 0.82, 0.42], "rot": rng.choice([-30, 0, 30])})
                out[locus.id] = _fit(items)
    return out
