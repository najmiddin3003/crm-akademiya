import type { Db } from "mongodb";

// KUNLIK TOPSHIRUV HISOBOTI — rahbar kassa uchun (Moliya → Kassalar →
// rahbar kartochkasidagi ro'yxat ikonkasi).
//
// Savol: "har bir filial kassiri BUGUN qancha pul yig'di, qancha sarfladi
// va rahbarga qanchasini topshirdi?" Har qator — bitta filial kassasi:
//
//   Tushum            — shu kunga yozilgan kirimlar (payIn), bekor
//                       qilinganlaridan tashqari.
//   Chiqim            — shu kunga yozilgan chiqimlar (payOut), tasdiqlangan.
//   Topshirishi kerak — Tushum − Chiqim (kun oxirida rahbarga ketishi
//                       kerak bo'lgan pul).
//   Jo'natdi          — shu kuni RAHBAR KASSAGA jo'natilgan ko'chirmalar
//                       (bekor qilingani chiqib qoladi), ikkiga bo'linadi:
//                       tasdiqlangan (✓ bosilgan) va kutilmoqda.
//   Farq              — Topshirishi kerak − Jo'natdi. Musbat: hali
//                       topshirilmagan; manfiy: bugungidan ko'p jo'natgan
//                       (masalan kechagi qoldiqni ham qo'shib).
//
// Hamma raqam jurnaldan (`transaction_entries`), foydalanuvchi ko'radigan
// `date` maydoni bo'yicha — jadval va kartochka statistikasi (cashboxStats)
// ham shu maydonga tayanadi. Ko'chirmaning QABUL QILUVCHISI chiquvchi
// qatorda saqlanmaydi — juftlik `transferId` orqali bog'lanadi
// (lib/cashboxStats.ts dagi "bu oy rahbarga" hisobi bilan bir xil usul).

export interface HandoverRow {
  cashboxId: number;
  name: string;
  /** Kassa egasi (`cashboxes.moderator`). */
  moderator: string;
  income: number;
  expense: number;
  /** income − expense */
  mustSend: number;
  sentAccepted: number;
  sentPending: number;
  /** Kutilayotgan ko'chirmalar SONI (rahbar nechta ✓ bosishi kerak). */
  pendingCount: number;
  /** mustSend − (sentAccepted + sentPending) */
  diff: number;
  /** Kassadagi hozirgi qoldiq (kun bilan bog'liq emas). */
  balance: number;
}

export interface HandoverReport {
  date: string;
  rows: HandoverRow[];
  totals: Pick<HandoverRow, "income" | "expense" | "mustSend" | "sentAccepted" | "sentPending" | "pendingCount" | "diff" | "balance">;
}

export async function loadHandoverReport(
  db: Db,
  date: string,
  primaryId: number,
  /** Hisobotga kiradigan filial kassalari (bosh kassa EMAS). */
  cashboxes: { id: number; name: string; moderator: string; balance: number }[],
): Promise<HandoverReport> {
  const ids = cashboxes.map((c) => c.id);
  const rows = new Map<number, HandoverRow>();
  for (const c of cashboxes) {
    rows.set(c.id, {
      cashboxId: c.id,
      name: c.name,
      moderator: c.moderator,
      income: 0,
      expense: 0,
      mustSend: 0,
      sentAccepted: 0,
      sentPending: 0,
      pendingCount: 0,
      diff: 0,
      balance: c.balance,
    });
  }

  const entries = db.collection("transaction_entries");
  const [flows, inRows] = await Promise.all([
    ids.length === 0
      ? Promise.resolve([])
      : entries
          .aggregate<{ _id: { cashboxId: number; txType: string }; sum: number }>([
            {
              $match: {
                cashboxId: { $in: ids },
                date,
                txType: { $in: ["payIn", "payOut"] },
                // Kirimda bekor qilingani, chiqimda bekor qilingan va
                // (bo'lsa) kutilayotgani sanalmaydi — jadval yig'indisi
                // bilan bir xil qoida (api/transaction-entries).
                status: { $nin: ["waiting", "cancelled"] },
              },
            },
            { $group: { _id: { cashboxId: "$cashboxId", txType: "$txType" }, sum: { $sum: { $abs: "$amount" } } } },
          ])
          .toArray(),
    // Bosh kassaga shu kuni KELGAN ko'chirma qatorlari — holati bilan.
    entries
      .find({ cashboxId: primaryId, txType: "transfer", transferRole: "in", date, status: { $ne: "cancelled" } })
      .project<{ transferId?: number; amount?: number; status?: string }>({ _id: 0, transferId: 1, amount: 1, status: 1 })
      .toArray(),
  ]);

  for (const f of flows) {
    const r = rows.get(f._id.cashboxId);
    if (!r) continue;
    if (f._id.txType === "payIn") r.income += f.sum;
    else r.expense += f.sum;
  }

  // Juftlik: keluvchi qator → transferId → chiquvchi qatorning kassasi.
  const inByTransfer = new Map<number, { amount: number; pending: boolean }>();
  for (const r of inRows) {
    if (typeof r.transferId !== "number") continue;
    inByTransfer.set(r.transferId, { amount: Math.abs(Number(r.amount) || 0), pending: r.status === "waiting" });
  }
  if (inByTransfer.size > 0) {
    const outRows = await entries
      .find({ transferId: { $in: [...inByTransfer.keys()] }, transferRole: "out" })
      .project<{ transferId?: number; cashboxId?: number }>({ _id: 0, transferId: 1, cashboxId: 1 })
      .toArray();
    for (const o of outRows) {
      if (typeof o.transferId !== "number" || typeof o.cashboxId !== "number") continue;
      const r = rows.get(o.cashboxId);
      const t = inByTransfer.get(o.transferId);
      if (!r || !t) continue;
      if (t.pending) {
        r.sentPending += t.amount;
        r.pendingCount += 1;
      } else r.sentAccepted += t.amount;
    }
  }

  const list = [...rows.values()];
  const totals: HandoverReport["totals"] = { income: 0, expense: 0, mustSend: 0, sentAccepted: 0, sentPending: 0, pendingCount: 0, diff: 0, balance: 0 };
  for (const r of list) {
    r.mustSend = r.income - r.expense;
    r.diff = r.mustSend - (r.sentAccepted + r.sentPending);
    totals.income += r.income;
    totals.expense += r.expense;
    totals.mustSend += r.mustSend;
    totals.sentAccepted += r.sentAccepted;
    totals.sentPending += r.sentPending;
    totals.pendingCount += r.pendingCount;
    totals.diff += r.diff;
    totals.balance += r.balance;
  }
  // Bugun harakati bo'lganlar tepada, keyin nomi bo'yicha — rahbar avval
  // "kim topshirmadi" ni ko'rsin.
  list.sort((a, b) => {
    const aa = a.income || a.expense || a.sentAccepted || a.sentPending ? 0 : 1;
    const bb = b.income || b.expense || b.sentAccepted || b.sentPending ? 0 : 1;
    return aa - bb || a.name.localeCompare(b.name);
  });
  return { date, rows: list, totals };
}
