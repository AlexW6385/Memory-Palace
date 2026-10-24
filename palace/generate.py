"""Have an LLM design a new knowledge system, bilingual and with 3D scenes, in three passes.

1. outline  – titles, architecture template, wings, rooms (with a room style each) and the
              planned exhibits of every room
2. rooms    – every room's exhibits, written in parallel: all text in English and Chinese, the
              memory scene built from catalogue props, and links inside the system
3. bridges  – links from the new system to exhibits of the systems already in the palace

Every reply is parsed and validated (schema, text lengths, scene geometry). Problems go back
to the model for another try.
"""
from __future__ import annotations

import asyncio
import json
import re
from pathlib import Path
from typing import Callable

from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator

from palace.catalog import ROOM_STYLES, catalog_for_prompt, rooms_for_prompt
from palace.content import ROOT, ContentStore
from palace.llm.base import LLMError, Provider, extract_json
from palace.schema import (
    HEX_COLOR, LIMITS, SLUG, Architecture, CrossLink, Exhibit, KnowledgeSystem, StyleName, T, Wing,
    scene_problems, text_problems,
)

ATTEMPTS = 3
PARALLEL_ROOMS = 4
Log = Callable[[str], None]

TEMPLATES = {
    "spiral": "a tower climbed by a spiral ramp: for a system that unfolds step by step from one beginning "
              "(a philosophy, a history, a single long argument)",
    "city": "a boulevard with one district per wing: for a broad field with parallel subjects",
    "terraces": "a stepped pyramid, one level per wing: for layers of abstraction built on each other",
    "avenue": "one long street with a gate per wing: for a process or lifecycle walked from start to end",
    "radial": "a hub with one spoke per wing: for one core idea with several branches around it",
}

GUIDE = (ROOT / "docs" / "writing-guide.md").read_text(encoding="utf-8")

SYSTEM = f"""You are the architect and author of a Memory Palace: a walkable 3D world in which every knowledge
system is a building, every wing a part of it, every room a themed hall, and every exhibit one idea shown
as a small, vivid 3D scene on a numbered stage. Visitors walk the route, read the cards and remember each
idea by where it stands and what its scene looks like.

Follow this writing guide exactly:

{GUIDE}

General rules:
- English is the primary language. Every text field is {{"en": ..., "zh": ...}}: natural Chinese, not a
  word-for-word translation.
- Be accurate. Personal topics (an internship, a project, plans) use only the material the user gave;
  never invent facts about the user.
- The order is the walking route: put things in the most natural learning or working order.
- Reply with one JSON object and nothing else."""


# ── outline model ────────────────────────────────────────────────────────────

class ExhibitPlan(BaseModel):
    id: str = Field(pattern=SLUG)
    title: str = Field(min_length=3, max_length=56)
    covers: str = Field(min_length=10, max_length=300)


class RoomPlan(BaseModel):
    id: str = Field(pattern=SLUG)
    title: T
    summary: T
    style: StyleName  # type: ignore[valid-type]
    exhibits: list[ExhibitPlan]

    @field_validator("exhibits")
    @classmethod
    def _count(cls, v):
        lo, hi = LIMITS["exhibits_per_room"]
        if not lo <= len(v) <= hi:
            raise ValueError(f"a room needs {lo}-{hi} exhibits, got {len(v)}")
        return v


class WingPlan(BaseModel):
    id: str = Field(pattern=SLUG)
    title: T
    summary: T
    rooms: list[RoomPlan]

    @field_validator("rooms")
    @classmethod
    def _count(cls, v):
        lo, hi = LIMITS["rooms_per_wing"]
        if not lo <= len(v) <= hi:
            raise ValueError(f"a wing needs {lo}-{hi} rooms, got {len(v)}")
        return v


