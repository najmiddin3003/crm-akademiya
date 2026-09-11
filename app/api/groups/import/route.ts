import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { branchForInsert, getBranchScope } from "@/lib/branchScope";
import { nextGroupId } from "@/lib/groupIds";
import type { Group } from "@/lib/groups";

// POST /api/groups/import — bir nechta guruhni bir so'rovda qo'shadi.
//
// Guruhlar ro'yxatidagi "Import" tugmasi shu yerga yozadi. Ilgari o'sha
// tugma faqat "Import (demo)" toast'ini ko'rsatib, hech narsa qilmasdi.
//
// Kutilayotgan ustunlar — AYNAN shu sahifaning CSV eksporti chiqaradigan
// ustunlar, ya'ni eksport qilib, tahrirlab, qaytadan import qilish mumkin.
// "№" va "O'quvchi" e'tiborga olinmaydi: birinchisi qator raqami,
// ikkinchisi esa guruhga qo'shilgan o'quvchilardan hisoblanadi.

export interface ImportGroupRow {
  name?: string;
  course?: string;
  level?: string;
  day?: string;
  time?: string;
  period?: string;
  teacher?: string;
  room?: string;
  telegram?: string;
  status?: string;
}

const str = (v: unknown) => String(v ?? "").trim();

export async function POST(req: Request) {
  let body: { groups?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const incoming = body.groups;
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return NextResponse.json({ ok: false, error: "Import uchun qator topilmadi" }, { status: 400 });
  }
  if (incoming.length > 1000) {
    return NextResponse.json({ ok: false, error: "Bir martada 1000 tadan ko'p qator import qilib bo'lmaydi" }, { status: 400 });
  }

  // IMPORT QILINGAN GURUH HAM FILIALGA TEGISHLI. Bu maydonsiz yozuvlar
  // `branchId` siz tushardi va qamrov ularni 1-filialga hisoblardi
  // (branchCondition) — ya'ni Uchqo'rg'onda import qilingan guruhlar o'sha
  // zahoti g'oyib bo'lardi, xatosiz.
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const branchId = branchForInsert(scope);

  const db = await ensureIndexes();
  const col = db.collection("groups");

  // Mavjud nomlar — bir xil nomli guruh ikkinchi marta yaratilmasin.
  // Nom tekshiruvi ATAYLAB butun kolleksiya bo'yicha: `id` global ketma-ket
  // va nom ham chalkashmasligi kerak (bir xil nomli ikki guruh ikki
  // filialda — jadval va hisobotlarda ajratib bo'lmas edi).
  const existing = await col.find({}, { projection: { id: 1, name: 1 } }).toArray();
  const takenNames = new Set(existing.map((g) => str(g.name).toLowerCase()));
  // Raqamlash arxivdagi guruhlardan ham davom etadi (lib/groupIds.ts).
  let nextId = await nextGroupId(db);

  const created: Group[] = [];
  const skipped: { row: number; reason: string }[] = [];

  for (let i = 0; i < incoming.length; i++) {
    const r = (incoming[i] ?? {}) as ImportGroupRow;
    const name = str(r.name);
    if (!name) {
      skipped.push({ row: i + 1, reason: "Guruh nomi bo'sh" });
      continue;
    }
    if (takenNames.has(name.toLowerCase())) {
      skipped.push({ row: i + 1, reason: `"${name}" nomli guruh allaqachon bor` });
      continue;
    }
    takenNames.add(name.toLowerCase());

    const group: Group = {
      id: nextId++,
      name,
      course: str(r.course),
      level: str(r.level),
      day: str(r.day),
      time: str(r.time),
      period: str(r.period),
      periodExpired: false,
      students: 0,
      teacher: str(r.teacher),
      room: str(r.room),
      telegram: str(r.telegram) || null,
      status: str(r.status) || "active",
      // Ro'yxatdagi GET har safar qayta hisoblaydi (bugun dars kuni + davomat yo'q).
      highlighted: false,
      studentIds: [],
    };
    created.push(group);
  }

  if (created.length > 0) {
    await col.insertMany(created.map((g) => ({ ...g, branchId })));
  }

  return NextResponse.json({ ok: true, created: created.length, skipped });
}
