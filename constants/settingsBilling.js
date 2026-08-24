// Umumiy sozlamalar → Obuna (system:billing). Referens saytdan o'lchab olingan
// yorliqlar, tariflar va boshlang'ich holat.
//
// Haqiqiy holat MongoDB `settings` kolleksiyasida "system.billing" kaliti
// ostida saqlanadi — bu yerda faqat boshlang'ich qiymat.

// Yuqoridagi ichki tablar. Gamifikatsiya moduli hozircha yoqilmagan, shu bois
// ikkinchisi faqat xira matn ko'rsatadi.
export const BILLING_TABS = ["Obuna", "Gamifikatsiya to'lovi"];

// OBUNA MUDDATI SHU YERDA YO'Q — va ataylab yo'q.
//
// Ilgari bu yerda `BILLING_TRIAL_UNTIL = "09.09.2026"` turardi. Bu — har bir
// akkauntga xos fakt, lekin uning sxemada MANBASI yo'q: bazada obuna/sinov
// muddati saqlanadigan kolleksiya ham, maydon ham mavjud emas. Ya'ni sana
// shunchaki qo'lda yozib qo'yilgan edi va sahifa uni ikki joyda HAQIQAT
// sifatida ko'rsatardi: "Hisobingiz 09.09.2026 yilgacha … sinov obunasida"
// matnida hamda xulosa kartasidagi "… gacha" sanasida (unga tanlangan oylar
// qo'shib hisoblanardi — soxta sanadan hisoblangan sana ham soxta).
// Manba paydo bo'lguncha muddat "—" bo'lib turadi.

export const BILLING_CURRENCY = "UZS";

// months — to'lanadigan oylar, bonusMonths — sovg'a oylar (`bonus` matnining
// raqamli ko'rinishi). Bular tarifning o'z xossasi, shu bois qoldirilgan;
// lekin ulardan tugash SANASI hisoblanmaydi — sanash uchun boshlang'ich sana
// kerak, u esa bazada yo'q (yuqoridagi izohga qarang).
export const BILLING_PLANS = [
  { key: "1", months: 1, bonusMonths: 0, label: "1 oy", bonus: "", price: 1500000 },
  { key: "3", months: 3, bonusMonths: 0, label: "3 oy", bonus: "", price: 4500000 },
  { key: "6", months: 6, bonusMonths: 1, label: "6 oy", bonus: "+ 1 oy", price: 9000000 },
  { key: "12", months: 12, bonusMonths: 3, label: "12 oy", bonus: "+ 3 oy", price: 18000000 },
];

export const BILLING_TEXTS = {
  title: "Tarif va To'lovlar",
  // Ilgari bu satr "Hisobingiz 09.09.2026 yilgacha cheklovlarsiz sinov
  // obunasida" deb yozilgan sanani da'vo qilardi. Endi hech qanday sana yoki
  // holat da'vo qilinmaydi — faqat muddat tizimda saqlanmasligi aytiladi.
  trialNote: "Obuna muddati bu tizimda saqlanmaydi — tugash sanasini o'quv markaz administratoridan bilib oling",
  studentsLabel: "O'quvchilar soni:",
  summaryTitle: "Obuna",
  // Amaldagi muddat noma'lum: hisoblab chiqaradigan boshlang'ich sana yo'q.
  untilUnknown: "Amal qilish muddati: —",
  amountLabel: "Summa",
  payButton: "To'lash",
  // To'lov shlyuzi (Click/Payme va h.k.) ulanmagan: tugma hech qanday
  // tranzaksiya yaratmaydi. Ilgari bu matn YASHIL "muvaffaqiyat" toastida
  // chiqardi — ya'ni muvaffaqiyatsizlik muvaffaqiyat qilib ko'rsatilardi.
  // Endi xato uslubida chiqadi (BillingTab.tsx → showError).
  payNote: "To'lov tizimi ulanmagan — to'lov amalga oshmadi",
  gamificationEmpty: "Gamifikatsiya moduli yoqilmagan",
};

// Saqlanadigan yagona qiymat — tanlangan tarif.
//
// Ilgari bu yerda `studentCount: 2000` ham turardi va sahifa "O'quvchilar
// soni: 2000" deb ko'rsatib, tarifni shu songa nisbatan chiqarardi. 2000 —
// hech qayerdan olinmagan, o'ylab topilgan son edi. Endi o'quvchilar soni
// /api/pupils dan sanaladi (BillingTab.tsx), shuning uchun uni sozlamada
// saqlashning ma'nosi yo'q — saqlangani eskirgan nusxa bo'lib qolardi.
export const BILLING_DEFAULTS = { plan: "3" };
