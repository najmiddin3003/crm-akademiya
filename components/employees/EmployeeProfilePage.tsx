"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/ui/Link";
import {
  Archive, ArchiveRestore, ArrowLeft, Briefcase, Check, ChevronDown, CreditCard,
  DollarSign, Edit, Frown, KeyRound, Lock, MoreVertical, Percent, Phone, Settings, XCircle,
} from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import { useTransactionTypes } from "@/hooks/useTransactionTypes";
import EmployeeArchiveModal, { type ArchiveMode } from "./EmployeeArchiveModal";
import { EMPLOYEE_PROFILE_TABS_KEY, type HrEmployeeFull } from "./employeeExtras";
import { EP_MORE_IDS, EP_TABS, ROLE_LABELS } from "@/constants/employees";
import { isSalaryConfigured } from "@/lib/hrEmployees";
import { payrollCashLeg, payrollDue, payrollPeriod, payrollPlastikLeg, payrollTax, type EmployeePayroll } from "@/lib/salary";
import EmployeeSalaryConfigModal from "./EmployeeSalaryConfigModal";
import AddEmployeeModal from "./AddEmployeeModal";
import EmployeePasswordModal from "./EmployeePasswordModal";
import type { TransactionEntry } from "@/lib/transactionEntries";
import type { SalaryLedgerRow } from "@/lib/salaryLedger";
import type { TeacherStudent } from "@/lib/teacherRoster";
import type { Bonus } from "@/lib/bonuses";
import type { Penalty } from "@/lib/penalties";
import type { TurnstileIoRecord } from "@/lib/turnstileIo";
import type { EmployeeNote } from "@/lib/employeeNotes";
import type { Order } from "@/lib/ordersData";
import { buildPerformanceRows } from "@/lib/performanceReport";
import {
  BalanceTab, EmptyState, KpiTab, NotesTab, PayoutHistoryTab, TeacherReportTab,
  UnpaidHistoryTab, UnpaidTab, WorkHoursTab, buildLedger, type UnpaidRow,
} from "./EmployeeProfileTabs";
import PersonLink from "@/components/shared/PersonDirectory";
import { formatPhoneDisplay } from "@/components/auth/PhoneField";
import ProfileSideCard, { type ProfileStat } from "@/components/shared/ProfileSideCard";
import { useT } from "@/components/shared/Language";

// Xodim profili (crm-akademiya #view-management-xodim-profile, skrinshot 4).
// Mavjud o'quvchi profili bilan bir xil tuzilma — faqat tab nomlari boshqacha.
//
// Ma'lumot HAQIQIY backend'dan keladi. Tablar mazmuni
// components/employees/EmployeeProfileTabs.tsx da.
//
// Manbasi bo'lmagan tablar (NO_SOURCE ro'yxati) soxta raqam ko'rsatmaydi —
// nima yetishmayotganini yozib, bo'sh turadi.

function nf(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " UZS";
}

function toIsoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Jadval filtrlarini so'rovga qo'shadi — ikkala tab uchun bir xil.
 *
 * Filtrlash SERVERDA bo'lishi shart: jadval sahifalab o'qiladi (eng band
 * kassirda 13 000+ qator), klientdagi filtr faqat ochiq turgan 50 qatorni
 * kesardi.
 */
function applyTableFilters(
  qs: URLSearchParams,
  f: { student: string; txName: string; range: DateRange; group: string; students: TeacherStudent[] },
) {
  if (f.student) {
    // Aynan tanlangan o'quvchi guruhdan kuchliroq — ikkalasi ham serverda
    // `studentName` ga yozadi, birga yuborilsa route 400 qaytaradi.
    qs.set("studentNameExact", f.student);
  } else if (f.group) {
    // Guruh yozuvda saqlanmaydi (`transaction_entries.group` doim bo'sh),
    // shu bois u o'quvchilari ro'yxatiga aylantirib yuboriladi.
    for (const s of f.students) if (s.groupName === f.group && s.name) qs.append("studentNames", s.name);
  }
  if (f.txName) qs.set("txName", f.txName);
  if (f.range.start) qs.set("dateFrom", toIsoDay(f.range.start));
  if (f.range.end) qs.set("dateTo", toIsoDay(f.range.end));
}

// Chap kartadagi moliyaviy ko'rsatkichlar. Manbasi bor uchtasi haqiqiy
// hisoblanadi (Bonus, Jarima, Avans); qolganlari uchun tizimda hali
// dars/majburiyat hisobi yo'q — soxta "0 UZS" o'rniga "—" ko'rsatamiz,
// aks holda raqam bor-u, ortida hech narsa yo'qdek tuyuladi.
//
// `icon` — TAYYOR element (ProfileSideCard shunday kutadi): o'quvchi
// profilida ikonkalar global sprite'dan keladi, bu yerda lucide'dan, ya'ni
// umumiy komponent ikkalasini ham bir xil qabul qila olishi kerak.
interface StatInput {
  bonus: number;
  jarima: number;
  avans: number;
  oylik: number;
  ready: boolean;
  /**
   * Oylik hisobidagi qator (/api/salary-runs/employees-payroll).
   *
   * "Akladi" va "To'lanmagan" AYNAN shundan olinadi — ilgari ikkalasi ham
   * "—" edi, holbuki manba bor: oklad xodim kartasida, qolgan qarz esa
   * Oylik hisob-kitob sahifasida allaqachon hisoblanadi. Ikki joyda ikki
   * xil raqam chiqmasligi uchun bu yerda qayta hisoblanmaydi.
   */
  payroll?: {
    fixedSalary: number;
    due: number;
    configured: boolean;
    /**
     * `due` ning ikki oyog'i (lib/salary.ts): kartaga ketadigani va
     * qo'lga beriladigan naqd. Oylik hisob-kitob sahifasining "Qolgan"
     * ustuni AYNAN `naqd` — shu bois karta bor xodimda profil "To'lanmagan"
     * (karta + naqd) o'sha ustundan katta ko'rinadi va bu xato emas;
     * kesim ostida ko'rsatiladi, ikki raqam bir-biriga mos tushsin.
     */
    karta: number;
    naqd: number;
  } | null;
}

function buildStats({ bonus, jarima, avans, oylik, ready, payroll }: StatInput): ProfileStat[] {
  const v = (n: number) => (ready ? nf(n) : "…");
  const none = ready ? "—" : "…";
  // Oyligi sozlanmagan xodimda 0 ko'rsatish yolg'on bo'lardi — "—" qoladi.
  const p = (n: number | undefined) =>
    !ready ? "…" : payroll?.configured && n !== undefined ? nf(n) : "—";
  return [
    { label: "Davomat", value: none, icon: <Check className="w-4 h-4" />, wrap: "bg-emerald-100 text-emerald-600" },
    { label: "Davomatdan foizi", value: none, icon: <Percent className="w-4 h-4" />, wrap: "bg-blue-100 text-blue-600" },
    { label: "Bonus", value: v(bonus), icon: <Lock className="w-4 h-4" />, wrap: "bg-violet-100 text-violet-700" },
    { label: "Avans", value: v(avans), icon: <XCircle className="w-4 h-4" />, wrap: "bg-rose-100 text-rose-600", valueCls: avans > 0 ? "text-rose-600" : "" },
    { label: "Jarima", value: v(jarima), icon: <Frown className="w-4 h-4" />, wrap: "bg-amber-100 text-amber-600" },
    { label: "Akladi", value: p(payroll?.fixedSalary), icon: <Briefcase className="w-4 h-4" />, wrap: "bg-secondary text-foreground/70" },
    { label: "Oylik", value: v(oylik), icon: <CreditCard className="w-4 h-4" />, wrap: "bg-blue-100 text-blue-700" },
    {
      label: "To'lanmagan",
      value: p(payroll?.due),
      icon: <DollarSign className="w-4 h-4" />,
      wrap: "bg-emerald-100 text-emerald-700",
      valueCls: (payroll?.due ?? 0) < 0 ? "text-rose-600" : "",
      // Karta bor xodimda kesim: Oylik hisob-kitob sahifasidagi "Qolgan"
      // — bu yerdagi `naqd`. Kartasiz xodimda kesim ma'nosiz — yozilmaydi.
      hint: ready && payroll?.configured && payroll.karta > 0
        ? `kartaga ${nf(payroll.karta)} · naqd ${nf(payroll.naqd)}`
        : undefined,
    },
  ];
}

