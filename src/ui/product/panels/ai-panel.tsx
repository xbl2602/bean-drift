"use client";
// AI Tools：聊天框（panels/ai-chat/）。它只调用我们自己的 POST /api/agent（约定见 docs/SHARED_INTERFACES.md 第 6 节），
// DeepSeek 密钥只在服务端，这里碰不到。面板在右边：三个模式都能打开它。
import { AiChat } from "./ai-chat/ai-chat";
import { useT } from "../i18n/use-t";
import { PanelShell } from "./panel-shell";

export function AiPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <PanelShell title={t("tool.ai.label")} onClose={onClose} side="right" fill>
      <AiChat />
    </PanelShell>
  );
}
