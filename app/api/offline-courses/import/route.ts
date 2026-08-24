import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { CourseBranch, OfflineCourse } from "@/components/offline-courses/OfflineCoursesProvider";

// POST /api/offline-courses/import — bir nechta oflayn kursni bir so'rovda
// qo'shadi. Oflayn kurslar ro'yxatidagi "Import" bandi shu yerga yozadi;
// ilgari o'sha band onClick'siz tugma edi (bosilsa hech narsa bo'lmasdi).
//
// Qolip: app/api/groups/import/route.ts (uni namuna sifatida o'qing).
// Kutilayotgan ustunlar — AYNAN shu sahifaning CSV eksporti chiqaradigan
// ustunlar: ID, Sarlavha, Rang va har bir filial uchun narx ustuni.
// "ID" e'tiborga olinmaydi (yangi id server tomonidan beriladi).
//
// Filial narxlari filial NOMI bo'yicha bog'lanadi va nom `branches`
// kolleksiyasida bor bo'lishi shart — aks holda kursga mavjud bo'lmagan
// filial id'si yozilib qolardi.

export interface ImportCourseBranchRow {
  name?: string;
  price?: number | string;
}

export interface ImportCourseRow {
  name?: string;
  color?: string;
  branches?: ImportCourseBranchRow[];
}

const str = (v: unknown) => String(v ?? "").trim();

/** "1 500 000" / "1500000" → 1500000. Raqam bo'lmasa null. */
function parsePrice(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const digits = str(v).replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  let body: { courses?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const incoming = body.courses;
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return NextResponse.json({ ok: false, error: "Import uchun qator topilmadi" }, { status: 400 });
  }
  if (incoming.length > 1000) {
    return NextResponse.json({ ok: false, error: "Bir martada 1000 tadan ko'p qator import qilib bo'lmaydi" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("offline_courses");

  const branchRows = await db.collection("branches").find({}, { projection: { id: 1, name: 1 } }).toArray();
  const branchByName = new Map(branchRows.map((b) => [str(b.name).toLowerCase(), { id: Number(b.id), name: str(b.name) }]));

  const existing = await col.find({}, { projection: { id: 1, name: 1 } }).toArray();
  const takenNames = new Set(existing.map((c) => str(c.name).toLowerCase()));
  let nextId = existing.reduce((max, c) => Math.max(max, Number(c.id) || 0), 0) + 1;

  const created: OfflineCourse[] = [];
  const skipped: { row: number; reason: string }[] = [];

  for (let i = 0; i < incoming.length; i++) {
    const r = (incoming[i] ?? {}) as ImportCourseRow;
    const name = str(r.name);
    if (!name) {
      skipped.push({ row: i + 1, reason: "Kurs nomi bo'sh" });
      continue;
    }
    if (takenNames.has(name.toLowerCase())) {
      skipped.push({ row: i + 1, reason: `"${name}" nomli kurs allaqachon bor` });
      continue;
    }
    takenNames.add(name.toLowerCase());

    const branches: CourseBranch[] = [];
    for (const b of r.branches ?? []) {
      const known = branchByName.get(str(b.name).toLowerCase());
      // Nomi bazadagi filialga mos kelmasa ustun jimgina tashlab ketiladi:
      // o'ylab topilgan filial yaratmaymiz.
      if (!known) continue;
      const price = parsePrice(b.price);
      branches.push({ id: known.id, name: known.name, enabled: price !== null, price: price ?? 0 });
    }

    // Rang "#rrggbb" ko'rinishida bo'lmasa qora — CSV'da bo'sh qolishi mumkin.
    const color = /^#[0-9a-fA-F]{6}$/.test(str(r.color)) ? str(r.color) : "#000000";

    created.push({ id: nextId++, name, color, branches, levels: [] });
  }

  if (created.length > 0) {
    await col.insertMany(created.map((c) => ({ ...c })));
  }

  return NextResponse.json({ ok: true, created: created.length, skipped });
}
