"""2D frames on the ground plane (x, z) plus color helpers.

Yaw follows three.js `rotation.y`: a local vector (x, z) maps to
(x·cos + z·sin, −x·sin + z·cos). A camera with yaw θ looks along
(−sin θ, −cos θ).

Polar positions used by round templates: angle φ, radius r →
(r·sin φ, −r·cos φ), so φ = 0 points along −z (toward a plot's entrance) and
rotating a frame by yaw ψ turns a local angle φ into the world angle φ − ψ.
"""
from __future__ import annotations

import colorsys
import math
from dataclasses import dataclass


@dataclass(frozen=True)
class Frame:
    ox: float = 0.0
    oz: float = 0.0
    yaw: float = 0.0

    def point(self, x: float, z: float) -> tuple[float, float]:
        c, s = math.cos(self.yaw), math.sin(self.yaw)
        return (self.ox + x * c + z * s, self.oz - x * s + z * c)

    def inverse_point(self, wx: float, wz: float) -> tuple[float, float]:
        dx, dz = wx - self.ox, wz - self.oz
        c, s = math.cos(self.yaw), math.sin(self.yaw)
        return (dx * c - dz * s, dx * s + dz * c)

    def angle(self, local_yaw: float) -> float:
        return local_yaw + self.yaw

    def polar_angle(self, local_phi: float) -> float:
        return local_phi - self.yaw

    def child(self, x: float, z: float, yaw: float = 0.0) -> "Frame":
        wx, wz = self.point(x, z)
        return Frame(wx, wz, self.yaw + yaw)


def polar(phi: float, r: float) -> tuple[float, float]:
    return (r * math.sin(phi), -r * math.cos(phi))


def look_yaw(fx: float, fz: float, tx: float, tz: float) -> float:
    """Camera yaw that looks from (fx, fz) toward (tx, tz)."""
    return math.atan2(-(tx - fx), -(tz - fz))


def yaw_facing(dx: float, dz: float) -> float:
    """Yaw that turns an object's local −z axis to point along (dx, dz)."""
    return math.atan2(-dx, -dz)


# ── colors ───────────────────────────────────────────────────────────────────

def hex_to_hls(color: str) -> tuple[float, float, float]:
    r, g, b = (int(color[i : i + 2], 16) / 255 for i in (1, 3, 5))
    return colorsys.rgb_to_hls(r, g, b)


def hls_to_hex(h: float, l: float, s: float) -> str:
    r, g, b = colorsys.hls_to_rgb(h % 1.0, min(max(l, 0), 1), min(max(s, 0), 1))
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))


def shade(color: str, dl: float = 0.0, ds: float = 0.0, dh: float = 0.0) -> str:
    h, l, s = hex_to_hls(color)
    return hls_to_hex(h + dh, l + dl, s + ds)


def mix(a: str, b: str, t: float) -> str:
    ca = [int(a[i : i + 2], 16) for i in (1, 3, 5)]
    cb = [int(b[i : i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join("%02x" % round(x + (y - x) * t) for x, y in zip(ca, cb))


def vivid(index: int, base: str) -> str:
    """A distinct, saturated color for the index-th exhibit of a system."""
    h0, _, _ = hex_to_hls(base)
    return hls_to_hex(h0 + index * 0.6180339887, 0.56, 0.68)
