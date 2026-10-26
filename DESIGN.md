# Memory Palace — Design

> **This document is the brief for the whole project.** It is written so that an implementing agent can work from it, alone, indefinitely, without further direction from the author. Read it in full before touching anything, follow it, and keep §11 (status) and §10 (decisions) current. If something is unclear, decide in the spirit of §3 and record the decision in §10 — do not stop to ask.

## 1. What this is

A walkable, realistic 3D world of **architecture**: buildings of every age, civilization and style, each built after real examples and planned the way the real thing was actually used — a temple, a cathedral, a bathhouse, a mosque, a palace hall, a monastery, a theatre, a railway station, a library — with rich, finely detailed interiors, real materials, real light and shadow, and music in the manner of the building's civilization and time.

The name is kept because it is apt in a second sense: these buildings are the memory of civilizations — each one holds centuries of use, belief and story. A visitor who walks them learns them; anyone who wants to use them as a memory palace in the classical sense can, because a well-planned building already gives every room and object a place and an order. **But the project builds buildings, not a study tool**: there are no notes, no markers, no numbered stops, no features about memory at all.

The world is **completely free**: you walk where you like. If a building has a route, it is conveyed the way real buildings convey it — by axis, threshold, light, sequence of rooms — never by signs, numbers or highlights.

**Live site:** https://alexw6385.github.io/Memory-Palace/

## 2. What this is NOT

- **Not a note-taking or study app.** No annotations, no binding of knowledge to objects, no spaced repetition, no "places" list of loci, no numbered route, no N/B stepping. The earlier versions had these; they are gone and stay gone.
- **Not a game.** No objectives, collectibles, puzzles or NPC dialogue.
- **Not cartoon or simplified.** The look is realistic: true proportions, physically based materials, global-illumination-quality lighting, decoration at the density the real buildings have. The former "refined toy diorama" style is retired.
- **Not invented architecture.** Every building follows a real building type and, by default, a specific real example, with sources. Variation and composition are allowed; "fantasy" styles are not.
- **Not a product for every device.** Targets the author's own computer and phone, both with WebGPU.
- **Not connected** to the author's other projects (绒球世界, 展览馆); no shared code or obligations.

## 3. What to get right, in order

When goals conflict, resolve in this order.

1. **Architecturally true.** Plan, section, structure, proportion, materials and decoration follow the real building type and example. The building must make sense as a building: rooms where they belong, for the reasons they were there. This is both the point of the project and what makes a building memorable.
2. **Realistic and beautiful.** Materials, light, shadow and detail as close to real as the web allows. Quality may win over smoothness within reason; it must not be unplayably laggy on the author's machine. Optimise, bake and cache before lowering quality.
3. **Rich.** Many buildings, many civilizations, many eras; dense interiors; more is better; there is no "enough".
4. **Free and quiet.** Walk, look, a map to jump between buildings, a few settings. Nothing else on screen. The architecture does the guiding.
5. **Light to load.** Budgets in §6.

## 4. The building dossiers (archive)

Before a building is built, its dossier is written. Dossiers live in this repo under `docs/buildings/<id>.md` (English; they contain no copyrighted text, only our own notes and references).

Each dossier records, with sources: the real example(s) it follows (name, place, dates, builders); the building type and its typology; the plan with dimensions (overall, each room, wall thicknesses, column spacing, storey heights); the section and structural system; the sequence of spaces and how the building was used (who entered where, what happened in each room); materials and finishes per surface; the decorative programme (orders, mouldings, reliefs, paintings, inscriptions, furnishings) and where each element belongs; lighting (openings, orientation, lamps); surroundings (precinct, gardens, approach, neighbouring buildings); the music of its civilization and period (scales, instruments, forms, tempo, where music was heard in such buildings); and what is **[stated]** by sources versus **[inferred]** by us.

Sources: architectural histories and typologies, published plans and surveys, museum and heritage-site documentation, scholarly articles, Wikipedia for orientation. Cite them. Drawings and photographs are references to study, never assets to copy.

Rule: no building or major change is built without its dossier. Reading the dossier should be enough to rebuild the building from scratch.

## 5. Architecture

