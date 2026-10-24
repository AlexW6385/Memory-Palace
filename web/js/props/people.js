// Props in the "people" group. Each entry: name: (b, p) => void — see kit.js and docs/props.md.
// b is a Builder (metres, base on y = 0, facing +z); p holds the item's params:
//   { variant, color, color2, text, emoji, pose, hat, hold, seed }
//
// The figure is an articulated rig of nested b.group joints:
//   pelvis → spine → neck → head,   spine → shoulder → elbow → wrist,   pelvis → hip → knee → ankle.
// POSES gives the joint angles (degrees) for every pose; where a hand has to reach a spot (chin, knee,
// a box held in both hands) the table gives that spot and a two-bone IK turns it into joint angles.
// Statue and crowd reuse the same rig.
import * as THREE from "three";
import { Builder, C, shade, mix, rng, measure } from "./kit.js";
import { PROPS } from "./catalog.js";

const PI = Math.PI, D2R = PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const quat = (x, y, z, order = "XYZ") => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, order));
const toRot = (q) => { const e = new THREE.Euler().setFromQuaternion(q, "XYZ"); return [e.x, e.y, e.z]; };
const rad = (a) => (a || [0, 0, 0]).map((v) => v * D2R);
const seedOf = (b, p) => p.seed ?? b.env?.seed ?? 1;

