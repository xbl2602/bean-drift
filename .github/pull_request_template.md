## 改了什么
<!-- 一两句大白话，别人不看代码也能懂 -->

## 改了哪些目录
<!-- 只能是你自己负责的目录；要改共用区（src/core、src/lib、接口文档、AGENTS.md）先找 xbl2602 -->

## 文档
<!-- 必填，二选一：改了哪些文档 / 没改文档，因为…… -->

## 自检
- [ ] 没有密钥、令牌、密码（`git diff --cached` 里搜过 key、token、secret、sk-、Bearer）
- [ ] 提交时用的是 `git add <具体路径>`，没有 `git add .` 或 `git add -A`
- [ ] `npm run typecheck` 通过（CI 也会跑）
- [ ] 新增了外部素材、数据源或 AI 生成内容的，已登记到 `docs/CREDITS.md`
- [ ] 画面或渲染有改动的，已附截图