class Outline(BaseModel):
    id: str = Field(pattern=SLUG)
    title: T
    subtitle: T
    description: T
    color: str = Field(pattern=HEX_COLOR)
    architecture: Architecture
    wings: list[WingPlan]

    @model_validator(mode="after")
    def _check(self) -> "Outline":
        lo, hi = LIMITS["wings"]
        if not lo <= len(self.wings) <= hi:
            raise ValueError(f"a system needs {lo}-{hi} wings, got {len(self.wings)}")
        ids = [e.id for w in self.wings for r in w.rooms for e in r.exhibits]
        dup = sorted({i for i in ids if ids.count(i) > 1})
        if dup:
            raise ValueError(f"exhibit ids must be unique: {dup}")
        lo, hi = LIMITS["exhibits_total"]
        if not lo <= len(ids) <= hi:
            raise ValueError(f"the exhibits add up to {len(ids)}; keep the total within {lo}-{hi}")
        return self

    def exhibit_ids(self) -> list[str]:
        return [e.id for w in self.wings for r in w.rooms for e in r.exhibits]


def outline_problems(o: Outline) -> list[str]:
    out = o.title.check("system.title") + o.subtitle.check("system.subtitle")
    out += o.description.check("system.description") + o.architecture.metaphor.check("metaphor")
    for w in o.wings:
        out += [f"wing {w.id}: {p}" for p in w.title.check("wing.title") + w.summary.check("wing.summary")]
        for r in w.rooms:
            out += [f"room {r.id}: {p}" for p in r.title.check("room.title") + r.summary.check("room.summary")]
    return out


class RoomExhibits(BaseModel):
    exhibits: list[Exhibit]


class Bridges(BaseModel):
    crosslinks: list[dict] = Field(default_factory=list)


# ── prompts ──────────────────────────────────────────────────────────────────

def outline_prompt(topic: str, notes: str, existing: list[KnowledgeSystem]) -> str:
    lo_w, hi_w = LIMITS["wings"]
    lo_r, hi_r = LIMITS["rooms_per_wing"]
    lo_e, hi_e = LIMITS["exhibits_per_room"]
    taken = ", ".join(f"{s.id} ({s.title.en})" for s in existing) or "none"
    return f"""Design the outline of a new knowledge system for the palace.

Topic: {topic}
Material or requests from the user:
{notes or "(none)"}

Systems already in the palace (do not reuse their ids): {taken}

Architecture templates (architecture.template), pick the one whose shape fits the structure of the subject:
{json.dumps(TEMPLATES, indent=1)}

Room styles (room.style). Each room is a themed hall; the theme is itself a memory cue. Pick a style whose
world fits the room's content (a post office for message passing, a casino for probability). Use each style
at most once in the system:
{rooms_for_prompt()}

Size: {lo_w}-{hi_w} wings, {lo_r}-{hi_r} rooms per wing, {lo_e}-{hi_e} exhibits per room; 40-70 exhibits in
total suits a large subject (never fewer than {LIMITS["exhibits_total"][0]}). Structure the knowledge carefully:
wings are the major parts in learning order, rooms group closely related ideas, and each exhibit is one idea
that can be shown as one scene. No duplicates, no filler.

Reply with JSON:
{{
  "id": "english-slug",
  "title": {{"en": "3-40 chars", "zh": "2-16 字"}},
  "subtitle": {{"en": "8-80 chars", "zh": "4-32 字"}},
  "description": {{"en": "40-420 chars", "zh": "20-180 字"}},
  "color": "#rrggbb (the system's colour, medium saturation)",
  "architecture": {{"template": "...", "metaphor": {{"en": "20-160 chars: the building as an image", "zh": "10-70 字"}}}},
  "wings": [
    {{"id": "slug", "title": {{"en": "...", "zh": "..."}}, "summary": {{"en": "20-200 chars", "zh": "8-90 字"}},
      "rooms": [
        {{"id": "slug", "title": {{"en": "3-40 chars", "zh": "2-16 字"}}, "summary": {{"en": "15-160 chars", "zh": "6-70 字"}},
          "style": "room style",
          "exhibits": [{{"id": "slug, unique in the system", "title": "English working title",
                        "covers": "what this exhibit must explain"}}]}}
      ]}}
  ]
}}"""


