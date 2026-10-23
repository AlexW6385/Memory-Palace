import pytest
from pydantic import ValidationError

from palace.content import ContentStore
from palace.schema import KnowledgeSystem
from palace.world import check_crosslinks
from tests.factory import make_system


def test_factory_system_is_valid():
    s = make_system("x", "city", 3, 2, 3)
    assert len(s.exhibits()) == 18


def test_unknown_symbol_is_rejected():
    data = make_system("x", "city", 3, 2, 3).model_dump()
    data["wings"][0]["rooms"][0]["exhibits"][0]["symbol"] = "dragon"
    with pytest.raises(ValidationError, match="unknown symbol"):
        KnowledgeSystem.model_validate(data)


def test_dangling_link_and_duplicate_id_are_rejected():
    data = make_system("x", "city", 3, 2, 3).model_dump()
    data["wings"][0]["rooms"][0]["exhibits"][0]["links"] = [{"to": "nowhere", "relation": "前提"}]
    data["wings"][1]["rooms"][0]["exhibits"][0]["id"] = "e1"
    with pytest.raises(ValidationError) as err:
        KnowledgeSystem.model_validate(data)
    assert "unknown exhibit" in str(err.value) and "duplicate exhibit" in str(err.value)


def test_room_size_limits():
    with pytest.raises(ValidationError, match="exhibits"):
        make_system("x", "city", 3, 2, 7)


def test_shipped_content_is_valid():
    store = ContentStore()
    systems = store.load_systems()
    assert systems, "content/systems is empty"
    assert check_crosslinks(systems, store.load_crosslinks()) == []
