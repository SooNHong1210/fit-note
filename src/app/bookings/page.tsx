"use client";

import { useEffect, useState } from "react";
import { getRepository } from "@/lib/repositories";
import { subscribeBookings } from "@/lib/realtime";
import { notifyMember } from "@/lib/push";
import { getActiveShopId } from "@/lib/activeShop";
import type { Booking, Member } from "@/lib/types";
import { fmtDate, fmtDateTime, hm, toISO, ymd } from "@/lib/date";

const PILL = {
  requested: { label: "신청됨", color: "#B5862F", chip: "#FBF3E1" },
  seen: { label: "확인 중", color: "#3F6CB0", chip: "#ECF1F8" },
  approved: { label: "승인됨", color: "#3E7D5A", chip: "#EAF3ED" },
  rejected: { label: "거절됨", color: "#9A938A", chip: "#EFEBE2" },
  canceled: { label: "취소됨", color: "#9A938A", chip: "#EFEBE2" },
  proposed: { label: "시간 제안됨", color: "#B5862F", chip: "#FBF3E1" },
} as const;

export default function BookingsPage() {
  const repo = getRepository();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [mode, setMode] = useState<"reject" | "propose" | null>(null);
  const [note, setNote] = useState("");
  const [pDate, setPDate] = useState("");
  const [pTime, setPTime] = useState("10:00");

  async function refresh() {
    const [bs, ms] = await Promise.all([
      repo.listBookings(),
      repo.listMembers(),
    ]);
    setBookings(bs);
    setMembers(ms);
    setLoading(false);
  }

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      await repo.markRequestedSeen();
      await refresh();
      const shop = await repo.getShop();
      if (shop)
        unsub = subscribeBookings(shop.id, () => {
          refresh();
        });
    })();
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const member = (id: string) => members.find((m) => m.id === id);
  const memberName = (id: string) => member(id)?.name ?? "(알 수 없음)";

  async function approve(b: Booking) {
    await repo.createLesson({
      memberId: b.memberId,
      trainerId: b.trainerId,
      startsAt: b.slotStartsAt,
      endsAt: b.slotEndsAt,
    });
    await repo.updateBookingStatus(b.id, "approved");
    const sid = getActiveShopId();
    if (sid)
      notifyMember(
        sid,
        b.memberId,
        "예약이 승인되었습니다",
        `${fmtDateTime(b.slotStartsAt)} 예약이 확정되었어요.`,
      );
    refresh();
  }

  function close() {
    setOpenId(null);
    setMode(null);
    setNote("");
  }

  function openReject(b: Booking) {
    setOpenId(b.id);
    setMode("reject");
    setNote("");
  }

  function openPropose(b: Booking) {
    setOpenId(b.id);
    setMode("propose");
    setNote("");
    setPDate(ymd(new Date(b.slotStartsAt)));
    setPTime(hm(new Date(b.slotStartsAt)));
  }

  async function reject(b: Booking) {
    await repo.rejectBooking(b.id, note.trim() || undefined);
    const sid = getActiveShopId();
    if (sid)
      notifyMember(
        sid,
        b.memberId,
        "예약이 거절되었습니다",
        note.trim() || `${fmtDateTime(b.slotStartsAt)} 예약이 거절되었어요.`,
      );
    close();
    refresh();
  }

  async function propose(b: Booking) {
    const startsAt = toISO(pDate, pTime);
    const dur =
      new Date(b.slotEndsAt).getTime() - new Date(b.slotStartsAt).getTime();
    const endsAt = new Date(new Date(startsAt).getTime() + dur).toISOString();
    await repo.proposeBooking(b.id, startsAt, endsAt, note.trim() || undefined);
    const sid = getActiveShopId();
    if (sid)
      notifyMember(
        sid,
        b.memberId,
        "선생님이 다른 시간을 제안했어요",
        `${fmtDateTime(startsAt)}${note.trim() ? ` · ${note.trim()}` : ""}`,
      );
    close();
    refresh();
  }

  if (loading) return <p className="text-faint">불러오는 중…</p>;

  const pending = bookings.filter(
    (b) => b.status === "requested" || b.status === "seen",
  );
  const done = bookings.filter(
    (b) =>
      b.status === "approved" ||
      b.status === "rejected" ||
      b.status === "canceled" ||
      b.status === "proposed",
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1.5 flex items-center gap-3">
        <h1 className="text-[22px] font-extrabold tracking-tight whitespace-nowrap">
          예약 인박스
        </h1>
        {pending.length > 0 && (
          <span className="num rounded-full bg-gold px-2.5 py-0.5 text-[13px] font-bold text-white">
            {pending.length} 대기
          </span>
        )}
      </div>
      <p className="mb-5 text-[13.5px] text-faint">
        승인하면 달력에 수업이 자동 생성됩니다. (알림톡 연동 예정)
      </p>

      <div className="mb-7 flex flex-col gap-2.5">
        {pending.length === 0 ? (
          <div className="rounded-2xl bg-panel py-9 text-center text-[13.5px] font-semibold text-faintest">
            대기 중인 예약 신청이 없습니다
          </div>
        ) : (
          pending.map((b) => (
            <div
              key={b.id}
              className="rounded-2xl border border-line-warm border-l-[3px] border-l-gold bg-white p-4"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[13px] bg-sunken text-[17px] font-extrabold text-muted">
                  {memberName(b.memberId).slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[15.5px] font-bold">
                    {memberName(b.memberId)}
                  </div>
                  <div className="num mt-1 text-[13.5px] font-semibold text-ink-soft">
                    {fmtDateTime(b.slotStartsAt)}
                  </div>
                </div>
              </div>

              {openId === b.id && mode === "reject" ? (
                <div className="mt-3">
                  <input
                    autoFocus
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="거절 사유 (선택, 회원에게 전달)"
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px]"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => reject(b)}
                      className="flex-1 rounded-[9px] bg-canceled py-2 text-[13.5px] font-bold text-white"
                    >
                      거절 확정
                    </button>
                    <button
                      onClick={close}
                      className="rounded-[9px] border border-line bg-white px-4 py-2 text-[13.5px] font-semibold text-muted"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : openId === b.id && mode === "propose" ? (
                <div className="mt-3">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <input
                      type="date"
                      value={pDate}
                      onChange={(e) => setPDate(e.target.value)}
                      className="num rounded-lg border border-line bg-surface px-2 py-2 text-[14px]"
                    />
                    <input
                      type="time"
                      value={pTime}
                      onChange={(e) => setPTime(e.target.value)}
                      className="num rounded-lg border border-line bg-surface px-2 py-2 text-[14px]"
                    />
                  </div>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="제안 메모 (선택)"
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px]"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => propose(b)}
                      className="flex-1 rounded-[9px] bg-clay py-2 text-[13.5px] font-bold text-white"
                    >
                      제안 보내기
                    </button>
                    <button
                      onClick={close}
                      className="rounded-[9px] border border-line bg-white px-4 py-2 text-[13.5px] font-semibold text-muted"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => approve(b)}
                    className="flex-1 rounded-[9px] bg-[#2E5E43] px-4 py-2 text-[13.5px] font-bold text-white"
                  >
                    승인
                  </button>
                  <button
                    onClick={() => openPropose(b)}
                    className="rounded-[9px] border border-line bg-white px-3 py-2 text-[13.5px] font-semibold text-clay-deep"
                  >
                    다른 시간 제안
                  </button>
                  <button
                    onClick={() => openReject(b)}
                    className="rounded-[9px] border border-line bg-white px-3 py-2 text-[13.5px] font-semibold text-muted"
                  >
                    거절
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {done.length > 0 && (
        <>
          <div className="mb-3 text-[13px] font-bold text-faint">처리 완료</div>
          <div className="flex flex-col gap-2">
            {done.map((b) => {
              const p = PILL[b.status];
              return (
                <div
                  key={b.id}
                  className="flex items-center gap-3 rounded-xl border border-line-soft bg-panel px-4 py-3 opacity-90"
                >
                  <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px] bg-[#EAE4D8] text-[14px] font-bold text-[#8A8276]">
                    {memberName(b.memberId).slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1 text-[13.5px]">
                    <span className="font-bold">{memberName(b.memberId)}</span>
                    <span className="num text-faint">
                      {" "}
                      · {fmtDateTime(b.slotStartsAt)}
                    </span>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-1 text-[11.5px] font-bold"
                    style={{ background: p.chip, color: p.color }}
                  >
                    {p.label}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
