import type { Db } from "mongodb";
import type { TransactionEntry } from "@/lib/transactionEntries";
import { isSheetsReady, isTelegramReady, loadSyncConfig, type SyncConfig } from "@/lib/sync/config";
import {
  appendRows,
  buildIdIndex,
  ensureTab,
  readRows,
  updateRow,
  type TabInfo,
} from "@/lib/sync/googleSheets";
import { SyncContext } from "@/lib/sync/lookups";
import {
  cancelMessage,
  classifyEntry,
  expenseCells,
  headersFor,
  paymentCells,
  paymentMessage,
  salaryCells,
  salaryMessage,
  toExpenseRow,
  toPaymentRow,
  toSalaryRow,
  toTransferRow,
  transferCells,
} from "@/lib/sync/mappers";
import { claimPending, recordOutcome, type TaskOutcome } from "@/lib/sync/outbox";
import { sendMessage } from "@/lib/sync/telegram";
import type { SyncKind, SyncTask } from "@/lib/sync/types";

// Navbatdagi vazifalarni bajarish: Google Sheets qatori + Telegram xabari.

/**
 * Bitta partiya davomida Google'dan o'qilgan holatni saqlaydi.
 *
 * Har bir yozuv uchun jadvalni qaytadan o'qish — 100 ta yozuvda 100 ta
 * ortiqcha so'rov, ya'ni Google limitiga urilish demak. Shuning uchun
 * varaq ma'lumoti va ID->qator xaritasi bir marta yuklanadi, keyin
 * xotirada yangilab boriladi.
 */
class SheetSession {
  private tabs = new Map<SyncKind, TabInfo>();
  private indexes = new Map<SyncKind, Map<number, number[]>>();

  constructor(private cfg: SyncConfig) {}

  async load(kind: SyncKind): Promise<{ tab: TabInfo; index: Map<number, number[]> }> {
    const target = this.cfg.targets[kind];
    let tab = this.tabs.get(kind);
    if (!tab) {
      tab = await ensureTab(this.cfg, target.spreadsheetId, target.tabName, headersFor(kind));
      this.tabs.set(kind, tab);
    }
    let index = this.indexes.get(kind);
    if (!index) {
      index = buildIdIndex(await readRows(this.cfg, target.spreadsheetId, tab.tabName));
      this.indexes.set(kind, index);
    }
    return { tab, index };
  }

  noteAppended(kind: SyncKind, entryId: number, rowNumber: number | null): void {
    if (rowNumber === null) {
      // Qator raqami noma'lum qoldi — keyingi amalda xarita qayta
      // o'qilsin, aks holda mavjud qatorni topolmay dublikat yasardik.
      this.indexes.delete(kind);
      return;
    }
    const index = this.indexes.get(kind);
    if (index) index.set(entryId, [rowNumber]);
  }
}

/** Sheet'ga yozish: qator bo'lsa yangilanadi, bo'lmasa qo'shiladi. */
async function writeSheet(
  cfg: SyncConfig,
  session: SheetSession,
  kind: SyncKind,
  entryId: number,
  cells: (string | number)[],
): Promise<void> {
  const target = cfg.targets[kind];
  const { tab, index } = await session.load(kind);
  const existing = index.get(entryId);

  if (existing && existing.length > 0) {
    await updateRow(cfg, target.spreadsheetId, tab.tabName, existing[0], cells);
    return;
  }
  const res = await appendRows(cfg, target.spreadsheetId, tab.tabName, [cells]);
  session.noteAppended(kind, entryId, res.firstRow);
}

interface PreparedEntry {
  cells: (string | number)[];
  createdText: string;
  cancelledText: string;
}

/**
 * Bazadagi yozuvdan Sheet qatorini va (kerak bo'lsa) Telegram matnini
 * tayyorlaydi.
 *
 * Xarajat va ko'chirma uchun matn BO'SH qoladi — ular guruhga hech qachon
 * ketmaydi (config.ts, TELEGRAM_KINDS). Bo'sh matn xavfsiz: `telegramDone`
 * bunday vazifalarda navbatga qo'yilishidayoq `true` bo'ladi, ya'ni
 * yuborish shoxobchasiga umuman kirilmaydi.
 */
async function prepare(
  entry: TransactionEntry,
  kind: SyncKind,
  ctx: SyncContext,
): Promise<PreparedEntry> {
  switch (kind) {
    case "payment": {
      const row = await toPaymentRow(entry, ctx);
      return {
        cells: paymentCells(row),
        createdText: paymentMessage(row),
        cancelledText: cancelMessage(kind, row),
      };
    }
    case "salary": {
      const row = await toSalaryRow(entry, ctx);
      return {
        cells: salaryCells(row),
        createdText: salaryMessage(row),
        cancelledText: cancelMessage(kind, row),
      };
    }
    case "expense": {
      const row = await toExpenseRow(entry, ctx);
      return { cells: expenseCells(row), createdText: "", cancelledText: "" };
    }
    case "transfer": {
      const row = await toTransferRow(entry, ctx);
      return { cells: transferCells(row), createdText: "", cancelledText: "" };
    }
  }
}

