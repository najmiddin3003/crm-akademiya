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
import { withBranch, withPupilBranch, type BranchScope } from "./branchScope";
import { withLeadScope } from "./leadScope";
import { computeDebtors } from "./debtors";
import { uzDateIso } from "./uzTime";

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
  // 20.09.2026 gacha bu karta "—" edi: tizim o'quvchi QANCHA TO'LASHI
  // KERAKLIGINI yuritmasdi (/api/students/balances faqat to'langan pulni
  // qo'shadi). Endi manba bor — lib/debtors.ts: davomatda belgilangan
  // darslar × bitta dars narxi − to'langan; karta /reports-unpaid
  // sahifasining "Qarzdorlar" rejimi bilan AYNAN bir xil sonni beradi
  // (bugungi sana, joriy filial guruhlari).
  { key: "debtors", label: "Qarzdorlar", bg: "#e5e7eb", fg: "#111827", icon: "i-wallet", href: "/reports-unpaid" },
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
  if (need.has("active")) count("active", "pupils", withPupilBranch({ status: "Aktiv" }, scope));
  if (need.has("frozen")) count("frozen", "pupils", withPupilBranch({ status: "Muzlatilgan" }, scope));
  if (need.has("archive")) count("archive", "pupils", withPupilBranch({ status: "Arxiv" }, scope));

  // GURUHLAR HAM FILIAL BO'YICHA KESILADI (qaror 2026-09-07) — /groups
  // sahifasi va sidebar sanog'i bilan bir xil qamrov.
  if (need.has("groups")) count("groups", "groups", withBranch({}, scope));

  // QARZDORLAR — countDocuments emas, hisob (lib/debtors.ts): /reports-unpaid
  // "Qarzdorlar" rejimidagi qatorlar soni — qarzi > 0 bo'lgan o'quvchilar,
  // bugungi sana bo'yicha. Sahifa bilan bitta funksiya, ya'ni ikkita son
  // hech qachon bir-biridan farq qilmaydi.
  if (need.has("debtors")) {
    jobs.push(
      computeDebtors(db, scope, uzDateIso()).then((r) => {
        values.debtors = r.rows.filter((x) => x.debt > 0).length;
      }),
    );
  }

  await Promise.all(jobs);

  // Sanoq berilmagan kalit — manbasi yo'q karta: `undefined ?? null` → "—".
  return visible.map((k) => ({ ...k, value: values[k.key] ?? null }));
}
