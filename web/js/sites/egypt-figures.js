// Statues in the Egyptian manner: kings and gods standing, striding, seated, kneeling or
// mummiform, with the headdress that names them; ram sphinxes, falcons, the scarab.
// A figure is modelled 1 unit tall (sole to crown of the head), facing +z, and scaled.
import { shade, mix } from "../props/kit.js";
import { PAINT, faded } from "./egypt-arch.js";

export const SKIN = { man: "#a3593a", woman: "#d29a62", osiris: "#4c8a5c", amun: "#3b5f9c", gold: "#d6a845" };

/**
 * Egyptian figure.
 * o: { pose: "stand"|"stride"|"seat"|"kneel"|"mummy"|"offer", head: "nemes"|"double"|"white"|"atef"|"falcon"|
 *      "wig"|"plumes"|"hathor"|"moon"|"isis"|"ibis"|"jackal"|"ram"|"lioness"|"blue", stone?, gloss?, skin?, beard?,
 *      hold?: "staff"|"jars"|"crook"|"spear"|"child"|null, throne?: true }
 */
export function figure(b, o = {}) {
  const pose = o.pose || "stand";
  const stone = o.stone || null;
  const kind = o.gloss ? "gloss" : "matte";
  const C = (paint, amt = 0) => (stone ? shade(stone, amt) : paint);
  const skin = C(o.skin || SKIN.man);
  const linen = C(PAINT.white, 0.04);
  const gold = stone ? shade(stone, 0.06) : PAINT.gold;
  const gk = stone ? kind : "metal";
  const wig = C(o.head === "wig" || o.head === "isis" || o.head === "hathor" || o.head === "moon" ? "#26283a" : PAINT.lapis, -0.02);
  const col = (k) => (stone ? shade(stone, k % 2 ? -0.05 : 0.03) : [PAINT.lapis, PAINT.gold, PAINT.red, PAINT.turquoise][k % 4]);

  const seat = pose === "seat", kneel = pose === "kneel", mummy = pose === "mummy";
  // heights of the body's landmarks for each pose
  const hip = seat ? 0.36 : kneel ? 0.27 : 0.5;
  const waist = hip + 0.1;
  const shoulder = waist + 0.22;
  const neck = shoulder + 0.03;
  const headY = neck + 0.075;

  if (mummy) {
    // wrapped body tapering to the feet, crossed arms holding crook and flail
    b.lathe([[0.05, 0], [0.075, 0.04], [0.085, 0.3], [0.11, 0.55], [0.145, 0.76], [0.13, 0.82], [0.05, 0.84]],
      { color: linen, kind, seg: 18, scale: [1, 1, 0.72] });
    b.box(0.22, 0.04, 0.14, { at: [0, 0.68, 0.06], rot: [0, 0, 0.5], color: skin, kind, r: 0.015 });
    b.box(0.22, 0.04, 0.14, { at: [0, 0.68, 0.075], rot: [0, 0, -0.5], color: skin, kind, r: 0.015 });
    b.cyl(0.008, 0.008, 0.22, { at: [-0.05, 0.74, 0.12], rot: [0, 0, 0.25], color: gold, kind: gk, seg: 6 });
    b.torus(0.03, 0.008, { at: [-0.08, 0.86, 0.12], arc: Math.PI * 1.3, color: gold, kind: gk, seg: 10 });
    b.cyl(0.008, 0.008, 0.2, { at: [0.05, 0.74, 0.12], rot: [0, 0, -0.25], color: gold, kind: gk, seg: 6 });
    for (let k = 0; k < 3; k++) b.box(0.012, 0.06, 0.012, { at: [0.09 + k * 0.012, 0.86, 0.12], color: col(k), kind, r: 0 });
    collar(b, 0.8, col, kind);
  } else {
    // legs
    if (seat) {
      for (const s of [-1, 1]) {
        b.box(0.085, 0.07, 0.24, { at: [s * 0.055, hip + 0.035, 0.1], color: linen, kind, r: 0.03 });   // thighs under the kilt
        b.cyl(0.035, 0.03, hip - 0.04, { at: [s * 0.055, (hip - 0.04) / 2 + 0.03, 0.2], color: skin, kind, seg: 10 }); // shins
        b.box(0.06, 0.035, 0.13, { at: [s * 0.055, 0.0175, 0.23], color: skin, kind, r: 0.012 });
      }
    } else if (kneel) {
      for (const s of [-1, 1]) {
        b.box(0.08, 0.07, 0.26, { at: [s * 0.06, 0.035, 0.05], color: skin, kind, r: 0.03 });           // shins on the ground
        b.box(0.085, 0.24, 0.09, { at: [s * 0.06, 0.14, 0.15], rot: [0.5, 0, 0], color: linen, kind, r: 0.03 });
      }
    } else {
      const stride = pose === "stride" || pose === "offer" ? 0.13 : 0.08;
      for (const [s, fwd] of [[1, stride], [-1, -0.01]]) {
        const fx = s * 0.05;
        b.box(0.055, 0.035, 0.15, { at: [fx, 0.0175, fwd + 0.04], color: skin, kind, r: 0.012 });
        b.rod([fx, 0.03, fwd], [fx * 0.9, 0.27, fwd * 0.55], 0.028, { r2: 0.037, color: skin, kind, seg: 12 });
        b.sphere(0.036, { at: [fx * 0.9, 0.27, fwd * 0.55 + 0.004], color: skin, kind, seg: 10 });
        b.rod([fx * 0.9, 0.27, fwd * 0.55], [fx * 0.8, hip, 0], 0.037, { r2: 0.052, color: skin, kind, seg: 12 });
      }
    }
    // kilt with a pleated gold-edged apron
    if (!kneel || true) {
      const kh = seat ? 0.1 : kneel ? 0.12 : 0.17;
      b.cyl(0.105, 0.135, kh, { at: [0, waist - kh / 2, seat ? 0.02 : 0], scale: [1, 1, 0.7], color: linen, kind, seg: 16 });
      if (!seat && !kneel) b.extrude([[-0.045, 0], [0.045, 0], [0.03, kh * 0.95], [-0.03, kh * 0.95]], 0.01,
        { at: [0, waist - kh, 0.095], color: gold, kind: gk, bevel: 0 });
      b.cyl(0.1, 0.1, 0.022, { at: [0, waist, 0], scale: [1, 1, 0.7], color: gold, kind: gk, seg: 16 });
    }
    // torso
    const tl = shoulder - waist;
    b.lathe([[0.085, 0], [0.09, tl * 0.25], [0.105, tl * 0.6], [0.125, tl * 0.88], [0.118, tl * 0.97], [0.06, tl * 1.04]],
      { at: [0, waist, 0], scale: [1, 1, 0.56], color: skin, kind, seg: 18 });
    for (const s of [-1, 1]) {
      b.sphere(0.045, { at: [s * 0.05, shoulder - 0.06, 0.045], scale: [1.1, 0.8, 0.6], color: skin, kind, seg: 10 });
      b.sphere(0.042, { at: [s * 0.125, shoulder - 0.025, 0], scale: [1, 0.9, 0.95], color: skin, kind, seg: 10 });   // shoulders
    }
    collar(b, shoulder - 0.005, col, kind);
    // arms
    arms(b, o, { pose, shoulder, waist, hip, skin, gold, gk, kind });
  }
  // neck and head
  b.cyl(0.032, 0.036, 0.06, { at: [0, neck + 0.01, 0], color: skin, kind, seg: 10 });
  head(b, o, { headY, skin, gold, gk, wig, kind, col, C });
  if (seat && o.throne !== false) {
    // block throne with a low back
    const tc = C("#c9b27f", -0.05);
    b.box(0.3, hip - 0.01, 0.34, { at: [0, (hip - 0.01) / 2, -0.04], color: tc, kind, r: 0.01 });
    b.box(0.3, 0.16, 0.05, { at: [0, hip + 0.07, -0.19], color: tc, kind, r: 0.01 });
    if (!stone) for (let k = 0; k < 4; k++) b.box(0.012, hip * 0.8, 0.3, { at: [0.151, hip * 0.45, -0.04 - 0.12 + k * 0.08], color: k % 2 ? PAINT.lapis : PAINT.gold, kind: "matte", r: 0 });
  }
}

