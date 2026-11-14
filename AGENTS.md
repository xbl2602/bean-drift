# 项目 AI 协作规范（AGENTS.md）

这份文件是**所有 AI 编程工具的统一规则入口**。团队 5 人分别在用 Claude Code、OpenCode、ChatGPT/Codex、DeepSeek harness，这些工具都会读本文件（Claude Code 通过 `CLAUDE.md` 里的 `@AGENTS.md` 引入，内容只此一份，**不要在 CLAUDE.md 里另写规则**）。

它是**约束性执行规范**，不是背景介绍：下面每条都要在动手时真正遵守。给人看的分工和上手流程在 [docs/TEAM_HANDBOOK.md](docs/TEAM_HANDBOOK.md)，文档总目录在 [docs/README.md](docs/README.md)。

> **文档怎么用（必读）**：每个新任务开始前先 `git pull`，再按**第 14 节**"文档地图"读你这个任务相关的文档；做完任务后，按第 14 节检查**有没有文档需要同步更新**。文档和代码不一致，就是 bug。

> 改动本文件的权限：只有 `xbl2602`（架构负责人兼项目经理）或经他同意的 PR 才能改。其他人发现规则有问题，写进 `docs/decisions/` 提议，不要直接改。

---

## 1. 项目是什么

**Lunar Landing Site Navigator**：NASA Space Apps Challenge（吉隆坡站）赛题 *Lunar Landing Site Navigator*（CLPS）的参赛作品。一个让任务规划者、教育者、公众都能**快速比较月面任意位置、任意日期的光照（发电）与对地通信条件**的网站。

- 比赛时长 48 小时，提交物是**最长 30 秒的视频**加在线作品。评委只看到前端。
- **起点是已有基础，不是从零开始**：规则（本文件）、文档体系、`src/core` 与示例功能（API/MCP 骨架）、`prototypes/` 沿用自此前的演练仓库，不是现场新写的。对外说明（视频、提交文档）时如实标注哪些是已有基础。官方 FAQ 有"赛前不得开始做挑战"一条，沿用是否需要向组织者确认，见 [docs/DECISION_LOG.md](docs/DECISION_LOG.md) D-0008 和 [docs/TODO.md](docs/TODO.md) Q6。
- 作品形态：用户先看到 landing page，再进入 product page。product page 的核心是**整个月面的二维展开图**加时间轴，叠加多种图层，点击任意位置看完整参数，可切第一人称视角，可多点对比，有自然语言 agent 窗口。同一套能力还通过 **API** 和 **MCP** 对外提供。
- 完整功能清单见 [docs/FEATURE_SPEC.md](docs/FEATURE_SPEC.md)；背景和技术调研见 [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md)；已做出的决定见 [docs/DECISION_LOG.md](docs/DECISION_LOG.md)。

**事实来源的用法**：`docs/meetings/` 里的会议记录、`docs/PROJECT_CONTEXT.md`、`docs/FEATURE_SPEC.md` 都**可能过期，也可能互相矛盾，没有固定的优先顺序**。遇到矛盾，不要自己挑一个当真，**列出矛盾点问 `xbl2602`**，确定后写进 DECISION_LOG。

## 2. 团队与目录归属（隔离的基础）

5 人，每个人还可能同时开多个 agent。**防冲突的第一原则：一个文件夹只有一个负责人，谁的 agent 只改谁的文件夹。**

**先确认你在替谁干活（身份文件 `IDENTITY.md`）。** 这份规则 5 个人共用，所以 agent 必须知道操作者是谁，才能套用下面的归属表。每个 agent 开工前先读仓库根目录的 `IDENTITY.md`：

- 它是**本机文件**，已写进 `.gitignore`：**不提交、不公开**。里面写操作者的 GitHub 用户名、角色、负责的目录。模板是 [IDENTITY.example.md](IDENTITY.example.md)（这个模板会提交）。
- **没有 `IDENTITY.md`**：先问操作者"你是谁、负责哪个目录"，让他对照下表确认，再按模板帮他建一个。**不要自己猜**。
- 操作者让你改**不在他负责范围内**的文件：停下来，告诉他去找该目录的负责人（共用区找 `xbl2602`）。
- **绝不提交 `IDENTITY.md`**；里面也不要写密钥、密码、邮箱、手机号、真实姓名——它是给 agent 看的本机说明，不是档案。

