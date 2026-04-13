import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";

const CHUNK_LENGTH = 120;
const CHUNK_WIDTH = 240;
const CHUNK_RES_X = 40;
const CHUNK_RES_Z = 48;
const ROAD_WIDTH = 12;
const SHOULDER_WIDTH = 4;
const DRAW_DISTANCE = 6;
const TREE_COUNT = 34;
const TERRAIN_SEED = 187.31;
const MAX_SPEED = 64;
const MAX_ACCEL = 7;
const BRAKE_DECEL = 12;
const ROAD_ELEVATION = 0.16;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#b9ddff");
scene.fog = new THREE.Fog("#d2e7ef", 100, 540);

const camera = new THREE.PerspectiveCamera(
  68,
  window.innerWidth / window.innerHeight,
  0.1,
  1200
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const ambient = new THREE.HemisphereLight("#fff8e8", "#5b7b63", 1.7);
scene.add(ambient);

const sun = new THREE.DirectionalLight("#fff0cf", 1.9);
sun.position.set(-80, 120, -40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 320;
sun.shadow.camera.left = -120;
sun.shadow.camera.right = 120;
sun.shadow.camera.top = 120;
sun.shadow.camera.bottom = -120;
scene.add(sun);

const sunGlow = new THREE.Mesh(
  new THREE.SphereGeometry(14, 24, 24),
  new THREE.MeshBasicMaterial({ color: "#fff3b0", transparent: true, opacity: 0.35 })
);
sunGlow.position.set(-150, 120, -210);
scene.add(sunGlow);

const roadMaterial = new THREE.MeshStandardMaterial({
  color: "#3f454a",
  roughness: 1,
  metalness: 0
});

const shoulderMaterial = new THREE.MeshStandardMaterial({
  color: "#b8a17a",
  roughness: 1
});

const laneMaterial = new THREE.LineDashedMaterial({
  color: "#f8f3d2",
  dashSize: 4,
  gapSize: 3
});

const chunkStore = new Map();
const treeTrunkGeometry = new THREE.CylinderGeometry(0.25, 0.35, 2.8, 6);
const treeCrownGeometry = new THREE.ConeGeometry(1.5, 3.6, 7);
const trunkMaterial = new THREE.MeshStandardMaterial({ color: "#6a4a33", roughness: 1 });
const crownMaterial = new THREE.MeshStandardMaterial({ color: "#527f4d", roughness: 1 });

const keys = {
  forward: false,
  back: false,
  left: false,
  right: false,
  brake: false
};

const speedEl = document.querySelector("#speed");
const clock = new THREE.Clock();

const car = createCar();
scene.add(car.group);

const state = {
  distance: 0,
  speed: 0,
  lateralOffset: 0,
  lateralVelocity: 0
};

const cameraTarget = new THREE.Vector3();
const cameraLook = new THREE.Vector3();

window.addEventListener("resize", onResize);
window.addEventListener("keydown", (event) => setKey(event.code, true));
window.addEventListener("keyup", (event) => setKey(event.code, false));

animate();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.033);
  updateVehicle(dt);
  updateChunks();
  updateCamera(dt);

  renderer.render(scene, camera);
}

function setKey(code, pressed) {
  if (code === "KeyW" || code === "ArrowUp") keys.forward = pressed;
  if (code === "KeyS" || code === "ArrowDown") keys.back = pressed;
  if (code === "KeyA" || code === "ArrowLeft") keys.left = pressed;
  if (code === "KeyD" || code === "ArrowRight") keys.right = pressed;
  if (code === "Space") keys.brake = pressed;
}

function updateVehicle(dt) {
  if (keys.forward) {
    const speedRatio = THREE.MathUtils.clamp(state.speed / MAX_SPEED, 0, 1);
    const acceleration = MAX_ACCEL * (1 - speedRatio ** 3);
    state.speed += acceleration * dt;
  }

  const brakingInput = keys.back || keys.brake;
  if (brakingInput) {
    state.speed -= BRAKE_DECEL * dt;
  }

  if (!keys.forward && !brakingInput) {
    const rollingResistance = Math.min(state.speed, 1.8 * dt);
    state.speed -= rollingResistance;
  }

  state.speed = THREE.MathUtils.clamp(state.speed, 0, MAX_SPEED);

  const steerInput = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const steerForce = 16 + state.speed * 0.25;
  const edgeLimit = ROAD_WIDTH * 0.64;
  state.lateralVelocity += steerInput * steerForce * dt;
  state.lateralVelocity -= state.lateralOffset * 2.1 * dt;
  state.lateralVelocity *= 0.9;
  state.lateralOffset += state.lateralVelocity * dt;
  state.lateralOffset = THREE.MathUtils.clamp(state.lateralOffset, -edgeLimit, edgeLimit);

  state.distance += state.speed * dt * 10.5;

  const center = getRoadCenter(state.distance);
  const tangent = getRoadTangent(state.distance);
  const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

  const carPosition = center.clone().addScaledVector(right, state.lateralOffset);
  carPosition.y = getTerrainHeight(carPosition.x, carPosition.z) + ROAD_ELEVATION + 0.47;

  car.group.position.copy(carPosition);

  const heading = Math.atan2(tangent.x, tangent.z);
  const drift = THREE.MathUtils.clamp(-state.lateralVelocity * 0.02, -0.18, 0.18);
  car.group.rotation.set(0, heading + drift, 0);

  const wheelSpin = state.speed * dt * 1.8;
  for (const wheel of car.wheels) {
    wheel.rotation.x -= wheelSpin;
  }

  const steerYaw = steerInput * 0.35;
  car.frontLeftPivot.rotation.y = steerYaw;
  car.frontRightPivot.rotation.y = steerYaw;

  speedEl.textContent = `${Math.round(state.speed * 6.4)} km/h`;
}

