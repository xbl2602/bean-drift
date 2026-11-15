"use client";
// 把 analyzePoint（异步）接到 React：一组候选点的分析结果，以及鼠标悬停点的分析结果。
// 时间按小时取整后才重算：播放时间轴时不必每帧重算，数值（温度、太阳高度）变化也跟得上。
import { useEffect, useRef, useState } from "react";
import type { SuitabilityWeights } from "../map-layers";
import type { LatLon } from "../moon-frames";
import type { SavedSite } from "../overlay/annotations";
import { analyzePoint, type PointAnalysis } from "./point-analysis";

const HOUR_MS = 3_600_000;
const quantizeToHour = (timeMs: number) => Math.round(timeMs / HOUR_MS) * HOUR_MS;

export type SiteAnalyses = Record<string, PointAnalysis | "error" | undefined>;

export function useSiteAnalyses(sites: SavedSite[], timeMs: number, weights: SuitabilityWeights): SiteAnalyses {
  const [analyses, setAnalyses] = useState<SiteAnalyses>({});
  const hourMs = quantizeToHour(timeMs);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      sites.map(async (site) => {
        try {
          return [site.id, await analyzePoint(site, hourMs, weights)] as const;
        } catch {
          return [site.id, "error"] as const; // 数据文件加载失败：这一格显示"不可用"，不影响别的点
        }
      }),
    ).then((entries) => {
      if (!cancelled) setAnalyses(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [sites, hourMs, weights]);

  return analyses;
}

/** Selected-point details use a short debounce; hover uses the continuous hook below. */
export function usePointAnalysis(point: LatLon | null, timeMs: number, weights: SuitabilityWeights): PointAnalysis | "error" | null {
  const [result, setResult] = useState<{ key: string; weights: SuitabilityWeights; value: PointAnalysis | "error" } | null>(null);
  const hourMs = quantizeToHour(timeMs);
  const latDeg = point?.latDeg;
  const lonDeg = point?.lonDeg;

  const key = `${latDeg},${lonDeg},${hourMs}`;
  useEffect(() => {
    if (latDeg === undefined || lonDeg === undefined) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      analyzePoint({ latDeg, lonDeg }, hourMs, weights)
        .then((value) => !cancelled && setResult({ key, weights, value }))
        .catch(() => !cancelled && setResult({ key, weights, value: "error" }));
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [latDeg, lonDeg, hourMs, weights, key]);

  return point && result?.key === key && result.weights === weights ? result.value : null;
}

/** Continuously sample the latest cursor at a bounded rate; keep the last labelled reading between samples. */
export function useHoverAnalysis(point: LatLon | null, timeMs: number, weights: SuitabilityWeights): PointAnalysis | null {
  const latest = useRef({ point, weights }); latest.current = { point, weights };
  const [result, setResult] = useState<{ value: PointAnalysis; hourMs: number; weights: SuitabilityWeights } | null>(null);
  const hourMs = quantizeToHour(timeMs), active = point !== null;
  useEffect(() => {
    if (!active) return;
    let cancelled = false, busy = false, frame = 0, lastSampleMs = -Infinity, lastPointKey = "";
    setResult(null);
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const current = latest.current;
      if (busy || !current.point || now - lastSampleMs < 80) return;
      const pointKey = `${current.point.latDeg},${current.point.lonDeg}`;
      if (pointKey === lastPointKey) return;
      lastPointKey = pointKey;
      busy = true; lastSampleMs = now;
      analyzePoint(current.point, hourMs, current.weights).then(value => {
        if (!cancelled) setResult({ value, hourMs, weights: current.weights });
      }).catch(() => { if (!cancelled) setResult(null); }).finally(() => { busy = false; });
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [active, hourMs, weights]);
  return active && result?.hourMs === hourMs && result.weights === weights ? result.value : null;
}
