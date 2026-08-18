import crypto from "crypto";

// Cloudinary'ga rasm yuklash. `cloudinary` npm paketi ATAYIN qo'shilmadi —
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

/**
 * Faylni Cloudinary'ga yuklaydi va `secure_url` ni qaytaradi.
 * `folder` — Cloudinary ichidagi papka (masalan "xodimlar").
 */
export async function uploadImage(file: File, folder: string): Promise<UploadResult> {
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

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`, {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    if (!res.ok || !data.secure_url) {
      // Cloudinary xatosi odatda { error: { message } } ko'rinishida keladi.
      return { ok: false, error: data?.error?.message || "Rasm yuklanmadi" };
    }
    return { ok: true, url: data.secure_url as string, publicId: data.public_id as string };
  } catch {
    return { ok: false, error: "Cloudinary'ga ulanib bo'lmadi" };
  }
}
