// To'lov turlarining YAGONA manbasi.
//
// Ilgari ro'yxat ikki joyda edi: `lib/cashboxes.ts` dagi qattiq yozilgan
// CASHBOX_METHODS (Kassalar sahifasi ishlatardi) va Sozlamalar → Moliya →
// To'lov turlari (MongoDB `settings_payment_methods`). Sozlamadan tur
// qo'shilsa Kassalarda ko'rinmasdi. Endi ikkalasi ham shu yerdan oladi.
//
// `key` — kassaning `methodTotals` obyektidagi maydon nomi. U BARQAROR
// bo'lishi shart: nom o'zgarsa ham kalit o'zgarmaydi, aks holda mavjud
// kassalardagi summalar "yo'qolib" qolardi.
import type { Db, Document, WithId } from "mongodb";
import { PAYMENT_METHODS_SEED } from "@/constants/settingsLists";

export interface PaymentMethod {
  id: number;
  key: string;
  name: string;
  active: boolean;
  system: boolean;
}

export const PAYMENT_METHODS_COLLECTION = "settings_payment_methods";

// Nomdan barqaror kalit yasaydi (yangi tur qo'shilganda).
export function slugifyMethod(name: string): string {
  const map: Record<string, string> = { "'": "", "‘": "", "’": "", "ʻ": "" };
  const cleaned = name.trim().toLowerCase().replace(/['‘’ʻ]/g, (c) => map[c] ?? "");
  const parts = cleaned.split(/[^a-z0-9]+/).filter(Boolean);
  if (parts.length === 0) return "method";
  return parts[0] + parts.slice(1).map((p) => p[0].toUpperCase() + p.slice(1)).join("");
}

// Server tomonida ro'yxatni o'qiydi (bo'sh bo'lsa seed qiladi).
//
// `key` maydoni ro'yxat Sozlamalar sahifasi uchun yaratilgandan KEYIN
// qo'shilgan — shuning uchun eski hujjatlarda u yo'q bo'lishi mumkin.
// Quyidagi backfill idempotent: kalitsiz hujjat topilsa, uni seed'dagi
// bir xil `id` dan (yoki nomdan) tiklaydi va bir marta yozib qo'yadi.
// Shu sababli qo'lda migratsiya skripti kerak emas.
async function backfillKeys(col: ReturnType<Db["collection"]>, missing: WithId<Document>[]) {
  const seedById = new Map(
    (PAYMENT_METHODS_SEED as { id: number; key: string }[]).map((s) => [s.id, s.key]),
  );
  for (const doc of missing) {
    const key = seedById.get(Number(doc.id)) ?? slugifyMethod(String(doc.name ?? ""));
    await col.updateOne({ _id: doc._id }, { $set: { key } });
  }
}

// AVVAL O'QIYMIZ, keyin kerak bo'lsagina yozamiz.
//
// Ilgari bu funksiya har chaqiruvda UCHTA ketma-ket Atlas so'rovi qilardi:
// countDocuments() → backfill uchun find({key:{$exists:false}}) → find({}).
// Kolleksiyada 8 ta hujjat bor va HAMMASIDA `key` bor, ya'ni birinchi
// ikkitasi migratsiyalar bir marta ishlaganidan beri hech nima qilmasdi.
// Lekin ular 8 ta route'ning kritik yo'lida turardi — GET /api/cashboxes
// (Kassalar sahifasi) shular ichida. O'lchandi: 513 ms → 154 ms.
//
// Ikkala migratsiya ham idempotent bo'lib qoladi, shunchaki endi ular
// allaqachon o'qilgan ro'yxat ustidan qaror qiladi.
export async function loadPaymentMethods(db: Db): Promise<PaymentMethod[]> {
  const col = db.collection(PAYMENT_METHODS_COLLECTION);
  let rows = await col.find({}).sort({ id: 1 }).toArray();

  if (rows.length === 0) {
    await col.insertMany(JSON.parse(JSON.stringify(PAYMENT_METHODS_SEED)));
    rows = await col.find({}).sort({ id: 1 }).toArray();
  }

  const missing = rows.filter((r) => r.key === undefined);
  if (missing.length > 0) {
    await backfillKeys(col, missing);
    rows = await col.find({}).sort({ id: 1 }).toArray();
  }

  return rows.map(({ _id, ...rest }) => rest as unknown as PaymentMethod);
}

export async function loadPaymentMethodKeys(db: Db): Promise<string[]> {
  return (await loadPaymentMethods(db)).map((m) => m.key);
}
