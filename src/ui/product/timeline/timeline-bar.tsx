"use client";
// 底部时间轴（2D、3D、第一人称都显示）：拖动或播放，太阳位置随之改变，昼夜线和阴影跟着动。时间一律 UTC。
// 地图上：滑块以当前时间为中点，左右各 15 天。第一人称（loop）：滑块从最左边开始，往后 30 天（略多于一个月球日），
// 播到最右边就回到最左边接着播，可以一直看太阳升起、落下、再升起。
import { useEffect, useRef, useState } from "react";
import { DateTimePicker } from "./date-time-picker";
import { bodyToLatLon, formatLatLon, sunDirectionBody } from "../moon-frames";

const HOUR_MS = 3_600_000;
const HALF_RANGE_H = 15 * 24; // 滑块左右各 15 天，约半个朔望月
const SPEEDS = [
  { label: "1 h/s", simulatedMsPerRealMs: 3_600 },
  { label: "6 h/s", simulatedMsPerRealMs: 21_600 },
  { label: "1 d/s", simulatedMsPerRealMs: 86_400 },
];
const MIN_TIME_MS = Date.UTC(2000, 0, 1);
const MAX_TIME_MS = Date.UTC(2099, 11, 31, 23, 59);

interface TimelineBarProps {
  timeMs: number;
  onTimeChange: (timeMs: number) => void;
  /** 第一人称用：滑块从左端（进入时的时刻）开始，播到右端回到左端循环。 */
  loop?: boolean;
}

export function TimelineBar({ timeMs, onTimeChange, loop = false }: TimelineBarProps) {
  const [anchorMs, setAnchorMs] = useState(timeMs);
  const anchorRef = useRef(anchorMs);
  anchorRef.current = anchorMs;
  // 滑块范围（小时，相对 anchor）：地图上 -15 天..+15 天，第一人称 0..+30 天
  const minH = loop ? 0 : -HALF_RANGE_H;
  const maxH = loop ? 2 * HALF_RANGE_H : HALF_RANGE_H;
  const [playing, setPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1);
  const timeRef = useRef(timeMs);
  timeRef.current = timeMs;

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      frame = requestAnimationFrame(step);
      // 标签页切到后台再回来时 now-last 会很大，限制单步最多 100 ms，避免时间猛跳
      const next = timeRef.current + Math.min(now - last, 100) * SPEEDS[speedIndex].simulatedMsPerRealMs;
      last = now;
      if (next >= MAX_TIME_MS) return setPlaying(false);
      // 第一人称：播到右端，回到左端接着播
      if (loop && next > anchorRef.current + 2 * HALF_RANGE_H * HOUR_MS) return onTimeChange(anchorRef.current);
      onTimeChange(next);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, speedIndex, onTimeChange, loop]);

  // 时间跑到滑块范围之外时（地图上播放超过 15 天、或别处改了时间），把滑块重新对准当前时间
  const offsetH = (timeMs - anchorMs) / HOUR_MS;
  useEffect(() => {
    if (offsetH < minH - 0.01 || offsetH > maxH + 0.01) setAnchorMs(timeMs);
  }, [offsetH, timeMs, minH, maxH]);

  const jumpTo = (ms: number) => {
    const clamped = Math.min(Math.max(ms, MIN_TIME_MS), MAX_TIME_MS);
    setAnchorMs(clamped);
    onTimeChange(clamped);
  };
  const subSolar = bodyToLatLon(sunDirectionBody(timeMs));

  return (
    <div data-tour="timeline" className="absolute bottom-4 left-1/2 z-20 w-[min(46rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#0b0f17]/85 px-3 py-2 text-white shadow-xl shadow-black/50 lunar-glass backdrop-blur-xl sm:bottom-5">
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => setPlaying((v) => !v)}
          aria-label={playing ? "Pause time" : "Play time"}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lime-300 text-black transition hover:bg-lime-200"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">{playing ? <path d="M7 5h4v14H7zM13 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}</svg>
        </button>
        <button type="button" onClick={() => setSpeedIndex((i) => (i + 1) % SPEEDS.length)} title="Playback speed" className="shrink-0 rounded-full border border-white/15 px-2.5 py-1 font-mono text-[11px] text-white/80 hover:bg-white/10">
          {SPEEDS[speedIndex].label}
        </button>
        <input
          type="range"
          min={minH}
          max={maxH}
          step={0.25}
          value={Math.max(minH, Math.min(maxH, offsetH))}
          onChange={(e) => onTimeChange(anchorMs + Number(e.target.value) * HOUR_MS)}
          aria-label={loop ? "Move time forward up to 30 days, about one lunar day; the Sun and shadows follow" : "Move time up to 15 days either way; the Sun and shadows follow"}
          className="min-w-0 flex-1 accent-lime-300"
        />
        <DateTimePicker timeMs={timeMs} onApply={jumpTo} onOpen={() => setPlaying(false)} />
        <button type="button" onClick={() => jumpTo(Date.now())} className="shrink-0 rounded-full px-2 py-1 text-xs text-lime-300 hover:bg-white/10">
          Now
        </button>
      </div>
      <p className="mt-1 flex flex-wrap justify-between gap-x-4 px-1 font-mono text-[11px] text-white/55">
        <span>{new Date(timeMs).toISOString().slice(0, 16).replace("T", " ")} UTC</span>
        <span>Sun overhead at {formatLatLon(subSolar)}</span>
      </p>
    </div>
  );
}
