import type { Db } from "mongodb";
import type { TransactionEntry } from "@/lib/transactionEntries";
import { isSheetsReady, loadSyncConfig, SYNC_KINDS, type SyncConfig } from "@/lib/sync/config";
import {
  appendRows,
  deleteRows,
  ensureTab,
  readRows,
  updateRow,
  type SheetCell,
} from "@/lib/sync/googleSheets";
import { SyncContext } from "@/lib/sync/lookups";
import {
  expenseCells,
  headersFor,
  kindFilter,
  paymentCells,
  salaryCells,
  signatureOf,
  toExpenseRow,
  toPaymentRow,
  toSalaryRow,
  toTransferRow,
  transferCells,
} from "@/lib/sync/mappers";
import type { ReconcileReport, SyncKind } from "@/lib/sync/types";

// SOLISHTIRISH — modulning yuragi.
//
// "Bironta ma'lumot qolib ketmaganini tekshirish" talabi aynan shu yerda
// bajariladi. Navbat (outbox) "yubordim" deb hisoblashi mumkin, lekin
// haqiqatni faqat GOOGLE'NING O'ZIDAN o'qib bilish mumkin:
//
//   • qator umuman yozilmagan (yuborish yarim yo'lda uzilgan)
//   • qator bor, lekin summa/status eskirgan
//   • bir xil ID ikki marta yozilgan (qayta urinish paytida)
//   • odam jadvalni qo'lda o'zgartirib/o'chirib yuborgan
//
// Shu bosqich bazani ETALON deb bilib, jadvalni unga moslaydi.

/**
 * Bitta yugurishda bajariladigan yozuv amallari chegarasi. Google'da
 * daqiqasiga ~60 ta yozuv so'rovi chegarasi bor va Vercel funksiyasi 60
 * soniyada uziladi. Chegaradan oshgan farqlar `remaining` bo'lib
 * qaytadi va ertangi yugurishda davom etadi — hech narsa yo'qolmaydi.
 */
const MAX_UPDATES = 150;
const MAX_APPENDS = 2000;
const APPEND_CHUNK = 500;

function emptyReport(kind: SyncKind): ReconcileReport {
  return {
    kind,
    dbCount: 0,
    sheetCount: 0,
    added: 0,
    updated: 0,
    duplicates: 0,
    orphans: 0,
    remaining: 0,
    errors: [],
  };
}

async function cellsFor(
  entry: TransactionEntry,
  kind: SyncKind,
  ctx: SyncContext,
): Promise<SheetCell[]> {
  switch (kind) {
    case "payment": return paymentCells(await toPaymentRow(entry, ctx));
    case "salary": return salaryCells(await toSalaryRow(entry, ctx));
    case "expense": return expenseCells(await toExpenseRow(entry, ctx));
    case "transfer": return transferCells(await toTransferRow(entry, ctx));
  }
}

/**
 * Bitta oqimni baza bilan solishtirib tuzatadi.
 */
