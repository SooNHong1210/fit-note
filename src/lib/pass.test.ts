import { describe, expect, it } from "vitest";
import { clampPassUsed, nextPassUsedOnDone, passRemaining } from "./pass";

describe("nextPassUsedOnDone", () => {
  it("총 횟수가 설정돼 있고 잔여가 있으면 1 증가", () => {
    expect(nextPassUsedOnDone({ passTotal: 10, passUsed: 5 })).toBe(6);
  });

  it("회원권 미설정(0)이면 그대로", () => {
    expect(nextPassUsedOnDone({ passTotal: 0, passUsed: 0 })).toBe(0);
  });

  it("이미 소진됐으면 더 늘지 않음", () => {
    expect(nextPassUsedOnDone({ passTotal: 10, passUsed: 10 })).toBe(10);
  });
});

describe("clampPassUsed", () => {
  it("증가는 총 횟수를 넘지 않음", () => {
    expect(clampPassUsed({ passTotal: 10, passUsed: 10 }, 1)).toBe(10);
  });

  it("감소는 0 미만으로 내려가지 않음", () => {
    expect(clampPassUsed({ passTotal: 10, passUsed: 0 }, -1)).toBe(0);
  });

  it("정상 범위에서는 delta 적용", () => {
    expect(clampPassUsed({ passTotal: 10, passUsed: 5 }, -1)).toBe(4);
    expect(clampPassUsed({ passTotal: 10, passUsed: 5 }, 1)).toBe(6);
  });
});

describe("passRemaining", () => {
  it("잔여 = 총 - 사용", () => {
    expect(passRemaining({ passTotal: 10, passUsed: 6 })).toBe(4);
  });

  it("음수가 되지 않음", () => {
    expect(passRemaining({ passTotal: 10, passUsed: 12 })).toBe(0);
  });
});
