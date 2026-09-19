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
//
// `code` — navbar ro'yxatidagi ikki harfli belgi (19.09.2026 dizayni).
// Kiril uchun "ЎЗ", "UZ" EMAS: ikkala o'zbek qatori bir xil belgi bilan
// tursa ular farqlanmaydi, belgi esa o'z yozuvida tabiiy o'qiladi.
export const LANGUAGES = {
  uz: { flag: "🇺🇿", name: "O'zbekcha", short: "O'zb", code: "UZ" },
  "uz-cyrl": { flag: "🇺🇿", name: "Ўзбекча", short: "Ўзб", code: "ЎЗ" },
  en: { flag: "🇺🇸", name: "English", short: "Eng", code: "EN" },
};
