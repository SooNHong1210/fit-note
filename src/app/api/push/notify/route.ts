// 서버: 특정 샵의 선생님 기기들에 웹푸시 발송.
// 회원이 예약 신청하면 호출됨. service_role 로 구독을 읽고 web-push 로 발송.
//
// 필요한 서버 환경변수(클라이언트 노출 금지):
//   SUPABASE_URL                (= NEXT_PUBLIC_SUPABASE_URL 와 동일 값)
//   SUPABASE_SERVICE_ROLE_KEY   (Supabase Settings > API > service_role)
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  (web-push generate-vapid-keys)
//   VAPID_SUBJECT               (예: mailto:you@example.com)

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const runtime = "nodejs";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PUBLIC =
  process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";

export async function POST(req: Request) {
  if (!SUPABASE_URL || !SERVICE_ROLE || !VAPID_PUBLIC || !VAPID_PRIVATE) {
    return NextResponse.json(
      { ok: false, error: "push not configured" },
      { status: 200 },
    );
  }

  let shopId: string | undefined;
  try {
    shopId = (await req.json()).shopId;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!shopId) return NextResponse.json({ ok: false }, { status: 400 });

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("endpoint, subscription")
    .eq("shop_id", shopId);
  if (error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const payload = JSON.stringify({
    title: "새 예약 신청",
    body: "회원이 예약을 신청했습니다. 인박스에서 확인하세요.",
    url: "/bookings",
  });

  const results = await Promise.allSettled(
    (subs ?? []).map(async (row) => {
      try {
        await webpush.sendNotification(
          row.subscription as webpush.PushSubscription,
          payload,
        );
      } catch (err) {
        // 만료된 구독(404/410)은 정리
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await admin
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", row.endpoint);
        }
        throw err;
      }
    }),
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return NextResponse.json({ ok: true, sent });
}
