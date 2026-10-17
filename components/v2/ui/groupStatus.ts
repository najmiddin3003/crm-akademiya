// YANGI VERSIYA: GURUH HOLATI BELGILARI VA YOZUVLARI — Guruhlar ro'yxati
// (components/v2/groups/GroupsListV2.tsx) va o'quvchi tezkor paneli
// (components/v2/students/StudentQuickPanel.tsx) uchun bitta manba.
// DESIGN.md → «Holat belgilari»: Yig'ilmoqda — brend, Faol — muvaffaqiyat,
// Muzlatilgan — ma'lumot, Arxiv — betaraf. Yorliqlar dizayndagidek; eski
// versiyadagi «Yig'ilayotgan» / «Aktiv» (lib/groupRules.ts) o'zgarmaydi
// (design/v2/SAVOLLAR.md, 39).

export interface GroupTone {
  label: string;
  badge: string;
  dot: string;
}

export const GROUP_TONE: Record<string, GroupTone> = {
  gathering: { label: "Yig'ilmoqda", badge: "bg-v2-brand-bg text-v2-brand-text", dot: "bg-v2-brand" },
  active: { label: "Faol", badge: "bg-v2-success-bg text-v2-success", dot: "bg-v2-success" },
  frozen: { label: "Muzlatilgan", badge: "bg-v2-info-bg text-v2-info", dot: "bg-v2-info" },
  archive: { label: "Arxiv", badge: "bg-v2-surface-2 text-v2-text-2", dot: "bg-v2-text-3" },
};

/** "205" → "205-xona"; "Kichik zal" o'zgarmaydi. */
export function roomLabel(room: string | undefined): string {
  const r = (room || "").trim();
  return /^\d+$/.test(r) ? `${r}-xona` : r;
}

/** "14:00 - 16:00" → "14:00–16:00". */
export function timeLabel(time: string | undefined): string {
  return (time || "").trim().replace(/\s*-\s*/, "–");
}
