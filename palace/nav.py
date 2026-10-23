"""Walkability: exact queries, a baked grid, A* and path smoothing.

The viewer runs the same rules (web/js/nav.js): among the surfaces under a
spot whose height is within STEP of the visitor's current height, the visitor
stands on the highest one (so stepping onto a floor laid over the ground
works); a spot with no such surface, or where a collider overlaps the body,
cannot be entered. The grid here is used offline to verify reachability and to compute
the guided-tour paths.
"""
from __future__ import annotations

import heapq
import math
from dataclasses import dataclass

import numpy as np

STEP = 0.6          # max height change per move
RADIUS = 0.35       # visitor body radius
BODY = 1.8          # visitor height
TAU = 2 * math.pi


# ── exact (scalar) queries ───────────────────────────────────────────────────

def pick(heights, near: float) -> float | None:
    """Height the visitor ends up at: the highest surface within STEP of `near`."""
    best = None
    for h in heights:
        if abs(h - near) <= STEP and (best is None or h > best):
            best = h
    return best


def _local(shape: dict, x: float, z: float) -> tuple[float, float]:
    dx, dz = x - shape["c"][0], z - shape["c"][1]
    c, s = math.cos(shape.get("r", 0.0)), math.sin(shape.get("r", 0.0))
    return dx * c - dz * s, dx * s + dz * c


def shape_contains(shape: dict, x: float, z: float) -> bool:
    k = shape["k"]
    if k in ("rect", "ramp"):
        lx, lz = _local(shape, x, z)
        return abs(lx) <= shape["w"] / 2 and abs(lz) <= shape["d"] / 2
    if k in ("disc", "helix"):
        d = math.hypot(x - shape["c"][0], z - shape["c"][1])
        return shape["r0"] <= d <= shape["r1"]
    raise ValueError(k)


def surface_heights(surf: dict, x: float, z: float) -> list[float]:
    if not shape_contains(surf, x, z):
        return []
    for hole in surf.get("holes", ()):
        if shape_contains(hole, x, z):
            return []
    k = surf["k"]
    if k in ("rect", "disc"):
        return [surf["y"]]
    if k == "ramp":
        _, lz = _local(surf, x, z)
        t = (lz + surf["d"] / 2) / surf["d"]
        return [surf["y0"] + t * (surf["y1"] - surf["y0"])]
    if k == "helix":
        dx, dz = x - surf["c"][0], z - surf["c"][1]
        t = (math.atan2(dx, -dz) - surf["a0"]) % TAU
        out = []
        while t <= surf["sweep"] + 1e-9:
            out.append(surf["y0"] + surf["pitch"] * t / TAU)
            t += TAU
        return out
    raise ValueError(k)


def collider_hits(col: dict, x: float, z: float, y: float, radius: float = RADIUS) -> bool:
    if col["y1"] <= y + 0.1 or col["y0"] >= y + BODY:
        return False
    return math.hypot(x - col["c"][0], z - col["c"][1]) < col["r"] + radius


