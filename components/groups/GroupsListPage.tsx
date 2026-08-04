"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Plus, X } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import AddGroupModal from "./AddGroupModal";
import type { Group } from "@/lib/groups";
import { GROUP_COURSES, GROUP_DAYS, GROUP_ROOMS, GROUP_TEACHERS } from "@/constants/groups";

// Guruhlar ro'yxati (crm-akademiya #view-groups). SARIQ qator = bugun davomat
// qilinmagan guruh (g.highlighted). QIZIL "Guruh vaqti" = muddati o'tgan
// (g.periodExpired). Ma'lumot /api/groups dan; guruh nomi ustiga bosilsa
// /groups/[id] (detail) ga o'tadi.
const selectCls = "h-9 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

function csvCell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
const HEADERS = ["№", "Guruh nomi", "Kurs", "Darajasi", "Kun", "Dars vaqti", "Guruh vaqti", "O'quvchi", "O'qituvchi", "Xona", "Telegram", "Holati"];

export default function GroupsListPage() {
  const router = useRouter();
  const { showSuccess } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [teacher, setTeacher] = useState("");
  const [course, setCourse] = useState("");
  const [room, setRoom] = useState("");
  const [day, setDay] = useState("");
  const [status, setStatus] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [oddEven, setOddEven] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [moreOpen, setMoreOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/groups")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setGroups(d.groups); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter((g) => {
      if (q && !g.name.toLowerCase().includes(q) && !g.course.toLowerCase().includes(q) && !g.teacher.toLowerCase().includes(q) && !g.room.toLowerCase().includes(q)) return false;
      if (teacher && g.teacher !== teacher) return false;
      if (course && g.course !== course) return false;
      if (room && g.room !== room) return false;
      if (day && g.day !== day) return false;
      if (status && g.status !== status) return false;
      if (oddEven && !g.day.toLowerCase().includes(oddEven.toLowerCase())) return false;
      return true;
    });
  }, [groups, search, teacher, course, room, day, status, oddEven]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);
  const totalStudents = groups.reduce((sum, g) => sum + (g.students || 0), 0);

  function exportRows() {
    return filtered.map((g, i) => [i + 1, g.name, g.course, g.level || "", g.day, g.time, g.period, g.students, g.teacher, g.room, g.telegram || "", g.status]);
  }
  function exportCSV() {
    const csv = [HEADERS, ...exportRows()].map((r) => r.map(csvCell).join(",")).join("\r\n");
    downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), "guruhlar.csv");
    showSuccess(`CSV yuklab olindi — ${filtered.length} ta`);
    setMoreOpen(false);
  }
  function exportExcel() {
    const head = "<tr>" + HEADERS.map((h) => `<th style="background:#dbeafe;color:#1e3a8a;font-weight:bold;border:1px solid #94a3b8;padding:8px 10px;text-align:left;">${h}</th>`).join("") + "</tr>";
    const rows = exportRows().map((r) => "<tr>" + r.map((v) => `<td style="border:1px solid #cbd5e1;padding:6px 10px;">${v}</td>`).join("") + "</tr>").join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;}table{border-collapse:collapse;}</style></head><body><table><thead>${head}</thead><tbody>${rows}</tbody></table></body></html>`;
    downloadBlob(new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" }), "guruhlar.xls");
    showSuccess(`Excel yuklab olindi — ${filtered.length} ta`);
    setMoreOpen(false);
  }

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      {/* i-list sprite (Pagination "qator" ikonkasi uchun) */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <symbol id="i-list" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></symbol>
        </defs>
      </svg>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm">
          <Plus className="icon icon-sm" />
          <span>Qo&apos;shish</span>
        </button>

        <div className="relative">
          <select value={teacher} onChange={(e) => { setTeacher(e.target.value); setPage(1); }} className={`${selectCls} w-36`}>
            <option value="">O&apos;qituvchi</option>
            {GROUP_TEACHERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>

        <div className="inline-flex items-center h-9 rounded-lg border border-border bg-card px-3 gap-1.5 text-sm">
          <span className="text-muted-foreground text-[12px]">Boshlanish vaqti</span>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="bg-transparent outline-none text-[13px] tabular-nums w-16" />
          <button onClick={() => setStartTime("")} className="text-muted-foreground hover:text-foreground" title="Tozalash"><X className="h-3 w-3" /></button>
        </div>
        <div className="inline-flex items-center h-9 rounded-lg border border-border bg-card px-3 gap-1.5 text-sm">
          <span className="text-muted-foreground text-[12px]">Tugash vaqti</span>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="bg-transparent outline-none text-[13px] tabular-nums w-16" />
          <button onClick={() => setEndTime("")} className="text-muted-foreground hover:text-foreground" title="Tozalash"><X className="h-3 w-3" /></button>
        </div>

        <div className="relative">
          <select value={day} onChange={(e) => { setDay(e.target.value); setPage(1); }} className={`${selectCls} w-28`}>
            <option value="">Kun</option>
            {GROUP_DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>
        <div className="relative">
          <select value={course} onChange={(e) => { setCourse(e.target.value); setPage(1); }} className={`${selectCls} w-32`}>
            <option value="">Kurs</option>
            {GROUP_COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>
        <div className="relative">
          <select value={room} onChange={(e) => { setRoom(e.target.value); setPage(1); }} className={`${selectCls} w-28`}>
            <option value="">Xona</option>
            {GROUP_ROOMS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>
        <div className="relative">
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={`${selectCls} w-32`}>
            <option value="">Aktiv guruh</option>
            <option value="frozen">Muzlatilgan</option>
            <option value="archive">Arxiv</option>
          </select>
          <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>

        <div className="relative flex-1 min-w-[180px]">
          <svg className="icon icon-sm absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"><use href="#i-search" /></svg>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} type="text" placeholder="Qidirish" className="w-full h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
        </div>

        <div className="relative" ref={moreRef}>
          <button onClick={() => setMoreOpen((o) => !o)} className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-card hover:bg-secondary" title="Amallar">
            <MoreVertical className="icon icon-sm" />
          </button>
          {moreOpen && (
            <div className="absolute top-full right-0 mt-2 z-50 w-56 rounded-xl border border-border bg-card shadow-xl overflow-hidden p-1">
              <button onClick={() => { showSuccess("Import (demo)"); setMoreOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-primary/10 text-[10px] font-bold text-primary">IN</span>
                <span>Import</span>
              </button>
              <button onClick={exportCSV} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">CSV</span>
                <span>CSV faylini yuklab olish</span>
              </button>
              <button onClick={exportExcel} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">XLS</span>
                <span>EXCEL faylini yuklab olish</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toq/Juft on right */}
      <div className="flex items-center justify-end">
        <div className="relative">
          <select value={oddEven} onChange={(e) => { setOddEven(e.target.value); setPage(1); }} className={`${selectCls} w-44`}>
            <option value="">Toq/Juft kunlar</option>
            <option value="Toq">Toq kunlar</option>
            <option value="Juft">Juft kunlar</option>
          </select>
          <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-[13px]">
        <span className="text-muted-foreground">Jami o&apos;quvchilar soni: <span className="font-semibold text-foreground tabular-nums">{totalStudents.toLocaleString("ru-RU").replace(/,/g, " ")}</span></span>
        <span className="text-muted-foreground">Muzlatilgan o&apos;quvchilar soni: <span className="font-semibold text-foreground tabular-nums">0</span></span>
        <div className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs">
          <span className="text-muted-foreground">Umumiy soni:</span>
          <span className="font-bold tabular-nums">{filtered.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-3 py-3 whitespace-nowrap">№</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Guruh nomi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Kurs</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Darajasi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Kun</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Dars vaqti</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Guruh vaqti</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">O&apos;quvchilar</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">O&apos;qituvchi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Xona</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Telegram link</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Guruh holati</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((g, i) => (
                <tr key={g.id} onClick={() => router.push(`/groups/${g.id}`)} className="border-b border-border/50 transition-colors hover:bg-secondary/30 cursor-pointer" style={g.highlighted ? { backgroundColor: "#fef9c3" } : undefined}>
                  <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                  <td className="px-3 py-3 tabular-nums font-medium text-[13px]">
                    <span className="text-foreground">{g.name}</span>
                  </td>
                  <td className="px-3 py-3 text-[13px]">{g.course}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">{g.level || "—"}</td>
                  <td className="px-3 py-3 text-[13px]">{g.day || "—"}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums text-muted-foreground whitespace-nowrap">{g.time || "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {g.period ? (
                      <span className={g.periodExpired ? "inline-flex items-center px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-[12px] font-medium tabular-nums" : "text-muted-foreground tabular-nums text-[13px]"}>{g.period}</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{g.students}</td>
                  <td className="px-3 py-3 text-[13px]">{g.teacher || "—"}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">{g.room || "—"}</td>
                  <td className="px-3 py-3 text-[12px]">{g.telegram ? <a href={g.telegram} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">{g.telegram}</a> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-3 text-[12px]"><span className="text-emerald-600 font-medium">{g.status}</span></td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-3 py-10 text-center text-sm text-muted-foreground">{loading ? "Yuklanmoqda…" : "Guruh topilmadi"}</td>
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
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      </div>

      {addOpen && (
        <AddGroupModal
          onClose={() => setAddOpen(false)}
          onCreated={(g) => setGroups((prev) => [...prev, g])}
        />
      )}
    </div>
  );
}
