import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { uploadDocument } from "@/lib/cloudinary";
import { TASK_FILES_FOLDER } from "@/lib/staffTasksServer";

// POST /api/staff-tasks/upload — topshiriq biriktirmasi yoki xodimning
// natija fayli (rasm yoki PDF, 10 MB gacha) → Cloudinary `topshiriqlar/`.
//
// Har kirgan xodimga ochiq: natija faylini oddiy xodim ham yuklaydi.
// Qaytgan manzil keyin topshiriq bilan birga yuboriladi va server uni
// faqat shu papkadan bo'lsa qabul qiladi (lib/staffTasksServer.ts →
// cleanFile). Fayl ko'rsatilganda ham server orqali oqadi — PDF ochiq
// havoladan berilmaydi (lib/cloudinary.ts izohi).
export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

export async function POST(req: Request) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
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
    return NextResponse.json({ ok: false, error: "Faqat rasm (PNG, JPG, WEBP) yoki PDF" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Fayl hajmi 10 MB dan oshmasin" }, { status: 400 });
  }
  const res = await uploadDocument(file, TASK_FILES_FOLDER);
  if (!res.ok || !res.url) {
    return NextResponse.json({ ok: false, error: res.error || "Fayl yuklanmadi" }, { status: 502 });
  }
  return NextResponse.json({
    ok: true,
    file: { name: file.name.slice(0, 200) || "fayl", url: res.url, type: file.type, size: file.size },
  });
}
