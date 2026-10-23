import itertools
import math

import pytest

from palace.content import Manifest
from palace.geometry import Frame
from palace.nav import STEP, Nav, bake, reachable, state_of
from palace.scene import LocalScene, Scene
from palace.schema import CrossLinks
from palace.templates import TEMPLATES
from palace.templates.common import PEDESTAL_R, PLOT_HALF, LayoutOverflow, Palette
from palace.world import assign_plots, build_world, plot_bounds
from tests.factory import make_system

SHAPES = [(3, 2, 3), (4, 3, 5), (6, 3, 4), (4, 5, 4), (6, 2, 6), (3, 5, 5), (5, 4, 4)]


@pytest.mark.parametrize("template,shape", list(itertools.product(sorted(TEMPLATES), SHAPES)))
def test_template_stays_inside_its_plot(template, shape):
    system = make_system("t", template, *shape)
    ls = LocalScene(Scene(), Frame(), "t")
    try:
        lay = TEMPLATES[template](system, ls, Palette(system))
    except LayoutOverflow:
        assert template != "city", "the city template must fit anything the schema allows"
        return
    minx, minz, maxx, maxz = ls.extent
    assert -PLOT_HALF - 0.5 <= minx and maxx <= PLOT_HALF + 0.5
    assert -PLOT_HALF - 0.5 <= minz and maxz <= PLOT_HALF + 0.5
    assert set(lay.exhibits) == {e.id for e in system.exhibits()}
    # pedestals never overlap each other
    pts = [p.pos for p in lay.exhibits.values()]
    for a, b in itertools.combinations(pts, 2):
        if abs(a[1] - b[1]) < 2:
            assert math.hypot(a[0] - b[0], a[2] - b[2]) > 2 * PEDESTAL_R + 0.8


def _world(specs):
    systems = {s[0]: make_system(*s) for s in specs}
    manifest = assign_plots(systems, Manifest())
    return systems, manifest, build_world(systems, CrossLinks(), manifest, with_tours=False)


SPECS = [("a", "spiral", 4, 3, 5), ("b", "city", 6, 3, 4), ("c", "terraces", 6, 3, 4),
         ("d", "avenue", 6, 3, 4), ("e", "radial", 6, 3, 4)]


def test_every_exhibit_is_reachable_from_its_entrance():
    _, _, world = _world(SPECS)
    nav = Nav(world["nav"]["surfaces"], world["nav"]["colliders"])
    for so in world["systems"]:
        grid = bake(nav, plot_bounds(so["plot"]))
        ex, ey, ez = so["entrance"]
        reach = reachable(grid, (ex, ez, ey))
        assert reach, f"{so['id']}: entrance not walkable"
        for wing in so["wings"]:
            for room in wing["rooms"]:
                for ref in room["exhibits"]:
                    vx, vy, vz = world["exhibits"][ref]["view"]
                    st = state_of(grid, vx, vz, vy)
                    assert st in reach, f"{ref} ({so['template']}) cannot be reached"


def test_view_spots_stand_on_a_surface_and_face_the_pedestal():
    _, _, world = _world(SPECS)
    nav = Nav(world["nav"]["surfaces"], world["nav"]["colliders"])
    for ref, ex in world["exhibits"].items():
        vx, vy, vz = ex["view"]
        assert nav.stand(vx, vz, vy) == pytest.approx(vy, abs=0.05), ref
        px, _, pz = ex["pos"]
        d = math.hypot(px - vx, pz - vz)
        assert 3.0 < d < 3.8
        yaw = ex["yaw"]
        look = (-math.sin(yaw), -math.cos(yaw))
        assert look[0] * (px - vx) / d + look[1] * (pz - vz) / d > 0.99


def test_tour_visits_every_exhibit_on_walkable_ground():
    specs = [("a", "spiral", 3, 2, 4), ("b", "city", 3, 2, 4), ("c", "terraces", 4, 2, 4),
             ("d", "avenue", 3, 2, 4), ("e", "radial", 3, 2, 4)]
    systems = {s[0]: make_system(*s) for s in specs}
    world = build_world(systems, CrossLinks(), assign_plots(systems, Manifest()))
    nav = Nav(world["nav"]["surfaces"], world["nav"]["colliders"])
    for so in world["systems"]:
        tour = so["tour"]
        assert [s["ref"] for s in tour["stops"]] == [r for w in so["wings"] for rm in w["rooms"] for r in rm["exhibits"]]
        path = tour["path"]
        h = path[0][1]
        for (ax, ay, az), (bx, by, bz) in zip(path, path[1:]):
            n = max(1, int(math.hypot(bx - ax, bz - az) / 0.5))
            for k in range(1, n + 1):
                t = k / n
                nh = nav.stand(ax + (bx - ax) * t, az + (bz - az) * t, h)
                assert nh is not None, f"{so['id']}: tour leaves walkable ground near ({ax}, {az})"
                assert abs(nh - h) <= STEP
                h = nh


def test_layout_is_deterministic_and_plots_are_stable():
    systems, manifest, w1 = _world(SPECS[:3])
    _, _, w2 = _world(SPECS[:3])
    assert w1["prims"] == w2["prims"]
    assert w1["exhibits"] == w2["exhibits"]
    # adding a system keeps everyone's plot
    more = {**systems, "z": make_system("z", "city", 3, 2, 3)}
    m2 = assign_plots(more, manifest)
    for idx, sid in manifest.plots.items():
        assert m2.plots[idx] == sid
