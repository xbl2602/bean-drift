// 产品页的三个大模式：历史着陆点（讲解 + 数据）、自由探索（地图和全部工具，默认）、任务模拟器（id 仍叫 find-data：选点、定任务、看结果）。
// 这里的英文是后备；界面显示的文字走翻译（i18n/messages-*.ts 的 mode.*）。
export type AppMode = "landing-sites" | "explore" | "find-data";

export const DEFAULT_APP_MODE: AppMode = "explore";

export const APP_MODES: { id: AppMode; label: string; hint: string }[] = [
  { id: "landing-sites", label: "Landing Sites", hint: "Where missions have landed, explained with data" },
  { id: "explore", label: "Explore", hint: "Explore the Moon freely with all the tools" },
  { id: "find-data", label: "Mission Simulator", hint: "Pick a landing spot, plan a mission and see how it would go" },
];

// 刷新页面时停在用户当前的模式：记在 sessionStorage（只在这个浏览器标签页里有效）。
// 新打开网站（新标签页、关掉再开）就没有记录，从默认的 Explore 开始。
const MODE_STORAGE_KEY = "lunar-quest:mode";

export function rememberAppMode(mode: AppMode) {
  try { sessionStorage.setItem(MODE_STORAGE_KEY, mode); } catch { /* 存不了就算了：刷新后回到 Explore */ }
}

export function rememberedAppMode(): AppMode | null {
  try {
    const saved = sessionStorage.getItem(MODE_STORAGE_KEY);
    return APP_MODES.find((mode) => mode.id === saved)?.id ?? null;
  } catch {
    return null;
  }
}
