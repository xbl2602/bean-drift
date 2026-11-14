// 第一人称场景的搭建（不含 React）：真实 LOLA 地形 + 真实时刻的太阳/地球 + 太阳投下的地形阴影。
// 时间一变，太阳方向跟着变，阴影贴图每帧重算，所以阴影随时间移动、方向由太阳决定。
import * as THREE from "three";
import { getPointConditions } from "@/core/data";
import { MOON_RADIUS_M, loadMoonTexture, pickColorTextureUrl } from "../moon-assets";
import { azElToLocal, type LatLon } from "../moon-frames";
import { createStarfield, updateStarfield } from "../starfield";
import { createGroundMaterial } from "./ground-material";
import { loadHeightField } from "./height-tiles";
import { createEarth, createSun, placeInSky, sizeEarth, SKY_DISTANCE_M } from "./sky-objects";
import { createTerrainDetail } from "./terrain-detail";
import { buildTerrainPatch } from "./terrain-patch";

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
  /** yaw 是罗盘方位（度），pitch 是仰角（度），eyeHeightM 是眼睛离地高度。 */
  setView: (yawDeg: number, pitchDeg: number, eyeHeightM: number) => void;
  dispose: () => void;
}

export async function buildFirstPersonScene(center: LatLon, renderer: THREE.WebGLRenderer): Promise<FirstPersonScene> {
  const [field, colorTexture] = await Promise.all([
    loadHeightField(center, PATCH_RADIUS_M),
    loadMoonTexture(pickColorTextureUrl(renderer), true),
  ]);
  colorTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const { geometry, groundHeightM, footOffsetM } = buildTerrainPatch(center, field, createTerrainDetail(center.latDeg, center.lonDeg), PATCH_RADIUS_M);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const ground = createGroundMaterial(colorTexture);
  const terrain = new THREE.Mesh(geometry, ground.material);
  terrain.castShadow = true;
  terrain.receiveShadow = true;
  scene.add(terrain);

  const sunLight = new THREE.DirectionalLight(0xfff8f0, 3.4);
  sunLight.castShadow = true;
  const shadowSize = renderer.capabilities.maxTextureSize >= 8192 ? 8192 : 4096;
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

  /** 眼睛越低，能看到的范围越小，就把阴影贴图集中到近处（1.6 m 时约 1.7 m 一个像素）。 */
  const fitShadowToView = (eyeHeightM: number) => {
    const horizonM = Math.sqrt(2 * MOON_RADIUS_M * eyeHeightM);
    const wanted = THREE.MathUtils.clamp(horizonM * SHADOW_HORIZON_FACTOR, SHADOW_MIN_HALF_M, PATCH_RADIUS_M);
    if (Math.abs(wanted - shadowHalfM) < shadowHalfM * 0.05) return;
    shadowHalfM = wanted;
    const texelM = (shadowHalfM * 2) / shadowSize;
    Object.assign(sunLight.shadow.camera, { left: -shadowHalfM, right: shadowHalfM, top: shadowHalfM, bottom: -shadowHalfM });
    sunLight.shadow.camera.updateProjectionMatrix();
    sunLight.shadow.bias = -0.00005;
    sunLight.shadow.normalBias = texelM * 1.5;
  };

  const setTime = (timeMs: number): SkyState => {
    const c = getPointConditions(center, timeMs);
    sunLight.position.copy(azElToLocal(c.sun.azimuthDeg, c.sun.elevationDeg)).multiplyScalar(SUN_LIGHT_DISTANCE_M);
    sunLight.visible = c.sun.elevationDeg > -1;
    placeInSky(sun, c.sun.azimuthDeg, c.sun.elevationDeg, eye);
    placeInSky(earth, c.earth.azimuthDeg, c.earth.elevationDeg, eye);
    sizeEarth(earth, c.earth.angularRadiusDeg);
    sun.visible = c.sun.elevationDeg > -1;
    earth.visible = c.earth.elevationDeg > -2;
    // 白天曝光下星星应该几乎看不见（阿波罗照片里就是这样）；太阳落下后再亮起来
    updateStarfield(stars, renderer.domElement.width / Math.max(renderer.domElement.clientWidth, 1), c.sun.elevationDeg > 0 ? 0.25 : 1);
    return { sunAzimuthDeg: c.sun.azimuthDeg, sunElevationDeg: c.sun.elevationDeg, earthAzimuthDeg: c.earth.azimuthDeg, earthElevationDeg: c.earth.elevationDeg };
  };

  const setView = (yawDeg: number, pitchDeg: number, eyeHeightM: number) => {
    eye.set(0, footOffsetM + eyeHeightM, 0);
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
    setView,
    dispose: () => {
      ground.dispose();
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
