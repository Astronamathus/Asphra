if (window.THREE) {
  const CHUNK_LENGTH = 120;
  const CHUNK_WIDTH = 320;
  const CHUNK_RES_X = 56;
  const CHUNK_RES_Z = 64;
  const DRAW_DISTANCE = 7;
  const ROAD_WIDTH = 14;
  const SHOULDER_WIDTH = 3.5;
  const LANE_MARK_LENGTH = 8;
  const LANE_GAP = 12;
  const ROAD_SEGMENT_LENGTH = 90;
  const MAX_ACCEL = 8.5;
  const BRAKE_DECEL = 15;
  const MAX_FORWARD = 120 / 3.6;
  const MAX_REVERSE = -25 / 3.6;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f3dfc8');
  scene.fog = new THREE.Fog('#f3dfc8', 90, 620);

  const camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, 1400);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight('#fff7e6', '#789067', 1.75));
  const sun = new THREE.DirectionalLight('#ffe0a8', 2.15);
  sun.position.set(-90, 140, -70);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun);

  const materials = {
    grass: new THREE.MeshStandardMaterial({ color: '#91a957', roughness: 0.92 }),
    road: new THREE.MeshStandardMaterial({ color: '#454348', roughness: 0.72, side: THREE.DoubleSide }),
    shoulder: new THREE.MeshStandardMaterial({ color: '#b7a178', roughness: 0.95, side: THREE.DoubleSide }),
    line: new THREE.MeshBasicMaterial({ color: '#f2efe5', side: THREE.DoubleSide }),
    fence: new THREE.MeshStandardMaterial({ color: '#3c2b1d', roughness: 0.85 }),
    sign: new THREE.MeshStandardMaterial({ color: '#f0bc13', roughness: 0.55 }),
    signFace: new THREE.MeshBasicMaterial({ color: '#171717' }),
    tire: new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.9 }),
    rim: new THREE.MeshStandardMaterial({ color: '#8c9299', metalness: 0.35, roughness: 0.35 })
  };

  const chunkStore = new Map();
  const keys = { forward: false, back: false, left: false, right: false, brake: false };
  const speedEl = document.querySelector('#speed');
  const clock = new THREE.Clock();
  const car = createCar();
  scene.add(car.group);

  const state = {
    position: new THREE.Vector3(roadCenterX(0), roadHeight(0) + 0.85, 0),
    velocity: new THREE.Vector3(),
    speed: 0,
    heading: roadTangentAngle(0)
  };
  const cameraTarget = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();

  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', (e) => setKey(e.code, true));
  window.addEventListener('keyup', (e) => setKey(e.code, false));

  updateChunks();
  updateVehicle(0);
  camera.position.copy(state.position).add(new THREE.Vector3(0, 5.2, -13));
  updateCamera(1 / 30);
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
    if (code === 'KeyW' || code === 'ArrowUp') keys.forward = pressed;
    if (code === 'KeyS' || code === 'ArrowDown') keys.back = pressed;
    if (code === 'KeyA' || code === 'ArrowLeft') keys.left = pressed;
    if (code === 'KeyD' || code === 'ArrowRight') keys.right = pressed;
    if (code === 'Space') keys.brake = pressed;
  }

  function updateVehicle(dt) {
    if (keys.forward || (!keys.back && state.speed < 13)) state.speed += MAX_ACCEL * 0.45 * dt;
    if (keys.forward) state.speed += MAX_ACCEL * dt;
    if (keys.back) state.speed -= MAX_ACCEL * dt;
    if (keys.brake) state.speed += state.speed > 0 ? -BRAKE_DECEL * dt : BRAKE_DECEL * dt;
    if (!keys.forward && !keys.back && !keys.brake) state.speed *= 0.992;
    state.speed = THREE.MathUtils.clamp(state.speed, MAX_REVERSE, MAX_FORWARD);

    const steerInput = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const desiredRoadHeading = roadTangentAngle(state.position.z + 18);
    state.heading = THREE.MathUtils.lerp(state.heading, desiredRoadHeading, 1 - Math.pow(0.035, dt));
    state.heading -= steerInput * (0.62 + Math.abs(state.speed) * 0.018) * dt;

    const forward = new THREE.Vector3(Math.sin(state.heading), 0, Math.cos(state.heading));
    state.velocity.copy(forward).multiplyScalar(state.speed);
    state.position.addScaledVector(state.velocity, dt);

    const center = roadCenterX(state.position.z);
    state.position.x = THREE.MathUtils.lerp(state.position.x, center, 1 - Math.pow(0.12, dt));
    const groundY = getTerrainHeight(state.position.x, state.position.z);
    state.position.y = groundY + 0.78;

    car.group.position.copy(state.position);
    car.group.rotation.set(0, state.heading, 0);
    car.body.rotation.z = THREE.MathUtils.lerp(car.body.rotation.z, -steerInput * 0.045, 1 - Math.pow(0.02, dt));

    const spin = state.speed * dt * 2.5;
    for (const wheel of car.wheels) wheel.rotation.x -= spin;
    const steerAngle = steerInput * 0.38;
    car.frontLeftPivot.rotation.y = steerAngle;
    car.frontRightPivot.rotation.y = steerAngle;

    speedEl.textContent = `${Math.round(Math.abs(state.speed) * 2.23694)} mph`;
  }

  function updateCamera(dt) {
    const forward = new THREE.Vector3(Math.sin(state.heading), 0, Math.cos(state.heading));
    cameraTarget.copy(state.position).addScaledVector(forward, -11.5).add(new THREE.Vector3(0, 5.4, 0));
    camera.position.lerp(cameraTarget, 1 - Math.pow(0.002, dt));
    lookTarget.copy(state.position).addScaledVector(forward, 28);
    lookTarget.y += 2.4;
    camera.lookAt(lookTarget);
  }

  function updateChunks() {
    const currentChunk = Math.floor(state.position.z / CHUNK_LENGTH);
    for (let i = currentChunk - 2; i <= currentChunk + DRAW_DISTANCE; i++) {
      if (!chunkStore.has(i)) {
        const chunk = buildChunk(i);
        chunkStore.set(i, chunk);
        scene.add(chunk.group);
      }
    }
    for (const [index, chunk] of chunkStore) {
      if (index < currentChunk - 4) {
        scene.remove(chunk.group);
        chunkStore.delete(index);
      }
    }
  }

  function buildChunk(index) {
    const zStart = index * CHUNK_LENGTH;
    const group = new THREE.Group();
    group.add(createTerrainMesh(zStart), createRoadMesh(zStart), createShoulderMesh(zStart, -1), createShoulderMesh(zStart, 1));
    addLaneMarks(group, zStart);
    addFences(group, zStart);
    addChevronSigns(group, zStart);
    addScenery(group, zStart);
    return { group };
  }

  function createTerrainMesh(zStart) {
    const geo = new THREE.PlaneGeometry(CHUNK_WIDTH, CHUNK_LENGTH, CHUNK_RES_X, CHUNK_RES_Z);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, zStart + CHUNK_LENGTH / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, getTerrainHeight(pos.getX(i), pos.getZ(i)) - 0.08);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, materials.grass);
    mesh.receiveShadow = true;
    return mesh;
  }

  function createRoadMesh(zStart) {
    return createRibbonMesh(zStart, ROAD_WIDTH, materials.road, 0.045);
  }

  function createShoulderMesh(zStart, side) {
    const shapeWidth = ROAD_WIDTH + SHOULDER_WIDTH * 2;
    return createRibbonMesh(zStart, shapeWidth, materials.shoulder, 0.018, side, ROAD_WIDTH / 2);
  }

  function createRibbonMesh(zStart, width, material, yOffset, shoulderSide = 0, innerCut = 0) {
    const segments = 40;
    const positions = [];
    const indices = [];
    const rows = shoulderSide ? [[innerCut * shoulderSide], [(width / 2) * shoulderSide]] : [[-width / 2], [width / 2]];
    for (let i = 0; i <= segments; i++) {
      const z = zStart + (i / segments) * CHUNK_LENGTH;
      const tangent = roadTangent(z);
      const normal = new THREE.Vector3(tangent.z, 0, -tangent.x);
      const center = new THREE.Vector3(roadCenterX(z), roadHeight(z) + yOffset, z);
      for (const row of rows) {
        const p = center.clone().addScaledVector(normal, row[0]);
        p.y = getTerrainHeight(p.x, p.z) + yOffset;
        positions.push(p.x, p.y, p.z);
      }
    }
    for (let i = 0; i < segments; i++) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    return mesh;
  }

  function addLaneMarks(group, zStart) {
    for (let z = zStart + 8; z < zStart + CHUNK_LENGTH; z += LANE_MARK_LENGTH + LANE_GAP) {
      const mark = createRibbonAt(z, LANE_MARK_LENGTH, 0.38, 0, materials.line, 0.075);
      group.add(mark);
    }
    for (const side of [-1, 1]) group.add(createRibbonAt(zStart + CHUNK_LENGTH / 2, CHUNK_LENGTH, 0.22, side * (ROAD_WIDTH / 2 - 0.35), materials.line, 0.08));
  }

  function createRibbonAt(zCenter, length, width, lateralOffset, material, yOffset) {
    const segments = Math.max(2, Math.round(length / 5));
    const positions = [];
    const indices = [];
    for (let i = 0; i <= segments; i++) {
      const z = zCenter - length / 2 + (i / segments) * length;
      const tangent = roadTangent(z);
      const normal = new THREE.Vector3(tangent.z, 0, -tangent.x);
      const center = new THREE.Vector3(roadCenterX(z), roadHeight(z) + yOffset, z).addScaledVector(normal, lateralOffset);
      for (const edge of [-width / 2, width / 2]) {
        const p = center.clone().addScaledVector(normal, edge);
        p.y = getTerrainHeight(p.x, p.z) + yOffset;
        positions.push(p.x, p.y, p.z);
      }
    }
    for (let i = 0; i < segments; i++) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    return new THREE.Mesh(geo, material);
  }

  function addFences(group, zStart) {
    for (const side of [-1, 1]) {
      for (let z = zStart; z <= zStart + CHUNK_LENGTH; z += 12) {
        const p = roadPoint(z, side * (ROAD_WIDTH / 2 + 4.4));
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.45, 0.28), materials.fence);
        post.position.set(p.x, p.y + 0.7, p.z);
        post.castShadow = true;
        group.add(post);
        if (z < zStart + CHUNK_LENGTH - 10) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 12.5), materials.fence);
          rail.position.set(p.x, p.y + 1.05, p.z + 5.9);
          rail.rotation.y = roadTangentAngle(z + 6);
          rail.castShadow = true;
          group.add(rail);
        }
      }
    }
  }

  function addChevronSigns(group, zStart) {
    for (let z = zStart + 35; z < zStart + CHUNK_LENGTH; z += 70) {
      const curve = Math.abs(roadCenterX(z + 15) - roadCenterX(z - 15));
      if (curve < 5) continue;
      const side = roadCenterX(z + 15) > roadCenterX(z - 15) ? -1 : 1;
      const p = roadPoint(z, side * (ROAD_WIDTH / 2 + 7));
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.0, 0.18), materials.fence);
      post.position.set(p.x, p.y + 1, p.z);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.08), materials.sign);
      sign.position.set(p.x, p.y + 2.05, p.z);
      sign.rotation.y = roadTangentAngle(z) + Math.PI;
      const face = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.65, 0.09), materials.signFace);
      face.position.z = 0.055;
      sign.add(face);
      group.add(post, sign);
    }
  }

  function addScenery(group, zStart) {
    for (let i = 0; i < 22; i++) {
      const z = zStart + seeded(i, zStart) * CHUNK_LENGTH;
      const side = seeded(i + 99, zStart) > 0.5 ? 1 : -1;
      const offset = side * (ROAD_WIDTH / 2 + 15 + seeded(i + 33, zStart) * 120);
      const p = roadPoint(z, offset);
      const tree = createTree(0.75 + seeded(i + 9, zStart) * 1.3);
      tree.position.set(p.x, p.y, p.z);
      group.add(tree);
    }
  }

  function createTree(scale) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.18 * scale, 1.6 * scale, 6), materials.fence);
    trunk.position.y = 0.8 * scale;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.9 * scale, 2.4 * scale, 7), new THREE.MeshStandardMaterial({ color: '#536d3f', roughness: 0.9 }));
    crown.position.y = 2.2 * scale;
    trunk.castShadow = crown.castShadow = true;
    group.add(trunk, crown);
    return group;
  }

  function createCar() {
    const group = new THREE.Group();
    const body = new THREE.Group();
    group.add(body);
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.62, 4.4), new THREE.MeshStandardMaterial({ color: '#eee0d7', roughness: 0.55 }));
    base.position.y = 0.8;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.74, 2.1), new THREE.MeshStandardMaterial({ color: '#f2e4dc', roughness: 0.45 }));
    cabin.position.set(0, 1.34, -0.35);
    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.08, 0.72), new THREE.MeshStandardMaterial({ color: '#31323a', roughness: 0.28 }));
    rearGlass.position.set(0, 1.48, 0.8);
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.28, 0.32), new THREE.MeshStandardMaterial({ color: '#171717', roughness: 0.8 }));
    bumper.position.set(0, 0.58, 2.18);
    body.add(base, cabin, rearGlass, bumper);
    const wheels = [];
    const pivots = [];
    for (const z of [-1.45, 1.45]) {
      for (const x of [-1.18, 1.18]) {
        const pivot = new THREE.Group();
        pivot.position.set(x, 0.45, z);
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.34, 24), materials.tire);
        tire.rotation.z = Math.PI / 2;
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.37, 18), materials.rim);
        rim.rotation.z = Math.PI / 2;
        tire.add(rim);
        pivot.add(tire);
        group.add(pivot);
        wheels.push(tire);
        pivots.push(pivot);
      }
    }
    group.traverse((child) => { if (child.isMesh) child.castShadow = true; });
    return { group, body, wheels, frontLeftPivot: pivots[2], frontRightPivot: pivots[3] };
  }

  function roadCenterX(z) {
    const segment = z / ROAD_SEGMENT_LENGTH;
    const base = roadSegmentValue(segment, 54, 11);
    const detail = roadSegmentValue(segment * 2 + 0.35, 12, 29);
    return base + detail;
  }
  function roadHeight(z) {
    const segment = z / ROAD_SEGMENT_LENGTH;
    return 6 + roadSegmentValue(segment * 0.72 + 0.5, 9, 47) + Math.sin(z * 0.01) * 1.8;
  }
  function roadSegmentValue(segment, amplitude, salt) {
    const left = Math.floor(segment);
    const t = THREE.MathUtils.smoothstep(segment - left, 0, 1);
    const a = (seeded(left, salt) * 2 - 1) * amplitude;
    const b = (seeded(left + 1, salt) * 2 - 1) * amplitude;
    return THREE.MathUtils.lerp(a, b, t);
  }
  function terrainBase(x, z) { return 2 + Math.sin(x * 0.012 + z * 0.004) * 8 + Math.cos(z * 0.006) * 10 + Math.sin((x + z) * 0.018) * 2.5; }
  function getTerrainHeight(x, z) {
    const center = roadCenterX(z);
    const dist = Math.abs(x - center);
    const blend = 1 - THREE.MathUtils.clamp((dist - ROAD_WIDTH / 2) / 42, 0, 1);
    return THREE.MathUtils.lerp(terrainBase(x, z), roadHeight(z), blend * blend);
  }
  function roadTangent(z) { return new THREE.Vector3(roadCenterX(z + 1) - roadCenterX(z - 1), 0, 2).normalize(); }
  function roadTangentAngle(z) { const t = roadTangent(z); return Math.atan2(t.x, t.z); }
  function roadPoint(z, lateralOffset) {
    const tangent = roadTangent(z);
    const normal = new THREE.Vector3(tangent.z, 0, -tangent.x);
    const p = new THREE.Vector3(roadCenterX(z), roadHeight(z), z).addScaledVector(normal, lateralOffset);
    p.y = getTerrainHeight(p.x, p.z);
    return p;
  }
  function seeded(i, z) { const n = Math.sin(i * 91.7 + z * 0.037) * 43758.5453; return n - Math.floor(n); }
  function onResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }
} else {
  startCanvasFallback();
}

