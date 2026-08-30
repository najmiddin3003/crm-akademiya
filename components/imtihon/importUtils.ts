
// Imtihon bo'limidagi Excel/CSV import-eksporti uchun umumiy yordamchilar.
// Referens HTML'da bu SheetJS'ni CDN'dan yuklardi; bu loyihada `xlsx` paketi
// allaqachon bog'liqlik sifatida bor, shuning uchun to'g'ridan-to'g'ri
// import qilamiz.

/** CSV katakchasini qavslash — nuqta-vergul, qo'shtirnoq va yangi qator uchun. */
export function csvEscape(v: unknown): string {
  const s = String(v == null ? "" : v);
  return /[";,\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/**
 * Qatorlarni CSV qilib brauzerga yuklab beradi. Boshidagi BOM (`﻿`) —
 * Excel faylni UTF-8 deb ochishi uchun.
 */
export function downloadCsv(rows: unknown[][], filename: string): void {
  const csv = "﻿" + rows.map((row) => row.map(csvEscape).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

/** Ajratgichni o'zi aniqlaydigan CSV parser (";", tab yoki ","). */
export function parseCsv(text: string): string[][] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  const first = lines[0] || "";
  const delim = first.includes(";") ? ";" : first.includes("\t") ? "\t" : ",";
  return lines.map((l) => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (inQ) {
        if (ch === '"') {
          if (l[i + 1] === '"') {
            cur += '"';
            i++;
          } else inQ = false;
        } else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delim) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out;
  });
}

/** Tanlangan faylni (csv/txt/xlsx/xls) xom jadval qatorlariga o'giradi. */
export function readFileRows(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    return file.text().then((t) => parseCsv(t));
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return file.arrayBuffer().then(async (buf) => {
      // xlsx faqat .xlsx/.xls tanlanganda yuklanadi — .csv yo'li unga
      // umuman tegmaydi, va sahifa ochilishida ham u kerak emas.
      const XLSX = await import("xlsx");
      const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      return XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as string[][];
    });
  }
  return Promise.reject(new Error("Fayl turi qo'llab-quvvatlanmaydi: .xlsx, .xls yoki .csv yuklang"));
}

/** Sarlavha qatoridan ustun izlash uchun — bo'shliq/apostroflarni tashlaydi. */
export function normHeader(s: unknown): string {
  return String(s || "").toLowerCase().replace(/['’ʼ`\s_-]/g, "");
}

/** Butun sonni matndan ajratib oladi ("25 ta" → 25). */
export function intOf(v: unknown): number {
  return parseInt(String(v ?? "").replace(/\D/g, ""), 10) || 0;
}

export interface ParseResult<T> {
  ok: T[];
  errors: string[];
}
