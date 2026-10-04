import { applyCashboxAdjust } from "@/lib/cashboxAdjust";
import { PLASTIK_METHOD_KEY } from "@/lib/paymentMethods";
import { studentPaidBalance } from "@/lib/pupilsDb";
import { payrollMonthKey, payrollPeriod, prevMonthKey } from "@/lib/salary";
import { noteMonthConflict } from "@/lib/noteMonth";
import { refundTeacherOf } from "@/lib/studentRefund";
import { isEmployeePayoutCategory } from "@/lib/teacherOfStudent";
import { txTarget } from "@/lib/txTarget";
import { uzDateIso } from "@/lib/uzTime";
import type { BotCashbox } from "@/lib/staffBot/auth";
import {
  employeeSalaryInfo,
  loadActiveMethods,
  loadChiqimTypes,
  loadEmployeeHit,
  loadPupilHit,
  searchEmployees,
  searchPupils,
} from "@/lib/staffBot/data";
import { newNonce, parseAmount, show, type CallbackResult, type FlowCtx } from "@/lib/staffBot/flow";
import {
  CHIQIM_CB,
  afterSaveKeyboard,
  backToMenu,
  chiqimAmountKeyboard,
  chiqimCancelOnly,
  chiqimConfirmArg,
  chiqimConfirmKeyboard,
  chiqimEmployeeArg,
  chiqimMethodArg,
  chiqimMethodKeyboard,
  chiqimMonthArg,
  chiqimMonthKeyboard,
  chiqimNoteKeyboard,
  chiqimPageArg,
  chiqimPersonKeyboard,
  chiqimStudentArg,
  chiqimTypeArg,
  chiqimTypeKeyboard,
  type MonthOption,
} from "@/lib/staffBot/keyboards";
import {
  claimDraftForSave,
  liveDraft,
  releaseDraft,
  setDraft,
  type ChiqimDraft,
} from "@/lib/staffBot/session";
import * as V from "@/lib/staffBot/views";
import { formatPhone } from "@/lib/studentBot/phone";
import { fmtUZS, monthLabel } from "@/lib/studentBot/views";

// 💸 CHIQIM — botdagi kassadan chiqim oqimi.
//
// Web'dagi Chiqim oynasi (components/finance/CashboxAdjustDrawer.tsx)
// bilan BIR XIL qoidalar:
//   • tur → KIM (turning "Mijoz" sozlamasiga qarab xodim yoki o'quvchi,
//     yoki hech kim — lib/txTarget.ts) → (Avans/Oylikda: OY) → to'lov
//     turi → summa → izoh → tasdiq;
//   • to'lov turlari — faqat kassada qoldig'i borlari;
//   • Avans/Oylik — xodimning TANLANGAN oydagi qoldig'idan oshmaydi (naqd:
//     `payrollCashLeg`, plastik: `payrollPayout` — 16.09.2026 "karta
//     birinchi" qoidasi); "Oylik" da summa qo'lda terilmaydi, qoldiqning
//     o'zi (18.09.2026 qoidasi); oyligi sozlanmagan xodimga chegara yo'q;
//   • O'quvchiga qaytarish — balansdan oshmaydi, ustoz oxirgi to'lovdan;
//   • hamma 24 tur ko'rsatiladi, sahifalab (foydalanuvchi qarori).
// Tartibdagi bitta farq: to'lov turi SUMMADAN OLDIN so'raladi — chegara
// (naqd/plastik) va kassadagi qoldiq unga bog'liq, kassir summani yozishdan
// oldin qancha mumkinligini ko'rishi kerak.
// Yozishning o'zi yadroda (lib/cashboxAdjust.ts) — web bilan bitta kod;
// u chegaralarni yana bir bor tekshiradi.
//
// "QAYSI OY UCHUN" (04.10.2026, web'dagi Chiqim oynasi bilan birga): xodimga
// Avans/Oylikda xodim tanlangach oy so'raladi — O'TGAN yoki SHU oy (shu oy
// belgilangan, kelajak yo'q). Oylik hisobi (`salary` → chegara, "Oylik"
// qulflangan summasi) aynan shu oy qatoridan olinadi va oy yadroga
// `periodMonth` bo'lib ketadi; sana o'zgarmaydi (bugun).
// NIMA NOTO'G'RI EDI: bot doim bugungi sanani yuborardi va chegarani ham
// bugungi oydan olardi — oktabrda berilgan SENTABR oyligi oktabrga
// yozilardi: sentabr sahifasida ayrilmasdi, keyin sentabr uchun "Oylikni
// chiqarish" uni IKKINCHI marta to'lardi.
// Tartib: tur → xodim → OY → to'lov turi → summa (Oylikda yo'q) → izoh →
// tasdiq. Boshqa turlarda oy bosqichi yo'q.

