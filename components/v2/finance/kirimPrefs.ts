import type { TransactionType } from "@/lib/transactionTypes";
import { txAudience } from "@/lib/txTarget";

/**
 * O'QUVCHI TO'LOVI TURI («To'lov qabul qilish» va o'quvchi oldindan tanlangan
 * «Kassa amali → Kirim»): «Mijoz» da O'quvchi + O'qituvchi belgilangani (kurs
 * to'lovi — ustoz foiziga tushadi), bo'lmasa O'quvchi belgilangan birinchisi.
 * Topilmasa — `undefined` (useKirimForm ro'yxat boshini oladi, eski oynadek).
 */
export function preferStudentType(types: TransactionType[]): TransactionType | undefined {
  const aud = (tv: TransactionType) => txAudience(tv);
  return (
    types.find((tv) => aud(tv).student && aud(tv).employee && !aud(tv).thirdParty) ??
    types.find((tv) => aud(tv).student && !aud(tv).thirdParty)
  );
}
