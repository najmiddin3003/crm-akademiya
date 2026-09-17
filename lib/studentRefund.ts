import type { Db, Filter } from "mongodb";
import type { TransactionEntry } from "@/lib/transactionEntries";
import type { TransactionType } from "@/lib/transactionTypes";
import { txTarget } from "@/lib/txTarget";
import { findTeacherOfStudent } from "@/lib/teacherOfStudent";

// O'QUVCHIGA PUL QAYTARISH — server tomonidagi yagona qoidalar to'plami.
//
// Foydalanuvchi talabi (18.09.2026): o'quvchi 200 to'lagan bo'lsa va 100 ni
// qaytarib olsa, bu 100 HAMMA JOYDAN ayrilsin — o'quvchi balansidan, ustoz
// oyligidan (foizi qadar: 50% bo'lsa 50 ustozdan), qolgani markaz
// hisobidan. Amalga oshirish:
//
//   • Qaytarim — oddiy chiqim yozuvi (`txType: "payOut"`, manfiy summa,
//     kassadan pul chiqadi) + `studentRefund: true` bayrog'i
//     (lib/transactionEntries.ts). Kassa qoldig'i, xarajat hisobotlari va
//     Sheets/Telegram uchun u hech qanday maxsus emas — pul kassadan
//     haqiqatan chiqdi va "O'quvchiga pul qaytarildi" turida ko'rinadi.
//     Markazning ulushi shu chiqim orqali o'z-o'zidan ayriladi.
//   • O'quvchi BALANSI — `studentBalanceMatch()`: payIn va qaytarim
//     yozuvlarining ISHORALI yig'indisi (qaytarim manfiy).
//   • Ustoz TUSHUMI — lib/payrollSources.ts → loadCollectedByTeacher:
//     qaytarim `teacherName` bo'yicha o'sha oy tushumidan ayriladi, foizli
//     oylik esa tushumdan hisoblanadi — ya'ni ustozdan aynan foizi ketadi.
//
// NEGA BAYROQ, NOM EMAS: tur nomi ("O'quvchiga pul qaytarildi") admin
// tomonidan o'zgartiriladi; nomdagi "qaytar" so'ziga bog'lanish nom
// o'zgarishi bilan balansni jimgina buzardi. Bayroq esa yozuvning o'zida
// turadi va yozilgan paytdagi ma'noni saqlaydi.

/**
 * O'quvchining TO'LAGAN puli (balansi) ni tashkil qiluvchi yozuvlar —
 * Mongo `$match`/`find` sharti. Ishorali yig'indi olinadi: to'lov musbat,
 * qaytarim manfiy.
 *
 * `studentName` bo'sh yozuvlar tashlanadi (ismsiz kirim o'quvchi to'lovi
 * emas); bekor qilinganlar ham. Har chaqiruvda YANGI obyekt qaytadi —
 * chaqiruvchi ustiga o'z shartini qo'shishi mumkin (masalan oy).
 */
export function studentBalanceMatch(): Filter<TransactionEntry> {
  return {
    $or: [{ txType: "payIn" }, { txType: "payOut", studentRefund: true }],
    status: { $ne: "cancelled" },
    studentName: { $nin: ["", null] },
  } as Filter<TransactionEntry>;
}

/**
 * Chiqim turi "O'quvchiga pul qaytarildi" ma'nosidami.
 *
 * Qoida Chiqim oynasidagi bilan AYNAN bir xil (CashboxAdjustDrawer →
 * `txTarget(selectedType) === "student"`): tur "Mijoz" bo'yicha O'QUVCHIGA
 * qaratilgan bo'lsa, chiqim — o'quvchining pulini qaytarish. Tur bazadan
 * NOM bo'yicha topiladi (jurnal ham nom bilan ishlaydi); nom takrorlansa
 * `mainType: "chiqim"` bo'lgani olinadi. Tur topilmasa (o'chirilgan yoki
 * qayta nomlangan) — nomdagi kalit so'zga qaytiladi, bu ham `txTarget`
 * ning o'z zaxira yo'li.
 */
export async function isStudentRefundCategory(db: Db, category: string): Promise<boolean> {
  const name = String(category ?? "").trim();
  if (!name) return false;
  const type = await db
    .collection<TransactionType>("transaction_types")
    .findOne({ name, mainType: "chiqim" }, { projection: { _id: 0, name: 1, customerType: 1 } });
  return txTarget(type ?? { name }) === "student";
}

/**
 * Qaytarim QAYSI USTOZNING tushumidan ayrilishi.
 *
 * Tartib:
 *   1. o'quvchining ENG OXIRGI bekor qilinmagan to'lovidagi `teacherName`
 *      — aynan o'sha ustozga foiz hisoblangan, demak qaytarim ham undan;
 *   2. topilmasa — o'quvchining guruhidagi ustoz (findTeacherOfStudent,
 *      Kirim oynasi bilan bir xil zaxira yo'l).
 * Ikkalasi ham bo'lmasa `null` — taxmin qilinmaydi, yozuv ustozsiz
 * qoladi va faqat o'quvchi balansiga ta'sir qiladi.
 */
export async function refundTeacherOf(db: Db, studentName: string): Promise<string | null> {
  const name = String(studentName ?? "").trim();
  if (!name) return null;
  // Ism — anchor'li regex, katta-kichik harfsiz, chetidagi probelga
  // befarq: balans hisobidagi `trim().toLowerCase()` qoidasi bilan bir
  // xil o'quvchi topilsin (bazadagi ismlarning chetida probel bor).
  const last = await db
    .collection("transaction_entries")
    .find(
      {
        txType: "payIn",
        status: { $ne: "cancelled" },
        studentName: { $regex: `^\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, $options: "i" },
        teacherName: { $nin: ["", null] },
      },
      { projection: { _id: 0, teacherName: 1 }, sort: { id: -1 }, limit: 1 },
    )
    .toArray();
  const fromPayment = String(last[0]?.teacherName ?? "").trim();
  if (fromPayment) return fromPayment;
  return findTeacherOfStudent(db, name);
}
