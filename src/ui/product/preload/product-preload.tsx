"use client";
// 首页挂这一个组件：首页加载完、浏览器空闲之后，悄悄把产品页进地图要用的贴图下好，
// 用户点"进入产品页"时基本已经在内存里了。不渲染任何东西。
// 省流量模式和很慢的网络（2G 及以下）不预下：这些人可能根本不会点进去，不该替他们花流量。
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
  // 只挡"2G 及以下"。不能连"3G"一起挡：浏览器的 3G 档只看往返延迟（270 ms 以上），首页正在加载、网络繁忙时很容易误判。
  // 实测：一条真实的约 10 Mbps 线路，在首页加载期间被报告成 3G、往返延迟 650 ms，结果预载被挡掉、完全没生效。
  return !["slow-2g", "2g"].includes(connection?.effectiveType ?? "4g");
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