- **Pure JavaScript, static.** No Python, no bundler, no server. ES modules served as-is from GitHub Pages; three.js from a CDN. Node is used only for tests and offline baking. (The Python planner, `world.json` pipeline and parity tests are retired — see §10.)
- **Plan is data, look is code.** Each building is a module under `src/buildings/<id>/` with (a) its plan — walls, openings, floors, levels, roofs, vaults, columns, furnishings and decoration as placed data in metres — and (b) its style modules — the civilization's architectural vocabulary (orders, mouldings, capitals, arches, vaults, window types, surface treatments) as reusable generators under `src/styles/<civilization>/`. A new building of a known civilization mostly reuses its style modules.
- **Renderer: three.js WebGPU.** PBR materials; GTAO; cascaded shadow maps for sun; **baked lighting** for interiors (lightmaps and light probes computed offline in Node or in a baking page, shipped as compressed textures) combined with real-time direct light and shadows; screen-space or probe reflections for polished surfaces; bloom and tone mapping. Browsers without WebGPU get a notice.
- **Materials and assets.** PBR material sets (stone, marble, brick, timber, plaster, gold leaf, textiles, glass) from CC0 sources (Poly Haven, ambientCG), loaded from CDN and listed in `ASSETS.md`. Decorative elements are generated (profiles swept along paths, lathes, instanced ornaments, relief via displacement/normal maps) and, where generation cannot reach the quality, CC0 scanned pieces. No copyrighted models.
- **World layout.** Buildings stand in one continuous walkable world — districts by civilization or period, joined by streets, courts, gardens and water, so walking from one to the next is itself architecture. The layout is planned, not random; the agent designs it (§9) and records it in a world dossier (`docs/world.md`).
- **Navigation.** First-person walk, run, look; stairs, ramps and doors work; collision everywhere; a map that shows the districts and buildings and jumps to any building's entrance. Phone: joystick and drag. Nothing else.
- **Music.** Synthesised in the browser, per building and civilization: scale/mode, rhythm, instrumentation and form drawn from the dossier (e.g. plainchant-like lines under Gothic vaults, maqam-based lines in a mosque courtyard, gagaku-like textures in a Japanese temple), crossfading at thresholds, reacting to interior/exterior and time of day. Small CC0 instrument samples are allowed where synthesis cannot reach the timbre; listed in `ASSETS.md`.
- **Dev tooling.** Headless screenshot script at fixed viewpoints per building; a lighting-bake script; a plan-check script (walkability, every room reachable, every opening connects, no floating or intersecting elements).

## 6. Assets, baking and budgets

Use whatever makes the picture better, as long as the page stays light to load.

- Third-party assets: CC0/MIT only, via CDN, listed in `ASSETS.md`; never commit large third-party binaries.
- Baked data (lightmaps, probes, impostors, merged geometry) under `data/`, compressed (KTX2/Basis), **loaded per building/district on demand**, never all at startup; cached with content-hashed names and Cache Storage.
- Budgets (hard unless §10 records a change): initial load to first frame ≤ 15 MB and ≤ 5 s on the author's desktop; one building's on-demand data ≤ 25 MB; any committed file ≤ 50 MB, no Git LFS; whole repository ≤ 500 MB.
- Techniques worth studying for the renderer: three.js WebGPU + TSL examples; GPU culling with indirect draws for instanced ornament; `compileAsync` warm-up to avoid hitches when entering a building.

## 7. Constraints and rules

- Dossier first (§4). Every element in a building traces to its dossier.
- Units are metres; buildings at true scale.
- No memory/study features, no markers, no numbered routes, no on-screen labels in the world. The map may name buildings.
- UI stays: walk, look, map, settings. A new on-screen element needs a reason recorded in §10.
- Picture quality on the author's machine never goes down silently; a change that lowers it is recorded in §10 with the reason.
- Checks are tiered: per change, one screenshot of the thing changed and the plan-check script; per task end and before every release, screenshots at all fixed viewpoints compared with the previous set, the budget check and a walk through every building on both layouts; only for high-risk changes (renderer, lighting pipeline, module structure) full comparison after each step. Tool output is summarised, never pasted whole into the working context.
- Repository text (code, docs, commits) in English; the site's UI bilingual, English default, Chinese available.
- Commits are authored as the repository owner (Alex Wang <alex119122114@gmail.com>) with no AI co-author or session trailers; messages in English, saying what changed and why.

## 8. Depth is layered

Build each building to L1, then deepen; never leave a building at a lower level than the previous one for long.

**Per building**
- L1 — correct plan, section, structure and proportions; walkable; main surfaces with correct materials; daylight through real openings; its music.
- L2 — the full decorative programme: orders, mouldings, capitals, vaults, ceilings, floors, doors, windows, as the dossier gives them; baked lighting; furnishings and fittings in place.
- L3 — fine detail: reliefs, inscriptions, paintings (original work in the manner of, never copies of specific copyrighted reproductions), textiles, wear and patina, small objects of use; precise light (lamps, candles, coloured glass).
- L4 — surroundings: precinct, gardens, approach, neighbouring structures; life in the building where the dossier describes it (people and animals as figures, sound).

