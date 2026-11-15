"use client";
// Search Location：浮在地图上方正中的搜索条。输入地名（IAU 官方月面地名）或经纬度，回车或点结果，
// 地图自动转过去并放大，画一个带名字和坐标的标记；找不到时明确提示。
import { useEffect, useMemo, useState } from "react";
import { formatLatLon, type LatLon } from "../moon-frames";
import { loadLunarNames, parseCoordinates, searchLunarNames, viewSpanDegFor, type LunarName } from "../search/lunar-names";

export interface SearchTarget extends LatLon {
  label: string;
  /** 标记上的第二行：坐标。 */
  detail?: string;
  spanDeg: number;
}

interface SearchPanelProps {
  selected: SearchTarget | null;
  onGoTo: (target: SearchTarget) => void;
  onStandHere: (point: LatLon) => void;
  onCompareLocation: (point: LatLon, name: string) => void;
  onClose: () => void;
  /** 外层定位。默认浮在地图上方正中；Find Data 模式放在左边一栏里。 */
  placementClassName?: string;
  /** 不显示"搜到的结果"小卡片（Find Data 模式下面已经有完整报告）。 */
  hideResult?: boolean;
  placeholder?: string;
}

const DEFAULT_PLACEMENT = "absolute left-24 right-4 top-36 z-20 sm:left-1/2 sm:right-auto sm:top-24 sm:w-[min(34rem,calc(100vw-13rem))] sm:-translate-x-1/2";
const SUGGESTION_LIMIT = 8;
const targetForName = (entry: LunarName): SearchTarget => ({ latDeg: entry.latDeg, lonDeg: entry.lonDeg, label: entry.name, detail: formatLatLon(entry), spanDeg: viewSpanDegFor(entry.diameterKm) });
const targetForCoordinates = (point: LatLon): SearchTarget => ({ ...point, label: "Searched point", detail: formatLatLon(point), spanDeg: 25 });

export function SearchPanel({ selected, onGoTo, onStandHere, onCompareLocation, onClose, placementClassName = DEFAULT_PLACEMENT, hideResult, placeholder = "Search a place (Shackleton Crater) or coordinates (-89.9, 0)" }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [names, setNames] = useState<LunarName[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadLunarNames()
      .then((loaded) => !cancelled && setNames(loaded))
      .catch(() => !cancelled && setLoadFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selected) { setShowSuggestions(false); setNotFound(null); }
  }, [selected?.latDeg, selected?.lonDeg, selected?.label]);

  const coordinates = useMemo(() => parseCoordinates(query), [query]);
  const matches = useMemo(() => (names && !coordinates ? searchLunarNames(names, query, SUGGESTION_LIMIT) : []), [names, query, coordinates]);

  const go = (target: SearchTarget) => {
    setNotFound(null);
    setShowSuggestions(false);
    onGoTo(target);
  };

  const submit = async () => {
    const text = query.trim();
    if (!text) return;
    if (coordinates) return go(targetForCoordinates(coordinates));
    setShowSuggestions(false);
    // 名字表还没下载完就按了回车：等它下载完再找，而不是让用户重试
    let list = names;
    if (!list) {
      setSearching(true);
      list = await loadLunarNames().catch(() => null);
      setSearching(false);
    }
    if (!list) return setNotFound("The place-name list could not be loaded, so names cannot be searched right now. Coordinates still work, for example -89.9, 0.");
    const best = searchLunarNames(list, text, 1)[0];
    if (best) return go(targetForName(best));
    // 看起来像坐标但超出范围（纬度 ±90、经度 -180..360）时单独说明
    const looksNumeric = /^[-+\d.,;\s°NSEWnsew]+$/.test(text);
    setNotFound(
      looksNumeric
        ? `“${text}” is not a valid position. Use latitude (-90 to 90) then longitude (-180 to 360), for example -89.9, 0.`
        : `No lunar location found for “${text}”. Check the spelling, try a shorter name such as “Tycho”, or enter coordinates like -89.9, 0.`,
    );
  };

  return (
    <div className={placementClassName}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex items-center gap-2 rounded-2xl border border-white/15 bg-[#0b0f17]/90 py-1.5 pl-4 pr-1.5 shadow-2xl shadow-black/60 lunar-glass backdrop-blur-xl focus-within:border-lime-300/50"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-lime-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.3-4.3" /></svg>
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setNotFound(null);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
          placeholder={placeholder}
          aria-label="Search by lunar place name, or latitude and longitude"
          className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white placeholder:text-white/35 focus:outline-none"
        />
        <button type="submit" disabled={searching} className="shrink-0 rounded-xl bg-lime-300 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-black transition hover:bg-lime-200">
          {searching ? "Searching…" : "Search"}
        </button>
        <button type="button" onClick={onClose} aria-label="Close search" className="shrink-0 rounded-full p-2 text-white/55 hover:bg-white/10 hover:text-white">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </form>

      {notFound && (
        <p role="alert" className="mt-2 rounded-xl border border-red-300/35 bg-[#1a0b0e]/92 px-4 py-2.5 text-sm text-red-100 shadow-xl shadow-black/50 lunar-glass backdrop-blur-xl">
          {notFound}
        </p>
      )}

      {showSuggestions && !notFound && (coordinates || matches.length > 0) && (
        <ul className="mt-2 max-h-[min(22rem,calc(100dvh-16rem))] overflow-y-auto rounded-2xl border border-white/10 bg-[#0b0f17]/92 p-1.5 shadow-2xl shadow-black/60 lunar-glass backdrop-blur-xl [scrollbar-color:rgba(255,255,255,0.25)_transparent] [scrollbar-width:thin]">
          {coordinates && (
            <li>
              <button type="button" onClick={() => go(targetForCoordinates(coordinates))} className="flex w-full items-baseline justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/10">
                <span className="text-sm">Go to this position</span>
                <span className="font-mono text-xs text-lime-200">{formatLatLon(coordinates)}</span>
              </button>
            </li>
          )}
          {matches.map((entry) => (
            <li key={`${entry.name}-${entry.latDeg}-${entry.lonDeg}`}>
              <button type="button" onClick={() => go(targetForName(entry))} className="flex w-full items-baseline justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/10">
                <span className="min-w-0">
                  <span className="block truncate text-sm">{entry.name}</span>
                  <span className="block text-[11px] text-white/45">
                    {entry.featureType}
                    {entry.diameterKm > 0 ? ` · ${entry.diameterKm.toFixed(entry.diameterKm < 10 ? 1 : 0)} km` : ""}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[11px] text-white/55">{formatLatLon(entry)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && !hideResult && !showSuggestions && !notFound && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fuchsia-300/30 bg-[#0b0f17]/92 px-4 py-2.5 shadow-xl shadow-black/50 lunar-glass backdrop-blur-xl">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{selected.label}</span>
            <span className="block font-mono text-xs text-white/60">{formatLatLon(selected)}</span>
          </span>
          <span className="flex gap-2">
            <ResultButton primary onClick={() => onStandHere(selected)}>Stand here</ResultButton>
            <ResultButton onClick={() => onCompareLocation(selected, selected.label)}>Choose sites to compare</ResultButton>
          </span>
        </div>
      )}
    </div>
  );
}

function ResultButton({ children, onClick, primary }: { children: string; onClick: () => void; primary?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${primary ? "bg-lime-300 text-black hover:bg-lime-200" : "border border-white/15 text-white/85 hover:bg-white/10"}`}>
      {children}
    </button>
  );
}
