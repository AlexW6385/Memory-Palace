import itertools
import math

import pytest

from palace.catalog import ROOM_STYLES
from palace.geometry import Frame
from palace.halls import VIEW_DIST
from palace.nav import Nav, bake, reachable, state_of
from palace.scene import LocalScene, Scene
from palace.templates import PLOT_HALF, TEMPLATES, LayoutOverflow, Palette
from palace.world import build_world, plot_bounds
from tests.factory import make_building, make_city

# (wings, rooms per wing, loci per room)
SHAPES = [(2, 2, 6), (3, 3, 6), (4, 3, 6), (5, 2, 6), (4, 4, 5), (6, 2, 6), (8, 2, 4)]
STAGE_CLEAR = 3.2   # two plinth colliders (r = 1.62) must not overlap


@pytest.mark.parametrize("template,shape", list(itertools.product(sorted(TEMPLATES), SHAPES)))
def test_template_stays_inside_its_plot(template, shape):
    b = make_building("t", template, *shape)
    ls = LocalScene(Scene(), Frame(), "t")
    try:
        lay = TEMPLATES[template](b, ls, Palette(b))
    except LayoutOverflow:
        assert template != "city", "the city template must fit anything the schema allows"
        return
    minx, minz, maxx, maxz = ls.extent
    assert -PLOT_HALF - 0.5 <= minx and maxx <= PLOT_HALF + 0.5
    assert -PLOT_HALF - 0.5 <= minz and maxz <= PLOT_HALF + 0.5
    assert set(lay.loci) == {l.id for r in b.rooms() for l in r.locus_list()}
    pts = [p.pos for p in lay.loci.values()]
    for p, q in itertools.combinations(pts, 2):
        if abs(p[1] - q[1]) < 2.5:
            assert math.hypot(p[0] - q[0], p[2] - q[2]) >= STAGE_CLEAR, (p, q)


def test_every_room_style_builds():
    styles = sorted(ROOM_STYLES)
    b = make_building("s", "city", 7, 4, 3, styles=styles)
    ls = LocalScene(Scene(), Frame(), "s")
    lay = TEMPLATES["city"](b, ls, Palette(b))
    assert len(lay.loci) == 7 * 4 * 3
    assert {"floor", "locus", "sign", "arch"} <= {p["t"] for p in ls.scene.prims}


SPECS = [("a", "radial", 5, 2, 6), ("b", "spiral", 3, 3, 6), ("c", "terraces", 4, 2, 6),
         ("d", "avenue", 4, 2, 6), ("e", "city", 4, 2, 6)]


@pytest.fixture(scope="module")
def world():
    return build_world(make_city(SPECS))


def test_every_locus_is_reachable_from_its_entrance(world):
    nav = Nav(world["nav"]["surfaces"], world["nav"]["colliders"])
    for b in world["buildings"]:
        grid = bake(nav, plot_bounds(b["plot"]))
        ex, ey, ez = b["entrance"]
        reach = reachable(grid, (ex, ez, ey))
        assert reach, f"{b['id']}: entrance not walkable"
        for wing in b["wings"]:
            for room in wing["rooms"]:
                for lid in room["loci"]:
                    vx, vy, vz = world["loci"][lid]["view"]
                    assert state_of(grid, vx, vz, vy) in reach, f"{lid} ({b['template']}) cannot be reached"


def test_view_spots_stand_on_a_surface_and_face_the_locus(world):
    nav = Nav(world["nav"]["surfaces"], world["nav"]["colliders"])
    for lid, l in world["loci"].items():
        vx, vy, vz = l["view"]
        assert nav.stand(vx, vz, vy) == pytest.approx(vy, abs=0.05), lid
        px, _, pz = l["pos"]
        d = math.hypot(px - vx, pz - vz)
        assert VIEW_DIST - 0.3 < d < VIEW_DIST + 0.3, lid
        look = (-math.sin(l["viewYaw"]), -math.cos(l["viewYaw"]))
        assert look[0] * (px - vx) / d + look[1] * (pz - vz) / d > 0.99, lid
        front = (math.sin(l["yaw"]), math.cos(l["yaw"]))
        assert front[0] * (vx - px) / d + front[1] * (vz - pz) / d > 0.95, lid


def test_spawn_is_walkable(world):
    nav = Nav(world["nav"]["surfaces"], world["nav"]["colliders"])
    x, y, z = world["spawn"]["pos"]
    assert nav.stand(x, z, y) is not None


def test_layout_is_deterministic(world):
    again = build_world(make_city(SPECS))
    assert again["prims"] == world["prims"]
    assert again["loci"] == world["loci"]


def test_world_json_is_bilingual(world):
    assert world["title"] == {"en": "Test city", "zh": "测试城市"}
    signs = [p for p in world["prims"] if p["t"] == "sign"]
    assert signs and all(set(s["text"]) == {"en", "zh"} for s in signs)
    room = world["buildings"][0]["wings"][0]["rooms"][0]
    assert set(room["title"]) == {"en", "zh"}