/**
 * "Oyligiga ta'siri" va "Qoldiq oldin/keyin" ustunlari — XODIMNING OYLIK
 * DAFTARIDAN (/api/hr-employees/:id/salary-ledger, lib/salaryLedger.ts).
 *
 * NIMA UCHUN KERAK: jadvaldagi "Miqdori" — kassaga kirgan/chiqqan pulning
 * O'ZI. Foizli o'qituvchida o'quvchi to'lagan 300 000 uning oyligiga
 * 300 000 emas, 300 000 × foiz bo'lib tushadi. 18.09.2026 gacha jadvalda
 * kassaning qoldig'i ("Kassada oldin/keyin") turardi va u "xodim hisobi
 * shuncha o'zgardi" deb o'qilardi — foydalanuvchi: "50% emas, jami to'lov
 * hisoblanyapti". Endi qoldiq ustunlari xodimning O'Z qoldig'i, qoida
 * serverda, Oylik hisob-kitob bilan bir xil manbadan; bu yerda hisob YO'Q.
 *
 * Xarita: `transaction_entries.id` → daftar qatori. Daftarda yo'q yozuv
 * (boshqa ustozning o'quvchisi, kassir sifatida qayd etgani, bekor
 * qilingan) uchala ustunda "—".
 */
type LedgerMap = Map<number, SalaryLedgerRow>;

/**
 * "avgust uchun" — yozuv o'z sanasining oyiga emas, boshqa oyning
 * oyligiga yozilgan (Kirim oynasida "Davr" tanlangan). Shunday qatorning
 * qoldig'i o'sha oyning daftaridan keladi va qo'shni qatorlardan sakrab
 * turadi — belgi buni tushuntiradi.
 */
/** Yozuv boshqa oy uchun bo'lsa — o'sha oy nomi (tilga qarab), aks holda null. */
function periodTagOf(t: TransactionEntry, months: string[]): string | null {
  const pm = String(t.periodMonth ?? "").trim();
  if (!pm || pm === String(t.date ?? "").slice(0, 7)) return null;
  const m = Number(pm.slice(5, 7)) - 1;
  return months[m] ?? pm;
}

// Manbasi bo'lmagan tablar — nima uchun bo'shligini aniq aytamiz, chunki
// "Ma'lumotlar topilmadi" o'zi hech narsa tushuntirmaydi.
const NO_SOURCE: Record<string, string> = {
  rating: "Reyting uchun baholash yig'ilmaydi — tizimda xodim reytingini yozadigan joy yo'q.",
  calls: "Qo'ng'iroqlar tarixi uchun telefoniya integratsiyasi ulanmagan (Sozlamalar > Integratsiyalar).",
  actions: "Xodim harakatlarini qayd qiladigan audit jurnali hali yuritilmaydi.",
  "actions-audit": "Xodim harakatlarini qayd qiladigan audit jurnali hali yuritilmaydi.",
  "work-hours-log": "Ish soati bo'yicha yagona manba — turniket, u \"Ish soati\" tabida to'liq ko'rsatilgan.",
};

const TX_STATUS_LABEL: Record<string, string> = {
  "": "Tasdiqlangan",
  waiting: "Kutilmoqda",
  cancelled: "Bekor qilingan",
};
const TX_STATUS_CLS: Record<string, string> = {
  "": "bg-emerald-500/10 text-emerald-600",
  waiting: "bg-amber-500/10 text-amber-600",
  cancelled: "bg-rose-500/10 text-rose-600",
};

/** "1998-04-17" → "17.04.1998" — sahifadagi qolgan sanalar bilan bir xil. */
function fmtBirthDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

const ROLE_BADGE: Record<string, string> = {
  teacher: "bg-primary",
  moderator: "bg-purple-500",
  admin: "bg-slate-400",
};

/**
 * Sahifaning GET so'rovlari SHU funksiya orqali ketadi: saytda oddiy
 * `fetch`, xodimlar botining «Profilim» Mini App'ida esa Telegram imzosi
 * bilan /api/xodim/data orqali (components/employees/StaffProfileTg.tsx).
 * Manzillar ikkalasida bir xil — javobni o'sha route xodimning o'z
 * ma'lumotigacha kesadi. Tarmoq yoki JSON xatosida `null`.
 *
 * Mini App'dagi funksiya BARQAROR bo'lishi shart (useCallback): u
 * effektlarning bog'liqligida turadi.
 */
export type ProfileGetJson = (url: string) => ReturnType<Response["json"]>;

const siteGetJson: ProfileGetJson = (url) => fetch(url).then((r) => r.json()).catch(() => null);

/**
 * Faqat ko'rish rejimida (Mini App) chiqmaydigan tablar: admin yozgan
 * «Eslatma» va harakatlar (audit) tarixi — foydalanuvchi qarori, 28.09.2026.
 */
const READONLY_HIDDEN_TABS = ["notes", "actions", "actions-audit"];

// Kartochka ostidagi to'rtta amal — referensdagi tartib va tooltiplar:
// [Parol qo'shish] [<Rol>ni arxivlash] [Qo'ng'iroq qilish] [Tahrirlash].
// Ilgari birinchisi "Guruhlar" edi — referensda unaqasi yo'q.
// Doira tugmalar — o'quvchi profilidagi bilan bir xil pastel uslub
// (ProfileSideCard ikkalasini ham shu ko'rinishda chizadi).
const ACTION_CLS = {
  key: "bg-blue-500/15 text-blue-600 hover:bg-blue-500/25",
  salary: "bg-violet-500/15 text-violet-600 hover:bg-violet-500/25",
  archive: "bg-amber-500/15 text-amber-600 hover:bg-amber-500/25",
  restore: "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25",
  call: "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25",
  edit: "bg-secondary text-foreground hover:bg-secondary/80",
};

/** Saytdagi xodim profili (Boshqaruv → Xodimlar → profil). */
export default function EmployeeProfilePage({ id }: { id: number }) {
  const { names } = useTransactionTypes();
  return <EmployeeProfileView id={id} txTypeNames={names} />;
}

/**
 * Profilning o'zi. `readOnly` — xodimlar botining «Profilim» Mini App'i:
 * xodim O'Z profilini saytdagidek ko'radi, lekin tahrirlash, arxivlash,
 * parol, ish haqi sozlamasi, tablarni sozlash va admin eslatmalari yo'q.
 */
