# 部署与本地运行（DEPLOYMENT）

> 维护人：`xbl2602`。三种跑法用同一份代码：Vercel（线上主线）、Docker、本地。
> 网页、API、MCP **不需要任何环境变量和密钥**。只有 agent 窗口（`POST /api/agent`）需要一个密钥 `DEEPSEEK_API_KEY`；没配置时它返回 503，其余功能不受影响。

## 线上（Vercel）

- Vercel 项目：`bean-drift`，线上地址：**https://bean-drift.vercel.app**（这里只登记项目名和地址，不登记任何密钥）。
- 项目已关联本仓库 `xbl2602/bean-drift`：**推送到 `main` 自动部署到正式环境**，推送其他分支会生成预览地址。线上内容已确认是本仓库的构建（见文末部署记录）。
- 如果以后推送后线上没有更新：先看 Vercel 后台 Project → Settings → Git 关联的仓库对不对，再看 GitHub 上 Vercel 应用是否有这个仓库的访问权限。
- Node 版本固定为 24.x（`package.json` 的 `engines`）。
- 密钥只放在 Vercel 后台（Project → Settings → Environment Variables），**不要**写进仓库。现在只有一个要配：`DEEPSEEK_API_KEY`（agent 窗口用，由 `xbl2602` 本人在后台添加；名字**不要**加 `NEXT_PUBLIC_` 前缀）。添加后要**重新部署**才生效（环境变量只对之后的新部署有效）。**配之前先看 `docs/TODO.md` 里"agent 频率限制"那一条。**
- 本地和 Docker：把 `DEEPSEEK_API_KEY=...` 写进你自己的 `.env.local`（已被 git 忽略；`docker compose` 会自动读它）。
- 自检：打开 `<域名>/api/health` 应返回 `{"status":"ok","service":"bean-drift"}`。

> 登录保护：线上地址不用登录就能访问（已验证），评委可以直接打开。**如果以后重建项目**要注意：新建的 Vercel 项目默认开启登录保护（Vercel Authentication），没登录的人（包括评委）会被跳转到登录页，要在 Project → Settings → Deployment Protection 里关掉（或改成只保护预览）。AI 工具尝试关闭时可能被权限系统拦下，这一步留给人手动做。

## 本地运行（不用 Docker）

需要：Node.js 22 或更新（已用 24 测试）。

```
npm install        # 装依赖，只装在本目录的 node_modules/ 里，不改系统
npm run dev        # 开发模式，打开 http://localhost:3000
npm run build && npm start   # 生产模式
npm run typecheck  # 类型检查
```

完全卸载：删除本目录的 `node_modules/` 和 `.next/` 即可，没有装任何全局东西。

## Docker

```
docker compose up --build        # 然后打开 http://localhost:3000
# 或：docker build -t bean-drift . && docker run -p 3000:3000 bean-drift
```

> ⚠️ **Dockerfile 还没有真正构建验证过。** 第一次使用请先跑一遍，把结果告诉 `xbl2602`，并把这条提示改掉。

## 快速验证接口

```
curl "<域名>/api/point?latDeg=-89.71&lonDeg=62.5"
curl -X POST <域名>/mcp -H "content-type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
# agent：没配 DEEPSEEK_API_KEY 时应返回 503（不是 404，也不是假答案）；配好后才会真的调用 DeepSeek（花钱）
curl -X POST <域名>/api/agent -H "content-type: application/json" -d '{"message":"List the lunar presets"}'
```

接口说明见 [SHARED_INTERFACES.md](SHARED_INTERFACES.md)。

## 部署记录

每次正式部署后在这里追加一行：提交（或日期）、做了什么、结果。

| 提交 / 日期 | 事件 |
|---|---|
| `21c9f0d` | 项目改为关联本仓库后的第一次正式部署：状态 READY；`/api/health`、`/api/presets`、`/`、`/product` 返回 200；`/mcp` 的工具说明已是本仓库的版本（示例时间 `2030-01-01T12:00:00Z`）。 |
