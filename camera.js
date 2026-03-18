function updateCamera(camera, cube) {
  let distance = 8;
  let height = 3;

  let targetX = cube.position.x - Math.sin(cube.rotation.y) * distance;
  let targetZ = cube.position.z + Math.cos(cube.rotation.y) * distance;
  let targetY = cube.position.y + height;

  // Smooth follow
  camera.position.x += (targetX - camera.position.x) * 0.1;
  camera.position.y += (targetY - camera.position.y) * 0.1;
  camera.position.z += (targetZ - camera.position.z) * 0.1;

  // Look forward (not center)
  let lookX = cube.position.x + Math.sin(cube.rotation.y);
  let lookZ = cube.position.z - Math.cos(cube.rotation.y);

  camera.lookAt(lookX, cube.position.y, lookZ);
}