function cashboxOrNull(ctx: FlowCtx): BotCashbox | null {
  return ctx.access.cashbox;
}

/**
 * Avans/Oylik oy tugmalari: O'TGAN · SHU (belgilangan). KELAJAK yo'q — server
 * ham rad etadi. "Shu oy" TOSHKENT vaqti bo'yicha `payrollPeriod` dan —
 * server kelajak oyni aynan shu bilan tekshiradi (lib/cashboxAdjust.ts),
 * ya'ni oy almashadigan tunda bot va server bir-biriga zid bo'lmaydi.
 */
function payoutMonthOptions(): MonthOption[] {
  const p = payrollPeriod();
  const cur = payrollMonthKey(p);
  const prev = prevMonthKey(p);
  return [
    { month: prev, label: monthLabel(prev), current: false },
    { month: cur, label: monthLabel(cur), current: true },
  ];
}

async function advance(ctx: FlowCtx, d: ChiqimDraft): Promise<void> {
  await setDraft(ctx.db, ctx.chatId, d);
}

/** Tanlangan to'lov turida CHIQARISH MUMKIN bo'lgan oylik qoldig'i (web: `remainingSalary`). */
function salaryRemaining(d: ChiqimDraft): number | null {
  if (!d.salaryPayout || !d.salary?.configured) return null;
  return d.methodKey === PLASTIK_METHOD_KEY ? d.salary.jami : d.salary.naqd;
}

/** Qoldiq tugaganida sabab — web va server bilan bir xil matn. */
function exhaustedMessage(d: ChiqimDraft): string {
  const s = d.salary!;
  const isPlastik = d.methodKey === PLASTIK_METHOD_KEY;
  // Karta hali to'liq qoplanmagan — naqd 0 bo'lishining sababi shu.
  const kartaYetmadi = !isPlastik && s.naqd <= 0 && s.plastikSalary > 0 && s.jami > 0;
  return kartaYetmadi
    ? `Hisoblangan oylik karta summasidan oshmaydi — naqd avans yoki oylik chiqarib bo'lmaydi (qoldiq ${fmtUZS(s.karta)} so'm kartaga ketadi)`
    : "Bu oyda xodimga chiqariladigan qoldiq yo'q — oylik to'liq chiqarilgan yoki hali hisoblanmagan";
}

/** Kassada shu to'lov turidan qancha bor — chiqim shundan oshmaydi. */
function availableOf(cashbox: BotCashbox, methodKey: string | undefined): number {
  return methodKey ? (cashbox.methodTotals[methodKey] ?? 0) : 0;
}

/** Summaga qo'yiladigan chegara (kassa qoldig'idan tashqari) va uning nomi. */
function amountLimit(d: ChiqimDraft): { limit: number | null; label: string } {
  const rem = salaryRemaining(d);
  if (rem !== null) {
    return {
      limit: Math.max(0, rem),
      label: d.methodKey === PLASTIK_METHOD_KEY ? "Qolgan oylik (kartaga)" : "Naqd chiqarish mumkin",
    };
  }
  if (d.target === "student") return { limit: Math.max(0, d.studentBalance ?? 0), label: "O'quvchi balansi" };
  return { limit: null, label: "" };
}

/** Summa qoidaga to'g'ri keladimi — `null` bo'lsa yaroqli, aks holda rad sababi. */
function amountProblem(d: ChiqimDraft, cashbox: BotCashbox, amount: number): string | null {
  const available = availableOf(cashbox, d.methodKey);
  if (amount > available) return `Mablag' yetarli emas — kassada ${d.methodName ?? ""}: ${fmtUZS(available)} so'm`;
  const rem = salaryRemaining(d);
  if (rem !== null && amount > rem) {
    return `Summa ${d.methodKey === PLASTIK_METHOD_KEY ? "qolgan oylikdan" : "naqd chiqarish mumkin bo'lgan summadan"} (${fmtUZS(rem)} so'm) ko'p bo'lishi mumkin emas`;
  }
  if (d.target === "student" && amount > (d.studentBalance ?? 0)) {
    return `Summa o'quvchi balansidan (${fmtUZS(d.studentBalance ?? 0)} so'm) ko'p bo'lishi mumkin emas`;
  }
  return null;
}

