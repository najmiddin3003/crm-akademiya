import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { safeFolder, uploadVideo } from "@/lib/cloudinary";

// POST /api/upload/video — videoni Cloudinary'ga yuklaydi va URL qaytaradi.
// Rasm endpointi (../image/route.ts) bilan bir xil qolip; farqi — MIME
// ro'yxati, hajm chegarasi va Cloudinary'dagi `video/upload` yo'li.
//
// Onlayn kurs g'ilofchisidagi "Reklama video" uchun qo'shildi.

export const runtime = "nodejs";

// 50 MB — reklama roligi uchun yetarli, ayni paytda so'rov tanasi butunlay
// xotiraga o'qilgani uchun bundan kattasi serverni bo'g'ib qo'yadi.
const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED = ["video/mp4", "video/webm", "video/quicktime"];

export async function POST(req: Request) {
  // Middleware `/api/` ni tekshirmaydi, shuning uchun sessiyani shu yerda
  // o'zimiz tekshiramiz — aks holda yuklash endpointi hammaga ochiq bo'lardi.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Avtorizatsiya talab qilinadi" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "Fayl tanlanmagan" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ ok: false, error: "Faqat MP4, WEBM yoki MOV" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Video hajmi 50 MB dan oshmasin" }, { status: 400 });
  }

  const res = await uploadVideo(file, safeFolder(form.get("folder")));
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, url: res.url, publicId: res.publicId });
}
