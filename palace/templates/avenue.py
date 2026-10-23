"""Avenue: one long street walked from start to finish.

The street runs up the left half of the plot and back down the right half
(a U shape). Halls stand on both sides of it in order; a gate across the
street marks the start of each wing.
"""
from __future__ import annotations

import math

from palace.scene import LocalScene
from palace.schema import KnowledgeSystem
from palace.templates.common import (
    HALL_W, PLOT_HALF, LayoutOverflow, Palette, SystemLayout, arch, hall, hall_length,
)

STREET_W = 6.0
LEG_X = 45.0
Z_START = -PLOT_HALF + 12.0
Z_END = PLOT_HALF - 12.0
SLOT = HALL_W + 3.0
GATE_GAP = 5.0


def layout(system: KnowledgeSystem, ls: LocalScene, palette: Palette) -> SystemLayout:
    out = SystemLayout()
    street_c = "#d6cdbd"
    # street: entrance → left leg up → across the top → right leg down
    ls.strip(0, -PLOT_HALF, 0, Z_START - 4, STREET_W, street_c)
    ls.strip(-LEG_X - STREET_W / 2, Z_START - 4, LEG_X + STREET_W / 2, Z_START - 4, STREET_W, street_c)
    ls.strip(-LEG_X, Z_START - 4, -LEG_X, Z_END + 4, STREET_W, street_c)
    ls.strip(-LEG_X - STREET_W / 2, Z_END + 4, LEG_X + STREET_W / 2, Z_END + 4, STREET_W, street_c)
    ls.strip(LEG_X, Z_END + 4, LEG_X, Z_START - 4, STREET_W, street_c)

    legs = [(-LEG_X, 1.0), (LEG_X, -1.0)]  # (x, walking direction along z)
    leg = 0
    z = Z_START

    def advance(need: float) -> float:
        """Reserve `need` metres along the current leg, switching legs if full."""
        nonlocal leg, z
        lx, dirz = legs[leg]
        end = z + dirz * need
        if (dirz > 0 and end > Z_END) or (dirz < 0 and end < Z_START):
            leg += 1
            if leg >= len(legs):
                raise LayoutOverflow("avenue: street is full")
            lx, dirz = legs[leg]
            z = Z_END
            end = z + dirz * need
        start = z
        z = end
        return start

    for wi, wing in enumerate(system.wings):
        gz = advance(GATE_GAP)
        lx, dirz = legs[leg]
        gate_z = gz + dirz * GATE_GAP / 2
        arch(ls, lx, gate_z, 0.0, STREET_W + 1.0, 5.0, 0.0, palette.wing(wi))
        ls.sign(lx, 7.6, gate_z, wing.title, sub=wing.summary, level="wing", color=palette.wing(wi))
        out.wings[wing.id] = (lx, 0.0, gate_z)

        rooms = list(wing.rooms)
        for k in range(0, len(rooms), 2):
            pair = rooms[k:k + 2]
            start = advance(SLOT)
            lx, dirz = legs[leg]
            cz = start + dirz * SLOT / 2
            for side_i, room in enumerate(pair):
                side = -1 if side_i == 0 else 1          # west, east of the street
                length = hall_length(len(room.exhibits))
                hx = lx + side * (STREET_W / 2 + 1.0 + length / 2)
                if abs(hx) + length / 2 > PLOT_HALF - 2:
                    raise LayoutOverflow("avenue: hall sticks out of the plot")
                # entrance faces the street: west halls face +x, east halls face −x
                yaw = -math.pi / 2 if side < 0 else math.pi / 2
                hall(ls, room, hx, cz, yaw, palette, wi, out)
    return out
