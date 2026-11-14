// 同一个点在几个不同时刻的对比："8 月 3 日和 12 月 3 日，这个点有什么不同"。
// 地形和一年统计和时刻无关，每个点只算一次；每个时刻只给随时间变化的部分（太阳和地球的方向、此刻可见多少、下次升起落下）。
import { skyAtLatLon } from "../ephemeris/ephemeris";
import type { LunarPosition, PointQueryOptions, Provenance } from "../types";
import { canonicalLonDeg } from "./point-conditions";
import { computeVisibility, computeYearStats } from "./point-visibility";
import { readPointTerrainData } from "./terrain-source-routing";

export interface BodySnapshot {
  azimuthDeg: number;
  elevationDeg: number;
  /** 圆盘露在地形地平线之上的比例，0~1。 */
  diskVisibleFraction: number;
  nextRiseUtc: string | null;
  nextSetUtc: string | null;
}

export interface TimeSnapshot {
  timeUtc: string;
  sun: BodySnapshot;
  earth: BodySnapshot;
}

export interface PointAcrossTimes {
  position: LunarPosition;
  /** 与时刻无关。 */
  terrain: { heightM: number; slopeDeg: number; aspectDeg: number | null; resolutionM: number };
  /** 与你查询的时刻无关：固定是 2030-01-01 起的一年。 */
  yearStats: {
    periodStartUtc: string | null;
    periodEndUtc: string | null;
    sunVisibleFraction: number | null;
    earthVisibleFraction: number | null;
    bothVisibleFraction: number | null;
    longestSunOutageH: number | null;
    longestEarthOutageH: number | null;
  };
  /** 与输入的时刻顺序一致。 */
  snapshots: TimeSnapshot[];
  assumptions: { minEarthElevationDeg: number | null };
}

const round = (value: number, digits: number) => Number(value.toFixed(digits));

export const POINT_ACROSS_TIMES_PROVENANCE: Provenance = {
  status: "ok",
  source: "Sun/Earth ephemeris + terrain from NASA LRO LOLA LDEM_64 (0.25 degree map cells, public/data/v1/manifest.json)",
  note:
    "Per time: same visibility rule as get_point_conditions (disk upper limb above the terrain horizon); nextRiseUtc / nextSetUtc are searched up to 60 days ahead, null = no change found. " +
    "terrain and yearStats do not depend on the time (yearStats is always the 8760 hours from 2030-01-01T00:00:00Z). " +
    "Heights and slopes are 0.25 degree map cell values (about 7.6 km), slope is not a landing-safety slope. Ephemeris accuracy about 0.02 degrees, not mission-grade.",
};

/** 一个点在 timesMs 里每个时刻的情况。读不到预计算地形数据时抛错。 */
export function getPointAcrossTimes(position: LunarPosition, timesMs: readonly number[], options: PointQueryOptions = {}): PointAcrossTimes {
  const latDeg = position.latDeg;
  const lonDeg = canonicalLonDeg(position.lonDeg);
  const floorDeg = options.minEarthElevationDeg;
  const { terrain, horizonProfileDeg: profileDeg } = readPointTerrainData(latDeg, lonDeg);
  const year = computeYearStats(profileDeg, latDeg, lonDeg, floorDeg);

  const snapshots = timesMs.map((timeMs): TimeSnapshot => {
    const sky = skyAtLatLon(timeMs, latDeg, lonDeg);
    const visibility = computeVisibility(profileDeg, latDeg, lonDeg, timeMs, sky, floorDeg);
    const body = (which: "sun" | "earth"): BodySnapshot => ({
      azimuthDeg: round(sky[which].azimuthDeg, 3),
      elevationDeg: round(sky[which].elevationDeg, 3),
      diskVisibleFraction: visibility[which].diskVisibleFraction ?? 0,
      nextRiseUtc: visibility[which].nextRiseUtc,
      nextSetUtc: visibility[which].nextSetUtc,
    });
    return { timeUtc: new Date(timeMs).toISOString(), sun: body("sun"), earth: body("earth") };
  });

  return {
    position: { latDeg, lonDeg },
    terrain: {
      heightM: round(terrain.heightM, 1),
      slopeDeg: round(terrain.slopeDeg, 2),
      aspectDeg: terrain.aspectDeg === null ? null : round(terrain.aspectDeg, 1),
      resolutionM: Math.round(terrain.resolutionM),
    },
    yearStats: {
      periodStartUtc: year.periodStartUtc,
      periodEndUtc: year.periodEndUtc,
      sunVisibleFraction: year.sun.visibleFraction,
      earthVisibleFraction: year.earth.visibleFraction,
      bothVisibleFraction: year.bothVisibleFraction,
      longestSunOutageH: year.sun.longestOutageH,
      longestEarthOutageH: year.earth.longestOutageH,
    },
    snapshots,
    assumptions: { minEarthElevationDeg: floorDeg ?? null },
  };
}
