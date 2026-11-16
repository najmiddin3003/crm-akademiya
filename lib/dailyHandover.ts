import type { Db } from "mongodb";
import { nameEq } from "@/lib/currentEmployee";
import { applyCashboxTransferTo } from "@/lib/cashboxTransfer";
import { loadPendingOut } from "@/lib/transferPending";
import { decideTransferAs, type DecisionActor } from "@/lib/transferDecision";
import { PLASTIK_METHOD_KEY } from "@/lib/paymentMethods";
import { sendToStaff } from "@/lib/staffBot/api";
import { isStaffBotReady, loadStaffBotConfig } from "@/lib/staffBot/config";
import { markBlocked, STAFF_BOT_USERS } from "@/lib/staffBot/session";
import { nowTime, todayIso } from "@/lib/transactionLog";
import type { DailyHandoverPayload, HandoverCard, HandoverRecord } from "@/lib/dailyHandoverTypes";

export { DENOMINATIONS } from "@/lib/dailyHandoverTypes";
export type { DailyHandoverPayload, HandoverCard, HandoverRecord };

// KUNLIK TOPSHIRUV (yangi versiya, 32-qism) — filial kassalari kun oxirida pulni BOSH (rahbar)
// kassasiga topshiradi. Yangi pul yo'li YO'Q: hammasi mavjud kassalararo ko'chirma ustida
// (lib/cashboxTransfer.ts → applyCashboxTransferTo, lib/transferDecision.ts → decideTransferAs):
//
//   • «Qabul qilish» — kassir hali jo'natmagan: rahbar sanagan naqd va plastik summasi uchun
//     filial → bosh kassa ko'chirmasi yoziladi va DARHOL rahbar nomidan tasdiqlanadi. Kirim
//     emas — pul joyi o'zgaradi. Sanalgani tizimdagidan kam bo'lsa qolgani filial kassasida
//     turadi va «farq» bo'lib yoziladi (izoh majburiy);
//   • «Tasdiqlash» — kassir o'zi jo'natgan (bot yoki veb) kutilayotgan ko'chirmalar tasdiqlanadi;
//   • «Qaytarish» — kutilayotgan ko'chirmalar rad etiladi (izoh bilan, pul kassirda qoladi);
//   • «Eslatish» — kassa egasiga xodimlar botida xabar.
//
// Har qabul `cash_handovers` ga yoziladi (sanalgan kupyuralar, farq, izoh, kim qabul qildi) —
// tarix jadvali shundan. Kim: admin yoki bosh kassaning egasi (GET /api/cashboxes/handover qoidasi).

export const HANDOVERS = "cash_handovers";
type Cashbox = { id: number; name: string; moderator?: string; isPrimary?: boolean; archived?: boolean; methodTotals?: Record<string, number> };

export async function loadPrimary(db: Db): Promise<Cashbox | null> {
  return (await db.collection("cashboxes").findOne({ isPrimary: true }, { projection: { _id: 0 } })) as Cashbox | null;
}

/** Admin yoki bosh kassa egasi. */
export function canHandle(me: { isAdmin: boolean; name: string | null }, primary: Cashbox): boolean {
  const norm = (s: string) => s.trim().toLowerCase();
  return me.isAdmin || Boolean(me.name && norm(me.name) === norm(String(primary.moderator || "")));
}

