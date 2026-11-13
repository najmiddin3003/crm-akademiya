import { ALL_PERMISSION_PATHS } from "@/lib/permissions";
import {
  GRANTABLE_ROWS,
  revertRow,
  rowByKey,
  rowState,
  sameAccess,
  setRowLevel,
  type Access,
  type AccessRow,
  type RowState,
} from "@/lib/accessRows";

// XODIMGA ALOHIDA RUXSAT — QATOR BO'YICHA AMAL (25-qism, «Alohida ruxsat» paneli).
//
// Saqlash avvalgidek: `hr_employees.permissions` — xodimning TO'LIQ sahifalar ro'yxati, lavozimdan
// USTUN (lib/rolePermissions.ts). Panel esa qator bilan ishlaydi («Moliya · Oylik»ni qo'shish,
// «Gamifikatsiya»ni cheklash): amal joriy ro'yxatga qo'llanadi va natija rolnikiga TENG bo'lsa
// istisno umuman olib tashlanadi (`null`) — «alohida ruxsat yo'q» holati ro'yxatda osilib qolmasin.
//
// Sababi va kim qilgani — `hr_employees.accessNotes` (oxirgi 50 ta). Bu fayl SOF: server route'i
// (app/api/roles/overrides/[id]) va sinov shu yerdan.

export type OverrideOp = "add" | "restrict" | "revert" | "reset";
export type AccessNoteKind = OverrideOp | "role";

export interface AccessNote {
  kind: AccessNoteKind;
  /** Qator kaliti (lib/accessRows.ts); `reset` va `role` da bo'sh. */
  row: string;
  /** Sabab — `add`/`restrict` da majburiy. */
  reason: string;
  /** Qator holati: rolda/oldin → keyin (`add`/`restrict`/`revert`). */
  from: RowState | null;
  to: RowState | null;
  /** `role` — rol nomi: oldin → keyin. */
  roleFrom?: string;
  roleTo?: string;
  byName: string;
  byId: number | null;
  /** ISO vaqt. */
  at: string;
}

export const REASON_MAX = 200;
export const NOTES_KEEP = 50;

export type OverrideResult =
  | { ok: true; next: string[] | null; row: AccessRow | null; from: RowState | null; to: RowState | null }
  | { ok: false; status: 400; error: string };

const bad = (error: string): OverrideResult => ({ ok: false, status: 400, error });

/**
 * Amalni qo'llaydi. `own` — xodimning hozirgi alohida ruxsati (`null` — yo'q, rol bo'yicha);
 * `roleAccess` — ROLDAN keladigan ruxsat (`null` — cheklovsiz rol).
 * Natija `next`: saqlanadigan `hr_employees.permissions` (`null` — istisno yo'q).
 */
export function applyOverrideOp(own: Access, roleAccess: Access, op: OverrideOp, rowKey?: string | null): OverrideResult {
  if (op === "reset") return { ok: true, next: null, row: null, from: null, to: null };

  const row = rowKey ? rowByKey(rowKey) : undefined;
  if (!row || !GRANTABLE_ROWS.includes(row)) return bad("Bo'lim topilmadi");

  const roleList = roleAccess ?? ALL_PERMISSION_PATHS;
  const base: string[] = own ?? [...roleList];
  const from = rowState(row, base);

  let next: string[];
  if (op === "add") {
    if (from.level === "full") return bad("Bu bo'lim xodimda allaqachon to'liq ochiq");
    next = setRowLevel(base, row, true);
  } else if (op === "restrict") {
    if (from.level === "none" || from.level === "own") return bad("Bu bo'lim xodimda allaqachon yopiq");
    next = setRowLevel(base, row, false);
  } else {
    next = revertRow(base, roleAccess, row);
  }
  const to = rowState(row, next);
  // Rolnikiga teng — istisno kerak emas.
  const stored = sameAccess(next, roleList) ? null : next;
  return { ok: true, next: stored, row, from, to };
}

