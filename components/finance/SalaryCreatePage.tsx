"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/ui/Link";
import { DollarSign, History, RotateCcw, Search } from "lucide-react";
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
  payrollEarned,
  payrollFoizPart,
  payrollHasOklad,
  payrollMonthKey,
  payrollOkladDays,
  payrollOkladPart,
  payrollPaid,
  payrollPeriod,
  payrollPeriodOf,
  payrollStartsInPeriod,
  payrollTax,
  payrollTaxLines,
  payrollPlastikLeg,
  payrollPlastikTarget,
  payrollCashLeg,
  payrollCashDue,
  payrollPayout,
  type BranchPayouts,
  type EmployeePayroll,
} from "@/lib/salary";
import { invalidateTransactions } from "@/lib/cacheKeys";
import Modal from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

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
// Qatorlar XODIM bo'yicha (`payrollBranchId`), "Berilgan avans" va
// "To'langan oylik" kartochkalari esa KASSA bo'yicha — pul qaysi filial
// kassasidan chiqqan bo'lsa, o'sha filialda (`givenCard` izohiga qarang).
//
// Ish haqi sozlanmagan xodimda raqam KO'RSATILMAYDI — "Sozlanmagan" deb
// turadi va uni tanlab oylik chiqarib bo'lmaydi (server ham rad etadi).

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("ru-RU");
}
function fmtSum(n: number): string {
  return fmtNum(n) + " so'm";
}
/** "2026-09-23" → "23.09.2026". */
function fmtIsoDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

type HisoblashFilter = "all" | "foiz" | "fixed" | "mixed";