function collar(b, y, col, kind) {
  for (let k = 0; k < 3; k++) {
    b.cyl(0.075 + k * 0.022, 0.075 + k * 0.022, 0.014, { at: [0, y - k * 0.014, 0.008], scale: [1, 1, 0.62], color: col(k), kind, seg: 18 });
  }
}

function arms(b, o, { pose, shoulder, waist, hip, skin, gold, gk, kind }) {
  const S = shoulder - 0.02;
  for (const s of [-1, 1]) {
    const sx = s * 0.125;
    let elbow, wrist;
    if (pose === "seat") {
      elbow = [s * 0.13, waist + 0.02, 0.0];
      wrist = [s * 0.08, hip + 0.06, 0.17];
    } else if (pose === "kneel" || pose === "offer") {
      elbow = [s * 0.12, waist + 0.02, 0.04];
      wrist = [s * 0.07, waist + 0.06, 0.17];
    } else if (o.hold === "spear" && s > 0) {
      elbow = [s * 0.16, shoulder + 0.06, 0.06];
      wrist = [s * 0.08, shoulder + 0.16, 0.14];
    } else if (o.hold === "spear") {
      elbow = [s * 0.13, waist + 0.04, 0.08];
      wrist = [s * 0.06, waist + 0.02, 0.2];
    } else if (o.hold === "staff" && s > 0) {
      elbow = [s * 0.14, waist + 0.03, 0.05];
      wrist = [s * 0.14, waist + 0.02, 0.16];
    } else if (o.hold === "child" && s > 0) {
      elbow = [s * 0.12, waist + 0.02, 0.06];
      wrist = [s * 0.02, waist + 0.08, 0.14];
    } else {
      elbow = [s * 0.14, waist + 0.02, -0.005];
      wrist = [s * 0.13, hip - 0.02, 0.01];
    }
    b.rod([sx, S, 0], elbow, 0.03, { r2: 0.033, color: skin, kind, seg: 8 });
    b.rod(elbow, wrist, 0.025, { r2: 0.029, color: skin, kind, seg: 8 });
    b.sphere(0.028, { at: wrist, scale: [0.9, 1.1, 1.2], color: skin, kind, seg: 8 });
    b.cyl(0.031, 0.031, 0.02, { at: [wrist[0] * 0.98, wrist[1] + 0.03, wrist[2] * 0.95], color: gold, kind: gk, seg: 8 }); // bracelet
  }
  if (pose === "kneel" || pose === "offer") {
    for (const s of [-1, 1]) b.sphere(0.035, { at: [s * 0.065, waist + 0.1, 0.2], scale: [1, 1.2, 1], color: gold, kind: gk, seg: 10 });
  }
  if (o.hold === "staff") b.cyl(0.01, 0.01, 1.02, { at: [0.14, 0.51, 0.18], color: gold, kind: gk, seg: 6 });
  if (o.hold === "spear") {
    b.rod([0.1, shoulder + 0.25, 0.08], [0.0, 0.08, 0.62], 0.009, { color: gold, kind: gk, seg: 6 });
    b.cone(0.022, 0.06, { at: [0.0, 0.06, 0.64], rot: [2.6, 0, 0], color: gold, kind: gk, seg: 6 });
  }
  if (o.hold === "child") {
    // the infant Horus on his mother's lap
    b.group({ at: [0.02, waist - 0.06, 0.13], rot: [0, -0.5, 0], scale: 0.38 }, (k) =>
      figure(k, { pose: "seat", head: "wig", skin: SKIN.man, throne: false, stone: o.stone || undefined }));
  }
}

