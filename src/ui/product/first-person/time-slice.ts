// 把一件要连续算很久的事切成小段：每算够一小段时间，就让出主线程直到下一帧，让页面有机会画这一帧、处理点击。
// 用在"后台悄悄画着陆点照片"这类事上：整个场景一口气建完要占主线程约 0.6 秒，期间镜头动画和拖动都会卡住；
// 切成 ~6 ms 一段、每帧只干一段，镜头动画的每一帧只多出几毫秒，照片晚一两秒出来，没人会注意。

/** 到点就让出主线程的函数：在长循环里每转一圈调用一次，没到时间它几乎不花时间。 */
export type Slice = () => Promise<void>;

/** 什么都不让：实时第一人称场景自己有加载遮罩，不需要切；也是没传 slice 时的默认值。 */
export const noSlice: Slice = () => Promise.resolve();

/**
 * 让出主线程，等到下一帧开始再继续。
 * 不能用 scheduler.yield 或消息通道：它们的"继续"排在画面更新之前，连着转十几段之后浏览器才画下一帧，等于没让（实测一帧 100 ms）。
 * 标签页在后台时 requestAnimationFrame 不触发，所以再加一个超时，免得永远等下去。
 */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    let resumed = false;
    const resume = () => {
      if (resumed) return;
      resumed = true;
      resolve();
    };
    requestAnimationFrame(resume);
    setTimeout(resume, 250);
  });
}

/** 每连续占用主线程超过 budgetMs 毫秒，就让出一次。 */
export function createTimeSlicer(budgetMs: number): Slice {
  let sliceStartMs = performance.now();
  return async () => {
    if (performance.now() - sliceStartMs < budgetMs) return;
    await yieldToMain();
    sliceStartMs = performance.now();
  };
}
