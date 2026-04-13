import * as THREE from 'three';
import { ValueNoise } from './noise.js';

export class TerrainSystem {
  constructor(scene) {
    this.scene = scene;
    this.noise = new ValueNoise();
    this.size = 2200;
    this.segments = 220;

    this.geometry = new THREE.PlaneGeometry(this.size, this.size, this.segments, this.segments);
    this.material = new THREE.MeshStandardMaterial({
      color: 0x7fb35a,
      roughness: 1,
      metalness: 0,
      flatShading: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);

    this.lastRebuild = 0;
    this.rebuild(0, 0);
  }

  height(x, z) {
    const n = this.noise.fractal2D(x * 0.0018, z * 0.0018, 5, 2, 0.5);
    const m = this.noise.fractal2D(x * 0.0006 + 21, z * 0.0006 - 14, 3, 2, 0.5);
    return n * 32 + m * 14;
  }

  rebuild(cx, cz) {
    const pos = this.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i) + cx;
      const z = pos.getY(i) + cz;
      pos.setZ(i, this.height(x, z));
    }
    pos.needsUpdate = true;
    this.geometry.computeVertexNormals();

    this.mesh.position.x = cx;
    this.mesh.position.z = cz;
    this.mesh.position.y = -8;
  }

  update(carPos, time) {
    if (time - this.lastRebuild < 0.35) return;
    this.lastRebuild = time;
    this.rebuild(carPos.x, carPos.z);
  }
}
