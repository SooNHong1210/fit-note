// 레포지토리 계약(인터페이스).
// 모든 데이터 접근은 이 인터페이스를 통해서만. 구현체(local/supabase)는 교체 가능.
// → DB 교체, 민감필드 암호화 도입 시 이 경계 뒤만 수정하면 됨.

import type {
  Availability,
  Booking,
  ClassWithCount,
  Comment,
  EnrollResult,
  Lesson,
  Member,
  MemberClassView,
  NewAvailability,
  NewBooking,
  NewComment,
  NewGroupClass,
  NewLesson,
  NewMember,
  NewTrainer,
  Shop,
  Trainer,
} from "@/lib/types";

// 회원 수정 가능 필드 (devicePublicKey/status 포함)
export type MemberPatch = Partial<Omit<Member, "id" | "createdAt">>;

export interface Repository {
  // 회원
  listMembers(): Promise<Member[]>;
  getMember(id: string): Promise<Member | null>;
  createMember(input: NewMember): Promise<Member>;
  updateMember(id: string, patch: MemberPatch): Promise<Member>;
  deleteMember(id: string): Promise<void>;
  // 회원 본인확인 & 기기 연결.
  // claimMember: 이름+생일로 찾아 이 기기에 연결(Supabase는 익명인증+claim RPC).
  //   반환 null = 등록된 회원 아님. throw "already_claimed" = 다른 기기에 연결됨.
  claimMember(
    name: string,
    birthDate: string,
    devicePublicKey: string,
  ): Promise<Member | null>;
  findMemberByNameBirth(name: string, birthDate: string): Promise<Member | null>;
  claimMemberDevice(memberId: string, publicKey: string): Promise<Member>;

  // 수업
  listLessons(range?: { from: string; to: string }): Promise<Lesson[]>;
  listLessonsByMember(memberId: string): Promise<Lesson[]>;
  createLesson(input: NewLesson): Promise<Lesson>;
  updateLesson(
    id: string,
    patch: Partial<Omit<Lesson, "id" | "createdAt">>,
  ): Promise<Lesson>;
  deleteLesson(id: string): Promise<void>;

  // 코멘트
  listCommentsByMember(memberId: string): Promise<Comment[]>;
  createComment(input: NewComment): Promise<Comment>;
  deleteComment(id: string): Promise<void>;

  // 샵 (멀티 테넌트)
  getShop(): Promise<Shop | null>; // 현재 활성 샵
  createShop(name: string, code: string): Promise<Shop>; // 샵 생성(주소 직접 지정) + 활성화
  findShopByCode(code: string): Promise<Shop | null>; // 샵 주소(slug) 조회
  setShopCode(code: string): Promise<Shop>; // 활성 샵 주소 변경(중복 시 throw)
  saveShop(input: {
    name: string;
    sessionMinutes: number;
    advanceLimit: number;
  }): Promise<Shop>;

  // 선생님 (멀티 선생님 — 오너가 레코드로 관리)
  listTrainers(): Promise<Trainer[]>;
  createTrainer(input: NewTrainer): Promise<Trainer>;
  updateTrainer(id: string, patch: Partial<NewTrainer>): Promise<Trainer>;
  deleteTrainer(id: string): Promise<void>;

  // Stage 1: 영업시간
  listAvailability(): Promise<Availability[]>;
  setAvailability(list: NewAvailability[]): Promise<Availability[]>;

  // Stage 1: 예약
  listBookings(): Promise<Booking[]>;
  listBookingsByMember(memberId: string): Promise<Booking[]>;
  createBooking(input: NewBooking): Promise<Booking>;
  updateBookingStatus(
    id: string,
    status: Booking["status"],
  ): Promise<Booking>;
  // 회원 취소(승인된 예약이면 대응 수업도 취소)
  cancelBooking(bookingId: string): Promise<void>;
  // 인박스 열람 시 requested → seen 일괄 처리
  markRequestedSeen(): Promise<void>;

  // 그룹 수업 (정원제, 선착순)
  listClasses(range?: { from: string; to: string }): Promise<ClassWithCount[]>; // 선생님
  createClass(input: NewGroupClass): Promise<ClassWithCount>;
  deleteClass(id: string): Promise<void>;
  listEnrolledMembers(classId: string): Promise<Member[]>; // 선생님: 등록 명단
  listClassesForMember(memberId: string): Promise<MemberClassView[]>; // 회원
  enrollClass(classId: string, memberId: string): Promise<EnrollResult>; // 선착순 등록
  cancelEnrollment(classId: string, memberId: string): Promise<void>;
}
