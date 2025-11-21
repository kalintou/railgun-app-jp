import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Railgun Local App",
  description: "Local dev playground for Railgun wallet/app",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* next/font/google は使わず、デフォルトのフォントか CSS 側で指定したフォントをそのまま使用する */}
      <body>{children}</body>
    </html>
  );
}
