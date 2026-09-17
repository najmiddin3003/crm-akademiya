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
  /**
   * Yozuv qaysi "Oylik chiqarish" partiyasidan tug'ilgani (`salary_runs.id`).
   *
   * Bog'lanish KERAK: chiqarish o'chirilganda aynan shu partiya yaratgan
   * chiqimlarni topib bekor qilish va pulni kassaga qaytarish lozim.
   * Usiz o'chirish kassadan pulni izsiz yo'qotardi. Kassa oynasidan qo'lda
   * kiritilgan yozuvlarda bu maydon yo'q.
   */
  salaryRunId?: number;
  /**
   * To'lov turining BARQAROR kaliti (`settings_payment_methods.key`).
   *
   * `paymentType` — turning KO'RINADIGAN NOMI va u Sozlamalardan
   * o'zgartirilishi mumkin. Bekor qilish esa kassaning qaysi
   * `methodTotals` maydonini tiklashni bilishi kerak; nom bo'yicha qidirish
   * nom o'zgargan zahoti ishlamay qolardi va pul kassaga QAYTMASDI.
   * Shu bois kalit yozuvning o'zida saqlanadi. Eski yozuvlarda yo'q —
   * ularda nom bo'yicha qidirishga qaytiladi.
   */
  paymentMethodKey?: string;
  /**
   * Kassalararo ko'chirmaning IKKI qatorini bog'laydigan kalit.
   *
   * NIMA UCHUN KERAK: ko'chirma har doim juft yozuv — jo'natuvchida
   * manfiy, qabul qiluvchida musbat. Tasdiqlash/rad etish ikkala qatorni
   * ham bir vaqtda o'zgartirishi shart. Ilgari bu maydon YO'Q edi va
   * juftlikni faqat qo'shni id, bir xil `txName`/`date`/`time` bo'yicha
   * TAXMIN qilish mumkin edi — qo'lda qaytarish skripti (scripts/
   * _revert-transfer-49179.mjs) shu sababli ikkala id'ni qattiq yozib
   * qo'ygan.
   *
   * Qiymat — juftlikning "chiquvchi" qatorining id'si (ikkalasida bir xil).
   * Faqat `txType: "transfer"` va faqat KASSALARARO ko'chirmada bo'ladi;
   * bitta kassa ichidagi to'lov turlari orasidagi ko'chirishda ham,
   * bu maydon qo'shilishidan oldingi yozuvlarda ham yo'q.
   */
  transferId?: number;
  /**
   * Juftlikda shu qator qaysi tomon: pul CHIQQAN kassami yoki KELGANmi.
   *
   * Miqdor ishorasidan (`amount < 0`) chiqarish ham mumkin edi, lekin
   * tasdiqlash huquqi aynan shu maydonga tayanadi — "kelgan" qatorning
   * kassa egasi tasdiqlaydi — va bunday qoidani ishoraga emas, ochiq
   * maydonga bog'lash xavfsizroq.
   */
  transferRole?: "out" | "in";
  /**
   * Ko'chirma yozilganda pul jo'natuvchi kassadan DARHOL yechilganmi.
   *
   * Faqat juftlikning "out" qatorida bo'ladi va faqat ikkita qiymati bor:
   *
   *   `false` — YANGI QOIDA. Pul jo'natuvchida QOLADI, undan faqat qabul
   *             qiluvchi ✓ bosganda yechiladi. Kassir kunlik tushumni
   *             rahbarga jo'natgach balansi darhol nolga tushib qolmasin
   *             degan talab shundan (foydalanuvchi, 10.09.2026).
   *
   *   yo'q    — ESKI QOIDA (bu maydon qo'shilishidan oldingi yozuvlar).
   *             Pul jo'natishda ALLAQACHON yechilgan va "yo'lda" turibdi:
   *             tasdiq faqat qabul qiluvchiga qo'shadi, rad etish esa
   *             jo'natuvchiga QAYTARADI.
   *
   * Farq muhim: ikkisini adashtirish pulni ikki marta yechish yoki ikki
   * marta qaytarish demakdir. Shuning uchun `lib/transferDecision.ts`
   * qaror qabul qilishdan oldin aynan shu maydonga qaraydi va sukut
   * bo'yicha ESKI qoidani tanlaydi — maydonsiz yozuvlar bazada bor.
   */
  deductedOnSend?: boolean;
  /**
   * Yozuv bazaga tushgan aniq vaqt (ISO). `date` va `time` — foydalanuvchi
   * ko'radigan, kassir o'zgartira oladigan maydonlar; bu esa tizim qo'ygan
   * o'zgarmas tamg'a. Sinxronizatsiya navbati va tekshiruvlar shunga
   * tayanadi. Bu maydon qo'shilishidan OLDINGI yozuvlarda yo'q.
   */
  createdAt?: string;
  /**
   * To'lov QAYSI OY uchun ekani — "YYYY-MM".
   *
   * `date` dan FARQI: `date` — pul kassaga kelgan kun, bu esa u qoplaydigan
   * davr. Sentabrda kelgan pul avgust darslari uchun bo'lishi mumkin, va
   * o'qituvchining foizli oyligi aynan SHU oyga hisoblanadi
   * (lib/payrollSources.ts → loadCollectedByTeacher).
   *
   * Kirim oynasida sukut bo'yicha sana oyiga teng, ya'ni odatdagi holatda
   * kassir hech narsa qilmaydi. Maydon YO'Q bo'lgan (bu qo'shilishdan
   * oldingi va import qilingan) yozuvlarda `date` ning oyi ishlatiladi.
   */
  periodMonth?: string;
  /**
   * O'QUVCHIGA PUL QAYTARILDI — chiqim yozuvi, lekin oddiy xarajat EMAS.
   *
   * `true` bo'lsa yozuv o'quvchining ILGARI TO'LAGAN pulini qaytarib
   * berish: `studentName` — o'quvchi, `amount` — manfiy summa, `teacherName`
   * — o'sha to'lov foizi hisoblangan ustoz. Uch joyga ta'sir qiladi:
   *
   *   • o'quvchi balansi — ayriladi (lib/studentRefund.ts →
   *     studentBalanceMatch; balans = payIn + shu yozuvlar, ishorali);
   *   • ustozning shu oydagi tushumi (`collected`) — ayriladi, ya'ni
   *     foizli oyligi qaytarilgan summaning foizi qadar kamayadi
   *     (lib/payrollSources.ts → loadCollectedByTeacher); qolgan qismi
   *     markaz hisobidan ketadi — u kassa chiqimi sifatida allaqachon yozilgan;
   *   • "O'quv markazga ishlab berilgan" hisoboti — o'sha ustozning
   *     summasidan ayriladi.
   *
   * QAYSI YOZUVDA `true`: Chiqim oynasida tanlangan tur "Mijoz" bo'yicha
   * O'QUVCHI ga qaratilgan bo'lsa (lib/txTarget.ts → txTarget === "student")
   * server o'zi qo'yadi (app/api/cashboxes/[id]/adjust). Nomga qarab
   * ("qaytar" so'zi) TAXMIN QILINMAYDI — tur nomi Sozlamalardan
   * o'zgartirilishi mumkin. Bu maydon qo'shilishidan OLDINGI qaytarim
   * yozuvlari `scripts/backfill-student-refund.mjs` bilan belgilanadi.
   */
  studentRefund?: boolean;
}

/**
 * Yozuv o'quvchiga pul qaytarish yozuvimi — YAGONA qoida, klient va server
 * uchun bir xil. Faqat `studentRefund` bayrog'iga qaraladi; `txName` dagi
 * "qaytar" so'zi qoida EMAS (yuqoridagi izoh).
 */
export function isStudentRefundEntry(
  e: Pick<TransactionEntry, "txType" | "studentRefund"> | null | undefined,
): boolean {
  return !!e && e.txType === "payOut" && e.studentRefund === true;
}
