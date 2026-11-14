# agent 接口：每个 IP 每分钟最多 20 次，用 Vercel 防火墙规则实现

- **日期**：2026-11-14
- **提出人**：`xbl2602`（Claude Code 协助）
- **状态**：已采纳（`xbl2602` 要求"每分钟最多 20 次调用"；方案 ① 由 Claude 选择并在线上实测）
- **需要谁确认**：`xbl2602`（如果其实想要的是"全站每分钟共 20 次"而不是"每个 IP"，见下面"没做到的"）

## 背景

AGENTS §4.5 要求 agent 接口有请求频率限制。上一条决定（`2026-11-14_xbl2602_agent-route-wiring.md`）把它列为配密钥之前要解决的缺口，给了三个方案。

## 决定

选方案 ①：在 Vercel 后台加一条防火墙自定义规则。**不改代码、不加依赖、不引入 Vercel 专属 SDK**（`@vercel/firewall` 的 `checkRateLimit` 会让代码离不开 Vercel，违反 AGENTS §5.3，所以没用）。

规则内容：

| 项 | 值 |
|---|---|
| 名字 | `agent-rate-limit-20-per-min` |
| 条件 | 路径等于 `/api/agent`（所有 HTTP 方法都计数） |
| 动作 | rate_limit，固定窗口，窗口 60 秒，上限 20 次 |
| 计数依据 | 访问者 IP |
| 超限返回 | 429（Vercel 返回，不进我们的代码） |

重建办法（规则被删或换项目时）：

```
vercel firewall rules add "agent-rate-limit-20-per-min" \
  --condition '{"type":"path","op":"eq","value":"/api/agent"}' \
  --action rate_limit --rate-limit-window 60 --rate-limit-requests 20 \
  --rate-limit-keys ip --rate-limit-action rate_limit --yes
```

或在后台 Project → Firewall → Custom Rules 里手动建同样的规则。改数字也在那里改。

## 实测（2026-11-14，线上，不花钱）

用空消息（在调用 DeepSeek 之前就会被拒绝）连续请求线上 `/api/agent`：前 20 次返回 400（正常通过到我们的代码），第 21 到 24 次返回 429，窗口重置后又恢复通过；`/api/health`、`/api/presets` 不受影响。超限响应 body 是 JSON：`{"error":{"code":"429","message":"Too Many Requests","id":"..."}}`。

## 没做到的（已知限制）

- **按 IP，不是全站总数。** 想要"全站每分钟共 20 次"，Vercel 规则做不到（只能按 IP、JA4 指纹或请求头计数），要用 Supabase 计数。多个 IP 同时请求可以超过总共 20 次。
- **限的是速度，不是花费。** 一个 IP 一分钟 20 次，每次最多 4 次模型调用。要给花费封顶，只能靠 DeepSeek 账号里的预充值余额（建议只留少量）。
- **同一个 IP 共用额度**：同一展位 Wi-Fi 的所有人共用 20 次。
- **固定窗口**：窗口交界处短时间内最多可能通过接近 40 次。
- **只在 Vercel 生效**。Docker 和本地没有这条限制；但它们必须自己配密钥才会真的调用 DeepSeek，而密钥只有 `xbl2602` 持有。
- **规则不在仓库里**，所以上面写了重建办法。`.env.example` 里的 `AGENT_RATE_LIMIT_PER_MIN` 目前代码不读，保留名字。
- 我没有查证 Hobby 套餐对防火墙规则数量的上限；创建时没有报错，规则已生效。

## 备选方案

- ② Supabase 共享计数：可以做到全站总数，但要建表、改代码，`D-0014` 里 Supabase 暂不使用。
- ③ 只靠 DeepSeek 余额封顶：不限速，被刷时余额会很快烧光，agent 对所有人不可用。

## 影响

只改文档和 Vercel 后台配置；`src/` 和 `app/` 没有改动。前端（`ShanLe1224`）要处理 429：按状态码提示稍后再试，不自动重发。
