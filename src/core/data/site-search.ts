// 在整月预计算地图里按条件找位置（"一年里最长断电不超过 50 小时、坡度小于 10° 的地方"）。
// 这里负责把地图文件读成数组、交给纯函数 terrain/site-search.ts 去筛选和排序，并带上来源和口径说明。
// 每次请求读一遍文件（约 19 MB），不在模块级缓存任何东西（服务端无状态，见 AGENTS.md 5.3）。读不到时抛错。
import { readFileSync } from "node:fs";
import path from "node:path";
import { searchSites, type SiteCriteria, type SiteRankBy, type SiteSearchMaps, type SiteSearchResult } from "../terrain/site-search";
import type { Provenance } from "../types";
import { openPrecomputedMaps, type PrecomputedMaps } from "./precomputed-maps";

export interface FindSitesOptions {
  rankBy: SiteRankBy;
  limit: number;
  /** 返回的位置两两至少隔这么远，公里。 */
  minSeparationKm: number;
}

export interface FindSitesResult extends SiteSearchResult {
  provenance: Provenance;
}

const FIND_SITES_PROVENANCE: Provenance = {
  status: "ok",
  source: "Whole-Moon precomputed maps from NASA LRO LOLA LDEM_64 + our ephemeris (pipeline v1, public/data/v1/manifest.json)",
  note:
    "One value per 0.25 degree map cell (about 7.6 km), taken at the cell centre; the position is the cell centre, not a surveyed landing point. " +
    "Fractions and outages cover the 8760 hours from 2030-01-01T00:00:00Z. A disk counts as visible when its upper limb is above the terrain horizon, and no minimum Earth elevation is applied, so Earth results are optimistic for direct communication. " +
    "slopeDeg is the mean slope over a 474 m baseline inside the cell, not a landing-safety slope. One year is not the worst year (18.6 year lunar orbit cycle). Not mission-grade.",
};

/** 把整个文件读进一块独立的内存（复制一份，保证按 2 字节对齐）。小端字节序，见 manifest。 */
function readUint16File(file: string): Uint16Array {
  const buffer = readFileSync(file);
  return new Uint16Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
}

function readInt16File(file: string): Int16Array {
  const buffer = readFileSync(file);
  return new Int16Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
}

function loadSearchMaps(maps: PrecomputedMaps): SiteSearchMaps {
  const { grid, terrain, stats } = maps.manifest;
  if (!stats) throw new Error("precomputed map manifest has no stats section");
  const cells = grid.width * grid.height;
  const statsData = readUint16File(path.join(maps.dir, stats.file));

  const plane = (key: string) => {
    const index = stats.planes.findIndex((candidate) => candidate.key === key);
    if (index < 0) throw new Error(`precomputed stats has no plane "${key}"`);
    return { values: statsData.subarray(index * cells, (index + 1) * cells), scale: stats.planes[index].scale };
  };
  const sun = plane("sunFraction");
  const earth = plane("earthFraction");
  const both = plane("bothFraction");
  const noSun = plane("longestNoSunH");
  const noEarth = plane("longestNoEarthH");
  const meanNoSun = plane("meanNoSunH");
  const meanEarth = plane("meanEarthWindowH");
  if (sun.scale !== earth.scale || sun.scale !== both.scale || meanNoSun.scale !== meanEarth.scale || noSun.scale !== 1 || noEarth.scale !== 1) {
    throw new Error("precomputed stats planes have unexpected scales");
  }

  return {
    width: grid.width,
    height: grid.height,
    ppd: grid.ppd,
    heightRaw: readInt16File(path.join(maps.dir, terrain.files.height)),
    heightUnitM: terrain.heightUnitM,
    slopeRaw: readUint16File(path.join(maps.dir, terrain.files.slope)),
    slopeScale: terrain.slopeScale,
    sunFractionRaw: sun.values,
    earthFractionRaw: earth.values,
    bothFractionRaw: both.values,
    fractionScale: sun.scale,
    longestNoSunH: noSun.values,
    longestNoEarthH: noEarth.values,
    meanNoSunRaw: meanNoSun.values,
    meanEarthWindowRaw: meanEarth.values,
    meanScale: meanNoSun.scale,
  };
}

/** 满足全部条件的位置（整月，0.25° 格子中心），按 rankBy 从好到差，最多 options.limit 个。 */
export function findSites(criteria: SiteCriteria, options: FindSitesOptions): FindSitesResult {
  const result = searchSites(loadSearchMaps(openPrecomputedMaps()), criteria, options.rankBy, options.limit, options.minSeparationKm);
  return { ...result, provenance: FIND_SITES_PROVENANCE };
}
