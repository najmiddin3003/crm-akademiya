import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { BONUS_SEED } from "@/constants/bonuses";
import { STUDENTS_LIST } from "@/constants/studentsList";
import type { Bonus } from "@/lib/bonuses";

// Moliya → Bonus backend'i (MongoDB `bonuses`). Bo'sh bo'lsa demo bonusni
// seed qiladi.
async function seedIfEmpty(col: Collection) {
  if ((await col.countDocuments()) === 0) {
    await col.insertMany(JSON.parse(JSON.stringify(BONUS_SEED)));
  }
}

function fmtNow(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("bonuses");
  await seedIfEmpty(col);
  const rows = await col.find({}).sort({ id: -1 }).toArray();
  const bonuses = rows.map(({ _id, ...rest }) => rest as unknown as Bonus);
  return NextResponse.json({ ok: true, bonuses });
}

// POST — "Bonus yaratish": "oldingi miqdor" shu odamga oldin berilgan
// SO'NGGI bonus yozuvidagi "keyingi miqdor"dan davom etadi; birinchi bonus
// bo'lsa — o'quvchi uchun STUDENTS_LIST'dagi haqiqiy balansidan, xodim
// uchun 0'dan boshlanadi (xodimda mos balans maydoni yo'q).
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

  const prior = await col.find({ type, recipientName }).sort({ id: -1 }).limit(1).toArray();
  let before: number;
  if (prior[0]) {
    before = Number(prior[0].after) || 0;
  } else if (type === "student") {
    const student = STUDENTS_LIST.find((s) => s.name === recipientName);
    before = student ? student.balance : 0;
  } else {
    before = 0;
  }

  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const cashboxId = Number.isFinite(Number(body.cashboxId)) && body.cashboxId != null ? Number(body.cashboxId) : null;

  const bonus: Bonus = {
    id: nextId,
    type,
    cashboxId,
    recipientName,
    givenBy: "Abdulloh Raxmatullayev",
    before,
    amount,
    after: before + amount,
    note: (body.note || "").trim(),
    reason: "",
    status: "",
    createdAt: fmtNow(new Date()),
  };
  await col.insertOne({ ...bonus });
  return NextResponse.json({ ok: true, bonus });
}
