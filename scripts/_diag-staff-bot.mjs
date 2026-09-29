// XODIMLAR BOTI (kassa) — diagnostika. Telegram'ga XABAR YUBORMAYDI:
// `api.telegram.org` ga ketadigan har bir so'rov ushlab qolinib
// terminalga chiziladi. Bazaga faqat `staff_bot_users` (soxta chat)
// yoziladi va oxirida o'chiriladi. TO'LOV YOZILMAYDI — faqat `--apply`
// bilan (pastga qarang).
//
// Ishga tushirish:
//   node --experimental-transform-types --import ./scripts/_ts-alias.mjs scripts/_diag-staff-bot.mjs --as 998941558855
//       — parolsiz, o'sha hisob nomidan kirgan deb hisoblanadi (FAQAT SINOV:
//         `staff_bot_users` ga to'g'ridan-to'g'ri yoziladi, CRM parolga tegmaydi)
//   node --experimental-transform-types --import ./scripts/_ts-alias.mjs scripts/_diag-staff-bot.mjs --phone 998941558855 --password '…'
//       — haqiqiy kirish oqimi (telefon → parol), bcrypt bilan
//   qo'shimcha:  --student Odina     (qidiruv matni, sukut "a")
//                --amount 320000     ("max" — chiqimda "Hammasi" tugmasi)
//                --flow chiqim --type "Avans" --person Nilufar --method Naqd
//                                    (chiqim oqimi: tur nomi, kim, to'lov turi)
//                --flow transfer | methods | inbox | lead
//                                    (boshqa kassaga / turlar orasida / kelayotganlar / lid)
//                --apply             (tasdiqni ham bosadi — PUL YOZILADI, Sheets/guruhga
//                                     navbat tushadi; lokal .env prod kalitlariga
//                                     qarasa HAQIQIY guruhga xabar ketadi!)
//                --keep              (oxirida soxta chatni o'chirmaydi)
//
// `--experimental-transform-types` SHART: lib/sync/dispatch.ts da TS
// "parameter property" (constructor(private cfg)) bor, Node'ning oddiy
// strip rejimi uni tushunmaydi.
//
// Nima ko'rsatadi: sozlama, webhook holati (allowed_updates da `message`
// bormi), so'ng butun suhbat: /start → telefon → parol → menyu → Kassam →
// Bugungi yozuvlar → Kirim (tur → o'quvchi → summa → to'lov turi → oy →
// izoh → tasdiq kartasi).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(HERE, "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const i = s.indexOf("=");
    if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
  }
}

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const has = (name) => argv.includes(name);
const AS = opt("--as");
const PHONE = opt("--phone") ?? AS;
const PASSWORD = opt("--password");
const STUDENT = opt("--student") ?? "a";
const AMOUNT = opt("--amount") ?? "320000";
const FLOW = opt("--flow") ?? "kirim"; // kirim | chiqim
const TYPE_NAME = opt("--type") ?? "Avans";
const PERSON = opt("--person") ?? "Nilufar";
const METHOD = opt("--method") ?? "Naqd";
const APPLY = has("--apply");
const KEEP = has("--keep");

const line = (s = "") => console.log(s);
const rule = (t) => line(`\n${"─".repeat(4)} ${t} ${"─".repeat(Math.max(0, 60 - t.length))}`);

