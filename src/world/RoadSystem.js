import * as THREE from 'three';

export class RoadSystem {
  constructor(scene) {
    this.scene = scene;
    this.width = 10;
    this.segmentLength = 8;
    this.keepPoints = 220;
    this.roadHalf = this.width * 0.5;

    this.points = [];
    this.head = new THREE.Vector3(0, 0, 0);
    this.heading = 0;
    this.curvature = 0;

    this.roadGeom = new THREE.BufferGeometry();
    this.roadMat = new THREE.MeshStandardMaterial({ color: 0x4f4f4f, roughness: 0.95, metalness: 0.03 });
    this.roadMesh = new THREE.Mesh(this.roadGeom, this.roadMat);
    this.roadMesh.receiveShadow = true;
    scene.add(this.roadMesh);

    this.dashGeometry = new THREE.BoxGeometry(0.2, 0.03, 2.4);
    this.dashMaterial = new THREE.MeshStandardMaterial({ color: 0xf3d94f, roughness: 0.8, metalness: 0.05 });
    this.dashMesh = new THREE.InstancedMesh(this.dashGeometry, this.dashMaterial, this.keepPoints);
    this.dashMesh.castShadow = false;
    this.dashMesh.receiveShadow = true;
    scene.add(this.dashMesh);

    this._seed();
  }

  _seed() {
    for (let i = 0; i < this.keepPoints; i += 1) this._appendPoint();
    this._rebuildGeometry();
  }

  _appendPoint() {
    const sharpEvent = Math.random() < 0.05;
    const accel = sharpEvent ? 0.018 : 0.006;
    const limit = sharpEvent ? 0.08 : 0.03;

    this.curvature += (Math.random() - 0.5) * accel;
    this.curvature = THREE.MathUtils.clamp(this.curvature, -limit, limit);

    this.heading += this.curvature;

    this.head.x += Math.sin(this.heading) * this.segmentLength;
    this.head.z -= Math.cos(this.heading) * this.segmentLength;

    this.points.push(new THREE.Vector3(this.head.x, this.head.y, this.head.z));
  }

  _rebuildGeometry() {
    const n = this.points.length;
    if (n < 3) return;

    const vertices = new Float32Array(n * 2 * 3);
    const indices = [];

    for (let i = 0; i < n; i += 1) {
      const prev = this.points[Math.max(0, i - 1)];
      const next = this.points[Math.min(n - 1, i + 1)];
      const tangent = next.clone().sub(prev).normalize();
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();

      const leftPos = this.points[i].clone().addScaledVector(right, -this.roadHalf);
      const rightPos = this.points[i].clone().addScaledVector(right, this.roadHalf);

      const vi = i * 6;
      vertices[vi] = leftPos.x;
      vertices[vi + 1] = leftPos.y;
      vertices[vi + 2] = leftPos.z;
      vertices[vi + 3] = rightPos.x;
      vertices[vi + 4] = rightPos.y;
      vertices[vi + 5] = rightPos.z;

      if (i < n - 1) {
        const a = i * 2;
        const b = i * 2 + 1;
        const c = i * 2 + 2;
        const d = i * 2 + 3;
        indices.push(a, c, b, b, c, d);
      }
    }

    this.roadGeom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    this.roadGeom.setIndex(indices);
    this.roadGeom.computeVertexNormals();

    const mat = new THREE.Matrix4();
    let visibleDashes = 0;

    for (let i = 1; i < n - 1; i += 1) {
      if (i % 2 !== 0) continue;
      const p = this.points[i];
      const next = this.points[i + 1];
      const dir = next.clone().sub(p).normalize();
      const yaw = Math.atan2(dir.x, -dir.z);

      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
      mat.compose(new THREE.Vector3(p.x, 0.02, p.z), quat, new THREE.Vector3(1, 1, 1));
      this.dashMesh.setMatrixAt(visibleDashes, mat);
      visibleDashes += 1;
    }

    this.dashMesh.count = visibleDashes;
    this.dashMesh.instanceMatrix.needsUpdate = true;
  }

  update(carPos) {
    const nearTail = this.points[14];
    const distTail = nearTail ? carPos.distanceTo(nearTail) : 0;

    if (distTail > this.segmentLength * 6) {
      this.points.shift();
      this._appendPoint();
      this._rebuildGeometry();
    }
  }

  getForwardTarget(offset = 12) {
    const i = Math.min(this.points.length - 1, offset);
    return this.points[i] || new THREE.Vector3();
  }

  getClosestPoint(pos) {
    let best = this.points[0];
    let bestD2 = Infinity;
    for (const p of this.points) {
      const dx = pos.x - p.x;
      const dz = pos.z - p.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = p;
      }
    }
    return best;
  }
}
