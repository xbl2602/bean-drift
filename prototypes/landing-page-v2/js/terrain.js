// Terrain scenes. Two WebGL views share one real LOLA height grid:
//  1) createMapScene   : orthographic "2D map" with a real time slider and shadows
//  2) createFpScene    : 1.6 m eye height first person view
// Everything numeric (height, slope, horizon, annual visibility) is computed
// from the DEM at runtime, not baked into the page.

import * as THREE from "three";

const MOON_RADIUS_M = 1737400;
const EYE_HEIGHT_M = 1.6;
const HORIZON_BINS = 144;
const HORIZON_STEP_M = 25;
const HORIZON_MAX_M = 16000;

/* ------------------------------------------------------------ data ---- */

export async function loadTerrain() {
  const [bin, meta, sky] = await Promise.all([
    fetch("./assets/terrain.bin").then((r) => {
      if (!r.ok) throw new Error(`terrain.bin ${r.status}`);
      return r.arrayBuffer();
    }),
    fetch("./assets/terrain-meta.json").then((r) => r.json()),
    fetch("./data/recorded/skyyear.json").then((r) => r.json()),
  ]);
  const N = meta.size;
  const heights = new Int16Array(bin);
  if (heights.length !== N * N) throw new Error("terrain.bin size mismatch");
  // sky_year.json was sampled at the pole (longitude 0); the demo site is at
  // 62.5E. Near the pole the local azimuth differs from the polar one by
  // almost exactly the longitude, so shift both bodies. Checked against
  // /api/point at four epochs (error < 0.05 deg).
  const azShift = -62.5;
  sky.sunAz = sky.sunAz.map((a) => (a + azShift + 720) % 360);
  sky.earthAz = sky.earthAz.map((a) => (a + azShift + 720) % 360);
  return { heights, N, meta, sky, world: (N - 1) * meta.spacingM };
}

/** Apollo 11 (LROC 2 m) terrain for the first-person section. */
export async function loadApolloTerrain() {
  const [bin, meta] = await Promise.all([
    fetch("./assets/terrain-apollo.bin").then((r) => {
      if (!r.ok) throw new Error(`terrain-apollo.bin ${r.status}`);
      return r.arrayBuffer();
    }),
    fetch("./assets/terrain-apollo-meta.json").then((r) => r.json()),
  ]);
  const N = meta.size;
  const heights = new Int16Array(bin);
  return { heights, N, meta, world: (N - 1) * meta.spacingM };
}

export function heightAt(t, x, z) {
  const { N, world, heights } = t;
  const fx = (x / world + 0.5) * (N - 1);
  const fz = (z / world + 0.5) * (N - 1);
  if (fx < 0 || fz < 0 || fx > N - 1.001 || fz > N - 1.001) return null;
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const tx = fx - x0;
  const tz = fz - z0;
  const i = z0 * N + x0;
  const h00 = heights[i];
  const h10 = heights[i + 1];
  const h01 = heights[i + N];
  const h11 = heights[i + N + 1];
  return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
}

export function slopeAt(t, x, z) {
  const d = t.meta.spacingM;
  const hx1 = heightAt(t, x + d, z);
  const hx0 = heightAt(t, x - d, z);
  const hz1 = heightAt(t, x, z + d);
  const hz0 = heightAt(t, x, z - d);
  if (hx1 === null || hx0 === null || hz1 === null || hz0 === null) return null;
  const gx = (hx1 - hx0) / (2 * d);
  const gz = (hz1 - hz0) / (2 * d);
  return { slopeDeg: (Math.atan(Math.hypot(gx, gz)) * 180) / Math.PI, aspectDeg: (Math.atan2(gx, -gz) * 180) / Math.PI };
}

export function latLonFromXZ(x, z) {
  const r = Math.hypot(x, z);
  const lat = 90 - (r / MOON_RADIUS_M) * (180 / Math.PI);
  let lon = (Math.atan2(x, -z) * 180) / Math.PI;
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;
  return { latDeg: lat, lonDeg: lon };
}