function updateCamera(dt) {
  const tangent = getRoadTangent(state.distance);
  const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

  cameraTarget
    .copy(car.group.position)
    .addScaledVector(tangent, -18)
    .addScaledVector(right, state.lateralOffset * 0.1)
    .add(new THREE.Vector3(0, 7.5, 0));

  camera.position.lerp(cameraTarget, 1 - Math.pow(0.001, dt));

  cameraLook
    .copy(car.group.position)
    .addScaledVector(tangent, 22)
    .add(new THREE.Vector3(0, 2.5, 0));

  camera.lookAt(cameraLook);
}

function updateChunks() {
  const currentChunk = Math.floor(state.distance / CHUNK_LENGTH);

  for (let i = currentChunk - 1; i <= currentChunk + DRAW_DISTANCE; i += 1) {
    if (!chunkStore.has(i)) {
      const chunk = buildChunk(i);
      chunkStore.set(i, chunk);
      scene.add(chunk.group);
    }
  }

  for (const [index, chunk] of chunkStore.entries()) {
    if (index < currentChunk - 2 || index > currentChunk + DRAW_DISTANCE + 1) {
      scene.remove(chunk.group);
      disposeChunk(chunk);
      chunkStore.delete(index);
    }
  }
}

function buildChunk(index) {
  const zStart = index * CHUNK_LENGTH;
  const group = new THREE.Group();

  const terrain = createTerrainMesh(zStart);
  const road = createRoadMesh(zStart);
  const shoulders = createShoulderMesh(zStart);
  const trees = createTrees(zStart);

  group.add(terrain, shoulders.left, shoulders.right, road.mesh, road.lane, trees.trunks, trees.crowns);

  return { group, meshes: [terrain, shoulders.left, shoulders.right, road.mesh, road.lane, trees.trunks, trees.crowns] };
}

function createTerrainMesh(zStart) {
  const geometry = new THREE.PlaneGeometry(
    CHUNK_WIDTH,
    CHUNK_LENGTH,
    CHUNK_RES_X,
    CHUNK_RES_Z
  );
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, zStart + CHUNK_LENGTH * 0.5);

  const position = geometry.attributes.position;
  const colors = [];
  const color = new THREE.Color();

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = getTerrainHeight(x, z);
    position.setY(i, y);

    const hillMix = THREE.MathUtils.clamp((y + 6) / 20, 0, 1);
    color.setRGB(
      THREE.MathUtils.lerp(0.22, 0.48, hillMix),
      THREE.MathUtils.lerp(0.43, 0.62, hillMix),
      THREE.MathUtils.lerp(0.18, 0.33, hillMix)
    );

    const dryPatch = fractalNoise(x * 0.02, z * 0.02, 2, 0.5);
    if (dryPatch > 0.62) {
      color.offsetHSL(-0.03, -0.05, 0.08);
    }

    colors.push(color.r, color.g, color.b);
  }

  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

