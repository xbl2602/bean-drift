"use client";
import "./frosted-glass.css";
// Lunar Quest 产品页的总装：顶部三个模式（Landing Sites / Explore（默认）/ Mission Simulator），全屏地图（默认 3D，可切 2D）、
// Explore 模式左边的工具栏、底部时间轴、点击任意点进入第一人称。
// 这里只管"状态和谁连谁"；地图、第一人称、各个面板都在各自的文件里。
import { useCallback, useEffect, useMemo, useState } from "react";
import { useHoverAnalysis, usePointAnalysis, useSiteAnalyses } from "./analysis/use-point-analysis";
import { FirstPersonView } from "./first-person/first-person-view";
import { useT } from "./i18n/use-t";
import { useResolvedTheme, useSettings } from "./settings/settings-store";
import { Globe3dView } from "./globe-3d/globe-3d-view";
import { Map2dView } from "./map-2d/map-2d-view";
import { DEFAULT_LAYERS, type LayerSettings } from "./map-layers";
import type { FocusRequest } from "./map-view-props";
import { ToolMenu } from "./menu/tool-menu";
import { toolInfo, type ToolId } from "./menu/tools";
import { useFirstVisitTutorial } from "./menu/tutorial-overlay";
import { formatLatLon, normalizeLonDeg, type LatLon } from "./moon-frames";
import type { MapAnnotations, SavedSite } from "./overlay/annotations";
import { DEFAULT_COMPARE_HEIGHT_DVH } from "./panels/compare-panel";
import type { SearchTarget } from "./panels/search-panel";
import { ToolPanel, rightPanelFor } from "./panels/tool-panel";
import type { DraftSite } from "./panels/sites-panel";
import { MAX_SITES, nextSiteName, useSavedSites } from "./sites/use-saved-sites";
import { TimelineBar } from "./timeline/timeline-bar";
import { ViewControls, type MapMode } from "./view-controls";
import { useAnnounceMapReady } from "./use-announce-map-ready";
import { useSmoothWheelScroll } from "./use-smooth-wheel-scroll";
import { DEFAULT_APP_MODE, rememberAppMode, rememberedAppMode, type AppMode } from "./modes/app-modes";
import { FindDataMode } from "./modes/find-data-mode";
import { LandingSitesMode, usePresetSites } from "./modes/landing-sites-mode";
import { ModeSwitch } from "./modes/mode-switch";
import { filterLandingSites, LANDING_KIND_COLORS, nearestSite, type LandingFilter, type SiteEntry } from "./modes/preset-sites";

/** 搜索结果的纬度超过这个值就切到 3D 显示。 */
const POLAR_SEARCH_LAT_DEG = 75;
/** "选点"光标：一个小图钉，尖端（16, 30）就是点击的位置。浏览器不支持时退回十字。 */
const PIN_CURSOR = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M16 30 8 17.500a9.500 9.500 0 1 1 16 0Z" fill="#bef264" stroke="#0d1400" stroke-width="2"/><circle cx="16" cy="12" r="3.500" fill="#0d1400"/></svg>')}") 16 30, crosshair`;
/** Landing Sites 模式：点在某个着陆点这么多度以内，就算点中离它最近的那个。 */
const LANDING_PICK_RADIUS_DEG = 8;

