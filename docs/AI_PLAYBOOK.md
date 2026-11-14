# AI 画质工作手册（给 5 人团队，含新手）

> 来源：把月面场景从"能跑"做到"像月球"的实际过程。
> 先读仓库根目录的 AGENTS.md（协作规则）和 docs/PROJECT_CONTEXT.md（项目背景），再读这个（怎么指挥 AI 把画面做好）。
> 文中说的"画质负责人"在团队里对应 product page 前端；渲染原型代码在 `prototypes/lunar-scene-demo/`。

## 1. 结论：要不要装额外工具

不需要为了"更高级渲染"去装重型工具。这个会话里的画面是用**原版 three.js** 做出来的，没有用任何渲染类技能包或 MCP 以外的东西。
但有几样便宜的东西能让**新手**少踩坑，按优先级：

| 优先级 | 工具 | 作用 | 备注 |
|---|---|---|---|
| 必须 | **能截图的浏览器 MCP**：[Chrome DevTools MCP](https://themenonlab.blog/blog/chrome-devtools-mcp-ai-agents) 或 [Playwright MCP](https://screenshotone.com/blog/playwright-mcp-screenshots/) | 让 AI 看见自己渲染出的画面，再改再看 | 没有它，AI 是"闭着眼睛写着色器"。我在会话里用的是桌面应用自带的浏览器窗格。Playwright 的页面快照看不到画布内容，画布只能靠截图 |
| 推荐 | three.js 技能包，如 [webgpu-threejs-tsl](https://skills.cat/skills/dgreenheck/webgpu-claude-skill/webgpu-threejs-tsl) | 防止 AI 写错 WebGPU/TSL 用法（它常把 JS 变量重新赋值当成 TSL 节点修改） | MIT 许可，目标 three.js r171+。**只有改用 WebGPU/TSL 才有用**，本会话用的是 WebGL，没用它。安装命令各来源不一致，我没有实际执行过：`npx skills add https://github.com/dgreenheck/webgpu-claude-skill --skill webgpu-threejs-tsl` |
| 可选 | [Blender MCP](https://archestra.ai/mcp-catalog/ahujasid__blender-mcp) | 让 AI 建登陆器、探测车等"主角模型"并烘焙 | 地形不需要它。来源是目录站，使用前先读官方 README；我没测过它的烘焙能力 |
| 可选 | [threejs-devtools-mcp](https://glama.ai/mcp/servers/HiroshiPhan46500/threejs-devtools-mcp)（社区项目） | 让 AI 读取场景状态、测性能 | 我只看过目录介绍，没验证 |
| 不推荐 | 行星渲染类的纯文字技能（如 [procedural-planets](https://raw.githubusercontent.com/linegel/threejs-complete-set-of-skill/main/skills/threejs-procedural-planets/SKILL.md)） | — | 我读了内容：全是指导文字、没有代码块，面向整颗行星的 WebGPU 方案，对"站在月面看"帮助有限 |

## 2. 这个会话里真正提升画质的东西（诚实排序）

1. **截图反馈循环。** 每改一次就看一次。靠它发现了：PlayCanvas 整个场景全黑（渲染组件覆盖了阴影标志）、背光视角过曝、岩石像鹅卵石等。
2. **人的现实判断。** 画面最大的几次进步，都来自"这不对"：岩石太多太大、背光发白、月壤反射不像真的、近景像沙丘。AI 自己做出来的第一版是"沙丘加白闪点"。
3. **在提示里点名具体技术。** 例如"级联阴影""Lommel-Seeliger 反射加相位函数""实例化岩石""AgX 色调映射"。笼统说"更真实"几乎没有用。
4. **真实数据。** 真实 LOLA 高度和真实低太阳角阴影，比任何着色器技巧都更"像"。
5. **用 URL 开关做对比。** 例如 `?tm=aces`、`?ls=0`、`?sun=7`，新手不改代码也能 A/B。

## 3. "许愿"提示词模板（高级版）

把一句"做得更好看"换成五段。每段都要写：

```
【目标】我要的画面像什么？（真实参照：1–3 条事实或照片描述，不要只说"好看"）
【约束】技术栈和版本；帧耗时预算；不允许做的事（例如不要新增依赖、不要改共享的 common.js）
【验收】固定 4 个机位截图（见 §5），每张必须满足：不出现纯黑大块、不出现大面积过曝、……
【过程】每次只改一件事；改完截图并和上一版对比；记录改了哪个参数、为什么
【禁止清单】以前出过的坏效果：背光发白、石头过多过大、地面像沙丘、金属感高光
```

### 例子（本项目）

```
目标：南极点视角。真实月面：深灰色粉质地面，几乎没有高光，朝太阳看时偏暗，
      背着太阳看时最亮；石头稀疏，主要集中在年轻陨石坑周围；黑色天空。
约束：three.js r187，WebGL2；帧耗时 < 8 ms（RTX 5060 笔记本）；只改 prototypes/lunar-scene-demo/scene-three.js，不动 common.js。
验收：用 §5 的 4 个机位各截一张图：
      1) 任何一张里纯黑像素占比不超过 25%（环形山阴影除外）；
      2) 任何一张里被截断成纯白的像素不超过 1%；
      3) 近景 20 米内可见岩石不超过 30 块。
过程：每次只改一个参数；截图后和上一版并排对比，写清楚变好还是变坏。
禁止：高光闪点、背光发白、鹅卵石一样圆的岩石。
```

### 新手版（三句话）

```
1. 先读 AGENTS.md、docs/PROJECT_CONTEXT.md 和 docs/AI_PLAYBOOK.md。
2. 我想让【某个具体画面问题，例如"朝太阳看太亮"】变好；每次只改一处，改完用 4 个固定机位截图给我看。
3. 如果你不确定，先问我，不要自己加新功能。
```

## 4. 5 人团队怎么分工用 AI

- **一个人当"画质负责人"**（最会用 AI 的人）：只有他改渲染文件，其他人不碰着色器。
- 其余前端同学只通过**参数和机位**参与：给他们 URL 开关和 4 个固定机位，让他们"看图提意见"，由负责人让 AI 改。
- 意见要写成"事实 + 位置"，例如"左下角那块石头比脚印大三倍，不合理"，不要写"不好看"。
- 每次改动都留一句话记录（改了什么、为什么），写进你自己的工作日志 docs/logs/<你的GitHub用户名>/（不要往别人的文件里写；规则见 AGENTS.md）。

## 5. 固定机位（建议，在 `window.__dbg.view` 里设置）

| 编号 | 描述 | yaw | pitch | fov |
|---|---|---|---|---|
| 1 | 默认主视角 | 见 prototypes/lunar-scene-demo/lola.js 的 POLE.camera | 同左 | 同左 |
| 2 | 朝太阳看（最容易过曝） | 太阳方位角 | 3 | 42 |
| 3 | 背着太阳看（最亮） | 太阳方位角 + 180 | 5 | 42 |
| 4 | 近景地面（石头密度） | 主视角 | −25 | 50 |

## 6. 还没做、值得做的

- 把"纯黑占比、过曝占比、平均亮度、帧耗时"做成一个 `window.__metrics()`，让 AI 或检查脚本可以自动判断，不靠人眼。
- 把 4 个机位做成 `?shot=1..4` 的 URL，一键截图。
- 把本手册的提示词模板变成一个项目技能（skill），新手只填空。
