// Pieces of the Egyptian temple, by name (the "k" of a world.json "piece" prim).
import { rng, hashString } from "../props/kit.js";
import { addEwall, roofPiece, columnPiece, architravePiece, portalPiece, gateDoorsPiece } from "./egypt-arch.js";
import { FURNISH, falconFig } from "./egypt-furnish.js";
import { sphinx, lionSpout, ennead } from "./egypt-figures.js";

const PIECES = {
  roof: roofPiece,
  column: columnPiece,
  architrave: architravePiece,
  portal: portalPiece,
  gate_doors: gateDoorsPiece,
  sphinx: (b, o) => sphinx(b, o),
  lion_spout: (b) => b.group({ scale: 1.6 }, (bb) => lionSpout(bb)),
  ennead: (b) => ennead(b),
  ...FURNISH,
  falcon: (b, o) => b.group({ scale: 1.15 }, (bb) => falconFig(bb, o)),
};

export { addEwall };

/** Build one piece into a chunk: kit geometry into the chunk's solid builder, textured parts as surfaces. */
export function addPiece(ch, p) {
  const fn = PIECES[p.k];
  const o = p.o || {};
  const X = {
    surface(b, key, mat, geo, opts) {
      geo.applyMatrix4(b.matrix);
      ch.surface(key, mat, geo, opts);
    },
  };
  const b = ch.solid;
  const saved = b.rng;
  b.rng = rng(o.seed ?? hashString(`${p.k}|${p.p.join(",")}`));
  b.group({ at: p.p, rot: [0, p.r || 0, 0] }, (bb) => {
    if (fn) fn(bb, o, X);
    else bb.box(1, 1, 1, { at: [0, 0.5, 0], color: "#ff00ff" });
  });
  b.rng = saved;
  ch.maxY = Math.max(ch.maxY, p.p[1] + (o.h || 6));
}
