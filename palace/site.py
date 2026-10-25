"""Drawing helpers for hand-planned sites.

A site is drawn in world coordinates (metres; y up). Architecture is laid out
from plain rectangles, the way an architect draws a plan: walls are blocks
between two corners, doorways are gaps with a lintel and a frame, floors and
roofs are slabs. Furnishings are named pieces modelled by the viewer
(web/js/sites/); the plan says where they stand and how much room they take.

A locus is a real thing in a real place — a statue, an altar, a shrine — with
the spot a visitor stands to look at it. Loci are numbered in the order of the
route through the site.
"""
from __future__ import annotations

import math

from palace.geometry import Frame, look_yaw
from palace.scene import LocalScene, Scene, r2, r3


def _t(en: str, zh: str) -> dict:
    return {"en": en, "zh": zh}


class Site:
    def __init__(self, scene: Scene, tag: str, title: dict, subtitle: dict, color: str):
        self.ls = LocalScene(scene, Frame(), tag)
        self.tag = tag
        self.title, self.subtitle, self.color = title, subtitle, color
        self.wings: list[dict] = []
        self.loci: dict[str, dict] = {}
        self.entrance = (0.0, 0.0, 0.0)
        self._n = 0

    # ── structure of the route ──────────────────────────────────────────────
    def wing(self, wid: str, en: str, zh: str, anchor: tuple[float, float, float]) -> None:
        self.wings.append({"id": f"{self.tag}-{wid}", "title": _t(en, zh), "anchor": [r2(v) for v in anchor],
                           "rooms": []})

    def room(self, rid: str, en: str, zh: str, anchor: tuple[float, float, float], yaw: float,
             about: tuple[str, str], light: float = 1.0) -> None:
        """A room: where you stand on arriving (anchor), which way you face (camera yaw), what it was for,
        and how much daylight reaches it (1 open sky … 0 a sealed shrine lit by lamps)."""
        self.wings[-1]["rooms"].append({"id": f"{self.tag}-{rid}", "title": _t(en, zh), "about": _t(*about),
                                        "anchor": [r2(v) for v in anchor], "yaw": r3(yaw), "light": light,
                                        "loci": []})

    def locus(self, en: str, zh: str, pos: tuple[float, float, float], view: tuple[float, float, float]) -> str:
        """A locus at pos (x, y, z) seen from view (x, y, z): y of view is the floor height there."""
        self._n += 1
        lid = f"{self.tag}-{self._n:02d}"
        room = self.wings[-1]["rooms"][-1]
        self.loci[lid] = {
            "n": self._n, "building": self.tag, "room": room["id"], "name": _t(en, zh),
            "pos": [r2(v) for v in pos], "view": [r2(v) for v in view],
            "viewYaw": r3(look_yaw(view[0], view[2], pos[0], pos[2])),
        }
        room["loci"].append(lid)
        return lid

    @staticmethod
    def facing(x: float, z: float, yaw: float, dist: float) -> tuple[float, float]:
        """The point dist in front of something at (x, z) that faces yaw (its local +z)."""
        return x + math.sin(yaw) * dist, z + math.cos(yaw) * dist

    # ── architecture ────────────────────────────────────────────────────────
    def block(self, x0, z0, x1, z1, y0, y1, *, tex="relief", c="#d3b386", bat=0.0, ends=False, cor=False,
              tor=False, collide=True, top=None) -> None:
        """A masonry block between two plan corners from y0 to y1.

        bat: how far the long faces lean in at the top (Egyptian batter); ends: lean the short faces too.
        cor: cavetto cornice and torus roll on top; tor: torus roll down the corners.
        """
        x0, x1 = min(x0, x1), max(x0, x1)
        z0, z1 = min(z0, z1), max(z0, z1)
        cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
        w, d = x1 - x0, z1 - z0
        ls = self.ls
        ls._track(cx, cz, w / 2, d / 2)
        prim = {"t": "ewall", "p": [r2(cx), r2(y0), r2(cz)], "w": r2(w), "d": r2(d), "h": r2(y1 - y0), "c": c,
                "tex": tex}
        if bat:
            prim["bat"] = r2(bat)
        if ends:
            prim["ends"] = 1
        if cor:
            prim["cor"] = 1
        if tor:
            prim["tor"] = 1
        if top:
            prim["top"] = top
        ls._add(prim)
        if collide:
            ls.rect_collider(cx, cz, w, d, y0, y1)

    def wall_x(self, z0, z1, x0, x1, h, doors=(), y0=0.0, **o) -> None:
        """A wall running along x (thickness z0..z1) with doorways [(x centre, width, height)]."""
        cuts = sorted(doors)
        x = x0
        for xc, w, dh in cuts:
            if xc - w / 2 > x:
                self.block(x, z0, xc - w / 2, z1, y0, h, **o)
            lintel = {k: v for k, v in o.items() if k not in ("bat", "ends")}
            self.block(xc - w / 2, z0, xc + w / 2, z1, y0 + dh, h, **lintel)
            self.piece("portal", xc, y0, (z0 + z1) / 2, 0.0, w=w, h=dh, th=z1 - z0, c=o.get("c", "#d3b386"))
            x = xc + w / 2
        if x < x1:
            self.block(x, z0, x1, z1, y0, h, **o)

    def wall_z(self, x0, x1, z0, z1, h, doors=(), y0=0.0, **o) -> None:
        """A wall running along z (thickness x0..x1) with doorways [(z centre, width, height)]."""
        cuts = sorted(doors)
        z = z0
        for zc, w, dh in cuts:
            if zc - w / 2 > z:
                self.block(x0, z, x1, zc - w / 2, y0, h, **o)
            lintel = {k: v for k, v in o.items() if k not in ("bat", "ends")}
            self.block(x0, zc - w / 2, x1, zc + w / 2, y0 + dh, h, **lintel)
            self.piece("portal", (x0 + x1) / 2, y0, zc, math.pi / 2, w=w, h=dh, th=x1 - x0, c=o.get("c", "#d3b386"))
            z = zc + w / 2
        if z < z1:
            self.block(x0, z, x1, z1, y0, h, **o)

    def floor(self, x0, z0, x1, z1, y, pat="paving", cols=("#cdb38c", "#bba07a"), walk=True, thick=None) -> None:
        x0, x1 = min(x0, x1), max(x0, x1)
        z0, z1 = min(z0, z1), max(z0, z1)
        self.ls.floor((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, y, pat, list(cols), walk=walk,
                      thick=thick if thick is not None else max(0.3, y + 0.05))

    def roof(self, x0, z0, x1, z1, y, th=1.0, ceil="stars", c="#d3b386") -> None:
        """A flat stone roof whose underside is at y, painted as a ceiling."""
        x0, x1 = min(x0, x1), max(x0, x1)
        z0, z1 = min(z0, z1), max(z0, z1)
        self.piece("roof", (x0 + x1) / 2, y, (z0 + z1) / 2, 0.0, w=x1 - x0, d=z1 - z0, th=th, ceil=ceil, c=c)

    def column(self, x, z, y, h, r, cap, collide=True, **o) -> None:
        self.piece("column", x, y, z, 0.0, h=h, r=r, cap=cap, **o)
        if collide:
            self.ls.circle_collider(x, z, r * 1.08, y, y + h)

    def beam(self, x0, z0, x1, z1, y, w=1.4, h=1.1) -> None:
        """An architrave from (x0, z0) to (x1, z1) whose underside is at y."""
        cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
        length = math.hypot(x1 - x0, z1 - z0)
        yaw = math.atan2(x1 - x0, z1 - z0)
        self.piece("architrave", cx, y, cz, yaw, len=length, w=w, h=h)

    def piece(self, kind, x, y, z, yaw=0.0, collide=None, **o) -> None:
        """A modelled piece. collide: ("rect", w, d, h) in the piece's own axes, or ("circle", r, h)."""
        ls = self.ls
        ls._track(x, z, 1.0, 1.0)
        prim = {"t": "piece", "k": kind, "p": [r2(x), r2(y), r2(z)]}
        if yaw:
            prim["r"] = r3(yaw)
        clean = {k: (r2(v) if isinstance(v, float) else v) for k, v in o.items() if v is not None}
        if clean:
            prim["o"] = clean
        ls._add(prim)
        if collide:
            if collide[0] == "rect":
                _, w, d, h = collide
                ls.rect_collider(x, z, w, d, y, y + h, yaw)
            else:
                _, rad, h = collide
                ls.circle_collider(x, z, rad, y, y + h)

    def hole(self, x0, z0, x1, z1) -> None:
        """Cut the ground (a lake, a basin, a shaft): nobody can stand there."""
        self.ls.ground_hole(self.ls.rect_shape((x0 + x1) / 2, (z0 + z1) / 2, abs(x1 - x0), abs(z1 - z0)))

    # ── output ──────────────────────────────────────────────────────────────
    def building(self) -> dict:
        return {"id": self.tag, "title": self.title, "subtitle": self.subtitle, "color": self.color,
                "entrance": [r2(v) for v in self.entrance], "wings": self.wings}
