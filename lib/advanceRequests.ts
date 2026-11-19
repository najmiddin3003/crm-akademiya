import type { Db } from "mongodb";
import { applyCashboxAdjust } from "@/lib/cashboxAdjust";
import { buildPayrollRows, loadPayrollRefs } from "@/lib/payrollSources";
import { payrollFoizPart, payrollOkladPart, payrollPeriod, type EmployeePayroll } from "@/lib/salary";
import { uzDateIso, uzTimeHm } from "@/lib/uzTime";

// AVANS SO'ROVI (48-qism, rasmlar «Qabul admin · avans so'rovi», «Rahbar paneli · tasdiqlar: avans so'rovi»).
// Ilgari avansni admin kassadan darhol berardi. Endi: admin (yoki menejer) so'rov yozadi → Rahbar tasdiqlaydi
// (so'ralgan summa yoki «shu kungacha olishi mumkin» summa) yoki rad etadi → admin pulni o'z kassasidan beradi va
// «Berdim»ni bosadi — shunda mavjud kassa chiqimi (avans turi, lib/cashboxAdjust.ts) yoziladi, oylik hisobi
// o'sha yerdan oladi. So'rov hujjati `advance_requests` da qoladi (tarix).
//
// «Shu kungacha olishi mumkin» = oklad × o'tgan kunlar / oy kunlari + foiz qismi (shu oydagi tushumdan) + bonus −
// jarima − shu oyda olingan avans/oylik. Oylik sahifasidagi hisob bilan bir xil manba (lib/payrollSources.ts).

export const ADVANCE_REQUESTS = "advance_requests";
export type AdvanceStatus = "pending" | "approved" | "rejected" | "given";

export interface AdvanceRequest {
  id: number;
  employeeId: number;
  employeeName: string;
  role: string;
  branchId: number;
  cashboxId: number | null;
  amount: number;
  note: string;
  status: AdvanceStatus;
  createdBy: string;
  createdAt: string;
  date: string;
  time: string;
  approvedAmount: number | null;
  decidedBy: string;
  decidedAt: string;
  decisionNote: string;
  givenAt: string;
  givenBy: string;
  entryId: number | null;
}

export interface SalaryState {
  configured: boolean;
  typeLabel: string;
  earned: number;
  bonus: number;
  fine: number;
  taken: number;
  canTake: number;
  day: number;
}

const ROLE: Record<string, string> = { teacher: "O'qituvchi", moderator: "Admin", admin: "Admin" };
export const roleLabel = (turi: unknown) => ROLE[String(turi ?? "")] ?? String(turi ?? "");
const stamp = () => `${uzDateIso()} ${uzTimeHm()}`;
type Fail = { ok: false; error: string; status: number };
const fail = (error: string, status = 400): Fail => ({ ok: false, error, status });

/** Xodimning shu kungacha hisoblangan oyligi (avans so'rovi va Rahbar paneli uchun). */
export async function salaryState(db: Db, employeeId: number): Promise<SalaryState | null> {
  const emp = await db.collection("hr_employees").findOne({ id: employeeId }, { projection: { _id: 0 } });
  if (!emp) return null;
  const p = payrollPeriod();
  const refs = { ...(await loadPayrollRefs(db)), employees: [emp as never], keepArchived: true };
  const [row] = (await buildPayrollRows(db, p, { refs })) as EmployeePayroll[];
  if (!row) return null;
  // Oklad — o'tgan kunlar ulushi (shu kungacha); foiz — shu oyda tushgan puldan.
  const oklad = p.daysIn > 0 ? Math.round((payrollOkladPart(row, p) * Math.min(p.day, p.daysIn)) / p.daysIn) : 0;
  const earned = oklad + payrollFoizPart(row);
  const taken = (row.paidAvans || 0) + (row.paidOylik || 0);
  const typeLabel = row.salaryType === "mixed" ? `oklad + ${row.percent}%` : row.salaryType === "foiz" ? `tushumdan ${row.percent}%` : "oklad";
  return { configured: row.configured, typeLabel, earned, bonus: row.bonus || 0, fine: row.jarima || 0, taken, canTake: Math.max(0, earned + (row.bonus || 0) - (row.jarima || 0) - taken), day: p.day };
}

