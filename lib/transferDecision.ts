import { NextResponse } from "next/server";
import type { Db } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { currentAuthorName, getCurrentEmployee, ownsCashbox } from "@/lib/currentEmployee";
import { loadPaymentMethods } from "@/lib/paymentMethods";
import { loadPendingOut } from "@/lib/transferPending";
import { enqueue } from "@/lib/sync/outbox";
import { classifyEntry } from "@/lib/sync/dispatch";
import type { TransactionEntry } from "@/lib/transactionEntries";
import { RETURN_COMMENT_MAX } from "@/lib/transferReturns";

// Kassalararo ko'chirmani TASDIQLASH, RAD ETISH yoki BEKOR QILISH.
//
// Amallar bir xil tekshiruvlardan o'tadi, shuning uchun mantiq shu yerda —
// route'lar ustidan yupqa qobiq (app/api/transaction-entries/[id]/
// transfer-confirm, .../transfer-reject, .../transfer-return).
//
// PUL QAYERDA TURADI (app/api/cashboxes/[id]/transfer-to/route.ts):
//   jo'natishda hech kimning balansi o'zgarmaydi — pul JO'NATUVCHIDA
//   qoladi, ikkala jurnal qatori `waiting`.
//     ✓ tasdiq    -> jo'natuvchidan YECHILADI va qabul qiluvchiga
//                    qo'shiladi, ikkala qator ""
//     × rad etish -> hech qanday pul ko'chmaydi, ikkala qator "cancelled"
//
// ESKI QATORLAR BOSHQACHA. Bu qoidadan oldin yozilgan `waiting` yozuvlarda
// pul jo'natishda ALLAQACHON yechilgan va "yo'lda" (eskrouda) turibdi:
//     ✓ tasdiq    -> faqat qabul qiluvchiga qo'shiladi
//     × rad etish -> jo'natuvchiga QAYTARILADI
// Ikkisini `out.deductedOnSend` ajratadi (lib/transactionEntries.ts).
// Adashtirish = pulni ikki marta yechish yoki ikki marta qaytarish,
// shuning uchun maydon YO'Q bo'lsa ESKI qoida tanlanadi.
//
// BEKOR QILISH (01.11.2026, foydalanuvchi: «qabul qilsa ham yoki qabul
// qilmasdan cancel qilsa ham bekor qilish tursin … moderatorga pul
// yuborilishi kerak … izoh … moderatorga habar kelishi kerak») —
// `returnTransferAs`, sababi MAJBURIY:
//     kutilayotgan ko'chirma -> rad etish bilan bir xil (yuqorida), sababi bilan
//     QABUL QILINGAN         -> pul QABUL QILUVCHIDAN yechilib jo'natuvchiga
//                               qaytadi (ikkala qoidada ham: tasdiqdan keyin
//                               pul qabul qiluvchida), ikkala qator "cancelled"
// Har ikki holatda (botdagi ✗ ham) jo'natuvchi kassa egasiga «pul qaytdi»
// oynasi chiqadi — "out" qatordagi `returnUnseen` bayrog'i
// (components/shared/TransferReturnNotice.tsx, app/api/transfer-returns).

export type TransferDecision = "confirm" | "reject";

/** Qaror qabul qilayotgan odam — web'da sessiyadan, botda bog'lanishdan (lib/staffBot). */
export interface DecisionActor {
  isAdmin: boolean;
  /** `hr_employees.name` — kassa egaligi shu ism bilan tekshiriladi. */
  name: string | null;
  /**
   * Jo'natuvchiga «kim bekor qildi» deb ko'rsatiladigan ism. Admin uchun
   * `name` ATAYLAB null (egalik tekshirilmaydi) — shu bois alohida.
   * Berilmasa `name` olinadi.
   */
  displayName?: string | null;
}

export type DecisionStatus = 400 | 401 | 403 | 404 | 409;

/** Yadro natijasi — HTTP'siz, sof ma'lumot (bot ham shuni o'qiydi). */
export type DecisionOutcome =
  | {
      ok: true;
      decision: TransferDecision;
      transferId: number;
      amount: number;
      /** Pul QAYERDAN qayerga — bot xabari uchun. */
      fromCashboxId: number;
      toCashboxId: number;
    }
  | { ok: false; error: string; status: DecisionStatus };

