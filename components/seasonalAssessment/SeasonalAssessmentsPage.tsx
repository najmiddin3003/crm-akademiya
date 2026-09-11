"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/ui/Link";
import { History, MoreVertical, Trash2 } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import MonthPicker from "@/components/ui/MonthPicker";
import SeasonalAssessmentEditModal from "./SeasonalAssessmentEditModal";
import type { SeasonalAssessment } from "@/lib/seasonalAssessments";
import Select from "@/components/ui/Select";

// O'quv bo'limi → Mavsumiy baholash (sidebar: O'quv bo'limi > Mavsumiy
// baholash, href /seasonal-assessment). Ma'lumot /api/seasonal-assessments
// dan. "Baholash" tugmasi /seasonal-assessment/add sahifasiga o'tadi (u yerda
// oy → kurs → guruh tanlanadi, so'ng guruh o'quvchilari bir yo'la baholanadi).
// Jadvaldagi soat-tarix ikonkasi — bitta yozuvni tahrirlash (ball/izoh);
// manba skrinshotda bu ikonkaning aniq vazifasi ko'rsatilmagan, shuning uchun
// eng foydali variant — tahrirlash sifatida amalga oshirildi.

const HEADERS = ["№", "O'quvchi", "Kurs", "Guruh", "Sana", "Ball", "Izoh"];

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

export default function SeasonalAssessmentsPage() {
  const { showSuccess, showError } = useToast();
  const [rows, setRows] = useState<SeasonalAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  const [month, setMonth] = useState<number | null>(null);
  const [student, setStudent] = useState("");
  const [course, setCourse] = useState("");
  const [group, setGroup] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [moreOpen, setMoreOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SeasonalAssessment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SeasonalAssessment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/seasonal-assessments")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setRows(d.assessments); })
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

  const studentOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.studentName))).sort(), [rows]);
  const courseOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.course))).sort(), [rows]);
  const groupOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.groupName))).sort(), [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (month && r.month !== month) return false;
      if (student && r.studentName !== student) return false;
      if (course && r.course !== course) return false;
      if (group && r.groupName !== group) return false;
      return true;
    });
  }, [rows, month, student, course, group]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  function exportRows() {
    return filtered.map((r, i) => [i + 1, r.studentName, r.course, r.groupName, "", r.ball, r.izoh]);
  }
  function exportCSV() {
    const csv = [HEADERS, ...exportRows()].map((r) => r.map(csvCell).join(",")).join("\r\n");
    downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), "mavsumiy-baholash.csv");
    showSuccess(`CSV yuklab olindi — ${filtered.length} ta`);
    setMoreOpen(false);
  }
  function exportExcel() {
    const head = "<tr>" + HEADERS.map((h) => `<th style="background:#dbeafe;color:#1e3a8a;font-weight:bold;border:1px solid #94a3b8;padding:8px 10px;text-align:left;">${h}</th>`).join("") + "</tr>";
    const body = exportRows().map((r) => "<tr>" + r.map((v) => `<td style="border:1px solid #cbd5e1;padding:6px 10px;">${v}</td>`).join("") + "</tr>").join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;}table{border-collapse:collapse;}</style></head><body><table><thead>${head}</thead><tbody>${body}</tbody></table></body></html>`;
    downloadBlob(new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" }), "mavsumiy-baholash.xls");
    showSuccess(`Excel yuklab olindi — ${filtered.length} ta`);
    setMoreOpen(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const r = deleteTarget;
    setDeleting(true);
    try {
      const res = await fetch(`/api/seasonal-assessments/${r.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "O'chirilmadi");
        setDeleting(false);
        return;
      }
      setRows((prev) => prev.filter((x) => x.id !== r.id));
      showSuccess("Baho o'chirildi");
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Link href="/seasonal-assessment/add" className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm">
          <span>+ Baholash</span>
        </Link>

        <MonthPicker value={month} onChange={(m) => { setMonth(m); setPage(1); }} onClear={() => { setMonth(null); setPage(1); }} className="w-28" />

        <Select value={student} onChange={(v) => { setStudent(v); setPage(1); }} options={studentOptions.map((s) => ({ value: s, label: s }))} placeholder="O'quvchi" clearable size="sm" className="w-40" />
        <Select value={course} onChange={(v) => { setCourse(v); setPage(1); }} options={courseOptions.map((c) => ({ value: c, label: c }))} placeholder="Kurs" clearable size="sm" className="w-40" />
        <Select value={group} onChange={(v) => { setGroup(v); setPage(1); }} options={groupOptions.map((g) => ({ value: g, label: g }))} placeholder="Guruh" clearable size="sm" className="w-40" />

        <div className="relative ml-auto" ref={moreRef}>
          <button onClick={() => setMoreOpen((o) => !o)} className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-card hover:bg-secondary" title="Amallar">
            <MoreVertical className="icon icon-sm" />
          </button>
          {moreOpen && (
            <div className="absolute top-full right-0 mt-2 z-50 w-56 rounded-xl border border-border bg-card shadow-xl overflow-hidden p-1">
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
                <th className="text-left px-3 py-3 whitespace-nowrap">O&apos;quvchi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Kurs</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Guruh</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Sana</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Ball</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Izoh</th>
                <th className="px-3 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {slice.map((r, i) => (
                <tr key={r.id} className="border-b border-border/50 transition-colors hover:bg-secondary/30">
                  <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                  <td className="px-3 py-3 text-[13px] font-medium">{r.studentName}</td>
                  <td className="px-3 py-3 text-[13px]">{r.course}</td>
                  <td className="px-3 py-3 text-[13px]">{r.groupName}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">—</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums font-semibold">{r.ball}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">{r.izoh || "—"}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => setEditTarget(r)} className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-primary" title="Tahrirlash">
                        <History className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteTarget(r)} className="h-8 w-8 rounded-md hover:bg-rose-500/10 hover:text-rose-600 flex items-center justify-center text-rose-500" title="O'chirish">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">{loading ? <SpinnerBlock size={22} /> : "Baho topilmadi"}</td>
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

      {editTarget && (
        <SeasonalAssessmentEditModal
          assessment={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(a) => setRows((prev) => prev.map((x) => (x.id === a.id ? a : x)))}
        />
      )}
      {deleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-6">
            <p className="text-center text-[15px] font-semibold">Rostdan ham o&apos;chirmoqchimisiz?</p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
                Yo&apos;q
              </button>
              <button onClick={confirmDelete} disabled={deleting} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
                {deleting ? "O'chirilmoqda…" : "Ha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
