import type { Group } from "@/lib/groups";
import { groupStudentCount } from "@/lib/groupsList";

// GURUHLAR EKSPORTI VA IMPORTI — eski va yangi sahifa bitta fayl yozadi va
// o'qiydi (eksport → tahrir → import). Ustunlar tartibi O'ZGARMASIN: import
// ularni RAQAMI bo'yicha o'qiydi (pastdagi `importRowsFromCsv`).

export const GROUP_EXPORT_HEADERS = ["№", "Guruh nomi", "Kurs", "Darajasi", "Kun", "Dars vaqti", "Guruh vaqti", "O'quvchi", "O'qituvchi", "Xona", "Telegram", "Holati"];

function csvCell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportRows(groups: Group[]): (string | number)[][] {
  return groups.map((g, i) => [i + 1, g.name, g.course, g.level || "", g.day, g.time, g.period, groupStudentCount(g), g.teacher, g.room, g.telegram || "", g.status]);
}

export function groupsCsvBlob(groups: Group[]): Blob {
  const csv = [GROUP_EXPORT_HEADERS, ...exportRows(groups)].map((r) => r.map(csvCell).join(",")).join("\r\n");
  return new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
}

export function groupsXlsBlob(groups: Group[]): Blob {
  const head = "<tr>" + GROUP_EXPORT_HEADERS.map((h) => `<th style="background:#dbeafe;color:#1e3a8a;font-weight:bold;border:1px solid #94a3b8;padding:8px 10px;text-align:left;">${h}</th>`).join("") + "</tr>";
  const rows = exportRows(groups).map((r) => "<tr>" + r.map((v) => `<td style="border:1px solid #cbd5e1;padding:6px 10px;">${v}</td>`).join("") + "</tr>").join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;}table{border-collapse:collapse;}</style></head><body><table><thead>${head}</thead><tbody>${rows}</tbody></table></body></html>`;
  return new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
}

/**
 * CSV matnini qatorlarga ajratadi. Qo'shtirnoq ichidagi vergul va yangi
 * qator ajratuvchi sifatida qaralmaydi (eksport ham shu qoida bilan
 * yozadi), "" esa bitta qo'shtirnoq bo'ladi.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  // BOM eksport tomonidan qo'shiladi — bo'lmasa birinchi ustun nomi buziladi.
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

/**
 * Import — eksport bilan bir xil ustunlar. "№" va "O'quvchi" o'qilmaydi:
 * biri qator raqami, ikkinchisi guruhga qo'shilgan o'quvchilardan hisoblanadi.
 * Sarlavhadan boshqa qator bo'lmasa — null.
 */
export function importRowsFromCsv(text: string): Record<string, string>[] | null {
  const rows = parseCsv(text);
  if (rows.length < 2) return null;
  return rows.slice(1).map((r) => ({
    name: r[1], course: r[2], level: r[3], day: r[4], time: r[5],
    period: r[6], teacher: r[8], room: r[9], telegram: r[10], status: r[11],
  }));
}
