// 汇总注册：所有对外工具的白名单。只做汇总，不放业务逻辑。
// MCP 路由和（将来的）agent 窗口都只能调用这里列出的工具。新增功能 = 在自己的 mcp/ 里定义工具，再来这里加一行（由 xbl2602 合并）。
// 注意：自然语言窗口（agent-search）另有一份自己的白名单，新工具要让它用上，得在那边也加（见 docs/SHARED_INTERFACES.md 第 6 节）。
import { compareDatesTool } from "@/features/compare-dates/mcp/compare-dates-tool";
import { comparePointsTool } from "@/features/compare-points/mcp/compare-points-tool";
import { findSitesTool } from "@/features/find-sites/mcp/find-sites-tool";
import { getPointConditionsTool } from "@/features/point-conditions/mcp/get-point-conditions-tool";
import { getPointTimelineTool } from "@/features/point-timeline/mcp/get-point-timeline-tool";
import { listPresetsTool } from "@/features/presets/mcp/list-presets-tool";
import type { ReadTool } from "./tool";

export const TOOLS: readonly ReadTool[] = [
  getPointConditionsTool,
  comparePointsTool,
  listPresetsTool,
  getPointTimelineTool,
  compareDatesTool,
  findSitesTool,
];
