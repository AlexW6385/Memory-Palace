"""Themed through-halls: the building block of every architecture template.

A hall is entered at its local −z end and left at its +z end. Loci stand
in alcoves along both walls, alternating left and right every STEP metres, so
walking the aisle visits them in order. The room style decides the floor,
supports, walls, roof, lighting and decor.

    −z (entrance)                                   +z (exit)
    ┌──────────────────────────────────────────────────────┐
    │  ◖1        ◖3        ◖5                              │  left wall (x = −WALL_X)
    │      aisle ·····························→            │
    │        2◗        4◗                                   │  right wall (x = +WALL_X)
    └──────────────────────────────────────────────────────┘
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from palace.catalog import PROPS, ROOM_STYLES
from palace.geometry import Frame, look_yaw, mix
from palace.scene import LocalScene

HALL_W = 11.0           # inner width
WALL_X = 5.65           # wall centre line
WALL_T = 0.3
WALL_H = 4.2
STAGE_X = 3.55          # stage centre, from the hall axis
STEP = 2.5              # distance along the hall between consecutive loci
END = 3.4               # from a hall end to the first / last stage centre
VIEW_DIST = 4.3         # from a stage centre to where the visitor stands
FLOOR_Y = 0.15
EYE = 1.65


def hall_length(n: int) -> float:
    return 2 * END + (n - 1) * STEP


@dataclass
class Placement:
    """Where a locus stands and where it is viewed from (plot-local frame)."""

    pos: tuple[float, float, float]
    yaw: float              # direction the stage faces (towards the visitor)
    view: tuple[float, float, float]
    view_yaw: float


@dataclass
class Layout:
    loci: dict[str, Placement] = field(default_factory=dict)
    rooms: dict[str, tuple[float, float, float]] = field(default_factory=dict)  # entrance point
    wings: dict[str, tuple[float, float, float]] = field(default_factory=dict)
    start: tuple[float, float, float] = (0.0, 0.0, 0.0)


def style_of(name: str) -> dict:
    return ROOM_STYLES[name]


def _decor_cycle(style: dict, where: str) -> list[dict]:
    return [d for d in style["decor"] if d["where"] == where]


def _place_decor(ls: LocalScene, f: Frame, d: dict, x: float, z: float, y: float, yaw: float,
                 scale: float = 1.0) -> None:
    wx, wz = f.point(x, z)
    params = {k: v for k, v in d.items() if k not in ("prop", "where", "scale")}
    s = d.get("scale", 1.0) * scale
    ls.prop(d["prop"], wx, wz, y=y, yaw=f.angle(yaw), scale=s, **params)


def hall(ls: LocalScene, room, cx: float, cz: float, yaw: float, out: Layout, sign_sub=None,
         y: float = FLOOR_Y, accent: str | None = None) -> float:
    """Build one themed hall centred at (cx, cz) whose entrance faces local −z rotated by yaw.

    Returns the hall length. Locus placements are written to out.loci.
    """
    st = style_of(room.style)
    loci = room.locus_list()
    n = len(loci)
    L = hall_length(n)
    f = Frame(cx, cz, yaw)
    P = f.point
    tint = getattr(ls, "tint", None)
    floor_cols = [mix(c, tint, 0.12) for c in st["floor"]["colors"]] if tint else st["floor"]["colors"]

    # floor (slightly larger than the walls)
    fx, fz = P(0, 0)
    ls.floor(fx, fz, 2 * WALL_X + WALL_T, L, y, st["floor"]["pattern"], floor_cols, yaw=f.yaw, thick=y + 0.05)

    # walls and supports along both sides
    wall = st["wall"]
    sup = st["support"]
    for side in (-1, 1):
        if wall["type"] != "none":
            h = 1.2 if wall["type"] == "low_stone" else WALL_H
            wx, wz = P(side * WALL_X, 0)
            wc = mix(wall["color"], tint, 0.1) if tint else wall["color"]
            ls.wall(wx, wz, y, WALL_T, h, L, wall["type"], wc, wall.get("color2"), yaw=f.yaw)
        if sup["type"] != "none":
            zs = [-L / 2 + 0.35, L / 2 - 0.35]
            # supports between same-side alcoves
            first = 0 if side < 0 else 1
            for i in range(first, n - 2, 2):
                zs.append(-L / 2 + END + (i + 1) * STEP)
            for z in zs:
                sx, sz = P(side * WALL_X, z)
                ls.support(sx, sz, y, WALL_H, sup["type"], sup["color"], radius=0.3)

    # roof
    roof = st["roof"]
    if roof["type"] != "none":
        rx, rz = P(0, 0)
        ls.roof(rx, rz, y + WALL_H, 2 * WALL_X + 0.9, L + 0.6, roof["type"], roof["color"], roof.get("color2"),
                yaw=f.yaw)

    # entrance and exit frames, the room sign over the entrance
    for end in (-1, 1):
        ax, az = P(0, end * L / 2)
        ls.arch(ax, az, y, 2 * WALL_X, WALL_H, sup["type"] if sup["type"] != "none" else "stone_post",
                sup["color"] if sup["type"] != "none" else "#cfc8b8", yaw=f.yaw, post=0.3, collide=False)
    sx, sz = P(0, -L / 2 - 0.05)
    ls.sign(sx, y + WALL_H - 0.55, sz, room.title.model_dump(), sub=sign_sub, level="room",
            color=accent or wall.get("color") or "#888888", yaw=f.angle(math.pi), w=6.0)

    # loci, alternating left (−x) and right (+x)
    for i, e in enumerate(loci):
        side = -1 if i % 2 == 0 else 1
        z = -L / 2 + END + i * STEP
        sx, sz = P(side * STAGE_X, z)
        face = f.angle(math.atan2(-side, 0.0))           # towards the aisle
        vx, vz = P(side * (STAGE_X - VIEW_DIST), z)
        ls.locus(e.id, sx, sz, y, face)
        out.loci[e.id] = Placement((sx, y, sz), face, (vx, y, vz), look_yaw(vx, vz, sx, sz))

    # decor: between alcoves against the walls, in the corners, hanging, outside
    gaps = _decor_cycle(st, "gap")
    ends = _decor_cycle(st, "end")
    ceil = _decor_cycle(st, "ceiling")
    outside = _decor_cycle(st, "outside")
    k = 0
    if gaps:
        for side in (-1, 1):
            first = 0 if side < 0 else 1
            for i in range(first, n - 2, 2):
                z = -L / 2 + END + (i + 1) * STEP
                d = gaps[k % len(gaps)]
                k += 1
                dw, dh, dd = PROPS[d["prop"]]["size"]
                s = d.get("scale", 1.0)
                x = side * (WALL_X - WALL_T / 2 - 0.08 - dd * s / 2)
                _place_decor(ls, f, d, x, z, y, math.atan2(-side, 0.0))
    if ends:
        corners = [(-1, -1), (1, -1), (-1, 1), (1, 1)]
        for j, (sx_, sz_) in enumerate(corners):
            d = ends[j % len(ends)]
            dw, dh, dd = PROPS[d["prop"]]["size"]
            s = min(d.get("scale", 1.0), 1.3 / max(dw, dd))
            x = sx_ * (WALL_X - 0.95)
            z = sz_ * (L / 2 - 1.05)
            _place_decor(ls, f, {**d, "scale": s}, x, z, y, math.atan2(-sx_, -sz_) if dw > 0.8 else math.atan2(-sx_, 0))
    if ceil:
        for j, z in enumerate(_ceiling_zs(L)):
            d = ceil[j % len(ceil)]
            _place_decor(ls, f, d, 0.0, z, y + WALL_H - 1.15, 0.0)
    else:
        for z in _ceiling_zs(L):
            lx, lz = P(0, z)
            ls.lamp(lx, y + WALL_H - 0.6, lz, st["light"])
    if outside:
        for j, side in enumerate((-1, 1)):
            d = outside[j % len(outside)]
            dw, dh, dd = PROPS[d["prop"]]["size"]
            s = min(d.get("scale", 1.0), 1.6 / max(dw, dd))
            _place_decor(ls, f, {**d, "scale": s}, side * (WALL_X + 1.6), -L / 2 - 1.4, 0.0, 0.0)

    ex, ez = P(0, -L / 2 - 1.0)
    out.rooms[room.id] = (ex, y, ez)
    return L


def _ceiling_zs(L: float) -> list[float]:
    n = max(1, int(L // 5))
    return [-L / 2 + L * (i + 0.5) / n for i in range(n)]
