// LID HOLATI — yangi Lidlar sahifasining voronkasi (23.09.2026, foydalanuvchi
// prototipi «lidlar-tayyorlangan-ohiri»):
//
//   Yangi → Bog'lanildi → Sinov darsiga yozildi → Guruhga qo'shildi
//                                  ↘ Rad etdi (istalgan bosqichdan)
//
// `orders.holat` da saqlanadi. ESKI lidlarda bu maydon yo'q — ular uchun
// holat mavjud maydonlardan HISOBLANADI (`holatOf`), bazaga migratsiya
// qilinmaydi: guruhga yozilgan (`groupId`), rad etilgan, birinchi darsi
// belgilangan va h.k. Shu bois eski 150+ lid ham yangi ro'yxatda to'g'ri
// ustunga tushadi.
//
// BOSHQA HOLAT MAYDONLARI BILAN ARALASHTIRILMAYDI, lekin SINXRON qilinadi:
//   `status`            — eski CRM ish jarayoni ("Yangi", "Qabul qilindi" …);
//   `leadStatus`        — Telegram tugmasi (lib/leadStatus.ts) — bosilganda
//                         holat ham o'zgaradi (`holatFromTelegram`);
//   `firstLesson/teacher/firstLessonStatus` — «Birinchi darsga yozilganlar»
//                         sahifasi o'qiydi; «Sinov darsiga yozish» ularni to'ldiradi;
//   `group/groupId`     — «Guruhga qo'shish» ularni to'ldiradi.
// Bu fayl `mongodb` ni import qilmaydi — mijoz ham, server ham o'qiydi.

export type LeadHolat = "yangi" | "bog" | "sinov" | "guruh" | "rad";

export interface LeadHolatMeta {
  id: LeadHolat;
  nom: string;
  /** leads.css dagi `ld-tone-*` / kartadagi rang. */
  tone: "yangi" | "bog" | "sinov" | "guruh" | "rad";
  /** Telegram xabaridagi belgi. */
  emoji: string;
}

export const HOLATLAR: readonly LeadHolatMeta[] = [
  { id: "yangi", nom: "Yangi", tone: "yangi", emoji: "⚪" },
  { id: "bog", nom: "Bog'lanildi", tone: "bog", emoji: "📞" },
  { id: "sinov", nom: "Sinov darsiga yozildi", tone: "sinov", emoji: "🟢" },
  { id: "guruh", nom: "Guruhga qo'shildi", tone: "guruh", emoji: "✅" },
  { id: "rad", nom: "Rad etdi", tone: "rad", emoji: "❌" },
];

/** Voronka bosqichlari tartibi (rad bundan tashqarida). */
export const HOLAT_STEPS: readonly LeadHolat[] = ["yangi", "bog", "sinov", "guruh"];

export function isHolat(v: unknown): v is LeadHolat {
  return typeof v === "string" && HOLATLAR.some((h) => h.id === v);
}

export function holatMeta(id: LeadHolat): LeadHolatMeta {
  return HOLATLAR.find((h) => h.id === id) ?? HOLATLAR[0];
}

/** Oxirgi o'zgarishni shuncha daqiqa ichida har kim bekor qila oladi; keyin — faqat direktor. */
export const UNDO_MINUTES = 10;

/** Sinov darsi — sana "YYYY-MM-DD", vaqt "HH:MM" (Toshkent). */
export interface LeadSinov {
  sana: string;
  vaqt: string;
  oqituvchi: string;
}

/** Lid yozilgan guruh. `kun`/`vaqt` guruh jadvalidan, `boshlash` — birinchi dars. */
export interface LeadGuruh {
  id: number;
  nom: string;
  kun: string;
  vaqt: string;
  boshlash: string;
}

/**
 * Tarix yozuvi — MATN EMAS, TUZILMA (mijoz tanlangan tilda yig'adi).
 *   created   — lid qo'shildi (`text` — manba/kanal);
 *   holat     — holat o'zgardi (`holat`, `from`, `skipped`, `text` — tafsilot);
 *   undo      — oxirgi o'zgarish bekor qilindi (`from` → `holat`);
 *   telegram  — Telegram tugmasi bosildi (`holat`, `text` — tugma yorlig'i);
 *   duplicate — shu raqamli oldingi lid bor (`text` — "#12");
 *   note      — izoh saqlandi.
 */
export interface LeadHolatEvent {
  at: string;
  kind: "created" | "holat" | "undo" | "telegram" | "duplicate" | "note";
  holat?: LeadHolat;
  from?: LeadHolat;
  skipped?: LeadHolat[];
  by: string;
  text?: string;
  /** Holat tafsiloti — tarixda ko'rsatish uchun o'sha paytdagi nusxa. */
  sinov?: LeadSinov;
  guruhNom?: string;
  radSabab?: string;
}

/**
 * Bekor qilish uchun o'zgarishdan OLDINGI holat — sinxron qilinadigan eski
 * maydonlar bilan birga (qaytarilganda ular ham tiklanadi).
 */
export interface LeadHolatSnapshot {
  holat: LeadHolat;
  radSabab: string | null;
  guruh: LeadGuruh | null;
  firstLesson: string;
  teacher: string;
  firstLessonStatus: string | null;
  status: string;
  group: string;
  groupId: number | null;
  moderator: string;
  /** Telegram tugmasining javobi — xabardagi "Bog'lanildi" qatori shundan. */
  leadStatus: string | null;
  /** Qachon o'zgartirilgan (ISO) — bekor qilish muddati shundan sanaladi. */
  at: string;
  by: string;
}

