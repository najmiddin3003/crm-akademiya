import crypto from "crypto";

// Cloudinary'ga rasm/video yuklash. `cloudinary` npm paketi ATAYIN qo'shilmadi —
// imzolangan yuklash oddiy REST so'rovi, `fetch` va `crypto` yetarli
// (loyihada `lib/invite.ts`, `lib/crypto.ts` ham shu yondashuvda).
//
// Kerakli muhit o'zgaruvchilari (.env.local):
//   CLOUDINARY_CLOUD_NAME
//   CLOUDINARY_API_KEY
//   CLOUDINARY_API_SECRET
//
// Imzo qoidasi (Cloudinary hujjati): `file`, `api_key`, `resource_type` va
// `cloud_name` DAN TASHQARI barcha parametrlar alifbo tartibida
// `kalit=qiymat&...` ko'rinishida ulanadi, oxiriga API secret qo'shiladi va
// SHA-1 olinadi.

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/** Sozlamalar to'liq bo'lsa qaytaradi, aks holda `null`. */
export function cloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

function sign(params: Record<string, string>, apiSecret: string): string {
  const base = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto.createHash("sha1").update(base + apiSecret).digest("hex");
}

export interface UploadResult {
  ok: boolean;
  url?: string;
  publicId?: string;
  error?: string;
}

// Papka mijozdan olinadi, lekin oq ro'yxat orqali — aks holda uni
// o'zgartirib boshqa joyga yozib yuborish mumkin bo'lardi.
const UPLOAD_FOLDERS: readonly string[] = ["xodimlar", "kurslar"];

/** Ommaviy ish arizasi (/ariza) fayllari — rasm, CV, sertifikat nusxalari. */
export const CV_UPLOAD_FOLDER = "nomzodlar";

/** Ruxsat etilgan papka nomini qaytaradi, notanishi uchun — "boshqa". */
export function safeFolder(v: unknown): string {
  return typeof v === "string" && UPLOAD_FOLDERS.includes(v) ? v : "boshqa";
}

/**
 * Cloudinary `resource_type` — URL yo'lida ham shu so'z ishlatiladi.
 * "auto" — Cloudinary turini o'zi aniqlaydi: PDF/rasm → image, DOCX → raw.
 * Nomzodning CV va diplom nusxalari shu bilan yuklanadi (tur aralash).
 */
type ResourceKind = "image" | "video" | "auto";

/**
 * Faylni Cloudinary'ga yuklaydi va `secure_url` ni qaytaradi.
 * `folder` — Cloudinary ichidagi papka (masalan "xodimlar").
 * `kind` — "image" yoki "video"; imzoga kirmaydi (Cloudinary hujjati:
 * `resource_type` imzolanadigan parametrlar ro'yxatida yo'q), faqat
 * so'rov manzilini belgilaydi.
 */
async function upload(file: File, folder: string, kind: ResourceKind): Promise<UploadResult> {
  const cfg = cloudinaryConfig();
  if (!cfg) {
    return { ok: false, error: "Cloudinary sozlanmagan (.env.local dagi CLOUDINARY_* kalitlarini to'ldiring)" };
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const signed: Record<string, string> = { folder, timestamp };

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", cfg.apiKey);
  for (const [k, v] of Object.entries(signed)) form.append(k, v);
  form.append("signature", sign(signed, cfg.apiSecret));

  const failed = kind === "video" ? "Video yuklanmadi" : kind === "auto" ? "Fayl yuklanmadi" : "Rasm yuklanmadi";
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/${kind}/upload`, {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    if (!res.ok || !data.secure_url) {
      // Cloudinary xatosi odatda { error: { message } } ko'rinishida keladi.
      return { ok: false, error: data?.error?.message || failed };
    }
    return { ok: true, url: data.secure_url as string, publicId: data.public_id as string };
  } catch {
    return { ok: false, error: "Cloudinary'ga ulanib bo'lmadi" };
  }
}

export function uploadImage(file: File, folder: string): Promise<UploadResult> {
  return upload(file, folder, "image");
}

export function uploadVideo(file: File, folder: string): Promise<UploadResult> {
  return upload(file, folder, "video");
}

/** PDF, DOC(X) yoki rasm — turi noma'lum hujjat (nomzod fayllari). */
export function uploadDocument(file: File, folder: string): Promise<UploadResult> {
  return upload(file, folder, "auto");
}
