// 第一人称天空里的太阳和地球。位置来自 src/core 星历给出的方位角/高度角；
// 两者都放在很远的地方，用真实视半径算大小（太阳 ≈0.27°，地球 ≈0.95°）。地球的明暗相位由同一束太阳光照出来。
import * as THREE from "three";
import { azElToLocal } from "../moon-frames";

export const SKY_DISTANCE_M = 3_000_000;
const SUN_ANGULAR_RADIUS_DEG = 0.267;

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

export function createSun(): THREE.Sprite {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), depthWrite: false, toneMapped: false, fog: false }));
  // 贴图里亮核约占直径的 16%，所以整张精灵放大到视直径的 ~6 倍
  const discM = SKY_DISTANCE_M * Math.tan((SUN_ANGULAR_RADIUS_DEG * Math.PI) / 180) * 2;
  sprite.scale.setScalar(discM / 0.16);
  sprite.renderOrder = -1;
  return sprite;
}

export function createEarth(): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({ color: 0x5f8fd8, roughness: 0.9, metalness: 0, emissive: 0x0a1020 });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), material);
  earth.renderOrder = -1;
  return earth;
}

export function placeInSky(object: THREE.Object3D, azimuthDeg: number, elevationDeg: number, observer: THREE.Vector3) {
  object.position.copy(azElToLocal(azimuthDeg, elevationDeg).multiplyScalar(SKY_DISTANCE_M).add(observer));
}

export function sizeEarth(earth: THREE.Mesh, angularRadiusDeg: number) {
  earth.scale.setScalar(SKY_DISTANCE_M * Math.tan((angularRadiusDeg * Math.PI) / 180));
}
