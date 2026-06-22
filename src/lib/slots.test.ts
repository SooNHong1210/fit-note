import { describe, expect, it } from "vitest";
import { computeAvailableSlots } from "./slots";
import type { Availability, Booking, Lesson } from "./types";

// 2026-01-05 = 월요일(weekday 1)
const MON = new Date(2026, 0, 5);
const NOW_9AM = new Date(2026, 0, 5, 9, 0, 0);

const mondayAvailability: Availability[] = [
  { id: "a1", weekday: 1, startTime: "10:00", endTime: "12:00" },
];

function lesson(start: Date, end: Date, status: Lesson["status"]): Lesson {
  return {
    id: Math.random().toString(),
    memberId: "m1",
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    status,
    createdAt: NOW_9AM.toISOString(),
  };
}

function booking(start: Date, end: Date, status: Booking["status"]): Booking {
  return {
    id: Math.random().toString(),
    memberId: "m1",
    slotStartsAt: start.toISOString(),
    slotEndsAt: end.toISOString(),
    status,
    createdAt: NOW_9AM.toISOString(),
  };
}

const base = {
  availability: mondayAvailability,
  sessionMinutes: 60,
  lessons: [] as Lesson[],
  bookings: [] as Booking[],
  from: MON,
  to: MON,
  now: NOW_9AM,
};

describe("computeAvailableSlots", () => {
  it("영업시간에서 세션 단위 슬롯 생성 (10-12시, 60분 → 2개)", () => {
    const slots = computeAvailableSlots(base);
    expect(slots).toHaveLength(2);
    expect(new Date(slots[0].startsAt).getHours()).toBe(10);
    expect(new Date(slots[1].startsAt).getHours()).toBe(11);
  });

  it("50분 세션은 끝시간을 넘지 않게 채움 (10:00, 10:50 → 2개, 11:40은 12시 초과)", () => {
    const slots = computeAvailableSlots({ ...base, sessionMinutes: 50 });
    expect(slots).toHaveLength(2);
    expect(new Date(slots[1].startsAt).getMinutes()).toBe(50);
  });

  it("이미 잡힌 수업과 겹치는 슬롯 제외", () => {
    const slots = computeAvailableSlots({
      ...base,
      lessons: [
        lesson(new Date(2026, 0, 5, 10), new Date(2026, 0, 5, 11), "scheduled"),
      ],
    });
    expect(slots).toHaveLength(1);
    expect(new Date(slots[0].startsAt).getHours()).toBe(11);
  });

  it("취소된 수업은 제외하지 않음", () => {
    const slots = computeAvailableSlots({
      ...base,
      lessons: [
        lesson(new Date(2026, 0, 5, 10), new Date(2026, 0, 5, 11), "canceled"),
      ],
    });
    expect(slots).toHaveLength(2);
  });

  it("진행 중인 예약(requested)과 겹치는 슬롯 제외", () => {
    const slots = computeAvailableSlots({
      ...base,
      bookings: [
        booking(new Date(2026, 0, 5, 11), new Date(2026, 0, 5, 12), "requested"),
      ],
    });
    expect(slots).toHaveLength(1);
    expect(new Date(slots[0].startsAt).getHours()).toBe(10);
  });

  it("거절된 예약은 슬롯을 막지 않음", () => {
    const slots = computeAvailableSlots({
      ...base,
      bookings: [
        booking(new Date(2026, 0, 5, 11), new Date(2026, 0, 5, 12), "rejected"),
      ],
    });
    expect(slots).toHaveLength(2);
  });

  it("이미 지난 시간 슬롯은 제외", () => {
    const slots = computeAvailableSlots({
      ...base,
      now: new Date(2026, 0, 5, 10, 30),
    });
    expect(slots).toHaveLength(1);
    expect(new Date(slots[0].startsAt).getHours()).toBe(11);
  });

  it("그룹 수업과 겹치는 슬롯 제외", () => {
    const slots = computeAvailableSlots({
      ...base,
      classes: [
        {
          startsAt: new Date(2026, 0, 5, 10).toISOString(),
          endsAt: new Date(2026, 0, 5, 11).toISOString(),
        },
      ],
    });
    expect(slots).toHaveLength(1);
    expect(new Date(slots[0].startsAt).getHours()).toBe(11);
  });

  it("영업시간 없으면 빈 배열", () => {
    expect(
      computeAvailableSlots({ ...base, availability: [] }),
    ).toHaveLength(0);
  });

  it("해당 요일 영업시간이 없으면 그 날엔 슬롯 없음 (화요일 조회)", () => {
    const TUE = new Date(2026, 0, 6);
    const slots = computeAvailableSlots({
      ...base,
      from: TUE,
      to: TUE,
      now: new Date(2026, 0, 6, 9),
    });
    expect(slots).toHaveLength(0);
  });
});
