# 待办与待决问题（TODO）

> 维护人：`xbl2602`。其他人想加事项，写进自己的 `docs/logs/<用户名>/` 或 `docs/decisions/`，不要直接改本文件（避免冲突）。

## 待决问题（需要拍板，拍板后写进 DECISION_LOG）

| # | 问题 | 为什么要定 | 相关 |
|---|---|---|---|
| Q1 | L6"最长平均断电时间"、L7"平均单次信号时间"的精确公式 | 决定预计算什么 | FEATURE_SPEC §3 |
| Q2 | 综合有效位置图（L9）的基地参数有哪些、默认值多少 | 决定 UI 和着色规则 | FEATURE_SPEC §5 |
| Q3 | 预设点位清单（中美俄等）和**有出处的**坐标。**进度**：现有 4 个有出处的点（来自原型）；其余等调研，每个坐标的出处要记进 CREDITS | 用户要求预设点；坐标不能凭记忆 | FEATURE_SPEC §7 |
| Q4 | 预计算产物放哪。**进度**：已调研，见 `docs/research/tile-hosting-limits.md`。小图层（坡度/日照/通信，估算几十 MB）可跟网站放 Vercel；全月高精度地形（约 8.5 GB）放不进 Vercel 和 Supabase 免费版，候选是 Cloudflare R2（对外）+ Oracle VPS（备份）。**还没拍板**：是否做高精度地形、是否用 R2 | 影响大小限制和稳定性 | DATA_FLOW §4 |
| Q5 | 全月数据用什么 DEM、多大分辨率。**进度**：候选已选 LOLA 118 m 全月（`LDEM_256`）做地形，NASA Moon Trek 的 WAC（约 83 m/像素）做 2D 底图（见 `docs/research/nasa-trek-tiles-for-frontend.md`）。**还差**：Trek 使用条款未确认；"算一块区域地平线要多久"和压缩后大小都没实测 | 决定"全月每点可调用"能否做到 | FEATURE_SPEC §6 |
| Q6 | **沿用的框架与原型是否要向本地组织者说明或确认？** 官方 FAQ 有一条"赛前不得开始做挑战"（见 `docs/research/lunar-landing-site-navigator_research.md` 第 1 节），而沿用的内容是活动开始之前做的，这一点没有向组织者确认过。视频和提交文档里怎么如实标注"已有基础"也要定 | 避免提交被认定违规；对评委诚实 | DECISION_LOG D-0008 |

## 近期要做

- [ ] `xbl2602`：在 GitHub 仓库设置里给 `main` 开分支保护（要求 PR 才能合并，并勾选"Require review from Code Owners"，配合 `.github/CODEOWNERS`），并开启 secret scanning（密钥泄露扫描）。
- [ ] `xbl2602`：创建 Vercel 项目并关联这个仓库，把项目名和线上地址登记进 [DEPLOYMENT.md](DEPLOYMENT.md)；记得关掉登录保护，否则评委打不开。
- [ ] `xbl2602`：把原型 `tools/` 理成 `pipeline/`。
- [ ] `xbl2602`：实测"算一块区域的地平线要多久"。
- [ ] `xbl2602`：真正构建验证一次 Dockerfile（目前没有验证过）。
- [ ] 每个人：完成 TEAM_HANDBOOK 第 2 节的"热身提交"。
- [ ] `leeziqi0531-debug`：建立 CREDITS 登记习惯；起草 30 秒视频分镜。
- [ ] 把 DeepSeek key 配进 Vercel 环境变量：**由 `xbl2602` 本人操作**，AI 不碰密钥。（做 agent 窗口时再做，现阶段不急。）
- [ ] 把 `AI_PLAYBOOK.md` 第 6 节"还没做、值得做的"（画质指标、固定机位 URL）转成产品里的调试工具。

## 已知限制（来自原型）

- 原型地球贴图是程序化的，不是真实 NASA 影像；岩石是程序化的；阿波罗 11 号 DTM 有一条南北向拼接缝未处理；东侧 1.2 km 外是合成地面（见 PROJECT_CONTEXT）。
