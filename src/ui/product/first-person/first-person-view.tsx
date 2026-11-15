"use client";
// 第一人称：站在点击的位置环顾四周。拖动可水平 360° 转一整圈、上下看；滚轮只做放大/缩小（改视场角，人不动、眼睛高度固定 1.6 m）。
// 右上角有"Mouse look"开关：打开后不用按鼠标，镜头跟着鼠标走——鼠标往上移，视线抬高；往下移，视线低下去；
// 把鼠标移向屏幕左右边缘，视角就慢慢转过去。
// 键盘或屏幕方向键可以在着陆点周围 2 km 内前后左右走动（walk-motion.ts、walk-pad.tsx）。
// 画面按需重绘：位置（转头/走动/视点高度）和时间轴没变就不重画，阴影也只在需要时重算；
// 右上角的相机按钮：把此刻看到的画面存成一张带说明的 PNG（photo-capture.ts）。
// 画面至少按 2K 渲染（长边 2560 像素），默认 4K（长边 3840）；太阳和阴影跟着底部时间轴走。
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { MOON_RADIUS_M } from "../moon-assets";
import { formatLatLon, type LatLon } from "../moon-frames";
import { TerrainVisibilityPanel } from "../point-api/terrain-visibility-panel";
import { usePointApi } from "../point-api/use-point-api";
import { skyConditionsAt } from "../sky-conditions";
import { usePointerGestures } from "../use-pointer-gestures";
import { CompassTape } from "./compass-tape";
import { buildFirstPersonScene, configureFirstPersonRenderer, OPENING_PITCH_DEG, openingYawDeg, type FirstPersonScene } from "./first-person-scene";
import { composePhoto, downloadBlob, photoFilename } from "./photo-capture";
import { destination } from "./terrain-patch";
import { WALK_LIMIT_M, WalkMotion } from "./walk-motion";
import { useWalkInput, WalkPad } from "./walk-pad";

/** 宇航员眼高：固定，滚轮不再升降视点。 */
const EYE_HEIGHT_M = 1.6;
const PITCH_LIMIT_DEG = 89;
/** 视场角：70° 是默认，滚轮最多放大到 10°（7 倍）。 */
const FOV_DEFAULT_DEG = 70;
const FOV_MIN_DEG = 10;
/** 视场角追着目标值走的快慢（每秒），让放大缩小是顺滑的，不是一格一跳。 */
const FOV_EASE_PER_S = 9;
/** 鼠标跟随（Mouse look）：左右——离屏幕中心超过这个比例才开始转（0..1），越靠边转得越快（度/秒，70° 视场下）。 */
const HOVER_DEADZONE = 0.2;
const HOVER_YAW_DEG_PER_S = 50;
/** 上下——鼠标在屏幕最上/最下时，视线抬高/压低到这个角度（70° 视场下，放大后按比例缩小），镜头平滑地追上去。 */
const HOVER_PITCH_RANGE_DEG = 55;
const HOVER_PITCH_FOLLOW_PER_S = 6;
/** 渲染分辨率：长边像素数。2K 是最低档，屏幕本身更清晰时按屏幕来。 */
const LONG_EDGE_PX = { "4k": 3840, "2k": 2560 } as const;
/** 按住 ←/→ 转身、PageUp/PageDown 抬头低头的速度（度/秒）。 */
const TURN_DEG_PER_S = 55;
const PITCH_DEG_PER_S = 35;
/** 走动时界面上的位置、距离多久刷新一次（毫秒）；画面本身每帧都在动。 */
const WALK_HUD_MS = 150;

interface WalkInfo { eastM: number; northM: number; groundShiftM: number }

interface FirstPersonViewProps {
  point: LatLon;
  timeMs: number;
  onExit: () => void;
  onLoadingChange: (loading: boolean) => void;
  onError: (message: string) => void;
}

