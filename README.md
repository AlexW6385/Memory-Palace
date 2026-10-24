# Memory Palace

[中文说明](README.zh-CN.md)

A walkable 3D memory palace in the browser. Each knowledge system is a building; each idea is a small,
vivid 3D scene standing at a numbered place along the route. You walk the route, read the cards, and
remember the ideas by where they stand and what their scenes look like.

**Walk it now: <https://alexw6385.github.io/memory-palace/>** (desktop or phone, English or Chinese)

The palace holds five knowledge systems with 332 exhibits, written in English and Chinese:

| System | Building | Route |
|---|---|---|
| Hegel's System | a tower climbed by a spiral ramp | Phenomenology → Logic (being, essence, concept) → Nature → Spirit → Absolute Spirit |
| Undergraduate Mathematics | a city of districts | logic and proof, sets, number theory, combinatorics, calculus, linear algebra, probability |
| Computer Science Fundamentals | a stepped pyramid | from bits and machines up through OS, networks, compilers and algorithms to computability |
| Software Development | one long avenue | requirements and design, collaboration, data, services, testing, security, delivery |
| LLMs and Agents | a hub with spokes | neural networks, the Transformer, training, inference, retrieval, agents, safety |

## How it works as a memory palace

The method of loci is the oldest memory technique: put each idea in a fixed place along a route, as a
vivid, concrete scene. The palace is built around it.

- **Fixed places along a route.** The route is the learning order. Every exhibit has a locus number;
  every fifth is gold and every tenth carries a star, so you always know where you are.
- **Rooms with character.** Rooms are themed halls (26 styles: a library, a post office, a casino, a harbour,
  an observatory…), chosen to fit their content. The room is itself a cue: message queues live in the post
  office, probability in the casino.
- **Scenes that *are* the idea.** Each exhibit is a diorama built from about 200 hand-modelled props. Five
  pigeons squabbling over four cages *is* the pigeonhole principle. The card lists which object stands for what.
- **Recall walks.** Walk a route with the titles and formulas hidden, say what each scene stands for, then
  reveal and grade yourself. Practise the ones you missed.

Each card has a one-line summary, the memory scene, the object-to-meaning cues, an explanation, a worked
example, keywords, and links to related exhibits, including links across systems.

**Controls:** on a desktop, W A S D to walk, drag to look, Shift to run, click an exhibit for its card, `M` for the
map, `/` to search, `[` `]` to step along the route. On a phone, the joystick walks and dragging looks.
**Tour** walks a route for you; **Recall** quizzes you on it; **Map** jumps anywhere; **中文 / EN** switches language.

## Run locally

```bash
pip install -e ".[dev]"
python -m palace build          # lay out the world → web/data/world.json
python -m palace serve          # http://127.0.0.1:8000
```

To browse only, any static server works: `python -m http.server -d web`.

## Add a knowledge system with an LLM

```bash
export ANTHROPIC_API_KEY=...      # or OPENAI_API_KEY=...
python -m palace generate "linear algebra"
python -m palace generate "my internship" --notes "$(cat notes.md)"   # personal topics use only your notes
```

Both Claude and OpenAI models are supported (`--provider anthropic|openai`, `--model ...`; defaults can be set
with `PALACE_ANTHROPIC_MODEL` and `PALACE_OPENAI_MODEL`). With `palace serve`, the directory panel also has a
form to build a new wing.

Generation runs in three passes, each validated and repaired by the model when a check fails:

1. **Outline:** titles, an architecture template, wings, rooms with a room style each, and the planned exhibits.
2. **Rooms, in parallel:** every field in both languages, the 3D scene from catalogue props, and links. Scenes
   are checked geometrically (on the stage, no collisions).
3. **Bridges:** links to exhibits in the systems already in the palace.

A new system takes a free plot; existing systems never move.

## Architecture

```
content/systems/*.json    semantic content, bilingual, no coordinates (schema: palace/schema.py)
content/crosslinks.json   links between systems (drawn as light bridges in the sky)
content/manifest.json     which plot each system occupies (append-only)
        │
palace/catalog/           the prop catalogue (208 props) and the 26 room styles
palace/scenes.py          how scene items are arranged on a stage; geometric checks
palace/halls.py           themed through-halls: the building block of every template
palace/templates.py       five architectures: spiral, city, terraces, avenue, radial
palace/world.py           the plaza, plots and scenery; exhibits, loci, tours
palace/nav.py             walkability, baked grid, A* and path smoothing for the tours
        │
web/data/world.json       render primitives + walkable surfaces + exhibits + tour paths
web/js/                   three.js viewer: arch.js (architecture), stage.js (exhibit scenes),
                          props/ (procedural prop models), ui.js, map.js, i18n.js
```

Design choices:

- **The LLM writes meaning; code places it.** Templates turn the counts of wings, rooms and exhibits into
  coordinates deterministically, so the same content always yields the same palace.
- **One walking rule, two implementations.** You stand on the highest surface within ±0.6 m of your height.
  Python uses the rule to prove every exhibit is reachable; the browser uses it to walk. Tests check that both agree.
- **Props are code, not assets.** Every prop is a small procedural model (`web/js/props/`), merged per material.
  Exhibit scenes load as you approach and unload behind you.

Docs: [writing guide](docs/writing-guide.md), [props](docs/props.md), [room styles](docs/rooms.md),
[modelling guide](docs/modeling-guide.md).

## Development

```bash
pytest -q                                  # schema, layout, navigation, generation, JS/Python parity
node tests/js/props.test.mjs               # build every prop and check size and budget
python3 tools/lab_shot.py "group=animals" out.png        # contact sheet of props (needs `npm install`)
python3 tools/view_shot.py --js "palace.goExhibit('math/pigeonhole', true)" --wait 3000 --shot out.png
```

Every push to `master` runs the tests, lays out the world and publishes `web/` to GitHub Pages
(`.github/workflows/pages.yml`).

## License

MIT
