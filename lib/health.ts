// /api/health/* uchun umumiy narsalar (tezlik sinovi — /tezlik).
//
// CORS "*" ATAYLAB: sinov sahifasi localhost'dan (dev) ochilganda ham
// prod serverni (www.tizimli24.uz) o'lchaydi — boshqa origin
// (components/tezlik/TapTest.tsx). Javobda faqat vaqt va server nomi bor,
// ma'lumot yo'q — ochiq bo'lishi xavfsiz. (15.09.2026 gacha eski Vercel
// nusxasi ham shu yo'l bilan o'lchanardi.)

/** Javob qaysi infratuzilmadan kelgani — sahifadagi yorliq uchun. */
export function healthNode(): { kind: "vercel" | "vps"; region: string } {
  return process.env.VERCEL
    ? { kind: "vercel", region: process.env.VERCEL_REGION || "sin1" }
    : { kind: "vps", region: "Toshkent" };
}

export function healthHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "no-store",
  };
}
