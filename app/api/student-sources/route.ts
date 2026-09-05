import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";

// GET /api/student-sources — Sotuv va marketing > O'quvchilar oqimi.
//
// O'quvchi QAYERDAN kelgani `pupils.source` da (O'quvchi qo'shish
// oynasidagi majburiy "Manba" maydoni).
//
// YIG'INDI SERVERDA: 6 798 hujjatni brauzerga tashib, u yerda sanashning
// ma'nosi yo'q — javob bir necha qator bo'ladi.
//
// FAQAT GET: bu sahifa hech narsa yozmaydi.
export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("pupils");

  const [rows, total] = await Promise.all([
    col.aggregate([
      { $group: { _id: "$source", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ]).toArray(),
    col.countDocuments(),
  ]);

  // Bo'sh/yo'q manbani ALOHIDA ajratamiz. Uni oddiy manba deb qo'shib
  // yuborish raqamlarni yolg'on qilardi: "Manba" maydoni 2026-09-04 da
  // majburiy qilingan, undan OLDIN qo'shilgan o'quvchilarda u hech
  // qachon to'lmaydi va ular ulushni butunlay egallab olardi.
  let unknown = 0;
  const sources: { name: string; n: number }[] = [];
  for (const r of rows) {
    const name = typeof r._id === "string" ? r._id.trim() : "";
    if (!name) { unknown += r.n; continue; }
    sources.push({ name, n: r.n });
  }
  sources.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));

  const known = sources.reduce((s, r) => s + r.n, 0);
  return NextResponse.json({
    ok: true,
    sources,
    // Ulush FAQAT manbasi ma'lum bo'lganlardan hisoblanadi — shuning
    // uchun `known` alohida qaytadi.
    known,
    unknown,
    total,
  });
}
