import { groupWeekdays, parsePeriod } from "@/lib/attendance";
import type { Group } from "@/lib/groups";

// Guruh formasining QOIDALARI — majburiy maydonlar, dars vaqti va xona
// bandligi. Klient (GroupFormModal) va server
// (POST /api/groups, PATCH /api/groups/:id) AYNAN shu faylni bo'lishadi:
// modal tugmani o'chiq tutadi, server esa xuddi shu tekshiruvni qayta
// o'tkazadi — brauzerni chetlab yuborilgan so'rov ham bo'sh guruh yozolmaydi.
//
// 11.09.2026 gacha "Yangi guruh qo'shish" oynasida yulduzcha turgan
// maydonlar aslida tekshirilmasdi (faqat nom), o'qituvchi/xona/kun/vaqt
// esa oynada umuman yo'q edi — guruh yaratilgach uni darhol tahrirlashga
// to'g'ri kelardi.
//
// Fayl TOZA (Mongo yo'q) — brauzerga ham tushadi. Bazadan o'qiydigan
// qismi lib/groupRoomClash.ts da.

/**
 * Modal va serverda ruxsat etilgan holatlar (constants/groups.js dagi eski
 * demo ro'yxati emas). Tartib — guruh hayot yo'li:
 *
 *   gathering  "Yig'ilayotgan" — guruh endi tuzilyapti, o'quvchilar
 *              yig'ilmoqda, dars HALI boshlanmagan (18.09.2026, moderator
 *              so'rovi). Buyurtma formasidagi "Yig'ilayotgan guruh"
 *              tanlovi shu guruhlarni nazarda tutadi. Xona/kun/vaqt
 *              allaqachon belgilangan bo'ladi, shu bois u xonani BAND
 *              QILADI (aktivga o'tganda to'qnashuv chiqmasin), lekin
 *              davomat kutilmaydi (lessonExpectedOn) va xona hisobotida
 *              dars o'tayotgan guruh sanalmaydi.
 *   active     dars o'tilmoqda;
 *   frozen     vaqtincha to'xtagan — xona saqlanib turadi;
 *   archive    tugagan — hech narsa band qilmaydi.
 *
 * Yorliqlar ham shu yerda: ro'yxat, o'quvchi profilidagi Guruh tabi va
 * filtr tanlovi bitta manbadan o'qisin — ilgari uchta nusxa bor edi va
 * yangi holat qo'shilganda birortasi unutilishi mumkin edi.
 */
export const GROUP_STATUS_VALUES = ["gathering", "active", "frozen", "archive"] as const;
export type GroupStatus = (typeof GROUP_STATUS_VALUES)[number];
export const GROUP_STATUS_LABELS: Record<GroupStatus, string> = {
  gathering: "Yig'ilayotgan",
  active: "Aktiv",
  frozen: "Muzlatilgan",
  archive: "Arxiv",
};

/**
 * Xonani band qiladigan holatlar — bandlik tekshiruvi (klientda
 * `findRoomConflict`, serverda lib/groupRoomClash.ts va POST/PATCH
 * /api/groups) HAMMASI shu ro'yxatga qaraydi. Arxiv xona egallamaydi.
 */
export const ROOM_HOLDING_STATUSES: readonly string[] = ["gathering", "active", "frozen"];
export function holdsRoom(status: string | undefined): boolean {
  return ROOM_HOLDING_STATUSES.includes(String(status ?? ""));
}

/**
 * Majburiy maydonlar va ularning foydalanuvchi ko'radigan nomlari — xato
 * matni va "To'ldiring: …" ko'rsatmasi shu ro'yxatdan yasaladi.
 *
 * Daraja (bosqich) ATAYIN yo'q: arxivdagi 110 guruhning 61 tasida u bo'sh
 * (Matematika, Ona tili kabi kurslarda bosqich yo'q). O'qituvchi, xona,
 * kun va vaqt esa 109/110 da to'ldirilgan — ular jadval, davomat va xona
 * hisobotini yuritadi, bo'sh qolsa guruh o'sha sahifalarga tushmaydi.
 */
export const GROUP_REQUIRED: { key: keyof GroupFormInput; label: string }[] = [
  { key: "name", label: "Guruh nomi" },
  { key: "status", label: "Guruh holati" },
  { key: "course", label: "Kurs" },
  { key: "day", label: "Dars kunlari" },
  { key: "time", label: "Dars vaqti" },
  { key: "teacher", label: "O'qituvchi" },
  { key: "eduType", label: "Ta'lim turi" },
  { key: "room", label: "Xona" },
];

