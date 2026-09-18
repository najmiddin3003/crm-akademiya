import { applyCashboxTransferTo, applyMethodTransfer } from "@/lib/cashboxTransfer";
import { flushSoon } from "@/lib/sync/dispatch";
import { decideTransferAs, type TransferDecision } from "@/lib/transferDecision";
import { loadPendingOut, pendingOutTotal } from "@/lib/transferPending";
import { uzDateIso } from "@/lib/uzTime";
import type { BotCashbox } from "@/lib/staffBot/auth";
import {
  loadActiveMethods,
  loadIncomingTransfer,
  loadIncomingTransfers,
  loadKassam,
  loadTransferDestinations,
  type IncomingTransfer,
} from "@/lib/staffBot/data";
import { newNonce, parseAmount, show, type CallbackResult, type FlowCtx } from "@/lib/staffBot/flow";
import {
  TRANSFER_CB,
  afterDecisionKeyboard,
  afterTransferKeyboard,
  backToMenu,
  transferAcceptArg,
  transferAcceptSureArg,
  transferAmountKeyboard,
  transferCancelOnly,
  transferConfirmArg,
  transferConfirmKeyboard,
  transferDestArg,
  transferDestKeyboard,
  transferInboxKeyboard,
  transferMenu,
  transferMethodArg,
  transferMethodKeyboard,
  transferNoteKeyboard,
  transferRejectArg,
  transferRejectSureArg,
  transferSureKeyboard,
  transferToMethodArg,
} from "@/lib/staffBot/keyboards";
import {
  claimDraftForSave,
  liveDraft,
  releaseDraft,
  setDraft,
  type TransferDraft,
} from "@/lib/staffBot/session";
import * as V from "@/lib/staffBot/views";

// 🔁 KO'CHIRISH — botdagi uch yo'l:
//
//   📤 Boshqa kassaga — filial kassiri kunlik tushumni rahbar kassaga
//      jo'natadi (yadro: lib/cashboxTransfer.ts → applyCashboxTransferTo).
//      Pul TASDIQGACHA jo'natuvchida qoladi (10.09.2026 qoidasi); mavjud
//      summa = qoldiq − tasdiq kutayotgani.
//   🔄 Turlar orasida — Naqd → Plastik, bitta kassa ichida
//      (applyMethodTransfer). Balans o'zgarmaydi.
//   📥 Kelayotganlar — qabul qiluvchi ✓/✗ bosadi
//      (lib/transferDecision.ts → decideTransferAs, web'dagi ✓/× bilan
//      bir xil qoidalar va bir xil CAS himoyasi). Push xabar ham shu
//      tugmalar bilan keladi (lib/staffBot/notify.ts).
//
// Qaror IKKI BOSISH: ✓ → "rostdan ham?" → ✓. Pul ko'chadigan amal
// bitta tasodifiy bosish bilan o'tmasin.

function cashboxOrNull(ctx: FlowCtx): BotCashbox | null {
  return ctx.access.cashbox;
}

async function advance(ctx: FlowCtx, d: TransferDraft): Promise<void> {
  await setDraft(ctx.db, ctx.chatId, d);
}

/** Tanlangan turda JO'NATISH MUMKIN bo'lgan summa. */
async function availableOf(ctx: FlowCtx, d: TransferDraft, cashbox: BotCashbox): Promise<number> {
  if (!d.fromKey) return 0;
  const total = cashbox.methodTotals[d.fromKey] ?? 0;
  if (d.mode === "method") return total;
  const pending = (await loadPendingOut(ctx.db, [cashbox.id])).get(cashbox.id) ?? {};
  return total - (pending[d.fromKey] ?? 0);
}

// ── Ekranlar ────────────────────────────────────────────────────────

async function showMenu(ctx: FlowCtx, cashbox: BotCashbox, prefix?: string): Promise<void> {
  const v = await loadKassam(ctx.db, cashbox);
  const html = V.transferMenuView(cashbox, pendingOutTotal(v.pendingOut), v.stats.pendingIn, v.stats.pendingInCount);
  await show(ctx, { html: prefix ? `${prefix}\n\n${html}` : html, keyboard: transferMenu(v.stats.pendingInCount) });
}

