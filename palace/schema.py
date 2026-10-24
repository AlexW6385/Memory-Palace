"""Content model of a knowledge system (bilingual: English first, Chinese second).

A knowledge system is semantics only: wings > rooms > exhibits in learning
order, the architecture template, a room style per room and a small 3D scene
per exhibit. It carries no world coordinates; the layout engine places it.
"""
from __future__ import annotations

import re
from typing import Literal, Union

from pydantic import BaseModel, Field, field_validator, model_validator

from palace import scenes
from palace.catalog import (ANIMS, ARRANGES, BACKDROP_PATTERNS, HATS, HOLDABLE, POSES, PROPS, ROOM_STYLES)

SLUG = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
HEX_COLOR = r"^#[0-9a-fA-F]{6}$"

LIMITS = {
    "wings": (2, 8),
    "rooms_per_wing": (1, 5),
    "exhibits_per_room": (3, 6),
    "exhibits_total": (12, 90),
    "items_per_scene": (2, 10),
}

# (min, max) characters for English / Chinese text fields
LENGTHS = {
    "system.title": ((3, 40), (2, 16)),
    "system.subtitle": ((8, 80), (4, 32)),
    "system.description": ((40, 420), (20, 180)),
    "metaphor": ((20, 160), (10, 70)),
    "wing.title": ((3, 48), (2, 20)),
    "wing.summary": ((20, 200), (8, 90)),
    "room.title": ((3, 40), (1, 16)),
    "room.summary": ((15, 160), (6, 70)),
    "exhibit.title": ((3, 56), (2, 22)),
    "exhibit.summary": ((20, 150), (8, 64)),
    "exhibit.explain": ((180, 760), (70, 320)),
    "exhibit.example": ((60, 460), (25, 210)),
    "exhibit.image": ((100, 460), (40, 200)),
    "cue.thing": ((2, 48), (1, 20)),
    "cue.means": ((4, 110), (2, 48)),
    "keyword": ((2, 32), (1, 14)),
    "relation": ((2, 26), (1, 10)),
    "scene.text": ((1, 60), (1, 30)),
}

TemplateName = Literal["spiral", "city", "terraces", "avenue", "radial"]
StyleName = Literal[tuple(ROOM_STYLES)]  # type: ignore[valid-type]

_CJK = re.compile(r"[㐀-鿿]")


class T(BaseModel):
    """A text in English and Chinese."""

    en: str = Field(min_length=1)
    zh: str = Field(min_length=1)

    def check(self, key: str) -> list[str]:
        (elo, ehi), (zlo, zhi) = LENGTHS[key]
        out = []
        if not elo <= len(self.en) <= ehi:
            out.append(f"{key}.en has {len(self.en)} characters (want {elo}-{ehi}): {self.en[:60]!r}")
        if not zlo <= len(self.zh) <= zhi:
            out.append(f"{key}.zh has {len(self.zh)} characters (want {zlo}-{zhi}): {self.zh[:30]!r}")
        if _CJK.search(self.en):
            out.append(f"{key}.en contains Chinese characters: {self.en[:60]!r}")
        if key not in ("keyword", "relation", "scene.text", "cue.thing") and not _CJK.search(self.zh):
            out.append(f"{key}.zh has no Chinese: {self.zh[:60]!r}")
        return out


Text = Union[T, str]


class Item(BaseModel):
    """One prop (or a repeated group of it) on an exhibit's stage."""

    model_config = {"extra": "forbid"}

    prop: str
    at: tuple[float, float] = (0.0, 0.0)
    y: float | None = Field(default=None, ge=0, le=2.4)
    on: int | None = Field(default=None, ge=0)
    rot: float = Field(default=0.0, ge=-360, le=360)
    scale: float = Field(default=1.0, ge=0.2, le=3.0)
    color: str | None = Field(default=None, pattern=HEX_COLOR)
    color2: str | None = Field(default=None, pattern=HEX_COLOR)
    variant: str | None = None
    pose: str | None = None
    hat: str | None = None
    hold: str | None = None
    text: Text | None = None
    emoji: str | None = None
    anim: str | None = None
    count: int = Field(default=1, ge=1, le=24)
    arrange: str | None = None
    spacing: float | None = Field(default=None, gt=0, le=1.5)
    radius: float | None = Field(default=None, gt=0, le=1.25)
    cols: int | None = Field(default=None, ge=1, le=8)
    face: Literal["viewer", "center", "out"] | None = None

    @model_validator(mode="after")
    def _known(self) -> "Item":
        p = PROPS.get(self.prop)
        if p is None:
            raise ValueError(f"unknown prop {self.prop!r}")
        if self.variant is not None and self.variant not in p["variants"]:
            raise ValueError(f"{self.prop} has no variant {self.variant!r} (choose {p['variants']})")
        person = self.prop in ("figure", "statue")
        if self.pose is not None and (not person or self.pose not in POSES):
            raise ValueError(f"pose {self.pose!r} is not valid here (figure/statue poses: {POSES})")
        if self.hat is not None and (self.prop != "figure" or self.hat not in HATS):
            raise ValueError(f"hat {self.hat!r} is not valid here (figure hats: {HATS})")
        if self.hold is not None and (self.prop != "figure" or self.hold not in HOLDABLE):
            raise ValueError(f"hold {self.hold!r} is not valid (figure can hold: {HOLDABLE})")
        if self.text is not None and not p["text"]:
            raise ValueError(f"{self.prop} does not take text")
        if self.emoji is not None and self.prop != "cutout":
            raise ValueError("only a cutout takes an emoji")
        if self.prop == "cutout" and not self.emoji:
            raise ValueError("a cutout needs an emoji")
        if self.anim is not None and self.anim not in ANIMS:
            raise ValueError(f"unknown anim {self.anim!r} (choose {ANIMS})")
        if self.arrange is not None and self.arrange not in ARRANGES:
            raise ValueError(f"unknown arrange {self.arrange!r} (choose {ARRANGES})")
        if self.color2 is not None and p["colors"] < 2:
            raise ValueError(f"{self.prop} has no second color")
        return self


