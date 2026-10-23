"""The browser (web/js/nav.js) and Python (palace/nav.py) must agree on where one can stand."""
import json
import random
import shutil
import subprocess
from pathlib import Path

import pytest

from palace.content import Manifest
from palace.nav import Nav
from palace.schema import CrossLinks
from palace.world import assign_plots, build_world
from tests.factory import make_system

ROOT = Path(__file__).resolve().parent.parent

NODE_SCRIPT = """
import { Nav } from "%s";
import { readFileSync } from "node:fs";
const data = JSON.parse(readFileSync(process.argv[2], "utf8"));
const nav = new Nav(data.nav);
const out = data.samples.map(([x, z, y]) => nav.stand(x, z, y));
console.log(JSON.stringify(out));
"""


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_js_and_python_agree(tmp_path):
    specs = [("a", "spiral", 3, 2, 4), ("c", "terraces", 4, 2, 4), ("e", "radial", 3, 2, 4)]
    systems = {s[0]: make_system(*s) for s in specs}
    world = build_world(systems, CrossLinks(), assign_plots(systems, Manifest()), with_tours=False)
    nav = Nav(world["nav"]["surfaces"], world["nav"]["colliders"])
    rng = random.Random(1)
    samples = []
    for so in world["systems"]:
        cx, cz = world["plots"][so["plot"]]["center"]
        for _ in range(1500):
            samples.append([cx + rng.uniform(-100, 100), cz + rng.uniform(-100, 100), rng.choice([0, 0.2, 0.5, 4.5, 9, 12])])
    (tmp_path / "data.json").write_text(json.dumps({"nav": world["nav"], "samples": samples}))
    script = tmp_path / "check.mjs"
    script.write_text(NODE_SCRIPT % (ROOT / "web" / "js" / "nav.js").as_uri())
    res = subprocess.run(["node", str(script), str(tmp_path / "data.json")], capture_output=True, text=True, check=True)
    js = json.loads(res.stdout)
    mismatches = 0
    for (x, z, y), j in zip(samples, js):
        p = nav.stand(x, z, y)
        if (p is None) != (j is None) or (p is not None and abs(p - j) > 1e-6):
            mismatches += 1
    assert mismatches == 0, f"{mismatches} of {len(samples)} samples disagree"
    assert sum(v is not None for v in js) > len(js) * 0.3  # the samples actually exercise walkable ground
