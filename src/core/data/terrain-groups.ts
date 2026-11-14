// 把预计算的地形数据和现算的可见性、一年统计，拼成 PointConditions 里的 terrain / visibility / yearStats 三组。
// 读不到数据文件时降级成"不可用"（字段为 null + 说明），不让整个接口出错；错误细节不透传（可能带服务器路径）。
import type { SkyAtPoint } from "../ephemeris/ephemeris";
import type { HorizonSample, PointConditions, Provenance, TerrainParameters, Visibility, YearStats } from "../types";
import { readPointTerrainData } from "./terrain-source-routing";
import { computeVisibility, computeYearStats, YEAR_STATS_HOURS } from "./point-visibility";
import {
  emptyTerrain,
  emptyVisibility,
  emptyYearStats,
  unavailableTerrainProvenance,
  unavailableVisibilityProvenance,
  unavailableYearStatsProvenance,
} from "./unavailable-parameters";

export interface TerrainGroups {
  terrain: TerrainParameters;
  visibility: Visibility;
  yearStats: YearStats;
  provenance: Pick<PointConditions["provenance"], "terrain" | "visibility" | "yearStats">;
}

const round = (value: number, digits: number) => Number(value.toFixed(digits));

/** 选填的"地球最低仰角"生效时，追加到说明里的一句；没传返回空串。 */
function minElevationNote(minEarthElevationDeg: number | undefined): string {
  if (minEarthElevationDeg === undefined) return "";
  return (
    ` The Earth must also be above ${minEarthElevationDeg} degrees (applied to the upper limb of its disk, like the terrain rule); this affects the Earth only, not the Sun. ` +
    "The whole-Moon maps do not apply this extra requirement."
  );
}

function visibilityProvenance(minEarthElevationDeg: number | undefined): Provenance {
  return {
    status: "ok",
    source: "Sun/Earth ephemeris + terrain horizon profile (see provenance.terrain)",
    note:
      "A disk counts as visible when its upper limb is above the terrain horizon at the azimuth of the disk centre. diskVisibleFraction treats the horizon as a straight line at that elevation (0 = fully hidden, 1 = fully visible). " +
      "nextRiseUtc / nextSetUtc are searched up to 60 days ahead in 10 minute steps and refined to about 2 seconds; null means no change was found in that window." +
      minElevationNote(minEarthElevationDeg),
  };
}

function yearStatsProvenance(minEarthElevationDeg: number | undefined): Provenance {
  return {
    status: "ok",
    source: "Sun/Earth ephemeris + terrain horizon profile, computed per request",
    note:
      `Hourly samples (${YEAR_STATS_HOURS} hours) from 2030-01-01T00:00:00Z, same visibility rule as provenance.visibility. Runs cut by the start or end of the period count with their cut length. ` +
      "bothVisibleFraction is the share of hours in which the Sun and the Earth are visible at the same time. " +
      "One year is not the worst year: the Moon's orbit has an 18.6 year cycle that changes how far Sun and Earth swing above and below the horizon near the poles. " +
      "The whole-Moon maps (L4-L7) use the same rule at the map cell centre, so they can differ slightly from this exact-point result." +
      minElevationNote(minEarthElevationDeg),
  };
}

function unavailableGroups(): TerrainGroups {
  const unreadable = (p: Provenance): Provenance => ({ ...p, note: "The precomputed terrain data could not be read on this server right now; all fields are null. Try again later." });
  return {
    terrain: emptyTerrain(),
    visibility: emptyVisibility(),
    yearStats: emptyYearStats(),
    provenance: {
      terrain: unreadable(unavailableTerrainProvenance()),
      visibility: unreadable(unavailableVisibilityProvenance()),
      yearStats: unreadable(unavailableYearStatsProvenance()),
    },
  };
}

export function buildTerrainGroups(latDeg: number, lonDeg: number, timeMs: number, sky: SkyAtPoint, minEarthElevationDeg?: number): TerrainGroups {
  try {
    const { source, terrain, horizonProfileDeg: profileDeg } = readPointTerrainData(latDeg, lonDeg);
    const azimuths = profileDeg.length;
    const horizonProfile: HorizonSample[] = profileDeg.map((elevationDeg, k) => ({ azimuthDeg: (k * 360) / azimuths, elevationDeg: round(elevationDeg, 2) }));
    return {
      terrain: {
        heightM: round(terrain.heightM, 1),
        slopeDeg: round(terrain.slopeDeg, 2),
        aspectDeg: terrain.aspectDeg === null ? null : round(terrain.aspectDeg, 1),
        horizonProfile,
        resolutionM: Math.round(terrain.resolutionM),
      },
      visibility: computeVisibility(profileDeg, latDeg, lonDeg, timeMs, sky, minEarthElevationDeg),
      yearStats: computeYearStats(profileDeg, latDeg, lonDeg, minEarthElevationDeg),
      provenance: {
        terrain: source.terrainProvenance(azimuths),
        visibility: visibilityProvenance(minEarthElevationDeg),
        yearStats: yearStatsProvenance(minEarthElevationDeg),
      },
    };
  } catch {
    return unavailableGroups();
  }
}
