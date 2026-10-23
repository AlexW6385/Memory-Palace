"""The generation pipeline against a scripted fake LLM."""
import asyncio
import json

import pytest

from palace.content import ContentStore
from palace.generate import generate_system
from palace.llm.base import extract_json
from tests.factory import make_system


class FakeLLM:
    name = "fake"
    model = "scripted"

    def __init__(self, bad_first_outline: bool = False):
        self.calls = []
        self.bad_first_outline = bad_first_outline

    async def complete(self, system: str, prompt: str, max_tokens: int = 16000) -> str:
        self.calls.append(prompt)
        if "大纲" in prompt and "现在请写" not in prompt:
            if self.bad_first_outline and len(self.calls) == 1:
                return '{"id": "Not A Slug"}'
            return json.dumps(OUTLINE, ensure_ascii=False)
        if "现在请写" in prompt:
            title = prompt.split("展厅「")[1].split("」")[0]
            n = next(r["exhibits"] for w in OUTLINE["wings"] for r in w["rooms"] if r["title"] == title)
            return "好的，以下是结果：\n```json\n" + json.dumps({"exhibits": [exhibit(f"x-{k}", title, k) for k in range(n)]},
                                                               ensure_ascii=False) + "\n```"
        # links pass
        return json.dumps({
            "links": [{"from": "x-0", "to": "x-1", "relation": "前提"}, {"from": "x-0", "to": "missing", "relation": "坏"}],
            "crosslinks": [{"from": "x-0", "to": "old/e0", "relation": "对比"},
                           {"from": "x-0", "to": "old/nope", "relation": "坏"}],
        }, ensure_ascii=False)


def exhibit(eid, room, k):
    return {"id": eid, "title": f"{room}{k}", "summary": "一句话说明这个知识点", "detail": "讲解文字。" * 30,
            "image": "一只会发光的大象在展台上转圈", "keywords": ["测试"], "emoji": "🐘", "symbol": "sphere", "links": []}


OUTLINE = {
    "id": "linear-algebra", "title": "线性代数", "subtitle": "测试大纲", "description": "用于测试的生成大纲。",
    "color": "#4a7bd0", "architecture": {"template": "city", "metaphor": "测试城市"},
    "wings": [{"id": f"w{i}", "title": f"分区{i}", "summary": "分区摘要",
               "rooms": [{"id": f"w{i}-r{j}", "title": f"展厅{i}{j}", "summary": "展厅摘要", "focus": "讲些什么",
                          "exhibits": 3} for j in range(2)]} for i in range(3)],
}


def test_extract_json_tolerates_fences_and_chatter():
    assert extract_json('Sure!\n```json\n{"a": 1}\n```\nbye') == {"a": 1}
    assert extract_json('prefix {"a": {"b": 2}} suffix') == {"a": {"b": 2}}


def test_generate_system_end_to_end(tmp_path):
    store = ContentStore(tmp_path)
    store.save_system(make_system("old", "city", 3, 2, 3))
    llm = FakeLLM(bad_first_outline=True)
    system = asyncio.run(generate_system("线性代数", llm, store))

    assert system.id == "linear-algebra"
    assert len(system.exhibits()) == 18
    ids = [e.id for e in system.exhibits()]
    assert len(set(ids)) == len(ids), "duplicate ids from parallel rooms must be renamed"
    first = system.exhibits()[0]
    assert [l.to for l in first.links] == ["x-1"]           # the dangling link was dropped
    saved = store.load_system("linear-algebra")
    assert saved == system
    cross = store.load_crosslinks().links
    assert [(c.source, c.target) for c in cross] == [("linear-algebra/x-0", "old/e0")]
    # the invalid first outline was retried with the validation error
    assert "没有通过校验" in llm.calls[1]


def test_generated_id_does_not_clash(tmp_path):
    store = ContentStore(tmp_path)
    store.save_system(make_system("linear-algebra", "city", 3, 2, 3))
    system = asyncio.run(generate_system("线性代数", FakeLLM(), store))
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
    r = client.post("/api/systems", json={"topic": "线性代数"})
    assert r.status_code == 400 and "API_KEY" in r.json()["detail"]
