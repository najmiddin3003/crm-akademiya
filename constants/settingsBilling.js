// Umumiy sozlamalar → Obuna (system:billing). Referens saytdan o'lchab olingan
// yorliqlar, tariflar va boshlang'ich holat.
//
// Haqiqiy holat MongoDB `settings` kolleksiyasida "system.billing" kaliti
// ostida saqlanadi — bu yerda faqat boshlang'ich qiymat.

// Yuqoridagi ichki tablar. Gamifikatsiya moduli hozircha yoqilmagan, shu bois
// ikkinchisi faqat xira matn ko'rsatadi.
export const BILLING_TABS = ["Obuna", "Gamifikatsiya to'lovi"];

// Sinov obunasi tugaydigan sana (dd.MM.yyyy). Xulosa kartasidagi "… gacha"
// sanasi shu sanaga tanlangan oylar qo'shib HISOBLANADI — qattiq yozilmaydi.
export const BILLING_TRIAL_UNTIL = "09.09.2026";

export const BILLING_CURRENCY = "UZS";

// months — to'lanadigan oylar, bonusMonths — sovg'a oylar (`bonus` matnining
// raqamli ko'rinishi). Tugash sanasi ikkalasining yig'indisidan chiqadi.
export const BILLING_PLANS = [
  { key: "1", months: 1, bonusMonths: 0, label: "1 oy", bonus: "", price: 1500000 },
  { key: "3", months: 3, bonusMonths: 0, label: "3 oy", bonus: "", price: 4500000 },
  { key: "6", months: 6, bonusMonths: 1, label: "6 oy", bonus: "+ 1 oy", price: 9000000 },
  { key: "12", months: 12, bonusMonths: 3, label: "12 oy", bonus: "+ 3 oy", price: 18000000 },
];

export const BILLING_TEXTS = {
  title: "Tarif va To'lovlar",
  // Sanasi BILLING_TRIAL_UNTIL bilan bir xil bo'lishi kerak.
  trialNote: "Hisobingiz 09.09.2026 yilgacha cheklovlarsiz sinov obunasida",
  studentsLabel: "O'quvchilar soni:",
  summaryTitle: "Obuna",
  untilSuffix: "gacha",
  amountLabel: "Summa",
  payButton: "To'lash",
  // To'lov shlyuzi ulanmagan — tugma faqat shu xabarni chiqaradi.
  payNote: "To'lov tizimi hali ulanmagan",
  gamificationEmpty: "Gamifikatsiya moduli yoqilmagan",
};

export const BILLING_DEFAULTS = { plan: "3", studentCount: 2000 };
