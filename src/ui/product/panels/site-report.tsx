"use client";
// 一个点的只读数据报告：经纬度、第一人称照片、各项数值长条、考虑地形遮挡的太阳/地球可见性（/api/point）。
// "历史着陆点"和"查数据"两个模式都用它；可选的 onDownload 给"查数据"模式导出用。
import type { PointAnalysis } from "../analysis/point-analysis";
import type { LatLon } from "../moon-frames";
import { TerrainVisibilityPanel } from "../point-api/terrain-visibility-panel";
import type { PointApiState } from "../point-api/use-point-api";
import { PanelButton } from "./panel-shell";
import { CoordinateBox, SiteMetricBars } from "./site-metric-bars";
import { SitePhoto } from "./site-photo";

interface SiteReportProps {
  point: LatLon;
  name: string;
  timeMs: number;
  analysis: PointAnalysis | "error" | null;
  pointApi: PointApiState;
  onStandHere: () => void;
  /** 额外按钮（比如下载数据）。 */
  extraActions?: React.ReactNode;
}

export function SiteReport({ point, name, timeMs, analysis, pointApi, onStandHere, extraActions }: SiteReportProps) {
  return (
    <div>
      <CoordinateBox point={point} />
      <SitePhoto point={point} name={name} timeMs={timeMs} onStandHere={onStandHere} />
      <SiteMetricBars analysis={analysis} />
      <TerrainVisibilityPanel state={pointApi} />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <PanelButton primary onClick={onStandHere}>Stand here</PanelButton>
        {extraActions}
      </div>
    </div>
  );
}
