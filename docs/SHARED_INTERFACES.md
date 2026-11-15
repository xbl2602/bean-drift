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

**设计原则：接口先留好，数据后接入。**（2026-11-14 起 `terrain`、`visibility`、`yearStats` 三组都已接入真实数据。）

1. 每一组参数（`terrain`、`visibility`、`yearStats`）**永远存在**，组里每个字段没有数据时为 `null`。调用方照着字段名写代码。
2. `null` 是什么意思，看这一组的 `provenance.<组>.status`：
   - `unavailable`：这类数据**没有**，所有字段都没算。目前只会在服务器读不到预计算数据文件时出现（接口仍返回 200，note 里说明），应当让用户稍后重试，而不是当成"这里没有地形"。
   - `ok`：已接入。此时某个字段为 `null` 表示"这个点、这段时间里没有这个量"（例如 60 天内没有日落，或坡向在平地上没有意义）。
3. 状态图例：✅ 已有真实数据 · ⬜ 接口已留，值恒为 `null`（等数据）。
4. 想知道"某个量到底有没有"，永远看 `provenance`，不要看字段是不是 `null` 就下结论（**`terrain.heightM: null` 不等于"这里没有高度"**，而是"这次没读到数据"）。

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

### 2.3 地形（`terrain`）✅

**有两份数据，按位置自动选**（2026-11-15 起，规则在 `src/core/data/terrain-source-routing.ts`，调用方不用管）：

| 位置 | 数据 | 格子 | 地平线 | `resolutionM` |
|---|---|---|---|---|
| 南纬 **80° 以南（含 80°）** 到极点 | LOLA 南极 DEM `LDEM_80S_40M`（40 m/像素）平均成 160 m 格子，`public/data/polar-v1/` | 160 m（极射赤面图上的米数；贴地实际长度在 80°S 处短约 0.8%） | **每个点现算**，90 个方位（间隔 4°），射线最远 300 km，走出 80°S 圈后接着用全月 0.25° 数据 | 160 |
| 其余所有位置 | LOLA 全月 DEM（473.8 m/像素），pipeline 平均成 0.25° 格子（约 7.6 km），`public/data/v1/` | 0.25° | 预计算，32 个方位（间隔 11.25°） | 7581 |

两份数据在 80°S 交界处不连续（格子大小不同，同一处读数会有差别）；返回的 `terrain.resolutionM` 和 `provenance.terrain` 写明这个点用了哪一份。**整月预计算地图（L4~L7）和 `find_sites` 仍然只用 0.25° 数据**，不受极区数据影响。决定和取舍见 [decisions/2026-11-15_xbl2602_polar-highres-data-and-routing.md](decisions/2026-11-15_xbl2602_polar-highres-data-and-routing.md)。

全月数据来自 LOLA 全月 DEM（473.8 m/像素），pipeline 平均到 0.25° 的地图格子（约 7.6 km），见 [decisions/2026-11-14_xbl2602_precomputed-terrain-and-year-stats.md](decisions/2026-11-14_xbl2602_precomputed-terrain-and-year-stats.md)。对应 FEATURE_SPEC 第 4 节参数卡的"高度、坡度、坡向、地平线剖面"和第 6 节"返回里说明来自多少米/像素的数据"。**0.25° 的分辨率是"整月概览"级别，不是着陆点尺度**；160 m 也不是——接口返回的 `provenance.terrain.note` 会如实写明。

| 字段 | 含义 | 单位 | 状态 |
|---|---|---|---|
| `terrain.heightM` | 海拔，相对 1737.4 km 参考球。在相邻 4 个格子间双线性插值（南极：160 m 格子的平均高度，源数据逐位核对过：随机 3156 个格子与 40 m 原始数据的 4×4 平均完全一致） | 米 | ✅ |
| `terrain.slopeDeg` | 坡度：格子内逐像素坡度的平均（全月：约 474 m 基线；南极：80 m 基线，以 0.25° 为单位存储），再在相邻格子间插值。**不是这个点本身的坡度，不能当着陆安全坡度用** | 度 | ✅ |
| `terrain.aspectDeg` | 坡向：下坡方向的方位角（正北 0°，向东增加），全月取最近格子；南极由该点两侧各 1 格（320 m 基线）的高度差现算。平地时为 `null`。极点上"北"没有意义，坡向仅作参考 | 度 | ✅ |
| `terrain.horizonProfile` | 地平线剖面：`[{ azimuthDeg, elevationDeg }]`，从正北起等间隔的方位，每个方位上地形挡住的仰角。**方位数不固定：全月 32 个（插值自 0.25° 格子，范围 −8°~32°），南极 90 个（该点现算，不限范围）**，用 `horizonProfile.length` 算间隔，不要写死 32。南极 160 m 取平均会抹掉很小的起伏：与直接用 40 m 数据现算相比，13 个典型点的地平线平均相差 0.45°，个别方位最多 5.6°（极点附近微地形） | 度 | ✅ |
| `terrain.resolutionM` | 上面这些值的格子边长：全月 7581 m（南北向；东西向随纬度缩小），南极 160 m。**用它判断这个点用了哪份数据** | 米 | ✅ |

