import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { employeeNameById } from "@/lib/currentEmployee";
import { ensureIndexes } from "@/lib/mongodb";
import { REPORT_COMMENT_MAX, type InboxPayload, type InboxTask } from "@/lib/taskInbox";
import {
  isTaskOutcome,
  isTaskPriority,
  isTaskTargetKind,
  OPEN_TASK_STATES,
  parseTaskReport,
  type TaskReport,
} from "@/lib/tasksData";
import { uzParseStamp } from "@/lib/uzTime";

// XODIMNING SHAXSIY TOPSHIRIQ OYNASI (navbardagi topshiriq ikonkasi +
// login'dan keyingi modal).
//
// Ikki ro'yxat, ikkalasi ham foydalanuvchining O'ZIGA bog'langan:
//   pending — `staffId` MENING xodim yozuvim bo'lgan, hali javob
//             berilmagan, yopilmagan topshiriqlar;
//   reports — `createdBy.userId` MEN bo'lgan topshiriqlarga kelgan, hali
//             "Ko'rdim" deb belgilanmagan hisobotlar.
//
// QOBIQ ROUTE'i: AppShell'dan har sahifada chaqiriladi, shu bois BO'LIM
// RUXSATIGA BOG'LANMAYDI (gen-api-permissions uni qobiq havolasi sifatida
// o'zi SHARED_API ga qo'yadi). Bu yerda ruxsat tekshiruvi ATAYIN yo'q:
// /tasks sahifasini ko'rmaydigan o'qituvchiga ham topshiriq beriladi va u
// javob berishi kerak — qamrov sahifa emas, SHAXS bo'yicha kesiladi.
// `/api/notifications` dagi "kassa egalarida o'chiq" qoidasi bu yerga
// TAALLUQLI EMAS: u qo'ng'iroq lentasi haqida edi, shaxsan berilgan
// topshiriq esa kassirga ham tegishli.
//
// HECH NARSA YOZMAYDI (GET). Oyna ochilgani "ko'rdim" degani emas —
// xodim javob bermaguncha topshiriq ro'yxatda turadi.

/** Bir so'rovda ko'pi bilan shuncha qator — oyna ro'yxat, arxiv emas. */
const LIMIT = 50;

function toInbox(r: Record<string, unknown>): InboxTask {
  const rep = parseTaskReport(r.report);
  const author = r.createdBy && typeof r.createdBy === "object" ? (r.createdBy as Record<string, unknown>) : null;
  return {
    id: Number(r.id),
    student: String(r.student ?? "").trim(),
    group: String(r.group ?? "").trim(),
    targetKind: isTaskTargetKind(r.targetKind) ? r.targetKind : null,
    type: String(r.type ?? "").trim(),
    description: String(r.description ?? "").trim(),
    priority: isTaskPriority(r.priority) ? r.priority : "orta",
    date: String(r.date ?? ""),
    // Yaroqsiz sana — `null`, xato emas: bitta buzuq yozuv butun oynani
    // har 60 soniyada 500 qilib turmasin (lib/uzTime.ts, uzParseStamp).
    dueMs: uzParseStamp(r.date),
    staff: String(r.staff ?? "").trim(),
    createdAt: typeof r.createdAt === "string" ? r.createdAt : null,
    createdByName: String(author?.name ?? "").trim(),
    report: rep ?? null,
  };
}

const PROJECTION = {
  _id: 0, id: 1, student: 1, group: 1, targetKind: 1, type: 1, description: 1,
  priority: 1, date: 1, staff: 1, createdAt: 1, createdBy: 1, report: 1,
};

