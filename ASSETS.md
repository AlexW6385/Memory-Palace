# Third-party assets

Only CC0 or MIT assets, loaded from a CDN; nothing large is committed to the repository.

| Asset | Licence | Source | Used for |
|---|---|---|---|
| three.js r186 (`three@0.186.1`), including addons: GTAONode, BloomNode, SMAANode, CSMShadowNode, SkyMesh | MIT | https://cdn.jsdelivr.net/npm/three@0.186.1 | renderer, post-processing, shadows, sky |

Development only (not served to visitors): `playwright` (Apache-2.0), `three-mesh-bvh` (MIT, light baking), `pngjs` (MIT), `pixelmatch` (ISC).

The interface uses the visitor's system fonts (no web fonts).

Generated in this repository (no third-party source): all architecture and objects (procedural geometry), all materials (procedural TSL shaders), all baked lighting (`data/gi/`), the terrain and ground cover, the plants and their foliage textures (drawn on a canvas at load time), all music (synthesised in the browser).

No photographic textures or scanned models are used yet. When CC0 sets from Poly Haven or ambientCG are added, list each one here with its URL.
