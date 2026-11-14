// 3D 月球的材质：彩色底图 + LOLA 法线 + LOLA 高度位移（夸张显示），并且位移后的地形能投射阴影。
// 分析图层通过 onBeforeCompile 往 three 自带的标准材质里插入 analysis-glsl.ts 的片段（和 2D 共用同一套公式）：
//   - 底图是"月面影像"时：正常受光，真实太阳方向 + 阴影；
//   - 底图是分析图层时：颜色直接发光输出（不受昼夜影响），只叠一层固定方向的浅浮雕，保证和图例颜色一致。
import * as THREE from "three";
import { DETAIL_GLSL, type LunarDetailAtlas } from "../imagery/lunar-detail-atlas";
import { ANALYSIS_GLSL, createAnalysisUniforms, type AnalysisTextures } from "../analysis/analysis-glsl";
import { RELIEF_MAX_HEIGHT_M, RELIEF_MIN_HEIGHT_M } from "../moon-assets";

/** 3D 里地形高度放大倍数（真实比例下 20 km 起伏在 1737 km 的球上几乎看不出来）。 */
export const GLOBE_RELIEF_EXAGGERATION = 4;

const reliefSpanKm = (RELIEF_MAX_HEIGHT_M - RELIEF_MIN_HEIGHT_M) / 1000;
const displacement = {
  displacementScale: reliefSpanKm * GLOBE_RELIEF_EXAGGERATION,
  displacementBias: (RELIEF_MIN_HEIGHT_M / 1000) * GLOBE_RELIEF_EXAGGERATION,
};

export function createGlobeMaterials(color: THREE.Texture, analysis: AnalysisTextures, detail: LunarDetailAtlas["uniforms"]) {
  const analysisUniforms = createAnalysisUniforms(analysis);
  const surface = new THREE.MeshStandardMaterial({
    map: color,
    normalMap: analysis.normal,
    normalScale: new THREE.Vector2(2.5, 2.5),
    displacementMap: analysis.relief,
    ...displacement,
    roughness: 1,
    metalness: 0,
  });
  surface.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, analysisUniforms, detail);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
#define LQ_TEX(tex, uv) texture2D(tex, uv)
${ANALYSIS_GLSL}
${DETAIL_GLSL}
vec3 lqEmissive = vec3(0.0);`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
vec4 detailColor = lunarDetail(vMapUv);
if (uBase == 0) diffuseColor.rgb = mix(diffuseColor.rgb, detailColor.rgb, detailColor.a);
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
    displacementMap: analysis.relief,
    ...displacement,
  });

  return { surface, shadowDepth, analysisUniforms };
}
