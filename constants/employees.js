// Boshqaruv → Xodimlar demo ma'lumotlari.
// crm-akademiya/src/app.js dagi EMPLOYEES_DATA (11 aniq yozuv + 12–49 uchun
// deterministik generator) va EMP_COLS_ALL'dan ko'chirilgan. Backend yo'q —
// ro'yxat shu statik massivdan o'qiladi, profil sahifasi ham shu yerdan
// (id bo'yicha) topadi. Qo'shish modali demo (saqlanmaydi).

// Ustun sarlavhalari CSS bilan katta harfga o'giriladi (uppercase). Bu yerda
// to'liq (skrinshotdagidek) label'lar — manbadagi qisqartirilgan variant emas.
export const EMP_COLUMNS = [
  { id: "num", label: "№" },
  { id: "name", label: "To'liq nomi" },
  { id: "gender", label: "Jinsi" },
  { id: "aktivOq", label: "Aktiv o'quvchilar soni" },
  { id: "groups", label: "Guruhlar" },
  { id: "turi", label: "Turi" },
  // ISH TURI — "Foiz X%" yoki "Oklad" (xodim kartasi filiallar/foiz asosida).
  //
  // "Jami oylik", "Jami avans", "To'langan oylik" va "Qolgan oylik"
  // ustunlari OLIB TASHLANDI: bu ro'yxat xodimlar kartotekasi, oylik
  // hisob-kitobi esa Moliya → Oylik chiqarish sahifasida to'liq ko'rinadi.
  // Ikki joyda takrorlanishi jadvalni keraksiz kengaytirardi.
  { id: "ishTuri", label: "Ish turi" },
  { id: "filial", label: "Filiallar" },
  { id: "phone", label: "Telefon raqam" },
  { id: "kurs", label: "Kurs" },
  // OLIB TASHLANGAN USTUNLAR: "Lavozim", "Tug'ilgan sana", "Maosh hisoblanadi"
  // va "Oxirgi faol bo'lgan". Referensda ular bor edi, lekin amalda hech
  // qanday ma'lumot ko'rsatmasdi — jadvalda faqat "—" chizig'i turardi va
  // ro'yxatni kengaytirib, o'ngga gorizontal aylantirishga majbur qilardi.
  // Ma'lumotning o'zi bazadan o'chirilgani yo'q: tug'ilgan sana va lavozim
  // xodim PROFILIDA ko'rinadi, "Faollik sanasi" filtri esa `lastActive` ni
  // o'qiyveradi.
  { id: "created", label: "Yaratilgan sanasi", sortable: true },
  { id: "archReason", label: "Arxivlash sababi" },
  { id: "archDate", label: "Sana" },
  // SOLIQ — tugmacha, jadvalning OXIRIDA. Yoqilgan bo'lsa Sozlamalar →
  // Moliya → Soliq dagi faol qoidalar shu xodimning oyligidan ushlab
  // qolinadi (lib/salary.ts → payrollTaxLines). O'chiq bo'lsa soliq
  // umuman hisoblanmaydi.
  { id: "soliq", label: "Soliq" },
];

// turi (rol) — ichki qiymat → ko'rinadigan o'zbekcha nom.
export const ROLE_LABELS = {
  teacher: "O'qituvchi",
  moderator: "Moderator",
  admin: "Administrator",
};

export const GENDER_LABELS = { male: "Erkak", female: "Ayol" };

// Filtr select'lari uchun variantlar (manbadagidek).
export const EMP_STATES = [
  { value: "active", label: "Aktiv" },
  { value: "archive", label: "Arxiv" },
];
export const EMP_ROLES = [
  { value: "teacher", label: "Teacher" },
  { value: "moderator", label: "Moderator" },
  { value: "admin", label: "Admin" },
];
export const EMP_COURSES = ["Ona tili", "Biologiya", "Turk tili", "Ingliz tili", "Kimyo", "Rus tili"];
export const EMP_LEAVE_REASONS = ["Shaxsiy", "Ish o'zgarishi", "Boshqa"];
// Filial ro'yxati bu yerda EMAS — hooks/useBranches.ts (/api/branches) dan
// olinadi, Boshqaruv → Filiallar sahifasi bilan bir xil manba.

