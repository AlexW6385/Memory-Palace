// Collision world: walkable surfaces (floors and ramps) and obstacles (plan polygons and
// circles with a vertical extent). Shared by the walking controller and the plan checker.

const CELL = 8;

export class CollisionWorld {
  constructor() {
    this.floors = [];
    this.obstacles = [];
    this.grid = new Map();
    this.floorGrid = new Map();
    this.groundY = 0;       // the open ground of the world
  }

  add({ floors, obstacles }) {
    for (const f of floors) { this.floors.push(f); this._index(this.floorGrid, f.rect, f); }
    for (const o of obstacles) {
      if (o.circle) { const [x, z, r] = o.circle; o.bb = [x - r, z - r, x + r, z + r]; }
      else {
        const xs = o.poly.map((p) => p[0]), zs = o.poly.map((p) => p[1]);
        o.bb = [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
      }
      this.obstacles.push(o);
      this._index(this.grid, o.bb, o);
    }
  }

  _index(grid, [x0, z0, x1, z1], item) {
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) {
      for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) {
        const k = i + ',' + j;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(item);
      }
    }
  }

  _near(grid, x, z) { return grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)) || []; }

  /** Height of a floor item at (x, z), or null if outside it. */
  static floorHeight(f, x, z) {
    const [x0, z0, x1, z1] = f.rect;
    if (x < x0 || x > x1 || z < z0 || z > z1) return null;
    if (f.y1 === undefined) return f.y;
    let t;
    if (f.dir === 'n') t = (z1 - z) / (z1 - z0);
    else if (f.dir === 's') t = (z - z0) / (z1 - z0);
    else if (f.dir === 'e') t = (x - x0) / (x1 - x0);
    else t = (x1 - x) / (x1 - x0);
    return f.y + (f.y1 - f.y) * t;
  }

  /** Highest walkable surface at (x, z) not above maxY. */
  groundAt(x, z, maxY) {
    let best = this.groundY <= maxY ? this.groundY : -Infinity;
    for (const f of this._near(this.floorGrid, x, z)) {
      const h = CollisionWorld.floorHeight(f, x, z);
      if (h !== null && h <= maxY && h > best) best = h;
    }
    return best;
  }

  /** Lowest surface above y at (x, z) (a ceiling for the head check), from obstacles only. */
  blockedAt(x, z, r, y0, y1) {
    for (const o of this._near(this.grid, x, z)) {
      if (o.y1 <= y0 || o.y0 >= y1) continue;
      if (x + r < o.bb[0] || x - r > o.bb[2] || z + r < o.bb[1] || z - r > o.bb[3]) continue;
      if (o.circle) {
        const [cx, cz, cr] = o.circle;
        if (Math.hypot(x - cx, z - cz) < cr + r) return true;
      } else if (circlePoly(x, z, r, o.poly)) return true;
    }
    return false;
  }

  /** Push the circle (x, z, r) out of obstacles overlapping y0..y1. Returns [x, z]. */
  resolve(x, z, r, y0, y1) {
    for (let iter = 0; iter < 4; iter++) {
      let moved = false;
      for (const o of this._near(this.grid, x, z)) {
        if (o.y1 <= y0 || o.y0 >= y1) continue;
        if (x + r < o.bb[0] || x - r > o.bb[2] || z + r < o.bb[1] || z - r > o.bb[3]) continue;
        if (o.circle) {
          const [cx, cz, cr] = o.circle;
          const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz), m = cr + r;
          if (d < m) { const k = d > 1e-6 ? (m - d) / d : 0; x += dx * k; z += dz * k; if (d <= 1e-6) x += m; moved = true; }
        } else {
          const p = pushOut(x, z, r, o.poly);
          if (p) { x = p[0]; z = p[1]; moved = true; }
        }
      }
      if (!moved) break;
    }
    return [x, z];
  }
}

function inside(x, z, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

function closestOnPoly(x, z, poly) {
  let best = null, bd = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j], [bx, bz] = poly[i];
    const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1;
    let t = ((x - ax) * vx + (z - az) * vz) / l2;
    t = Math.max(0, Math.min(1, t));
    const px = ax + vx * t, pz = az + vz * t, d = Math.hypot(x - px, z - pz);
    if (d < bd) { bd = d; best = [px, pz]; }
  }
  return [best, bd];
}

function circlePoly(x, z, r, poly) {
  if (inside(x, z, poly)) return true;
  return closestOnPoly(x, z, poly)[1] < r;
}

function pushOut(x, z, r, poly) {
  const [p, d] = closestOnPoly(x, z, poly);
  const ins = inside(x, z, poly);
  if (!ins && d >= r) return null;
  let nx = x - p[0], nz = z - p[1];
  const l = Math.hypot(nx, nz) || 1;
  nx /= l; nz /= l;
  if (ins) { nx = -nx; nz = -nz; }
  return [p[0] + nx * (r + 1e-3), p[1] + nz * (r + 1e-3)];
}
