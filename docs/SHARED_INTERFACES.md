# 跨模块接口约定（SHARED_INTERFACES）

> **维护人：`xbl2602`。** 其他人的 agent 想新增或改动接口，到 `docs/decisions/` 提议，不要直接改本文件。
> 规则：模块之间要通信，就把约定写在这里，**先写这里，再写代码**。别人的 agent 读到这里，才知道怎么跟你的模块对接。
> 状态：第 2、3 节是**已实现的接口**（代码在 `src/core/types.ts`、`src/features/`）；标"待定"的字段还没有数据。

## 1. 通用约定

单位、坐标、时间的约定见 [DATA_FLOW.md](DATA_FLOW.md) 第 3 节。要点：经纬度为月面经纬度（度），东经为正；方位角正北 0° 向东增加；时间一律 UTC（ISO 8601，必须带结尾的 `Z`）；变量名带单位后缀（`latDeg`、`distanceKm`）。

**线上地址**：见 [DEPLOYMENT.md](DEPLOYMENT.md)。下面的路径都相对于部署域名。

**错误格式**（所有 REST 接口一致）：

```json
{ "error": { "code": "invalid_input", "message": "...", "details": [{ "path": "latDeg", "message": "..." }] } }
```

状态码：400 参数不对，413 请求体过大，500 内部错误（不透传原文）。

## 2. 点位参数（PointConditions）

类型定义：`src/core/types.ts`。**不要在别处重新定义**，直接 import。

| 字段 | 含义 | 单位 | 状态 |
|---|---|---|---|
| `position.latDeg`, `position.lonDeg` | 位置（经度规范到 [-180, 180]） | 度 | ✅ |
| `timeUtc` | 查询时刻 | UTC ISO 8601 | ✅ |
| `sun.azimuthDeg`, `sun.elevationDeg` | 太阳方位角（正北 0°）、高度角 | 度 | ✅ 星历，相对**光滑球面**地平线 |
| `sun.aboveSphericalHorizon` | 高度角 > 0 | — | ✅ **不含地形遮挡** |
| `earth.azimuthDeg`, `earth.elevationDeg` | 地球方位角、高度角 | 度 | ✅ 同上 |
| `earth.distanceKm`, `earth.angularRadiusDeg`, `earth.illuminatedFraction` | 地球距离、视半径、受照比例（0~1） | km、度、— | ✅ |
| `terrain` | 高度、坡度、坡向、地平线剖面、地形遮挡 | 米、度 | ❓ 现在恒为 `null`，等 LOLA 衍生数据（TODO Q4/Q5） |
| `yearStats` | 一年日照比例、地球可见比例、最长断电/断信号 | 比例/小时 | ❓ 现在恒为 `null`，公式待定（TODO Q1） |
| `provenance.{ephemeris,terrain,yearStats}` | 每类数据的来源与状态（`ok` / `unavailable`） | — | ✅ |
| `conventions` | 经度、方位角、高度角、时间的约定说明 | — | ✅ |

**精度**：星历约 0.02°（对照 JPL Horizons），适合可视化，不适合任务级规划。有效时间 2000-01-01 ~ 2100-01-01。

> 调用方不要把 `terrain: null` 当成"没有地形"，而是"还没接入"；看 `provenance.terrain.status`。

## 3. REST 接口

全部只读、无状态。

| 方法 路径 | 参数 | 返回 |
|---|---|---|
| `GET /api/health` | — | `{ "status": "ok", "service": "bean-drift" }` |
| `GET /api/point` | query：`latDeg`（-90~90）、`lonDeg`（-180~360）、`time`（可选，默认现在） | `PointConditions` |
| `POST /api/compare` | JSON：`{ "points": [{ "latDeg", "lonDeg" }, ...1~10 个], "time"?: "..." }` | `{ "timeUtc", "results": PointConditions[] }`，顺序与输入一致 |
| `GET /api/presets` | — | `{ "presets": Preset[] }`（`Preset` 见 `src/core/types.ts`） |

