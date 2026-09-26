import { applyCashboxAdjust } from "@/lib/cashboxAdjust";
import { pendingDiscountFor } from "@/lib/gamification/discounts";
import { studentPaidBalance, studentPaidBalanceByName } from "@/lib/pupilsDb";
import { txAudience } from "@/lib/txTarget";
import { uzDateIso } from "@/lib/uzTime";
import type { BotCashbox } from "@/lib/staffBot/auth";
import {
  loadActiveMethods,
  loadKirimTypes,
  loadPupilHit,
  pupilGroupInfo,
  searchPupils,
} from "@/lib/staffBot/data";
import {
  CB,
  kirimCancelOnly,
  kirimConfirmArg,
  kirimConfirmKeyboard,
  kirimMethodArg,
  kirimMethodKeyboard,
  kirimMonthArg,
  kirimMonthKeyboard,
  kirimNoteKeyboard,
  kirimStudentArg,
  kirimStudentKeyboard,
  kirimTypeArg,
  kirimTypeKeyboard,
  afterSaveKeyboard,
  backToMenu,
  type MonthOption,
} from "@/lib/staffBot/keyboards";
import { newNonce, parseAmount, show, type CallbackResult, type FlowCtx } from "@/lib/staffBot/flow";
import {
  claimDraftForSave,
  liveDraft,
  releaseDraft,
  setDraft,
  type KirimDraft,
} from "@/lib/staffBot/session";
import * as V from "@/lib/staffBot/views";
import { formatPhone } from "@/lib/studentBot/phone";
import { monthLabel } from "@/lib/studentBot/views";

// 💵 KIRIM — botdagi to'lov kiritish oqimi.
//
// Web'dagi Kirim oynasi (components/finance/CashboxKirimDrawer.tsx) bilan
// BIR XIL maydonlar, bir xil tartibda: tur → o'quvchi → summa → to'lov
// turi → oy → izoh → tasdiq. Farqlar (foydalanuvchi bilan kelishilgan,
// 18.09.2026):
//   • sana doim BUGUN — botdan orqaga sana qo'yib bo'lmaydi;
//   • o'qituvchi so'ralmaydi — o'quvchining guruhidan o'zi olinadi va
//     tasdiq kartasida ko'rinadi;
//   • "Uchinchi shaxs" turida (Kitob sotuvi) oylar bo'yicha qatorlar yo'q —
//     bitta summa, izoh.
// Yozishning o'zi yadroda (lib/cashboxAdjust.ts) — web bilan bitta kod.
//
// HOLAT BAZADA (`staff_bot_users.draft`): har yangilanish alohida HTTP
// so'rov, xotirada hech narsa qolmaydi.

