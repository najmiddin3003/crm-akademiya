import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { studentPaidBalanceByName } from "@/lib/pupilsDb";
import type { Bonus } from "@/lib/bonuses";

// Moliya → Bonus backend'i (MongoDB `bonuses`). Demo seed YO'Q — kolleksiya
// bo'sh bo'lsa ro'yxat ham bo'sh qaytadi.

// Saqlanadigan yozuvning ANIQ shakli. lib/bonuses.ts dagi `Bonus` hali
// `before`/`after` ni `number` deb e'lon qiladi, lekin xodim uchun balans
// manbasi umuman yo'q — u yerga son yozish o'ylab topilgan bo'lardi.
// Shuning uchun bu ikki maydon `null` bo'la oladi ("noma'lum" → jadvalda
// "—"). lib/bonuses.ts bu guruh egaligida emas, shu bois tur shu yerda
// kengaytiriladi.
type BonusRecord = Omit<Bonus, "before" | "after"> & {
  before: number | null;
  after: number | null;
};

function fmtNow(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("bonuses");
  const rows = await col.find({}).sort({ id: -1 }).toArray();
  const bonuses = rows.map(({ _id, ...rest }) => rest as unknown as BonusRecord);
  return NextResponse.json({ ok: true, bonuses });
}

// POST — "Bonus yaratish".
//
// "Oldingi miqdor" shu odamga oldin berilgan SO'NGGI bonus yozuvidagi
// "keyingi miqdor"dan davom etadi; birinchi bonus bo'lsa:
//   • o'quvchi  → HAQIQIY balansdan (bekor qilinmagan `payIn`
//     `transaction_entries` yig'indisi, lib/pupilsDb.ts);
//   • xodim     → null. Xodimning balansini tizimda hech nima yuritmaydi,
//     shuning uchun bu yerda 0 yozish "xodimning balansi nol" degan soxta
//     faktik da'vo bo'lardi. Zanjir ham null bo'lib davom etadi.
export async function POST(req: Request) {
  let body: { type?: string; recipientName?: string; amount?: number; note?: string; cashboxId?: number | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const type = body.type === "employee" || body.type === "student" ? body.type : "";
  const recipientName = (body.recipientName || "").trim();
  const amount = Number(body.amount);
  if (!type) {
    return NextResponse.json({ ok: false, error: "Tranzaksiya turini tanlang" }, { status: 400 });
  }
  if (!recipientName) {
    return NextResponse.json({ ok: false, error: type === "employee" ? "Xodimni tanlang" : "O'quvchini tanlang" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "Qiymatni to'g'ri kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("bonuses");

  // "Kim tomonidan" — HAQIQIY amal bajaruvchi: joriy sessiya cookie'sidan
  // o'qilgan foydalanuvchi (lib/auth.ts → getCurrentUser). Mijoz yuborgan
  // ismga ishonilmaydi. Sessiya bo'lmasa bo'sh qoladi va jadvalda "—".
  const me = await getCurrentUser();

  const prior = await col.find({ type, recipientName }).sort({ id: -1 }).limit(1).toArray();
  let before: number | null;
  if (prior[0]) {
    // Oldingi yozuvda "keyingi miqdor" noma'lum bo'lsa (xodim), zanjir ham
    // noma'lum bo'lib qoladi — null 0 ga aylanmasligi kerak.
    before = typeof prior[0].after === "number" ? prior[0].after : null;
  } else if (type === "student") {
    before = await studentPaidBalanceByName(db, recipientName);
  } else {
    before = null;
  }

  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const cashboxId = Number.isFinite(Number(body.cashboxId)) && body.cashboxId != null ? Number(body.cashboxId) : null;

  const bonus: BonusRecord = {
    id: nextId,
    type,
    cashboxId,
    recipientName,
    // ILGARI bu yerda qattiq yozilgan "Abdulloh Raxmatullayev" turardi va
    // HAR BIR bonus o'sha o'ylab topilgan odam nomiga yozilardi — jadvalda
    // ham, CSV/Excel eksportida ham.
    givenBy: me?.fullName || "",
    before,
    amount,
    after: before === null ? null : before + amount,
    note: (body.note || "").trim(),
    reason: "",
    status: "",
    createdAt: fmtNow(new Date()),
  };
  await col.insertOne({ ...bonus });
  return NextResponse.json({ ok: true, bonus });
}