// ── Qadamlar ────────────────────────────────────────────────────────

async function showType(ctx: FlowCtx, d: ChiqimDraft, cashbox: BotCashbox): Promise<void> {
  const types = await loadChiqimTypes(ctx.db);
  if (types.length === 0) {
    await setDraft(ctx.db, ctx.chatId, null);
    await show(ctx, { html: V.chiqimNoTypes(), keyboard: backToMenu() });
    return;
  }
  await show(ctx, { html: V.chiqimTypePrompt(d, cashbox), keyboard: chiqimTypeKeyboard(types, d.typePage ?? 0) });
}

async function showPerson(ctx: FlowCtx, d: ChiqimDraft, cashbox: BotCashbox): Promise<void> {
  await show(ctx, { html: V.chiqimPersonPrompt(d, cashbox), keyboard: chiqimCancelOnly() });
}

async function showMethod(ctx: FlowCtx, d: ChiqimDraft, cashbox: BotCashbox, note?: string): Promise<void> {
  const methods = (await loadActiveMethods(ctx.db))
    .map((m) => ({ key: m.key, name: m.name, balance: cashbox.methodTotals[m.key] ?? 0 }))
    .filter((m) => m.balance > 0);
  if (methods.length === 0) {
    await show(ctx, { html: V.chiqimNoBalance(d, cashbox), keyboard: chiqimCancelOnly() });
    return;
  }
  const html = note ? `${note}` : V.chiqimMethodPrompt(d, cashbox);
  // Oy tanlangan Avans/Oylikda — oyga qaytish tugmasi (eski, oysiz qoralamada yo'q).
  await show(ctx, { html, keyboard: chiqimMethodKeyboard(methods, !!(d.salaryPayout && d.periodMonth)) });
}

async function showMonth(ctx: FlowCtx, d: ChiqimDraft, cashbox: BotCashbox): Promise<void> {
  const options = payoutMonthOptions();
  await show(ctx, { html: V.chiqimMonthPrompt(d, cashbox, options[0].month), keyboard: chiqimMonthKeyboard(options) });
}

async function showAmount(ctx: FlowCtx, d: ChiqimDraft, cashbox: BotCashbox, note?: string): Promise<void> {
  const available = availableOf(cashbox, d.methodKey);
  const { limit, label } = amountLimit(d);
  // "Hammasi" FAQAT chegarasi bor turlarda (avans/oylik qoldig'i, o'quvchi
  // balansi) — chegara va kassa qoldig'ining kichigi. Oddiy xarajatda
  // "hammasi" = butun kassa bo'lardi; bunday tugma bexosdan bosiladi.
  const max = limit !== null ? Math.min(limit, available) : null;
  const html = note ?? V.chiqimAmountPrompt(d, cashbox, { available, limit, limitLabel: label });
  await show(ctx, { html, keyboard: chiqimAmountKeyboard(max) });
}

async function showNote(ctx: FlowCtx, d: ChiqimDraft, cashbox: BotCashbox): Promise<void> {
  await show(ctx, { html: V.chiqimNotePrompt(d, cashbox), keyboard: chiqimNoteKeyboard() });
}

async function showConfirm(ctx: FlowCtx, d: ChiqimDraft, cashbox: BotCashbox, note?: string): Promise<void> {
  const body = V.chiqimConfirmView(d, cashbox, uzDateIso());
  await show(ctx, { html: note ? `${note}\n\n${body}` : body, keyboard: chiqimConfirmKeyboard(d.nonce) });
}

async function showCurrent(ctx: FlowCtx, d: ChiqimDraft, cashbox: BotCashbox): Promise<void> {
  switch (d.step) {
    case "type": return showType(ctx, d, cashbox);
    case "person": return showPerson(ctx, d, cashbox);
    case "month": return showMonth(ctx, d, cashbox);
    case "method": return showMethod(ctx, d, cashbox);
    case "amount": return showAmount(ctx, d, cashbox);
    case "note": return showNote(ctx, d, cashbox);
    default: return showConfirm(ctx, d, cashbox);
  }
}

async function stale(ctx: FlowCtx, d: ChiqimDraft, cashbox: BotCashbox, toast = "Bu tugma eskirgan"): Promise<CallbackResult> {
  await showCurrent(ctx, d, cashbox);
  return { handled: true, toast };
}

