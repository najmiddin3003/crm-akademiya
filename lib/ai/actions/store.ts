import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { AI } from "../db";
import type { AiActionField, AiActionKind, AiActionStatus, AiActionView, AiChatMessage } from "../protocol";

// AMAL QORALAMALARI — `ai_actions`.
//
// OQIM: model vosita orqali qoralama so'raydi (lib/ai/tools/actions.ts) →
// server qiymatlarni tekshirib SHU YERGA `draft` qilib yozadi → panel
// kartani ko'rsatadi → xodim «Tasdiqlash» ni bosadi
// (app/api/ai/actions/[id]) → `claimDraft` qoralamani ATOMIK band qiladi →
// yadro yozadi (lib/ai/actions/execute.ts) → `finishAction`.
//
// NEGA MODEL TO'G'RIDAN-TO'G'RI YOZMAYDI: modelga matn kiradi (o'quvchi
// izohi, lid izohi, savol) va u matn ichidagi "buyruq"ga aldanishi mumkin.
// Yozuv faqat ODAM tugmani bosganda bo'ladi — bu bosish model qo'lida emas.
//
// IKKI MARTA BOSISH: `claimDraft` filtrida `status: "draft"` — ikkinchi
// bosish (yoki ikkinchi oyna) hujjatni topa olmaydi va hech narsa
// yozilmaydi. Xodimlar botidagi `claimDraftForSave` bilan bir xil g'oya.
//
// FAQAT EGASI: har so'rovda `userId` filtrda — boshqa xodim id'ni bilsa
// ham qoralamani tasdiqlay olmaydi.

/** Qoralama shuncha vaqt tasdiqlanishi mumkin — keyin eskiradi (kassa qoldig'i, oylik o'zgargan bo'lishi mumkin). */
export const DRAFT_TTL_MS = 15 * 60_000;

const PURGE_MS = 180 * 86_400_000;

export type StoredStatus = Exclude<AiActionStatus, "expired">;

export interface ActionDoc {
  id: string;
  userId: string;
  /** Kim tayyorlatdi — audit uchun, o'sha paytdagi ism. */
  userName: string;
  kind: AiActionKind;
  status: StoredStatus;
  /** Yadroga ketadigan, server tekshirgan qiymatlar (lib/ai/actions/prepare.ts). Modelga ko'rsatilmaydi. */
  payload: Record<string, unknown>;
  /** Kartadagi qatorlar. */
  fields: AiActionField[];
  createdAt: Date;
  draftUntil: Date;
  purgeAt: Date;
  confirmedAt?: Date;
  finishedAt?: Date;
  resultText?: string;
  resultHref?: string;
  /** Yadro qaytargan id'lar (jurnal yozuvi, lid) — audit uchun. */
  result?: Record<string, unknown>;
  error?: string;
  /** "Shu amal kimga/nimaga" kaliti (`draftSubject`) — eskisini almashtirish uchun. */
  subject?: string;
  /** Yangi qoralama bilan almashtirildi — yangisining id'si (status `cancelled`). */
  replacedBy?: string;
}

const col = (db: Db) => db.collection<ActionDoc>(AI.actions);

/**
 * QORALAMA NIMAGA TEGISHLI — "bir xil amal"ni tanish uchun kalit (09.10.2026).
 *
 * Xodim "yo'q, 350 000 bo'lsin" desa model YANGI qoralama tuzadi; eskisi
 * ham «Tasdiqlash» tugmasi bilan turaversa ikkalasi bosilib, pul ikki
 * marta yozilardi. Kalit — summa, to'lov turi, izoh KIRMAYDI (ular
 * o'zgartiriladigan narsa), faqat "kim va qayerda": shu o'quvchiga shu
 * kassadan, shu guruhning shu kuni va hokazo.
 */
export function draftSubject(kind: AiActionKind, p: Record<string, unknown>): string {
  const s = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim().toLowerCase());
  const digits = (v: unknown) => s(v).replace(/\D/g, "");
  switch (kind) {
    case "lead":
      return `lead|${digits(p.phone) || s(p.studentName)}|${s(p.course)}`;
    case "kirim":
    case "chiqim":
      return `${kind}|${s(p.cashboxId)}|${s(p.studentId) || s(p.studentName) || s(p.category)}`;
    case "transfer":
      return `transfer|${s(p.cashboxId)}|${s(p.toCashboxId)}`;
    case "comment":
      return `comment|${s(p.pupilId)}`;
    case "task": {
      const ids = Array.isArray(p.employeeIds) ? p.employeeIds.map(Number).sort((a, b) => a - b) : [];
      return `task|${ids.join(",")}`;
    }
    case "pupil": {
      const v = (p.values ?? {}) as Record<string, unknown>;
      return `pupil|${digits(v.phone) || `${s(v.firstName)} ${s(v.lastName)}`.trim()}`;
    }
    case "membership":
      return `membership|${s(p.pupilId)}|${s(p.groupId)}`;
    case "attendance":
      return `attendance|${s(p.groupId)}|${s(p.date)}`;
    case "status":
      return `status|${s(p.pupilId)}`;
    case "stage":
      return `stage|${s(p.orderId)}`;
  }
}

