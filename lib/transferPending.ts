import type { Db } from "mongodb";
import type { CashboxMethodTotals } from "@/lib/cashboxes";

// TASDIQ KUTAYOTGAN chiquvchi ko'chirmalar — kassa va to'lov turi kesimida.
//
// NIMA UCHUN KERAK: pul endi jo'natishda kassadan YECHILMAYDI, u qabul
// qiluvchi ✓ bosgunicha jo'natuvchida turadi (app/api/cashboxes/[id]/
// transfer-to/route.ts). Ya'ni `methodTotals` dagi summaning bir qismi
// allaqachon VA'DA QILINGAN bo'lishi mumkin.
//
// Shuning uchun ikkita joyda shu summa kerak:
//   • ko'chirish oynasi va transfer-to route'i — bitta pulni ikki marta
//     va'da qilib bo'lmasin (mavjud = qoldiq − kutilayotgan);
//   • kassa kartochkasi — kassir balansning qancha qismi tasdiq
//     kutayotganini ko'rib tursin.
//
// FAQAT `deductedOnSend: false` qatorlar hisoblanadi. Eski qoidada
// yozilgan `waiting` qatorlarda pul jo'natishda ALLAQACHON yechilgan,
// ya'ni ular balansda yo'q — ularni yana ayirish pulni ikki marta
// hisobdan chiqarardi (lib/transactionEntries.ts → `deductedOnSend`).

/** @param cashboxIds berilmasa — barcha kassalar. Bo'sh massiv — hech biri. */
export async function loadPendingOut(
  db: Db,
  cashboxIds?: number[],
): Promise<Map<number, CashboxMethodTotals>> {
  const match: Record<string, unknown> = {
    txType: "transfer",
    transferRole: "out",
    status: "waiting",
    deductedOnSend: false,
  };
  if (cashboxIds) {
    if (cashboxIds.length === 0) return new Map();
    match.cashboxId = { $in: cashboxIds };
  }

  const rows = await db
    .collection("transaction_entries")
    .aggregate<{ _id: { cashboxId: number; key: string | null }; sum: number }>([
      { $match: match },
      {
        $group: {
          // Chiquvchi qatorning miqdori MANFIY yoziladi — modulini olamiz.
          _id: { cashboxId: "$cashboxId", key: "$paymentMethodKey" },
          sum: { $sum: { $abs: "$amount" } },
        },
      },
    ])
    .toArray();

  const map = new Map<number, CashboxMethodTotals>();
  for (const r of rows) {
    // `paymentMethodKey` yangi ko'chirmalarda HAR DOIM bor (transfer-to uni
    // o'zi yozadi). Baribir tekshiramiz: kalitsiz qatorni qaysi turdan
    // ayirishni bilib bo'lmaydi, jimgina noto'g'ri turga qo'shib
    // yuborgandan ko'ra tashlab ketgan xavfsizroq.
    if (!r._id.key) continue;
    const cur = map.get(r._id.cashboxId) ?? {};
    cur[r._id.key] = (cur[r._id.key] ?? 0) + r.sum;
    map.set(r._id.cashboxId, cur);
  }
  return map;
}

/** Kassaning tasdiq kutayotgan JAMI summasi (barcha to'lov turlari). */
export function pendingOutTotal(pending: CashboxMethodTotals | undefined): number {
  if (!pending) return 0;
  return Object.values(pending).reduce((a, b) => a + (b || 0), 0);
}
