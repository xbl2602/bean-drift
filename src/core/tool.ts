// 对外能力（工具）的统一定义。网页以外的入口——REST API、MCP、agent 窗口——都从同一份注册表取。
import type { z } from "zod";

/**
 * 一个对外工具。access 只能是 "read"：目前没有任何写工具（AGENTS.md 第 6 节）。
 * 要加写工具，必须先经 xbl2602 批准并修改这个类型。
 */
export interface ReadTool<Schema extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  access: "read";
  inputSchema: Schema;
  // 用方法写法（不是箭头函数属性），这样不同参数类型的工具才能放进同一个注册表数组。
  run(input: z.output<Schema>): unknown;
}

/** 让 TypeScript 在定义工具时推断 input 类型。 */
export function defineReadTool<Schema extends z.ZodType>(tool: ReadTool<Schema>): ReadTool<Schema> {
  return tool;
}
