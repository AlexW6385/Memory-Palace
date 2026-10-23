"""Spiral tower: one ramp winding up around a solid core.

Exhibits line the outer edge of the ramp in order; an arch across the ramp
opens each room and a taller arch each wing. The ramp ends level with the
top of the core, which forms the summit terrace.
"""
from __future__ import annotations

import math

from palace.geometry import polar
from palace.scene import LocalScene
from palace.schema import KnowledgeSystem
from palace.templates.common import (
    EXHIBIT_SPACING, STONE, VIEW_DIST, Palette, Placement, SystemLayout, arch, stand,
)

R_IN = 13.0
R_OUT = 22.0
PITCH = 9.0
R_PED = R_OUT - 1.6
R_VIEW = R_PED - VIEW_DIST
START = math.radians(14)  # first slot, measured from the entrance side (φ = 0)
TAU = 2 * math.pi


def height(phi: float) -> float:
    return PITCH * phi / TAU


def layout(system: KnowledgeSystem, ls: LocalScene, palette: Palette) -> SystemLayout:
    out = SystemLayout()
    d = EXHIBIT_SPACING / R_PED  # angle between neighbouring exhibits

    # walk the slots: [wing gate] [room arch] exhibits ... [room arch] exhibits ...
    phi = START
    events: list[tuple[str, float, object]] = []
    for wi, wing in enumerate(system.wings):
        phi += d * 0.8
        events.append(("wing", phi, (wi, wing)))
        phi += d * 1.2
        for room in wing.rooms:
            events.append(("room", phi, (wi, room)))
            phi += d * 0.9
            for e in room.exhibits:
                events.append(("exhibit", phi, (wi, e)))
                phi += d
            phi += d * 0.3
    end = phi + d * 1.5
    top = height(end)

    # structure
    ls.helix(0, 0, R_IN, R_OUT, 0.0, PITCH, 0.0, end, palette.wing_light(0), "#d9d2c3")
    ls.cyl(0, top / 2, 0, R_IN - 0.05, top, STONE, seg=40)
    ls.cyl(0, top - 0.14, 0, R_IN + 0.3, 0.3, palette.wing_dark(len(system.wings) - 1), seg=40)
    ls.disc_floor(0, 0, R_IN, top)
    ls.ground_hole(ls.disc_shape(0, 0, R_OUT))
    ls.strip(0, -100, 0, -R_OUT - 0.5, 6.0, "#d6cdbd")
    # outer supports every 30°
    a = math.radians(30)
    while a < end - 0.2:
        x, z = polar(a, R_OUT - 0.35)
        y_lo = max(0.0, height(a) - PITCH)
        if height(a) - y_lo > 1.0:
            ls.cyl(x, (y_lo + height(a)) / 2, z, 0.25, height(a) - y_lo, STONE, seg=8)
            ls.post(x, z, 0.28, y_lo, height(a))
        a += math.radians(30)
    # summit beacon
    ls.cyl(0, top + 3.0, 0, 0.5, 6.0, STONE, top=0.3, seg=8)
    ls.post(0, 0, 0.6, top, top + 6)
    ls.sphere(0, top + 7.2, 0, 1.5, palette.base)
    ls.sign(0, top + 10.5, 0, system.title, sub="顶点", level="wing", color=palette.base)

    for kind, phi, payload in events:
        y = height(phi)
        if kind == "wing":
            wi, wing = payload
            mx, mz = polar(phi, (R_IN + R_OUT) / 2)
            arch(ls, mx, mz, y, R_OUT - R_IN - 1.2, 5.0, math.pi / 2 - phi, palette.wing(wi), post_r=0.45)
            ls.sign(mx, y + 7.2, mz, wing.title, sub=wing.summary, level="wing", color=palette.wing(wi))
            out.wings[wing.id] = (mx, y, mz)
        elif kind == "room":
            wi, room = payload
            mx, mz = polar(phi, (R_IN + R_OUT) / 2)
            arch(ls, mx, mz, y, R_OUT - R_IN - 1.6, 3.8, math.pi / 2 - phi, palette.wing_dark(wi), post_r=0.3)
            ls.sign(mx, y + 5.4, mz, room.title, level="room", color=palette.wing(wi))
            out.rooms[room.id] = (mx, y, mz)
        else:
            wi, e = payload
            px, pz = polar(phi, R_PED)
            vx, vz = polar(phi, R_VIEW)
            stand(ls, px, pz, y)
            out.exhibits[e.id] = Placement((px, y, pz), (vx, y, vz), palette.exhibit(e.id))
    return out
