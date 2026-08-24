// Dars jadvali sahifasining tepasidagi KPI kartalari (referens:
// akademiya.edutizim.uz/home — jadval ustida ikki qatorda 12 ta karta).
//
// MUHIM: sonlar shu yerda mustaqil to'qib chiqarilmaydi. Har biri tegishli
// sahifa qanday hisoblasa, AYNAN shunday hisoblanadi — aks holda kartadagi
// son bilan sahifadagi qatorlar soni bir-biriga to'g'ri kelmay qolardi.
// Shuning uchun quyida o'sha sahifalardagi shartlar takrorlangan va har biri
// yonida qaysi sahifadan olingani yozilgan.
//
// Ilgari bu fayl o'sha qoidani BUZAR edi: 12 tadan 10 tasi createInitialOrders()
// (502 ta soxta demo buyurtma) va genBalance() dan, ya'ni `i % 13`, `i % 5`
// kabi indeks arifmetikasidan chiqardi. Kartadagi son bazadagi hech narsaga
// bog'liq emas edi va sahifaga o'tilganda butunlay boshqa raqam ko'rinardi.
// Endi hamma qiymat chaqiruvchidan kelgan HAQIQIY ma'lumotdan hisoblanadi,
// manbasi yo'qlari esa o'ylab topilmaydi — `null` qaytadi va sahifada "—"
// ko'rinadi (loyihaning "soxta son yozilmaydi" qoidasi).

import type { Order } from "@/lib/ordersData";
import type { Pupil } from "@/lib/pupilsData";
import { pupilStatusOf } from "@/lib/pupilsData";

export interface ScheduleKpi {
  key: string;
  label: string;
  /**
   * Ko'rsatkich qiymati. `null` — bu son uchun bazada MANBA YO'Q; sahifada
   * "—" chiziladi va karta bosilmaydi (0 ko'rsatish yolg'on bo'lardi:
   * "hech kim yo'q" degani emas, "hisoblab bo'lmaydi" degani).
   */
  value: number | null;
  /** Ikonka doirasi foni va rangi (referensdagi ranglarga yaqin). */
  bg: string;
  fg: string;
  /** Sidebar sprite'idagi ikonka id (Sidebar.tsx <defs>). */
  icon: string;
  /** Bosilganda o'tadigan sahifa (value === null bo'lsa bosilmaydi). */
  href: string;
  /** `value === null` bo'lganda foydalanuvchiga ko'rsatiladigan sabab. */
  note?: string;
}

export interface ScheduleKpiInput {
  /** /api/orders — MongoDB `orders` (barcha buyurtmalar). */
  orders: Order[];
  /** /api/pupils — MongoDB `pupils` (barcha o'quvchilar). */
  pupils: Pupil[];
  /** /api/groups dagi guruhlar soni. */
  groupCount: number;
  /** Birinchi darsga yozilganlar soni (/first-lessons bilan bir xil shart). */
  firstLessonCount: number;
}

/**
 * 12 ta KPI. Hammasi chaqiruvchi bergan haqiqiy ma'lumotdan hisoblanadi;
 * manbasi bo'lmagan to'rttasi `null` qaytaradi.
 */
