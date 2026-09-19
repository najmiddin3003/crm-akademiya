"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import DatePicker from "@/components/ui/DatePicker";
import { REVENUE_PLAN_STATUSES } from "@/constants/revenuePlan";
import type { TransactionEntry } from "@/lib/transactionEntries";
import type { FinanceContract } from "@/lib/financeContracts";
import { useT } from "@/components/shared/Language";

// Moliya → Tushum rejasi (sidebar: Moliya > Tushum rejasi, href
// /finance-revenue-plan). Sof hisobot sahifasi (add/edit/delete yo'q) — bitta
// sana + holat (Aktiv/Arxiv/Yangi) filtriga qarab 5 qatorli jamlanma jadval.
// Ikkita HAQIQIY manbadan hisoblanadi:
//   • `finance_contracts` (/api/finance-contracts) — kutilayotgan to'lov
//     (receivables): har shartnoma qismining `date` + `amount`i.
//   • `transaction_entries` (/api/transaction-entries) — haqiqiy to'lovlar
//     (studentName bor payIn yozuvlari).
//
// Qatorlar:
//   1) sana qatori  — shu oyga to'g'ri keladigan shartnoma qismlari yig'indisi
//   2) eski qarzdorlik — oy boshigacha muddati kelgan qismlar yig'indisi,
//      manfiy ishora bilan (referensdagidek)
//   3) eski to'lovlar — oy boshigacha yozilgan to'lovlar
//   4) shu oyda to'langan
//   5) qolgan = (1) + (2) − (3) − (4)   ← referens sahifadagi qiymatlar bilan
//      arifmetik tekshirilgan formula.
//
// DIQQAT: 2- va 3-qatorning biznes-ta'rifi referens saytda hujjatlashtirilmagan,
// shuning uchun mavjud ma'lumotdan eng mantiqiy tarzda olingan — buxgalteriya
// ta'rifi boshqacha bo'lsa shu joyni moslash kerak.
//
// HOLAT (Aktiv/Arxiv) filtri ILGARI O'LIK BOSHQARUV edi: chip tanlanardi,
// lekin hisob-kitobga umuman ta'sir qilmasdi — jadval har doim bir xil
// qolardi. Endi u shartnomaning HAQIQIY `archived` maydoni bo'yicha
// filtrlaydi: "Aktiv" — arxivlanmagan shartnomalar, "Arxiv" — arxivdagilar.
// constants/revenuePlan.js dagi uchinchi variant ("Yangi") ro'yxatdan olib
// tashlandi: `finance_contracts` da shartnomani "yangi" deb belgilaydigan
// maydon yo'q, ya'ni u hech qachon boshqacha natija bera olmasdi.