/** Ray-march the full-resolution DEM to get the occlusion elevation per azimuth. */
export function horizonAt(t, x, z, bins = HORIZON_BINS) {
  const out = new Float32Array(bins);
  const base = heightAt(t, x, z) ?? 0;
  const eye = base + EYE_HEIGHT_M;
  for (let b = 0; b < bins; b++) {
    const az = (b / bins) * Math.PI * 2;
    const dx = Math.sin(az) * HORIZON_STEP_M;
    const dz = -Math.cos(az) * HORIZON_STEP_M;
    let maxAng = -90;
    let px = x;
    let pz = z;
    for (let d = HORIZON_STEP_M; d <= HORIZON_MAX_M; d += HORIZON_STEP_M) {
      px += dx;
      pz += dz;
      const h = heightAt(t, px, pz);
      if (h === null) break;
      // lunar curvature drop, first order
      const drop = (d * d) / (2 * MOON_RADIUS_M);
      const ang = (Math.atan2(h - drop - eye, d) * 180) / Math.PI;
      if (ang > maxAng) maxAng = ang;
    }
    out[b] = maxAng;
  }
  return out;
}

/** Annual sun / earth visibility from the precomputed 8760 h ephemeris. */
export function annualStats(horizon, sky, bins = HORIZON_BINS) {
  const stepDeg = 360 / bins;
  const sunR = 0.27;
  const earthR = 0.9;
  let sunUp = 0;
  let earthUp = 0;
  let sunDarkRun = 0;
  let earthDarkRun = 0;
  let sunDarkMax = 0;
  let earthDarkMax = 0;
  const n = sky.sunAz.length;
  for (let i = 0; i < n; i++) {
    const sBin = Math.floor((((sky.sunAz[i] % 360) + 360) % 360) / stepDeg) % bins;
    if (sky.sunEl[i] + sunR > horizon[sBin]) {
      sunUp++;
      sunDarkRun = 0;
    } else {
      sunDarkRun++;
      if (sunDarkRun > sunDarkMax) sunDarkMax = sunDarkRun;
    }

    const eBin = Math.floor((((sky.earthAz[i] % 360) + 360) % 360) / stepDeg) % bins;
    if (sky.earthEl[i] + earthR > horizon[eBin]) {
      earthUp++;
      earthDarkRun = 0;
    } else {
      earthDarkRun++;
      if (earthDarkRun > earthDarkMax) earthDarkMax = earthDarkRun;
    }
  }
  return {
    sunFraction: sunUp / n,
    earthFraction: earthUp / n,
    sunOutageH: sunDarkMax,
    earthOutageH: earthDarkMax,
  };
}

