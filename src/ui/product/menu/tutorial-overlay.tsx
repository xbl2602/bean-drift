"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { setEmphasis } from "../motion/element-emphasis";
import { useSmoothNumbers } from "../motion/use-smooth-numbers";
import { ToolIcon } from "./tool-menu";
import { TOUR_SEEN_KEY, TOUR_STEPS } from "./tour-steps";

/**
 * 只在第一次打开网站时自动弹出导览，并且等地图加载好（ready）再弹，不盖在加载画面上。
 * 一弹出就记下"看过了"：中途刷新、点了别的工具把导览关掉，下次都不会再自动弹；想再看可以点顶栏的 ?。
 */
export function useFirstVisitTutorial(open: () => void, ready: boolean) {
  const checked = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    if (!ready || checked.current) return;
    checked.current = true;
    try {
      if (localStorage.getItem(TOUR_SEEN_KEY)) return;
      localStorage.setItem(TOUR_SEEN_KEY, "1");
    } catch { /* Storage is optional: without it the tour shows on each visit. */ }
    openRef.current();
  }, [ready]);
}
interface Box { left: number; top: number; width: number; height: number }
/** 高亮框、卡片移动和按钮放大都是 C2 平滑的（motion/smooth-value.ts），连续点"下一步"也不会突然加速。 */
const MOVE_MS = 560;
const EMPHASIS_SCALE = 1.12;
/** 元素不放大时的位置，再按 scale 绕中心放大（放大动画进行中量出来的大小会不准）。 */
function rectAtScale(element: HTMLElement, scale: number): DOMRect {
  const inline = element.style.transform;
  element.style.transform = "none";
  const r = element.getBoundingClientRect();
  element.style.transform = inline;
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  return new DOMRect(cx - (r.width * scale) / 2, cy - (r.height * scale) / 2, r.width * scale, r.height * scale);
}
export function TutorialOverlay({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [position, setPosition] = useState({ left: 16, top: 160, maxHeight: 600 });
  const [measured, setMeasured] = useState(false);
  // 没有要高亮的东西时（最后一步），高亮框缩成屏幕中心的一个点，整个画面变暗
  const viewport = typeof window === "undefined" ? { w: 0, h: 0 } : { w: window.innerWidth, h: window.innerHeight };
  const ring = useSmoothNumbers(box ? { ...box, glow: 1 } : { left: viewport.w / 2, top: viewport.h / 2, width: 0, height: 0, glow: 0 }, MOVE_MS);
  const card = useSmoothNumbers({ left: position.left, top: position.top }, MOVE_MS, !measured);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const current = TOUR_STEPS[step];
  const last = step === TOUR_STEPS.length - 1;
  const finish = () => {
    try { localStorage.setItem(TOUR_SEEN_KEY, "1"); } catch { /* Still close when storage is unavailable. */ }
    closeRef.current();
  };
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    nextRef.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); finish(); }
      if (event.key === "ArrowRight" && !last) { event.preventDefault(); setStep((n) => n + 1); }
      if (event.key === "ArrowLeft" && step > 0) { event.preventDefault(); setStep((n) => n - 1); }
      if (event.key === "Tab") {
        const buttons = [...(cardRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
        const first = buttons[0], end = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); end?.focus(); }
        else if (!event.shiftKey && document.activeElement === end) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, last]);
  useLayoutEffect(() => {
    const selector = current.target === "analysis" ? '[data-tour="science"], [data-tour="evaluate"]' : current.target ? `[data-tour="${current.target}"]` : null;
    const targets = selector ? [...document.querySelectorAll<HTMLElement>(selector)] : [];
    const scale = current.target === "timeline" ? 1 : EMPHASIS_SCALE;
    targets.forEach((target) => {
      target.scrollIntoView({ block: "nearest", inline: "nearest" });
      setEmphasis(target, scale);
    });
    const update = () => {
      const bounds = targets.map((target) => rectAtScale(target, scale));
      const leftEdge = Math.min(...bounds.map((b) => b.left)), topEdge = Math.min(...bounds.map((b) => b.top));
      const ring = bounds.length ? { left: leftEdge - 7, top: topEdge - 7, width: Math.max(...bounds.map((b) => b.right)) - leftEdge + 14, height: Math.max(...bounds.map((b) => b.bottom)) - topEdge + 14 } : null;
      setBox(ring);
      const width = cardRef.current?.offsetWidth ?? Math.min(360, window.innerWidth - 32);
      const height = cardRef.current?.offsetHeight ?? 370;
      const viewportW = window.innerWidth, viewportH = window.innerHeight;
      let left = (viewportW - width) / 2, top = (viewportH - height) / 2;
      let maxHeight = viewportH - 32;
      if (ring) {
        if (viewportW >= 640 && ring.left + ring.width + width + 40 < viewportW) {
          left = ring.left + ring.width + 22; top = ring.top - 30;
        } else if (ring.top + ring.height + height + 32 < viewportH) {
          left = ring.left + ring.width - width; top = ring.top + ring.height + 18;
        } else if (ring.top - height - 18 >= 16) {
          left = ring.left + ring.width - width; top = ring.top - height - 18;
        } else {
          const roomBelow = viewportH - ring.top - ring.height - 34;
          if (roomBelow >= 240) { top = ring.top + ring.height + 18; maxHeight = roomBelow; }
          else { top = viewportH - height - 18; }
        }
      }
      setMeasured(true);
      setPosition({ left: Math.max(16, Math.min(left, viewportW - width - 16)), top: Math.max(16, Math.min(top, viewportH - Math.min(height, maxHeight) - 16)), maxHeight });
    };
    update();
    const observer = new ResizeObserver(update);
    targets.forEach((target) => observer.observe(target));
    if (cardRef.current) observer.observe(cardRef.current);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      targets.forEach((target) => setEmphasis(target, 1));
      observer.disconnect(); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true);
    };
  }, [current]);

  return (
    <div className="fixed inset-0 z-50" role="presentation" onClick={finish}>
      <div className="absolute inset-0 bg-black/20" />
      <div aria-hidden="true" className="pointer-events-none fixed rounded-2xl border-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.67)]" style={{ left: ring.left, top: ring.top, width: ring.width, height: ring.height, borderColor: `rgba(217,249,157,${ring.glow})`, boxShadow: `0 0 0 9999px rgba(0,0,0,0.67), 0 0 30px rgba(190,242,100,${0.3 * ring.glow})` }} />
      <div ref={cardRef} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="tutorial-title" aria-describedby="tutorial-description" className="fixed max-h-[calc(100dvh-2rem)] w-[min(23rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl border border-lime-200/25 lunar-glass bg-[#0b121d] p-5 text-white shadow-2xl shadow-black/70 sm:p-6" style={{ left: card.left, top: card.top, maxHeight: position.maxHeight }}>
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime-200">Your lunar guide · {step + 1}/{TOUR_STEPS.length}</p>
          {!last && <button type="button" onClick={finish} className="rounded-lg px-2 py-1 text-xs text-white/60 hover:bg-white/10 hover:text-white">Skip tour</button>}
        </div>
        <div className="mt-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-300/30 bg-lime-300/10 text-lime-200"><ToolIcon path={current.icon} className="h-9 w-9" /></div>
        <div aria-live="polite">
          <h2 id="tutorial-title" className="mt-4 text-xl font-semibold tracking-tight">{current.title}</h2>
          <p id="tutorial-description" className="mt-3 text-sm leading-relaxed text-slate-200">{current.body}</p>
        </div>
        <div aria-hidden="true" className="mt-5 flex gap-1">{TOUR_STEPS.map((s, i) => <span key={s.title} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-lime-300" : "bg-white/10"}`} />)}</div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button type="button" onClick={() => setStep((n) => n - 1)} disabled={step === 0} className="rounded-xl px-3 py-2.5 text-sm text-white/70 hover:bg-white/10 disabled:invisible">Back</button>
          <button ref={nextRef} type="button" onClick={() => last ? finish() : setStep((n) => n + 1)} className="rounded-xl bg-lime-300 px-5 py-2.5 text-sm font-semibold text-black hover:bg-lime-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-200">{last ? "Enjoy Lunar Quest" : "Next →"}</button>
        </div>
      </div>
    </div>
  );
}
