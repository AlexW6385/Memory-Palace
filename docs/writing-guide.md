# Writing guide for exhibits

This guide defines what a good exhibit looks like. Human authors and the LLM generation pipeline both follow it.

The Memory Palace works by the **method of loci**. People remember places, and they remember vivid, strange,
concrete scenes. Every knowledge point therefore gets a fixed place in the world and a small 3D scene that
*shows* the idea. A visitor who later pictures the scene should be able to recover the idea from it.

## Audience and voice

- Readers are university students and engineers: a strong undergraduate in computer science.
- English is the primary language. Write plain, precise English: short sentences, no hype, no filler.
- Chinese is a full parallel version, not a word-for-word translation. Write natural Chinese and keep the
  standard Chinese terminology. Put the English term in parentheses on first use where it helps, for example
  特征值（eigenvalue）.
- Accuracy comes first. Use standard textbook statements with their hypotheses. Where interpretations differ
  (Hegel, history), give the mainstream reading. Do not invent statistics, dates, product names or quotations.

## Fields

Each field holds `{"en": "...", "zh": "..."}`. Character limits are checked by the validator.

| field | purpose | English | Chinese |
|---|---|---|---|
| `title` | the name of the idea | 3–56 | 2–22 |
| `summary` | the idea in one line | 20–150 | 8–64 |
| `explain` | what it is, why it holds or matters, how it connects to neighbours | 180–760 | 70–320 |
| `example` | one concrete worked example with real numbers, code or a case | 60–460 | 25–210 |
| `image` | the memory scene, told as a short vivid story | 100–460 | 40–200 |
| `cues` | 2–5 pairs `{thing, means}` mapping objects in the scene to parts of the idea | ≤48 / ≤110 | ≤20 / ≤48 |
| `keywords` | 2–6 search terms | ≤32 | ≤14 |
| `emoji` | one emoji for the card | | |
| `links` | up to 4 `{to, relation}` pointing to other exhibits in the same system | relation ≤26 | ≤10 |

`explain` and `example` are plain text with no markdown. Simple notation in Unicode is fine, for example
∀ε>0, aⁿ, O(n log n) or softmax(QKᵀ/√d)V.

## The memory scene

The `image` text and the `scene` must describe the **same** scene. The scene is built from catalogue props
(see [props.md](props.md)) on a round stage in front of a curved backdrop.

What makes a scene memorable:

1. **One central action that *is* the idea.** Pigeons fighting over a cage *is* the pigeonhole principle. Avoid
   decoration that merely sits next to a topic.
2. **Concrete things, not symbols.** Show a thing doing something. Use the backdrop glyph for the formula.
3. **Exaggeration, motion and a little absurdity.** Use giant objects, odd combinations, a character with an
   attitude. Use at most one or two animated items.
4. **Every important object stands for something.** List those mappings in `cues`. Use counts literally when the
   numbers matter, for example 5 pigeons and 4 cages.
5. **Colour with meaning.** For example red for an error, gold for value and green for "accepted".
6. **Keep it visual.** Use at most two props with text, and keep that text short. The backdrop `glyph` (up to
   14 characters) carries the key formula or term.
7. **Distinctive within the system.** Do not lead two scenes with the same central prop. Vary composition and
   characters.
8. **Fit the room when it helps.** A room's style (casino, post office, harbour) is a memory cue too, so props
   from that world are welcome. Clarity of the idea always comes first.

## Scene format

```json
"scene": {
  "backdrop": {"glyph": "n+1 > n", "pattern": "grid"},
  "items": [
    {"prop": "cage", "variant": "box", "count": 4, "arrange": "row", "spacing": 0.5, "at": [0, -0.35]},
    {"prop": "bird", "variant": "pigeon", "count": 3, "arrange": "row", "spacing": 0.5, "at": [-0.25, -0.35],
     "on": 0, "scale": 0.75},
    {"prop": "bird", "variant": "pigeon", "at": [0.63, -0.35], "on": 0, "scale": 0.6, "rot": 40, "anim": "hop"},
    {"prop": "bird", "variant": "pigeon", "at": [0.87, -0.35], "on": 0, "scale": 0.6, "rot": -40},
    {"prop": "figure", "pose": "point", "hat": "cap", "at": [-0.75, 0.55], "rot": 30, "color": "#2f6fb0"}
  ]
}
```

Stage coordinates are in metres:

- `x` runs to the viewer's right and `z` runs towards the viewer.
- The stage is a disc of radius 1.35. Item centres must lie within radius 1.25 and at `z ≥ -1.05`. Footprints may
  not reach beyond radius 1.55.