const BASE_EMPLOYEES = [
  { id: 1,  name: "Shaxlo Ziyamova",       gender: "female", aktivOq: 0,  groups: 0, turi: "teacher",   filial: "Akademiya", phone: "99 616 85 86", kurs: "Ona tili",    created: "19.05.2026 | 10:23", lastActive: "", archReason: "" },
  { id: 2,  name: "Husanboy Sotiboldiyev", gender: "male",   aktivOq: 0,  groups: 0, turi: "moderator", filial: "Akademiya", phone: "94 555 52 92", kurs: "",            created: "06.05.2026 | 09:15", lastActive: "", archReason: "" },
  { id: 3,  name: "Akmal To'rabayev",      gender: "male",   aktivOq: 0,  groups: 0, turi: "teacher",   filial: "Akademiya", phone: "93 923 02 31", kurs: "Biologiya",   created: "15.04.2026 | 10:42", lastActive: "", archReason: "" },
  { id: 4,  name: "Ezoza Dehqanova",       gender: "female", aktivOq: 0,  groups: 0, turi: "moderator", filial: "Akademiya", phone: "70 114 19 83", kurs: "",            created: "17.02.2026 | 17:30", lastActive: "", archReason: "" },
  { id: 5,  name: "Nafisa Muradova",       gender: "female", aktivOq: 0,  groups: 0, turi: "teacher",   filial: "Akademiya", phone: "50 103 39 77", kurs: "Ona tili",    created: "12.02.2026 | 17:05", lastActive: "", archReason: "" },
  { id: 6,  name: "Shohsanam Odilova",     gender: "female", aktivOq: 0,  groups: 0, turi: "teacher",   filial: "Akademiya", phone: "90 794 15 11", kurs: "Ona tili",    created: "10.02.2026 | 16:18", lastActive: "", archReason: "" },
  { id: 7,  name: "Asadbek Qosimov",       gender: "male",   aktivOq: 0,  groups: 0, turi: "teacher",   filial: "Akademiya", phone: "94 426 19 67", kurs: "Ingliz tili", created: "16.01.2026 | 16:50", lastActive: "", archReason: "" },
  { id: 8,  name: "Dilnoza Nabijanova",    gender: "female", aktivOq: 0,  groups: 0, turi: "teacher",   filial: "Akademiya", phone: "93 135 93 91", kurs: "Turk tili",   created: "13.12.2025 | 17:22", lastActive: "", archReason: "" },
  { id: 9,  name: "Shohruh Axmadjanov",    gender: "male",   aktivOq: 0,  groups: 0, turi: "moderator", filial: "Akademiya", phone: "94 315 07 00", kurs: "",            created: "06.12.2025 | 10:08", lastActive: "14.04.2026 | 15:35", archReason: "" },
  { id: 10, name: "Rayxona To'lqinova",    gender: "female", aktivOq: 10, groups: 1, turi: "teacher",   filial: "Akademiya", phone: "77 194 70 08", kurs: "Rus tili",    created: "09.10.2025 | 16:42", lastActive: "", archReason: "" },
  { id: 11, name: "Mashxura Kutupova",     gender: "female", aktivOq: 36, groups: 2, turi: "teacher",   filial: "Akademiya", phone: "93 407 18 31", kurs: "Kimyo",       created: "06.09.2025 | 10:15", lastActive: "", archReason: "" },
];

