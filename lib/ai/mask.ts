// SHAXSIY MA'LUMOTNI YASHIRISH — modelga (tashqi xizmatga) ketadigan
// natijalar uchun.
//
// Telefon raqami to'liq ketmaydi: operator kodi va oxirgi ikki raqam
// qoladi ("94 155 88 55" → "94 *** ** 55"). Xodim ismdosh o'quvchilarni
// shu bilan ajrata oladi, raqamning o'zi esa CRM sahifasida ko'rinadi
// (javobdagi havola). Bu fayl hech narsa import qilmaydi — sinov skripti
// uni bazasiz tekshiradi.

export function maskPhone(raw: unknown): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  // Xalqaro shakl ("+998 94 …") — mahalliy 9 raqamga keltiriladi.
  if (d.length === 12 && d.startsWith("998")) d = d.slice(3);
  if (d.length < 5) return "***";
  return `${d.slice(0, 2)} *** ** ${d.slice(-2)}`;
}
