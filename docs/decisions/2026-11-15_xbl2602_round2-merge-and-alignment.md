# 第二轮整合：把 4 路新内容合进 main，并把 xbl2602 电脑上没上传的东西补齐

- **日期**：2026-11-15
- **提出人**：xbl2602（由 Claude 代为执行；xbl2602 要求"大合并和对齐，细细检查，不要再出现功能被删除的问题，确保每个人的东西，包括我电脑上的内容都能被完整上传"）
- **状态**：已采纳（本 PR 合并后生效）
- **需要谁确认**：ShanLe1224、chanjy0806、louis068（他们的内容在这次合并里被动过，见"影响"）

## 合进来的东西

| 来源 | 内容 | 有没有 PR |
|---|---|---|
| `ShanLe1224/product-site-panel-layout`（#49） | 选点比较流程、自适应地图细节、经验温度模型 | 有 |
| `chanjy0806/first-person-wall-fix` | 第一人称"墙"故障修复、真实地球和太阳、拍照按钮、测光曝光、轨迹线；产品页着陆点 25 个并分载人/无人 | **没有 PR**，直接推了分支 |
| `xbl2602/presets-more-polar`（#48） | 预设 24 → 46 个（重点南极），产品页改读 `/api/presets` | 有 |
| `louis068/docs-animated-title`（#47） | README 标题改回会动的绿色形状（本地 SVG） | 有 |

全部用"合并提交"，作者记录都在。louis068 的旧分支 `docs-project-readme` 只挑了一个文档提交（`946e878`，他的 README 审核稿和日志）；它的另一个提交（agent 地名库和多步比较）main 里早就有了，不重复合。

## 冲突和怎么处理（"功能不能丢"是这次的硬要求）

1. **`search-panel.tsx` 一行**：ShanLe1224 把 `onSaveSite` 改名为 `onCompareLocation`，chanjy0806 把搜索框占位文字改短。两边都留：用 ShanLe1224 的新名字 + chanjy0806 的占位文字。
2. **产品页着陆点清单（最麻烦的一处）**：#48 删掉了前端手写的 `historic-landing-sites.ts`，改读后端；chanjy0806 恰好在这个文件里加了 25 个任务、载人/无人分类、筛选框、颜色点、按日期排序。直接合会让他的功能消失。做法：
   - 以 #48 的"读 `/api/presets`"为骨架（坐标和出处都在后端，更扎实）；
   - chanjy0806 写的每个任务的介绍文字（19 个任务的日期、机构、一两句话、光照/通信特点）、载人/无人分类、"全部/载人/无人"筛选框（带数量）、列表和地图上的颜色点、按着陆日期排序，**全部搬进** `src/ui/product/modes/preset-sites.ts`，按预设 id 对应；
   - 他的 25 个任务里 23 个后端本来就有；缺的 **Luna 9、Luna 13 补进后端预设**（预设现在 48 个，AI 卡片上限 50）。这两个不在 LROC 坐标表里，坐标沿用他取自维基百科的值，`positionSource` 里写明"精度约 300 m、待复核"；
   - 检查：他旧文件里 125 个文字/日期/机构字段，逐条在新文件里找到，0 个缺失；新增一个测试（`preset-sites.test.cjs`）锁住"25 个都在、6 个载人正好是阿波罗、列表按日期排、介绍的 id 没写错"。
   - 小改动：筛选框第一项的字从 "All historical sites" 改成 "All sites"（因为现在列表里还有南极地名，不全是"历史着陆点"）；选载人或无人时，南极地名不显示。
3. **README（中英）**：取 louis068 的动画标题（这正是他 PR 的目的）。
4. **`docs/CREDITS.md`、`docs/logs/louis068/2026-11-15.md`、`2026-11-14.md`**：两边追加的内容都保留；louis068 的标题素材那一条放回他自己的"README 动画"小节下面。

## 检查"有没有东西被删"的办法

四个来源各自相对 main 新增/修改的每一行，逐个文件对到合并结果里：

