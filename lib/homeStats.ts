// BOSH SAHIFA (/home) TEPASIDAGI 12 TA KPI KARTASI.
//
// Referens: akademiya.edutizim.uz/home — dars jadvali ustida ikki qatorda
// 12 ta karta turadi. Kartalar FAQAT bosh sahifada: "Guruh > Dars jadvali"
// (/groups-schedule) da ular yo'q (foydalanuvchi so'rovi: "shu pageda
// statistika kerak emas ekan"), holbuki ikkala manzil ham bitta
// komponentni — components/groups/GroupSchedulePage.tsx ni ko'rsatadi.
//
// UCHTA QOIDA:
//
// 1) HAR BIR SON o'zi olib boradigan sahifa qanday hisoblasa, AYNAN shunday
//    hisoblanadi. Aks holda kartadagi son bilan sahifadagi qatorlar soni
//    bir-biriga to'g'ri kelmasdi. Shu bois filtrlar quyida takrorlangan va
//    har birining yonida manbasi yozilgan. Naqsh (va bir xil filtrlar):
//    app/api/sidebar-counts/route.ts.
//
// 2) MANBASI YO'Q SON O'YLAB TOPILMAYDI — `null` qaytadi va kartada "—"
//    chiziladi. To'rtta ko'rsatkich uchun bazada hech qanday manba yo'q;
//    ilgari ular 0 ko'rsatardi va bu "hech kim yo'q" degan yolg'on edi.
//
// 3) RUXSAT. Bosh sahifa HAMMAGA ochiq (lib/permissions.ts →
//    ALWAYS_ALLOWED_PATHS), shuning uchun karta o'zi olib boradigan
//    sahifani ko'ra olmaydigan xodimga UMUMAN chizilmaydi va soni ham
//    so'ralmaydi — yopiq bo'lim bosh sahifadan orqa eshik bilan ochilmasin.
//
// SANOQ SERVERDA. Ilgari bu sonlar klientda hisoblanardi: sahifa
// /api/orders (barcha buyurtmalar) va /api/pupils (6 732 o'quvchi, ~2.7 MB)
// ni to'liq tortib olib, brauzerda `filter().length` qilardi. Endi bir
// nechta `countDocuments` serverda ishlaydi va simdan faqat sonlar o'tadi.

import type { Db, Document, Filter } from "mongodb";
import { withBranch, type BranchScope } from "./branchScope";
import { withLeadScope } from "./leadScope";

export interface HomeKpi {
  key: string;
  label: string;
  /**
   * Ko'rsatkich qiymati. `null` — bu son uchun bazada MANBA YO'Q; kartada
   * "—" chiziladi va karta bosilmaydi (0 ko'rsatish yolg'on bo'lardi:
   * "hech kim yo'q" degani emas, "hisoblab bo'lmaydi" degani).
   */
  value: number | null;
  /** Ikonka doirasi foni va rangi (referensdagi ranglarga yaqin). */
  bg: string;
  fg: string;
  /** Navbar/Sidebar sprite'idagi ikonka id (<defs> ichida). */
  icon: string;
  /** Bosilganda o'tadigan sahifa (value === null bo'lsa bosilmaydi). */
  href: string;
  /** `value === null` bo'lganda foydalanuvchiga ko'rsatiladigan sabab. */
  note?: string;
}

/** Karta ta'rifi — qiymatsiz qismi (tartib ham shu yerda, referensdagidek). */
type KpiMeta = Omit<HomeKpi, "value">;