**World**
- L1 — a first district with the first buildings joined by a street or court; the map.
- L2 — districts for several civilizations; streets, squares, gardens, water; walking between buildings is itself designed.
- L3 — the world as a whole reads as a planned city of civilizations; vistas, axes and thresholds between districts; time of day and weather.

**Visual**
- L1 — PBR materials, sun shadows, GTAO, tone mapping.
- L2 — baked GI for interiors, probes, reflections on polished surfaces, bloom; wet and worn material response.
- L3 — set pieces: light through stained glass, incense haze, candlelit halls, moonlit courts.

## 9. Decisions delegated to the implementing agent

Decide without asking, within the rules; record each in §10.

- The world layout (districts, how civilizations sit together, streets, water) and the order of civilizations and buildings — from architectural importance and variety, aiming for breadth across eras and cultures early.
- Which real buildings to follow for each type, and how much to compose or vary.
- Module layout, the style-generator design, the lighting bake method, which assets to use.
- What to do with the existing Edfu temple: its plan and dossier-grade reasoning are good; rebuild it to the new look and structure as the first building, dropping the loci UI.
- Any implementation detail not fixed here.

## 10. Decisions log

Append-only: date, decision, reason.

- 2026-10 — Rebuilt from scratch as a memory palace, replacing the Knowledge Universe. Reason: spatial, built places are what memory needs; graph/RAG was the wrong tool.
- 2026-10 — Buildings must be real, functional, planned designs. Reason: only that holds memory and interest.
- 2026-10 — Renamed to Memory Palace; bilingual with English primary.
- 2026-10-26 — The project is a world of architecture across civilizations and eras; "memory palace" is the name and the inspiration, not a feature. No notes, markers, numbered routes or study tools. Reason: author's vision; the architecture itself is the point.
- 2026-10-26 — The world is completely free to walk; routes are conveyed only by design, as in real buildings. Reason: explicit markers feel contrived.
- 2026-10-26 — Realistic look adopted (PBR, baked GI, light and shadow); the toy-diorama style and `docs/modeling-guide.md` are retired. Reason: author's instruction.
- 2026-10-26 — Pure JavaScript; the Python planner, `world.json` pipeline and parity tests are retired. Reason: no LLM generation needed; one language halves the work.
- 2026-10-26 — LLM-driven runtime generation dropped; the implementing agent is the designer. Reason: same result, no keys, no server.
- 2026-10-26 — Each building follows a real example with a sourced dossier (`docs/buildings/`). Reason: truth and memorability; researchable.
- 2026-10-26 — Music synthesised per building from its civilization and period. Reason: author's wish; keeps the site asset-free.
- 2026-10-26 — Open-ended: keep adding buildings and depth indefinitely; release in versions.
- 2026-10-26 — This document is the brief for autonomous work; the agent decides §9 items itself.
- 2026-10-26 — Without WebGPU the site still runs, on three.js's WebGL 2 backend, with a notice. Reason: same TSL code path; better than a dead page on older browsers and in headless test runs.
- 2026-10-26 — Materials are procedural TSL shaders (ashlar, drums, paving, granite, cedar, metal, ground, water) rather than CDN texture sets for now. Reason: masonry must follow each wall's real coursing and block sizes from the dossier, which a tiling photo texture cannot; it also keeps loads small and needs no third-party assets. CC0 scanned sets may be layered in later for micro-detail.
- 2026-10-26 — Baked indirect light is an irradiance volume per building: L1 spherical-harmonic probes on a 1 m grid, ray traced offline in Node (three-mesh-bvh) with sun, sky, oil lamps and two bounces; sampled per fragment and also used for blurry reflections. Shipped as half-float data compressed by HTTP gzip, not KTX2 (KTX2/Basis is for colour textures). Lightmaps may follow at Visual L2 where volumes are too coarse. Reason: no UV unwrapping, robust for procedural geometry, fast to bake (minutes).
- 2026-10-26 — Eye adaptation driven by the baked ambient light at the viewer (up to ~3 stops). Reason: a fixed exposure leaves sanctuaries black or courts blown out; real eyes adapt.
- 2026-10-26 — One fixed time of day (clear mid-morning, sun azimuth 115°, elevation 38°) because baked light depends on it. Time of day (World L3) will need a bake per time.
- 2026-10-26 — Interface uses system fonts; no web fonts. Reason: Google Fonts are OFL, not CC0/MIT.
- 2026-10-26 — The world is a city of civilizations along a river running north–south (docs/world.md); the Nile district comes first, with Edfu at the origin in its true orientation. The river is brought closer to Edfu than in reality so the district reads as a river city.
- 2026-10-26 — Edfu is shown complete and in use (57 BC), with unpainted stone until L3 (extent of original paint uncertain). Published dimensions conflict (UNESCO 47 m width vs a 40 m pronaos); we take a 50 m enclosure (docs/buildings/edfu.md §4).
- 2026-10-26 — Edfu's roof stairs and roof terrace, the New Year court, the nilometer and the pylon's internal stairs are deferred to L2 of the building; the mammisi is a separate building for later.

