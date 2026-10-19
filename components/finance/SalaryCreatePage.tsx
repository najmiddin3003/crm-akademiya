"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "@/components/ui/Link";
import { ArrowLeftRight, ArrowRight, CreditCard, DollarSign, History, RotateCcw, Search } from "lucide-react";
import TeacherHandoverModal from "@/components/finance/TeacherHandoverModal";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import Select from "@/components/ui/Select";
import MonthYearPicker from "@/components/ui/MonthYearPicker";
import { selectPlaceholder } from "@/lib/selectPlaceholder";
import {
  payrollBase,
  payrollEarned,
  payrollFoizPart,
  payrollHasOklad,
  payrollOkladDays,
  payrollOkladPart,
  payrollPaid,
  payrollStartsInPeriod,
  payrollEndsInPeriod,
  payrollTax,
  payrollTaxLines,
  payrollPlastikLeg,
  payrollPlastikTarget,
  payrollCashDue,
  pendingMaybePaidByMonth,
} from "@/lib/salary";
import { isFutureIsoDay } from "@/lib/uzTime";
import Modal from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import { buildingNo } from "@/lib/branchPools";
import { payrollTuriLabel, usePayroll, type HisoblashFilter } from "@/components/finance/usePayroll";

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
//
// O'TGAN OYLAR QOLDIG'I — "FAQAT O'Z OYIDAN" (04.10.2026, foydalanuvchi).
// "O'tgan oydan" ustuni, "Qolgan" va chiqariladigan summa faqat SHU OYDA
// to'lanadigan qismni oladi (`carryOver`: nol-yopish oyining ulushi yoki
// qarzdorlik). O'tgan oyning TO'LANMAGAN musbat qoldig'i
// (`carryPendingMonths`, lib/salary.ts → foldCarryChain) bu sahifada FAQAT
// MA'LUMOT: ustun ostida "Sentabr: 314 000" turadi, bosilsa oy tanlagichi
// o'sha oyga o'tadi va pul o'sha oy sahifasidan chiqariladi. "Qolgan
// to'lanadigan" kartochkasida va tasdiqlash oynasida ham alohida aytiladi.
// NIMA NOTO'G'RI EDI: ilgari u shu oyning "Qolgan"iga qo'shilardi —
// oktabrda chiqarilgan pul OKTABR yozuvi bo'lardi, sentabr sahifasi esa
// hamon "Qolgan" ko'rsatardi, ya'ni bir summani ikki marta to'lash mumkin
// edi (sinov bazasida isbotlangan).

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
  /**
   * `hint` ostidagi qo'shimcha OGOHLANTIRISH qatori (ixtiyoriy, sariq) —
   * masalan "Qolgan to'lanadigan" kartochkasida o'tgan oylarda to'lanmagan,
   * lekin bu summaga KIRMAYDIGAN qoldiq (04.10.2026). Ichida tugma bo'lishi
   * mumkin, shuning uchun matn emas, element.
   */
  note?: ReactNode;
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
function StatCard({ label, value, hint, title, sub, note, tone, loading = false }: StatCardProps) {
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
      {note && !loading && (
        <div className="mt-0.5 text-[11px] leading-snug text-amber-600 dark:text-amber-500">{note}</div>
      )}
    </div>
  );
}

