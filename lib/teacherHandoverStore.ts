import type { Db } from "mongodb";
import { loadPercentByTier, monthMatch, resolvePercent } from "@/lib/payrollSources";
import {
  TEACHER_HANDOVERS,
  daysInMonthKey,
  handoverNameKey,
  type HandoverPupil,
  type TeacherHandover,
} from "@/lib/teacherHandover";

// USTOZ ALMASHUVI — oyna ma'lumoti, saqlash va o'chirish (app/api/teacher-handovers
// shu yerga tayanadi, route yupqa qobiq). Qoida: lib/teacherHandover.ts.

function nameMatch(name: string) {
  const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { $regex: `^\\s*${escaped}\\s*$`, $options: "i" };
}

/** Xodimni ism bo'yicha topadi (arxivdagisi ham — ketgan ustozga ham almashuv yoziladi). */
async function findEmployee(db: Db, name: string) {
  const n = name.trim();
  if (!n) return null;
  return db.collection("hr_employees").findOne(
    { name: nameMatch(n) },
    { projection: { _id: 0, id: 1, name: 1, turi: 1, archReason: 1, percent: 1 } },
  );
}

export interface HandoverCandidate {
  pupilId: number | null;
  name: string;
  /** Shu oyda ustoz nomiga yozilgan tushum: kirim (chegirma bilan) +, qaytarim −. */
  total: number;
  count: number;
  /** O'quvchining HOZIRGI guruhidagi boshqa ustoz — yangi ustoz taklifi. */
  currentTeacher: string | null;
}

export interface HandoverCandidates {
  month: string;
  teacher: string;
  teacherPercent: number | null;
  daysIn: number;
  handover: TeacherHandover | null;
  pupils: HandoverCandidate[];
  teachers: { name: string; percent: number | null }[];
}

