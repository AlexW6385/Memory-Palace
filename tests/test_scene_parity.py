"""The viewer (web/js/scene.js) must place scene items exactly where palace/scenes.py checked them."""
import json
import random
import shutil
import subprocess
from pathlib import Path

import pytest

from palace import scenes
from palace.catalog import ARRANGES, PROPS

ROOT = Path(__file__).resolve().parent.parent

NODE_SCRIPT = """
import { place } from "%s";
import { readFileSync } from "node:fs";
const scenes = JSON.parse(readFileSync(process.argv[2], "utf8"));
console.log(JSON.stringify(scenes.map((items) => place(items).map((p) => [p.item, p.x, p.z, p.y, p.yaw, p.w, p.h, p.d]))));
"""


def _random_items(rng: random.Random) -> list[dict]:
    names = sorted(PROPS)
    items = []
    for i in range(rng.randint(1, 6)):
        it = {"prop": rng.choice(names), "at": [round(rng.uniform(-1, 1), 2), round(rng.uniform(-0.9, 0.9), 2)]}
        if rng.random() < 0.5:
            it["scale"] = round(rng.uniform(0.3, 2.5), 2)
        if rng.random() < 0.4:
            it["rot"] = rng.choice([-90, -45, 0, 30, 90, 180])
        if rng.random() < 0.3:
            it["y"] = round(rng.uniform(0, 1.5), 2)
        if rng.random() < 0.45:
            it["count"] = rng.randint(2, 9)
            it["arrange"] = rng.choice(ARRANGES)
            if rng.random() < 0.5:
                it["spacing"] = round(rng.uniform(0.1, 1.0), 2)
            if rng.random() < 0.4:
                it["radius"] = round(rng.uniform(0.2, 1.0), 2)
            if rng.random() < 0.3:
                it["cols"] = rng.randint(1, 4)
            if rng.random() < 0.5:
                it["face"] = rng.choice(["viewer", "center", "out"])
        if i and rng.random() < 0.3:
            it["on"] = rng.randrange(i)
        items.append(it)
    return items


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_js_and_python_place_items_identically(tmp_path):
    rng = random.Random(4)
    cases = [_random_items(rng) for _ in range(300)]
    (tmp_path / "scenes.json").write_text(json.dumps(cases))
    script = tmp_path / "place.mjs"
    script.write_text(NODE_SCRIPT % (ROOT / "web" / "js" / "scene.js").as_uri())
    res = subprocess.run(["node", str(script), str(tmp_path / "scenes.json")], capture_output=True, text=True,
                         check=True, cwd=ROOT)
    js = json.loads(res.stdout)
    for items, js_placed in zip(cases, js):
        py = [[p.item, p.x, p.z, p.y, p.yaw, p.w, p.h, p.d] for p in scenes.place(items)]
        assert len(py) == len(js_placed), items
        for a, b in zip(py, js_placed):
            assert a[0] == b[0]
            for u, v in zip(a[1:], b[1:]):
                assert u == pytest.approx(v, abs=1e-9), (items, a, b)