async function showDest(ctx: FlowCtx, d: TransferDraft, cashbox: BotCashbox): Promise<void> {
  const list = await loadTransferDestinations(ctx.db, cashbox.id);
  if (list.length === 0) {
    await setDraft(ctx.db, ctx.chatId, null);
    await show(ctx, { html: V.transferNoDest(), keyboard: backToMenu() });
    return;
  }
  await show(ctx, { html: V.transferDestPrompt(d, cashbox), keyboard: transferDestKeyboard(list) });
}

async function showMethod(ctx: FlowCtx, d: TransferDraft, cashbox: BotCashbox): Promise<void> {
  const methods = await loadActiveMethods(ctx.db);
  const pending = d.mode === "cashbox" ? ((await loadPendingOut(ctx.db, [cashbox.id])).get(cashbox.id) ?? {}) : {};
  const options = methods
    .map((m) => ({ key: m.key, name: m.name, available: (cashbox.methodTotals[m.key] ?? 0) - (pending[m.key] ?? 0) }))
    .filter((m) => m.available > 0);
  if (options.length === 0) {
    await show(ctx, { html: V.transferNoMethods(d, cashbox), keyboard: transferCancelOnly() });
    return;
  }
  await show(ctx, { html: V.transferMethodPrompt(d, cashbox), keyboard: transferMethodKeyboard(options) });
}

async function showToMethod(ctx: FlowCtx, d: TransferDraft, cashbox: BotCashbox): Promise<void> {
  const methods = (await loadActiveMethods(ctx.db))
    .filter((m) => m.key !== d.fromKey)
    .map((m) => ({ key: m.key, name: m.name, available: cashbox.methodTotals[m.key] ?? 0 }));
  await show(ctx, { html: V.transferToPrompt(d, cashbox), keyboard: transferMethodKeyboard(methods, true) });
}

async function showAmount(ctx: FlowCtx, d: TransferDraft, cashbox: BotCashbox, note?: string): Promise<void> {
  const available = await availableOf(ctx, d, cashbox);
  await show(ctx, {
    html: note ?? V.transferAmountPrompt(d, cashbox, available),
    keyboard: transferAmountKeyboard(Math.max(0, available)),
  });
}

async function showNote(ctx: FlowCtx, d: TransferDraft, cashbox: BotCashbox): Promise<void> {
  await show(ctx, { html: V.transferNotePrompt(d, cashbox), keyboard: transferNoteKeyboard() });
}

async function showConfirm(ctx: FlowCtx, d: TransferDraft, cashbox: BotCashbox, note?: string): Promise<void> {
  const body = V.transferConfirmView(d, cashbox, uzDateIso());
  await show(ctx, { html: note ? `${note}\n\n${body}` : body, keyboard: transferConfirmKeyboard(d.nonce, d.mode) });
}

async function showCurrent(ctx: FlowCtx, d: TransferDraft, cashbox: BotCashbox): Promise<void> {
  switch (d.step) {
    case "dest": return showDest(ctx, d, cashbox);
    case "method": return showMethod(ctx, d, cashbox);
    case "to": return showToMethod(ctx, d, cashbox);
    case "amount": return showAmount(ctx, d, cashbox);
    case "note": return showNote(ctx, d, cashbox);
    default: return showConfirm(ctx, d, cashbox);
  }
}

async function showInbox(ctx: FlowCtx, cashbox: BotCashbox, prefix?: string): Promise<void> {
  const items = await loadIncomingTransfers(ctx.db, cashbox.id);
  const html = V.transferInboxView(cashbox.name, items);
  await show(ctx, {
    html: prefix ? `${prefix}\n\n${html}` : html,
    keyboard: transferInboxKeyboard(items.map((it) => ({ id: it.id, label: `#${it.id}` }))),
  });
}

