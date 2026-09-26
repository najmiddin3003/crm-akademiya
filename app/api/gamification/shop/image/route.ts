import { NextResponse } from "next/server";
import { uploadImage } from "@/lib/cloudinary";
import { fail, handleError, withActor } from "@/lib/gamification/http";

// POST /api/gamification/shop/image — sovg'a rasmi (TZ 4.13.1: JPG/PNG, 5 MB
// gacha) — faqat direktor. Rasm mijozda uzun tomoni 480 px gacha
// kichraytirib yuboriladi (TZ tavsiyasi).
//
// ALOHIDA ROUTE: umumiy /api/upload/image ning ruxsat doirasi boshqa
// sahifalarga bog'langan; gamifikatsiya sahifasi uni chaqirsa, generator
// uni hammaga ochib qo'yardi (scripts/gen-api-permissions.mjs).

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

export async function POST(req: Request) {
  try {
    const ctx = await withActor({ director: true });
    if (ctx instanceof NextResponse) return ctx;
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return fail(400, "Noto'g'ri so'rov");
    }
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return fail(400, "Fayl tanlanmagan");
    if (!ALLOWED.includes(file.type)) return fail(400, "Faqat PNG, JPG yoki WEBP");
    if (file.size > MAX_BYTES) return fail(400, "Rasm hajmi 5 MB dan oshmasin");
    const res = await uploadImage(file, "sovgalar");
    if (!res.ok) return fail(502, res.error || "Rasmni yuklab bo'lmadi");
    return NextResponse.json({ ok: true, url: res.url });
  } catch (e) {
    return handleError(e);
  }
}
