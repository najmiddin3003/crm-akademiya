// Sidebar navigatsiyasining barcha matn/havolalari shu yerdan keladi.
// Sidebar.tsx shu massivdan render qiladi (matnlar kod ichida qattiq
// yozilmagan). Backend ulanganda badge/count sonlari real qiymatga almashadi.
//
// Har bir top-level element:
//   key         — ichki identifikator (flyout holatini boshqarish uchun)
//   icon        — chap ikonka sprite id
//   label       — ko'rinadigan matn
//   href        — bosilganda o'tadigan sahifa (agar to'g'ridan-to'g'ri havola bo'lsa)
//   mobileHref  — mobil menyuda bosilganda o'tadigan sahifa
//   badge       — o'ngdagi qizil belgi (masalan "34")
//   mobileActive— mobil menyuda ko'k (active) ko'rinishda turadimi
//   menu        — hover flyout ma'lumoti (yo'q bo'lsa — oddiy havola)
//   hidden      — bo'lim sidebarda CHIZILMAYDI (Sidebar.tsx), lekin
//                 ruxsatlar daraxtida va route sifatida saqlanadi. Vaqtincha
//                 olib turish uchun: qatorni o'chirsangiz qaytadi.
//
// Chevron (o'ng tomondagi ochiluvchi belgi) avtomatik: menu bor va href yo'q
// bo'lsa ko'rsatiladi (Sozlamalar — menu + href, shuning uchun chevronsiz).

