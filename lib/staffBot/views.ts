import { esc } from "@/lib/telegramApi";
import { MONTHS } from "@/lib/i18n";
import { fmtUZS, monthLabel } from "@/lib/studentBot/views";
import { formatPhone } from "@/lib/studentBot/phone";
import type { BotCashbox } from "@/lib/staffBot/auth";
import type { KassamView, TodayEntry } from "@/lib/staffBot/data";
import { lessonDaysLabel, parseLessonDays } from "@/lib/ordersData";
import type { ChiqimDraft, KirimDraft, LeadDraft, TransferDraft } from "@/lib/staffBot/session";
import type { TransferPendingInfo } from "@/lib/staffBot/notify";

// Xodimlar boti — EKRAN MATNLARI. Faqat matn yig'adi, bazaga tegmaydi.
//
// HTML rejimi: foydalanuvchidan kelgan har bir qism (ism, izoh, kassa
// nomi) `esc()` dan o'tadi — ismda "<" bo'lsa Telegram butun xabarni
// rad etadi (lib/telegramApi.ts).

const RULE = "━━━━━━━━━━━━━━━━";

const so = (n: number) => `${fmtUZS(n)} so'm`;
/** "2 400 000 so'm" — oqimlardagi xabar matnlari uchun. */
export const fmtMoney = so;

/** "2026-09-18" -> "18.09.2026". */
function dmy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

/** "2026-09" -> "sentyabr" — izoh uchun kichik harfda. */
export function monthWord(month: string): string {
  const idx = Number(month.split("-")[1]) - 1;
  return idx >= 0 && idx < 12 ? MONTHS.uz[idx].toLowerCase() : month;
}

// ── Kirish ──────────────────────────────────────────────────────────

export function loginPrompt(nick = ""): string {
  const hello = nick ? `Assalomu alaykum, ${esc(nick)}!` : "Assalomu alaykum!";
  return [
    `👋 ${hello}`,
    "",
    "Bu — <b>Akademiya CRM</b> xodimlar boti: o'z profilingiz, kassirlar uchun esa to'lov kiritish va kassa holati.",
    "",
    "📱 <b>Pastdagi tugma</b> — raqamingizni yuboring: parolsiz kirasiz va profilingizni ko'rasiz.",
    "⌨️ <b>Raqamni yozsangiz</b> — CRM parolingiz so'raladi (kassa amallari uchun).",
  ].join("\n");
}

export function passwordPrompt(phone: string): string {
  return [
    `📱 Raqam: <b>+${esc(phone)}</b>`,
    "",
    "🔑 Endi CRM <b>parolingizni</b> yozing.",
    "",
    "<i>Parol yozilgan xabar darhol o'chiriladi — chatda qolmaydi.</i>",
    "Boshqa raqam bilan kirish uchun /start ni bosing.",
  ].join("\n");
}

export function loginFailed(error: string): string {
  return `❌ ${esc(error)}\n\nQayta urinib ko'ring yoki /start ni bosing.`;
}

export function passwordNotDeleted(): string {
  return "⚠️ Parol yozilgan xabarni o'chirib bo'lmadi — uni o'zingiz o'chirib qo'ying.";
}

export function tooManyTries(minutes: number): string {
  return `⏳ Juda ko'p urinish. ${minutes} daqiqadan keyin qayta urinib ko'ring.`;
}

export function foreignContact(): string {
  return "Bu boshqa odamning kontakti. Iltimos, tugma orqali <b>o'z</b> raqamingizni yuboring.";
}

export function sessionInvalid(error: string): string {
  return `🔒 ${esc(error)}\n\nQayta kirish uchun /start ni bosing.`;
}

export function logoutView(): string {
  return "🚪 Botdan chiqasizmi?\n\nKeyingi safar qayta kirish so'raladi.";
}

/** Ulashilgan raqam faol xodimlar ro'yxatida yo'q (yoki ikki xodimda bir xil). */
export function contactNotFound(): string {
  return [
    "❌ Bu raqam CRM'dagi xodimlar ro'yxatida topilmadi.",
    "",
    "Administratorga murojaat qiling — Boshqaruv → Xodimlar bo'limida telefon raqamingiz to'g'ri yozilganini tekshirsin.",
  ].join("\n");
}

export function loggedOut(): string {
  return "✅ Chiqdingiz. Qayta kirish uchun /start ni bosing.";
}

// ── Bosh menyu ──────────────────────────────────────────────────────

/** Raqam ulashib kirgan xodimning menyusi — faqat profil (28.09.2026). */
export function profileMenuView(name: string, webLogin: boolean): string {
  const lines = [
    `👤 <b>${esc(name || "Xodim")}</b>`,
    "",
    "«👤 Profilim» — oylik, avans, tranzaksiyalar, o'quvchilar to'lovlari va boshqa ma'lumotlaringiz (saytdagidek).",
  ];
  if (webLogin) lines.push("", "Kassa amallari uchun «🔑 Parol bilan kirish» ni bosing.");
  return lines.join("\n");
}

