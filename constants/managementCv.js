// Boshqaruv > Ishga qabul (CV) — referens HTML'dagi "ISHGA QABUL (CV) VIEW"
// va "OMMAVIY ARIZA SAHIFASI (#ariza)" bo'limlaridan ko'chirilgan sobit
// ma'lumotlar. Sidebar: Boshqaruv > Ishga chaqiruv (CV), href /management-cv.
//
// Anketa savollari: "Akademiya o'quv markazi — Ishga qabul anketasi"
// (Google Forms namunasi asosida, 20 savol). Savollar ro'yxati bitta joyda
// turadi: CRM ichidagi "CV to'ldirish" modali ham, /ariza dagi ommaviy
// 3 bosqichli anketa ham shuni o'qiydi.

export const CV_QUESTIONS = [
  { k: "name", q: "Ism va familiya", req: true },
  { k: "phone", q: "Telefon raqamingiz", req: true },
  { k: "address", q: "Yashash manzilingiz" },
  { k: "birth", q: "Tug'ilgan kun, oy va yilingiz", type: "date" },
  { k: "university", q: "Oliygohni nomi, qachon tamomlaganingiz va yo'nalishingiz" },
  {
    k: "position",
    q: "Qaysi yo'nalishda ishlamoqchisiz?",
    req: true,
    type: "select",
    opts: ["O'qituvchi", "Administrator", "SMM / Marketing", "Sotuv", "Boshqa"],
  },
  { k: "subject", q: "Qaysi fan yoki chet tilidan ishlamoqchisiz" },
  { k: "achievements", q: "Yo'nalishingizda qanday yutuqlarga erishgansiz (sertifikatlar)" },
  { k: "experience", q: "Avval ishlagan ish joyingiz haqida batafsil ma'lumot" },
  { k: "startDate", q: "Qachondan ishlashni boshlay olasiz" },
  { k: "whyUs", q: "Nega aynan bizning o'quv markazda ishlashni xohlaysiz?" },
  { k: "schools", q: "Qanday o'quv markaz yoki maktablarda ishlagansiz?" },
  { k: "currentJob", q: "Hozirgi paytda boshqa joyda ishlayapsizmi?" },
  { k: "levels", q: "Qanday darajadagi o'quvchilarga dars bera olasiz" },
  { k: "plans5", q: "Kelajakdagi 5 yillik rejalaringiz qanday" },
  { k: "expectedSalary", q: "Kutilayotgan oylik maosh" },
  { k: "results", q: "Agar sizni ishga olsak, qanday natija bera olasiz?" },
  {
    k: "priorities",
    q: "Siz uchun ishda muhim bo'lgan 3 ta eng asosiy omil",
    type: "multi",
    opts: [
      "Oylik maosh",
      "Professional o'sish imkoniyati",
      "Jamoa muhiti",
      "Ish jadvali moslashuvchanligi",
      "Ish joyi qulayligi",
    ],
  },
  {
    k: "strengths",
    q: "Ish faoliyatingizdagi asosiy kuchli tomonlaringiz",
    type: "multi",
    opts: [
      "Mas'uliyat",
      "Jamoada ishlash",
      "Moslashuvchanlik",
      "Muammo yechish",
      "Boshqaruv qobiliyati",
      "Tashabbuskorlik",
    ],
  },
  { k: "extra", q: "Qo'shimcha ma'lumotlar uchun joy", type: "textarea" },
];

/** Toolbar'dagi "Yo'nalish" filtri — anketadagi `position` savoli bilan bir xil. */
export const CV_POSITIONS = ["O'qituvchi", "Administrator", "SMM / Marketing", "Sotuv", "Boshqa"];

// ── OMMAVIY ANKETA (/ariza) — 19.09.2026 dagi yangi dizayn ──────────────
//
// Dizayn foydalanuvchining "akademiya-ishga-ariza.html" faylidan (chap
// panelda jonli ariza kartasi + progress, o'ngda 4 bo'limli forma).
// Quyidagi ro'yxatlar o'sha formadagi tanlovlar — mijoz (CvApplyPage)
// va server (app/api/management-cv, tekshiruv) ikkalasi shundan o'qiydi,
// shuning uchun ro'yxat bitta joyda turadi.

/** Vakansiya turlari — guruhlangan (`<optgroup>`). */
export const CV_ROLE_GROUPS = [
  { label: "Ta'lim", roles: ["Fan o'qituvchisi", "Assistent o'qituvchi", "Metodist", "Kurator / mentor"] },
  { label: "Qabul va sotuv", roles: ["Administrator", "Sotuv menejeri", "Call-center operatori"] },
  { label: "Marketing", roles: ["SMM menejer", "Targetolog", "Videograf / montajchi", "Grafik dizayner"] },
  { label: "Boshqaruv va moliya", roles: ["Filial rahbari", "HR menejer", "Buxgalter / kassir", "IT administrator"] },
  { label: "Texnik xizmat", roles: ["Farrosh", "Qorovul", "Haydovchi"] },
];

