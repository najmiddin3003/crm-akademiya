import type { Db } from "mongodb";
import { branchInCondition } from "@/lib/branchScope";
import { buildingNo } from "@/lib/branchPools";
import { monthlyPriceFor, type PricedCourse } from "@/lib/coursePrice";
import { GROUP_MEMBERSHIPS } from "@/lib/groupMembership";
import { groupLabel } from "@/lib/groups";
import { pupilFullName } from "@/lib/pupilsData";
import { uzDateIso, uzTimeHm } from "@/lib/uzTime";
import {
  EXPIRING_DAYS,
  type ContractPrefill,
  type ContractRow,
  type ContractView,
  type SignerRelation,
  type StudentContract,
} from "@/lib/studentContractTypes";

// O'QUVCHI SHARTNOMALARI (32-qism, rasm «Shartnomalar»). Reyestr: raqam, o'quvchi, guruh, imzolovchi
// (ota-ona yoki o'zi), oylik narx, amal qilish muddati, holat. Hozircha shartnomani admin tuzadi va
// qog'ozda imzolanganini belgilaydi; SMS havola va kabinetda kod bilan imzolash, guruhga qo'shilganda
// avtomatik tuzish — egasining qarori bilan keyin (SAVOLLAR). Saqlanadi `student_contracts`.
// Raqam: «A{filial}-{yil}/{tartib}» (tartib — filial va yil bo'yicha).

export const STUDENT_CONTRACTS = "student_contracts";
type Fail = { ok: false; error: string; status: number };
const fail = (error: string, status = 400): Fail => ({ ok: false, error, status });
const stamp = () => `${uzDateIso()}T${uzTimeHm()}`;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function viewOf(c: StudentContract, today = uzDateIso()): { view: ContractView; daysLeft: number | null } {
  if (c.status === "cancelled") return { view: "cancelled", daysLeft: null };
  if (c.status === "pending") return { view: "pending", daysLeft: null };
  const left = daysBetween(today, c.to);
  if (left < 0) return { view: "expired", daysLeft: null };
  return { view: left <= EXPIRING_DAYS ? "expiring" : "signed", daysLeft: left };
}

/** O'quv yili oxiri — 31-may (iyundan keyin tuzilsa — keyingi yilniki). */
export function academicYearEnd(today = uzDateIso()): string {
  const y = Number(today.slice(0, 4));
  return Number(today.slice(5, 7)) >= 6 ? `${y + 1}-05-31` : `${y}-05-31`;
}

export async function listContracts(db: Db, branchIds: number[]): Promise<ContractRow[]> {
  const today = uzDateIso();
  const docs = await db.collection(STUDENT_CONTRACTS).find(branchInCondition(branchIds), { projection: { _id: 0 } }).sort({ id: -1 }).toArray();
  return (docs as unknown as StudentContract[]).map((c) => ({ ...c, ...viewOf(c, today) }));
}

interface PupilDoc {
  id: number;
  firstName: string;
  lastName: string;
  phone?: string;
  branchId?: number;
  fatherName?: string;
  fatherPhone?: string;
  motherName?: string;
  motherPhone?: string;
}

export async function prefill(db: Db, pupilId: number, branchIds: number[]): Promise<ContractPrefill | Fail> {
  const p = (await db.collection("pupils").findOne({ $and: [{ id: pupilId }, branchInCondition(branchIds)] }, { projection: { _id: 0 } })) as unknown as PupilDoc | null;
  if (!p) return fail("O'quvchi topilmadi", 404);
  const mem = await db.collection(GROUP_MEMBERSHIPS).find({ pupilId, leftAt: null }, { projection: { _id: 0, groupId: 1 } }).toArray();
  const groups = await db
    .collection("groups")
    .find({ id: { $in: mem.map((m) => Number(m.groupId)) } }, { projection: { _id: 0, id: 1, name: 1, course: 1, level: 1, branchId: 1 } })
    .toArray();
  const courses = (await db.collection("offline_courses").find({}, { projection: { _id: 0 } }).toArray()) as unknown as PricedCourse[];
  const parents: ContractPrefill["parents"] = [];
  if (p.motherName) parents.push({ relation: "onasi", name: p.motherName, phone: p.motherPhone ?? "" });
  if (p.fatherName) parents.push({ relation: "otasi", name: p.fatherName, phone: p.fatherPhone ?? "" });
  return {
    ok: true,
    pupil: { id: p.id, name: pupilFullName(p), phone: p.phone ?? "", branchId: Number(p.branchId) || 1 },
    parents,
    groups: groups.map((g) => ({
      id: Number(g.id),
      label: groupLabel(g as never),
      course: String(g.course ?? ""),
      price: monthlyPriceFor(g as never, courses),
    })),
    defaultTo: academicYearEnd(),
  };
}