- ShanLe1224：35 个文件，只有 1 行不同（上面第 1 条，有意的合并）。
- louis068：6 个文件，0 行缺失。
- chanjy0806：缺的行全部是被 #48 的改写取代的那几处（上面第 2 条，文字字段已逐条核对）。
- #48：缺的行是被合并版取代的 14 行。

另外查了 main 历史上所有被删过的文件：只有 chanjy0806 换素材时删的几张图和我自己 #35 重构删的一个文件，都是有意的。

## 找回来的东西

- **阿波罗 15 号哈德利全景图的 CREDITS 登记行**：图（`public/landing/apollo-15-hadley.webp`）还在用，登记行在早先合并时丢了（违反 AGENTS.md 第 11 节）。已从历史提交 `1b45eac` 找回。
- **xbl2602 电脑上没提交的改动**（都进了这次合并）：`AGENTS.md` 末尾 `next dev` 自动生成的 Next.js 提示块、`.gitignore` 里"竞品分析不公开"的规则（`docs/research/*competitor*`）、研究文档第 5 节的"已过期"说明。
- **只存在于电脑里的两样东西，存成存档分支推上 GitHub**（不合进 main，因为最终版本 main 里都有）：
  - `xbl2602/archive-data-source-seam-tests`：提交 `e05f65a`（"现状基线"测试和"防绕过"检查），它不在任何分支里，只躺在本机的 git 对象库；main 里这些测试文件后来重写过。
  - `xbl2602/archive-polar-highres-drafts`：`polar-highres` 工作树里没提交的旧稿（决定记录、日志、CREDITS、`.env.example` 的早期版本）。

## 没做/故意不做

- 没把 louis068 旧分支里"AI 回答不要输出 Markdown"那条提示词补回来：main 的提示词后来改成"支持加粗和小标题"，聊天框也会把回答渲染成带格式文字，补回来反而倒退。
- 没把竞品深度调研文件（`docs/research/*competitor*`）放进仓库，它们按 xbl2602 的规则只留在本机。
- `public/landing/lola-south-pole-640.bin` 在 CREDITS 里没有登记行，来历要问 chanjy0806（我不知道它是怎么生成的，不替他写）。
- 研究文档第 5 节新加的说明里，链接指向的 `2026-11-14_competitor-landscape.md` 是不公开文件，在 GitHub 上点不开（xbl2602 自己写的，按原样保留）。

## 影响（按 AGENTS.md 第 2 节要告诉被动了目录的人）

- **ShanLe1224**：`src/ui/product/` 里我改了 4 个文件：`modes/landing-sites-mode.tsx`、`modes/preset-sites.ts`、`lunar-quest-app.tsx`（解冲突）、`panels/search-panel.tsx`（一行）。
- **chanjy0806**：`historic-landing-sites.ts` 没了，内容搬进 `preset-sites.ts`；**以后改着陆点介绍文字去 `preset-sites.ts`，加新着陆点要先加到 `src/core/data/presets.ts`（找 xbl2602）**。Luna 9/13 的坐标请对一下官方来源。以后请**开 PR**，不要只推分支（这次第一人称分支就没有 PR）。
- **louis068**：#47 已合并；旧分支 `docs-project-readme` 的文档提交已挑进来；该分支本身不用再合。

## 怎么对齐（给每个人，大白话）

1. 先存好手上的东西：`git status`，有改动就 `git add <具体文件>` 再 `git commit`。**不要用 `git add .`。**
2. `git fetch origin`，然后**不要在旧分支上继续**，从最新 main 开新分支：`git switch -c <你的用户名>/<区域>-<新任务> origin/main`。
3. 旧分支里还没进 main 的提交，先问 xbl2602，别自己合。旧分支留着别删。

## 还没解决

- 产品页整月图层（Q10）、极区地图颜色（Q7）、louis068 在 Vercel 上没有权限所以他的 PR 预览显示失败（只有 xbl2602 能邀请）、GitHub 的 `main` 分支保护没开（只有 xbl2602 能开）。
- 第一人称在 9.00°N 67.91°E 的"墙"：chanjy0806 的 `first-person-wall-fix` 声称已修，**合并后在预览上看过没有**见本 PR 描述里的验证记录。
