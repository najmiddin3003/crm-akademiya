// Moliya → Tranzaksiya turi. Manba skrinshotidagi 4 tab (Kirim/Chiqim/
// Voucher/Jarima) ro'yxati. Voucher/Jarima tab'laridagi yozuvlar "Kategoriyasi"
// belgisi "Kirim" bo'lib ko'rsatilgan — mainType (qaysi tabda ko'rinishi)
// va category (belgi) mustaqil maydonlar, manba shu holatni aynan aks ettiradi.
export const MAIN_TYPES = [
  { key: "kirim", label: "Kirim" },
  { key: "chiqim", label: "Chiqim" },
  // Yorliq referensdagidek "Vaucher" (inglizcha "Voucher" emas) — kalit
  // o'zgarmaydi, chunki saqlangan yozuvlar shu kalitga bog'langan.
  { key: "voucher", label: "Vaucher" },
  { key: "jarima", label: "Jarima" },
];

export const CUSTOMER_TYPES = ["Boshqa", "O'quvchilar", "Xodim", "Uchinchi shaxs"];
export const CATEGORY_OPTIONS = ["Kirim", "Chiqim"];

function row(id, name, mainType, category) {
  return { id, name, minAmount: 0, maxAmount: 0, customerType: "Boshqa", mainType, category };
}

export const TRANSACTION_TYPE_SEED = [
  row(1, "O'quvchi to'ladi", "kirim", "Kirim"),
  row(2, "Kitob", "kirim", "Kirim"),
  row(3, "Oylik imtihon", "kirim", "Kirim"),
  row(4, "Olimpiada", "kirim", "Kirim"),
  row(5, "Boshqa", "kirim", "Kirim"),
  row(28, "Sarmoya", "kirim", "Kirim"),

  row(6, "Hodimga avans", "chiqim", "Chiqim"),
  row(7, "Hodimga oylik", "chiqim", "Chiqim"),
  row(8, "Marker", "chiqim", "Chiqim"),
  row(9, "Internet va telefon", "chiqim", "Chiqim"),
  row(10, "List", "chiqim", "Chiqim"),
  row(11, "Printer", "chiqim", "Chiqim"),
  row(12, "Tozalov", "chiqim", "Chiqim"),
  row(13, "Suv", "chiqim", "Chiqim"),
  row(14, "Elektr", "chiqim", "Chiqim"),
  row(15, "Xo'jalik ishlari", "chiqim", "Chiqim"),
  row(16, "O'quvchiga pul qaytarildi", "chiqim", "Chiqim"),
  row(17, "Kitob", "chiqim", "Chiqim"),
  row(18, "Daftar", "chiqim", "Chiqim"),
  row(19, "Arenda", "chiqim", "Chiqim"),
  row(20, "Konselariya", "chiqim", "Chiqim"),
  row(21, "Soliq", "chiqim", "Chiqim"),
  row(22, "Boshqa", "chiqim", "Chiqim"),
  row(23, "Eskiz SMS xizmat", "chiqim", "Chiqim"),
  row(27, "Divident", "chiqim", "Chiqim"),

  row(24, "O'quv markaz hisobidan", "voucher", "Kirim"),
  row(25, "Xodimga bonus", "voucher", "Kirim"),

  row(26, "Jarima", "jarima", "Kirim"),
];