export default function SalaryCreatePage() {
  const { t, months } = useT();
  const { showError } = useToast();
  // Ma'lumot, filtr, tanlov, raqamlar va chiqarish so'rovi — yangi versiya
  // (components/v2/finance/PayrollV2.tsx) bilan BITTA manbadan:
  // ./usePayroll.ts (19.10.2026 da shu fayldan izohlari bilan aynan ko'chirildi).
  const {
    employees, loading, given, cashflow, monthKey, todayIso, period, isPastMonth, isFutureMonth, isClosedMonth,
    payoutBlockedReason, monthLabel, pendingMonthLabel, changeMonth, navBranchId, buildings, building, changeBuilding, load,
    query, setQuery, turiFilter, setTuriFilter, hisoblash, setHisoblash, filtered, turiOptions,
    selected, setSelected, allSelected, someSelected, toggleAll, toggleOne,
    stats, sofFoyda, cashflowNoma, anyPlastik,
    paymentMethods, methodsLoading, cashboxes, cashboxesLoading, cashboxId, setCashboxId, activeCashbox,
    methodKey, setMethod, plastikMethodKey, setPlastikMethod, available, plastikAvailable,
    payoutTotal, plastikTotal, naqdTotal, selectedPending, selectedPendingTotal, selectedMaybePaid,
    sameMethod, notEnough, needsPlastikMethod, shortfall, canPayout,
    kartaRows, kartaTotal, kartaShort, canKarta, saving, submitPayout,
  } = usePayroll();
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Tasdiqlash oynasi «Faqat kartani chiqarish» rejimidami (30.09.2026).
  const [kartaOnly, setKartaOnly] = useState(false);
  // Ustoz almashuvi oynasi — qaysi o'qituvchi uchun ochiq (components/finance/TeacherHandoverModal.tsx).
  const [handoverFor, setHandoverFor] = useState<string | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const periodLabel = useMemo(() => t("1 — {day}-{month} ({day}/{daysIn} kun)", { day: period.day, month: months[period.month].toLowerCase(), daysIn: period.daysIn }), [period, months, t]);
  // Sarlavhalar oyga qarab o'zgaradi: "shu kungacha" faqat JORIY oyda
  // to'g'ri — tugagan oy to'liq hisoblanadi, kelajak oyda esa umuman
  // hisoblanmaydi (faqat oldindan tushgan pul ko'rinadi).
  const calcSuffix = isPastMonth ? "to'liq oy" : isFutureMonth ? "oldindan" : "shu kungacha";
  // Kelajak oyda davr yorlig'i "1 — 0-oktabr (0/31 kun)" bo'lib chiqadi —
  // izohlarda uning o'rniga oddiy oy nomi ko'rsatiladi.
  const periodHint = isFutureMonth ? monthLabel : periodLabel;

  useEffect(() => {
    if (headerCheckboxRef.current) headerCheckboxRef.current.indeterminate = someSelected;
  }, [someSelected]);

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

  function openKartaConfirm() {
    if (kartaRows.length === 0) {
      showError(selected.size > 0
        ? t("Tanlangan xodimlarda kartaga chiqariladigan summa yo'q")
        : t("Kartaga chiqariladigan summa yo'q — shu oy kartalari to'langan"));
      return;
    }
    setKartaOnly(true);
    setConfirmOpen(true);
  }

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
    setKartaOnly(false);
    setConfirmOpen(true);
  }

  async function confirmPayout() {
    // So'rov, toast, tanlovni tozalash va qayta yuklash — usePayroll ichida.
    if (await submitPayout(kartaOnly)) {
      setConfirmOpen(false);
      setKartaOnly(false);
    }
  }

  const selectedCount = selected.size;
  const turiLabel = payrollTuriLabel;

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
        {buildings.length > 1 && (
          <div className="inline-flex h-8 items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 text-[12px] font-semibold" role="tablist" aria-label={t("Bino")}>
            {buildings.map((id) => {
              const on = (building ?? navBranchId) === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => changeBuilding(id)}
                  className={`h-7 rounded-md px-2.5 ${on ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}
                >
                  {t("{n}-bino", { n: buildingNo(id) ?? id })}
                </button>
              );
            })}
          </div>
        )}
        {/* Kelajak oyda davr yorlig'i ma'nosiz ("0-oktabr") — o'rniga
            nima ko'rsatilayotgani aytiladi. */}
        {!isFutureMonth && (
          <span className="inline-flex items-center h-7 px-2.5 rounded-md bg-primary/10 text-primary text-[12px] font-semibold">
            {periodLabel}
          </span>
        )}
        {isClosedMonth ? (
          // YOPILGAN oy (nol-yopish) — raqamlar tizimdan oldingi davrdan
          // quriladi va pul chiqarilmaydi (server ham rad etadi).
          <span className="inline-flex items-center h-7 px-2.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[12px] font-semibold">
            {t("{monthLabel} — yopilgan oy, oylik chiqarilmaydi", { monthLabel })}
          </span>
        ) : isPastMonth && (
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
          {/* Faqat karta qismi — ro'yxatda plastik oyligi bor xodim
              bo'lsagina. Soni: tanlanganlardan (tanlanmagan bo'lsa —
              hammadan) kartaga chiqadiganlar. */}
          {anyPlastik && (
            <button
              onClick={openKartaConfirm}
              disabled={!!payoutBlockedReason}
              title={payoutBlockedReason || t("Faqat karta qismi chiqariladi — naqd qismi «Qolgan» ustunida qoladi")}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/15 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CreditCard className="w-4 h-4" />
              {t("Faqat kartani chiqarish")}
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-sky-500/15 text-[11px] font-bold tabular-nums">
                {kartaRows.length}
              </span>
            </button>
          )}
          <button
            onClick={openConfirm}
            disabled={!!payoutBlockedReason}
            title={
              payoutBlockedReason
              || (selectedCount === 0 ? t("Avval jadvaldan xodimlarni belgilang — chap tomondagi katakchalar") : undefined)
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
              // "O'tgan oydan" 0 bo'lsa aytilmaydi (04.10.2026): musbat qismi
              // endi faqat nol-yopishdan keyingi oyda bo'ladi, oktabrdan
              // boshlab doim "0 so'm" chiqib, pastdagi "o'tgan oylarda
              // to'lanmagan: X — o'z oyidan" izohi bilan zid o'qilardi.
              : stats.otganOydan !== 0
                ? stats.qarzdorlik > 0
                  ? t("o'tgan oydan: {otganOydan} · xodim qarzi: {qarzdorlik}", { otganOydan: fmtSum(stats.otganOydan), qarzdorlik: fmtSum(stats.qarzdorlik) })
                  : t("shu jumladan o'tgan oydan: {otganOydan}", { otganOydan: fmtSum(stats.otganOydan) })
                : stats.qarzdorlik > 0
                  ? t("xodim qarzi: {qarzdorlik}", { qarzdorlik: fmtSum(stats.qarzdorlik) })
                  : t("faqat shu oy hisobidan")
          }
          title={
            ((anyPlastik
              ? t("Kartaga {kartaga} — qoldiqdan birinchi, plastik summasigacha.", { kartaga: fmtSum(stats.kartaga) }) +
                t(" Naqd {naqd} — kartadan keyin xodimlarga qo'lga beriladigani (jadvaldagi \"Qolgan\" ustuni).", { naqd: fmtSum(stats.naqd) }) +
                (stats.otganOydan !== 0 ? t(" Shu jumladan o'tgan oydan: {otganOydan}.", { otganOydan: fmtSum(stats.otganOydan) }) : "")
              : "") +
              (stats.pending > 0
                ? t(" O'tgan oylarda to'lanmagan {amount} bu summaga kirmaydi — har oyniki o'z oyining sahifasidan chiqariladi: {list}.", {
                    amount: fmtSum(stats.pending),
                    list: stats.pendingMonths.map((pm) => `${pendingMonthLabel(pm.month)} ${fmtNum(pm.amount)}`).join(", "),
                  })
                : "")
            ).trim() || undefined
          }
          // O'TGAN OYLARDA TO'LANMAGAN (04.10.2026) — yuqoridagi summaga
          // KIRMAYDI; har oy nomi tugma: bosilsa oy tanlagichi o'sha oyga
          // o'tadi va pul o'sha sahifadan chiqariladi.
          note={
            stats.pending > 0 || stats.maybePaid > 0 ? (
              <>
                {stats.pending > 0 && t("o'tgan oylarda to'lanmagan: {amount} — o'z oyidan", { amount: fmtNum(stats.pending) })}
                {stats.pendingMonths.map((pm) => (
                  <button
                    key={pm.month}
                    type="button"
                    onClick={() => changeMonth(pm.month)}
                    title={t("{month} oyiga o'tish — to'lanmagan {amount} o'sha sahifadan chiqariladi", {
                      month: pendingMonthLabel(pm.month),
                      amount: fmtSum(pm.amount),
                    })}
                    className="ml-1.5 inline-flex items-center gap-0.5 font-medium underline underline-offset-2 hover:no-underline"
                  >
                    {pendingMonthLabel(pm.month)}
                    <ArrowRight className="w-3 h-3" />
                  </button>
                ))}
                {/* O'tish davri: pending'ning shu oyda shu oy yozuvi bo'lib
                    berilgan bo'lishi mumkin qismi — o'sha oy sahifasiga
                    yo'naltirilmaydi (04.10.2026). */}
                {stats.maybePaid > 0 && (
                  <span className="block text-rose-600 dark:text-rose-400">
                    {t("{amount} ehtimol shu oyda berilgan — o'z oyidan qayta chiqarmang", { amount: fmtNum(stats.maybePaid) })}
                  </span>
                )}
              </>
            ) : undefined
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
                <th
                  className="text-right px-3 py-3 whitespace-nowrap"
                  title={t("Shu oyda to'lanadigan o'tgan oy qoldig'i: yopilgan oy ulushi yoki qarzdorlik (manfiy). O'tgan oylarning to'lanmagan qoldig'i ostida faqat ma'lumot — u o'z oyining sahifasidan chiqariladi.")}
                >
                  {t("O'tgan oydan")}
                </th>
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
                // O'TISH DAVRI QOROVULI (04.10.2026, lib/salary.ts →
                // payrollPendingMaybePaid): pending oy puli shu oyda shu oy
                // yozuvi bo'lib berilgan bo'lishi mumkin bo'lsa — "o'sha oy
                // sahifasidan chiqariladi" tugmasi o'rniga ogohlantirish.
                const maybePaid = pendingMaybePaidByMonth(e, period);
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
                // ISHDAN KETISH SANASI. SHU (yoki oldingi) oyda bo'lsa — oklad
                // shu kungacha. Sana HALI KELMAGAN bo'lsa «ishdan ketadigan
                // sana» (13.10.2026, foydalanuvchi: kelajak sana tanlansa shunday
                // tursin) va u joriy/keyingi oy sahifasida, boshqa oyda bo'lsa
                // ham ko'rinadi — xodim ketishini admin oldindan bilsin.
                // Foizli xodimda ham ko'rsatiladi (ilgari faqat okladli).
                const endFuture = isFutureIsoDay(e.salaryEnd, todayIso);
                const endNote = e.salaryEnd && (payrollEndsInPeriod(e, period) || (endFuture && !isPastMonth))
                  ? endFuture
                    ? t("ishdan ketadigan sana: {date}", { date: fmtIsoDay(e.salaryEnd) })
                    : t("ishdan ketgan sana: {date}", { date: fmtIsoDay(e.salaryEnd) })
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
                      {/* Ketgan (arxivdagi) xodim — faqat ishdan ketgan oyigacha ro'yxatda. */}
                      {e.archived && (
                        <span className="ml-1.5 inline-flex h-5 items-center rounded-md border border-rose-500/20 bg-rose-500/10 px-1.5 text-[10.5px] font-medium text-rose-600">
                          {t("arxivda")}
                        </span>
                      )}
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
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span>{formula}</span>
                            {/* USTOZ ALMASHUVI — faqat foiz qismi bor o'qituvchida
                                (to'lovlari ustoz nomi bo'yicha bo'linadi). */}
                            {!isMixed && isFoiz && (
                              <button
                                type="button"
                                onClick={() => setHandoverFor(e.name)}
                                title={t("Ustoz almashuvi — oy o'rtasida o'quvchilar boshqa ustozga o'tgan bo'lsa")}
                                aria-label={t("Ustoz almashuvi")}
                                className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-primary"
                              >
                                <ArrowLeftRight className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          {foizLine && (
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <span>{foizLine}</span>
                              <button
                                type="button"
                                onClick={() => setHandoverFor(e.name)}
                                title={t("Ustoz almashuvi — oy o'rtasida o'quvchilar boshqa ustozga o'tgan bo'lsa")}
                                aria-label={t("Ustoz almashuvi")}
                                className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-primary"
                              >
                                <ArrowLeftRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                          {/* ESLATMA — o'quvchilari shu fanda boshqa ustoz guruhida,
                              almashuv esa kiritilmagan (lib/teacherHandoverStore.ts). */}
                          {e.movedHint && (
                            <button
                              type="button"
                              onClick={() => setHandoverFor(e.name)}
                              className="block text-left text-[11px] text-amber-600 hover:underline whitespace-nowrap"
                              title={t("Bosing — ustoz almashuvini kiritish yoki eslatmani yashirish")}
                            >
                              {t("⚠ {n} ta o'quvchisi endi {teachers} guruhida — ustoz almashuvini kiriting", {
                                n: e.movedHint.count,
                                teachers: e.movedHint.teachers.join(", "),
                              })}
                            </button>
                          )}
                          {/* Almashuv izohi — `collected` allaqachon bo'lingan. */}
                          {(e.handovers ?? []).map((h, hi) => (
                            <div key={hi} className="text-[11px] text-violet-600 dark:text-violet-400 whitespace-nowrap">
                              {h.dir === "out"
                                ? t(h.unit === "lessons"
                                    ? "{date} gacha ({days}/{daysIn} dars) · {amount} tushum → {other}"
                                    : "{date} gacha ({days}/{daysIn} kun) · {amount} tushum → {other}", {
                                    date: fmtIsoDay(h.lastDay),
                                    days: h.days,
                                    daysIn: h.daysIn,
                                    amount: fmtNum(h.amount),
                                    other: h.other || t("hech kimga"),
                                  })
                                : t(h.unit === "lessons"
                                    ? "+{amount} tushum — {other}dan ({days}/{daysIn} dars)"
                                    : "+{amount} tushum — {other}dan ({days}/{daysIn} kun)", {
                                    amount: fmtNum(h.amount),
                                    other: h.other,
                                    days: h.days,
                                    daysIn: h.daysIn,
                                  })}
                            </div>
                          ))}
                          {startNote && (
                            <div className="text-[11px] text-muted-foreground whitespace-nowrap">{startNote}</div>
                          )}
                          {endNote && (
                            <div className={`text-[11px] whitespace-nowrap ${endFuture ? "text-amber-600" : "text-rose-600"}`}>{endNote}</div>
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
                            {/* Shu oy kartaga allaqachon chiqqani («Faqat
                                kartani chiqarish» yoki kassadan plastik) —
                                ustundagi 0 "karta yo'q" deb o'qilmasin. */}
                            {e.paidPlastik > 0 && (
                              <div className="text-[11px] text-emerald-600">{t("{paidPlastik} to'landi", { paidPlastik: fmtNum(e.paidPlastik) })}</div>
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
                        (o'tgan oyda ortiqcha olgan pul). 04.10.2026 dan
                        bu raqam faqat SHU OYDA to'lanadigan qism (musbati
                        faqat nol-yopish oyidan). O'tgan oyning to'lanmagan
                        qoldig'i ostida sariq MA'LUMOT bo'lib turadi va
                        "Qolgan"ga kirmaydi — bosilsa o'sha oy sahifasiga
                        o'tiladi, pul o'sha yerdan chiqariladi. */}
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
                      {(e.carryPendingMonths ?? []).map((pm) => {
                        // Shu oyda ORTIQCHA OYLIK bor va u shu pending oy
                        // puli bo'lishi mumkin — o'sha sahifaga YO'NALTIRILMAYDI
                        // (u yerda yana chiqarilsa ikki marta to'lanadi).
                        const covered = maybePaid.find((x) => x.month === pm.month)?.amount ?? 0;
                        if (covered > 0) {
                          return (
                            <div
                              key={pm.month}
                              title={t("{month} qoldig'idan {amount} {current} oyida {current} yozuvi bo'lib berilgan bo'lishi mumkin — shu oyda ortiqcha oylik bor. {month} sahifasidan qayta chiqarmang: avval o'sha yozuvning oyini tekshiring.", {
                                month: pendingMonthLabel(pm.month),
                                amount: fmtSum(covered),
                                current: pendingMonthLabel(monthKey),
                              })}
                              className="mt-1 text-right text-[11px] leading-tight text-rose-600 dark:text-rose-400 cursor-help"
                            >
                              <span className="block font-medium">{`${pendingMonthLabel(pm.month)}: ${fmtNum(pm.amount)}`}</span>
                              <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[11px] font-medium leading-none text-rose-600 dark:text-rose-400 cursor-help whitespace-nowrap">⚠ {t("Qayta chiqarmang")}</span>
                            </div>
                          );
                        }
                        return (
                          <button
                            key={pm.month}
                            type="button"
                            onClick={() => changeMonth(pm.month)}
                            title={t("{month} oyidan to'lanmagan {amount} — bu oyda to'lanmaydi, faqat {month} sahifasidan chiqariladi. Bosing: {month} oyiga o'tish.", {
                              month: pendingMonthLabel(pm.month),
                              amount: fmtSum(pm.amount),
                            })}
                            className="mt-1 block w-full text-right text-[11px] leading-tight text-amber-600 dark:text-amber-500 hover:underline"
                          >
                            <span className="block font-medium">{`${pendingMonthLabel(pm.month)}: ${fmtNum(pm.amount)}`}</span>
                            <span className="inline-flex items-center gap-0.5 opacity-80">
                              {t("{month} sahifasidan chiqariladi", { month: pendingMonthLabel(pm.month) })}
                              <ArrowRight className="w-3 h-3" />
                            </span>
                          </button>
                        );
                      })}
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
                      {/* O'TGAN OY sahifasida: shu "Qolgan"ning bir qismi
                          joriy oyda joriy oy yozuvi bo'lib berilgan bo'lishi
                          mumkin (04.10.2026, `maybePaidIn` — o'tish davri
                          qorovuli). Raqam o'zgarmaydi, faqat ogohlantiriladi. */}
                      {/* QISQA BELGI (04.10.2026): uzun matn tor ustunda 7 qatorga
                          cho'zilardi — to'liq izoh sichqoncha ostida (title). */}
                      {e.configured && e.maybePaidIn && (
                        <div className="mt-1">
                        <span
                          className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[11px] font-medium leading-none text-rose-600 dark:text-rose-400 cursor-help whitespace-nowrap"
                          title={t("Shu oy qoldig'idan {amount} {month} oyida {month} yozuvi bo'lib berilgan bo'lishi mumkin — u yerda shuncha ortiqcha oylik bor. Qayta chiqarilsa xodim uni ikki marta oladi: avval o'sha yozuvning oyini tekshiring.", {
                            amount: fmtSum(e.maybePaidIn.amount),
                            month: pendingMonthLabel(e.maybePaidIn.month),
                          })}
                        >
                          ⚠ {t("Qayta chiqarmang")}
                        </span>
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

      {handoverFor && (
        <TeacherHandoverModal
          teacher={handoverFor}
          month={monthKey}
          monthLabel={monthLabel}
          onClose={() => setHandoverFor(null)}
          onSaved={load}
        />
      )}

      {confirmOpen && (
        <Modal onClose={() => { setConfirmOpen(false); setKartaOnly(false); }} locked={saving} bare zIndex={110} panelClassName="p-6">{(modal) => (<>
            {/* QAYSI OY — tasdiqlash oynasida ko'rinishi SHART: o'tgan oy
                tanlangan holda tugma bosilsa, pul boshqa oyning hisobiga
                chiqadi va buni keyin faqat chiqarishni o'chirib qaytarish
                mumkin. */}
            <p className="text-center text-[15px] font-semibold">
              {kartaOnly
                ? t("{monthLabel} — {count} ta xodimning karta qismi chiqariladi", { monthLabel, count: kartaRows.length })
                : t("{monthLabel} — {selectedCount} ta xodim uchun oylik chiqariladi", { monthLabel, selectedCount })}
            </p>
            <p className="text-center text-[12.5px] text-muted-foreground mt-1">
              {kartaOnly
                ? t("Faqat karta (plastik) qismi. Naqd qismi «Qolgan» ustunida qoladi — keyin «Oylikni chiqarish» yoki kassadan beriladi.")
                : t("Pul tanlangan kassadan chiqadi va Tranzaksiyalar jurnaliga yoziladi.")}
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

              {!kartaOnly && (<div>
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
              </div>)}

              {/* PLASTIK oyog'i — faqat kartaga pul ketadigan bo'lsa
                  ko'rinadi. Plastigi yo'q xodimlar bilan ishlaganda oyna
                  bugungidek bitta tanlov bilan qoladi. */}
              {(kartaOnly || plastikTotal > 0) && (
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
              {/* «Faqat karta»: KIMGA qancha ketishi ro'yxati — tanlov
                  bo'sh bo'lsa ro'yxatdagi hamma kartasi borlar olinadi,
                  shuning uchun tasdiqdan oldin ismlar ko'rinib tursin. */}
              {kartaOnly ? (
                <div className="rounded-lg border border-border bg-secondary/20 p-3 text-[13px] space-y-1">
                  <div className="max-h-44 overflow-y-auto space-y-0.5 pr-1">
                    {kartaRows.map(({ e, amount }) => (
                      <div key={e.id} className="flex items-center justify-between gap-3">
                        <span className="truncate">{e.name}</span>
                        <span className="tabular-nums text-sky-600">{fmtNum(amount)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-1 mt-1">
                    <span className="text-muted-foreground">{t("Kartaga")}</span>
                    <span className={`font-semibold tabular-nums ${kartaShort > 0 ? "text-rose-600" : ""}`}>
                      {t(fmtSum(kartaTotal))} <span className="font-normal text-muted-foreground">/ {t(fmtSum(plastikAvailable))}</span>
                    </span>
                  </div>
                </div>
              ) : (
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
              )}

              {!kartaOnly && sameMethod && (
                <p className="text-[12.5px] text-rose-600">
                  {t("Plastik va naqd uchun bir xil to'lov turi tanlangan — birini o'zgartiring, aks holda jurnalda ikki qism ajralmay qoladi.")}
                </p>
              )}

              {!kartaOnly && payoutTotal === 0 && (
                <p className="text-[12.5px] text-amber-600">
                  {t("Tanlangan xodimlarda to'lanadigan qoldiq yo'q — oylik allaqachon chiqarilgan yoki qarzdorlik bor.")}
                </p>
              )}
              {/* O'TGAN OYLARDA TO'LANMAGAN qoldiq bu chiqarishga KIRMAYDI
                  (04.10.2026, "faqat o'z oyidan") — bu yerda aytilmasa,
                  u ham shu bilan chiqdi deb o'ylanib, o'sha oy sahifasida
                  ochiq qolib ketardi. */}
              {!kartaOnly && selectedPendingTotal > 0 && (
                <p className="text-[12.5px] text-amber-600 dark:text-amber-500">
                  {t("Tanlanganlarning o'tgan oylardan to'lanmagan {amount} qoldig'i bu summaga kirmaydi — u {months} sahifasidan chiqariladi.", {
                    amount: fmtSum(selectedPendingTotal),
                    months: selectedPending.map((pm) => pendingMonthLabel(pm.month)).join(", "),
                  })}
                </p>
              )}
              {/* O'TGAN OY sahifasi: bu oy puli joriy oyda allaqachon berilgan
                  bo'lishi mumkin bo'lgan tanlanganlar (04.10.2026, o'tish
                  davri qorovuli) — chiqarilsa xodim ikki marta oladi. */}
              {!kartaOnly && selectedMaybePaid.length > 0 && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-700 dark:text-rose-300">
                  {t("{count} ta tanlangan xodimda bu oy puli keyingi oyda allaqachon berilgan bo'lishi mumkin: {list}. Qayta chiqarilsa ikki marta to'lanadi — avval o'sha yozuvlarning oyini tekshiring.", {
                    count: selectedMaybePaid.length,
                    list: selectedMaybePaid
                      .map((e) => `${e.name} — ${fmtNum(e.maybePaidIn!.amount)} (${pendingMonthLabel(e.maybePaidIn!.month)})`)
                      .join(", "),
                  })}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setSelected((prev) => {
                      const next = new Set(prev);
                      for (const e of selectedMaybePaid) next.delete(e.id);
                      return next;
                    })}
                    className="ml-1 font-semibold underline underline-offset-2 hover:no-underline disabled:opacity-50"
                  >
                    {t("Ularni tanlovdan chiqarish")}
                  </button>
                </div>
              )}
              {/* Butun jumla bitta ifodada — JSX ifoda bilan undan keyingi
                  matn orasidagi bo'shliqni yeb qo'yadi (so'mkam bo'lib
                  chiqardi). */}
              {(kartaOnly ? kartaShort > 0 : notEnough) && (
                <p className="text-[12.5px] text-rose-600">
                  {t("Mablag' yetarli emas — {available} kam. Boshqa kassa yoki to'lov turini tanlang.", { available: fmtSum(kartaOnly ? kartaShort : shortfall) })}
                </p>
              )}
              {/* Tugma o'chiq bo'lishining QOLGAN sabablari ham ochiq
                  aytiladi — "Ha, chiqarish" hech qachon izohsiz kulrang
                  turmasin. */}
              {!cashboxesLoading && !cashboxId && (
                <p className="text-[12.5px] text-rose-600">{t("Kassani tanlang")}</p>
              )}
              {!kartaOnly && !methodsLoading && !methodKey && (
                <p className="text-[12.5px] text-rose-600">{t("To'lov turini tanlang")}</p>
              )}
              {(kartaOnly ? !methodsLoading && !plastikMethodKey : needsPlastikMethod) && (
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
                disabled={saving || !(kartaOnly ? canKarta : canPayout)}
                className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? t("Chiqarilmoqda…") : kartaOnly ? t("Ha, kartaga chiqarish") : t("Ha, chiqarish")}
              </button>
            </div>
          </>)}</Modal>
      )}
    </div>
  );
}
