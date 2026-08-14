"use client";

import { useMemo, useState } from "react";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { SR_TEACHERS, SR_STUDENTS, SR_COURSES, SR_ALL_GROUPS, SR_RATING_OPTIONS } from "@/constants/staffRating";
import { STAFF_RATINGS } from "@/lib/staffRating";

// Nazorat > Xodimlar reytingi (crm-akademiya #view-nazorat-staff-rating,
// app.js renderStaffRating() ~line 28751). Manbadagi kabi Izoh/Guruh/Kurs/
// O'qituvchi/Reyting — haqiqiy filtrlaydi; "Oraliqni tanlang" va O'quvchi
// tanlagichi manbada ham dekorativ edi (id/onchange yo'q) — shu holicha
// qoldirildi. Guruh ro'yxati manbadagidan farqli — u faqat "Ingliz tili"
// guruhlarini ko'rsatgan edi (kod xatosi), bu yerda barcha kurslarning
// guruhlari qo'shildi, shunda filtr haqiqatan ham to'liq ishlaydi.

const selectCls = "h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

function StarIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="#facc15">
      <polygon points="10,1.5 12.6,7.4 19,8.2 14.2,12.5 15.6,18.8 10,15.5 4.4,18.8 5.8,12.5 1,8.2 7.4,7.4" />
    </svg>
  );
}

export default function NazoratStaffRatingPage() {
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [izoh, setIzoh] = useState("");
  const [group, setGroup] = useState("");
  const [course, setCourse] = useState("");
  const [teacher, setTeacher] = useState("");
  const [rating, setRating] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const filtered = useMemo(() => {
    return STAFF_RATINGS.filter((r) => {
      if (izoh === "hasNote" && !r.izoh) return false;
      if (izoh === "noNote" && r.izoh) return false;
      if (group && r.group !== group) return false;
      if (course && r.course !== course) return false;
      if (teacher && r.teacher !== teacher) return false;
      if (rating && r.rating !== Number(rating)) return false;
      return true;
    });
  }, [izoh, group, course, teacher, rating]);

  const avg = filtered.length > 0 ? (filtered.reduce((s, r) => s + r.rating, 0) / filtered.length).toFixed(1) : "0.0";
  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  function setFilter(setter: (v: string) => void, v: string) {
    setter(v);
    setPage(1);
  }

  return (
    <div className="page-frame container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      {/* Filtrlar */}
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Oraliqni tanlang" />
        <select value={izoh} onChange={(e) => setFilter(setIzoh, e.target.value)} className={`${selectCls} w-28`}>
          <option value="">Izoh</option>
          <option value="hasNote">Izoh bor</option>
          <option value="noNote">Izohsiz</option>
        </select>
        <select value={group} onChange={(e) => setFilter(setGroup, e.target.value)} className={`${selectCls} w-36`}>
          <option value="">Guruh</option>
          {SR_ALL_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={course} onChange={(e) => setFilter(setCourse, e.target.value)} className={`${selectCls} w-32`}>
          <option value="">Kurs</option>
          {SR_COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={teacher} onChange={(e) => setFilter(setTeacher, e.target.value)} className={`${selectCls} w-44`}>
          <option value="">O&apos;qituvchi</option>
          {SR_TEACHERS.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
        </select>
        <select defaultValue="" className={`${selectCls} w-32`}>
          <option value="">O&apos;quvchi</option>
          {SR_STUDENTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={rating} onChange={(e) => setFilter(setRating, e.target.value)} className={`${selectCls} w-28`}>
          <option value="">Reyting</option>
          {SR_RATING_OPTIONS.map((r) => <option key={r} value={r}>{r} ⭐</option>)}
        </select>
      </div>

      {/* O'rtacha reyting */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">O&apos;rtacha reyting:</span>
        <span className="inline-flex items-center gap-1.5 font-bold tabular-nums">
          <span>{avg}</span>
          <StarIcon />
        </span>
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
          <table className="w-full text-sm min-w-[1400px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                <th className="px-5 py-3 text-left">O&apos;qituvchi</th>
                <th className="px-5 py-3 text-left">O&apos;quvchi</th>
                <th className="px-5 py-3 text-left">Kurs</th>
                <th className="px-5 py-3 text-left">Guruh</th>
                <th className="px-5 py-3 text-left">Dars sanasi</th>
                <th className="px-5 py-3 text-left">Izoh</th>
                <th className="px-5 py-3 text-left">Sana</th>
                <th className="px-5 py-3 text-center pr-5">Baho</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slice.map((r, i) => (
                <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{start + i + 1}</td>
                  <td className="px-5 py-3 font-medium">{r.teacher}</td>
                  <td className="px-5 py-3 text-[13px]">{r.student}</td>
                  <td className="px-5 py-3 text-[13px]">{r.course}</td>
                  <td className="px-5 py-3 text-[13px] font-mono">{r.group}</td>
                  <td className="px-5 py-3 tabular-nums text-[13px] text-muted-foreground">{r.lessonDate}</td>
                  <td className="px-5 py-3 text-[13px]">{r.izoh || "-"}</td>
                  <td className="px-5 py-3 tabular-nums text-[13px] text-muted-foreground">{r.ratingDate}</td>
                  <td className="px-5 py-3 pr-5 text-center">
                    <div className="inline-flex flex-col items-center gap-0.5">
                      <StarIcon />
                      <span className="text-[12px] font-semibold tabular-nums">{r.rating}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-muted-foreground">Ma&apos;lumotlar topilmadi</td>
                </tr>
              )}
            </tbody>
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
