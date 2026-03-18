const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

// Camera (basic, real logic in camera.js)
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

// Renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
const light = new THREE.PointLight(0xffffff, 5);
light.position.set(10, 10, 10);
scene.add(light);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

// Fog
scene.fog = new THREE.Fog(0x111111, 10, 50);

// Create systems
createRoad(scene);
const car = createCar(scene);

// Initial camera position
camera.position.z = 10;

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  updateCar(car);
  updateCamera(camera, car);

  renderer.render(scene, camera);
}

animate();