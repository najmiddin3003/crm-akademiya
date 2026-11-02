// SINOV SAYTI QOROVULI sinovi (02.11.2026): lib/outboundGuard.ts va uni ishlatadigan joylar —
// lib/telegramApi.ts (callTelegram), lib/eskiz.ts (sendSms), lib/sync/config.ts (isSheetsReady,
// syncConfigIssues), lib/sync/googleSheets.ts (sheetsFetch → readRows).
//
// Tarmoqqa CHIQMAYDI: globalThis.fetch soxta — har chaqiruv yoziladi, javob berilmagan holatda
// so'rov xato bilan to'xtaydi. Kalitlar ham soxta (Google kaliti shu yerda yasaladi).
//
//   node --experimental-transform-types --no-warnings scripts/_verify-outbound-guard.mjs
import { registerHooks } from "node:module";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { generateKeyPairSync } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT_URL = pathToFileURL(ROOT).href + "/";
const fileUrl = (rel) => new URL(rel, ROOT_URL).href;

// ── "@/..." va nisbiy yo'llarni .ts fayllarga bog'lash (modul almashtirish kerak emas) ──
const EXTS = [".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.js"];
function withExt(url) {
  const p = fileURLToPath(url);
  if (existsSync(p) && statSync(p).isFile()) return url;
  for (const ext of EXTS) if (existsSync(p + ext)) return url + ext;
  return url;
}
registerHooks({
  resolve(specifier, context, nextResolve) {
    let url = null;
    if (specifier.startsWith("@/")) url = withExt(new URL(specifier.slice(2), ROOT_URL).href);
    else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
      url = withExt(new URL(specifier, context.parentURL).href);
    }
    if (url === null) return nextResolve(specifier, context);
    return nextResolve(url, context);
  },
});

// ── Muhit: har holat toza varaqdan ───────────────────────────────────────────
const KEYS = [
  "VERCEL", "TELEGRAM_SEND", "SMS_SEND", "SHEETS_SEND", "SYNC_ENABLED",
  "ESKIZ_EMAIL", "ESKIZ_PASSWORD", "ESKIZ_FROM",
  "ESKIZ_FALLBACK_EMAIL", "ESKIZ_FALLBACK_PASSWORD", "ESKIZ_FALLBACK_FROM",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_PRIVATE_KEY",
  "SHEET_ID_PAYMENTS", "SHEET_ID_SALARIES", "SHEET_ID_EXPENSES", "SHEET_ID_TRANSFERS",
  "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_PAYMENTS", "TELEGRAM_CHAT_SALARIES",
];
for (const k of KEYS) delete process.env[k];

const { privateKey: PEM } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const ESKIZ = { ESKIZ_EMAIL: "sinov@example.com", ESKIZ_PASSWORD: "sinov-parol", ESKIZ_FROM: "4546" };
const ESKIZ_FALLBACK = { ESKIZ_FALLBACK_EMAIL: "zaxira@example.com", ESKIZ_FALLBACK_PASSWORD: "zaxira-parol" };
const SYNC = {
  GOOGLE_SERVICE_ACCOUNT_EMAIL: "sinov@sinov.iam.gserviceaccount.com",
  GOOGLE_PRIVATE_KEY: PEM,
  SHEET_ID_PAYMENTS: "sheet-tolov",
  SHEET_ID_SALARIES: "sheet-oylik",
  TELEGRAM_BOT_TOKEN: "123:sinov",
  TELEGRAM_CHAT_PAYMENTS: "-100111",
  TELEGRAM_CHAT_SALARIES: "-100222",
};

// ── Soxta tarmoq ─────────────────────────────────────────────────────────────
const calls = [];
let responder = null;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  calls.push({ url: u, method: init.method || "GET" });
  if (!responder) throw new Error(`kutilmagan tarmoq so'rovi: ${u}`);
  return responder(u, init);
};
const reply = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const hosts = () => calls.map((c) => new URL(c.url).host + new URL(c.url).pathname.replace(/bot[^/]+/, "bot***"));

// Konsol shovqini yig'iladi (qorovul log yozganini ham tekshiramiz).
const logs = [];
console.warn = (...a) => logs.push(a.join(" "));
console.info = (...a) => logs.push(a.join(" "));