### 2.4 地形遮挡后的可见性（`visibility`）✅

"此刻"太阳、地球有没有被地形挡住。用 2.3 的地平线剖面加星历现算。`visibility.sun` 和 `visibility.earth` **结构相同**：

| 字段 | 含义 | 单位 | 状态 |
|---|---|---|---|
| `visibility.<sun/earth>.diskVisibleFraction` | 圆盘有多大比例露在地形地平线之上（0 = 全挡住，1 = 全可见）。**"可见"定义为这个值 > 0，即圆盘上缘高于地平线**；把地平线近似成圆盘中心方位上的一条水平线 | 比例 0~1 | ✅ |
| `visibility.<sun/earth>.nextRiseUtc` | 下一次从地形地平线后升起（由不可见变可见）的时刻；往后最多找 60 天，找不到为 `null` | UTC ISO 8601 | ✅ |
| `visibility.<sun/earth>.nextSetUtc` | 下一次落到地形地平线之下（由可见变不可见）的时刻，同样最多找 60 天。对应参数卡的"距日落、距地球落下的剩余时间" | UTC ISO 8601 | ✅ |

### 2.5 一年统计（`yearStats`）✅

统计期默认是 **2030-01-01T00:00:00Z 起的 8760 小时（整年），逐小时取样**（TODO Q1 的决定，见上面的 decisions 文件）。**不随查询时刻 `time` 变**；想换起点，传 `statsStart`（见 2.5.3）。FEATURE_SPEC 术语：**断电** = 太阳被地形挡住的连续时段，**断信号** = 地球被地形挡住的连续时段。口径：圆盘上缘高于地形地平线算可见；被统计期首尾截断的时段按截断后的长度计入。`yearStats.sun` 和 `yearStats.earth` **结构相同**：

| 字段 | 含义 | 单位 | 状态 |
|---|---|---|---|
| `yearStats.periodStartUtc`、`yearStats.periodEndUtc` | 统计覆盖的时间范围（起点含、终点不含） | UTC ISO 8601 | ✅ |
| `yearStats.<sun/earth>.visibleFraction` | 统计期内可见的时间占比（太阳：日照比例；地球：地球可见比例） | 比例 0~1 | ✅ |
| `yearStats.<sun/earth>.longestOutageH` | 统计期内最长一次连续不可见（太阳：最长断电 L4；地球：最长断信号 L5）。从未可见 = 整个统计期 | 小时 | ✅ |
| `yearStats.<sun/earth>.meanOutageH` | 统计期内所有连续不可见时段的平均时长（L6"按次平均"）。从未不可见 = 0 | 小时 | ✅ |
| `yearStats.<sun/earth>.meanVisibleWindowH` | 统计期内所有连续可见时段的平均时长（L7"平均单次信号时间"，地球一栏）。从未可见 = 0 | 小时 | ✅ |
| `yearStats.<sun/earth>.visibleWindows` | 连续可见的窗口列表 `[{ startUtc, endUtc, durationH }]`（太阳：各月昼窗口）。一个点最多约几十条 | UTC、小时 | ✅ |
| `yearStats.bothVisibleFraction` | 统计期内太阳和地球**同时**可见的时间占比（和 `sun`、`earth` 并列，不在它们里面）。选址要两者都满足，这个比单看任一个更有说服力。整月地图里同名的一层 `bothFraction` 与它同口径 | 比例 0~1 | ✅ |

