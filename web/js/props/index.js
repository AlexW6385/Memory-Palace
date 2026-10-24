// Registry of prop builders, keyed by catalogue name.
import { Builder, C, measure } from "./kit.js";
import { PROPS } from "./catalog.js";
import people from "./people.js";
import animals from "./animals.js";
import nature from "./nature.js";
import furniture from "./furniture.js";
import household from "./household.js";
import tools from "./tools.js";
import devices from "./devices.js";
import places from "./places.js";
import objects from "./objects.js";
import knowledge from "./knowledge.js";

export const BUILDERS = {
  ...people, ...animals, ...nature, ...furniture, ...household, ...tools, ...devices, ...places, ...objects,
  ...knowledge,
};

/** Stand-in for a prop that has no builder yet: a box of the catalogue size with the name on it. */
function placeholder(name) {
  const [w, h, d] = PROPS[name]?.size || [0.3, 0.3, 0.3];
  return (b) => {
    b.box(w, h, d, { at: [0, h / 2, 0], color: "#c9c3b8" });
    b.text(name, { at: [0, h / 2, d / 2 + 0.002], w: Math.max(w, 0.2), h: Math.min(h, 0.12), fg: "#333",
      font: "body" });
  };
}

export function builderFor(name) {
  return BUILDERS[name] || placeholder(name);
}

/**
 * Build one prop into a fresh Builder.
 * params: { variant, color, color2, text, emoji, pose, hat, hold, seed }
 * env: { texture, lang }
 */
export function buildProp(name, params = {}, env = {}) {
  const b = new Builder({ ...env, props: BUILDERS_WITH_FALLBACK, seed: params.seed ?? 1 });
  builderFor(name)(b, { ...params });
  return b;
}

// nested props (a figure holding a key) resolve through this proxy so missing ones fall back too
export const BUILDERS_WITH_FALLBACK = new Proxy(BUILDERS, {
  get(target, key) {
    if (typeof key !== "string") return undefined;
    return target[key] || (PROPS[key] ? placeholder(key) : undefined);
  },
});

export { Builder, C, measure, PROPS };
