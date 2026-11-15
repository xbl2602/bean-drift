# 产品页分成三个模式（Landing Sites / Explore / Find Data），默认 3D

- 日期：2026-11-15
- 提议人：ShanLe1224（product page 负责人）
- 状态：已在 product page 实现（分支 `ShanLe1224/product-site-panel-layout`），**请 xbl2602 确认**，特别是第 3 点和 TODO Q3 的关系
- 只改了 `src/ui/product/`，没有动 `src/core/` 和任何共享接口

## 1. 改了什么

产品页顶部正中加了一个三选一的模式开关：

| 模式 | 做什么 | 数据从哪来 |
|---|---|---|
| **Landing Sites** | 列出真实着陆过的任务，点一个，地球仪转过去，右边讲解这个任务 + 这个位置的数据（第一人称照片、模型数值、考虑地形的太阳/地球可见性） | 坐标见第 3 点；地形可见性走 `/api/point` |
| **Explore**（默认） | 之前的全部功能：地图、左边工具栏、所有工具 | 不变 |
| **Find Data** | 输入地名或经纬度（或直接点地图），马上出这个位置的完整数据，可以下载 JSON | 地名用已有的 IAU 地名表；数据走 `/api/point` 和前端模型 |

## 2. 默认地图改成 3D

操作者要求进入 Explore 就是 3D 地球仪（以前默认 2D 展开图）。2D 仍可在右上角切换。Home 重置后也回到 3D。

## 3. 着陆点的坐标：用 IAU 官方的 "Statio" 着陆站名（和 TODO Q3 有关，请确认）

TODO Q3 说预设点要"有出处的坐标，不能凭记忆"。这个模式**没有手写任何坐标**：运行时从已经登记在 CREDITS 的 IAU 地名表（`public/product/moon/lunar-names.json`）里，按名字取 IAU 专门批准给着陆点的 6 个 "Statio" 条目：

- Statio Tranquillitatis（Apollo 11）、Guang Han Gong（嫦娥三号）、Statio Tianhe（嫦娥四号）、Statio Tianchuan（嫦娥五号）、Statio Shiv Shakti（月船三号）、Statio Tianjiang（嫦娥六号）

前端只写了每个任务的简短说明（任务名、机构、着陆日期、一两句话），在 `src/ui/product/modes/historic-landing-sites.ts`。

**请 xbl2602 决定**：
1. 这 6 个点和它们的出处，能不能当作 Q3 的一部分答案，加进 `src/core/data/presets.ts`（这样 API / MCP / AI 窗口也能用同一份）？加进去之后前端可以改成读 `/api/presets`。
2. 地名表里没有 Statio 名的历史着陆点（Luna、Surveyor、其他 Apollo 等）要不要补、从哪找出处。

