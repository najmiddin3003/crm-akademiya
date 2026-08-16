// Sotuv va marketing → Avto sms (sale-marketing:auto-sms). Referens saytdan
// o'lchab olingan yorliqlar, o'zgaruvchilar va boshlang'ich holatlar.
//
// MongoDB'dagi "sale-marketing.auto-sms" hujjati quyidagi ko'rinishda:
// { enabled, branch, scenarios: { <kalit>: { on, text, ...qo'shimcha } } }

// Filiallar ro'yxati backend'dan (filiallar API'sidan) kelishi kerak —
// hozircha faqat bo'sh variant turadi, so'rov tayyor bo'lganda shu massiv
// o'rniga yuklangan ro'yxat qo'yiladi.
export const AUTO_SMS_BRANCHES = ["Tanlang"];

// "Darsga kelmasa" bloki uchun davomat holati variantlari.
export const AUTO_SMS_ABSENT_STATUSES = ["Sababsiz", "Sababli", "Kechikkan"];

// "Darsga kelmasa" ichidagi ost-bloklar: xabar bolaga va ota-onaga alohida
// ketadi, shu bois har birining o'z toggli, matni va jadvali bor.
export const AUTO_SMS_ABSENT_SUBS = [
  {
    key: "child",
    title: "Bolaga",
    default: false,
    vars: [
      { key: "{name}", desc: "O'quvchini ismi" },
      { key: "{groupName}", desc: "O'quvchini guruhi" },
      { key: "{teacherName}", desc: "O'quvchini ustozi" },
    ],
  },
  {
    key: "parent",
    title: "Ota-onaga",
    default: false,
    vars: [
      { key: "{parentName}", desc: "O'quvchini ota-onasi" },
      { key: "{name}", desc: "O'quvchini ismi" },
      { key: "{groupName}", desc: "O'quvchini guruhi" },
      { key: "{teacherName}", desc: "O'quvchini ustozi" },
    ],
  },
];

// Har bir ssenariy — alohida karta. `extra` maydoni komponentga qo'shimcha
// boshqaruvlarni (select, kun/minut maydoni, ost-bloklar) qaysi kartaga
// chizishni aytadi; `extraDefaults` esa o'sha maydonlarning boshlang'ich
// qiymati.
export const AUTO_SMS_SCENARIOS = [
  {
    key: "payment",
    title: "Kurs puli to'lansa",
    default: true,
    vars: [
      { key: "{name}", desc: "O'quvchini ismi" },
      { key: "{oldBalance}", desc: "Eski balans" },
      { key: "{balance}", desc: "Balans" },
      { key: "{amount}", desc: "Kurs uchun to'lagan puli" },
    ],
  },
  {
    key: "absent",
    title: "Darsga kelmasa",
    default: true,
    extra: "absent",
    extraDefaults: {
      status: AUTO_SMS_ABSENT_STATUSES[0],
      delayMinutes: 120,
      ...Object.fromEntries(
        AUTO_SMS_ABSENT_SUBS.map((s) => [s.key, { on: s.default, text: "" }])
      ),
    },
    // Xabar matni va o'zgaruvchilar ost-bloklarda (Bolaga / Ota-onaga),
    // shuning uchun kartaning o'zida umumiy matn maydoni yo'q.
    vars: [],
  },
  {
    key: "birthday",
    title: "Tug'ilgan kunida",
    default: false,
    vars: [{ key: "{name}", desc: "O'quvchini ismi" }],
  },
  {
    key: "newGroup",
    title: "Yangi guruxga qo'shilganda",
    default: false,
    vars: [
      { key: "{name}", desc: "O'quvchini ismi" },
      { key: "{groupName}", desc: "O'quvchini guruhi" },
      { key: "{teacherName}", desc: "O'quvchini ustozi" },
      { key: "{courseName}", desc: "Kurs nomi" },
      { key: "{days}", desc: "Kunlar" },
      { key: "{hours}", desc: "Soat" },
      { key: "{branchName}", desc: "Filial nomi" },
      { key: "{subCourseName}", desc: "Subkurs nomi" },
    ],
  },
  {
    key: "firstLesson",
    title: "Birinchi darsga kelish vaqti",
    default: true,
    vars: [
      { key: "{name}", desc: "O'quvchini ismi" },
      { key: "{hours}", desc: "Sms yuborish vaqtlari" },
    ],
  },
  {
    key: "debtor",
    title: "Qarzdorlar",
    default: false,
    vars: [
      { key: "{name}", desc: "O'quvchini ismi" },
      { key: "{balance}", desc: "Balans" },
    ],
  },
  {
    key: "otp",
    title: "OTP",
    default: false,
    vars: [
      { key: "{name}", desc: "O'quvchini ismi" },
      { key: "{otp}", desc: "OTP" },
      { key: "{phoneNumber}", desc: "Telefon raqami" },
    ],
  },
  {
    key: "consecutive",
    title: "Ketma-ket davomat",
    default: false,
    extra: "consecutive",
    // Kun soni referensda bo'sh keladi — foydalanuvchi o'zi kiritadi.
    extraDefaults: { days: "" },
    vars: [
      { key: "{name}", desc: "O'quvchini ismi" },
      { key: "{groupName}", desc: "O'quvchini guruhi" },
      { key: "{teacherName}", desc: "O'quvchini ustozi" },
      { key: "{consecutiveAttendanceCount}", desc: "Ketma-ket kelgan kunlar soni" },
    ],
  },
];

// Boshlang'ich holat. Toggl defaultlari yuqoridagi ro'yxatdan yig'iladi —
// yorliq va default bir joyda tursin.
export const AUTO_SMS_DEFAULTS = {
  enabled: false,
  branch: AUTO_SMS_BRANCHES[0],
  scenarios: Object.fromEntries(
    AUTO_SMS_SCENARIOS.map((s) => [
      s.key,
      {
        on: s.default,
        // O'z o'zgaruvchisi bo'lmagan kartada (Darsga kelmasa) matn ost-blokda.
        ...(s.vars.length ? { text: "" } : {}),
        ...(s.extraDefaults ?? {}),
      },
    ])
  ),
};
