// Sozlamalar → Sotuv va marketing → Bot eslatmalari.
// Telegram bot yuboradigan eslatma shablonlari konstruktori uchun
// referens saytdan olingan ro'yxatlar va boshlang'ich shablonlar.
//
// Haqiqiy holat MongoDB `settings` kolleksiyasida "sale-marketing.bot-notes"
// kaliti ostida saqlanadi — bu yerda faqat boshlang'ich qiymat.

// Shablon turi: eslatma dars jadvaliga nisbatan qachon yuborilishini bildiradi.
export const BOT_NOTE_TYPES = [
  "Dars boshlanishidan oldin",
  "Dars davomida",
  "Darsdan tugagandan keyin",
];

// Xabar matniga qo'yiladigan o'rinbosarlar — yuborish paytida guruh
// ma'lumotlari bilan almashtiriladi.
export const BOT_NOTE_VARIABLES = [
  "{groupName}",
  "{teacherName}",
  "{courseName}",
  "{days}",
  "{hours}",
  "{branchName}",
  "{subCourseName}",
];

// Referensda turgan uchta shablon. Matni ko'rinmagani uchun bo'sh —
// foydalanuvchi o'zi to'ldiradi.
export const BOT_NOTE_DEFAULTS = {
  templates: [
    { id: "bn-1", name: "Oldin - 10 daqiqa", type: "Dars boshlanishidan oldin", minutes: 10, text: "", active: true },
    { id: "bn-2", name: "Keyin - 1 daqiqa", type: "Darsdan tugagandan keyin", minutes: 1, text: "", active: true },
    { id: "bn-3", name: "davomida - 60 daqiqa", type: "Dars davomida", minutes: 60, text: "", active: true },
  ],
};