/** Filial kassasi: filialga biriktirilgani, bo'lmasa so'rov yozuvchi / beruvchi egasi bo'lgan kassa. */
async function branchCashbox(db: Db, branchId: number, owner: string) {
  const col = db.collection("cashboxes");
  const base = { archived: { $ne: true }, isPrimary: { $ne: true } };
  const esc = owner.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    (owner.trim() ? await col.findOne({ ...base, moderator: { $regex: `^\\s*${esc}\\s*$`, $options: "i" } }, { projection: { _id: 0, id: 1, name: 1, moderator: 1 } }) : null) ??
    (await col.findOne({ ...base, branchId }, { projection: { _id: 0, id: 1, name: 1, moderator: 1 } }))
  );
}

async function nextId(db: Db): Promise<number> {
  const last = await db.collection(ADVANCE_REQUESTS).find({}, { projection: { _id: 0, id: 1 } }).sort({ id: -1 }).limit(1).toArray();
  return (Number(last[0]?.id) || 0) + 1;
}

/** Admin/menejer so'rov yozadi. `allowed` — yozuvchining filiallari (admin uchun hammasi). */
export async function createAdvance(db: Db, who: { name: string }, allowed: number[], b: Record<string, unknown>): Promise<{ ok: true; request: AdvanceRequest } | Fail> {
  const employeeId = Number(b.employeeId);
  const amount = Math.round(Number(b.amount) || 0);
  const note = String(b.note ?? "").trim().slice(0, 300);
  if (!Number.isFinite(employeeId) || employeeId <= 0) return fail("Xodimni tanlang");
  if (amount <= 0) return fail("Summani kiriting");
  if (!note) return fail("Izoh yozing — nima uchun kerak");
  const emp = await db.collection("hr_employees").findOne({ id: employeeId }, { projection: { _id: 0, id: 1, name: 1, turi: 1, branchIds: 1, archDate: 1 } });
  if (!emp || emp.archDate) return fail("Xodim topilmadi", 404);
  const branchIds = ((emp.branchIds as number[]) ?? []).map(Number);
  const branchId = branchIds.find((x) => allowed.includes(x)) ?? null;
  if (branchId === null) return fail("Bu xodim sizning filialingizda emas", 403);
  const dup = await db.collection(ADVANCE_REQUESTS).findOne({ employeeId, status: { $in: ["pending", "approved"] } });
  if (dup) return fail("Bu xodimning so'rovi hali yopilmagan");
  const box = await branchCashbox(db, branchId, who.name);
  const doc: AdvanceRequest = {
    id: await nextId(db),
    employeeId,
    employeeName: String(emp.name ?? ""),
    role: roleLabel(emp.turi),
    branchId,
    cashboxId: box ? Number(box.id) : null,
    amount,
    note,
    status: "pending",
    createdBy: who.name,
    createdAt: stamp(),
    date: uzDateIso(),
    time: uzTimeHm(),
    approvedAmount: null,
    decidedBy: "",
    decidedAt: "",
    decisionNote: "",
    givenAt: "",
    givenBy: "",
    entryId: null,
  };
  await db.collection(ADVANCE_REQUESTS).insertOne({ ...doc });
  return { ok: true, request: doc };
}

/** Rahbar qarori. `amount` berilsa — shu summa bilan tasdiqlanadi (masalan «380 000 qilib tasdiqlash»). */
export async function decideAdvance(db: Db, who: { name: string }, id: number, approve: boolean, note: string, amount?: number): Promise<{ ok: true } | Fail> {
  const doc = await db.collection(ADVANCE_REQUESTS).findOne({ id, status: "pending" });
  if (!doc) return fail("So'rov topilmadi yoki allaqachon hal qilingan", 404);
  if (!approve && !note.trim()) return fail("Rad etish sababini yozing");
  const approvedAmount = approve ? Math.round(Number(amount) || Number(doc.amount) || 0) : null;
  if (approve && (!approvedAmount || approvedAmount <= 0)) return fail("Summa noto'g'ri");
  await db.collection(ADVANCE_REQUESTS).updateOne(
    { id, status: "pending" },
    { $set: { status: approve ? "approved" : "rejected", approvedAmount, decidedBy: who.name, decidedAt: stamp(), decisionNote: note.trim().slice(0, 300) } },
  );
  return { ok: true };
}

