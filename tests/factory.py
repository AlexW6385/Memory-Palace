"""Synthetic knowledge systems for layout tests."""
from __future__ import annotations

from palace.schema import KnowledgeSystem
from palace.symbols import SYMBOLS

_SYMS = sorted(SYMBOLS)


def make_system(sid: str, template: str, wings: int, rooms: int, exhibits: int,
                color: str = "#3e7cc0") -> KnowledgeSystem:
    n = 0
    ws = []
    for wi in range(wings):
        rs = []
        for ri in range(rooms):
            es = []
            for ei in range(exhibits):
                es.append({
                    "id": f"e{n}", "title": f"展品{n}", "summary": f"第{n}个展品的要点",
                    "detail": "这是一段用于测试的说明文字，" * 6, "image": "一只巨大的测试鸭子在展台上跳舞",
                    "keywords": ["测试"], "emoji": "🦆", "symbol": _SYMS[n % len(_SYMS)],
                    "links": [{"to": f"e{n - 1}", "relation": "前提"}] if n else [],
                })
                n += 1
            rs.append({"id": f"w{wi}-r{ri}", "title": f"展厅{wi}-{ri}", "summary": "测试展厅摘要", "exhibits": es})
        ws.append({"id": f"w{wi}", "title": f"分区{wi}", "summary": "测试分区摘要", "rooms": rs})
    return KnowledgeSystem.model_validate({
        "id": sid, "title": f"测试{sid}", "subtitle": "测试体系", "description": "用于布局测试的合成体系。",
        "color": color, "architecture": {"template": template, "metaphor": "测试建筑"}, "wings": ws,
    })
