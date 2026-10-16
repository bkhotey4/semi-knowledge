// 半導體教科書遊戲學習：PE 值班模擬、晶圓的一生、製程排序拼圖、每日挑戰與成就徽章
// 依賴 interactive.js 提供的 window.SemiIX 工具
(function () {
  "use strict";
  var IX = window.SemiIX;
  if (!IX) return;
  var el = IX.el, store = IX.store;

  function getJSON(path) { return fetch(IX.dataUrl(path), { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function chapterLinks(ids, chapters) {
    var box = el("div", { class: "ix-muted" });
    var items = ids.map(function (id) { return chapters[id]; }).filter(Boolean);
    if (!items.length) return null;
    box.appendChild(document.createTextNode("延伸閱讀："));
    items.forEach(function (c, i) {
      if (i) box.appendChild(document.createTextNode("、"));
      box.appendChild(c.written ? el("a", { href: IX.pageUrl(c.url), text: "第 " + c.n + " 章 " + c.title }) : el("span", { text: "第 " + c.n + " 章 " + c.title + "（撰寫中）" }));
    });
    return box;
  }
  function loadChapters() {
    return getJSON("chapters.json").then(function (list) { var m = {}; list.forEach(function (c) { m[c.id] = c; }); return m; }).catch(function () { return {}; });
  }

  // ── 晶圓圖（canvas）─────────────────────────────
  function drawWaferMap(canvas, pattern, failRate, badFraction) {
    var dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    var g = canvas.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    var cs = getComputedStyle(canvas), line = cs.getPropertyValue("--md-default-fg-color--light").trim() || "#777";
    var R = Math.min(W, H) / 2 - 6, cx = W / 2, cy = H / 2, n = 22, side = 2 * R / n * 0.98;
    g.strokeStyle = line; g.beginPath(); g.arc(cx, cy, R, 0, 2 * Math.PI); g.stroke();
    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    var dies = [];
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
      var x = (i - n / 2) * side, y = (j - n / 2) * side;
      var far = Math.max(Math.hypot(x, y), Math.hypot(x + side, y), Math.hypot(x, y + side), Math.hypot(x + side, y + side));
      if (far > R * 0.97) continue;
      var r = Math.hypot(x + side / 2, y + side / 2) / R, p;
      if (pattern === "edge") p = r > 0.78 ? failRate : failRate * 0.06;
      else if (pattern === "center") p = r < 0.3 ? failRate : failRate * 0.06;
      else if (pattern === "ring") p = r > 0.45 && r < 0.62 ? failRate : failRate * 0.06;
      else if (pattern === "scratch") p = Math.abs((y + side / 2) - 0.6 * (x + side / 2) + 0.15 * R) < side * 0.9 ? 0.9 : failRate * 0.05;
      else p = failRate;
      dies.push({ x: x, y: y, p: p });
    }
    if (badFraction !== undefined) {
      // 晶圓的一生：依目前良率決定壞晶粒數量，位置固定但數量隨答錯增加
      var order = dies.map(function (d, k) { return { k: k, v: rnd() }; }).sort(function (a, b) { return a.v - b.v; });
      var badCount = Math.round(dies.length * badFraction);
      dies.forEach(function (d) { d.bad = false; });
      order.slice(0, badCount).forEach(function (o) { dies[o.k].bad = true; });
    } else {
      dies.forEach(function (d) { d.bad = rnd() < d.p; });
    }
    dies.forEach(function (d) {
      g.fillStyle = d.bad ? "rgba(198,40,40,.8)" : "rgba(46,125,50,.45)";
      g.fillRect(cx + d.x + 0.5, cy + d.y + 0.5, side - 1, side - 1);
    });
    return dies;
  }

  // ── PE 值班模擬 ────────────────────────────────
  function renderClue(clue) {
    var box = el("div", { class: "ix-card" }, el("strong", { text: clue.title }));
    if (clue.type === "spc") {
      var c = el("canvas"); box.appendChild(c);
      var pts = clue.points, lo = Math.min.apply(null, pts.concat([clue.lcl])), hi = Math.max.apply(null, pts.concat([clue.ucl]));
      var pad = (hi - lo) * 0.15;
      setTimeout(function () {
        IX.plot(c, {
          x: [1, pts.length], y: [lo - pad, hi + pad], xlabel: "批次", ylabel: clue.unit,
          yfmt: function (v) { return v.toFixed(1); },
          hlines: [{ y: clue.ucl, label: "UCL " + clue.ucl, color: "#c62828", dash: [6, 4] }, { y: clue.lcl, label: "LCL " + clue.lcl, color: "#c62828", dash: [6, 4] }, { y: clue.target, label: "目標 " + clue.target, dash: [2, 3] }],
          series: [{ color: IX.PALETTE[0], pts: pts.map(function (v, i) { return [i + 1, v]; }) }],
          marks: pts.map(function (v, i) { return { x: i + 1, y: v, color: v > clue.ucl || v < clue.lcl ? "#c62828" : IX.PALETTE[0] }; })
        });
      }, 0);
    } else if (clue.type === "trace") {
      var t = el("canvas"); box.appendChild(t);
      var all = clue.normal.concat(clue.abnormal), mn = Math.min.apply(null, all), mx = Math.max.apply(null, all), pd = (mx - mn) * 0.1 || 1;
      setTimeout(function () {
        IX.plot(t, {
          x: [0, clue.normal.length - 1], y: [mn - pd, mx + pd], xlabel: clue.xlabel, ylabel: clue.unit,
          yfmt: function (v) { return v.toFixed(0); },
          series: [{ color: IX.PALETTE[0], pts: clue.normal.map(function (v, i) { return [i, v]; }) }, { color: IX.PALETTE[1], pts: clue.abnormal.map(function (v, i) { return [i, v]; }) }]
        });
      }, 0);
      box.appendChild(IX.legend([{ color: IX.PALETTE[0], label: "正常晶圓" }, { color: IX.PALETTE[1], label: "異常晶圓" }]));
    } else if (clue.type === "wafermap") {
      var w = el("canvas", { style: "width:100%;height:300px" }); box.appendChild(w);
      setTimeout(function () { drawWaferMap(w, clue.pattern, clue.fail_rate); }, 0);
    } else if (clue.type === "table") {
      var table = el("table", {}), head = el("tr", {});
      clue.columns.forEach(function (h) { head.appendChild(el("th", { text: h })); });
      table.appendChild(head);
      clue.rows.forEach(function (r) { var tr = el("tr", {}); r.forEach(function (v) { tr.appendChild(el("td", { text: v })); }); table.appendChild(tr); });
      box.appendChild(el("div", { class: "ix-table-wrap" }, table));
    } else {
      box.appendChild(el("p", { text: clue.body }));
    }
    if (clue.note) box.appendChild(el("p", { class: "ix-muted", text: clue.note }));
    return box;
  }

  function initOncall(root) {
    root.classList.add("ix-card");
    Promise.all([getJSON("pe_cases.json"), loadChapters()]).then(function (res) {
      var cases = res[0], chapters = res[1];
      function menu() {
        var solved = store.get("pe:solved", {});
        root.replaceChildren(el("div", { class: "ix-row" },
          el("strong", { text: "選擇一個值班案例" }),
          el("span", { class: "ix-muted", text: "已解決 " + Object.keys(solved).length + " / " + cases.length })));
        cases.forEach(function (c) {
          var best = solved[c.id];
          root.appendChild(el("button", { class: "ix-quiz-opt", onclick: function () { play(c); } },
            el("strong", { text: c.title }),
            el("span", { class: "ix-muted", text: "　難度：" + c.level + (best !== undefined ? "　最佳分數 " + best : "　尚未挑戰") })));
        });
      }
      function play(c) {
        var minutes = 0, wrong = 0, stepIdx = 0, opened = {};
        var clock = el("span", { class: "ix-muted" });
        var clueArea = el("div"), stepArea = el("div");
        function tick() { clock.textContent = "處理時間 " + minutes + " 分鐘｜答錯 " + wrong + " 次"; }
        var clueButtons = el("div", { class: "ix-row" });
        c.clues.forEach(function (cl, i) {
          clueButtons.appendChild(el("button", { class: "ix-btn", text: "調閱：" + cl.title, onclick: function () {
            if (!opened[i]) { opened[i] = true; minutes += 10; tick(); this.classList.add("primary"); }
            clueArea.replaceChildren(renderClue(cl));
          } }));
        });
        root.replaceChildren(
          el("div", { class: "ix-row" }, el("button", { class: "ix-btn", text: "← 回案例列表", onclick: menu }), clock),
          el("div", { class: "ix-alarm", text: "🚨 " + c.alarm }),
          el("p", { text: c.brief }),
          el("div", { class: "ix-muted", text: "每調閱一項資料會花 10 分鐘；資料看得越少、答得越準，分數越高。" }),
          clueButtons, clueArea, stepArea);
        tick();
        function showStep() {
          var s = c.steps[stepIdx], fb = el("div", { class: "ix-quiz-explain", style: "display:none" });
          var box = el("div", {}, el("div", { class: "ix-quiz-q", text: "第 " + (stepIdx + 1) + " 步：" + s.question }));
          var btns = s.options.map(function (o) {
            return el("button", { class: "ix-quiz-opt", text: o.text, onclick: function () {
              fb.style.display = ""; fb.textContent = o.feedback;
              if (o.correct) {
                this.classList.add("correct");
                btns.forEach(function (b) { b.disabled = true; });
                var next = el("button", { class: "ix-btn primary", text: stepIdx < c.steps.length - 1 ? "下一步" : "結案", onclick: function () {
                  stepIdx++; if (stepIdx < c.steps.length) showStep(); else finish();
                } });
                box.appendChild(next);
              } else {
                this.classList.add("wrong"); this.disabled = true; wrong++; minutes += 15; tick();
              }
            } });
          });
          btns.forEach(function (b) { box.appendChild(b); });
          box.appendChild(fb);
          stepArea.replaceChildren(box);
        }
        function finish() {
          // 每答錯一次扣 20 分；處理時間超過 30 分鐘後，每多 2 分鐘扣 1 分
          var score = Math.round(Math.max(0, Math.min(100, 100 - wrong * 20 - Math.max(0, minutes - 30) / 2)));
          var solved = store.get("pe:solved", {});
          if (solved[c.id] === undefined || score > solved[c.id]) solved[c.id] = score;
          store.set("pe:solved", solved);
          var grade = score >= 90 ? "王牌值班工程師" : score >= 70 ? "可靠的值班工程師" : "還需要多練習";
          stepArea.replaceChildren(el("div", { class: "ix-card" },
            el("div", { class: "ix-score", text: "結案！得分 " + score + "　" + grade }),
            el("p", { class: "ix-muted", text: "處理時間 " + minutes + " 分鐘、答錯 " + wrong + " 次。" }),
            el("p", {}, el("strong", { text: "重點：" }), document.createTextNode(c.takeaway)),
            chapterLinks(c.chapters, chapters),
            el("div", { class: "ix-row" }, el("button", { class: "ix-btn primary", text: "下一個案例", onclick: menu }), el("button", { class: "ix-btn", text: "重玩這個案例", onclick: function () { play(c); } }))));
        }
        showStep();
      }
      menu();
    }).catch(function () { root.textContent = "案例載入失敗。"; });
  }

  // ── 晶圓的一生 ────────────────────────────────
  function initWaferLife(root) {
    root.classList.add("ix-card");
    getJSON("wafer_life.json").then(function (data) {
      var st = data.stations;
      function start() {
        var best = store.get("waferlife:best", null);
        root.replaceChildren(
          el("div", { class: "ix-score", text: "你是一片 300 mm 晶圓" }),
          el("p", { text: "接下來你要經過 " + st.length + " 個站別。每一站回答一個問題：答對順利過關，答錯就會在你身上留下缺陷、降低良率。走完全程後，看看你能產出多少顆好晶片。" }),
          el("p", { class: "ix-muted", text: best === null ? "還沒有紀錄" : "最佳紀錄：良率 " + (best * 100).toFixed(1) + "%" }),
          el("button", { class: "ix-btn primary", text: "開始旅程", onclick: function () { run(); } }));
      }
      function run() {
        var idx = 0, yieldNow = 0.97;
        var track = el("div", { class: "ix-track" }), wafer = el("canvas", { style: "width:100%;height:220px" });
        var stage = el("div"), stat = el("div", { class: "ix-row" });
        root.replaceChildren(track, el("div", { class: "ix-life" }, el("div", {}, wafer, stat), stage));
        function drawTrack() {
          track.replaceChildren();
          st.forEach(function (s, i) {
            track.appendChild(el("span", { class: "ix-step" + (i < idx ? " done" : i === idx ? " now" : ""), title: s.name, text: s.icon }));
          });
        }
        function drawState() {
          drawWaferMap(wafer, "random", 0, 1 - yieldNow);
          stat.replaceChildren(el("span", { class: "ix-score", text: "目前良率 " + (yieldNow * 100).toFixed(1) + "%" }),
            el("span", { class: "ix-muted", text: "預估好晶片 " + Math.round(data.dies * yieldNow) + " / " + data.dies + " 顆" }));
        }
        function station() {
          drawTrack(); drawState();
          var s = st[idx], fb = el("div", { class: "ix-quiz-explain", style: "display:none" });
          var box = el("div", {},
            el("div", { class: "ix-muted", text: "第 " + (idx + 1) + " / " + st.length + " 站" }),
            el("h3", { text: s.icon + " " + s.name }), el("p", { text: s.story }),
            el("div", { class: "ix-quiz-q", text: s.question }));
          var btns = s.options.map(function (o, oi) {
            return el("button", { class: "ix-quiz-opt", text: o, onclick: function () {
              btns.forEach(function (b, bi) { b.disabled = true; if (bi === s.answer) b.classList.add("correct"); });
              if (oi !== s.answer) { this.classList.add("wrong"); yieldNow *= (1 - s.penalty); drawState(); fb.textContent = "留下缺陷！良率下降 " + (s.penalty * 100).toFixed(0) + "%。" + s.explain; }
              else fb.textContent = "順利過關！" + s.explain;
              fb.style.display = "";
              box.appendChild(el("button", { class: "ix-btn primary", text: idx < st.length - 1 ? "前往下一站 →" : "看結果", onclick: function () {
                idx++; if (idx < st.length) station(); else finish();
              } }));
            } });
          });
          btns.forEach(function (b) { box.appendChild(b); });
          box.appendChild(fb);
          stage.replaceChildren(box);
        }
        function finish() {
          drawTrack(); drawState();
          var best = store.get("waferlife:best", 0);
          if (yieldNow > best) store.set("waferlife:best", yieldNow);
          var title = yieldNow >= 0.9 ? "晶圓守護者：你是產線的模範晶圓！" : yieldNow >= 0.75 ? "合格出貨：還有進步空間。" : "良率警報：回頭複習相關章節吧。";
          stage.replaceChildren(el("div", {},
            el("div", { class: "ix-score", text: "旅程結束！" }),
            el("p", { text: "最終良率 " + (yieldNow * 100).toFixed(1) + "%，產出 " + Math.round(data.dies * yieldNow) + " 顆好晶片。" }),
            el("p", { text: title }),
            el("p", { class: "ix-muted", text: "起始良率設為 97%，代表就算全部答對也會有少量隨機缺陷，這是真實晶圓廠的常態。" }),
            el("button", { class: "ix-btn primary", text: "再走一次", onclick: run })));
        }
        station();
      }
      start();
    }).catch(function () { root.textContent = "關卡載入失敗。"; });
  }

  // ── 製程排序拼圖 ───────────────────────────────
  function initPuzzles(root) {
    root.classList.add("ix-card");
    Promise.all([getJSON("puzzles.json"), loadChapters()]).then(function (res) {
      var puzzles = res[0], chapters = res[1];
      var sel = el("select", { class: "ix-select" });
      puzzles.forEach(function (p) {
        var done = store.get("puzzle:" + p.id, null);
        sel.appendChild(el("option", { value: p.id, text: p.title + "（" + p.level + "）" + (done !== null ? " ✓" : "") }));
      });
      var area = el("div");
      sel.addEventListener("change", function () { load(); });
      root.replaceChildren(el("div", { class: "ix-row" }, el("strong", { text: "選擇題目：" }), sel), area);
      function load() {
        var p = puzzles.filter(function (x) { return x.id === sel.value; })[0];
        var order = IX.shuffle(p.steps.map(function (s, i) { return i; }));
        while (order.every(function (v, i) { return v === i; })) order = IX.shuffle(order);
        var startTime = null, timer = null, moves = 0;
        var list = el("ol", { class: "ix-puzzle" }), info = el("div", { class: "ix-row" }), result = el("div");
        var clock = el("span", { class: "ix-muted", text: "計時：0 秒" });
        function startClock() {
          if (startTime) return;
          startTime = Date.now();
          timer = setInterval(function () { clock.textContent = "計時：" + Math.round((Date.now() - startTime) / 1000) + " 秒"; }, 500);
        }
        function render() {
          list.replaceChildren();
          order.forEach(function (stepIdx, pos) {
            var li = el("li", { draggable: "true", class: "ix-piece" },
              el("span", { class: "grip", text: "⋮⋮" }), el("span", { class: "txt", text: p.steps[stepIdx] }),
              el("span", { class: "mv" },
                el("button", { class: "ix-btn", text: "↑", title: "上移", onclick: function () { move(pos, pos - 1); } }),
                el("button", { class: "ix-btn", text: "↓", title: "下移", onclick: function () { move(pos, pos + 1); } })));
            li.addEventListener("dragstart", function (e) { e.dataTransfer.setData("text/plain", String(pos)); li.classList.add("dragging"); });
            li.addEventListener("dragend", function () { li.classList.remove("dragging"); });
            li.addEventListener("dragover", function (e) { e.preventDefault(); });
            li.addEventListener("drop", function (e) { e.preventDefault(); move(+e.dataTransfer.getData("text/plain"), pos); });
            list.appendChild(li);
          });
        }
        function move(from, to) {
          if (to < 0 || to >= order.length || from === to) return;
          startClock(); moves++;
          var v = order.splice(from, 1)[0]; order.splice(to, 0, v);
          result.replaceChildren(); render();
        }
        function check() {
          startClock();
          var items = list.children, ok = 0;
          order.forEach(function (stepIdx, pos) {
            var right = stepIdx === pos;
            if (right) ok++;
            items[pos].classList.toggle("right", right);
            items[pos].classList.toggle("wrong", !right);
          });
          if (ok === order.length) {
            clearInterval(timer);
            var secs = Math.round((Date.now() - startTime) / 1000), best = store.get("puzzle:" + p.id, null);
            if (best === null || secs < best) store.set("puzzle:" + p.id, secs);
            result.replaceChildren(el("div", { class: "ix-card" },
              el("div", { class: "ix-score", text: "全部正確！用時 " + secs + " 秒、移動 " + moves + " 次" + (best !== null && secs >= best ? "（最佳 " + best + " 秒）" : "（新紀錄）") }),
              el("p", { text: p.explain }), chapterLinks(p.chapters, chapters)));
          } else {
            result.replaceChildren(el("p", { class: "ix-muted", text: "對了 " + ok + " / " + order.length + " 個位置（綠色是對的）。繼續調整！" }));
          }
        }
        info.append(clock, el("button", { class: "ix-btn primary", text: "檢查答案", onclick: check }), el("button", { class: "ix-btn", text: "重新打亂", onclick: load }));
        area.replaceChildren(el("p", { class: "ix-muted", text: "把步驟拖曳（或用 ↑↓）排成正確順序。" }), list, info, result);
        render();
      }
      load();
    }).catch(function () { root.textContent = "拼圖載入失敗。"; });
  }

  // ── 每日挑戰 ───────────────────────────────────
  function seeded(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () { h += 0x6D2B79F5; var t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function initDaily(root) {
    root.classList.add("ix-card");
    loadChapters().then(function (chapters) {
      var ids = Object.keys(chapters).filter(function (id) { return chapters[id].written; });
      return Promise.all(ids.map(function (id) {
        return getJSON("quizzes/" + id + ".json").then(function (qs) { return qs.map(function (q) { q.chapter = chapters[id]; return q; }); }).catch(function () { return []; });
      }));
    }).then(function (groups) {
      var pool = [].concat.apply([], groups);
      if (!pool.length) { root.textContent = "目前還沒有可用的題目。"; return; }
      var d = today(), rnd = seeded(d), picks = [];
      var idxs = pool.map(function (_, i) { return i; });
      for (var i = idxs.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = idxs[i]; idxs[i] = idxs[j]; idxs[j] = t; }
      picks = idxs.slice(0, Math.min(3, pool.length)).map(function (i) { return pool[i]; });
      var streak = store.get("daily:streak", 0), last = store.get("daily:last", "");
      var head = el("div", { class: "ix-row" },
        el("strong", { text: "今日挑戰（" + d + "）" }),
        el("span", { class: "ix-muted", text: "🔥 連續 " + (last === d || isYesterday(last) ? streak : 0) + " 天｜最長 " + store.get("daily:best", 0) + " 天｜累計 " + store.get("daily:count", 0) + " 次" }));
      root.replaceChildren(head);
      if (last === d) {
        root.appendChild(el("p", { text: "今天已經完成挑戰，得分 " + store.get("daily:score", 0) + " / " + picks.length + "。明天再來延續連續紀錄！" }));
        return;
      }
      var answered = 0, correct = 0;
      picks.forEach(function (q, qi) {
        root.appendChild(el("div", { class: "ix-quiz-q", text: (qi + 1) + ". " + q.q }));
        var fb = el("div", { class: "ix-quiz-explain", style: "display:none" });
        var btns = q.options.map(function (o, oi) {
          return el("button", { class: "ix-quiz-opt", text: "ABCD"[oi] + ". " + o, onclick: function () {
            btns.forEach(function (b, bi) { b.disabled = true; if (bi === q.answer) b.classList.add("correct"); });
            if (oi === q.answer) correct++; else this.classList.add("wrong");
            fb.replaceChildren(document.createTextNode(q.explain + "　"), el("a", { href: IX.pageUrl(q.chapter.url), text: "（第 " + q.chapter.n + " 章）" }));
            fb.style.display = "";
            if (++answered === picks.length) finish();
          } });
        });
        btns.forEach(function (b) { root.appendChild(b); });
        root.appendChild(fb);
      });
      function finish() {
        var newStreak = isYesterday(last) ? streak + 1 : 1;
        store.set("daily:last", d); store.set("daily:streak", newStreak); store.set("daily:score", correct);
        store.set("daily:best", Math.max(store.get("daily:best", 0), newStreak));
        store.set("daily:count", store.get("daily:count", 0) + 1);
        if (correct === picks.length) store.set("daily:perfect", store.get("daily:perfect", 0) + 1);
        root.appendChild(el("div", { class: "ix-score", text: "完成！得分 " + correct + " / " + picks.length + "，連續 " + newStreak + " 天 🔥" }));
        document.querySelectorAll(".badges[data-ready]").forEach(function (b) { renderBadges(b); });
      }
    });
  }
  function isYesterday(dateStr) {
    if (!dateStr) return false;
    var y = new Date(); y.setDate(y.getDate() - 1);
    var s = y.getFullYear() + "-" + String(y.getMonth() + 1).padStart(2, "0") + "-" + String(y.getDate()).padStart(2, "0");
    return s === dateStr;
  }

  // ── 成就徽章 ───────────────────────────────────
  function quizStats() {
    var done = 0, perfect = 0;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf("semi:quiz:") === 0) {
        done++;
        var id = k.slice("semi:quiz:".length);
        if (store.get("quiz:" + id, -1) === store.get("quiztotal:" + id, -2)) perfect++;
      }
    }
    return { done: done, perfect: perfect };
  }
  function renderBadges(root) {
    Promise.all([getJSON("pe_cases.json").catch(function () { return []; }), getJSON("puzzles.json").catch(function () { return []; })]).then(function (res) {
      var nCases = res[0].length, puzzles = res[1];
      var q = quizStats(), solved = store.get("pe:solved", {}), solvedIds = Object.keys(solved);
      var known = store.get("known-terms", {}), knownCount = Object.keys(known).filter(function (k) { return known[k]; }).length;
      var visited = Object.keys(store.get("visited", {})).length;
      var puzzlesDone = puzzles.filter(function (p) { return store.get("puzzle:" + p.id, null) !== null; }).length;
      var badges = [
        ["🌱", "第一步", "完成第一次每日挑戰", store.get("daily:count", 0) >= 1],
        ["🔥", "三日不輟", "每日挑戰連續 3 天", store.get("daily:best", 0) >= 3],
        ["🏆", "週週向上", "每日挑戰連續 7 天", store.get("daily:best", 0) >= 7],
        ["📖", "博覽群書", "閱讀 5 個章節", visited >= 5],
        ["✍️", "測驗達人", "完成 5 章的章節測驗", q.done >= 5],
        ["💯", "滿分學霸", "任一章節測驗拿到滿分", q.perfect >= 1],
        ["🃏", "術語收藏家", "閃卡掌握 30 個術語", knownCount >= 30],
        ["👷", "值班新手", "解決第一個 PE 值班案例", solvedIds.length >= 1],
        ["🚒", "救火隊長", "解決所有 PE 值班案例", nCases > 0 && solvedIds.length >= nCases],
        ["🎯", "零失誤工程師", "任一值班案例拿到 90 分以上", solvedIds.some(function (k) { return solved[k] >= 90; })],
        ["💎", "晶圓守護者", "晶圓的一生良率達 90% 以上", store.get("waferlife:best", 0) >= 0.9],
        ["🧩", "流程大師", "完成全部製程排序拼圖", puzzles.length > 0 && puzzlesDone >= puzzles.length]
      ];
      var got = badges.filter(function (b) { return b[3]; }).length;
      var grid = el("div", { class: "ix-badges" });
      badges.forEach(function (b) {
        grid.appendChild(el("div", { class: "ix-badge" + (b[3] ? " got" : "") },
          el("div", { class: "icon", text: b[3] ? b[0] : "🔒" }), el("strong", { text: b[1] }), el("div", { class: "ix-muted", text: b[2] })));
      });
      root.replaceChildren(el("div", { class: "ix-row" }, el("strong", { text: "成就徽章" }), el("span", { class: "ix-muted", text: "已解鎖 " + got + " / " + badges.length })), grid);
    });
  }

  function init() {
    [[".pe-oncall", initOncall], [".wafer-life", initWaferLife], [".puzzles", initPuzzles], [".daily-challenge", initDaily],
     [".badges", function (n) { n.classList.add("ix-card"); renderBadges(n); }]].forEach(function (pair) {
      document.querySelectorAll(pair[0] + ":not([data-ready])").forEach(function (n) { n.setAttribute("data-ready", "1"); pair[1](n); });
    });
  }
  if (window.document$ && window.document$.subscribe) window.document$.subscribe(init);
  else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
