// Moliya → To'lov turlari — butun loyihadagi YAGONA to'lov turi ro'yxati
// (Kassalar sahifasi ham shundan oladi, lib/paymentMethods.ts ga qarang).
//
// Ilgari bu faylda yana 13 ta "seed" massivi turardi: o'ylab topilgan
// hamkorlar va 3-shaxslar (ismi va telefon raqami bilan), oylik foizlariga
// biriktirilgan xodim sonlari, menejer/o'qituvchi stavkalari, sabablar,
// baholash darajalari, hashtaglar va lid ranglari. Ularning HECH BIRI hech
// qayerdan import qilinmasdi — ro'yxatlar `/api/settings-lists` orqali
// bazadan keladi. Ya'ni bu faylni o'qigan odam bazada yo'q ma'lumotni bor
// deb o'ylardi. Shuning uchun ular butunlay o'chirildi; qolgani — haqiqatan
// ishlatiladigan yagona seed.
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
