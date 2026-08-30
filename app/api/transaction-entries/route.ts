import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { TransactionEntry } from "@/lib/transactionEntries";

// Moliya → Tranzaksiyalar backend'i (MongoDB `transaction_entries`, faqat
// o'qish uchun — bu sahifada qo'shish/tahrirlash/o'chirish yo'q). Demo seed
// YO'Q — yozuvlar kassa amallaridan (Kirim/Chiqim) kelib chiqadi.
const TX_TYPES = ["payIn", "payOut", "transfer"];
const STATUSES = ["cancelled", "waiting"];

/** Foydalanuvchi kiritgan matnni $regex ichiga xavfsiz qo'yish uchun. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Ism bo'yicha solishtirish katta-kichik harf va ortiqcha bo'shliqqa
// bog'liq bo'lmasin — yozuvlar turli oqimlardan (demo seed, Kirim oynasi)
// keladi. components/finance/CashboxesPage.tsx dagi name→id xaritalari ham
// shu qoidada ishlaydi.
function nameFilter(value: string) {
  return { $regex: `^${escapeRegex(value.trim())}$`, $options: "i" };
}

// GET /api/transaction-entries
//   ?studentName=…   — bitta o'quvchining to'lovlari (O'quvchi profili)
//   ?moderator=…     — shu xodim qayd etgan to'lovlar (Xodim profili)
//   ?txType=payIn    — "payIn" | "payOut" | "transfer"
//   ?month=YYYY-MM   — shu oy ichidagilar
//   ?excludeCancelled=1 — bekor qilinganlarni tashlab ketadi
//
// Parametrsiz chaqirilsa javob avvalgidek — butun ro'yxat. Shu bois
// Tranzaksiyalar/Kassalar/Daromad rejasi sahifalari o'zgarishsiz ishlaydi.
export async function GET(req: Request) {
  const db = await ensureIndexes();
  const col = db.collection("transaction_entries");

  const sp = new URL(req.url).searchParams;
  const filter: Record<string, unknown> = {};

  const txType = sp.get("txType");
  if (txType) {
    if (!TX_TYPES.includes(txType)) {
      return NextResponse.json({ ok: false, error: "Noto'g'ri txType" }, { status: 400 });
    }
    filter.txType = txType;
  }

  const studentName = sp.get("studentName");
  if (studentName?.trim()) filter.studentName = nameFilter(studentName);

  const moderator = sp.get("moderator");
  if (moderator?.trim()) {
    filter.moderator = nameFilter(moderator);
    // Xodim profilidagi "O'quvchilar to'lovlari" — o'quvchisi ko'rsatilmagan
    // yozuv (masalan kassalar orasidagi ko'chirish) bu ro'yxatga tushmaydi.
    filter.studentName = { $nin: ["", null] };
  }

  const month = sp.get("month");
  if (month) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ ok: false, error: "Noto'g'ri month (YYYY-MM kutilgan)" }, { status: 400 });
    }
    filter.date = { $regex: `^${month}-` };
  }

  // Bekor qilingan yozuv summaga qo'shilmasligi kerak (app/api/
  // employee-salary-summary/route.ts bilan bir xil qoida). Jadvalda esa u
  // ko'rinib tursin — shuning uchun bu ixtiyoriy.
  if (sp.get("excludeCancelled") === "1") filter.status = { $ne: "cancelled" };

  // Bo'sh satr ham HAQIQIY qiymat ("" — oddiy yozuv), lekin interfeysda u
  // "filtr yo'q" degani. Klientdagi `if (status && ...)` bilan bir xil.
  //
  // Vergul bilan bir nechta holat berish mumkin: `?status=cancelled,waiting`.
  // Bu Xodim profilidagi "To'lanmagan tarixi" uchun kerak — u yerda klient
  // `e.status === "cancelled" || e.status === "waiting"` deb tekshiradi.
  const status = sp.get("status");
  if (status) {
    const parts = status.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0 || parts.some((p) => !STATUSES.includes(p))) {
      return NextResponse.json({ ok: false, error: "Noto'g'ri status" }, { status: 400 });
    }
    filter.status = parts.length > 1 ? { $in: parts } : parts[0];
  }

  // AYNAN TENGLIK bo'yicha o'quvchi filtri — yuqoridagi `studentName` dan
  // FARQ QILADI va uni qayta ishlatib bo'lmaydi.
  //
  // `?studentName=` nameFilter() dan o'tadi: chetlarini kesadi va
  // katta-kichik harfni farqlamaydi. Xodim profilidagi jadval filtri esa
  // klientda `e.studentName === fStudent` — XOM satrni aynan solishtiradi.
  // Farq nazariy emas: bazadagi 13 369 yozuvning 5 371 tasida `studentName`
  // chetida probel bor, va 2 818 ta xom ismning 1 162 tasida ikkala qoida
  // BOSHQA-BOSHQA qatorlar to'plamini qaytaradi (eng yomoni "Ismoilova
  // ezoza": aynan tenglikda 1 qator, regexda 7 qator).
  //
  // Shu bois bu yerda qiymat O'ZGARTIRILMASDAN qo'llanadi.
  const studentNameExact = sp.get("studentNameExact");
  if (studentNameExact !== null) filter.studentName = studentNameExact;

  const cashboxId = sp.get("cashboxId");
  if (cashboxId) {
    const n = Number(cashboxId);
    if (!Number.isFinite(n)) {
      return NextResponse.json({ ok: false, error: "Noto'g'ri cashboxId" }, { status: 400 });
    }
    filter.cashboxId = n;
  }

  // Sana "YYYY-MM-DD" satr sifatida saqlanadi, shu bois oddiy satr
  // taqqoslash to'g'ri ishlaydi (leksikografik tartib = xronologik).
  const dateFrom = sp.get("dateFrom");
  const dateTo = sp.get("dateTo");
  const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
  if ((dateFrom && !ISO_DAY.test(dateFrom)) || (dateTo && !ISO_DAY.test(dateTo))) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri sana (YYYY-MM-DD kutilgan)" }, { status: 400 });
  }
  if (dateFrom || dateTo) {
    // `month` ham `date` ni ishlatadi — ikkalasi berilganda biri
    // ikkinchisini bosib ketmasin.
    const range: Record<string, string> = {};
    if (dateFrom) range.$gte = dateFrom;
    if (dateTo) range.$lte = dateTo;
    filter.date = filter.date ? { ...(filter.date as object), ...range } : range;
  }

  let cursor = col.find(filter).sort({ id: -1 });
  const limitRaw = Number(sp.get("limit"));
  const paged = Number.isFinite(limitRaw) && limitRaw > 0;
  if (paged) {
    const limit = Math.min(limitRaw, 500);
    const page = Math.max(1, Number(sp.get("page")) || 1);
    cursor = cursor.skip((page - 1) * limit).limit(limit);
  }

  // `?slim=1` — jadval CHIZADIGAN maydonlargina. Xodim profilidagi jadval
  // 20 maydondan atigi 11 tasini o'qiydi, qolgani bekorga tashiladi
  // (o'rtacha hujjat 464 bayt, kerakli maydonlar bilan ~190 bayt).
  // Parametrsiz javob avvalgidek to'liq — boshqa chaqiruvchilar tegilmagan.
  if (sp.get("slim") === "1") {
    cursor = cursor.project({
      _id: 0, id: 1, date: 1, time: 1, studentName: 1, amount: 1,
      before: 1, after: 1, txName: 1, status: 1, note: 1, paymentType: 1,
    });
  }

  const rows = await cursor.toArray();

  // JAMI son sahifalashdan OLDINGI holatni bildiradi — jadval ostidagi
  // "Umumiy soni" va sahifalar soni shunga tayanadi, sahifadagi qatorlar
  // soniga emas.
  //
  // Sahifalash SO'RALMAGAN bo'lsa kursor barcha mos qatorlarni qaytaradi,
  // ya'ni `total` aynan `rows.length`. Ilgari bunday chaqiruvlarda ham
  // countDocuments ishlardi — bir xil filtr bo'yicha ikkinchi to'liq
  // yurish, bepul olinadigan son uchun (~200 ms va bitta round-trip).
  // Chaqiruvchilarning to'rttasi limitsiz keladi.
  const total = paged ? await col.countDocuments(filter) : rows.length;
  const entries = rows.map(({ _id, ...rest }) => rest as unknown as TransactionEntry);
  return NextResponse.json({ ok: true, entries, total });
}
