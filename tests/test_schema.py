import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from palace import scenes
from palace.loci import assign
from palace.schema import City, T
from tests.factory import make_city

ROOT = Path(__file__).resolve().parent.parent


def test_shipped_city_is_valid():
    city = City.model_validate_json((ROOT / "content" / "city.json").read_text(encoding="utf-8"))
    assert len(city.buildings) == 9
    assert {b.plot for b in city.buildings} == set(range(9))


def test_text_needs_both_languages():
    T(en="Library", zh="图书馆")
    with pytest.raises(ValidationError):
        T(en="Library", zh="Library")
    with pytest.raises(ValidationError):
        T(en="图书馆", zh="图书馆")


def test_duplicate_ids_and_plots_are_rejected():
    data = make_city([("a", "city", 2, 2, 6), ("b", "city", 2, 2, 6)]).model_dump()
    data["buildings"][1]["plot"] = 0
    with pytest.raises(ValidationError, match="plot 0"):
        City.model_validate(data)
    data = make_city([("a", "city", 2, 2, 6), ("b", "city", 2, 2, 6)]).model_dump()
    data["buildings"][1]["wings"][0]["rooms"][0]["id"] = data["buildings"][0]["wings"][0]["rooms"][0]["id"]
    with pytest.raises(ValidationError, match="duplicate id"):
        City.model_validate(data)


def test_every_locus_gets_its_own_object_that_fits_the_plinth():
    city = City.model_validate_json((ROOT / "content" / "city.json").read_text(encoding="utf-8"))
    objects = assign(city)
    assert len(objects) == sum(r.loci for b in city.buildings for r in b.rooms())
    keys = [(v[0]["prop"], v[0].get("variant"), v[0].get("color")) for v in objects.values()]
    assert len(set(keys)) == len(keys), "two loci share the same object"
    for items in objects.values():
        assert scenes.check(items) == []


def test_assignment_is_stable_when_a_building_is_added():
    small = make_city([("a", "city", 2, 2, 6), ("b", "avenue", 2, 2, 6)])
    big = make_city([("a", "city", 2, 2, 6), ("b", "avenue", 2, 2, 6), ("c", "radial", 2, 2, 6)])
    before, after = assign(small), assign(big)
    for k, v in before.items():
        assert after[k] == v