async function stale(ctx: FlowCtx, d: TransferDraft, cashbox: BotCashbox, toast = "Bu tugma eskirgan"): Promise<CallbackResult> {
  await showCurrent(ctx, d, cashbox);
  return { handled: true, toast };
}

async function acceptAmount(ctx: FlowCtx, d: TransferDraft, cashbox: BotCashbox, amount: number): Promise<void> {
  const available = await availableOf(ctx, d, cashbox);
  if (amount > available) {
    await showAmount(ctx, d, cashbox, V.transferAmountRejected(d, cashbox, `Mablag' yetarli emas — mumkin: ${V.fmtMoney(available)}`));
    return;
  }
  // Ichki ko'chirishda izoh yo'q (web'dagi oyna ham so'ramaydi) — to'g'ri tasdiqqa.
  const next: TransferDraft = { ...d, amount, step: d.mode === "cashbox" ? "note" : "confirm" };
  await advance(ctx, next);
  if (next.step === "note") await showNote(ctx, next, cashbox);
  else await showConfirm(ctx, next, cashbox);
}

// ── Kirish nuqtalari ────────────────────────────────────────────────

/** "🔁 Ko'chirish" bosildi — bo'lim menyusi. */
export async function startTransfer(ctx: FlowCtx): Promise<void> {
  if (!ctx.access.canCash) {
    await show(ctx, { html: V.noPermission(), keyboard: backToMenu() });
    return;
  }
  const cashbox = cashboxOrNull(ctx);
  if (!cashbox) {
    await show(ctx, { html: V.noCashbox(), keyboard: backToMenu() });
    return;
  }
  await showMenu(ctx, cashbox);
}

async function beginDraft(ctx: FlowCtx, cashbox: BotCashbox, mode: TransferDraft["mode"]): Promise<void> {
  const d: TransferDraft = {
    kind: "transfer",
    mode,
    step: mode === "cashbox" ? "dest" : "method",
    nonce: newNonce(),
    updatedAt: Date.now(),
  };
  await advance(ctx, d);
  if (mode === "cashbox") await showDest(ctx, d, cashbox);
  else await showMethod(ctx, d, cashbox);
}

