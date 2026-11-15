// 分析图层的着色器片段，2D 展开图和 3D 球共用（各自先定义好 LQ_TEX(tex, uv) 这个取样宏再插入本片段）。
// 公式和 analysis-model.ts 逐条对应，常数直接从那里写进来；改一边必须改另一边。
import * as THREE from "three";
import { RAMPS, rampToGlsl, type LayerSettings, BASE_LAYER_INDEX } from "../map-layers";
import { SLOPE_MAX_DEG } from "../moon-assets";
import { ANALYSIS_MODEL as M, type Vec3 } from "./analysis-model";

const f = (x: number) => x.toFixed(6);

export const ANALYSIS_GLSL = /* glsl */ `
uniform sampler2D uRelief;
uniform sampler2D uSlope;
uniform sampler2D uNormal;
uniform sampler2D uPolar;
uniform vec3 uSunBody;
uniform vec3 uSunSamples[${M.monthSamples}];
uniform int uBase;
uniform bool uGrid;
uniform float uWeights[5]; // slope, sunlight, earth, ice, thermal

${rampToGlsl("elevationRamp", RAMPS.elevation)}
${rampToGlsl("slopeRamp", RAMPS.slope)}
${rampToGlsl("illuminationRamp", RAMPS.illumination)}
${rampToGlsl("temperatureRamp", RAMPS.temperature)}
${rampToGlsl("iceRamp", RAMPS.ice)}
${rampToGlsl("suitabilityRamp", RAMPS.suitability)}

const float LQ_PI = 3.141592653589793;

struct LqPoint {
  vec3 up;
  vec3 east;
  vec3 north;
  vec3 tangentNormal; // (东, 北, 上)
  float latDeg;
  float lonDeg;
};

// 贴图坐标 -> 该点的经纬度和本地方向（月固系）。uv.x 可以超出 0..1（经度循环）。
LqPoint lqPoint(vec2 uv) {
  LqPoint p;
  float lon = (fract(uv.x) - 0.5) * 2.0 * LQ_PI;
  float lat = (uv.y - 0.5) * LQ_PI;
  p.up = vec3(cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat));
  p.east = vec3(-sin(lon), cos(lon), 0.0);
  p.north = vec3(-sin(lat) * cos(lon), -sin(lat) * sin(lon), cos(lat));
  p.tangentNormal = LQ_TEX(uNormal, uv).xyz * 2.0 - 1.0;
  p.latDeg = degrees(lat);
  p.lonDeg = degrees(lon);
  return p;
}

vec3 lqNormal(LqPoint p, float exaggeration) {
  vec3 t = p.tangentNormal;
  t.xy *= exaggeration;
  return normalize(t.x * p.east + t.y * p.north + t.z * p.up);
}

// 展开图在极点附近被横向拉得极宽，法线噪声很大；最后几度逐渐退回光滑球面
float lqPoleFade(LqPoint p) {
  return 1.0 - smoothstep(84.0, 89.0, abs(p.latDeg));
}

float lqLitCosine(LqPoint p, vec3 n, vec3 sun) {
  return dot(p.up, sun) > -${f(M.sunRadiusSin)} ? max(dot(n, sun), 0.0) : 0.0;
}

float lqEquilibriumTempK(float cosIncidence) {
  return ${f(M.subsolarTempK)} * pow(max(cosIncidence, 0.0), 0.25);
}

// 返回 (光照比例, 当前温度 K, 水冰指数, 选址评分)
vec4 lqMetrics(vec2 uv, LqPoint p) {
  vec3 n = lqNormal(p, 1.0);
  float slopeDeg = LQ_TEX(uSlope, uv).r * ${f(SLOPE_MAX_DEG)};
  vec3 polar = LQ_TEX(uPolar, uv).rgb;
  float polarWeight = smoothstep(${f(M.polarStartDeg)}, ${f(M.polarFullDeg)}, abs(p.latDeg));
  float sunMarginDeg = polar.r * 6.0 - 3.0;
  float permanentShadow = polarWeight * (1.0 - smoothstep(-0.3, 0.3, sunMarginDeg));

  float litCount = 0.0;
  float maxCos = 0.0;
  for (int i = 0; i < ${M.monthSamples}; i++) {
    float c = lqLitCosine(p, n, uSunSamples[i]);
    litCount += step(1e-5, c);
    maxCos = max(maxCos, c);
  }
  float illumination = mix(litCount / ${f(M.monthSamples)}, polar.g, polarWeight);

  float nightTempK = mix(${f(M.nightTempK)}, ${f(M.shadowTempK)}, permanentShadow);
  float tempNowK = max(nightTempK, lqEquilibriumTempK(lqLitCosine(p, n, uSunBody) * (1.0 - permanentShadow)));
  float maxTempK = max(nightTempK, lqEquilibriumTempK(maxCos * (1.0 - permanentShadow)));

  float cold = 1.0 - smoothstep(${f(M.iceColdTempK)}, ${f(M.iceWarmTempK)}, maxTempK);
  float ice = max(permanentShadow, cold);
  float iceAccess = max(ice, polar.b * polarWeight);

  float earthElevationDeg = degrees(asin(clamp(p.up.x, -1.0, 1.0)));
  float earthVisible = smoothstep(-${f(M.earthLibrationDeg)}, ${f(M.earthLibrationDeg)}, earthElevationDeg);

  float sSlope = clamp(1.0 - slopeDeg / ${f(M.slopeLimitDeg)}, 0.0, 1.0);
  float sThermal = 1.0 - smoothstep(${f(M.thermalMildK)}, ${f(M.thermalHotK)}, maxTempK);
  float weightSum = uWeights[0] + uWeights[1] + uWeights[2] + uWeights[3] + uWeights[4];
  float weighted = uWeights[0] * sSlope + uWeights[1] * illumination + uWeights[2] * earthVisible + uWeights[3] * iceAccess + uWeights[4] * sThermal;
  float slopeGate = uWeights[0] > 0.0 ? 1.0 - smoothstep(${f(M.slopeGateStartDeg)}, ${f(M.slopeGateEndDeg)}, slopeDeg) : 1.0;
  float suitability = weightSum > 0.0 ? weighted / weightSum * slopeGate : 0.0;

  return vec4(illumination, tempNowK, ice, suitability);
}

// uBase >= 1 时的图层颜色（不含明暗）
vec3 lqDataColor(vec2 uv, LqPoint p) {
  if (uBase == 1) return elevationRamp(LQ_TEX(uRelief, uv).r);
  if (uBase == 2) return slopeRamp(LQ_TEX(uSlope, uv).r);
  vec4 m = lqMetrics(uv, p);
  if (uBase == 3) return illuminationRamp(m.x);
  if (uBase == 4) return temperatureRamp((m.y - ${f(M.tempScaleMinK)}) / ${f(M.tempScaleMaxK - M.tempScaleMinK)});
  if (uBase == 5) return iceRamp(m.z);
  return suitabilityRamp(m.w);
}

// 固定方向（西北上方）的浅浮雕，只为让分析图层上还能看出地形；平地 = 1.0
float lqHillshade(LqPoint p) {
  vec3 n = lqNormal(p, 3.0 * lqPoleFade(p));
  vec3 light = normalize(-p.east + p.north + 1.2 * p.up);
  return clamp(1.0 + 1.1 * (dot(n, light) - 0.647), 0.5, 1.3);
}

float lqGrid(LqPoint p, vec2 uv) {
  vec2 cell = vec2(uv.x * 12.0, uv.y * 6.0);
  vec2 d = abs(fract(cell - 0.5) - 0.5) / fwidth(cell);
  return 1.0 - clamp(min(d.x, d.y) - 0.5, 0.0, 1.0);
}
`;