/** Oy tugmalari: o'tgan · SHU (belgilangan) · keyingi. */
function monthOptions(todayIso: string): MonthOption[] {
  const [y, m] = todayIso.split("-").map(Number);
  const shift = (d: number) => {
    const t = new Date(Date.UTC(y, m - 1 + d, 1));
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  return [-1, 0, 1].map((d) => {
    const month = shift(d);
    return { month, label: monthLabel(month), current: d === 0 };
  });
}

/** Tayyor izoh — kassirlar hozir qo'lda shunday yozadi: "Durdona sentyabr". */
function autoNote(d: KirimDraft): string | null {
  if (!d.teacherName || !d.periodMonth) return null;
  const first = d.teacherName.trim().split(/\s+/)[0];
  return first ? `${first} ${V.monthWord(d.periodMonth)}` : null;
}

function cashboxOrNull(ctx: FlowCtx): BotCashbox | null {
  return ctx.access.cashbox;
}

// ── Qadamlar ────────────────────────────────────────────────────────

async function showType(ctx: FlowCtx, d: KirimDraft, cashbox: BotCashbox, note?: string): Promise<void> {
  const types = await loadKirimTypes(ctx.db);
  if (types.length === 0) {
    await setDraft(ctx.db, ctx.chatId, null);
    await show(ctx, { html: V.kirimNoTypes(), keyboard: backToMenu() });
    return;
  }
  const html = note ? `${note}\n\n${V.kirimTypePrompt(d, cashbox)}` : V.kirimTypePrompt(d, cashbox);
  await show(ctx, { html, keyboard: kirimTypeKeyboard(types) });
}

async function showStudent(ctx: FlowCtx, d: KirimDraft, cashbox: BotCashbox): Promise<void> {
  await show(ctx, { html: V.kirimStudentPrompt(d, cashbox), keyboard: kirimCancelOnly() });
}

async function showAmount(ctx: FlowCtx, d: KirimDraft, cashbox: BotCashbox): Promise<void> {
  // Balans ID bo'yicha — kassir ro'yxatdan aynan shu o'quvchini
  // tanlagan (`studentId`), ismdoshning puli qo'shilib ko'rinmasin.
  const paid = d.studentId !== undefined && d.studentName
    ? await studentPaidBalance(ctx.db, { id: d.studentId, name: d.studentName })
    : d.studentName
      ? await studentPaidBalanceByName(ctx.db, d.studentName)
      : null;
  await show(ctx, { html: V.kirimAmountPrompt(d, cashbox, paid), keyboard: kirimCancelOnly() });
}

async function showMethod(ctx: FlowCtx, d: KirimDraft, cashbox: BotCashbox): Promise<void> {
  const methods = await loadActiveMethods(ctx.db);
  if (methods.length === 0) {
    await setDraft(ctx.db, ctx.chatId, null);
    await show(ctx, { html: V.kirimNoMethods(), keyboard: backToMenu() });
    return;
  }
  await show(ctx, { html: V.kirimMethodPrompt(d, cashbox), keyboard: kirimMethodKeyboard(methods) });
}

async function showMonth(ctx: FlowCtx, d: KirimDraft, cashbox: BotCashbox): Promise<void> {
  await show(ctx, { html: V.kirimMonthPrompt(d, cashbox), keyboard: kirimMonthKeyboard(monthOptions(uzDateIso())) });
}

async function showNote(ctx: FlowCtx, d: KirimDraft, cashbox: BotCashbox): Promise<void> {
  await show(ctx, { html: V.kirimNotePrompt(d, cashbox), keyboard: kirimNoteKeyboard(autoNote(d)) });
}

/**
 * Tanga evaziga chegirma (gamifikatsiya, TZ 4.16.4): o'quvchining shu oy
 * to'loviga kutilayotgan chegirmasi — kassir pulni olishdan OLDIN bilsin.
 * Qo'llash qoidasi yadroda (lib/cashboxAdjust.ts); bu yerda faqat ko'rinish.
 */
async function discountHint(ctx: FlowCtx, d: KirimDraft): Promise<V.KirimDiscountHint | null> {
  if (d.studentId === undefined) return null;
  const p = await pendingDiscountFor(ctx.db, d.studentId, d.periodMonth || uzDateIso().slice(0, 7)).catch(() => null);
  if (!p) return null;
  const teacher = (d.teacherName ?? "").trim().toLowerCase();
  const want = p.teacherName.trim().toLowerCase();
  const applies = p.inGroup && (!want || !teacher || teacher === want);
  return { amountSom: p.amountSom, percent: p.percent, groupLabel: p.groupLabel, teacherName: p.teacherName, applies };
}

async function showConfirm(ctx: FlowCtx, d: KirimDraft, cashbox: BotCashbox, note?: string): Promise<void> {
  const view = V.kirimConfirmView(d, cashbox, uzDateIso(), await discountHint(ctx, d));
  const html = note ? `${note}\n\n${view}` : view;
  await show(ctx, { html, keyboard: kirimConfirmKeyboard(d.nonce) });
}

/** Joriy qadamni QAYTA ko'rsatadi — noto'g'ri turdagi kiritishdan keyin. */
async function showCurrent(ctx: FlowCtx, d: KirimDraft, cashbox: BotCashbox): Promise<void> {
  switch (d.step) {
    case "type": return showType(ctx, d, cashbox);
    case "student": return showStudent(ctx, d, cashbox);
    case "amount": return showAmount(ctx, d, cashbox);
    case "method": return showMethod(ctx, d, cashbox);
    case "month": return showMonth(ctx, d, cashbox);
    case "note": return showNote(ctx, d, cashbox);
    default: return showConfirm(ctx, d, cashbox);
  }
}

async function advance(ctx: FlowCtx, d: KirimDraft): Promise<void> {
  await setDraft(ctx.db, ctx.chatId, d);
}

// ── Kirish nuqtalari ────────────────────────────────────────────────

export type { FlowCtx } from "@/lib/staffBot/flow";

/** "💵 Kirim" bosildi — yangi qoralama, birinchi qadam. */
export async function startKirim(ctx: FlowCtx): Promise<void> {
  if (!ctx.access.canCash) {
    await show(ctx, { html: V.noPermission(), keyboard: backToMenu() });
    return;
  }
  const cashbox = cashboxOrNull(ctx);
  if (!cashbox) {
    await show(ctx, { html: V.noCashbox(), keyboard: backToMenu() });
    return;
  }
  const d: KirimDraft = { kind: "kirim", step: "type", nonce: newNonce(), updatedAt: Date.now() };
  await advance(ctx, d);
  await showType(ctx, d, cashbox);
}

/**
 * Kirim tugmasi bosildi. `true` — bu oqimga tegishli edi va bajarildi.
 * Har tugma o'z qadamida ishlaydi; eski xabardagi tugma boshqa qadamda
 * bosilsa joriy qadam qayta ko'rsatiladi (pul yozilmaydi).
 */
export async function kirimCallback(ctx: FlowCtx, data: string): Promise<CallbackResult> {
  if (!data.startsWith("s:k:")) return { handled: false };

  if (data === CB.kirimCancel) {
    await setDraft(ctx.db, ctx.chatId, null);
    await show(ctx, { html: V.kirimCancelled(), keyboard: backToMenu() });
    return { handled: true };
  }
  if (data === CB.kirimRestart) {
    await startKirim(ctx);
    return { handled: true };
  }

  const cashbox = cashboxOrNull(ctx);
  if (!ctx.access.canCash || !cashbox) {
    await setDraft(ctx.db, ctx.chatId, null);
    await show(ctx, { html: cashbox ? V.noPermission() : V.noCashbox(), keyboard: backToMenu() });
    return { handled: true };
  }

  // TASDIQ — atom band qilish, keyin yozish. Qoralama o'qilmasdan turib
  // band qilinadi: takror bosish shu yerda qaytariladi.
  const nonce = kirimConfirmArg(data);
  if (nonce) {
    const claimed = await claimDraftForSave(ctx.db, ctx.chatId, nonce, "kirim");
    if (!claimed) return { handled: true, toast: V.alreadySaved() };
    await saveKirim(ctx, claimed, cashbox);
    return { handled: true };
  }

  const d = liveDraft(ctx.user);
  if (!d || d.kind !== "kirim") {
    await show(ctx, { html: V.draftExpired(), keyboard: backToMenu() });
    return { handled: true };
  }
  if (d.step === "saving") return { handled: true, toast: "Saqlanmoqda…" };

  const typeId = kirimTypeArg(data);
  if (typeId !== null) {
    if (d.step !== "type") return stale(ctx, d, cashbox);
    const types = await loadKirimTypes(ctx.db);
    const type = types.find((t) => t.id === typeId);
    if (!type) return stale(ctx, d, cashbox, "Bu tur endi yo'q");
    // QAYSI TANLOVLAR CHIQADI — Sozlamalardagi "Mijoz" katakchalaridan
    // (lib/txTarget.ts), web'dagi Kirim oynasi bilan bir xil qoida:
    //   uchinchi shaxs      → odam yo'q (Kitob sotuvi)
    //   o'quvchi / sozlanmagan → o'quvchi so'raladi (majburiy)
    //   faqat xodim         → web'da o'qituvchi so'raladi; botda hozircha
    //                         yo'q (bunday kirim turi bazada ham yo'q)
    //   hech kim ("Boshqa") → odam yo'q (Imtihon to'lovi)
    const a = txAudience(type);
    if (a.employee && !a.student && !a.unset && !a.thirdParty) {
      await showType(ctx, d, cashbox, V.kirimTypeUnsupported(type.name));
      return { handled: true };
    }
    const askStudent = !a.thirdParty && (a.student || a.unset);
    const next: KirimDraft = {
      ...d,
      typeId: type.id,
      typeName: type.name,
      askStudent,
      // "Uchinchi shaxs" turida oy so'ralmaydi (web ham `periodMonth`
      // yubormaydi).
      askMonth: !a.thirdParty,
      step: askStudent ? "student" : "amount",
    };
    await advance(ctx, next);
    if (askStudent) await showStudent(ctx, next, cashbox);
    else await showAmount(ctx, next, cashbox);
    return { handled: true };
  }

  const pupilId = kirimStudentArg(data);
  if (pupilId !== null) {
    if (d.step !== "student") return stale(ctx, d, cashbox);
    const hit = await loadPupilHit(ctx.db, pupilId);
    if (!hit) return stale(ctx, d, cashbox, "O'quvchi topilmadi");
    const info = await pupilGroupInfo(ctx.db, pupilId);
    const next: KirimDraft = {
      ...d,
      studentId: hit.id,
      studentName: hit.name,
      studentPhone: hit.phone,
      groupLabel: info.groupLabel,
      teacherName: info.teacher,
      step: "amount",
    };
    await advance(ctx, next);
    await showAmount(ctx, next, cashbox);
    return { handled: true };
  }

  const methodKey = kirimMethodArg(data);
  if (methodKey !== null) {
    if (d.step !== "method") return stale(ctx, d, cashbox);
    const methods = await loadActiveMethods(ctx.db);
    const m = methods.find((x) => x.key === methodKey);
    if (!m) return stale(ctx, d, cashbox, "Bu to'lov turi endi faol emas");
    // Uchinchi shaxs turida oy yo'q — to'g'ridan-to'g'ri izohga.
    const askMonth = d.askMonth !== false;
    const next: KirimDraft = { ...d, methodKey: m.key, methodName: m.name, step: askMonth ? "month" : "note" };
    await advance(ctx, next);
    if (askMonth) await showMonth(ctx, next, cashbox);
    else await showNote(ctx, next, cashbox);
    return { handled: true };
  }

  const month = kirimMonthArg(data);
  if (month !== null) {
    if (d.step !== "month") return stale(ctx, d, cashbox);
    const next: KirimDraft = { ...d, periodMonth: month, step: "note" };
    await advance(ctx, next);
    await showNote(ctx, next, cashbox);
    return { handled: true };
  }

  if (data === CB.kirimNoteAuto || data === CB.kirimNoteSkip) {
    if (d.step !== "note") return stale(ctx, d, cashbox);
    const note = data === CB.kirimNoteAuto ? (autoNote(d) ?? "") : "";
    const next: KirimDraft = { ...d, note, step: "confirm" };
    await advance(ctx, next);
    await showConfirm(ctx, next, cashbox);
    return { handled: true };
  }

  return stale(ctx, d, cashbox, "Tugma tanilmadi");
}

async function stale(ctx: FlowCtx, d: KirimDraft, cashbox: BotCashbox, toast = "Bu tugma eskirgan"): Promise<{ handled: true; toast: string }> {
  await showCurrent(ctx, d, cashbox);
  return { handled: true, toast };
}

/** Matn keldi. `true` — qoralama uni qabul qildi. */
export async function kirimText(ctx: FlowCtx, text: string): Promise<boolean> {
  const d = liveDraft(ctx.user);
  if (!d || d.kind !== "kirim") return false;
  const cashbox = cashboxOrNull(ctx);
  if (!ctx.access.canCash || !cashbox) return false;

  switch (d.step) {
    case "student": {
      const q = text.trim();
      const found = await searchPupils(ctx.db, q, cashbox.branchId);
      if (!found) {
        await show(ctx, { html: V.kirimQueryTooShort(d, cashbox), keyboard: kirimCancelOnly() });
        return true;
      }
      if (found.hits.length === 0) {
        await show(ctx, { html: V.kirimStudentNotFound(d, cashbox, q), keyboard: kirimCancelOnly() });
        return true;
      }
      await show(ctx, {
        html: V.kirimStudentResults(d, cashbox, q, found.hits.length, found.more),
        keyboard: kirimStudentKeyboard(
          found.hits.map((h) => ({ id: h.id, label: h.phone ? `${h.name} · ${formatPhone(h.phone)}` : h.name })),
        ),
      });
      return true;
    }
    case "amount": {
      const amount = parseAmount(text);
      if (amount === null) {
        await show(ctx, { html: V.kirimBadAmount(d, cashbox), keyboard: kirimCancelOnly() });
        return true;
      }
      const next: KirimDraft = { ...d, amount, step: "method" };
      await advance(ctx, next);
      await showMethod(ctx, next, cashbox);
      return true;
    }
    case "note": {
      // 500 belgi — jurnal "Izoh" ustuni va Telegram xabari uchun yetarli.
      const next: KirimDraft = { ...d, note: text.trim().slice(0, 500), step: "confirm" };
      await advance(ctx, next);
      await showConfirm(ctx, next, cashbox);
      return true;
    }
    default:
      // Tugma kutilayotgan qadamda matn keldi — qadam qayta ko'rsatiladi.
      await showCurrent(ctx, d, cashbox);
      return true;
  }
}

// ── Saqlash ─────────────────────────────────────────────────────────

async function saveKirim(ctx: FlowCtx, d: KirimDraft, cashbox: BotCashbox): Promise<void> {
  if (!d.amount || !d.methodKey || !d.typeName) {
    await releaseDraft(ctx.db, ctx.chatId, d.nonce);
    await showConfirm(ctx, d, cashbox, V.kirimFailed("qoralama to'liq emas"));
    return;
  }
  const out = await applyCashboxAdjust(
    ctx.db,
    {
      cashboxId: cashbox.id,
      mode: "kirim",
      method: d.methodKey,
      amount: d.amount,
      category: d.typeName,
      // Kartada ko'rsatilgan ustoz — yadro bo'sh bo'lsa ism bo'yicha o'zi
      // qidirardi (511 takror ism!), shu bois ID orqali topilgani beriladi.
      teacherName: d.teacherName ?? "",
      studentName: d.studentName ?? "",
      studentId: d.studentId,
      date: uzDateIso(),
      note: d.note ?? "",
      periodMonth: d.periodMonth,
      origin: ctx.cfg.origin,
    },
    { defer: ctx.defer },
  );
  if (!out.ok) {
    await releaseDraft(ctx.db, ctx.chatId, d.nonce);
    await showConfirm(ctx, d, cashbox, V.kirimFailed(out.error));
    return;
  }
  await setDraft(ctx.db, ctx.chatId, null);
  await show(ctx, {
    html: V.kirimSaved(
      d,
      cashbox,
      out.entryId,
      out.cashbox.balance,
      out.entry.discountSom ? { amountSom: out.entry.discountSom, percent: out.entry.discountPercent ?? 0 } : null,
    ),
    keyboard: afterSaveKeyboard(),
  });
}