export const SIDEBAR_ITEMS = [
  {
    key: "tasks",
    icon: "i-list-todo",
    label: "Topshiriqlar",
    href: "/tasks",
    mobileHref: "/tasks",
    badge: "0",
  },
  {
    key: "leads",
    icon: "i-megaphone",
    label: "Lidlar",
    mobileHref: "/orders-list",
    badge: "34",
    mobileBadge: "34",
    menu: {
      variant: "list",
      width: 256,
      items: [
        { label: "Buyurtmalar ro'yxati", href: "/orders-list", icon: "i-list-todo", count: "502" },
        { label: "Birinchi darsga yozilganlar", href: "/first-lessons", icon: "i-graduation-cap", count: "1411" },
      ],
    },
  },
  {
    key: "groups",
    icon: "i-users-group",
    label: "Guruh",
    mobileHref: "/groups",
    menu: {
      variant: "list",
      width: 256,
      items: [
        { label: "Guruh", href: "/groups", icon: "i-users-group", count: "89" },
        { label: "Barcha vazifalar", href: "/groups-tasks", icon: "i-list-todo" },
        { label: "Dars jadvali", href: "/groups-schedule", icon: "i-calendar" },
        { label: "Xonalar", href: "/groups-rooms", icon: "i-monitor" },
        { label: "Jihozlar", href: "/groups-equipments", icon: "i-grid" },
        { label: "Guruh o'quvchilari", href: "/groups-students", icon: "i-user" },
      ],
    },
  },
  {
    key: "students",
    icon: "i-user",
    label: "O'quvchilar",
    mobileHref: "/students-list",
    menu: {
      variant: "list",
      width: 288,
      items: [
        { label: "Yangi o'quvchilar", href: "/new-students", icon: "i-user" },
        { label: "Aktiv o'quvchilar", href: "/active-students", icon: "i-users-group" },
        { label: "Arxiv o'quvchilar", href: "/archive-students", icon: "i-archive" },
        { label: "O'quvchilar ro'yxati", href: "/students-list", icon: "i-list-todo" },
        { label: "Ota-ona", href: "/parents", icon: "i-users-group" },
        { label: "Joriy oyda obunasi tugaydiganlar", href: "/expiring-subs", icon: "i-calendar" },
        { label: "O'quvchilar manzillari", href: "/student-addresses", icon: "i-monitor" },
      ],
    },
  },
  {
    key: "education",
    icon: "i-book",
    label: "O'quv bo'limi",
    mobileHref: "/online-courses",
    mobileActive: true,
    menu: {
      variant: "list",
      width: 240,
      items: [
        { label: "Oflayn kurslar", href: "/offline-courses", icon: "i-book" },
        { label: "Onlayn kurs", href: "/online-courses", icon: "i-monitor" },
        { label: "Kategoriya", href: "/edu-category", icon: "i-grid" },
        { label: "Mavsumiy baholash", href: "/seasonal-assessment", icon: "i-calendar" },
        { label: "Shartnoma", href: "/contract", icon: "i-file-plus" },
      ],
    },
  },
  {
    key: "blok-test",
    icon: "i-file-text",
    label: "Blok test",
    // VAQTINCHA YASHIRILGAN (2026-09-05, markaz so'rovi bilan).
    //
    // QAYTA YOQISH: shu bitta `hidden: true` qatorini o'chirish kifoya —
    // boshqa hech narsaga tegish shart emas.
    //
    // NEGA O'CHIRIB TASHLANMADI. Bu massiv sidebarning emas, RUXSATLAR
    // daraxtining ham yagona manbasi (lib/permissions.ts →
    // PERMISSION_GROUPS). Element olib tashlansa ikkita sahifa ruxsatlar
    // olamidan ham tushib ketardi va scripts/gen-api-permissions.mjs
    // ularning API route'larini "sessiya yetarli" guruhiga o'tkazib
    // yuborardi — ya'ni yashirish niyati aksincha, ruxsatni KENGAYTIRIB
    // qo'yardi. Shu bois faqat sidebar chizig'i kesiladi.
    //
    // Sahifalarning o'zi ishlab turaveradi: to'g'ridan-to'g'ri havola
    // bilan ochsa ochiladi, rol ruxsati ham eski holicha. Yashirilgani —
    // menyudan olib turish, o'chirish emas.
    hidden: true,
    mobileHref: "/blok-test-turlari",
    menu: {
      variant: "list",
      width: 224,
      items: [
        { label: "Blok test turlari", href: "/blok-test-turlari", icon: "i-list-todo" },
        { label: "Blok testlar", href: "/blok-testlar", icon: "i-file-text" },
      ],
    },
  },
  {
    key: "imtihon",
    icon: "i-award",
    label: "Imtihon",
    mobileHref: "/imtihon",
    menu: {
      variant: "list",
      width: 256,
      items: [
        { label: "Oylik imtihon", href: "/imtihon", icon: "i-calendar" },
        { label: "UzBMB", href: "/imtihon?tab=uzbmb", icon: "i-award", count: "189" },
      ],
    },
  },
  {
    key: "finance",
    icon: "i-wallet",
    label: "Moliya",
    mobileHref: "/finance-cash",
    menu: {
      variant: "grid",
      width: 680,
      cols: 3,
      columns: [
        {
          title: "Amallar",
          items: [
            { label: "Kassalar", href: "/finance-cash", medium: true, primary: true },
            { label: "Bonus", href: "/finance-bonus" },
            { label: "Jarima", href: "/finance-penalty" },
            { label: "Oylik chiqarish", href: "/finance-payroll" },
          ],
        },
        {
          title: "Hisobotlar",
          items: [
            { label: "Kirim chiqim", href: "/finance-cashflow" },
            { label: "Tushum rejasi", href: "/finance-revenue-plan" },
            { label: "Moliya analitikasi", href: "/finance-analytics" },
            { label: "Moliya hisobotlari", href: "/finance-reports" },
            { label: "Moliya hisobotlari (P&L)", href: "/finance-pnl" },
            { label: "Pul oqimi", href: "/finance-flow" },
          ],
        },
        {
          title: "Ma'lumotlar",
          items: [
            { label: "Tranzaksiya turi", href: "/finance-tx-types" },
            { label: "Tranzakisyalar", href: "/finance-transactions" },
            { label: "Rejalashtirilgan xarajatlar", href: "/finance-planned" },
            { label: "Shartnoma", href: "/finance-fin-contract" },
            { label: "Sinxronizatsiya", href: "/finance-sync" },
          ],
        },
      ],
    },
  },
  {
    key: "nazorat",
    icon: "i-eye",
    label: "Nazorat",
    mobileHref: "/nazorat-davomat",
    menu: {
      variant: "grid",
      width: 520,
      cols: 2,
      columns: [
        {
          title: "Amallar",
          items: [
            { label: "Davomat", href: "/nazorat-davomat", medium: true },
            { label: "Davomat analitikasi", href: "/nazorat-davomat-analytics" },
            { label: "Fikr-mulohaza", href: "/nazorat-feedback" },
          ],
        },
        {
          title: "Hisobotlar",
          items: [
            { label: "Xodimlar reytingi", href: "/nazorat-staff-rating" },
            { label: "Davomat qilinmagan guruhlar", href: "/nazorat-missed-groups" },
            { label: "Filiallar holati", href: "/nazorat-branches" },
            { label: "Turniket analitikasi", href: "/nazorat-turnstile" },
            { label: "Turniket kirish-chiqish analitikasi", href: "/nazorat-turnstile-io" },
            { label: "Support analitikasi", href: "/nazorat-support-analytics" },
            { label: "SMS analitikasi", href: "/nazorat-sms-analytics" },
          ],
        },
      ],
    },
  },
  {
    key: "boshqaruv",
    icon: "i-shield",
    label: "Boshqaruv",
    mobileHref: "/management-xodimlar",
    menu: {
      variant: "list",
      width: 240,
      items: [
        { label: "Xodimlar", href: "/management-xodimlar", icon: "i-users-group", medium: true },
        { label: "Ishga qabul (CV)", href: "/management-cv", icon: "i-file-text" },
        { label: "Rollar", href: "/management-rollar", icon: "i-shield" },
        { label: "Filiallar", href: "/management-filiallar", icon: "i-grid" },
        { label: "Ish jadvali", href: "/management-ish-jadvali", icon: "i-calendar" },
      ],
    },
  },
  {
    key: "sales",
    icon: "i-trending-up",
    label: "Sotuv va marketing",
    mobileHref: "/sales-marketing",
    menu: {
      variant: "list",
      width: 240,
      items: [
        { label: "Marketing", href: "/sales-marketing", icon: "i-trending-up", medium: true },
        { label: "O'quvchilar oqimi", href: "/sales-sources", icon: "i-bar-chart" },
        { label: "Savdo plani", href: "/sales-plan", icon: "i-bar-chart" },
        { label: "Yangiliklar", href: "/sales-news", icon: "i-file-plus" },
        { label: "Hikoya", href: "/sales-stories", icon: "i-book" },
        { label: "SMS shablonlari", href: "/sales-sms", icon: "i-monitor" },
        { label: "Xabarlar ro'yhati", href: "/sales-messages", icon: "i-list-todo" },
      ],
    },
  },
  {
    key: "reports",
    icon: "i-bar-chart",
    label: "Hisobotlar",
    mobileHref: "/reports-funnel",
    menu: {
      variant: "reports",
      width: 900,
      columns: [
        {
          title: "Sotuv va marketing",
          items: [
            { type: "highlight", label: "Sotuv voronkasi", href: "/reports-funnel" },
          ],
        },
        {
          title: "Moliya",
          items: [
            // BALANS HISOBOTI MENYUDAN VAQTINCHA OLIB TURILDI.
            //
            // Sabab: app/api/reports/balance/route.ts:104 da
            // `salary = bonus - penalty - advance` — hisoblangan ish
            // haqi (oklad yoki foiz) hadi UMUMAN yo'q. Natijada 54
            // xodimning 54 tasida "Ish haqi" = minus avans chiqadi va
            // butun jamoa qarzdorday ko'rinadi. Bu Oylik sahifasiga
            // (SalaryCreatePage) to'g'ridan-to'g'ri zid: o'sha yerda
            // 2026-08 uchun qoldiq +88 217 630, bu yerda esa
            // -1 065 081 400.
            //
            // Route'ning O'Z izohi (15-21-qatorlar) buni vaqtinchalik
            // deb yozgan: "Alohida oylik jadvali paydo bo'lsa, shu
            // formulani almashtirish kifoya". O'sha jadval endi bor —
            // lib/payrollSources.ts:164 buildPayrollRows.
            //
            // Tuzatishdan oldin BITTA QAROR kerak: Balans butun tarixni
            // jamlaydi, Oylik esa bitta oyni. Hisobot qaysi davrni
            // ko'rsatishi kerakligini kelishib olish shart, aks holda
            // ikkita to'g'ri raqam yana bir-biriga zid chiqadi.
            // { type: "text", label: "Balans", href: "/reports-balance" },
            // Referensda bu ikkisi Moliya bo'limidagi sahifalarning
            // AYNAN O'ZI (faqat /reports/ prefiksi bilan) — shuning uchun
            // yangi sahifa emas, mavjud route'ga havola.
            { type: "text", label: "Kirim chiqim", href: "/finance-cashflow" },
            { type: "text", label: "Tushum rejasi", href: "/finance-revenue-plan" },
            { type: "text", label: "O'quvchining umumiy to'lanmag...", href: "/reports-unpaid", truncate: true },
            { type: "text", label: "Kurs narxidan farqli to'lovlar tra...", href: "/reports-diff-payments", truncate: true },
            { type: "text", label: "Bekor qilingan to'lovlar", href: "/reports-cancelled" },
            { type: "text", label: "Umumiy chegirmalar", href: "/reports-discounts" },
          ],
        },
        {
          title: "O'quv",
          items: [
            { type: "text", label: "O'qituvchilar samaradorligi", href: "/reports-teachers-perf" },
            { type: "text", label: "Adminstratorlar samaradorligi", href: "/reports-admins-perf" },
            { type: "text", label: "Ketish sabablari", href: "/reports-leave-reasons" },
            { type: "text", label: "Xonalar analitikasi", href: "/reports-rooms" },
            { type: "text", label: "O'quv markazga ishlab berilgan ...", href: "/reports-served", truncate: true },
            { type: "text", label: "Davomati bekor qilinganlar anali...", href: "/reports-cancelled-attend", truncate: true },
          ],
        },
        {
          title: "Nazorat",
          items: [
            // Uchalasi ham Nazorat bo'limidagi sahifalarning aynan o'zi
            // (referensda /reports/ prefiksi bilan takrorlangan).
            { type: "text", label: "Filiallar holati", href: "/nazorat-branches" },
            { type: "text", label: "Xodimlar reytingi", href: "/nazorat-staff-rating" },
            { type: "text", label: "Davomat qilinmagan guruhlar", href: "/nazorat-missed-groups" },
          ],
        },
      ],
    },
  },
  {
    key: "settings",
    icon: "i-settings",
    label: "Sozlamalar",
    href: "/settings-general",
    mobileHref: "/settings-general",
    menu: {
      variant: "list",
      width: 224,
      items: [
        { label: "🪪 Profil", href: "/settings-profile", medium: true },
        { label: "🛡 Xavfsizlik", href: "/settings-security", medium: true },
        { label: "Umumiy sozlamalar", href: "/settings-general", medium: true, primary: true },
        { label: "Moliya", href: "/settings-finance" },
        { label: "O'quv", href: "/settings-academic" },
        { label: "Sotuv va marketing", href: "/settings-sales" },
        { label: "Boshqaruv", href: "/settings-management" },
        { label: "Integratsiyalar", href: "/settings-integrations" },
        { label: "Ilova sozlamalari", href: "/settings-app" },
        { label: "Gamifikatsiya", href: "/settings-gamification" },
      ],
    },
  },
];
