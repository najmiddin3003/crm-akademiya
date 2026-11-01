import type { TransactionEntry } from "@/lib/transactionEntries";

// KO'CHIRMANI BEKOR QILISH (01.11.2026) — klient va server uchun umumiy,
// serverga oid importsiz. Mantiq: lib/transferDecision.ts → returnTransferAs.

/** Bekor qilish sababi — eng uzuni (belgi). Server ham shunga qirqadi. */
export const RETURN_COMMENT_MAX = 500;

/**
 * Rahbar shu qatorda «Bekor qilish» tugmasini ko'radimi: kassalararo
 * ko'chirmaning pul KELGAN qatori, juftligi bog'langan (`transferId`) va
 * hali bekor qilinmagan — kutilayotgan ham, qabul qilingan ham.
 *
 * Bu faqat KO'RINISH: ruxsat (kassa egasi yoki admin) va pul yetarliligi
 * serverda tekshiriladi.
 */
export function canReturnTransfer(
  e: Pick<TransactionEntry, "txType" | "transferRole" | "transferId" | "status">,
): boolean {
  return e.txType === "transfer" && e.transferRole === "in" && typeof e.transferId === "number" && (e.status === "waiting" || e.status === "");
}

/** Bekor qilingan ko'chirma (rahbar bekor qilgan) — tafsilot oynasi shu iz bilan chizadi. */
export function isReturnedTransfer(e: Pick<TransactionEntry, "txType" | "status" | "returnedAt">): boolean {
  return e.txType === "transfer" && e.status === "cancelled" && !!e.returnedAt;
}

/** Jo'natuvchiga «pul qaytdi» oynasidagi bitta qator (GET /api/transfer-returns). */
export interface TransferReturnItem {
  /** Ko'chirmaning JO'NATUVCHI ("out") qatori — «Tushunarli» shu id bilan. */
  id: number;
  /** Musbat summa, so'm. */
  amount: number;
  /** To'lov turi nomi («Naqd»). */
  method: string;
  fromCashbox: string;
  toCashbox: string;
  /** Jo'natilgan kun va soat (jurnaldagi `date`/`time`). */
  sentDate: string;
  sentTime: string;
  /** Jo'natishdagi izoh. */
  note: string;
  /** Bekor qilingan lahza (ISO). */
  returnedAt: string;
  returnedBy: string;
  /** Bekor qilish sababi — botdan rad etilganda bo'sh. */
  comment: string;
  /** Qabul qilinganidan KEYIN bekor qilingan (pul rahbar kassadan qaytarilgan). */
  afterConfirm: boolean;
}
