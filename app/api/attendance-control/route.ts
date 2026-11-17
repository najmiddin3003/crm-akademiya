import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { currentAuthorName } from "@/lib/currentEmployee";
import { attendanceOverview, attendanceRecords, penalizeTeacher, remindTeacher } from "@/lib/attendanceControl";
import type { AcStatus } from "@/lib/attendanceControlTypes";
import { uzDateIso } from "@/lib/uzTime";

// Nazorat → Davomat nazorati (yangi versiya, 34-qism). Mantiq — lib/attendanceControl.ts.
//   GET  ?from&to&branchId              — Bugun, Belgilanmagan va kechikib belgilangan darslar;
//   GET  ?part=records&…                — Yozuvlar (filtrlar, kunlar grafigi, sabablar);
//   POST {action: "remind", groupId, date}               — o'qituvchiga eslatma (xodimlar boti);
//   POST {action: "penalty", groupId, date, amount, note} — o'qituvchiga jarima (faqat admin).
// Filial — navbardagi ruxsat etilganlar (`branchId=all` yoki bitta).

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: AcStatus[] = ["keldi", "kechikdi", "birinchi", "sababli", "sababsiz"];

function monthStart(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}

export async function GET(req: Request) {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const today = uzDateIso();
  const from = ISO.test(sp.get("from") ?? "") ? sp.get("from")! : monthStart(today);
  const to = ISO.test(sp.get("to") ?? "") ? sp.get("to")! : today;
  if (from > to) return NextResponse.json({ ok: false, error: "Sana oralig'i noto'g'ri" }, { status: 400 });
  const b = Number(sp.get("branchId"));
  const branchIds = Number.isFinite(b) && scope.allowed.includes(b) ? [b] : scope.allowed;
  const db = await ensureIndexes();

  if (sp.get("part") === "records") {
    const st = (sp.get("statuses") ?? "kechikdi,birinchi,sababli,sababsiz").split(",").filter((x): x is AcStatus => STATUSES.includes(x as AcStatus));
    const gid = Number(sp.get("groupId"));
    const out = await attendanceRecords(db, {
      branchIds,
      from,
      to,
      statuses: st,
      q: sp.get("q") ?? "",
      groupId: Number.isFinite(gid) && gid > 0 ? gid : null,
      teacher: sp.get("teacher") ?? "",
      marker: sp.get("marker") ?? "",
      reason: sp.get("reason") ?? "",
      activeOnly: sp.get("active") !== "0",
      mostAbsent: sp.get("sort") === "absent",
      page: Math.max(1, Number(sp.get("page")) || 1),
      size: Math.min(100, Math.max(5, Number(sp.get("size")) || 10)),
    });
    return NextResponse.json(out);
  }
  return NextResponse.json(await attendanceOverview(db, { branchIds, from, to, isAdmin: scope.isAdmin }));
}

export async function POST(req: Request) {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const groupId = Number(body.groupId);
  const date = String(body.date ?? "");
  if (!Number.isFinite(groupId) || !ISO.test(date)) return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  const db = await ensureIndexes();
  const by = await currentAuthorName();
  if (body.action === "remind") {
    const res = await remindTeacher(db, { groupId, date, by, branchIds: scope.allowed });
    return NextResponse.json(res, { status: res.ok ? 200 : res.status });
  }
  if (body.action === "penalty") {
    if (!scope.isAdmin) return NextResponse.json({ ok: false, error: "Jarimani faqat direktor yozadi" }, { status: 403 });
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ ok: false, error: "Qiymatni to'g'ri kiriting" }, { status: 400 });
    const res = await penalizeTeacher(db, { groupId, date, amount, note: String(body.note ?? ""), by, branchIds: scope.allowed });
    return NextResponse.json(res, { status: res.ok ? 200 : res.status });
  }
  return NextResponse.json({ ok: false, error: "Noma'lum amal" }, { status: 400 });
}
