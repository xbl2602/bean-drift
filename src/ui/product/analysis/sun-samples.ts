// 太阳方向（月固系）的小工具：当前时刻的方向，以及"从当前时刻起一个朔望月"里均匀取的 24 个方向。
// 星历只用 src/core 那一份（经 moon-frames.sunDirectionBody）。
import { sunDirectionBody } from "../moon-frames";
import { ANALYSIS_MODEL, type Vec3 } from "./analysis-model";

export function sunBodyAt(timeMs: number): Vec3 {
  const v = sunDirectionBody(timeMs);
  return [v.x, v.y, v.z];
}

const QUANTUM_MS = 30 * 60_000;
let cached: { key: number; samples: Vec3[] } | null = null;

/** 结果按 30 分钟取整缓存：拖时间轴时不必每帧重算 24 次星历。 */
export function monthSunSamples(timeMs: number): readonly Vec3[] {
  const key = Math.round(timeMs / QUANTUM_MS);
  if (cached?.key === key) return cached.samples;
  const start = key * QUANTUM_MS;
  const step = ANALYSIS_MODEL.synodicMonthMs / ANALYSIS_MODEL.monthSamples;
  const samples = Array.from({ length: ANALYSIS_MODEL.monthSamples }, (_, i) => sunBodyAt(start + i * step));
  cached = { key, samples };
  return samples;
}
