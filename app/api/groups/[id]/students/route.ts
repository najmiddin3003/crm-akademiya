import { NextResponse, after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope, withBranch, withPupilBranch } from "@/lib/branchScope";
import type { Group } from "@/lib/groups";
import type { Pupil } from "@/lib/pupilsData";
import { GROUP_MEMBERSHIPS, isoDateOrNull, type GroupMembership } from "@/lib/groupMembership";
import { addPupilToGroup, removePupilFromGroup } from "@/lib/groupStudents";

// FILIAL QAMROVI IKKALA TOMONDA: guruh ham, o'quvchi ham JORIY filialda
// bo'lishi shart. Faqat guruh kesilsa, moderator boshqa filialning
// o'quvchisini o'z guruhiga qo'shib, uni shu yo'l bilan ko'rib olardi —
// o'quvchilar ro'yxati kesilgani bekor bo'lardi.
const notLoggedIn = () => NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

// GET /api/groups/:id/students — guruhga qo'shilgan o'quvchilar (pupils).
// group.studentIds (pupils.id) bo'yicha pupils kolleksiyasiga join qiladi.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const scope = await getBranchScope();
  if (!scope) return notLoggedIn();
  const db = await ensureIndexes();
  const group = await db.collection<Group>("groups").findOne(withBranch({ id: groupId }, scope));
  if (!group) {
    return NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });
  }
  const ids = group.studentIds ?? [];
  const rows = ids.length
    ? await db.collection("pupils").find(withPupilBranch({ id: { $in: ids } }, scope)).toArray()
    : [];
  // Guruhga qo'shilgan sana — a'zolik tarixidan (lib/groupMembership.ts);
  // jadvaldagi "Qo'shilgan sana" ustuni shuni ko'rsatadi. Yozuvi bo'lmagan
  // (sanasi noma'lum) o'quvchida maydon bo'lmaydi.
  const open = ids.length
    ? await db
        .collection<GroupMembership>(GROUP_MEMBERSHIPS)
        .find({ groupId, pupilId: { $in: ids }, leftAt: null }, { projection: { _id: 0, pupilId: 1, joinedAt: 1 } })
        .toArray()
    : [];
  const joinedAtOf = new Map(open.map((m) => [m.pupilId, m.joinedAt]));
  // studentIds tartibini saqlaymiz (qo'shilgan tartibda).
  const byId = new Map(rows.map((r) => [r.id, r]));
  const students = ids
    .map((pid) => byId.get(pid))
    .filter(Boolean)
    .map((r) => {
      const { _id, ...rest } = r as Record<string, unknown>;
      const joinedAt = joinedAtOf.get(Number(rest.id));
      return (joinedAt ? { ...rest, joinedAt } : rest) as unknown as Pupil;
    });
  return NextResponse.json({ ok: true, students });
}

// POST /api/groups/:id/students — { pupilId, joinedAt? } o'quvchini guruhga
// qo'shadi. `joinedAt` ("YYYY-MM-DD") — darslar shu kundan sanaladi
// (Qarzdorlar hisoboti); berilmasa bugun. Kelajak sanasi ham mumkin
// (lid birinchi darsga yozilganda).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: { pupilId?: number; joinedAt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const pupilId = Number(body.pupilId);
  if (!Number.isFinite(pupilId)) {
    return NextResponse.json({ ok: false, error: "O'quvchini tanlang" }, { status: 400 });
  }
  if (body.joinedAt !== undefined && body.joinedAt !== "" && !isoDateOrNull(body.joinedAt)) {
    return NextResponse.json({ ok: false, error: "Qo'shilgan sana formati noto'g'ri (YYYY-MM-DD kutilgan)" }, { status: 400 });
  }
  // Berilmasa — bugun (yadro qo'yadi).
  const joinedAt = isoDateOrNull(body.joinedAt);

  const scope = await getBranchScope();
  if (!scope) return notLoggedIn();
  const db = await ensureIndexes();
  // Yozish — lib/groupStudents.ts (AI yordamchi ham shuni chaqiradi).
  // O'quvchilar botining "yangi guruhga qo'shildingiz" xabari `after()`
  // ichida — Telegram sekin javob bersa ham xodim kutib turmaydi;
  // `notifyGroupAdded` o'zi hech qachon otmaydi va sozlama o'chiq bo'lsa
  // jimgina qaytadi.
  const out = await addPupilToGroup(db, scope, groupId, pupilId, joinedAt, { defer: (fn) => after(fn) });
  if (!out.ok) return NextResponse.json({ ok: false, error: out.error }, { status: out.status });
  return NextResponse.json({ ok: true, student: out.value.pupil });
}

// DELETE /api/groups/:id/students?pupilId=11 — o'quvchini guruhdan chiqaradi.
//
// Ilgari bunday endpoint yo'q edi: guruhga qo'shish bor edi, chiqarish esa
// faqat o'quvchining o'zini o'chirish orqali bo'lardi.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const pupilId = Number(new URL(req.url).searchParams.get("pupilId"));
  if (!Number.isFinite(pupilId)) {
    return NextResponse.json({ ok: false, error: "O'quvchini tanlang" }, { status: 400 });
  }

  const scope = await getBranchScope();
  if (!scope) return notLoggedIn();
  const db = await ensureIndexes();
  // A'zolik shu kun yopiladi — o'tgan darslari qarz bo'lib qoladi
  // (lib/groupStudents.ts → lib/groupMembership.ts).
  const out = await removePupilFromGroup(db, scope, groupId, pupilId);
  if (!out.ok) return NextResponse.json({ ok: false, error: out.error }, { status: out.status });
  return NextResponse.json({ ok: true, removed: out.value.removed });
}
