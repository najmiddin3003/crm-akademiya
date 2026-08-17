// Navbar va mobil chekma menyu BIR XIL ma'lumotdan foydalanadi — ilgari bular
// faqat Navbar.tsx ichida yopiq turgan va mobilda takrorlash kerak bo'lardi.

export const LANGUAGES = {
  uz: { flag: "🇺🇿", name: "O'zbekcha", short: "O'zb" },
  en: { flag: "🇺🇸", name: "English", short: "Eng" },
  ru: { flag: "🇷🇺", name: "Русский", short: "Рус" },
};

export const NOTIFICATIONS = [
  { title: "Yangi to'lov qabul qilindi", body: "Dilnavoz Zokirjonova — 850 000 UZS (Click)", time: "5 daqiqa oldin", type: "payment", unread: true },
  { title: "Yangi lid", body: "Bekzod Karimov telefon orqali murojaat qildi (+998 90 123 45 67)", time: "23 daqiqa oldin", type: "lead", unread: true },
  { title: "Eslatma", body: "Bugun 5 ta o'quvchining obunasi muddati tugaydi", time: "1 soat oldin", type: "reminder", unread: true },
  { title: "Yangi o'quvchi qabul qilindi", body: "Sardor To'xtayev — General English guruhiga qo'shildi", time: "2 soat oldin", type: "student" },
  { title: "Tizim yangilanishi", body: "Tug'ilgan kunlar kalendari yangi versiyasi joriy etildi", time: "Kecha", type: "system" },
];

export const NOTIF_STYLES = {
  payment: { bg: "bg-emerald-100", text: "text-emerald-600", icon: "i-credit-card" },
  lead: { bg: "bg-blue-100", text: "text-blue-600", icon: "i-megaphone" },
  student: { bg: "bg-purple-100", text: "text-purple-600", icon: "i-user-plus" },
  reminder: { bg: "bg-amber-100", text: "text-amber-600", icon: "i-bell" },
  system: { bg: "bg-slate-100", text: "text-slate-600", icon: "i-settings" },
};
