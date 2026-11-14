# 决定：自然语言窗口接上三个新查询工具，并给 compare_points 加窗口专用的点数上限

日期：2026-11-14  ·  作者：xbl2602  ·  状态：已实现（本 PR）

## 背景

PR #9 给 `registry.ts` 加了 `get_point_timeline`、`compare_dates`、`find_sites`，MCP 能用，但自然语言窗口（`src/features/agent-search/`，`louis068` 的目录）有自己写死的白名单，还只有 3 个工具，所以窗口调不到它们；系统提示最后一句还写着"没有合适数据就不能找最优位置"，和 `find_sites` 矛盾。
PR #9 的决定记录里建议"把 agent 能传的点数限制在 8 个以内"（`compare_points` 满 10 个点超过单个工具结果 64 KB 的上限）。这次实测发现 8 个不够安全。

## 做了什么

1. 白名单加上 `get_point_timeline`、`compare_dates`、`find_sites`（现在 agent 能用 `registry.ts` 里的全部 6 个工具）。
2. 系统提示：按问题选工具；`find_sites` 只是 0.25° 格子的粗筛，要转述 `provenance.note` 里的限制（格内平均坡度、一年数据、地球没有最低仰角），`matchedCells` 为 0 表示没有格子满足；最后一句改成"不能联网、跑代码、读文件、改数据，也不能认证某个位置对着陆是安全或最优的"。
3. `compare_points` 对 agent 一次最多 **6 个点**（REST API 和 MCP 仍是 10 个）。超过时不执行，把 `too_many_points` 回给模型让它拆开问。
4. 工具结果超过 65,536 字节时，不再抛 502（整个回答失败），而是把 `result_too_large` 回给模型，让它缩小范围重问。

## 为什么是 6，不是 8

实测（2026-11-14，本机，全月网格约 1,072 个点，北极附近和南极附近加密）：

- 单个点的 `compare_points` 结果：最小 4.8 KB，中位数 6.2 KB，最大 **9.9 KB**（南纬 89.9°、东经 50°，一年有 40 个日照窗口）。
- 因此 8 个最大的点约 79 KB，**超过** 65,536 字节上限；最典型的问题"比较南极附近几个着陆点"恰好落在单点最大的区域，8 个会失败。
- 6 个最大的点，带 `minEarthElevationDeg: 5`，实测 **61,754 字节**，在上限内（余量约 3.8 KB，所以还需要第 4 条兜底）。
- 其余新工具：`get_point_timeline` 最大实测约 26 KB，`find_sites` 20 个结果约 6 KB，`compare_dates` 5 点 × 8 时刻按最大单点估算约 20 KB。

## 没选的做法

- **改 `MAX_COMPARE_POINTS`**：会同时改变 REST API 和 MCP 的契约，而问题只出在 agent 的 64 KB 上限。
- **只限点数、不管超限**：点数上限是按"扫描到的最大单点"定的，网格不是穷举，余量只有约 6%，不能当保证。所以加了第 4 条：超限不再是致命错误。
- **让 agent 的结果上限更大**：每个结果都要喂给 DeepSeek，60 KB 粗估约两万 token 量级（没有精确计量），放大上限等于放大每次调用的成本。

## 没验证的

- 没有用真实的 DeepSeek 模型跑过：测试用的是模拟模型加真实月球数据，**没有验证模型会不会真的按新提示选对工具**，这需要有 `DEEPSEEK_API_KEY` 的人在部署后试几个问题（下面给了几句）。
- 6 个点的上限是按扫描到的最大值定的，没有对全部 1,036,800 个格子穷举。
- 上面的体积是本机 Node 测的，Vercel 上应一致（同一份 JSON），但没有逐项在线上核对。

## 部署后可以试的问题

- "找南纬 80° 以南坡度小于 10° 的位置，哪里一年里太阳和地球都能看到的时间最长？"（应调用 `find_sites`，回答里要有"粗筛"的限制）
- "南纬 89.5°、东经 0° 这个点，2030 年 3 月 5 日起一个月里太阳什么时候能照到？"（应调用 `get_point_timeline`）
- "把所有预设着陆点在 2030 年 3 月 5 日的光照和通信条件比较一下"（先 `list_presets` 再 `compare_points`；点数超过 6 个时模型应拆成两次）

## 影响范围

只改了 agent 窗口：`src/features/agent-search/logic/run-agent.ts`、它的测试和 README，加 `docs/SHARED_INTERFACES.md` 第 6 节。没有改 `src/core`、REST 路由或 MCP，对前端的返回格式不变。取代 `2026-11-14_xbl2602_new-query-tools-and-min-earth-elevation.md` 里"自然语言窗口还用不到新工具"和"建议限制到 8 个"那两句。
