import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { loadPupil } from "@/lib/studentBot/data";
import { authStudentWeb } from "@/lib/studentBot/webapp";
import { pupilFullName } from "@/lib/pupilsData";
import { acceptOferta, myContracts, myFeedback, ofertaState, sendFeedback } from "@/lib/studentCabinetExtras";
import { askReferralGift, joinReferral, myReferral } from "@/lib/studentReferral";
import { setActivePupil } from "@/lib/studentBot/users";
import { coursesForPupil, markLesson, supportCancel, supportEnroll, supportForPupil } from "@/lib/studentLearning";

// O'quvchi kabineti — 42-qism (lib/studentCabinetExtras.ts). Kim ekani — Telegram `initData` imzosi (me bilan bir xil).
//   POST { initData, action: "oferta" | "accept-oferta" (ids) | "feedback" | "send-feedback" (type, about, izoh, hideName) | "contracts" }
//   43-qism (lib/studentLearning.ts): "support" | "support-enroll" (id) | "support-cancel" (id) | "courses" | "lesson-done" (courseId, lessonId)
//   44-qism: "switch-kid" (pupilId — faqat shu Telegram akkauntiga bog'langan farzand) | "referral" | "referral-join" | "referral-gift" (giftId)
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ ok: false, error: "So'rov o'qilmadi" }, { status: 400 });
  const db = await ensureIndexes();
  const auth = await authStudentWeb(db, typeof b.initData === "string" ? b.initData : "");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const { user } = auth;
  // Farzand almashtirish — joriy o'quvchini yuklashdan OLDIN (bog'lanmagan id rad etiladi).
  if (b.action === "switch-kid") {
    const id = Number(b.pupilId);
    if (!user.links.some((l) => l.pupilId === id)) return NextResponse.json({ ok: false, error: "Bu o'quvchi sizga bog'lanmagan" }, { status: 403 });
    await setActivePupil(db, user.chatId, id);
    return NextResponse.json({ ok: true });
  }
  const pupil = await loadPupil(db, user.activePupilId);
  if (!pupil) return NextResponse.json({ ok: false, error: "O'quvchi topilmadi" }, { status: 404 });
  const role = user.links.find((l) => l.pupilId === pupil.id)?.role === "parent" ? ("parent" as const) : ("student" as const);

  switch (b.action) {
    case "oferta":
      return NextResponse.json({ ok: true, ...(await ofertaState(db, user.chatId)) });
    case "accept-oferta": {
      const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is string => typeof x === "string").slice(0, 50) : [];
      const r = await acceptOferta(db, user.chatId, pupil.id, ids);
      return NextResponse.json(r.ok ? { ok: true, ...(await ofertaState(db, user.chatId)) } : r, { status: r.ok ? 200 : 400 });
    }
    case "feedback":
      return NextResponse.json({ ok: true, items: await myFeedback(db, pupil.id) });
    case "send-feedback": {
      const branch = await db.collection("branches").findOne({ id: Number((pupil as { branchId?: number }).branchId) }, { projection: { _id: 0, name: 1 } });
      const r = await sendFeedback(db, { pupilId: pupil.id, pupilName: pupilFullName(pupil), branch: String(branch?.name ?? ""), role, tgName: user.tgName, phone: user.phone }, b);
      return NextResponse.json(r.ok ? { ok: true, items: await myFeedback(db, pupil.id) } : r, { status: r.ok ? 200 : 400 });
    }
    case "support":
      return NextResponse.json({ ok: true, ...(await supportForPupil(db, pupil as { id: number; branchId?: number })) });
    case "support-enroll":
    case "support-cancel": {
      const p = { id: pupil.id, branchId: (pupil as { branchId?: number }).branchId, name: pupilFullName(pupil) };
      const r = b.action === "support-enroll" ? await supportEnroll(db, p, Number(b.id)) : await supportCancel(db, p, Number(b.id));
      return NextResponse.json(r.ok ? { ...r, ...(await supportForPupil(db, p)) } : r, { status: r.ok ? 200 : 400 });
    }
    case "courses":
      return NextResponse.json({ ok: true, items: await coursesForPupil(db, pupil.id) });
    case "lesson-done": {
      const r = await markLesson(db, pupil.id, Number(b.courseId), String(b.lessonId ?? ""));
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case "referral":
      return NextResponse.json({ ok: true, ...(await myReferral(db, pupil.id, role)) });
    case "referral-join":
    case "referral-gift": {
      const r = b.action === "referral-join" ? await joinReferral(db, pupil as { id: number; branchId?: number }, role) : await askReferralGift(db, pupil.id, Number(b.giftId));
      return NextResponse.json(r.ok ? { ok: true, ...(await myReferral(db, pupil.id, role)) } : r, { status: r.ok ? 200 : 400 });
    }
    case "contracts":
      return NextResponse.json({ ok: true, items: await myContracts(db, pupil.id) });
    default:
      return NextResponse.json({ ok: false, error: "Noma'lum amal" }, { status: 400 });
  }
}
