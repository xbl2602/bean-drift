import * as pc from '../node_modules/playcanvas/build/playcanvas.min.mjs';
import { CFG, buildAll, makeHud, attachLook, forwardVec, pixelRatio } from '../common.js';

const hud = makeHud(`PlayCanvas ${pc.version} · WebGL2 · cascaded shadows + CameraFrame + ACES`);
hud.set('building…');
const data = await buildAll((s) => hud.set(s));
hud.set('uploading…');

const canvas = document.getElementById('c');
const device = await pc.createGraphicsDevice(canvas, { deviceTypes: ['webgl2'], antialias: false });
device.maxPixelRatio = pixelRatio();
const app = new pc.Application(canvas, { graphicsDevice: device });
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.scene.ambientLight = new pc.Color(0, 0, 0);
addEventListener('resize', () => app.resizeCanvas());

const toVec = (a) => new pc.Vec3(a[0], a[1], a[2]);
const meshOf = (m) => {
  const mesh = new pc.Mesh(device);
  mesh.setPositions(m.positions); mesh.setNormals(m.normals); mesh.setUvs(0, m.uvs); mesh.setIndices(m.indices);
  if (m.tangents) { const t = pc.calculateTangents(m.positions, m.normals, m.uvs, m.indices); mesh.setVertexStream(pc.SEMANTIC_TANGENT, t, t.length / (m.positions.length / 3)); }
  mesh.update(pc.PRIMITIVE_TRIANGLES);
  return mesh;
};
const entityOf = (name, m, material, { shadows = false } = {}) => {
  const mi = new pc.MeshInstance(meshOf(m), material);
  mi.castShadow = mi.receiveShadow = shadows; mi.cull = false;
  const e = new pc.Entity(name);
  e.addComponent('render', { meshInstances: [mi], castShadows: shadows, receiveShadows: shadows });
  app.root.addChild(e);
  return e;
};
const texture = (cv, { srgb = true, repeat = false } = {}) => {
  const t = new pc.Texture(device, {
    name: 'tex', width: cv.width, height: cv.height, format: srgb ? pc.PIXELFORMAT_SRGBA8 : pc.PIXELFORMAT_RGBA8,
    mipmaps: true, minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR, magFilter: pc.FILTER_LINEAR, anisotropy: 16, flipY: true,
    addressU: repeat ? pc.ADDRESS_REPEAT : pc.ADDRESS_CLAMP_TO_EDGE, addressV: repeat ? pc.ADDRESS_REPEAT : pc.ADDRESS_CLAMP_TO_EDGE,
  });
  t.setSource(cv);
  return t;
};
const lookDown = (e, dir) => {                      // directional lights shine along local -Y
  const from = new pc.Vec3(0, -1, 0), to = toVec(dir).normalize(), axis = new pc.Vec3().cross(from, to);
  const ang = Math.acos(Math.max(-1, Math.min(1, from.dot(to)))) * pc.math.RAD_TO_DEG;
  e.setRotation(axis.length() < 1e-6 ? new pc.Quat() : new pc.Quat().setFromAxisAngle(axis.normalize(), ang));
};

// ---- lights ----
const sun = new pc.Entity('sun');
sun.addComponent('light', {
  type: 'directional', color: new pc.Color(1.0, 0.97, 0.92), intensity: 7.0, castShadows: true,
  shadowResolution: 2048, numCascades: 4, shadowDistance: 420, cascadeDistribution: 0.65, cascadeBlend: 0.1,
  shadowType: pc.SHADOW_PCF3_32F, shadowBias: 0.08, normalOffsetBias: 0.04,
});
lookDown(sun, data.sunDir.map((c) => -c)); app.root.addChild(sun);
const earthshine = new pc.Entity('earthshine');
earthshine.addComponent('light', { type: 'directional', color: new pc.Color(0.5, 0.66, 1.0), intensity: 0.11, castShadows: false });
lookDown(earthshine, data.earthDir.map((c) => -c)); app.root.addChild(earthshine);