function createRoadMesh(zStart) {
  const segments = 28;
  const strip = [];
  const lanePoints = [];

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const z = zStart + t * CHUNK_LENGTH;
    const center = getRoadCenter(z);
    const tangent = getRoadTangent(z);
    const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    const leftEdge = center.clone().addScaledVector(right, -ROAD_WIDTH * 0.5);
    const rightEdge = center.clone().addScaledVector(right, ROAD_WIDTH * 0.5);
    leftEdge.y = getTerrainHeight(leftEdge.x, leftEdge.z) + ROAD_ELEVATION;
    rightEdge.y = getTerrainHeight(rightEdge.x, rightEdge.z) + ROAD_ELEVATION;

    strip.push(leftEdge, rightEdge);
    lanePoints.push(center.x, getTerrainHeight(center.x, center.z) + ROAD_ELEVATION + 0.03, center.z);
  }

  const roadGeometry = new THREE.BufferGeometry();
  const roadVertices = [];
  const indices = [];

  for (const point of strip) {
    roadVertices.push(point.x, point.y, point.z);
  }

  for (let i = 0; i < segments; i += 1) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  roadGeometry.setAttribute("position", new THREE.Float32BufferAttribute(roadVertices, 3));
  roadGeometry.setIndex(indices);
  roadGeometry.computeVertexNormals();

  const mesh = new THREE.Mesh(roadGeometry, roadMaterial);
  mesh.receiveShadow = true;

  const laneGeometry = new THREE.BufferGeometry();
  laneGeometry.setAttribute("position", new THREE.Float32BufferAttribute(lanePoints, 3));
  const lane = new THREE.Line(laneGeometry, laneMaterial);
  lane.computeLineDistances();

  return { mesh, lane };
}

function createShoulderMesh(zStart) {
  const left = createShoulderStrip(zStart, -1);
  const right = createShoulderStrip(zStart, 1);
  return { left, right };
}

function createShoulderStrip(zStart, direction) {
  const segments = 28;
  const vertices = [];
  const indices = [];

  for (let i = 0; i <= segments; i += 1) {
    const z = zStart + (i / segments) * CHUNK_LENGTH;
    const center = getRoadCenter(z);
    const tangent = getRoadTangent(z);
    const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    const innerOffset = direction * ROAD_WIDTH * 0.5;
    const outerOffset = direction * (ROAD_WIDTH * 0.5 + SHOULDER_WIDTH);

    const inner = center.clone().addScaledVector(right, innerOffset);
    const outer = center.clone().addScaledVector(right, outerOffset);
    inner.y = getTerrainHeight(inner.x, inner.z) + ROAD_ELEVATION - 0.02;
    outer.y = getTerrainHeight(outer.x, outer.z) + 0.03;

    vertices.push(inner.x, inner.y, inner.z, outer.x, outer.y, outer.z);
  }

  for (let i = 0; i < segments; i += 1) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, shoulderMaterial);
  mesh.receiveShadow = true;
  return mesh;
}

function createTrees(zStart) {
  const trunkMesh = new THREE.InstancedMesh(treeTrunkGeometry, trunkMaterial, TREE_COUNT);
  const crownMesh = new THREE.InstancedMesh(treeCrownGeometry, crownMaterial, TREE_COUNT);
  const dummy = new THREE.Object3D();
  let count = 0;

  for (let i = 0; i < TREE_COUNT; i += 1) {
    const z = zStart + pseudoRandom(zStart * 0.07 + i * 13.1) * CHUNK_LENGTH;
    const center = getRoadCenter(z);
    const tangent = getRoadTangent(z);
    const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const side = pseudoRandom(zStart * 0.13 + i * 9.7) > 0.5 ? 1 : -1;
    const spread = ROAD_WIDTH * 0.8 + 8 + pseudoRandom(zStart * 0.19 + i * 4.3) * 70;
    const lateral = side * spread;
    const x = center.x + right.x * lateral;
    const worldZ = center.z + right.z * lateral;
    const y = getTerrainHeight(x, worldZ);

    if (Math.abs(lateral) < ROAD_WIDTH * 1.3) {
      continue;
    }

    const scale = 0.8 + pseudoRandom(zStart * 0.23 + i * 2.1) * 1.35;
    const yaw = pseudoRandom(zStart * 0.31 + i * 5.6) * Math.PI * 2;

    dummy.position.set(x, y + 1.35 * scale, worldZ);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(count, dummy.matrix);

    dummy.position.set(x, y + 4.1 * scale, worldZ);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    crownMesh.setMatrixAt(count, dummy.matrix);
    count += 1;
  }

  trunkMesh.count = count;
  crownMesh.count = count;
  trunkMesh.instanceMatrix.needsUpdate = true;
  crownMesh.instanceMatrix.needsUpdate = true;
  trunkMesh.castShadow = true;
  crownMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  crownMesh.receiveShadow = true;

  return { trunks: trunkMesh, crowns: crownMesh };
}

