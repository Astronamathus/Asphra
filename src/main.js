import * as THREE from 'three';
import { RoadSystem } from './world/RoadSystem.js';
import { TerrainSystem } from './world/TerrainSystem.js';
import { CameraRig } from './camera/CameraRig.js';
import { VehicleController } from './vehicle/VehicleController.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa4c6e5);
scene.fog = new THREE.FogExp2(0xa4c6e5, 0.0028);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 6000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const sun = new THREE.DirectionalLight(0xffffff, 1.15);
sun.position.set(220, 280, 120);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -400;
sun.shadow.camera.right = 400;
sun.shadow.camera.top = 400;
sun.shadow.camera.bottom = -400;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 1800;
scene.add(sun);

scene.add(new THREE.HemisphereLight(0xd8edff, 0x4d7040, 0.6));

const terrain = new TerrainSystem(scene);
const road = new RoadSystem(scene);
const vehicle = new VehicleController(scene);
const cameraRig = new CameraRig(camera);

const hud = document.getElementById('hud');
const clock = new THREE.Clock();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(1 / 30, clock.getDelta());
  const elapsed = clock.elapsedTime;

  vehicle.update(dt);
  road.update(vehicle.position);
  terrain.update(vehicle.position, elapsed);

  const closest = road.getClosestPoint(vehicle.position);
  vehicle.position.y = THREE.MathUtils.lerp(vehicle.position.y, closest.y + 0.62, 0.15);

  cameraRig.update(dt, vehicle.position, vehicle.yaw, Math.abs(vehicle.speed));

  hud.textContent = `Speed: ${(Math.max(0, vehicle.speed) * 3.6).toFixed(0)} km/h\nTarget: quality world + ribbon road + cinematic camera`;

  renderer.render(scene, camera);
}

animate();