export function menuView(name: string, cashbox: BotCashbox | null, isAdmin: boolean): string {
  const lines = [`👤 <b>${esc(name || "Xodim")}</b>${isAdmin ? " · admin" : ""}`];
  if (cashbox) {
    lines.push(`🏦 ${esc(cashbox.name)} — qoldiq <b>${so(cashbox.balance)}</b>`);
  } else {
    lines.push("🏦 Kassa biriktirilmagan — kassa amallari yopiq.");
  }
  lines.push("", "Bo'limni tanlang:");
  return lines.join("\n");
}

export function noCashbox(): string {
  return "🏦 Sizga kassa biriktirilmagan.\n\nAdministrator Moliya → Kassalar bo'limida sizni kassaga biriktirishi kerak.";
}

export function noPermission(): string {
  return "🔒 Kassa bo'limiga ruxsatingiz yo'q. Administratorga murojaat qiling.";
}

// ── Kassam ──────────────────────────────────────────────────────────

export function kassamView(v: KassamView, todayIso: string): string {
  const { cashbox, methods, pendingOut, stats } = v;
  const lines = [`📊 <b>${esc(cashbox.name)}</b>`, `💰 Qoldiq: <b>${so(cashbox.balance)}</b>`, ""];

  // To'lov turlari bo'yicha QOLDIQ (tushum emas — lib/cashboxes.ts izohi).
  const rows = methods
    .map((m) => ({ name: m.name, total: cashbox.methodTotals[m.key] ?? 0, pending: pendingOut[m.key] ?? 0 }))
    .filter((r) => r.total !== 0 || r.pending !== 0);
  if (rows.length > 0) {
    for (const r of rows) {
      const hold = r.pending > 0 ? ` <i>(${fmtUZS(r.pending)} tasdiq kutmoqda)</i>` : "";
      lines.push(`• ${esc(r.name)}: ${so(r.total)}${hold}`);
    }
  } else {
    lines.push("• Kassa bo'sh");
  }

  lines.push("", `📅 Bugun (${dmy(todayIso)}) tushum: <b>${so(stats.todayIncome)}</b>`);
  // "Oxirgi topshiruvdan beri" — filial kassasi uchun ("hozir qancha
  // topshirishim kerak"). Bosh kassa hech kimga topshirmaydi, unga bu
  // qator ma'nosiz.
  if (!cashbox.isPrimary) {
    const s = stats.sinceHandover;
    lines.push(
      `📤 Oxirgi topshiruvdan beri: tushum ${so(s.income)}, chiqim ${so(s.expense)}`
        + (s.since ? "" : " <i>(boshidan beri)</i>"),
    );
  }
  if (stats.pendingInCount > 0) {
    lines.push(`📥 Kelayotgan ko'chirma: <b>${so(stats.pendingIn)}</b> (${stats.pendingInCount} ta, tasdiq kutmoqda)`);
  }
  return lines.join("\n");
}

export function todayView(cashboxName: string, entries: TodayEntry[], todayIso: string): string {
  const lines = [`🧾 <b>${esc(cashboxName)}</b> — ${dmy(todayIso)}`, ""];
  if (entries.length === 0) {
    lines.push("Bugun hali yozuv yo'q.");
    return lines.join("\n");
  }
  for (const e of entries) {
    const sign = e.amount > 0 ? "+" : "−";
    const who = e.studentName ? ` · ${esc(e.studentName)}` : "";
    const cancelled = e.status === "cancelled" ? " <s>bekor</s>" : "";
    const waiting = e.status === "waiting" ? " ⏳" : "";
    const bot = e.origin === "telegram" ? " 🤖" : "";
    lines.push(`#${e.id} ${esc(e.time)} <b>${sign}${fmtUZS(Math.abs(e.amount))}</b> ${esc(e.paymentType)}${who}${cancelled}${waiting}${bot}`);
    if (e.note) lines.push(`   <i>${esc(e.note)}</i>`);
  }
  lines.push("", "<i>🤖 — botdan kiritilgan</i>");
  return lines.join("\n");
}

export function cashboxPickerView(): string {
  return "🏦 Qaysi kassa bilan ishlaysiz?";
}

// ── Kirim ───────────────────────────────────────────────────────────

/** Tanlangan qadamlar — har ekranning tepasida, kassir nima kiritganini ko'rib turadi. */
function kirimHeader(d: KirimDraft, cashbox: BotCashbox): string {
  const title = `💵 <b>Kirim</b> · ${esc(cashbox.name)}`;
  // Hali hech narsa tanlanmagan — bo'sh ramka chizilmaydi.
  if (!d.typeName) return `${title}\n${RULE}`;
  const lines = [title, RULE];
  lines.push(`Tur: <b>${esc(d.typeName)}</b>`);
  if (d.studentName) {
    lines.push(`O'quvchi: <b>${esc(d.studentName)}</b>${d.studentPhone ? ` · ${esc(formatPhone(d.studentPhone))}` : ""}`);
    const g = d.groupLabel ? esc(d.groupLabel) : "guruhsiz";
    const t = d.teacherName ? `ustoz ${esc(d.teacherName)}` : "ustoz topilmadi";
    lines.push(`Guruh: ${g} · ${t}`);
  }
  if (d.amount) lines.push(`Summa: <b>${so(d.amount)}</b>`);
  if (d.methodName) lines.push(`To'lov turi: <b>${esc(d.methodName)}</b>`);
  if (d.periodMonth) lines.push(`Oy: <b>${monthLabel(d.periodMonth)}</b>`);
  if (d.note !== undefined) lines.push(`Izoh: ${d.note ? esc(d.note) : "<i>yo'q</i>"}`);
  lines.push(RULE);
  return lines.join("\n");
}