/** Oyna uchun: shu oyda ustoz nomiga yozilgan to'lovlar o'quvchi bo'yicha va taklif. */
export async function loadHandoverCandidates(db: Db, month: string, teacher: string): Promise<HandoverCandidates> {
  const fromKey = handoverNameKey(teacher);
  const [entries, handover, teachers, percentByTier, from] = await Promise.all([
    db.collection("transaction_entries")
      .find({
        $and: [
          { $or: [{ txType: "payIn" }, { txType: "payOut", studentRefund: true }] },
          { $or: monthMatch(month) },
        ],
        status: { $ne: "cancelled" },
        teacherName: nameMatch(teacher),
      })
      .project<{ pupilId?: number; studentName?: string; amount?: number; discountSom?: number; txType?: string }>(
        { _id: 0, pupilId: 1, studentName: 1, amount: 1, discountSom: 1, txType: 1 },
      )
      .sort({ id: 1 })
      .toArray(),
    db.collection<TeacherHandover>(TEACHER_HANDOVERS).findOne({ month, fromKey }, { projection: { _id: 0 } }),
    db.collection("hr_employees")
      .find({ turi: "teacher", archReason: { $in: ["", null] } }, { projection: { _id: 0, name: 1, percent: 1 } })
      .sort({ name: 1 })
      .toArray(),
    loadPercentByTier(db),
    findEmployee(db, teacher),
  ]);

  // O'quvchi bo'yicha — payrollSources.ts dagi qoida bilan bir xil. ID
  // bo'lmagan eski yozuv ism bo'yicha.
  const byPupil = new Map<string, HandoverCandidate>();
  for (const e of entries) {
    const pid = e.pupilId != null && Number.isFinite(Number(e.pupilId)) ? Number(e.pupilId) : null;
    const name = String(e.studentName ?? "").trim();
    const key = pid != null ? `p:${pid}` : `n:${handoverNameKey(name)}`;
    const amount = Math.abs(Number(e.amount) || 0);
    const signed = e.txType === "payIn" ? amount + Math.abs(Number(e.discountSom) || 0) : -amount;
    const cur = byPupil.get(key) ?? { pupilId: pid, name, total: 0, count: 0, currentTeacher: null };
    cur.total += signed;
    cur.count += 1;
    if (name) cur.name = name;
    byPupil.set(key, cur);
  }

  // Yangi ustoz taklifi — HOZIRGI guruhdagi, eski ustozdan boshqa ustoz.
  const ids = [...byPupil.values()].map((p) => p.pupilId).filter((x): x is number => x != null);
  const groups = ids.length
    ? await db.collection("groups")
      .find({ studentIds: { $in: ids } }, { projection: { _id: 0, teacher: 1, studentIds: 1 } })
      .toArray()
    : [];
  const currentOf = new Map<number, string>();
  for (const g of groups) {
    const t = String(g.teacher ?? "").trim();
    if (!t || handoverNameKey(t) === fromKey) continue;
    for (const pid of (g.studentIds ?? []) as number[]) if (!currentOf.has(pid)) currentOf.set(pid, t);
  }

  return {
    month,
    teacher: from ? String(from.name) : teacher,
    teacherPercent: from ? resolvePercent(from.percent, percentByTier) : null,
    daysIn: daysInMonthKey(month),
    handover,
    pupils: [...byPupil.values()]
      .map((p) => ({ ...p, currentTeacher: p.pupilId != null ? currentOf.get(p.pupilId) ?? null : null }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    teachers: teachers
      .filter((t) => handoverNameKey(t.name) !== fromKey)
      .map((t) => ({ name: String(t.name), percent: resolvePercent(t.percent, percentByTier) })),
  };
}

export type SaveHandoverResult =
  | { ok: true; handover: TeacherHandover }
  | { ok: false; error: string };

/** Almashuvni saqlaydi (oy + eski ustoz bo'yicha bitta yozuv, qayta saqlansa almashtiriladi). */
export async function saveHandover(
  db: Db,
  input: { month?: unknown; teacher?: unknown; lastDay?: unknown; pupils?: unknown },
  updatedBy: string,
): Promise<SaveHandoverResult> {
  const fail = (error: string): SaveHandoverResult => ({ ok: false, error });
  const month = String(input.month ?? "").trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return fail("Oy noto'g'ri (YYYY-MM kutiladi)");
  const daysIn = daysInMonthKey(month);
  const lastDay = String(input.lastDay ?? "").trim();
  const ld = /^(\d{4}-\d{2})-(\d{2})$/.exec(lastDay);
  if (!ld || ld[1] !== month || Number(ld[2]) < 1 || Number(ld[2]) > daysIn) {
    return fail("Oxirgi dars kuni shu oy ichida bo'lishi kerak");
  }
  if (Number(ld[2]) === daysIn) return fail("Oxirgi dars kuni oy oxiri — bo'linadigan kun yo'q");

  const from = await findEmployee(db, String(input.teacher ?? ""));
  if (!from) return fail("Ustoz topilmadi");
  const fromTeacher = String(from.name).trim();
  const fromKey = handoverNameKey(fromTeacher);

  const raw = Array.isArray(input.pupils) ? (input.pupils as Partial<HandoverPupil>[]) : [];
  // Yangi ustozlar BAZADAGI xodim ismiga keltiriladi — oylik hisobi ism
  // bo'yicha ulanadi, qo'lda yozilgan ism hech kimga tushmasdi.
  const canon = new Map<string, string | null>();
  const pupils: HandoverPupil[] = [];
  for (const p of raw.slice(0, 500)) {
    const pid = p?.pupilId != null && Number.isFinite(Number(p.pupilId)) ? Number(p.pupilId) : null;
    const name = String(p?.name ?? "").trim().slice(0, 200);
    if (pid == null && !name) continue;
    const want = String(p?.toTeacher ?? "").trim();
    let toTeacher: string | null = null;
    if (want) {
      const k = handoverNameKey(want);
      if (k === fromKey) return fail("Yangi ustoz eski ustozning o'zi bo'lishi mumkin emas");
      if (!canon.has(k)) {
        const emp = await findEmployee(db, want);
        canon.set(k, emp ? String(emp.name).trim() : null);
      }
      toTeacher = canon.get(k) ?? null;
      if (!toTeacher) return fail(`Xodim topilmadi: ${want}`);
    }
    pupils.push({ pupilId: pid, name, toTeacher });
  }
  if (pupils.length === 0) return fail("O'quvchilar ro'yxati bo'sh");

  const doc: TeacherHandover = {
    month,
    fromTeacher,
    fromKey,
    lastDay,
    pupils,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  // `dismissed` o'chiriladi — ilgari eslatma yashirilgan bo'lsa ham endi
  // haqiqiy almashuv.
  await db.collection(TEACHER_HANDOVERS).updateOne(
    { month, fromKey },
    { $set: doc, $unset: { dismissed: "" } },
    { upsert: true },
  );
  return { ok: true, handover: doc };
}

/**
 * "Almashuv yo'q" — Oylik sahifasidagi eslatmani shu oy uchun yashiradi.
 * Hisobga ta'sir qilmaydi (pupils bo'sh). Haqiqiy almashuv bor bo'lsa rad etiladi.
 */
export async function dismissHandoverHint(
  db: Db,
  input: { month?: unknown; teacher?: unknown },
  updatedBy: string,
): Promise<SaveHandoverResult> {
  const month = String(input.month ?? "").trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { ok: false, error: "Oy noto'g'ri (YYYY-MM kutiladi)" };
  const from = await findEmployee(db, String(input.teacher ?? ""));
  if (!from) return { ok: false, error: "Ustoz topilmadi" };
  const fromTeacher = String(from.name).trim();
  const fromKey = handoverNameKey(fromTeacher);
  const existing = await db.collection<TeacherHandover>(TEACHER_HANDOVERS).findOne({ month, fromKey });
  if (existing && !existing.dismissed) {
    return { ok: false, error: "Bu oy uchun ustoz almashuvi allaqachon kiritilgan" };
  }
  const doc: TeacherHandover = {
    month,
    fromTeacher,
    fromKey,
    lastDay: "",
    pupils: [],
    updatedAt: new Date().toISOString(),
    updatedBy,
    dismissed: true,
  };
  await db.collection(TEACHER_HANDOVERS).updateOne({ month, fromKey }, { $set: doc }, { upsert: true });
  return { ok: true, handover: doc };
}

/**
 * ESLATMA — Oylik sahifasi uchun (foydalanuvchi, 30.09.2026: "keyin ham
 * shunaqa holat bo'lsa?"). Shu oy ustoz nomiga to'lagan o'quvchilardan qaysilari
 * endi FAQAT boshqa ustozning SHU FANDAGI guruhida, almashuv esa kiritilmagan.
 *
 * FAN SHARTI SHART: sentabr ma'lumotida fansiz qoida 38 ustozdan 15 tasiga
 * eslatma chiqarardi — o'quvchi boshqa fanni boshqa ustozda o'qishi yoki
 * umuman guruhsiz turishi odatiy. Fan (`groups.course` ∈ ustoz `kurs`
 * ro'yxati, vergul bilan) bilan — 4 tasi, hammasi tekshirishga arziydi.
 * Guruhsiz o'quvchi sanalmaydi (ketgan bo'lishi mumkin).
 *
 * `rows` — oylik qatorlari; faqat foiz qismi bor ustozlar ko'riladi.
 */
export async function detectMovedPupils(
  db: Db,
  month: string,
  teachers: string[],
): Promise<Map<string, { count: number; teachers: string[] }>> {
  const out = new Map<string, { count: number; teachers: string[] }>();
  const keys = new Set(teachers.map(handoverNameKey).filter(Boolean));
  if (keys.size === 0) return out;

  const [entries, docs, groups, emps] = await Promise.all([
    db.collection("transaction_entries")
      .find({
        txType: "payIn",
        status: { $ne: "cancelled" },
        teacherName: { $nin: ["", null] },
        pupilId: { $ne: null },
        $or: monthMatch(month),
      })
      .project<{ teacherName?: string; pupilId?: number }>({ _id: 0, teacherName: 1, pupilId: 1 })
      .toArray(),
    // Almashuv kiritilgan YOKI eslatma yashirilgan ustozlar — eslatma yo'q.
    db.collection(TEACHER_HANDOVERS).find({ month }, { projection: { _id: 0, fromKey: 1 } }).toArray(),
    db.collection("groups")
      .find({}, { projection: { _id: 0, teacher: 1, studentIds: 1, course: 1 } })
      .toArray(),
    db.collection("hr_employees")
      .find({ turi: "teacher" }, { projection: { _id: 0, name: 1, kurs: 1 } })
      .toArray(),
  ]);
  const done = new Set(docs.map((d) => String(d.fromKey)));
  const kursOf = new Map(emps.map((e) => [
    handoverNameKey(e.name),
    String(e.kurs ?? "").split(",").map(handoverNameKey).filter(Boolean),
  ]));
  const groupsOf = new Map<number, { teacher: string; course: string }[]>();
  for (const g of groups) {
    const t = String(g.teacher ?? "").trim();
    if (!t) continue;
    for (const pid of (g.studentIds ?? []) as number[]) {
      const list = groupsOf.get(pid) ?? [];
      list.push({ teacher: t, course: handoverNameKey(g.course) });
      groupsOf.set(pid, list);
    }
  }
  const pupilsOf = new Map<string, Set<number>>();
  for (const e of entries) {
    const k = handoverNameKey(e.teacherName);
    const pid = Number(e.pupilId);
    if (!keys.has(k) || done.has(k) || !Number.isFinite(pid)) continue;
    const set = pupilsOf.get(k) ?? new Set<number>();
    set.add(pid);
    pupilsOf.set(k, set);
  }
  for (const [k, pupils] of pupilsOf) {
    const kurs = kursOf.get(k) ?? [];
    if (kurs.length === 0) continue;
    let count = 0;
    const others = new Set<string>();
    for (const pid of pupils) {
      const gs = groupsOf.get(pid) ?? [];
      if (gs.some((g) => handoverNameKey(g.teacher) === k)) continue; // hali o'z guruhida
      const same = gs.filter((g) => handoverNameKey(g.teacher) !== k && kurs.includes(g.course));
      if (same.length === 0) continue;
      count += 1;
      for (const g of same) others.add(g.teacher);
    }
    if (count > 0) out.set(k, { count, teachers: [...others] });
  }
  return out;
}

/** Almashuvni olib tashlaydi — to'lovlar yana to'liq eski ustozda. */
export async function deleteHandover(db: Db, month: string, teacher: string): Promise<number> {
  const r = await db.collection(TEACHER_HANDOVERS).deleteOne({ month, fromKey: handoverNameKey(teacher) });
  return r.deletedCount;
}
