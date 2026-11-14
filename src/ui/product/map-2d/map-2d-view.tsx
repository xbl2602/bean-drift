"use client";
// 2D 全月展开图：铺满整个屏幕，拖动平移、滚轮/双指缩放，单击某点交给上层处理（默认进入第一人称）。
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { LunarDetailAtlas } from "../imagery/lunar-detail-atlas";
import { applyAnalysisUniforms, type AnalysisUniforms } from "../analysis/analysis-glsl";
import { monthSunSamples, sunBodyAt } from "../analysis/sun-samples";
import type { LayerSettings } from "../map-layers";
import type { FocusRequest, MapViewProps } from "../map-view-props";
import { MOON_TEXTURES, loadMoonTexture, pickColorTextureUrl } from "../moon-assets";
import { bodyToLatLon, sunDirectionBody, type LatLon } from "../moon-frames";
import { AnnotationLayer } from "../overlay/annotations";
import { usePointerGestures } from "../use-pointer-gestures";
import { createMap2dMaterial } from "./map-2d-material";
import { clampCamera, initialCamera, latLonToScreen, panCamera, screenToUv, uvToLatLon, zoomCameraAt, type MapCamera, type ScreenSize } from "./map-2d-camera";

interface Map2dRuntime {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera3: THREE.Camera;
  material: THREE.ShaderMaterial;
  analysisUniforms: AnalysisUniforms;
  overlay: AnnotationLayer;
  detail: LunarDetailAtlas;
  mapCamera: MapCamera;
  screen: ScreenSize;
  frame: number;
}

