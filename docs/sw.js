// 半導體教科書 App 的 Service Worker：讓網站可以安裝成 App，並在離線時讀取看過或下載過的章節
// 頁面：先連網取最新內容，失敗才用快取；圖片、腳本、資料：先用快取，背景再更新
// 快取名稱要和 javascripts/pwa.js 的 CACHE 一致；需要清掉舊快取時把版本號加 1
const CACHE = "semi-textbook-v1";
const CDN = /(^|\.)cdn\.jsdelivr\.net$|(^|\.)fonts\.(googleapis|gstatic)\.com$/;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("semi-textbook-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin && !CDN.test(url.hostname)) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(url.origin + url.pathname, res.clone()));
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE);
          return (await cache.match(url.origin + url.pathname)) || (await cache.match(self.registration.scope)) ||
            new Response("<meta charset=utf-8><p style='font-family:sans-serif;padding:2em'>目前離線，這一頁還沒有下載。連上網路後再試一次，或在首頁按「下載全書離線閱讀」。</p>",
              { headers: { "Content-Type": "text/html; charset=utf-8" } });
        })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: url.origin === location.origin });
      const update = fetch(req)
        .then((res) => {
          if (res.ok || res.type === "opaque") cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || update;
    })
  );
});