/** Fan/yo'nalish faqat shu vakansiyalarda so'raladi. */
export const CV_TEACHING_ROLES = ["Fan o'qituvchisi", "Assistent o'qituvchi", "Metodist", "Kurator / mentor"];

/** Fan yoki yo'nalish — guruhlangan. */
export const CV_SUBJECT_GROUPS = [
  { label: "Fanlar", subjects: ["Ona tili", "Fizika", "Tarix", "Biologiya", "Huquq", "Geografiya", "Matematika", "Kimyo"] },
  { label: "Chet tillari", subjects: ["Ingliz tili", "Rus tili", "Arab tili", "Koreys tili", "Nemis tili", "Turk tili"] },
  {
    label: "Boshqa yo'nalishlar",
    subjects: ["IELTS / CEFR tayyorlov", "Milliy sertifikat", "Boshlang'ich sinflar", "Prezident maktablariga tayyorlov"],
  },
];

/** Bandlik turi (radio tugmalar). */
export const CV_LOADS = ["To'liq stavka", "Yarim stavka", "Soatbay", "Farqi yo'q"];

export const CV_EDU_LEVELS = ["O'rta maktab", "Kollej / texnikum", "Talaba (hozir o'qiyapman)", "Bakalavr", "Magistr", "Ilmiy daraja"];

export const CV_EXP_LEVELS = ["Tajribam yo'q", "1 yilgacha", "1–3 yil", "3–5 yil", "5 yildan ko'p"];

export const CV_SOURCES = [
  "Instagram",
  "Telegram",
  "Tanishim aytdi",
  "OLX yoki ish e'lonlari sayti",
  "Banner yoki flayer",
  "Markazga o'zim keldim",
  "Boshqa",
];

/**
 * "Qaysi filial bo'lsa ham ishlayveraman" — bunday ariza `branchId: null`
 * bilan saqlanadi va HAR BIR filialning ro'yxatida ko'rinadi.
 */
export const CV_ANY_BRANCH = "Qaysi filial bo'lsa ham ishlayveraman";

/** Filial telefoni ko'rsatilmagan bo'lsa — bosh raqam (dizayndagi). */
export const CV_MAIN_PHONE = "+998 94 111 88 55";
export const CV_INSTAGRAM = "@Akademiya.rasmiy";

/** Ishga qabul shu yoshdan boshlanadi (tug'ilgan sana tekshiruvi). */
export const CV_MIN_AGE = 16;

/** Fayl chegaralari — mijoz va server bir xil raqamni ishlatadi. */
export const CV_FILE_LIMITS = {
  photoBytes: 10 * 1024 * 1024,
  fileBytes: 10 * 1024 * 1024,
  docsCount: 10,
  docsTotalBytes: 25 * 1024 * 1024,
};

