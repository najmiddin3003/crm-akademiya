import type { Db } from "mongodb";
import { uzDateIso, uzNow } from "@/lib/uzTime";

// Kassa kartochkasidagi ikkita raqam (Moliya → Kassalar):
//   • Bugungi tushum — shu kassaga BUGUN tushgan kirim.
//   • Bu oy rahbar kassaga o'tkazilgan pul — shu kassadan BOSH KASSAGA
//     jo'natilgan ko'chirmalar yig'indisi, joriy oy bo'yicha.
//
// Ikkalasi ham jurnaldan (`transaction_entries`) JONLI hisoblanadi, kassa
// hujjatida saqlanmaydi — aks holda har yozuvda ikkita joyni bir vaqtda
// yangilash kerak bo'lardi va ular bir-biridan uzilib qolishi mumkin edi
// (`balance` bilan `methodTotals` orasidagi tuzoq bir marta shunday
// bo'lgan). Sana FOYDALANUVCHI ko'radigan `date` maydonidan olinadi —
// jadval va hisobotlar ham shu maydon bo'yicha filtrlaydi.

export interface CashboxCardStats {
  /** Bugun shu kassaga tushgan kirim (bekor qilinganlari hisobga olinmaydi). */
  todayIncome: number;
  /**
   * O'sha bugungi tushumning TO'LOV TURI kesimi — kartochkadagi
   * "Naqd / Plastik / Terminal" qatorining IZOHIDA ko'rinadi (qatordagi
   * raqamning o'zi `methodTotals`, ya'ni qoldiq).
   *
   * Jami bilan kesim BITTA so'rovdan chiqadi, ya'ni ular hech qachon
   * bir-biriga zid bo'lmaydi.
   */
  todayByMethod: Record<string, number>;
  /**
   * Joriy oyda shu kassadan bosh kassaga jo'natilgan summa.
   *
   * TASDIQ KUTAYOTGANLARI HAM KIRADI (`waiting`), faqat bekor qilingani
   * chiqib qoladi. Sabab: bu raqam kassirning "shu oy rahbarga qancha
   * topshirdim" savoliga javob beradi. Faqat tasdiqlanganini sanasak,
   * rahbar bir hafta ✓ bosmaganda karta 0 ko'rsatib turardi.
   */
  monthToPrimary: number;
}

export async function loadCardStats(
  db: Db,
  cashboxIds: number[],
  /** Bosh kassa (`cashboxes.isPrimary`). Yo'q bo'lsa ikkinchi raqam 0. */
  primaryId: number | null,
): Promise<Map<number, CashboxCardStats>> {
  const out = new Map<number, CashboxCardStats>();
  if (cashboxIds.length === 0) return out;
  for (const id of cashboxIds) {
    out.set(id, { todayIncome: 0, todayByMethod: {}, monthToPrimary: 0 });
  }

  const entries = db.collection("transaction_entries");
  const today = uzDateIso(uzNow());
  const monthStart = today.slice(0, 8) + "01";
  // Keyingi oyning boshi — "YYYY-MM-DD" satrlari leksik tartibda
  // solishtiriladi, ya'ni oy oxirining nechanchi kun ekanini bilish
  // shart emas.
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;

  const [incomeRows, inRows] = await Promise.all([
    entries
      .aggregate<{ _id: { cashboxId: number; key: string | null }; sum: number }>([
        {
          $match: {
            cashboxId: { $in: cashboxIds },
            txType: "payIn",
            date: today,
            status: { $ne: "cancelled" },
          },
        },
        // TO'LOV TURI kesimida — jami `todayIncome` shu chelaklarni
        // qo'shib chiqariladi, ya'ni ikkita raqam bir manbadan bo'ladi
        // va hech qachon bir-biriga zid chiqmaydi.
        { $group: { _id: { cashboxId: "$cashboxId", key: "$paymentMethodKey" }, sum: { $sum: "$amount" } } },
      ])
      .toArray(),
    // Bosh kassaga KELGAN ko'chirma qatorlari. Jo'natuvchi kassa
    // ularning o'zida yozilmagan — u juftlikning "out" qatorida turadi,
    // shuning uchun pastda `transferId` bo'yicha bog'lanadi.
    primaryId === null
      ? Promise.resolve([])
      : entries
          .find({
            cashboxId: primaryId,
            txType: "transfer",
            transferRole: "in",
            date: { $gte: monthStart, $lt: nextMonth },
            status: { $ne: "cancelled" },
          })
          .project<{ transferId?: number; amount?: number }>({ _id: 0, transferId: 1, amount: 1 })
          .toArray(),
  ]);

  for (const r of incomeRows) {
    const cur = out.get(r._id.cashboxId);
    if (!cur) continue;
    cur.todayIncome += r.sum;
    // Kaliti YO'Q eski yozuv jamiga kiradi, lekin taqsimotga tushmaydi —
    // uni qaysi turga yozishni bilib bo'lmaydi. Shu sabab qatorlar
    // yig'indisi jamidan KICHIK bo'lishi mumkin; kartochkada bu
    // "Bugungi tushum" satri bilan solishtirilganda ko'rinadi.
    if (r._id.key) cur.todayByMethod[r._id.key] = (cur.todayByMethod[r._id.key] ?? 0) + r.sum;
  }

  // `transferId` yo'q qator — juftligini ishonchli topib bo'lmaydi, ya'ni
  // pulni qaysi kassa jo'natganini ham. Bunday qatorlar bu maydon
  // qo'shilishidan oldingi (import qilingan) tarixda uchraydi; joriy oyda
  // yo'q. Ularni noto'g'ri kassaga yozgandan ko'ra sanamagan afzal.
  const amountByTransfer = new Map<number, number>();
  for (const r of inRows) {
    if (typeof r.transferId !== "number") continue;
    amountByTransfer.set(r.transferId, Math.abs(Number(r.amount) || 0));
  }
  if (amountByTransfer.size > 0) {
    const outRows = await entries
      .find({ transferId: { $in: [...amountByTransfer.keys()] }, transferRole: "out" })
      .project<{ transferId?: number; cashboxId?: number }>({ _id: 0, transferId: 1, cashboxId: 1 })
      .toArray();
    for (const o of outRows) {
      const cur = typeof o.cashboxId === "number" ? out.get(o.cashboxId) : undefined;
      if (!cur || typeof o.transferId !== "number") continue;
      cur.monthToPrimary += amountByTransfer.get(o.transferId) ?? 0;
    }
  }

  return out;
}