// Qolganini (12–49) deterministik generatsiya qilamiz — 49 taga yetkazish uchun.
// (crm-akademiya/src/app.js dagi bilan bir xil urug'/formula → barqaror.)
function buildRest() {
  const firstNames = ["Aziz","Bobur","Davron","Eldor","Farhod","Gulnoza","Hasan","Iroda","Jamol","Kamol","Laylo","Maftuna","Nargiza","Olim","Pulat","Qodir","Rustam","Sayyora","Temur","Umida","Vasila","Yusuf","Zarina","Anvar","Bakhtiyor","Dilfuza","Erkin","Fotima","Gulbahor","Hilola"];
  const lastNames = ["Tursunov","Karimov","Nurmatov","Rasulov","Saidov","Yusupov","Akbarov","Dadaxojayev","Komilov","Madaminov","Obidov","Mahmudov","Rahimjanov","Abdullayev","Pirmatov","Olimov","Yoqubov","Toxtaboyev","Erkinov","Abduvayitov"];
  const turi = ["teacher","moderator","admin","teacher","teacher","moderator"];
  const kurslar = ["Ona tili","Biologiya","Turk tili","Ingliz tili","Kimyo","Rus tili","Matematika","Fizika",""];
  const out = [];
  for (let i = 12; i <= 49; i++) {
    let seed = i * 9301 + 49297;
    const rnd = (min, max) => {
      seed = (seed * 9301 + 49297) % 233280;
      return Math.floor((seed / 233280) * (max - min + 1)) + min;
    };
    const fn = firstNames[rnd(0, firstNames.length - 1)];
    const ln = lastNames[rnd(0, lastNames.length - 1)];
    const gender = fn.endsWith("a") || fn.endsWith("o") ? "female" : "male";
    const t = turi[rnd(0, turi.length - 1)];
    const month = rnd(1, 9);
    out.push({
      id: i,
      name: `${fn} ${ln}`,
      gender,
      aktivOq: rnd(0, 5) === 0 ? rnd(5, 40) : 0,
      groups: rnd(0, 6) === 0 ? rnd(1, 3) : 0,
      turi: t,
      filial: "Akademiya",
      phone: `9${rnd(0, 9)} ${String(rnd(100, 999))} ${String(rnd(10, 99))} ${String(rnd(10, 99))}`,
      kurs: t === "teacher" ? kurslar[rnd(0, kurslar.length - 1)] : "",
      created: `${String(rnd(1, 28)).padStart(2, "0")}.${String(month).padStart(2, "0")}.2025 | ${String(rnd(9, 18)).padStart(2, "0")}:${String(rnd(0, 59)).padStart(2, "0")}`,
      lastActive: "",
      archReason: "",
    });
  }
  return out;
}

