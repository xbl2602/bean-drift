// 第一人称地面材质：真实的 LRO 彩色底图 + 近处的月壤颗粒感（示意，不是数据）。
// 月壤不是"哑光塑料"：它向光源方向反射得最多（背着太阳看最亮，迎着太阳看最暗，正对太阳背后还有"冲日亮斑"），也几乎没有镜面高光。
// 所以把 three.js 默认的 Lambert 漫反射 + GGX 高光换成"Lambert × 月面相位函数"（见 LUNAR_DIRECT_LIGHT），对太阳和地球光都适用。
// 颗粒感用一张可平铺的噪声贴图按"米"铺在地上：既微调明暗，又轻微扰动法线，低太阳角下近处才不会像塑料。
import * as THREE from "three";
import { createGrainPixels } from "./terrain-detail";

const GRAIN_SIZE = 512;
/**
 * 底图换算成真实反照率：albedo = SCALE * 底图^GAMMA（线性值）。
 * 底图（NASA SVS CGI Moon Kit）是给人看的，亮度和反差都拉伸过：全月平均线性亮度 0.32，月海 0.07、第谷坑底 0.64。
 * 真实的月面（法向反照率）：全月平均约 0.12，月海约 0.07，高地约 0.15-0.18，第谷这样的新鲜撞击坑约 0.2-0.25。
 * 用月海和第谷两个点拟合出下面两个数，换算后月海 0.07、高地（笛卡尔高地）0.16、第谷 0.22、全月平均 0.16。
 */
const ALBEDO_SCALE = 0.276;
const ALBEDO_GAMMA = 0.507;

/**
 * 月面相位函数 f(α)：α 是"太阳—地面—眼睛"的夹角（相位角）。f = e^(-α/140°) × (1 + 0.2 e^(-α/5°))，在 α = 75° 处归一为 1。
 * 结果：背着太阳看（α≈35°）约 1.33 倍，侧光（α≈90°）约 0.9 倍，迎着太阳（α≈125°）约 0.7 倍，正对太阳背后（α≈0°）约 2 倍。
 * 这个"背光亮、迎光暗"的比例和阿波罗照片、月面光度学（Hapke 模型的大致形状）一致，是简化的形状，不是拟合的参数。
 */
const LUNAR_DIRECT_LIGHT = /* glsl */ `
  float lqPhaseDeg = degrees(acos(clamp(dot(directLight.direction, geometryViewDir), -1.0, 1.0)));
  float lqPhase = exp(-lqPhaseDeg / 140.0) * (1.0 + 0.2 * exp(-lqPhaseDeg / 5.0)) / exp(-75.0 / 140.0);
  reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor ) * lqPhase;
`;

/** 底图的线性亮度 → 真实反照率（和着色器里的换算一样）。 */
export const mapToAlbedo = (linear: number) => ALBEDO_SCALE * Math.pow(Math.max(linear, 1e-4), ALBEDO_GAMMA);

const srgbToLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));

/**
 * 站立点周围约 40 km 的平均反照率（从底图里读一小块算），给"相机测光"用：同样的光照下，暗的月海和亮的新鲜撞击坑曝光不一样。
 * 读不到像素（比如没有 2D 画布）时返回全月平均 0.12。
 */
export function sampleGroundAlbedo(colorTexture: THREE.Texture, latDeg: number, lonDeg: number): number {
  try {
    const image = colorTexture.image as CanvasImageSource & { width: number; height: number };
    const { width, height } = image;
    const cropPx = 16;
    // 解码时上下翻转过（decode-texture.ts 的 flipY），所以第 0 行是南边
    const x = ((((lonDeg + 180) / 360) * width) % width + width) % width;
    const y = height - ((90 - latDeg) / 180) * height;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = cropPx;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return 0.12;
    ctx.drawImage(image, Math.max(0, Math.min(width - cropPx, x - cropPx / 2)), Math.max(0, Math.min(height - cropPx, y - cropPx / 2)), cropPx, cropPx, 0, 0, cropPx, cropPx);
    const data = ctx.getImageData(0, 0, cropPx, cropPx).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += 0.2126 * srgbToLinear(data[i] / 255) + 0.7152 * srgbToLinear(data[i + 1] / 255) + 0.0722 * srgbToLinear(data[i + 2] / 255);
    const albedo = mapToAlbedo(sum / (data.length / 4));
    return Number.isFinite(albedo) && albedo > 0 ? albedo : 0.12;
  } catch {
    return 0.12;
  }
}

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
  const material = new THREE.MeshStandardMaterial({ map: colorTexture, color: 0xffffff, roughness: 1, metalness: 0, vertexColors: true });
  material.onBeforeCompile = (shader) => {
    // 直射光：去掉 GGX 高光（月壤没有塑料一样的反光），漫反射乘上月面相位函数
    const directChunk = THREE.ShaderChunk.lights_physical_pars_fragment
      .replace(/reflectedLight\.directSpecular \+= irradiance \* BRDF_GGX_Multiscatter\([^;]*\);/, "")
      .replace("reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );", LUNAR_DIRECT_LIGHT);
    if (directChunk === THREE.ShaderChunk.lights_physical_pars_fragment) throw new Error("lunar photometry: three.js light chunk changed");
    shader.uniforms.uGrain = { value: grain };
    shader.uniforms.uWalker = walker;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLqLocal;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLqLocal = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <lights_physical_pars_fragment>", directChunk)
      .replace("#include <common>", "#include <common>\nvarying vec3 vLqLocal;\nuniform sampler2D uGrain;\nuniform vec2 uWalker;")
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
// 显示用的底图 → 真实反照率（见文件开头 ALBEDO_SCALE）
diffuseColor.rgb = ${ALBEDO_SCALE.toFixed(3)} * pow(max(diffuseColor.rgb, vec3(1e-4)), vec3(${ALBEDO_GAMMA.toFixed(3)}));
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