| 负责人（GitHub） | 角色 | 拥有的目录 |
|---|---|---|
| `xbl2602` | 后端主架构 + 项目经理 | `src/core/`、`src/lib/`、`pipeline/`、`app/api/`、`app/mcp/`、`Dockerfile`、`docker-compose.yml`、部署与配置文件、`AGENTS.md`、`docs/` 里除个人日志外的所有共享文档 |
| `louis068`（Bean） | 后端：各类小功能 | `src/features/<功能名>/`（每个小功能一个文件夹，由 `xbl2602` 分配） |
| `chanjy0806` | 前端：landing page | `app/(landing)/`、`src/ui/landing/`、`public/landing/` |
| `ShanLe1224` | 前端：product page | `app/(product)/`、`src/ui/product/`、`public/product/`、渲染引擎相关代码 |
| `leeziqi0531-debug` | pitch 视频 + 打杂 | `pitch/`（脚本、分镜、素材清单）、`docs/CREDITS.md` 的素材部分、`docs/logs/leeziqi0531-debug/` |

> 角色和用户名的对应以 `xbl2602` 的口头为准，有出入请本人说出来，并更新此表。
> 上表里 `src/ui/`、`public/landing/`、`public/product/`、`pipeline/`、`pitch/`、`src/lib/llm/` 等目录**还没有创建**（见第 12 节"现状与目录"）。负责人第一次创建时，按本表放。
> 同一份归属写进了 `.github/CODEOWNERS`：在 GitHub 给 `main` 开分支保护并勾选 "Require review from Code Owners" 后，改到别人的目录会自动要求对方审核（规则本身仍以本节为准）。

**隔离规则（每个 agent 都必须遵守）**

1. **只改自己负责的目录。** 需要别人目录里的东西：先看 `docs/SHARED_INTERFACES.md` 有没有约定好的接口；没有就在 `docs/decisions/` 提议加一条，**不要直接改、也不要 import 别人目录里的内部实现**。
2. **共用区**（`src/core/`、`src/lib/`、`docs/SHARED_INTERFACES.md`、`docs/DECISION_LOG.md`、`docs/TODO.md`、`AGENTS.md`）只有 `xbl2602` 改。其他人的 agent 需要改动时，**停下来告诉操作者去找 `xbl2602`**，不要"顺手改一下"。
3. **同一个人开多个 agent：每个 agent 一个分支、一个独立工作目录（git worktree），改不同的文件。** 两个 agent 绝不改同一个文件。做法见 [docs/GIT_GUIDE.md](docs/GIT_GUIDE.md)。
4. **命名按"这是什么"，不按"谁写的"。** 文件夹和文件用英文 kebab-case（`power-outage-layer`），禁止 `utils.ts`、`helpers.ts`、`temp`、`test2`、`new`、`final`、`backup` 这类看不出内容的名字；也不要在名字里带日期或人名（日期用在 `docs/decisions/` 和 `docs/logs/` 里，那是约定好的）。
5. **新增共享记录一律"一条一个文件"，不要往同一个文件里追加。** 决定写 `docs/decisions/YYYY-MM-DD_<github用户名>_<主题>.md`，个人日志写 `docs/logs/<github用户名>/YYYY-MM-DD.md`。这样 5 个人同时写永远不会改到同一个文件，`xbl2602` 定期把决定整理进 `docs/DECISION_LOG.md`。
6. **提交时只加具体路径**：`git add <文件或目录>`。**禁止 `git add .` / `git add -A`**——它会把别的 agent、别的人留在同一目录里的半成品一起提交。
7. **不要顺手改名、搬家、重排格式、批量替换**不属于你任务的文件。大范围整理必须先问 `xbl2602`。
8. 分支命名：`<github用户名>/<区域>-<简短任务>`，如 `chanjy0806/landing-hero-section`。提交信息以 `[区域]` 开头，如 `[landing] 做好首屏标题动画`。

