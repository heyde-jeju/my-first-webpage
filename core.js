/*
 * 스탬프 투어 규칙 엔진 — 서버(server.js)와 브라우저 데모 모드가 같이 씁니다.
 * state = { config, db: { participants: {}, log: [] } }
 * 모든 함수는 state를 직접 바꾸고 { ok, ... } 또는 { ok:false, error, message } 를 돌려줍니다.
 */
(function (root, factory) {
  var core = factory();
  if (typeof module === "object" && module.exports) module.exports = core;
  else root.StampCore = core;
})(typeof self !== "undefined" ? self : this, function () {
  var MAX_FAILS = 5;
  var LOCK_MS = 60 * 1000;
  var ALNUM = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

  function randomInts(n) {
    var c = (typeof globalThis !== "undefined" && globalThis.crypto) || null;
    if (!c && typeof require === "function") c = require("crypto").webcrypto;
    var arr = new Uint32Array(n);
    if (c && c.getRandomValues) c.getRandomValues(arr);
    else for (var i = 0; i < n; i++) arr[i] = Math.floor(Math.random() * 4294967296);
    return arr;
  }
  function randomString(len, alphabet) {
    alphabet = alphabet || ALNUM;
    var r = randomInts(len), s = "";
    for (var i = 0; i < len; i++) s += alphabet[r[i] % alphabet.length];
    return s;
  }

  function fail(error, message, extra) {
    var o = { ok: false, error: error, message: message };
    for (var k in extra || {}) o[k] = extra[k];
    return o;
  }

  function emptyDb() { return { participants: {}, log: [] }; }

  function stampPrograms(config) {
    return config.programs.filter(function (p) { return p.stamp; });
  }
  function findProgram(config, id) {
    for (var i = 0; i < config.programs.length; i++) if (config.programs[i].id === id) return config.programs[i];
    return null;
  }

  /* 참여자 화면에 보내도 되는 설정 (코드·토큰·PIN 제외) */
  function publicConfig(config) {
    return {
      event: config.event,
      rules: config.rules,
      gift: config.gift,
      survey: { title: config.survey.title, url: config.survey.url, place: config.survey.place },
      areas: config.areas,
      programs: config.programs.map(function (p) {
        return { id: p.id, area: p.area, name: p.name, detail: p.detail || "", day: p.day, time: p.time,
          place: p.place, rainPlace: p.rainPlace || "", stamp: !!p.stamp };
      })
    };
  }

  function view(p) {
    return {
      id: p.id, nickname: p.nickname, last4: p.last4, createdAt: p.createdAt,
      stamps: p.stamps.slice(), survey: p.survey || null, redeemed: p.redeemed || null
    };
  }

  function addLog(state, type, p, extra, now) {
    var entry = { at: now, type: type, pid: p.id, nickname: p.nickname };
    for (var k in extra || {}) entry[k] = extra[k];
    state.db.log.unshift(entry);
    if (state.db.log.length > 200) state.db.log.length = 200;
  }

  function locked(p, now) {
    return p.lockUntil && p.lockUntil > now;
  }
  function badAttempt(p, now) {
    p.fails = (p.fails || 0) + 1;
    if (p.fails >= MAX_FAILS) { p.fails = 0; p.lockUntil = now + LOCK_MS; }
  }
  function lockedFail(p, now) {
    return fail("locked", "잘못 입력한 횟수가 많아요. " + Math.ceil((p.lockUntil - now) / 1000) + "초 뒤에 다시 해 주세요.");
  }

  function register(state, input, now) {
    var nickname = String(input.nickname || "").trim().replace(/\s+/g, " ");
    var last4 = String(input.last4 || "").trim();
    if (!input.agree) return fail("agree", "개인정보 수집에 동의해 주세요.");
    if (nickname.length < 1 || nickname.length > 12) return fail("nickname", "닉네임은 1~12자로 적어 주세요.");
    if (!/^\d{4}$/.test(last4)) return fail("last4", "휴대폰 뒷자리 숫자 4개를 적어 주세요.");
    var ps = state.db.participants;
    for (var id in ps) {
      if (ps[id].nickname === nickname && ps[id].last4 === last4) {
        return { ok: true, resumed: true, key: ps[id].key, participant: view(ps[id]) };
      }
    }
    var p = { id: "P" + randomString(8), key: randomString(24), nickname: nickname, last4: last4,
      createdAt: now, stamps: [], survey: null, redeemed: null };
    ps[p.id] = p;
    addLog(state, "join", p, {}, now);
    return { ok: true, resumed: false, key: p.key, participant: view(p) };
  }

  function auth(state, id, key) {
    var p = state.db.participants[id];
    if (!p || !key || p.key !== key) return null;
    return p;
  }

  function addStamp(state, p, program, method, now) {
    var max = state.config.rules.maxStamps;
    for (var i = 0; i < p.stamps.length; i++) {
      if (p.stamps[i].programId === program.id) {
        return fail("duplicate", "이미 받은 스탬프예요. 같은 프로그램은 한 번만 찍혀요.", { program: program.name });
      }
    }
    if (p.stamps.length >= max) return fail("full", "스탬프판이 가득 찼어요!");
    p.stamps.push({ programId: program.id, name: program.name, area: program.area, at: now, method: method });
    p.fails = 0;
    addLog(state, "stamp", p, { programId: program.id, program: program.name, method: method }, now);
    return { ok: true, kind: "stamp", slot: p.stamps.length, program: { id: program.id, name: program.name, area: program.area },
      full: p.stamps.length >= max, participant: view(p) };
  }

  function addSurvey(state, p, method, now) {
    if (p.survey) return fail("duplicate", "만족도 조사 확인을 이미 받았어요.");
    if (p.stamps.length < state.config.rules.requiredStamps) {
      return fail("notyet", "스탬프를 " + state.config.rules.requiredStamps + "개 이상 모은 뒤에 확인받을 수 있어요.");
    }
    p.survey = { at: now, method: method };
    p.fails = 0;
    addLog(state, "survey", p, { method: method }, now);
    return { ok: true, kind: "survey", participant: view(p) };
  }

  /* 4자리 인증코드 (프로그램 부스) */
  function stampByCode(state, p, code, now) {
    if (locked(p, now)) return lockedFail(p, now);
    code = String(code || "").trim();
    if (!/^\d{4}$/.test(code)) return fail("format", "숫자 4자리를 입력해 주세요.");
    var list = stampPrograms(state.config);
    for (var i = 0; i < list.length; i++) if (list[i].code === code) return addStamp(state, p, list[i], "code", now);
    if (code === state.config.survey.code) return fail("wrongbox", "설문 확인코드예요. 아래 '만족도 조사' 칸에서 입력해 주세요.");
    badAttempt(p, now);
    return fail("wrong", "맞지 않는 코드예요. 스태프에게 다시 확인해 주세요.");
  }

  /* 4자리 확인코드 (1층 로비 설문 담당자) */
  function surveyByCode(state, p, code, now) {
    if (locked(p, now)) return lockedFail(p, now);
    code = String(code || "").trim();
    if (!/^\d{4}$/.test(code)) return fail("format", "숫자 4자리를 입력해 주세요.");
    if (code !== state.config.survey.code) {
      badAttempt(p, now);
      return fail("wrong", "맞지 않는 확인코드예요. 로비 담당자에게 다시 확인해 주세요.");
    }
    return addSurvey(state, p, "code", now);
  }

  /* QR 스캔 — 프로그램 QR 또는 설문 확인 QR */
  function scanToken(state, p, token, now) {
    if (locked(p, now)) return lockedFail(p, now);
    token = String(token || "").trim();
    if (!token) return fail("format", "QR을 읽지 못했어요.");
    if (token === state.config.survey.token) return addSurvey(state, p, "qr", now);
    var list = stampPrograms(state.config);
    for (var i = 0; i < list.length; i++) if (list[i].token && list[i].token === token) return addStamp(state, p, list[i], "qr", now);
    badAttempt(p, now);
    return fail("wrong", "스탬프 투어 QR이 아니에요. 부스에 있는 QR을 찍어 주세요.");
  }

  function redeem(state, p, pin, now) {
    if (locked(p, now)) return lockedFail(p, now);
    if (!p.survey) return fail("notyet", "만족도 조사 확인을 먼저 받아 주세요.");
    if (p.redeemed) return fail("duplicate", "이미 선물을 받은 교환권이에요.");
    if (String(pin || "").trim() !== String(state.config.staffPin)) {
      badAttempt(p, now);
      return fail("wrong", "담당자 PIN이 맞지 않아요.");
    }
    p.redeemed = { at: now };
    p.fails = 0;
    addLog(state, "redeem", p, {}, now);
    return { ok: true, kind: "redeem", participant: view(p) };
  }

  function stats(state) {
    var cfg = state.config, ps = state.db.participants;
    var byProgram = {}, byArea = {}, total = 0, qualified = 0, survey = 0, redeemed = 0, count = 0, full = 0;
    stampPrograms(cfg).forEach(function (p) { byProgram[p.id] = 0; });
    cfg.areas.forEach(function (a) { if (a.stamp) byArea[a.id] = 0; });
    var dist = [];
    for (var i = 0; i <= cfg.rules.maxStamps; i++) dist.push(0);
    for (var id in ps) {
      var p = ps[id];
      count++;
      dist[Math.min(p.stamps.length, cfg.rules.maxStamps)]++;
      p.stamps.forEach(function (s) {
        total++;
        if (byProgram[s.programId] !== undefined) byProgram[s.programId]++;
        if (byArea[s.area] !== undefined) byArea[s.area]++;
      });
      if (p.stamps.length >= cfg.rules.requiredStamps) qualified++;
      if (p.stamps.length >= cfg.rules.maxStamps) full++;
      if (p.survey) survey++;
      if (p.redeemed) redeemed++;
    }
    return { participants: count, stamps: total, qualified: qualified, full: full, survey: survey, redeemed: redeemed,
      byProgram: byProgram, byArea: byArea, distribution: dist, log: state.db.log.slice(0, 30) };
  }

  /* 관리자: 코드 새로 만들기. target = 프로그램 id | "survey" | "staffPin" ; part = "code" | "token" | "both" */
  function usedCodes(config) {
    var used = {};
    stampPrograms(config).forEach(function (p) { if (p.code) used[p.code] = true; });
    used[config.survey.code] = true;
    return used;
  }
  function newCode(config) {
    var used = usedCodes(config);
    for (var tries = 0; tries < 1000; tries++) {
      var c = String(1000 + (randomInts(1)[0] % 9000));
      if (!used[c]) return c;
    }
    throw new Error("코드를 만들 수 없어요");
  }
  function regen(state, target, part) {
    var cfg = state.config;
    part = part || "both";
    var obj;
    if (target === "survey") obj = cfg.survey;
    else if (target === "staffPin") { cfg.staffPin = String(1000 + (randomInts(1)[0] % 9000)); return { ok: true, staffPin: cfg.staffPin }; }
    else obj = findProgram(cfg, target);
    if (!obj || (obj !== cfg.survey && !obj.stamp)) return fail("notfound", "대상을 찾을 수 없어요.");
    if (part === "code" || part === "both") obj.code = newCode(cfg);
    if (part === "token" || part === "both") obj.token = randomString(10);
    return { ok: true, code: obj.code, token: obj.token };
  }

  /* 관리자: 코드 직접 지정 */
  function setCode(state, target, code) {
    var cfg = state.config;
    code = String(code || "").trim();
    if (!/^\d{4}$/.test(code)) return fail("format", "숫자 4자리로 적어 주세요.");
    if (target === "staffPin") { cfg.staffPin = code; return { ok: true }; }
    var obj = target === "survey" ? cfg.survey : findProgram(cfg, target);
    if (!obj) return fail("notfound", "대상을 찾을 수 없어요.");
    var used = usedCodes(cfg);
    if (obj.code !== code && used[code]) return fail("taken", "다른 곳에서 쓰는 코드예요.");
    obj.code = code;
    return { ok: true };
  }

  /* 설정 검사: 관리자가 파일을 고쳤을 때 겹치는 코드를 알려 줍니다 */
  function validateConfig(cfg) {
    var errors = [], seenCode = {}, seenToken = {}, seenId = {};
    if (!cfg || !Array.isArray(cfg.programs)) return ["programs 목록이 없어요."];
    cfg.programs.forEach(function (p) {
      if (!p.id) errors.push("id가 없는 프로그램이 있어요: " + p.name);
      if (seenId[p.id]) errors.push("id가 겹쳐요: " + p.id);
      seenId[p.id] = true;
      if (!p.stamp) return;
      if (!/^\d{4}$/.test(p.code || "")) errors.push(p.name + ": 인증코드는 숫자 4자리여야 해요.");
      if (seenCode[p.code]) errors.push("인증코드가 겹쳐요: " + p.code + " (" + seenCode[p.code] + " / " + p.name + ")");
      seenCode[p.code] = p.name;
      if (!/^[A-Za-z0-9]{6,}$/.test(p.token || "")) errors.push(p.name + ": QR 값은 영문·숫자 6자 이상이어야 해요.");
      if (seenToken[p.token]) errors.push("QR 값이 겹쳐요: " + p.name);
      seenToken[p.token] = true;
    });
    if (!cfg.survey || !/^\d{4}$/.test(cfg.survey.code || "")) errors.push("설문 확인코드는 숫자 4자리여야 해요.");
    else if (seenCode[cfg.survey.code]) errors.push("설문 확인코드가 프로그램 코드와 겹쳐요: " + cfg.survey.code);
    if (cfg.survey && seenToken[cfg.survey.token]) errors.push("설문 확인 QR 값이 프로그램 QR과 겹쳐요.");
    if (!cfg.rules || !(cfg.rules.requiredStamps >= 1) || !(cfg.rules.maxStamps >= cfg.rules.requiredStamps)) errors.push("rules 값이 올바르지 않아요.");
    return errors;
  }

  return {
    emptyDb: emptyDb, publicConfig: publicConfig, view: view, register: register, auth: auth,
    stampByCode: stampByCode, surveyByCode: surveyByCode, scanToken: scanToken, redeem: redeem,
    stats: stats, regen: regen, setCode: setCode, validateConfig: validateConfig, randomString: randomString
  };
});
