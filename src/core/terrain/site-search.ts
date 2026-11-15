// 在整月地图里按条件找格子：纯函数，没有任何 import（不依赖 Node、HTTP、文件），数组由调用方读好传进来。
// 每个格子是 1/ppd 度见方，值以格子中心为代表（口径见 public/data/v1/manifest.json）。

export interface SiteSearchMaps {
  width: number;
  height: number;
  /** 每度多少格（4 = 0.25°）。第 0 行是北端，第 0 列是西端（经度 -180°）。 */
  ppd: number;
  heightRaw: ArrayLike<number>;
  heightUnitM: number;
  slopeRaw: ArrayLike<number>;
  slopeScale: number;
  sunFractionRaw: ArrayLike<number>;
  earthFractionRaw: ArrayLike<number>;
  bothFractionRaw: ArrayLike<number>;
  fractionScale: number;
  /** 最长断电 / 最长断信号，小时（不缩放）。 */
  longestNoSunH: ArrayLike<number>;
  longestNoEarthH: ArrayLike<number>;
  meanNoSunRaw: ArrayLike<number>;
  meanEarthWindowRaw: ArrayLike<number>;
  meanScale: number;
}

export interface SiteCriteria {
  minSlopeDeg?: number;
  maxSlopeDeg?: number;
  minSunVisibleFraction?: number;
  minEarthVisibleFraction?: number;
  minBothVisibleFraction?: number;
  maxLongestSunOutageH?: number;
  maxLongestEarthOutageH?: number;
  latMinDeg?: number;
  latMaxDeg?: number;
  lonMinDeg?: number;
  lonMaxDeg?: number;
}

export type SiteRankBy = "bothVisibleFraction" | "sunVisibleFraction" | "earthVisibleFraction" | "lowestSlope" | "highestSlope";

export interface SiteMatch {
  latDeg: number;
  lonDeg: number;
  heightM: number;
  slopeDeg: number;
  sunVisibleFraction: number;
  earthVisibleFraction: number;
  bothVisibleFraction: number;
  longestSunOutageH: number;
  longestEarthOutageH: number;
  meanSunOutageH: number;
  meanEarthWindowH: number;
}

export interface SiteSearchResult {
  /** 满足全部条件的格子总数（不是返回的条数）。 */
  matchedCells: number;
  totalCells: number;
  sites: SiteMatch[];
}

const MOON_RADIUS_KM = 1737.4;
/** 排序键 = 分数 * INDEX_RANGE + 格子序号，装进一个 Float64（精确整数）后用原生数值排序，比带比较函数的排序快得多。 */
const INDEX_RANGE = 2 ** 21;

function rawLimit(value: number | undefined, scale: number, fallback: number): number {
  return value === undefined ? fallback : value * scale;
}