/** Rotation whose -y axis points along `down` and whose +z axis leans towards `toward`. */
function frameQ(down, toward) {
  const y = down.clone().normalize().negate();
  const z = toward.clone().addScaledVector(y, -toward.dot(y));
  if (z.lengthSq() < 1e-8) z.set(0, 0, 1).addScaledVector(y, -y.z);
  if (z.lengthSq() < 1e-8) z.set(1, 0, 0).addScaledVector(y, -y.x);
  z.normalize();
  const x = V3().crossVectors(y, z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/** Two-bone IK: upper bone from `base` (bones hang along -y), elbow bent towards `pole`, wrist at `target`. */
function ik(base, target, l1, l2, pole) {
  const d = target.clone().sub(base);
  const dist = clamp(d.length(), Math.abs(l1 - l2) + 0.002, l1 + l2 - 0.0005);
  const dir = d.normalize();
  const a = Math.acos(clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1));
  const n = V3().crossVectors(dir, pole);
  if (n.lengthSq() < 1e-8) n.crossVectors(dir, V3(0, 0, 1));
  n.normalize();
  const upper = dir.clone().applyAxisAngle(n, a);
  const bend = PI - Math.acos(clamp((l1 * l1 + l2 * l2 - dist * dist) / (2 * l1 * l2), -1, 1));
  return { q: frameQ(upper, dir), bend };
}

// ── body dimensions ──────────────────────────────────────────────────────────
// Lengths in metres. standY = hip-joint height when standing = thighL + shinL + ankleH.
const ADULT = {
  hipX: 0.062, thighL: 0.195, thighR: 0.05, shinL: 0.19, shinR: 0.043, ankleH: 0.045,
  footW: 0.078, footH: 0.05, footL: 0.13, footZ: 0.03,
  spineY: 0.05, tw: 1, th: 1, shoulderX: 0.142, shoulderY: 0.205, neckY: 0.255, neckR: 0.036,
  uArmL: 0.145, uArmR: 0.038, fArmL: 0.13, fArmR: 0.033, handR: 0.036,
  headR: 0.11, headY: 0.1, standY: 0.43,
};
const CHILD = {
  hipX: 0.05, thighL: 0.125, thighR: 0.043, shinL: 0.12, shinR: 0.037, ankleH: 0.035,
  footW: 0.066, footH: 0.043, footL: 0.1, footZ: 0.022,
  spineY: 0.034, tw: 0.82, th: 0.64, shoulderX: 0.114, shoulderY: 0.131, neckY: 0.163, neckR: 0.03,
  uArmL: 0.094, uArmR: 0.032, fArmL: 0.084, fArmR: 0.028, handR: 0.031,
  headR: 0.094, headY: 0.083, standY: 0.28,
};
// torso profile [radius, y] in the spine frame (adult), flattened front-to-back when built
const TORSO = [[0, -0.078], [0.084, -0.074], [0.1, -0.045], [0.103, 0.0], [0.112, 0.07], [0.122, 0.14],
  [0.124, 0.18], [0.112, 0.217], [0.082, 0.243], [0.04, 0.258], [0, 0.261]];

// ── colours ──────────────────────────────────────────────────────────────────
const CLOTHES = ["#3f74c4", "#d0483c", "#2f9a95", "#e38b3a", "#4f9a58", "#7a55b8", "#d9a33a", "#d65f7d", "#3a5a9c"];
const BOTTOMS = ["#33405e", "#3a3d44", "#5a4634", "#4a5363", "#2f3b52", "#5b4a3f"];
const SHOES = ["#2b2522", "#4a3326", "#22252b", "#5a3a28"];
const ROBES = ["#efe6d2", "#f4f1ea", "#e9dcc2"];
const SASHES = ["#a5243a", "#7a55b8", "#3f74c4", "#2f9a95", "#b8862e"];
const EYE = "#24262c", MOUTH = "#7a3b30";

/** Colours of one figure; deterministic in the seed. mono (a stone colour) paints everything alike. */
function outfit(p, seed, variant, mono) {
  const r = rng(seed * 7919 + 13);
  const skin = r.pick(C.skin), hair = r.pick(C.hair), style = r.int(0, 3), beard = r() < 0.5;
  const shirt = r.pick(CLOTHES), bottoms = r.pick(BOTTOMS), shoes = r.pick(SHOES);
  const robe = r.pick(ROBES), sash = r.pick(SASHES);
  const robed = variant === "robed";
  const col = {
    skin, hair: p.color2 || hair, style, beard: robed && beard,
    shirt: p.color || (robed ? robe : shirt), bottoms: robed ? (p.color || robe) : bottoms, shoes,
    sash: robed && p.color ? shade(p.color, -0.18) : sash, belt: "#3a2c22", eye: EYE, mouth: MOUTH,
    collar: robed ? null : "#f4f1ea", kind: "matte",
  };
  if (robed && p.color) col.sash = mix(p.color, "#c8a050", 0.6);
  if (mono) {
    for (const k of ["skin", "hair", "shirt", "bottoms", "shoes", "sash", "belt", "collar"]) col[k] = mono.color;
    col.eye = shade(mono.color, -0.12);
    col.mouth = shade(mono.color, -0.14);
    col.kind = mono.kind;
    col.mono = true;
  }
  return col;
}

// ── poses ────────────────────────────────────────────────────────────────────
// Angles in degrees. Pelvis: rx (+ tips forward), ry, rz; y = fixed hip height (else feet find the ground).
// sp = spine [x (+ bends forward), y (twist), z]; nk = neck, likewise (+x looks down).
// Arms ra/la: { f: raise forward, a: raise sideways, t: twist (elbow bends up when raised sideways),
//   e: elbow bend } or { to: wrist target [x,y,z] in the spine frame, pole: where the elbow points };
//   hand: fist | open | point; palm/fing: palm normal and finger direction in the spine frame; w: wrist euler.
// Legs rl/ll: { f: thigh forward, a: sideways, t: twist, k: knee bend, tip: toes down (feet are kept flat
//   on the ground otherwise), an: fixed ankle angle }.
// two: both hands hold one item (carry, lift, read). hold: how a held item sits in the right hand.
export const POSES = {
  stand: {
    ra: { f: 4, a: 9, e: 12 }, la: { f: 4, a: 9, e: 12 }, rl: { a: 3 }, ll: { a: 3 },
  },
  walk: {
    sp: [4, -6, 0], nk: [-3, 5, 0],
    ra: { f: -22, a: 9, e: 16 }, la: { f: 16, a: 8, e: 30 },
    rl: { f: 11, k: 4 }, ll: { f: -8, k: 18, tip: 12 },
  },
  run: {
    sp: [10, -8, 0], nk: [-10, 6, 0], mouth: "open",
    ra: { f: -24, a: 16, e: 95 }, la: { f: 24, a: 12, e: 108 },
    rl: { f: 42, k: 86 }, ll: { f: 4, a: 8, t: -65, k: 88, tip: 30 }, skirt: "short",
  },
  point: {
    nk: [-6, -12, 0],
    ra: { f: 128, a: 29, e: 6, hand: "point" },
    la: { to: [0.13, -0.04, -0.01], pole: [0.5, -0.1, -1], hand: "fist" },
    rl: { a: 4 }, ll: { f: 4, a: 3, k: 4 }, hold: "along",
  },
  wave: {
    nk: [0, 0, -7],
    ra: { f: 6, a: 78, t: 90, e: 110, hand: "open", palm: [0, 0, 1], fing: [0.15, 1, 0] }, la: { f: 3, a: 9, e: 12 },
    rl: { a: 3 }, ll: { a: 3 },
  },
  cheer: {
    sp: [-4, 0, 0], nk: [-16, 0, 0], mouth: "open", brow: 1,
    ra: { f: 10, a: 166, e: 14 }, la: { f: 10, a: 166, e: 14 }, rl: { a: 9 }, ll: { a: 9 },
  },
  think: {
    nk: [6, 0, 9], mouth: "flat", brow: 1,
    ra: { to: [-0.035, 0.2, 0.13], pole: [-0.6, -1, 0.3], hand: "fist" },
    la: { to: [-0.08, 0.04, 0.12], pole: [0.6, -1, -0.3], hand: "fist" },
    rl: { a: 3 }, ll: { f: 6, a: 2, k: 8 },
  },
  sit: {
    y: "seat", z: -0.02, sp: [-3, 0, 0], skirt: "short",
    ra: { to: [-0.1, -0.03, 0.12], pole: [-1, -0.3, -0.3], hand: "open", palm: [0, -1, 0.1], fing: [0, -0.2, 1] },
    la: { to: [0.1, -0.03, 0.12], pole: [1, -0.3, -0.3], hand: "open", palm: [0, -1, 0.1], fing: [0, -0.2, 1] },
    rl: { f: 88, a: 4, k: 96, tip: 38 }, ll: { f: 88, a: 4, k: 96, tip: 38 },
  },
  kneel: {
    sp: [4, 0, 0], skirt: "short",
    ra: { to: [-0.07, -0.06, 0.17], pole: [-1, -0.4, -0.2], hand: "fist" }, la: { f: 2, a: 10, e: 14 },
    rl: { f: 55, a: 6, k: 90 }, ll: { f: 5, a: 12, t: -55, k: 96, tip: 55 },
  },
  lift: {
    nk: [-12, 0, 0], two: "lift", rl: { a: 9, k: 4 }, ll: { a: 9, k: 4 },
  },
  carry: {
    two: "carry", rl: { a: 3 }, ll: { f: 4, a: 3, k: 6 },
  },
  push: {
    sp: [14, 0, 0], nk: [-14, 0, 0], skirt: "short", brow: -1, mouth: "flat",
    ra: { to: [-0.1, 0.2, 0.15], pole: [-1, -1, -0.5], hand: "open", palm: [0, 0, 1], fing: [0, 1, 0] },
    la: { to: [0.1, 0.2, 0.15], pole: [1, -1, -0.5], hand: "open", palm: [0, 0, 1], fing: [0, 1, 0] },
    rl: { f: 16, k: 26 }, ll: { f: -13, k: 4, tip: 20 },
  },
  pull: {
    rz: 7, sp: [-10, 34, 5], nk: [4, 10, -4], skirt: "short", brow: -1, mouth: "flat", rope: true,
    ra: { to: [-0.03, 0.03, 0.1], pole: [-1, -0.6, -0.4], hand: "fist" },
    la: { to: [0.04, 0.04, 0.16], pole: [1, -0.6, -0.4], hand: "fist" },
    rl: { f: -8, a: 4, k: 22 }, ll: { f: 16, a: 16, k: 2 },
  },
  throw: {
    ry: -4, sp: [-6, -6, 0], nk: [0, 10, 0], skirt: "short", ball: true,
    ra: { f: -8, a: 92, t: 90, e: 100 }, la: { f: 38, a: 48, e: 58, hand: "open", palm: [0.3, -0.2, 1], fing: [0.2, 0.5, 1] },
    rl: { f: -10, k: 12 }, ll: { f: 12, a: 6, k: 6 },
  },
  lie: {
    rx: -90, nk: [-8, 0, 0], skirt: "long",
    ra: { f: 0, a: 14, e: 10 }, la: { f: 0, a: 14, e: 10 },
    rl: { a: 4, an: -12 }, ll: { a: 4, an: -12 },
  },
  bow: {
    sp: [23, 0, 0], nk: [14, 0, 0],
    ra: { to: [0.02, 0.06, 0.1], pole: [-1, -0.6, 0.2], hand: "fist" },
    la: { f: -14, a: 12, e: 20 },
    rl: { f: -5 }, ll: { f: -5 },
  },
  read: {
    nk: [24, 0, 0], two: "read", rl: { a: 3 }, ll: { f: 4, a: 3, k: 5 },
  },
  shrug: {
    nk: [0, 0, 11], sh: 0.025, brow: 1, mouth: "flat",
    ra: { to: [-0.17, 0.06, 0.12], pole: [-0.3, -1, -0.6], hand: "open", palm: [0, 1, 0], fing: [-0.6, 0, 1] },
    la: { to: [0.17, 0.06, 0.12], pole: [0.3, -1, -0.6], hand: "open", palm: [0, 1, 0], fing: [0.6, 0, 1] },
    rl: { a: 4 }, ll: { f: 5, a: 3, k: 6 },
  },
  fight: {
    ry: -14, sp: [5, 14, 0], nk: [6, -12, 0], brow: -1, mouth: "flat",
    ra: { to: [-0.07, 0.24, 0.08], pole: [-0.5, -1, -0.2], hand: "fist" },
    la: { to: [0.06, 0.25, 0.13], pole: [0.6, -1, -0.1], hand: "fist" },
    rl: { f: -7, a: 10, k: 18 }, ll: { f: 10, a: 8, k: 22 },
  },
  fall: {
    rx: -6, rz: 6, sp: [-6, 0, 4], nk: [-14, 0, 6], mouth: "open", brow: 1, skirt: "short",
    ra: { f: -20, a: 165, e: 45, hand: "open" }, la: { f: -25, a: 165, e: 30, hand: "open" },
    rl: { f: -2, a: 4, k: 4 }, ll: { f: 18, a: 24, k: 30 },
  },
};

// the right arm when a held item asks for it and the pose leaves that arm free
const HOLD_ARM = { f: 14, a: 12, e: 78, hand: "fist" };
const FREE_RIGHT = new Set(["stand", "walk", "sit", "kneel", "bow", "lie", "fall"]);

// ── held items ───────────────────────────────────────────────────────────────
// How each holdable prop sits in a fist: g = grip height as a fraction of the prop's height, x = grip offset
// as a fraction of its width, flip = held upside down (hilt or handle at the top of the standing prop),
// t = largest side when held (metres, default 0.25).
const HOLD = {
  book: { g: 0.12 }, bottle: { g: 0.3 }, camera: { g: 0.2, t: 0.22 }, candle: { g: 0.2 }, coin: { g: 0.06, t: 0.16 },
  cup: { g: 0.4, t: 0.17 }, envelope: { g: 0.1, t: 0.24 }, flag: { g: 0.18, x: -0.42, t: 0.4 }, fruit: { g: 0.12, t: 0.15 },
  gavel: { g: 0.35, t: 0.22 }, hammer: { g: 0.85, flip: true, t: 0.26 }, key: { g: 0.86, flip: true, t: 0.24 },
  lantern: { g: 0.96, t: 0.26 }, magnifier: { g: 0.14 }, medal: { g: 0.94, t: 0.24 }, megaphone: { g: 0.2, t: 0.24 },
  pencil: { g: 0.3, t: 0.26 }, scroll: { g: 0.1, t: 0.27 }, shield: { g: 0.45, t: 0.28 }, smartphone: { g: 0.1, t: 0.22 },
  stopwatch: { g: 0.06, t: 0.2 }, sword: { g: 0.86, flip: true, t: 0.32 }, torch: { g: 0.22, t: 0.3 },
  wrench: { g: 0.22 },
};

function openBook(b, w, h, cover) {
  for (const s of [-1, 1]) {
    b.group({ rot: [0, s * 0.2, 0] }, () => {
      b.box(w / 2 - 0.006, h - 0.012, 0.016, { at: [s * (w / 4 - 0.002), 0, -0.004], r: 0.004, color: C.paper });
      b.box(w / 2 + 0.002, h, 0.008, { at: [s * w / 4, 0, 0.008], r: 0.003, color: cover });
      for (let i = 1; i <= 3; i++) {
        b.box(w / 2 - 0.05, 0.004, 0.002, { at: [s * (w / 4 + 0.004), h / 2 - 0.035 - i * 0.03, -0.0125], r: 0,
          color: "#b9b2a2" });
      }
    });
  }
  b.cyl(0.012, 0.012, h, { at: [0, 0, 0.008], color: shade(cover, -0.1), seg: 8 });
}

function barbell(b, w) {
  b.rod([-w / 2, 0, 0], [w / 2, 0, 0], 0.011, { color: C.steel, kind: "metal", seg: 10 });
  b.mirrorX(() => {
    b.cyl(0.085, 0.085, 0.032, { at: [w / 2 - 0.07, 0, 0], rot: [0, 0, PI / 2], color: C.charcoal, seg: 18 });
    b.cyl(0.066, 0.066, 0.026, { at: [w / 2 - 0.04, 0, 0], rot: [0, 0, PI / 2], color: C.red, seg: 18 });
    b.cyl(0.022, 0.022, 0.02, { at: [w / 2 - 0.096, 0, 0], rot: [0, 0, PI / 2], color: C.steel, kind: "metal", seg: 10 });
  });
}

/** Both hands hold one item: an open book (read), a crate (carry), a barbell (lift) or the held prop. */
function twoHand(kind, hold, D) {
  const k = D.tw, r = D.handR;
  const reach = D.uArmL + D.fArmL;
  const chest = 0.124 * 0.64 * k;
  let w, h, d, lie = false, item = hold;
  if (kind === "read" && (!hold || hold === "book")) { w = 0.27 * k; h = 0.19 * k; d = 0.03; item = "@book"; }
  else if (!hold && kind === "lift") { w = 0.5 * k; h = 0.17 * k; d = 0.17 * k; item = "@barbell"; }
  else if (!hold) { w = h = d = 0.16 * k; item = "crate"; }
  else {
    ({ w, h, d } = heldSize(hold));
    if (kind !== "read" && h > 1.7 * w) { lie = true; [w, h] = [h, w]; }
  }
  let c, rot = [0, 0, 0], hands;
  const side = (s, x, y, z, palm, fing, shape = "open", pole) => {
    const f = V3(...fing).normalize();
    const off = shape === "open" ? r * 1.12 : r * 0.82;
    return { to: [x - f.x * off, y - f.y * off, z - f.z * off], palm, fing, hand: shape, pole: pole || [s, -1, -0.4] };
  };
  if (kind === "lift") {
    const hy = D.shoulderY + reach * 0.96 + r * 0.6;
    if (item === "@barbell") {
      c = V3(0, hy + 0.004, 0.03);
      hands = (s) => side(s, s * 0.105 * k, hy, 0.03, [0, 0, 1], [0, 1, 0.1], "fist", [s, -0.3, -0.5]);
    } else {
      c = V3(0, hy + h * 0.2, 0.03);
      hands = (s) => side(s, s * (w / 2 + r * 0.36), hy, 0.03, [-s, 0, 0], [0, 1, 0.15], "open", [s, -0.3, -0.5]);
    }
  } else if (kind === "carry") {
    c = V3(0, D.shoulderY - 0.11 * D.th, chest + d / 2 + 0.008);
    hands = (s) => side(s, s * (w / 2 + r * 0.36), c.y - h * 0.08, c.z + d * 0.05, [-s, 0, 0], [0, 0.25, 1]);
  } else {
    c = V3(0, D.shoulderY - 0.085 * D.th, chest + 0.1 * k);
    rot = item === "@book" ? [0.55, 0, 0] : [-0.35, PI, 0];
    hands = (s) => side(s, s * (w / 2 - 0.012), c.y - h * 0.32, c.z + 0.012, [0, 1, 0.3], [-s * 0.5, 0.2, 1]);
  }
  const draw = (b, cfg) => {
    b.group({ at: [c.x, c.y, c.z], rot }, () => {
      if (item === "@book") openBook(b, w, h, cfg.col.mono ? cfg.col.shirt : "#b0383a");
      else if (item === "@barbell") barbell(b, w);
      else if (item === "crate") b.prop("crate", {}, { at: [0, -h / 2, 0], scale: h / 0.4 });
      else {
        const { s, h: H } = heldSize(item);
        b.prop(item, {}, lie ? { at: [H / 2, 0, 0], rot: [0, 0, PI / 2], scale: s } : { at: [0, -H / 2, 0], scale: s });
      }
    });
  };
  return { ra: hands(-1), la: hands(1), draw };
}

// ── the rig ──────────────────────────────────────────────────────────────────
/** Shoulder rotation, elbow bend and wrist rotation for an arm spec (s = -1 right, +1 left). */
function armSolve(spec, s, D, sh) {
  let q, bend;
  if (spec.to) {
    const base = V3(s * D.shoulderX, D.shoulderY + sh, 0);
    const pole = V3(...(spec.pole || [s, -1, -0.3])).normalize();
    ({ q, bend } = ik(base, V3(...spec.to), D.uArmL, D.fArmL, pole));
  } else {
    q = quat(-(spec.f || 0) * D2R, s * (spec.t || 0) * D2R, s * (spec.a || 0) * D2R, "XZY");
    bend = (spec.e || 0) * D2R;
  }
  const qe = quat(-bend, 0, 0);
  let qw = new THREE.Quaternion();
  if (spec.palm || spec.fing) {
    const want = frameQ(V3(...(spec.fing || [0, -1, 0])), V3(...(spec.palm || [0, 0, 1])));
    qw = q.clone().multiply(qe).invert().multiply(want);
  } else if (spec.w) qw = quat(...rad(spec.w));
  return { q, qe, qw, hand: spec.hand || "fist" };
}

/** Hip rotation, knee bend and an ankle that keeps the sole flat on the ground (tilted by tip). */
function legSolve(spec, s, qP) {
  const qh = quat(-(spec.f || 0) * D2R, s * (spec.t || 0) * D2R, s * (spec.a || 0) * D2R, "XZY");
  const qk = quat((spec.k || 0) * D2R, 0, 0);
  if (spec.an !== undefined) return { qh, qk, qa: quat(spec.an * D2R, 0, 0) };
  const chain = qP.clone().multiply(qh).multiply(qk);
  const fwd = V3(0, 0, 1).applyQuaternion(chain).setY(0);
  if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1);
  fwd.normalize();
  const up = V3(0, 1, 0);
  const flat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V3().crossVectors(up, fwd), up, fwd));
  flat.multiply(quat((spec.tip || 0) * D2R, 0, 0));
  return { qh, qk, qa: chain.invert().multiply(flat) };
}

