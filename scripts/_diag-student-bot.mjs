// O'QUVCHILAR BOTI — diagnostika. FAQAT O'QIYDI, hech narsa yozmaydi va
// Telegramga xabar YUBORMAYDI.
//
// Ishga tushirish:
//   node --import ./scripts/_ts-alias.mjs scripts/_diag-student-bot.mjs
//   node --import ./scripts/_ts-alias.mjs scripts/_diag-student-bot.mjs 941118855
//   node --import ./scripts/_ts-alias.mjs scripts/_diag-student-bot.mjs --pupil 1234
//
// Nima qiladi:
//   1) sozlamalardagi kamchiliklarni sanaydi (maxfiy qiymatlarsiz);
//   2) bot tirikmi va webhook o'rnatilganmi — tekshiradi;
//   3) xush kelibsiz ekranini (ism bor/yo'q holatlari) chizib beradi;
//   4) berilgan telefon bo'yicha o'quvchi topiladimi — bazadan sinaydi;
//   5) topilgan o'quvchi uchun BOTNING HAR BIR EKRANINI chizib beradi.
//
// (5) eng muhimi: botni Telegramga ulashdan OLDIN o'quvchi nima
// ko'rishini aynan shu yerda ko'rish mumkin.
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

const { loadStudentBotConfig, studentBotIssues, isStudentBotReady } = await import("@/lib/studentBot/config");
const { findPupilsByPhone, phoneKey, formatPhone } = await import("@/lib/studentBot/phone");
const D = await import("@/lib/studentBot/data");
const V = await import("@/lib/studentBot/views");
const { premiumEmojiIds } = await import("@/lib/studentBot/premiumEmoji");
const { getDb } = await import("@/lib/mongodb");

const argv = process.argv.slice(2);
const pupilFlag = argv.indexOf("--pupil");
const wantPupilId = pupilFlag >= 0 ? Number(argv[pupilFlag + 1]) : null;
const phoneArg = argv.find((a) => !a.startsWith("--") && a !== String(wantPupilId));

const line = (s = "") => console.log(s);
const rule = (t) => line(`\n${"─".repeat(4)} ${t} ${"─".repeat(Math.max(0, 60 - t.length))}`);

// ── 1. Sozlamalar ───────────────────────────────────────────────────
rule("SOZLAMALAR");
const cfg = loadStudentBotConfig();
const issues = studentBotIssues(cfg);
if (issues.length === 0) line("  Hammasi joyida.");
for (const i of issues) line(`  • ${i}`);
line(`  Bot yozishga tayyor: ${isStudentBotReady(cfg) ? "HA" : "YO'Q"}`);
const premiumIds = premiumEmojiIds();
const premiumSlots = Object.keys(premiumIds);
line(
  premiumSlots.length > 0
    ? `  Premium emoji: ${premiumSlots.join(", ")} (${premiumSlots.length} ta)`
    : "  Premium emoji: sozlanmagan — oddiy emoji ishlatiladi",
);

