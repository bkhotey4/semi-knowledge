// 半導體教科書互動元件：章節測驗、術語閃卡、學習進度、互動實驗室
// 頁面上放 <div class="quiz" data-quiz="01-01">、<div class="flashcards">、<div class="progress-widget">、<div class="lab" data-lab="intrinsic"> 即可
(function () {
  "use strict";

  // ── 共用工具 ───────────────────────────────────────
  function siteBase() {
    try {
      var cfg = JSON.parse(document.getElementById("__config").textContent);
      return new URL(cfg.base.replace(/\/?$/, "/"), location.href);
    } catch (e) {
      return new URL("./", location.href);
    }
  }
  function dataUrl(path) { return new URL("data/" + path, siteBase()).href; }
  function pageUrl(path) { return new URL(path, siteBase()).href; }

  var store = {
    get: function (k, d) {
      try { var v = localStorage.getItem("semi:" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) { try { localStorage.setItem("semi:" + k, JSON.stringify(v)); } catch (e) { /* 無痕模式等情況略過 */ } }
  };

  function el(tag, attrs) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") node.textContent = attrs[k];
      else if (k === "html") node.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0) node.addEventListener(k.slice(2), attrs[k]);
      else node.setAttribute(k, attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) if (arguments[i]) node.appendChild(arguments[i]);
    return node;
  }

  var SUP = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
  function sci(v, digits) {
    digits = digits === undefined ? 2 : digits;
    if (!isFinite(v)) return "—";
    if (v === 0) return "0";
    var e = Math.floor(Math.log10(Math.abs(v)));
    if (e >= -2 && e < 4) return v.toFixed(Math.max(0, digits - Math.max(e, 0)));
    var m = v / Math.pow(10, e);
    return m.toFixed(digits) + "×10" + String(e).split("").map(function (c) { return SUP[c]; }).join("");
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // ── 折線圖（canvas）──────────────────────────────
  var PALETTE = ["#3f51b5", "#e65100", "#2e7d32", "#ad1457", "#00838f"];

  function niceStep(raw) {
    var p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  }
  function linTicks(a, b) {
    var s = niceStep((b - a) / 5), out = [];
    for (var v = Math.ceil(a / s) * s; v <= b + s * 1e-9; v += s) out.push(+v.toPrecision(10));
    return out;
  }
  function logTicks(a, b) {
    var out = [];
    for (var e = Math.ceil(Math.log10(a)); e <= Math.floor(Math.log10(b)); e++) out.push(Math.pow(10, e));
    if (out.length > 8) out = out.filter(function (_, i) { return i % 2 === 0; });
    return out;
  }

  // opt: {x:[min,max], y:[min,max], logX, logY, xlabel, ylabel, hideX, series:[{pts, color, dash, width}], vline, marks:[{x,y,color}], hlines:[{y,color,label,dash}]}
  function plot(canvas, opt) {
    var dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    var g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var cs = getComputedStyle(canvas);
    var fg = cs.getPropertyValue("--md-default-fg-color").trim() || "#333";
    var light = cs.getPropertyValue("--md-default-fg-color--light").trim() || "#777";
    var grid = cs.getPropertyValue("--md-default-fg-color--lightest").trim() || "#ddd";
    var L = 70, R = 14, T = 12, B = opt.hideX ? 12 : 42, pw = W - L - R, ph = H - T - B;
    var fx = opt.logX ? Math.log10 : function (v) { return v; };
    var fy = opt.logY ? Math.log10 : function (v) { return v; };
    var x0 = fx(opt.x[0]), x1 = fx(opt.x[1]), y0 = fy(opt.y[0]), y1 = fy(opt.y[1]);
    function sx(x) { return L + (fx(x) - x0) / (x1 - x0) * pw; }
    function sy(y) { return T + (1 - (fy(y) - y0) / (y1 - y0)) * ph; }

    g.clearRect(0, 0, W, H);
    g.font = "11px sans-serif"; g.lineWidth = 1;
    var yt = opt.logY ? logTicks(opt.y[0], opt.y[1]) : linTicks(opt.y[0], opt.y[1]);
    yt.forEach(function (v) {
      g.strokeStyle = grid; g.beginPath(); g.moveTo(L, sy(v)); g.lineTo(L + pw, sy(v)); g.stroke();
      g.fillStyle = light; g.textAlign = "right"; g.textBaseline = "middle";
      g.fillText(opt.logY ? sci(v, 0) : (opt.yfmt ? opt.yfmt(v) : String(v)), L - 6, sy(v));
    });
    if (!opt.hideX) {
      var xt = opt.logX ? logTicks(opt.x[0], opt.x[1]) : linTicks(opt.x[0], opt.x[1]);
      xt.forEach(function (v) {
        g.strokeStyle = grid; g.beginPath(); g.moveTo(sx(v), T); g.lineTo(sx(v), T + ph); g.stroke();
        g.fillStyle = light; g.textAlign = "center"; g.textBaseline = "top";
        g.fillText(opt.logX ? sci(v, 0) : String(v), sx(v), T + ph + 6);
      });
      g.fillStyle = fg; g.fillText(opt.xlabel || "", L + pw / 2, T + ph + 24);
    }
    g.save(); g.translate(14, T + ph / 2); g.rotate(-Math.PI / 2);
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = fg; g.fillText(opt.ylabel || "", 0, 0); g.restore();

    g.save(); g.beginPath(); g.rect(L, T, pw, ph); g.clip();
    (opt.hlines || []).forEach(function (h) {
      g.strokeStyle = h.color || fg; g.lineWidth = 2; g.setLineDash(h.dash || []);
      g.beginPath(); g.moveTo(L, sy(h.y)); g.lineTo(L + pw, sy(h.y)); g.stroke();
      g.setLineDash([]); g.fillStyle = h.color || fg; g.textAlign = "left"; g.textBaseline = "bottom";
      if (h.label) g.fillText(h.label, L + 6, sy(h.y) - 3);
    });
    (opt.series || []).forEach(function (s, i) {
      g.strokeStyle = s.color || PALETTE[i % PALETTE.length]; g.lineWidth = s.width || 2; g.setLineDash(s.dash || []);
      g.beginPath();
      var started = false;
      s.pts.forEach(function (p) {
        if (!isFinite(p[1]) || (opt.logY && p[1] <= 0)) { started = false; return; }
        if (!started) { g.moveTo(sx(p[0]), sy(p[1])); started = true; } else g.lineTo(sx(p[0]), sy(p[1]));
      });
      g.stroke(); g.setLineDash([]);
    });
    if (opt.vline !== undefined) {
      g.strokeStyle = light; g.setLineDash([4, 4]); g.beginPath();
      g.moveTo(sx(opt.vline), T); g.lineTo(sx(opt.vline), T + ph); g.stroke(); g.setLineDash([]);
    }
    (opt.marks || []).forEach(function (m) {
      if (!isFinite(m.y) || (opt.logY && m.y <= 0)) return;
      g.fillStyle = m.color || fg; g.beginPath(); g.arc(sx(m.x), sy(m.y), 4.5, 0, 2 * Math.PI); g.fill();
    });
    g.restore();
    g.strokeStyle = light; g.strokeRect(L, T, pw, ph);
  }

  function range(a, b, n, log) {
    var out = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      out.push(log ? Math.pow(10, Math.log10(a) + t * (Math.log10(b) - Math.log10(a))) : a + t * (b - a));
    }
    return out;
  }

  function legend(items) {
    var box = el("div", { class: "ix-legend" });
    items.forEach(function (it) {
      box.appendChild(el("span", {}, el("i", { style: "background:" + it.color }), document.createTextNode(it.label)));
    });
    return box;
  }

  // 建立滑桿：回傳 {node, get()}
  function slider(label, min, max, step, value, fmt, onInput) {
    var out = el("span", { class: "val" });
    var input = el("input", { type: "range", min: min, max: max, step: step, value: value });
    function show() { out.textContent = fmt(+input.value); }
    input.addEventListener("input", function () { show(); onInput(); });
    show();
    return { node: el("label", {}, el("span", {}, document.createTextNode(label + "："), out), input), get: function () { return +input.value; } };
  }
  function select(label, options, onChange) {
    var s = el("select", {});
    options.forEach(function (o) { s.appendChild(el("option", { value: o[0], text: o[1] })); });
    s.addEventListener("change", onChange);
    return { node: el("label", {}, el("span", { text: label }), s), get: function () { return s.value; }, el: s };
  }
  function outputs(items) {
    var box = el("div", { class: "ix-out" });
    items.forEach(function (it) { box.appendChild(el("div", {}, el("span", { class: "ix-muted", text: it[0] }), el("b", { text: it[1] }))); });
    return box;
  }
  function redrawOnResize(fn) {
    var timer;
    window.addEventListener("resize", function () { clearTimeout(timer); timer = setTimeout(fn, 150); });
  }

  // ── 半導體物理常數與模型 ─────────────────────────
  var K_B = 8.617333e-5; // eV/K
  var Q = 1.602e-19;
  // Varshni 能隙參數與 300 K 有效能態密度（Sze、Green 等教科書常用值）
  var MATERIALS = {
    Si: { name: "矽 Si", Eg0: 1.170, a: 4.73e-4, b: 636, Nc: 3.2e19, Nv: 1.8e19, color: PALETTE[0] },
    Ge: { name: "鍺 Ge", Eg0: 0.7437, a: 4.774e-4, b: 235, Nc: 1.04e19, Nv: 6.0e18, color: PALETTE[1] },
    GaAs: { name: "砷化鎵 GaAs", Eg0: 1.519, a: 5.405e-4, b: 204, Nc: 4.7e17, Nv: 9.0e18, color: PALETTE[2] }
  };
  function bandgap(m, T) { return m.Eg0 - m.a * T * T / (T + m.b); }
  function ni(m, T) {
    var s = Math.pow(T / 300, 1.5);
    return Math.sqrt(m.Nc * s * m.Nv * s) * Math.exp(-bandgap(m, T) / (2 * K_B * T));
  }
  // 矽在 300 K 的 Caughey–Thomas 遷移率模型
  function mobility(N, type) {
    return type === "n"
      ? 52.2 + (1417 - 52.2) / (1 + Math.pow(N / 9.68e16, 0.68))
      : 44.9 + (470.5 - 44.9) / (1 + Math.pow(N / 2.23e17, 0.719));
  }

  // ── 互動實驗 ───────────────────────────────────
  var LABS = {};

  LABS.intrinsic = function (root) {
    var canvas = el("canvas");
    var outBox = el("div");
    var T = slider("溫度 T", 200, 700, 5, 300, function (v) { return v + " K（" + (v - 273).toFixed(0) + " °C）"; }, draw);
    root.appendChild(el("div", { class: "ix-row" }, T.node));
    root.appendChild(outBox);
    root.appendChild(canvas);
    root.appendChild(legend(Object.keys(MATERIALS).map(function (k) { return { color: MATERIALS[k].color, label: MATERIALS[k].name }; })));
    root.appendChild(el("p", { class: "ix-muted", text: "模型：nᵢ = √(Nc·Nv)·exp(−Eg/2kT)，Nc、Nv ∝ T^1.5，Eg(T) 用 Varshni 公式。300 K 時矽約 8.6×10⁹ cm⁻³（文獻常引用 1.0×10¹⁰，差異來自有效質量的溫度修正）。" }));
    function draw() {
      var t = T.get(), Ts = range(200, 700, 120);
      outBox.replaceChildren(outputs(Object.keys(MATERIALS).map(function (k) {
        var m = MATERIALS[k];
        return [m.name + "　Eg = " + bandgap(m, t).toFixed(3) + " eV", "nᵢ = " + sci(ni(m, t)) + " cm⁻³"];
      })));
      plot(canvas, {
        x: [200, 700], y: [1e0, 1e18], logY: true, xlabel: "溫度 T (K)", ylabel: "nᵢ (cm⁻³)", vline: t,
        series: Object.keys(MATERIALS).map(function (k) {
          var m = MATERIALS[k];
          return { color: m.color, pts: Ts.map(function (x) { return [x, ni(m, x)]; }) };
        }),
        marks: Object.keys(MATERIALS).map(function (k) { return { x: t, y: ni(MATERIALS[k], t), color: MATERIALS[k].color }; })
      });
    }
    draw(); redrawOnResize(draw);
  };

  LABS.doping = function (root) {
    var band = el("canvas"), rho = el("canvas"), outBox = el("div"), warn = el("p", { class: "ix-muted" });
    var type = select("摻雜類型", [["n", "N 型（施體，如磷 P）"], ["p", "P 型（受體，如硼 B）"]], draw);
    var logN = slider("摻雜濃度 N", 13, 20, 0.05, 16, function (v) { return sci(Math.pow(10, v), 1) + " cm⁻³"; }, draw);
    var T = slider("溫度 T", 250, 500, 5, 300, function (v) { return v + " K"; }, draw);
    root.appendChild(el("div", { class: "ix-row" }, type.node, logN.node, T.node));
    root.appendChild(outBox);
    root.appendChild(el("div", { class: "ix-muted", text: "能帶圖（以本質能階 Eᵢ 為 0）" }));
    root.appendChild(band);
    root.appendChild(el("div", { class: "ix-muted", text: "300 K 電阻率與摻雜濃度" }));
    root.appendChild(rho);
    root.appendChild(legend([{ color: PALETTE[0], label: "N 型" }, { color: PALETTE[1], label: "P 型" }]));
    root.appendChild(warn);
    root.appendChild(el("p", { class: "ix-muted", text: "假設完全游離、非簡併（波茲曼近似）；遷移率用矽 300 K 的 Caughey–Thomas 經驗模型，電阻率曲線固定在 300 K。" }));

    function resistivity(N, tp) {
      var n_i = ni(MATERIALS.Si, 300);
      var maj = N / 2 + Math.sqrt(N * N / 4 + n_i * n_i), mino = n_i * n_i / maj;
      var n = tp === "n" ? maj : mino, p = tp === "n" ? mino : maj;
      return 1 / (Q * (n * mobility(N, "n") + p * mobility(N, "p")));
    }
    function draw() {
      var tp = type.get(), N = Math.pow(10, logN.get()), t = T.get(), Si = MATERIALS.Si;
      var n_i = ni(Si, t), Eg = bandgap(Si, t), kT = K_B * t;
      var maj = N / 2 + Math.sqrt(N * N / 4 + n_i * n_i), mino = n_i * n_i / maj;
      var EF = (tp === "n" ? 1 : -1) * kT * Math.log(maj / n_i);
      var n = tp === "n" ? maj : mino, p = tp === "n" ? mino : maj;
      var r = 1 / (Q * (n * mobility(N, "n") + p * mobility(N, "p")));
      outBox.replaceChildren(outputs([
        ["電子濃度 n", sci(n) + " cm⁻³"], ["電洞濃度 p", sci(p) + " cm⁻³"],
        ["E_F − Eᵢ", (EF >= 0 ? "+" : "") + EF.toFixed(3) + " eV"],
        ["遷移率 μn / μp（300 K）", mobility(N, "n").toFixed(0) + " / " + mobility(N, "p").toFixed(0) + " cm²/V·s"],
        ["電阻率 ρ", sci(r) + " Ω·cm"]
      ]));
      warn.textContent = N > 1e18 ? "注意：濃度超過約 10¹⁸ cm⁻³ 時費米能階接近能帶邊緣，半導體趨近簡併，上述近似誤差會變大。" : "";
      plot(band, {
        x: [0, 1], y: [-0.7, 0.7], hideX: true, ylabel: "能量 (eV)", yfmt: function (v) { return v.toFixed(1); },
        hlines: [
          { y: Eg / 2, label: "Ec 導電帶底", color: PALETTE[0] },
          { y: -Eg / 2, label: "Ev 價電帶頂", color: PALETTE[1] },
          { y: 0, label: "Eᵢ", dash: [4, 4] },
          { y: EF, label: "E_F 費米能階", color: PALETTE[3] }
        ]
      });
      var Ns = range(1e13, 1e20, 120, true);
      plot(rho, {
        x: [1e13, 1e20], y: [1e-4, 1e3], logX: true, logY: true, xlabel: "摻雜濃度 N (cm⁻³)", ylabel: "ρ (Ω·cm)",
        series: ["n", "p"].map(function (k, i) { return { color: PALETTE[i], pts: Ns.map(function (x) { return [x, resistivity(x, k)]; }) }; }),
        marks: [{ x: N, y: resistivity(N, tp), color: tp === "n" ? PALETTE[0] : PALETTE[1] }], vline: N
      });
    }
    draw(); redrawOnResize(draw);
  };

  LABS.rayleigh = function (root) {
    var SYSTEMS = [
      { key: "krf", name: "KrF 248 nm（NA 0.93）", lambda: 248, NA: 0.93 },
      { key: "arf", name: "ArF 乾式 193 nm（NA 0.93）", lambda: 193, NA: 0.93 },
      { key: "arfi", name: "ArF 浸潤式 193 nm（NA 1.35）", lambda: 193, NA: 1.35 },
      { key: "euv", name: "EUV 13.5 nm（NA 0.33）", lambda: 13.5, NA: 0.33 },
      { key: "hna", name: "High-NA EUV 13.5 nm（NA 0.55）", lambda: 13.5, NA: 0.55 }
    ];
    var canvas = el("canvas"), outBox = el("div");
    var sys = select("曝光系統", SYSTEMS.map(function (s) { return [s.key, s.name]; }), draw);
    sys.el.value = "euv";
    var k1 = slider("製程因子 k₁", 0.25, 0.8, 0.01, 0.4, function (v) { return v.toFixed(2); }, draw);
    root.appendChild(el("div", { class: "ix-row" }, sys.node, k1.node));
    root.appendChild(outBox);
    root.appendChild(canvas);
    root.appendChild(legend(SYSTEMS.map(function (s, i) { return { color: PALETTE[i], label: s.name }; })));
    root.appendChild(el("p", { class: "ix-muted", text: "解析度（半間距）R = k₁·λ/NA；焦深 DOF ≈ k₂·λ/NA²，此處取 k₂ = 1 作示意。單次曝光的理論下限為 k₁ = 0.25，量產通常在 0.3～0.4 以上。" }));
    function draw() {
      var s = SYSTEMS.filter(function (x) { return x.key === sys.get(); })[0], k = k1.get();
      var R = k * s.lambda / s.NA, DOF = s.lambda / (s.NA * s.NA);
      outBox.replaceChildren(outputs([
        ["半間距解析度 R", R.toFixed(1) + " nm"], ["最小間距（2R）", (2 * R).toFixed(1) + " nm"],
        ["焦深 DOF（k₂=1 示意）", DOF.toFixed(0) + " nm"], ["λ / NA", (s.lambda / s.NA).toFixed(1) + " nm"]
      ]));
      var ks = range(0.25, 0.8, 50);
      plot(canvas, {
        x: [0.25, 0.8], y: [1, 300], logY: true, xlabel: "k₁", ylabel: "半間距 R (nm)", vline: k,
        series: SYSTEMS.map(function (x, i) {
          return { color: PALETTE[i], width: x.key === s.key ? 3.5 : 1.5, pts: ks.map(function (kk) { return [kk, kk * x.lambda / x.NA]; }) };
        }),
        marks: [{ x: k, y: R, color: PALETTE[SYSTEMS.indexOf(s)] }]
      });
    }
    draw(); redrawOnResize(draw);
  };

  LABS.yield = function (root) {
    var chart = el("canvas"), wafer = el("canvas", { style: "height:320px" }), outBox = el("div");
    var D0 = slider("缺陷密度 D₀", 0.01, 1, 0.01, 0.1, function (v) { return v.toFixed(2) + " 個/cm²"; }, draw);
    var area = slider("晶粒面積 A", 10, 800, 5, 100, function (v) { return v + " mm²"; }, draw);
    var alpha = slider("群聚參數 α（負二項）", 0.5, 10, 0.5, 2, function (v) { return v.toFixed(1); }, draw);
    var again = el("button", { class: "ix-btn", text: "重新撒缺陷", onclick: function () { drawWafer(); } });
    root.appendChild(el("div", { class: "ix-row" }, D0.node, area.node, alpha.node));
    root.appendChild(outBox);
    root.appendChild(chart);
    root.appendChild(legend([{ color: PALETTE[0], label: "Poisson" }, { color: PALETTE[1], label: "Murphy" }, { color: PALETTE[2], label: "負二項 (Seeds/Stapper)" }]));
    root.appendChild(el("div", { class: "ix-row" }, el("span", { class: "ix-muted", text: "300 mm 晶圓模擬：缺陷隨機分布，紅色為含缺陷晶粒（邊緣排除 3 mm）" }), again));
    root.appendChild(wafer);
    root.appendChild(el("p", { class: "ix-muted", text: "Poisson：Y = e^(−AD)；Murphy：Y = ((1 − e^(−AD))/AD)²；負二項：Y = (1 + AD/α)^(−α)。每片晶粒數 DPW ≈ π(d/2)²/S − πd/√(2S)。" }));

    function models(Acm, D, a) {
      var AD = Acm * D;
      return { poisson: Math.exp(-AD), murphy: AD === 0 ? 1 : Math.pow((1 - Math.exp(-AD)) / AD, 2), nb: Math.pow(1 + AD / a, -a) };
    }
    function draw() {
      var D = D0.get(), A = area.get(), a = alpha.get(), m = models(A / 100, D, a);
      var dpw = Math.floor(Math.PI * 150 * 150 / A - Math.PI * 300 / Math.sqrt(2 * A));
      outBox.replaceChildren(outputs([
        ["每片晶粒數 DPW", String(dpw)], ["Poisson 良率", (m.poisson * 100).toFixed(1) + "%"],
        ["Murphy 良率", (m.murphy * 100).toFixed(1) + "%"], ["負二項良率", (m.nb * 100).toFixed(1) + "%"],
        ["良品晶粒（負二項）", String(Math.round(dpw * m.nb))]
      ]));
      var As = range(10, 800, 100);
      plot(chart, {
        x: [10, 800], y: [0, 1], xlabel: "晶粒面積 (mm²)", ylabel: "良率", vline: A,
        yfmt: function (v) { return (v * 100).toFixed(0) + "%"; },
        series: ["poisson", "murphy", "nb"].map(function (k, i) {
          return { color: PALETTE[i], pts: As.map(function (x) { return [x, models(x / 100, D, a)[k]]; }) };
        }),
        marks: [{ x: A, y: m.poisson, color: PALETTE[0] }, { x: A, y: m.murphy, color: PALETTE[1] }, { x: A, y: m.nb, color: PALETTE[2] }]
      });
      drawWafer();
    }
    function poissonSample(lambda) {
      // 大 λ 用常態近似
      if (lambda > 50) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * gauss()));
      var L = Math.exp(-lambda), k = 0, p = 1;
      do { k++; p *= Math.random(); } while (p > L);
      return k - 1;
    }
    function gauss() { return Math.sqrt(-2 * Math.log(Math.random() || 1e-12)) * Math.cos(2 * Math.PI * Math.random()); }
    function drawWafer() {
      var dpr = window.devicePixelRatio || 1, W = wafer.clientWidth, H = wafer.clientHeight;
      wafer.width = W * dpr; wafer.height = H * dpr;
      var g = wafer.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      var cs = getComputedStyle(wafer), fg = cs.getPropertyValue("--md-default-fg-color--light").trim() || "#777";
      var r = Math.min(W, H) / 2 - 6, cx = W / 2, cy = H / 2, scale = r / 150; // px per mm
      var side = Math.sqrt(area.get()), usable = 147, D = D0.get();
      g.strokeStyle = fg; g.beginPath(); g.arc(cx, cy, r, 0, 2 * Math.PI); g.stroke();
      var dies = [], n = Math.ceil(usable / side);
      for (var i = -n; i < n; i++) for (var j = -n; j < n; j++) {
        var x0 = i * side, y0 = j * side, ok = true;
        [[x0, y0], [x0 + side, y0], [x0, y0 + side], [x0 + side, y0 + side]].forEach(function (c) { if (c[0] * c[0] + c[1] * c[1] > usable * usable) ok = false; });
        if (ok) dies.push({ x: x0, y: y0, bad: false });
      }
      var count = poissonSample(D * Math.PI * 15 * 15), defects = [];
      for (var k = 0; k < count; k++) {
        var rr = 150 * Math.sqrt(Math.random()), th = 2 * Math.PI * Math.random();
        defects.push([rr * Math.cos(th), rr * Math.sin(th)]);
      }
      defects.forEach(function (d) {
        dies.forEach(function (die) { if (d[0] >= die.x && d[0] < die.x + side && d[1] >= die.y && d[1] < die.y + side) die.bad = true; });
      });
      var good = 0;
      dies.forEach(function (die) {
        if (!die.bad) good++;
        g.fillStyle = die.bad ? "rgba(198,40,40,.75)" : "rgba(46,125,50,.45)";
        g.fillRect(cx + die.x * scale + 0.5, cy + die.y * scale + 0.5, side * scale - 1, side * scale - 1);
      });
      g.fillStyle = fg;
      defects.forEach(function (d) { g.fillRect(cx + d[0] * scale - 1, cy + d[1] * scale - 1, 2, 2); });
      g.font = "12px sans-serif"; g.textAlign = "left"; g.textBaseline = "top";
      g.fillText("完整晶粒 " + dies.length + "，良品 " + good + "，模擬良率 " + (dies.length ? (good / dies.length * 100).toFixed(1) : "0") + "%", 6, 6);
      g.fillText("缺陷數 " + count, 6, 22);
    }
    draw(); redrawOnResize(draw);
  };

  LABS.dealgrove = function (root) {
    // Deal & Grove (1965) 的 (111) 矽參數；(100) 晶面 B/A 除以 1.68
    var PARAMS = {
      dry: { C1: 772, E1: 1.23, C2: 6.23e6, E2: 2.0, xi: 0.025 },
      wet: { C1: 386, E1: 0.78, C2: 1.63e8, E2: 2.05, xi: 0 }
    };
    var canvas = el("canvas"), outBox = el("div");
    var amb = select("氧化方式", [["dry", "乾氧化（O₂）"], ["wet", "濕氧化（H₂O）"]], draw);
    var ori = select("晶面", [["100", "(100)"], ["111", "(111)"]], draw);
    var Tc = slider("溫度", 800, 1200, 10, 1000, function (v) { return v + " °C"; }, draw);
    var hours = slider("時間", 0.1, 10, 0.1, 1, function (v) { return v.toFixed(1) + " 小時"; }, draw);
    root.appendChild(el("div", { class: "ix-row" }, amb.node, ori.node));
    root.appendChild(el("div", { class: "ix-row" }, Tc.node, hours.node));
    root.appendChild(outBox);
    root.appendChild(canvas);
    root.appendChild(legend([{ color: PALETTE[0], label: "目前溫度" }, { color: PALETTE[1], label: "溫度 −100 °C" }, { color: PALETTE[2], label: "溫度 +100 °C" }]));
    root.appendChild(el("p", { class: "ix-muted", text: "Deal–Grove 模型：x² + A·x = B·(t + τ)。B 為拋物線速率常數，B/A 為線性速率常數，皆依 Arrhenius 關係隨溫度變化；乾氧化以 25 nm 初始厚度修正薄氧化區。" }));
    function coeffs(tc) {
      var p = PARAMS[amb.get()], T = tc + 273.15;
      var B = p.C1 * Math.exp(-p.E1 / (K_B * T));
      var BA = p.C2 * Math.exp(-p.E2 / (K_B * T)) / (ori.get() === "100" ? 1.68 : 1);
      var A = B / BA, tau = (p.xi * p.xi + A * p.xi) / B;
      return { B: B, BA: BA, A: A, tau: tau };
    }
    function thickness(c, t) { return (c.A / 2) * (Math.sqrt(1 + (t + c.tau) / (c.A * c.A / (4 * c.B))) - 1); }
    function draw() {
      var tc = Tc.get(), t = hours.get(), c = coeffs(tc), x = thickness(c, t);
      var regime = t + c.tau < 0.3 * c.A * c.A / (4 * c.B) ? "近似線性區（反應速率控制）" : t + c.tau > 3 * c.A * c.A / (4 * c.B) ? "近似拋物線區（擴散控制）" : "過渡區";
      outBox.replaceChildren(outputs([
        ["氧化層厚度", (x * 1000).toFixed(1) + " nm"], ["B（拋物線速率）", sci(c.B, 3) + " µm²/h"],
        ["B/A（線性速率）", sci(c.BA, 3) + " µm/h"], ["成長區域", regime]
      ]));
      var ts = range(0, 10, 100), temps = [tc, tc - 100, tc + 100];
      var maxX = Math.max.apply(null, temps.map(function (tt) { return thickness(coeffs(tt), 10) * 1000; }));
      plot(canvas, {
        x: [0, 10], y: [0, Math.max(50, maxX * 1.05)], xlabel: "時間 (小時)", ylabel: "厚度 (nm)", vline: t,
        series: temps.map(function (tt, i) {
          var cc = coeffs(tt);
          return { color: PALETTE[i], width: i === 0 ? 3 : 1.5, dash: i === 0 ? [] : [5, 4], pts: ts.map(function (s) { return [s, thickness(cc, s) * 1000]; }) };
        }),
        marks: [{ x: t, y: x * 1000, color: PALETTE[0] }]
      });
    }
    draw(); redrawOnResize(draw);
  };

  // ── 機台到 PE 的資料流 ──────────────────────────
  var DF_NODES = {
    sensor: { x: 30, y: 30, label: "感測器與子系統", sub: "RF、真空、溫度、載台、光學",
      desc: "機台內部的實體元件與感測器：射頻電源、真空計、熱電偶、質流控制器 (MFC)、載台編碼器、相機與偵測器。它們以毫秒等級的週期把讀值送給機台控制電腦，也接受控制電腦的命令。" },
    ipc: { x: 30, y: 200, label: "機台控制電腦（Tool IPC）", sub: "即時控制、配方執行、安全互鎖",
      desc: "機台的大腦，通常跑 Windows 或即時作業系統。負責執行配方 (recipe)、控制機械手臂與閥門、處理安全互鎖 (interlock)，並對外提供 SECS/GEM 與 Interface A 介面。它追求的是穩定與確定性，不適合做大量運算。" },
    module: { x: 30, y: 370, label: "Module / Compute Server", sub: "影像運算、光譜擬合、缺陷比對",
      desc: "量測與檢測機台外掛的運算伺服器或叢集（例如 CD-SEM 的影像伺服器、OCD 的光譜擬合伺服器、光學檢測機的影像比對叢集）。透過機台私有網路接收原始影像或光譜，算出線寬、膜厚、缺陷座標等結果再回傳 IPC。把運算從 IPC 拆出來，是為了避免大量運算拖慢即時控制。" },
    eap: { x: 330, y: 110, label: "EAP 設備自動化程式", sub: "SECS/GEM 對話、上下貨、配方下載",
      desc: "每台（或每類）機台對應的自動化程式，用 SECS/GEM 跟機台對話：確認 lot 與配方、下達開始/停止指令、接收事件報告與量測結果，並轉給 MES、SPC、APC 等系統。是機台世界與廠端 IT 系統之間的翻譯官。" },
    eda: { x: 330, y: 270, label: "Interface A（EDA）資料收集", sub: "高頻感測資料、Trace",
      desc: "SEMI EDA 標準（E120/E125/E132/E134）讓廠端系統訂閱機台內部的高頻感測資料，頻率可到每秒數十筆以上，而且不干擾 SECS/GEM 的控制通道。FDC 主要靠這條路拿到完整的製程波形。" },
    file: { x: 330, y: 420, label: "原始資料儲存", sub: "SEM 影像、光譜、缺陷影像",
      desc: "原始影像與光譜資料量很大，通常不經過 SECS/GEM，而是由運算伺服器或機台直接存到檔案伺服器或物件儲存，供日後追查與重新分析。" },
    mes: { x: 630, y: 20, label: "MES 製造執行系統", sub: "Lot 流程、派工、Hold/Release",
      desc: "管理每一批晶圓走到哪一站、該用哪個配方、能不能進下一站。收到 SPC 或 FDC 的異常判定時，會把 lot 設為 Hold，等工程師處置。" },
    spc: { x: 630, y: 120, label: "SPC 統計製程管制", sub: "管制圖、OOC/OOS 判定",
      desc: "把量測值畫成管制圖，依管制界限與 Western Electric 規則判定是否異常（OOC：超出管制界限；OOS：超出規格）。異常時發出警報並通知 MES 擋貨。" },
    apc: { x: 630, y: 220, label: "APC / R2R 先進製程控制", sub: "批次間自動修正",
      desc: "依前一批的量測結果，用 EWMA 等演算法算出下一批的修正量（例如曝光劑量、研磨時間、蝕刻時間），在進站時經由 EAP 下給機台。" },
    fdc: { x: 630, y: 320, label: "FDC 故障偵測與分類", sub: "Trace 統計特徵、即時攔截",
      desc: "把每片晶圓的感測波形切成步驟並算出統計特徵（平均、斜率、最大值等），和模型比對。偏離時可以在晶圓還在機台上時就要求 EAP 暫停機台（interdiction），避免整批報廢。" },
    yms: { x: 630, y: 420, label: "YMS／資料平台", sub: "良率、晶圓圖、跨站關聯",
      desc: "整合量測、檢測、FDC、測試、MES 歷程等資料，讓工程師做共通性分析：例如找出低良率晶圓共同經過的機台或腔體。" },
    pe: { x: 930, y: 220, label: "PE 製程工程師", sub: "儀表板、警報、處置",
      desc: "製程工程師 (Process Engineer) 透過儀表板看 SPC 管制圖、FDC 波形、晶圓圖與機台歷程，收到警報後判斷原因、決定 lot 放行或重工、要求設備工程師保養，必要時調整配方或 APC 參數。" }
  };
  var DF_EDGES = [
    { from: "sensor", to: "ipc", label: "現場匯流排 / I/O", desc: "類比與數位 I/O、EtherCAT、DeviceNet 等現場匯流排，毫秒級即時控制。" },
    { from: "ipc", to: "module", label: "機台私有網路", desc: "IPC 與運算伺服器之間的專用網路（常見 10GbE 以上或光纖），只在機台內部使用、與廠區網路隔離；傳送原始影像、光譜與運算結果。" },
    { from: "module", to: "file", label: "原始資料", desc: "原始影像、光譜另存檔案伺服器，供追查與離線重新分析。" },
    { from: "ipc", to: "eap", label: "SECS/GEM（HSMS）", desc: "以 HSMS（TCP/IP）傳送 SECS-II 訊息：S6F11 事件報告與量測結果、S5F1 警報、S2F41 遠端指令、S7 配方管理。資料量小、可靠，用於控制與結果上報。" },
    { from: "ipc", to: "eda", label: "Interface A", desc: "以 SEMI EDA 標準（Web Service）訂閱高頻感測資料，供 FDC 與資料分析使用。" },
    { from: "eap", to: "mes", label: "進出站、結果", desc: "EAP 回報 lot 進站、出站、處理結果；MES 告訴 EAP 該用哪個配方、能不能開始。" },
    { from: "eap", to: "spc", label: "量測值", desc: "量測站的結果（線寬、膜厚、疊對）由 EAP 轉送給 SPC 系統畫管制圖。" },
    { from: "apc", to: "eap", label: "修正參數", desc: "進站時 EAP 向 APC 取得這一批的修正量，再寫進配方參數下給機台。" },
    { from: "spc", to: "apc", label: "回授資料", desc: "量測結果同時提供給 APC 計算下一批的修正量。" },
    { from: "eda", to: "fdc", label: "Trace 波形", desc: "高頻感測波形送到 FDC 計算統計特徵並和模型比對。" },
    { from: "fdc", to: "eap", label: "攔截指令", desc: "FDC 判定異常時通知 EAP，由 EAP 以 SECS/GEM 指令讓機台停在下一片之前（interdiction）。" },
    { from: "spc", to: "mes", label: "Hold lot", desc: "SPC 判定 OOC/OOS 時通知 MES，把該批晶圓擋下等待處置。" },
    { from: "fdc", to: "yms", label: "", desc: "FDC 特徵值進入資料平台，可與良率做關聯分析。" },
    { from: "file", to: "yms", label: "", desc: "原始資料可在追查時調閱。" },
    { from: "spc", to: "pe", label: "管制圖、警報", desc: "PE 在儀表板看到 OOC 警報與管制圖趨勢。" },
    { from: "fdc", to: "pe", label: "異常波形", desc: "PE 調閱異常晶圓的 FDC 波形，和正常晶圓疊圖比較。" },
    { from: "yms", to: "pe", label: "晶圓圖、關聯分析", desc: "PE 用晶圓圖與共通性分析找出異常的機台或腔體。" },
    { from: "pe", to: "apc", label: "調整與核准", desc: "PE 確認原因後調整 APC 參數、配方或要求機台保養，並決定 lot 放行或重工。" }
  ];
  var DF_SCENARIOS = {
    cdsem: { name: "情境一：CD-SEM 量測發現線寬超出管制界限", steps: [
      { nodes: ["mes", "eap"], edges: ["eap-mes"], text: "1. 晶圓批 (lot) 完成蝕刻後被派到 CD-SEM。MES 告訴 EAP 這批要用的量測配方。" },
      { nodes: ["eap", "ipc"], edges: ["ipc-eap"], text: "2. EAP 以 SECS/GEM 下 S2F41 遠端指令：選擇配方並開始量測。" },
      { nodes: ["sensor", "ipc"], edges: ["sensor-ipc"], text: "3. IPC 控制載台移到每個量測點，電子光學柱掃描後擷取 SEM 影像。" },
      { nodes: ["ipc", "module"], edges: ["ipc-module"], text: "4. 影像經機台私有網路送到 Module／影像運算伺服器，以邊緣偵測演算法算出每點線寬，結果回傳 IPC。" },
      { nodes: ["module", "file"], edges: ["module-file"], text: "5. 原始 SEM 影像另存到檔案伺服器，日後可以調閱重算。" },
      { nodes: ["ipc", "eap", "spc"], edges: ["ipc-eap", "eap-spc"], text: "6. IPC 用 S6F11 事件報告上報量測結果，EAP 把數值送給 SPC。" },
      { nodes: ["spc", "mes"], edges: ["spc-mes"], text: "7. SPC 發現平均線寬超出管制界限 (OOC)，觸發警報，MES 把這批晶圓 Hold 住。" },
      { nodes: ["spc", "pe", "yms"], edges: ["spc-pe", "yms-pe"], text: "8. PE 收到警報，打開管制圖與晶圓圖，並追查這批在微影、蝕刻站經過的機台與腔體。" },
      { nodes: ["pe", "apc", "eap"], edges: ["pe-apc", "apc-eap"], text: "9. 判定是曝光劑量偏移：PE 調整 APC 修正量，後續批次進站時由 EAP 帶入新參數；這批依規範決定重工或放行。" }
    ] },
    fdc: { name: "情境二：FDC 即時攔截蝕刻機異常", steps: [
      { nodes: ["sensor", "ipc"], edges: ["sensor-ipc"], text: "1. 蝕刻機處理晶圓時，射頻反射功率因為匹配器異常而升高。" },
      { nodes: ["ipc", "eda"], edges: ["ipc-eda"], text: "2. 感測資料透過 Interface A 以高頻送出，不影響 SECS/GEM 控制通道。" },
      { nodes: ["eda", "fdc"], edges: ["eda-fdc"], text: "3. FDC 計算這片晶圓在主蝕刻步驟的反射功率最大值，超出模型界限。" },
      { nodes: ["fdc", "eap", "ipc"], edges: ["fdc-eap", "ipc-eap"], text: "4. FDC 通知 EAP，EAP 以 SECS/GEM 指令讓機台在下一片開始前暫停（interdiction），只損失一片而不是整批。" },
      { nodes: ["fdc", "pe"], edges: ["fdc-pe"], text: "5. PE 與設備工程師調閱異常波形，與正常晶圓疊圖比對，確認是匹配器問題。" },
      { nodes: ["fdc", "yms", "pe"], edges: ["fdc-yms", "yms-pe"], text: "6. 機台保養後恢復生產；FDC 特徵值存入資料平台，日後可和這批晶圓的測試良率做關聯分析。" }
    ] }
  };

  LABS.dataflow = function (root) {
    var NS = "http://www.w3.org/2000/svg", W = 210, H = 62;
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 1160 500");
    svg.setAttribute("class", "ix-df");
    svg.innerHTML = '<defs><marker id="ixArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="ix-df-head"/></marker>' +
      '<marker id="ixArrowOn" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="ix-df-head on"/></marker></defs>';
    var detail = el("div", { class: "ix-quiz-explain", text: "點選任一方塊或連線，查看它負責的工作與使用的協定；或用下方情境逐步播放資料怎麼流動。" });
    function center(n) { return [n.x + W / 2, n.y + H / 2]; }
    function clip(n, dx, dy) {
      var t = Math.min((W / 2 + 4) / Math.abs(dx || 1e-9), (H / 2 + 4) / Math.abs(dy || 1e-9));
      var c = center(n);
      return [c[0] + dx * t, c[1] + dy * t];
    }
    var edgeEls = {}, nodeEls = {};
    DF_EDGES.forEach(function (e) {
      var a = DF_NODES[e.from], b = DF_NODES[e.to], ca = center(a), cb = center(b);
      var dx = cb[0] - ca[0], dy = cb[1] - ca[1], len = Math.hypot(dx, dy);
      dx /= len; dy /= len;
      var p = clip(a, dx, dy), q = clip(b, -dx, -dy);
      var g = document.createElementNS(NS, "g");
      g.setAttribute("class", "ix-df-edge");
      g.innerHTML = '<line x1="' + p[0] + '" y1="' + p[1] + '" x2="' + q[0] + '" y2="' + q[1] + '" marker-end="url(#ixArrow)"/>' +
        '<line class="hit" x1="' + p[0] + '" y1="' + p[1] + '" x2="' + q[0] + '" y2="' + q[1] + '"/>';
      if (e.label) {
        var t = document.createElementNS(NS, "text");
        t.setAttribute("x", (p[0] + q[0]) / 2); t.setAttribute("y", (p[1] + q[1]) / 2 - 5);
        t.setAttribute("text-anchor", "middle"); t.textContent = e.label;
        g.appendChild(t);
      }
      g.addEventListener("click", function () { showDetail(DF_NODES[e.from].label + " → " + DF_NODES[e.to].label, e.desc); });
      svg.appendChild(g);
      edgeEls[e.from + "-" + e.to] = g;
    });
    Object.keys(DF_NODES).forEach(function (k) {
      var n = DF_NODES[k], g = document.createElementNS(NS, "g");
      g.setAttribute("class", "ix-df-node");
      g.innerHTML = '<rect x="' + n.x + '" y="' + n.y + '" width="' + W + '" height="' + H + '" rx="8"/>' +
        '<text x="' + (n.x + W / 2) + '" y="' + (n.y + 25) + '" text-anchor="middle" class="t"></text>' +
        '<text x="' + (n.x + W / 2) + '" y="' + (n.y + 45) + '" text-anchor="middle" class="s"></text>';
      g.querySelector(".t").textContent = n.label;
      g.querySelector(".s").textContent = n.sub;
      g.addEventListener("click", function () { showDetail(n.label, n.desc); });
      svg.appendChild(g);
      nodeEls[k] = g;
    });
    function showDetail(title, text) {
      detail.replaceChildren(el("strong", { text: title }), el("div", { text: text }));
    }
    function highlight(nodes, edges) {
      Object.keys(nodeEls).forEach(function (k) { nodeEls[k].classList.toggle("on", nodes.indexOf(k) >= 0); });
      Object.keys(edgeEls).forEach(function (k) {
        var on = edges.indexOf(k) >= 0;
        edgeEls[k].classList.toggle("on", on);
        edgeEls[k].querySelector("line").setAttribute("marker-end", on ? "url(#ixArrowOn)" : "url(#ixArrow)");
      });
    }
    var scen = select("情境", Object.keys(DF_SCENARIOS).map(function (k) { return [k, DF_SCENARIOS[k].name]; }), function () { step = 0; play(); });
    var step = 0, stepText = el("div", { class: "ix-quiz-explain" });
    var prev = el("button", { class: "ix-btn", text: "上一步", onclick: function () { if (step > 0) { step--; play(); } } });
    var next = el("button", { class: "ix-btn primary", text: "下一步", onclick: function () { var s = DF_SCENARIOS[scen.get()].steps; if (step < s.length - 1) { step++; play(); } } });
    var counter = el("span", { class: "ix-muted" });
    function play() {
      var steps = DF_SCENARIOS[scen.get()].steps, s = steps[step];
      highlight(s.nodes, s.edges);
      stepText.textContent = s.text;
      counter.textContent = (step + 1) + " / " + steps.length;
      prev.disabled = step === 0; next.disabled = step === steps.length - 1;
    }
    root.appendChild(el("div", { class: "ix-row" }, scen.node));
    root.appendChild(el("div", { class: "ix-row" }, prev, next, counter));
    root.appendChild(stepText);
    root.appendChild(el("div", { class: "ix-df-wrap" }, svg));
    root.appendChild(detail);
    play();
  };

  // ── 設備機台圖鑑 ───────────────────────────────
  function initAtlas(root) {
    root.classList.add("ix-card");
    Promise.all([
      fetch(dataUrl("equipment.json"), { cache: "no-cache" }).then(function (r) { return r.json(); }),
      fetch(dataUrl("chapters.json"), { cache: "no-cache" }).then(function (r) { return r.json(); }).catch(function () { return []; })
    ]).then(function (res) {
      var tools = res[0], chapters = {};
      res[1].forEach(function (c) { chapters[c.id] = c; });
      var areas = ["全部"].concat(tools.map(function (t) { return t.area; }).filter(function (a, i, arr) { return arr.indexOf(a) === i; }));
      var current = "全部", query = "";
      var chips = el("div", { class: "ix-row" }), list = el("div", { class: "ix-atlas" });
      var search = el("input", { type: "search", placeholder: "搜尋機台、功能或廠商", class: "ix-search" });
      search.addEventListener("input", function () { query = search.value.trim().toLowerCase(); render(); });
      function render() {
        chips.replaceChildren();
        areas.forEach(function (a) {
          var b = el("button", { class: "ix-btn" + (a === current ? " primary" : ""), text: a, onclick: function () { current = a; render(); } });
          chips.appendChild(b);
        });
        list.replaceChildren();
        tools.filter(function (t) {
          var hay = (t.name + t.en + t.function + t.purpose + t.vendors.join(" ")).toLowerCase();
          return (current === "全部" || t.area === current) && (!query || hay.indexOf(query) >= 0);
        }).forEach(function (t) {
          var links = t.chapters.map(function (id) {
            var c = chapters[id];
            if (!c) return null;
            return c.written ? el("a", { href: pageUrl(c.url), text: "第 " + c.n + " 章 " + c.title }) : el("span", { class: "ix-muted", text: "第 " + c.n + " 章 " + c.title + "（撰寫中）" });
          }).filter(Boolean);
          var linkBox = el("div", {});
          links.forEach(function (l, i) { if (i) linkBox.appendChild(document.createTextNode("、")); linkBox.appendChild(l); });
          var subs = el("ul", {});
          t.subsystems.forEach(function (s) { subs.appendChild(el("li", { text: s })); });
          list.appendChild(el("details", { class: "ix-tool" },
            el("summary", {},
              el("strong", { text: t.name }), el("span", { class: "ix-muted", text: "　" + t.en + "｜" + t.area }),
              el("div", { text: t.function })),
            el("p", {}, el("strong", { text: "為什麼需要它：" }), document.createTextNode(t.purpose)),
            el("p", {}, el("strong", { text: "關鍵子系統：" })), subs,
            el("p", {}, el("strong", { text: "資料與運算：" }), document.createTextNode(t.data)),
            el("p", {}, el("strong", { text: "代表廠商：" }), document.createTextNode(t.vendors.join("、"))),
            links.length ? el("div", {}, el("strong", { text: "相關章節：" }), linkBox) : null));
        });
        if (!list.children.length) list.appendChild(el("p", { class: "ix-muted", text: "沒有符合的機台。" }));
      }
      root.append(search, chips, list);
      render();
    }).catch(function () { root.textContent = "設備圖鑑載入失敗。"; });
  }

  // ── 設備機型圖鑑 ───────────────────────────────
  function initModels(root) {
    root.classList.add("ix-card");
    Promise.all([
      fetch(dataUrl("models.json"), { cache: "no-cache" }).then(function (r) { return r.json(); }),
      fetch(dataUrl("chapters.json"), { cache: "no-cache" }).then(function (r) { return r.json(); }).catch(function () { return []; })
    ]).then(function (res) {
      var models = res[0], chapters = {};
      res[1].forEach(function (c) { chapters[c.id] = c; });
      var vendors = ["全部"].concat(models.map(function (m) { return m.vendor; }).filter(function (v, i, a) { return a.indexOf(v) === i; }));
      var areas = ["全部製程"].concat(models.map(function (m) { return m.area; }).filter(function (v, i, a) { return a.indexOf(v) === i; }));
      var vendor = "全部", area = "全部製程", query = "";
      var chips = el("div", { class: "ix-row" }), areaSel = el("select", { class: "ix-select" }), list = el("div");
      areas.forEach(function (a) { areaSel.appendChild(el("option", { value: a, text: a })); });
      areaSel.addEventListener("change", function () { area = areaSel.value; render(); });
      var search = el("input", { type: "search", placeholder: "搜尋機型、廠商或技術，例如 EUV、Kiyo、CMP", class: "ix-search" });
      search.addEventListener("input", function () { query = search.value.trim().toLowerCase(); render(); });
      function render() {
        chips.replaceChildren();
        vendors.forEach(function (v) {
          chips.appendChild(el("button", { class: "ix-btn" + (v === vendor ? " primary" : ""), text: v, onclick: function () { vendor = v; render(); } }));
        });
        list.replaceChildren();
        var shown = models.filter(function (m) {
          var hay = (m.vendor + m.family + m.summary + m.lineup + m.tech.join(" ")).toLowerCase();
          return (vendor === "全部" || m.vendor === vendor) && (area === "全部製程" || m.area === area) && (!query || hay.indexOf(query) >= 0);
        });
        list.appendChild(el("p", { class: "ix-muted", text: "共 " + shown.length + " 個機型系列" }));
        shown.forEach(function (m) {
          var img = new URL("tools/" + m.tool + ".svg", siteBase()).href;
          var tech = el("ul", {});
          m.tech.forEach(function (t) { tech.appendChild(el("li", { text: t })); });
          var links = el("div", { class: "ix-muted" });
          m.chapters.forEach(function (id) {
            var c = chapters[id];
            if (!c) return;
            if (links.childNodes.length) links.appendChild(document.createTextNode("、"));
            links.appendChild(c.written ? el("a", { href: pageUrl(c.url), text: "第 " + c.n + " 章 " + c.title }) : el("span", { text: "第 " + c.n + " 章 " + c.title + "（撰寫中）" }));
          });
          list.appendChild(el("details", { class: "ix-tool ix-model" },
            el("summary", {},
              el("span", { class: "ix-tag", text: m.vendor }), document.createTextNode(" "),
              el("strong", { text: m.family }), el("span", { class: "ix-muted", text: "　" + m.area }),
              el("div", { text: m.summary })),
            el("div", { class: "ix-model-body" },
              el("a", { href: img, target: "_blank", rel: "noopener", class: "ix-model-img" }, el("img", { src: img, alt: m.family + " 示意圖", loading: "lazy" })),
              el("div", {},
                el("p", {}, el("strong", { text: "代表型號：" }), document.createTextNode(m.lineup)),
                el("p", {}, el("strong", { text: "核心技術：" })), tech,
                el("p", {}, el("strong", { text: "主電腦與附屬電腦：" }), document.createTextNode(m.computing)),
                links.childNodes.length ? el("div", {}, el("strong", { text: "相關章節：" }), links) : null))));
        });
        if (!shown.length) list.appendChild(el("p", { class: "ix-muted", text: "沒有符合的機型。" }));
      }
      root.append(search, chips, el("div", { class: "ix-row" }, el("span", { class: "ix-muted", text: "製程：" }), areaSel), list);
      render();
    }).catch(function () { root.textContent = "機型資料載入失敗。"; });
  }

  // ── 圖卡庫 ───────────────────────────────────
  function downloadPng(src, name) {
    fetch(src).then(function (r) { return r.text(); }).then(function (svgText) {
      var blobUrl = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
      var img = new Image();
      img.onload = function () {
        var scale = 2, canvas = document.createElement("canvas");
        canvas.width = (img.naturalWidth || 960) * scale; canvas.height = (img.naturalHeight || 600) * scale;
        var g = canvas.getContext("2d");
        g.fillStyle = "#ffffff"; g.fillRect(0, 0, canvas.width, canvas.height);
        g.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(blobUrl);
        canvas.toBlob(function (blob) {
          var a = el("a", { href: URL.createObjectURL(blob), download: name + ".png" });
          document.body.appendChild(a); a.click(); a.remove();
        }, "image/png");
      };
      img.src = blobUrl;
    });
  }
  function initCardLibrary(root) {
    fetch(dataUrl("cards.json"), { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (cards) {
      var kinds = ["全部", "核心概念", "章節重點"], current = "全部";
      var chips = el("div", { class: "ix-row" }), grid = el("div", { class: "ix-card-lib" });
      function render() {
        chips.replaceChildren();
        kinds.forEach(function (k) {
          var count = cards.filter(function (c) { return k === "全部" || c.kind === k; }).length;
          chips.appendChild(el("button", { class: "ix-btn" + (k === current ? " primary" : ""), text: k + "（" + count + "）", onclick: function () { current = k; render(); } }));
        });
        grid.replaceChildren();
        cards.filter(function (c) { return current === "全部" || c.kind === current; }).forEach(function (c) {
          var src = new URL(c.src, siteBase()).href;
          var links = el("div", { class: "ix-muted" });
          c.chapters.forEach(function (ch, i) {
            if (i) links.appendChild(document.createTextNode("、"));
            links.appendChild(ch.written ? el("a", { href: pageUrl(ch.url), text: "第 " + ch.n + " 章" }) : el("span", { text: "第 " + ch.n + " 章（撰寫中）" }));
          });
          grid.appendChild(el("div", { class: "ix-card-item" },
            el("a", { href: src, target: "_blank", rel: "noopener" }, el("img", { src: src, alt: c.title, loading: "lazy" })),
            el("div", { class: "ix-row" },
              el("span", { class: "ix-tag", text: c.kind }), el("strong", { text: c.title })),
            links,
            el("div", { class: "ix-row" },
              el("a", { class: "ix-btn", href: src, target: "_blank", rel: "noopener", text: "放大" }),
              el("button", { class: "ix-btn", text: "下載 PNG", onclick: function () { downloadPng(src, c.title); } }))));
        });
      }
      root.append(chips, grid);
      render();
    }).catch(function () { root.textContent = "圖卡載入失敗。"; });
  }

  // ── 章節測驗 ───────────────────────────────────
  function initQuiz(root) {
    var id = root.getAttribute("data-quiz");
    root.classList.add("ix-card");
    fetch(dataUrl("quizzes/" + id + ".json"), { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (qs) { renderQuiz(root, id, qs); })
      .catch(function () { root.textContent = "本章測驗準備中。"; });
  }
  function renderQuiz(root, id, qs) {
    root.replaceChildren();
    var best = store.get("quiz:" + id, null), answered = 0, correct = 0;
    var head = el("div", { class: "ix-row" },
      el("strong", { text: "本章測驗（" + qs.length + " 題）" }),
      el("span", { class: "ix-muted", text: best === null ? "尚未作答" : "最佳成績 " + best + " / " + qs.length }));
    var result = el("div", { class: "ix-row" });
    root.appendChild(head);
    qs.forEach(function (q, qi) {
      root.appendChild(el("div", { class: "ix-quiz-q", text: (qi + 1) + ". " + q.q }));
      var explain = el("div", { class: "ix-quiz-explain", style: "display:none" });
      var buttons = q.options.map(function (opt, oi) {
        return el("button", {
          class: "ix-quiz-opt", text: "ABCD"[oi] + ". " + opt, onclick: function () {
            buttons.forEach(function (b, bi) {
              b.disabled = true;
              if (bi === q.answer) b.classList.add("correct");
            });
            if (oi !== q.answer) this.classList.add("wrong"); else correct++;
            explain.textContent = (oi === q.answer ? "答對了。" : "正確答案是 " + "ABCD"[q.answer] + "。") + (q.explain || "");
            explain.style.display = "";
            answered++;
            if (answered === qs.length) finish();
          }
        });
      });
      buttons.forEach(function (b) { root.appendChild(b); });
      root.appendChild(explain);
    });
    root.appendChild(result);
    function finish() {
      var prev = store.get("quiz:" + id, null);
      if (prev === null || correct > prev) store.set("quiz:" + id, correct);
      store.set("quiztotal:" + id, qs.length);
      result.replaceChildren(
        el("span", { class: "ix-score", text: "得分 " + correct + " / " + qs.length }),
        el("button", { class: "ix-btn", text: "重新作答", onclick: function () { renderQuiz(root, id, shuffle(qs.slice())); } }));
    }
  }

  // ── 術語閃卡 ───────────────────────────────────
  function initFlashcards(root) {
    root.classList.add("ix-card");
    fetch(dataUrl("terms.json"), { cache: "no-cache" })
      .then(function (r) { return r.json(); })
      .then(function (terms) {
        if (!terms.length) { root.textContent = "目前尚無術語。"; return; }
        var known = store.get("known-terms", {}), onlyNew = true, deck = [], idx = 0, flipped = false;
        var card = el("div", { class: "ix-flash" });
        var stat = el("div", { class: "ix-muted" }), bar = el("div", { class: "ix-bar" }, el("span"));
        var toggle = el("label", { class: "ix-muted" }, el("input", { type: "checkbox", checked: "checked", onchange: function () { onlyNew = this.checked; build(); } }), document.createTextNode(" 只顯示還沒掌握的術語"));
        function build() {
          deck = shuffle(terms.filter(function (t) { return !onlyNew || !known[t.term]; }));
          idx = 0; show();
        }
        function show() {
          flipped = false;
          var k = Object.keys(known).filter(function (t) { return known[t]; }).length;
          stat.textContent = "已掌握 " + k + " / " + terms.length + " 個術語";
          bar.firstChild.style.width = (k / terms.length * 100) + "%";
          card.replaceChildren();
          if (!deck.length) { card.appendChild(el("div", { text: "這一輪都複習完了！可以取消勾選來重看全部。" })); return; }
          var t = deck[idx % deck.length];
          card.appendChild(el("div", { class: "term", text: t.term }));
          card.appendChild(el("div", { class: "ix-muted", text: "點卡片看解釋　（" + (idx % deck.length + 1) + " / " + deck.length + "）" }));
        }
        function flip() {
          if (!deck.length || flipped) return;
          flipped = true;
          var t = deck[idx % deck.length];
          card.replaceChildren(
            el("div", { class: "term", text: t.term }),
            el("div", { class: "def", text: t.def }),
            el("a", { href: pageUrl(t.url), class: "ix-muted", text: "出處：" + t.chapter, onclick: function (e) { e.stopPropagation(); } }));
        }
        function mark(isKnown) {
          if (!deck.length) return;
          known[deck[idx % deck.length].term] = isKnown;
          store.set("known-terms", known);
          if (isKnown && onlyNew) { deck.splice(idx % deck.length, 1); } else idx++;
          show();
        }
        card.addEventListener("click", flip);
        root.append(el("div", { class: "ix-row" }, stat, toggle), bar, card,
          el("div", { class: "ix-row" },
            el("button", { class: "ix-btn", text: "再複習", onclick: function () { mark(false); } }),
            el("button", { class: "ix-btn primary", text: "我會了", onclick: function () { mark(true); } })));
        build();
      })
      .catch(function () { root.textContent = "術語載入失敗。"; });
  }

  // ── 學習進度 ───────────────────────────────────
  function initProgress(root) {
    root.classList.add("ix-card");
    fetch(dataUrl("chapters.json"), { cache: "no-cache" })
      .then(function (r) { return r.json(); })
      .then(function (chapters) {
        var visited = store.get("visited", {});
        var written = chapters.filter(function (c) { return c.written; });
        var read = written.filter(function (c) { return visited[c.id]; }).length;
        var quizzed = written.filter(function (c) { return store.get("quiz:" + c.id, null) !== null; });
        var known = Object.keys(store.get("known-terms", {})).length;
        root.replaceChildren(
          el("strong", { text: "我的學習進度" }),
          el("div", { class: "ix-out" },
            el("div", {}, el("span", { class: "ix-muted", text: "已讀章節" }), el("b", { text: read + " / " + written.length })),
            el("div", {}, el("span", { class: "ix-muted", text: "完成測驗" }), el("b", { text: quizzed.length + " 章" })),
            el("div", {}, el("span", { class: "ix-muted", text: "已掌握術語" }), el("b", { text: String(known) }))),
          el("div", { class: "ix-muted", text: "進度只存在這個瀏覽器，換裝置或清除瀏覽資料後會重新計算。" }));
        if (quizzed.length) {
          var table = el("table", { class: "ix-progress-table" });
          quizzed.forEach(function (c) {
            table.appendChild(el("tr", {},
              el("td", {}, el("a", { href: pageUrl(c.url), text: "第 " + c.n + " 章　" + c.title })),
              el("td", { text: "測驗最佳 " + store.get("quiz:" + c.id, 0) + " 分" })));
          });
          root.appendChild(table);
        }
      })
      .catch(function () { root.textContent = "進度載入失敗。"; });
  }

  // 給遊戲模組 (games.js) 共用
  window.SemiIX = { el: el, store: store, plot: plot, sci: sci, shuffle: shuffle, range: range,
    dataUrl: dataUrl, pageUrl: pageUrl, legend: legend, PALETTE: PALETTE };

  // ── 啟動 ───────────────────────────────────────
  function init() {
    var chapterMatch = location.pathname.match(/part-\d+\/(\d\d-\d\d)\/?$/);
    if (chapterMatch) {
      var visited = store.get("visited", {});
      visited[chapterMatch[1]] = Date.now();
      store.set("visited", visited);
    }
    document.querySelectorAll(".quiz[data-quiz]:not([data-ready])").forEach(function (n) { n.setAttribute("data-ready", "1"); initQuiz(n); });
    document.querySelectorAll(".flashcards:not([data-ready])").forEach(function (n) { n.setAttribute("data-ready", "1"); initFlashcards(n); });
    document.querySelectorAll(".progress-widget:not([data-ready])").forEach(function (n) { n.setAttribute("data-ready", "1"); initProgress(n); });
    document.querySelectorAll(".equipment-atlas:not([data-ready])").forEach(function (n) { n.setAttribute("data-ready", "1"); initAtlas(n); });
    document.querySelectorAll(".card-library:not([data-ready])").forEach(function (n) { n.setAttribute("data-ready", "1"); initCardLibrary(n); });
    document.querySelectorAll(".model-atlas:not([data-ready])").forEach(function (n) { n.setAttribute("data-ready", "1"); initModels(n); });
    document.querySelectorAll(".lab[data-lab]:not([data-ready])").forEach(function (n) {
      var fn = LABS[n.getAttribute("data-lab")];
      if (!fn) return;
      n.setAttribute("data-ready", "1");
      n.classList.add("ix-card", "ix-lab");
      fn(n);
    });
  }
  if (window.document$ && window.document$.subscribe) window.document$.subscribe(init);
  else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