/** Radius of the torso profile at height y (spine frame, adult units). */
function torsoR(y) {
  for (let i = 1; i < TORSO.length; i++) {
    const [r0, y0] = TORSO[i - 1], [r1, y1] = TORSO[i];
    if (y <= y1) return r0 + (r1 - r0) * clamp((y - y0) / (y1 - y0 || 1), 0, 1);
  }
  return 0;
}

function hand(b, shape, s, r, skin, sg, k) {
  if (shape === "open") {
    b.box(r * 1.7, r * 2.15, r * 0.72, { at: [0, -r * 1.12, 0], r: r * 0.33, color: skin, kind: k, seg: 1 });
    b.capsule(r * 0.3, r * 0.7, { at: [s * r * 0.98, -r * 0.62, r * 0.12], rot: [0, 0, s * 0.75], color: skin,
      seg: sg(8), capSeg: 2, kind: k });
  } else {
    b.sphere(r, { at: [0, -r * 0.82, 0.004], scale: [0.95, 1.05, 0.92], color: skin, seg: sg(10), kind: k });
    if (shape === "point") {
      b.capsule(r * 0.3, r * 1.25, { at: [0, -r * 2.2, r * 0.3], color: skin, seg: sg(8), capSeg: 2, kind: k });
    }
  }
}

