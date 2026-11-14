// Lunar Quest 产品页。负责人：ShanLe1224。
// 页面本身只负责挂载；地图、3D、第一人称、菜单都在 src/ui/product/。landing page 用指向 /product 的按钮进入这里。
import type { Metadata } from "next";
import { LunarQuestApp } from "@/ui/product/lunar-quest-app";

export const metadata: Metadata = {
  title: "Lunar Quest",
  description: "Explore the whole Moon in 4K with real sunlight and shadows, then stand anywhere in first person.",
};

export default function ProductPage() {
  return <LunarQuestApp />;
}
