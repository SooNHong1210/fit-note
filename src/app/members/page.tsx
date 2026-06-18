"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getRepository } from "@/lib/repositories";
import type { Member } from "@/lib/types";
import { passRemaining } from "@/lib/pass";

export default function MembersPage() {
  const repo = getRepository();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");

  async function refresh() {
    setMembers(await repo.listMembers());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await repo.createMember({
      name: name.trim(),
      birthDate: birthDate.trim() || undefined,
      phone: phone.trim() || undefined,
    });
    setName("");
    setBirthDate("");
    setPhone("");
    setAdding(false);
    refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-[21px] font-extrabold tracking-tight">
          회원 <span className="num text-[18px] text-clay">{members.length}</span>
        </h1>
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded-[9px] bg-clay px-3.5 py-2 text-[13px] font-bold text-white shadow-[0_1px_2px_rgba(174,106,67,0.4)]"
        >
          {adding ? "닫기" : "+ 회원 추가"}
        </button>
      </div>

      {adding && (
        <form
          onSubmit={add}
          className="mb-5 space-y-2 rounded-2xl border border-line-soft bg-white p-4"
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름 *"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2"
          />
          <input
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            placeholder="생년월일 (예: 1990-01-15)"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="전화번호 (알림톡용, 선택)"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-clay py-2 font-bold text-white"
          >
            저장
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-faint">불러오는 중…</p>
      ) : members.length === 0 ? (
        <p className="text-faint">아직 회원이 없습니다. “+ 회원 추가”로 시작하세요.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {members.map((m) => {
            const remain = passRemaining(m);
            const countColor =
              m.passTotal === 0
                ? "#B0A99D"
                : remain === 0
                  ? "#B25148"
                  : remain <= 2
                    ? "#B5862F"
                    : "#3A362F";
            return (
              <Link
                key={m.id}
                href={`/members/${m.id}`}
                className="flex items-center gap-3 rounded-[11px] px-3 py-2.5 transition hover:bg-panel"
              >
                <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px] bg-clay/12 text-[15px] font-extrabold text-clay">
                  {m.name.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-bold tracking-tight">
                    {m.name}
                  </div>
                  <div className="num text-xs text-faint">
                    {m.phone ?? m.birthDate ?? ""}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div
                    className="num text-[13.5px] font-semibold"
                    style={{ color: countColor }}
                  >
                    {m.passTotal > 0 ? `${m.passUsed}/${m.passTotal}` : "—"}
                  </div>
                  <div className="text-[10.5px] text-faintest">
                    {m.passTotal > 0 ? `${remain}회 남음` : "회원권 없음"}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
