// 在 CPU 上读极区光照预计算图（polar-light-4k.png），给单点数值用（地图着色器直接用同一张图）。
// 整张图 4096×2048，只有南北纬 80° 以上有数据，所以只把顶部和底部各 10° 的像素条读进内存。
import { MOON_TEXTURES, POLAR_LIGHT } from "../moon-assets";
import type { LatLon } from "../moon-frames";
import type { PolarLight } from "./analysis-model";

interface PolarStrips {
  rows: number;
  north: Uint8ClampedArray;
  south: Uint8ClampedArray;
}

let stripsPromise: Promise<PolarStrips> | null = null;

async function loadStrips(): Promise<PolarStrips> {
  const response = await fetch(MOON_TEXTURES.polar);
  if (!response.ok) throw new Error(`polar light map returned ${response.status}`);
  const bitmap = await createImageBitmap(await response.blob(), { colorSpaceConversion: "none", premultiplyAlpha: "none" });
  const rows = Math.ceil(((90 - POLAR_LIGHT.minAbsLatDeg) / 180) * POLAR_LIGHT.heightPx) + 1;
  const canvas = new OffscreenCanvas(bitmap.width, rows);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas is not available");
  const strip = (sourceY: number) => {
    ctx.clearRect(0, 0, bitmap.width, rows);
    ctx.drawImage(bitmap, 0, sourceY, bitmap.width, rows, 0, 0, bitmap.width, rows);
    return ctx.getImageData(0, 0, bitmap.width, rows).data;
  };
  return { rows, north: strip(0), south: strip(bitmap.height - rows) };
}

/** 该点的极区光照数据；南北纬 80° 以内返回 null。取最近像素（约 0.04°）。 */
export async function samplePolarLight(point: LatLon): Promise<PolarLight | null> {
  if (Math.abs(point.latDeg) < POLAR_LIGHT.minAbsLatDeg) return null;
  stripsPromise ??= loadStrips();
  let strips: PolarStrips;
  try {
    strips = await stripsPromise;
  } catch (error) {
    stripsPromise = null; // 下次重试
    throw error;
  }
  const { widthPx, heightPx } = POLAR_LIGHT;
  const x = Math.min(Math.max(Math.floor((((point.lonDeg + 180) / 360) % 1) * widthPx), 0), widthPx - 1);
  const globalY = Math.min(Math.max(Math.floor(((90 - point.latDeg) / 180) * heightPx), 0), heightPx - 1);
  const isNorth = point.latDeg > 0;
  const y = isNorth ? globalY : globalY - (heightPx - strips.rows);
  const data = isNorth ? strips.north : strips.south;
  const o = (y * widthPx + x) * 4;
  return {
    sunMarginDeg: POLAR_LIGHT.decodeSunMarginDeg(data[o]),
    litFraction: data[o + 1] / 255,
    shadowProximity: data[o + 2] / 255,
  };
}
