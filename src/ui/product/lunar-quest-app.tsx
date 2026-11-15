"use client";
import "./frosted-glass.css";
// Lunar Quest 产品页的总装：全屏地图（默认 2D，可切 3D）、左上角工具菜单、底部时间轴、点击任意点进入第一人称。
// 这里只管"状态和谁连谁"；地图、第一人称、各个面板都在各自的文件里。
import { useCallback, useEffect, useMemo, useState } from "react";
import { useHoverAnalysis, usePointAnalysis, useSiteAnalyses } from "./analysis/use-point-analysis";
import { FirstPersonView } from "./first-person/first-person-view";
import { Globe3dView } from "./globe-3d/globe-3d-view";
import { Map2dView } from "./map-2d/map-2d-view";
import { DEFAULT_LAYERS, type LayerSettings } from "./map-layers";
import type { FocusRequest } from "./map-view-props";
import { ToolMenu } from "./menu/tool-menu";
import { toolInfo, type ToolId } from "./menu/tools";
import { useFirstVisitTutorial } from "./menu/tutorial-overlay";
import { formatLatLon, normalizeLonDeg, type LatLon } from "./moon-frames";
import type { MapAnnotations, SavedSite } from "./overlay/annotations";
import type { SearchTarget } from "./panels/search-panel";
import { ToolPanel } from "./panels/tool-panel";
import type { DraftSite } from "./panels/sites-panel";
import { MAX_SITES, nextSiteName, useSavedSites } from "./sites/use-saved-sites";
import { TimelineBar } from "./timeline/timeline-bar";
import { ViewControls, type MapMode } from "./view-controls";

/** 搜索结果的纬度超过这个值就切到 3D 显示。 */
const POLAR_SEARCH_LAT_DEG = 75;
/** "选点"光标：一个小图钉，尖端（16, 30）就是点击的位置。浏览器不支持时退回十字。 */
const PIN_CURSOR = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M16 30 8 17.500a9.500 9.500 0 1 1 16 0Z" fill="#bef264" stroke="#0d1400" stroke-width="2"/><circle cx="16" cy="12" r="3.500" fill="#0d1400"/></svg>')}") 16 30, crosshair`;
const CLICK_HINT = { "drop-site": "Click to place a site marker", measure: "Click to add a measuring point", stand: "Click to stand here" } as const;

