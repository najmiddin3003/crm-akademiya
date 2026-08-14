"use client";

import { useEffect, useMemo, useState } from "react";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import type { TransactionEntry } from "@/lib/transactionEntries";
import type { Cashbox } from "@/lib/cashboxes";

// Moliya → Tranzaksiyalar (sidebar: Moliya > Tranzakisyalar, href
// /finance-transactions). Sof jurnal — add/edit/delete yo'q (manba saytida
// ham yo'q edi). Manba saytida 22 979 ta haqiqiy yozuv bor edi; foydalanuvchi
// bilan kelishilgan yengil qamrov — bu yerda ~28 ta demo yozuv (constants/
// transactionEntries.js), lekin BARCHA ustunlar/filtrlar to'liq ishlaydi.
// Har (kassa, to'lov turi) juftligi o'z "oldingi/keyingi miqdor" zanjiriga
// ega — Kassalar sahifasidagi har to'lov usulini alohida hisoblash g'oyasi
// bilan bir xil.

const TX_TYPES = [
  { key: "payIn", label: "Kirim (payIn)" },
  { key: "payOut", label: "Chiqim (payOut)" },
  { key: "transfer", label: "Ko'chirish (transfer)" },
];
const STATUSES = [
  { key: "waiting", label: "Kutilmoqda" },
  { key: "cancelled", label: "Bekor qilingan" },
];

function fmtUZS(n: number | null): string {
  if (n == null) return "—";
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(Math.round(n)).toLocaleString("ru-RU");
}
function fmtDate(e: TransactionEntry): string {
  const [y, m, d] = e.date.split("-");
  return `${d}.${m}.${y} | ${e.time}`;
}

export default function TransactionEntriesPage() {
  const [entries, setEntries] = useState<TransactionEntry[]>([]);
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  const [loading, setLoading] = useState(true);

  const [cashboxId, setCashboxId] = useState("");
  const [txType, setTxType] = useState("");
  const [status, setStatus] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [student, setStudent] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/transaction-entries").then((r) => r.json()),
      fetch("/api/cashboxes").then((r) => r.json()),
    ])
      .then(([tx, cb]) => {
        if (cancelled) return;
        if (tx.ok) setEntries(tx.entries);
        if (cb.ok) setCashboxes(cb.cashboxes);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const studentOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.studentName).filter(Boolean))).sort(),
    [entries],
  );

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (cashboxId && e.cashboxId !== Number(cashboxId)) return false;
      if (txType && e.txType !== txType) return false;
      if (status && e.status !== status) return false;
      if (student && e.studentName !== student) return false;
      if (dateRange.start && e.date < dateRange.start.toISOString().slice(0, 10)) return false;
      if (dateRange.end && e.date > dateRange.end.toISOString().slice(0, 10)) return false;
      return true;
    });
  }, [entries, cashboxId, txType, status, student, dateRange]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  const selectCls = "h-9 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 w-40";

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-3">
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <div className="relative">
          <select value={cashboxId} onChange={(e) => { setCashboxId(e.target.value); setPage(1); }} className={selectCls}>
            <option value="">Kassa</option>
            {cashboxes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>
        <div className="relative">
          <select value={txType} onChange={(e) => { setTxType(e.target.value); setPage(1); }} className={selectCls}>
            <option value="">Turi</option>
            {TX_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>
        <div className="relative">
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={selectCls}>
            <option value="">Holati</option>
            {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>
        <DateRangePicker value={dateRange} onChange={(r) => { setDateRange(r); setPage(1); }} placeholder="Oraliqni tanlang" className="w-52" />
        <div className="w-52">
          <StudentSearchSelect label="" value={student} onChange={(v) => { setStudent(v); setPage(1); }} options={studentOptions} placeholder="O'quvchi" />
        </div>
      </div>

      <div className="flex justify-end">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary/60 text-xs">
          <span className="text-muted-foreground">Umumiy soni:</span>
          <span className="font-bold tabular-nums">{filtered.length}</span>
        </div>
      </div>

      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-3 py-3 whitespace-nowrap w-14">№</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Sana</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">O&apos;quvchi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Miqdori</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Oldingi miqdor</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Keyingi miqdor</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Tranzaksiya turi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Tranzaksiya nomi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">To&apos;lov turi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Guruh</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Dars sanasi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Moderator</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Sababi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Izoh</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Holati</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((e, i) => (
                <tr key={e.id} className={`border-b border-border/50 ${e.status === "cancelled" ? "bg-rose-50" : ""}`}>
                  <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums whitespace-nowrap">{fmtDate(e)}</td>
                  <td className="px-3 py-3 text-[13px] whitespace-nowrap">{e.studentName || "—"}</td>
                  <td className={`px-3 py-3 text-[13px] tabular-nums font-medium ${e.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtUZS(e.amount)}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{fmtUZS(e.before)}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{fmtUZS(e.after)}</td>
                  <td className="px-3 py-3 text-[13px]">{e.txType}</td>
                  <td className="px-3 py-3 text-[13px]">{e.txName || "—"}</td>
                  <td className="px-3 py-3 text-[13px]">{e.paymentType}</td>
                  <td className="px-3 py-3 text-[13px]">{e.group || "—"}</td>
                  <td className="px-3 py-3 text-[13px]">{e.lessonDate || "—"}</td>
                  <td className="px-3 py-3 text-[13px] whitespace-nowrap">{e.moderator}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">{e.reason || "—"}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">{e.note || "—"}</td>
                  <td className="px-3 py-3 text-[13px]">{e.status || "—"}</td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={15} className="px-3 py-10 text-center text-sm text-muted-foreground">{loading ? "Yuklanmoqda…" : "Tranzaksiya topilmadi"}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination totalItems={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      </div>
    </div>
  );
}
