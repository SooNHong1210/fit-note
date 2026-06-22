"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getRepository } from "@/lib/repositories";
import type { ClassWithCount, Lesson, Member, Trainer } from "@/lib/types";
import { nextPassUsedOnDone } from "@/lib/pass";
import {
  addDays,
  addMonths,
  calendarGridStart,
  hm,
  sameDay,
  startOfMonth,
  toISO,
  WEEKDAYS_KO,
  ymd,
} from "@/lib/date";

const STATUS = {
  scheduled: { label: "예정", color: "#3F6CB0", chip: "#ECF1F8" },
  done: { label: "완료", color: "#3E7D5A", chip: "#EAF3ED" },
  canceled: { label: "취소", color: "#B25148", chip: "#F8ECEA" },
} as const;

export default function CalendarPage() {
  const repo = getRepository();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [classes, setClasses] = useState<ClassWithCount[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());

  const gridStart = useMemo(() => calendarGridStart(month), [month]);
  const days = useMemo(
    () => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)),
    [gridStart],
  );

  async function refresh() {
    const from = gridStart.toISOString();
    const to = addDays(gridStart, 42).toISOString();
    const [ls, ms, cs, trs] = await Promise.all([
      repo.listLessons({ from, to }),
      repo.listMembers(),
      repo.listClasses({ from, to }),
      repo.listTrainers(),
    ]);
    setLessons(ls);
    setMembers(ms);
    setClasses(cs);
    setTrainers(trs);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridStart]);

  const memberName = (id: string) =>
    members.find((m) => m.id === id)?.name ?? "(삭제된 회원)";

  const lessonsByDay = (day: Date) =>
    lessons
      .filter((l) => sameDay(new Date(l.startsAt), day))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const classesByDay = (day: Date) =>
    classes
      .filter((c) => sameDay(new Date(c.startsAt), day))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const today = new Date();

  return (
    <div>
      {/* header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <h1 className="num text-[22px] font-extrabold tracking-tight">
            {month.getFullYear()}년 {month.getMonth() + 1}월
          </h1>
          <div className="flex gap-1">
            <button
              onClick={() => setMonth((m) => addMonths(m, -1))}
              className="h-[30px] w-[30px] rounded-lg border border-line bg-surface text-muted"
            >
              ‹
            </button>
            <button
              onClick={() => setMonth((m) => addMonths(m, 1))}
              className="h-[30px] w-[30px] rounded-lg border border-line bg-surface text-muted"
            >
              ›
            </button>
          </div>
          <button
            onClick={() => setMonth(startOfMonth(new Date()))}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink-soft"
          >
            오늘
          </button>
        </div>
        <div className="flex items-center gap-3.5 text-xs text-faint">
          {(["scheduled", "done", "canceled"] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: STATUS[s].color }}
              />
              {STATUS[s].label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row">
        {/* grid */}
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 grid grid-cols-7">
            {WEEKDAYS_KO.map((w, i) => (
              <div
                key={w}
                className="py-1 text-center text-xs font-bold"
                style={{ color: i === 0 ? "#B25148" : "#9A938A" }}
              >
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((day) => {
              const inMonth = day.getMonth() === month.getMonth();
              const dayLessons = lessonsByDay(day);
              const dayClasses = classesByDay(day);
              const isSel = sameDay(day, selectedDay);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(day)}
                  className="flex min-h-[78px] flex-col gap-1 overflow-hidden rounded-[10px] border bg-surface p-1.5 text-left"
                  style={{
                    opacity: inMonth ? 1 : 0.4,
                    borderColor: isSel ? "#AE6A43" : "#ECE6DB",
                    boxShadow: isSel ? "0 0 0 1px #AE6A43" : "none",
                  }}
                >
                  <div className="flex items-center justify-between">
                    {sameDay(day, today) ? (
                      <span className="num flex h-5 w-5 items-center justify-center rounded-full bg-clay text-[12px] font-bold text-white">
                        {day.getDate()}
                      </span>
                    ) : (
                      <span
                        className="num text-[12.5px] font-semibold"
                        style={{ color: day.getDay() === 0 ? "#B25148" : "#6B665E" }}
                      >
                        {day.getDate()}
                      </span>
                    )}
                  </div>
                  {dayClasses.slice(0, 2).map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-1 rounded-[5px] bg-[#F3E7DC] px-1.5 py-0.5"
                    >
                      <span className="num flex-shrink-0 text-[10px] text-clay-deep">
                        {hm(new Date(c.startsAt))}
                      </span>
                      <span className="truncate text-[11px] font-bold text-clay-dark">
                        {c.title}
                      </span>
                      <span className="num ml-auto flex-shrink-0 text-[9.5px] text-clay-deep">
                        {c.enrolledCount}/{c.capacity}
                      </span>
                    </div>
                  ))}
                  {dayLessons.slice(0, 2).map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center gap-1.5 rounded-[5px] px-1.5 py-0.5"
                      style={{ background: STATUS[l.status].chip }}
                    >
                      <span
                        className="h-[5px] w-[5px] flex-shrink-0 rounded-full"
                        style={{ background: STATUS[l.status].color }}
                      />
                      <span className="num flex-shrink-0 text-[10px] text-muted">
                        {hm(new Date(l.startsAt))}
                      </span>
                      <span className="truncate text-[11px] font-semibold text-ink-soft">
                        {memberName(l.memberId)}
                      </span>
                    </div>
                  ))}
                  {dayLessons.length + dayClasses.length > 4 && (
                    <div className="pl-1.5 text-[10.5px] font-semibold text-faint">
                      +{dayLessons.length + dayClasses.length - 4}건 더
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* day panel */}
        <DayPanel
          day={selectedDay}
          lessons={lessonsByDay(selectedDay)}
          classes={classesByDay(selectedDay)}
          members={members}
          trainers={trainers}
          memberName={memberName}
          onChanged={refresh}
        />
      </div>
    </div>
  );
}

function DayPanel({
  day,
  lessons,
  classes,
  members,
  trainers,
  memberName,
  onChanged,
}: {
  day: Date;
  lessons: Lesson[];
  classes: ClassWithCount[];
  members: Member[];
  trainers: Trainer[];
  memberName: (id: string) => string;
  onChanged: () => void;
}) {
  const repo = getRepository();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(50);
  const [lTrainer, setLTrainer] = useState("");
  const [lRepeat, setLRepeat] = useState(1);

  // 그룹 수업
  const [addingClass, setAddingClass] = useState(false);
  const [cTitle, setCTitle] = useState("");
  const [cTime, setCTime] = useState("10:00");
  const [cDuration, setCDuration] = useState(50);
  const [cCapacity, setCCapacity] = useState(8);
  const [cTrainer, setCTrainer] = useState("");
  const [cRepeat, setCRepeat] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [roster, setRoster] = useState<Member[]>([]);

  const trainerName = (id?: string) =>
    id ? (trainers.find((t) => t.id === id)?.name ?? "") : "";

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!memberId) return;
    for (let i = 0; i < lRepeat; i++) {
      const startsAt = toISO(ymd(addDays(day, 7 * i)), time);
      const endsAt = new Date(
        new Date(startsAt).getTime() + duration * 60000,
      ).toISOString();
      await repo.createLesson({
        memberId,
        trainerId: lTrainer || undefined,
        startsAt,
        endsAt,
      });
    }
    setMemberId("");
    setLRepeat(1);
    setAdding(false);
    onChanged();
  }

  async function addClass(e: React.FormEvent) {
    e.preventDefault();
    if (!cTitle.trim() || cCapacity < 1) return;
    for (let i = 0; i < cRepeat; i++) {
      const startsAt = toISO(ymd(addDays(day, 7 * i)), cTime);
      const endsAt = new Date(
        new Date(startsAt).getTime() + cDuration * 60000,
      ).toISOString();
      await repo.createClass({
        title: cTitle.trim(),
        trainerId: cTrainer || undefined,
        startsAt,
        endsAt,
        capacity: cCapacity,
      });
    }
    setCTitle("");
    setCRepeat(1);
    setAddingClass(false);
    onChanged();
  }

  async function toggleRoster(classId: string) {
    if (expanded === classId) {
      setExpanded(null);
      return;
    }
    setRoster(await repo.listEnrolledMembers(classId));
    setExpanded(classId);
  }

  async function setStatus(l: Lesson, status: Lesson["status"]) {
    await repo.updateLesson(l.id, { status });
    onChanged();
  }

  // 수업 옮기기(일정 변경) — 길이는 유지
  const [moving, setMoving] = useState<string | null>(null);
  const [mDate, setMDate] = useState("");
  const [mTime, setMTime] = useState("10:00");

  function startMove(l: Lesson) {
    setMoving(l.id);
    setMDate(ymd(new Date(l.startsAt)));
    setMTime(hm(new Date(l.startsAt)));
  }
  async function move(l: Lesson) {
    const startsAt = toISO(mDate, mTime);
    const dur = new Date(l.endsAt).getTime() - new Date(l.startsAt).getTime();
    const endsAt = new Date(new Date(startsAt).getTime() + dur).toISOString();
    await repo.updateLesson(l.id, { startsAt, endsAt });
    setMoving(null);
    onChanged();
  }

  async function markDone(l: Lesson) {
    await repo.updateLesson(l.id, { status: "done" });
    const m = members.find((x) => x.id === l.memberId);
    if (m) {
      const used = nextPassUsedOnDone(m);
      if (used !== m.passUsed) await repo.updateMember(m.id, { passUsed: used });
    }
    onChanged();
  }

  return (
    <div className="w-full flex-shrink-0 rounded-2xl border border-line-soft bg-panel lg:w-[330px]">
      <div className="border-b border-line-soft px-5 py-4">
        <div className="text-xs font-semibold text-faint">선택한 날짜</div>
        <div className="num mt-0.5 text-[18px] font-extrabold tracking-tight">
          {day.getFullYear()}.{day.getMonth() + 1}.{day.getDate()} (
          {WEEKDAYS_KO[day.getDay()]})
        </div>
      </div>

      <div className="flex flex-col gap-2.5 p-4">
        {lessons.map((l) => {
          const st = STATUS[l.status];
          return (
            <div
              key={l.id}
              className="rounded-xl border border-line-soft bg-white p-3.5"
            >
              <div className="mb-2.5 flex items-center justify-between">
                <button
                  onClick={() => {
                    if (members.some((m) => m.id === l.memberId))
                      router.push(`/members/${l.memberId}`);
                  }}
                  className="group flex items-center gap-2.5"
                >
                  <span className="num text-[15px] font-semibold tracking-tight">
                    {hm(new Date(l.startsAt))}
                  </span>
                  <span className="text-[14.5px] font-bold group-hover:text-clay group-hover:underline">
                    {memberName(l.memberId)}
                  </span>
                  {trainerName(l.trainerId) && (
                    <span className="text-[11px] font-semibold text-clay-deep">
                      · {trainerName(l.trainerId)}
                    </span>
                  )}
                </button>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11.5px] font-bold"
                  style={{ background: st.chip, color: st.color }}
                >
                  {st.label}
                </span>
              </div>
              {moving === l.id && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    move(l);
                  }}
                  className="mb-2 flex flex-wrap gap-2 rounded-lg bg-panel p-2"
                >
                  <input
                    type="date"
                    value={mDate}
                    onChange={(e) => setMDate(e.target.value)}
                    className="num rounded-lg border border-line bg-white px-2 py-1.5 text-[12.5px]"
                  />
                  <input
                    type="time"
                    value={mTime}
                    onChange={(e) => setMTime(e.target.value)}
                    className="num rounded-lg border border-line bg-white px-2 py-1.5 text-[12.5px]"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-clay px-3 py-1.5 text-[12.5px] font-bold text-white"
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoving(null)}
                    className="rounded-lg border border-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-muted"
                  >
                    취소
                  </button>
                </form>
              )}
              <div className="flex gap-1.5">
                {l.status === "scheduled" && (
                  <>
                    <button
                      onClick={() => markDone(l)}
                      className="flex-1 rounded-lg bg-[#2E5E43] py-1.5 text-[12.5px] font-bold text-white"
                    >
                      완료
                    </button>
                    <button
                      onClick={() => startMove(l)}
                      className="rounded-lg border border-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-clay-deep"
                    >
                      옮기기
                    </button>
                    <button
                      onClick={() => setStatus(l, "canceled")}
                      className="rounded-lg border border-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-muted"
                    >
                      취소
                    </button>
                  </>
                )}
                {l.status === "done" && (
                  <>
                    <span className="flex flex-1 items-center text-[12px] font-semibold text-done">
                      회원권 1회 자동 차감됨
                    </span>
                    <button
                      onClick={async () => {
                        await repo.deleteLesson(l.id);
                        onChanged();
                      }}
                      className="rounded-lg border border-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-faint"
                    >
                      삭제
                    </button>
                  </>
                )}
                {l.status === "canceled" && (
                  <>
                    <button
                      onClick={() => setStatus(l, "scheduled")}
                      className="flex-1 rounded-lg border border-line bg-white py-1.5 text-[12.5px] font-semibold text-muted"
                    >
                      예정으로
                    </button>
                    <button
                      onClick={async () => {
                        await repo.deleteLesson(l.id);
                        onChanged();
                      }}
                      className="rounded-lg border border-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-faint"
                    >
                      기록 삭제
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {lessons.length === 0 && !adding && (
          <div className="py-8 text-center text-faintest">
            <div className="text-[13.5px] font-semibold">
              예정된 수업이 없습니다
            </div>
            <div className="mt-1 text-[12.5px]">빈 날에 수업을 추가해 보세요</div>
          </div>
        )}

        {adding ? (
          members.length === 0 ? (
            <p className="text-[13px] text-muted">먼저 회원을 추가하세요.</p>
          ) : (
            <form
              onSubmit={add}
              className="space-y-2 rounded-xl border border-line-soft bg-white p-3.5"
            >
              <select
                value={memberId}
                onChange={(e) => {
                  const id = e.target.value;
                  setMemberId(id);
                  const m = members.find((x) => x.id === id);
                  setLTrainer(m?.trainerId ?? trainers[0]?.id ?? "");
                }}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              >
                <option value="">회원 선택…</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              {trainers.length > 0 && (
                <select
                  value={lTrainer}
                  onChange={(e) => setLTrainer(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                >
                  <option value="">선생님 미지정</option>
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex gap-2">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="num flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                />
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="num rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                >
                  {[30, 50, 60, 90].map((d) => (
                    <option key={d} value={d}>
                      {d}분
                    </option>
                  ))}
                </select>
              </div>
              <select
                value={lRepeat}
                onChange={(e) => setLRepeat(Number(e.target.value))}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              >
                <option value={1}>반복 없음</option>
                <option value={4}>매주 · 4주</option>
                <option value={8}>매주 · 8주</option>
                <option value={12}>매주 · 12주</option>
              </select>
              <button
                type="submit"
                className="w-full rounded-lg bg-clay py-2 text-sm font-bold text-white"
              >
                {lRepeat > 1 ? `${lRepeat}주 반복 추가` : "추가"}
              </button>
            </form>
          )
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-1 rounded-[10px] border-[1.5px] border-dashed border-[#D6CDBE] py-2.5 text-[13px] font-semibold text-[#8A8276]"
          >
            + 이 날짜에 수업 추가
          </button>
        )}

        {/* 그룹 수업 */}
        <div className="mt-2 border-t border-line-soft pt-3">
          <div className="mb-2 text-[12.5px] font-bold text-clay-deep">
            그룹 수업 (선착순)
          </div>
          {classes.map((c) => (
            <div
              key={c.id}
              className="mb-2 rounded-xl border border-line-warm bg-[#FBF3EB] p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="num text-[13px] font-semibold text-clay-deep">
                    {hm(new Date(c.startsAt))}
                  </span>
                  <span className="text-[14px] font-bold text-clay-dark">
                    {c.title}
                  </span>
                  {trainerName(c.trainerId) && (
                    <span className="text-[11px] font-semibold text-clay-deep">
                      · {trainerName(c.trainerId)}
                    </span>
                  )}
                </div>
                <span className="num text-[13px] font-bold text-clay">
                  {c.enrolledCount}/{c.capacity}
                </span>
              </div>
              <div className="mt-2 flex gap-1.5">
                <button
                  onClick={() => toggleRoster(c.id)}
                  className="rounded-lg border border-[#E0CBB4] bg-white px-2.5 py-1 text-[12px] font-semibold text-clay-deep"
                >
                  {expanded === c.id ? "명단 닫기" : "명단"}
                </button>
                <button
                  onClick={async () => {
                    await repo.deleteClass(c.id);
                    if (expanded === c.id) setExpanded(null);
                    onChanged();
                  }}
                  className="ml-auto text-[12px] font-semibold text-canceled hover:underline"
                >
                  삭제
                </button>
              </div>
              {expanded === c.id && (
                <div className="mt-2 border-t border-[#EAD9C7] pt-2 text-[12.5px] text-ink-soft">
                  {roster.length === 0 ? (
                    <span className="text-faintest">등록한 회원이 없습니다.</span>
                  ) : (
                    roster.map((m) => m.name).join(", ")
                  )}
                </div>
              )}
            </div>
          ))}

          {addingClass ? (
            <form
              onSubmit={addClass}
              className="space-y-2 rounded-xl border border-line-warm bg-white p-3.5"
            >
              <input
                autoFocus
                value={cTitle}
                onChange={(e) => setCTitle(e.target.value)}
                placeholder="수업 이름 (예: 모닝 요가)"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              />
              {trainers.length > 0 && (
                <select
                  value={cTrainer}
                  onChange={(e) => setCTrainer(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                >
                  <option value="">선생님(강사) 미지정</option>
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex gap-2">
                <input
                  type="time"
                  value={cTime}
                  onChange={(e) => setCTime(e.target.value)}
                  className="num flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                />
                <select
                  value={cDuration}
                  onChange={(e) => setCDuration(Number(e.target.value))}
                  className="num rounded-lg border border-line bg-surface px-2 py-2 text-sm"
                >
                  {[30, 50, 60, 90].map((d) => (
                    <option key={d} value={d}>
                      {d}분
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[12.5px] text-muted">정원</label>
                <input
                  type="number"
                  min={1}
                  value={cCapacity}
                  onChange={(e) =>
                    setCCapacity(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="num w-20 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                />
                <span className="text-[12.5px] text-muted">명</span>
              </div>
              <select
                value={cRepeat}
                onChange={(e) => setCRepeat(Number(e.target.value))}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              >
                <option value={1}>반복 없음</option>
                <option value={4}>매주 · 4주</option>
                <option value={8}>매주 · 8주</option>
                <option value={12}>매주 · 12주</option>
              </select>
              <button
                type="submit"
                className="w-full rounded-lg bg-clay py-2 text-sm font-bold text-white"
              >
                {cRepeat > 1 ? `${cRepeat}주 반복 만들기` : "수업 만들기"}
              </button>
            </form>
          ) : (
            <button
              onClick={() => {
                setCTrainer(trainers[0]?.id ?? "");
                setAddingClass(true);
              }}
              className="w-full rounded-[10px] border-[1.5px] border-dashed border-[#E0CBB4] py-2.5 text-[13px] font-semibold text-clay-deep"
            >
              + 그룹 수업 만들기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
