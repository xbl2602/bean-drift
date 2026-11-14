"use client";
// 3D 月球：真实时刻的太阳方向打光，昼夜分界线 + 放大后的地形投下阴影（时间轴一动，太阳和阴影跟着动）。
// 拖动旋转、滚轮缩放，单击某点交给上层处理（默认进入第一人称）。
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { LunarDetailAtlas } from "../imagery/lunar-detail-atlas";
import { globeDetailView } from "./globe-detail-view";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { applyAnalysisUniforms, type AnalysisUniforms } from "../analysis/analysis-glsl";
import { monthSunSamples, sunBodyAt } from "../analysis/sun-samples";
import type { LayerSettings } from "../map-layers";
import type { FocusRequest, MapViewProps } from "../map-view-props";
import { MOON_TEXTURES, loadMoonTexture, pickColorTextureUrl } from "../moon-assets";
import { bodyToLatLon, bodyToThree, latLonToBody, sunDirectionBody, threeToBody, type LatLon } from "../moon-frames";
import { AnnotationLayer, type MapAnnotations } from "../overlay/annotations";
import { usePointerGestures } from "../use-pointer-gestures";
import { createGlobeMaterials } from "./globe-material";
import { createGlobeSky } from "./globe-sky";

const MOON_RADIUS_KM = 1737.4;
const CAMERA_FOV_DEG = 35;
const SUN_DISTANCE_KM = 8000;
const MIN_DISTANCE_KM = MOON_RADIUS_KM * 1.08;
const MAX_DISTANCE_KM = MOON_RADIUS_KM * 9;
const FLY_DURATION_MS = 800;

interface GlobeRuntime {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  sun: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
  surface: THREE.MeshStandardMaterial | null;
  analysisUniforms: AnalysisUniforms | null;
  overlay: AnnotationLayer;
  flight: { from: THREE.Vector3; to: THREE.Vector3; startMs: number } | null;
}