class Nav:
    """Exact walkability queries, with a coarse spatial hash for speed."""

    BUCKET = 10.0

    def __init__(self, surfaces: list[dict], colliders: list[dict]):
        self.surfaces = surfaces
        self.colliders = colliders
        self._surf_buckets: dict[tuple[int, int], list[dict]] = {}
        self._col_buckets: dict[tuple[int, int], list[dict]] = {}
        for s in surfaces:
            self._insert(self._surf_buckets, s, _aabb(s))
        for c in colliders:
            r = c["r"] + RADIUS
            x, z = c["c"]
            self._insert(self._col_buckets, c, (x - r, z - r, x + r, z + r))

    def _insert(self, buckets, item, box) -> None:
        b = self.BUCKET
        for i in range(math.floor(box[0] / b), math.floor(box[2] / b) + 1):
            for j in range(math.floor(box[1] / b), math.floor(box[3] / b) + 1):
                buckets.setdefault((i, j), []).append(item)

    def _key(self, x: float, z: float) -> tuple[int, int]:
        return (math.floor(x / self.BUCKET), math.floor(z / self.BUCKET))

    def heights_at(self, x: float, z: float) -> list[float]:
        out: list[float] = []
        for s in self._surf_buckets.get(self._key(x, z), ()):
            out.extend(surface_heights(s, x, z))
        return sorted(out)

    def blocked(self, x: float, z: float, y: float) -> bool:
        return any(collider_hits(c, x, z, y) for c in self._col_buckets.get(self._key(x, z), ()))

    def stand(self, x: float, z: float, near: float) -> float | None:
        """Height the visitor would stand at, coming from height `near`; None if not walkable."""
        best = pick(self.heights_at(x, z), near)
        if best is None or self.blocked(x, z, best):
            return None
        return best

    def segment_ok(self, a: tuple[float, float, float], b: tuple[float, float, float],
                   sample: float = 0.25) -> bool:
        """Can the visitor walk straight from a to b (both (x, y, z))?"""
        ax, ay, az = a
        bx, by, bz = b
        n = max(1, int(math.hypot(bx - ax, bz - az) / sample))
        h = ay
        for k in range(1, n + 1):
            t = k / n
            nh = self.stand(ax + (bx - ax) * t, az + (bz - az) * t, h)
            if nh is None:
                return False
            h = nh
        return abs(h - by) <= STEP


# ── baked grid ───────────────────────────────────────────────────────────────

def _local_np(shape: dict, X: np.ndarray, Z: np.ndarray):
    dx, dz = X - shape["c"][0], Z - shape["c"][1]
    c, s = math.cos(shape.get("r", 0.0)), math.sin(shape.get("r", 0.0))
    return dx * c - dz * s, dx * s + dz * c


def _contains_np(shape: dict, X, Z) -> np.ndarray:
    k = shape["k"]
    if k in ("rect", "ramp"):
        lx, lz = _local_np(shape, X, Z)
        return (np.abs(lx) <= shape["w"] / 2) & (np.abs(lz) <= shape["d"] / 2)
    d = np.hypot(X - shape["c"][0], Z - shape["c"][1])
    return (d >= shape["r0"]) & (d <= shape["r1"])


def _aabb(shape: dict) -> tuple[float, float, float, float]:
    cx, cz = shape["c"]
    if shape["k"] in ("rect", "ramp"):
        c, s = abs(math.cos(shape.get("r", 0))), abs(math.sin(shape.get("r", 0)))
        ex = shape["w"] / 2 * c + shape["d"] / 2 * s
        ez = shape["w"] / 2 * s + shape["d"] / 2 * c
        return cx - ex, cz - ez, cx + ex, cz + ez
    r = shape.get("r1", shape.get("r", 0))
    return cx - r, cz - r, cx + r, cz + r


@dataclass
class Grid:
    x0: float
    z0: float
    step: float
    nx: int
    nz: int
    heights: dict[int, tuple[float, ...]]  # cell index -> walkable heights (sorted)

    def cell(self, x: float, z: float) -> int | None:
        i = int(round((x - self.x0) / self.step))
        j = int(round((z - self.z0) / self.step))
        if 0 <= i < self.nx and 0 <= j < self.nz:
            return j * self.nx + i
        return None

    def center(self, idx: int) -> tuple[float, float]:
        j, i = divmod(idx, self.nx)
        return self.x0 + i * self.step, self.z0 + j * self.step

    def stand(self, x: float, z: float, near: float) -> float | None:
        idx = self.cell(x, z)
        if idx is None:
            return None
        return pick(self.heights.get(idx, ()), near)


