"""Synthetic bilingual knowledge systems for layout and world tests."""
from __future__ import annotations

from palace.catalog import ROOM_STYLES
from palace.schema import KnowledgeSystem

STYLES = sorted(ROOM_STYLES)

SCENES = [
    {"backdrop": {"glyph": "A=B", "pattern": "rays"},
     "items": [{"prop": "crate", "at": [-0.4, 0.0]}, {"prop": "figure", "at": [0.45, 0.1], "pose": "point"}]},
    {"backdrop": {"glyph": {"en": "Stack", "zh": "栈"}, "pattern": "dots"},
     "items": [{"prop": "book", "count": 4, "arrange": "stack"}, {"prop": "cat", "at": [0.6, 0.2]}]},
    {"items": [{"prop": "table", "at": [0, -0.2]}, {"prop": "candle", "on": 0},
               {"prop": "figure", "at": [0.7, 0.3], "pose": "think", "hat": "top_hat"}]},
]


def _t(en: str, zh: str) -> dict:
    return {"en": en, "zh": zh}


def make_exhibit(eid: str, n: int, links: list[dict] | None = None) -> dict:
    return {
        "id": eid,
        "title": _t(f"Exhibit number {n}", f"展品{n}"),
        "summary": _t(f"The key point of test exhibit {n}.", f"第{n}个展品的要点"),
        "explain": _t("This is an explanation used only by the tests. " * 5, "这是一段只给测试使用的解释文字。" * 6),
        "example": _t("For example, a small test case that exercises the layout engine end to end.",
                      "例如：一个从头到尾检验布局引擎的小测试用例，覆盖每一种模板。"),
        "image": _t("A giant test duck dances on the stage while a clerk in a top hat counts the crates piled "
                    "beside it, one by one.",
                    "一只巨大的测试鸭子在展台上跳舞，旁边戴高帽的店员一个一个地数着堆在一边的木箱子，数得满头大汗。"),
        "cues": [{"thing": _t("the duck", "鸭子"), "means": _t("the test subject", "被测对象")},
                 {"thing": _t("the crates", "箱子"), "means": _t("the inputs", "输入")}],
        "keywords": [_t("test", "测试"), _t("layout", "布局")],
        "emoji": "🦆",
        "scene": SCENES[n % len(SCENES)],
        "links": links or [],
    }


def make_system(sid: str, template: str, wings: int, rooms: int, exhibits: int,
                color: str = "#3e7cc0", style_offset: int = 0) -> KnowledgeSystem:
    return make_structured(sid, template, [[exhibits] * rooms for _ in range(wings)], color, style_offset)


def make_structured(sid: str, template: str, structure: list[list[int]], color: str = "#3e7cc0",
                    style_offset: int = 0, styles: list[str] | None = None) -> KnowledgeSystem:
    """structure[w][r] is the number of exhibits in room r of wing w."""
    n = 0
    k = 0
    ws = []
    for wi, wing in enumerate(structure):
        rs = []
        for ri, exhibits in enumerate(wing):
            es = []
            for ei in range(exhibits):
                es.append(make_exhibit(f"e{n}", n, [{"to": f"e{n - 1}", "relation": _t("follows", "承接")}] if n else []))
                n += 1
            style = styles[k] if styles else STYLES[(style_offset + k) % len(STYLES)]
            k += 1
            rs.append({"id": f"w{wi}-r{ri}", "title": _t(f"Room {wi}-{ri}", f"展厅{wi}-{ri}"),
                       "summary": _t("A test room summary.", "测试展厅摘要"), "style": style, "exhibits": es})
        ws.append({"id": f"w{wi}", "title": _t(f"Wing {wi}", f"分区{wi}"),
                   "summary": _t("A test wing summary for layout.", "用于布局测试的分区摘要"), "rooms": rs})
    return KnowledgeSystem.model_validate({
        "id": sid, "title": _t(f"Test {sid}", f"测试{sid}"), "subtitle": _t("A synthetic system", "合成体系"),
        "description": _t("A synthetic knowledge system used by the layout tests.", "一个用于布局测试的合成知识体系，内容没有实际意义。"),
        "color": color, "architecture": {"template": template, "metaphor": _t("A test building for tests.",
                                                                              "一座专门给测试用的建筑。")},
        "wings": ws,
    })
