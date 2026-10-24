"""Assemble every knowledge system into one world and write world.json.

World plan (top view, 250 m grid):

    NW  N  NE        plots are 230 m squares; the middle cell is the central
    W   ·  E         park with the plaza; 20 m streets run between cells.
    SW  S  SE

Each system keeps its plot forever (content/manifest.json), so adding a
system never moves an existing one.
"""
from __future__ import annotations

import json
import math
import random
import time
from pathlib import Path

from palace.catalog import ROOM_STYLES
from palace.content import ContentStore, Manifest
from palace.geometry import Frame, look_yaw
from palace.halls import EYE
from palace.nav import RADIUS, STEP, Nav, astar, bake, smooth
from palace.scene import LocalScene, Scene, r2
from palace.schema import CrossLinks, KnowledgeSystem
from palace.templates import PLOT_HALF, TEMPLATES, LayoutOverflow, Palette

CELL = 250.0
STREET = CELL - 2 * PLOT_HALF
WORLD_HALF = 1.5 * CELL + 10
TITLE = {"en": "Memory Palace", "zh": "记忆宫殿"}
PARK = CELL / 2 - STREET / 2

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


def present_links(systems: dict[str, KnowledgeSystem], crosslinks: CrossLinks) -> list:
    """Cross links whose two systems are both in the palace (a removed system takes its bridges with it)."""
    return [l for l in crosslinks.links
            if l.source.split("/")[0] in systems and l.target.split("/")[0] in systems]


def check_crosslinks(systems: dict[str, KnowledgeSystem], crosslinks: CrossLinks) -> list[str]:
    known = {f"{s.id}/{e.id}" for s in systems.values() for e in s.exhibits()}
    problems = []
    for link in present_links(systems, crosslinks):
        for ref in (link.source, link.target):
            if ref not in known:
                problems.append(f"unknown exhibit {ref!r}")
        if link.source.split("/")[0] == link.target.split("/")[0]:
            problems.append(f"{link.source} -> {link.target} is not across systems")
    return problems


# ── shared scenery ───────────────────────────────────────────────────────────

def _scatter_trees(ls: LocalScene, rng: random.Random, area, count: int, avoid) -> None:
    x0, z0, x1, z1 = area
    placed, tries = 0, 0
    while placed < count and tries < count * 30:
        tries += 1
        x, z = rng.uniform(x0, x1), rng.uniform(z0, z1)
        if avoid(x, z):
            continue
        variant = rng.choice(["round", "round", "pine", "birch", "blossom"])
        ls.prop("tree", x, z, yaw=rng.uniform(0, 6.28), scale=rng.uniform(2.6, 4.2), variant=variant)
        placed += 1


def _central_park(scene: Scene, systems: list[tuple[int, KnowledgeSystem]]) -> None:
    ls = LocalScene(scene, Frame(), "plaza")
    ls.disc_floor(0, 0, 34, 0.08, "marble", ["#ece6da", "#ddd3c2"], thick=0.12)
    ls.disc_floor(0, 0, 12, 0.14, "slabs", ["#d9d0bf", "#cbc1ae"], thick=0.2)
    # monument
    ls.cyl(0, 0.6, 0, 3.2, 1.2, "#e9e2d4", seg=8)
    ls.cyl(0, 7.2, 0, 1.6, 12.0, "#f1ece2", top=0.75, seg=4)
    ls.circle_collider(0, 0, 3.4, 0, 14)
    ls.sphere(0, 14.6, 0, 2.0, "#e2b851", mat="metal")
    ls.lamp(0, 14.6, 0, "#ffe6a8", kind="halo")
    ls.sign(0, 19.5, 0, TITLE, sub={"en": "Walk among ideas", "zh": "在知识之间散步"}, level="region",
            color="#b8862f")
    # reflecting pools in four quadrants
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        px, pz = math.sin(a) * 21, -math.cos(a) * 21
        ls.water(px, pz, 9.0, 9.0, y=0.12, yaw=a)
        ls.rect_collider(px, pz, 9.0, 9.0, 0, 0.5, yaw=a)
    # avenues to the four streets
    for k in range(4):
        a = k * math.pi / 2
        x1, z1 = math.sin(a) * PARK, -math.cos(a) * PARK
        x0, z0 = math.sin(a) * 33, -math.cos(a) * 33
        ls.strip(x0, z0, x1, z1, 9.0, "#ddd4c3", y=0.04)
        for d in range(44, int(PARK) - 4, 14):
            for side in (-1, 1):
                lx = math.sin(a) * d + math.cos(a) * side * 6.5
                lz = -math.cos(a) * d + math.sin(a) * side * 6.5
                ls.prop("lamp_post", lx, lz, scale=1.8)
    # signposts to every system, at the plaza rim
    for index, system in systems:
        gx, gz, _ = SLOTS[index]
        a = math.atan2(gx, -gz) if (gx or gz) else 0.0
        sx, sz = math.sin(a) * 30, -math.cos(a) * 30
        ls.prop("signpost", sx, sz, yaw=math.atan2(-sx, -sz), scale=2.2, text=system.title.model_dump())
    for k in range(8):
        a = k * math.pi / 4 + math.pi / 8
        ls.prop("bench", math.sin(a) * 27, -math.cos(a) * 27, yaw=a + math.pi, scale=1.6)
    # streets between all cells
    span = 1.5 * CELL
    for v in (-CELL / 2, CELL / 2):
        ls.strip(-span, v, span, v, STREET * 0.8, "#cfc6b6", y=0.03, pat="cobble")
        ls.strip(v, -span, v, span, STREET * 0.8, "#cfc6b6", y=0.03, pat="cobble")

    def avoid(x: float, z: float) -> bool:
        return math.hypot(x, z) < 42 or abs(x) < 9 or abs(z) < 9

    _scatter_trees(ls, random.Random(7), (-PARK + 4, -PARK + 4, PARK - 4, PARK - 4), 46, avoid)


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


