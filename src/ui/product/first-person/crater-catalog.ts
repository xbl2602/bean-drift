// 真实撞击坑：从 public/product/moon/craters/ 的 10°×10° 小块里取出观察点周围的坑（Robbins 月球撞击坑数据库，
// 直径 ≥ 1 km 约 130 万个），换算成"离观察点往东、往北多少米"。第一人称里近处能看到的大坑就是这些真实的坑，
// 位置和大小都是实测的。小块生成方法见 data-build/build-crater-tiles.mjs。
import { MOON_RADIUS_M } from "../moon-assets";
import { MOON_ASSET_BASE } from "../moon-texture-urls";
import { latLonToBody, localBasis, type LatLon } from "../moon-frames";

const TILE_DEG = 10;
const ROWS = 180 / TILE_DEG;
const COLS = 360 / TILE_DEG;
const DIAMETER_UNIT_M = 40; // 文件里直径的单位是 0.04 km

export interface RealCrater {
  eastM: number;
  northM: number;
  radiusM: number;
  /** 0 = 磨损得很厉害的老坑，1 = 轮廓清晰的新坑（来自数据库里"坑沿被识别出的比例"）。 */
  crispness: number;
}

interface Tile {
  lat: Uint16Array;
  lon: Uint16Array;
  diameter: Uint16Array;
  arc: Uint8Array;
}

const tiles = new Map<string, Promise<Tile>>();

async function loadTile(row: number, col: number): Promise<Tile> {
  const key = `${row}-${col}`;
  let promise = tiles.get(key);
  if (!promise) {
    promise = fetch(`${MOON_ASSET_BASE}/craters/${key}.bin`).then(async (response) => {
      if (!response.ok) throw new Error(`crater tile ${key} returned ${response.status}`);
      const buffer = await response.arrayBuffer();
      const n = new DataView(buffer).getUint32(0, true);
      return {
        lat: new Uint16Array(buffer.slice(4, 4 + n * 2)),
        lon: new Uint16Array(buffer.slice(4 + n * 2, 4 + n * 4)),
        diameter: new Uint16Array(buffer.slice(4 + n * 4, 4 + n * 6)),
        arc: new Uint8Array(buffer.slice(4 + n * 6, 4 + n * 7)),
      };
    });
    promise.catch(() => tiles.delete(key));
    tiles.set(key, promise);
  }
  return promise;
}

/** center 周围 radiusM 内要读哪些小块；靠近极点时经度范围变大，直接取整圈。 */
function tilesAround(center: LatLon, radiusM: number): Array<[number, number]> {
  const marginDeg = (radiusM / MOON_RADIUS_M) * (180 / Math.PI) + 0.1;
  const latMin = Math.max(center.latDeg - marginDeg, -90);
  const latMax = Math.min(center.latDeg + marginDeg, 90);
  const cosLat = Math.cos((Math.max(Math.abs(latMin), Math.abs(latMax)) * Math.PI) / 180);
  const lonSpanDeg = cosLat < 0.05 ? 360 : Math.min(marginDeg / cosLat, 180);
  const rowOf = (lat: number) => Math.min(Math.max(Math.floor((90 - lat) / TILE_DEG), 0), ROWS - 1);
  const cols = new Set<number>();
  if (lonSpanDeg >= 180) for (let c = 0; c < COLS; c++) cols.add(c);
  else {
    const first = Math.floor((center.lonDeg - lonSpanDeg + 180) / TILE_DEG);
    const last = Math.floor((center.lonDeg + lonSpanDeg + 180) / TILE_DEG);
    for (let c = first; c <= last; c++) cols.add(((c % COLS) + COLS) % COLS);
  }
  const result: Array<[number, number]> = [];
  for (let row = rowOf(latMax); row <= rowOf(latMin); row++) for (const col of cols) result.push([row, col]);
  return result;
}

/** 观察点 center 周围 radiusM 米内的真实撞击坑，按离观察点的东、北距离给出。 */
export async function loadNearbyCraters(center: LatLon, radiusM: number): Promise<RealCrater[]> {
  const found = await Promise.all(tilesAround(center, radiusM).map(([row, col]) => loadTile(row, col).then((tile) => ({ tile, row, col }))));
  const basis = localBasis(center);
  const craters: RealCrater[] = [];
  for (const { tile, row, col } of found) {
    const south = 90 - (row + 1) * TILE_DEG;
    const west = -180 + col * TILE_DEG;
    for (let i = 0; i < tile.diameter.length; i++) {
      const latDeg = south + (tile.lat[i] / 65535) * TILE_DEG;
      const lonDeg = west + (tile.lon[i] / 65535) * TILE_DEG;
      const body = latLonToBody({ latDeg, lonDeg });
      const eastM = body.dot(basis.east) * MOON_RADIUS_M;
      const northM = body.dot(basis.north) * MOON_RADIUS_M;
      if (body.dot(basis.up) < 0) continue; // 在月球另一面
      const radius = (tile.diameter[i] * DIAMETER_UNIT_M) / 2;
      if (Math.hypot(eastM, northM) > radiusM + radius) continue;
      craters.push({ eastM, northM, radiusM: radius, crispness: tile.arc[i] / 255 });
    }
  }
  return craters;
}