/** Holat rangi/nomi — jadval nishonchasi ham, filtri ham shundan o'qiydi. */
export const CV_STATUS = {
  new: { label: "Yangi", cls: "bg-blue-100 text-blue-700" },
  reviewed: { label: "Ko'rib chiqilgan", cls: "bg-secondary/80 text-muted-foreground" },
  interview: { label: "Suhbatga chaqirilgan", cls: "bg-amber-100 text-amber-700" },
  accepted: { label: "Ishga olingan", cls: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Rad etilgan", cls: "bg-rose-100 text-rose-600" },
};

/** Holat filtri select'idagi tartib. */
export const CV_STATUS_ORDER = ["new", "reviewed", "interview", "accepted", "rejected"];

/** Ommaviy anketa (/ariza) bosqichlari — har bosqich qaysi savollarni so'raydi. */
export const PA_STEPS = [
  { n: 1, label: "Shaxsiy ma'lumotlar", keys: ["name", "phone", "address", "birth"] },
  {
    n: 2,
    label: "Ta'lim va tajriba",
    keys: ["university", "position", "subject", "achievements", "experience", "schools", "currentJob", "levels"],
  },
  {
    n: 3,
    label: "Motivatsiya",
    keys: ["startDate", "expectedSalary", "whyUs", "plans5", "results", "priorities", "strengths", "extra"],
  },
];

/** Ommaviy anketada bir qatorga ikkitadan joylashadigan (kalta) maydonlar. */
export const PA_SHORT = [
  "name",
  "phone",
  "address",
  "birth",
  "position",
  "subject",
  "startDate",
  "expectedSalary",
];

// Kolleksiya bo'sh bo'lganda bir marta yoziladigan demo arizalar
// (referens HTML'dagi CV_DB bilan bir xil).
export const CV_SEED = [
  {
    id: 1, name: "Dilshod Karimov", phone: "94 512 33 45", address: "Namangan sh., Uychi tumani", birth: "1998-03-12",
    university: "NamDU, 2021, Matematika o'qitish metodikasi", position: "O'qituvchi", subject: "Matematika",
    achievements: "Milliy sertifikat A daraja (2024), tuman olimpiadasi g'olibi o'quvchilar tayyorlagan",
    experience: "4 yil — Everest o'quv markazida matematika o'qituvchisi, DTM guruhlari", startDate: "Darhol",
    whyUs: "Akademiya natijaga ishlaydigan markaz, o'quvchilar bazasi katta",
    schools: "Everest o'quv markazi, 27-maktab",
    currentJob: "Yo'q, avgustda shartnomam tugadi", levels: "5-sinfdan abituriyentgacha, DTM va Milliy sertifikat",
    plans5: "Bosh metodist bo'lish, o'z darslik qo'llanmamni chiqarish", expectedSalary: "4 000 000",
    results: "1 yilda kamida 10 o'quvchini Milliy sertifikatga tayyorlab beraman",
    priorities: ["Oylik maosh", "Professional o'sish imkoniyati", "Jamoa muhiti"],
    strengths: ["Mas'uliyat", "Muammo yechish", "Tashabbuskorlik"], extra: "",
    status: "new", submitted: "14.08.2026 | 09:12",
  },
  {
    id: 2, name: "Mohira Yusupova", phone: "93 208 44 12", address: "Namangan sh., Davlatobod", birth: "1999-11-02",
    university: "O'zDJTU, 2022, Ingliz filologiyasi", position: "O'qituvchi", subject: "Ingliz tili",
    achievements: "IELTS 8.0 (2025), CELTA sertifikati",
    experience: "3 yil — Cambridge Learning Center, IELTS guruhlari",
    startDate: "1-sentabrdan", whyUs: "IELTS yo'nalishini kuchaytirmoqchi ekanligingizni eshitdim",
    schools: "Cambridge Learning Center", currentJob: "Ha, lekin avgust oxirida bo’shayapman",
    levels: "Beginner dan IELTS 7.5+ gacha", plans5: "IELTS bo’yicha bosh trener bo’lish",
    expectedSalary: "4 500 000", results: "Har mavsumda kamida 5 ta 7+ natija",
    priorities: ["Professional o'sish imkoniyati", "Jamoa muhiti", "Ish jadvali moslashuvchanligi"],
    strengths: ["Jamoada ishlash", "Moslashuvchanlik", "Mas'uliyat"],
    extra: "Portfolio: natijalar jadvalini olib kelaman",
    status: "interview", submitted: "12.08.2026 | 15:40",
  },
  {
    id: 3, name: "Sardor Aliyev", phone: "90 771 25 80", address: "Namangan sh., Chorsu", birth: "2000-06-25",
    university: "NamMQI, 2023, Menejment", position: "Administrator", subject: "-",
    achievements: "Mijozlar bilan ishlash bo'yicha 'Service Pro' kursi",
    experience: "2 yil — call-markaz operatori, keyin administrator",
    startDate: "1 hafta ichida", whyUs: "Tizimli ishlaydigan jamoada tajriba oshirish uchun",
    schools: "-", currentJob: "Yo'q", levels: "-", plans5: "Filial menejeri darajasiga chiqish",
    expectedSalary: "3 000 000", results: "Qo'ng'iroqlarni 100% qayta ishlash, mijoz qoniqishini oshirish",
    priorities: ["Oylik maosh", "Jamoa muhiti", "Ish joyi qulayligi"],
    strengths: ["Mas'uliyat", "Jamoada ishlash", "Boshqaruv qobiliyati"], extra: "",
    status: "new", submitted: "13.08.2026 | 11:05",
  },
  {
    id: 4, name: "Nilufar Qodirova", phone: "99 615 72 33", address: "Chortoq tumani", birth: "1996-01-18",
    university: "NamDU, 2019, Kimyo", position: "O'qituvchi", subject: "Kimyo",
    achievements: "Milliy sertifikat B daraja, \"Yilning eng yaxshi fan o’qituvchisi\" (2024, tuman)",
    experience: "5 yil — 14-maktab kimyo o'qituvchisi, qo'shimcha abituriyent guruhlari", startDate: "Sentabrdan",
    whyUs: "Kimyo kafedrangiz kuchli, rivojlanmoqchiman", schools: "14-maktab, Bilim Sari markazi",
    currentJob: "Ha, maktabda (yarim stavka)", levels: "7-sinfdan abituriyentgacha",
    plans5: "Milliy sertifikat A olish, metodika yozish", expectedSalary: "3 800 000",
    results: "DTM da kimyodan 90%+ o’rtacha ball beraman",
    priorities: ["Professional o'sish imkoniyati", "Oylik maosh", "Ish jadvali moslashuvchanligi"],
    strengths: ["Mas'uliyat", "Muammo yechish", "Moslashuvchanlik"], extra: "",
    status: "reviewed", submitted: "10.08.2026 | 17:22",
  },
  {
    id: 5, name: "Javohir Tursunov", phone: "88 410 96 55", address: "Namangan sh.", birth: "2001-09-30",
    university: "TATU Namangan filiali, 2024, Axborot tizimlari", position: "SMM / Marketing", subject: "-",
    achievements: "Instagram: 2 ta brendni 0 dan 50k gacha olib chiqqan",
    experience: "3 yil — marketing agentligida SMM",
    startDate: "Darhol", whyUs: "Ta'lim sohasidagi kontent bilan ishlashni xohlayman",
    schools: "-", currentJob: "Frilans", levels: "-", plans5: "Marketing bo’lim boshlig’i",
    expectedSalary: "3 500 000", results: "Lidlar sonini 2 baravar oshiraman",
    priorities: ["Oylik maosh", "Professional o'sish imkoniyati", "Ish jadvali moslashuvchanligi"],
    strengths: ["Tashabbuskorlik", "Muammo yechish", "Moslashuvchanlik"], extra: "Portfolio havolasi suhbatda",
    status: "rejected", submitted: "05.08.2026 | 10:48",
  },
  {
    id: 6, name: "Zarina Alimova", phone: "97 305 18 27", address: "Namangan sh., Yangi shahar", birth: "2002-04-07",
    university: "NamDU, 2025, Rus filologiyasi", position: "O'qituvchi", subject: "Rus tili",
    achievements: "ТРКИ-2 sertifikati", experience: "1 yil — xususiy repetitorlik", startDate: "Darhol",
    whyUs: "Katta jamoada tajriba orttirish", schools: "-", currentJob: "Yo'q",
    levels: "Boshlang’ich va o’rta daraja", plans5: "Katta o’qituvchi bo’lish",
    expectedSalary: "2 800 000", results: "Guruhlarni to’liq davomat bilan olib boraman",
    priorities: ["Jamoa muhiti", "Professional o'sish imkoniyati", "Oylik maosh"],
    strengths: ["Moslashuvchanlik", "Mas'uliyat", "Jamoada ishlash"], extra: "",
    status: "new", submitted: "15.08.2026 | 08:55",
  },
];

// Google Sheets (Apps Script Web App) backend'i — "Google Sheets bilan
// bog'lash" modalidagi "Kodni nusxalash" tugmasi shu matnni nusxalaydi.
export const CV_APPS_SCRIPT = `const SHEET_NAME = 'Arizalar';
const HEADERS = ['sid','status','submitted','ref','name','phone','telegram','address','birth','university','position','subject','branchName','load','edu','achievements','experience','startDate','whyUs','schools','currentJob','levels','plans5','expectedSalary','results','priorities','strengths','extra','source','photoUrl','cvFileUrl','docsUrls'];
function _sheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) { sh = ss.insertSheet(SHEET_NAME); sh.appendRow(HEADERS); sh.setFrozenRows(1); }
  return sh;
}
function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    const sh = _sheet();
    if (d.action === 'status') {
      const vals = sh.getDataRange().getValues();
      for (let i = 1; i < vals.length; i++) {
        if (String(vals[i][0]) === String(d.sid)) { sh.getRange(i + 1, 2).setValue(d.status); break; }
      }
      return _json({ ok: true });
    }
    const vals = sh.getDataRange().getValues();
    for (let i = 1; i < vals.length; i++) if (String(vals[i][0]) === String(d.sid)) return _json({ ok: true, dup: true });
    sh.appendRow(HEADERS.map(h => {
      const v = d[h];
      if (Array.isArray(v)) return v.join(' | ');
      return v === undefined || v === null ? '' : String(v);
    }));
    return _json({ ok: true });
  } catch (err) { return _json({ ok: false, error: String(err) }); }
}
function doGet(e) {
  try {
    const sh = _sheet();
    const vals = sh.getDataRange().getValues();
    const out = [];
    for (let i = 1; i < vals.length; i++) {
      const row = {};
      HEADERS.forEach((h, j) => { row[h] = vals[i][j] === undefined ? '' : String(vals[i][j]); });
      if (row.sid) out.push(row);
    }
    return _json({ ok: true, items: out });
  } catch (err) { return _json({ ok: false, error: String(err) }); }
}
function _json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }`;
