import { after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { flushSoon } from "@/lib/sync/dispatch";
import { decideTransfer } from "@/lib/transferDecision";

// POST /api/transaction-entries/:id/transfer-reject — kassalararo
// ko'chirmani RAD ETISH (jadvaldagi qizil ×). Pul jo'natuvchi kassaga
// QAYTARILADI.
//
// `:id` — pul KELAYOTGAN qatorning id'si. Butun mantiq va tekshiruvlar
// lib/transferDecision.ts da (tasdiqlash bilan bir xil).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await decideTransfer(Number(id), "reject");
  after(async () => flushSoon(await ensureIndexes()));
  return res;
}