function setEnv(vars = {}) {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, vars);
  calls.length = 0;
  logs.length = 0;
  responder = null;
}

const results = [];
async function holat(title, fn) {
  try {
    const why = await fn();
    results.push(why ? { ok: false, title, why } : { ok: true, title });
  } catch (e) {
    results.push({ ok: false, title, why: `kutilmagan xato: ${e instanceof Error ? e.message : String(e)}` });
  }
}
const expect = (cond, why) => (cond ? null : why);

const { outboundMuted, MUTED_REASON } = await import(fileUrl("lib/outboundGuard.ts"));
const { telegramMuted, callTelegram } = await import(fileUrl("lib/telegramApi.ts"));
const { sendSms } = await import(fileUrl("lib/eskiz.ts"));
const { loadSyncConfig, isSheetsReady, isTelegramReady, syncConfigIssues, SYNC_KINDS } = await import(fileUrl("lib/sync/config.ts"));
const { readRows } = await import(fileUrl("lib/sync/googleSheets.ts"));

// ── 1. Qoida jadvali ─────────────────────────────────────────────────────────
const FLAG = { telegram: "TELEGRAM_SEND", sms: "SMS_SEND", sheets: "SHEETS_SEND" };
const MATRIX = [
  { label: "VPS (VERCEL yo'q) → yozadi", env: {}, muted: false },
  { label: "Vercel (VERCEL=1) → o'chiq", env: { VERCEL: "1" }, muted: true },
  { label: "VERCEL=0 → yozadi (faqat \"1\" hisob)", env: { VERCEL: "0" }, muted: false },
  { label: "Vercel + bayroq on → yozadi", env: { VERCEL: "1" }, flag: "on", muted: false },
  { label: "Vercel + bayroq \" ON \" → yozadi (bo'shliq/registr)", env: { VERCEL: "1" }, flag: " ON ", muted: false },
  { label: "VPS + bayroq off → o'chiq", env: {}, flag: "off", muted: true },
  { label: "Vercel + noma'lum bayroq → o'chiq (sukut)", env: { VERCEL: "1" }, flag: "ha", muted: true },
];
for (const ch of ["telegram", "sms", "sheets"]) {
  for (const m of MATRIX) {
    await holat(`${ch}: ${m.label}`, () => {
      setEnv({ ...m.env, ...(m.flag !== undefined ? { [FLAG[ch]]: m.flag } : {}) });
      return expect(outboundMuted(ch) === m.muted, `outboundMuted("${ch}") = ${outboundMuted(ch)}, kutilgan ${m.muted}`);
    });
  }
}
await holat("kanallar mustaqil: Vercel + SMS_SEND=on → faqat SMS ochiq", () => {
  setEnv({ VERCEL: "1", SMS_SEND: "on" });
  const got = { telegram: outboundMuted("telegram"), sms: outboundMuted("sms"), sheets: outboundMuted("sheets") };
  return expect(got.telegram && !got.sms && got.sheets, `natija ${JSON.stringify(got)}`);
});
await holat("telegramMuted() = outboundMuted(\"telegram\") (eski chaqiruvchilar, masalan staffTaskReminders)", () => {
  for (const m of MATRIX) {
    setEnv({ ...m.env, ...(m.flag !== undefined ? { TELEGRAM_SEND: m.flag } : {}) });
    if (telegramMuted() !== outboundMuted("telegram")) return `farq: ${m.label}`;
  }
  return null;
});

