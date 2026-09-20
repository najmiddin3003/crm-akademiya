"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, MoreVertical } from "lucide-react";
import Link from "@/components/ui/Link";
import Pagination from "@/components/ui/Pagination";
import DateField from "@/components/ui/DateField";
import Segmented from "@/components/ui/Segmented";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import PersonLink from "@/components/shared/PersonDirectory";
import { useT } from "@/components/shared/Language";
import { downloadTableCsv, downloadTableExcel, type Cell } from "@/lib/exportTable";
import { LESSONS_PER_MONTH, type DebtIssue, type DebtorRow, type DebtorsReport } from "@/lib/debtorsTypes";
import { uzDateIso } from "@/lib/uzTime";

// Hisobotlar → Qarzdor o'quvchilar (href /reports-unpaid).
//
// ILGARI bu sahifa `unpaid_students` kolleksiyasidan o'qirdi — uni hech bir
// kod to'ldirmasdi (bo'sh jadval). HOZIR: /api/reports/debtors — guruh jadvali
// bo'yicha o'tgan darslar × bitta dars narxi − to'langan (qoida va manbalar
// lib/debtors.ts da).
//
// Sahifa serverdan a'zoligi bor HAMMA o'quvchini oladi (qarzdor bo'lmaganlar
// ham) va rejimni o'zi almashtiradi: "Qarzdorlar" (qarz > 0, sukut) /
// "Hammasi". Shunda rejim almashganda serverga qayta borilmaydi; ro'yxat
// kichik (bir filialdagi guruh a'zolari).

const HEADERS = ["№", "O'quvchi", "Telefon", "Guruhlar", "Boshlangan", "Darslar", "Hisoblangan", "To'langan", "Qarz"];

/** Guruh bo'yicha hisoblab bo'lmaslik sababi — qisqa yorliq (t() kaliti). */
const ISSUE_LABEL: Record<DebtIssue, string> = {
  price: "narx yo'q",
  start: "boshlanish sanasi yo'q",
  schedule: "dars kunlari yo'q",
};

/** Sahifa tepasidagi ogohlantirish matni va havolasi — sabab bo'yicha. */
const ISSUE_HINT: Record<DebtIssue, { text: string; href: string; link: string }> = {
  price: {
    text: "{n} ta guruh uchun bitta dars narxi topilmadi — ularning darslari summaga kirmadi.",
    href: "/offline-courses",
    link: "Oflayn kurslar bo'limida shu filial uchun narxni kiriting",
  },
  start: {
    text: "{n} ta guruhda boshlanish sanasi yo'q — qachondan sanashni bilib bo'lmaydi.",
    href: "/groups",
    link: "Guruhni tahrirlab \"Boshlanish sanasi\"ni kiriting",
  },
  schedule: {
    text: "{n} ta guruhda dars kunlari tanilmadi — darslar sanalmadi.",
    href: "/groups",
    link: "Guruhni tahrirlab dars kunlarini tanlang",
  },
};

const fmt = (n: number) => n.toLocaleString("ru-RU");

