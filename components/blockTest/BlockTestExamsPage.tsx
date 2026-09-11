"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import BlockTestExamModal from "./BlockTestExamModal";
import type { BlockTestExam } from "@/lib/blockTestExams";
import type { BlockTestType } from "@/lib/blockTestTypes";
import type { Group } from "@/lib/groups";
import type { HrEmployee } from "@/lib/hrEmployees";
import Modal from "@/components/ui/Modal";

// Blok test → Blok testlar (referens akademiya.edutizim.uz/block-test/exams,
// sidebar: Blok test > Blok testlar, href /blok-testlar). Ma'lumot
// /api/block-test-exams dan. "Blok test qo'shish"/tahrirlash —
// BlockTestExamModal, o'chirish — pastdagi oddiy tasdiqlash oynasi (Ha/Yo'q).

const HEADERS = ["№", "Nomi", "Turi", "Holati", "Sana", "Boshlanish vaqti", "Davomiyligi (daqiqa)", "Mas'ul xodim", "Guruhlar", "Qo'shilgan sana"];

// "YYYY-MM-DD" → "DD.MM.YYYY"
function fmtDate(iso: string): string {
  const [y, m, d] = (iso || "").split("-");
  if (!y || !m || !d) return iso || "—";
  return `${d}.${m}.${y}`;
}

// Sana asosida holatni hisoblaydi — API'da alohida saqlanmaydi. Ranglar
// Topshiriqlar sahifasining "O'tib ketgan"/"Bugun"/"Keyinchalik keladigan"
// ustunlari bilan bir xil (qizil/yashil/ko'k) — bir xil vaqt-holati tushunchasi.
function examStatus(date: string): { label: string; cls: string } {
  if (!date) return { label: "Noma'lum", cls: "bg-secondary text-muted-foreground" };
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (date < todayIso) return { label: "Tugagan", cls: "bg-rose-100 text-rose-700" };
  if (date === todayIso) return { label: "Bugun", cls: "bg-emerald-100 text-emerald-700" };
  return { label: "Rejalashtirilgan", cls: "bg-blue-100 text-blue-700" };
}

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

