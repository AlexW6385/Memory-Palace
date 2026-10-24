"""Exhibit scenes: how items are arranged on a stage, and geometric checks.

Stage coordinates (metres): x to the viewer's right, z towards the viewer,
y up from the stage top. The stage is a disc of radius STAGE_R; a curved
backdrop stands behind it. `rot` is in degrees about y: 0 = the item faces
the viewer, 90 = it faces the viewer's right.

web/js/scene.js implements expand() identically.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from palace.catalog import PROPS

STAGE_R = 1.35          # stage disc radius
STAGE_H = 0.42          # height of the stage top above the floor
CENTER_R = 1.25         # item centres must lie within this radius
Z_BACK = -1.05          # ...and in front of this line (the backdrop)
EDGE_R = 1.55           # no footprint corner beyond this radius
OVERLAP_SHRINK = 0.8    # footprints are shrunk by this factor before overlap tests
GOLDEN = 2.399963229728653


@dataclass
class Instance:
    item: int           # index of the item this instance comes from
    x: float
    z: float
    y: float            # base height above the stage top
    yaw: float          # radians
    w: float            # footprint width / height / depth after scaling
    h: float
    d: float


def _default_spacing(w: float, d: float, scale: float) -> float:
    return max(w, d) * scale + 0.05


def expand(item: dict, index: int = 0) -> list[Instance]:
    """All placed copies of one scene item (count/arrange), without stacking on other items."""
    name = item["prop"]
    w, h, d = PROPS[name]["size"]
    s = float(item.get("scale", 1.0))
    w, h, d = w * s, h * s, d * s
    x0, z0 = item.get("at", (0.0, 0.0))
    y0 = float(item.get("y") or 0.0)
    rot = math.radians(float(item.get("rot", 0.0)))
    n = int(item.get("count", 1))
    arrange = item.get("arrange") or ("row" if n > 1 else None)
    face = item.get("face") or "viewer"
    sp = item.get("spacing") or _default_spacing(*PROPS[name]["size"][::2], s)
    out: list[Instance] = []

    def add(dx: float, dz: float, dy: float = 0.0, yaw: float = rot) -> None:
        out.append(Instance(index, x0 + dx, z0 + dz, y0 + dy, yaw, w, h, d))

    if n == 1 or arrange is None:
        add(0, 0)
    elif arrange == "row":
        for i in range(n):
            add((i - (n - 1) / 2) * sp, 0)
    elif arrange == "column":
        for i in range(n):
            add(0, (i - (n - 1) / 2) * sp)
    elif arrange == "grid":
        cols = int(item.get("cols") or math.ceil(math.sqrt(n)))
        rows = math.ceil(n / cols)
        for i in range(n):
            c, r = i % cols, i // cols
            add((c - (cols - 1) / 2) * sp, (r - (rows - 1) / 2) * sp)
    elif arrange == "ring":
        radius = item.get("radius") or max(0.3, n * sp / (2 * math.pi))
        for i in range(n):
            t = 2 * math.pi * i / n
            yaw = rot + (t + math.pi if face == "center" else t if face == "out" else 0.0)
            add(radius * math.sin(t), radius * math.cos(t), yaw=yaw)
    elif arrange == "arc":
        radius = item.get("radius") or 0.6
        for i in range(n):
            t = math.radians(-70 + 140 * (i / (n - 1) if n > 1 else 0.5))
            yaw = rot + (-t if face == "center" else math.pi - t if face == "out" else 0.0)
            add(radius * math.sin(t), -radius * math.cos(t), yaw=yaw)
    elif arrange == "stack":
        for i in range(n):
            add(0, 0, dy=i * (h + 0.01))
    elif arrange == "scatter":
        radius = item.get("radius") or 0.4
        for i in range(n):
            r = radius * math.sqrt((i + 0.5) / n)
            t = i * GOLDEN
            add(r * math.sin(t), r * math.cos(t), yaw=rot + math.radians(47 * i))
    else:
        raise ValueError(f"unknown arrange {arrange!r}")
    return out


def _corners(inst: Instance, shrink: float = 1.0) -> list[tuple[float, float]]:
    hw, hd = inst.w / 2 * shrink, inst.d / 2 * shrink
    c, s = math.cos(inst.yaw), math.sin(inst.yaw)
    pts = []
    for lx, lz in ((-hw, -hd), (hw, -hd), (hw, hd), (-hw, hd)):
        pts.append((inst.x + lx * c + lz * s, inst.z - lx * s + lz * c))
    return pts


def _sat_overlap(a: list[tuple[float, float]], b: list[tuple[float, float]]) -> bool:
    for poly in (a, b):
        for i in range(4):
            x1, z1 = poly[i]
            x2, z2 = poly[(i + 1) % 4]
            nx, nz = z1 - z2, x2 - x1
            pa = [nx * x + nz * z for x, z in a]
            pb = [nx * x + nz * z for x, z in b]
            if max(pa) < min(pb) or max(pb) < min(pa):
                return False
    return True


SEATS = {"chair", "bench", "throne"}


def _seated(person: dict, seat: dict) -> bool:
    """A sitting figure may share space with the seat it sits on."""
    return person.get("prop") == "figure" and person.get("pose") == "sit" and seat.get("prop") in SEATS


def place(items: list[dict]) -> list[Instance]:
    """Expand every item and resolve `on` (stack an item on top of an earlier item)."""
    placed: list[Instance] = []
    tops: dict[int, float] = {}
    for i, item in enumerate(items):
        insts = expand(item, i)
        on = item.get("on")
        if on is not None and on in tops:
            for inst in insts:
                inst.y += tops[on]
        for inst in insts:
            tops[i] = max(tops.get(i, 0.0), inst.y + inst.h)
        placed.extend(insts)
    return placed


def check(items: list[dict]) -> list[str]:
    """Geometric problems with a scene: items off the stage, or items that collide."""
    problems: list[str] = []
    insts = place(items)
    for inst in insts:
        name = items[inst.item]["prop"]
        where = f"item {inst.item} ({name})"
        if math.hypot(inst.x, inst.z) > CENTER_R + 1e-6 or inst.z < Z_BACK - 1e-6:
            problems.append(f"{where} at ({inst.x:.2f}, {inst.z:.2f}) is off the stage "
                            f"(keep x²+z² ≤ {CENTER_R}² and z ≥ {Z_BACK})")
            continue
        far = max(math.hypot(x, z) for x, z in _corners(inst))
        if far > EDGE_R:
            problems.append(f"{where} overhangs the stage edge (reaches {far:.2f} m, limit {EDGE_R}); "
                            "move it inward or scale it down")
    stacked = {(i, items[i]["on"]) for i in range(len(items)) if items[i].get("on") is not None}
    for a_i in range(len(insts)):
        for b_i in range(a_i + 1, len(insts)):
            a, b = insts[a_i], insts[b_i]
            if a.item == b.item and (items[a.item].get("arrange") in ("stack",)):
                continue
            if (a.item, b.item) in stacked or (b.item, a.item) in stacked:
                continue
            if a.y + a.h <= b.y + 0.02 or b.y + b.h <= a.y + 0.02:
                continue
            if _seated(items[a.item], items[b.item]) or _seated(items[b.item], items[a.item]):
                continue
            if _sat_overlap(_corners(a, OVERLAP_SHRINK), _corners(b, OVERLAP_SHRINK)):
                na, nb = items[a.item]["prop"], items[b.item]["prop"]
                same = " (copies of the same item: increase spacing/radius)" if a.item == b.item else ""
                problems.append(f"item {a.item} ({na}) collides with item {b.item} ({nb}) near "
                                f"({(a.x + b.x) / 2:.2f}, {(a.z + b.z) / 2:.2f}){same}")
                if len(problems) > 12:
                    return problems
    return problems