function greatCircleKm(latA: number, lonA: number, latB: number, lonB: number): number {
  const rad = Math.PI / 180;
  const dLat = (latB - latA) * rad;
  const dLon = (lonB - lonA) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(latA * rad) * Math.cos(latB * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * MOON_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function scoreOf(maps: SiteSearchMaps, index: number, rankBy: SiteRankBy): number {
  switch (rankBy) {
    case "bothVisibleFraction":
      return maps.bothFractionRaw[index];
    case "sunVisibleFraction":
      return maps.sunFractionRaw[index];
    case "earthVisibleFraction":
      return maps.earthFractionRaw[index];
    case "highestSlope":
      return maps.slopeRaw[index];
    case "lowestSlope":
      return 65535 - maps.slopeRaw[index]; // 坡越小分越高
  }
}

function describeCell(maps: SiteSearchMaps, index: number): SiteMatch {
  const row = Math.floor(index / maps.width);
  const col = index % maps.width;
  const round = (value: number, digits: number) => Number(value.toFixed(digits));
  return {
    latDeg: round(90 - (row + 0.5) / maps.ppd, 4),
    lonDeg: round(-180 + (col + 0.5) / maps.ppd, 4),
    heightM: round(maps.heightRaw[index] * maps.heightUnitM, 1),
    slopeDeg: round(maps.slopeRaw[index] / maps.slopeScale, 2),
    sunVisibleFraction: round(maps.sunFractionRaw[index] / maps.fractionScale, 4),
    earthVisibleFraction: round(maps.earthFractionRaw[index] / maps.fractionScale, 4),
    bothVisibleFraction: round(maps.bothFractionRaw[index] / maps.fractionScale, 4),
    longestSunOutageH: maps.longestNoSunH[index],
    longestEarthOutageH: maps.longestNoEarthH[index],
    meanSunOutageH: round(maps.meanNoSunRaw[index] / maps.meanScale, 2),
    meanEarthWindowH: round(maps.meanEarthWindowRaw[index] / maps.meanScale, 2),
  };
}

/**
 * 找满足全部条件的格子，按 rankBy 从好到差排，相互至少隔 minSeparationKm（避免返回一堆挨着的格子），最多 limit 个。
 * 没写的条件不限制。
 */
export function searchSites(
  maps: SiteSearchMaps,
  criteria: SiteCriteria,
  rankBy: SiteRankBy,
  limit: number,
  minSeparationKm: number,
): SiteSearchResult {
  const totalCells = maps.width * maps.height;
  if (totalCells >= INDEX_RANGE) throw new RangeError("map is too large for the site search index");

  const minSlopeRaw = rawLimit(criteria.minSlopeDeg, maps.slopeScale, -Infinity);
  const maxSlopeRaw = rawLimit(criteria.maxSlopeDeg, maps.slopeScale, Infinity);
  const minSunRaw = rawLimit(criteria.minSunVisibleFraction, maps.fractionScale, -Infinity);
  const minEarthRaw = rawLimit(criteria.minEarthVisibleFraction, maps.fractionScale, -Infinity);
  const minBothRaw = rawLimit(criteria.minBothVisibleFraction, maps.fractionScale, -Infinity);
  const maxSunOutageH = criteria.maxLongestSunOutageH ?? Infinity;
  const maxEarthOutageH = criteria.maxLongestEarthOutageH ?? Infinity;
  const latMin = criteria.latMinDeg ?? -90;
  const latMax = criteria.latMaxDeg ?? 90;
  const lonMin = criteria.lonMinDeg ?? -180;
  const lonMax = criteria.lonMaxDeg ?? 180;

  const keys = new Float64Array(totalCells);
  let matched = 0;
  for (let row = 0; row < maps.height; row++) {
    const lat = 90 - (row + 0.5) / maps.ppd;
    if (lat < latMin || lat > latMax) continue;
    for (let col = 0; col < maps.width; col++) {
      const lon = -180 + (col + 0.5) / maps.ppd;
      if (lon < lonMin || lon > lonMax) continue;
      const index = row * maps.width + col;
      if (
        maps.slopeRaw[index] >= minSlopeRaw &&
        maps.slopeRaw[index] <= maxSlopeRaw &&
        maps.sunFractionRaw[index] >= minSunRaw &&
        maps.earthFractionRaw[index] >= minEarthRaw &&
        maps.bothFractionRaw[index] >= minBothRaw &&
        maps.longestNoSunH[index] <= maxSunOutageH &&
        maps.longestNoEarthH[index] <= maxEarthOutageH
      ) {
        keys[matched++] = scoreOf(maps, index, rankBy) * INDEX_RANGE + index;
      }
    }
  }

  const sorted = keys.subarray(0, matched).sort(); // 升序；从末尾往前取 = 分数最高的先取
  const picked: SiteMatch[] = [];
  for (let k = sorted.length - 1; k >= 0 && picked.length < limit; k--) {
    const index = sorted[k] % INDEX_RANGE;
    const site = describeCell(maps, index);
    const farEnough = picked.every((other) => greatCircleKm(site.latDeg, site.lonDeg, other.latDeg, other.lonDeg) >= minSeparationKm);
    if (farEnough) picked.push(site);
  }
  return { matchedCells: matched, totalCells, sites: picked };
}