export async function transferCallback(ctx: FlowCtx, data: string): Promise<CallbackResult> {
  if (!data.startsWith("s:t:")) return { handled: false };

  const cashbox = cashboxOrNull(ctx);
  if (!ctx.access.canCash || !cashbox) {
    await setDraft(ctx.db, ctx.chatId, null);
    await show(ctx, { html: cashbox ? V.noPermission() : V.noCashbox(), keyboard: backToMenu() });
    return { handled: true };
  }

  switch (data) {
    case TRANSFER_CB.menu:
      await showMenu(ctx, cashbox);
      return { handled: true };
    case TRANSFER_CB.toCashbox:
      await beginDraft(ctx, cashbox, "cashbox");
      return { handled: true };
    case TRANSFER_CB.betweenMethods:
      await beginDraft(ctx, cashbox, "method");
      return { handled: true };
    case TRANSFER_CB.inbox:
      await showInbox(ctx, cashbox);
      return { handled: true };
    case TRANSFER_CB.cancel:
      await setDraft(ctx.db, ctx.chatId, null);
      await show(ctx, { html: V.transferCancelled(), keyboard: afterTransferKeyboard() });
      return { handled: true };
    case TRANSFER_CB.restart:
      await setDraft(ctx.db, ctx.chatId, null);
      await showMenu(ctx, cashbox);
      return { handled: true };
  }

  // ── Kelayotgan ko'chirma qarori ──
  const askAccept = transferAcceptArg(data);
  const askReject = transferRejectArg(data);
  if (askAccept !== null || askReject !== null) {
    const id = (askAccept ?? askReject)!;
    const decision: TransferDecision = askAccept !== null ? "confirm" : "reject";
    const it = await loadIncomingTransfer(ctx.db, id);
    if (!it) {
      await showInbox(ctx, cashbox, V.transferNotFound());
      return { handled: true };
    }
    await show(ctx, { html: V.transferSureView(it, decision), keyboard: transferSureKeyboard(id, decision) });
    return { handled: true };
  }
  const sureAccept = transferAcceptSureArg(data);
  const sureReject = transferRejectSureArg(data);
  if (sureAccept !== null || sureReject !== null) {
    const id = (sureAccept ?? sureReject)!;
    const decision: TransferDecision = sureAccept !== null ? "confirm" : "reject";
    await decide(ctx, cashbox, id, decision);
    return { handled: true };
  }

  // ── Jo'natish tasdig'i — atom band qilish (Kirim/Chiqim bilan bir xil) ──
  const nonce = transferConfirmArg(data);
  if (nonce) {
    const claimed = await claimDraftForSave(ctx.db, ctx.chatId, nonce, "transfer");
    if (!claimed) return { handled: true, toast: V.alreadySaved() };
    await saveTransfer(ctx, claimed, cashbox);
    return { handled: true };
  }

  const d = liveDraft(ctx.user);
  if (!d || d.kind !== "transfer") {
    await show(ctx, { html: V.draftExpired(), keyboard: afterTransferKeyboard() });
    return { handled: true };
  }
  if (d.step === "saving") return { handled: true, toast: "Bajarilmoqda…" };

  const destId = transferDestArg(data);
  if (destId !== null) {
    if (d.step !== "dest") return stale(ctx, d, cashbox);
    const dest = (await loadTransferDestinations(ctx.db, cashbox.id)).find((c) => c.id === destId);
    if (!dest) return stale(ctx, d, cashbox, "Bu kassa endi yo'q");
    const next: TransferDraft = { ...d, destId: dest.id, destName: dest.name, step: "method" };
    await advance(ctx, next);
    await showMethod(ctx, next, cashbox);
    return { handled: true };
  }

  const fromKey = transferMethodArg(data);
  if (fromKey !== null) {
    if (d.step !== "method") return stale(ctx, d, cashbox);
    const m = (await loadActiveMethods(ctx.db)).find((x) => x.key === fromKey);
    if (!m) return stale(ctx, d, cashbox, "Bu to'lov turi endi faol emas");
    const next: TransferDraft = { ...d, fromKey: m.key, fromName: m.name, step: d.mode === "cashbox" ? "amount" : "to" };
    await advance(ctx, next);
    if (next.step === "amount") await showAmount(ctx, next, cashbox);
    else await showToMethod(ctx, next, cashbox);
    return { handled: true };
  }

  const toKey = transferToMethodArg(data);
  if (toKey !== null) {
    if (d.step !== "to") return stale(ctx, d, cashbox);
    if (toKey === d.fromKey) return stale(ctx, d, cashbox, "Bir xil turni tanlab bo'lmaydi");
    const m = (await loadActiveMethods(ctx.db)).find((x) => x.key === toKey);
    if (!m) return stale(ctx, d, cashbox, "Bu to'lov turi endi faol emas");
    const next: TransferDraft = { ...d, toKey: m.key, toName: m.name, step: "amount" };
    await advance(ctx, next);
    await showAmount(ctx, next, cashbox);
    return { handled: true };
  }

  if (data === TRANSFER_CB.amountMax) {
    if (d.step !== "amount") return stale(ctx, d, cashbox);
    const available = await availableOf(ctx, d, cashbox);
    if (available <= 0) return stale(ctx, d, cashbox, "Jo'natish mumkin bo'lgan summa yo'q");
    await acceptAmount(ctx, d, cashbox, available);
    return { handled: true };
  }

  if (data === TRANSFER_CB.noteSkip) {
    if (d.step !== "note") return stale(ctx, d, cashbox);
    const next: TransferDraft = { ...d, note: "", step: "confirm" };
    await advance(ctx, next);
    await showConfirm(ctx, next, cashbox);
    return { handled: true };
  }

  return stale(ctx, d, cashbox, "Tugma tanilmadi");
}

