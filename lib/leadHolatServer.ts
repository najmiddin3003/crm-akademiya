import type { Db, Document, Filter } from "mongodb";
import {
  UNDO_MINUTES,
  canTransition,
  formatFirstLesson,
  holatMeta,
  holatOf,
  skippedSteps,
  type LeadGuruh,
  type LeadHolat,
  type LeadHolatEvent,
  type LeadHolatSnapshot,
  type LeadSinov,
} from "@/lib/leadHolat";
import type { Order } from "@/lib/ordersData";
import { uzStamp } from "@/lib/uzTime";

// LID HOLATINI O'ZGARTIRISH — server mantig'i (lib/leadHolat.ts izohiga qarang).
//
// Uch yo'l bitta joydan o'tadi: Lidlar sahifasi (POST /api/orders/:id/holat),
// Telegram tugmasi (app/api/telegram/webhook) va ESKI sahifalar — «Birinchi
// darsga yozilganlar», eski lid kartasi — PATCH /api/orders/:id orqali eski
// maydonlarni o'zgartirganda (`legacyHolatSync`). Har o'zgarish:
//   • o'zidan OLDINGI holatni `holatOldin` ga qo'yadi (bekor qilish uchun),
//   • `holatTarix` ga yozuv qo'shadi,
//   • eski maydonlarni sinxronlaydi — eski sahifalar, hisobotlar va
//     filtrlar shularni o'qiydi.
//
// Yozuv HOLAT SHARTI bilan (`holat` + `holatAt` eski qiymati): ikki oynadan
// (yoki CRM va Telegram'dan) bir vaqtda bosilsa ikkinchisi 409 oladi,
// birining ishini ikkinchisi jimgina bosib ketmaydi.

export type HolatResult = { ok: true; order: Order } | { ok: false; error: string; status: number };

export const HOLAT_CONFLICT = "Lid holati boshqa joyda o'zgargan — sahifani yangilab qayta urinib ko'ring";

/** Tarix va bekor qilish navbati shundan uzun bo'lmaydi (hujjat shishmasin). */
const TARIX_MAX = 100;
const OLDIN_MAX = 20;

/** Hozirgi holatning nusxasi — bekor qilinganda aynan shu tiklanadi. */
export function snapshotOf(o: Order, at: string, by: string): LeadHolatSnapshot {
  return {
    holat: holatOf(o),
    radSabab: o.radSabab ?? null,
    guruh: o.guruh ?? null,
    firstLesson: o.firstLesson ?? "",
    teacher: o.teacher ?? "",
    firstLessonStatus: o.firstLessonStatus ?? null,
    status: o.status ?? "",
    group: o.group ?? "",
    groupId: o.groupId ?? null,
    moderator: o.moderator ?? "",
    leadStatus: o.leadStatus ?? null,
    at,
    by,
  };
}

/** Joriy holat sharti — o'zgarish aynan o'qilgan holatdagi hujjatga tushsin. */
export function stateGuard(o: Order): Filter<Document> {
  return o.holat === undefined ? { holat: { $exists: false } } : { holat: o.holat, holatAt: o.holatAt ?? null };
}

/** `$push` — tarix va bekor qilish navbati, ikkalasi ham chegaralangan. */
function pushOf(snapshot: LeadHolatSnapshot, ev: LeadHolatEvent): Document {
  return {
    holatOldin: { $each: [snapshot], $slice: -OLDIN_MAX },
    holatTarix: { $each: [ev], $slice: -TARIX_MAX },
  };
}

/** Bir maydon ham `$set`, ham `$unset` da bo'lsa Mongo yozuvni rad etadi. */
function updateOf(set: Record<string, unknown>, unset: Record<string, "">, push: Document): Document {
  for (const k of Object.keys(set)) delete unset[k];
  const u: Document = { $set: set, $push: push };
  if (Object.keys(unset).length) u.$unset = unset;
  return u;
}

