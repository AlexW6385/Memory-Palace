"""Lay out the whole city from content/city.json and write world.json.

City plan (top view, 250 m grid):

    5  1  4          a 230 m plot per building; the palace stands in the middle,
    2  0  3          eight buildings around it; 20 m streets run between them.
    7  6  8

Every building keeps its plot and every locus its object forever: buildings are only
ever added, so memories hung on the city stay where they were put.
"""
from __future__ import annotations

import json
import math
import random
import time
from pathlib import Path

from palace.catalog import ROOM_STYLES
from palace.geometry import Frame, look_yaw
from palace.halls import EYE
from palace.loci import assign
from palace.nav import RADIUS, STEP
from palace.scene import LocalScene, Scene, r2
from palace.schema import Building, City
from palace.templates import PLOT_HALF, TEMPLATES, LayoutOverflow, Palette

CELL = 250.0
STREET = CELL - 2 * PLOT_HALF
WORLD_HALF = 1.5 * CELL + 10

# plot index -> (grid x, grid z, yaw that turns the plot's entrance towards a street)
SLOTS = [
    (0, 0, 0.0),
    (0, -1, math.pi), (-1, 0, -math.pi / 2), (1, 0, math.pi / 2), (1, -1, math.pi),
    (-1, -1, math.pi), (0, 1, 0.0), (-1, 1, 0.0), (1, 1, 0.0),
]


def plot_frame(index: int) -> Frame:
    gx, gz, yaw = SLOTS[index]
    return Frame(gx * CELL, gz * CELL, yaw)


def plot_bounds(index: int, margin: float = 14.0) -> tuple[float, float, float, float]:
    f = plot_frame(index)
    h = PLOT_HALF + margin
    return (f.ox - h, f.oz - h, f.ox + h, f.oz + h)


# ── scenery ──────────────────────────────────────────────────────────────────