/** Matn keldi. `true` — qoralama uni qabul qildi. */
export async function transferText(ctx: FlowCtx, text: string): Promise<boolean> {
  const d = liveDraft(ctx.user);
  if (!d || d.kind !== "transfer") return false;
  const cashbox = cashboxOrNull(ctx);
  if (!ctx.access.canCash || !cashbox) return false;

  switch (d.step) {
    case "amount": {
      const amount = parseAmount(text);
      if (amount === null) {
        await showAmount(ctx, d, cashbox, V.transferBadAmount(d, cashbox));
        return true;
      }
      await acceptAmount(ctx, d, cashbox, amount);
      return true;
    }
    case "note": {
      const next: TransferDraft = { ...d, note: text.trim().slice(0, 500), step: "confirm" };
      await advance(ctx, next);
      await showConfirm(ctx, next, cashbox);
      return true;
    }
    default:
      await showCurrent(ctx, d, cashbox);
      return true;
  }
}

// ── Yozish ──────────────────────────────────────────────────────────

async function saveTransfer(ctx: FlowCtx, d: TransferDraft, cashbox: BotCashbox): Promise<void> {
  if (!d.amount || !d.fromKey || (d.mode === "cashbox" ? !d.destId : !d.toKey)) {
    await releaseDraft(ctx.db, ctx.chatId, d.nonce);
    await showConfirm(ctx, d, cashbox, V.transferFailed("qoralama to'liq emas"));
    return;
  }

  if (d.mode === "cashbox") {
    const out = await applyCashboxTransferTo(
      ctx.db,
      {
        fromId: cashbox.id,
        toCashboxId: d.destId!,
        method: d.fromKey,
        amount: d.amount,
        date: uzDateIso(),
        note: d.note ?? "",
        origin: ctx.cfg.origin,
      },
      { defer: ctx.defer },
    );
    if (!out.ok) {
      await releaseDraft(ctx.db, ctx.chatId, d.nonce);
      await showConfirm(ctx, d, cashbox, V.transferFailed(out.error));
      return;
    }
    await setDraft(ctx.db, ctx.chatId, null);
    await show(ctx, { html: V.transferSaved(d, cashbox, out.outId, null), keyboard: afterTransferKeyboard() });
    return;
  }

  const out = await applyMethodTransfer(
    ctx.db,
    { cashboxId: cashbox.id, from: d.fromKey, to: d.toKey!, amount: d.amount, origin: ctx.cfg.origin },
    { defer: ctx.defer },
  );
  if (!out.ok) {
    await releaseDraft(ctx.db, ctx.chatId, d.nonce);
    await showConfirm(ctx, d, cashbox, V.transferFailed(out.error));
    return;
  }
  await setDraft(ctx.db, ctx.chatId, null);
  await show(ctx, { html: V.transferSaved(d, cashbox, out.outId, out.cashbox.balance), keyboard: afterTransferKeyboard() });
}

/** ✓/✗ — ikkinchi bosish. Qoidalar va CAS himoyasi lib/transferDecision.ts da. */
async function decide(ctx: FlowCtx, cashbox: BotCashbox, entryId: number, decision: TransferDecision): Promise<void> {
  // Xabar uchun oldindan o'qiladi — qarordan keyin qator `waiting` bo'lmaydi.
  const it: IncomingTransfer | null = await loadIncomingTransfer(ctx.db, entryId);
  const out = await decideTransferAs(
    ctx.db,
    { isAdmin: ctx.access.identity.isAdmin, name: ctx.access.identity.name || null },
    entryId,
    decision,
  );
  if (!out.ok) {
    await showInbox(ctx, cashbox, V.transferDecisionFailed(out.error));
    return;
  }
  // Sheets qatori kunlik cron'ni kutmasdan yangilansin (web route bilan bir xil).
  ctx.defer(() => flushSoon(ctx.db));
  await show(ctx, {
    html: V.transferDecidedView(decision, entryId, out.amount, it?.fromCashboxName || "", cashbox.name),
    keyboard: afterDecisionKeyboard(),
  });
}
