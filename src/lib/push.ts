// 웹푸시 (클라이언트). Supabase 모드 + VAPID 공개키 + 배포(HTTPS)에서만 동작.
// 선생님이 "알림 받기"로 구독 → push_subscriptions 저장. 회원 예약 시 서버가 발송.

import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    isSupabaseConfigured &&
    !!VAPID_PUBLIC
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// 선생님 기기에서 알림 구독 → DB 저장
export async function subscribeTeacherPush(shopId: string): Promise<void> {
  if (!pushSupported()) throw new Error("이 환경에서는 알림을 지원하지 않습니다.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("알림 권한이 거부되었습니다.");

  const reg =
    (await navigator.serviceWorker.getRegistration()) ??
    (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(
      VAPID_PUBLIC as string,
    ) as BufferSource,
  });

  const json = sub.toJSON();
  const { error } = await getSupabase()
    .from("push_subscriptions")
    .upsert(
      { shop_id: shopId, endpoint: json.endpoint, subscription: json },
      { onConflict: "endpoint" },
    );
  if (error) throw error;
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return !!sub;
}

// 회원 예약 시 선생님에게 알림 발송 요청 (실패해도 무시)
export function notifyTeacher(shopId: string): void {
  if (!isSupabaseConfigured) return;
  fetch("/api/push/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shopId }),
  }).catch(() => {});
}
