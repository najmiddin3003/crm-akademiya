import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";

// GET /api/transactions/summary
//   ?groupBy=month,category,sign   — vergul bilan: day | month | category | method | sign
//   ?from=YYYY-MM-DD &to=YYYY-MM-DD — ikkalasi ham IXTIYORIY va MUSTAQIL
//   ?cashboxId=  ?method=          — qo'shimcha filtrlar
//   ?before=YYYY-MM-DD             — shu sanagacha bo'lgan SOF qoldiq (bitta son)
//
// Moliya analitika sahifalari `/api/transactions` ni TO'LIQ yuklab
// (21 921 qator, 3 099 KB), yig'indini brauzerda hisoblardi. Bu endpoint
// o'sha yig'indini Mongo'da bajaradi.
//
// TO'RTTA QOIDA — ularning har biri o'lchov bilan tekshirilgan va
// buzilsa KO'RINADIGAN moliyaviy son o'zgaradi:
//
// 1) $toDecimal, oddiy $sum EMAS. Bazada kasrli summalar bor
//    (masalan -407278200.1 va -80165000.9). Oddiy $sum float'da yig'adi
//    va 2027-yil qoldig'i uchun 216496999.99999997 beradi, klient esa
//    216497000. Ekranda ko'rinmaydi (yaxlitlanadi), lekin xlsx eksportiga
//    XOM holda tushadi va 12 oylik qoldiq zanjiriga tarqaladi.
//
// 2) KATEGORIYA XOM holda guruhlanadi va bu yerda YIG'ILMAYDI.
//    "Boshqa" ga yig'ish qoidasi /api/transaction-types ro'yxatiga
//    bog'liq, u esa admin tahrirlaydigan BOSHQA kolleksiya. Serverda
//    yig'ilsa, hech qaysi turga tegishli bo'lmagan 256 ta hujjat
//    ("Oylik imtihon" 238 + "Olimpiada" 18, hammasi musbat) jimgina
//    Kirim raqamiga qo'shilib ketardi.
//
// 3) ISHORA (sign) GURUH KALITINING BIR QISMI. Bir xil kategoriya
//    ishoraga qarab boshqa-boshqa chelakka tushadi: "Kitob" 1 554 musbat
//    va 31 manfiy, "Boshqa" 10 musbat va 181 manfiy. Ishorasiz
//    guruhlansa, sahifalar ataylab ajratgan pul aralashib ketardi.
//
// 4) ISHORA UCH QIYMATLI: pos | neg | zero. Sahifalar nolni har xil
//    talqin qiladi — biri uni IKKALA tabdan ham chiqarib tashlaydi,
//    ikkinchisi chiqimga qo'shadi. Bugun bazada nol summali yozuv yo'q,
//    shuning uchun ikki qiymatli kalit tekshiruvdan o'tib ketardi va
//    birinchi nol paydo bo'lganda son o'zgarardi.
//
// Bo'sh oy/kategoriya uchun $group CHELAK YARATMAYDI — 12 oylik nol
// to'ldirish va kategoriya oldindan to'ldirilishi KLIENTDA qoladi.

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const GROUP_KEYS = ["day", "month", "category", "method", "sign"];

/** Decimal128 -> son. Yig'indi aniq hisoblangan, bu faqat uzatish uchun. */
function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return Number(v.toString());
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;

  const groupBy = (sp.get("groupBy") || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (groupBy.some((g) => !GROUP_KEYS.includes(g))) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri groupBy" }, { status: 400 });
  }
  const g = new Set(groupBy);

  const from = sp.get("from") || "";
  const to = sp.get("to") || "";
  const before = sp.get("before") || "";
  for (const [name, v] of [["from", from], ["to", to], ["before", before]]) {
    if (v && !ISO_DAY.test(v)) {
      return NextResponse.json({ ok: false, error: `Noto'g'ri ${name} (YYYY-MM-DD)` }, { status: 400 });
    }
  }

  const match: Record<string, unknown> = {};
  if (from || to) {
    const range: Record<string, string> = {};
    if (from) range.$gte = from;
    if (to) range.$lte = to;
    match.date = range;
  }
  const cashboxId = sp.get("cashboxId");
  if (cashboxId) {
    const n = Number(cashboxId);
    if (!Number.isFinite(n)) {
      return NextResponse.json({ ok: false, error: "Noto'g'ri cashboxId" }, { status: 400 });
    }
    match.cashboxId = n;
  }
  const method = sp.get("method");
  if (method) match.method = method;

  // Uch qiymatli ishora — 4-qoidaga qarang.
  const SIGN = {
    $cond: [
      { $gt: ["$amount", 0] }, "pos",
      { $cond: [{ $lt: ["$amount", 0] }, "neg", "zero"] },
    ],
  };

  const id: Record<string, unknown> = {};
  if (g.has("day")) id.day = "$date";
  if (g.has("month")) id.month = { $substrBytes: ["$date", 0, 7] };
  if (g.has("category")) id.category = "$category";   // XOM — 2-qoida
  if (g.has("method")) id.method = "$method";         // XOM
  if (g.has("sign")) id.sign = SIGN;

  const db = await ensureIndexes();
  const col = db.collection("transactions");

  const rowsP = col.aggregate([
    { $match: match },
    { $group: { _id: Object.keys(id).length ? id : null, amount: { $sum: { $toDecimal: "$amount" } } } },
    { $sort: { "_id.month": 1, "_id.day": 1, "_id.category": 1, "_id.method": 1, "_id.sign": 1 } },
  ]).toArray();

  const beforeP = before
    ? col.aggregate([
        { $match: { date: { $lt: before } } },
        { $group: { _id: null, amount: { $sum: { $toDecimal: "$amount" } } } },
      ]).toArray()
    : Promise.resolve([]);

  const [rawRows, beforeRows] = await Promise.all([rowsP, beforeP]);

  const rows = rawRows.map((r) => ({
    ...(r._id && typeof r._id === "object" ? r._id : {}),
    amount: toNum(r.amount),
  }));

  return NextResponse.json({
    ok: true,
    rows,
    ...(before ? { before: toNum(beforeRows[0]?.amount) } : {}),
  });
}
