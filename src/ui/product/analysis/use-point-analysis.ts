"use client";
// 把 analyzePoint（异步）接到 React：一组候选点的分析结果，以及鼠标悬停点的分析结果。
// 时间按小时取整后才重算：播放时间轴时不必每帧重算，数值（温度、太阳高度）变化也跟得上。
import { useEffect, useState } from "react";
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

/** 悬停点的分析；鼠标停下约 0.12 秒后才算，移动中不算。 */
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

/** Hover cards keep their existing empty state when details are unavailable. */
export function useHoverAnalysis(point: LatLon | null, timeMs: number, weights: SuitabilityWeights): PointAnalysis | null {
  const analysis = usePointAnalysis(point, timeMs, weights);
  return analysis === "error" ? null : analysis;
}
