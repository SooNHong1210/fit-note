"use client";

import { useEffect, useState } from "react";
import { getRepository } from "@/lib/repositories";
import type { NewAvailability, Trainer } from "@/lib/types";
import { WEEKDAYS_KO } from "@/lib/date";
import { isValidSlug, normalizeSlug, SLUG_RULE } from "@/lib/slug";
import PushToggle from "@/components/PushToggle";

export default function SettingsPage() {
  const repo = getRepository();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [sessionMinutes, setSessionMinutes] = useState(60);
  const [advanceLimit, setAdvanceLimit] = useState(0);
  const [rows, setRows] = useState<NewAvailability[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [newTrainer, setNewTrainer] = useState("");
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [editingCode, setEditingCode] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [codeError, setCodeError] = useState("");

  const repoRef = getRepository();

  async function changeCode(e: React.FormEvent) {
    e.preventDefault();
    setCodeError("");
    const c = normalizeSlug(newCode);
    if (!isValidSlug(c)) {
      setCodeError(`주소 형식이 올바르지 않습니다 (${SLUG_RULE}).`);
      return;
    }
    try {
      const shop = await repoRef.setShopCode(c);
      setCode(shop.code);
      setEditingCode(false);
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : "변경 실패");
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    (async () => {
      const [shop, av, trs] = await Promise.all([
        repo.getShop(),
        repo.listAvailability(),
        repo.listTrainers(),
      ]);
      if (shop) {
        setName(shop.name);
        setCode(shop.code);
        setSessionMinutes(shop.sessionMinutes);
        setAdvanceLimit(shop.advanceLimit);
      }
      setTrainers(trs);
      setRows(
        av.map((a) => ({
          trainerId: a.trainerId,
          weekday: a.weekday,
          startTime: a.startTime,
          endTime: a.endTime,
        })),
      );
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addTrainer(e: React.FormEvent) {
    e.preventDefault();
    if (!newTrainer.trim()) return;
    await repo.createTrainer({ name: newTrainer.trim() });
    setNewTrainer("");
    setTrainers(await repo.listTrainers());
  }

  async function removeTrainer(id: string) {
    if (!confirm("이 선생님을 삭제할까요? 연결된 담당/일정에서 해제됩니다."))
      return;
    await repo.deleteTrainer(id);
    setTrainers(await repo.listTrainers());
    setRows((r) => r.filter((row) => row.trainerId !== id));
  }

  function addRow(trainerId: string | undefined) {
    setRows((r) => [
      ...r,
      { trainerId, weekday: 1, startTime: "10:00", endTime: "18:00" },
    ]);
  }

  function updateRow(i: number, patch: Partial<NewAvailability>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  // 선생님별(또는 공통) 영업시간 그룹
  function renderGroup(trainerId: string | undefined, title: string | null) {
    const items = rows
      .map((row, i) => ({ row, i }))
      .filter(({ row }) => (row.trainerId ?? undefined) === trainerId);
    return (
      <div key={trainerId ?? "common"} className="mb-3.5 last:mb-0">
        {title && (
          <div className="mb-1.5 text-[12.5px] font-bold text-clay-deep">
            {title}
          </div>
        )}
        {items.length > 0 && (
          <div className="mb-1.5 flex flex-col gap-2">
            {items.map(({ row, i }) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select
                  value={row.weekday}
                  onChange={(e) =>
                    updateRow(i, { weekday: Number(e.target.value) })
                  }
                  className="rounded-lg border border-line bg-surface px-2 py-2"
                >
                  {WEEKDAYS_KO.map((w, idx) => (
                    <option key={idx} value={idx}>
                      {w}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={row.startTime}
                  onChange={(e) => updateRow(i, { startTime: e.target.value })}
                  className="num rounded-lg border border-line bg-surface px-2 py-2"
                />
                <span className="text-faint">~</span>
                <input
                  type="time"
                  value={row.endTime}
                  onChange={(e) => updateRow(i, { endTime: e.target.value })}
                  className="num rounded-lg border border-line bg-surface px-2 py-2"
                />
                <button
                  onClick={() => removeRow(i)}
                  className="ml-auto text-[13px] font-semibold text-canceled hover:underline"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => addRow(trainerId)}
          className="text-[12.5px] font-semibold text-clay hover:underline"
        >
          + 시간대 추가
        </button>
      </div>
    );
  }

  async function save() {
    await repo.saveShop({
      name: name.trim() || "내 샵",
      sessionMinutes,
      advanceLimit,
    });
    await repo.setAvailability(rows);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  if (loading) return <p className="text-faint">불러오는 중…</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-5 text-[22px] font-extrabold tracking-tight">설정</h1>

      {/* 샵 정보 */}
      <div className="mb-4 rounded-2xl border border-line-soft bg-white p-5">
        <div className="mb-3.5 text-[13px] font-bold text-faint">샵 정보</div>
        <div className="flex flex-col gap-3.5">
          {code && (
            <div className="rounded-[9px] border border-line-warm bg-[#FBF3EB] px-3.5 py-3">
              <div className="flex items-center justify-between">
                <div className="text-[11.5px] font-semibold text-[#A87142]">
                  샵 주소 (회원 초대 링크)
                </div>
                {!editingCode && (
                  <button
                    onClick={() => {
                      setNewCode(code);
                      setCodeError("");
                      setEditingCode(true);
                    }}
                    className="text-[11.5px] font-semibold text-clay hover:underline"
                  >
                    주소 변경
                  </button>
                )}
              </div>

              {editingCode ? (
                <form onSubmit={changeCode} className="mt-2">
                  <div className="flex items-center rounded-[8px] border border-line bg-white px-2.5">
                    <span className="num text-[12px] text-faint">/m/</span>
                    <input
                      autoFocus
                      value={newCode}
                      onChange={(e) =>
                        setNewCode(e.target.value.toLowerCase().replace(/\s/g, ""))
                      }
                      className="num w-full bg-transparent py-2 pl-0.5 outline-none"
                    />
                  </div>
                  {codeError && (
                    <p className="mt-1 text-[11.5px] text-canceled">{codeError}</p>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="submit"
                      className="rounded-[8px] bg-clay px-3 py-1.5 text-[12.5px] font-bold text-white"
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCode(false)}
                      className="rounded-[8px] border border-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-muted"
                    >
                      취소
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <div className="num break-all text-[14px] font-bold text-clay-dark">
                      {origin}/m/{code}
                    </div>
                    <button
                      onClick={async () => {
                        await navigator.clipboard?.writeText(
                          `${origin}/m/${code}`,
                        );
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                      className="flex-shrink-0 rounded-[8px] bg-clay px-3 py-2 text-[12.5px] font-bold text-white"
                    >
                      {copied ? "복사됨 ✓" : "링크 복사"}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11.5px] text-[#A87142]">
                    이 링크를 회원에게 보내면 코드 입력 없이 바로 가입합니다.
                  </p>
                </>
              )}
            </div>
          )}
          <div>
            <div className="mb-1.5 text-[12.5px] font-semibold text-[#8A8276]">
              샵 이름
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 소연 필라테스"
              className="w-full rounded-[9px] border border-line bg-surface px-3 py-2.5 text-[14.5px] font-semibold"
            />
          </div>
          <div>
            <div className="mb-1.5 text-[12.5px] font-semibold text-[#8A8276]">
              기본 세션 길이
            </div>
            <div className="flex gap-2">
              {[20, 30, 60, 90].map((d) => {
                const active = sessionMinutes === d;
                return (
                  <button
                    key={d}
                    onClick={() => setSessionMinutes(d)}
                    className="num flex-1 rounded-[9px] border py-2.5 text-[13.5px] font-bold"
                    style={{
                      borderColor: active ? "#AE6A43" : "#E1DACD",
                      background: active ? "#AE6A43" : "#FCFBF8",
                      color: active ? "#fff" : "#6B665E",
                    }}
                  >
                    {d}분
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[12.5px] font-semibold text-[#8A8276]">
              회원당 미리 예약 가능 횟수
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={advanceLimit}
                onChange={(e) =>
                  setAdvanceLimit(Math.max(0, Number(e.target.value) || 0))
                }
                className="num w-24 rounded-[9px] border border-line bg-surface px-3 py-2.5 text-[14.5px] font-semibold"
              />
              <span className="text-[12.5px] text-faint">
                회까지 (0 = 무제한)
              </span>
            </div>
            <p className="mt-1.5 text-[11.5px] text-faintest">
              한 회원이 동시에 잡아둘 수 있는 예약 수입니다. 승인 전·후 모두 포함.
            </p>
          </div>
        </div>
      </div>

      {/* 선생님 */}
      <div className="mb-4 rounded-2xl border border-line-soft bg-white p-5">
        <div className="mb-3.5 text-[13px] font-bold text-faint">선생님</div>
        {trainers.length > 0 && (
          <div className="mb-3 flex flex-col gap-1.5">
            {trainers.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg bg-panel px-3 py-2"
              >
                <span className="text-[14px] font-semibold">{t.name}</span>
                <button
                  onClick={() => removeTrainer(t.id)}
                  className="text-[12.5px] font-semibold text-canceled hover:underline"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={addTrainer} className="flex gap-2">
          <input
            value={newTrainer}
            onChange={(e) => setNewTrainer(e.target.value)}
            placeholder="선생님 이름"
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2"
          />
          <button
            type="submit"
            className="flex-shrink-0 rounded-lg bg-clay px-4 font-bold text-white"
          >
            추가
          </button>
        </form>
        <p className="mt-2 text-[11.5px] text-faintest">
          여러 선생님을 등록하면 수업·영업시간을 선생님별로 지정할 수 있습니다.
          (1명이면 자동 적용)
        </p>
      </div>

      {/* 예약 알림 (웹푸시) */}
      <div className="mb-4">
        <PushToggle />
      </div>

      {/* 영업시간 */}
      <div className="rounded-2xl border border-line-soft bg-white p-5">
        <div className="mb-3.5 text-[13px] font-bold text-faint">
          요일별 영업시간
        </div>
        {trainers.length === 0 ? (
          renderGroup(undefined, null)
        ) : (
          <>
            {trainers.map((t) => renderGroup(t.id, t.name))}
            {renderGroup(undefined, "공통 (모든 선생님)")}
          </>
        )}
        <p className="mt-2 text-[11.5px] text-faintest">
          {trainers.length > 0
            ? "선생님별로 영업시간을 따로 지정하세요. ‘공통’은 모든 선생님에게 적용됩니다."
            : "영업시간을 추가하면 회원에게 그 시간대의 빈 슬롯이 노출됩니다."}
        </p>
      </div>

      <button
        onClick={save}
        className="mt-5 w-full rounded-[10px] bg-clay py-2.5 font-bold text-white shadow-[0_1px_2px_rgba(174,106,67,0.4)]"
      >
        {saved ? "저장됨 ✓" : "저장"}
      </button>

      <p className="mt-5 border-t border-line-soft pt-4 text-[13px] text-faint">
        회원용 예약 페이지:{" "}
        <a href="/m" className="font-semibold text-clay underline">
          /m
        </a>{" "}
        (회원에게 이 링크를 공유)
      </p>
    </div>
  );
}
