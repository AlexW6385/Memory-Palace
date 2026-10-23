"""Have an LLM design a new knowledge system, in three passes.

1. outline  – title, architecture template, wings and rooms (what each covers)
2. rooms    – the exhibits of every room, written in parallel
3. links    – relations between exhibits, inside the system and to existing systems

Every reply is parsed as JSON and validated; on a validation error the model
gets the error back and another try.
"""
from __future__ import annotations

import asyncio
import json
import re
from typing import Callable

from pydantic import BaseModel, Field, ValidationError, field_validator

from palace.content import ContentStore
from palace.llm.base import LLMError, Provider, extract_json
from palace.schema import (
    HEX_COLOR, LIMITS, SLUG, Architecture, CrossLink, CrossLinks, Exhibit, KnowledgeSystem, Link,
)
from palace.symbols import SYMBOLS, TEMPLATES

ATTEMPTS = 3
PARALLEL_ROOMS = 4
Log = Callable[[str], None]


# ── outline model ────────────────────────────────────────────────────────────

class RoomPlan(BaseModel):
    id: str = Field(pattern=SLUG)
    title: str = Field(min_length=1, max_length=16)
    summary: str = Field(min_length=4, max_length=60)
    focus: str = Field(min_length=4, max_length=200)
    exhibits: int = Field(ge=LIMITS["exhibits_per_room"][0], le=LIMITS["exhibits_per_room"][1])


class WingPlan(BaseModel):
    id: str = Field(pattern=SLUG)
    title: str = Field(min_length=1, max_length=16)
    summary: str = Field(min_length=4, max_length=80)
    rooms: list[RoomPlan]

    @field_validator("rooms")
    @classmethod
    def _count(cls, v):
        lo, hi = LIMITS["rooms_per_wing"]
        if not lo <= len(v) <= hi:
            raise ValueError(f"a wing needs {lo}-{hi} rooms")
        return v


class Outline(BaseModel):
    id: str = Field(pattern=SLUG)
    title: str = Field(min_length=1, max_length=20)
    subtitle: str = Field(min_length=1, max_length=40)
    description: str = Field(min_length=10, max_length=300)
    color: str = Field(pattern=HEX_COLOR)
    architecture: Architecture
    wings: list[WingPlan]

    @field_validator("wings")
    @classmethod
    def _count(cls, v):
        lo, hi = LIMITS["wings"]
        if not lo <= len(v) <= hi:
            raise ValueError(f"a system needs {lo}-{hi} wings")
        total = sum(r.exhibits for w in v for r in w.rooms)
        lo, hi = LIMITS["exhibits_total"]
        if not lo <= total <= hi:
            raise ValueError(f"the exhibits add up to {total}; keep the total within {lo}-{hi}")
        return v


class RoomExhibits(BaseModel):
    exhibits: list[Exhibit]


class LinkPlan(BaseModel):
    links: list[dict] = Field(default_factory=list)
    crosslinks: list[dict] = Field(default_factory=list)


# ── prompts ──────────────────────────────────────────────────────────────────

SYSTEM = """你是一座“记忆宫殿”的总设计师。这个应用把一个知识体系建成可以在浏览器里漫游的三维建筑：
每个分区（wing）是建筑的一部分，每个展厅（room）放几件展品（exhibit），每件展品是一个知识点，
立在展台上，有一个三维符号、一个 emoji、标题，以及一张写着讲解和“记忆画面”的卡片。
访客只是走一走、看一看，就该记住每个知识点在哪里、讲的是什么。

写作要求：
- 使用与主题相同的语言；没有特别说明时用简体中文，术语可在括号里附英文。
- 内容必须准确，按教科书或主流理解；不确定的就不写。个人主题（经历、项目、计划）只能依据用户提供的材料，不能编造事实。
- 顺序就是参观路线：按最自然的学习或发展顺序排列。
- 只输出一个 JSON 对象，不要输出别的文字。"""

EXHIBIT_RULES = f"""每件展品的字段：
- id：小写英文短横线 slug，在整个体系里唯一且有意义
- title：≤16 字的名词短语
- summary：≤40 字，一句话点出核心
- detail：120–380 字的讲解：是什么、为什么重要、一个具体的例子或公式；纯文本，不用 markdown
- image：30–150 字的记忆画面——夸张、具体、有动作和感官细节，把核心意思编码进画面里，
  回想起画面就能想起内容；尽量用上展品的符号或 emoji；每件展品的画面都不同，绝不空泛
- keywords：2–5 个，每个 ≤16 字
- emoji：一个最能唤起它的 emoji
- symbol：从下面挑一个最贴切的三维符号名：
{json.dumps(SYMBOLS, ensure_ascii=False, indent=1)}"""