def room_prompt(outline: Outline, wing: WingPlan, room: RoomPlan, notes: str) -> str:
    plan = [{"wing": w.id, "title": w.title.en, "rooms": [{"room": r.id, "title": r.title.en,
            "exhibits": [{"id": e.id, "title": e.title} for e in r.exhibits]} for r in w.rooms]} for w in outline.wings]
    style = ROOM_STYLES[room.style]
    todo = [{"id": e.id, "working_title": e.title, "covers": e.covers} for e in room.exhibits]
    return f"""System: {outline.title.en} / {outline.title.zh} — {outline.subtitle.en}
The whole outline (link to these ids; do not repeat what other rooms cover):
{json.dumps(plan, ensure_ascii=False)}

Write the exhibits of the room "{room.title.en}" ({room.summary.en}) in the wing "{wing.title.en}".
The room is a themed hall: {style["en"]} — {style["desc"]}
Exactly these exhibits, in this order, with these ids:
{json.dumps(todo, ensure_ascii=False, indent=1)}

Material from the user: {notes or "(none)"}

Props for the scenes (name [width×height×depth in metres] description (variants)):
{catalog_for_prompt()}

Reply with JSON: {{"exhibits": [{{"id", "title", "summary", "explain", "example", "image", "cues", "keywords", "emoji",
"scene", "links"}}, ...]}} following the writing guide. Links may point to any exhibit id in the outline."""


def bridges_prompt(system: KnowledgeSystem, others: list[KnowledgeSystem]) -> str:
    mine = [{"id": e.id, "title": e.title.en, "summary": e.summary.en} for e in system.exhibits()]
    theirs = [{"ref": f"{s.id}/{e.id}", "title": e.title.en} for s in others for e in s.exhibits()]
    return f"""The new system "{system.title.en}" has these exhibits:
{json.dumps(mine, ensure_ascii=False)}

Exhibits of the other systems in the palace:
{json.dumps(theirs, ensure_ascii=False)}

Find up to 12 real, illuminating relations between an exhibit of the new system and an exhibit of another
system (uses, generalises, is an example of, implements, contrasts with…). Do not force weak ones.

Reply with JSON: {{"crosslinks": [{{"from": "new exhibit id", "to": "system/exhibit ref",
"relation": {{"en": "2-26 chars", "zh": "1-10 字"}}}}]}}"""


# ── calls with validation and retry ──────────────────────────────────────────

async def ask(provider: Provider, prompt: str, parse: Callable[[dict], tuple[object, list[str]]], log: Log,
              what: str, max_tokens: int = 16000, soft: bool = False):
    """Ask, parse and check. parse(data) returns (object, problems); problems trigger another try.

    With soft=True, the last attempt is accepted when it parses, even if problems remain.
    """
    messages = prompt
    last = ""
    for attempt in range(1, ATTEMPTS + 1):
        reply = await provider.complete(SYSTEM, messages, max_tokens=max_tokens)
        try:
            obj, problems = parse(extract_json(reply))
        except (ValidationError, ValueError, json.JSONDecodeError) as e:
            obj, problems = None, [str(e)[:3000]]
        if not problems:
            return obj
        last = "\n".join(f"- {p}" for p in problems[:40])
        log(f"  {what}: attempt {attempt}: {len(problems)} problem(s), first: {problems[0][:140]}")
        if obj is not None and soft and attempt == ATTEMPTS:
            log(f"  {what}: accepted with {len(problems)} remaining problem(s)")
            return obj
        messages = (f"{prompt}\n\nYour previous reply did not pass the checks. Fix these problems and reply with "
                    f"the complete JSON again:\n{last}\n\nYour previous reply:\n{reply[:14000]}")
    raise LLMError(f"{what}: no valid output after {ATTEMPTS} attempts:\n{last}")


def _unique_id(base: str, taken: set[str]) -> str:
    base = re.sub(r"[^a-z0-9-]+", "-", base.lower()).strip("-") or "system"
    sid, n = base, 2
    while sid in taken:
        sid, n = f"{base}-{n}", n + 1
    return sid


def parse_outline(data: dict):
    o = Outline.model_validate(data)
    styles = [r.style for w in o.wings for r in w.rooms]
    problems = outline_problems(o)
    repeated = sorted({s for s in styles if styles.count(s) > 1})
    if repeated and len(styles) <= len(ROOM_STYLES):
        problems.append(f"room styles used more than once: {repeated}; give every room its own style")
    return o, problems


