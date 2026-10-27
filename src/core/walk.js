// The walker's body and movement, shared by the controls and the walk-through check.

export const EYE = 1.62, RADIUS = 0.3, STEP = 0.5, HEAD = 1.75, LOW = 0.25;
export const WALK = 2.6, RUN = 6.5, GRAVITY = 18;

/**
 * Move feet {x, y, z, vy} by (dx, dz) metres this frame against the collision world,
 * climbing and descending steps up to STEP, falling otherwise.
 */
export function move(P, dx, dz, dt, C) {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.12));
  for (let i = 0; i < n; i++) {
    let nx = P.x + dx / n, nz = P.z + dz / n;
    let g = C.groundAt(nx, nz, P.y + STEP);
    [nx, nz] = C.resolve(nx, nz, RADIUS, Math.max(g, P.y) + LOW, Math.max(g, P.y) + HEAD);
    g = C.groundAt(nx, nz, P.y + STEP);
    if (!Number.isFinite(g)) continue;
    // open ground steeper than about 40° cannot be climbed (built steps and ramps can)
    const run = Math.hypot(nx - P.x, nz - P.z);
    if (g - P.y > Math.max(0.02, run * 0.85) && Math.abs(g - C.terrain(nx, nz)) < 1e-6) continue;
    P.x = nx; P.z = nz;
    if (g >= P.y - STEP && P.vy === 0) P.y = g;   // follow steps up and down
  }
  const g = C.groundAt(P.x, P.z, P.y + 0.01);
  if (P.y > g + 1e-3) {
    P.vy -= GRAVITY * dt;
    P.y = Math.max(g, P.y + P.vy * dt);
    if (P.y <= g) P.vy = 0;
  } else if (g > P.y) P.y = g;
}
