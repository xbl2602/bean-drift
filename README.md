# Lunar Landing Site Navigator

NASA Space Apps Challenge（吉隆坡站）参赛作品：让任务规划者、教育者和公众都能**快速比较月面任意位置、任意日期的光照（发电）与对地通信条件**的网站。

> **说明**：框架、文档体系和原型沿用自此前的演练仓库，是已有基础，不是现场新写的，详见 [docs/DECISION_LOG.md](docs/DECISION_LOG.md) D-0008。

## 第一次来？按这个顺序读

1. [AGENTS.md](AGENTS.md)：所有人和所有 AI 要遵守的规则
2. [docs/TEAM_HANDBOOK.md](docs/TEAM_HANDBOOK.md)：谁负责什么、第一天做什么
3. [docs/FEATURE_SPEC.md](docs/FEATURE_SPEC.md)：我们要做什么
4. [docs/GIT_GUIDE.md](docs/GIT_GUIDE.md)：Git 步骤（有人话解释）

完整文档目录：[docs/README.md](docs/README.md)。

## 现在仓库里有什么

- `docs/`：全部文档
- `prototypes/`：原型。`lunar-scene-demo/` 是已经能跑的月面第一人称场景（南极、阿波罗 11 号，真实 NASA 地形与星历），另有两版 landing page 视觉原型。运行方法见 [prototypes/README.md](prototypes/README.md)
- 产品代码（Next.js，项目名 **Bean Drift**）：`app/`、`src/`，已有占位页、REST API、MCP；运行和部署见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)，目录说明见 [AGENTS.md](AGENTS.md) 第 12 节

## 团队

| GitHub | 角色 |
|---|---|
| `xbl2602` | 后端主架构 + 项目经理 |
| `louis068` | 后端：各类小功能 |
| `chanjy0806` | 前端：landing page |
| `ShanLe1224` | 前端：product page |
| `leeziqi0531-debug` | pitch 视频 + 打杂 |

## 数据与版权

使用了 NASA LOLA、LROC NAC 公开数据；素材、数据和 AI 使用登记见 [docs/CREDITS.md](docs/CREDITS.md)。
