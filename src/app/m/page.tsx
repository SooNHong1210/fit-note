"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getRepository } from "@/lib/repositories";
import type {
  Availability,
  Booking,
  Comment,
  Lesson,
  Member,
  MemberClassView,
  Shop,
  Trainer,
} from "@/lib/types";
import { computeAvailableSlots, type Slot } from "@/lib/slots";
import { passRemaining } from "@/lib/pass";
import {
  addDays,
  addMonths,
  calendarGridStart,
  fmtDate,
  hm,
  sameDay,
  startOfMonth,
  WEEKDAYS_KO,
  ymd,
} from "@/lib/date";
import {
  clearMemberShopId,
  clearSession,
  getDevicePublicKey,
  getMemberShopId,
  getSessionMemberId,
  setMemberShopId,
  setSessionMemberId,
} from "@/lib/memberSession";
import { getActiveShopId, setActiveShopId } from "@/lib/activeShop";
import { subscribeBookings } from "@/lib/realtime";
import { notifyTeacher } from "@/lib/push";
import MemberPushToggle from "@/components/MemberPushToggle";

export default function MemberPage() {
  const [status, setStatus] = useState<
    "loading" | "needShop" | "needIdentify" | "home"
  >("loading");
  const [shop, setShop] = useState<Shop | null>(null);
  const [member, setMember] = useState<Member | null>(null);

  useEffect(() => {
    (async () => {
      const repo = getRepository();
      const sid = getMemberShopId();
      if (!sid) return setStatus("needShop");
      setActiveShopId(sid);
      const sh = await repo.getShop();
      if (!sh) return setStatus("needShop");
      setShop(sh);
      const id = getSessionMemberId();
      if (id) {
        const m = await repo.getMember(id);
        if (m && m.status === "active") {
          setMember(m);
          return setStatus("home");
        }
        clearSession();
      }
      setStatus("needIdentify");
    })();
  }, []);

  function pickShop(sh: Shop) {
    setMemberShopId(sh.id);
    setActiveShopId(sh.id);
    setShop(sh);
    setStatus("needIdentify");
  }

  function changeShop() {
    clearMemberShopId();
    clearSession();
    setShop(null);
    setMember(null);
    setStatus("needShop");
  }

  if (status === "loading") return <p className="text-faint">불러오는 중…</p>;
  if (status === "needShop") return <ShopCodeEntry onFound={pickShop} />;
  if (status === "needIdentify" || !member)
    return (
      <Identify
        shopName={shop?.name ?? ""}
        onDone={(m) => {
          setMember(m);
          setStatus("home");
        }}
        onChangeShop={changeShop}
      />
    );
  return (
    <MemberHome
      member={member}
      onLogout={() => {
        clearSession();
        setMember(null);
        setStatus("needIdentify");
      }}
      onChangeShop={changeShop}
    />
  );
}

function ShopCodeEntry({ onFound }: { onFound: (s: Shop) => void }) {
  const repo = getRepository();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const shop = await repo.findShopByCode(code);
      if (!shop) {
        setError("해당 코드의 샵을 찾을 수 없습니다.");
        return;
      }
      onFound(shop);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pt-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-[16px] bg-clay text-[26px] font-extrabold tracking-tighter text-white">
          핏
        </div>
        <h1 className="text-[22px] font-extrabold tracking-tight">핏노트</h1>
        <p className="mt-1.5 text-[13.5px] text-muted">
          선생님께 받은 <b>샵 주소</b>를 입력하세요.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-2.5">
        <div className="flex items-center rounded-[10px] border border-line bg-surface px-3.5">
          <span className="num text-[15px] text-faint">/m/</span>
          <input
            autoFocus
            value={code}
            onChange={(e) =>
              setCode(e.target.value.toLowerCase().replace(/\s/g, ""))
            }
            placeholder="soyeon-pilates"
            className="num w-full bg-transparent py-3 pl-1 text-[16px] outline-none"
          />
        </div>
        {error && <p className="text-[13px] text-canceled">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-[10px] bg-clay py-3 font-bold text-white disabled:opacity-50"
        >
          {busy ? "확인 중…" : "다음"}
        </button>
      </form>
    </div>
  );
}

