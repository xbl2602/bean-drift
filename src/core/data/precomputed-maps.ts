// 读 pipeline 预计算出来的整月地图（public/data/v1/，格式见 pipeline/README.md 和 manifest.json）。
// 只读取单点附近需要的那几个字节（fs 定位读取），不把整个文件载入内存，也不在模块级缓存任何东西
// （服务端无状态，见 AGENTS.md 5.3）。任何读取失败都抛错，由调用方降级成"数据不可用"。
import { closeSync, openSync, readFileSync, readSync } from "node:fs";
import path from "node:path";

/** manifest.json 里这里要用到的部分。 */
export interface MapManifest {
  grid: { width: number; height: number; ppd: number };
  terrain: {
    files: { height: string; slope: string; aspect: string };
    heightUnitM: number;
    slopeScale: number;
    aspectScale: number;
    aspectNone: number;
  };
  horizon: { file: string; azimuths: number; horMinDeg: number; horMaxDeg: number };
  /** 一年统计图：按"平面"依次存放，key 和缩放系数以 manifest 为准。只有"按条件找位置"会读它，所以不强制要求。 */
  stats?: { file: string; planes: { key: string; scale: number }[] };
}

export interface PrecomputedMaps {
  dir: string;
  manifest: MapManifest;
}

export interface TerrainSample {
  /** 海拔，米，相对 1737.4 km 参考球。 */
  heightM: number;
  /** 坡度，度（格子内逐像素坡度的平均，约 474 m 基线）。 */
  slopeDeg: number;
  /** 下坡方向的方位角，度；格子平均是平地时为 null。 */
  aspectDeg: number | null;
  /** 一个地图格子的南北边长，米。 */
  resolutionM: number;
}

const MOON_RADIUS_M = 1_737_400;

/** 数据目录。Vercel 上由 next.config.ts 的 outputFileTracingIncludes 把这些文件打进函数包。 */
function dataDir(): string {
  return path.join(process.cwd(), "public", "data", "v1");
}

function isManifest(value: unknown): value is MapManifest {
  const m = value as MapManifest | null;
  return Boolean(
    m &&
      m.grid && Number.isFinite(m.grid.width) && Number.isFinite(m.grid.height) && Number.isFinite(m.grid.ppd) &&
      m.terrain?.files?.height && m.terrain.files.slope && m.terrain.files.aspect &&
      Number.isFinite(m.terrain.heightUnitM) && Number.isFinite(m.terrain.slopeScale) && Number.isFinite(m.terrain.aspectScale) &&
      m.horizon?.file && Number.isFinite(m.horizon.azimuths) && Number.isFinite(m.horizon.horMinDeg) && Number.isFinite(m.horizon.horMaxDeg),
  );
}

/** 打开预计算地图（读 manifest）。文件缺失或格式不对时抛错。 */
export function openPrecomputedMaps(): PrecomputedMaps {
  const dir = dataDir();
  const manifest: unknown = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8"));
  if (!isManifest(manifest)) throw new Error("precomputed map manifest is missing required fields");
  return { dir, manifest };
}

/** 一个点落在格子网格里的位置：四个相邻格子的行列号和插值权重。格子中心对齐，经度绕回，纬度夹在两极。 */
interface CellNeighbourhood {
  cols: [number, number];
  rows: [number, number];
  fx: number;
  fy: number;
}

function locateCells(grid: MapManifest["grid"], latDeg: number, lonDeg: number): CellNeighbourhood {
  const gx = (lonDeg + 180) * grid.ppd - 0.5;
  const gy = (90 - latDeg) * grid.ppd - 0.5;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const wrap = (x: number) => ((x % grid.width) + grid.width) % grid.width;
  const clamp = (y: number) => Math.min(grid.height - 1, Math.max(0, y));
  return { cols: [wrap(x0), wrap(x0 + 1)], rows: [clamp(y0), clamp(y0 + 1)], fx: gx - x0, fy: gy - y0 };
}

type CellReader = (row: number, col: number) => number;

/** 在一个已打开的文件上，按"第几个平面、第几行第几列"读一个值。 */
function cellReader(fd: number, grid: MapManifest["grid"], bytesPerValue: 1 | 2, signed: boolean): (plane: number) => CellReader {
  const buffer = Buffer.alloc(2);
  const planeValues = grid.width * grid.height;
  return (plane) => (row, col) => {
    readSync(fd, buffer, 0, bytesPerValue, (plane * planeValues + row * grid.width + col) * bytesPerValue);
    if (bytesPerValue === 1) return buffer[0];
    return signed ? buffer.readInt16LE(0) : buffer.readUInt16LE(0);
  };
}

function bilinear(cells: CellNeighbourhood, read: CellReader): number {
  const { cols, rows, fx, fy } = cells;
  const top = read(rows[0], cols[0]) * (1 - fx) + read(rows[0], cols[1]) * fx;
  const bottom = read(rows[1], cols[0]) * (1 - fx) + read(rows[1], cols[1]) * fx;
  return top * (1 - fy) + bottom * fy;
}

function withOpenFile<T>(file: string, use: (fd: number) => T): T {
  const fd = openSync(file, "r");
  try {
    return use(fd);
  } finally {
    closeSync(fd);
  }
}

/** 某点的高度、坡度、坡向。高度和坡度在相邻四个格子间双线性插值；坡向是角度，不插值，取最近的格子。 */
export function readTerrainAt(maps: PrecomputedMaps, latDeg: number, lonDeg: number): TerrainSample {
  const { grid, terrain } = maps.manifest;
  const cells = locateCells(grid, latDeg, lonDeg);
  const heightM = withOpenFile(path.join(maps.dir, terrain.files.height), (fd) => bilinear(cells, cellReader(fd, grid, 2, true)(0)) * terrain.heightUnitM);
  const slopeDeg = withOpenFile(path.join(maps.dir, terrain.files.slope), (fd) => bilinear(cells, cellReader(fd, grid, 2, false)(0)) / terrain.slopeScale);
  const aspectRaw = withOpenFile(path.join(maps.dir, terrain.files.aspect), (fd) =>
    cellReader(fd, grid, 2, false)(0)(cells.rows[cells.fy < 0.5 ? 0 : 1], cells.cols[cells.fx < 0.5 ? 0 : 1]),
  );
  return {
    heightM,
    slopeDeg,
    aspectDeg: aspectRaw === terrain.aspectNone ? null : aspectRaw / terrain.aspectScale,
    resolutionM: (MOON_RADIUS_M * Math.PI) / 180 / grid.ppd,
  };
}

/** 某点的地平线剖面：manifest.horizon.azimuths 个等间隔方位（从正北起，向东增加）上的遮挡仰角，度。 */
export function readHorizonProfileAt(maps: PrecomputedMaps, latDeg: number, lonDeg: number): number[] {
  const { grid, horizon } = maps.manifest;
  const cells = locateCells(grid, latDeg, lonDeg);
  const degreesPerByte = (horizon.horMaxDeg - horizon.horMinDeg) / 255;
  return withOpenFile(path.join(maps.dir, horizon.file), (fd) => {
    const readLayer = cellReader(fd, grid, 1, false);
    const profile: number[] = [];
    for (let k = 0; k < horizon.azimuths; k++) profile.push(horizon.horMinDeg + bilinear(cells, readLayer(k)) * degreesPerByte);
    return profile;
  });
}
