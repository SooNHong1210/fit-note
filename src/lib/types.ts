// 도메인 타입
// Stage 0: Member / Lesson / Comment
// Stage 1: Shop / Availability / Booking + Member 확장(기기 연결, 상태)

export type LessonStatus = "scheduled" | "done" | "canceled";

// 예약 상태 가시화 4단계 (SPEC 4.2)
export type BookingStatus = "requested" | "seen" | "approved" | "rejected";

// 회원 연결 상태: invited(선생님이 등록만, 기기 미연결) / active(기기 연결됨)
export type MemberStatus = "invited" | "active";

// 선생님 (멀티 대비. 현재 UI는 단일 선생님으로만 동작)
export interface Trainer {
  id: string;
  shopId?: string;
  name: string;
  phone?: string;
  createdAt: string;
}

export interface Member {
  id: string;
  trainerId?: string; // 전담 선생님(멀티 대비). 현재는 미설정(단일 선생님)
  name: string;
  birthDate?: string; // 격리 대상: 본인확인용
  phone?: string; // 알림톡용(선택)
  devicePublicKey?: string; // Stage 1: 회원 기기 연결 신원
  status: MemberStatus;
  passTotal: number; // 회원권 총 횟수 (0 = 미설정)
  passUsed: number; // 사용 횟수 → 표시: passUsed/passTotal (예: 6/10)
  createdAt: string; // ISO
}

export interface Lesson {
  id: string;
  memberId: string;
  trainerId?: string; // 담당 선생님(멀티 선생님)
  startsAt: string; // ISO
  endsAt: string; // ISO
  status: LessonStatus;
  createdAt: string;
}

export interface Comment {
  id: string;
  memberId: string;
  lessonId?: string;
  text: string; // 격리 대상: 민감 가능
  createdAt: string;
}

// 샵 (= 테넌트). 선생님 계정이 하나의 샵을 소유.
export interface Shop {
  id: string;
  name: string;
  code: string; // 회원이 입력하는 6자리 가입 코드
  sessionMinutes: number; // 슬롯 길이
  advanceLimit: number; // 회원당 미리 잡을 수 있는 예약 수 (0 = 무제한)
  createdAt: string;
}

// 주간 영업시간 (요일별). slotMinutes는 shop.sessionMinutes 사용.
export interface Availability {
  id: string;
  trainerId?: string; // 선생님별 스케줄(멀티 대비). 현재는 미설정(단일 선생님)
  weekday: number; // 0(일) ~ 6(토)
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

export interface Booking {
  id: string;
  memberId: string;
  trainerId?: string; // 신청 대상 선생님
  slotStartsAt: string; // ISO
  slotEndsAt: string; // ISO
  status: BookingStatus;
  createdAt: string;
  respondedAt?: string;
}

// 그룹 수업(정원제, 선착순 자동 등록 — 선생님 승인 없음)
export interface GroupClass {
  id: string;
  title: string;
  trainerId?: string; // 담당 선생님(강사)
  startsAt: string; // ISO
  endsAt: string; // ISO
  capacity: number; // 총 정원
  createdAt: string;
}

// 정원 대비 등록 수가 붙은 뷰
export type ClassWithCount = GroupClass & { enrolledCount: number };
// 회원 화면용(내가 등록했는지 포함)
export type MemberClassView = ClassWithCount & { enrolledByMe: boolean };

export interface Enrollment {
  id: string;
  classId: string;
  memberId: string;
  createdAt: string;
}

export type EnrollResult = "ok" | "full" | "already" | "not_member";

// 생성 입력 타입 (id/createdAt은 저장소가 채움)
export type NewMember = Omit<
  Member,
  "id" | "createdAt" | "status" | "devicePublicKey" | "passTotal" | "passUsed"
> & {
  status?: MemberStatus;
};
export type NewLesson = Omit<Lesson, "id" | "createdAt" | "status"> & {
  status?: LessonStatus;
};
export type NewComment = Omit<Comment, "id" | "createdAt">;
export type NewBooking = Omit<
  Booking,
  "id" | "createdAt" | "status" | "respondedAt"
>;
export type NewAvailability = Omit<Availability, "id">;
export type NewGroupClass = Omit<GroupClass, "id" | "createdAt">;
export type NewTrainer = Omit<Trainer, "id" | "createdAt" | "shopId">;
