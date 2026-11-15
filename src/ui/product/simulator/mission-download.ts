// 下载：任务结果（配置 + 关键数字 + 事件 + 曲线点）和基地位置数据，都是 JSON，数值带单位和来源。
import type { PointAnalysis } from "../analysis/point-analysis";
import { formatLatLon, type LatLon } from "../moon-frames";
import type { PointApiState } from "../point-api/use-point-api";
import { downloadTextFile } from "../sites/export-results";
import { METRIC_ROWS, SOURCE_NOTES, formatMetric } from "../sites/metric-rows";
import { operatingLoadW, survivalLoadW } from "./mission-presets";
import type { MissionRun } from "./use-mission-run";

const fileStem = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "location";
const round = (value: number, digits = 2) => (Number.isFinite(value) ? Number(value.toFixed(digits)) : null);

export function downloadMissionResult({ point, config, windows, result }: MissionRun) {
  const report = {
    generatedBy: "Lunar Quest mission simulator",
    location: { name: point.label, latDeg: point.latDeg, lonDeg: point.lonDeg, text: formatLatLon(point) },
    plan: {
      missionType: config.type,
      startUtc: new Date(config.startMs).toISOString(),
      durationDays: config.durationDays,
      solarW: config.solarW,
      batteryWh: config.batteryWh,
      nuclearW: config.nuclearW,
      operatingLoadW: operatingLoadW(config),
      survivalLoadW: survivalLoadW(config),
      crew: config.crewed ? config.crew : 0,
      minEarthElevationDeg: config.minEarthElevationDeg,
    },
    outcome: result.outcome,
    score: result.score,
    failedAtUtc: result.failedAtMs === null ? null : new Date(result.failedAtMs).toISOString(),
    kpis: {
      operatingFraction: round(result.operatingFraction, 3),
      sunlitFraction: round(result.sunFraction, 3),
      earthContactFraction: round(result.earthFraction, 3),
      minBatteryPct: round(result.minBatteryPct, 1),
      longestDarknessH: round(result.longestDarkH, 1),
      longestNoContactH: round(result.longestNoContactH, 1),
      batteryEnduranceSleepingH: round(result.batteryEnduranceH, 1),
      energyGeneratedKWh: round(result.energyGeneratedKWh, 1),
      energyUsedKWh: round(result.energyUsedKWh, 1),
      dataGeneratedGB: round(result.dataGeneratedGB, 2),
      dataReturnedGB: round(result.dataReturnedGB, 2),
    },
    events: result.events.map((event) => ({ timeUtc: new Date(event.timeMs).toISOString(), kind: event.kind })),
    batteryCurve: result.samples.map((s) => ({ timeUtc: new Date(s.timeMs).toISOString(), batteryPct: round(s.batteryPct, 1), sunlit: s.sun, earthInView: s.earth, mode: s.mode })),
    sunlitWindows: windows.sun.map((w) => ({ startUtc: new Date(w.startMs).toISOString(), endUtc: new Date(w.endMs).toISOString() })),
    earthContactWindows: windows.earth.map((w) => ({ startUtc: new Date(w.startMs).toISOString(), endUtc: new Date(w.endMs).toISOString() })),
    dataSource: windows.source,
    assumptions: "Simplified model: 15-minute steps, panels always face the Sun, 90% battery charging efficiency, sleep below 25% battery when there is no sunlight, no relay satellites, typical (not mission-specific) equipment values.",
  };
  downloadTextFile(`lunar-quest-mission-${config.type}-${fileStem(point.label)}-${report.plan.startUtc.slice(0, 10)}.json`, "application/json", JSON.stringify(report, null, 2));
}

/** 下载基地位置在地图当前时刻的数据：我们的模型数值（带单位和来源）+ /api/point 的地形遮挡结果。 */
export function downloadLocationData(point: LatLon & { label: string }, timeMs: number, analysis: PointAnalysis, pointApi: PointApiState) {
  const report = {
    location: point.label,
    position: { latDeg: point.latDeg, lonDeg: point.lonDeg, text: formatLatLon(point) },
    timeUtc: new Date(timeMs).toISOString(),
    metrics: METRIC_ROWS.map((row) => ({ key: row.key, label: row.label, value: Number(formatMetric(row, analysis)), unit: row.unit, source: row.source })),
    sourceNotes: SOURCE_NOTES,
    terrainAdjusted: pointApi.data ?? null,
    generatedBy: "Lunar Quest",
  };
  downloadTextFile(`lunar-quest-${fileStem(point.label)}-${report.timeUtc.slice(0, 10)}.json`, "application/json", JSON.stringify(report, null, 2));
}
