import type { TransactionEntry } from "@/lib/transactionEntries";

// KASSA YOZUVLARI EKSPORTI (CSV / Excel) — eski (components/finance/
// CashboxesPage.tsx) va yangi (components/v2/finance) Kassalar sahifasi uchun
// bitta manba. Ustunlar eski jadval tartibida (kassirga kerakli narsalar
// chapda); yangi sahifa bir nechta kassani birga chiqaradi — «Kassa» ustuni
// shu holda qo'shiladi. CashboxesPage.tsx dan ko'chirildi (18.10.2026).

export const TX_TYPE_LABELS: Record<string, string> = {
  payIn: "Kirim",
  payOut: "Chiqim",
  transfer: "Ko'chirish",
};

/** "2026-10-12" + "11:48" → "12.10.2026 | 11:48" (eksport va chek). */
function fmtEntryDate(e: TransactionEntry): string {
  const [y, m, d] = e.date.split("-");
  return `${d}.${m}.${y} | ${e.time}`;
}

export interface EntryExportCol {
  label: string;
  get: (e: TransactionEntry) => string | number;
}

export function entryExportCols(t: (s: string) => string, opts: { cashboxName?: (id: number) => string } = {}): EntryExportCol[] {
  const cols: EntryExportCol[] = [
    { label: t("Kim"), get: (e) => e.studentName || e.moderator || "" },
    { label: t("Miqdori"), get: (e) => e.amount },
    { label: t("To'lov turi"), get: (e) => e.paymentType },
    { label: t("Sana"), get: fmtEntryDate },
    { label: t("Izoh"), get: (e) => e.note || "" },
    { label: t("Oyligiga"), get: (e) => e.teacherName || "" },
    { label: t("Tranzaksiya nomi"), get: (e) => e.txName || "" },
    { label: t("Holati"), get: (e) => e.status || "" },
    { label: t("Tranzaksiya turi"), get: (e) => TX_TYPE_LABELS[e.txType] || e.txType },
  ];
  const name = opts.cashboxName;
  if (name) cols.splice(1, 0, { label: t("Kassa"), get: (e) => name(e.cashboxId) });
  return cols;
}

/** CSV — eski sahifadagidek (sarlavha qo'shtirnoqsiz, qiymatlar qo'shtirnoqda). */
export function downloadEntriesCsv(entries: TransactionEntry[], cols: EntryExportCol[]): void {
  const rows = [
    cols.map((c) => c.label).join(","),
    ...entries.map((e) => cols.map((c) => `"${String(c.get(e)).replace(/"/g, '""')}"`).join(",")),
  ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `tranzaksiyalar-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Excel (.xlsx). xlsx (SheetJS) FAQAT shu yerda kerak — bosilganda. Statik
 * import bo'lganida u route'ning boshlang'ich JS to'plamiga kirardi: 431 KB lik
 * chunk 9 ta sahifada, eksport tugmasi bosilmasa ham.
 */
export async function downloadEntriesXlsx(entries: TransactionEntry[], cols: EntryExportCol[]): Promise<void> {
  const XLSX = await import("xlsx");
  const rows = entries.map((e) => Object.fromEntries(cols.map((c) => [c.label, c.get(e)])));
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Tranzaksiyalar");
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `tranzaksiyalar-${date}.xlsx`);
}
