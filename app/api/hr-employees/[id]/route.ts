import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { sanitizeAssignments, type HrEmployee } from "@/lib/hrEmployees";
import { sanitizePermissions } from "@/lib/permissions";
import { isValidPhone, normalizePhone } from "@/lib/invite";
import type { HrEmployeeExtra } from "@/components/employees/employeeExtras";

// GET /api/hr-employees/:id — bitta xodim (profil sahifasi uchun).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const empId = Number(id);
  if (!Number.isFinite(empId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const row = await db.collection("hr_employees").findOne({ id: empId });
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
  for (const k of ["name", "gender", "turi", "filial", "kurs", "email", "degree", "photoUrl", "archReason", "archDate", "lastActive", "percent"] as const) {
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
  // Ish haqi — POST bilan bir xil tozalagichdan o'tadi (lib/hrEmployees.ts).
  if (body.branchAssignments !== undefined) {
    set.branchAssignments = sanitizeAssignments(body.branchAssignments);
  }

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

  if (Object.keys(set).length === 0 && newPhone === null) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();

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

  const res = await db.collection("hr_employees").findOneAndUpdate(
    { id: empId },
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
  const { _id, ...employee } = res;
  return NextResponse.json({ ok: true, employee: employee as unknown as HrEmployee });
}

// DELETE /api/hr-employees/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const empId = Number(id);
  if (!Number.isFinite(empId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await db.collection("hr_employees").deleteOne({ id: empId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Xodim topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
