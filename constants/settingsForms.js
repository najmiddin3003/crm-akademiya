// Sozlamalardagi oddiy forma tablari (karta ro'yxati emas, to'g'ridan-to'g'ri
// maydonlar). Maydonlar referens saytdan ochib ko'rilgan holda ko'chirilgan.
//
// Kalit `SettingsForm` ga `storageKey` sifatida beriladi va MongoDB
// `settings` kolleksiyasida shu nom bilan saqlanadi.

// Umumiy sozlamalar → Foydalanuvchi sozlamalari (?status=user-filter-settings)
export const USER_FILTER_SETTINGS_GROUPS = [
  {
    title: "FILTER",
    fields: [
      {
        key: "filterView",
        label: "Filter ko'rinishi",
        type: "radio",
        options: [
          "Statik|Filtrlar yopiq holatda, tugma orqali ochiladi",
          "Yig'iladigan|Barcha filtrlar bitta dropdown ichida",
          "Ochiladigan|Har bir filtr alohida dropdown ko'rinishda",
        ],
        default: "Statik",
      },
      { key: "filterOpen", label: "Filter ochiq bo'lsin", type: "toggle", default: false },
    ],
  },
];

// Ilova sozlamalari → Kontent (?status=content)
export const APP_CONTENT_GROUPS = [
  {
    title: "KONTENT",
    fields: [
      { key: "storiesEnabled", label: "Hikoya yoqish", type: "toggle", default: true },
      { key: "newsEnabled", label: "Yangilik yoqish", type: "toggle", default: true },
    ],
  },
];

// Moliya → Menejer bonuslarini belgilash (?status=payment-manager)
export const MANAGER_PAYMENT_GROUPS = [
  {
    title: "BONUS TURLARI",
    fields: [
      { key: "orderBonus", label: "Buyurtma qo'shgani uchun bonus miqdori", type: "number", suffix: "UZS", default: 0 },
      { key: "firstPaymentBonus", label: "Birinchi to'lovi uchun bonus miqdori", type: "number", suffix: "UZS", default: 0 },
      { key: "oldActiveMonthlyBonus", label: "Eski aktiv o'quvchi uchun har oylik bonus miqdori", type: "number", suffix: "UZS", default: 0 },
    ],
  },
  {
    title: "JARIMA TURLARI",
    fields: [
      { key: "leftOrderPenalty", label: "Buyurtmadan ketganligi uchun jarima", type: "number", suffix: "UZS", default: 0 },
      { key: "leftUnpaidPenalty", label: "To'lov qilmasdan ketganligi uchun jarima", type: "number", suffix: "UZS", default: 0 },
      { key: "leftActivePenalty", label: "Aktivdan ketgani uchun jarima", type: "number", suffix: "UZS", default: 0 },
    ],
  },
];

// Moliya → Moliya bo'limi bonusi (?status=kpi-manager).
// Ikki xil hisoblash: to'lov summasidan foiz, yoki o'quvchi soniga qarab.
export const FINANCE_KPI_GROUPS = [
  {
    title: "FOIZGA",
    fields: [
      { key: "paymentPercent", label: "O'quvchi to'lovidan foiz", type: "number", suffix: "%", default: 0 },
      { key: "debtorPercent", label: "Balansi qarzdorlar foizda", type: "number", suffix: "%", default: 0 },
    ],
  },
  {
    title: "SONIGA",
    fields: [
      { key: "positiveBalanceRate", label: "Balansida puli borlar soniga", type: "number", suffix: "UZS", default: 0 },
      { key: "debtorRate", label: "Balansi qarzdorlar soniga", type: "number", suffix: "UZS", default: 0 },
    ],
  },
];

// Moliya → KPI (?status=kvi). Referensdagi slug "kvi" — o'zgartirmadik,
// chunki tab kaliti sifatida shu ko'rinishda ishlatiladi.
export const KPI_GROUPS = [
  {
    title: "BONUS TURLARI",
    fields: [
      { key: "bonusDisabled", label: "Bonusni o'chirish", type: "toggle", default: false },
      { key: "firstPaymentBonus", label: "Birinchi to'lovi uchun bonus miqdori", type: "number", suffix: "UZS", default: 0 },
    ],
  },
  {
    title: "JARIMA TURLARI",
    fields: [
      { key: "penaltyDisabled", label: "Jarimalarni o'chirish", type: "toggle", default: false },
      { key: "leftUnpaidPenalty", label: "To'lov qilmasdan ketganligi uchun jarima", type: "number", suffix: "UZS", default: 0 },
    ],
  },
];

// Moliya → Talabalar uchun avtochegirma (?status=payment-student).
// Bir nechta guruhga qatnaydigan o'quvchiga avtomatik chegirma.
export const STUDENT_DISCOUNT_GROUPS = [
  {
    title: "BONUS TURLARI",
    fields: [
      { key: "discountDisabled", label: "Bonusni o'chirish", type: "toggle", default: false },
      { key: "twoGroups", label: "Ikkita guruhga kelsa chegirma miqdori", type: "number", suffix: "%", default: 0 },
      { key: "threeGroups", label: "Uchta guruhga kelsa chegirma miqdori", type: "number", suffix: "%", default: 0 },
      { key: "fourGroups", label: "To'rtta guruhga kelsa", type: "number", suffix: "%", default: 0 },
    ],
  },
];

// Ilova sozlamalari → Xodim super ilovasi (?status=teacher)
export const APP_TEACHER_GROUPS = [
  {
    title: "XODIM SUPER ILOVASI",
    fields: [
      { key: "bookingLimitEnabled", label: "Yordamchi o'qituvchini band qilish limitini yoqish", type: "toggle", default: false },
      { key: "bookingPeriod", label: "Davr", type: "select", options: ["Kun", "Hafta", "Oy"], default: "Hafta" },
      { key: "bookingLimit", label: "Vaqt oralig'ida band qilishlar soni", type: "number", default: 2 },
      { key: "faceIdAttendance", label: "Mobil Face ID orqali davomat", type: "toggle", default: false },
      { key: "locationAttendance", label: "Joylashuv bo'yicha davomat", type: "toggle", default: false },
      { key: "confirmBeforeAttendance", label: "Davomat belgilashdan oldin tasdiqlash majburiy", type: "toggle", default: false },
      { key: "taskBeforeAttendance", label: "Davomatdan oldin topshiriq yaratish", type: "toggle", default: false },
      { key: "gradeBeforeTask", label: "Topshiriq yaratishdan oldin baholash", type: "toggle", default: false },
    ],
  },
];

// Ilova sozlamalari → O'quvchi super ilovasi (?status=student)
export const APP_STUDENT_GROUPS = [
  {
    title: "O'QUVCHI SUPER ILOVASI",
    fields: [
      { key: "archivedCanLogin", label: "Arxivlangan talabalar ilovaga kirishi mumkin", type: "toggle", default: false },
      { key: "canEditProfile", label: "O'quvchi o'z profilini tahrirlay olishi", type: "toggle", default: false },
      { key: "canSeeBalance", label: "O'quvchi va ota-ona o'z balansini ko'ra olishi", type: "toggle", default: false },
    ],
  },
];
