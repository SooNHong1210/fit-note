import { beforeEach, describe, expect, it } from "vitest";
import { LocalRepository } from "./local";
import { clearActiveShop } from "@/lib/activeShop";

// 각 테스트 전에 저장소를 비우고 새 샵을 만들어 활성화(멀티샵 스코프).
beforeEach(async () => {
  window.localStorage.clear();
  clearActiveShop();
  await new LocalRepository().createShop("테스트샵", "test-shop");
});

function repo() {
  return new LocalRepository();
}

describe("회원 CRUD", () => {
  it("생성 시 status=invited, 회원권 0/0 기본값", async () => {
    const r = repo();
    const m = await r.createMember({ name: "홍길동", birthDate: "1990-01-15" });
    expect(m.id).toBeTruthy();
    expect(m.status).toBe("invited");
    expect(m.passTotal).toBe(0);
    expect(m.passUsed).toBe(0);
  });

  it("목록은 이름순 정렬", async () => {
    const r = repo();
    await r.createMember({ name: "나회원" });
    await r.createMember({ name: "가회원" });
    const list = await r.listMembers();
    expect(list.map((m) => m.name)).toEqual(["가회원", "나회원"]);
  });

  it("회원 삭제 시 관련 수업·코멘트·예약도 함께 삭제", async () => {
    const r = repo();
    const m = await r.createMember({ name: "홍길동" });
    await r.createLesson({
      memberId: m.id,
      startsAt: new Date(2026, 0, 5, 10).toISOString(),
      endsAt: new Date(2026, 0, 5, 11).toISOString(),
    });
    await r.createComment({ memberId: m.id, text: "잘했어요" });
    await r.createBooking({
      memberId: m.id,
      slotStartsAt: new Date(2026, 0, 6, 10).toISOString(),
      slotEndsAt: new Date(2026, 0, 6, 11).toISOString(),
    });

    await r.deleteMember(m.id);

    expect(await r.listLessonsByMember(m.id)).toHaveLength(0);
    expect(await r.listCommentsByMember(m.id)).toHaveLength(0);
    expect(await r.listBookingsByMember(m.id)).toHaveLength(0);
  });
});

describe("회원 본인확인 & 기기 연결", () => {
  it("이름+생일로 회원을 찾는다", async () => {
    const r = repo();
    await r.createMember({ name: "홍길동", birthDate: "1990-01-15" });
    const found = await r.findMemberByNameBirth("홍길동", "1990-01-15");
    expect(found?.name).toBe("홍길동");
  });

  it("생일이 다르면 못 찾는다", async () => {
    const r = repo();
    await r.createMember({ name: "홍길동", birthDate: "1990-01-15" });
    expect(await r.findMemberByNameBirth("홍길동", "2000-01-01")).toBeNull();
  });

  it("기기 연결 시 status=active, publicKey 저장", async () => {
    const r = repo();
    const m = await r.createMember({ name: "홍길동", birthDate: "1990-01-15" });
    const claimed = await r.claimMemberDevice(m.id, "dev_abc");
    expect(claimed.status).toBe("active");
    expect(claimed.devicePublicKey).toBe("dev_abc");
  });
});

describe("예약 상태 흐름", () => {
  it("신청은 requested 상태로 생성", async () => {
    const r = repo();
    const m = await r.createMember({ name: "홍길동" });
    const b = await r.createBooking({
      memberId: m.id,
      slotStartsAt: new Date(2026, 0, 6, 10).toISOString(),
      slotEndsAt: new Date(2026, 0, 6, 11).toISOString(),
    });
    expect(b.status).toBe("requested");
  });

  it("markRequestedSeen 은 requested만 seen으로 바꾼다", async () => {
    const r = repo();
    const m = await r.createMember({ name: "홍길동" });
    const b = await r.createBooking({
      memberId: m.id,
      slotStartsAt: new Date(2026, 0, 6, 10).toISOString(),
      slotEndsAt: new Date(2026, 0, 6, 11).toISOString(),
    });
    await r.updateBookingStatus(b.id, "approved");
    const b2 = await r.createBooking({
      memberId: m.id,
      slotStartsAt: new Date(2026, 0, 7, 10).toISOString(),
      slotEndsAt: new Date(2026, 0, 7, 11).toISOString(),
    });

    await r.markRequestedSeen();

    const all = await r.listBookingsByMember(m.id);
    const approved = all.find((x) => x.id === b.id);
    const seen = all.find((x) => x.id === b2.id);
    expect(approved?.status).toBe("approved"); // 변하지 않음
    expect(seen?.status).toBe("seen"); // requested → seen
  });

  it("승인/거절 시 respondedAt 기록", async () => {
    const r = repo();
    const m = await r.createMember({ name: "홍길동" });
    const b = await r.createBooking({
      memberId: m.id,
      slotStartsAt: new Date(2026, 0, 6, 10).toISOString(),
      slotEndsAt: new Date(2026, 0, 6, 11).toISOString(),
    });
    const approved = await r.updateBookingStatus(b.id, "approved");
    expect(approved.respondedAt).toBeTruthy();
  });
});

describe("그룹 수업 선착순 등록", () => {
  async function makeClass(capacity: number) {
    const r = repo();
    const c = await r.createClass({
      title: "요가",
      startsAt: new Date(2026, 0, 10, 10).toISOString(),
      endsAt: new Date(2026, 0, 10, 11).toISOString(),
      capacity,
    });
    return c.id;
  }

  it("정원까지 등록되고 초과 시 full", async () => {
    const r = repo();
    const classId = await makeClass(2);
    const a = await r.createMember({ name: "가" });
    const b = await r.createMember({ name: "나" });
    const c = await r.createMember({ name: "다" });
    expect(await r.enrollClass(classId, a.id)).toBe("ok");
    expect(await r.enrollClass(classId, b.id)).toBe("ok");
    expect(await r.enrollClass(classId, c.id)).toBe("full");
  });

  it("같은 회원 중복 등록은 already", async () => {
    const r = repo();
    const classId = await makeClass(5);
    const a = await r.createMember({ name: "가" });
    expect(await r.enrollClass(classId, a.id)).toBe("ok");
    expect(await r.enrollClass(classId, a.id)).toBe("already");
  });

  it("취소하면 자리가 다시 생긴다", async () => {
    const r = repo();
    const classId = await makeClass(1);
    const a = await r.createMember({ name: "가" });
    const b = await r.createMember({ name: "나" });
    expect(await r.enrollClass(classId, a.id)).toBe("ok");
    expect(await r.enrollClass(classId, b.id)).toBe("full");
    await r.cancelEnrollment(classId, a.id);
    expect(await r.enrollClass(classId, b.id)).toBe("ok");
  });

  it("listClassesForMember 는 등록수/내 등록 여부 반영", async () => {
    const r = repo();
    const classId = await makeClass(3);
    const a = await r.createMember({ name: "가" });
    await r.enrollClass(classId, a.id);
    const view = (await r.listClassesForMember(a.id)).find(
      (c) => c.id === classId,
    );
    expect(view?.enrolledCount).toBe(1);
    expect(view?.enrolledByMe).toBe(true);
  });
});

describe("회원권 업데이트", () => {
  it("passTotal/passUsed 수정", async () => {
    const r = repo();
    const m = await r.createMember({ name: "홍길동" });
    const updated = await r.updateMember(m.id, { passTotal: 10, passUsed: 6 });
    expect(updated.passTotal).toBe(10);
    expect(updated.passUsed).toBe(6);
  });
});
