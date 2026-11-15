"use client";
// Comparison candidates exist only in React state for this page session. Existing browser storage is left untouched.
import { useCallback, useState } from "react";
import { normalizeLonDeg, type LatLon } from "../moon-frames";
import type { SavedSite } from "../overlay/annotations";

export const MAX_SITES = 10;

/** 默认名字 "Site N"，取一个还没用过的 N。 */
export function nextSiteName(sites: SavedSite[]): string {
  const taken = new Set(sites.map((s) => s.name));
  let n = sites.length + 1;
  while (taken.has(`Site ${n}`)) n++;
  return `Site ${n}`;
}

export function useSavedSites() {
  const [sites, setSites] = useState<SavedSite[]>([]);
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

  const clearSites = useCallback(() => setSites([]), []);

  return { sites, addSite, removeSite, renameSite, clearSites };
}
