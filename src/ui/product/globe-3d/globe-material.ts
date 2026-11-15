// 3D 月球的材质：彩色底图 + LOLA 法线 + LOLA 高度位移（夸张显示），并且位移后的地形能投射阴影。
// 分析图层通过 onBeforeCompile 往 three 自带的标准材质里插入 analysis-glsl.ts 的片段（和 2D 共用同一套公式）：
//   - 底图是"月面影像"时：正常受光，真实太阳方向 + 阴影；
//   - 底图是分析图层时：颜色直接发光输出（不受昼夜影响），只叠一层固定方向的浅浮雕，保证和图例颜色一致。
import * as THREE from "three";
import { DETAIL_GLSL, TILES_GLSL, atlasUniforms, type MoonAtlases } from "../imagery/tile-sources";
import { ANALYSIS_GLSL, createAnalysisUniforms, type AnalysisTextureSlots } from "../analysis/analysis-glsl";
import type { DataMapKey } from "../moon-texture-urls";
import { RELIEF_MAX_HEIGHT_M, RELIEF_MIN_HEIGHT_M } from "../moon-assets";

/** 3D 里地形高度放大倍数（真实比例下 20 km 起伏在 1737 km 的球上几乎看不出来）。 */
export const GLOBE_RELIEF_EXAGGERATION = 4;

/** 3D 里地表相对球面的最低、最高位置（km，已含放大倍数）。判断"哪些块一定被球体挡住"时要用。 */
export const GLOBE_RELIEF_MIN_KM = (RELIEF_MIN_HEIGHT_M / 1000) * GLOBE_RELIEF_EXAGGERATION;
export const GLOBE_RELIEF_MAX_KM = (RELIEF_MAX_HEIGHT_M / 1000) * GLOBE_RELIEF_EXAGGERATION;

const displacement = {
  displacementScale: GLOBE_RELIEF_MAX_KM - GLOBE_RELIEF_MIN_KM,
  displacementBias: GLOBE_RELIEF_MIN_KM,
};

export function createGlobeMaterials(color: THREE.Texture, analysis: AnalysisTextureSlots, atlases: MoonAtlases) {
  const analysisUniforms = createAnalysisUniforms(analysis);
  const surface = new THREE.MeshStandardMaterial({
    map: color,
    normalMap: analysis.normal.value,
    normalScale: new THREE.Vector2(2.5, 2.5),
    displacementMap: analysis.relief.value,
    ...displacement,
    roughness: 1,
    metalness: 0,
  });
  surface.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, analysisUniforms, atlasUniforms(atlases));
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
#define LQ_TEX(tex, uv) texture2D(tex, uv)
${ANALYSIS_GLSL}
${TILES_GLSL}
${DETAIL_GLSL}
vec3 lqEmissive = vec3(0.0);`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
if (uBase == 0) {
  // 4K 底图上先盖我们自己的 8K / 16K 瓦片，再盖 NASA Moon Trek 的近景瓦片（预乘透明度，没下好的地方透出下面一层）
  vec4 tilesColor = lunarTiles(vMapUv);
  diffuseColor.rgb = diffuseColor.rgb * (1.0 - tilesColor.a) + tilesColor.rgb;
  vec4 detailColor = lunarDetail(vMapUv);
  diffuseColor.rgb = diffuseColor.rgb * (1.0 - detailColor.a) + detailColor.rgb;
}
LqPoint lqP = lqPoint(vMapUv);
if (uBase != 0) {
  // 着色器里按线性光工作，输出时会再转成 sRGB；先做一次反变换，屏幕上的颜色才和图例一致
  lqEmissive = pow(lqDataColor(vMapUv, lqP) * lqHillshade(lqP), vec3(2.2));
  diffuseColor.rgb = vec3(0.0);
}`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
totalEmissiveRadiance += lqEmissive;
if (uGrid) totalEmissiveRadiance += vec3(0.25, 0.45, 0.6) * lqGrid(lqP, vMapUv);`,
      );
  };

  // 投影阴影时 three 用这个材质画深度图；必须也做位移，阴影才会跟着放大后的山体走
  const shadowDepth = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    displacementMap: analysis.relief.value,
    ...displacement,
  });

  return { surface, shadowDepth, analysisUniforms };
}

/** 法线或高度贴图换成了新的（从 2K 换成 4K）：three 自带材质不走 uniform，要手动改引用。其余数据贴图走 slot，不用管。 */
export function applyTextureSwap(materials: Pick<ReturnType<typeof createGlobeMaterials>, "surface" | "shadowDepth">, key: DataMapKey, texture: THREE.Texture) {
  if (key === "normal") materials.surface.normalMap = texture;
  if (key === "relief") {
    materials.surface.displacementMap = texture;
    materials.shadowDepth.displacementMap = texture;
  }
}
