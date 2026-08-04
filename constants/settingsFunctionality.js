// Umumiy sozlamalar → Funksionallik: 8 ta sozlama kartasi va ularning
// maydonlari. Har bir karta referens saytda ochib ko'rilgan — maydon nomlari
// va turlari o'sha yerdan 1:1 ko'chirilgan (to'qib yozilmagan).
//
// Maydon turlari: "toggle" | "number" | "text" | "time" | "select"
// `group` — forma ichidagi alohida karta (referensda bo'limlar shunday ajratilgan).

export const FUNCTIONALITY_CARDS = [
  {
    key: "finance",
    title: "Moliya sozlamalari",
    description: "Balans, limit va valyutalarni nazorat qilish",
    color: "bg-emerald-500",
    icon: "i-wallet",
    groups: [
      {
        title: "MOLIYA SOZLAMALARI",
        fields: [
          { key: "lessonPriceFromMonthly", label: "Bir oylik umumiy summadan dars narxini hisoblash", type: "toggle", default: true },
          { key: "keepOldPriceOnTransfer", label: "O'quvchi transfer qilinganda eski kurs narxi bilan ko'chirish", type: "toggle", default: false },
          { key: "cashboxTransferConfirm", label: "Kassalar orasida tasdiqlash orqali ko'chirish", type: "toggle", default: true },
          { key: "commentRequiredOnCancel", label: "Abonementni bekor qilishda izoh majburiy qilish", type: "toggle", default: true },
          { key: "autoPaymentDate", label: "O'quvchining to'lov sanasini avtomatik belgilash", type: "toggle", default: false },
        ],
      },
      {
        fields: [
          { key: "withdrawTime", label: "Pul yechish vaqti", type: "time", default: "21:00" },
          { key: "currency", label: "Pul birligi", type: "select", options: ["UZS", "USD", "RUB"], default: "UZS" },
          { key: "debtLimitEnabled", label: "Qarzdorlik limiti", type: "toggle", default: false },
          { key: "debtLimit", label: "", type: "number", default: 0 },
        ],
      },
    ],
  },
  {
    key: "attendance",
    title: "Davomat sozlamalari",
    description: "O'quvchilarning kelish holatini boshqarish",
    color: "bg-blue-500",
    icon: "i-calendar",
    groups: [
      {
        title: "DAVOMAT SOZLAMALARI",
        fields: [
          { key: "backfillOnJoin", label: "Guruhga yangi o'quvchi qo'shilganda, avvalgi dars sanalariga davomat belgilay olishi kerak", type: "toggle", default: true },
          { key: "attendanceEnabled", label: "Davomat funksionalligi", type: "toggle", default: false },
          { key: "autoRemoveAbsent", label: "Ko'rsatilgan darsga kelmaganlarni avtomatik guruhdan chiqarib yuborish va o'quvchi adminiga avtotask qo'shilib qolishi", type: "toggle", default: true },
          { key: "absentLessonCount", label: "Darslar soni", type: "number", default: 3 },
        ],
      },
      {
        title: "DAVOMAT HOLATLARI NOMLARI",
        fields: [
          { key: "renameStates", label: "Davomat holatlari nomlarini o'zgartirish", type: "toggle", default: false },
        ],
      },
      {
        fields: [
          { key: "defaultState", label: "Davomatda hamma keldi turishi", type: "select", options: ["Keldi", "Kelmadi", "Sababli"], default: "Keldi" },
          { key: "maxGrade", label: "Jurnal uchun maksimal baho", type: "number", default: 5 },
        ],
      },
    ],
  },
  {
    key: "teacher",
    title: "O'qituvchi holatlari",
    description: "O'qituvchilar bandligi va ish haqi sozlamalari",
    color: "bg-purple-500",
    icon: "i-user",
    groups: [
      {
        title: "O'QITUVCHI HOLATLARI",
        fields: [
          { key: "busyTeacher", label: "Band o'qituvchi", type: "toggle", default: false },
          { key: "financeTeacherFilter", label: "Moliya bo'limida o'qituvchi bo'yicha filtr", type: "toggle", default: false },
          { key: "supportEnabled", label: "Support funksiyasini yoqish", type: "toggle", default: false },
          { key: "attendanceAnalytics", label: "O'qituvchi davomat qilish analitikasi", type: "toggle", default: false },
          { key: "salaryIndicator", label: "O'qituvchining ish haqi ko'rsatkichi", type: "toggle", default: false },
          { key: "salaryPercent", label: "Foiz", type: "number", default: 0 },
        ],
      },
    ],
  },
  {
    key: "rooms",
    title: "Xonalar holati",
    description: "Xonalar bandligi va to'ldirilganligi haqida ma'lumot",
    color: "bg-amber-500",
    icon: "i-monitor",
    groups: [
      {
        title: "XONALAR HOLATI",
        fields: [
          { key: "busyRoom", label: "Band xona", type: "toggle", default: false },
          { key: "fullRoom", label: "To'lgan xona", type: "toggle", default: false },
          { key: "schoolGroup", label: "Maktab uchun guruh", type: "toggle", default: false },
        ],
      },
    ],
  },
  {
    key: "tasks",
    title: "Topshiriq boshqaruvi",
    description: "Darsdan oldingi topshiriqlar va baholash sozlamalari",
    color: "bg-pink-500",
    icon: "i-list-todo",
    groups: [
      {
        title: "TOPSHIRIQ BOSHQARUVI",
        fields: [{ key: "staffTask", label: "Xodimga topshiriq", type: "toggle", default: false }],
      },
      {
        title: "FIKR MULOHAZA AVTOMATIK TASK BO'LIB MENEJERGA YUBORILADI",
        fields: [{ key: "feedbackAutoTask", label: "Fikr mulohaza avtomatik task bo'lib menejerga yuboriladi", type: "toggle", default: false }],
      },
      {
        title: "ABONEMENT TUGASHIDAN OLDIN XABAR BERISH",
        fields: [{ key: "subscriptionExpiryNotice", label: "Abonement tugashidan oldin xabar berish", type: "toggle", default: false }],
      },
      {
        title: "BUYURTMA UCHUN AVTOMATIK KUZATUV VAZIFASI",
        fields: [{ key: "orderFollowUpTask", label: "Buyurtma uchun avtomatik kuzatuv vazifasi", type: "toggle", default: false }],
      },
    ],
  },
  {
    key: "users",
    title: "Foydalanuvchi nazorati",
    description: "Telefon, arxiv va marketing roziligi sozlamalari",
    color: "bg-cyan-500",
    icon: "i-users-group",
    groups: [
      {
        title: "FOYDALANUVCHI NAZORATI",
        fields: [
          { key: "birthDateRequired", label: "O'quvchining tug'ilgan sanasini kiritishni majburiy qilish", type: "toggle", default: false },
          { key: "phoneRequired", label: "Telefon raqamni majburiy qilish", type: "toggle", default: false },
          { key: "phoneVerify", label: "O'quvchi telefon raqamini tasdiqlash", type: "toggle", default: false },
          { key: "marketingSurveyRequired", label: "Marketing so'rovnomasi majburiy qilish", type: "toggle", default: false },
        ],
      },
    ],
  },
  {
    key: "sidebar-modules",
    title: "Yon panel modullari",
    description: "Admin panelda ko'rinadigan asosiy bo'limlar",
    color: "bg-slate-600",
    icon: "i-grid",
    groups: [
      {
        title: "YON PANEL MODULLARI",
        fields: [
          { key: "mHisobot", label: "Hisobot", type: "toggle", default: true },
          { key: "mBlokTest", label: "Blok test", type: "toggle", default: true },
          { key: "mChat", label: "Chat", type: "toggle", default: true },
          { key: "mKurslar", label: "Kurslar", type: "toggle", default: true },
          { key: "mBoshqaruv", label: "Boshqaruv", type: "toggle", default: true },
          { key: "mNazorat", label: "Nazorat", type: "toggle", default: true },
          { key: "mMoliya", label: "Moliya", type: "toggle", default: true },
          { key: "mGuruh", label: "Guruh", type: "toggle", default: true },
          { key: "mAsosiy", label: "Asosiy saxifa", type: "toggle", default: true },
          { key: "mMarketing", label: "Marketing", type: "toggle", default: true },
          { key: "mBuyurtma", label: "Buyurtma", type: "toggle", default: true },
          { key: "mOquvchi", label: "O'quvchi", type: "toggle", default: true },
        ],
      },
    ],
  },
  {
    key: "system",
    title: "Tizim va jadval sozlamalari",
    description: "Vaqt, ball va jadvalga oid texnik sozlamalar",
    color: "bg-neutral-700",
    icon: "i-settings",
    groups: [
      {
        title: "TIZIM VA JADVAL SOZLAMALARI",
        fields: [
          { key: "botNoAttendance", label: "Botga davomat qilinmadi", type: "toggle", default: false },
          { key: "tgLinkParent", label: "Telegram guruh havolasi ota-onaga ko'rinsin", type: "toggle", default: false },
          { key: "tgLinkStudent", label: "Telegram guruh havolasi o'quvchiga ko'rinsin", type: "toggle", default: false },
          { key: "botCourseLevels", label: "Botda kurs darajalari ko'rinsin", type: "toggle", default: false },
        ],
      },
      {
        title: "YORDAMCHI O'QITUVCHINI BRON QILISH BLOKINI YOQISH",
        fields: [{ key: "assistantBooking", label: "Yordamchi o'qituvchini bron qilish blokini yoqish", type: "toggle", default: false }],
      },
      {
        fields: [
          { key: "proArchiveDays", label: "Pro arxivda turish vaqti (Max 31)", type: "number", default: 31 },
          { key: "archiveShowDays", label: "Arxivni ko'rsatish vaqti", type: "number", default: 0 },
          { key: "timezone", label: "Vaqt zonasi", type: "select", options: ["+05:00", "+04:00", "+06:00"], default: "+05:00" },
          { key: "scheduleStart", label: "Dars jadvali boshlanish vaqti", type: "time", default: "06:00" },
          { key: "scheduleEnd", label: "Dars jadvali tugash vaqti", type: "time", default: "21:00" },
          { key: "monitoringRefresh", label: "Monitoring yangilanish vaqti", type: "number", default: 0 },
          { key: "maxScore", label: "Maksimal ball (Max 100)", type: "number", default: 100 },
          { key: "minScore", label: "Minimal ball (Max 100)", type: "number", default: 0 },
          { key: "storageLimitGb", label: "Jami xotira cheklovi (GB)", type: "number", default: 0 },
          { key: "storageFreeGb", label: "Bo'sh xotira (GB)", type: "number", default: 0 },
        ],
      },
      {
        title: "MOBIL ILOVALAR HAVOLALARI",
        fields: [
          { key: "forceUpdate", label: "Majburiy yangilash", type: "toggle", default: false },
          { key: "latestVersion", label: "Oxirgi versiya", type: "text", default: "" },
          { key: "iosUrl", label: "iOS ilova havolasi (App Store)", type: "text", default: "" },
          { key: "androidUrl", label: "Android ilova havolasi (Play Store)", type: "text", default: "" },
        ],
      },
    ],
  },
];