示例：

```
GET /api/point?latDeg=-89.71&lonDeg=62.5&time=2030-01-01T12:00:00Z
```

## 4. MCP（Streamable HTTP）

- 地址：`POST /mcp`。无状态；不支持 `GET`（返回 405）；不支持 JSON-RPC 批量。
- 已实现方法：`initialize`、`ping`、`tools/list`、`tools/call`。
- 工具白名单：`src/core/registry.ts`。**全部只读**；目前没有任何写工具。参数错误按 MCP 约定作为工具执行错误（`isError: true`）返回，让模型能读到并改正。

| 工具名 | 说明 | 读/写 |
|---|---|---|
| `get_point_conditions` | 一个点、一个时间的 `PointConditions`（参数同 `GET /api/point`） | 读 |
| `compare_points` | 多个点同一时间并排（参数同 `POST /api/compare`） | 读 |
| `list_presets` | 预设点位清单 | 读 |

**还没做的候选能力**（等 FEATURE_SPEC 的待决问题定下来再落定）：查询图层值、时间序列（太阳/地球高度曲线与窗口）、按条件找位置。

**怎么加一个新能力**（给 `louis068` 和他的 agent）：在 `src/features/<功能名>/` 下建 `logic/`（纯函数 + zod 输入 schema）、`api/`、`mcp/`，照 `src/features/point-conditions/` 抄；然后让 `xbl2602` 在 `src/core/registry.ts` 和 `app/api/` 各加一行。

## 5. 环境变量（登记处）

变量名和用途登记在仓库根目录的 `.env.example`（值留空）。新增变量先登记再使用。目前网页、API、MCP **不需要任何环境变量**；只有 agent 窗口（第 6 节）需要 `DEEPSEEK_API_KEY`，没配置时它返回 503，其余功能不受影响。

## 6. agent 窗口：`POST /api/agent`

实现在 `src/features/agent-search/`（负责人 `louis068`），路由接线在 `app/api/agent/route.ts`。它是 `/mcp` 同一套只读工具的自然语言入口：模型想查数据，只能调用下面三个工具，结果原样放进 `sources`。

- **请求**：`Content-Type: application/json`，只允许 `{ "message": "..." }`，去掉首尾空白后 1~2000 字符，请求体不超过 8192 字节，未知字段直接拒绝。**没有对话历史**，每次要带齐地点和日期。
- **成功（200）**：`{ "answer": string, "sources": [{ "tool", "input", "result" }], "mode": "live", "model": "deepseek-flash" }`。`answer` 是纯文本，前端**不能**当 HTML 渲染。`sources` 是真正执行过的工具结果；`sources` 为空表示这个回答没有经过数据验证，界面不能把它标成"已计算"。
- **错误**：和其他接口一样是 `{ "error": { "code", "message" } }`。400 输入不对、405 不是 POST、413 请求太大、422 问题要的步骤太多、429 DeepSeek 限速、502 模型或工具返回无效、503 没配置密钥或服务不可用、504 超时或被取消。前端显示错误，让用户**手动**重试，不要自动重发（每次重发都花钱）。
- **单次上限**：最多 4 次模型调用、8 次工具执行；模型每次输出最多 1200 tokens；总超时 25 秒。
- **可用工具**（代码里写死的只读白名单）：`get_point_conditions`、`compare_points`、`list_presets`。
- **密钥**：`DEEPSEEK_API_KEY`，仅服务端、每次请求时读取。网址和模型名（`deepseek-flash`）写死在代码里，不读环境变量。
- ⚠️ **已知缺口**：目前**没有"每个访问者的请求频率限制"**，只有上面的单次上限和 DeepSeek 官方的并发限制。配好密钥之前要先处理，见 `docs/TODO.md` 和 `docs/decisions/2026-11-14_xbl2602_agent-route-wiring.md`。
