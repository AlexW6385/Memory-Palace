"""Assemble the world from its sites and write world.json.

Each site is planned by hand in palace/sites/: a real kind of building, laid out
the way it was actually used, with its loci at the things that stood in it. For
now there is one site, a temple of Horus after Edfu; more will stand around it.
"""
from __future__ import annotations

import json
import math
import time
from pathlib import Path

from palace.nav import RADIUS, STEP
from palace.scene import Scene
from palace.sites import edfu

EYE = 1.65
HALF = 220.0          # the walkable ground is a square of side 2·HALF


def build_world() -> dict:
    scene = Scene()
    site = edfu.build(scene)
    building = site.building()
    building["plot"] = 0
    ground = {"k": "rect", "c": [0.0, 0.0], "w": 2 * HALF, "d": 2 * HALF, "r": 0.0, "y": 0.0,
              "holes": scene.ground_holes}
    ex, ey, ez = site.entrance
    return {
        "version": 4,
        "title": {"en": "Memory Palace", "zh": "记忆宫殿"},
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "spawn": {"pos": [ex, ey, ez], "yaw": math.pi},
        "eye": EYE,
        "cell": 120.0,
        "half": HALF,
        "setting": "desert",
        "plots": [{"index": 0, "center": [0.0, -15.0], "yaw": 0.0, "half": 125.0, "building": site.tag}],
        "buildings": [building],
        "loci": site.loci,
        "nav": {"step": STEP, "radius": RADIUS, "surfaces": [ground] + scene.surfaces, "colliders": scene.colliders},
        "prims": scene.prims,
    }


def build_world_file(out_path: Path) -> Path:
    world = build_world()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(world, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return out_path
