// FAQAT O'QIYDI. "Faqat o'z oyidan" (04.10.2026) DEPLOYIDAN OLDIN prod'da
// yurgiziladi — o'tish davri ro'yxati:
//
//   node --import ./scripts/_ts-alias.mjs scripts/_check-pending-paid-later.mjs [YYYY-MM]
//
// NIMA QIDIRILADI: 02.10.2026 (reliz 20261002143008) dan yangi qoida deploy
// qilinguncha sentabr qoldig'i oktabrning "Qolgan"ida turardi. O'sha paytda
// u bilan birga chiqarilgan pul OKTABR yozuvi bo'ldi (Oylik chiqarish —
// month 2026-10; Chiqim — «Qaysi oy uchun» hali deploy qilinmagan, sana
// oyi). Yangi qoidada bunday xodimda:
//   oktabr `payrollDue` < 0 (ortiqcha to'lov)  VA  sentabr pending > 0,
// jami qarz (`payrollOwedTotal`) esa to'g'ri. Sentabr sahifasidan yana
// chiqarilsa — IKKINCHI to'lov. Interfeys endi ogohlantiradi
// (lib/salary.ts → payrollPendingMaybePaid), lekin yozuvning o'zi xato oyda.
//
// NATIJA: har shubhali xodim uchun — shubhali summa, pending oylar va shu
// oydagi OYLIK yozuvlari (id, sana, summa, periodMonth, salaryRunId, izoh).
// TUZATISH bu skriptda YO'Q (mavjud yozuvning oyini o'zgartiradigan API ham
// yo'q). Variantlar — foydalanuvchi qarori bilan:
//   1) yozuvni bekor qilib (Tranzaksiyalar → bekor), Chiqim'da «Qaysi oy
//      uchun: Sentabr» bilan qayta kiritish;
//   2) bir martalik skript: yozuvga `periodMonth: "2026-09"` (summa
//      shubhadan oshsa — yozuvni bo'lish), zaxira + --undo, sync_outbox
//      tuzog'i (kassa-minus-balans eslatmasi) hisobga olinsin.
// Argument — tekshiriladigan oy (sukut: joriy oy, Toshkent vaqti).
import { MongoClient } from "mongodb";
import fs from "node:fs";
import { attachMaybePaidIn, buildPayrollRows, monthMatch } from "@/lib/payrollSources";
import {
  isMonthKey,
  payrollDue,
  payrollMonthKey,
  payrollOwedTotal,
  payrollPendingMaybePaid,
  payrollPeriod,
  payrollPeriodOf,
  pendingMaybePaidByMonth,
} from "@/lib/salary";

const env = fs.readFileSync(".env.local", "utf8");
const pick = (k, d) => (new RegExp(`^${k}=(.*)$`, "m").exec(env)?.[1] || "").trim().replace(/^["']|["']$/g, "") || d;

const arg = (process.argv[2] ?? "").trim();
if (arg && !isMonthKey(arg)) {
  console.error("Oy noto'g'ri (YYYY-MM kutiladi)");
  process.exit(2);
}
const period = arg ? payrollPeriodOf(arg) : payrollPeriod();
const month = payrollMonthKey(period);

const client = new MongoClient(pick("MONGODB_URI"));
await client.connect();
const db = client.db(pick("MONGODB_DB", "crm_akademiya"));
const fmt = (n) => Math.round(n).toLocaleString("ru-RU");

try {
  const rows = await buildPayrollRows(db, period);
  const hits = rows.filter((e) => payrollPendingMaybePaid(e, period) > 0);
  const withPending = rows.filter((e) => (e.carryPending ?? 0) > 0);
  console.log(`Oy: ${month} | xodimlar: ${rows.length} | pending bor: ${withPending.length} | SHUBHALI: ${hits.length}\n`);

  let total = 0;
  for (const e of hits) {
    const maybe = payrollPendingMaybePaid(e, period);
    total += maybe;
    const byMonth = pendingMaybePaidByMonth(e, period).map((x) => `${x.month}: ${fmt(x.amount)}`).join(", ");
    const pend = (e.carryPendingMonths ?? []).map((x) => `${x.month}: ${fmt(x.amount)}`).join(", ");
    console.log(
      `#${e.id} ${e.name} — shubha ${fmt(maybe)} (${byMonth})\n` +
      `   ${month} payrollDue ${fmt(payrollDue(e, period))} · olingan oylik ${fmt(e.paidOylik)} · avans ${fmt(e.paidAvans)}` +
      ` · carryOver ${fmt(e.carryOver)} · pending [${pend}] · jami qarz ${fmt(payrollOwedTotal(e, period))}`,
    );
    const entries = await db
      .collection("transaction_entries")
      .find({
        txType: "payOut",
        $or: monthMatch(month),
        status: { $ne: "cancelled" },
        txName: { $regex: "oylik", $options: "i" },
        studentName: { $regex: `^\\s*${e.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, $options: "i" },
      })
      .project({ _id: 0, id: 1, date: 1, time: 1, amount: 1, periodMonth: 1, salaryRunId: 1, note: 1, cashboxId: 1, txName: 1 })
      .sort({ date: 1, id: 1 })
      .toArray();
    for (const r of entries) {
      console.log(
        `   ↳ yozuv id ${r.id} | ${r.date} ${r.time ?? ""} | ${fmt(Number(r.amount) || 0)} | periodMonth ${r.periodMonth || "(yo'q — sana oyi)"}` +
        ` | kassa ${r.cashboxId ?? "-"}${r.salaryRunId ? ` | Oylik chiqarish #${r.salaryRunId}` : ""} | ${r.txName ?? ""} | ${r.note ?? ""}`,
      );
    }
    console.log("");
  }
  console.log(`JAMI shubhali: ${fmt(total)} so'm (${hits.length} xodim)`);

  // O'TGAN OY SAHIFALARI — o'sha qatorlarda "qayta chiqarmang" belgisi
  // (`maybePaidIn`) chiqadimi. Faqat joriy oy tekshirilganda: belgi joriy
  // oyga nisbatan qo'yiladi (lib/payrollSources.ts → attachMaybePaidIn).
  if (month === payrollMonthKey(payrollPeriod())) {
    const months = [...new Set(hits.flatMap((e) => pendingMaybePaidByMonth(e, period).map((x) => x.month)))].sort();
    for (const m of months) {
      const p = payrollPeriodOf(m);
      const marked = (await attachMaybePaidIn(db, p, await buildPayrollRows(db, p))).filter((e) => e.maybePaidIn);
      console.log(`
${m} sahifasi — belgilanganlar: ${marked.length}`);
      for (const e of marked) {
        console.log(`   #${e.id} ${e.name} — Qolgan ${fmt(payrollDue(e, p))}, shundan ${fmt(e.maybePaidIn.amount)} ehtimol ${e.maybePaidIn.month} da berilgan`);
      }
    }
  }
} finally {
  await client.close();
}
