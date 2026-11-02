/*
 * 2026 제주독서대전 스탬프 투어 서버 (Node.js 18+, 외부 패키지 없음)
 *   node server.js            → http://localhost:8080
 *   PORT=3000 node server.js  → 포트 변경
 * 참여자 데이터: data/db.json / 프로그램 설정: config/programs.js
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const core = require("./core.js");

const ROOT = __dirname;
const CONFIG_PATH = path.join(ROOT, "config", "programs.js");
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const PORT = Number(process.env.PORT) || 8080;

const STATIC = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/admin": ["admin.html", "text/html; charset=utf-8"],
  "/admin.html": ["admin.html", "text/html; charset=utf-8"],
  "/core.js": ["core.js", "text/javascript; charset=utf-8"],
  "/shared.js": ["shared.js", "text/javascript; charset=utf-8"],
  "/style.css": ["style.css", "text/css; charset=utf-8"]
};

function loadConfig() {
  delete require.cache[require.resolve(CONFIG_PATH)];
  const cfg = require(CONFIG_PATH);
  const errors = core.validateConfig(cfg);
  if (errors.length) console.warn("[설정 경고]\n - " + errors.join("\n - "));
  return cfg;
}

function loadDb() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, "utf8")); }
  catch (e) { return core.emptyDb(); }
}

const state = { config: loadConfig(), db: loadDb() };

/* 저장: 임시 파일에 쓰고 바꿔치기해서 중간에 꺼져도 파일이 깨지지 않게 */
let saving = false, pending = false;
function saveDb() {
  if (saving) { pending = true; return; }
  saving = true;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_PATH + ".tmp";
  fs.writeFile(tmp, JSON.stringify(state.db), (err) => {
    if (!err) fs.renameSync(tmp, DB_PATH);
    else console.error("저장 실패", err);
    saving = false;
    if (pending) { pending = false; saveDb(); }
  });
}

function saveConfig() {
  const src = fs.readFileSync(CONFIG_PATH, "utf8");
  const idx = src.indexOf("\n  return ");
  const head = idx >= 0 ? src.slice(0, idx + 1) : "(function (root, factory) {\n  var cfg = factory();\n  if (typeof module === \"object\" && module.exports) module.exports = cfg;\n  else root.STAMP_CONFIG = cfg;\n})(typeof self !== \"undefined\" ? self : this, function () {\n";
  fs.writeFileSync(CONFIG_PATH, head + "  return " + JSON.stringify(state.config, null, 2) + ";\n});\n");
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > 1e6) { reject(new Error("too big")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

/* 관리자 비밀번호 무차별 대입 막기 */
const adminFails = new Map();
function adminOk(req) {
  const ip = req.socket.remoteAddress;
  const f = adminFails.get(ip) || { n: 0, until: 0 };
  if (f.until > Date.now()) return "locked";
  if (req.headers["x-admin"] === String(state.config.adminPassword)) { adminFails.delete(ip); return "ok"; }
  f.n++;
  if (f.n >= 8) { f.n = 0; f.until = Date.now() + 5 * 60 * 1000; }
  adminFails.set(ip, f);
  return "bad";
}

async function api(req, res, url) {
  const p = url.pathname;
  const now = Date.now();

  if (p === "/api/config" && req.method === "GET") return send(res, 200, core.publicConfig(state.config));

  if (p.startsWith("/api/admin/")) {
    const a = adminOk(req);
    if (a === "locked") return send(res, 429, { ok: false, message: "잠시 뒤에 다시 해 주세요." });
    if (a === "bad") return send(res, 401, { ok: false, message: "관리자 비밀번호가 맞지 않아요." });
    if (p === "/api/admin/stats") return send(res, 200, { ok: true, stats: core.stats(state) });
    if (p === "/api/admin/config" && req.method === "GET") return send(res, 200, { ok: true, config: state.config });
    const body = await readBody(req);
    if (p === "/api/admin/config" && req.method === "POST") {
      const errors = core.validateConfig(body.config);
      if (errors.length) return send(res, 400, { ok: false, message: errors.join("\n") });
      state.config = body.config; saveConfig();
      return send(res, 200, { ok: true, config: state.config });
    }
    if (p === "/api/admin/regen") {
      const r = core.regen(state, body.target, body.part);
      if (r.ok) saveConfig();
      return send(res, r.ok ? 200 : 400, Object.assign(r, { config: state.config }));
    }
    if (p === "/api/admin/setcode") {
      const r = core.setCode(state, body.target, body.code);
      if (r.ok) saveConfig();
      return send(res, r.ok ? 200 : 400, Object.assign(r, { config: state.config }));
    }
    if (p === "/api/admin/reload") {
      state.config = loadConfig();
      return send(res, 200, { ok: true, config: state.config, warnings: core.validateConfig(state.config) });
    }
    return send(res, 404, { ok: false, message: "없는 주소예요." });
  }

  if (p === "/api/register" && req.method === "POST") {
    const r = core.register(state, await readBody(req), now);
    if (r.ok) saveDb();
    return send(res, r.ok ? 200 : 400, r);
  }

  const who = core.auth(state, req.headers["x-pid"], req.headers["x-key"]);
  if (!who) return send(res, 401, { ok: false, error: "auth", message: "참여 정보를 찾을 수 없어요. 다시 등록해 주세요." });

  if (p === "/api/me") return send(res, 200, { ok: true, participant: core.view(who) });
  if (req.method !== "POST") return send(res, 405, { ok: false });
  const body = await readBody(req);
  let r;
  if (p === "/api/stamp") r = core.stampByCode(state, who, body.code, now);
  else if (p === "/api/scan") r = core.scanToken(state, who, body.token, now);
  else if (p === "/api/survey") r = core.surveyByCode(state, who, body.code, now);
  else if (p === "/api/redeem") r = core.redeem(state, who, body.pin, now);
  else return send(res, 404, { ok: false, message: "없는 주소예요." });
  saveDb();
  if (!r.ok) r.participant = core.view(who);
  return send(res, 200, r);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    const s = STATIC[url.pathname];
    if (!s) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Not found"); }
    fs.readFile(path.join(ROOT, s[0]), (err, buf) => {
      if (err) { res.writeHead(500); return res.end(); }
      res.writeHead(200, { "Content-Type": s[1], "Cache-Control": "no-cache" });
      res.end(buf);
    });
  } catch (e) {
    console.error(e);
    send(res, 400, { ok: false, message: "요청을 처리하지 못했어요." });
  }
}).listen(PORT, () => {
  console.log("스탬프 투어 서버: http://localhost:" + PORT + "  (관리자: /admin)");
});
