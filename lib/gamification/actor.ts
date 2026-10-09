import type { Db } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { allBranchIds } from "@/lib/branchScope";
import { employeeNameById } from "@/lib/currentEmployee";
import { GAM, gamDb, nextSeq } from "./db";
import type { GamRole } from "./types";
import { expandBranchPools } from "@/lib/branchPools";

// GAMIFIKATSIYADAGI ROL — TZ 3-bo'lim: Direktor, Filial admini, Ustoz.
//
// Tizimda «filial admini» degan alohida tushuncha yo'q, shu bois
// (26.09.2026 qarori):
//   • Direktor     — users.role "admin" (butun tizimda adminlik shu yerdan);
//   • Filial admini — hr_employees.turi "moderator", doirasi — o'z branchIds;
//   • Ustoz        — hr_employees.turi "teacher"; guruhlari groups.teacher
//                    NOMI bo'yicha (teacherId yo'q — lib/groups.ts).
// Boshqa hisoblar (lavozimi yo'q, turi boshqa) gamifikatsiyada rolsiz —
// hech narsa yoza olmaydi.

export interface GamActor {
  role: GamRole;
  userId: string;
  /** Yozuvlardagi «Kim» — xodim ismi (TZ 6.4: rol nomi emas). */
  name: string;
  employeeId: number | null;
  /** Ko'rish doirasi: direktor — hamma filial, qolganlar — biriktirilganlari. */
  branchIds: number[];
}

export async function getGamActor(dbArg?: Db): Promise<GamActor | null> {
  const me = await getCurrentUser();
  if (!me) return null;
  const db = dbArg ?? (await gamDb());

  if (me.role === "admin") {
    const name = (await employeeNameById(db, me.hrEmployeeId)) || String(me.fullName ?? "").trim() || "Direktor";
    return { role: "director", userId: me.id, name, employeeId: me.hrEmployeeId, branchIds: await allBranchIds(db) };
  }

  if (me.hrEmployeeId === null) return null;
  const emp = await db
    .collection("hr_employees")
    .findOne({ id: me.hrEmployeeId }, { projection: { _id: 0, name: 1, turi: 1, branchIds: 1 } });
  if (!emp) return null;
  const role: GamRole | null = emp.turi === "teacher" ? "teacher" : emp.turi === "moderator" ? "branch_admin" : null;
  if (!role) return null;

  const all = await allBranchIds(db);
  const mine = (Array.isArray(emp.branchIds) ? emp.branchIds : []).map(Number).filter((b: number) => all.includes(b));
  return {
    role,
    userId: me.id,
    name: String(emp.name ?? "").trim() || String(me.fullName ?? "").trim(),
    employeeId: me.hrEmployeeId,
    // Biriktirilmagan xodim — birinchi filial (lib/branchScope.ts dagi qoida).
    // HOVUZ (09.10.2026, lib/branchPools.ts): 1+2 filial admini ikkalasini ko'radi.
    branchIds: expandBranchPools(mine.length > 0 ? mine : all.slice(0, 1)),
  };
}

// ── Audit jurnali (TZ 6.15) ───────────────────────────────────────────
// Sozlamalar, sabablar, katalog, byudjet, oy yakuni, havola va Telegram
// amallari yoziladi. Tanga yozuvlari va ularning bekor qilinishi
// `coin_transactions` ning o'zida — bu yerga takrorlanmaydi.

export type AuditAction = "create" | "update" | "delete" | "activate" | "deactivate" | "close" | "regenerate" | "unlink";

export async function writeAudit(
  db: Db,
  actor: Pick<GamActor, "userId" | "name"> | null,
  entity: string,
  entityId: string | number,
  action: AuditAction,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Promise<void> {
  const id = await nextSeq(db, GAM.audit);
  await db.collection(GAM.audit).insertOne({
    id,
    userId: actor?.userId ?? null,
    userName: actor?.name ?? null,
    entity,
    entityId: String(entityId),
    action,
    before,
    after,
    createdAt: new Date().toISOString(),
  });
}

/** Faqat o'zgargan maydonlar — audit `before`/`after` uchun. */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const k of Object.keys(after)) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      b[k] = before[k] ?? null;
      a[k] = after[k] ?? null;
    }
  }
  return Object.keys(a).length ? { before: b, after: a } : null;
}
