// 2D 展开图的平移/缩放数学（纯函数，不碰 DOM、不碰 WebGL）。
// 状态：屏幕中心对应的贴图坐标 (u, v) + 整张图在屏幕上的宽度（CSS 像素）。
// 规则：最小缩放时整张图正好"铺满"屏幕（cover），上下不露黑边；经度方向无限循环。
import type { LatLon } from "../moon-frames";

export interface MapCamera {
  centerU: number;
  centerV: number;
  mapWidthPx: number;
}

export interface ScreenSize {
  widthPx: number;
  heightPx: number;
}

/** 放大上限：8K 贴图放大到每个贴图像素占 4 个屏幕像素。 */
const MAX_MAP_WIDTH_PX = 8192 * 4;

export function minMapWidthPx(screen: ScreenSize): number {
  return Math.max(screen.widthPx, screen.heightPx * 2);
}

export function clampCamera(camera: MapCamera, screen: ScreenSize): MapCamera {
  const mapWidthPx = Math.min(Math.max(camera.mapWidthPx, minMapWidthPx(screen)), MAX_MAP_WIDTH_PX);
  const halfV = screen.heightPx / 2 / (mapWidthPx / 2);
  const centerV = Math.min(Math.max(camera.centerV, halfV), 1 - halfV);
  return { centerU: camera.centerU, centerV, mapWidthPx };
}

export function initialCamera(screen: ScreenSize, centerLonDeg: number): MapCamera {
  return clampCamera({ centerU: centerLonDeg / 360 + 0.5, centerV: 0.5, mapWidthPx: minMapWidthPx(screen) }, screen);
}

/** 屏幕坐标（CSS 像素，左上角为原点）-> 贴图坐标（v 向上为北）。 */
export function screenToUv(camera: MapCamera, screen: ScreenSize, xPx: number, yPx: number) {
  const mapHeightPx = camera.mapWidthPx / 2;
  return {
    u: camera.centerU + (xPx - screen.widthPx / 2) / camera.mapWidthPx,
    v: camera.centerV - (yPx - screen.heightPx / 2) / mapHeightPx,
  };
}

/** 经纬度 -> 屏幕坐标。经度方向取离屏幕中心最近的那一份（地图左右循环）。 */
export function latLonToScreen(camera: MapCamera, screen: ScreenSize, point: LatLon): { x: number; y: number } {
  let du = point.lonDeg / 360 + 0.5 - camera.centerU;
  du -= Math.round(du);
  const dv = point.latDeg / 180 + 0.5 - camera.centerV;
  return { x: screen.widthPx / 2 + du * camera.mapWidthPx, y: screen.heightPx / 2 - dv * (camera.mapWidthPx / 2) };
}

export function uvToLatLon(u: number, v: number): LatLon {
  const wrappedU = u - Math.floor(u);
  return { latDeg: (v - 0.5) * 180, lonDeg: (wrappedU - 0.5) * 360 };
}

export function panCamera(camera: MapCamera, screen: ScreenSize, dxPx: number, dyPx: number): MapCamera {
  return clampCamera(
    { ...camera, centerU: camera.centerU - dxPx / camera.mapWidthPx, centerV: camera.centerV + dyPx / (camera.mapWidthPx / 2) },
    screen,
  );
}

/** 以屏幕上某点为中心缩放，让鼠标下的那个位置保持不动。 */
export function zoomCameraAt(camera: MapCamera, screen: ScreenSize, factor: number, xPx: number, yPx: number): MapCamera {
  const anchor = screenToUv(camera, screen, xPx, yPx);
  const zoomed = clampCamera({ ...camera, mapWidthPx: camera.mapWidthPx * factor }, screen);
  const after = screenToUv(zoomed, screen, xPx, yPx);
  return clampCamera({ ...zoomed, centerU: zoomed.centerU + (anchor.u - after.u), centerV: zoomed.centerV + (anchor.v - after.v) }, screen);
}
