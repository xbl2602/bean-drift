import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CSM } from 'three/addons/csm/CSM.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { CFG, buildAll, makeHud, attachLook, forwardVec, pixelRatio, fbm3, earthPlacement, buildSphere, dirFromAzEl } from './common.js';
import { createTimeUI } from './timeui.js';

// quick A/B switches: ?tm=aces|agx|neutral  ?ls=0 (plain Lambert)  ?sun=<intensity>  ?ev=<exposure>  ?bloom=<strength>
const Q = new URLSearchParams(location.search);
const num = (k, d) => (Q.has(k) && Q.get(k) !== '' ? +Q.get(k) : d);

// window.__SITE (set by the page) or ?site=: 'pole' = south pole (lola.js, ?spot=a|b), 'apollo11' = equator (equator.js);
// anything else = the procedural scene. A loaded place ("lola" below) carries its camera, terrain options, sky and far-shadow grid.
const SITE = window.__SITE || Q.get('site');
const hudBase = `three.js r${THREE.REVISION} · WebGL2 · CSM + lunar BRDF + instanced rocks + bloom`;
const hud = makeHud(hudBase);
hud.set('building…');
let lola = null;
if (SITE === 'pole') lola = await (await import('./lola.js')).loadPole(Q.get('spot'), (t) => hud.set(t));
else if (SITE === 'apollo11') lola = await (await import('./equator.js')).loadApollo11(Q.get('spot'), (t) => hud.set(t));
if (lola) {
  Object.assign(CFG.camera, lola.camera); Object.assign(CFG.sun, lola.sun); Object.assign(CFG.earth, lola.earth);
  CFG.skyRadius = lola.skyRadius;
  if (Q.has('earth')) CFG.earth.angRad = +Q.get('earth');
  hud.setLabel(`three.js r${THREE.REVISION} · WebGL2 · ${lola.hudLabel} · CSM + lunar BRDF + instanced rocks + bloom`);
}
const data = await buildAll((t) => hud.set(t), lola ? lola.build : {});
hud.set('uploading…');

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(pixelRatio());
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = { aces: THREE.ACESFilmicToneMapping, agx: THREE.AgXToneMapping, neutral: THREE.NeutralToneMapping }[Q.get('tm') || 'agx'];
renderer.toneMappingExposure = num('ev', 1.0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CFG.camera.fov, innerWidth / innerHeight, CFG.camera.near, CFG.camera.far);
camera.position.set(...data.eye);

const geometry = (m) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(m.uvs, 2));
  if (m.tangents) g.setAttribute('tangent', new THREE.BufferAttribute(m.tangents, 4));
  if (m.colors) g.setAttribute('color', new THREE.BufferAttribute(m.colors, 3));
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  return g;
};
const texture = (cv, { srgb = true, repeat = false } = {}) => {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
};

// ---- lights ----
const sun = new THREE.Vector3(...data.sunDir);
const sunView = { value: new THREE.Vector3() };
const csm = new CSM({ maxFar: 420, cascades: 4, mode: 'practical', parent: scene, shadowMapSize: 2048, shadowBias: -0.0004, lightDirection: sun.clone().negate(), camera, lightIntensity: num('sun', 7) });
csm.lights.forEach((l) => { l.color.setRGB(1.0, 0.97, 0.92); l.shadow.normalBias = 0.04; });
const earthshine = new THREE.DirectionalLight(new THREE.Color(0.5, 0.66, 1.0), 0.25);
earthshine.position.set(...data.earthDir); scene.add(earthshine);
// bounce light from the sunlit regolith: keeps shadows from going pure black
const hemi = new THREE.HemisphereLight(new THREE.Color(0.62, 0.66, 0.78), new THREE.Color(0.5, 0.47, 0.44), num('fill', 0.55));
scene.add(hemi);

