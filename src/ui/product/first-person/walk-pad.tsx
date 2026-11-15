"use client";
// 第一人称里的走动操作：键盘按住就走，屏幕右下角还有一组方向键（鼠标、触屏按住都行）。
//   W / ↑ 前进   S / ↓ 后退   A / D 左右横移   ← / → 转身   PageUp / PageDown 抬头低头   Shift 加速   Esc 回地图
// 这里只负责"现在按着哪些方向"，真正怎么动在 walk-motion.ts 里。
import { useEffect, useRef, type MutableRefObject } from "react";

/** 此刻的操作：每项 -1 / 0 / +1。 */
export interface HeldInput { forward: number; right: number; turn: number; pitch: number; run: boolean }

type Direction = "forward" | "back" | "left" | "right";

const KEY_ACTIONS: Record<string, keyof typeof ACTION_EFFECT> = {
  KeyW: "forward", ArrowUp: "forward",
  KeyS: "back", ArrowDown: "back",
  KeyA: "left", KeyD: "right",
  ArrowLeft: "turnLeft", KeyQ: "turnLeft",
  ArrowRight: "turnRight", KeyE: "turnRight",
  PageUp: "lookUp", PageDown: "lookDown",
};
const ACTION_EFFECT = {
  forward: { forward: 1 }, back: { forward: -1 }, left: { right: -1 }, right: { right: 1 },
  turnLeft: { turn: -1 }, turnRight: { turn: 1 }, lookUp: { pitch: 1 }, lookDown: { pitch: -1 },
} as const;

/** 收集键盘和屏幕方向键的输入。返回一个 ref（每帧读取，不触发重渲染）和屏幕方向键用的按下/松开函数。 */
export function useWalkInput(onEscape: () => void): { input: MutableRefObject<HeldInput>; setPad: (direction: Direction, down: boolean) => void } {
  const input = useRef<HeldInput>({ forward: 0, right: 0, turn: 0, pitch: 0, run: false });
  const held = useRef(new Set<string>());
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  const recompute = () => {
    const next: HeldInput = { forward: 0, right: 0, turn: 0, pitch: 0, run: held.current.has("Shift") };
    for (const action of held.current) {
      const effect = ACTION_EFFECT[action as keyof typeof ACTION_EFFECT];
      if (!effect) continue;
      for (const [axis, value] of Object.entries(effect) as Array<[keyof Omit<HeldInput, "run">, number]>) next[axis] = Math.max(-1, Math.min(1, next[axis] + value));
    }
    input.current = next;
  };

  useEffect(() => {
    const typing = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    };
    const onDown = (event: KeyboardEvent) => {
      if (typing(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Escape") { event.preventDefault(); escapeRef.current(); return; }
      if (event.key === "Shift") { held.current.add("Shift"); recompute(); return; }
      const action = KEY_ACTIONS[event.code];
      if (!action) return;
      event.preventDefault(); // 方向键、PageUp 不要滚动页面
      held.current.add(action);
      recompute();
    };
    const onUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") held.current.delete("Shift");
      const action = KEY_ACTIONS[event.code];
      if (action) held.current.delete(action);
      recompute();
    };
    // 切走窗口时松开所有键，否则回来后会一直往前走
    const release = () => { held.current.clear(); recompute(); };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", release);
    };
  }, []);

  const setPad = (direction: Direction, down: boolean) => {
    if (down) held.current.add(direction);
    else held.current.delete(direction);
    recompute();
  };
  return { input, setPad };
}

const ARROW = "M12 5v14M6 11l6-6 6 6";

/** 屏幕上的方向键：按住就走，松开就停。 */
export function WalkPad({ onPress }: { onPress: (direction: Direction, down: boolean) => void }) {
  const button = (direction: Direction, label: string, rotateDeg: number, area: string) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); onPress(direction, true); }}
      onPointerUp={() => onPress(direction, false)}
      onPointerCancel={() => onPress(direction, false)}
      onLostPointerCapture={() => onPress(direction, false)}
      onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); onPress(direction, true); } }}
      onKeyUp={(event) => { if (event.key === " " || event.key === "Enter") onPress(direction, false); }}
      onContextMenu={(event) => event.preventDefault()}
      className={`${area} grid h-11 w-11 touch-none select-none place-items-center rounded-xl border border-white/15 bg-black/55 text-white/85 lunar-glass backdrop-blur-md transition hover:bg-white/15 active:bg-lime-300 active:text-black`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" style={{ transform: `rotate(${rotateDeg}deg)` }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ARROW} /></svg>
    </button>
  );
  return (
    <div role="group" aria-label="Walk" className="grid grid-cols-3 grid-rows-2 gap-1.5">
      {button("forward", "Walk forward (W or ↑)", 0, "col-start-2 row-start-1")}
      {button("left", "Step left (A)", -90, "col-start-1 row-start-2")}
      {button("back", "Walk back (S or ↓)", 180, "col-start-2 row-start-2")}
      {button("right", "Step right (D)", 90, "col-start-3 row-start-2")}
    </div>
  );
}
