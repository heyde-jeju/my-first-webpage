/*
 * 참여자·관리자 화면이 같이 쓰는 데이터 연결 + 아이콘.
 * 서버(/api)가 있으면 서버에 저장하고, 없으면(파일로 바로 연 경우) 이 기기 안에서만 도는 데모 모드로 동작합니다.
 */
(function () {
  var SESSION_KEY = "jbf26-session";
  var DEMO_DB = "jbf26-demo-db";
  var DEMO_CFG = "jbf26-demo-config";

  function store(k, v) {
    try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }
    catch (e) { return null; }
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  var mode = null, demo = null, adminPw = null;

  function demoSave() { store(DEMO_DB, demo.db); store(DEMO_CFG, demo.config); }

  async function init() {
    if (mode) return mode;
    if (/^https?:$/.test(location.protocol)) {
      try {
        var r = await fetch("/api/config", { cache: "no-store" });
        if (r.ok && (r.headers.get("content-type") || "").indexOf("json") >= 0) { mode = "server"; return mode; }
      } catch (e) { /* 서버 없음 */ }
    }
    if (!window.STAMP_CONFIG) await loadScript("config/programs.js");
    demo = { config: store(DEMO_CFG) || JSON.parse(JSON.stringify(window.STAMP_CONFIG)), db: store(DEMO_DB) || StampCore.emptyDb() };
    mode = "demo";
    return mode;
  }

  async function call(path, body, extraHeaders) {
    var s = store(SESSION_KEY) || {};
    var headers = { "Content-Type": "application/json", "X-Pid": s.pid || "", "X-Key": s.key || "" };
    for (var k in extraHeaders || {}) headers[k] = extraHeaders[k];
    var r = await fetch(path, { method: body ? "POST" : "GET", headers: headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    var data;
    try { data = await r.json(); } catch (e) { data = { ok: false, message: "서버 응답을 읽지 못했어요." }; }
    if (r.status === 401 && path.indexOf("/api/admin") < 0) data.error = "auth";
    return data;
  }

  function demoMe() {
    // 다른 탭(관리자 화면)에서 바꾼 코드·기록을 반영
    demo.db = store(DEMO_DB) || demo.db;
    demo.config = store(DEMO_CFG) || demo.config;
    var s = store(SESSION_KEY) || {};
    return StampCore.auth(demo, s.pid, s.key);
  }
  function demoAction(fn) {
    var p = demoMe();
    if (!p) return { ok: false, error: "auth", message: "참여 정보를 찾을 수 없어요. 다시 등록해 주세요." };
    var r = fn(p, Date.now());
    demoSave();
    if (!r.ok) r.participant = StampCore.view(p);
    return r;
  }

  var Api = {
    get mode() { return mode; },
    init: init,
    hasSession: function () { var s = store(SESSION_KEY); return !!(s && s.pid); },
    logout: function () { store(SESSION_KEY, null); },
    config: async function () {
      if (mode === "server") return call("/api/config");
      return StampCore.publicConfig(demo.config);
    },
    register: async function (input) {
      var r = mode === "server" ? await call("/api/register", input) : (function () { var x = StampCore.register(demo, input, Date.now()); demoSave(); return x; })();
      if (r.ok) store(SESSION_KEY, { pid: r.participant.id, key: r.key });
      return r;
    },
    me: async function () {
      if (mode === "server") return call("/api/me");
      var p = demoMe();
      return p ? { ok: true, participant: StampCore.view(p) } : { ok: false, error: "auth" };
    },
    stamp: function (code) { return mode === "server" ? call("/api/stamp", { code: code }) : demoAction(function (p, n) { return StampCore.stampByCode(demo, p, code, n); }); },
    scan: function (token) { return mode === "server" ? call("/api/scan", { token: token }) : demoAction(function (p, n) { return StampCore.scanToken(demo, p, token, n); }); },
    survey: function (code) { return mode === "server" ? call("/api/survey", { code: code }) : demoAction(function (p, n) { return StampCore.surveyByCode(demo, p, code, n); }); },
    redeem: function (pin) { return mode === "server" ? call("/api/redeem", { pin: pin }) : demoAction(function (p, n) { return StampCore.redeem(demo, p, pin, n); }); },

    admin: {
      login: async function (pw) {
        adminPw = pw;
        var r = await Api.admin.stats();
        if (!r.ok) adminPw = null;
        return r;
      },
      stats: async function () {
        if (mode === "server") return call("/api/admin/stats", null, { "X-Admin": adminPw || "" });
        if (adminPw !== String(demo.config.adminPassword)) return { ok: false, message: "관리자 비밀번호가 맞지 않아요." };
        demo.db = store(DEMO_DB) || demo.db;
        return { ok: true, stats: StampCore.stats(demo) };
      },
      config: async function () {
        if (mode === "server") return call("/api/admin/config", null, { "X-Admin": adminPw });
        return { ok: true, config: demo.config };
      },
      regen: async function (target, part) {
        if (mode === "server") return call("/api/admin/regen", { target: target, part: part }, { "X-Admin": adminPw });
        var r = StampCore.regen(demo, target, part); demoSave(); r.config = demo.config; return r;
      },
      setCode: async function (target, code) {
        if (mode === "server") return call("/api/admin/setcode", { target: target, code: code }, { "X-Admin": adminPw });
        var r = StampCore.setCode(demo, target, code); demoSave(); r.config = demo.config; return r;
      },
      saveConfig: async function (cfg) {
        if (mode === "server") return call("/api/admin/config", { config: cfg }, { "X-Admin": adminPw });
        var errors = StampCore.validateConfig(cfg);
        if (errors.length) return { ok: false, message: errors.join("\n") };
        demo.config = cfg; demoSave(); return { ok: true, config: cfg };
      },
      reload: async function () {
        if (mode === "server") return call("/api/admin/reload", {}, { "X-Admin": adminPw });
        demo.config = JSON.parse(JSON.stringify(window.STAMP_CONFIG)); demoSave();
        return { ok: true, config: demo.config, warnings: StampCore.validateConfig(demo.config) };
      },
      resetDemo: function () { if (mode !== "demo") return; demo.db = StampCore.emptyDb(); demoSave(); }
    }
  };

  /* 영역별 아이콘 (24×24, 선 아이콘) */
  var P = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  var ICONS = {
    manna: '<svg viewBox="0 0 24 24" ' + P + '><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg>',
    ilgeu: '<svg viewBox="0 0 24 24" ' + P + '><path d="M12 6.5C10 5 7 4.5 3 5v13c4-.5 7 0 9 1.5 2-1.5 5-2 9-1.5V5c-4-.5-7 0-9 1.5zM12 6.5v13"/></svg>',
    bo: '<svg viewBox="0 0 24 24" ' + P + '><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    nol: '<svg viewBox="0 0 24 24" ' + P + '><path d="M12 2.5l6 7-6 8-6-8zM6 9.5h12M12 17.5c0 2 1.5 3 3 3"/></svg>',
    jeulgi: '<svg viewBox="0 0 24 24" ' + P + '><path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    jiki: '<svg viewBox="0 0 24 24" ' + P + '><path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15zM5 19l8-8"/></svg>',
    seed: '<svg viewBox="0 0 24 24" ' + P + '><path d="M12 3.5c4 3 5.5 7 4.5 11-1 3.5-3 5.5-4.5 6-1.5-.5-3.5-2.5-4.5-6-1-4 .5-8 4.5-11z"/><path d="M12 7.5v10"/></svg>',
    sprout: '<svg viewBox="0 0 24 24" ' + P + '><path d="M12 21v-9M12 12c0-4-3-6.5-7.5-6.5C4.5 9.5 7.5 12 12 12zM12 14c0-4 3-6.5 7.5-6.5 0 4-3 6.5-7.5 6.5z"/></svg>',
    survey: '<svg viewBox="0 0 24 24" ' + P + '><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 3.5h6v2.5H9zM8.5 11l2 2 4-4M8.5 16.5h7"/></svg>',
    gift: '<svg viewBox="0 0 24 24" ' + P + '><rect x="3.5" y="9" width="17" height="11" rx="1.5"/><path d="M2.5 9h19M12 9v11M12 9c-1-3-5-4.5-5.5-2S10 9 12 9zM12 9c1-3 5-4.5 5.5-2S14 9 12 9z"/></svg>',
    qr: '<svg viewBox="0 0 24 24" ' + P + '><rect x="3.5" y="3.5" width="6" height="6" rx="1"/><rect x="14.5" y="3.5" width="6" height="6" rx="1"/><rect x="3.5" y="14.5" width="6" height="6" rx="1"/><path d="M14.5 14.5h2.5v2.5M20.5 14.5v6h-3M14.5 20.5v-1"/></svg>',
    keypad: '<svg viewBox="0 0 24 24" ' + P + '><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/></svg>',
    home: '<svg viewBox="0 0 24 24" ' + P + '><path d="M3.5 11L12 4l8.5 7M6 9.5V20h12V9.5"/></svg>',
    board: '<svg viewBox="0 0 24 24" ' + P + '><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="8.5" cy="8.5" r="2"/><circle cx="15.5" cy="8.5" r="2"/><circle cx="8.5" cy="15.5" r="2"/><circle cx="15.5" cy="15.5" r="2"/></svg>',
    info: '<svg viewBox="0 0 24 24" ' + P + '><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4M7.5 13.5h3M7.5 16.5h6"/></svg>',
    pin: '<svg viewBox="0 0 24 24" ' + P + '><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
    rain: '<svg viewBox="0 0 24 24" ' + P + '><path d="M7 15a4 4 0 0 1 .5-8A5.5 5.5 0 0 1 18 8.5a3.5 3.5 0 0 1-.5 6.5zM8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5"/></svg>',
    close: '<svg viewBox="0 0 24 24" ' + P + '><path d="M6 6l12 12M18 6L6 18"/></svg>',
    camera: '<svg viewBox="0 0 24 24" ' + P + '><path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>'
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function fmtTime(ts) {
    var d = new Date(ts);
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return (d.getMonth() + 1) + "." + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  /* QR 내용에서 토큰 꺼내기: 주소(?t=...) 또는 토큰만 */
  function tokenFrom(text) {
    text = String(text || "").trim();
    var m = text.match(/[?&#]t=([A-Za-z0-9]+)/);
    if (m) return m[1];
    if (/^[A-Za-z0-9]{6,}$/.test(text)) return text;
    return "";
  }

  window.Api = Api;
  window.UI = { icons: ICONS, esc: esc, fmtTime: fmtTime, tokenFrom: tokenFrom, store: store, loadScript: loadScript };
})();