function startCanvasFallback() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  document.body.appendChild(canvas);
  let width = 0;
  let height = 0;
  let speed = 0;
  let heading = 0;
  const keys = { forward: false, back: false, left: false, right: false, brake: false };
  function resize() { width = canvas.width = window.innerWidth; height = canvas.height = window.innerHeight; }
  function setKey(code, pressed) {
    if (code === 'KeyW' || code === 'ArrowUp') keys.forward = pressed;
    if (code === 'KeyS' || code === 'ArrowDown') keys.back = pressed;
    if (code === 'KeyA' || code === 'ArrowLeft') keys.left = pressed;
    if (code === 'KeyD' || code === 'ArrowRight') keys.right = pressed;
    if (code === 'Space') keys.brake = pressed;
  }
  function draw() {
    const dt = 1 / 60;
    if (keys.forward || (!keys.back && speed < 13)) speed += 4 * dt;
    if (keys.forward) speed += 7 * dt;
    if (keys.back) speed -= 7 * dt;
    if (keys.brake) speed *= 0.9;
    if (!keys.forward && !keys.back && !keys.brake) speed *= 0.99;
    heading += ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * 1.4 * dt;
    ctx.clearRect(0, 0, width, height);
    const horizon = height * 0.42;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon); sky.addColorStop(0, '#f4dfc7'); sky.addColorStop(1, '#dce8da'); ctx.fillStyle = sky; ctx.fillRect(0, 0, width, horizon);
    const ground = ctx.createLinearGradient(0, horizon, 0, height); ground.addColorStop(0, '#a5ad64'); ground.addColorStop(1, '#718d4c'); ctx.fillStyle = ground; ctx.fillRect(0, horizon, width, height - horizon);
    ctx.fillStyle = '#454348'; ctx.beginPath(); ctx.moveTo(width * 0.44, horizon); ctx.bezierCurveTo(width * 0.66, height * 0.52, width * 0.28, height * 0.72, width * 0.2, height); ctx.lineTo(width * 0.8, height); ctx.bezierCurveTo(width * 0.58, height * 0.72, width * 0.78, height * 0.52, width * 0.56, horizon); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#f2efe5'; ctx.lineWidth = 5; ctx.setLineDash([30, 28]); ctx.beginPath(); ctx.moveTo(width * 0.5, horizon); ctx.bezierCurveTo(width * 0.65, height * 0.55, width * 0.45, height * 0.73, width * 0.5, height); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < 18; i++) { const x = (i * 137) % width; const y = horizon + ((i * 73) % (height - horizon)); ctx.fillStyle = '#536d3f'; ctx.beginPath(); ctx.moveTo(x, y - 24); ctx.lineTo(x - 12, y + 12); ctx.lineTo(x + 12, y + 12); ctx.fill(); }
    const carX = width / 2; const carY = height * 0.72; ctx.save(); ctx.translate(carX, carY); ctx.rotate(heading * 0.18); ctx.fillStyle = '#111'; ctx.fillRect(-68, -54, 18, 44); ctx.fillRect(50, -54, 18, 44); ctx.fillRect(-68, 24, 18, 44); ctx.fillRect(50, 24, 18, 44); ctx.fillStyle = '#eee0d7'; ctx.fillRect(-50, -75, 100, 150); ctx.fillStyle = '#2d2f37'; ctx.fillRect(-34, -42, 68, 40); ctx.fillStyle = '#171717'; ctx.fillRect(-48, 50, 96, 20); ctx.restore();
    const speedEl = document.querySelector('#speed'); if (speedEl) speedEl.textContent = `${Math.round(Math.abs(speed) * 2.23694)} mph`;
    requestAnimationFrame(draw);
  }
  window.addEventListener('resize', resize); window.addEventListener('keydown', (e) => setKey(e.code, true)); window.addEventListener('keyup', (e) => setKey(e.code, false)); resize(); requestAnimationFrame(draw);
}
