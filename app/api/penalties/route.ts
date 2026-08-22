import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { pupilBalanceByName } from "@/lib/pupilsDb";
import type { Penalty } from "@/lib/penalties";

// Moliya → Jarima backend'i (MongoDB `penalties`). Demo seed YO'Q — kolleksiya
// bo'sh bo'lsa ro'yxat ham bo'sh qaytadi.
function fmtNow(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("penalties");
  const rows = await col.find({}).sort({ id: -1 }).toArray();
  const penalties = rows.map(({ _id, ...rest }) => rest as unknown as Penalty);
  return NextResponse.json({ ok: true, penalties });
}

// POST — "Jarima qo'shish": Bonus bilan bir xil zanjir mantig'i, lekin
// ayirib boradi. "Oldingi miqdor" shu odamga oldin berilgan SO'NGGI jarima
// yozuvidagi "keyingi miqdor"dan davom etadi (bekor qilingan bo'lsa ham —
// bekor qilish faqat holat belgisi, zanjirni qayta hisoblamaydi); birinchi
// jarima bo'lsa — o'quvchi uchun bazadagi (MongoDB pupils) kartasidagi balansdan, xodim uchun 0'dan.
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
  let before: number;
  if (prior[0]) {
    before = Number(prior[0].after) || 0;
  } else if (type === "student") {
    before = await pupilBalanceByName(db, recipientName);
  } else {
    before = 0;
  }

  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const cashboxId = Number.isFinite(Number(body.cashboxId)) && body.cashboxId != null ? Number(body.cashboxId) : null;

  const penalty: Penalty = {
    id: nextId,
    type,
    cashboxId,
    recipientName,
    before,
    amount,
    after: before - amount,
    note: (body.note || "").trim(),
    reason: "",
    status: "",
    image: (body.image || "").trim(),
    createdAt: fmtNow(new Date()),
  };
  await col.insertOne({ ...penalty });
  return NextResponse.json({ ok: true, penalty });
}
