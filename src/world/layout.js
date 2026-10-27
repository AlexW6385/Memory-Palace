// The layout of the world (docs/world.md): the river, the landforms, and where each building
// stands. Pure data plus the terrain height function; shared by the viewer, the baker and the
// checks. World axes: +x east, +y up, +z south.

export const WORLD = {
  bounds: [-1200, -1200, 1200, 1200],
  river: { x0: 190, x1: 520, bank: 22, depth: 3.2, water: -2.3 },
};

/**
 * Landforms: flat-topped rock hills ("mesa") with a rounded-rectangle top, steep sides, and a
 * gentler slope on one side where the way up runs.
 */
export const LANDFORMS = [
  {
    id: 'acropolis', kind: 'mesa',
    center: [-180, -560], half: [150, 70], round: 28, top: 40,
    steep: 22,                        // horizontal run of the cliffs (m)
    gentle: { dir: [-1, 0], run: 190 },   // the west slope, where the Panathenaic way climbs
    rock: 3.5,                        // amplitude of the broken rock on the slopes (m)
  },
];

/** Where each building stands: origin [x, z], yaw (degrees, multiple of 90), base height. */
export const SITES = {
  edfu: { origin: [0, 0], yaw: 0, base: 0 },
  parthenon: { origin: [-165, -582], yaw: 0, base: 40 },
  pantheon: { origin: [40, -300], yaw: 0, base: 0 },
};

// ── terrain height ───────────────────────────────────────────────────────────

const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
function fbm(x, z) { return vnoise(x, z) * 0.55 + vnoise(x * 2.1, z * 2.1) * 0.28 + vnoise(x * 4.3, z * 4.3) * 0.17; }

/** Signed distance from (x, z) to a landform's top outline (negative inside). */
function mesaDistance(L, x, z) {
  const qx = Math.abs(x - L.center[0]) - L.half[0] + L.round, qz = Math.abs(z - L.center[1]) - L.half[1] + L.round;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - L.round;
}

function mesaHeight(L, x, z) {
  const d = mesaDistance(L, x, z);
  if (d <= 0) return L.top;
  // which way from the centre: the gentle side has a long run, the rest falls steeply
  const dx = x - L.center[0], dz = z - L.center[1], len = Math.hypot(dx, dz) || 1;
  const g = L.gentle ? Math.max(0, (dx * L.gentle.dir[0] + dz * L.gentle.dir[1]) / len) : 0;
  const run = L.steep + (L.gentle ? (L.gentle.run - L.steep) * smooth(0.55, 0.9, g) : 0);
  if (d >= run) return 0;
  const t = d / run;
  // cliffs: a convex shoulder and a scree foot; the gentle side a long even grade
  const profile = 1 - smooth(0, 1, t);
  const broken = L.rock * fbm(x * 0.08, z * 0.08) * Math.sin(Math.PI * t) * (1 - g);
  return Math.max(0, L.top * profile + broken);
}

/** Height of the open ground at (x, z). The river bed is modelled separately. */
export function terrainHeight(x, z) {
  let h = 0;
  for (const L of LANDFORMS) {
    if (Math.abs(x - L.center[0]) > L.half[0] + 220 || Math.abs(z - L.center[1]) > L.half[1] + 220) continue;
    h = Math.max(h, mesaHeight(L, x, z));
  }
  return h;
}

/** Rectangle covered by a landform and its slopes (for meshing). */
export function landformRect(L) {
  const run = Math.max(L.steep, L.gentle?.run ?? 0) + 4;
  return [L.center[0] - L.half[0] - run, L.center[1] - L.half[1] - run, L.center[0] + L.half[0] + run, L.center[1] + L.half[1] + run];
}