/** Summa qabul qilindi (qo'lda yoki "Hammasi") — izohga o'tish. */
async function acceptAmount(ctx: FlowCtx, d: ChiqimDraft, cashbox: BotCashbox, amount: number): Promise<void> {
  const problem = amountProblem(d, cashbox, amount);
  if (problem) {
    await showAmount(ctx, d, cashbox, V.chiqimAmountRejected(d, cashbox, problem));
    return;
  }
  const next: ChiqimDraft = { ...d, amount, step: "note" };
  await advance(ctx, next);
  await showNote(ctx, next, cashbox);
}

// ── Kirish nuqtalari ────────────────────────────────────────────────

/** "💸 Chiqim" bosildi — yangi qoralama, birinchi qadam. */
export async function startChiqim(ctx: FlowCtx): Promise<void> {
  if (!ctx.access.canCash) {
    await show(ctx, { html: V.noPermission(), keyboard: backToMenu() });
    return;
  }
  const cashbox = cashboxOrNull(ctx);
  if (!cashbox) {
    await show(ctx, { html: V.noCashbox(), keyboard: backToMenu() });
    return;
  }
  const d: ChiqimDraft = { kind: "chiqim", step: "type", typePage: 0, nonce: newNonce(), updatedAt: Date.now() };
  await advance(ctx, d);
  await showType(ctx, d, cashbox);
}

