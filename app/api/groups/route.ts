import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { branchForInsert, getBranchScope } from "@/lib/branchScope";
import { loadGroups } from "@/lib/listQueries";
import { nextGroupId } from "@/lib/groupIds";
import { validateGroupInput, type GroupFormInput } from "@/lib/groupRules";
import { findRoomClashInDb } from "@/lib/groupRoomClash";
import type { Group } from "@/lib/groups";

// Guruh backend'i (MongoDB `groups`). Demo seed YO'Q — guruhlarni
// foydalanuvchi o'zi qo'shadi.
//
// POST tekshiruvi lib/groupRules.ts da — modal bilan BIR XIL qoida
// (majburiy maydonlar, vaqt shakli), ustiga xona bandligi (409). Ilgari
// faqat nom tekshirilar, o'qituvchi/xona/kun/vaqt esa bo'sh yozilardi.
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
  const groups = await loadGroups();
  return NextResponse.json({ ok: true, groups });
}

export async function POST(req: Request) {
  let body: GroupFormInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const input: GroupFormInput = {
    name: str(body.name),
    status: str(body.status) || "active",
    course: str(body.course),
    level: str(body.level),
    day: str(body.day),
    time: str(body.time),
    teacher: str(body.teacher),
    assistant: str(body.assistant),
    eduType: str(body.eduType),
    room: str(body.room),
    telegram: str(body.telegram),
    startDate: str(body.startDate),
    endDate: str(body.endDate),
  };
  const valid = validateGroupInput(input);
  if (!valid.ok) {
    return NextResponse.json({ ok: false, error: valid.error, field: valid.field }, { status: 400 });
  }
  const name = input.name!;

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

  // Xona shu kun-vaqtda boshqa tirik guruh bilan band bo'lsa — 409. Modal
  // buni ro'yxatdan oldindan ko'rsatadi, lekin ikki moderator bir vaqtda
  // qo'shsa yoki so'rov to'g'ridan-to'g'ri kelsa, oxirgi so'z shu yerda.
  // Arxiv holatida ochilayotgan guruh xona egallamaydi (PATCH dagi qoida bilan bir xil).
  const clash = input.status === "active" || input.status === "frozen"
    ? await findRoomClashInDb(db, branchId, {
        room: input.room!,
        day: input.day!,
        time: input.time!,
        startDate: input.startDate,
        endDate: input.endDate,
      })
    : null;
  if (clash) {
    return NextResponse.json({ ok: false, error: clash.error, field: "room", conflict: clash.conflict }, { status: 409 });
  }

  // `id` GLOBAL ketma-ket — filial bo'yicha kesilmaydi (E11000 xavfi) va
  // arxivdagi guruhlarni ham hisobga oladi (lib/groupIds.ts).
  const nextId = await nextGroupId(db);

  const period = input.startDate || input.endDate ? `${fmtDate(input.startDate)} - ${fmtDate(input.endDate)}` : "";
  const group: Group = {
    id: nextId,
    name,
    course: input.course!,
    // Daraja (bosqich) — ixtiyoriy; 11.09.2026 gacha bu yerga xato bilan
    // ta'lim TURI ("Oflayn") yozilardi.
    level: input.level || "",
    eduType: input.eduType!,
    day: input.day!,
    time: input.time!,
    period,
    periodExpired: false,
    students: 0,
    teacher: input.teacher!,
    room: input.room!,
    telegram: input.telegram || null,
    status: input.status!,
    // Roʻyxatda GET har safar qayta hisoblaydi (bugun dars kuni + davomat yoʻq).
    highlighted: false,
    startDate: input.startDate || "",
    endDate: input.endDate || "",
  };
  if (input.assistant) group.assistant = input.assistant;
  await col.insertOne({ ...group, branchId });
  return NextResponse.json({ ok: true, group });
}