function createCar() {
  const group = new THREE.Group();

  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.8, 4.1),
    new THREE.MeshStandardMaterial({ color: "#d4684c", roughness: 0.7, metalness: 0.1 })
  );
  chassis.position.y = 1.2;
  chassis.castShadow = true;
  group.add(chassis);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 0.8, 1.8),
    new THREE.MeshStandardMaterial({ color: "#f2f2f2", roughness: 0.4, metalness: 0.05 })
  );
  cabin.position.set(0, 1.85, -0.1);
  cabin.castShadow = true;
  group.add(cabin);

  const wheels = [];
  const wheelGeometry = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 16);
  wheelGeometry.rotateZ(Math.PI * 0.5);
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: "#1f2125", roughness: 1 });

  const frontLeftPivot = new THREE.Group();
  const frontRightPivot = new THREE.Group();
  frontLeftPivot.position.set(-1.02, 0.55, -1.22);
  frontRightPivot.position.set(1.02, 0.55, -1.22);
  group.add(frontLeftPivot, frontRightPivot);

  const frontLeftWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  const frontRightWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  frontLeftWheel.castShadow = true;
  frontRightWheel.castShadow = true;
  frontLeftPivot.add(frontLeftWheel);
  frontRightPivot.add(frontRightWheel);
  wheels.push(frontLeftWheel, frontRightWheel);

  const rearLeftWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  const rearRightWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  rearLeftWheel.position.set(-1.02, 0.55, 1.22);
  rearRightWheel.position.set(1.02, 0.55, 1.22);
  rearLeftWheel.castShadow = true;
  rearRightWheel.castShadow = true;
  group.add(rearLeftWheel, rearRightWheel);
  wheels.push(rearLeftWheel, rearRightWheel);

  return { group, wheels, frontLeftPivot, frontRightPivot };
}

function getRoadCenter(z) {
  const x =
    Math.sin(z * 0.0035) * 34 +
    Math.sin(z * 0.0085 + 1.7) * 12 +
    Math.sin(z * 0.014 + 5.1) * 4;
  return new THREE.Vector3(x, 0, z);
}

function getRoadTangent(z) {
  const sampleA = getRoadCenter(z - 0.5);
  const sampleB = getRoadCenter(z + 0.5);
  return sampleB.sub(sampleA).setY(0).normalize();
}

function getTerrainHeight(x, z) {
  const broad = fractalNoise(x * 0.006 + TERRAIN_SEED, z * 0.006, 4, 0.5) * 22;
  const detail = fractalNoise(x * 0.028, z * 0.028 + TERRAIN_SEED, 3, 0.55) * 2.2;
  const valley = -Math.pow(Math.abs(x) / 170, 2) * 1.4;
  const roadCenter = getRoadCenter(z).x;
  const roadDistance = Math.abs(x - roadCenter);
  const roadBlend = smoothstep(THREE.MathUtils.clamp(1 - roadDistance / (ROAD_WIDTH * 0.95), 0, 1));
  const shoulderBlend = smoothstep(
    THREE.MathUtils.clamp(1 - roadDistance / (ROAD_WIDTH * 0.95 + SHOULDER_WIDTH * 1.2), 0, 1)
  );
  const terrainBase = broad + detail + valley - 5.5;
  const roadBase = broad * 0.08 + detail * 0.12 + valley * 0.35 - 5.9;
  const blended = THREE.MathUtils.lerp(terrainBase, roadBase, roadBlend);

  return THREE.MathUtils.lerp(blended, blended + 0.25, shoulderBlend);
}

function fractalNoise(x, z, octaves, persistence) {
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  let max = 0;

  for (let i = 0; i < octaves; i += 1) {
    total += smoothValueNoise(x * frequency, z * frequency) * amplitude;
    max += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  return total / max;
}

function smoothValueNoise(x, z) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = smoothstep(x - x0);
  const tz = smoothstep(z - z0);

  const v00 = pseudoRandom2D(x0, z0);
  const v10 = pseudoRandom2D(x0 + 1, z0);
  const v01 = pseudoRandom2D(x0, z0 + 1);
  const v11 = pseudoRandom2D(x0 + 1, z0 + 1);

  const a = THREE.MathUtils.lerp(v00, v10, tx);
  const b = THREE.MathUtils.lerp(v01, v11, tx);
  return THREE.MathUtils.lerp(a, b, tz) * 2 - 1;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function pseudoRandom2D(x, z) {
  const value = Math.sin(x * 127.1 + z * 311.7 + TERRAIN_SEED * 19.19) * 43758.5453123;
  return value - Math.floor(value);
}

function pseudoRandom(value) {
  const r = Math.sin(value * 91.17 + 17.13) * 43758.5453123;
  return r - Math.floor(r);
}

function disposeChunk(chunk) {
  for (const mesh of chunk.meshes) {
    if (mesh.geometry) mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      for (const material of mesh.material) material.dispose();
    } else if (
      mesh.material &&
      mesh.material !== roadMaterial &&
      mesh.material !== shoulderMaterial &&
      mesh.material !== laneMaterial &&
      mesh.material !== trunkMaterial &&
      mesh.material !== crownMaterial
    ) {
      mesh.material.dispose();
    }
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