function hair(b, R, c, style, k, sg) {
  b.sphere(R * 1.055, { thetaLength: 1.74, rot: [-0.5, 0, 0], color: c, seg: sg(16), kind: k });
  if (style === 1) {
    b.sphere(R * 0.45, { at: [R * 0.16, R * 0.78, R * 0.4], scale: [1.35, 0.62, 1], rot: [0.35, 0, -0.35], color: c,
      seg: sg(12), kind: k });
  } else if (style === 2) {
    const gap = 2.4;
    b.sphere(R * 1.09, { thetaLength: 2.2, phiLength: 2 * PI - gap, rot: [0, PI / 2 + gap / 2, 0], color: c,
      seg: sg(16), kind: k });
  } else if (style === 3) {
    b.sphere(R * 0.36, { at: [0, R * 0.6, -R * 0.82], color: c, seg: sg(12), kind: k });
  }
}

function head(b, cfg, sg) {
  const { col, P } = cfg, R = cfg.D.headR, k = col.kind, mono = col.mono;
  b.sphere(R, { color: col.skin, seg: sg(18), scale: [1, 1, 0.97], kind: k });
  if (!cfg.lo) {
    b.mirrorX(() => b.sphere(R * 0.2, { at: [R * 0.97, -R * 0.06, -R * 0.02], scale: [0.55, 1, 0.85], color: col.skin,
      seg: 6, kind: k }));
  }
  // eyes and brows
  const brow = P.brow || 0;
  b.mirrorX((bb, s) => {
    bb.sphere(R * 0.13, { at: [R * 0.36, R * 0.03, R * 0.9], scale: [0.82, 1.2, 0.6], color: col.eye,
      kind: mono ? k : "gloss", seg: sg(8) });
    if (!mono) {
      bb.capsule(R * 0.035, R * 0.16, { at: [R * 0.37, R * (0.27 + 0.05 * brow), R * 0.88],
        rot: [-0.25, 0, PI / 2 + 0.28 * brow], color: shade(col.hair, -0.05), seg: 5, capSeg: 1, kind: k });
    }
  });
  // nose, cheeks
  b.sphere(R * 0.15, { at: [0, -R * 0.13, R * 0.96], scale: [1, 0.95, 0.9], color: shade(col.skin, -0.035),
    seg: sg(8), kind: k });
  if (!mono && !cfg.lo) {
    b.mirrorX(() => b.sphere(R * 0.15, { at: [R * 0.6, -R * 0.27, R * 0.76], scale: [1, 0.65, 0.4],
      color: mix(col.skin, "#e8737a", 0.32), seg: 6 }));
  }
  // mouth
  const beard = col.beard;
  const mouth = P.mouth || "smile";
  if (!beard) {
    if (mouth === "open") {
      b.sphere(R * 0.12, { at: [0, -R * 0.44, R * 0.86], scale: [0.85, 1, 0.5], color: col.mouth, seg: sg(10), kind: k });
    } else if (mouth === "flat") {
      b.capsule(R * 0.035, R * 0.18, { at: [0, -R * 0.44, R * 0.885], rot: [0, 0, PI / 2], color: col.mouth, seg: 5,
        capSeg: 1, kind: k });
    } else {
      b.torus(R * 0.19, R * 0.04, { at: [0, -R * 0.36, R * 0.9], rot: [0.42, 0, PI], arc: PI, color: col.mouth,
        seg: 8, tubeSeg: 4, kind: k });
    }
  }
  hair(b, R, col.hair, col.style, k, sg);
  if (beard) {
    b.sphere(R * 0.62, { at: [0, -R * 0.5, R * 0.42], scale: [1.18, 1.05, 0.82], color: col.hair, seg: sg(14), kind: k });
    b.mirrorX(() => b.capsule(R * 0.07, R * 0.22, { at: [R * 0.15, -R * 0.33, R * 0.9], rot: [0, 0, PI / 2 + 0.35],
      color: shade(col.hair, -0.04), seg: 6, capSeg: 1, kind: k }));
  }
  if (cfg.hat && cfg.hat !== "none" && HATS[cfg.hat]) HATS[cfg.hat](b, R, cfg, sg);
}