export function Globe3dView({ timeMs, layers, annotations, focus, cursor, onPick, onHover, onLoadingChange, onError }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<GlobeRuntime | null>(null);
  const settingsRef = useRef({ timeMs, layers, annotations });
  settingsRef.current = { timeMs, layers, annotations };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let frame = 0;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = "block h-full w-full";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    const sky = createGlobeSky(renderer);
    const detail = new LunarDetailAtlas(container, true, () => {});
    scene.add(sky.group);

    const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, 10, 200000);
    const sun = new THREE.DirectionalLight(0xffffff, 3.2);
    sun.castShadow = true;
    const shadowSize = renderer.capabilities.maxTextureSize >= 8192 ? 8192 : 4096;
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    Object.assign(sun.shadow.camera, { left: -1900, right: 1900, top: 1900, bottom: -1900, near: SUN_DISTANCE_KM - 2000, far: SUN_DISTANCE_KM + 2000 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 1.5;
    const ambient = new THREE.AmbientLight(0xffffff, 0.02);
    scene.add(sun, sun.target, ambient);

    const controls = new OrbitControls(camera, renderer.domElement);
    Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, minDistance: MIN_DISTANCE_KM, maxDistance: MAX_DISTANCE_KM, rotateSpeed: 0.5 });
    controls.addEventListener("change", () => {
      // 越靠近月面转得越慢，方便细看
      const altitude = camera.position.length() - MOON_RADIUS_KM;
      controls.rotateSpeed = THREE.MathUtils.clamp(altitude / 4000, 0.05, 0.6);
    });
    controls.addEventListener("start", () => {
      if (runtimeRef.current) runtimeRef.current.flight = null; // 用户一动手就停止自动飞行
    });
    placeCameraForTime(camera, controls, settingsRef.current.timeMs, container);
    const rt: GlobeRuntime = { camera, controls, sun, ambient, surface: null, analysisUniforms: null, overlay: new AnnotationLayer(container), flight: null };
    runtimeRef.current = rt;

    onLoadingChange(true);
    Promise.all([
      loadMoonTexture(pickColorTextureUrl(renderer), true),
      loadMoonTexture(MOON_TEXTURES.normal, false),
      loadMoonTexture(MOON_TEXTURES.relief, false),
      loadMoonTexture(MOON_TEXTURES.slope, false),
      loadMoonTexture(MOON_TEXTURES.polar, false),
      sky.ready,
    ])
      .then(([color, normal, relief, slope, polar]) => {
        if (disposed) return;
        color.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const { surface, shadowDepth, analysisUniforms } = createGlobeMaterials(color, { normal, relief, slope, polar }, detail.uniforms);
        const moon = new THREE.Mesh(new THREE.SphereGeometry(MOON_RADIUS_KM, 1024, 512), surface);
        moon.customDepthMaterial = shadowDepth;
        moon.castShadow = true;
        moon.receiveShadow = true;
        scene.add(moon);
        rt.surface = surface;
        rt.analysisUniforms = analysisUniforms;
        onLoadingChange(false);
      })
      .catch(() => {
        if (!disposed) onError("The Moon or high-resolution sky images could not be loaded. Check your connection and reload the page.");
      });

    const resize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      const longEdge = Math.max(width, height);
      // Render at least a 4K long edge without reducing resolution on larger displays.
      const requestedScale = Math.max(window.devicePixelRatio || 1, 3840 / longEdge);
      const limit = Math.min(renderer.capabilities.maxTextureSize, renderer.getContext().getParameter(renderer.getContext().MAX_RENDERBUFFER_SIZE));
      renderer.setPixelRatio(Math.min(requestedScale, limit / longEdge));
      renderer.setSize(width, height, false);
      camera.aspect = container.clientWidth / Math.max(container.clientHeight, 1);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const tick = () => {
      frame = requestAnimationFrame(tick);
      const { timeMs: t, layers: l, annotations: a } = settingsRef.current;
      const sunDirection = applySettings(rt, t, l);
      advanceFlight(rt);
      controls.update();
      sky.update(camera, t, renderer.getPixelRatio(), sunDirection);
      detail.update(l.base === "color" ? globeDetailView(camera, renderer.domElement.width, MOON_RADIUS_KM) : null);
      renderer.render(scene, camera);
      rt.overlay.draw(a, (point) => projectToScreen(camera, container, point), container.clientWidth);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      scene.remove(sky.group);
      sky.dispose();
      detail.dispose();
      rt.overlay.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Sprite) {
          obj.geometry.dispose();
          const material = obj.material as THREE.Material & { map?: THREE.Texture | null };
          material.map?.dispose();
          material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      runtimeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在挂载时建一次场景
  }, []);

  useEffect(() => {
    const rt = runtimeRef.current;
    if (focus && rt) rt.flight = { from: rt.camera.position.clone(), to: cameraPositionFor(focus, rt.camera.fov), startMs: performance.now() };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在收到新的定位请求时执行
  }, [focus?.seq]);

  const latLonAt = (xPx: number, yPx: number): LatLon | null => {
    const rt = runtimeRef.current;
    const container = containerRef.current;
    if (!rt || !container) return null;
    const ndc = new THREE.Vector2((xPx / container.clientWidth) * 2 - 1, -(yPx / container.clientHeight) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, rt.camera);
    const hit = raycaster.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(), MOON_RADIUS_KM), new THREE.Vector3());
    return hit ? bodyToLatLon(threeToBody(hit)) : null;
  };

  usePointerGestures(containerRef, {
    capturePointer: false,
    onTap: (x, y) => {
      const point = latLonAt(x, y);
      if (point) onPick(point);
    },
    onHover: (x, y) => onHover(x === null || y === null ? null : latLonAt(x, y)),
  });

  return <div ref={containerRef} className="absolute inset-0 cursor-crosshair touch-none select-none" style={cursor ? { cursor } : undefined} />;
}

