"use client";
// 首页挂这一个组件：首页加载完、浏览器空闲之后，悄悄把产品页要用的贴图按顺序下好，
// 用户点"进入产品页"时基本已经在内存里了。不渲染任何东西。
// 三批，前一批下完才开始下一批（不互相抢带宽）：
//   1. 进 2D 地图必须的（底图 4K + 法线 2K，约 2 MB）——只有这批会决定遮罩什么时候撤掉；
//   2. 切分析图层 / 3D 时马上要用的粗版本和天空小图（约 3 MB）；
//   3. 细版本（4K 法线，3 MB）——只在网络好的时候下。
// 省流量模式和很慢的网络（2G 及以下）一概不预下：这些人可能根本不会点进去，不该替他们花流量。
// 还要等首页第一屏真正画完（hero 的地形和贴图，见 landing-readiness.ts）才开始：
// 2026-11-15 之前它在 window.load 后立刻开闸，约 8 MB 的预下载曾把 hero 必需的地形文件挤到二十多秒才到达。
import { useEffect } from "react";
import { landingFirstScreenReady } from "@/ui/landing/landing-readiness";
import { ENTRY_TEXTURE_URLS, FINE_TEXTURE_URLS, WARM_TEXTURE_URLS } from "../moon-texture-urls";
import { fetchTextureBlob } from "./texture-blob-cache";

interface ConnectionInfo {
  saveData?: boolean;
  effectiveType?: string;
}

function connectionInfo(): ConnectionInfo | undefined {
  return (navigator as Navigator & { connection?: ConnectionInfo }).connection;
}

function worthPreloading(): boolean {
  const connection = connectionInfo();
  if (connection?.saveData) return false;
  // 只挡"2G 及以下"。不能连"3G"一起挡：浏览器的 3G 档只看往返延迟（270 ms 以上），首页正在加载、网络繁忙时很容易误判。
  // 实测：一条真实的约 10 Mbps 线路，在首页加载期间被报告成 3G、往返延迟 650 ms，结果预载被挡掉、完全没生效。
  return !["slow-2g", "2g"].includes(connection?.effectiveType ?? "4g");
}

/** 细版本只在"看起来网络很好"时才预下；浏览器没有这个信息（Safari、Firefox）就不下，用到时再按需下。 */
function networkLooksFast(): boolean {
  return connectionInfo()?.effectiveType === "4g";
}

/** 失败不用管：产品页自己要用时会重新下，并给出提示 */
async function preloadAll(urls: readonly string[], isCancelled: () => boolean) {
  if (isCancelled()) return;
  await Promise.allSettled(urls.map((url) => fetchTextureBlob(url, true)));
}

export function ProductPreload() {
  useEffect(() => {
    if (!worthPreloading()) return;
    let cancelled = false;
    const isCancelled = () => cancelled;
    const start = async () => {
      await preloadAll(ENTRY_TEXTURE_URLS, isCancelled);
      await preloadAll(WARM_TEXTURE_URLS, isCancelled);
      if (networkLooksFast()) await preloadAll(FINE_TEXTURE_URLS, isCancelled);
    };
    const whenIdle = () => {
      // Safari 没有 requestIdleCallback，退回到"加载完 1.5 秒后"
      if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(() => void start(), { timeout: 4000 });
      else window.setTimeout(() => void start(), 1500);
    };
    // 首屏的贴图没下完之前不开闸（慢网上曾把 hero 的地形挤到 20+ 秒才到达）；
    // 就绪信号正常一定会来（hero 失败也算就绪），再加一个兜底超时防止信号意外丢失时预载永不开始。
    const fallbackTimer = window.setTimeout(whenIdle, 10000);
    void landingFirstScreenReady.then(() => {
      window.clearTimeout(fallbackTimer);
      if (document.readyState === "complete") whenIdle();
      else window.addEventListener("load", whenIdle, { once: true });
    });
    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
      window.removeEventListener("load", whenIdle);
    };
  }, []);
  return null;
}
