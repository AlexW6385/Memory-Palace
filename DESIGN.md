# Memory Palace — Design

> **This document is the brief for the whole project.** It is written so that an implementing agent can work from it, alone, indefinitely, without further direction from the author. Read it in full before touching anything, follow it, and keep §11 (status) and §10 (decisions) current. If something is unclear, decide in the spirit of §3 and record the decision in §10 — do not stop to ask.

## 1. What this is

A walkable, realistic 3D world of **architecture**: buildings of every age, civilization and style, each built after real examples and planned the way the real thing was actually used — a temple, a cathedral, a bathhouse, a mosque, a palace hall, a monastery, a theatre, a railway station, a library — with rich, finely detailed interiors, real materials, real light and shadow, and music in the manner of the building's civilization and time.

The name is kept because it is apt in a second sense: these buildings are the memory of civilizations — each one holds centuries of use, belief and story. A visitor who walks them learns them; anyone who wants to use them as a memory palace in the classical sense can, because a well-planned building already gives every room and object a place and an order. **But the project builds buildings, not a study tool**: there are no notes, no markers, no numbered stops, no features about memory at all.

Every building stands in its own **region** — a small world of its own: the landform it was built on, the ground, plants and water of its country, the settlement or precinct around it, and its own sky: a time of day, a climate and weather that changes while you are there (Egyptian late-afternoon dust, an Athenian clear noon, a Roman morning with passing showers). Walking from one region to the next — over a ridge, along the river — is a passage between worlds.

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
- **World layout.** Buildings stand in one continuous walkable world of **regions**, one per civilization or period, each a self-contained landscape (terrain, ground, vegetation, water, settlement, roads) enclosed by natural boundaries (ridges, escarpments, water) and joined by passes and the river. The layout is planned, not random; the agent designs it (§9) and records it in a world dossier (`docs/world.md`); each region's landscape is recorded in its building's dossier (§4, surroundings) with sources.
- **Climate and weather.** Each region has its own sun (time of day, chosen per region and fixed so lighting can be baked), sky, haze and clouds, and a weather cycle drawn from its real climate (clear, fair, cloudy, overcast, showers, dust), with moving cloud shadows. Climate blends across region boundaries.
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
- 2026-10-26 — Terrain: one height function for the whole world (flat plain, river, rock landforms with cliffs and walkable slopes), meshed finely over landforms; open ground steeper than ~40° cannot be climbed. The Acropolis is 40 m high instead of ~70 m so the climb stays a short walk. Reason: districts need their real settings (an acropolis, later hills and harbours); buildings keep true scale, landscape is allowed to be compressed.
- 2026-10-26 — Greek order built straight (no stylobate curvature or column inclination) at L1–L2; entasis is modelled from a measured profile. Refinements recorded for L3. Reason: every element above the stylobate would have to follow the curvature.
- 2026-10-26 — Second building: the Parthenon, the canonical Doric temple, with the most published measurements of any Greek building.
- 2026-10-26 — Third building: the Pantheon (Roman Imperial; the Corinthian order, concrete vaulting, the coffered dome). New style module `src/styles/roman/` (Corinthian column, entablature with modillions, ring walls, niches, coffered dome with stepped coffers).
- 2026-10-26 — Buildings are built on demand: plans load at start, geometry and baked light within 650 m of the visitor. The budget check counts everything within that radius of the start as the initial load. Reason: §6 budgets as the world grows.
- 2026-10-26 — Regions (author's instruction): no building stands bare; each is a self-contained small world with its terrain, plants, settlement, light and weather. The world becomes a river valley whose regions are basins on the west bank divided by ridge spurs, each with its own fixed time of day and a weather cycle. Buildings are moved to their regions (Edfu at the origin; Rome north of it; Greece beyond). Exposure is lowered: the earlier picture was too bright.
- 2026-10-27 — Hagia Sophia in the state of 562 (Justinian's interior with Isidore the Younger's higher dome), without the Ottoman buttresses and minarets, so that the building is shown as one coherent design of its own age. Its domes, semidomes, exedrae and pendentives are modelled as spheres cut by planes (exact Byzantine geometry rather than approximations), and the axis is laid due east–west (the real one is turned about 33°). Arch springing (24.5 m) and dome base (40 m) inferred from the 55.6 m crown and the ~15 m rise of the 562 dome; pallasweb's 120 ft arch height is recorded as conflicting.
- 2026-10-27 — Plan check is multi-storey: a cell may be reached at several floor heights (galleries over aisles). Pads lie 12 cm below their base so paving never fights the ground.
- 2026-10-27 — The Dome of the Rock first among Islamic buildings: the oldest standing monument of the tradition and the bridge from Byzantine to Islamic building; shown as of 691/92 (Umayyad exterior mosaic instead of the Ottoman tiles; its colour inferred). The Islamic style reuses the Byzantine geometry (planar walls, cut spheres) and the Roman Corinthian column for the reused capitals. The world's regions continue northward (the Levant after Byzantium) so that each region keeps the river and a pass at both ends.
- 2026-10-27 — Start-up (author's request): no Enter button — the world opens when ready and the first click starts looking and the music (browsers need a gesture for both); a loading bar with stages and time left; only what is near is made before opening. Material parameters are uniforms and plant batches use instanced attributes so that shaders are shared (pipelines ~314 → ~89). The map travels to any point on the land.
- 2026-10-27 — Gothic begins with the Sainte-Chapelle (1248): the purest Rayonnant building and the most telling for light, compact enough to build to L2 at once; shown with a Rayonnant rose instead of the later Flamboyant one, and with a stair from the courtyard to the upper porch standing for the palace galleries. Stained glass is lit from behind (emissive) and colours the sun through `shadowMap.transmitted`; the baker passes rays through glass with its tint.
- 2026-10-26 — Edfu's roof stairs and roof terrace, the New Year court, the nilometer and the pylon's internal stairs are deferred to L2 of the building; the mammisi is a separate building for later.

## 11. Roadmap and status

The implementing agent updates this section at the end of every session. Phases run in order; within a phase, order is the agent's choice. A phase is done when its items are built, pass the release-tier checks of §7, are pushed, and the live site works on desktop and phone.

**Status — 2026-10-26 (v5.0)**
- Phase 0 done: pure-JS ES modules (`src/core`, `src/engine`, `src/styles`, `src/buildings`, `src/ui`), WebGPU renderer with WebGL 2 fallback, procedural PBR materials, cascaded sun shadows, GTAO, bloom, AgX tone mapping, eye adaptation, first-person walking with collision, steps and ramps, map, settings, bilingual UI. Python package, `world.json` pipeline, loci UI, props catalogue and modeling guide removed. README (both languages), `ASSETS.md`, `docs/world.md`, `CHANGELOG.md`; tools: `tools/shot.mjs` (fixed viewpoints, headless WebGPU via SwiftShader), `tools/plan-check.mjs`, `tools/bake.mjs`, `tools/budget.mjs`.
- Lighting pipeline done: offline bake to an irradiance volume (sun, sky, lamps, two bounces), verified on Edfu's halls.
- Phase 1 done: Edfu dossier rewritten to §4 standard; Edfu built to Building L2 — plan, section and structure at true scale; torus rolls and cavetto cornices; door frames with winged sun discs; uraeus frieze on the pronaos screen walls; cedar doors on the pylon and the inner halls; the naos and the sacred barque; both stairs to the roof (dog-leg, route inferred) and the walkable stepped roof; oil lamps baked into the inner rooms; music by zone. World L1: the Nile district with the river and palms.
- Edfu's L2 items still open (recorded, not blocking): the New Year court and kiosk, the nilometer, the pylon's internal stairs and chambers, the mammisi (separate building). L3 next: reliefs and inscriptions, painted ceilings.
- Checks: `npm test` runs the plan check and a walk-through of every building's routes (`tools/walk-check.mjs`, same body and movement as the viewer). Budget: initial load 5.2 MB; Edfu's baked light 4.3 MB.
- Phase 2 in progress (2026-10-26): terrain (one height function; the Acropolis plateau); the Parthenon (Greek Doric, Building L2: the full order with entasis, pediments, coffered pteron, two-tier interior colonnade, Athena Parthenos massing, pool, Ionic west room); the Pantheon (Roman, Building L2: portico of 16 Corinthian columns in three aisles, intermediate block with the second pediment, bronze doors, rotunda with seven niches and eight aediculae, opus sectile floor, coffered dome of 140 stepped coffers and open oculus, stepped and gilt-bronze exterior). On-demand building load. Budget: initial load 8.6 MB.

- Regions (2026-10-26, v5.2): the world is a river valley with one basin per civilization (Nile, Rome, Greece), separated by ridge spurs with passes and joined by roads; chunked LOD terrain built in workers; ground cover by region (sand, fields, grass, red earth, rock, silt, roads); procedural vegetation (14 species, instanced, LOD, wind); the town of Edfu (381 mud-brick houses, `src/world/features/`); per-region climate (fixed sun, sky, haze, exposure) with a weather cycle (clouds and their shadows, dust, rain with wet ground, wind); ambience sounds; the Pantheon's forecourt porticoes. All three bakes redone with their regions' suns. Budget: initial load 5.2 MB.
- Byzantium (2026-10-27, v5.3): a fourth region north of Greece over the pass of Parnes — the city's hills above the water, a grey maritime climate (drizzle, sea mist, the poyraz), cypresses, plane trees, figs, gardens, a town of ~500 tiled houses with jettied upper storeys. **Hagia Sophia** (Byzantine, Building L2): pendentive dome with its 40 windows and ribs, semidomes, four exedrae with porphyry and verde antico colonnades, two-storey aisles and galleries reached by the ramp tower, tympana with 24 windows, apse with synthronon, bema and ciborium, chancel screen, ambo and solea, polykandela, the two narthexes, the atrium with its phiale, the Augustaion square; gold mosaic, book-matched revetment and Proconnesian floor materials; chant with an ison and a 12-second reverberation. 
- The Levant (2026-10-27, v5.4): a fifth region — Mount Moriah, the Kidron, the Mount of Olives, olive terraces, a town of domed stone houses; the **Dome of the Rock** (Umayyad, Building L2: octagon with 36 windows and four porches, octagonal and circular arcades with gilded tie-beams, drum with 16 windows, double gilded dome, painted ceilings, the Rock and its screen, the platform with stairs) and the **Dome of the Chain**; voice, oud, ney and daff. 
- Francia (2026-10-27, v5.6): a sixth region — the Seine's plain, timber-framed town, orchards; the **Sainte-Chapelle** (Gothic, Building L2: lower chapel with painted columns and rib vaults, upper chapel with 15 traceried stained-glass windows, apse vault, tribune of the relics, apostles, buttresses, gables, rose, roof and spire); organum and bells. Start-up and map travel improved (v5.5). Next: Chinese (a Tang/Song timber hall, e.g. the Foguang Temple East Hall), then Japanese, Indian.

**Done (previous version, replaced)**
- Python planner, Edfu temple plan with 47 loci, three.js viewer with loci UI, toy-style props, bilingual UI, Pages deployment.

**Phase 0 — New foundation**
- New repo structure: pure JS ES modules, WebGPU renderer, PBR material loading, GTAO, shadows, first-person navigation with collision and stairs, map, settings, bilingual UI. Remove the Python package, `world.json` pipeline, loci UI, props catalogue and modeling guide; update README (both languages) to the new description; add `ASSETS.md`, `docs/world.md` (initial), the screenshot, plan-check and bake scripts.
- Lighting pipeline: offline bake producing lightmaps/probes; verify on a test room.

**Phase 1 — The first building, as the quality bar**
- Rewrite the Edfu dossier to §4 standard. Rebuild the Temple of Horus at Edfu to Building L1 → L2 with the new renderer, materials and baked light; its music. This building sets the bar every later one must meet.

**Phase 2 — Breadth: one building per major tradition** *(in progress: Egyptian, Greek, Roman built; next Byzantine, Islamic, Gothic, Chinese, Japanese, Indian, …)*
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
