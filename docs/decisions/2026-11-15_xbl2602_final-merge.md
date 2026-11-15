# 最终合并：收工前把所有分支和 PR 合进 main

- **日期**：2026-11-15
- **提出人**：xbl2602（由 Claude 代为执行；原话："现在全部人都收工了。这次合并将会是最终的。解决所有问题，确保代码完整收尾可用"）
- **状态**：已采纳（PR #64 合并后生效）

## 做了什么

收工前最后一轮，把还在外面的工作全部合进 main，之后 main 就是提交版本：

| 内容 | 来源 |
|---|---|
| 落地页性能：地形生成挪到后台线程、画布分辨率自适应、修复 `next build` 卡死 | PR #59 |
| 评审体验小修：WebGL 兜底页、去掉 React #418、网站图标、手机顶栏 | PR #60 |
| 着陆点照片切段：连续切换地点不再整页卡死 | PR #62 |
| README 历史任务、APA 参考文献、团队分工（Bean） | PR #61，经 #63 合入，合并时改正了几处与仓库记录不符的内容 |
| `docs/REFERENCES_APA7.docx`（APA 7 参考文献，xbl2602 本地稿） | 本 PR；入库前改了 Smith 2010 的 DOI 和 Pike 1977 的标题 |

此前几轮（#38、#40、#41、#48–#58）见 `2026-11-15_xbl2602_integration-baseline.md` 和 `2026-11-15_xbl2602_round2-merge-and-alignment.md`。

## 没合的（有意）

- `louis068/docs-project-readme`、`xbl2602/archive-data-source-seam-tests`、`xbl2602/archive-polar-highres-drafts`：xbl2602 说"草稿不用了"。分支还在，没删。

## 没验证 / 已知局限（如实写）

- 没有在真实浏览器里手点验证 #59、#60、#62 合并后的运行表现；每个 PR 里各自写过测量记录，合并后只靠 CI（类型检查、测试、构建）和 Vercel 构建把关。
- 第一人称在 9.00°N 67.91°E 的"墙"：chanjy0806 日志记录已修并随第二轮合并进了 main，这次**没有重新在浏览器里复验**。
- Pike 1977 在 `docs/CREDITS.md` 里没有登记，README 和参考文献里列了它，是否真用到待 Bean 确认。
- README 中文队员表五行都扩写了，英文表只扩写了 louis068 一行，两边不完全对齐。
- Google Docs 项目文档链接只确认能打开，没核对内容和访问权限。
- `docs/REFERENCES_APA7.docx` 里 JGR Planets 2026 那篇等"待复核"项如日志所写，没有粉饰。

## 影响

所有人从 `origin/main` 起步；不再有需要合并的活跃分支。
