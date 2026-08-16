// Umumiy sozlamalar → Ommaviy oferta (system:public-oferta). Referens saytdan
// o'lchab olingan yorliqlar va boshlang'ich holat.
//
// Haqiqiy holat MongoDB `settings` kolleksiyasida "system.public-oferta" kaliti
// ostida saqlanadi — bu yerda faqat boshlang'ich qiymat.
//
// Uzun matnlar shu yerda turadi: ular ichida qo'shtirnoq va apostrof bor,
// JSX matni sifatida yozilsa har birini &quot;/&apos; ga aylantirishga
// to'g'ri kelardi.
export const OFERTA_TEXTS = {
  title: "Ommaviy oferta",
  description:
    "Oferta matnini bo'limlarga bo'lib joylang. Har bir bo'lim mobil ilovada alohida sarlavha va \"Tanishdim\" belgisi bilan ko'rsatiladi — o'quvchi ilovaga kirishdan oldin har bir bo'limni alohida tasdiqlaydi.",

  fileTitle: "PDF fayl (zaxira nusxa)",
  fileHint:
    "\"To'liq hujjatni ko'rish\" havolasida ko'rsatiladi. Bo'limlar bilan bir vaqtda ishlaydi.",
  fileRowLabel: "Oferta fayli",
  fileEmpty: "Fayl tanlanmagan",
  fileButton: "Almashtirish",

  sectionsTitle: "Bo'limlar",
  sectionsHint: "Har bir bo'lim mobil ilovada alohida kartochka va switch bilan chiqadi.",
  sectionsEmpty: "Hozircha bo'lim qo'shilmagan",
  addSection: "Yangi bo'lim qo'shish",

  requiredLabel: "Majburiy",
  optionalLabel: "Ixtiyoriy",

  footerNote:
    "\"Majburiy\" deb belgilangan bo'limlarning barchasi tasdiqlanmaguncha o'quvchi ilova ichiga kira olmaydi. \"Ixtiyoriy\" bo'limlar faqat o'qib chiqish uchun ko'rsatiladi.",
};

// Yangi bo'lim qo'shilganda ishlatiladigan zagotovka (id komponentda beriladi).
// Boshlang'ich holat "Majburiy" — referensdagi bo'limlarning aksariyati shunday.
export const OFERTA_NEW_SECTION = { title: "", text: "", required: true };

// Bo'limlar ro'yxati bo'sh boshlanadi — referensda ham ular qo'lda kiritiladi.
// fileName: yuklash backend'i yo'q, shu bois faqat tanlangan fayl NOMI saqlanadi.
export const OFERTA_DEFAULTS = { fileName: "", sections: [] };