### 2.5.3 选填输入：统计期起点（`statsStart`）✅（2026-11-15）

默认的一年统计固定从 2030-01-01 起，但任务要的往往是"发射/着陆那一刻之后的一年"。**输入**（不是输出）：`GET /api/point`、`POST /api/compare`、`get_point_conditions`、`compare_points` 接受可选的 `statsStart`（UTC，ISO 8601，带 Z，例如 `2027-03-01T00:00:00Z`）。

- **不传 = 和以前完全一致**（2030-01-01 起），整月地图、`find_sites` 也仍然是这一年。**整月地图和 `find_sites` 不接受 `statsStart`**：它们是 pipeline 预先算好的静态文件，换年份要重跑 pipeline。
- 传了之后：统计期是 `statsStart` 起的 8760 小时（`yearStats.periodStartUtc` / `periodEndUtc` 就是它），规则不变。除 `yearStats` 和 `provenance.yearStats` 外，返回里其他字段不受影响；`provenance.yearStats.note` 会写明"起点是调用方选的"。
- 范围：`statsStart` 在 2000-01-01 到 2099-01-01 之间（起点加 8760 小时必须还在星历适用的 2000~2100 年内），否则返回 400。
- 星历精度在这个范围内都靠得住：对照 JPL Horizons，2005/2015/2026~2030/2035/2043/2060/2090 年的 8 个月面观测点，太阳和地球方向最大偏差 0.013°（自动测试 `src/core/ephemeris/tests/ephemeris-vs-horizons.test.cjs`）。
- `GET /api/timeline`、`POST /api/compare-dates` 暂不接受 `statsStart`（`compare-dates` 里每个点的 `yearStats` 仍是 2030 年那一年）。

### 2.5.2 选填假设：地球最低仰角（`minEarthElevationDeg`）✅

直连通信通常要求地球高过某个最低仰角。**输入**（不是输出）：`GET /api/point`、`POST /api/compare`、`get_point_conditions`、`compare_points`、`GET /api/timeline`、`POST /api/compare-dates` 以及对应 MCP 工具都接受可选的 `minEarthElevationDeg`（度，0~60）。

- **不传 = 只看地形**，结果和之前完全一致，也和整月地图一致（整月地图**不**带这个要求）。**不传和传 0 不一样**：地形地平线可以是负的（比光滑球面的水平线还低），传 0 会额外要求地球不低于球面水平线。
- 传了之后：地球要"上缘高于 max(地形地平线, 最低仰角)"才算可见，规则和原来"上缘高于地形地平线"一致，只是多了一条下限。**只影响地球，不影响太阳。** 影响 `visibility.earth`、`yearStats.earth`、`yearStats.bothVisibleFraction`，以及时间序列里的地球窗口。
- 返回里的 `assumptions.minEarthElevationDeg` 写明这次用了什么（`null` = 没加要求），`provenance` 的说明里也会多一句。
- 阈值本身没有官方来源（调研没有查到明确数值，见 `docs/research/`），所以**不设默认值**，由调用方自己选。

### 2.5.1 整月地图（给网页图层用，静态文件）

pipeline 把上面的统计对**整个月面每个 0.25° 格子**算好，放在 `public/data/v1/`，网页图层直接按静态文件取（不经过 API）。**格式以 `public/data/v1/manifest.json` 为准**（里面写了每个文件的名字、尺寸、缩放系数、来源和局限），这里只写要点：

- 网格：1440 列 × 720 行，每格 0.25°；第 0 行是北端（纬度 +90°），第 0 列是西端（经度 −180°）；每个文件都是同样的行主序排布，小端字节序。
- `stats-4ppd.u16`：7 个连续的 Uint16 平面，依次是：太阳日照比例、地球可见比例、两者同时可见比例（÷10000）；最长断电 L4、最长断信号 L5（小时）；平均断电时长 L6、平均地球可见窗口 L7（÷4 = 小时）。
- `height-4ppd.i16`（×0.5 = 米）、`slope-4ppd.u16`（÷100 = 度）、`aspect-4ppd.u16`（÷100 = 度，65535 = 无）、`horizon-4ppd.u8`（33 个平面：32 个方位各一层，方位 k × 11.25°，再加第 33 层 = 方位 360°（复制第 0 层，方便插值绕回）；字节值 ÷255 × 40 − 8 = 度）。
- 单个文件最大 34 MB（horizon），总计约 55 MB，随网站一起发布，不需要外部存储。
- 地图值以**格子中心**为代表点；点位接口 `yearStats` 以**查询点**为代表点（读邻近格子插值后的地平线），两者在格子中心处的差别实测小于 0.05%。

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