export function kirimTypePrompt(d: KirimDraft, cashbox: BotCashbox): string {
  return `${kirimHeader(d, cashbox)}\n👉 Kirim turini tanlang:`;
}

export function kirimStudentPrompt(d: KirimDraft, cashbox: BotCashbox): string {
  return `${kirimHeader(d, cashbox)}\n👉 O'quvchining <b>ismi</b> yoki <b>telefon raqamini</b> yozing (kamida 2 belgi):`;
}

export function kirimStudentResults(d: KirimDraft, cashbox: BotCashbox, query: string, count: number, more: boolean): string {
  const tail = more
    ? `\n<i>Yana bor — ro'yxatda yo'q bo'lsa aniqroq yozing.</i>`
    : "";
  return `${kirimHeader(d, cashbox)}\n🔎 "${esc(query)}" bo'yicha ${count} ta topildi. O'quvchini tanlang:${tail}`;
}

export function kirimStudentNotFound(d: KirimDraft, cashbox: BotCashbox, query: string): string {
  return `${kirimHeader(d, cashbox)}\n😕 "${esc(query)}" bo'yicha o'quvchi topilmadi.\n\nBoshqacha yozib ko'ring — familiya, ism yoki telefon.`;
}

export function kirimQueryTooShort(d: KirimDraft, cashbox: BotCashbox): string {
  return `${kirimHeader(d, cashbox)}\n✏️ Kamida 2 ta belgi yozing.`;
}

export function kirimAmountPrompt(d: KirimDraft, cashbox: BotCashbox, paidBefore: number | null): string {
  // "Jami to'lagan" — balans EMAS: qarz tizimda yuritilmaydi
  // (lib/pupilsDb.ts → studentPaidBalanceByName izohi).
  const bal = paidBefore === null
    ? ""
    : paidBefore > 0
      ? `\n<i>Bu o'quvchi ilgari jami ${so(paidBefore)} to'lagan.</i>`
      : "\n<i>Bu o'quvchining avvalgi to'lovi yo'q.</i>";
  return `${kirimHeader(d, cashbox)}${bal}\n👉 Summani yozing (masalan <code>320000</code> yoki <code>320 000</code>):`;
}

export function kirimBadAmount(d: KirimDraft, cashbox: BotCashbox): string {
  return `${kirimHeader(d, cashbox)}\n⚠️ Summa tushunarsiz. Faqat raqam yozing, masalan <code>320000</code>.`;
}

export function kirimMethodPrompt(d: KirimDraft, cashbox: BotCashbox): string {
  return `${kirimHeader(d, cashbox)}\n👉 To'lov turini tanlang:`;
}

export function kirimMonthPrompt(d: KirimDraft, cashbox: BotCashbox): string {
  return `${kirimHeader(d, cashbox)}\n👉 To'lov <b>qaysi oy</b> uchun?`;
}

export function kirimNotePrompt(d: KirimDraft, cashbox: BotCashbox): string {
  return `${kirimHeader(d, cashbox)}\n👉 Izoh yozing yoki tugmani bosing:`;
}

/**
 * Tanga evaziga chegirma haqida kassirga ogohlantirish (gamifikatsiya, TZ
 * 4.16.4): o'quvchi shu oy to'loviga chegirma olgan — undan shuncha KAM pul
 * olinadi, chegirma saqlanganda o'zi qo'llanadi. Faqat to'lov o'sha kurs
 * ustoziga yozilsa va o'quvchi hali o'sha guruhda bo'lsa.
 */
export interface KirimDiscountHint {
  amountSom: number;
  percent: number;
  groupLabel: string;
  teacherName: string;
  /** Shu yozuvga qo'llanadimi (ustoz mos va o'quvchi guruhda). */
  applies: boolean;
}

function discountHintLine(h: KirimDiscountHint): string {
  return h.applies
    ? `🏷️ <b>Tanga evaziga chegirma: −${so(h.amountSom)}</b> (${h.percent}%) — ${esc(h.groupLabel)}. O'quvchidan shuncha kam oling: saqlanganda chegirma o'zi qo'llanadi.`
    : `🏷️ O'quvchida ${esc(h.groupLabel)} to'loviga −${so(h.amountSom)} chegirma bor, lekin u faqat ${esc(h.teacherName || "o'sha kurs")} to'loviga qo'llanadi — bu yozuvga qo'llanmaydi.`;
}

