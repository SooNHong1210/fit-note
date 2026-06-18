"use client";

import { useEffect, useState } from "react";
import { getRepository } from "@/lib/repositories";
import { subscribeBookings } from "@/lib/realtime";
import type { Booking, Member } from "@/lib/types";
import { fmtDate, fmtDateTime } from "@/lib/date";

const PILL = {
  requested: { label: "신청됨", color: "#B5862F", chip: "#FBF3E1" },
  seen: { label: "확인 중", color: "#3F6CB0", chip: "#ECF1F8" },
  approved: { label: "승인됨", color: "#3E7D5A", chip: "#EAF3ED" },
  rejected: { label: "거절됨", color: "#9A938A", chip: "#EFEBE2" },
} as const;

export default function BookingsPage() {
  const repo = getRepository();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

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
      startsAt: b.slotStartsAt,
      endsAt: b.slotEndsAt,
    });
    await repo.updateBookingStatus(b.id, "approved");
    refresh();
  }

  async function reject(b: Booking) {
    await repo.updateBookingStatus(b.id, "rejected");
    refresh();
  }

  if (loading) return <p className="text-faint">불러오는 중…</p>;

  const pending = bookings.filter(
    (b) => b.status === "requested" || b.status === "seen",
  );
  const done = bookings.filter(
    (b) => b.status === "approved" || b.status === "rejected",
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
              className="flex items-center gap-4 rounded-2xl border border-line-warm border-l-[3px] border-l-gold bg-white p-4"
            >
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[13px] bg-sunken text-[17px] font-extrabold text-muted">
                {memberName(b.memberId).slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15.5px] font-bold">
                  {memberName(b.memberId)}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[13.5px] text-ink-soft">
                  <span className="font-semibold">
                    {fmtDate(b.slotStartsAt)}
                  </span>
                  <span className="text-line">·</span>
                  <span className="num font-semibold">
                    {fmtDateTime(b.slotStartsAt).split(" ")[1]}
                  </span>
                </div>
              </div>
              <div className="flex flex-shrink-0 gap-2">
                <button
                  onClick={() => approve(b)}
                  className="rounded-[9px] bg-[#2E5E43] px-4 py-2 text-[13.5px] font-bold text-white"
                >
                  승인
                </button>
                <button
                  onClick={() => reject(b)}
                  className="rounded-[9px] border border-line bg-white px-4 py-2 text-[13.5px] font-semibold text-muted"
                >
                  거절
                </button>
              </div>
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
