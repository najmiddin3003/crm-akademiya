import type { Db } from "mongodb";
import type { BranchScope } from "@/lib/branchScope";
import {
  sanitizeAssignments,
  sanitizePlastikSalary,
  sanitizeSalaryEndDate,
  sanitizeSalaryStartDate,
  type HrEmployee,
} from "@/lib/hrEmployees";
// Qo'shimcha maydonlar tipi vaqtincha komponentlar yonida turadi — sabab
// components/employees/employeeExtras.ts izohida. `import type` — kompilyatsiyada yo'qoladi.
import type { HrEmployeeExtra } from "@/components/employees/employeeExtras";
import { isValidPhone, issueCode, generateToken, activationMessage, sendSms, normalizePhone, INVITE_TTL_MS } from "@/lib/invite";
import { toUz } from "@/lib/uzTime";
import { resolveCenterRole } from "@/lib/roles";
import { branchIdsErrorText, branchNameMap, pruneAssignments, resolvePayrollBranch, validateBranchIds } from "@/lib/employeeBranches";
import { logSms } from "@/lib/smsLog";

// YANGI XODIM YARATISH — bitta joyda (25.10.2026, 13-qism). Ilgari bu mantiq faqat
// POST /api/hr-employees ichida edi; endi «Ishga qabul (CV) → Ishga olish» oynasi ham
// shu yo'ldan yuradi (app/api/management-cv/[id]/hire) — telefon takrori tekshiruvi,
// lavozim (Rollar), filial va oylik uyi, ish haqi qatorlari, kirish taklifi (SMS) ikki
// joyda ajralib ketmasin. Route'lar faqat sessiya/JSON bilan shug'ullanadi.

function fmtNow(raw: Date): string {
  const d = toUz(raw);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * "Xodim qo'shish" modali yig'adigan, ammo `HrEmployee` da hali yo'q
 * maydonlarni tozalaydi. Ilgari bular POST tanasiga umuman kirmasdi —
 * foydalanuvchi to'ldirgan tug'ilgan sana, izoh, toggle'lar va maxsus
 * maydonlar shaklni yopgan zahoti yo'qolardi.
 */
function pickExtras(body: HrEmployeeExtra): Required<HrEmployeeExtra> {
  const customFields: Record<string, string> = {};
  if (body.customFields && typeof body.customFields === "object") {
    for (const [k, v] of Object.entries(body.customFields)) {
      const key = k.trim();
      // Bo'sh qiymat SAQLANMAYDI: "to'ldirilmagan" bilan "bo'sh deb yozilgan"
      // farqi yo'qolmasin.
      const val = String(v ?? "").trim().slice(0, 500);
      if (key && val) customFields[key] = val;
    }
  }
  return {
    // `<input type="date">` faqat "YYYY-MM-DD" beradi; boshqasi kelsa — bo'sh.
    birthDate: typeof body.birthDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.birthDate) ? body.birthDate : "",
    comment: typeof body.comment === "string" ? body.comment.trim().slice(0, 2000) : "",
    payroll: Boolean(body.payroll),
    twoFactor: Boolean(body.twoFactor),
    customFields,
  };
}

export type CreateEmployeeBody = Partial<HrEmployee> & HrEmployeeExtra & { branchIds?: unknown; payrollBranchId?: unknown };

export type CreateEmployeeResult =
  | { ok: true; employee: HrEmployee & HrEmployeeExtra; smsSent: boolean; smsSimulated: boolean }
  | { ok: false; error: string; status: number };

