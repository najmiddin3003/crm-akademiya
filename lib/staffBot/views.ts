import { esc } from "@/lib/telegramApi";
import { MONTHS } from "@/lib/i18n";
import { fmtUZS, monthLabel } from "@/lib/studentBot/views";
import { formatPhone } from "@/lib/studentBot/phone";
import type { BotCashbox } from "@/lib/staffBot/auth";
import type { KassamView, TodayEntry } from "@/lib/staffBot/data";
import { lessonDaysLabel, parseLessonDays } from "@/lib/ordersData";
import type { ChiqimDraft, KirimDraft, LeadDraft, TransferDraft } from "@/lib/staffBot/session";
import { payrollMonthKey, payrollPeriod, prevMonthKey } from "@/lib/salary";
import type { TransferPendingInfo } from "@/lib/staffBot/notify";
import { STATUS_LABEL, durParts, ms, uzDateOf, uzTimeOf, type StaffTaskStatus } from "@/lib/staffTasks";
import type { StaffTaskDoc } from "@/lib/staffTasksServer";

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
    "👔 <b>Xodimlar bo'limi</b>: o'z profilingiz, «📷 Ishga keldim», kassirlar uchun esa to'lov kiritish va kassa holati.",
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
    "",
    "Sayt parolingiz yo'qmi? /start ni bosing va raqamni «📱 Telefon raqamimni yuborish» tugmasi bilan yuboring — parolsiz kirasiz (profil va «Ishga keldim»).",
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
    "«📷 Ishga keldim» — filialga kelganingizda bosing: joylashuvingiz (Face ID yoqilgan bo'lsa yuzingiz ham) tekshiriladi.",
    "«👤 Profilim» — oylik, avans, tranzaksiyalar, o'quvchilar to'lovlari va boshqa ma'lumotlaringiz (saytdagidek).",
  ];
  if (webLogin) lines.push("", "Kassa amallari uchun «🔑 Parol bilan kirish» ni bosing.");
  return lines.join("\n");
}

// ── Ishga keldim (28.09.2026; joylashuv — 29.09.2026; QR'siz — 31.10.2026) ──

export function checkinNeedsLogin(): string {
  return "📷 «Ishga keldim» uchun avval botga kiring: pastdagi tugma bilan raqamingizni yuboring.";
}

/**
 * Eski QR havolasi ochilganda (31.10.2026 dan QR yo'q; 29.09.2026 dan bu yo'l
 * baribir belgilamasdi — joylashuv faqat Mini App'da ishonchli olinadi).
 */
export function checkinUseButton(kind: "in" | "out"): string {
  const button = kind === "out" ? "«🏁 Ishdan ketdim»" : "«📷 Ishga keldim»";
  return [
    "📍 <b>QR kod endi kerak emas.</b>",
    "",
    `Pastdagi ${button} tugmasini bosing — joylashuvingiz (Face ID yoqilgan bo'lsa yuzingiz ham) tekshiriladi. Birinchi marta Telegram joylashuvga ruxsat so'raydi — «Ruxsat berish» ni bosing.`,
  ].join("\n");
}