export interface GroupFormInput {
  name?: string;
  status?: string;
  course?: string;
  level?: string;
  day?: string;
  /** "HH:MM - HH:MM" */
  time?: string;
  teacher?: string;
  assistant?: string;
  eduType?: string;
  room?: string;
  telegram?: string | null;
  startDate?: string;
  endDate?: string;
}

/** "08:30" → 510. Format mos kelmasa null. */
export function timeToMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** "08:00 - 10:00" → [480, 600]. Format mos kelmasa yoki tugash ≤ boshlanish bo'lsa null. */
export function parseTimeRange(time: string): [number, number] | null {
  const m = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec((time || "").trim());
  if (!m) return null;
  const a = timeToMinutes(m[1]);
  const b = timeToMinutes(m[2]);
  if (a === null || b === null || b <= a) return null;
  return [a, b];
}

/** Modal ikki maydonidan bazadagi "HH:MM - HH:MM" shakli. Biri bo'sh — "". */
export function joinTime(start: string, end: string): string {
  return start && end ? `${start} - ${end}` : "";
}

export type GroupValidation =
  | { ok: true }
  | { ok: false; error: string; field: keyof GroupFormInput };

/**
 * Majburiy maydonlar va qiymat shakllari.
 *
 * `partial` — PATCH uchun: faqat so'rovda KELGAN maydonlar tekshiriladi
 * (masalan, {status:"archive"} yolg'iz keladi — Guruh sahifasidagi
 * "Arxivlash"). Kelgan maydon esa bo'sh bo'lishi mumkin emas — tahrirlash
 * bilan majburiy maydonni o'chirib bo'lmaydi.
 */
export function validateGroupInput(input: GroupFormInput, opts: { partial?: boolean } = {}): GroupValidation {
  const has = (k: keyof GroupFormInput) => !opts.partial || input[k] !== undefined;
  for (const { key, label } of GROUP_REQUIRED) {
    if (!has(key)) continue;
    const v = input[key];
    if (typeof v !== "string" || !v.trim()) {
      return { ok: false, error: `${label} — majburiy maydon`, field: key };
    }
  }
  if (has("status") && !(GROUP_STATUS_VALUES as readonly string[]).includes(String(input.status))) {
    return { ok: false, error: "Guruh holati noto'g'ri", field: "status" };
  }
  if (has("time") && input.time !== undefined) {
    const range = parseTimeRange(input.time);
    if (!range) {
      const parts = input.time.split("-");
      const startOk = timeToMinutes(parts[0] || "") !== null;
      const endOk = timeToMinutes(parts[1] || "") !== null;
      return {
        ok: false,
        error: startOk && endOk ? "Tugash vaqti boshlanishdan keyin bo'lishi kerak" : "Dars vaqti — boshlanish va tugash vaqtini tanlang",
        field: "time",
      };
    }
  }
  return { ok: true };
}

/**
 * Formada hali to'ldirilmagan majburiy maydonlarning nomlari — "Saqlash"
 * tugmasi o'chiq turganda yonidagi "To'ldiring: …" yozuvi uchun.
 */
export function missingGroupFields(input: GroupFormInput): string[] {
  return GROUP_REQUIRED.filter(({ key }) => {
    const v = input[key];
    return typeof v !== "string" || !v.trim();
  }).map(({ label }) => label);
}

/** Xona bandligini tekshirish uchun nomzod guruhning jadval bo'lagi. */
export interface RoomSlot {
  room: string;
  day: string;
  time: string;
  startDate?: string;
  endDate?: string;
}

type SlotGroup = Pick<Group, "id" | "name" | "room" | "day" | "time" | "status"> &
  Partial<Pick<Group, "period" | "startDate" | "endDate">>;

/**
 * Guruh muddatining chegaralari ("YYYY-MM-DD" yoki bo'sh): `startDate/endDate`
 * yo'q bo'lsa `period` satridan. ISO satrlar leksik taqqoslanadi — `Date`
 * obyektlari emas (lib/uzTime.ts dagi 5 soatlik siljish tuzog'i).
 */