interface StatCardProps {
  label: string;
  value: string;
  hint: string;
  /** Sichqoncha ustiga kelganda chiqadigan to'liq izoh (ixtiyoriy). */
  title?: string;
  /**
   * Asosiy raqam ostidagi IKKINCHI qator (ixtiyoriy) — masalan "Jami
   * tushum" kartochkasidagi sof foyda. `hint` dan farqi: bu ham RAQAM,
   * shuning uchun kattaroq va o'z rangi bilan chiziladi, hira izoh
   * bo'lib qolib ketmaydi.
   */
  sub?: { text: string; tone: "emerald" | "rose" };
  tone: "cyan" | "amber" | "blue" | "rose" | "emerald";
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
function StatCard({ label, value, hint, title, sub, tone, loading = false }: StatCardProps) {
  const tones = {
    cyan:    { bar: "bg-cyan-500",    text: "text-cyan-500",    dot: "bg-cyan-500" },
    amber:   { bar: "bg-amber-500",   text: "text-amber-500",   dot: "bg-amber-500" },
    blue:    { bar: "bg-sky-500",     text: "text-sky-500",     dot: "bg-sky-500" },
    rose:    { bar: "bg-rose-500",    text: "text-rose-500",    dot: "bg-rose-500" },
    emerald: { bar: "bg-emerald-500", text: "text-emerald-500", dot: "bg-emerald-500" },
  }[tone];
  return (
    <div
      title={title}
      className="relative rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm overflow-hidden"
    >
      <span className={`absolute left-0 top-0 h-full w-1 ${tones.bar}`} />
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${tones.dot}`} />
        {label}
      </div>
      <div className={`mt-1.5 text-[22px] font-bold tabular-nums leading-tight ${tones.text}`}>
        {loading ? <span className="text-muted-foreground">…</span> : value}
      </div>
      {sub && !loading && (
        <div
          className={`mt-0.5 text-[13px] font-semibold tabular-nums ${
            sub.tone === "rose" ? "text-rose-500" : "text-emerald-600"
          }`}
        >
          {sub.text}
        </div>
      )}
      <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

export default function SalaryCreatePage() {
  const { t, months } = useT();
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
  const periodLabel = useMemo(() => t("1 — {day}-{month} ({day}/{daysIn} kun)", { day: period.day, month: months[period.month].toLowerCase(), daysIn: period.daysIn }), [period, months, t]);
  const isPastMonth = monthKey < currentMonthKey;
  // KELAJAK oy ham ko'riladi (o'quvchi oldindan to'lashi mumkin), lekin
  // undan pul CHIQARILMAYDI — hali ishlanmagan oy uchun oylik berilmaydi.
  // Server ham rad etadi, bu shunchaki tugmani oldindan o'chirib qo'yadi.
  const isFutureMonth = monthKey > currentMonthKey;
  const monthLabel = `${months[period.month]} ${period.year}`;
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
  // "Berilgan avans" va "To'langan oylik" kartochkalari — pul QAYSI FILIAL
  // KASSASIDAN chiqqani bo'yicha (lib/payrollSources.ts → attachBranchPayouts).
  // Qatorlar bilan BITTA javobda keladi, ya'ni oy va filial har doim bir xil.
  const [given, setGiven] = useState<BranchPayouts | null>(null);
  const fetchRows = useCallback(() => {
    const seq = ++reqSeq.current;
    return fetch(`/api/salary-runs/employees-payroll?month=${monthKey}&given=1`)
      .then((r) => r.json())
      .then((d) => {
        if (seq !== reqSeq.current || !d.ok) return;
        setEmployees(d.employees);
        setGiven(d.given ?? null);
      })
      .finally(() => { if (seq === reqSeq.current) setLoading(false); });
  }, [monthKey]);

  // OYNING TUSHUMI VA XARAJATI — "Jami tushum" kartochkasi uchun
  // (/api/salary-runs/month-cashflow). Xodimlar jadvali bilan bir xil
  // filialga kesilgan, ya'ni ikkala raqam bitta qamrovdan.
  //
  // `null` — hali kelmagan. Nol bilan almashtirilmaydi: bo'sh oy ham
  // 0 beradi va ikkalasini ajratib bo'lmasdi, kartochkada esa javob
  // kelguncha "0 so'm" turib qolardi.
  const [cashflow, setCashflow] = useState<
    { daromad: number; xarajat: number; hasCashbox: boolean } | null
  >(null);
  const cashflowSeq = useRef(0);
  const fetchCashflow = useCallback(() => {
    const seq = ++cashflowSeq.current;
    // Manzil QATTIQ yozilgan (shablon ichida emas): ruxsatlar jadvali
    // route fayllari bo'yicha yig'iladi va u chaqiruv manzilini matndan
    // topadi — scripts/gen-api-permissions.mjs.
    return fetch(`/api/salary-runs/month-cashflow?month=${monthKey}`)
      .then((r) => r.json())
      .then((d) => {
        if (seq !== cashflowSeq.current || !d?.ok) return;
        setCashflow({ daromad: d.daromad, xarajat: d.xarajat, hasCashbox: !!d.hasCashbox });
      })
      .catch(() => {});
  }, [monthKey]);
  useEffect(() => { fetchCashflow(); }, [fetchCashflow]);

  /** "Qayta hisoblash" tugmasi — spinnerni qayta yoqadi. */
  function load() {
    setLoading(true);
    setCashflow(null);
    fetchRows();
    fetchCashflow();
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
    // Kartochkadagi daromad/xarajat va kassa bo'yicha avans ham eski
    // oyniki — o'chiriladi.
    setCashflow(null);
    setGiven(null);
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
  //
  // "Berilgan avans" va "To'langan oylik" bu yerda YIG'ILMAYDI — ular
  // qatorlardan emas, kassa bo'yicha keladi (`given`, quyida `givenCard`).
  const stats = useMemo(() => {
    let hisoblangan = 0, qolgan = 0, kartaga = 0, naqd = 0, otganOydan = 0, qarzdorlik = 0;
    for (const e of employees.filter((x) => x.configured)) {
      hisoblangan += payrollEarned(e, period);
      // "Qolgan to'lanadigan" — kassadan CHIQADIGAN jami (lib/salary.ts →
      // payrollPayout = karta + naqd = musbat qoldiq). Karta va naqd
      // kesimi kartochka izohi uchun. Qarzdorlik ALOHIDA yig'iladi —
      // ishorali yig'indi bo'lganda bir xodimning qarzi boshqasiga
      // to'lanadigan pulni "yeb" qo'yardi.
      qolgan += payrollPayout(e, period);
      kartaga += payrollPlastikLeg(e, period);
      naqd += payrollCashLeg(e, period);
      qarzdorlik += payrollDebt(e, period);
      otganOydan += e.carryOver;
    }
    return { hisoblangan, qolgan, kartaga, naqd, otganOydan, qarzdorlik };
  }, [employees, period]);

  /**
   * "Berilgan avans" / "To'langan oylik" kartochkasi — pul QAYSI FILIAL
   * KASSASIDAN chiqqani bo'yicha (foydalanuvchi, 23.09.2026: "kim avans
   * bergan bo'lsa o'sha moderator filialida ko'rinsin").
   *
   * Jadval esa XODIM bo'yicha qoladi (qolgan oylikdan hamma olgani ushlab
   * qolinadi), shuning uchun ikkalasining farqi izohda OCHIQ aytiladi —
   * aks holda "kartochkada 8 253 000, jadvalda bitta odam 2 740 000"
   * degan savol qaytib chiqardi:
   *   • boshqa filial xodimlariga — shu kassadan, lekin ro'yxatda yo'q;
   *   • xodimlar boshqa filialdan olgan — ro'yxatda bor, lekin pul
   *     boshqa filial kassasidan chiqqan (o'sha filialda ko'rinadi).
   */
  function givenCard(kind: "avans" | "oylik"): { value: string; hint: string; title?: string } {
    if (!given) return { value: "—", hint: "" };
    if (!given.hasCashbox) return { value: "—", hint: t("bu filialga kassa biriktirilmagan") };
    const total = given[kind];
    const toOthers = given.toOthers.filter((o) => o[kind] > 0);
    const toOthersSum = toOthers.reduce((s, o) => s + o[kind], 0);
    const fromOthers = given.fromOthers[kind];
    const hint: string[] = [];
    if (toOthersSum > 0) hint.push(t("boshqa filial xodimlariga {amount}", { amount: fmtNum(toOthersSum) }));
    if (fromOthers > 0) hint.push(t("xodimlar boshqa filialdan olgan {amount}", { amount: fmtNum(fromOthers) }));
    const title = [
      kind === "avans"
        ? t("Shu filial kassalaridan berilgan avans: {amount}", { amount: fmtSum(total) })
        : t("Shu filial kassalaridan chiqarilgan oylik: {amount}", { amount: fmtSum(total) }),
    ];
    if (toOthersSum > 0) {
      title.push(t("Shundan boshqa filial xodimlariga — {amount}:", { amount: fmtSum(toOthersSum) }));
      for (const o of toOthers) {
        const where = o.archived ? t("arxivda") : o.branch || t("xodimlar ro'yxatida yo'q");
        title.push(`  ${o.name || t("ism ko'rsatilmagan")} (${where}): ${fmtNum(o[kind])}`);
      }
    }
    if (fromOthers > 0) {
      title.push(t("Bu filial xodimlari boshqa filial kassalaridan olgan: {amount} — u o'sha filialda ko'rinadi, xodimning qolgan oyligidan esa baribir ushlab qolinadi.", { amount: fmtSum(fromOthers) }));
    }
    return {
      value: t(fmtSum(total)),
      hint: hint.length > 0 ? hint.join(" · ") : t("shu filial kassalaridan"),
      title: title.join("\n"),
    };
  }
  const avansCard = givenCard("avans");
  const oylikCard = givenCard("oylik");

  /**
   * SOF FOYDA — barcha chiqimlardan keyin o'quv markazda qoladigan pul.
   *
   *     sof foyda = oy tushumi − oy xarajati − qolgan to'lanadigan oylik
   *
   * XARAJAT ICHIDA allaqachon chiqarilgan avans va oylik BOR (oylik
   * chiqarish ham chiqim yozuvi yaratadi — app/api/salary-runs).
   * Shuning uchun ustiga `stats.qolgan` qo'shiladi, `stats.hisoblangan`
   * emas: aks holda to'langan qism ikki marta ayirilardi.
   *
   * Ko'chirmalar bu hisobga KIRMAYDI — server faqat `payIn`/`payOut`
   * yozuvlarini yig'adi, ya'ni rahbar kassaga topshirilgan tushum
   * "xarajat" bo'lib ko'rinmaydi.
   *
   * `hasCashbox: false` — filialga kassa bog'lanmagan, ya'ni tushum ham,
   * xarajat ham 0 bo'lib keladi. Bunda son KO'RSATILMAYDI: "0 − 0 −
   * oylik" manfiy raqami yolg'on bo'lardi (pul bor, u boshqa kassada).
   */
  const sofFoyda = cashflow ? cashflow.daromad - cashflow.xarajat - stats.qolgan : 0;
  const cashflowNoma = cashflow !== null && !cashflow.hasCashbox;

  // Sukut — ro'yxatdagi birinchi faol to'lov turi. Effektda setState
  // qilinmaydi: qiymat shu yerda HOSILA sifatida chiqariladi, aks holda
  // ro'yxat yuklangach ortiqcha qayta render bo'lardi.
  const methodKey = method || paymentMethods[0]?.key || "";

  // Kassadan CHIQADIGAN summa: tanlangan xodimlarning musbat qoldiqlari
  // (karta oyog'i + kartadan keyingi naqd). Qarzdor xodimga pul chiqmaydi
  // — server ham aynan shu funksiya bilan hisoblaydi
  // (app/api/salary-runs/route.ts).
  const payoutTotal = useMemo(() => {
    let sum = 0;
    for (const e of employees) {
      if (!selected.has(e.id) || !e.configured) continue;
      sum += payrollPayout(e, period);
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
  // Qancha YETMAYDI — har bir chelak o'zi bo'yicha. Ilgari xabarda doim
  // `payoutTotal − naqd` turardi: naqd yetarli-yu karta chelagi yetmaganda
  // u MANFIY son ("−57 000 000 so'm kam") chiqarardi.
  const shortfall = sameMethod
    ? Math.max(payoutTotal - available, 0)
    : Math.max(naqdTotal - available, 0) + Math.max(plastikTotal - plastikAvailable, 0);
  const canPayout =
    Boolean(cashboxId) && Boolean(methodKey) && payoutTotal > 0
    && !notEnough && !isFutureMonth && !sameMethod && !needsPlastikMethod;

  /**
   * "Oylikni chiqarish" tugmasi. Xodim TANLANMAGAN bo'lsa tugma o'chirilmaydi
   * — bosilganda nima qilish kerakligi aytiladi. Ilgari u jimgina kulrang
   * turardi va "tugma ishlamayapti" deb o'qilardi (29.09.2026).
   */
  function openConfirm() {
    if (selected.size === 0) {
      showError(t("Avval jadvaldan xodimlarni belgilang — chap tomondagi katakchalar"));
      return;
    }
    setConfirmOpen(true);
  }

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
        showError(t(data.error || "Oylik chiqarilmadi"));
        setSaving(false);
        return;
      }
      // Ilgari bu yerdan tarix sahifasiga o'tilardi — endi hisob-kitob
      // bo'limning BOSH sahifasi, shuning uchun shu yerda qolamiz va
      // jadvalni qayta yuklaymiz: "To'langan oylik" va "Qolgan" darhol
      // yangilanadi, ya'ni chiqarish natijasi ko'z oldida ko'rinadi.
      // Kassadagi qoldiq ham kamaygani uchun kassalar qayta o'qiladi.
      showSuccess(t("Oylik chiqarildi — {payoutTotal}", { payoutTotal: fmtSum(payoutTotal) }));
      setConfirmOpen(false);
      setSelected(new Set());
      setSaving(false);
      load();
      loadCashboxes();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  const selectedCount = selected.size;
  const turiOptions = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => set.add(e.turi));
    return Array.from(set);
  }, [employees]);
  const turiLabel = (tv: string) =>
    tv === "teacher" ? "O'qituvchilar" : tv === "moderator" ? "Moderatorlar" : tv === "admin" ? "Adminlar" : tv;

  return (
    // `page-frame` — loyihaning mavjud naqshi (app/globals.css): sahifa
    // ildizi to'liq balandlikni oladi va scroll SAHIFADA emas, jadval
    // kartasining ichida bo'ladi. Shu sababli sarlavha, kartalar, filtrlar
    // va "Hammasini tanlash" qatori qotib turadi — faqat qatorlar suriladi.
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      {/* Header — "Orqaga" YO'Q: bu bo'limning bosh sahifasi, qaytadigan
          yuqori sahifa yo'q. Tarixga o'tish o'ng tomondagi tugmada. */}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-[18px] md:text-[20px] font-bold">{t("Oylik hisob-kitob")}</h1>
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
            {t("{monthLabel} — tugagan oy, to'liq hisoblanadi", { monthLabel })}
          </span>
        )}
        {isFutureMonth && (
          <span className="inline-flex items-center h-7 px-2.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[12px] font-semibold">
            {t("{monthLabel} — oldindan tushgan pul, oylik chiqarilmaydi", { monthLabel })}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link
            href="/finance-payroll/history"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
          >
            <History className="w-4 h-4" />
            {t("Chiqarishlar tarixi")}
          </Link>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
          >
            <RotateCcw className="w-4 h-4" />
            {t("Qayta hisoblash")}
          </button>
          <button
            onClick={openConfirm}
            disabled={isFutureMonth}
            title={
              isFutureMonth ? t("Kelajak oy uchun oylik chiqarilmaydi")
              : selectedCount === 0 ? t("Avval jadvaldan xodimlarni belgilang — chap tomondagi katakchalar")
              : undefined
            }
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <DollarSign className="w-4 h-4" />
            {t("Oylikni chiqarish")}
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-white/20 text-[11px] font-bold tabular-nums">
              {selectedCount}
            </span>
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {/* BIRINCHI TURADI — sahifadagi asosiy savolga javob: shu oyda
            qancha tushdi va hamma chiqimdan keyin markazda qancha qoladi.
            Sof foyda manfiy bo'lsa qizil: bu "foyda" emas, ZARAR degani
            va uni yashil rangda ko'rsatish chalg'itardi. */}
        <StatCard
          tone="emerald"
          label={t("Jami tushum")}
          value={cashflowNoma ? "—" : fmtSum(cashflow?.daromad ?? 0)}
          sub={
            cashflowNoma
              ? undefined
              : { text: t("Sof foyda: {sofFoyda}", { sofFoyda: fmtSum(sofFoyda) }), tone: sofFoyda < 0 ? "rose" : "emerald" }
          }
          hint={
            cashflowNoma
              ? "bu filialga kassa biriktirilmagan"
              : t("xarajat {xarajat} · qolgan oylik {qolgan}", { xarajat: fmtNum(cashflow?.xarajat ?? 0), qolgan: fmtNum(stats.qolgan) })
          }
          title={
            cashflowNoma
              ? "Tushum va xarajat kassa orqali filialga bog'lanadi. Bu filialda bitta ham kassa yo'q, shuning uchun son hisoblanmadi."
              : cashflow
                ? t("Sof foyda = tushum {daromad} − xarajat {xarajat}", { daromad: fmtSum(cashflow.daromad), xarajat: fmtSum(cashflow.xarajat) }) +
                  t(" − qolgan to'lanadigan oylik {qolgan}.", { qolgan: fmtSum(stats.qolgan) }) +
                  ` Xarajat ichida allaqachon berilgan avans va chiqarilgan oylik ham bor.` +
                  ` Kassalararo ko'chirmalar va bekor qilingan yozuvlar hisobga olinmaydi.`
                : undefined
          }
          loading={loading || cashflow === null}
        />
        <StatCard
          tone="cyan"
          label={t("Hisoblangan oylik ({calcSuffix})", { calcSuffix })}
          value={t(fmtSum(stats.hisoblangan))}
          hint={t("{employees} ta xodim · {periodHint}", { employees: employees.length, periodHint })}
          loading={loading}
        />
        {/* Ikkalasi KASSA bo'yicha: shu filial kassalaridan chiqqan pul,
            kimga berilganidan qat'i nazar (`givenCard` izohiga qarang). */}
        <StatCard
          tone="amber"
          label={t("Berilgan avans")}
          value={avansCard.value}
          hint={avansCard.hint}
          title={avansCard.title}
          loading={loading}
        />
        <StatCard
          tone="blue"
          label={t("To'langan oylik")}
          value={oylikCard.value}
          hint={oylikCard.hint}
          title={oylikCard.title}
          loading={loading}
        />
        {/* Kassadan CHIQADIGAN jami. Plastik bor bo'lsa izohda ikki oyoq
            turadi — karta birinchi, naqd undan keyingi qoldiq, ya'ni
            jadvaldagi "Qolgan" ustunining yig'indisi aynan NAQD qismi.
            O'tgan oy tafsiloti sichqoncha ostida. */}
        <StatCard
          tone="rose"
          label={t("Qolgan to'lanadigan")}
          value={t(fmtSum(stats.qolgan))}
          hint={
            anyPlastik
              ? t("kartaga {kartaga} · naqd {naqd}", { kartaga: fmtNum(stats.kartaga), naqd: fmtNum(stats.naqd) })
                + (stats.qarzdorlik > 0 ? t(" · xodim qarzi: {qarzdorlik}", { qarzdorlik: fmtNum(stats.qarzdorlik) }) : "")
              : stats.qarzdorlik > 0
                ? t("o'tgan oydan: {otganOydan} · xodim qarzi: {qarzdorlik}", { otganOydan: fmtSum(stats.otganOydan), qarzdorlik: fmtSum(stats.qarzdorlik) })
                : t("shu jumladan o'tgan oydan: {otganOydan}", { otganOydan: fmtSum(stats.otganOydan) })
          }
          title={
            anyPlastik
              ? t("Kartaga {kartaga} — qoldiqdan birinchi, plastik summasigacha.", { kartaga: fmtSum(stats.kartaga) }) +
                t(" Naqd {naqd} — kartadan keyin xodimlarga qo'lga beriladigani (jadvaldagi \"Qolgan\" ustuni).", { naqd: fmtSum(stats.naqd) }) +
                t(" Shu jumladan o'tgan oydan: {otganOydan}.", { otganOydan: fmtSum(stats.otganOydan) })
              : undefined
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
            placeholder={t("Ism yoki telefon raqami…")}
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-card text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <Select value={turiFilter} onChange={(v) => setTuriFilter(v)} options={[{ value: "all", label: t("Barcha xodimlar") }, ...turiOptions.map((tv) => ({ value: tv, label: turiLabel(tv) }))]} className="min-w-[180px]" />
        <Select value={hisoblash} onChange={(v) => setHisoblash(v as HisoblashFilter)} options={[{ value: "all", label: t("Hisoblash: barchasi") }, { value: "foiz", label: t("Hisoblash: foizli") }, { value: "fixed", label: t("Hisoblash: okladli") }, { value: "mixed", label: t("Hisoblash: oklad + foiz") }]} className="min-w-[200px]" />
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
            <span className="font-medium">{t("Hammasini tanlash")}</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground tabular-nums">{selectedCount} ta tanlangan</span>
          </label>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-primary/10 text-primary text-xs">
            <span className="font-medium">{t("Umumiy soni:")}</span>
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
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("To'liq ismi")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Turi")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{`Hisob-kitob (${calcSuffix})`}</th>
                {/* Asosiy hisob zanjiri yonma-yon: hisoblangan → soliq →
                    olinganlar → qolgan. Bonus va jarima kamdan-kam
                    to'ldiriladi, shuning uchun ular OXIRGA surildi. */}
                <th className="text-right px-3 py-3 whitespace-nowrap">{t("Hisoblangan")}</th>
                {/* HISOBLANGAN → KARTAGA → SOLIQ → … → QOLGAN tartibi
                    ataylab: hisoblangandan avval karta (BIRINCHI), keyin
                    ushlanmalar, eng oxirida qo'lga tegadigan naqd. Qator
                    o'ngga qarab o'qilganda pulning yo'li ko'rinadi. Alohida
                    "Naqd" ustuni YO'Q: kartadan keyingi naqd aynan "Qolgan"
                    ustunining o'zi — ikkita bir xil raqam turardi. Karta
                    ustuni faqat kimdadir plastik oyligi bo'lsa chiziladi. */}
                {anyPlastik && (
                  <th
                    className="text-right px-3 py-3 whitespace-nowrap"
                    title={t("Kartaga birinchi ketadi — plastik summasigacha; hisoblangan yetmasa shu oydagi qoldiqning o'zi")}
                  >
                    {t("Kartaga")}
                  </th>
                )}
                <th className="text-right px-3 py-3 whitespace-nowrap">{t("Soliq")}</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">{t("Avans olingan")}</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">{t("To'langan oylik")}</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">{t("O'tgan oydan")}</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">{t("Bonus")}</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">{t("Jarima")}</th>
                {/* QOLGAN — qatorning ENG OXIRIDA, yakuniy raqam sifatida:
                    hisoblangan − soliq (+ o'tgan oydan − allaqachon
                    to'langani) − kartaga. Ya'ni kartadan KEYIN xodimga
                    qo'lga beriladigan naqd; karta qoplanmasa 0. */}
                <th
                  className="text-right px-3 py-3 whitespace-nowrap"
                  title={t("Kartadan keyin xodimga qo'lga beriladigan naqd. Hisoblangan kartani qoplamasa 0.")}
                >
                  {t("Qolgan")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => {
                const base = payrollBase(e, period);
                const earned = payrollEarned(e, period);
                const paid = payrollPaid(e);
                // Karta oyog'i, uning mo'ljali va kartadan KEYINGI qoldiq
                // (ishorali). Plastigi yo'q xodimda `cashDue` — oddiy
                // `payrollDue`. `plastikShort` — karta shu oyda qancha
                // to'lmay qolgani (qoldiq mo'ljaldan kichik).
                const plastik = payrollPlastikLeg(e, period);
                const plastikShort = payrollPlastikTarget(e) - plastik;
                const cashDue = payrollCashDue(e, period);
                const tax = payrollTax(e, period);
                // Sichqoncha ostida qaysi soliqlardan yig'ilgani ko'rinsin.
                const taxTitle = payrollTaxLines(e, period)
                  .map((l) => `${l.name} (${l.detail}): ${fmtNum(l.amount)}`)
                  .join("\n");
                const isFoiz = e.salaryType === "foiz";
                const isMixed = e.salaryType === "mixed";
                const badgeCls = isMixed
                  ? "bg-violet-500/10 text-violet-600 border-violet-500/20"
                  : isFoiz
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : "bg-sky-500/10 text-sky-600 border-sky-500/20";
                const badgeLabel = isMixed
                  ? t("Oklad + {percent}%", { percent: e.percent })
                  : isFoiz ? t("Foiz {percent}%", { percent: e.percent }) : "Oklad";
                // Foizli asos SOF tushum: o'quvchilarga qaytarilgan pul
                // ayrilgan (lib/payrollSources.ts). Qaytarim bo'lsa formula
                // uni ochiq ko'rsatadi — "tushum nega kam" degan savol
                // tug'ilmasin.
                // Boshqa filial kassasidan olingan qism — faqat KO'RSATISH
                // uchun: "Qolgan" baribir hamma olinganni ayiradi. Kartochka
                // kassa bo'yicha, qator xodim bo'yicha — farqi shu izohda.
                const elsewhere = e.paidElsewhere ?? [];
                const avansElsewhere = elsewhere.reduce((s, x) => s + x.avans, 0);
                const oylikElsewhere = elsewhere.reduce((s, x) => s + x.oylik, 0);
                const elsewhereTitle = (kind: "avans" | "oylik") => elsewhere
                  .filter((x) => x[kind] > 0)
                  .map((x) => t("{branch} kassasidan: {amount}", { branch: x.branch || t("filialga biriktirilmagan kassa"), amount: fmtNum(x[kind]) }))
                  .join("\n");
                const collectedFormula = (e.refunded ?? 0) > 0
                  ? t("({refunded} − qaytarim {refunded2})", { refunded: fmtNum(e.collected + e.refunded), refunded2: fmtNum(e.refunded) })
                  : fmtNum(e.collected);
                // OKLAD qismi ishga kirgan kundan sanaladi (lib/salary.ts →
                // payrollOkladDays): 23-sentabrda kirgan xodimda "× 8/30 kun".
                // "Oklad + foiz" xodimda ikki qator: oklad, ostida foiz.
                const hasOklad = payrollHasOklad(e);
                const okladFormula = t("{fixedSalary} × {day}/{daysIn} kun = {base}", {
                  fixedSalary: fmtNum(e.fixedSalary),
                  day: payrollOkladDays(e, period),
                  daysIn: period.daysIn,
                  base: fmtNum(isMixed ? payrollOkladPart(e, period) : base),
                });
                const formula = isMixed
                  ? okladFormula
                  : isFoiz
                    ? `${collectedFormula} × ${e.percent}% = ${fmtNum(base)}`
                    : okladFormula;
                const foizLine = isMixed ? `+ ${collectedFormula} × ${e.percent}% = ${fmtNum(payrollFoizPart(e))}` : "";
                // Ishga kirgan sana SHU (yoki keyingi) oyda bo'lsa — izoh.
                const startNote = hasOklad && e.salaryStart && payrollStartsInPeriod(e, period)
                  ? t("ishga kirgan sana: {date}", { date: fmtIsoDay(e.salaryStart) })
                  : "";
                // ESLATMA: shu oyda (yoki keyin) CRM'ga qo'shilgan okladli
                // xodimda ishga kirgan sana kiritilmagan — unga to'liq oy
                // yozilyapti. Tuzatish xodim profilidagi "Ish haqi" oynasida.
                // `created` AVTOMATIK sana qilib olinmaydi: qayta yaratilgan
                // xodimlar (Nilufar 02.09, Dilmurod 03.09) oldindan ishlaydi.
                // Oyning 1-kunida qo'shilgan xodimga baribir to'liq oy — izohsiz.
                const createdMonth = (e.createdDate ?? "").slice(0, 7);
                const startMissing = hasOklad && !e.salaryStart && !!createdMonth
                  && createdMonth >= monthKey
                  && !(createdMonth === monthKey && (e.createdDate ?? "").endsWith("-01"));
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
                        title={e.configured ? undefined : t("Ish haqi sozlanmagan — oylik chiqarib bo'lmaydi")}
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
                          {badgeLabel}
                        </span>
                      ) : (
                        <span className="inline-flex items-center h-6 px-2 rounded-md border text-[11px] font-medium bg-amber-500/10 text-amber-700 border-amber-500/20 whitespace-nowrap">
                          {t("Sozlanmagan")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-[12.5px] tabular-nums">
                      {e.configured ? (
                        <>
                          <div className="whitespace-nowrap">{formula}</div>
                          {foizLine && <div className="whitespace-nowrap">{foizLine}</div>}
                          {startNote && (
                            <div className="text-[11px] text-muted-foreground whitespace-nowrap">{startNote}</div>
                          )}
                          {startMissing && (
                            <Link
                              href={`/management-xodimlar/${e.id}`}
                              className="block text-[11px] text-amber-600 hover:underline whitespace-nowrap"
                              title={t("Ishga kirgan sana kiritilmasa oklad oy boshidan — to'liq oy uchun hisoblanadi")}
                            >
                              {t("{date} da qo'shilgan — ishga kirgan sanani kiriting", { date: fmtIsoDay(e.createdDate ?? "") })}
                            </Link>
                          )}
                        </>
                      ) : (
                        <Link href={`/management-xodimlar/${e.id}`} className="text-[12px] text-primary hover:underline">
                          {t("Ish haqi kiritilmagan — sozlash")}
                        </Link>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-right text-[13px] tabular-nums font-semibold whitespace-nowrap">
                      {e.configured ? fmtNum(earned) : <span className="text-muted-foreground">—</span>}
                    </td>
                    {/* KARTAGA — shu chiqarishda kartaga o'tadigan summa:
                        to'lanadigan qoldiqdan BIRINCHI, plastik summasigacha
                        (shu oyda kartadan berilgani ayrilib). Qoldiq
                        yetmasa qoldiqning o'zi turadi — ostida yetmagani. */}
                    {anyPlastik && (
                      <td className="px-3 py-3 align-top text-right text-[13px] tabular-nums whitespace-nowrap">
                        {e.plastikSalary > 0 ? (
                          <div
                            title={
                              t("Plastik oylik {plastikSalary}", { plastikSalary: fmtNum(e.plastikSalary) }) +
                              (e.paidPlastik > 0 ? t(" − shu oyda kartadan berilgan {paidPlastik}", { paidPlastik: fmtNum(e.paidPlastik) }) : "") +
                              (plastikShort > 0 ? t(" — hisoblangan yetmagani uchun {plastik} chiqadi", { plastik: fmtNum(plastik) }) : "")
                            }
                          >
                            <div className="font-medium text-sky-600">{fmtNum(plastik)}</div>
                            {plastikShort > 0 && (
                              <div className="text-[11px] text-muted-foreground">{`${fmtNum(plastikShort)} yetmadi`}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    )}
                    {/* Soliq — faqat kartasida yoqilgan xodimda hisoblanadi
                        (Boshqaruv → Xodimlar). O'chiq bo'lsa "—", ya'ni
                        "0 so'm soliq" bilan "soliq solinmaydi" farqlanadi. */}
                    <td className="px-3 py-3 align-top text-right text-[13px] tabular-nums whitespace-nowrap">
                      {!e.taxable ? (
                        <span className="text-muted-foreground" title={t("Bu xodimga soliq solinmaydi")}>—</span>
                      ) : tax > 0 ? (
                        <span className="text-rose-600 font-medium" title={taxTitle}>−{fmtNum(tax)}</span>
                      ) : (
                        <span className="text-muted-foreground" title={t("Soliq ro'yxati bo'sh yoki hisoblangan oylik 0")}>0</span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-right text-[13px] tabular-nums whitespace-nowrap">
                      {e.paidAvans > 0 ? <span className="text-amber-600 font-medium">{fmtNum(e.paidAvans)}</span> : <span className="text-muted-foreground">0</span>}
                      {avansElsewhere > 0 && (
                        <div className="text-[11px] text-muted-foreground" title={elsewhereTitle("avans")}>
                          {avansElsewhere >= e.paidAvans
                            ? t("boshqa filial kassasidan")
                            : t("shundan {amount} boshqa filialdan", { amount: fmtNum(avansElsewhere) })}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-right text-[13px] tabular-nums whitespace-nowrap">
                      {paid > e.paidAvans ? fmtNum(paid - e.paidAvans) : <span className="text-muted-foreground">0</span>}
                      {oylikElsewhere > 0 && (
                        <div className="text-[11px] text-muted-foreground" title={elsewhereTitle("oylik")}>
                          {oylikElsewhere >= e.paidOylik
                            ? t("boshqa filial kassasidan")
                            : t("shundan {amount} boshqa filialdan", { amount: fmtNum(oylikElsewhere) })}
                        </div>
                      )}
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
                    {/* QOLGAN — yakuniy raqam, qatorning eng oxirida:
                        kartadan keyin qo'lga beriladigan naqd. Qoldiq
                        kartani qoplamasa 0 (yetmagani "Kartaga" ostida
                        yozilgan, bu qarz EMAS va keyingi oyga o'tmaydi).
                        Manfiy faqat xodim ishlaganidan ko'p olganda —
                        avvalgidek "qarzdor". */}
                    <td className="px-3 py-3 align-top text-right text-[13px] tabular-nums font-bold whitespace-nowrap">
                      {!e.configured ? (
                        <span className="text-muted-foreground font-normal">—</span>
                      ) : cashDue >= 0 ? (
                        <span title={plastik > 0 ? t("Qoldiq {plastik} − kartaga {plastik2}", { plastik: fmtNum(Math.max(cashDue + plastik, 0)), plastik2: fmtNum(plastik) }) : undefined}>
                          {fmtNum(cashDue)}
                        </span>
                      ) : (
                        <div>
                          <div className="text-amber-600">{fmtNum(cashDue)}</div>
                          <div className="text-[11px] font-normal text-muted-foreground">{t("qarzdor")}</div>
                        </div>
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
        <Modal onClose={() => setConfirmOpen(false)} locked={saving} bare zIndex={110} panelClassName="p-6">{(modal) => (<>
            {/* QAYSI OY — tasdiqlash oynasida ko'rinishi SHART: o'tgan oy
                tanlangan holda tugma bosilsa, pul boshqa oyning hisobiga
                chiqadi va buni keyin faqat chiqarishni o'chirib qaytarish
                mumkin. */}
            <p className="text-center text-[15px] font-semibold">
              {t("{monthLabel} — {selectedCount} ta xodim uchun oylik chiqariladi", { monthLabel, selectedCount })}
            </p>
            <p className="text-center text-[12.5px] text-muted-foreground mt-1">
              {t("Pul tanlangan kassadan chiqadi va Tranzaksiyalar jurnaliga yoziladi.")}
            </p>
            {isPastMonth && (
              // Jurnaldagi sana o'sha oyning oxirgi kuni bo'ladi — aks holda
              // "to'langan oylik" o'tgan oyga bog'lanmasdi va bir summa ikki
              // marta chiqarilishi mumkin edi (app/api/salary-runs/route.ts).
              <p className="text-center text-[12.5px] text-amber-600 dark:text-amber-500 mt-1">
                {t("Chiqim yozuvi {monthLabel} oyining oxirgi kuni bilan qayd etiladi.", { monthLabel })}
              </p>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-[12px] font-medium mb-1">{t("Kassa")}</label>
                <Select value={cashboxId} onChange={(v) => setCashboxId(v)} options={[...((cashboxesLoading || cashboxes.length === 0) ? [{ value: "", label: selectPlaceholder(cashboxesLoading, cashboxes.length, "Kassa topilmadi") }] : []), ...cashboxes.map((c) => ({ value: String(c.id), label: `${c.name} ${c.isPrimary ? " — bosh kassa" : ""}` }))]} disabled={saving || cashboxesLoading} />
              </div>

              <div>
                <label className="block text-[12px] font-medium mb-1">
                  {plastikTotal > 0 ? t("Naqd qismi uchun to'lov turi") : t("To'lov turi")}
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
                  placeholder={paymentMethods.length === 0 ? t("To'lov turi topilmadi") : t("Tanlang")}
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
                  <label className="block text-[12px] font-medium mb-1">{t("Plastik qismi uchun to'lov turi")}</label>
                  <Select
                    value={plastikMethodKey}
                    onChange={setPlastikMethod}
                    disabled={saving}
                    loading={methodsLoading}
                    placeholder={paymentMethods.length === 0 ? t("To'lov turi topilmadi") : t("Tanlang")}
                    options={paymentMethods.map((m) => ({
                      value: m.key,
                      label: m.name,
                      hint: fmtSum(Number(activeCashbox?.methodTotals?.[m.key]) || 0),
                    }))}
                  />
                </div>
              )}

              {/* TARTIB: avval kanallar, oxirida yig'indi — jadvaldagi
                  "Kartaga" va "Qolgan" (= naqd) ustunlari bilan bir xil
                  o'qiladi. Har kanal yonida SHU KASSADAGI qoldiq turadi,
                  ya'ni pul yetmasligi tugma bosilishidan OLDIN ko'rinadi. */}
              <div className="rounded-lg border border-border bg-secondary/20 p-3 text-[13px] space-y-1">
                {plastikTotal > 0 ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t("Kartaga")}</span>
                      <span className={`tabular-nums ${plastikTotal > plastikAvailable ? "text-rose-600 font-semibold" : ""}`}>
                        {t(fmtSum(plastikTotal))} <span className="text-muted-foreground">/ {t(fmtSum(plastikAvailable))}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t("Naqd")}</span>
                      <span className={`tabular-nums ${naqdTotal > available ? "text-rose-600 font-semibold" : ""}`}>
                        {t(fmtSum(naqdTotal))} <span className="text-muted-foreground">/ {t(fmtSum(available))}</span>
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("Kassada mavjud")}</span>
                    <span className={`tabular-nums ${notEnough ? "text-rose-600 font-semibold" : ""}`}>{t(fmtSum(available))}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border pt-1 mt-1">
                  <span className="text-muted-foreground">{t("Chiqariladigan summa")}</span>
                  <span className="font-semibold tabular-nums">{t(fmtSum(payoutTotal))}</span>
                </div>
              </div>

              {sameMethod && (
                <p className="text-[12.5px] text-rose-600">
                  {t("Plastik va naqd uchun bir xil to'lov turi tanlangan — birini o'zgartiring, aks holda jurnalda ikki qism ajralmay qoladi.")}
                </p>
              )}

              {payoutTotal === 0 && (
                <p className="text-[12.5px] text-amber-600">
                  {t("Tanlangan xodimlarda to'lanadigan qoldiq yo'q — oylik allaqachon chiqarilgan yoki qarzdorlik bor.")}
                </p>
              )}
              {/* Butun jumla bitta ifodada — JSX ifoda bilan undan keyingi
                  matn orasidagi bo'shliqni yeb qo'yadi (so'mkam bo'lib
                  chiqardi). */}
              {notEnough && (
                <p className="text-[12.5px] text-rose-600">
                  {t("Mablag' yetarli emas — {available} kam. Boshqa kassa yoki to'lov turini tanlang.", { available: fmtSum(shortfall) })}
                </p>
              )}
              {/* Tugma o'chiq bo'lishining QOLGAN sabablari ham ochiq
                  aytiladi — "Ha, chiqarish" hech qachon izohsiz kulrang
                  turmasin. */}
              {!cashboxesLoading && !cashboxId && (
                <p className="text-[12.5px] text-rose-600">{t("Kassani tanlang")}</p>
              )}
              {!methodsLoading && !methodKey && (
                <p className="text-[12.5px] text-rose-600">{t("To'lov turini tanlang")}</p>
              )}
              {needsPlastikMethod && (
                <p className="text-[12.5px] text-rose-600">{t("Plastik qismi uchun to'lov turini tanlang")}</p>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                onClick={modal.close}
                disabled={saving}
                className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
              >
                {t("Bekor qilish")}
              </button>
              <button
                onClick={confirmPayout}
                disabled={saving || !canPayout}
                className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? t("Chiqarilmoqda…") : t("Ha, chiqarish")}
              </button>
            </div>
          </>)}</Modal>
      )}
    </div>
  );
}