export function menuView(name: string, cashbox: BotCashbox | null, isAdmin: boolean): string {
  const lines = [`👤 <b>${esc(name || "Xodim")}</b>${isAdmin ? " · admin" : ""}`];
  // Kassasiz xodimga "kassa biriktirilmagan" satri YOZILMAYDI (29.09.2026,
  // foydalanuvchi: "kerak emas") — «Kirim» bosilsa sababi o'sha yerda aytiladi.
  if (cashbox) lines.push(`🏦 ${esc(cashbox.name)} — qoldiq <b>${so(cashbox.balance)}</b>`);
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

/**
 * Xodimning oylik hisobi — kartada va summa qadamida. Oy bosqichidan
 * (04.10.2026) keyin hisob TANLANGAN oyniki (tepasida "Oy:" satri): oy hali
 * tanlanmaguncha `salary` yuklanmagan — satr chizilmaydi, aks holda
 * "ro'yxatda yo'q" deb yolg'on ko'rinardi.
 */
/**
 * Botdagi Avans/Oylik OY TUGMALARI — O'TGAN va SHU oy ("YYYY-MM"). KELAJAK
 * yo'q — server ham rad etadi. "Shu oy" TOSHKENT vaqti bo'yicha
 * (`payrollPeriod`) — server kelajak oyni aynan shu bilan tekshiradi.
 * Bitta manba: tugmalar (lib/staffBot/chiqim.ts → payoutMonthOptions) ham,
 * pending ko'rsatmasidagi "(Oy: «…»)" ham shundan (04.10.2026) — ko'rsatma
 * botda YO'Q tugmaga yo'naltirmasin.
 */
export function payoutMonthKeys(): string[] {
  const p = payrollPeriod();
  return [prevMonthKey(p), payrollMonthKey(p)];
}

function salaryLines(d: ChiqimDraft): string[] {
  if (!d.salaryPayout) return [];
  if (d.step === "month") return [];
  const s = d.salary;
  if (!s) return ["Oylik: <i>ro'yxatda yo'q — chegara qo'llanmaydi</i>"];
  if (!s.configured) return ["Oylik: <i>ish haqi sozlanmagan — chegara qo'llanmaydi</i>"];
  const parts = [`hisoblangan ${fmtUZS(s.earned)}`];
  if (s.tax > 0) parts.push(`soliq ${fmtUZS(s.tax)}`);
  if (s.karta > 0) parts.push(`karta ${fmtUZS(s.karta)}`);
  if (s.paid > 0) parts.push(`olingan ${fmtUZS(s.paid)}`);
  // "o'tgan oydan" — faqat SHU OYDA to'lanadigan qism (nol-yopish ulushi
  // yoki qarzdorlik); chegara ham shundan.
  if (s.carryOver !== 0) parts.push(`o'tgan oydan ${fmtUZS(s.carryOver)}`);
  const lines = [
    `Oylik: ${parts.join(" · ")}`,
    `Chiqarish mumkin: naqd <b>${fmtUZS(Math.max(0, s.naqd))}</b> · plastik <b>${fmtUZS(Math.max(0, s.jami))}</b>`,
  ];
  // O'TISH DAVRI QOROVULI (04.10.2026): tanlangan O'TGAN oyning puli joriy
  // oyda joriy oy yozuvi bo'lib berilgan bo'lishi mumkin — qayta bermasin.
  if (s.paidLater) {
    lines.push(`⚠️ Bu oy qoldig'idan <b>${so(s.paidLater.amount)}</b> ${monthLabel(s.paidLater.month)} oyida (o'sha oy yozuvi bo'lib) berilgan bo'lishi mumkin — qayta bermang, avval o'sha yozuvni tekshiring.`);
  }
  // ...va teskarisi: shu oyda ORTIQCHA OYLIK bor, u pending oy puli bo'lishi
  // mumkin — "o'sha oydan chiqariladi" deyilmaydi (u yerda yana chiqarilsa
  // ikki marta to'lanadi).
  for (const pm of s.pendingMaybePaid ?? []) {
    lines.push(`⚠️ ${monthLabel(pm.month)} oyidan <b>${so(pm.amount)}</b> shu oyda (shu oy yozuvi bo'lib) berilgan bo'lishi mumkin — ${monthLabel(pm.month)} oyidan qayta chiqarmang, avval yozuvni tekshiring.`);
  }
  // O'tgan oylarda to'lanmagan qoldiq (04.10.2026, "faqat o'z oyidan
  // chiqarilsin") — bu oy chegarasiga KIRMAYDI. Kassir uni ko'rmasa
  // "sentabr puli qayoqqa ketdi" deb o'ylardi; o'sha oyni tanlab chiqaradi.
  // Oy botdagi tugmalarda bo'lmasa (o'tgan oydan eski) — web'ga yo'naltiriladi:
  // bot uni tanlatmaydi (chiqim.ts eskirgan tugmani rad etadi).
  // `pending` 04.10 dan oldingi qoralamada yo'q — `?? []`.
  const inBot = new Set(payoutMonthKeys());
  for (const pm of s.pending ?? []) {
    const where = inBot.has(pm.month)
      ? `(Oy: «${monthLabel(pm.month)}»)`
      : `— web'dagi Oylik hisob-kitob sahifasidan (${monthLabel(pm.month)})`;
    lines.push(`ℹ️ ${monthLabel(pm.month)} oyidan <b>${so(pm.amount)}</b> to'lanmagan — bu oyga kirmaydi, o'z oyidan chiqariladi ${where}`);
  }
  return lines;
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
    // Avans/Oylik qaysi oy uchun (04.10.2026) — oylik hisobi satrlaridan
    // OLDIN: pastdagi raqamlar aynan shu oyniki.
    if (d.periodMonth) lines.push(`Oy: <b>${monthLabel(d.periodMonth)}</b>`);
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

/**
 * Avans/Oylik qaysi oy uchun (04.10.2026). Sana o'zgarmaydi (pul bugun
 * chiqadi) — oy faqat qaysi oyning oyligidan ayrilishini aytadi. Ishora
 * aynan foydalanuvchi muammosi uchun: oktabrda berilgan sentabr oyligi
 * oktabrga yozilib, keyin sentabr "Oylikni chiqarish"da yana to'lanardi.
 */
export function chiqimMonthPrompt(d: ChiqimDraft, cashbox: BotCashbox, prevMonth: string): string {
  return [
    chiqimHeader(d, cashbox),
    `👉 ${esc(d.typeName ?? "To'lov")} <b>qaysi oy</b> uchun?`,
    `<i>O'tgan oyning oyligi yoki avansi berilayotgan bo'lsa — «${monthLabel(prevMonth)}» ni tanlang: pul o'sha oy hisobidan ayriladi. Sana baribir bugungi kun bo'ladi.</i>`,
  ].join("\n");
}

export function chiqimMethodPrompt(d: ChiqimDraft, cashbox: BotCashbox): string {
  return `${chiqimHeader(d, cashbox)}\n👉 Qaysi to'lov turidan chiqariladi? (qavsda kassadagi qoldiq)`;
}

export function chiqimNoBalance(d: ChiqimDraft, cashbox: BotCashbox): string {
  return `${chiqimHeader(d, cashbox)}\n⚠️ Kassada mablag' yo'q — hech bir to'lov turida qoldiq yo'q.`;
}

/** Chegara/qoldiq tugagan — sabab AYNAN aytiladi (web va server bilan bir xil matn). */
export function chiqimSalaryExhausted(d: ChiqimDraft, cashbox: BotCashbox, message: string): string {
  // Oy tanlangan bo'lsa (04.10.2026) — qoldiq boshqa oyda bo'lishi mumkin:
  // to'lov turi tugmalari tagida «📅 Oyni o'zgartirish» bor.
  const next = d.salaryPayout && d.periodMonth
    ? "Boshqa to'lov turini tanlang, «📅 Oyni o'zgartirish» ni bosing yoki bekor qiling."
    : "Boshqa to'lov turini tanlang yoki bekor qiling.";
  return `${chiqimHeader(d, cashbox)}\n⛔ ${esc(message)}\n\n${next}`;
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
    ...(d.periodMonth ? [`Oy: ${monthLabel(d.periodMonth)}`] : []),
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

/**
 * IZOHDAGI OY ≠ TANLANGAN OY (04.10.2026 dan MAJBURIY, lib/noteMonth.ts →
 * noteMonthConflict) — izoh qabul qilinmaydi, shu matn bilan qayta so'raladi.
 * Server ham rad etadi: bu yerda to'xtatilmasa kassir xatoni faqat
 * «Tasdiqlash»da ko'rardi.
 */
export function noteMonthClash(noteMonths: number[], periodMonth: string): string {
  const names = noteMonths.map((m) => MONTHS.uz[m - 1] ?? String(m)).join(", ");
  return `⚠️ Izohda <b>${esc(names)}</b> yozilgan, lekin to'lov <b>${esc(monthLabel(periodMonth))}</b> uchun. `
    + "Izohdagi oyni to'g'rilang yoki izohsiz davom eting.";
}

// ── Topshiriqlar (17.10.2026, lib/staffBot/tasks.ts) ────────────────
//
// Holat nomlari web bilan bir xil (lib/staffTasks.ts → STATUS_LABEL); vaqt
// Toshkent devor-soatida.

const TASK_ICON: Record<StaffTaskStatus, string> = {
  yangi: "🆕",
  tasdiq_kutilmoqda: "⏳",
  qaytarildi: "↩️",
  muddati_otdi: "⏰",
  yakunlandi: "✅",
  bajarilmadi: "❌",
  bekor: "🚫",
};

const UNIT_UZ = { min: "daqiqa", hour: "soat", day: "kun" } as const;

/** Toshkent vaqti: "17.10.2026 18:00". */
function whenUz(iso: string | null | undefined): string {
  const t = ms(iso);
  return Number.isFinite(t) ? `${dmy(uzDateOf(t))} ${uzTimeOf(t)}` : "—";
}

/** "3 soat qoldi" / "2 kun kechikdi". */
function leftUz(iso: string | null | undefined, nowMs: number): string {
  const delta = ms(iso) - nowMs;
  if (!Number.isFinite(delta)) return "";
  const { n, unit } = durParts(delta);
  return delta >= 0 ? `${n} ${UNIT_UZ[unit]} qoldi` : `${n} ${UNIT_UZ[unit]} kechikdi`;
}

const clipText = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
const stars = (p: number) => "★".repeat(p) + "☆".repeat(Math.max(0, 5 - p));
const isActiveTask = (s: StaffTaskStatus) => s === "yangi" || s === "qaytarildi" || s === "muddati_otdi";

/** Oxirgi qaytarish sababi — tarixdan. */
function lastReturnNote(t: StaffTaskDoc): string {
  for (let i = (t.history?.length ?? 0) - 1; i >= 0; i--) {
    const e = t.history[i];
    if (e.kind === "returned") return e.text ?? "";
  }
  return "";
}

/** Ro'yxat tugmasi: "⏰ Ali: Hisobotni topshirish · 17.10 18:00". */
export function taskButtonLabel(t: StaffTaskDoc, withName: boolean): string {
  const due = ms(t.status === "muddati_otdi" && t.redeadline ? t.redeadline : t.deadline);
  const when = Number.isFinite(due) ? ` · ${dmy(uzDateOf(due)).slice(0, 5)} ${uzTimeOf(due)}` : "";
  const who = withName ? `${t.employeeName.split(/\s+/)[0]}: ` : "";
  return `${TASK_ICON[t.status]} ${who}${clipText(t.title, 34)}${when}`;
}

/** Topshiriq kartasi. `as` — kim ko'rmoqda: ijrochi yoki bergan/rahbar. */
export function taskCardView(t: StaffTaskDoc, as: "mine" | "given", nowMs: number): string {
  const lines = [`📌 <b>${esc(t.title)}</b>`];
  if (t.desc) lines.push("", esc(clipText(t.desc, 700)));
  lines.push("", `Holat: ${TASK_ICON[t.status]} <b>${STATUS_LABEL[t.status]}</b>`);
  if (t.status === "muddati_otdi" && t.redeadline) {
    lines.push(`Muddat: ${whenUz(t.deadline)} (o'tgan)`);
    lines.push(`Qayta muddat: <b>${whenUz(t.redeadline)}</b> — ${leftUz(t.redeadline, nowMs)}`);
    if (t.fineAmount > 0) lines.push(`⚠️ Bu muddatda ham bajarilmasa jarima: <b>${fmtMoney(t.fineAmount)}</b>`);
  } else {
    lines.push(`Muddat: <b>${whenUz(t.deadline)}</b>${isActiveTask(t.status) ? ` — ${leftUz(t.deadline, nowMs)}` : ""}`);
    lines.push(`Muhimlik: ${stars(t.priority)}${t.fineAmount > 0 && isActiveTask(t.status) ? ` · bajarilmasa jarima ${fmtMoney(t.fineAmount)}` : ""}`);
  }
  lines.push(as === "mine" ? `Bergan: ${esc(t.createdBy?.name || "—")}` : `Ijrochi: <b>${esc(t.employeeName)}</b>`);
  if (t.link) lines.push(`🔗 ${esc(t.link)}`);
  if (t.attachments?.length) lines.push(`📎 ${t.attachments.length} ta fayl — saytda`);
  if (t.status === "qaytarildi") {
    const note = lastReturnNote(t);
    if (note) lines.push("", `↩️ Qaytarish sababi: ${esc(clipText(note, 400))}`);
  }
  if (t.status === "tasdiq_kutilmoqda") {
    lines.push("", `✅ <b>Bajarildi</b> — ${whenUz(t.doneAt)}${t.isLate ? " (kechikib)" : ""}`);
    if (t.doneNote) lines.push(`Izoh: ${esc(clipText(t.doneNote, 500))}`);
    if (t.resultLink) lines.push(`🔗 ${esc(t.resultLink)}`);
    if (t.resultFile) lines.push("📎 Natija fayli — saytda");
    if (as === "mine") lines.push("", "<i>Rahbar tasdiqlashini kutmoqda.</i>");
  }
  if (t.status === "bekor" && t.cancelReason) lines.push(`Sabab: ${esc(clipText(t.cancelReason, 400))}`);
  return lines.join("\n");
}

export function myTasksView(tasks: StaffTaskDoc[], shown: number): string {
  const active = tasks.filter((t) => isActiveTask(t.status)).length;
  const waiting = tasks.filter((t) => t.status === "tasdiq_kutilmoqda").length;
  const lines = ["📥 <b>Sizga berilgan topshiriqlar</b>", ""];
  if (tasks.length === 0) {
    lines.push("Hozircha ochiq topshiriq yo'q ✅");
  } else {
    lines.push(`Bajarish kerak: <b>${active}</b>`);
    if (waiting) lines.push(`Rahbar tasdig'ini kutmoqda: <b>${waiting}</b>`);
    lines.push("", "Batafsil ko'rish uchun topshiriqni tanlang 👇");
    if (tasks.length > shown) lines.push(`<i>Eng yaqin ${shown} tasi ko'rsatildi — hammasi saytda.</i>`);
  }
  return lines.join("\n");
}

export function givenTasksView(tasks: StaffTaskDoc[], shown: number): string {
  const waiting = tasks.filter((t) => t.status === "tasdiq_kutilmoqda").length;
  const overdue = tasks.filter((t) => t.status === "muddati_otdi").length;
  const inWork = tasks.length - waiting - overdue;
  const lines = ["📤 <b>Siz bergan topshiriqlar</b>", ""];
  if (tasks.length === 0) {
    lines.push("Siz bergan ochiq topshiriq yo'q.");
  } else {
    lines.push(`Tasdig'ingizni kutmoqda: <b>${waiting}</b>`);
    lines.push(`Jarayonda: <b>${inWork}</b>`);
    if (overdue) lines.push(`Muddati o'tgan: <b>${overdue}</b>`);
    lines.push("", "Batafsil ko'rish uchun topshiriqni tanlang 👇");
    if (tasks.length > shown) lines.push(`<i>Birinchi ${shown} tasi ko'rsatildi — hammasi saytda.</i>`);
  }
  return lines.join("\n");
}

export function taskNotFound(): string {
  return "🔍 Topshiriq topilmadi yoki uni ko'rish huquqingiz yo'q.";
}

export function taskActionFailed(error: string): string {
  return `⚠️ ${esc(error)}`;
}

export function taskDonePrompt(t: StaffTaskDoc): string {
  return [
    `✅ <b>${esc(t.title)}</b>`,
    "",
    "Nima qildingiz? Qisqa izoh yozing — rahbarga boradi.",
    "Izohsiz ham yuborishingiz mumkin.",
    "",
    "<i>Fayl yoki havola biriktirish — saytdagi topshiriq oynasida.</i>",
  ].join("\n");
}

export function taskDoneSent(t: StaffTaskDoc, late: boolean): string {
  return [
    "✅ <b>Yuborildi</b>",
    "",
    `«${esc(t.title)}» — rahbar tasdiqlashini kutadi.`,
    ...(late ? ["", "⏰ Muddat o'tgan edi — «kechikib bajarildi» deb belgilandi."] : []),
  ].join("\n");
}

export function taskApproveSure(t: StaffTaskDoc): string {
  return [
    "Topshiriqni tasdiqlaysizmi?",
    "",
    `<b>${esc(t.title)}</b>`,
    `Ijrochi: ${esc(t.employeeName)}`,
    ...(t.isLate ? ["⏰ Kechikib bajarilgan"] : []),
    ...(t.doneNote ? [`Izoh: ${esc(clipText(t.doneNote, 500))}`] : []),
  ].join("\n");
}

export function taskApprovedView(t: StaffTaskDoc): string {
  return `✅ <b>Tasdiqlandi</b>\n\n«${esc(t.title)}» — ${esc(t.employeeName)}. Topshiriq yakunlandi.`;
}

export function taskReturnPrompt(t: StaffTaskDoc): string {
  return [
    `↩️ <b>${esc(t.title)}</b>`,
    `Ijrochi: ${esc(t.employeeName)}`,
    "",
    "Nimani to'g'rilash kerak? Yozib yuboring — ijrochiga boradi.",
  ].join("\n");
}

export function taskReturnDeadlinePrompt(t: StaffTaskDoc, note: string, hasOptions: boolean): string {
  return [
    `↩️ <b>${esc(t.title)}</b>`,
    "",
    `Sabab: ${esc(clipText(note, 500))}`,
    "",
    hasOptions ? "Yangi muddatni tanlang 👇" : "Bugun uchun tayyor muddat qolmadi — topshiriqni saytda qaytaring.",
  ].join("\n");
}

export function taskReturnedView(t: StaffTaskDoc, deadline: string): string {
  return `↩️ <b>Qaytarildi</b>\n\n«${esc(t.title)}» — ${esc(t.employeeName)} ga qaytarildi.\nYangi muddat: <b>${whenUz(deadline)}</b>`;
}

export function taskNeedsPassword(): string {
  return "🔑 Tasdiqlash va qaytarish uchun parol bilan kiring — bosh menyudagi «Parol bilan kirish».";
}

// Push xabarlar (lib/staffBot/taskNotify.ts) — tizim o'zi yozadi.

export function taskNewPush(t: StaffTaskDoc, nowMs: number): string {
  return `📌 <b>Sizga yangi topshiriq</b>\n\n${taskCardView(t, "mine", nowMs)}`;
}

/** Bir martalik yuborish (scripts/send-open-tasks.mjs): bot ulanishidan oldin berilgan ochiq topshiriq. */
export function taskOpenPush(t: StaffTaskDoc, nowMs: number): string {
  return `📌 <b>Sizda ochiq topshiriq bor</b>\n\n${taskCardView(t, "mine", nowMs)}`;
}

export function taskReturnedPush(t: StaffTaskDoc, note: string, nowMs: number): string {
  return [
    "↩️ <b>Topshiriq qaytarildi</b>",
    "",
    `<b>${esc(t.title)}</b>`,
    `Sabab: ${esc(clipText(note, 500))}`,
    `Yangi muddat: <b>${whenUz(t.deadline)}</b> — ${leftUz(t.deadline, nowMs)}`,
    `Bergan: ${esc(t.createdBy?.name || "—")}`,
  ].join("\n");
}

export function taskApprovedPush(t: StaffTaskDoc): string {
  return [
    "✅ <b>Topshiriq tasdiqlandi</b>",
    "",
    `<b>${esc(t.title)}</b>`,
    t.completedLate ? "Kechikib bajarilgan deb belgilandi." : "Rahmat — o'z vaqtida bajarildi!",
  ].join("\n");
}

export function taskCancelledPush(t: StaffTaskDoc, reason: string): string {
  return [
    "🚫 <b>Topshiriq bekor qilindi</b>",
    "",
    `<b>${esc(t.title)}</b>`,
    `Sabab: ${esc(clipText(reason, 500))}`,
    "",
    "Endi bajarish shart emas.",
  ].join("\n");
}

/**
 * Muddat eslatmasi (lib/staffTaskReminders.ts):
 *   day — 1 kun qoldi; soon — 2 soat qoldi; overdue — muddat o'tdi (qayta
 *   muddat va jarima); grace — qayta muddatga 2 soat qoldi.
 */
export function taskReminderPush(t: StaffTaskDoc, kind: "day" | "soon" | "overdue" | "grace", nowMs: number): string {
  const fine = t.fineAmount > 0 ? fmtMoney(t.fineAmount) : "";
  if (kind === "overdue" || kind === "grace") {
    const re = t.redeadline ?? t.deadline;
    const lines = [kind === "overdue" ? "⏰ <b>Topshiriq muddati o'tdi</b>" : "⚠️ <b>Oxirgi muddat yaqin</b>", "", `<b>${esc(t.title)}</b>`];
    if (kind === "overdue") lines.push(`Muddat edi: ${whenUz(t.deadline)}`);
    lines.push(
      `Qayta muddat: <b>${whenUz(re)}</b> — ${leftUz(re, nowMs)}`,
      fine ? `⚠️ Shu vaqtgacha bajarilmasa jarima: <b>${fine}</b>` : "⚠️ Shu vaqtgacha bajarilmasa topshiriq «Bajarilmadi» bo'ladi.",
      "",
      "Bajarib bo'lsangiz «✅ Bajardim» ni bosing.",
    );
    return lines.join("\n");
  }
  return [
    kind === "day" ? "🔔 <b>Eslatma: topshiriq muddatiga 1 kun qoldi</b>" : "🔔 <b>Eslatma: topshiriq muddati yaqin</b>",
    "",
    `<b>${esc(t.title)}</b>`,
    `Muddat: <b>${whenUz(t.deadline)}</b> — ${leftUz(t.deadline, nowMs)}`,
    `Bergan: ${esc(t.createdBy?.name || "—")}`,
    "",
    "Bajarib bo'lsangiz «✅ Bajardim» ni bosing.",
  ].join("\n");
}

export function taskDonePush(t: StaffTaskDoc): string {
  return [
    `📥 <b>${esc(t.employeeName)} topshiriqni bajardi</b>`,
    "",
    `<b>${esc(t.title)}</b>`,
    ...(t.isLate ? ["⏰ Kechikib bajarildi"] : []),
    `Izoh: ${t.doneNote ? esc(clipText(t.doneNote, 500)) : "—"}`,
    ...(t.resultLink ? [`🔗 ${esc(t.resultLink)}`] : []),
    ...(t.resultFile ? ["📎 Natija fayli — saytda"] : []),
    "",
    "Tasdiqlaysizmi yoki qaytarasizmi?",
  ].join("\n");
}
