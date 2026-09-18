import { esc } from "@/lib/telegramApi";
import { MONTHS } from "@/lib/i18n";
import { fmtUZS, monthLabel } from "@/lib/studentBot/views";
import { formatPhone } from "@/lib/studentBot/phone";
import type { BotCashbox } from "@/lib/staffBot/auth";
import type { KassamView, TodayEntry } from "@/lib/staffBot/data";
import type { KirimDraft } from "@/lib/staffBot/session";

// Xodimlar boti — EKRAN MATNLARI. Faqat matn yig'adi, bazaga tegmaydi.
//
// HTML rejimi: foydalanuvchidan kelgan har bir qism (ism, izoh, kassa
// nomi) `esc()` dan o'tadi — ismda "<" bo'lsa Telegram butun xabarni
// rad etadi (lib/telegramApi.ts).

const RULE = "━━━━━━━━━━━━━━━━";

const so = (n: number) => `${fmtUZS(n)} so'm`;

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
    "Bu — <b>Akademiya CRM</b> kassa boti. Bu yerdan to'lov kiritish va kassa holatini ko'rish mumkin.",
    "",
    "Kirish uchun CRM'dagi <b>telefon raqamingiz</b> va <b>parolingiz</b> kerak.",
    "Pastdagi tugmani bosing yoki raqamni yozing.",
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
  return "🚪 Botdan chiqasizmi?\n\nKeyingi safar telefon raqam va parol qayta so'raladi.";
}

export function loggedOut(): string {
  return "✅ Chiqdingiz. Qayta kirish uchun /start ni bosing.";
}

// ── Bosh menyu ──────────────────────────────────────────────────────

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

/** Tugma bosilganda chiqadigan qisqa javob (answerCallbackQuery) — 200 belgigacha. */
export const COMING_SOON = "⏳ Bu bo'lim keyingi bosqichda qo'shiladi";

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

export function kirimConfirmView(d: KirimDraft, cashbox: BotCashbox, dateIso: string): string {
  return [
    kirimHeader(d, cashbox),
    `Sana: ${dmy(dateIso)} · Kassa: ${esc(cashbox.name)}`,
    "",
    "Hammasi to'g'rimi? <b>Tasdiqlash</b> bosilgach pul kassaga yoziladi, Google Sheets va Telegram guruhiga xabar ketadi.",
  ].join("\n");
}

export function kirimSaved(d: KirimDraft, cashbox: BotCashbox, entryId: number, balanceAfter: number): string {
  const who = d.studentName ? ` · ${esc(d.studentName)}` : "";
  return [
    `✅ <b>Saqlandi</b> — yozuv #${entryId}`,
    `${so(d.amount ?? 0)} · ${esc(d.methodName ?? "")}${who}`,
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
