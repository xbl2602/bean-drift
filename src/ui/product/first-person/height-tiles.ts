// 读取 public/product/moon/height-tiles/ 里的 16 位 LOLA 高度小块（10°×10°，每块 160×160 像素），
// 按经纬度双线性插值取高度（米，相对 1737.4 km 参考球）。小块在浏览器里缓存，同一块只下载、解码一次。
import { HEIGHT_TILES, MOON_RADIUS_M } from "../moon-assets";
import type { LatLon } from "../moon-frames";

const ROWS = 180 / HEIGHT_TILES.tileDeg;
const COLS = 360 / HEIGHT_TILES.tileDeg;

export interface HeightField {
  heightAtM: (latDeg: number, lonDeg: number) => number;
}

async function decodeTile(url: string): Promise<Float32Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`height tile ${url} returned ${response.status}`);
  // colorSpaceConversion: "none" 很重要：否则浏览器可能做颜色管理，把编码在颜色里的高度数值改掉
  const bitmap = await createImageBitmap(await response.blob(), { colorSpaceConversion: "none", premultiplyAlpha: "none" });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas is not available");
  ctx.drawImage(bitmap, 0, 0);
  const rgba = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
  const heights = new Float32Array(bitmap.width * bitmap.height);
  for (let i = 0; i < heights.length; i++) heights[i] = HEIGHT_TILES.decodeHeightM(rgba[i * 4], rgba[i * 4 + 1]);
  return heights;
}

// 浏览器端的小块缓存（只存在于当前标签页）。下载失败的不留在缓存里，下次可以重试。
const tilePromises = new Map<string, Promise<Float32Array>>();
const tilesReady = new Map<string, Float32Array>();

function loadTile(row: number, col: number): Promise<Float32Array> {
  const key = `${row}-${col}`;
  let promise = tilePromises.get(key);
  if (!promise) {
    promise = decodeTile(HEIGHT_TILES.urlFor(row, col)).then((tile) => {
      tilesReady.set(key, tile);
      return tile;
    });
    promise.catch(() => tilePromises.delete(key));
    tilePromises.set(key, promise);
  }
  return promise;
}

/** 以 center 为中心、半径 radiusM 的范围要用到哪些小块。靠近极点时经度范围变大，直接取整圈。 */
function tilesCovering(center: LatLon, radiusM: number): Array<[number, number]> {
  const marginDeg = (radiusM / MOON_RADIUS_M) * (180 / Math.PI) + 0.5;
  const latMin = Math.max(center.latDeg - marginDeg, -90);
  const latMax = Math.min(center.latDeg + marginDeg, 90);
  const cosLat = Math.cos((Math.max(Math.abs(latMin), Math.abs(latMax)) * Math.PI) / 180);
  const lonSpanDeg = cosLat < 0.05 ? 360 : Math.min(marginDeg / cosLat, 180);
  const rowOf = (latDeg: number) => Math.min(Math.max(Math.floor((90 - latDeg) / HEIGHT_TILES.tileDeg), 0), ROWS - 1);
  const rows: number[] = [];
  for (let row = rowOf(latMax); row <= rowOf(latMin); row++) rows.push(row);
  const cols = new Set<number>();
  if (lonSpanDeg >= 180) for (let c = 0; c < COLS; c++) cols.add(c);
  else {
    const first = Math.floor((center.lonDeg - lonSpanDeg + 180) / HEIGHT_TILES.tileDeg);
    const last = Math.floor((center.lonDeg + lonSpanDeg + 180) / HEIGHT_TILES.tileDeg);
    for (let c = first; c <= last; c++) cols.add(((c % COLS) + COLS) % COLS);
  }
  return rows.flatMap((row) => [...cols].map((col) => [row, col] as [number, number]));
}

// 全局像素坐标取值；该块还没加载时退回 0 m（调用方先 await 对应范围，正常不会走到）
function samplePixel(gx: number, gy: number): number {
  const { tilePx, widthPx, heightPx } = HEIGHT_TILES;
  const x = ((gx % widthPx) + widthPx) % widthPx;
  const y = Math.min(Math.max(gy, 0), heightPx - 1);
  const tile = tilesReady.get(`${Math.floor(y / tilePx)}-${Math.floor(x / tilePx)}`);
  return tile ? tile[(y % tilePx) * tilePx + (x % tilePx)] : 0;
}

function heightAtM(latDeg: number, lonDeg: number): number {
  const fx = (lonDeg + 180) * HEIGHT_TILES.pixelsPerDeg - 0.5;
  const fy = (90 - latDeg) * HEIGHT_TILES.pixelsPerDeg - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const top = samplePixel(x0, y0) * (1 - tx) + samplePixel(x0 + 1, y0) * tx;
  const bottom = samplePixel(x0, y0 + 1) * (1 - tx) + samplePixel(x0 + 1, y0 + 1) * tx;
  return top * (1 - ty) + bottom * ty;
}

/** 加载 center 周围 radiusM 范围的小块，返回可同步取高度的对象。 */
export async function loadHeightField(center: LatLon, radiusM: number): Promise<HeightField> {
  await Promise.all(tilesCovering(center, radiusM).map(([row, col]) => loadTile(row, col)));
  return { heightAtM };
}

export interface GroundSample {
  heightM: number;
  slopeDeg: number;
  /** 坡面朝东、朝北的分量（无量纲 dh/ds）。 */
  gradEast: number;
  gradNorth: number;
}

/** 单点的高度和坡度。坡度用相邻 1/16° 像素的中心差分，和离线生成 slope 贴图的算法一致。 */
export async function sampleGround(point: LatLon): Promise<GroundSample> {
  const stepDeg = 1 / HEIGHT_TILES.pixelsPerDeg;
  const field = await loadHeightField(point, MOON_RADIUS_M * ((stepDeg * 2 * Math.PI) / 180));
  const northStepM = MOON_RADIUS_M * ((stepDeg * Math.PI) / 180);
  const eastStepM = Math.max(northStepM * Math.cos((point.latDeg * Math.PI) / 180), northStepM * 0.02);
  const latN = Math.min(point.latDeg + stepDeg, 90);
  const latS = Math.max(point.latDeg - stepDeg, -90);
  const gradEast = (field.heightAtM(point.latDeg, point.lonDeg + stepDeg) - field.heightAtM(point.latDeg, point.lonDeg - stepDeg)) / (2 * eastStepM);
  const gradNorth = (field.heightAtM(latN, point.lonDeg) - field.heightAtM(latS, point.lonDeg)) / (((latN - latS) / stepDeg) * northStepM);
  return {
    heightM: field.heightAtM(point.latDeg, point.lonDeg),
    slopeDeg: (Math.atan(Math.hypot(gradEast, gradNorth)) * 180) / Math.PI,
    gradEast,
    gradNorth,
  };
}