// ── 2. Telegram ──────────────────────────────────────────────────────────────
await holat("Telegram: Vercel'da sendMessage tarmoqqa chiqmaydi, sabab qaytadi", async () => {
  setEnv({ VERCEL: "1", ...SYNC });
  const r = await callTelegram("123:sinov", "sendMessage", { chat_id: 1, text: "salom" });
  return (
    expect(calls.length === 0, `tarmoq so'rovi bo'ldi: ${hosts()}`) ??
    expect(r.ok === false && r.description === MUTED_REASON.telegram, `javob ${JSON.stringify(r)}`)
  );
});
await holat("Telegram: Vercel'da o'qish (getUpdates) ishlayveradi", async () => {
  setEnv({ VERCEL: "1" });
  responder = () => reply({ ok: true, result: [] });
  const r = await callTelegram("123:sinov", "getUpdates", {});
  return expect(r.ok === true && calls.length === 1, `ok=${r.ok}, so'rovlar ${calls.length}`);
});
await holat("Telegram: Vercel + TELEGRAM_SEND=on → sendMessage ketadi", async () => {
  setEnv({ VERCEL: "1", TELEGRAM_SEND: "on" });
  responder = () => reply({ ok: true, result: { message_id: 7 } });
  const r = await callTelegram("123:sinov", "sendMessage", { chat_id: 1, text: "salom" });
  return expect(r.ok === true && calls.length === 1 && hosts()[0].startsWith("api.telegram.org/"), `ok=${r.ok}, ${hosts()}`);
});

// ── 3. SMS ───────────────────────────────────────────────────────────────────
await holat("SMS: Vercel'da kalit bor bo'lsa ham ketmaydi — taqlid, log yoziladi", async () => {
  setEnv({ VERCEL: "1", ...ESKIZ });
  const r = await sendSms("+998 90 123 45 67", "Sinov xabari");
  return (
    expect(calls.length === 0, `tarmoq so'rovi bo'ldi: ${hosts()}`) ??
    expect(r.ok === true && r.simulated === true, `javob ${JSON.stringify(r)}`) ??
    expect(logs.some((l) => l.includes("SMS_SEND") && l.includes("998901234567")), `log yo'q: ${JSON.stringify(logs)}`)
  );
});
await holat("SMS: Vercel'da zaxira akkaunt ham jim", async () => {
  setEnv({ VERCEL: "1", ...ESKIZ, ...ESKIZ_FALLBACK });
  const r = await sendSms("998901234567", "Sinov", "fallback");
  return expect(calls.length === 0 && r.ok === true && r.simulated === true, `so'rovlar ${calls.length}, javob ${JSON.stringify(r)}`);
});
await holat("SMS: VPS'da bayroq off → ketmaydi", async () => {
  setEnv({ SMS_SEND: "off", ...ESKIZ });
  const r = await sendSms("998901234567", "Sinov");
  return expect(calls.length === 0 && r.simulated === true, `so'rovlar ${calls.length}, javob ${JSON.stringify(r)}`);
});
await holat("SMS: Vercel + SMS_SEND=on → Eskiz'ga ketadi (login + yuborish)", async () => {
  setEnv({ VERCEL: "1", SMS_SEND: "on", ...ESKIZ });
  responder = (u) => (u.endsWith("/auth/login") ? reply({ data: { token: "tok" } }) : reply({ id: "1", status: "waiting" }));
  const r = await sendSms("998901234567", "Sinov");
  const h = hosts();
  return expect(
    r.ok === true && !r.simulated && h.length === 2 && h[0] === "notify.eskiz.uz/api/auth/login" && h[1] === "notify.eskiz.uz/api/message/sms/send",
    `javob ${JSON.stringify(r)}, so'rovlar ${h}`,
  );
});
await holat("SMS: VPS'da (VERCEL yo'q) avvalgidek ketadi", async () => {
  setEnv({ ...ESKIZ });
  responder = (u) => (u.endsWith("/auth/login") ? reply({ data: { token: "tok" } }) : reply({ id: "2", status: "waiting" }));
  const r = await sendSms("998901234567", "Sinov");
  return expect(r.ok === true && !r.simulated && hosts().includes("notify.eskiz.uz/api/message/sms/send"), `javob ${JSON.stringify(r)}, so'rovlar ${hosts()}`);
});
await holat("SMS: kalitsiz VPS — avvalgi taqlid o'zgarmagan", async () => {
  setEnv({});
  const r = await sendSms("998901234567", "Sinov");
  return expect(calls.length === 0 && r.ok === true && r.simulated === true, `so'rovlar ${calls.length}, javob ${JSON.stringify(r)}`);
});

