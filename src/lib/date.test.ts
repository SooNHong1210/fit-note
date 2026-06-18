import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  calendarGridStart,
  sameDay,
  startOfMonth,
  toISO,
  ymd,
} from "./date";

describe("ymd", () => {
  it("0 패딩된 YYYY-MM-DD", () => {
    expect(ymd(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(ymd(new Date(2026, 11, 25))).toBe("2026-12-25");
  });
});

describe("toISO", () => {
  it("날짜+시각을 로컬 기준 ISO로", () => {
    expect(toISO("2026-01-05", "10:30")).toBe(
      new Date(2026, 0, 5, 10, 30).toISOString(),
    );
  });
});

describe("startOfMonth / addMonths", () => {
  it("그 달 1일", () => {
    expect(ymd(startOfMonth(new Date(2026, 0, 15)))).toBe("2026-01-01");
  });

  it("월 이동은 1일로 정규화", () => {
    expect(ymd(addMonths(startOfMonth(new Date(2026, 0, 15)), 1))).toBe(
      "2026-02-01",
    );
    expect(ymd(addMonths(startOfMonth(new Date(2026, 0, 15)), -1))).toBe(
      "2025-12-01",
    );
  });
});

describe("addDays / sameDay", () => {
  it("일수 더하기", () => {
    expect(ymd(addDays(new Date(2026, 0, 31), 1))).toBe("2026-02-01");
  });

  it("같은 날 판정", () => {
    expect(sameDay(new Date(2026, 0, 5, 9), new Date(2026, 0, 5, 23))).toBe(
      true,
    );
    expect(sameDay(new Date(2026, 0, 5), new Date(2026, 0, 6))).toBe(false);
  });
});

describe("calendarGridStart", () => {
  it("그 달 1일이 속한 주의 일요일에서 시작", () => {
    // 2026-01-01 은 목요일 → 그리드 시작은 2025-12-28(일)
    const start = calendarGridStart(startOfMonth(new Date(2026, 0, 1)));
    expect(start.getDay()).toBe(0);
    expect(ymd(start)).toBe("2025-12-28");
  });
});
