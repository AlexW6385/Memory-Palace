"""Terraces: a stepped pyramid, one level per wing, climbed by ramps.

Wing 0 is the broad ground terrace; each next wing sits one level higher on a
smaller terrace. Exhibits line the edges of each terrace; a ramp on the front
side leads up to the next level, alternating left and right.
"""
from __future__ import annotations

from palace.scene import LocalScene
from palace.schema import KnowledgeSystem
from palace.templates.common import (
    EXHIBIT_SPACING, PLOT_HALF, VIEW_DIST, LayoutOverflow, Palette, Placement, SystemLayout, stand,
)

S0 = PLOT_HALF - 8.0   # half size of the ground terrace
RING = 14.0            # depth of each terrace step
RISE = 4.0             # height of each step
RAMP_LEN = 12.0
RAMP_W = 4.0
EDGE = 1.6             # pedestal distance from a terrace edge
CORNER_CLEAR = 2.5
RAMP_CLEAR = 5.0


def level_y(k: int) -> float:
    return 0.5 + RISE * k


def ramp_x(k: int) -> float:
    return -8.0 if k % 2 == 0 else 8.0


def _loop(a: float, inward: bool, start_x: float) -> list[tuple[float, float, float, float]]:
    """Slots along a square loop of half size a, starting on the front side at x = start_x.

    Returns (x, z, nx, nz) with (nx, nz) the unit direction from the pedestal
    toward where the visitor stands.
    """
    sides = [  # (start corner, direction, inward normal) walking counter-clockwise from the front
        ((-a, -a), (1, 0), (0, 1)),
        ((a, -a), (0, 1), (-1, 0)),
        ((a, a), (-1, 0), (0, -1)),
        ((-a, a), (0, -1), (1, 0)),
    ]
    raw = []
    for (sx, sz), (dx, dz), (nx, nz) in sides:
        t = CORNER_CLEAR
        while t <= 2 * a - CORNER_CLEAR + 1e-6:
            sgn = 1 if inward else -1
            raw.append((sx + dx * t, sz + dz * t, nx * sgn, nz * sgn))
            t += EXHIBIT_SPACING
    # rotate so that the loop starts at the first front slot with x >= start_x
    first = next((i for i, s in enumerate(raw[: len(raw) // 4 + 1]) if s[0] >= start_x), 0)
    return raw[first:] + raw[:first]


def layout(system: KnowledgeSystem, ls: LocalScene, palette: Palette) -> SystemLayout:
    out = SystemLayout()
    n = len(system.wings)
    sizes = [S0 - RING * k for k in range(n)]
    if sizes[-1] < 12:
        raise LayoutOverflow("terraces: too many levels")

    ls.strip(0, -PLOT_HALF, 0, -S0, 6.0, "#d6cdbd")
    ls.ground_hole(ls.rect_shape(0, 0, 2 * S0, 2 * S0))
    for k in range(n):
        s, y = sizes[k], level_y(k)
        ls.box(0, y / 2, 0, 2 * s, y, 2 * s, palette.wing_light(k))
        ls.box(0, y - 0.05, 0, 2 * s + 0.4, 0.1, 2 * s + 0.4, palette.wing(k))
        holes = None
        if k + 1 < n:
            # the next terrace and the ramp up to it are cut out of this floor
            zc = -sizes[k + 1] - RAMP_LEN / 2
            ls.ramp(ramp_x(k), zc, RAMP_W, RAMP_LEN, y, level_y(k + 1), palette.wing(k + 1))
            holes = [ls.rect_shape(0, 0, 2 * sizes[k + 1], 2 * sizes[k + 1]),
                     ls.rect_shape(ramp_x(k), zc, RAMP_W, RAMP_LEN)]
        ls.floor(0, 0, 2 * s, 2 * s, y, holes=holes)

    for k, wing in enumerate(system.wings):
        s, y = sizes[k], level_y(k)
        arrive_x = 0.0 if k == 0 else ramp_x(k - 1)
        excl = [arrive_x]
        if k + 1 < n:
            excl.append(ramp_x(k))
        loops = [(s - EDGE, True)]
        if k + 1 < n:
            loops.append((sizes[k + 1] + EDGE, False))
        else:
            a = s - EDGE - 6.0
            while a > 6.0:
                loops.append((a, True))
                a -= 6.0
        slots = []
        for a, inward in loops:
            for x, z, nx, nz in _loop(a, inward, arrive_x + RAMP_CLEAR):
                front = abs(z + a) < 0.01
                if front and any(abs(x - ex) < RAMP_CLEAR for ex in excl):
                    continue
                slots.append((x, z, nx, nz))

        ls.sign(arrive_x, y + 6.5, -s + 3.0, wing.title, sub=wing.summary, level="wing", color=palette.wing(k))
        out.wings[wing.id] = (arrive_x, y, -s + 3.0)

        i = 0
        for room in wing.rooms:
            need = 1 + len(room.exhibits)
            if i + need > len(slots):
                raise LayoutOverflow(f"terraces: level {wing.id} is full")
            x, z, nx, nz = slots[i]
            ls.sign(x, y + 3.6, z, room.title, level="room", color=palette.wing(k))
            out.rooms[room.id] = (x, y, z)
            i += 1
            for e in room.exhibits:
                x, z, nx, nz = slots[i]
                stand(ls, x, z, y)
                view = (x + nx * VIEW_DIST, y, z + nz * VIEW_DIST)
                out.exhibits[e.id] = Placement((x, y, z), view, palette.exhibit(e.id))
                i += 1
    return out
