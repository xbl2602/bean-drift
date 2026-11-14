// 某个点、某个时刻，太阳和地球在天空里的位置（方位角、高度角、视半径）。
// 为什么单独放一个文件：这些量要在拖时间轴时每一帧重算，不能走网络，所以直接用 src/core 里那一份纯计算的星历
// （和 /api/point 返回的 sun / earth 是同一个函数的输出，只差四舍五入）。
// 不要在浏览器端代码里 import "@/core/data"：它会读服务器上的预计算文件（node:fs），浏览器打包会失败。
// 地形遮挡后的可见性、一年统计这些要读文件的量，走 point-api/ 里向 /api/point 取数。
import { skyAtLatLon } from "@/core/ephemeris/ephemeris";
import { normalizeLonDeg, type LatLon } from "./moon-frames";

export interface SkyBody {
  azimuthDeg: number;
  elevationDeg: number;
  angularRadiusDeg: number;
}

export interface SkyConditions {
  timeUtc: string;
  /** 相对光滑球面地平线，不含地形遮挡。 */
  sun: SkyBody;
  earth: SkyBody;
}

export function skyConditionsAt(point: LatLon, timeMs: number): SkyConditions {
  const sky = skyAtLatLon(timeMs, point.latDeg, normalizeLonDeg(point.lonDeg));
  return {
    timeUtc: new Date(timeMs).toISOString(),
    sun: { azimuthDeg: sky.sun.azimuthDeg, elevationDeg: sky.sun.elevationDeg, angularRadiusDeg: sky.sun.angularRadiusDeg },
    earth: { azimuthDeg: sky.earth.azimuthDeg, elevationDeg: sky.earth.elevationDeg, angularRadiusDeg: sky.earth.angularRadiusDeg },
  };
}
