import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";

// GET /api/transaction-entries/facets?cashboxId=<n>
//
// Kassalar sahifasidagi filtr TANLOVLARI: tranzaksiya nomlari, o'qituvchi
// va o'quvchi ismlari.
//
// Ilgari bu ro'yxatlar klientda `entries` dan yig'ilardi — u paytda butun
// jadval brauzerda bo'lgani uchun bu ishlardi. Jadval sahifalab o'qiladigan
// bo'lgach (50 qator) ular qisqarib qolardi: kassa 4 da katalogda yo'q 5 ta
// tranzaksiya nomi va 51 ta o'qituvchi ismi ro'yxatdan tushib ketardi.
//
// Tanlovlar ATAYLAB faqat `cashboxId` bo'yicha olinadi — sana yoki boshqa
// filtrlar qo'llanmaydi. Shunda filtr qo'yilganda tanlov ro'yxati
// qisqarmaydi va foydalanuvchi o'zi tanlagan qiymatni yo'qotmaydi.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const raw = sp.get("cashboxId");
  const cashboxId = Number(raw);
  if (!raw || !Number.isFinite(cashboxId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri cashboxId" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("transaction_entries");
  const filter = { cashboxId };
  const [txNames, teacherNames, studentNames] = await Promise.all([
    col.distinct("txName", filter),
    col.distinct("teacherName", filter),
    col.distinct("studentName", filter),
  ]);
  const clean = (a: unknown[]) => (a.filter(Boolean) as string[]).sort();
  return NextResponse.json({
    ok: true,
    txNames: clean(txNames),
    teacherNames: clean(teacherNames),
    studentNames: clean(studentNames),
  });
}