export interface HolatChange {
  to: LeadHolat;
  /** «Sinov darsiga yozish» oynasidan — CRM'da majburiy, Telegram'da yo'q. */
  sinov?: LeadSinov;
  /** «Guruhga qo'shish» oynasidan — o'quvchi allaqachon guruhga yozilgan. */
  guruh?: LeadGuruh;
  /** Lid aylangan o'quvchi — `orders.pupilId` (gamifikatsiya «Do'st olib keldi», TZ 4.12). */
  pupilId?: number;
  radSabab?: string;
  /** Kim — xodim ismi (CRM) yoki Telegram foydalanuvchisi. */
  by: string;
  via: "crm" | "telegram";
  /** Telegram tugmasi: kalit (`orders.leadStatus`) va yorlig'i (tarix uchun). */
  telegram?: { key: string; label: string };
  /** Moderator bo'sh bo'lsa shu odam biriktiriladi (faqat CRM). */
  assignModerator?: string;
}

/**
 * Holatni o'zgartiradi. `filter` — chaqiruvchining qamrovi (lid ko'rinadigan
 * shart, lib/leadScope.ts); Telegram yo'lida faqat `{ id }`.
 */
export async function applyHolatChange(db: Db, filter: Filter<Document>, order: Order, c: HolatChange): Promise<HolatResult> {
  const from = holatOf(order);
  if (!canTransition(from, c.to)) {
    return { ok: false, error: `«${holatMeta(from).nom}» holatidan «${holatMeta(c.to).nom}» ga o'tib bo'lmaydi`, status: 400 };
  }
  if (c.via === "crm") {
    if (c.to === "sinov" && !c.sinov) return { ok: false, error: "Sinov darsining sanasi va vaqtini kiriting", status: 400 };
    if (c.to === "guruh" && !c.guruh) return { ok: false, error: "Guruhni tanlang", status: 400 };
    if (c.to === "rad" && !c.radSabab) return { ok: false, error: "Rad etish sababini tanlang", status: 400 };
  }

  const now = new Date().toISOString();
  const set: Record<string, unknown> = { holat: c.to, holatAt: now, holatBy: c.by };
  const unset: Record<string, ""> = {};

  // Raddan qaytish — rad belgilari olinadi (keyingi bloklar ustidan yozadi).
  if (from === "rad" && c.to !== "rad") {
    unset.radSabab = "";
    if (order.status === "Bekor qilindi") set.status = "Yangi";
    if (order.firstLessonStatus === "RAD_ETDI") set.firstLessonStatus = "ALOQA_KERAK";
    if (order.leadStatus === "reject") unset.leadStatus = "";
  }
  if (c.to === "bog" && c.via === "crm") {
    // Telegram'dagi eski javob ("Keyinroq keladi") endi to'g'ri emas —
    // xabarda umumiy "📞 Bog'lanildi" chiqsin.
    unset.leadStatus = "";
  }
  if (c.to === "sinov" && c.sinov) {
    const fl = formatFirstLesson(c.sinov.sana, c.sinov.vaqt);
    const had = (order.firstLesson || "").trim();
    set.firstLesson = fl;
    if (c.sinov.oqituvchi) set.teacher = c.sinov.oqituvchi;
    set.firstLessonStatus = had && had !== fl ? "QAYTA_BELGILANDI" : "YOZILDI";
  }
  if (c.to === "guruh" && c.guruh) {
    set.guruh = c.guruh;
    set.group = c.guruh.nom;
    if (c.guruh.id > 0) set.groupId = c.guruh.id;
    if (c.pupilId) set.pupilId = c.pupilId;
    set.status = "Qabul qilindi";
    if ((order.firstLesson || "").trim()) set.firstLessonStatus = "GURUHGA_QOSHILDI";
  }
  if (c.to === "rad") {
    set.radSabab = c.radSabab || order.radSabab || "";
    set.status = "Bekor qilindi";
    if ((order.firstLesson || "").trim()) set.firstLessonStatus = "RAD_ETDI";
  }
  if (c.telegram) {
    set.leadStatus = c.telegram.key;
    // Eski shakl ("DD.MM.YYYY | HH:MM") — lib/ordersData.ts → leadStatusAt.
    set.leadStatusAt = uzStamp();
    set.leadStatusBy = c.by;
  }
  if (c.assignModerator && !(order.moderator || "").trim()) set.moderator = c.assignModerator;

  const skipped = skippedSteps(from, c.to);
  const ev: LeadHolatEvent = {
    at: now,
    kind: c.via === "telegram" ? "telegram" : "holat",
    holat: c.to,
    from,
    by: c.by,
    ...(c.telegram ? { text: c.telegram.label } : {}),
    ...(skipped.length ? { skipped } : {}),
    ...(c.to === "sinov" && c.sinov ? { sinov: c.sinov } : {}),
    ...(c.to === "guruh" && c.guruh ? { guruhNom: c.guruh.nom } : {}),
    ...(c.to === "rad" && set.radSabab ? { radSabab: String(set.radSabab) } : {}),
  };

  const res = await db
    .collection("orders")
    .findOneAndUpdate({ $and: [filter, stateGuard(order)] }, updateOf(set, unset, pushOf(snapshotOf(order, now, c.by), ev)), {
      returnDocument: "after",
      projection: { _id: 0 },
    });
  if (!res) return { ok: false, error: HOLAT_CONFLICT, status: 409 };
  return { ok: true, order: res as unknown as Order };
}

