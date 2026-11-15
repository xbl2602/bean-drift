// 图层定义：底图是 7 选 1（月面影像 + 6 个分析图层），外加阳光明暗和经纬网两个开关。2D 和 3D 共用。
import { RELIEF_MAX_HEIGHT_M, RELIEF_MIN_HEIGHT_M, SLOPE_MAX_DEG } from "./moon-assets";
import { ANALYSIS_MODEL } from "./analysis/analysis-model";

export type BaseLayer = "color" | "elevation" | "slope" | "illumination" | "temperature" | "ice" | "suitability";

/** 选址评分的各项权重，0 = 不考虑，1 = 最重视。 */
export interface SuitabilityWeights {
  slope: number;
  sunlight: number;
  earth: number;
  ice: number;
  thermal: number;
}

export interface LayerSettings {
  base: BaseLayer;
  /** 只对"月面影像"底图起作用：按当前时间的真实太阳位置打光。分析图层固定用浅浮雕，方便读颜色。 */
  sunlight: boolean;
  /** 经纬网，每 30°。 */
  grid: boolean;
  weights: SuitabilityWeights;
}

export const DEFAULT_WEIGHTS: SuitabilityWeights = { slope: 1, sunlight: 0.8, earth: 0.6, ice: 0.6, thermal: 0 };
export const DEFAULT_LAYERS: LayerSettings = { base: "color", sunlight: true, grid: false, weights: DEFAULT_WEIGHTS };

export const BASE_LAYER_INDEX: Record<BaseLayer, number> = { color: 0, elevation: 1, slope: 2, illumination: 3, temperature: 4, ice: 5, suitability: 6 };

/** 色带：GLSL 和图例共用同一组颜色，保证图例和画面一致。 */
export const RAMPS = {
  elevation: ["#1d2b5a", "#2f6f9f", "#5fb3a1", "#d9c88a", "#f4efe6"],
  slope: ["#14151c", "#3b3a6b", "#9b4f8f", "#e8835a", "#fbe7a1"],
  illumination: ["#0b1026", "#3b2f6b", "#b5562f", "#f2b134", "#fff7d6"],
  temperature: ["#1b2a6b", "#3f7fc4", "#8fd0c4", "#f3d36b", "#e8703a", "#a31621"],
  ice: ["#0c1220", "#123a5c", "#1f7fa8", "#6fd3e6", "#f0fdff"],
  suitability: ["#7a1f2b", "#c9603a", "#e8c14a", "#7fc46b", "#1f9d6b"],
} as const satisfies Record<Exclude<BaseLayer, "color">, readonly string[]>;

export interface LayerInfo {
  label: string;
  description: string;
  /** 数据是实测还是模型，以及主要的不足；显示在面板里，不能省。 */
  caveat: string;
  legend?: { left: string; right: string };
}

const m = ANALYSIS_MODEL;
export const LAYER_INFO: Record<BaseLayer, LayerInfo> = {
  color: {
    label: "Surface imagery",
    description: "LRO Wide Angle Camera colour mosaic.",
    caveat: "NASA SVS CGI Moon Kit; tuned for appearance, not for measurement.",
  },
  elevation: {
    label: "Terrain & elevation",
    description: "Height above or below the 1737.4 km reference sphere.",
    caveat: "Measured: LRO LOLA laser altimeter, 1/16° grid (about 1.9 km).",
    legend: { left: `${(RELIEF_MIN_HEIGHT_M / 1000).toFixed(1)} km`, right: `+${(RELIEF_MAX_HEIGHT_M / 1000).toFixed(1)} km` },
  },
  slope: {
    label: "Surface slope",
    description: "Steepness of the ground. Landers generally want less than about 15°.",
    caveat: "Derived from LOLA at about 1.9 km spacing, so short steep slopes (crater walls, boulders) are understated.",
    legend: { left: "0°", right: `≥ ${SLOPE_MAX_DEG}°` },
  },
  illumination: {
    label: "Solar illumination",
    description: "Share of time the ground is in sunlight over the lunar month that starts at the selected time.",
    caveat: `Model. Slope-aware Sun angle with interpolated monthly visibility (not a measured illumination image). Poleward of ${m.polarStartDeg}° it switches to a year-long terrain-horizon calculation from LOLA; elsewhere shadows cast by distant terrain are not included.`,
    legend: { left: "0% (never lit)", right: "100%" },
  },
  temperature: {
    label: "Surface temperature",
    description: "Estimated surface temperature at the selected time. Move the timeline to watch the day–night cycle.",
    caveat: `Model, not measured: Diviner-based empirical day/night cycle (Hurley et al., 2014), adapted to match dawn and dusk continuously. Nighttime cooling and unresolved facet roughness replace a fixed night temperature; LOLA normals orient the facets. Permanent shadow uses ${m.shadowTempK} K. Not a measured map or full soil heat-conduction calculation; local rocks, composition and terrain-cast shadows are not resolved. Least reliable near the terminator and poles.`,
    legend: { left: `${m.tempScaleMinK} K (${m.tempScaleMinK - 273}°C)`, right: `${m.tempScaleMaxK} K (+${m.tempScaleMaxK - 273}°C)` },
  },
  ice: {
    label: "Water-ice potential",
    description: "Where water ice could survive: ground in permanent shadow or that stays colder than about 110 K.",
    caveat: "Model index, not a detection of ice. Permanent shadow is computed from LOLA terrain at about 1.9 km resolution; smaller cold traps are missed. Evidence datasets (LEND, LAMP, M3) are not included yet.",
    legend: { left: "0 (unlikely)", right: "1 (cold trap)" },
  },
  suitability: {
    label: "Site suitability",
    description: "Weighted score from the criteria you select below.",
    caveat: "A screening aid built from the model layers above. Not a mission-grade assessment.",
    legend: { left: "0 (poor)", right: "1 (good)" },
  },
};

export function rampToGlsl(name: string, ramp: readonly string[]): string {
  const float = (x: number) => x.toFixed(6);
  const stops = ramp.map((hex) => {
    const n = parseInt(hex.slice(1), 16);
    return `vec3(${float(((n >> 16) & 255) / 255)}, ${float(((n >> 8) & 255) / 255)}, ${float((n & 255) / 255)})`;
  });
  const last = stops.length - 1;
  // GLSL 不会自动把整数转成浮点，所以每个数都写成带小数点的形式
  const lines = stops.slice(0, last).map((stop, i) => `  if (t <= ${float((i + 1) / last)}) return mix(${stop}, ${stops[i + 1]}, (t - ${float(i / last)}) * ${float(last)});`);
  return `vec3 ${name}(float t) {\n  t = clamp(t, 0.0, 1.0);\n${lines.join("\n")}\n  return ${stops[last]};\n}`;
}
