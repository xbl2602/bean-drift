# Git 新手指南（GIT_GUIDE）

> 给第一次用 GitHub 的队友。你可以让 AI 帮你敲命令，但**要知道每一步在干嘛**，这样出问题时才能说清楚。

## 先理解 4 个词

- **仓库（repo）**：我们项目的整个文件夹，加上它的全部修改历史。GitHub 上有一份"总的"，你电脑里有一份"你的"。
- **分支（branch）**：从总版本（`main`）分出来的一条"自己的修改线"。你在自己的分支上随便改，不会影响别人。
- **提交（commit）**：给你的修改拍一张带说明的"快照"。拍过快照，东西就丢不了。
- **PR（pull request）**：把你的分支"申请合并"进 `main`，由 `xbl2602` 看过后合并。

**铁律：不要直接往 `main` 上改。每个任务一个分支，改完走 PR。**

## 只做一次：把仓库下载到电脑

```bash
git clone <仓库地址>   # 地址由 xbl2602 提供
```

## 每个任务的完整流程

**1. 拿到最新的 main**

```bash
git switch main
```

```bash
git pull
```

**2. 开一个自己的分支**（名字：`你的用户名/区域-任务`，英文小写加连字符）

```bash
git switch -c chanjy0806/landing-hero-section
```

**3. 让 AI 干活。** 做完你自己看结果（打开网页/截图），确认对了再往下。

**4. 看看改了什么**

```bash
git status
```

**5. 把你改的文件加入快照**（⚠️ 只加具体路径，**不要用 `git add .`**）

```bash
git add app/(landing)
```

**6. 拍快照**（说明以 `[区域]` 开头，说人话）

```bash
git commit -m "[landing] 做好首屏标题和背景"
```

**7. 推送到 GitHub**

```bash
git push -u origin chanjy0806/landing-hero-section
```

**8. 开 PR。** 推送后终端会给一个网址，点开，点绿色按钮 "Create pull request"，写两句话说明做了什么，然后通知 `xbl2602`。

## 同时开多个 AI：用独立工作目录（worktree）

问题：如果两个 AI 在**同一个文件夹**里干活，它们会互相踩脚（一个切分支，另一个的文件就跟着变了）。解决：**每个 AI 一个独立文件夹、一个独立分支**，共用同一个仓库历史。

```bash
git worktree add ../moon-chanjy0806-landing-hero -b chanjy0806/landing-hero-section
```

这会在旁边新建文件夹 `moon-chanjy0806-landing-hero`，里面就是一个干净的、已切到新分支的项目。**让这个 AI 在那个文件夹里启动。** 另一个 AI 再开另一个 worktree。

合并完成后清理：

```bash
git worktree remove ../moon-chanjy0806-landing-hero
```

注意：新 worktree 里没有 `node_modules`（要重新 `npm install`），也没有被 git 忽略的大文件（比如原始 NASA 数据）。需要时从主文件夹复制，或问 `xbl2602`。

## 绝对不要做的事（AI 也不行）

这些命令会**不可逆地丢东西**。任何人（包括 AI）要执行之前，**必须先问 `xbl2602` 并说清楚会丢什么**：

- `git reset --hard`
- `git checkout -- .` / `git restore .`
- `git clean -f`
- `git push --force`
- `git branch -D`
- `git add .` / `git add -A`（不是丢东西，但会把别人的半成品一起提交）

## 出问题了

| 情况 | 怎么办 |
|---|---|
| 出现 `conflict`（冲突） | **停下来**，别让 AI 自己解决。截图找 `xbl2602` |
| 不知道现在在哪个分支、改了什么 | 运行 `git status`，把结果截图给 `xbl2602` |
| 提交错了东西（比如不该提交的文件） | 还没 push：告诉 `xbl2602`。**已经 push 且里面有密钥：立刻告诉 `xbl2602` 作废密钥** |
| 想撤销还没提交的修改 | **先问**。这会丢掉修改，不是随手能做的事 |

只要**提交过**，内容就在历史里，几乎不会真正丢失。所以：**小步多提交**。
