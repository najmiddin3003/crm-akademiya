// Navbar va mobil chekma menyu BIR XIL ma'lumotdan foydalanadi — ilgari bular
// faqat Navbar.tsx ichida yopiq turgan va mobilda takrorlash kerak bo'lardi.
//
// BILDIRISHNOMALAR BU YERDAN OLIB TASHLANDI. Ular o'ylab topilgan besh qator
// edi (yo'q odamlar, yo'q to'lovlar) va qizil nuqta doim yonib turardi. Endi
// panel bazadan o'qiydi — app/api/notifications, uslublar esa
// constants/notifications.js da.

// Uch til (18.09.2026 qarori, lib/i18n.ts): lotin o'zbek, kiril o'zbek,
// ingliz. Nomlar O'Z TILIDA — tanlovda odam o'z tilini tanimasligi
// mumkin emas. `ru` olib tashlandi.
export const LANGUAGES = {
  uz: { flag: "🇺🇿", name: "O'zbekcha", short: "O'zb" },
  "uz-cyrl": { flag: "🇺🇿", name: "Ўзбекча", short: "Ўзб" },
  en: { flag: "🇺🇸", name: "English", short: "Eng" },
};
