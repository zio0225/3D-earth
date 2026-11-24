import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const container = document.querySelector('#scene-container');
const loading = document.querySelector('#loading');
const errorBox = document.querySelector('#error');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020509);
scene.fog = new THREE.FogExp2(0x020509, 0.018);

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100);
const initialCamera = new THREE.Vector3(0, 0.35, 7.4);
camera.position.copy(initialCamera);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.minDistance = 3.45;
controls.maxDistance = 13;
controls.enablePan = false;

const ambient = new THREE.AmbientLight(0x36506b, 0.2);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xfff1d5, 3.4);
scene.add(sun);

const earthGroup = new THREE.Group();
earthGroup.rotation.z = THREE.MathUtils.degToRad(-23.4);
scene.add(earthGroup);

// 256 × 128 segments: displacement가 실제로 이동시킬 약 33,000개의 정점.
const geometry = new THREE.SphereGeometry(2, 256, 128);
let earth;
const HEIGHT_MIN = -11000;
const HEIGHT_MAX = 9000;
const SEA_LEVEL = (0 - HEIGHT_MIN) / (HEIGHT_MAX - HEIGHT_MIN);
const BASE_DISPLACEMENT = 0.22;

function showError(message) {
  errorBox.hidden = false;
  errorBox.textContent = `텍스처 로딩 오류: ${message}. VS Code Live Server 등 로컬 웹 서버로 실행했는지 확인하세요.`;
  loading.classList.add('done');
}

function loadTexture(url, color = false) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      if (color) texture.colorSpace = THREE.SRGBColorSpace;
      resolve(texture);
    }, undefined, () => reject(new Error(url)));
  });
}

Promise.all([
  loadTexture('./assets/earth_color.jpg', true),
  loadTexture('./assets/earth_height.jpg')
]).then(([colorMap, heightMap]) => {
  const material = new THREE.MeshStandardMaterial({
    map: colorMap,
    displacementMap: heightMap,
    displacementScale: BASE_DISPLACEMENT,
    displacementBias: -SEA_LEVEL * BASE_DISPLACEMENT,
    bumpMap: heightMap,
    bumpScale: 0.055,
    roughness: 0.78,
    metalness: 0.02
  });
  earth = new THREE.Mesh(geometry, material);
  earth.rotation.y = THREE.MathUtils.degToRad(-18);
  earthGroup.add(earth);
  loading.classList.add('done');
}).catch((error) => showError(error.message));

// 얇은 대기 림: 뒷면을 그리는 투명 셸.
const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(2.075, 96, 64),
  new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { glowColor: { value: new THREE.Color(0x58b9ed) } },
    vertexShader: `varying vec3 vNormal; varying vec3 vWorld; void main(){vNormal=normalize(normalMatrix*normal); vec4 w=modelMatrix*vec4(position,1.0); vWorld=w.xyz; gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform vec3 glowColor; varying vec3 vNormal; varying vec3 vWorld; void main(){vec3 viewDir=normalize(cameraPosition-vWorld); float rim=pow(1.0-max(dot(vNormal,viewDir),0.0),3.2); gl_FragColor=vec4(glowColor,rim*.42);}`
  })
);
earthGroup.add(atmosphere);

function makeStars(count = 1800) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = THREE.MathUtils.randFloat(22, 46);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    const shade = THREE.MathUtils.randFloat(0.35, 1);
    colors[i * 3] = shade * 0.75; colors[i * 3 + 1] = shade * 0.86; colors[i * 3 + 2] = shade;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 0.035, vertexColors: true, transparent: true, opacity: 0.7, sizeAttenuation: true }));
}
scene.add(makeStars());

const ui = {
  auto: document.querySelector('#auto-rotate'), speed: document.querySelector('#rotation-speed'),
  height: document.querySelector('#height-scale'), bump: document.querySelector('#bump-scale'),
  azimuth: document.querySelector('#sun-azimuth'), elevation: document.querySelector('#sun-elevation'),
  wireframe: document.querySelector('#wireframe')
};

function setRangeFill(input) {
  const p = ((input.value - input.min) / (input.max - input.min)) * 100;
  input.style.setProperty('--fill', `${p}%`);
}

function updateSun() {
  const az = THREE.MathUtils.degToRad(Number(ui.azimuth.value));
  const el = THREE.MathUtils.degToRad(Number(ui.elevation.value));
  const distance = 10;
  sun.position.set(distance * Math.cos(el) * Math.sin(az), distance * Math.sin(el), distance * Math.cos(el) * Math.cos(az));
  document.querySelector('#sun-azimuth-value').value = `${ui.azimuth.value}°`;
  document.querySelector('#sun-elevation-value').value = `${ui.elevation.value}°`;
}

Object.values(ui).filter((el) => el.type === 'range').forEach((el) => {
  setRangeFill(el);
  el.addEventListener('input', () => setRangeFill(el));
});
ui.speed.addEventListener('input', () => {
  document.querySelector('#rotation-value').value = Number(ui.speed.value).toFixed(3);
  document.querySelector('#speed-readout').textContent = `${Number(ui.speed.value).toFixed(3)} rad/s`;
});
ui.height.addEventListener('input', () => {
  const multiplier = Number(ui.height.value);
  document.querySelector('#height-value').value = `${multiplier.toFixed(2)}×`;
  document.querySelector('#height-readout').textContent = `${multiplier.toFixed(2)}×`;
  if (earth) {
    const scale = BASE_DISPLACEMENT * multiplier;
    earth.material.displacementScale = scale;
    earth.material.displacementBias = -SEA_LEVEL * scale;
  }
});
ui.bump.addEventListener('input', () => {
  document.querySelector('#bump-value').value = Number(ui.bump.value).toFixed(3);
  if (earth) earth.material.bumpScale = Number(ui.bump.value);
});
ui.azimuth.addEventListener('input', updateSun);
ui.elevation.addEventListener('input', updateSun);
ui.wireframe.addEventListener('change', () => { if (earth) earth.material.wireframe = ui.wireframe.checked; });
document.querySelector('#reset-camera').addEventListener('click', () => {
  camera.position.copy(initialCamera); controls.target.set(0, 0, 0); controls.update();
});
updateSun();

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.1);
  if (earth && ui.auto.checked) earth.rotation.y += Number(ui.speed.value) * delta;
  controls.update();
  renderer.render(scene, camera);
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
