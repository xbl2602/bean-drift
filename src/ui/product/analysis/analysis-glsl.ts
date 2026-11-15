// 分析图层的着色器片段，2D 展开图和 3D 球共用（各自先定义好 LQ_TEX(tex, uv) 这个取样宏再插入本片段）。
// 公式和 analysis-model.ts 逐条对应，常数直接从那里写进来；改一边必须改另一边。
import * as THREE from "three";
import { gridDetailWeights, MAJOR_GRID_STEP_DEG, MINOR_GRID_LEVELS } from "../map-grid";
import { RAMPS, rampToGlsl, type LayerSettings, BASE_LAYER_INDEX } from "../map-layers";
import { SLOPE_MAX_DEG } from "../moon-assets";
import { ANALYSIS_MODEL as M, NIGHT_COEFFICIENTS, THERMAL_FACETS, type Vec3 } from "./analysis-model";

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
uniform vec4 uGridDetail;
uniform float uGridPixelRatio;
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
  float x = clamp(dot(p.up, sun) / ${f(M.sunRadiusSin)}, -1.0, 1.0);
  float visible = (acos(-x) + x * sqrt(max(0.0, 1.0 - x*x))) / LQ_PI;
  return visible * max(dot(n, sun), 0.0);
}

float lqEquilibriumTempK(float cosIncidence) {
  return ${f(M.subsolarTempK)} * pow(max(cosIncidence, 0.0), 0.25);
}

float lqSurfaceTempK(float cosine, float nightK) {
  float nightPower = pow(nightK, 4.0);
  return pow(nightPower + (pow(${f(M.subsolarTempK)}, 4.0) - nightPower) * clamp(cosine, 0.0, 1.0), 0.25);
}

float lqNightPolynomialK(float phi) {
  return ${NIGHT_COEFFICIENTS.reduceRight((value, coefficient) => '(' + value + ' * phi + ' + f(coefficient) + ')', '0.0')};
}

float lqDiurnalTempK(float phase, float cosLatitude) {
  float phi = mod(phase, 2.0 * LQ_PI);
  float latitudeDropK = ${f(M.thermalLatitudeDropK)} * (clamp(cosLatitude, 0.0, 1.0) - 1.0);
  if (phi >= LQ_PI * 0.5 && phi <= LQ_PI * 1.5) {
    float progress = (phi - LQ_PI * 0.5) / LQ_PI;
    float residual = mix(${f(M.thermalDuskK)} - lqNightPolynomialK(LQ_PI * 0.5), ${f(M.thermalDawnK)} - lqNightPolynomialK(LQ_PI * 1.5), progress);
    return lqNightPolynomialK(phi) + residual + latitudeDropK;
  }
  float signedPhi = phi > LQ_PI ? phi - 2.0 * LQ_PI : phi;
  float progress = (signedPhi + LQ_PI * 0.5) / LQ_PI;
  float baselineK = ${f(M.thermalDuskK)} - ${f(M.thermalDuskK - M.thermalDawnK)} * pow(1.0 - progress, 8.0);
  return baselineK + ${f(M.thermalDayAmplitudeK)} * sqrt(max(0.0, cosLatitude * cos(phi))) + latitudeDropK;
}

vec2 lqThermalCoordinates(vec3 n) {
  float xy = length(uSunBody.xy);
  vec3 east = vec3(-uSunBody.y / xy, uSunBody.x / xy, 0.0);
  vec3 north = vec3(-uSunBody.z * uSunBody.xy / xy, xy);
  float x = dot(n, uSunBody), y = dot(n, east), z = dot(n, north);
  float phase = abs(x) + abs(y) > 0.00000001 ? atan(y, x) : 0.0;
  return vec2(phase, sqrt(max(0.0, 1.0 - z*z)));
}

float lqThermalTempK(vec3 n, float permanentShadow) {
  vec2 coordinate = lqThermalCoordinates(n);
  float power = 0.0;
  ${THERMAL_FACETS.map(([offset, weight]) => 'power += ' + f(weight) + ' * pow(lqDiurnalTempK(coordinate.x + ' + f(offset * M.thermalRoughnessRad) + ', coordinate.y), 4.0);').join("\n  ")}
  return pow(mix(power, pow(${f(M.shadowTempK)}, 4.0), clamp(permanentShadow, 0.0, 1.0)), 0.25);
}

float lqThermalPeakK(vec3 n, float permanentShadow) {
  float c = lqThermalCoordinates(n).y;
  float peakK = ${f(M.thermalDuskK)} + ${f(M.thermalDayAmplitudeK)} * sqrt(c) + ${f(M.thermalLatitudeDropK)} * (c - 1.0);
  return pow(mix(pow(peakK, 4.0), pow(${f(M.shadowTempK)}, 4.0), clamp(permanentShadow, 0.0, 1.0)), 0.25);
}

