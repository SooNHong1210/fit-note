"use client";

import { useEffect, useState } from "react";
import { getAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { isValidSlug, normalizeSlug, SLUG_RULE } from "@/lib/slug";

type Status = "loading" | "unauthed" | "authed";

export default function TeacherGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    getAuth()
      .current()
      .then((s) => setStatus(s ? "authed" : "unauthed"))
      .catch(() => setStatus("unauthed"));
  }, []);

  if (status === "loading") return <div className="min-h-screen bg-bone" />;
  if (status === "authed") return <>{children}</>;
  return <AuthForm onAuthed={() => setStatus("authed")} />;
}

function AuthForm({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [slug, setSlug] = useState("");
  const [origin, setOrigin] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  function switchMode(m: typeof mode) {
    setMode(m);
    setError("");
    setInfo("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (mode === "signup") {
      if (password.length < 6)
        return setError("비밀번호는 6자 이상이어야 합니다.");
      if (!isValidSlug(normalizeSlug(slug)))
        return setError(`샵 주소 형식이 올바르지 않습니다 (${SLUG_RULE}).`);
    }
    setBusy(true);
    try {
      const auth = getAuth();
      if (mode === "signup") {
        await auth.signUp(email, password, shopName, normalizeSlug(slug));
        onAuthed();
      } else if (mode === "reset") {
        const r = await auth.requestReset(
          email,
          isSupabaseConfigured ? undefined : password,
        );
        if (r.emailed) {
          setInfo("재설정 메일을 보냈습니다. 메일의 링크로 새 비밀번호를 설정하세요.");
        } else {
          setInfo("비밀번호를 변경했습니다. 새 비밀번호로 로그인하세요.");
          setMode("signin");
        }
      } else {
        await auth.signIn(email, password);
        onAuthed();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bone px-5">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-line-soft bg-surface p-7 shadow-[0_12px_40px_-12px_rgba(31,29,26,0.18)]"
      >
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[14px] bg-clay text-[22px] font-extrabold tracking-tighter text-white">
            핏
          </div>
          <h1 className="text-[19px] font-extrabold tracking-tight">
            {mode === "signup"
              ? "샵 만들기"
              : mode === "reset"
                ? "비밀번호 찾기"
                : "선생님 로그인"}
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            {mode === "signup"
              ? "내 샵을 등록하고 핏노트를 시작하세요."
              : mode === "reset"
                ? isSupabaseConfigured
                  ? "가입 이메일로 재설정 링크를 보냅니다."
                  : "이메일과 새 비밀번호를 입력하면 바로 변경됩니다."
                : "내 샵 계정으로 로그인하세요."}
          </p>
        </div>

        <div className="space-y-2">
          {mode === "signup" && (
            <>
              <input
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="샵 이름 (예: 소연 필라테스)"
                className="w-full rounded-[10px] border border-line bg-white px-3.5 py-3"
              />
              <div>
                <div className="flex items-center rounded-[10px] border border-line bg-white px-3.5">
                  <span className="num text-[13px] text-faint">/m/</span>
                  <input
                    value={slug}
                    onChange={(e) =>
                      setSlug(e.target.value.toLowerCase().replace(/\s/g, ""))
                    }
                    placeholder="soyeon-pilates"
                    className="num w-full bg-transparent py-3 pl-0.5 outline-none"
                  />
                </div>
                <p className="mt-1 px-1 text-[11.5px] text-faint">
                  내 샵 주소 — 회원 초대 링크가 됩니다
                  {slug && origin
                    ? `: ${origin}/m/${normalizeSlug(slug)}`
                    : ` (${SLUG_RULE})`}
                </p>
              </div>
            </>
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일"
            className="w-full rounded-[10px] border border-line bg-white px-3.5 py-3"
          />
          {!(mode === "reset" && isSupabaseConfigured) && (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "reset" ? "새 비밀번호" : "비밀번호"}
              className="w-full rounded-[10px] border border-line bg-white px-3.5 py-3"
            />
          )}
        </div>

        {error && (
          <p className="mt-2 text-center text-[13px] text-canceled">{error}</p>
        )}
        {info && (
          <p className="mt-2 text-center text-[13px] font-semibold text-done">
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-3 w-full rounded-[10px] bg-clay py-3 font-bold text-white disabled:opacity-50"
        >
          {busy
            ? "처리 중…"
            : mode === "signup"
              ? "샵 만들기"
              : mode === "reset"
                ? isSupabaseConfigured
                  ? "재설정 메일 보내기"
                  : "비밀번호 변경"
                : "로그인"}
        </button>

        <div className="mt-3 flex flex-col items-center gap-1.5">
          {mode === "signin" && (
            <button
              type="button"
              onClick={() => switchMode("reset")}
              className="text-[13px] text-faint hover:text-clay"
            >
              비밀번호를 잊으셨나요?
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              switchMode(
                mode === "signup" || mode === "reset" ? "signin" : "signup",
              )
            }
            className="text-[13px] font-semibold text-muted hover:text-clay"
          >
            {mode === "signup"
              ? "이미 계정이 있어요 — 로그인"
              : mode === "reset"
                ? "로그인으로 돌아가기"
                : "처음이세요? — 샵 만들기"}
          </button>
        </div>
      </form>
    </div>
  );
}
