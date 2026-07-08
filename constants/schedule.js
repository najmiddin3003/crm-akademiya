// Dars jadvali (view-schedule) uchun demo ma'lumotlar — crm-akademiya/src/app.js
// dan 1:1 ko'chirilgan (STATS_CONFIG, STATS, ROOMS, TIME_SLOTS, SCHEDULE_DATA ...).
// Backend yo'q — statik seed sifatida saqlanadi.

export const STATS_CONFIG = [
  { key: "buyurtma", label: "Buyurtma", icon: "i-user-plus", bg: "bg-emerald-500" },
  { key: "birinchi_darsga", label: "Birinchi darsga keladiganlar", icon: "i-user-check", bg: "bg-blue-500" },
  { key: "yangi_oquvchi", label: "Yangi o'quvchi", icon: "i-user", bg: "bg-purple-500" },
  { key: "aktiv", label: "Aktiv o'quvchilar", icon: "i-user-star", bg: "bg-green-500" },
  { key: "buyurtmadan_ketgan", label: "Buyurtmadan ketganlar", icon: "i-x-circle", bg: "bg-red-500" },
  { key: "yangi_ketgan", label: "Yangi o'quvchidan ketganlar", icon: "i-user-minus", bg: "bg-red-500" },
  { key: "aktiv_ketgan", label: "Aktiv o'quvchidan ketganlar", icon: "i-user-off", bg: "bg-rose-500" },
  { key: "qarzdor", label: "Qarzdor", icon: "i-wallet", bg: "bg-slate-900" },
  { key: "guruhlar", label: "Guruhlar", icon: "i-users-group", bg: "bg-blue-500" },
  { key: "birinchi_tolov", label: "Birinchi to'lovni qilganlar", icon: "i-dollar-sign", bg: "bg-amber-500" },
  { key: "muzlatilgan", label: "Muzlatilgan", icon: "i-snowflake", bg: "bg-cyan-500" },
  { key: "arxiv", label: "Arxiv", icon: "i-archive", bg: "bg-slate-400" },
];

export const STATS = {
  buyurtma: 502, birinchi_darsga: 1411, yangi_oquvchi: 74, aktiv: 972,
  buyurtmadan_ketgan: 0, yangi_ketgan: 2, aktiv_ketgan: 2, qarzdor: 134,
  guruhlar: 89, birinchi_tolov: 4, muzlatilgan: 0, arxiv: 4,
};

export const ROOMS = ["201", "202", "203", "204", "205", "206", "207", "208"];

export const TIME_SLOTS = [
  "13:00 - 13:30", "13:30 - 14:00", "14:00 - 14:30", "14:30 - 15:00",
  "15:00 - 15:30", "15:30 - 16:00", "16:00 - 16:30", "16:30 - 17:00",
  "17:00 - 17:30", "17:30 - 18:00", "18:00 - 18:30", "18:30 - 19:00",
];

export const SCH_DAY_ORDER = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];
export const SCH_DAY_LABELS = ["Yak", "Du", "Se", "Cho", "Pa", "Ju", "Sha"];
export const SCH_DAY_LONG = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

export const STATUSES = [
  { value: "aktiv", label: "Aktiv" },
  { value: "pauza", label: "Pauza" },
  { value: "yakunlangan", label: "Yakunlangan" },
  { value: "rejalashtirilgan", label: "Rejalashtirilgan" },
];

const LESSON_COURSE_NAMES = ["IELTS", "General English", "Multilevel", "Speaking Club", "Beginner A1", "Pre-Intermediate"];

