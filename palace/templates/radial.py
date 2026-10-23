"""Radial: a central hub with one long gallery per wing radiating outward.

Each gallery is a chain of halls on a spoke; halls are open at both ends so
the visitor walks straight through them from the hub outward. The spoke that
would point at the plot entrance is left free for the entry path.
"""
from __future__ import annotations

import math

from palace.geometry import polar
from palace.scene import LocalScene
from palace.schema import KnowledgeSystem
from palace.templates.common import (
    PLOT_HALF, STONE, LayoutOverflow, Palette, SystemLayout, hall, hall_length,
)

HUB_R = 13.0
FIRST_R = 17.0
GAP = 2.5
ENTRY_WEDGE = math.radians(32)
MAX_R = PLOT_HALF - 4.0


def layout(system: KnowledgeSystem, ls: LocalScene, palette: Palette) -> SystemLayout:
    out = SystemLayout()
    n = len(system.wings)
    # hub
    ls.cyl(0, 0.1, 0, HUB_R, 0.2, palette.wing_light(0), seg=48)
    ls.disc_floor(0, 0, HUB_R, 0.2)
    ls.cyl(0, 4.0, 0, 1.3, 8.0, STONE, top=0.9, seg=8)
    ls.post(0, 0, 1.4, 0, 8)
    ls.sphere(0, 9.4, 0, 1.4, palette.base)
    ls.strip(0, -PLOT_HALF, 0, -HUB_R, 6.0, "#d6cdbd")

    usable = 2 * math.pi - 2 * ENTRY_WEDGE
    for wi, wing in enumerate(system.wings):
        phi = ENTRY_WEDGE + usable * (wi + 0.5) / n
        lens = [hall_length(len(r.exhibits)) for r in wing.rooms]
        total = sum(lens) + GAP * (len(lens) - 1)
        gap = GAP
        if FIRST_R + total > MAX_R:
            gap = 0.5
            total = sum(lens) + gap * (len(lens) - 1)
            if FIRST_R + total > MAX_R:
                raise LayoutOverflow(f"radial: gallery {wing.id} is too long")
        # walkway along the spoke
        x0, z0 = polar(phi, HUB_R)
        x1, z1 = polar(phi, FIRST_R + total + 1.5)
        ls.strip(x0, z0, x1, z1, 5.0, "#d6cdbd")
        sx, sz = polar(phi, HUB_R + 1.5)
        ls.sign(sx, 7.5, sz, wing.title, sub=wing.summary, level="wing", color=palette.wing(wi))
        out.wings[wing.id] = (sx, 0.0, sz)
        # halls: entrance (local −z) faces the hub
        yaw = math.pi - phi
        r = FIRST_R
        for room, length in zip(wing.rooms, lens):
            cx, cz = polar(phi, r + length / 2)
            hall(ls, room, cx, cz, yaw, palette, wi, out)
            r += length + gap
    return out