## 3. 优先级（冲突时按这个排）

1. **视觉冲击力和核心地图体验**：前端做不好，后端再好也没用。画面和交互是评委唯一直接看到的东西。
2. **API 和 MCP**：同一套能力，除了网页还能被程序和 AI agent 调用。
3. **多种部署方式**：Docker、本地安装、Vercel，零环境依赖、零污染。
4. 简易版：**不做**，只做完整版（时间有限，打磨完整版）。

后面的"架构规则"是为了**多人并发时代码仍然可控、可维护**，是底层规则，不是为了炫技，也不能拿来拖慢第 1 条。

## 4. 密钥与敏感信息（最高优先级，一条都不能破）

团队用 DeepSeek API 驱动网站里的 agent 窗口，**这个 key 只有 `xbl2602` 持有，用户不能自己填 key。** 规则：

1. **任何密钥、令牌、密码都不得出现在仓库里**——代码、文档、注释、截图、日志、提交信息、PR 描述、聊天记录粘贴的内容，一律不行。包括"先临时写死测一下"。
2. **线上的密钥只放在 Vercel 的环境变量里**（Vercel 后台 → 项目 → Settings → Environment Variables）。本地开发用 `.env.local`，已被 `.gitignore` 忽略；仓库里只有 `.env.example`，**只列变量名和用途，值留空**。
3. **AI agent 禁止**：读取、打印、复述、索取任何真实密钥；打开 `.env*`（`.env.example` 除外）；把密钥传给任何外部服务。需要密钥时，告诉操作者"请你自己在 Vercel 后台/`.env.local` 里配置变量 `XXX`"，由人去做。
4. **密钥只能在服务端代码里读**。禁止加 `NEXT_PUBLIC_` 前缀（带这个前缀的变量会被打包进浏览器，等于公开）。DeepSeek 调用只能写在服务端路由里，前端只能调用我们自己的 `/api/...`。
5. agent 窗口是公开可访问的，**每次调用花的是 `xbl2602` 的钱**：agent 接口必须有请求频率限制和单次长度上限，且只能调用白名单里的只读能力（见第 6 节）。
6. 提交前自检：`git diff --cached` 里搜一下 `key`、`token`、`secret`、`sk-`、`Bearer`。如果不小心提交过密钥，**立刻告诉 `xbl2602` 去作废这个密钥**——光删文件没用，git 历史里还在。
7. Supabase：`anon` key 可以公开（但前提是表开了行级安全 RLS）；`service_role` key 等同于管理员，只能放服务端环境变量，规则同上。

## 5. 架构规则（为了多人并发时仍然可控）

### 5.1 一切功能都是自包含的"功能模块"

核心（core）只放最小公共骨架，其余都是各自文件夹里的功能模块。每个功能模块内部分层：

```
src/features/<功能名>/
  logic/    纯业务函数：输入输出明确，不依赖 HTTP / Next.js / MCP 的运行环境，方便被复用和测试
  api/      很薄一层：解析 HTTP 请求 → 调用 logic → 包装响应
  mcp/      很薄一层：定义 MCP 工具（名字、参数 schema、描述）→ 调用 logic
  ui/       网页组件（需要界面才有）
```

**同一套能力不写三遍**：网页、API、MCP、agent 窗口调用的是同一份 `logic/`。`src/core/` 里只做汇总注册，不放任何具体业务逻辑。

### 5.2 受管控的数据流

数据只能**单向、按固定入口**流动，详见 [docs/DATA_FLOW.md](docs/DATA_FLOW.md)，要点：

```
原始数据（NASA）→ pipeline 预计算（xbl2602 的个人电脑）→ 衍生数据（静态文件，带版本和元数据）
                                   → 统一数据接口（src/core）→ API / MCP / agent 工具 / 网页
```

- **前端不直接读原始数据，也不自己重复实现星历、地平线计算**；一律通过统一接口拿数据。
- **所有对外返回的数值都带单位、坐标系和数据来源**（单位和坐标约定见 DATA_FLOW.md），不允许出现"这个数是米还是千米"要猜的情况。
- 跨模块的数据结构、接口、环境变量名，先写进 `docs/SHARED_INTERFACES.md`（由 `xbl2602` 维护），再写代码。
- 在**边界处校验输入**（API 入口、MCP 入口、agent 工具入口），不信任来自浏览器和 AI 的任何参数。