class Backdrop(BaseModel):
    glyph: Text = ""
    pattern: str = "plain"

    @field_validator("pattern")
    @classmethod
    def _pattern(cls, v: str) -> str:
        if v not in BACKDROP_PATTERNS:
            raise ValueError(f"unknown backdrop pattern {v!r} (choose {BACKDROP_PATTERNS})")
        return v


class Scene(BaseModel):
    backdrop: Backdrop = Backdrop()
    items: list[Item]

    @model_validator(mode="after")
    def _items(self) -> "Scene":
        lo, hi = LIMITS["items_per_scene"]
        if not lo <= len(self.items) <= hi:
            raise ValueError(f"a scene needs {lo}-{hi} items, got {len(self.items)}")
        for i, it in enumerate(self.items):
            if it.on is not None and it.on >= i:
                raise ValueError(f"item {i}: 'on' must point to an earlier item")
        return self


class Cue(BaseModel):
    thing: T
    means: T


class Link(BaseModel):
    to: str = Field(pattern=SLUG)
    relation: T


class Exhibit(BaseModel):
    id: str = Field(pattern=SLUG)
    title: T
    summary: T
    explain: T
    example: T
    image: T
    cues: list[Cue] = Field(min_length=2, max_length=5)
    keywords: list[T] = Field(min_length=2, max_length=6)
    emoji: str = Field(min_length=1, max_length=8)
    scene: Scene
    links: list[Link] = Field(default_factory=list, max_length=4)


class Room(BaseModel):
    id: str = Field(pattern=SLUG)
    title: T
    summary: T
    style: StyleName  # type: ignore[valid-type]
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
    title: T
    summary: T
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
    metaphor: T


class KnowledgeSystem(BaseModel):
    id: str = Field(pattern=SLUG)
    title: T
    subtitle: T
    description: T
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


# ── quality checks beyond the schema (lengths, scene geometry) ───────────────

def text_problems(system_or_wings) -> list[str]:
    """Length and language problems in every bilingual field."""
    out: list[str] = []
    wings = system_or_wings.wings if isinstance(system_or_wings, KnowledgeSystem) else system_or_wings
    if isinstance(system_or_wings, KnowledgeSystem):
        s = system_or_wings
        out += s.title.check("system.title") + s.subtitle.check("system.subtitle")
        out += s.description.check("system.description") + s.architecture.metaphor.check("metaphor")
    for w in wings:
        out += [f"wing {w.id}: {p}" for p in w.title.check("wing.title") + w.summary.check("wing.summary")]
        for r in w.rooms:
            out += [f"room {r.id}: {p}" for p in r.title.check("room.title") + r.summary.check("room.summary")]
            for e in r.exhibits:
                ps: list[str] = []
                for key in ("title", "summary", "explain", "example", "image"):
                    ps += getattr(e, key).check(f"exhibit.{key}")
                for c in e.cues:
                    ps += c.thing.check("cue.thing") + c.means.check("cue.means")
                for k in e.keywords:
                    ps += k.check("keyword")
                for link in e.links:
                    ps += link.relation.check("relation")
                for it in e.scene.items:
                    if isinstance(it.text, T):
                        ps += it.text.check("scene.text")
                    elif isinstance(it.text, str) and len(it.text) > 40:
                        ps.append(f"scene text too long: {it.text!r}")
                g = e.scene.backdrop.glyph
                glyph_len = len(g.en) if isinstance(g, T) else len(g)
                if glyph_len > 14:
                    ps.append(f"backdrop glyph longer than 14 characters: {g!r}")
                out += [f"exhibit {e.id}: {p}" for p in ps]
    return out


def scene_problems(system_or_wings) -> list[str]:
    wings = system_or_wings.wings if isinstance(system_or_wings, KnowledgeSystem) else system_or_wings
    out: list[str] = []
    for w in wings:
        for r in w.rooms:
            for e in r.exhibits:
                items = [it.model_dump(exclude_none=True) for it in e.scene.items]
                out += [f"exhibit {e.id}: {p}" for p in scenes.check(items)]
    return out


# ── links between systems ────────────────────────────────────────────────────

class CrossLink(BaseModel):
    """A link between exhibits of two different systems ("bridges")."""

    source: str = Field(description="'<system>/<exhibit>'")
    target: str = Field(description="'<system>/<exhibit>'")
    relation: T

    @field_validator("source", "target")
    @classmethod
    def _ref(cls, v: str) -> str:
        parts = v.split("/")
        if len(parts) != 2 or not all(re.match(SLUG, p) for p in parts):
            raise ValueError(f"{v!r} is not a '<system>/<exhibit>' reference")
        return v


class CrossLinks(BaseModel):
    links: list[CrossLink] = Field(default_factory=list)
