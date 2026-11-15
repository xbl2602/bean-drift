"use client";
// 第一次"加载完"（或出错）之后，告诉首页的过场动画"地图好了，可以揭幕"。
// 等两帧再发：地图的第一次绘制（贴图上传显卡、编译着色器）发生在加载完成后的第一帧里，
// 不等的话动画一揭开，用户会先看到一帧黑屏再看到月球。信号约定见 src/lib/handoff/map-ready-signal.ts。
import { useEffect, useRef } from "react";
import { announceMapReady } from "@/lib/handoff/map-ready-signal";

export function useAnnounceMapReady(loading: boolean, error: string | null): void {
  const announced = useRef(false);
  useEffect(() => {
    if (announced.current || (loading && !error)) return;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        announced.current = true;
        announceMapReady();
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [loading, error]);
}
