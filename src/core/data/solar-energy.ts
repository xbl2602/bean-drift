// 太阳能量估算：一个点、一段时间里，直射阳光落在三种朝向的板子上的能量，以及最长黑夜要多少电池。
// 只算"能晒到多少太阳"，不含电池板效率、灰尘、衰减、温度、反射光，所以是"入射能量"不是"发电量"；
// 用法：把结果乘上你的板子效率和面积，再和负载比。口径和 get_point_timeline 一致：圆盘露出多少，就收到多少。
import { skyAtLatLon } from "../ephemeris/ephemeris";
import { diskVisibleFraction, horizonElevationDeg, summarizeVisibilityRuns } from "../terrain/visibility";
import type { LunarPosition, Provenance } from "../types";
import { canonicalLonDeg } from "./point-conditions";
import { readPointHorizonData } from "./terrain-source-routing";

/** 太阳常数：1 个天文单位处垂直于阳光的面上的总太阳辐照度，W/m2（SORCE/TIM 的 1360.8，Kopp & Lean 2011）。 */
export const SOLAR_CONSTANT_W_PER_M2 = 1360.8;
const ASTRONOMICAL_UNIT_KM = 149_597_870.7;
const HOUR_MS = 3_600_000;
const DEG = Math.PI / 180;

/** 一年以内的时间段用 10 分钟一个样，更长的用 30 分钟（全年约 1.75 万个样，约半秒）。 */
export const MAX_ENERGY_HOURS = 8760;
const FINE_STEP_MAX_HOURS = 744;

export interface SurfaceEnergy {
  /** 始终正对太阳的板子（两轴跟踪）。 */
  sunTracking: number;
  /** 竖直放置、绕竖直轴转向太阳方位的板子（南北极低太阳角时常见）。 */
  verticalTracking: number;
  /** 水平放平的板子（脚下是水平地面，局部坡度忽略）。 */
  horizontal: number;
}

export interface SolarEnergyEstimate {
  position: LunarPosition;
  startUtc: string;
  endUtc: string;
  durationH: number;
  sampleStepMin: number;
  /** 这段时间每平方米板子收到的直射太阳能量。 */
  energyWhPerM2: SurfaceEnergy;
  /** 上面的能量除以时间长度。 */
  meanPowerWPerM2: SurfaceEnergy;
  /** 采样点里的最大瞬时功率。 */
  peakPowerWPerM2: SurfaceEnergy;
  /** 太阳圆盘露出任何一部分的时间占比。 */
  sunVisibleFraction: number;
  /** 最长一次连续看不到太阳，小时。 */
  longestSunOutageH: number;
  /** 靠电池撑过最长黑夜，每 1 W 恒定负载要多少 Wh（= 最长黑夜小时数；不含放电深度和电池效率）。 */
  batteryWhPerWForLongestOutage: number;
  assumptions: { solarConstantWPerM2At1Au: number; panelEfficiency: null; dust: null; note: string };
  provenance: Provenance;
}

const round = (value: number, digits: number) => Number(value.toFixed(digits));

/** 一个采样时刻太阳的直射辐照度，W/m2（垂直于阳光的面）。日地距离按平方反比修正。 */
function beamIrradianceWPerM2(sunDistanceKm: number): number {
  return SOLAR_CONSTANT_W_PER_M2 * (ASTRONOMICAL_UNIT_KM / sunDistanceKm) ** 2;
}

function emptySurfaces(): SurfaceEnergy {
  return { sunTracking: 0, verticalTracking: 0, horizontal: 0 };
}

/**
 * 从 startMs 起、持续 durationH 小时的太阳能量估算。读不到预计算地形数据时抛错，由调用方处理。
 * 每个采样时刻：太阳圆盘露出的比例（按地形地平线）× 直射辐照度 × 板子朝向的余弦因子；时间段平均分成整数个等长步，用每步中点取样。
 */
