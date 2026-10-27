// Material keys used by plans, with the physical values shared by the renderer (which adds
// procedural detail on top) and the light baker (which needs only the average albedo).
// Colours are linear-ish sRGB hex of the average surface; roughness/metalness as in PBR.

export const MATERIALS = {
  // Nubian sandstone from Gebel el-Silsila: warm buff, fine grained, laid in ashlar courses
  sandstone:        { color: '#c2aa89', roughness: 0.88, kind: 'ashlar', course: 0.52, block: 1.15 },
  sandstone_column: { color: '#c0a886', roughness: 0.86, kind: 'drums', course: 0.72 },
  sandstone_floor:  { color: '#b39d80', roughness: 0.82, kind: 'paving', course: 0.95, block: 1.4 },
  sandstone_dressed:{ color: '#c8b092', roughness: 0.84, kind: 'smooth' },
  // Pentelic marble, freshly finished (432 BC): white with a faint warm cast
  marble:           { color: '#e9e1cf', roughness: 0.42, kind: 'ashlar', course: 0.52, block: 1.25 },
  marble_column:    { color: '#e7dfcc', roughness: 0.4, kind: 'drums', course: 0.95 },
  marble_floor:     { color: '#e0d7c5', roughness: 0.38, kind: 'paving', course: 1.2, block: 1.2 },
  marble_smooth:    { color: '#e8e2d6', roughness: 0.4, kind: 'smooth' },
  marble_dark:      { color: '#5b5856', roughness: 0.35, kind: 'smooth' },   // Eleusinian grey limestone
  ivory:            { color: '#eadcc0', roughness: 0.32, kind: 'smooth' },
  granite_grey:     { color: '#6b6966', roughness: 0.32, kind: 'granite' },
  granite_black:    { color: '#2a2a2b', roughness: 0.22, kind: 'granite' },
  granite_red:      { color: '#9a6b5e', roughness: 0.34, kind: 'granite' },        // pink Aswan granite
  // Roman Imperial finishes
  stucco:           { color: '#d8d0c0', roughness: 0.9, kind: 'smooth' },
  dome_stucco:      { color: '#cbc4b7', roughness: 0.88, kind: 'smooth' },
  revetment:        { color: '#ddd3c2', roughness: 0.3, kind: 'ashlar', course: 1.1, block: 1.7 },   // pavonazzetto and giallo slabs
  giallo:           { color: '#d4b071', roughness: 0.3, kind: 'smooth' },
  pavonazzetto:     { color: '#e2dbcf', roughness: 0.3, kind: 'smooth' },
  porphyry:         { color: '#6a2c2c', roughness: 0.28, kind: 'granite' },
  opus_sectile:     { color: '#9c8b78', roughness: 0.3, kind: 'sectile', block: 3.2, colors: ['#6a2c2c', '#7d7b78', '#d4b071', '#e4ddd0'] },
  travertine:       { color: '#d6cbb6', roughness: 0.8, kind: 'paving', course: 1.0, block: 1.5 },
  gilt_bronze:      { color: '#c99b45', roughness: 0.35, metalness: 1, kind: 'metal' },
  cedar:            { color: '#7a4a2a', roughness: 0.6, kind: 'wood' },
  bronze:           { color: '#8a6234', roughness: 0.38, metalness: 1, kind: 'metal' },
  gold:             { color: '#d9a640', roughness: 0.28, metalness: 1, kind: 'metal' },
  ground:           { color: '#b59a74', roughness: 0.97, kind: 'ground' },
  // open ground of the hills: earth and grass on the gentle parts, grey limestone where steep
  terrain:          { color: '#a89577', rock: '#a29d93', roughness: 0.95, kind: 'terrain' },
  silt:             { color: '#6f5a43', roughness: 0.95, kind: 'ground' },
  mudbrick:         { color: '#8f7656', roughness: 0.96, kind: 'mudbrick', course: 0.12, block: 0.36 },
  plaster:          { color: '#d8cdb6', roughness: 0.9, kind: 'smooth' },
  palm_trunk:       { color: '#6d5a44', roughness: 0.95, kind: 'smooth', side: 'double' },
  palm_leaf:        { color: '#55703a', roughness: 0.75, kind: 'leaf' },
  water:            { color: '#2b4a4e', roughness: 0.05, kind: 'water' },
  linen:            { color: '#d9d2bf', roughness: 0.95, kind: 'smooth' },
  paint_blue:       { color: '#2f5f8a', roughness: 0.9, kind: 'smooth' },
};

export function albedo(key) {
  const m = MATERIALS[key] || MATERIALS.sandstone;
  const h = parseInt(m.color.slice(1), 16);
  // sRGB → linear
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return [lin((h >> 16) & 255), lin((h >> 8) & 255), lin(h & 255)];
}