export function Map2dView({ timeMs, layers, annotations, focus, cursor, onPick, onHover, onLoadingChange, onError }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<Map2dRuntime | null>(null);
  const settingsRef = useRef({ timeMs, layers, annotations });
  settingsRef.current = { timeMs, layers, annotations };
  const focusRef = useRef(focus);
  focusRef.current = focus;

  const requestRender = () => {
    const rt = runtimeRef.current;
    if (!rt || rt.frame) return;
    rt.frame = requestAnimationFrame(() => {
      rt.frame = 0;
      const { timeMs: t, layers: l, annotations: a } = settingsRef.current;
      applyUniforms(rt, t, l);
      rt.renderer.render(rt.scene, rt.camera3);
      rt.overlay.draw(a, (point) => latLonToScreen(rt.mapCamera, rt.screen, point), rt.screen.widthPx);
    });
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    renderer.domElement.className = "block h-full w-full";

    onLoadingChange(true);
    Promise.all([
      loadMoonTexture(pickColorTextureUrl(renderer), false),
      loadMoonTexture(MOON_TEXTURES.relief, false),
      loadMoonTexture(MOON_TEXTURES.slope, false),
      loadMoonTexture(MOON_TEXTURES.normal, false),
      loadMoonTexture(MOON_TEXTURES.polar, false),
    ])
      .then(([color, relief, slope, normal, polar]) => {
        if (disposed) return;
        const detail = new LunarDetailAtlas(container, false, requestRender);
        const { material, analysisUniforms } = createMap2dMaterial(color, { relief, slope, normal, polar }, detail.uniforms);
        const scene = new THREE.Scene();
        scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
        const screen = { widthPx: container.clientWidth, heightPx: container.clientHeight };
        // 开场居中在昼夜分界线偏白天一侧（太阳直射点往西 45°），一眼就能看到阴影；和 3D 开场同一个思路
        // 如果已经有定位请求（比如刚从第一人称返回），就直接回到那个位置
        const subSolar = bodyToLatLon(sunDirectionBody(settingsRef.current.timeMs));
        const pending = focusRef.current;
        const mapCamera = pending ? cameraForFocus(pending, screen) : initialCamera(screen, subSolar.lonDeg - 45);
        runtimeRef.current = { detail, renderer, scene, camera3: new THREE.Camera(), material, analysisUniforms, overlay: new AnnotationLayer(container), mapCamera, screen, frame: 0 };
        resize();
        onLoadingChange(false);
      })
      .catch(() => {
        if (!disposed) onError("The 4K Moon maps could not be loaded. Check your connection and reload the page.");
      });

    function resize() {
      const rt = runtimeRef.current;
      const widthPx = container!.clientWidth;
      const heightPx = container!.clientHeight;
      renderer.setSize(widthPx, heightPx, false);
      if (!rt) return;
      rt.screen = { widthPx, heightPx };
      rt.mapCamera = clampCamera(rt.mapCamera, rt.screen);
      requestRender();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    return () => {
      disposed = true;
      observer.disconnect();
      const rt = runtimeRef.current;
      if (rt) {
        cancelAnimationFrame(rt.frame);
        rt.overlay.dispose();
        rt.detail.dispose();
        rt.material.dispose();
        Object.values(rt.material.uniforms).forEach((u) => u.value instanceof THREE.Texture && u.value.dispose());
      }
      runtimeRef.current = null;
      renderer.dispose();
      renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在挂载时建一次渲染器
  }, []);

  useEffect(requestRender, [timeMs, layers, annotations]);

  useEffect(() => {
    const rt = runtimeRef.current;
    if (!focus || !rt) return;
    rt.mapCamera = cameraForFocus(focus, rt.screen);
    requestRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在收到新的定位请求时执行
  }, [focus?.seq]);

  const latLonAt = (xPx: number, yPx: number): LatLon | null => {
    const rt = runtimeRef.current;
    if (!rt) return null;
    const { u, v } = screenToUv(rt.mapCamera, rt.screen, xPx, yPx);
    return v < 0 || v > 1 ? null : uvToLatLon(u, v);
  };

  usePointerGestures(containerRef, {
    onPan: (dx, dy) => {
      const rt = runtimeRef.current;
      if (!rt) return;
      rt.mapCamera = panCamera(rt.mapCamera, rt.screen, dx, dy);
      requestRender();
    },
    onZoom: (factor, x, y) => {
      const rt = runtimeRef.current;
      if (!rt) return;
      rt.mapCamera = zoomCameraAt(rt.mapCamera, rt.screen, factor, x, y);
      requestRender();
    },
    onTap: (x, y) => {
      const point = latLonAt(x, y);
      if (point) onPick(point);
    },
    onHover: (x, y) => onHover(x === null || y === null ? null : latLonAt(x, y)),
  });

  return <div ref={containerRef} className="absolute inset-0 cursor-crosshair touch-none select-none" style={cursor ? { cursor } : undefined} />;
}

/** 把请求的位置放到屏幕中央，横向大约显示 spanDeg 度。 */
function cameraForFocus(focus: FocusRequest, screen: ScreenSize): MapCamera {
  // spanDeg 是地面上的角距离；纬度越高，同样的距离跨越的经度越多，所以要除以 cos(纬度)
  const lonSpanDeg = Math.min(focus.spanDeg / Math.max(Math.cos((focus.point.latDeg * Math.PI) / 180), 0.05), 360);
  const mapWidthPx = screen.widthPx * (360 / lonSpanDeg);
  return clampCamera({ centerU: focus.point.lonDeg / 360 + 0.5, centerV: focus.point.latDeg / 180 + 0.5, mapWidthPx }, screen);
}

function applyUniforms(rt: Map2dRuntime, timeMs: number, layers: LayerSettings) {
  const u = rt.material.uniforms;
  // 用画布实际的像素尺寸，而不是假设 CSS 尺寸 × devicePixelRatio（缩放过的浏览器里两者会对不上）
  const buffer = rt.renderer.getDrawingBufferSize(new THREE.Vector2());
  const dpr = buffer.x / Math.max(rt.screen.widthPx, 1);
  const c = rt.mapCamera;
  const halfU = rt.screen.widthPx / (2 * c.mapWidthPx);
  const halfV = rt.screen.heightPx / c.mapWidthPx;
  rt.detail.update(layers.base === "color" ? { west: c.centerU - halfU, east: c.centerU + halfU, south: Math.max(0, c.centerV - halfV), north: Math.min(1, c.centerV + halfV), worldWidthPx: c.mapWidthPx * dpr } : null);
  u.uResolutionPx.value.copy(buffer);
  u.uCenterUv.value.set(rt.mapCamera.centerU, rt.mapCamera.centerV);
  u.uMapWidthPx.value = rt.mapCamera.mapWidthPx * dpr;
  u.uSunlight.value = layers.sunlight;
  applyAnalysisUniforms(rt.analysisUniforms, layers, sunBodyAt(timeMs), monthSunSamples(timeMs));
}
