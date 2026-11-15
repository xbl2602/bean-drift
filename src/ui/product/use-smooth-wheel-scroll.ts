"use client";
// 产品页里所有可以上下滚动的面板（比较窗口、侧边栏、结果面板、对话框……）：鼠标滚轮一格不再"跳"一大段，
// 而是每一帧（requestAnimationFrame）往目标位置走一小步，看起来是连续滑过去的。
// 不接管的情况（交给浏览器原生处理）：
// - 触控板这类小幅度滚动（本身就是连续的）、横向滚动、按住 Ctrl（缩放）；
// - 带吸附的滚动区（时间 / 月份 / 设备小滚轮，它们要一格一格停）；
// - 鼠标下面没有能往这个方向继续滚的面板（比如月球地图：滚轮是缩放）；
// - 系统设置了"减少动态效果"。
import { useEffect } from "react";

/** 每帧走剩余距离的这个比例：越大越快停下。0.22 ≈ 一格滚轮大约 12 帧（0.2 秒）滑完。 */
const EASE_PER_FRAME = 0.22;
/** 一次滚动小于这个像素数，当作触控板的连续滚动，不接管。普通鼠标一格通常是 100 或 120 像素。 */
const MIN_WHEEL_STEP_PX = 40;
const LINE_HEIGHT_PX = 40;

interface ScrollAnimation {
  targetTop: number;
  lastSetTop: number;
  frame: number;
}

function canScroll(el: HTMLElement, deltaY: number): boolean {
  const style = getComputedStyle(el);
  if (!/(auto|scroll|overlay)/.test(style.overflowY)) return false;
  if (el.scrollHeight - el.clientHeight < 1) return false;
  if (style.scrollSnapType && style.scrollSnapType !== "none") return false; // 吸附滚动区：不接管
  return deltaY > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0;
}

/** 从鼠标下面的元素往上找第一个能往这个方向滚的面板。碰到吸附滚动区或自己处理滚轮的控件（listbox）就停：交给它们。 */
function scrollableAncestor(start: EventTarget | null, deltaY: number): HTMLElement | null {
  for (let el = start instanceof HTMLElement ? start : null; el && el !== document.body; el = el.parentElement) {
    if (el.getAttribute("role") === "listbox") return null;
    const snap = getComputedStyle(el).scrollSnapType;
    if (snap && snap !== "none" && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) return null;
    if (canScroll(el, deltaY)) return el;
  }
  return null;
}

export function useSmoothWheelScroll(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations = new Map<HTMLElement, ScrollAnimation>();

    const step = (el: HTMLElement) => {
      const anim = animations.get(el);
      if (!anim) return;
      // 用户中途拖了滚动条或按了键盘：位置不是我们上一帧设的，就停止动画，听用户的
      if (Math.abs(el.scrollTop - anim.lastSetTop) > 2) {
        animations.delete(el);
        return;
      }
      const before = el.scrollTop;
      const remaining = anim.targetTop - before;
      if (Math.abs(remaining) <= 1) {
        el.scrollTop = anim.targetTop;
        animations.delete(el);
        return;
      }
      // 至少走 1 像素：浏览器可能把 scrollTop 取整，太小的步子会原地不动
      el.scrollTop = before + Math.sign(remaining) * Math.max(1, Math.abs(remaining) * EASE_PER_FRAME);
      if (el.scrollTop === before) {
        animations.delete(el); // 到边了或者走不动：结束
        return;
      }
      anim.lastSetTop = el.scrollTop;
      anim.frame = requestAnimationFrame(() => step(el));
    };

    const onWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey || reducedMotion.matches) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (event.target instanceof Element && event.target.closest('[role="listbox"]')) return; // 时间 / 设备小滚轮自己处理
      const deltaPx = event.deltaMode === 1 ? event.deltaY * LINE_HEIGHT_PX : event.deltaMode === 2 ? event.deltaY * window.innerHeight : event.deltaY;
      const running = [...animations.keys()].find((el) => el.contains(event.target as Node));
      if (!running && Math.abs(deltaPx) < MIN_WHEEL_STEP_PX) return; // 触控板：原生滚动本来就连续
      const el = running && canScroll(running, deltaPx) ? running : scrollableAncestor(event.target, deltaPx);
      if (!el) return;
      event.preventDefault();
      const maxTop = el.scrollHeight - el.clientHeight;
      const anim = animations.get(el);
      if (anim) {
        anim.targetTop = Math.max(0, Math.min(maxTop, anim.targetTop + deltaPx));
        return;
      }
      const next: ScrollAnimation = { targetTop: Math.max(0, Math.min(maxTop, el.scrollTop + deltaPx)), lastSetTop: el.scrollTop, frame: 0 };
      animations.set(el, next);
      next.frame = requestAnimationFrame(() => step(el));
    };

    // capture + passive:false：在面板自己的处理之前接住，并且可以 preventDefault 掉浏览器的"跳一格"
    document.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => {
      document.removeEventListener("wheel", onWheel, { capture: true });
      for (const anim of animations.values()) cancelAnimationFrame(anim.frame);
      animations.clear();
    };
  }, [enabled]);
}