export function LunarQuestApp() {
  const [compareHeight, setCompareHeight] = useState(34);
  const [viewRevision, setViewRevision] = useState(0);
  const [mapMode, setMapMode] = useState<MapMode>("2d");
  const [standingAt, setStandingAt] = useState<LatLon | null>(null);
  const [layers, setLayers] = useState<LayerSettings>(DEFAULT_LAYERS);
  const [timeMs, setTimeMs] = useState(() => Date.now());
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [hover, setHover] = useState<LatLon | null>(null);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [measurePoints, setMeasurePoints] = useState<LatLon[]>([]);
  const [searchTarget, setSearchTarget] = useState<SearchTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draftSite, setDraftSite] = useState<DraftSite | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const { sites, addSite, removeSite, renameSite } = useSavedSites();

  const activeInfo = activeTool ? toolInfo(activeTool) : null;
  const clickMode = activeInfo?.clickMode ?? "stand";
  const layerPanelOpen = Boolean(activeInfo?.layer);
  const analyses = useSiteAnalyses(sites, timeMs, layers.weights);
  const draftAnalysis = usePointAnalysis(draftSite, timeMs, layers.weights);
  const hoverAnalysis = useHoverAnalysis(layerPanelOpen && !standingAt ? hover : null, timeMs, layers.weights);

  useFirstVisitTutorial(() => setActiveTool("tutorial"));
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const requestFocus = useCallback((point: LatLon, spanDeg: number) => setFocus((previous) => ({ seq: (previous?.seq ?? 0) + 1, point, spanDeg })), []);

  const focusComparisonSite = useCallback((site: SavedSite) => {
    setSelectedSiteId(site.id);
    setMapMode("3d");
    requestFocus(site, 110);
  }, [requestFocus]);
  const comparing = activeTool === "compare" && !standingAt;

  const resetExplorer = () => {
    setStandingAt(null); setMapMode("2d"); setLayers(DEFAULT_LAYERS); setTimeMs(Date.now());
    setActiveTool(null); setHover(null); setFocus(null); setMeasurePoints([]); setSearchTarget(null);
    setDraftSite(null); setSelectedSiteId(null); setError(null); setNotice(null); setLoading(true);
    setViewRevision((current) => current + 1);
  };

  const selectTool = (tool: ToolId) => {
    setActiveTool(tool);
    if (tool === "compare") setMapMode("3d");
    const layer = toolInfo(tool).layer;
    if (layer) setLayers((current) => ({ ...current, base: layer }));
    else if (activeInfo?.layer) setLayers((current) => ({ ...current, base: "color" }));
    // 除了教程，其它工具都是在地图上用的：从第一人称回到地图
    if (standingAt) leaveFirstPerson();
  };
  const closeTool = () => {
    // 关掉图层工具的面板 = 不再看这个图层，回到月面影像
    if (activeInfo?.layer) setLayers((current) => ({ ...current, base: "color" }));
    setActiveTool(null);
  };

  const enterFirstPerson = (point: LatLon) => {
    setHover(null);
    setError(null);
    setStandingAt({ latDeg: point.latDeg, lonDeg: normalizeLonDeg(point.lonDeg) });
  };
  const leaveFirstPerson = () => {
    if (standingAt) requestFocus(standingAt, 60); // 回到地图时停在刚才站的地方
    setError(null);
    setStandingAt(null);
  };
  const saveSite = (point: LatLon, name?: string) => {
    setNotice(addSite(point, name) ? `Saved ${name ?? "site"} at ${formatLatLon(point)}` : `The site list is full (${MAX_SITES}). Remove one first.`);
  };
  const handlePick = (point: LatLon) => {
    if (activeTool === "compare") {
      const picked = sites.find(site => Math.abs(site.latDeg - point.latDeg) < 6 && Math.abs(normalizeLonDeg(site.lonDeg - point.lonDeg)) < 6);
      if (picked) focusComparisonSite(picked);
      return;
    }
    if (clickMode === "drop-site") {
      // 先放一个未保存的标记，在面板里起名后再保存
      setDraftSite({ latDeg: point.latDeg, lonDeg: normalizeLonDeg(point.lonDeg), name: nextSiteName(sites) });
      setSelectedSiteId(null);
    }
    else if (clickMode === "measure") setMeasurePoints((points) => [...points, { latDeg: point.latDeg, lonDeg: normalizeLonDeg(point.lonDeg) }]);
    else enterFirstPerson(point);
  };
  const saveDraft = () => {
    if (!draftSite) return;
    const site = addSite(draftSite, draftSite.name.trim());
    if (!site) return setNotice(`The site list is full (${MAX_SITES}). Delete one first.`);
    setDraftSite(null);
    setSelectedSiteId(site.id);
    setNotice(`Saved ${site.name} at ${formatLatLon(site)}`);
  };
  const selectSite = (site: SavedSite) => {
    setDraftSite(null);
    setSelectedSiteId(site.id);
    requestFocus(site, 25);
  };
  const goTo = (target: SearchTarget) => {
    setSearchTarget(target);
    // 平面展开图在两极附近被横向拉得很宽，看不出形状，标记也会贴到屏幕边上：极区的搜索结果改在 3D 球上显示
    if (mapMode === "2d" && Math.abs(target.latDeg) > POLAR_SEARCH_LAT_DEG) {
      setMapMode("3d");
      setNotice("Near the poles the flat map is stretched, so this location is shown on the 3D globe.");
    }
    requestFocus(target, target.spanDeg);
  };
  const changeMode = (mode: MapMode) => {
    setFocus(null); // 换视图时不重放上一次的定位
    setMapMode(mode);
  };

  const annotations = useMemo<MapAnnotations>(
    () => ({ sites, measurePoints, searchPin: searchTarget, draftSite: draftSite ? { latDeg: draftSite.latDeg, lonDeg: draftSite.lonDeg, label: draftSite.name || "New marker" } : null, selectedSiteId }),
    [sites, measurePoints, searchTarget, draftSite, selectedSiteId],
  );
  const viewProps = { timeMs, layers, annotations, focus, cursor: clickMode === "drop-site" ? PIN_CURSOR : undefined, onPick: handlePick, onHover: setHover, onLoadingChange: setLoading, onError: setError };

  return (
    <main className="lunar-explorer fixed inset-0 overflow-hidden bg-black text-white" style={{ "--compare-height": `${compareHeight}dvh`, "--rail-space": comparing ? `calc(100dvh - ${compareHeight}dvh)` : "100dvh" } as React.CSSProperties}>
      <div className={`absolute inset-x-0 top-0 ${comparing ? "bottom-[var(--compare-height)]" : "bottom-0"}`}>
      {standingAt ? (
        <FirstPersonView key={`${standingAt.latDeg},${standingAt.lonDeg}`} point={standingAt} timeMs={timeMs} onExit={leaveFirstPerson} onLoadingChange={setLoading} onError={setError} />
      ) : mapMode === "2d" ? (
        <Map2dView key={`map-${viewRevision}`} {...viewProps} />
      ) : (
        <Globe3dView key={`map-${viewRevision}`} {...viewProps} />
      )}

      </div>
      <ToolMenu activeTool={activeTool} onSelect={selectTool} onHome={resetExplorer} onGroupOpen={closeTool} />
      {!standingAt && <ViewControls mode={mapMode} onModeChange={changeMode} layers={layers} onLayersChange={setLayers} />}

      {activeTool && (activeTool === "tutorial" || !standingAt) && (
        <ToolPanel
          tool={activeTool}
          layers={layers}
          onLayersChange={setLayers}
          timeMs={timeMs}
          hoverAnalysis={hoverAnalysis}
          sites={sites}
          analyses={analyses}
          measurePoints={measurePoints}
          onMeasureChange={setMeasurePoints}
          searchTarget={searchTarget}
          onGoTo={goTo}
          onShowSite={selectSite}
          compareHeight={compareHeight}
          onCompareHeightChange={setCompareHeight}
          onFocusComparisonSite={focusComparisonSite}
          draftSite={draftSite}
          draftAnalysis={draftAnalysis}
          onDraftName={(name) => setDraftSite((current) => (current ? { ...current, name } : current))}
          onSaveDraft={saveDraft}
          onDiscardDraft={() => setDraftSite(null)}
          selectedSiteId={selectedSiteId}
          onStandHere={enterFirstPerson}
          onSaveSite={saveSite}
          onRenameSite={renameSite}
          onRemoveSite={removeSite}
          onSelectTool={selectTool}
          onClose={closeTool}
        />
      )}

      {!standingAt && !comparing && (
        <div className="pointer-events-none absolute bottom-24 left-4 z-10 rounded-full border border-white/10 bg-black/55 px-4 py-2 font-mono text-xs text-white/80 lunar-glass backdrop-blur-md sm:left-6">
          {hover ? (
            <>
              {formatLatLon(hover)} <span className="ml-2 font-sans text-lime-300/90">{CLICK_HINT[clickMode]}</span>
            </>
          ) : (
            <span className="font-sans">{clickMode === "stand" ? (mapMode === "3d" ? "Drag to orbit · slide time to move the Sun and shadows · click to stand" : "Click anywhere on the Moon to stand there") : CLICK_HINT[clickMode]}</span>
          )}
        </div>
      )}
      <div className={`pointer-events-none absolute inset-x-0 top-0 ${comparing ? "bottom-[var(--compare-height)]" : "bottom-0"}`}><div className="pointer-events-auto contents">
      <TimelineBar key={`timeline-${viewRevision}`} timeMs={timeMs} onTimeChange={setTimeMs} />
      </div></div>
      <p className={`pointer-events-none absolute ${comparing ? "hidden" : "xl:block"} bottom-0.5 right-3 z-10 hidden text-[10px] text-white/35 hidden`}>
        NASA SVS CGI Moon Kit · NASA Moon Trek / LROC Team / ASU · LRO LOLA · IAU/USGS names · Earth: NASA Blue Marble · Sun: NASA/SDO AIA (false colour)
      </p>

      {notice && (
        <p role="status" className="absolute left-1/2 top-20 z-40 -translate-x-1/2 rounded-full border border-white/15 bg-black/75 px-4 py-2 text-xs text-white lunar-glass backdrop-blur-md">
          {notice}
        </p>
      )}
      {loading && !error && <LoadingVeil firstPerson={standingAt !== null} />}
      {error && (
        <div role="alert" className="absolute left-1/2 top-1/2 z-40 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-red-300/30 bg-[#1a0b0e]/95 p-5 text-sm">
          <p className="font-medium text-red-200">Something went wrong</p>
          <p className="mt-2 text-white/75">{error}</p>
          {standingAt && (
            <button type="button" onClick={leaveFirstPerson} className="mt-4 rounded-full bg-white/10 px-4 py-2 hover:bg-white/20">
              ← Back to map
            </button>
          )}
        </div>
      )}
    </main>
  );
}

function LoadingVeil({ firstPerson }: { firstPerson: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-black/70">
      <div className="flex flex-col items-center gap-4">
        <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-lime-300" />
        <p className="text-sm tracking-wide text-white/70">{firstPerson ? "Landing… building the terrain around you" : "Loading 4K lunar maps…"}</p>
      </div>
    </div>
  );
}
