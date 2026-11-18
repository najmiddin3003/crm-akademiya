import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { groupLabel } from "@/lib/groups";
import { pupilFullName, pupilStatusOf } from "@/lib/pupilsData";
import {
  attendanceMonths,
  branchName,
  loadAttendance,
  loadExams,
  loadGroups,
  loadPayments,
  loadPupil,
  loadPupilNames,
  loadTasks,
  nextLesson,
} from "@/lib/studentBot/data";
import { dueFor } from "@/lib/studentBot/dues";
import { authStudentWeb } from "@/lib/studentBot/webapp";
import { studentCoinSummary } from "@/lib/gamification/studentPage";
import { buildStudentCabinet } from "@/lib/studentCabinet";
import { cabinetFeed } from "@/lib/cabinetNews";
import { seasonCardsFor } from "@/lib/seasonGrades";
import { uzbmbStats } from "@/lib/studentUzbmb";
import { loadStudentApp } from "@/lib/studentAppSettings";

// O'QUVCHI WEB SAHIFASINING YAGONA MA'LUMOT MANBAI.
//
// FAQAT O'QIYDI. Bu marshrutda hech qanday yozish amali YO'Q va
// qo'shilmasligi ham kerak: o'quvchi CRM ma'lumotini o'zgartira
// olmasligi kelishilgan. Tahrirlash kerak bo'lsa u xodim sahifasi
// orqali bo'ladi, bu yerdan emas.
//
// KIM EKANI `initData` IMZOSI bo'yicha aniqlanadi
// (lib/studentBot/webapp.ts). So'rovda o'quvchi id'si UMUMAN
// QABUL QILINMAYDI — bo'lsa ham e'tiborsiz qoldiriladi, chunki
// o'quvchi bog'lanish yozuvidan olinadi.
//
// MAYDONLAR OQ RO'YXAT bo'yicha ko'chiriladi, hujjat butunicha
// yuborilmaydi. `pupils` da o'quvchiga ko'rsatilmaydigan narsalar bor
// (`debtLimit`, `moderator`, ichki izohlar), guruhda esa boshqa
// o'quvchilarning id'lari (`studentIds`).

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let initData = "";
  try {
    const body = (await req.json()) as { initData?: unknown };
    initData = typeof body.initData === "string" ? body.initData : "";
  } catch {
    return NextResponse.json({ ok: false, error: "So'rov o'qilmadi" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const auth = await authStudentWeb(db, initData);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { user } = auth;
  const pupil = await loadPupil(db, user.activePupilId);
  if (!pupil) {
    return NextResponse.json({ ok: false, error: "O'quvchi topilmadi" }, { status: 404 });
  }

  const [branch, groups, payments, exams, months, marks, names, cabinet] = await Promise.all([
    branchName(db, (pupil as { branchId?: number }).branchId),
    loadGroups(db, pupil.id),
    loadPayments(db, pupil, 50),
    loadExams(db, pupil),
    attendanceMonths(db, pupil.id),
    loadAttendance(db, pupil.id),
    loadPupilNames(db, user.links.map((l) => l.pupilId)),
    // Yangi kabinet (v2, 28-qism). Xato bersa null — eski kabinet unga tayanmaydi.
    buildStudentCabinet(db, pupil).catch((e) => {
      console.error("[student-web] cabinet", e);
      return null;
    }),
  ]);
  const tasks = await loadTasks(db, groups.map((g) => g.id));
  const due = await dueFor(db, pupil);
  // Gamifikatsiya yoqilgan bo'lsa «Coin» — haqiqiy hamyon (tangalar), aks
  // holda eskicha `pupils.coin`. Xato kabinetni yiqitmaydi.
  const game = await studentCoinSummary(db, pupil.id).catch(() => null);
  const next = nextLesson(groups);
  const link = user.links.find((l) => l.pupilId === pupil.id);
  // Yangiliklar va hikoyalar (36-qism) — xato bersa kabinet baribir ochiladi.
  const feed = await cabinetFeed(db, pupil.id, Number((pupil as { branchId?: number }).branchId) || 1, link?.role === "parent" ? "parent" : "student").catch((e) => {
    console.error("[student-web] feed", e);
    return { news: [], stories: [] };
  });
  const season = await seasonCardsFor(db, pupil.id).catch(() => []);
  const ubStats = await uzbmbStats(db, exams.uzbmb as never).catch(() => []);
  // 44-qism: farzand tanlash menyusi — har farzandning guruhlari soni, birinchi guruhi va filiali (qarz faqat ochilgan farzandda).
  const kidInfo = await kidsSummary(db, user.links.map((l) => l.pupilId)).catch(() => new Map<number, { groups: number; branch: string; course: string }>());
  // 38-qism: Sozlamalar → O'quvchi ilovasi — o'chirilgan qismlar kabinetga yuborilmaydi.
  const appPrefs = await loadStudentApp(db).catch(() => ({ showDebt: true, stories: true, news: true, ofertaGate: false }));
  if (!appPrefs.stories) feed.stories = [];
  if (!appPrefs.news) feed.news = [];

  return NextResponse.json({
    ok: true,
    profile: {
      id: pupil.id,
      fullName: pupilFullName(pupil),
      branch,
      status: pupilStatusOf(pupil),
      role: link?.role ?? "student",
      category: pupil.category ?? "",
      birthDate: pupil.birthDate ?? "",
      phone: pupil.phone ?? "",
      coin: game ? game.balance : pupil.coin ?? 0,
      // `balance` VA ARXIV BERILMAYDI. `pupils.balance` ni hech bir API
      // yangilamaydi (o'lik maydon) — u har doim 0 chiqib, o'quvchida
      // "to'lovim yo'qolibdi" degan savol tug'dirardi. Arxiv esa
      // markaz qaroriga ko'ra hozircha ko'rsatilmaydi
      // (lib/studentBot/data.ts dagi izoh).
      paid: payments.liveTotal,
      // Ro'yxatdagi boshqa farzandlar — "kimni ko'ryapman" yozuvi uchun.
      // Faqat ID va ism: ular ham shu odamga bog'langan o'quvchilar.
      kids: user.links.map((l) => ({ id: l.pupilId, name: names.get(l.pupilId) ?? `#${l.pupilId}`, ...(kidInfo.get(l.pupilId) ?? { groups: 0, branch: "", course: "" }) })),
    },
    groups: groups.map((g) => ({
      id: g.id,
      name: groupLabel(g),
      course: g.course ?? "",
      level: g.level ?? "",
      day: g.day ?? "",
      time: g.time ?? "",
      teacher: g.teacher ?? "",
      room: g.room ?? "",
      eduType: g.eduType ?? "",
    })),
    nextLesson: next
      ? { groupName: groupLabel(next.group), iso: next.iso, inDays: next.inDays, time: next.group.time ?? "" }
      : null,
    attendance: { months, marks },
    payments: { rows: payments.rows, totalCount: payments.totalCount },
    tasks: tasks.map((t) => ({
      id: t.id,
      name: t.name ?? "",
      type: t.type ?? "",
      deadline: t.deadline ?? "",
      maxScore: t.maxScore ?? 0,
      groupName: t.groupName ?? "",
      note: t.note ?? "",
    })),
    exams,
    // Joriy oy to'lovi qayd etilganmi — kabinetdagi eslatma uchun.
    due,
    addresses: pupil.addresses ?? [],
    cabinet,
    feed,
    season,
    uzbmbStats: ubStats,
    appPrefs,
  });
}

async function kidsSummary(db: Awaited<ReturnType<typeof ensureIndexes>>, ids: number[]) {
  const out = new Map<number, { groups: number; branch: string; course: string }>();
  if (ids.length < 2) return out;
  const [pupils, mems, branches] = await Promise.all([
    db.collection("pupils").find({ id: { $in: ids } }, { projection: { _id: 0, id: 1, branchId: 1 } }).toArray(),
    db.collection("group_memberships").find({ pupilId: { $in: ids }, leftAt: null }, { projection: { _id: 0, pupilId: 1, groupId: 1 } }).toArray(),
    db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray(),
  ]);
  const groups = await db.collection("groups").find({ id: { $in: mems.map((m) => Number(m.groupId)) } }, { projection: { _id: 0, id: 1, name: 1, course: 1, level: 1 } }).toArray();
  for (const id of ids) {
    const my = mems.filter((m) => Number(m.pupilId) === id).map((m) => groups.find((g) => Number(g.id) === Number(m.groupId))).filter(Boolean);
    const p = pupils.find((x) => Number(x.id) === id);
    const g = my[0];
    out.set(id, {
      groups: my.length,
      branch: String(branches.find((b) => Number(b.id) === Number(p?.branchId))?.name ?? ""),
      course: g ? [g.course, g.level].filter(Boolean).join(" · ") : "",
    });
  }
  return out;
}