/** Build one person; returns the wrist frames (relative to the person's root) for placing held items. */
function person(b, cfg) {
  const { D, P, col } = cfg, k = col.kind;
  const sg = (n) => (cfg.lo ? Math.max(5, Math.round(n * 0.55)) : n);
  const capSeg = cfg.lo ? 1 : 2;
  const robed = cfg.variant === "robed", child = cfg.variant === "child";
  const rootInv = b.matrix.clone().invert();
  const grab = () => rootInv.clone().multiply(b.matrix);
  const out = {};
  const qP = quat(...rad([P.rx || 0, P.ry || 0, P.rz || 0]));
  const sh = P.sh || 0;
  b.group({ at: [0, cfg.y, cfg.z], rot: toRot(qP) }, () => {
    // hips
    b.sphere(0.1 * D.tw, { at: [0, 0.024 * D.th, -0.004], scale: [1.08, 0.64, 0.8], color: col.bottoms, seg: sg(14), kind: k });
    for (const s of [-1, 1]) {
      const L = legSolve((s < 0 ? P.rl : P.ll) || {}, s, qP);
      b.group({ at: [s * D.hipX, 0, 0], rot: toRot(L.qh) }, () => {
        b.capsule(D.thighR, D.thighL, { at: [0, -D.thighL / 2, 0], color: child ? col.skin : col.bottoms, seg: sg(10),
          capSeg, kind: k });
        if (child) {
          b.capsule(D.thighR * 1.18, D.thighL * 0.42, { at: [0, -D.thighL * 0.24, 0], color: col.bottoms, seg: sg(10),
            capSeg, kind: k });
        }
        b.group({ at: [0, -D.thighL, 0], rot: toRot(L.qk) }, () => {
          if (robed) {
            b.cyl(D.shinR * 1.25, D.shinR * 1.95, D.shinL + 0.02, { at: [0, -D.shinL / 2 - 0.012, 0], color: col.bottoms,
              seg: sg(16), kind: k });
          } else {
            b.capsule(D.shinR, D.shinL, { at: [0, -D.shinL / 2, 0], color: child ? col.skin : col.bottoms, seg: sg(10),
              capSeg, kind: k });
            if (child) {
              b.cyl(D.shinR * 1.12, D.shinR * 1.12, D.shinL * 0.3, { at: [0, -D.shinL * 0.86, 0], color: col.collar || col.skin,
                seg: sg(12), kind: k });
            }
          }
          b.group({ at: [0, -D.shinL, 0], rot: toRot(L.qa) }, () => {
            b.box(D.footW, D.footH, D.footL, { at: [0, -D.ankleH + D.footH / 2, D.footZ], r: D.footH * 0.42,
              color: col.shoes, kind: k, seg: 1 });
          });
        });
      });
    }
    if (robed) {
      const hem = P.skirt === "short" ? 0.2 : D.standY - 0.035;
      b.lathe([[0, 0.035], [0.106, 0.035], [0.118, -0.04], [0.135, -hem * 0.45], [0.152, -hem * 0.85], [0.156, -hem],
        [0, -hem]], { scale: [1, 1, 0.78], color: col.bottoms, seg: sg(22), kind: k });
    }
    // spine: torso, arms, neck and head
    b.group({ at: [0, D.spineY, 0], rot: rad(P.sp) }, () => {
      const tw = D.tw, th = D.th;
      b.lathe(TORSO.map(([r, y]) => [r * tw, y * th]), { scale: [1, 1, 0.64], color: col.shirt, seg: sg(18), kind: k });
      if (robed) {
        // a sash from the left shoulder across the chest to the right hip, and round the back
        for (const side of [1, -1]) {
          const pts = [];
          for (let i = 0; i <= 6; i++) {
            const t = i / 6, y = (0.235 - 0.27 * t), x = 0.085 - 0.19 * t;
            const r = torsoR(y);
            const z = side * (0.64 * Math.sqrt(Math.max(0, r * r - x * x)) + 0.006);
            pts.push([x * tw, y * th, z * tw]);
          }
          b.tube(pts, 0.016 * tw, { color: col.sash, radial: 6, seg: sg(20), kind: k });
        }
        b.cyl(0.104 * tw, 0.104 * tw, 0.02 * th, { at: [0, -0.04 * th, 0], scale: [1, 1, 0.66], color: col.sash,
          seg: sg(20), kind: k });
      } else {
        b.cyl(0.102 * tw, 0.102 * tw, 0.024 * th, { at: [0, -0.042 * th, 0], scale: [1, 1, 0.66], color: col.belt,
          seg: sg(20), kind: k });
        if (!col.mono) {
          b.box(0.03 * tw, 0.022 * th, 0.008, { at: [0, -0.042 * th, 0.102 * tw * 0.66 + 0.002], r: 0,
            color: C.brass, kind: "metal" });
        }
        if (col.collar && !child) {
          b.torus(0.047, 0.012, { at: [0, 0.247, 0.008], rot: [PI / 2 + 0.3, 0, 0], color: col.collar, seg: sg(14),
            tubeSeg: 5, kind: k });
        }
      }
      // arms
      for (const s of [-1, 1]) {
        const A = armSolve((s < 0 ? P.ra : P.la) || {}, s, D, sh);
        b.group({ at: [s * D.shoulderX, D.shoulderY + sh, 0], rot: toRot(A.q) }, () => {
          b.sphere(D.uArmR * 1.07, { color: col.shirt, seg: sg(10), kind: k });
          b.capsule(D.uArmR, D.uArmL, { at: [0, -D.uArmL / 2, 0], color: child ? col.skin : col.shirt, seg: sg(10),
            capSeg, kind: k });
          if (child) {
            b.capsule(D.uArmR * 1.2, D.uArmL * 0.4, { at: [0, -D.uArmL * 0.2, 0], color: col.shirt, seg: sg(10),
              capSeg, kind: k });
          }
          b.group({ at: [0, -D.uArmL, 0], rot: toRot(A.qe) }, () => {
            if (robed) {
              b.cyl(D.fArmR * 1.1, D.fArmR * 1.8, D.fArmL + 0.012, { at: [0, -D.fArmL / 2 - 0.004, 0], color: col.shirt,
                seg: sg(14), kind: k });
            } else {
              b.capsule(D.fArmR, D.fArmL, { at: [0, -D.fArmL / 2, 0], color: child ? col.skin : col.shirt, seg: sg(10),
                capSeg, kind: k });
            }
            b.group({ at: [0, -D.fArmL, 0], rot: toRot(A.qw) }, () => {
              hand(b, A.hand, s, D.handR, col.skin, sg, k);
              out[s < 0 ? "handR" : "handL"] = grab();
            });
          });
        });
      }
      if (cfg.two && !cfg.bodyOnly) cfg.two.draw(b, cfg);
      // neck and head
      b.group({ at: [0, D.neckY, 0], rot: rad(P.nk) }, () => {
        b.capsule(D.neckR, 0.03 * th, { at: [0, 0.01, 0], color: col.skin, seg: sg(10), capSeg: 2, kind: k });
        b.group({ at: [0, D.headY, 0.006] }, () => head(b, cfg, sg));
      });
    });
  });
  return out;
}

