"use client";
// 换地图时不闪黑、不硬切。
// 做法：在旧画面消失之前把它"拍一张照片"（复制成普通画布），盖在新地图上面；新地图准备好、画出第一帧后，照片慢慢变透明，
// 看起来就是旧画面溶解成新画面。用在：
// - 换视图：2D ↔ 3D、进出第一人称、回到初始视图（旧地图组件卸载时拍照，新地图在照片下面加载）；
// - 换图层：底图 / 数据图层、日照开关、经纬网开关（地图组件自己在画新图层之前，先按旧图层重画一帧拍下来）。
// 第一次打开页面没有旧画面可拍，地图本身从黑色淡入（见 lunar-quest-app.tsx）。
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { LayerSettings } from "./map-layers";
import { prefersReducedMotion } from "./motion/smooth-value";

/** 照片变透明用的时间。 */
const FADE_MS = 450;

/** 一个能把当前画面拍下来的函数；地图还没加载好（没有画面）时为 null。 */
export type CaptureFrame = () => HTMLCanvasElement | null;

/** 这几项变了画面会整体换样子，值得做溶解；滑动权重等细调不做（拖滑块时会一直重来）。 */
export function layerLookKey(layers: LayerSettings): string {
  return `${layers.base}|${layers.sunlight}|${layers.grid}`;
}

/**
 * 把 WebGL 画布的一帧复制成普通 2D 画布。WebGL 画布显示到屏幕后内容会被清掉，
 * 所以先调用 draw 重画一次，再在同一段代码里马上复制（这时候画好的内容还在）。
 */
export function snapshotCanvas(source: HTMLCanvasElement, draw: () => void): HTMLCanvasElement | null {
  if (source.width < 1 || source.height < 1) return null;
  try {
    draw();
    const copy = document.createElement("canvas");
    copy.width = source.width;
    copy.height = source.height;
    const context = copy.getContext("2d");
    if (!context) return null;
    context.drawImage(source, 0, 0);
    return copy;
  } catch {
    return null; // 拍不了（比如显卡上下文丢了）：就不做溶解，直接换
  }
}

/**
 * 地图组件卸载时，在它从屏幕上消失之前拍下最后一帧交出去。
 * 用 useLayoutEffect 的清理函数：它在浏览器画下一帧之前执行，所以旧画面和照片之间不会闪一帧黑。
 */
export function useSnapshotOnUnmount(captureRef: RefObject<CaptureFrame | null>, onSnapshot: ((frame: HTMLCanvasElement) => void) | undefined): void {
  const latest = useRef(onSnapshot);
  latest.current = onSnapshot;
  useLayoutEffect(() => {
    const ref = captureRef;
    return () => {
      const frame = ref.current?.();
      if (frame) latest.current?.(frame);
    };
  }, [captureRef]);
}

interface SnapshotFadeProps {
  /** 要盖在地图上的照片；null = 没有。 */
  snapshot: HTMLCanvasElement | null;
  /** 新地图还在加载：照片保持不透明，先不溶解。 */
  hold: boolean;
  /** 溶解完了：总装组件把照片丢掉。 */
  onDone: () => void;
}

/** 盖在地图上的那张照片：新地图画好后两帧开始变透明，变完通知外面清掉。 */
export function SnapshotFade({ snapshot, hold, onDone }: SnapshotFadeProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const shownRef = useRef<HTMLCanvasElement | null>(null);
  const [fading, setFading] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !snapshot) {
      shownRef.current = null;
      return;
    }
    // 上一次溶解还没做完又换了：把上一张照片按它此刻的透明度叠到新照片上，画面才不会跳一下
    const previous = shownRef.current;
    if (previous && previous !== snapshot) {
      const alpha = Number.parseFloat(getComputedStyle(host).opacity);
      const context = snapshot.getContext("2d");
      if (context && alpha > 0.01) {
        context.globalAlpha = alpha;
        context.drawImage(previous, 0, 0, snapshot.width, snapshot.height);
        context.globalAlpha = 1;
      }
    }
    snapshot.className = "block h-full w-full";
    host.replaceChildren(snapshot);
    shownRef.current = snapshot;
    setFading(false);
  }, [snapshot]);

  useEffect(() => {
    if (!snapshot || hold) return;
    if (prefersReducedMotion()) {
      doneRef.current();
      return;
    }
    // 等两帧：新地图的第一次绘制（上传贴图、编译着色器）在这两帧里完成，照片才开始变透明
    let second = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        setFading(true);
        timer = setTimeout(() => doneRef.current(), FADE_MS + 50);
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      if (timer) clearTimeout(timer);
    };
  }, [snapshot, hold]);

  if (!snapshot) return null;
  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{ opacity: fading ? 0 : 1, transition: fading ? `opacity ${FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)` : "none" }}
    />
  );
}
