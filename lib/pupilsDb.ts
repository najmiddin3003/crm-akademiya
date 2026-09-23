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
import { studentBalanceMatch } from "@/lib/studentRefund";
import { pupilBalanceMatch, resolvePupilRef, type EntryFilter, type PupilRef } from "@/lib/pupilEntries";

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
// `transaction_entries` yozuvlari MINUS o'quvchiga qaytarib berilgan pul
// (`payOut` + `studentRefund: true`, lib/studentRefund.ts), kalit — kichik
// harfga o'tkazilgan va chetlari kesilgan to'liq ism. Ya'ni "o'quvchi
// HAQIQATAN to'lagan va qaytarib olmagan pul". Quyidagi funksiya aynan
// o'sha arifmetikani bitta ism uchun bajaradi, boshqa manbaga umuman
// tegmaydi.
//
// `findPupilByName()` olib tashlandi: undan faqat shu balans hisobi
// foydalanardi va u `pupils` hujjatini (ichida o'sha yaroqsiz `balance`
// maydoni bilan) tarqatib yurardi.
export async function studentPaidBalanceByName(db: Db, name: string): Promise<number> {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return 0;

  // ID BO'YICHA — asosiy yo'l. Ism takrorlanishi mumkin, id esa yo'q
  // (lib/pupilEntries.ts). Ism yagona bo'lsa `resolvePupilRef` o'quvchini
  // topadi va hisob o'sha o'quvchining yozuvlari bo'yicha ketadi.
  //
  // Topilmasa (ism takrorlangan yoki bazada bunday o'quvchi yo'q — masalan
  // Bonus/Jarima oynasi XODIM ismi bilan chaqirsa) eskicha, ism bo'yicha
  // hisoblanadi: bu funksiya o'quvchi bo'lmagan ismni ham qabul qiladi.
  const ref = await resolvePupilRef(db, { name });
  if (ref) return studentPaidBalance(db, ref);

  // Yig'indi Mongo'da guruhlanadi — ilgari BUTUN kolleksiya (16 937 qator,
  // 899 KB) Node'ga kelib, pastdagi tsikl bittadan boshqa hammasini
  // tashlab yuborardi. O'lchandi: 1 167 ms → ~200 ms.
  //
  // Ism bo'yicha solishtirish JS'da qoladi (regex bilan emas): qoida
  // /api/students/balances dagi bilan AYNAN bir xil bo'lishi shart, aks
  // holda o'quvchining balansi ikki joyda ikki xil chiqadi. Shart ham
  // o'sha yerdagi bilan bitta manbadan (studentBalanceMatch) — qaytarim
  // manfiy summa bilan ishorali yig'indiga kiradi.
  const rows = await db
    .collection("transaction_entries")
    .aggregate([
      { $match: studentBalanceMatch() },
      { $group: { _id: "$studentName", total: { $sum: "$amount" } } },
    ])
    .toArray();

  let total = 0;
  for (const r of rows) {
    if (String(r._id ?? "").trim().toLowerCase() !== wanted) continue;
    total += Number(r.total) || 0;
  }
  // To'lov yozuvi bo'lmasa yig'indi 0 — bu o'ylab topilgan son emas, aynan
  // /api/students/balances qaytaradigan qiymat (u yerda ham bunday o'quvchi
  // ro'yxatga tushmaydi va sahifalar `?? 0` bilan o'qiydi).
  return total;
}

/**
 * BITTA o'quvchining balansi — ID bo'yicha (ism faqat `pupilId` siz eski
 * yozuvlar uchun zaxira, lib/pupilEntries.ts).
 *
 * Yuqoridagi ism bo'yicha variantdan FARQI: ismdoshning `pupilId` bilan
 * belgilangan to'lovi bu yig'indiga TUSHMAYDI. Shu bois kassadagi
 * "o'quvchiga pul qaytarish" chegarasi ham, profil kartochkasidagi son
 * ham endi haqiqiy egasiniki.
 */
export async function studentPaidBalance(db: Db, ref: PupilRef): Promise<number> {
  const [agg] = await db
    .collection("transaction_entries")
    .aggregate([
      { $match: pupilBalanceMatch(ref, studentBalanceMatch() as EntryFilter) },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ])
    .toArray();
  return Number(agg?.total) || 0;
}