// ── 4. Google jadval ─────────────────────────────────────────────────────────
await holat("Sheets: VPS'da sozlangan jadval tayyor, muammo ro'yxati bo'sh", () => {
  setEnv({ ...SYNC });
  const cfg = loadSyncConfig();
  const issues = syncConfigIssues(cfg);
  return (
    expect(isSheetsReady(cfg, "payment") && isSheetsReady(cfg, "salary"), "isSheetsReady false") ??
    expect(issues.length === 0, `muammolar: ${JSON.stringify(issues)}`)
  );
});
await holat("Sheets: Vercel'da kalitlar bor bo'lsa ham hech bir tur tayyor emas", () => {
  setEnv({ VERCEL: "1", ...SYNC });
  const cfg = loadSyncConfig();
  const ready = SYNC_KINDS.filter((k) => isSheetsReady(cfg, k));
  return expect(ready.length === 0, `tayyor: ${ready}`);
});
await holat("Sheets: Vercel'da Sinxronizatsiya sahifasi sababni ko'rsatadi (jadval + Telegram)", () => {
  setEnv({ VERCEL: "1", ...SYNC });
  const issues = syncConfigIssues(loadSyncConfig());
  return expect(
    issues.includes(MUTED_REASON.sheets) && issues.includes(MUTED_REASON.telegram),
    `muammolar: ${JSON.stringify(issues)}`,
  );
});
await holat("Sheets: Vercel + SHEETS_SEND=on → jadval tayyor, faqat Telegram sababi qoladi", () => {
  setEnv({ VERCEL: "1", SHEETS_SEND: "on", ...SYNC });
  const cfg = loadSyncConfig();
  const issues = syncConfigIssues(cfg);
  return expect(
    isSheetsReady(cfg, "payment") && !issues.includes(MUTED_REASON.sheets) && issues.includes(MUTED_REASON.telegram),
    `tayyor=${isSheetsReady(cfg, "payment")}, muammolar ${JSON.stringify(issues)}`,
  );
});
await holat("Sheets: Telegram tayyorligi o'zgarmagan (tarmoq darajasida callTelegram to'sadi)", () => {
  setEnv({ VERCEL: "1", ...SYNC });
  return expect(isTelegramReady(loadSyncConfig(), "payment") === true, "isTelegramReady o'zgarib qolgan");
});
await holat("Sheets: Vercel'da sheetsFetch Google'ga chiqmaydi (token so'rovi ham yo'q)", async () => {
  setEnv({ VERCEL: "1", ...SYNC });
  let err = null;
  try {
    await readRows(loadSyncConfig(), "sheet-tolov", "To'lovlar");
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }
  return expect(err === MUTED_REASON.sheets && calls.length === 0, `xato=${JSON.stringify(err)}, so'rovlar ${hosts()}`);
});
await holat("Sheets: VPS'da readRows avvalgidek (token + o'qish)", async () => {
  setEnv({ ...SYNC });
  responder = (u) =>
    u.startsWith("https://oauth2.googleapis.com/token")
      ? reply({ access_token: "gtok", expires_in: 3600 })
      : reply({ values: [["1", "Ali"]] });
  const rows = await readRows(loadSyncConfig(), "sheet-tolov", "To'lovlar");
  const h = hosts();
  return expect(
    JSON.stringify(rows) === JSON.stringify([["1", "Ali"]]) && h[0] === "oauth2.googleapis.com/token" && h[1]?.startsWith("sheets.googleapis.com/"),
    `qatorlar ${JSON.stringify(rows)}, so'rovlar ${h}`,
  );
});
await holat("Sheets: token keshda bo'lsa ham Vercel'da chiqmaydi", async () => {
  setEnv({ VERCEL: "1", ...SYNC });
  let err = null;
  try {
    await readRows(loadSyncConfig(), "sheet-tolov", "To'lovlar");
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }
  return expect(err === MUTED_REASON.sheets && calls.length === 0, `xato=${JSON.stringify(err)}, so'rovlar ${hosts()}`);
});

let bad = 0;
for (const r of results) {
  if (!r.ok) bad++;
  console.log(`${r.ok ? "✓" : "✗"} ${r.title}${r.ok ? "" : `\n    → ${r.why}`}`);
}
console.log(bad ? `\n${bad} ta holat XATO (${results.length} tadan).` : `\nHammasi to'g'ri: ${results.length} ta holat.`);
process.exit(bad ? 1 : 0);
