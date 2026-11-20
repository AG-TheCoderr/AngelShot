import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import './style.css';

await RAPIER.init({});

const FIXED_DT = 1 / 60;
const GRAVITY = 9.81;
const MUZZLE_VELOCITY = 850;
const BULLET_RADIUS = 0.0043;
const BULLET_MASS = 0.016;
const BULLET_AREA = Math.PI * BULLET_RADIUS ** 2;
const AIR_DENSITY = 1.225;
const DRAG_COEFFICIENT = 0.22;
const WIND = { x: 1.2, y: 0, z: 0 };
const ZERO_RANGES = [100, 200, 300];
const SCOPE_MAGNIFICATIONS = [4, 8, 12];
const WIND_PRESETS = [
  { label: 'CALM', speed: 0 },
  { label: 'CROSS', speed: 1.2 },
  { label: 'GUST', speed: 2.4 },
];
let zeroRange = 100;
let scopeMagnification = 8;
let windPresetIndex = 1;
const SIGHT_TO_MUZZLE_DROP = 0.07;
const MAGAZINE_CAPACITY = 5;
const MAX_BREATH = 4;
const isTouchDevice = navigator.maxTouchPoints > 0 || 'ontouchstart' in window || matchMedia('(pointer: coarse)').matches || innerWidth <= 760;

function simulateBulletHeightAtRange(angle, range) {
  const dt = 0.002;
  let z = 0;
  let y = 0;
  let vx = 0;
  let vy = Math.sin(angle) * MUZZLE_VELOCITY;
  let vz = -Math.cos(angle) * MUZZLE_VELOCITY;
  for (let time = 0; -z < range && time < 1; time += dt) {
    const rx = vx - WIND.x;
    const ry = vy - WIND.y;
    const rz = vz - WIND.z;
    const relativeSpeed = Math.hypot(rx, ry, rz);
    const dragScale = -0.5 * AIR_DENSITY * DRAG_COEFFICIENT * BULLET_AREA * relativeSpeed / BULLET_MASS;
    vx += rx * dragScale * dt;
    vy += (-GRAVITY + ry * dragScale) * dt;
    vz += rz * dragScale * dt;
    z += vz * dt;
    y += vy * dt;
  }
  return y;
}

function calculateZeroAngle(range) {
  let low = 0;
  let high = 0.08;
  for (let i = 0; i < 18; i++) {
    const middle = (low + high) / 2;
    if (simulateBulletHeightAtRange(middle, range) > SIGHT_TO_MUZZLE_DROP) high = middle;
    else low = middle;
  }
  return (low + high) / 2;
}

let zeroAngle = calculateZeroAngle(zeroRange);

const ui = {
  center: document.querySelector('#centerMessage'),
  start: document.querySelector('#startButton'),
  crosshair: document.querySelector('#crosshair'),
  scope: document.querySelector('#scopeView'),
  score: document.querySelector('#score'),
  speed: document.querySelector('#speed'),
  status: document.querySelector('#status'),
  hit: document.querySelector('#hitFlash'),
  ragdoll: document.querySelector('#ragdollToast'),
  touchControls: document.querySelector('#touchControls'),
  movePad: document.querySelector('#movePad'),
  moveStick: document.querySelector('#moveStick'),
  wingsButton: document.querySelector('#wingsButton'),
  scopeButton: document.querySelector('#scopeButton'),
  scopeButtonValue: document.querySelector('#scopeButtonValue'),
  fireButton: document.querySelector('#fireButton'),
  ragdollButton: document.querySelector('#ragdollButton'),
  reloadButton: document.querySelector('#reloadButton'),
  steadyButton: document.querySelector('#steadyButton'),
  ammoCount: document.querySelector('#ammoCount'),
  breathMeter: document.querySelector('#breathMeter'),
  breathFill: document.querySelector('#breathFill'),
  scopeWind: document.querySelector('#scopeWind'),
  scopeMagnificationLabel: document.querySelector('#scopeMagnificationLabel'),
  scopeZeroLabel: document.querySelector('#scopeZeroLabel'),
  cornerWind: document.querySelector('#cornerWind'),
  cornerZero: document.querySelector('#cornerZero'),
  zeroSetting: document.querySelector('#zeroSetting'),
  zeroValue: document.querySelector('#zeroValue'),
  magnificationSetting: document.querySelector('#magnificationSetting'),
  magnificationValue: document.querySelector('#magnificationValue'),
  windSetting: document.querySelector('#windSetting'),
  windValue: document.querySelector('#windValue'),
  startHint: document.querySelector('#startHint'),
};

let zeroSettingIndex = ZERO_RANGES.indexOf(zeroRange);
let magnificationIndex = SCOPE_MAGNIFICATIONS.indexOf(scopeMagnification);
function updateSetupLabels() {
  const wind = WIND_PRESETS[windPresetIndex];
  WIND.x = wind.speed;
  ui.zeroValue.textContent = `${zeroRange} M`;
  ui.magnificationValue.textContent = `${scopeMagnification}×`;
  ui.windValue.textContent = wind.speed === 0 ? 'CALM' : `${wind.speed.toFixed(1)} →`;
  ui.scopeWind.textContent = wind.speed === 0 ? 'WIND CALM' : `WIND ${wind.speed.toFixed(1)} M/S →`;
  ui.scopeMagnificationLabel.textContent = `${scopeMagnification}×`;
  ui.scopeZeroLabel.textContent = `${zeroRange}M`;
  ui.scopeButtonValue.textContent = `${scopeMagnification}×`;
  ui.cornerWind.textContent = wind.speed === 0 ? 'CALM' : `${wind.speed.toFixed(1)} M/S →`;
  ui.cornerZero.textContent = `${zeroRange} M`;
}
ui.zeroSetting.addEventListener('click', () => {
  if (gameStarted) return;
  zeroSettingIndex = (zeroSettingIndex + 1) % ZERO_RANGES.length;
  zeroRange = ZERO_RANGES[zeroSettingIndex];
  zeroAngle = calculateZeroAngle(zeroRange);
  updateSetupLabels();
});
ui.magnificationSetting.addEventListener('click', () => {
  if (gameStarted) return;
  magnificationIndex = (magnificationIndex + 1) % SCOPE_MAGNIFICATIONS.length;
  scopeMagnification = SCOPE_MAGNIFICATIONS[magnificationIndex];
  updateSetupLabels();
});
ui.windSetting.addEventListener('click', () => {
  if (gameStarted) return;
  windPresetIndex = (windPresetIndex + 1) % WIND_PRESETS.length;
  updateSetupLabels();
  zeroAngle = calculateZeroAngle(zeroRange);
});
updateSetupLabels();
if (isTouchDevice) {
  document.body.classList.add('touch-device');
  ui.startHint.textContent = 'TAP OPTIONS TO SET UP · JOYSTICK LEFT · AIM RIGHT';
}

