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

// Oflayn kurslar ro'yxati (crm-akademiya #view-offline-courses / renderOfflineCourses).
// Qidiruv nom bo'yicha filtrlaydi; sahifalash haqiqiy. "+" tugmasi va kurs
// nomi bosilganda kurs tafsiloti (Darajalar) sahifasiga o'tadi.
//
// EKSPORT USTUNLARI endi /api/branches dan keladi. Ilgari sarlavhalar
// ["ID","Sarlavha","Rang","Akademiya","Akademiya 2-filial"] deb QATTIQ
// yozilgan edi va qiymatlar `branches[0]`/`branches[1]` dan olinardi — filial
// nomlari boshqacha bo'lsa yoki uchtadan ko'p bo'lsa jadval yolg'on
// sarlavha ostida noto'g'ri narxni ko'rsatardi.
//
// IMPORT o'sha ustunlarni qaytadan o'qiydi (eksport → tahrir → import), xuddi
// Guruhlar ro'yxatidagi kabi: app/api/offline-courses/import/route.ts.

function csvCell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV matnini qatorlarga ajratadi (GroupsListPage.tsx dagi bilan bir xil
 * qoida): qo'shtirnoq ichidagi vergul/yangi qator ajratuvchi emas, "" esa
 * bitta qo'shtirnoq.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
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

function dateStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Bitta kursning filial narxi ustunlari — filial bo'yicha, indeks bo'yicha emas. */
function branchCells(course: OfflineCourse, branchIds: number[]): (string | number)[] {
  return branchIds.map((id) => {
    const b = course.branches.find((x) => x.id === id);
    return b?.enabled ? b.price : "-";
  });
}

export default function OfflineCoursesList() {
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

  const headers = useMemo(() => ["ID", "Sarlavha", "Rang", ...branches.map((b) => b.name)], [branches]);
  const branchIds = useMemo(() => branches.map((b) => b.id), [branches]);

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

  // Import — eksport bilan AYNAN bir xil ustunlar, ya'ni eksport qilib,
  // tahrirlab, qaytadan import qilish mumkin. "ID" o'qilmaydi: yangi id
  // serverda beriladi.
  async function importCsv(file: File) {
    setImporting(true);
    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) {
        showError("Faylda sarlavhadan boshqa qator yo'q");
        return;
      }
      // Filial narx ustunlari SARLAVHA QATORIDAN o'qiladi. Ilgari sarlavha
      // (rows[0]) tashlab yuborilar va 3+i ustun HOZIRGI /api/branches
      // ro'yxatining i-chi filiali deb belgilanardi — eksportdan keyin filial
      // qo'shilgan, o'chirilgan yoki tartibi o'zgargan bo'lsa narxlar jimgina
      // BOSHQA filialga tushardi. Endi ustun nomi faylning o'zidan olinadi;
      // backend esa uni `branches` kolleksiyasidagi nom bilan solishtiradi va
      // mos kelmaganini o'ylab topmasdan tashlab ketadi.
      const header = rows[0];
      const branchCols = header
        .slice(3)
        .map((h, k) => ({ name: h.trim(), col: k + 3 }))
        .filter((c) => c.name !== "");
      const body = rows.slice(1).map((r) => ({
        name: r[1],
        color: r[2],
        branches: branchCols.map((c) => ({ name: c.name, price: r[c.col] })),
      }));
      const res = await fetch("/api/offline-courses/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courses: body }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Import qilinmadi");
        return;
      }
      await reload();
      setPage(1);
      const skipped = (data.skipped as { reason: string }[]).length;
      showSuccess(
        skipped > 0
          ? `${data.created} ta kurs qo'shildi, ${skipped} tasi o'tkazib yuborildi`
          : `${data.created} ta kurs qo'shildi`,
      );
    } catch {
      showError("Faylni o'qib bo'lmadi");
    } finally {
      setImporting(false);
    }
  }

  function exportCSV() {
    const rows = filtered.map((c) => [c.id, c.name, c.color, ...branchCells(c, branchIds)]);
    const csv = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `oflayn_kurslar_${dateStamp()}.csv`);
    showSuccess(`CSV yuklab olindi — ${filtered.length} ta yozuv`);
    setMoreOpen(false);
  }

  function exportExcel() {
    const headRow =
      "<tr>" +
      headers.map(
        (h) =>
          `<th style="background:#dbeafe;color:#1e3a8a;font-weight:bold;border:1px solid #94a3b8;padding:8px 10px;text-align:left;">${h}</th>`,
      ).join("") +
      "</tr>";
    const bodyRows = filtered
      .map((c) => {
        const cells = [c.id, c.name, c.color, ...branchCells(c, branchIds)];
        return (
          "<tr>" +
          cells
            .map((v, j) => {
              let style = "border:1px solid #cbd5e1;padding:6px 10px;";
              if (j === 2) style += `background:${c.color};color:white;font-weight:bold;`;
              return `<td style="${style}">${v}</td>`;
            })
            .join("") +
          "</tr>"
        );
      })
      .join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;}table{border-collapse:collapse;}</style></head><body><table><thead>${headRow}</thead><tbody>${bodyRows}</tbody></table></body></html>`;
    const blob = new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
    downloadBlob(blob, `oflayn_kurslar_${dateStamp()}.xls`);
    showSuccess(`Excel yuklab olindi — ${filtered.length} ta yozuv`);
    setMoreOpen(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const name = deleteTarget.name;
    const ok = await deleteCourse(deleteTarget.id);
    setDeleteTarget(null);
    if (ok) showSuccess(`Kurs o'chirildi — ${name}`);
    else showError("O'chirishda xatolik yuz berdi");
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
          <span>Kurs qo&apos;shish</span>
        </Link>
        <div className="flex-1" />
        <div className="relative w-64">
          <svg className="icon icon-sm absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"><use href="#i-search" /></svg>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            type="text"
            placeholder="Qidirish"
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
            title="Amallar"
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
                <span>{importing ? "Import qilinmoqda…" : "Import (CSV)"}</span>
              </button>
              <button onClick={exportCSV} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left transition-colors">
                <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">CSV</span>
                <span>CSV faylini yuklab olish</span>
              </button>
              <button onClick={exportExcel} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left transition-colors">
                <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">XLS</span>
                <span>EXCEL faylini yuklab olish</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Total badge */}
      <div className="flex items-center justify-end">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs">
          <span className="text-muted-foreground">Umumiy soni:</span>
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
                <th className="text-left px-3 py-3">Sarlavha</th>
                <th className="text-left px-3 py-3 w-48">Rang</th>
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
                      title="Tafsilotlar"
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
                        title="Tahrirlash"
                      >
                        <svg className="icon icon-xs"><use href="#i-edit" /></svg>
                      </Link>
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="h-8 w-8 rounded-md hover:bg-rose-500/10 hover:text-rose-600 flex items-center justify-center text-rose-500"
                        title="O'chirish"
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
          title="Kursni o'chirish"
          message="Quyidagi kursni o'chirmoqchimisiz:"
          name={deleteTarget.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
