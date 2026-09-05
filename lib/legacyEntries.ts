// EDUTIZIM ARXIVI — o'quvchilarning ESKI to'lov tarixi.
//
// ══════════════════════════════════════════════════════════════════
// NEGA ALOHIDA KOLLEKSIYA (`transaction_entries` GA QO'SHILMAYDI)
//
// Markaz talabi aniq edi: "hech qanday o'qituvchilar oyligiga ta'sir
// qilmasin, hech qanday boshqa yerlarga pul qo'shilib yoki kamayib
// ketmasin — bizga eng keragi o'quvchilar oldin qilgan to'lovlarini
// ko'rish, boshqa hech narsa emas".
//
// `transaction_entries` ga qo'shilsa, 16 996 yozuv O'N JOYGA oqib
// ketardi va ularning har birini alohida to'sib qolish kerak bo'lardi:
//   • kassa balansi va `methodTotals` (Kassalar sahifasi);
//   • o'qituvchining foizli oyligi (lib/payrollSources.ts — `teacherName`
//     va `periodMonth` bo'yicha o'qiydi);
//   • Tushum rejasi, Moliya hisobotlari va analitikasi;
//   • o'quvchi balansi (/api/students/balances);
//   • Google Sheets sinxronizatsiyasi va Telegram qo'ng'irog'i;
//   • bildirishnomalar paneli.
// Bitta unutilgan joy — buzilgan hisobot. Alohida kolleksiya esa buni
// TUZILMA darajasida hal qiladi: hech bir hisobot bu yerga so'rov
// yubormaydi, ya'ni unutish mumkin bo'lgan joyning o'zi yo'q.
//
// SHU SABAB `cashboxId` MAYDONI HAM YO'Q. Kassa nomi faqat MATN bo'lib
// saqlanadi: kelajakda kimdir `{ cashboxId: 4 }` bo'yicha qidirsa, bu
// yozuvlar unga tushmasin.
//
// O'qish faqat bitta joyda: GET /api/legacy-entries (o'quvchi profili).

export const LEGACY_COLLECTION = "legacy_entries";

export interface LegacyEntry {
  /** Ichki ketma-ket raqam (1..N). `transaction_entries` id'lari bilan aloqasi YO'Q. */
  id: number;
  /** Edutizimdagi `_id` — takroriy ko'chirishni to'sadi (unikal indeks). */
  sourceId: string;
  /** "YYYY-MM-DD" — Toshkent devor-sanasi. */
  date: string;
  /** "HH:mm" */
  time: string;
  /** Tartiblash uchun aniq lahza (ISO UTC). */
  at: string;
  amount: number;
  /** Hozircha faqat "payIn": edutizimda o'quvchi ismi bor yagona tur shu. */
  txType: string;
  /** Edutizimdagi kategoriya, masalan "O'quvchi to'ladi". */
  txName: string;
  paymentType: string;
  note: string;
  /** "" yoki "cancelled". */
  status: string;
  studentName: string;
  /** Xalqaro shaklda, masalan "+998951283938". */
  studentPhone: string;
  /**
   * Bazadagi o'quvchi (`pupils.id`) — KO'CHIRISH paytida TELEFON bo'yicha
   * topiladi, ism bo'yicha emas.
   *
   * Sabab o'lchangan: bazada 511 ta ism takrorlanadi va ularning 501
   * tasida telefon HAR XIL. Ism bo'yicha bog'lansa, har to'rtinchi
   * yozuvda begona odamning to'lov tarixi ko'rinishi mumkin edi.
   * `null` — bunday o'quvchi bazada topilmadi (74 ta yozuv).
   */
  pupilId: number | null;
  /** FAQAT KO'RSATISH UCHUN. Hech qanday oylik hisobiga kirmaydi. */
  teacherName: string;
  moderator: string;
  /** Kassa NOMI, matn. Id ataylab saqlanmaydi (yuqoridagi izohga qarang). */
  cashboxName: string;
}
