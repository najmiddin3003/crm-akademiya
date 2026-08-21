import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { TRANSACTION_ENTRY_SEED } from "@/constants/transactionEntries";
import type { TransactionEntry } from "@/lib/transactionEntries";

// Moliya → Tranzaksiyalar backend'i (MongoDB `transaction_entries`, faqat
// o'qish uchun — bu sahifada qo'shish/tahrirlash/o'chirish yo'q). Bo'sh
// bo'lsa demo tranzaksiyalarni (foydalanuvchi bilan kelishilgan yengil
// qamrov — ~28 ta) bir marta seed qiladi.
async function seedIfEmpty(col: Collection) {
  if ((await col.countDocuments()) === 0) {
    await col.insertMany(JSON.parse(JSON.stringify(TRANSACTION_ENTRY_SEED)));
  }
}

const TX_TYPES = ["payIn", "payOut", "transfer"];

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
  await seedIfEmpty(col);

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

  const rows = await col.find(filter).sort({ id: -1 }).toArray();
  const entries = rows.map(({ _id, ...rest }) => rest as unknown as TransactionEntry);
  return NextResponse.json({ ok: true, entries, total: entries.length });
}
