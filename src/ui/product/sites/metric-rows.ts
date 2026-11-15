// 候选点的指标清单：对比表、候选点卡片和导出文件都按这一份来，保证名称、单位、来源说明一致。
import type { PointAnalysis } from "../analysis/point-analysis";

export interface MetricRow {
  key: string;
  label: string;
  unit: string;
  /** measured = NASA 实测数据；ephemeris = 星历计算；model = 我们的估算模型。 */
  source: "measured" | "ephemeris" | "model";
  value: (a: PointAnalysis) => number;
  digits: number;
  /** 对比时哪个方向算"更好"；不写就不标最优。 */
  better?: "higher" | "lower";
}

export const METRIC_ROWS: MetricRow[] = [
  // 和面板里长条的顺序一致：按重要性从高到低（综合 → 光照 → 通信 → 坡度 → 水冰 → 温度 → 高程）。
  { key: "suitability", label: "Suitability score", unit: "0–1", source: "model", value: (a) => a.suitability, digits: 2, better: "higher" },
  { key: "illuminationPct", label: "Sunlit time", unit: "%", source: "model", value: (a) => a.illuminationFraction * 100, digits: 0, better: "higher" },
  { key: "sunElevationDeg", label: "Sun elevation now", unit: "°", source: "ephemeris", value: (a) => a.sunElevationDeg, digits: 1 },
  { key: "earthVisiblePct", label: "Earth in view (comms)", unit: "%", source: "model", value: (a) => a.earthVisibleFraction * 100, digits: 0, better: "higher" },
  { key: "earthElevationDeg", label: "Earth elevation now", unit: "°", source: "ephemeris", value: (a) => a.earthElevationDeg, digits: 1 },
  { key: "slopeDeg", label: "Slope", unit: "°", source: "measured", value: (a) => a.slopeDeg, digits: 1, better: "lower" },
  { key: "iceIndex", label: "Water-ice potential", unit: "0–1", source: "model", value: (a) => a.iceIndex, digits: 2, better: "higher" },
  { key: "temperatureNowK", label: "Temperature now", unit: "K", source: "model", value: (a) => a.temperatureNowK, digits: 0 },
  { key: "maxTemperatureK", label: "Peak temperature (month)", unit: "K", source: "model", value: (a) => a.maxTemperatureK, digits: 0 },
  { key: "heightM", label: "Elevation", unit: "m", source: "measured", value: (a) => a.heightM, digits: 0 },
];

export const formatMetric = (row: MetricRow, analysis: PointAnalysis) => row.value(analysis).toFixed(row.digits);

export const SOURCE_NOTES: Record<MetricRow["source"], string> = {
  measured: "Measured: NASA LRO LOLA heights (1/16° grid, about 1.9 km). Slopes over shorter distances are understated.",
  ephemeris: "Ephemeris: Sun/Earth angles relative to a smooth sphere (about 0.02° accuracy); terrain blocking not included.",
  model: "Model estimate from Lunar Quest's simplified formulas. Not a measurement; do not use for mission planning.",
};