export function computeScheduleKpis({
  orders,
  pupils,
  groupCount,
  firstLessonCount,
}: ScheduleKpiInput): ScheduleKpi[] {
  // O'quvchi holatlari — pupils.status (lib/pupilsData.ts). Yozuvda holat
  // bo'lmasa pupilStatusOf() "Aktiv" deb hisoblaydi, ya'ni /active-students,
  // /students-list va /archive-students sahifalari bilan bir xil qoida.
  let active = 0;
  let frozen = 0;
  let archived = 0;
  for (const p of pupils) {
    const st = pupilStatusOf(p);
    if (st === "Aktiv") active++;
    else if (st === "Muzlatilgan") frozen++;
    else if (st === "Arxiv") archived++;
  }

  return [
    // /orders-list (components/orders/OrdersPage.tsx): filtrsiz holatda
    // "Umumiy soni" = barcha buyurtmalar.
    { key: "orders", label: "Buyurtmalar", value: orders.length, bg: "#dcfce7", fg: "#16a34a", icon: "i-user-plus", href: "/orders-list" },
    // /first-lessons (components/leads/FirstLessonsPage.tsx → rows):
    // birinchi dars sanasi belgilangan buyurtmalar.
    { key: "first-lesson", label: "Birinchi darsga keladiganlar", value: firstLessonCount, bg: "#dbeafe", fg: "#2563eb", icon: "i-users-group", href: "/first-lessons" },
    // /new-students (components/students/NewStudentsPage.tsx): status "Yangi".
    { key: "new", label: "Yangi o'quvchilar", value: orders.filter((o) => o.status === "Yangi").length, bg: "#f3e8ff", fg: "#9333ea", icon: "i-user", href: "/new-students" },
    // /active-students: pupils.status === "Aktiv".
    { key: "active", label: "Aktiv o'quvchilar", value: active, bg: "#dcfce7", fg: "#16a34a", icon: "i-users-group", href: "/active-students" },
    // Buyurtmadan ketganlar — bekor qilingan buyurtmalar. /orders-list dagi
    // "Holatlar" filtrida "Bekor qilingan" tanlansa aynan shu son chiqadi.
    { key: "left-order", label: "Buyurtmadan ketganlar", value: orders.filter((o) => o.status === "Bekor qilindi").length, bg: "#fee2e2", fg: "#dc2626", icon: "i-file-text", href: "/orders-list" },
    // MANBA YO'Q: "yangi o'quvchilikdan ketish" hodisasi hech qayerda
    // yozilmaydi — Order'da ham, Pupil'da ham bunday maydon (ketgan sana /
    // sabab) yo'q. Ilgari bu yerda shunchaki 0 turardi, ya'ni "hech kim
    // ketmagan" deb ko'rsatilardi; bu ham noto'g'ri ma'lumot edi.
    { key: "left-new", label: "Yangi o'quvchidan ketganlar", value: null, bg: "#fee2e2", fg: "#dc2626", icon: "i-user", href: "/new-students", note: "Bazada manba yo'q: buyurtma/o'quvchi yozuvida \"ketdi\" hodisasi saqlanmaydi." },
    // MANBA YO'Q: ilgari bu son buyurtmaning "Yakunlandi" holatidan
    // hisoblanardi, lekin bu qiymat bazaga HECH QAYERDA yozilmaydi (uni
    // faqat demo generator qo'yardi) — ya'ni haqiqiy bazada doim 0 edi.
    { key: "left-active", label: "Aktiv o'quvchidan ketganlar", value: null, bg: "#fee2e2", fg: "#dc2626", icon: "i-user", href: "/archive-students", note: "Bazada manba yo'q: aktivlikdan chiqish hodisasi (\"Yakunlandi\") saqlanmaydi." },
    // MANBA YO'Q: tizim o'quvchi QANCHA TO'LASHI KERAKLIGINI yuritmaydi.
    // /api/students/balances faqat TO'LANGAN pulni (payIn) qo'shadi va u
    // hech qachon manfiy bo'lmaydi (kirim summasi musbat bo'lishi
    // majburiy — app/api/cashboxes/[id]/adjust). Ya'ni "balansi manfiy
    // o'quvchilar" doim 0 chiqardi — bu hisoblangandek ko'rinadigan
    // qattiq 0. /reports-unpaid dagi `unpaid_students` kolleksiyasini ham
    // hech bir kod to'ldirmaydi.
    { key: "debtors", label: "Qarzdorlar", value: null, bg: "#e5e7eb", fg: "#111827", icon: "i-wallet", href: "/reports-unpaid", note: "Bazada manba yo'q: to'lanishi kerak bo'lgan summa yuritilmaydi, faqat to'langan pul saqlanadi." },
    { key: "groups", label: "Guruhlar", value: groupCount, bg: "#dbeafe", fg: "#2563eb", icon: "i-users-group", href: "/groups" },
    // MANBA YO'Q: TransactionEntry'da "birinchi to'lov" tushunchasi yo'q —
    // to'lov yozuvi o'quvchining nechanchi to'lovi ekanini bilmaydi va
    // o'quvchi kartasida ham birinchi to'lov sanasi saqlanmaydi.
    { key: "first-paid", label: "Birinchi to'lovni qilganlar", value: null, bg: "#fef9c3", fg: "#ca8a04", icon: "i-wallet", href: "/finance-transactions", note: "Bazada manba yo'q: to'lov yozuvida \"birinchi to'lov\" belgisi saqlanmaydi." },
    // Muzlatilganlar /students-list da holat filtri orqali ko'rinadi
    // (alohida sahifa yo'q).
    { key: "frozen", label: "Muzlatilgan", value: frozen, bg: "#cffafe", fg: "#0891b2", icon: "i-archive", href: "/students-list" },
    // /archive-students: pupils.status === "Arxiv".
    { key: "archive", label: "Arxivlar", value: archived, bg: "#e5e7eb", fg: "#6b7280", icon: "i-archive", href: "/archive-students" },
  ];
}