export async function chiqimCallback(ctx: FlowCtx, data: string): Promise<CallbackResult> {
  if (!data.startsWith("s:c:")) return { handled: false };

  if (data === CHIQIM_CB.cancel) {
    await setDraft(ctx.db, ctx.chatId, null);
    await show(ctx, { html: V.chiqimCancelled(), keyboard: backToMenu() });
    return { handled: true };
  }
  if (data === CHIQIM_CB.restart) {
    await startChiqim(ctx);
    return { handled: true };
  }

  const cashbox = cashboxOrNull(ctx);
  if (!ctx.access.canCash || !cashbox) {
    await setDraft(ctx.db, ctx.chatId, null);
    await show(ctx, { html: cashbox ? V.noPermission() : V.noCashbox(), keyboard: backToMenu() });
    return { handled: true };
  }

  // TASDIQ — atom band qilish, keyin yozish (Kirim bilan bir xil).
  const nonce = chiqimConfirmArg(data);
  if (nonce) {
    const claimed = await claimDraftForSave(ctx.db, ctx.chatId, nonce, "chiqim");
    if (!claimed) return { handled: true, toast: V.alreadySaved() };
    await saveChiqim(ctx, claimed, cashbox);
    return { handled: true };
  }

  const d = liveDraft(ctx.user);
  if (!d || d.kind !== "chiqim") {
    await show(ctx, { html: V.draftExpired(), keyboard: backToMenu() });
    return { handled: true };
  }
  if (d.step === "saving") return { handled: true, toast: "Saqlanmoqda…" };

  // Turlar sahifasi.
  const page = chiqimPageArg(data);
  if (page !== null) {
    if (d.step !== "type") return stale(ctx, d, cashbox);
    const next: ChiqimDraft = { ...d, typePage: page };
    await advance(ctx, next);
    await showType(ctx, next, cashbox);
    return { handled: true };
  }

  const typeId = chiqimTypeArg(data);
  if (typeId !== null) {
    if (d.step !== "type") return stale(ctx, d, cashbox);
    const type = (await loadChiqimTypes(ctx.db)).find((t) => t.id === typeId);
    if (!type) return stale(ctx, d, cashbox, "Bu tur endi yo'q");
    // KIM tanlanishi — Sozlamalardagi "Mijoz" katakchalaridan; ikkalasi
    // belgilangan bo'lsa XODIM ustun (lib/txTarget.ts izohi).
    const target = txTarget(type);
    const salaryPayout = target === "employee" && isEmployeePayoutCategory(type.name);
    const next: ChiqimDraft = {
      ...d,
      typeId: type.id,
      typeName: type.name,
      target,
      salaryPayout,
      oylikLocked: target === "employee" && /oylik/i.test(type.name),
      step: target ? "person" : "method",
    };
    await advance(ctx, next);
    if (target) await showPerson(ctx, next, cashbox);
    else await showMethod(ctx, next, cashbox);
    return { handled: true };
  }

  const empId = chiqimEmployeeArg(data);
  if (empId !== null) {
    if (d.step !== "person" || d.target !== "employee") return stale(ctx, d, cashbox);
    const emp = await loadEmployeeHit(ctx.db, empId);
    if (!emp) return stale(ctx, d, cashbox, "Xodim topilmadi");
    // Avans/Oylik — avval OY so'raladi (04.10.2026): oylik hisobi (chegara)
    // o'sha oyning qatoridan, shu bois u oy tanlangach yuklanadi. Boshqa
    // xodim turlarida (KPI bonusi, mukofot) chegara ham, oy ham yo'q —
    // to'g'ridan-to'g'ri to'lov turiga.
    const next: ChiqimDraft = {
      ...d,
      personId: emp.id,
      personName: emp.name,
      personPhone: emp.phone,
      personRole: emp.turi,
      step: d.salaryPayout ? "month" : "method",
    };
    await advance(ctx, next);
    if (d.salaryPayout) await showMonth(ctx, next, cashbox);
    else await showMethod(ctx, next, cashbox);
    return { handled: true };
  }

  const month = chiqimMonthArg(data);
  if (month !== null) {
    if (d.step !== "month" || !d.salaryPayout || !d.personName) return stale(ctx, d, cashbox);
    // Faqat HOZIR ko'rsatiladigan oylar (o'tgan · shu). Tun yarmida oy
    // almashgan bo'lsa eski xabardagi tugma rad etiladi va yangi tugmalar
    // chiziladi; to'qib yuborilgan kelajak oy ham shu yerda to'xtaydi.
    if (!payoutMonthOptions().some((o) => o.month === month)) {
      return stale(ctx, d, cashbox, "Oy almashdi — qaytadan tanlang");
    }
    // Chegara TANLANGAN oy qatoridan — server ham `periodMonth` bo'yicha
    // aynan shu qatorni tekshiradi (lib/cashboxAdjust.ts).
    const salary = await employeeSalaryInfo(ctx.db, d.personName, month);
    const next: ChiqimDraft = { ...d, periodMonth: month, salary: salary ?? undefined, step: "method" };
    await advance(ctx, next);
    await showMethod(ctx, next, cashbox);
    return { handled: true };
  }

  if (data === CHIQIM_CB.monthBack) {
    // Faqat to'lov turi qadamida (to'lov turi hali tanlanmagan) — keyingi
    // qadamlarda summa allaqachon eski oy chegarasi bilan tekshirilgan.
    if (d.step !== "method" || !d.salaryPayout || !d.periodMonth) return stale(ctx, d, cashbox);
    const next: ChiqimDraft = { ...d, periodMonth: undefined, salary: undefined, step: "month" };
    await advance(ctx, next);
    await showMonth(ctx, next, cashbox);
    return { handled: true };
  }

  const pupilId = chiqimStudentArg(data);
  if (pupilId !== null) {
    if (d.step !== "person" || d.target !== "student") return stale(ctx, d, cashbox);
    const hit = await loadPupilHit(ctx.db, pupilId);
    if (!hit) return stale(ctx, d, cashbox, "O'quvchi topilmadi");
    // ID bo'yicha — kassir ro'yxatdan AYNAN shu o'quvchini tanlagan,
    // ismdoshning balansi/ustozi aralashmasin (lib/pupilEntries.ts).
    const ref = { id: hit.id, name: hit.name };
    // Qaytarish chegarasi — faqat NAQD to'langani (tanga evaziga chegirma
    // balansda bor, lekin u naqd qaytarilmaydi; lib/pupilsDb.ts).
    const [balance, teacher] = await Promise.all([
      studentPaidBalance(ctx.db, ref, { cashOnly: true }),
      refundTeacherOf(ctx.db, ref),
    ]);
    const next: ChiqimDraft = {
      ...d,
      personId: hit.id,
      personName: hit.name,
      personPhone: hit.phone,
      studentBalance: balance,
      refundTeacher: teacher ?? "",
      step: "method",
    };
    await advance(ctx, next);
    await showMethod(ctx, next, cashbox);
    return { handled: true };
  }

  const methodKey = chiqimMethodArg(data);
  if (methodKey !== null) {
    if (d.step !== "method") return stale(ctx, d, cashbox);
    const m = (await loadActiveMethods(ctx.db)).find((x) => x.key === methodKey);
    if (!m) return stale(ctx, d, cashbox, "Bu to'lov turi endi faol emas");
    const withMethod: ChiqimDraft = { ...d, methodKey: m.key, methodName: m.name };

    // Avans/Oylik: tanlangan to'lov turida qoldiq bormi.
    const rem = salaryRemaining(withMethod);
    if (rem !== null && rem <= 0) {
      // Qoralama `method` qadamida qoladi — boshqa turni tanlash mumkin.
      await advance(ctx, { ...d });
      await showMethod(ctx, d, cashbox, V.chiqimSalaryExhausted(withMethod, cashbox, exhaustedMessage(withMethod)));
      return { handled: true };
    }

    // "OYLIK" — summa qoldiqning o'zi, qo'lda terilmaydi.
    if (withMethod.oylikLocked && rem !== null) {
      const problem = amountProblem(withMethod, cashbox, rem);
      if (problem) {
        await advance(ctx, { ...d });
        await showMethod(ctx, d, cashbox, V.chiqimSalaryExhausted(withMethod, cashbox, problem));
        return { handled: true };
      }
      const next: ChiqimDraft = { ...withMethod, amount: rem, step: "note" };
      await advance(ctx, next);
      await showNote(ctx, next, cashbox);
      return { handled: true };
    }

    const next: ChiqimDraft = { ...withMethod, step: "amount" };
    await advance(ctx, next);
    await showAmount(ctx, next, cashbox);
    return { handled: true };
  }

  if (data === CHIQIM_CB.amountMax) {
    if (d.step !== "amount") return stale(ctx, d, cashbox);
    const { limit } = amountLimit(d);
    // Tugma faqat chegarali turlarda chiqadi (showAmount) — chegarasiz
    // turda eski xabardan bosilsa hech narsa qilinmaydi.
    if (limit === null) return stale(ctx, d, cashbox, "Bu turda \"Hammasi\" yo'q — summani yozing");
    const max = Math.min(limit, availableOf(cashbox, d.methodKey));
    if (max <= 0) return stale(ctx, d, cashbox, "Chiqarish mumkin bo'lgan summa yo'q");
    await acceptAmount(ctx, d, cashbox, max);
    return { handled: true };
  }

  if (data === CHIQIM_CB.noteSkip) {
    if (d.step !== "note") return stale(ctx, d, cashbox);
    const next: ChiqimDraft = { ...d, note: "", step: "confirm" };
    await advance(ctx, next);
    await showConfirm(ctx, next, cashbox);
    return { handled: true };
  }

  return stale(ctx, d, cashbox, "Tugma tanilmadi");
}

