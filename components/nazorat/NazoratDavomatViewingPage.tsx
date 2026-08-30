"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import Spinner from "@/components/ui/Spinner";
import { useStudents } from "@/hooks/useStudents";
import type { TurnstileIoRecord } from "@/lib/turnstileIo";
import { dateToIso, isoToLabel } from "./useNazoratAttendance";

// Nazorat > Davomat > "O'quvchilarni davomatini ko'rish" (/nazorat-davomat/viewing).
//
// ILGARI: sahifa hech qachon birorta qator ko'rsatmasdi — `tbody` bo'sh
// teg edi, "Umumiy soni" doim qattiq yozilgan 0 turardi va hech qanday
// fetch yo'q edi. Ya'ni ekran butunlay dekorativ edi.
// HOZIR: kelish/ketish vaqtlari HAQIQIY manbadan — /api/turnstile-io
// (MongoDB `turnstile_io`). O'sha kolleksiya har bir odam uchun kunlik
// birinchi kirish va oxirgi chiqish vaqtini saqlaydi, ya'ni bu jadvalning
// "Kelish sanasi"/"Ketish sanasi" ustunlariga aynan mos keladi.
//
// Faqat o'quvchilar ko'rsatiladi (`personType === "student"`) — sahifa
// nomi ham shuni aytadi; xodimlar Nazorat > Turniket kirish-chiqish
// analitikasi sahifasida ko'rinadi.
//
// OLIB TASHLANGAN: qizil "Hammasi ketdi" tugmasi. Unda onClick yo'q edi va
// turniket yozuvini o'zgartiradigan endpoint ham yo'q (/api/turnstile-io
// faqat GET) — ishlamaydigan tugmani qoldirgandan ko'ra olib tashlash to'g'ri.

type Tab = "keldi" | "ketdi";

export default function NazoratDavomatViewingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId");
  // Faqat s.id va student.name o'qiladi — yengil rejim yetadi.
  const { students, loading: studentsLoading } = useStudents({ light: true });

  const [records, setRecords] = useState<TurnstileIoRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<Tab>("keldi");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/turnstile-io")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setRecords(d.records); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const student = useMemo(
    () => (studentId ? students.find((s) => String(s.id) === studentId) ?? null : null),
    [studentId, students],
  );

  const filtered = useMemo(() => {
    const startIso = dateRange.start ? dateToIso(dateRange.start) : null;
    const endIso = dateRange.end ? dateToIso(dateRange.end) : null;
    // Turniket yozuvida o'quvchining id'si emas, faqat ISMI bor — shuning
    // uchun tanlangan o'quvchi ism bo'yicha solishtiriladi (loyihada
    // moliya yozuvlari ham shu qoida bilan bog'lanadi).
    const wantName = student?.name.trim().toLowerCase() ?? null;
    return records.filter((r) => {
      if (r.personType !== "student") return false;
      if (tab === "keldi" && !r.enterTime) return false;
      if (tab === "ketdi" && !r.exitTime) return false;
      if (startIso && r.date < startIso) return false;
      if (endIso && r.date > endIso) return false;
      if (wantName && r.personName.trim().toLowerCase() !== wantName) return false;
      return true;
    });
  }, [records, tab, dateRange, student]);

  function clearStudent() {
    router.push("/nazorat-davomat/viewing");
  }

  const busy = loading || studentsLoading;

  return (
    <div className="container mx-auto max-w-[1700px] p-4 md:p-5 space-y-4">
      {/* Yuqori qator: holat tablari + filtrlar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("keldi")}
            className="inline-flex items-center h-9 px-6 rounded-md text-sm font-medium transition-colors"
            style={tab === "keldi" ? { background: "#10b981", color: "#fff" } : { background: "#10b98115", color: "#059669" }}
          >
            Keldi
          </button>
          <button
            type="button"
            onClick={() => setTab("ketdi")}
            className="inline-flex items-center h-9 px-6 rounded-md text-sm font-medium transition-colors"
            style={tab === "ketdi" ? { background: "#f43f5e", color: "#fff" } : { background: "#f43f5e15", color: "#e11d48" }}
          >
            Ketdi
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {student ? (
            <div className="relative inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-border bg-card text-sm">
              <span>{student.name}</span>
              <button type="button" onClick={clearStudent} className="h-5 w-5 rounded hover:bg-secondary inline-flex items-center justify-center text-muted-foreground">
                <X className="icon icon-xs" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <select
                defaultValue=""
                onChange={(e) => e.target.value && router.push(`/nazorat-davomat/viewing?studentId=${e.target.value}`)}
                className="filter-select h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">O&apos;quvchi</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
            </div>
          )}
          <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Oraliqni tanlang" />
        </div>
      </div>

      {/* Jadval */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>Umumiy soni:</span>
            <span className="tabular-nums">{filtered.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/20">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                <th className="px-5 py-3 text-left">ID</th>
                <th className="px-5 py-3 text-left">To&apos;liq ismi</th>
                <th className="px-5 py-3 text-left">Kelish sanasi</th>
                <th className="px-5 py-3 text-left">Ketish sanasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r, i) => (
                <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="px-5 py-3 text-[12px] font-mono text-muted-foreground">{r.id}</td>
                  <td className="px-5 py-3 font-medium">{r.personName}</td>
                  <td className="px-5 py-3 tabular-nums text-[13px]">
                    {r.enterTime ? `${isoToLabel(r.date)} | ${r.enterTime}` : "—"}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-[13px]">
                    {r.exitTime ? `${isoToLabel(r.date)} | ${r.exitTime}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bo'sh holat */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <div className="h-16 w-16 rounded-2xl bg-secondary/60 flex items-center justify-center mb-4">
              <svg className="icon" style={{ width: 32, height: 32, opacity: 0.45 }}><use href="#i-archive" /></svg>
            </div>
            <h3 className="text-[15px] font-semibold mb-1">
              {busy ? <Spinner size={22} /> : "Ma'lumotlar topilmadi"}
            </h3>
            {!busy && (
              <p className="text-[13px] text-muted-foreground max-w-sm">
                Ma&apos;lumotlar topilmadi. Filterni o&apos;zgartirib ko&apos;ring.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