### 5.3 接入方式与部署

- **MCP 用 HTTP/SSE（streamable HTTP），不用 stdio**：这样同一个部署地址同时服务网页、API、MCP。
- 部署要支持：**Vercel（线上主线）、Docker、本地安装**，一份代码三种跑法。目前**不需要真的部署到 Vercel**，但写代码时不能做出"离开 Vercel 就跑不了"的东西。
- **零环境依赖和零污染**：用户机器上不应要求预装一堆东西、也不应被安装脚本改乱系统。Docker 是首选；本地安装要写清楚装了什么、装在哪、怎么完全卸载。
- 禁止用 Vercel 专属特性（Edge Runtime 专属 API、Vercel KV 等），用标准 Next.js API 加 Supabase 官方 SDK。
- 所有配置走环境变量，在 `.env.example` 里登记。
- 服务器代码**禁止用模块级可变变量存状态**（Vercel 上同一项目会有多个实例并发）；需要共享的状态进 Supabase，其余用请求内的局部变量。API 和 MCP 路由保持无状态。
- 批量处理要**有上限的并发**，且**单条失败不拖垮整批**。

### 5.4 技术栈（采纳自 D-0001，见 DECISION_LOG）

- 网站：**Next.js（App Router）+ Tailwind**；3D 和地图渲染用 **three.js**（已有原型 `prototypes/lunar-scene-demo/`，作为参考，不是产品代码）；后端数据库用 **Supabase**；线上部署 **Vercel**。
- agent 窗口的 LLM：**只接 DeepSeek**（OpenAI 兼容协议），统一封装在 `src/lib/llm/`，业务代码不直接 import 某家 SDK。
- 重计算（地平线、全月遮挡、一年光照统计）在 `xbl2602` 的个人电脑上跑，产出静态文件；VPS 性能有限，只做辅助（见 D-0006）。
- 语言：默认 TypeScript；数据预处理允许 Python（放 `pipeline/`，通过文件交接，不直接被网页调用）。

## 6. agent 窗口与 MCP 的权限边界

- agent 窗口和对外 MCP 只能调用**白名单工具**，且默认**只读**（查询地形、光照、通信窗口、对比位置）。
- 任何会写数据、改配置的工具，必须显式声明为写操作并经 `xbl2602` 批准；没声明的一律按"需要授权"处理。
- agent 窗口不得直接访问数据库或文件系统，只能走同一套 `logic/`。
- 错误信息要让人看得懂，但**不透传上游原文**（上游报错里可能有密钥片段或内部路径）。

## 7. 代码质量红线

1. **禁止 God 文件**：一个文件不能同时装路由、业务逻辑、数据库、UI。长度超过约 300 行是该拆分的信号。
2. **每个函数只做一件事**，名字说清楚它做什么，不要用 `handleData`、`process` 这类名字。
3. **外部调用必须有错误处理**（LLM、数据库、文件解析、网络），出错要给用户看得懂的提示，不能整个页面崩掉没有反馈。
4. 视觉和渲染相关代码：每改一次都要**截图看结果**（见 [docs/AI_PLAYBOOK.md](docs/AI_PLAYBOOK.md)），不能"闭着眼睛写着色器"。
5. 物理量必须带单位：变量名或类型里体现（`heightM`、`elevationDeg`、`durationH`）。
6. **可以为已经规划好的需求预先设计接口**（比如先搭好接缝、先定好数据格式），不必等到第二个使用者出现才动手。接口照常先写进 [docs/SHARED_INTERFACES.md](docs/SHARED_INTERFACES.md)，再写代码（见 5.2）。**已有代码的结构必须干净、模块化**，简单不等于潦草。

## 8. 调试规范（禁止打补丁式 debug）

**遇到 bug 必须找到并修复根本原因。** 以下都算打补丁，禁止：吞掉报错不处理；加针对性 `if` 绕开某个场景而不搞清为什么会出现；失败就无脑重试或加延时；硬编码让测试通过；只改症状所在那一行而不检查上游是不是传错了数据。

