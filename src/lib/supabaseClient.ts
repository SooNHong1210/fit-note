// Supabase 클라이언트. 환경변수가 있을 때만 생성됨.
// .env.local 에 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 설정 시 활성화.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// 새 Supabase는 PUBLISHABLE_KEY(sb_publishable_...), 기존은 ANON_KEY(eyJ...).
// 둘 중 어느 쪽이든 받음.
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// 모드 토글: NEXT_PUBLIC_USE_LOCAL=true 이면 키가 있어도 강제로 localStorage 모드.
// 비어 있으면 자동(키가 있으면 Supabase, 없으면 localStorage).
const forceLocal = process.env.NEXT_PUBLIC_USE_LOCAL === "true";

export const isSupabaseConfigured = !forceLocal && Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase 환경변수가 없습니다. .env.local 을 설정하거나 localStorage 모드를 쓰세요.",
    );
  }
  if (!client) {
    client = createClient(url as string, anonKey as string);
  }
  return client;
}