/** `returnTransferAs` natijasi. */
export type ReturnOutcome =
  | {
      ok: true;
      transferId: number;
      amount: number;
      fromCashboxId: number;
      toCashboxId: number;
      /** `true` — ko'chirma QABUL QILINGAN edi va pul rahbar kassadan qaytarildi. */
      afterConfirm: boolean;
    }
  | { ok: false; error: string; status: DecisionStatus };

const fail = (error: string, status: DecisionStatus): { ok: false; error: string; status: DecisionStatus } => ({ ok: false, error, status });

/** Route'lar shuni qaytaradi — muvaffaqiyat ham, xato ham. */
type Result = NextResponse;

function err(message: string, status: number): Result {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/**
 * Web'dagi aktor — SESSIYADAN. Admin uchun `name` null qoladi (egalik
 * tekshiruvi o'tkazilmaydi), ko'rinadigan ism esa hisobning xodim ismi.
 */
async function webActor(): Promise<DecisionActor | null> {
  const me = await getCurrentEmployee();
  if (!me) return null;
  return { isAdmin: me.isAdmin, name: me.name, displayName: me.name ?? ((await currentAuthorName()) || null) };
}

/**
 * HTTP qobig'i — web'dagi ✓ (va eski ×) tugmalari uchun. Aktor SESSIYADAN.
 *
 * NEGA IKKIGA BO'LINGAN: xodimlar Telegram boti ham tasdiqlaydi
 * (lib/staffBot/transfer.ts), unda sessiya yo'q — aktor bog'lanishdan
 * keladi. Qoidalar bitta joyda (`decideTransferAs`), qobiq faqat
 * `NextResponse` ga o'giradi.
 */
export async function decideTransfer(entryId: number, decision: TransferDecision): Promise<Result> {
  if (!Number.isFinite(entryId)) return err("Noto'g'ri id", 400);
  const db = await ensureIndexes();
  const actor = await webActor();
  if (!actor) return err("Tizimga kiring", 401);
  const out = await decideTransferAs(db, actor, entryId, decision);
  if (!out.ok) return err(out.error, out.status);
  return NextResponse.json({ ok: true, decision: out.decision, transferId: out.transferId });
}

/** HTTP qobig'i — web'dagi «Bekor qilish» (sababi bilan). Javobda yangilangan "in" qator. */
export async function returnTransfer(entryId: number, comment: unknown): Promise<Result> {
  if (!Number.isFinite(entryId)) return err("Noto'g'ri id", 400);
  const db = await ensureIndexes();
  const actor = await webActor();
  if (!actor) return err("Tizimga kiring", 401);
  const out = await returnTransferAs(db, actor, entryId, comment);
  if (!out.ok) return err(out.error, out.status);
  const entry = await db.collection("transaction_entries").findOne({ id: entryId }, { projection: { _id: 0 } });
  return NextResponse.json({ ok: true, transferId: out.transferId, afterConfirm: out.afterConfirm, entry });
}

/** Bekor qilish izi — IKKALA qatorga (lib/transactionEntries.ts → `returnedAt`). */
function returnFields(actor: DecisionActor, comment: string, at: string, afterConfirm: boolean) {
  return {
    returnedAt: at,
    returnedBy: String(actor.displayName ?? actor.name ?? "").trim(),
    returnComment: comment,
    returnedAfterConfirm: afterConfirm,
  };
}
/** Amal orqaga qaytarilganda izni ham olib tashlaymiz. */
const RETURN_UNSET = { returnedAt: "", returnedBy: "", returnComment: "", returnedAfterConfirm: "", returnUnseen: "" };

/**
 * Jo'natuvchi kassa egasiga «pul qaytdi» oynasi — "out" qatorga bayroq.
 *
 * Bekor qilgan odamning O'ZI o'sha kassaning egasi bo'lsa (admin o'z
 * kassasidan jo'natgan) xabar ma'nosiz — qo'yilmaydi. Xato amalni
 * to'xtatmaydi: pul allaqachon joyida, xabar — qo'shimcha.
 */
async function flagForSender(db: Db, actor: DecisionActor, out: TransactionEntry): Promise<void> {
  try {
    const who = String(actor.name ?? actor.displayName ?? "").trim();
    if (who && (await ownsCashbox(db, who, out.cashboxId))) return;
    await db.collection("transaction_entries").updateOne({ id: out.id }, { $set: { returnUnseen: true } });
  } catch (e) {
    console.error("[transfer] jo'natuvchi bayrog'i qo'yilmadi:", e instanceof Error ? e.message : e);
  }
}

/** Sheets qatori holat ustuni bilan birga qayta yoziladi — ikkala qator. */
async function enqueueRows(db: Db, rows: TransactionEntry[], event: "confirmed" | "cancelled"): Promise<void> {
  // lib/sync/mappers.ts -> statusLabel: "" -> "Faol", "cancelled" ->
  // "Bekor qilindi". Telegram guruhga ko'chirma HECH QACHON chiqmaydi
  // (lib/sync/outbox.ts dagi `kindNotifiesTelegram`), bayroq ahamiyatsiz.
  for (const r of rows) {
    const kind = classifyEntry(r);
    if (kind) await enqueue(db, { kind, entryId: r.id, event, notifyTelegram: false });
  }
}

export async function decideTransferAs(
  db: Db,
  actor: DecisionActor,
  entryId: number,
  decision: TransferDecision,
  opts: { comment?: string } = {},
): Promise<DecisionOutcome> {
  if (!Number.isFinite(entryId)) return fail("Noto'g'ri id", 400);

  const entriesCol = db.collection("transaction_entries");
  const entry = (await entriesCol.findOne({ id: entryId })) as (TransactionEntry & { _id: unknown }) | null;
  if (!entry) return fail("Tranzaksiya topilmadi", 404);

  if (entry.txType !== "transfer") {
    return fail("Bu tranzaksiya kassalararo ko'chirma emas", 400);
  }
  // Qaror QABUL QILUVCHI tomonning qatoriga tegishli: pul kelayotgan
  // kassaning egasi tasdiqlaydi. Chiquvchi qatordan tasdiqlashga ruxsat
  // berilsa, jo'natuvchi o'z ko'chirmasini o'zi tasdiqlab qo'yardi.
  if (entry.transferRole !== "in") {
    return fail("Faqat pul KELAYOTGAN kassa tasdiqlashi mumkin", 400);
  }
  if (entry.status !== "waiting") {
    return fail("Bu ko'chirma allaqachon hal qilingan", 409);
  }
  // Juftlik bog'lanmagan eski yozuv — ikkinchi qatorni ishonchli topib
  // bo'lmaydi, ya'ni pulni to'g'ri joyga qo'yib bo'lmaydi.
  const transferId = Number(entry.transferId);
  if (!Number.isFinite(transferId)) {
    return fail("Ko'chirmaning ikkinchi qatori topilmadi (eski yozuv)", 400);
  }

  // ---- RUXSAT ----
  // Kassa egaligini tekshiradigan BIRINCHI yozuv route'i. Ilgari
  // /api/cashboxes/* ning hech biri egalikni tekshirmasdi — proxy.ts
  // faqat "/finance-cash" bo'lim ruxsatini talab qiladi, ya'ni moliya
  // sahifasiga kira oladigan har qanday xodim istalgan kassaga tegishi
  // mumkin edi.
  //
  // "Bosh kassa" (isPrimary) belgisiga ATAYLAB bog'lanmagan: uni
  // /finance-cash ruxsati bor istalgan xodim o'ziga o'tkazib olishi
  // mumkin, ya'ni u himoya emas, bezak.
  if (!actor.isAdmin && !(await ownsCashbox(db, actor.name, entry.cashboxId))) {
    return fail("Bu kassani faqat uning mas'uli tasdiqlashi mumkin", 403);
  }

  const rows = (await entriesCol.find({ transferId }).toArray()) as unknown as TransactionEntry[];
  const out = rows.find((r) => r.transferRole === "out");
  if (!out) return fail("Ko'chirmaning chiquvchi qatori topilmadi", 400);

  // ---- PUL QAYSI KASSAGA VA QAYSI TURGA ----
  const key = await methodKeyOf(db, entry);
  if (!key) return fail("To'lov turi topilmadi", 400);
  const amount = Math.abs(Number(entry.amount) || 0);
  if (amount <= 0) return fail("Ko'chirma summasi noto'g'ri", 400);
  // Pul jo'natishda kassadan yechilganmi? Maydon YO'Q bo'lsa — ESKI
  // yozuv, ya'ni yechilgan va "yo'lda" turibdi (yuqoridagi izoh).
  const heldInTransit = out.deductedOnSend !== false;
  const newStatus = decision === "confirm" ? "" : "cancelled";

  // ---- HOLATNI ALMASHTIRISH (avval), SO'NG PUL ----
  //
  // Tartib ATAYLAB shunday. Tugma ikki marta bosilsa yoki ikkita so'rov
  // bir vaqtda kelsa, `status: "waiting"` sharti faqat BIRINCHISIGA
  // to'g'ri keladi — ikkinchisi 0 qator o'zgartiradi va pul ikki marta
  // ko'chmaydi.
  //
  // Teskari tartib (avval pul) xavfliroq bo'lardi: $inc o'tib, holat
  // yozilmay qolsa, keyingi urinish pulni YANA qo'shib yuborardi.
  //
  // MongoDB tranzaksiyasi ishlatilmadi — loyihada hech qayerda yo'q va
  // bu birinchisi bo'lib qolardi. Qolgan xavf: CAS bajarilib, keyingi
  // $inc gacha jarayon o'lsa, ko'chirma hal qilingan bo'lib ko'rinadi-yu
  // pul ko'chmay qoladi. Pul yo'qolmaydi (jurnalda ikkala qator
  // ko'rinadi), lekin qo'lda tuzatish talab qiladi. $inc SINXRON xato
  // bersa quyida holat ham, pul ham orqaga qaytariladi.
  // `decidedAt` — ✓/× bosilgan lahza (ISO satr, `createdAt` bilan bir xil
  // shakl). Kassa kartochkasidagi "Oxirgi topshiruvdan beri tushum/chiqim"
  // shu lahzadan hisoblanadi (lib/cashboxStats.ts). 11.09.2026 dan oldingi
  // qatorlarda maydon yo'q — u yerda jo'natilgan vaqt olinadi.
  //
  // RAD ETISHDA bekor qilish izi ham (kim, qachon, sababi) — jo'natuvchi
  // «pul qaytdi» oynasida shuni o'qiydi. Botdagi ✗ sababsiz keladi.
  const at = new Date().toISOString();
  const comment = String(opts.comment ?? "").trim().slice(0, RETURN_COMMENT_MAX);
  const cas = await entriesCol.updateMany(
    { transferId, status: "waiting" },
    {
      $set: {
        status: newStatus,
        decidedAt: at,
        ...(decision === "reject" ? returnFields(actor, comment, at, false) : {}),
      },
    },
  );
  if (cas.modifiedCount === 0) {
    return fail("Bu ko'chirma allaqachon hal qilingan", 409);
  }

  const cashboxesCol = db.collection("cashboxes");
  /** Qaror bekor qilinadi — qatorlar yana tasdiq kutadigan holatga qaytadi. */
  const undoStatus = () =>
    entriesCol.updateMany({ transferId }, { $set: { status: "waiting" }, $unset: { decidedAt: "", ...RETURN_UNSET } });
  const give = (cashboxId: number, delta: number) =>
    cashboxesCol.updateOne(
      { id: cashboxId },
      { $inc: { [`methodTotals.${key}`]: delta, balance: delta } },
    );

  if (decision === "confirm") {
    // 1) YANGI QOIDA: pul hali jo'natuvchida — avval undan yechamiz.
    //
    // Shart FILTRDA (kassa qoldig'i hamon yetarlimi): tasdiq kutilgan
    // vaqt ichida kassir o'sha puldan xarajat qilgan bo'lishi mumkin —
    // pul jismonan uning qo'lida edi va bunga yo'l qo'yilgan. U holda
    // ko'chirmani tasdiqlab bo'lmaydi, rad etish kerak.
    if (!heldInTransit) {
      const take = await cashboxesCol.updateOne(
        {
          id: out.cashboxId,
          [`methodTotals.${key}`]: { $gte: amount },
          balance: { $gte: amount },
        },
        { $inc: { [`methodTotals.${key}`]: -amount, balance: -amount } },
      );
      if (take.matchedCount === 0) {
        await undoStatus();
        const exists = await cashboxesCol.findOne({ id: out.cashboxId }, { projection: { _id: 1 } });
        return exists
          ? fail("Jo'natuvchi kassada mablag' yetarli emas — ko'chirmani rad eting", 409)
          : fail("Jo'natuvchi kassa topilmadi", 404);
      }
    }
    // 2) Qabul qiluvchiga qo'shamiz.
    const added = await give(entry.cashboxId, amount);
    if (added.matchedCount === 0) {
      // Kassa yo'q — hammasini orqaga qaytaramiz, aks holda pul
      // jo'natuvchidan yechilib, hech qayerga tushmasdan yo'qolardi.
      if (!heldInTransit) await give(out.cashboxId, amount);
      await undoStatus();
      return fail("Kassa topilmadi", 404);
    }
  } else if (heldInTransit) {
    // RAD ETISH. Faqat ESKI qatorlarda qaytariladigan pul bor — u
    // jo'natuvchidan yechilib "yo'lda" turibdi. Yangi qoidada pul
    // jo'natuvchidan umuman chiqmagan, ya'ni hech narsa ko'chirilmaydi.
    const back = await give(out.cashboxId, amount);
    if (back.matchedCount === 0) {
      await undoStatus();
      return fail("Kassa topilmadi", 404);
    }
  }

  if (decision === "reject") await flagForSender(db, actor, out);

  // ---- SINXRONIZATSIYA ----
  await enqueueRows(db, rows, decision === "confirm" ? "confirmed" : "cancelled");

  return {
    ok: true,
    decision,
    transferId,
    amount,
    fromCashboxId: out.cashboxId,
    toCashboxId: entry.cashboxId,
  };
}

/**
 * «BEKOR QILISH» — qabul qiluvchi (rahbar) ko'chirmani sababi bilan bekor
 * qiladi, pul jo'natuvchiga qaytadi. Kutilayotgan ham, QABUL QILINGAN ham.
 *
 * Kutilayotganda — oddiy rad etish (`decideTransferAs`), faqat sababi bilan.
 *
 * QABUL QILINGANDA pul ikkala qoidada ham qabul qiluvchida turadi (yangi
 * qoidada ✓ uni jo'natuvchidan yechib qo'shgan, eskisida jo'natishda
 * yechilib ✓ da qo'shilgan) — ya'ni qaytarish ikkalasida bir xil: qabul
 * qiluvchidan yechib, jo'natuvchiga qo'shish.
 *
 * Qabul qiluvchi o'sha puldan xarajat qilgan yoki uni boshqa ko'chirmaga
 * va'da qilgan bo'lishi mumkin — u holda bekor qilinmaydi (kassa minusga
 * tushmasin: memory kassa-minus-balans).
 */
export async function returnTransferAs(
  db: Db,
  actor: DecisionActor,
  entryId: number,
  rawComment: unknown,
): Promise<ReturnOutcome> {
  if (!Number.isFinite(entryId)) return fail("Noto'g'ri id", 400);
  const comment = String(rawComment ?? "").trim().slice(0, RETURN_COMMENT_MAX);
  if (!comment) return fail("Bekor qilish sababini yozing", 400);

  const entriesCol = db.collection("transaction_entries");
  const entry = (await entriesCol.findOne({ id: entryId })) as (TransactionEntry & { _id: unknown }) | null;
  if (!entry) return fail("Tranzaksiya topilmadi", 404);
  if (entry.txType !== "transfer") return fail("Bu tranzaksiya kassalararo ko'chirma emas", 400);
  if (entry.transferRole !== "in") return fail("Ko'chirmani faqat pul KELGAN kassa bekor qila oladi", 400);
  if (entry.status === "cancelled") return fail("Bu ko'chirma allaqachon bekor qilingan", 409);
  // Ruxsat — tasdiqlashdagi bilan bir xil: pul KELGAN kassaning egasi yoki
  // admin. Kutilayotgan holatdan OLDIN — rad etishning «tasdiqlashi mumkin»
  // xabari emas, «bekor qila oladi» chiqsin.
  if (!actor.isAdmin && !(await ownsCashbox(db, actor.name, entry.cashboxId))) {
    return fail("Bu kassani faqat uning mas'uli bekor qila oladi", 403);
  }

  // Hali tasdiqlanmagan — rad etish, sababi bilan.
  if (entry.status === "waiting") {
    const r = await decideTransferAs(db, actor, entryId, "reject", { comment });
    if (!r.ok) return r;
    return { ok: true, transferId: r.transferId, amount: r.amount, fromCashboxId: r.fromCashboxId, toCashboxId: r.toCashboxId, afterConfirm: false };
  }
  if (entry.status !== "") return fail("Bu ko'chirmani bekor qilib bo'lmaydi", 400);

  const transferId = Number(entry.transferId);
  if (!Number.isFinite(transferId)) {
    return fail("Ko'chirmaning ikkinchi qatori topilmadi (eski yozuv)", 400);
  }

  const rows = (await entriesCol.find({ transferId }).toArray()) as unknown as TransactionEntry[];
  const out = rows.find((r) => r.transferRole === "out");
  if (!out) return fail("Ko'chirmaning chiquvchi qatori topilmadi", 400);
  if (out.status !== "") return fail("Ko'chirmaning ikki qatori bir-biriga mos emas", 409);

  const key = await methodKeyOf(db, entry);
  if (!key) return fail("To'lov turi topilmadi", 400);
  const amount = Math.abs(Number(entry.amount) || 0);
  if (amount <= 0) return fail("Ko'chirma summasi noto'g'ri", 400);

  // ---- QABUL QILUVCHIDA PUL BORMI ----
  // MAVJUD = qoldiq − o'zi jo'natib, tasdiq kutayotgani (transfer-to bilan
  // bir xil qoida, lib/cashboxTransfer.ts): va'da qilingan pulni qaytarib
  // yuborsak, o'sha ko'chirmani keyin tasdiqlab bo'lmasdi. Bu — erta, tushunarli
  // xabar; himoya quyidagi `$gte` filtrida.
  const cashboxesCol = db.collection("cashboxes");
  const recv = await cashboxesCol.findOne({ id: entry.cashboxId }, { projection: { _id: 0, methodTotals: 1 } });
  if (!recv) return fail("Kassa topilmadi", 404);
  const have = Number((recv.methodTotals as Record<string, unknown> | undefined)?.[key]) || 0;
  const promised = (await loadPendingOut(db, [entry.cashboxId])).get(entry.cashboxId)?.[key] ?? 0;
  if (have < amount) return fail("Kassada mablag' yetarli emas — pulni qaytarib bo'lmaydi", 409);
  if (have - promised < amount) return fail("Kassadagi pul tasdiq kutayotgan ko'chirmaga band — avval o'shani hal qiling", 409);

  // ---- HOLAT (avval), SO'NG PUL — tasdiqlashdagi tartib ----
  // Qulf — "in" qatorning O'ZIDA (bitta hujjat, atomar): ikki marta bosilsa
  // ikkinchisi 0 qator o'zgartiradi va pul ikki marta qaytmaydi.
  const at = new Date().toISOString();
  const trail = { status: "cancelled", ...returnFields(actor, comment, at, true) };
  const lock = await entriesCol.updateOne({ id: entry.id, status: "" }, { $set: trail });
  if (lock.modifiedCount === 0) return fail("Bu ko'chirma allaqachon bekor qilingan", 409);
  await entriesCol.updateOne({ id: out.id }, { $set: trail });

  const undo = () =>
    entriesCol.updateMany({ transferId, id: { $in: [entry.id, out.id] } }, { $set: { status: "" }, $unset: RETURN_UNSET });
  const give = (cashboxId: number, delta: number) =>
    cashboxesCol.updateOne({ id: cashboxId }, { $inc: { [`methodTotals.${key}`]: delta, balance: delta } });

  // 1) Qabul qiluvchidan yechamiz — shart FILTRDA (parallel chiqim bo'lsa ham minusga tushmasin).
  const take = await cashboxesCol.updateOne(
    { id: entry.cashboxId, [`methodTotals.${key}`]: { $gte: amount }, balance: { $gte: amount } },
    { $inc: { [`methodTotals.${key}`]: -amount, balance: -amount } },
  );
  if (take.matchedCount === 0) {
    await undo();
    return fail("Kassada mablag' yetarli emas — pulni qaytarib bo'lmaydi", 409);
  }
  // 2) Jo'natuvchiga qaytaramiz.
  const back = await give(out.cashboxId, amount);
  if (back.matchedCount === 0) {
    // Jo'natuvchi kassa o'chirilgan — pul yo'qolmasin, hammasi joyiga.
    await give(entry.cashboxId, amount);
    await undo();
    return fail("Jo'natuvchi kassa topilmadi", 404);
  }

  await flagForSender(db, actor, out);
  await enqueueRows(db, rows, "cancelled");

  return { ok: true, transferId, amount, fromCashboxId: out.cashboxId, toCashboxId: entry.cashboxId, afterConfirm: true };
}

/**
 * Pul qaysi `methodTotals` maydoniga qaytishi.
 *
 * Yangi ko'chirmalarda `paymentMethodKey` yozuvning o'zida turadi. Eski
 * yozuvlarda u yo'q — ularda ko'rinadigan nom bo'yicha qidiriladi, lekin
 * nom Sozlamalardan o'zgartirilgan bo'lsa topilmasligi mumkin.
 */
async function methodKeyOf(db: Db, entry: TransactionEntry): Promise<string | null> {
  if (entry.paymentMethodKey) return entry.paymentMethodKey;
  const methods = await loadPaymentMethods(db);
  return methods.find((m) => m.name === entry.paymentType)?.key ?? null;
}
