"use client";

import { fmtNum, fmtSigned } from "./reportFormat";

// HISOBOTLAR (15-qism) — EKSPORT: bitta hujjat modeli → Excel va PDF (rasm «Qarzdorlar →
// PDF», 25.10.2026).
//   • Excel — bitta varaq: sarlavha, markaz va filial, sana va kim tayyorlagani, filtrlar,
//     ko'rsatkichlar, so'ng jadval(lar). Summalar SON bo'lib qoladi (qo'shib bo'ladi).
//   • PDF — loyihada PDF kutubxonasi yo'q (6-qism, SAVOLLAR 109): A4 sahifa HTML'i
//     yashirin iframe'da chop etish oynasida ochiladi, «PDF sifatida saqlash» — fayl.
//     Oldindan ko'rish (PDF oynasining chap qismi) AYNAN shu HTML (iframe srcdoc).

export type Cell = string | number | null;

export interface ExportColumn {
  label: string;
  /** Raqam — o'ngga, bo'shliq bilan guruhlangan; Excel'da son. */
  numeric?: boolean;
  /** PDF'da ishorasi bilan («+13», «−3»); Excel'da son bo'lib qoladi. */
  signed?: boolean;
  /** PDF oynasidagi galochka bilan yashiriladigan ustun kaliti («phone»). */
  key?: string;
}

export interface ExportSection {
  title?: string;
  columns: ExportColumn[];
  rows: Cell[][];
  /** Jami qatori (qalin). */
  total?: Cell[];
}

export interface ExportDoc {
  /** «Qarzdorlar hisoboti». */
  title: string;
  /** Fayl nomi kengaytmasiz. */
  fileBase: string;
  center: string;
  /** «Akademiya 1 Chortoq» / «Barcha filiallar». */
  branchLabel: string;
  /** «25-oktabr 2026». */
  dateLabel: string;
  /** «Abdulloh R.». */
  author: string;
  /** Joriy filtrlar («12-oktabr holatiga · Akademiya 1 Chortoq · Barcha guruhlar»). */
  filters: string;
  kpis: { label: string; value: string }[];
  sections: ExportSection[];
  notes?: string[];
  /** Pastki yozuv («Tizimli · tizimli24.uz»). */
  footer: string;
}

