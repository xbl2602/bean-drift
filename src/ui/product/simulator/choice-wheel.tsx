"use client";
// 横向的小滚轮：一行里显示"上一个 | 当前 | 下一个"三个值，当前值在中间高亮。
// 可以左右滑动（触控板 / 手机）、用鼠标滚轮上下滚（每格换一个值）、点旁边的值、或用方向键。
// 用在模拟器的"设备与要求"里，每个选项一行，字号和表单其他文字一致。
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

const ITEM_WIDTH_PX = 64;
/** 鼠标滚轮：累计这么多像素算一格（触控板一次只给几个像素，不会一下跳很多格）。 */
const WHEEL_STEP_PX = 50;

interface ChoiceWheelProps {
  label: string;
  value: string | number;
  values: string[];
  onChange: (value: string) => void;
  format: (item: string) => string;
}

export function ChoiceWheel({ label, value, values, onChange, format }: ChoiceWheelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ values, onChange });
  latest.current = { values, onChange };
  const selected = Math.max(0, values.indexOf(String(value)));
  const [active, setActive] = useState(selected);
  const activeRef = useRef(active);
  activeRef.current = active;
  const id = useId();

  useLayoutEffect(() => {
    if (ref.current) {
      ref.current.scrollLeft = selected * ITEM_WIDTH_PX;
      setActive(selected);
    }
  }, [selected]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const choose = (index: number) => {
    const next = Math.max(0, Math.min(latest.current.values.length - 1, index));
    if (timer.current) clearTimeout(timer.current);
    setActive(next);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollTo({ left: next * ITEM_WIDTH_PX, behavior: reduced ? "auto" : "smooth" });
    latest.current.onChange(latest.current.values[next]);
  };
  const chooseRef = useRef(choose);
  chooseRef.current = choose;

  // 鼠标滚轮上下滚 = 换值。React 的 onWheel 不能 preventDefault，所以用原生监听（passive: false），不让外面的面板跟着滚。
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let pending = 0;
    const wheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return; // 横向滑动交给原生滚动
      event.preventDefault();
      const deltaPx = event.deltaMode === 1 ? event.deltaY * 40 : event.deltaY;
      pending += deltaPx;
      if (Math.abs(deltaPx) >= WHEEL_STEP_PX) pending = Math.sign(deltaPx) * WHEEL_STEP_PX; // 一格鼠标滚轮 = 一步
      if (Math.abs(pending) < WHEEL_STEP_PX) return;
      const step = Math.sign(pending);
      pending = 0;
      chooseRef.current(activeRef.current + step);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  return (
    <div className="relative shrink-0" style={{ width: ITEM_WIDTH_PX * 3 }}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 rounded-md border border-white/15 bg-white/[0.09]" style={{ left: ITEM_WIDTH_PX, width: ITEM_WIDTH_PX }} />
      <div
        ref={ref}
        role="listbox"
        aria-label={label}
        aria-orientation="horizontal"
        aria-activedescendant={`${id}-${active}`}
        tabIndex={0}
        style={{ paddingInline: ITEM_WIDTH_PX }}
        className="choice-wheel-scroll relative flex h-8 snap-x snap-mandatory overflow-x-auto overscroll-contain rounded-md outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
        onScroll={(event) => {
          const index = Math.max(0, Math.min(latest.current.values.length - 1, Math.round(event.currentTarget.scrollLeft / ITEM_WIDTH_PX)));
          setActive(index);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => latest.current.onChange(latest.current.values[index]), 140);
        }}
        onKeyDown={(event) => {
          const next = event.key === "ArrowRight" || event.key === "ArrowDown" ? active + 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? active - 1 : event.key === "Home" ? 0 : event.key === "End" ? values.length - 1 : null;
          if (next !== null) {
            event.preventDefault();
            choose(next);
          }
        }}
      >
        {values.map((item, index) => (
          <div
            key={item}
            id={`${id}-${index}`}
            role="option"
            aria-selected={active === index}
            onClick={() => choose(index)}
            style={{ width: ITEM_WIDTH_PX }}
            className={`flex shrink-0 cursor-pointer snap-center items-center justify-center whitespace-nowrap text-xs tabular-nums transition-colors motion-reduce:transition-none ${active === index ? "font-medium text-white" : "text-white/60 hover:text-white/85"}`}
          >
            {format(item)}
          </div>
        ))}
      </div>
    </div>
  );
}
