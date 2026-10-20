"use client";

import { fmtSom } from "./analyticsShared";

// YANGI VERSIYA — MOLIYA ANALITIKASI HISOBOTI (rasm «Hisobotni yuklab olish»,
// 20.10.2026): bitta model → uch format.
//   • Excel — har bo'lim alohida varaq, summalar SON bo'lib qoladi (qo'shib bo'ladi);
//   • CSV   — bitta fayl, bo'limlar bo'sh qator bilan ajratiladi (UTF-8 BOM — Excel
//             o'zbekcha harflarni buzmasin);
//   • PDF   — loyihada PDF kutubxonasi yo'q (eski «Pul oqimi» izohi): chop etish
//             oynasi ochiladi, «PDF sifatida saqlash» bilan fayl bo'ladi (chek bilan
//             bir xil yashirin iframe usuli — components/finance/cashReceipt.tsx).

export type Cell = string | number;

export interface ReportSection {
  /** Bo'lim (va Excel varag'i) nomi. */
  title: string;
  columns: string[];
  rows: Cell[][];
  /** Oxirgi qator — jami (qalin). */
  totalRow?: boolean;
}

export interface ReportDoc {
  title: string;
  /** «1–20-oktyabr · Barcha filiallar». */
  subtitle: string;
  sections: ReportSection[];
  /** Fayl nomi kengaytmasiz. */
  fileBase: string;
}

/** Excel varag'i nomi: 31 belgigacha, man etilgan belgilarsiz, takrorlanmasin. */
function sheetName(title: string, used: Set<string>): string {
  const base = title.replace(/[:\\/?*[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 28) || "Varaq";
  let name = base;
  for (let i = 2; used.has(name); i++) name = `${base.slice(0, 26)} ${i}`;
  used.add(name);
  return name;
}

export async function downloadXlsx(doc: ReportDoc): Promise<void> {
  // xlsx (SheetJS) faqat bosilganda yuklanadi — sahifa to'plamiga kirmasin.
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const s of doc.sections) {
    const aoa: Cell[][] = [[s.title], [doc.subtitle], [], s.columns, ...s.rows];
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    sheet["!cols"] = s.columns.map((c, i) => ({ wch: Math.max(c.length, ...s.rows.map((r) => String(r[i] ?? "").length), 10) + 2 }));
    XLSX.utils.book_append_sheet(book, sheet, sheetName(s.title, used));
  }
  XLSX.writeFile(book, `${doc.fileBase}.xlsx`);
}

export function downloadCsv(doc: ReportDoc): void {
  const esc = (v: Cell) => `"${String(v).replace(/"/g, '""')}"`;
  const lines: string[] = [esc(doc.title), esc(doc.subtitle), ""];
  for (const s of doc.sections) {
    lines.push(esc(s.title), s.columns.map(esc).join(","), ...s.rows.map((r) => r.map(esc).join(",")), "");
  }
  const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.fileBase}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Chop etish (PDF) — oq qog'ozga mos oddiy jadvallar; raqamlar o'ngga, bo'shliq bilan. */
export function printPdf(doc: ReportDoc, generatedAt: string): void {
  const cell = (v: Cell) => (typeof v === "number" ? `<td class="n">${escHtml(fmtSom(v))}</td>` : `<td>${escHtml(v)}</td>`);
  const sections = doc.sections
    .map((s) => {
      const body = s.rows
        .map((r, i) => `<tr${s.totalRow && i === s.rows.length - 1 ? ' class="total"' : ""}>${r.map(cell).join("")}</tr>`)
        .join("");
      const head = s.columns.map((c, i) => `<th${s.rows.some((r) => typeof r[i] === "number") ? ' class="n"' : ""}>${escHtml(c)}</th>`).join("");
      return `<section><h2>${escHtml(s.title)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></section>`;
    })
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(doc.fileBase)}</title><style>
    @page{size:A4;margin:14mm}
    *{box-sizing:border-box}
    body{font-family:"Segoe UI",Arial,sans-serif;color:#111;font-size:11px;margin:0}
    h1{font-size:18px;margin:0}
    .sub{color:#555;margin:4px 0 2px}
    .gen{color:#888;font-size:10px;margin-bottom:14px}
    h2{font-size:13px;margin:16px 0 6px}
    table{width:100%;border-collapse:collapse}
    th,td{border-bottom:1px solid #ddd;padding:5px 6px;text-align:left;vertical-align:top}
    th{color:#555;font-weight:600;background:#f5f6f7}
    .n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
    tr.total td{font-weight:700;background:#f5f6f7}
    section{break-inside:avoid-page}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
    <h1>${escHtml(doc.title)}</h1>
    <div class="sub">${escHtml(doc.subtitle)}</div>
    <div class="gen">${escHtml(generatedAt)}</div>
    ${sections}
  </body></html>`;

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const d = frame.contentDocument;
  if (!d) {
    frame.remove();
    return;
  }
  d.open();
  d.write(html);
  d.close();
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  window.setTimeout(() => frame.remove(), 1000);
}
