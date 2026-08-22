// Moliya → Tranzaksiyalar. MongoDB `transaction_entries` kolleksiyasi — har
// bir kassa+to'lov-turi juftligi o'zining "oldingi/keyingi miqdor" ketma-
// ketligini yuritadi (Kassalar sahifasidagi har bir to'lov usuli alohida
// hisoblanishi bilan bir xil g'oya). Foydalanuvchi bilan kelishilgan qamrov:
// manba saytida 22 979 ta haqiqiy yozuv bor edi — bu yerda shunga o'xshash,
// lekin ancha kichikroq (~25-30 ta) demo to'plami.
export interface AmountEdit {
  at: string;      // ISO datetime yozuv qachon tahrirlangani
  from: number;    // avvalgi ishorali summa
  to: number;      // yangi ishorali summa
  reason: string;  // foydalanuvchi ko'rsatgan sabab
}

export interface TransactionEntry {
  id: number;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:mm"
  studentName: string;
  amount: number; // ishorali
  before: number;
  after: number | null; // transfer yozuvlarida ko'pincha bo'sh (manbada ham shunday)
  txType: string; // "transfer" | "payOut" | "payIn"
  txName: string;
  paymentType: string; // "Naqd" | "Plastik" | "Terminal" | ...
  group: string;
  lessonDate: string;
  moderator: string;
  /**
   * Shu yozuv QAYSI O'QITUVCHINING oyligiga ta'sir qiladi.
   *
   * • Kirim (o'quvchi to'ladi) — to'lagan o'quvchining ustozi. Uning
   *   oyligiga shu summadan foiz qo'shiladi.
   * • Chiqim (hodimga avans / hodimga oylik) — puli chiqarilayotgan
   *   xodimning o'zi. Uning oyligidan shu summa ayriladi.
   *
   * `moderator` dan FARQ QILADI: u yozuvni qayd etgan kassa mas'uli.
   * Ilgari ikkalasi bitta maydonda edi va o'qituvchi tanlanmaganda kassa
   * mas'uli o'qituvchi o'rniga tushib qolardi.
   *
   * Ixtiyoriy: bu maydon qo'shilishidan oldingi yozuvlarda yo'q.
   */
  teacherName?: string;
  reason: string;
  note: string;
  status: string; // "" | "waiting" | "cancelled"
  cashboxId: number;
  /** Miqdor har tahrirlanganda shu massivga bitta yangi yozuv qo'shiladi. */
  editHistory?: AmountEdit[];
}
