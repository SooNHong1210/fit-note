"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getRepository } from "@/lib/repositories";
import type { Comment, Lesson, Member, Trainer } from "@/lib/types";
import { clampPassUsed, nextPassUsedOnDone, passRemaining } from "@/lib/pass";
import { fmtDate, fmtDateTime } from "@/lib/date";

const STATUS = {
  scheduled: { label: "예정", color: "#3F6CB0", chip: "#ECF1F8" },
  done: { label: "완료", color: "#3E7D5A", chip: "#EAF3ED" },
  canceled: { label: "취소", color: "#B25148", chip: "#F8ECEA" },
} as const;

export default function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const repo = getRepository();
  const router = useRouter();

  const [member, setMember] = useState<Member | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [passInput, setPassInput] = useState("");
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [editing, setEditing] = useState(false);
  const [eName, setEName] = useState("");
  const [eBirth, setEBirth] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [eTrainer, setETrainer] = useState("");

  async function refresh() {
    const [m, ls, cs, trs] = await Promise.all([
      repo.getMember(id),
      repo.listLessonsByMember(id),
      repo.listCommentsByMember(id),
      repo.listTrainers(),
    ]);
    setMember(m);
    setLessons(ls);
    setComments(cs);
    setTrainers(trs);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    await repo.createComment({ memberId: id, text: commentText.trim() });
    setCommentText("");
    refresh();
  }

  function startEdit() {
    if (!member) return;
    setEName(member.name);
    setEBirth(member.birthDate ?? "");
    setEPhone(member.phone ?? "");
    setETrainer(member.trainerId ?? "");
    setEditing(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!eName.trim()) return;
    await repo.updateMember(id, {
      name: eName.trim(),
      birthDate: eBirth.trim() || undefined,
      phone: ePhone.trim() || undefined,
      trainerId: eTrainer || undefined,
    });
    setEditing(false);
    refresh();
  }

  async function removeMember() {
    if (!confirm(`${member?.name} 회원을 삭제할까요? 수업·코멘트도 함께 삭제됩니다.`))
      return;
    await repo.deleteMember(id);
    router.push("/members");
  }

  async function markDone(lessonId: string) {
    await repo.updateLesson(lessonId, { status: "done" });
    if (member) {
      const used = nextPassUsedOnDone(member);
      if (used !== member.passUsed) await repo.updateMember(id, { passUsed: used });
    }
    refresh();
  }

  async function setPass(e: React.FormEvent) {
    e.preventDefault();
    const total = Number(passInput);
    if (!Number.isFinite(total) || total <= 0) return;
    await repo.updateMember(id, { passTotal: total, passUsed: 0 });
    setPassInput("");
    refresh();
  }

  async function adjustUsed(delta: number) {
    if (!member) return;
    await repo.updateMember(id, { passUsed: clampPassUsed(member, delta) });
    refresh();
  }

  if (loading) return <p className="text-faint">불러오는 중…</p>;
  if (!member) return <p className="text-faint">회원을 찾을 수 없습니다.</p>;

  const remain = passRemaining(member);
  const remainPct =
    member.passTotal > 0 ? (remain / member.passTotal) * 100 : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/members"
        className="inline-block text-[13px] font-semibold text-faint hover:text-clay"
      >
        ‹ 회원 목록
      </Link>

      {/* header */}
      {editing ? (
        <form
          onSubmit={saveEdit}
          className="space-y-2 rounded-2xl border border-line-soft bg-white p-5"
        >
          <div className="mb-1 text-[13px] font-bold text-faint">회원 정보 수정</div>
          <input
            value={eName}
            onChange={(e) => setEName(e.target.value)}
            placeholder="이름 *"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2"
          />
          <input
            value={eBirth}
            onChange={(e) => setEBirth(e.target.value)}
            placeholder="생년월일 (예: 1990-01-15)"
            className="num w-full rounded-lg border border-line bg-surface px-3 py-2"
          />
          <input
            value={ePhone}
            onChange={(e) => setEPhone(e.target.value)}
            placeholder="전화번호 (선택)"
            className="num w-full rounded-lg border border-line bg-surface px-3 py-2"
          />
          {trainers.length > 0 && (
            <select
              value={eTrainer}
              onChange={(e) => setETrainer(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2"
            >
              <option value="">담당 선생님 없음</option>
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-clay py-2 font-bold text-white"
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-line bg-white px-4 py-2 font-semibold text-muted"
            >
              취소
            </button>
          </div>
        </form>
      ) : (
        <header className="flex items-center gap-4">
          <div className="flex h-[62px] w-[62px] items-center justify-center rounded-[18px] bg-clay text-[26px] font-extrabold text-white">
            {member.name.slice(0, 1)}
          </div>
          <div className="flex-1">
            <div className="text-[24px] font-extrabold tracking-tight">
              {member.name}
            </div>
            <div className="num mt-1 flex flex-wrap gap-3.5 text-[13px] text-muted">
              {member.birthDate && <span>{member.birthDate}</span>}
              {member.phone && <span>{member.phone}</span>}
              {member.trainerId && (
                <span className="font-semibold text-clay-deep">
                  담당 {trainers.find((t) => t.id === member.trainerId)?.name}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <button
              onClick={startEdit}
              className="text-[13px] font-semibold text-muted hover:text-clay"
            >
              수정
            </button>
            <button
              onClick={removeMember}
              className="text-[13px] font-semibold text-canceled hover:underline"
            >
              삭제
            </button>
          </div>
        </header>
      )}

      {/* membership card */}
      {member.passTotal > 0 ? (
        <div
          className="flex items-center justify-between rounded-2xl border border-line-warm p-5"
          style={{ background: "linear-gradient(135deg,#FBF3EB,#F5EADF)" }}
        >
          <div>
            <div className="text-[12.5px] font-bold text-[#A87142]">
              회원권 잔여
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="num text-[38px] leading-none font-semibold tracking-tight text-clay-dark">
                {remain}
              </span>
              <span className="text-[15px] font-semibold text-[#A87142]">
                / {member.passTotal}회 남음
              </span>
            </div>
            <div className="mt-3 h-[7px] w-[220px] max-w-full overflow-hidden rounded bg-[#E7D3BF]">
              <div
                className="h-full rounded bg-clay"
                style={{ width: `${remainPct}%` }}
              />
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                onClick={() => adjustUsed(-1)}
                className="rounded-md border border-[#E0CBB4] bg-white px-2 py-0.5 text-xs font-semibold text-clay-deep"
              >
                −1
              </button>
              <button
                onClick={() => adjustUsed(1)}
                className="rounded-md border border-[#E0CBB4] bg-white px-2 py-0.5 text-xs font-semibold text-clay-deep"
              >
                +1
              </button>
              <span className="text-[11px] text-[#A87142]">수동 보정</span>
            </div>
          </div>
          <form onSubmit={setPass} className="flex flex-col gap-2">
            <input
              type="number"
              min={1}
              value={passInput}
              onChange={(e) => setPassInput(e.target.value)}
              placeholder="횟수"
              className="num w-[120px] rounded-[9px] border border-[#E0CBB4] bg-white px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-[9px] bg-clay px-4 py-2 text-[13px] font-bold text-white"
            >
              재발급
            </button>
          </form>
        </div>
      ) : (
        <div className="rounded-2xl border border-line-warm bg-[#FBF3EB] p-5">
          <div className="text-[12.5px] font-bold text-[#A87142]">
            회원권 미발급
          </div>
          <form onSubmit={setPass} className="mt-2.5 flex gap-2">
            <input
              type="number"
              min={1}
              value={passInput}
              onChange={(e) => setPassInput(e.target.value)}
              placeholder="총 횟수 (예: 10)"
              className="num flex-1 rounded-[9px] border border-[#E0CBB4] bg-white px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-[9px] bg-clay px-4 text-[13px] font-bold text-white"
            >
              발급
            </button>
          </form>
        </div>
      )}

      {/* comments */}
      <section>
        <h2 className="mb-3 text-[16px] font-extrabold tracking-tight">
          수업 코멘트
        </h2>
        <form onSubmit={addComment} className="mb-3 flex gap-2">
          <input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="수업 후 한마디…"
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2"
          />
          <button
            type="submit"
            className="flex-shrink-0 rounded-lg bg-clay px-4 font-bold text-white"
          >
            등록
          </button>
        </form>
        {comments.length === 0 ? (
          <p className="text-[13px] text-faintest">코멘트가 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {comments.map((c) => (
              <div
                key={c.id}
                className="group rounded-xl border border-line-soft bg-white p-3.5"
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="num text-[11.5px] font-bold text-clay">
                    {fmtDate(c.createdAt)}
                  </span>
                  <button
                    onClick={async () => {
                      await repo.deleteComment(c.id);
                      refresh();
                    }}
                    className="text-[11px] text-faintest opacity-0 transition group-hover:opacity-100 hover:text-canceled"
                  >
                    삭제
                  </button>
                </div>
                <p className="text-[13.5px] leading-relaxed text-ink-soft">
                  {c.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* lessons */}
      <section>
        <h2 className="mb-3 text-[16px] font-extrabold tracking-tight">
          수업 기록
        </h2>
        {lessons.length === 0 ? (
          <p className="text-[13px] text-faintest">
            수업이 없습니다. 달력에서 일정을 추가하세요.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {lessons.map((l) => {
              const st = STATUS[l.status];
              return (
                <div
                  key={l.id}
                  className="flex items-center justify-between rounded-xl border border-line-soft bg-white px-4 py-3"
                >
                  <span className="num text-[13.5px] font-semibold">
                    {fmtDateTime(l.startsAt)}
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[11.5px] font-bold"
                      style={{ background: st.chip, color: st.color }}
                    >
                      {st.label}
                    </span>
                    {l.status === "scheduled" && (
                      <button
                        onClick={() => markDone(l.id)}
                        className="rounded-md border border-line bg-surface px-2 py-0.5 text-xs font-semibold text-muted"
                      >
                        완료
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
