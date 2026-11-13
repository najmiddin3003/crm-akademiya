import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import {
  BRANCH_TOPIC_FIELDS,
  parseGeoRadius,
  parseLateGrace,
  parseLeadTopicId,
  parseOpenHours,
  parseWorkDays,
  parseWorkStart,
  type ManagementBranch,
} from "@/lib/managementBranches";
import { parseGeoInput } from "@/lib/geo";
import { getCurrentUser } from "@/lib/auth";
import { branchInCondition } from "@/lib/branchScope";

// PATCH /api/branches/:id — filialni tahrirlaydi.
//
// `leadTopicId` / `paymentTopicId` / `attendanceTopicId` — filial lidlari,
// to'lovlari va kechikishlari tushadigan Telegram topiklari
// (lib/leadNotify.ts, lib/sync/dispatch.ts, lib/attendanceNotify.ts).
// `workStart` / `lateGraceMin` — «Ishga keldim» (QR) kechikish chegarasi.
// Bo'sh/null kelsa maydon OLIB TASHLANADI ($unset): `null` qoldirilsa ham
// ishlaydi, lekin hujjatda "topik yo'q" degan ma'noda ikki xil ko'rinish
// (maydon yo'q / null) yurmasin.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const branchId = Number(id);
  if (!Number.isFinite(branchId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<ManagementBranch>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const set: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ ok: false, error: "Filial nomini kiriting" }, { status: 400 });
    set.name = name;
  }
  if (typeof body.location === "string") set.location = body.location.trim();
  if (typeof body.address === "string") set.address = body.address.trim();
  if (typeof body.phone === "string") set.phone = body.phone.trim();
  const unset: Record<string, 1> = {};
  for (const field of BRANCH_TOPIC_FIELDS) {
    if (!(field in body)) continue;
    const topic = parseLeadTopicId(body[field]);
    if (!topic.ok) return NextResponse.json({ ok: false, error: topic.error }, { status: 400 });
    if (topic.value === null) unset[field] = 1;
    else set[field] = topic.value;
  }
  if ("workStart" in body) {
    const w = parseWorkStart(body.workStart);
    if (!w.ok) return NextResponse.json({ ok: false, error: w.error }, { status: 400 });
    if (w.value === null) unset.workStart = 1;
    else set.workStart = w.value;
  }
  if ("lateGraceMin" in body) {
    const g = parseLateGrace(body.lateGraceMin);
    if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: 400 });
    if (g.value === null) unset.lateGraceMin = 1;
    else set.lateGraceMin = g.value;
  }
  // Filial joylashuvi — formadan satr ("41.06891, 71.82361" yoki xarita havolasi).
  if ("geo" in body) {
    const geo = parseGeoInput(body.geo);
    if (!geo.ok) return NextResponse.json({ ok: false, error: geo.error }, { status: 400 });
    if (geo.value === null) unset.geo = 1;
    else set.geo = geo.value;
  }
  if ("geoRadiusM" in body) {
    const r = parseGeoRadius(body.geoRadiusM);
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 400 });
    if (r.value === null) unset.geoRadiusM = 1;
    else set.geoRadiusM = r.value;
  }
  // Filialning ish vaqti va kunlari (23-qism) — ikkala vaqt birga keladi.
  if ("openFrom" in body || "openTo" in body) {
    const h = parseOpenHours(body.openFrom, body.openTo);
    if (!h.ok) return NextResponse.json({ ok: false, error: h.error }, { status: 400 });
    if (h.value.openFrom === null) {
      unset.openFrom = 1;
      unset.openTo = 1;
    } else {
      set.openFrom = h.value.openFrom;
      set.openTo = h.value.openTo;
    }
  }
  if ("workDays" in body) {
    const d = parseWorkDays(body.workDays);
    if (!d.ok) return NextResponse.json({ ok: false, error: d.error }, { status: 400 });
    if (d.value === null) unset.workDays = 1;
    else set.workDays = d.value;
  }
  if (Object.keys(set).length === 0 && Object.keys(unset).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("branches").findOneAndUpdate(
    { id: branchId },
    {
      ...(Object.keys(set).length ? { $set: set } : {}),
      ...(Object.keys(unset).length ? { $unset: unset } : {}),
    },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Filial topilmadi" }, { status: 404 });
  }
  const { _id, ...branch } = res;
  return NextResponse.json({ ok: true, branch: branch as unknown as ManagementBranch });
}

// DELETE /api/branches/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const branchId = Number(id);
  if (!Number.isFinite(branchId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  // FAQAT ADMIN va FAQAT BO'SH FILIAL (23-qism, 13.11.2026). Ilgari hech qanday
  // to'siq yo'q edi: ma'lumoti bor filial o'chsa guruh, o'quvchi, kassa va
  // xodimlar mavjud bo'lmagan filialga bog'lanib qolardi. Endi faqat xato
  // qo'shilgan (hech narsa biriktirilmagan) filial o'chiriladi.
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Avtorizatsiya kerak" }, { status: 401 });
  if (me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Filialni faqat administrator o'chira oladi" }, { status: 403 });
  }
  const db = await ensureIndexes();
  const inBranch = branchInCondition([branchId]);
  const used = await Promise.all([
    ...["groups", "rooms", "pupils", "cashboxes", "orders"].map((c) => db.collection(c).countDocuments(inBranch, { limit: 1 })),
    db.collection("hr_employees").countDocuments({ branchIds: branchId }, { limit: 1 }),
  ]);
  if (used.some((n) => n > 0)) {
    return NextResponse.json(
      { ok: false, error: "Filialda guruh, xona, o'quvchi, kassa, lid yoki xodim bor — o'chirib bo'lmaydi" },
      { status: 409 },
    );
  }
  const res = await db.collection("branches").deleteOne({ id: branchId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Filial topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
