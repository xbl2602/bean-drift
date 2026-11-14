// 单点查询"这个位置该读哪份地形数据"——只在这里决定。
// 单点点位、多时刻对比、时间线都问这里要地形和地平线，不再各自去读预计算地图文件，
// 所以以后多一份数据（比如南极高精度）只需要在 TERRAIN_SOURCES 里加一项，调用方一行都不用动。
//
// 规则：列表按顺序找，第一个"负责这个位置"的数据源胜出；所以范围小的、精度高的放前面，全月兜底放最后。
// 没有任何数据源负责时抛错，不悄悄用别的数据顶上（用错分辨率比报错更难发现）。
// 这里不放任何模块级可变状态（服务端无状态，见 AGENTS.md 5.3）；TERRAIN_SOURCES 是只读列表。
import type { Provenance } from "../types";
import { openPrecomputedMaps, readHorizonProfileAt, readTerrainAt, type TerrainSample } from "./precomputed-maps";

export interface TerrainSource {
  /** 稳定的数据源编号，测试里用它断言"选对了"；之后也会写进返回结果的来源说明。 */
  id: string;
  /** 负责哪些位置。纬度 -90~90，经度已统一到 (-180, 180]（见 canonicalLonDeg）。边界归谁，由各数据源自己写清楚。 */
  covers(latDeg: number, lonDeg: number): boolean;
  readTerrain(latDeg: number, lonDeg: number): TerrainSample;
  /** 等间隔方位（从正北起，向东增加）上的遮挡仰角，度。 */
  readHorizonProfile(latDeg: number, lonDeg: number): number[];
  /** 地形这一组数据的来源和限制说明；horizonAzimuths 是这次实际返回的方位数。 */
  terrainProvenance(horizonAzimuths: number): Provenance;
}

export interface PointTerrainData {
  source: TerrainSource;
  terrain: TerrainSample;
  horizonProfileDeg: number[];
}

const GLOBAL_DEM_SOURCE =
  "NASA LRO LOLA global DEM LDEM_64 (473.8 m/pixel), averaged into 0.25 degree map cells (pipeline v1, public/data/v1/manifest.json)";

/** 全月预计算地图（0.25°格子）。负责整个月球，所以必须放在列表最后当兜底。 */
const globalTerrainSource: TerrainSource = {
  id: "global-0.25deg",
  covers: () => true,
  readTerrain: (latDeg, lonDeg) => readTerrainAt(openPrecomputedMaps(), latDeg, lonDeg),
  readHorizonProfile: (latDeg, lonDeg) => readHorizonProfileAt(openPrecomputedMaps(), latDeg, lonDeg),
  terrainProvenance: (azimuths) => ({
    status: "ok",
    source: GLOBAL_DEM_SOURCE,
    note:
      "Height and slope are interpolated between map cells of 0.25 degrees (about 7.6 km); slope is the mean over a 474 m baseline inside the cell, not the slope at the exact point, so it is not a landing-safety slope. " +
      `The horizon profile has ${azimuths} azimuths (${360 / azimuths} degree steps), computed from the cell centre with rays up to 300 km on a spherical Moon, and interpolated between cells.`,
  }),
};

/** 单点查询可用的数据源，范围小、精度高的在前，全月兜底在最后。 */
export const TERRAIN_SOURCES: readonly TerrainSource[] = [globalTerrainSource];

/** 这个位置该用哪份数据。sources 只给测试注入假数据源用，业务代码不要传。 */
export function chooseTerrainSource(latDeg: number, lonDeg: number, sources: readonly TerrainSource[] = TERRAIN_SOURCES): TerrainSource {
  const source = sources.find((candidate) => candidate.covers(latDeg, lonDeg));
  if (!source) throw new Error(`no terrain data source covers latitude ${latDeg}, longitude ${lonDeg}`);
  return source;
}

/** 某点的地形和地平线，以及这些数来自哪份数据。读不到数据文件时抛错，由调用方降级。 */
export function readPointTerrainData(latDeg: number, lonDeg: number, sources: readonly TerrainSource[] = TERRAIN_SOURCES): PointTerrainData {
  const source = chooseTerrainSource(latDeg, lonDeg, sources);
  return { source, terrain: source.readTerrain(latDeg, lonDeg), horizonProfileDeg: source.readHorizonProfile(latDeg, lonDeg) };
}

/** 只要地平线剖面时用（时间线不需要地形高度、坡度，不必多读那几个文件）。 */
export function readPointHorizonProfile(latDeg: number, lonDeg: number, sources: readonly TerrainSource[] = TERRAIN_SOURCES): number[] {
  return chooseTerrainSource(latDeg, lonDeg, sources).readHorizonProfile(latDeg, lonDeg);
}
