import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";

// Xodimga oylik/avans chiqarilganini shu oy ichida qancha yig'ilib qolganini
// hisoblab beradi. Kassa → Chiqim oynasi bu bilan qolgan oylikni topadi va
// oyligidan oshib ketmasligini nazorat qiladi (avanslar oylikdan ayrilib
// ketaveradi, tugasa keyingi oygacha yana chiqarilmaydi).
//
//   GET /api/employee-salary-summary?name=<xodim>&month=YYYY-MM
//
// Filtr: kategoriya nomida "oylik" yoki "avans" bor, chiqim turi, sanasi shu
// oyda, o'chirilgan (cancelled) tranzaksiyalar hisobga olinmaydi.

function isSalaryCategory(name: string): boolean {
  return /avans|oylik/i.test(name || "");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const name = (url.searchParams.get("name") || "").trim();
  const month = (url.searchParams.get("month") || "").trim();

  if (!name || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const rows = await db
    .collection("transaction_entries")
    .find({
      studentName: name,
      txType: "payOut",
      date: { $regex: `^${month}-` },
      status: { $ne: "cancelled" },
    })
    .toArray();

  const paid = rows
    .filter((r) => isSalaryCategory(String(r.txName ?? "")))
    .reduce((s, r) => s + Math.abs(Number(r.amount) || 0), 0);

  return NextResponse.json({ ok: true, paid });
}
