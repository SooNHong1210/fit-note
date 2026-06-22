"use client";

import { useEffect, useState } from "react";
import {
  isPushSubscribed,
  pushSupported,
  subscribeMemberPush,
} from "@/lib/push";
import { getActiveShopId } from "@/lib/activeShop";

// 회원 기기에서 예약 알림 구독. Supabase+배포(HTTPS) 환경에서만 노출.
export default function MemberPushToggle({ memberId }: { memberId: string }) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const ok = pushSupported();
      setSupported(ok);
      if (ok) setSubscribed(await isPushSubscribed());
    })();
  }, []);

  async function enable() {
    const sid = getActiveShopId();
    if (!sid) return;
    setBusy(true);
    setError("");
    try {
      await subscribeMemberPush(sid, memberId);
      setSubscribed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "구독 실패");
    } finally {
      setBusy(false);
    }
  }

  if (!supported || subscribed) return null;
  return (
    <div>
      <button
        onClick={enable}
        disabled={busy}
        className="w-full rounded-[10px] border border-line bg-white py-2.5 text-[13px] font-bold text-clay disabled:opacity-50"
      >
        {busy ? "설정 중…" : "🔔 예약 알림 받기"}
      </button>
      {error && <p className="mt-1.5 text-[12px] text-canceled">{error}</p>}
    </div>
  );
}
