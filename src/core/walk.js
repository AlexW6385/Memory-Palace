// The walker's body and movement, shared by the controls and the walk-through check.

export const EYE = 1.62, RADIUS = 0.3, STEP = 0.5, HEAD = 1.75, LOW = 0.25;
export const WALK = 2.6, RUN = 6.5, GRAVITY = 18;
/** Flight: rising while held (m/s), the horizontal speeds aloft, the gentle descent when let go,
 *  and the highest the feet may rise above the open ground. */
export const LIFT = 4.5, FLY = 9, FLY_FAST = 18, GLIDE = 3.5, CEILING = 160;

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
    // the ponds cannot be waded (but can be flown over, and left by one who lands in them)
    if (C.water && P.y <= g + 0.3 && C.water(nx, nz, g) && !C.water(P.x, P.z, g)) continue;
    // open ground steeper than about 40° cannot be climbed (built steps and ramps can)
    const run = Math.hypot(nx - P.x, nz - P.z);
    if (g - P.y > Math.max(0.02, run * 0.85) && Math.abs(g - C.terrain(nx, nz)) < 1e-6) continue;
    P.x = nx; P.z = nz;
    if (g >= P.y - STEP && P.vy === 0) P.y = g;   // follow steps up and down
    else if (g > P.y) { P.y = g; if (P.vy < 0) P.vy = 0; }   // coming down onto rising ground
  }
  let g = C.groundAt(P.x, P.z, P.y + 0.01);
  if (P.vy > 0 || P.y > g + 1e-3) {
    // in the air: rising (held up by flight) or coming down — onto the ground, a floor, or the top
    // of a wall or a roof
    if (C.topAt) g = Math.max(g, C.topAt(P.x, P.z, RADIUS * 0.6, P.y + 0.01));
    if (C.waterLevel) g = Math.max(g, C.waterLevel(P.x, P.z));
    if (P.lift) P.vy = Math.min(LIFT, Math.max(P.vy, 0) + 14 * dt);
    else P.vy -= GRAVITY * dt;
    if (P.glide) P.vy = Math.max(P.vy, -GLIDE);
    if (P.vy > 0) {
      const top = C.terrain(P.x, P.z) + CEILING, dy = P.vy * dt;
      if (P.y + dy > top || (C.ceilingBetween && C.ceilingBetween(P.x, P.z, RADIUS, P.y + HEAD, P.y + HEAD + dy))) P.vy = 0;
    }
    P.y = Math.max(g, P.y + P.vy * dt);
    if (P.y <= g) P.vy = 0;
  } else if (g > P.y) P.y = g;
  else if (P.lift) P.vy = 1e-3;                       // take off
}
