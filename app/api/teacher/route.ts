import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureIndexes } from "@/lib/mongodb";
import { getGamActor } from "@/lib/gamification/actor";
import { setHomework } from "@/lib/gamification/lesson";
import { uzDateIso } from "@/lib/uzTime";
import { checksBoard, finishLesson, giveHomework, groupsBoard, lessonDesk, markCheckCoin, pupilCard, TASK_CHECKS, resolveTeacher, saveCheck, saveTopic, teacherHome } from "@/lib/teacherDesk";

// O'QITUVCHI ISH STOLI (45-qism, lib/teacherDesk.ts). Kim — o'qituvchi (o'z guruhlari) yoki rahbar (`teacher=` ISM).
//   GET  ?view=home | lesson&groupId= | checks | groups | pupil&groupId=&pupilId=  [&teacher=ISM — faqat admin]
//   POST {action: "topic" (groupId, topic, note) | "homework" (groupId, name, note, deadline, maxScore)
//         | "finish" (groupId) | "check" (taskId, pupilId, done, score, note | clear)}
// Tekshiruvda ✓/✗ — o'quvchining BUGUN shu guruhda davomati bo'lsa uy vazifasi tangasi darhol yoziladi
// (gamifikatsiya qoidasi: tanga dars kuni); bo'lmasa — keyingi darsda dars oynasidan yoziladi.
export const dynamic = "force-dynamic";

async function ctx(req: Request, bodyTeacher?: unknown) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Kirish kerak" }, { status: 401 }) };
  const db = await ensureIndexes();
  const sp = new URL(req.url).searchParams;
  const who = await resolveTeacher(db, user, String(bodyTeacher ?? sp.get("teacher") ?? ""));
  if (!who) return { error: NextResponse.json({ ok: false, error: "Bu sahifa o'qituvchilar uchun" }, { status: 403 }) };
  return { db, who, sp };
}

export async function GET(req: Request) {
  const c = await ctx(req);
  if ("error" in c) return c.error;
  const { db, who, sp } = c;
  const view = sp.get("view") ?? "home";
  const groupId = Number(sp.get("groupId"));
  if (view === "home") return NextResponse.json({ ok: true, ...(await teacherHome(db, who)) });
  if (view === "checks") return NextResponse.json({ ok: true, ...(await checksBoard(db, who)) });
  if (view === "groups") return NextResponse.json({ ok: true, who, ...(await groupsBoard(db, who)) });
  if (view === "lesson") {
    const d = await lessonDesk(db, who, groupId);
    return d ? NextResponse.json({ ok: true, who, ...d }) : NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });
  }
  if (view === "pupil") {
    const d = await pupilCard(db, who, groupId, Number(sp.get("pupilId")));
    return d ? NextResponse.json({ ok: true, ...d }) : NextResponse.json({ ok: false, error: "O'quvchi topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: false, error: "Noma'lum ko'rinish" }, { status: 400 });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ ok: false, error: "So'rov o'qilmadi" }, { status: 400 });
  const c = await ctx(req, b.teacher);
  if ("error" in c) return c.error;
  const { db, who } = c;
  const bad = (error: string) => NextResponse.json({ ok: false, error }, { status: 400 });
  switch (b.action) {
    case "topic": {
      const r = await saveTopic(db, who, b);
      return r.ok ? NextResponse.json(r) : bad(r.error);
    }
    case "homework": {
      const r = await giveHomework(db, who, b);
      return r.ok ? NextResponse.json(r) : bad(r.error);
    }
    case "finish": {
      const r = await finishLesson(db, who, Number(b.groupId));
      return r.ok ? NextResponse.json(r) : bad(r.error);
    }
    case "check": {
      // Diqqat: gamifikatsiyada aynan shu belgini qayta yuborish uni OLIB TASHLAYDI — tanga allaqachon shu qiymat
      // bilan yozilgan bo'lsa, qayta chaqirilmaydi.
      const prev = await db.collection(TASK_CHECKS).findOne({ taskId: Number(b.taskId), pupilId: Number(b.pupilId) }, { projection: { _id: 0, done: 1, coin: 1 } });
      const r = await saveCheck(db, who, b);
      if (!r.ok) return bad(r.error);
      let coin: { amount: number } | { skipped: string } | null = null;
      if (prev && prev.coin != null && prev.done === r.done) coin = { amount: Number(prev.coin) };
      else if (b.clear !== true) {
        const today = uzDateIso();
        const att = await db.collection("attendance").findOne({ groupId: r.groupId, pupilId: r.pupilId, date: today }, { projection: { _id: 0, status: 1 } });
        if (att && ["keldi", "kechikdi", "birinchi"].includes(String(att.status))) {
          const actor = await getGamActor(db).catch(() => null);
          if (actor) {
            try {
              const res = await setHomework(db, actor, { groupId: r.groupId, pupilId: r.pupilId, value: r.done ? "done" : "missed" });
              coin = { amount: res.applied ?? res.amount ?? 0 };
              await markCheckCoin(db, Number(b.taskId), r.pupilId, coin.amount);
            } catch (e) {
              coin = { skipped: e instanceof Error ? e.message : "Tanga yozilmadi" };
            }
          }
        } else coin = { skipped: "Tanga keyingi darsda yoziladi" };
      }
      return NextResponse.json({ ok: true, coin });
    }
    case "check-coin": {
      // Dars oynasi: tekshirilgan, lekin tangasi hali yozilmagan ish — bugungi davomatdan keyin yoziladi.
      const taskId = Number(b.taskId);
      const pupilId = Number(b.pupilId);
      const ch = await db.collection(TASK_CHECKS).findOne({ taskId, pupilId }, { projection: { _id: 0, done: 1, coin: 1, groupId: 1 } });
      if (!ch) return bad("Tekshiruv topilmadi");
      if (ch.coin != null) return NextResponse.json({ ok: true, coin: { amount: Number(ch.coin) } });
      if (!(await lessonDesk(db, who, Number(ch.groupId)))) return bad("Guruh topilmadi");
      const actor = await getGamActor(db).catch(() => null);
      if (!actor) return bad("Tanga yozish huquqi yo'q");
      try {
        const res = await setHomework(db, actor, { groupId: Number(ch.groupId), pupilId, value: ch.done === true ? "done" : "missed" });
        const amount = res.applied ?? res.amount ?? 0;
        await markCheckCoin(db, taskId, pupilId, amount);
        return NextResponse.json({ ok: true, coin: { amount } });
      } catch (e) {
        return bad(e instanceof Error ? e.message : "Tanga yozilmadi");
      }
    }
    default:
      return bad("Noma'lum amal");
  }
}
