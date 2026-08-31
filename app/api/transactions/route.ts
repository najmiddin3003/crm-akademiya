import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { Transaction } from "@/lib/transactions";

// Moliya → Moliya analitikasi backend'i (MongoDB `transactions`, faqat
// o'qish uchun — bu sahifada qo'shish/tahrirlash/o'chirish yo'q). Demo seed
// YO'Q — kolleksiya bo'sh bo'lsa analitika ham bo'sh qoladi.
// Ixtiyoriy parametrlar — PARAMETRSIZ chaqiruv AVVALGIDEK ishlaydi
// (butun ro'yxat, sana bo'yicha o'sish tartibida), shu bois
// lib/transactionsClient.ts orqali keladigan sahifalar tegilmagan:
//   ?from=YYYY-MM-DD &to=YYYY-MM-DD — sana oralig'i (ikkalasi mustaqil)
//   ?page= &limit=                 — sahifalash; javobga `total` qo'shiladi
//   ?sort=desc                     — eng yangisi birinchi
//
// Sahifalash Moliya analitikasi → "Journal" tab'i uchun: u 21 921 qatorni
// yuklab, brauzerda 50 tasini ko'rsatardi.
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;

  const from = sp.get("from") || "";
  const to = sp.get("to") || "";
  for (const [name, v] of [["from", from], ["to", to]]) {
    if (v && !ISO_DAY.test(v)) {
      return NextResponse.json({ ok: false, error: `Noto'g'ri ${name} (YYYY-MM-DD)` }, { status: 400 });
    }
  }
  const filter: Record<string, unknown> = {};
  if (from || to) {
    const range: Record<string, string> = {};
    if (from) range.$gte = from;
    if (to) range.$lte = to;
    filter.date = range;
  }

  const db = await ensureIndexes();
  const col = db.collection("transactions");

  // Standart tartib O'ZGARMAYDI (date:1, id:1) — undan boshqa sahifalar
  // qoldiq zanjirini hisoblashda foydalanadi.
  const desc = sp.get("sort") === "desc";
  let cursor = col.find(filter).sort(desc ? { date: -1, id: -1 } : { date: 1, id: 1 });

  const limitRaw = Number(sp.get("limit"));
  const paged = Number.isFinite(limitRaw) && limitRaw > 0;
  if (paged) {
    const limit = Math.min(limitRaw, 500);
    const page = Math.max(1, Number(sp.get("page")) || 1);
    cursor = cursor.skip((page - 1) * limit).limit(limit);
  }

  const rows = await cursor.toArray();
  const transactions = rows.map(({ _id, ...rest }) => rest as unknown as Transaction);
  // Sahifalash so'ralmaganda kursor barcha mos qatorlarni qaytaradi, ya'ni
  // `total` aynan `rows.length` — countDocuments() ni bekorga yurgizmaymiz.
  const total = paged ? await col.countDocuments(filter) : rows.length;
  return NextResponse.json({ ok: true, transactions, total });
}