const scene = new THREE.Scene();
scene.background = new THREE.Color('#a6b7b0');
scene.fog = new THREE.Fog('#a6b7b0', 115, 280);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.06, 700);
camera.rotation.order = 'YXZ';
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: !isTouchDevice, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouchDevice ? 1.25 : 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.querySelector('#game').appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight('#e6f0e8', '#626b5c', 2.05));
const sun = new THREE.DirectionalLight('#fff1d4', 3.1);
sun.position.set(-28, 42, 16);
sun.castShadow = true;
sun.shadow.mapSize.set(isTouchDevice ? 1024 : 2048, isTouchDevice ? 1024 : 2048);
sun.shadow.camera.left = -65;
sun.shadow.camera.right = 65;
sun.shadow.camera.top = 65;
sun.shadow.camera.bottom = -65;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 130;
sun.shadow.bias = -0.00015;
scene.add(sun);

const mat = (color, roughness = 0.84, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const groundMaterial = mat('#626e5b');
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(240, 120, '#87917a', '#77836f');
grid.position.y = 0.012;
grid.material.transparent = true;
grid.material.opacity = 0.25;
scene.add(grid);

const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
world.timestep = FIXED_DT;
const eventQueue = new RAPIER.EventQueue(true);
const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.12, -70));
world.createCollider(RAPIER.ColliderDesc.cuboid(200, 0.12, 200).setFriction(0.9), groundBody);

const targetByCollider = new Map();
const projectileByCollider = new Map();
const bullets = [];
const targets = [];
const ragdollBodies = [];
let score = 0;
let playerBody;
let playerCollider;
let ragdollActive = false;
let locked = false;
let gameStarted = false;
let yaw = 0;
let pitch = 0;
let recoil = 0;
let scopeHeld = false;
let spaceHeld = false;
let steadyHeld = false;
let breathRemaining = MAX_BREATH;
let swayClock = 0;
let aimSwayYaw = 0;
let aimSwayPitch = 0;
let roundsInMagazine = MAGAZINE_CAPACITY;
let reserveRounds = 25;
let boltCycle = 0;
let reloadRemaining = 0;
let statusTimer = 0;
let flapCooldown = 0;
let accumulator = 0;
let lastTime = performance.now();
let hitFlashTimer = 0;
let muzzleTimer = 0;
let targetHitTimer = 0;

const keys = new Set();
const vec3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function addBox(parent, size, position, material, castShadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.material = material;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function createTarget(x, z, label) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, 1.46, z));
  const collider = world.createCollider(RAPIER.ColliderDesc.cuboid(0.56, 0.73, 0.11).setFriction(0.6), body);
  const stand = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, 0.73, z - 0.1));
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.08, 0.72, 0.08), stand);

  const group = new THREE.Group();
  group.position.set(x, 1.46, z);
  scene.add(group);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(1.12, 1.46, 0.18), mat('#d5d0bb', 0.65, 0.12));
  plate.castShadow = true;
  plate.receiveShadow = true;
  group.add(plate);
  const plateBack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.53, 0.055), mat('#26342f', 0.8, 0.2));
  plateBack.position.z = -0.105;
  group.add(plateBack);
  const ringMaterials = ['#24352f', '#c07b4c', '#d5d0bb', '#c07b4c'];
  const radii = [0.39, 0.28, 0.17, 0.072];
  radii.forEach((radius, index) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, index === 3 ? 0.026 : 0.017, 7, 40), mat(ringMaterials[index], 0.65, 0.12));
    ring.position.z = 0.102 + index * 0.002;
    group.add(ring);
  });
  const center = new THREE.Mesh(new THREE.CircleGeometry(0.038, 24), mat('#283a34', 0.75, 0.08));
  center.position.z = 0.132;
  group.add(center);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.82, 0.13), mat('#35413a', 0.78, 0.16));
  post.position.set(0, -1.05, -0.03);
  group.add(post);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.08, 0.4), mat('#303a34', 0.8, 0.12));
  foot.position.set(0, -1.47, 0.02);
  group.add(foot);
  group.traverse((object) => { if (object.isMesh) object.castShadow = true; });
  const target = { group, body, collider, label, z, hits: 0, original: plate.material, flash: 0 };
  targets.push(target);
  targetByCollider.set(collider.handle, target);
}

createTarget(0, -36, '035');
createTarget(-5, -62, '062');
createTarget(7, -96, '096');