export function getSolarEnergyEstimate(position: LunarPosition, startMs: number, durationH: number): SolarEnergyEstimate {
  const latDeg = position.latDeg;
  const lonDeg = canonicalLonDeg(position.lonDeg);
  const { source, horizonProfileDeg } = readPointHorizonData(latDeg, lonDeg);

  const targetStepMin = durationH <= FINE_STEP_MAX_HOURS ? 10 : 30;
  const stepCount = Math.max(1, Math.round((durationH * 60) / targetStepMin));
  const stepH = durationH / stepCount;
  const stepMs = stepH * HOUR_MS;

  const energyWh = emptySurfaces();
  const peakW = emptySurfaces();
  const sunVisible = new Uint8Array(stepCount);
  for (let k = 0; k < stepCount; k++) {
    const sky = skyAtLatLon(startMs + (k + 0.5) * stepMs, latDeg, lonDeg).sun;
    const horizonDeg = horizonElevationDeg(horizonProfileDeg, sky.azimuthDeg);
    const fraction = diskVisibleFraction(sky.elevationDeg, sky.angularRadiusDeg, horizonDeg);
    if (fraction <= 0) continue;
    sunVisible[k] = 1;
    const beamW = beamIrradianceWPerM2(sky.distanceKm) * fraction;
    const elevationRad = Math.max(0, sky.elevationDeg) * DEG;
    const powerW: SurfaceEnergy = { sunTracking: beamW, verticalTracking: beamW * Math.cos(elevationRad), horizontal: beamW * Math.sin(elevationRad) };
    for (const surface of ["sunTracking", "verticalTracking", "horizontal"] as const) {
      energyWh[surface] += powerW[surface] * stepH;
      if (powerW[surface] > peakW[surface]) peakW[surface] = powerW[surface];
    }
  }

  const runs = summarizeVisibilityRuns(sunVisible, stepH);
  const perSurface = (values: SurfaceEnergy, scale: number, digits: number): SurfaceEnergy => ({
    sunTracking: round(values.sunTracking * scale, digits),
    verticalTracking: round(values.verticalTracking * scale, digits),
    horizontal: round(values.horizontal * scale, digits),
  });

  return {
    position: { latDeg, lonDeg },
    startUtc: new Date(startMs).toISOString(),
    endUtc: new Date(startMs + durationH * HOUR_MS).toISOString(),
    durationH,
    sampleStepMin: round(stepH * 60, 2),
    energyWhPerM2: perSurface(energyWh, 1, 1),
    meanPowerWPerM2: perSurface(energyWh, 1 / durationH, 1),
    peakPowerWPerM2: perSurface(peakW, 1, 1),
    sunVisibleFraction: round(runs.visibleFraction, 4),
    longestSunOutageH: round(runs.longestOutageH, 2),
    batteryWhPerWForLongestOutage: round(runs.longestOutageH, 2),
    assumptions: {
      solarConstantWPerM2At1Au: SOLAR_CONSTANT_W_PER_M2,
      panelEfficiency: null,
      dust: null,
      note:
        "Direct sunlight only: no panel efficiency, dust, degradation, temperature effect or light reflected from terrain, so this is incident energy, not electrical output. " +
        "The horizontal surface is level ground at the point (the local slope is ignored).",
    },
    provenance: {
      status: "ok",
      source: `Sun ephemeris + terrain horizon profile from ${source.timelineTerrain.source}; solar constant ${SOLAR_CONSTANT_W_PER_M2} W/m2 at 1 AU (Kopp and Lean 2011), scaled by the Sun distance`,
      note:
        "Each step contributes the beam irradiance times the share of the Sun's disk above the terrain horizon, times the cosine of the angle between the sunlight and the surface; energy is summed over steps sampled at their midpoints. " +
        `Steps are ${round(stepH * 60, 2)} minutes. A disk counts as visible when its upper limb is above the terrain horizon (same rule as get_point_timeline). ` +
        `Sun positions are accurate to about 0.02 degrees, not mission-grade. ${source.timelineTerrain.horizonNote}`,
    },
  };
}
