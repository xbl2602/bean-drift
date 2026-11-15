"use client";
// 产品页出任何意外错误时的兜底页（没有它，用户只会看到 Next 自带的一句 "This page couldn't load"）。
// 最常见的原因是浏览器没有开 3D 图形加速（WebGL）：关了硬件加速、虚拟机、远程桌面都会这样，所以这里先检测一下，给出对应的说明。
import Link from "next/link";
import { useEffect, useState } from "react";

function webglIsAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function ProductError({ error, retry }: { error: unknown; retry: () => void }) {
  // 服务端渲染时没有 document，挂载后再检测；null = 还没检测
  const [webgl, setWebgl] = useState<boolean | null>(null);
  useEffect(() => {
    console.error(error);
    setWebgl(webglIsAvailable());
  }, [error]);

  return (
    <main className="fixed inset-0 grid place-items-center bg-black px-6 text-white">
      <div role="alert" className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0b1018]/90 p-6 text-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-lime-300">Lunar Quest</p>
        <h1 className="mt-3 text-lg font-semibold">{webgl === false ? "Your browser has 3D graphics turned off" : "The map could not start"}</h1>
        {webgl === false ? (
          <p className="mt-3 leading-relaxed text-white/70">
            The Moon is drawn with WebGL, and it is not available here. In Chrome or Edge, turn on “Use graphics acceleration when available” in Settings → System, then restart the browser. Remote desktops and some virtual machines do not support it; try a normal desktop browser instead.
          </p>
        ) : (
          <p className="mt-3 leading-relaxed text-white/70">Something went wrong while starting the map. Trying again usually fixes it. If it keeps happening, reload the page or use a recent desktop version of Chrome, Edge or Firefox.</p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => retry()} className="rounded-full bg-lime-300 px-4 py-2 font-medium text-black hover:bg-lime-200">
            Try again
          </button>
          <Link href="/" className="rounded-full border border-white/20 px-4 py-2 text-white/85 hover:bg-white/10">
            Back to home page
          </Link>
        </div>
      </div>
    </main>
  );
}