// Small range markers make the otherwise flat firing lane legible without adding terrain.
const markerMaterial = mat('#c3b998', 0.8, 0.04);
for (let distance = 20; distance <= 100; distance += 20) {
  const marker = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.026, 0.08), markerMaterial);
  marker.position.set(0, 0.014, -distance);
  marker.receiveShadow = true;
  scene.add(marker);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.36, 0.07), markerMaterial);
    post.position.set(side * 1.65, 0.18, -distance);
    post.castShadow = true;
    scene.add(post);
  }
}

const avatar = new THREE.Group();
scene.add(avatar);
const gearMat = mat('#303b37', 0.64, 0.3);
const clothMat = mat('#596453', 0.94, 0.02);
const darkMat = mat('#1c2624', 0.56, 0.28);
const wingMat = mat('#d4cbb2', 0.86, 0.02);
const strapMat = mat('#a36b45', 0.77, 0.05);

function makeFeather(parent, x, y, angle, length, width, material = wingMat) {
  const feather = new THREE.Mesh(new THREE.CapsuleGeometry(width * 0.31, length, 3, 5), material);
  feather.position.set(x, y, 0);
  feather.rotation.z = angle;
  feather.castShadow = true;
  feather.receiveShadow = true;
  parent.add(feather);
  return feather;
}

// The first-person body stays visible below the eye line; wings are a real part of the avatar, not a HUD icon.
addBox(avatar, [0.53, 0.7, 0.3], [0, 0.02, 0.015], clothMat);
const chest = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.34), gearMat);
chest.position.set(0, 0.18, -0.015);
chest.castShadow = true;
avatar.add(chest);
addBox(avatar, [0.12, 0.66, 0.15], [-0.39, -0.03, -0.02], clothMat);
addBox(avatar, [0.12, 0.66, 0.15], [0.39, -0.03, -0.02], clothMat);
addBox(avatar, [0.21, 0.58, 0.22], [-0.16, -0.56, 0.025], darkMat);
addBox(avatar, [0.21, 0.58, 0.22], [0.16, -0.56, 0.025], darkMat);
const hiddenHead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), clothMat);
hiddenHead.position.set(0, 0.69, 0.005);
hiddenHead.visible = false;
avatar.add(hiddenHead);
for (const side of [-1, 1]) {
  const boot = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.16, 0.38), darkMat);
  boot.position.set(side * 0.16, -0.89, -0.035);
  boot.castShadow = true;
  avatar.add(boot);
}
const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.52, 0.17), gearMat);
pack.position.set(0, 0.14, 0.22);
pack.castShadow = true;
avatar.add(pack);
for (const side of [-1, 1]) {
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.73, 0.09), strapMat);
  strap.position.set(side * 0.18, 0.05, -0.13);
  strap.rotation.z = side * -0.14;
  avatar.add(strap);
}
const wingRoot = new THREE.Group();
wingRoot.position.set(0, 0.28, 0.21);
avatar.add(wingRoot);
const wingPivots = [];
for (const side of [-1, 1]) {
  const pivot = new THREE.Group();
  pivot.position.x = side * 0.14;
  wingRoot.add(pivot);
  wingPivots.push({ pivot, side });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.28, 0.045), gearMat);
  panel.position.set(side * 0.05, 0.16, 0);
  panel.rotation.z = -side * 0.17;
  pivot.add(panel);
  for (let i = 0; i < 6; i++) {
    const spread = i / 5;
    const feather = new THREE.Mesh(new THREE.CapsuleGeometry(0.034, 0.47 - spread * 0.12, 3, 5), wingMat);
    feather.position.set(side * (0.13 + spread * 0.19), 0.23 + spread * 0.06, 0.012 + i * 0.003);
    feather.rotation.z = -side * (0.66 + spread * 0.14);
    feather.castShadow = true;
    pivot.add(feather);
  }
}
// Camera sits at a human eye height above the physical capsule's center.
const eyeOffset = 0.64;
const weapon = new THREE.Group();
camera.add(weapon);
weapon.position.set(0.34, -0.29, -0.72);
const gunBodyMat = mat('#26312f', 0.42, 0.62);
const gunEdgeMat = mat('#68756b', 0.38, 0.66);
const rubberMat = mat('#171d1b', 0.82, 0.08);
addBox(weapon, [0.19, 0.17, 0.68], [0, 0, 0], gunBodyMat);
addBox(weapon, [0.14, 0.19, 0.34], [-0.025, -0.065, 0.39], rubberMat);
addBox(weapon, [0.085, 0.2, 0.19], [0.01, -0.17, -0.04], gunBodyMat);
const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.045, 0.78, 12), gunEdgeMat);
barrel.rotation.x = Math.PI / 2;
barrel.position.set(0, 0.005, -0.67);
weapon.add(barrel);
const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.08, 12), rubberMat);
muzzle.rotation.x = Math.PI / 2;
muzzle.position.set(0, 0.005, -1.06);
weapon.add(muzzle);
const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.33, 20), gunEdgeMat);
scope.rotation.x = Math.PI / 2;
scope.position.set(0, 0.12, -0.05);
weapon.add(scope);
const scopeGlass = new THREE.Mesh(new THREE.CircleGeometry(0.07, 24), new THREE.MeshStandardMaterial({ color: '#8da8a2', roughness: 0.2, metalness: 0.2, transparent: true, opacity: 0.76 }));
scopeGlass.position.set(0, 0.12, -0.22);
weapon.add(scopeGlass);
const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 8), gunEdgeMat);
bolt.rotation.z = Math.PI / 2;
bolt.position.set(0.13, 0.025, 0.12);
weapon.add(bolt);
const flashLight = new THREE.PointLight('#ffb965', 0, 4, 2);
flashLight.position.set(0, 0.005, -1.1);
weapon.add(flashLight);