- **关键日期**：FEATURE_SPEC 第 4 节有这个词，但没说是哪些日期。
- **基地参数与综合有效位置（L9）**：这些是用户**输入**，不是点位输出，待 TODO Q2 定。（"通信要求的最小地球仰角"已作为选填输入做了，见 2.5.2；它的**默认值**仍没有来源，故不设。）

### 2.8 怎么把一个 ⬜ 字段变成 ✅

1. `pipeline/` 产出衍生数据，带 manifest（版本、来源、分辨率、处理参数，见 DATA_FLOW）。
2. 只改 `src/core/data/`：读数据、填值，把对应 `provenance.<组>.status` 改成 `ok`，写清来源和分辨率。`logic/`、`api/`、`mcp/`、网页**都不用动**。
3. 把本节对应行的 ⬜ 改成 ✅；PR 描述里写"改了哪些文档"。

## 3. REST 接口

全部只读、无状态。

| 方法 路径 | 参数 | 返回 |
|---|---|---|
| `GET /api/health` | — | `{ "status": "ok", "service": "bean-drift" }` |
| `GET /api/point` | query：`latDeg`（-90~90）、`lonDeg`（-180~360）、`time`（可选，默认现在）、`minEarthElevationDeg`（可选，见 2.5.2）、`statsStart`（可选，见 2.5.3） | `PointConditions` |
| `POST /api/compare` | JSON：`{ "points": [{ "latDeg", "lonDeg" }, ...1~10 个], "time"?: "...", "minEarthElevationDeg"?: n, "statsStart"?: "...Z" }` | `{ "timeUtc", "results": PointConditions[] }`，顺序与输入一致 |
| `GET /api/presets` | — | `{ "presets": Preset[] }`（`Preset` 见 `src/core/types.ts`） |
| `GET /api/timeline` | query：`latDeg`、`lonDeg`（必填）；`time`（起点，默认现在）、`durationH`（1~744，默认 720）、`stepMin`（曲线间隔，10~1440 分钟，默认约 144 个点）、`minEarthElevationDeg` | `PointTimeline`，见 3.1 |
| `POST /api/compare-dates` | JSON：`{ "points": [{ "latDeg", "lonDeg" }, ...1~5 个], "times": ["...Z", ...1~8 个], "minEarthElevationDeg"?: n }` | `{ "timesUtc", "points": PointAcrossTimes[], "provenance" }`，见 3.2 |
| `GET /api/energy` | query：`latDeg`、`lonDeg`（必填）；`time`（起点，默认现在）、`durationH`（1~8760，默认 720） | `SolarEnergyEstimate`，见 3.4 |
| `POST /api/find-sites` | JSON，条件都选填：`maxSlopeDeg`、`minSunVisibleFraction`、`minEarthVisibleFraction`、`minBothVisibleFraction`、`maxLongestSunOutageH`、`maxLongestEarthOutageH`、`latMinDeg`/`latMaxDeg`/`lonMinDeg`/`lonMaxDeg`（框，不能跨 180° 经线）、`rankBy`、`limit`（1~20，默认 10）、`minSeparationKm`（默认 50） | `FindSitesResult`，见 3.3 |

示例：

```
GET /api/point?latDeg=-89.71&lonDeg=62.5&time=2030-01-01T12:00:00Z
GET /api/timeline?latDeg=-89.71&lonDeg=62.5&time=2030-01-01T00:00:00Z&durationH=744&stepMin=360
POST /api/find-sites   { "maxSlopeDeg": 15, "maxLongestSunOutageH": 300, "latMaxDeg": -80, "limit": 5 }
```

### 3.1 时间序列（`PointTimeline`）

类型在 `src/core/data/point-timeline.ts`。一个点、一段时间（最长 744 小时 = 31 天，够一个月昼）里的变化。**"可见"的规则和 2.4、2.5 完全一致**（圆盘上缘高于有效地平线）。

