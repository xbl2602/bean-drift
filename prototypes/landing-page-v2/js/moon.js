// Hero scene: a real-terminator moon with three interface nodes in orbit.
// Design notes: the moon is procedural (no textures to download), lit by a
// directional "sun" whose azimuth/elevation are driven by the real ephemeris
// so the terminator can rotate as the year advances. Bloom is used only for
// the glowing nodes and the lit limb.

import * as THREE from "three";
import { EffectComposer } from "../vendor/postprocessing/EffectComposer.js";
import { RenderPass } from "../vendor/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "../vendor/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "../vendor/postprocessing/OutputPass.js";

const MOON_VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vObj;
  varying vec3 vView;
  void main(){
    vObj = normalize(position);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const MOON_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vNormalW;
  varying vec3 vObj;
  varying vec3 vView;
  uniform vec3 uSunDir;
  uniform vec3 uEarthDir;
  uniform float uSunIntensity;
  uniform float uTime;

  float hash(vec3 p){
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float vnoise(vec3 x){
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash(i), n100 = hash(i + vec3(1,0,0));
    float n010 = hash(i + vec3(0,1,0)), n110 = hash(i + vec3(1,1,0));
    float n001 = hash(i + vec3(0,0,1)), n101 = hash(i + vec3(1,0,1));
    float n011 = hash(i + vec3(0,1,1)), n111 = hash(i + vec3(1,1,1));
    return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y),
               mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);
  }
  float fbm(vec3 p){
    float v = 0.0, a = 0.5;
    for(int i = 0; i < 5; i++){ v += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main(){
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(vView);
    vec3 L = normalize(uSunDir);
    vec3 E = normalize(uEarthDir);

    // --- albedo: grey regolith, sharp-edged maria, crater speckle ---
    vec3 p = vObj * 2.0;
    float m1 = fbm(p * 1.55 + 11.0);
    float m2 = fbm(p * 4.3 + 3.0);
    float maria = smoothstep(0.555, 0.585, m1) * (0.72 + 0.34 * smoothstep(0.44, 0.62, m2));
    float big = fbm(p * 3.1 + 5.0);
    float detail = fbm(p * 14.0 + 3.0);
    float fine = fbm(p * 44.0);
    float speck = smoothstep(0.74, 0.92, fbm(p * 26.0 + 41.0));

    float base = 0.62 - maria * 0.38;                 // maria are darker, not brown
    float albedo = base * (0.88 + 0.18 * big) * (0.90 + 0.18 * detail) * (0.94 + 0.10 * fine);
    albedo += speck * 0.06;                            // bright ejecta speckle

    // a few bright ray craters (Tycho-like) so the sphere reads as the Moon
    vec3 c0 = normalize(vec3(0.42, 0.55, 0.72));
    vec3 c1 = normalize(vec3(-0.55, -0.30, 0.78));
    vec3 c2 = normalize(vec3(0.15, -0.70, 0.70));
    float c0d = acos(clamp(dot(vObj, c0), -1.0, 1.0));
    float c1d = acos(clamp(dot(vObj, c1), -1.0, 1.0));
    float c2d = acos(clamp(dot(vObj, c2), -1.0, 1.0));
    float craters = smoothstep(0.055, 0.012, c0d) * 0.30
                  + smoothstep(0.040, 0.008, c1d) * 0.22
                  + smoothstep(0.030, 0.006, c2d) * 0.16;
    craters += smoothstep(0.16, 0.0, c0d) * 0.05 + smoothstep(0.12, 0.0, c1d) * 0.035;
    albedo += craters;

    // --- cheap relief: screen-space gradient of a mid-frequency noise ---
    float relief = fbm(p * 7.0 + 21.0);
    vec3 Nb = normalize(N - vec3(dFdx(relief), dFdy(relief), 0.0) * 1.4);

    // --- Lommel-Seeliger: regolith backscatter, dark limb ---
    float mu0 = max(dot(Nb, L), 0.0);
    float mu  = max(dot(N, V), 0.0001);
    float ls  = mu0 / (mu0 + mu + 0.0001);

    // rough-surface terminator: no atmosphere, but a rough regolith gives a
    // softer edge than a mirror sphere
    float soft = smoothstep(-0.006, 0.10, mu0);
    vec3 sun = vec3(1.0, 0.975, 0.94) * 1.45;
    vec3 color = albedo * sun * ls * soft * uSunIntensity;

    // --- earthshine: cool fill on the night side ---
    float es = max(dot(N, E), 0.0);
    color += albedo * vec3(0.30, 0.46, 0.62) * 0.14 * es;

    // --- limb rim ---
    float fres = pow(1.0 - mu, 3.0);
    color += vec3(0.42, 0.52, 0.64) * fres * 0.14;

    // subtle grain so the sphere does not band
    color *= 0.97 + 0.05 * vnoise(vObj * 160.0);

    gl_FragColor = vec4(color, 1.0);
  }
`;

function makeGlowTexture() {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.22, "rgba(255,255,255,0.55)");
  g.addColorStop(0.55, "rgba(255,255,255,0.12)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeStarTexture() {
  const size = 32;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const NODES = [
  { key: "web", label: "WEB", sub: "月面地图", href: "#map", az: Math.PI * 0.55, color: 0xeef2f7 },
  { key: "api", label: "REST API", sub: "GET /api/point", href: "#interface", az: Math.PI * 1.22, color: 0x7fd7ea },
  { key: "mcp", label: "MCP", sub: "POST /mcp", href: "#interface", az: Math.PI * 1.85, color: 0xffb361 },
];

export function initMoonScene({ canvas, labelLayer, reticle, reduced }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
  camera.position.set(0, 0, 5.1);

  // --- moon ---
  const moonGroup = new THREE.Group();
  scene.add(moonGroup);

  const moonGeo = new THREE.SphereGeometry(1, 128, 96);
  const moonUniforms = {
    uSunDir: { value: new THREE.Vector3(0.7, 0.5, 0.1).normalize() },
    uEarthDir: { value: new THREE.Vector3(-0.6, -0.2, 0.4).normalize() },
    uSunIntensity: { value: 1.0 },
    uTime: { value: 0 },
  };
  const moonMat = new THREE.ShaderMaterial({
    vertexShader: MOON_VERT,
    fragmentShader: MOON_FRAG,
    uniforms: moonUniforms,
  });
  const moon = new THREE.Mesh(moonGeo, moonMat);
  moonGroup.add(moon);

  // thin halo hugging the lit limb
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeGlowTexture(),
      color: 0xffc27a,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  halo.scale.set(2.4, 2.4, 1);
  halo.position.set(0, 0, -0.5);
  moonGroup.add(halo);

  // --- one interface orbit with three nodes ---
  const ORBIT_R = 1.34;
  const orbitGroup = new THREE.Group();
  orbitGroup.rotation.z = 0.30;
  orbitGroup.rotation.x = 0.10;
  moonGroup.add(orbitGroup);

  const ringPts = [];
  for (let i = 0; i <= 180; i++) {
    const a = (i / 180) * Math.PI * 2;
    ringPts.push(new THREE.Vector3(Math.cos(a) * ORBIT_R, 0, Math.sin(a) * ORBIT_R));
  }
  const orbitRing = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(ringPts),
    new THREE.LineBasicMaterial({ color: 0x9cb8cf, transparent: true, opacity: 0.07, depthWrite: false })
  );
  orbitGroup.add(orbitRing);

  const nodeMeshes = [];
  NODES.forEach((def) => {
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.019, 2),
      new THREE.MeshBasicMaterial({ color: def.color })
    );
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture(),
        color: def.color,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    sprite.scale.setScalar(0.2);
    core.add(sprite);
    orbitGroup.add(core);
    nodeMeshes.push({ def, core, angle: def.az });
  });

  // --- stars ---
  const starGeo = new THREE.BufferGeometry();
  const starCount = 1400;
  const pos = new Float32Array(starCount * 3);
  const col = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const r = 26 + Math.random() * 40;
    const t = Math.random() * Math.PI * 2;
    const p = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(p) * Math.cos(t);
    pos[i * 3 + 1] = r * Math.cos(p);
    pos[i * 3 + 2] = r * Math.sin(p) * Math.sin(t);
    const warm = Math.random();
    col[i * 3] = 0.72 + warm * 0.26;
    col[i * 3 + 1] = 0.78 + warm * 0.16;
    col[i * 3 + 2] = 0.9 + Math.random() * 0.1;
    sizes[i] = 0.35 + Math.random() * 1.15;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  starGeo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

  const starMat = new THREE.PointsMaterial({
    size: 0.5,
    map: makeStarTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // --- composer ---
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.62, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // --- sizing ---
  let width = 1;
  let height = 1;
  let baseOffsetX = 0.8;
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    camera.aspect = width / height;
    const narrow = width < 820;
    baseOffsetX = narrow ? 0.30 : width > 1200 ? 0.72 : 0.62;
    camera.fov = narrow ? 46 : 36;
    camera.position.z = narrow ? 5.6 : 5.3;
    camera.updateProjectionMatrix();
  }
  resize();

  // --- pointer / scroll ---
  const state = {
    px: 0,
    py: 0,
    tx: 0,
    ty: 0,
    scroll: 0,
    year: 0, // 0..1 across the year, drives the sun azimuth
    visible: true,
  };
  const onPointer = (e) => {
    state.tx = (e.clientX / window.innerWidth) * 2 - 1;
    state.ty = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener("pointermove", onPointer, { passive: true });

  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => (state.visible = en.isIntersecting)),
    { threshold: 0.02 }
  );
  io.observe(canvas);

  const labels = new Map();
  if (labelLayer) {
    NODES.forEach((def) => {
      const el = document.createElement("a");
      el.className = "node-label";
      el.dataset.node = def.key;
      el.href = def.href;
      el.innerHTML = `<i></i><span>${def.label}</span><small>${def.sub}</small>`;
      labelLayer.appendChild(el);
      labels.set(def.key, el);
    });
  }

  let raf = 0;
  let last = performance.now();
  const started = performance.now();

  function sunFromYear(t, azOffset) {
    // The south pole sun hugs the horizon; its azimuth walks a full circle in a year.
    const az = (t * Math.PI * 2 + azOffset) % (Math.PI * 2);
    const el = 0.03 + 0.012 * Math.sin(t * Math.PI * 4); // ~1.7 deg, tiny wobble
    const tan = Math.cos(el);
    const x = Math.cos(az) * tan;
    const y = Math.sin(az) * tan;
    const z = Math.sin(el);
    return new THREE.Vector3(x, y, z).normalize();
  }

  const _v = new THREE.Vector3();
  const _w = new THREE.Vector3();
  const _c = new THREE.Vector3();
  const _e = new THREE.Vector3();
  function update(dt, t) {
    state.px += (state.tx - state.px) * Math.min(1, dt * 3);
    state.py += (state.ty - state.py) * Math.min(1, dt * 3);

    const heroRect = canvas.parentElement.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, -heroRect.top / Math.max(1, heroRect.height)));
    state.scroll = progress;

    moonGroup.position.x = baseOffsetX + state.px * 0.05;
    moonGroup.position.y = state.py * -0.04 - progress * 0.35;
    moonGroup.rotation.y = t * 0.02 + state.px * 0.06;
    moonGroup.rotation.x = state.py * 0.03;

    const sun = sunFromYear(state.year + progress * 0.12, 2.3);
    moonUniforms.uSunDir.value.copy(sun);
    moonUniforms.uEarthDir.value.copy(new THREE.Vector3(-sun.x, -sun.y, 0.2).normalize());
    moonUniforms.uTime.value = t;
    halo.material.opacity = 0.18 + 0.08 * Math.sin(t * 0.6);

    // screen-space moon disc, used to hide labels that would sit on the sphere
    _c.copy(moonGroup.position).project(camera);
    const cx = (_c.x * 0.5 + 0.5) * width;
    const cy = (-_c.y * 0.5 + 0.5) * height;
    _e.copy(moonGroup.position).add(new THREE.Vector3(0, 1, 0)).project(camera);
    const radiusPx = Math.abs((-_e.y * 0.5 + 0.5) * height - cy);

    if (reticle) {
      const d = radiusPx * 2.24;
      reticle.style.width = `${d}px`;
      reticle.style.height = `${d}px`;
      reticle.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
    }

    nodeMeshes.forEach(({ def, core, angle }) => {
      const a = angle + t * 0.085;
      core.position.set(Math.cos(a) * ORBIT_R, 0, Math.sin(a) * ORBIT_R);
      core.rotation.y = a;
      const pulse = 0.75 + 0.25 * Math.sin(t * 1.4 + def.az * 3.0);
      core.children[0].material.opacity = 0.55 + 0.35 * pulse;
      core.children[0].scale.setScalar(0.2 * (0.9 + 0.2 * pulse));

      const el = labels.get(def.key);
      if (el) {
        const worldPos = core.getWorldPosition(_w);
        const depth = worldPos.z;
        worldPos.project(camera);
        const x = (worldPos.x * 0.5 + 0.5) * width;
        const y = (-worldPos.y * 0.5 + 0.5) * height;
        // keep every label readable: push it outside the moon disc if needed
        let lx = x;
        let ly = y;
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const minR = radiusPx * 1.14;
        let onDisc = false;
        if (dist < minR) {
          lx = cx + (dx / dist) * minR;
          ly = cy + (dy / dist) * minR;
          onDisc = true;
        }
        const behind = depth < moonGroup.position.z - 0.2 && onDisc;
        const flip = lx > width - 200;
        el.style.transform = `translate(${lx}px, ${ly}px) translate(${flip ? "calc(-100% - 14px)" : "14px"}, -50%)`;
        el.style.opacity = behind ? "0.78" : "1";
      }
    });

    stars.rotation.y = t * 0.004;
    stars.rotation.x = state.py * 0.02;

    camera.position.x = state.px * 0.12;
    camera.position.y = -state.py * 0.08 + progress * 0.25;
    camera.lookAt(0, 0, 0);
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (performance.now() - last) / 1000);
    last = performance.now();
    if (!state.visible && !reduced) return;
    const t = (performance.now() - started) / 1000;
    if (!reduced) {
      update(dt, t);
    } else {
      update(0, 0);
    }
    composer.render();
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  window.addEventListener("resize", resize);
  frame();

  // public: let the page sync the sun to the scrubbed year
  return {
    setYear(t) {
      state.year = t;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      io.disconnect();
      renderer.dispose();
    },
  };
}

