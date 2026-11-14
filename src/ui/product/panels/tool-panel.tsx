"use client";
// 根据当前选中的工具显示对应的面板。新加工具时在这里接上。
import type { PointAnalysis } from "../analysis/point-analysis";
import type { SiteAnalyses } from "../analysis/use-point-analysis";
import type { LayerSettings } from "../map-layers";
import { TutorialOverlay } from "../menu/tutorial-overlay";
import { toolInfo, type ToolId } from "../menu/tools";
import type { LatLon } from "../moon-frames";
import type { SavedSite } from "../overlay/annotations";
import { AiPanel } from "./ai-panel";
import { ComparePanel } from "./compare-panel";
import { ExportPanel } from "./export-panel";
import { LayerPanel } from "./layer-panel";
import { MeasurePanel } from "./measure-panel";
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
  onDiscardDraft: () => void;
  selectedSiteId: string | null;
  analyses: SiteAnalyses;
  measurePoints: LatLon[];
  onMeasureChange: (points: LatLon[]) => void;
  searchTarget: SearchTarget | null;
  onGoTo: (target: SearchTarget) => void;
  onShowSite: (site: SavedSite) => void;
  onStandHere: (point: LatLon) => void;
  onSaveSite: (point: LatLon, name?: string) => void;
  onRenameSite: (id: string, name: string) => void;
  onRemoveSite: (id: string) => void;
  onSelectTool: (tool: ToolId) => void;
  onClose: () => void;
}

export function ToolPanel(props: ToolPanelProps) {
  const { tool, onClose, onSelectTool } = props;
  const info = toolInfo(tool);

  if (tool === "tutorial") return <TutorialOverlay onClose={onClose} />;
  if (tool === "ai") return <AiPanel onSelectTool={onSelectTool} onClose={onClose} />;
  if (tool === "search") return <SearchPanel selected={props.searchTarget} onGoTo={props.onGoTo} onStandHere={props.onStandHere} onSaveSite={props.onSaveSite} onClose={onClose} />;
  if (tool === "site") {
    return (
      <SitesPanel
        draft={props.draftSite}
        draftAnalysis={props.draftAnalysis}
        onDraftName={props.onDraftName}
        onSaveDraft={props.onSaveDraft}
        onDiscardDraft={props.onDiscardDraft}
        selectedId={props.selectedSiteId}
        onSelect={props.onShowSite}
        sites={props.sites}
        analyses={props.analyses}
        onRename={props.onRenameSite}
        onRemove={props.onRemoveSite}
        onStandHere={props.onStandHere}
        onCompare={() => onSelectTool("compare")}
        onClose={onClose}
      />
    );
  }
  if (tool === "measure") {
    return <MeasurePanel points={props.measurePoints} onUndo={() => props.onMeasureChange(props.measurePoints.slice(0, -1))} onClear={() => props.onMeasureChange([])} onClose={onClose} />;
  }
  if (tool === "compare") {
    return <ComparePanel sites={props.sites} analyses={props.analyses} timeMs={props.timeMs} onAddSites={() => onSelectTool("site")} onExport={() => onSelectTool("export")} onClose={onClose} />;
  }
  if (tool === "export") {
    const input = { sites: props.sites, analyses: props.analyses, timeMs: props.timeMs, weights: props.layers.weights, measurePoints: props.measurePoints };
    return <ExportPanel input={input} onAddSites={() => onSelectTool("site")} onClose={onClose} />;
  }
  if (info.layer && info.layer !== "color") {
    return (
      <LayerPanel
        title={info.label}
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
