import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/adminOnly";
import { isValidPhone, normalizePhone } from "@/lib/invite";
import { APPROVAL_FIELD } from "@/lib/adminApproval";

// "Vaqtinchalik tugma" sahifasining bitta xodim ustidagi amallari.
// Ikkalasi ham FILIAL QAMROVISIZ ishlaydi (sabab: ../route.ts izohi).

/** Bu sahifa tahrirlaydigan maydonlar — boshqasiga tegilmaydi. */
const EDITABLE = ["name", "turi", "email", "archReason", "archDate"] as const;

async function findEmployee(id: number) {
  const db = await ensureIndexes();
  const row = await db.collection("hr_employees").findOne({ id });
  return { db, row };
}

// PATCH /api/temp-staff/:id — tor tahrir (ism / telefon / vazifa / pochta)
// va arxiv maydonlari.
//
// NEGA /api/hr-employees/:id EMAS: u qamrovni `scopedEmployeeFilter` bilan
// kesadi, ya'ni boshqa filialdagi xodimga 404 beradi — bu sahifada esa
// to'rtala filial qatori bir ro'yxatda turadi va ularning HAR BIRINI
// tahrirlash mumkin bo'lishi kerak. Maydonlar to'plami ATAYLAB tor: filial
// a'zoligi, ish haqi, soliq va ruxsatlar — Boshqaruv → Xodimlar sahifasida,
// u yerda ular bir-biriga bog'liq qoidalar bilan tekshiriladi.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, error: "Bu sahifa faqat admin uchun" }, { status: 403 });
  }
  const { id } = await params;
  const empId = Number(id);
  if (!Number.isFinite(empId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const set: Record<string, unknown> = {};
  for (const k of EDITABLE) {
    if (typeof body[k] === "string") set[k] = (body[k] as string).trim();
  }
  // Yagona mantiqiy maydon. `undefined` (yuborilmagan) bilan `false`
  // (o'chirilgan) farqlanadi, aks holda ism tahrirlanganda tugmacha
  // jimgina o'chib qolardi.
  if (typeof body.twoFactor === "boolean") set.twoFactor = body.twoFactor;

  // ── ADMIN TASDIG'I (✓ / ✗) ──────────────────────────────────────────
  // Xodim hujjatiga emas, HISOBGA yoziladi (`users.adminApproval`) —
  // kirishni to'sadigan tekshiruv o'sha yerdan o'qiydi
  // (lib/adminApproval.ts). Shu bois alohida yo'l va alohida javob:
  // boshqa maydonlar bilan aralashtirilsa, hisobsiz xodimga "saqlandi"
  // deb javob berilib, aslida hech narsa o'zgarmagan bo'lardi.
  const approval = body.approval;
  if (approval !== undefined) {
    if (approval !== "approved" && approval !== "rejected") {
      return NextResponse.json({ ok: false, error: "Noto'g'ri tasdiq qiymati" }, { status: 400 });
    }
    const { db: adb, row: arow } = await findEmployee(empId);
    if (!arow) return NextResponse.json({ ok: false, error: "Xodim topilmadi" }, { status: 404 });

    const phone = normalizePhone(String(arow.phone ?? ""));
    const filter = phone ? { $or: [{ hrEmployeeId: empId }, { phone }] } : { hrEmployeeId: empId };
    const res = await adb.collection("users").updateOne(filter, { $set: { [APPROVAL_FIELD]: approval } });
    if (res.matchedCount === 0) {
      return NextResponse.json({ ok: false, error: "Bu xodimning hisobi yo'q" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, approval });
  }
  if (typeof set.name === "string" && set.name === "") {
    return NextResponse.json({ ok: false, error: "Ismni kiriting" }, { status: 400 });
  }

  const { db, row } = await findEmployee(empId);
  if (!row) {
    return NextResponse.json({ ok: false, error: "Xodim topilmadi" }, { status: 404 });
  }

  // Telefon — alohida yo'l: shakli tekshiriladi, boshqa xodim/hisobda band
  // emasligi tasdiqlanadi va `users` hujjati ham ergashadi. Aks holda xodim
  // ESKI raqami bilan tizimga kirib turaverardi.
  let newPhone: string | null = null;
  if (typeof body.phone === "string" && body.phone.trim() !== "") {
    if (!isValidPhone(body.phone)) {
      return NextResponse.json({ ok: false, error: "Telefon raqami noto'g'ri" }, { status: 400 });
    }
    newPhone = normalizePhone(body.phone);
    const [otherUser, otherEmp] = await Promise.all([
      db.collection("users").findOne({ phone: newPhone, hrEmployeeId: { $ne: empId } }, { projection: { _id: 1 } }),
      db.collection("hr_employees").findOne({ phone: newPhone, id: { $ne: empId } }, { projection: { _id: 1 } }),
    ]);
    if (otherUser || otherEmp) {
      return NextResponse.json({ ok: false, error: "Bu telefon raqami allaqachon ro'yxatdan o'tgan" }, { status: 409 });
    }
    set.phone = newPhone;
  }

  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  await db.collection("hr_employees").updateOne({ id: empId }, { $set: set });

  const userSet: Record<string, unknown> = {};
  if (newPhone !== null) userSet.phone = newPhone;
  if (typeof set.name === "string") userSet.fullName = set.name;
  if (Object.keys(userSet).length > 0) {
    // ESKI raqam bo'yicha ham qidiriladi: importda qo'shilgan xodimda
    // `hrEmployeeId` bog'lanmagan bo'lishi mumkin. Bo'sh raqam esa shartga
    // QO'SHILMAYDI — `{phone: ""}` begona hisobga tushib qolardi.
    const oldPhone = normalizePhone(String(row.phone ?? ""));
    const filter = oldPhone
      ? { $or: [{ hrEmployeeId: empId }, { phone: oldPhone }] }
      : { hrEmployeeId: empId };
    await db.collection("users").updateOne(filter, { $set: userSet });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/temp-staff/:id — XODIMNI VA UNING IZLARINI BUTUNLAY O'CHIRISH.
//
// SAHIFANING BUTUN MAQSADI SHU. `/api/hr-employees/:id` DELETE faqat
// `hr_employees` hujjatini o'chiradi, `users` esa QOLIB KETADI — va aynan
// o'sha hujjat telefon raqamini band qilib turadi (POST dagi tekshiruv
// `users` va `hr_employees` ikkalasiga ham qaraydi). Natijada o'chirilgan
// xodimning raqami bilan qayta xodim qo'shib bo'lmasdi: 409 "Bu telefon
// raqami allaqachon ro'yxatdan o'tgan".
//
// Shuning uchun bu yerda TO'RTTA iz birga tozalanadi:
//   hr_employees      — xodim yozuvi
//   users             — hisob (raqamni band qilib turgani)
//   user_sessions     — o'sha hisobning ochiq sessiyalari (egasiz qolmasin)
//   verification_codes— faollashtirish kodlari; ular soatiga 5 ta yuborish
//                       chegarasini ham ushlab turadi (lib/invite.ts
//                       MAX_SENDS_PER_HOUR), ya'ni tozalanmasa qayta-qayta
//                       test qilish 5-urinishdan keyin to'xtardi.
//
// SMS jurnali (`sms_messages`) ATAYLAB TEGILMAYDI — u Nazorat → SMS
// analitikasining tarixi, xodimga emas, yuborilgan xabarga tegishli.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Bu sahifa faqat admin uchun" }, { status: 403 });
  }
  const { id } = await params;
  const empId = Number(id);
  if (!Number.isFinite(empId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  const { db, row } = await findEmployee(empId);
  if (!row) {
    return NextResponse.json({ ok: false, error: "Xodim topilmadi" }, { status: 404 });
  }
  // NORMALLASHTIRILGAN shaklda: `users.phone` va `verification_codes.phone`
  // doim shunday saqlanadi (lib/eskiz.ts), `hr_employees.phone` esa eski
  // yozuvlarda 9 xonali va bo'shliqli bo'lishi mumkin. Aynan tenglik bilan
  // qidirilsa, o'sha qatorlarda hisob TOPILMAY, raqam band bo'lib qolardi —
  // ya'ni sahifa aynan hal qilishi kerak bo'lgan muammoni qoldirardi.
  const phone = normalizePhone(String(row.phone ?? ""));

  // O'ZINI O'CHIRISHGA YO'L YO'Q. Bu amal `users` hujjatini ham o'chiradi —
  // ya'ni admin o'z qatorini bossa, o'sha zahoti tizimdan butunlay
  // chiqib qolardi va qaytib kira olmasdi (hisob umuman yo'q).
  if (me.hrEmployeeId === empId || (phone !== "" && me.phone === phone)) {
    return NextResponse.json(
      { ok: false, error: "O'z hisobingizni o'chirib bo'lmaydi — tizimga kira olmay qolasiz" },
      { status: 400 },
    );
  }

  // Hisoblar AVVAL topiladi — sessiyalar ularning `_id` siga bog'langan.
  const userFilter = phone
    ? { $or: [{ hrEmployeeId: empId }, { phone }] }
    : { hrEmployeeId: empId };
  const users = await db.collection("users").find(userFilter, { projection: { _id: 1 } }).toArray();
  const userIds = users.map((u) => String(u._id));

  const [emp, acc, sess, codes] = await Promise.all([
    db.collection("hr_employees").deleteOne({ id: empId }),
    db.collection("users").deleteMany(userFilter),
    userIds.length > 0
      ? db.collection("user_sessions").deleteMany({ userId: { $in: userIds } })
      : Promise.resolve({ deletedCount: 0 }),
    phone
      ? db.collection("verification_codes").deleteMany({ phone })
      : Promise.resolve({ deletedCount: 0 }),
  ]);

  return NextResponse.json({
    ok: true,
    phone,
    removed: {
      employee: emp.deletedCount,
      users: acc.deletedCount,
      sessions: sess.deletedCount,
      codes: codes.deletedCount,
    },
  });
}
