# 跨模块接口约定（SHARED_INTERFACES）

> **维护人：`xbl2602`。** 其他人的 agent 想新增或改动接口，到 `docs/decisions/` 提议，不要直接改本文件。
> 规则：模块之间要通信，就把约定写在这里，**先写这里，再写代码**。别人的 agent 读到这里，才知道怎么跟你的模块对接。
> 状态：第 2、3 节是**已实现的接口**（代码在 `src/core/types.ts`、`src/features/`）。第 2 节里标 ⬜ 的字段：**接口已留好，但还没有数据，值恒为 `null`**。

## 1. 通用约定

单位、坐标、时间的约定见 [DATA_FLOW.md](DATA_FLOW.md) 第 3 节。要点：经纬度为月面经纬度（度），东经为正；方位角正北 0° 向东增加；时间一律 UTC（ISO 8601，必须带结尾的 `Z`）；变量名带单位后缀（`latDeg`、`distanceKm`、`heightM`、`longestOutageH`）。

**线上地址**：见 [DEPLOYMENT.md](DEPLOYMENT.md)。下面的路径都相对于部署域名。

**错误格式**（所有 REST 接口一致）：

```json
{ "error": { "code": "invalid_input", "message": "...", "details": [{ "path": "latDeg", "message": "..." }] } }
```

状态码：400 参数不对，413 请求体过大，500 内部错误（不透传原文）。

## 2. 点位参数（PointConditions）

类型定义：`src/core/types.ts`。**不要在别处重新定义**，直接 import。`GET /api/point`、MCP `get_point_conditions`、`POST /api/compare` 的每个结果，都是这个结构。数据由 `src/core/data/point-conditions.ts` 汇总。

**设计原则：接口先留好，数据后接入。**

1. 每一组参数（`terrain`、`visibility`、`yearStats`）**永远存在**，组里每个字段还没有数据时为 `null`。调用方照着字段名写代码，数据接入后**不用改代码**。
2. `null` 是什么意思，看这一组的 `provenance.<组>.status`：
   - `unavailable`：这类数据**还没接入**，所有字段都没算。
   - `ok`：已接入。此时某个字段为 `null` 表示"这个点、这段时间里没有这个量"（例如查询范围内没有日落）。
3. 状态图例：✅ 已有真实数据 · ⬜ 接口已留，值恒为 `null`（等数据）。
4. 想知道"某个量到底有没有"，永远看 `provenance`，不要看字段是不是 `null` 就下结论（**`terrain.heightM: null` 不等于"这里没有高度"**，而是"还没接入"）。

### 2.1 基础

| 字段 | 含义 | 单位 | 状态 |
|---|---|---|---|
| `position.latDeg`、`position.lonDeg` | 位置（经度规范到 [-180, 180]） | 度 | ✅ |
| `timeUtc` | 查询时刻 | UTC ISO 8601 | ✅ |

### 2.2 太阳与地球的方向（`sun`、`earth`）

高度角相对**光滑球面**地平线，**不含地形遮挡**（含遮挡的看 2.4 `visibility`）。

| 字段 | 含义 | 单位 | 状态 |
|---|---|---|---|
| `sun.azimuthDeg`、`earth.azimuthDeg` | 方位角（正北 0°，向东增加） | 度 | ✅ 星历 |
| `sun.elevationDeg`、`earth.elevationDeg` | 高度角（0° = 球面地平线，90° = 头顶） | 度 | ✅ 星历 |
| `sun.aboveSphericalHorizon`、`earth.aboveSphericalHorizon` | 高度角 > 0 | — | ✅ **不含地形遮挡** |
| `sun.distanceKm` | 观察点到太阳的距离（取整到 1000 km：太阳用的是低精度模型） | km | ✅ |
| `sun.angularRadiusDeg` | 太阳视半径（约 0.27°） | 度 | ✅ |
| `earth.distanceKm` | 观察点到地心的距离 | km | ✅ |
| `earth.angularRadiusDeg` | 地球视半径（按地球平均半径 6371 km） | 度 | ✅ |
| `earth.illuminatedFraction` | 从该点看到的地球被照亮的比例 | 比例 0~1 | ✅ |

### 2.3 地形（`terrain`）⬜

依赖 LOLA 衍生数据（TODO Q4、Q5）。对应 FEATURE_SPEC 第 4 节参数卡的"高度、坡度、坡向、地平线剖面"和第 6 节"返回里说明来自多少米/像素的数据"。

