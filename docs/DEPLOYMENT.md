# 部署与本地运行（DEPLOYMENT）

> 维护人：`xbl2602`。三种跑法用同一份代码：Vercel（线上主线）、Docker、本地。
> 目前网页、API、MCP **不需要任何环境变量和密钥**。

## 线上（Vercel）

- Vercel 项目：`bean-drift`，线上地址：**https://bean-drift.vercel.app**（这里只登记项目名和地址，不登记任何密钥）。
- ⚠️ **这个项目最初关联的是旧的演练仓库，目前线上跑的还是旧仓库的构建**（例如 MCP 工具说明里的示例时间还是旧的），推送到本仓库不会触发它部署。需要 `xbl2602` 在 Vercel 后台 Project → Settings → Git 里把关联仓库改成 `xbl2602/bean-drift`，再触发一次部署。改好后把这条提示删掉。
- 关联到本仓库之后：**推送到 `main` 自动部署到正式环境**，推送其他分支会生成预览地址。
- Node 版本固定为 24.x（`package.json` 的 `engines`）。
- 密钥只放在 Vercel 后台（Project → Settings → Environment Variables），**不要**写进仓库。现在还没有任何要配的。
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
```

接口说明见 [SHARED_INTERFACES.md](SHARED_INTERFACES.md)。

## 部署记录

每次正式部署后在这里追加一行：日期、做了什么、结果。

| 日期 | 事件 |
|---|---|
