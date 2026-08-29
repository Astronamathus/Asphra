if (window.THREE) {
const CHUNK_LENGTH = 120;
const CHUNK_WIDTH = 240;
const CHUNK_RES_X = 40;
const CHUNK_RES_Z = 48;
const ROAD_WIDTH = 12;
const SHOULDER_WIDTH = 4;
const DRAW_DISTANCE = 6;
const TREE_COUNT = 34;
const TERRAIN_SEED = 187.31;

const MAX_ACCEL = 7;
const BRAKE_DECEL = 12;

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
document.body.appendChild(renderer.domElement);

const ambient = new THREE.HemisphereLight("#fff8e8", "#5b7b63", 1.7);
scene.add(ambient);

const sun = new THREE.DirectionalLight("#fff0cf", 1.9);
sun.position.set(-80, 120, -40);
sun.castShadow = true;
scene.add(sun);

const roadMaterial = new THREE.MeshStandardMaterial({ color: "#3f454a" });
const shoulderMaterial = new THREE.MeshStandardMaterial({ color: "#b8a17a" });

const chunkStore = new Map();

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

// 🔥 NEW STATE (free movement)
const state = {
  position: new THREE.Vector3(0, 2, 0),
  velocity: new THREE.Vector3(),
  speed: 0,
  heading: 0
};

const cameraTarget = new THREE.Vector3();

window.addEventListener("resize", onResize);
window.addEventListener("keydown", (e) => setKey(e.code, true));
window.addEventListener("keyup", (e) => setKey(e.code, false));

updateChunks();
updateCamera(1 / 60);
animate();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.033);

  updateVehicle(dt);
  updateChunks();
  updateCamera(dt);

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
  // acceleration
  if (keys.forward) state.speed += MAX_ACCEL * dt;
  if (keys.back) state.speed -= MAX_ACCEL * dt;

  // braking
  if (keys.brake) {
    if (state.speed > 0) state.speed -= BRAKE_DECEL * dt;
    else state.speed += BRAKE_DECEL * dt;
  }

  // friction
  if (!keys.forward && !keys.back && !keys.brake) {
    state.speed *= 0.98;
  }

  // speed cap (~230 km/h)
  const MAX_FORWARD = 230 / 3.6;
  const MAX_REVERSE = -40 / 3.6;
  state.speed = THREE.MathUtils.clamp(state.speed, MAX_REVERSE, MAX_FORWARD);

  // steering
  const steerInput = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const steerStrength = 1.8 * (state.speed / MAX_FORWARD);
  state.heading -= steerInput * steerStrength * dt;

  // movement
  const forward = new THREE.Vector3(
    Math.sin(state.heading),
    0,
    Math.cos(state.heading)
  );

  state.velocity.copy(forward).multiplyScalar(state.speed);
  state.position.addScaledVector(state.velocity, dt);

  // terrain height
  const groundY = getTerrainHeight(state.position.x, state.position.z);
  state.position.y = groundY + 0.6;

  // apply transform
  car.group.position.copy(state.position);
  car.group.rotation.set(0, state.heading, 0);

  // wheels
  const wheelSpin = state.speed * dt * 2;
  for (const wheel of car.wheels) {
    wheel.rotation.x -= wheelSpin;
  }

  const steerAngle = steerInput * 0.5;
  car.frontLeftPivot.rotation.y = steerAngle;
  car.frontRightPivot.rotation.y = steerAngle;

  speedEl.textContent = `${Math.round(Math.abs(state.speed) * 3.6)} km/h`;
}

// ================= CAMERA =================

function updateCamera(dt) {
  const forward = new THREE.Vector3(
    Math.sin(state.heading),
    0,
    Math.cos(state.heading)
  );

  cameraTarget
    .copy(state.position)
    .addScaledVector(forward, -12)
    .add(new THREE.Vector3(0, 6, 0));

  camera.position.lerp(cameraTarget, 1 - Math.pow(0.001, dt));

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
      scene.add(chunk.group);
    }
  }
}

// ================= WORLD =================

function buildChunk(index) {
  const zStart = index * CHUNK_LENGTH;
  const group = new THREE.Group();

  const terrain = createTerrainMesh(zStart);
  const road = createRoadMesh(zStart);

  group.add(terrain, road);
  return { group };
}


  const terrain = createTerrainMesh(zStart);
  const road = createRoadMesh(zStart);

  group.add(terrain, road);
  return { group };
}