做法：先搞清真正原因 → 修根源（根源在别的模块就指出来，需要时改接口约定）→ **用大白话告诉操作者：为什么会坏、这次怎么修的** → 实在定位不到，就如实说"目前只是绕过，没有根治"，不要悄悄打补丁然后说修好了。

## 9. 给 AI 的通用规则

1. **操作者大多是编程新手**（5 人里只有 1 人有 AI agent 经验，4 人没用过 AI agent，也没用过 GitHub）。解释关键决定用大白话，术语第一次出现要解释；被问"这段在干嘛"要能讲清楚；**不要预设对方看懂了**。降低对新手的要求，不等于降低作品质量。
2. **开始改动前，先用一句话说明打算改哪些文件/目录**，确认都在操作者负责的范围内再动手。
3. **改动尽量小、尽量能独立运行**，方便频繁 commit/push。不要一次生成一大坨没验证的代码。
4. **不确定题目要求或产品方向时直接问**，不要替人猜着做决定。
5. 做出"为什么这样做"的**重要决定**（换技术、改架构、改规则、改范围），写一条 `docs/decisions/` 记录；做完一块有意义的工作，在自己的 `docs/logs/<用户名>/` 留一句话记录（做了什么、为什么、没做完的是什么）。
6. 每完成一个能运行的小功能，提醒操作者可以 push 了。
7. 提交信息用简单直白的话，开头带 `[区域]`。
8. 报告结果要老实：测试没过就说没过并附输出；跳过的步骤要说跳过了；没验证的不要写成"已完成"。

## 10. Git 规则与安全

- `main` 分支必须随时保持"能跑起来"。**不要直接推 `main`**，一律走分支加 PR（流程见 [docs/GIT_GUIDE.md](docs/GIT_GUIDE.md)，每步都有说明）。
- 小步高频提交，不要攒一整天。
- **禁止在没有明确、具体确认的情况下运行任何破坏性 git 命令**：`git reset --hard`、`git checkout -- .`、`git clean -f`、`git push --force`、`git branch -D`。操作者说"清理一下""重置一下"这类模糊话时，**先问清楚**：是想撤销还没提交的改动，还是回退到某次提交？会丢什么？
- 开始较大改动前，提醒操作者先 commit 一次留个回退点。
- 合并冲突：**停下来**，把冲突的文件和两边各自的意图讲清楚，找 `xbl2602` 决定。不要静默地二选一，不要自己丢掉某一方的改动。
- 大文件：单个文件超过 50 MB 不要进 git（GitHub 100 MB 硬上限）。原始 NASA 数据放 `data/raw/`（已忽略），只提交能重新生成它们的脚本，以及标签文件。

## 11. 素材、数据与版权（比赛规则）

吉隆坡说明会明确：**不能用有版权的素材；AI 生成内容可以用，但必须标明；用 NASA 数据有加分，要在视频里说明。**

- 新增任何**外部素材**（图片、字体、音乐、模型、视频）或 **AI 生成内容**，当场记进 [docs/CREDITS.md](docs/CREDITS.md)：来源、许可、是否 AI 生成、用的提示词。没有记录的素材不得进最终作品。
- 新增任何**数据源**，同样记进 CREDITS.md（来源链接、分辨率、处理方式）。
- 不要从 YouTube、网络图库随手拿图。拿不准的先别用，问 `leeziqi0531-debug` 或 `xbl2602`。

## 12. 现状与目录

**现在仓库里实际存在的：**

