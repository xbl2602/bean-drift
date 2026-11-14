# Lunar AI search（Bean）

2026-11-14：按操作者确认，使用 DeepSeek V4.1 Flash，模型 ID 为 `deepseek-flash`；
不设之前提议的 5 次/分钟或 100 次/天额度，不依赖 Supabase。线上另有团队配置的 Vercel 每 IP 每分钟 20 次限制，见 SHARED_INTERFACES 第 6 节。
官方并发上限不是消费预算。本模块收到官方 429 时直接向页面返回 429，不自动重试。

## 已实现

- `logic/run-agent.ts`：无 HTTP 依赖的工具循环；输入校验；只读白名单。
- `api/deepseek.ts`：服务端官方 API 适配器；固定模型/域名；不记录密钥；解析及校验响应。
- `api/create-handler.ts`：标准 Request → Response；请求大小、超时与安全错误处理。
- `api/server.ts`：仅在请求时读取已有登记的 `DEEPSEEK_API_KEY`。
- `tests/agent.test.cjs`：调用真实月球工具和模拟模型接口，无需密钥、不产生费用。

模型通过已有注册工具查询数据，不复制星历算法。返回实际工具结果作为 sources，
保留 terrain、visibility、yearStats 的实际来源和可用状态。地形已接入整月概览数据；年统计目前覆盖 2030，不能冒充查询日期所属年份。自动测试不能保证模型永不幻觉。
没有联网搜索、写数据库、shell 或任意文件访问能力。

可用工具（白名单 `ALLOWED`，全部只读）：`get_point_conditions`、`compare_points`、`list_presets`、`get_point_timeline`、`compare_dates`、`find_sites`。
`compare_points` 对本窗口一次最多 6 个点（API/MCP 仍是 10 个）：单点结果最大约 9.9 KB，而单个工具结果上限是 64 KB（65,536 字节）。
工具结果超过上限时，把 `result_too_large` 回给模型让它缩小范围重问，不会让整个回答失败；参数点数超限（超过 6 个）由参数校验直接拦下，回 `invalid_arguments`，模型看到的工具说明里写的也是同一个上限。

## 路由负责人接入

本次没有修改他人拥有的 `app/api/`、`src/core/`、`src/lib/`、产品页面或部署配置。
主线已经在 `app/api/agent/route.ts` 接入以下接口（无需再次添加）：

```ts
import { TOOLS } from "@/core/registry";
import { createLunarAgentPost } from "@/features/agent-search/api/server";

export const runtime = "nodejs";
export const maxDuration = 30;
export const POST = createLunarAgentPost(TOOLS);
```

提供方适配器目前放在自有 feature 内，使用标准 fetch，没有新增 SDK。
未来若 xbl2602 提供统一 `src/lib/llm/`，可经 `createAgentHandler({tools,getComplete})` 注入并替换适配器。
不要从浏览器组件 import `api/`。没有新增依赖，不需要改 package.json。

## 密钥与部署

由密钥持有人在 Vercel 项目 Settings → Environment Variables 设置 `DEEPSEEK_API_KEY`，
再重新部署。不要使用 NEXT_PUBLIC 前缀，不要提交真实 .env 文件或把密钥发到聊天。
本地由持有人自行放入被忽略的 `.env.local`；AI 不读取该文件。
当前实现固定官方域名与 Flash 模型，不读取 `DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL` 或 `AGENT_RATE_LIMIT_PER_MIN`。
Docker、本地、Vercel 均使用标准 Node.js fetch，无持久状态。

## 前端接口

`POST /api/agent`，Content-Type: application/json，请求只允许：

```json
{ "message": "Compare the south pole and Apollo 11 at 2030-01-01T00:00:00Z" }
```

返回：`{answer: string, sources: [{tool, input, result}], mode: "live", model: "deepseek-flash"}`。
无历史会话；下一题必须带齐地点/日期。前端展示 answer 为纯文本，不能用不安全 HTML 渲染。
sources 是工具事实依据；空 sources 不代表回答经过数据验证。

错误统一：`{error: {code, message}}`。
400 输入错误、405 方法不支持、413 请求过大、422 问题步骤过多、429 官方限速、
502 工具/模型响应无效、503 未配置或服务不可用、504 超时/取消。
前端应显示错误并让用户手动重试，不能无限自动重发。

单次限制：问题最多 2000 字符，请求体 8192 字节，最多 4 次模型请求、8 次工具执行，
每次模型输出最多 1200 tokens，总超时 25 秒。达到最后一轮还要求工具时停止，不再执行工具。
这些是单次任务边界，不是额外的每日请求额度。

## 验证

在仓库根目录运行：

```sh
node --test src/features/agent-search/tests/agent.test.cjs
npm run typecheck
npm run build
```

接入路由并由持有人配置密钥之后，再做真实联调：

1. 问 “List the lunar presets”，确认 sources 有 list_presets。
2. 查询指定 UTC 时间的点位并与 /api/point 对照。
3. 查询其他年份，确认回答分别说明查询时刻和返回统计期；无法提供的数据按 provenance 说明，不把 null 当成零。
4. 浏览器 Network 只有本网站 /api/agent 请求，响应中无密钥。
5. 真实请求会计费；单个问题最多产生四次模型请求。无需为了验证限速故意打满官方额度。

未配置 key 时，接口应返回 503，而不是伪装成真实 AI 的模拟答案。

## 官方参考（核实于 2026-11-14）

- 模型 ID：https://api-docs.deepseek.com/quick_start/
- 账号级并发限制与 429：https://api-docs.deepseek.com/quick_start/rate_limit/

## 搜索框接入与本次验证

产品页负责人可在页面中 import `{ LunarSearch }` from `@/features/agent-search/ui/lunar-search` 并渲染 `<LunarSearch />`。
组件只向 `/api/agent` 发送 `{message}`；支持例题填入、Ctrl/Cmd+Enter、取消、来源展开和安全错误提示。
2026-11-15 起产品页的 AI Tools 面板已经挂上它：`src/ui/product/panels/ai-panel.tsx` 渲染 `<LunarSearch embedded />`。`embedded` 去掉卡片外框、眉标和大标题，适合放进已有标题的侧边面板；回答出来后会自动滚到回答开头。不加 `embedded` 时仍是原来的独立大卡片。

2026-11-14 实测线上 `/api/agent` 返回 200、model=deepseek-flash，sources 中确有 list_presets；这次真实请求会产生正常 API 用量。
本地浏览器以明确标注的模拟模型响应检查例题、答案显示、429 和取消。没有把模拟接口加入产品代码。