function sunDirection(azDeg, elDeg) {
  const az = (azDeg * Math.PI) / 180;
  const el = (elDeg * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
}

/* --------------------------------------------------------- geometry --- */

function buildTerrainGeometry(t, segments, tint = { base: 0.20, range: 0.24 }) {
  const { N, world, heights } = t;
  const S = segments;
  const pos = new Float32Array(S * S * 3);
  const col = new Float32Array(S * S * 3);
  const idx = new Uint32Array((S - 1) * (S - 1) * 6);
  const hMin = t.meta.minM;
  const hMax = t.meta.maxM;

  for (let r = 0; r < S; r++) {
    const sr = Math.round((r / (S - 1)) * (N - 1));
    for (let c = 0; c < S; c++) {
      const sc = Math.round((c / (S - 1)) * (N - 1));
      const i = r * S + c;
      const h = heights[sr * N + sc];
      pos[i * 3] = (c / (S - 1) - 0.5) * world;
      pos[i * 3 + 1] = h;
      pos[i * 3 + 2] = (r / (S - 1) - 0.5) * world;
      const g = tint.base + tint.range * ((h - hMin) / (hMax - hMin));
      col[i * 3] = g * 0.98;
      col[i * 3 + 1] = g * 0.99;
      col[i * 3 + 2] = g;
    }
  }
  let k = 0;
  for (let r = 0; r < S - 1; r++) {
    for (let c = 0; c < S - 1; c++) {
      const a = r * S + c;
      const b = a + 1;
      const d = a + S;
      const e = d + 1;
      idx[k++] = a; idx[k++] = d; idx[k++] = b;
      idx[k++] = b; idx[k++] = d; idx[k++] = e;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  return geo;
}

function rendererFor(canvas, { shadows = true } = {}) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.0;
  r.outputColorSpace = THREE.SRGBColorSpace;
  if (shadows) {
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
  }
  return r;
}

// Procedural regolith detail (albedo variation) injected into MeshStandardMaterial.
const DETAIL_GLSL = `
varying vec3 vWPos;
float h21(vec3 p){ p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n31(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  float n000 = h21(i), n100 = h21(i + vec3(1,0,0)), n010 = h21(i + vec3(0,1,0)), n110 = h21(i + vec3(1,1,0));
  float n001 = h21(i + vec3(0,0,1)), n101 = h21(i + vec3(1,0,1)), n011 = h21(i + vec3(0,1,1)), n111 = h21(i + vec3(1,1,1));
  return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y), mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);
}
float fbm3(vec3 p){ float v = 0.0, a = 0.5; for(int i = 0; i < 4; i++){ v += a * n31(p); p *= 2.07; a *= 0.5; } return v; }
`;

function addRegolithDetail(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + DETAIL_GLSL)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float dA = fbm3(vWPos * 0.85);
        float dB = fbm3(vWPos * 0.11);
        float dC = fbm3(vWPos * 3.4);
        diffuseColor.rgb *= (0.70 + 0.60 * dA) * (0.82 + 0.36 * dB) * (0.90 + 0.20 * dC);
        float rocks = smoothstep(0.56, 0.70, fbm3(vWPos * 2.1));
        diffuseColor.rgb *= 1.0 - rocks * 0.38;`
      )
      .replace(
        "#include <normal_fragment_begin>",
        `#include <normal_fragment_begin>
        float bumpH = fbm3(vWPos * 1.7) * 2.2 + fbm3(vWPos * 7.0) * 0.8;
        normal = normalize(normal + vec3(dFdx(bumpH), dFdy(bumpH), 0.0) * 0.55);`
      );
  };
  mat.needsUpdate = true;
}

function loadTexture(path) {
  const tex = new THREE.TextureLoader().load(path);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function addStars(scene, radius = 40000, count = 900) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const t = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    const r = radius * (0.8 + Math.random() * 0.4);
    p[i * 3] = r * Math.sin(ph) * Math.cos(t);
    p[i * 3 + 1] = r * Math.cos(ph) * 0.6 + radius * 0.2;
    p[i * 3 + 2] = r * Math.sin(ph) * Math.sin(t);
  }
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  const m = new THREE.PointsMaterial({ color: 0xd8e4f0, size: 90, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false });
  scene.add(new THREE.Points(g, m));
}

/* ------------------------------------------------------------- map ---- */

export function createMapScene({ canvas, terrain, reduced, onHover, onPick, onSun }) {
  const renderer = rendererFor(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05080d);

  const world = terrain.world;
  const camera = new THREE.OrthographicCamera(-world / 2, world / 2, world / 2, -world / 2, 1, 200000);
  camera.position.set(0, 60000, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);

  const geo = buildTerrainGeometry(terrain, 620);

  const litMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0.0 });
  const litMesh = new THREE.Mesh(geo, litMat);
  litMesh.receiveShadow = true;
  litMesh.castShadow = true;
  scene.add(litMesh);

  const flatMat = new THREE.MeshBasicMaterial({ map: null, toneMapped: true });
  const flatMesh = new THREE.Mesh(geo, flatMat);
  flatMesh.visible = false;
  scene.add(flatMesh);

  const ambient = new THREE.AmbientLight(0x233246, 1.2);
  scene.add(ambient);
  const sunLight = new THREE.DirectionalLight(0xfff0dc, 5.2);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  const sc = sunLight.shadow.camera;
  sc.left = -world * 0.8;
  sc.right = world * 0.8;
  sc.top = world * 0.8;
  sc.bottom = -world * 0.8;
  sc.near = 1000;
  sc.far = 260000;
  sunLight.shadow.bias = -0.0008;
  sunLight.shadow.normalBias = 45;
  scene.add(sunLight);
  const earthFill = new THREE.DirectionalLight(0x6fb6d8, 0.55);
  scene.add(earthFill);

  const LAYERS = {
    height: loadTexture("./assets/height-tint.png"),
    slope: loadTexture("./assets/slope-tint.png"),
    sun: loadTexture("./assets/sun-visibility.png"),
    earth: loadTexture("./assets/earth-visibility.png"),
  };

  const state = { layer: "light", timeIndex: 0, dirty: true, visible: true };
  let resizeObserver = null;

  function applySun(index) {
    const sky = terrain.sky;
    const az = sky.sunAz[index % sky.sunAz.length];
    const el = sky.sunEl[index % sky.sunEl.length];
    const eaz = sky.earthAz[index % sky.earthAz.length];
    const eel = sky.earthEl[index % sky.earthEl.length];
    const dir = sunDirection(az, el);
    sunLight.position.copy(dir).multiplyScalar(90000);
    sunLight.target.position.set(0, 0, 0);
    sunLight.target.updateMatrixWorld();
    const edir = sunDirection(eaz, Math.max(eel, -20));
    earthFill.position.copy(edir).multiplyScalar(40000);
    sunLight.intensity = 5.2;
    onSun?.({ az, el, eaz, eel, index });
    state.dirty = true;
  }

  function setLayer(name) {
    state.layer = name;
    if (name === "light") {
      litMesh.visible = true;
      flatMesh.visible = false;
    } else {
      flatMesh.material.map = LAYERS[name];
      flatMesh.material.needsUpdate = true;
      litMesh.visible = false;
      flatMesh.visible = true;
    }
    state.dirty = true;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    const aspect = rect.width / rect.height;
    const half = (world / 2) * 1.02;
    camera.left = -half * aspect;
    camera.right = half * aspect;
    camera.top = half;
    camera.bottom = -half;
    camera.updateProjectionMatrix();
    state.dirty = true;
  }
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const p = new THREE.Vector3();
    return raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p) ? p : null;
  }

  let pin = null;
  canvas.addEventListener("pointermove", (e) => {
    const p = toWorld(e.clientX, e.clientY);
    if (!p) return;
    const h = heightAt(terrain, p.x, p.z);
    if (h === null) return;
    const sl = slopeAt(terrain, p.x, p.z);
    const ll = latLonFromXZ(p.x, p.z);
    onHover?.({ x: p.x, z: p.z, h, slope: sl?.slopeDeg ?? 0, ...ll });
  });

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const p = toWorld(e.clientX, e.clientY);
    if (!p) return;
    const h = heightAt(terrain, p.x, p.z);
    if (h === null) return;
    const sl = slopeAt(terrain, p.x, p.z);
    const ll = latLonFromXZ(p.x, p.z);
    const horizon = horizonAt(terrain, p.x, p.z);
    const stats = annualStats(horizon, terrain.sky);
    pin = { x: p.x, y: h, z: p.z };
    onPick?.({ x: p.x, z: p.z, h, slope: sl?.slopeDeg ?? 0, ...ll, horizon, stats });
    state.dirty = true;
  });

  const io = new IntersectionObserver((es) => es.forEach((en) => (state.visible = en.isIntersecting)), { threshold: 0.01 });
  io.observe(canvas);

  let raf = 0;
  function loop() {
    raf = requestAnimationFrame(loop);
    if (state.visible && state.dirty) {
      state.dirty = false;
      renderer.render(scene, camera);
    }
  }
  loop();
  applySun(0);

  return {
    setTime(index) {
      state.timeIndex = index;
      applySun(index);
    },
    setLayer,
    projectToScreen(x, y, z) {
      const v = new THREE.Vector3(x, y, z).project(camera);
      const rect = canvas.getBoundingClientRect();
      return { x: (v.x * 0.5 + 0.5) * rect.width, y: (-v.y * 0.5 + 0.5) * rect.height };
    },
    requestRender() {
      state.dirty = true;
    },
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect();
      resizeObserver?.disconnect();
      geo.dispose();
      renderer.dispose();
    },
  };
}

/* --------------------------------------------------------- first person */

export function createFpScene({ canvas, terrain, sun, reduced }) {
  const renderer = rendererFor(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03050a);

  const { N, heights } = terrain;
  // stand on one of the highest local peaks of the crop
  let best = 0;
  for (let i = 0; i < heights.length; i += 3) if (heights[i] > heights[best]) best = i;
  const bx = ((best % N) / (N - 1) - 0.5) * terrain.world;
  const bz = (Math.floor(best / N) / (N - 1) - 0.5) * terrain.world;
  const baseY = heightAt(terrain, bx, bz) ?? 0;

  const geo = buildTerrainGeometry(terrain, 448, { base: 0.075, range: 0.075 });
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98, metalness: 0 });
  addRegolithDetail(mat);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  scene.add(mesh);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.5, 120000);
  renderer.toneMappingExposure = 1.15;

  const ambient = new THREE.AmbientLight(0x1c2a3c, 0.32);
  scene.add(ambient);
  const sunLight = new THREE.DirectionalLight(0xfff1de, 5.4);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  const sc = sunLight.shadow.camera;
  sc.left = -14000; sc.right = 14000; sc.top = 14000; sc.bottom = -14000; sc.near = 10; sc.far = 120000;
  sunLight.shadow.bias = -0.0006;
  sunLight.shadow.normalBias = 6;
  scene.add(sunLight);
  const earthFill = new THREE.DirectionalLight(0x74b7d8, 0.3);
  scene.add(earthFill);

  addStars(scene, 50000, 1100);

  // scattered boulders for scale (procedural placement on the real surface)
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xa4a9ae, roughness: 1.0, metalness: 0 });
  const ROCK_COUNT = 620;
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, ROCK_COUNT);
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  const dummy = new THREE.Object3D();
  // scatter along the walking path so the foreground always has scale references
  const azRad = (sun.azDeg * Math.PI) / 180;
  const fwdX = Math.sin(azRad);
  const fwdZ = -Math.cos(azRad);
  const pathX = bx + fwdX * 240;
  const pathZ = bz + fwdZ * 240;
  for (let i = 0; i < ROCK_COUNT; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = 4 + Math.pow(Math.random(), 0.6) * 300;
    const rx = pathX + Math.cos(ang) * rad;
    const rz = pathZ + Math.sin(ang) * rad;
    const h = heightAt(terrain, rx, rz);
    const s = 0.10 + Math.pow(Math.random(), 3.2) * 1.6;
    dummy.position.set(rx, (h ?? baseY) + s * 0.35, rz);
    dummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    dummy.scale.set(s * (0.7 + Math.random() * 0.7), s * (0.35 + Math.random() * 0.45), s * (0.7 + Math.random() * 0.7));
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  rocks.instanceMatrix.needsUpdate = true;
  scene.add(rocks);

  // sun / earth markers
  function glowSprite(color, size, opacity) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.18, "rgba(255,255,255,0.6)");
    g.addColorStop(0.5, "rgba(255,255,255,0.12)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.setScalar(size);
    return s;
  }
  // angular sizes are the real ones: sun 0.27 deg, earth 0.9 deg
  const sunGlow = glowSprite(0xffd6a0, 4200, 0.28);
  const sunCore = glowSprite(0xfff6e8, 430, 1.0);
  const earthGlow = glowSprite(0x8fc6e6, 2600, 0.25);
  const earthDisc = glowSprite(0x9ecde9, 1100, 0.85);
  scene.add(sunGlow, sunCore, earthGlow, earthDisc);

  let state = { visible: true, progress: 0 };
  let yaw = 0;
  let pitch = 0;
  const sunDirVec = new THREE.Vector3(0, 0.03, -1);
  const earthDirVec = new THREE.Vector3(0, 0.1, -1);

  function applyTime() {
    const az = sun.azDeg;
    const el = sun.elDeg;
    const eaz = sun.earthAzDeg;
    const eel = sun.earthElDeg;
    const dir = sunDirection(az, el);
    sunDirVec.copy(dir);
    sunLight.position.copy(dir).multiplyScalar(60000);
    sunLight.target.position.set(bx, 0, bz);
    sunLight.target.updateMatrixWorld();
    const edir = sunDirection(eaz, eel);
    earthDirVec.copy(edir);
    earthFill.position.copy(edir).multiplyScalar(30000);
    earthDisc.visible = eel > 0.1;
    earthGlow.visible = eel > 0.1;

    yaw = Math.atan2(dir.x, -dir.z);
    // look at the horizon, not at the sun: the ground and the long shadows are the subject
    pitch = -0.035;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const io = new IntersectionObserver((es) => es.forEach((en) => (state.visible = en.isIntersecting)), { threshold: 0.01 });
  io.observe(canvas);

  const started = performance.now();
  let raf = 0;

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!state.visible) return;
    const t = (performance.now() - started) / 1000;
    const p = state.progress;
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
    const dist = 100 + p * 260;
    const px = bx + fwd.x * dist;
    const pz = bz + fwd.z * dist;
    const ground = heightAt(terrain, px, pz) ?? baseY;
    camera.position.set(px, ground + EYE_HEIGHT_M + 1.4, pz);
    const sway = reduced ? 0 : Math.sin(t * 0.23) * 0.012 + Math.sin(t * 0.07) * 0.01;
    const lookAt = new THREE.Vector3(
      px + Math.sin(yaw + sway) * 1000,
      ground + EYE_HEIGHT_M + Math.tan(pitch + 0.025) * 1000,
      pz - Math.cos(yaw + sway) * 1000
    );
    camera.lookAt(lookAt);

    // place the sun and earth at the correct angular position from the camera
    sunCore.position.copy(camera.position).addScaledVector(sunDirVec, 45000);
    sunGlow.position.copy(sunCore.position);
    earthDisc.position.copy(camera.position).addScaledVector(earthDirVec, 35000);
    earthGlow.position.copy(earthDisc.position);

    renderer.render(scene, camera);
  }

  applyTime();
  frame();

  return {
    setProgress(p) {
      state.progress = Math.max(0, Math.min(1, p));
    },
    resize,
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      geo.dispose();
      renderer.dispose();
    },
  };
}