function createTerrainMesh(zStart) {
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

  return new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: "#6fa36f" })
  );
}

function createRoadMesh(zStart) {
  const geo = new THREE.PlaneGeometry(ROAD_WIDTH, CHUNK_LENGTH, 1, 20);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.05, zStart + CHUNK_LENGTH / 2);


function createRoadMesh(zStart) {
  const geo = new THREE.PlaneGeometry(ROAD_WIDTH, CHUNK_LENGTH, 1, 20);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.05, zStart + CHUNK_LENGTH / 2);

  return new THREE.Mesh(geo, roadMaterial);
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
  const pivots = [];

  for (let x of [-1, 1]) {
    for (let z of [-1.5, 1.5]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.4, z);

      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16),
        new THREE.MeshStandardMaterial({ color: "#222" })
      );
      wheel.rotation.z = Math.PI / 2;

      pivot.add(wheel);
      group.add(pivot);

      wheels.push(wheel);
      pivots.push(pivot);
    }
  }

  return {
    group,
    wheels,
    frontLeftPivot: pivots[0],
    frontRightPivot: pivots[1]
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

} else {
  startCanvasFallback();
}

function startCanvasFallback() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  document.body.appendChild(canvas);

  let width = 0;
  let height = 0;
  let speed = 0;
  let heading = 0;
  const keys = { forward: false, back: false, left: false, right: false, brake: false };

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  function setKey(code, pressed) {
    if (code === "KeyW" || code === "ArrowUp") keys.forward = pressed;
    if (code === "KeyS" || code === "ArrowDown") keys.back = pressed;
    if (code === "KeyA" || code === "ArrowLeft") keys.left = pressed;
    if (code === "KeyD" || code === "ArrowRight") keys.right = pressed;
    if (code === "Space") keys.brake = pressed;
  }

  function draw(now) {
    const dt = 1 / 60;
    if (keys.forward) speed += 7 * dt;
    if (keys.back) speed -= 7 * dt;
    if (keys.brake) speed *= 0.9;
    if (!keys.forward && !keys.back && !keys.brake) speed *= 0.98;
    speed = Math.max(-11, Math.min(64, speed));
    heading += ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * 1.6 * dt;

    ctx.clearRect(0, 0, width, height);

    const horizon = height * 0.44;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, "#b9ddff");
    sky.addColorStop(1, "#d8eef7");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, horizon);

    const ground = ctx.createLinearGradient(0, horizon, 0, height);
    ground.addColorStop(0, "#82b979");
    ground.addColorStop(1, "#5d8e58");
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizon, width, height - horizon);

    const roadTop = width * 0.12;
    const roadBottom = width * 0.58;
    ctx.fillStyle = "#3f454a";
    ctx.beginPath();
    ctx.moveTo(width / 2 - roadTop / 2, horizon);
    ctx.lineTo(width / 2 + roadTop / 2, horizon);
    ctx.lineTo(width / 2 + roadBottom / 2, height);
    ctx.lineTo(width / 2 - roadBottom / 2, height);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.lineWidth = 6;
    ctx.setLineDash([32, 28]);
    ctx.beginPath();
    ctx.moveTo(width / 2, horizon);
    ctx.lineTo(width / 2, height);
    ctx.stroke();
    ctx.setLineDash([]);

    const carX = width / 2;
    const carY = height * 0.72;
    ctx.save();
    ctx.translate(carX, carY);
    ctx.rotate(heading * 0.2);
    ctx.fillStyle = "#1f2430";
    ctx.fillRect(-52, -74, 104, 148);
    ctx.fillStyle = "#d9242f";
    ctx.fillRect(-42, -64, 84, 128);
    ctx.fillStyle = "#bde8ff";
    ctx.fillRect(-30, -42, 60, 38);
    ctx.fillStyle = "#151515";
    ctx.fillRect(-62, -52, 14, 40);
    ctx.fillRect(48, -52, 14, 40);
    ctx.fillRect(-62, 22, 14, 40);
    ctx.fillRect(48, 22, 14, 40);
    ctx.restore();

    const speedEl = document.querySelector("#speed");
    if (speedEl) speedEl.textContent = `${Math.round(Math.abs(speed) * 3.6)} km/h`;

    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", (e) => setKey(e.code, true));
  window.addEventListener("keyup", (e) => setKey(e.code, false));
  resize();
  requestAnimationFrame(draw);
}