function head(b, o, { headY, skin, gold, gk, wig, kind, col, C }) {
  const hd = o.head || "nemes";
  const animal = ["falcon", "ibis", "jackal", "ram", "lioness"].includes(hd);
  if (animal) {
    animalHead(b, hd, headY, { skin, wig, kind, gold, gk, C });
  } else {
    b.sphere(0.06, { at: [0, headY, 0.005], scale: [0.86, 1.08, 1.0], color: skin, kind, seg: 14 });
    b.box(0.016, 0.03, 0.03, { at: [0, headY - 0.008, 0.06], color: skin, kind, r: 0.006 });          // nose
    if (!o.stone) for (const s of [-1, 1]) b.box(0.022, 0.006, 0.004, { at: [s * 0.022, headY + 0.012, 0.058], color: "#1d1a18", r: 0 });
    for (const s of [-1, 1]) b.sphere(0.012, { at: [s * 0.052, headY, 0], scale: [0.5, 1, 0.8], color: skin, kind, seg: 6 });
  }
  if (o.beard !== false && !animal && ["nemes", "double", "white", "atef", "plumes", "blue"].includes(hd)) {
    b.box(0.02, 0.06, 0.018, { at: [0, headY - 0.085, 0.05], rot: [hd === "atef" ? 0.25 : 0.05, 0, 0], color: C("#2a2522", -0.04), kind, r: 0.006 });
  }
  const crownY = headY + 0.05;
  const uraeus = () => b.capsule(0.007, 0.03, { at: [0, headY + 0.052, 0.062], color: gold, kind: gk });
  switch (hd) {
    case "nemes": nemes(b, headY, col, kind); uraeus(); break;
    case "double": nemes(b, headY, col, kind, false); pschent(b, crownY, C, kind); uraeus(); break;
    case "white": whiteCrown(b, crownY, C("#efe9dc", 0.05), kind); uraeus(); break;
    case "atef":
      whiteCrown(b, crownY, C("#efe9dc", 0.05), kind);
      for (const s of [-1, 1]) b.box(0.02, 0.2, 0.05, { at: [s * 0.05, crownY + 0.1, 0], rot: [0, 0, -s * 0.08], color: C(PAINT.gold, 0.02), kind, r: 0.008 });
      uraeus();
      break;
    case "blue":
      b.sphere(0.072, { at: [0, headY + 0.04, -0.01], scale: [0.95, 1.25, 1.1], color: C(PAINT.lapis), kind, seg: 14 });
      uraeus();
      break;
    case "plumes":
      b.cyl(0.05, 0.055, 0.035, { at: [0, crownY + 0.0, 0], color: C(PAINT.red), kind, seg: 12 });
      for (const s of [-1, 1]) b.box(0.04, 0.26, 0.012, { at: [s * 0.022, crownY + 0.15, 0], color: C(s > 0 ? PAINT.blue : PAINT.green, 0.03), kind, r: 0.008 });
      wigLappets(b, headY, wig, kind);
      break;
    case "hathor":
      wigLappets(b, headY, wig, kind);
      for (const s of [-1, 1]) b.torus(0.06, 0.008, { at: [s * 0.0, crownY + 0.06, 0], arc: Math.PI, rot: [0, 0, 0], color: C("#2a2522"), kind, seg: 12 });
      b.cyl(0.05, 0.05, 0.012, { at: [0, crownY + 0.07, 0], rot: [Math.PI / 2, 0, 0], color: C("#c9442f"), kind, seg: 18 });
      break;
    case "moon":
      wigLappets(b, headY, wig, kind);
      b.torus(0.045, 0.01, { at: [0, crownY + 0.03, 0], arc: Math.PI, rot: [0, 0, Math.PI], color: C("#d9d4c6", 0.05), kind: o.stone ? kind : "metal", seg: 14 });
      b.cyl(0.035, 0.035, 0.01, { at: [0, crownY + 0.055, 0], rot: [Math.PI / 2, 0, 0], color: C("#e8e4da", 0.06), kind: o.stone ? kind : "metal", seg: 16 });
      break;
    case "isis":
      wigLappets(b, headY, wig, kind);
      b.box(0.06, 0.03, 0.05, { at: [0, crownY + 0.015, 0], color: C(PAINT.gold), kind, r: 0.004 });
      b.box(0.03, 0.06, 0.05, { at: [-0.015, crownY + 0.05, 0], color: C(PAINT.gold), kind, r: 0.004 });
      break;
    case "wig":
      wigLappets(b, headY, wig, kind);
      break;
    case "falcon":
      if (o.crown !== "none") pschent(b, crownY + 0.01, C, kind);
      break;
    case "ram":
    case "ibis":
    case "jackal":
    case "lioness":
      if (hd === "lioness") b.cyl(0.04, 0.04, 0.01, { at: [0, crownY + 0.05, -0.01], rot: [Math.PI / 2, 0, 0], color: C("#c9442f"), kind, seg: 16 });
      if (hd === "ibis") {
        b.torus(0.04, 0.008, { at: [0, crownY + 0.04, 0], arc: Math.PI, rot: [0, 0, Math.PI], color: C("#d9d4c6"), kind, seg: 12 });
      }
      break;
    default: break;
  }
}