export async function reconcileKind(
  db: Db,
  kind: SyncKind,
  cfg: SyncConfig = loadSyncConfig(),
  deadline: number = Date.now() + 40_000,
): Promise<ReconcileReport> {
  const report = emptyReport(kind);

  if (!isSheetsReady(cfg, kind)) {
    report.errors.push("Google Sheets sozlanmagan — solishtirish o'tkazilmadi");
    return report;
  }

  const target = cfg.targets[kind];
  const headers = headersFor(kind);
  const tab = await ensureTab(cfg, target.spreadsheetId, target.tabName, headers);

  // 1) Jadvalning JORIY holati (Google'dan, bazadan emas).
  const sheetRows = await readRows(cfg, target.spreadsheetId, tab.tabName);
  report.sheetCount = sheetRows.filter((r) => String(r[0] ?? "").trim() !== "").length;

  //    ID -> qator raqami va o'sha qatorning barmoq izi.
  const rowOf = new Map<number, number>();
  const signatureAt = new Map<number, string>();
  const duplicateRows: number[] = [];
  sheetRows.forEach((row, i) => {
    const id = Number(String(row[0] ?? "").trim());
    if (!Number.isFinite(id) || id <= 0) return;
    const rowNumber = i + 2; // sarlavha 1-qator
    if (rowOf.has(id)) {
      // Ikkinchi va undan keyingi uchrashuv — dublikat.
      duplicateRows.push(rowNumber);
      return;
    }
    rowOf.set(id, rowNumber);
    // Jadvaldan o'qilgan qator ham AYNAN shu ustunlar soni bo'yicha
    // barmoq iziga aylantiriladi — o'ng tomondagi bo'sh yoki begona
    // kataklar solishtirishga ta'sir qilmasin.
    signatureAt.set(id, signatureOf(row, headers.length));
  });

  // 2) Bazadagi shu oqimga tegishli barcha yozuvlar.
  const ctx = new SyncContext(db);
  const cursor = db.collection("transaction_entries").find(kindFilter(kind)).sort({ id: 1 });

  const toAppend: SheetCell[][] = [];
  const toUpdate: { row: number; cells: SheetCell[] }[] = [];
  const dbIds = new Set<number>();

  for await (const doc of cursor) {
    const { _id, ...rest } = doc;
    const entry = rest as unknown as TransactionEntry;
    dbIds.add(entry.id);
    report.dbCount += 1;

    const cells = await cellsFor(entry, kind, ctx);
    const row = rowOf.get(entry.id);

    if (row === undefined) {
      if (toAppend.length < MAX_APPENDS) toAppend.push(cells);
      else report.remaining += 1;
      continue;
    }
    // Qator bor — mazmuni o'zgarganmi? ("Yangilangan" ustuni
    // solishtirishga kirmaydi, signatureOf izohiga qarang.)
    if (signatureAt.get(entry.id) !== signatureOf(cells, headers.length)) {
      if (toUpdate.length < MAX_UPDATES) toUpdate.push({ row, cells });
      else report.remaining += 1;
    }
  }

  // 3) Jadvalda bor, bazada yo'q — o'chirmaymiz, faqat xabar qilamiz.
  //    Kimdir qo'lda qo'shgan izoh bo'lishi mumkin, uni yo'q qilish
  //    ma'lumot yo'qotish bo'lardi.
  for (const id of rowOf.keys()) {
    if (!dbIds.has(id)) report.orphans += 1;
  }

  // 4) Tuzatish. TARTIB MUHIM:
  //    yangilash (qator raqamlari hali to'g'ri) -> dublikatlarni o'chirish
  //    (raqamlar suriladi) -> qo'shish (oxiriga, raqamga bog'liq emas).
  try {
    for (const item of toUpdate) {
      if (Date.now() > deadline) {
        report.remaining += toUpdate.length - report.updated;
        break;
      }
      await updateRow(cfg, target.spreadsheetId, tab.tabName, item.row, item.cells);
      report.updated += 1;
    }

    if (duplicateRows.length > 0 && Date.now() <= deadline) {
      await deleteRows(cfg, target.spreadsheetId, tab.sheetId, duplicateRows);
      report.duplicates = duplicateRows.length;
    } else if (duplicateRows.length > 0) {
      report.remaining += duplicateRows.length;
    }

    for (let i = 0; i < toAppend.length; i += APPEND_CHUNK) {
      if (Date.now() > deadline) {
        report.remaining += toAppend.length - report.added;
        break;
      }
      const chunk = toAppend.slice(i, i + APPEND_CHUNK);
      await appendRows(cfg, target.spreadsheetId, tab.tabName, chunk);
      report.added += chunk.length;
    }
  } catch (e) {
    report.errors.push(e instanceof Error ? e.message : "noma'lum xato");
  }

  return report;
}

/** To'rt oqimning hammasini solishtiradi (SYNC_KINDS tartibida). */
export async function reconcileAll(
  db: Db,
  deadline: number = Date.now() + 45_000,
): Promise<ReconcileReport[]> {
  const cfg = loadSyncConfig();
  const kinds = SYNC_KINDS;
  const reports: ReconcileReport[] = [];
  for (const kind of kinds) {
    try {
      reports.push(await reconcileKind(db, kind, cfg, deadline));
    } catch (e) {
      const r = emptyReport(kind);
      r.errors.push(e instanceof Error ? e.message : "noma'lum xato");
      reports.push(r);
    }
  }
  return reports;
}

/** Hisobotdan qisqa xulosa — CRM sahifasidagi sarlavha uchun. */
export function reportSummary(r: ReconcileReport): string {
  if (r.errors.length > 0) return `Xato: ${r.errors[0]}`;
  const fixed = r.added + r.updated + r.duplicates;
  if (fixed === 0 && r.remaining === 0) return `${r.dbCount}/${r.dbCount} sinxron`;
  const parts: string[] = [];
  if (r.added) parts.push(`${r.added} qo'shildi`);
  if (r.updated) parts.push(`${r.updated} yangilandi`);
  if (r.duplicates) parts.push(`${r.duplicates} dublikat o'chirildi`);
  if (r.remaining) parts.push(`${r.remaining} keyingi safarga qoldi`);
  return parts.join(", ");
}
