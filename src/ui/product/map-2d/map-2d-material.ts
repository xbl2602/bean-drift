// 2D 展开图的着色器：整屏一个四边形，每个像素反算出经纬度再去贴图里取色。
// 好处：经度方向无缝循环、缩放到多大都不会出现贴图接缝，图层切换只是改一个 uniform。
// 分析图层的公式在 analysis/analysis-glsl.ts（和 3D 球共用）。
import * as THREE from "three";
import { DETAIL_GLSL, TILES_GLSL, atlasUniforms, type MoonAtlases } from "../imagery/tile-sources";
import { ANALYSIS_GLSL, createAnalysisUniforms, type AnalysisTextureSlots } from "../analysis/analysis-glsl";

const vertexShader = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const fragmentShader = /* glsl */ `
precision highp float;
layout(location = 0) out highp vec4 outColor;
uniform sampler2D uColor;
uniform vec2 uResolutionPx;   // 画布大小（设备像素）
uniform vec2 uCenterUv;       // 屏幕中心对应的贴图坐标，u 可以超出 0..1（循环）
uniform float uMapWidthPx;    // 整张展开图的宽度（设备像素），高度是它的一半
uniform bool uSunlight;
${TILES_GLSL}
${DETAIL_GLSL}

// 用未取 fract 的坐标求导数，避免经度接缝处 mipmap 选错出现一条线
vec2 lqDx;
vec2 lqDy;
#define LQ_TEX(tex, uv) textureGrad(tex, vec2(fract((uv).x), (uv).y), lqDx, lqDy)
${ANALYSIS_GLSL}

void main() {
  vec2 mapSizePx = vec2(uMapWidthPx, uMapWidthPx * 0.5);
  vec2 uv = uCenterUv + (gl_FragCoord.xy - uResolutionPx * 0.5) / mapSizePx;
  if (uv.y < 0.0 || uv.y > 1.0) { outColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  lqDx = dFdx(uv);
  lqDy = dFdy(uv);
  LqPoint p = lqPoint(uv);

  vec3 color;
  if (uBase == 0) {
    color = LQ_TEX(uColor, uv).rgb;
    // 4K 底图上先盖我们自己的 8K / 16K 瓦片，再盖 NASA Moon Trek 的近景瓦片（都是预乘透明度，没下好的地方透出下面一层）
    vec2 atlasUv = vec2(fract(uv.x), uv.y);
    vec4 tiles = lunarTiles(atlasUv);
    color = color * (1.0 - tiles.a) + tiles.rgb;
    vec4 detail = lunarDetail(atlasUv);
    color = color * (1.0 - detail.a) + detail.rgb;
    if (uSunlight) {
      vec3 n = lqNormal(p, 3.0 * lqPoleFade(p));
      float lit = max(dot(n, uSunBody), 0.0);
      // 光滑球面上的昼夜分界：太阳在地平线下就是夜，略微柔化一点避免锯齿
      float day = smoothstep(-0.004, 0.004, dot(p.up, uSunBody));
      // 夜面保留一点亮度（约 12%），地图在夜里也读得出；白天按入射角真实变暗
      color *= 0.12 + 0.88 * min(lit * day * 1.35, 1.0);
    }
  } else {
    color = lqDataColor(uv, p) * lqHillshade(p);
  }
  if (uGrid) color = mix(color, vec3(0.62, 0.86, 1.0), lqGrid(p, uv) * 0.55);
  outColor = vec4(color, 1.0);
}`;

export function createMap2dMaterial(color: THREE.Texture, analysis: AnalysisTextureSlots, atlases: MoonAtlases) {
  const analysisUniforms = createAnalysisUniforms(analysis);
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      ...analysisUniforms,
      ...atlasUniforms(atlases),
      uColor: { value: color },
      uResolutionPx: { value: new THREE.Vector2(1, 1) },
      uCenterUv: { value: new THREE.Vector2(0.5, 0.5) },
      uMapWidthPx: { value: 2048 },
      uSunlight: { value: true },
    },
  });
  return { material, analysisUniforms };
}