| 字段 | 含义 | 单位 | 状态 |
|---|---|---|---|
| `terrain.heightM` | 海拔，相对 1737.4 km 参考球 | 米 | ⬜ |
| `terrain.slopeDeg` | 坡度 | 度 | ⬜ |
| `terrain.aspectDeg` | 坡向：下坡方向的方位角（正北 0°，向东增加） | 度 | ⬜ |
| `terrain.horizonProfile` | 地平线剖面：`[{ azimuthDeg, elevationDeg }]`，按方位角排序；每个方位上地形挡住的仰角。采样间隔在 `provenance.terrain.note` 里写明 | 度 | ⬜ |
| `terrain.resolutionM` | 上面这些值来自多少米/像素的数据 | 米/像素 | ⬜ |

### 2.4 地形遮挡后的可见性（`visibility`）⬜

"此刻"太阳、地球有没有被地形挡住。依赖 2.3 的地平线数据加星历。`visibility.sun` 和 `visibility.earth` **结构相同**：

| 字段 | 含义 | 单位 | 状态 |
|---|---|---|---|
| `visibility.<sun/earth>.diskVisibleFraction` | 圆盘有多大比例露在地形地平线之上（0 = 全挡住，1 = 全可见）。FEATURE_SPEC 要求处理部分遮挡；**"可见"定义为这个值 > 0** | 比例 0~1 | ⬜ |
| `visibility.<sun/earth>.nextRiseUtc` | 下一次从地形地平线后升起（由不可见变可见）的时刻 | UTC ISO 8601 | ⬜ |
| `visibility.<sun/earth>.nextSetUtc` | 下一次落到地形地平线之下（由可见变不可见）的时刻。对应参数卡的"距日落、距地球落下的剩余时间" | UTC ISO 8601 | ⬜ |

### 2.5 一年统计（`yearStats`）⬜

由 pipeline 预计算，公式待定（TODO Q1）。FEATURE_SPEC 术语：**断电** = 太阳被地形挡住的连续时段，**断信号** = 地球被地形挡住的连续时段。`yearStats.sun` 和 `yearStats.earth` **结构相同**：

| 字段 | 含义 | 单位 | 状态 |
|---|---|---|---|
| `yearStats.periodStartUtc`、`yearStats.periodEndUtc` | 统计覆盖的时间范围。❓ 怎么取（从查询时刻起一年 / 日历年 / 18.6 年周期）等 Q1 定 | UTC ISO 8601 | ⬜ |
| `yearStats.<sun/earth>.visibleFraction` | 统计期内可见的时间占比（太阳：日照比例；地球：地球可见比例） | 比例 0~1 | ⬜ |
| `yearStats.<sun/earth>.longestOutageH` | 统计期内最长一次连续不可见（太阳：最长断电；地球：最长断信号） | 小时 | ⬜ |
| `yearStats.<sun/earth>.visibleWindows` | 连续可见的窗口列表 `[{ startUtc, endUtc, durationH }]`（太阳：各月昼窗口） | UTC、小时 | ⬜ |

### 2.6 来源与约定

| 字段 | 含义 | 状态 |
|---|---|---|
| `provenance.ephemeris` | 星历的来源、精度；`status` 恒为 `ok` | ✅ |
| `provenance.terrain` | `terrain` 的来源与状态（`ok` / `unavailable`） | ✅ |
| `provenance.visibility` | `visibility` 的来源与状态 | ✅ |
| `provenance.yearStats` | `yearStats` 的来源与状态 | ✅ |
| `conventions` | 经度、方位角、高度角、时间、高度、时长等约定的文字说明，以及月球参考半径 | ✅ |

**精度**：星历约 0.02°（对照 JPL Horizons），适合可视化，不适合任务级规划。有效时间 2000-01-01 ~ 2100-01-01。

### 2.7 故意没放进接口的（定义还没定，不要猜）

- **L6"最长平均断电时间"、L7"平均单次信号时间"**：精确公式没定（TODO Q1），字段名和含义都没法定。定了再加。
- **关键日期**：FEATURE_SPEC 第 4 节有这个词，但没说是哪些日期。
- **基地参数与综合有效位置（L9）**、**通信要求的最小地球仰角**：这些是用户**输入**，不是点位输出，待 TODO Q2 定。

### 2.8 怎么把一个 ⬜ 字段变成 ✅

1. `pipeline/` 产出衍生数据，带 manifest（版本、来源、分辨率、处理参数，见 DATA_FLOW）。
2. 只改 `src/core/data/`：读数据、填值，把对应 `provenance.<组>.status` 改成 `ok`，写清来源和分辨率。`logic/`、`api/`、`mcp/`、网页**都不用动**。
3. 把本节对应行的 ⬜ 改成 ✅；PR 描述里写"改了哪些文档"。

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
| `get_point_conditions` | 一个点、一个时间的 `PointConditions`（参数同 `GET /api/point`）。字段清单见第 2 节 | 读 |
| `compare_points` | 多个点同一时间并排（参数同 `POST /api/compare`），每个点都是完整的 `PointConditions` | 读 |
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