/**
 * Telegram tugmasi holatni O'ZGARTIRMAGANDA (masalan, "Bog'lanildi" dagi
 * lid uchun "Keyinroq keladi" → "To'lov qilmoqchi") — faqat tugma javobi
 * va tarix yozuvi. Bekor qilish navbatiga tushmaydi: holat o'sha-o'sha.
 */
export async function recordTelegramPress(db: Db, order: Order, key: string, label: string, by: string): Promise<Order | null> {
  const now = new Date().toISOString();
  const ev: LeadHolatEvent = { at: now, kind: "telegram", holat: holatOf(order), by, text: label };
  const res = await db.collection("orders").findOneAndUpdate(
    { id: order.id },
    {
      $set: { leadStatus: key, leadStatusAt: uzStamp(), leadStatusBy: by },
      $push: { holatTarix: { $each: [ev], $slice: -TARIX_MAX } } as Document,
    },
    { returnDocument: "after", projection: { _id: 0 } },
  );
  return (res as unknown as Order) ?? null;
}

/**
 * Oxirgi o'zgarishni bekor qiladi. {@link UNDO_MINUTES} ichida — lidni
 * ko'ra oladigan har kim, undan keyin — faqat direktor (admin).
 *
 * Guruhga yozishni bekor qilish o'quvchini GURUHDAN CHIQARMAYDI (mijoz
 * buni oldindan aytadi): guruhdan chiqarish to'lov va davomat yozuvlariga
 * tegadi — bu qo'lda, ongli qilinadigan ish.
 */
export async function undoHolatChange(db: Db, filter: Filter<Document>, order: Order, by: string, isAdmin: boolean): Promise<HolatResult> {
  const stack = Array.isArray(order.holatOldin) ? order.holatOldin : [];
  const last = stack[stack.length - 1];
  if (!last) return { ok: false, error: "Bekor qiladigan o'zgarish yo'q", status: 400 };
  const ageMin = (Date.now() - Date.parse(last.at)) / 60_000;
  if (!(ageMin <= UNDO_MINUTES) && !isAdmin) {
    return { ok: false, error: `${UNDO_MINUTES} daqiqa o'tdi — orqaga qaytarishni faqat direktor qila oladi`, status: 403 };
  }

  const now = new Date().toISOString();
  const set: Record<string, unknown> = {
    holat: last.holat,
    holatAt: now,
    holatBy: by,
    firstLesson: last.firstLesson,
    teacher: last.teacher,
    status: last.status,
    group: last.group,
    moderator: last.moderator,
  };
  const unset: Record<string, ""> = {};
  const opt = (k: string, v: unknown) => {
    if (v === null || v === undefined || v === "") unset[k] = "";
    else set[k] = v;
  };
  opt("radSabab", last.radSabab);
  opt("guruh", last.guruh);
  opt("firstLessonStatus", last.firstLessonStatus);
  opt("groupId", last.groupId);
  opt("leadStatus", last.leadStatus);

  const ev: LeadHolatEvent = { at: now, kind: "undo", holat: last.holat, from: holatOf(order), by };
  for (const k of Object.keys(set)) delete unset[k];
  const update: Document = {
    $set: set,
    $pop: { holatOldin: 1 },
    $push: { holatTarix: { $each: [ev], $slice: -TARIX_MAX } },
  };
  if (Object.keys(unset).length) update.$unset = unset;
  const res = await db
    .collection("orders")
    .findOneAndUpdate({ $and: [filter, stateGuard(order)] }, update, { returnDocument: "after", projection: { _id: 0 } });
  if (!res) return { ok: false, error: HOLAT_CONFLICT, status: 409 };
  return { ok: true, order: res as unknown as Order };
}

