"""Command line entry point: python -m palace <command>."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from pydantic import ValidationError


def cmd_validate(args: argparse.Namespace) -> int:
    from palace.content import ContentStore, load_system_file
    from palace.schema import scene_problems, text_problems

    ok = True
    if args.files:
        for f in args.files:
            try:
                s = load_system_file(Path(f))
                print(f"OK  {f}: {s.title.en} — {len(s.wings)} wings, {len(s.exhibits())} exhibits")
                for problem in text_problems(s) + scene_problems(s):
                    print(f"    warning: {problem}")
            except (ValidationError, ValueError) as e:
                ok = False
                print(f"ERR {f}:\n{e}")
        return 0 if ok else 1

    store = ContentStore(Path(args.content))
    try:
        systems = store.load_systems()
        crosslinks = store.load_crosslinks()
    except (ValidationError, ValueError) as e:
        print(f"ERR {e}")
        return 1
    for s in systems.values():
        print(f"OK  {s.id}: {s.title.en} — {len(s.wings)} wings, {len(s.exhibits())} exhibits")
        for problem in text_problems(s) + scene_problems(s):
            print(f"    warning: {problem}")
    from palace.world import check_crosslinks

    problems = check_crosslinks(systems, crosslinks)
    for p in problems:
        print(f"ERR crosslinks: {p}")
    print(f"{len(crosslinks.links)} cross links")
    return 1 if problems else 0


def cmd_build(args: argparse.Namespace) -> int:
    from palace.world import build_world_file

    out = build_world_file(Path(args.content), Path(args.out))
    print(f"wrote {out}")
    return 0


def cmd_generate(args: argparse.Namespace) -> int:
    import asyncio

    from palace.content import ContentStore
    from palace.generate import generate_system
    from palace.llm import make_provider
    from palace.world import build_world_file

    store = ContentStore(Path(args.content))
    provider = make_provider(args.provider, args.model)
    system = asyncio.run(
        generate_system(args.topic, provider, store, notes=args.notes, log=print)
    )
    print(f"saved {system.id}: {len(system.exhibits())} exhibits")
    if not args.no_build:
        out = build_world_file(Path(args.content), Path(args.out))
        print(f"wrote {out}")
    return 0


def cmd_serve(args: argparse.Namespace) -> int:
    import uvicorn

    uvicorn.run("palace.server:app", host=args.host, port=args.port, reload=False)
    return 0


def main(argv: list[str] | None = None) -> int:
    from palace.content import CONTENT_DIR, ROOT

    default_out = ROOT / "web" / "data" / "world.json"
    p = argparse.ArgumentParser(prog="palace", description="Memory Palace tools")
    p.add_argument("--content", default=str(CONTENT_DIR), help="content directory")
    sub = p.add_subparsers(dest="command", required=True)

    v = sub.add_parser("validate", help="validate content files")
    v.add_argument("files", nargs="*", help="system files (default: the whole content dir)")
    v.set_defaults(func=cmd_validate)

    b = sub.add_parser("build", help="lay out every system and write world.json")
    b.add_argument("--out", default=str(default_out))
    b.set_defaults(func=cmd_build)

    g = sub.add_parser("generate", help="have an LLM design a new knowledge system")
    g.add_argument("topic", help="e.g. 'linear algebra' or 'my internship at Geotab'")
    g.add_argument("--notes", default="", help="extra material or wishes for the LLM")
    g.add_argument("--provider", choices=["anthropic", "openai"], default=None)
    g.add_argument("--model", default=None)
    g.add_argument("--out", default=str(default_out))
    g.add_argument("--no-build", action="store_true")
    g.set_defaults(func=cmd_generate)

    s = sub.add_parser("serve", help="serve the viewer and the generation API")
    s.add_argument("--host", default="127.0.0.1")
    s.add_argument("--port", type=int, default=8000)
    s.set_defaults(func=cmd_serve)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