// ── figure assembly: grounding, held items ───────────────────────────────────
const GROUND = new Map();
const VARIANTS = ["adult", "child", "robed"];

/** Size [w, h, d] and scale of a holdable prop when held. */
function heldSize(name) {
  const [w, h, d] = PROPS[name].size;
  const s = (HOLD[name]?.t ?? 0.25) / Math.max(w, h, d);
  return { w: w * s, h: h * s, d: d * s, s };
}

/** Put a held prop into the hand frame M (relative to the person root); mode upright | along. */
function placeHeld(b, name, M, mode, D) {
  const spec = HOLD[name] || {};
  const [w, h] = PROPS[name].size;
  const { s } = heldSize(name);
  const pos = V3(), qh = new THREE.Quaternion(), sc = V3();
  M.decompose(pos, qh, sc);
  const q = new THREE.Quaternion();
  if (mode === "along") q.setFromUnitVectors(V3(0, 1, 0), V3(0, -1, 0).applyQuaternion(qh));
  if (spec.flip) q.multiply(quat(0, 0, PI));
  const grip = V3((spec.x || 0) * w, (spec.g ?? 0.3) * h, 0).multiplyScalar(s).applyQuaternion(q);
  const centre = V3(0, -D.handR * 0.82, 0.004).applyMatrix4(M);
  const at = centre.sub(grip);
  b.prop(name, {}, { at: [at.x, at.y, at.z], rot: toRot(q), scale: s });
}

function buildFigure(b, p, opts = {}) {
  const variant = VARIANTS.includes(p.variant) ? p.variant : "adult";
  const poseName = POSES[p.pose] ? p.pose : "stand";
  const D = variant === "child" ? CHILD : ADULT;
  const hold = opts.noHold ? null : (p.hold && PROPS[p.hold] ? p.hold : null);
  let P = POSES[poseName];
  if (hold && FREE_RIGHT.has(poseName)) P = { ...P, ra: HOLD_ARM, hold: "upright" };
  const two = P.two ? twoHand(P.two, hold, D) : null;
  if (two) P = { ...P, ra: two.ra, la: two.la };
  const col = outfit(p, seedOf(b, p), variant, opts.mono);
  const cfg = { D, P, col, variant, lo: !!opts.lo, hat: opts.mono ? null : p.hat, two };
  // sitting puts the hips on a 0.45 m seat; every other pose stands its lowest point on the ground,
  // centred front to back
  const key = [variant, poseName, two ? hold : "", cfg.lo ? 1 : 0, b.lod].join("|");
  let g = GROUND.get(key);
  if (!g) {
    const tmp = new Builder({ lod: b.lod });
    person(tmp, { ...cfg, y: D.standY, z: 0, bodyOnly: true });
    const box = measure(tmp);
    g = { dy: -box.min.y, cz: (box.min.z + box.max.z) / 2 };
    GROUND.set(key, g);
  }
  const seat = P.y === "seat";
  cfg.y = seat ? 0.45 + D.thighR : D.standY + g.dy;
  cfg.z = seat ? (P.z || 0) : -g.cz;
  const frames = person(b, cfg);
  if (two) return;
  if (hold) placeHeld(b, hold, frames.handR, P.hold || "upright", D);
  else if (P.ball) {
    const c = V3(0, -D.handR * 0.8, 0.02).applyMatrix4(frames.handR);
    b.sphere(D.handR * 1.25, { at: [c.x, c.y, c.z], color: C.red, kind: "gloss", seg: 14 });
  }
  if (P.rope) rope(b, frames, D);
}

/** The rope of the pull pose: through both fists, taut down to a peg in the ground, a loose tail behind. */
function rope(b, frames, D) {
  const c = (M) => V3(0, -D.handR * 0.8, 0.004).applyMatrix4(M);
  const back = c(frames.handR), front = c(frames.handL);
  const dir = front.clone().sub(back).normalize();
  const flat = V3(dir.x, 0, dir.z).normalize();
  const tail = back.clone().addScaledVector(dir, -0.05);
  const peg = V3(front.x + flat.x * 0.12, 0, front.z + flat.z * 0.12);
  const o = { color: "#c9a46a", radial: 6 };
  b.tube([[tail.x - 0.01, tail.y - 0.16, tail.z - 0.02], [tail.x, tail.y - 0.05, tail.z], [back.x, back.y, back.z]],
    0.011, { ...o, seg: 12 });
  b.tube([[back.x, back.y, back.z], [front.x, front.y, front.z], [peg.x, 0.05, peg.z]], 0.011, { ...o, curve: "line", seg: 2 });
  b.cyl(0.016, 0.012, 0.07, { at: [peg.x, 0.035, peg.z], color: C.darkWood, seg: 8 });
  b.torus(0.02, 0.008, { at: [peg.x, 0.05, peg.z], rot: [PI / 2, 0, 0], color: "#c9a46a", seg: 10, tubeSeg: 4 });
}

