import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import {
  sanitizeAssignments,
  sanitizePlastikSalary,
  sanitizeSalaryEndDate,
  sanitizeSalaryStartDate,
  type HrEmployee,
} from "@/lib/hrEmployees";
import { sanitizePermissions } from "@/lib/permissions";
import { isValidPhone, normalizePhone } from "@/lib/invite";
import {
  branchIdsErrorText,
  branchNameMap,
  pruneAssignments,
  resolvePayrollBranch,
  scopedEmployeeFilter,
  validateBranchIds,
} from "@/lib/employeeBranches";
import { getBranchScope } from "@/lib/branchScope";
import { syncEmployeeRename } from "@/lib/employeeRename";
import type { HrEmployeeExtra } from "@/components/employees/employeeExtras";

// GET /api/hr-employees/:id — bitta xodim (profil sahifasi uchun).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const empId = Number(id);
  if (!Number.isFinite(empId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const scope = await getBranchScope();
  if (!scope) {
    return NextResponse.json({ ok: false, error: "Sessiya topilmadi" }, { status: 401 });
  }
  // Boshqa filial xodimining profili ochilmaydi. 403 EMAS, 404 —
  // bunday xodim BORLIGI ham oshkor bo'lmasin.
  const row = await db.collection("hr_employees").findOne(scopedEmployeeFilter({ id: empId }, scope));
  if (!row) {
    return NextResponse.json({ ok: false, error: "Xodim topilmadi" }, { status: 404 });
  }
  const { _id, ...employee } = row;
  // `archDate` keyin qo'shilgan — eski hujjatlarda yo'q. Ro'yxat route'i
  // (app/api/hr-employees/route.ts) uni bo'sh satrga to'ldiradi; profil
  // ham xuddi shunday qilsin, aks holda tip `string` deganda `undefined`
  // qaytadi.
  return NextResponse.json({ ok: true, employee: { archDate: "", ...employee } as unknown as HrEmployee });
}

// PATCH /api/hr-employees/:id — xodim maydonlarini qisman yangilaydi.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const empId = Number(id);
  if (!Number.isFinite(empId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<HrEmployee> & HrEmployeeExtra;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  // Faqat ruxsat etilgan maydonlar yoziladi. Ilgari bu yerda mijoz yuborgan
  // JSON to'g'ridan-to'g'ri $set qilinardi — `salary` satr ko'rinishida
  // kelib qolsa, oylik yig'indisi qo'shilish o'rniga birikib ketardi va
  // o'sha qiymat kassadagi chiqim chegarasini boshqargan bo'lardi.
  const set: Record<string, unknown> = {};
  for (const k of ["name", "gender", "turi", "filial", "kurs", "email", "degree", "employmentRate", "photoUrl", "archReason", "archDate", "lastActive", "percent"] as const) {
    if (typeof body[k] === "string") set[k] = body[k];
  }

  // Telefon — alohida yo'l. Ilgari u yuqoridagi ro'yxatda edi va XOM
  // holda yozilardi: shakl tekshirilmasdi, boshqa xodimning raqami bilan
  // takrorlanib ketishi mumkin edi va eng muhimi `users` hujjati eski
  // raqamda qolardi — ya'ni xodim yangi raqami bilan tizimga KIRA
  // OLMASDI, ruxsatlar zanjiri ham (lib/rolePermissions.ts telefon
  // bo'yicha topadi) uzilardi.
  let newPhone: string | null = null;
  if (typeof body.phone === "string" && body.phone.trim() !== "") {
    if (!isValidPhone(body.phone)) {
      return NextResponse.json({ ok: false, error: "Telefon raqami noto'g'ri" }, { status: 400 });
    }
    newPhone = normalizePhone(body.phone);
  }
  for (const k of ["aktivOq", "groups"] as const) {
    if (Number.isFinite(Number(body[k]))) set[k] = Number(body[k]);
  }
  // Xodimga alohida ruxsatlar (Boshqaruv → Rollar → "Xodimga alohida
  // ruxsat"). `null` — istisnoni olib tashlash, ya'ni xodim yana lavozim
  // ro'yxatiga qaytadi. Bo'sh massiv esa haqiqiy istisno (hech narsa
  // ko'rinmasin), shuning uchun ikkalasi bir xil qaralmaydi.
  if (body.permissions !== undefined) {
    set.permissions = body.permissions === null ? null : sanitizePermissions(body.permissions);
  }
  // Xodimga biriktirilgan soliq turlari (Boshqaruv → Xodimlar). Faqat
  // haqiqiy sonlar o'tadi va takrorlar tashlanadi — noto'g'ri qiymat
  // kelib qolsa soliq jimgina ikki marta hisoblanib ketardi.
  if (body.taxIds !== undefined) {
    set.taxIds = Array.isArray(body.taxIds)
      ? [...new Set(body.taxIds.map(Number).filter((n) => Number.isFinite(n) && n > 0))]
      : [];
  }
  // Plastik karta orqali beriladigan oylik (Boshqaruv → Xodimlar, yoki
  // xodim kartasidagi "Ish haqi" oynasi). `null` — biriktirilmagan.
  //
  // DIQQAT: yuqoridagi `aktivOq`/`groups` naqshi (`Number.isFinite(...)`)
  // BU YERDA ISHLAMAYDI: `Number(null)` va `Number("")` ikkalasi ham 0 va
  // ikkalasi ham finite, ya'ni "biriktirilmagan qilish" so'rovi jimgina
  // 0 yozib qo'yardi. `sanitizePlastikSalary` bu farqni saqlaydi.
  if (body.plastikSalary !== undefined) {
    set.plastikSalary = sanitizePlastikSalary(body.plastikSalary);
  }
  // Ishga kirgan (oylik yoziladigan) sana — oklad shu kundan hisoblanadi.
  // Bo'sh yoki noto'g'ri qiymat `null` bo'ladi: cheklov yo'q, oy boshidan.
  if (body.salaryStartDate !== undefined) {
    set.salaryStartDate = sanitizeSalaryStartDate(body.salaryStartDate);
  }
  // Ishdan ketgan sana (oxirgi ish kuni) — oklad shu kungacha hisoblanadi.
  if (body.salaryEndDate !== undefined) {
    set.salaryEndDate = sanitizeSalaryEndDate(body.salaryEndDate);
  }
  // `branchAssignments` quyida, filial qoidasi bilan BIRGA ishlanadi:
  // qatorlar a'zolik ichiga kesilishi kerak, ya'ni `branchIds` aniq
  // bo'lgandan keyin.

  // "Xodim qo'shish" modalining QOLGAN maydonlari. Ilgari ular bu oq
  // ro'yxatda yo'q edi: modal tahrirlash uchun ham ishlatila boshlaganda
  // tug'ilgan sana, izoh va maxsus maydonlar JIMGINA saqlanmasdi.
  //
  // POST dagi `pickExtras()` ni shundoq ko'chirib bo'lmaydi — u
  // `Required<HrEmployeeExtra>` qaytaradi, ya'ni qisman PATCH'da
  // yuborilmagan maydonlarni bo'sh qiymat bilan bosib tashlardi. Shu sabab
  // har biri ALOHIDA, "kelgan bo'lsa yoziladi" qoidasi bilan.
  if (typeof body.birthDate === "string") {
    set.birthDate = /^\d{4}-\d{2}-\d{2}$/.test(body.birthDate) ? body.birthDate : "";
  }
  if (typeof body.comment === "string") set.comment = body.comment.trim().slice(0, 2000);
  if (body.payroll !== undefined) set.payroll = Boolean(body.payroll);
  if (body.twoFactor !== undefined) set.twoFactor = Boolean(body.twoFactor);
  if (body.customFields !== undefined) {
    const clean: Record<string, string> = {};
    if (body.customFields && typeof body.customFields === "object") {
      for (const [k, v] of Object.entries(body.customFields)) {
        const key = String(k).trim().slice(0, 100);
        const val = String(v ?? "").trim().slice(0, 500);
        if (key && val) clean[key] = val;
      }
    }
    set.customFields = clean;
  }

  const db = await ensureIndexes();
  const scope = await getBranchScope();
  if (!scope) {
    return NextResponse.json({ ok: false, error: "Sessiya topilmadi" }, { status: 401 });
  }

  // Nishon xodim QAMROVDA bo'lsinmi. Joriy holat filial qoidasini
  // hisoblash uchun ham kerak (a'zolik va oylik uyi bir-biriga bog'liq).
  const current = (await db
    .collection("hr_employees")
    .findOne(scopedEmployeeFilter({ id: empId }, scope))) as (HrEmployee & { _id?: unknown }) | null;
  if (!current) {
    // 403 EMAS, 404: boshqa filialda bunday xodim BORLIGI ham oshkor
    // bo'lmasin.
    return NextResponse.json({ ok: false, error: "Xodim topilmadi" }, { status: 404 });
  }
  // Ishga kirgan va ishdan ketgan sana bir-biriga zid bo'lmasin — so'rovda
  // bittasi kelsa, ikkinchisi bazadagi qiymat.
  {
    const start = "salaryStartDate" in set ? (set.salaryStartDate as string | null) : current.salaryStartDate ?? null;
    const end = "salaryEndDate" in set ? (set.salaryEndDate as string | null) : current.salaryEndDate ?? null;
    if (start && end && end < start) {
      return NextResponse.json(
        { ok: false, error: "Ishdan ketgan sana ishga kirgan sanadan oldin bo'lishi mumkin emas" },
        { status: 400 },
      );
    }
  }

  // ── FILIAL QOIDASI ───────────────────────────────────────────────
  //
  // Uch manba bir-biriga bog'liq va shu bois BIRGA hisoblanadi:
  //   `branchIds`        — a'zolik (nimani ko'radi, qayerda ko'rinadi)
  //   `payrollBranchId`  — oylik uyi, a'zolik ichidan aynan bittasi
  //   `branchAssignments`— filial bo'yicha ish haqi, a'zolikning qismi
  const rawIds = (body as { branchIds?: unknown }).branchIds;
  const rawAssign = body.branchAssignments;
  const rawPayrollBranch = (body as { payrollBranchId?: unknown }).payrollBranchId;

  if (rawIds !== undefined || rawAssign !== undefined || rawPayrollBranch !== undefined) {
    const currentIds = Array.isArray(current.branchIds) ? current.branchIds.map(Number) : [];
    const assignments = rawAssign !== undefined ? sanitizeAssignments(rawAssign) : (current.branchAssignments ?? []);

    // `branchIds` YUBORILMASA-YU ish haqi qatorlari kelsa — a'zolik
    // KENGAYTIRILADI (kesilmaydi).
    //
    // NIMA UCHUN: "Ish haqi" oynasi (EmployeeSalaryConfigModal) faqat
    // `branchAssignments` yuboradi. Usiz 2-filialga oklad qo'shilgan
    // xodim o'sha filialga KIRA OLMASDI — qator bor, a'zolik yo'q.
    // Birlashma (kesish emas) tanlangani ham ataylab: bu oyna a'zolikni
    // olib tashlash uchun mo'ljallanmagan, u Xodim tahriri oynasida.
    const wanted = rawIds !== undefined
      ? rawIds
      : [...new Set([...currentIds, ...assignments.map((a) => a.branchId)])];

    const checked = await validateBranchIds(db, wanted, scope);
    if (!checked.ok) {
      const names = await branchNameMap(db);
      return NextResponse.json(
        { ok: false, error: branchIdsErrorText(checked.error!, (id) => names.get(id) ?? String(id)) },
        { status: 400 },
      );
    }
    const branchIds = checked.ids;
    set.branchIds = branchIds;
    // Oylik uyi HAR SAFAR qayta hal qilinadi: a'zolik qisqarganda u
    // tashqarida qolib ketmasligi kerak (I2 invarianti).
    set.payrollBranchId = resolvePayrollBranch(
      branchIds,
      rawPayrollBranch !== undefined ? rawPayrollBranch : current.payrollBranchId,
    );

    const { kept, dropped } = pruneAssignments(assignments, branchIds);
    const lostSalary = dropped.filter((a) => a.salary > 0);
    if (lostSalary.length > 0) {
      const names = await branchNameMap(db);
      return NextResponse.json(
        {
          ok: false,
          error: `Ish haqi kiritilgan filial xodimga biriktirilmagan: ${lostSalary.map((a) => names.get(a.branchId) ?? a.branchId).join(", ")}`,
        },
        { status: 400 },
      );
    }
    if (rawAssign !== undefined) set.branchAssignments = kept;
  }

  if (Object.keys(set).length === 0 && newPhone === null) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  if (newPhone !== null) {
    // Raqam BOSHQA xodimda yoki BOSHQA hisobda band bo'lmasin. Ikkala
    // kolleksiya ham qaraladi — import qilingan xodimlarda `users` yozuvi
    // yo'q (app/api/hr-employees/import), ya'ni faqat `users` ni tekshirish
    // ularni ko'rmasdi. Xodim qo'shish yo'lidagi qoida bilan bir xil.
    const [otherUser, otherEmp] = await Promise.all([
      db.collection("users").findOne({ phone: newPhone, hrEmployeeId: { $ne: empId } }, { projection: { _id: 1 } }),
      db.collection("hr_employees").findOne({ phone: newPhone, id: { $ne: empId } }, { projection: { _id: 1 } }),
    ]);
    if (otherUser || otherEmp) {
      return NextResponse.json({ ok: false, error: "Bu telefon raqami allaqachon ro'yxatdan o'tgan" }, { status: 409 });
    }
    set.phone = newPhone;
  }

  // Qamrov FILTRDA, JS'da emas: o'qib→tekshirib→yozish oralig'ida xodim
  // boshqa filialga ko'chirilsa ham yozuv o'tib ketmasin.
  const res = await db.collection("hr_employees").findOneAndUpdate(
    scopedEmployeeFilter({ id: empId }, scope),
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Xodim topilmadi" }, { status: 404 });
  }

  // Hisob HAM yangilanadi — aks holda xodim eski raqami bilan kirib,
  // yangi raqami profilida turgan bo'lardi. Ism o'zgargan bo'lsa
  // `users.fullName` ham ergashadi (navbardagi profil shundan o'qiydi).
  const userSet: Record<string, unknown> = {};
  if (newPhone !== null) userSet.phone = newPhone;
  if (typeof set.name === "string") userSet.fullName = set.name;
  if (Object.keys(userSet).length > 0) {
    await db.collection("users").updateOne({ hrEmployeeId: empId }, { $set: userSet });
  }
  // ISM O'ZGARDI — eski ism yozilgan to'lovlar, avans, kassa mas'uli, guruh, lid,
  // bonus/jarima ham yangi ismga ko'chadi (lib/employeeRename.ts izohi). Kutiladi:
  // keyingi oylik o'qishi allaqachon yangi ism bilan ko'rsin.
  const renameSync =
    typeof set.name === "string" && set.name.trim() !== String(current.name ?? "").trim()
      ? await syncEmployeeRename(db, empId, current.name, set.name)
      : undefined;
  const { _id, ...employee } = res;
  return NextResponse.json({ ok: true, employee: employee as unknown as HrEmployee, ...(renameSync ? { renameSync } : {}) });
}

// DELETE /api/hr-employees/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const empId = Number(id);
  if (!Number.isFinite(empId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const scope = await getBranchScope();
  if (!scope) {
    return NextResponse.json({ ok: false, error: "Sessiya topilmadi" }, { status: 401 });
  }
  // Boshqa filial xodimini o'chirib bo'lmaydi.
  const res = await db.collection("hr_employees").deleteOne(scopedEmployeeFilter({ id: empId }, scope));
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Xodim topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
