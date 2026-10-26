// First-person walking: keyboard and mouse (pointer lock) on desktop, a thumb stick and
// drag-to-look on touch screens. Collision against the world's floors and obstacles;
// steps, stairs and ramps are climbed by following the floor height.

import { EYE, STEP, WALK, RUN, move } from '../core/walk.js';

export class Controls {
  constructor(camera, canvas, collide) {
    this.camera = camera;
    this.canvas = canvas;
    this.collide = collide;
    this.feet = { x: 0, y: 0, z: 0 };
    this.vy = 0;
    this.yaw = 0; this.pitch = 0;
    this.keys = new Set();
    this.stick = { x: 0, y: 0 };
    this.sensitivity = 1;
    this.enabled = false;
    this.locked = false;
    this.touch = matchMedia('(pointer: coarse)').matches;
    this._bind();
  }

  setPose(x, y, z, yaw = 0, pitch = 0) {
    this.free = false;
    this.feet = { x, y, z };
    this.feet.y = this.collide.groundAt(x, z, y + STEP);
    if (!Number.isFinite(this.feet.y)) this.feet.y = y;
    this.yaw = yaw; this.pitch = pitch; this.vy = 0;
    this.apply();
  }

  apply() {
    const c = this.camera;
    c.position.set(this.feet.x, this.feet.y + EYE, this.feet.z);
    c.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  _bind() {
    const cv = this.canvas;
    addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('input, select')) return;
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === cv;
      this.onLockChange?.(this.locked);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      this.look(e.movementX, e.movementY, 0.0022);
    });
    // touch: drag anywhere outside the stick to look
    let lookId = null, lx = 0, ly = 0;
    cv.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookId || !this.enabled) return;
      this.look(e.clientX - lx, e.clientY - ly, 0.0042);
      lx = e.clientX; ly = e.clientY;
    });
    const end = (e) => { if (e.pointerId === lookId) lookId = null; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);

    const stick = document.getElementById('stick'), knob = document.getElementById('stick-knob');
    let sid = null;
    const setStick = (e) => {
      const r = stick.getBoundingClientRect();
      let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      this.stick = { x: dx, y: dy };
      knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
    };
    stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; stick.setPointerCapture(sid); setStick(e); e.stopPropagation(); });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === sid) setStick(e); });
    const stop = (e) => { if (e.pointerId !== sid) return; sid = null; this.stick = { x: 0, y: 0 }; knob.style.transform = ''; };
    stick.addEventListener('pointerup', stop);
    stick.addEventListener('pointercancel', stop);
  }

  look(dx, dy, k) {
    this.yaw -= dx * k * this.sensitivity;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy * k * this.sensitivity));
  }

  lock() { if (!this.touch) this.canvas.requestPointerLock?.()?.catch?.(() => {}); }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }

  update(dt) {
    if (this.free) return;            // camera placed directly (tools)
    dt = Math.min(dt, 0.1);
    let f = 0, s = 0;
    if (this.enabled) {
      const k = this.keys;
      if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) s += 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) s -= 1;
      f -= this.stick.y; s += this.stick.x;
      if (k.has('KeyQ')) this.yaw += 1.6 * dt;
      if (k.has('KeyE')) this.yaw -= 1.6 * dt;
    }
    const l = Math.hypot(f, s);
    if (l > 1) { f /= l; s /= l; }
    const run = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || Math.hypot(this.stick.x, this.stick.y) > 0.92;
    const speed = run ? RUN : WALK;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let dx = (-sin * f + cos * s) * speed * dt, dz = (-cos * f - sin * s) * speed * dt;

    this.feet.vy = this.vy;
    move(this.feet, dx, dz, dt, this.collide);
    this.vy = this.feet.vy;
    this.apply();
  }
}