/** 四张数据贴图的"槽位"（见 imagery/moon-texture-set.ts）：着色器直接用槽位对象当 uniform，贴图从 2K 换成 4K 时只改 slot.value。 */
export type AnalysisTextureSlots = Record<"relief" | "slope" | "normal" | "polar", { value: THREE.Texture }>;

export type AnalysisUniforms = ReturnType<typeof createAnalysisUniforms>;

export function createAnalysisUniforms(slots: AnalysisTextureSlots) {
  return {
    uRelief: slots.relief,
    uSlope: slots.slope,
    uNormal: slots.normal,
    uPolar: slots.polar,
    uSunBody: { value: new THREE.Vector3(1, 0, 0) },
    uSunSamples: { value: Array.from({ length: M.monthSamples }, () => new THREE.Vector3(1, 0, 0)) },
    uBase: { value: 0 },
    uGrid: { value: false },
    uWeights: { value: [0, 0, 0, 0, 0] },
  };
}

export function applyAnalysisUniforms(uniforms: AnalysisUniforms, layers: LayerSettings, sunNow: Vec3, monthSuns: readonly Vec3[]) {
  uniforms.uSunBody.value.set(...sunNow);
  monthSuns.forEach((sun, i) => uniforms.uSunSamples.value[i].set(...sun));
  uniforms.uBase.value = BASE_LAYER_INDEX[layers.base];
  uniforms.uGrid.value = layers.grid;
  const w = layers.weights;
  uniforms.uWeights.value = [w.slope, w.sunlight, w.earth, w.ice, w.thermal];
}