// ---- lunar regolith lighting ----
// Regolith is a very dark, rough, strongly BACK-scattering powder with almost no specular reflection:
//  - brightness barely depends on the angle between normal and sun (Lommel-Seeliger-like), unlike Lambert
//  - it depends strongly on the PHASE angle: brightest with the sun behind the viewer (opposition surge),
//    clearly darker when looking across or toward the sun, never glaring
// far-field horizon shadows: a lit mask over the loaded terrain (20 m cells at the pole, 8 m at the equator). It starts as the
// place's own first mask, then a worker recomputes it for the sun position of the current time (see the time block at the end).
let farTex = null;
if (lola) {
  const f = lola.far;
  farTex = new THREE.DataTexture(f.lit0, f.litW, f.litH, THREE.RedFormat, THREE.UnsignedByteType);
  farTex.unpackAlignment = 1; farTex.flipY = false; farTex.generateMipmaps = false; farTex.minFilter = farTex.magFilter = THREE.LinearFilter;
  farTex.wrapS = farTex.wrapT = THREE.ClampToEdgeWrapping; farTex.colorSpace = THREE.NoColorSpace; farTex.needsUpdate = true;
}
const farUniforms = farTex ? { uFarShadow: { value: farTex }, uFarBounds: { value: new THREE.Vector4(...lola.far.bounds, 0) }, uSunV: sunView } : null;
const FAR_FN = farTex ? `
uniform sampler2D uFarShadow; uniform vec4 uFarBounds; uniform vec3 uSunV; varying vec3 vWorldPos;
float farShadow(vec3 l) {                       // horizon shadows baked from the DEM; only applies to the sun
  if (dot(l, uSunV) < 0.9995) return 1.0;
  return texture2D(uFarShadow, (vWorldPos.xz - uFarBounds.xy) / uFarBounds.z).r;
}
` : 'float farShadow(vec3 l) { return 1.0; }';
const LUNAR_FN = FAR_FN + `
float lunarTerm(float mu0, vec3 n, vec3 v, vec3 l) {
  float mu = clamp(dot(n, v), 0.0, 1.0);
  float ls = 2.0 * mu0 / (mu0 + mu + 0.08);
  float lam = mix(mu0, ls, ${num('ls', 1) ? num('lsmix', 0.55) : '0.0'});
  float g = acos(clamp(dot(l, v), -1.0, 1.0));
  float ph = 0.30 + 0.70 * exp(-g / 0.80) + 0.30 * exp(-g / 0.07);
  return lam * ph * ${num('phase', 2.0).toFixed(3)};
}
`;
const lunar = (mat) => {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, r) => {
    if (prev) prev.call(mat, shader, r);
    const chunk = THREE.ShaderChunk.lights_physical_pars_fragment
      .replace('void RE_Direct_Physical(', LUNAR_FN + '\nvoid RE_Direct_Physical(')
      .replace('vec3 irradiance = dotNL * directLight.color;', 'vec3 irradiance = lunarTerm(dotNL, geometryNormal, geometryViewDir, directLight.direction) * directLight.color * farShadow(directLight.direction);')
      .replace('reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;', 'reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation * 0.0;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_pars_fragment>', chunk);
    // the 4 m tiling micro-normal-map is only meaningful close up: fade it out with distance so it cannot show as a pattern
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>',
      '#include <normal_fragment_maps>\n  normal = normalize(mix(normal, nonPerturbedNormal, smoothstep(40.0, 160.0, length(vViewPosition))));');
    if (farUniforms) {
      Object.assign(shader.uniforms, farUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'varying vec3 vWorldPos;\nvoid main() {')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vec4 wp_ = vec4(transformed, 1.0);\n  #ifdef USE_INSTANCING\n  wp_ = instanceMatrix * wp_;\n  #endif\n  vWorldPos = (modelMatrix * wp_).xyz;');
    }
  };
  mat.customProgramCacheKey = () => (farUniforms ? 'lunar-far' : 'lunar');
};

// ---- terrain ----
const microAlbedo = texture(data.micro.albedo, { repeat: true }), microNormal = texture(data.micro.normal, { srgb: false, repeat: true });
const terrainMat = new THREE.MeshStandardMaterial({ map: microAlbedo, normalMap: microNormal, vertexColors: true, roughness: 1, metalness: 0 });
csm.setupMaterial(terrainMat); lunar(terrainMat);
const terrain = new THREE.Mesh(geometry(data.terrain), terrainMat);
terrain.castShadow = terrain.receiveShadow = true; terrain.frustumCulled = false;
scene.add(terrain);

