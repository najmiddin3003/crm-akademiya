// Sozlamalar bo'limining to'liq xaritasi.
//
// Referens saytdan (akademiya.edutizim.uz) olingan: bo'lim/tab slug'lari
// ilovaning o'z konfiguratsiya bandlidan (assets/tabItems-*.js), o'zbekcha
// nomlar esa rasmiy tarjima faylidan (/locales/uz/translation.json) —
// ya'ni taxmin emas, aniq qiymatlar.
//
// Referensda route: /settings/<section>?status=<tab>
// Bu loyihada sidebar yassi havolalardan iborat, shuning uchun har bo'lim
// o'z route'iga ega (`href`), tab esa ?tab= query orqali.

export const SETTINGS_SECTIONS = [
  {
    key: "system",
    href: "/settings-general",
    label: "Umumiy sozlamalar",
    tabs: [
      { key: "general", label: "Funksionallik" },
      { key: "check", label: "Chek" },
      { key: "billing", label: "Obuna" },
      { key: "holidays", label: "Bayram kunlari" },
      { key: "public-oferta", label: "Ommaviy oferta" },
      { key: "user-filter-settings", label: "Foydalanuvchi sozlamalari" },
    ],
  },
  {
    key: "finance",
    href: "/settings-finance",
    label: "Moliya",
    tabs: [
      { key: "partners", label: "Hamkorlar" },
      { key: "third-persons", label: "3 - shaxs" },
      { key: "payment-methods", label: "To'lov turlari" },
      { key: "payment-manager", label: "Menejer bonuslarini belgilash" },
      { key: "kpi-manager", label: "Moliya bo'limi bonusi" },
      { key: "kvi", label: "KPI" },
      { key: "monthly", label: "Oylik foizlari" },
      { key: "tax", label: "Soliq" },
      { key: "payment-student", label: "Talabalar uchun avtochegirma" },
    ],
  },
  {
    key: "study",
    href: "/settings-academic",
    label: "O'quv",
    tabs: [
      { key: "reasons", label: "Sabablar" },
      { key: "activities", label: "Qo'shimcha mashg'ulotlar" },
      { key: "student-essessment-level", label: "O'quvchini baholash darajalari" },
    ],
  },
  {
    key: "sale-marketing",
    href: "/settings-sales",
    label: "Sotuv va marketing",
    tabs: [
      { key: "color-list", label: "Telefon raqamini belgilash turlari" },
      { key: "hashtag", label: "Hashtag" },
      { key: "category", label: "O'quvchilar turlari" },
      { key: "field", label: "So'raladigan bo'limlar" },
      { key: "auto-sms", label: "Avto sms" },
      { key: "bot-notes", label: "Bot eslatmalari" },
      { key: "sms-device", label: "SMS qurilmalar" },
    ],
  },
  {
    key: "management",
    href: "/settings-management",
    label: "Boshqaruv",
    tabs: [
      { key: "degrees-manager", label: "Menejer grading tizimi" },
      { key: "degrees-teacher", label: "O'qituvchilar grading tizimi" },
    ],
  },
  {
    key: "integration",
    href: "/settings-integrations",
    label: "Integratsiyalar",
    // Integratsiyalar chap panelsiz — alohida "marketplace" ko'rinishi.
    tabs: [],
  },
  {
    key: "app-settings",
    href: "/settings-app",
    label: "Ilova sozlamalari",
    tabs: [
      { key: "content", label: "Kontent" },
      { key: "teacher", label: "Xodim super ilovasi" },
      { key: "student", label: "O'quvchi super ilovasi" },
    ],
  },
  {
    key: "gamification",
    href: "/settings-gamification",
    label: "Gamifikatsiya",
    tabs: [
      { key: "general", label: "Funksionallik" },
      { key: "auto-coin", label: "Auto coin" },
    ],
  },
];