export function kirimConfirmView(d: KirimDraft, cashbox: BotCashbox, dateIso: string, discount?: KirimDiscountHint | null): string {
  return [
    kirimHeader(d, cashbox),
    `Sana: ${dmy(dateIso)} · Kassa: ${esc(cashbox.name)}`,
    ...(discount ? ["", discountHintLine(discount)] : []),
    "",
    "Hammasi to'g'rimi? <b>Tasdiqlash</b> bosilgach pul kassaga yoziladi, Google Sheets va Telegram guruhiga xabar ketadi.",
  ].join("\n");
}

export function kirimSaved(
  d: KirimDraft,
  cashbox: BotCashbox,
  entryId: number,
  balanceAfter: number,
  discount?: { amountSom: number; percent: number } | null,
): string {
  const who = d.studentName ? ` · ${esc(d.studentName)}` : "";
  return [
    `✅ <b>Saqlandi</b> — yozuv #${entryId}`,
    `${so(d.amount ?? 0)} · ${esc(d.methodName ?? "")}${who}`,
    discount ? `🏷️ Tanga evaziga chegirma qo'llandi: ${so(discount.amountSom)} (${discount.percent}%)` : "",
    d.periodMonth ? `Oy: ${monthLabel(d.periodMonth)}` : "",
    "",
    `🏦 ${esc(cashbox.name)} qoldig'i: <b>${so(balanceAfter)}</b>`,
  ].filter((l) => l !== "").join("\n");
}

export function kirimFailed(error: string): string {
  return `❌ Saqlanmadi: ${esc(error)}\n\nQayta urinib ko'ring yoki bekor qiling.`;
}

export function kirimCancelled(): string {
  return "❌ Kirim bekor qilindi. Hech narsa yozilmadi.";
}

export function draftExpired(): string {
  return "⌛ Bu amal eskirgan (30 daqiqadan ko'p vaqt o'tdi). Qaytadan boshlang.";
}

export function alreadySaved(): string {
  return "Bu to'lov allaqachon saqlangan.";
}

export function kirimNoTypes(): string {
  return "⚠️ Sozlamalarda Kirim turi qo'shilmagan (Moliya → Tranzaksiya turi). Avval web'da qo'shing.";
}

export function kirimNoMethods(): string {
  return "⚠️ Faol to'lov turi yo'q (Sozlamalar → Moliya → To'lov turlari).";
}

export function kirimTypeUnsupported(typeName: string): string {
  return `⚠️ "${esc(typeName)}" turida faqat XODIM tanlanadi — bu tur hozircha botdan kiritilmaydi, web'dan kiriting.`;
}

// ── Chiqim ──────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = { teacher: "o'qituvchi", moderator: "moderator", admin: "admin" };

/** Xodimning oylik hisobi — kartada va summa qadamida. */
function salaryLines(d: ChiqimDraft): string[] {
  if (!d.salaryPayout) return [];
  const s = d.salary;
  if (!s) return ["Oylik: <i>ro'yxatda yo'q — chegara qo'llanmaydi</i>"];
  if (!s.configured) return ["Oylik: <i>ish haqi sozlanmagan — chegara qo'llanmaydi</i>"];
  const parts = [`hisoblangan ${fmtUZS(s.earned)}`];
  if (s.tax > 0) parts.push(`soliq ${fmtUZS(s.tax)}`);
  if (s.karta > 0) parts.push(`karta ${fmtUZS(s.karta)}`);
  if (s.paid > 0) parts.push(`olingan ${fmtUZS(s.paid)}`);
  if (s.carryOver !== 0) parts.push(`o'tgan oydan ${fmtUZS(s.carryOver)}`);
  return [
    `Oylik: ${parts.join(" · ")}`,
    `Chiqarish mumkin: naqd <b>${fmtUZS(Math.max(0, s.naqd))}</b> · plastik <b>${fmtUZS(Math.max(0, s.jami))}</b>`,
  ];
}

function chiqimHeader(d: ChiqimDraft, cashbox: BotCashbox): string {
  const title = `💸 <b>Chiqim</b> · ${esc(cashbox.name)}`;
  if (!d.typeName) return `${title}\n${RULE}`;
  const lines = [title, RULE, `Tur: <b>${esc(d.typeName)}</b>`];
  if (d.personName) {
    const who = d.target === "employee" ? "Xodim" : "O'quvchi";
    const extra = d.target === "employee"
      ? (ROLE_LABEL[d.personRole ?? ""] ? ` · ${ROLE_LABEL[d.personRole ?? ""]}` : "")
      : (d.personPhone ? ` · ${esc(formatPhone(d.personPhone))}` : "");
    lines.push(`${who}: <b>${esc(d.personName)}</b>${extra}`);
    if (d.target === "student") {
      lines.push(`Balans: ${so(d.studentBalance ?? 0)}${d.refundTeacher ? ` · ustoz ${esc(d.refundTeacher)}` : ""}`);
    }
    lines.push(...salaryLines(d));
  }
  if (d.methodName) lines.push(`To'lov turi: <b>${esc(d.methodName)}</b>`);
  if (d.amount) lines.push(`Summa: <b>${so(d.amount)}</b>${d.oylikLocked ? " <i>(qoldiqning o'zi)</i>" : ""}`);
  if (d.note !== undefined) lines.push(`Izoh: ${d.note ? esc(d.note) : "<i>yo'q</i>"}`);
  lines.push(RULE);
  return lines.join("\n");
}

