// Builds every prop (and variant / pose / hat / held item) in node and checks it
// against the catalogue: no exceptions, size close to the declared size, standing
// on y = 0, roughly centred, and a sane triangle budget.
//
//   node tests/js/props.test.mjs                 all props
//   node tests/js/props.test.mjs --group animals one group
//   node tests/js/props.test.mjs --names bird,cat
//   node tests/js/props.test.mjs --strict        exit 1 on warnings too
import { buildProp, BUILDERS, measure } from "../../web/js/props/index.js";
import { CATALOG, PROPS } from "../../web/js/props/catalog.js";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
let names = CATALOG.props.map((p) => p.name);
if (opt("--group")) names = CATALOG.props.filter((p) => p.group === opt("--group")).map((p) => p.name);
if (opt("--names")) names = opt("--names").split(",");
const strict = args.includes("--strict");

const errors = [], warnings = [];
let missing = 0, built = 0;

function check(name, params, label) {
  let b;
  try {
    b = buildProp(name, { seed: 7, ...params }, { lang: "en" });
  } catch (e) {
    errors.push(`${label}: threw ${e.stack.split("\n").slice(0, 3).join(" | ")}`);
    return;
  }
  built++;
  if (b.parts.length === 0) { errors.push(`${label}: produced no geometry`); return; }
  const box = measure(b);
  const size = [box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z];
  const want = PROPS[name].size;
  const floats = PROPS[name].floats;
  const axes = ["width", "height", "depth"];
  for (let i = 0; i < 3; i++) {
    const r = size[i] / want[i];
    if (r > 1.35 || r < 0.65) errors.push(`${label}: ${axes[i]} ${size[i].toFixed(2)} m vs catalogue ${want[i]} m`);
    else if (r > 1.2 || r < 0.8) warnings.push(`${label}: ${axes[i]} ${size[i].toFixed(2)} m vs catalogue ${want[i]} m`);
  }
  if (!floats && Math.abs(box.min.y) > 0.03 && name !== "chandelier") {
    warnings.push(`${label}: lowest point at y = ${box.min.y.toFixed(3)} (should stand on 0)`);
  }
  const cx = (box.max.x + box.min.x) / 2, cz = (box.max.z + box.min.z) / 2;
  if (Math.abs(cx) > want[0] * 0.25 + 0.02 || Math.abs(cz) > want[2] * 0.25 + 0.02) {
    warnings.push(`${label}: off-centre by (${cx.toFixed(2)}, ${cz.toFixed(2)})`);
  }
  let tris = 0;
  for (const p of b.parts) tris += p.geo.attributes.position.count / 3;
  if (tris > 14000) warnings.push(`${label}: ${Math.round(tris)} triangles (budget ~8k, hard limit 14k)`);
}

for (const name of names) {
  const meta = PROPS[name];
  if (!meta) { errors.push(`${name}: not in the catalogue`); continue; }
  if (!BUILDERS[name]) { missing++; continue; }
  const variants = meta.variants.length ? meta.variants : [undefined];
  for (const v of variants) check(name, v ? { variant: v } : {}, v ? `${name}/${v}` : name);
  if (meta.text) check(name, { text: { en: "Sample text", zh: "示例文字" } }, `${name}+text`);
  if (name === "figure" || name === "statue") for (const pose of CATALOG.poses) check(name, { pose }, `${name}/pose=${pose}`);
  if (name === "figure") {
    for (const hat of CATALOG.hats) check(name, { hat }, `figure/hat=${hat}`);
    for (const p of CATALOG.props.filter((x) => x.holdable)) check(name, { hold: p.name }, `figure/hold=${p.name}`);
  }
  if (name === "cutout") check(name, { emoji: "🦘" }, "cutout+emoji");
}

for (const e of errors) console.log("ERROR", e);
for (const w of warnings) console.log("WARNING", w);
console.log(`${names.length} props checked, ${built} builds, ${missing} without a builder yet, ` +
  `${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length || (strict && warnings.length) ? 1 : 0);