/** Matn keldi. `true` — qoralama uni qabul qildi. */
export async function chiqimText(ctx: FlowCtx, text: string): Promise<boolean> {
  const d = liveDraft(ctx.user);
  if (!d || d.kind !== "chiqim") return false;
  const cashbox = cashboxOrNull(ctx);
  if (!ctx.access.canCash || !cashbox) return false;

  switch (d.step) {
    case "person": {
      const q = text.trim();
      // Ikki manba, ikki xil yorliq — birlashtirilgan tipda `in` bilan
      // toraytirish serverdagi TS'da o'tmadi (18.09.2026 deploy), shu
      // bois har tomon o'z tugmalarini o'zi yasaydi.
      const kind = d.target === "employee" ? "employee" : "student";
      const found = kind === "employee"
        ? await searchEmployees(ctx.db, q).then((r) => r && {
            more: r.more,
            options: r.hits.map((h) => ({ id: h.id, label: h.turi ? `${h.name} · ${roleWord(h.turi)}` : h.name })),
          })
        : await searchPupils(ctx.db, q, cashbox.branchId).then((r) => r && {
            more: r.more,
            options: r.hits.map((h) => ({ id: h.id, label: h.phone ? `${h.name} · ${formatPhone(h.phone)}` : h.name })),
          });
      if (!found) {
        await show(ctx, { html: V.chiqimQueryTooShort(d, cashbox), keyboard: chiqimCancelOnly() });
        return true;
      }
      if (found.options.length === 0) {
        await show(ctx, { html: V.chiqimPersonNotFound(d, cashbox, q), keyboard: chiqimCancelOnly() });
        return true;
      }
      await show(ctx, {
        html: V.chiqimPersonResults(d, cashbox, q, found.options.length, found.more),
        keyboard: chiqimPersonKeyboard(found.options, kind),
      });
      return true;
    }
    case "amount": {
      const amount = parseAmount(text);
      if (amount === null) {
        await showAmount(ctx, d, cashbox, V.chiqimBadAmount(d, cashbox));
        return true;
      }
      await acceptAmount(ctx, d, cashbox, amount);
      return true;
    }
    case "note": {
      const note = text.trim().slice(0, 500);
      // IZOHDAGI OY ≠ TANLANGAN OY — MAJBURIY (04.10.2026): faqat oy
      // tanlangan Avans/Oylikda (server ham shu holatda rad etadi —
      // lib/cashboxAdjust.ts); izoh qabul qilinmaydi va qayta so'raladi.
      const clash = d.salaryPayout && d.periodMonth ? noteMonthConflict(note, d.periodMonth) : null;
      if (clash && d.periodMonth) {
        await show(ctx, {
          html: `${V.noteMonthClash(clash, d.periodMonth)}\n\n${V.chiqimNotePrompt(d, cashbox)}`,
          keyboard: chiqimNoteKeyboard(),
        });
        return true;
      }
      const next: ChiqimDraft = { ...d, note, step: "confirm" };
      await advance(ctx, next);
      await showConfirm(ctx, next, cashbox);
      return true;
    }
    default:
      await showCurrent(ctx, d, cashbox);
      return true;
  }
}

