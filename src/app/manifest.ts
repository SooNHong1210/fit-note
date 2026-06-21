import type { MetadataRoute } from "next";

// Next.js가 /manifest.webmanifest 로 생성.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "핏노트",
    short_name: "핏노트",
    description: "개인 PT샵 / 회원제 예약·회원 관리 도구",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
