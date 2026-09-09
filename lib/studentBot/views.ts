import type { AttendanceMark, AttendanceStatus } from "@/lib/attendance";
import type { Group } from "@/lib/groups";
import type { GroupTask } from "@/lib/groupTasks";
import { MONTHS, WEEKDAYS_FULL } from "@/lib/i18n";
import type { NewsItem } from "@/lib/news";
import { pupilFullName, pupilStatusOf, type Pupil } from "@/lib/pupilsData";
import { esc } from "@/lib/telegramApi";
import type { ExamsView, NextLesson, PaymentsView } from "@/lib/studentBot/data";
import { CONTACT_BUTTON } from "@/lib/studentBot/keyboards";
import { formatPhone } from "@/lib/studentBot/phone";
import { pe } from "@/lib/studentBot/premiumEmoji";
import type { StudentBotUser } from "@/lib/studentBot/users";

// O'quvchilar botining BARCHA MATNLARI. Telegram HTML rejimi
// (`parse_mode: "HTML"`), ya'ni faqat <b>, <i>, <code>, <a> ishlaydi —
// Markdown emas.
//
// TASHQARIDAN KELGAN HAR QANDAY MATN `esc()` DAN O'TADI: o'quvchi ismi,
// guruh nomi, topshiriq izohi, yangilik sarlavhasi. Ularning ichida "<"
// bo'lsa Telegram BUTUN xabarni rad etadi — ya'ni bitta g'alati belgi
// tufayli o'quvchi davomatini umuman ko'rmay qolardi.

/** "1 250 000" — ICU sozlamalariga bog'liq bo'lmagan guruhlash. */
export function fmtUZS(n: number): string {
  const sign = n < 0 ? "-" : "";
  const digits = String(Math.round(Math.abs(n)));
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += " ";
    out += digits[i];
  }
  return `${sign}${out}`;
}

/** "2026-09" -> "Sentyabr 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  const idx = Number(m) - 1;
  return idx >= 0 && idx < 12 ? `${MONTHS.uz[idx]} ${y}` : month;
}

/** "2026-09-03" -> "03.09.2026". */
function dmy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

/** "2026-09-03" -> "03.09". */
function dm(iso: string): string {
  const [, m, d] = iso.split("-");
  return m && d ? `${d}.${m}` : iso;
}

/**
 * `Date.getDay()` (0=Yakshanba) -> "Chorshanba".
 *
 * `WEEKDAYS_FULL` DUSHANBADAN boshlanadi, `getDay()` esa yakshanbadan —
 * shuning uchun siljitish kerak. Bu ikki massivning tartibi lib/i18n.ts
 * da ataylab boshqacha va aralashtirilsa kun bir pog'ona surilib ketadi.
 */
function weekdayName(jsDay: number): string {
  return WEEKDAYS_FULL.uz[(jsDay + 6) % 7] ?? "";
}

const STATUS_EMOJI: Record<AttendanceStatus, string> = {
  keldi: "✅",
  birinchi: "🟡",
  sababli: "🔵",
  sababsiz: "❌",
};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  keldi: "Keldi",
  birinchi: "Birinchi dars",
  sababli: "Sababli",
  sababsiz: "Sababsiz",
};

/** Bo'lim sarlavhasi ostidagi "kim haqida" qatori — har bir ekranda takrorlanadi. */
function whoLine(pupil: Pupil): string {
  return `<i>${esc(pupilFullName(pupil))}</i>`;
}

// ── Bog'lanish oqimi ────────────────────────────────────────────────

/**
 * Xush kelibsiz ekrani — bog'lanmagan odam ko'radigan YAGONA matn.
 *
 * `nick` — Telegramdagi ismi (router.ts dagi `greetName` tayyorlaydi).
 * Bo'sh bo'lsa salom ISMSIZ beriladi: "Assalomu alaykum !" degan
 * osilib qolgan qator ismi yo'q odamga g'alati ko'rinardi.
 */
export function startPrompt(nick = ""): string {
  const hello = nick ? `Assalomu alaykum ${esc(nick)}!` : "Assalomu alaykum!";
  return [
    `${pe("wave")} <b>${hello}</b>`,
    "",
    "Akademiya o'quv markazining rasmiy botiga xush kelibsiz!",
    "",
    "Bu yerda o'quv jarayoningizga oid barcha muhim ma'lumotlarni bir joyda ko'rishingiz mumkin:",
    "",
    `${pe("calendar")} Dars jadvali`,
    `${pe("card")} To'lovlar`,
    `${pe("chart")} Natijalar va baholar`,
    `${pe("memo")} Topshiriqlar`,
    "",
    `Boshlash uchun telefon raqamingizni tasdiqlang ${pe("point")}`,
    "",
    `Pastdagi "${CONTACT_BUTTON}" tugmasini bosing. Raqamni qo'lda yozish shart emas.`,
    "",
    `${pe("lock")} <i>Raqamingiz bazadagi o'quvchi yoki ota-ona ma'lumotlari bilan tekshiriladi.</i>`,
  ].join("\n");
}

