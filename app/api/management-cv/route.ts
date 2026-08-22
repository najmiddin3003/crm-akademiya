import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { formatSubmitted, sanitizeCvInput, type CvApplication } from "@/lib/managementCv";

// Boshqaruv → Ishga qabul (CV) backend'i (MongoDB `cv_applications`).
// Demo seed YO'Q — arizalar faqat ommaviy /ariza sahifasidan yoki Google
// Sheets orqali kelganda paydo bo'ladi.
//
// `ord` — jadvaldagi qator tartibi: yangi ariza TEPAGA qo'shiladi, ya'ni
// mavjud eng kichik `ord` dan bittaga kichik qiymat oladi. Ro'yxat `ord` bo'yicha o'sish tartibida qaytariladi.

function toApplication(row: Record<string, unknown>): CvApplication {
  const { _id, ord, ...rest } = row;
  void _id;
  void ord;
  return rest as unknown as CvApplication;
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("cv_applications");
  const rows = await col.find({}).sort({ ord: 1 }).toArray();
  const applications = rows.map((r) => toApplication(r as unknown as Record<string, unknown>));
  return NextResponse.json({ ok: true, applications });
}

// POST /api/management-cv — yangi ariza. Uch manbadan keladi:
//   1) CRM ichidagi "CV to'ldirish (yangi ariza)" modali,
//   2) ommaviy /ariza sahifasi (nomzod o'zi to'ldiradi),
//   3) Google Sheets sinxroni (o'sha yerda to'ldirilgan qatorlar).
// (2) va (3) da `sid` bo'ladi — takror yozmaslik uchun shu bo'yicha
// tekshiramiz.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const input = sanitizeCvInput(body);
  if (!input) {
    return NextResponse.json({ ok: false, error: "Ism va familiyani kiriting" }, { status: 400 });
  }
  if (!input.phone) {
    return NextResponse.json({ ok: false, error: "Telefon raqamni kiriting" }, { status: 400 });
  }
  if (!input.position) {
    return NextResponse.json({ ok: false, error: "Yo'nalishni tanlang" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("cv_applications");

  if (input.sid) {
    const dup = await col.findOne({ sid: input.sid });
    if (dup) {
      return NextResponse.json({
        ok: true,
        dup: true,
        application: toApplication(dup as unknown as Record<string, unknown>),
      });
    }
  }

  const [lastId] = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const [firstOrd] = await col.find({}).sort({ ord: 1 }).limit(1).toArray();

  const application: CvApplication = {
    ...input,
    id: ((lastId?.id as number) ?? 0) + 1,
    status: "new",
    submitted: formatSubmitted(new Date()),
  };
  await col.insertOne({ ...application, ord: ((firstOrd?.ord as number) ?? 1) - 1 });

  return NextResponse.json({ ok: true, application });
}
