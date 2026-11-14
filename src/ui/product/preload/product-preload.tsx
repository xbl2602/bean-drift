"use client";
// 首页挂这一个组件：首页加载完、浏览器空闲之后，悄悄把产品页进地图要用的贴图下好，
// 用户点"进入产品页"时基本已经在内存里了。不渲染任何东西。
// 省流量模式和慢网络（3G 及以下）不预下：这些人可能根本不会点进去，不该替他们花流量。
import { useEffect } from "react";
import { entryTextureUrls } from "../moon-texture-urls";
import { fetchTextureBlob, probeMaxTextureSize } from "./texture-blob-cache";

interface ConnectionInfo {
  saveData?: boolean;
  effectiveType?: string;
}

function worthPreloading(): boolean {
  const connection = (navigator as Navigator & { connection?: ConnectionInfo }).connection;
  if (connection?.saveData) return false;
  return !["slow-2g", "2g", "3g"].includes(connection?.effectiveType ?? "4g");
}

export function ProductPreload() {
  useEffect(() => {
    if (!worthPreloading()) return;
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      // 失败不用管：产品页自己要用时会重新下，并给出提示
      for (const url of entryTextureUrls(probeMaxTextureSize())) void fetchTextureBlob(url, true).catch(() => undefined);
    };
    const whenIdle = () => {
      // Safari 没有 requestIdleCallback，退回到"加载完 1.5 秒后"
      if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(start, { timeout: 4000 });
      else window.setTimeout(start, 1500);
    };
    if (document.readyState === "complete") whenIdle();
    else window.addEventListener("load", whenIdle, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", whenIdle);
    };
  }, []);
  return null;
}
