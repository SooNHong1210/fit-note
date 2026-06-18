"use client";

import { useEffect, useState } from "react";
import { getRepository } from "@/lib/repositories";
import {
  isPushSubscribed,
  pushSupported,
  subscribeTeacherPush,
} from "@/lib/push";

export default function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [shopId, setShopId] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const ok = pushSupported();
      setSupported(ok);
      if (!ok) return;
      const shop = await getRepository().getShop();
      setShopId(shop?.id ?? null);
      setSubscribed(await isPushSubscribed());
    })();
  }, []);

  async function enable() {
    if (!shopId) return;
    setBusy(true);
    setError("");
    try {
      await subscribeTeacherPush(shopId);
      setSubscribed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "구독 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line-soft bg-white p-5">
      <div className="mb-1.5 text-[13px] font-bold text-faint">예약 알림</div>
      {!supported ? (
        <p className="text-[12.5px] text-faintest">
          웹푸시 알림은 Supabase 모드 + 배포(HTTPS) 환경에서 동작합니다. 그
          전까지는 앱을 열어두면 인박스가 실시간 갱신됩니다.
        </p>
      ) : subscribed ? (
        <p className="text-[13px] font-semibold text-done">
          이 기기로 알림이 켜져 있습니다 ✓
        </p>
      ) : (
        <>
          <p className="mb-2.5 text-[12.5px] text-muted">
            새 예약 신청이 오면 이 기기로 알림을 받습니다.
          </p>
          <button
            onClick={enable}
            disabled={busy}
            className="rounded-[9px] bg-clay px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50"
          >
            {busy ? "설정 중…" : "이 기기로 알림 받기"}
          </button>
          {error && <p className="mt-2 text-[12.5px] text-canceled">{error}</p>}
        </>
      )}
    </div>
  );
}
