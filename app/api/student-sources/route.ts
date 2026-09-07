import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope, withPupilBranch } from "@/lib/branchScope";

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
  // Sonlar o'quvchilar ro'yxati bilan BIR XIL qamrovda bo'lishi shart —
  // aks holda bu sahifa "Instagram: 4 200" deb turar, ro'yxatda esa
  // umuman boshqa son chiqardi (app/api/pupils/route.ts dagi GET izohi).
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  const col = db.collection("pupils");
  const scoped = withPupilBranch({}, scope);

  const [rows, total] = await Promise.all([
    col.aggregate([
      { $match: scoped },
      { $group: { _id: "$source", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ]).toArray(),
    col.countDocuments(scoped),
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
