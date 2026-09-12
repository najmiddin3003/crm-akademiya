// /api/health/* uchun umumiy narsalar (tezlik poygasi — /tezlik).
//
// CORS "*" ATAYLAB: poyga sahifasi www.tizimli24.uz da turadi, lekin eski
// serverni ham (crm-akademiya-777777.vercel.app — bir xil kod) shu
// endpointlar orqali o'lchaydi. Javobda faqat vaqt va server nomi bor,
// ma'lumot yo'q — ochiq bo'lishi xavfsiz.

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
