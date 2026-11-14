// 健康检查：部署后用它确认服务活着。不读任何环境变量，不返回内部信息。
import { jsonResponse } from "@/lib/shared/http";

export function GET(): Response {
  return jsonResponse({ status: "ok", service: "bean-drift" });
}
