// "CRM'DAN QANDAY FOYDALANISH" — AI yordamchining bilimlar bazasi.
//
// NEGA README EMAS: README — dasturchilar jurnali. Unda server manzillari,
// skriptlar, ichki tuzoqlar bor; ularni modelga (tashqi xizmatga) berish
// keraksiz va xavfli. Bu yerda faqat FOYDALANUVCHI ko'radigan yo'llar —
// tugma nomlari interfeysdagi bilan bir xil (komponentlardan tekshirilgan).
//
// YANGI BO'LIM QO'SHISH: shu ro'yxatga yozuv qo'shish kifoya. `keywords`
// — xodim savolida uchrashi mumkin bo'lgan so'zlar (kichik harf, lotin);
// `pages` — bo'limga tegishli sahifalar (yordamchi faqat xodim ocha
// oladiganlarini ko'rsatadi). Matn interfeys tilidan qat'i nazar
// o'zbekcha: model javobni xodim tilida yozadi.

export interface HelpSection {
  id: string;
  title: string;
  keywords: readonly string[];
  pages: readonly string[];
  text: string;
}

export const HELP_SECTIONS: readonly HelpSection[] = [
  {
    id: "lead-add",
    title: "Lid qo'shish",
    keywords: ["lid", "buyurtma", "yangi lid", "mijoz", "qo'shish", "yozilish", "ariza"],
    pages: ["/orders-list"],
    text: [
      "Tepadagi «+» tugmasi → «Lid qo'shish», yoki Lidlar → Lidlar ro'yxati → «Lid qo'shish».",
      "O'quvchi ro'yxatdan tanlanadi; bazada bo'lmasa, shu oynadagi «O'quvchi qo'shish» bilan avval o'quvchi yaratiladi.",
      "Majburiy: o'quvchi, kurs va dars kunlari. Qolgan maydonlar ixtiyoriy.",
      "Lid tepadagi tanlangan filialga yoziladi va Telegram'dagi filialning «Lidlar» mavzusiga xabar ketadi.",
      "Xodimlar Telegram botidagi «Lid qo'shish» ham xuddi shu ro'yxatga yozadi.",
    ].join("\n"),
  },
  {
    id: "lead-status",
    title: "Lid holatlari va sinov darsi",
    keywords: ["holat", "status", "sinov", "birinchi dars", "rad", "bog'lanildi", "lid", "voronka"],
    pages: ["/orders-list", "/first-lessons"],
    text: [
      "Holatlar: Yangi → Bog'lanildi → Sinov darsiga yozildi → Guruhga qo'shildi. «Rad etdi» — istalgan bosqichdan (guruhga qo'shilgandan tashqari).",
      "Faqat oldinga yuriladi. Rad etilgan lid qayta «Bog'lanildi» yoki sinov darsiga o'tkazilishi mumkin.",
      "Noto'g'ri o'zgarishni 10 daqiqa ichida qaytarish mumkin, undan keyin — faqat direktor.",
      "«Sinov darsiga yozish»da sana, vaqt va o'qituvchi tanlanadi; lid «Birinchi darsga yozilganlar» sahifasida ko'rinadi.",
      "Telegram guruhidagi lid xabari ostidagi tugmalar ham holatni o'zgartiradi.",
    ].join("\n"),
  },
  {
    id: "group-add-pupil",
    title: "O'quvchini guruhga qo'shish",
    keywords: ["guruhga qo'shish", "guruh", "a'zo", "o'quvchi qo'shish", "ko'chirish"],
    pages: ["/groups", "/orders-list"],
    text: [
      "Liddan: lid kartasida «Guruhga qo'shish» → guruhni tanlang.",
      "Guruh sahifasidan: Guruh → guruhni oching → «O'quvchi qo'shish» → o'quvchi va darslar boshlangan sana.",
      "Qo'shilgan sana muhim: qarzdorlik va o'qituvchi foizi shu kundan hisoblanadi.",
    ].join("\n"),
  },
  {
    id: "payment-in",
    title: "To'lov qabul qilish (Kirim)",
    keywords: ["to'lov", "tolov", "kirim", "pul", "kassa", "qabul", "to'ladi", "naqd", "plastik"],
    pages: ["/finance-cash"],
    text: [
      "Moliya → Kassalar → kassa kartochkasidagi «Kirim» (yoki tepadagi «+» → «Kassa — to'lov qabul qilish»).",
      "O'quvchi, summa, to'lov turi (Naqd, Plastik va h.k.) va «Qaysi oy uchun» tanlanadi — to'lov shu oyga hisoblanadi; izohda boshqa oy yozilsa saqlash to'xtatiladi.",
      "Yozuv avtomatik ravishda Google Sheets'ga va Telegram'dagi to'lovlar guruhiga ketadi.",
      "Xodim faqat o'zi mas'ul kassani ko'radi; admin — hamma kassani.",
      "Xodimlar Telegram botida ham «Kirim» bor.",
    ].join("\n"),
  },
  {
    id: "payment-out",
    title: "Chiqim: avans, oylik va xarajatlar",
    keywords: ["chiqim", "xarajat", "avans", "oylik", "maosh", "qaytarish", "pul qaytarildi", "ijara"],
    pages: ["/finance-cash", "/finance-payroll"],
    text: [
      "Moliya → Kassalar → «Chiqim» → tranzaksiya turini tanlang.",
      "«Hodimga avans» / «Hodimga oylik»: xodim va «Qaysi oy uchun» tanlanadi; summa o'sha oyning oylik hisobidan ayriladi, chegara server tomonidan tekshiriladi.",
      "«O'quvchiga pul qaytarildi»: o'quvchi tanlanadi, summa u to'lagan puldan oshmaydi.",
      "Boshqa xarajatlar (ijara, kommunal va h.k.) — summa va izoh.",
      "Oyning oyligini to'liq chiqarish: Moliya → Oylik chiqarish → «Oylikni chiqarish».",
    ].join("\n"),
  },
  {
    id: "transfer",
    title: "Kassalar orasida pul ko'chirish",
    keywords: ["ko'chirish", "o'tkazish", "topshirish", "kassa", "transfer"],
    pages: ["/finance-cash"],
    text: [
      "Kassa kartochkasi → «Ko'chirish»: boshqa kassaga yoki o'sha kassadagi to'lov turlari orasida.",
      "Boshqa kassaga jo'natilgan pul qabul qiluvchi tasdiqlaguncha jo'natuvchi kassada turadi.",
    ].join("\n"),
  },
  {
    id: "payment-cancel",
    title: "To'lovni bekor qilish",
    keywords: ["bekor", "xato to'lov", "o'chirish", "qaytarish", "noto'g'ri"],
    pages: ["/finance-cash"],
    text: [
      "Kassalar sahifasidagi jadvaldan yozuvni ochib bekor qilinadi — faqat web'da, botda bekor qilish yo'q.",
      "Bekor qilingan to'lov balans va hisobotlardan chiqadi, Telegram'ga «BEKOR QILINDI» xabari ketadi.",
    ].join("\n"),
  },
  {
    id: "attendance",
    title: "Davomat qilish",
    keywords: ["davomat", "keldi", "kelmadi", "sababli", "sababsiz", "baho", "yo'qlama"],
    pages: ["/groups", "/nazorat-davomat", "/nazorat-missed-groups"],
    text: [
      "Guruh → guruhni oching → «Davomat» tabi: dars kuni katakchasida holat — Keldi, Kechikdi, Birinchi dars, Sababli, Sababsiz; 1–5 baho.",
      "«Sababli» tanlansa sabab va izoh so'raladi.",
      "Bugun darsi bo'lib davomat qilinmagan guruh ro'yxatda sariq ko'rinadi; to'liq ro'yxat — Nazorat → «Davomat qilinmagan guruhlar».",
      "Gamifikatsiya yoqilgan bo'lsa, o'qituvchi faqat o'z guruhini va faqat dars kuni belgilaydi.",
    ].join("\n"),
  },
  {
    id: "debtors",
    title: "Qarzdorlik qanday hisoblanadi",
    keywords: ["qarz", "qarzdor", "to'lamagan", "qoldiq", "balans", "dars narxi"],
    pages: ["/reports-unpaid", "/offline-courses"],
    text: [
      "Hisobotlar → «Qarzdor o'quvchilar».",
      "Qarz = guruh jadvali bo'yicha o'tgan darslar × bitta dars narxi − to'langan pul.",
      "Bitta dars narxi = oylik kurs narxi ÷ oydagi darslar (haftasiga 3 kun → 13 dars).",
      "Kurs narxi O'quv bo'limi → Oflayn kurslarda filial bo'yicha kiritiladi; narxi yo'q guruh hisobotda alohida ko'rsatiladi.",
    ].join("\n"),
  },
  {
    id: "employee-add",
    title: "Xodim qo'shish",
    keywords: ["xodim", "o'qituvchi", "ishchi", "hodim", "qo'shish", "taklif", "sms"],
    pages: ["/management-xodimlar"],
    text: [
      "Boshqaruv → Xodimlar → «Xodim qo'shish»: ism-familiya, telefon, vazifa; filial qatorlarida rol, ish jadvali va ish haqi.",
      "O'qituvchi uchun foiz, daraja va kurslar ham tanlanadi.",
      "Xodimga SMS bilan faollashtirish havolasi va kod boradi; u parol qo'yib tizimga kiradi.",
      "Ikki bosqichli kirish yoqilgan bo'lsa, admin xodimni tasdiqlagandan keyin kiradi.",
    ].join("\n"),
  },
  {
    id: "roles",
    title: "Rollar va ruxsatlar",
    keywords: ["rol", "ruxsat", "huquq", "ko'rinadigan bo'limlar", "cheklash", "dostup"],
    pages: ["/management-rollar"],
    text: [
      "Boshqaruv → Rollar: har rol uchun «Ko'rinadigan bo'limlar» belgilanadi; ro'yxat berilmagan rol cheklovsiz.",
      "Xodimga alohida ro'yxat berilsa, u lavozim sozlamasidan ustun turadi.",
      "Admin hisobi doim cheklovsiz. AI yordamchi ham shu ruxsatlarga bo'ysunadi.",
    ].join("\n"),
  },
  {
    id: "branch",
    title: "Filial tanlash",
    keywords: ["filial", "branch", "almashtirish", "boshqa filial"],
    pages: [],
    text: [
      "Tepadagi filial tanlagichi: o'quvchilar, guruhlar, davomat, lidlar va oylik tanlangan filial bo'yicha ko'rsatiladi; sozlamalar umumiy.",
      "Chortoqdagi 1 va 2-filial o'quvchilari umumiy.",
      "Xodim faqat o'ziga biriktirilgan filiallarni tanlay oladi.",
    ].join("\n"),
  },
  {
    id: "security",
    title: "Parol, qurilmalar va ekranni qulflash",
    keywords: ["parol", "xavfsizlik", "qurilma", "qulflash", "chiqish", "sessiya"],
    pages: ["/settings-security", "/settings-devices"],
    text: [
      "Sozlamalar → Xavfsizlik: «Parolni o'zgartirish» va «Ekranni qulflash».",
      "Aktiv qurilmalar: qaysi qurilmalardan kirilgani va ularni uzish.",
    ].join("\n"),
  },
  {
    id: "tasks",
    title: "Topshiriqlar",
    keywords: ["topshiriq", "vazifa", "bajardim", "muddat", "task"],
    pages: ["/tasks"],
    text: [
      "Topshiriqlar sahifasida har bir xodim o'z topshiriqlarini ko'radi va bajargach «Bajardim» bosadi.",
      "Ruxsati bor rahbar topshiriq beradi, muddat qo'yadi va bajarilganini tasdiqlaydi.",
    ].join("\n"),
  },
  {
    id: "checkin",
    title: "Ishga keldim (QR)",
    keywords: ["ishga keldim", "qr", "keldi-ketdi", "kechikish", "xodim davomati"],
    pages: ["/nazorat-qr"],
    text: [
      "Filial ekranidagi QR kod (Nazorat → «Ishga keldim (QR)») Telegram botdagi skaner bilan o'qitiladi.",
      "Joylashuv tekshiriladi; kechikish haqida guruhga xabar ketadi.",
    ].join("\n"),
  },
  {
    id: "staff-bot",
    title: "Xodimlar uchun Telegram bot",
    keywords: ["telegram", "bot", "xodim boti", "kassam", "profilim"],
    pages: [],
    text: [
      "@tizimli_akademiya_bot → /xodim → telefon raqami va CRM paroli bilan kirish.",
      "Menyuda: Kirim, Chiqim, Ko'chirish, Lid qo'shish, Kassam, «Profilim», «Ishga keldim»; o'qituvchi menyusida kassa va lid bo'limlari yo'q.",
      "Yozuvlar web'dagi kassaga tushadi; bekor qilish va o'tgan sana bilan yozish — faqat web'da.",
    ].join("\n"),
  },
  {
    id: "gamification",
    title: "Gamifikatsiya (tangalar)",
    keywords: ["tanga", "coin", "gamifikatsiya", "reyting", "do'kon", "sovg'a", "musobaqa"],
    pages: ["/gamification-lesson", "/gamification-ranking", "/gamification-shop", "/settings-gamification"],
    text: [
      "Gamifikatsiya → «Tanga berish»: darsda o'quvchilarga sabab bo'yicha tanga berish yoki ayirish.",
      "Reyting, O'quvchilar, Guruhlar musobaqasi va Do'kon sahifalari ham shu bo'limda.",
      "Modulni direktor Sozlamalar → Gamifikatsiya → Umumiy da yoqadi; o'chiq paytda hech narsa yozilmaydi.",
    ].join("\n"),
  },
  {
    id: "exams",
    title: "Imtihon natijalari",
    keywords: ["imtihon", "sarhisob", "uzbmb", "test", "natija"],
    pages: ["/imtihon"],
    text: "Imtihon → Sarhisob: guruh bo'yicha imtihon natijalari kiritiladi va ko'riladi; UzBMB — alohida tab.",
  },
  {
    id: "assistant",
    title: "AI yordamchi haqida",
    keywords: [
      "yordamchi",
      "ai",
      "sun'iy intellekt",
      "limit",
      "nima qila olasan",
      "qoralama",
      "tasdiqlash",
      "model",
      "tezlik",
      "kichraytirish",
      "to'liq ekran",
    ],
    pages: [],
    text: [
      "Faqat sizga ruxsat berilgan bo'limlar bo'yicha javob beradi: qarzdorlar, tushum va xarajat, kassalar, guruhlar, lidlar, oylik, o'quvchi kartasi, o'quvchilar va xodimlar davomati, topshiriqlar, sotuv voronkasi.",
      "Administrator amallarni yoqqan bo'lsa (Sozlamalar → Ilova sozlamalari → AI yordamchi → «Amallarga ruxsat berish»), lid qo'shish, kirim, chiqim, boshqa kassaga ko'chirish, o'quvchiga izoh va xodimga topshiriq QORALAMASINI tayyorlaydi: panelda karta chiqadi, yozuv faqat «Tasdiqlash» bosilganda saqlanadi. «Bekor qilish» — hech narsa yozilmaydi. Qoralama 15 daqiqa amal qiladi.",
      "Amallar o'chiq bo'lsa yoki boshqa ishlar uchun — CRM'da qanday bajarishni tushuntiradi va sahifaga havola beradi. Mavjud yozuvni o'zgartirmaydi va o'chirmaydi.",
      "Model va tezlik: yozish maydonidagi model nomi tugmasini bosing — ro'yxatdan model (masalan GPT-6 Sol, GPT-6 Luna) va «Tezlik» surgichini (Tezkor, Tez, O'rtacha, Chuqur) tanlang. Tezroq — tez va arzon javob, chuqurroq — murakkab savolda aniqroq, lekin sekinroq. Tanlov shu qurilmada eslab qolinadi. Qaysi modellar ko'rinishini administrator belgilaydi (Sozlamalar → Ilova sozlamalari → AI yordamchi → «Modellar»).",
      "Oyna: robot bosilganda AI to'liq ekranda ochiladi. AI ish boshlasa (ma'lumot oladi, qoralama tuzadi) oyna o'zi kichrayadi va CRM'da o'sha ishning sahifasini ochadi, ish davomida ekran chetida nur yonadi. Kichik oynani sarlavhasidan sudrab istalgan joyga qo'yish, «To'liq ekran» tugmasi bilan kattalashtirish mumkin. Sahifa o'zi ochilmasin desangiz — sarlavhadagi ekran belgili tugmani o'chiring.",
      "Kunlik savollar soni cheklangan; telefon raqamlari AI xizmatiga yuborilmaydi.",
    ].join("\n"),
  },
];

/** Kichik harf, apostrof turlari bitta (o‘/o'/oʻ), tinish belgilarsiz. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’ʻʼ`´]/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Savolga eng mos bo'limlar (kalit so'zlar va sarlavha bo'yicha). */
export function findHelpSections(topic: string, max = 3): HelpSection[] {
  const q = ` ${normalizeText(topic)} `;
  const scored = HELP_SECTIONS.map((s) => {
    let score = 0;
    for (const k of s.keywords) if (q.includes(normalizeText(k))) score += k.includes(" ") ? 3 : 2;
    for (const w of normalizeText(s.title).split(" ")) if (w.length > 3 && q.includes(` ${w}`)) score += 1;
    return { s, score };
  });
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.s);
}
