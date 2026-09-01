import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";

/** Foydalanuvchi kiritgan matnni $regex ichiga xavfsiz qo'yish uchun. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET /api/transaction-entries/facets?cashboxId=<n>
// GET /api/transaction-entries/facets?person=<ism>
//
// Filtr TANLOVLARI: tranzaksiya nomlari, o'qituvchi va o'quvchi ismlari.
// Ikki qamrov bor:
//   • `cashboxId` — Kassalar sahifasi (bitta kassaning yozuvlari);
//   • `person`    — Xodim profili (shu xodimga OID hamma yozuv).
//
// `person` sharti /api/transaction-entries dagi `?person=` bilan AYNAN bir
// xil ($or: studentName / teacherName / moderator) — aks holda bu yerdan
// tanlangan qiymat jadvalda 0 qator berardi.
//
// Ilgari bu ro'yxatlar klientda `entries` dan yig'ilardi — u paytda butun
// jadval brauzerda bo'lgani uchun bu ishlardi. Jadval sahifalab o'qiladigan
// bo'lgach (50 qator) ular qisqarib qolardi: kassa 4 da katalogda yo'q 5 ta
// tranzaksiya nomi va 51 ta o'qituvchi ismi ro'yxatdan tushib ketardi.
//
// Tanlovlar ATAYLAB faqat qamrov bo'yicha olinadi — sana yoki boshqa
// filtrlar qo'llanmaydi. Shunda filtr qo'yilganda tanlov ro'yxati
// qisqarmaydi va foydalanuvchi o'zi tanlagan qiymatni yo'qotmaydi.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const raw = sp.get("cashboxId");
  const person = (sp.get("person") || "").trim();

  let filter: Record<string, unknown>;
  if (person) {
    const n = { $regex: `^${escapeRegex(person)}$`, $options: "i" };
    filter = { $or: [{ studentName: n }, { teacherName: n }, { moderator: n }] };
  } else {
    const cashboxId = Number(raw);
    if (!raw || !Number.isFinite(cashboxId)) {
      return NextResponse.json({ ok: false, error: "cashboxId yoki person kerak" }, { status: 400 });
    }
    filter = { cashboxId };
  }

  const db = await ensureIndexes();
  const col = db.collection("transaction_entries");
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