def _occupancy(prims: list[dict], frame: Frame, cell: float = 2.0, margin: float = 3.5):
    """Cells of a plot (local frame, side 2·PLOT_HALF) covered by anything built there."""
    n = int(2 * PLOT_HALF // cell) + 1
    occ = bytearray(n * n)

    def mark(wx: float, wz: float, rx: float, rz: float) -> None:
        cx, cz = frame.inverse_point(wx, wz)
        if abs(math.sin(frame.yaw)) > 0.5:
            rx, rz = rz, rx
        i0 = max(0, int((cx - rx - margin + PLOT_HALF) // cell))
        i1 = min(n - 1, int((cx + rx + margin + PLOT_HALF) // cell))
        j0 = max(0, int((cz - rz - margin + PLOT_HALF) // cell))
        j1 = min(n - 1, int((cz + rz + margin + PLOT_HALF) // cell))
        for j in range(j0, j1 + 1):
            occ[j * n + i0 : j * n + i1 + 1] = b"\x01" * (i1 - i0 + 1)

    def ext(w: float, d: float, r: float) -> tuple[float, float]:
        c, s = abs(math.cos(r)), abs(math.sin(r))
        return w / 2 * c + d / 2 * s, w / 2 * s + d / 2 * c

    for p in prims:
        t = p["t"]
        if t in ("floor", "path", "water", "roof"):
            mark(p["p"][0], p["p"][2], *ext(p["w"], p["d"], p.get("r", 0.0)))
        elif t == "ramp":
            mark(p["p"][0], p["p"][1], *ext(p["w"], p["d"], p.get("r", 0.0)))
        elif t == "wall":
            mark(p["p"][0], p["p"][2], *ext(p["s"][0], p["s"][2], p.get("r", 0.0)))
        elif t == "disc":
            mark(p["p"][0], p["p"][2], p["r1"], p["r1"])
        elif t == "helix":
            mark(p["c"][0], p["c"][1], p["r1"], p["r1"])
        elif t == "arch":
            mark(p["p"][0], p["p"][2], p["w"] / 2 + 1, p["w"] / 2 + 1)
        elif "p" in p:
            mark(p["p"][0], p["p"][-1], 1.6, 1.6)
    return occ, n, cell


TREE_VARIANTS = ["round", "round", "round", "pine", "pine", "birch", "blossom"]


def _plot_scenery(scene: Scene, index: int, start: int, tag: str) -> None:
    """Trees along the plot's edges and in groves wherever nothing is built."""
    f = plot_frame(index)
    ls = LocalScene(scene, f, tag)
    occ, n, cell = _occupancy(scene.prims[start:], f)
    rng = random.Random(1000 + index)

    def free(x: float, z: float) -> bool:
        i, j = int((x + PLOT_HALF) // cell), int((z + PLOT_HALF) // cell)
        return 0 <= i < n and 0 <= j < n and not occ[j * n + i]

    def take(x: float, z: float, r: float) -> None:
        for dz in (-r, 0, r):
            for dx in (-r, 0, r):
                i, j = int((x + dx + PLOT_HALF) // cell), int((z + dz + PLOT_HALF) // cell)
                if 0 <= i < n and 0 <= j < n:
                    occ[j * n + i] = 1

    def tree(x: float, z: float, big: float = 1.0) -> None:
        ls.prop("tree", x, z, yaw=rng.uniform(0, 6.28), scale=rng.uniform(2.8, 4.3) * big, variant=rng.choice(TREE_VARIANTS))
        take(x, z, 2.0)

    edge = PLOT_HALF - 5
    # edge rows (leave the entrance open)
    k = -edge
    while k <= edge:
        for x, z in ((k, edge), (-edge, k), (edge, k), (k, -edge)):
            if z == -edge and abs(x) < 16:
                continue
            jx, jz = x + rng.uniform(-1.5, 1.5), z + rng.uniform(-1.5, 1.5)
            if free(jx, jz):
                tree(jx, jz)
        k += rng.uniform(7.5, 10.5)
    # groves, shrubs and boulders in the open
    for _ in range(22):
        cx, cz = rng.uniform(-edge + 8, edge - 8), rng.uniform(-edge + 8, edge - 8)
        if not free(cx, cz):
            continue
        for _ in range(rng.randint(3, 8)):
            x, z = cx + rng.uniform(-9, 9), cz + rng.uniform(-9, 9)
            if free(x, z):
                tree(x, z, rng.uniform(0.85, 1.15))
        for _ in range(rng.randint(1, 4)):
            x, z = cx + rng.uniform(-11, 11), cz + rng.uniform(-11, 11)
            if free(x, z):
                ls.prop("bush", x, z, yaw=rng.uniform(0, 6.28), scale=rng.uniform(2.0, 3.2))
                take(x, z, 1.0)
    for _ in range(16):
        x, z = rng.uniform(-edge, edge), rng.uniform(-edge, edge)
        if free(x, z):
            ls.prop("rock", x, z, yaw=rng.uniform(0, 6.28), scale=rng.uniform(2.0, 4.0),
                    variant=rng.choice(["boulder", "flat", "pile"]))
            take(x, z, 1.0)


def _streets(scene: Scene) -> None:
    ls = LocalScene(scene, Frame(), "streets")
    span = 1.5 * CELL
    for v in (-CELL / 2, CELL / 2):
        ls.strip(-span, v, span, v, STREET * 0.8, "#cfc6b6", y=0.03, pat="cobble")
        ls.strip(v, -span, v, span, STREET * 0.8, "#cfc6b6", y=0.03, pat="cobble")
    # lamp posts along the streets
    for v in (-CELL / 2, CELL / 2):
        for t in range(-360, 361, 24):
            if abs(abs(t) - CELL / 2) < 14:
                continue
            if abs(t - round(t / CELL) * CELL) < 18:
                continue  # keep the building gates clear
            for side in (-1, 1):
                ls.prop("lamp_post", t, v + side * 9.2, scale=1.8)
                ls.prop("lamp_post", v + side * 9.2, t, scale=1.8)


def _gate(ls: LocalScene, b: Building) -> None:
    ls.arch(0, -PLOT_HALF + 4.0, 0.0, 10.0, 7.5, "classic_column", b.color, post=0.6)
    ls.sign(0, 10.2, -PLOT_HALF + 4.0, b.title.model_dump(), sub=b.subtitle.model_dump(), level="region", color=b.color)


def _empty_plot(scene: Scene, index: int) -> None:
    start = len(scene.prims)
    _plot_scenery(scene, index, start, f"plot-{index}")


# ── build ────────────────────────────────────────────────────────────────────

def layout_building(b: Building, ls: LocalScene):
    """Run the building's template; if it does not fit, fall back to the city template."""
    sc = ls.scene
    marks = (len(sc.prims), len(sc.surfaces), len(sc.colliders), len(sc.ground_holes))
    try:
        return TEMPLATES[b.template](b, ls, Palette(b)), b.template
    except LayoutOverflow:
        if b.template == "city":
            raise
        del sc.prims[marks[0]:], sc.surfaces[marks[1]:], sc.colliders[marks[2]:], sc.ground_holes[marks[3]:]
        return TEMPLATES["city"](b, ls, Palette(b)), "city"


def _t(model) -> dict:
    return model.model_dump()


def build_world(city: City) -> dict:
    scene = Scene()
    _streets(scene)
    by_plot = {b.plot: b for b in city.buildings}
    layouts: dict[str, tuple[int, object, str]] = {}
    for index in range(len(SLOTS)):
        b = by_plot.get(index)
        if b is None:
            _empty_plot(scene, index)
            continue
        ls = LocalScene(scene, plot_frame(index), b.id)
        ls.tint = b.color
        start = len(scene.prims)
        _gate(ls, b)
        lay, used = layout_building(b, ls)
        layouts[b.id] = (index, lay, used)
        _plot_scenery(scene, index, start, b.id)

    objects = assign(city)
    ground = {"k": "rect", "c": [0.0, 0.0], "w": 2 * WORLD_HALF, "d": 2 * WORLD_HALF, "r": 0.0, "y": 0.0,
              "holes": scene.ground_holes}
    loci: dict[str, dict] = {}
    buildings = []
    for b in city.buildings:
        index, lay, used = layouts[b.id]
        f = plot_frame(index)

        def W(p):
            x, z = f.point(p[0], p[2])
            return [r2(x), r2(p[1]), r2(z)]

        wings = []
        for wing in b.wings:
            rooms = []
            for room in wing.rooms:
                ids = []
                for locus in room.locus_list():
                    pl = lay.loci[locus.id]
                    pos, view = W(pl.pos), W(pl.view)
                    loci[locus.id] = {
                        "building": b.id, "room": room.id, "style": room.style,
                        "pos": pos, "yaw": round(f.angle(pl.yaw), 4), "view": view,
                        "viewYaw": round(look_yaw(view[0], view[2], pos[0], pos[2]), 4),
                        "items": objects[locus.id],
                    }
                    ids.append(locus.id)
                rooms.append({"id": room.id, "title": _t(room.title), "style": room.style,
                              "anchor": W(lay.rooms[room.id]), "loci": ids})
            wings.append({"id": wing.id, "title": _t(wing.title), "summary": _t(wing.summary),
                          "anchor": W(lay.wings[wing.id]), "rooms": rooms})
        buildings.append({"id": b.id, "title": _t(b.title), "subtitle": _t(b.subtitle), "color": b.color,
                          "template": used, "plot": index, "entrance": W(lay.start), "wings": wings})

    styles = {name: {k: ROOM_STYLES[name][k] for k in ("en", "zh", "floor", "light", "stage", "wall")}
              for name in sorted({l["style"] for l in loci.values()})}
    return {
        "version": 3,
        "title": _t(city.title),
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "spawn": {"pos": [0.0, 0.0, -CELL / 2], "yaw": math.pi},
        "eye": EYE,
        "cell": CELL,
        "half": WORLD_HALF,
        "plots": [{"index": i, "center": [r2(plot_frame(i).ox), r2(plot_frame(i).oz)], "yaw": round(plot_frame(i).yaw, 4),
                   "half": PLOT_HALF, "building": by_plot[i].id if i in by_plot else None} for i in range(len(SLOTS))],
        "buildings": buildings,
        "loci": loci,
        "styles": styles,
        "nav": {"step": STEP, "radius": RADIUS, "surfaces": [ground] + scene.surfaces, "colliders": scene.colliders},
        "prims": scene.prims,
    }


def load_city(path: Path) -> City:
    return City.model_validate_json(Path(path).read_text(encoding="utf-8"))


def build_world_file(city_path: Path, out_path: Path) -> Path:
    world = build_world(load_city(city_path))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(world, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return out_path