export function phoneNotFound(phone: string): string {
  return [
    "🔍 <b>Bu raqam bazada topilmadi</b>",
    "",
    `Yuborilgan raqam: <code>${esc(formatPhone(phone))}</code>`,
    "",
    "Sabablari:",
    "• raqam CRM'da boshqacha yozilgan bo'lishi mumkin;",
    "• o'quvchi hali ro'yxatga olinmagan bo'lishi mumkin.",
    "",
    "Iltimos, o'quv markaziga murojaat qiling — raqamingizni yangilashsin.",
    "So'ng /start ni qayta bosing.",
  ].join("\n");
}

export function foreignContact(): string {
  return [
    "⚠️ <b>Bu sizning raqamingiz emas</b>",
    "",
    "Boshqa odamning kontakti yuborildi. Faqat <b>o'z</b> raqamingizni",
    "yuborishingiz mumkin — pastdagi tugmani bosing.",
  ].join("\n");
}

// ── Asosiy menyu ────────────────────────────────────────────────────

export function homeView(
  pupil: Pupil,
  opts: { branch: string; groups: Group[]; paid: number; role: "student" | "parent" },
): string {
  const groupNames = opts.groups.map((g) => g.name || String(g.id));
  const lines = [
    `👤 <b>${esc(pupilFullName(pupil))}</b>`,
  ];
  if (opts.role === "parent") lines.push("<i>Ota-ona sifatida ko'rilmoqda</i>");
  lines.push("");

  if (opts.branch) lines.push(`🏫 Filial: ${esc(opts.branch)}`);
  if (groupNames.length > 0) lines.push(`👥 Guruh: ${esc(groupNames.join(", "))}`);
  const status = pupilStatusOf(pupil);
  if (status !== "Aktiv") lines.push(`⏸ Holat: <b>${esc(status)}</b>`);
  lines.push(`💰 Jami to'langan: <b>${fmtUZS(opts.paid)} so'm</b>`);
  lines.push("");
  lines.push("Kerakli bo'limni tanlang:");
  return lines.join("\n");
}

// ── Davomat ─────────────────────────────────────────────────────────

export function attendanceView(pupil: Pupil, marks: AttendanceMark[], month: string): string {
  const lines = [`📋 <b>Davomat — ${esc(monthLabel(month))}</b>`, whoLine(pupil), ""];

  if (marks.length === 0) {
    lines.push("Bu oyda davomat belgilanmagan.");
    return lines.join("\n");
  }

  const count: Record<AttendanceStatus, number> = { keldi: 0, birinchi: 0, sababli: 0, sababsiz: 0 };
  for (const m of marks) count[m.status] = (count[m.status] ?? 0) + 1;

  // O'zlashtirish — "keldi" + "birinchi dars" HOZIR BO'LGAN darslar
  // hisoblanadi. "Sababli" ham qoldirilgan dars: uni maxrajdan chiqarib
  // yuborish foizni sun'iy ravishda ko'tarardi.
  const present = count.keldi + count.birinchi;
  const pct = marks.length > 0 ? Math.round((present / marks.length) * 100) : 0;

  lines.push(
    `Darslar: <b>${marks.length}</b>  •  ✅ ${count.keldi}  ❌ ${count.sababsiz}  🔵 ${count.sababli}  🟡 ${count.birinchi}`,
  );
  lines.push(`Qatnashish: <b>${pct}%</b>`);
  lines.push("");

  for (const m of marks) {
    const grade = m.grade ? `  •  baho <b>${m.grade}</b>` : "";
    const reason = m.status === "sababli" && m.reason ? `  <i>(${esc(m.reason)})</i>` : "";
    lines.push(`${dm(m.date)}  ${STATUS_EMOJI[m.status]} ${STATUS_LABEL[m.status]}${grade}${reason}`);
  }
  return lines.join("\n");
}

// ── To'lovlar ───────────────────────────────────────────────────────

