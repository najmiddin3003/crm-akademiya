import type { AiQuestion } from "@/lib/ai/protocol";

// SUHBAT KO'RINISHI — sof yordamchilar (11.10.2026): vaqt belgilari, kun
// ajratgichlari va intervyu javobi matni. AssistantPanel chizadi,
// scripts/_verify-ai.mjs sinaydi (shuning uchun React ham, `t()` ham yo'q).
//
// Foydalanuvchi: «yangi chat ochilib yozilsa yuqorida chat boshlangan vaqt
// tursin, 1–2 kundan keyin ham o'sha chatga kirib yozilsa o'sha yozilgan vaqt
// chatda ko'rinib chat davom etishi kerak».

/** Shu tanaffusdan keyingi xabar oldida vaqt ajratgichi chiqadi (bir kun ichida ham). */
export const GAP_MS = 60 * 60 * 1000;

const DAY_MS = 86_400_000;

function localDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Xabar oldida ajratgich kerakmi: birinchi xabar (suhbat boshlangan vaqt),
 * boshqa kun yoki bir soatdan ko'p tanaffus. Vaqti noma'lum xabar — yo'q.
 */
export function needsSeparator(prevAt: string | undefined, at: string | undefined): boolean {
  const cur = at ? Date.parse(at) : NaN;
  if (!Number.isFinite(cur)) return false;
  const prev = prevAt ? Date.parse(prevAt) : NaN;
  if (!Number.isFinite(prev)) return true;
  return localDay(prev) !== localDay(cur) || cur - prev >= GAP_MS;
}

export type DayKind = "today" | "yesterday" | "date";

/** Kun turi — qurilmaning mahalliy kuni bilan (xodim Toshkentda). */
export function dayKind(at: string, now: Date): DayKind {
  const day = localDay(Date.parse(at));
  const today = localDay(now.getTime());
  if (day === today) return "today";
  if (day === today - DAY_MS) return "yesterday";
  return "date";
}

/** "14:05" — mahalliy vaqt. */
export function clockOf(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Kun, oy (0–11) va yil — sanani til bo'yicha yozish uchun. */
export function dateParts(at: string): { day: number; month: number; year: number } {
  const d = new Date(at);
  return { day: d.getDate(), month: d.getMonth(), year: d.getFullYear() };
}

/**
 * Intervyu javobi → xodimning keyingi xabari ("Filial: Barcha filiallar").
 * `picked[i]` — i-savolda tanlangan (yoki yozilgan) variantlar.
 */
export function answerText(questions: AiQuestion[], picked: string[][]): string {
  return questions
    .map((q, i) => {
      const values = (picked[i] ?? []).map((v) => v.trim()).filter(Boolean);
      if (!values.length) return "";
      return `${q.header || q.question}: ${values.join(", ")}`;
    })
    .filter(Boolean)
    .join("\n");
}

/** Variant yorlig'idan model qo'shgan «(Tavsiya)» belgisini ajratadi — panel uni alohida nishon qiladi. */
export function splitRecommended(label: string): { text: string; recommended: boolean } {
  const m = label.match(/^(.*?)\s*\((tavsiya|recommended|тавсия)\)\s*$/i);
  return m ? { text: m[1].trim(), recommended: true } : { text: label, recommended: false };
}
