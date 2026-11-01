import { after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { flushSoon } from "@/lib/sync/dispatch";
import { returnTransfer } from "@/lib/transferDecision";

// POST /api/transaction-entries/:id/transfer-return — kassalararo
// ko'chirmani BEKOR QILISH (01.11.2026): qabul qiluvchi (rahbar) sababini
// yozadi va pul jo'natuvchi kassaga qaytadi. Kutilayotgan ko'chirmada ham
// (rad etish), QABUL QILINGANIDA ham (pul rahbar kassadan qaytariladi).
// Jo'natuvchiga «pul qaytdi» oynasi chiqadi (app/api/transfer-returns).
//
// Tana: `{ comment: string }` — majburiy. `:id` — pul KELGAN qatorning
// id'si. Butun mantiq va tekshiruvlar lib/transferDecision.ts da.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { comment?: unknown } | null;
  const res = await returnTransfer(Number(id), body?.comment);
  after(async () => flushSoon(await ensureIndexes()));
  return res;
}
