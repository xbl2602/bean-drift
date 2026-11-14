# 架构（ARCHITECTURE）

> 状态：架构说明。`src/core/`、`src/features/` 的骨架已经落地，其余目录按需创建（见 AGENTS.md 第 12 节）。这份文档规定"代码往哪放、怎么分层"，目的是 **5 人 × 多 agent 并发开发时仍然可控、可维护**。规则的强制版本在 [AGENTS.md](../AGENTS.md)，这里讲"为什么这样分"。

## 1. 一张图

```
        ┌──────────────── 对外的四种使用方式（同一套能力）────────────────┐
        │  网页 UI          REST API         MCP（HTTP/SSE）      agent 窗口  │
        └───────┬──────────────┬─────────────────┬──────────────────┬───────┘
                │              │                 │                  │
              ui/            api/              mcp/          （agent 工具=mcp 同一份白名单）
                └──────────────┴────────┬────────┴──────────────────┘
                                        ▼
                              logic/   纯业务函数（只做计算和查询）
                                        ▼
                         src/core 统一数据接口（唯一的数据入口）
                                        ▼
                  衍生数据（静态文件+版本元数据） ← pipeline（xbl2602 的电脑）← 原始 NASA 数据
```

## 2. 目录与归属（目标）

```
app/
  (landing)/        landing page 的页面                      chanjy0806
  (product)/        product page 的页面                      ShanLe1224
  api/              REST 路由（很薄，只转调 logic）             xbl2602
  mcp/              MCP 入口（只汇总各功能的 mcp/）             xbl2602
src/
  core/             统一数据接口、注册汇总、全局配置            xbl2602
  lib/
    llm/            DeepSeek 封装（唯一允许 import LLM SDK 的地方）
    shared/         跨模块真正需要共享的类型/工具（要尽量少）
  features/
    <功能名>/       每个小功能一个文件夹                        louis068（由 xbl2602 分配）
      logic/ api/ mcp/ ui/
  ui/
    landing/        landing 专用组件                          chanjy0806
    product/        product 专用组件、渲染引擎                  ShanLe1224
pipeline/           数据预计算脚本                             xbl2602
pitch/              视频脚本/分镜/素材清单                      leeziqi0531-debug
public/             静态资源（landing/、product/ 子目录各归各的）
```

## 3. 为什么这样设计

- **一个目录一个负责人** → 多人、多 agent 同时开发，物理上很难改到同一个文件；出问题一眼知道找谁。
- **`logic/` 与 `api/ mcp/ ui/` 分开** → "网页、API、MCP、agent"是同一能力的四个入口，只写一遍计算逻辑，不会出现"网页算的和 API 返回的不一样"。
- **统一数据接口** → 前端不碰原始数据、不重复实现天文计算，数据口径只有一份（见 [DATA_FLOW.md](DATA_FLOW.md)）。
- **预计算放个人电脑** → Vercel 无服务器函数时长和内存有限、VPS 性能不足，重计算不在线上做，避免展示时卡顿。线上只发静态文件和轻量查询。
- **跨模块只走约定的接口**（`docs/SHARED_INTERFACES.md`）→ 改一个模块的内部实现不会弄坏别人。

## 4. 技术栈

Next.js（App Router）+ Tailwind；three.js 渲染；Supabase；Vercel；DeepSeek（仅 agent 窗口，仅服务端）。选择理由见 DECISION_LOG D-0001。**为什么不继续用现有原型的"静态 HTML + 手写服务器"**：它适合快速做画面实验，但没有地方放 API、MCP、数据库、密钥，也没法一次 `git push` 就部署到 Vercel；Next.js 能让**网页、API、MCP 在同一个项目里**，three.js 场景可以作为一个组件嵌进 product page。

## 5. 与原型的关系

`prototypes/lunar-scene-demo/` 是**画面和算法的参考实现**，不是产品代码：

- 可复用的**思路和算法**：高度图金字塔采样（`demgrid.js`）、地平线剖面、星历（`ephemeris.js`，已对照 JPL Horizons 校验）、远处阴影重算（`shadowcast.js`）、数据处理脚本（`tools/`，将来迁入 `pipeline/`）。
- 产品代码按本文的结构写，**不把原型整体拷贝成产品代码**，只复用思路和算法。
