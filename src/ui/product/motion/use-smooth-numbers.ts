"use client";
// React 用法：给一组数字（比如一个框的 left/top/width/height），返回每一帧平滑追随它们的值（C2，见 smooth-value.ts）。
import { useEffect, useRef, useState } from "react";
import { SmoothValue, prefersReducedMotion } from "./smooth-value";

/** instant = true 时直接跳到目标（比如还没量好位置的第一帧），不做动画。 */
export function useSmoothNumbers<T extends Record<string, number>>(target: T, durationMs: number, instant = false): T {
  const valuesRef = useRef<Record<string, SmoothValue> | null>(null);
  const [current, setCurrent] = useState<T>(target);
  const key = Object.entries(target).map(([name, value]) => `${name}:${value}`).join("|");

  useEffect(() => {
    const now = performance.now();
    if (!valuesRef.current) valuesRef.current = {};
    const values = valuesRef.current;
    const jump = instant || prefersReducedMotion();
    for (const [name, value] of Object.entries(target)) {
      if (!values[name]) values[name] = new SmoothValue(value);
      if (jump) values[name].jump(value);
      else values[name].retarget(value, now, durationMs);
    }
    const sample = (nowMs: number) => Object.fromEntries(Object.entries(values).map(([name, smooth]) => [name, smooth.at(nowMs).value])) as T;
    if (jump) { setCurrent(sample(now)); return; }
    let frame = requestAnimationFrame(function step(nowMs) {
      setCurrent(sample(nowMs));
      if (Object.values(values).some((smooth) => !smooth.settled(nowMs))) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key 已经包含 target 里的全部数值
  }, [key, durationMs, instant]);

  return current;
}
