import * as THREE from 'three';
import { clamp, damp } from '../core/math.js';

export class VehicleController {
  constructor(scene) {
    this.keys = new Set();
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    this.group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.7, 3.4),
      new THREE.MeshStandardMaterial({ color: 0xb8b8b8, roughness: 0.35, metalness: 0.45 }),
    );
    body.position.y = 0.75;
    body.castShadow = true;
    this.group.add(body);

    scene.add(this.group);

    this.position = new THREE.Vector3(0, 0.65, 0);
    this.yaw = 0;
    this.steer = 0;
    this.speed = 0;

    this.maxSpeed = 55.6;
    this.accel = 14.5;
    this.brake = 26;
    this.drag = 0.006;
  }

  update(dt) {
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight');
    const throttle = this.keys.has('KeyW') || this.keys.has('ArrowUp');
    const brake = this.keys.has('KeyS') || this.keys.has('ArrowDown');

    const steerInput = (left ? 1 : 0) - (right ? 1 : 0);
    this.steer = damp(this.steer, steerInput * 0.85, 7.5, dt);

    if (throttle) this.speed += this.accel * dt;
    if (brake) this.speed -= this.brake * dt;

    this.speed -= this.drag * this.speed * Math.abs(this.speed) * dt;
    if (!throttle) this.speed = damp(this.speed, 0, 0.6, dt);

    this.speed = clamp(this.speed, -8, this.maxSpeed);

    const steerAuthority = clamp(1.0 - Math.abs(this.speed) / 95, 0.4, 1.0);
    this.yaw += this.steer * steerAuthority * (0.7 + Math.abs(this.speed) * 0.025) * dt;

    this.position.x += Math.sin(this.yaw) * this.speed * dt;
    this.position.z -= Math.cos(this.yaw) * this.speed * dt;

    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
    this.group.rotation.z = -this.steer * Math.min(0.15, Math.abs(this.speed) * 0.0025);
  }
}
