"""The city plan: buildings > wings > rooms. Bilingual names (English first, Chinese second).

The plan only names places and gives each room a style; the layout engine turns it into a
walkable world, and every room gets its loci (distinct objects to hang memories on).
"""
from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from palace.catalog import ROOM_STYLES

SLUG = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
HEX_COLOR = r"^#[0-9a-fA-F]{6}$"
LOCI_PER_ROOM = (3, 6)

TemplateName = Literal["spiral", "city", "terraces", "avenue", "radial"]
StyleName = Literal[tuple(ROOM_STYLES)]  # type: ignore[valid-type]

_CJK = re.compile(r"[㐀-鿿]")


class T(BaseModel):
    """A text in English and Chinese."""

    en: str = Field(min_length=1, max_length=60)
    zh: str = Field(min_length=1, max_length=24)

    @model_validator(mode="after")
    def _langs(self) -> "T":
        if _CJK.search(self.en):
            raise ValueError(f"English text contains Chinese: {self.en!r}")
        if not _CJK.search(self.zh):
            raise ValueError(f"Chinese text has no Chinese: {self.zh!r}")
        return self


class Locus(BaseModel):
    """A place to hang a memory. Generated, not authored: only the id matters to the layout."""

    id: str


class Room(BaseModel):
    id: str = Field(pattern=SLUG)
    title: T
    style: StyleName  # type: ignore[valid-type]
    loci: int = Field(default=6, ge=LOCI_PER_ROOM[0], le=LOCI_PER_ROOM[1])

    def locus_list(self) -> list[Locus]:
        return [Locus(id=f"{self.id}-{k + 1}") for k in range(self.loci)]


class Wing(BaseModel):
    id: str = Field(pattern=SLUG)
    title: T
    summary: T
    rooms: list[Room] = Field(min_length=1, max_length=5)


class Building(BaseModel):
    id: str = Field(pattern=SLUG)
    plot: int = Field(ge=0, le=8)
    title: T
    subtitle: T
    color: str = Field(pattern=HEX_COLOR)
    template: TemplateName
    wings: list[Wing] = Field(min_length=2, max_length=8)

    def rooms(self) -> list[Room]:
        return [r for w in self.wings for r in w.rooms]


class City(BaseModel):
    title: T
    buildings: list[Building]

    @model_validator(mode="after")
    def _unique(self) -> "City":
        seen: set[str] = set()
        plots: set[int] = set()
        for b in self.buildings:
            if b.plot in plots:
                raise ValueError(f"plot {b.plot} is used twice")
            plots.add(b.plot)
            for key in [b.id] + [w.id for w in b.wings] + [r.id for r in b.rooms()]:
                if key in seen:
                    raise ValueError(f"duplicate id {key!r}")
                seen.add(key)
        return self

    @field_validator("buildings")
    @classmethod
    def _some(cls, v: list[Building]) -> list[Building]:
        if not v:
            raise ValueError("the city needs at least one building")
        return v