/** `holatOf` o'qiydigan maydonlar — Order'ning bir qismi. */
export interface HolatSource {
  holat?: unknown;
  groupId?: number;
  status?: string;
  leadStatus?: string;
  firstLesson?: string;
  firstLessonStatus?: string;
  stage?: string;
}

/**
 * Lidning holati. Maydon bo'lsa — o'sha; bo'lmasa ESKI maydonlardan:
 * guruhga yozilgan → guruh; rad etilgan → rad; birinchi darsi bor →
 * sinov; biror aloqa belgisi bor (Telegram tugmasi, eski holat yoki
 * bosqich rangi) → bog'lanildi; qolgani — yangi.
 */
export function holatOf(o: HolatSource): LeadHolat {
  if (isHolat(o.holat)) return o.holat;
  if (o.groupId || o.firstLessonStatus === "GURUHGA_QOSHILDI") return "guruh";
  if (o.leadStatus === "reject" || o.status === "Bekor qilindi" || o.firstLessonStatus === "RAD_ETDI") return "rad";
  if ((o.firstLesson || "").trim() || o.leadStatus === "first") return "sinov";
  if (o.leadStatus === "later" || o.leadStatus === "pay" || o.stage || (o.status && o.status !== "Yangi")) return "bog";
  return "yangi";
}

/**
 * Ruxsat etilgan o'tish — prototipdagi oqim bilan bir xil, CRM'da ham,
 * Telegram tugmasida ham (ikkalasi bitta holatni yuritadi):
 *   • voronkada faqat OLDINGA (oraliq bosqichni tashlab o'tish mumkin);
 *   • istalgan bosqichdan — «Rad etdi», guruhga qo'shilgandan tashqari;
 *   • raddan — qayta bog'lanish (yoki darhol sinov darsiga yozish);
 *   • sinov → sinov — darsni boshqa kunga ko'chirish.
 * ORQAGA yurish yo'q — faqat «Bekor qilish» bilan (tarixda iz qoladi).
 */
export function canTransition(from: LeadHolat, to: LeadHolat): boolean {
  if (from === "guruh") return false;
  if (to === "rad") return from !== "rad";
  if (from === "rad") return to === "bog" || to === "sinov";
  if (from === "sinov" && to === "sinov") return true;
  return HOLAT_STEPS.indexOf(to) > HOLAT_STEPS.indexOf(from);
}

/**
 * Telegram tugmasi → holat (lib/leadStatus.ts dagi kalitlar). 29.09.2026 dan
 * tugma kaliti holatning o'zi; eski kalitlar (guruhdagi eski xabarlar) ham.
 */
export function holatFromTelegram(key: string): LeadHolat | null {
  if (key === "bog" || key === "sinov" || key === "rad") return key;
  if (key === "first") return "sinov";
  if (key === "later" || key === "pay") return "bog";
  if (key === "reject") return "rad";
  return null;
}

/** "29.08.2026 | 16:00" → { sana: "2026-08-29", vaqt: "16:00" }. */
export function parseFirstLesson(s: string | undefined): { sana: string; vaqt: string } | null {
  const m = (s || "").match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s*\|\s*(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  return { sana: `${m[3]}-${m[2]}-${m[1]}`, vaqt: m[4] ? `${m[4].padStart(2, "0")}:${m[5]}` : "" };
}

/** { sana, vaqt } → "29.08.2026 | 16:00" — eski `firstLesson` shakli. */
export function formatFirstLesson(sana: string, vaqt: string): string {
  const [y, mo, d] = sana.split("-");
  return `${d}.${mo}.${y}${vaqt ? ` | ${vaqt}` : ""}`;
}

/**
 * Sinov darsi — eski `firstLesson`/`teacher` maydonlaridan. Alohida nusxa
 * saqlanmaydi: «Birinchi darsga yozilganlar» sahifasi darsni ko'chirsa
 * ham Lidlar sahifasi darhol o'shani ko'rsin.
 */
export function sinovOf(o: { firstLesson?: string; teacher?: string }): LeadSinov | null {
  const p = parseFirstLesson(o.firstLesson);
  return p ? { sana: p.sana, vaqt: p.vaqt, oqituvchi: o.teacher || "" } : null;
}

/** Guruh ma'lumoti — yangi maydondan, bo'lmasa eski `group`/`groupId` dan. */
export function guruhOf(o: { guruh?: LeadGuruh | null; group?: string; groupId?: number }): LeadGuruh | null {
  if (o.guruh && o.guruh.nom) return o.guruh;
  if (!o.groupId && !(o.group || "").trim()) return null;
  return { id: o.groupId ?? 0, nom: o.group || String(o.groupId ?? ""), kun: "", vaqt: "", boshlash: "" };
}

/** O'tkazib yuboriladigan oraliq bosqichlar (Yangi → Sinov: [Bog'lanildi]). */
export function skippedSteps(from: LeadHolat, to: LeadHolat): LeadHolat[] {
  const a = HOLAT_STEPS.indexOf(from);
  const b = HOLAT_STEPS.indexOf(to);
  return a >= 0 && b > a + 1 ? HOLAT_STEPS.slice(a + 1, b) : [];
}
