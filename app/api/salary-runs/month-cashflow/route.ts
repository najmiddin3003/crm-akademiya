import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { isMonthKey, payrollMonthKey, payrollPeriod } from "@/lib/salary";
import { getBranchScope } from "@/lib/branchScope";

// GET /api/salary-runs/month-cashflow[?month=YYYY-MM]
//
// Oylik chiqarish sahifasidagi "O'quv markazda qoladi" kartochkasi uchun:
// tanlangan oyning JAMI DAROMADI va JAMI XARAJATI.
//
// Kartochkadagi son shu ikkitasidan va sahifaning o'z hisobidan chiqadi:
//     qoladi = daromad − xarajat − qolgan to'lanadigan oylik
// Uchinchi qism ATAYLAB bu yerda emas: u xodimlar jadvalidan hosila
// (components/finance/SalaryCreatePage.tsx → `stats.qolgan`) va uni
// serverda qayta hisoblash ikkita raqam bir-biriga mos kelmasligi
// xavfini tug'dirardi.
//
// MANBA — `transactions` kolleksiyasi, `transaction_entries` EMAS.
// Sabab: kassalararo ko'chirmalar `transactions` ga umuman yozilmaydi
// (lib/transactionLog.ts), ya'ni kassadan kassaga pul ko'chirish daromad
// yoki xarajat bo'lib ko'rinmaydi. Jurnaldan hisoblansa, rahbar kassaga
// o'tkazilgan har bir summa "xarajat" bo'lib qo'shilib ketardi.
//
// FILIAL QAMROVI SHART. Yonidagi to'rtta kartochka filialga kesilgan
// (`/api/salary-runs/employees-payroll` → `payrollBranchId`), demak bu
// ham kesilishi kerak — aks holda bitta kartochkada bir filialning
// oyligi butun tarmoqning daromadidan ayirilardi. `transactions` da
// filial maydoni yo'q, shuning uchun kesish KASSA orqali:
// `cashboxes.branchId`.
//
// Filialga biriktirilmagan kassa (branchId yo'q) hech qaysi filialga
// tushmaydi — bu ataylab: uni "hammaga" qo'shish yig'indini takrorlardi.
//
// DIQQAT — `cashboxes.branchId` ni INTERFEYS TO'LDIRMAYDI. U eski
// importdan qolgan: bugun faqat 3, 4 (filial 1) va 5 (filial 2)
// kassalarida bor, interfeysdan yaratilgan kassalarda esa YO'Q. Ya'ni
// filialga bitta ham kassa bog'lanmagan bo'lishi mumkin, va o'sha
// filialda "daromad 0 − xarajat 0 − oylik 3 000 000" degan MA'NOSIZ son
// chiqardi. Shu bois javobda `hasCashbox` bayrog'i bor va kartochka u
// `false` bo'lganda raqam o'rniga sababni yozadi.
export async function GET(req: Request) {
  const raw = (new URL(req.url).searchParams.get("month") ?? "").trim();
  if (raw && !isMonthKey(raw)) {
    return NextResponse.json({ ok: false, error: "Oy noto'g'ri (YYYY-MM kutiladi)" }, { status: 400 });
  }
  const month = raw || payrollMonthKey(payrollPeriod());

  const db = await ensureIndexes();
  const scope = await getBranchScope();
  if (!scope) {
    return NextResponse.json({ ok: false, error: "Sessiya topilmadi" }, { status: 401 });
  }

  const boxes = await db
    .collection("cashboxes")
    .find({ branchId: scope.branchId }, { projection: { id: 1, _id: 0 } })
    .toArray();
  const cashboxIds = boxes.map((b) => Number(b.id)).filter(Number.isFinite);
  if (cashboxIds.length === 0) {
    return NextResponse.json({ ok: true, month, hasCashbox: false, daromad: 0, xarajat: 0 });
  }

  // "YYYY-MM-31" — sanalar matn sifatida solishtiriladi, ya'ni oyning
  // nechanchi kunda tugashini bilish shart emas.
  const rows = await db
    .collection("transactions")
    .aggregate<{ _id: "pos" | "neg" | "zero"; amount: unknown }>([
      {
        $match: {
          cashboxId: { $in: cashboxIds },
          date: { $gte: `${month}-01`, $lte: `${month}-31` },
        },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $gt: ["$amount", 0] }, "pos",
              { $cond: [{ $lt: ["$amount", 0] }, "neg", "zero"] },
            ],
          },
          // $toDecimal — bazada kasrli summalar bor va oddiy $sum float'da
          // yig'ib 216496999.99999997 kabi qiymat beradi
          // (app/api/transactions/summary/route.ts dagi 1-qoida).
          amount: { $sum: { $toDecimal: "$amount" } },
        },
      },
    ])
    .toArray();

  const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v.toString()));
  const pos = rows.find((r) => r._id === "pos");
  const neg = rows.find((r) => r._id === "neg");
  return NextResponse.json({
    ok: true,
    month,
    hasCashbox: true,
    daromad: num(pos?.amount),
    // Chiqim manfiy saqlanadi — kartochkada MUSBAT son ko'rinishi kerak.
    xarajat: Math.abs(num(neg?.amount)),
  });
}