| 字段 | 含义 | 单位 |
|---|---|---|
| `position`、`startUtc`、`endUtc`、`durationH`、`sampleStepMin` | 查询的点和时间范围；`sampleStepMin` 是曲线采样间隔 | 度、UTC、小时、分钟 |
| `assumptions.minEarthElevationDeg` | 同 2.5.2，`null` = 没加要求 | 度 |
| `sun`、`earth`、`both` | 各自（`both` = 太阳和地球同时）的汇总，结构相同：`visibleFraction`（这段时间里可见的占比）、`longestOutageH`（这段时间里最长一次连续不可见）、`windows`（连续可见的时间段 `[{ startUtc, endUtc, durationH }]`，被首尾截断的按截断后算） | 比例 0~1、小时、UTC |
| `samples` | 曲线：每个采样点 `{ timeUtc, sun: { azimuthDeg, elevationDeg, visible }, earth: { … } }`，最多 240 个。高度角是相对光滑球面的（和 2.2 一样），`visible` 是含地形遮挡的 | 度 |
| `provenance` | 来源与口径 | — |

窗口的起止时间用 10 分钟步长扫描、发现变化后二分到约 2 秒，和 `stepMin` 无关；**短于 10 分钟的窗口（取样之间升起又落下）会漏掉**。`stepMin` 太小会超过 240 个点，返回 400。读不到预计算地形数据时返回 500。

### 3.2 跨日期对比（`PointAcrossTimes`）

类型在 `src/core/data/point-snapshots.ts`。同一批点在几个不同时刻的对比（`compare_points` 是多个点、同一时刻；这个是同一个点、多个时刻）。地形和一年统计**和时刻无关**，每个点只给一次，每个时刻只给随时间变化的部分，所以比对每个时刻各调一次 `get_point_conditions` 小得多（实测：5 点 × 8 时刻约 16 KB，约 1.3 秒；时间序列 31 天、最多 240 个点约 42 KB）。

| 字段 | 含义 |
|---|---|
| `points[i].position` | 点（经度规范到 [-180, 180]） |
| `points[i].terrain` | `{ heightM, slopeDeg, aspectDeg, resolutionM }`，含义同 2.3 |
| `points[i].yearStats` | `{ periodStartUtc, periodEndUtc, sunVisibleFraction, earthVisibleFraction, bothVisibleFraction, longestSunOutageH, longestEarthOutageH }`，含义同 2.5，**固定是 2030 年那一年，不随 `times` 变** |
| `points[i].snapshots[j]` | 第 j 个时刻（与 `timesUtc[j]` 对应）：`{ timeUtc, sun, earth }`，`sun`/`earth` 都是 `{ azimuthDeg, elevationDeg, diskVisibleFraction, nextRiseUtc, nextSetUtc }`，含义同 2.2、2.4 |
| `points[i].assumptions` | 同 2.5.2 |

### 3.4 太阳能量估算（`SolarEnergyEstimate`）✅（2026-11-15）

类型在 `src/core/data/solar-energy.ts`。一个点、一段时间（最长 8760 小时 = 一年）里，**直射阳光**落在每平方米板子上的能量，以及最长黑夜要多少电池。可见规则和 3.1 一致（圆盘上缘高于地形地平线；圆盘只露出一部分时按露出的面积比例算）。

| 字段 | 含义 | 单位 |
|---|---|---|
| `position`、`startUtc`、`endUtc`、`durationH`、`sampleStepMin` | 查询的点和时间范围；≤744 小时用 10 分钟一步，更长用 30 分钟一步（实际步长为了整除时间段会有微小调整，以 `sampleStepMin` 为准） | 度、UTC、小时、分钟 |
| `energyWhPerM2` | 这段时间每平方米板子收到的能量，三种朝向：`sunTracking`（始终正对太阳）、`verticalTracking`（竖直放置、绕竖直轴转向太阳方位，南北极低太阳角时常见）、`horizontal`（水平放平；脚下视为水平地面，局部坡度忽略） | Wh/m² |
| `meanPowerWPerM2`、`peakPowerWPerM2` | 上面的能量除以时间长度；采样点里的最大瞬时功率 | W/m² |
| `sunVisibleFraction` | 太阳圆盘露出任何一部分的时间占比 | 比例 0~1 |
| `longestSunOutageH` | 最长一次连续看不到太阳 | 小时 |
| `batteryWhPerWForLongestOutage` | 靠电池撑过最长黑夜，每 1 W 恒定负载要多少 Wh（= 最长黑夜小时数；**不含**放电深度、电池效率、保温） | Wh/W |
| `assumptions` | `solarConstantWPerM2At1Au` = 1360.8（SORCE/TIM，Kopp & Lean 2011，按日地距离平方反比修正）；`panelEfficiency`、`dust` 为 `null` | — |
| `provenance` | 来源与口径，地形数据集跟着这个点用的数据走（0.25° 或南极 160 m） | — |

