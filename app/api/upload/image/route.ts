import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { uploadImage } from "@/lib/cloudinary";

// POST /api/upload/image — rasmni Cloudinary'ga yuklaydi va URL qaytaradi.
//
// `crypto` ishlatilgani uchun Node ish muhiti kerak (Edge'da emas).
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

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
    return NextResponse.json({ ok: false, error: "Faqat PNG, JPG yoki WEBP" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Rasm hajmi 5 MB dan oshmasin" }, { status: 400 });
  }

  // Papka mijozdan olinmaydi — aks holda uni o'zgartirib boshqa joyga
  // yozib yuborish mumkin bo'lardi.
  const folderParam = form.get("folder");
  const folder = folderParam === "xodimlar" ? "xodimlar" : "boshqa";

  const res = await uploadImage(file, folder);
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, url: res.url, publicId: res.publicId });
}