export function viewOf(d: ActionDoc, now = Date.now()): AiActionView {
  const expired = d.status === "draft" && new Date(d.draftUntil).getTime() <= now;
  return {
    id: d.id,
    kind: d.kind,
    status: expired ? "expired" : d.status,
    fields: d.fields ?? [],
    expiresAt: new Date(d.draftUntil).toISOString(),
    ...(d.resultText ? { resultText: d.resultText } : {}),
    ...(d.resultHref ? { resultHref: d.resultHref } : {}),
    ...(d.error ? { error: d.error } : {}),
    ...(d.replacedBy ? { replacedBy: d.replacedBy } : {}),
  };
}

export async function createDraft(
  db: Db,
  input: Pick<ActionDoc, "userId" | "userName" | "kind" | "payload" | "fields" | "subject">,
): Promise<ActionDoc> {
  const now = new Date();
  const doc: ActionDoc = {
    id: randomUUID(),
    ...input,
    status: "draft",
    createdAt: now,
    draftUntil: new Date(now.getTime() + DRAFT_TTL_MS),
    purgeAt: new Date(now.getTime() + PURGE_MS),
  };
  await col(db).insertOne({ ...doc });
  return doc;
}

export async function findAction(db: Db, userId: string, id: string): Promise<ActionDoc | null> {
  return col(db).findOne({ id, userId }, { projection: { _id: 0 } });
}

/** Suhbat qayta ochilganda — kartalarning HOZIRGI holati (faqat egasiniki). */
export async function actionViews(db: Db, userId: string, ids: readonly string[]): Promise<Map<string, AiActionView>> {
  const out = new Map<string, AiActionView>();
  if (ids.length === 0) return out;
  const rows = await col(db).find({ userId, id: { $in: [...ids] } }, { projection: { _id: 0 } }).toArray();
  const now = Date.now();
  for (const r of rows) out.set(r.id, viewOf(r, now));
  return out;
}

/**
 * Tasdiqlash: qoralamani ATOMIK band qiladi (`draft` → `executing`).
 * `null` — topilmadi, egasi boshqa, allaqachon bosilgan yoki muddati o'tgan.
 */
export async function claimDraft(db: Db, userId: string, id: string): Promise<ActionDoc | null> {
  const now = new Date();
  return col(db).findOneAndUpdate(
    { id, userId, status: "draft", draftUntil: { $gt: now } },
    { $set: { status: "executing", confirmedAt: now } },
    { returnDocument: "after", projection: { _id: 0 } },
  );
}

export type ActionOutcome =
  | { ok: true; resultText: string; resultHref: string; result: Record<string, unknown> }
  | { ok: false; error: string };

export async function finishAction(db: Db, id: string, outcome: ActionOutcome): Promise<ActionDoc | null> {
  const set = outcome.ok
    ? { status: "done" as const, resultText: outcome.resultText, resultHref: outcome.resultHref, result: outcome.result }
    : { status: "failed" as const, error: outcome.error };
  return col(db).findOneAndUpdate(
    { id, status: "executing" },
    { $set: { ...set, finishedAt: new Date() } },
    { returnDocument: "after", projection: { _id: 0 } },
  );
}

/** Bekor qilish — faqat hali tasdiqlanmagan qoralama (muddati o'tgani ham). */
export async function cancelDraft(db: Db, userId: string, id: string): Promise<ActionDoc | null> {
  return col(db).findOneAndUpdate(
    { id, userId, status: "draft" },
    { $set: { status: "cancelled", finishedAt: new Date() } },
    { returnDocument: "after", projection: { _id: 0 } },
  );
}

/**
 * Eski qoralamalarni yangisi bilan ALMASHTIRISH (bekor qilish) — ikki
 * yo'l bilan topiladi:
 *   • `ids` — model o'zi aytgan (`replacesDraftId`): xodim o'quvchini yoki
 *     oyni almashtirgan bo'lsa ham shu yo'l ishlaydi;
 *   • `subject` — shu amalning (`draftSubject`) OLDINGI so'rovlarda tuzilgan
 *     va hali tasdiqlanmagan qoralamasi — model id'ni aytishni unutsa ham.
 *     Shu so'rovning o'zida tuzilganlar (`before` dan keyingi) tegilmaydi:
 *     "Aliga 300 000, Valiga 200 000" — bitta javobdagi ikki alohida amal.
 * Har biri ATOMIK (`status: "draft"` filtrda) — xodim eskisini aynan shu
 * paytda tasdiqlagan bo'lsa, u tasdiqlanganicha qoladi.
 */
