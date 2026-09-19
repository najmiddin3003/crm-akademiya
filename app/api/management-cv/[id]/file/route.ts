import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { parseCloudinaryUrl, privateDownloadUrl } from "@/lib/cloudinary";
import type { CvApplication, CvFile } from "@/lib/managementCv";

// GET /api/management-cv/:id/file?kind=cv            — nomzodning CV fayli
// GET /api/management-cv/:id/file?kind=doc&i=0       — sertifikat/diplom nusxasi
//
// Nomzod hujjatlari Cloudinary'da; PDF'ni ochiq havoladan bermaydi (bepul
// tarif cheklovi — lib/cloudinary.ts izohi). Shu bois fayl SERVER orqali
// oqiziladi: imzolangan API download havolasidan olib, o'z sarlavhalari
// bilan qaytariladi — brauzer PDF'ni modal ichida (iframe) ochadi.
// Faqat tizimga kirgan xodimga: nomzodning shaxsiy hujjatlari ochiq
// bo'lmasligi kerak (proxy.ts ham route'ni sessiya bilan to'sadi).
export const runtime = "nodejs";

const bad = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return bad("Avtorizatsiya talab qilinadi", 401);
  const { id } = await params;
  const cvId = Number(id);
  if (!Number.isFinite(cvId)) return bad("Noto'g'ri id", 400);

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const index = Number(url.searchParams.get("i") ?? "0");

  const db = await ensureIndexes();
  const row = (await db.collection("cv_applications").findOne({ id: cvId })) as unknown as CvApplication | null;
  if (!row) return bad("Ariza topilmadi", 404);

  let file: CvFile | null = null;
  if (kind === "cv") file = row.cvFile ?? null;
  else if (kind === "doc") file = Number.isInteger(index) ? (row.docs ?? [])[index] ?? null : null;
  if (!file) return bad("Fayl topilmadi", 404);

  const ref = parseCloudinaryUrl(file.url);
  const download = ref ? privateDownloadUrl(ref) : null;
  if (!download) return bad("Fayl manzili noma'lum", 502);

  const upstream = await fetch(download);
  if (!upstream.ok || !upstream.body) return bad("Faylni olib bo'lmadi", 502);

  // Turi bazadagi yozuvdan (Cloudinary `download` ba'zan umumiy tur beradi);
  // `inline` — brauzer PDF/rasmni ochadi, DOCX'ni o'zi yuklab oladi.
  const type = file.type || upstream.headers.get("content-type") || "application/octet-stream";
  const safeName = encodeURIComponent(file.name.replace(/["\r\n]/g, "")).replace(/'/g, "%27");
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Content-Disposition": `inline; filename*=UTF-8''${safeName}`,
      "Cache-Control": "private, max-age=300",
      ...(upstream.headers.get("content-length") ? { "Content-Length": upstream.headers.get("content-length") as string } : {}),
    },
  });
}