**这是"入射能量"，不是"发电量"**：不含板子效率、灰尘、衰减、温度、地形反射光。想知道发电量，自己乘上板子效率和面积。验证：赤道阿波罗 11 号点一个朔望月水平板的能量与"半个月白天、sin 形状"的理论值 307 kWh/m² 相差 3%（测试 `src/features/solar-energy/tests/`）。**这个功能已经加进 agent 窗口的白名单**（名单在 `src/features/agent-search/logic/run-agent.ts`，归 louis068），MCP 也可用。

### 3.3 按条件找位置（`FindSitesResult`）

类型在 `src/core/terrain/site-search.ts`、`src/core/data/site-search.ts`。在 2.5.1 的整月预计算地图里筛选，**每次请求读一遍文件（约 19 MB）现筛，约 0.2~0.4 秒**。

| 字段 | 含义 |
|---|---|
| `query` | 实际用上的条件（含默认值）；没写的条件 = 不限制 |
| `matchedCells`、`totalCells` | 满足全部条件的格子总数（不是返回条数）、地图格子总数（1,036,800） |
| `sites[]` | 最多 `limit` 个，按 `rankBy` 从好到差，彼此至少隔 `minSeparationKm`。每个：`latDeg`、`lonDeg`（**格子中心**，不是实测着陆点）、`heightM`、`slopeDeg`、`sunVisibleFraction`、`earthVisibleFraction`、`bothVisibleFraction`、`longestSunOutageH`、`longestEarthOutageH`、`meanSunOutageH`、`meanEarthWindowH` |
| `provenance` | 来源与口径 |

`rankBy`：`bothVisibleFraction`（默认）、`sunVisibleFraction`、`earthVisibleFraction`、`lowestSlope`。**没有格子满足条件时返回 200，`matchedCells` 为 0、`sites` 为空**（不是错误；例如当前数据里南纬 80° 以南最长断电最短的格子约 215 小时，要求 ≤ 120 小时就是空的）。口径局限：0.25° 格子（约 7.6 km）会抹平很小的"常亮峰"；地球一栏**没有最低仰角要求**（整月地图不带它），对通信偏乐观；坡度是格子平均，不是着陆安全坡度。用返回的位置再调 `get_point_conditions` / `get_point_timeline` 看细节——格子中心的值和单点查询是同一口径，实测完全一致。

## 4. MCP（Streamable HTTP）

- 地址：`POST /mcp`。无状态；不支持 `GET`（返回 405）；不支持 JSON-RPC 批量。
- 已实现方法：`initialize`、`ping`、`tools/list`、`tools/call`。
- 工具白名单：`src/core/registry.ts`。**全部只读**；目前没有任何写工具。参数错误按 MCP 约定作为工具执行错误（`isError: true`）返回，让模型能读到并改正。

| 工具名 | 说明 | 读/写 |
|---|---|---|
| `get_point_conditions` | 一个点、一个时间的 `PointConditions`（参数同 `GET /api/point`）。字段清单见第 2 节 | 读 |
| `compare_points` | 多个点同一时间并排（参数同 `POST /api/compare`），每个点都是完整的 `PointConditions` | 读 |
| `list_presets` | 预设点位清单 | 读 |
| `get_point_timeline` | 一个点一段时间里太阳/地球的曲线和可见时间段（参数同 `GET /api/timeline`），见 3.1 | 读 |
| `compare_dates` | 同一批点在几个时刻的对比（参数同 `POST /api/compare-dates`），见 3.2 | 读 |
| `find_sites` | 按条件在整个月面找位置（参数同 `POST /api/find-sites`），见 3.3 | 读 |
| `get_solar_energy_estimate` | 一个点一段时间能晒到多少太阳、最长黑夜要多少电池（参数同 `GET /api/energy`），见 3.4 | 读 |

