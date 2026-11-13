// HISOBOTLAR → MOLIYA → «TO'LOV TURLARI» (yangi versiya, 26-qism, rasm 39–40, 13.11.2026).
//
// Sof hisob (React'siz): kartalar (oxirgi oy ulushi, oldingi oyga nisbatan p.p., oylar
// grafigi), «Kassalar bo'yicha» (oxirgi oy) va «Oylar bo'yicha» jadvallari. Sinovi —
// node --import ./scripts/_ts-alias.mjs bilan.
//
// RAQAMLAR Moliya analitikasi bilan BIR hisob: /api/transactions/summary qatorlari +
// lib/financeAnalytics.ts `addMoney` (faqat `income` — tushum; bekor qilish yozuvi tushumdan
// ayriladi). Filial/kassa tanlovi — `scope` (kassa raqamlari to'plami, null — hammasi).
//
// «KASSA BU TURNI QABUL QILADIMI» — tizimda bunday sozlama YO'Q (lib/paymentMethodUsage.ts).
// Bu yerda: oxirgi USAGE_DAYS kunda shu kassaga shu tur bilan tushum yozilgan (Sozlamalar →
// Kassalar bilan bir xil manba — `usage`) YOKI tanlangan oylarda shu kassada shu turdan
// musbat tushum bor. Ikkalasi ham yo'q bo'lsa jadvalda «–» (nol emas).

import type { Db } from "mongodb";
import { addMoney, emptyMoney, type MoneyTotals, type SummaryRow } from "@/lib/financeAnalytics";
import type { MethodUsage, UsageRow } from "@/lib/paymentMethodUsage";

export interface PmMethodDef {
  key: string;
  name: string;
  /** Nofaol tur faqat tanlangan oylarda tushumi bo'lsa ko'rinadi. */
  active: boolean;
}

export interface PmCashbox {
  id: number;
  name: string;
  /** Mas'ul (cashboxes.moderator). */
  owner?: string;
  isPrimary?: boolean;
  archived?: boolean;
  branchId?: number;
}

export interface PmPoint {
  month: string;
  sum: number;
  /** Oy tushumidagi ulush, %. Oyda tushum yo'q — null. */
  share: number | null;
}

export interface PmCard {
  key: string;
  name: string;
  series: PmPoint[];
  /** Oxirgi oy. */
  sum: number;
  share: number | null;
  /** Oxirgi oy ulushi − oldingi oy ulushi, foiz punkti (p.p.). Oldingi oy yo'q — null. */
  change: number | null;
  /** Shu turni qabul qiladigan FAOL kassalar (qamrovdagi). `all` — faol kassalar 2+ va hammasi. */
  coverage: { count: number; all: boolean; ids: number[] };
}

export interface PmCashRow {
  /** Kassa raqami; ro'yxatda yo'q kassa(lar)ning yozuvlari — bitta qator, id −1. */
  id: number;
  name: string;
  owner: string;
  isPrimary: boolean;
  unknown: boolean;
  /** Tur bo'yicha oxirgi oy tushumi; null — kassa bu turni qabul qilmaydi («–»). */
  cells: (number | null)[];
  total: number;
}

export interface PmReport {
  methods: { key: string; name: string }[];
  /** Tanlangan oylarda tushumsiz va qamrovdagi kassalarda ishlatilmagan FAOL turlar (nomlari). */
  hidden: string[];
  months: string[];
  /** Oxirgi oy ("YYYY-MM"), oylar bo'sh bo'lsa null. */
  last: string | null;
  cards: PmCard[];
  /** Kartalar grafigining umumiy shkalasi (0–scaleMax %), 10 ga karrali. */
  scaleMax: number;
  /** [oy][tur] tushum. */
  monthCells: number[][];
  /** Oy jami tushumi (hamma turlar). */
  monthTotals: number[];
  cashRows: PmCashRow[];
  /** Oxirgi oy, tur bo'yicha (qamrovdagi HAMMA yozuvlar — qatorlar yig'indisiga teng). */
  cashTotals: number[];
  lastTotal: number;
  rangeTotal: number;
  /** Faqat bitta kassada ishlatiladigan turlar (faol kassalar 2+ bo'lsa) — izoh uchun. */
  single: { cashboxId: number; keys: string[] }[];
}

export const UNKNOWN_CASHBOX_ID = -1;

const ZERO = (v: number) => Math.round(v) === 0;
const mkey = (a: string | number, b: string) => `${a}\u0000${b}`;

/** Kassa raqami (yo'q/noto'g'ri — 0). */
function cashboxOf(r: SummaryRow): number {
  const n = Number(r.cashbox);
  return Number.isFinite(n) ? n : 0;
}