function nemes(b, y, col, kind, full = true) {
  // the striped royal headcloth: a cap, flaring wings behind the ears, lappets down the chest
  b.sphere(0.068, { at: [0, y + 0.012, -0.006], scale: [0.95, 0.95, 1.02], phiLength: Math.PI * 2, thetaLength: Math.PI * 0.55, color: col(1), kind, seg: 16 });
  for (const s of [-1, 1]) {
    b.extrude([[0, 0.04], [0.035, 0.0], [0.04, -0.09], [0.0, -0.09]].map(([x, yy]) => [s * x, yy]), 0.06,
      { at: [s * 0.058, y, -0.02], color: col(1), kind, bevel: 0 });
    for (let k = 0; k < 5; k++) {
      b.box(0.034, 0.024, 0.016, { at: [s * 0.068, y - 0.07 - k * 0.024, 0.035], color: col(k), kind, r: 0.004 });
    }
  }
  if (full) {
    for (let k = 0; k < 5; k++) b.box(0.13 - k * 0.006, 0.012, 0.004, { at: [0, y + 0.055 - k * 0.006, 0.038], rot: [-0.9, 0, 0], color: col(k), kind, r: 0 });
  }
  b.cone(0.03, 0.12, { at: [0, y - 0.07, -0.07], rot: [0.12, 0, 0], color: col(1), kind, seg: 8, scale: [1, 1, 0.5] }); // tail behind
}

