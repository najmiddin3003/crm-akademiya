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
        { label: "📊 O'quv Dashboard", href: "/oquv-dashboard", icon: "i-bar-chart", iconClass: "text-primary", bold: true },
        { label: "Oflayn kurslar", href: "/offline-courses", icon: "i-book" },
        { label: "Onlayn kurs", href: "/online-courses", icon: "i-monitor" },
        { label: "Kategoriya", href: "/edu-category", icon: "i-grid" },
        { label: "📚 Baholash", href: "/baholash-gradebook", icon: "i-bar-chart" },
        { label: "O'quv dasturi", href: "/curriculum", icon: "i-book" },
        { label: "Imtihonlar", href: "/exams", icon: "i-graduation-cap" },
        { label: "🏆 Sertifikatlar", href: "/certificates", icon: "i-graduation-cap" },
        { label: "Shartnoma", href: "/contract", icon: "i-file-plus" },
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
            { label: "💰 Moliya Dashboard", href: "/finance-dashboard", icon: "i-bar-chart", iconClass: "text-primary", bold: true },
            { label: "🚨 Qarzdorlar", href: "/finance-debtors", icon: "i-flag", iconClass: "text-rose-500", bold: true },
            { label: "Kassa audit log", href: "/finance-audit", icon: "i-list-todo" },
            { label: "Xarajatlar", href: "/finance-expenses", icon: "i-file-plus" },
            { label: "Hisobotlar markazi", href: "/finance-report-hub", icon: "i-bar-chart" },
            { label: "Analitika va prognoz", href: "/finance-forecast", icon: "i-zap" },
            { label: "Moliya ruxsatlari", href: "/finance-permissions", icon: "i-grid" },
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
            { label: "📡 Nazorat Dashboard", href: "/nazorat-dashboard", icon: "i-bar-chart", iconClass: "text-primary", bold: true },
            { label: "Davomat", href: "/nazorat-davomat", medium: true },
            { label: "Davomat analitikasi", href: "/nazorat-davomat-analytics" },
            { label: "📊 Feedback tahlili", href: "/nazorat-feedback-analytics", icon: "i-bar-chart", iconClass: "text-pink-500", bold: true },
            { label: "Fikr-mulohaza", href: "/nazorat-feedback" },
          ],
        },
        {
          title: "Hisobotlar",
          items: [
            { label: "⭐ Ko'p faktorli skor", href: "/nazorat-staff-score", icon: "i-star", iconClass: "text-amber-500", bold: true },
            { label: "Xodimlar reytingi", href: "/nazorat-staff-rating" },
            { label: "Qoplash (makeup)", href: "/nazorat-makeup", icon: "i-calendar" },
            { label: "Davomat qilinmagan guruhlar", href: "/nazorat-missed-groups" },
            { label: "Filial health score", href: "/nazorat-branch-health", icon: "i-grid" },
            { label: "Filiallar holati", href: "/nazorat-branches" },
            { label: "Turniket analitikasi", href: "/nazorat-turnstile" },
            { label: "🟢 Real-time monitoring", href: "/nazorat-live", icon: "i-monitor", iconClass: "text-cyan-500", bold: true },
            { label: "Turniket kirish-chiqish analitikasi", href: "/nazorat-turnstile-io" },
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
        { label: "🏛 Boshqaruv Dashboard", href: "/management-dashboard", icon: "i-bar-chart", iconClass: "text-primary", bold: true },
        { label: "Xodimlar", href: "/management-xodimlar", icon: "i-users-group", medium: true },
        { label: "Ruxsat matritsasi", href: "/management-role-perms", icon: "i-grid" },
        { label: "Rollar", href: "/management-rollar", icon: "i-shield" },
        { label: "Filiallar", href: "/management-filiallar", icon: "i-grid" },
        { label: "Jadval tahlili", href: "/management-schedule-analysis", icon: "i-bar-chart" },
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
        { label: "📣 Sotuv Dashboard", href: "/sales-dashboard", icon: "i-bar-chart", iconClass: "text-primary", bold: true },
        { label: "Manba ROI tahlili", href: "/sales-source-roi", icon: "i-zap" },
        { label: "Kampaniyalar", href: "/sales-campaigns", icon: "i-monitor" },
        { label: "Moderatorlar", href: "/sales-moderators", icon: "i-star" },
        { label: "Lid pipeline (CRM)", href: "/sales-pipeline", icon: "i-grid" },
        { label: "Marketing", href: "/sales-marketing", icon: "i-trending-up", medium: true },
        { label: "Savdo plani", href: "/sales-plan", icon: "i-bar-chart" },
        { label: "Yangiliklar", href: "/sales-news", icon: "i-file-plus" },
        { label: "Hikoya", href: "/sales-stories", icon: "i-book" },
        { label: "Xabar shablonlari", href: "/sales-templates", icon: "i-edit" },
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
            { type: "action", label: "📊 Hisobotlar markazi", href: "/reports-dashboard", icon: "i-bar-chart", iconClass: "text-primary" },
            { type: "action", label: "📋 Executive summary", href: "/reports-executive", icon: "i-file-text", iconClass: "text-primary" },
            { type: "action", label: "🧠 Smart analitika", href: "/reports-insights", icon: "i-zap", iconClass: "text-primary" },
            { type: "action", label: "⏰ Rejalashtirilgan", href: "/reports-scheduled", icon: "i-calendar", iconClass: "text-primary" },
            { type: "text", label: "Balans", href: "/reports-balance" },
            { type: "text", label: "Kirim chiqim", href: "/reports-cashflow" },
            { type: "text", label: "Tushum rejasi", href: "/reports-revenue-plan" },
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
            { type: "text", label: "Filiallar holati", href: "/reports-branches-status" },
            { type: "text", label: "Xodimlar reytingi", href: "/reports-staff-rating" },
            { type: "text", label: "Davomat qilinmagan guruhlar", href: "/reports-missed-groups" },
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
        { label: "⚙ Sozlamalar markazi", href: "/settings-hub", semibold: true },
        { label: "🎨 Tema va ko'rinish", href: "/settings-appearance", medium: true },
        { label: "🪪 Profil", href: "/settings-profile", medium: true },
        { label: "🔔 Bildirishnomalar", href: "/settings-notifications", medium: true },
        { label: "🛡 Xavfsizlik", href: "/settings-security", medium: true },
        { label: "💾 Backup va ma'lumot", href: "/settings-data", medium: true },
        { label: "Umumiy sozlamalar", href: "/settings-general", medium: true, primary: true },
        { label: "Moliya", href: "/settings-finance" },
        { label: "O'quv", href: "/settings-academic" },
        { label: "Sotuv va marketing", href: "/settings-sales" },
        { label: "Boshqaruv", href: "/settings-management" },
        { label: "Integratsiyalar", href: "/settings-integrations" },
        { label: "Gamifikatsiya", href: "/settings-gamification" },
      ],
    },
  },
];
