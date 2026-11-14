// 汇总注册：所有对外工具的白名单。只做汇总，不放业务逻辑。
// MCP 路由和（将来的）agent 窗口都只能调用这里列出的工具。新增功能 = 在自己的 mcp/ 里定义工具，再来这里加一行（由 xbl2602 合并）。
import { comparePointsTool } from "@/features/compare-points/mcp/compare-points-tool";
import { getPointConditionsTool } from "@/features/point-conditions/mcp/get-point-conditions-tool";
import { listPresetsTool } from "@/features/presets/mcp/list-presets-tool";
import type { ReadTool } from "./tool";

export const TOOLS: readonly ReadTool[] = [getPointConditionsTool, comparePointsTool, listPresetsTool];