export function groupBoundsIso(g: { startDate?: string; endDate?: string; period?: string }): { start: string; end: string } {
  const iso = (d: Date | null) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "");
  const p = g.period ? parsePeriod(g.period) : { start: null, end: null };
  return { start: g.startDate || iso(p.start), end: g.endDate || iso(p.end) };
}

/**
 * Shu kuni guruhda DARS BO'LISHI KUTILADIMI — ro'yxatdagi sariq belgi
 * ("bugun davomat qilinmagan") shu qoidaga tayanadi.
 *
 * Uchta shart birga: guruh aktiv (muzlatilgan/arxivda dars yo'q), hafta
 * kuni jadvalga mos va sana guruh muddati ICHIDA. Ilgari faqat hafta kuni
 * tekshirilardi — 16-sentabrda boshlanadigan guruh 14-sentabrda "davomat
 * qilinmadi" deb sariq turardi, hali boshlanmagan darsga davomat esa
 * bo'lmaydi. Davomat jadvali (lessonDates) ham muddatdan tashqari kunga
 * ustun chiqarmaydi — ikkalasi bir xil chegaraga qarasin.
 *
 * @param iso     Tekshirilayotgan kun, "YYYY-MM-DD" (Toshkent kuni).
 * @param weekday O'sha kunning hafta kuni (0 — yakshanba), `Date#getDay()` kabi.
 */
export function lessonExpectedOn(
  g: { status?: string; day?: string; startDate?: string; endDate?: string; period?: string },
  iso: string,
  weekday: number,
): boolean {
  if (g.status !== "active") return false;
  if (!groupWeekdays(g.day).includes(weekday)) return false;
  const b = groupBoundsIso(g);
  if (b.start && iso < b.start) return false;
  if (b.end && iso > b.end) return false;
  return true;
}

/**
 * Xona shu kun va vaqtda boshqa guruh bilan bandmi. Bandlik faqat
 * YIG'ILAYOTGAN, AKTIV va MUZLATILGAN guruhlar bilan hisoblanadi
 * (ROOM_HOLDING_STATUSES; arxiv xona egallamaydi); muddati tugab bo'lgan
 * guruh ham hisobga kirmaydi — aks holda mavsumi o'tgan, lekin
 * arxivlanmagan guruh xonani abadiy band qilib turardi.
 *
 * Kun kesishuvi lib/attendance.ts `groupWeekdays` bo'yicha ("Toq kunlar"
 * bilan "Du,Ju" kesishadi), vaqt — daqiqalarda yarim ochiq oraliq
 * ([08:00,10:00) bilan [10:00,12:00) kesishmaydi).
 *
 * @param todayIso Nomzodda boshlanish sanasi bo'lmasa muddat shu kundan deb olinadi.
 * @param excludeId Tahrirlanayotgan guruhning o'zi (PATCH) — o'zi bilan to'qnashmasin.
 */
export function findRoomConflict<G extends SlotGroup>(
  candidate: RoomSlot,
  groups: G[],
  todayIso: string,
  excludeId?: number,
): G | null {
  const room = candidate.room.trim().toLowerCase();
  if (!room) return null;
  const range = parseTimeRange(candidate.time);
  const days = groupWeekdays(candidate.day);
  if (!range || days.length === 0) return null;
  const candStart = candidate.startDate || todayIso;
  const candEnd = candidate.endDate || "";

  for (const g of groups) {
    if (excludeId !== undefined && g.id === excludeId) continue;
    if (!holdsRoom(g.status)) continue;
    if ((g.room || "").trim().toLowerCase() !== room) continue;
    const gRange = parseTimeRange(g.time);
    if (!gRange || !(range[0] < gRange[1] && gRange[0] < range[1])) continue;
    const gDays = groupWeekdays(g.day);
    if (!gDays.some((d) => days.includes(d))) continue;
    // Muddatlar kesishmasa — bo'shagan xona. ISO satrlar leksik taqqoslanadi.
    const b = groupBoundsIso(g);
    if (b.end && b.end < candStart) continue;
    if (candEnd && b.start && b.start > candEnd) continue;
    return g;
  }
  return null;
}

/** Xato/ogohlantirish matni — modal ostida ham, 409 javobida ham bir xil. */
export function roomConflictText(room: string, g: SlotGroup): string {
  return `${room} bu vaqtda band — «${g.name}» guruhi (${g.day}, ${g.time})`;
}
