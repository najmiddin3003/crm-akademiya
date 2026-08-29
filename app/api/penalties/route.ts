import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { studentPaidBalanceByName } from "@/lib/pupilsDb";
import type { Penalty } from "@/lib/penalties";
import { toUz } from "@/lib/uzTime";

// Moliya → Jarima backend'i (MongoDB `penalties`). Demo seed YO'Q — kolleksiya
// bo'sh bo'lsa ro'yxat ham bo'sh qaytadi.
//
// DIQQAT: Bonus'dagi "Kim tomonidan" (`givenBy`) nuqsoni bu yerda YO'Q —
// Penalty modelida bunday maydon umuman yo'q va PenaltiesPage bunday ustunni
// ko'rsatmaydi. Shuning uchun bu yerga qattiq yozilgan ism qo'shilmadi ham:
// mavjud bo'lmagan ma'lumot o'ylab topilmaydi.

// Saqlanadigan yozuvning ANIQ shakli — app/api/bonuses/route.ts dagi bilan
// bir xil sabab: lib/penalties.ts `before`/`after` ni `number` deb e'lon
// qiladi, lekin xodim uchun balans manbasi yo'q, ya'ni qiymat "noma'lum"
// bo'lishi mumkin. lib/penalties.ts bu guruh egaligida emas.
type PenaltyRecord = Omit<Penalty, "before" | "after"> & {
  before: number | null;
  after: number | null;
};

function fmtNow(raw: Date): string {
  const d = toUz(raw);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("penalties");
  const rows = await col.find({}).sort({ id: -1 }).toArray();
  const penalties = rows.map(({ _id, ...rest }) => rest as unknown as PenaltyRecord);
  return NextResponse.json({ ok: true, penalties });
}

// POST — "Jarima qo'shish": Bonus bilan bir xil zanjir mantig'i, lekin
// ayirib boradi. "Oldingi miqdor" shu odamga oldin berilgan SO'NGGI jarima
// yozuvidagi "keyingi miqdor"dan davom etadi (bekor qilingan bo'lsa ham —
// bekor qilish faqat holat belgisi, zanjirni qayta hisoblamaydi); birinchi
// jarima bo'lsa:
//   • o'quvchi → HAQIQIY balansdan (bekor qilinmagan `payIn`
//     `transaction_entries` yig'indisi, lib/pupilsDb.ts). ILGARI bu yerda
//     `pupils.balance` o'qilardi — uni hech bir API yangilamaydi, ya'ni
//     jadvaldagi "Oldingi/Keyingi miqdor" o'ylab topilgan son edi.
//   • xodim    → null: xodimning balansi tizimda yuritilmaydi, 0 yozish
//     soxta faktik da'vo bo'lardi. Jadvalda "—".
export async function POST(req: Request) {
  let body: { type?: string; recipientName?: string; amount?: number; note?: string; image?: string; cashboxId?: number | null };
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
  const col = db.collection("penalties");

  const prior = await col.find({ type, recipientName }).sort({ id: -1 }).limit(1).toArray();
  let before: number | null;
  if (prior[0]) {
    // Oldingi yozuvdagi "keyingi miqdor" noma'lum bo'lsa (xodim) — zanjir
    // ham noma'lum bo'lib qolaveradi, null 0 ga aylanmaydi.
    before = typeof prior[0].after === "number" ? prior[0].after : null;
  } else if (type === "student") {
    before = await studentPaidBalanceByName(db, recipientName);
  } else {
    before = null;
  }

  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const cashboxId = Number.isFinite(Number(body.cashboxId)) && body.cashboxId != null ? Number(body.cashboxId) : null;

  const penalty: PenaltyRecord = {
    id: nextId,
    type,
    cashboxId,
    recipientName,
    before,
    amount,
    after: before === null ? null : before - amount,
    note: (body.note || "").trim(),
    reason: "",
    status: "",
    image: (body.image || "").trim(),
    createdAt: fmtNow(new Date()),
  };
  await col.insertOne({ ...penalty });
  return NextResponse.json({ ok: true, penalty });
}
