"use client";
// 用户设置：外观（深色 / 浅色 / 跟随系统）和界面语言。存在 localStorage（只在这台电脑的这个浏览器里），下次打开还在。
// 用一个很小的订阅式仓库，任何组件用 useSettings() 读，都会在设置改变时一起刷新。
import { useEffect, useState, useSyncExternalStore } from "react";

export type ThemeChoice = "system" | "dark" | "light";
export type Locale = "en" | "zh-Hans" | "fr" | "ja";

export const LOCALES: { id: Locale; name: string; english: string }[] = [
  { id: "en", name: "English", english: "English" },
  { id: "zh-Hans", name: "简体中文", english: "Simplified Chinese" },
  { id: "fr", name: "Français", english: "French" },
  { id: "ja", name: "日本語", english: "Japanese" },
];

export interface Settings {
  theme: ThemeChoice;
  locale: Locale;
}

const STORAGE_KEY = "lunar-quest:settings";
const DEFAULTS: Settings = { theme: "dark", locale: "en" };

let current: Settings = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function load(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<Settings> | null;
    return {
      theme: saved?.theme === "light" || saved?.theme === "system" || saved?.theme === "dark" ? saved.theme : DEFAULTS.theme,
      locale: LOCALES.some((l) => l.id === saved?.locale) ? (saved!.locale as Locale) : DEFAULTS.locale,
    };
  } catch {
    return DEFAULTS;
  }
}

function subscribe(listener: () => void) {
  if (!loaded) {
    loaded = true;
    current = load();
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 服务端渲染和第一次渲染都用默认值，挂载后再换成保存的设置（避免两边内容不一致）。 */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => current, () => DEFAULTS);
}

export function updateSettings(change: Partial<Settings>) {
  current = { ...current, ...change };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* 存不了（隐私模式等）：这次打开仍然生效，只是下次不记得 */
  }
  listeners.forEach((listener) => listener());
}

/** 实际用的外观：选了"跟随系统"就看操作系统是深色还是浅色，系统切换时跟着变。 */
export function useResolvedTheme(): "dark" | "light" {
  const { theme } = useSettings();
  const [systemLight, setSystemLight] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const update = () => setSystemLight(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  if (theme === "system") return systemLight ? "light" : "dark";
  return theme;
}
