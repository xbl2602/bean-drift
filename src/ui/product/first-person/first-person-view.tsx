"use client";
// 第一人称：站在点击的位置环顾四周。拖动可水平 360° 转一整圈、上下看；滚轮升降视点（1.6 m 宇航员眼高 ~ 10 km）。
// 画面按屏幕实际像素渲染（4K 屏就是 4K）；太阳和阴影跟着底部时间轴走。
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { formatLatLon, type LatLon } from "../moon-frames";
import { TerrainVisibilityPanel } from "../point-api/terrain-visibility-panel";
import { usePointApi } from "../point-api/use-point-api";
import { skyConditionsAt } from "../sky-conditions";
import { usePointerGestures } from "../use-pointer-gestures";
import { CompassTape } from "./compass-tape";
import { buildFirstPersonScene, type FirstPersonScene } from "./first-person-scene";

const EYE_HEIGHT_MIN_M = 1.6;
const EYE_HEIGHT_MAX_M = 10_000;
const PITCH_LIMIT_DEG = 89;

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
  // 开场朝向：太阳在侧面（方位 +90°），阴影横穿画面最明显；太阳在地平线下就看向地球
  const initialYaw = conditions.sun.elevationDeg > 0 ? (conditions.sun.azimuthDeg + 90) % 360 : conditions.earth.azimuthDeg;
  const viewRef = useRef({ yawDeg: initialYaw, pitchDeg: -4, eyeHeightM: EYE_HEIGHT_MIN_M });
  const timeRef = useRef(timeMs);
  timeRef.current = timeMs;
  const [headingDeg, setHeadingDeg] = useState(initialYaw);
  const [eyeHeightM, setEyeHeightM] = useState(EYE_HEIGHT_MIN_M);
  const [groundHeightM, setGroundHeightM] = useState<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let frame = 0;
    const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // 月面没有大气，阳光下的地面比 ACES 默认曝光亮得多；提高曝光，让低太阳角下的地面也看得清
    renderer.toneMappingExposure = 1.8;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = "block h-full w-full";
    container.appendChild(renderer.domElement);

    const resize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      // 4K is an actual drawing-buffer size, including on smaller screens.
      // Keep the viewport aspect ratio; the longest edge targets 3840 pixels.
      const requested = qualityRef.current ? 3840 / Math.max(width, height) : Math.min(window.devicePixelRatio, 2);
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
        const tick = () => {
          frame = requestAnimationFrame(tick);
          const v = viewRef.current;
          built.setView(v.yawDeg, v.pitchDeg, v.eyeHeightM);
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

  const onLookKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const v = viewRef.current;
    const step = event.shiftKey ? 15 : 3;
    if (event.key === "Escape") { event.preventDefault(); onExit(); return; }
    if (event.key === "ArrowLeft") v.yawDeg -= step;
    else if (event.key === "ArrowRight") v.yawDeg += step;
    else if (event.key === "ArrowUp") v.pitchDeg += step;
    else if (event.key === "ArrowDown") v.pitchDeg -= step;
    else return;
    event.preventDefault();
    lookToward(v.yawDeg, v.pitchDeg);
  };

  const sunUp = conditions.sun.elevationDeg > 0;
  const earthUp = conditions.earth.elevationDeg > 0;
  return (
    <>
      <div ref={containerRef} tabIndex={0} role="region" aria-label="360 degree lunar surface view. Drag or use arrow keys to look around; Escape returns to the map." onKeyDown={onLookKey} className="absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-300" />
      <CompassTape headingDeg={headingDeg} sunAzimuthDeg={sunUp ? conditions.sun.azimuthDeg : null} earthAzimuthDeg={earthUp ? conditions.earth.azimuthDeg : null} />

      <button
        type="button"
        onClick={onExit}
        className="absolute right-4 top-4 z-20 rounded-full border border-white/15 bg-black/60 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/15 sm:right-6 sm:top-6"
      >
        ← Back to map
      </button>

      <div className="pointer-events-none absolute bottom-24 left-4 z-10 sm:left-6">
        <div className="pointer-events-auto max-h-[calc(100vh-11.5rem)] w-[min(21rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-white/10 bg-black/55 p-4 text-sm backdrop-blur-md">
          <p className="text-xs uppercase tracking-[0.2em] text-lime-300/80">Standing at</p>
          <p className="mt-1 font-mono text-base text-white">{formatLatLon(point)}</p>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <button type="button" aria-pressed={render4k} onClick={() => setRender4k((value) => !value)} className="rounded-full border border-lime-300/30 px-3 py-1 text-lime-200 hover:bg-white/10">
              {render4k ? "4K render" : "Screen resolution"}
            </button>
            <span className="font-mono text-[10px] text-white/55">{renderSize}</span>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px] text-white/80">
            <dt className="text-white/50">Ground height</dt>
            <dd className="font-mono">{groundHeightM === null ? "…" : `${(groundHeightM / 1000).toFixed(2)} km`}</dd>
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
            Drag or use arrow keys to look around (full 360°) · scroll to rise · Esc to return · use the timeline to move the Sun and shadows. Large terrain and shadows use NASA LOLA data (about 1.9 km
            resolution). Small craters, bumps and soil grain within about 3 km are illustrative, not measured. The Sun and Earth rows above are angles from a smooth sphere and ignore terrain blocking; the "Terrain-adjusted" block includes it.
          </p>
        </div>
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