def outline_prompt(topic: str, notes: str, existing: list[KnowledgeSystem]) -> str:
    lo_w, hi_w = LIMITS["wings"]
    lo_r, hi_r = LIMITS["rooms_per_wing"]
    lo_e, hi_e = LIMITS["exhibits_per_room"]
    taken = ", ".join(f"{s.id}（{s.title}）" for s in existing) or "无"
    return f"""为下面的主题设计一个新的知识体系的大纲。

主题：{topic}
用户提供的材料或要求：
{notes or "（无）"}

宫殿里已有的体系（id 不能重复）：{taken}

建筑模板（architecture.template）从中选一个最贴合这个体系结构的：
{json.dumps(TEMPLATES, ensure_ascii=False, indent=1)}

规模：{lo_w}–{hi_w} 个分区，每个分区 {lo_r}–{hi_r} 个展厅，每个展厅 {lo_e}–{hi_e} 件展品，
展品总数 40–65 件为宜（主题小就少一些，但总数不少于 {LIMITS["exhibits_total"][0]}）。

输出 JSON：
{{
  "id": "英文 slug", "title": "≤20 字", "subtitle": "≤40 字", "description": "≤300 字",
  "color": "#rrggbb（这个体系的主色，饱和度适中）",
  "architecture": {{"template": "模板名", "metaphor": "≤40 字，描述这座建筑"}},
  "wings": [
    {{"id": "slug", "title": "≤16 字", "summary": "≤80 字",
      "rooms": [{{"id": "slug", "title": "≤16 字", "summary": "≤60 字",
                 "focus": "这个展厅要讲哪些知识点，≤200 字", "exhibits": 展品数}}]}}
  ]
}}"""


def room_prompt(outline: Outline, wing: WingPlan, room: RoomPlan, notes: str, taken_ids: list[str]) -> str:
    plan = [{"wing": w.title, "rooms": [r.title for r in w.rooms]} for w in outline.wings]
    return f"""体系：{outline.title}——{outline.subtitle}
全体系大纲（帮助你避免和其他展厅重复）：{json.dumps(plan, ensure_ascii=False)}

现在请写：分区「{wing.title}」里的展厅「{room.title}」（{room.summary}）
这个展厅要讲：{room.focus}
展品数：正好 {room.exhibits} 件，按参观顺序排列。
用户材料：{notes or "（无）"}

{EXHIBIT_RULES}

这些 id 已被其他展厅占用，不要再用：{", ".join(taken_ids) or "无"}

输出 JSON：{{"exhibits": [{{"id": ..., "title": ..., "summary": ..., "detail": ..., "image": ...,
"keywords": [...], "emoji": ..., "symbol": ..., "links": []}}]}}"""


def links_prompt(system: KnowledgeSystem, others: list[KnowledgeSystem]) -> str:
    mine = [{"id": e.id, "title": e.title, "summary": e.summary} for e in system.exhibits()]
    theirs = [{"ref": f"{s.id}/{e.id}", "title": e.title} for s in others for e in s.exhibits()]
    return f"""体系「{system.title}」的展品如下：
{json.dumps(mine, ensure_ascii=False)}

宫殿里其他体系的展品：
{json.dumps(theirs, ensure_ascii=False) if theirs else "（无）"}

请找出真实、有价值的关系（前提、推出、对比、应用、例子、实现、解决……），不要硬凑：
- links：本体系内部的关系，每件展品最多 3 条
- crosslinks：本体系展品与其他体系展品之间的关系，最多 12 条，只选最有启发的
relation 用 ≤12 字的短词。

输出 JSON：{{"links": [{{"from": "展品 id", "to": "展品 id", "relation": "..."}}],
"crosslinks": [{{"from": "本体系展品 id", "to": "其他体系的 ref", "relation": "..."}}]}}"""


# ── calls with validation and retry ──────────────────────────────────────────

async def ask(provider: Provider, prompt: str, model_cls: type[BaseModel], log: Log, what: str,
              check: Callable[[BaseModel], None] | None = None) -> BaseModel:
    messages = prompt
    last_err = ""
    for attempt in range(1, ATTEMPTS + 1):
        reply = await provider.complete(SYSTEM, messages)
        try:
            obj = model_cls.model_validate(extract_json(reply))
            if check:
                check(obj)
            return obj
        except (ValidationError, ValueError, json.JSONDecodeError) as e:
            last_err = str(e)[:1500]
            log(f"  {what}: attempt {attempt} rejected ({last_err.splitlines()[0][:120]})")
            messages = (f"{prompt}\n\n你上一次的输出没有通过校验，错误如下，请修正后重新输出完整 JSON：\n"
                        f"{last_err}\n\n你上一次的输出：\n{reply[:6000]}")
    raise LLMError(f"{what}: the model did not produce valid output after {ATTEMPTS} attempts: {last_err}")