function pschent(b, y, C, kind) {
  // the double crown: the red crown of Lower Egypt around the white crown of Upper Egypt
  b.cyl(0.07, 0.066, 0.06, { at: [0, y + 0.03, 0], color: C(PAINT.red), kind, seg: 16 });
  b.box(0.05, 0.11, 0.025, { at: [0, y + 0.085, -0.055], color: C(PAINT.red), kind, r: 0.006 });
  b.lathe([[0.05, 0], [0.052, 0.06], [0.04, 0.14], [0.022, 0.19], [0.0, 0.205]], { at: [0, y + 0.04, 0.008], color: C("#efe9dc", 0.05), kind, seg: 14 });
  b.torus(0.018, 0.005, { at: [0.0, y + 0.08, 0.06], arc: Math.PI * 1.4, rot: [0, Math.PI / 2, 0], color: C(PAINT.gold), kind, seg: 10 });
}

function whiteCrown(b, y, color, kind) {
  b.lathe([[0.058, 0], [0.06, 0.05], [0.048, 0.14], [0.026, 0.22], [0.0, 0.24]], { at: [0, y - 0.02, -0.005], color, kind, seg: 14 });
}

function wigLappets(b, y, wig, kind) {
  b.sphere(0.068, { at: [0, y + 0.01, -0.008], scale: [1.0, 1.0, 1.05], thetaLength: Math.PI * 0.6, color: wig, kind, seg: 14 });
  for (const s of [-1, 1]) b.box(0.036, 0.14, 0.028, { at: [s * 0.055, y - 0.05, 0.022], color: wig, kind, r: 0.01 });
  b.box(0.12, 0.16, 0.035, { at: [0, y - 0.04, -0.05], color: wig, kind, r: 0.012 });
}

