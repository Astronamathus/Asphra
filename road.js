let roadSegments = [];
let segmentLength = 5;
let visibleSegments = 10;
let currentAngle = 0; // direction of road
let visualAngle = 0;
let roadMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });

function createRoad(scene) {
  for (let i = 0; i < visibleSegments; i++) {
    addSegment(scene);
  }
}

function addSegment(scene, zPos) {
  const geometry = new THREE.PlaneGeometry(10, segmentLength);
  const segment = new THREE.Mesh(geometry, roadMaterial);

  segment.rotation.x = -Math.PI / 2;

  // RANDOM TURN (small)
  let turn = (Math.random() - 0.5) * 0.2; // adjust intensity here
  currentAngle += turn;
  visualAngle += (currentAngle - visualAngle) * 0.1;
  // Position relative to last segment
  if (roadSegments.length === 0) {
    segment.position.set(0, -1, 0);
  } else {
    const last = roadSegments[roadSegments.length - 1];

    const dx = Math.sin(currentAngle) * segmentLength;
    const dz = Math.cos(currentAngle) * segmentLength;

    segment.position.x = last.position.x + dx;
    segment.position.z = last.position.z - dz;

    segment.position.y = -1;
  }

  scene.add(segment);
  roadSegments.push(segment);

  createLaneDashes(segment);
}
  function createLaneDashes(parentSegment) {
  // Properly clear old dashes
  while (parentSegment.children.length > 0) {
    parentSegment.remove(parentSegment.children[0]);
  }

  const dashLength = 3;
  const gap = 1;

  const dashGeometry = new THREE.PlaneGeometry(dashLength, 0.3);
  const dashMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });

  for (let i = -segmentLength / 2; i < segmentLength / 2; i += dashLength + gap) {
    const dash = new THREE.Mesh(dashGeometry, dashMaterial);

    // Lay flat
    dash.rotation.z = -Math.PI / 2;
    dash.rotation.y = visualAngle;

    // Position along segment (local)
    dash.position.set(0, -0.99, i);

    parentSegment.add(dash);
  }
}
function updateRoad(scene, car) {
  if (roadSegments.length === 0) return;

  let first = roadSegments[0];
  let last = roadSegments[roadSegments.length - 1];

  // Distance between car and last segment
  let dist = car.position.distanceTo(last.position);

  if (dist < segmentLength * 5) {
    // Add new segment ahead
    addSegment(scene);

    // Remove old segment behind
    scene.remove(first);
    roadSegments.shift();
  }
}