**还没做的候选能力**：查询整月图层在某点/某区域的值（图层目前只作为静态文件给网页用）。

**怎么加一个新能力**（给 `louis068` 和他的 agent）：在 `src/features/<功能名>/` 下建 `logic/`（纯函数 + zod 输入 schema）、`api/`、`mcp/`，照 `src/features/point-conditions/` 抄；然后让 `xbl2602` 在 `src/core/registry.ts` 和 `app/api/` 各加一行。

## 5. 环境变量（登记处）

变量名和用途登记在仓库根目录的 `.env.example`（值留空）。新增变量先登记再使用。目前网页、API、MCP **不需要任何环境变量**；只有 agent 窗口（第 6 节）需要 `DEEPSEEK_API_KEY`，没配置时它返回 503，其余功能不受影响。

## 6. agent 窗口：`POST /api/agent`

实现在 `src/features/agent-search/`（负责人 `louis068`），路由接线在 `app/api/agent/route.ts`。它是 `/mcp` 同一套只读工具的自然语言入口：模型想查数据，只能调用下面列出的只读工具（共 7 个），结果原样放进 `sources`。

- **请求**：`Content-Type: application/json`，只允许 `{ "message": "..." }`，去掉首尾空白后 1~2000 字符，请求体不超过 8192 字节，未知字段直接拒绝。**没有对话历史**，每次要带齐地点和日期。
- **成功（200）**：`{ "answer": string, "sources": [{ "tool", "input", "result" }], "mode": "live", "model": "deepseek-flash" }`。`answer` 是纯文本，前端**不能**当 HTML 渲染。`sources` 是真正执行过的工具结果，外加可能出现的一条地名查找来源 `lunar_gazetteer`（见下面"地名来源"）；`sources` 为空表示这个回答没有经过数据验证，界面不能把它标成"已计算"；**只有 `lunar_gazetteer` 一条也不算"已计算"**，它只是 IAU 地名表的查找结果，没有算过任何光照或通信数据。
- **错误**：和其他接口一样是 `{ "error": { "code", "message" } }`。400 输入不对、405 不是 POST、413 请求太大、422 问题要的步骤太多、429 **限速**（有两个来源，前端只看状态码 429 就行，见下面"频率限制"）、502 模型或工具返回无效、503 没配置密钥或服务不可用、504 超时或被取消。前端显示错误，让用户**手动**重试，不要自动重发（每次重发都花钱）。
- **单次上限**：最多 4 次模型调用、8 次工具执行（回答带 `lunar_gazetteer` 来源时是 7 次，因为它占了"最多 8 条来源"里的 1 条）；模型每次输出最多 2400 tokens（2026-11-15 起，PR #22 从 1200 提高，为了多地点比较不被截断；每次调用花 `xbl2602` 的钱，最坏情况输出费用是原来的两倍，系统提示要求最终回答控制在 250 词以内（PR #26 起，原来是 400））；总超时 25 秒。
- **地名来源 `lunar_gazetteer`**（PR #26，`louis068`）：只有问题里写了**明确标注**的坐标（N/S E/W，或 lat / lon 字样）时才会有；它不是模型能调用的工具，是服务端自己用 IAU 地名表查的。结构沿用 `{ tool, input, result }`：`tool` 恒为 `"lunar_gazetteer"`，`input` 是 `{ coordinates: [{ latDeg, lonDeg }] }`，`result` 是 `{ locations: [{ queryCoord, nearbyFeatures }] }`，`nearbyFeatures` 每项有 `name`、`featureType`、`latDeg`、`lonDeg`、`diameterKm`、`distanceKm`、`withinFeatureRadius`。最多 4 个不重复的有效坐标，每个坐标最多 5 个附近地名；位置是 IAU 目录的中心点，不是撞击坑边缘，距离是月面球面距离；不含地形高度、地平线遮挡，也不是着陆安全判断。决定记录：`docs/decisions/2026-11-15_louis068_agent-nearby-map.md`。
- **可用工具**（代码里写死的只读白名单，`logic/run-agent.ts` 里的 `ALLOWED`）：`get_point_conditions`、`compare_points`、`list_presets`、`get_point_timeline`、`compare_dates`、`find_sites`、`get_solar_energy_estimate`，即 `registry.ts` 里的全部 7 个。**agent 专用的两条限制**（REST API 和 MCP 不受影响）：①`compare_points` 一次最多 **6 个点**（API/MCP 仍是 10 个）。原因：全月网格扫描里单个点的结果最大 9.9 KB（南纬 89.9°，一年有 40 个日照窗口），而 agent 单个工具结果上限是 65,536 字节；满 10 个点实测约 68.5 KB，按最大单点估算 8 个点也有约 79 KB，都会超限；6 个最大的点带 `minEarthElevationDeg` 实测 61,754 字节，在上限内。其余新工具都远低于上限（时间曲线最大实测约 26 KB，找位置 20 个结果约 6 KB，跨日期对比 5 点 × 8 时刻按最大单点估算约 20 KB）。②工具结果超过 65,536 字节时，不再让整个回答失败（原来是 502 `tool_error`），而是把 `result_too_large` 作为工具结果回给模型，让它用更少的点或更短的时段重问。决定记录：`docs/decisions/2026-11-14_xbl2602_agent-new-tools-and-compare-cap.md`。
- **密钥**：`DEEPSEEK_API_KEY`，仅服务端、每次请求时读取。网址和模型名（`deepseek-flash`）写死在代码里，不读环境变量。
- **频率限制**：每个访问者 IP 每分钟最多 20 次请求（固定窗口），在 Vercel 防火墙里执行，不在代码里。超出时**还没进到我们的代码**就被拦下，返回 `429`，body 形如 `{"error":{"code":"429","message":"Too Many Requests","id":"..."}}`（`code` 是字符串 `"429"`）。DeepSeek 自己限速时是我们的代码返回 429，`code` 为 `rate_limited`。**前端不要按 `code` 区分，统一按状态码 429 提示"请求太频繁，稍后再试"，不要自动重发。** 注意：同一个 IP（例如同一个展位的 Wi-Fi）的所有人共用这 20 次。它限的是速度不是总花费，细节和重建办法见 `docs/decisions/2026-11-14_xbl2602_agent-rate-limit.md`。