// ── hats (built in the head frame: origin at the head centre, R = head radius) ───────────────────────
function starPts(ro, ri, n = 5) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = PI / 2 + i * PI / n, r = i % 2 ? ri : ro;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

const HATS = {
  top_hat(b, R, cfg, sg) {
    const c = "#2a2b31";
    b.group({ at: [0, R * 0.6, -R * 0.03], rot: [-0.1, 0, 0] }, () => {
      b.cyl(R * 1.34, R * 1.34, R * 0.08, { color: c, seg: sg(26) });
      b.cyl(R * 0.92, R * 0.88, R * 1.38, { at: [0, R * 0.72, 0], color: c, seg: sg(22) });
      b.cyl(R * 0.905, R * 0.9, R * 0.24, { at: [0, R * 0.17, 0], color: "#a5243a", seg: sg(22) });
    });
  },
  cap(b, R, cfg, sg) {
    const c = mix(cfg.col.shirt, "#22252b", 0.18);
    b.group({ rot: [-0.2, 0, 0] }, () => {
      b.sphere(R * 1.09, { thetaLength: 1.3, color: c, seg: sg(22) });
      b.sphere(R * 0.12, { at: [0, R * 1.08, 0], color: c, seg: 8 });
      b.cyl(R * 0.85, R * 0.85, R * 0.07, { at: [0, R * 0.29, R * 0.74], rot: [0.16, 0, 0], thetaStart: -PI / 2,
        thetaLength: PI, color: shade(c, -0.07), seg: sg(18) });
    });
  },
  crown(b, R, cfg, sg) {
    b.group({ at: [0, R * 0.52, 0], rot: [-0.1, 0, 0] }, () => {
      const g = { color: C.gold, kind: "metal" };
      b.lathe([[R * 0.88, 0], [R * 0.95, 0], [R * 1.0, R * 0.34], [R * 0.94, R * 0.34], [R * 0.86, R * 0.03],
        [R * 0.88, 0]], { ...g, seg: sg(28) });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI * 2, x = Math.sin(a) * R * 0.97, z = Math.cos(a) * R * 0.97;
        b.cone(R * 0.12, R * 0.36, { at: [x, R * 0.5, z], ...g, seg: 6 });
        b.sphere(R * 0.07, { at: [x, R * 0.7, z], ...g, seg: 8 });
      }
      for (const [a, c] of [[0, "#c8243a"], [PI / 2, "#2f6fc4"], [-PI / 2, "#2f6fc4"], [PI, "#c8243a"]]) {
        b.sphere(R * 0.09, { at: [Math.sin(a) * R * 0.99, R * 0.17, Math.cos(a) * R * 0.99], scale: [1, 1, 0.6],
          rot: [0, a, 0], color: c, kind: "gloss", seg: 10 });
      }
    });
  },
  graduation(b, R, cfg, sg) {
    const c = "#26282e";
    b.group({ rot: [-0.14, 0, 0] }, () => {
      b.sphere(R * 1.08, { thetaLength: 1.2, color: c, seg: sg(20) });
      b.box(R * 2.5, R * 0.08, R * 2.5, { at: [0, R * 1.03, 0], rot: [0, PI / 4, 0], r: 0.004, color: c });
      b.sphere(R * 0.09, { at: [0, R * 1.09, 0], color: C.gold, seg: 8 });
      b.tube([[0, R * 1.09, 0], [R * 0.9, R * 1.09, 0], [R * 1.72, R * 1.08, 0], [R * 1.78, R * 0.8, 0.0]], R * 0.025,
        { color: C.yellow, radial: 5, seg: 16 });
      b.cyl(R * 0.07, R * 0.11, R * 0.3, { at: [R * 1.78, R * 0.66, 0], color: C.yellow, seg: 8 });
    });
  },
  hood(b, R, cfg, sg) {
    const c = shade(cfg.col.shirt, -0.08), Rh = R * 1.2, open = 0.98;
    b.group({ at: [0, R * 0.04, -R * 0.08] }, () => {
      b.sphere(Rh, { thetaLength: PI - open, rot: [-PI / 2, 0, 0], color: c, seg: sg(24) });
      b.torus(Rh * Math.sin(open), R * 0.07, { at: [0, 0, Rh * Math.cos(open)], color: shade(c, -0.05), seg: sg(24),
        tubeSeg: 6 });
      b.cone(R * 0.42, R * 0.7, { at: [0, R * 0.62, -R * 1.02], rot: [-1.2, 0, 0], color: c, seg: sg(14) });
    });
    b.torus(R * 0.82, R * 0.26, { at: [0, -R * 0.92, -R * 0.08], rot: [PI / 2, 0, 0], scale: [1, 1, 0.8], color: c,
      seg: sg(22), tubeSeg: 8 });
  },
  helmet(b, R, cfg, sg) {
    const m = { color: "#b7bec7", kind: "metal" };
    b.group({ rot: [-0.18, 0, 0] }, () => {
      b.sphere(R * 1.12, { thetaLength: 1.66, ...m, seg: sg(22) });
      b.torus(R * 1.11, R * 0.065, { at: [0, -R * 0.1, 0], rot: [PI / 2, 0, 0], color: C.brass, kind: "metal", seg: sg(26),
        tubeSeg: 6 });
      b.mirrorX(() => b.box(R * 0.12, R * 0.62, R * 0.5, { at: [R * 1.0, -R * 0.42, R * 0.28], rot: [0.1, 0.35, -0.12],
        r: R * 0.05, ...m }));
      b.torus(R * 1.2, R * 0.2, { at: [0, R * 0.04, -R * 0.04], rot: [0, PI / 2, 0], scale: [1, 1, 0.42], arc: PI,
        color: "#b8283a", seg: sg(18), tubeSeg: 8 });
    });
  },
  laurel(b, R, cfg, sg) {
    const mono = cfg.col.mono, Rr = R * 1.04;
    for (const s of [-1, 1]) {
      for (let i = 0; i < 11; i++) {
        const t = i / 10, phi = s * (0.32 + t * (PI - 0.5)), up = i % 2 ? 1 : -1;
        const y = R * (0.3 + 0.12 * t);
        b.sphere(R * 0.17, { at: [Math.sin(phi) * Rr, y + up * R * 0.07, Math.cos(phi) * Rr],
          rot: [up * 0.55, PI / 2 + phi, 0], order: "YXZ", scale: [0.4, 0.2, 1],
          color: mono ? cfg.col.shirt : (i % 3 ? C.leaf : C.darkLeaf), kind: mono ? cfg.col.kind : "matte", seg: 7 });
      }
    }
  },
  hard_hat(b, R, cfg, sg) {
    const y = { color: "#f2c230", kind: "gloss" };
    b.group({ rot: [-0.14, 0, 0] }, () => {
      b.sphere(R * 1.12, { thetaLength: 1.42, ...y, seg: sg(22) });
      b.cyl(R * 1.27, R * 1.3, R * 0.07, { at: [0, R * 0.16, 0], ...y, seg: sg(24) });
      b.cyl(R * 0.62, R * 0.62, R * 0.07, { at: [0, R * 0.16, R * 0.95], thetaStart: -PI / 2, thetaLength: PI, ...y,
        seg: sg(14) });
      b.torus(R * 1.1, R * 0.09, { rot: [0, PI / 2, 0], arc: PI, ...y, seg: sg(18), tubeSeg: 6 });
    });
  },
  chef(b, R, cfg, sg) {
    const w = { color: "#f6f4ef" };
    b.group({ rot: [-0.12, 0, 0] }, () => {
      b.cyl(R * 0.94, R * 0.96, R * 0.55, { at: [0, R * 0.72, 0], ...w, seg: sg(22) });
      b.sphere(R * 1.0, { at: [0, R * 1.32, 0], scale: [1.18, 0.66, 1.18], ...w, seg: sg(20) });
      for (let i = 0; i < 6; i++) {
        const a = i * PI / 3 + 0.3;
        b.sphere(R * 0.42, { at: [Math.sin(a) * R * 0.78, R * 1.3, Math.cos(a) * R * 0.78], ...w, seg: sg(12) });
      }
    });
  },
  wizard(b, R, cfg, sg) {
    const c = "#3d3f8e";
    b.group({ at: [0, R * 0.6, -R * 0.05], rot: [-0.12, 0, 0] }, () => {
      b.cyl(R * 1.55, R * 1.55, R * 0.07, { color: c, seg: sg(26) });
      b.cyl(R * 0.52, R * 0.92, R * 1.05, { at: [0, R * 0.55, 0], color: c, seg: sg(20) });
      b.cyl(R * 0.935, R * 0.925, R * 0.16, { at: [0, R * 0.1, 0], color: C.gold, seg: sg(20) });
      b.group({ at: [0, R * 1.05, 0], rot: [-0.55, 0, 0] }, () => b.cone(R * 0.52, R * 0.95, { at: [0, R * 0.46, 0],
        color: c, seg: sg(16) }));
      for (const [x, y, s] of [[-0.3, 0.42, 0.2], [0.34, 0.72, 0.15], [0.05, 0.95, 0.12]]) {
        const rr = R * (0.92 - (y / 1.05) * 0.4);
        const ang = Math.asin(clamp(x * R / rr, -0.9, 0.9));
        b.extrude(starPts(R * s, R * s * 0.45), R * 0.03, { at: [Math.sin(ang) * rr, R * y, Math.cos(ang) * rr + R * 0.01],
          rot: [-0.35, ang, 0], color: C.yellow, bevel: 0 });
      }
    });
  },
  beret(b, R, cfg, sg) {
    const c = "#a8283c";
    b.group({ at: [R * 0.1, R * 0.8, -R * 0.06], rot: [-0.15, 0, -0.3] }, () => {
      b.sphere(R * 1.1, { scale: [1.05, 0.34, 1.05], color: c, seg: sg(22) });
      b.cyl(R * 0.05, R * 0.06, R * 0.16, { at: [0, R * 0.42, 0], color: c, seg: 6 });
    });
  },
};