/** «Berdim» — admin pulni o'z kassasidan berdi: mavjud chiqim (avans) yoziladi. */
export async function giveAdvance(db: Db, who: { name: string }, allowed: number[], id: number, method: string): Promise<{ ok: true; entryId: number | null } | Fail> {
  const doc = (await db.collection(ADVANCE_REQUESTS).findOne({ id, status: "approved" }, { projection: { _id: 0 } })) as AdvanceRequest | null;
  if (!doc) return fail("Tasdiqlangan so'rov topilmadi", 404);
  if (!allowed.includes(doc.branchId)) return fail("Bu filial kassasi sizda emas", 403);
  // Pulni beruvchining o'z kassasidan (u kassa egasi bo'lsa), aks holda so'rov yozilgandagi filial kassasidan.
  const own = await branchCashbox(db, doc.branchId, who.name);
  const cashboxId = Number(own?.id ?? doc.cashboxId) || null;
  if (!cashboxId) return fail("Sizga biriktirilgan kassa yo'q");
  const type = await db.collection("transaction_types").findOne({ name: { $regex: "avans", $options: "i" }, mainType: "chiqim" }, { projection: { _id: 0, name: 1 } });
  const out = await applyCashboxAdjust(
    db,
    { cashboxId, mode: "chiqim", method: method || "naqd", amount: Number(doc.approvedAmount ?? doc.amount), category: String(type?.name ?? "Avans"), studentName: doc.employeeName, note: `Avans so'rovi #${doc.id} · ${doc.note}` },
    { defer: () => {} },
  );
  if (!out.ok) return fail(out.error, out.status);
  await db.collection(ADVANCE_REQUESTS).updateOne({ id, status: "approved" }, { $set: { status: "given", givenAt: stamp(), givenBy: who.name, entryId: out.entryId ?? null } });
  return { ok: true, entryId: out.entryId ?? null };
}

/** Filial ko'rinishi (admin telefoni): o'z filiali xodimlari va so'rovlari. */
export async function advanceDesk(db: Db, allowed: number[], me?: string) {
  const [emps, reqs, boxes] = await Promise.all([
    db
      .collection("hr_employees")
      .find({ branchIds: { $in: allowed }, $or: [{ archDate: { $in: ["", null] } }, { archDate: { $exists: false } }] }, { projection: { _id: 0, id: 1, name: 1, turi: 1, subject: 1, position: 1 } })
      .sort({ name: 1 })
      .toArray(),
    db.collection(ADVANCE_REQUESTS).find({ branchId: { $in: allowed } }, { projection: { _id: 0 } }).sort({ id: -1 }).limit(30).toArray(),
    db.collection("cashboxes").find({ branchId: { $in: allowed }, archived: { $ne: true }, isPrimary: { $ne: true } }, { projection: { _id: 0, id: 1, name: 1, balance: 1 } }).toArray(),
  ]);
  if (!boxes.length && me) {
    const mine = await branchCashbox(db, allowed[0] ?? 1, me);
    if (mine) boxes.push((await db.collection("cashboxes").findOne({ id: mine.id }, { projection: { _id: 0, id: 1, name: 1, balance: 1 } }))!);
  }
  return {
    employees: emps.map((e) => ({ id: Number(e.id), name: String(e.name ?? ""), role: String(e.subject || e.position || roleLabel(e.turi)) })),
    requests: reqs as unknown as AdvanceRequest[],
    cashbox: boxes[0] ? { id: Number(boxes[0].id), name: String(boxes[0].name ?? ""), balance: Number(boxes[0].balance) || 0 } : null,
  };
}
