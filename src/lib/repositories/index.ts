// 레포지토리 팩토리. 환경변수가 있으면 Supabase, 없으면 localStorage.
// → Stage 0는 설정 없이 즉시 동작, .env.local 채우면 자동으로 Supabase 전환.

import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { LocalRepository } from "./local";
import { SupabaseRepository } from "./supabase";
import type { Repository } from "./types";

let instance: Repository | null = null;

export function getRepository(): Repository {
  if (!instance) {
    instance = isSupabaseConfigured
      ? new SupabaseRepository()
      : new LocalRepository();
  }
  return instance;
}

export type { Repository } from "./types";
