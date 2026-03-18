let turnLeft = false;
let turnRight = false;
let moveForward = false;
let moveBackward = false;

// Physics
let turnSpeed = 0;
let maxTurn = 0.04;
let turnAccel = 0.002;

let velocity = 0;
let maxSpeed = 0.6;
let acceleration = 0.01;
let friction = 0.98;
let brakeForce = 0.02;

// Controls
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") turnLeft = true;
  if (e.key === "ArrowRight") turnRight = true;
  if (e.key === "ArrowUp") moveForward = true;
  if (e.key === "ArrowDown") moveBackward = true;
});

document.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft") turnLeft = false;
  if (e.key === "ArrowRight") turnRight = false;
  if (e.key === "ArrowUp") moveForward = false;
  if (e.key === "ArrowDown") moveBackward = false;
});

// Create car
function createCar(scene) {
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xFFFF00,
    metalness: 0.5,
    roughness: 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1
  });

  const cube = new THREE.Mesh(geometry, material);
  cube.position.y = 0.5;
  scene.add(cube);

  return cube;
}

// Update car
function updateCar(cube) {
  // Turning
  if (turnLeft) turnSpeed -= turnAccel;
  if (turnRight) turnSpeed += turnAccel;

  turnSpeed = Math.max(-maxTurn, Math.min(maxTurn, turnSpeed));
  turnSpeed *= 0.9;

  cube.rotation.y += turnSpeed;
  cube.rotation.z = -turnSpeed * 5;

  // Acceleration
  if (moveForward) velocity += acceleration;
  if (moveBackward) velocity -= brakeForce;

  velocity = Math.max(-0.3, Math.min(maxSpeed, velocity));
  velocity *= friction;

  if (Math.abs(velocity) < 0.001) velocity = 0;

  // Movement
  cube.position.x += Math.sin(cube.rotation.y) * velocity;
  cube.position.z -= Math.cos(cube.rotation.y) * velocity;
}