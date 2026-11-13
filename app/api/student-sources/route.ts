import type { Db } from "mongodb";
import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope, withPupilBranch, type BranchScope } from "@/lib/branchScope";
import { currentAuthorName } from "@/lib/currentEmployee";
import { withLeadScope } from "@/lib/leadScope";
import { countLeadSources, createdPrefixPattern, isSourcePeriod, periodBounds, type LeadSourceRow } from "@/lib/sourceStats";
import { listSourceOptions } from "@/lib/studentSources";
import { uzNow } from "@/lib/uzTime";

// GET /api/student-sources — Sotuv va marketing > O'quvchilar oqimi.
//
// O'quvchi QAYERDAN kelgani `pupils.source` da (O'quvchi qo'shish
// oynasidagi majburiy "Manba" maydoni).
//
// YIG'INDI SERVERDA: 6 798 hujjatni brauzerga tashib, u yerda sanashning
// ma'nosi yo'q — javob bir necha qator bo'ladi.
//
// FAQAT GET: bu sahifa hech narsa yozmaydi.
//
// `?view=leads&period=month|prev|all` — yangi versiya «Sozlamalar → Lidlar → Manbalar»
// (24-qism, 13.11.2026): har manba bo'yicha «lid → o'quvchi» (lib/sourceStats.ts),
// barcha tanlovlar (nofaollari ham) va o'quvchi kartalaridagi taqsimot. Shu route —
// yangi ruxsat yo'li ochilmasin (lib/apiPermissions.generated.ts → /sales-sources).
export async function GET(req: Request) {
  // Sonlar o'quvchilar ro'yxati bilan BIR XIL qamrovda bo'lishi shart —
  // aks holda bu sahifa "Instagram: 4 200" deb turar, ro'yxatda esa
  // umuman boshqa son chiqardi (app/api/pupils/route.ts dagi GET izohi).
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  if (params.get("view") === "leads") {
    const p = params.get("period");
    return NextResponse.json(await leadsView(await ensureIndexes(), scope, isSourcePeriod(p) ? p : "month"));
  }

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

/**
 * Manbalar sahifasi (yangi versiya). Lidlar — LIDLAR QAMROVIDA (Lidlar ro'yxati bilan
 * bir xil, lib/leadScope.ts), davr `orders.created` sanasi bo'yicha (lid KELGAN oy —
 * o'sha oyning lidlaridan nechtasi hozirgacha guruhga qo'shilgan). O'quvchi kartalari —
 * eski sahifadagi qamrovda (`withPupilBranch`, butun davr).
 */
async function leadsView(db: Db, scope: BranchScope, period: "month" | "prev" | "all") {
  const now = uzNow();
  const pattern = createdPrefixPattern(period, now);
  const leadFilter = withLeadScope(pattern ? { created: { $regex: pattern } } : {}, scope, await currentAuthorName());
  const [options, leadRows, pupilRows] = await Promise.all([
    listSourceOptions(db, { all: true }),
    db
      .collection("orders")
      .find(leadFilter, {
        projection: { _id: 0, source: 1, heardFrom: 1, holat: 1, groupId: 1, status: 1, leadStatus: 1, firstLesson: 1, firstLessonStatus: 1, stage: 1 },
      })
      .toArray(),
    db
      .collection("pupils")
      .aggregate([{ $match: withPupilBranch({}, scope) }, { $group: { _id: "$source", n: { $sum: 1 } } }])
      .toArray(),
  ]);
  const names = options.map((o) => o.name);
  // O'chirish faqat HECH QAYERDA ishlatilmagan tanlovga (yangi versiya menyusi) —
  // filialdan qat'i nazar: tanlov ro'yxati butun markazniki.
  const [inPupils, inSource, inHeard] = await Promise.all([
    db.collection("pupils").distinct("source", { source: { $in: names } }),
    db.collection("orders").distinct("source", { source: { $in: names } }),
    db.collection("orders").distinct("heardFrom", { heardFrom: { $in: names } }),
  ]);
  const { rows, total } = countLeadSources(leadRows as LeadSourceRow[]);
  return {
    ok: true,
    period,
    bounds: periodBounds(period, now),
    options,
    leads: rows,
    total,
    pupils: pupilRows
      .map((r) => ({ name: typeof r._id === "string" ? r._id.trim() : "", n: Number(r.n) || 0 }))
      .filter((r) => r.name),
    usedNames: [...new Set([...inPupils, ...inSource, ...inHeard].map(String))],
  };
}