function createPlayer() {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 0.92, 0)
      .setLinearDamping(0.28)
      .setAngularDamping(8)
      .lockRotations()
      .setCcdEnabled(true),
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.55, 0.37).setFriction(0.05).setRestitution(0).setDensity(70),
    body,
  );
  return { body, collider };
}
({ body: playerBody, collider: playerCollider } = createPlayer());

function bodyPosition(body) {
  const p = body.translation();
  return vec3(p.x, p.y, p.z);
}

function playerOnGround() {
  if (!playerBody || ragdollActive) return false;
  const p = playerBody.translation();
  const ray = new RAPIER.Ray({ x: p.x, y: p.y - 0.72, z: p.z }, { x: 0, y: -1, z: 0 });
  return Boolean(world.castRay(ray, 0.39, true, undefined, undefined, undefined, playerBody));
}

function createProjectile(origin, direction) {
  const velocity = direction.clone().multiplyScalar(MUZZLE_VELOCITY);
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(origin.x, origin.y, origin.z)
      .setLinvel(velocity.x, velocity.y, velocity.z)
      .setGravityScale(1)
      .setLinearDamping(0)
      .setCcdEnabled(true),
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.ball(BULLET_RADIUS)
      .setDensity(BULLET_MASS / ((4 / 3) * Math.PI * BULLET_RADIUS ** 3))
      .setFriction(0.18)
      .setRestitution(0.04)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    body,
  );
  const bulletMesh = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), mat('#d7b078', 0.32, 0.72));
  bulletMesh.castShadow = false;
  scene.add(bulletMesh);
  const trailGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const trail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ color: '#f0bc7c', transparent: true, opacity: 0.72 }));
  scene.add(trail);
  const bullet = { body, collider, mesh: bulletMesh, trail, trailGeometry, age: 0, ended: false };
  bullets.push(bullet);
  projectileByCollider.set(collider.handle, bullet);
  return bullet;
}

function updateAmmoHud() {
  ui.ammoCount.textContent = `${String(roundsInMagazine).padStart(2, '0')} / ${String(reserveRounds).padStart(2, '0')}`;
  ui.reloadButton.disabled = reloadRemaining > 0 || reserveRounds <= 0 || roundsInMagazine >= MAGAZINE_CAPACITY;
}
updateAmmoHud();

function reloadRifle() {
  if (!gameStarted || ragdollActive || reloadRemaining > 0) return;
  if (reserveRounds <= 0 || roundsInMagazine >= MAGAZINE_CAPACITY) {
    ui.status.textContent = reserveRounds <= 0 ? 'NO RESERVE AMMUNITION' : 'MAGAZINE FULL';
    statusTimer = 1.1;
    return;
  }
  reloadRemaining = 2.35;
  boltCycle = 0;
  steadyHeld = false;
  ui.steadyButton.classList.remove('pressed');
  ui.status.textContent = 'RELOADING';
  ui.reloadButton.classList.add('pressed');
  updateAmmoHud();
}

function applyProjectileForces() {
  for (const bullet of bullets) {
    if (bullet.ended) continue;
    bullet.body.resetForces(false);
    const velocity = bullet.body.linvel();
    const relative = { x: velocity.x - WIND.x, y: velocity.y - WIND.y, z: velocity.z - WIND.z };
    const speed = Math.hypot(relative.x, relative.y, relative.z);
    const dragScale = -0.5 * AIR_DENSITY * DRAG_COEFFICIENT * BULLET_AREA * speed;
    bullet.body.addForce({ x: relative.x * dragScale, y: relative.y * dragScale, z: relative.z * dragScale }, true);
  }
}

function fire() {
  if ((!locked && !isTouchDevice) || !gameStarted || ragdollActive || reloadRemaining > 0 || boltCycle > 0) return;
  if (roundsInMagazine <= 0) {
    ui.status.textContent = reserveRounds > 0 ? 'EMPTY · PRESS R TO RELOAD' : 'OUT OF AMMUNITION';
    statusTimer = 1.4;
    return;
  }
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  const shotYaw = Math.atan2(-direction.x, -direction.z);
  const shotPitch = Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1)) + zeroAngle;
  direction.set(-Math.sin(shotYaw) * Math.cos(shotPitch), Math.sin(shotPitch), -Math.cos(shotYaw) * Math.cos(shotPitch)).normalize();
  const origin = camera.position.clone().addScaledVector(direction, 1.05);
  origin.y -= SIGHT_TO_MUZZLE_DROP;
  createProjectile(origin, direction);
  roundsInMagazine -= 1;
  updateAmmoHud();
  boltCycle = 0.72;
  statusTimer = 0;
  steadyHeld = false;
  ui.steadyButton.classList.remove('pressed');
  recoil = Math.min(recoil + (scopeHeld ? 0.035 : 0.022), 0.11);
  weapon.position.z = -0.66;
  muzzleTimer = 0.055;
  flashLight.intensity = 8;
  ui.status.textContent = roundsInMagazine > 0 ? 'BOLT CYCLING' : 'EMPTY · RELOAD';
}

function hitTarget(target) {
  target.hits += 1;
  target.flash = 0.5;
  score += 1;
  ui.score.textContent = String(score).padStart(2, '0');
  ui.hit.classList.add('show');
  hitFlashTimer = 0.58;
  ui.status.textContent = `HIT CONFIRMED · ${Math.round(Math.abs(target.z))} M`;
  statusTimer = 1.1;
}

function resolveCollision(handle1, handle2, started) {
  if (!started) return;
  let bullet = projectileByCollider.get(handle1);
  let otherHandle = handle2;
  if (!bullet) {
    bullet = projectileByCollider.get(handle2);
    otherHandle = handle1;
  }
  if (!bullet || bullet.ended) return;
  bullet.ended = true;
  const target = targetByCollider.get(otherHandle);
  if (target) hitTarget(target);
}

