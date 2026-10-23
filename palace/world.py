"""Assemble every knowledge system into one world and write world.json.

World plan (top view, 220 m grid):

    NW  N  NE        plots are 200 m squares; the middle cell is the central
    W   ·  E         park with the plaza; 20 m streets run between cells.
    SW  S  SE

Each system gets a plot the first time it is built and keeps it forever
(content/manifest.json), so adding systems never moves existing ones.
"""
from __future__ import annotations

import json
import math
import random
import time
from pathlib import Path

from palace.content import ContentStore, Manifest
from palace.geometry import Frame, look_yaw
from palace.nav import RADIUS, STEP, Nav, astar, bake, smooth
from palace.scene import LocalScene, Scene, r2
from palace.schema import CrossLinks, KnowledgeSystem
from palace.templates import TEMPLATES
from palace.templates.common import PLOT_HALF, STONE, LayoutOverflow, Palette, SystemLayout, arch

CELL = 220.0
STREET = 20.0
WORLD_HALF = 1.5 * CELL + 5
TITLE = "记忆宫殿"

# plot index -> (grid x, grid z, yaw that turns the plot's entrance toward the street)
SLOTS = [
    (0, -1, math.pi), (1, 0, math.pi / 2), (-1, 0, -math.pi / 2), (0, 1, 0.0),
    (1, -1, math.pi), (-1, -1, math.pi), (1, 1, 0.0), (-1, 1, 0.0),
]


def plot_frame(index: int) -> Frame:
    gx, gz, yaw = SLOTS[index]
    return Frame(gx * CELL, gz * CELL, yaw)


def assign_plots(systems: dict[str, KnowledgeSystem], manifest: Manifest) -> Manifest:
    """Keep existing assignments; give new systems the first free plots."""
    plots = {i: sid for i, sid in manifest.plots.items() if sid in systems}
    for sid in systems:
        if sid in plots.values():
            continue
        free = [i for i in range(len(SLOTS)) if i not in plots]
        if not free:
            raise ValueError("no free plot left for " + sid)
        plots[free[0]] = sid
    return Manifest(plots=plots)


def check_crosslinks(systems: dict[str, KnowledgeSystem], crosslinks: CrossLinks) -> list[str]:
    known = {f"{s.id}/{e.id}" for s in systems.values() for e in s.exhibits()}
    problems = []
    for link in crosslinks.links:
        for ref in (link.source, link.target):
            if ref not in known:
                problems.append(f"unknown exhibit {ref!r}")
        if link.source.split("/")[0] == link.target.split("/")[0]:
            problems.append(f"{link.source} -> {link.target} is not across systems")
    return problems


# ── shared scenery ───────────────────────────────────────────────────────────

def _trees(ls: LocalScene, rng: random.Random, area: tuple[float, float, float, float], count: int,
           avoid) -> None:
    x0, z0, x1, z1 = area
    placed = 0
    tries = 0
    while placed < count and tries < count * 20:
        tries += 1
        x, z = rng.uniform(x0, x1), rng.uniform(z0, z1)
        if avoid(x, z):
            continue
        h = rng.uniform(4.5, 8.0)
        green = rng.choice(["#6f9a5b", "#5f8c52", "#7ea866", "#58824f"])
        ls.cyl(x, h * 0.2, z, 0.3, h * 0.4, "#7a5a3f", top=0.22, seg=6)
        ls.cyl(x, h * 0.62, z, rng.uniform(1.6, 2.4), h * 0.8, green, top=0.0, seg=7)
        ls.post(x, z, 0.35, 0, h)
        placed += 1


