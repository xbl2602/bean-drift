"use client";
// 跑一次模拟：先从 /api/timeline 取任务期间的太阳 / 地球可见时间段，再在浏览器里逐步算电量和工作状态。
// 可以中途取消；组件卸载或重新开始时会取消上一次还没完成的请求。
import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLon } from "../moon-frames";
import { fetchMissionWindows, MissionDataError, type MissionWindows } from "./fetch-mission-windows";
import type { MissionConfig } from "./mission-presets";
import { simulateMission, type MissionResult } from "./mission-sim";

export interface MissionRun {
  point: LatLon & { label: string };
  config: MissionConfig;
  windows: MissionWindows;
  result: MissionResult;
}

export type MissionRunState =
  | { status: "idle" }
  | { status: "running"; done: number; total: number }
  | { status: "done"; run: MissionRun }
  | { status: "error"; message: string };

export function useMissionRun() {
  const [state, setState] = useState<MissionRunState>({ status: "idle" });
  const controller = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setState({ status: "idle" });
  }, []);

  const start = useCallback(async (point: LatLon & { label: string }, config: MissionConfig) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setState({ status: "running", done: 0, total: 1 });
    try {
      const windows = await fetchMissionWindows(point, config.startMs, config.durationDays, config.minEarthElevationDeg, current.signal, (done, total) => {
        if (!current.signal.aborted) setState({ status: "running", done, total });
      });
      if (current.signal.aborted) return;
      setState({ status: "done", run: { point, config, windows, result: simulateMission(config, windows) } });
    } catch (error) {
      if (current.signal.aborted) return;
      setState({ status: "error", message: error instanceof MissionDataError ? error.message : "The simulation could not finish. Try again." });
    } finally {
      if (controller.current === current) controller.current = null;
    }
  }, []);

  useEffect(() => () => controller.current?.abort(), []);

  return { state, start, cancel, reset: cancel };
}
