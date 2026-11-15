"use client";
// 根据当前选中的工具显示对应的面板。新加工具时在这里接上。
import type { PointAnalysis } from "../analysis/point-analysis";
import type { SiteAnalyses } from "../analysis/use-point-analysis";
import type { LayerSettings } from "../map-layers";
import { useT } from "../i18n/use-t";
import { TutorialOverlay } from "../menu/tutorial-overlay";
import { toolInfo, type ToolId } from "../menu/tools";
import type { LatLon } from "../moon-frames";
import type { SavedSite } from "../overlay/annotations";
import { SettingsPanel } from "../settings/settings-panel";
import { AiPanel } from "./ai-panel";
import { ComparePanel } from "./compare-panel";
import { ExportPanel } from "./export-panel";
import { LayerPanel } from "./layer-panel";
import { MeasurePanel } from "./measure-panel";
import type { RightPanelSize } from "./panel-shell";
import { SearchPanel, type SearchTarget } from "./search-panel";
import { SitesPanel, type DraftSite } from "./sites-panel";

export interface ToolPanelProps {
  tool: ToolId;
  layers: LayerSettings;
  onLayersChange: (layers: LayerSettings) => void;
  timeMs: number;
  hoverAnalysis: PointAnalysis | null;
  sites: SavedSite[];
  draftSite: DraftSite | null;
  draftAnalysis: PointAnalysis | "error" | null;
  onDraftName: (name: string) => void;
  onSaveDraft: () => void;
  selectedSiteId: string | null;
  analyses: SiteAnalyses;
  measurePoints: LatLon[];
  onMeasureChange: (points: LatLon[]) => void;
  searchTarget: SearchTarget | null;
  onGoTo: (target: SearchTarget) => void;
  compareHeight: number;
  onCompareHeightChange: (height: number) => void;
  onFocusComparisonSite: (site: SavedSite) => void;
  onStandHere: (point: LatLon) => void;
  onSaveSite: (point: LatLon, name?: string) => void;
  onRenameSite: (id: string, name: string) => void;
  onRemoveSite: (id: string) => void;
  onSelectTool: (tool: ToolId) => void;
  onClose: () => void;
}

/** 这个工具的面板开在右边吗、多宽（3D 球据此让开）。要和下面 ToolPanel 各分支用的 side="right" 对应。 */
export function rightPanelFor(tool: ToolId): RightPanelSize | null {
  if (tool === "ai") return "wide";
  if (tool === "settings") return "standard";
  if (tool === "site" || tool === "measure" || tool === "export") return "standard";
  const layer = toolInfo(tool).layer;
  return layer && layer !== "color" ? "standard" : null;
}

export function ToolPanel(props: ToolPanelProps) {
  const { tool, onClose, onSelectTool } = props;
  const info = toolInfo(tool);
  const t = useT();

  if (tool === "tutorial") return <TutorialOverlay onClose={onClose} />;
  if (tool === "ai") return <AiPanel onClose={onClose} />;
  if (tool === "settings") return <SettingsPanel onClose={onClose} />;
  if (tool === "search") return <SearchPanel selected={props.searchTarget} onGoTo={props.onGoTo} onStandHere={props.onStandHere} onSaveSite={props.onSaveSite} onClose={onClose} />;
  if (tool === "site") {
    return (
      <SitesPanel
        draft={props.draftSite}
        draftAnalysis={props.draftAnalysis}
        onDraftName={props.onDraftName}
        onSaveDraft={props.onSaveDraft}
        selectedId={props.selectedSiteId}
        sites={props.sites}
        analyses={props.analyses}
        onRename={props.onRenameSite}
        onRemove={props.onRemoveSite}
        onStandHere={props.onStandHere}
        onCompare={() => onSelectTool("compare")}
        timeMs={props.timeMs}
        onClose={onClose}
      />
    );
  }
  if (tool === "measure") {
    return <MeasurePanel points={props.measurePoints} onUndo={() => props.onMeasureChange(props.measurePoints.slice(0, -1))} onClear={() => props.onMeasureChange([])} onClose={onClose} />;
  }
  if (tool === "compare") {
    return <ComparePanel height={props.compareHeight} onHeightChange={props.onCompareHeightChange} onFocusSite={props.onFocusComparisonSite} sites={props.sites} analyses={props.analyses} timeMs={props.timeMs} onAddSites={() => onSelectTool("site")} onRemoveSite={props.onRemoveSite} onExport={() => onSelectTool("export")} onClose={onClose} />;
  }
  if (tool === "export") {
    const input = { sites: props.sites, analyses: props.analyses, timeMs: props.timeMs, weights: props.layers.weights, measurePoints: props.measurePoints };
    return <ExportPanel input={input} onAddSites={() => onSelectTool("site")} onClose={onClose} />;
  }
  if (info.layer && info.layer !== "color") {
    return (
      <LayerPanel
        title={t(`tool.${tool}.label`)}
        layer={info.layer}
        weights={props.layers.weights}
        onWeightsChange={(weights) => props.onLayersChange({ ...props.layers, weights })}
        hover={props.hoverAnalysis}
        onClose={onClose}
      />
    );
  }
  return null;
}