export interface PrintOptions {
  orientation: "portrait" | "landscape";
  /** Markaz nomi va filial. */
  showHeader: boolean;
  /** Sana va kim tayyorlagani. */
  showMeta: boolean;
  /** Yashirilgan ustunlar (`ExportColumn.key`). */
  hidden: ReadonlySet<string>;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** `<style>` ichida HTML belgilari ochilmaydi — CSS satri uchun qo'shtirnoq va teskari chiziq olib tashlanadi. */
const cssStr = (s: string) => s.replace(/["\\<>]/g, "");
/** Ochiq kitob (lucide «BookOpen») — logotip kvadrati ichida. */
const BOOK_SVG =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg>';
const cellText = (v: Cell, c?: ExportColumn) =>
  v === null || v === undefined ? "—" : typeof v === "number" ? (c?.numeric === false ? String(v) : c?.signed ? fmtSigned(v) : fmtNum(v)) : v;

function visibleIdx(s: ExportSection, hidden: ReadonlySet<string>): number[] {
  return s.columns.map((c, i) => (c.key && hidden.has(c.key) ? -1 : i)).filter((i) => i >= 0);
}

/* ───────────────────────── Excel ───────────────────────── */

export async function downloadXlsx(doc: ExportDoc): Promise<void> {
  // xlsx (SheetJS) faqat bosilganda yuklanadi — sahifa to'plamiga kirmasin.
  const XLSX = await import("xlsx");
  const aoa: Cell[][] = [[doc.title], [`${doc.center} · ${doc.branchLabel}`], [`${doc.dateLabel} · ${doc.author}`], [doc.filters], []];
  for (const k of doc.kpis) aoa.push([k.label, k.value]);
  if (doc.kpis.length) aoa.push([]);
  for (const s of doc.sections) {
    if (s.title) aoa.push([s.title]);
    aoa.push(s.columns.map((c) => c.label));
    for (const r of s.rows) aoa.push(r.map((v) => (v === null ? "" : v)));
    if (s.total) aoa.push(s.total.map((v) => (v === null ? "" : v)));
    aoa.push([]);
  }
  for (const n of doc.notes ?? []) aoa.push([n]);
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const widest = Math.max(1, ...doc.sections.map((s) => s.columns.length));
  sheet["!cols"] = Array.from({ length: widest }, (_, i) => ({
    wch:
      Math.min(
        48,
        Math.max(10, ...doc.sections.flatMap((s) => [s.columns[i]?.label ?? "", ...s.rows.map((r) => (r[i] === null || r[i] === undefined ? "" : String(r[i])))]).map((x) => x.length)),
      ) + 2,
  }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, doc.title.replace(/[:\\/?*[\]]/g, " ").slice(0, 28) || "Hisobot");
  XLSX.writeFile(book, `${doc.fileBase}.xlsx`);
}

/* ───────────────────────── PDF (chop etish) ───────────────────────── */

/** Qator sig'imi (taxmin) — oynadagi «N sahifa» uchun. */
export function estimatePages(doc: ExportDoc, o: Pick<PrintOptions, "orientation">): number {
  const perPage = o.orientation === "portrait" ? 34 : 20;
  const rows = doc.sections.reduce((s, x) => s + x.rows.length + (x.total ? 1 : 0) + (x.title ? 2 : 1), 0) + (doc.kpis.length ? 4 : 0);
  return Math.max(1, Math.ceil(rows / perPage));
}

export function buildPrintHtml(doc: ExportDoc, o: PrintOptions): string {
  const sections = doc.sections
    .map((s) => {
      const idx = visibleIdx(s, o.hidden);
      const head = idx.map((i) => `<th${s.columns[i].numeric ? ' class="n"' : ""}>${esc(s.columns[i].label)}</th>`).join("");
      const row = (r: Cell[], cls = "") =>
        `<tr${cls ? ` class="${cls}"` : ""}>${idx.map((i) => `<td${s.columns[i].numeric ? ' class="n"' : ""}>${esc(cellText(r[i] ?? null, s.columns[i]))}</td>`).join("")}</tr>`;
      const body = s.rows.map((r) => row(r)).join("") || `<tr><td colspan="${idx.length}" class="empty">—</td></tr>`;
      return `<section>${s.title ? `<h2>${esc(s.title)}</h2>` : ""}<table><thead><tr>${head}</tr></thead><tbody>${body}${s.total ? row(s.total, "total") : ""}</tbody></table></section>`;
    })
    .join("");
  const kpis = doc.kpis.length
    ? `<div class="kpis">${doc.kpis.map((k) => `<div class="kpi"><div class="kl">${esc(k.label)}</div><div class="kv">${esc(k.value)}</div></div>`).join("")}</div>`
    : "";
  const header =
    o.showHeader || o.showMeta
      ? `<header>
          <div class="brand">${o.showHeader ? `<span class="logo">${BOOK_SVG}</span><div><b>${esc(doc.center)}</b><span>${esc(doc.branchLabel)}</span></div>` : ""}</div>
          <div class="meta">${o.showMeta ? `<span>${esc(doc.dateLabel)}</span><span>${esc(doc.author)}</span>` : ""}</div>
        </header>`
      : "";
  const notes = (doc.notes ?? []).map((n) => `<p class="note">${esc(n)}</p>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.fileBase)}</title><style>
    @page{size:A4 ${o.orientation};margin:14mm 14mm 16mm}
    @page{@bottom-left{content:"${cssStr(doc.footer)}";font:9px "Segoe UI",Arial,sans-serif;color:#888}@bottom-right{content:counter(page) " / " counter(pages);font:9px "Segoe UI",Arial,sans-serif;color:#888}}
    *{box-sizing:border-box}
    html,body{margin:0;background:#fff}
    body{font-family:"Segoe UI",Arial,sans-serif;color:#111;font-size:10.5px;line-height:1.4}
    header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding-bottom:8px;border-bottom:1.5px solid #0e7c86;margin-bottom:12px}
    .brand{display:flex;align-items:center;gap:8px}
    .brand b{display:block;font-size:12px}
    .brand span{display:block;color:#666;font-size:10px}
    .logo{width:22px;height:22px;border-radius:5px;background:#0e7c86;display:inline-flex;align-items:center;justify-content:center;flex:none}
    .meta{text-align:right;color:#666;font-size:10px}
    .meta span{display:block}
    h1{font-size:16px;margin:0 0 10px}
    .kpis{display:flex;gap:8px;margin-bottom:12px}
    .kpi{flex:1;background:#f4f5f7;border-radius:6px;padding:7px 9px}
    .kl{color:#666;font-size:9.5px}
    .kv{font-size:13px;font-weight:700;margin-top:1px}
    h2{font-size:12px;margin:12px 0 6px}
    table{width:100%;border-collapse:collapse}
    th,td{border-bottom:1px solid #e3e5e8;padding:4.5px 6px;text-align:left;vertical-align:top}
    th{color:#555;font-weight:600;background:#f4f5f7}
    .n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
    tr.total td{font-weight:700;border-bottom:0;border-top:1.5px solid #c9ccd1}
    td.empty{text-align:center;color:#888}
    thead{display:table-header-group}
    tr{break-inside:avoid}
    .note{color:#666;font-size:9.5px;margin:10px 0 0}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
    ${header}
    <h1>${esc(doc.title)}</h1>
    ${kpis}
    ${sections}
    ${notes}
  </body></html>`;
}

/** Chop etish oynasi (PDF sifatida saqlash shu yerdan). */
export function printHtml(html: string): void {
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
  window.setTimeout(() => frame.remove(), 1500);
}
