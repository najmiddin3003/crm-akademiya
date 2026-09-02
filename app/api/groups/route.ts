import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { branchForInsert, getBranchScope } from "@/lib/branchScope";
import { loadGroups } from "@/lib/listQueries";
import type { Group } from "@/lib/groups";

// Guruh backend'i (MongoDB `groups`). Demo seed YO'Q — guruhlarni
// foydalanuvchi o'zi qo'shadi.
// "2025-09-03" → "03.09.2025"
function fmtDate(iso?: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

export async function GET() {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  // Ro'yxatni YIG'ISH mantig'i lib/listQueries.ts da — uni Guruhlar
  // sahifasining server komponenti ham chaqiradi. Ikki joyda ikki xil
  // natija chiqmasligi uchun manba bitta.
  const groups = await loadGroups(scope);
  return NextResponse.json({ ok: true, groups });
}

export async function POST(req: Request) {
  let body: Partial<Group> & { startDate?: string; endDate?: string; eduType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Guruh nomini kiriting" }, { status: 400 });
  }

  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const branchId = branchForInsert(scope);
  if (branchId === null) {
    return NextResponse.json(
      { ok: false, error: "Avval navbardan filialni tanlang — guruh qaysi filialda ochilishi kerak?" },
      { status: 400 },
    );
  }

  const db = await ensureIndexes();
  const col = db.collection("groups");
  // `id` GLOBAL ketma-ket — filial bo'yicha kesilmaydi (E11000 xavfi).
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const period = body.startDate || body.endDate ? `${fmtDate(body.startDate)} - ${fmtDate(body.endDate)}` : "";
  const group: Group = {
    id: nextId,
    name,
    course: body.course || "",
    level: body.eduType || "",
    eduType: body.eduType || "",
    day: "",
    time: "",
    period,
    periodExpired: false,
    students: 0,
    teacher: "",
    room: "",
    telegram: body.telegram || null,
    status: body.status || "active",
    // Roʻyxatda GET har safar qayta hisoblaydi (bugun dars kuni + davomat yoʻq).
    highlighted: false,
    startDate: body.startDate || "",
    endDate: body.endDate || "",
  };
  await col.insertOne({ ...group, branchId });
  return NextResponse.json({ ok: true, group });
}
