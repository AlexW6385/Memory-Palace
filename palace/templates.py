"""Architecture templates: each lays out one knowledge system inside a plot.

Every template strings the system's rooms (themed through-halls, see
halls.py) along one walking route, so the route order is the learning order.
Templates differ in the shape of that route and what marks a wing:

  spiral    a ramp winding up a tower; stages on both sides of the ramp
  city      a boulevard with one district lane per wing
  terraces  a stepped pyramid, one level per wing
  avenue    one long U-shaped street; a gate marks each wing
  radial    a hub with one spoke per wing

All coordinates are in the plot's local frame: the plot is a square of half
size PLOT_HALF, entered from the street at local (0, −PLOT_HALF).
"""
from __future__ import annotations

import math

from palace.geometry import look_yaw, polar, shade
from palace.halls import STEP, VIEW_DIST, Layout, Placement, hall, hall_length, style_of
from palace.scene import LocalScene
from palace.schema import KnowledgeSystem

PLOT_HALF = 115.0
HALL_SPAN = 12.0          # hall width including walls and a little margin
PATH = "#d8cfbf"
PATH_DARK = "#c8bea9"


class LayoutOverflow(Exception):
    """The template cannot fit this much content inside a plot."""


class Palette:
    def __init__(self, system: KnowledgeSystem):
        self.base = system.color
        self.n = len(system.wings)

    def wing(self, i: int) -> str:
        return shade(self.base, dh=(i - (self.n - 1) / 2) * 0.03, dl=-0.04 + 0.04 * (i % 2))

    def light(self, i: int) -> str:
        return shade(self.wing(i), dl=0.22, ds=-0.12)

    def dark(self, i: int) -> str:
        return shade(self.wing(i), dl=-0.2)


def _wing_marker(ls: LocalScene, x: float, z: float, yaw: float, wing, i: int, pal: Palette, y: float = 0.0) -> None:
    """An obelisk with the wing's banner, standing beside the route."""
    ls.cyl(x, y + 2.6, z, 0.65, 5.2, pal.wing(i), top=0.28, seg=4)
    ls.sphere(x, y + 5.55, z, 0.42, "#e8c25a", mat="metal")
    ls.circle_collider(x, z, 0.8, y, y + 5.5)
    ls.sign(x, y + 7.0, z, wing.title.model_dump(), sub=wing.summary.model_dump(), level="wing",
            color=pal.wing(i))


# ── avenue ───────────────────────────────────────────────────────────────────

def avenue(system: KnowledgeSystem, ls: LocalScene, pal: Palette) -> Layout:
    out = Layout(start=(0.0, 0.0, -PLOT_HALF + 4))
    legs = [((-62.0, -96.0), (-62.0, 98.0)), ((-46.0, 106.0), (46.0, 106.0)), ((62.0, 98.0), (62.0, -96.0))]
    # street
    ls.strip(0, -PLOT_HALF, 0, -103, 7.0, PATH)
    ls.strip(-66, -103, 66, -103, 7.0, PATH)
    for (a, b) in legs:
        ls.strip(a[0], a[1], b[0], b[1], 7.0, PATH)
    ls.strip(-62, 98, -62, 106, 7.0, PATH)
    ls.strip(-66, 106, 66, 106, 7.0, PATH)
    ls.strip(62, 106, 62, 98, 7.0, PATH)
    ls.strip(-62, -103, -62, -96, 7.0, PATH)

    leg, cursor = 0, 0.0

    def take(length: float) -> tuple[float, float, float]:
        nonlocal leg, cursor
        while True:
            (x0, z0), (x1, z1) = legs[leg]
            total = math.hypot(x1 - x0, z1 - z0)
            if cursor + length <= total:
                t = (cursor + length / 2) / total
                cursor += length
                return x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, math.atan2(x1 - x0, z1 - z0)
            leg += 1
            cursor = 0.0
            if leg >= len(legs):
                raise LayoutOverflow("avenue: the street is full")

    for wi, wing in enumerate(system.wings):
        gx, gz, gyaw = take(7.0)
        ls.arch(gx, gz, 0.0, 8.0, 6.0, "classic_column", pal.wing(wi), yaw=gyaw, post=0.45)
        ls.sign(gx, 8.2, gz, wing.title.model_dump(), sub=wing.summary.model_dump(), level="wing",
                color=pal.wing(wi))
        out.wings[wing.id] = (gx, 0.0, gz)
        for room in wing.rooms:
            L = hall_length(len(room.exhibits))
            cx, cz, yaw = take(L + 3.0)
            hall(ls, room, cx, cz, yaw, out, sign_sub=wing.title.model_dump(), accent=pal.wing(wi))
    return out


# ── city ─────────────────────────────────────────────────────────────────────

