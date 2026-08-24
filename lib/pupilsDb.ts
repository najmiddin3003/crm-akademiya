// O'quvchilar bo'yicha SERVER tomonidagi yordamchilar (MongoDB).
//
// lib/pupilsData.ts klientda ham import qilinadi, shuning uchun mongodb'ga
// bog'liq kod shu yerda alohida turadi.
//
// Moliya yozuvlari (bonus, jarima, tranzaksiya) o'quvchining id'sini emas,
// faqat ISMINI saqlaydi — shu bois qidiruv ism bo'yicha, katta-kichik harf va
// ortiqcha bo'shliqni hisobga olmagan holda ketadi (klientdagi
// hooks/useStudents.ts → byName bilan bir xil qoida).

import type { Db } from "mongodb";

// NIMA NOTO'G'RI EDI: bu faylda `findPupilByName()` + `pupilBalanceByName()`
// juftligi bor edi va ikkinchisi `pupils.balance` maydonini o'qirdi. O'sha
// maydonni HECH BIR API yangilamaydi — u o'quvchi kartochkasi bilan birga
// bir marta yozilgan, keyin qotib qolgan son. Bonus/Jarima route'lari uni
// "Oldingi miqdor" deb olardi va ustiga `after = before ± amount` zanjirini
// qurardi, ya'ni Moliya jadvallarida o'ylab topilgan son o'quvchining
// balansi sifatida ko'rsatilardi.
//
// NEGA ENDI TO'G'RI: yagona haqiqiy balans manbasi —
// app/api/students/balances/route.ts dagi qoida: bekor qilinmagan `payIn`
// `transaction_entries` yozuvlarining yig'indisi, kalit — kichik harfga
// o'tkazilgan va chetlari kesilgan to'liq ism. Ya'ni "o'quvchi HAQIQATAN
// to'lagan pul". Quyidagi funksiya aynan o'sha arifmetikani bitta ism uchun
// bajaradi, boshqa manbaga umuman tegmaydi.
//
// `findPupilByName()` olib tashlandi: undan faqat shu balans hisobi
// foydalanardi va u `pupils` hujjatini (ichida o'sha yaroqsiz `balance`
// maydoni bilan) tarqatib yurardi.
export async function studentPaidBalanceByName(db: Db, name: string): Promise<number> {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return 0;

  const rows = await db
    .collection("transaction_entries")
    .find({ txType: "payIn", status: { $ne: "cancelled" }, studentName: { $nin: ["", null] } })
    .project({ studentName: 1, amount: 1 })
    .toArray();

  let total = 0;
  for (const r of rows) {
    if (String(r.studentName ?? "").trim().toLowerCase() !== wanted) continue;
    total += Number(r.amount) || 0;
  }
  // To'lov yozuvi bo'lmasa yig'indi 0 — bu o'ylab topilgan son emas, aynan
  // /api/students/balances qaytaradigan qiymat (u yerda ham bunday o'quvchi
  // ro'yxatga tushmaydi va sahifalar `?? 0` bilan o'qiydi).
  return total;
}
