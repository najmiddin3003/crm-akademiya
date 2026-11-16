// KUNLIK TOPSHIRUV — klient va server uchun umumiy turlar (lib/dailyHandover.ts). Bu faylda server
// importi YO'Q: «Topshiruvni qabul qilish» oynasi kupyuralar ro'yxatini shu yerdan oladi.

export const DENOMINATIONS = [200_000, 100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000] as const;

export interface HandoverCard {
  cashboxId: number;
  name: string;
  moderator: string;
  /** Hozir kassada (tasdiq kutayotgan chiquvchilar ayrilgan), to'lov turi bo'yicha. */
  methods: Record<string, number>;
  total: number;
  /** Kassir jo'natgan, rahbar tasdiqlashi kerak bo'lgan ko'chirmalar. */
  pending: { total: number; methods: Record<string, number>; inIds: number[]; date: string; time: string } | null;
  /** Oxirgi qabul qilingan topshiruv. */
  last: { date: string; time: string; diff: number } | null;
}

export interface HandoverRecord {
  id: string;
  date: string;
  time: string;
  cashboxId: number;
  cashboxName: string;
  moderator: string;
  naqd: number;
  plastik: number;
  other: number;
  total: number;
  diff: number;
  acceptedBy: string;
  note: string;
}

export interface DailyHandoverPayload {
  ok: true;
  today: string;
  now: string;
  primary: { id: number; name: string; moderator: string };
  methodNames: Record<string, string>;
  cards: HandoverCard[];
  month: string;
  records: HandoverRecord[];
}
