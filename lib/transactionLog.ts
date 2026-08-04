import type { Db } from "mongodb";
import type { TransactionEntry } from "@/lib/transactionEntries";
import type { Transaction } from "@/lib/transactions";

// Kassalar sahifasidagi Kirim/Chiqim/Ko'chirish (adjust, transfer,
// transfer-to route'lari) shu yordamchilar orqali HAQIQIY tranzaksiya
// yozuvlari qo'shadi — shu bilan "Tranzaksiyalar" (transaction_entries) va
// "Moliya hisobotlari"/"Moliya analitikasi" (transactions) sahifalari ham
// bir xil, real ma'lumot bazasidan foydalanadi (demo seed ustiga qo'shiladi).
async function nextId(db: Db, collectionName: string): Promise<number> {
  const col = db.collection(collectionName);
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  return (last[0]?.id ?? 0) + 1;
}

export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function nowTime(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export async function logEntry(db: Db, entry: Omit<TransactionEntry, "id">): Promise<void> {
  const id = await nextId(db, "transaction_entries");
  await db.collection("transaction_entries").insertOne({ id, ...entry });
}

// Faqat haqiqiy Kirim/Chiqim uchun (daromad/xarajat hisobotlari) — bitta
// kassa ichidagi yoki kassalar orasidagi Ko'chirish bu yerga yozilmaydi,
// chunki u umumiy daromad/xarajatni o'zgartirmaydi (faqat qayta taqsimlaydi).
export async function logTransaction(db: Db, tx: Omit<Transaction, "id">): Promise<void> {
  const id = await nextId(db, "transactions");
  await db.collection("transactions").insertOne({ id, ...tx });
}