export async function loadDailyHandover(db: Db, month: string): Promise<DailyHandoverPayload | { ok: false; error: string }> {
  const primary = await loadPrimary(db);
  if (!primary) return { ok: false, error: "Bosh kassa belgilanmagan" };
  const today = todayIso();
  const [branches, methods] = await Promise.all([
    db
      .collection<Cashbox>("cashboxes")
      .find({ isPrimary: { $ne: true }, archived: { $ne: true } }, { projection: { _id: 0, id: 1, name: 1, moderator: 1, methodTotals: 1 } })
      .sort({ id: 1 })
      .toArray(),
    db.collection("settings_payment_methods").find({}, { projection: { _id: 0, key: 1, name: 1 } }).toArray(),
  ]);
  const ids = branches.map((b) => b.id);
  const entries = db.collection("transaction_entries");
  const methodNames: Record<string, string> = Object.fromEntries(methods.filter((m) => m.key).map((m) => [String(m.key), String(m.name ?? m.key)]));

  // Bosh kassaga kelgan ko'chirmalar (kutilayotgan + shu oyda tasdiqlangan) va ularning jo'natuvchisi.
  const [pendingOut, inRows, handovers] = await Promise.all([
    loadPendingOut(db, ids),
    entries
      .find(
        { cashboxId: primary.id, txType: "transfer", transferRole: "in", $or: [{ status: "waiting" }, { status: { $nin: ["waiting", "cancelled"] }, date: { $gte: `${month}-01`, $lte: `${month}-31` } }] },
        { projection: { _id: 0, id: 1, transferId: 1, amount: 1, status: 1, date: 1, time: 1, paymentMethodKey: 1 } },
      )
      .toArray(),
    db.collection(HANDOVERS).find({ date: { $gte: `${month}-01`, $lte: `${month}-31` } }, { projection: { _id: 0 } }).toArray(),
  ]);
  const outRows = inRows.length
    ? await entries
        .find({ transferId: { $in: inRows.map((r) => Number(r.transferId)).filter(Number.isFinite) }, transferRole: "out" }, { projection: { _id: 0, transferId: 1, cashboxId: 1 } })
        .toArray()
    : [];
  const fromOf = new Map(outRows.map((o) => [Number(o.transferId), Number(o.cashboxId)]));
  const handoverByIn = new Map<number, Record<string, unknown>>();
  for (const h of handovers) for (const id of (h.inIds as number[]) ?? []) handoverByIn.set(id, h);

  // Oxirgi qabul (har kassa) — shu oyda bo'lmasa oldingilaridan.
  const lastRows = ids.length
    ? await db
        .collection(HANDOVERS)
        .aggregate<{ _id: number; date: string; time: string; diff: number }>([
          { $match: { cashboxId: { $in: ids } } },
          { $sort: { date: -1, time: -1 } },
          { $group: { _id: "$cashboxId", date: { $first: "$date" }, time: { $first: "$time" }, diff: { $first: "$diff" } } },
        ])
        .toArray()
    : [];
  const lastOf = new Map(lastRows.map((r) => [r._id, r]));

  const pendingByBox = new Map<number, NonNullable<HandoverCard["pending"]>>();
  const groups = new Map<string, HandoverRecord & { inIds: number[] }>();
  for (const r of inRows) {
    const from = fromOf.get(Number(r.transferId));
    if (from === undefined) continue;
    const box = branches.find((b) => b.id === from);
    const amt = Math.abs(Number(r.amount) || 0);
    const key = String(r.paymentMethodKey ?? "");
    if (r.status === "waiting") {
      const p = pendingByBox.get(from) ?? { total: 0, methods: {}, inIds: [], date: String(r.date ?? ""), time: String(r.time ?? "") };
      p.total += amt;
      p.methods[key] = (p.methods[key] ?? 0) + amt;
      p.inIds.push(Number(r.id));
      if (`${r.date} ${r.time}` > `${p.date} ${p.time}`) Object.assign(p, { date: String(r.date), time: String(r.time) });
      pendingByBox.set(from, p);
      continue;
    }
    // Tarix: bitta topshiruv — bitta kassa, bitta kun va vaqt (to'lov turlari bo'yicha qatorlar birlashadi).
    const h = handoverByIn.get(Number(r.id));
    const gk = h ? `h:${String(h.id)}` : `t:${from}:${r.date}:${r.time}`;
    const g = groups.get(gk) ?? {
      id: gk,
      date: String(r.date ?? ""),
      time: String(r.time ?? ""),
      cashboxId: from,
      cashboxName: String(box?.name ?? `#${from}`),
      moderator: String(box?.moderator ?? ""),
      naqd: 0,
      plastik: 0,
      other: 0,
      total: 0,
      diff: Number(h?.diff ?? 0),
      acceptedBy: String(h?.acceptedBy ?? ""),
      note: String(h?.note ?? ""),
      inIds: [],
    };
    if (key === "naqd") g.naqd += amt;
    else if (key === PLASTIK_METHOD_KEY) g.plastik += amt;
    else g.other += amt;
    g.total += amt;
    g.inIds.push(Number(r.id));
    groups.set(gk, g);
  }

  const cards: HandoverCard[] = branches.map((b) => {
    const held = pendingOut.get(b.id) ?? {};
    const methodsNow: Record<string, number> = {};
    for (const [k, v] of Object.entries(b.methodTotals ?? {})) {
      const left = (Number(v) || 0) - (Number(held[k]) || 0);
      if (left > 0) methodsNow[k] = left;
    }
    const last = lastOf.get(b.id);
    return {
      cashboxId: b.id,
      name: b.name,
      moderator: String(b.moderator ?? ""),
      methods: methodsNow,
      total: Object.values(methodsNow).reduce((a, c) => a + c, 0),
      pending: pendingByBox.get(b.id) ?? null,
      last: last ? { date: last.date, time: last.time, diff: Number(last.diff) || 0 } : null,
    };
  });

  const records = [...groups.values()]
    .map(({ inIds: _inIds, ...r }) => {
      void _inIds;
      return r;
    })
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));

  return {
    ok: true,
    today,
    now: nowTime(),
    primary: { id: primary.id, name: primary.name, moderator: String(primary.moderator ?? "") },
    methodNames,
    cards,
    month,
    records,
  };
}

