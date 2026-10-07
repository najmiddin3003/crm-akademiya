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
}

const col = (db: Db) => db.collection<ActionDoc>(AI.actions);

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
  };
}

export async function createDraft(
  db: Db,
  input: Pick<ActionDoc, "userId" | "userName" | "kind" | "payload" | "fields">,
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
};

function statusForModel(v: AiActionView): string {
  switch (v.status) {
    case "done": return `confirmed by the user and saved (${v.resultText ?? "ok"})`;
    case "failed": return `confirmed but NOT saved: ${v.error ?? "error"}`;
    case "cancelled": return "cancelled by the user";
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
      .map((v) => `[Draft: ${KIND_FOR_MODEL[v.kind]} — ${statusForModel(v)}]`);
    return notes.length ? { role: m.role, content: `${m.content}\n\n${notes.join("\n")}`, at: m.at } : { role: m.role, content: m.content, at: m.at };
  });
}
