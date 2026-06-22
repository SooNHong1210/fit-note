// 예약 가능 슬롯 계산 (SPEC 4.1).
// 영업시간(Availability) 기준으로 세션 단위 슬롯을 생성하고,
// 이미 잡힌 수업 + 진행 중인 예약(requested/seen/approved)과 겹치는 슬롯을 제외.

import type { Availability, Booking, Lesson } from "@/lib/types";
import { addDays, ymd } from "@/lib/date";

export interface Slot {
  startsAt: string; // ISO
  endsAt: string; // ISO
}

interface Interval {
  start: number; // epoch ms
  end: number;
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export function computeAvailableSlots(params: {
  availability: Availability[];
  sessionMinutes: number;
  lessons: Lesson[];
  bookings: Booking[];
  classes?: { startsAt: string; endsAt: string }[]; // 그룹 수업(바쁜 시간)
  daysAhead?: number;
  from?: Date; // 명시적 시작일(미지정 시 오늘)
  to?: Date; // 명시적 종료일(미지정 시 시작일+daysAhead)
  now?: Date;
}): Slot[] {
  const {
    availability,
    sessionMinutes,
    lessons,
    bookings,
    classes = [],
    daysAhead = 14,
    from,
    to,
    now = new Date(),
  } = params;

  if (availability.length === 0 || sessionMinutes <= 0) return [];

  // 바쁜 구간: 예정된 수업 + 거절되지 않은 예약 + 그룹 수업
  const busy: Interval[] = [
    ...lessons
      .filter((l) => l.status === "scheduled")
      .map((l) => ({
        start: new Date(l.startsAt).getTime(),
        end: new Date(l.endsAt).getTime(),
      })),
    ...bookings
      .filter((b) => b.status !== "rejected")
      .map((b) => ({
        start: new Date(b.slotStartsAt).getTime(),
        end: new Date(b.slotEndsAt).getTime(),
      })),
    ...classes.map((c) => ({
      start: new Date(c.startsAt).getTime(),
      end: new Date(c.endsAt).getTime(),
    })),
  ];

  const slots: Slot[] = [];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 순회 범위: from~to 가 있으면 그 범위, 없으면 오늘~오늘+daysAhead
  const startDay = from
    ? new Date(from.getFullYear(), from.getMonth(), from.getDate())
    : today;
  const endExclusive = to
    ? addDays(new Date(to.getFullYear(), to.getMonth(), to.getDate()), 1)
    : addDays(today, daysAhead);
  const totalDays = Math.max(
    0,
    Math.round((endExclusive.getTime() - startDay.getTime()) / 86400000),
  );

  for (let i = 0; i < totalDays; i++) {
    const day = addDays(startDay, i);
    const weekday = day.getDay();
    const daySlots = availability.filter((a) => a.weekday === weekday);

    for (const a of daySlots) {
      const [sh, sm] = a.startTime.split(":").map(Number);
      const [eh, em] = a.endTime.split(":").map(Number);
      const dateStr = ymd(day);

      let cursor = new Date(`${dateStr}T00:00:00`);
      cursor.setHours(sh, sm, 0, 0);
      const dayEnd = new Date(`${dateStr}T00:00:00`);
      dayEnd.setHours(eh, em, 0, 0);

      while (cursor.getTime() + sessionMinutes * 60000 <= dayEnd.getTime()) {
        const start = cursor.getTime();
        const end = start + sessionMinutes * 60000;

        const isPast = start <= now.getTime();
        const isBusy = busy.some((b) => overlaps({ start, end }, b));

        if (!isPast && !isBusy) {
          slots.push({
            startsAt: new Date(start).toISOString(),
            endsAt: new Date(end).toISOString(),
          });
        }
        cursor = new Date(end);
      }
    }
  }

  return slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
