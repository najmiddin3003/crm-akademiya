import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { isMonthKey, payrollMonthKey, payrollPeriod } from "@/lib/salary";
import { getBranchScope } from "@/lib/branchScope";

// GET /api/salary-runs/month-cashflow[?month=YYYY-MM]
//
// Oylik chiqarish sahifasidagi "Jami tushum" kartochkasi uchun:
// tanlangan oyning JAMI DAROMADI va JAMI XARAJATI.
//
// Kartochka kattaroq raqamda tushumni, tagida esa sof foydani ko'rsatadi:
//     sof foyda = daromad − xarajat − qolgan to'lanadigan oylik
// Uchinchi qism ATAYLAB bu yerda emas: u xodimlar jadvalidan hosila
// (components/finance/SalaryCreatePage.tsx → `stats.qolgan`) va uni
// serverda qayta hisoblash ikkita raqam bir-biriga mos kelmasligi
// xavfini tug'dirardi.
//
// MANBA — `transaction_entries` (jurnal), `transactions` EMAS.
//
// Ikkalasi ham daromad/xarajatni saqlaydi, lekin BEKOR QILISHNI boshqacha
// yozadi. Jurnalda yozuv o'sha joyida qoladi va `status: "cancelled"`
// bo'ladi; `transactions` da esa ASL QATOR TEGILMAYDI, ustiga teskari
// (−summa, "… (bekor qilindi)") qator qo'shiladi va u BEKOR QILINGAN
// KUNGA yoziladi (app/api/transaction-entries/[id]/cancel/route.ts).
//
// Ishoraga qarab yig'ilsa bu ikkala raqamni ham shishirardi: bekor
// qilingan 535 000 so'mlik to'lov daromadga ham, xarajatga ham qo'shilib
// ketardi (farq to'g'ri, lekin "Jami tushum" 535 000 ga ko'p ko'rinardi).
// Jurnalda esa bitta `status` sharti buni butunlay yopadi.
//
// Ko'chirmalar `txType` bilan chiqarib tashlanadi — kassadan kassaga
// o'tkazilgan pul daromad ham, xarajat ham emas.
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
    .collection("transaction_entries")
    .aggregate<{ _id: "payIn" | "payOut"; amount: unknown }>([
      {
        $match: {
          cashboxId: { $in: cashboxIds },
          date: { $gte: `${month}-01`, $lte: `${month}-31` },
          // Ko'chirmalar (`transfer`) SHU YERDA CHIQIB KETADI — kassadan
          // kassaga o'tkazilgan pul daromad ham, xarajat ham emas.
          txType: { $in: ["payIn", "payOut"] },
          status: { $ne: "cancelled" },
        },
      },
      {
        $group: {
          _id: "$txType",
          // $toDecimal — bazada kasrli summalar bor va oddiy $sum float'da
          // yig'ib 216496999.99999997 kabi qiymat beradi
          // (app/api/transactions/summary/route.ts dagi 1-qoida).
          amount: { $sum: { $toDecimal: "$amount" } },
        },
      },
    ])
    .toArray();

  const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v.toString()));
  return NextResponse.json({
    ok: true,
    month,
    hasCashbox: true,
    daromad: num(rows.find((r) => r._id === "payIn")?.amount),
    // Chiqim manfiy saqlanadi — kartochkada MUSBAT son ko'rinishi kerak.
    xarajat: Math.abs(num(rows.find((r) => r._id === "payOut")?.amount)),
  });
}
