"use client";
// 跟着"点 + 时间"去 /api/point 取数。拖时间轴时不是每一帧都请求：停下来 450 ms 后才发一次；
// 点变了会立刻发；上一个还没回来就被取消。请求期间继续显示上一次的数据（标明正在更新），失败时给提示。
import { useEffect, useState } from "react";
import type { PointConditions } from "@/core/types";
import type { LatLon } from "../moon-frames";
import { fetchPointConditions, PointApiError } from "./fetch-point-conditions";

const TIME_SETTLE_MS = 450;

export type PointApiState =
  | { status: "loading"; data: PointConditions | null }
  | { status: "ready"; data: PointConditions }
  | { status: "error"; message: string; data: PointConditions | null };

interface Settled {
  /** 这份结果是为哪个点、哪个时刻取的。 */
  key: string;
  result: { ok: true; data: PointConditions } | { ok: false; message: string };
}

const pointKey = (point: LatLon) => `${point.latDeg},${point.lonDeg}`;

export function usePointApi(point: LatLon, timeMs: number): PointApiState {
  const [settledTimeMs, setSettledTimeMs] = useState(timeMs);
  const [settled, setSettled] = useState<Settled | null>(null);
  const [lastData, setLastData] = useState<{ pointKey: string; data: PointConditions } | null>(null);
  const key = pointKey(point);

  useEffect(() => {
    const timer = setTimeout(() => setSettledTimeMs(timeMs), TIME_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [timeMs]);

  useEffect(() => {
    const controller = new AbortController();
    const requestKey = `${key}@${settledTimeMs}`;
    fetchPointConditions(point, settledTimeMs, controller.signal).then(
      (data) => {
        setSettled({ key: requestKey, result: { ok: true, data } });
        setLastData({ pointKey: key, data });
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        const message = cause instanceof PointApiError ? cause.message : "Terrain-adjusted data is unavailable right now.";
        setSettled({ key: requestKey, result: { ok: false, message } });
      },
    );
    return () => controller.abort();
    // point 是对象，用它的坐标（key）做依赖，避免父组件每次重渲染都重新请求
  }, [key, settledTimeMs]);

  // 换了点之后，旧点的数据不能继续显示
  const previous = lastData && lastData.pointKey === key ? lastData.data : null;
  const current = settled && settled.key === `${key}@${settledTimeMs}` && settledTimeMs === timeMs ? settled.result : null;
  if (!current) return { status: "loading", data: previous };
  return current.ok ? { status: "ready", data: current.data } : { status: "error", message: current.message, data: previous };
}
