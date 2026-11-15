// 第一人称地面材质：真实的 LRO 彩色底图 + 近处的月壤颗粒感（示意，不是数据）。
// 颗粒感用一张可平铺的噪声贴图按"米"铺在地上：既微调明暗，又轻微扰动法线，低太阳角下近处才不会像塑料。
import * as THREE from "three";
import { createGrainPixels } from "./terrain-detail";

const GRAIN_SIZE = 512;

export function createGroundMaterial(colorTexture: THREE.Texture) {
  const grain = new THREE.DataTexture(createGrainPixels(GRAIN_SIZE), GRAIN_SIZE, GRAIN_SIZE, THREE.RedFormat);
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.minFilter = THREE.LinearMipmapLinearFilter;
  grain.magFilter = THREE.LinearFilter;
  grain.generateMipmaps = true;
  grain.anisotropy = 8;
  grain.needsUpdate = true;

  // 颗粒感只在"人附近"3 km 内显示：走动时跟着人走（图案本身固定在地上，不会跟着滑）
  const walker = { value: new THREE.Vector2(0, 0) };
  const material = new THREE.MeshStandardMaterial({ map: colorTexture, color: 0xe4e2de, roughness: 1, metalness: 0, vertexColors: true });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGrain = { value: grain };
    shader.uniforms.uWalker = walker;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLqLocal;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLqLocal = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLqLocal;\nuniform sampler2D uGrain;\nuniform vec2 uWalker;")
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
// 三种尺度的颗粒（0.9 m、7 m、110 m 一个周期）叠在一起；3 km 以外逐渐淡出，远处只剩真实底图
float lqNear = exp(-length(vLqLocal.xz - uWalker) / 3000.0);
float lqGrain = texture2D(uGrain, vLqLocal.xz / 0.9).r * 0.3 + texture2D(uGrain, vLqLocal.xz / 7.0).r * 0.4 + texture2D(uGrain, vLqLocal.xz / 110.0).r * 0.3;
diffuseColor.rgb *= mix(1.0, 0.7 + 0.6 * lqGrain, lqNear);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
{
  // 标准的"由高度差扰动法线"做法；高度单位是米（颗粒最高约 4 cm）
  vec2 gUv = vLqLocal.xz / 2.3;
  float h0 = texture2D(uGrain, gUv).r;
  vec2 dH = vec2(texture2D(uGrain, gUv + dFdx(gUv)).r - h0, texture2D(uGrain, gUv + dFdy(gUv)).r - h0) * 0.04 * lqNear;
  vec3 sigmaX = dFdx(-vViewPosition);
  vec3 sigmaY = dFdy(-vViewPosition);
  vec3 r1 = cross(sigmaY, normal);
  vec3 r2 = cross(normal, sigmaX);
  float det = dot(sigmaX, r1);
  normal = normalize(abs(det) * normal - sign(det) * (dH.x * r1 + dH.y * r2));
}`,
      );
  };

  /** 人站的位置（本地坐标 x, z）。 */
  const setWalker = (x: number, z: number) => walker.value.set(x, z);
  return { material, setWalker, dispose: () => grain.dispose() };
}
