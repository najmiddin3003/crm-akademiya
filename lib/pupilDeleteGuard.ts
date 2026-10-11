import type { Db } from "mongodb";
import { studentBalanceMatch } from "@/lib/studentRefund";
import { nameEq, pupilNameOfDoc, type EntryFilter, type PupilRef } from "@/lib/pupilEntries";

// TO'LOVI BOR O'QUVCHI O'CHIRILMAYDI (11.10.2026).
//
// HODISA (filial 4): o'quvchi kartasi o'chirilib, keyin qayta kiritildi.
// Eski to'lovlar o'chirilgan kartaning id'si bilan qoldi va guruh
// sahifasida balans 0 ko'rindi — pul to'langan, lekin hech kimga
// tushmagan. Topish: scripts/_check-orphan-payments.mjs; o'sha safar qo'lda
// qayta bog'landi: scripts/fix-orphan-payments-20261011.mjs. Endi to'lovi
// bor karta o'chirilmaydi (DELETE /api/pupils/:id → 409) — o'quvchi ketgan
// bo'lsa «Arxiv» ga o'tkaziladi: tarix ham, balans ham saqlanadi.

/** Mijozga ko'rsatiladigan xabar (messages/en.json da kalit). */
export const PAYMENTS_BLOCK_DELETE =
  "Bu o'quvchining to'lovlari bor — o'chirib bo'lmaydi. O'rniga holatini «Arxiv» ga o'tkazing.";

/**
 * Karta o'chirilsa HECH QAYERDA ko'rinmay qoladigan to'lovlar soni.
 *
 * Sanaladigan to'plam — balansniki (lib/studentRefund.ts →
 * studentBalanceMatch: to'lovlar va o'quvchiga qaytarim, bekor
 * qilinganlarsiz), bog'lanish qoidasi lib/pupilEntries.ts dan:
 *   • `pupilId` shu karta bo'lgan yozuvlar — karta ketsa, ular yetim;
 *   • `pupilId` siz ESKI yozuvlar ism bo'yicha — faqat shu ismli BOSHQA
 *     karta bo'lmasa. Bo'lsa, to'lov o'sha kartada ko'rinishda qoladi,
 *     ya'ni ikki marta kiritilgan dublikat kartani o'chirish to'silmaydi.
 *     `pupilId: null` sharti maydon yo'q yozuvni ham, `null` ni ham tutadi
 *     (guruh sahifasining balansi ikkalasini eski yozuv deb oladi).
 */
export async function paymentsOrphanedBy(db: Db, ref: PupilRef): Promise<number> {
  const entries = db.collection("transaction_entries");
  const base = studentBalanceMatch() as EntryFilter;
  const linked = await entries.countDocuments({ $and: [base, { pupilId: ref.id }] });
  const name = String(ref.name ?? "").trim();
  if (linked > 0 || !name) return linked;
  const legacy = await entries.countDocuments({ $and: [base, { pupilId: null, studentName: nameEq(name) }] });
  if (legacy === 0) return 0;
  // Ismdosh karta bormi. Bazada `name` maydoni yo'q (firstName + lastName),
  // shuning uchun ism JS'da solishtiriladi — resolvePupilRef dagi kabi.
  const wanted = name.toLowerCase();
  const others = await db
    .collection("pupils")
    .find({ id: { $ne: ref.id } }, { projection: { _id: 0, firstName: 1, lastName: 1 } })
    .toArray();
  return others.some((p) => pupilNameOfDoc(p).toLowerCase() === wanted) ? 0 : legacy;
}