export default {
  // A person about 0.95 m tall: pose, hat and a held item; color = clothes, color2 = hair.
  figure(b, p) {
    buildFigure(b, p);
  },

  // A statue of a person on a 0.35 m plinth, all in marble (a robed figure) or bronze (in modern dress).
  statue(b, p) {
    const bronze = p.variant === "bronze";
    const c = p.color || (bronze ? C.bronze : C.marble);
    const kind = bronze ? "metal" : "matte";
    const stone = bronze ? "#a19a8f" : shade(c, -0.05);
    b.box(0.5, 0.06, 0.5, { at: [0, 0.03, 0], r: 0.012, color: stone });
    b.box(0.46, 0.025, 0.46, { at: [0, 0.07, 0], r: 0.008, color: shade(stone, 0.03) });
    b.box(0.4, 0.2, 0.4, { at: [0, 0.18, 0], r: 0.01, color: shade(stone, 0.04) });
    b.box(0.44, 0.025, 0.44, { at: [0, 0.2925, 0], r: 0.008, color: shade(stone, 0.03) });
    b.box(0.48, 0.045, 0.48, { at: [0, 0.3275, 0], r: 0.012, color: stone });
    if (p.pose === "sit") {
      b.box(0.34, 0.45, 0.26, { at: [0, 0.35 + 0.225, -0.1], r: 0.015, color: shade(stone, 0.02) });
    }
    b.group({ at: [0, 0.35, 0] }, () => {
      buildFigure(b, { ...p, variant: bronze ? "adult" : "robed", color: undefined, color2: undefined },
        { mono: { color: c, kind }, noHold: true });
    });
  },

  // Six to eight smaller people in a loose cluster; the variant sets what they do.
  crowd(b, p) {
    const v = ["standing", "cheering", "marching"].includes(p.variant) ? p.variant : "standing";
    const seed = seedOf(b, p);
    const r = rng(seed * 31 + 7);
    const spots = v === "marching"
      ? [[-0.36, -0.2], [0, -0.22], [0.36, -0.2], [-0.36, 0.14], [0, 0.12], [0.36, 0.14], [0.02, 0.32]]
      : [[-0.44, -0.18], [-0.15, -0.22], [0.15, -0.2], [0.44, -0.17], [-0.3, 0.14], [0.01, 0.16], [0.3, 0.13],
        [0.5, 0.22]];
    const n = v === "marching" ? 7 : r() < 0.5 ? 7 : 8;
    const hats = ["none", "none", "none", "cap", "beret", "top_hat", "none", "hood"];
    for (let i = 0; i < n; i++) {
      const [x, z] = spots[i];
      let pose = "stand", mirror = r() < 0.5, hat = r.pick(hats), hold;
      const s = r.range(0.72, 0.8) * (r() < 0.15 ? 0.82 : 1);
      if (v === "cheering") pose = r() < 0.7 ? "cheer" : "wave";
      else if (v === "marching") { pose = "walk"; mirror = i % 2 === 1; hat = "none"; if (i === 6) hold = "flag"; }
      else pose = r.pick(["stand", "stand", "stand", "think", "point", "wave", "shrug"]);
      const jx = v === "marching" ? 0 : r.range(-0.04, 0.04), jz = v === "marching" ? 0 : r.range(-0.03, 0.03);
      const yaw = v === "marching" ? 0 : r.range(-0.35, 0.35) - x * 0.4;
      b.group({ at: [x + jx, 0, z + jz], rot: [0, yaw, 0], scale: [mirror ? -s : s, s, s] }, () => {
        buildFigure(b, { seed: seed * 13 + i * 101, pose, hat, hold, variant: "adult" }, { lo: true });
      });
    }
  },
};
