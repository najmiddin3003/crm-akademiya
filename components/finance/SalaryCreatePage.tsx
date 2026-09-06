"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, DollarSign, History, RotateCcw, Search } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import Select from "@/components/ui/Select";
import MonthYearPicker from "@/components/ui/MonthYearPicker";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { selectPlaceholder } from "@/lib/selectPlaceholder";
import type { Cashbox } from "@/lib/cashboxes";
import { PLASTIK_METHOD_KEY } from "@/lib/paymentMethods";
import {
  payrollBase,
  payrollDebt,
  payrollDue,
  payrollEarned,
  payrollMonthKey,
  payrollPaid,
  payrollPeriod,
  payrollPeriodLabel,
  payrollPeriodOf,
  payrollTax,
  payrollTaxLines,
  payrollPlastikLeg,
  payrollCashLeg,
  UZ_MONTHS,
  type EmployeePayroll,
} from "@/lib/salary";
import { invalidateTransactions } from "@/lib/cacheKeys";

// Moliya → Oylik chiqarish (/finance-payroll) — bo'limning BOSH sahifasi.
//
// Ilgari bosh sahifada chiqarishlar TARIXI turardi, hisob-kitob esa
// /finance-payroll/create da edi. Amalda har kuni kerak bo'ladigani
// hisob-kitob, tarixga esa kamdan-kam qaraladi — shu bois o'rin
// almashtirildi: tarix endi /finance-payroll/history da.
//
// Har bir qator /api/salary-runs/employees-payroll'dan keladi va HAMMA
// qiymat haqiqiy (lib/payrollSources.ts):
//   oklad   ← xodim kartasidagi filial bo'yicha ish haqi
//   tushum  ← o'quvchilari to'lagan pul (transaction_entries.teacherName)
//   foiz    ← Sozlamalar > Moliya > Oylik foizlari
//   avans / to'langan oylik ← kassadan chiqarilgan yozuvlar
//   bonus / jarima ← o'z kolleksiyalari
//
// Ish haqi sozlanmagan xodimda raqam KO'RSATILMAYDI — "Sozlanmagan" deb
// turadi va uni tanlab oylik chiqarib bo'lmaydi (server ham rad etadi).

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("ru-RU");
}
function fmtSum(n: number): string {
  return fmtNum(n) + " so'm";
}

type HisoblashFilter = "all" | "foiz" | "fixed";