export function EmployeeProfileView({
  id,
  txTypeNames,
  readOnly = false,
  getJson = siteGetJson,
}: {
  id: number;
  /** Tranzaksiya turlari katalogi (filtr tanlovi); Mini App'da bo'sh — yozuvlardagi nomlar yetadi. */
  txTypeNames: string[];
  readOnly?: boolean;
  getJson?: ProfileGetJson;
}) {
  const { t, months } = useT();
  const { showSuccess, showError } = useToast();
  // HrEmployeeFull — asosiy maydonlar + modal saqlaydigan qo'shimchalar
  // (tug'ilgan sana, izoh, maxsus maydonlar). Ilgari ular bu yerda ko'rinmasdi.
  const [emp, setEmp] = useState<HrEmployeeFull | null>(null);
  const [loading, setLoading] = useState(true);
  // `rawActiveTab` — foydalanuvchi bosgan tab. Ko'rinadigan tab esa quyida
  // RENDER paytida hisoblanadi (pastdagi izohga qarang).
  const [rawActiveTab, setActiveTab] = useState("transactions");
  const [moreOpen, setMoreOpen] = useState(false);
  // null — modal yopiq; aks holda qaysi amal so'ralayotgani.
  const [archiveMode, setArchiveMode] = useState<ArchiveMode | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  // Moliyaviy ma'lumot (haqiqiy, backend'dan).
  // "O'quvchilar to'lovlari" endi TO'LIQ ro'yxat sifatida yuklanmaydi.
  //
  // Ilgari shu yerda `studentPayments` bor edi va u moderatorning HAMMA
  // to'lovini saqlardi — eng band moderatorda 13 369 qator (~6 MB). Undan
  // esa atigi to'rt narsa kerak edi, va to'rttasi ham endi serverdan
  // tayyor holda keladi:
  //   1) KPI uchtaligi     -> /api/transaction-entries/moderator-summary
  //   2) tugallanmaganlar  -> ?status=cancelled,waiting  (35 qator)
  //   3) ismlar ro'yxati   -> /api/transaction-entries/students?moderator=
  //   4) jadval            -> ?page=&limit=&slim=1       (bir sahifa)
  const [kpi, setKpi] = useState({ count: 0, amount: 0, students: 0 });
  const [unfinished, setUnfinished] = useState<TransactionEntry[]>([]);
  const [payOptions, setPayOptions] = useState<string[]>([]);
  // Shu xodimning oylik qatori — chap kartadagi "Akladi" va "To'lanmagan"
  // AYNAN shundan chiqadi, ya'ni Oylik hisob-kitob sahifasi bilan bir xil
  // raqam ko'rinadi.
  const [payrollRow, setPayrollRow] = useState<EmployeePayroll | null>(null);
  // Oylik daftari — jadvalning "Oyligiga ta'siri" / "Qoldiq" ustunlari.
  // null — hali kelmagan yoki so'rov muvaffaqiyatsiz (ustunlar "—").
  const [salaryLedger, setSalaryLedger] = useState<LedgerMap | null>(null);
  // Ish haqi sozlamasi saqlangach moliyaviy so'rovlar qayta yuriladi —
  // foiz o'zgarsa daftar ham, chap kartadagi "To'lanmagan" ham o'zgaradi.
  const [finVersion, setFinVersion] = useState(0);
  const [payPage, setPayPage] = useState<{ entries: TransactionEntry[]; total: number }>({ entries: [], total: 0 });
  // "Tranzaksiyalar tarixi" sahifasi — xodimga oid HAMMA yozuv (?person=).
  const [allPage, setAllPage] = useState<{ entries: TransactionEntry[]; total: number }>({ entries: [], total: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [ownEntries, setOwnEntries] = useState<TransactionEntry[]>([]);
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [turnstile, setTurnstile] = useState<TurnstileIoRecord[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [unpaid, setUnpaid] = useState<UnpaidRow[]>([]);
  const [cashboxNames, setCashboxNames] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState<EmployeeNote[]>([]);
  const [noteBusy, setNoteBusy] = useState(false);
  const [finLoading, setFinLoading] = useState(true);
  const [finError, setFinError] = useState(false);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [fStudent, setFStudent] = useState("");
  // Namunadagi to'rtlik: sana oralig'i + tranzaksiya turi + o'quvchi +
  // guruh. Hammasi SERVERGA ketadi — jadval sahifalab o'qiladi, ya'ni
  // klientda filtrlash faqat ochiq turgan 50 qatorni kesardi.
  const [fTxName, setFTxName] = useState("");
  const [fGroup, setFGroup] = useState("");
  const [fRange, setFRange] = useState<DateRange>({ start: null, end: null });
  // Filtr TANLOVLARI — butun ro'yxat bo'yicha (distinct), bir sahifadan
  // emas. Kassalar sahifasidagi bilan bir xil endpoint, `?person=` rejimi.
  const [facets, setFacets] = useState<{ txNames: string[]; studentNames: string[] }>({ txNames: [], studentNames: [] });

  // ── "Tablarni sozlash" ──────────────────────────────────────────────────
  // Ilgari bu tugma faqat "(demo)" toast chiqarardi. Endi yashiriladigan
  // tablar ro'yxati `settings` kolleksiyasida saqlanadi (Sozlamalar
  // bo'limidagi boshqa tablar bilan bir xil naqsh), ya'ni tanlov sahifa
  // yangilangandan keyin ham qoladi va hamma foydalanuvchida bir xil.
  const [tabsCfgOpen, setTabsCfgOpen] = useState(false);
  const [hiddenTabs, setHiddenTabs] = useState<Set<string>>(new Set());
  const tabsCfgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getJson(`/api/settings?key=${encodeURIComponent(EMPLOYEE_PROFILE_TABS_KEY)}`)
      .then((d) => {
        if (cancelled || !d?.ok) return;
        const hidden = (d.values as { hidden?: unknown } | null)?.hidden;
        if (Array.isArray(hidden)) setHiddenTabs(new Set(hidden.map((h) => String(h))));
      });
    return () => { cancelled = true; };
  }, [getJson]);

  useEffect(() => {
    if (!tabsCfgOpen) return;
    const onDown = (e: MouseEvent) => {
      if (tabsCfgRef.current && !tabsCfgRef.current.contains(e.target as Node)) setTabsCfgOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [tabsCfgOpen]);

  async function toggleTabVisible(tabId: string) {
    const next = new Set(hiddenTabs);
    if (next.has(tabId)) next.delete(tabId);
    else next.add(tabId);
    if (next.size >= EP_TABS.length) {
      showError(t("Kamida bitta tab ochiq qolishi kerak"));
      return;
    }
    const before = hiddenTabs;
    setHiddenTabs(next); // darhol ko'rinsin
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: EMPLOYEE_PROFILE_TABS_KEY, values: { hidden: [...next] } }),
    }).then((r) => r.json()).catch(() => null);
    if (!res?.ok) {
      // Saqlanmagan o'zgarishni ekranda qoldirib bo'lmaydi — qaytaramiz.
      setHiddenTabs(before);
      showError(t(res?.error || "Tab sozlamasi saqlanmadi"));
    }
  }

  // Faqat ko'rish rejimida admin yashirganlariga eslatma/audit tablari
  // qo'shiladi. Admin qolgan hamma tabni yashirgan bo'lsa ham xodimda bo'sh
  // sahifa qolmasin — shunda faqat o'sha uchtasi chiqmaydi.
  const roHidden = readOnly ? new Set([...hiddenTabs, ...READONLY_HIDDEN_TABS]) : hiddenTabs;
  const roShown = EP_TABS.filter((tv) => !roHidden.has(tv.id));
  const shownTabs = roShown.length > 0 ? roShown : EP_TABS.filter((tv) => !READONLY_HIDDEN_TABS.includes(tv.id));
  const visibleTabs = shownTabs.filter((tv) => !EP_MORE_IDS.includes(tv.id));
  const moreTabs = shownTabs.filter((tv) => EP_MORE_IDS.includes(tv.id));

  // Tanlangan tab yashirib qo'yilgan bo'lsa — birinchi ochiq tabga tushamiz.
  // Buni effekt ichida setState bilan qilish zanjirli render keltirib
  // chiqaradi (react-hooks/set-state-in-effect), shuning uchun shunchaki
  // render paytida hisoblaymiz.
  const activeTab = shownTabs.some((tv) => tv.id === rawActiveTab) ? rawActiveTab : (shownTabs[0]?.id ?? rawActiveTab);

  // Xodim ma'lumotini backend'dan (/api/hr-employees/:id) yuklaymiz.
  useEffect(() => {
    let cancelled = false;
    getJson(`/api/hr-employees/${id}`)
      .then((data) => {
        if (!cancelled && data?.ok) setEmp(data.employee);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, getJson]);

  /**
   * "O'quvchilar to'lovlari" QAYSI maydon bo'yicha yig'iladi.
   *
   * To'lov yozuvida ikkita turli ism bor (app/api/cashboxes/[id]/adjust):
   *   `moderator`   — to'lovni KASSADA qayd etgan xodim,
   *   `teacherName` — to'lov KIMNING oyligiga tegishli (o'quvchining ustozi).
   * Ilgari bu yerda faqat `moderator` ishlatilardi va o'qituvchida tab doim
   * bo'sh edi — o'qituvchi hech qachon kassir bo'lmaydi.
   */
  const payKey = emp?.turi === "teacher" ? "teacherName" : "moderator";

  // Xodim ismi ma'lum bo'lgach — HAQIQIY moliyaviy ma'lumot.
  //
  // "Tranzaksiyalar tarixi": xodimga OID hamma yozuv (pastdagi alohida
  // effekt, `?person=`). "O'quvchilar to'lovlari": faqat o'quvchi to'lovlari.
  //
  // `ownEntries` (xodimning o'z chiqimlari) shu yerda qoladi va TEGILMAYDI:
  // undan chap kartadagi Avans/Oylik, "Balans", "Avans tarixi" va "Oylik
  // tarixi" tablari oziqlanadi. `transaction_entries.group` hech qachon
  // to'ldirilmaydi, shuning uchun "Guruh" ustuni guruh ro'yxatidan olinadi.
  useEffect(() => {
    const name = emp?.name?.trim();
    if (!name) return;
    let cancelled = false;
    // `finLoading` boshlanishida allaqachon true — bu yerda qayta
    // o'rnatilsa, effekt tanasidagi setState ortiqcha render zanjirini
    // keltirib chiqaradi (react-hooks qoidasi).
    const q = encodeURIComponent(name);
    const get = getJson;
    Promise.all([
      // Uchta yengil so'rov — ilgari shu yerda bitta 6 MB lik so'rov turardi.
      // "O'quvchilar to'lovlari" manbasi xodim TURIGA bog'liq:
      //   o'qituvchi → `teacherName` (o'quvchilarim qilgan to'lovlar)
      //   kassir/admin → `moderator` (men qabul qilgan to'lovlar)
      // Ilgari uchalasi ham `moderator` edi va o'qituvchida tab, KPI hamda
      // "O'quvchi" tanlovi DOIM bo'sh qolardi — o'qituvchi hech qachon
      // kassir bo'lmaydi. O'lchandi: bazadagi 56 xodimdan ikkala maydonda
      // ham uchraydigani 0 ta, ya'ni ro'yxatlar kesishmaydi.
      get(`/api/transaction-entries/moderator-summary?${payKey}=${q}`),
      get(`/api/transaction-entries?${payKey}=${q}&txType=payIn&status=cancelled,waiting&slim=1`),
      get(`/api/transaction-entries/students?${payKey}=${q}&txType=payIn`),
      get(`/api/transaction-entries?studentName=${q}&txType=payOut`),
      get(`/api/hr-employees/${id}/students`),
      get("/api/bonuses"),
      get("/api/penalties"),
      get("/api/turnstile-io"),
      get("/api/orders"),
      get("/api/student-reports?kind=unpaid"),
      get("/api/cashboxes?names=1"),
      get(`/api/hr-employees/${id}/notes`),
      // Chap kartadagi "Akladi" va "To'lanmagan" uchun — Oylik hisob-kitob
      // sahifasi bilan AYNAN bir xil manba (lib/payrollSources.ts).
      get("/api/salary-runs/employees-payroll"),
      // Jadval filtrlarining tanlovlari — BUTUN ro'yxat bo'yicha, ochiq
      // turgan 50 qatordan emas.
      get(`/api/transaction-entries/facets?person=${q}`),
      // Oylik daftari — jadvalning "Oyligiga ta'siri" va "Qoldiq" ustunlari.
      // Sahifalanmaydi: qoldiq butun tarix bo'yicha yuradi, bir sahifadan
      // hisoblab bo'lmaydi; qatorlar faqat oylikka ta'sir qilganlar.
      get(`/api/hr-employees/${id}/salary-ledger`),
    ]).then(([sum, unf, opts, own, roster, bon, pen, turn, ord, unp, cash, nts, pay, fac, led]) => {
      if (cancelled) return;
      // Hech biri kelmagan bo'lsa — bu "ma'lumot yo'q" emas, so'rov
      // muvaffaqiyatsiz. Bo'sh holatda soxta sabab yozmasligimiz uchun.
      if (!sum && !own && !turn) {
        setFinError(true);
        setFinLoading(false);
        return;
      }
      if (sum?.ok) setKpi({ count: sum.count, amount: sum.amount, students: sum.students });
      if (unf?.ok) setUnfinished(unf.entries as TransactionEntry[]);
      if (opts?.ok) setPayOptions(opts.students as string[]);
      if (own?.ok) setOwnEntries(own.entries as TransactionEntry[]);
      if (roster?.ok) setStudents(roster.students as TeacherStudent[]);
      if (Array.isArray(bon?.bonuses)) setBonuses(bon.bonuses as Bonus[]);
      if (Array.isArray(pen?.penalties)) setPenalties(pen.penalties as Penalty[]);
      // Turniket yozuvlari faqat shu xodimniki (ism bo'yicha, `personType`
      // "employee" — o'quvchilar bilan bir kolleksiyada turadi).
      if (Array.isArray(turn?.records)) {
        const lc = name.toLowerCase();
        setTurnstile((turn.records as TurnstileIoRecord[])
          .filter((r) => r.personType === "employee" && (r.personName || "").trim().toLowerCase() === lc)
          .sort((a, b) => b.date.localeCompare(a.date)));
      }
      if (Array.isArray(ord?.orders)) setOrders(ord.orders as Order[]);
      if (Array.isArray(unp?.rows)) setUnpaid(unp.rows as UnpaidRow[]);
      if (Array.isArray(cash?.cashboxes)) {
        setCashboxNames(Object.fromEntries(
          (cash.cashboxes as { id: number; name: string }[]).map((c) => [c.id, c.name]),
        ));
      }
      if (Array.isArray(nts?.notes)) setNotes(nts.notes as EmployeeNote[]);
      if (pay?.ok) {
        setPayrollRow((pay.employees as EmployeePayroll[]).find((e) => e.id === id) ?? null);
      }
      if (fac?.ok) {
        setFacets({ txNames: fac.txNames as string[], studentNames: fac.studentNames as string[] });
      }
      if (led?.ok) {
        setSalaryLedger(new Map((led.ledger.rows as SalaryLedgerRow[]).map((r) => [r.id, r])));
      }
      setFinLoading(false);
    });
    return () => { cancelled = true; };
  }, [id, emp?.name, payKey, finVersion, getJson]);

  // "O'quvchilar to'lovlari" jadvalining BIR SAHIFASI.
  //
  // Sahifa, qator soni yoki o'quvchi filtri o'zgarganda qayta so'raladi.
  // `studentNameExact` ataylab `studentName` EMAS: jadval filtri ilgari
  // klientda `e.studentName === fStudent` edi, ya'ni xom satrni aynan
  // solishtirardi. Route'dagi `?studentName=` esa chetlarini kesib,
  // katta-kichik harfni farqlamaydi va BOSHQA qatorlarni qaytaradi
  // (o'lchandi: tekshirilgan 60 ta xavfli ismning hammasida farq bor edi).
  useEffect(() => {
    const name = emp?.name?.trim();
    if (!name || activeTab !== "student-payments") return;
    let cancelled = false;
    const qs = new URLSearchParams({
      [payKey]: name,
      txType: "payIn",
      page: String(page),
      limit: String(pageSize),
      slim: "1",
    });
    applyTableFilters(qs, { student: fStudent, txName: fTxName, range: fRange, group: fGroup, students });
    getJson(`/api/transaction-entries?${qs}`)
      .then((d) => {
        if (cancelled || !d?.ok) return;
        setPayPage({ entries: d.entries as TransactionEntry[], total: Number(d.total) || 0 });
      });
    return () => { cancelled = true; };
  }, [emp?.name, activeTab, page, pageSize, fStudent, fTxName, fRange, fGroup, students, payKey, getJson]);

  // "Tranzaksiyalar tarixi" jadvalining BIR SAHIFASI — xodimga OID HAMMA
  // yozuv: unga chiqarilgan avans/oylik, o'quvchilari qilgan to'lovlar va
  // o'zi kassada qayd etganlari (`?person=` — server tomonda `$or`).
  //
  // NIMA UCHUN ALOHIDA MANBA: `ownEntries` ni kengaytirib bo'lmaydi — undan
  // chap kartadagi Avans/Oylik summalari, "Balans", "Avans tarixi" va
  // "Oylik tarixi" tablari hisoblanadi; ularga o'quvchi to'lovi (kirim)
  // aralashsa raqamlar Hisobotlar bilan chaqishmay qolardi.
  //
  // SAHIFALASH ham server tomonda: eng band kassirda bu ro'yxat 13 000+
  // qator bo'ladi, klientda uni ushlab turib bo'lmaydi.
  useEffect(() => {
    const name = emp?.name?.trim();
    if (!name || activeTab !== "transactions") return;
    let cancelled = false;
    const qs = new URLSearchParams({
      person: name,
      page: String(page),
      limit: String(pageSize),
      slim: "1",
    });
    applyTableFilters(qs, { student: fStudent, txName: fTxName, range: fRange, group: fGroup, students });
    getJson(`/api/transaction-entries?${qs}`)
      .then((d) => {
        if (cancelled || !d?.ok) return;
        setAllPage({ entries: d.entries as TransactionEntry[], total: Number(d.total) || 0 });
      });
    return () => { cancelled = true; };
  }, [emp?.name, activeTab, page, pageSize, fStudent, fTxName, fRange, fGroup, students, getJson]);

  // true qaytarsa NotesTab kiritish maydonini tozalaydi — saqlanmagan matn
  // yo'qolib ketmasligi uchun.
  async function addNote(text: string): Promise<boolean> {
    setNoteBusy(true);
    try {
      const res = await fetch(`/api/hr-employees/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.ok) {
        setNotes((p) => [...p, data.note as EmployeeNote]);
        return true;
      }
      showError(t(data.error || "Eslatma saqlanmadi"));
      return false;
    } catch {
      showError(t("Tarmoq xatosi — eslatma saqlanmadi"));
      return false;
    } finally {
      setNoteBusy(false);
    }
  }

  async function removeNote(noteId: number) {
    try {
      const res = await fetch(`/api/hr-employees/${id}/notes?noteId=${noteId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) setNotes((p) => p.filter((n) => n.id !== noteId));
      else showError(t(data.error || "O'chirilmadi"));
    } catch {
      showError(t("Tarmoq xatosi — o'chirilmadi"));
    }
  }

  if (loading) {
    return <div className="container mx-auto max-w-[1900px] p-4 md:p-5"><SpinnerBlock /></div>;
  }
  if (!emp) {
    return (
      <div className="container mx-auto max-w-[1900px] p-4 md:p-5">
        <p className="text-sm text-muted-foreground">{t("Xodim topilmadi.")}</p>
        {!readOnly && (
          <Link href="/management-xodimlar" className="mt-3 inline-flex h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm items-center">{t("Orqaga")}</Link>
        )}
      </div>
    );
  }

  const initials = emp.name.split(" ").map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  // Bazada 9 xonali ("94 155 88 55") ham, 12 xonali ("998336263006") ham
  // uchraydi. Ilgari bu yerda qo'lda "+998" qo'shilardi va ikkinchisiga u
  // IKKINCHI marta yopishib, "+998998336263006" chiqardi.
  const phone = formatPhoneDisplay(emp.phone);
  const roleLabel = ROLE_LABELS[emp.turi as keyof typeof ROLE_LABELS] ?? emp.turi;

  // Alohida "holat" maydoni yo'q: `archReason` to'lgan bo'lsa — arxivda.
  // EmployeesListPage dagi "Holat" filtri ham aynan shu belgiga qaraydi.
  const archived = Boolean(emp.archReason);

  function selectTab(tabId: string) {
    setActiveTab(tabId);
    setMoreOpen(false);
    // Ikkala tranzaksiya tabining "Talaba" ro'yxati butunlay boshqacha
    // (birida o'quvchilar, ikkinchisida xodimning o'z ismi). Filtrni
    // tozalamasak, tab almashgach u ko'rinmay turib jadvalni bo'shatadi.
    setFStudent("");
  }

  // Xodimga yoziladigan chiqimlar bir nechta turda bo'ladi ("Hodimga avans",
  // "Hodimga oylik", …) va hammasi bir xil shaklda yoziladi. Shu bois
  // TURINI ajratish shart — aks holda oylik ham avansga qo'shilib ketadi va
  // Hisobotlar > Balans bilan ziddiyat chiqadi (u yerda faqat
  // txName "Hodimga avans" hisoblanadi).
  const sumByName = (re: RegExp) => ownEntries
    .filter((e) => e.status !== "cancelled" && re.test(e.txName || ""))
    .reduce((s, e) => s + Math.abs(Number(e.amount) || 0), 0);
  const avansTotal = sumByName(/avans/i);
  const oylikTotal = sumByName(/oylik/i);

  // Bonus/jarima — faqat shu xodimniki, bekor qilinganlarsiz.
  const lcName = emp.name.trim().toLowerCase();
  const mineOf = <T extends { type?: string; recipientName?: string; status?: string; amount?: number }>(rows: T[]) =>
    rows.filter((r) => r.type === "employee"
      && (r.recipientName ?? "").trim().toLowerCase() === lcName
      && r.status !== "cancelled");
  const sumAmount = (rows: { amount?: number }[]) => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const bonusTotal = sumAmount(mineOf(bonuses));
  const penaltyTotal = sumAmount(mineOf(penalties));
  const stats = buildStats({
    bonus: bonusTotal,
    jarima: penaltyTotal,
    avans: avansTotal,
    oylik: oylikTotal,
    ready: !finLoading,
    payroll: payrollRow
      ? {
          fixedSalary: payrollRow.fixedSalary,
          due: payrollDue(payrollRow, payrollPeriod()),
          configured: payrollRow.configured,
          karta: payrollPlastikLeg(payrollRow, payrollPeriod()),
          naqd: payrollCashLeg(payrollRow, payrollPeriod()),
        }
      : null,
  });

  const salaryConfigured = isSalaryConfigured(emp);
  const cashboxName = (cid: number) => cashboxNames[cid] ?? (cid ? `Kassa ${cid}` : "—");

  // Jadvaldagi "Qoldiq" bilan chap kartadagi "To'lanmagan" orasidagi
  // FARQNING sababi — shu oy bonusi, jarimasi va solig'i (daftar ularni
  // ko'rmaydi, lib/salaryLedger.ts). Farq yo'q bo'lsa izoh ham yo'q.
  const ledgerGapNote = (() => {
    if (!payrollRow?.configured || !salaryLedger) return "";
    const tax = payrollTax(payrollRow, payrollPeriod());
    const parts: string[] = [];
    if (payrollRow.bonus) parts.push(t("bonus +{bonus}", { bonus: nf(payrollRow.bonus) }));
    if (payrollRow.jarima) parts.push(t("jarima −{jarima}", { jarima: nf(payrollRow.jarima) }));
    if (tax) parts.push(t("soliq −{tax}", { tax: nf(tax) }));
    if (parts.length === 0) return "";
    return `«Qoldiq» ustuniga shu oy ${parts.join(", ")} kirmaydi — chap kartadagi «To'lanmagan» ${parts.length > 1 ? "ularni" : "buni"} hisobga oladi.`;
  })();
  const ledger = buildLedger(emp.name, bonuses, penalties, ownEntries);

  // "To'lanmagan to'lovlar" — o'qituvchining guruhlaridagi o'quvchilar qarzi.
  const rosterNames = new Set(students.map((s) => s.name.trim().toLowerCase()));
  const unpaidMine = unpaid.filter((r) => rosterNames.has((r.studentName || "").trim().toLowerCase()));

  // "To'lanmagan tarixi" — qabul qilingan, lekin oxiriga yetmagan to'lovlar.
  // Endi u serverdan alohida keladi (yuqoridagi `unfinished` holati):
  // ?status=cancelled,waiting. Tartib server tomonda ham `id` bo'yicha
  // kamayish — jadvaldagi № ustuni siljimasligi uchun shu shart.

  // O'qituvchining hisoboti — buyurtmalardan. `teacher` bazada null bo'lishi
  // mumkin (tip `string` desa ham), shuning uchun String(... ?? "") shart.
  const perfRow = buildPerformanceRows(
    orders,
    (o) => String((emp.turi === "teacher" ? o.teacher : o.moderator) ?? ""),
    { start: null, end: null },
  ).find((r) => r.name === emp.name) ?? null;

  // Ikkala tab ham bir xil jadvalni ko'rsatadi, faqat manbasi boshqa.
  //
  // ENDI IKKALA TAB HAM SERVER tomonda sahifalanadi.
  //
  // Ilgari "Tranzaksiyalar" tabi klientda edi, chunki u faqat xodimning o'z
  // chiqimlarini (~240 qator) ko'rsatardi. Endi u xodimga OID hamma yozuvni
  // ko'rsatadi — eng band kassirda 13 000+ qator, ya'ni klientda ushlab
  // turib bo'lmaydi.
  const isTxTab = activeTab === "transactions" || activeTab === "student-payments";
  const isPayTab = activeTab === "student-payments";

  const src = isPayTab ? payPage : allPage;
  const rows = src.entries;
  const totalRows = src.total;
  // Sahifalangan jadvalda № davom etishi kerak, 1 dan boshlanmasligi.
  const rowOffset = (page - 1) * pageSize;

  // "Guruh" ustuni to'lov yozuvidan olinmaydi (u yerda doim bo'sh) —
  // o'qituvchining guruh ro'yxatidan ism bo'yicha topiladi.
  const groupByStudent = new Map(students.map((s) => [s.name, s.groupName]));
  // Tanlov ro'yxati XOM ismlardan — ular pastdagi `studentNameExact`
  // filtriga kirish qiymati bo'ladi. Normallashtirilsa jadval bo'shab
  // qolardi (bazadagi ismlarning ko'pi chetida probel bilan saqlangan).
  // "Tranzaksiyalar" tabida ro'yxat endi serverdan kelgan SAHIFADAN emas,
  // ikkala manbadan birlashtiriladi: o'quvchilar (payOptions) + xodimning
  // o'z chiqimlaridagi ismlar. Faqat joriy sahifadan yig'ilsa, tanlov
  // sahifa almashganda o'zgarib turardi.
  // "Tranzaksiyalar" tabida manba endi `facets` — u serverda BUTUN ro'yxat
  // bo'yicha distinct qiladi, ya'ni payOptions + ownEntries birlashmasidan
  // to'liqroq (o'sha birlashma xodimning kassada qayd etgan begona
  // o'quvchilarini o'tkazib yuborardi).
  const allStudentOptions = isPayTab
    ? payOptions
    : facets.studentNames.length > 0
      ? facets.studentNames
      : [...new Set([...payOptions, ...ownEntries.map((e) => e.studentName)].filter(Boolean))].sort();

  // Guruh — faqat o'qituvchida. Yozuvda guruh saqlanmaydi, u o'qituvchining
  // guruh ro'yxatidan keladi; kassirda bu ro'yxat bo'sh, shu bois unda
  // filtr umuman chizilmaydi (ishlamaydigan tanlov qo'yilmaydi).
  const groupOptions = [...new Set(students.map((s) => s.groupName).filter(Boolean))].sort();
  const groupStudentNames = fGroup ? students.filter((s) => s.groupName === fGroup).map((s) => s.name) : null;
  // Guruh tanlangan bo'lsa o'quvchi ro'yxati ham o'sha guruh bilan
  // cheklanadi — ikkala filtr bir-biriga qarshi tushmasin.
  const studentOptions = groupStudentNames
    ? allStudentOptions.filter((s) => groupStudentNames.some((g) => g.trim().toLowerCase() === s.trim().toLowerCase()))
    : allStudentOptions;

  // Tranzaksiya turi: katalog (Sozlamalar) + yozuvlarda HAQIQATDA uchragan,
  // lekin katalogda yo'q nomlar. Faqat katalogga tayanilsa eski yozuvlarning
  // turini tanlab bo'lmasdi.
  const txNameOptions = [
    ...txTypeNames,
    ...facets.txNames.filter((n) => !txTypeNames.includes(n)),
  ];

  return (
    <div className="container mx-auto max-w-[1900px] p-4 md:p-5">
      {/* Top bar — faqat saytda: Mini App'da orqaga qaytadigan ro'yxat ham,
          tablarni sozlash ruxsati ham yo'q. */}
      {!readOnly && (
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <Link href="/management-xodimlar" className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium">
            <ArrowLeft className="icon icon-sm" />
            <span>{t("Orqaga")}</span>
          </Link>
          <div className="relative" ref={tabsCfgRef}>
            <button onClick={() => setTabsCfgOpen((o) => !o)} className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-sm">
              <Settings className="icon icon-sm text-primary" />
              <span>{t("Tablarni sozlash")}</span>
            </button>
            {tabsCfgOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border bg-card shadow-xl p-3 z-40">
                <div className="text-[13px] font-semibold mb-2">{t("Ko'rinadigan tablar")}</div>
                <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                  {EP_TABS.map((tv) => (
                    <label key={tv.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!hiddenTabs.has(tv.id)}
                        onChange={() => toggleTabVisible(tv.id)}
                        className="w-4 h-4 rounded border-border accent-primary"
                      />
                      <span className="text-[13px]">{t(tv.label)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* LEFT */}
        <aside className="space-y-4">
          {/* Sarlavha va statistika BITTA kartada — o'quvchi profili bilan
              bir xil (components/shared/ProfileSideCard.tsx). Ilgari ular
              ikkita alohida karta edi va ikkala sahifada turlicha yig'ilgandi. */}
          <ProfileSideCard
            name={emp.name}
            phone={phone}
            onCopyPhone={() => { navigator.clipboard?.writeText(phone); showSuccess(t("Nusxa olindi")); }}
            photoUrl={emp.photoUrl}
            initials={initials}
            badge={{ label: roleLabel, cls: ROLE_BADGE[emp.turi] ?? "bg-slate-400" }}
            stats={stats}
            actions={readOnly ? [] : [
              // Kalit ikonkasi — PAROL (referensdagi tartib). Ilgari u ish
              // haqi sozlamasini ochardi; u endi yonidagi alohida tugmada.
              {
                key: "password",
                title: t("Parol"),
                cls: ACTION_CLS.key,
                onClick: () => setPasswordOpen(true),
                icon: <KeyRound className="icon icon-sm" />,
              },
              // Ish haqi sozlash uchun ALOHIDA tugma. Busiz unga yagona
              // kirish nuqtasi "Ish haqi sozlanmagan" ogohlantirishi bo'lib
              // qolardi — u esa oyligi ALLAQACHON sozlangan xodimda umuman
              // chizilmaydi, ya'ni sozlamani qayta ochib bo'lmasdi.
              {
                key: "salary",
                title: t("Ish haqini sozlash"),
                cls: ACTION_CLS.salary,
                onClick: () => setSalaryOpen(true),
                icon: <DollarSign className="icon icon-sm" />,
              },
              {
                key: "archive",
                title: archived ? `${roleLabel}ni arxivdan chiqarish` : `${roleLabel}ni arxivlash`,
                cls: archived ? ACTION_CLS.restore : ACTION_CLS.archive,
                onClick: () => setArchiveMode(archived ? "activate" : "archive"),
                icon: archived ? <ArchiveRestore className="icon icon-sm" /> : <Archive className="icon icon-sm" />,
              },
              // Referensda bu "Qo'ng'iroq qilish" — telefon ilovasini ochamiz.
              {
                key: "call",
                title: t("Qo'ng'iroq qilish"),
                cls: ACTION_CLS.call,
                href: `tel:${phone.replace(/\s/g, "")}`,
                icon: <Phone className="icon icon-sm" />,
              },
              // Referensdagidek to'rtinchi tugma — xodimni TAHRIRLASH.
              {
                key: "edit",
                title: t("Tahrirlash"),
                cls: ACTION_CLS.edit,
                onClick: () => setEditOpen(true),
                icon: <Edit className="icon icon-sm" />,
              },
            ]}
          >
            {archived && (
              <div className="mt-3 w-full rounded-lg bg-amber-50 px-3 py-2 text-left text-[12px] text-amber-700">
                <div className="font-semibold">{t("Arxivlangan")}</div>
                {/* Yagona shablon-satr — JSX matni ifoda bilan yonma-yon
                    yozilsa probel yo'qoladi (README'dagi tuzoq). */}
                <div className="mt-0.5">
                  {`Sabab: ${emp.archReason}${emp.archDate ? ` · ${emp.archDate}` : ""}`}
                </div>
              </div>
            )}
            {/* Oylik sozlanmagan bo'lsa buni ochiq aytamiz — chap
                kartadagi "—" larning sababi shu. */}
            {!finLoading && !salaryConfigured && readOnly && (
              <div className="mt-3 w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 text-left">
                <strong>{t("Ish haqi sozlanmagan.")}</strong>{" "}{t("Oylik hisobini administrator sozlaydi.")}
              </div>
            )}
            {!finLoading && !salaryConfigured && !readOnly && (
              <button
                type="button"
                onClick={() => setSalaryOpen(true)}
                className="mt-3 w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 hover:bg-amber-500/20 text-left"
              >
                <strong>{t("Ish haqi sozlanmagan.")}</strong>{" "}{t("Oylik hisobi shu xodim uchun ko'rsatilmaydi — sozlash uchun bosing.")}
              </button>
            )}
          </ProfileSideCard>

          {/* Xodim qo'shish modalida to'ldiriladigan qo'shimcha ma'lumot.
              Ilgari bu qiymatlar hech qayerda saqlanmasdi ham, ko'rinmasdi
              ham. Bo'sh bo'lsa karta umuman chizilmaydi — bo'sh "—" lar
              qatorini ko'rsatishdan ma'no yo'q. */}
          {(emp.birthDate || emp.comment || Object.keys(emp.customFields ?? {}).length > 0) && (
            <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("Qo'shimcha ma'lumot")}
              </div>
              {emp.birthDate && (
                <div>
                  <div className="text-[11px] text-muted-foreground">{t("Tug'ilgan sanasi")}</div>
                  <div className="text-[13px] tabular-nums">{fmtBirthDate(emp.birthDate)}</div>
                </div>
              )}
              {Object.entries(emp.customFields ?? {}).map(([k, v]) => (
                <div key={k}>
                  <div className="text-[11px] text-muted-foreground">{k}</div>
                  <div className="text-[13px]">{v}</div>
                </div>
              ))}
              {emp.comment && (
                <div>
                  <div className="text-[11px] text-muted-foreground">{t("Izoh")}</div>
                  <div className="text-[13px] whitespace-pre-wrap">{emp.comment}</div>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* RIGHT */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="px-4 pt-4 pb-2 border-b border-border">
            <div className="flex flex-wrap items-center gap-1.5">
              {visibleTabs.map((tv) => (
                <button
                  key={tv.id}
                  onClick={() => selectTab(tv.id)}
                  className={`h-9 px-4 rounded-full text-[13px] font-medium transition-all ${activeTab === tv.id ? "bg-primary text-white shadow-sm" : "bg-secondary/50 text-foreground/80 hover:bg-secondary"}`}
                >
                  {t(tv.label)}
                </button>
              ))}
              {/* "Ko'proq" faqat unda tab qolganda — hammasi yashirilgan
                  bo'lsa, bo'sh menyu ochadigan tugma ortiqcha. */}
              {moreTabs.length > 0 && (
                <div className="relative">
                  <button onClick={() => setMoreOpen((o) => !o)} className="h-9 px-4 rounded-full text-[13px] font-medium bg-secondary/50 text-foreground/80 hover:bg-secondary inline-flex items-center gap-1.5">
                    {t("Ko'proq")}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {moreOpen && (
                    <div className="absolute right-0 top-11 w-56 rounded-xl border border-border bg-card shadow-xl p-1 z-30">
                      {moreTabs.map((tv) => (
                        <button key={tv.id} onClick={() => selectTab(tv.id)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                          <MoreVertical className="icon icon-xs text-muted-foreground" />
                          <span>{t(tv.label)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 md:p-5 min-h-[500px]">
            {isTxTab ? (
              <>
                <div className="flex flex-wrap items-end gap-2.5 mb-4">
                  <DateRangePicker
                    value={fRange}
                    onChange={(r) => { setFRange(r); setPage(1); }}
                    className="w-56"
                  />
                  {/* Tranzaksiya turi — katalog + yozuvlarda uchragan nomlar. */}
                  {txNameOptions.length > 0 && (
                    <StudentSearchSelect
                      label=""
                      variant="compact"
                      value={fTxName}
                      onChange={(v) => { setFTxName(v); setPage(1); }}
                      options={txNameOptions}
                      placeholder={t("Tranzaksiya turi")}
                      searchPlaceholder="Turni qidirish"
                    />
                  )}
                  {/* Filtr faqat tanlash mantiqan bor bo'lganda — xodimning
                      o'z chiqimlari tabida ism doim bitta. */}
                  {studentOptions.length > 1 && (
                    <StudentSearchSelect
                      label=""
                      variant="compact"
                      value={fStudent}
                      onChange={(v) => { setFStudent(v); setPage(1); }}
                      options={studentOptions}
                      placeholder={t("O'quvchi")}
                      searchPlaceholder="O'quvchini qidirish"
                    />
                  )}
                  {/* Guruh — faqat o'qituvchida manbasi bor (guruh ro'yxati);
                      kassirda ro'yxat bo'sh, ishlamaydigan filtr chizilmaydi. */}
                  {groupOptions.length > 0 && (
                    <StudentSearchSelect
                      label=""
                      variant="compact"
                      value={fGroup}
                      onChange={(v) => { setFGroup(v); setFStudent(""); setPage(1); }}
                      options={groupOptions}
                      placeholder={t("Guruh")}
                      searchPlaceholder="Guruhni qidirish"
                    />
                  )}
                  {(fRange.start || fRange.end || fTxName || fStudent || fGroup) && (
                    <button
                      onClick={() => {
                        setFRange({ start: null, end: null });
                        setFTxName("");
                        setFStudent("");
                        setFGroup("");
                        setPage(1);
                      }}
                      className="h-9 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-[13px] font-medium"
                    >
                      {t("Tozalash")}
                    </button>
                  )}
                  <span className="text-[12px] text-muted-foreground">
                    {activeTab === "student-payments"
                      ? (payKey === "teacherName"
                          ? t("Shu ustozning o'quvchilari qilgan to'lovlar")
                          : t("Shu xodim qabul qilgan o'quvchi to'lovlari"))
                      : "Shu xodimga oid barcha kirim va chiqimlar (avans, oylik, o'quvchi to'lovlari)"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  {/* "Qoldiq" ustuni kassa yozuvlaridan yuradi — shu oyning
                      bonus/jarima/solig'i unga kirmaydi, chap kartadagi
                      "To'lanmagan"ga esa kiradi. Farq bor xodimda (masalan,
                      qat'iy soliq 216 000) ikki raqam mos kelmaydi va
                      sababini tooltipdan qidirish shart bo'lmasin. */}
                  <span className="text-[11px] text-muted-foreground">{ledgerGapNote}</span>
                  {/* Sahifalangan tabda `rows.length` bir sahifadagi qatorlar
                      soni bo'lib qolardi — server qaytargan `total` kerak. */}
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-secondary/40 text-[11px] font-medium whitespace-nowrap">{t("Umumiy soni:")}{" "}<span className="ml-1 tabular-nums font-semibold">{finLoading ? "…" : totalRows}</span></span>
                </div>
                <div className="table-box">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                        {/* "Qoldiq keyin/oldin" — XODIMNING oylik qoldig'i
                            (chap kartadagi "To'lanmagan") shu yozuvdan
                            keyin/oldin, oylik daftaridan. 18.09.2026 gacha
                            bu yerda kassaning qoldig'i (transaction_entries
                            .after/before) turardi va "xodim hisobi to'liq
                            summaga o'zgardi" deb o'qilardi. */}
                        {["№", "Sana", "O'quvchilar", "Guruh", "Turi", "Holati", "Izoh", "Miqdori", "Oyligiga ta'siri", "Qoldiq keyin", "Qoldiq oldin"].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-3 text-left whitespace-nowrap"
                            title={
                              h === "Oyligiga ta'siri"
                                ? "Foizli o'qituvchida o'quvchi to'lovi × foiz (qaytarim ham foizi qadar); avans/oylik — olingan summa"
                                : h.startsWith("Qoldiq")
                                  ? t("Xodimning oylik qoldig'i shu yozuvdan keyin/oldin. Oy boshida — o'tgan oydan qolgan qoldiq (okladli xodimda + shu oy okladi: o'tgan oyda to'liq, joriy oyda bugungi kungacha), keyin har yozuvning «Oyligiga ta'siri» qo'shilib boradi. Shu oyning bonus, jarima va solig'i bu ustunga kirmaydi — chap kartadagi «To'lanmagan» ularni ham hisobga oladi.")
                                  : undefined
                            }
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {finLoading ? (
                        <tr><td colSpan={11} className="px-4 py-10 text-center text-[13px] text-muted-foreground">{t("Yuklanmoqda…")}</td></tr>
                      ) : rows.length === 0 ? (
                        <tr><td colSpan={11} className="px-4 py-10 text-center text-[13px] text-muted-foreground">{t("Ma'lumotlar topilmadi")}</td></tr>
                      ) : rows.map((tv, i) => {
                        const led = salaryLedger?.get(tv.id) ?? null;
                        const periodMonth = periodTagOf(tv, months);
                        const periodTag = periodMonth ? t("{month} uchun", { month: periodMonth }) : null;
                        const balCell = (v: number | null | undefined) =>
                          v === null || v === undefined
                            ? <td className="px-4 py-3 text-muted-foreground">—</td>
                            : <td className={`px-4 py-3 tabular-nums whitespace-nowrap ${v < 0 ? "text-rose-600" : ""}`}>{nf(v)}</td>;
                        return (
                        <tr key={tv.id} className="hover:bg-secondary/30 transition-colors">
                          <td className="px-4 py-3 text-muted-foreground tabular-nums">{rowOffset + i + 1}</td>
                          <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                            {tv.date}{tv.time ? ` | ${tv.time}` : ""}
                            {periodTag && (
                              <span className="block text-[11px] text-muted-foreground" title={t("Kirim oynasida tanlangan davr — qoldiq o'sha oyning daftaridan")}>
                                {periodTag}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap"><PersonLink name={tv.studentName} /></td>
                          <td className="px-4 py-3 whitespace-nowrap">{groupByStudent.get(tv.studentName) || "—"}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{tv.txName || "—"}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${TX_STATUS_CLS[tv.status || ""] ?? "bg-secondary text-foreground/70"}`}>
                              {TX_STATUS_LABEL[tv.status || ""] ?? tv.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">{tv.note || "—"}</td>
                          <td className={`px-4 py-3 tabular-nums font-medium whitespace-nowrap ${tv.amount < 0 ? "text-rose-600" : "text-emerald-600"}`}>{nf(tv.amount)}</td>
                          {led ? (
                            <td className={`px-4 py-3 tabular-nums font-medium whitespace-nowrap ${led.effect < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                              {led.effect < 0 ? "−" : "+"}{nf(Math.abs(led.effect))}
                              <span className="ml-1 text-[11px] font-normal text-muted-foreground">({led.note})</span>
                            </td>
                          ) : (
                            <td className="px-4 py-3 text-muted-foreground">—</td>
                          )}
                          {balCell(led?.after)}
                          {balCell(led?.before)}
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Ikkala tab ham endi server tomonda sahifalanadi. */}
                {totalRows > 0 && (
                  <Pagination
                    totalItems={totalRows}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                  />
                )}
              </>
            ) : finLoading ? (
              <div className="py-20 text-center text-[13px] text-muted-foreground">{t("Yuklanmoqda…")}</div>
            ) : finError ? (
              <EmptyState text="Ma'lumot yuklanmadi" hint={t("Serverga ulanishda xato yuz berdi. Sahifani yangilab ko'ring.")} />
            ) : activeTab === "advances" ? (
              <PayoutHistoryTab
                entries={ownEntries.filter((e) => /avans/i.test(e.txName || ""))}
                cashboxName={cashboxName}
                caption="Xodimga to'langan avanslar (Kassa > Chiqim orqali yozilgan)."
              />
            ) : activeTab === "salary-log" ? (
              <PayoutHistoryTab
                entries={ownEntries.filter((e) => /oylik/i.test(e.txName || ""))}
                cashboxName={cashboxName}
                caption="Xodimga to'langan oyliklar (Kassa > Chiqim orqali yozilgan)."
              />
            ) : activeTab === "balance" ? (
              <BalanceTab rows={ledger} />
            ) : activeTab === "unpaid-payments" ? (
              <UnpaidTab rows={unpaidMine} rosterEmpty={students.length === 0} />
            ) : activeTab === "unpaid-history" ? (
              <UnpaidHistoryTab entries={unfinished} />
            ) : activeTab === "work-hours" ? (
              <WorkHoursTab records={turnstile} />
            ) : activeTab === "kpi" ? (
              <KpiTab
                paymentsCount={kpi.count}
                paymentsAmount={kpi.amount}
                paymentsStudents={kpi.students}
                avans={avansTotal}
                oylik={oylikTotal}
                bonus={bonusTotal}
                jarima={penaltyTotal}
                students={students}
              />
            ) : activeTab === "teacher-report" ? (
              <TeacherReportTab row={perfRow} />
            ) : activeTab === "notes" ? (
              <NotesTab notes={notes} onAdd={addNote} onDelete={removeNote} busy={noteBusy} />
            ) : (
              // Qolgan tablar uchun tizimda ma'lumot manbasi YO'Q. Soxta
              // raqam ko'rsatmaymiz — nima yetishmayotganini aytamiz.
              <EmptyState hint={NO_SOURCE[activeTab] ?? "Bu bo'lim uchun hali ma'lumot yig'ilmaydi."} />
            )}
          </div>
        </div>
      </div>

      {editOpen && (
        <AddEmployeeModal
          employee={emp}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => setEmp(updated)}
        />
      )}

      {passwordOpen && emp && (
        <EmployeePasswordModal employee={emp} onClose={() => setPasswordOpen(false)} />
      )}

      {salaryOpen && (
        <EmployeeSalaryConfigModal
          employee={emp}
          onClose={() => setSalaryOpen(false)}
          onSaved={(updated) => {
            setEmp(updated);
            setSalaryOpen(false);
            // Foiz/oklad o'zgardi — oylik qatori va daftar qayta o'qilsin,
            // aks holda chap karta va jadval eski sozlama bilan qolardi.
            setFinVersion((v) => v + 1);
          }}
        />
      )}

      {archiveMode && (
        <EmployeeArchiveModal
          employee={emp}
          mode={archiveMode}
          onClose={() => setArchiveMode(null)}
          onDone={(updated) => {
            // Server qaytargan yozuvni to'g'ridan-to'g'ri qo'yamiz — qayta
            // so'rov kerak emas, PATCH `returnDocument: "after"` bilan ishlaydi.
            setEmp(updated);
            setArchiveMode(null);
            showSuccess(updated.archReason ? t("Xodim arxivlandi") : t("Xodim arxivdan chiqarildi"));
          }}
        />
      )}
    </div>
  );
}