function removeBullet(bullet) {
  projectileByCollider.delete(bullet.collider.handle);
  world.removeRigidBody(bullet.body);
  scene.remove(bullet.mesh);
  scene.remove(bullet.trail);
  bullet.mesh.geometry.dispose();
  bullet.mesh.material.dispose();
  bullet.trail.geometry.dispose();
  bullet.trail.material.dispose();
}

function localToWorldOffset(local, root, rotation) {
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  return vec3(root.x + local.x * c + local.z * s, root.y + local.y, root.z - local.x * s + local.z * c);
}

function createRagdoll() {
  if (ragdollActive) return;
  ragdollActive = true;
  avatar.visible = false;
  weapon.visible = false;
  scopeHeld = false;
  steadyHeld = false;
  ui.steadyButton.classList.remove('pressed', 'steady-active');
  ui.scope.classList.remove('active');
  ui.scopeButton.classList.remove('pressed');
  ui.crosshair.classList.remove('hidden');
  ui.status.textContent = 'RAGDOLL TEST';
  ui.ragdoll.classList.add('show');
  ui.ragdollButton.textContent = 'RESET';
  const root = bodyPosition(playerBody);
  const oldYaw = yaw;
  world.removeRigidBody(playerBody);
  playerBody = null;
  playerCollider = null;

  const specs = [
    { name: 'torso', pos: [0, 0.01, 0], size: [0.27, 0.38, 0.17], mass: 8 },
    { name: 'head', pos: [0, 0.57, 0], size: [0.15, 0.17, 0.15], mass: 3 },
    { name: 'upperL', pos: [-0.34, 0.18, 0], size: [0.13, 0.24, 0.13], mass: 2.2 },
    { name: 'upperR', pos: [0.34, 0.18, 0], size: [0.13, 0.24, 0.13], mass: 2.2 },
    { name: 'lowerL', pos: [-0.58, -0.08, 0], size: [0.11, 0.22, 0.11], mass: 1.6 },
    { name: 'lowerR', pos: [0.58, -0.08, 0], size: [0.11, 0.22, 0.11], mass: 1.6 },
    { name: 'thighL', pos: [-0.15, -0.48, 0], size: [0.145, 0.28, 0.15], mass: 4.5 },
    { name: 'thighR', pos: [0.15, -0.48, 0], size: [0.145, 0.28, 0.15], mass: 4.5 },
    { name: 'shinL', pos: [-0.15, -0.91, 0], size: [0.12, 0.26, 0.13], mass: 3.2 },
    { name: 'shinR', pos: [0.15, -0.91, 0], size: [0.12, 0.26, 0.13], mass: 3.2 },
  ];
  const parts = new Map();
  const colors = { torso: clothMat, head: gearMat, upperL: clothMat, upperR: clothMat, lowerL: clothMat, lowerR: clothMat, thighL: darkMat, thighR: darkMat, shinL: darkMat, shinR: darkMat };
  for (const spec of specs) {
    const p = localToWorldOffset(vec3(...spec.pos), root, oldYaw);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(p.x, p.y, p.z)
        .setRotation({ x: 0, y: Math.sin(oldYaw / 2), z: 0, w: Math.cos(oldYaw / 2) })
        .setLinearDamping(0.16)
        .setAngularDamping(0.75)
        .setCcdEnabled(true),
    );
    const collider = world.createCollider(RAPIER.ColliderDesc.cuboid(...spec.size).setDensity(spec.mass / (8 * spec.size[0] * spec.size[1] * spec.size[2])).setFriction(0.72), body);
    const visual = new THREE.Mesh(new THREE.BoxGeometry(spec.size[0] * 2, spec.size[1] * 2, spec.size[2] * 2), colors[spec.name]);
    visual.castShadow = true;
    visual.receiveShadow = true;
    scene.add(visual);
    const part = { body, collider, visual, spec };
    parts.set(spec.name, part);
    ragdollBodies.push(part);
  }
  const joint = (a, b, anchorA, anchorB) => {
    world.createImpulseJoint(RAPIER.JointData.spherical(anchorA, anchorB), parts.get(a).body, parts.get(b).body, true);
  };
  joint('torso', 'head', { x: 0, y: 0.39, z: 0 }, { x: 0, y: -0.17, z: 0 });
  joint('torso', 'upperL', { x: -0.24, y: 0.27, z: 0 }, { x: 0.1, y: 0.19, z: 0 });
  joint('torso', 'upperR', { x: 0.24, y: 0.27, z: 0 }, { x: -0.1, y: 0.19, z: 0 });
  joint('upperL', 'lowerL', { x: -0.11, y: -0.19, z: 0 }, { x: 0.1, y: 0.18, z: 0 });
  joint('upperR', 'lowerR', { x: 0.11, y: -0.19, z: 0 }, { x: -0.1, y: 0.18, z: 0 });
  joint('torso', 'thighL', { x: -0.14, y: -0.33, z: 0 }, { x: 0, y: 0.24, z: 0 });
  joint('torso', 'thighR', { x: 0.14, y: -0.33, z: 0 }, { x: 0, y: 0.24, z: 0 });
  joint('thighL', 'shinL', { x: 0, y: -0.24, z: 0 }, { x: 0, y: 0.23, z: 0 });
  joint('thighR', 'shinR', { x: 0, y: -0.24, z: 0 }, { x: 0, y: 0.23, z: 0 });
  for (const part of ragdollBodies) {
    const impulse = { x: (Math.random() - 0.5) * 1.4, y: Math.random() * 0.65, z: (Math.random() - 0.5) * 1.4 };
    part.body.applyImpulse(impulse, true);
  }
}