/**
 * PATCH /api/orders/:id tanasidan olib tashlanadigan maydonlar. Eski
 * sahifalar (OrdersContext.updateOrder) BUTUN hujjatni yuboradi — o'zining
 * eskirgan nusxasini. Holat, tarix va izohlarni o'z yo'llari yuritadi:
 * bu maydonlar tanadan yozilsa, oradagi Telegram bosilishi yoki boshqa
 * xodimning izohi jimgina o'chib ketardi.
 */
export const SERVER_MANAGED_ORDER_FIELDS = [
  "_id",
  "id",
  "branchId",
  "branchNo",
  "holat",
  "holatAt",
  "holatBy",
  "holatTarix",
  "holatOldin",
  "radSabab",
  "guruh",
  "tgMessage",
  "leadStatus",
  "leadStatusAt",
  "leadStatusBy",
  "comments",
] as const;

/** Holatga ta'sir qiladigan eski maydonlar. */
const LEGACY_KEYS = ["groupId", "group", "firstLesson", "firstLessonStatus", "status", "stage"] as const;

export interface LegacySync {
  set: Record<string, unknown>;
  unset: Record<string, "">;
  push?: Document;
  /** Holat o'zgarsa — yozuv shu shart bilan (parallel o'zgarishdan himoya). */
  guard?: Filter<Document>;
}

/**
 * Eski sahifa eski maydonni o'zgartirganda holatni ham shunga moslaydi —
 * masalan, «Birinchi darsga yozilganlar» da "Guruhga qo'shildi" yoki eski
 * kartada "Rad etish" bosilsa, Lidlar sahifasi ham, Telegram xabari ham
 * shuni ko'rsatadi.
 *
 * Holat faqat eski maydonlardan HISOBLANGAN natija o'zgarganda o'zgaradi:
 * sinovdagi lidning "Keldi/Kelmadi" belgisi holatga tegmaydi.
 */
export function legacyHolatSync(current: Order, patch: Partial<Order>, by: string): LegacySync {
  const out: LegacySync = { set: {}, unset: {} };
  // Guruh boshqa sahifada o'zgarsa — «Guruhga qo'shish» oynasidagi eski
  // tafsilot (jadval, 1-dars) endi boshqa guruhniki bo'lib qolmasin.
  if (("groupId" in patch && patch.groupId !== current.groupId) || ("group" in patch && patch.group !== current.group)) {
    if (current.guruh) out.unset.guruh = "";
  }
  if (!LEGACY_KEYS.some((k) => k in patch)) return out;

  const before = holatOf(current);
  const legacyBefore = holatOf({ ...current, holat: undefined });
  const legacyAfter = holatOf({ ...current, ...patch, holat: undefined });
  if (legacyAfter === legacyBefore || legacyAfter === before) return out;

  const now = new Date().toISOString();
  out.set = { holat: legacyAfter, holatAt: now, holatBy: by };
  if (legacyAfter === "rad" && typeof patch.note === "string" && patch.note.trim()) out.set.radSabab = patch.note.trim();
  if (before === "rad" && legacyAfter !== "rad") out.unset.radSabab = "";
  const ev: LeadHolatEvent = {
    at: now,
    kind: "holat",
    holat: legacyAfter,
    from: before,
    by,
    ...(out.set.radSabab ? { radSabab: String(out.set.radSabab) } : {}),
    ...(legacyAfter === "guruh" && (patch.group || current.group) ? { guruhNom: String(patch.group || current.group) } : {}),
  };
  out.push = pushOf(snapshotOf(current, now, by), ev);
  out.guard = stateGuard(current);
  return out;
}