export function chiqimTypePrompt(d: ChiqimDraft, cashbox: BotCashbox): string {
  return `${chiqimHeader(d, cashbox)}\n👉 Chiqim turini tanlang:`;
}

export function chiqimPersonPrompt(d: ChiqimDraft, cashbox: BotCashbox): string {
  const ask = d.target === "employee"
    ? "Xodimning <b>ismini</b> yozing (kamida 2 belgi):"
    : "O'quvchining <b>ismi</b> yoki <b>telefon raqamini</b> yozing (kamida 2 belgi):";
  return `${chiqimHeader(d, cashbox)}\n👉 ${ask}`;
}

export function chiqimPersonResults(d: ChiqimDraft, cashbox: BotCashbox, query: string, count: number, more: boolean): string {
  const who = d.target === "employee" ? "Xodimni" : "O'quvchini";
  const tail = more ? "\n<i>Yana bor — ro'yxatda yo'q bo'lsa aniqroq yozing.</i>" : "";
  return `${chiqimHeader(d, cashbox)}\n🔎 "${esc(query)}" bo'yicha ${count} ta topildi. ${who} tanlang:${tail}`;
}

export function chiqimPersonNotFound(d: ChiqimDraft, cashbox: BotCashbox, query: string): string {
  const who = d.target === "employee" ? "faol xodim" : "o'quvchi";
  return `${chiqimHeader(d, cashbox)}\n😕 "${esc(query)}" bo'yicha ${who} topilmadi. Boshqacha yozib ko'ring.`;
}

export function chiqimQueryTooShort(d: ChiqimDraft, cashbox: BotCashbox): string {
  return `${chiqimHeader(d, cashbox)}\n✏️ Kamida 2 ta belgi yozing.`;
}

export function chiqimMethodPrompt(d: ChiqimDraft, cashbox: BotCashbox): string {
  return `${chiqimHeader(d, cashbox)}\n👉 Qaysi to'lov turidan chiqariladi? (qavsda kassadagi qoldiq)`;
}

export function chiqimNoBalance(d: ChiqimDraft, cashbox: BotCashbox): string {
  return `${chiqimHeader(d, cashbox)}\n⚠️ Kassada mablag' yo'q — hech bir to'lov turida qoldiq yo'q.`;
}

/** Chegara/qoldiq tugagan — sabab AYNAN aytiladi (web va server bilan bir xil matn). */
export function chiqimSalaryExhausted(d: ChiqimDraft, cashbox: BotCashbox, message: string): string {
  return `${chiqimHeader(d, cashbox)}\n⛔ ${esc(message)}\n\nBoshqa to'lov turini tanlang yoki bekor qiling.`;
}

export interface ChiqimAmountHint {
  /** Kassada shu to'lov turidan qancha bor. */
  available: number;
  /** Chegara (oylik qoldig'i / o'quvchi balansi) — bo'lsa. */
  limit: number | null;
  limitLabel: string;
}

export function chiqimAmountPrompt(d: ChiqimDraft, cashbox: BotCashbox, h: ChiqimAmountHint): string {
  const lines = [chiqimHeader(d, cashbox), `Kassada ${esc(d.methodName ?? "")}: ${so(h.available)}`];
  if (h.limit !== null) lines.push(`${esc(h.limitLabel)}: <b>${so(h.limit)}</b>`);
  lines.push(`👉 Summani yozing (masalan <code>150000</code>):`);
  return lines.join("\n");
}

export function chiqimBadAmount(d: ChiqimDraft, cashbox: BotCashbox): string {
  return `${chiqimHeader(d, cashbox)}\n⚠️ Summa tushunarsiz. Faqat raqam yozing, masalan <code>150000</code>.`;
}

export function chiqimAmountRejected(d: ChiqimDraft, cashbox: BotCashbox, reason: string): string {
  return `${chiqimHeader(d, cashbox)}\n⛔ ${esc(reason)}\n\nBoshqa summa yozing yoki bekor qiling.`;
}

export function chiqimNotePrompt(d: ChiqimDraft, cashbox: BotCashbox): string {
  return `${chiqimHeader(d, cashbox)}\n👉 Izoh yozing yoki tugmani bosing:`;
}

export function chiqimConfirmView(d: ChiqimDraft, cashbox: BotCashbox, dateIso: string): string {
  return [
    chiqimHeader(d, cashbox),
    `Sana: ${dmy(dateIso)} · Kassa: ${esc(cashbox.name)}`,
    "",
    // Chiqim guruhga ALOHIDA xabar bo'lib ketmaydi (lib/sync/config.ts →
    // TELEGRAM_KINDS faqat "payment"; oyliklar oyda 2 marta xulosa bilan).
    "Hammasi to'g'rimi? <b>Tasdiqlash</b> bosilgach pul kassadan chiqariladi va Google Sheets'ga yoziladi.",
  ].join("\n");
}