const KPIS: readonly KpiMeta[] = [
  { key: "orders", label: "Buyurtmalar", bg: "#dcfce7", fg: "#16a34a", icon: "i-user-plus", href: "/orders-list" },
  { key: "first-lesson", label: "Birinchi darsga keladiganlar", bg: "#dbeafe", fg: "#2563eb", icon: "i-users-group", href: "/first-lessons" },
  { key: "new", label: "Yangi o'quvchilar", bg: "#f3e8ff", fg: "#9333ea", icon: "i-user", href: "/new-students" },
  { key: "active", label: "Aktiv o'quvchilar", bg: "#dcfce7", fg: "#16a34a", icon: "i-users-group", href: "/active-students" },
  { key: "left-order", label: "Buyurtmadan ketganlar", bg: "#fee2e2", fg: "#dc2626", icon: "i-file-text", href: "/orders-list" },
  // MANBA YO'Q: "yangi o'quvchilikdan ketish" hodisasi hech qayerda
  // yozilmaydi — Order'da ham, Pupil'da ham bunday maydon (ketgan sana /
  // sabab) yo'q. Ilgari bu yerda shunchaki 0 turardi, ya'ni "hech kim
  // ketmagan" deb ko'rsatilardi; bu ham noto'g'ri ma'lumot edi.
  { key: "left-new", label: "Yangi o'quvchidan ketganlar", bg: "#fee2e2", fg: "#dc2626", icon: "i-user", href: "/new-students", note: "Bazada manba yo'q: buyurtma/o'quvchi yozuvida \"ketdi\" hodisasi saqlanmaydi." },
  // MANBA YO'Q: ilgari bu son buyurtmaning "Yakunlandi" holatidan
  // hisoblanardi, lekin bu qiymat bazaga HECH QAYERDA yozilmaydi (uni
  // faqat demo generator qo'yardi) — ya'ni haqiqiy bazada doim 0 edi.
  { key: "left-active", label: "Aktiv o'quvchidan ketganlar", bg: "#fee2e2", fg: "#dc2626", icon: "i-user", href: "/archive-students", note: "Bazada manba yo'q: aktivlikdan chiqish hodisasi (\"Yakunlandi\") saqlanmaydi." },
  // MANBA YO'Q: tizim o'quvchi QANCHA TO'LASHI KERAKLIGINI yuritmaydi.
  // /api/students/balances faqat TO'LANGAN pulni (payIn) qo'shadi va u
  // hech qachon manfiy bo'lmaydi (kirim summasi musbat bo'lishi majburiy —
  // app/api/cashboxes/[id]/adjust). Ya'ni "balansi manfiy o'quvchilar"
  // doim 0 chiqardi — bu hisoblangandek ko'rinadigan qattiq 0.
  // /reports-unpaid dagi `unpaid_students` kolleksiyasini ham hech bir kod
  // to'ldirmaydi.
  { key: "debtors", label: "Qarzdorlar", bg: "#e5e7eb", fg: "#111827", icon: "i-wallet", href: "/reports-unpaid", note: "Bazada manba yo'q: to'lanishi kerak bo'lgan summa yuritilmaydi, faqat to'langan pul saqlanadi." },
  { key: "groups", label: "Guruhlar", bg: "#dbeafe", fg: "#2563eb", icon: "i-users-group", href: "/groups" },
  // MANBA YO'Q: TransactionEntry'da "birinchi to'lov" tushunchasi yo'q —
  // to'lov yozuvi o'quvchining nechanchi to'lovi ekanini bilmaydi va
  // o'quvchi kartasida ham birinchi to'lov sanasi saqlanmaydi.
  { key: "first-paid", label: "Birinchi to'lovni qilganlar", bg: "#fef9c3", fg: "#ca8a04", icon: "i-wallet", href: "/finance-transactions", note: "Bazada manba yo'q: to'lov yozuvida \"birinchi to'lov\" belgisi saqlanmaydi." },
  // Muzlatilganlar /students-list da holat filtri orqali ko'rinadi
  // (alohida sahifa yo'q).
  { key: "frozen", label: "Muzlatilgan", bg: "#cffafe", fg: "#0891b2", icon: "i-archive", href: "/students-list" },
  { key: "archive", label: "Arxivlar", bg: "#e5e7eb", fg: "#6b7280", icon: "i-archive", href: "/archive-students" },
];

/** Lid qamrovi (`withLeadScope`) kerak bo'ladigan kartalar. */
const LEAD_KEYS = new Set(["orders", "first-lesson", "new", "left-order"]);

export interface HomeKpiInput {
  db: Db;
  /** Navbardagi filial tanlovi — lidlar shu bo'yicha kesiladi. */
  scope: BranchScope;
  /**
   * Joriy xodim ismi — lid qamrovining ikkinchi yarmi ("shu filial YOKI
   * O'ZIM qo'shganim"). Lid sanoqlari kerak bo'lmasa bo'sh satr yetarli.
   */
  author: string;
  /** Sahifani ko'ra oladimi — `isPathAllowed(href, permissions)`. */
  can: (href: string) => boolean;
}

