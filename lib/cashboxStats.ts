import type { Db } from "mongodb";
import { uzDateIso } from "@/lib/uzTime";

// Kassa kartochkasidagi raqamlar (Moliya → Kassalar):
//   • Bugungi tushum — shu kassaga BUGUN tushgan kirim.
//   • Oxirgi topshiruvdan beri tushum / chiqim — rahbar oxirgi marta shu
//     kassadan kelgan ko'chirmani ✓ QABUL QILGANIDAN beri yig'ilgan kirim va
//     qilingan chiqim (kassir "hozir qancha topshirishim kerak" savoliga
//     javob: tushum − chiqim). Qabul qilingan ko'chirma yo'q bo'lsa —
//     boshidan beri. (11.09.2026 gacha bu yerda "Bu oy rahbar kassaga
//     o'tkazilgan pul" turardi — foydalanuvchi so'rovi bilan olib tashlandi.)
//   • Kutilayotgan ko'chirma summasi — SHU KASSAGA jo'natilgan, lekin hali
//     ✓ bosilmagan ko'chirmalar (rahbar kassa uchun: filiallar bugun
//     qancha topshirmoqchi, u hali balansda yo'q).
//
// Hammasi jurnaldan (`transaction_entries`) JONLI hisoblanadi, kassa
// hujjatida saqlanmaydi — aks holda har yozuvda ikkita joyni bir vaqtda
// yangilash kerak bo'lardi va ular bir-biridan uzilib qolishi mumkin edi
// (`balance` bilan `methodTotals` orasidagi tuzoq bir marta shunday
// bo'lgan). Bugungi tushum FOYDALANUVCHI ko'radigan `date` maydonidan —
// jadval va hisobotlar ham shu maydon bo'yicha filtrlaydi; "oxirgi
// topshiruvdan beri" esa `createdAt` (yozilgan lahza) bo'yicha — kassir
// orqaga sana qo'yib kiritsa ham pul kassaga QACHON kirgani muhim.

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
   * Oxirgi QABUL QILINGAN topshiruvdan (shu kassadan bosh kassaga
   * jo'natilib ✓ bosilgan ko'chirma) beri: tushum, chiqim va chegara lahzasi.
   *
   * Chegara — ko'chirmaning `decidedAt` (✓ bosilgan vaqt,
   * lib/transferDecision.ts); 11.09.2026 dan oldingi ko'chirmalarda bu
   * maydon yo'q, ularda jo'natilgan vaqt (`createdAt`) olinadi. `since`
   * null — hali birorta qabul qilingan topshiruv yo'q (boshidan beri).
   */
  sinceHandover: { income: number; expense: number; since: string | null };
  /**
   * Shu kassaga KELAYOTGAN, tasdiq kutayotgan ko'chirmalar yig'indisi.
   *
   * Qabul qiluvchi uchun bu pul hali balansda yo'q — ikkala qoidada ham
   * (`deductedOnSend` qanday bo'lmasin) u ✓ bosilgunicha jo'natuvchida yoki
   * "yo'lda" turadi, shu bois bayroq tekshirilmaydi. Rad etilgani
   * (`cancelled`) hisobga kirmaydi.
   */
  pendingIn: number;
  /** Kutilayotgan keluvchi ko'chirmalar SONI — kartochkadagi ikonka belgisi. */
  pendingInCount: number;
}