def _empty_plot(scene: Scene, index: int) -> None:
    f = plot_frame(index)
    ls = LocalScene(scene, f, f"plot-{index}")
    start = len(scene.prims)
    h = PLOT_HALF - 6
    for (x0, z0, x1, z1) in [(-h, -h, -8, -h), (8, -h, h, -h), (h, -h, h, h), (h, h, -h, h), (-h, h, -h, -h)]:
        n = int(math.hypot(x1 - x0, z1 - z0) // 1.0)
        yaw = math.atan2(x1 - x0, z1 - z0) + math.pi / 2
        for i in range(0, n, 12):
            t = i / max(1, n)
            ls.prop("fence", x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, yaw=yaw, scale=1.6, collide=False)
    ls.prop("plaque", 0, -PLOT_HALF + 9, scale=3.2,
            text={"en": "Building site: a new wing", "zh": "空地：新的展区将建在这里"})
    ls.prop("crate", 6, -PLOT_HALF + 12, scale=2.0)
    ls.prop("barrel", 8.5, -PLOT_HALF + 11, scale=1.8)
    _plot_scenery(scene, index, start, f"plot-{index}")


def _gate(ls: LocalScene, system: KnowledgeSystem) -> None:
    ls.arch(0, -PLOT_HALF + 4.0, 0.0, 10.0, 7.5, "classic_column", system.color, post=0.6)
    ls.sign(0, 10.2, -PLOT_HALF + 4.0, system.title.model_dump(), sub=system.subtitle.model_dump(),
            level="region", color=system.color)


# ── build ────────────────────────────────────────────────────────────────────

def layout_system(system: KnowledgeSystem, ls: LocalScene):
    """Run the system's template; if the content does not fit, fall back to the city."""
    template = system.architecture.template
    sc = ls.scene
    marks = (len(sc.prims), len(sc.surfaces), len(sc.colliders), len(sc.ground_holes))
    try:
        return TEMPLATES[template](system, ls, Palette(system)), template
    except LayoutOverflow:
        if template == "city":
            raise
        del sc.prims[marks[0]:], sc.surfaces[marks[1]:], sc.colliders[marks[2]:], sc.ground_holes[marks[3]:]
        return TEMPLATES["city"](system, ls, Palette(system)), "city"


def _t(model) -> dict:
    return model.model_dump()


def build_world(systems: dict[str, KnowledgeSystem], crosslinks: CrossLinks, manifest: Manifest,
                with_tours: bool = True) -> dict:
    problems = check_crosslinks(systems, crosslinks)
    if problems:
        raise ValueError("; ".join(problems))

    scene = Scene()
    placed = [(i, systems[sid]) for i, sid in sorted(manifest.plots.items())]
    _central_park(scene, placed)
    layouts: dict[str, tuple[int, object]] = {}
    used: dict[str, str] = {}
    for index in range(len(SLOTS)):
        sid = manifest.plots.get(index)
        if sid is None:
            _empty_plot(scene, index)
            continue
        system = systems[sid]
        ls = LocalScene(scene, plot_frame(index), sid)
        start = len(scene.prims)
        _gate(ls, system)
        lay, used[sid] = layout_system(system, ls)
        layouts[sid] = (index, lay)
        _plot_scenery(scene, index, start, sid)

    ground = {"k": "rect", "c": [0.0, 0.0], "w": 2 * WORLD_HALF, "d": 2 * WORLD_HALF, "r": 0.0, "y": 0.0,
              "holes": scene.ground_holes}
    surfaces = [ground] + scene.surfaces
    nav = Nav(surfaces, scene.colliders)

    exhibits: dict[str, dict] = {}
    sys_out = []
    for sid, (index, lay) in sorted(layouts.items(), key=lambda kv: kv[1][0]):
        system = systems[sid]
        f = plot_frame(index)

        def W(p):
            x, z = f.point(p[0], p[2])
            return [r2(x), r2(p[1]), r2(z)]

        wings = []
        locus = 0
        for wing in system.wings:
            rooms = []
            for room in wing.rooms:
                refs = []
                for e in room.exhibits:
                    locus += 1
                    ref = f"{sid}/{e.id}"
                    pl = lay.exhibits[e.id]
                    pos, view = W(pl.pos), W(pl.view)
                    exhibits[ref] = {
                        "system": sid, "wing": wing.id, "room": room.id, "locus": locus, "style": room.style,
                        "title": _t(e.title), "summary": _t(e.summary), "explain": _t(e.explain),
                        "example": _t(e.example), "image": _t(e.image),
                        "cues": [{"thing": _t(c.thing), "means": _t(c.means)} for c in e.cues],
                        "keywords": [_t(k) for k in e.keywords], "emoji": e.emoji,
                        "scene": e.scene.model_dump(exclude_none=True, exclude_defaults=True),
                        "pos": pos, "yaw": round(f.angle(pl.yaw), 4), "view": view,
                        "viewYaw": round(look_yaw(view[0], view[2], pos[0], pos[2]), 4),
                        "links": [{"to": f"{sid}/{l.to}", "rel": _t(l.relation), "dir": "out"} for l in e.links],
                    }
                    refs.append(ref)
                rooms.append({"id": room.id, "title": _t(room.title), "summary": _t(room.summary),
                              "style": room.style, "anchor": W(lay.rooms[room.id]), "exhibits": refs})
            wings.append({"id": wing.id, "title": _t(wing.title), "summary": _t(wing.summary),
                          "anchor": W(lay.wings[wing.id]), "rooms": rooms})
        sys_out.append({
            "id": sid, "title": _t(system.title), "subtitle": _t(system.subtitle),
            "description": _t(system.description), "color": system.color, "template": used[sid],
            "metaphor": _t(system.architecture.metaphor), "plot": index, "entrance": W(lay.start), "wings": wings,
        })

    for ref, ex in list(exhibits.items()):
        for link in list(ex["links"]):
            if link["dir"] == "out" and link["to"] in exhibits:
                exhibits[link["to"]]["links"].append({"to": ref, "rel": link["rel"], "dir": "in"})
    bridges: dict[tuple[str, str], int] = {}
    for cl in present_links(systems, crosslinks):
        exhibits[cl.source]["links"].append({"to": cl.target, "rel": _t(cl.relation), "dir": "out"})
        exhibits[cl.target]["links"].append({"to": cl.source, "rel": _t(cl.relation), "dir": "in"})
        a, b = sorted((cl.source.split("/")[0], cl.target.split("/")[0]))
        bridges[(a, b)] = bridges.get((a, b), 0) + 1

    if with_tours:
        for so in sys_out:
            so["tour"] = build_tour(nav, so, exhibits)

    styles = {name: {k: ROOM_STYLES[name][k] for k in ("en", "zh", "floor", "light", "stage", "wall")}
              for name in sorted({e["style"] for e in exhibits.values()})}
    return {
        "version": 2,
        "title": TITLE,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "spawn": {"pos": [0.0, 0.0, -46.0], "yaw": 0.0},
        "eye": EYE,
        "cell": CELL,
        "half": WORLD_HALF,
        "plots": [{"index": i, "center": [r2(plot_frame(i).ox), r2(plot_frame(i).oz)],
                   "yaw": round(plot_frame(i).yaw, 4), "half": PLOT_HALF, "system": manifest.plots.get(i)}
                  for i in range(len(SLOTS))],
        "systems": sys_out,
        "exhibits": exhibits,
        "styles": styles,
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
