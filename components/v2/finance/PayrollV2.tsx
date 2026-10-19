"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowLeftRight, ArrowRight, Check, ChevronDown, CreditCard, History, Info, RefreshCw, Search, Users, Wallet } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import TeacherHandoverModal from "@/components/finance/TeacherHandoverModal";
import { payrollTuriLabel, usePayroll, type HisoblashFilter } from "@/components/finance/usePayroll";
import ActionMenu from "@/components/v2/ui/ActionMenu";
import ColumnsControl from "@/components/v2/ui/ColumnsControl";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import V2MonthNav from "@/components/v2/ui/V2MonthNav";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { DENSITY_CELL, DENSITY_ROW } from "@/components/v2/ui/columnPrefs";
import { ROW_TINT } from "@/components/v2/ui/table";
import { buildingNo } from "@/lib/branchPools";
import {
  payrollBase,
  payrollDebt,
  payrollDue,
  payrollEarned,
  payrollEndsInPeriod,
  payrollFoizPart,
  payrollHasOklad,
  payrollOkladDays,
  payrollOkladPart,
  payrollPayout,
  payrollPlastikLeg,
  payrollPlastikTarget,
  payrollStartsInPeriod,
  payrollTax,
  payrollTaxLines,
  pendingMaybePaidByMonth,
  type EmployeePayroll,
} from "@/lib/salary";
import { isFutureIsoDay } from "@/lib/uzTime";
import PayoutModalV2 from "./PayoutModalV2";
import { usePayrollColumns, type PayrollColumn, type PayrollColumnKey } from "./payrollColumns";

// YANGI VERSIYA — MOLIYA → OYLIK CHIQARISH (rasmlar «Oylik chiqarish» va
// «Oylikni chiqarish oynasi», yorug'/qorong'i, 19.10.2026):
//
//   1. sarlavha: «Oylik chiqarish» + «filial · 1–12-oktabr hisobi (12/31 kun)»;
//      o'ngda oy tanlagich (‹ Oktabr 2026 ›), «Chiqarishlar tarixi»,
//      «Qayta hisoblash»;
//   2. bitta kartochkada 6 katak: Jami tushum · Sof foyda · Jami oylik · Jami
//      avans · Soliq · Qolgan oylik (oxirgisi brend fonda, ostida karta/naqd);
//   3. filtr: «Xodim ismi yoki telefoni», Xodim turi, Hisoblash usuli; o'ngda
//      «Ustunlar» (umumiy oyna, components/v2/ui/ColumnsControl.tsx);
//   4. jadval kartasining tepasida tanlov qatori — «N ta xodim tanlandi ·
//      Chiqariladigan summa …», «Bekor qilish», «Oylikni chiqarish» (oyna —
//      ./PayoutModalV2.tsx); pastda «Jami · N xodim» qatori;
//   5. jadval ostida izoh.
//
// Ma'lumot, filtr, tanlov, raqamlar va chiqarish so'rovi — eski sahifa bilan
// BITTA manbadan (components/finance/usePayroll.ts → lib/salary.ts): ikkala
// versiyada summa bir xil. Rasmdan farqlar (soliq va karta qoidasi tizimdagidek,
// «Faqat kartani chiqarish» saqlangan va h.k.) — design/v2/SAVOLLAR.md 61–70.

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("ru-RU").replace(/,/g, " ");
}
/** Manfiy son — haqiqiy minus belgisi bilan («−69 677»). */
function signed(n: number): string {
  return n < 0 ? `−${fmtNum(-n)}` : fmtNum(n);
}
/** "2026-09-23" → "23.09.2026". */
function fmtIsoDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

const HISOBLASH_OPTIONS: { value: Exclude<HisoblashFilter, "all">; label: string }[] = [
  { value: "fixed", label: "Okladli" },
  { value: "foiz", label: "Foizli" },
  { value: "mixed", label: "Oklad + foiz" },
];

/** Ustun sarlavhasi qalin bo'ladiganlar (rasmdagidek — asosiy pul ustunlari). */
const STRONG_HEAD = new Set<PayrollColumnKey>(["earned", "avans", "due"]);

const disabledPrimary = "disabled:cursor-not-allowed disabled:bg-v2-surface-2 disabled:text-v2-text-3 disabled:hover:brightness-100";
const tagCls = "inline-flex items-center whitespace-nowrap rounded-v2-sm border border-v2-border bg-v2-surface-2 px-1.5 py-px text-v2-caption text-v2-text-2";

