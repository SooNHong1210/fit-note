"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import TeacherGate from "./TeacherGate";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMember = pathname === "/m" || pathname.startsWith("/m/");

  // 비밀번호 재설정: 로그인 게이트/사이드바 없이 단독 렌더
  if (pathname === "/reset") return <>{children}</>;

  // 회원 앱: 중앙 정렬 모바일 레이아웃 (사이드바 없음)
  if (isMember) {
    return (
      <div className="min-h-screen bg-bone">
        <div className="mx-auto min-h-screen w-full max-w-md bg-surface shadow-[0_12px_40px_-12px_rgba(31,29,26,0.18)]">
          {children}
        </div>
      </div>
    );
  }

  // 선생님 앱: 기기 잠금 게이트 + 데스크탑 사이드바 셸 (모바일에선 상단 바)
  return (
    <TeacherGate>
      <div className="min-h-screen bg-bone md:flex">
        <Sidebar />
        <main className="min-w-0 flex-1 bg-surface md:min-h-screen">
          <div className="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-8">
            {children}
          </div>
        </main>
      </div>
    </TeacherGate>
  );
}