function fmtDDMMYYYY(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function fmtDotted(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}
function fmtAmount(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(Math.round(n)).toLocaleString("ru-RU");
}
function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function monthRange(d: Date): { start: Date; end: Date } {
  return {
    start: new Date(d.getFullYear(), d.getMonth(), 1),
    end: new Date(d.getFullYear(), d.getMonth() + 1, 1),
  };
}

// Shartnomaning `archived` maydoniga MOS keladigan variantlargina —
// qolgani filtrlay olmaydi (yuqoridagi izohga qarang).
const STATUS_OPTIONS = REVENUE_PLAN_STATUSES.filter((s) => s === "Aktiv" || s === "Arxiv");

export default function RevenuePlanPage() {
  const { t } = useT();
  const [date, setDate] = useState<Date>(() => new Date());
  const [status, setStatus] = useState<string | null>(STATUS_OPTIONS[0]);
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  // To'lov yig'indilari SERVERDA hisoblanadi. Ilgari bu sahifa butun
  // `transaction_entries` ni (25 569 qator, ~11 MB) yuklab, yig'indini
  // brauzerda chiqarardi — holbuki ekranga atigi to'rtta son chiqadi.
  //
  // Aggregation natijasi eski hisob bilan AYNAN bir xil ekani oltita oy
  // bo'yicha tekshirilgan: scripts/_verify-revenue.mjs
  const [summary, setSummary] = useState({
    paidAmount: 0, paidStudents: 0, paidBeforeAmount: 0, paidBeforeStudents: 0,
  });
  const [contracts, setContracts] = useState<FinanceContract[]>([]);

  const range = monthRange(date);
  const otherStatuses = STATUS_OPTIONS.filter((s) => s !== status);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/finance-contracts")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setContracts(d.contracts); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!statusOpen) return;
    const onDown = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [statusOpen]);

  const startIso = toIso(range.start);
  const endIso = toIso(new Date(range.end.getTime() - 86400000));
  // Oy o'zgarganda qayta so'raladi (shu oy + oy boshigacha bo'lgani).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/transaction-entries/revenue-summary?from=${startIso}&to=${endIso}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        setSummary({
          paidAmount: d.paidAmount,
          paidStudents: d.paidStudents,
          paidBeforeAmount: d.paidBeforeAmount,
          paidBeforeStudents: d.paidBeforeStudents,
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [startIso, endIso]);

  const { paidAmount, paidStudents, paidBeforeAmount, paidBeforeStudents } = summary;

  // Shartnoma qismlari — muddati shu oyda / oy boshigacha. Holat chipi
  // tanlangan bo'lsa faqat mos shartnomalar hisobga olinadi (chip olib
  // tashlansa — hammasi).
  const visibleContracts = contracts.filter((c) => {
    if (status === "Aktiv") return !c.archived;
    if (status === "Arxiv") return c.archived;
    return true;
  });
  const parts = visibleContracts.flatMap((c) =>
    c.parts.map((p) => ({ student: c.studentName, date: p.date, amount: p.amount })),
  );
  const dueThisMonth = parts.filter((p) => p.date && p.date >= startIso && p.date <= endIso);
  const dueBefore = parts.filter((p) => p.date && p.date < startIso);

  const expectedAmount = dueThisMonth.reduce((s, p) => s + p.amount, 0);
  const expectedStudents = new Set(dueThisMonth.map((p) => p.student)).size;
  const debtAmount = dueBefore.reduce((s, p) => s + p.amount, 0);
  const debtStudents = new Set(dueBefore.map((p) => p.student)).size;

  const remaining = expectedAmount - debtAmount - paidBeforeAmount - paidAmount;

  const rows = [
    { label: "__DATE__", students: expectedStudents, amount: expectedAmount },
    { label: t("Eski oydan qarzdor bo'lib o'tgan o'quvchilar summasi"), students: debtStudents, amount: -debtAmount },
    { label: t("Eski oydan o'quvchilar to'lab o'tgan summa"), students: paidBeforeStudents, amount: paidBeforeAmount },
    { label: t("Shu oyda to'lagan summa"), students: paidStudents, amount: paidAmount },
    { label: t("Qolgan kutilayotgan tushum"), students: null as number | null, amount: remaining },
  ];

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <DatePicker value={date} onChange={setDate} />

        <div className="relative" ref={statusRef}>
          <div className="inline-flex items-center h-9 rounded-lg border border-border bg-card pl-1 pr-2 gap-1">
            {status && (
              <span className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
                {status}
                <button type="button" onClick={() => setStatus(null)} className="hover:bg-primary/20 rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button type="button" onClick={() => setStatusOpen((o) => !o)} className="text-muted-foreground hover:text-foreground p-1">
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          {statusOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 w-32 rounded-lg border border-border bg-card shadow-xl overflow-hidden p-1">
              {(status ? otherStatuses : STATUS_OPTIONS).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setStatus(s); setStatusOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-secondary text-[13px]"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="text-[13px] text-muted-foreground tabular-nums">
        {fmtDotted(range.start)} - {fmtDotted(range.end)}
      </div>

      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-4 py-3 whitespace-nowrap">{t("Tushum rejasi")}</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">{t("O'quvchi soni")}</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">{t("Umumiy kutilayotgan summa")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-border/50">
                  <td className="px-4 py-3 text-[13px] font-medium text-primary">{r.label === "__DATE__" ? fmtDDMMYYYY(date) : r.label}</td>
                  <td className="px-4 py-3 text-[13px] tabular-nums">{r.students != null ? r.students.toLocaleString("ru-RU") : ""}</td>
                  <td className="px-4 py-3 text-[13px] tabular-nums">{fmtAmount(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
