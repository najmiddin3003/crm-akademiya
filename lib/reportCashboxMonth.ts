import type { Db } from "mongodb";
import { normalizeCashbox } from "@/lib/cashboxes";
import { loadPaymentMethods } from "@/lib/paymentMethods";
import { loadPendingOut } from "@/lib/transferPending";

// HISOBOTLAR → «Kirim va chiqim» · KASSALAR (26-qism, rasm 37/38, 13.11.2026).
//
// Har kassa va to'lov turi kesimida bitta oy: oy boshidagi qoldiq, kirim, chiqim,
// ko'chirish va oy oxiridagi (joriy oyda — HOZIRGI) qoldiq.
//
// HISOB YO'NALISHI — HOZIRGI QOLDIQDAN ORQAGA. Manba ikkita:
//   • `cashboxes.methodTotals` — Moliya → Kassalar sahifasidagi qoldiq (yagona haqiqat);
//   • `transaction_entries` — kassa jurnali (kirim `payIn`, chiqim `payOut`,
//     ko'chirish `transfer`).
//
//     oy oxiri  = hozirgi qoldiq − (oydan KEYINGI sanali yozuvlar)
//     oy boshi  = oy oxiri − (kirim + chiqim + ko'chirish)
//
// Shu bilan joriy oyning oxirgi ustuni Kassalar sahifasidagi raqamga AYNAN teng
// (jurnalda kelajak sanali yozuv bo'lmasa) va har qatorda
// «boshi + kirim + chiqim + ko'chirish = oxiri» doim bajariladi. Jurnal invarianti
// (scripts/_verify-cashbox-invariant.mjs) buzilgan bo'lsa farq eng eski oy
// boshiga tushadi — joriy qoldiqqa emas.
//
// QAYSI YOZUV QOLDIQQA TA'SIR QILGAN (invariant skripti bilan bir xil qoida):
//   • bekor qilingan (`status: "cancelled"`) — yo'q;
//   • ✓ kutayotgan ko'chirmaning qabul qiluvchi (musbat) tomoni — hali yo'q;
//   • yangi qoidadagi (`deductedOnSend: false`) jo'natuvchi tomoni — hali yo'q:
//     pul jo'natuvchida turibdi, kartochkada «yo'lda» (lib/transferPending.ts).
// Ko'chirma tasdiqlanganda yozuv sanasi o'zgarmaydi — u o'z sanasidagi oyga tushadi.
//
// TO'LOV TURI: yozuvdagi `paymentMethodKey`; eski yozuvlarda faqat `paymentType`
// (nom) — Sozlamalardagi ro'yxatdan nom bo'yicha kalitga o'giriladi, topilmasa nomning
// o'zi alohida qator bo'ladi (pul yo'qolmasin).

export interface CashMonthCells {
  start: number;
  kirim: number;
  chiqim: number;
  kochirish: number;
  end: number;
}

export interface CashMonthBox {
  id: number;
  name: string;
  branchId: number | null;
  isPrimary: boolean;
  archived: boolean;
  moderator: string;
  /** Mas'ul xodim vazifasi (o'zbekcha yorliq — mijoz t() bilan tarjima qiladi). */
  moderatorRole: string;
  /** ✓ kutayotgan chiquvchi ko'chirmalar — HOZIR (faqat joriy oyda ma'noli). */
  pendingOut: number;
  /** To'lov turi kaliti → kataklar. Faqat harakati yoki qoldig'i bor turlar. */
  methods: Record<string, CashMonthCells>;
  total: CashMonthCells;
}

export interface CashMonthReport {
  month: string;
  from: string;
  /** Oyning oxirgi kuni yoki (joriy oyda) bugun. */
  to: string;
  current: boolean;
  asOf: { date: string; time: string };
  methods: { key: string; name: string }[];
  cashboxes: CashMonthBox[];
}

/** Jurnal yig'indisi: kassa × to'lov turi × bo'lak. */
export interface LedgerSum {
  cashboxId: number;
  key: string | null;
  paymentType: string | null;
  /** "payIn" | "payOut" | "transfer" | boshqa tur — oy ichida; "after" — oydan keyin. */
  bucket: string;
  sum: number;
}