export function chiqimSaved(d: ChiqimDraft, cashbox: BotCashbox, entryId: number, balanceAfter: number): string {
  const who = d.personName ? ` · ${esc(d.personName)}` : "";
  return [
    `✅ <b>Chiqim saqlandi</b> — yozuv #${entryId}`,
    `−${so(d.amount ?? 0)} · ${esc(d.methodName ?? "")} · ${esc(d.typeName ?? "")}${who}`,
    "",
    `🏦 ${esc(cashbox.name)} qoldig'i: <b>${so(balanceAfter)}</b>`,
  ].join("\n");
}

export function chiqimFailed(error: string): string {
  return `❌ Saqlanmadi: ${esc(error)}\n\nQayta urinib ko'ring yoki bekor qiling.`;
}

export function chiqimCancelled(): string {
  return "❌ Chiqim bekor qilindi. Hech narsa yozilmadi.";
}

export function chiqimNoTypes(): string {
  return "⚠️ Sozlamalarda Chiqim turi qo'shilmagan (Moliya → Tranzaksiya turi). Avval web'da qo'shing.";
}

// ── Ko'chirish ──────────────────────────────────────────────────────

export function transferMenuView(cashbox: BotCashbox, pendingOutTotal: number, pendingIn: number, pendingInCount: number): string {
  const lines = [`🔁 <b>Ko'chirish</b> · ${esc(cashbox.name)}`, `💰 Qoldiq: ${so(cashbox.balance)}`];
  if (pendingOutTotal > 0) lines.push(`📤 Jo'natilgan, tasdiq kutmoqda: ${so(pendingOutTotal)}`);
  if (pendingInCount > 0) lines.push(`📥 Kelayotgan: <b>${so(pendingIn)}</b> (${pendingInCount} ta)`);
  lines.push("", "Nima qilamiz?");
  return lines.join("\n");
}

function transferHeader(d: TransferDraft, cashbox: BotCashbox): string {
  const title = d.mode === "cashbox"
    ? `📤 <b>Boshqa kassaga</b> · ${esc(cashbox.name)}`
    : `🔄 <b>Turlar orasida</b> · ${esc(cashbox.name)}`;
  const lines = [title, RULE];
  let any = false;
  if (d.destName) { lines.push(`Qabul qiluvchi: <b>${esc(d.destName)}</b>`); any = true; }
  if (d.fromName) {
    lines.push(d.mode === "cashbox" ? `To'lov turi: <b>${esc(d.fromName)}</b>` : `Qayerdan: <b>${esc(d.fromName)}</b>`);
    any = true;
  }
  if (d.toName) { lines.push(`Qayerga: <b>${esc(d.toName)}</b>`); any = true; }
  if (d.amount) { lines.push(`Summa: <b>${so(d.amount)}</b>`); any = true; }
  if (d.note !== undefined) { lines.push(`Izoh: ${d.note ? esc(d.note) : "<i>yo'q</i>"}`); any = true; }
  if (any) lines.push(RULE);
  return lines.join("\n");
}

export function transferDestPrompt(d: TransferDraft, cashbox: BotCashbox): string {
  return `${transferHeader(d, cashbox)}\n👉 Pul qaysi kassaga jo'natiladi? (⭐ — bosh kassa)`;
}

export function transferNoDest(): string {
  return "⚠️ Jo'natish uchun boshqa kassa yo'q.";
}

export function transferMethodPrompt(d: TransferDraft, cashbox: BotCashbox): string {
  const hint = d.mode === "cashbox"
    ? "👉 Qaysi to'lov turidan? (yonida jo'natish mumkin bo'lgan summa — qoldiqdan tasdiq kutayotgani ayrilgan)"
    : "👉 Qaysi turdan chiqariladi? (yonida qoldiq)";
  return `${transferHeader(d, cashbox)}\n${hint}`;
}

export function transferToPrompt(d: TransferDraft, cashbox: BotCashbox): string {
  return `${transferHeader(d, cashbox)}\n👉 Qaysi turga tushadi?`;
}

export function transferNoMethods(d: TransferDraft, cashbox: BotCashbox): string {
  return `${transferHeader(d, cashbox)}\n⚠️ Jo'natish mumkin bo'lgan mablag' yo'q — kassa bo'sh yoki hammasi tasdiq kutmoqda.`;
}

export function transferAmountPrompt(d: TransferDraft, cashbox: BotCashbox, available: number): string {
  return `${transferHeader(d, cashbox)}\nMumkin: <b>${so(available)}</b>\n👉 Summani yozing yoki "Hammasi" ni bosing:`;
}

