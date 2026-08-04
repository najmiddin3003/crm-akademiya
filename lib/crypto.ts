import crypto from "crypto";

// Adminning xodim paroliga "qarab qo'yish" imkoniyati uchun qaytarib
// bo'ladigan (reversible) shifrlash. DIQQAT: bcrypt hash (lib/invite.ts)
// login tekshiruvi uchun asosiy bo'lib qoladi — bu faqat admin panelida
// ko'rsatish uchun qo'shimcha, kamroq xavfsiz nusxa.
const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    console.warn("[crypto] ENCRYPTION_KEY .env.local da o'rnatilmagan — vaqtinchalik standart kalit ishlatilmoqda");
  }
  return crypto.createHash("sha256").update(raw || "dev-insecure-encryption-key-change-me").digest();
}

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), enc.toString("base64"), tag.toString("base64")].join(".");
}

export function decryptSecret(payload: string): string | null {
  try {
    const [ivB64, encB64, tagB64] = payload.split(".");
    const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([decipher.update(Buffer.from(encB64, "base64")), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}
