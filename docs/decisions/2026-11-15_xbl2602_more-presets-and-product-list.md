# 预设点位从 24 个补到 46 个（重点南极），产品页改读 `/api/presets`

2026-11-15 · xbl2602 提出，AI 协助调查和实现

## 要解决什么

xbl2602 要求"增加更多可用可看的预设点位，尤其是南极"。当时后端有 24 个预设，产品页的 Landing Sites 模式另外写死了 6 个（TODO Q8），两边不是同一份清单。

## 决定

1. **后端补 22 个点，总数 46 个。** 每个点的坐标都有出处，登记在 `docs/CREDITS.md` 第 5 节（不凭记忆写坐标）：
   - **南极着陆器 2 个**：IM-1 奥德修斯号（80.13°S）、IM-2 雅典娜号（84.79°S，目前最靠南的一次着陆）。出处是 NASA 和 LROC 的页面原文。
   - **其他着陆器 13 个**：SLIM、Blue Ghost 1，勘测者 1/3/5/6/7，月球 16/17/20/21/23/24。勘测者和月球号来自 LROC 2016 年坐标表。
   - **南极地名 7 个**：Shoemaker、Sverdrup、Henson、Wiechert、Kocher、Oberbeck、Scott（IAU 地名库中心点，**不是着陆目标**）。
2. **`Preset` 新增 `kind` 字段**：`landing-site`（着陆过的任务）或 `place`（地名中心点、原型观察点）。这是加字段，老用法不受影响。写进了 `docs/SHARED_INTERFACES.md`（`GET /api/presets` 一行）。
3. **产品页 Landing Sites 模式改读 `/api/presets`**（解决 TODO Q8）：
   - 列表分两组：**Missions**（`landing-site`，26 个）和 **Near the south pole**（`place`，20 个）。
   - 原来写死的 6 个任务的详细讲解（机构、日期、数据怎么看）保留，改成按预设 id 对应；其他点位直接用接口返回的描述。详情面板里可展开看"这个位置是哪来的"。
   - **地图上只画着陆过的任务**；南极地名全挤在极点附近，全画会叠成一团，所以只在选中某个地名时才画那一个。
   - 点地图选点改成"选最近的"（原来是方框内的第一个；新增点后阿波罗 11 号和勘测者 5 号只差约 25 km，方框第一个会让后者永远点不到）。

## 没收的

- **已计划但没公布精确着陆点的任务**：嫦娥七号（只说在沙克尔顿陨石坑边缘，没有官方坐标）、月船四号、月球 27、Griffin、Artemis III 候选区（TODO Q3 已记录：NASA 只给名单没给中心坐标）。**没有官方坐标就不写**。要把它们放进来，需要先找到官方公布的坐标。
- **着陆失败**：月球 25、月船二号、Hakuto-R、Beresheet。（IM-2 倒在一侧但有数据回传，算着陆。）
- 月球 9/13：LROC 的表里没有，也没找到别的核实过的出处。

## 要注意

- **中文名是按通行译法写的，没有对照官方译名表**（科歇尔、斯韦德鲁普、维歇特最不确定）。界面目前没有用到 `nameZh`，不影响显示，但 API 会返回，请懂的人校对。
- **AI 的预设卡片最多画 50 个**（`presetsVisualSchema`，`src/features/agent-search/ui/visual-data.ts`，louis068 的目录）。现在 46 个，再加要先放宽它；已加测试，超过 50 会失败。
- **LROC 的 PDF 直接抽文字会错行**，我按文字位置重建了表格，并用勘测者 3 号对阿波罗 12 号（约 160 m）、勘测者 5 号对阿波罗 11 号（约 25 km）做了独立核对，测试里有这两个检查。但这不是逐个点的核对：其他勘测者和月球号只有表格本身一个出处。
- 首页 console 背景里的"13 个月面基地"（`src/ui/landing/lunar-bases.ts`，取自维基百科）是另一份独立的清单，和这次的预设没有关联，没有对齐。
- 改了 `src/ui/product/`（夏娜）下的文件：新增 `modes/preset-sites.ts`、改 `modes/landing-sites-mode.tsx` 和 `lunar-quest-app.tsx`、删 `modes/historic-landing-sites.ts`。**需要告诉夏娜。**
- 首页 `mission-tools.tsx` 的"Preview API data"会显示"N landing sites"，其实包含了地名；这是原来就有的小问题，没有改（chanjy0806 的文件）。
