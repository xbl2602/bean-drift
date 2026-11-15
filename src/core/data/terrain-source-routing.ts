// 单点查询"这个位置该读哪份地形数据"——只在这里决定。
// 单点点位、多时刻对比、时间线都问这里要地形和地平线，不再各自去读预计算地图文件，
// 所以以后多一份数据（比如南极高精度）只需要在 TERRAIN_SOURCES 里加一项，调用方一行都不用动。
//
// 规则：列表按顺序找，第一个"负责这个位置"的数据源胜出；所以范围小的、精度高的放前面，全月兜底放最后。
// 没有任何数据源负责时抛错，不悄悄用别的数据顶上（用错分辨率比报错更难发现）。
// 这里不放任何模块级可变状态（服务端无状态，见 AGENTS.md 5.3）；TERRAIN_SOURCES 是只读列表。
import type { Provenance } from "../types";
import { computePolarHorizonProfile, loadPolarGrid, POLAR_COVERAGE_NORTH_LATDEG, readPolarTerrainAt } from "./polar-terrain";
import { loadGlobalHeightSampler, openPrecomputedMaps, readHorizonProfileAt, readTerrainAt, type TerrainSample } from "./precomputed-maps";

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
  /** 时间线的来源说明里要用的两句话：数据集是什么、地平线有多准。时间线不读地形高度，所以没有完整的 terrainProvenance。 */
  timelineTerrain: { source: string; horizonNote: string };
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
  timelineTerrain: {
    source: "NASA LRO LOLA LDEM_64 (0.25 degree map cells, public/data/v1/manifest.json)",
    horizonNote: "Horizon is the map cell horizon (about 7.6 km cells), not the exact point.",
  },
  terrainProvenance: (azimuths) => ({
    status: "ok",
    source: GLOBAL_DEM_SOURCE,
    note:
      "Height and slope are interpolated between map cells of 0.25 degrees (about 7.6 km); slope is the mean over a 474 m baseline inside the cell, not the slope at the exact point, so it is not a landing-safety slope. " +
      `The horizon profile has ${azimuths} azimuths (${360 / azimuths} degree steps), computed from the cell centre with rays up to 300 km on a spherical Moon, and interpolated between cells.`,
  }),
};

const POLAR_DEM_SOURCE =
  "NASA LRO LOLA south-polar DEM LDEM_80S_40M (40 m/pixel), averaged into 160 m cells (pipeline polar step, public/data/polar-v1/manifest.json)";

/** 南极（南纬 80° 到极点）160 m 高精度数据。地平线不预存，按点现算。负责纬度 ≤ -80°（正好 -80° 归它）。 */
const polarTerrainSource: TerrainSource = {
  id: "polar-160m",
  covers: (latDeg) => latDeg <= POLAR_COVERAGE_NORTH_LATDEG,
  readTerrain: (latDeg, lonDeg) => readPolarTerrainAt(loadPolarGrid(), latDeg, lonDeg),
  readHorizonProfile: (latDeg, lonDeg) => {
    // 射线走出 80°S 圈外才需要全月高度；用到时才读那 2 MB，只在这一次调用里用。
    let globalHeightM: ((latDeg: number, lonDeg: number) => number) | undefined;
    const outsideHeightM = (lat: number, lon: number) => (globalHeightM ??= loadGlobalHeightSampler(openPrecomputedMaps()))(lat, lon);
    return computePolarHorizonProfile(loadPolarGrid(), latDeg, lonDeg, outsideHeightM);
  },
  timelineTerrain: {
    source: "NASA LRO LOLA LDEM_80S_40M (160 m cells, 80 degrees S to the pole, public/data/polar-v1/manifest.json)",
    horizonNote: "Horizon is computed for the exact point from the 160 m cells (90 azimuths, rays up to 300 km); the 160 m averaging smooths very small relief.",
  },
  terrainProvenance: (azimuths) => ({
    status: "ok",
    source: POLAR_DEM_SOURCE,
    note:
      "Height is interpolated between 160 m cells (stereographic map metres, about 0.8% shorter on the ground at 80 degrees S); slope is the mean over the cell of the slope over an 80 m baseline, in 0.25 degree steps, so it is not a landing-safety slope at lander scale; " +
      "aspect is derived from the heights around the point over a 320 m baseline. " +
      `The horizon profile has ${azimuths} azimuths (${360 / azimuths} degree steps), computed for the exact point from the 160 m heights with rays up to 300 km on a spherical Moon; ` +
      "rays that leave the polar map (north of 80 degrees S) continue on the global 0.25 degree map.",
  }),
};

/** 单点查询可用的数据源，范围小、精度高的在前，全月兜底在最后。 */
export const TERRAIN_SOURCES: readonly TerrainSource[] = [polarTerrainSource, globalTerrainSource];

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

/** 时间线用：只要地平线剖面（不必多读高度、坡度文件），同时返回选中的数据源，来源说明要用。 */
export function readPointHorizonData(
  latDeg: number,
  lonDeg: number,
  sources: readonly TerrainSource[] = TERRAIN_SOURCES,
): { source: TerrainSource; horizonProfileDeg: number[] } {
  const source = chooseTerrainSource(latDeg, lonDeg, sources);
  return { source, horizonProfileDeg: source.readHorizonProfile(latDeg, lonDeg) };
}

/** 只要地平线剖面时用（不需要知道数据源是哪个）。 */
export function readPointHorizonProfile(latDeg: number, lonDeg: number, sources: readonly TerrainSource[] = TERRAIN_SOURCES): number[] {
  return chooseTerrainSource(latDeg, lonDeg, sources).readHorizonProfile(latDeg, lonDeg);
}
