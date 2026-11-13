import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureIndexes } from "@/lib/mongodb";
import { loadPaymentMethods, PAYMENT_METHODS_COLLECTION } from "@/lib/paymentMethods";
import { buildMethodUsage, isoDaysBefore, isValidOrder, USAGE_DAYS, type UsageRow } from "@/lib/paymentMethodUsage";
import { isPathAllowed } from "@/lib/permissions";
import { uzDateIso } from "@/lib/uzTime";

// SOZLAMALAR → TO'LOV TURLARI va SOZLAMALAR → KASSALAR (yangi versiya, 24-qism).
//
// GET /api/payment-methods — turlar (ko'rsatish tartibida) + har tur oxirgi USAGE_DAYS kunda
//   qaysi kassalarga tushum sifatida yozilgani: `usage: { [key]: [{ cashboxId, count }] }`.
//   PUL YO'Q — faqat kassa raqami va yozuvlar soni. `cashboxes` — nomlar xaritasi
//   ({ id, name, archived, isPrimary }, GET /api/cashboxes?names=1 dagi bilan bir xil, u ham
//   ochiq): /settings-finance ruxsatli xodimga /api/cashboxes route'i yopiq bo'lishi mumkin.
// PUT /api/payment-methods { ids: number[] } — ko'rsatish tartibi (qatorni surish). `order`
//   maydoni faqat ro'yxat tartibi: hisob-kitob, kassa qoldig'i va kalitlarga tegmaydi.
//   «naqd» doim birinchi (lib/paymentMethodUsage.ts).
//
// RUXSAT shu yerda (route lib/apiPermissions.generated.ts da bo'lmasa — faqat sessiya):
// administrator yoki «Sozlamalar → Moliya» (/settings-finance) bo'limi ochiq xodim — to'lov
// turlarini tahrirlaydigan /api/settings-lists bilan bir xil doira.

async function allowed(): Promise<NextResponse | null> {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  if (me.role !== "admin" && !isPathAllowed("/settings-finance", me.permissions)) {
    return NextResponse.json({ ok: false, error: "Bu bo'limga ruxsatingiz yo'q" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await allowed();
  if (denied) return denied;

  const db = await ensureIndexes();
  const since = isoDaysBefore(uzDateIso(), USAGE_DAYS);
  const [methods, cashboxes, rows] = await Promise.all([
    loadPaymentMethods(db),
    db
      .collection("cashboxes")
      .find({}, { projection: { _id: 0, id: 1, name: 1, archived: 1, isPrimary: 1 } })
      .sort({ id: 1 })
      .toArray(),
    db
      .collection("transaction_entries")
      .aggregate<{ _id: { cashboxId: unknown; key: string | null }; count: number }>([
        // Tushum (payIn), bekor qilinmagan va tasdiq kutmayotgan — lib/cashboxStats.ts dagi
        // «oxirgi topshiruvdan beri» bilan bir xil shart. `date` — "YYYY-MM-DD" (satr taqqoslash).
        { $match: { txType: "payIn", status: { $nin: ["waiting", "cancelled"] }, date: { $gte: since } } },
        { $group: { _id: { cashboxId: "$cashboxId", key: "$paymentMethodKey" }, count: { $sum: 1 } } },
      ])
      .toArray(),
  ]);
  const usageRows: UsageRow[] = rows.map((r) => ({ cashboxId: Number(r._id.cashboxId), key: String(r._id.key ?? ""), count: r.count }));
  return NextResponse.json({ ok: true, methods, usage: buildMethodUsage(usageRows), cashboxes, since, days: USAGE_DAYS });
}

export async function PUT(req: Request) {
  const denied = await allowed();
  if (denied) return denied;

  let body: { ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const ids = Array.isArray(body.ids) ? body.ids.map(Number) : [];

  const db = await ensureIndexes();
  const existing = await loadPaymentMethods(db);
  if (!isValidOrder(existing, ids)) {
    return NextResponse.json({ ok: false, error: "To'lov turlari ro'yxati o'zgargan — sahifani yangilang" }, { status: 409 });
  }
  await db.collection(PAYMENT_METHODS_COLLECTION).bulkWrite(
    ids.map((id, i) => ({ updateOne: { filter: { id }, update: { $set: { order: i } } } })),
    { ordered: false },
  );
  return NextResponse.json({ ok: true, methods: await loadPaymentMethods(db) });
}