/** Sabab: bo'sh joylar qisqartiriladi; `add`/`restrict` da majburiy. */
export function cleanReason(raw: unknown, op: OverrideOp): { ok: true; reason: string } | { ok: false; error: string } {
  const reason = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if ((op === "add" || op === "restrict") && !reason) return { ok: false, error: "Sababini yozing — u jurnalda qoladi" };
  if (reason.length > REASON_MAX) return { ok: false, error: `Sabab ${REASON_MAX} belgidan oshmasin` };
  return { ok: true, reason };
}

export function isOverrideOp(v: unknown): v is OverrideOp {
  return v === "add" || v === "restrict" || v === "revert" || v === "reset";
}

/** Bazadagi yozuvlarni tozalaydi (eskilari / qo'lda o'zgartirilgani buzilgan bo'lsa). Yangisi birinchi. */
export function readNotes(raw: unknown): AccessNote[] {
  if (!Array.isArray(raw)) return [];
  const out: AccessNote[] = [];
  for (const n of raw) {
    if (!n || typeof n !== "object") continue;
    const x = n as Record<string, unknown>;
    const kind = x.kind;
    if (kind !== "add" && kind !== "restrict" && kind !== "revert" && kind !== "reset" && kind !== "role") continue;
    const state = (v: unknown): RowState | null => {
      if (!v || typeof v !== "object") return null;
      const s = v as Record<string, unknown>;
      const level = s.level;
      if (level !== "full" && level !== "partial" && level !== "none" && level !== "own") return null;
      return { level, on: Number(s.on) || 0, total: Number(s.total) || 0 };
    };
    out.push({
      kind,
      row: typeof x.row === "string" ? x.row : "",
      reason: typeof x.reason === "string" ? x.reason : "",
      from: state(x.from),
      to: state(x.to),
      ...(typeof x.roleFrom === "string" ? { roleFrom: x.roleFrom } : {}),
      ...(typeof x.roleTo === "string" ? { roleTo: x.roleTo } : {}),
      byName: typeof x.byName === "string" ? x.byName : "",
      byId: typeof x.byId === "number" ? x.byId : null,
      at: typeof x.at === "string" ? x.at : x.at instanceof Date ? x.at.toISOString() : "",
    });
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** Qatorning ENG OXIRGI yozuvi — u «qo'shildi/cheklandi» bo'lsa, panelda sababi ko'rsatiladi. */
export function latestReasonFor(notes: AccessNote[], rowKey: string): AccessNote | null {
  const last = notes.find((n) => n.row === rowKey && n.kind !== "role");
  return last && (last.kind === "add" || last.kind === "restrict") ? last : null;
}

export type HistoryKind = "access" | "role" | "reset" | "account" | "invite" | "activated";

/** «Tarix» qatori. Matn mijozda yig'iladi (tarjima uchun) — bu yerda faqat ma'lumot. */
export interface HistoryItem {
  kind: HistoryKind;
  at: string;
  byName: string;
  /** `access`: qator nomi va holatlar. */
  rowLabel?: string;
  from?: RowState | null;
  to?: RowState | null;
  /** `role`: rol nomlari. */
  roleFrom?: string;
  roleTo?: string;
}

/** Yozuvlardan tarix qatorlari (qator nomi lib/accessRows.ts dan). */
export function notesToHistory(notes: AccessNote[]): HistoryItem[] {
  return notes.map((n): HistoryItem => {
    if (n.kind === "role") return { kind: "role", at: n.at, byName: n.byName, roleFrom: n.roleFrom ?? "", roleTo: n.roleTo ?? "" };
    if (n.kind === "reset") return { kind: "reset", at: n.at, byName: n.byName };
    return { kind: "access", at: n.at, byName: n.byName, rowLabel: rowByKey(n.row)?.label ?? n.row, from: n.from, to: n.to };
  });
}

/** Tarixni birlashtiradi: yangisi birinchi, `limit` tagacha. */
export function mergeHistory(parts: HistoryItem[][], limit = 20): HistoryItem[] {
  return parts
    .flat()
    .filter((h) => h.at)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, limit);
}