export function computePaymentMethodReport(input: {
  rows: readonly SummaryRow[];
  /** Ko'rsatiladigan oylar (o'sish tartibida, joriy oydan oshmaydi). */
  months: readonly string[];
  /** Sozlamalar tartibida (sortPaymentMethods). */
  methods: readonly PmMethodDef[];
  cashboxes: readonly PmCashbox[];
  scope: ReadonlySet<number> | null;
  usage: MethodUsage | null;
  /** Ro'yxatda yo'q kalit uchun nom. */
  fallbackName: (key: string) => string;
}): PmReport {
  const { rows, methods, cashboxes, scope, usage } = input;
  const months = [...input.months];
  const monthSet = new Set(months);
  const last = months.length ? months[months.length - 1] : null;
  const inScope = (cb: number) => !scope || scope.has(cb);

  const perMonthKey = new Map<string, MoneyTotals>();
  const perKey = new Map<string, MoneyTotals>();
  const perCbKeyRange = new Map<string, MoneyTotals>();
  const perCbKeyLast = new Map<string, MoneyTotals>();
  const add = (map: Map<string, MoneyTotals>, k: string, r: SummaryRow) => {
    let m = map.get(k);
    if (!m) map.set(k, (m = emptyMoney()));
    addMoney(m, r);
  };
  for (const r of rows) {
    if (!r.month || !monthSet.has(r.month)) continue;
    const cb = cashboxOf(r);
    if (scope && !scope.has(cb)) continue;
    const key = r.method || "";
    add(perMonthKey, mkey(r.month, key), r);
    add(perKey, key, r);
    add(perCbKeyRange, mkey(cb, key), r);
    if (r.month === last) add(perCbKeyLast, mkey(cb, key), r);
  }
  const income = (map: Map<string, MoneyTotals>, k: string) => map.get(k)?.income ?? 0;

  // Qabul qiladimi: 90 kunlik ishlatilish YOKI tanlangan oylarda MUSBAT tushum (faqat bekor
  // qilish yozuvi — manfiy — qabul qilish belgisi emas).
  const usageSet = new Set<string>();
  for (const [key, list] of Object.entries(usage ?? {})) for (const u of list) usageSet.add(mkey(u.cashboxId, key));
  const accepts = (cb: number, key: string) => usageSet.has(mkey(cb, key)) || Math.round(income(perCbKeyRange, mkey(cb, key))) > 0;
  const activeIds = cashboxes.filter((c) => !c.archived && inScope(c.id)).map((c) => c.id);

  // Ko'rinadigan turlar (Sozlamalar tartibida): tanlangan oylarda tushumi bor YOKI qamrovdagi
  // faol kassada ishlatilgan (90 kun) faol turlar; so'ng ro'yxatda yo'q kalitlar (tushumi
  // kattasi oldin). Hech qayerda ishlatilmagan faol turlar — `hidden` (izohda nomi bilan).
  const hasIncome = (key: string) => !ZERO(income(perKey, key)) || months.some((m) => !ZERO(income(perMonthKey, mkey(m, key))));
  const used = (key: string) => activeIds.some((id) => usageSet.has(mkey(id, key)));
  const known = new Set(methods.map((m) => m.key));
  const shown: { key: string; name: string }[] = methods.filter((m) => hasIncome(m.key) || (m.active && used(m.key))).map((m) => ({ key: m.key, name: m.name }));
  const hidden = methods.filter((m) => m.active && !shown.some((x) => x.key === m.key)).map((m) => m.name);
  const extra = [...perKey.keys()].filter((k) => !known.has(k) && hasIncome(k)).sort((a, b) => income(perKey, b) - income(perKey, a));
  for (const k of extra) shown.push({ key: k, name: input.fallbackName(k) });

  const monthCells = months.map((m) => shown.map((x) => income(perMonthKey, mkey(m, x.key))));
  const monthTotals = monthCells.map((row) => row.reduce((a, v) => a + v, 0));
  const shareOf = (v: number, total: number) => (total > 0 ? (v / total) * 100 : null);

  const listed = new Map(cashboxes.map((c) => [c.id, c]));

  const n = months.length;
  const cards: PmCard[] = shown.map((x, j) => {
    const series = months.map((m, i) => ({ month: m, sum: monthCells[i][j], share: shareOf(monthCells[i][j], monthTotals[i]) }));
    const cur = n ? series[n - 1] : null;
    const prev = n > 1 ? series[n - 2] : null;
    const ids = activeIds.filter((id) => accepts(id, x.key));
    return {
      key: x.key,
      name: x.name,
      series,
      sum: cur?.sum ?? 0,
      share: cur?.share ?? null,
      change: cur && prev && cur.share !== null && prev.share !== null ? cur.share - prev.share : null,
      coverage: { count: ids.length, all: activeIds.length > 1 && ids.length === activeIds.length, ids },
    };
  });

  let maxShare = 0;
  for (const c of cards) for (const p of c.series) if (p.share !== null && p.share > maxShare) maxShare = p.share;
  const scaleMax = Math.min(100, Math.max(10, Math.ceil(maxShare / 10 - 1e-9) * 10));

  // Kassalar (oxirgi oy): qamrovdagi faol kassalar + shu oyda tushumi bor arxivdagilari;
  // ro'yxatda yo'q kassa raqamlari bitta «noma'lum» qatorga.
  const lastCells = (cbIds: number[]) => shown.map((x) => cbIds.reduce((a, cb) => a + income(perCbKeyLast, mkey(cb, x.key)), 0));
  const cashRows: PmCashRow[] = [];
  const ordered = cashboxes.filter((c) => inScope(c.id)).sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary) || a.id - b.id);
  for (const c of ordered) {
    const vals = lastCells([c.id]);
    if (c.archived && vals.every(ZERO)) continue;
    const cells = vals.map((v, j) => (ZERO(v) && !accepts(c.id, shown[j].key) ? null : v));
    cashRows.push({ id: c.id, name: c.name, owner: c.owner ?? "", isPrimary: !!c.isPrimary, unknown: false, cells, total: vals.reduce((a, v) => a + v, 0) });
  }
  const strays = [...new Set([...perCbKeyLast.keys()].map((k) => Number(k.split("\u0000")[0])))].filter((cb) => !listed.has(cb));
  if (strays.length) {
    const vals = lastCells(strays);
    if (!vals.every(ZERO)) {
      cashRows.push({ id: UNKNOWN_CASHBOX_ID, name: "", owner: "", isPrimary: false, unknown: true, cells: vals.map((v) => (ZERO(v) ? null : v)), total: vals.reduce((a, v) => a + v, 0) });
    }
  }
  const cashTotals = n ? monthCells[n - 1] : shown.map(() => 0);
  const lastTotal = n ? monthTotals[n - 1] : 0;

  // Izoh: «Terminal va Inkassa faqat bitta kassada: Rahbar kassasi».
  const singleMap = new Map<number, string[]>();
  if (activeIds.length > 1) {
    for (const c of cards) {
      if (c.coverage.count !== 1) continue;
      const id = c.coverage.ids[0];
      singleMap.set(id, [...(singleMap.get(id) ?? []), c.key]);
    }
  }

  return {
    methods: shown,
    hidden,
    months,
    last,
    cards,
    scaleMax,
    monthCells,
    monthTotals,
    cashRows,
    cashTotals,
    lastTotal,
    rangeTotal: monthTotals.reduce((a, v) => a + v, 0),
    single: [...singleMap].map(([cashboxId, keys]) => ({ cashboxId, keys })),
  };
}