function applySettings(rt: GlobeRuntime, timeMs: number, layers: LayerSettings) {
  const sunDir = bodyToThree(sunDirectionBody(timeMs));
  rt.sun.position.copy(sunDir).multiplyScalar(SUN_DISTANCE_KM);
  const surfaceImagery = layers.base === "color";
  rt.sun.visible = surfaceImagery && layers.sunlight;
  // 夜面留一点点底光（约为日面的十分之一以下），搜索到夜里的地方时不至于一片漆黑；阴影仍然很暗
  rt.ambient.intensity = !surfaceImagery ? 0 : layers.sunlight ? 0.45 : 1.6;
  if (rt.analysisUniforms) applyAnalysisUniforms(rt.analysisUniforms, layers, sunBodyAt(timeMs), monthSunSamples(timeMs));
  // 分析图层要和图例颜色一致，不能过电影色调映射；切换时让 three 换一份着色器（会缓存）
  if (rt.surface && rt.surface.toneMapped !== surfaceImagery) {
    rt.surface.toneMapped = surfaceImagery;
    rt.surface.needsUpdate = true;
  }
  return sunDir;
}

/** 经纬度 -> 屏幕坐标；在月球背面（被球体挡住）时返回 null。 */
function projectToScreen(camera: THREE.PerspectiveCamera, container: HTMLElement, point: LatLon) {
  const world = bodyToThree(latLonToBody(point)).multiplyScalar(MOON_RADIUS_KM);
  if (world.dot(camera.position) < MOON_RADIUS_KM * MOON_RADIUS_KM) return null;
  const ndc = world.project(camera);
  if (ndc.z > 1) return null;
  return { x: ((ndc.x + 1) / 2) * container.clientWidth, y: ((1 - ndc.y) / 2) * container.clientHeight };
}

/** 画面里大约能看到 spanDeg 度范围时，相机该在哪。 */
function cameraPositionFor(focus: FocusRequest, fovDeg = CAMERA_FOV_DEG): THREE.Vector3 {
  const halfSpanKm = MOON_RADIUS_KM * THREE.MathUtils.degToRad(focus.spanDeg / 2);
  const altitudeKm = halfSpanKm / Math.tan(THREE.MathUtils.degToRad(fovDeg / 2));
  const distanceKm = THREE.MathUtils.clamp(MOON_RADIUS_KM + altitudeKm, MIN_DISTANCE_KM, MAX_DISTANCE_KM);
  return bodyToThree(latLonToBody(focus.point)).multiplyScalar(distanceKm);
}

/** 自动飞行：方向沿球面插值、距离线性插值，缓入缓出。 */
function advanceFlight(rt: GlobeRuntime) {
  if (!rt.flight) return;
  const raw = Math.min((performance.now() - rt.flight.startMs) / FLY_DURATION_MS, 1);
  const t = raw * raw * (3 - 2 * raw);
  const { from, to } = rt.flight;
  const direction = new THREE.Vector3().copy(from).normalize();
  const rotation = new THREE.Quaternion().setFromUnitVectors(direction, to.clone().normalize());
  direction.applyQuaternion(new THREE.Quaternion().slerp(rotation, t));
  rt.camera.position.copy(direction.multiplyScalar(THREE.MathUtils.lerp(from.length(), to.length(), t)));
  if (raw >= 1) rt.flight = null;
}

/** 开场镜头：对着昼夜分界线附近（太阳直射点往西 55°）。 */
function placeCameraForTime(camera: THREE.PerspectiveCamera, controls: OrbitControls, timeMs: number, container: HTMLElement) {
  const subSolar = bodyToLatLon(sunDirectionBody(timeMs));
  const viewDir = bodyToThree(latLonToBody({ latDeg: 12, lonDeg: subSolar.lonDeg - 55 }));
  // 让整个月球正好撑满屏幕较短的那一边（横屏时是高度），完整的球都在画面里
  const aspect = container.clientWidth / Math.max(container.clientHeight, 1);
  const halfFovRad = THREE.MathUtils.degToRad(CAMERA_FOV_DEG / 2);
  const fitHeight = MOON_RADIUS_KM / Math.sin(halfFovRad);
  const fitWidth = MOON_RADIUS_KM / Math.sin(Math.atan(Math.tan(halfFovRad) * aspect));
  camera.position.copy(viewDir.multiplyScalar(Math.max(fitHeight, fitWidth) * 1.03));
  controls.target.set(0, 0, 0);
  controls.update();
}
