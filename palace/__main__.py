"""Command line entry point: python -m palace <command>."""
from __future__ import annotations

import argparse
import functools
import http.server
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORLD = ROOT / "web" / "data" / "world.json"


def cmd_build(args: argparse.Namespace) -> int:
    from palace.world import build_world_file

    out = build_world_file(Path(args.out))
    print(f"wrote {out}")
    return 0


def cmd_serve(args: argparse.Namespace) -> int:
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT / "web"))
    with http.server.ThreadingHTTPServer((args.host, args.port), handler) as srv:
        print(f"serving http://{args.host}:{args.port}")
        srv.serve_forever()
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="palace", description="Memory Palace tools")
    sub = p.add_subparsers(dest="command", required=True)
    b = sub.add_parser("build", help="lay out the sites and write world.json")
    b.add_argument("--out", default=str(WORLD))
    b.set_defaults(func=cmd_build)
    s = sub.add_parser("serve", help="serve the viewer locally")
    s.add_argument("--host", default="127.0.0.1")
    s.add_argument("--port", type=int, default=8000)
    s.set_defaults(func=cmd_serve)
    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
