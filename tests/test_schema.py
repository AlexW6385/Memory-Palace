import pytest
from pydantic import ValidationError

from palace import scenes
from palace.content import ContentStore
from palace.schema import KnowledgeSystem, T, scene_problems, text_problems
from palace.world import check_crosslinks
from tests.factory import make_system


def test_factory_system_is_valid():
    s = make_system("x", "city", 3, 2, 3)
    assert len(s.exhibits()) == 18


def _data():
    return make_system("x", "city", 3, 2, 3).model_dump()


def test_unknown_prop_and_bad_variant_are_rejected():
    data = _data()
    data["wings"][0]["rooms"][0]["exhibits"][0]["scene"]["items"][0]["prop"] = "dragon"
    with pytest.raises(ValidationError, match="unknown prop"):
        KnowledgeSystem.model_validate(data)
    data = _data()
    data["wings"][0]["rooms"][0]["exhibits"][0]["scene"]["items"][0]["variant"] = "golden"
    with pytest.raises(ValidationError, match="no variant"):
        KnowledgeSystem.model_validate(data)


def test_figure_options_are_checked():
    data = _data()
    item = data["wings"][0]["rooms"][0]["exhibits"][0]["scene"]["items"][1]
    item["hat"] = "sombrero"
    with pytest.raises(ValidationError, match="hat"):
        KnowledgeSystem.model_validate(data)


def test_dangling_link_and_duplicate_id_are_rejected():
    data = _data()
    data["wings"][0]["rooms"][0]["exhibits"][0]["links"] = [{"to": "nowhere", "relation": {"en": "needs", "zh": "需要"}}]
    data["wings"][1]["rooms"][0]["exhibits"][0]["id"] = "e1"
    with pytest.raises(ValidationError) as err:
        KnowledgeSystem.model_validate(data)
    assert "unknown exhibit" in str(err.value) and "duplicate exhibit" in str(err.value)


def test_room_size_limits():
    with pytest.raises(ValidationError, match="exhibits"):
        make_system("x", "city", 3, 2, 7)


def test_text_checks():
    assert T(en="Sets", zh="集合").check("room.title") == []
    assert any("no Chinese" in p for p in T(en="Sets", zh="Sets").check("room.title"))
    assert any("contains Chinese" in p for p in T(en="集合 sets", zh="集合").check("room.title"))
    assert any("characters" in p for p in T(en="x" * 900, zh="解释" * 10).check("exhibit.explain"))
    assert text_problems(make_system("x", "city", 3, 2, 3)) == []


def test_scene_checks():
    assert scenes.check([{"prop": "crate", "at": [0, 0]}, {"prop": "crate", "at": [0.6, 0]}]) == []
    assert any("collides" in p for p in scenes.check([{"prop": "crate", "at": [0, 0]}, {"prop": "crate", "at": [0.1, 0]}]))
    assert any("off the stage" in p for p in scenes.check([{"prop": "crate", "at": [0, -1.2]}]))
    # stacking with `on` and seated figures are allowed to overlap
    assert scenes.check([{"prop": "table"}, {"prop": "candle", "on": 0}]) == []
    assert scenes.check([{"prop": "chair"}, {"prop": "figure", "pose": "sit"}]) == []
    placed = scenes.place([{"prop": "table"}, {"prop": "book", "count": 3, "arrange": "stack", "on": 0}])
    table_h = placed[0].h
    assert [round(p.y, 3) for p in placed[1:]] == [round(table_h + i * (placed[1].h + 0.01), 3) for i in range(3)]
    assert scene_problems(make_system("x", "city", 3, 2, 3)) == []


def test_shipped_content_is_valid_and_clean():
    store = ContentStore()
    systems = store.load_systems()
    assert systems, "content/systems is empty"
    assert check_crosslinks(systems, store.load_crosslinks()) == []
    for s in systems.values():
        assert text_problems(s) == [], s.id
        assert scene_problems(s) == [], s.id
