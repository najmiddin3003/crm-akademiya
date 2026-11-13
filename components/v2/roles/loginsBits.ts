import type { LoginRow } from "@/app/api/roles/logins/route";
import type { Role } from "@/lib/roles";
import { isRoleKey } from "@/lib/roles";
import { uzDateIso } from "@/lib/uzTime";

// YANGI VERSIYA — «LOGIN HISOBLARI» tabining sof yordamchilari (25-qism). Sinov:
// scratchpad q25/t-logins.test.mts.

export type { LoginRow };

/** Chip filtri: kirmaganlar, yuborilganlar (muddati o'tganlari ham), kirganlar. */
export type LoginFilter = "" | "none" | "sent" | "active";

export interface LoginCounts {
  none: number;
  /** Yuborilgan, hali kirmagan — muddati o'tganlari bilan. */
  sent: number;
  /** Shulardan muddati o'tgani. */
  expired: number;
  active: number;
  /** Bloklangan / boshqa holat. */
  blocked: number;
  total: number;
}

export function loginCounts(rows: Pick<LoginRow, "login">[]): LoginCounts {
  const c: LoginCounts = { none: 0, sent: 0, expired: 0, active: 0, blocked: 0, total: rows.length };
  for (const r of rows) {
    if (r.login === "none") c.none++;
    else if (r.login === "invited") c.sent++;
    else if (r.login === "expired") {
      c.sent++;
      c.expired++;
    } else if (r.login === "active") c.active++;
    else c.blocked++;
  }
  return c;
}

export function matchesLoginFilter(row: Pick<LoginRow, "login">, f: LoginFilter): boolean {
  if (!f) return true;
  if (f === "none") return row.login === "none";
  if (f === "sent") return row.login === "invited" || row.login === "expired";
  return row.login === "active";
}

/**
 * Login berish / qayta yuborish mumkinmi. Faol hisobga yuborilmaydi (server ham rad etadi);
 * bloklangan hisobga ham — taklif uni `invited` qilib, blokni jimgina olib tashlardi.
 */
export function canSendLogin(row: Pick<LoginRow, "login">): boolean {
  return row.login === "none" || row.login === "invited" || row.login === "expired";
}

/** Telefon SMS uchun yaroqlimi: 998 + 9 xona (yoki 9 xonali mahalliy). */
export function hasSmsPhone(phone: string): boolean {
  const d = (phone || "").replace(/\D/g, "");
  return (d.length === 12 && d.startsWith("998")) || d.length === 9;
}

/** Rol filtri kaliti: «admin», «r:<rol id>» yoki «none» (lavozimsiz). */
export function roleFilterKey(row: Pick<LoginRow, "admin" | "turi" | "centerRoleId">, roles: Role[]): string {
  if (row.admin) return "admin";
  if (row.centerRoleId !== null) {
    const r = roles.find((x) => x.id === row.centerRoleId);
    return r ? `r:${r.id}` : "none";
  }
  if (isRoleKey(row.turi)) {
    const r = roles.find((x) => x.key === row.turi);
    return r ? `r:${r.id}` : "none";
  }
  return "none";
}

/** Filial filtri: xodim shu filialga biriktirilganmi (bo'sh — hech biriga). */
export function inBranch(row: Pick<LoginRow, "branchIds">, branchId: string): boolean {
  if (!branchId) return true;
  return row.branchIds.includes(Number(branchId));
}

/** Ro'yxatni `size` talik bo'laklarga (server partiya chegarasi). */
export function chunk<T>(list: T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size) || 1);
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

/** Taklif muddati — Toshkent kuni «YYYY-MM-DD»; o'qilmasa "". */
export function inviteDay(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : uzDateIso(d);
}

/** SMS namunasini bo'laklarga: o'rinbosarlar («…» token, «••••••» kod) alohida — ajratib ko'rsatiladi. */
export function smsParts(text: string): { text: string; mark: boolean }[] {
  const out: { text: string; mark: boolean }[] = [];
  const re = /(…|•{3,})/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), mark: false });
    out.push({ text: m[0], mark: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), mark: false });
  return out;
}
