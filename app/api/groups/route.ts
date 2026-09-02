import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { branchForInsert, getBranchScope, withBranch } from "@/lib/branchScope";
import { groupWeekdays } from "@/lib/attendance";
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

  const db = await ensureIndexes();
  const col = db.collection("groups");

  // `highlighted` bazada saqlanmaydi — HAR SO'ROVDA hisoblanadi: bugun shu
  // guruhning dars kuni bo'lsa va davomat hali qilinmagan bo'lsa, guruh
  // ro'yxatda sariq qator bo'lib turadi (referens: akademiya.edutizim.uz).
  // Davomat qilingan deb bugungi sana bo'yicha kamida bitta belgi bo'lishi
  // hisoblanadi (`attendance` kolleksiyasi: {groupId, pupilId, date, status}).
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const todayIso = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  const weekday = now.getDay();

  // Ikkala so'rov BIR-BIRIGA BOG'LIQ EMAS — ketma-ket kutilsa ikkita
  // kechikish qo'shilardi (o'lchandi: 359 ms -> 189 ms).
  const [rows, marked] = await Promise.all([
    col.find(withBranch({}, scope)).sort({ id: 1 }).toArray(),
    db.collection("attendance").distinct("groupId", { date: todayIso }),
  ]);
  const markedToday = new Set<number>(marked as number[]);

  const groups = rows.map(({ _id, ...rest }) => {
    const g = rest as unknown as Group;
    return {
      ...g,
      highlighted: groupWeekdays(g.day).includes(weekday) && !markedToday.has(g.id),
    };
  });
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
