// BOSHQARUV → XODIMLAR — EKSPORT VA IMPORT (CSV / Excel). Eski ro'yxat
// (EmployeesListPage.tsx) dan AYNAN ko'chirildi (20.10.2026) — yangi versiyadagi
// Xodimlar sahifasi ham shu funksiyalardan foydalanadi: fayl ustunlari ikkala
// versiyada bir xil (eksport → tahrir → import).

import type { HrEmployeeFull } from "./employeeExtras";

export function csvCell(v: string | number): string {
  const s = String(v ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}
/**
 * CSV matnini qatorlarga ajratadi — eksport yozgan qoidalar bo'yicha
 * (qo'shtirnoq ichidagi vergul/yangi qator ajratmaydi, "" bitta qo'shtirnoq).
 * components/groups/GroupsListPage.tsx dagi bilan bir xil, chunki import
 * ham aynan shu sahifaning eksportini qaytarib o'qishi kerak.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  // BOM eksport tomonidan qo'shiladi — olib tashlanmasa birinchi ustun buziladi.
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

export const EXPORT_HEADERS = ["№", "To'liq nomi", "Jinsi", "Aktiv o'quvchilar", "Guruhlar", "Turi", "Filiallar", "Telefon raqam", "Kurs", "Yaratilgan sana"];
// Eksportdagi ustun tartibi = importda o'qiladigan indekslar. "№",
// "Aktiv o'quvchilar" va "Guruhlar" import qilinmaydi (backend izohiga qarang).
export const IMPORT_IDX = { name: 1, gender: 2, turi: 5, filial: 6, phone: 7, kurs: 8, created: 9 };

/** Eksport qatorlari — ekrandagi TARTIBDA (saralab, keyin yuklab olish kutilgan natijani bersin). */
export function employeeExportRows(
  list: HrEmployeeFull[],
  statsOf: (e: HrEmployeeFull) => { students: number; groups: number },
  roleLabelOf: (e: HrEmployeeFull) => string,
  genderLabels: Record<string, string>,
): (string | number)[][] {
  return list.map((e, i) => [i + 1, e.name, genderLabels[e.gender], statsOf(e).students, statsOf(e).groups, roleLabelOf(e), e.filial, e.phone, e.kurs, e.created]);
}

export function employeesCsvBlob(rows: (string | number)[][]): Blob {
  const csv = [EXPORT_HEADERS, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  return new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
}

export function employeesXlsBlob(rows: (string | number)[][]): Blob {
  const head = "<tr>" + EXPORT_HEADERS.map((h) => `<th style="background:#dbeafe;color:#1e3a8a;font-weight:bold;border:1px solid #94a3b8;padding:8px 10px;text-align:left;">${h}</th>`).join("") + "</tr>";
  const body = rows.map((r) => "<tr>" + r.map((v) => `<td style="border:1px solid #cbd5e1;padding:6px 10px;">${v}</td>`).join("") + "</tr>").join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;}table{border-collapse:collapse;}</style></head><body><table><thead>${head}</thead><tbody>${body}</tbody></table></body></html>`;
  return new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
}

export type EmployeeImportResult = { ok: true; created: number; skipped: number } | { ok: false; error: string };

/** Import — eksport bilan bir xil ustunlar (IMPORT_IDX). Xato matni chaqiruvchida o'giriladi (t()). */
export async function importEmployeesCsv(file: File): Promise<EmployeeImportResult> {
  const parsed = parseCsv(await file.text());
  if (parsed.length < 2) return { ok: false, error: "Faylda sarlavhadan boshqa qator yo'q" };
  const body = parsed.slice(1).map((r) => ({
    name: r[IMPORT_IDX.name],
    gender: r[IMPORT_IDX.gender],
    turi: r[IMPORT_IDX.turi],
    filial: r[IMPORT_IDX.filial],
    phone: r[IMPORT_IDX.phone],
    kurs: r[IMPORT_IDX.kurs],
    created: r[IMPORT_IDX.created],
  }));
  const res = await fetch("/api/hr-employees/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employees: body }),
  });
  const data = await res.json();
  if (!data.ok) return { ok: false, error: String(data.error || "Import qilinmadi") };
  return { ok: true, created: Number(data.created) || 0, skipped: (data.skipped as { reason: string }[]).length };
}