export default function BlockTestExamsPage() {
  const { showSuccess, showError } = useToast();
  const [items, setItems] = useState<BlockTestExam[]>([]);
  const [types, setTypes] = useState<BlockTestType[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [moreOpen, setMoreOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<BlockTestExam | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BlockTestExam | null>(null);
  const [deleting, setDeleting] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/block-test-exams").then((r) => r.json()),
      fetch("/api/block-test-types").then((r) => r.json()),
      fetch("/api/groups").then((r) => r.json()),
      fetch("/api/hr-employees").then((r) => r.json()),
    ]).then(([exams, ty, gr, emp]) => {
      if (cancelled) return;
      if (exams.ok) setItems(exams.exams);
      if (ty.ok) setTypes(ty.types);
      if (gr.ok) setGroups(gr.groups);
      if (emp.ok) setEmployees(emp.employees);
    }).finally(() => { if (!cancelled) setLoading(false); });
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

  const typeName = (id: number | null) => (id ? types.find((t) => t.id === id)?.name || "—" : "—");
  const employeeName = (id: number | null) => (id ? employees.find((e) => e.id === id)?.name || "—" : "—");
  const groupNames = (ids: number[]) =>
    ids.length ? ids.map((id) => groups.find((g) => g.id === id)?.name).filter(Boolean).join(", ") : "—";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r) => r.name.toLowerCase().includes(q) || typeName(r.typeId).toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, types]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  function exportRows() {
    return filtered.map((r, i) => [
      i + 1, r.name, typeName(r.typeId), examStatus(r.date).label, fmtDate(r.date), r.startTime, r.durationMinutes, employeeName(r.responsibleEmployeeId), groupNames(r.groupIds), r.createdAt,
    ]);
  }
  function exportCSV() {
    const csv = [HEADERS, ...exportRows()].map((r) => r.map(csvCell).join(",")).join("\r\n");
    downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), "blok-testlar.csv");
    showSuccess(`CSV yuklab olindi — ${filtered.length} ta`);
    setMoreOpen(false);
  }
  function exportExcel() {
    const head = "<tr>" + HEADERS.map((h) => `<th style="background:#dbeafe;color:#1e3a8a;font-weight:bold;border:1px solid #94a3b8;padding:8px 10px;text-align:left;">${h}</th>`).join("") + "</tr>";
    const rows = exportRows().map((r) => "<tr>" + r.map((v) => `<td style="border:1px solid #cbd5e1;padding:6px 10px;">${v}</td>`).join("") + "</tr>").join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;}table{border-collapse:collapse;}</style></head><body><table><thead>${head}</thead><tbody>${rows}</tbody></table></body></html>`;
    downloadBlob(new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" }), "blok-testlar.xls");
    showSuccess(`Excel yuklab olindi — ${filtered.length} ta`);
    setMoreOpen(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const r = deleteTarget;
    setDeleting(true);
    try {
      const res = await fetch(`/api/block-test-exams/${r.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "O'chirilmadi");
        setDeleting(false);
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== r.id));
      showSuccess("Blok test o'chirildi");
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm">
          <Plus className="icon icon-sm" />
          <span>Blok test qo&apos;shish</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary/60 text-xs">
            <span className="text-muted-foreground">Umumiy soni:</span>
            <span className="font-bold tabular-nums">{filtered.length}</span>
          </div>
          <div className="relative">
            <svg className="icon icon-sm absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"><use href="#i-search" /></svg>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} type="text" placeholder="Qidirish" className="w-56 h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div className="relative" ref={moreRef}>
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
      </div>

      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-3 py-3 whitespace-nowrap w-14">№</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Nomi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Turi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Holati</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Sana</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Boshlanish vaqti</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Davomiyligi (daqiqa)</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Mas&apos;ul xodim</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Guruhlar</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Qo&apos;shilgan sana</th>
                <th className="px-3 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {slice.map((r, i) => {
                const st = examStatus(r.date);
                return (
                  <tr key={r.id} className="border-b border-border/50 transition-colors hover:bg-secondary/30">
                    <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                    <td className="px-3 py-3 text-[13px] font-medium">{r.name}</td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground">{typeName(r.typeId)}</td>
                    <td className="px-3 py-3 text-[13px]">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-3 py-3 text-[13px] tabular-nums whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="px-3 py-3 text-[13px] tabular-nums">{r.startTime || "—"}</td>
                    <td className="px-3 py-3 text-[13px] tabular-nums">{r.durationMinutes}</td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground">{employeeName(r.responsibleEmployeeId)}</td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground max-w-[220px] truncate" title={groupNames(r.groupIds)}>{groupNames(r.groupIds)}</td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground whitespace-nowrap">{r.createdAt}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button onClick={() => setEditItem(r)} className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-muted-foreground" title="Tahrirlash">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(r)} className="h-8 w-8 rounded-md hover:bg-rose-500/10 hover:text-rose-600 flex items-center justify-center text-rose-500" title="O'chirish">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-10 text-center text-sm text-muted-foreground">{loading ? <SpinnerBlock size={22} /> : "Ma'lumotlar topilmadi"}</td>
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

      {addOpen && (
        <BlockTestExamModal onClose={() => setAddOpen(false)} onSaved={(r) => setItems((prev) => [r, ...prev])} />
      )}
      {editItem && (
        <BlockTestExamModal exam={editItem} onClose={() => setEditItem(null)} onSaved={(r) => setItems((prev) => prev.map((x) => (x.id === r.id ? r : x)))} />
      )}
      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)} locked={deleting} bare size="sm" zIndex={110} panelClassName="p-6">{(modal) => (<>
            <p className="text-center text-[15px] font-semibold">Rostdan ham o&apos;chirmoqchimisiz?</p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button onClick={modal.close} disabled={deleting} className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
                Yo&apos;q
              </button>
              <button onClick={confirmDelete} disabled={deleting} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
                {deleting ? "O'chirilmoqda…" : "Ha"}
              </button>
            </div>
          </>)}</Modal>
      )}
    </div>
  );
}