function clearRagdollAndReset() {
  for (const part of ragdollBodies) {
    world.removeRigidBody(part.body);
    scene.remove(part.visual);
    part.visual.geometry.dispose();
  }
  ragdollBodies.length = 0;
  ragdollActive = false;
  avatar.visible = true;
  weapon.visible = true;
  ui.ragdoll.classList.remove('show');
  ui.ragdollButton.textContent = 'TEST';
  ui.status.textContent = 'RANGE READY';
  ({ body: playerBody, collider: playerCollider } = createPlayer());
  yaw = 0;
  pitch = 0;
  recoil = 0;
}

function requestPointerLock() {
  renderer.domElement.requestPointerLock?.();
}

function setScopeHeld(held) {
  if (ragdollActive || !gameStarted) return;
  scopeHeld = held;
  ui.scope.classList.toggle('active', held);
  ui.crosshair.classList.toggle('hidden', held);
  ui.scopeButton.classList.toggle('pressed', held);
}

function setSteadyHeld(held) {
  steadyHeld = held;
  ui.steadyButton.classList.toggle('pressed', held);
}

function pressWings() {
  if (!gameStarted || ragdollActive || spaceHeld) return;
  spaceHeld = true;
  if (playerOnGround()) {
    const velocity = playerBody.linvel();
    playerBody.setLinvel({ x: velocity.x, y: Math.max(velocity.y, 6.2), z: velocity.z }, true);
    flapCooldown = 0.28;
  } else if (flapCooldown <= 0) {
    const velocity = playerBody.linvel();
    playerBody.setLinvel({ x: velocity.x, y: Math.max(velocity.y, 5.3), z: velocity.z }, true);
    flapCooldown = 0.85;
  }
}

function releaseWings() {
  spaceHeld = false;
}

function applyLookDelta(deltaX, deltaY) {
  if (ragdollActive) return;
  const sensitivity = scopeHeld ? 0.00075 : 0.00155;
  yaw -= deltaX * sensitivity;
  pitch = THREE.MathUtils.clamp(pitch - deltaY * sensitivity, -1.35, 1.35);
}

ui.start.addEventListener('click', () => {
  gameStarted = true;
  if (isTouchDevice) {
    ui.touchControls.classList.add('active');
    ui.center.classList.add('hidden');
  } else {
    requestPointerLock();
  }
});
renderer.domElement.addEventListener('click', () => {
  if (gameStarted && !locked && !isTouchDevice) requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  ui.center.classList.toggle('hidden', locked);
});
document.addEventListener('mousemove', (event) => {
  if (!locked || ragdollActive) return;
  applyLookDelta(event.movementX, event.movementY);
});

let lookPointerId = null;
let lookLastX = 0;
let lookLastY = 0;
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (!isTouchDevice || event.pointerType !== 'touch' || !gameStarted || ragdollActive || event.clientX < innerWidth * 0.32) return;
  event.preventDefault();
  lookPointerId = event.pointerId;
  lookLastX = event.clientX;
  lookLastY = event.clientY;
  renderer.domElement.setPointerCapture(event.pointerId);
});
renderer.domElement.addEventListener('pointermove', (event) => {
  if (event.pointerId !== lookPointerId) return;
  event.preventDefault();
  const deltaX = event.clientX - lookLastX;
  const deltaY = event.clientY - lookLastY;
  lookLastX = event.clientX;
  lookLastY = event.clientY;
  const touchSensitivity = scopeHeld ? 0.0021 : 0.004;
  yaw -= deltaX * touchSensitivity;
  pitch = THREE.MathUtils.clamp(pitch - deltaY * touchSensitivity, -1.35, 1.35);
});
const endLook = (event) => {
  if (event.pointerId === lookPointerId) lookPointerId = null;
};
renderer.domElement.addEventListener('pointerup', endLook);
renderer.domElement.addEventListener('pointercancel', endLook);

document.addEventListener('mousedown', (event) => {
  if (isTouchDevice) return;
  if (event.button === 0) fire();
  if (event.button === 2 && locked && !ragdollActive) setScopeHeld(true);
});
document.addEventListener('mouseup', (event) => {
  if (isTouchDevice) return;
  if (event.button === 2) setScopeHeld(false);
});
document.addEventListener('contextmenu', (event) => event.preventDefault());

let movePointerId = null;
let moveInputX = 0;
let moveInputY = 0;
function updateMoveStick(event) {
  const rect = ui.movePad.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const radius = rect.width * 0.34;
  let dx = event.clientX - centerX;
  let dy = event.clientY - centerY;
  const length = Math.hypot(dx, dy);
  if (length > radius) {
    dx = dx / length * radius;
    dy = dy / length * radius;
  }
  moveInputX = dx / radius;
  moveInputY = -dy / radius;
  ui.moveStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}
function resetMoveStick() {
  movePointerId = null;
  moveInputX = 0;
  moveInputY = 0;
  ui.moveStick.style.transform = 'translate(-50%, -50%)';
}
ui.movePad.addEventListener('pointerdown', (event) => {
  if (!isTouchDevice || !gameStarted || ragdollActive || movePointerId !== null) return;
  event.preventDefault();
  movePointerId = event.pointerId;
  ui.movePad.setPointerCapture(event.pointerId);
  updateMoveStick(event);
});
ui.movePad.addEventListener('pointermove', (event) => {
  if (event.pointerId === movePointerId) {
    event.preventDefault();
    updateMoveStick(event);
  }
});
ui.movePad.addEventListener('pointerup', (event) => {
  if (event.pointerId === movePointerId) resetMoveStick();
});
ui.movePad.addEventListener('pointercancel', (event) => {
  if (event.pointerId === movePointerId) resetMoveStick();
});

