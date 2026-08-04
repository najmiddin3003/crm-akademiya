// Sozlamalar ro'yxatlari uchun demo/boshlang'ich ma'lumot.

// O'quv → Sabablar. Referens saytdagi 13 ta sabab, turlari bilan.
export const REASONS_SEED = [
  { id: 1, name: "Puli qimmatlik qildi", type: "Ketdi" },
  { id: 2, name: "Boshqa markazga borayapti", type: "Ketdi" },
  { id: 3, name: "Oilaviy sharoiti tufayli", type: "Ketdi" },
  { id: 4, name: "O'qituvchini dars o'tish uslubi yoqmadi", type: "Ketdi" },
  { id: 5, name: "Manegerni muamolasi yoqmadi", type: "Ketdi" },
  { id: 6, name: "Uyidagilar ruxsat bermabdi", type: "Bekor qilindi" },
  { id: 7, name: "Boshqa o'quv markaziga boradigan bo'libdi", type: "Bekor qilindi" },
  { id: 8, name: "Telefoni noto'g'ri ekan", type: "Bekor qilindi" },
  { id: 9, name: "Qattiq kasal bo'lgan", type: "Davomat" },
  { id: 10, name: "Boshqa", type: "Ketdi" },
  { id: 11, name: "Sinov darsi", type: "Davomat" },
  { id: 12, name: "Ota-onasi so'radi", type: "Davomat" },
  { id: 13, name: "Ustozdan ruxsat so'radi", type: "Davomat" },
];

// Moliya → To'lov turlari — butun loyihadagi YAGONA to'lov turi ro'yxati
// (Kassalar sahifasi ham shundan oladi, lib/paymentMethods.ts ga qarang).
//
// `key` — kassaning `methodTotals` obyektidagi maydon nomi. Mavjud
// kassalardagi summalar shu kalitlar ostida saqlangani uchun ular
// O'ZGARMASLIGI kerak. Referensda dastlabki 4 tasi tizimli — o'chirib bo'lmaydi.
export const PAYMENT_METHODS_SEED = [
  { id: 1, key: "naqd", name: "Naqd", active: true, system: true },
  { id: 2, key: "plastik", name: "Plastik", active: true, system: true },
  { id: 3, key: "terminal", name: "Terminal", active: true, system: true },
  { id: 4, key: "ilovaClick", name: "Ilova Click", active: true, system: true },
  { id: 5, key: "inkassa", name: "Inkassa", active: true, system: false },
  { id: 6, key: "korporativKarta", name: "Korporativ karta", active: true, system: false },
  { id: 7, key: "yagonaQr", name: "Yagona QR", active: true, system: false },
  { id: 8, key: "hisobRaqam", name: "Hisob raqam", active: true, system: false },
];

// Moliya → Hamkorlar.
export const PARTNERS_SEED = [
  { id: 1, name: "Abdulloh Raxmatullayev", phone: "94 155 88 55", share: "" },
];

// Umumiy sozlamalar → Bayram kunlari. Referensda jadval bo'sh —
// shuning uchun bu yerda ham seed yo'q.
export const HOLIDAYS_SEED = [];

// Moliya → 3-shaxs. Referensda bitta yozuv.
export const THIRD_PERSONS_SEED = [
  { id: 1, name: "Abdullo Rahmatullayev", phone: "94 155 88 55", balance: "0" },
];

// Moliya → Oylik foizlari. Referensdagi 8 qator aynan ko'chirildi.
// `staffCount` — shu foizga bog'langan xodimlar soni; u xodim kartochkasidan
// hisoblanadi, shuning uchun bu yerda tahrirlanmaydigan ustun.
export const MONTHLY_PERCENTS_SEED = [
  { id: 1, name: "Yashil", staffCount: 14, percent: "40" },
  { id: 2, name: "Sariq", staffCount: 9, percent: "50" },
  { id: 3, name: "Qizil", staffCount: 7, percent: "60" },
  { id: 4, name: "Qora", staffCount: 4, percent: "70" },
  { id: 5, name: "Zangor", staffCount: 0, percent: "45" },
  { id: 6, name: "yangi", staffCount: 7, percent: "35" },
  { id: 7, name: "55", staffCount: 1, percent: "55" },
  { id: 8, name: "65", staffCount: 0, percent: "65" },
];

// O'quv → O'quvchini baholash darajalari.
// Referensda 7 ta qator bor, lekin hammasi bo'sh (nomsiz, 0/0) — sinov
// ma'lumoti. Shuning uchun shu songa mos mazmunli darajalar qo'yildi.
export const ASSESSMENT_LEVELS_SEED = [
  { id: 1, name: "A'lo", minPercent: "90", maxPercent: "100", color: "#22c55e" },
  { id: 2, name: "Yaxshi", minPercent: "75", maxPercent: "89", color: "#84cc16" },
  { id: 3, name: "Qoniqarli", minPercent: "60", maxPercent: "74", color: "#eab308" },
  { id: 4, name: "O'rtacha", minPercent: "45", maxPercent: "59", color: "#f97316" },
  { id: 5, name: "Past", minPercent: "30", maxPercent: "44", color: "#ef4444" },
  { id: 6, name: "Juda past", minPercent: "10", maxPercent: "29", color: "#b91c1c" },
  { id: 7, name: "Baholanmagan", minPercent: "0", maxPercent: "9", color: "#94a3b8" },
];

// O'quv → Qo'shimcha mashg'ulotlar. Referensda bo'sh.
export const ACTIVITIES_SEED = [];

// Boshqaruv → grading tizimi. Referensda faqat sinov qatorlari qolgan
// ("test" / "te" — 1 UZS), shuning uchun mazmunli lavozimlar bilan berildi.
export const DEGREES_MANAGER_SEED = [
  { id: 1, name: "Menejer", halfRate: "1 500 000", fullRate: "3 000 000" },
  { id: 2, name: "Katta menejer", halfRate: "2 000 000", fullRate: "4 000 000" },
  { id: 3, name: "Bo'lim boshlig'i", halfRate: "2 750 000", fullRate: "5 500 000" },
];

export const DEGREES_TEACHER_SEED = [
  { id: 1, name: "Yordamchi o'qituvchi", fullRate: "2 000 000" },
  { id: 2, name: "O'qituvchi", fullRate: "3 500 000" },
  { id: 3, name: "Katta o'qituvchi", fullRate: "5 000 000" },
];

// Sotuv → Hashtag. Referensda bitta yozuv.
export const HASHTAGS_SEED = [{ id: 1, name: "Ingliz tili" }];

// Sotuv → O'quvchilar turlari.
export const STUDENT_CATEGORIES_SEED = [
  { id: 1, name: "Kichik (1-4-sinf)" },
  { id: 2, name: "O'rta (5-9-sinf)" },
  { id: 3, name: "Katta (10-sinf va undan yuqori)" },
];

// Sotuv → SMS qurilmalar. Referensda "Ma'lumotlar topilmadi" — bo'sh.
export const SMS_DEVICES_SEED = [];

// Sotuv → Telefon raqamini belgilash turlari (lid bosqichi ranglari).
// Referensda kartalar ko'rinishida: emoji + nom + rang.
export const LEAD_COLORS_SEED = [
  { id: 1, emoji: "🤔", name: "Bir o'ylay", color: "#f59e0b" },
  { id: 2, emoji: "🤝", name: "Jaylang-e!", color: "#3b82f6" },
  { id: 3, emoji: "🤗", name: "Rahmaaaat!", color: "#22c55e" },
  { id: 4, emoji: "🤬", name: "Ketdim", color: "#ef4444" },
];
