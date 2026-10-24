"""Scene description emitted for the viewer (world.json "prims" and "nav").

Python decides where everything is (so walkability and collisions are known
here); the viewer decides how each element looks. Element types:

  floor    walkable slab with a pattern            support  column/post of a style
  wall     wall segment of a style                 roof     roof of a style
  arch     entrance frame                          sign     text panel (fixed or billboard)
  prop     a catalogue prop (decor)                stage    an exhibit stage (built lazily by the viewer)
  box/cyl/sphere  plain shapes                     water    a water surface
  ramp/helix      sloped walkways                  lamp     a hanging lamp / light halo

Templates draw in a plot's local frame through LocalScene, which converts to
world coordinates and records the local extent for tests.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from palace.catalog import PROPS
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
        self.tag = tag
        self.extent = [math.inf, math.inf, -math.inf, -math.inf]

    # ── bookkeeping ─────────────────────────────────────────────────────────
    def _track(self, x: float, z: float, rx: float = 0.0, rz: float = 0.0, yaw: float = 0.0) -> None:
        c, s = abs(math.cos(yaw)), abs(math.sin(yaw))
        ex, ez = rx * c + rz * s, rx * s + rz * c
        e = self.extent
        e[0], e[1] = min(e[0], x - ex), min(e[1], z - ez)
        e[2], e[3] = max(e[2], x + ex), max(e[3], z + ez)

    def _p(self, x: float, z: float) -> list[float]:
        wx, wz = self.frame.point(x, z)
        return [r2(wx), r2(wz)]

    def _yaw(self, yaw: float) -> float:
        return r3(self.frame.angle(yaw))

    def _add(self, prim: dict) -> dict:
        prim["g"] = self.tag
        self.scene.prims.append(prim)
        return prim

    # ── plain shapes ────────────────────────────────────────────────────────
    def box(self, x, y, z, w, h, d, color, yaw=0.0, mat="matte", round_=0.0) -> None:
        self._track(x, z, w / 2, d / 2, yaw)
        wx, wz = self._p(x, z)
        prim = {"t": "box", "p": [wx, r2(y), wz], "s": [r2(w), r2(h), r2(d)], "r": self._yaw(yaw), "c": color}
        if mat != "matte":
            prim["m"] = mat
        if round_:
            prim["rd"] = r2(round_)
        self._add(prim)

    def cyl(self, x, y, z, radius, h, color, top=None, seg=16, mat="matte") -> None:
        rt = radius if top is None else top
        self._track(x, z, max(radius, rt), max(radius, rt))
        wx, wz = self._p(x, z)
        prim = {"t": "cyl", "p": [wx, r2(y), wz], "rt": r2(rt), "rb": r2(radius), "h": r2(h), "n": seg, "c": color}
        if mat != "matte":
            prim["m"] = mat
        self._add(prim)

    def sphere(self, x, y, z, radius, color, mat="matte") -> None:
        self._track(x, z, radius, radius)
        wx, wz = self._p(x, z)
        prim = {"t": "sphere", "p": [wx, r2(y), wz], "rad": r2(radius), "c": color}
        if mat != "matte":
            prim["m"] = mat
        self._add(prim)

    def strip(self, x0, z0, x1, z1, width, color, y=0.02, pat=None) -> None:
        """Flat paved path between two points (visual only; the ground is walkable anyway)."""
        length = math.hypot(x1 - x0, z1 - z0)
        yaw = math.atan2(x1 - x0, z1 - z0)
        cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
        self._track(cx, cz, width / 2, length / 2, yaw)
        wx, wz = self._p(cx, cz)
        self._add({"t": "path", "p": [wx, r2(y), wz], "w": r2(width), "d": r2(length), "r": self._yaw(yaw),
                   "c": color, "pat": pat or "slabs"})

    # ── architecture ────────────────────────────────────────────────────────
    def floor(self, x, z, w, d, y, pattern, colors, yaw=0.0, thick=0.3, holes=None, walk=True) -> None:
        self._track(x, z, w / 2, d / 2, yaw)
        wx, wz = self._p(x, z)
        self._add({"t": "floor", "p": [wx, r2(y), wz], "w": r2(w), "d": r2(d), "r": self._yaw(yaw), "th": thick,
                   "pat": pattern, "cols": colors})
        if walk:
            surf = {"k": "rect", "c": [wx, wz], "w": r2(w), "d": r2(d), "r": self._yaw(yaw), "y": r2(y)}
            if holes:
                surf["holes"] = holes
            self.scene.surfaces.append(surf)

    def disc_floor(self, x, z, r_out, y, pattern, colors, r_in=0.0, walk=True, thick=0.3) -> None:
        self._track(x, z, r_out, r_out)
        wx, wz = self._p(x, z)
        self._add({"t": "disc", "p": [wx, r2(y), wz], "r0": r2(r_in), "r1": r2(r_out), "th": thick, "pat": pattern,
                   "cols": colors})
        if walk:
            self.scene.surfaces.append({"k": "disc", "c": [wx, wz], "r0": r2(r_in), "r1": r2(r_out), "y": r2(y)})

    def support(self, x, z, y, h, style, color, radius=0.32, collide=True) -> None:
        self._track(x, z, radius, radius)
        wx, wz = self._p(x, z)
        self._add({"t": "support", "p": [wx, r2(y), wz], "h": r2(h), "rad": r2(radius), "st": style, "c": color})
        if collide:
            self.circle_collider(x, z, radius + 0.04, y, y + h)

    def wall(self, x, z, y, w, h, d, style, color, color2=None, yaw=0.0, collide=True) -> None:
        self._track(x, z, w / 2, d / 2, yaw)
        wx, wz = self._p(x, z)
        prim = {"t": "wall", "p": [wx, r2(y), wz], "s": [r2(w), r2(h), r2(d)], "r": self._yaw(yaw), "st": style,
                "c": color}
        if color2:
            prim["c2"] = color2
        self._add(prim)
        if collide:
            self.rect_collider(x, z, w, d, y, y + h, yaw)

    def roof(self, x, z, y, w, d, style, color, color2=None, yaw=0.0) -> None:
        self._track(x, z, w / 2, d / 2, yaw)
        wx, wz = self._p(x, z)
        prim = {"t": "roof", "p": [wx, r2(y), wz], "w": r2(w), "d": r2(d), "r": self._yaw(yaw), "st": style,
                "c": color}
        if color2:
            prim["c2"] = color2
        self._add(prim)

    def arch(self, x, z, y, w, h, style, color, yaw=0.0, post=0.32, collide=True) -> None:
        """An entrance frame spanning w (posts at ±w/2), facing along yaw."""
        self._track(x, z, w / 2 + post, post, yaw)
        wx, wz = self._p(x, z)
        self._add({"t": "arch", "p": [wx, r2(y), wz], "w": r2(w), "h": r2(h), "r": self._yaw(yaw), "st": style,
                   "c": color, "post": r2(post)})
        if collide:
            c, s = math.cos(yaw), math.sin(yaw)
            for side in (-1, 1):
                self.circle_collider(x + side * w / 2 * c, z - side * w / 2 * s, post + 0.05, y, y + h)

    def sign(self, x, y, z, text, sub=None, level="room", color="#ffffff", yaw=None, w=None) -> None:
        """Text panel. With yaw it is mounted facing that direction (double-sided); without, a billboard."""
        self._track(x, z)
        wx, wz = self._p(x, z)
        prim = {"t": "sign", "p": [wx, r2(y), wz], "text": text, "lv": level, "c": color}
        if sub:
            prim["sub"] = sub
        if yaw is not None:
            prim["r"] = self._yaw(yaw)
        if w:
            prim["w"] = r2(w)
        self._add(prim)

    def prop(self, name, x, z, y=0.0, yaw=0.0, scale=1.0, collide=True, **params) -> None:
        """A catalogue prop used as decor. params: variant, color, color2, count, arrange, ..."""
        w, h, d = PROPS[name]["size"]
        self._track(x, z, w * scale / 2, d * scale / 2, yaw)
        wx, wz = self._p(x, z)
        prim = {"t": "prop", "name": name, "p": [wx, r2(y), wz], "r": self._yaw(yaw)}
        if scale != 1.0:
            prim["s"] = r2(scale)
        clean = {k: v for k, v in params.items() if v is not None}
        if clean:
            prim["o"] = clean
        self._add(prim)
        if collide and not PROPS[name]["floats"]:
            n = int(params.get("count") or 1)
            reach = max(w, d) * scale / 2 * (0.8 if n == 1 else 1.0)
            if n > 1:
                spacing = params.get("spacing") or max(w, d) * scale + 0.05
                reach = max(reach, spacing * (n - 1) / 2 + reach)
            self.circle_collider(x, z, reach, y, y + h * scale)

    def stage(self, ref, x, z, y, yaw) -> None:
        self._track(x, z, 1.6, 1.6)
        wx, wz = self._p(x, z)
        self._add({"t": "stage", "ref": ref, "p": [wx, r2(y), wz], "r": self._yaw(yaw)})
        self.circle_collider(x, z, 1.62, y, y + 3.0)

    def lamp(self, x, y, z, color, kind="pendant") -> None:
        self._track(x, z)
        wx, wz = self._p(x, z)
        self._add({"t": "lamp", "p": [wx, r2(y), wz], "c": color, "k": kind})

    def water(self, x, z, w, d, y=0.05, yaw=0.0, color="#4f9cc0") -> None:
        self._track(x, z, w / 2, d / 2, yaw)
        wx, wz = self._p(x, z)
        self._add({"t": "water", "p": [wx, r2(y), wz], "w": r2(w), "d": r2(d), "r": self._yaw(yaw), "c": color})

    def ramp(self, x, z, w, length, y0, y1, pattern, colors, yaw=0.0, thick=0.5) -> None:
        """Sloped slab rising from y0 at local −z/2 to y1 at +z/2, plus its walkable surface."""
        self._track(x, z, w / 2, length / 2, yaw)
        wx, wz = self._p(x, z)
        r = self._yaw(yaw)
        self._add({"t": "ramp", "p": [wx, wz], "w": r2(w), "d": r2(length), "y0": r2(y0), "y1": r2(y1), "r": r,
                   "th": thick, "pat": pattern, "cols": colors})
        self.scene.surfaces.append({"k": "ramp", "c": [wx, wz], "w": r2(w), "d": r2(length), "r": r,
                                    "y0": r2(y0), "y1": r2(y1)})

    def helix(self, cx, cz, r_in, r_out, y0, pitch, segments, rail) -> None:
        """Ramp spiralling up around (cx, cz). segments: [(phi0, phi1, pattern, colors)] in local angles."""
        self._track(cx, cz, r_out, r_out)
        wx, wz = self._p(cx, cz)
        a0 = segments[0][0]
        sweep = segments[-1][1] - a0
        segs = [{"a0": r3(self.frame.polar_angle(s0)), "a1": r3(self.frame.polar_angle(s0) + (s1 - s0)),
                 "pat": pat, "cols": cols} for s0, s1, pat, cols in segments]
        spec = {"c": [wx, wz], "r0": r2(r_in), "r1": r2(r_out), "y0": r2(y0), "pitch": r2(pitch),
                "a0": r3(self.frame.polar_angle(a0)), "sweep": r3(sweep)}
        self._add({"t": "helix", **spec, "th": 0.6, "segs": segs, "rail": rail})
        self.scene.surfaces.append({"k": "helix", **spec})

    # ── shapes for surfaces / holes ─────────────────────────────────────────
    def rect_shape(self, x, z, w, d, yaw=0.0) -> dict:
        wx, wz = self._p(x, z)
        return {"k": "rect", "c": [wx, wz], "w": r2(w), "d": r2(d), "r": self._yaw(yaw)}

    def disc_shape(self, x, z, r) -> dict:
        wx, wz = self._p(x, z)
        return {"k": "disc", "c": [wx, wz], "r0": 0.0, "r1": r2(r)}

    def ground_hole(self, shape: dict) -> None:
        self.scene.ground_holes.append(shape)

    def walk_rect(self, x, z, w, d, y, yaw=0.0) -> None:
        wx, wz = self._p(x, z)
        self.scene.surfaces.append({"k": "rect", "c": [wx, wz], "w": r2(w), "d": r2(d), "r": self._yaw(yaw),
                                    "y": r2(y)})

    # ── colliders ───────────────────────────────────────────────────────────
    def circle_collider(self, x, z, radius, y0, y1) -> None:
        wx, wz = self._p(x, z)
        self.scene.colliders.append({"k": "circle", "c": [wx, wz], "r": r2(radius), "y0": r2(y0), "y1": r2(y1)})

    def rect_collider(self, x, z, w, d, y0, y1, yaw=0.0) -> None:
        wx, wz = self._p(x, z)
        self.scene.colliders.append({"k": "rect", "c": [wx, wz], "w": r2(w), "d": r2(d), "r": self._yaw(yaw),
                                     "y0": r2(y0), "y1": r2(y1)})
