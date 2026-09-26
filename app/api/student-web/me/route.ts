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

  const [branch, groups, payments, exams, months, marks, names] = await Promise.all([
    branchName(db, (pupil as { branchId?: number }).branchId),
    loadGroups(db, pupil.id),
    loadPayments(db, pupil, 50),
    loadExams(db, pupil),
    attendanceMonths(db, pupil.id),
    loadAttendance(db, pupil.id),
    loadPupilNames(db, user.links.map((l) => l.pupilId)),
  ]);
  const tasks = await loadTasks(db, groups.map((g) => g.id));
  const due = await dueFor(db, pupil);
  // Gamifikatsiya yoqilgan bo'lsa «Coin» — haqiqiy hamyon (tangalar), aks
  // holda eskicha `pupils.coin`. Xato kabinetni yiqitmaydi.
  const game = await studentCoinSummary(db, pupil.id).catch(() => null);
  const next = nextLesson(groups);
  const link = user.links.find((l) => l.pupilId === pupil.id);

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
      kids: user.links.map((l) => ({ id: l.pupilId, name: names.get(l.pupilId) ?? `#${l.pupilId}` })),
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
  });
}
