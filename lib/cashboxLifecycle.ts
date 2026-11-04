import type { Db } from "mongodb";
import { nextSeq, raiseSeq } from "@/lib/gamification/db";

// TARIXI BOR KASSA O'CHIRILMAYDI, KASSA ID SI QAYTA BERILMAYDI (04.11.2026).
//
// HODISA (Temuriylar, 02.11 va 03.11 — ikki marta): yagona kassa o'chirildi,
// jurnali esa joyida qoldi. Yangi kassa id ni `max(id)+1` bilan oldi, ya'ni
// o'sha eski raqamni. Eski to'lovlar yangi kassada ko'rina boshladi, ulardan
// birini bekor qilish esa yangi kassadan pul ayirdi va balans −100 bo'ldi
// (bekor qilish `cashboxId` bo'yicha yozadi: app/api/transaction-entries/[id]/cancel).
//
// IKKI TUZATISH, ikkalasi ham kerak:
//   • tarixi bor kassa o'chirilmaydi (DELETE /api/cashboxes/:id → 409), kerak
//     bo'lmasa arxivlanadi — jurnal yetim qolmaydi;
//   • id `counters` hisoblagichidan olinadi, o'chirilgan kassa raqami boshqa
//     kassaga berilmaydi — deploydan oldin yetim qolgan yozuvlar ham yangi
//     kassaga yopishmaydi.

/** Mijozga ko'rsatiladigan xabar (messages/en.json da kalit). */
export const HISTORY_BLOCKS_DELETE =
  "Bu kassada tranzaksiyalar bor — o'chirib bo'lmaydi. O'rniga «Kassani arxiv qilish» belgisini qo'ying.";

const SEQ_NAME = "cashboxes";

/** Kassaga id bilan ishora qiladigan saqlangan yozuvlar: [kolleksiya, maydon]. */
const CASHBOX_REFS = [
  ["transaction_entries", "cashboxId"],
  ["transactions", "cashboxId"],
  ["salary_runs", "cashboxId"],
  ["bonuses", "cashboxId"],
  ["penalties", "cashboxId"],
] as const;

/** Kassaga bog'langan birorta yozuv bormi — bekor qilingani ham tarix. */
export async function cashboxHasHistory(db: Db, cashboxId: number): Promise<boolean> {
  const hits = await Promise.all(
    CASHBOX_REFS.map(([collection, field]) =>
      db.collection(collection).findOne({ [field]: cashboxId }, { projection: { _id: 1 } }),
    ),
  );
  return hits.some(Boolean);
}

/** Bazada uchraydigan eng katta kassa id si — hozir yo'q kassalarniki ham. */
async function highestUsedId(db: Db): Promise<number> {
  const sources = [["cashboxes", "id"], ...CASHBOX_REFS] as const;
  const tops = await Promise.all(
    sources.map(async ([collection, field]) => {
      const doc = await db
        .collection(collection)
        .find({ [field]: { $type: "number" } }, { projection: { _id: 0, [field]: 1 } })
        .sort({ [field]: -1 })
        .limit(1)
        .next();
      return Number(doc?.[field] ?? 0);
    }),
  );
  return Math.max(0, ...tops);
}

/**
 * Yangi kassa id si. Hisoblagich har safar bazadagi eng katta id gacha
 * ko'tariladi: u hali yo'q bazada ham (eski yozuvlar turgan bo'lsa) va id
 * skript bilan qo'lda yozilgan bo'lsa ham takror raqam chiqmaydi.
 */
export async function nextCashboxId(db: Db): Promise<number> {
  await raiseSeq(db, SEQ_NAME, await highestUsedId(db));
  return nextSeq(db, SEQ_NAME);
}

/** O'chirilgan kassa raqamini hisoblagichda qoldiradi — izi qolmagan kassaniki ham qaytmaydi. */
export async function retireCashboxId(db: Db, cashboxId: number): Promise<void> {
  await raiseSeq(db, SEQ_NAME, cashboxId);
}
