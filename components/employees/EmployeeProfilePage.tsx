"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  Archive, ArchiveRestore, ArrowLeft, Briefcase, Check, ChevronDown, Copy, CreditCard,
  DollarSign, Edit, Frown, KeyRound, Lock, MoreVertical, Percent, Phone, Settings, XCircle,
} from "lucide-react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import EmployeeArchiveModal, { type ArchiveMode } from "./EmployeeArchiveModal";
import { EP_MORE_IDS, EP_TABS, ROLE_LABELS } from "@/constants/employees";
import { isSalaryConfigured, type HrEmployee } from "@/lib/hrEmployees";
import EmployeeSalaryConfigModal from "./EmployeeSalaryConfigModal";
import type { TransactionEntry } from "@/lib/transactionEntries";
import type { TeacherStudent } from "@/app/api/hr-employees/[id]/students/route";
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

interface Stat {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  wrap: string;
  valueCls?: string;
}

// Chap kartadagi moliyaviy ko'rsatkichlar. Manbasi bor uchtasi haqiqiy
// hisoblanadi (Bonus, Jarima, Avans); qolganlari uchun tizimda hali
// dars/majburiyat hisobi yo'q — soxta "0 UZS" o'rniga "—" ko'rsatamiz,
// aks holda raqam bor-u, ortida hech narsa yo'qdek tuyuladi.
function buildStats(bonus: number, jarima: number, avans: number, oylik: number, ready: boolean): Stat[] {
  const v = (n: number) => (ready ? nf(n) : "…");
  const none = ready ? "—" : "…";
  return [
    { label: "Davomat", value: none, icon: Check, wrap: "bg-emerald-100 text-emerald-600" },
    { label: "Davomatdan foizi", value: none, icon: Percent, wrap: "bg-blue-100 text-blue-600" },
    { label: "Bonus", value: v(bonus), icon: Lock, wrap: "bg-violet-100 text-violet-700" },
    { label: "Avans", value: v(avans), icon: XCircle, wrap: "bg-rose-100 text-rose-600", valueCls: avans > 0 ? "text-rose-600" : "" },
    { label: "Jarima", value: v(jarima), icon: Frown, wrap: "bg-amber-100 text-amber-600" },
    { label: "Akladi", value: none, icon: Briefcase, wrap: "bg-secondary text-foreground/70" },
    { label: "Oylik", value: v(oylik), icon: CreditCard, wrap: "bg-blue-100 text-blue-700" },
    { label: "To'lanmagan", value: none, icon: DollarSign, wrap: "bg-emerald-100 text-emerald-700" },
  ];
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

const ROLE_BADGE: Record<string, string> = {
  teacher: "bg-primary",
  moderator: "bg-purple-500",
  admin: "bg-slate-400",
};

// Kartochka ostidagi to'rtta amal — referensdagi tartib va tooltiplar:
// [Parol qo'shish] [<Rol>ni arxivlash] [Qo'ng'iroq qilish] [Tahrirlash].
// Ilgari birinchisi "Guruhlar" edi — referensda unaqasi yo'q.
const ACTION_CLS = {
  key: "bg-blue-50 hover:bg-blue-100 text-blue-700",
  archive: "bg-amber-50 hover:bg-amber-100 text-amber-700",
  restore: "bg-emerald-50 hover:bg-emerald-100 text-emerald-700",
  call: "bg-emerald-50 hover:bg-emerald-200 text-emerald-700",
  edit: "bg-secondary hover:bg-secondary/80 text-foreground",
};

export default function EmployeeProfilePage({ id }: { id: number }) {
  const { showSuccess, showError } = useToast();
  const [emp, setEmp] = useState<HrEmployee | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("transactions");
  const [moreOpen, setMoreOpen] = useState(false);
  // null — modal yopiq; aks holda qaysi amal so'ralayotgani.
  const [archiveMode, setArchiveMode] = useState<ArchiveMode | null>(null);
  // Cloudinary'dagi rasm o'chirilgan yoki havola buzilgan bo'lsa, singan
  // rasm belgisi o'rniga harflarga qaytamiz.
  const [photoFailed, setPhotoFailed] = useState(false);
  // Moliyaviy ma'lumot (haqiqiy, backend'dan).
  const [studentPayments, setStudentPayments] = useState<TransactionEntry[]>([]);
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
  const [fStudent, setFStudent] = useState("");
  const visibleTabs = EP_TABS.filter((t) => !EP_MORE_IDS.includes(t.id));
  const moreTabs = EP_TABS.filter((t) => EP_MORE_IDS.includes(t.id));

  // Xodim ma'lumotini backend'dan (/api/hr-employees/:id) yuklaymiz.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/hr-employees/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.ok) setEmp(data.employee);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Xodim ismi ma'lum bo'lgach — HAQIQIY moliyaviy ma'lumot.
  //
  // "O'quvchilar to'lovlari": to'lov yozuviga qabul qilgan xodimning ISMI
  // yoziladi (app/api/cashboxes/[id]/adjust/route.ts — Kirim oynasidagi
  // "O'qituvchini tanlang"). Shu bois o'qituvchining o'quvchilari to'lovi
  // `moderator` bo'yicha topiladi. `transaction_entries.group` hech qachon
  // to'ldirilmaydi, shuning uchun "Guruh" ustuni guruh ro'yxatidan olinadi.
  //
  // "Tranzaksiyalar tarixi": xodimning O'ZIGA tegishli chiqimlar (avans va
  // h.k.) — bunda ism `studentName` maydonida turadi
  // (components/finance/CashboxAdjustDrawer.tsx shunday yozadi).
  useEffect(() => {
    const name = emp?.name?.trim();
    if (!name) return;
    let cancelled = false;
    // `finLoading` boshlanishida allaqachon true — bu yerda qayta
    // o'rnatilsa, effekt tanasidagi setState ortiqcha render zanjirini
    // keltirib chiqaradi (react-hooks qoidasi).
    const q = encodeURIComponent(name);
    const get = (u: string) => fetch(u).then((r) => r.json()).catch(() => null);
    Promise.all([
      get(`/api/transaction-entries?moderator=${q}&txType=payIn`),
      get(`/api/transaction-entries?studentName=${q}&txType=payOut`),
      get(`/api/hr-employees/${id}/students`),
      get("/api/bonuses"),
      get("/api/penalties"),
      get("/api/turnstile-io"),
      get("/api/orders"),
      get("/api/student-reports?kind=unpaid"),
      get("/api/cashboxes"),
      get(`/api/hr-employees/${id}/notes`),
    ]).then(([pay, own, roster, bon, pen, turn, ord, unp, cash, nts]) => {
      if (cancelled) return;
      // Hech biri kelmagan bo'lsa — bu "ma'lumot yo'q" emas, so'rov
      // muvaffaqiyatsiz. Bo'sh holatda soxta sabab yozmasligimiz uchun.
      if (!pay && !own && !turn) {
        setFinError(true);
        setFinLoading(false);
        return;
      }
      if (pay?.ok) setStudentPayments(pay.entries as TransactionEntry[]);
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
      setFinLoading(false);
    });
    return () => { cancelled = true; };
  }, [id, emp?.name]);

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
      showError(data.error || "Eslatma saqlanmadi");
      return false;
    } catch {
      showError("Tarmoq xatosi — eslatma saqlanmadi");
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
      else showError(data.error || "O'chirilmadi");
    } catch {
      showError("Tarmoq xatosi — o'chirilmadi");
    }
  }

  if (loading) {
    return <div className="container mx-auto max-w-[1900px] p-4 md:p-5"><SpinnerBlock /></div>;
  }
  if (!emp) {
    return (
      <div className="container mx-auto max-w-[1900px] p-4 md:p-5">
        <p className="text-sm text-muted-foreground">Xodim topilmadi.</p>
        <Link href="/management-xodimlar" className="mt-3 inline-flex h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm items-center">Orqaga</Link>
      </div>
    );
  }

  const initials = emp.name.split(" ").map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const phone = emp.phone.startsWith("+") ? emp.phone : "+998" + (emp.phone || "").replace(/\s/g, "");
  const roleLabel = ROLE_LABELS[emp.turi as keyof typeof ROLE_LABELS] ?? emp.turi;

  // Alohida "holat" maydoni yo'q: `archReason` to'lgan bo'lsa — arxivda.
  // EmployeesListPage dagi "Holat" filtri ham aynan shu belgiga qaraydi.
  const archived = Boolean(emp.archReason);
  const showPhoto = Boolean(emp.photoUrl) && !photoFailed;

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
  const stats = buildStats(bonusTotal, penaltyTotal, avansTotal, oylikTotal, !finLoading);

  const salaryConfigured = isSalaryConfigured(emp);
  const cashboxName = (cid: number) => cashboxNames[cid] ?? (cid ? `Kassa ${cid}` : "—");
  const ledger = buildLedger(emp.name, bonuses, penalties, ownEntries);

  // "To'lanmagan to'lovlar" — o'qituvchining guruhlaridagi o'quvchilar qarzi.
  const rosterNames = new Set(students.map((s) => s.name.trim().toLowerCase()));
  const unpaidMine = unpaid.filter((r) => rosterNames.has((r.studentName || "").trim().toLowerCase()));

  // "To'lanmagan tarixi" — qabul qilingan, lekin oxiriga yetmagan to'lovlar.
  const unfinished = studentPayments.filter((e) => e.status === "cancelled" || e.status === "waiting");

  // O'qituvchining hisoboti — buyurtmalardan. `teacher` bazada null bo'lishi
  // mumkin (tip `string` desa ham), shuning uchun String(... ?? "") shart.
  const perfRow = buildPerformanceRows(
    orders,
    (o) => String((emp.turi === "teacher" ? o.teacher : o.moderator) ?? ""),
    { start: null, end: null },
  ).find((r) => r.name === emp.name) ?? null;

  // Ikkala tab ham bir xil jadvalni ko'rsatadi, faqat manbasi boshqa.
  const isTxTab = activeTab === "transactions" || activeTab === "student-payments";
  const tabRows = activeTab === "student-payments" ? studentPayments : ownEntries;
  const rows = fStudent ? tabRows.filter((e) => e.studentName === fStudent) : tabRows;
  // "Guruh" ustuni to'lov yozuvidan olinmaydi (u yerda doim bo'sh) —
  // o'qituvchining guruh ro'yxatidan ism bo'yicha topiladi.
  const groupByStudent = new Map(students.map((s) => [s.name, s.groupName]));
  const studentOptions = [...new Set(tabRows.map((e) => e.studentName).filter(Boolean))].sort();

  return (
    <div className="container mx-auto max-w-[1900px] p-4 md:p-5">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <Link href="/management-xodimlar" className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium">
          <ArrowLeft className="icon icon-sm" />
          <span>Orqaga</span>
        </Link>
        <button onClick={() => showSuccess("Tablarni sozlash (demo)")} className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-sm">
          <Settings className="icon icon-sm text-primary" />
          <span>Tablarni sozlash</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* LEFT */}
        <aside className="space-y-4">
          <div className="rounded-2xl bg-card border border-border p-5">
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                {/* Cloudinary'ga rasm yuklangan bo'lsa — o'sha; bo'lmasa
                    (yoki havola ishlamasa) avvalgidek bosh harflar. */}
                {showPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={emp.photoUrl}
                    alt={emp.name}
                    onError={() => setPhotoFailed(true)}
                    // O'lcham INLINE berilgan. Sabab: Tailwind preflight'idagi
                    // `img, video { height: auto }` qoidasi qatlamsiz (unlayered)
                    // CSS'dan keladi va u `@layer utilities` ichidagi `.h-24`
                    // dan HAR DOIM ustun turadi — spesifiklikdan qat'i nazar.
                    // Natijada `w-24 h-24` bilan rasm 96x64 bo'lib cho'zilardi
                    // (brauzerda o'lchangan). Harfli variant esa <div> bo'lgani
                    // uchun bu qoidaga tushmaydi va 96x96 bo'lib qolaveradi.
                    style={{ width: 96, height: 96, objectFit: "cover" }}
                    className="rounded-full shadow-lg"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-700 via-blue-500 to-cyan-300 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                    <span>{initials}</span>
                  </div>
                )}
                <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-white shadow ${ROLE_BADGE[emp.turi] ?? "bg-slate-400"}`}>
                  {roleLabel}
                </span>
              </div>
              <h2 className="mt-4 text-[17px] font-bold tracking-tight">{emp.name}</h2>
              <div className="mt-1 inline-flex items-center gap-1 text-[13px] text-muted-foreground">
                <span className="tabular-nums">{phone}</span>
                <button onClick={() => { navigator.clipboard?.writeText(phone); showSuccess("Nusxa olindi"); }} className="hover:text-primary" title="Nusxa olish">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              {archived && (
                <div className="mt-3 w-full rounded-lg bg-amber-50 px-3 py-2 text-left text-[12px] text-amber-700">
                  <div className="font-semibold">Arxivlangan</div>
                  {/* Yagona shablon-satr — JSX matni ifoda bilan yonma-yon
                      yozilsa probel yo'qoladi (README'dagi tuzoq). */}
                  <div className="mt-0.5">
                    {`Sabab: ${emp.archReason}${emp.archDate ? ` · ${emp.archDate}` : ""}`}
                  </div>
                </div>
              )}

              <div className="mt-3 grid grid-cols-4 gap-1.5 w-full">
                <button
                  type="button"
                  onClick={() => showSuccess("Parol qo'shish (demo)")}
                  className={`aspect-square rounded-lg inline-flex items-center justify-center ${ACTION_CLS.key}`}
                  title="Parol qo'shish"
                >
                  <KeyRound className="icon icon-sm" />
                </button>

                <button
                  type="button"
                  onClick={() => setArchiveMode(archived ? "activate" : "archive")}
                  className={`aspect-square rounded-lg inline-flex items-center justify-center ${archived ? ACTION_CLS.restore : ACTION_CLS.archive}`}
                  title={archived ? `${roleLabel}ni arxivdan chiqarish` : `${roleLabel}ni arxivlash`}
                >
                  {archived ? <ArchiveRestore className="icon icon-sm" /> : <Archive className="icon icon-sm" />}
                </button>

                {/* Referensda bu "Qo'ng'iroq qilish" — telefon ilovasini ochamiz. */}
                <a
                  href={`tel:${phone.replace(/\s/g, "")}`}
                  className={`aspect-square rounded-lg inline-flex items-center justify-center ${ACTION_CLS.call}`}
                  title="Qo'ng'iroq qilish"
                >
                  <Phone className="icon icon-sm" />
                </a>

                <button
                  type="button"
                  onClick={() => setSalaryOpen(true)}
                  className={`aspect-square rounded-lg inline-flex items-center justify-center ${ACTION_CLS.edit}`}
                  title="Ish haqini sozlash"
                >
                  <Edit className="icon icon-sm" />
                </button>
              </div>
              {/* Oylik sozlanmagan bo'lsa buni ochiq aytamiz — chap
                  kartadagi "—" larning sababi shu. */}
              {!finLoading && !salaryConfigured && (
                <button
                  type="button"
                  onClick={() => setSalaryOpen(true)}
                  className="mt-3 w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 hover:bg-amber-500/20 text-left"
                >
                  <strong>Ish haqi sozlanmagan.</strong> Oylik hisobi shu xodim uchun ko&apos;rsatilmaydi — sozlash uchun bosing.
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-card border border-border p-2">
            <ul className="divide-y divide-border">
              {stats.map((s) => (
                <li key={s.label} className="flex items-center gap-3 px-3 py-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full flex-shrink-0 ${s.wrap}`}>
                    <s.icon className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-muted-foreground">{s.label}</div>
                    <div className={`text-[14px] font-semibold tabular-nums ${s.valueCls ?? ""}`}>{s.value}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* RIGHT */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="px-4 pt-4 pb-2 border-b border-border">
            <div className="flex flex-wrap items-center gap-1.5">
              {visibleTabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTab(t.id)}
                  className={`h-9 px-4 rounded-full text-[13px] font-medium transition-all ${activeTab === t.id ? "bg-primary text-white shadow-sm" : "bg-secondary/50 text-foreground/80 hover:bg-secondary"}`}
                >
                  {t.label}
                </button>
              ))}
              <div className="relative">
                <button onClick={() => setMoreOpen((o) => !o)} className="h-9 px-4 rounded-full text-[13px] font-medium bg-secondary/50 text-foreground/80 hover:bg-secondary inline-flex items-center gap-1.5">
                  Ko&apos;proq
                  <ChevronDown className="w-3 h-3" />
                </button>
                {moreOpen && (
                  <div className="absolute right-0 top-11 w-56 rounded-xl border border-border bg-card shadow-xl p-1 z-30">
                    {moreTabs.map((t) => (
                      <button key={t.id} onClick={() => selectTab(t.id)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                        <MoreVertical className="icon icon-xs text-muted-foreground" />
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 md:p-5 min-h-[500px]">
            {isTxTab ? (
              <>
                <div className="flex flex-wrap items-center gap-2.5 mb-4">
                  {/* Filtr faqat tanlash mantiqan bor bo'lganda — xodimning
                      o'z chiqimlari tabida ism doim bitta. */}
                  {studentOptions.length > 1 && (
                    <div className="relative">
                      <select
                        value={fStudent}
                        onChange={(e) => setFStudent(e.target.value)}
                        className="h-9 w-52 appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      >
                        <option value="">Talaba — hammasi</option>
                        {studentOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  )}
                  <span className="text-[12px] text-muted-foreground">
                    {activeTab === "student-payments"
                      ? "Shu xodim qabul qilgan o'quvchi to'lovlari"
                      : "Xodimning o'ziga yozilgan chiqimlar (avans va h.k.)"}
                  </span>
                </div>
                <div className="flex items-center justify-end mb-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-secondary/40 text-[11px] font-medium">Umumiy soni: <span className="ml-1 tabular-nums font-semibold">{finLoading ? "…" : rows.length}</span></span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                        {["№", "Sana", "O'quvchilar", "Guruh", "Turi", "Holati", "Izoh", "Miqdori", "Keyingi miqdor", "Oldingi miqdor"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {finLoading ? (
                        <tr><td colSpan={10} className="px-4 py-10 text-center text-[13px] text-muted-foreground">Yuklanmoqda…</td></tr>
                      ) : rows.length === 0 ? (
                        <tr><td colSpan={10} className="px-4 py-10 text-center text-[13px] text-muted-foreground">Ma&apos;lumotlar topilmadi</td></tr>
                      ) : rows.map((t, i) => (
                        <tr key={t.id} className="hover:bg-secondary/30 transition-colors">
                          <td className="px-4 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                          <td className="px-4 py-3 tabular-nums whitespace-nowrap">{t.date}{t.time ? ` | ${t.time}` : ""}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{t.studentName || "—"}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{groupByStudent.get(t.studentName) || "—"}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{t.txName || "—"}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${TX_STATUS_CLS[t.status || ""] ?? "bg-secondary text-foreground/70"}`}>
                              {TX_STATUS_LABEL[t.status || ""] ?? t.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">{t.note || "—"}</td>
                          <td className={`px-4 py-3 tabular-nums font-medium whitespace-nowrap ${t.amount < 0 ? "text-rose-600" : "text-emerald-600"}`}>{nf(t.amount)}</td>
                          <td className="px-4 py-3 tabular-nums whitespace-nowrap">{t.after === null ? "—" : nf(t.after)}</td>
                          <td className="px-4 py-3 tabular-nums whitespace-nowrap">{nf(t.before)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : finLoading ? (
              <div className="py-20 text-center text-[13px] text-muted-foreground">Yuklanmoqda…</div>
            ) : finError ? (
              <EmptyState text="Ma'lumot yuklanmadi" hint="Serverga ulanishda xato yuz berdi. Sahifani yangilab ko'ring." />
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
                payments={studentPayments}
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

      {salaryOpen && (
        <EmployeeSalaryConfigModal
          employee={emp}
          onClose={() => setSalaryOpen(false)}
          onSaved={(updated) => {
            setEmp(updated);
            setSalaryOpen(false);
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
            showSuccess(updated.archReason ? "Xodim arxivlandi" : "Xodim arxivdan chiqarildi");
          }}
        />
      )}
    </div>
  );
}
