import { after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { flushSoon } from "@/lib/sync/dispatch";
import { decideTransfer } from "@/lib/transferDecision";

// POST /api/transaction-entries/:id/transfer-confirm — kassalararo
// ko'chirmani TASDIQLASH (jadvaldagi yashil ✓).
//
// `:id` — pul KELAYOTGAN qatorning id'si. Butun mantiq va tekshiruvlar
// lib/transferDecision.ts da (rad etish bilan bir xil).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await decideTransfer(Number(id), "confirm");
  // Sheets qatori kunlik cron'ni kutmasdan yangilansin.
  after(async () => flushSoon(await ensureIndexes()));
  return res;
}
