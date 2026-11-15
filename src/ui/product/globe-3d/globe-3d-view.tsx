"use client";
// 3D 月球：真实时刻的太阳方向打光，昼夜分界线 + 放大后的地形投下阴影（时间轴一动，太阳和阴影跟着动）。
// 拖动旋转、滚轮缩放，单击某点交给上层处理（默认进入第一人称）。
//
// 只画"此刻需要的"（见 docs/decisions/2026-11-15_xbl2602_product-on-demand-rendering.md）：
//   - 画布就是屏幕的实际像素（高分屏最多 2 倍），不再强制 4K；
//   - 画面没变就不画（拖动、缩放、拖时间轴、贴图换了、瓦片到了才画）；
//   - 阴影贴图只覆盖看得见的那一块，只在太阳方向变了或视野走出覆盖范围时才重画（globe-shadow-fit.ts）；
//   - 贴图先粗后细：进场只等 4K 底图 + 2K 法线和高度，其余后台补（imagery/moon-texture-set.ts）；放大后高清瓦片按需拼上去。
// 右边开着面板时，把月球画到面板旁边空出来的区域正中间（frameBesidePanel，setViewOffset 只改投影）；
// 自动飞行走 camera-flight.ts 的二阶导连续曲线，起点接着最后画出来的那一帧。
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { applyAnalysisUniforms, type AnalysisUniforms } from "../analysis/analysis-glsl";
import { monthSunSamples, sunBodyAt } from "../analysis/sun-samples";
import { MoonTextureSet, fineMapsForLayer } from "../imagery/moon-texture-set";
import { TileAtlas } from "../imagery/tile-atlas";
import { COLOR_PYRAMID_SOURCE, MOON_TREK_SOURCE, type MoonAtlases } from "../imagery/tile-sources";
import type { LayerSettings } from "../map-layers";
import type { FocusRequest, MapViewProps } from "../map-view-props";
import { bodyToLatLon, bodyToThree, latLonToBody, sunDirectionBody, threeToBody, type LatLon } from "../moon-frames";
import { AnnotationLayer, type MapAnnotations } from "../overlay/annotations";
import { SmoothValue, prefersReducedMotion } from "../motion/smooth-value";
import { rightPanelCoverPx, type RightPanelSize } from "../panels/panel-shell";
import { usePointerGestures } from "../use-pointer-gestures";
import { globeDetailView } from "./globe-detail-view";
import { GLOBE_RELIEF_MAX_KM, GLOBE_RELIEF_MIN_KM, applyTextureSwap, createGlobeMaterials } from "./globe-material";
import { createGlobePatches, type GlobePatches } from "./globe-patches";
import { createGlobeSky } from "./globe-sky";
import { GlobeShadowFit } from "./globe-shadow-fit";
import { CameraMotionTracker, placeCameraOnFlight, startCameraFlight, type CameraFlight } from "./camera-flight";

const MOON_RADIUS_KM = 1737.4;
const CAMERA_FOV_DEG = 35;
const SUN_DISTANCE_KM = 8000;
const MIN_DISTANCE_KM = MOON_RADIUS_KM * 1.08;
const MAX_DISTANCE_KM = MOON_RADIUS_KM * 9;
const MAX_PIXEL_RATIO = 2;
/** 面板开关时，月球往左挪 / 缩小的动画时长。 */
const REFRAME_MS = 700;
/** 缩小时月球和面板之间留的空隙。 */
const FIT_MARGIN_PX = 24;

interface DrawnState {
  timeMs: number;
  layers: LayerSettings;
  annotations: MapAnnotations;
}

interface GlobeRuntime {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  sun: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
  shadowFit: GlobeShadowFit;
  textures: MoonTextureSet;
  materials: ReturnType<typeof createGlobeMaterials> | null;
  /** 切成块的球面：每帧只画可能看得见的块。 */
  patches: GlobePatches | null;
  analysisUniforms: AnalysisUniforms | null;
  atlases: MoonAtlases | null;
  overlay: AnnotationLayer;
  flight: CameraFlight | null;
  motion: CameraMotionTracker;
  /** 月球画面中心往左挪多少像素、缩放多少（1 = 不缩），都是二阶导连续的动画。 */
  framing: { shiftPx: SmoothValue; scale: SmoothValue; key: string };
  remPx: number;
  /** 有东西变了、下一帧必须画（贴图换了、瓦片到了、改了窗口大小……）。 */
  dirty: boolean;
  /** 阴影贴图要重画（地形贴图换了）。太阳方向变了、视野走出覆盖范围由 shadowFit 自己判断。 */
  shadowDirty: boolean;
  drawn: DrawnState | null;
  fineRequestedFor: LayerSettings["base"] | null;
}