// ── Telegram transportini ushlab qolish ──────────────────────────────
// lib/telegramApi.ts `fetch` bilan ishlaydi — uni almashtirsak bot
// haqiqatan yozganini ko'ramiz, lekin hech narsa ketmaydi.
const realFetch = globalThis.fetch;
let nextMsgId = 1000;
let lastKeyboard = [];
const strip = (html) => String(html ?? "").replace(/<[^>]+>/g, "");
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (!u.includes("api.telegram.org")) return realFetch(url, init);
  const method = u.split("/").pop();
  const body = init?.body ? JSON.parse(init.body) : {};
  if (method === "sendMessage" || method === "editMessageText") {
    if (body.text !== "⌛") {
      line(`\n  ┌─ bot ${method === "sendMessage" ? "yubordi" : "tahrirladi"} ${"─".repeat(38)}`);
      for (const l of strip(body.text).split("\n")) line(`  │ ${l}`);
      const kb = body.reply_markup?.inline_keyboard;
      if (kb) {
        lastKeyboard = kb;
        for (const row of kb) line(`  │   ${row.map((b) => `[${b.text}]`).join("  ")}`);
      }
      if (body.reply_markup?.keyboard) {
        line(`  │   (oddiy klaviatura) ${body.reply_markup.keyboard.flat().map((b) => `[${b.text}]`).join(" ")}`);
      }
      line(`  └${"─".repeat(50)}`);
    }
  } else if (method === "deleteMessage") {
    line(`  (bot xabar #${body.message_id} ni o'chirdi)`);
  } else if (method === "answerCallbackQuery" && body.text) {
    line(`  (tugma javobi: ${body.text})`);
  }
  const result = method === "sendMessage"
    ? { message_id: ++nextMsgId }
    : method === "editMessageText"
      ? { message_id: body.message_id }
      : true;
  return new Response(JSON.stringify({ ok: true, result }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

const { loadStaffBotConfig, isStaffBotReady } = await import("@/lib/staffBot/config");
const { handleStaffUpdate } = await import("@/lib/staffBot/router");
const { completeLogin, getStaffUser, logoutStaff, STAFF_BOT_USERS } = await import("@/lib/staffBot/session");
const { STAFF_BOT_ATTEMPTS } = await import("@/lib/staffBot/attempts");
const { getDb } = await import("@/lib/mongodb");

// ── 1. Sozlamalar ───────────────────────────────────────────────────
rule("SOZLAMALAR");
const cfg = loadStaffBotConfig();
// 29.09.2026 dan xodimlar @tizimli_akademiya_bot da (lib/staffBot/config.ts).
line(`  TELEGRAM_STUDENT_BOT_TOKEN:       ${cfg.token ? "bor" : "YO'Q"}`);
line(`  TELEGRAM_STUDENT_WEBHOOK_SECRET:  ${(process.env.TELEGRAM_STUDENT_WEBHOOK_SECRET || "").trim() ? "bor" : "YO'Q"}`);
line(`  Bot tayyor: ${isStaffBotReady(cfg) ? "HA" : "YO'Q"}`);

// ── 2. Webhook holati (haqiqiy so'rov — faqat o'qiydi) ──────────────
rule("WEBHOOK");
if (cfg.token) {
  const r = await realFetch(`https://api.telegram.org/bot${cfg.token}/getWebhookInfo`).then((x) => x.json());
  if (r.ok) {
    const w = r.result;
    line(`  manzil:         ${w.url || "(o'rnatilmagan)"}`);
    line(`  qabul qilinadi: ${Array.isArray(w.allowed_updates) ? w.allowed_updates.join(", ") : "(hammasi)"}`);
    const hasMsg = !Array.isArray(w.allowed_updates) || w.allowed_updates.includes("message");
    line(`  message keladi: ${hasMsg ? "HA" : "YO'Q — `node scripts/set-telegram-webhook.mjs` ni qayta yurgizing"}`);
    if (w.last_error_message) line(`  OXIRGI XATO:    ${w.last_error_message}`);
    line(`  navbatda:       ${w.pending_update_count ?? 0}`);
  } else {
    line(`  getWebhookInfo xato: ${r.description}`);
  }
} else {
  line("  Token yo'q — o'tkazib yuborildi.");
}

if (!PHONE) {
  line("\n--as <telefon> yoki --phone <telefon> --password <parol> bering.");
  process.exit(0);
}

// ── 3. Suhbat ───────────────────────────────────────────────────────
const db = await getDb();
const CHAT = 990_000_001; // soxta chat — haqiqiy Telegram id'lar bilan to'qnashmaydi
const FROM = { id: CHAT, first_name: "Diag", last_name: "Sinov", username: "diag_sinov" };
const deferred = [];
const defer = (fn) => deferred.push(fn);
let msgNo = 1;

const msg = async (text, extra = {}) => {
  line(`\n  ➜ kassir: ${text ?? "(kontakt)"}`);
  await handleStaffUpdate(db, cfg, {
    message: { message_id: msgNo++, from: FROM, chat: { id: CHAT, type: "private" }, text, ...extra },
  }, defer);
};
const cb = async (data) => {
  const u = await getStaffUser(db, CHAT);
  line(`\n  ➜ tugma: ${data}`);
  await handleStaffUpdate(db, cfg, {
    callback_query: {
      id: `cq${msgNo++}`,
      data,
      from: FROM,
      message: { message_id: u?.menuMessageId ?? nextMsgId, chat: { id: CHAT, type: "private" } },
    },
  }, defer);
};
/** Oxirgi klaviaturadan `prefix` bilan boshlanadigan birinchi tugma. */
const pick = (prefix) => lastKeyboard.flat().find((b) => String(b.callback_data ?? "").startsWith(prefix))?.callback_data ?? null;

await logoutStaff(db, CHAT);

rule("KIRISH");
await msg("/start");
if (PASSWORD) {
  await msg(undefined, { contact: { phone_number: `+${PHONE}`, user_id: CHAT } });
  await msg(PASSWORD);
} else {
  // --as: parolsiz — hisobni topib to'g'ridan-to'g'ri "kirgan" holatga o'tkazamiz.
  const u = await db.collection("users").findOne({ phone: PHONE }, { projection: { hrEmployeeId: 1, role: 1 } });
  if (!u) {
    line(`  users da ${PHONE} topilmadi`);
    process.exit(1);
  }
  const { employeeNameById } = await import("@/lib/currentEmployee");
  const empId = Number.isFinite(Number(u.hrEmployeeId)) ? Number(u.hrEmployeeId) : null;
  await completeLogin(db, CHAT, {
    userId: u._id.toString(),
    employeeId: empId,
    name: await employeeNameById(db, empId),
    isAdmin: u.role === "admin",
    phone: PHONE,
  });
  line(`  (--as: ${PHONE} nomidan kirgan deb belgilandi, parol tekshirilmadi)`);
  await msg("/start");
}

const logged = await getStaffUser(db, CHAT);
if (logged?.stage !== "in") {
  line("\n  Kirish bo'lmadi — yuqoridagi xabarga qarang.");
  if (!KEEP) await db.collection(STAFF_BOT_USERS).deleteOne({ chatId: CHAT });
  process.exit(1);
}

/** Tasdiq: faqat --apply bilan bosiladi. */
const confirmOrStop = async (prefix) => {
  const confirmCb = pick(prefix);
  if (confirmCb && APPLY) {
    rule("TASDIQ (--apply)");
    await cb(confirmCb);
    line(`  kechiktirilgan ishlar: ${deferred.length} ta — yurgizilmoqda (flushSoon, xabarlar)…`);
    for (const fn of deferred) await fn();
  } else if (confirmCb) {
    line("\n  Tasdiq BOSILMADI (--apply berilmagan) — pul yozilmadi.");
  }
};

if (FLOW === "kirim") {
  rule("KASSAM");
  await cb("s:kassam");
  await cb("s:today");

  rule("KIRIM");
  await cb("s:kirim");
  const typeCb = pick("s:k:t:");
  if (!typeCb) {
    line("  Kirim turi tugmasi chiqmadi — yuqoridagi xabarga qarang (kassa/ruxsat).");
  } else {
    await cb(typeCb);
    const stepUser = await getStaffUser(db, CHAT);
    if (stepUser?.draft?.step === "student") {
      await msg(STUDENT);
      const studentCb = pick("s:k:s:");
      if (!studentCb) line("  O'quvchi topilmadi — --student bilan boshqa matn bering.");
      else await cb(studentCb);
    }
    await msg(AMOUNT);
    const methodCb = pick("s:k:m:");
    if (methodCb) await cb(methodCb);
    const monthCb = lastKeyboard.flat().find((b) => /^s:k:p:/.test(b.callback_data ?? "") && b.text.startsWith("•"))?.callback_data;
    if (monthCb) await cb(monthCb);
    const noteCb = pick("s:k:n:");
    if (noteCb) await cb(noteCb);
    await confirmOrStop("s:k:ok:");
  }
} else if (FLOW === "lead") {
  // --flow lead: o'quvchi (--student), birinchi kurs, toq kunlar, izohsiz → tasdiq kartasi.
  rule("LID QO'SHISH");
  await cb("s:lead");
  await msg(STUDENT);
  const st = pick("s:l:s:");
  if (!st) {
    line("  O'quvchi topilmadi — --student bilan boshqa matn bering.");
  } else {
    await cb(st);
    const course = pick("s:l:c:");
    if (course) await cb(course);
    await cb("s:l:d:toq");
    await cb("s:l:n:0");
    await confirmOrStop("s:l:ok:");
  }
} else if (FLOW === "transfer" || FLOW === "inbox" || FLOW === "methods") {
  // --flow transfer: boshqa kassaga (birinchi kassa, --method, --amount);
  // --flow methods: turlar orasida; --flow inbox: kelayotganlar + ✓ so'rovi.
  rule(`KO'CHIRISH (${FLOW})`);
  await cb("s:transfer");
  if (FLOW === "inbox") {
    await cb("s:t:inbox");
    const acc = pick("s:t:acc:");
    if (acc) {
      await cb(acc); // "rostdan ham?" ekrani — 2-bosish (acc2) faqat --apply bilan
      const sure = pick("s:t:acc2:");
      if (sure && APPLY) {
        rule("QABUL (--apply)");
        await cb(sure);
        for (const fn of deferred) await fn();
      } else if (sure) {
        line("\n  Qabul BOSILMADI (--apply berilmagan) — pul ko'chmadi.");
      }
    } else {
      line("  Kelayotgan ko'chirma yo'q.");
    }
  } else {
    await cb(FLOW === "transfer" ? "s:t:to" : "s:t:in");
    if (FLOW === "transfer") {
      const dest = pick("s:t:d:");
      if (dest) await cb(dest);
    }
    const methodCb = lastKeyboard.flat().find((b) => String(b.callback_data ?? "").startsWith("s:t:m:") && b.text.startsWith(METHOD))?.callback_data
      ?? pick("s:t:m:");
    if (methodCb) await cb(methodCb);
    if (FLOW === "methods") {
      const toCb = lastKeyboard.flat().find((b) => String(b.callback_data ?? "").startsWith("s:t:m2:") && !b.text.startsWith(METHOD))?.callback_data
        ?? pick("s:t:m2:");
      if (toCb) await cb(toCb);
    }
    if (AMOUNT === "max") await cb("s:t:a:max");
    else await msg(AMOUNT);
    const noteCb = pick("s:t:n:");
    if (noteCb) await cb(noteCb);
    await confirmOrStop("s:t:go:");
  }
} else {
  // --flow chiqim: tur nomi --type bilan (sukut "Avans"), kim --person bilan.
  rule(`CHIQIM (${TYPE_NAME})`);
  await cb("s:chiqim");
  // Turni sahifalar bo'ylab qidiramiz.
  let typeCb = null;
  for (let guard = 0; guard < 6 && !typeCb; guard++) {
    typeCb = lastKeyboard.flat().find((b) => b.text === TYPE_NAME && String(b.callback_data ?? "").startsWith("s:c:t:"))?.callback_data ?? null;
    if (typeCb) break;
    const next = lastKeyboard.flat().find((b) => b.text.startsWith("Keyingi"))?.callback_data;
    if (!next) break;
    await cb(next);
  }
  if (!typeCb) {
    line(`  "${TYPE_NAME}" turi topilmadi — --type bilan aniq nom bering.`);
  } else {
    await cb(typeCb);
    const stepUser = await getStaffUser(db, CHAT);
    if (stepUser?.draft?.step === "person") {
      await msg(PERSON);
      const personCb = pick("s:c:e:") ?? pick("s:c:s:");
      if (!personCb) line("  Kim topilmadi — --person bilan boshqa matn bering.");
      else await cb(personCb);
    }
    const methodCb = lastKeyboard.flat().find((b) => String(b.callback_data ?? "").startsWith("s:c:m:") && b.text.startsWith(METHOD))?.callback_data
      ?? pick("s:c:m:");
    if (methodCb) await cb(methodCb);
    const afterMethod = await getStaffUser(db, CHAT);
    if (afterMethod?.draft?.step === "amount") {
      if (AMOUNT === "max") await cb("s:c:a:max");
      else await msg(AMOUNT);
    }
    const noteCb = pick("s:c:n:");
    if (noteCb) await cb(noteCb);
    await confirmOrStop("s:c:ok:");
  }
}

if (!KEEP) {
  await db.collection(STAFF_BOT_USERS).deleteOne({ chatId: CHAT });
  await db.collection(STAFF_BOT_ATTEMPTS).deleteOne({ chatId: CHAT });
  line("\n  Soxta chat o'chirildi.");
}
process.exit(0);
