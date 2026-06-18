"use client";

import { useState } from "react";
import Link from "next/link";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";

// Supabase 비밀번호 재설정 메일의 링크가 도착하는 페이지.
// 메일 클릭 시 복구 세션이 생기고, 여기서 새 비밀번호를 설정한다.
export default function ResetPage() {
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("비밀번호는 6자 이상이어야 합니다.");
    setBusy(true);
    try {
      const { error } = await getSupabase().auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "재설정에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bone px-5">
      <div className="w-full max-w-sm rounded-2xl border border-line-soft bg-surface p-7 shadow-[0_12px_40px_-12px_rgba(31,29,26,0.18)]">
        <h1 className="mb-1 text-[19px] font-extrabold tracking-tight">
          새 비밀번호 설정
        </h1>
        {!isSupabaseConfigured ? (
          <p className="text-[13px] text-muted">
            이 페이지는 Supabase 모드에서만 사용됩니다.
          </p>
        ) : done ? (
          <div>
            <p className="text-[13.5px] font-semibold text-done">
              비밀번호가 변경되었습니다.
            </p>
            <Link
              href="/calendar"
              className="mt-4 inline-block rounded-[10px] bg-clay px-4 py-2.5 font-bold text-white"
            >
              로그인하러 가기
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-2">
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="새 비밀번호"
              className="w-full rounded-[10px] border border-line bg-white px-3.5 py-3"
            />
            {error && <p className="text-[13px] text-canceled">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-[10px] bg-clay py-3 font-bold text-white disabled:opacity-50"
            >
              {busy ? "변경 중…" : "비밀번호 변경"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
