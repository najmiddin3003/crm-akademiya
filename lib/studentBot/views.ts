import type { AttendanceMark, AttendanceStatus } from "@/lib/attendance";
import { groupLabel, type Group } from "@/lib/groups";
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
  kechikdi: "🟠",
  birinchi: "🟡",
  sababli: "🔵",
  sababsiz: "❌",
};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  keldi: "Keldi",
  kechikdi: "Kechikdi",
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
    `Pastdagi "${CONTACT_BUTTON}" tugmasini bosing — eng oson yo'li shu.`,
    "",
    "Yoki raqamingizni shu yerga yozing — qanday yozsangiz ham bo'ladi:",
    "<code>90 123 45 67</code>, <code>90-123-45-67</code>, <code>+998901234567</code>.",
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

/**
 * Qorovul to'xtatganda. SABAB ROSTINI AYTADI va nima qilishni
 * ko'rsatadi: "raqam topilmadi" deyilsa odam CRM'ga borib bekorga
 * raqamini tekshirtirardi.
 */
export function tooManyTries(minutes: number): string {
  return [
    "⏳ <b>Juda ko'p urinish</b>",
    "",
    `Raqam bir necha marta topilmadi. <b>${minutes}</b> daqiqadan keyin qayta urinib ko'ring.`,
    "",
    `Kutmaslik uchun pastdagi "${CONTACT_BUTTON}" tugmasini bosing — u darrov ishlaydi.`,
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

/**
 * Asosiy ekran.
 *
 * IKONKASIZ va qatorlar QISQA — markaz shu ko'rinishni tanladi.
 * Ostida 9 ta tugma turadi, ularning har birida o'z emojisi bor;
 * matnda ham emoji bo'lsa ekran ola-quroq bo'lib, o'quvchi qayerga
 * qarashini bilmay qolardi.
 *
 * Filial nomi bazadan XOM holda olinadi (`branches.name`) — u yerda
 * qanday yozilgan bo'lsa shundayligicha.
 */
export function homeView(
  pupil: Pupil,
  opts: { branch: string; groups: Group[]; paid: number; role: "student" | "parent" },
): string {
  const lines = [`<b>${esc(pupilFullName(pupil))}</b>`, ""];

  // Rol va filial BITTA qatorda. Ota-onaga "Ota-ona" emas, "Ota-ona
  // sifatida" deyiladi: ism ustida FARZANDINIKI turibdi, qisqartirilsa
  // o'quvchining o'zi ota-ona deb tushunilardi.
  const who = opts.role === "parent" ? "Ota-ona sifatida" : "O'quvchi";
  lines.push([who, opts.branch ? esc(opts.branch) : ""].filter(Boolean).join(" · "));

  // GURUH NOMI + USTOZ. Ilgari bu yerda faqat `g.name` turardi va u
  // bazada raqam ("13") — o'quvchi "Guruh: 13" dan hech narsa
  // tushunmasdi. Ustoz esa faqat "Dars jadvali" ichida ko'rinardi,
  // holbuki "kim o'qitadi" birinchi so'raladigan savol.
  if (opts.groups.length > 0) {
    lines.push(`<b>Guruh:</b> ${esc(opts.groups.map(groupLabel).join(", "))}`);
    const teachers = [...new Set(opts.groups.map((g) => (g.teacher || "").trim()).filter(Boolean))];
    if (teachers.length > 0) lines.push(`<b>Ustoz:</b> ${esc(teachers.join(", "))}`);
  }

  const status = pupilStatusOf(pupil);
  if (status !== "Aktiv") lines.push(`<b>Holat:</b> ${esc(status)}`);

  lines.push(`<b>Jami to'lov:</b> ${fmtUZS(opts.paid)} so'm`);
  lines.push("");
  lines.push("Kerakli bo'limni tanlang.");
  return lines.join("\n");
}

// ── Davomat ─────────────────────────────────────────────────────────

export function attendanceView(pupil: Pupil, marks: AttendanceMark[], month: string): string {
  const lines = [`📋 <b>Davomat — ${esc(monthLabel(month))}</b>`, whoLine(pupil), ""];

  if (marks.length === 0) {
    lines.push("Bu oyda davomat belgilanmagan.");
    return lines.join("\n");
  }

  const count: Record<AttendanceStatus, number> = { keldi: 0, kechikdi: 0, birinchi: 0, sababli: 0, sababsiz: 0 };
  for (const m of marks) count[m.status] = (count[m.status] ?? 0) + 1;

  // O'zlashtirish — "keldi" + "kechikdi" + "birinchi dars" HOZIR BO'LGAN darslar
  // hisoblanadi. "Sababli" ham qoldirilgan dars: uni maxrajdan chiqarib
  // yuborish foizni sun'iy ravishda ko'tarardi.
  const present = count.keldi + count.kechikdi + count.birinchi;
  const pct = marks.length > 0 ? Math.round((present / marks.length) * 100) : 0;

  lines.push(
    `Darslar: <b>${marks.length}</b>  •  ✅ ${count.keldi}  🟠 ${count.kechikdi}  ❌ ${count.sababsiz}  🔵 ${count.sababli}  🟡 ${count.birinchi}`,
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

  lines.push(`Jami to'langan: <b>${fmtUZS(view.liveTotal)} so'm</b>`);
  lines.push("");

  for (const r of view.rows) {
    // Qaytarim qatori MANFIY summa bilan chiqadi va alohida yorliq oladi —
    // o'quvchi "−320 000" ni ko'rib nima ekanini shu yerning o'zida bilsin.
    const tail = [r.refund && "QAYTARILDI", r.method && esc(r.method), r.cancelled && "BEKOR QILINGAN"]
      .filter(Boolean)
      .join(", ");
    const amount = r.cancelled ? `<s>${fmtUZS(r.amount)}</s>` : `<b>${fmtUZS(r.amount)}</b>`;
    lines.push(`${dmy(r.date)}  ${amount} so'm${tail ? `  <i>(${tail})</i>` : ""}`);
    // Tanga evaziga chegirma — to'lovga qo'shib hisoblangan qism (jami summaga kiradi).
    if (r.discount && !r.cancelled) lines.push(`   🏷️ + ${fmtUZS(r.discount)} so'm tanga evaziga chegirma`);
  }
  // `totalCount` — bazadagi HAMMA yozuv, `rows` esa kesilgan ro'yxat.
  if (view.totalCount > view.rows.length) {
    lines.push("");
    lines.push(
      `<i>… va yana ${view.totalCount - view.rows.length} ta yozuv. To'liq tarix uchun markazga murojaat qiling.</i>`,
    );
  }

  lines.push("");
  lines.push("<i>Bu — to'langan pul yig'indisi (qaytarib olingani ayrilgan). Qarzdorlik tizimda yuritilmaydi.</i>");
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
    lines.push(`<b>${esc(groupLabel(g))}</b>`);
    if (g.level) lines.push(`  Bosqich: ${esc(g.level)}`);
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
      `⏰ Keyingi dars — ${esc(groupLabel(next.group))} (jadval bo'yicha): <b>${dmy(next.iso)}</b>, ${weekdayName(next.weekday)}` +
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

/** `/start {token}` dan keyin (TZ 5.8): «✅ {ism} sahifasi bog'landi…». */
export function gameLinkedView(name: string): string {
  return `✅ <b>${esc(name)}</b> sahifasi bog'landi. «Mening sahifam» tugmasini bosing.`;
}

/** Telefon bilan kirmagan, lekin havola orqali bog'langan akkaunt har qanday xabar yozsa. */
export function gameHintView(names: string[]): string {
  return [
    `🏆 ${names.map((n) => `<b>${esc(n)}</b>`).join(", ")} sahifasini «Mening sahifam» tugmasi ochadi.`,
    "",
    "<i>To'liq kabinet (davomat, to'lovlar) uchun telefon raqamingizni yuboring.</i>",
  ].join("\n");
}

/** «🪙 Koinlar» — gamifikatsiya yoqilganda: haqiqiy hamyon (TZ 5.8 xulosasi). */
export function gameCoinsView(
  pupil: Pupil,
  s: { balance: number; earned: number; level: string; levelIndex: number; levels: number; nextName: string | null; toNext: number },
): string {
  return [
    "🪙 <b>Tangalar</b>",
    whoLine(pupil),
    "",
    `Balans: <b>${fmtUZS(s.balance)}</b> tanga`,
    `Daraja: <b>${esc(s.level)}</b> (${s.levelIndex + 1}/${s.levels})`,
    s.nextName ? `«${esc(s.nextName)}» darajasigacha: ${fmtUZS(s.toNext)} tanga` : "Eng yuqori daraja!",
    "",
    "<i>Istaklar, do'kon, guruhdagi o'rin va nishonlar — «Mening sahifam» da.</i>",
  ].join("\n");
}

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
    "🔔 Davomat va to'lov xabarlari <b>doim yoqilgan</b>.",
    "<i>Dars qoldirsangiz yoki to'lov qabul qilinsa — darhol xabar keladi.</i>",
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
      "🔄 <b>Kimning ma'lumotini ko'rasiz?</b>",
      "",
      `Raqamingizga <b>${count}</b> ta o'quvchi bog'langan. Birini tanlang.`,
      "",
      "<i>Keyinroq \"🔄 Boshqa profil\" tugmasi orqali istalgan vaqtda almashtirasiz.</i>",
    ].join("\n");
  }
  return [
    "🔄 <b>Profilni tanlang</b>",
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

/**
 * GURUHGA QO'SHILGANDA — o'quvchiga (va ota-onaga) darhol xabar.
 *
 * Jadval to'liq YOZILADI, "jadvalni ko'ring" deb havola berilmaydi:
 * xabar ko'pincha ish/maktab orasida o'qiladi va odam o'sha zahoti
 * qachon kelishini bilishi kerak.
 */
/**
 * OY TO'LOVI ESLATMASI.
 *
 * SUMMA AYTILMAYDI va "qarzdorsiz" DEYILMAYDI. Tizimda kurs narxi
 * ham, qarz qoldig'i ham yuritilmaydi (lib/studentBot/dues.ts) —
 * raqam yozilsa u to'qib chiqarilgan bo'lardi. Ayta oladigan
 * yagona rost gap: shu oy uchun to'lov yozuvi hali yo'q.
 *
 * Ohang ham shunga yarasha: ayblov emas, eslatma. To'lov qilingan-u
 * kassada hali yozilmagan bo'lishi mumkin, shuning uchun oxirida
 * "allaqachon to'lagan bo'lsangiz e'tibor bermang" deyiladi.
 */
export function duePush(pupil: Pupil, month: string): string {
  return [
    "💳 <b>To'lov eslatmasi</b>",
    whoLine(pupil),
    "",
    `<b>${esc(monthLabel(month))}</b> oyi uchun to'lov hali qayd etilmagan.`,
    "",
    "To'lovni o'quv markazida amalga oshirishingiz mumkin.",
    "",
    "<i>Agar to'lovni allaqachon qilgan bo'lsangiz, bu xabarga e'tibor bermang —",
    "kassada yozilgach eslatma to'xtaydi.</i>",
  ].join("\n");
}

export function groupAddedPush(pupil: Pupil, group: Group): string {
  const lines = [
    "🎓 <b>Yangi guruhga qo'shildingiz</b>",
    whoLine(pupil),
    "",
    `<b>${esc(groupLabel(group))}</b>`,
  ];
  if (group.teacher) lines.push(`Ustoz: ${esc(group.teacher)}`);
  if (group.day) lines.push(`Kunlar: ${esc(group.day)}`);
  if (group.time) lines.push(`Vaqt: <b>${esc(group.time)}</b>`);
  if (group.room) lines.push(`Xona: ${esc(group.room)}`);
  lines.push("");
  lines.push("<i>To'liq jadval — botdagi \"🗓 Dars jadvali\" bo'limida.</i>");
  return lines.join("\n");
}

export function paymentPush(
  pupil: Pupil,
  opts: { amount: number; method: string; date: string; discount?: number },
): string {
  const lines = [
    "💳 <b>To'lov qabul qilindi</b>",
    "",
    `👤 ${esc(pupilFullName(pupil))}`,
    `💰 Summa: <b>${fmtUZS(opts.amount)} so'm</b>`,
  ];
  // Gamifikatsiya: tanga evaziga olingan chegirma shu to'lovga qo'llandi.
  if (opts.discount) lines.push(`🏷️ Tanga evaziga chegirma: <b>${fmtUZS(opts.discount)} so'm</b>`);
  lines.push(`📅 ${dmy(opts.date)}`);
  if (opts.method) lines.push(`💼 To'lov turi: ${esc(opts.method)}`);
  lines.push("");
  lines.push("<i>Rahmat! Batafsil tarixni botdagi \"To'lovlar\" bo'limida ko'rasiz.</i>");
  return lines.join("\n");
}
