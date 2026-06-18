// 회원 앱 레이아웃. AppShell이 모바일 프레임(폭/배경)을 제공하므로 여기선 패딩만.
export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="px-5 py-6">{children}</div>;
}
