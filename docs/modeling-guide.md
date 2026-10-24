# Modelling guide for props

Every exhibit scene is assembled from the props in [props.md](props.md). Each prop is a small procedural
model written in JavaScript with the kit in `web/js/props/kit.js`. There are no asset files. The props need to
look **crafted and recognisable**, because a visitor has to tell a pigeon from a dove at three metres and
remember it.

## Look

- **A refined toy diorama.** Aim for chunky, friendly proportions, bevelled edges, smooth rounded organic forms,
  and soft colours that are still saturated. Think of a well-made wooden or vinyl toy, or a polished low-poly
  game. Avoid grey placeholder blocks and noisy detail.
- **Silhouette first.** At three metres the outline must say what the thing is. Then add the two to four details
  that confirm it: a beak and eyes, a door handle and hinges, a dial and hands, rivets on a safe.
- **Proportion and scale.** Match the catalogue size (width × height × depth), within about ±15%. The test warns
  at ±20% and fails at ±35%.
- **Materials.** Every primitive takes `kind`:
  - `matte` (default): wood, cloth, stone, paint.
  - `gloss`: ceramic, plastic, lacquer, eyes.
  - `metal`: gold, brass, steel, coins.
  - `glow`: unlit and bright. Use it for flames, lamp bulbs, screens, LEDs and neon. Glow parts also make soft
    light halos in the world.
  - `glass`: transparent. Use it for jars, bottles, windows and ice.
- **Colour.** Start from `C` in kit.js. Use `shade(c, ±0.1)` for related tones. Respect `p.color`, and `p.color2`
  where the catalogue says the prop has two colours. Defaults should look good on their own.

## Conventions

- Units are metres. The prop stands on **y = 0**, is **centred on x = 0, z = 0**, and **faces +z** (towards the
  viewer). Props marked *floats* are built the same way; scene authors lift them with `y`.
- The signature is `name(b, p)`, where `p` is
  `{ variant, color, color2, text, emoji, pose, hat, hold, seed }`. Handle every catalogue variant. Text props
  must render `p.text`, which is a string or `{en, zh}`. `b.text` picks the current language for you.
- Use the seeded random function `b.rng()` (or `rng(seed)` from the kit) and never `Math.random()`, so that the
  same scene always looks the same.
- Reuse other props with `b.prop(name, params, {at, rot, scale})`. For example, the figure uses it for items it
  holds.
- Budget: about 4k triangles for a typical prop, 8k for a big one, and never more than 14k. Keep `seg` modest:
  12–20 for cylinders and spheres, fewer for tiny parts.

## Kit cheat-sheet

Every primitive takes `o = { at:[x,y,z] (centre), rot:[rx,ry,rz] (radians), scale, color, kind, flat }`.

```js
b.box(w, h, d, { at, r: bevel })      // rounded box; r: 0 for sharp edges
b.cyl(rTop, rBottom, h, { seg })      // cylinder, or a cone when one radius is 0
b.cone(r, h), b.sphere(r, { scale:[sx,sy,sz] }), b.ico(r, { detail })   // ico = faceted ball
b.capsule(r, len)                     // pill along y
b.torus(R, r, { arc })                // ring in the xy plane
b.lathe([[r, y], ...])                // vases, bells, goblets, columns
b.extrude([[x, y], ...], depth)       // 2D outline → slab (stars, keys, arrows, shields)
b.tube([[x,y,z], ...], r)             // smooth curve: handles, tails, cables
b.rod([x,y,z], [x,y,z], r)            // straight stick between two points
b.disc(r), b.panel(w, h)              // flat pieces
b.text(textOrBilingual, { at, w, h, fg, bg, font: "display"|"body"|"mono"|"chalk" })   // text decal facing +z
b.emoji(char, { at, size })           // emoji decal
b.group({ at, rot, scale }, () => { ... })   // nested transform (joints, sub-assemblies)
b.mirrorX((b, side) => { ... })       // add a part and its mirror image across x = 0
b.prop(name, params, { at, rot, scale })     // embed another prop
```

Place a text decal about 0.003 m in front of the surface it sits on, so it does not flicker.

## Workflow

1. Read `kit.js`, the reference props (`bird` in animals.js and `crate` in household.js) and your group's
   entries in [props.md](props.md).
2. Write builders in your group file, `web/js/props/<group>.js`.
3. Check the geometry in node. This must report no errors, and as few warnings as you can manage:
   `node tests/js/props.test.mjs --group <group>`
4. Look at your props in the lab (headless Chromium) and **actually look at the images**:
   - `python3 tools/lab_shot.py "group=<group>&vary=variant" /tmp/.../sheet.png`
   - Use `names=a,b,c` for close-ups, `turn=60` for a side view and `bbox=1` to compare against the catalogue
     size. For the figure, `vary=pose`, `vary=hat` or `vary=hold`.
5. Iterate until every prop is recognisable at a glance, well proportioned and pleasant.
