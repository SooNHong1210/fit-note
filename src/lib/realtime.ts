// 예약 변경 실시간 구독.
// Supabase 모드: postgres_changes 채널. localStorage 모드: 다른 탭의 storage 이벤트.
// 반환값은 구독 해제 함수.

import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export function subscribeBookings(
  shopId: string,
  onChange: () => void,
): () => void {
  if (typeof window === "undefined" || !shopId) return () => {};

  if (isSupabaseConfigured) {
    const sb = getSupabase();
    const channel = sb
      .channel(`bookings:${shopId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `shop_id=eq.${shopId}`,
        },
        () => onChange(),
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }

  // 로컬: 다른 탭에서 해당 샵 파티션이 바뀌면 storage 이벤트 발생
  const key = `fitnote.shopdata.${shopId}`;
  const handler = (e: StorageEvent) => {
    if (e.key === key) onChange();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