function roleWord(turi: string): string {
  return turi === "teacher" ? "o'qituvchi" : turi === "moderator" ? "moderator" : turi === "admin" ? "admin" : turi;
}

// ── Saqlash ─────────────────────────────────────────────────────────

async function saveChiqim(ctx: FlowCtx, d: ChiqimDraft, cashbox: BotCashbox): Promise<void> {
  if (!d.amount || !d.methodKey || !d.typeName || (d.target && !d.personName)) {
    await releaseDraft(ctx.db, ctx.chatId, d.nonce);
    await showConfirm(ctx, d, cashbox, V.chiqimFailed("qoralama to'liq emas"));
    return;
  }
  const out = await applyCashboxAdjust(
    ctx.db,
    {
      cashboxId: cashbox.id,
      mode: "chiqim",
      method: d.methodKey,
      amount: d.amount,
      category: d.typeName,
      // Jurnaldagi "KIM" ustuni — o'quvchi ham, xodim ham `studentName` da
      // (web'dagi Chiqim oynasi bilan bir xil kelishuv).
      studentName: d.personName ?? "",
      // O'QUVCHIGA pul qaytarilganda yozuvning egasi ham yoziladi
      // (`pupilId`). Xodimga chiqimda YUBORILMAYDI: u yerda `personId`
      // xodimning id'si va uni o'quvchi deb belgilash yozuvni begona
      // bolaning to'lovlari orasiga tashlab yuborardi.
      ...(d.target === "student" && d.personId !== undefined ? { studentId: d.personId } : {}),
      // Yozuv KIMNING oyligiga tegishli: xodimga chiqim — o'sha xodim;
      // o'quvchiga qaytarish — tushumidan ayriladigan ustoz (bo'sh bo'lsa
      // yadro o'zi topadi).
      teacherName: d.target === "employee" ? (d.personName ?? "") : d.target === "student" ? (d.refundTeacher ?? "") : "",
      // Sana — BUGUN (pul hozir chiqdi), oy esa tanlangani (04.10.2026):
      // yozuv o'sha oyning oyligidan ayriladi va server chegarani ham o'sha
      // oy qatoridan tekshiradi. Faqat Avans/Oylikda — boshqa chiqim hech
      // kimning oyligiga tegmaydi (web ham yubormaydi). Oysiz eski qoralama
      // — yubormaydi: yadro sana oyini oladi, `salary` ham bugungi oydan edi.
      date: uzDateIso(),
      ...(d.salaryPayout && d.periodMonth ? { periodMonth: d.periodMonth } : {}),
      note: d.note ?? "",
      origin: ctx.cfg.origin,
    },
    { defer: ctx.defer },
  );
  if (!out.ok) {
    await releaseDraft(ctx.db, ctx.chatId, d.nonce);
    await showConfirm(ctx, d, cashbox, V.chiqimFailed(out.error));
    return;
  }
  await setDraft(ctx.db, ctx.chatId, null);
  await show(ctx, {
    html: V.chiqimSaved(d, cashbox, out.entryId, out.cashbox.balance),
    keyboard: afterSaveKeyboard("chiqim"),
  });
}