def parse_room(room: RoomPlan, all_ids: set[str]):
    def parse(data: dict):
        res = RoomExhibits.model_validate(data)
        want = [e.id for e in room.exhibits]
        got = [e.id for e in res.exhibits]
        problems = []
        if got != want:
            problems.append(f"write exactly the exhibits {want} in this order (got {got})")
        for e in res.exhibits:
            for link in e.links:
                if link.to not in all_ids or link.to == e.id:
                    problems.append(f"exhibit {e.id}: link to {link.to!r} is not another exhibit id of the outline")
        wing = Wing.model_validate({"id": "w", "title": {"en": "Wing", "zh": "分区"},
                                    "summary": {"en": "x" * 20, "zh": "测试摘要八个字"},
                                    "rooms": [{"id": room.id, "title": room.title, "summary": room.summary,
                                               "style": room.style, "exhibits": [e.model_dump() for e in res.exhibits]}]})
        problems += [p for p in text_problems([wing]) if not p.startswith("wing ") and not p.startswith("room ")]
        problems += scene_problems([wing])
        return res, problems
    return parse


async def generate_system(topic: str, provider: Provider, store: ContentStore, notes: str = "",
                          log: Log = lambda _: None) -> KnowledgeSystem:
    existing = list(store.load_systems().values())
    log(f"outline: designing '{topic}' with {provider.name}/{provider.model}")
    outline: Outline = await ask(provider, outline_prompt(topic, notes, existing), parse_outline, log, "outline",
                                 soft=True)
    outline.id = _unique_id(outline.id, {s.id for s in existing})
    log(f"outline: {outline.title.en} → {outline.architecture.template}, {len(outline.wings)} wings, "
        f"{sum(len(w.rooms) for w in outline.wings)} rooms, {len(outline.exhibit_ids())} exhibits")

    all_ids = set(outline.exhibit_ids())
    sem = asyncio.Semaphore(PARALLEL_ROOMS)
    planned = [(w, r) for w in outline.wings for r in w.rooms]

    async def one(w: WingPlan, r: RoomPlan) -> list[Exhibit]:
        async with sem:
            res: RoomExhibits = await ask(provider, room_prompt(outline, w, r, notes), parse_room(r, all_ids), log,
                                          f"room {r.title.en}", max_tokens=24000, soft=True)
            log(f"room: {w.title.en} / {r.title.en} — {len(res.exhibits)} exhibits")
            return res.exhibits

    results = await asyncio.gather(*(one(w, r) for w, r in planned))
    by_room = {r.id: ex for (w, r), ex in zip(planned, results)}
    data = outline.model_dump(exclude={"wings"})
    data["wings"] = [{
        "id": w.id, "title": w.title.model_dump(), "summary": w.summary.model_dump(),
        "rooms": [{"id": r.id, "title": r.title.model_dump(), "summary": r.summary.model_dump(), "style": r.style,
                   "exhibits": [e.model_dump(exclude_none=True) for e in by_room[r.id]]} for r in w.rooms],
    } for w in outline.wings]
    system = KnowledgeSystem.model_validate(data)

    cross: list[CrossLink] = []
    if existing:
        log("bridges: looking for links to the other systems")
        others = {f"{s.id}/{e.id}" for s in existing for e in s.exhibits()}

        def parse_bridges(d: dict):
            b = Bridges.model_validate(d)
            out, problems = [], []
            for item in b.crosslinks[:12]:
                src, dst = item.get("from"), item.get("to")
                try:
                    rel = T.model_validate(item.get("relation"))
                except ValidationError:
                    problems.append(f"relation of {src} -> {dst} must be {{'en': ..., 'zh': ...}}")
                    continue
                if src not in all_ids or dst not in others:
                    problems.append(f"{src} -> {dst}: unknown exhibit")
                    continue
                problems += rel.check("relation")
                out.append(CrossLink(source=f"{system.id}/{src}", target=dst, relation=rel))
            return out, problems

        cross = await ask(provider, bridges_prompt(system, existing), parse_bridges, log, "bridges", soft=True)
    store.save_system(system)
    if cross:
        cl = store.load_crosslinks()
        cl.links.extend(cross)
        store.save_crosslinks(cl)
    log(f"done: {system.id} with {len(system.exhibits())} exhibits and {len(cross)} cross links")
    return system
