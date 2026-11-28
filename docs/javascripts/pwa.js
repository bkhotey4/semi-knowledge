// 安裝成 App 與離線閱讀：註冊 Service Worker，並在 <div class="pwa-install"> 顯示安裝按鈕（或各平台的安裝方式）與「下載全書離線閱讀」
(function () {
  "use strict";
  var CACHE = "semi-textbook-v1"; // 要和 sw.js 一致
  var manifest = document.querySelector('link[rel="manifest"]');
  var base = manifest ? new URL(".", manifest.href).href : null;
  var deferred = null;

  if ("serviceWorker" in navigator && base) {
    navigator.serviceWorker.register(base + "sw.js", { scope: base }).catch(function () {});
  }
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; render(); });
  window.addEventListener("appinstalled", function () { deferred = null; render(); });

  function standalone() { return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; }
  function ios() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function installPart(box) {
    var row = el("div", "ix-row");
    if (standalone()) {
      row.appendChild(el("span", "", "目前已經是以 App 開啟。"));
    } else if (deferred) {
      var btn = el("button", "ix-btn primary", "安裝成 App");
      btn.onclick = function () {
        deferred.prompt();
        deferred.userChoice.finally(function () { deferred = null; render(); });
      };
      row.appendChild(btn);
      row.appendChild(el("span", "ix-muted", "安裝後會出現在桌面或主畫面，像一般 App 一樣開啟。"));
    } else if (ios()) {
      row.appendChild(el("span", "", "iPhone / iPad：用 Safari 開啟本站，點下方的「分享」按鈕，再選「加入主畫面」。"));
    } else {
      row.appendChild(el("span", "", "電腦版 Chrome / Edge：點網址列右側的「安裝」圖示；Android Chrome：點右上角選單，選「安裝應用程式」或「加到主畫面」。"));
    }
    box.appendChild(row);
  }

  function offlinePart(box) {
    if (!("caches" in window) || !base) return;
    var row = el("div", "ix-row");
    var btn = el("button", "ix-btn", "下載全書離線閱讀");
    var status = el("span", "ix-muted", "下載後，沒有網路也能讀已完成的章節（含圖片）。");
    btn.onclick = function () { download(btn, status); };
    row.appendChild(btn);
    row.appendChild(status);
    box.appendChild(row);
  }

  async function download(btn, status) {
    btn.disabled = true;
    try {
      var cache = await caches.open(CACHE);
      var chapters = (await fetch(base + "data/chapters.json", { cache: "no-cache" }).then(function (r) { return r.json(); }))
        .filter(function (c) { return c.written; });
      var pages = [""].concat(chapters.map(function (c) { return c.url; }),
        ["cards/", "equipment/", "models/", "dataflow/", "labs/", "flashcards/", "daily/", "pe-oncall/", "wafer-life/", "puzzles/", "glossary/"]);
      var done = 0, failed = 0;
      for (var i = 0; i < pages.length; i++) {
        var url = base + pages[i];
        try {
          var res = await fetch(url, { cache: "no-cache" });
          if (!res.ok) throw new Error(res.status);
          var html = await res.clone().text();
          await cache.put(url, res);
          // 一併下載該頁的圖片、樣式與腳本（含 KaTeX 等 CDN 資源），離線時版面與公式才能正常顯示
          var doc = new DOMParser().parseFromString(html, "text/html");
          var assets = Array.prototype.map.call(doc.querySelectorAll("img[src], script[src], link[rel=stylesheet][href]"), function (n) {
            return new URL(n.getAttribute("src") || n.getAttribute("href"), url).href;
          });
          await Promise.all(assets.filter(function (src) { return src.indexOf(location.origin) === 0 || /^https:\/\/cdn\.jsdelivr\.net\//.test(src); }).map(function (src) {
            return cache.match(src).then(function (hit) { return hit || cache.add(src).catch(function () {}); });
          }));
        } catch (e) {
          failed++;
        }
        done++;
        status.textContent = "下載中… " + done + " / " + pages.length + " 頁";
      }
      status.textContent = failed ? "完成，但有 " + failed + " 頁下載失敗，可以再按一次重試。" : "已下載 " + chapters.length + " 章與互動頁面，可以離線閱讀。";
    } catch (e) {
      status.textContent = "下載失敗，請確認網路連線後再試一次。";
    }
    btn.disabled = false;
  }

  function render() {
    document.querySelectorAll(".pwa-install").forEach(function (box) {
      box.textContent = "";
      box.classList.add("ix-card");
      installPart(box);
      offlinePart(box);
    });
  }

  if (window.document$ && window.document$.subscribe) window.document$.subscribe(render);
  else document.addEventListener("DOMContentLoaded", render);
})();
