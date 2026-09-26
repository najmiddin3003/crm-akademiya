import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentEmployee } from "@/lib/currentEmployee";
import { pupilNameOfDoc } from "@/lib/pupilEntries";

// PATCH /api/transaction-entries/:id/pupil — yozuvni O'QUVCHIGA biriktirish.
//
// Faqat MASHINA ajrata olmagan qoldiq uchun (app/api/transaction-entries/
// unassigned). Ism takrorlanganda kim to'laganini faqat odam biladi, shu
// bois qaror shu yerdan keladi.
//
// PUL HARAKATI YO'Q. Bu amal kassaga ham, summaga ham tegmaydi — u faqat
// yozuvning EGASINI ko'rsatadi. Ta'siri: o'quvchi profilidagi tarix va
// balans, qarzdorlik hisobi, o'quvchilar boti (lib/pupilEntries.ts).
//
// NIMA TEKSHIRILADI:
//   • yozuv o'quvchiga OID turdami — xodimga chiqarilgan avans/oylikda
//     `studentName` da XODIM ismi turadi va uni o'quvchiga bog'lash
//     xodimning pulini bolaning balansiga qo'shib yuborardi;
//   • o'quvchi bazada bormi (mijozdagi ro'yxat eskirgan bo'lishi mumkin).
//
// Ism MOSLIGI tekshirilmaydi ATAYLAB: qoldiqda ismi `pupils` da umuman
// topilmaydigan yozuvlar ham bor (o'quvchi qayta nomlangan yoki kassir
// xato yozgan) va ularni ham biriktirish kerak.
//
// IZ QOLADI: kim va qachon biriktirgani yozuvda saqlanadi. Bu qaror
// keyinchalik "bu pul nega shu bolada?" degan savolga javob beradi, va
// qayta biriktirilsa OLDINGI qiymat ham ko'rinib turadi.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entryId = Number(id);
  if (!Number.isFinite(entryId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as { pupilId?: unknown } | null;
  const pupilId = Number(body?.pupilId);
  if (!Number.isFinite(pupilId)) {
    return NextResponse.json({ ok: false, error: "O'quvchini tanlang" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("transaction_entries");
  const entry = await col.findOne(
    { id: entryId },
    { projection: { _id: 0, id: 1, txType: 1, studentRefund: 1, pupilId: 1, studentName: 1, discountId: 1 } },
  );
  if (!entry) {
    return NextResponse.json({ ok: false, error: "Tranzaksiya topilmadi" }, { status: 404 });
  }

  const owned = entry.txType === "payIn" || (entry.txType === "payOut" && entry.studentRefund === true);
  if (!owned) {
    return NextResponse.json(
      { ok: false, error: "Bu yozuv o'quvchiga oid emas — unda xodim ismi turadi" },
      { status: 400 },
    );
  }

  // Tanga evaziga chegirma o'sha o'quvchiniki (gamifikatsiya) — bunday
  // to'lovni boshqa o'quvchiga ko'chirib bo'lmaydi.
  if (entry.discountId && Number(entry.pupilId) !== pupilId) {
    return NextResponse.json(
      { ok: false, error: "Bu to'lovga o'quvchining tanga evaziga chegirmasi qo'llangan — boshqa o'quvchiga biriktirib bo'lmaydi" },
      { status: 400 },
    );
  }

  const pupil = await db
    .collection("pupils")
    .findOne({ id: pupilId }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1 } });
  if (!pupil) {
    return NextResponse.json({ ok: false, error: "O'quvchi topilmadi" }, { status: 404 });
  }

  const me = await getCurrentEmployee();
  await col.updateOne(
    { id: entryId },
    {
      $set: {
        pupilId,
        pupilIdSetBy: me?.name ?? "",
        pupilIdSetAt: new Date().toISOString(),
        // Qayta biriktirilsa oldingi qiymat ham qoladi — yo'qolmasin.
        ...(Number.isFinite(Number(entry.pupilId)) ? { pupilIdWas: Number(entry.pupilId) } : {}),
      },
    },
  );

  return NextResponse.json({ ok: true, pupilId, pupilName: pupilNameOfDoc(pupil) });
}