function animalHead(b, kind_, y, { skin, wig, kind, gold, gk, C }) {
  wigLappets(b, y - 0.005, wig, kind);
  const fur = C(kind_ === "falcon" ? "#5a4636" : kind_ === "ibis" ? "#e8e1d0" : kind_ === "jackal" ? "#2b2622" : kind_ === "ram" ? "#d8c7a4" : "#c99a52");
  b.sphere(0.055, { at: [0, y + 0.005, 0.01], scale: [0.9, 1.0, 1.05], color: fur, kind, seg: 12 });
  switch (kind_) {
    case "falcon":
      b.cone(0.024, 0.06, { at: [0, y - 0.01, 0.075], rot: [Math.PI / 2 + 0.6, 0, 0], color: C("#3a3230"), kind, seg: 8 });
      for (const s of [-1, 1]) b.box(0.012, 0.03, 0.004, { at: [s * 0.03, y - 0.015, 0.052], color: C("#1d1a18"), kind, r: 0 });
      break;
    case "ibis":
      b.tube([[0, y, 0.05], [0, y - 0.02, 0.11], [0, y - 0.08, 0.15]], 0.01, { color: C("#2a2522"), kind, seg: 10 });
      break;
    case "jackal":
      b.cone(0.03, 0.08, { at: [0, y - 0.01, 0.075], rot: [Math.PI / 2, 0, 0], color: fur, kind, seg: 8 });
      for (const s of [-1, 1]) b.cone(0.02, 0.07, { at: [s * 0.028, y + 0.07, 0], color: fur, kind, seg: 6 });
      break;
    case "ram":
      b.box(0.05, 0.05, 0.08, { at: [0, y - 0.015, 0.06], color: fur, kind, r: 0.02 });
      for (const s of [-1, 1]) b.torus(0.028, 0.011, { at: [s * 0.055, y + 0.01, 0.0], rot: [0, Math.PI / 2, 0], arc: Math.PI * 1.6, color: C("#b89c6c"), kind, seg: 12 });
      break;
    case "lioness":
      b.box(0.06, 0.05, 0.05, { at: [0, y - 0.015, 0.055], color: fur, kind, r: 0.02 });
      b.sphere(0.07, { at: [0, y - 0.03, -0.01], scale: [1.1, 0.9, 1], color: shade(fur, -0.06), kind, seg: 10 });
      break;
    default: break;
  }
}

// ── animals ──────────────────────────────────────────────────────────────────
/** A ram-headed sphinx on its pedestal, facing +z; a little king stands between its paws. */
export function sphinx(b, o = {}) {
  const st = o.stone || "#cfae7f";
  const ped = shade(st, -0.05);
  // pedestal with a cornice
  b.box(2.3, 1.15, 5.0, { at: [0, 0.575, 0], color: ped, r: 0.03 });
  b.box(2.5, 0.16, 5.2, { at: [0, 1.23, 0], color: shade(ped, 0.04), r: 0.04 });
  b.group({ at: [0, 1.31, -0.1] }, (bb) => {
    const c = st, c2 = shade(st, -0.05);
    // lion body lying, haunches at the back
    bb.capsule(0.55, 1.7, { at: [0, 0.62, -0.35], rot: [Math.PI / 2, 0, 0], scale: [0.95, 1, 0.85], color: c, seg: 16 });
    bb.sphere(0.72, { at: [0, 0.6, -1.45], scale: [0.95, 0.85, 1.1], color: c, seg: 16 });
    bb.sphere(0.6, { at: [0, 0.85, 0.55], scale: [0.95, 1.05, 0.95], color: c, seg: 16 });       // chest
    for (const s of [-1, 1]) {
      bb.box(0.34, 0.32, 1.25, { at: [s * 0.42, 0.18, 1.05], color: c2, r: 0.12 });              // forelegs
      bb.box(0.36, 0.2, 0.36, { at: [s * 0.42, 0.1, 1.7], color: c2, r: 0.08 });                 // paws
      bb.box(0.3, 0.3, 0.95, { at: [s * 0.55, 0.16, -1.25], color: c2, r: 0.12 });               // hind legs
    }
    bb.tube([[0.5, 0.15, -2.0], [0.7, 0.12, -1.2], [0.72, 0.15, -0.5], [0.62, 0.32, -0.1]], 0.07, { color: c2, seg: 20 });
    // ram's head with a striped wig and curled horns
    const hy = 1.55;
    bb.box(0.52, 0.62, 0.7, { at: [0, hy, 0.95], color: c, r: 0.22 });
    bb.box(0.36, 0.38, 0.5, { at: [0, hy - 0.12, 1.33], rot: [0.25, 0, 0], color: c, r: 0.15 });
    for (const s of [-1, 1]) {
      bb.torus(0.22, 0.085, { at: [s * 0.34, hy + 0.08, 0.92], rot: [0, Math.PI / 2, 0], arc: Math.PI * 1.7, color: shade(c, -0.08), seg: 16 });
      bb.box(0.24, 0.9, 0.22, { at: [s * 0.3, hy - 0.35, 0.72], color: shade(c, -0.03), r: 0.06 });   // wig lappets
    }
    bb.box(0.7, 0.75, 0.24, { at: [0, hy - 0.2, 0.55], color: shade(c, -0.03), r: 0.06 });
    // the little king, arms crossed, standing between the paws
    bb.group({ at: [0, 0.0, 1.55], scale: 0.95 }, (k) => figure(k, { pose: "mummy", head: "nemes", stone: shade(st, 0.02) }));
  });
}

