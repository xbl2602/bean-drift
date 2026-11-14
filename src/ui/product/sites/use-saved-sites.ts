"use client";
// 候选着陆点清单：存在浏览器本地（localStorage），刷新页面还在；不上传到任何服务器。
import { useCallback, useEffect, useState } from "react";
import { normalizeLonDeg, type LatLon } from "../moon-frames";
import type { SavedSite } from "../overlay/annotations";

const STORAGE_KEY = "lunar-quest:sites";
export const MAX_SITES = 10;

function readStoredSites(): SavedSite[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    // 本地存储可能被别的版本或手动改过：只留字段齐全、数值合法的条目
    return parsed
      .filter((s): s is SavedSite => typeof s?.id === "string" && typeof s?.name === "string" && Number.isFinite(s?.latDeg) && Number.isFinite(s?.lonDeg) && Math.abs(s.latDeg) <= 90)
      .slice(0, MAX_SITES);
  } catch {
    return []; // 隐私模式或数据损坏：当作没有保存过
  }
}

/** 默认名字 "Site N"，取一个还没用过的 N。 */
export function nextSiteName(sites: SavedSite[]): string {
  const taken = new Set(sites.map((s) => s.name));
  let n = sites.length + 1;
  while (taken.has(`Site ${n}`)) n++;
  return `Site ${n}`;
}

export function useSavedSites() {
  const [sites, setSites] = useState<SavedSite[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSites(readStoredSites());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sites));
    } catch {
      // 存不进去（隐私模式、空间满）：本次会话里清单仍然可用，只是刷新后不保留
    }
  }, [sites, loaded]);

  /** 返回新建的候选点；已经到上限时返回 null，没有添加。 */
  const addSite = useCallback(
    (point: LatLon, name?: string): SavedSite | null => {
      if (sites.length >= MAX_SITES) return null;
      const site: SavedSite = { id: crypto.randomUUID(), name: name || nextSiteName(sites), latDeg: point.latDeg, lonDeg: normalizeLonDeg(point.lonDeg), createdAt: new Date().toISOString() };
      setSites([...sites, site]);
      return site;
    },
    [sites],
  );
  const removeSite = useCallback((id: string) => setSites((current) => current.filter((s) => s.id !== id)), []);
  const renameSite = useCallback((id: string, name: string) => setSites((current) => current.map((s) => (s.id === id ? { ...s, name: name.slice(0, 40) } : s))), []);

  return { sites, addSite, removeSite, renameSite };
}