interface StatCardProps {
  label: string;
  value: string;
  hint: string;
  tone: "cyan" | "amber" | "blue" | "rose";
  /**
   * Yuklanayotganda RAQAM KO'RSATILMAYDI.
   *
   * Oy almashtirilganda sarlavha darhol yangi oyni yozadi, qatorlar esa
   * javob kelguncha eskiligicha qoladi — kartalarda o'sha paytda AVGUST
   * puli "sentabr" yorlig'i ostida turib qolardi. Bir necha soniya bo'lsa
   * ham bu noto'g'ri fakt, shuning uchun o'rniga uch nuqta chiqadi.
   */
  loading?: boolean;
}
function StatCard({ label, value, hint, tone, loading = false }: StatCardProps) {
  const tones = {
    cyan:  { bar: "bg-cyan-500",  text: "text-cyan-500",  dot: "bg-cyan-500" },
    amber: { bar: "bg-amber-500", text: "text-amber-500", dot: "bg-amber-500" },
    blue:  { bar: "bg-sky-500",   text: "text-sky-500",   dot: "bg-sky-500" },
    rose:  { bar: "bg-rose-500",  text: "text-rose-500",  dot: "bg-rose-500" },
  }[tone];
  return (
    <div className="relative rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm overflow-hidden">
      <span className={`absolute left-0 top-0 h-full w-1 ${tones.bar}`} />
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${tones.dot}`} />
        {label}
      </div>
      <div className={`mt-1.5 text-[22px] font-bold tabular-nums leading-tight ${tones.text}`}>
        {loading ? <span className="text-muted-foreground">…</span> : value}
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

export default function SalaryCreatePage() {
  const { showSuccess, showError } = useToast();
  const { active: paymentMethods, loading: methodsLoading } = usePaymentMethods();
  const [employees, setEmployees] = useState<EmployeePayroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Pul QAYSI kassadan chiqishi — oylik chiqarish haqiqiy chiqim yozuvlari
  // yaratadi, shuning uchun kassa va to'lov turi tanlanishi shart.
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  // Kassalar hali KELAYAPTIMI. Bunisiz tanlov ro'yxatida birinchi soniyalarda
  // "Kassa topilmadi" turardi — o'sha onda bu yolg'on, hali hech narsa
  // o'qilmagan edi.
  const [cashboxesLoading, setCashboxesLoading] = useState(true);
  const [cashboxId, setCashboxId] = useState<string>("");
  const [method, setMethod] = useState<string>("");
  // PLASTIK oyog'ining to'lov turi — naqd turidan alohida. Bo'sh bo'lsa
  // quyida sukut qiymat hosila sifatida chiqariladi.
  const [plastikMethod, setPlastikMethod] = useState<string>("");
  const [query, setQuery] = useState("");
  const [turiFilter, setTuriFilter] = useState<string>("all");
  const [hisoblash, setHisoblash] = useState<HisoblashFilter>("all");
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // QAYSI OY hisoblanadi. Sukut — joriy oy, ya'ni sahifa ochilgandagi xulq
  // avvalgidek qoladi.
  //
  // NIMA UCHUN OY TANLAGICH KERAK: kassir Kirim oynasida sanani o'tgan oyga
  // qo'yishi mumkin va yozuv bazaga o'sha sana bilan tushadi. Ilgari oylik
  // hisobi doim server soatidagi joriy oyni olardi, ya'ni o'sha to'lov
  // o'qituvchining o'tgan oy foiziga hech qachon qo'shilmasdi — uni
  // ko'rsatadigan ekranning o'zi yo'q edi. Yangi oy boshlangan kuni esa
  // o'tgan oyning butun tushumi ko'zdan g'oyib bo'lardi.
  const currentMonthKey = useMemo(() => payrollMonthKey(payrollPeriod()), []);
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const period = useMemo(() => payrollPeriodOf(monthKey), [monthKey]);
  const periodLabel = useMemo(() => payrollPeriodLabel(period), [period]);
  const isPastMonth = monthKey < currentMonthKey;
  // KELAJAK oy ham ko'riladi (o'quvchi oldindan to'lashi mumkin), lekin
  // undan pul CHIQARILMAYDI — hali ishlanmagan oy uchun oylik berilmaydi.
  // Server ham rad etadi, bu shunchaki tugmani oldindan o'chirib qo'yadi.
  const isFutureMonth = monthKey > currentMonthKey;
  const monthLabel = `${UZ_MONTHS[period.month]} ${period.year}`;
  // Sarlavhalar oyga qarab o'zgaradi: "shu kungacha" faqat JORIY oyda
  // to'g'ri — tugagan oy to'liq hisoblanadi, kelajak oyda esa umuman
  // hisoblanmaydi (faqat oldindan tushgan pul ko'rinadi).
  const calcSuffix = isPastMonth ? "to'liq oy" : isFutureMonth ? "oldindan" : "shu kungacha";
  // Kelajak oyda davr yorlig'i "1 — 0-oktabr (0/31 kun)" bo'lib chiqadi —
  // izohlarda uning o'rniga oddiy oy nomi ko'rsatiladi.
  const periodHint = isFutureMonth ? monthLabel : periodLabel;

  // Kechikkan javob YANGI oyning raqamlarini bosib ketmasin: har so'rovga
  // tartib raqami beriladi va faqat eng oxirgisi holatni yozadi (oy tez-tez
  // almashtirilsa javoblar tartibsiz kelishi mumkin).
  const reqSeq = useRef(0);
  const fetchRows = useCallback(() => {
    const seq = ++reqSeq.current;
    return fetch(`/api/salary-runs/employees-payroll?month=${monthKey}`)
      .then((r) => r.json())
      .then((d) => { if (seq === reqSeq.current && d.ok) setEmployees(d.employees); })
      .finally(() => { if (seq === reqSeq.current) setLoading(false); });
  }, [monthKey]);

  /** "Qayta hisoblash" tugmasi — spinnerni qayta yoqadi. */
  function load() {
    setLoading(true);
    fetchRows();
  }
  /**
   * Oyni almashtirish. Tanlov TOZALANADI — boshqa oyda tanlangan xodimlar
   * bo'yicha oylik chiqarib yuborish jiddiy xato bo'lardi.
   * `setLoading` shu yerda, effekt tanasida emas: birinchi renderda `loading`
   * allaqachon true va ortiqcha render zanjiri kerak emas.
   */
  function changeMonth(next: string) {
    if (next === monthKey) return;
    setMonthKey(next);
    setSelected(new Set());
    setLoading(true);
    // Eski oyning qatorlari TOZALANADI. Sarlavha darhol yangi oyni yozadi,
    // javob esa bir necha soniyadan keyin keladi — orada jadval "sentabr"
    // sarlavhasi ostida avgust qatorlarini ko'rsatib turardi (masalan
    // "450 000 × 50%"), ya'ni ekranda noto'g'ri fakt turardi. Endi o'rniga
    // yuklash belgisi chiqadi.
    setEmployees([]);
  }
  // `fetchRows` oyga bog'langan — oy o'zgarsa qatorlar o'z-o'zidan qayta
  // yuklanadi.
  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Kassalar — arxivdagilar tanlovga chiqmaydi. Bosh kassa sukut bo'yicha
  // tanlanadi (odatda oylik shundan chiqariladi), lekin o'zgartirsa bo'ladi.
  // Oylik chiqarilgandan keyin ham qayta o'qiladi: kassadagi qoldiq
  // kamaygan bo'ladi va tanlov ro'yxatidagi summalar eskirmasligi kerak.
  function loadCashboxes() {
    return fetch("/api/cashboxes")
      .then((r) => r.json())
      .then((d) => {
        if (!d?.ok) return;
        const list = (d.cashboxes as Cashbox[]).filter((c) => !c.archived);
        setCashboxes(list);
        // Tanlov faqat BOSHIDA qo'yiladi — qayta yuklashda foydalanuvchi
        // tanlagan kassa bosh kassaga qaytib ketmasin.
        setCashboxId((cur) => cur || String((list.find((c) => c.isPrimary) ?? list[0])?.id ?? ""));
      })
      .catch(() => {})
      // So'rov muvaffaqiyatli tugadimi yoki xato berdimi — ro'yxat endi
      // "kelayotgan" holatda emas, ya'ni bo'sh-holat xabari haqiqatga aylanadi.
      .finally(() => setCashboxesLoading(false));
  }
  useEffect(() => { loadCashboxes(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      if (turiFilter !== "all" && e.turi !== turiFilter) return false;
      if (hisoblash !== "all" && e.salaryType !== hisoblash) return false;
      if (!q) return true;
      return e.name.toLowerCase().includes(q) || e.phone.toLowerCase().includes(q);
    });
  }, [employees, query, turiFilter, hisoblash]);

  const allSelected = filtered.filter((e) => e.configured).length > 0
    && filtered.filter((e) => e.configured).every((e) => selected.has(e.id));
  const someSelected = selected.size > 0 && !allSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) headerCheckboxRef.current.indeterminate = someSelected;
  }, [someSelected]);

  // "Hammasini tanlash" ham faqat sozlanganlarni oladi.
  const selectable = useMemo(() => filtered.filter((e) => e.configured), [filtered]);
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) { selectable.forEach((e) => next.delete(e.id)); }
      else { selectable.forEach((e) => next.add(e.id)); }
      return next;
    });
  }
  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Faqat ish haqi SOZLANGAN xodimlar jamlanadi — sozlanmaganning
  // "hisoblangan"i 0 bo'ladi va uni yig'indiga qo'shish jami summani
  // haqiqatdan kichik ko'rsatgan bo'lardi.
  const stats = useMemo(() => {
    let hisoblangan = 0, avans = 0, tolangan = 0, qolgan = 0, otganOydan = 0, qarzdorlik = 0;
    for (const e of employees.filter((x) => x.configured)) {
      hisoblangan += payrollEarned(e, period);
      avans += e.paidAvans;
      tolangan += e.paidOylik;
      // To'lanadigan va qarzdorlik ALOHIDA yig'iladi — ishorali yig'indi
      // bo'lganda bir xodimning qarzi boshqasiga to'lanadigan pulni
      // "yeb" qo'yardi va karta jamini haqiqatdan kichik ko'rsatardi.
      qolgan += Math.max(payrollDue(e, period), 0);
      qarzdorlik += payrollDebt(e, period);
      otganOydan += e.carryOver;
    }
    return { hisoblangan, avans, tolangan, qolgan, otganOydan, qarzdorlik };
  }, [employees, period]);

  // Sukut — ro'yxatdagi birinchi faol to'lov turi. Effektda setState
  // qilinmaydi: qiymat shu yerda HOSILA sifatida chiqariladi, aks holda
  // ro'yxat yuklangach ortiqcha qayta render bo'lardi.
  const methodKey = method || paymentMethods[0]?.key || "";

  // Kassadan CHIQADIGAN summa: tanlangan xodimlarning musbat qoldiqlari.
  // Qarzdor xodimga pul chiqmaydi, shuning uchun u yig'indiga kirmaydi —
  // server ham aynan shunday hisoblaydi.
  const payoutTotal = useMemo(() => {
    let sum = 0;
    for (const e of employees) {
      if (!selected.has(e.id) || !e.configured) continue;
      sum += Math.max(payrollDue(e, period), 0);
    }
    return sum;
  }, [employees, selected, period]);

  // Ro'yxatda umuman plastik oyligi bor xodim bormi — ikkita qo'shimcha
  // ustun faqat shunda chiziladi.
  const anyPlastik = useMemo(() => employees.some((e) => e.plastikSalary > 0), [employees]);

  // Summaning KARTA va NAQD ga bo'linishi. Bu yerda hisob YO'Q — server
  // ham aynan shu funksiyalarni chaqiradi (lib/salary.ts), ya'ni ekrandagi
  // va kassadan chiqadigan raqam bir xil bo'lishi kafolatlangan.
  const { plastikTotal, naqdTotal } = useMemo(() => {
    let plastik = 0;
    let naqd = 0;
    for (const e of employees) {
      if (!selected.has(e.id) || !e.configured) continue;
      plastik += payrollPlastikLeg(e, period);
      naqd += payrollCashLeg(e, period);
    }
    return { plastikTotal: plastik, naqdTotal: naqd };
  }, [employees, selected, period]);

  // Plastik oyog'ining to'lov turi. Sukut — "plastik" kaliti (Sozlamalarda
  // o'chirilgan bo'lsa ro'yxatdagi birinchisi).
  const plastikMethodKey = plastikMethod
    || (paymentMethods.some((m) => m.key === PLASTIK_METHOD_KEY) ? PLASTIK_METHOD_KEY : "")
    || paymentMethods[0]?.key
    || "";

  const activeCashbox = cashboxes.find((c) => String(c.id) === cashboxId);
  // Chegara kassaning umumiy balansi emas, tanlangan TO'LOV TURIDAGI summa —
  // Kassalar sahifasidagi Chiqim oynasi ham shunday tekshiradi.
  const totalOf = (key: string) => (activeCashbox && key ? Number(activeCashbox.methodTotals?.[key]) || 0 : 0);
  const available = totalOf(methodKey);
  const plastikAvailable = totalOf(plastikMethodKey);
  // Har bir oyoq O'Z chelagidan yechiladi, shuning uchun yetarlilik ham
  // alohida tekshiriladi. Ikkalasi bir xil turga tushsa — bitta chelak.
  const sameMethod = plastikTotal > 0 && naqdTotal > 0 && plastikMethodKey === methodKey;
  const notEnough = sameMethod
    ? available < payoutTotal
    : (naqdTotal > available) || (plastikTotal > plastikAvailable);
  const needsPlastikMethod = plastikTotal > 0 && !plastikMethodKey;
  const canPayout =
    Boolean(cashboxId) && Boolean(methodKey) && payoutTotal > 0
    && !notEnough && !isFutureMonth && !sameMethod && !needsPlastikMethod;

  async function confirmPayout() {
    setSaving(true);
    try {
      const res = await fetch("/api/salary-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `month` — pul QAYSI oy hisobi uchun chiqayotgani. Serverda
        // chiqim yozuvining sanasi ham shu oy ichida bo'ladi, aks holda
        // o'tgan oy qayta ochilganda summa yana "to'lanmagan" bo'lib
        // ko'rinardi (app/api/salary-runs/route.ts → entryDate).
        // `method` — NAQD oyog'i (va plastigi yo'q xodimlarning yagonasi).
        // `plastikMethod` faqat karta oyog'i bo'lganda ishlatiladi.
        body: JSON.stringify({
          employeeIds: Array.from(selected),
          cashboxId: Number(cashboxId),
          method: methodKey,
          plastikMethod: plastikTotal > 0 ? plastikMethodKey : undefined,
          month: monthKey,
        }),
      });
      const data = await res.json();
      invalidateTransactions(); // yangi tranzaksiya yozildi -> kesh bekor
      if (!data.ok) {
        showError(data.error || "Oylik chiqarilmadi");
        setSaving(false);
        return;
      }
      // Ilgari bu yerdan tarix sahifasiga o'tilardi — endi hisob-kitob
      // bo'limning BOSH sahifasi, shuning uchun shu yerda qolamiz va
      // jadvalni qayta yuklaymiz: "To'langan oylik" va "Qolgan" darhol
      // yangilanadi, ya'ni chiqarish natijasi ko'z oldida ko'rinadi.
      // Kassadagi qoldiq ham kamaygani uchun kassalar qayta o'qiladi.
      showSuccess(`Oylik chiqarildi — ${fmtSum(payoutTotal)}`);
      setConfirmOpen(false);
      setSelected(new Set());
      setSaving(false);
      load();
      loadCashboxes();
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setSaving(false);
    }
  }

  const selectedCount = selected.size;
  const turiOptions = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => set.add(e.turi));
    return Array.from(set);
  }, [employees]);
  const turiLabel = (t: string) =>
    t === "teacher" ? "O'qituvchilar" : t === "moderator" ? "Moderatorlar" : t === "admin" ? "Adminlar" : t;

  return (
    // `page-frame` — loyihaning mavjud naqshi (app/globals.css): sahifa
    // ildizi to'liq balandlikni oladi va scroll SAHIFADA emas, jadval
    // kartasining ichida bo'ladi. Shu sababli sarlavha, kartalar, filtrlar
    // va "Hammasini tanlash" qatori qotib turadi — faqat qatorlar suriladi.
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      {/* Header — "Orqaga" YO'Q: bu bo'limning bosh sahifasi, qaytadigan
          yuqori sahifa yo'q. Tarixga o'tish o'ng tomondagi tugmada. */}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-[18px] md:text-[20px] font-bold">Oylik hisob-kitob</h1>
        {/* Oy tanlagich — o'tgan oyni QAYTA hisoblash uchun. */}
        <MonthYearPicker
          className="w-[124px]"
          value={{ month: period.month + 1, year: period.year }}
          onChange={(v) => changeMonth(`${v.year}-${String(v.month).padStart(2, "0")}`)}
        />
        {/* Kelajak oyda davr yorlig'i ma'nosiz ("0-oktabr") — o'rniga
            nima ko'rsatilayotgani aytiladi. */}
        {!isFutureMonth && (
          <span className="inline-flex items-center h-7 px-2.5 rounded-md bg-primary/10 text-primary text-[12px] font-semibold">
            {periodLabel}
          </span>
        )}
        {isPastMonth && (
          // Tugagan oy TO'LIQ hisoblanadi (oklad kesilmaydi) — foydalanuvchi
          // joriy oydagi "shu kungacha" hisobidan farqini ko'rib tursin.
          <span className="inline-flex items-center h-7 px-2.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-500 text-[12px] font-semibold">
            {`${monthLabel} — tugagan oy, to'liq hisoblanadi`}
          </span>
        )}
        {isFutureMonth && (
          <span className="inline-flex items-center h-7 px-2.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[12px] font-semibold">
            {`${monthLabel} — oldindan tushgan pul, oylik chiqarilmaydi`}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link
            href="/finance-payroll/history"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
          >
            <History className="w-4 h-4" />
            Chiqarishlar tarixi
          </Link>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
          >
            <RotateCcw className="w-4 h-4" />
            Qayta hisoblash
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={selectedCount === 0 || isFutureMonth}
            title={isFutureMonth ? "Kelajak oy uchun oylik chiqarilmaydi" : undefined}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <DollarSign className="w-4 h-4" />
            Oylikni chiqarish
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-white/20 text-[11px] font-bold tabular-nums">
              {selectedCount}
            </span>
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          tone="cyan"
          label={`Hisoblangan oylik (${calcSuffix})`}
          value={fmtSum(stats.hisoblangan)}
          hint={`${employees.length} ta xodim · ${periodHint}`}
          loading={loading}
        />
        <StatCard
          tone="amber"
          label="Berilgan avans"
          value={fmtSum(stats.avans)}
          hint="oylikdan ushlab qolinadi"
          loading={loading}
        />
        <StatCard
          tone="blue"
          label="To'langan oylik"
          value={fmtSum(stats.tolangan)}
          hint="kassadan chiqarilgan"
          loading={loading}
        />
        <StatCard
          tone="rose"
          label="Qolgan to'lanadigan"
          value={fmtSum(stats.qolgan)}
          hint={
            stats.qarzdorlik > 0
              ? `o'tgan oydan: ${fmtSum(stats.otganOydan)} · xodim qarzi: ${fmtSum(stats.qarzdorlik)}`
              : `shu jumladan o'tgan oydan: ${fmtSum(stats.otganOydan)}`
          }
          loading={loading}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ism yoki telefon raqami…"
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-card text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="relative">
          <select
            value={turiFilter}
            onChange={(e) => setTuriFilter(e.target.value)}
            className="h-10 pl-3 pr-9 rounded-lg border border-border bg-card text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[180px]"
          >
            <option value="all">Barcha xodimlar</option>
            {turiOptions.map((t) => (
              <option key={t} value={t}>{turiLabel(t)}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={hisoblash}
            onChange={(e) => setHisoblash(e.target.value as HisoblashFilter)}
            className="h-10 pl-3 pr-9 rounded-lg border border-border bg-card text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[200px]"
          >
            <option value="all">Hisoblash: barchasi</option>
            <option value="foiz">Hisoblash: foizli</option>
            <option value="fixed">Hisoblash: okladli</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-secondary/30">
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              ref={headerCheckboxRef}
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="rounded border-border w-4 h-4"
            />
            <span className="font-medium">Hammasini tanlash</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground tabular-nums">{selectedCount} ta tanlangan</span>
          </label>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-primary/10 text-primary text-xs">
            <span className="font-medium">Umumiy soni:</span>
            <span className="font-bold tabular-nums">{filtered.length}</span>
          </div>
        </div>

        {/* `table-scroll` — scroll aynan shu yerda bo'ladi va globals.css
            dagi qoida `thead th` ni yopishtirib qo'yadi, ya'ni ustun
            nomlari pastga surilganda ham ko'rinib turadi. */}
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-3 py-3 w-10" />
                <th className="text-left px-3 py-3 whitespace-nowrap w-14">№</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">To&apos;liq ismi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Turi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{`Hisob-kitob (${calcSuffix})`}</th>
                {/* Asosiy hisob zanjiri yonma-yon: hisoblangan → soliq →
                    olinganlar → qolgan. Bonus va jarima kamdan-kam
                    to'ldiriladi, shuning uchun ular OXIRGA surildi. */}
                <th className="text-right px-3 py-3 whitespace-nowrap">Hisoblangan</th>
                {/* HISOBLANGAN → KARTAGA → NAQD → SOLIQ tartibi ataylab:
                    hisoblangan oylik avval ikki kanalga bo'linadi, keyin
                    undan soliq ushlanadi. Qator o'ngga qarab o'qilganda
                    pulning yo'li ko'rinadi. Kanal ustunlari faqat kimdadir
                    plastik oyligi bo'lsa chiziladi. */}
                {anyPlastik && <th className="text-right px-3 py-3 whitespace-nowrap">Kartaga</th>}
                {anyPlastik && <th className="text-right px-3 py-3 whitespace-nowrap">Naqd</th>}
                <th className="text-right px-3 py-3 whitespace-nowrap">Soliq</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">Avans olingan</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">To&apos;langan oylik</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">O&apos;tgan oydan</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">Bonus</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">Jarima</th>
                {/* QOLGAN — qatorning ENG OXIRIDA, yakuniy raqam sifatida:
                    hisoblangan − soliq (+ o'tgan oydan − allaqachon
                    to'langani). Ya'ni kassadan haqiqatan chiqadigan summa. */}
                <th className="text-right px-3 py-3 whitespace-nowrap">Qolgan</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => {
                const base = payrollBase(e, period);
                const earned = payrollEarned(e, period);
                const paid = payrollPaid(e);
                const due = payrollDue(e, period);
                const tax = payrollTax(e, period);
                // Sichqoncha ostida qaysi soliqlardan yig'ilgani ko'rinsin.
                const taxTitle = payrollTaxLines(e, period)
                  .map((l) => `${l.name} (${l.detail}): ${fmtNum(l.amount)}`)
                  .join("\n");
                const isFoiz = e.salaryType === "foiz";
                const badgeCls = isFoiz
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                  : "bg-sky-500/10 text-sky-600 border-sky-500/20";
                const formula = isFoiz
                  ? `${fmtNum(e.collected)} × ${e.percent}% = ${fmtNum(base)}`
                  : `${fmtNum(e.fixedSalary)} × ${period.day}/${period.daysIn} kun = ${fmtNum(base)}`;
                return (
                  <tr
                    key={e.id}
                    className={`border-b border-border/50 transition-colors hover:bg-secondary/30 ${selected.has(e.id) ? "bg-primary/5" : ""}`}
                  >
                    <td className="px-3 py-3 align-top">
                      <input
                        type="checkbox"
                        checked={selected.has(e.id)}
                        onChange={() => toggleOne(e.id)}
                        disabled={!e.configured}
                        title={e.configured ? undefined : "Ish haqi sozlanmagan — oylik chiqarib bo'lmaydi"}
                        className="rounded border-border w-4 h-4 disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-3 py-3 align-top text-muted-foreground tabular-nums text-[13px]">{i + 1}</td>
                    <td className="px-3 py-3 align-top whitespace-nowrap">
                      {/* Ism — xodim profiliga havola (qaysi hisob-kitob
                          qaysi odamga tegishli ekanini tekshirish uchun). */}
                      <Link
                        href={`/management-xodimlar/${e.id}`}
                        className="text-[13px] font-medium text-primary hover:underline"
                      >
                        {e.name}
                      </Link>
                      <div className="text-[11px] text-muted-foreground tabular-nums">{e.phone}</div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      {e.configured ? (
                        <span className={`inline-flex items-center h-6 px-2 rounded-md border text-[11px] font-medium ${badgeCls} whitespace-nowrap`}>
                          {isFoiz ? `Foiz ${e.percent}%` : "Oklad"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center h-6 px-2 rounded-md border text-[11px] font-medium bg-amber-500/10 text-amber-700 border-amber-500/20 whitespace-nowrap">
                          Sozlanmagan
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-[12.5px] tabular-nums">
                      {e.configured ? (
                        <div className="whitespace-nowrap">{formula}</div>
                      ) : (
                        <Link href={`/management-xodimlar/${e.id}`} className="text-[12px] text-primary hover:underline">
                          Ish haqi kiritilmagan — sozlash
                        </Link>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-right text-[13px] tabular-nums font-semibold whitespace-nowrap">
                      {e.configured ? fmtNum(earned) : <span className="text-muted-foreground">—</span>}
                    </td>
                    {/* KARTAGA — shu chiqarishda kartaga o'tadigan summa.
                        Boshqa hech narsa ko'rsatilmaydi: e'lon qilingan
                        summa xodim kartasida turadi, bu ustun esa faqat
                        "hozir qancha ketadi" degan savolga javob beradi. */}
                    {anyPlastik && (
                      <td className="px-3 py-3 align-top text-right text-[13px] tabular-nums whitespace-nowrap">
                        {e.plastikSalary > 0 ? (
                          <span className="font-medium text-sky-600">{fmtNum(payrollPlastikLeg(e, period))}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    )}
                    {anyPlastik && (
                      <td className="px-3 py-3 align-top text-right text-[13px] tabular-nums whitespace-nowrap">
                        {e.configured ? fmtNum(payrollCashLeg(e, period)) : <span className="text-muted-foreground">—</span>}
                      </td>
                    )}
                    {/* Soliq — faqat kartasida yoqilgan xodimda hisoblanadi
                        (Boshqaruv → Xodimlar). O'chiq bo'lsa "—", ya'ni
                        "0 so'm soliq" bilan "soliq solinmaydi" farqlanadi. */}
                    <td className="px-3 py-3 align-top text-right text-[13px] tabular-nums whitespace-nowrap">
                      {!e.taxable ? (
                        <span className="text-muted-foreground" title="Bu xodimga soliq solinmaydi">—</span>
                      ) : tax > 0 ? (
                        <span className="text-rose-600 font-medium" title={taxTitle}>−{fmtNum(tax)}</span>
                      ) : (
                        <span className="text-muted-foreground" title="Soliq ro'yxati bo'sh yoki hisoblangan oylik 0">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-right text-[13px] tabular-nums whitespace-nowrap">
                      {e.paidAvans > 0 ? <span className="text-amber-600 font-medium">{fmtNum(e.paidAvans)}</span> : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="px-3 py-3 align-top text-right text-[13px] tabular-nums whitespace-nowrap">
                      {paid > e.paidAvans ? fmtNum(paid - e.paidAvans) : <span className="text-muted-foreground">0</span>}
                    </td>
                    {/* O'tgan oydan qolgan qoldiq ISHORALI: musbat —
                        akademiya qarzi, manfiy — xodimning qarzdorligi
                        (o'tgan oyda ortiqcha olgan pul). */}
                    <td className="px-3 py-3 align-top text-right text-[13px] tabular-nums whitespace-nowrap">
                      {e.carryOver !== 0 ? (
                        <div>
                          <div className={e.carryOver < 0 ? "text-amber-600 font-medium" : ""}>
                            {fmtNum(e.carryOver)}
                          </div>
                          {e.carryNote && <div className="text-[11px] text-muted-foreground">{e.carryNote}</div>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-right text-[13px] tabular-nums whitespace-nowrap">
                      {e.bonus > 0 ? <span className="text-emerald-600 font-medium">{fmtNum(e.bonus)}</span> : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="px-3 py-3 align-top text-right text-[13px] tabular-nums whitespace-nowrap">
                      {e.jarima > 0 ? <span className="text-rose-600 font-medium">{fmtNum(e.jarima)}</span> : <span className="text-muted-foreground">0</span>}
                    </td>
                    {/* QOLGAN — yakuniy raqam, qatorning eng oxirida. */}
                    <td className="px-3 py-3 align-top text-right text-[13px] tabular-nums font-bold whitespace-nowrap">
                      {e.configured ? (
                        due < 0 ? (
                          <div>
                            <div className="text-amber-600">{fmtNum(due)}</div>
                            <div className="text-[11px] font-normal text-muted-foreground">qarzdor</div>
                          </div>
                        ) : (
                          fmtNum(due)
                        )
                      ) : (
                        <span className="text-muted-foreground font-normal">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    {loading ? <SpinnerBlock size={22} /> : "Xodim topilmadi"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && setConfirmOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-6">
            {/* QAYSI OY — tasdiqlash oynasida ko'rinishi SHART: o'tgan oy
                tanlangan holda tugma bosilsa, pul boshqa oyning hisobiga
                chiqadi va buni keyin faqat chiqarishni o'chirib qaytarish
                mumkin. */}
            <p className="text-center text-[15px] font-semibold">
              {`${monthLabel} — ${selectedCount} ta xodim uchun oylik chiqariladi`}
            </p>
            <p className="text-center text-[12.5px] text-muted-foreground mt-1">
              Pul tanlangan kassadan chiqadi va Tranzaksiyalar jurnaliga yoziladi.
            </p>
            {isPastMonth && (
              // Jurnaldagi sana o'sha oyning oxirgi kuni bo'ladi — aks holda
              // "to'langan oylik" o'tgan oyga bog'lanmasdi va bir summa ikki
              // marta chiqarilishi mumkin edi (app/api/salary-runs/route.ts).
              <p className="text-center text-[12.5px] text-amber-600 dark:text-amber-500 mt-1">
                {`Chiqim yozuvi ${monthLabel} oyining oxirgi kuni bilan qayd etiladi.`}
              </p>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-[12px] font-medium mb-1">Kassa</label>
                <div className="relative">
                  <select
                    value={cashboxId}
                    onChange={(e) => setCashboxId(e.target.value)}
                    disabled={saving || cashboxesLoading}
                    className="w-full h-10 pl-3 pr-9 rounded-lg border border-border bg-card text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                  >
                    {/* Yuklanish bo'sh-holatdan USTUN: kassalar kelmaguncha
                        "Kassa topilmadi" deb yozib bo'lmaydi. */}
                    {(cashboxesLoading || cashboxes.length === 0) && (
                      <option value="">
                        {selectPlaceholder(cashboxesLoading, cashboxes.length, "Kassa topilmadi")}
                      </option>
                    )}
                    {cashboxes.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}{c.isPrimary ? " — bosh kassa" : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium mb-1">
                  {plastikTotal > 0 ? "Naqd qismi uchun to'lov turi" : "To'lov turi"}
                </label>
                {/* Har bir tur yonida SHU KASSADAGI qoldiq turadi — qaysi
                    turdan oylik chiqarish mumkinligi ro'yxatning o'zidayoq
                    ko'rinsin, tanlab-tanlab qidirishga to'g'ri kelmasin. */}
                <Select
                  value={methodKey}
                  onChange={setMethod}
                  disabled={saving}
                  // Ro'yxat kelayotganda "To'lov turi topilmadi" chiqmasin —
                  // `loading` bo'sh-holat matnidan ustun (ui/Select).
                  loading={methodsLoading}
                  placeholder={paymentMethods.length === 0 ? "To'lov turi topilmadi" : "Tanlang"}
                  options={paymentMethods.map((m) => ({
                    value: m.key,
                    label: m.name,
                    hint: fmtSum(Number(activeCashbox?.methodTotals?.[m.key]) || 0),
                  }))}
                />
              </div>

              {/* PLASTIK oyog'i — faqat kartaga pul ketadigan bo'lsa
                  ko'rinadi. Plastigi yo'q xodimlar bilan ishlaganda oyna
                  bugungidek bitta tanlov bilan qoladi. */}
              {plastikTotal > 0 && (
                <div>
                  <label className="block text-[12px] font-medium mb-1">Plastik qismi uchun to&apos;lov turi</label>
                  <Select
                    value={plastikMethodKey}
                    onChange={setPlastikMethod}
                    disabled={saving}
                    loading={methodsLoading}
                    placeholder={paymentMethods.length === 0 ? "To'lov turi topilmadi" : "Tanlang"}
                    options={paymentMethods.map((m) => ({
                      value: m.key,
                      label: m.name,
                      hint: fmtSum(Number(activeCashbox?.methodTotals?.[m.key]) || 0),
                    }))}
                  />
                </div>
              )}

              {/* TARTIB: avval kanallar, oxirida yig'indi — jadvaldagi
                  "Kartaga · Naqd · Qolgan" ustunlari bilan bir xil o'qiladi.
                  Har kanal yonida SHU KASSADAGI qoldiq turadi, ya'ni pul
                  yetmasligi tugma bosilishidan OLDIN ko'rinadi. */}
              <div className="rounded-lg border border-border bg-secondary/20 p-3 text-[13px] space-y-1">
                {plastikTotal > 0 ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Kartaga</span>
                      <span className={`tabular-nums ${plastikTotal > plastikAvailable ? "text-rose-600 font-semibold" : ""}`}>
                        {fmtSum(plastikTotal)} <span className="text-muted-foreground">/ {fmtSum(plastikAvailable)}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Naqd</span>
                      <span className={`tabular-nums ${naqdTotal > available ? "text-rose-600 font-semibold" : ""}`}>
                        {fmtSum(naqdTotal)} <span className="text-muted-foreground">/ {fmtSum(available)}</span>
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Kassada mavjud</span>
                    <span className={`tabular-nums ${notEnough ? "text-rose-600 font-semibold" : ""}`}>{fmtSum(available)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border pt-1 mt-1">
                  <span className="text-muted-foreground">Chiqariladigan summa</span>
                  <span className="font-semibold tabular-nums">{fmtSum(payoutTotal)}</span>
                </div>
              </div>

              {sameMethod && (
                <p className="text-[12.5px] text-rose-600">
                  Plastik va naqd uchun bir xil to&apos;lov turi tanlangan — birini o&apos;zgartiring,
                  aks holda jurnalda ikki qism ajralmay qoladi.
                </p>
              )}

              {payoutTotal === 0 && (
                <p className="text-[12.5px] text-amber-600">
                  Tanlangan xodimlarda to&apos;lanadigan qoldiq yo&apos;q — oylik allaqachon chiqarilgan yoki qarzdorlik bor.
                </p>
              )}
              {/* Butun jumla bitta ifodada — JSX ifoda bilan undan keyingi
                  matn orasidagi bo'shliqni yeb qo'yadi (so'mkam bo'lib
                  chiqardi). */}
              {notEnough && (
                <p className="text-[12.5px] text-rose-600">
                  {`Mablag' yetarli emas — ${fmtSum(payoutTotal - available)} kam. Boshqa kassa yoki to'lov turini tanlang.`}
                </p>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={saving}
                className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
              >
                Bekor qilish
              </button>
              <button
                onClick={confirmPayout}
                disabled={saving || !canPayout}
                className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Chiqarilmoqda…" : "Ha, chiqarish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
