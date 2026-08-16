// Umumiy sozlamalar → Chek (system:check). Referens saytdan o'lchab olingan
// yorliqlar va boshlang'ich holatlar.
//
// Chek ikki rejimda bosiladi — "Moliya" va "Buyurtma". Har bir rejim o'z
// sozlamasini saqlaydi, shuning uchun MongoDB'dagi "system.check" hujjati
// { moliya: {...}, buyurtma: {...} } ko'rinishida bo'ladi.
export const CHECK_MODES = [
  { key: "moliya", label: "Moliya" },
  { key: "buyurtma", label: "Buyurtma" },
];

export const CHECK_LANGUAGES = ["O'zbekcha", "Ruscha", "Inglizcha"];

// Birinchi kartadagi umumiy toggllar (matn/o'lcham maydonlaridan keyin).
export const CHECK_TOGGLES = [
  { key: "autoPrint", label: "Auto Print", default: false },
  { key: "showQr", label: "QR kodini ko'rsatish", default: false },
  { key: "showGroupTime", label: "Guruh va guruh darslarini vaqtini ko'rsatish", default: true },
  { key: "showTeacher", label: "O'qituvchi ismini ko'rsatish", default: true },
  { key: "announcement", label: "E'lon", default: false },
];

// Ikkinchi karta — chekda qaysi qatorlar chop etilishi.
export const CHECK_FIELDS = [
  { key: "receiptTitle", label: "Chekning sarlavhasi", default: true },
  { key: "branchName", label: "Filial nomi", default: false },
  { key: "title", label: "Sarlavha", default: true },
  { key: "logo", label: "Logotip", default: true },
  { key: "txInfo", label: "Tranzaksiya ma'lumotlari", default: true },
  { key: "cashierName", label: "Kassir Nomi", default: false },
  { key: "cashierPhone", label: "Kassir Raqami", default: false },
  { key: "studentName", label: "O'quvchi Nomi", default: true },
  { key: "date", label: "Sana", default: true },
  { key: "cashbox", label: "Kassa", default: false },
  { key: "amount", label: "Miqdor", default: true },
  { key: "paymentType", label: "To'lov Turi", default: true },
  { key: "txType", label: "Transaktsiya Turi", default: false },
  { key: "note", label: "Izoh", default: true },
  { key: "debt", label: "Qolgan Qarzdorlik", default: false },
];

// Bitta rejimning boshlang'ich holati. Toggl defaultlari yuqoridagi
// ro'yxatlardan yig'iladi — yorliq va default bir joyda tursin.
export const CHECK_MODE_DEFAULTS = {
  // Fayl yuklash backend'i hali yo'q, shu bois faqat tanlangan fayl NOMI
  // saqlanadi (rasmning o'zi hech qayerga ketmaydi).
  logoName: "",

  titleText: "To'lov ruxsatnomasi",
  titleSize: 20,
  titleBold: true,

  footerText: "Tel: 941118855",
  footerSize: 20,
  footerBold: true,

  language: CHECK_LANGUAGES[0],

  ...Object.fromEntries(CHECK_TOGGLES.map((t) => [t.key, t.default])),

  fields: Object.fromEntries(CHECK_FIELDS.map((f) => [f.key, f.default])),
};
