// 教程里把当前讲到的按钮轻轻放大，离开时再缩回去；放大和缩回都是 C2 平滑的（见 smooth-value.ts）。
// 同一个按钮还没缩回去又被讲到（点了"上一步"），就从当前的速度接着放大，不会跳。
import { SmoothValue, prefersReducedMotion } from "./smooth-value";

interface Emphasis { scale: SmoothValue; frame: number; transform: string; transition: string }
const active = new WeakMap<HTMLElement, Emphasis>();
const DURATION_MS = 420;

export function setEmphasis(element: HTMLElement, scale: number) {
  const now = performance.now();
  let entry = active.get(element);
  if (!entry) {
    if (scale === 1) return;
    entry = { scale: new SmoothValue(1), frame: 0, transform: element.style.transform, transition: element.style.transition };
    active.set(element, entry);
    element.style.transition = "none"; // 不让 CSS 过渡在每一帧上再插一次值
  }
  if (prefersReducedMotion()) entry.scale.jump(scale);
  else entry.scale.retarget(scale, now, DURATION_MS);
  cancelAnimationFrame(entry.frame);
  const run = (nowMs: number) => {
    const current = active.get(element);
    if (!current) return;
    const value = current.scale.at(nowMs).value;
    element.style.transform = value === 1 ? current.transform : `scale(${value})`;
    if (!current.scale.settled(nowMs)) current.frame = requestAnimationFrame(run);
    else if (current.scale.target === 1) {
      element.style.transform = current.transform;
      element.style.transition = current.transition;
      active.delete(element);
    }
  };
  run(now);
}
