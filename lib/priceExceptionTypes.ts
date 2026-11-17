// HISOBOTLAR → «CHEGIRMA VA ISTISNOLAR» (35-qism) — klient va server uchun umumiy.
// Server: lib/priceExceptions.ts; API: app/api/reports/exceptions.

export type ExceptionType = "chegirma" | "narx" | "qarz" | "dars";
export const EXCEPTION_TYPES: ExceptionType[] = ["chegirma", "narx", "qarz", "dars"];
export const EXCEPTION_LABELS: Record<ExceptionType, string> = { chegirma: "Chegirma", narx: "Alohida narx", qarz: "Kechirilgan qarz", dars: "Dars haqi" };

/** Bu ulushdan (%) yoki summadan katta imtiyoz direktor tasdig'isiz kuchga kirmaydi. */
export const APPROVAL_PERCENT = 30;
export const APPROVAL_SUM = 200_000;

export type ExceptionStatus = "pending" | "approved" | "rejected";

export interface PriceException {
  id: number;
  type: ExceptionType;
  pupilId: number;
  pupilName: string;
  groupId: number | null;
  groupLabel: string;
  branchId: number;
  /** Oylik (chegirma, alohida narx) — har oy; bir martalik (qarz, dars haqi) — bir marta. */
  monthly: boolean;
  /** Imtiyoz summasi (oylik bo'lsa — bir oyga). */
  amount: number;
  /** Guruh oylik narxi (yozilgan paytdagi). */
  basePrice: number | null;
  /** Chegirma foizi yoki alohida narx foizi (ma'lumot uchun). */
  percent: number | null;
  /** Bekor qilingan darslar soni (dars haqi). */
  lessons: number | null;
  /** Kuchga kiradigan oy / kun: oylik — "YYYY-MM" dan, bir martalik — "YYYY-MM-DD". */
  from: string;
  /** Oylik imtiyoz qaysi oygacha ("YYYY-MM"); `null` — muddatsiz. */
  to: string | null;
  reason: string;
  note: string;
  status: ExceptionStatus;
  createdAt: string;
  createdBy: string;
  decidedAt: string | null;
  decidedBy: string;
  decisionNote: string;
}

export interface ExceptionRow {
  key: string;
  id: number | null;
  type: ExceptionType;
  pupilName: string;
  groupLabel: string;
  branch: string;
  /** Shu oydagi ta'siri (manfiy emas, musbat summa). */
  monthAmount: number;
  amountLabel: string;
  reason: string;
  reasonSub: string;
  who: string;
  at: string;
  status: "pending" | "active" | "done" | "approved" | "rejected" | "open" | "coin";
  statusLabel: string;
  /** Oylik imtiyoz qaysi oygacha ("YYYY-MM") — holat yozuvi uchun. */
  until: string | null;
  needsApproval: boolean;
}

export interface ExceptionsReport {
  ok: true;
  month: string;
  rows: ExceptionRow[];
  kpi: Record<ExceptionType, { sum: number; pupils: number; count: number }>;
  total: number;
  revenue: number;
  pending: (PriceException & { branch: string; givenBy: { count: number; sum: number } })[];
  givers: { who: string; count: number; sum: number; branch: string }[];
  canApprove: boolean;
}
