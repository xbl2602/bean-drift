"use client";
// AI Tools：自然语言助手。对话框本体是 src/features/agent-search/ui/ 的 LunarSearch，
// 它只向我们自己的 /api/agent 发请求，DeepSeek 密钥只在服务端，这里碰不到。这里只负责把它放进面板。
import { LunarSearch } from "@/features/agent-search/ui/lunar-search";
import { PanelShell } from "./panel-shell";

export function AiPanel({ onClose }: { onClose: () => void }) {
  return (
    <PanelShell title="AI Tools" onClose={onClose}>
      <LunarSearch embedded />
    </PanelShell>
  );
}
