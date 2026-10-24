// Walkability rules, mirrored from palace/nav.py.
// Among the surfaces under a spot whose height is within STEP of the visitor's
// current height, the visitor stands on the highest; colliders block the body.

const TAU = Math.PI * 2;
const BUCKET = 10;

function local(shape, x, z) {
  const dx = x - shape.c[0], dz = z - shape.c[1];
  const r = shape.r || 0, c = Math.cos(r), s = Math.sin(r);
  return [dx * c - dz * s, dx * s + dz * c];
}

function contains(shape, x, z) {
  if (shape.k === "rect" || shape.k === "ramp") {
    const [lx, lz] = local(shape, x, z);
    return Math.abs(lx) <= shape.w / 2 && Math.abs(lz) <= shape.d / 2;
  }
  const d = Math.hypot(x - shape.c[0], z - shape.c[1]);
  return d >= shape.r0 && d <= shape.r1;
}

function heightsOf(surf, x, z, out) {
  if (!contains(surf, x, z)) return;
  if (surf.holes) for (const h of surf.holes) if (contains(h, x, z)) return;
  switch (surf.k) {
    case "rect": case "disc": out.push(surf.y); return;
    case "ramp": {
      const [, lz] = local(surf, x, z);
      const t = (lz + surf.d / 2) / surf.d;
      out.push(surf.y0 + t * (surf.y1 - surf.y0));
      return;
    }
    case "helix": {
      const dx = x - surf.c[0], dz = z - surf.c[1];
      let t = (Math.atan2(dx, -dz) - surf.a0) % TAU;
      if (t < 0) t += TAU;
      for (; t <= surf.sweep + 1e-9; t += TAU) out.push(surf.y0 + surf.pitch * t / TAU);
      return;
    }
  }
}

function aabb(shape) {
  const [cx, cz] = shape.c;
  if (shape.k === "rect" || shape.k === "ramp") {
    const c = Math.abs(Math.cos(shape.r || 0)), s = Math.abs(Math.sin(shape.r || 0));
    const ex = shape.w / 2 * c + shape.d / 2 * s, ez = shape.w / 2 * s + shape.d / 2 * c;
    return [cx - ex, cz - ez, cx + ex, cz + ez];
  }
  const r = shape.r1 ?? shape.r;
  return [cx - r, cz - r, cx + r, cz + r];
}

export class Nav {
  constructor({ step, radius, surfaces, colliders }) {
    this.step = step;
    this.radius = radius;
    this.surf = new Map();
    this.cols = new Map();
    for (const s of surfaces) this.#insert(this.surf, s, aabb(s));
    for (const c of colliders) {
      if (c.k === "rect") {
        const b = aabb(c);
        this.#insert(this.cols, c, [b[0] - radius, b[1] - radius, b[2] + radius, b[3] + radius]);
      } else {
        const r = c.r + radius;
        this.#insert(this.cols, c, [c.c[0] - r, c.c[1] - r, c.c[0] + r, c.c[1] + r]);
      }
    }
    this.buf = [];
  }

  #insert(map, item, box) {
    for (let i = Math.floor(box[0] / BUCKET); i <= Math.floor(box[2] / BUCKET); i++) {
      for (let j = Math.floor(box[1] / BUCKET); j <= Math.floor(box[3] / BUCKET); j++) {
        const key = i * 100003 + j;
        let list = map.get(key);
        if (!list) map.set(key, (list = []));
        list.push(item);
      }
    }
  }

  #key(x, z) { return Math.floor(x / BUCKET) * 100003 + Math.floor(z / BUCKET); }

  heights(x, z) {
    const out = this.buf;
    out.length = 0;
    const list = this.surf.get(this.#key(x, z));
    if (list) for (const s of list) heightsOf(s, x, z, out);
    return out;
  }

  blocked(x, z, y) {
    const list = this.cols.get(this.#key(x, z));
    if (!list) return false;
    for (const c of list) {
      if (c.y1 <= y + 0.1 || c.y0 >= y + 1.8) continue;
      if (c.k === "rect") {
        const [lx, lz] = local(c, x, z);
        if (Math.abs(lx) < c.w / 2 + this.radius && Math.abs(lz) < c.d / 2 + this.radius) return true;
      } else if (Math.hypot(x - c.c[0], z - c.c[1]) < c.r + this.radius) return true;
    }
    return false;
  }

  /** Height the visitor stands at on (x, z) coming from height `near`, or null. */
  stand(x, z, near) {
    let best = null;
    for (const h of this.heights(x, z)) {
      if (Math.abs(h - near) <= this.step && (best === null || h > best)) best = h;
    }
    if (best === null || this.blocked(x, z, best)) return null;
    return best;
  }

  /** Move from p toward (nx, nz), sliding along obstacles. Mutates p {x, y, z}. */
  move(p, nx, nz) {
    const dist = Math.hypot(nx - p.x, nz - p.z);
    const n = Math.max(1, Math.ceil(dist / 0.3));
    const sx = (nx - p.x) / n, sz = (nz - p.z) / n;
    for (let k = 0; k < n; k++) {
      let h = this.stand(p.x + sx, p.z + sz, p.y);
      if (h !== null) { p.x += sx; p.z += sz; p.y = h; continue; }
      h = this.stand(p.x + sx, p.z, p.y);
      if (h !== null && Math.abs(sx) > 1e-6) { p.x += sx; p.y = h; continue; }
      h = this.stand(p.x, p.z + sz, p.y);
      if (h !== null && Math.abs(sz) > 1e-6) { p.z += sz; p.y = h; continue; }
      return false;
    }
    return true;
  }
}
