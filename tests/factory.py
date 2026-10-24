"""Synthetic city plans for layout and world tests."""
from __future__ import annotations

from palace.catalog import ROOM_STYLES
from palace.schema import Building, City

STYLES = sorted(ROOM_STYLES)


def _t(en: str, zh: str) -> dict:
    return {"en": en, "zh": zh}


def make_building(bid: str, template: str, wings: int, rooms: int, loci: int = 6, plot: int = 0,
                  color: str = "#3e7cc0", styles: list[str] | None = None, style_offset: int = 0) -> Building:
    k = 0
    ws = []
    for wi in range(wings):
        rs = []
        for ri in range(rooms):
            style = styles[k % len(styles)] if styles else STYLES[(style_offset + k) % len(STYLES)]
            rs.append({"id": f"{bid}-w{wi}-r{ri}", "title": _t(f"Room {wi}-{ri}", f"房间{wi}-{ri}"), "style": style,
                       "loci": loci})
            k += 1
        ws.append({"id": f"{bid}-w{wi}", "title": _t(f"Wing {wi}", f"分区{wi}"), "summary": _t("A test wing", "测试分区"),
                   "rooms": rs})
    return Building.model_validate({"id": bid, "plot": plot, "title": _t(f"Test {bid}", f"测试{bid}"),
                                    "subtitle": _t("A test building", "测试建筑"), "color": color,
                                    "template": template, "wings": ws})


def make_city(specs: list[tuple]) -> City:
    """specs: (id, template, wings, rooms, loci) per building, given plots 0, 1, 2, … in order."""
    return City.model_validate({"title": _t("Test city", "测试城市"), "buildings": [
        make_building(*spec, plot=i, style_offset=i * 7).model_dump() for i, spec in enumerate(specs)]})
