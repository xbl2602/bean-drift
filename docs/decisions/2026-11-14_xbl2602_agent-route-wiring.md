# 接入 agent 搜索：路由接线，频率限制作为未解决缺口

- **日期**：2026-11-14
- **提出人**：`xbl2602`（Claude Code 协助）
- **状态**：接线 **已采纳**；"每访问者频率限制"当时未解决，**已于同日解决**，见 `2026-11-14_xbl2602_agent-rate-limit.md`（下面"未解决"一节保留为历史记录）
- **需要谁确认**：`xbl2602`（频率限制方案）

## 背景

`louis068`（Bean）的 PR #1 在 `src/features/agent-search/` 里做好了 agent 的服务端模块（DeepSeek 适配器、只读工具循环、HTTP 工厂、14 项测试），但按规则没有改他人目录，路由要由 `app/api/` 的负责人接。PR #1 已合并，本次接路由。

## 决定

1. 新增 `app/api/agent/route.ts`，只做接线：`POST = createLunarAgentPost(TOOLS)`，`runtime = "nodejs"`，`maxDuration = 30`（模块自己的总超时是 25 秒）。已对照 `node_modules/next/dist/docs/` 确认 Next 16 里这两个导出有效。
2. 接口约定登记在 `docs/SHARED_INTERFACES.md` 第 6 节。
3. 密钥只用 `DEEPSEEK_API_KEY`，仅服务端、每次请求时读取。**没配置时返回 503**，不会返回假答案。
4. 代码**不读** `.env.example` 里已登记的 `DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL`、`AGENT_RATE_LIMIT_PER_MIN`：网址和模型名写死（`https://api.deepseek.com`、`deepseek-flash`，防止密钥被环境变量指到别处）。这三个变量先保留名字并在 `.env.example` 里标明"目前不读"，避免文档和代码对不上。

## 未解决：每访问者频率限制

AGENTS §4.5 要求 agent 接口有请求频率限制，因为每次调用花的是 `xbl2602` 的钱。Bean 的实现按他的操作者要求改成"只依赖 DeepSeek 官方限速"，模块自己的 README 也承认官方并发上限**不是花费上限**。目前保护只有单次上限：2000 字符、4 次模型调用、8 次工具执行、1200 tokens、25 秒超时。

所以：**路由已接，但在 `xbl2602` 配 `DEEPSEEK_API_KEY` 之前，接口不花钱（返回 503）。配了 key 之后，任何访问者都能反复调用。** 配 key 之前建议先定方案（登记在 `docs/TODO.md`）：

| 方案 | 做法 | 代价 |
|---|---|---|
| ① Vercel 防火墙频率限制规则 | 在 Vercel 后台给 `/api/agent` 加限制规则，不改代码 | 要确认免费版是否可用、能限到什么程度（我没查证） |
| ② Supabase 共享计数 | 用原子函数计数，不进程内存状态 | 要建表、改代码；Bean 最初的提议就是这个 |
| ③ 接受风险 | 只靠 DeepSeek 账号预充值余额封顶 | 需确认账号确实是预充值制；余额烧光后 agent 直接不可用 |

## 其他已知取舍

- DeepSeek 适配器放在 `src/features/agent-search/api/deepseek.ts`，不在 AGENTS §5.4 规定的 `src/lib/llm/`。模块通过 `createAgentHandler({ tools, getComplete })` 注入适配器，以后可以无痛搬到 `src/lib/llm/`。
- 14 项测试（`node --test src/features/agent-search/tests/agent.test.cjs`）还没进 CI（没有 `test` 脚本）。

## 影响

改动的目录都属于 `xbl2602`：`app/api/agent/`、`docs/`、`.env.example`。不动 `src/features/agent-search/`（Bean 的）。