def city(system: KnowledgeSystem, ls: LocalScene, pal: Palette) -> Layout:
    out = Layout(start=(0.0, 0.0, -PLOT_HALF + 4))
    n = len(system.wings)
    ls.strip(0, -PLOT_HALF, 0, PLOT_HALF - 8, 9.0, PATH)
    per_side = math.ceil(n / 2)
    spacing = min(46.0, 200.0 / per_side)
    for wi, wing in enumerate(system.wings):
        side = -1 if wi % 2 == 0 else 1
        k = wi // 2
        lane_z = -92.0 + k * spacing
        lengths = [hall_length(len(r.exhibits)) for r in wing.rooms]
        lane_len = 9.0 + sum(lengths) + 3.0 * len(lengths)
        if 8.0 + lane_len > PLOT_HALF - 2:
            raise LayoutOverflow(f"city: district {wing.id} is too long")
        ls.strip(side * 4.5, lane_z, side * (8.0 + lane_len), lane_z, 7.0, PATH_DARK)
        mx = side * 8.5
        _wing_marker(ls, mx, lane_z - 5.0, 0.0, wing, wi, pal)
        out.wings[wing.id] = (mx, 0.0, lane_z - 3.0)
        cursor = 8.0 + 7.0
        yaw = math.atan2(side, 0.0)
        for room, L in zip(wing.rooms, lengths):
            cx = side * (cursor + L / 2)
            hall(ls, room, cx, lane_z, yaw, out, sign_sub=wing.title.model_dump(), accent=pal.wing(wi))
            cursor += L + 3.0
        # trees between districts
        for t in range(3):
            tx = side * (14 + t * 22)
            ls.prop("tree", tx, lane_z + spacing / 2, variant="round", scale=2.2)
    for z in range(-100, 100, 16):
        for side in (-1, 1):
            ls.prop("lamp_post", side * 5.6, z, scale=1.6)
    return out


# ── radial ───────────────────────────────────────────────────────────────────

def radial(system: KnowledgeSystem, ls: LocalScene, pal: Palette) -> Layout:
    out = Layout(start=(0.0, 0.0, -PLOT_HALF + 4))
    n = len(system.wings)
    hub_r = 17.0
    ls.disc_floor(0, 0, hub_r, 0.12, "marble", ["#ece6da", "#d8cfbf"])
    ls.cyl(0, 3.6, 0, 1.6, 7.2, "#efe9de", top=1.1, seg=8)
    ls.circle_collider(0, 0, 1.8, 0, 9)
    ls.sphere(0, 8.7, 0, 1.5, pal.base, mat="gloss")
    ls.lamp(0, 8.7, 0, pal.light(0), kind="halo")
    ls.sign(0, 11.6, 0, system.title.model_dump(), sub=system.architecture.metaphor.model_dump(), level="wing",
            color=pal.base)
    ls.strip(0, -PLOT_HALF, 0, -hub_r, 7.0, PATH)
    wedge = math.radians(28)
    usable = 2 * math.pi - 2 * wedge
    first_r = 23.0
    for wi, wing in enumerate(system.wings):
        phi = wedge + usable * (wi + 0.5) / n
        lengths = [hall_length(len(r.exhibits)) for r in wing.rooms]
        total = sum(lengths) + 3.0 * (len(lengths) - 1)
        if first_r + total > PLOT_HALF - 3:
            raise LayoutOverflow(f"radial: gallery {wing.id} is too long")
        x0, z0 = polar(phi, hub_r)
        x1, z1 = polar(phi, first_r + total + 2)
        ls.strip(x0, z0, x1, z1, 6.0, PATH)
        sx, sz = polar(phi, hub_r + 2.0)
        ls.sign(sx, 6.5, sz, wing.title.model_dump(), sub=wing.summary.model_dump(), level="wing", color=pal.wing(wi))
        out.wings[wing.id] = (sx, 0.0, sz)
        yaw = math.pi - phi
        r = first_r
        for room, L in zip(wing.rooms, lengths):
            cx, cz = polar(phi, r + L / 2)
            hall(ls, room, cx, cz, yaw, out, sign_sub=wing.title.model_dump(), accent=pal.wing(wi))
            r += L + 3.0
    return out


# ── terraces ─────────────────────────────────────────────────────────────────

S0 = 108.0
RING = 18.0
RISE = 4.0
RAMP_LEN = 13.0
RAMP_W = 5.0


def _level_y(k: int) -> float:
    return 0.6 + RISE * k


def _ramp_x(k: int) -> float:
    return -10.0 if k % 2 == 0 else 10.0


