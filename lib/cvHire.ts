import type { Db } from "mongodb";
import type { BranchScope } from "@/lib/branchScope";
import { createHrEmployee, type CreateEmployeeBody } from "@/lib/hrEmployeeCreate";
import { cvFromRow, type CvApplication } from "@/lib/managementCv";
import { uzDateIso } from "@/lib/uzTime";

// «ISHGA QABUL (CV) → ISHGA OLISH» (25.10.2026, 13-qism) — rasm «Ishga olish oynasi»:
// `{ centerRoleId, branchId, startDate, kurs, salaryType: "mixed"|"fixed"|"foiz", oklad, percent }`.
// Xodim «Xodim qo'shish» bilan BIR XIL yo'ldan yaratiladi (lib/hrEmployeeCreate.ts — telefon
// takrori, lavozim, filial va oylik uyi, oklad qatori, foiz, ishga kirgan sana, kirish taklifi
// SMS), keyin ariza «Ishga olindi». Route (app/api/management-cv/[id]/hire) faqat sessiya va
// ruxsatni tekshiradi — mantiq shu yerda, vaqtinchalik bazada sinaladi.

const SALARY_TYPES = new Set(["mixed", "fixed", "foiz"]);
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export type HireCvResult =
  | { ok: true; application: CvApplication; employee: { id: number; name: string }; smsSent: boolean; smsSimulated: boolean }
  | { ok: false; error: string; status: number };

export async function hireCv(db: Db, scope: BranchScope, cvId: number, body: Record<string, unknown>, statusBy: string): Promise<HireCvResult> {
  const bad = (error: string, status = 400): HireCvResult => ({ ok: false, error, status });

  const startDate = String(body.startDate ?? "").trim();
  if (!DATE_RE.test(startDate)) return bad("Ish boshlash sanasini tanlang");
  const salaryType = String(body.salaryType ?? "");
  if (!SALARY_TYPES.has(salaryType)) return bad("Oylik hisoblash usulini tanlang");
  const oklad = Math.round(Number(body.oklad) || 0);
  const percent = Number(body.percent);
  if (salaryType !== "foiz" && !(oklad > 0)) return bad("Okladni kiriting");
  if (salaryType !== "fixed" && !(Number.isFinite(percent) && percent > 0 && percent <= 100)) return bad("Foizni kiriting — 1 dan 100 gacha");
  const branchId = Number(body.branchId);
  if (!Number.isInteger(branchId) || branchId <= 0) return bad("Filialni tanlang");
  if (body.centerRoleId === undefined || body.centerRoleId === null || body.centerRoleId === "") return bad("Lavozimni tanlang");

  const col = db.collection("cv_applications");
  const row = await col.findOne({ id: cvId });
  if (!row) return bad("Ariza topilmadi", 404);
  const cv = row as unknown as CvApplication;
  if (cv.status === "accepted" && cv.hiredEmpId) return bad("Bu nomzod allaqachon ishga olingan", 409);

  const first = (cv.name || "").split(" ")[0] || "";
  const empBody: CreateEmployeeBody = {
    name: cv.name,
    phone: cv.phone,
    centerRoleId: Number(body.centerRoleId),
    branchIds: [branchId],
    payrollBranchId: branchId,
    kurs: String(body.kurs ?? "").trim().slice(0, 80),
    // Foiz — son satri («40»): Sozlamalar → Oylik foizlari darajalari ham shunday nomlangan,
    // payroll `resolvePercent` ikkalasini ham o'qiydi.
    percent: salaryType === "fixed" ? "" : String(Math.round(percent * 100) / 100),
    branchAssignments: salaryType === "foiz" ? [] : [{ branchId, roleId: null, scheduleId: null, salary: oklad }],
    salaryStartDate: startDate,
    // Eski «Ishga olish»dagi taxmin: ismi «a» bilan tugasa — ayol (xodim kartasida tuzatiladi).
    gender: /a$/i.test(first) ? "female" : "male",
    photoUrl: cv.photoUrl || "",
    ...(DATE_RE.test(cv.birth || "") ? { birthDate: cv.birth } : {}),
    comment: `Ishga qabul (CV): ariza ${cv.ref || `#${cv.id}`}`,
  };
  const r = await createHrEmployee(db, scope, empBody);
  if (!r.ok) return bad(r.error, r.status);

  const set = {
    status: "accepted",
    hiredEmpId: r.employee.id,
    hiredAt: uzDateIso(),
    hiredStart: startDate,
    statusAt: new Date().toISOString(),
    statusBy,
  };
  await col.updateOne({ id: cvId }, { $set: set });
  return {
    ok: true,
    application: cvFromRow({ ...row, ...set } as Record<string, unknown>, scope.isAdmin),
    employee: { id: r.employee.id, name: r.employee.name },
    smsSent: r.smsSent,
    smsSimulated: r.smsSimulated,
  };
}
