import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminOnly";
import { branchPool } from "@/lib/branchPools";
import { getBranchScope } from "@/lib/branchScope";
import { applyPriceChange } from "@/lib/categoryPrices";
import { normalizeCourseCategory } from "@/lib/courseCategories";
import { basePriceFor, levelPriceFor, MIN_MONTHLY_PRICE, type PricedCourse } from "@/lib/coursePrice";
import { ensureIndexes } from "@/lib/mongodb";

// POST /api/course-categories/price { category, level, oldPrice, price }
// «Sozlamalar → Kategoriyalar → Narxni o'zgartirish» (24-qism, 13.11.2026).
//
// Kategoriyadagi `level` darajali (bo'sh — asosiy narx) kurslardan navbardagi filialda
// (hovuzi bilan) narxi HOZIR `oldPrice` bo'lganlari `price` ga o'tadi — sahifadagi bitta
// qator = shu kurslar. Hech biri mos kelmasa 409: boshqa oynada narx o'zgargan.
// Yozish qoidasi — lib/categoryPrices.ts → applyPriceChange (1+2 hovuz bitta narx).
//
// FAQAT ADMIN: narx Qarzdorlar hisoboti va o'quvchi kartasidagi qarzni o'zgartiradi.
// Narx TARIXI YO'Q — qarz o'tgan oylar uchun ham joriy narxdan sanaladi (SAVOLLAR 271).
// Amallar jurnaliga proxy tanani (oldPrice → price) o'zi yozadi.

const MAX_PRICE = 100_000_000;

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, error: "Narxni faqat administrator o'zgartiradi" }, { status: 403 });
  }
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Sessiya amal qilmaydi" }, { status: 401 });

  let body: { category?: unknown; level?: unknown; oldPrice?: unknown; price?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const category = normalizeCourseCategory(body.category);
  const level = String(body.level ?? "").trim();
  const oldPrice = body.oldPrice === null || body.oldPrice === undefined ? null : Number(body.oldPrice);
  const price = Math.round(Number(body.price));
  if (!Number.isFinite(price) || price < MIN_MONTHLY_PRICE || price > MAX_PRICE) {
    return NextResponse.json({ ok: false, error: "Oylik narx 50 000 so'mdan kam bo'lmasin" }, { status: 400 });
  }
  if (oldPrice !== null && !Number.isFinite(oldPrice)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  if (oldPrice === price) return NextResponse.json({ ok: false, error: "Yangi narx hozirgisidan farq qilsin" }, { status: 400 });

  const db = await ensureIndexes();
  const col = db.collection("offline_courses");
  const courses = (await col.find({}, { projection: { _id: 0, id: 1, name: 1, category: 1, branches: 1, levels: 1 } }).toArray()).filter(
    (c) => normalizeCourseCategory(c.category).toLowerCase() === category.toLowerCase(),
  );
  const pool = branchPool(scope.branchId);
  const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

  // Sahifadagi qator: shu darajali kurs, hovuzdagi biror filialda narxi hozir `oldPrice`.
  const matched = courses.filter((c) => {
    const pc = c as unknown as PricedCourse;
    if (level && !(pc.levels ?? []).some((l) => norm(l.name) === norm(level))) return false;
    // Darajasiz qator darajali kursda ham bo'ladi (guruh darajasi kursda topilmasa — asosiy narx).
    return pool.some((b) => (level ? levelPriceFor(pc, level, b) : basePriceFor(pc, b)) === oldPrice);
  });
  if (matched.length === 0) {
    return NextResponse.json({ ok: false, error: "Narx boshqa joyda o'zgargan — sahifani yangilang" }, { status: 409 });
  }

  const changed: { id: number; name: string }[] = [];
  for (const c of matched) {
    const patch = applyPriceChange(c as Parameters<typeof applyPriceChange>[0], level, scope.branchId, price);
    if (!patch) continue;
    await col.updateOne({ id: c.id }, { $set: patch });
    changed.push({ id: Number(c.id), name: String(c.name ?? "") });
  }
  return NextResponse.json({ ok: true, branchId: scope.branchId, price, changed });
}
