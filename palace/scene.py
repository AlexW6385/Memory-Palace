"""Scene description emitted for the viewer.

Three lists, all in world coordinates:
- prims:      things to draw (boxes, cylinders, roofs, ramps, helix ramps, signs)
- surfaces:   where the visitor can stand (flat rects/discs, ramps, helices)
- colliders:  solid things that block walking (columns, pedestals)

Templates draw in a plot's local frame through `LocalScene`, which converts to
world coordinates and records the local extent so tests can check that every
template stays inside its plot.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from palace.geometry import Frame


def r2(v: float) -> float:
    return round(v, 2)


def r3(v: float) -> float:
    return round(v, 3)


@dataclass
class Scene:
    prims: list[dict] = field(default_factory=list)
    surfaces: list[dict] = field(default_factory=list)
    colliders: list[dict] = field(default_factory=list)
    ground_holes: list[dict] = field(default_factory=list)


class LocalScene:
    def __init__(self, scene: Scene, frame: Frame, tag: str):
        self.scene = scene
        self.frame = frame
        self.tag = tag  # plot / system id, lets the viewer group meshes
        self.extent = [math.inf, math.inf, -math.inf, -math.inf]  # minx, minz, maxx, maxz

    # ── bookkeeping ─────────────────────────────────────────────────────────
    def _track(self, x: float, z: float, rx: float = 0.0, rz: float = 0.0, yaw: float = 0.0) -> None:
        # conservative bounding box of a (rx, rz) half-extent rotated by yaw
        c, s = abs(math.cos(yaw)), abs(math.sin(yaw))
        ex, ez = rx * c + rz * s, rx * s + rz * c
        e = self.extent
        e[0], e[1] = min(e[0], x - ex), min(e[1], z - ez)
        e[2], e[3] = max(e[2], x + ex), max(e[3], z + ez)

    def _p(self, x: float, z: float) -> list[float]:
        wx, wz = self.frame.point(x, z)
        return [r2(wx), r2(wz)]

    # ── drawing ─────────────────────────────────────────────────────────────
    def box(self, x, y, z, w, h, d, color, yaw=0.0, **extra) -> None:
        self._track(x, z, w / 2, d / 2, yaw)
        wx, wz = self._p(x, z)
        self.scene.prims.append({"t": "box", "p": [wx, r2(y), wz], "s": [r2(w), r2(h), r2(d)],
                                 "r": r3(self.frame.angle(yaw)), "c": color, "g": self.tag, **extra})

    def cyl(self, x, y, z, radius, h, color, top=None, seg=12, **extra) -> None:
        """Cylinder (or cone when top=0) whose center is at height y."""
        rt = radius if top is None else top
        self._track(x, z, max(radius, rt), max(radius, rt))
        wx, wz = self._p(x, z)
        self.scene.prims.append({"t": "cyl", "p": [wx, r2(y), wz], "rt": r2(rt), "rb": r2(radius),
                                 "h": r2(h), "n": seg, "c": color, "g": self.tag, **extra})

    def sphere(self, x, y, z, radius, color, **extra) -> None:
        self._track(x, z, radius, radius)
        wx, wz = self._p(x, z)
        self.scene.prims.append({"t": "sphere", "p": [wx, r2(y), wz], "rad": r2(radius), "c": color,
                                 "g": self.tag, **extra})

    def roof(self, x, y, z, w, h, d, color, yaw=0.0) -> None:
        """Hip roof (square pyramid) with base w×d whose base sits at height y."""
        self._track(x, z, w / 2, d / 2, yaw)
        wx, wz = self._p(x, z)
        self.scene.prims.append({"t": "roof", "p": [wx, r2(y), wz], "s": [r2(w), r2(h), r2(d)],
                                 "r": r3(self.frame.angle(yaw)), "c": color, "g": self.tag})

    def ramp(self, x, z, w, length, y0, y1, color, yaw=0.0, thick=0.5) -> None:
        """Sloped slab rising from y0 at local −z/2 to y1 at +z/2, plus its walkable surface."""
        self._track(x, z, w / 2, length / 2, yaw)
        wx, wz = self._p(x, z)
        r = r3(self.frame.angle(yaw))
        self.scene.prims.append({"t": "ramp", "p": [wx, wz], "w": r2(w), "d": r2(length), "y0": r2(y0),
                                 "y1": r2(y1), "r": r, "th": thick, "c": color, "g": self.tag})
        self.scene.surfaces.append({"k": "ramp", "c": [wx, wz], "w": r2(w), "d": r2(length), "r": r,
                                    "y0": r2(y0), "y1": r2(y1)})

    def helix(self, cx, cz, r_in, r_out, y0, pitch, phi0, sweep, color, rail_color) -> None:
        """Ramp spiralling upward around (cx, cz); height rises `pitch` per full turn."""
        self._track(cx, cz, r_out, r_out)
        wx, wz = self._p(cx, cz)
        spec = {"c": [wx, wz], "r0": r2(r_in), "r1": r2(r_out), "y0": r2(y0), "pitch": r2(pitch),
                "a0": r3(self.frame.polar_angle(phi0)), "sweep": r3(sweep)}
        self.scene.prims.append({"t": "helix", **spec, "th": 0.6, "col": color, "rail": rail_color,
                                 "g": self.tag})
        self.scene.surfaces.append({"k": "helix", **spec})

    def sign(self, x, y, z, text, sub="", level="room", color="#ffffff") -> None:
        """Billboard text. level: region | wing | room (controls size and draw distance)."""
        self._track(x, z)
        wx, wz = self._p(x, z)
        self.scene.prims.append({"t": "sign", "p": [wx, r2(y), wz], "text": text, "sub": sub,
                                 "lv": level, "c": color, "g": self.tag})

    def strip(self, x0, z0, x1, z1, width, color, y=0.02) -> None:
        """Flat painted path between two points (purely visual)."""
        length = math.hypot(x1 - x0, z1 - z0)
        yaw = math.atan2(-(x1 - x0), -(z1 - z0))
        self.box((x0 + x1) / 2, y, (z0 + z1) / 2, width, 0.04, length, color, yaw=yaw)

    # ── walkable surfaces ───────────────────────────────────────────────────
    def floor(self, x, z, w, d, y, yaw=0.0, holes: list[dict] | None = None) -> None:
        self._track(x, z, w / 2, d / 2, yaw)
        wx, wz = self._p(x, z)
        surf = {"k": "rect", "c": [wx, wz], "w": r2(w), "d": r2(d), "r": r3(self.frame.angle(yaw)), "y": r2(y)}
        if holes:
            surf["holes"] = holes
        self.scene.surfaces.append(surf)

    def disc_floor(self, x, z, r_out, y, r_in=0.0) -> None:
        self._track(x, z, r_out, r_out)
        wx, wz = self._p(x, z)
        self.scene.surfaces.append({"k": "disc", "c": [wx, wz], "r0": r2(r_in), "r1": r2(r_out), "y": r2(y)})

    def rect_shape(self, x, z, w, d, yaw=0.0) -> dict:
        wx, wz = self._p(x, z)
        return {"k": "rect", "c": [wx, wz], "w": r2(w), "d": r2(d), "r": r3(self.frame.angle(yaw))}

    def disc_shape(self, x, z, r) -> dict:
        wx, wz = self._p(x, z)
        return {"k": "disc", "c": [wx, wz], "r0": 0.0, "r1": r2(r)}

    def ground_hole(self, shape: dict) -> None:
        self.scene.ground_holes.append(shape)

    # ── colliders ───────────────────────────────────────────────────────────
    def post(self, x, z, radius, y0, y1) -> None:
        wx, wz = self._p(x, z)
        self.scene.colliders.append({"k": "circle", "c": [wx, wz], "r": r2(radius), "y0": r2(y0), "y1": r2(y1)})