export interface FlushResult {
  processed: number;
  succeeded: number;
  failed: number;
  /** Sinxronizatsiya sozlanmagani uchun umuman ishlamadi. */
  skippedReason: string | null;
}

/**
 * Navbatdagi vazifalarni yuboradi.
 *
 * `deadline` — shu vaqtdan keyin yangi vazifa boshlanmaydi. Vercel'da
 * funksiya vaqti cheklangan (60 s), yarim yo'lda uzilib qolgandan ko'ra
 * bir qismini tugatib, qolganini keyingi safarga qoldirgan afzal —
 * navbat baribir hech narsani yo'qotmaydi.
 */
export async function flushPending(
  db: Db,
  options: { limit?: number; deadline?: number } = {},
): Promise<FlushResult> {
  const cfg = loadSyncConfig();
  const result: FlushResult = { processed: 0, succeeded: 0, failed: 0, skippedReason: null };

  if (!cfg.enabled) {
    result.skippedReason = "SYNC_ENABLED=false";
    return result;
  }

  const limit = options.limit ?? 100;
  const deadline = options.deadline ?? Date.now() + 45_000;
  const tasks = await claimPending(db, limit);
  if (tasks.length === 0) return result;

  const ctx = new SyncContext(db);
  const session = new SheetSession(cfg);
  const entriesCol = db.collection("transaction_entries");

  for (const task of tasks) {
    if (Date.now() > deadline) break;
    result.processed += 1;

    const outcome: TaskOutcome = {
      sheetDone: task.sheetDone,
      telegramDone: task.telegramDone,
      messageId: task.messageId,
      error: null,
    };

    try {
      const doc = await entriesCol.findOne({ id: task.entryId });
      if (!doc) {
        // Yozuv bazadan yo'qolgan (odatda bo'lmaydi — tranzaksiyalar
        // o'chirilmaydi). Cheksiz qayta urinmaslik uchun yopamiz.
        await recordOutcome(db, task, {
          sheetDone: true,
          telegramDone: true,
          messageId: task.messageId,
          error: null,
        });
        result.succeeded += 1;
        continue;
      }

      const { _id, ...rest } = doc;
      const entry = rest as unknown as TransactionEntry;
      const prepared = await prepare(entry, task.kind, ctx);

      if (!outcome.sheetDone) {
        if (isSheetsReady(cfg, task.kind)) {
          await writeSheet(cfg, session, task.kind, task.entryId, prepared.cells);
          outcome.sheetDone = true;
        } else {
          throw new Error(`Google Sheets sozlanmagan (${task.kind})`);
        }
      }

      if (!outcome.telegramDone) {
        if (isTelegramReady(cfg, task.kind)) {
          const text = task.event === "cancelled" ? prepared.cancelledText : prepared.createdText;
          const target = cfg.targets[task.kind];
          const sent = await sendMessage(cfg, target.chatId, text, target.threadId);
          outcome.messageId = sent.messageId;
          outcome.telegramDone = true;
          // Telegram guruhga daqiqasiga ~20 xabar chegarasi bor —
          // ketma-ket yuborishda kichik pauza limitga urilishdan saqlaydi.
          await new Promise((r) => setTimeout(r, 120));
        } else {
          throw new Error(`Telegram sozlanmagan (${task.kind})`);
        }
      }

      await recordOutcome(db, task, outcome);
      result.succeeded += 1;
    } catch (e) {
      outcome.error = e instanceof Error ? e.message : "noma'lum xato";
      await recordOutcome(db, task, outcome);
      result.failed += 1;
      console.error(`[sync] #${task.entryId} (${task.kind}/${task.event}) yuborilmadi:`, outcome.error);
    }
  }

  return result;
}

/**
 * Yangi yozuv qo'shilgandan keyin darhol chaqiriladi (route handler'dagi
 * `after()` ichida). Kassirni kutdirmaydi — javob allaqachon ketgan.
 *
 * Navbatdan bir nechta vazifa oladi, ya'ni oldin osilib qolganlar ham
 * "yo'l-yo'lakay" yuboriladi. Shu bilan qisqa uzilishlar kunlik cron'ni
 * kutmasdan tuzaladi.
 */
export async function flushSoon(db: Db): Promise<void> {
  try {
    await flushPending(db, { limit: 15, deadline: Date.now() + 20_000 });
  } catch (e) {
    // Bu yerdagi xato hech qachon foydalanuvchiga chiqmasligi kerak:
    // to'lov allaqachon bazaga yozilgan va javob qaytgan.
    console.error("[sync] fon rejimidagi yuborish xatosi:", e);
  }
}

/** Yozuv qaysi oqimga tegishli — route'lar shu orqali navbatga qo'yadi. */
export { classifyEntry };
export type { SyncTask };