// Loyihaning boshqa joylarida "xodim" sifatida ishlatiladigan, ammo yuqoridagi
// demo ro'yxatga tushmay qolgan odamlar: GROUP_TEACHERS (guruh o'qituvchilari,
// Moliya → Kassalar'dagi "Moderator" tanlovi ham shu ro'yxatdan) va kassa
// seed'idagi moderatorlar. Ular shu yerda bo'lmasa, ism bo'yicha xodim profiliga
// (/management-xodimlar/[id]) o'tadigan havolalar ishlamaydi. Id'lar 50 dan
// boshlanadi — 1–49 o'zgarmay qolishi uchun.
const STAFF_EXTRA = [
  { id: 50, name: "Jasurbek O'rinboyev",     gender: "male",   aktivOq: 24, groups: 1, turi: "teacher",   filial: "Akademiya", phone: "90 112 47 63", kurs: "Ingliz tili", created: "02.06.2026 | 09:40", lastActive: "", archReason: "" },
  { id: 51, name: "Mohinur Abdurahimova",    gender: "female", aktivOq: 7,  groups: 1, turi: "teacher",   filial: "Akademiya", phone: "93 208 55 14", kurs: "Matematika",  created: "02.09.2025 | 10:12", lastActive: "", archReason: "" },
  { id: 52, name: "Odina Ahmedova",          gender: "female", aktivOq: 6,  groups: 1, turi: "teacher",   filial: "Akademiya", phone: "94 371 09 28", kurs: "Rus tili",    created: "03.06.2025 | 11:05", lastActive: "", archReason: "" },
  { id: 53, name: "Odina Yuldasheva",        gender: "female", aktivOq: 24, groups: 2, turi: "teacher",   filial: "Akademiya", phone: "97 640 12 77", kurs: "Ingliz tili", created: "03.09.2025 | 09:58", lastActive: "", archReason: "" },
  { id: 54, name: "Musoxon Maxamadaliyev",   gender: "male",   aktivOq: 13, groups: 1, turi: "teacher",   filial: "Akademiya", phone: "91 505 33 46", kurs: "Arab tili",   created: "02.09.2025 | 14:20", lastActive: "", archReason: "" },
  { id: 55, name: "Abdushukur Abdug'aniyev", gender: "male",   aktivOq: 20, groups: 2, turi: "teacher",   filial: "Akademiya", phone: "88 219 74 05", kurs: "Arab tili",   created: "09.03.2025 | 16:34", lastActive: "", archReason: "" },
  { id: 56, name: "Shahnoza Abduqahharova",  gender: "female", aktivOq: 10, groups: 1, turi: "teacher",   filial: "Akademiya", phone: "99 483 26 91", kurs: "Ona tili",    created: "03.09.2025 | 08:47", lastActive: "", archReason: "" },
  { id: 57, name: "Zebunniso Kukibayeva",    gender: "female", aktivOq: 3,  groups: 1, turi: "teacher",   filial: "Akademiya", phone: "95 127 60 38", kurs: "Ingliz tili", created: "07.09.2025 | 15:26", lastActive: "", archReason: "" },
  { id: 58, name: "Azizbek Mahmudov",        gender: "male",   aktivOq: 9,  groups: 1, turi: "teacher",   filial: "Akademiya", phone: "90 854 71 19", kurs: "Matematika",  created: "03.09.2025 | 12:03", lastActive: "", archReason: "" },
  { id: 59, name: "Ibrohim Dadaxojayev",     gender: "male",   aktivOq: 18, groups: 1, turi: "teacher",   filial: "Akademiya", phone: "93 706 48 52", kurs: "Biologiya",   created: "03.09.2025 | 13:41", lastActive: "", archReason: "" },
  { id: 60, name: "Abdulloh Raxmatullayev",  gender: "male",   aktivOq: 0,  groups: 0, turi: "admin",     filial: "Akademiya", phone: "94 155 88 55", kurs: "",            created: "01.09.2025 | 09:00", lastActive: "", archReason: "" },
  { id: 61, name: "Nilufar Sharipova",       gender: "female", aktivOq: 0,  groups: 0, turi: "moderator", filial: "Akademiya", phone: "97 312 05 64", kurs: "",            created: "01.09.2025 | 09:05", lastActive: "", archReason: "" },
  { id: 62, name: "Dilmurod Komilov",        gender: "male",   aktivOq: 0,  groups: 0, turi: "moderator", filial: "Akademiya", phone: "91 448 90 27", kurs: "",            created: "01.09.2025 | 09:10", lastActive: "", archReason: "" },
];

export const EMPLOYEES_DATA = [...BASE_EMPLOYEES, ...buildRest(), ...STAFF_EXTRA];

// Qo'shish modalidagi "Maxsus maydon" drawer'i uchun maydon turi variantlari.
export const CUSTOM_FIELD_TYPES = ["Matn", "Raqam", "Sana", "Tanlov (select)", "Belgi (checkbox)"];

// Xodim profili (skrinshot 4) tablari — crm-akademiya EP_TABS_ALL'dan.
// EP_MORE_IDS — asosiy qatorga sig'maydigan, "Ko'proq" menyusiga tushadigan tablar.
export const EP_TABS = [
  { id: "transactions", label: "Tranzaksiyalar tarixi" },
  { id: "student-payments", label: "O'quvchilar to'lovlari" },
  { id: "advances", label: "Avans tarixi" },
  { id: "unpaid-history", label: "To'lanmagan tarixi" },
  { id: "unpaid-payments", label: "To'lanmagan to'lovlar" },
  { id: "actions", label: "Harakatlar tarixi" },
  { id: "notes", label: "Eslatma" },
  { id: "rating", label: "Reyting" },
  { id: "work-hours", label: "Ish soati" },
  { id: "work-hours-log", label: "Ish soati tarixi" },
  { id: "balance", label: "Balans tarixi" },
  { id: "salary-log", label: "Oylik tarixi" },
  { id: "calls", label: "Qo'ng'iroqlar tarixi" },
  { id: "actions-audit", label: "Harakatlar tarixi (audit)" },
  { id: "kpi", label: "Kpi asboblar paneli" },
  { id: "teacher-report", label: "O'qituvchining hisoboti" },
];

// "Ko'proq" menyusiga tushadigan tablar (asosiy qatorda ko'rinmaydi).
export const EP_MORE_IDS = ["kpi", "teacher-report"];