float lqPermanentShadow(vec2 uv, LqPoint p) {
  float polarWeight = smoothstep(${f(M.polarStartDeg)}, ${f(M.polarFullDeg)}, abs(p.latDeg));
  float sunMarginDeg = LQ_TEX(uPolar, uv).r * 6.0 - 3.0;
  return polarWeight * (1.0 - smoothstep(-0.3, 0.3, sunMarginDeg));
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
  for (int i = 0; i < ${M.monthSamples}; i++) {
    int j = i == ${M.monthSamples - 1} ? 0 : i + 1;
    float a = min(dot(p.up, uSunSamples[i]) + ${f(M.sunRadiusSin)}, dot(n, uSunSamples[i]));
    float b = min(dot(p.up, uSunSamples[j]) + ${f(M.sunRadiusSin)}, dot(n, uSunSamples[j]));
    litCount += a > 0.0 && b > 0.0 ? 1.0 : (a <= 0.0 && b <= 0.0 ? 0.0 : max(a,b) / (abs(a) + abs(b)));
  }
  float illumination = mix(litCount / ${f(M.monthSamples)}, polar.g, polarWeight);

  float tempNowK = lqThermalTempK(n, permanentShadow);
  float maxTempK = lqThermalPeakK(n, permanentShadow);

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
  if (uBase == 4) {
    float temperatureK = lqThermalTempK(lqNormal(p, 1.0), lqPermanentShadow(uv, p));
    return temperatureRamp((temperatureK - ${f(M.tempScaleMinK)}) / ${f(M.tempScaleMaxK - M.tempScaleMinK)});
  }
  vec4 m = lqMetrics(uv, p);
  if (uBase == 3) return illuminationRamp(m.x);
  if (uBase == 5) return iceRamp(m.z);
  return suitabilityRamp(m.w);
}

// 固定方向（西北上方）的浅浮雕，只为让分析图层上还能看出地形；平地 = 1.0
float lqHillshade(LqPoint p) {
  vec3 n = lqNormal(p, 3.0 * lqPoleFade(p));
  vec3 light = normalize(-p.east + p.north + 1.2 * p.up);
  return clamp(1.0 + 1.1 * (dot(n, light) - 0.647), 0.5, 1.3);
}

float lqGridLine(vec2 degrees, float stepDeg, float halfWidthCss) {
  vec2 cell = degrees / stepDeg;
  vec2 pixelWidth = max(fwidth(cell), vec2(0.0000001));
  vec2 distanceCss = abs(fract(cell + 0.5) - 0.5) / pixelWidth / uGridPixelRatio;
  vec2 coverage = 1.0 - smoothstep(vec2(max(0.0, halfWidthCss - 0.4)), vec2(halfWidthCss + 0.4), distanceCss);
  // Suppress a compressed axis at the limb/poles instead of drawing a solid fan.
  coverage *= smoothstep(vec2(4.0), vec2(10.0), 1.0 / pixelWidth / uGridPixelRatio);
  return max(coverage.x, coverage.y);
}

float lqGrid(LqPoint p, vec2 uv) {
  vec2 degrees = uv * vec2(360.0, 180.0);
  float major = lqGridLine(degrees, ${f(MAJOR_GRID_STEP_DEG)}, 0.35) * 0.85;
  float minor = max(max(
    lqGridLine(degrees, ${f(MINOR_GRID_LEVELS[0].stepDeg)}, 0.2) * uGridDetail.x,
    lqGridLine(degrees, ${f(MINOR_GRID_LEVELS[1].stepDeg)}, 0.2) * uGridDetail.y), max(
    lqGridLine(degrees, ${f(MINOR_GRID_LEVELS[2].stepDeg)}, 0.2) * uGridDetail.z,
    lqGridLine(degrees, ${f(MINOR_GRID_LEVELS[3].stepDeg)}, 0.2) * uGridDetail.w));
  return max(major, minor * 0.45);
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
    uGridDetail: { value: new THREE.Vector4() },
    uGridPixelRatio: { value: 1 },
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

/** Scale minor intervals and line widths in CSS pixels, independently of display DPR. */
export function applyGridScale(uniforms: AnalysisUniforms, pixelsPerDegree: number, pixelRatio: number) {
  uniforms.uGridDetail.value.set(...gridDetailWeights(pixelsPerDegree));
  uniforms.uGridPixelRatio.value = Math.max(0.25, pixelRatio);
}
