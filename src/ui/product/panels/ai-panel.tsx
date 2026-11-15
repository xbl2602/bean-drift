"use client";
// AI Tools：自然语言助手。对话框本体是 src/features/agent-search/ui/ 的 LunarSearch，
// 它只向我们自己的 /api/agent 发请求，DeepSeek 密钥只在服务端，这里碰不到。这里只负责把它放进面板。
import { LunarSearch, type SelectedLunarLocation } from "@/features/agent-search/ui/lunar-search";
import { formatLatLon } from "../moon-frames";
import { viewSpanDegFor } from "../search/lunar-names";
import { PanelShell } from "./panel-shell";
import type { SearchTarget } from "./search-panel";

export function AiPanel({ onGoTo, onClose }: { onGoTo?: (target: SearchTarget) => void; onClose: () => void }) {
  const handleSelectLocation = onGoTo
    ? (loc: SelectedLunarLocation) => {
        onGoTo({
          latDeg: loc.latDeg,
          lonDeg: loc.lonDeg,
          label: loc.label,
          detail: formatLatLon(loc),
          spanDeg: loc.diameterKm && loc.diameterKm > 0 ? viewSpanDegFor(loc.diameterKm) : 25,
        });
      }
    : undefined;

  return (
    <PanelShell title="AI Tools" onClose={onClose}>
      <LunarSearch embedded onSelectLocation={handleSelectLocation} />
    </PanelShell>
  );
}
