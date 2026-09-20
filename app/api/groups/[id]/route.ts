import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { groupScopeFilter } from "@/lib/groupScope";
import { holdsRoom, validateGroupInput, type GroupFormInput } from "@/lib/groupRules";
import { findRoomClashInDb } from "@/lib/groupRoomClash";
import { checkGroupCourse } from "@/lib/groupCourseCheck";
import type { Group } from "@/lib/groups";
import { uzDateIso } from "@/lib/uzTime";

// FILIAL QAMROVI har uchala amalda (lib/groupScope.ts). Kesilmasa, boshqa
// filialning guruhini id bo'yicha ochish ham, tahrirlash ham, O'CHIRISH
// ham mumkin bo'lardi — guruh id'si oddiy son, terib ko'rish oson.
const notLoggedIn = () => NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

// GET /api/groups/:id — bitta guruh (detail sahifasi uchun).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const where = await groupScopeFilter({ id: groupId });
  if (!where) return notLoggedIn();
  const db = await ensureIndexes();
  const row = await db.collection("groups").findOne(where);
  if (!row) {
    return NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });
  }
  const { _id, ...group } = row;
  return NextResponse.json({ ok: true, group: group as unknown as Group });
}

// PATCH /api/groups/:id — guruh maydonlarini qisman yangilaydi.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<Group>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const { id: _ignore, ...set } = body as Partial<Group> & { _id?: unknown };
  delete (set as { _id?: unknown })._id;

  // Kelgan maydonlar modal bilan bir xil qoidada tekshiriladi
  // (lib/groupRules.ts, `partial`): {status:"archive"} yolg'iz o'tadi,
  // lekin majburiy maydonni bo'shatib bo'lmaydi.
  const valid = validateGroupInput(set as GroupFormInput, { partial: true });
  if (!valid.ok) {
    return NextResponse.json({ ok: false, error: valid.error, field: valid.field }, { status: 400 });
  }

  const where = await groupScopeFilter({ id: groupId });
  if (!where) return notLoggedIn();
  const db = await ensureIndexes();

  // Jadval bo'lagi yoki kurs/bosqich o'zgarsa hozirgi hujjat kerak —
  // o'zgarmagan maydonlar undan olinadi.
  const CHECKED = ["room", "day", "time", "startDate", "endDate", "status", "course", "level"];
  const unset: Record<string, ""> = {};
  if (CHECKED.some((k) => k in set)) {
    const cur = await db.collection("groups").findOne(where, { projection: { _id: 0 } });
    if (!cur) return NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });
    const merged = { ...cur, ...set } as unknown as Group & { branchId?: number | null };

    // ARXIVLANGAN KUN (`archivedAt`, "YYYY-MM-DD") — Qarzdorlar hisoboti
    // (lib/debtors.ts) arxivlangan guruhning darslarini shu kungacha sanaydi;
    // aks holda arxivdagi guruh a'zolariga qarz to'planaverardi. Allaqachon
    // arxivda bo'lsa sana o'zgarmaydi; arxivdan qaytarilsa olib tashlanadi.
    if ("status" in set) {
      if (set.status === "archive") {
        if (cur.status !== "archive" || !cur.archivedAt) (set as Record<string, unknown>).archivedAt = uzDateIso();
      } else {
        unset.archivedAt = "";
      }
    }

    // Kurs/bosqich FAQAT O'ZGARGANDA tekshiriladi (POST dagi qoida): eski
    // guruhda arxivdan qolgan "1-bosqich" turgan bo'lsa, telegram havolasini
    // tuzatish uchun ochilgan tahrir shu sabab to'xtab qolmasin.
    const courseChanged = "course" in set && (set.course || "") !== (cur.course || "");
    const levelChanged = "level" in set && (set.level || "") !== (cur.level || "");
    if (courseChanged || (levelChanged && merged.level)) {
      const courseCheck = await checkGroupCourse(db, merged.course || "", merged.level || "");
      if (!courseCheck.ok) {
        return NextResponse.json({ ok: false, error: courseCheck.error, field: courseCheck.field }, { status: 400 });
      }
      // Kanonik yozilish (POST dagi kabi) — faqat so'rovda kelgan maydonlar.
      if ("course" in set) set.course = courseCheck.course;
      if ("level" in set) set.level = courseCheck.level;
    }

    // Xona/kun/vaqt/muddat/holat — yangilangan jadval bo'lagi boshqa tirik
    // guruh bilan to'qnashmasligi.
    if (holdsRoom(merged.status) && typeof merged.branchId === "number") {
      const clash = await findRoomClashInDb(
        db,
        merged.branchId,
        { room: merged.room || "", day: merged.day || "", time: merged.time || "", startDate: merged.startDate, endDate: merged.endDate },
        groupId,
      );
      if (clash) {
        return NextResponse.json({ ok: false, error: clash.error, field: "room", conflict: clash.conflict }, { status: 409 });
      }
    }
  }

  const res = await db.collection("groups").findOneAndUpdate(
    where,
    Object.keys(unset).length ? { $set: set, $unset: unset } : { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });
  }
  const { _id, ...group } = res;
  return NextResponse.json({ ok: true, group: group as unknown as Group });
}

// DELETE /api/groups/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const where = await groupScopeFilter({ id: groupId });
  if (!where) return notLoggedIn();
  const db = await ensureIndexes();
  const res = await db.collection("groups").deleteOne(where);
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