// ── 2. Telegram ─────────────────────────────────────────────────────
rule("TELEGRAM");
if (!cfg.token) {
  line("  Token yo'q — o'tkazib yuborildi.");
} else {
  const call = async (m) => (await fetch(`https://api.telegram.org/bot${cfg.token}/${m}`)).json();
  const me = await call("getMe");
  line(`  bot: ${me.ok ? `@${me.result.username}` : `XATO — ${me.description}`}`);
  // Maxsus emoji ID'lari hali tirikmi. O'lgan ID butun xabarni
  // yiqitadi (bot oddiy emojiga qaytadi, lekin buni bilgan ma'qul).
  if (premiumSlots.length > 0) {
    const ids = Object.values(premiumIds);
    const r = await fetch(`https://api.telegram.org/bot${cfg.token}/getCustomEmojiStickers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ custom_emoji_ids: ids }),
    }).then((x) => x.json());
    if (!r.ok) {
      line(`  maxsus emoji: TEKSHIRIB BO'LMADI — ${r.description}`);
    } else {
      const alive = new Set(r.result.map((x) => x.custom_emoji_id));
      const dead = Object.entries(premiumIds).filter(([, id]) => !alive.has(id)).map(([k]) => k);
      line(`  maxsus emoji: ${ids.length - dead.length}/${ids.length} tirik${dead.length ? ` — O'LGAN: ${dead.join(", ")}` : ""}`);
    }
  }
  const wh = await call("getWebhookInfo");
  if (wh.ok) {
    line(`  webhook: ${wh.result.url || "(o'rnatilmagan)"}`);
    line(`  navbat: ${wh.result.pending_update_count ?? 0}`);
    if (wh.result.last_error_message) line(`  OXIRGI XATO: ${wh.result.last_error_message}`);
    if (Array.isArray(wh.result.allowed_updates)) {
      line(`  qabul qilinadi: ${wh.result.allowed_updates.join(", ")}`);
      if (!wh.result.allowed_updates.includes("message")) {
        line("  ⚠️  `message` YO'Q — telefon raqami kelmaydi, bot ishlamaydi.");
      }
    }
  }
}

// ── 2b. Xush kelibsiz ekrani ────────────────────────────────────────
// Bog'lanmagan odam ko'radigan BIRINCHI ekran. Bazaga bog'liq emas,
// shuning uchun o'quvchi ko'rsatilmaganda ham chiziladi.
rule("XUSH KELIBSIZ (/start)");
for (const [label, nick] of [
  ["oddiy ism", "Ali Valiyev"],
  ["35 belgidan uzun ism -> username", "@uzun_odam"],
  ["ism ham, username ham yo'q", ""],
]) {
  line(`\n  [${label}]`);
  line(V.startPrompt(nick).split("\n").map((l) => `    ${l}`).join("\n"));
}

// ── 3. Telefon bo'yicha qidiruv ─────────────────────────────────────
const db = await getDb();
let pupilId = wantPupilId;

if (phoneArg) {
  rule("TELEFON BO'YICHA QIDIRUV");
  const key = phoneKey(phoneArg);
  line(`  kiritilgan: ${phoneArg}   kalit: ${key ?? "(yaroqsiz — 9 raqamdan kam)"}`);
  if (key) {
    const t0 = Date.now();
    const matches = await findPupilsByPhone(db, key);
    line(`  topildi: ${matches.length} ta   (${Date.now() - t0} ms)`);
    for (const m of matches) {
      const p = await D.loadPupil(db, m.pupilId);
      line(`   • #${m.pupilId}  ${p ? `${p.firstName} ${p.lastName}` : "(topilmadi)"}  — ${m.role === "parent" ? "ota-ona raqami" : "o'z raqami"}`);
    }
    if (matches.length > 0 && pupilId === null) pupilId = matches[0].pupilId;
  }
}

// ── 4. Ekranlar ─────────────────────────────────────────────────────
if (pupilId === null || !Number.isFinite(pupilId)) {
  rule("EKRANLAR");
  line("  O'quvchi ko'rsatilmagan. Telefon raqamini yoki --pupil <id> ni bering.");
} else {
  const pupil = await D.loadPupil(db, pupilId);
  if (!pupil) {
    rule("EKRANLAR");
    line(`  #${pupilId} raqamli o'quvchi topilmadi.`);
  } else {
    const [branch, groups, payments, exams, news, months] = await Promise.all([
      D.branchName(db, pupil.branchId),
      D.loadGroups(db, pupil.id),
      D.loadPayments(db, pupil),
      D.loadExams(db, pupil),
      D.loadNews(db),
      D.attendanceMonths(db, pupil.id),
    ]);
    const allMarks = await D.loadAttendance(db, pupil.id);
    const lastMonth = months[months.length - 1] ?? "";
    const monthMarks = lastMonth ? allMarks.filter((m) => m.date.startsWith(lastMonth)) : [];
    const tasks = await D.loadTasks(db, groups.map((g) => g.id));

    // HTML teglari terminalda o'qishga xalaqit beradi — olib tashlanadi.
    // Bu FAQAT ko'rsatish uchun; Telegramga to'liq matn ketadi.
    const plain = (s) => s.replace(/<[^>]+>/g, "");
    const show = (title, html) => {
      rule(title);
      line(plain(html).split("\n").map((l) => `  ${l}`).join("\n"));
    };

    line(`\nO'quvchi: #${pupil.id} ${pupil.firstName} ${pupil.lastName}`);
    line(`Telefon: ${formatPhone(pupil.phone)}   ota: ${formatPhone(pupil.fatherPhone)}   ona: ${formatPhone(pupil.motherPhone)}`);
    line(`Guruhlar: ${groups.length}   davomat belgilari: ${allMarks.length}   oylar: ${months.join(", ") || "-"}`);

    show("ASOSIY MENYU", V.homeView(pupil, {
      branch,
      groups,
      paid: payments.liveTotal + payments.archiveTotal,
      role: "student",
    }));
    // Belgi yo'q bo'lsa — joriy oy (bot ham shunday qiladi).
    const shownMonth = lastMonth || new Date().toISOString().slice(0, 7);
    show("DAVOMAT", V.attendanceView(pupil, monthMarks, shownMonth));
    show("TO'LOVLAR", V.paymentsView(pupil, payments));
    show("DARS JADVALI", V.scheduleView(pupil, groups, D.nextLesson(groups)));
    show("BAHOLAR", V.gradesView(pupil, allMarks));
    show("IMTIHONLAR", V.examsView(pupil, exams));
    show("TOPSHIRIQLAR", V.tasksView(pupil, tasks));
    show("KOINLAR", V.coinsView(pupil));
    show("YANGILIKLAR", V.newsView(news));
  }
}

// ── 5. Ulanganlar ───────────────────────────────────────────────────
rule("BOTGA ULANGANLAR");
const linked = await db.collection("student_bot_users").countDocuments();
const blocked = await db.collection("student_bot_users").countDocuments({ blocked: true });
line(`  jami: ${linked}   bloklagan: ${blocked}`);

process.exit(0);