function bindHoldButton(element, onPress, onRelease) {
  let activePointer = null;
  element.addEventListener('pointerdown', (event) => {
    if (!isTouchDevice || !gameStarted || ragdollActive || activePointer !== null) return;
    event.preventDefault();
    event.stopPropagation();
    activePointer = event.pointerId;
    element.setPointerCapture(event.pointerId);
    element.classList.add('pressed');
    onPress();
  });
  const end = (event) => {
    if (event.pointerId !== activePointer) return;
    activePointer = null;
    element.classList.remove('pressed');
    onRelease();
  };
  element.addEventListener('pointerup', end);
  element.addEventListener('pointercancel', end);
  element.addEventListener('lostpointercapture', end);
}

bindHoldButton(ui.wingsButton, pressWings, releaseWings);
bindHoldButton(ui.scopeButton, () => setScopeHeld(true), () => setScopeHeld(false));
ui.steadyButton.addEventListener('pointerdown', (event) => {
  if (!isTouchDevice || !gameStarted || ragdollActive) return;
  event.preventDefault();
  event.stopPropagation();
  setSteadyHeld(!steadyHeld);
});
ui.reloadButton.addEventListener('pointerdown', (event) => {
  if (!isTouchDevice || !gameStarted || ragdollActive) return;
  event.preventDefault();
  event.stopPropagation();
  reloadRifle();
});
ui.ragdollButton.addEventListener('pointerdown', (event) => {
  if (!isTouchDevice || !gameStarted) return;
  event.preventDefault();
  event.stopPropagation();
  if (ragdollActive) clearRagdollAndReset();
  else createRagdoll();
});
let firePointerId = null;
ui.fireButton.addEventListener('pointerdown', (event) => {
  if (!isTouchDevice || !gameStarted || ragdollActive || firePointerId !== null) return;
  event.preventDefault();
  event.stopPropagation();
  firePointerId = event.pointerId;
  ui.fireButton.setPointerCapture(event.pointerId);
  ui.fireButton.classList.add('pressed');
  fire();
});
const releaseFire = (event) => {
  if (event.pointerId !== firePointerId) return;
  firePointerId = null;
  ui.fireButton.classList.remove('pressed');
};
ui.fireButton.addEventListener('pointerup', releaseFire);
ui.fireButton.addEventListener('pointercancel', releaseFire);
ui.fireButton.addEventListener('lostpointercapture', releaseFire);

document.addEventListener('keydown', (event) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.code === 'Space' && !spaceHeld && gameStarted && (locked || isTouchDevice) && !ragdollActive) pressWings();
  if ((event.code === 'ShiftLeft' || event.code === 'ShiftRight') && gameStarted && (locked || isTouchDevice) && !ragdollActive) setSteadyHeld(true);
  if (event.code === 'KeyR' && (locked || isTouchDevice) && gameStarted && !ragdollActive) reloadRifle();
  if (event.code === 'KeyK' && (locked || isTouchDevice) && gameStarted && !ragdollActive) createRagdoll();
  if (event.code === 'KeyT' && ragdollActive) clearRagdollAndReset();
});
document.addEventListener('keyup', (event) => {
  keys.delete(event.code);
  if (event.code === 'Space') releaseWings();
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') setSteadyHeld(false);
});
window.addEventListener('blur', () => {
  keys.clear();
  releaseWings();
  setSteadyHeld(false);
  resetMoveStick();
  if (gameStarted && !ragdollActive) setScopeHeld(false);
});

function updatePlayer(dt) {
  if (!playerBody || ragdollActive) return;
  const grounded = playerOnGround();
  const gliding = !grounded && spaceHeld;
  playerBody.setGravityScale(gliding ? 0.22 : 1, true);
  flapCooldown = Math.max(0, flapCooldown - dt);

  const forwardInput = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')) + moveInputY;
  const sideInput = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + moveInputX;
  const inputLength = Math.hypot(forwardInput, sideInput) || 1;
  const forwardX = -Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  const speed = gliding ? 10 : 6.2;
  const desiredX = ((forwardX * forwardInput + rightX * sideInput) / inputLength) * speed;
  const desiredZ = ((forwardZ * forwardInput + rightZ * sideInput) / inputLength) * speed;
  const current = playerBody.linvel();
  const response = grounded ? Math.min(1, dt * 10) : Math.min(1, dt * (gliding ? 3.7 : 2.4));
  playerBody.setLinvel({
    x: THREE.MathUtils.lerp(current.x, desiredX, response),
    y: current.y,
    z: THREE.MathUtils.lerp(current.z, desiredZ, response),
  }, true);

  const position = playerBody.translation();
  avatar.position.set(position.x, position.y, position.z);
  avatar.rotation.y = yaw;
  const flap = !grounded && spaceHeld;
  for (const { pivot, side } of wingPivots) {
    const deployed = flap ? 0.82 : 0.08;
    pivot.rotation.z = THREE.MathUtils.damp(pivot.rotation.z, side * deployed, 7, dt);
  }

  camera.position.set(position.x, position.y + eyeOffset, position.z);
  camera.rotation.set(pitch + recoil + aimSwayPitch, yaw + aimSwayYaw, 0, 'YXZ');
  const velocity = playerBody.linvel();
  const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
  ui.speed.textContent = String(Math.round(horizontalSpeed * 3.6)).padStart(2, '0');
}

function updateRagdoll() {
  for (const part of ragdollBodies) {
    const p = part.body.translation();
    const r = part.body.rotation();
    part.visual.position.set(p.x, p.y, p.z);
    part.visual.quaternion.set(r.x, r.y, r.z, r.w);
  }
}

