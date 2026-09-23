import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureIndexes } from "@/lib/mongodb";
import { parseCloudinaryUrl, privateDownloadUrl } from "@/lib/cloudinary";
import { TASKS_COL, canSee, loadViewer, type StaffTaskDoc } from "@/lib/staffTasksServer";
import type { StaffTaskFile } from "@/lib/staffTasks";

// GET /api/staff-tasks/:id/file?k=att&i=0 — rahbar biriktirgan fayl
// GET /api/staff-tasks/:id/file?k=res     — xodimning natija fayli
//
// Fayl SERVER orqali oqadi (app/api/management-cv/[id]/file bilan bir xil
// usul): PDF Cloudinary'ning ochiq havolasidan berilmaydi, qolaversa fayl
// faqat topshiriqni KO'RA OLADIGAN odamga ochiladi.
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };
const bad = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

export async function GET(req: Request, ctx: Ctx) {
  const me = await getCurrentUser();
  if (!me) return bad("Tizimga kirmagansiz", 401);
  const { id } = await ctx.params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) return bad("Noto'g'ri id", 400);

  const db = await ensureIndexes();
  const v = await loadViewer(db, me);
  const doc = await db.collection<StaffTaskDoc>(TASKS_COL).findOne({ id: taskId }, { projection: { _id: 0 } });
  if (!doc || !canSee(v, doc)) return bad("Topshiriq topilmadi", 404);

  const url = new URL(req.url);
  const kind = url.searchParams.get("k");
  const index = Number(url.searchParams.get("i") ?? "0");
  let file: StaffTaskFile | null = null;
  if (kind === "res") file = doc.resultFile ?? null;
  else if (kind === "att" && Number.isInteger(index)) file = (doc.attachments ?? [])[index] ?? null;
  if (!file) return bad("Fayl topilmadi", 404);

  const ref = parseCloudinaryUrl(file.url);
  const download = ref ? privateDownloadUrl(ref) : null;
  if (!download) return bad("Fayl manzili noma'lum", 502);
  const upstream = await fetch(download);
  if (!upstream.ok || !upstream.body) return bad("Faylni olib bo'lmadi", 502);

  const type = file.type || upstream.headers.get("content-type") || "application/octet-stream";
  const safeName = encodeURIComponent(file.name.replace(/["\r\n]/g, "")).replace(/'/g, "%27");
  const len = upstream.headers.get("content-length");
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Content-Disposition": `inline; filename*=UTF-8''${safeName}`,
      "Cache-Control": "private, max-age=300",
      ...(len ? { "Content-Length": len } : {}),
    },
  });
}