// ---- terrain ----
const terrainMat = new pc.StandardMaterial();
terrainMat.diffuse = new pc.Color(1, 1, 1); terrainMat.diffuseMap = texture(data.micro.albedo, { repeat: true });
terrainMat.normalMap = texture(data.micro.normal, { srgb: false, repeat: true }); terrainMat.bumpiness = 1;
terrainMat.diffuseMapTiling = new pc.Vec2(1, 1);
terrainMat.useMetalness = true; terrainMat.metalness = 0; terrainMat.gloss = 0;
terrainMat.update();
entityOf('terrain', data.terrain, terrainMat, { shadows: true });

// ---- earth ----
const earthMat = new pc.StandardMaterial();
earthMat.diffuse = new pc.Color(CFG.earthTint, CFG.earthTint, CFG.earthTint); earthMat.diffuseMap = texture(data.earthTex.albedo);
earthMat.useMetalness = true; earthMat.metalness = 0; earthMat.gloss = 0.45; earthMat.update();
entityOf('earth', data.earth, earthMat);

const cloudMat = new pc.StandardMaterial();
cloudMat.diffuse = new pc.Color(1, 1, 1); cloudMat.opacityMap = texture(data.earthTex.clouds); cloudMat.opacityMapChannel = 'a';
cloudMat.blendType = pc.BLEND_NORMAL; cloudMat.depthWrite = false; cloudMat.useMetalness = true; cloudMat.metalness = 0; cloudMat.gloss = 0; cloudMat.update();
entityOf('clouds', data.clouds, cloudMat);

const glowMat = new pc.StandardMaterial();
glowMat.useLighting = false; glowMat.diffuse = new pc.Color(0, 0, 0);
glowMat.emissive = new pc.Color(0.9, 0.9, 0.9); glowMat.emissiveMap = texture(data.glow.texture);
glowMat.blendType = pc.BLEND_ADDITIVE; glowMat.depthWrite = false; glowMat.cull = pc.CULLFACE_NONE; glowMat.update();
entityOf('glow', data.glow.mesh, glowMat);

// ---- sky ----
const skyMat = new pc.StandardMaterial();
skyMat.useLighting = false; skyMat.diffuse = new pc.Color(0, 0, 0);
skyMat.emissive = new pc.Color(1.1, 1.1, 1.1); skyMat.emissiveMap = texture(data.stars);
skyMat.depthWrite = false; skyMat.cull = pc.CULLFACE_NONE; skyMat.update();
entityOf('sky', data.sky, skyMat);

// ---- camera + post: HDR + MSAA -> bloom -> ACES -> vignette ----
const cam = new pc.Entity('cam');
cam.addComponent('camera', { fov: CFG.camera.fov, nearClip: CFG.camera.near, farClip: CFG.camera.far, clearColor: new pc.Color(0, 0, 0, 1) });
cam.setPosition(...data.eye); app.root.addChild(cam);
const frame = new pc.CameraFrame(app, cam.camera);
frame.rendering.toneMapping = pc.TONEMAP_ACES; frame.rendering.samples = 4;
frame.bloom.intensity = 0.05; frame.bloom.blurLevel = 14; frame.bloom.threshold = 1.0;
frame.vignette.intensity = 0.8; frame.vignette.inner = 0.35; frame.vignette.outer = 1.1; frame.vignette.curvature = 0.6;
frame.update();

// ---- camera control ----
const view = { yaw: CFG.camera.yaw, pitch: CFG.camera.pitch, fov: CFG.camera.fov };
const aim = () => {
  const f = forwardVec(view.yaw, view.pitch), p = cam.getPosition();
  cam.camera.fov = view.fov;
  cam.lookAt(p.x + f[0], p.y + f[1], p.z + f[2]);
};
aim();
attachLook(canvas, view, aim);

window.__dbg = { app, device, cam, frame, pc };
let n = 0;
app.on('update', () => { hud.frame(); if (++n === 4) { window.__ready = true; hud.set('ready'); } });
app.start();
