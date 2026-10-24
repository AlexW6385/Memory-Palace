"""The generation pipeline against a scripted fake LLM."""
import asyncio
import json

from palace.content import ContentStore
from palace.generate import generate_system
from palace.llm.base import extract_json
from tests.factory import make_exhibit, make_system


def T(en, zh):
    return {"en": en, "zh": zh}


OUTLINE = {
    "id": "linear-algebra",
    "title": T("Linear Algebra", "线性代数"),
    "subtitle": T("Vectors, maps and matrices", "向量、映射与矩阵"),
    "description": T("A generated outline used by the tests of the pipeline.", "用于测试生成流程的大纲，内容是合成的。"),
    "color": "#4a7bd0",
    "architecture": {"template": "city", "metaphor": T("A small test city with three districts.", "一座有三个街区的测试小城。")},
    "wings": [{"id": f"w{i}", "title": T(f"Wing {i}", f"分区{i}"), "summary": T("A wing summary for the tests.", "测试用的分区摘要"),
               "rooms": [{"id": f"w{i}-r{j}", "title": T(f"Room {i}{j}", f"展厅{i}{j}"),
                          "summary": T("A room summary for tests.", "测试用的展厅摘要"),
                          "style": ["library", "garden", "casino", "harbor", "forge", "vault"][i * 2 + j],
                          "exhibits": [{"id": f"x{i}{j}{k}", "title": f"Idea {i}{j}{k}", "covers": "what the idea covers"}
                                       for k in range(3)]}
                         for j in range(2)]} for i in range(3)],
}


class FakeLLM:
    name = "fake"
    model = "scripted"

    def __init__(self, bad_first_outline=False, bad_first_room=False):
        self.calls = []
        self.bad_first_outline = bad_first_outline
        self.bad_first_room = bad_first_room
        self.rooms_seen = set()

    async def complete(self, system: str, prompt: str, max_tokens: int = 16000) -> str:
        self.calls.append(prompt)
        if prompt.startswith("Design the outline"):
            if self.bad_first_outline and len(self.calls) == 1:
                return '{"id": "Not A Slug"}'
            return json.dumps(OUTLINE, ensure_ascii=False)
        if "Write the exhibits of the room" in prompt:
            room_id = next(r["id"] for w in OUTLINE["wings"] for r in w["rooms"]
                           if f'Write the exhibits of the room "{r["title"]["en"]}"' in prompt)
            room = next(r for w in OUTLINE["wings"] for r in w["rooms"] if r["id"] == room_id)
            exhibits = [make_exhibit(e["id"], k) for k, e in enumerate(room["exhibits"])]
            exhibits[0]["links"] = [{"to": room["exhibits"][1]["id"], "relation": T("leads to", "推出")}]
            if self.bad_first_room and room_id not in self.rooms_seen:
                self.rooms_seen.add(room_id)
                exhibits[0]["scene"] = {"items": [{"prop": "crate", "at": [0, 0]}, {"prop": "crate", "at": [0.05, 0]}]}
            return "Here you go:\n```json\n" + json.dumps({"exhibits": exhibits}, ensure_ascii=False) + "\n```"
        if prompt.startswith("The new system"):
            return json.dumps({"crosslinks": [
                {"from": "x000", "to": "old/e0", "relation": T("contrasts with", "对比")},
                {"from": "x000", "to": "old/nope", "relation": T("bad", "坏")},
            ]}, ensure_ascii=False)
        raise AssertionError("unexpected prompt: " + prompt[:80])


def test_extract_json_tolerates_fences_and_chatter():
    assert extract_json('Sure!\n```json\n{"a": 1}\n```\nbye') == {"a": 1}
    assert extract_json('prefix {"a": {"b": 2}} suffix') == {"a": {"b": 2}}


def test_generate_system_end_to_end(tmp_path):
    store = ContentStore(tmp_path)
    store.save_system(make_system("old", "city", 3, 2, 3))
    llm = FakeLLM(bad_first_outline=True, bad_first_room=True)
    system = asyncio.run(generate_system("linear algebra", llm, store))

    assert system.id == "linear-algebra"
    assert len(system.exhibits()) == 18
    assert [r.style for w in system.wings for r in w.rooms] == ["library", "garden", "casino", "harbor", "forge", "vault"]
    assert system.exhibits()[0].links[0].to == "x001"
    assert store.load_system("linear-algebra") == system
    cross = store.load_crosslinks().links
    assert [(c.source, c.target) for c in cross] == [("linear-algebra/x000", "old/e0")]
    # the invalid outline and the colliding scene were sent back with the problems
    assert any("did not pass the checks" in c and c.startswith("Design the outline") for c in llm.calls)
    assert any("did not pass the checks" in c and "collides" in c for c in llm.calls)


def test_generated_id_does_not_clash(tmp_path):
    store = ContentStore(tmp_path)
    store.save_system(make_system("linear-algebra", "city", 3, 2, 3))
    system = asyncio.run(generate_system("linear algebra", FakeLLM(), store))
    assert system.id == "linear-algebra-2"


def test_server_rejects_without_llm(monkeypatch, tmp_path):
    from fastapi.testclient import TestClient

    import palace.server as server

    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("PALACE_LLM_PROVIDER", raising=False)
    monkeypatch.setattr(server, "CONTENT", tmp_path)
    client = TestClient(server.app)
    assert client.get("/api/systems").json() == []
    r = client.post("/api/systems", json={"topic": "linear algebra"})
    assert r.status_code == 400 and "API_KEY" in r.json()["detail"]
