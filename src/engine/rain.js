// Rain: thin streaks falling around the viewer, moved entirely on the GPU. Each streak has a
// fixed random seed; its position wraps inside a box that follows the camera, slanted by the
// wind. Faded out indoors (rooms that are not open to the sky) and when it is not raining.

import * as THREE from 'three/webgpu';
import { attribute, uniform, vec3, vec4, float, fract, time, cameraPosition, positionLocal, normalize, cross, mix } from 'three/tsl';
import { ENV } from './env.js';

const N = 7000, BOX = [44, 22, 44], SPEED = 9, LEN = 0.55, WIDTH = 0.012;

export class Rain {
  constructor(scene) {
    const seed = new Float32Array(N * 4 * 3), corner = new Float32Array(N * 4 * 2), index = [];
    for (let i = 0; i < N; i++) {
      const s = [Math.random(), Math.random(), Math.random()];
      for (let k = 0; k < 4; k++) {
        seed.set(s, (i * 4 + k) * 3);
        corner.set([k & 1 ? 1 : -1, k & 2 ? 1 : 0], (i * 4 + k) * 2);
      }
      const b = i * 4;
      index.push(b, b + 1, b + 3, b, b + 3, b + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 4 * 3), 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
    g.setAttribute('corner', new THREE.BufferAttribute(corner, 2));
    g.setIndex(index);
    this.amount = uniform(0);
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
    const sd = attribute('seed', 'vec3'), cr = attribute('corner', 'vec2');
    const fall = vec3(ENV.wind.x.mul(0.6), float(-SPEED), ENV.wind.y.mul(0.6));
    const box = vec3(...BOX);
    // position of the drop inside a box that follows the camera
    const t = time;
    const rel = fract(sd.add(fall.mul(t).div(box)).sub(cameraPosition.div(box))).sub(0.5).mul(box);
    const base = cameraPosition.add(rel);
    // a thin quad along the direction of fall, turned toward the viewer
    const dir = normalize(fall);
    const side = normalize(cross(dir, normalize(base.sub(cameraPosition)))).mul(WIDTH);
    const p = base.add(side.mul(cr.x)).sub(dir.mul(cr.y.mul(LEN)));
    m.positionNode = p;
    m.colorNode = vec3(0.75, 0.78, 0.82);
    m.opacityNode = this.amount.mul(0.32).mul(mix(float(0.15), float(1), cr.y));
    m.fog = false;
    this.mesh = new THREE.Mesh(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.level = 0;
  }

  /** rain: 0…1 from the climate; outdoors: whether the viewer is under the open sky. */
  update(dt, rain, outdoors) {
    const target = outdoors ? rain : 0;
    this.level += (target - this.level) * Math.min(1, dt / 2.5);
    this.amount.value = this.level;
    this.mesh.visible = this.level > 0.01;
  }
}