export interface AcceptInput {
  cashboxId: number;
  /** Sanalgan naqd (kupyuralar yig'indisi). */
  naqd: number;
  /** Rahbar kartasiga o'tgan plastik. */
  plastik: number;
  denominations?: Record<string, number>;
  note?: string;
}

type Ok<T> = { ok: true } & T;
type Fail = { ok: false; error: string; status: number };

/** «Qabul qilish» yoki «Tasdiqlash» (kutilayotgan ko'chirma bo'lsa — o'sha tasdiqlanadi). */
export async function acceptHandover(db: Db, actor: DecisionActor & { displayName?: string | null }, input: AcceptInput): Promise<Ok<{ diff: number; total: number }> | Fail> {
  const primary = await loadPrimary(db);
  if (!primary) return { ok: false, error: "Bosh kassa belgilanmagan", status: 404 };
  const box = (await db.collection("cashboxes").findOne({ id: input.cashboxId, isPrimary: { $ne: true } }, { projection: { _id: 0 } })) as Cashbox | null;
  if (!box) return { ok: false, error: "Kassa topilmadi", status: 404 };
  const naqd = Math.max(0, Math.round(Number(input.naqd) || 0));
  const plastik = Math.max(0, Math.round(Number(input.plastik) || 0));
  const note = String(input.note ?? "").trim().slice(0, 500);

  const entries = db.collection("transaction_entries");
  const waitingIn = await entries
    .find({ cashboxId: primary.id, txType: "transfer", transferRole: "in", status: "waiting" }, { projection: { _id: 0, id: 1, transferId: 1, amount: 1, paymentMethodKey: 1 } })
    .toArray();
  const outs = waitingIn.length
    ? await entries.find({ transferId: { $in: waitingIn.map((w) => Number(w.transferId)) }, transferRole: "out", cashboxId: box.id }, { projection: { _id: 0, transferId: 1 } }).toArray()
    : [];
  const mine = new Set(outs.map((o) => Number(o.transferId)));
  const pending = waitingIn.filter((w) => mine.has(Number(w.transferId)));

  let system: { naqd: number; plastik: number };
  const inIds: number[] = [];
  if (pending.length) {
    // Kassir jo'natgan — o'sha ko'chirmalar tasdiqlanadi; sanalgani faqat farqni o'lchaydi.
    system = { naqd: 0, plastik: 0 };
    for (const p of pending) {
      const k = String(p.paymentMethodKey ?? "");
      if (k === "naqd") system.naqd += Math.abs(Number(p.amount) || 0);
      else if (k === PLASTIK_METHOD_KEY) system.plastik += Math.abs(Number(p.amount) || 0);
    }
    const diff = naqd + plastik - (system.naqd + system.plastik);
    if (diff !== 0 && !note) return { ok: false, error: "Farq bor — izoh yozing", status: 400 };
    for (const p of pending) {
      const r = await decideTransferAs(db, actor, Number(p.id), "confirm");
      if (!r.ok) return { ok: false, error: r.error, status: r.status };
      inIds.push(Number(p.id));
    }
  } else {
    // Kassir jo'natmagan — rahbar sanagan summa ko'chiriladi va darhol tasdiqlanadi.
    const totals = box.methodTotals ?? {};
    system = { naqd: Number(totals.naqd) || 0, plastik: Number(totals[PLASTIK_METHOD_KEY]) || 0 };
    if (naqd > system.naqd) return { ok: false, error: "Sanalgan naqd kassadagidan ko'p — kassada bunday pul yo'q", status: 400 };
    if (plastik > system.plastik) return { ok: false, error: "Plastik summasi kassadagidan ko'p", status: 400 };
    if (naqd + plastik <= 0) return { ok: false, error: "Topshiriladigan summa yo'q", status: 400 };
    const diff = naqd + plastik - (system.naqd + system.plastik);
    if (diff !== 0 && !note) return { ok: false, error: "Farq bor — izoh yozing", status: 400 };
    for (const [method, amount] of [["naqd", naqd], [PLASTIK_METHOD_KEY, plastik]] as const) {
      if (amount <= 0) continue;
      const t = await applyCashboxTransferTo(
        db,
        { fromId: box.id, toCashboxId: primary.id, method, amount, note: note || "Kunlik topshiruv" },
        { defer: () => {} },
      );
      if (!t.ok) return { ok: false, error: t.error, status: t.status };
      const c = await decideTransferAs(db, actor, t.inId, "confirm");
      if (!c.ok) return { ok: false, error: c.error, status: c.status };
      inIds.push(t.inId);
    }
  }

  const diff = naqd + plastik - (system.naqd + system.plastik);
  const last = await db.collection(HANDOVERS).find({}).sort({ id: -1 }).limit(1).toArray();
  await db.collection(HANDOVERS).insertOne({
    id: (Number(last[0]?.id) || 0) + 1,
    date: todayIso(),
    time: nowTime(),
    cashboxId: box.id,
    cashboxName: box.name,
    system,
    counted: { naqd, plastik },
    denominations: input.denominations ?? {},
    diff,
    note,
    acceptedBy: String(actor.displayName ?? actor.name ?? ""),
    inIds,
    createdAt: new Date(),
  });
  return { ok: true, diff, total: naqd + plastik };
}

