# 文档总目录

> 先读仓库根目录的 [AGENTS.md](../AGENTS.md)（所有 AI 和人的规则入口）。下面是各文档的用途和谁来维护。

> **什么时候读哪份、做完什么要更新哪份、谁来改，见 [AGENTS.md 第 14 节"文档地图"](../AGENTS.md)。** 本页只是目录和简介。

## 怎么读（按你的身份）

- **所有人先读**：[AGENTS.md](../AGENTS.md) → [TEAM_HANDBOOK.md](TEAM_HANDBOOK.md) → [FEATURE_SPEC.md](FEATURE_SPEC.md) → [GIT_GUIDE.md](GIT_GUIDE.md)
- **指挥 AI 做画面**：[AI_PLAYBOOK.md](AI_PLAYBOOK.md)
- **做后端 / 接口**：[ARCHITECTURE.md](ARCHITECTURE.md) → [DATA_FLOW.md](DATA_FLOW.md) → [SHARED_INTERFACES.md](SHARED_INTERFACES.md)
- **做视频 / 素材**：[CREDITS.md](CREDITS.md) → `meetings/` 里的比赛规则

## 文档清单

| 文档 | 内容 | 维护人 |
|---|---|---|
| [TEAM_HANDBOOK.md](TEAM_HANDBOOK.md) | 谁负责什么、第一天要做什么、日常流程、卡住了怎么办 | `xbl2602` |
| [GIT_GUIDE.md](GIT_GUIDE.md) | Git 新手步骤，多 agent 并发（worktree） | `xbl2602` |
| [FEATURE_SPEC.md](FEATURE_SPEC.md) | 我们要做什么：图层、交互、参数卡、数据策略 | `xbl2602` |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 目标目录结构与分层，为什么这样设计 | `xbl2602` |
| [DATA_FLOW.md](DATA_FLOW.md) | 数据怎么流动、单位和坐标约定 | `xbl2602` |
| [SHARED_INTERFACES.md](SHARED_INTERFACES.md) | 跨模块接口、REST、MCP 工具约定（已实现部分） | `xbl2602` |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Vercel / Docker / 本地运行与部署记录 | `xbl2602` |
| [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) | 背景、赛题理解、技术调研、原型实测记录 | `xbl2602` |
| [AI_PLAYBOOK.md](AI_PLAYBOOK.md) | 怎么指挥 AI 把画面做好（提示词模板、截图反馈循环） | 画质负责人 |
| [DECISION_LOG.md](DECISION_LOG.md) | 已做的决定和原因 | `xbl2602` |
| [decisions/](decisions/README.md) | 新决定：一条一个文件，随时写 | 任何人 |
| [TODO.md](TODO.md) | 待决问题和近期要做 | `xbl2602` |
| [HISTORY.md](HISTORY.md) | 按时间记录发生了什么 | `xbl2602` |
| [CREDITS.md](CREDITS.md) | 数据源、素材、AI 使用登记（比赛规则要求） | `leeziqi0531-debug` 汇总，人人可追加 |
| [logs/](logs/README.md) | 每个人自己的工作日志 | 各人自己 |
| `meetings/` | 会议记录：吉隆坡说明会摘要、第一次线下会议导图（转写） | — |
| `research/` | 赛题调研原文 | — |

## 命名规则

- 共享文档：`UPPER_SNAKE.md`（`FEATURE_SPEC.md`）。
- **新建**的会议、调研、决定、日志：`YYYY-MM-DD_<主题>`（或 `YYYY-MM_<主题>`），英文小写加连字符，不要空格和中文文件名。`meetings/`、`research/` 里已有的几份是带进来的初始资料，不带日期。
- 代码文件夹和文件：英文 kebab-case，按"这是什么"命名，不带人名和日期。
