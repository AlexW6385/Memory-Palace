"""Write docs/props.md and docs/rooms.md from the catalogs (run after editing them)."""
from __future__ import annotations

from pathlib import Path

from palace.catalog import (ANIMS, ARRANGES, BACKDROP_PATTERNS, HATS, HOLDABLE, POSES, PROPS, ROOM_STYLES)

DOCS = Path(__file__).resolve().parents[2] / "docs"


def props_md() -> str:
    out = ["# Prop catalogue", "",
           "Every exhibit scene is built from these props. Sizes are width × height × depth in metres at "
           "scale 1; the prop stands on its base and faces the viewer.", "",
           f"- **Poses** (figure, statue): {', '.join(POSES)}",
           f"- **Hats** (figure): {', '.join(HATS)}",
           f"- **Holdable** (figure `hold`): {', '.join(HOLDABLE)}",
           "- **Animations** (`anim`): spin (turns slowly in place), bob (floats up and down), sway (rocks side to "
           "side), pulse (swells and shrinks a little), orbit (circles the stage centre at its distance from it), "
           "hop (small jumps), swing (swings like a pendulum), flicker (flickers like a flame)",
           f"- **Arrangements** (`arrange` with `count`): {', '.join(ARRANGES)}",
           f"- **Backdrop patterns**: {', '.join(BACKDROP_PATTERNS)}", ""]
    group = None
    for p in PROPS.values():
        if p["group"] != group:
            group = p["group"]
            out += ["", f"## {group.capitalize()}", "", "| prop | size (m) | description | variants | notes |",
                    "|---|---|---|---|---|"]
        w, h, d = p["size"]
        notes = []
        if p["text"]:
            notes.append("text")
        if p["holdable"]:
            notes.append("holdable")
        if p["floats"]:
            notes.append("floats")
        if p["colors"] == 2:
            notes.append("color, color2")
        elif p["colors"] == 1:
            notes.append("color")
        out.append(f"| `{p['name']}` | {w}×{h}×{d} | {p['desc']} | {', '.join(p['variants'])} | "
                   f"{', '.join(notes)} |")
    return "\n".join(out) + "\n"


def rooms_md() -> str:
    out = ["# Room styles", "", "Each room is dressed in one style; pick the one whose world suits the content.", "",
           "| style | name | look | decor |", "|---|---|---|---|"]
    for k, s in ROOM_STYLES.items():
        decor = ", ".join(sorted({d["prop"] for d in s["decor"]}))
        out.append(f"| `{k}` | {s['en']} / {s['zh']} | {s['desc']} | {decor} |")
    return "\n".join(out) + "\n"


def main() -> None:
    DOCS.mkdir(exist_ok=True)
    (DOCS / "props.md").write_text(props_md(), encoding="utf-8")
    (DOCS / "rooms.md").write_text(rooms_md(), encoding="utf-8")
    print("wrote docs/props.md and docs/rooms.md")


if __name__ == "__main__":
    main()