## 7. 首页过场动画 ↔ 产品页：地图就绪信号（浏览器里的 window 事件）

用途：从首页点进产品页时，像素漂移动画盖在最上面，产品页在它**后面**同时加载；动画要等产品页的第一幅地图真的画出来，才开走并揭幕，用户就不会在动画结束后又看到一次"Loading lunar maps…"遮罩。决定记录：`docs/decisions/2026-11-15_xbl2602_landing-to-product-handoff.md`。

- **事件名**：`lunar-quest:map-ready`，发在 `window` 上，不带数据。常量和两个小函数在 `src/lib/handoff/map-ready-signal.ts`（`announceMapReady()`、`onceMapReady(callback)`），两边都从那里取，**不要互相 import 对方目录**。
- **谁发**：产品页（`src/ui/product/use-announce-map-ready.ts`，在 `lunar-quest-app.tsx` 里调用一次）。第一次"加载完"（遮罩撤掉）**或出错**之后，再等两帧发一次（两帧是为了让第一幅月球画面已经画出去）。**出错也必须发**，否则车会一直停着等，直到用户点一下跳过。
- **谁收**：过场动画（`src/ui/landing/product-transition.tsx`，挂在根布局 `app/layout.tsx`，所以换路由时它不会被卸载）。时间安排在 `src/ui/landing/handoff-timing.ts`，**没有任何写死的秒数**：车停稳时打开产品页；车要离场时如果事件还没来，车就停在原地等（多久都等，用户可以点一下跳过）；事件来了才开走；车开走后揭幕。
- **改产品页启动流程的人要知道**：以后如果"第一幅地图画好"的时刻变了（比如换成别的加载方式），只要保证上面这个事件在合适的时刻发出，首页动画不用改。没有这个事件，车会一直停着等，直到用户点一下跳过。


### Steep-slope search extension (2026-11-15)

User-authorized shared change: find_sites now accepts optional minSlopeDeg (inclusive, 0–90 degrees), combined with maxSlopeDeg; min greater than max is invalid. rankBy highestSlope orders cell-average slopes descending, with descending grid index for ties. Defaults, geographic filters, separation and limits are unchanged. Applies to REST, MCP and agent through the shared schema. This is coarse-grid screening, not a physical cliff maximum.