export async function supersedeDrafts(
  db: Db,
  input: { userId: string; kind: AiActionKind; replacedBy: string; ids: readonly string[]; subject: string; before: Date },
): Promise<ActionDoc[]> {
  const candidates = await col(db)
    .find(
      {
        userId: input.userId,
        kind: input.kind,
        status: "draft",
        id: { $ne: input.replacedBy },
        $or: [{ id: { $in: [...input.ids] } }, { subject: input.subject, createdAt: { $lt: input.before } }],
      },
      { projection: { _id: 0, id: 1 } },
    )
    .limit(20)
    .toArray();
  const out: ActionDoc[] = [];
  for (const c of candidates) {
    const d = await col(db).findOneAndUpdate(
      { id: c.id, userId: input.userId, status: "draft" },
      { $set: { status: "cancelled", finishedAt: new Date(), replacedBy: input.replacedBy } },
      { returnDocument: "after", projection: { _id: 0 } },
    );
    if (d) out.push(d);
  }
  return out;
}

/** Kartadagi qizil qator (warning) — i18n skaneri text maydonidagi andozani kalit qiladi (messages/en.json). */
export function alreadySavedWarning(time: string, ref: string): { text: string } {
  return { text: `Shu amal ${time} da allaqachon saqlangan (${ref}) — ikkinchi marta yozilmasin.` };
}

/**
 * Shu amal (`subject`) yaqinda ALLAQACHON saqlanganmi — yangi kartada
 * ogohlantirish uchun ("Aliga 300 000 saqlandi" → "aslida 350 000 edi"
 * deyilsa, model ikkinchi kirim tuzmasin, xodim esa ko'rib tursin).
 */
export async function recentlySaved(
  db: Db,
  input: { userId: string; kind: AiActionKind; subject: string; sinceMs: number },
): Promise<ActionDoc | null> {
  return col(db).findOne(
    { userId: input.userId, kind: input.kind, subject: input.subject, status: "done", finishedAt: { $gte: new Date(Date.now() - input.sinceMs) } },
    { projection: { _id: 0 }, sort: { finishedAt: -1 } },
  );
}

// ── Suhbat bilan bog'lash ───────────────────────────────────────────

/** Saqlangan xabarlarga kartalarning HOZIRGI holatini qo'yadi (panel uchun); `actionIds` mijozga ketmaydi. */
export async function attachActionViews(db: Db, userId: string, messages: readonly AiChatMessage[]): Promise<AiChatMessage[]> {
  const ids = messages.flatMap((m) => m.actionIds ?? []);
  const views = await actionViews(db, userId, ids);
  return messages.map(({ actionIds, ...m }) => {
    const actions = (actionIds ?? []).map((id) => views.get(id)).filter((v): v is AiActionView => !!v);
    return actions.length ? { ...m, actions } : m;
  });
}

const KIND_FOR_MODEL: Record<AiActionKind, string> = {
  lead: "new lead",
  kirim: "income (kirim)",
  chiqim: "expense (chiqim)",
  transfer: "cashbox transfer (after saving, the receiving cashbox still has to accept it)",
  comment: "student comment",
  task: "staff task",
  pupil: "new student",
  membership: "group membership change",
  attendance: "attendance marks",
  // Qo'shtirnoqda — i18n skaneri `status: "…"` ni interfeys qiymati deb o'qimasin (bu matn modelga).
  "status": "student status change",
  "stage": "lead stage change",
};

function statusForModel(v: AiActionView): string {
  switch (v.status) {
    case "done": return `confirmed by the user and saved (${v.resultText ?? "ok"})`;
    // "NOT saved" deyilmaydi: yadro xatosi pul yozilgandan KEYIN ham bo'lishi
    // mumkin (route'dagi "saqlanmagan bo'lishi mumkin") — model qayta tuzmasin.
    case "failed": return `confirmed, but saving failed (${v.error ?? "unknown reason"}). Part of it may already be saved — do not prepare it again unless the user checked the CRM and asks`;
    case "cancelled": return v.replacedBy ? `replaced by a newer draft ${v.replacedBy} (this one is not saved)` : "cancelled by the user";
    case "expired": return "expired without confirmation (not saved)";
    case "executing": return "being saved";
    default: return "waiting for the user's confirmation (not saved yet)";
  }
}

/**
 * Modelga ketadigan tarix: javob matniga uning qoralamalari QANDAY tugagani
 * qo'shiladi — xodim "saqlandimi?" deb so'rasa model taxmin qilmasin.
 */
export function historyWithActionNotes(messages: readonly AiChatMessage[], views: Map<string, AiActionView>): AiChatMessage[] {
  return messages.map((m) => {
    const notes = (m.actionIds ?? [])
      .map((id) => views.get(id))
      .filter((v): v is AiActionView => !!v)
      // Id ham — model keyingi savolda eskisini `replacesDraftId` bilan almashtira olsin.
      .map((v) => `[Draft ${v.id}: ${KIND_FOR_MODEL[v.kind]} — ${statusForModel(v)}]`);
    return notes.length ? { role: m.role, content: `${m.content}\n\n${notes.join("\n")}`, at: m.at } : { role: m.role, content: m.content, at: m.at };
  });
}
