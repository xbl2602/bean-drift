"use client";
// AI Tools：聊天框（panels/ai-chat/）。它只调用我们自己的 POST /api/agent（约定见 docs/SHARED_INTERFACES.md 第 6 节），
// DeepSeek 密钥只在服务端，这里碰不到。面板在右边：三个模式都能打开它。
// 回答里的坐标/地点可以点击，跳到 2D/3D 月面对应位置（onGoTo 由产品页提供，和搜索面板共用同一套跳转）。
import { AiChat } from "./ai-chat/ai-chat";
import type { SelectedLunarLocation } from "@/features/agent-search/ui/lunar-search";
import { formatLatLon } from "../moon-frames";
import { viewSpanDegFor } from "../search/lunar-names";
import { useT } from "../i18n/use-t";
import { PanelShell } from "./panel-shell";
import type { SearchTarget } from "./search-panel";

export function AiPanel({ onGoTo, onClose }: { onGoTo?: (target: SearchTarget) => void; onClose: () => void }) {
  const t = useT();
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
    <PanelShell title={t("tool.ai.label")} onClose={onClose} side="right" fill>
      <AiChat onSelectLocation={handleSelectLocation} />
    </PanelShell>
  );
}
