// 최소 서비스워커: 앱 셸 캐싱 + 오프라인 폴백.
// Stage 0 검증용. 푸시 알림은 Stage 1에서 추가.
const CACHE = "reservation-v1";
const SHELL = ["/", "/calendar", "/members"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

// 네트워크 우선, 실패 시 캐시 (네비게이션 요청만 처리)
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/"))),
    );
  }
});

// 웹푸시 수신 → 알림 표시
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "핏노트";
  const options = {
    body: data.body || "새 알림이 있습니다.",
    icon: "/icon.svg",
    badge: "/icon.svg",
    data: { url: data.url || "/bookings" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// 알림 클릭 → 해당 화면 열기(이미 열려 있으면 포커스)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((list) => {
      for (const c of list) {
        if (c.url.includes(url) && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
