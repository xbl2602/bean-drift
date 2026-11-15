// 过场动画和产品页的"交接时间表"（纯函数，不碰 DOM，方便测试）。
//
// 这里没有任何按设备或网速估出来的数字（没有"几秒后打开"、"最多等几秒"）：每个人的机器和网络都不一样，
// 动画只跟着两件真实发生的事走——自己的时间轴（车停稳、车要离场，见 drift-scene.ts），以及产品页发来的"地图就绪"信号。
//   1. 车停稳时打开产品页（它启动时主线程会连续卡死一阵，落在"车停着"的阶段看不出来）；
//   2. 车要离场时，如果产品页还没好，车就停在原地等，页面好了才开走，离场不会被卡顿打断；
//   3. 车开走并且页面已就绪，才揭幕。
// 快的机器上页面早就好了，动画完全不延长；慢的机器和网络上，车停着等多久就等多久。

/**
 * 动画自己的时间。和真实时间同步走，只在 waitAtS（车要离场的那一刻）处可能停住：
 * 页面在真实时间 mapReadyAtS 就绪；还没就绪（null）就一直停在 waitAtS。
 * 就绪早于 waitAtS 时，动画完全不受影响（时间 = 真实时间）。
 */
export function sceneTimeAt(elapsedS: number, mapReadyAtS: number | null, waitAtS: number): number {
  if (mapReadyAtS === null || elapsedS < mapReadyAtS) return Math.min(elapsedS, waitAtS);
  return Math.min(mapReadyAtS, waitAtS) + (elapsedS - mapReadyAtS);
}