// Har bir dars: { room: 0-7 (ustun), startSlot: 0-11, slots: rowspan, color, groupNum, teacher, book, ppl, extra }
export const SCHEDULE_DATA = {
  yakshanba: [
    { room: 0, startSlot: 4, slots: 3, color: "#10b981", groupNum: 12, teacher: "Aziza Karimova", book: "45/60", ppl: "8/25", extra: 1 },
    { room: 3, startSlot: 4, slots: 3, color: "#3b82f6", groupNum: 28, teacher: "Bekzod Rahimov", book: "67/90", ppl: "12/30", extra: 0 },
    { room: 5, startSlot: 8, slots: 3, color: "#f59e0b", groupNum: 41, teacher: "Nodira Yusupova", book: "88/100", ppl: "15/35", extra: 2 },
  ],
  dushanba: [
    { room: 0, startSlot: 0, slots: 3, color: "#3b82f6", groupNum: 14, teacher: "Aziz Karimov", book: "78/90", ppl: "12/30", extra: 2 },
    { room: 2, startSlot: 0, slots: 3, color: "#10b981", groupNum: 27, teacher: "Nodira Yusupova", book: "56/80", ppl: "15/30", extra: 0 },
    { room: 4, startSlot: 2, slots: 3, color: "#e11d48", groupNum: 43, teacher: "Bekzod Rahimov", book: "100/120", ppl: "20/35", extra: 1 },
    { room: 1, startSlot: 6, slots: 4, color: "#1e293b", groupNum: 78, teacher: "Madina Soliyeva", book: "85/100", ppl: "14/35", extra: 0 },
    { room: 3, startSlot: 6, slots: 4, color: "#06b6d4", groupNum: 92, teacher: "Lola Karimova", book: "110/130", ppl: "22/35", extra: 1 },
    { room: 6, startSlot: 6, slots: 4, color: "#8b5cf6", groupNum: 102, teacher: "Sherzod Rahimov", book: "93/120", ppl: "18/35", extra: 0 },
  ],
  seshanba: [
    { room: 1, startSlot: 2, slots: 3, color: "#10b981", groupNum: 19, teacher: "Dilfuza Mahmudova", book: "52/75", ppl: "11/30", extra: 1 },
    { room: 4, startSlot: 2, slots: 3, color: "#e11d48", groupNum: 33, teacher: "Anvar Saidov", book: "88/110", ppl: "18/35", extra: 0 },
    { room: 7, startSlot: 4, slots: 3, color: "#f97316", groupNum: 47, teacher: "Kamola Yusupova", book: "70/95", ppl: "14/30", extra: 2 },
    { room: 0, startSlot: 8, slots: 3, color: "#06b6d4", groupNum: 61, teacher: "Rustam Olimov", book: "105/130", ppl: "21/35", extra: 0 },
    { room: 5, startSlot: 8, slots: 3, color: "#8b5cf6", groupNum: 84, teacher: "Zilola Rahimjanova", book: "92/120", ppl: "17/35", extra: 1 },
  ],
  chorshanba: [
    { room: 0, startSlot: 0, slots: 4, color: "#3b82f6", groupNum: 22, teacher: "Aziz Karimov", book: "99/120", ppl: "16/30", extra: 2 },
    { room: 3, startSlot: 0, slots: 4, color: "#10b981", groupNum: 36, teacher: "Nodira Yusupova", book: "65/85", ppl: "13/30", extra: 0 },
    { room: 6, startSlot: 4, slots: 3, color: "#e11d48", groupNum: 54, teacher: "Bekzod Rahimov", book: "115/140", ppl: "24/35", extra: 1 },
    { room: 2, startSlot: 8, slots: 3, color: "#1e293b", groupNum: 81, teacher: "Madina Soliyeva", book: "88/110", ppl: "15/35", extra: 0 },
    { room: 5, startSlot: 8, slots: 3, color: "#f59e0b", groupNum: 95, teacher: "Lola Karimova", book: "120/145", ppl: "23/35", extra: 1 },
  ],
  payshanba: [
    { room: 0, startSlot: 2, slots: 3, color: "#dc2626", groupNum: 999, teacher: "Aziz Karimov", book: "DEMO", ppl: "5/10", extra: 0 },
    { room: 0, startSlot: 3, slots: 2, color: "#7c3aed", groupNum: 888, teacher: "Nargiza Tursunova", book: "DEMO", ppl: "6/15", extra: 0 },
    { room: 1, startSlot: 2, slots: 3, color: "#e11d48", groupNum: 50, teacher: "Sevinch Madaminova", book: "26/27", ppl: "15/35", extra: 2 },
    { room: 2, startSlot: 2, slots: 3, color: "#e11d48", groupNum: 45, teacher: "Mashxura Kutupova", book: "93/174", ppl: "10/35", extra: 0 },
    { room: 4, startSlot: 2, slots: 3, color: "#06b6d4", groupNum: 33, teacher: "Nodira Teshaboyeva", book: "93/145", ppl: "9/35", extra: 1 },
    { room: 5, startSlot: 2, slots: 3, color: "#e11d48", groupNum: 60, teacher: "Nozima Ziyomiddinova", book: "92/146", ppl: "10/35", extra: 0 },
    { room: 6, startSlot: 2, slots: 3, color: "#64748b", groupNum: 69, teacher: "Durdona Yoldasheva", book: "93/144", ppl: "15/35", extra: 3 },
    { room: 7, startSlot: 2, slots: 3, color: "#e11d48", groupNum: 88, teacher: "Jasurbek O'rinboyev", book: "103/148", ppl: "18/35" },
    { room: 0, startSlot: 6, slots: 4, color: "#e11d48", groupNum: 90, teacher: "Nozima Ziyomiddinova", book: "93/174", ppl: "5/35", extra: 0 },
    { room: 1, startSlot: 6, slots: 4, color: "#1e293b", groupNum: 47, teacher: "Sevinch Madaminova", book: "23/144", ppl: "0/35", extra: 0 },
    { room: 2, startSlot: 6, slots: 4, color: "#e11d48", groupNum: 49, teacher: "Mashxura Kutupova", book: "93/144", ppl: "26/35", extra: 1 },
    { room: 3, startSlot: 6, slots: 4, color: "#16a34a", groupNum: 68, teacher: "Gulnoza Abdurahimova", book: "94/174", ppl: "8/35", extra: 1 },
    { room: 4, startSlot: 6, slots: 4, color: "#e11d48", groupNum: 56, teacher: "Shohsanam Dadaxojayeva", book: "93/174", ppl: "10/35", extra: 1 },
    { room: 5, startSlot: 6, slots: 4, color: "#1e293b", groupNum: 104, teacher: "Ilhomjon Sharabidinov", book: "0/0", ppl: "11/35", extra: 1 },
    { room: 6, startSlot: 6, slots: 4, color: "#64748b", groupNum: 70, teacher: "Durdona Yoldasheva", book: "93/145", ppl: "11/35", extra: 1 },
    { room: 7, startSlot: 6, slots: 4, color: "#e11d48", groupNum: 6, teacher: "Jasurbek O'rinboyev", book: "93/174", ppl: "11/35" },
  ],
  juma: [
    { room: 0, startSlot: 0, slots: 3, color: "#10b981", groupNum: 31, teacher: "Aziza Karimova", book: "67/85", ppl: "13/30", extra: 1 },
    { room: 2, startSlot: 0, slots: 3, color: "#3b82f6", groupNum: 48, teacher: "Bekzod Rahimov", book: "82/105", ppl: "17/35", extra: 0 },
    { room: 5, startSlot: 4, slots: 4, color: "#e11d48", groupNum: 72, teacher: "Madina Soliyeva", book: "95/120", ppl: "20/35", extra: 2 },
    { room: 7, startSlot: 4, slots: 4, color: "#f59e0b", groupNum: 86, teacher: "Lola Karimova", book: "110/135", ppl: "22/35", extra: 1 },
    { room: 1, startSlot: 8, slots: 3, color: "#06b6d4", groupNum: 99, teacher: "Sherzod Rahimov", book: "88/110", ppl: "16/35", extra: 0 },
    { room: 3, startSlot: 8, slots: 3, color: "#8b5cf6", groupNum: 113, teacher: "Rustam Olimov", book: "125/150", ppl: "25/35", extra: 1 },
  ],
  shanba: [
    { room: 1, startSlot: 0, slots: 4, color: "#16a34a", groupNum: 25, teacher: "Nodira Yusupova", book: "58/75", ppl: "12/30", extra: 1 },
    { room: 4, startSlot: 0, slots: 4, color: "#1e293b", groupNum: 39, teacher: "Madina Soliyeva", book: "72/95", ppl: "15/35", extra: 0 },
    { room: 7, startSlot: 4, slots: 3, color: "#f97316", groupNum: 52, teacher: "Lola Karimova", book: "90/115", ppl: "19/35", extra: 2 },
    { room: 2, startSlot: 8, slots: 3, color: "#e11d48", groupNum: 67, teacher: "Anvar Saidov", book: "100/125", ppl: "21/35", extra: 0 },
    { room: 6, startSlot: 8, slots: 3, color: "#06b6d4", groupNum: 80, teacher: "Sherzod Rahimov", book: "115/140", ppl: "23/35", extra: 1 },
  ],
};

// app.js dagi decorateLessons() — har darsga course + status qo'shadi (filtrlash uchun).
for (const day of Object.keys(SCHEDULE_DATA)) {
  for (const L of SCHEDULE_DATA[day]) {
    if (!L.course) L.course = LESSON_COURSE_NAMES[L.groupNum % LESSON_COURSE_NAMES.length];
    if (!L.status) {
      const m = L.groupNum % 11;
      if (m === 0) L.status = "pauza";
      else if (m === 1) L.status = "rejalashtirilgan";
      else if (m === 2) L.status = "yakunlangan";
      else L.status = "aktiv";
    }
  }
}
