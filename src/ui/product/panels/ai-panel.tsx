"use client";
// AI Tools：自然语言助手的入口。后端（DeepSeek 封装 src/lib/llm/ 和服务端路由）归 xbl2602，还没有建，
// 所以这里如实写"还没接通"，不做假的对话。接通后把这个面板换成真正的对话窗口。
import type { ToolId } from "../menu/tools";
import { Caveat, PanelButton, PanelShell } from "./panel-shell";

export function AiPanel({ onSelectTool, onClose }: { onSelectTool: (tool: ToolId) => void; onClose: () => void }) {
  return (
    <PanelShell title="AI Tools" onClose={onClose}>
      <p className="text-sm text-white/80">An assistant that answers questions about the Moon in plain language, such as “Where near the south pole gets the most sunlight?”</p>
      <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70">Not connected yet. The assistant needs the team’s server-side AI service, which has not been set up.</p>
      <p className="mt-3 text-xs text-white/55">Until then, these tools answer the same kinds of question:</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <PanelButton onClick={() => onSelectTool("search")}>Search Location</PanelButton>
        <PanelButton onClick={() => onSelectTool("suitability")}>Site Suitability</PanelButton>
        <PanelButton onClick={() => onSelectTool("compare")}>Compare Locations</PanelButton>
      </div>
      <Caveat>No questions or data are sent anywhere from this panel.</Caveat>
    </PanelShell>
  );
}
