import type { Db, Document, Filter } from "mongodb";
import { branchCondition, getBranchScope } from "@/lib/branchScope";
import { groupLabel, type Group } from "@/lib/groups";
import type { GamActor } from "./actor";

// GAMIFIKATSIYADA KIM QAYSI GURUHNI KO'RADI (TZ 3, «Ko'rish doirasi»):
//   • direktor      — hamma guruh;
//   • filial admini — o'z filiallari (hr_employees.branchIds) guruhlari;
//   • ustoz         — o'z guruhlari: groups.teacher NOMI xodim ismiga teng
//                     (teacherId yo'q — lib/groups.ts, 26.09.2026 qarori).
// Ustiga NAVBARDAGI FILIAL (lib/branchScope.ts) — CRM ning hamma sahifasi
// kabi: bir necha filialda ishlaydigan xodim filialni navbardan almashtiradi.

export interface GamGroup {
  id: number;
  /** Odam o'qiydigan nom — «Matematika (13-guruh)» (lib/groups.ts → groupLabel). */
  label: string;
  branchId: number;
  teacher: string;
  studentIds: number[];
  status: string;
}

const normName = (s: unknown) => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/** Guruh shu ustozniki (ism bo'yicha). */
export function isOwnGroup(actor: Pick<GamActor, "role" | "name">, g: Pick<GamGroup, "teacher">): boolean {
  return actor.role === "teacher" && !!normName(actor.name) && normName(g.teacher) === normName(actor.name);
}

/** Guruh shu xodimning ko'rish doirasida (navbar filialidan tashqari). */
export function groupInActorScope(actor: GamActor, g: Pick<GamGroup, "teacher" | "branchId">): boolean {
  if (actor.role === "director") return true;
  if (actor.role === "branch_admin") return actor.branchIds.includes(g.branchId);
  return isOwnGroup(actor, g);
}

export function toGamGroup(g: Group & { branchId?: number | null }): GamGroup {
  return {
    id: g.id,
    label: groupLabel(g),
    branchId: Number.isFinite(Number(g.branchId)) && g.branchId !== null ? Number(g.branchId) : 1,
    teacher: String(g.teacher ?? "").trim(),
    studentIds: Array.isArray(g.studentIds) ? g.studentIds.map(Number).filter(Number.isFinite) : [],
    status: String(g.status ?? ""),
  };
}

const GROUP_PROJECTION = { _id: 0, id: 1, name: 1, course: 1, teacher: 1, branchId: 1, studentIds: 1, status: 1 } as const;

/**
 * Xodim ishlay oladigan guruhlar — navbardagi filial ichida, faol
 * (`active`) guruhlar. Arxiv/muzlatilgan/yig'ilayotgan guruhda dars yo'q.
 */
export async function actorGroups(db: Db, actor: GamActor): Promise<GamGroup[]> {
  const scope = await getBranchScope();
  const where: Filter<Document> = { status: "active" };
  const filter = scope ? { $and: [where, branchCondition(scope)] } : where;
  const rows = await db.collection("groups").find(filter, { projection: GROUP_PROJECTION }).toArray();
  return rows
    .map((r) => toGamGroup(r as unknown as Group))
    .filter((g) => groupInActorScope(actor, g))
    .sort((a, b) => a.label.localeCompare(b.label, "uz"));
}

/** Bitta guruh — xodim doirasida bo'lmasa null (mavjudligi ham bildirilmaydi). */
export async function actorGroup(db: Db, actor: GamActor, groupId: number): Promise<GamGroup | null> {
  if (!Number.isFinite(groupId)) return null;
  const row = await db.collection("groups").findOne({ id: groupId }, { projection: GROUP_PROJECTION });
  if (!row) return null;
  const g = toGamGroup(row as unknown as Group);
  return groupInActorScope(actor, g) ? g : null;
}

/** Filial nomlari (4 ta) — sarlavha va tanlash ro'yxati uchun. */
export async function branchNames(db: Db): Promise<Map<number, string>> {
  const rows = await db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray();
  return new Map(rows.map((r) => [Number(r.id), String(r.name ?? "").trim() || `#${r.id}`]));
}
