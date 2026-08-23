// Jadvalni CSV/Excel qilib yuklab olish — "Amallar" (⋮) menyusidagi
// "CSV faylini yuklab olish" va "EXCEL faylini yuklab olish" uchun.
//
// Excel varianti haqiqiy .xlsx emas, HTML jadval solingan .xls: Excel uni
// o'zi tanib, ustun kengliklari va sarlavha bo'yashi bilan ochadi. Loyihadagi
// boshqa ro'yxat sahifalari ham shu usulni ishlatadi — shuning uchun shu
// yerda umumiylashtirildi (ilgari har bir sahifada nusxasi bor edi).

export type Cell = string | number;

/** CSV katakchasini qavslash — vergul, qo'shtirnoq va yangi qator uchun. */
export function csvCell(v: Cell): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Blob'ni brauzerga yuklab beradi (vaqtincha <a download> orqali). */
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

/** Sarlavha + qatorlarni CSV qilib yuklaydi. Boshidagi BOM Excel UTF-8 ni tanishi uchun. */
export function downloadTableCsv(headers: string[], rows: Cell[][], filename: string): void {
  const csv = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), filename);
}

/** Sarlavha + qatorlarni Excel ochadigan .xls qilib yuklaydi. */
export function downloadTableExcel(headers: string[], rows: Cell[][], filename: string): void {
  const head =
    "<tr>" +
    headers
      .map(
        (h) =>
          `<th style="background:#dbeafe;color:#1e3a8a;font-weight:bold;border:1px solid #94a3b8;padding:8px 10px;text-align:left;">${h}</th>`,
      )
      .join("") +
    "</tr>";
  const body = rows
    .map(
      (r) =>
        "<tr>" +
        r.map((v) => `<td style="border:1px solid #cbd5e1;padding:6px 10px;">${v}</td>`).join("") +
        "</tr>",
    )
    .join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;}table{border-collapse:collapse;}</style></head><body><table><thead>${head}</thead><tbody>${body}</tbody></table></body></html>`;
  downloadBlob(new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" }), filename);
}