export async function loadCardStats(
  db: Db,
  cashboxIds: number[],
  /** Bosh kassa (`cashboxes.isPrimary`). Yo'q bo'lsa "oxirgi topshiruv" boshidan beri. */
  primaryId: number | null,
): Promise<Map<number, CashboxCardStats>> {
  const out = new Map<number, CashboxCardStats>();
  if (cashboxIds.length === 0) return out;
  for (const id of cashboxIds) {
    out.set(id, {
      todayIncome: 0,
      todayByMethod: {},
      sinceHandover: { income: 0, expense: 0, since: null },
      pendingIn: 0,
      pendingInCount: 0,
    });
  }

  const entries = db.collection("transaction_entries");
  // `uzDateIso()` — ARGUMENTSIZ. `uzDateIso(uzNow())` ikki marta siljitardi
  // (uzNow +5 soat, uzDateIso yana +5): Vercel'da (UTC) Toshkent 19:00 dan
  // keyin "bugun" ertangi kun bo'lib, kartochkadagi "Bugungi tushum" 0 ga
  // tushardi (11.09.2026, 21:00 da sezildi). Dev mashinada (UTC+5)
  // siljish 0 bo'lgani uchun ko'rinmasdi.
  const today = uzDateIso();

  const [incomeRows, acceptedInRows, pendingInRows] = await Promise.all([
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
    // Bosh kassaga KELGAN va ✓ QABUL QILINGAN ko'chirma qatorlari — chegara
    // lahzasi uchun. Jo'natuvchi kassa ularning o'zida yozilmagan — u
    // juftlikning "out" qatorida turadi, pastda `transferId` bo'yicha bog'lanadi.
    primaryId === null
      ? Promise.resolve([])
      : entries
          .find({ cashboxId: primaryId, txType: "transfer", transferRole: "in", status: "" })
          .project<{ transferId?: number; createdAt?: string; decidedAt?: string }>({ _id: 0, transferId: 1, createdAt: 1, decidedAt: 1 })
          .toArray(),
    // Tasdiq kutayotgan KELUVCHI qatorlar — kassa kesimida. Keluvchi qator
    // miqdori musbat yoziladi, baribir modulini olamiz.
    entries
      .aggregate<{ _id: number; sum: number; n: number }>([
        { $match: { cashboxId: { $in: cashboxIds }, txType: "transfer", transferRole: "in", status: "waiting" } },
        { $group: { _id: "$cashboxId", sum: { $sum: { $abs: "$amount" } }, n: { $sum: 1 } } },
      ])
      .toArray(),
  ]);

  for (const r of pendingInRows) {
    const cur = out.get(r._id);
    if (cur) {
      cur.pendingIn = r.sum;
      cur.pendingInCount = r.n;
    }
  }

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

  // Har kassa uchun OXIRGI qabul qilingan topshiruv lahzasi. `transferId`
  // yo'q qator — juftligini ishonchli topib bo'lmaydi (import qilingan eski
  // tarix); ular tashlab ketiladi.
  const momentByTransfer = new Map<number, string>();
  for (const r of acceptedInRows) {
    if (typeof r.transferId !== "number") continue;
    const moment = r.decidedAt || r.createdAt;
    if (moment) momentByTransfer.set(r.transferId, moment);
  }
  const sinceById = new Map<number, string>();
  if (momentByTransfer.size > 0) {
    const outRows = await entries
      .find({ transferId: { $in: [...momentByTransfer.keys()] }, transferRole: "out", cashboxId: { $in: cashboxIds } })
      .project<{ transferId?: number; cashboxId?: number }>({ _id: 0, transferId: 1, cashboxId: 1 })
      .toArray();
    for (const o of outRows) {
      if (typeof o.transferId !== "number" || typeof o.cashboxId !== "number") continue;
      const m = momentByTransfer.get(o.transferId);
      if (!m) continue;
      const prev = sinceById.get(o.cashboxId);
      // ISO satrlar — leksik tartib vaqt tartibiga teng.
      if (!prev || m > prev) sinceById.set(o.cashboxId, m);
    }
  }

  // Chegaradan keyingi kirim/chiqim — bitta so'rovda, kassa bo'yicha har xil
  // chegara bilan (`$or`). Chegarasi yo'q kassada — boshidan beri.
  const flowRows = await entries
    .aggregate<{ _id: { cashboxId: number; txType: string }; sum: number }>([
      {
        $match: {
          txType: { $in: ["payIn", "payOut"] },
          status: { $nin: ["waiting", "cancelled"] },
          $or: cashboxIds.map((id) => {
            const since = sinceById.get(id);
            return since ? { cashboxId: id, createdAt: { $gt: since } } : { cashboxId: id };
          }),
        },
      },
      { $group: { _id: { cashboxId: "$cashboxId", txType: "$txType" }, sum: { $sum: { $abs: "$amount" } } } },
    ])
    .toArray();
  for (const [id, since] of sinceById) {
    const cur = out.get(id);
    if (cur) cur.sinceHandover.since = since;
  }
  for (const f of flowRows) {
    const cur = out.get(f._id.cashboxId);
    if (!cur) continue;
    if (f._id.txType === "payIn") cur.sinceHandover.income += f.sum;
    else cur.sinceHandover.expense += f.sum;
  }

  return out;
}