function updateBullets(dt) {
  for (let index = bullets.length - 1; index >= 0; index--) {
    const bullet = bullets[index];
    bullet.age += dt;
    const p = bullet.body.translation();
    bullet.mesh.position.set(p.x, p.y, p.z);
    const velocity = bullet.body.linvel();
    const speed = Math.hypot(velocity.x, velocity.y, velocity.z) || 1;
    const trailLength = 1.2;
    const positions = bullet.trailGeometry.attributes.position;
    positions.setXYZ(0, p.x - velocity.x / speed * trailLength, p.y - velocity.y / speed * trailLength, p.z - velocity.z / speed * trailLength);
    positions.setXYZ(1, p.x, p.y, p.z);
    positions.needsUpdate = true;
    bullet.trailGeometry.computeBoundingSphere();
    if (bullet.ended || bullet.age > 3.2) {
      removeBullet(bullet);
      bullets.splice(index, 1);
    }
  }
}

function updateTargets(dt) {
  for (const target of targets) {
    target.flash = Math.max(0, target.flash - dt);
    const flash = target.flash > 0;
    const plate = target.group.children[0];
    plate.material.color.set(flash ? '#e8b76e' : '#d5d0bb');
    plate.material.emissive.set(flash ? '#48270d' : '#000000');
    plate.material.emissiveIntensity = flash ? 0.5 : 0;
  }
}

function updateWeapon(dt) {
  recoil = THREE.MathUtils.damp(recoil, 0, 9, dt);
  weapon.position.z = THREE.MathUtils.damp(weapon.position.z, -0.72, 14, dt);
  const wantedFov = scopeHeld ? 72 / scopeMagnification : 72;
  camera.fov = THREE.MathUtils.damp(camera.fov, wantedFov, scopeHeld ? 10 : 8, dt);
  camera.updateProjectionMatrix();

  if (reloadRemaining > 0) {
    reloadRemaining = Math.max(0, reloadRemaining - dt);
    ui.status.textContent = 'RELOADING';
    if (reloadRemaining === 0) {
      const loaded = Math.min(MAGAZINE_CAPACITY - roundsInMagazine, reserveRounds);
      roundsInMagazine += loaded;
      reserveRounds -= loaded;
      ui.reloadButton.classList.remove('pressed');
      updateAmmoHud();
      ui.status.textContent = 'ROUND CHAMBERED';
      statusTimer = 0.9;
    }
  } else if (boltCycle > 0) {
    boltCycle = Math.max(0, boltCycle - dt);
    if (boltCycle === 0) ui.status.textContent = roundsInMagazine > 0 ? 'RANGE READY' : 'EMPTY · PRESS R TO RELOAD';
  } else if (statusTimer > 0) {
    statusTimer = Math.max(0, statusTimer - dt);
    if (statusTimer === 0) ui.status.textContent = 'RANGE READY';
  }

  const reloadProgress = reloadRemaining > 0 ? 1 - reloadRemaining / 2.35 : 0;
  const cycleProgress = boltCycle > 0 ? 1 - boltCycle / 0.72 : 0;
  const boltMotion = Math.sin(Math.PI * Math.max(reloadProgress, cycleProgress));
  bolt.position.x = 0.13 + boltMotion * 0.085;
  bolt.rotation.z = Math.PI / 2 + boltMotion * 0.2;

  const velocity = playerBody && !ragdollActive ? playerBody.linvel() : { x: 0, z: 0 };
  const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
  const steadyActive = scopeHeld && steadyHeld && breathRemaining > 0 && horizontalSpeed < 0.65 && playerOnGround();
  if (steadyActive) breathRemaining = Math.max(0, breathRemaining - dt);
  else breathRemaining = Math.min(MAX_BREATH, breathRemaining + dt * 0.55);
  if (breathRemaining === 0 && steadyHeld) setSteadyHeld(false);
  ui.breathMeter.classList.toggle('visible', scopeHeld);
  ui.breathFill.style.transform = `scaleX(${breathRemaining / MAX_BREATH})`;
  ui.steadyButton.classList.toggle('steady-active', steadyActive);
  swayClock += dt * 1.1;
  const breathingScale = steadyActive ? 0.08 : 1;
  const scopeScale = scopeHeld ? 1 : 0.12;
  const movementSway = Math.min(horizontalSpeed * (scopeHeld ? 0.00075 : 0.00012), scopeHeld ? 0.006 : 0.001);
  aimSwayYaw = (Math.sin(swayClock * 0.75) * 0.0015 + Math.sin(swayClock * 1.37) * 0.00055) * breathingScale * scopeScale + Math.sin(swayClock * 2.1) * movementSway;
  aimSwayPitch = (Math.sin(swayClock * 0.53 + 1.2) * 0.00125 + Math.sin(swayClock * 1.09) * 0.0004) * breathingScale * scopeScale;

  if (muzzleTimer > 0) {
    muzzleTimer -= dt;
    if (muzzleTimer <= 0) flashLight.intensity = 0;
  }
  if (hitFlashTimer > 0) {
    hitFlashTimer -= dt;
    if (hitFlashTimer <= 0) ui.hit.classList.remove('show');
  }
}

function animate(now) {
  requestAnimationFrame(animate);
  const elapsed = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!gameStarted) {
    camera.position.set(0.15, 1.72, 4.2);
    camera.rotation.set(-0.045, 0, 0, 'YXZ');
  } else {
    accumulator += elapsed;
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < 6) {
      updatePlayer(FIXED_DT);
      applyProjectileForces();
      world.step(eventQueue);
      eventQueue.drainCollisionEvents(resolveCollision);
      accumulator -= FIXED_DT;
      steps++;
    }
    if (ragdollActive) updateRagdoll();
    else updatePlayer(0);
    updateBullets(elapsed);
    updateTargets(elapsed);
    updateWeapon(elapsed);
  }
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, isTouchDevice ? 1.25 : 1.7));
});

requestAnimationFrame(animate);