export function FirstPersonView({ point, timeMs, onExit, onLoadingChange, onError }: FirstPersonViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<FirstPersonScene | null>(null);
  const [render4k, setRender4k] = useState(true);
  const qualityRef = useRef(render4k);
  qualityRef.current = render4k;
  const resizeRef = useRef<(() => void) | null>(null);
  const [renderSize, setRenderSize] = useState("");
  useEffect(() => { resizeRef.current?.(); }, [render4k]);
  // 太阳/地球的方向：随时间轴逐帧重算，直接用纯计算的星历；考虑地形遮挡的可见性和一年统计走 /api/point
  const conditions = useMemo(() => skyConditionsAt(point, timeMs), [point, timeMs]);
  const pointApi = usePointApi(point, timeMs);
  const initialYaw = openingYawDeg(point, timeMs);
  const viewRef = useRef({ yawDeg: initialYaw, pitchDeg: OPENING_PITCH_DEG, eyeHeightM: EYE_HEIGHT_M, fovTargetDeg: FOV_DEFAULT_DEG, fovDeg: FOV_DEFAULT_DEG });
  const hoverRef = useRef<{ x: number; y: number } | null>(null); // 鼠标离容器中心的偏移，-1..1；null = 不在画面上
  const lastPanMsRef = useRef(0);
  const [hoverLook, setHoverLook] = useState(false);
  const hoverLookRef = useRef(hoverLook);
  hoverLookRef.current = hoverLook;
  const [zoomX, setZoomX] = useState(1);
  // 信息栏：默认收起（只露一行位置），点一下展开；它在右上角，不挡住画面
  const [infoOpen, setInfoOpen] = useState(false);
  // 拍照：点按钮只是"提个请求"，由绘制循环在画完下一帧后读画布（见 tick）
  const photoRequestRef = useRef(false);
  const photoCaptionRef = useRef({ text: "", filename: "" });
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!photoNote) return;
    const timer = setTimeout(() => setPhotoNote(null), 4000);
    return () => clearTimeout(timer);
  }, [photoNote]);
  const timeRef = useRef(timeMs);
  timeRef.current = timeMs;
  const [headingDeg, setHeadingDeg] = useState(initialYaw);
  const [groundHeightM, setGroundHeightM] = useState<number | null>(null);
  const walkRef = useRef<WalkMotion | null>(null);
  const [walkInfo, setWalkInfo] = useState<WalkInfo>({ eastM: 0, northM: 0, groundShiftM: 0 });
  const { input, setPad } = useWalkInput(onExit);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let frame = 0;
    const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: "high-performance" });
    configureFirstPersonRenderer(renderer);
    renderer.shadowMap.autoUpdate = false; // 阴影只在场景说"太阳动了 / 范围变了 / 人走动了"时重画
    renderer.domElement.className = "block h-full w-full";
    container.appendChild(renderer.domElement);
    let redraw = true; // 窗口大小、画质开关变了 → 下一帧必须画

    const resize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      // 真实的绘制尺寸：长边 3840（4K）或 2560（2K）像素，小屏幕上也是；屏幕本身像素更多时按屏幕来，不会变糊。
      const longEdgePx = LONG_EDGE_PX[qualityRef.current ? "4k" : "2k"];
      const requested = Math.max(longEdgePx / Math.max(width, height), window.devicePixelRatio || 1);
      const limit = renderer.capabilities.maxTextureSize / Math.max(width, height);
      const scale = Math.min(requested, limit);
      const bufferWidth = Math.floor(width * scale);
      const bufferHeight = Math.floor(height * scale);
      renderer.setSize(bufferWidth, bufferHeight, false);
      setRenderSize(bufferWidth + " × " + bufferHeight);
      redraw = true;
      const camera = sceneRef.current?.camera;
      if (camera) {
        camera.aspect = container.clientWidth / Math.max(container.clientHeight, 1);
        camera.updateProjectionMatrix();
      }
    };
    resizeRef.current = resize;
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    onLoadingChange(true);
    buildFirstPersonScene(point, renderer)
      .then((built) => {
        if (disposed) return built.dispose();
        sceneRef.current = built;
        setGroundHeightM(built.groundHeightM);
        resize();
        onLoadingChange(false);
        const walk = new WalkMotion(built.startGroundYM);
        walkRef.current = walk;
        let lastMs = performance.now();
        let lastHudMs = 0;
        let shownHeading = viewRef.current.yawDeg;
        let drawn = { yawDeg: Number.NaN, pitchDeg: Number.NaN, eyeHeightM: Number.NaN, timeMs: Number.NaN, eastM: Number.NaN, northM: Number.NaN, groundYM: Number.NaN };
        const tick = () => {
          frame = requestAnimationFrame(tick);
          const now = performance.now();
          const dtS = Math.min((now - lastMs) / 1000, 0.1);
          lastMs = now;
          const v = viewRef.current;
          const held = input.current;
          if (held.turn) v.yawDeg = (((v.yawDeg + held.turn * TURN_DEG_PER_S * dtS) % 360) + 360) % 360;
          if (held.pitch) v.pitchDeg = THREE.MathUtils.clamp(v.pitchDeg + held.pitch * PITCH_DEG_PER_S * dtS, -PITCH_LIMIT_DEG, PITCH_LIMIT_DEG);
          // 放大/缩小：视场角追着目标走
          if (Math.abs(v.fovDeg - v.fovTargetDeg) > 0.01) {
            v.fovDeg += (v.fovTargetDeg - v.fovDeg) * (1 - Math.exp(-FOV_EASE_PER_S * dtS));
            built.camera.fov = v.fovDeg;
            redraw = true; // 视场角变了，下一帧要重画
            built.camera.updateProjectionMatrix();
            setZoomX(FOV_DEFAULT_DEG / v.fovDeg);
          }
          // 悬停转视角：只在打开、鼠标在画面上、并且没有在拖动时才起作用
          const hover = hoverRef.current;
          if (hoverLookRef.current && hover && now - lastPanMsRef.current > 250) {
            const strength = (offset: number) => Math.sign(offset) * Math.pow(Math.max(Math.abs(offset) - HOVER_DEADZONE, 0) / (1 - HOVER_DEADZONE), 1.5);
            const zoomSlow = v.fovDeg / FOV_DEFAULT_DEG; // 放大后转得更慢，才好瞄准
            v.yawDeg = (((v.yawDeg + strength(hover.x) * HOVER_YAW_DEG_PER_S * zoomSlow * dtS) % 360) + 360) % 360;
            const pitchTarget = THREE.MathUtils.clamp(-hover.y * HOVER_PITCH_RANGE_DEG * Math.max(zoomSlow, 0.35), -PITCH_LIMIT_DEG, PITCH_LIMIT_DEG);
            v.pitchDeg += (pitchTarget - v.pitchDeg) * (1 - Math.exp(-HOVER_PITCH_FOLLOW_PER_S * dtS));
          }
          if (Math.abs(v.yawDeg - shownHeading) > 0.25) {
            shownHeading = v.yawDeg;
            setHeadingDeg(v.yawDeg);
          }
          const feet = walk.step(dtS, held, v.yawDeg, v.eyeHeightM, built.surfaceYAt);
          if (now - lastHudMs > WALK_HUD_MS) {
            lastHudMs = now;
            const groundShiftM = feet.groundYM - built.startGroundYM;
            setWalkInfo((prev) => (Math.abs(prev.eastM - feet.eastM) + Math.abs(prev.northM - feet.northM) + Math.abs(prev.groundShiftM - groundShiftM) < 0.3 ? prev : { eastM: feet.eastM, northM: feet.northM, groundShiftM }));
          }
          const timeMs = timeRef.current;
          if (photoRequestRef.current) redraw = true; // 拍照要一帧全新的画面
          if (!redraw && v.yawDeg === drawn.yawDeg && v.pitchDeg === drawn.pitchDeg && v.eyeHeightM === drawn.eyeHeightM && timeMs === drawn.timeMs && feet.eastM === drawn.eastM && feet.northM === drawn.northM && feet.groundYM === drawn.groundYM) return; // 什么都没变：不画
          redraw = false;
          drawn = { yawDeg: v.yawDeg, pitchDeg: v.pitchDeg, eyeHeightM: v.eyeHeightM, timeMs, eastM: feet.eastM, northM: feet.northM, groundYM: feet.groundYM };
          built.setView(v.yawDeg, v.pitchDeg, v.eyeHeightM, feet);
          built.setTime(timeMs);
          if (built.updateLighting(v.yawDeg, dtS)) redraw = true; // 曝光还在渐变：下一帧接着画
          if (built.takeShadowDirty()) renderer.shadowMap.needsUpdate = true;
          renderer.render(built.scene, built.camera);
          if (photoRequestRef.current) {
            photoRequestRef.current = false;
            const { text, filename } = photoCaptionRef.current;
            composePhoto(renderer.domElement, text).then(
              (blob) => {
                downloadBlob(blob, filename);
                setPhotoNote(`Photo saved: ${filename}`);
              },
              () => setPhotoNote("The picture could not be saved. Try again."),
            );
          }
        };
        tick();
      })
      .catch(() => {
        if (!disposed) onError("The terrain around this spot could not be loaded. Go back to the map and try again.");
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeRef.current = null;
      walkRef.current = null;
      sceneRef.current?.dispose();
      sceneRef.current = null;
      renderer.dispose();
      renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 换点时整个组件会重新挂载
  }, [point]);

  const lookToward = (azimuthDeg: number, elevationDeg: number) => {
    viewRef.current.yawDeg = (azimuthDeg + 360) % 360;
    viewRef.current.pitchDeg = THREE.MathUtils.clamp(elevationDeg, -PITCH_LIMIT_DEG, PITCH_LIMIT_DEG);
    setHeadingDeg(viewRef.current.yawDeg);
  };

  usePointerGestures(containerRef, {
    onHover: (x, y) => {
      const box = containerRef.current;
      if (x === null || y === null || !box) {
        hoverRef.current = null;
        return;
      }
      hoverRef.current = { x: (x / Math.max(box.clientWidth, 1)) * 2 - 1, y: (y / Math.max(box.clientHeight, 1)) * 2 - 1 };
    },
    onPan: (dx, dy) => {
      lastPanMsRef.current = performance.now();
      const v = viewRef.current;
      const camera = sceneRef.current?.camera;
      const degPerPx = (camera?.fov ?? 70) / Math.max(containerRef.current?.clientHeight ?? 800, 1);
      v.yawDeg = (((v.yawDeg - dx * degPerPx) % 360) + 360) % 360; // 水平方向没有限制，可以一直转
      v.pitchDeg = THREE.MathUtils.clamp(v.pitchDeg + dy * degPerPx, -PITCH_LIMIT_DEG, PITCH_LIMIT_DEG);
      setHeadingDeg(v.yawDeg);
    },
    onZoom: (factor) => {
      // 只放大缩小（改视场角），不再升高视点：人还站在原地
      const v = viewRef.current;
      v.fovTargetDeg = THREE.MathUtils.clamp(v.fovTargetDeg / Math.pow(factor, 1.6), FOV_MIN_DEG, FOV_DEFAULT_DEG);
    },
  });

  const backToStart = () => {
    const scene = sceneRef.current;
    if (scene) walkRef.current?.reset(scene.startGroundYM);
    setWalkInfo({ eastM: 0, northM: 0, groundShiftM: 0 });
  };
  const walkedM = Math.hypot(walkInfo.eastM, walkInfo.northM);
  // 走动后的位置：从着陆点沿大圆往那个方向走 walkedM 米
  const here = walkedM < 0.5 ? point : destination(point, Math.atan2(walkInfo.eastM, walkInfo.northM), walkedM / MOON_RADIUS_M);
  const walkedText = walkedM < 1000 ? `${walkedM.toFixed(0)} m` : `${(walkedM / 1000).toFixed(2)} km`;

  const sunUp = conditions.sun.elevationDeg > 0;
  const earthUp = conditions.earth.elevationDeg > 0;
  photoCaptionRef.current = {
    text: `${formatLatLon(here)}  ·  ${new Date(timeMs).toISOString().slice(0, 16).replace("T", " ")} UTC  ·  Sun ${conditions.sun.elevationDeg.toFixed(1)}° above the horizon  ·  Lunar Quest`,
    filename: photoFilename(here.latDeg, here.lonDeg, timeMs),
  };
  const takePhoto = () => {
    photoRequestRef.current = true;
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
  };
  return (
    <>
      {flash && <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-30 bg-white/70" />}
      {photoNote && (
        <p role="status" className="absolute bottom-28 left-1/2 z-30 max-w-[calc(100vw-2rem)] -translate-x-1/2 truncate rounded-full border border-white/15 bg-black/75 px-4 py-2 text-xs text-white lunar-glass backdrop-blur-md">
          {photoNote}
        </p>
      )}
      <div ref={containerRef} tabIndex={0} role="region" aria-label="360 degree lunar surface view. Drag to look around, scroll to zoom; W, A, S, D or the arrow keys walk and turn; Escape returns to the map." className="absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-300" />
      <CompassTape headingDeg={headingDeg} sunAzimuthDeg={sunUp ? conditions.sun.azimuthDeg : null} earthAzimuthDeg={earthUp ? conditions.earth.azimuthDeg : null} />

      {/* 右上角：返回、鼠标跟随开关，和可以收起/展开的信息栏（默认收起，不挡画面） */}
      <div className="pointer-events-none absolute right-4 top-[6.4rem] z-20 flex w-[min(21rem,calc(100vw-2rem))] flex-col items-end gap-2 sm:right-6 min-[1120px]:top-6">
        <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
          <button
            type="button"
            aria-label="Take a photo of this view"
            title="Take a photo: saves what you see now as a PNG picture, with the place and time written on it."
            onClick={takePhoto}
            className="grid h-[2.6rem] w-[2.6rem] place-items-center rounded-full border border-white/15 bg-black/60 text-white lunar-glass backdrop-blur-md transition hover:bg-white/15 active:bg-lime-300 active:text-black"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l1.6-2.4h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13" r="3.6" /></svg>
          </button>
          <button
            type="button"
            aria-pressed={hoverLook}
            title="Mouse look: the view follows the mouse. Move it up or down to look up or down, towards the left or right edge to turn."
            onClick={() => setHoverLook((value) => !value)}
            className={`rounded-full border px-5 py-2.5 text-sm font-medium lunar-glass backdrop-blur-md transition ${hoverLook ? "border-lime-300/70 bg-lime-300/20 text-lime-100" : "border-white/15 bg-black/60 text-white hover:bg-white/15"}`}
          >
            {/* 两种文字叠在同一格里，按钮宽度取较长的那个：开 / 关时按钮不变宽，旁边的按钮也不挪位置 */}
            <span className="grid">
              <span aria-hidden={!hoverLook} className={`col-start-1 row-start-1 ${hoverLook ? "" : "invisible"}`}>Mouse look: ON</span>
              <span aria-hidden={hoverLook} className={`col-start-1 row-start-1 ${hoverLook ? "invisible" : ""}`}>Mouse look: off</span>
            </span>
          </button>
          <button
            type="button"
            onClick={onExit}
            className="rounded-full border border-white/15 bg-black/60 px-5 py-2.5 text-sm font-medium text-white lunar-glass backdrop-blur-md transition hover:bg-white/15"
          >
            ← Back to map
          </button>
        </div>
        <div className="pointer-events-auto w-full overflow-hidden rounded-xl border border-white/10 bg-black/55 text-sm lunar-glass backdrop-blur-md">
          <button
            type="button"
            aria-expanded={infoOpen}
            aria-controls="first-person-info"
            title={infoOpen ? "Fold this panel away to see more of the view" : "Show where you stand, the Sun and Earth, and power and contact"}
            onClick={() => setInfoOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/5"
          >
            <span>
              <span className="block text-[10px] uppercase tracking-[0.2em] text-lime-300/80">Standing at</span>
              <span className="font-mono text-sm text-white">{formatLatLon(here)}</span>
            </span>
            <span aria-hidden="true" className="shrink-0 text-xs text-white/70">{infoOpen ? "▴ Hide" : "▾ Details"}</span>
          </button>
          {infoOpen && (
            <div id="first-person-info" className="max-h-[calc(100vh-31.5rem)] min-h-[6rem] overflow-y-auto border-t border-white/10 p-4 min-[1120px]:max-h-[calc(100vh-26rem)]">
              {walkedM >= 0.5 && (
                <p className="mt-1 flex items-center gap-2 text-[11px] text-white/60">
                  <span>{`Walked ${walkedText} from the landing spot${walkedM > WALK_LIMIT_M - 5 ? " (edge of the walkable area)" : ""}`}</span>
                  <button type="button" onClick={backToStart} className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/80 hover:bg-white/10">Back to start</button>
                </p>
              )}
              <div className="mt-2 flex items-center gap-2 text-xs">
                <button type="button" aria-pressed={render4k} title="Switch between 4K and 2K rendering" onClick={() => setRender4k((value) => !value)} className="rounded-full border border-lime-300/30 px-3 py-1 text-lime-200 hover:bg-white/10">
                  {render4k ? "4K render" : "2K render"}
                </button>
                <span className="font-mono text-[10px] text-white/55">{renderSize}</span>
              </div>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px] text-white/80">
                <dt className="text-white/50">Ground height</dt>
                <dd className="font-mono">{groundHeightM === null ? "…" : `${((groundHeightM + walkInfo.groundShiftM) / 1000).toFixed(2)} km`}</dd>
                <dt className="text-white/50">Sun</dt>
                <dd className="font-mono">{`el ${conditions.sun.elevationDeg.toFixed(1)}°  az ${conditions.sun.azimuthDeg.toFixed(0)}°`}{sunUp ? "" : "  (night)"}</dd>
                <dt className="text-white/50">Earth</dt>
                <dd className="font-mono">{`el ${conditions.earth.elevationDeg.toFixed(1)}°  az ${conditions.earth.azimuthDeg.toFixed(0)}°`}{earthUp ? "" : "  (below horizon)"}</dd>
                <dt className="text-white/50">Zoom</dt>
                <dd className="font-mono">{`${zoomX.toFixed(1)}×`}</dd>
              </dl>
              <TerrainVisibilityPanel state={pointApi} />
              <div className="mt-3 flex gap-2">
                <LookButton label="Face the Sun" disabled={!sunUp} onClick={() => lookToward(conditions.sun.azimuthDeg, conditions.sun.elevationDeg)} />
                <LookButton label="Face Earth" disabled={!earthUp} onClick={() => lookToward(conditions.earth.azimuthDeg, conditions.earth.elevationDeg)} />
              </div>
              <p className="mt-3 text-[11px] leading-snug text-white/45">
                Drag to look around (full 360°), or switch on Mouse look at the top right and just move the mouse · W/S or ↑/↓ to walk, A/D to step sideways, ←/→ to turn, hold Shift to go faster (up to 2 km from the landing spot) · scroll to zoom in and out · Esc to return · use the timeline to move the Sun and shadows. Large terrain and shadows use NASA LOLA data (about 1.9 km
                resolution). Craters of 1 km and wider are real ones from the Robbins lunar crater catalogue, at their real positions and sizes. Smaller craters, the scattered rocks and the soil grain are generated to match real lunar statistics, so they look right but are not measured. The Sun and Earth rows above are angles from a smooth sphere and ignore terrain blocking; the &quot;Power &amp; Earth contact&quot; block includes it and is for the landing spot.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-28 right-4 z-20 flex flex-col items-center gap-1.5 sm:right-6 min-[1200px]:bottom-7">
        <WalkPad onPress={setPad} />
        <span className="hidden text-[10px] text-white/50 sm:block">W A S D · Shift to run</span>
      </div>
    </>
  );
}

function LookButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35">
      {label}
    </button>
  );
}