function Identify({
  shopName,
  onDone,
  onChangeShop,
}: {
  shopName: string;
  onDone: (m: Member) => void;
  onChangeShop: () => void;
}) {
  const repo = getRepository();
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const claimed = await repo.claimMember(
        name,
        birthDate,
        getDevicePublicKey(),
      );
      if (!claimed) {
        setError("등록된 회원이 아닙니다. 선생님께 회원 등록을 먼저 요청하세요.");
        return;
      }
      setSessionMemberId(claimed.id);
      onDone(claimed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "본인 확인에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pt-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-[16px] bg-clay text-[26px] font-extrabold tracking-tighter text-white">
          핏
        </div>
        <h1 className="text-[22px] font-extrabold tracking-tight">{shopName}</h1>
        <p className="mt-1.5 text-[13.5px] text-muted">
          이름과 생년월일로 본인 확인 후<br />이 기기가 등록됩니다.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-2.5">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름"
          className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-3"
        />
        <input
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          placeholder="생년월일 (예: 1990-01-15)"
          className="num w-full rounded-[10px] border border-line bg-surface px-3.5 py-3"
        />
        {error && <p className="text-[13px] text-canceled">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-[10px] bg-clay py-3 font-bold text-white disabled:opacity-50"
        >
          {busy ? "확인 중…" : "본인 확인"}
        </button>
      </form>
      <button
        onClick={onChangeShop}
        className="mt-4 w-full text-center text-[12.5px] text-faint hover:text-clay"
      >
        다른 샵 코드 입력
      </button>
    </div>
  );
}

function MemberHome({
  member,
  onLogout,
  onChangeShop,
}: {
  member: Member;
  onLogout: () => void;
  onChangeShop: () => void;
}) {
  const repo = getRepository();
  const [tab, setTab] = useState<"book" | "classes" | "status">("book");
  const [shop, setShop] = useState<Shop | null>(null);
  const [classes, setClasses] = useState<MemberClassView[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [me, setMe] = useState<Member>(member);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [sh, av, ls, all, mine, cs, fresh, cls, trs] = await Promise.all([
      repo.getShop(),
      repo.listAvailability(),
      repo.listLessons(),
      repo.listBookings(),
      repo.listBookingsByMember(member.id),
      repo.listCommentsByMember(member.id),
      repo.getMember(member.id),
      repo.listClassesForMember(member.id),
      repo.listTrainers(),
    ]);
    setShop(sh);
    setAvailability(av);
    setLessons(ls);
    setAllBookings(all);
    setMyBookings(mine);
    setComments(cs);
    if (fresh) setMe(fresh);
    setClasses(cls);
    setTrainers(trs);
    setLoading(false);
  }, [repo, member.id]);

  useEffect(() => {
    refresh();
    const shopId = getActiveShopId();
    if (!shopId) return;
    const unsub = subscribeBookings(shopId, () => refresh());
    return () => unsub();
  }, [refresh]);

  const activeBookings = myBookings.filter(
    (b) => b.status !== "rejected" && new Date(b.slotStartsAt) >= new Date(),
  ).length;
  const limit = shop?.advanceLimit ?? 0;
  const limitReached = limit > 0 && activeBookings >= limit;

  async function request(slot: Slot, trainerId?: string) {
    if (limitReached) return;
    setRequesting(slot.startsAt);
    try {
      await repo.createBooking({
        memberId: member.id,
        trainerId,
        slotStartsAt: slot.startsAt,
        slotEndsAt: slot.endsAt,
      });
      const sid = getActiveShopId();
      if (sid) notifyTeacher(sid); // 선생님에게 웹푸시(설정된 경우)
      await refresh();
      setTab("status");
    } finally {
      setRequesting(null);
    }
  }

  return (
    <div>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight">
            {shop?.name ?? "예약"}
          </h1>
          <p className="text-[13px] text-faint">{me.name}님</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={onLogout}
            className="text-[12.5px] text-faint hover:text-clay"
          >
            기기 등록 해제
          </button>
          <button
            onClick={onChangeShop}
            className="text-[11.5px] text-faintest hover:text-clay"
          >
            다른 샵
          </button>
        </div>
      </header>

      <div className="mb-4 flex gap-1 rounded-[11px] border border-line-soft bg-panel p-1">
        {(["book", "classes", "status"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 rounded-[8px] py-2 text-[13px] font-bold transition"
            style={{
              background: tab === t ? "#fff" : "transparent",
              color: tab === t ? "#1F1D1A" : "#9A938A",
              boxShadow: tab === t ? "0 1px 2px rgba(31,29,26,0.06)" : "none",
            }}
          >
            {t === "book" ? "예약하기" : t === "classes" ? "클래스" : "내 예약"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-faint">불러오는 중…</p>
      ) : tab === "book" ? (
        <BookCalendar
          hasShop={!!shop}
          availability={availability}
          sessionMinutes={shop?.sessionMinutes ?? 0}
          lessons={lessons}
          bookings={allBookings}
          classes={classes}
          trainers={trainers}
          defaultTrainerId={me.trainerId}
          requesting={requesting}
          onRequest={request}
          limitReached={limitReached}
          limit={limit}
        />
      ) : tab === "classes" ? (
        <ClassesTab
          classes={classes}
          memberId={member.id}
          onChanged={refresh}
        />
      ) : (
        <StatusTab
          member={me}
          bookings={myBookings}
          comments={comments}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

function BookCalendar({
  hasShop,
  availability,
  sessionMinutes,
  lessons,
  bookings,
  classes,
  trainers,
  defaultTrainerId,
  requesting,
  onRequest,
  limitReached,
  limit,
}: {
  hasShop: boolean;
  availability: Availability[];
  sessionMinutes: number;
  lessons: Lesson[];
  bookings: Booking[];
  classes: MemberClassView[];
  trainers: Trainer[];
  defaultTrainerId?: string;
  requesting: string | null;
  onRequest: (s: Slot, trainerId?: string) => void;
  limitReached: boolean;
  limit: number;
}) {
  const today = useMemo(() => new Date(), []);
  const thisMonth = useMemo(() => startOfMonth(today), [today]);
  const [month, setMonth] = useState(thisMonth);
  const [selected, setSelected] = useState<string | null>(null);
  const hasTrainers = trainers.length > 0;
  const [trainerId, setTrainerId] = useState(
    defaultTrainerId ?? trainers[0]?.id ?? "",
  );

  const slotsByDay = useMemo(() => {
    const monthEnd = addDays(addMonths(month, 1), -1);
    // 선생님이 있으면 선택 선생님 기준으로 영업시간·바쁜시간 필터(미지정은 공통)
    const av = hasTrainers
      ? availability.filter((a) => !a.trainerId || a.trainerId === trainerId)
      : availability;
    const ls = hasTrainers
      ? lessons.filter((l) => !l.trainerId || l.trainerId === trainerId)
      : lessons;
    const bk = hasTrainers
      ? bookings.filter((b) => !b.trainerId || b.trainerId === trainerId)
      : bookings;
    const cl = hasTrainers
      ? classes.filter((c) => !c.trainerId || c.trainerId === trainerId)
      : classes;
    const slots = computeAvailableSlots({
      availability: av,
      sessionMinutes,
      lessons: ls,
      bookings: bk,
      classes: cl,
      from: month,
      to: monthEnd,
      now: today,
    });
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = ymd(new Date(s.startsAt));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [
    availability,
    sessionMinutes,
    lessons,
    bookings,
    classes,
    month,
    today,
    hasTrainers,
    trainerId,
  ]);

  const gridStart = useMemo(() => calendarGridStart(month), [month]);
  const days = useMemo(
    () => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)),
    [gridStart],
  );

  const canGoPrev = month > thisMonth;
  const selectedSlots = selected ? (slotsByDay.get(selected) ?? []) : [];

  if (!hasShop) {
    return (
      <p className="text-[13px] text-faint">
        아직 예약 가능한 시간이 설정되지 않았습니다.
      </p>
    );
  }

  return (
    <div>
      {limitReached && (
        <div className="mb-3 rounded-xl border border-line-warm bg-[#FBF3E1] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#8A6A2A]">
          미리 예약은 최대 {limit}회까지 가능합니다. 기존 예약이 처리되면 다시
          신청할 수 있어요.
        </div>
      )}
      {trainers.length > 1 && (
        <div className="mb-3">
          <div className="mb-1.5 text-[12px] font-semibold text-faint">
            선생님 선택
          </div>
          <div className="flex flex-wrap gap-1.5">
            {trainers.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTrainerId(t.id);
                  setSelected(null);
                }}
                className="rounded-full px-3 py-1.5 text-[13px] font-bold"
                style={{
                  background: trainerId === t.id ? "#AE6A43" : "#F2EEE5",
                  color: trainerId === t.id ? "#fff" : "#6B665E",
                }}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="num text-[16px] font-extrabold tracking-tight">
          {month.getFullYear()}.{String(month.getMonth() + 1).padStart(2, "0")}
        </h2>
        <div className="flex gap-1">
          <button
            onClick={() => {
              setMonth((m) => addMonths(m, -1));
              setSelected(null);
            }}
            disabled={!canGoPrev}
            className="h-7 w-7 rounded-lg border border-line bg-surface text-muted disabled:opacity-30"
          >
            ‹
          </button>
          <button
            onClick={() => {
              setMonth((m) => addMonths(m, 1));
              setSelected(null);
            }}
            className="h-7 w-7 rounded-lg border border-line bg-surface text-muted"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7">
        {WEEKDAYS_KO.map((w, i) => (
          <div
            key={w}
            className="py-1 text-center text-[11px] font-bold"
            style={{ color: i === 0 ? "#B25148" : "#9A938A" }}
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const inMonth = day.getMonth() === month.getMonth();
          const key = ymd(day);
          const count = slotsByDay.get(key)?.length ?? 0;
          const selectable = inMonth && count > 0;
          const isSelected = selected === key;
          const isToday = sameDay(day, today);
          return (
            <button
              key={day.toISOString()}
              onClick={() => selectable && setSelected(key)}
              disabled={!selectable}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[9px]"
              style={{
                opacity: inMonth ? 1 : 0.3,
                background: isSelected ? "#AE6A43" : "transparent",
                cursor: selectable ? "pointer" : "default",
              }}
            >
              <span
                className="num text-[13px]"
                style={{
                  fontWeight: isToday || isSelected ? 700 : 500,
                  color: isSelected
                    ? "#fff"
                    : isToday
                      ? "#AE6A43"
                      : selectable
                        ? "#1F1D1A"
                        : day.getDay() === 0
                          ? "#D9B0AC"
                          : "#C7C0B5",
                }}
              >
                {day.getDate()}
              </span>
              <span
                className="h-1 w-1 rounded-full"
                style={{
                  background: !selectable
                    ? "transparent"
                    : isSelected
                      ? "#fff"
                      : "#AE6A43",
                }}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-line-soft pt-3 text-[11px] text-faint">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-clay" />
          예약 가능
        </span>
      </div>

      <div className="mt-4">
        {selected && selectedSlots.length > 0 ? (
          <>
            <h3 className="mb-2.5 text-[13.5px] font-bold text-ink-soft">
              {fmtDate(selectedSlots[0].startsAt)}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {selectedSlots.map((s) => (
                <button
                  key={s.startsAt}
                  onClick={() =>
                    onRequest(s, hasTrainers ? trainerId : undefined)
                  }
                  disabled={requesting === s.startsAt || limitReached}
                  className="num rounded-[10px] border border-line bg-surface py-2.5 text-[14px] font-semibold text-ink disabled:opacity-50"
                >
                  {requesting === s.startsAt ? "…" : hm(new Date(s.startsAt))}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-[13px] text-faintest">
            아래 점이 있는 날짜를 선택하면 예약 가능한 시간이 표시됩니다.
          </p>
        )}
      </div>
    </div>
  );
}

function ClassesTab({
  classes,
  memberId,
  onChanged,
}: {
  classes: MemberClassView[];
  memberId: string;
  onChanged: () => void;
}) {
  const repo = getRepository();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const upcoming = classes.filter((c) => new Date(c.endsAt) >= new Date());

  async function join(classId: string) {
    setBusy(classId);
    setMsg("");
    try {
      const r = await repo.enrollClass(classId, memberId);
      if (r === "full") setMsg("정원이 가득 찼습니다.");
      else if (r === "already") setMsg("이미 신청한 수업입니다.");
      else if (r === "not_member") setMsg("신청할 수 없습니다.");
      await onChanged();
    } finally {
      setBusy(null);
    }
  }

  async function cancel(classId: string) {
    setBusy(classId);
    try {
      await repo.cancelEnrollment(classId, memberId);
      await onChanged();
    } finally {
      setBusy(null);
    }
  }

  if (upcoming.length === 0)
    return (
      <p className="text-[13px] text-faintest">예정된 그룹 수업이 없습니다.</p>
    );

  return (
    <div className="space-y-2.5">
      {msg && (
        <p className="rounded-lg bg-[#FBF3E1] px-3 py-2 text-[12.5px] font-semibold text-[#8A6A2A]">
          {msg}
        </p>
      )}
      {upcoming.map((c) => {
        const remain = c.capacity - c.enrolledCount;
        const full = remain <= 0;
        const d = new Date(c.startsAt);
        return (
          <div
            key={c.id}
            className="rounded-2xl border border-line-soft bg-white p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[15px] font-bold">{c.title}</div>
                <div className="num mt-0.5 text-[12.5px] text-muted">
                  {d.getMonth() + 1}/{d.getDate()} {hm(d)}
                </div>
              </div>
              <div className="text-right">
                <div className="num text-[15px] font-bold text-clay">
                  {c.enrolledCount}/{c.capacity}
                </div>
                <div className="text-[11px] text-faintest">
                  {c.enrolledByMe ? "신청함" : full ? "마감" : `${remain}자리`}
                </div>
              </div>
            </div>
            <div className="mt-3">
              {c.enrolledByMe ? (
                <button
                  onClick={() => cancel(c.id)}
                  disabled={busy === c.id}
                  className="w-full rounded-[10px] border border-line bg-white py-2.5 text-[13px] font-bold text-muted disabled:opacity-50"
                >
                  신청 취소
                </button>
              ) : (
                <button
                  onClick={() => join(c.id)}
                  disabled={busy === c.id || full}
                  className="w-full rounded-[10px] bg-clay py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
                >
                  {full ? "마감됨" : busy === c.id ? "신청 중…" : "신청 (선착순)"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusTab({
  member,
  bookings,
  comments,
  onChanged,
}: {
  member: Member;
  bookings: Booking[];
  comments: Comment[];
  onChanged: () => void;
}) {
  const remain = passRemaining(member);
  const remainPct = member.passTotal > 0 ? (remain / member.passTotal) * 100 : 0;

  return (
    <div className="space-y-6">
      <MemberPushToggle memberId={member.id} />
      {member.passTotal > 0 && (
        <div
          className="rounded-2xl border border-line-warm p-5"
          style={{ background: "linear-gradient(135deg,#FBF3EB,#F5EADF)" }}
        >
          <div className="text-[12.5px] font-bold text-[#A87142]">회원권 잔여</div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="num text-[34px] leading-none font-semibold tracking-tight text-clay-dark">
              {remain}
            </span>
            <span className="text-[14px] font-semibold text-[#A87142]">
              / {member.passTotal}회 남음
            </span>
          </div>
          <div className="mt-3 h-[7px] overflow-hidden rounded bg-[#E7D3BF]">
            <div
              className="h-full rounded bg-clay"
              style={{ width: `${remainPct}%` }}
            />
          </div>
        </div>
      )}

      <section>
        <h2 className="mb-2.5 text-[15px] font-extrabold tracking-tight">
          내 예약
        </h2>
        {bookings.length === 0 ? (
          <p className="text-[13px] text-faintest">아직 신청한 예약이 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {bookings.map((b) => (
              <BookingCard key={b.id} booking={b} onChanged={onChanged} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2.5 text-[15px] font-extrabold tracking-tight">
          선생님 코멘트
        </h2>
        {comments.length === 0 ? (
          <p className="text-[13px] text-faintest">아직 코멘트가 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {comments.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-line-soft bg-white p-3.5"
              >
                <div className="num mb-1.5 text-[11.5px] font-bold text-clay">
                  {fmtDate(c.createdAt)}
                </div>
                <p className="text-[13.5px] leading-relaxed text-ink-soft">
                  {c.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const STEPS = ["신청됨", "확인 중", "결과"];

function BookingCard({
  booking,
  onChanged,
}: {
  booking: Booking;
  onChanged: () => void;
}) {
  const repo = getRepository();
  const [busy, setBusy] = useState(false);
  const idx =
    booking.status === "requested"
      ? 0
      : booking.status === "seen"
        ? 1
        : 2;
  const rejected = booking.status === "rejected";
  const approved = booking.status === "approved";
  const canceled = booking.status === "canceled";
  const inactive = rejected || canceled;
  const activeColor = inactive ? "#9A938A" : approved ? "#3E7D5A" : "#AE6A43";
  const d = new Date(booking.slotStartsAt);
  const upcoming = d.getTime() > Date.now();
  const cancellable =
    upcoming &&
    (booking.status === "requested" ||
      booking.status === "seen" ||
      booking.status === "approved");

  async function cancel() {
    if (!confirm("이 예약을 취소할까요?")) return;
    setBusy(true);
    try {
      await repo.cancelBooking(booking.id);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line-soft bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="num text-[14.5px] font-semibold">
          {d.getMonth() + 1}/{d.getDate()} {hm(d)}
        </span>
        <span
          className="rounded-full px-2.5 py-0.5 text-[11.5px] font-bold"
          style={{
            background: inactive ? "#EFEBE2" : approved ? "#EAF3ED" : "#FBF3E1",
            color: activeColor,
          }}
        >
          {canceled
            ? "취소됨"
            : rejected
              ? "거절됨"
              : approved
                ? "승인됨"
                : booking.status === "seen"
                  ? "확인 중"
                  : "신청됨"}
        </span>
      </div>
      <div className="flex items-center">
        {STEPS.map((label, i) => {
          const reached = i <= idx;
          const last = i === STEPS.length - 1;
          const stepLabel =
            last && canceled
              ? "취소"
              : last && rejected
                ? "거절"
                : last && approved
                  ? "승인"
                  : label;
          return (
            <div key={i} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: reached ? activeColor : "#E1DACD" }}
                />
                <span
                  className="text-[10.5px] font-semibold whitespace-nowrap"
                  style={{ color: reached ? activeColor : "#B0A99D" }}
                >
                  {stepLabel}
                </span>
              </div>
              {!last && (
                <div
                  className="mx-1 mb-4 h-[2px] flex-1 rounded"
                  style={{ background: i < idx ? activeColor : "#E1DACD" }}
                />
              )}
            </div>
          );
        })}
      </div>
      {cancellable && (
        <button
          onClick={cancel}
          disabled={busy}
          className="mt-3 w-full rounded-[10px] border border-line bg-white py-2 text-[12.5px] font-bold text-canceled disabled:opacity-50"
        >
          {busy ? "취소 중…" : "예약 취소"}
        </button>
      )}
    </div>
  );
}