def terraces(system: KnowledgeSystem, ls: LocalScene, pal: Palette) -> Layout:
    out = Layout(start=(0.0, 0.0, -PLOT_HALF + 4))
    n = len(system.wings)
    sizes = [S0 - RING * k for k in range(n)]
    if sizes[-1] < 16:
        raise LayoutOverflow("terraces: too many levels")
    ls.strip(0, -PLOT_HALF, 0, -S0, 7.0, PATH)
    ls.ground_hole(ls.rect_shape(0, 0, 2 * S0, 2 * S0))
    for k in range(n):
        s, y = sizes[k], _level_y(k)
        ls.box(0, y / 2, 0, 2 * s, y, 2 * s, pal.light(k))
        ls.box(0, y - 0.06, 0, 2 * s + 0.5, 0.12, 2 * s + 0.5, pal.wing(k))
        holes = None
        if k + 1 < n:
            zc = -sizes[k + 1] - RAMP_LEN / 2
            ls.ramp(_ramp_x(k), zc, RAMP_W, RAMP_LEN, y, _level_y(k + 1), "slabs", ["#d6cdbd", "#c9bfae"])
            holes = [ls.rect_shape(0, 0, 2 * sizes[k + 1], 2 * sizes[k + 1]),
                     ls.rect_shape(_ramp_x(k), zc, RAMP_W, RAMP_LEN)]
        surf = {"k": "rect", "c": ls._p(0, 0), "w": 2 * s, "d": 2 * s, "r": ls._yaw(0.0), "y": y}
        if holes:
            surf["holes"] = holes
        ls.scene.surfaces.append(surf)

    for k, wing in enumerate(system.wings):
        s, y = sizes[k], _level_y(k)
        arrive_x = 0.0 if k == 0 else _ramp_x(k - 1)
        ls.sign(arrive_x, y + 6.5, -s + 3.0, wing.title.model_dump(), sub=wing.summary.model_dump(),
                level="wing", color=pal.wing(k))
        out.wings[wing.id] = (arrive_x, y, -s + 4.0)
        lengths = [hall_length(len(r.exhibits)) for r in wing.rooms]
        if k == n - 1:
            # summit: halls side by side, entered from the front
            total_w = len(lengths) * HALL_SPAN + (len(lengths) - 1) * 4.0
            if total_w > 2 * s - 4 or max(lengths) > 2 * s - 8:
                raise LayoutOverflow("terraces: summit too small")
            for j, (room, L) in enumerate(zip(wing.rooms, lengths)):
                cx = -total_w / 2 + HALL_SPAN / 2 + j * (HALL_SPAN + 4.0)
                hall(ls, room, cx, -s + 4.0 + L / 2, 0.0, out, sign_sub=wing.title.model_dump(), y=y + 0.12,
                     accent=pal.wing(k))
            continue
        c = s - RING / 2
        corner = HALL_SPAN / 2 + 1.5
        sides = [((c, -c + corner), (c, c - corner)),          # right side, walking +z
                 ((c - corner, c), (-c + corner, c)),          # back side, walking −x
                 ((-c, c - corner), (-c, -c + corner))]        # left side, walking −z
        side, cursor = 0, 0.0
        for room, L in zip(wing.rooms, lengths):
            while True:
                (x0, z0), (x1, z1) = sides[side]
                total = math.hypot(x1 - x0, z1 - z0)
                if cursor + L <= total:
                    break
                side += 1
                cursor = 0.0
                if side >= len(sides):
                    raise LayoutOverflow(f"terraces: level {wing.id} is full")
            t = (cursor + L / 2) / total
            cx, cz = x0 + (x1 - x0) * t, z0 + (z1 - z0) * t
            hall(ls, room, cx, cz, math.atan2(x1 - x0, z1 - z0), out, sign_sub=wing.title.model_dump(),
                 y=y + 0.12, accent=pal.wing(k))
            cursor += L + 3.0
    return out


# ── spiral ───────────────────────────────────────────────────────────────────

R_IN = 14.0
R_OUT = 25.5
PITCH = 9.0
R_WALK = 19.5             # radius along which exhibits are spaced
R_STAGE_OUT = R_OUT - 1.8
R_STAGE_IN = R_IN + 1.8
TAU = 2 * math.pi


def _h(phi: float) -> float:
    return PITCH * phi / TAU