export function transferBadAmount(d: TransferDraft, cashbox: BotCashbox): string {
  return `${transferHeader(d, cashbox)}\n⚠️ Summa tushunarsiz. Faqat raqam yozing, masalan <code>2400000</code>.`;
}

export function transferAmountRejected(d: TransferDraft, cashbox: BotCashbox, reason: string): string {
  return `${transferHeader(d, cashbox)}\n⛔ ${esc(reason)}\n\nBoshqa summa yozing yoki bekor qiling.`;
}

export function transferNotePrompt(d: TransferDraft, cashbox: BotCashbox): string {
  return `${transferHeader(d, cashbox)}\n👉 Izoh yozing yoki tugmani bosing:`;
}

export function transferConfirmView(d: TransferDraft, cashbox: BotCashbox, dateIso: string): string {
  const tail = d.mode === "cashbox"
    ? "Jo'natilgach pul <b>tasdiqgacha shu kassada qoladi</b> — qabul qiluvchi ✓ bosganda o'tadi. Google Sheets'ga yoziladi."
    : "Tasdiqlansa pul shu kassa ichida turdan turga o'tadi. Google Sheets'ga yoziladi.";
  return [transferHeader(d, cashbox), `Sana: ${dmy(dateIso)}`, "", tail].join("\n");
}

export function transferSaved(d: TransferDraft, cashbox: BotCashbox, entryId: number, balanceAfter: number | null): string {
  if (d.mode === "cashbox") {
    return [
      `📤 <b>Jo'natildi</b> — yozuv #${entryId}`,
      `${so(d.amount ?? 0)} · ${esc(d.fromName ?? "")} → ${esc(d.destName ?? "")}`,
      "",
      "⏳ Qabul qiluvchi tasdiqlashini kutmoqda. Pul hozircha sizning kassangizda.",
    ].join("\n");
  }
  return [
    `🔄 <b>Ko'chirildi</b> — yozuv #${entryId}`,
    `${so(d.amount ?? 0)} · ${esc(d.fromName ?? "")} → ${esc(d.toName ?? "")}`,
    "",
    balanceAfter !== null ? `🏦 ${esc(cashbox.name)} qoldig'i: <b>${so(balanceAfter)}</b> (o'zgarmadi — turlar orasida)` : "",
  ].filter((l) => l !== "").join("\n");
}

export function transferFailed(error: string): string {
  return `❌ Bajarilmadi: ${esc(error)}\n\nQayta urinib ko'ring yoki bekor qiling.`;
}

export function transferCancelled(): string {
  return "❌ Ko'chirish bekor qilindi. Hech narsa yozilmadi.";
}

export interface IncomingItem {
  id: number;
  date: string;
  time: string;
  amount: number;
  paymentType: string;
  txName: string;
  note: string;
  fromCashboxName: string;
}

export function transferInboxView(cashboxName: string, items: IncomingItem[]): string {
  const lines = [`📥 <b>Kelayotgan ko'chirmalar</b> · ${esc(cashboxName)}`, ""];
  if (items.length === 0) {
    lines.push("Tasdiq kutayotgan ko'chirma yo'q.");
    return lines.join("\n");
  }
  for (const it of items) {
    lines.push(`#${it.id} · ${dmy(it.date)} ${esc(it.time)} · <b>${so(it.amount)}</b> · ${esc(it.paymentType)}`);
    lines.push(`   ${esc(it.fromCashboxName || it.txName)}${it.note ? ` · <i>${esc(it.note)}</i>` : ""}`);
  }
  lines.push("", "Har bir qator uchun ✅ qabul yoki ❌ rad — keyin yana bir marta tasdiqlanadi.");
  return lines.join("\n");
}

export function transferPendingPush(info: TransferPendingInfo): string {
  return [
    `📥 <b>Ko'chirma keldi</b> — yozuv #${info.inEntryId}`,
    `${esc(info.fromCashboxName)} → ${esc(info.toCashboxName)}`,
    `<b>${so(info.amount)}</b> · ${esc(info.methodName)}${info.note ? ` · <i>${esc(info.note)}</i>` : ""}`,
    "",
    "Pul hozircha jo'natuvchida. Qabul qilsangiz sizning kassangizga o'tadi.",
  ].join("\n");
}

export function transferSureView(it: IncomingItem, decision: "confirm" | "reject"): string {
  const what = decision === "confirm" ? "QABUL QILASIZMI" : "RAD ETASIZMI";
  return [
    `❓ Ko'chirma #${it.id} ni <b>${what}</b>?`,
    `${esc(it.fromCashboxName || it.txName)} · <b>${so(it.amount)}</b> · ${esc(it.paymentType)}`,
    decision === "confirm"
      ? "Qabul qilinsa pul jo'natuvchidan yechilib, sizning kassangizga qo'shiladi."
      : "Rad etilsa hech qanday pul ko'chmaydi, ko'chirma bekor bo'ladi.",
  ].join("\n");
}