export interface CreateInput {
  pupilId?: unknown;
  groupId?: unknown;
  signerName?: unknown;
  signerRelation?: unknown;
  signerPhone?: unknown;
  price?: unknown;
  from?: unknown;
  to?: unknown;
}

const RELATIONS: SignerRelation[] = ["onasi", "otasi", "o'zi", "vasiy"];

export async function createContract(db: Db, branchIds: number[], by: string, b: CreateInput): Promise<{ ok: true; contract: StudentContract } | Fail> {
  const pupilId = Math.floor(Number(b.pupilId));
  const pre = await prefill(db, pupilId, branchIds);
  if (!pre.ok) return pre;
  const relation = RELATIONS.includes(b.signerRelation as SignerRelation) ? (b.signerRelation as SignerRelation) : "onasi";
  const signerName = relation === "o'zi" ? pre.pupil.name : String(b.signerName ?? "").trim();
  if (!signerName) return fail("Imzolovchining ismini kiriting");
  const price = Math.round(Number(b.price));
  if (!Number.isFinite(price) || price <= 0) return fail("Oylik narxni kiriting");
  const from = String(b.from ?? "");
  const to = String(b.to ?? "");
  if (!ISO.test(from) || !ISO.test(to)) return fail("Muddatni kiriting");
  if (to <= from) return fail("Tugash sanasi boshlanishdan keyin bo'lsin");
  const gid = b.groupId === null || b.groupId === undefined || b.groupId === "" ? null : Math.floor(Number(b.groupId));
  const g = gid ? pre.groups.find((x) => x.id === gid) : null;
  if (gid && !g) return fail("O'quvchi bu guruhda emas");

  const col = db.collection(STUDENT_CONTRACTS);
  const year = from.slice(0, 4);
  const branchNo = buildingNo(pre.pupil.branchId) ?? pre.pupil.branchId;
  const prefix = `A${branchNo}-${year}/`;
  const lastNo = await col.find({ no: { $regex: `^${prefix.replace("/", "\\/")}` } }).sort({ no: -1 }).limit(1).toArray();
  const seq = (Number(String(lastNo[0]?.no ?? "").split("/")[1]) || 0) + 1;
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const contract: StudentContract = {
    id: (Number(last[0]?.id) || 0) + 1,
    no: `${prefix}${String(seq).padStart(4, "0")}`,
    branchId: pre.pupil.branchId,
    pupilId,
    pupilName: pre.pupil.name,
    groupId: g?.id ?? null,
    groupLabel: g?.label ?? "",
    course: g?.course ?? "",
    signerName,
    signerRelation: relation,
    signerPhone: String(b.signerPhone ?? "").trim(),
    price,
    from,
    to,
    status: "pending",
    signedAt: null,
    signedVia: null,
    cancelledAt: null,
    cancelReason: "",
    createdAt: stamp(),
    createdBy: by,
  };
  await col.insertOne({ ...contract });
  return { ok: true, contract };
}

export type ContractAction = { action: "sign"; id: number } | { action: "cancel"; id: number; reason?: string } | { action: "extend"; id: number; to: string };

export async function updateContract(db: Db, branchIds: number[], by: string, a: ContractAction): Promise<{ ok: true } | Fail> {
  const col = db.collection(STUDENT_CONTRACTS);
  const q = { $and: [{ id: a.id }, branchInCondition(branchIds)] };
  const c = (await col.findOne(q, { projection: { _id: 0 } })) as unknown as StudentContract | null;
  if (!c) return fail("Shartnoma topilmadi", 404);
  if (c.status === "cancelled") return fail("Shartnoma bekor qilingan");
  if (a.action === "sign") {
    if (c.status === "signed") return fail("Allaqachon imzolangan");
    await col.updateOne(q, { $set: { status: "signed", signedAt: stamp(), signedVia: "qog'oz" } });
    return { ok: true };
  }
  if (a.action === "cancel") {
    const reason = String(a.reason ?? "").trim();
    if (!reason) return fail("Sababini yozing");
    await col.updateOne(q, { $set: { status: "cancelled", cancelledAt: stamp(), cancelReason: reason.slice(0, 200) } });
    return { ok: true };
  }
  if (!ISO.test(a.to) || a.to <= c.to) return fail("Yangi sana hozirgi muddatdan keyin bo'lsin");
  await col.updateOne(q, { $set: { to: a.to }, $push: { extended: { from: c.to, to: a.to, at: stamp(), by } } } as never);
  return { ok: true };
}