def spiral(system: KnowledgeSystem, ls: LocalScene, pal: Palette) -> Layout:
    out = Layout(start=(0.0, 0.0, -PLOT_HALF + 4))
    d = STEP / R_WALK
    phi = math.radians(12)
    events: list[tuple[str, float, object]] = []
    room_ranges: list[tuple[float, float, str]] = []
    for wi, wing in enumerate(system.wings):
        phi += d * 0.6
        events.append(("wing", phi, (wi, wing)))
        phi += d * 1.4
        for room in wing.rooms:
            start = phi
            events.append(("room", phi, (wi, room)))
            phi += d * 1.6
            for i, e in enumerate(room.exhibits):
                events.append(("exhibit", phi, (wi, room, i, e)))
                phi += d
            phi += d * 0.8
            room_ranges.append((start, phi, room.style))
    end = phi + d * 2.0
    top = _h(end)

    segs = []
    prev = 0.0
    for s0, s1, style in room_ranges:
        if s0 > prev + 1e-6:
            segs.append((prev, s0, "slabs", ["#d9d2c3", "#cbc3b3"]))
        st = style_of(style)
        segs.append((s0, s1, st["floor"]["pattern"], st["floor"]["colors"]))
        prev = s1
    segs.append((prev, end, "slabs", ["#d9d2c3", "#cbc3b3"]))
    ls.helix(0, 0, R_IN, R_OUT, 0.0, PITCH, segs, "#e2dbcd")
    # core tower and summit
    ls.cyl(0, top / 2, 0, R_IN - 0.05, top, "#ece6da", seg=48)
    ls.circle_collider(0, 0, R_IN - 0.1, -1, top - 0.05)
    ls.disc_floor(0, 0, R_IN + 0.4, top, "marble", ["#ece6da", "#d8cfbf"])
    ls.ground_hole(ls.disc_shape(0, 0, R_OUT))
    ls.strip(0, -PLOT_HALF, 0, -R_OUT - 0.5, 7.0, PATH)
    ls.cyl(0, top + 3.0, 0, 0.6, 6.0, "#efe9de", top=0.35, seg=8)
    ls.circle_collider(0, 0, 0.8, top, top + 6)
    ls.sphere(0, top + 7.0, 0, 1.4, pal.base, mat="gloss")
    ls.lamp(0, top + 7.0, 0, pal.light(0), kind="halo")
    ls.sign(0, top + 10.0, 0, system.title.model_dump(), sub=system.subtitle.model_dump(), level="wing",
            color=pal.base)
    # outer supports every 25 degrees
    a = math.radians(25)
    while a < end - 0.15:
        x, z = polar(a, R_OUT - 0.3)
        y_lo = max(0.0, _h(a) - PITCH)
        if _h(a) - y_lo > 1.0:
            ls.support(x, z, y_lo, _h(a) - y_lo, "round_column", "#e8e1d4", radius=0.28)
        a += math.radians(25)

    for kind, phi, payload in events:
        y = _h(phi)
        if kind == "wing":
            wi, wing = payload
            mx, mz = polar(phi, (R_IN + R_OUT) / 2)
            ls.arch(mx, mz, y, R_OUT - R_IN - 1.0, 6.0, "classic_column", pal.wing(wi), yaw=math.pi / 2 - phi,
                    post=0.45, collide=False)
            ls.sign(mx, y + 7.6, mz, wing.title.model_dump(), sub=wing.summary.model_dump(), level="wing",
                    color=pal.wing(wi))
            out.wings[wing.id] = (mx, y, mz)
        elif kind == "room":
            wi, room = payload
            st = style_of(room.style)
            mx, mz = polar(phi, (R_IN + R_OUT) / 2)
            tangent = math.pi / 2 - phi        # yaw pointing along the walking direction
            sup = st["support"]
            stype = sup["type"] if sup["type"] != "none" else "stone_post"
            ls.arch(mx, mz, y, R_OUT - R_IN - 1.6, 4.4, stype, sup["color"], yaw=tangent, post=0.32, collide=False)
            ls.sign(mx, y + 4.0, mz, room.title.model_dump(), sub=None, level="room", color=pal.wing(wi),
                    yaw=tangent + math.pi, w=5.0)
            out.rooms[room.id] = (mx, y, mz)
        else:
            wi, room, i, e = payload
            outer = i % 2 == 0
            r = R_STAGE_OUT if outer else R_STAGE_IN
            sx, sz = polar(phi, r)
            # stage faces the walkway: outer stages face the centre, inner ones face outward
            face = math.atan2(-sx, -sz) if outer else math.atan2(sx, sz)
            vr = r - VIEW_DIST if outer else r + VIEW_DIST
            vx, vz = polar(phi, vr)
            ls.stage(e.id, sx, sz, y, face)
            out.exhibits[e.id] = Placement((sx, y, sz), face, (vx, y, vz), look_yaw(vx, vz, sx, sz))
            # decor between consecutive outer stages
            if outer and i + 2 < len(room.exhibits):
                gaps = [d for d in style_of(room.style)["decor"] if d["where"] == "gap"]
                if gaps:
                    dphi = phi + d
                    dx, dz = polar(dphi, R_OUT - 0.7)
                    dd = gaps[i // 2 % len(gaps)]
                    params = {k: v for k, v in dd.items() if k not in ("prop", "where", "scale")}
                    ls.prop(dd["prop"], dx, dz, y=_h(dphi), yaw=math.atan2(-dx, -dz), scale=dd.get("scale", 1.0),
                            **params)
    return out


TEMPLATES = {"spiral": spiral, "city": city, "terraces": terraces, "avenue": avenue, "radial": radial}