// ---- rocks and pebbles: instanced, flat-shaded, faceted ----
const rockGeometry = (detail, seed) => {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4);                                 // shared vertices => smooth base normals
  const pos = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const a = fbm3(v.x * 1.6 + seed, v.y * 1.6, v.z * 1.6, 3, 7), b = fbm3(v.x * 4.5 + seed, v.y * 4.5, v.z * 4.5, 3, 9);
    const r = 1 + 0.40 * (a - 0.5) * 2 + 0.16 * (1 - Math.abs(2 * b - 1)) - 0.08;   // ridged term gives angular edges
    pos.setXYZ(i, v.x * r, v.y * r * 0.78, v.z * r);
  }
  g.computeVertexNormals();
  g = g.toNonIndexed();
  const P = g.attributes.position, N = g.attributes.normal, uv = new Float32Array(P.count * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fn = new THREE.Vector3(), sn = new THREE.Vector3();
  for (let i = 0; i < P.count; i += 3) {
    a.fromBufferAttribute(P, i); b.fromBufferAttribute(P, i + 1); c.fromBufferAttribute(P, i + 2);
    fn.subVectors(c, b).cross(sn.subVectors(a, b)).normalize();
    const ax = Math.abs(fn.x), ay = Math.abs(fn.y), az = Math.abs(fn.z);
    for (let k = 0; k < 3; k++) {
      const x = P.getX(i + k), y = P.getY(i + k), z = P.getZ(i + k);
      const [u, w] = ay >= ax && ay >= az ? [x, z] : ax >= az ? [y, z] : [x, y];
      uv[(i + k) * 2] = u * 0.9; uv[(i + k) * 2 + 1] = w * 0.9;
      sn.fromBufferAttribute(N, i + k).multiplyScalar(0.42).addScaledVector(fn, 0.58).normalize();   // part smooth, part faceted
      N.setXYZ(i + k, sn.x, sn.y, sn.z);
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
};
const rockMat = new THREE.MeshStandardMaterial({ map: microAlbedo, normalMap: microNormal, color: new THREE.Color(0.5, 0.49, 0.47), roughness: 1, metalness: 0 });
csm.setupMaterial(rockMat); lunar(rockMat);
const instanced = (arr, geo) => {
  const n = arr.length / 10, im = new THREE.InstancedMesh(geo, rockMat, n);
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  for (let i = 0; i < n; i++) { const o = i * 10; p.set(arr[o], arr[o + 1], arr[o + 2]); q.set(arr[o + 3], arr[o + 4], arr[o + 5], arr[o + 6]); s.set(arr[o + 7], arr[o + 8], arr[o + 9]); im.setMatrixAt(i, m.compose(p, q, s)); }
  im.castShadow = im.receiveShadow = true; im.frustumCulled = false;
  scene.add(im);
  return im;
};
instanced(data.rocks, rockGeometry(3, 3.1));
instanced(data.pebbles, rockGeometry(2, 8.7));

// ---- earth: surface (night side lit by city lights) + thin atmosphere shell + soft outer halo ----
const earthMat = new THREE.MeshStandardMaterial({
  map: texture(data.earthTex.albedo), roughness: 0.55, metalness: 0, color: new THREE.Color().setScalar(CFG.earthTint * 0.8),
  emissiveMap: texture(data.earthTex.lights), emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 1.6,
});
earthMat.onBeforeCompile = (shader) => {
  shader.uniforms.uSunView = sunView;
  shader.fragmentShader = shader.fragmentShader
    .replace('void main() {', 'uniform vec3 uSunView;\nvoid main() {')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= 1.0 - smoothstep(-0.08, 0.22, dot(normal, uSunView));');
};
earthMat.customProgramCacheKey = () => 'earth';
const earth = new THREE.Mesh(geometry(data.earth), earthMat);
const clouds = new THREE.Mesh(geometry(data.clouds), new THREE.MeshStandardMaterial({ alphaMap: texture(data.earthTex.cloudAlpha, { srgb: false }), transparent: true, depthWrite: false, roughness: 1, color: new THREE.Color().setScalar(0.9) }));
const place = earthPlacement();
const shell = new THREE.Mesh(geometry(buildSphere({ radius: place.radius * 1.024, center: place.center, lonSeg: 128, latSeg: 64 })), new THREE.ShaderMaterial({
  uniforms: { uSun: { value: sun.clone() } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: `uniform vec3 uSun; varying vec3 vN; varying vec3 vW;
    void main(){ vec3 V = normalize(cameraPosition - vW); float f = pow(1.0 - clamp(dot(vN, V), 0.0, 1.0), 2.6);
      float lit = clamp(dot(vN, uSun) * 1.3 + 0.18, 0.0, 1.0); gl_FragColor = vec4(vec3(0.30, 0.55, 1.0) * f * lit * 3.0, 1.0); }`,
}));
const glow = new THREE.Mesh(geometry(data.glow.mesh), new THREE.MeshBasicMaterial({ map: texture(data.glow.texture), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
glow.material.color.setScalar(0.5);
// everything at astronomical distance (Earth, stars, Sun) rides in a group that follows the camera: centred on the world origin
// they sat ~1.3 deg too low whenever the camera stood 1.3 km above it (the pole is at +1293 m)
const skyGroup = new THREE.Group();
scene.add(skyGroup);
skyGroup.add(earth, clouds, shell, glow);

// ---- sky ----
const sky = new THREE.Mesh(geometry(data.sky), new THREE.MeshBasicMaterial({ map: texture(data.stars), depthWrite: false, fog: false }));
sky.material.color.setScalar(1.4); sky.renderOrder = -10; sky.frustumCulled = false;
skyGroup.add(sky);

// ---- the sun: a real disc (0.27 deg) far brighter than anything else, so bloom produces the glare ----
const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(CFG.skyRadius * 0.95 * Math.tan(0.267 * Math.PI / 180), 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(60, 56, 48), depthWrite: false, fog: false }));
sunDisc.position.copy(sun).multiplyScalar(CFG.skyRadius * 0.95); sunDisc.lookAt(0, 0, 0); sunDisc.renderOrder = -9; sunDisc.frustumCulled = false;
skyGroup.add(sunDisc);

// ---- post: HDR half-float MSAA target -> bloom -> tone map (OutputPass) -> vignette + grain ----
const size = new THREE.Vector2();
renderer.getDrawingBufferSize(size);
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 }));
composer.setPixelRatio(pixelRatio()); composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), num('bloom', 0.22), 0.5, 1.1);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; vec2 q = vUv-0.5; float v = smoothstep(0.95, 0.25, length(q*vec2(1.15,1.0)));
      c *= mix(0.6, 1.0, v); c += (h(vUv*1000.0+time)-0.5)*0.02; gl_FragColor = vec4(c,1.0); }`,
});
composer.addPass(grade);

// ---- camera control ----
const view = { yaw: CFG.camera.yaw, pitch: CFG.camera.pitch, fov: CFG.camera.fov };
const aim = () => {
  const f = forwardVec(view.yaw, view.pitch);
  camera.fov = view.fov; camera.updateProjectionMatrix();
  camera.lookAt(camera.position.x + f[0], camera.position.y + f[1], camera.position.z + f[2]);
  camera.updateMatrixWorld(); csm.updateFrustums();
  skyGroup.position.copy(camera.position);
  sunView.value.copy(sun).transformDirection(camera.matrixWorldInverse);
};
aim();
attachLook(renderer.domElement, view, aim);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; aim(); });

// ---- time: Sun, Earth and stars follow a real ephemeris (ephemeris.js); timeui.js is the multi-scale slider ----
let timeApi = null;
if (lola) {
  const parseT = (s) => Date.parse(s.trim().replace(' ', 'T') + (/[zZ]$|[+-]\d\d:?\d\d$/.test(s.trim()) ? '' : 'Z'));
  const T0 = Q.has('t') && Number.isFinite(parseT(Q.get('t'))) ? parseT(Q.get('t')) : lola.defaultT;
  const horizonArr = lola.horizon;
  const sunBase = num('sun', 7), fillBase = num('fill', 0.55);

  // far-field shadows are recomputed in a worker whenever the sun moves: one request in flight, then the newest direction
  const worker = new Worker('./shadowWorker.js', { type: 'module' });
  let workerReady = false, inflight = false, want = null, farId = 0;
  const sendFar = () => { if (!workerReady || inflight || !want) return; inflight = true; worker.postMessage({ type: 'shadow', id: ++farId, az: want.az, el: want.el }); want = null; };
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'ready') { workerReady = true; sendFar(); }
    else if (m.type === 'shadow') { farTex.image.data = m.lit; farTex.needsUpdate = true; inflight = false; window.__farMs = m.ms; window.__farId = m.id; sendFar(); }
  };
  const dem = lola.far.dem.slice();
  worker.postMessage({ type: 'init', dem, n: lola.far.n, px: lola.far.px, x0: lola.far.x0, z0: lola.far.z0 }, [dem.buffer]);

  // the Earth meshes were built around a fixed spot in the sky: move them with a matrix instead of rebuilding
  const D2R = Math.PI / 180;
  const e0 = new THREE.Vector3(...place.dir), c0 = e0.clone().multiplyScalar(CFG.earth.dist);
  const enlarge = CFG.earth.angRad / 0.95;                    // the scene draws the Earth ~1.7x its true size so it reads at 46 deg fov
  const tiltAxis = new THREE.Vector3(-Math.sin(23.4 * D2R), Math.cos(23.4 * D2R), 0);
  const sun0 = new THREE.Vector3(...data.sunDir);
  const n0 = e0.clone().negate(), r0 = new THREE.Vector3(0, 1, 0).cross(n0).normalize(), u0 = n0.clone().cross(r0);
  const glowAng0 = Math.atan2(sun0.dot(u0), sun0.dot(r0));
  [earth, clouds, shell, glow].forEach((m) => { m.matrixAutoUpdate = false; });
  const MT = (v) => new THREE.Matrix4().makeTranslation(v.x, v.y, v.z);
  const about = (axis, ang) => MT(c0).multiply(new THREE.Matrix4().makeRotationAxis(axis, ang)).multiply(MT(c0.clone().negate()));
  const toM4 = (m) => new THREE.Matrix4().set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1);
  const R0T = toM4(lola.sky(T0).R).transpose();   // the star texture is authored for T0
  const zAxis = new THREE.Vector3(0, 0, 1), clamp01 = (v) => Math.min(1, Math.max(0, v));

  const apply = (ms) => {
    const loc = lola.sky(ms);
    sun.set(...loc.sun.dir);
    csm.lightDirection.set(...dirFromAzEl(loc.sun.az, Math.min(loc.sun.el, 89.3))).negate();   // a light straight overhead has no usable shadow-camera 'up'
    const up = (b) => clamp01((b.el - horizonArr[Math.floor(b.az) % 360] + 0.3) / 0.6);   // 0 hidden .. 1 clear of the terrain horizon
    const sunUp = up(loc.sun), earthUp = up(loc.earth);
    csm.lights.forEach((l) => { l.intensity = sunBase; });             // stays on at night: it lights the Earth, and the ground faces away from it
    hemi.intensity = fillBase * (0.3 + 0.7 * sunUp);                   // bounce light mostly vanishes when the sun does not reach the ground
    earthshine.position.set(...loc.earth.dir);
    earthshine.intensity = 0.6 * (0.08 + 0.92 * loc.earth.illum) * (0.2 + 0.8 * earthUp);   // far brighter than reality (~1e-6 of sunlight) so the night side is readable
    sunDisc.position.copy(sun).multiplyScalar(CFG.skyRadius * 0.95);
    sunDisc.quaternion.setFromUnitVectors(zAxis, sun.clone().negate());
    shell.material.uniforms.uSun.value.copy(sun);
    const e1 = new THREE.Vector3(...loc.earth.dir), q = new THREE.Quaternion().setFromUnitVectors(e0, e1);
    const s = Math.sin(loc.earth.angDeg * enlarge * D2R) / Math.sin(CFG.earth.angRad * D2R);
    const base = new THREE.Matrix4().compose(e1.clone().multiplyScalar(CFG.earth.dist), q, new THREE.Vector3(s, s, s)).multiply(MT(c0.clone().negate()));
    earth.matrix.copy(base).multiply(about(tiltAxis, (ms - T0) / 86400000 * 360.9856 * D2R));   // Earth's own rotation (the texture is procedural)
    clouds.matrix.copy(earth.matrix); shell.matrix.copy(base);
    const r1 = r0.clone().applyQuaternion(q), u1 = u0.clone().applyQuaternion(q);
    glow.matrix.copy(base).multiply(about(n0, Math.atan2(sun.dot(u1), sun.dot(r1)) - glowAng0));   // turn the lit side of the halo with the Sun
    glow.material.color.setScalar(0.5 * (0.35 + 0.65 * loc.earth.illum));
    [earth, clouds, shell, glow].forEach((m) => { m.matrixWorldNeedsUpdate = true; });
    sky.quaternion.setFromRotationMatrix(toM4(loc.R).multiply(R0T));                              // the stars turn with the Moon
    sky.material.color.setScalar(1.4 * lola.starGain(loc.sun.el));                                // ...and wash out when the Sun is high
    renderer.toneMappingExposure = num('ev', 1.0) * lola.exposure(loc.sun.el);
    aim();                                                                                         // refreshes the sun direction the shaders use
    want = lola.shadowSun(ms); sendFar();
    window.__sky = { t: ms, sun: loc.sun, earth: loc.earth, sunUp, earthUp };
  };
  timeApi = createTimeUI({ t0: T0, getSky: lola.sky, horizon: horizonArr, label: lola.label, elRange: lola.elRange, onTime: (ms) => { const t = performance.now(); apply(ms); window.__applyMs = performance.now() - t; } });
}

window.__dbg = { renderer, composer, scene, camera, csm, bloom, view, aim, time: timeApi, site: lola, data };
let n = 0;
renderer.setAnimationLoop((t) => {
  grade.uniforms.time.value = (t * 0.001) % 10;
  csm.update();
  composer.render();
  hud.frame();
  if (++n === 3) { window.__ready = true; hud.set('ready'); }
});
