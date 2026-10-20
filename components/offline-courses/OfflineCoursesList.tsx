"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/ui/Link";
import { useRouter } from "next/navigation";
import Pagination from "@/components/ui/Pagination";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useBranches } from "@/hooks/useBranches";
import OfflineCoursesIcons from "./OfflineCoursesIcons";
import DeleteConfirmModal from "./DeleteConfirmModal";
import { useOfflineCourses, type OfflineCourse } from "./OfflineCoursesProvider";
import { courseExportHeaders, coursesCsvBlob, coursesXlsBlob, dateStamp, downloadBlob, importCoursesCsv } from "./coursesExport";
import { useT } from "@/components/shared/Language";
import { collapseBranchPools } from "@/lib/branchPools";

// Oflayn kurslar ro'yxati (crm-akademiya #view-offline-courses / renderOfflineCourses).
// Qidiruv nom bo'yicha filtrlaydi; sahifalash haqiqiy. "+" tugmasi va kurs
// nomi bosilganda kurs tafsiloti (Darajalar) sahifasiga o'tadi.
//
// EKSPORT/IMPORT — ./coursesExport.ts (20.10.2026 da shu yerdan AYNAN ko'chirildi;
// yangi «Sozlamalar → Kurslar» sahifasi ham o'sha fayldan): ustunlar /api/branches
// dan, import ularni sarlavha qatoridan qaytadan o'qiydi.

export default function OfflineCoursesList() {
  const { t } = useT();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const { courses, loading, deleteCourse, reload } = useOfflineCourses();
  const { branches } = useBranches();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [moreOpen, setMoreOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OfflineCourse | null>(null);

  const moreRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 1+2 «Akademiya Chortoq» — bitta ustun (lib/branchPools.ts; narx ikkala
  // binoda bir xil, forma ikkalasiga yozadi). Import nom bo'yicha ikkalasiga.
  const shownBranches = useMemo(() => collapseBranchPools(branches), [branches]);
  const headers = useMemo(() => courseExportHeaders(shownBranches), [shownBranches]);
  const branchIds = useMemo(() => shownBranches.map((b) => b.id), [shownBranches]);

  // 3-nuqta menyusini tashqariga bosilganda yopish.
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
    if (!q) return courses;
    return courses.filter((c) => c.name.toLowerCase().includes(q));
  }, [courses, search]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  // Import — eksport bilan AYNAN bir xil ustunlar (./coursesExport.ts).
  async function importCsv(file: File) {
    setImporting(true);
    try {
      const r = await importCoursesCsv(file);
      if (!r.ok) {
        showError(t(r.error));
        return;
      }
      await reload();
      setPage(1);
      showSuccess(
        r.skipped > 0
          ? t("{created} ta kurs qo'shildi, {skipped} tasi o'tkazib yuborildi", { created: r.created, skipped: r.skipped })
          : t("{created} ta kurs qo'shildi", { created: r.created }),
      );
    } catch {
      showError(t("Faylni o'qib bo'lmadi"));
    } finally {
      setImporting(false);
    }
  }

  function exportCSV() {
    downloadBlob(coursesCsvBlob(filtered, headers, branchIds), `oflayn_kurslar_${dateStamp()}.csv`);
    showSuccess(t("CSV yuklab olindi — {filtered} ta yozuv", { filtered: filtered.length }));
    setMoreOpen(false);
  }

  function exportExcel() {
    downloadBlob(coursesXlsBlob(filtered, headers, branchIds), `oflayn_kurslar_${dateStamp()}.xls`);
    showSuccess(t("Excel yuklab olindi — {filtered} ta yozuv", { filtered: filtered.length }));
    setMoreOpen(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const name = deleteTarget.name;
    const ok = await deleteCourse(deleteTarget.id);
    setDeleteTarget(null);
    if (ok) showSuccess(t("Kurs o'chirildi — {name}", { name }));
    else showError(t("O'chirishda xatolik yuz berdi"));
  }

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <OfflineCoursesIcons />

      {/* Top bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href="/offline-courses/add"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
        >
          <svg className="icon icon-sm"><use href="#i-plus" /></svg>
          <span>{t("Kurs qo'shish")}</span>
        </Link>
        <div className="flex-1" />
        <div className="relative w-64">
          <svg className="icon icon-sm absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"><use href="#i-search" /></svg>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            type="text"
            placeholder={t("Qidirish")}
            className="w-full h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="relative" ref={moreRef}>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              // Bir xil faylni ketma-ket ikki marta tanlash mumkin bo'lsin.
              e.target.value = "";
              if (f) importCsv(f);
            }}
          />
          <button
            onClick={() => setMoreOpen((o) => !o)}
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-card hover:bg-secondary"
            title={t("Amallar")}
          >
            <svg className="icon icon-sm"><use href="#i-more-vertical" /></svg>
          </button>
          {moreOpen && (
            <div className="absolute top-full right-0 mt-2 z-50 w-56 rounded-xl border border-border bg-card shadow-xl overflow-hidden p-1">
              <button
                onClick={() => { fileRef.current?.click(); setMoreOpen(false); }}
                disabled={importing}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left transition-colors disabled:opacity-60"
              >
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-primary/10 text-primary"><svg className="icon icon-xs"><use href="#i-file-plus" /></svg></span>
                <span>{importing ? t("Import qilinmoqda…") : t("Import (CSV)")}</span>
              </button>
              <button onClick={exportCSV} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left transition-colors">
                <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">CSV</span>
                <span>{t("CSV faylini yuklab olish")}</span>
              </button>
              <button onClick={exportExcel} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left transition-colors">
                <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">XLS</span>
                <span>{t("EXCEL faylini yuklab olish")}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Total badge */}
      <div className="flex items-center justify-end">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs">
          <span className="text-muted-foreground">{t("Umumiy soni:")}</span>
          <span className="font-bold tabular-nums">{filtered.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="w-10" />
                <th className="text-left px-3 py-3">{t("Sarlavha")}</th>
                <th className="text-left px-3 py-3 w-48">{t("Rang")}</th>
                <th className="text-right px-3 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {slice.map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-3 py-3 text-center">
                    <Link
                      href={`/offline-courses/${c.id}`}
                      className="h-7 w-7 rounded-md hover:bg-secondary/80 inline-flex items-center justify-center text-muted-foreground"
                      title={t("Tafsilotlar")}
                    >
                      <svg className="icon icon-xs"><use href="#i-plus" /></svg>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-[14px] font-medium">
                    <button
                      onClick={() => router.push(`/offline-courses/${c.id}`)}
                      className="hover:text-primary hover:underline text-left"
                    >
                      {c.name}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-block w-12 h-7 rounded-md" style={{ background: c.color }} />
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <Link
                        href={`/offline-courses/${c.id}/edit`}
                        className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-primary"
                        title={t("Tahrirlash")}
                      >
                        <svg className="icon icon-xs"><use href="#i-edit" /></svg>
                      </Link>
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="h-8 w-8 rounded-md hover:bg-rose-500/10 hover:text-rose-600 flex items-center justify-center text-rose-500"
                        title={t("O'chirish")}
                      >
                        <svg className="icon icon-xs"><use href="#i-trash" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    {loading ? <SpinnerBlock size={22} /> : "Kurs topilmadi"}
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
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      </div>

      {deleteTarget && (
        <DeleteConfirmModal
          title={t("Kursni o'chirish")}
          message="Quyidagi kursni o'chirmoqchimisiz:"
          name={deleteTarget.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