/** «−5,2» / «+4,2» / «0» — foiz punkti, bitta kasr (o'zbekchada vergul). */
export function fmtPp(v: number, lang: string): string {
  const r = Math.round(v * 10) / 10;
  if (r === 0) return "0";
  const s = Math.abs(r).toFixed(1).replace(/\.0$/, "");
  return (r > 0 ? "+" : "−") + (lang === "en" ? s : s.replace(".", ","));
}

/** «52%» (yo'q — «—»). */
export function fmtShare(v: number | null): string {
  return v === null ? "—" : `${Math.round(v)}%`;
}

/**
 * Oxirgi `days` kunda kassa × tur bo'yicha tushumlar soni — GET /api/payment-methods dagi
 * bilan AYNAN bir shart (payIn, bekor qilinmagan, tasdiq kutmayotgan; `date` — satr).
 */
export async function loadUsageRows(db: Db, since: string): Promise<UsageRow[]> {
  const rows = await db
    .collection("transaction_entries")
    .aggregate<{ _id: { cashboxId: unknown; key: string | null }; count: number }>([
      { $match: { txType: "payIn", status: { $nin: ["waiting", "cancelled"] }, date: { $gte: since } } },
      { $group: { _id: { cashboxId: "$cashboxId", key: "$paymentMethodKey" }, count: { $sum: 1 } } },
    ])
    .toArray();
  return rows.map((r) => ({ cashboxId: Number(r._id.cashboxId), key: String(r._id.key ?? ""), count: r.count }));
}