export interface FoldInput {
  cashboxes: {
    id: number;
    name: string;
    branchId?: number | null;
    isPrimary?: boolean;
    archived?: boolean;
    moderator?: string;
    moderatorRole?: string;
    methodTotals: Record<string, number>;
  }[];
  methods: { key: string; name: string }[];
  sums: LedgerSum[];
  pending: Map<number, Record<string, number>>;
}

const zero = (): CashMonthCells => ({ start: 0, kirim: 0, chiqim: 0, kochirish: 0, end: 0 });
const norm = (s: string) => s.trim().toLowerCase().replace(/[‘’ʼ`´]/g, "'");

/** Nomdan to'lov turi kaliti (eski yozuvlar); topilmasa — `name:<nom>`. */
export function methodKeyOf(key: string | null, paymentType: string | null, methods: readonly { key: string; name: string }[]): string {
  if (key) return key;
  const n = norm(paymentType ?? "");
  const hit = methods.find((m) => norm(m.name) === n);
  if (hit) return hit.key;
  return `name:${(paymentType ?? "").trim() || "—"}`;
}

/** Sof hisob (DB'siz) — node sinovi shu funksiyani tekshiradi. */
export function foldCashboxMonth(input: FoldInput): { methods: { key: string; name: string }[]; cashboxes: CashMonthBox[] } {
  const extra = new Map<string, string>();
  const flows = new Map<string, { kirim: number; chiqim: number; kochirish: number; after: number }>();
  for (const s of input.sums) {
    const key = methodKeyOf(s.key, s.paymentType, input.methods);
    if (key.startsWith("name:")) extra.set(key, key.slice(5));
    const id = `${s.cashboxId}|${key}`;
    const f = flows.get(id) ?? { kirim: 0, chiqim: 0, kochirish: 0, after: 0 };
    const a = Number(s.sum) || 0;
    if (s.bucket === "after") f.after += a;
    else if (s.bucket === "payIn") f.kirim += a;
    else if (s.bucket === "payOut") f.chiqim += a;
    // `transfer` va noma'lum tur — ko'chirish ustuniga: qoldiqqa ta'sir qilgan, lekin
    // kirim/chiqim (daromad/xarajat) emas. Bugun bazada faqat uch tur bor.
    else f.kochirish += a;
    flows.set(id, f);
  }

  const methods = [...input.methods, ...[...extra].map(([key, name]) => ({ key, name }))];
  const cashboxes: CashMonthBox[] = input.cashboxes.map((c) => {
    const byMethod: Record<string, CashMonthCells> = {};
    const total = zero();
    for (const m of methods) {
      const f = flows.get(`${c.id}|${m.key}`);
      const now = Number(c.methodTotals?.[m.key]) || 0;
      const end = now - (f?.after ?? 0);
      const kirim = f?.kirim ?? 0;
      const chiqim = f?.chiqim ?? 0;
      const kochirish = f?.kochirish ?? 0;
      const cells: CashMonthCells = { start: end - kirim - chiqim - kochirish, kirim, chiqim, kochirish, end };
      if (!cells.start && !kirim && !chiqim && !kochirish && !end) continue;
      byMethod[m.key] = cells;
      total.start += cells.start;
      total.kirim += kirim;
      total.chiqim += chiqim;
      total.kochirish += kochirish;
      total.end += end;
    }
    const pend = input.pending.get(c.id) ?? {};
    return {
      id: c.id,
      name: c.name,
      branchId: typeof c.branchId === "number" ? c.branchId : null,
      isPrimary: !!c.isPrimary,
      archived: !!c.archived,
      moderator: c.moderator ?? "",
      moderatorRole: c.moderatorRole ?? "",
      pendingOut: Object.values(pend).reduce((a, b) => a + (Number(b) || 0), 0),
      methods: byMethod,
      total,
    };
  });
  return { methods, cashboxes };
}

const ROLE_LABELS: Record<string, string> = { teacher: "O'qituvchi", moderator: "Moderator", admin: "Administrator", staff: "Xodim" };

/** Mas'ul xodimlar vazifasi: Rollar'dagi nom (qo'lda qo'shilgan rol) yoki lavozim yorlig'i. */
async function moderatorRoles(db: Db, names: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (names.length === 0) return out;
  const emps = await db
    .collection("hr_employees")
    .find(
      { name: { $in: names }, $or: [{ archReason: { $exists: false } }, { archReason: null }, { archReason: "" }] },
      { projection: { _id: 0, name: 1, turi: 1, centerRoleId: 1 } },
    )
    .toArray();
  const roleIds = [...new Set(emps.map((e) => Number(e.centerRoleId)).filter((n) => Number.isFinite(n)))];
  const roles = roleIds.length
    ? new Map((await db.collection("roles").find({ id: { $in: roleIds } }, { projection: { _id: 0, id: 1, name: 1 } }).toArray()).map((r) => [Number(r.id), String(r.name ?? "")]))
    : new Map<number, string>();
  for (const e of emps) {
    const rid = Number(e.centerRoleId);
    const label = Number.isFinite(rid) && e.centerRoleId !== null ? roles.get(rid) || ROLE_LABELS.staff : ROLE_LABELS[String(e.turi ?? "")] ?? "";
    out.set(String(e.name).trim(), label);
  }
  return out;
}

/**
 * @param month "YYYY-MM"
 * @param today Toshkent bugungi kuni ("YYYY-MM-DD")
 * @param cashboxFilter kassalar qamrovi — admin uchun `{}`, xodim uchun o'z kassasi
 *   (`{ moderator: nameEq(ism) }`, app/api/cashboxes/route.ts bilan bir xil). Filtr route'da
 *   quriladi: bu modul next/headers'ga bog'lanmasin (node sinovi uni to'g'ridan-to'g'ri yuklaydi).
 */
export async function loadCashboxMonth(
  db: Db,
  month: string,
  today: string,
  now: { date: string; time: string },
  cashboxFilter: Record<string, unknown>,
): Promise<CashMonthReport> {
  const from = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const monthEndIso = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
  const current = today.slice(0, 7) === month;

  const [methods, rows] = await Promise.all([
    loadPaymentMethods(db),
    db.collection("cashboxes").find(cashboxFilter, { projection: { _id: 0 } }).sort({ id: 1 }).toArray(),
  ]);
  const keys = methods.map((x) => x.key);
  const boxes = rows.map((r) => normalizeCashbox({ isPrimary: false, ...r }, keys));
  const ids = boxes.map((b) => b.id);

  const [sums, pending, roles] = await Promise.all([
    ids.length === 0
      ? Promise.resolve([] as LedgerSum[])
      : db
          .collection("transaction_entries")
          .aggregate<{ _id: { c: number; k: string | null; p: string | null; b: string }; sum: number }>([
            {
              $match: {
                cashboxId: { $in: ids },
                date: { $gte: from },
                status: { $ne: "cancelled" },
                $nor: [
                  { status: "waiting", amount: { $gt: 0 } },
                  { status: "waiting", deductedOnSend: false },
                ],
              },
            },
            {
              $group: {
                _id: {
                  c: "$cashboxId",
                  k: { $ifNull: ["$paymentMethodKey", null] },
                  p: { $ifNull: ["$paymentType", null] },
                  b: { $cond: [{ $gt: ["$date", monthEndIso] }, "after", { $ifNull: ["$txType", ""] }] },
                },
                sum: { $sum: "$amount" },
              },
            },
          ])
          .toArray()
          .then((list) => list.map((r) => ({ cashboxId: r._id.c, key: r._id.k, paymentType: r._id.p, bucket: r._id.b, sum: r.sum }))),
    loadPendingOut(db, ids),
    moderatorRoles(db, [...new Set(boxes.map((b) => String(b.moderator ?? "").trim()).filter(Boolean))]),
  ]);

  const folded = foldCashboxMonth({
    cashboxes: boxes.map((b) => ({ ...b, moderatorRole: roles.get(String(b.moderator ?? "").trim()) ?? "" })),
    methods: methods.map((x) => ({ key: x.key, name: x.name })),
    sums,
    pending,
  });
  return {
    month,
    from,
    to: current ? today : monthEndIso,
    current,
    asOf: now,
    ...folded,
  };
}
