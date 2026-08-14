"use client";

import { useMemo, useState } from "react";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { TA_USER_TYPE_LABELS } from "@/constants/turnstile";
import { generateTurnstileLogs } from "@/lib/turnstile";

// Nazorat > Turniket analitikasi (crm-akademiya #view-nazorat-turnstile,
// app.js renderTurnstile() ~line 29112). Manbadagi kabi Foydalanuvchi turi
// va Turi (Kech/Erta/Ikkalasi) — haqiqiy filtrlaydi. Sana oralig'i manbada
// dekorativ tugma edi — bu yerda mavjud DateRangePicker ulanib, standart
// holatda shu oy boshidan bugungacha ko'rsatadi va haqiqatan filtrlaydi
// (Davomat qilinmagan guruhlar sahifasida qo'llangan yondashuv bilan bir xil).

const selectCls = "h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function inRange(date: Date, start: Date | null, end: Date | null): boolean {
  const t = date.getTime();
  if (start && t < new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()) return false;
  if (end && t > new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59).getTime()) return false;
  return true;
}

function Badge({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-rose-700 bg-rose-100">Ha</span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-emerald-700 bg-emerald-100">Yo&apos;q</span>
  );
}

export default function NazoratTurnstilePage() {
  const allLogs = useMemo(() => generateTurnstileLogs(), []);
  const [dateRange, setDateRange] = useState<DateRange>(() => ({ start: startOfMonth(new Date()), end: new Date() }));
  const [userType, setUserType] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const filtered = useMemo(() => {
    return allLogs.filter((r) => {
      if (!inRange(r.date, dateRange.start, dateRange.end)) return false;
      if (userType && r.userType !== userType) return false;
      if (type === "kech" && !(r.lateMin > 0)) return false;
      if (type === "erta" && !(r.earlyEnd > 0)) return false;
      if (type === "ikkalasi" && !(r.lateMin > 0 && r.earlyEnd > 0)) return false;
      return true;
    });
  }, [allLogs, dateRange, userType, type]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  function setFilter(setter: (v: string) => void, v: string) {
    setter(v);
    setPage(1);
  }

  return (
    <div className="page-frame container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      {/* Sarlavha + filtrlar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-[18px] font-semibold tracking-tight">Turniket analitikasi</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker value={dateRange} onChange={(r) => { setDateRange(r); setPage(1); }} placeholder="Oraliqni tanlang" />
          <select value={userType} onChange={(e) => setFilter(setUserType, e.target.value)} className={`${selectCls} w-44`}>
            <option value="">Foydalanuvchi turi</option>
            <option value="oquvchi">O&apos;quvchi</option>
            <option value="moderator">Moderator</option>
            <option value="oqituvchi">O&apos;qituvchi</option>
          </select>
          <select value={type} onChange={(e) => setFilter(setType, e.target.value)} className={`${selectCls} w-32`}>
            <option value="">Turi</option>
            <option value="erta">Erta</option>
            <option value="ikkalasi">Ikkalasi</option>
            <option value="kech">Kech</option>
          </select>
        </div>
      </div>

      {/* Jadval */}
      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>Umumiy soni:</span>
            <span className="tabular-nums">{filtered.length}</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="w-full text-sm min-w-[1800px]">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-3 py-3 text-left w-12">№</th>
                <th className="px-3 py-3 text-left min-w-[180px]">To&apos;liq ismi</th>
                <th className="px-3 py-3 text-left">Foydalanuvchi turi</th>
                <th className="px-3 py-3 text-left">Voqea turi</th>
                <th className="px-3 py-3 text-left">Vaqti</th>
                <th className="px-3 py-3 text-left">Rejalashtirilgan bo...</th>
                <th className="px-3 py-3 text-left">Rejalashtirilgan tu...</th>
                <th className="px-3 py-3 text-center">Kechikish mavjud</th>
                <th className="px-3 py-3 text-right">Kechikish (daq.)</th>
                <th className="px-3 py-3 text-center">Erta ketish mavjud</th>
                <th className="px-3 py-3 text-right">Erta ketish (daq.)</th>
                <th className="px-3 py-3 text-left pr-5">Turniket nomi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slice.map((r, i) => (
                <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-3 py-3 text-muted-foreground tabular-nums">{start + i + 1}</td>
                  <td className="px-3 py-3 font-medium">{r.name}</td>
                  <td className="px-3 py-3 text-[13px]">{TA_USER_TYPE_LABELS[r.userType as keyof typeof TA_USER_TYPE_LABELS]}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${r.eventType === "Kirish" ? "text-emerald-700 bg-emerald-100" : "text-blue-700 bg-blue-100"}`}>{r.eventType}</span>
                  </td>
                  <td className="px-3 py-3 tabular-nums text-[12px] text-muted-foreground">{r.time}</td>
                  <td className="px-3 py-3 tabular-nums text-[13px]">{r.plannedStart}</td>
                  <td className="px-3 py-3 tabular-nums text-[13px]">{r.plannedEnd}</td>
                  <td className="px-3 py-3 text-center"><Badge ok={r.lateMin > 0} /></td>
                  <td className={`px-3 py-3 text-right tabular-nums ${r.lateMin > 0 ? "text-rose-600 font-medium" : "text-muted-foreground"}`}>{r.lateMin}</td>
                  <td className="px-3 py-3 text-center"><Badge ok={r.earlyEnd > 0} /></td>
                  <td className={`px-3 py-3 text-right tabular-nums ${r.earlyEnd > 0 ? "text-rose-600 font-medium" : "text-muted-foreground"}`}>{r.earlyEnd}</td>
                  <td className="px-3 py-3 pr-5 text-[13px] font-mono">{r.turnstile}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {slice.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <div className="h-16 w-16 rounded-2xl bg-secondary/60 flex items-center justify-center mb-4">
              <svg className="icon" style={{ width: 32, height: 32, opacity: 0.45 }}><use href="#i-archive" /></svg>
            </div>
            <h3 className="text-[15px] font-semibold mb-1">Ma&apos;lumotlar topilmadi</h3>
            <p className="text-[13px] text-muted-foreground max-w-sm">Ma&apos;lumotlar topilmadi. Filterni o&apos;zgartirib ko&apos;ring.</p>
          </div>
        )}

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