```
AGENTS.md  CLAUDE.md  README.md  .env.example  .gitignore  IDENTITY.example.md（身份文件模板；每人自己的 IDENTITY.md 只在本机，已被忽略）
package.json  next.config.ts  tsconfig.json  Dockerfile  docker-compose.yml   Next.js 项目（名字 bean-drift）
app/                      layout、(landing)/ 占位页、(product)/product/ 占位页、api/（health、point、compare、presets）、mcp/
src/core/                 类型、星历、统一数据接口、工具注册表、MCP 服务
src/lib/shared/           输入校验与 HTTP 响应小工具
src/features/             point-conditions、compare-points、presets（新功能照这三个抄）
docs/                     所有文档（索引见 docs/README.md）
.github/                  CODEOWNERS（目录归属）、PR 模板、CI（类型检查 + 构建）
prototypes/lunar-scene-demo/   现有的 three.js 原型（南极和阿波罗 11 号第一人称场景、真实 LOLA/LROC 地形、真实星历）
prototypes/landing-page-demo/、landing-page-v2/   landing page 的两版视觉原型（参考用，产品页在 app/(landing)/）
```

运行产品：`npm install` 后 `npm run dev`，详见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。运行原型：先在 `prototypes/lunar-scene-demo/` 里 `npm install`，再在**该目录里**执行 `python serve.py 5191`，浏览器打开 `http://localhost:5191/`。原始 NASA 数据文件（`.JP2`、`.TIF`）不在 git 里，重新下载的地址见 `docs/PROJECT_CONTEXT.md`。

**目标结构里还没创建的部分（由对应负责人按第 2 节的归属创建）：**

```
src/lib/llm/        DeepSeek 封装（做 agent 窗口时再建）
src/ui/{landing,product}/   前端组件（landing / product 负责人建）
public/{landing,product}/   前端静态资源
pipeline/           数据预计算脚本（从原型的 tools/ 迁移而来）
pitch/              视频脚本、分镜、素材清单
```

## 13. 时间不够时的砍法（从下往上砍，不要砍上面的）

1. product page 的核心体验：整月二维图 + 时间轴 + 点击出参数 + 第一人称视角——**绝对不能砍**
2. landing page 与 30 秒 pitch 视频（评审只看这两样加作品）
3. 更多图层（断电/断信号统计图、综合有效位置图）
4. 多点对比
5. API
6. MCP 与 agent 窗口
7. Docker 与本地安装
8. 预设航天器着陆点的补全

## 14. 文档地图：什么时候读、什么时候更新、谁来更新

文档只有被读到、被更新，才有用。**文档总目录和各文档简介在 [docs/README.md](docs/README.md)，本节规定"何时读、何时改"。**

### 14.1 每个新任务开始前（所有 agent，按顺序）

1. `git pull`，确保拿到最新的文档和决定。
2. 读本文件（工具会自动载入），再读 `IDENTITY.md` 确认操作者是谁、负责哪些目录（没有就按第 2 节先建）。
3. 读 [docs/TODO.md](docs/TODO.md) 的"待决问题"：你的任务**是否碰到还没拍板的问题**？碰到了就**停下来问 `xbl2602`**，不要自己挑一个答案往下做。
4. 看 `docs/decisions/` 里**最近几天**新增的文件：别人刚做的决定可能影响你。
5. 再按下表读与你任务相关的那几份（**不用全读**，读相关的）。

### 14.2 按场景读什么

| 你要做的事 | 先读 |
|---|---|
| 搞清楚"我们要做什么功能"、图层、交互、指标 | [docs/FEATURE_SPEC.md](docs/FEATURE_SPEC.md) |
| 决定新代码放哪个目录、怎么分层 | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) + 本文件第 2、5 节 |
| 处理数据、单位、坐标、时间 | [docs/DATA_FLOW.md](docs/DATA_FLOW.md) |
| 调用或提供跨模块接口、MCP 工具、API；新增环境变量 | [docs/SHARED_INTERFACES.md](docs/SHARED_INTERFACES.md)、`.env.example` |
| 做画面、渲染、视觉调参 | [docs/AI_PLAYBOOK.md](docs/AI_PLAYBOOK.md)、[prototypes/README.md](prototypes/README.md) |
| 了解赛题背景、技术调研、原型实测结论 | [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) |
| 查比赛规则（视频、版权、AI 标注、数据加分） | `docs/meetings/kl-briefing_summary.md` |
| 用到外部素材、新数据源、AI 生成内容 | [docs/CREDITS.md](docs/CREDITS.md) |
| 想知道"当初为什么这么定"、或想改已定的东西 | [docs/DECISION_LOG.md](docs/DECISION_LOG.md) + `docs/decisions/` |
| 做 git 操作、开多个 agent 并发 | [docs/GIT_GUIDE.md](docs/GIT_GUIDE.md) |
| 向新手解释流程、分工、卡住了找谁 | [docs/TEAM_HANDBOOK.md](docs/TEAM_HANDBOOK.md) |
| 回顾发生过什么 | [docs/HISTORY.md](docs/HISTORY.md) |
| 了解会议上说了什么 | `docs/meetings/`（都是转写或摘要，可能有误） |

