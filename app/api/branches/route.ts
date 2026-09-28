import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import {
  BRANCH_TOPIC_FIELDS,
  parseLateGrace,
  parseLeadTopicId,
  parseWorkStart,
  type ManagementBranch,
} from "@/lib/managementBranches";
import { getCurrentUser } from "@/lib/auth";

// Boshqaruv → Filiallar backend'i (MongoDB `branches`). Demo seed YO'Q —
// filiallarni foydalanuvchi o'zi qo'shadi.
export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("branches");
  const rows = await col.find({}).sort({ id: 1 }).toArray();
  const branches = rows.map(({ _id, ...rest }) => rest as unknown as ManagementBranch);
  return NextResponse.json({ ok: true, branches });
}

// FILIAL YARATISH — FAQAT ADMIN.
//
// NIMA UCHUN HANDLER ICHIDA: ruxsat jadvali PATHNAME bo'yicha ishlaydi va
// `/api/branches` ni 14 ta sahifaga ochib qo'ygan (`/orders-list`,
// `/offline-courses`, sozlamalar…). Bu GET uchun to'g'ri — filial
// ro'yxati deyarli hamma joyda kerak. Lekin POST o'sha pathname'da va u
// YANGI FILIAL YARATADI: moderator so'rovni qo'lda yuborib tizimga filial
// qo'shib qo'yishi mumkin edi, interfeysda tugma yashirilgan bo'lsa ham.
//
// Naqsh app/api/hr-employees/[id]/password/route.ts dan olingan — u yerda
// ham bitta pathname ichida sezgirligi har xil ikkita metod bor.
async function requireAdmin() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Avtorizatsiya kerak" }, { status: 401 });
  if (me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Filial qo'shish faqat administrator uchun" }, { status: 403 });
  }
  return null;
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: Partial<ManagementBranch>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Filial nomini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("branches");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  // Telegram topiklari — ixtiyoriy; forma tahrirlash bilan bir xil, shu bois
  // qo'shishda ham qabul qilinadi. Bo'sh bo'lsa maydon umuman yozilmaydi.
  const topics: Partial<Pick<ManagementBranch, "leadTopicId" | "paymentTopicId" | "attendanceTopicId">> = {};
  for (const field of BRANCH_TOPIC_FIELDS) {
    const topic = parseLeadTopicId(body[field]);
    if (!topic.ok) return NextResponse.json({ ok: false, error: topic.error }, { status: 400 });
    if (topic.value) topics[field] = topic.value;
  }
  // «Ishga keldim» kechikish chegarasi — ixtiyoriy, bo'sh bo'lsa yozilmaydi.
  const work = parseWorkStart(body.workStart);
  if (!work.ok) return NextResponse.json({ ok: false, error: work.error }, { status: 400 });
  const grace = parseLateGrace(body.lateGraceMin);
  if (!grace.ok) return NextResponse.json({ ok: false, error: grace.error }, { status: 400 });

  const branch: ManagementBranch = {
    id: nextId,
    name,
    location: (body.location || "").trim(),
    address: (body.address || "").trim(),
    phone: (body.phone || "").trim(),
    ...topics,
    ...(work.value ? { workStart: work.value } : {}),
    ...(grace.value ? { lateGraceMin: grace.value } : {}),
  };
  await col.insertOne({ ...branch });
  return NextResponse.json({ ok: true, branch });
}