## 11. Roadmap and status

The implementing agent updates this section at the end of every session. Phases run in order; within a phase, order is the agent's choice. A phase is done when its items are built, pass the release-tier checks of §7, are pushed, and the live site works on desktop and phone.

**Status — 2026-10-26 (v5.0)**
- Phase 0 done: pure-JS ES modules (`src/core`, `src/engine`, `src/styles`, `src/buildings`, `src/ui`), WebGPU renderer with WebGL 2 fallback, procedural PBR materials, cascaded sun shadows, GTAO, bloom, AgX tone mapping, eye adaptation, first-person walking with collision, steps and ramps, map, settings, bilingual UI. Python package, `world.json` pipeline, loci UI, props catalogue and modeling guide removed. README (both languages), `ASSETS.md`, `docs/world.md`, `CHANGELOG.md`; tools: `tools/shot.mjs` (fixed viewpoints, headless WebGPU via SwiftShader), `tools/plan-check.mjs`, `tools/bake.mjs`, `tools/budget.mjs`.
- Lighting pipeline done: offline bake to an irradiance volume (sun, sky, lamps, two bounces), verified on Edfu's halls.
- Phase 1 in progress: Edfu dossier rewritten to §4 standard; Edfu rebuilt at Building L1 (plan, section, structure, materials, daylight, lamps, music) plus parts of L2 (torus and cornices, door frames with winged discs, uraeus frieze, cedar doors, naos, barque). World L1: the Nile district with the river.
- Known gaps: Edfu L2 still lacks the roof stairs and terrace, the New Year court, the nilometer, a finer barque and naos, ceiling slabs' decoration, door leaves on inner doors; palms are coarse; paving joints too regular. Budget: initial load 5.2 MB.

**Done (previous version, replaced)**
- Python planner, Edfu temple plan with 47 loci, three.js viewer with loci UI, toy-style props, bilingual UI, Pages deployment.

**Phase 0 — New foundation**
- New repo structure: pure JS ES modules, WebGPU renderer, PBR material loading, GTAO, shadows, first-person navigation with collision and stairs, map, settings, bilingual UI. Remove the Python package, `world.json` pipeline, loci UI, props catalogue and modeling guide; update README (both languages) to the new description; add `ASSETS.md`, `docs/world.md` (initial), the screenshot, plan-check and bake scripts.
- Lighting pipeline: offline bake producing lightmaps/probes; verify on a test room.

**Phase 1 — The first building, as the quality bar**
- Rewrite the Edfu dossier to §4 standard. Rebuild the Temple of Horus at Edfu to Building L1 → L2 with the new renderer, materials and baked light; its music. This building sets the bar every later one must meet.

**Phase 2 — Breadth: one building per major tradition**
- Plan the world layout (`docs/world.md`). Add, each to L1 then L2 with dossier and music, a first building from each of a wide spread of traditions — e.g. Greek, Roman, Byzantine, Islamic, Romanesque, Gothic, Renaissance, Chinese, Japanese, Indian, Mesoamerican, Baroque, 19th-century iron-and-glass, early Modern — in the order the agent judges best for variety and importance. World L1 → L2.

**Phase 3 — Depth**
- All buildings to L3; Visual L2 → L3; World L3.

**Phase 4 onward — Keep going**
- No final state. Loop: add buildings (more examples within each tradition, more traditions and periods, vernacular and civic types as well as monumental), deepen existing ones to L4, improve materials, light and music. Prefer what adds the most architectural truth and richness per unit of work. Stop only when the author says so.

## 12. Releases

Every push to the default branch deploys to GitHub Pages. In addition, cut a **release** whenever a meaningful chunk is done — a phase, a new building, a visible quality jump:
- Tag `vMAJOR.MINOR` and create a GitHub release with a short note and a few screenshots.
- Keep `CHANGELOG.md`, newest first, in plain language (what you can now visit, what looks better), not a list of commits.
- Never release with a known regression in the picture, a broken walk, or a budget breach; fix first.