/** "2026-08-24" → "24.08.2026". */
function isoToLabel(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

type Mode = "debtors" | "all";

const MODE_OPTIONS = [
  { value: "debtors", label: "Qarzdorlar" },
  { value: "all", label: "Hammasi" },
];

export default function DebtorsReportPage() {
  const { t } = useT();
  const { showSuccess } = useToast();

  // Hisob sanasi — sukut bugun (Toshkent). Bo'sh qoldirilsa ham bugun.
  const [asOf, setAsOf] = useState(() => uzDateIso());
  const wanted = asOf || uzDateIso();

  // Yuklanish holati ALOHIDA STATE EMAS — javobdagi `asOf` so'ralgan sana
  // bilan solishtiriladi (server so'ralgan `to` ni qaytaradi). Shunda
  // effekt tanasida setState chaqirilmaydi (react-hooks qoidasi) va sana
  // almashganda eski javob "yangi" deb ko'rsatilmaydi.
  const [report, setReport] = useState<DebtorsReport | null>(null);
  const [error, setError] = useState<{ asOf: string; message: string } | null>(null);
  const loading = report?.asOf !== wanted && error?.asOf !== wanted;

  const [mode, setMode] = useState<Mode>("debtors");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reports/debtors?to=${wanted}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.ok) setReport(d as DebtorsReport);
        else setError({ asOf: wanted, message: String(d?.error || "Hisobotni olib bo'lmadi") });
      })
      .catch(() => { if (!cancelled) setError({ asOf: wanted, message: "Hisobotni olib bo'lmadi" }); });
    return () => { cancelled = true; };
  }, [wanted]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);

  // Faqat SO'RALGAN sanaga mos javob ko'rsatiladi — sana almashganda eski
  // jadval o'rniga spinner chiqadi.
  const current = report?.asOf === wanted ? report : null;
  const allRows = useMemo(() => current?.rows ?? [], [current]);
  const debtors = useMemo(() => allRows.filter((r) => r.debt > 0), [allRows]);

  const filtered = useMemo(() => {
    const base = mode === "debtors" ? debtors : allRows;
    const q = search.trim().toLowerCase();
    if (!q) return base;
    const digits = q.replace(/\D/g, "");
    return base.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (digits.length >= 3 && r.phone.replace(/\D/g, "").includes(digits)) ||
        r.groups.some((g) => g.group.toLowerCase().includes(q)),
    );
  }, [allRows, debtors, mode, search]);

  // Jamlanma — HAMMA davomati bor o'quvchi bo'yicha (qidiruvga bog'liq emas):
  // kartalar filialning umumiy holatini ko'rsatadi, jadval esa tanlangan
  // kesimni.
  //
  // IKKI KESIM (foydalanuvchi savoli, 20.09.2026): "Hisoblangan" va
  // "To'langan" HAMMA o'quvchi bo'yicha, "Jami qarz" esa faqat qarzdorlar
  // bo'yicha — shuning uchun Hisoblangan − To'langan ≠ Jami qarz. Farq —
  // oldindan to'laganlarning ortiqcha puli: birovning ortiqchasi boshqaning
  // qarzini yopmaydi. Shu bois "Oldindan to'lagan" ham alohida karta va
  // pastda sof qoldiq formulasi ko'rsatiladi.
  const totals = useMemo(() => {
    const prepaidRows = allRows.filter((r) => r.debt < 0);
    return {
      debtors: debtors.length,
      debt: debtors.reduce((s, r) => s + r.debt, 0),
      prepaidCount: prepaidRows.length,
      prepaid: prepaidRows.reduce((s, r) => s - r.debt, 0),
      charged: allRows.reduce((s, r) => s + r.charged, 0),
      paid: allRows.reduce((s, r) => s + r.paid, 0),
    };
  }, [allRows, debtors]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);
  const footDebt = filtered.reduce((s, r) => s + r.debt, 0);

  /* ---------- Eksport ---------- */

  function exportRows(): Cell[][] {
    return filtered.map((r, i) => [
      i + 1,
      r.name,
      r.phone,
      r.groups.map((g) => `${g.group}: ${g.lessons} × ${g.lessonPrice === null ? "?" : g.lessonPrice}`).join("; "),
      r.startDate ? isoToLabel(r.startDate) : "—",
      r.lessons,
      r.charged,
      r.paid,
      r.debt,
    ]);
  }

  function exportCSV() {
    downloadTableCsv(HEADERS, exportRows(), `qarzdorlar-${wanted}.csv`);
    showSuccess(t("CSV yuklab olindi — {filtered} ta", { filtered: filtered.length }));
    setMoreOpen(false);
  }

  function exportExcel() {
    downloadTableExcel(HEADERS, exportRows(), `qarzdorlar-${wanted}.xls`);
    showSuccess(t("Excel yuklab olindi — {filtered} ta", { filtered: filtered.length }));
    setMoreOpen(false);
  }

  /* ---------- Bo'sh holat matni ---------- */

  let emptyText: string;
  if (error && error.asOf === wanted) emptyText = t(error.message);
  else if (allRows.length === 0) emptyText = t("Hisob sanasigacha guruhlarda dars bo'lmagan yoki guruhlarga o'quvchi qo'shilmagan");
  else if (filtered.length === 0 && !search.trim() && mode === "debtors") emptyText = t("Qarzdor o'quvchi yo'q");
  else emptyText = t("Ma'lumot topilmadi");

  return (
    <div className="page-frame container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      {/* Boshqaruvlar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-muted-foreground whitespace-nowrap">{t("Hisob sanasi")}</span>
          <div className="relative w-[160px]">
            <DateField value={asOf} onChange={(v) => { setAsOf(v); setPage(1); }} variant="form" />
          </div>
        </div>

        <Segmented
          value={mode}
          onChange={(v) => { setMode(v as Mode); setPage(1); }}
          // Segmented yorliqni o'zi t() qiladi.
          options={MODE_OPTIONS}
        />

        <div className="relative flex-1 min-w-[200px] max-w-md">
          <svg className="icon icon-sm pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-search" /></svg>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            type="text"
            placeholder={t("Qidirish")}
            className="h-10 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="flex-1" />

        <div className="relative" ref={moreRef}>
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className="h-10 w-10 rounded-lg hover:bg-secondary inline-flex items-center justify-center"
            title={t("Amallar")}
          >
            <MoreVertical className="icon icon-sm" />
          </button>
          {moreOpen && (
            <div className="absolute top-full right-0 mt-2 z-50 w-60 rounded-xl border border-border bg-card shadow-xl overflow-hidden p-1">
              <button onClick={exportCSV} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">CSV</span>
                <span>{t("CSV faylini yuklab olish")}</span>
              </button>
              <button onClick={exportExcel} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">XLS</span>
                <span>{t("EXCEL faylini yuklab olish")}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="text-[12px] text-muted-foreground">
        {t("Qarz = guruh jadvali bo'yicha boshlangan kundan hisob sanasigacha o'tgan darslar × bitta dars narxi (Oflayn kurslar; oylik ÷ {n}) − to'langan.", { n: LESSONS_PER_MONTH })}
      </p>

      {/* Jamlanma */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Jami qarz", value: fmt(totals.debt), sub: t("{n} ta qarzdor", { n: totals.debtors }), tone: "text-rose-600" },
          { label: "Oldindan to'lagan", value: fmt(totals.prepaid), sub: t("{n} ta o'quvchi", { n: totals.prepaidCount }), tone: "text-emerald-600" },
          { label: "Hisoblangan", value: fmt(totals.charged), sub: t("{n} ta o'quvchi", { n: allRows.length }), tone: "text-foreground" },
          { label: "To'langan", value: fmt(totals.paid), sub: t("{n} ta o'quvchi", { n: allRows.length }), tone: "text-emerald-600" },
          { label: "Sof qoldiq", value: fmt(totals.charged - totals.paid), sub: t("Hisoblangan − To'langan"), tone: totals.charged - totals.paid > 0 ? "text-rose-600" : "text-emerald-600" },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t(c.label)}</p>
            <p className={`mt-1 font-bold tabular-nums text-[22px] ${c.tone}`}>{loading ? "…" : c.value}</p>
            <p className="text-[11px] text-muted-foreground">{loading ? "" : c.sub}</p>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-muted-foreground -mt-2">
        {t("Jami qarz faqat qarzdorlar bo'yicha; oldindan to'laganlarning ortiqcha puli boshqaning qarzini yopmaydi. Sof qoldiq = Jami qarz − Oldindan to'lagan.")}
      </p>

      {/* Hisoblab bo'lmagan guruhlar — summa to'qib chiqarilmaydi, sabab bo'yicha ogohlantiriladi */}
      {current && (Object.keys(ISSUE_HINT) as DebtIssue[]).map((issue) => {
        const list = current.issues.filter((g) => g.issue === issue);
        if (list.length === 0) return null;
        const hint = ISSUE_HINT[issue];
        return (
          <div key={issue} className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-[13px] text-amber-800 dark:text-amber-400 flex gap-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">{t(hint.text, { n: list.length })}</p>
              <p className="mt-1">
                {list.map((g, i) => (
                  <span key={g.groupId}>
                    {i > 0 && ", "}
                    <Link href={`/groups/${g.groupId}`} className="underline hover:text-amber-900 dark:hover:text-amber-300">{g.group}</Link>
                  </span>
                ))}
                {" — "}
                <Link href={hint.href} className="underline hover:text-amber-900 dark:hover:text-amber-300">{t(hint.link)}</Link>
              </p>
            </div>
          </div>
        );
      })}

      {/* Jadval */}
      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>{t("Umumiy soni:")}</span>
            <span className="tabular-nums">{filtered.length}</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-4 py-3 text-left w-12">№</th>
                <th className="px-4 py-3 text-left min-w-[200px]">{t("O'quvchi")}</th>
                <th className="px-4 py-3 text-left min-w-[260px]">{t("Guruhlar")}</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">{t("Boshlangan")}</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">{t("Darslar")}</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">{t("Hisoblangan")}</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">{t("To'langan")}</th>
                <th className="px-4 py-3 text-right whitespace-nowrap pr-5">{t("Qarz")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slice.map((r, i) => (
                <DebtorTr key={r.id} row={r} index={start + i + 1} />
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {loading ? <SpinnerBlock size={22} /> : emptyText}
                  </td>
                </tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-primary/5 border-t border-border font-semibold">
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3">{t("Jami:")}</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(filtered.reduce((s, r) => s + r.lessons, 0))}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(filtered.reduce((s, r) => s + r.charged, 0))}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(filtered.reduce((s, r) => s + r.paid, 0))}</td>
                  {/* "Hammasi" rejimida oldindan to'laganlar manfiy — yig'indi sof qoldiq, rangi ishoraga qarab. */}
                  <td className={`px-4 py-3 pr-5 text-right tabular-nums ${footDebt > 0 ? "text-rose-600" : footDebt < 0 ? "text-emerald-600" : ""}`}>{footDebt < 0 ? `+${fmt(-footDebt)}` : fmt(footDebt)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <Pagination
          totalItems={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>
    </div>
  );
}

function DebtorTr({ row: r, index }: { row: DebtorRow; index: number }) {
  const { t } = useT();
  const debtTone = r.debt > 0 ? "text-rose-600" : r.debt < 0 ? "text-emerald-600" : "text-muted-foreground";
  return (
    <tr className="hover:bg-secondary/30 transition-colors">
      <td className="px-4 py-3 align-top text-muted-foreground tabular-nums">{index}</td>
      <td className="px-4 py-3 align-top">
        {/* ?src=list — bazadagi o'quvchi id'si (buyurtma id'si emas). */}
        <Link href={`/student-edit/${r.id}?src=list`} className="font-medium hover:text-primary hover:underline">
          {r.name}
        </Link>
        {r.status !== "Aktiv" && (
          <span className="ml-2 inline-flex items-center px-1.5 h-5 rounded-md bg-secondary text-[11px] text-muted-foreground align-middle">{t(r.status)}</span>
        )}
        <div className="text-[12px] text-muted-foreground tabular-nums">{r.phone || "—"}</div>
      </td>
      <td className="px-4 py-3 align-top">
        <ul className="space-y-1">
          {r.groups.map((g) => (
            <li key={g.groupId} className="text-[13px]">
              <Link href={`/groups/${g.groupId}`} className="hover:text-primary hover:underline">{g.group}</Link>
              <span className="text-muted-foreground">
                {" · "}
                {g.issues.length > 0 || g.lessonPrice === null ? (
                  <span className="text-amber-600">{g.issues.map((i) => t(ISSUE_LABEL[i])).join(", ")}</span>
                ) : (
                  <span
                    className="tabular-nums"
                    title={t("Oylik ekvivalenti: {monthly} ({price} × {n})", { monthly: fmt(g.lessonPrice * LESSONS_PER_MONTH), price: fmt(g.lessonPrice), n: LESSONS_PER_MONTH })}
                  >
                    {g.startDate ? `${t("{date} dan", { date: isoToLabel(g.startDate) })} · ` : ""}
                    {g.lessons} × {fmt(g.lessonPrice)} = {fmt(g.charged)}
                  </span>
                )}
              </span>
              {g.teacher && (
                <span className="text-[12px] text-muted-foreground">
                  {" · "}
                  <PersonLink name={g.teacher} kind="staff" />
                </span>
              )}
            </li>
          ))}
        </ul>
      </td>
      <td className="px-4 py-3 align-top tabular-nums whitespace-nowrap">{r.startDate ? isoToLabel(r.startDate) : "—"}</td>
      <td className="px-4 py-3 align-top text-right tabular-nums">{r.lessons}</td>
      <td className="px-4 py-3 align-top text-right tabular-nums">
        {fmt(r.charged)}
        {r.incomplete && <span className="ml-1 text-amber-600" title={t("Hisoblab bo'lmagan guruh darslari kirmagan")}>*</span>}
      </td>
      <td className="px-4 py-3 align-top text-right tabular-nums">{fmt(r.paid)}</td>
      <td className={`px-4 py-3 align-top pr-5 text-right tabular-nums font-semibold ${debtTone}`}>
        {r.debt < 0 ? `+${fmt(-r.debt)}` : fmt(r.debt)}
      </td>
    </tr>
  );
}
