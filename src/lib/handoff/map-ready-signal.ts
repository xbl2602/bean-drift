// 首页过场动画 ↔ 产品页之间的"交接信号"：产品页的第一幅地图画好了。
// 为什么需要：过场动画盖在屏幕最上面，产品页在它后面同时加载；动画要等到产品页真的好了才揭开，
// 否则用户会在动画结束后又看到一次"加载中"遮罩。两边都是浏览器里的界面代码，用 window 事件通信，
// 谁也不 import 谁的内部实现（接口约定见 docs/SHARED_INTERFACES.md 第 7 节）。
// 只能在浏览器里调用（会碰 window）；没有任何模块级状态。

export const MAP_READY_EVENT = "lunar-quest:map-ready";

/** 产品页调用：第一幅地图已经画出来了（出错时也要调用，别让动画一直等）。 */
export function announceMapReady(): void {
  window.dispatchEvent(new Event(MAP_READY_EVENT));
}

/** 过场动画调用：地图就绪时执行一次 callback。返回取消函数（动画被跳过或卸载时用）。 */
export function onceMapReady(callback: () => void): () => void {
  const handler = () => {
    window.removeEventListener(MAP_READY_EVENT, handler);
    callback();
  };
  window.addEventListener(MAP_READY_EVENT, handler);
  return () => window.removeEventListener(MAP_READY_EVENT, handler);
}