export function transferDecidedView(decision: "confirm" | "reject", entryId: number, amount: number, fromName: string, toName: string): string {
  return decision === "confirm"
    ? `✅ <b>Qabul qilindi</b> — #${entryId}\n${esc(fromName)} → ${esc(toName)} · <b>${so(amount)}</b>`
    : `❌ <b>Rad etildi</b> — #${entryId}\n${esc(fromName)} → ${esc(toName)} · ${so(amount)} — pul jo'natuvchida qoldi.`;
}

export function transferDecisionFailed(error: string): string {
  return `⛔ ${esc(error)}`;
}

export function transferNotFound(): string {
  return "Bu ko'chirma topilmadi yoki allaqachon hal qilingan.";
}

// ── Lid qo'shish ────────────────────────────────────────────────────

function leadHeader(d: LeadDraft, branchName: string): string {
  const lines = [`📋 <b>Yangi lid</b>${branchName ? ` · ${esc(branchName)}` : ""}`, RULE];
  let any = false;
  if (d.studentName) {
    lines.push(`O'quvchi: <b>${esc(d.studentName)}</b>${d.studentPhone ? ` · ${esc(formatPhone(d.studentPhone))}` : ""}`);
    any = true;
  }
  if (d.course) { lines.push(`Kurs: <b>${esc(d.course)}</b>`); any = true; }
  if (d.lessonDay) { lines.push(`Dars kunlari: <b>${esc(lessonDaysLabel(parseLessonDays(d.lessonDay)))}</b>`); any = true; }
  if (d.note !== undefined) { lines.push(`Izoh: ${d.note ? esc(d.note) : "<i>yo'q</i>"}`); any = true; }
  if (any) lines.push(RULE);
  return lines.join("\n");
}

export function leadStudentPrompt(d: LeadDraft, branchName: string): string {
  return [
    leadHeader(d, branchName),
    "👉 O'quvchining <b>ismi</b> yoki <b>telefon raqamini</b> yozing (kamida 2 belgi).",
    "<i>Lid faqat CRM'da mavjud o'quvchiga ochiladi — yangi odam bo'lsa avval web'da \"O'quvchi qo'shish\" qiling.</i>",
  ].join("\n");
}

export function leadStudentResults(d: LeadDraft, branchName: string, query: string, count: number, more: boolean): string {
  const tail = more ? "\n<i>Yana bor — ro'yxatda yo'q bo'lsa aniqroq yozing.</i>" : "";
  return `${leadHeader(d, branchName)}\n🔎 "${esc(query)}" bo'yicha ${count} ta topildi. O'quvchini tanlang:${tail}`;
}

export function leadStudentNotFound(d: LeadDraft, branchName: string, query: string): string {
  return `${leadHeader(d, branchName)}\n😕 "${esc(query)}" bo'yicha o'quvchi topilmadi.\n\nBoshqacha yozib ko'ring yoki avval web'da o'quvchini qo'shing.`;
}

export function leadQueryTooShort(d: LeadDraft, branchName: string): string {
  return `${leadHeader(d, branchName)}\n✏️ Kamida 2 ta belgi yozing.`;
}

export function leadCoursePrompt(d: LeadDraft, branchName: string): string {
  return `${leadHeader(d, branchName)}\n👉 Kursni tanlang:`;
}

export function leadNoCourses(): string {
  return "⚠️ Sozlamalarda kurs qo'shilmagan (Kurslar bo'limi). Avval web'da qo'shing.";
}

export function leadDaysPrompt(d: LeadDraft, branchName: string): string {
  return `${leadHeader(d, branchName)}\n👉 Dars kunlarini tanlang:`;
}

export function leadNotePrompt(d: LeadDraft, branchName: string): string {
  return `${leadHeader(d, branchName)}\n👉 Izoh yozing (masalan qachon qo'ng'iroq qilish) yoki tugmani bosing:`;
}

export function leadConfirmView(d: LeadDraft, branchName: string, author: string): string {
  return [
    leadHeader(d, branchName),
    `Moderator: ${esc(author || "—")}`,
    "",
    "Hammasi to'g'rimi? Lid CRM'ga yoziladi va filialning Telegram \"Lidlar\" topigiga xabar ketadi.",
  ].join("\n");
}

export function leadSaved(d: LeadDraft, branchName: string, orderId: number, branchNo: number): string {
  return [
    `✅ <b>Lid qo'shildi</b> — №${branchNo}${branchName ? ` (${esc(branchName)})` : ""} · yozuv #${orderId}`,
    `${esc(d.studentName ?? "")} · ${esc(d.course ?? "")}`,
    "",
    "Lid Telegram \"Lidlar\" topigida ko'rinadi — statusini o'sha yerdagi tugmalar bilan belgilang.",
  ].join("\n");
}

export function leadFailed(error: string): string {
  return `❌ Lid qo'shilmadi: ${esc(error)}\n\nQayta urinib ko'ring yoki bekor qiling.`;
}

export function leadCancelled(): string {
  return "❌ Lid bekor qilindi. Hech narsa yozilmadi.";
}

export function noLeadPermission(): string {
  return "🔒 Lidlar bo'limiga ruxsatingiz yo'q. Administratorga murojaat qiling.";
}