// GET /api/tasks/inbox — qobiq mount bo'lganda va har 60 soniyada.
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  const col = db.collection("tasks");

  const [pendingRows, reportRows] = await Promise.all([
    // Xodim yozuviga bog'lanmagan hisob (hrEmployeeId yo'q) hech kimning
    // mas'uli bo'la olmaydi — so'ralmaydi ham.
    me.hrEmployeeId === null
      ? Promise.resolve([])
      : col
          .find(
            { staffId: me.hrEmployeeId, state: { $in: OPEN_TASK_STATES }, report: { $exists: false } },
            { projection: PROJECTION },
          )
          .sort({ date: 1 })
          .limit(LIMIT)
          .toArray(),
    col
      .find(
        { "createdBy.userId": me.id, report: { $exists: true }, "report.seenAt": { $exists: false } },
        { projection: PROJECTION },
      )
      .sort({ "report.at": -1 })
      .limit(LIMIT)
      .toArray(),
  ]);

  const payload: InboxPayload = {
    serverNow: new Date().toISOString(),
    // Eski cookie'da `sid` bo'lmasligi mumkin — hisob id'si ham sessiya
    // davomida o'zgarmaydi, faqat qayta login'ni ajratmaydi.
    sessionKey: me.sid ?? me.id,
    pending: pendingRows.map((r) => toInbox(r as Record<string, unknown>)),
    reports: reportRows.map((r) => toInbox(r as Record<string, unknown>)),
  };
  return NextResponse.json({ ok: true, ...payload });
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = await req.json();
    return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// POST /api/tasks/inbox — mas'ul xodimning javobi: { id, outcome, comment }.
//
// Izoh MAJBURIY (oyna ham izohsiz tugmani yoqmaydi): rahbar "nima bo'ldi"
// ni o'qishi kerak, shunchaki belgi yetarli emas. Holat javobga qarab:
//   bajarildi   → "bajarilgan" (kanbanning Tugallangan ustuni)
//   bajarilmadi → "kutilmoqda" (rahbar qaror qiladi: qayta beradi yoki yopadi)
//
// FAQAT O'Z TOPSHIRIG'IGA: `staffId` mos kelmasa 404 — boshqa odamning
// topshirig'ini "bajarildi" deb yopib bo'lmaydi. Allaqachon javob berilgan
// topshiriqqa ikkinchi javob ham 404: birinchi hisobot o'zgarmaydi.
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  if (me.hrEmployeeId === null) {
    return NextResponse.json({ ok: false, error: "Hisobingiz xodim yozuviga bog'lanmagan" }, { status: 403 });
  }

  const body = await readBody(req);
  if (!body) return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });

  const id = Number(body.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  if (!isTaskOutcome(body.outcome)) {
    return NextResponse.json({ ok: false, error: "Javob noto'g'ri" }, { status: 400 });
  }
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  if (!comment) return NextResponse.json({ ok: false, error: "Izoh yozilmagan" }, { status: 400 });
  if (comment.length > REPORT_COMMENT_MAX) {
    return NextResponse.json({ ok: false, error: `Izoh ${REPORT_COMMENT_MAX} belgidan oshmasin` }, { status: 400 });
  }

  const db = await ensureIndexes();
  const report: TaskReport = {
    outcome: body.outcome,
    comment,
    at: new Date().toISOString(),
    byName: (await employeeNameById(db, me.hrEmployeeId)) || String(me.fullName ?? "").trim(),
  };
  // Shart va yozuv BITTA amalda: ikki tab bir vaqtda bossa ham faqat
  // bittasi o'tadi (ikkinchisi `report` allaqachon borligini ko'radi).
  const res = await db.collection("tasks").findOneAndUpdate(
    { id, staffId: me.hrEmployeeId, report: { $exists: false } },
    { $set: { report, state: body.outcome === "bajarildi" ? "bajarilgan" : "kutilmoqda" } },
    { returnDocument: "after", projection: PROJECTION },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Topshiriq topilmadi yoki allaqachon javob berilgan" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, task: toInbox(res as Record<string, unknown>) });
}

// PATCH /api/tasks/inbox — rahbar hisobotni ko'rdi: { seen: [id, ...] }.
//
// Faqat O'ZI BERGAN topshiriqlarniki belgilanadi (`createdBy.userId`).
// Belgilangan hisobot oynadan ketadi, lekin topshiriq hujjatida qoladi —
// /tasks sahifasida karta va tahrirlash oynasi uni ko'rsataveradi.
export async function PATCH(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const body = await readBody(req);
  const seen = Array.isArray(body?.seen) ? body!.seen.map(Number).filter(Number.isFinite) : [];
  if (seen.length === 0 || seen.length > LIMIT) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const r = await db.collection("tasks").updateMany(
    { id: { $in: seen }, "createdBy.userId": me.id, report: { $exists: true }, "report.seenAt": { $exists: false } },
    { $set: { "report.seenAt": new Date().toISOString() } },
  );
  return NextResponse.json({ ok: true, seen: r.modifiedCount });
}