/** A lion-headed rain spout projecting from a wall (facing +z, mounted at its back). */
export function lionSpout(b) {
  const c = "#cfae7f";
  b.box(1.6, 1.4, 0.4, { at: [0, 0, 0.2], color: shade(c, -0.04), r: 0.04 });
  b.group({ at: [0, -0.05, 0.4] }, (bb) => {
    bb.sphere(0.62, { at: [0, 0.1, 0.35], scale: [1.05, 1.0, 0.9], color: shade(c, -0.08), seg: 14 });   // mane
    bb.sphere(0.42, { at: [0, 0.05, 0.75], scale: [0.95, 0.9, 0.95], color: c, seg: 14 });               // face
    bb.box(0.42, 0.28, 0.45, { at: [0, -0.12, 1.02], color: c, r: 0.1 });                                 // muzzle
    bb.box(0.36, 0.12, 0.7, { at: [0, -0.3, 1.1], color: shade(c, -0.1), r: 0.04 });                     // the open jaw and channel
    for (const s of [-1, 1]) {
      bb.sphere(0.06, { at: [s * 0.16, 0.18, 1.08], color: "#3a2a1c", seg: 8 });
      bb.sphere(0.13, { at: [s * 0.32, 0.45, 0.65], color: shade(c, -0.05), seg: 8 });
    }
    bb.box(0.9, 0.5, 0.9, { at: [0, -0.35, 0.3], color: shade(c, -0.06), r: 0.08 });                    // forepaws
  });
}

/** The nine gods of creation, seated in a row on a long bench (facing +z). */
export function ennead(b) {
  const heads = ["blue", "wig", "lioness", "atef", "isis", "jackal", "hathor", "ibis", "falcon"];
  const skins = [SKIN.amun, SKIN.woman, SKIN.woman, SKIN.osiris, SKIN.woman, SKIN.man, SKIN.woman, SKIN.man, SKIN.man];
  const names = ["Atum", "Shu", "Tefnut", "Osiris", "Isis", "Seth", "Nephthys", "Geb", "Nut"];
  b.box(4.7, 0.5, 0.95, { at: [0, 0.25, 0], color: "#b99e74", r: 0.03 });
  b.box(4.8, 0.06, 1.0, { at: [0, 0.52, 0], color: "#c9ae84", r: 0.02 });
  heads.forEach((hd, i) => {
    const x = -2.1 + i * 0.525;
    b.group({ at: [x, 0.55, 0.05], scale: 1.2 }, (bb) => figure(bb, { pose: "seat", head: hd, skin: skins[i], crown: "none", name: names[i] }));
  });
}
