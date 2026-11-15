// 第一人称场景的搭建（不含 React）：真实 LOLA 地形 + 真实时刻的太阳/地球 + 太阳投下的地形阴影。
// 时间一变，太阳方向跟着变，阴影贴图随之重算，所以阴影随时间移动、方向由太阳决定（时间没变、只是转头时不重算）。
// 地形按"扇形 × 环带"切成块：背后和视野外的块不画（见 terrain-patch.ts）。
import * as THREE from "three";
import { decodeTexture } from "../imagery/decode-texture";
import { MOON_RADIUS_M } from "../moon-assets";
import { MOON_TEXTURES } from "../moon-texture-urls";
import { fetchTextureBlob } from "../preload/texture-blob-cache";
import { azElToLocal, type LatLon } from "../moon-frames";
import { skyConditionsAt } from "../sky-conditions";
import { createStarfield, updateStarfield } from "../starfield";
import { createGroundMaterial } from "./ground-material";
import { loadHeightField } from "./height-tiles";
import { createEarth, createSun, placeInSky, sizeEarth, SKY_DISTANCE_M } from "./sky-objects";
import { createTerrainDetail } from "./terrain-detail";
import { buildTerrainPatch } from "./terrain-patch";
import type { FeetPosition } from "./walk-motion";

/** 地形块半径 200 km：站高 10 km 时地平线约在 186 km 处，仍在块内。 */
export const PATCH_RADIUS_M = 200_000;
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
  renderer.toneMappingExposure = 1.8;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

/** 开场朝向：太阳在侧面（方位 +90°），阴影横穿画面最明显；太阳在地平线下就看向地球。 */
export function openingYawDeg(center: LatLon, timeMs: number): number {
  const c = skyConditionsAt(center, timeMs);
  return c.sun.elevationDeg > 0 ? (c.sun.azimuthDeg + 90) % 360 : c.earth.azimuthDeg;
}
export const OPENING_PITCH_DEG = -4;

export async function buildFirstPersonScene(center: LatLon, renderer: THREE.WebGLRenderer): Promise<FirstPersonScene> {
  // 地面颜色只用 4K 底图：站在地上，一个像素对应的月面有好几百米，更细的底图在这里看不出区别
  const [field, colorTexture] = await Promise.all([
    loadHeightField(center, PATCH_RADIUS_M),
    fetchTextureBlob(MOON_TEXTURES.color4k).then((blob) => decodeTexture(blob, true, renderer.capabilities.getMaxAnisotropy())),
  ]);
  const { chunks, groundHeightM, footOffsetM, surfaceYAt } = buildTerrainPatch(center, field, createTerrainDetail(center.latDeg, center.lonDeg), PATCH_RADIUS_M);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const ground = createGroundMaterial(colorTexture);
  for (const chunk of chunks) {
    const terrain = new THREE.Mesh(chunk, ground.material);
    terrain.castShadow = true;
    terrain.receiveShadow = true;
    scene.add(terrain);
  }

  const sunLight = new THREE.DirectionalLight(0xfff8f0, 3.4);
  sunLight.castShadow = true;
  // 阴影图 4096 就够：范围只覆盖"到地平线的几倍"（见 fitShadowToView），而且只在太阳方向、视点高度或走动位置变了才重画
  const shadowSize = Math.min(4096, renderer.capabilities.maxTextureSize);
  sunLight.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sunLight.shadow.camera, { near: 1000, far: SUN_LIGHT_DISTANCE_M * 2 });
  const ambient = new THREE.AmbientLight(0x9fb4d0, 0.015);
  scene.add(sunLight, sunLight.target, ambient);

  const sun = createSun();
  const earth = createEarth();
  const stars = createStarfield(SKY_DISTANCE_M * 1.2);
  scene.add(sun, earth, stars);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.3, SKY_DISTANCE_M * 1.5);
  const eye = new THREE.Vector3();
  let shadowHalfM = 0;
  let shadowDirty = true;
  let lastTimeMs = Number.NaN;

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
    sizeEarth(earth, c.earth.angularRadiusDeg);
    sun.visible = c.sun.elevationDeg > -1;
    earth.visible = c.earth.elevationDeg > -2;
    // 白天曝光下星星应该几乎看不见（阿波罗照片里就是这样）；太阳落下后再亮起来
    // 离屏画布（对比表快照）没有显示尺寸，clientWidth 是 0：按缩小一半显示估算星点大小
    const shownWidth = renderer.domElement.clientWidth || renderer.domElement.width / 2;
    updateStarfield(stars, renderer.domElement.width / Math.max(shownWidth, 1), c.sun.elevationDeg > 0 ? 0.25 : 1);
    return { sunAzimuthDeg: c.sun.azimuthDeg, sunElevationDeg: c.sun.elevationDeg, earthAzimuthDeg: c.earth.azimuthDeg, earthElevationDeg: c.earth.elevationDeg };
  };

  const setView = (yawDeg: number, pitchDeg: number, eyeHeightM: number, feet?: FeetPosition) => {
    // 本地坐标：x 向东，z 向南
    const previousX = eye.x;
    const previousZ = eye.z;
    if (feet) eye.set(feet.eastM, feet.groundYM + eyeHeightM, -feet.northM);
    else eye.set(0, footOffsetM + eyeHeightM, 0);
    if (feet && (previousX !== eye.x || previousZ !== eye.z)) shadowDirty = true; // 人挪了，阴影贴图中心要跟着挪
    ground.setWalker(eye.x, eye.z);
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
    takeShadowDirty: () => {
      const dirty = shadowDirty;
      shadowDirty = false;
      return dirty;
    },
    setView,
    surfaceYAt,
    startGroundYM: footOffsetM,
    dispose: () => {
      ground.dispose();
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
