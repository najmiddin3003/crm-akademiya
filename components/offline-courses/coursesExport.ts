// OFLAYN KURSLAR — EKSPORT VA IMPORT (CSV / Excel). Eski ro'yxat
// (OfflineCoursesList.tsx) dan AYNAN ko'chirildi (20.10.2026) — yangi «Sozlamalar →
// Kurslar» sahifasi ham shu funksiyalardan foydalanadi, fayl ustunlari ikkala
// versiyada bir xil (eksport → tahrir → import).
//
// EKSPORT USTUNLARI /api/branches dan keladi. Ilgari sarlavhalar
// ["ID","Sarlavha","Rang","Akademiya","Akademiya 2-filial"] deb QATTIQ
// yozilgan edi va qiymatlar `branches[0]`/`branches[1]` dan olinardi — filial
// nomlari boshqacha bo'lsa yoki uchtadan ko'p bo'lsa jadval yolg'on
// sarlavha ostida noto'g'ri narxni ko'rsatardi.
//
// IMPORT o'sha ustunlarni qaytadan o'qiydi, xuddi Guruhlar ro'yxatidagi kabi:
// app/api/offline-courses/import/route.ts.

import type { OfflineCourse } from "./OfflineCoursesProvider";

export function csvCell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV matnini qatorlarga ajratadi (GroupsListPage.tsx dagi bilan bir xil
 * qoida): qo'shtirnoq ichidagi vergul/yangi qator ajratuvchi emas, "" esa
 * bitta qo'shtirnoq.
 */
export function parseCsv(text: string): string[][] {
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

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function dateStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Bitta kursning filial narxi ustunlari — filial bo'yicha, indeks bo'yicha emas. */
export function branchCells(course: OfflineCourse, branchIds: number[]): (string | number)[] {
  return branchIds.map((id) => {
    const b = course.branches.find((x) => x.id === id);
    return b?.enabled ? b.price : "-";
  });
}

/** Eksport sarlavhasi: ID, Sarlavha, Rang + ko'rsatiladigan filiallar nomlari. */
export function courseExportHeaders(shownBranches: { name: string }[]): string[] {
  return ["ID", "Sarlavha", "Rang", ...shownBranches.map((b) => b.name)];
}

export function coursesCsvBlob(list: OfflineCourse[], headers: string[], branchIds: number[]): Blob {
  const rows = list.map((c) => [c.id, c.name, c.color, ...branchCells(c, branchIds)]);
  const csv = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  return new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
}

export function coursesXlsBlob(list: OfflineCourse[], headers: string[], branchIds: number[]): Blob {
  const headRow =
    "<tr>" +
    headers.map(
      (h) =>
        `<th style="background:#dbeafe;color:#1e3a8a;font-weight:bold;border:1px solid #94a3b8;padding:8px 10px;text-align:left;">${h}</th>`,
    ).join("") +
    "</tr>";
  const bodyRows = list
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
  return new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
}

export type CourseImportResult =
  | { ok: true; created: number; skipped: number }
  | { ok: false; error: string };

/**
 * Import — eksport bilan AYNAN bir xil ustunlar, ya'ni eksport qilib,
 * tahrirlab, qaytadan import qilish mumkin. "ID" o'qilmaydi: yangi id
 * serverda beriladi. Xato matni chaqiruvchida o'giriladi (t()).
 */
export async function importCoursesCsv(file: File): Promise<CourseImportResult> {
  const rows = parseCsv(await file.text());
  if (rows.length < 2) return { ok: false, error: "Faylda sarlavhadan boshqa qator yo'q" };
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
  if (!data.ok) return { ok: false, error: String(data.error || "Import qilinmadi") };
  return { ok: true, created: Number(data.created) || 0, skipped: (data.skipped as { reason: string }[]).length };
}
