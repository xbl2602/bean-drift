import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ProductTransition } from "@/ui/landing/product-transition";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bean Drift",
  description: "Compare sunlight and Earth-communication conditions anywhere on the Moon, on any date.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
        {/* 点任何通往产品页的链接，先盖上像素漂移动画，产品页在它后面加载（挂在根布局，路由切换时它不会被卸载） */}
        <ProductTransition />
      </body>
    </html>
  );
}
