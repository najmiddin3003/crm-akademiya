"use client";

import { useMemo, useState } from "react";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { GROUP_SEED, GROUP_TEACHERS } from "@/constants/groups";
import { OFFLINE_COURSES } from "@/constants/offlineCourses";

// Hisobotlar → O'quv markazga ishlab berilgan (href /reports-served).
// Referensdagi sarlavha: "O'qituvchilar oylik to'lov analitikasi".
//
// Yangi backend YO'Q — mavjud guruhlar (constants/groups.js) va oflayn kurs
// narxlaridan (constants/offlineCourses.js) hisoblanadi:
//   o'qituvchi ishlab bergan summa = Σ (guruh o'quvchilari × kurs narxi)
// Kurs narxi topilmasa, o'sha guruh 0 bilan hisoblanadi (narx jadvalida
// yo'q kurslar bor — masalan "Tarix").

const DIVIDES = [
  { key: "day", label: "Kun", factor: 1 },
  { key: "week", label: "Hafta", factor: 7 },
  { key: "month", label: "Oy", factor: 30 },
] as const;

type DivideKey = (typeof DIVIDES)[number]["key"];

interface SeedGroup {
  course?: string;
  students?: number;
  teacher?: string;
  status?: string;
}
interface SeedCourse {
  name: string;
  branches: { enabled: boolean; price: number }[];
}

const fmtUZS = (n: number) => Math.round(n).toLocaleString("ru-RU") + " UZS";

export default function Page() {
  const [teacher, setTeacher] = useState("");
  const [divide, setDivide] = useState<DivideKey>("day");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const factor = DIVIDES.find((d) => d.key === divide)!.factor;

  // Kurs nomi → bitta dars narxi (yoqilgan filiallar orasidan eng yuqorisi).
  const priceByCourse = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of OFFLINE_COURSES as SeedCourse[]) {
      const prices = c.branches.filter((b) => b.enabled).map((b) => b.price);
      map.set(c.name, prices.length > 0 ? Math.max(...prices) : 0);
    }
    return map;
  }, []);

  const rows = useMemo(() => {
    const byTeacher = new Map<string, { groups: number; students: number; earned: number }>();
    for (const g of GROUP_SEED as SeedGroup[]) {
      if (!g.teacher || g.status !== "active") continue;
      const price = priceByCourse.get(g.course ?? "") ?? 0;
      const students = g.students ?? 0;
      const cur = byTeacher.get(g.teacher) ?? { groups: 0, students: 0, earned: 0 };
      cur.groups += 1;
      cur.students += students;
      cur.earned += students * price * factor;
      byTeacher.set(g.teacher, cur);
    }
    return Array.from(byTeacher.entries())
      .map(([name, v]) => ({ name, ...v }))
      .filter((r) => !teacher || r.name === teacher)
      .sort((a, b) => b.earned - a.earned);
  }, [priceByCourse, factor, teacher]);

  const total = useMemo(() => rows.reduce((s, r) => s + r.earned, 0), [rows]);

  const start = (page - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);

  return (
    <div className="page-frame container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-[18px] font-semibold tracking-tight">O&apos;qituvchilar oylik to&apos;lov analitikasi</h2>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Oraliqni tanlang" />
          <select
            value={teacher}
            onChange={(e) => { setTeacher(e.target.value); setPage(1); }}
            className="h-10 w-52 appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">O&apos;qituvchi</option>
            {(GROUP_TEACHERS as string[]).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="inline-flex items-center rounded-lg border border-border bg-card p-1">
            {DIVIDES.map((d) => (
              <button
                key={d.key}
                onClick={() => setDivide(d.key)}
                className={`h-8 px-4 rounded-md text-sm font-medium ${
                  divide === d.key ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border p-5">
        <div className="text-[13px] text-muted-foreground">Jami ishlab berilgan</div>
        <div className="text-[22px] font-semibold tabular-nums">{fmtUZS(total)}</div>
      </div>

      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>Umumiy soni:</span>
            <span className="tabular-nums">{rows.length}</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                <th className="px-5 py-3 text-left">O&apos;qituvchi</th>
                <th className="px-5 py-3 text-right">Guruhlar</th>
                <th className="px-5 py-3 text-right">O&apos;quvchilar</th>
                <th className="px-5 py-3 text-right pr-5">Ishlab berilgan summa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slice.map((r, i) => (
                <tr key={r.name} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{start + i + 1}</td>
                  <td className="px-5 py-3 font-medium">{r.name}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{r.groups}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{r.students}</td>
                  <td className="px-5 py-3 pr-5 text-right tabular-nums font-medium">{fmtUZS(r.earned)}</td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    Ma&apos;lumot topilmadi
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          totalItems={rows.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>
    </div>
  );
}
