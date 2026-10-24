"""Drive the viewer in headless Chromium and take screenshots.

usage:
  python3 tools/view_shot.py [--size 1440x900] [--query "lang=zh"] [--dark] \
      --js "palace.goExhibit('math/pigeonhole', true)" --wait 2500 --shot out.png  [--js ... --shot ...]

Steps run in the order given. three.js is served from node_modules; Google Fonts are skipped.
"""
from __future__ import annotations

import sys
import time

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from lab_shot import route, serve  # noqa: E402


def main(argv: list[str]) -> int:
    size, query, dark = "1440x900", "nowelcome=1", False
    steps: list[tuple[str, str]] = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--size":
            size = argv[i + 1]; i += 2
        elif a == "--query":
            query = argv[i + 1] + "&nowelcome=1"; i += 2
        elif a == "--dark":
            dark = True; i += 1
        elif a in ("--js", "--wait", "--shot"):
            steps.append((a[2:], argv[i + 1])); i += 2
        else:
            raise SystemExit(f"unknown argument {a}")
    w, h = (int(v) for v in size.split("x"))
    srv, port = serve()
    errors: list[str] = []
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
                                    "--ignore-gpu-blocklist"])
        ctx = b.new_context(viewport={"width": w, "height": h}, color_scheme="dark" if dark else "light",
                            device_scale_factor=1, has_touch=w < 700, is_mobile=w < 700)
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.route("**/*", route)
        t0 = time.time()
        page.goto(f"http://127.0.0.1:{port}/index.html?{query}")
        try:
            page.wait_for_function("window.READY === true", timeout=180_000)
        except Exception as e:
            errors.append(f"timeout waiting for READY: {e}")
        print(f"ready after {time.time() - t0:.1f}s")
        page.wait_for_timeout(800)
        for kind, arg in steps:
            if kind == "js":
                try:
                    r = page.evaluate(f"(async () => {{ return {arg}; }})()")
                    if r is not None:
                        print("js:", str(r)[:400])
                except Exception as e:
                    errors.append(f"js error: {e}")
            elif kind == "wait":
                page.wait_for_timeout(int(arg))
            elif kind == "shot":
                page.screenshot(path=arg, timeout=180_000)
                print("saved", arg)
        b.close()
    srv.shutdown()
    for e in errors[:40]:
        print(e)
    return 1 if any(e.startswith(("pageerror", "error", "js error")) for e in errors) else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