def bake(nav: Nav, bounds: tuple[float, float, float, float], step: float = 0.5) -> Grid:
    x0, z0, x1, z1 = bounds
    nx = int(math.floor((x1 - x0) / step)) + 1
    nz = int(math.floor((z1 - z0) / step)) + 1
    xs = x0 + np.arange(nx) * step
    zs = z0 + np.arange(nz) * step
    X, Z = np.meshgrid(xs, zs)  # shape (nz, nx); flat index = j * nx + i
    Xf, Zf = X.ravel(), Z.ravel()

    idx_parts: list[np.ndarray] = []
    h_parts: list[np.ndarray] = []
    for s in nav.surfaces:
        ax0, az0, ax1, az1 = _aabb(s)
        if ax1 < x0 or ax0 > x1 or az1 < z0 or az0 > z1:
            continue
        pre = (Xf >= ax0) & (Xf <= ax1) & (Zf >= az0) & (Zf <= az1)
        cand = np.nonzero(pre)[0]
        if cand.size == 0:
            continue
        cx, cz = Xf[cand], Zf[cand]
        m = _contains_np(s, cx, cz)
        for hole in s.get("holes", ()):
            m &= ~_contains_np(hole, cx, cz)
        cand, cx, cz = cand[m], cx[m], cz[m]
        if cand.size == 0:
            continue
        k = s["k"]
        if k in ("rect", "disc"):
            idx_parts.append(cand)
            h_parts.append(np.full(cand.size, s["y"], dtype=float))
        elif k == "ramp":
            _, lz = _local_np(s, cx, cz)
            t = (lz + s["d"] / 2) / s["d"]
            idx_parts.append(cand)
            h_parts.append(s["y0"] + t * (s["y1"] - s["y0"]))
        elif k == "helix":
            t = np.mod(np.arctan2(cx - s["c"][0], -(cz - s["c"][1])) - s["a0"], TAU)
            turn = 0
            while turn * TAU <= s["sweep"]:
                tt = t + turn * TAU
                ok = tt <= s["sweep"] + 1e-9
                idx_parts.append(cand[ok])
                h_parts.append(s["y0"] + s["pitch"] * tt[ok] / TAU)
                turn += 1

    if not idx_parts:
        return Grid(x0, z0, step, nx, nz, {})
    idx = np.concatenate(idx_parts)
    hs = np.concatenate(h_parts)

    # drop heights blocked by colliders
    keep = np.ones(idx.size, dtype=bool)
    px, pz = Xf[idx], Zf[idx]
    for col in nav.colliders:
        cx, cz = col["c"]
        reach = col["r"] + RADIUS + step / 2  # inflated: the grid only samples cell centers
        if cx + reach < x0 or cx - reach > x1 or cz + reach < z0 or cz - reach > z1:
            continue
        near = (np.abs(px - cx) < reach) & (np.abs(pz - cz) < reach)
        if not near.any():
            continue
        hit = near & (np.hypot(px - cx, pz - cz) < reach) & (col["y1"] > hs + 0.1) & (col["y0"] < hs + BODY)
        keep &= ~hit
    idx, hs = idx[keep], hs[keep]

    order = np.lexsort((hs, idx))
    idx, hs = idx[order], hs[order]
    heights: dict[int, list[float]] = {}
    for i, h in zip(idx.tolist(), hs.tolist()):
        lst = heights.setdefault(i, [])
        if not lst or h - lst[-1] > 0.05:
            lst.append(round(h, 3))
    return Grid(x0, z0, step, nx, nz, _erode(heights, nx, nz))


def _erode(heights: dict[int, list[float]], nx: int, nz: int) -> dict[int, tuple[float, ...]]:
    """Drop (cell, height) pairs on the rim of a walkable area.

    A pair survives only if all four neighbours can be stepped onto from it,
    so grid paths keep half a cell away from edges and holes.
    """
    out: dict[int, tuple[float, ...]] = {}
    for idx, hs in heights.items():
        j, i = divmod(idx, nx)
        keep = []
        for h in hs:
            ok = True
            for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ni, nj = i + di, j + dj
                if not (0 <= ni < nx and 0 <= nj < nz):
                    continue  # the grid border is not an edge of the world
                nb = heights.get(nj * nx + ni)
                if not nb or pick(nb, h) is None:
                    ok = False
                    break
            if ok:
                keep.append(h)
        if keep:
            out[idx] = tuple(keep)
    return out


_NEIGHBORS = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]


def reachable(grid: Grid, start: tuple[float, float, float]) -> set[tuple[int, float]]:
    """All (cell, height) states connected to the start state."""
    s = _state(grid, *start)
    if s is None:
        return set()
    seen = {s}
    stack = [s]
    while stack:
        cur = stack.pop()
        for nxt, _ in _moves(grid, cur):
            if nxt not in seen:
                seen.add(nxt)
                stack.append(nxt)
    return seen


