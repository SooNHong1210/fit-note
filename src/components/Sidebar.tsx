"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getRepository } from "@/lib/repositories";
import { getAuth } from "@/lib/auth";
import { subscribeBookings } from "@/lib/realtime";

const links = [
  { href: "/calendar", label: "달력" },
  { href: "/members", label: "회원" },
  { href: "/bookings", label: "예약", badge: true },
  { href: "/settings", label: "설정" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [shopName, setShopName] = useState("");
  const [shopCode, setShopCode] = useState("");
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const repo = getRepository();
    let unsub = () => {};
    const countPending = async () => {
      const bookings = await repo.listBookings();
      setPending(
        bookings.filter((b) => b.status === "requested" || b.status === "seen")
          .length,
      );
    };
    (async () => {
      const shop = await repo.getShop();
      setShopName(shop?.name ?? "");
      setShopCode(shop?.code ?? "");
      await countPending();
      if (shop) unsub = subscribeBookings(shop.id, countPending);
    })();
    return () => unsub();
  }, [pathname]);

  async function signOut() {
    await getAuth().signOut();
    window.location.reload();
  }

  const brand = (
    <div className="flex items-center gap-2.5">
      <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-clay text-[15px] font-extrabold tracking-tighter text-white">
        핏
      </div>
      <div className="text-[17px] font-extrabold tracking-tight whitespace-nowrap">
        핏노트
      </div>
    </div>
  );

  const navButtons = links.map((l) => {
    const active = pathname === l.href || pathname.startsWith(l.href + "/");
    return (
      <Link
        key={l.href}
        href={l.href}
        className={`flex items-center justify-between gap-2 rounded-[10px] px-3.5 py-2.5 text-[14.5px] font-semibold whitespace-nowrap transition ${
          active ? "bg-clay text-white" : "text-muted hover:bg-line-soft/60"
        }`}
      >
        <span>{l.label}</span>
        {l.badge && pending > 0 && (
          <span className="num flex h-5 min-w-5 items-center justify-center rounded-[10px] bg-gold px-1.5 text-[11.5px] font-bold text-white">
            {pending}
          </span>
        )}
      </Link>
    );
  });

  return (
    <>
      {/* 데스크탑 사이드바 */}
      <aside className="hidden w-[228px] flex-shrink-0 flex-col gap-1 border-r border-line-soft bg-panel px-3.5 py-5 md:flex">
        <div className="px-3 pt-1.5 pb-5">{brand}</div>
        {navButtons}
        <div className="mt-auto border-t border-line-soft px-3 pt-3.5">
          <div className="text-xs text-faint">운영 중인 샵</div>
          <div className="text-sm font-bold tracking-tight">
            {shopName || "샵 미설정"}
          </div>
          {shopCode && (
            <div className="num mt-1 text-[11.5px] text-faint">
              가입 코드 <span className="font-bold text-clay">{shopCode}</span>
            </div>
          )}
          <button
            onClick={signOut}
            className="mt-2.5 text-[11.5px] font-semibold text-faint hover:text-clay"
          >
            로그아웃
          </button>
        </div>
      </aside>

      {/* 모바일 상단 바 */}
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line-soft bg-panel px-4 py-3 md:hidden">
        {brand}
        <nav className="ml-auto flex gap-1">{navButtons}</nav>
      </header>
    </>
  );
}
