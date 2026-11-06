import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/adminOnly";
import { parseWorkTime } from "@/lib/workTime";

// PUT /api/temp-staff/work-time  { items: [{ id, workStart, workEnd }] }
// «Vaqtinchalik tugma» → «Ish vaqtini belgilash» oynasi: ko'p xodimning ish vaqti
// bitta so'rovda (lib/workTime.ts). Bo'sh qiymat — olib tashlash.
//
// Filial qamrovisiz, faqat admin (sabab: ../route.ts izohi). HAMMASI YOKI HECH
// NIMA: bitta qator noto'g'ri bo'lsa hech narsa yozilmaydi — 60 xodimdan qaysi
// birlari saqlangani ekrandan bilinmay qolmasin.

/** Bir so'rovdagi eng ko'p qator: butun xodimlar ro'yxatidan ancha ko'p. */
const MAX_ITEMS = 1000;

export async function PUT(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, error: "Bu sahifa faqat admin uchun" }, { status: 403 });
  }

  let body: { items?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const raw = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [];
  if (raw.length === 0 || raw.length > MAX_ITEMS) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const times = new Map<number, { workStart: string | null; workEnd: string | null }>();
  for (const item of raw) {
    const id = Number(item?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
    }
    const parsed = parseWorkTime(item.workStart, item.workEnd);
    if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error, id }, { status: 400 });
    times.set(id, { workStart: parsed.workStart, workEnd: parsed.workEnd });
  }

  const db = await ensureIndexes();
  const col = db.collection("hr_employees");
  const ids = [...times.keys()];
  const found = await col.countDocuments({ id: { $in: ids } });
  if (found !== ids.length) {
    return NextResponse.json({ ok: false, error: "Xodim topilmadi" }, { status: 404 });
  }

  const res = await col.bulkWrite(
    [...times].map(([id, set]) => ({ updateOne: { filter: { id }, update: { $set: set } } })),
    { ordered: false },
  );
  return NextResponse.json({ ok: true, updated: res.matchedCount });
}
