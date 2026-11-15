// 第一人称场景的搭建（不含 React）：真实 LOLA 地形 + 真实时刻的太阳/地球 + 太阳投下的地形阴影。
// 时间一变，太阳方向跟着变，阴影贴图随之重算，所以阴影随时间移动、方向由太阳决定（时间没变、只是转头时不重算）。
// 地形按"扇形 × 环带"切成块：背后和视野外的块不画（见 terrain-patch.ts）。
import * as THREE from "three";
import { decodeTexture } from "../imagery/decode-texture";
import { MOON_RADIUS_M } from "../moon-assets";
import { MOON_TEXTURES, SKY_TEXTURES } from "../moon-texture-urls";
import { fetchTextureBlob } from "../preload/texture-blob-cache";
import { azElToLocal, type LatLon } from "../moon-frames";
import { skyConditionsAt } from "../sky-conditions";
import { createStarfield, updateStarfield } from "../starfield";
import { loadNearbyCraters, type RealCrater } from "./crater-catalog";
import { createGroundMaterial, sampleGroundAlbedo } from "./ground-material";
import { createRockField } from "./rock-field";
import { loadHeightField } from "./height-tiles";
import { createEarth, fallbackEarthTexture, orientEarth, sizeEarth } from "./earth-sky";
import { createSkyPaths } from "./sky-paths";
import { createSun, placeInSky, SKY_DISTANCE_M } from "./sky-objects";
import { createTerrainDetail } from "./terrain-detail";
import { buildTerrainPatch } from "./terrain-patch";
import type { FeetPosition } from "./walk-motion";

/** 地形块半径 200 km：站高 10 km 时地平线约在 186 km 处，仍在块内。 */
export const PATCH_RADIUS_M = 200_000;
/** 用真实撞击坑数据的范围：再远的坑，网格太粗，画不出来。 */
export const REAL_CRATER_RADIUS_M = 30_000;
const SUN_LIGHT_DISTANCE_M = 400_000;
/** 阴影贴图覆盖范围 = 到地平线距离的这么多倍（上下限见下）。范围越小，近处阴影越清晰。 */
const SHADOW_HORIZON_FACTOR = 3;
const SHADOW_MIN_HALF_M = 2_500;

export interface SkyState {
  sunAzimuthDeg: number;
  sunElevationDeg: number;
  earthAzimuthDeg: number;
  earthElevationDeg: number;
}

export interface FirstPersonScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  groundHeightM: number;
  /** 按时间更新太阳、地球、阴影方向；返回当时的方位角/高度角。 */
  setTime: (timeMs: number) => SkyState;
  /**
   * 自动曝光：太阳在背后/被地形挡住/已经落下、画面里没有直射阳光时，把曝光和对比度往上调，让月面还是看得清。
   * dtS 是距上一帧的秒数；返回 true 表示曝光还在渐变，下一帧要接着画。
   */
  updateLighting: (yawDeg: number, dtS: number) => boolean;
  /** 阴影贴图自上次取走后是否需要重画（太阳方向变了，或阴影范围重新收放过、人走动了）。取走即清零。 */
  takeShadowDirty: () => boolean;
  /** yaw 是罗盘方位（度），pitch 是仰角（度），eyeHeightM 是眼睛离地高度。 */
  /** feet：走动后脚下的位置（离着陆点往东、往北多少米，和那里的地面高度 y）；不给就站在着陆点。 */
  setView: (yawDeg: number, pitchDeg: number, eyeHeightM: number, feet?: FeetPosition) => void;
  /** 地面在 (east, north) 处的高度 y（米，本地坐标）。 */
  surfaceYAt: (eastM: number, northM: number) => number;
  /** 着陆点脚下的地面高度 y（本地坐标）。 */
  startGroundYM: number;
  dispose: () => void;
}

