import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { HrEmployee } from "@/lib/hrEmployees";
// Qo'shimcha maydonlar tipi vaqtincha komponentlar yonida turadi — sabab
// components/employees/employeeExtras.ts izohida. `import type` bo'lgani
// uchun bu bog'lanish kompilyatsiyada butunlay yo'qoladi.
import type { HrEmployeeExtra } from "@/components/employees/employeeExtras";
import { getBranchScope } from "@/lib/branchScope";
import { scopedEmployeeFilter } from "@/lib/employeeBranches";
import { createHrEmployee, type CreateEmployeeBody } from "@/lib/hrEmployeeCreate";

// Boshqaruv → Xodimlar backend'i (MongoDB `hr_employees`).
// Demo seed YO'Q — xodimlar faqat qo'shilganda (yoki scripts/seed-test-*
// skriptlari orqali) paydo bo'ladi; ro'yxat bo'sh bo'lishi mumkin.
// sanitizeAssignments lib/hrEmployees.ts ga ko'chirildi — PATCH route ham
// aynan shu tozalagichdan foydalanadi.

// GET — FILIAL BO'YICHA KESILGAN ro'yxat (Boshqaruv → Xodimlar).
//
// Xodim `branchIds` massivida qaysi filial bo'lsa, o'sha filial
// ro'yxatida chiqadi. Chortoq 1 va 2 da ishlaydigan o'qituvchi IKKALASIDA
// ham ko'rinadi — talab aynan shu.
//
// BUTUN kompaniya ro'yxati kerak bo'lgan ekranlar (tug'ilgan kunlar,
// rollar, kassa oynalari, eski oylik cheklaridagi ism→id xaritasi)
// `/api/hr-employees/ref` dan oladi: u kesilmagan, LEKIN proyeksiyasi
// tor — pul va filial maydonlari chiqmaydi.
export async function GET() {
  const db = await ensureIndexes();
  const scope = await getBranchScope();
  if (!scope) {
    return NextResponse.json({ ok: false, error: "Sessiya topilmadi" }, { status: 401 });
  }
  const col = db.collection("hr_employees");
  const rows = await col.find(scopedEmployeeFilter({}, scope)).sort({ id: 1 }).toArray();
  // `archDate` ("Sana" ustuni) keyin qo'shilgan — eski hujjatlarda yo'q,
  // shuning uchun bo'sh satrga to'ldiramiz (jadval `undefined` olmasligi uchun).
  const employees = rows.map(({ _id, ...rest }) => ({ archDate: "", ...rest }) as unknown as HrEmployee & HrEmployeeExtra);
  return NextResponse.json({ ok: true, employees });
}

// Xodim qo'shilganda faollashtirish taklifi (users + 72 soatlik token + SMS)
// app/api/employees/route.ts dagi bilan bir xil naqsh — farqi shu: bu yerda
// alohida `employees` yozuvi yaratilmaydi, `users.hrEmployeeId` bevosita
// `hr_employees.id`ga ishora qiladi (activate/verify-token/resend-invite
// faqat `users`ga qaraydi, shuning uchun bu farq ularga ta'sir qilmaydi).
/**
 * Yangi xodim. Mantiq (telefon takrori, lavozim, filial va oylik uyi, ish haqi, kirish
 * taklifi SMS) — lib/hrEmployeeCreate.ts: «Ishga qabul (CV) → Ishga olish» ham shu
 * yo'ldan yuradi (25.10.2026).
 */
export async function POST(req: Request) {
  let body: CreateEmployeeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const scope = await getBranchScope();
  if (!scope) {
    return NextResponse.json({ ok: false, error: "Sessiya topilmadi" }, { status: 401 });
  }
  const db = await ensureIndexes();
  const r = await createHrEmployee(db, scope, body);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, employee: r.employee, smsSent: r.smsSent, smsSimulated: r.smsSimulated });
}
