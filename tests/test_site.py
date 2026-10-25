import math

import pytest

from palace.nav import Nav, bake, reachable, state_of
from palace.world import build_world


@pytest.fixture(scope="module")
def world():
    return build_world()


@pytest.fixture(scope="module")
def walk(world):
    nav = Nav(world["nav"]["surfaces"], world["nav"]["colliders"])
    grid = bake(nav, (-40.0, -125.0, 75.0, 95.0), step=0.25)
    x, y, z = world["spawn"]["pos"]
    return nav, grid, reachable(grid, (x, z, y))


def test_spawn_is_walkable(world, walk):
    nav, _, reach = walk
    x, y, z = world["spawn"]["pos"]
    assert nav.stand(x, z, y) == pytest.approx(y)
    assert reach


def test_every_locus_can_be_reached_and_seen(world, walk):
    nav, grid, reach = walk
    for lid, l in world["loci"].items():
        vx, vy, vz = l["view"]
        assert nav.stand(vx, vz, vy) == pytest.approx(vy, abs=0.05), f"{lid}: no floor at its view spot"
        assert state_of(grid, vx, vz, vy) in reach, f"{lid} ({l['name']['en']}) cannot be reached"
        px, _, pz = l["pos"]
        look = (-math.sin(l["viewYaw"]), -math.cos(l["viewYaw"]))
        d = math.hypot(px - vx, pz - vz)
        assert look[0] * (px - vx) / d + look[1] * (pz - vz) / d > 0.99, lid


def test_every_room_entrance_can_be_reached(world, walk):
    nav, grid, reach = walk
    for b in world["buildings"]:
        for w in b["wings"]:
            for r in w["rooms"]:
                x, y, z = r["anchor"]
                assert nav.stand(x, z, y) == pytest.approx(y, abs=0.05), r["id"]
                assert state_of(grid, x, z, y) in reach, r["id"]


def test_loci_are_numbered_along_the_route(world):
    ns = [world["loci"][lid]["n"] for b in world["buildings"] for w in b["wings"] for r in w["rooms"]
          for lid in r["loci"]]
    assert ns == list(range(1, len(ns) + 1))


def test_texts_are_bilingual(world):
    for l in world["loci"].values():
        assert l["name"]["en"] and l["name"]["zh"] and l["name"]["en"] != l["name"]["zh"]
    for b in world["buildings"]:
        for w in b["wings"]:
            for r in w["rooms"]:
                assert set(r["title"]) == {"en", "zh"} and set(r["about"]) == {"en", "zh"}


def test_layout_is_deterministic(world):
    again = build_world()
    assert again["prims"] == world["prims"]
    assert again["loci"] == world["loci"]
