"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, MoreVertical, Archive, MessageSquare } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import {
  DAVOMAT_STUDENTS,
  DAVOMAT_DAYS,
  DAVOMAT_STATES,
  DAVOMAT_MODERATORS,
  DAVOMAT_TEACHERS,
  DAVOMAT_REASONS,
  DAVOMAT_GROUPS,
  DAVOMAT_GROUP_STATUSES,
} from "@/constants/davomat";
import { formatDavomatBalance, type DavomatStudent } from "@/lib/davomat";

// Nazorat > Davomat (crm-akademiya #view-nazorat-davomat, app.js renderDavomat()
// ~line 28324). "O'quvchilarni davomatini ko'rish" tugmasi/qatorga bosish
// /nazorat-davomat/viewing sahifasini ochadi (#view-nazorat-davomat-view).
// Manba kabi faqat Holat va Qidirish filtri haqiqiy filtrlaydi — Kun,
// Ranglar bo'yicha, Moderator, O'qituvchi, Sababi, Guruh, holat va sanalar
// manbada ham `renderDavomat()`ni qayta chaqiradi-yu, natijaga ta'sir
// qilmaydi (ataylab shunday qoldirilgan — ko'rinishi uchun saqlandi).

const selectCls = "filter-select h-10 w-full appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

function SelectWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
    </div>
  );
}

