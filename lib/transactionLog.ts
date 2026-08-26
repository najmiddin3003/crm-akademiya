import type { Db } from "mongodb";
import type { TransactionEntry } from "@/lib/transactionEntries";
import type { Transaction } from "@/lib/transactions";
import { classifyEntry } from "@/lib/sync/mappers";
import { enqueue } from "@/lib/sync/outbox";

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

/**
 * Tranzaksiya yozuvini qo'shadi va uning id'sini qaytaradi.
 *
 * Yozuv bazaga tushishi bilan SINXRONIZATSIYA NAVBATIGA ham qo'yiladi
 * (lib/sync) — Google Sheets qatori va Telegram guruhdagi xabar shundan
 * kelib chiqadi. Navbatga qo'yish AYNAN SHU YERDA turibdi, chunki bu
 * yozuvlar bazaga tushadigan yagona darvoza: kelajakda yangi route
 * qo'shilsa ham u avtomatik qamrab olinadi va "sinxronni ulashni unutish"
 * degan xato bo'lmaydi.
 *
 * Ko'chirish (transfer) yozuvlari navbatga TUSHMAYDI — ular yangi pul
 * emas, kassalar orasidagi qayta taqsimlash (classifyEntry qarang).
 */
export async function logEntry(
  db: Db,
  entry: Omit<TransactionEntry, "id">,
  options: {
    /**
     * Telegram guruhga xabar ketsinmi. Odatiy holat — `true` (kassadagi
     * jonli amal). Eski tarixni ko'chirib keltiruvchi IMPORT kodi buni
     * `false` qilib berishi SHART, aks holda guruh minglab xabar bilan
     * to'lib ketadi (edutizim tarixini yuklashda shu holat kutilyapti).
     */
    notifyTelegram?: boolean;
  } = {},
): Promise<number> {
  const id = await nextId(db, "transaction_entries");
  await db.collection("transaction_entries").insertOne({
    id,
    ...entry,
    // Yozuvda `date` va `time` alohida MATN maydonlari (sekundsiz, mintaqasiz).
    // Aniq vaqt tamg'asi navbat tartibi va tekshiruvlar uchun kerak.
    // Eski yozuvlarda bu maydon yo'q — kod uni ixtiyoriy deb biladi.
    createdAt: new Date().toISOString(),
  });

  const kind = classifyEntry(entry);
  if (kind) {
    await enqueue(db, {
      kind,
      entryId: id,
      event: "created",
      notifyTelegram: options.notifyTelegram ?? true,
    });
  }
  return id;
}

// Faqat haqiqiy Kirim/Chiqim uchun (daromad/xarajat hisobotlari) — bitta
// kassa ichidagi yoki kassalar orasidagi Ko'chirish bu yerga yozilmaydi,
// chunki u umumiy daromad/xarajatni o'zgartirmaydi (faqat qayta taqsimlaydi).
export async function logTransaction(db: Db, tx: Omit<Transaction, "id">): Promise<number> {
  const id = await nextId(db, "transactions");
  await db.collection("transactions").insertOne({ id, ...tx });
  // Id QAYTARILADI: oylik chiqarish bir necha yozuvni ketma-ket yaratadi va
  // o'rtada xato bo'lsa yaratilganini orqaga qaytarishi kerak — buning uchun
  // qaysi yozuvlar tug'ilganini bilish shart.
  return id;
}
