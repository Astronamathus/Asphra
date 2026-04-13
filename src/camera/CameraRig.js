import * as THREE from 'three';
import { damp } from '../core/math.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(0, 4, 10);
  }

  update(dt, targetPos, targetYaw, speed) {
    const dist = 10 + speed * 0.12;
    const height = 3.2 + speed * 0.02;
    const lookAhead = 14;

    const tx = targetPos.x - Math.sin(targetYaw) * dist;
    const tz = targetPos.z + Math.cos(targetYaw) * dist;
    const ty = targetPos.y + height;

    this.pos.x = damp(this.pos.x, tx, 7.5, dt);
    this.pos.y = damp(this.pos.y, ty, 7.5, dt);
    this.pos.z = damp(this.pos.z, tz, 7.5, dt);

    this.camera.position.copy(this.pos);

    const lx = targetPos.x + Math.sin(targetYaw) * lookAhead;
    const lz = targetPos.z - Math.cos(targetYaw) * lookAhead;
    this.camera.lookAt(lx, targetPos.y + 1.2, lz);
  }
}
