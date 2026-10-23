// Procedural 3D symbols, one builder per name in palace/symbols.py.
// Each fits roughly in a 0.9 m box centered on the origin.
import * as THREE from "three";

const geoCache = new Map();
function geo(key, make) {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = make()));
  return g;
}

const matCache = new Map();
export function symbolMaterial(color, kind = "main") {
  const key = color + kind;
  let m = matCache.get(key);
  if (!m) {
    const c = new THREE.Color(color);
    if (kind === "accent") c.lerp(new THREE.Color("#fff6e0"), 0.7);
    if (kind === "dark") c.multiplyScalar(0.45);
    m = new THREE.MeshPhongMaterial({
      color: c, shininess: 60, specular: 0x333333,
      emissive: c.clone().multiplyScalar(kind === "accent" ? 0.12 : 0.18),
      flatShading: kind === "main",
    });
    matCache.set(key, m);
  }
  return m;
}

function mesh(g, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  o.scale.setScalar(s);
  return o;
}

function tube(points, radius, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed);
  return new THREE.TubeGeometry(curve, 96, radius, 8, closed);
}

const B = {
  sphere: (M) => [mesh(geo("sphere", () => new THREE.IcosahedronGeometry(0.4, 2)), M)],
  cube: (M) => [mesh(geo("cube", () => new THREE.BoxGeometry(0.55, 0.55, 0.55)), M, 0, 0, 0, 0.6, 0.6, 0)],
  pyramid: (M) => [mesh(geo("pyr", () => new THREE.ConeGeometry(0.48, 0.75, 4)), M)],
  cone: (M) => [mesh(geo("cone", () => new THREE.ConeGeometry(0.34, 0.85, 24)), M)],
  cylinder: (M, A) => [
    mesh(geo("cyl", () => new THREE.CylinderGeometry(0.3, 0.3, 0.6, 24)), M),
    mesh(geo("cylcap", () => new THREE.CylinderGeometry(0.34, 0.34, 0.08, 24)), A, 0, 0.34),
    mesh(geo("cylcap", () => new THREE.CylinderGeometry(0.34, 0.34, 0.08, 24)), A, 0, -0.34),
  ],
  torus: (M) => [mesh(geo("torus", () => new THREE.TorusGeometry(0.3, 0.11, 12, 32)), M)],
  ring: (M, A) => [
    mesh(geo("ring", () => new THREE.TorusGeometry(0.34, 0.045, 8, 48)), M),
    mesh(geo("ring", () => new THREE.TorusGeometry(0.34, 0.045, 8, 48)), A, 0, 0, 0, 0, Math.PI / 2, 0, 0.8),
  ],
  crystal: (M) => [mesh(geo("oct", () => new THREE.OctahedronGeometry(0.45)), M, 0, 0, 0, 0, 0, 0)],
  gem: (M) => [mesh(geo("ico", () => new THREE.IcosahedronGeometry(0.42)), M)],
  dodeca: (M) => [mesh(geo("dod", () => new THREE.DodecahedronGeometry(0.42)), M)],
  knot: (M) => [mesh(geo("knot", () => new THREE.TorusKnotGeometry(0.25, 0.08, 96, 10)), M)],
  spiral: (M) => [mesh(geo("spiral", () => {
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60, a = t * Math.PI * 5, r = 0.12 + 0.24 * t;
      pts.push(new THREE.Vector3(Math.cos(a) * r, -0.4 + 0.8 * t, Math.sin(a) * r));
    }
    return tube(pts, 0.05);
  }), M)],
  twin: (M, A) => [
    mesh(geo("tw", () => new THREE.IcosahedronGeometry(0.24, 2)), M, -0.24, 0),
    mesh(geo("tw", () => new THREE.IcosahedronGeometry(0.24, 2)), A, 0.24, 0),
  ],
  arrow: (M) => [
    mesh(geo("ashaft", () => new THREE.CylinderGeometry(0.07, 0.07, 0.6, 12)), M, 0, -0.12),
    mesh(geo("ahead", () => new THREE.ConeGeometry(0.2, 0.32, 16)), M, 0, 0.32),
  ].map((o) => { o.rotation.z = -0.6; return o; }),
  stairs: (M) => [0, 1, 2, 3].map((i) =>
    mesh(geo("step", () => new THREE.BoxGeometry(0.22, 0.2, 0.6)), M, -0.33 + i * 0.22, -0.3 + i * 0.2)),
  tree: (M, A, D) => [
    mesh(geo("trunk", () => new THREE.CylinderGeometry(0.05, 0.08, 0.5, 8)), D, 0, -0.2),
    mesh(geo("leaf", () => new THREE.IcosahedronGeometry(0.2, 1)), M, 0, 0.15),
    mesh(geo("leaf", () => new THREE.IcosahedronGeometry(0.2, 1)), M, -0.2, 0.02, 0, 0, 0, 0, 0.8),
    mesh(geo("leaf", () => new THREE.IcosahedronGeometry(0.2, 1)), M, 0.2, 0.02, 0, 0, 0, 0, 0.8),
    mesh(geo("leaf", () => new THREE.IcosahedronGeometry(0.2, 1)), M, 0, 0.32, 0, 0, 0, 0, 0.7),
  ],
  book: (M, A) => [
    mesh(geo("page", () => new THREE.BoxGeometry(0.34, 0.03, 0.46)), M, -0.16, 0, 0, 0, 0, 0.32),
    mesh(geo("page", () => new THREE.BoxGeometry(0.34, 0.03, 0.46)), M, 0.16, 0, 0, 0, 0, -0.32),
    mesh(geo("leaves", () => new THREE.BoxGeometry(0.3, 0.02, 0.42)), A, -0.15, 0.03, 0, 0, 0, 0.32),
    mesh(geo("leaves", () => new THREE.BoxGeometry(0.3, 0.02, 0.42)), A, 0.15, 0.03, 0, 0, 0, -0.32),
  ],
  scale: (M, A) => [
    mesh(geo("post", () => new THREE.CylinderGeometry(0.035, 0.05, 0.7, 8)), M, 0, -0.05),
    mesh(geo("beam", () => new THREE.BoxGeometry(0.75, 0.04, 0.04)), M, 0, 0.28),
    mesh(geo("pan", () => new THREE.CylinderGeometry(0.16, 0.1, 0.05, 16)), A, -0.34, 0.08),
    mesh(geo("pan", () => new THREE.CylinderGeometry(0.16, 0.1, 0.05, 16)), A, 0.34, 0.08),
  ],
  gear: (M) => {
    const out = [mesh(geo("gearbody", () => new THREE.CylinderGeometry(0.28, 0.28, 0.12, 24)), M, 0, 0, 0, Math.PI / 2)];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      out.push(mesh(geo("tooth", () => new THREE.BoxGeometry(0.11, 0.12, 0.12)), M,
        Math.cos(a) * 0.33, Math.sin(a) * 0.33, 0, 0, 0, a));
    }
    return out;
  },
  key: (M) => [
    mesh(geo("kbow", () => new THREE.TorusGeometry(0.14, 0.05, 8, 24)), M, -0.26, 0),
    mesh(geo("kshaft", () => new THREE.BoxGeometry(0.45, 0.07, 0.07)), M, 0.08, 0),
    mesh(geo("kbit", () => new THREE.BoxGeometry(0.06, 0.14, 0.07)), M, 0.22, -0.08),
    mesh(geo("kbit", () => new THREE.BoxGeometry(0.06, 0.14, 0.07)), M, 0.1, -0.08),
  ],
  eye: (M, A, D) => [
    mesh(geo("eyeball", () => new THREE.SphereGeometry(0.34, 24, 16)), A),
    mesh(geo("iris", () => new THREE.CircleGeometry(0.17, 24)), M, 0, 0, 0.341),
    mesh(geo("pupil", () => new THREE.CircleGeometry(0.08, 16)), D, 0, 0, 0.343),
  ],
  flame: (M, A) => [
    mesh(geo("fl1", () => new THREE.ConeGeometry(0.3, 0.75, 12)), M, 0, 0),
    mesh(geo("fl2", () => new THREE.ConeGeometry(0.16, 0.45, 10)), A, 0, -0.1, 0.12),
  ],
  hourglass: (M, A) => [
    mesh(geo("hgc", () => new THREE.ConeGeometry(0.26, 0.36, 16)), A, 0, 0.18, 0, Math.PI),
    mesh(geo("hgc", () => new THREE.ConeGeometry(0.26, 0.36, 16)), A, 0, -0.18),
    mesh(geo("hgcap", () => new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16)), M, 0, 0.38),
    mesh(geo("hgcap", () => new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16)), M, 0, -0.38),
  ],
  bulb: (M, A, D) => [
    mesh(geo("bulb", () => new THREE.SphereGeometry(0.3, 24, 16)), A, 0, 0.08),
    mesh(geo("bulbbase", () => new THREE.CylinderGeometry(0.13, 0.11, 0.2, 12)), M, 0, -0.3),
  ],
  network: (M, A) => {
    const pts = [[0, 0.3, 0], [-0.3, 0, 0.1], [0.3, 0.05, -0.1], [-0.12, -0.3, -0.1], [0.2, -0.28, 0.15]];
    const out = pts.map((p, i) => mesh(geo("nnode", () => new THREE.IcosahedronGeometry(0.09, 1)), i ? M : A, ...p));
    const edges = [[0, 1], [0, 2], [1, 3], [2, 4], [3, 4], [1, 2]];
    for (const [a, b] of edges) {
      const va = new THREE.Vector3(...pts[a]), vb = new THREE.Vector3(...pts[b]);
      const len = va.distanceTo(vb);
      const o = mesh(geo("nedge", () => new THREE.CylinderGeometry(0.018, 0.018, 1, 6)), A);
      o.position.copy(va).add(vb).multiplyScalar(0.5);
      o.scale.set(1, len, 1);
      o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
      out.push(o);
    }
    return out;
  },
  wave: (M) => [mesh(geo("wave", () => {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      pts.push(new THREE.Vector3(-0.42 + 0.84 * t, Math.sin(t * Math.PI * 3) * 0.2, 0));
    }
    return tube(pts, 0.05);
  }), M)],
  infinity: (M) => [mesh(geo("inf", () => {
    const pts = [];
    for (let i = 0; i < 64; i++) {
      const t = (i / 64) * Math.PI * 2, d = 1 + Math.sin(t) ** 2;
      pts.push(new THREE.Vector3(0.42 * Math.cos(t) / d, 0.42 * Math.sin(t) * Math.cos(t) / d, 0));
    }
    return tube(pts, 0.05, true);
  }), M)],
  mirror: (M, A) => [
    mesh(geo("mframe", () => new THREE.TorusGeometry(0.32, 0.05, 8, 32)), M),
    mesh(geo("mglass", () => new THREE.CircleGeometry(0.31, 32)), A),
    mesh(geo("mglass", () => new THREE.CircleGeometry(0.31, 32)), A, 0, 0, 0, 0, Math.PI),
  ],
  door: (M, A) => [
    mesh(geo("djamb", () => new THREE.BoxGeometry(0.07, 0.8, 0.1)), M, -0.25, 0),
    mesh(geo("djamb", () => new THREE.BoxGeometry(0.07, 0.8, 0.1)), M, 0.25, 0),
    mesh(geo("dlintel", () => new THREE.BoxGeometry(0.57, 0.07, 0.1)), M, 0, 0.4),
    mesh(geo("dpanel", () => new THREE.BoxGeometry(0.42, 0.74, 0.03)), A, 0.12, -0.03, 0.15, 0, -0.9),
  ],
  crown: (M, A) => {
    const out = [mesh(geo("crownband", () => new THREE.CylinderGeometry(0.3, 0.28, 0.2, 24, 1, true)), M, 0, -0.1)];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      out.push(mesh(geo("crownpt", () => new THREE.ConeGeometry(0.06, 0.24, 8)), M, Math.cos(a) * 0.29, 0.1, Math.sin(a) * 0.29));
      out.push(mesh(geo("crownjewel", () => new THREE.IcosahedronGeometry(0.045)), A, Math.cos(a) * 0.29, 0.24, Math.sin(a) * 0.29));
    }
    return out;
  },
  shield: (M, A) => [mesh(geo("shield", () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.42); s.quadraticCurveTo(0.2, 0.36, 0.34, 0.38);
    s.quadraticCurveTo(0.36, -0.05, 0, -0.42); s.quadraticCurveTo(-0.36, -0.05, -0.34, 0.38);
    s.quadraticCurveTo(-0.2, 0.36, 0, 0.42);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
    g.translate(0, 0, -0.04);
    return g;
  }), M), mesh(geo("shieldboss", () => new THREE.IcosahedronGeometry(0.08, 1)), A, 0, 0.05, 0.07)],
  lattice: (M) => {
    const out = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++)
      out.push(mesh(geo("latcube", () => new THREE.BoxGeometry(0.16, 0.16, 0.16)), M, i * 0.25, j * 0.25, 0));
    return out;
  },
  layers: (M, A) => [0, 1, 2, 3].map((i) =>
    mesh(geo("layer", () => new THREE.BoxGeometry(0.6, 0.1, 0.45)), i % 2 ? A : M, 0, -0.3 + i * 0.2, 0, 0, i * 0.15)),
  chain: (M) => [0, 1, 2].map((i) =>
    mesh(geo("link", () => new THREE.TorusGeometry(0.13, 0.04, 8, 20)), M, -0.26 + i * 0.26, 0, 0, i % 2 ? Math.PI / 2 : 0, 0, 0)),
  compass: (M, A, D) => [
    mesh(geo("cdisc", () => new THREE.CylinderGeometry(0.36, 0.36, 0.06, 32)), A, 0, 0, 0, Math.PI / 2),
    mesh(geo("cneedle", () => new THREE.ConeGeometry(0.07, 0.3, 8)), M, 0, 0.15, 0.05),
    mesh(geo("cneedle", () => new THREE.ConeGeometry(0.07, 0.3, 8)), D, 0, -0.15, 0.05, Math.PI),
  ],
  atom: (M, A) => [
    mesh(geo("nucleus", () => new THREE.IcosahedronGeometry(0.12, 2)), M),
    mesh(geo("orbit", () => new THREE.TorusGeometry(0.36, 0.02, 6, 48)), A, 0, 0, 0, Math.PI / 2),
    mesh(geo("orbit", () => new THREE.TorusGeometry(0.36, 0.02, 6, 48)), A, 0, 0, 0, Math.PI / 2, 1.05),
    mesh(geo("orbit", () => new THREE.TorusGeometry(0.36, 0.02, 6, 48)), A, 0, 0, 0, Math.PI / 2, -1.05),
  ],
};

export const SYMBOL_NAMES = Object.keys(B);

export function buildSymbol(name, color) {
  const g = new THREE.Group();
  const build = B[name] || B.sphere;
  for (const o of build(symbolMaterial(color), symbolMaterial(color, "accent"), symbolMaterial(color, "dark"))) g.add(o);
  return g;
}