/** 第一人称的渲染设置（实时画面和对比表里的快照共用，保证两边看起来一样）。 */
export function configureFirstPersonRenderer(renderer: THREE.WebGLRenderer) {
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // 月面没有大气，阳光下的地面比 ACES 默认曝光亮得多；提高曝光，让低太阳角下的地面也看得清
  // 对照阿波罗 15 号的真实照片：阳光下的月壤是明亮的浅灰色，影子是纯黑，所以曝光要再高一些
  renderer.toneMappingExposure = BASE_EXPOSURE;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

/** 开场朝向：太阳在侧面（方位 +90°），阴影横穿画面最明显；太阳在地平线下就看向地球。 */
export function openingYawDeg(center: LatLon, timeMs: number): number {
  const c = skyConditionsAt(center, timeMs);
  return c.sun.elevationDeg > 0 ? (c.sun.azimuthDeg + 90) % 360 : c.earth.azimuthDeg;
}
export const OPENING_PITCH_DEG = -4;

/**
 * 曝光 = 基准 × 测光补偿，像相机的自动曝光 / 人眼的明暗适应：
 *   先估计"这里的地面大概有多亮"= 当地反照率（从底图读，见 sampleGroundAlbedo）× 照到地面的光（太阳 + 地球光 + 底光），
 *   再和基准场景（反照率 0.12 的平地、太阳高 45°）比，按比例的一部分补回来：补偿 = (基准亮度 / 估计亮度)^K。
 * K 越大补得越多：白天 K = 0.3（只补一点：太阳低时仍然更暗、影子更长，暗的月海仍比亮的撞击坑暗，像阿波罗的固定曝光照片）；
 * 夜里 K = 0.9（眼睛适应黑暗：地球光比阳光弱得多，不补的话 ACES 曲线的暗部会把画面压成全黑）。
 * 基准：反照率 0.15 的平地、太阳高 45°、侧光时，画面上是中灰（sRGB 约 125，和阿波罗照片里阳光下的月壤差不多）。
 */
const BASE_EXPOSURE = 1.55;
const SUN_INTENSITY = 3.4;
const METER_K_DAY = 0.3;
const METER_K_NIGHT = 0.9;
/** 测光补偿的上下限（倍数）：再暗的地方也不会无限提亮（远侧的夜里没有地球光，就是很黑）。 */
const METER_MIN = 0.6;
const METER_MAX = 60;
/** 夜里整体再暗一些（乘这个数），一看就知道是夜晚。 */
const NIGHT_KEY = 0.7;
/**
 * 反射补光：被照亮的地面会把一部分光反射到背光的坡面和影子里（月壤反照率约 0.1，周围一半是亮地面，约补 5%）。
 * 夜里加大到和地球光照平地一样强（100%）：这是为了看得清，不是物理值——人眼适应黑暗后能分辨背光的山坡，
 * 而真实的反射补光只有约 5%，背光坡会几乎全黑、只剩剪影。这样背光坡大约是迎光坡的三分之一亮，地形起伏仍然看得出来。
 */
const FILL_DAY = 0.05;
const FILL_NIGHT = 1.0;
/** 面朝主光源（白天太阳、夜里地球）看时，画面里多是背光面，测光会把曝光再提高一点：最多 1 + 这个数 倍。 */
const BACKLIGHT_GAIN_DAY = 0.5;
const BACKLIGHT_GAIN_NIGHT = 0.9;
/** 基准场景的地面亮度：反照率 0.12、太阳高 45° 的平地。 */
const METER_REFERENCE = (0.12 * SUN_INTENSITY * Math.SQRT1_2) / Math.PI;
/** 曝光追着目标值走的时间常数（秒）：日落、走进阴影时是慢慢适应的，不是一下跳。 */
const EXPOSURE_EASE_S = 0.45;
/** 满地球时地球光的强度（和 SUN_INTENSITY 同一单位）。真实的地球光约是阳光的万分之一，这里取约 3%，配合 NIGHT_ADAPT 使夜里亮度合理；白天它只让影子里有一点点蓝。 */
const EARTH_LIGHT_FULL = 0.095;
const D2R_LIGHT = Math.PI / 180;
const R2D_LIGHT = 180 / Math.PI;

export async function buildFirstPersonScene(center: LatLon, renderer: THREE.WebGLRenderer): Promise<FirstPersonScene> {
  // 地面颜色只用 4K 底图：站在地上，一个像素对应的月面有好几百米，更细的底图在这里看不出区别
  const [field, colorTexture, earthTexture, realCraters] = await Promise.all([
    loadHeightField(center, PATCH_RADIUS_M),
    fetchTextureBlob(MOON_TEXTURES.color4k).then((blob) => decodeTexture(blob, true, renderer.capabilities.getMaxAnisotropy())),
    // 天空里的地球贴图下不来时，不拦住整个场景：地球用一个单色的蓝球顶上
    fetchTextureBlob(SKY_TEXTURES.earth4k).then((blob) => decodeTexture(blob, true, renderer.capabilities.getMaxAnisotropy())).catch(() => fallbackEarthTexture()),
    // 真实撞击坑拿不到时（网络问题）不拦住整个场景，只是少了真实的坑
    loadNearbyCraters(center, REAL_CRATER_RADIUS_M).catch((): RealCrater[] => []),
  ]);
  const detail = createTerrainDetail(center.latDeg, center.lonDeg, realCraters, REAL_CRATER_RADIUS_M);
  const { chunks, groundHeightM, footOffsetM, surfaceYAt } = buildTerrainPatch(center, field, detail, PATCH_RADIUS_M);

  const scene = new THREE.Scene();
  // 站立点周围的平均反照率：给测光用（暗的月海、亮的撞击坑曝光不同）
  const groundAlbedo = sampleGroundAlbedo(colorTexture, center.latDeg, center.lonDeg);
  scene.background = new THREE.Color(0x000000);
  // 地面上的石头：同一个地点每次撒得一样（种子由经纬度决定）
  const rockSeed = (Math.round((center.latDeg + 90) * 1000) * 2654435761) ^ (Math.round((center.lonDeg + 180) * 1000) * 40503);
  const rocks = createRockField(surfaceYAt, rockSeed);
  scene.add(rocks.group);
  const ground = createGroundMaterial(colorTexture);
  for (const chunk of chunks) {
    const terrain = new THREE.Mesh(chunk, ground.material);
    terrain.castShadow = true;
    terrain.receiveShadow = true;
    scene.add(terrain);
  }

  const sunLight = new THREE.DirectionalLight(0xfff8f0, SUN_INTENSITY);
  sunLight.castShadow = true;
  // 阴影图 4096 就够：范围只覆盖"到地平线的几倍"（见 fitShadowToView），而且只在太阳方向、视点高度或走动位置变了才重画
  const shadowSize = Math.min(4096, renderer.capabilities.maxTextureSize);
  sunLight.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sunLight.shadow.camera, { near: 1000, far: SUN_LIGHT_DISTANCE_M * 2 });
  const ambient = new THREE.AmbientLight(0x9fb4d0, 0.004); // 星光和散射的极弱底光：远侧的夜里（没有地球光）只够看出一点轮廓
  // 地球光：太阳照不到地面时（落下了、被地形挡住了），地球反射的光是唯一的光源，带方向，所以坡面朝向地球的一侧亮、别处暗，地形起伏看得清
  const earthLight = new THREE.DirectionalLight(0xc3d5ff, 0);
  scene.add(sunLight, sunLight.target, ambient, earthLight);

  const sun = createSun();
  const earth = createEarth(earthTexture);
  const stars = createStarfield(SKY_DISTANCE_M * 1.2);
  // 太阳和地球在天上的轨迹（点线），比太阳、地球稍近一点，免得盖住它们
  const skyPaths = createSkyPaths(center, SKY_DISTANCE_M * 0.95);
  scene.add(sun, earth, stars, skyPaths.group);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.3, SKY_DISTANCE_M * 1.5);
  const eye = new THREE.Vector3();
  let shadowHalfM = 0;
  let shadowDirty = true;
  let lastTimeMs = Number.NaN;
  let lastSky: SkyState | null = null;

  /** 眼睛越低，能看到的范围越小，就把阴影贴图集中到近处（1.6 m 时约 1.7 m 一个像素）。 */
  const fitShadowToView = (eyeHeightM: number) => {
    const horizonM = Math.sqrt(2 * MOON_RADIUS_M * eyeHeightM);
    const wanted = THREE.MathUtils.clamp(horizonM * SHADOW_HORIZON_FACTOR, SHADOW_MIN_HALF_M, PATCH_RADIUS_M);
    if (Math.abs(wanted - shadowHalfM) < shadowHalfM * 0.05) return;
    shadowHalfM = wanted;
    shadowDirty = true;
    const texelM = (shadowHalfM * 2) / shadowSize;
    Object.assign(sunLight.shadow.camera, { left: -shadowHalfM, right: shadowHalfM, top: shadowHalfM, bottom: -shadowHalfM });
    sunLight.shadow.camera.updateProjectionMatrix();
    sunLight.shadow.bias = -0.00005;
    sunLight.shadow.normalBias = texelM * 1.5;
  };

  const setTime = (timeMs: number): SkyState => {
    if (timeMs !== lastTimeMs) shadowDirty = true; // 太阳动了，阴影要跟着重画
    lastTimeMs = timeMs;
    const c = skyConditionsAt(center, timeMs);
    // 阴影贴图以人站的位置为中心（走动时，清晰的阴影范围跟着人走）
    sunLight.target.position.set(eye.x, 0, eye.z);
    sunLight.target.updateMatrixWorld();
    sunLight.position.copy(azElToLocal(c.sun.azimuthDeg, c.sun.elevationDeg)).multiplyScalar(SUN_LIGHT_DISTANCE_M).add(sunLight.target.position);
    sunLight.visible = c.sun.elevationDeg > -1;
    placeInSky(sun, c.sun.azimuthDeg, c.sun.elevationDeg, eye);
    placeInSky(earth, c.earth.azimuthDeg, c.earth.elevationDeg, eye);
    sizeEarth(earth, c.earth.angularRadiusDeg, SKY_DISTANCE_M);
    orientEarth(earth, timeMs, center.latDeg, azElToLocal(c.earth.azimuthDeg, c.earth.elevationDeg), azElToLocal(c.sun.azimuthDeg, c.sun.elevationDeg));
    sun.visible = c.sun.elevationDeg > -1;
    earth.visible = c.earth.elevationDeg > -2;
    // 白天曝光下星星应该几乎看不见（阿波罗照片里就是这样）；太阳落下后再亮起来
    // 离屏画布（对比表快照）没有显示尺寸，clientWidth 是 0：按缩小一半显示估算星点大小
    const shownWidth = renderer.domElement.clientWidth || renderer.domElement.width / 2;
    const pixelRatio = renderer.domElement.width / Math.max(shownWidth, 1);
    // 星星：白天也保留得比较清楚（真实相机按白天曝光几乎拍不到星星，这里为了好看留着），夜里更亮
    updateStarfield(stars, pixelRatio, c.sun.elevationDeg > 0 ? 0.75 : 1.6);
    skyPaths.update(timeMs, eye, pixelRatio);
    earthLight.position.copy(azElToLocal(c.earth.azimuthDeg, c.earth.elevationDeg)).multiplyScalar(1000);
    // 地球光的强弱看地球的相位：太阳和地球在天上离得越远（夹角接近 180°），地球越"满"，照下来的光越多；地球在地平线下就没有
    const sunEarthCos = azElToLocal(c.sun.azimuthDeg, c.sun.elevationDeg).dot(azElToLocal(c.earth.azimuthDeg, c.earth.elevationDeg));
    const earthLitFraction = (1 - sunEarthCos) / 2;
    earthLight.intensity = EARTH_LIGHT_FULL * earthLitFraction * THREE.MathUtils.smoothstep(c.earth.elevationDeg, -1, 3);
    lastSky = { sunAzimuthDeg: c.sun.azimuthDeg, sunElevationDeg: c.sun.elevationDeg, earthAzimuthDeg: c.earth.azimuthDeg, earthElevationDeg: c.earth.elevationDeg };
    return lastSky;
  };

  /** 从眼睛往 azimuthDeg 方向看过去，被地形挡住的最高仰角（度）：太阳低于它，就被地形挡住了。 */
  const terrainHorizonDeg = (azimuthDeg: number): number => {
    const az = azimuthDeg * D2R_LIGHT;
    let best = -90;
    for (let i = 0; i < 28; i++) {
      const distanceM = 12 * Math.pow(1.38, i); // 12 m ~ 70 km
      const height = surfaceYAt(eye.x + Math.sin(az) * distanceM, -eye.z + Math.cos(az) * distanceM);
      best = Math.max(best, Math.atan2(height - eye.y, distanceM) * R2D_LIGHT);
    }
    return best;
  };

  let exposure = BASE_EXPOSURE;
  const updateLighting = (yawDeg: number, dtS: number): boolean => {
    const sky = lastSky;
    if (!sky) return false;
    // 白天还是夜里：看太阳是否在（理想的）地平线上
    const day = THREE.MathUtils.smoothstep(sky.sunElevationDeg, -1, 1.5);
    // 自己脚下有没有被太阳照到：太阳圆盘高过这个方向的地形地平线才算
    const horizonDeg = terrainHorizonDeg(sky.sunAzimuthDeg);
    const sunLitHere = THREE.MathUtils.smoothstep(sky.sunElevationDeg, horizonDeg - 0.3, horizonDeg + 1.5);
    // 测光：估计地面有多亮。自己站在阴影里时，画面里通常还有被照亮的地方，所以阳光项不全扣掉
    const sunIrradiance = SUN_INTENSITY * day * THREE.MathUtils.lerp(0.3, 1, sunLitHere) * Math.max(Math.sin(Math.max(sky.sunElevationDeg, 0) * D2R_LIGHT), 0.08);
    const earthIrradiance = earthLight.intensity * Math.max(Math.sin(Math.max(sky.earthElevationDeg, 0) * D2R_LIGHT), 0.15);
    // 反射补光：跟着照到平地上的光走（太阳 + 地球光），夜里比例更大
    const flatIrradiance = SUN_INTENSITY * day * Math.max(Math.sin(sky.sunElevationDeg * D2R_LIGHT), 0) + earthIrradiance;
    ambient.intensity = 0.004 + THREE.MathUtils.lerp(FILL_NIGHT, FILL_DAY, day) * flatIrradiance;
    const estimate = (groundAlbedo * (sunIrradiance + earthIrradiance + ambient.intensity)) / Math.PI;
    const k = THREE.MathUtils.lerp(METER_K_NIGHT, METER_K_DAY, day);
    const metered = THREE.MathUtils.clamp(Math.pow(METER_REFERENCE / Math.max(estimate, 1e-9), k), METER_MIN, METER_MAX);
    // 面朝主光源看：画面里多是背光的坡面，曝光再提一点；光源越低，背光面越多，提得越多
    const lightAzimuthDeg = day > 0.5 ? sky.sunAzimuthDeg : sky.earthAzimuthDeg;
    const lightElevationDeg = day > 0.5 ? sky.sunElevationDeg : sky.earthElevationDeg;
    const facingLight = Math.max(Math.cos((yawDeg - lightAzimuthDeg) * D2R_LIGHT), 0) * (1 - 0.6 * Math.sin(Math.max(lightElevationDeg, 0) * D2R_LIGHT));
    const backlight = 1 + THREE.MathUtils.lerp(BACKLIGHT_GAIN_NIGHT, BACKLIGHT_GAIN_DAY, day) * facingLight;
    const target = BASE_EXPOSURE * metered * backlight * THREE.MathUtils.lerp(NIGHT_KEY, 1, day);
    const before = exposure;
    exposure += (target - exposure) * (1 - Math.exp(-Math.min(dtS, 1) / EXPOSURE_EASE_S));
    if (Math.abs(target - exposure) < 0.005) exposure = target;
    renderer.toneMappingExposure = exposure;
    return Math.abs(exposure - before) > 0.001;
  };

  const setView = (yawDeg: number, pitchDeg: number, eyeHeightM: number, feet?: FeetPosition) => {
    // 本地坐标：x 向东，z 向南
    const previousX = eye.x;
    const previousZ = eye.z;
    if (feet) eye.set(feet.eastM, feet.groundYM + eyeHeightM, -feet.northM);
    else eye.set(0, footOffsetM + eyeHeightM, 0);
    if (feet && (previousX !== eye.x || previousZ !== eye.z)) shadowDirty = true; // 人挪了，阴影贴图中心要跟着挪
    ground.setWalker(eye.x, eye.z);
    rocks.update(eye.x, -eye.z);
    camera.position.copy(eye);
    camera.lookAt(azElToLocal(yawDeg, pitchDeg).add(eye));
    stars.position.copy(eye);
    fitShadowToView(eyeHeightM);
  };

  return {
    scene,
    camera,
    groundHeightM,
    setTime,
    updateLighting,
    takeShadowDirty: () => {
      const dirty = shadowDirty;
      shadowDirty = false;
      return dirty;
    },
    setView,
    surfaceYAt,
    startGroundYM: footOffsetM,
    dispose: () => {
      earthTexture.dispose();
      skyPaths.dispose();
      ground.dispose();
      rocks.dispose();
      // 阴影贴图挂在灯上，不随网格释放，要单独释放
      sunLight.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Sprite) {
          obj.geometry.dispose();
          const material = obj.material as THREE.Material & { map?: THREE.Texture | null };
          material.map?.dispose();
          material.dispose();
        }
      });
    },
  };
}
