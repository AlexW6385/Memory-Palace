"""Content model of a knowledge system.

A knowledge system is pure semantics: wings > rooms > exhibits, in learning
order, plus the architecture template the LLM picked for it. It carries no
coordinates; the layout engine turns it into geometry deterministically.
"""
from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from palace.symbols import SYMBOLS, TEMPLATES

SLUG = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
HEX_COLOR = r"^#[0-9a-fA-F]{6}$"

LIMITS = {
    "wings": (3, 6),
    "rooms_per_wing": (2, 5),
    "exhibits_per_room": (3, 6),
    "exhibits_total": (12, 80),
}

TemplateName = Literal["spiral", "city", "terraces", "avenue", "radial"]
assert set(TemplateName.__args__) == set(TEMPLATES)  # type: ignore[attr-defined]


class Link(BaseModel):
    to: str = Field(pattern=SLUG, description="id of another exhibit in the same system")
    relation: str = Field(min_length=1, max_length=12)


class Exhibit(BaseModel):
    id: str = Field(pattern=SLUG)
    title: str = Field(min_length=1, max_length=16)
    summary: str = Field(min_length=4, max_length=40)
    detail: str = Field(min_length=60, max_length=420)
    image: str = Field(min_length=12, max_length=160, description="vivid memory scene")
    keywords: list[str] = Field(min_length=1, max_length=6)
    emoji: str = Field(min_length=1, max_length=8)
    symbol: str
    links: list[Link] = Field(default_factory=list, max_length=4)

    @field_validator("symbol")
    @classmethod
    def _known_symbol(cls, v: str) -> str:
        if v not in SYMBOLS:
            raise ValueError(f"unknown symbol {v!r}; choose one of {sorted(SYMBOLS)}")
        return v

    @field_validator("keywords")
    @classmethod
    def _short_keywords(cls, v: list[str]) -> list[str]:
        for k in v:
            if not 1 <= len(k) <= 16:
                raise ValueError(f"keyword {k!r} must be 1-16 characters")
        return v


class Room(BaseModel):
    id: str = Field(pattern=SLUG)
    title: str = Field(min_length=1, max_length=16)
    summary: str = Field(min_length=4, max_length=60)
    exhibits: list[Exhibit]

    @field_validator("exhibits")
    @classmethod
    def _count(cls, v: list[Exhibit]) -> list[Exhibit]:
        lo, hi = LIMITS["exhibits_per_room"]
        if not lo <= len(v) <= hi:
            raise ValueError(f"a room needs {lo}-{hi} exhibits, got {len(v)}")
        return v


class Wing(BaseModel):
    id: str = Field(pattern=SLUG)
    title: str = Field(min_length=1, max_length=16)
    summary: str = Field(min_length=4, max_length=80)
    rooms: list[Room]

    @field_validator("rooms")
    @classmethod
    def _count(cls, v: list[Room]) -> list[Room]:
        lo, hi = LIMITS["rooms_per_wing"]
        if not lo <= len(v) <= hi:
            raise ValueError(f"a wing needs {lo}-{hi} rooms, got {len(v)}")
        return v


class Architecture(BaseModel):
    template: TemplateName
    metaphor: str = Field(min_length=2, max_length=40, description="one-line description of the building")


class KnowledgeSystem(BaseModel):
    id: str = Field(pattern=SLUG)
    title: str = Field(min_length=1, max_length=20)
    subtitle: str = Field(min_length=1, max_length=40)
    description: str = Field(min_length=10, max_length=300)
    color: str = Field(pattern=HEX_COLOR)
    architecture: Architecture
    wings: list[Wing]

    @field_validator("wings")
    @classmethod
    def _count(cls, v: list[Wing]) -> list[Wing]:
        lo, hi = LIMITS["wings"]
        if not lo <= len(v) <= hi:
            raise ValueError(f"a system needs {lo}-{hi} wings, got {len(v)}")
        return v

    @model_validator(mode="after")
    def _check_ids_and_links(self) -> "KnowledgeSystem":
        problems: list[str] = []
        seen: dict[str, set[str]] = {"wing": set(), "room": set(), "exhibit": set()}
        for w in self.wings:
            _dup(seen["wing"], w.id, "wing", problems)
            for r in w.rooms:
                _dup(seen["room"], r.id, "room", problems)
                for e in r.exhibits:
                    _dup(seen["exhibit"], e.id, "exhibit", problems)
        total = len(seen["exhibit"])
        lo, hi = LIMITS["exhibits_total"]
        if not lo <= total <= hi:
            problems.append(f"a system needs {lo}-{hi} exhibits in total, got {total}")
        for e in self.exhibits():
            for link in e.links:
                if link.to == e.id:
                    problems.append(f"exhibit {e.id!r} links to itself")
                elif link.to not in seen["exhibit"]:
                    problems.append(f"exhibit {e.id!r} links to unknown exhibit {link.to!r}")
        if problems:
            raise ValueError("; ".join(problems))
        return self

    def exhibits(self) -> list[Exhibit]:
        return [e for w in self.wings for r in w.rooms for e in r.exhibits]


def _dup(seen: set[str], key: str, kind: str, problems: list[str]) -> None:
    if key in seen:
        problems.append(f"duplicate {kind} id {key!r}")
    seen.add(key)


class CrossLink(BaseModel):
    """A link between exhibits of two different systems ("bridges")."""

    source: str = Field(description="'<system>/<exhibit>'")
    target: str = Field(description="'<system>/<exhibit>'")
    relation: str = Field(min_length=1, max_length=12)

    @field_validator("source", "target")
    @classmethod
    def _ref(cls, v: str) -> str:
        parts = v.split("/")
        if len(parts) != 2 or not all(re.match(SLUG, p) for p in parts):
            raise ValueError(f"{v!r} is not a '<system>/<exhibit>' reference")
        return v


class CrossLinks(BaseModel):
    links: list[CrossLink] = Field(default_factory=list)