export default function NazoratDavomatPage() {
  const router = useRouter();
  const [day, setDay] = useState("");
  const [state, setState] = useState("attended");
  const [moderator, setModerator] = useState("");
  const [teacher, setTeacher] = useState("");
  const [reason, setReason] = useState("");
  const [group, setGroup] = useState("");
  const [groupStatus, setGroupStatus] = useState("");
  const [date, setDate] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return (DAVOMAT_STUDENTS as DavomatStudent[]).filter((s) => {
      if (s.state !== state) return false;
      if (q && !(s.name.toLowerCase().includes(q) || s.phone.includes(q) || s.ident.includes(q))) return false;
      return true;
    });
  }, [state, search]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);
  const pageIds = slice.map((s) => s.id);
  const allPageChecked = pageIds.length > 0 && pageIds.every((id) => checked.has(id));

  function toggleAll(v: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) {
        if (v) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }
  function toggleRow(id: number, v: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (v) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <div className="container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      {/* Header qatori */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/nazorat-davomat/viewing"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
        >
          <Eye className="icon icon-sm" />
          <span>O&apos;quvchilarni davomatini ko&apos;rish</span>
        </Link>
        <button type="button" className="h-10 w-10 rounded-lg hover:bg-secondary inline-flex items-center justify-center" title="Amallar">
          <MoreVertical className="icon icon-sm" />
        </button>
      </div>

      {/* Filtrlar 1 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        <SelectWrap>
          <select value={day} onChange={(e) => setDay(e.target.value)} className={selectCls}>
            <option value="">Kun</option>
            {DAVOMAT_DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </SelectWrap>
        <SelectWrap>
          <select value={state} onChange={(e) => { setState(e.target.value); setPage(1); }} className={selectCls}>
            {DAVOMAT_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </SelectWrap>
        <SelectWrap>
          <select className={selectCls} defaultValue="">
            <option value="">Ranglar bo&apos;yicha</option>
          </select>
        </SelectWrap>
        <SelectWrap>
          <select value={moderator} onChange={(e) => setModerator(e.target.value)} className={selectCls}>
            <option value="">Moderator</option>
            {DAVOMAT_MODERATORS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </SelectWrap>
        <SelectWrap>
          <select value={teacher} onChange={(e) => setTeacher(e.target.value)} className={selectCls}>
            <option value="">O&apos;qituvchi</option>
            {DAVOMAT_TEACHERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </SelectWrap>
      </div>

      {/* Filtrlar 2 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        <SelectWrap>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={selectCls}>
            <option value="">Sababi</option>
            {DAVOMAT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </SelectWrap>
        <SelectWrap>
          <select value={group} onChange={(e) => setGroup(e.target.value)} className={selectCls}>
            <option value="">Guruh</option>
            {DAVOMAT_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </SelectWrap>
        <SelectWrap>
          <select value={groupStatus} onChange={(e) => setGroupStatus(e.target.value)} className={selectCls}>
            <option value="">O&apos;quvchini guruhdagi holati</option>
            {DAVOMAT_GROUP_STATUSES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </SelectWrap>
        <div className="relative">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <svg className="icon icon-xs pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-calendar" /></svg>
          {date && (
            <button type="button" onClick={() => setDate("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <svg className="icon icon-xs"><use href="#i-x-circle" /></svg>
            </button>
          )}
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Oraliqni tanlang" />
      </div>

      {/* Qidirish */}
      <div className="relative max-w-md">
        <svg className="icon icon-sm pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-search" /></svg>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          type="text"
          placeholder="Qidirish"
          className="h-10 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
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
          <table className="w-full text-sm min-w-[1300px]">
            <thead className="bg-secondary/20">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-10">
                  <input type="checkbox" checked={allPageChecked} onChange={(e) => toggleAll(e.target.checked)} className="w-4 h-4 rounded border-border accent-primary" />
                </th>
                <th className="px-3 py-3 text-left w-12">№</th>
                <th className="px-3 py-3 text-left">ID</th>
                <th className="px-3 py-3 text-left">O&apos;quvchini ismi</th>
                <th className="px-3 py-3 text-left">Telefon raqam</th>
                <th className="px-3 py-3 text-right">Balans</th>
                <th className="px-3 py-3 text-left">Guruh</th>
                <th className="px-3 py-3 text-left">O&apos;qituvchi</th>
                <th className="px-3 py-3 text-left">Moderator</th>
                <th className="px-3 py-3 text-left">Sababi</th>
                <th className="px-3 py-3 text-right pr-5">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slice.map((s, i) => (
                <tr
                  key={s.id}
                  onClick={() => router.push(`/nazorat-davomat/viewing?studentId=${s.id}`)}
                  className="hover:bg-secondary/30 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={checked.has(s.id)} onChange={(e) => toggleRow(s.id, e.target.checked)} className="w-4 h-4 rounded border-border accent-primary" />
                  </td>
                  <td className="px-3 py-3 text-muted-foreground tabular-nums">{start + i + 1}</td>
                  <td className="px-3 py-3 text-[12px] font-mono text-muted-foreground">{s.ident}</td>
                  <td className="px-3 py-3 font-medium" onClick={(e) => e.stopPropagation()}>
                    <Link href={`/student-edit/${s.id}`} className="hover:text-primary hover:underline">{s.name}</Link>
                  </td>
                  <td className="px-3 py-3 tabular-nums text-[13px]">{s.phone}</td>
                  <td className={`px-3 py-3 text-right tabular-nums ${s.balance < 0 ? "text-rose-600" : s.balance > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {formatDavomatBalance(s.balance)}
                  </td>
                  <td className="px-3 py-3">{s.group}</td>
                  <td className="px-3 py-3">{s.teacher}</td>
                  <td className="px-3 py-3">{s.moderator}</td>
                  <td className="px-3 py-3 text-[13px]">{s.reason || "-"}</td>
                  <td className="px-3 py-3 text-right pr-5" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1">
                      <button type="button" title="Arxivlash" className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground hover:text-primary">
                        <Archive className="icon icon-xs" />
                      </button>
                      <button type="button" title="Sharh" className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground hover:text-primary">
                        <MessageSquare className="icon icon-xs" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-16 text-center">
                    <div className="flex flex-col items-center">
                      <div className="h-16 w-16 rounded-2xl bg-secondary/60 flex items-center justify-center mb-4">
                        <svg className="icon" style={{ width: 32, height: 32, opacity: 0.45 }}><use href="#i-archive" /></svg>
                      </div>
                      <h3 className="text-[15px] font-semibold mb-1">Ma&apos;lumotlar topilmadi</h3>
                      <p className="text-[13px] text-muted-foreground">Filterni o&apos;zgartirib ko&apos;ring</p>
                    </div>
                  </td>
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
