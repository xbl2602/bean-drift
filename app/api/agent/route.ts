// POST /api/agent：用自然语言问月球数据。这里只做接线，业务在 src/features/agent-search/。
// 密钥 DEEPSEEK_API_KEY 只在服务端、每次请求时读取（见 .env.example）；没配置时返回 503，不会假装是真 AI。
// 工具只用 registry 里的只读白名单。接口约定见 docs/SHARED_INTERFACES.md 第 6 节。
import { TOOLS } from "@/core/registry";
import { createLunarAgentPost } from "@/features/agent-search/api/server";

export const runtime = "nodejs";
// 单次请求自己的总超时是 25 秒；这里留 5 秒余量给平台。
export const maxDuration = 30;

export const POST = createLunarAgentPost(TOOLS);
