// Nazorat > Fikr-mulohaza (crm-akademiya #view-nazorat-feedback, src/app.js
// FEEDBACKS/renderFeedback()/openFbModal() ~line 28568). Sidebar: Nazorat >
// Fikr-mulohaza, href /nazorat-feedback.
export const FEEDBACKS = [
  { id: 1, filial: "Akademiya", from: "O'quvchi", name: "Sarvinoz Tursunova", phone: "+998 90 540 41 21", type: "Maqtov", izoh: "Dars qiziq, o'qituvchimiz juda professional!", createdAt: "23.05.2026 | 14:23" },
  { id: 2, filial: "Nilufar Akademiya 1", from: "Ota-ona", name: "Karim Yusupov", phone: "+998 93 123 45 67", type: "Shikoyat", izoh: "Dars vaqtidan kech boshlandi, iltimos jadval bo'yicha ishlang.", createdAt: "22.05.2026 | 18:05" },
  { id: 3, filial: "Akademiya", from: "O'quvchi", name: "Bekzodbek Obidjanov", phone: "+998 94 678 04 80", type: "Taklif", izoh: "Qo'shimcha amaliy mashg'ulotlar bo'lsa yaxshi bo'lardi.", createdAt: "22.05.2026 | 16:42" },
  { id: 4, filial: "Dilmurod Akademiya 2", from: "Ota-ona", name: "Saidova Munira", phone: "+998 99 871 02 14", type: "Maqtov", izoh: "Bolam bu yerda o'qiyotganidan juda mamnun, rahmat sizga!", createdAt: "21.05.2026 | 12:30" },
  { id: 5, filial: "Nilufar Akademiya 1", from: "Xodim", name: "Otabek Nurmatov", phone: "+998 90 333 44 55", type: "Taklif", izoh: "Yangi kompyuterlar kerak, eski 2018-yilgilar.", createdAt: "21.05.2026 | 09:15" },
  { id: 6, filial: "Akademiya", from: "O'quvchi", name: "Akmalov Sherzod", phone: "+998 93 456 10 03", type: "Shikoyat", izoh: "Internet sekin ishlayapti, online mashg'ulotlarda muammo bo'lyapti.", createdAt: "20.05.2026 | 19:48" },
  { id: 7, filial: "Akademiya", from: "Boshqa", name: "Anonim", phone: "-", type: "Boshqa", izoh: "Vending mashina qo'shing iltimos.", createdAt: "19.05.2026 | 13:22" },
  { id: 8, filial: "Dilmurod Akademiya 2", from: "O'quvchi", name: "Karimova Nilufar", phone: "+998 99 234 08 48", type: "Maqtov", izoh: "Yangi dasturlash kursi juda foydali bo'ldi!", createdAt: "18.05.2026 | 11:05" },
];

export const FB_TYPE_COLORS = {
  Shikoyat: "text-rose-700 bg-rose-100",
  Taklif: "text-blue-700 bg-blue-100",
  Maqtov: "text-emerald-700 bg-emerald-100",
  Boshqa: "text-slate-700 bg-slate-100",
};

export const FB_FILIALS = ["Akademiya", "Nilufar Akademiya 1", "Dilmurod Akademiya 2"];
export const FB_TYPES = ["Shikoyat", "Taklif", "Maqtov", "Boshqa"];
export const FB_FROM_OPTIONS = ["O'quvchi", "Ota-ona", "Xodim", "Boshqa"];