export async function createHrEmployee(db: Db, scope: BranchScope, body: CreateEmployeeBody): Promise<CreateEmployeeResult> {
  const name = (body.name || "").trim();
  if (!name) return { ok: false, error: "Ism va familiyani kiriting", status: 400 };
  if (!isValidPhone(body.phone)) return { ok: false, error: "Telefon raqami noto'g'ri", status: 400 };
  const phone = normalizePhone(body.phone!);

  // «O'quv markazidagi vazifasi» — Rollar'dagi rol yoki lavozim (lib/roles.ts).
  const roleChoice = await resolveCenterRole(db, body);
  if (!roleChoice.ok) return { ok: false, error: roleChoice.error, status: 400 };

  const col = db.collection("hr_employees");

  // Telefon IKKALA kolleksiyada ham tekshiriladi. Ilgari faqat `users`
  // qaralardi, ammo app/api/hr-employees/import/route.ts ataylab `users`
  // yozuvisiz xodim qo'shadi (ommaviy importda o'nlab odamga faollashtirish
  // SMS'i ketmasligi uchun) — natijada import qilingan xodimning raqami bu
  // tekshiruvga ko'rinmasdi va aynan o'sha raqam bilan ikkinchi xodim
  // yaratilib ketaverardi. Importning o'zi ham `hr_employees` va `users` ni
  // birga tekshiradi, ya'ni endi ikkala yo'l bir xil qoidada.
  const [existingUser, existingEmployee] = await Promise.all([
    db.collection("users").findOne({ phone }, { projection: { _id: 1 } }),
    col.findOne({ phone }, { projection: { _id: 1 } }),
  ]);
  if (existingUser || existingEmployee) return { ok: false, error: "Bu telefon raqami allaqachon ro'yxatdan o'tgan", status: 409 };

  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  // Xodim QAYSI FILIALLARDA ishlaydi — navbardagi ro'yxat shundan chiqadi.
  //
  // NIMA NOTO'G'RI EDI: bu maydon yozilmasdi, ya'ni migratsiyadan KEYIN
  // qo'shilgan har bir xodim filialsiz qolardi va `getBranchScope()` uni
  // jimgina birinchi filialga tushirardi. Amalda uchradi: id 57
  // "Nilufar Sharipova" — `branchIds` yo'q.
  //
  // Yuborilmasa — joriy filial. Yuborilsa TEKSHIRILADI: bo'sh ro'yxat,
  // mavjud bo'lmagan filial va o'z qamrovidan tashqarisi RAD ETILADI.
  const rawBranchIds = body.branchIds;
  const checked = await validateBranchIds(db, rawBranchIds === undefined ? [scope.branchId] : rawBranchIds, scope);
  if (!checked.ok) {
    const names = await branchNameMap(db);
    return { ok: false, error: branchIdsErrorText(checked.error!, (id) => names.get(id) ?? String(id)), status: 400 };
  }
  const branchIds = checked.ids;
  const payrollBranchId = resolvePayrollBranch(branchIds, body.payrollBranchId);

  // Ish haqi qatorlari a'zolik ichida bo'lishi shart. Ish haqi KIRITILGAN
  // qator tashlanib ketsa — bu jimgina pul yo'qotish, shuning uchun 400.
  const { kept: keptAssignments, dropped } = pruneAssignments(sanitizeAssignments(body.branchAssignments), branchIds);
  const lostSalary = dropped.filter((a) => a.salary > 0);
  if (lostSalary.length > 0) {
    const names = await branchNameMap(db);
    return {
      ok: false,
      error: `Ish haqi kiritilgan filial xodimga biriktirilmagan: ${lostSalary.map((a) => names.get(a.branchId) ?? a.branchId).join(", ")}`,
      status: 400,
    };
  }

  const employee: HrEmployee & HrEmployeeExtra = {
    ...pickExtras(body),
    id: nextId,
    branchIds,
    // Oylik uyi — a'zolik ichidan aynan bittasi. Usiz xodim hech bir
    // filialning oylik ro'yxatiga tushmasdi.
    payrollBranchId,
    name,
    gender: body.gender || "",
    aktivOq: 0,
    groups: 0,
    turi: roleChoice.turi,
    ...(roleChoice.centerRoleId !== null ? { centerRoleId: roleChoice.centerRoleId } : {}),
    filial: body.filial || "Akademiya",
    phone,
    kurs: body.kurs || "",
    created: fmtNow(new Date()),
    lastActive: "",
    archReason: "",
    archDate: "",
    email: body.email || "",
    // Vazifaga qarab to'ldiriladi (Xodim qo'shish modalining 3-qatori):
    // foiz va kurs — o'qituvchida, bandlik darajasi — moderatorda, daraja
    // esa ikkalasida ham (lekin ro'yxati boshqa-boshqa grading tizimidan).
    percent: body.percent || "",
    degree: body.degree || "",
    employmentRate: body.employmentRate || "",
    photoUrl: typeof body.photoUrl === "string" ? body.photoUrl : "",
    // Yuqorida tozalangan VA a'zolik ichiga kesilgan qatorlar.
    branchAssignments: keptAssignments,
    // SOLIQ va PLASTIK — PATCH bilan bir xil qoidada tozalanadi, shunda ikki
    // yo'l bir xil xulq qiladi.
    taxIds: Array.isArray(body.taxIds) ? [...new Set(body.taxIds.map(Number).filter((n) => Number.isFinite(n) && n > 0))] : [],
    plastikSalary: sanitizePlastikSalary(body.plastikSalary),
    // Ishga kirgan sana — Xodim qo'shish oynasi sukut bo'yicha BUGUNNI
    // yuboradi (yangi xodim oy o'rtasida kelsa, to'liq oy yozilmasin).
    // Yuborilmasa (boshqa yo'llar) — cheklov yo'q, avvalgi xulq.
    salaryStartDate: sanitizeSalaryStartDate(body.salaryStartDate),
    // Yangi xodimda odatda bo'sh (hali ishlayapti).
    salaryEndDate: sanitizeSalaryEndDate(body.salaryEndDate),
  };
  if (employee.salaryStartDate && employee.salaryEndDate && employee.salaryEndDate < employee.salaryStartDate) {
    return { ok: false, error: "Ishdan ketgan sana ishga kirgan sanadan oldin bo'lishi mumkin emas", status: 400 };
  }
  await col.insertOne({ ...employee });

  // DIQQAT: bu HAQIQIY lahza — `createdAt` va taklif muddati shundan
  // hisoblanadi. `uzNow()` (siljitilgan sana) bo'lmasligi kerak, aks holda
  // baza 5 soat oldinga ketardi. Ko'rinadigan satrlar `fmtNow` orqali
  // alohida formatlanadi.
  const now = new Date();
  const token = generateToken();
  await db.collection("users").insertOne({
    phone,
    hrEmployeeId: nextId,
    fullName: name,
    role: employee.turi || "employee",
    status: "invited",
    passwordHash: null,
    invite: { token, expiresAt: new Date(now.getTime() + INVITE_TTL_MS) },
    createdAt: now,
    activatedAt: null,
  });

  // Taklif kodini yaratamiz (rate-limit ichida) va SMS yuboramiz. SMS
  // muvaffaqiyatsiz bo'lsa ham xodim ro'yxatda qoladi — frontend smsSent
  // bayrog'iga qarab tegishli xabar ko'rsatadi.
  const code = await issueCode(phone, "activate");
  let smsSent = false;
  let smsSimulated = false;
  if (code.ok && code.code) {
    const sms = await sendSms(phone, activationMessage(token, code.code));
    smsSent = sms.ok;
    smsSimulated = Boolean(sms.simulated);
    if (!sms.ok) {
      console.error("[hr-employees] SMS yuborilmadi:", sms.error, sms.raw);
    }
    // Jurnalga yoziladi (Nazorat > SMS analitikasi). `secret: true` —
    // matnda bir martalik faollashtirish tokeni va kod bor, ular
    // saqlanmaydi.
    await logSms(db, {
      recipientName: name,
      phone,
      text: "",
      purpose: "invite",
      kind: "auto",
      secret: true,
      result: sms,
    });
  }

  return { ok: true, employee, smsSent, smsSimulated };
}
