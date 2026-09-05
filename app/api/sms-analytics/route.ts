import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { eskizConfigured } from "@/lib/eskiz";
import { paymentSmsEnabled, paymentSmsVarSet } from "@/lib/paymentSms";
import type { SmsMessage } from "@/lib/smsMessages";

// GET /api/sms-analytics — Nazorat > SMS analitikasi sahifasi uchun.
//
// FAQAT GET — ATAYLAB. Mavjud `/api/sms-messages` ni qayta ishlatib
// bo'lmaydi: uning POST i HAQIQIY SMS YUBORADI. Ruxsatlar jadvali
// (scripts/gen-api-permissions.mjs) route'ni SAHIFAGA bog'laydi, metod
// darajasida ajratmaydi — ya'ni o'sha route ulansa, "SMS analitikasi"
// ruxsati berilgan xodim SMS yubora oladigan bo'lib qolardi.
//
// Ma'lumot SERVERDA kesiladi va yig'iladi: jurnal har to'lovga bittadan
// o'sadi, brauzerga butun tarixni tashishning ma'nosi yo'q.

/** Bir so'rovda qaytadigan eng ko'p qator. */
const LIMIT = 500;

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";

  const filter: Record<string, unknown> = {};
  // `date` — "YYYY-MM-DD" satri, ya'ni leksikografik solishtirish to'g'ri
  // ishlaydi va `date_1` indeksidan foydalanadi (lib/mongodb.ts).
  if (/^\d{4}-\d{2}-\d{2}$/.test(from) || /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const range: Record<string, string> = {};
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) range.$gte = from;
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) range.$lte = to;
    filter.date = range;
  }

  const db = await ensureIndexes();
  const col = db.collection("sms_messages");

  const [rows, byStatus, byPurpose, byCashbox, total] = await Promise.all([
    col.find(filter, { projection: { _id: 0, providerRaw: 0 } })
      .sort({ id: -1 }).limit(LIMIT).toArray(),
    col.aggregate([{ $match: filter }, { $group: { _id: "$status", n: { $sum: 1 } } }]).toArray(),
    col.aggregate([{ $match: filter }, { $group: { _id: "$purpose", n: { $sum: 1 } } }]).toArray(),
    col.aggregate([{ $match: filter }, { $group: { _id: "$cashboxName", n: { $sum: 1 } } }]).toArray(),
    col.countDocuments(filter),
  ]);

  const count = (list: { _id?: unknown; n?: unknown }[], key: string) =>
    Number(list.find((r) => r._id === key)?.n ?? 0);

  return NextResponse.json({
    ok: true,
    // SOZLAMALAR HOLATI — faqat "bor/yo'q", qiymatlar EMAS.
    //
    // NEGA KERAK: sahifa bo'sh bo'lsa yoki hamma qator "Yuborilmadi"
    // bo'lsa, sabab ikkitadan biri — kalit o'chiq yoki Eskiz muhit
    // o'zgaruvchilari qo'yilmagan. Ilgari buni bilishning yagona yo'li
    // Vercel sozlamalarini ochib ko'rish edi; endi shu yerda ko'rinadi.
    //
    // Maxfiy qiymatlar (email/parol) QAYTARILMAYDI — faqat mavjudligi.
    config: {
      eskizConfigured: eskizConfigured(),
      paymentSmsEnabled: paymentSmsEnabled(),
      paymentSmsVarSet: paymentSmsVarSet(),
    },
    // `providerRaw` qaytarilmaydi — u faqat serverda kerak (xabar ID sini
    // ajratish uchun) va ichida nima borligi Eskizga bog'liq.
    messages: rows as unknown as SmsMessage[],
    total,
    truncated: total > rows.length,
    stats: {
      accepted: count(byStatus, "Qabul qilindi"),
      failed: count(byStatus, "Yuborilmadi"),
      pending: count(byStatus, "Kutilmoqda"),
      // Simulyatsiya — Eskiz sozlanmagan holatda "yuborilgan"dek
      // ko'rinadigan, aslida hech qayerga ketmagan yozuvlar.
      simulated: await col.countDocuments({ ...filter, simulated: true }),
    },
    byPurpose: byPurpose.map((r) => ({ key: (r._id as string) ?? null, n: Number(r.n) })),
    byCashbox: byCashbox.map((r) => ({ name: (r._id as string) ?? null, n: Number(r.n) })),
  });
}
