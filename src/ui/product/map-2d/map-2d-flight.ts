// 2D 平面图上的"自动飞行"镜头：选中一个着陆点、搜索一个地点时，视野从当前位置平滑移过去并缩放到目标大小。
// 纯函数，不碰 DOM、不碰 WebGL（和 3D 的 globe-3d/camera-flight.ts 是同一个思路、同一条曲线）。
//
// - 三个量各走一条五次 Hermite 曲线（motion/smooth-value.ts）：视野中心的经度方向 u、纬度方向 v、地图宽度的对数（缩放）。
//   起点速度和加速度是此刻真实的值，终点都是 0：起步和停下都没有突然的加速；飞到一半换目标，接着当前的速度走。
// - 经度方向是循环的：永远往"近的那一边"走，不会为了去 350° 而绕整个月球一圈。
// - 飞行时长不超过 3D 的最长飞行时间（MAX_FLIGHT_S）：别的界面会按它算"镜头什么时候飞完"（见 panels/site-photo.tsx）。
import { MAX_FLIGHT_S } from "../globe-3d/camera-flight";
import { quinticAt, type AxisState } from "../motion/smooth-value";
import { clampCamera, type MapCamera, type ScreenSize } from "./map-2d-camera";

interface Axis { from: AxisState; to: number }

export interface MapFlight {
  centerU: Axis;
  centerV: Axis;
  logMapWidth: Axis;
  startS: number;
  durationS: number;
}

const MIN_FLIGHT_S = 0.8;

/** 从 here（画面上此刻的视野）出发，飞到 target。current 不为空表示正在飞，就接着当前的速度换目标。 */
export function startMapFlight(target: MapCamera, nowMs: number, current: MapFlight | null, here: MapCamera): MapFlight {
  const startS = nowMs / 1000;
  const state = current ? flightStateAt(current, startS) : {
    centerU: stillAt(here.centerU),
    centerV: stillAt(here.centerV),
    logMapWidth: stillAt(Math.log(here.mapWidthPx)),
  };
  const uTo = state.centerU.value + wrapUnit(target.centerU - state.centerU.value);
  const logWidthTo = Math.log(target.mapWidthPx);
  const panDeg = Math.hypot((target.centerV - state.centerV.value) * 180, (uTo - state.centerU.value) * 360 * Math.cos((target.centerV - 0.5) * Math.PI));
  const zoomDistance = Math.abs(logWidthTo - state.logMapWidth.value);
  return {
    centerU: { from: state.centerU, to: uTo },
    centerV: { from: state.centerV, to: target.centerV },
    logMapWidth: { from: state.logMapWidth, to: logWidthTo },
    startS,
    durationS: clamp(0.8 + 0.35 * ((panDeg * Math.PI) / 180) + 0.25 * zoomDistance, MIN_FLIGHT_S, MAX_FLIGHT_S),
  };
}

/** 飞行路线上 nowMs 时刻的视野（已按当前屏幕尺寸夹紧，不会露出黑边）。arrived 为 true 表示已经到达。 */
export function mapCameraOnFlight(flight: MapFlight, nowMs: number, screen: ScreenSize): { camera: MapCamera; arrived: boolean } {
  const tS = nowMs / 1000;
  const state = flightStateAt(flight, tS);
  return {
    camera: clampCamera({ centerU: state.centerU.value, centerV: state.centerV.value, mapWidthPx: Math.exp(state.logMapWidth.value) }, screen),
    arrived: tS - flight.startS >= flight.durationS,
  };
}

function flightStateAt(flight: MapFlight, tS: number) {
  const elapsedS = tS - flight.startS;
  return {
    centerU: quinticAt(flight.centerU.from, flight.centerU.to, elapsedS, flight.durationS),
    centerV: quinticAt(flight.centerV.from, flight.centerV.to, elapsedS, flight.durationS),
    logMapWidth: quinticAt(flight.logMapWidth.from, flight.logMapWidth.to, elapsedS, flight.durationS),
  };
}

function stillAt(value: number): AxisState {
  return { value, rate: 0, accel: 0 };
}

/** 把差值折到 [-0.5, 0.5]：经度一圈是 1，取近的那一边。 */
function wrapUnit(delta: number): number {
  return delta - Math.round(delta);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
