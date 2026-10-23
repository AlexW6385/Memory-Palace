"""City: a main avenue with districts on both sides.

Each wing is a district: a lane running away from the avenue with one hall
per room on either side of it. Districts alternate left/right, nearest first.
"""
from __future__ import annotations

import math

from palace.scene import LocalScene
from palace.schema import KnowledgeSystem
from palace.templates.common import (
    HALL_W, PLOT_HALF, LayoutOverflow, Palette, SystemLayout, hall, hall_length,
)

AVENUE_W = 10.0
LANE_W = 6.0
LANE_START = AVENUE_W / 2 + 3.0
HALL_PITCH = HALL_W + 3.0
DISTRICT_GAP = 6.0


def layout(system: KnowledgeSystem, ls: LocalScene, palette: Palette) -> SystemLayout:
    out = SystemLayout()
    avenue_c = "#d9d2c3"
    ls.strip(0, -PLOT_HALF, 0, PLOT_HALF - 6, AVENUE_W, avenue_c)

    cursor = {-1: -PLOT_HALF + 12.0, 1: -PLOT_HALF + 12.0}  # next free z per side
    for wi, wing in enumerate(system.wings):
        side = -1 if wi % 2 == 0 else 1
        lens = [hall_length(len(r.exhibits)) for r in wing.rooms]
        depth_a = max([lens[k] for k in range(0, len(lens), 2)], default=0.0)
        depth_b = max([lens[k] for k in range(1, len(lens), 2)], default=0.0)
        lane_z = cursor[side] + depth_a + LANE_W / 2
        z_top = lane_z + LANE_W / 2 + depth_b
        if z_top > PLOT_HALF - 4:
            raise LayoutOverflow(f"city: wing {wing.id} does not fit")
        cursor[side] = z_top + DISTRICT_GAP
        cols = math.ceil(len(wing.rooms) / 2)
        lane_len = cols * HALL_PITCH + 4.0
        if LANE_START + lane_len > PLOT_HALF - 2:
            raise LayoutOverflow(f"city: wing {wing.id} is too wide")

        # district ground tile, lane and sign
        tile_x0, tile_x1 = LANE_START - 2, LANE_START + lane_len
        tile_z0, tile_z1 = lane_z - LANE_W / 2 - depth_a - 1.5, lane_z + LANE_W / 2 + depth_b + 1.5
        ls.box(side * (tile_x0 + tile_x1) / 2, 0.01, (tile_z0 + tile_z1) / 2,
               tile_x1 - tile_x0, 0.02, tile_z1 - tile_z0, palette.wing_light(wi))
        ls.strip(side * (AVENUE_W / 2), lane_z, side * (LANE_START + lane_len), lane_z, LANE_W, "#cfc6b4", y=0.03)
        obelisk_x = side * (AVENUE_W / 2 + 1.5)
        ls.cyl(obelisk_x, 3.0, lane_z - LANE_W / 2 - 1.0, 0.6, 6.0, palette.wing(wi), top=0.25, seg=4)
        ls.post(obelisk_x, lane_z - LANE_W / 2 - 1.0, 0.7, 0, 6)
        ls.sign(side * (AVENUE_W / 2 + 2.5), 8.0, lane_z, wing.title, sub=wing.summary,
                level="wing", color=palette.wing(wi))
        out.wings[wing.id] = (side * (AVENUE_W / 2 + 2.5), 0.0, lane_z)

        for k, room in enumerate(wing.rooms):
            col, across = divmod(k, 2)
            length = lens[k]
            hx = side * (LANE_START + HALL_W / 2 + col * HALL_PITCH)
            if across == 0:   # below the lane, entrance faces +z
                hz, yaw = lane_z - LANE_W / 2 - length / 2, math.pi
            else:             # above the lane, entrance faces −z
                hz, yaw = lane_z + LANE_W / 2 + length / 2, 0.0
            hall(ls, room, hx, hz, yaw, palette, wi, out)
    return out