export function paymentsView(pupil: Pupil, view: PaymentsView): string {
  const lines = ["💳 <b>To'lovlar</b>", whoLine(pupil), ""];

  if (view.rows.length === 0) {
    lines.push("To'lov yozuvi topilmadi.");
    lines.push("");
    lines.push("<i>Agar to'lov qilgan bo'lsangiz, o'quv markaziga murojaat qiling.</i>");
    return lines.join("\n");
  }

  lines.push(`Jami to'langan: <b>${fmtUZS(view.liveTotal + view.archiveTotal)} so'm</b>`);
  if (view.archiveTotal > 0 && view.liveTotal > 0) {
    lines.push(`<i>shundan arxiv (eski tizim): ${fmtUZS(view.archiveTotal)} so'm</i>`);
  }
  lines.push("");

  for (const r of view.rows) {
    const tail = [r.method && esc(r.method), r.archive && "arxiv", r.cancelled && "BEKOR QILINGAN"]
      .filter(Boolean)
      .join(", ");
    const amount = r.cancelled ? `<s>${fmtUZS(r.amount)}</s>` : `<b>${fmtUZS(r.amount)}</b>`;
    lines.push(`${dmy(r.date)}  ${amount} so'm${tail ? `  <i>(${tail})</i>` : ""}`);
  }
  // `totalCount` — bazadagi HAMMA yozuv, `rows` esa kesilgan ro'yxat.
  if (view.totalCount > view.rows.length) {
    lines.push("");
    lines.push(
      `<i>… va yana ${view.totalCount - view.rows.length} ta yozuv. To'liq tarix uchun markazga murojaat qiling.</i>`,
    );
  }

  lines.push("");
  lines.push("<i>Bu — to'langan pul yig'indisi. Qarzdorlik tizimda yuritilmaydi.</i>");
  return lines.join("\n");
}

// ── Dars jadvali ────────────────────────────────────────────────────

export function scheduleView(pupil: Pupil, groups: Group[], next: NextLesson | null): string {
  const lines = ["🗓 <b>Dars jadvali</b>", whoLine(pupil), ""];

  if (groups.length === 0) {
    lines.push("Siz hech qaysi guruhga biriktirilmagansiz.");
    return lines.join("\n");
  }

  for (const g of groups) {
    lines.push(`<b>${esc(g.name || String(g.id))}</b>`);
    if (g.course) lines.push(`  Kurs: ${esc(g.course)}${g.level ? ` (${esc(g.level)})` : ""}`);
    if (g.teacher) lines.push(`  Ustoz: ${esc(g.teacher)}`);
    if (g.day) lines.push(`  Kunlar: ${esc(g.day)}`);
    if (g.time) lines.push(`  Vaqt: <b>${esc(g.time)}</b>`);
    if (g.room) lines.push(`  Xona: ${esc(g.room)}`);
    lines.push("");
  }

  if (next) {
    const when =
      next.inDays === 0 ? "bugun" : next.inDays === 1 ? "ertaga" : `${next.inDays} kundan keyin`;
    lines.push(
      `⏰ Keyingi dars (jadval bo'yicha): <b>${dmy(next.iso)}</b>, ${weekdayName(next.weekday)}` +
        `${next.group.time ? `, ${esc(next.group.time)}` : ""} — ${when}`,
    );
    lines.push("");
    lines.push("<i>Jadval bo'yicha hisoblandi. Bayram yoki ko'chirilgan darslar bu yerda ko'rinmaydi.</i>");
  }
  return lines.join("\n");
}

// ── Baholar ─────────────────────────────────────────────────────────

export function gradesView(pupil: Pupil, marks: AttendanceMark[]): string {
  const graded = marks.filter((m) => typeof m.grade === "number" && m.grade !== null);
  const lines = ["⭐ <b>Baholar</b>", whoLine(pupil), ""];

  if (graded.length === 0) {
    lines.push("Hozircha baho qo'yilmagan.");
    return lines.join("\n");
  }

  const sum = graded.reduce((a, m) => a + (m.grade as number), 0);
  lines.push(`O'rtacha baho: <b>${(sum / graded.length).toFixed(1)}</b>  <i>(${graded.length} ta baho)</i>`);
  lines.push("");

  // Oy bo'yicha guruhlab ko'rsatiladi — uzun tekis ro'yxat o'qilmaydi.
  const byMonth = new Map<string, number[]>();
  for (const m of graded) {
    const key = m.date.slice(0, 7);
    const list = byMonth.get(key) ?? [];
    list.push(m.grade as number);
    byMonth.set(key, list);
  }

  for (const [month, list] of [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6)) {
    const avg = list.reduce((a, b) => a + b, 0) / list.length;
    lines.push(`${esc(monthLabel(month))}: ${list.join(", ")}  •  o'rtacha <b>${avg.toFixed(1)}</b>`);
  }
  return lines.join("\n");
}