export default function PayrollV2() {
  const { t, months } = useT();
  const { showError } = useToast();
  const p = usePayroll();
  const {
    employees, loading, given, cashflow, period, monthKey, currentMonthKey, todayIso,
    isPastMonth, isFutureMonth, isClosedMonth, payoutBlockedReason, monthLabel, pendingMonthLabel, changeMonth,
    navBranchId, allowedBranches, buildings, building, changeBuilding, load,
    query, setQuery, turiFilter, setTuriFilter, hisoblash, setHisoblash, filtered, turiOptions,
    selected, setSelected, selectable, toggleAll, toggleOne,
    stats, sofFoyda, cashflowNoma, anyPlastik,
    payoutTotal, plastikTotal, naqdTotal, kartaRows,
  } = p;
  const columns = usePayrollColumns();
  const [modal, setModal] = useState<null | "all" | "karta">(null);
  // Ustoz almashuvi oynasi (eski) — qaysi o'qituvchi uchun ochiq.
  const [handoverFor, setHandoverFor] = useState<string | null>(null);
  // Jadval yonga surilganmi — qotgan «Xodim» ustunining o'ng chizig'i faqat shunda (rasmda
  // ichki tik chiziq yo'q; surilganda ism ustidan o'tayotgan raqamlar ajralib tursin).
  const [scrolledX, setScrolledX] = useState(false);

  const branchName = allowedBranches.find((b) => b.id === (building ?? navBranchId))?.name ?? "";
  const monthLower = (months[period.month] ?? "").toLowerCase();
  const periodText = isFutureMonth
    ? t("{month} — oldindan tushgan pul", { month: monthLabel })
    : t("1–{day}-{month} hisobi ({day}/{daysIn} kun)", { day: period.day, month: monthLower, daysIn: period.daysIn });
  const status: { cls: string; text: string } | null = isClosedMonth
    ? { cls: "bg-v2-danger-bg text-v2-danger", text: t("Yopilgan oy — oylik chiqarilmaydi") }
    : isFutureMonth
      ? { cls: "bg-v2-info-bg text-v2-info", text: t("Kelajak oy — oylik chiqarilmaydi") }
      : isPastMonth
        ? { cls: "bg-v2-warning-bg text-v2-warning", text: t("Tugagan oy — to'liq hisoblanadi") }
        : null;
  const calcSuffix = t(isPastMonth ? "to'liq oy" : isFutureMonth ? "oldindan" : "shu kungacha");

  // Soliq stavkasi sarlavhada («Soliq · 12%») — faqat soliqli hamma xodimda
  // BITTA foizli qoida bo'lsa; aks holda shunchaki «Soliq» (har xil qoidalar).
  const taxRate = useMemo(() => {
    let rate: number | null = null;
    for (const e of employees) {
      if (!e.configured || !e.taxable) continue;
      if (e.taxRules.length !== 1 || e.taxRules[0].type !== "percent") return null;
      const v = e.taxRules[0].value;
      if (rate === null) rate = v;
      else if (rate !== v) return null;
    }
    return rate;
  }, [employees]);
  const anyTaxable = useMemo(() => employees.some((e) => e.configured && e.taxable), [employees]);
  const taxLabel = taxRate !== null ? `${t("Soliq")} · ${taxRate}%` : t("Soliq");

  // «To'langan» va «O'tgan oydan» — qiymati bo'lganda o'zi chiqadi; «Kartaga» —
  // ro'yxatda kartali xodim bo'lsa (eski sahifadek).
  const showPaid = useMemo(() => employees.some((e) => e.paidOylik !== 0), [employees]);
  const showCarry = useMemo(() => employees.some((e) => e.carryOver !== 0 || (e.carryPendingMonths?.length ?? 0) > 0), [employees]);
  const visibleCols = columns.shown.filter(
    (c) => (c.key !== "paid" || showPaid) && (c.key !== "carry" || showCarry) && (c.key !== "karta" || anyPlastik),
  );
  const colCount = visibleCols.length + 3;
  const rowH = DENSITY_ROW[columns.density];
  const cellY = DENSITY_CELL[columns.density];

  // «Jami · N xodim» — RO'YXATDAGI (filtrlangan) qatorlar bo'yicha. Hisoblangan
  // raqamlar faqat sozlanganlardan; avans/oylik/bonus/jarima — fakt, hammadan.
  const totals = useMemo(() => {
    let earned = 0, avans = 0, paid = 0, carry = 0, bonus = 0, jarima = 0, tax = 0, karta = 0, payout = 0, debt = 0;
    for (const e of filtered) {
      avans += e.paidAvans;
      paid += e.paidOylik;
      bonus += e.bonus;
      jarima += e.jarima;
      if (!e.configured) continue;
      earned += payrollEarned(e, period);
      carry += e.carryOver;
      tax += payrollTax(e, period);
      karta += payrollPlastikLeg(e, period);
      payout += payrollPayout(e, period);
      debt += payrollDebt(e, period);
    }
    return { earned, avans, paid, carry, bonus, jarima, tax, karta, payout, debt };
  }, [filtered, period]);

  // Sarlavhadagi katakcha — RO'YXATDAGI sozlanganlar bo'yicha.
  const selInView = selectable.filter((e) => selected.has(e.id)).length;
  const allInView = selectable.length > 0 && selInView === selectable.length;

  const anyFilter = query.trim() !== "" || turiFilter !== "all" || hisoblash !== "all";
  const clearFilters = () => {
    setQuery("");
    setTuriFilter("all");
    setHisoblash("all");
  };

  /** «Oylikni chiqarish» — tanlanmagan bo'lsa nima qilish kerakligi aytiladi (eski sahifadek). */
  function openAll() {
    if (selected.size === 0) {
      showError(t("Avval jadvaldan xodimlarni belgilang — chap tomondagi katakchalar"));
      return;
    }
    setModal("all");
  }
  function openKarta() {
    if (kartaRows.length === 0) {
      showError(selected.size > 0
        ? t("Tanlangan xodimlarda kartaga chiqariladigan summa yo'q")
        : t("Kartaga chiqariladigan summa yo'q — shu oy kartalari to'langan"));
      return;
    }
    setModal("karta");
  }

  /* ---- Ko'rsatkichlar ---- */

  /** Kassa bo'yicha avans/oylik izohi — eski sahifadagi `givenCard` bilan bir xil manba. */
  function givenTitle(kind: "avans" | "oylik"): string {
    if (!given?.hasCashbox) return "";
    const toOthers = given.toOthers.filter((o) => o[kind] > 0);
    const toOthersSum = toOthers.reduce((s, o) => s + o[kind], 0);
    const fromOthers = given.fromOthers[kind];
    const lines = [
      kind === "avans"
        ? t("Shu filial kassalaridan berilgan avans: {amount}", { amount: `${fmtNum(given.avans)} ${t("so'm")}` })
        : t("Shu filial kassalaridan chiqarilgan oylik: {amount}", { amount: `${fmtNum(given.oylik)} ${t("so'm")}` }),
    ];
    if (toOthersSum > 0) {
      lines.push(t("Shundan boshqa filial xodimlariga — {amount}:", { amount: `${fmtNum(toOthersSum)} ${t("so'm")}` }));
      for (const o of toOthers) {
        const where = o.archived ? t("arxivda") : o.branch || t("xodimlar ro'yxatida yo'q");
        lines.push(`  ${o.name || t("ism ko'rsatilmagan")} (${where}): ${fmtNum(o[kind])}`);
      }
    }
    if (fromOthers > 0) {
      lines.push(t("Bu filial xodimlari boshqa filial kassalaridan olgan: {amount} — u o'sha filialda ko'rinadi, xodimning qolgan oyligidan esa baribir ushlab qolinadi.", { amount: `${fmtNum(fromOthers)} ${t("so'm")}` }));
    }
    return lines.join("\n");
  }
  // Katak izohi QISQA (bitta qator): kassa bo'yicha farqlar (boshqa filial
  // xodimlariga / boshqa filialdan olgan) — sichqoncha ostida (`givenTitle`).
  const avansHint: string = !given
    ? ""
    : !given.hasCashbox
      ? t("bu filialga kassa biriktirilmagan")
      : given.oylik > 0 ? t("oylik to'langan {amount}", { amount: fmtNum(given.oylik) }) : "";

  const qolganHint = anyPlastik
    ? t("kartaga {kartaga} · naqd {naqd}", { kartaga: fmtNum(stats.kartaga), naqd: fmtNum(stats.naqd) })
    : stats.otganOydan !== 0
      ? t("shu jumladan o'tgan oydan: {otganOydan}", { otganOydan: fmtNum(stats.otganOydan) })
      : t("faqat shu oy hisobidan");

  const sofTitle = cashflow && !cashflowNoma
    ? t("Sof foyda = tushum {daromad} − xarajat {xarajat}", { daromad: `${fmtNum(cashflow.daromad)} ${t("so'm")}`, xarajat: `${fmtNum(cashflow.xarajat)} ${t("so'm")}` })
      + t(" − qolgan to'lanadigan oylik {qolgan}.", { qolgan: `${fmtNum(stats.qolgan)} ${t("so'm")}` })
      + " " + t("Xarajat ichida allaqachon berilgan avans va chiqarilgan oylik ham bor.")
      + " " + t("Kassalararo ko'chirmalar va bekor qilingan yozuvlar hisobga olinmaydi.")
    : undefined;
  const noCashboxTitle = t("Tushum va xarajat kassa orqali filialga bog'lanadi. Bu filialda bitta ham kassa yo'q, shuning uchun son hisoblanmadi.");

  const cashLoading = loading || cashflow === null;
  const stat = (value: number | null, tone?: "danger" | "success", busy = loading) => {
    if (busy) return <span className="inline-block h-5 w-24 rounded bg-v2-skeleton align-middle" aria-hidden />;
    if (value === null) return <span className="text-[17px] font-semibold text-v2-text-3">—</span>;
    const cls = tone === "danger" ? "text-v2-danger" : tone === "success" ? "text-v2-success" : "text-v2-text";
    return (
      <>
        <span className={`text-[17px] font-semibold tabular-nums ${cls}`}>{signed(value)}</span>{" "}
        <span className={`text-v2-small ${tone ? cls : "text-v2-text-2"}`}>{t("so'm")}</span>
      </>
    );
  };

  const statCells: { key: string; label: ReactNode; value: ReactNode; hint?: ReactNode; title?: string; highlight?: boolean }[] = [
    {
      key: "tushum",
      label: t("Jami tushum"),
      value: stat(cashflowNoma ? null : (cashflow?.daromad ?? 0), undefined, cashLoading),
      hint: cashflowNoma ? t("bu filialga kassa biriktirilmagan") : undefined,
      title: cashflowNoma ? noCashboxTitle : undefined,
    },
    {
      key: "sof",
      label: t("Sof foyda"),
      value: stat(cashflowNoma ? null : sofFoyda, sofFoyda < 0 ? "danger" : sofFoyda > 0 ? "success" : undefined, cashLoading),
      title: cashflowNoma ? noCashboxTitle : sofTitle,
    },
    {
      key: "oylik",
      label: loading ? t("Jami oylik") : `${t("Jami oylik")} · ${t("{n} xodim", { n: employees.length })}`,
      value: stat(stats.hisoblangan),
      title: t("Hisoblangan oylik ({calcSuffix})", { calcSuffix }),
    },
    {
      key: "avans",
      label: t("Jami avans"),
      value: stat(given === null || !given.hasCashbox ? null : given.avans),
      hint: avansHint || undefined,
      title: [givenTitle("avans"), given && given.oylik > 0 ? givenTitle("oylik") : ""].filter(Boolean).join("\n\n") || undefined,
    },
    {
      key: "soliq",
      label: taxLabel,
      value: stat(stats.soliq),
      hint: loading ? undefined : anyTaxable ? t("oylikdan ushlanadi") : t("hech kimga soliq yoqilmagan"),
    },
    {
      key: "qolgan",
      label: t("Qolgan oylik"),
      value: stat(stats.qolgan),
      highlight: true,
      title: [
        anyPlastik
          ? t("Kartaga {kartaga} — qoldiqdan birinchi, plastik summasigacha; naqd {naqd} — kartadan keyin qo'lga beriladigani.", {
              kartaga: `${fmtNum(stats.kartaga)} ${t("so'm")}`,
              naqd: `${fmtNum(stats.naqd)} ${t("so'm")}`,
            })
          : "",
        stats.otganOydan !== 0 && anyPlastik ? t(" Shu jumladan o'tgan oydan: {otganOydan}.", { otganOydan: `${fmtNum(stats.otganOydan)} ${t("so'm")}` }) : "",
        stats.pending > 0
          ? t(" O'tgan oylarda to'lanmagan {amount} bu summaga kirmaydi — har oyniki o'z oyining sahifasidan chiqariladi: {list}.", {
              amount: `${fmtNum(stats.pending)} ${t("so'm")}`,
              list: stats.pendingMonths.map((pm) => `${pendingMonthLabel(pm.month)} ${fmtNum(pm.amount)}`).join(", "),
            })
          : "",
      ].join("").trim() || undefined,
      hint: loading ? undefined : (
        <>
          <span className="block">{qolganHint}</span>
          {/* Xodimlar qarzi — alohida yig'iladi (bir xodimning qarzi boshqasiga
              to'lanadigan pulni «yemasin»), summaga kirmaydi. */}
          {stats.qarzdorlik > 0 && <span className="block truncate">{t("xodim qarzi: {qarzdorlik}", { qarzdorlik: fmtNum(stats.qarzdorlik) })}</span>}
          {/* O'TGAN OYLARDA TO'LANMAGAN (04.10.2026) — bu summaga KIRMAYDI; oy nomi
              bosilsa oy tanlagichi o'sha oyga o'tadi va pul o'sha sahifadan chiqariladi. */}
          {stats.pending > 0 && (
            <span className="mt-0.5 block text-v2-warning">
              {t("o'tgan oylardan {amount}", { amount: fmtNum(stats.pending) })}
              {stats.pendingMonths.map((pm) => (
                <button
                  key={pm.month}
                  type="button"
                  onClick={() => changeMonth(pm.month)}
                  title={t("{month} oyiga o'tish — to'lanmagan {amount} o'sha sahifadan chiqariladi", { month: pendingMonthLabel(pm.month), amount: `${fmtNum(pm.amount)} ${t("so'm")}` })}
                  className="ml-1.5 inline-flex items-center gap-0.5 font-medium underline underline-offset-2 hover:no-underline"
                >
                  {pendingMonthLabel(pm.month)}
                  <ArrowRight className="size-3" strokeWidth={2} aria-hidden />
                </button>
              ))}
            </span>
          )}
          {stats.maybePaid > 0 && (
            <span className="mt-0.5 block text-v2-danger">
              {t("{amount} ehtimol shu oyda berilgan — o'z oyidan qayta chiqarmang", { amount: fmtNum(stats.maybePaid) })}
            </span>
          )}
        </>
      ),
    },
  ];

  /* ---- Jadval kataklari ---- */

  const dash = <span className="text-v2-text-3">—</span>;
  const zero = <span className="tabular-nums text-v2-text">0</span>;
  const sub = (node: ReactNode, cls = "text-v2-text-3") => <div className={`mt-0.5 whitespace-nowrap text-v2-caption font-normal tabular-nums ${cls}`}>{node}</div>;

  const handoverBtn = (e: EmployeePayroll) => (
    <button
      type="button"
      onClick={() => setHandoverFor(e.name)}
      title={t("Ustoz almashuvi — oy o'rtasida o'quvchilar boshqa ustozga o'tgan bo'lsa")}
      aria-label={t("Ustoz almashuvi")}
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-v2-sm text-v2-text-3 hover:bg-v2-surface-2 hover:text-v2-brand-text"
    >
      <ArrowLeftRight className="size-3.5" strokeWidth={1.75} aria-hidden />
    </button>
  );

  function calcCell(e: EmployeePayroll) {
    if (!e.configured) {
      return (
        <Link href={`/management-xodimlar/${e.id}`} className="whitespace-nowrap text-v2-small text-v2-brand-text underline-offset-2 hover:underline">
          {t("Ish haqi kiritilmagan — sozlash")}
        </Link>
      );
    }
    const isFoiz = e.salaryType === "foiz";
    const isMixed = e.salaryType === "mixed";
    const hasOklad = payrollHasOklad(e);
    const collected = (e.refunded ?? 0) > 0
      ? t("({refunded} − qaytarim {refunded2})", { refunded: fmtNum(e.collected + e.refunded), refunded2: fmtNum(e.refunded) })
      : fmtNum(e.collected);
    const okladLine = t("{fixedSalary} × {day}/{daysIn} kun", { fixedSalary: fmtNum(e.fixedSalary), day: payrollOkladDays(e, period), daysIn: period.daysIn });
    const foizLine = t("{percent}% × {amount} tushum", { percent: e.percent, amount: collected });
    const createdMonth = (e.createdDate ?? "").slice(0, 7);
    // Shu oyda qo'shilgan okladli xodimda ishga kirgan sana yo'q — to'liq oy
    // yozilyapti (eski sahifadagi eslatma; `created` avtomatik olinmaydi).
    const startMissing = hasOklad && !e.salaryStart && !!createdMonth
      && createdMonth >= monthKey
      && !(createdMonth === monthKey && (e.createdDate ?? "").endsWith("-01"));
    // Eni chegaralangan: uzun formula (qaytarim bilan) va eslatmalar (almashuv,
    // sana) ustunni cho'zib, pul ustunlarini ekrandan siqib chiqarmasin — o'raladi.
    return (
      <div className="min-w-[200px] max-w-[280px] text-v2-small tabular-nums text-v2-text-2">
        <div className="flex items-start gap-1.5">
          <span title={`= ${fmtNum(isMixed ? payrollOkladPart(e, period) : payrollBase(e, period))}`}>{hasOklad ? okladLine : foizLine}</span>
          {isFoiz && handoverBtn(e)}
        </div>
        {isMixed && (
          <div className="flex items-start gap-1.5 text-v2-caption font-normal text-v2-text-3">
            <span title={`= ${fmtNum(payrollFoizPart(e))}`}>+ {foizLine}</span>
            {handoverBtn(e)}
          </div>
        )}
        {/* O'quvchilari shu fanda boshqa ustoz guruhida, almashuv kiritilmagan. */}
        {e.movedHint && (
          <button
            type="button"
            onClick={() => setHandoverFor(e.name)}
            title={t("Bosing — ustoz almashuvini kiritish yoki eslatmani yashirish")}
            className="mt-0.5 flex items-start gap-1 text-left text-v2-caption font-normal text-v2-warning hover:underline"
          >
            <AlertTriangle className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
            {t("{n} ta o'quvchisi endi {teachers} guruhida — ustoz almashuvini kiriting", { n: e.movedHint.count, teachers: e.movedHint.teachers.join(", ") })}
          </button>
        )}
        {/* Ustoz almashuvi izohi — `collected` allaqachon kunlarga bo'lingan. */}
        {(e.handovers ?? []).map((h, i) => (
          <div key={i} className="mt-0.5 text-v2-caption font-normal text-v2-violet">
            {h.dir === "out"
              ? t(h.unit === "lessons" ? "{date} gacha ({days}/{daysIn} dars) · {amount} tushum → {other}" : "{date} gacha ({days}/{daysIn} kun) · {amount} tushum → {other}", {
                  date: fmtIsoDay(h.lastDay), days: h.days, daysIn: h.daysIn, amount: fmtNum(h.amount), other: h.other || t("hech kimga"),
                })
              : t(h.unit === "lessons" ? "+{amount} tushum — {other}dan ({days}/{daysIn} dars)" : "+{amount} tushum — {other}dan ({days}/{daysIn} kun)", {
                  amount: fmtNum(h.amount), other: h.other, days: h.days, daysIn: h.daysIn,
                })}
          </div>
        ))}
        {startMissing && (
          <Link
            href={`/management-xodimlar/${e.id}`}
            title={t("Ishga kirgan sana kiritilmasa oklad oy boshidan — to'liq oy uchun hisoblanadi")}
            className="mt-0.5 block text-v2-caption font-normal text-v2-warning hover:underline"
          >
            {t("{date} da qo'shilgan — ishga kirgan sanani kiriting", { date: fmtIsoDay(e.createdDate ?? "") })}
          </Link>
        )}
      </div>
    );
  }

  /** Boshqa filial kassasidan olingan qism — faqat ko'rsatish (eski sahifadek). */
  function elsewhereSub(e: EmployeePayroll, kind: "avans" | "oylik", own: number) {
    const list = (e.paidElsewhere ?? []).filter((x) => x[kind] > 0);
    const sum = list.reduce((s, x) => s + x[kind], 0);
    if (sum <= 0) return null;
    const title = list.map((x) => t("{branch} kassasidan: {amount}", { branch: x.branch || t("filialga biriktirilmagan kassa"), amount: fmtNum(x[kind]) })).join("\n");
    return (
      <div className="mt-0.5 whitespace-nowrap text-v2-caption font-normal text-v2-text-3" title={title}>
        {sum >= own ? t("boshqa filial kassasidan") : t("shundan {amount} boshqa filialdan", { amount: fmtNum(sum) })}
      </div>
    );
  }

  function carryCell(e: EmployeePayroll) {
    const maybePaid = pendingMaybePaidByMonth(e, period);
    return (
      <>
        {e.carryOver !== 0 ? (
          <>
            <div className={`tabular-nums ${e.carryOver < 0 ? "font-medium text-v2-warning" : "text-v2-text"}`}>{signed(e.carryOver)}</div>
            {e.carryNote && sub(e.carryNote)}
          </>
        ) : (
          zero
        )}
        {(e.carryPendingMonths ?? []).map((pm) => {
          // Shu oyda ortiqcha oylik bor va u shu oy puli bo'lishi mumkin — o'sha
          // sahifaga YO'NALTIRILMAYDI (u yerda yana chiqarilsa ikki marta to'lanadi).
          const covered = maybePaid.find((x) => x.month === pm.month)?.amount ?? 0;
          if (covered > 0) {
            return (
              <div
                key={pm.month}
                title={t("{month} qoldig'idan {amount} {current} oyida {current} yozuvi bo'lib berilgan bo'lishi mumkin — shu oyda ortiqcha oylik bor. {month} sahifasidan qayta chiqarmang: avval o'sha yozuvning oyini tekshiring.", {
                  month: pendingMonthLabel(pm.month), amount: `${fmtNum(covered)} ${t("so'm")}`, current: pendingMonthLabel(monthKey),
                })}
                className="mt-1 cursor-help whitespace-nowrap text-v2-caption font-normal text-v2-danger"
              >
                {`${pendingMonthLabel(pm.month)}: ${fmtNum(pm.amount)}`}
                <span className="ml-1 inline-flex items-center gap-1 rounded-v2-sm bg-v2-danger-bg px-1 font-medium">
                  <AlertTriangle className="size-3" strokeWidth={2} aria-hidden />
                  {t("Qayta chiqarmang")}
                </span>
              </div>
            );
          }
          return (
            <button
              key={pm.month}
              type="button"
              onClick={() => changeMonth(pm.month)}
              title={t("{month} oyidan to'lanmagan {amount} — bu oyda to'lanmaydi, faqat {month} sahifasidan chiqariladi. Bosing: {month} oyiga o'tish.", {
                month: pendingMonthLabel(pm.month), amount: `${fmtNum(pm.amount)} ${t("so'm")}`,
              })}
              className="mt-1 flex w-full items-center justify-end gap-0.5 whitespace-nowrap text-v2-caption font-normal text-v2-warning hover:underline"
            >
              {`${pendingMonthLabel(pm.month)}: ${fmtNum(pm.amount)}`}
              <ArrowRight className="size-3" strokeWidth={2} aria-hidden />
            </button>
          );
        })}
      </>
    );
  }

  function taxCell(e: EmployeePayroll) {
    if (!e.taxable) {
      return (
        <div title={t("Bu xodimga soliq solinmaydi")}>
          {zero}
          {sub("—")}
        </div>
      );
    }
    const tax = payrollTax(e, period);
    const lines = payrollTaxLines(e, period);
    const single = e.taxRules.length === 1 && e.taxRules[0].type === "percent" ? e.taxRules[0] : null;
    return (
      <div title={lines.map((l) => `${l.name} (${l.detail}): ${fmtNum(l.amount)}`).join("\n") || t("Soliq ro'yxati bo'sh yoki hisoblangan oylik 0")}>
        {tax > 0 ? <div className="font-medium tabular-nums text-v2-danger">−{fmtNum(tax)}</div> : zero}
        {sub(single ? `${fmtNum(Math.max(payrollEarned(e, period), 0))} × ${single.value}%` : t("{n} ta soliq", { n: lines.length }))}
      </div>
    );
  }

  function kartaCell(e: EmployeePayroll) {
    if (e.plastikSalary <= 0) {
      return (
        <>
          {zero}
          {sub(t("faqat naqd"))}
        </>
      );
    }
    const plastik = payrollPlastikLeg(e, period);
    const short = payrollPlastikTarget(e) - plastik;
    const title =
      t("Plastik oylik {plastikSalary}", { plastikSalary: fmtNum(e.plastikSalary) })
      + (e.paidPlastik > 0 ? t(" − shu oyda kartadan berilgan {paidPlastik}", { paidPlastik: fmtNum(e.paidPlastik) }) : "")
      + (short > 0 ? t(" — hisoblangan yetmagani uchun {plastik} chiqadi", { plastik: fmtNum(plastik) }) : "");
    return (
      <div title={title}>
        <div className="font-semibold tabular-nums text-v2-text">{fmtNum(plastik)}</div>
        {e.paidPlastik > 0
          ? sub(t("{paidPlastik} to'landi", { paidPlastik: fmtNum(e.paidPlastik) }), "text-v2-success")
          : sub(t("rasmiy {amount}", { amount: fmtNum(e.plastikSalary) }))}
      </div>
    );
  }

  function cell(e: EmployeePayroll, key: PayrollColumnKey): ReactNode {
    switch (key) {
      case "employee":
      case "due":
        return null; // qulflangan — qatorda alohida
      case "calc":
        return calcCell(e);
      case "earned":
        return e.configured ? <span className="font-semibold tabular-nums text-v2-text">{signed(payrollEarned(e, period))}</span> : dash;
      case "avans":
        return (
          <>
            {e.paidAvans > 0 ? <span className="font-medium tabular-nums text-v2-warning">{fmtNum(e.paidAvans)}</span> : zero}
            {elsewhereSub(e, "avans", e.paidAvans)}
          </>
        );
      case "paid":
        return (
          <>
            {e.paidOylik !== 0 ? <span className="tabular-nums text-v2-text">{signed(e.paidOylik)}</span> : zero}
            {elsewhereSub(e, "oylik", e.paidOylik)}
          </>
        );
      case "carry":
        return e.configured ? carryCell(e) : dash;
      case "bonus":
        return e.bonus > 0 ? <span className="font-medium tabular-nums text-v2-success">{fmtNum(e.bonus)}</span> : zero;
      case "jarima":
        return e.jarima > 0 ? <span className="font-medium tabular-nums text-v2-danger">{fmtNum(e.jarima)}</span> : zero;
      case "tax":
        return e.configured ? taxCell(e) : dash;
      case "karta":
        return e.configured ? kartaCell(e) : dash;
      case "phone":
        return e.phone ? <span className="whitespace-nowrap tabular-nums text-v2-text-2">{e.phone}</span> : dash;
      case "role":
        return <span className="whitespace-nowrap text-v2-text-2">{t(payrollTuriLabel(e.turi))}</span>;
    }
  }

  function footCell(key: PayrollColumnKey): ReactNode {
    const strong = (n: number, cls = "text-v2-text") => <span className={`font-semibold tabular-nums ${cls}`}>{signed(n)}</span>;
    switch (key) {
      case "earned":
        return strong(totals.earned);
      case "avans":
        return strong(totals.avans);
      case "paid":
        return strong(totals.paid);
      case "carry":
        return strong(totals.carry, totals.carry < 0 ? "text-v2-warning" : "text-v2-text");
      case "bonus":
        return strong(totals.bonus);
      case "jarima":
        return strong(totals.jarima);
      case "tax":
        return totals.tax > 0 ? <span className="font-semibold tabular-nums text-v2-danger">−{fmtNum(totals.tax)}</span> : strong(0);
      case "karta":
        return strong(totals.karta);
      default:
        return null;
    }
  }

  const headLabel = (c: PayrollColumn) =>
    c.key === "calc" ? `${t("Hisob-kitob")} (${calcSuffix})` : c.key === "tax" ? taxLabel : t(c.label);

  // Sarlavha tepada, «Jami» pastda qotadi. Ustun ko'p bo'lsa jadval yonga
  // aylanadi — belgilash va «Xodim» ustunlari CHAPDA qotadi (ism doim ko'rinsin);
  // qotgan katak foni qatornikini oladi (`bg-inherit`), o'ngida ajratgich chiziq.
  // −1 px / 38 px: kasr kenglikda chap chetda va ikki katak orasida 1 px tirqishdan
  // surilgan raqamlar ko'rinib qolardi (o'lchandi) — kataklar 1 px ustma-ust.
  const thBase = "sticky top-0 whitespace-nowrap bg-v2-surface-2 py-2.5 text-left text-v2-small";
  const th = `${thBase} z-10 shadow-[inset_0_-1px_0_var(--v2-border)]`;
  const thPin1 = `${thBase} -left-px z-20 shadow-[inset_0_-1px_0_var(--v2-border)]`;
  const thPin2 = `${thBase} left-[38px] z-20 ${scrolledX ? "shadow-[inset_-1px_0_0_var(--v2-border),inset_0_-1px_0_var(--v2-border)]" : "shadow-[inset_0_-1px_0_var(--v2-border)]"}`;
  const tfBase = "sticky bottom-0 whitespace-nowrap bg-v2-surface-2 py-3";
  const tf = `${tfBase} z-10 shadow-[inset_0_1px_0_var(--v2-border)]`;
  const tfPin1 = `${tfBase} -left-px z-20 shadow-[inset_0_1px_0_var(--v2-border)]`;
  const tfPin2 = `${tfBase} left-[38px] z-20 ${scrolledX ? "shadow-[inset_-1px_0_0_var(--v2-border),inset_0_1px_0_var(--v2-border)]" : "shadow-[inset_0_1px_0_var(--v2-border)]"}`;
  const count = selected.size;

  return (
    <div data-ui="v2" className="relative flex min-h-full flex-col gap-4 bg-v2-surface p-4 font-v2 text-v2-text sm:p-5 lg:h-full lg:min-h-0">
      {/* 1. Sarlavha */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-v2-page text-v2-text">{t("Oylik chiqarish")}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-v2-small text-v2-text-2">
            <span>{[branchName, periodText].filter(Boolean).join(" · ")}</span>
            {status && <span className={`inline-flex items-center rounded-v2-full px-2 py-0.5 text-v2-caption ${status.cls}`}>{status.text}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* 1+2 «Akademiya Chortoq» — oylik bino bo'yicha (usePayroll izohi). */}
          {buildings.length > 1 && (
            <div role="tablist" aria-label={t("Bino")} className="inline-flex h-9 items-center gap-0.5 rounded-v2-md border border-v2-border bg-v2-surface-2 p-0.5">
              {buildings.map((id) => {
                const on = (building ?? navBranchId) === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => changeBuilding(id)}
                    className={`h-full rounded-[6px] px-3 text-v2-small font-medium transition-colors ${on ? "bg-v2-surface text-v2-text shadow-v2-sm" : "text-v2-text-2 hover:text-v2-text"}`}
                  >
                    {t("{n}-bino", { n: buildingNo(id) ?? id })}
                  </button>
                );
              })}
            </div>
          )}
          <V2MonthNav value={monthKey} onChange={changeMonth} current={currentMonthKey} />
          <Link href="/finance-payroll/history" className={secondaryBtn}>
            <History className="size-4 text-v2-text-2" strokeWidth={1.75} aria-hidden />
            {t("Chiqarishlar tarixi")}
          </Link>
          <button type="button" onClick={load} disabled={loading} className={`${secondaryBtn} disabled:cursor-wait`}>
            <RefreshCw className={`size-4 text-v2-text-2 ${loading ? "animate-spin" : ""}`} strokeWidth={1.75} aria-hidden />
            {t("Qayta hisoblash")}
          </button>
        </div>
      </div>

      {/* 2. Ko'rsatkichlar — bitta kartochka, kataklar orasida chiziq (to'r oralig'i).
          `sm:grid-cols-3` EMAS: globals.css dagi eski (qatlamsiz) `.sm\:grid-cols-3`
          qatlamli `xl:` dan kuchli va 1280 px da ham 3 ustun qoldirardi (o'lchandi). */}
      <div className="grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-v2-lg border border-v2-border bg-v2-border shadow-v2-sm min-[40rem]:grid-cols-3 min-[80rem]:grid-cols-6">
        {statCells.map((c) => (
          <div key={c.key} title={c.title} className={`min-w-0 px-4 py-3 ${c.highlight ? "bg-v2-brand-bg" : "bg-v2-surface"}`}>
            <div className={`truncate text-v2-small ${c.highlight ? "font-medium text-v2-brand-text" : "text-v2-text-2"}`}>{c.label}</div>
            <div className="mt-1 truncate leading-6">{c.value}</div>
            {c.hint && <div className="mt-1 text-v2-caption font-normal text-v2-text-3">{c.hint}</div>}
          </div>
        ))}
      </div>

      {/* 3. Filtrlar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-[280px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            placeholder={t("Xodim ismi yoki telefoni")}
            aria-label={t("Xodim ismi yoki telefoni")}
            className="h-9 w-full rounded-v2-md border border-v2-border-field bg-v2-surface! pl-9 pr-3 text-v2-body text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:border-v2-brand focus:shadow-v2-focus focus:outline-none"
          />
        </div>
        <V2Select
          variant="chip"
          label={t("Xodim turi")}
          value={turiFilter === "all" ? "" : turiFilter}
          onChange={(v) => setTuriFilter(v || "all")}
          options={turiOptions.map((tv) => ({ value: tv, label: payrollTuriLabel(tv) }))}
          searchable={false}
        />
        <V2Select
          variant="chip"
          label={t("Hisoblash usuli")}
          value={hisoblash === "all" ? "" : hisoblash}
          onChange={(v) => setHisoblash((v || "all") as HisoblashFilter)}
          options={HISOBLASH_OPTIONS}
          searchable={false}
        />
        <div className="ml-auto">
          <ColumnsControl prefs={columns} />
        </div>
      </div>

      {/* 4. Jadval: tepasida tanlov qatori, pastida «Jami». Karta qatorlar
          balandligida (rasmdagidek — izoh darhol ostida); ro'yxat uzun bo'lsa
          sahifaga sig'guncha qisqaradi va ichidan aylanadi (`min-h-0`). */}
      <div className="flex min-h-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <div className={`flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-v2-border px-4 py-2.5 ${count > 0 && !payoutBlockedReason ? "bg-v2-brand-bg" : "bg-v2-surface"}`}>
          {payoutBlockedReason ? (
            <span className="inline-flex items-center gap-2 text-v2-small text-v2-text-2">
              <Info className="size-4 shrink-0 text-v2-info" strokeWidth={1.75} aria-hidden />
              {payoutBlockedReason}
            </span>
          ) : count > 0 ? (
            <>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-v2-small font-semibold text-v2-brand-text">
                <Check className="size-4" strokeWidth={2.25} aria-hidden />
                {t("{n} ta xodim tanlandi", { n: count })}
              </span>
              <span className="text-v2-small text-v2-text-2">
                {t("Chiqariladigan summa:")}{" "}
                <b className="whitespace-nowrap font-semibold tabular-nums text-v2-text">
                  {fmtNum(payoutTotal)} {t("so'm")}
                </b>
                {plastikTotal > 0 && <span className="tabular-nums"> · {t("kartaga {kartaga}, naqd {naqd}", { kartaga: fmtNum(plastikTotal), naqd: fmtNum(naqdTotal) })}</span>}
              </span>
            </>
          ) : (
            <span className="text-v2-small text-v2-text-2">{t("Oylik chiqarish uchun jadvaldan xodimlarni belgilang")}</span>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {count > 0 && (
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="h-9 rounded-v2-md px-3 text-v2-body font-medium text-v2-text-2 transition-colors hover:bg-v2-surface hover:text-v2-text"
              >
                {t("Bekor qilish")}
              </button>
            )}
            <div className="inline-flex">
              <button
                type="button"
                onClick={openAll}
                disabled={!!payoutBlockedReason}
                title={payoutBlockedReason || undefined}
                className={`${primaryBtn} ${disabledPrimary} ${anyPlastik ? "rounded-r-none" : ""}`}
              >
                <Wallet className="size-4" strokeWidth={1.75} aria-hidden />
                {t("Oylikni chiqarish")}
              </button>
              {/* «Faqat kartani chiqarish» (30.09.2026) — tanlanganlarning, hech kim
                  tanlanmagan bo'lsa ro'yxatdagi kartasi borlarning karta qismi. Rasmda
                  qatorda bitta tugma — ikkinchi usul uning yonidagi ochiluvchi menyuda. */}
              {anyPlastik && (
                <ActionMenu
                  items={[
                    {
                      key: "karta",
                      label: t("Faqat kartani chiqarish"),
                      hint: t("{n} ta", { n: kartaRows.length }),
                      icon: CreditCard,
                      onSelect: openKarta,
                      title: t("Faqat karta qismi chiqariladi — naqd qismi «Qolgan oylik»da qoladi"),
                    },
                  ]}
                  label={t("Boshqa chiqarish usullari")}
                  width={268}
                >
                  {(trigger, open) => (
                    <button
                      type="button"
                      {...trigger}
                      disabled={!!payoutBlockedReason}
                      aria-label={t("Boshqa chiqarish usullari")}
                      title={payoutBlockedReason || t("Faqat kartani chiqarish")}
                      className={`inline-flex h-9 w-8 shrink-0 items-center justify-center rounded-r-v2-md border-l border-v2-on-brand/30 bg-v2-brand text-v2-on-brand transition-[filter] hover:brightness-95 focus-visible:shadow-v2-focus focus-visible:outline-none ${disabledPrimary} ${open ? "brightness-95" : ""}`}
                    >
                      <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={2} aria-hidden />
                    </button>
                  )}
                </ActionMenu>
              )}
            </div>
          </div>
        </div>

        <div
          className="max-h-[70vh] min-h-0 flex-auto overflow-auto lg:max-h-none"
          onScroll={(ev) => {
            const x = ev.currentTarget.scrollLeft > 0;
            if (x !== scrolledX) setScrolledX(x);
          }}
        >
          <table className="w-full border-collapse text-v2-body">
            <thead>
              <tr>
                <th className={`${thPin1} w-10 pl-4 pr-2`}>
                  <V2Checkbox
                    checked={allInView}
                    indeterminate={selInView > 0 && !allInView}
                    onChange={toggleAll}
                    disabled={selectable.length === 0}
                    label={t("Hammasini tanlash")}
                  />
                </th>
                <th className={`${thPin2} px-2.5 font-medium text-v2-text-2`}>{t("Xodim")}</th>
                {visibleCols.map((c) => (
                  <th
                    key={c.key}
                    className={`${th} px-2.5 ${c.align === "right" ? "text-right" : ""} ${STRONG_HEAD.has(c.key) ? "font-semibold text-v2-text" : "font-medium text-v2-text-2"}`}
                  >
                    {headLabel(c)}
                  </th>
                ))}
                <th className={`${th} pl-2.5 pr-4 text-right font-semibold text-v2-text`}>{t("Qolgan oylik")}</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={`sk${i}`} className={`border-b border-v2-border ${rowH}`} aria-hidden>
                    <td className="py-3 pl-4 pr-2"><div className="size-4 rounded-[4px] bg-v2-skeleton" /></td>
                    <td className="px-2.5 py-3">
                      <div className="h-3 w-36 rounded bg-v2-skeleton" />
                      <div className="mt-2 h-4 w-14 rounded bg-v2-skeleton" />
                    </td>
                    {visibleCols.map((c) => (
                      <td key={c.key} className="px-2.5 py-3"><div className={`h-3 rounded bg-v2-skeleton ${c.align === "right" ? "ml-auto w-14" : "w-28"}`} /></td>
                    ))}
                    <td className="py-3 pl-2.5 pr-4"><div className="ml-auto h-3 w-16 rounded bg-v2-skeleton" /></td>
                  </tr>
                ))}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="p-6">
                    <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
                      <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
                        <Users className="size-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      {employees.length === 0 ? (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Oylik ro'yxatida xodim yo'q")}</div>
                          <p className="max-w-md text-v2-small text-v2-text-2">{t("Xodimning ish haqi va oylik filiali Boshqaruv → Xodimlar sahifasida, xodim profilidagi «Ish haqi» oynasida sozlanadi.")}</p>
                        </>
                      ) : (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Mos xodim topilmadi")}</div>
                          <p className="text-v2-small text-v2-text-2">{t("Qidiruv yoki filtrlarni o'zgartirib ko'ring.")}</p>
                          {anyFilter && (
                            <button type="button" onClick={clearFilters} className={`${secondaryBtn} mt-2`}>
                              {t("Filtrlarni tozalash")}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((e) => {
                  const on = selected.has(e.id);
                  const hasOklad = payrollHasOklad(e);
                  const typeTag = e.salaryType === "mixed"
                    ? t("Oklad + {percent}%", { percent: e.percent })
                    : e.salaryType === "foiz" ? t("Foiz {percent}%", { percent: e.percent }) : t("Oklad");
                  // Ishga kirgan sana SHU (yoki keyingi) oyda — «01.10.2026 dan».
                  const startDate = hasOklad && e.salaryStart && payrollStartsInPeriod(e, period) ? e.salaryStart : "";
                  // Ishdan ketish sanasi: shu (yoki oldingi) oyda — oklad shu kungacha;
                  // HALI KELMAGAN bo'lsa «ishdan ketadigan sana» (13.10.2026) joriy/keyingi
                  // oy sahifasida ham ko'rinadi.
                  const endFuture = isFutureIsoDay(e.salaryEnd, todayIso);
                  const endNote = e.salaryEnd && (payrollEndsInPeriod(e, period) || (endFuture && !isPastMonth))
                    ? endFuture
                      ? t("ishdan ketadigan sana: {date}", { date: fmtIsoDay(e.salaryEnd) })
                      : t("ishdan ketgan sana: {date}", { date: fmtIsoDay(e.salaryEnd) })
                    : "";
                  const due = e.configured ? payrollDue(e, period) : 0;
                  const plastik = e.configured ? payrollPlastikLeg(e, period) : 0;
                  return (
                    <tr key={e.id} className={`group border-b border-v2-border transition-colors last:border-b-0 ${rowH} ${on ? ROW_TINT.brand : `bg-v2-surface ${ROW_TINT.hover}`}`}>
                      <td className={`${cellY} sticky -left-px z-[1] bg-inherit pl-4 pr-2`}>
                        <V2Checkbox
                          checked={on}
                          onChange={() => toggleOne(e.id)}
                          disabled={!e.configured}
                          title={e.configured ? undefined : t("Ish haqi sozlanmagan — oylik chiqarib bo'lmaydi")}
                          label={t("{name} — belgilash", { name: e.name })}
                        />
                      </td>
                      <td className={`${cellY} sticky left-[38px] z-[1] bg-inherit px-2.5 ${scrolledX ? "shadow-[inset_-1px_0_0_var(--v2-border)]" : ""}`}>
                        <div className="min-w-[180px]">
                          <Link
                            href={`/management-xodimlar/${e.id}`}
                            className="font-semibold text-v2-text underline-offset-2 hover:text-v2-brand-text hover:underline"
                          >
                            {e.name}
                          </Link>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            {e.configured ? (
                              <span className={tagCls}>{typeTag}</span>
                            ) : (
                              <span className="inline-flex whitespace-nowrap rounded-v2-sm bg-v2-warning-bg px-1.5 py-px text-v2-caption text-v2-warning">{t("Sozlanmagan")}</span>
                            )}
                            {e.archived && (
                              <span className="inline-flex whitespace-nowrap rounded-v2-sm bg-v2-danger-bg px-1.5 py-px text-v2-caption text-v2-danger">{t("arxivda")}</span>
                            )}
                            {startDate && (
                              <span className="whitespace-nowrap text-v2-caption font-normal tabular-nums text-v2-text-3" title={t("Ishga kirgan sana")}>
                                {t("{date} dan", { date: fmtIsoDay(startDate) })}
                              </span>
                            )}
                          </div>
                          {endNote && <div className={`mt-0.5 whitespace-nowrap text-v2-caption font-normal ${endFuture ? "text-v2-warning" : "text-v2-danger"}`}>{endNote}</div>}
                        </div>
                      </td>
                      {visibleCols.map((c) => (
                        <td key={c.key} className={`${cellY} px-2.5 ${c.align === "right" ? "text-right" : ""}`}>
                          {cell(e, c.key)}
                        </td>
                      ))}
                      <td className={`${cellY} pl-2.5 pr-4 text-right`}>
                        {!e.configured ? (
                          dash
                        ) : due >= 0 ? (
                          <div
                            className="font-semibold tabular-nums text-v2-text"
                            title={plastik > 0 ? t("kartaga {kartaga} · naqd {naqd}", { kartaga: fmtNum(plastik), naqd: fmtNum(due - plastik) }) : undefined}
                          >
                            {fmtNum(due)}
                          </div>
                        ) : (
                          <>
                            <div className="font-semibold tabular-nums text-v2-warning">{signed(due)}</div>
                            {sub(t("qarzdor"))}
                          </>
                        )}
                        {/* O'TGAN OY sahifasi: shu qoldiqning bir qismi joriy oyda joriy oy
                            yozuvi bo'lib berilgan bo'lishi mumkin (04.10.2026). */}
                        {e.configured && e.maybePaidIn && (
                          <span
                            className="mt-1 inline-flex cursor-help items-center gap-1 whitespace-nowrap rounded-v2-sm bg-v2-danger-bg px-1.5 py-0.5 text-v2-caption text-v2-danger"
                            title={t("Shu oy qoldig'idan {amount} {month} oyida {month} yozuvi bo'lib berilgan bo'lishi mumkin — u yerda shuncha ortiqcha oylik bor. Qayta chiqarilsa xodim uni ikki marta oladi: avval o'sha yozuvning oyini tekshiring.", {
                              amount: `${fmtNum(e.maybePaidIn.amount)} ${t("so'm")}`,
                              month: pendingMonthLabel(e.maybePaidIn.month),
                            })}
                          >
                            <AlertTriangle className="size-3" strokeWidth={2} aria-hidden />
                            {t("Qayta chiqarmang")}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
            {!loading && filtered.length > 0 && (
              <tfoot>
                <tr>
                  <td className={`${tfPin1} pl-4 pr-2`} />
                  <td className={`${tfPin2} px-2.5 font-semibold text-v2-text`}>{t("Jami · {n} xodim", { n: filtered.length })}</td>
                  {visibleCols.map((c) => (
                    <td key={c.key} className={`${tf} px-2.5 ${c.align === "right" ? "text-right" : ""}`}>
                      {footCell(c.key)}
                    </td>
                  ))}
                  <td className={`${tf} pl-2.5 pr-4 text-right`}>
                    <span className="font-semibold tabular-nums text-v2-brand-text">
                      {fmtNum(totals.payout)} {t("so'm")}
                    </span>
                    {totals.debt > 0 && sub(t("xodim qarzi: {qarzdorlik}", { qarzdorlik: fmtNum(totals.debt) }))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 5. Izoh — tizimdagi haqiqiy qoidalar (rasmdagi matndan farqi: SAVOLLAR 62–64). */}
      <p className="flex shrink-0 items-start gap-2 text-v2-caption font-normal text-v2-text-2">
        <Info className="mt-px size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
        <span>
          {t("Oklad oy kunlariga bo'linib hisoblanadi. Kartaga avval xodimning rasmiy (plastik) oyligi o'tadi, qolgani naqd beriladi. Soliq xodimga biriktirilgan qoidalar bo'yicha hisoblangan oylikdan ushlanadi (Sozlamalar). O'tgan oyning to'lanmagan qoldig'i keyingi oyda izoh bo'lib turadi va o'z oyi sahifasidan chiqariladi. «To'langan» va «O'tgan oydan» ustunlari qiymati bo'lganda o'zi chiqadi.")}
        </span>
      </p>

      {modal && <PayoutModalV2 mode={modal} p={p} onClose={() => setModal(null)} />}
      {handoverFor && (
        <TeacherHandoverModal
          teacher={handoverFor}
          month={monthKey}
          monthLabel={monthLabel}
          onClose={() => setHandoverFor(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
