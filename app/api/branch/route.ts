import { NextResponse } from "next/server";
import { BRANCH_COOKIE, getBranchScope } from "@/lib/branchScope";
import { ensureIndexes } from "@/lib/mongodb";

// GET  /api/branch — joriy qamrov: tanlangan filial va ruxsat etilganlari.
// POST /api/branch — navbardan filial tanlanganda chaqiriladi.
//
// Tanlov COOKIE da saqlanadi (lib/branchScope.ts izohiga qarang): kesish
// serverda bo'lgani uchun qiymat serverga yetib borishi shart.
//
// Cookie `httpOnly` EMAS — uni klient ham o'qiydi. Bu XAVFSIZ, chunki
// cookie'ning o'zi hech qanday ruxsat bermaydi: `getBranchScope()` har
// safar qiymatni foydalanuvchining RUXSAT ETILGAN filiallariga
// solishtiradi va mos kelmasa o'ziga tegishlisiga tushiradi.

const YEAR_SEC = 365 * 24 * 60 * 60;

export async function GET() {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  const rows = await db
    .collection("branches")
    .find({}, { projection: { id: 1, name: 1, _id: 0 } })
    .sort({ id: 1 })
    .toArray();
  const branches = rows
    .map((r) => ({ id: Number(r.id), name: String(r.name ?? "") }))
    .filter((b) => scope.allowed.includes(b.id));

  return NextResponse.json({
    ok: true,
    branchId: scope.branchId,
    isAdmin: scope.isAdmin,
    branches,
  });
}

export async function POST(req: Request) {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  let body: { branchId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const n = Number(body.branchId);
  if (!Number.isFinite(n)) {
    return NextResponse.json({ ok: false, error: "Filial noto'g'ri" }, { status: 400 });
  }
  if (!scope.allowed.includes(n)) {
    return NextResponse.json({ ok: false, error: "Bu filial sizga biriktirilmagan" }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true, branchId: n });
  res.cookies.set(BRANCH_COOKIE, String(n), { sameSite: "lax", maxAge: YEAR_SEC, path: "/" });
  return res;
}