// ── Imtihonlar ──────────────────────────────────────────────────────

export function examsView(pupil: Pupil, exams: ExamsView): string {
  const lines = ["🏆 <b>Imtihon natijalari</b>", whoLine(pupil), ""];

  if (exams.monthly.length === 0 && exams.uzbmb.length === 0) {
    lines.push("Imtihon natijasi topilmadi.");
    return lines.join("\n");
  }

  if (exams.monthly.length > 0) {
    lines.push("<b>Oylik imtihonlar</b>");
    for (const e of exams.monthly) {
      const level = e.level ? ` (${esc(e.level)})` : "";
      lines.push(
        `${esc(monthLabel(e.month))} — ${esc(e.subject)}${level}: <b>${e.correct}/${e.total}</b> (${e.pct}%)`,
      );
    }
    lines.push("");
  }

  if (exams.uzbmb.length > 0) {
    lines.push("<b>Milliy sertifikat / UZBMB</b>");
    for (const e of exams.uzbmb) {
      lines.push(
        `${esc(monthLabel(e.month))} — ${esc(e.b1s)} ${e.b1}, ${esc(e.b2s)} ${e.b2}, majburiy ${e.maj}` +
          `  •  jami <b>${e.total}</b>`,
      );
    }
  }
  return lines.join("\n");
}

// ── Topshiriqlar ────────────────────────────────────────────────────

export function tasksView(pupil: Pupil, tasks: GroupTask[]): string {
  const lines = ["📚 <b>Topshiriqlar</b>", whoLine(pupil), ""];

  if (tasks.length === 0) {
    lines.push("Hozircha topshiriq yo'q.");
    return lines.join("\n");
  }

  for (const t of tasks.slice(0, 12)) {
    lines.push(`• <b>${esc(t.name)}</b>${t.type ? ` <i>(${esc(t.type)})</i>` : ""}`);
    const meta: string[] = [];
    if (t.deadline) meta.push(`muddat: ${esc(t.deadline)}`);
    if (t.maxScore) meta.push(`maksimal ball: ${t.maxScore}`);
    if (t.groupName) meta.push(esc(t.groupName));
    if (meta.length > 0) lines.push(`  ${meta.join("  •  ")}`);
    if (t.note) lines.push(`  <i>${esc(t.note)}</i>`);
  }
  return lines.join("\n");
}

// ── Koinlar ─────────────────────────────────────────────────────────

export function coinsView(pupil: Pupil): string {
  return [
    "🪙 <b>Koinlar</b>",
    whoLine(pupil),
    "",
    `Sizda: <b>${fmtUZS(pupil.coin ?? 0)}</b> koin`,
    "",
    "<i>Koinlar faollik va yutuqlar uchun beriladi. Sarflash tartibi haqida ustozingizdan so'rang.</i>",
  ].join("\n");
}

// ── Yangiliklar ─────────────────────────────────────────────────────

export function newsView(items: NewsItem[]): string {
  const lines = ["📰 <b>Yangiliklar</b>", ""];
  if (items.length === 0) {
    lines.push("Hozircha yangilik yo'q.");
    return lines.join("\n");
  }
  for (const n of items) {
    lines.push(`<b>${esc(n.title)}</b>`);
    if (n.createdAt) lines.push(`<i>${esc(n.createdAt)}</i>`);
    if (n.content) lines.push(esc(n.content).slice(0, 400));
    lines.push("");
  }
  return lines.join("\n").trim();
}

// ── Sozlamalar va farzand tanlash ───────────────────────────────────

export function settingsView(user: StudentBotUser, pupilName: string): string {
  return [
    "⚙️ <b>Sozlamalar</b>",
    "",
    `Ko'rilayotgan o'quvchi: <b>${esc(pupilName)}</b>`,
    `Bog'langan raqam: <code>${esc(formatPhone(user.phone))}</code>`,
    `Ulangan: <i>${esc(user.linkedAt)}</i>`,
    "",
    "Avtomatik xabarlarni pastdagi tugmalar bilan yoqing yoki o'chiring.",
    "🔔 — yoqilgan, 🔕 — o'chirilgan.",
  ].join("\n");
}