/**
 * Xodim ko'ra oladigan kartalar, sonlari bilan (referensdagi tartibda).
 *
 * Ko'rilmaydigan karta ro'yxatga UMUMAN tushmaydi — soni ham so'ralmaydi,
 * ya'ni Atlas'ga ortiqcha borilmaydi.
 */
export async function computeHomeKpis({ db, scope, author, can }: HomeKpiInput): Promise<HomeKpi[]> {
  const visible = KPIS.filter((k) => can(k.href));
  const need = new Set(visible.map((k) => k.key));
  const values: Record<string, number | undefined> = {};
  const jobs: Promise<unknown>[] = [];

  const count = (key: string, collection: string, filter: Filter<Document>) => {
    jobs.push(db.collection(collection).countDocuments(filter).then((n) => { values[key] = n; }));
  };

  // Lidlar qamrovi ikkala sanoq uchun bir marta tayyorlanadi ("shu filial
  // YOKI o'zim qo'shganim" — lib/leadScope.ts). /orders-list va
  // /first-lessons sahifalari ham, sidebar sonlari ham aynan shu qamrovda.
  const leadFilter = [...need].some((k) => LEAD_KEYS.has(k))
    ? withLeadScope<Document>({}, scope, author)
    : null;

  if (leadFilter) {
    // /orders-list (components/orders/OrdersPage.tsx): filtrsiz holatda
    // "Umumiy soni" = barcha buyurtmalar.
    if (need.has("orders")) count("orders", "orders", leadFilter);
    // /first-lessons (components/leads/FirstLessonsPage.tsx → rows):
    // birinchi dars sanasi belgilangan buyurtmalar.
    if (need.has("first-lesson")) {
      count("first-lesson", "orders", { $and: [leadFilter, { firstLesson: { $nin: ["", null] } }] });
    }
    // /new-students (components/students/NewStudentsPage.tsx): status "Yangi".
    if (need.has("new")) count("new", "orders", { $and: [leadFilter, { status: "Yangi" }] });
    // Buyurtmadan ketganlar — bekor qilingan buyurtmalar. /orders-list dagi
    // "Holatlar" filtrida "Bekor qilingan" tanlansa aynan shu son chiqadi.
    if (need.has("left-order")) count("left-order", "orders", { $and: [leadFilter, { status: "Bekor qilindi" }] });
  }

  // O'QUVCHILAR FILIAL BO'YICHA KESILADI — /api/pupils ham shunday
  // (qaror 2026-09-07). Kartadagi son va o'sha kartani bosganda ochiladigan
  // ro'yxat BIR XIL qamrovda bo'lishi shart: "Aktiv o'quvchilar 4 276" deb
  // turib, ro'yxatda 1 ta chiqishi — eng qiyin sezilib, eng ko'p ishonchni
  // buzadigan xato.
  //
  // Holat filtri sahifalardagi bilan bir xil: ular /api/pupils ga
  // `?status=Aktiv` / `?status=Arxiv` yuboradi va route uni to'g'ridan-to'g'ri
  // `filter.status` ga qo'yadi.
  if (need.has("active")) count("active", "pupils", withBranch({ status: "Aktiv" }, scope));
  if (need.has("frozen")) count("frozen", "pupils", withBranch({ status: "Muzlatilgan" }, scope));
  if (need.has("archive")) count("archive", "pupils", withBranch({ status: "Arxiv" }, scope));

  // FILIAL FILTRI ATAYLAB YO'Q — /groups sahifasi ham kesmaydi
  // (lib/listQueries.ts, kelishilgan qaror). Qo'shilsa karta va sahifa
  // bir-biriga zid son ko'rsatardi.
  if (need.has("groups")) count("groups", "groups", {});

  await Promise.all(jobs);

  // Sanoq berilmagan kalit — manbasi yo'q karta: `undefined ?? null` → "—".
  return visible.map((k) => ({ ...k, value: values[k.key] ?? null }));
}
