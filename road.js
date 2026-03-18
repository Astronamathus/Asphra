let roadSegments = [];
let segmentLength = 20;
let visibleSegments = 10;

let roadMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });

function createRoad(scene) {
  for (let i = 0; i < visibleSegments; i++) {
    addSegment(scene, i * segmentLength);
  }
}

function addSegment(scene, zPos) {
  const geometry = new THREE.PlaneGeometry(10, segmentLength);
  const segment = new THREE.Mesh(geometry, roadMaterial);

  segment.rotation.x = -Math.PI / 2;
  segment.position.y = -1;
  segment.position.z = -zPos;

  scene.add(segment);
  roadSegments.push(segment);
  createLaneDashes(segment);
}
function updateRoad(scene, car) {
  let firstSegment = roadSegments[0];
  let lastSegment = roadSegments[roadSegments.length - 1];

  // If car has moved forward enough
  if (car.position.z < lastSegment.position.z + segmentLength * 5) {
    
    // Add new segment ahead
    addSegment(scene, -lastSegment.position.z + segmentLength);

    // Remove old segment behind
    scene.remove(firstSegment);
    roadSegments.shift();
  }
}
  function createLaneDashes(parentSegment) {
  const dashLength = 3;
  const gap = 1;

  const dashGeometry = new THREE.PlaneGeometry(dashLength, 0.3);
  const dashMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });

  for (let i = -segmentLength / 2; i < segmentLength / 2; i += dashLength + gap) {
    const dash = new THREE.Mesh(dashGeometry, dashMaterial);
    dash.rotation.z = Math.PI / 2;

    dash.position.set(0, 0.01, i);

    // Center of road (lane divider)
    dash.position.x = 0;

    // Slightly above road to avoid flicker
    dash.position.y = 0;

    // Position along the segment
    dash.position.z = i;

    // Attach to segment (IMPORTANT)
    parentSegment.add(dash);
  }
}
