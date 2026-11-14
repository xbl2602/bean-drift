import { CFG, buildAll, makeHud, attachLook, forwardVec, pixelRatio } from '../common.js';

const B = window.BABYLON;
const hud = makeHud(`Babylon.js ${B.Engine.Version} · WebGL2 · CSM + DefaultRenderingPipeline + ACES`);
hud.set('building…');
const data = await buildAll((s) => hud.set(s));
hud.set('uploading…');

const canvas = document.getElementById('c');
const engine = new B.Engine(canvas, false, { powerPreference: 'high-performance', stencil: false }, true);
engine.setHardwareScalingLevel(1 / pixelRatio());
const scene = new B.Scene(engine);
scene.useRightHandedSystem = true;
scene.clearColor = new B.Color4(0, 0, 0, 1);

const camera = new B.FreeCamera('cam', new B.Vector3(...data.eye), scene);
camera.minZ = CFG.camera.near; camera.maxZ = CFG.camera.far; camera.inputs.clear();

const mesh = (name, m) => {
  const me = new B.Mesh(name, scene), vd = new B.VertexData();
  vd.positions = m.positions; vd.normals = m.normals; vd.uvs = m.uvs; vd.indices = m.indices;
  vd.applyToMesh(me, false);
  me.alwaysSelectAsActiveMesh = true;
  return me;
};
const texture = (cv, { repeat = false, linear = false } = {}) => {
  const t = new B.DynamicTexture('t', cv, scene, true, B.Texture.TRILINEAR_SAMPLINGMODE, B.Constants.TEXTUREFORMAT_RGBA, true);
  t.update(true);
  if (repeat) t.wrapU = t.wrapV = B.Texture.WRAP_ADDRESSMODE; else t.wrapU = t.wrapV = B.Texture.CLAMP_ADDRESSMODE;
  t.anisotropicFilteringLevel = 16;
  if (linear) t.gammaSpace = false;
  return t;
};

// ---- lights ----
const sunDir = new B.Vector3(...data.sunDir);
const sun = new B.DirectionalLight('sun', sunDir.scale(-1), scene);
sun.intensity = 14.0; sun.diffuse = new B.Color3(1.0, 0.97, 0.92); sun.specular = new B.Color3(1.0, 0.97, 0.92);
const earthshine = new B.DirectionalLight('earthshine', new B.Vector3(...data.earthDir).scale(-1), scene);
earthshine.intensity = 0.22; earthshine.diffuse = new B.Color3(0.5, 0.66, 1.0); earthshine.specular = B.Color3.Black();

// ---- terrain ----
const terrainMat = new B.PBRMaterial('terrain', scene);
terrainMat.albedoTexture = texture(data.micro.albedo, { repeat: true });
terrainMat.bumpTexture = texture(data.micro.normal, { repeat: true, linear: true });
terrainMat.invertNormalMapY = true;                 // our map is OpenGL-style (+Y up) and the scene is right-handed
terrainMat.sideOrientation = B.Material.CounterClockWiseSideOrientation;   // our index order is CCW (three.js convention)
terrainMat.metallic = 0; terrainMat.roughness = 1;
terrainMat.environmentIntensity = 0;
const terrain = mesh('terrain', data.terrain);
terrain.material = terrainMat; terrain.receiveShadows = true;

const csm = new B.CascadedShadowGenerator(2048, sun);
csm.numCascades = 4; csm.stabilizeCascades = true; csm.lambda = 0.85; csm.shadowMaxZ = 420;
csm.cascadeBlendPercentage = 0.05; csm.autoCalcDepthBounds = true;
csm.filter = B.ShadowGenerator.FILTER_PCF; csm.filteringQuality = B.ShadowGenerator.QUALITY_MEDIUM;
csm.bias = 0.0008; csm.normalBias = 0.02;
csm.addShadowCaster(terrain);

// ---- earth ----
const earthMat = new B.PBRMaterial('earth', scene);
earthMat.albedoTexture = texture(data.earthTex.albedo);
earthMat.albedoColor = new B.Color3(CFG.earthTint, CFG.earthTint, CFG.earthTint);
earthMat.sideOrientation = B.Material.CounterClockWiseSideOrientation;
earthMat.metallic = 0; earthMat.roughness = 0.55; earthMat.environmentIntensity = 0;
mesh('earth', data.earth).material = earthMat;

const cloudMat = new B.PBRMaterial('clouds', scene);
cloudMat.albedoTexture = texture(data.earthTex.clouds);
cloudMat.albedoTexture.hasAlpha = true; cloudMat.useAlphaFromAlbedoTexture = true;
cloudMat.transparencyMode = B.PBRMaterial.PBRMATERIAL_ALPHABLEND; cloudMat.disableDepthWrite = true;
cloudMat.sideOrientation = B.Material.CounterClockWiseSideOrientation;
cloudMat.metallic = 0; cloudMat.roughness = 1; cloudMat.environmentIntensity = 0;
mesh('clouds', data.clouds).material = cloudMat;

const glowMat = new B.PBRMaterial('glow', scene);
glowMat.unlit = true; glowMat.albedoTexture = texture(data.glow.texture);
glowMat.albedoColor = new B.Color3(0.55, 0.55, 0.55);
glowMat.alpha = 0.999; glowMat.transparencyMode = B.PBRMaterial.PBRMATERIAL_ALPHABLEND;
glowMat.alphaMode = B.Constants.ALPHA_ONEONE; glowMat.disableDepthWrite = true; glowMat.backFaceCulling = false;
mesh('glow', data.glow.mesh).material = glowMat;

// ---- sky ----
const skyMat = new B.PBRMaterial('sky', scene);
skyMat.unlit = true; skyMat.albedoTexture = texture(data.stars);
skyMat.albedoColor = new B.Color3(1.1, 1.1, 1.1);
skyMat.disableDepthWrite = true; skyMat.backFaceCulling = false;
const sky = mesh('sky', data.sky); sky.material = skyMat; sky.renderingGroupId = 0; sky.infiniteDistance = true;

// ---- post: HDR + MSAA -> bloom -> ACES -> vignette + grain ----
const pipe = new B.DefaultRenderingPipeline('pipe', true, scene, [camera]);
pipe.samples = 4; pipe.fxaaEnabled = false;
pipe.bloomEnabled = true; pipe.bloomThreshold = 1.05; pipe.bloomWeight = 0.5; pipe.bloomKernel = 64; pipe.bloomScale = 0.5;
pipe.imageProcessingEnabled = true;
const ip = pipe.imageProcessing;
ip.toneMappingEnabled = true; ip.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES; ip.exposure = 1.0;
ip.vignetteEnabled = true; ip.vignetteWeight = 2.0; ip.vignetteStretch = 0.4; ip.vignetteColor = new B.Color4(0, 0, 0, 0);
pipe.grainEnabled = true; pipe.grain.intensity = 6; pipe.grain.animated = true;

// ---- camera control ----
const view = { yaw: CFG.camera.yaw, pitch: CFG.camera.pitch, fov: CFG.camera.fov };
const aim = () => {
  const f = forwardVec(view.yaw, view.pitch), p = camera.position;
  camera.fov = view.fov * Math.PI / 180;
  camera.setTarget(new B.Vector3(p.x + f[0], p.y + f[1], p.z + f[2]));
};
aim();
attachLook(canvas, view, aim);
addEventListener('resize', () => engine.resize());

window.__dbg = { engine, scene, pipe, csm };
let n = 0;
engine.runRenderLoop(() => {
  scene.render(); hud.frame();
  if (++n === 4) { window.__ready = true; hud.set('ready'); }
});