def state_of(grid: Grid, x: float, z: float, y: float) -> tuple[int, float] | None:
    return _state(grid, x, z, y)


def _state(grid: Grid, x: float, z: float, y: float):
    idx = grid.cell(x, z)
    if idx is None:
        return None
    best = pick(grid.heights.get(idx, ()), y)
    return None if best is None else (idx, best)


def _moves(grid: Grid, state):
    idx, h = state
    j, i = divmod(idx, grid.nx)
    for di, dj in _NEIGHBORS:
        ni, nj = i + di, j + dj
        if not (0 <= ni < grid.nx and 0 <= nj < grid.nz):
            continue
        nidx = nj * grid.nx + ni
        if di and dj:  # no corner cutting
            if _near(grid, j * grid.nx + ni, h) is None or _near(grid, nj * grid.nx + i, h) is None:
                continue
        nh = _near(grid, nidx, h)
        if nh is not None:
            yield (nidx, nh), grid.step * (1.4142 if di and dj else 1.0)


def _near(grid: Grid, idx: int, h: float):
    return pick(grid.heights.get(idx, ()), h)


class NoPath(Exception):
    pass


def astar(grid: Grid, start: tuple[float, float, float], goal: tuple[float, float, float]) -> list[tuple[float, float, float]]:
    """Grid path from start to goal (x, z, y) as a list of (x, y, z) points."""
    s = _state(grid, *start)
    g = _state(grid, *goal)
    if s is None or g is None:
        raise NoPath(f"start or goal not walkable: {start} -> {goal}")
    gx, gz = grid.center(g[0])

    def heur(st):
        x, z = grid.center(st[0])
        return math.hypot(x - gx, z - gz) + abs(st[1] - g[1])

    open_heap = [(heur(s), 0.0, s)]
    came: dict = {s: None}
    cost = {s: 0.0}
    while open_heap:
        _, c, cur = heapq.heappop(open_heap)
        if cur == g:
            break
        if c > cost[cur]:
            continue
        for nxt, w in _moves(grid, cur):
            nc = c + w
            if nc < cost.get(nxt, math.inf):
                cost[nxt] = nc
                came[nxt] = cur
                heapq.heappush(open_heap, (nc + heur(nxt), nc, nxt))
    else:
        raise NoPath(f"no path {start} -> {goal}")
    if g not in came:
        raise NoPath(f"no path {start} -> {goal}")
    out = []
    cur = g
    while cur is not None:
        x, z = grid.center(cur[0])
        out.append((x, cur[1], z))
        cur = came[cur]
    out.reverse()
    # pin the exact endpoints
    out[0] = (start[0], out[0][1], start[1])
    out[-1] = (goal[0], out[-1][1], goal[1])
    return out


def segment_ok(grid: Grid, a: tuple[float, float, float], b: tuple[float, float, float], sample: float = 0.25) -> bool:
    ax, ay, az = a
    bx, by, bz = b
    n = max(1, int(math.hypot(bx - ax, bz - az) / sample))
    h = ay
    for k in range(1, n + 1):
        t = k / n
        nh = grid.stand(ax + (bx - ax) * t, az + (bz - az) * t, h)
        if nh is None:
            return False
        h = nh
    return abs(h - by) <= STEP


def smooth(grid: Grid, path: list[tuple[float, float, float]], max_len: float = 14.0,
           check=None) -> list[tuple[float, float, float]]:
    """Greedy string pulling: keep the farthest point reachable in a straight line.

    `check(a, b)` decides whether a straight segment is walkable; defaults to
    the grid, pass `nav.segment_ok` for exact geometry.
    """
    check = check or (lambda a, b: segment_ok(grid, a, b))
    if len(path) <= 2:
        return path
    out = [path[0]]
    i = 0
    while i < len(path) - 1:
        j = i + 1
        while j + 1 < len(path):
            cand = path[j + 1]
            if math.hypot(cand[0] - path[i][0], cand[2] - path[i][2]) > max_len:
                break
            if not check(path[i], cand):
                break
            j += 1
        out.append(path[j])
        i = j
    return out