def _central_park(scene: Scene) -> None:
    ls = LocalScene(scene, Frame(), "plaza")
    half = CELL / 2 - STREET / 2
    ls.cyl(0, 0.04, 0, 26, 0.08, "#e7dfcf", seg=64)
    ls.cyl(0, 0.08, 0, 9, 0.1, "#d6cab3", seg=48)
    ls.cyl(0, 6.0, 0, 1.6, 12.0, STONE, top=0.7, seg=4)
    ls.post(0, 0, 1.7, 0, 12)
    ls.sphere(0, 14.2, 0, 1.8, "#f0c75e")
    ls.sign(0, 18.5, 0, TITLE, sub="在知识之间散步", level="region", color="#c08a3e")
    for k in range(4):
        a = k * math.pi / 2
        x1, z1 = math.sin(a) * half, -math.cos(a) * half
        x0, z0 = math.sin(a) * 26, -math.cos(a) * 26
        ls.strip(x0, z0, x1, z1, 8.0, "#e2d9c8", y=0.03)
    # streets between all cells
    span = 1.5 * CELL
    for v in (-CELL / 2, CELL / 2):
        ls.strip(-span, v, span, v, STREET, "#c9c1b2", y=0.02)
        ls.strip(v, -span, v, span, STREET, "#c9c1b2", y=0.02)
    for v in (-1.5 * CELL + STREET / 2, 1.5 * CELL - STREET / 2):
        ls.strip(-span, v, span, v, STREET, "#c9c1b2", y=0.02)
        ls.strip(v, -span, v, span, STREET, "#c9c1b2", y=0.02)

    def avoid(x: float, z: float) -> bool:
        return math.hypot(x, z) < 32 or abs(x) < 8 or abs(z) < 8

    _trees(ls, random.Random(7), (-half + 4, -half + 4, half - 4, half - 4), 70, avoid)


def _empty_plot(scene: Scene, index: int) -> None:
    f = plot_frame(index)
    ls = LocalScene(scene, f, f"plot-{index}")
    h = PLOT_HALF - 4
    for (x0, z0, x1, z1) in [(-h, -h, -6, -h), (6, -h, h, -h), (h, -h, h, h), (h, h, -h, h), (-h, h, -h, -h)]:
        ls.strip(x0, z0, x1, z1, 0.3, "#b9ad97", y=0.5)
    ls.sign(0, 5.0, -PLOT_HALF + 8, "空地 · 待建", sub="新的知识体系会建在这里", level="wing", color="#9a8f7c")
    _trees(ls, random.Random(100 + index), (-h, -h + 20, h, h), 18, lambda x, z: False)


def _gate(ls: LocalScene, system: KnowledgeSystem) -> None:
    arch(ls, 0, -PLOT_HALF + 3.0, 0.0, 9.0, 7.0, 0.0, system.color, post_r=0.6)
    ls.sign(0, 12.0, -PLOT_HALF + 3.0, system.title, sub=system.subtitle, level="region", color=system.color)


# ── build ────────────────────────────────────────────────────────────────────

def layout_system(system: KnowledgeSystem, ls: LocalScene) -> tuple[SystemLayout, str]:
    """Run the system's template; if the content does not fit, fall back to the city."""
    palette = Palette(system)
    template = system.architecture.template
    sc = ls.scene
    marks = (len(sc.prims), len(sc.surfaces), len(sc.colliders), len(sc.ground_holes))
    try:
        return TEMPLATES[template](system, ls, palette), template
    except LayoutOverflow:
        if template == "city":
            raise
        del sc.prims[marks[0]:], sc.surfaces[marks[1]:], sc.colliders[marks[2]:], sc.ground_holes[marks[3]:]
        return TEMPLATES["city"](system, ls, palette), "city"