### 14.3 做完任务后：什么变化要更新什么

| 发生了什么 | 要更新 | 谁来改 |
|---|---|---|
| 改了跨模块接口、API 返回格式、MCP 工具 | `docs/SHARED_INTERFACES.md`（**先写文档再改代码**） | `xbl2602`；别人在 `docs/decisions/` 提议 |
| 新增环境变量 | `.env.example`（**先登记再使用**，只写变量名和用途，不写值） | `xbl2602` |
| 新增外部素材、数据源、AI 生成内容 | `docs/CREDITS.md`（**当场登记**） | 任何人追加一行 |
| 做了重要决定（换技术、改架构、改规则、改范围、定指标公式、选数据源） | `docs/decisions/` 新建一个文件 | 任何人写，`xbl2602` 整理进 DECISION_LOG |
| 功能范围、图层、指标定义有变化 | 先在 `docs/decisions/` 提议；批准后更新 `docs/FEATURE_SPEC.md` | `xbl2602` |
| 目录结构、分层有变化 | 先提议；批准后更新 `docs/ARCHITECTURE.md` 和本文件第 12 节 | `xbl2602` |
| 数据流、单位、坐标约定有变化 | 先提议；批准后更新 `docs/DATA_FLOW.md` | `xbl2602` |
| 团队分工或目录归属有变化 | 本文件第 2 节、`docs/TEAM_HANDBOOK.md` | `xbl2602` |
| 新的调研发现、原型实测结论 | 写进自己的 `docs/logs/<用户名>/`，并告诉 `xbl2602` 是否要进 `docs/PROJECT_CONTEXT.md` | 各人写日志；`xbl2602` 决定是否收录 |
| 开完会 | 在 `docs/meetings/` 新建 `YYYY-MM-DD_<主题>.md`（原件如 PDF 也放这里，转写要标明"可能有误"） | 谁整理谁建 |
| 待决问题有了答案、或出现新的待决问题 | `docs/TODO.md` | `xbl2602` |
| 完成里程碑 | `docs/HISTORY.md` | `xbl2602` |
| 每次收工 | `docs/logs/<用户名>/YYYY-MM-DD.md`：做了什么、为什么、没做完什么 | 各人自己 |
| 画面或渲染有改动 | 自己的日志里记：改了什么参数、为什么、前后对比 | 各人自己 |

### 14.4 使用文档的规则

1. **文档可能过期。** 先看文档开头的"状态/最后更新"。带 ❓ 的是未确认，带 💡 的只是候选方案，**都不能当成已定的事实去实现**。
2. **文档和代码不一致，或两份文档互相矛盾**：不要静默挑一个当真。先指出矛盾，问 `xbl2602`；定下来后**同一个 PR 里**把过期的那一方改对（你没有权限改的，在 `docs/decisions/` 提议）。
3. **改共享文档的权限**：第 14.3 表里写 `xbl2602` 的，其他人的 agent 不要直接改，写提议。可以自己改的只有：CREDITS 追加行、自己的日志、`docs/decisions/` 新文件、`docs/meetings/` 新文件。
4. **不要新建重复的文档**，也不要把记录写到约定之外的地方。命名遵守 [docs/README.md](docs/README.md) 的命名规则（共享文档 `UPPER_SNAKE.md`，记录类 `YYYY-MM-DD_...`，英文小写加连字符，不要空格和中文文件名）。
5. **PR 描述里写一句**："改了哪些文档"或"没改文档，因为……"。审核的人据此检查文档有没有跟上。
6. 写文档用大白话，写明日期；不确定的内容明说"不确定"，不要写得像定论。
