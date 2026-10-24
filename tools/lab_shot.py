"""Screenshot a page of the viewer (by default the prop lab) in headless Chromium.

usage:
  python3 tools/lab_shot.py "group=animals&bbox=1" out.png [--size 1600x1000] [--page lab/props.html]

three.js is served from node_modules (run `npm install` once); Google Fonts are skipped,
so local fallback fonts are used.
"""
from __future__ import annotations

import argparse
import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
THREE = ROOT / "node_modules" / "three"


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve() -> tuple[socketserver.TCPServer, int]:
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(WEB)))
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


def route(r):
    url = r.request.url
    if "cdn.jsdelivr.net/npm/three@" in url:
        rel = url.split("/npm/three@", 1)[1].split("/", 1)[1]
        r.fulfill(path=str(THREE / rel), content_type="application/javascript")
    elif "fonts.googleapis" in url or "fonts.gstatic" in url:
        r.abort()
    else:
        r.continue_()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("query")
    ap.add_argument("out")
    ap.add_argument("--size", default="1600x1000")
    ap.add_argument("--page", default="lab/props.html")
    ap.add_argument("--wait", type=int, default=600, help="extra milliseconds after READY")
    args = ap.parse_args()
    w, h = (int(v) for v in args.size.split("x"))
    srv, port = serve()
    errors: list[str] = []
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
                                    "--ignore-gpu-blocklist"])
        page = b.new_page(viewport={"width": w, "height": h})
        page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.route("**/*", route)
        page.goto(f"http://127.0.0.1:{port}/{args.page}?{args.query}")
        try:
            page.wait_for_function("window.READY === true", timeout=120_000)
        except Exception as e:  # report and still screenshot
            errors.append(f"timeout waiting for READY: {e}")
        page.wait_for_timeout(args.wait)
        page.screenshot(path=args.out)
        b.close()
    srv.shutdown()
    for e in errors[:30]:
        print(e)
    print(f"saved {args.out}")
    return 1 if any(e.startswith(("pageerror", "error")) for e in errors) else 0


if __name__ == "__main__":
    raise SystemExit(main())