export function LunarQuestApp() {
  const t = useT();
  useSmoothWheelScroll(); // 所有面板的鼠标滚轮滚动：每帧连续滑动，不再一格一跳
  const { locale } = useSettings();
  const theme = useResolvedTheme();
  const [compareHeight, setCompareHeight] = useState(DEFAULT_COMPARE_HEIGHT_DVH);
  const [viewRevision, setViewRevision] = useState(0);
  const [appMode, setAppMode] = useState<AppMode>(DEFAULT_APP_MODE);
  const [landingVisited, setLandingVisited] = useState(false);
  // 刷新后回到刷新前的模式（第一次打开网站还是 Explore）。服务端渲染时读不到浏览器存储，所以挂载后再切。
  useEffect(() => {
    const saved = rememberedAppMode();
    if (!saved || saved === DEFAULT_APP_MODE) return;
    setAppMode(saved);
    if (saved === "landing-sites") setLandingVisited(true);
  }, []);
  const [landingSiteId, setLandingSiteId] = useState<string | null>(null);
  // null = 用户还没选类别（载人 / 无人 / 全部），这时地图上显示全部标记。
  const [landingFilter, setLandingFilter] = useState<LandingFilter | null>(null);
  const [findTarget, setFindTarget] = useState<SearchTarget | null>(null);
  const [simResultsOpen, setSimResultsOpen] = useState(false);
  // 默认 3D 地球仪（Explore 模式进来就是 3D；2D 展开图可以在右上角切换）
  const [mapMode, setMapMode] = useState<MapMode>("3d");
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
  const landingState = usePresetSites(landingVisited || appMode === "landing-sites");
  // 地图上只画筛选后的着陆任务；南极地名挤在极点附近，全画出来会叠成一团，所以只在选中它时才画那一个
  const landingSites = useMemo(
    () => filterLandingSites(landingState.status === "ready" ? landingState.sites : [], landingFilter ?? "all").filter((site) => site.kind === "landing-site" || site.id === landingSiteId),
    [landingState, landingFilter, landingSiteId],
  );
  const exploring = appMode === "explore";
  // AI 工具和设置在三个模式里都能开，面板都在右边
  const rightToolOpen = activeTool === "ai" || activeTool === "settings";

  const activeInfo = exploring && activeTool ? toolInfo(activeTool) : null;
  const clickMode = activeInfo?.clickMode ?? "stand";
  const layerPanelOpen = Boolean(activeInfo?.layer);
  const analyses = useSiteAnalyses(sites, timeMs, layers.weights);
  const draftAnalysis = usePointAnalysis(draftSite, timeMs, layers.weights);
  const hoverAnalysis = useHoverAnalysis(layerPanelOpen && !standingAt ? hover : null, timeMs, layers.weights);

  useFirstVisitTutorial(() => setActiveTool("tutorial"));
  useAnnounceMapReady(loading, error); // 首页过场动画等这个信号才揭幕
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const requestFocus = useCallback((point: LatLon, spanDeg: number) => setFocus((previous) => ({ seq: (previous?.seq ?? 0) + 1, point, spanDeg })), []);

  const focusComparisonSite = useCallback((site: SavedSite) => {
    setDraftSite(null);
    setSelectedSiteId(site.id);
    setMapMode("3d");
    requestFocus(site, 110);
  }, [requestFocus]);
  const comparing = exploring && activeTool === "compare" && !standingAt;

  const resetExplorer = () => {
    setStandingAt(null); setMapMode("3d"); setLayers(DEFAULT_LAYERS); setTimeMs(Date.now());
    setActiveTool(null); setHover(null); setFocus(null); setMeasurePoints([]); setSearchTarget(null);
    setDraftSite(null); setSelectedSiteId(null); setError(null); setNotice(null); setLoading(true);
    setViewRevision((current) => current + 1);
  };

  const selectTool = (tool: ToolId) => {
    setActiveTool(tool);
    // Inspection can pass its unsaved point to the comparison picker; other tools dismiss it.
    if (tool !== "site" && tool !== "inspect") setDraftSite(null);
    if (tool === "compare") setMapMode("3d");
    const layer = toolInfo(tool).layer;
    if (layer) setLayers((current) => ({ ...current, base: layer }));
    else if (activeInfo?.layer) setLayers((current) => ({ ...current, base: "color" }));
    // 除了教程，其它工具都是在地图上用的：从第一人称回到地图
    if (standingAt) leaveFirstPerson();
  };
  const selectMenuTool = (tool: ToolId) => {
    // The toolbar always starts with the picker; only its Compare button opens results.
    selectTool(tool === "compare" ? "site" : tool);
  };
  const closeTool = () => {
    // 关掉图层工具的面板 = 不再看这个图层，回到月面影像
    if (activeInfo?.layer) setLayers((current) => ({ ...current, base: "color" }));
    setDraftSite(null);
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
  const chooseSiteForComparison = (point: LatLon, name?: string) => {
    changeAppMode("explore");
    selectTool("site");
    setSearchTarget(null);
    setDraftSite({ latDeg: point.latDeg, lonDeg: normalizeLonDeg(point.lonDeg), name: name || nextSiteName(sites) });
    setSelectedSiteId(null);
  };
  const changeAppMode = (mode: AppMode) => {
    if (mode === appMode) return;
    setAppMode(mode);
    rememberAppMode(mode);
    if (mode === "landing-sites") setLandingVisited(true);
    // 换模式时收起 Explore 的工具和未保存标记（AI Tools 和设置三个模式通用，保持打开），离开第一人称；视图（3D 球 / 2D 平面图）保持用户当前在看的那个，不强制切回 3D
    setActiveTool((current) => (current === "ai" || current === "settings" ? current : null));
    setDraftSite(null);
    setStandingAt(null);
    setError(null);
    setFocus(null);
    setLayers((current) => ({ ...current, base: "color" }));
  };
  /** 导览讲的是 Explore 里的工具：先切到 Explore 再开始。 */
  const openTutorial = () => {
    changeAppMode("explore");
    selectTool("tutorial");
  };
  const toggleAi = () => {
    if (activeTool === "ai") closeTool();
    else selectTool("ai");
  };
  const toggleSettings = () => {
    if (activeTool === "settings") closeTool();
    else selectTool("settings");
  };
  const selectLandingSite = (site: SiteEntry) => {
    if (rightToolOpen) setActiveTool(null); // 讲解面板和 AI / 设置面板都在右边，点了着陆点就看讲解
    setLandingSiteId(site.id);
    // 不强制切 3D：用户在 2D 平面图里点着陆点，就留在 2D，平面图自己会居中到这个点（3D 球则飞过去）
    requestFocus(site, 45);
  };
  const changeLandingFilter = (filter: LandingFilter | null) => {
    setLandingFilter(filter);
    if (filter === null) return; // 回到选类别：地图显示全部，讲解可以留着
    // 选中的着陆点不在新的筛选里，就把右边的讲解收起
    const stillShown = landingState.status === "ready" && filterLandingSites(landingState.sites, filter).some((site) => site.id === landingSiteId);
    if (!stillShown) setLandingSiteId(null);
  };
  const lookUpPoint = (target: SearchTarget) => {
    setFindTarget(target);
    requestFocus(target, mapMode === "3d" ? Math.max(target.spanDeg, 30) : target.spanDeg);
  };
  const handlePick = (point: LatLon) => {
    if (appMode === "landing-sites") {
      const near = nearestSite(landingSites, point, LANDING_PICK_RADIUS_DEG);
      if (near) selectLandingSite(near);
      return;
    }
    if (appMode === "find-data") {
      const picked = { latDeg: point.latDeg, lonDeg: normalizeLonDeg(point.lonDeg) };
      setFindTarget({ ...picked, label: t("sim.picked"), detail: formatLatLon(picked), spanDeg: 25 });
      return;
    }
    if (activeTool === "search") {
      const picked = { latDeg: point.latDeg, lonDeg: normalizeLonDeg(point.lonDeg) };
      setSearchTarget({ ...picked, label: t("sim.picked"), detail: formatLatLon(picked), spanDeg: 25 });
      return;
    }
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
    else {
      setSearchTarget(null);
      setDraftSite({ latDeg: point.latDeg, lonDeg: normalizeLonDeg(point.lonDeg), name: nextSiteName(sites) });
      setSelectedSiteId(null);
      setActiveTool("inspect");
    }
  };
  const saveDraft = () => {
    if (!draftSite) return;
    const site = addSite(draftSite, draftSite.name.trim());
    if (!site) return setNotice(`The site list is full (${MAX_SITES}). Delete one first.`);
    setDraftSite(null);
    setSelectedSiteId(site.id);
    setNotice(`Added ${site.name} to comparison`);
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

  const annotations = useMemo<MapAnnotations>(() => {
    // 每个模式只画自己的标记：着陆点模式画任务着陆点，查数据模式画查询的位置
    if (appMode === "landing-sites") {
      return { sites: landingSites.map((site) => ({ id: site.id, name: site.label, latDeg: site.latDeg, lonDeg: site.lonDeg, createdAt: site.landedUtc ?? "", markerColor: site.crew ? LANDING_KIND_COLORS[site.crew] : undefined })), measurePoints: [], searchPin: null, selectedSiteId: landingSiteId };
    }
    if (appMode === "find-data") return { sites: [], measurePoints: [], searchPin: findTarget };
    return { sites, measurePoints, searchPin: searchTarget, draftSite: draftSite ? { latDeg: draftSite.latDeg, lonDeg: draftSite.lonDeg, label: draftSite.name || "New marker" } : null, selectedSiteId };
  }, [appMode, landingSites, landingSiteId, findTarget, sites, measurePoints, searchTarget, draftSite, selectedSiteId]);
  const cursor = clickMode === "drop-site" || appMode === "find-data" ? PIN_CURSOR : undefined;
  // 右边开着面板时告诉地图，3D 球往左让开：Explore 的工具面板、AI 聊天框、设置、Landing Sites 的着陆点详情、模拟结果
  const toolPanelShown = activeTool !== null && (exploring || rightToolOpen);
  const rightPanel = toolPanelShown
    ? rightPanelFor(activeTool)
    : appMode === "landing-sites" && landingSiteId ? "standard"
    : appMode === "find-data" && simResultsOpen ? "wide" : null;
  const viewProps = { timeMs, layers, annotations, focus, rightPanel, cursor, onPick: handlePick, onDoublePick: exploring && clickMode !== "measure" ? enterFirstPerson : undefined, onHover: setHover, onLoadingChange: setLoading, onError: setError };

  return (
    <main lang={locale} data-theme={theme} className="lunar-explorer fixed inset-0 overflow-hidden bg-black text-white" style={{ "--compare-height": `${compareHeight}dvh`, "--rail-space": comparing ? `calc(100dvh - ${compareHeight}dvh)` : "100dvh" } as React.CSSProperties}>
      <div className={`absolute inset-x-0 top-0 ${comparing ? "bottom-[var(--compare-height)]" : "bottom-0"}`}>
      {standingAt ? (
        <FirstPersonView key={`${standingAt.latDeg},${standingAt.lonDeg}`} point={standingAt} timeMs={timeMs} onExit={leaveFirstPerson} onLoadingChange={setLoading} onError={setError} />
      ) : mapMode === "2d" ? (
        <Map2dView key={`map-${viewRevision}`} {...viewProps} />
      ) : (
        <Globe3dView key={`map-${viewRevision}`} {...viewProps} />
      )}

      </div>
      {exploring && <ToolMenu activeTool={activeTool} onSelect={selectMenuTool} onHome={resetExplorer} />}
      {!standingAt && <ModeSwitch mode={appMode} onChange={changeAppMode} tutorialOpen={activeTool === "tutorial"} aiOpen={activeTool === "ai"} settingsOpen={activeTool === "settings"} onTutorial={openTutorial} onAi={toggleAi} onSettings={toggleSettings} />}
      {!standingAt && <ViewControls mode={mapMode} onModeChange={changeMode} layers={layers} onLayersChange={setLayers} />}

      {appMode === "landing-sites" && !standingAt && (
        <LandingSitesMode state={landingState} selectedId={rightToolOpen ? null : landingSiteId} category={landingFilter} onCategoryChange={changeLandingFilter} onSelect={selectLandingSite} onCloseDetail={() => setLandingSiteId(null)} timeMs={timeMs} weights={layers.weights} onStandHere={enterFirstPerson} />
      )}
      {appMode === "find-data" && !standingAt && (
        <FindDataMode target={findTarget} onGoTo={lookUpPoint} onClear={() => setFindTarget(null)} timeMs={timeMs} onTimeChange={setTimeMs} weights={layers.weights} onStandHere={enterFirstPerson} onCompareLocation={chooseSiteForComparison} resultsHidden={rightToolOpen} onResultsOpenChange={setSimResultsOpen} />
      )}

      {activeTool && (exploring || rightToolOpen) && (activeTool === "tutorial" || !standingAt) && (
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
          compareHeight={compareHeight}
          onCompareHeightChange={setCompareHeight}
          onFocusComparisonSite={focusComparisonSite}
          draftSite={draftSite}
          draftAnalysis={draftAnalysis}
          onDraftName={(name) => setDraftSite((current) => (current ? { ...current, name } : current))}
          onSaveDraft={saveDraft}
          selectedSiteId={selectedSiteId}
          onStandHere={enterFirstPerson}
          onCompareLocation={chooseSiteForComparison}
          onRenameSite={renameSite}
          onRemoveSite={(id) => { removeSite(id); setSelectedSiteId(current => current === id ? null : current); }}
          onFindNewSite={() => { setDraftSite(null); setSelectedSiteId(null); selectTool("site"); }}
          onSelectTool={selectTool}
          onClose={closeTool}
        />
      )}

      {!standingAt && !comparing && (
        <div className="pointer-events-none absolute bottom-24 left-4 z-10 rounded-full border border-white/10 bg-black/55 px-4 py-2 font-mono text-xs text-white/80 lunar-glass backdrop-blur-md sm:left-6">
          {!exploring ? (
            <>
              {hover && <>{formatLatLon(hover)} </>}<span className={`font-sans ${hover ? "ml-2 text-lime-300/90" : ""}`}>{t(appMode === "landing-sites" ? "hint.landing-sites" : "hint.find-data")}</span>
            </>
          ) : hover ? (
            <>
              {formatLatLon(hover)} <span className="ml-2 font-sans text-lime-300/90">{t(`hint.${clickMode}`)}</span>
            </>
          ) : (
            <span className="font-sans">{clickMode === "stand" ? t(mapMode === "3d" ? "hint.explore3d" : "hint.explore2d") : t(`hint.${clickMode}`)}</span>
          )}
        </div>
      )}
      <div className={`pointer-events-none absolute inset-x-0 top-0 ${comparing ? "bottom-[var(--compare-height)]" : "bottom-0"}`}><div className="pointer-events-auto contents">
      <TimelineBar key={`timeline-${viewRevision}-${standingAt ? "first-person" : "map"}`} timeMs={timeMs} onTimeChange={setTimeMs} loop={!!standingAt} />
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
        <p className="text-sm tracking-wide text-white/70">{firstPerson ? "Landing… building the terrain around you" : "Loading lunar maps…"}</p>
      </div>
    </div>
  );
}
