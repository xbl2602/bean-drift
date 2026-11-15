"use client";
// 候选点面板里的第一人称照片：站在这个点、按地图当前时刻看到的样子。点一下就进入可以转动的第一人称。
// 时间轴播放或拖动时不跟着每一帧重画：停下来一会儿再画，并且按整点取时间，避免排一长串渲染。
import { useEffect, useState } from "react";
import { hasSiteSnapshotJob, useSiteSnapshot } from "../first-person/site-snapshot";
import { MAX_FLIGHT_S } from "../globe-3d/camera-flight";
import type { LatLon } from "../moon-frames";

const HOUR_MS = 3_600_000;
const SETTLE_MS = 700;
/**
 * 选中一个点时，镜头从点击那一刻起最多飞 MAX_FLIGHT_S 秒（globe-3d-view.tsx 里月球给面板让位另需 0.7 秒，更短）。
 * 画照片要把第一人称场景在主线程里整个建一遍，一次连续占用约半秒；如果和飞行同时开始，
 * 飞到一半会整个画面停住再跳一下（线上实测每次点击 0.5~0.75 秒）。所以新的点先等镜头飞完，再开始画。
 */
const CAMERA_SETTLE_MS = Math.ceil(MAX_FLIGHT_S * 1000) + 300;

/** 这个点的照片什么时候可以开始画：已经画过或正在画的立刻放行，新的点等镜头飞完。 */
function useStartAfterCameraSettles(pointKey: string, alreadyStarted: boolean): boolean {
  const [releasedKey, setReleasedKey] = useState<string | null>(null);
  useEffect(() => {
    if (alreadyStarted) return;
    const timer = setTimeout(() => setReleasedKey(pointKey), CAMERA_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [pointKey, alreadyStarted]);
  return alreadyStarted || releasedKey === pointKey;
}
const formatUtc = (timeMs: number) => `${new Date(timeMs).toISOString().slice(0, 16).replace("T", " ")} UTC`;

/** 时间停下来 SETTLE_MS 之后才更新，取整到整点。 */
function useSettledHour(timeMs: number): number {
  const hourMs = Math.floor(timeMs / HOUR_MS) * HOUR_MS;
  const [settled, setSettled] = useState(hourMs);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(hourMs), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [hourMs]);
  return settled;
}

export function SitePhoto({ point, name, timeMs, onStandHere }: { point: LatLon; name: string; timeMs: number; onStandHere: () => void }) {
  const photoTimeMs = useSettledHour(timeMs);
  // 新照片还在画的时候继续显示上一张（同一个点），不要闪成空白
  const pointKey = `${point.latDeg},${point.lonDeg}`;
  const mayStart = useStartAfterCameraSettles(pointKey, hasSiteSnapshotJob(point, photoTimeMs));
  const snapshot = useSiteSnapshot(point, photoTimeMs, mayStart);
  const readyUrl = snapshot.status === "ready" ? snapshot.url : null;
  const [lastShown, setLastShown] = useState<{ key: string; url: string; timeMs: number } | null>(null);
  useEffect(() => {
    if (readyUrl) setLastShown({ key: pointKey, url: readyUrl, timeMs: photoTimeMs });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在新照片画好时记下
  }, [readyUrl]);
  const current = readyUrl ? { key: pointKey, url: readyUrl, timeMs: photoTimeMs } : lastShown;
  const shown = current?.key === pointKey ? current : null;
  const updating = snapshot.status === "loading" && shown !== null;

  return (
    <figure className="mt-3">
      <button
        type="button"
        onClick={onStandHere}
        title="Stand here: open the 360° first-person view"
        className="group relative block aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
      >
        {shown && snapshot.status !== "error" ? (
          // eslint-disable-next-line @next/next/no-img-element -- 浏览器里现画的 blob 图片，不走 next/image
          <img src={shown.url} alt={`First-person view at ${name}, ${formatUtc(shown.timeMs)}`} className={`h-full w-full object-cover transition duration-300 group-hover:scale-[1.03] ${updating ? "opacity-60" : ""}`} />
        ) : (
          <span role="status" className={`absolute inset-0 flex items-center justify-center text-xs ${snapshot.status === "error" ? "text-amber-200" : "animate-pulse text-slate-400"}`}>
            {snapshot.status === "error" ? "View could not be rendered" : "Rendering first-person view…"}
          </span>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-lime-100 lunar-glass backdrop-blur-sm">1st view</span>
        <span className="absolute bottom-2 right-2 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-medium text-lime-100 lunar-glass backdrop-blur-sm group-hover:bg-lime-300 group-hover:text-black">
          Look around ↗
        </span>
      </button>
      <figcaption className="mt-1 text-[9px] leading-snug text-slate-500">
        {formatUtc(photoTimeMs)}{updating ? " · updating…" : ""} · NASA LOLA terrain; small detail within 3 km is illustrative
      </figcaption>
    </figure>
  );
}
