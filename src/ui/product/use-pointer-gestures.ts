"use client";
// 统一处理鼠标/触摸手势：拖动、滚轮或双指缩放、单击选点、双击（或双击触摸）、悬停；拖动和缩放不会触发点击。
// 坐标一律是相对容器左上角的 CSS 像素。
import { isDoubleMapTap, type MapTap } from "./map-tap";
import { useEffect, useRef, type RefObject } from "react";

export interface PointerGestureHandlers {
  onPan?: (dxPx: number, dyPx: number) => void;
  /** factor > 1 放大。 */
  onZoom?: (factor: number, xPx: number, yPx: number) => void;
  onDoubleTap?: (xPx: number, yPx: number) => void;
  onTap?: (xPx: number, yPx: number) => void;
  onHover?: (xPx: number | null, yPx: number | null) => void;
  /**
   * 默认 true：按下后"抓住"指针，拖出容器也继续收到事件。
   * 和 three.js 的 OrbitControls 一起用时要设 false，否则会把指针从画布上抢走，控制器就不动了。
   */
  capturePointer?: boolean;
}

const TAP_MAX_TRAVEL_PX = 6;

export function usePointerGestures(ref: RefObject<HTMLElement | null>, handlers: PointerGestureHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let lastTap: MapTap | null = null;
    let travelPx = 0;
    let pinchDistance = 0;

    const local = (e: PointerEvent | WheelEvent) => {
      const rect = el.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const pinchState = () => {
      const [a, b] = [...pointers.values()];
      return { distance: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    };

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (handlersRef.current.capturePointer !== false) el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, local(e));
      if (pointers.size === 1) travelPx = 0;
      if (pointers.size === 2) { pinchDistance = pinchState().distance; travelPx = Infinity; lastTap = null; }
    };
    const move = (e: PointerEvent) => {
      const p = local(e);
      const prev = pointers.get(e.pointerId);
      if (!prev) {
        handlersRef.current.onHover?.(p.x, p.y);
        return;
      }
      pointers.set(e.pointerId, p);
      if (pointers.size === 2) {
        const { distance, mid } = pinchState();
        if (pinchDistance > 0) handlersRef.current.onZoom?.(distance / pinchDistance, mid.x, mid.y);
        pinchDistance = distance;
        travelPx = Infinity;
        return;
      }
      travelPx += Math.hypot(p.x - prev.x, p.y - prev.y);
      if (travelPx > TAP_MAX_TRAVEL_PX) lastTap = null;
      handlersRef.current.onPan?.(p.x - prev.x, p.y - prev.y);
      handlersRef.current.onHover?.(p.x, p.y);
    };
    const up = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      const wasSingle = pointers.size === 1;
      pointers.delete(e.pointerId);
      if (wasSingle && e.type === "pointerup" && travelPx <= TAP_MAX_TRAVEL_PX) {
        const p = local(e);
        const tap: MapTap = { ...p, timeMs: performance.now(), pointerType: e.pointerType };
        if (handlersRef.current.onDoubleTap && isDoubleMapTap(lastTap, tap)) {
          lastTap = null;
          handlersRef.current.onDoubleTap(p.x, p.y);
        } else {
          lastTap = tap;
          handlersRef.current.onTap?.(p.x, p.y);
        }
      } else { lastTap = null; }
    };
    const leave = () => {
      if (pointers.size === 0) handlersRef.current.onHover?.(null, null);
    };
    const wheel = (e: WheelEvent) => {
      lastTap = null;
      if (!handlersRef.current.onZoom) return;
      e.preventDefault();
      const p = local(e);
      handlersRef.current.onZoom?.(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("wheel", wheel);
    };
  }, [ref]);
}
