import type { StudentRow } from "@/lib/studentsData";

// O'QUVCHILAR RO'YXATI EKSPORTI — ikkala versiya uchun bitta (eski
// StudentsListPage va yangi StudentsListV2). Fayl ustunlari va formati
// versiyaga bog'liq emas: xodim qaysi ko'rinishda yuklab olmasin, Excel'da
// o'sha jadval chiqadi.

export const STUDENT_EXPORT_HEADERS = ["№", "ID", "Ism", "Coin", "Telefon raqam", "Balans", "Yaratilgan sanasi", "Manba", "Moderator"];

function csvCell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function studentExportRows(rows: StudentRow[]): (string | number)[][] {
  return rows.map((r, i) => [i + 1, r.id, r.name, r.coin || "", r.phone, r.balance, r.createdAt, r.source, r.moderator]);
}

/** CSV — UTF-8 BOM bilan (Excel kirill/lotin harflarini to'g'ri ochsin). */
export function studentsCsvBlob(rows: StudentRow[]): Blob {
  const csv = [STUDENT_EXPORT_HEADERS, ...studentExportRows(rows)].map((r) => r.map(csvCell).join(",")).join("\r\n");
  return new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
}

/** Excel (.xls) — HTML jadval ko'rinishida, sarlavha rangli. */
export function studentsXlsBlob(rows: StudentRow[]): Blob {
  const head = "<tr>" + STUDENT_EXPORT_HEADERS.map((h) => `<th style="background:#dbeafe;color:#1e3a8a;font-weight:bold;border:1px solid #94a3b8;padding:8px 10px;text-align:left;">${h}</th>`).join("") + "</tr>";
  const bodyRows = studentExportRows(rows).map((r) => "<tr>" + r.map((v) => `<td style="border:1px solid #cbd5e1;padding:6px 10px;">${v}</td>`).join("") + "</tr>").join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;}table{border-collapse:collapse;}</style></head><body><table><thead>${head}</thead><tbody>${bodyRows}</tbody></table></body></html>`;
  return new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
}

/** «Tavsiya» manbasi bilan kelganlar — referal eksporti. */
export function referralRows<T extends StudentRow>(rows: T[]): T[] {
  return rows.filter((r) => r.source === "Tavsiya");
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
