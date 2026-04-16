import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";

const CHUNK_LENGTH = 120;
const CHUNK_WIDTH = 240;
const CHUNK_RES_X = 40;
const CHUNK_RES_Z = 48;
const DRAW_DISTANCE = 6;

const MAX_ACCEL = 7;
const BRAKE_DECEL = 12;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#b9ddff");

const camera = new THREE.PerspectiveCamera(
  68,
  window.innerWidth / window.innerHeight,
  0.1,
  1200
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight("#fff8e8", "#5b7b63", 1.7));

const chunkStore = new Map();

const keys = {
  forward: false,
  back: false,
  left: false,
  right: false,
  brake: false
};

const clock = new THREE.Clock();
const speedEl = document.querySelector("#speed");

// 🚗 FREE MOVEMENT STATE
const state = {
  position: new THREE.Vector3(0, 2, 0),
  speed: 0,
  heading: 0
};

const car = createCar();
scene.add(car.group);

window.addEventListener("keydown", e => setKey(e.code, true));
window.addEventListener("keyup", e => setKey(e.code, false));
window.addEventListener("resize", onResize);

animate();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.033);

  updateVehicle(dt);
  updateCamera(dt);
  updateChunks();

  renderer.render(scene, camera);
}

// ================= INPUT =================

function setKey(code, pressed) {
  if (code === "KeyW" || code === "ArrowUp") keys.forward = pressed;
  if (code === "KeyS" || code === "ArrowDown") keys.back = pressed;
  if (code === "KeyA" || code === "ArrowLeft") keys.left = pressed;
  if (code === "KeyD" || code === "ArrowRight") keys.right = pressed;
  if (code === "Space") keys.brake = pressed;
}

// ================= VEHICLE =================

function updateVehicle(dt) {
  if (keys.forward) state.speed += MAX_ACCEL * dt;
  if (keys.back) state.speed -= MAX_ACCEL * dt;

  if (keys.brake) {
    if (state.speed > 0) state.speed -= BRAKE_DECEL * dt;
    else state.speed += BRAKE_DECEL * dt;
  }

  if (!keys.forward && !keys.back && !keys.brake) {
    state.speed *= 0.985;
  }

  const MAX_FORWARD = 230 / 3.6;
  const MAX_REVERSE = -40 / 3.6;
  state.speed = THREE.MathUtils.clamp(state.speed, MAX_REVERSE, MAX_FORWARD);

  const steerInput = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);

  const steerFactor =
    2.2 * (1 - Math.min(Math.abs(state.speed) / MAX_FORWARD, 1));

  state.heading -= steerInput * steerFactor * dt;

  const forward = new THREE.Vector3(
    Math.sin(state.heading),
    0,
    Math.cos(state.heading)
  );

  state.position.addScaledVector(forward, state.speed * dt);

  const groundY = getTerrainHeight(state.position.x, state.position.z);
  state.position.y = groundY + 0.6;

  car.group.position.copy(state.position);
  car.group.rotation.set(0, state.heading, 0);

  const spin = state.speed * dt * 2;
  for (const wheel of car.wheels) {
    wheel.rotation.x -= spin;
  }

  // 🔥 REAR WHEEL STEERING
  const steerAngle = steerInput * 0.5;

  car.frontLeftPivot.rotation.y = 0;
  car.frontRightPivot.rotation.y = 0;

  car.rearLeftPivot.rotation.y = steerAngle;
  car.rearRightPivot.rotation.y = steerAngle;

  speedEl.textContent = `${Math.round(Math.abs(state.speed) * 3.6)} km/h`;
}

// ================= CAMERA =================

function updateCamera(dt) {
  const forward = new THREE.Vector3(
    Math.sin(state.heading),
    0,
    Math.cos(state.heading)
  );

  const target = state.position
    .clone()
    .addScaledVector(forward, -12)
    .add(new THREE.Vector3(0, 6, 0));

  camera.position.lerp(target, 1 - Math.pow(0.001, dt));

  const look = state.position.clone().addScaledVector(forward, 15);
  look.y += 2;

  camera.lookAt(look);
}

// ================= CHUNKS =================

function updateChunks() {
  const currentChunk = Math.floor(state.position.z / CHUNK_LENGTH);

  for (let i = currentChunk - 2; i <= currentChunk + DRAW_DISTANCE; i++) {
    if (!chunkStore.has(i)) {
      const chunk = buildChunk(i);
      chunkStore.set(i, chunk);
      scene.add(chunk);
    }
  }
}

function buildChunk(index) {
  const zStart = index * CHUNK_LENGTH;

  const geo = new THREE.PlaneGeometry(
    CHUNK_WIDTH,
    CHUNK_LENGTH,
    CHUNK_RES_X,
    CHUNK_RES_Z
  );
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, zStart + CHUNK_LENGTH / 2);

  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, getTerrainHeight(x, z));
  }

  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: "#6fa36f" })
  );

  return mesh;
}

// ================= CAR =================

function createCar() {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2, 1, 4),
    new THREE.MeshStandardMaterial({ color: "red" })
  );
  body.position.y = 1;
  group.add(body);

  const wheels = [];

  const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: "#222" });

  const frontLeftPivot = new THREE.Group();
  const frontRightPivot = new THREE.Group();
  const rearLeftPivot = new THREE.Group();
  const rearRightPivot = new THREE.Group();

  frontLeftPivot.position.set(-1, 0.4, -1.5);
  frontRightPivot.position.set(1, 0.4, -1.5);
  rearLeftPivot.position.set(-1, 0.4, 1.5);
  rearRightPivot.position.set(1, 0.4, 1.5);

  group.add(frontLeftPivot, frontRightPivot, rearLeftPivot, rearRightPivot);

  const pivots = [
    frontLeftPivot,
    frontRightPivot,
    rearLeftPivot,
    rearRightPivot
  ];

  for (const pivot of pivots) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    pivot.add(wheel);
    wheels.push(wheel);
  }

  return {
    group,
    wheels,
    frontLeftPivot,
    frontRightPivot,
    rearLeftPivot,
    rearRightPivot
  };
}

// ================= TERRAIN =================

function getTerrainHeight(x, z) {
  return Math.sin(x * 0.01) * 2 + Math.cos(z * 0.01) * 2;
}

// ================= RESIZE =================

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
