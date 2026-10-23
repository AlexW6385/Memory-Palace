"""Building blocks shared by the architecture templates."""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from palace.geometry import Frame, look_yaw, mix, shade, vivid
from palace.scene import LocalScene
from palace.schema import Exhibit, KnowledgeSystem, Room

PLOT_HALF = 100.0         # a plot is a 200 m square in its local frame
ENTRANCE = (0.0, -PLOT_HALF)  # local point where the plot meets the street
EXHIBIT_SPACING = 4.0
PEDESTAL_H = 1.0
PEDESTAL_R = 0.45
VIEW_DIST = 3.4           # where the visitor stands, measured from the pedestal

STONE = "#e9e4da"
DARK_STONE = "#8f877b"


class LayoutOverflow(Exception):
    """The template cannot fit this much content inside a plot."""


@dataclass
class Placement:
    pos: tuple[float, float, float]   # pedestal base, local frame (x, y, z)
    view: tuple[float, float, float]  # where the visitor stands, local frame
    color: str


@dataclass
class SystemLayout:
    """What a template returns, in the plot's local frame."""

    exhibits: dict[str, Placement] = field(default_factory=dict)
    rooms: dict[str, tuple[float, float, float]] = field(default_factory=dict)   # room id -> anchor
    wings: dict[str, tuple[float, float, float]] = field(default_factory=dict)   # wing id -> anchor
    start: tuple[float, float, float] = (0.0, 0.0, -PLOT_HALF + 2.0)            # tour start (x, y, z)


class Palette:
    """Colors derived from the system's base color."""

    def __init__(self, system: KnowledgeSystem):
        self.base = system.color
        self.n_wings = len(system.wings)
        self._order = {e.id: i for i, e in enumerate(system.exhibits())}

    def wing(self, i: int) -> str:
        spread = 0.025
        return shade(self.base, dh=(i - (self.n_wings - 1) / 2) * spread, dl=-0.04 + 0.03 * (i % 2))

    def wing_light(self, i: int) -> str:
        return mix(self.wing(i), "#ffffff", 0.55)

    def wing_dark(self, i: int) -> str:
        return shade(self.wing(i), dl=-0.18)

    def exhibit(self, exhibit_id: str) -> str:
        return vivid(self._order[exhibit_id], self.base)


def stand(ls: LocalScene, x: float, z: float, y: float) -> None:
    """Pedestal for one exhibit; the viewer adds the symbol and label on top."""
    ls.cyl(x, y + PEDESTAL_H / 2, z, PEDESTAL_R, PEDESTAL_H, STONE, top=PEDESTAL_R * 0.86, seg=16)
    ls.post(x, z, PEDESTAL_R + 0.05, y, y + 2.2)


def arch(ls: LocalScene, x: float, z: float, y: float, width: float, height: float, yaw: float,
         color: str, post_r: float = 0.35) -> None:
    """Two pillars and a lintel spanning `width`, centered at (x, z), facing along yaw."""
    c, s = math.cos(yaw), math.sin(yaw)
    for side in (-1, 1):
        px, pz = x + side * width / 2 * c, z - side * width / 2 * s
        ls.cyl(px, y + height / 2, pz, post_r, height, color, seg=10)
        ls.post(px, pz, post_r, y, y + height)
    ls.box(x, y + height + 0.3, z, width + post_r * 2 + 0.4, 0.6, post_r * 2 + 0.2, color, yaw=yaw)


def hall_length(n: int) -> float:
    rows = math.ceil(n / 2)
    return rows * EXHIBIT_SPACING + 4.0


HALL_W = 8.4


def hall(ls: LocalScene, room: Room, cx: float, cz: float, yaw: float, palette: Palette,
         wing_index: int, out: SystemLayout) -> float:
    """Open pavilion with exhibits in two rows along a central aisle.

    The hall's local −z side (rotated by yaw) is the entrance. Returns its length.
    """
    n = len(room.exhibits)
    length = hall_length(n)
    hf = Frame(cx, cz, yaw)
    floor_y = 0.2
    wing_c, light, dark = palette.wing(wing_index), palette.wing_light(wing_index), palette.wing_dark(wing_index)

    def P(x: float, z: float) -> tuple[float, float]:
        return hf.point(x, z)

    fx, fz = P(0, 0)
    ls.box(fx, floor_y / 2, fz, HALL_W, floor_y, length, light, yaw=yaw)
    ls.floor(fx, fz, HALL_W, length, floor_y, yaw=yaw)
    # columns along both long sides
    n_cols = max(2, round(length / EXHIBIT_SPACING) + 1)
    for side in (-1, 1):
        for k in range(n_cols):
            z = -length / 2 + 0.3 + k * (length - 0.6) / (n_cols - 1)
            px, pz = P(side * (HALL_W / 2 - 0.3), z)
            ls.cyl(px, floor_y + 2.2, pz, 0.22, 4.4, STONE, seg=10)
            ls.post(px, pz, 0.24, floor_y, floor_y + 4.4)
    # roof
    ls.box(fx, floor_y + 4.55, fz, HALL_W + 0.8, 0.3, length + 0.8, dark, yaw=yaw)
    ls.roof(fx, floor_y + 4.7, fz, HALL_W + 0.8, 1.8, length + 0.8, wing_c, yaw=yaw)
    # entrance sign
    sx, sz = P(0, -length / 2 - 0.4)
    ls.sign(sx, floor_y + 3.6, sz, room.title, level="room", color=wing_c)
    out.rooms[room.id] = (sx, floor_y, sz)

    # exhibits: two rows facing the aisle, walked front to back, left then right
    for i, e in enumerate(room.exhibits):
        row, side = divmod(i, 2)
        sgn = -1 if side == 0 else 1
        z = -length / 2 + 3.0 + row * EXHIBIT_SPACING
        px, pz = P(sgn * 2.7, z)
        vx, vz = P(sgn * (2.7 - VIEW_DIST), z)
        stand(ls, px, pz, floor_y)
        out.exhibits[e.id] = Placement((px, floor_y, pz), (vx, floor_y, vz), palette.exhibit(e.id))
    return length


def gate_sign(ls: LocalScene, x: float, z: float, y: float, text: str, sub: str, color: str, level: str) -> None:
    ls.sign(x, y, z, text, sub=sub, level=level, color=color)


def view_yaw(p: Placement) -> float:
    return look_yaw(p.view[0], p.view[2], p.pos[0], p.pos[2])