export function Globe3dView({ timeMs, layers, annotations, focus, rightPanel, cursor, onPick, onDoublePick, onHover, onLoadingChange, onError }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<GlobeRuntime | null>(null);
  const settingsRef = useRef({ timeMs, layers, annotations, rightPanel });
  settingsRef.current = { timeMs, layers, annotations, rightPanel };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let frame = 0;
    const invalidate = () => {
      if (runtimeRef.current) runtimeRef.current.dirty = true;
    };

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false; // 阴影只在 shadowFit 说需要时重画
    renderer.domElement.className = "block h-full w-full";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    const sky = createGlobeSky(renderer, invalidate);
    scene.add(sky.group);

    const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, 10, 200000);
    const sun = new THREE.DirectionalLight(0xffffff, 3.2);
    sun.castShadow = true;
    // 阴影图大小跟着屏幕走：和画布最长边差不多就够（阴影只覆盖看得见的那一块，见 globe-shadow-fit.ts）
    const longEdgePx = Math.max(container.clientWidth, container.clientHeight, 1) * Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const shadowSizePx = Math.min(Math.max(THREE.MathUtils.ceilPowerOfTwo(longEdgePx), 2048), 4096, renderer.capabilities.maxTextureSize);
    sun.shadow.mapSize.set(shadowSizePx, shadowSizePx);
    sun.shadow.bias = -0.0004;
    const shadowFit = new GlobeShadowFit(sun, MOON_RADIUS_KM, SUN_DISTANCE_KM, shadowSizePx);
    const ambient = new THREE.AmbientLight(0xffffff, 0.02);
    scene.add(sun, sun.target, ambient);

    const controls = new OrbitControls(camera, renderer.domElement);
    Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, minDistance: MIN_DISTANCE_KM, maxDistance: MAX_DISTANCE_KM, rotateSpeed: 0.5 });
    controls.addEventListener("change", () => {
      // 滚轮缩放时 OrbitControls 在事件处理函数里就把相机挪好了，之后每帧再问它"动了吗"只会得到"没动"，
      // 所以不能只看每帧的返回值，必须在相机真的变了的这一刻标记"要重画"
      invalidate();
      // 越靠近月面转得越慢，方便细看
      const altitude = camera.position.length() - MOON_RADIUS_KM;
      controls.rotateSpeed = THREE.MathUtils.clamp(altitude / 4000, 0.05, 0.6);
    });
    controls.addEventListener("start", () => {
      // 用户一动手就停止自动飞行，交还给 OrbitControls（恢复阻尼）
      if (runtimeRef.current) runtimeRef.current.flight = null;
      controls.enableDamping = true;
    });
    placeCameraForTime(camera, controls, settingsRef.current.timeMs, container);

    const textures = new MoonTextureSet((key, texture) => {
      const rt = runtimeRef.current;
      if (!rt) return;
      if (rt.materials) applyTextureSwap(rt.materials, key, texture);
      rt.dirty = true;
      if (key === "relief") rt.shadowDirty = true; // 地形变了，阴影也要重画
    });
    const rt: GlobeRuntime = {
      camera,
      controls,
      sun,
      ambient,
      shadowFit,
      textures,
      materials: null,
      patches: null,
      analysisUniforms: null,
      atlases: null,
      overlay: new AnnotationLayer(container),
      flight: null,
      motion: new CameraMotionTracker(),
      framing: { shiftPx: new SmoothValue(0), scale: new SmoothValue(1), key: "" },
      remPx: parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
      dirty: true,
      shadowDirty: true,
      drawn: null,
      fineRequestedFor: null,
    };
    runtimeRef.current = rt;

    onLoadingChange(true);
    // 进场只等 4K 底图 + 2K 法线和高度（约 2.7 MB，进过 2D 的话已经在缓存里）；坡度、极区光照的 2K 版、4K 法线和天空小图在后台接着补
    Promise.all([textures.loadColor(true, renderer.capabilities.getMaxAnisotropy()), textures.load(["normal", "relief"], "coarse")])
      .then(([color]) => {
        if (disposed) return;
        const atlases: MoonAtlases = {
          tiles: new TileAtlas(COLOR_PYRAMID_SOURCE, renderer, container, true, invalidate),
          detail: new TileAtlas(MOON_TREK_SOURCE, renderer, container, true, invalidate),
        };
        rt.atlases = atlases;
        const materials = createGlobeMaterials(color, textures.slots, atlases);
        const patches = createGlobePatches({
          radiusKm: MOON_RADIUS_KM,
          reliefMinKm: GLOBE_RELIEF_MIN_KM,
          reliefMaxKm: GLOBE_RELIEF_MAX_KM,
          material: materials.surface,
          depthMaterial: materials.shadowDepth,
        });
        scene.add(patches.group);
        rt.patches = patches;
        rt.materials = materials;
        rt.analysisUniforms = materials.analysisUniforms;
        rt.dirty = true;
        rt.shadowDirty = true;
        onLoadingChange(false);
        textures.request(["slope", "polar"], "coarse");
      })
      .catch(() => {
        if (!disposed) onError("The Moon or high-resolution sky images could not be loaded. Check your connection and reload the page.");
      });

    const resize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      rt.dirty = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const tick = () => {
      frame = requestAnimationFrame(tick);
      const settings = settingsRef.current;
      const settingsChanged = !rt.drawn || rt.drawn.timeMs !== settings.timeMs || rt.drawn.layers !== settings.layers || rt.drawn.annotations !== settings.annotations;
      const flying = advanceFlight(rt);
      const cameraMoved = controls.update();
      const reframed = frameBesidePanel(rt, container, settings.rightPanel, performance.now());
      if (!rt.dirty && !settingsChanged && !flying && !cameraMoved && !reframed) return; // 什么都没变：不画
      rt.dirty = false;
      rt.drawn = { timeMs: settings.timeMs, layers: settings.layers, annotations: settings.annotations };

      const sunDirection = applySettings(rt, settings.timeMs, settings.layers);
      const patchesChanged = rt.patches?.update(camera, container.clientHeight) ?? false; // 背面和一定看不见的块不画，网格疏密跟着屏幕走
      // 日照关着时阴影图不更新，再打开时必须重画一次（期间转过视角、露出过新的块）
      if (!rt.sun.visible) rt.shadowDirty = true;
      else if (rt.shadowFit.update(camera, sunDirection, rt.shadowDirty) || patchesChanged) {
        renderer.shadowMap.needsUpdate = true; // 太阳动了、视野走出覆盖范围、地形贴图换了、或有新的块露出来/换了疏密
        rt.shadowDirty = false;
        rt.patches?.markShadowRendered();
      }
      requestFineMaps(rt, settings.layers.base);
      sky.update(camera, settings.timeMs, renderer.getPixelRatio(), sunDirection);
      if (rt.atlases) {
        const view = settings.layers.base === "color" ? globeDetailView(camera, renderer.domElement.width, MOON_RADIUS_KM) : null;
        rt.atlases.tiles.update(view);
        rt.atlases.detail.update(view);
      }
      // 记下这一帧画出来的相机位置：用户刚拖完、镜头还在惯性滑动时请求飞行，要靠它接着飞（见 camera-flight.ts）
      rt.motion.record(camera.position, performance.now());
      renderer.render(scene, camera);
      rt.overlay.draw(settings.annotations, (point) => projectToScreen(camera, container, point), container.clientWidth);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      scene.remove(sky.group);
      sky.dispose();
      rt.atlases?.tiles.dispose();
      rt.atlases?.detail.dispose();
      rt.overlay.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Sprite) {
          obj.geometry.dispose();
          const material = obj.material as THREE.Material & { map?: THREE.Texture | null };
          material.map?.dispose();
          material.dispose();
        }
      });
      rt.patches?.dispose();
      rt.materials?.shadowDepth.dispose();
      textures.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      runtimeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在挂载时建一次场景
  }, []);

  useEffect(() => {
    const rt = runtimeRef.current;
    if (focus && rt) rt.flight = startCameraFlight(cameraPositionFor(focus, rt.camera.fov), performance.now(), rt.flight, rt.motion, rt.camera.position);
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
    onDoubleTap: onDoublePick ? (x, y) => {
      const point = latLonAt(x, y);
      if (point) onDoublePick(point);
    } : undefined,
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
  const surfaceImagery = layers.base === "color";
  rt.sun.visible = surfaceImagery && layers.sunlight;
  // 夜面留一点点底光（约为日面的十分之一以下），搜索到夜里的地方时不至于一片漆黑；阴影仍然很暗
  rt.ambient.intensity = !surfaceImagery ? 0 : layers.sunlight ? 0.45 : 1.6;
  if (rt.analysisUniforms) applyAnalysisUniforms(rt.analysisUniforms, layers, sunBodyAt(timeMs), monthSunSamples(timeMs));
  // 分析图层要和图例颜色一致，不能过电影色调映射；切换时让 three 换一份着色器（会缓存）
  const surface = rt.materials?.surface;
  if (surface && surface.toneMapped !== surfaceImagery) {
    surface.toneMapped = surfaceImagery;
    surface.needsUpdate = true;
  }
  return sunDir;
}

/** 底图图层变了，才去后台补这个图层要用的细版本数据贴图。 */
function requestFineMaps(rt: GlobeRuntime, base: LayerSettings["base"]) {
  if (!rt.materials || rt.fineRequestedFor === base) return;
  rt.fineRequestedFor = base;
  rt.textures.request(fineMapsForLayer(base), "fine");
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

/**
 * 每帧决定相机位置：在自动飞行就沿飞行路线走（camera-flight.ts，二阶导连续），否则交给 OrbitControls。
 * 飞行期间先关掉阻尼跑一次 controls.update()，把用户拖动留下的惯性清零，否则降落后会被残余惯性推一下。
 * 返回这一帧是否还在飞行中（要画）。
 */
function advanceFlight(rt: GlobeRuntime): boolean {
  if (!rt.flight) {
    rt.controls.update();
    return false;
  }
  rt.controls.enableDamping = false;
  rt.controls.update();
  const arrived = placeCameraOnFlight(rt.camera, rt.flight, performance.now());
  if (arrived) {
    rt.flight = null;
    rt.controls.enableDamping = true;
  }
  return true;
}

/**
 * 右边开着面板时，把月球画到面板左边空出来的那块区域正中间；那块区域放不下整个月球，就同时缩小一点。
 * 用 setViewOffset 只改投影（相当于把画面平移、缩放），相机本身不动：拖动、点选、自动飞行都照常。
 * 平移量和缩放量各走一条二阶导连续的动画（motion/smooth-value.ts），开关面板时不会突然跳。
 * 缩放只在面板开关、窗口大小变化的那一刻决定；之后用户滚轮放大缩小照常生效，不会被"自动缩回去"。
 * 返回动画是否还在进行中（要继续画）。
 */
function frameBesidePanel(rt: GlobeRuntime, container: HTMLElement, panel: RightPanelSize | null | undefined, nowMs: number): boolean {
  const width = Math.max(container.clientWidth, 1);
  const height = Math.max(container.clientHeight, 1);
  const coverPx = rightPanelCoverPx(panel, window.innerWidth, rt.remPx);
  const { framing } = rt;
  const key = `${coverPx}|${width}|${height}`;
  if (framing.key !== key) {
    framing.key = key;
    const targetShift = coverPx / 2;
    const targetScale = coverPx > 0 ? scaleToFitBeside(rt.camera, width - coverPx, height) : 1;
    if (prefersReducedMotion()) {
      framing.shiftPx.jump(targetShift);
      framing.scale.jump(targetScale);
    } else {
      framing.shiftPx.retarget(targetShift, nowMs, REFRAME_MS);
      framing.scale.retarget(targetScale, nowMs, REFRAME_MS);
    }
  }
  const { shiftPx, scale } = framing;
  const shift = shiftPx.at(nowMs).value;
  const s = scale.at(nowMs).value;
  if (Math.abs(shift) < 0.01 && Math.abs(s - 1) < 1e-5) {
    if (rt.camera.view?.enabled) rt.camera.clearViewOffset();
    return false;
  }
  // 整幅画面按 s 缩放成 (sW, sH)，它的中心（月球所在）落在窗口的 (W/2 - shift, H/2)
  rt.camera.setViewOffset(width * s, height * s, (width * s) / 2 - (width / 2 - shift), (height * s - height) / 2, width, height);
  return true;
}

/**
 * 整个月球放进 freeWidth × height 的区域要缩多少。月球在画面上的直径 = 2·tan(视角半径)/tan(半视场)·H/2。
 * 用户已经放大到月面细节（月球比屏幕大很多）时不缩，只往左挪，免得把他放大的画面又缩回去。
 */
function scaleToFitBeside(camera: THREE.PerspectiveCamera, freeWidthPx: number, heightPx: number): number {
  const angularRadius = Math.asin(Math.min(1, MOON_RADIUS_KM / camera.position.length()));
  const moonPx = (Math.tan(angularRadius) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * heightPx;
  const fit = Math.min(1, (Math.min(freeWidthPx, heightPx) - FIT_MARGIN_PX) / moonPx);
  const zoomedIn = THREE.MathUtils.smoothstep(moonPx / heightPx, 1.6, 2.4);
  return THREE.MathUtils.clamp(THREE.MathUtils.lerp(fit, 1, zoomedIn), 0.35, 1);
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
