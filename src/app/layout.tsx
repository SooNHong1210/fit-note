import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorker from "@/components/ServiceWorker";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "핏노트",
  description: "개인 PT샵 / 회원제 예약·회원 관리 도구",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "핏노트", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#ae6a43",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <ServiceWorker />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
