// 第一人称天空里的太阳。位置来自 src/core 星历给出的方位角/高度角，放在很远的地方，用真实视半径（≈0.27°）算大小。
// 地球在 earth-sky.ts。月面没有大气，所以没有蓝天和日晕；相机/眼睛看太阳时的"过曝光晕"和星芒是真实会看到的样子（阿波罗照片里就是这样）。
import * as THREE from "three";
import { azElToLocal } from "../moon-frames";

export const SKY_DISTANCE_M = 3_000_000;
/** 太阳精灵（含光晕、星芒）单边覆盖的角度。 */
const SUN_SPRITE_HALF_DEG = 6;
/** 过曝后白得发满的核心半径：比太阳真实的视半径 0.267° 略大（相机里太阳边缘会"溢出"），边缘仍然是清晰的。 */
const SUN_GLARE_CORE_DEG = 0.6;

/** 柔和的圆形光晕贴图（3D 地球仪的天空也在用）。 */
export function glowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.08, "rgba(255,255,250,1)");
  g.addColorStop(0.12, "rgba(255,244,220,0.45)");
  g.addColorStop(0.35, "rgba(255,230,190,0.08)");
  g.addColorStop(1, "rgba(255,220,180,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
};

/**
 * 太阳贴图：边缘清晰的白色圆盘 + 由近到远逐渐变暗的暖色光晕 + 淡淡的十字星芒。
 * 横轴、纵轴都是角度（度），整张图覆盖 ±SUN_SPRITE_HALF_DEG。
 */
function sunTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(size, size);
  const degPerPx = (2 * SUN_SPRITE_HALF_DEG) / size;
  const core = SUN_GLARE_CORE_DEG;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5 - size / 2) * degPerPx;
      const y = (py + 0.5 - size / 2) * degPerPx;
      const r = Math.hypot(x, y);
      const disc = 1 - smoothstep(core * 0.9, core * 1.08, r);
      const glare = 0.7 * Math.exp(-r / (core * 1.5)) + 0.22 * Math.exp(-r / (core * 5));
      // 星芒：沿横、纵两条轴，越靠近太阳越亮，离轴越远越快消失
      const spikes = 0.3 * (Math.exp(-Math.abs(y) / 0.05) * Math.exp(-Math.abs(x) / 1.6) + Math.exp(-Math.abs(x) / 0.05) * Math.exp(-Math.abs(y) / 1.6));
      const fade = 1 - smoothstep(SUN_SPRITE_HALF_DEG * 0.6, SUN_SPRITE_HALF_DEG, Math.max(Math.abs(x), Math.abs(y)));
      const intensity = Math.min(disc + (glare + spikes) * (1 - disc * 0.5), 1) * fade;
      const warm = smoothstep(core, core * 6, r); // 越往外越偏暖黄，核心是纯白
      const i = (py * size + px) * 4;
      image.data[i] = 255;
      image.data[i + 1] = Math.round(255 - 22 * warm);
      image.data[i + 2] = Math.round(255 - 70 * warm);
      image.data[i + 3] = Math.round(intensity * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createSun(): THREE.Sprite {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTexture(), depthWrite: false, toneMapped: false, fog: false, blending: THREE.AdditiveBlending }));
  sprite.scale.setScalar(SKY_DISTANCE_M * Math.tan((SUN_SPRITE_HALF_DEG * Math.PI) / 180) * 2);
  sprite.renderOrder = -1;
  return sprite;
}

export function placeInSky(object: THREE.Object3D, azimuthDeg: number, elevationDeg: number, observer: THREE.Vector3) {
  object.position.copy(azElToLocal(azimuthDeg, elevationDeg).multiplyScalar(SKY_DISTANCE_M).add(observer));
}