def _unique_id(base: str, taken: set[str]) -> str:
    base = re.sub(r"[^a-z0-9-]+", "-", base.lower()).strip("-") or "system"
    sid, n = base, 2
    while sid in taken:
        sid, n = f"{base}-{n}", n + 1
    return sid


async def generate_system(topic: str, provider: Provider, store: ContentStore, notes: str = "",
                          log: Log = lambda _: None) -> KnowledgeSystem:
    existing = list(store.load_systems().values())
    log(f"outline: designing '{topic}' with {provider.name}/{provider.model}")
    outline: Outline = await ask(provider, outline_prompt(topic, notes, existing), Outline, log, "outline")
    outline.id = _unique_id(outline.id, {s.id for s in existing})
    log(f"outline: {outline.title} → {outline.architecture.template}, "
        f"{len(outline.wings)} wings, {sum(len(w.rooms) for w in outline.wings)} rooms")

    # rooms in parallel; ids are de-duplicated afterwards
    sem = asyncio.Semaphore(PARALLEL_ROOMS)
    planned = [(w, r) for w in outline.wings for r in w.rooms]

    async def one(w: WingPlan, r: RoomPlan) -> list[Exhibit]:
        async with sem:
            def count(obj: RoomExhibits) -> None:
                if not LIMITS["exhibits_per_room"][0] <= len(obj.exhibits) <= LIMITS["exhibits_per_room"][1]:
                    raise ValueError(f"write {r.exhibits} exhibits, not {len(obj.exhibits)}")
            res: RoomExhibits = await ask(provider, room_prompt(outline, w, r, notes, []), RoomExhibits, log,
                                          f"room {r.title}", check=count)
            log(f"room: {w.title} / {r.title} — {len(res.exhibits)} exhibits")
            return res.exhibits

    results = await asyncio.gather(*(one(w, r) for w, r in planned))
    taken: set[str] = set()
    rooms_out: dict[str, list[dict]] = {}
    for (w, r), exhibits in zip(planned, results):
        items = []
        for e in exhibits:
            d = e.model_dump()
            d["id"] = _unique_id(d["id"], taken)
            d["links"] = []
            taken.add(d["id"])
            items.append(d)
        rooms_out[r.id] = items

    data = outline.model_dump(exclude={"wings"})
    data["wings"] = [{"id": w.id, "title": w.title, "summary": w.summary,
                      "rooms": [{"id": r.id, "title": r.title, "summary": r.summary, "exhibits": rooms_out[r.id]}
                                for r in w.rooms]} for w in outline.wings]
    system = KnowledgeSystem.model_validate(data)

    # links
    log("links: looking for relations")
    plan: LinkPlan = await ask(provider, links_prompt(system, existing), LinkPlan, log, "links")
    system, cross = apply_links(system, plan, existing)
    store.save_system(system)
    if cross:
        cl = store.load_crosslinks()
        cl.links.extend(cross)
        store.save_crosslinks(cl)
    log(f"done: {system.id} with {len(system.exhibits())} exhibits and {len(cross)} cross links")
    return system


def apply_links(system: KnowledgeSystem, plan: LinkPlan, others: list[KnowledgeSystem]
                ) -> tuple[KnowledgeSystem, list[CrossLink]]:
    """Keep only well-formed links that point at real exhibits; cap three per exhibit."""
    ids = {e.id for e in system.exhibits()}
    other_refs = {f"{s.id}/{e.id}" for s in others for e in s.exhibits()}
    data = system.model_dump()
    by_id = {e["id"]: e for w in data["wings"] for r in w["rooms"] for e in r["exhibits"]}
    for item in plan.links:
        src, dst, rel = item.get("from"), item.get("to"), str(item.get("relation", ""))[:12]
        if src in ids and dst in ids and src != dst and rel:
            links = by_id[src]["links"]
            if len(links) < 3 and all(l["to"] != dst for l in links):
                links.append(Link(to=dst, relation=rel).model_dump())
    cross = []
    for item in plan.crosslinks[:12]:
        src, dst, rel = item.get("from"), item.get("to"), str(item.get("relation", ""))[:12]
        if src in ids and dst in other_refs and rel:
            cross.append(CrossLink(source=f"{system.id}/{src}", target=dst, relation=rel))
    return KnowledgeSystem.model_validate(data), cross
