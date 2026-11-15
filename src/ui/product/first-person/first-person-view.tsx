"use client";
// 第一人称：站在点击的位置环顾四周。拖动可水平 360° 转一整圈、上下看；滚轮升降视点（1.6 m 宇航员眼高 ~ 10 km）。
// 键盘或屏幕方向键可以在着陆点周围 2 km 内前后左右走动（walk-motion.ts、walk-pad.tsx）。
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
import { destination } from "./terrain-patch";
import { WALK_LIMIT_M, WalkMotion } from "./walk-motion";
import { useWalkInput, WalkPad } from "./walk-pad";

const EYE_HEIGHT_MIN_M = 1.6;
const EYE_HEIGHT_MAX_M = 10_000;
const PITCH_LIMIT_DEG = 89;
/** 渲染分辨率：长边像素数。2K 是最低档，屏幕本身更清晰时按屏幕来。 */
const LONG_EDGE_PX = { "4k": 3840, "2k": 2560 } as const;
/** 按住 ←/→ 转身、PageUp/PageDown 抬头低头的速度（度/秒）。 */
const TURN_DEG_PER_S = 90;
const PITCH_DEG_PER_S = 60;
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
  const viewRef = useRef({ yawDeg: initialYaw, pitchDeg: OPENING_PITCH_DEG, eyeHeightM: EYE_HEIGHT_MIN_M });
  const timeRef = useRef(timeMs);
  timeRef.current = timeMs;
  const [headingDeg, setHeadingDeg] = useState(initialYaw);
  const [eyeHeightM, setEyeHeightM] = useState(EYE_HEIGHT_MIN_M);
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
    renderer.domElement.className = "block h-full w-full";
    container.appendChild(renderer.domElement);

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
        const tick = () => {
          frame = requestAnimationFrame(tick);
          const now = performance.now();
          const dtS = Math.min((now - lastMs) / 1000, 0.1);
          lastMs = now;
          const v = viewRef.current;
          const held = input.current;
          if (held.turn) v.yawDeg = (((v.yawDeg + held.turn * TURN_DEG_PER_S * dtS) % 360) + 360) % 360;
          if (held.pitch) v.pitchDeg = THREE.MathUtils.clamp(v.pitchDeg + held.pitch * PITCH_DEG_PER_S * dtS, -PITCH_LIMIT_DEG, PITCH_LIMIT_DEG);
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
          built.setView(v.yawDeg, v.pitchDeg, v.eyeHeightM, feet);
          built.setTime(timeRef.current);
          renderer.render(built.scene, built.camera);
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
    onPan: (dx, dy) => {
      const v = viewRef.current;
      const camera = sceneRef.current?.camera;
      const degPerPx = (camera?.fov ?? 70) / Math.max(containerRef.current?.clientHeight ?? 800, 1);
      v.yawDeg = (((v.yawDeg - dx * degPerPx) % 360) + 360) % 360; // 水平方向没有限制，可以一直转
      v.pitchDeg = THREE.MathUtils.clamp(v.pitchDeg + dy * degPerPx, -PITCH_LIMIT_DEG, PITCH_LIMIT_DEG);
      setHeadingDeg(v.yawDeg);
    },
    onZoom: (factor) => {
      const v = viewRef.current;
      v.eyeHeightM = THREE.MathUtils.clamp(v.eyeHeightM / Math.pow(factor, 3), EYE_HEIGHT_MIN_M, EYE_HEIGHT_MAX_M);
      setEyeHeightM(v.eyeHeightM);
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
  return (
    <>
      <div ref={containerRef} tabIndex={0} role="region" aria-label="360 degree lunar surface view. Drag to look around; W, A, S, D or the arrow keys walk and turn; Escape returns to the map." className="absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-300" />
      <CompassTape headingDeg={headingDeg} sunAzimuthDeg={sunUp ? conditions.sun.azimuthDeg : null} earthAzimuthDeg={earthUp ? conditions.earth.azimuthDeg : null} />

      <button
        type="button"
        onClick={onExit}
        className="absolute right-4 top-4 z-20 rounded-full border border-white/15 bg-black/60 px-5 py-2.5 text-sm font-medium text-white lunar-glass backdrop-blur-md transition hover:bg-white/15 sm:right-6 sm:top-6"
      >
        ← Back to map
      </button>

      <div className="pointer-events-none absolute bottom-24 left-24 z-10">
        <div className="pointer-events-auto max-h-[calc(100vh-11.5rem)] w-[min(21rem,calc(100vw-7rem))] overflow-y-auto rounded-xl border border-white/10 bg-black/55 p-4 text-sm lunar-glass backdrop-blur-md">
          <p className="text-xs uppercase tracking-[0.2em] text-lime-300/80">Standing at</p>
          <p className="mt-1 font-mono text-base text-white">{formatLatLon(here)}</p>
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
            <dt className="text-white/50">Eye height</dt>
            <dd className="font-mono">{eyeHeightM < 10 ? `${eyeHeightM.toFixed(1)} m` : `${(eyeHeightM / 1000).toFixed(2)} km`}</dd>
          </dl>
          <TerrainVisibilityPanel state={pointApi} />
          <div className="mt-3 flex gap-2">
            <LookButton label="Face the Sun" disabled={!sunUp} onClick={() => lookToward(conditions.sun.azimuthDeg, conditions.sun.elevationDeg)} />
            <LookButton label="Face Earth" disabled={!earthUp} onClick={() => lookToward(conditions.earth.azimuthDeg, conditions.earth.elevationDeg)} />
          </div>
          <p className="mt-3 text-[11px] leading-snug text-white/45">
            Drag to look around (full 360°) · W/S or ↑/↓ to walk, A/D to step sideways, ←/→ to turn, hold Shift to go faster (up to 2 km from the landing spot) · scroll to rise · Esc to return · use the timeline to move the Sun and shadows. Large terrain and shadows use NASA LOLA data (about 1.9 km
            resolution). Small craters, bumps and soil grain within about 3 km are illustrative, not measured. The Sun and Earth rows above are angles from a smooth sphere and ignore terrain blocking; the &quot;Power &amp; Earth contact&quot; block includes it and is for the landing spot.
          </p>
        </div>
      </div>

      <div className="absolute bottom-28 right-4 z-20 flex flex-col items-center gap-1.5 sm:right-6">
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