def build_world(systems: dict[str, KnowledgeSystem], crosslinks: CrossLinks, manifest: Manifest,
                with_tours: bool = True) -> dict:
    problems = check_crosslinks(systems, crosslinks)
    if problems:
        raise ValueError("; ".join(problems))

    scene = Scene()
    _central_park(scene)
    layouts: dict[str, tuple[int, SystemLayout]] = {}
    used: dict[str, str] = {}
    for index in range(len(SLOTS)):
        sid = manifest.plots.get(index)
        if sid is None:
            _empty_plot(scene, index)
            continue
        system = systems[sid]
        ls = LocalScene(scene, plot_frame(index), sid)
        _gate(ls, system)
        lay, used[sid] = layout_system(system, ls)
        layouts[sid] = (index, lay)

    ground = {"k": "rect", "c": [0.0, 0.0], "w": 2 * WORLD_HALF, "d": 2 * WORLD_HALF, "r": 0.0, "y": 0.0,
              "holes": scene.ground_holes}
    surfaces = [ground] + scene.surfaces
    nav = Nav(surfaces, scene.colliders)

    exhibits: dict[str, dict] = {}
    sys_out = []
    for sid, (index, lay) in sorted(layouts.items(), key=lambda kv: kv[1][0]):
        system = systems[sid]
        f = plot_frame(index)

        def W(p: tuple[float, float, float]) -> list[float]:
            x, z = f.point(p[0], p[2])
            return [r2(x), r2(p[1]), r2(z)]

        wings = []
        order = 0
        for wing in system.wings:
            rooms = []
            for room in wing.rooms:
                refs = []
                for e in room.exhibits:
                    ref = f"{sid}/{e.id}"
                    pl = lay.exhibits[e.id]
                    pos, view = W(pl.pos), W(pl.view)
                    exhibits[ref] = {
                        "system": sid, "wing": wing.id, "room": room.id, "order": order,
                        "title": e.title, "summary": e.summary, "detail": e.detail, "image": e.image,
                        "keywords": e.keywords, "emoji": e.emoji, "symbol": e.symbol, "color": pl.color,
                        "pos": pos, "view": view, "yaw": round(look_yaw(view[0], view[2], pos[0], pos[2]), 3),
                        "links": [{"to": f"{sid}/{l.to}", "rel": l.relation, "dir": "out"} for l in e.links],
                    }
                    refs.append(ref)
                    order += 1
                rooms.append({"id": room.id, "title": room.title, "summary": room.summary,
                              "anchor": W(lay.rooms[room.id]), "exhibits": refs})
            wings.append({"id": wing.id, "title": wing.title, "summary": wing.summary,
                          "anchor": W(lay.wings[wing.id]), "rooms": rooms})
        sys_out.append({
            "id": sid, "title": system.title, "subtitle": system.subtitle, "description": system.description,
            "color": system.color, "template": used[sid],
            "metaphor": system.architecture.metaphor, "plot": index,
            "entrance": W(lay.start), "wings": wings,
        })

    # backlinks and cross links
    for ref, ex in list(exhibits.items()):
        for link in list(ex["links"]):
            if link["dir"] == "out":
                exhibits[link["to"]]["links"].append({"to": ref, "rel": link["rel"], "dir": "in"})
    bridges: dict[tuple[str, str], int] = {}
    for cl in crosslinks.links:
        exhibits[cl.source]["links"].append({"to": cl.target, "rel": cl.relation, "dir": "out"})
        exhibits[cl.target]["links"].append({"to": cl.source, "rel": cl.relation, "dir": "in"})
        a, b = sorted((cl.source.split("/")[0], cl.target.split("/")[0]))
        bridges[(a, b)] = bridges.get((a, b), 0) + 1

    if with_tours:
        for so in sys_out:
            so["tour"] = build_tour(nav, so, exhibits)

    return {
        "version": 1,
        "title": TITLE,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "spawn": {"pos": [0.0, 0.0, -28.0], "yaw": 0.0},
        "cell": CELL,
        "half": WORLD_HALF,
        "plots": [{"index": i, "center": [r2(plot_frame(i).ox), r2(plot_frame(i).oz)],
                   "yaw": round(plot_frame(i).yaw, 4), "half": PLOT_HALF, "system": manifest.plots.get(i)}
                  for i in range(len(SLOTS))],
        "systems": sys_out,
        "exhibits": exhibits,
        "bridges": [{"a": a, "b": b, "n": n} for (a, b), n in sorted(bridges.items())],
        "nav": {"step": STEP, "radius": RADIUS, "surfaces": surfaces, "colliders": scene.colliders},
        "prims": scene.prims,
    }


def plot_bounds(index: int, margin: float = 14.0) -> tuple[float, float, float, float]:
    f = plot_frame(index)
    h = PLOT_HALF + margin
    return (f.ox - h, f.oz - h, f.ox + h, f.oz + h)


def build_tour(nav: Nav, system_out: dict, exhibits: dict) -> dict:
    """Walkable path from the plot entrance through every exhibit in order."""
    grid = bake(nav, plot_bounds(system_out["plot"]))
    ex, ey, ez = system_out["entrance"]
    points: list[list[float]] = [[ex, ey, ez]]
    stops = []
    cur = (ex, ez, ey)
    for wing in system_out["wings"]:
        for room in wing["rooms"]:
            for ref in room["exhibits"]:
                vx, vy, vz = exhibits[ref]["view"]
                raw = astar(grid, cur, (vx, vz, vy))
                seg = smooth(grid, raw, check=nav.segment_ok)
                for x, y, z in seg[1:]:
                    points.append([r2(x), r2(y), r2(z)])
                stops.append({"ref": ref, "at": len(points) - 1})
                cur = (vx, vz, seg[-1][1])
    return {"path": points, "stops": stops}


def build_world_file(content_dir: Path, out_path: Path) -> Path:
    store = ContentStore(content_dir)
    systems = store.load_systems()
    manifest = assign_plots(systems, store.load_manifest())
    store.save_manifest(manifest)
    world = build_world(systems, store.load_crosslinks(), manifest)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(world, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return out_path