/** «Qaytarish» — kutilayotgan ko'chirmalarni rad etadi (izoh majburiy). */
export async function returnHandover(db: Db, actor: DecisionActor, cashboxId: number, comment: string): Promise<Ok<{ count: number }> | Fail> {
  const reason = comment.trim();
  if (!reason) return { ok: false, error: "Qaytarish sababini yozing", status: 400 };
  const primary = await loadPrimary(db);
  if (!primary) return { ok: false, error: "Bosh kassa belgilanmagan", status: 404 };
  const entries = db.collection("transaction_entries");
  const waitingIn = await entries.find({ cashboxId: primary.id, txType: "transfer", transferRole: "in", status: "waiting" }, { projection: { _id: 0, id: 1, transferId: 1 } }).toArray();
  const outs = waitingIn.length
    ? await entries.find({ transferId: { $in: waitingIn.map((w) => Number(w.transferId)) }, transferRole: "out", cashboxId }, { projection: { _id: 0, transferId: 1 } }).toArray()
    : [];
  const mine = new Set(outs.map((o) => Number(o.transferId)));
  let count = 0;
  for (const w of waitingIn.filter((x) => mine.has(Number(x.transferId)))) {
    const r = await decideTransferAs(db, actor, Number(w.id), "reject", { comment: reason });
    if (!r.ok) return { ok: false, error: r.error, status: r.status };
    count += 1;
  }
  if (!count) return { ok: false, error: "Tasdiq kutayotgan topshiruv yo'q", status: 409 };
  return { ok: true, count };
}

/** «Eslatish» — kassa egasiga xodimlar botida xabar. Bot sozlanmagan / egasi botda yo'q — `sent: 0`. */
export async function remindHandover(db: Db, cashboxId: number): Promise<{ ok: true; sent: number } | Fail> {
  const box = (await db.collection("cashboxes").findOne({ id: cashboxId }, { projection: { _id: 0 } })) as Cashbox | null;
  if (!box) return { ok: false, error: "Kassa topilmadi", status: 404 };
  const moderator = String(box.moderator ?? "").trim();
  const cfg = loadStaffBotConfig();
  if (!moderator || !isStaffBotReady(cfg)) return { ok: true, sent: 0 };
  const rows = await db
    .collection(STAFF_BOT_USERS)
    .find({ stage: "in", blocked: { $ne: true }, name: nameEq(moderator) }, { projection: { _id: 0, chatId: 1 } })
    .toArray();
  const totals = box.methodTotals ?? {};
  const sum = Object.values(totals).reduce((a, v) => a + (Number(v) || 0), 0);
  const html = `🔔 <b>Kunlik topshiruv</b>\n${box.name} kassasida <b>${sum.toLocaleString("ru-RU").replace(/,/g, " ")} so'm</b>. Bugun rahbar kassasiga topshiring.`;
  let sent = 0;
  for (const r of rows) {
    const chatId = Number(r.chatId);
    if (!Number.isFinite(chatId)) continue;
    const res = await sendToStaff(cfg, chatId, html);
    if (res.ok) sent += 1;
    else if (res.blocked) await markBlocked(db, chatId);
  }
  return { ok: true, sent };
}