/**
 * `first` — endigina bog'langan odam uchun. Unga "almashtirish" emas,
 * "tanlash" kerak, va sozlamalarda keyin ham o'zgartirsa bo'lishini
 * shu yerda aytib qo'yilmasa u buni topa olmasligi mumkin.
 */
export function kidsView(count = 0, first = false): string {
  if (first) {
    return [
      "👨‍👩‍👧 <b>Kimning ma'lumotini ko'rasiz?</b>",
      "",
      `Raqamingizga <b>${count}</b> ta o'quvchi bog'langan. Birini tanlang.`,
      "",
      "<i>Keyinroq ⚙️ Sozlamalar orqali istalgan vaqtda almashtirasiz.</i>",
    ].join("\n");
  }
  return [
    "👨‍👩‍👧 <b>Farzandni tanlang</b>",
    "",
    "Sizning raqamingizga bir nechta o'quvchi bog'langan.",
    "Tanlangan o'quvchining ma'lumotlari ko'rsatiladi.",
  ].join("\n");
}

export function logoutView(): string {
  return [
    "🚪 <b>Chiqishni tasdiqlang</b>",
    "",
    "Bog'lanish uziladi va bot sizning ma'lumotlaringizni ko'rsatmay qo'yadi.",
    "Qayta ulanish uchun /start bosib, raqamni qaytadan yuborasiz.",
  ].join("\n");
}

// ── Ustozga savol ───────────────────────────────────────────────────

export function askPrompt(): string {
  return [
    "✍️ <b>Savolingizni yozing</b>",
    "",
    "Keyingi yuborgan xabaringiz o'quv markazi xodimlariga yetkaziladi.",
    "Javob shu bot orqali emas, sizga qo'ng'iroq yoki xabar orqali keladi.",
    "",
    "<i>Faqat matn yuboring — rasm va fayl hozircha qabul qilinmaydi.</i>",
  ].join("\n");
}

export function askSent(): string {
  return "✅ Savolingiz yuborildi. Tez orada javob berishadi.";
}

/** Ichki guruhga tushadigan xabar — xodim kim so'raganini bilishi kerak. */
export function askForStaff(
  pupil: Pupil,
  opts: { branch: string; groups: Group[]; phone: string; text: string; from: string },
): string {
  const groupNames = opts.groups.map((g) => g.name || String(g.id)).join(", ");
  return [
    "✍️ <b>O'quvchidan savol</b>",
    "",
    `👤 ${esc(pupilFullName(pupil))} <i>(#${pupil.id})</i>`,
    opts.branch ? `🏫 ${esc(opts.branch)}` : "",
    groupNames ? `👥 ${esc(groupNames)}` : "",
    `📱 <code>${esc(formatPhone(opts.phone))}</code>`,
    opts.from ? `✈️ Telegram: ${esc(opts.from)}` : "",
    "",
    `<b>Savol:</b>`,
    esc(opts.text),
  ]
    .filter((l) => l !== "")
    .join("\n");
}

// ── Avtomatik xabarlar ──────────────────────────────────────────────

export function attendancePush(
  pupil: Pupil,
  opts: { date: string; status: AttendanceStatus; grade: number | null; reason: string | null; groupName: string },
): string {
  const lines = [
    `${STATUS_EMOJI[opts.status]} <b>Davomat: ${STATUS_LABEL[opts.status]}</b>`,
    "",
    `👤 ${esc(pupilFullName(pupil))}`,
    `📅 ${dmy(opts.date)}`,
  ];
  if (opts.groupName) lines.push(`👥 ${esc(opts.groupName)}`);
  if (opts.grade) lines.push(`⭐ Baho: <b>${opts.grade}</b>`);
  if (opts.status === "sababli" && opts.reason) lines.push(`📝 Sabab: ${esc(opts.reason)}`);
  return lines.join("\n");
}

export function paymentPush(
  pupil: Pupil,
  opts: { amount: number; method: string; date: string },
): string {
  const lines = [
    "💳 <b>To'lov qabul qilindi</b>",
    "",
    `👤 ${esc(pupilFullName(pupil))}`,
    `💰 Summa: <b>${fmtUZS(opts.amount)} so'm</b>`,
    `📅 ${dmy(opts.date)}`,
  ];
  if (opts.method) lines.push(`💼 To'lov turi: ${esc(opts.method)}`);
  lines.push("");
  lines.push("<i>Rahmat! Batafsil tarixni botdagi \"To'lovlar\" bo'limida ko'rasiz.</i>");
  return lines.join("\n");
}