- The visitor stands about 3.4 m in front, at eye height, looking slightly down. Put the central element in
  the middle or back (`z` from −0.6 to 0.1). Keep tall things out of the front row so they do not hide it.
- `rot` is in degrees around the vertical axis. 0 faces the viewer, 90 faces the viewer's right and −90 faces
  the left.
- `scale` runs from 0.2 to 3. A figure is 0.95 m tall, so scale small props up when they matter (a giant key,
  a huge coin).
- `y` lifts an item, for example floating props such as clouds and speech bubbles. `on: i` stands an item on top
  of earlier item `i`, for example a bird on a cage or a book on a table.
- A figure with pose `sit` sits at seat height (0.45 m). To seat it, give it the same `at` as a `chair`, `bench` or
  `throne` (do not use `on`).
- `count` with `arrange` repeats an item:
  - `row` spaces copies along x and `column` along z.
  - `grid` uses `cols`.
  - `ring` places copies around a circle (`radius`, `face`: viewer/center/out).
  - `arc` places copies on a curve behind the centre.
  - `stack` piles copies vertically.
  - `scatter` spreads copies loosely.
  - `spacing` is the distance between copies.
- `color` and `color2` are `#rrggbb` overrides. `variant`, `pose`, `hat`, `hold`, `text` and `emoji` must be
  valid for the prop.
- `text` is either language-neutral (`"P(A|B)"`) or `{"en": ..., "zh": ...}`. Text should be short: a word, a
  number or a tiny formula.
- `cutout` shows a single emoji on a cardboard standee. Use it only when no prop fits, and at most once per
  scene.

The validator rejects items that hang off the stage or collide. Fix collisions by moving items apart, lowering
`scale`, increasing `spacing` or `radius`, or stacking with `on`.

## Links

Link to other exhibits of the same system when the relation is real and useful. Examples: *requires*, *leads
to*, *generalises*, *contrasts with*, *example of*, *used by*. Give each relation in both languages. Cross-system
links are curated separately.

## A complete example

```json
{
  "id": "pigeonhole",
  "title": {"en": "The Pigeonhole Principle", "zh": "鸽巢原理"},
  "summary": {"en": "Put n + 1 objects into n boxes and some box must hold at least two.",
              "zh": "把 n+1 个物体放进 n 个盒子，必有一个盒子至少装两个。"},
  "explain": {"en": "If more objects than boxes are distributed, at least one box receives two or more. More generally, N objects in k boxes force some box to hold at least ⌈N/k⌉. The principle proves that something exists without saying where, which makes it a quick tool for existence proofs in combinatorics, number theory and computer science.",
              "zh": "物体比盒子多时，至少有一个盒子装进两个或更多。推广形式：N 个物体放进 k 个盒子，必有一个盒子至少装 ⌈N/k⌉ 个。它只证明“存在”而不指出在哪里，是组合、数论和计算机科学里常用的存在性证明工具。"},
  "example": {"en": "Among any 13 people, two share a birth month: 13 people, 12 months. A hash table with 1,000 buckets that stores 1,001 keys must have a collision.",
              "zh": "任意 13 个人中必有两人同月出生：13 人、12 个月。1000 个桶的哈希表存 1001 个键，必然发生冲突。"},
  "image": {"en": "Five grey pigeons flutter down onto four wooden cages. Three cages get one bird each; on the last cage two pigeons are squeezed together, hopping and pecking at each other. A keeper in a blue cap points at the crowded cage.",
            "zh": "五只灰鸽扑棱棱落在四个木笼上。三个笼子各站一只；最后一个笼子上挤着两只，跳来跳去互相啄。戴蓝帽的饲养员指着那个挤满的笼子。"},
  "cues": [
    {"thing": {"en": "4 cages", "zh": "4 个笼子"}, "means": {"en": "n boxes", "zh": "n 个盒子"}},
    {"thing": {"en": "5 pigeons", "zh": "5 只鸽子"}, "means": {"en": "n + 1 objects", "zh": "n+1 个物体"}},
    {"thing": {"en": "the two squabbling birds", "zh": "打架的两只鸽子"},
     "means": {"en": "some box must hold two", "zh": "必有一个盒子装两个"}}
  ],
  "keywords": [{"en": "existence proof", "zh": "存在性证明"}, {"en": "ceiling N/k", "zh": "上取整"}],
  "emoji": "🕊️",
  "scene": { "...": "as in the scene format above" },
  "links": [{"to": "sum-and-product", "relation": {"en": "uses counting", "zh": "用到计数"}}]
}
```
